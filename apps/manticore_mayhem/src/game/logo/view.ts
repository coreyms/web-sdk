// THE CANVAS LOGO'S SCENE: raw Pixi in one container (the desktop tier's landscape master only; everywhere
// else the logo is the chrome's <img>). Back to front, the json's own order:
//   drop                the HTML logo's CSS drop shadow, baked (no filters in the canvas)
//   wing_L, wing_R      MeshSimple, vertices rewritten from the tracks (game/logo/motion.ts)
//   shadow, letters     sprites; the letters never move
//   glint slices        additive sprites, white + alpha tinted gold / red, lit by a sweep
//
// WHAT RUNS WHEN (the component decides `rest`; every number is constants LOGO, real time):
//   entrance   once: the letters scale in and fade up, each wing turns and grows out from behind MANTICORE
//              (the mesh's own transform, so it costs no vertex work), then a glint. The idle starts with it.
//   idle       the breathing advances ONLY while the board is at rest; otherwise the current frame is held and
//              no vertex is written. One glint per breath, only at rest.
//   flare      22 frames added to whatever the idle shows, with its own glint.
// The vertices are rewritten at most every LOGO.vertexIntervalMs (30 a second) into the arrays the meshes
// already own: nothing is allocated per frame, and no texture is ever created or uploaded after build().
import * as PIXI from 'pixi.js';

import type { LogoData, LogoJson } from './data';
import { LogoMotion } from './motion';

type Textures = Record<string, PIXI.Texture>;
type Sweep = { frames: number; peak: number };
type GlintSpec = { atFrame: number; gold: Sweep; red: Sweep & { delayFrames: number } };

export type LogoTiming = {
	vertexIntervalMs: number;
	vertexSlackMs: number;
	entranceDelayMs: number;
	entranceGlint: GlintSpec;
	idleGlint: GlintSpec;
	flareGlint: GlintSpec;
	flareMinGapMs: number;
	fadeMs: number;
	takeoverBlendMs: number;
};

type Placed = { sprite: PIXI.Sprite; x: number; y: number; k: number; track: { pivot: [number, number]; scale: number[]; alpha: number[] } };

const rgbInt = (c: readonly number[]) => (c[0] << 16) | (c[1] << 8) | c[2];
/** a 30 fps track at a fractional frame */
const at = (track: number[], f: number): number => {
	const last = track.length - 1;
	if (f >= last) return track[last];
	const a = Math.floor(f);
	return track[a] + (track[a + 1] - track[a]) * (f - a);
};

export class LogoView {
	readonly root = new PIXI.Container();
	ready = false;
	json!: LogoJson;

	private readonly timing: LogoTiming;
	private motion!: LogoMotion;
	private meshes: PIXI.MeshSimple[] = [];
	private verts: Float32Array[] = [];
	private buffers: PIXI.Buffer[] = [];
	private placed: Placed[] = [];
	/** per colour (0 gold, 1 red): the slices, their place on the sweep and the band's half width */
	private slices: PIXI.Sprite[][] = [[], []];
	private sliceS: number[][] = [[], []];
	private halfWidth = [0, 0];
	/** per colour: when the sweep starts (ms, -1 = none), how long it runs and its peak */
	private sweepStart = new Float64Array([-1, -1]);
	private sweepMs = new Float64Array(2);
	private sweepPeak = new Float64Array(2);

	private idleFrame = 0;
	private settle = 1;
	private entranceAt = -1;
	private flareAt = -1;
	private lastFlareAt = -1e9;
	private lastVertexAt = -1e9;
	private dirty = true;
	private alpha = 0;
	private alphaTarget = 0;
	private scale = 1;

	// DEV / probe counters
	entrances = 0;
	flares = 0;
	idleGlints = 0;
	vertexWrites = 0;

	constructor(timing: LogoTiming) {
		this.timing = timing;
		this.root.label = 'logo';
		this.root.visible = false;
		this.root.alpha = 0;
		this.root.eventMode = 'none';
		this.root.interactiveChildren = false;
	}

