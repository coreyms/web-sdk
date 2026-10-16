// THE BOARD WELLS AND THEIR REACTIVE VEINS (constants WELLS, WELLS_FX; Corey 2026-10-16 16:40, option D of the
// wells_r1 / r2 mockups; art: tools/build_board_wells.py).
//
// Two layers in the frame's plate slot (BoardFrame's `under`, with the board container's transform), built once:
//   wells  one sprite per cell from ui/board-wells.webp (four variants 2 x 2), on the cell's whole box (symbolPlace.ts
//          op.box: bar centre line to bar centre line), FIRST in the slot: over the black backing, under the tiles and
//          the frame (the lattice bars cover the texture's outer px). Each cell takes a variant and a turn from a fixed
//          table. Tinted by the scene's night / fire light and the win dim (one tint per sprite, written on change).
//   glow   one ADDITIVE sprite per cell from ui/board-wells-glow.webp (the same veins as light, greyscale, so its black
//          adds nothing), same variant and turn, LAST in the slot: over the tiles (a lit tile is nearly opaque, a glow
//          under it would never show), still under the frame and the symbols. Only alpha, tint and visibility move,
//          and only when they change; a sprite at 0 is not drawn.
// The light-ups come from cues the beats' own call sites push (game/wellsFx.ts). Each becomes one or more FLARES from
// a fixed pool of plain objects; a cue that waited too long is dropped (no backlog), and while skipping no cue is
// taken and the flares not yet started are dropped. The BOARD POWER (free spins) is read from the tiles each frame.
// Both atlases are mipmapped (game/mipmaps.ts) once, before their first draw: the desktop cell is ~99 CSS px, drawn
// from 256 px texels at the DPR 2 cap (~198 device px), smaller on other screens. No filter, no mask, no texture per
// frame, nothing allocated in the frame.
import * as PIXI from 'pixi.js';

import { CELL_COUNT, GRID, WELLS, WELLS_FX } from './constants';
import { PHONE_TIER } from './deviceTier';
import { enableMipmaps } from './mipmaps';
import { sceneLight } from './scene';
import { wellsFx, type WellsCue, type WellsCueKind } from './wellsFx';
import type { Openings } from './symbolPlace';

/** per cell (reel * 8 + row): the variant (0..3), the turn (0..7: bit 2 flips x, bits 0..1 quarter turns) and the
 *  power shimmer's phase. The same table the approved mockups were drawn with. */
const makeTable = () => {
	let s = WELLS.seed >>> 0;
	const rnd = () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const variant = new Uint8Array(CELL_COUNT);
	const turn = new Uint8Array(CELL_COUNT);
	for (let row = 0; row < GRID; row += 1) {
		for (let reel = 0; reel < GRID; reel += 1) {
			const i = reel * GRID + row;
			const left = reel > 0 ? variant[(reel - 1) * GRID + row] : -1;
			const up = row > 0 ? variant[i - 1] : -1;
			let v = Math.floor(rnd() * WELLS.variants);
			while (v === left || v === up) v = (v + 1) % WELLS.variants;
			variant[i] = v;
			turn[i] = Math.floor(rnd() * 8);
		}
	}
	const phase = new Float32Array(CELL_COUNT);
	for (let i = 0; i < CELL_COUNT; i += 1) phase[i] = rnd() * Math.PI * 2;
	return { variant, turn, phase };
};

/** what BoardCells hands the wells once a frame (plain reads, nothing tracked) */
export type WellsFrame = {
	/** the loaded textures (boardWells, boardWellsGlow) */
	tex: Record<string, PIXI.Texture> | undefined;
	tiles: { value: number }[];
	/** per cell the dim of the symbol on it (1 = none) */
	cover: Float32Array;
	skipping: boolean;
	freegame: boolean;
};

type Flare = {
	cell: number;
	t0: number;
	rate: number;
	peak: number;
	inMs: number;
	holdMs: number;
	outMs: number;
	tint: number;
	kind: WellsCueKind;
};

