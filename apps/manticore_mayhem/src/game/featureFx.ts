// THE FEATURE FX BUS: what the claw swipe, the sting and the roar draw on top of (or under) the board
// cells, handed from the board engine (stateGame.svelte.ts, which owns the clock and the structural
// change) to the raw Pixi layers that draw it (components/ClawSwipe.svelte, components/Sting.svelte).
// Plain JS on purpose, like game/sparkles.ts: the layers read it once a tick outside any reactive
// context, so a frame of a feature costs no Svelte flush.
//
// Clocks: the swipe and the roar are written every frame by the engine's own rAF pass in STYLE ms
// (`el`), so the layer draws exactly the frame the engine is on. The sting's overlays outlive the
// engine's beat (a normal sting's ring runs into the gap after it), so the engine stamps each one
// with performance.now() and the style rate, and Sting.svelte runs them to their end on its own.

import { CELL_COUNT } from './constants';
import { STAGING_TOOLS, perfMark } from './staging';

/** THE KICK HOOK. The board's current screen-kick offset in BOARD px (board space, before the
 *  board's layout scale), written by whichever feature is kicking (swipe, roar) and applied to the
 *  board container by ClawSwipe.svelte. A future layer that must follow the kick (the CHAINS bow,
 *  MOTION_SPEC "Board layers and the kick") reads this, once a tick; it is 0, 0 at rest. */
export const boardKick = { x: 0, y: 0 };

/** the claw swipe in flight (stateGame.swipeBand writes it every frame; ClawSwipe.svelte draws it) */
export const swipeFx = {
	/** a swipe is on the board: the layer captures the reflection once, then draws the tears */
	active: false,
	/** bumped per swipe, so the layer captures the board exactly once for each one */
	serial: 0,
	/** style ms since the swipe began */
	el: 0,
	/** the swiped rows (the book's), top to bottom */
	rows: [] as number[],
	/** the tears' shared fade, 1 -> 0 over tearFadeMs */
	alpha: 1,
};

/** the roar's cell flashes: cellIndex -> flash alpha this frame (0 = none). Written by
 *  stateGame.roarBlow every frame, drawn under the tiles by ClawSwipe.svelte's well layer. */
export const roarFx = {
	active: false,
	flash: new Float32Array(CELL_COUNT),
};

// ---- the sting --------------------------------------------------------------------------------

/** one struck cell's overlays: the tail streak (normal), the white flash, the per-cell ring (normal) */
export type StingStrikeFx = {
	cell: number;
	/** performance.now() at the beat's start, and style ms per real ms (the turbo divisor) */
	t0: number;
	rate: number;
	/** the beat's style length and where the flip lands in it */
	dur: number;
	hitAt: number;
	streak: boolean;
	/** style ms of the per-cell ring after the hit; 0 = none */
	ringMs: number;
	kind: 'normal' | 'big' | 'super' | 'scatter';
};
/** the centre telegraph of a big / super charge (or the scatter sting's wait) */
export type StingChargeFx = { centre: number; t0: number; rate: number; dur: number; kind: 'big' | 'super' | 'scatter' };
/** one ripple ring from a big / super shape's centre, or a scatter's landing ring (`color` set: drawn in
 *  that colour with its soft glow, from `from` cells to `reach`) */
export type StingRingFx = { centre: number; t0: number; rate: number; dur: number; reach: number; px: number; color?: number; from?: number };

export const stingFx = {
	strikes: [] as StingStrikeFx[],
	charge: null as StingChargeFx | null,
	rings: [] as StingRingFx[],
};

/** drop every sting overlay (a skip, a superseded run, a new round) */
export const clearStingFx = () => {
	stingFx.strikes.length = 0;
	stingFx.rings.length = 0;
	stingFx.charge = null;
};

// ---- the chain haul (CHAIN_BOW.haul*) -------------------------------------------------------------

/** every spin press, as performance.now() and the style rate at that moment: components/BoardFrame.svelte
 *  turns each into one haul (haulDelayMs, then haulLinks over haulMs) and keeps the accumulated offset.
 *  Written by game/actor.ts onNewGameStart (a manual press, the space bar or an autoplay spin). */
export const chainFx = {
	presses: [] as { t0: number; rate: number }[],
};
export const chainHaulPress = (rate: number) => {
	chainFx.presses.push({ t0: performance.now(), rate });
	if (chainFx.presses.length > 32) chainFx.presses.splice(0, 16);
};

// ---- DEV probe log (tools/manticore/fx_probe.js reads it through __manticore.fx) ---------------

/** one feature's phase stamps in performance.now() ms, keyed by phase name, plus what it was told */
export type FxRecord = { kind: string; at: Record<string, number>; info?: Record<string, unknown> };
export const fxLog = {
	records: [] as FxRecord[],
};
/** start a record (DEV only; a no-op object in production) */
export const fxRecord = (kind: string, info?: Record<string, unknown>): FxRecord => {
	const rec: FxRecord = { kind, at: { start: performance.now() }, info };
	if (import.meta.env.DEV) {
		fxLog.records.push(rec);
		if (fxLog.records.length > 1000) fxLog.records.splice(0, 500);
	}
	return rec;
};
/** stamp a phase once (the first frame it is reached) */
export const fxStamp = (rec: FxRecord, phase: string) => {
	if (rec.at[phase] === undefined) {
		rec.at[phase] = performance.now();
		if (STAGING_TOOLS) perfMark(`${rec.kind}:${phase}`);
	}
};
