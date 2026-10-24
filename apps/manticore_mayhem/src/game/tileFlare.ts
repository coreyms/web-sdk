import * as PIXI from 'pixi.js';
import { TILE_FLARE } from './constants';
import { stagingFlare } from './staging';
import { eventEmitter } from './eventEmitter';

// THE TILE MILESTONE FLARE (constants TILE_FLARE, Corey 2026-10-23; OFF by default, `?flare=1` on staging / dev).
// stateGame's plate pump calls cueTileFlare as a tile's count-over lands on x64 or x128; BoardCells takes the queue
// each frame, starts a pooled flare over the tile (createFlarePool below) and pops the tile's own number above the frame.
// The ring sound goes out from here, once per step (the book event whose tiles reached the milestone: stateGame's run id)
// at the strongest level that step reaches. With the switch off, cueTileFlare is never called and nothing is built.
//
// THE ATLAS: one 768 x 576 canvas of white, alpha-shaped frames (the mockup's textures, 192 px grid), tinted per layer
// and drawn additive. Made once, the first time the pool is built. No filter, no shader, no mask, no blob: URL.

/** the switch as this page has it: TILE_FLARE.enabled, or the staging / dev `?flare=` */
export const tileFlareOn: boolean = stagingFlare ?? TILE_FLARE.enabled;

/** the milestones the flare answers (64 and 128 today) */
export const isFlareMilestone = (v: number): boolean => !!TILE_FLARE.milestones[v];

export type FlareCue = { cell: number; value: number; step: number; rate: number; t0: number };
const queue: FlareCue[] = [];
let lastRingStep = -1;

/** DEV / probe (window.__manticore.tileFlare): what was cued and rung, and the pool's own counts (set by BoardCells) */
export const tileFlareStats = {
	on: tileFlareOn,
	cues: 0,
	rings: 0,
	log: [] as { t: number; cell: number; value: number; step: number; ring: number }[],
	pool: { built: false, size: 0, sprites: 0, alive: 0, peak: 0, spawned: 0, stolen: 0, pops: 0, popsCut: 0 },
};

/** a tile's count-over has landed on a milestone (stateGame's plate pump; never on a skip). `stepMax` is the highest
 *  milestone this step reaches, this tile's or one still counting over: the step's one ring is at that level. */
export const cueTileFlare = (cell: number, value: number, step: number, rate: number, stepMax: number) => {
	if (!tileFlareOn || !isFlareMilestone(value)) return;
	queue.push({ cell, value, step, rate, t0: performance.now() });
	if (queue.length > TILE_FLARE.pool * 2) queue.splice(0, queue.length - TILE_FLARE.pool * 2);
	tileFlareStats.cues += 1;
	let ring = 0;
	if (step !== lastRingStep) {
		lastRingStep = step;
		ring = TILE_FLARE.milestones[Math.max(value, stepMax)]?.ring ?? TILE_FLARE.milestones[value].ring;
		if (ring > 0) {
			eventEmitter.broadcast({ type: 'soundOnce', name: TILE_FLARE.ringSound, forcePlay: true, volume: ring });
			tileFlareStats.rings += 1;
		}
	}
	if (import.meta.env.DEV) {
		tileFlareStats.log.push({ t: performance.now(), cell, value, step, ring });
		if (tileFlareStats.log.length > 400) tileFlareStats.log.splice(0, 200);
	}
};

/** BoardCells, once a frame: every cue since the last frame (the same array, emptied; no allocation when empty) */
export const takeFlareCues = (): FlareCue[] => (queue.length ? queue.splice(0, queue.length) : queue);

// ---- the atlas -----------------------------------------------------------------------------------------------------
const G = 192;
const RAY_FRAMES = 8;
type Atlas = { rays: PIXI.Texture[]; bloom: PIXI.Texture; ring: PIXI.Texture; core: PIXI.Texture; edge: PIXI.Texture; spark: PIXI.Texture };
let atlas: Atlas | null = null;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
const easeOutQuad = (x: number) => 1 - (1 - x) * (1 - x);