	/** build the scene once the data and the atlas are in (called once) */
	build(data: LogoData, atlas: Textures): void {
		if (this.ready) return;
		const json = (this.json = data.json);
		const tex = (frame: string) => atlas[frame] ?? PIXI.Texture.EMPTY;
		const sprite = (name: string) => {
			const s = new PIXI.Sprite(tex(`logo_${name}`));
			const r = json.sprites[name];
			const k = r[2] / Math.max(s.texture.width, 1);
			s.scale.set(k);
			s.position.set(r[0], r[1]);
			return { s, x: r[0], y: r[1], k };
		};
		this.motion = new LogoMotion(data);

		// the drop shadow is the whole silhouette's, wings included, so in the entrance it grows and fades in with
		// the wings (their scale and alpha, about the point midway between their two pivots)
		const drop = sprite('drop');
		const [wl, wr] = data.wings.map((W) => W.entrance);
		const mid: [number, number] = [(wl.pivot[0] + wr.pivot[0]) / 2, (wl.pivot[1] + wr.pivot[1]) / 2];
		this.placed.push({ sprite: drop.s, x: drop.x, y: drop.y, k: drop.k, track: { pivot: mid, scale: wl.rho, alpha: wl.alpha } });
		this.root.addChild(drop.s);

		data.wings.forEach((W, i) => {
			const mesh = new PIXI.MeshSimple({ texture: tex(W.frame), vertices: new Float32Array(W.nv * 2), uvs: W.uvs, indices: W.indices });
			mesh.autoUpdate = false; // the tick rewrites the vertices and flags the buffer itself
			// the entrance turns and scales the whole wing about its own pivot: the mesh's transform
			mesh.pivot.set(W.entrance.pivot[0], W.entrance.pivot[1]);
			mesh.position.set(W.entrance.pivot[0], W.entrance.pivot[1]);
			this.meshes[i] = mesh;
			this.verts[i] = mesh.vertices as Float32Array;
			this.buffers[i] = mesh.geometry.getBuffer('aPosition');
			this.root.addChild(mesh);
		});
		for (const L of data.statics) {
			const p = sprite(L.name);
			this.placed.push({ sprite: p.s, x: p.x, y: p.y, k: p.k, track: L.entrance });
			this.root.addChild(p.s);
		}
		([json.glint.gold, json.glint.red] as const).forEach((G, c) => {
			this.halfWidth[c] = G.halfWidth;
			for (const sl of G.slices) {
				const p = sprite(sl.sprite);
				p.s.blendMode = 'add';
				p.s.tint = rgbInt(G.tint);
				p.s.visible = false;
				this.slices[c].push(p.s);
				this.sliceS[c].push(sl.s);
				this.root.addChild(p.s);
			}
		});
		this.ready = true;
		this.write(-1);
	}

	/** the atlas's source (mip chain, pre-upload) */
	source(atlas: Textures): PIXI.TextureSource | undefined {
		return atlas.logo_letters?.source;
	}

	/** the frame's origin in canvas px and canvas px per ship px */
	place(x: number, y: number, scale: number): void {
		this.root.position.set(x, y);
		this.root.scale.set(scale);
		this.scale = scale;
	}

	/** fade in / out with the HUD's kept elements; `instant` = no fade */
	show(on: boolean, instant = false): void {
		this.alphaTarget = on ? 1 : 0;
		if (!instant) return;
		this.alpha = this.alphaTarget;
		this.root.alpha = this.alpha;
		this.root.visible = this.alpha > 0;
	}

	get shown(): boolean {
		return this.alphaTarget > 0;
	}

	/** the entrance, from LOGO.entranceDelayMs after `now`; the idle restarts from frame 0 with it */
	startEntrance(now: number): void {
		const T = this.timing;
		this.entranceAt = now + T.entranceDelayMs;
		this.flareAt = -1;
		this.settle = 1;
		this.idleFrame = 0;
		this.applyEntrance(0);
		this.glint(this.entranceAt + (T.entranceGlint.atFrame * 1000) / this.motion.fps, T.entranceGlint);
		this.dirty = true;
	}

