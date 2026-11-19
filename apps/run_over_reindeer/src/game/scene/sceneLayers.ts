// THE SCENE AROUND THE ROAD (scene pass 9, Corey 2026-11-16: "The Phone Portrait modes should have snow from top to
// bottom, like the desktops"): the pieces of the scene preset now showing (game/scenePresets.ts), drawn in ROAD PX inside
// the road board's own container (game/road/roadBoard.ts places each layer in its draw order), so they scale with the
// road on every layout. Plain sprites only: no filter, mask, shader or tiling shader; the field is a grid of plain
// sprites of the one tile, laid on the tile's own period from the picture's corner.
//
// Draw order (the kit's, snow_scene_kit_r1 NOTES section 6), bottom to top:
//   field     the tile repeated over every road px the screen shows (under the road picture)
//   picture   the road picture itself (scene swap: each preset has its own; the night kits re-colour it)
//   bands     over the road picture's own plain margins at its top and bottom
//   forest    an upright phone only: full width, behind and above the billboard (constants SCENE.forest)
//   ...       the road's own ground, traffic, features, win, stoplights
//   cover     the field's pixels again, beside the picture, over the traffic that has driven past its edge (where the
//             rock hid it before: constants SCENE.edgeCoverBelowFeet)
//   tunnels   the two tunnel portal strips cut from the picture (drawn over the traffic; each preset has its own)
//   ends      the two painted tunnel ends (desktop, tablet, phone held sideways)
//   ...       the running reindeer (over the ends), then the billboard (game/scene/logoSign.ts, its own container)
//
// THE CROSS-FADE (scene swap, 2026-11-17; game/scene/sceneSwap.ts): each preset on screen is a SKIN, one container of
// its own in every layer above. One skin normally; during a swap the incoming skin sits over the outgoing one in every
// layer and its alpha runs 0 to 1 (a plain alpha cross-fade: the outgoing stays whole under it); then the outgoing skin's
// own alpha runs 1 to 0 over a short tail (where a soft edged piece of each lies on the other, the outgoing edge would
// otherwise vanish in one frame), and it is hidden and let go two frames later. No filter, no mask, no render texture.
import * as PIXI from 'pixi.js';

import { SCENE } from '../constants';
import { SCENE_ART } from '../sceneArtSpec';
import { ROAD_ART } from '../roadArtSpec';
import type { LayoutKind } from '../layoutSpec';
import type { ScenePreset } from '../scenePresets';
import { FOREST_LINE } from '../forestLineSpec';

const IMG = { width: 1536, height: 1024 };
const TILE = { width: SCENE_ART.snowDay.field.road[2], height: SCENE_ART.snowDay.field.road[3] };
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

/** WHERE THE FOREST IS DRAWN on an upright phone (road px): the screen's width or the picture's, whichever is wider,
 *  its bottom by forestBottom. The one rule for the scene below, the roaming reindeer's tree line (the drawn forest) and
 *  the billboard logo's foot (forestLineY). */
export const forestBox = (rect: RoadRect) => {
	const width = Math.max(IMG.width, rect.right - rect.left);
	const height = width * FOREST_ASPECT;
	const bottom = forestBottom(rect, width);
	return { x: IMG.width / 2 - width / 2, y: bottom - height, width, height };
};

/** THE TREE LINE over x0 to x1 (road px) of the forest drawn for `rect`: the lowest tree pixel there, of every kit's
 *  forest (game/forestLineSpec.ts), so what stands on it keeps one place through a scene swap. -Infinity: none there */
export const forestLineY = (rect: RoadRect, x0: number, x1: number): number => {
	const f = forestBox(rect);
	let y = -Infinity;
	for (const kit of Object.values(FOREST_LINE)) {
		const line = kit.line as readonly number[];
		for (let i = 0; i < line.length; i++) {
			const a = f.x + (f.width * i) / line.length;
			const b = f.x + (f.width * (i + 1)) / line.length;
			if (b <= x0 || a >= x1) continue;
			y = Math.max(y, f.y + f.height * line[i]);
		}
	}
	return y;
};