const flareAtlas = (): Atlas => {
	if (atlas) return atlas;
	const W = 4 * G;
	const H = 3 * G;
	const c = document.createElement('canvas');
	c.width = W;
	c.height = H;
	const g = c.getContext('2d')!;
	// per pixel frames (ImageData written into its own square)
	const pixels = (x0: number, y0: number, S: number, alpha: (u: number, v: number) => number) => {
		const d = g.createImageData(S, S);
		for (let y = 0; y < S; y += 1) {
			for (let x = 0; x < S; x += 1) {
				const k = (y * S + x) * 4;
				d.data[k] = d.data[k + 1] = d.data[k + 2] = 255;
				d.data[k + 3] = Math.round(255 * clamp01(alpha(x + 0.5, y + 0.5)));
			}
		}
		g.putImageData(d, x0, y0);
	};
	// RAYS: 8 frames of 12 rays growing out and thinning (the mockup's burst sheet), frames 0-3 on row 0, 4-7 on row 1
	const RAYS = 12;
	for (let f = 0; f < RAY_FRAMES; f += 1) {
		const fx = (f % 4) * G;
		const fy = Math.floor(f / 4) * G;
		const p = (f + 0.5) / RAY_FRAMES;
		const ox = fx + G / 2;
		const oy = fy + G / 2;
		g.save();
		g.beginPath();
		g.rect(fx + 1, fy + 1, G - 2, G - 2);
		g.clip();
		for (let k = 0; k < RAYS; k += 1) {
			const ang = (k / RAYS) * Math.PI * 2 + (k % 2 ? 0.13 : 0);
			const L = (G / 2 - 3) * (k % 2 ? 0.62 : 1) * (0.3 + 0.7 * easeOutCubic(p));
			const half = (k % 2 ? 0.055 : 0.085) * (1 - 0.5 * p);
			const rg = g.createRadialGradient(ox, oy, 0, ox, oy, L);
			const a = 1 - 0.4 * p;
			rg.addColorStop(0, `rgba(255,255,255,${a})`);
			rg.addColorStop(0.5, `rgba(255,255,255,${a * 0.7})`);
			rg.addColorStop(1, 'rgba(255,255,255,0)');
			g.fillStyle = rg;
			g.beginPath();
			g.moveTo(ox, oy);
			g.lineTo(ox + Math.cos(ang - half) * L, oy + Math.sin(ang - half) * L);
			g.lineTo(ox + Math.cos(ang) * L * 1.02, oy + Math.sin(ang) * L * 1.02);
			g.lineTo(ox + Math.cos(ang + half) * L, oy + Math.sin(ang + half) * L);
			g.closePath();
			g.fill();
		}
		g.restore();
	}
	// BLOOM: soft disc, alpha (1 - r)^2.2, at (0, 2G)
	pixels(0, 2 * G, G, (x, y) => {
		const r = Math.hypot(x - G / 2, y - G / 2) / (G / 2);
		return r >= 1 ? 0 : (1 - r) ** 2.2;
	});
	// RING: a thin bright band at 0.88 of the radius with a faint inner haze, at (G, 2G)
	pixels(G, 2 * G, G, (x, y) => {
		const r = Math.hypot(x - G / 2, y - G / 2) / (G / 2);
		const band = Math.exp(-(((r - 0.88) / 0.05) ** 2));
		const haze = r < 0.88 ? 0.18 * (r / 0.88) ** 3 : 0;
		return r >= 0.995 ? 0 : band + haze;
	});
	// CORE: small hot disc (half size), at (2G, 2G)
	const C = G / 2;
	pixels(2 * G, 2 * G, C, (x, y) => {
		const r = Math.hypot(x - C / 2, y - C / 2) / (C / 2);
		if (r >= 1) return 0;
		return r < 0.25 ? 1 - 0.3 * (r / 0.25) : 0.7 * (1 - (r - 0.25) / 0.75);
	});
	// EDGE: the cell square bright at its edge, clear in the middle (the tile's own inner glow recipe, power 3.2), 92 px,
	// 2 px clear of its neighbours (it is bright AT its border, so it must not bleed into the ring or the core)
	const E = C - 4;
	pixels(2 * G + 2, 2 * G + C + 2, E, (x, y) => {
		const e = Math.min(x, y, E - x, E - y) / (E / 2);
		return (1 - e) ** 3.2;
	});
	// SPARK: a small four point glint, 64 px, at (2G + C + 2, 2G)
	const S = 64;
	pixels(2 * G + C + 2, 2 * G, S, (x, y) => {
		const dx = Math.abs(x - S / 2) / (S / 2);
		const dy = Math.abs(y - S / 2) / (S / 2);
		const star = Math.max(Math.exp(-dx * 22) * (1 - dy), Math.exp(-dy * 22) * (1 - dx));
		const dot = Math.exp(-(dx * dx + dy * dy) * 30);
		return star ** 1.2 + dot;
	});
	const base = PIXI.Texture.from(c);
	const sub = (x: number, y: number, w: number, h: number) => new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(x, y, w, h) });
	atlas = {
		rays: Array.from({ length: RAY_FRAMES }, (_, f) => sub((f % 4) * G, Math.floor(f / 4) * G, G, G)),
		bloom: sub(0, 2 * G, G, G),
		ring: sub(G, 2 * G, G, G),
		core: sub(2 * G, 2 * G, C, C),
		edge: sub(2 * G + 2, 2 * G + C + 2, E, E),
		spark: sub(2 * G + C + 2, 2 * G, S, S),
	};
	return atlas;
};