	/** no entrance (the data came in after the game showed): start on the still's own pose and ease into the idle */
	takeOver(): void {
		this.settle = 0;
		this.idleFrame = 0;
		this.dirty = true;
	}

	/** one flare, unless the entrance or a flare is running or the last one started under flareMinGapMs ago */
	flare(now: number): boolean {
		const T = this.timing;
		if (!this.ready || !this.shown || this.entranceAt >= 0 || this.flareAt >= 0 || now - this.lastFlareAt < T.flareMinGapMs) return false;
		this.flareAt = now;
		this.lastFlareAt = now;
		this.flares += 1;
		this.glint(now + (T.flareGlint.atFrame * 1000) / this.motion.fps, T.flareGlint);
		return true;
	}

	private glint(start: number, spec: GlintSpec): void {
		const ms = 1000 / this.motion.fps;
		this.sweepStart[0] = start;
		this.sweepMs[0] = spec.gold.frames * ms;
		this.sweepPeak[0] = spec.gold.peak;
		this.sweepStart[1] = start + spec.red.delayFrames * ms;
		this.sweepMs[1] = spec.red.frames * ms;
		this.sweepPeak[1] = spec.red.peak;
	}

	/** the entrance at frame e (fractional); a negative e = over, everything on its own place */
	private applyEntrance(e: number): void {
		const wings = this.motion.wings;
		for (let i = 0; i < this.meshes.length; i += 1) {
			const E = wings[i].entrance;
			const mesh = this.meshes[i];
			mesh.rotation = e < 0 ? 0 : at(E.theta, e);
			mesh.scale.set(e < 0 ? 1 : at(E.rho, e));
			mesh.alpha = e < 0 ? 1 : at(E.alpha, e);
		}
		for (const P of this.placed) {
			const sc = e < 0 ? 1 : at(P.track.scale, e);
			const px = P.track.pivot[0];
			const py = P.track.pivot[1];
			P.sprite.position.set(px + sc * (P.x - px), py + sc * (P.y - py));
			P.sprite.scale.set(P.k * sc);
			P.sprite.alpha = e < 0 ? 1 : at(P.track.alpha, e);
		}
	}

	/** rewrite both wings' vertices for the current idle frame and the flare's frame g (negative = none) */
	private write(g: number): void {
		for (let i = 0; i < this.verts.length; i += 1) {
			this.motion.evaluate(i, this.idleFrame, this.settle, g, this.verts[i]);
			this.buffers[i].update();
		}
		this.vertexWrites += 1;
		this.dirty = false;
	}