/** the asset keys a preset draws on this view (the forest only on an upright phone, the ends only where its layouts
 *  show them): what a swap must have loaded before it starts */
export const keysFor = (P: ScenePreset, view: { kind: LayoutKind; uprightPhone: boolean } | null): string[] => {
	const keys = [P.field, P.picture.road, P.picture.tunnelLeft, P.picture.tunnelRight];
	if (P.bands) keys.push(P.bands.top, P.bands.bottom);
	if (P.ends && (!view || P.ends.layouts.includes(view.kind))) keys.push(P.ends.left, P.ends.right);
	if (P.forest && view?.uprightPhone) keys.push(P.forest);
	return keys;
};

/** one preset on screen: its own container in every layer, its sprites, its alpha */
type Skin = {
	preset: ScenePreset;
	field: PIXI.Container;
	picture: PIXI.Container;
	bands: PIXI.Container;
	forest: PIXI.Container;
	cover: PIXI.Container;
	tunnels: PIXI.Container;
	ends: PIXI.Container;
	fieldPool: PIXI.Sprite[];
	coverPool: PIXI.Sprite[];
	/** the field tile's sub-frames for the cover's first row (cut once per tile row offset) */
	rowFrames: Map<string, PIXI.Texture>;
	forestSprite: PIXI.Sprite | null;
	/** the keys its fixed pieces (picture, bands, ends) were built with, so a piece that came in late is added */
	built: Set<string>;
	alpha: number;
};
const PARTS = ['field', 'picture', 'bands', 'forest', 'cover', 'tunnels', 'ends'] as const;

export class SceneLayers {
	readonly field = new PIXI.Container();
	readonly picture = new PIXI.Container();
	readonly bands = new PIXI.Container();
	readonly forest = new PIXI.Container();
	readonly cover = new PIXI.Container();
	readonly tunnels = new PIXI.Container();
	readonly ends = new PIXI.Container();

	private tex: SceneTextures = () => null;
	private view: SceneView | null = null;
	/** the skins on screen: [the one showing] or, during a swap, [outgoing, incoming] */
	private skins: Skin[] = [];
	/** what the last layout drew (the skin showing), for the probes and the dev hook */
	last: { fieldSprites: number; coverSprites: number; forest: { x: number; y: number; width: number; height: number } | null; ends: boolean; skins: string[]; fade: number | null } = {
		fieldSprites: 0,
		coverSprites: 0,
		forest: null,
		ends: false,
		skins: [],
		fade: null,
	};

	constructor() {
		for (const name of PARTS) this[name].eventMode = 'none';
	}

	/** the presets on screen now (the outgoing first during a swap) */
	presets(): ScenePreset[] {
		return this.skins.map((s) => s.preset);
	}
	fading(): boolean {
		return this.skins.length > 1;
	}

	/** THE SWAP POINT on the Pixi side, at once (the boot's preset; a swap with no time): draw this preset's pieces */
	setPreset(preset: ScenePreset, tex: SceneTextures) {
		this.tex = tex;
		for (const s of this.skins.splice(0)) this.retire(s);
		this.skins.push(this.makeSkin(preset, 1));
		if (this.view) this.layout(this.view);
	}

	/** THE CROSS-FADE's start: the incoming preset over the one showing, at alpha 0 (setFade runs it, endFade ends it) */
	beginFade(preset: ScenePreset, tex: SceneTextures) {
		this.tex = tex;
		// a swap asked during a swap: the one fading in is taken as shown (sceneSwap never asks this, the panel might)
		while (this.skins.length > 1) this.retire(this.skins.shift()!);
		this.skins.push(this.makeSkin(preset, 0));
		if (this.view) this.layout(this.view);
		this.last.fade = 0;
	}
	/** the incoming skin's alpha (0..1) */
	setFade(alpha: number) {
		const s = this.skins[1];
		if (!s) return;
		s.alpha = alpha;
		for (const name of PARTS) s[name].alpha = alpha;
		this.last.fade = alpha;
	}
	/** the outgoing skin's alpha (1..0: the tail after the incoming one is whole) */
	setOutgoing(alpha: number) {
		const s = this.skins.length > 1 ? this.skins[0] : null;
		if (!s) return;
		s.alpha = alpha;
		for (const name of PARTS) s[name].alpha = alpha;
	}
	/** the incoming skin is the scene now: the outgoing one is hidden and let go two frames later */
	endFade() {
		if (this.skins.length < 2) return;
		this.setFade(1);
		this.retire(this.skins.shift()!);
		this.last.fade = null;
		this.last.skins = this.skins.map((s) => s.preset.name);
	}