// ---- the pool ------------------------------------------------------------------------------------------------------
type Flare = {
	root: PIXI.Container;
	edge: PIXI.Sprite;
	bloom: PIXI.Sprite;
	core: PIXI.Sprite;
	rays: PIXI.Sprite;
	ring: PIXI.Sprite;
	sparks: PIXI.Sprite[];
	live: boolean;
	t0: number;
	rate: number;
	ms: number;
	ringA: number;
	/** the cell's box (board px) and its mean side */
	bw: number;
	bh: number;
	cs: number;
	R: number;
	frame: number;
};

/** the flare layer's pool: TILE_FLARE.pool flares (a whole board), every sprite made here once. `layer` goes into the
 *  board container over the frame, under the symbols. */
export const createFlarePool = () => {
	const A = flareAtlas();
	const P = TILE_FLARE.palette;
	const layer = new PIXI.Container({ label: 'tile-flare', visible: false });
	const fx = new PIXI.Container({ label: 'tile-flare-fx' });
	/** the popped numbers (BoardCells moves a tile's number row in here for its pop, over the flare) */
	const nums = new PIXI.Container({ label: 'tile-flare-nums' });
	layer.addChild(fx, nums);
	const sprite = (tex: PIXI.Texture, tint: number) => {
		const s = new PIXI.Sprite(tex);
		s.anchor.set(0.5);
		s.blendMode = 'add';
		s.tint = tint;
		s.visible = false;
		return s;
	};
	const pool: Flare[] = [];
	for (let i = 0; i < TILE_FLARE.pool; i += 1) {
		const root = new PIXI.Container({ visible: false });
		const f: Flare = {
			root,
			edge: sprite(A.edge, P.edge),
			bloom: sprite(A.bloom, P.bloom),
			core: sprite(A.core, P.core),
			rays: sprite(A.rays[0], P.rays),
			ring: sprite(A.ring, P.ring),
			sparks: Array.from({ length: TILE_FLARE.sparks }, () => sprite(A.spark, P.spark)),
			live: false,
			t0: 0,
			rate: 1,
			ms: 1,
			ringA: 0,
			bw: 1,
			bh: 1,
			cs: 1,
			R: 1,
			frame: 0,
		};
		root.addChild(f.edge, f.bloom, f.core, f.rays, f.ring, ...f.sparks);
		fx.addChild(root);
		pool.push(f);
	}
	const st = tileFlareStats.pool;
	st.built = true;
	st.size = pool.length;
	st.sprites = pool.length * (5 + TILE_FLARE.sparks);
	let alive = 0;
	const EDGE_W = A.edge.width;
	const RAYS_W = A.rays[0].width;
	const sz = (s: PIXI.Sprite, texW: number, w: number, h: number = w) => s.scale.set(w / texW, h / texW);
	const put = (s: PIXI.Sprite, a: number) => {
		const on = a > 0.002;
		if (s.visible !== on) s.visible = on;
		if (on) s.alpha = a > 1 ? 1 : a;
		return on;
	};

	/** start a flare on a cell: centre (board px), the cell's box, the milestone, the turbo scale; a full pool takes
	 *  over the oldest flare (never grows) */
	const spawn = (cx: number, cy: number, bw: number, bh: number, value: number, rate: number, now: number) => {
		const m = TILE_FLARE.milestones[value];
		if (!m) return;
		let f = pool.find((q) => !q.live);
		if (!f) {
			f = pool.reduce((a, b) => (b.t0 < a.t0 ? b : a));
			st.stolen += 1;
		} else alive += 1;
		f.live = true;
		f.t0 = now;
		f.rate = Math.max(0.2, rate);
		f.ms = Math.max(1, m.ms);
		f.ringA = m.ring;
		f.bw = bw;
		f.bh = bh;
		f.cs = (bw + bh) / 2;
		f.R = f.cs * m.size;
		f.frame = -1;
		f.root.position.set(cx, cy);
		f.root.visible = true;
		st.spawned += 1;
		st.alive = alive;
		if (alive > st.peak) st.peak = alive;
		if (!layer.visible) layer.visible = true;
	};

	const end = (f: Flare) => {
		f.live = false;
		f.root.visible = false;
		alive -= 1;
		st.alive = alive;
	};

	/** advance every live flare (the mockup's curves, t in style ms); hides the layer when nothing is left */
	const tick = (now: number) => {
		if (!alive && !nums.children.length) {
			if (layer.visible) layer.visible = false;
			return;
		}
		for (const f of pool) {
			if (!f.live) continue;
			const t = (now - f.t0) * f.rate;
			const dur = f.ms;
			if (t > dur * 1.2) {
				end(f);
				continue;
			}
			const { cs, R } = f;
			// the cell's own edge lights first
			const eA = t < 50 ? t / 50 : 1 - clamp01((t - 50) / (dur * 0.55));
			if (put(f.edge, 0.95 * Math.max(0, eA) ** 1.3)) f.edge.scale.set((f.bw * 1.02) / EDGE_W, (f.bh * 1.02) / EDGE_W);
			// bloom and core
			const bA = (t < 40 ? t / 40 : 1) * (1 - clamp01(t / dur)) ** 1.6;
			if (put(f.bloom, bA)) sz(f.bloom, G, R * (0.85 + 0.45 * easeOutQuad(clamp01(t / (dur * 0.5)))));
			if (put(f.core, 0.7 * bA)) sz(f.core, G / 2, cs * 0.9 * (0.8 + 0.4 * bA));
			// the ray sheet, by frame index, turning a little
			const bu = t / (dur * 0.85);
			const rA = bu < 1 ? (t < 30 ? t / 30 : 1) * (bu < 0.6 ? 1 : 1 - (bu - 0.6) / 0.4) : 0;
			if (put(f.rays, rA)) {
				const fi = Math.min(RAY_FRAMES - 1, Math.floor(bu * RAY_FRAMES));
				if (fi !== f.frame) {
					f.frame = fi;
					f.rays.texture = A.rays[fi];
				}
				sz(f.rays, RAYS_W, R * 1.55);
				f.rays.rotation = 0.18 * (t / dur);
			}
			// the ring (its brightness is the milestone's `ring`)
			const e = clamp01((t - 30) / (dur * 0.95));
			if (put(f.ring, f.ringA > 0 && t > 30 ? f.ringA * (1 - e) ** 1.6 * clamp01((t - 30) / 60) : 0)) sz(f.ring, G, R * (0.42 + easeOutCubic(e)));
			// the sparks
			const se = clamp01(t / (dur * 1.1));
			const sA = se < 1 ? (1 - se) ** 1.3 * clamp01(t / 40) : 0;
			for (let k = 0; k < f.sparks.length; k += 1) {
				const s = f.sparks[k];
				if (!put(s, sA)) continue;
				const ang = (k / f.sparks.length) * Math.PI * 2 + 0.39 + (k % 2) * 0.2;
				const d = R * (k % 2 ? 0.3 : 0.4) * (0.35 + 0.65 * easeOutQuad(se));
				s.position.set(Math.cos(ang) * d, Math.sin(ang) * d);
				sz(s, 64, cs * (k % 2 ? 0.26 : 0.36) * (1 - 0.55 * se));
			}
		}
	};

	/** end every flare now (a skip, a reset) */
	const clear = () => {
		for (const f of pool) if (f.live) end(f);
	};

	const destroy = () => {
		layer.destroy({ children: true });
		st.built = false;
	};

	/** DEV / probe: the texture sources and frames the pool's sprites can draw (one atlas: 1 source, 13 frames) */
	const textureUse = () => {
		const all = [A.bloom, A.ring, A.core, A.edge, A.spark, ...A.rays];
		for (const f of pool) for (const s of [f.edge, f.bloom, f.core, f.rays, f.ring, ...f.sparks]) all.push(s.texture);
		return { sources: new Set(all.map((t) => t.source.uid)).size, textures: new Set(all).size };
	};

	return { layer, nums, spawn, tick, clear, destroy, textureUse, alive: () => alive };
};
export type FlarePool = ReturnType<typeof createFlarePool>;
