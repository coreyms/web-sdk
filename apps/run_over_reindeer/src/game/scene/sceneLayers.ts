// THE SCENE AROUND THE ROAD (scene pass 9, Corey 2026-11-16: "The Phone Portrait modes should have snow from top to
// bottom, like the desktops"): the pieces of the scene preset now showing (game/scenePresets.ts), drawn in ROAD PX inside
// the road board's own container (game/road/roadBoard.ts places each layer in its draw order), so they scale with the
// road on every layout. Plain sprites only: no filter, mask, shader or tiling shader; the field is a grid of plain
// sprites of the one tile, laid on the tile's own period from the picture's corner.
//
// Draw order (the kit's, snow_scene_kit_r1 NOTES section 6), bottom to top:
//   field     the tile repeated over every road px the screen shows (under the road picture)
//   bands     over the road picture's own plain margins at its top and bottom
//   forest    an upright phone only: full width, behind and above the billboard (constants SCENE.forest)
//   ...       the road's own ground, traffic, features, win, stoplights
//   cover     the field's pixels again, beside the picture, over the traffic that has driven past its edge (where the
//             rock hid it before: constants SCENE.edgeCoverBelowFeet)
//   ...       the tunnel portal strips
//   ends      the two painted tunnel ends (desktop, tablet, phone held sideways)
//   ...       the running reindeer (over the ends), then the billboard (game/scene/logoSign.ts, its own container)
import * as PIXI from 'pixi.js';

import { SCENE } from '../constants';
import { SCENE_ART } from '../sceneArtSpec';
import type { LayoutKind } from '../layoutSpec';
import type { ScenePreset } from '../scenePresets';

const IMG = { width: 1536, height: 1024 };
const TILE = { width: SCENE_ART.snowDay.field.road[2], height: SCENE_ART.snowDay.field.road[3] };

/** where a piece of the kit goes, road px [x, y, width, height] (tools/build_scene.py), by its asset key */
const KIT_PLACE: Record<string, readonly number[]> = {
	sceneBandTop: SCENE_ART.snowDay.bandTop.road,
	sceneBandBottom: SCENE_ART.snowDay.bandBottom.road,
	sceneEndLeft: SCENE_ART.snowDay.endLeft.road,
	sceneEndRight: SCENE_ART.snowDay.endRight.road,
};
const FOREST_ASPECT = SCENE_ART.snowDay.forest.aspect;

/** the part of the road's plane the screen shows, road px */
export type RoadRect = { left: number; top: number; right: number; bottom: number };
export type SceneView = { kind: LayoutKind; uprightPhone: boolean; rect: RoadRect; feetY: number };

/** a texture by asset key: the loaded one, or null while it is not in (a lazy piece: the caller loads it) */
export type SceneTextures = (key: string) => PIXI.Texture | null;

/** the forest's bottom edge (road px from the picture's top) for `snow` road px of snow above the picture (SCENE.forest) */
export const forestBottom = (rect: RoadRect, width: number): number => {
	const F = SCENE.forest;
	const [a, b] = F.anchors;
	const snow = -rect.top;
	const t = (snow - a.snow) / (b.snow - a.snow);
	let bottom = a.bottom + (b.bottom - a.bottom) * t;
	// the trees always run off the top of the screen, and never far into the picture
	const height = width * FOREST_ASPECT;
	bottom = Math.min(bottom, rect.top - F.topSpare + height, F.maxBelow);
	return bottom;
};

export class SceneLayers {
	readonly field = new PIXI.Container();
	readonly bands = new PIXI.Container();
	readonly forest = new PIXI.Container();
	readonly cover = new PIXI.Container();
	readonly ends = new PIXI.Container();

	private preset: ScenePreset | null = null;
	private tex: SceneTextures = () => null;
	private view: SceneView | null = null;
	private readonly fieldPool: PIXI.Sprite[] = [];
	private readonly coverPool: PIXI.Sprite[] = [];
	/** the field tile's sub-frames for the cover's first row (cut once per tile row offset) */
	private readonly rowFrames = new Map<string, PIXI.Texture>();
	private forestSprite: PIXI.Sprite | null = null;
	/** what the last layout drew, for the probes and the dev hook */
	last: { fieldSprites: number; coverSprites: number; forest: { x: number; y: number; width: number; height: number } | null; ends: boolean } = { fieldSprites: 0, coverSprites: 0, forest: null, ends: false };

	constructor() {
		for (const c of [this.field, this.bands, this.forest, this.cover, this.ends]) c.eventMode = 'none';
	}

	/** THE SWAP POINT on the Pixi side: draw this preset's pieces (textures by asset key) */
	setPreset(preset: ScenePreset, tex: SceneTextures) {
		this.preset = preset;
		this.tex = tex;
		this.bands.removeChildren().forEach((c) => c.destroy());
		this.ends.removeChildren().forEach((c) => c.destroy());
		for (const t of this.rowFrames.values()) t.destroy();
		this.rowFrames.clear();
		for (const s of this.fieldPool) s.texture = PIXI.Texture.EMPTY;
		for (const s of this.coverPool) s.texture = PIXI.Texture.EMPTY;
		this.forestSprite?.destroy();
		this.forestSprite = null;
		const piece = (key: string) => {
			const t = tex(key);
			const p = KIT_PLACE[key];
			if (!t || !p) return null;
			const s = new PIXI.Sprite(t);
			s.position.set(p[0], p[1]);
			s.width = p[2];
			s.height = p[3];
			return s;
		};
		if (preset.bands) for (const key of [preset.bands.top, preset.bands.bottom]) {
			const s = piece(key);
			if (s) this.bands.addChild(s);
		}
		if (preset.ends) for (const key of [preset.ends.left, preset.ends.right]) {
			const s = piece(key);
			if (s) this.ends.addChild(s);
		}
		if (this.view) this.layout(this.view);
	}