	/** a lazy piece has come in (the forest on a desktop browser narrowed to a phone, an end after a rotation): draw it */
	refresh() {
		if (this.view) this.layout(this.view);
	}

	/** lay the scene out for the screen as it is now (components/Board.svelte, on every layout change) */
	layout(view: SceneView) {
		this.view = view;
		this.skins.forEach((s, i) => this.layoutSkin(s, view, i === this.skins.length - 1));
		this.last.skins = this.skins.map((s) => s.preset.name);
	}

	private makeSkin(preset: ScenePreset, alpha: number): Skin {
		const s: Skin = {
			preset,
			field: new PIXI.Container(),
			picture: new PIXI.Container(),
			bands: new PIXI.Container(),
			forest: new PIXI.Container(),
			cover: new PIXI.Container(),
			tunnels: new PIXI.Container(),
			ends: new PIXI.Container(),
			fieldPool: [],
			coverPool: [],
			rowFrames: new Map(),
			forestSprite: null,
			built: new Set(),
			alpha,
		};
		for (const name of PARTS) {
			s[name].eventMode = 'none';
			s[name].alpha = alpha;
			s[name].label = `scene:${preset.name}:${name}`;
			this[name].addChild(s[name]);
		}
		this.buildPieces(s);
		return s;
	}

	/** the skin's fixed pieces (picture, tunnels, bands, ends), each added once its texture is in */
	private buildPieces(s: Skin) {
		const P = s.preset;
		const A = SCENE_ART[P.kit];
		// (a left piece goes under its right twin whatever order they came in: index 0)
		const piece = (parent: PIXI.Container, key: string, p: readonly number[], first = false) => {
			if (s.built.has(key)) return;
			const t = this.tex(key);
			if (!t) return;
			s.built.add(key);
			const sp = new PIXI.Sprite(t);
			sp.eventMode = 'none';
			sp.position.set(p[0], p[1]);
			sp.width = p[2];
			sp.height = p[3];
			if (first) parent.addChildAt(sp, 0);
			else parent.addChild(sp);
		};
		piece(s.picture, P.picture.road, [0, 0, IMG.width, IMG.height]);
		const L = ROAD_ART.covers.left;
		const R = ROAD_ART.covers.right;
		piece(s.tunnels, P.picture.tunnelLeft, [L.x, L.y, L.width, L.height], true);
		piece(s.tunnels, P.picture.tunnelRight, [R.x, R.y, R.width, R.height]);
		if (P.bands) {
			piece(s.bands, P.bands.top, A.bandTop.road);
			piece(s.bands, P.bands.bottom, A.bandBottom.road);
		}
		if (P.ends) {
			piece(s.ends, P.ends.left, A.endLeft.road, true);
			piece(s.ends, P.ends.right, A.endRight.road);
		}
	}

