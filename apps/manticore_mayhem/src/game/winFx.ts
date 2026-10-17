// THE WIN EFFECT BUS (constants WIN_FX, round 1 2026-10-16). Like game/sparkles.ts: the board engine
// (stateGame.presentWinSet / removeCells) writes, components/BoardCells.svelte reads once a tick outside any
// reactive context. Plain JS, presentation only, never awaited, never part of the board state.
//
//   style   'new' (WIN_FX) or 'old' (the shrink, the square flash and the dust dots). DEV `?winfx=old|new`
//           picks it at load; production always runs WIN_FX.style. Read once per win set, so a change
//           never splits one set between the two looks.
//   shine   per CELL ID, the shine's band position and opacity and the whole-symbol heat, written by the
//           engine every frame of a win set, deleted when the cell leaves (the map is empty at rest)
//   bursts  a queue of burst requests (the pop of one symbol), drained by BoardCells each tick; times are
//           REAL ms (the engine has divided the style life by the turbo scale)
import { WIN_FX } from './constants';

export type WinFxStyle = 'new' | 'old';

const pickStyle = (): WinFxStyle => {
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		const q = new URLSearchParams(window.location.search).get('winfx');
		if (q === 'old' || q === 'new') return q;
	}
	return WIN_FX.style;
};

export const winFx = { style: pickStyle() };

/** one cell's shine this frame: `band` the band centre in symbol widths (WIN_FX.shine.from .. to), `a` the band's
 *  opacity (0 = no band), `heat` the whole symbol's additive copy 0..1, `pulse` the breath (WIN_FX.breathe): a
 *  multiplier on the drawn size only, applied by the renderer so the engine writes no Cell field for it every frame
 *  (Cell.scaleX / scaleY keep the held winScale) */
export type ShineCell = { band: number; a: number; heat: number; pulse: number };
export const shineCells = new Map<number, ShineCell>();

export type WinBurst = { reel: number; row: number; tint: number; seed: number; t0: number; rays: number; core: number; embers: number };
const queue: WinBurst[] = [];
let seedCounter = 1;

/** DEV probe counters (__manticore.winfx) */
export const winFxStats = {
	bursts: 0,
	/** shine groups drawn right now / the most ever / the pool's size */
	shineInUse: 0,
	shinePeak: 0,
	shinePool: 0,
	burstsInUse: 0,
	burstPeak: 0,
	burstDropped: 0,
	shakes: 0,
};

/** ask for one symbol's burst; `ts` the style rate at the call (lives are style ms, divided by it) */
export const spawnWinBurst = (reel: number, row: number, tint: number, ts: number) => {
	seedCounter = (seedCounter + 1) | 0;
	const k = Math.max(0.2, ts);
	queue.push({
		reel,
		row,
		tint,
		seed: seedCounter * 7919 + 13,
		t0: performance.now(),
		rays: Math.max(1, WIN_FX.burst.rays.lifeMs / k),
		core: Math.max(1, WIN_FX.burst.core.lifeMs / k),
		embers: Math.max(1, WIN_FX.embers.lifeMs / k),
	});
	winFxStats.bursts += 1;
};

/** drain every queued burst (BoardCells, once per tick) */
export const takeWinBursts = (): WinBurst[] => (queue.length ? queue.splice(0, queue.length) : queue);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const quadOut = (t: number) => t * (2 - t);
const quadIn = (t: number) => t * t;

/** THE POP CURVE (WIN_FX.pop) at u (0..1 of removeMs) from a held scale `base`, twisting `dir` (+1 / -1).
 *  Writes into `out` (no allocation). The burst's moment is POP_AT below. */
export type PopPose = { sx: number; sy: number; rot: number; alpha: number; heat: number };
export const popPose = (u: number, base: number, dir: number, out: PopPose): PopPose => {
	const P = WIN_FX.pop;
	const a = P.squashShare;
	const b = a + P.popShare;
	if (u < a) {
		const e = quadOut(clamp01(u / a));
		out.sx = base * (1 + P.squashX * e);
		out.sy = base * (1 - P.squashY * e);
		out.rot = dir * P.twistIn * e;
		out.alpha = 1;
		out.heat = P.heatSquash * e;
	} else if (u < b) {
		const e = quadOut(clamp01((u - a) / P.popShare));
		const sx0 = 1 + P.squashX;
		const sy0 = 1 - P.squashY;
		out.sx = base * (sx0 + (P.popScale - sx0) * e);
		out.sy = base * (sy0 + (P.popScale - sy0) * e);
		out.rot = dir * (P.twistIn + (-P.twistPop - P.twistIn) * e);
		out.alpha = 1;
		out.heat = P.heatSquash + (P.heatPop - P.heatSquash) * e;
	} else if (u < 1) {
		const v = clamp01((u - b) / (1 - b));
		const s = base * P.popScale * (1 - quadIn(v));
		out.sx = s;
		out.sy = s;
		out.rot = dir * (-P.twistPop + (-P.twistOut + P.twistPop) * quadOut(v));
		out.alpha = v <= P.fadeFrom ? 1 : 1 - (v - P.fadeFrom) / (1 - P.fadeFrom);
		out.heat = P.heatPop * (1 - v);
	} else {
		out.sx = 0;
		out.sy = 0;
		out.rot = dir * P.twistOut;
		out.alpha = 0;
		out.heat = 0;
	}
	return out;
};
/** the u at which the pop phase starts (the burst's moment) */
export const POP_AT = WIN_FX.pop.squashShare;

/** the shine band at `el` style ms into a sweep: writes band / a into `out` (a = 0 outside the sweep) */
export const sweepAt = (el: number, peak: number, out: ShineCell): void => {
	const S = WIN_FX.shine;
	if (el < 0 || el >= S.sweepMs) return;
	const v = el / S.sweepMs;
	const ramp = v < S.rampShare ? v / S.rampShare : v > 1 - S.rampShare ? (1 - v) / S.rampShare : 1;
	const a = peak * ramp;
	if (a > out.a) {
		out.a = a;
		out.band = S.from + (S.to - S.from) * v;
	}
};