	/**
	 * One frame. `now` and `dtMs` are the ticker's; `rest` = the board is at rest and the logo may breathe.
	 * Returns false when there is nothing left to animate (the caller takes the ticker callback off).
	 */
	tick(now: number, dtMs: number, rest: boolean): boolean {
		if (!this.ready) return false;
		const T = this.timing;
		const M = this.motion;
		if (this.alpha !== this.alphaTarget) {
			const step = dtMs / T.fadeMs;
			this.alpha = this.alphaTarget > this.alpha ? Math.min(this.alphaTarget, this.alpha + step) : Math.max(this.alphaTarget, this.alpha - step);
			this.root.alpha = this.alpha;
			this.root.visible = this.alpha > 0;
		}
		const fading = this.alpha !== this.alphaTarget;
		if (this.alpha === 0 && !fading) return false;

		let moving = false;
		let entering = this.entranceAt >= 0;
		if (entering) {
			const e = ((now - this.entranceAt) * M.fps) / 1000;
			if (e >= this.json.motion.entranceFrames - 1) {
				this.applyEntrance(-1);
				this.entranceAt = -1;
				this.entrances += 1;
				this.dirty = true;
				entering = false;
			} else {
				const f = e < 0 ? 0 : e;
				this.applyEntrance(f);
				this.idleFrame = f;
				moving = true;
			}
		}
		if (!entering && rest) {
			const before = this.idleFrame;
			let next = before + (dtMs * M.fps) / 1000;
			const glintAt = T.idleGlint.atFrame;
			// one glint per breath, as the idle passes its frame, unless a sweep is still running
			if (before < glintAt && next >= glintAt && this.sweepStart[0] < 0 && this.sweepStart[1] < 0) {
				this.glint(now, T.idleGlint);
				this.idleGlints += 1;
			}
			if (next >= M.idleFrames) next -= M.idleFrames;
			this.idleFrame = next;
			if (this.settle < 1) this.settle = Math.min(1, this.settle + dtMs / T.takeoverBlendMs);
			moving = true;
		}
		let g = -1;
		if (this.flareAt >= 0) {
			g = ((now - this.flareAt) * M.fps) / 1000;
			if (g >= M.flareFrames - 1) {
				this.flareAt = -1;
				this.dirty = true;
				g = -1;
			} else moving = true;
		}
		if (this.dirty || (moving && now - this.lastVertexAt >= T.vertexIntervalMs - T.vertexSlackMs)) {
			this.write(g);
			this.lastVertexAt = now;
		}

		let sweeping = false;
		for (let c = 0; c < 2; c += 1) {
			const start = this.sweepStart[c];
			if (start < 0) continue;
			const tau = (now - start) / this.sweepMs[c];
			const list = this.slices[c];
			if (tau > 1) {
				this.sweepStart[c] = -1;
				for (let i = 0; i < list.length; i += 1) list[i].visible = false;
				continue;
			}
			sweeping = true;
			if (tau < 0) continue;
			const hw = this.halfWidth[c];
			const centre = -hw + (1 + 2 * hw) * tau;
			const s = this.sliceS[c];
			for (let i = 0; i < list.length; i += 1) {
				const u = (s[i] - centre) / hw;
				if (u <= -1 || u >= 1) {
					list[i].visible = false;
					continue;
				}
				const cos = Math.cos((Math.PI / 2) * u);
				list[i].visible = true;
				list[i].alpha = this.sweepPeak[c] * cos * cos;
			}
		}
		return entering || rest || this.flareAt >= 0 || sweeping || fading;
	}

	/** DEV: the vertices the motion gives for an idle frame, a settle weight and a flare frame (a fresh copy) */
	sample(idleFrame: number, settle: number, flareFrame: number): number[][] {
		return this.motion.wings.map((W, i) => {
			const out = new Float32Array(W.nv * 2);
			this.motion.evaluate(i, idleFrame, settle, flareFrame, out);
			return Array.from(out);
		});
	}

	/** DEV / probe: where the logo is and what it is doing */
	state() {
		const art = this.ready ? this.json.art : [0, 0, 0, 0];
		const k = this.scale;
		return {
			ready: this.ready,
			visible: this.root.visible,
			alpha: Number(this.alpha.toFixed(3)),
			/** the art box in canvas px */
			art: { x: this.root.position.x + art[0] * k, y: this.root.position.y + art[1] * k, width: art[2] * k, height: art[3] * k },
			scale: k,
			idleFrame: Number(this.idleFrame.toFixed(3)),
			settle: Number(this.settle.toFixed(3)),
			entering: this.entranceAt >= 0,
			flaring: this.flareAt >= 0,
			sweeping: this.sweepStart[0] >= 0 || this.sweepStart[1] >= 0,
			litSlices: this.slices[0].filter((s) => s.visible).length + this.slices[1].filter((s) => s.visible).length,
			entrances: this.entrances,
			flares: this.flares,
			idleGlints: this.idleGlints,
			vertexWrites: this.vertexWrites,
			/** a sum over every wing vertex, ship px: a probe watches it advance at rest and hold while the board is busy */
			pose: this.ready ? Number(this.verts.reduce((n, v) => n + v.reduce((m, x) => m + x, 0), 0).toFixed(3)) : 0,
			children: this.root.children.length,
		};
	}
}