	private layoutSkin(s: Skin, view: SceneView, top: boolean) {
		this.buildPieces(s);
		const P = s.preset;
		const fieldTex = this.tex(P.field);
		const r = view.rect;
		// THE FIELD: whole tiles on the tile's own period, from the tile at or before the screen's top left
		let n = 0;
		if (fieldTex) {
			const i0 = Math.floor(r.left / TILE.width);
			const j0 = Math.floor(r.top / TILE.height);
			for (let j = j0; j * TILE.height < r.bottom; j++) {
				for (let i = i0; i * TILE.width < r.right; i++) {
					const sp = this.sprite(s.fieldPool, s.field, n++);
					sp.texture = fieldTex;
					sp.position.set(i * TILE.width, j * TILE.height);
					sp.width = TILE.width;
					sp.height = TILE.height;
				}
			}
		}
		for (let k = n; k < s.fieldPool.length; k++) s.fieldPool[k].visible = false;

		// THE COVER beside the picture: the same tiles over the traffic, from just under the reindeer's feet line down
		let m = 0;
		if (fieldTex) {
			const coverTop = view.feetY + SCENE.edgeCoverBelowFeet;
			const j0 = Math.floor(coverTop / TILE.height);
			for (const side of [-1, 1] as const) {
				const iFrom = side < 0 ? Math.floor(r.left / TILE.width) : Math.floor(IMG.width / TILE.width);
				const iTo = side < 0 ? -1 : Math.floor((r.right - 1e-6) / TILE.width);
				// (half a road px of float noise at a picture that spans the screen exactly is no screen room)
				if (side < 0 && r.left >= -0.5) continue;
				if (side > 0 && r.right <= IMG.width + 0.5) continue;
				for (let j = j0; j * TILE.height < r.bottom; j++) {
					const y0 = Math.max(j * TILE.height, coverTop);
					const cut = y0 - j * TILE.height;
					for (let i = iFrom; i <= iTo; i++) {
						const sp = this.sprite(s.coverPool, s.cover, m++);
						sp.texture = cut > 0 ? this.rowFrame(s, fieldTex, cut) : fieldTex;
						sp.position.set(i * TILE.width, y0);
						sp.width = TILE.width;
						sp.height = TILE.height - cut;
					}
				}
			}
		}
		for (let k = m; k < s.coverPool.length; k++) s.coverPool[k].visible = false;

		// THE ENDS: on the layouts the preset names
		const ends = !!P.ends && P.ends.layouts.includes(view.kind);
		s.ends.visible = ends;

		// THE FOREST: an upright phone only
		const forestTex = P.forest && view.uprightPhone ? this.tex(P.forest) : null;
		let forest: SceneLayers['last']['forest'] = null;
		if (forestTex) {
			if (!s.forestSprite) {
				s.forestSprite = new PIXI.Sprite(forestTex);
				s.forestSprite.eventMode = 'none';
				s.forest.addChild(s.forestSprite);
			}
			s.forestSprite.texture = forestTex;
			forest = forestBox(r);
			s.forestSprite.position.set(forest.x, forest.y);
			s.forestSprite.width = forest.width;
			s.forestSprite.height = forest.height;
			s.forest.visible = true;
		} else s.forest.visible = false;

		if (top) {
			this.last.fieldSprites = n;
			this.last.coverSprites = m;
			this.last.ends = ends;
			this.last.forest = forest;
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
	private rowFrame(s: Skin, tex: PIXI.Texture, cut: number): PIXI.Texture {
		const key = cut.toFixed(2);
		let t = s.rowFrames.get(key);
		if (!t || t.source !== tex.source) {
			const k = tex.source.height / TILE.height;
			t = new PIXI.Texture({ source: tex.source, frame: new PIXI.Rectangle(0, cut * k, tex.source.width, (TILE.height - cut) * k) });
			s.rowFrames.set(key, t);
		}
		return t;
	}

	/** a skin leaves: hidden now, its containers and sub-frames destroyed two frames later (a texture destroyed in the
	 *  frame it was last batched takes the render loop down: the column sheets' rule, game/road/columnClips.ts) */
	private retire(s: Skin) {
		for (const name of PARTS) s[name].visible = false;
		const go = () => {
			for (const name of PARTS) if (!s[name].destroyed) s[name].destroy({ children: true });
			for (const t of s.rowFrames.values()) t.destroy();
			s.rowFrames.clear();
		};
		if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(go));
		else go();
	}

	destroy() {
		for (const s of this.skins.splice(0)) {
			for (const t of s.rowFrames.values()) t.destroy();
			s.rowFrames.clear();
		}
		for (const name of PARTS) this[name].destroy({ children: true });
	}
}