	/** a lazy piece has come in (the forest on a desktop browser narrowed to a phone): draw it */
	refresh() {
		if (this.view) this.layout(this.view);
	}

	/** lay the scene out for the screen as it is now (components/Board.svelte, on every layout change) */
	layout(view: SceneView) {
		this.view = view;
		const P = this.preset;
		const fieldTex = P ? this.tex(P.field) : null;
		const r = view.rect;
		// THE FIELD: whole tiles on the tile's own period, from the tile at or before the screen's top left
		let n = 0;
		if (fieldTex) {
			const i0 = Math.floor(r.left / TILE.width);
			const j0 = Math.floor(r.top / TILE.height);
			for (let j = j0; j * TILE.height < r.bottom; j++) {
				for (let i = i0; i * TILE.width < r.right; i++) {
					const s = this.sprite(this.fieldPool, this.field, n++);
					s.texture = fieldTex;
					s.position.set(i * TILE.width, j * TILE.height);
					s.width = TILE.width;
					s.height = TILE.height;
				}
			}
		}
		for (let k = n; k < this.fieldPool.length; k++) this.fieldPool[k].visible = false;
		this.last.fieldSprites = n;

		// THE COVER beside the picture: the same tiles over the traffic, from just under the reindeer's feet line down
		let m = 0;
		if (fieldTex) {
			const top = view.feetY + SCENE.edgeCoverBelowFeet;
			const j0 = Math.floor(top / TILE.height);
			for (const side of [-1, 1] as const) {
				const iFrom = side < 0 ? Math.floor(r.left / TILE.width) : Math.floor(IMG.width / TILE.width);
				const iTo = side < 0 ? -1 : Math.floor((r.right - 1e-6) / TILE.width);
				// (half a road px of float noise at a picture that spans the screen exactly is no screen room)
				if (side < 0 && r.left >= -0.5) continue;
				if (side > 0 && r.right <= IMG.width + 0.5) continue;
				for (let j = j0; j * TILE.height < r.bottom; j++) {
					const y0 = Math.max(j * TILE.height, top);
					const cut = y0 - j * TILE.height;
					for (let i = iFrom; i <= iTo; i++) {
						const s = this.sprite(this.coverPool, this.cover, m++);
						s.texture = cut > 0 ? this.rowFrame(fieldTex, cut) : fieldTex;
						s.position.set(i * TILE.width, y0);
						s.width = TILE.width;
						s.height = TILE.height - cut;
					}
				}
			}
		}
		for (let k = m; k < this.coverPool.length; k++) this.coverPool[k].visible = false;
		this.last.coverSprites = m;

		// THE ENDS: on the layouts the preset names
		const ends = !!P?.ends && P.ends.layouts.includes(view.kind);
		this.ends.visible = ends;
		this.last.ends = ends;

		// THE FOREST: an upright phone only
		const forestKey = P?.forest ?? null;
		const forestTex = forestKey && view.uprightPhone ? this.tex(forestKey) : null;
		if (forestTex) {
			if (!this.forestSprite) {
				this.forestSprite = new PIXI.Sprite(forestTex);
				this.forest.addChild(this.forestSprite);
			}
			this.forestSprite.texture = forestTex;
			const width = Math.max(IMG.width, r.right - r.left);
			const height = width * FOREST_ASPECT;
			const bottom = forestBottom(r, width);
			const x = IMG.width / 2 - width / 2;
			this.forestSprite.position.set(x, bottom - height);
			this.forestSprite.width = width;
			this.forestSprite.height = height;
			this.forest.visible = true;
			this.last.forest = { x, y: bottom - height, width, height };
		} else {
			this.forest.visible = false;
			this.last.forest = null;
		}
	}

	private sprite(pool: PIXI.Sprite[], parent: PIXI.Container, k: number): PIXI.Sprite {
		let s = pool[k];
		if (!s) {
			s = new PIXI.Sprite(PIXI.Texture.EMPTY);
			s.eventMode = 'none';
			pool.push(s);
			parent.addChild(s);
		}
		s.visible = true;
		return s;
	}

	/** the field tile from road y `cut` down (the cover's first row starts mid tile) */
	private rowFrame(tex: PIXI.Texture, cut: number): PIXI.Texture {
		const key = cut.toFixed(2);
		let t = this.rowFrames.get(key);
		if (!t) {
			const k = tex.source.height / TILE.height;
			t = new PIXI.Texture({ source: tex.source, frame: new PIXI.Rectangle(0, cut * k, tex.source.width, (TILE.height - cut) * k) });
			this.rowFrames.set(key, t);
		}
		return t;
	}

	destroy() {
		for (const t of this.rowFrames.values()) t.destroy();
		this.rowFrames.clear();
		for (const c of [this.field, this.bands, this.forest, this.cover, this.ends]) c.destroy({ children: true });
	}
}
