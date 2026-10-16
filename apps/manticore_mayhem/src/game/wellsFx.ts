// THE WELLS' LIGHT-UP CUES (constants WELLS_FX; drawn by game/wells.ts, Corey 2026-10-16 16:40).
//
// The call sites that already present each beat say so here, once per beat: a plate's count-over starting
// (stateGame pumpPlates: a tile lights or steps up), a paying cluster's pulse starting (presentWinSet), the swipe
// starting (swipeBand) and each sting strike (stingHit / stingBig, with the time of its hit). PRESENTATION ONLY:
// nothing waits on a cue and nothing here touches the game's state. The wells read the queue once a frame and turn
// each cue into flares; a cue that waited longer than WELLS_FX.cueMaxAgeMs (a hidden tab, a stalled ticker) is
// dropped, the queue never holds more than WELLS_FX.cueMax, and the callers never cue while skipping.
import { WELLS_FX } from './constants';

export type WellsCueKind = 'light' | 'double' | 'win' | 'swipe' | 'sting';
export type WellsCue = {
	kind: WellsCueKind;
	/** performance.now() the beat starts (the sting's: its hit) */
	at: number;
	/** the turbo scale when it was cued (style ms per real ms) */
	rate: number;
	/** light / double / sting: the cell; win: the cluster's cells, the first one first (the book's order) */
	cells: number[];
	/** swipe: the rows */
	rows: number[];
};

export const wellsFx = {
	cues: [] as WellsCue[],
	/** DEV probe: cues made since boot, per kind */
	count: { light: 0, double: 0, win: 0, swipe: 0, sting: 0 } as Record<WellsCueKind, number>,
};

const cue = (
	kind: WellsCueKind,
	at: number,
	rate: number,
	cells: number[],
	rows: number[] = [],
) => {
	const q = wellsFx.cues;
	if (q.length >= WELLS_FX.cueMax) q.splice(0, q.length - WELLS_FX.cueMax + 1);
	q.push({ kind, at, rate: Math.max(0.2, rate), cells, rows });
	wellsFx.count[kind] += 1;
};

/** a plate's count-over starts on `cell`: from 0 it LIGHTS, from a value it steps up (doubles) */
export const cueWellTile = (cell: number, from: number, to: number, rate: number) => {
	if (to > from) cue(from > 0 ? 'double' : 'light', performance.now(), rate, [cell]);
};
/** a paying cluster's pulse starts (its readout comes up): `cells` in the book's order */
export const cueWellWin = (cells: number[], rate: number) =>
	cue('win', performance.now(), rate, cells.slice());
/** the swipe starts over `rows` */
export const cueWellSwipe = (rows: number[], rate: number) =>
	cue('swipe', performance.now(), rate, [], rows.slice());
/** a sting strike lands on `cell` at `at` (performance.now() of the hit); never a scatter sting */
export const cueWellSting = (cell: number, at: number, rate: number, kind: string) => {
	if (kind !== 'scatter') cue('sting', at, rate, [cell]);
};
/** a skip, a new round: nothing queued may play */
export const clearWellCues = () => {
	wellsFx.cues.length = 0;
};