export type Wells = {
	/** into the frame's plate slot: the wells first, the glow last (call after the tiles' layer is in) */
	mount: (slot: PIXI.Container | null) => void;
	/** every well on its cell's box (a layout change) */
	place: (op: Openings) => void;
	/** once a frame: the textures (first time only), the light and the dim, the cues, the flares, the power */
	tick: (now: number, f: WellsFrame) => void;
	/** DEV: show or hide the wells (the black backing alone, to compare) */
	show: (on: boolean) => void;
	/** DEV: a flare by hand */
	flare: (cell: number, kind: WellsCueKind, delayMs?: number) => void;
	/** DEV: the flares asked for since the last read, and the tick's own cost */
	log: () => { kind: WellsCueKind; cell: number; at: number }[];
	cost: () => { mean: number; max: number; ticks: number; flares: number; peakFlares: number };
	state: () => unknown;
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export const createWells = (renderer: () => PIXI.Renderer | undefined): Wells => {
	const table = makeTable();
	const layer = new PIXI.Container({ label: 'wells', visible: false });
	const glowLayer = new PIXI.Container({ label: 'wells-glow', visible: false });
	const make = (into: PIXI.Container, add: boolean) =>
		Array.from({ length: CELL_COUNT }, () => {
			const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
			s.anchor.set(0.5);
			if (add) {
				s.blendMode = 'add';
				s.visible = false;
				s.alpha = 0;
			}
			into.addChild(s);
			return s;
		});
	const sprites = make(layer, false);
	const glows = make(glowLayer, true);
	const px = PHONE_TIER ? WELLS.cellPxPhone : WELLS.cellPx;
	let ready = false;
	let hasGlow = false;
	// DEV ?wells=off: the black backing alone, to compare
	let shown = !(
		import.meta.env.DEV &&
		typeof window !== 'undefined' &&
		new URLSearchParams(window.location.search).get('wells') === 'off'
	);
	let lastOp: Openings | null = null;
	const atlasPx = [0, 0];

	/** an atlas's four variants (built once, the first frame its texture is in) */
	const cut = (tex: PIXI.Texture) => {
		enableMipmaps(tex.source, renderer());
		return Array.from(
			{ length: WELLS.variants },
			(_, v) =>
				new PIXI.Texture({
					source: tex.source,
					frame: new PIXI.Rectangle((v % 2) * px, Math.floor(v / 2) * px, px, px),
				}),
		);
	};
	const take = (tex: Record<string, PIXI.Texture> | undefined) => {
		if (!ready && tex?.boardWells) {
			const v = cut(tex.boardWells);
			for (let i = 0; i < CELL_COUNT; i += 1) sprites[i].texture = v[table.variant[i]];
			atlasPx[0] = tex.boardWells.source.pixelWidth;
			ready = true;
			layer.visible = shown;
			if (lastOp) place(lastOp);
		}
		if (!hasGlow && tex?.boardWellsGlow) {
			const v = cut(tex.boardWellsGlow);
			for (let i = 0; i < CELL_COUNT; i += 1) glows[i].texture = v[table.variant[i]];
			atlasPx[1] = tex.boardWellsGlow.source.pixelWidth;
			hasGlow = true;
			glowLayer.visible = shown;
			if (lastOp) place(lastOp);
		}
	};

	const place = (op: Openings) => {
		lastOp = op;
		const b = op.box;
		for (let i = 0; i < CELL_COUNT; i += 1) {
			const k = i * 4;
			const w = b[k + 2] - b[k];
			const h = b[k + 3] - b[k + 1];
			const t = table.turn[i];
			const quarter = t & 3;
			const flip = t & 4 ? -1 : 1;
			// a quarter turn swaps which texture side lies along the box's width
			const odd = quarter % 2 === 1;
			const sx = (flip * (odd ? h : w)) / px;
			const sy = (odd ? w : h) / px;
			for (const s of [sprites[i], glows[i]]) {
				s.position.set((b[k] + b[k + 2]) / 2, (b[k + 1] + b[k + 3]) / 2);
				s.rotation = (quarter * Math.PI) / 2;
				s.scale.set(sx, sy);
			}
		}
	};

	// ---- the light and the dim on the wells: one tint per sprite, written when it moves a step ---------------------
	const shownTint = new Int32Array(CELL_COUNT).fill(0xffffff);
	const light = [1, 1, 1];
	const lightOf = () => {
		const L = sceneLight;
		const n = L.night;
		const f = L.fire * n;
		for (let c = 0; c < 3; c += 1) {
			const fore = c === 0 ? L.foreR : c === 1 ? L.foreG : L.foreB;
			light[c] = (1 + (WELLS_FX.night[c] - 1) * n) * fore * (1 + (WELLS_FX.fireWarm[c] - 1) * f);
		}
	};

	// ---- the flares: a fixed pool of plain objects -------------------------------------------------------------------
	const pool: Flare[] = Array.from({ length: WELLS_FX.pool }, () => ({
		cell: 0,
		t0: 0,
		rate: 1,
		peak: 0,
		inMs: 0,
		holdMs: 0,
		outMs: 0,
		tint: 0,
		kind: 'light' as WellsCueKind,
	}));
	const live: Flare[] = [];
	const free: Flare[] = pool.slice();
	let peakFlares = 0;
	const fxLog: { kind: WellsCueKind; cell: number; at: number }[] = [];
	const add = (cell: number, kind: WellsCueKind, at: number, rate: number, peakScale = 1) => {
		if (!hasGlow || cell < 0 || cell >= CELL_COUNT) return;
		const spec = WELLS_FX[kind];
		// the pool full: the oldest makes room
		let f = free.pop();
		if (!f) {
			let oldest = 0;
			for (let i = 1; i < live.length; i += 1) if (live[i].t0 < live[oldest].t0) oldest = i;
			f = live[oldest];
			live[oldest] = live[live.length - 1];
			live.length -= 1;
		}
		f.cell = cell;
		f.t0 = at;
		f.rate = rate;
		f.peak = spec.peak * peakScale;
		f.inMs = spec.inMs;
		f.holdMs = spec.holdMs;
		f.outMs = spec.outMs;
		f.tint = WELLS_FX.tint[kind];
		f.kind = kind;
		live.push(f);
		if (live.length > peakFlares) peakFlares = live.length;
		if (import.meta.env.DEV && fxLog.length < 2000) fxLog.push({ kind, cell, at: Math.round(at) });
	};
	/** a flare's strength at `now` (0 before it starts), or -1 once it is over */
	const level = (f: Flare, now: number) => {
		const el = (now - f.t0) * f.rate;
		if (el < 0) return 0;
		if (el < f.inMs) return f.peak * Math.sin((Math.PI / 2) * (el / f.inMs));
		const e2 = el - f.inMs - f.holdMs;
		if (e2 < 0) return f.peak;
		if (e2 >= f.outMs) return -1;
		return f.peak * Math.pow(1 - e2 / f.outMs, 1.6);
	};

	// ---- the cues -> flares ------------------------------------------------------------------------------------------
	const dist = new Int16Array(CELL_COUNT);
	const queue = new Int16Array(CELL_COUNT);
	const inSet = new Uint8Array(CELL_COUNT);
	const play = (c: WellsCue) => {
		if (c.kind === 'light' || c.kind === 'double') {
			add(c.cells[0], c.kind, c.at, c.rate);
			return;
		}
		if (c.kind === 'win') {
			// a ripple through the cluster from its first cell, breadth first over the cells that touch
			if (!c.cells.length) return;
			inSet.fill(0);
			for (const i of c.cells) if (i >= 0 && i < CELL_COUNT) inSet[i] = 1;
			let head = 0;
			let tail = 0;
			const origin = c.cells[0];
			queue[tail++] = origin;
			dist[origin] = 0;
			inSet[origin] = 2;
			while (head < tail) {
				const i = queue[head++];
				add(i, 'win', c.at + (dist[i] * WELLS_FX.win.stepMs) / c.rate, c.rate);
				const r = i % GRID;
				for (let n = 0; n < 4; n += 1) {
					const j =
						n === 0
							? r > 0
								? i - 1
								: -1
							: n === 1
								? r < GRID - 1
									? i + 1
									: -1
								: n === 2
									? i - GRID
									: i + GRID;
					if (j < 0 || j >= CELL_COUNT || inSet[j] !== 1) continue;
					inSet[j] = 2;
					dist[j] = dist[i] + 1;
					queue[tail++] = j;
				}
			}
			// a cluster that does not touch (never in the book, but never lost): the rest at the last ring's time
			for (const i of c.cells)
				if (inSet[i] === 1) add(i, 'win', c.at + (tail * WELLS_FX.win.stepMs) / c.rate, c.rate);
			return;
		}
		if (c.kind === 'swipe') {
			for (const row of c.rows)
				for (let reel = 0; reel < GRID; reel += 1)
					add(
						reel * GRID + row,
						'swipe',
						c.at + (((GRID - 1 - reel) / (GRID - 1)) * WELLS_FX.swipe.sweepMs) / c.rate,
						c.rate,
					);
			return;
		}
		// the sting: the struck cell at the hit, then ring by ring outward
		const S = WELLS_FX.sting;
		const cell = c.cells[0];
		const r0 = cell % GRID;
		const c0 = Math.floor(cell / GRID);
		for (let dc = -S.reach; dc <= S.reach; dc += 1) {
			for (let dr = -S.reach; dr <= S.reach; dr += 1) {
				const reel = c0 + dc;
				const row = r0 + dr;
				if (reel < 0 || reel >= GRID || row < 0 || row >= GRID) continue;
				const d = Math.max(Math.abs(dc), Math.abs(dr));
				add(
					reel * GRID + row,
					'sting',
					c.at + (d * S.stepMs) / c.rate,
					c.rate,
					Math.pow(S.falloff, d),
				);
			}
		}
	};
	const takeCues = (now: number, skipping: boolean) => {
		const q = wellsFx.cues;
		if (!q.length) return;
		if (!skipping && hasGlow) for (const c of q) if (now - c.at <= WELLS_FX.cueMaxAgeMs) play(c);
		q.length = 0;
	};

	// ---- the board power (free spins): the resting glow of every vein ----------------------------------------------
	let power = 0;
	let powerTarget = 0;
	let lastNow = 0;
	const tickPower = (now: number, F: WellsFrame) => {
		const P = WELLS_FX.power;
		let sum = 0;
		if (F.freegame) for (let i = 0; i < F.tiles.length; i += 1) sum += F.tiles[i]?.value ?? 0;
		powerTarget =
			sum > 0
				? P.cap * clamp01(Math.log2(1 + sum / P.refValue) / Math.log2(1 + P.fullValue / P.refValue))
				: 0;
		const dt = lastNow ? Math.min(now - lastNow, 100) : 0;
		lastNow = now;
		const tau = powerTarget > power ? P.riseMs : P.fallMs;
		power += (powerTarget - power) * (1 - Math.exp(-dt / Math.max(tau / 3, 1)));
		if (Math.abs(power - powerTarget) < 1e-4) power = powerTarget;
	};

	// ---- the frame -------------------------------------------------------------------------------------------------
	const acc = new Float32Array(CELL_COUNT);
	const accTint = new Int32Array(CELL_COUNT);
	const shownAlpha = new Float32Array(CELL_COUNT);
	const shownGlowTint = new Int32Array(CELL_COUNT).fill(-1);
	const spent = { ms: 0, max: 0, ticks: 0 };
	const dimOn = WELLS.dimWithBoard;
	const tick = (now: number, F: WellsFrame) => {
		if (!ready || !hasGlow) take(F.tex);
		if (!ready) {
			wellsFx.cues.length = 0;
			return;
		}
		const t0 = import.meta.env.DEV ? performance.now() : 0;
		// the wells: the scene light times the win dim, as one tint
		lightOf();
		for (let i = 0; i < CELL_COUNT; i += 1) {
			const d = dimOn ? Math.round(F.cover[i] * 64) / 64 : 1;
			const tint =
				(Math.min(255, Math.round(255 * d * light[0])) << 16) |
				(Math.min(255, Math.round(255 * d * light[1])) << 8) |
				Math.min(255, Math.round(255 * d * light[2]));
			if (tint !== shownTint[i]) {
				shownTint[i] = tint;
				sprites[i].tint = tint;
			}
		}
		takeCues(now, F.skipping);
		if (hasGlow) {
			tickPower(now, F);
			const P = WELLS_FX.power;
			const w = (2 * Math.PI * now) / P.periodMs;
			for (let i = 0; i < CELL_COUNT; i += 1) {
				acc[i] =
					power > 0
						? power * (1 - P.shimmer / 2 + (P.shimmer / 2) * Math.sin(w + table.phase[i]))
						: 0;
				accTint[i] = WELLS_FX.tint.power;
			}
			for (let k = live.length - 1; k >= 0; k -= 1) {
				const f = live[k];
				// a skip drops the flares that have not started yet (the ones running finish their fade)
				const a = F.skipping && now < f.t0 ? -1 : level(f, now);
				if (a < 0) {
					live[k] = live[live.length - 1];
					live.length -= 1;
					free.push(f);
					continue;
				}
				if (a > acc[f.cell]) {
					acc[f.cell] = a;
					accTint[f.cell] = f.tint;
				}
			}
			for (let i = 0; i < CELL_COUNT; i += 1) {
				const a = acc[i] < WELLS_FX.epsilon ? 0 : Math.min(1, acc[i]);
				const g = glows[i];
				if (a !== shownAlpha[i]) {
					shownAlpha[i] = a;
					g.alpha = a;
					g.visible = a > 0;
				}
				if (a > 0 && accTint[i] !== shownGlowTint[i]) {
					shownGlowTint[i] = accTint[i];
					g.tint = accTint[i];
				}
			}
		}
		if (import.meta.env.DEV) {
			const ms = performance.now() - t0;
			spent.ms += ms;
			spent.ticks += 1;
			if (ms > spent.max) spent.max = ms;
		}
	};

	return {
		mount: (slot) => {
			if (!slot) return;
			if (layer.parent !== slot) slot.addChildAt(layer, 0);
			if (glowLayer.parent !== slot) slot.addChild(glowLayer);
		},
		place,
		tick,
		show: (on) => {
			shown = on;
			layer.visible = on && ready;
			glowLayer.visible = on && hasGlow;
		},
		flare: (cell, kind, delayMs = 0) => add(cell, kind, performance.now() + delayMs, 1),
		log: () => fxLog.splice(0, fxLog.length),
		cost: () => {
			const out = {
				mean: spent.ticks ? Number((spent.ms / spent.ticks).toFixed(4)) : 0,
				max: Number(spent.max.toFixed(3)),
				ticks: spent.ticks,
				flares: live.length,
				peakFlares,
			};
			spent.ms = spent.max = spent.ticks = 0;
			peakFlares = live.length;
			return out;
		},
		state: () => ({
			ready,
			hasGlow,
			shown,
			phoneTier: PHONE_TIER,
			cellPx: px,
			atlasPx: atlasPx.slice(),
			/** resident GPU MB of the two atlases, RGBA8 with the mip chain (x 4 / 3) */
			atlasMB: atlasPx.map((p) => (p ? Number(((p * p * 4 * 4) / 3 / 2 ** 20).toFixed(2)) : 0)),
			power: Number(power.toFixed(4)),
			powerTarget: Number(powerTarget.toFixed(4)),
			flares: live.length,
			cues: wellsFx.cues.length,
			cueCount: { ...wellsFx.count },
			glowsVisible: glows.filter((g) => g.visible).length,
			light: light.map((x) => Number(x.toFixed(3))),
			wellTint0: shownTint[0],
			/** the first cell's well and glow on screen (px), to check the cell size per screen */
			cell0: sprites[0].getBounds(),
			layers: layer.parent ? layer.parent.children.map((c) => c.label || c.constructor.name) : [],
		}),
	};
};
