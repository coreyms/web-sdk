// THE SUPER WHEEL'S PLAN (Corey 2026-11-18; the approved mock super_wheel_2026-11-18, rounds 1 to 5): what the wheel
// shows and where it stops, worked out from the book's own events and nothing else. PRESENTATION ONLY: the opening
// character, its multiplier and its column are the book's (the `columnWild` event with `start: true`, the math's
// start_tier / col_mult / start_column); the wheel always stops on them. Nothing here changes or adds to an outcome.
//
// THE FILLER IS THE BOOK'S (Corey: "I don't think the filler being reandom works because of replays, it needs to be
// consistant on the replays and continues"): the seven other wedges, the real wedge's place, the stop point inside it and
// the column ring's start all come from one seeded stream, and the seed is a hash of the round's events from its first up
// to the opening column. Those events are the same in live play (/wallet/play round.state), on a resume after a reload
// (authenticate's round.state, read BEFORE the resume cut: game/actor.ts) and in a replay, so the wheel is identical in
// all three. Never the bet id, the clock, the device, the layout or Math.random.
//
// THE RULES OF THE FILLER (the mock's, ported draw for draw so a book shows the wheel it showed in the mock):
//   1. seven draws by the books' real shares of the eight openings (SHARES below; the true odds, so the wheel never
//      shows more big values than the round really gives); a draw that repeats a wedge already on the wheel, or would
//      put a third copy of one value on it, is thrown back
//   2. the real wedge's place among the eight: floor(rng * 8)
//   3. THE STOP IS NEVER A NEAR MISS BY DESIGN: the stop point is inside the real wedge, at most 30% of a wedge either
//      side of its middle, so the peg never rests at the edge of a neighbour (a better or a worse one) to tease it
//   4. the column ring: its stop point the same way (30% of a place either side of the middle) and its start place
// The draws the mock made for the options that were not picked (P1, P3) are still made and thrown away, so the stream
// stays in step with the mock's.
import type { ColumnTier } from './typesBookEvent';

export const WHEEL_SLICES = 8;
export const WHEEL_STEP = 360 / WHEEL_SLICES;

/** the books' real shares of Super's eight openings (math 2026-11-18, `start_tier` and the Super row of `col_mult`:
 *  reindeer 66.7%, Santa 33.3%; each column 20%). The mock's own numbers, digit for digit. */
export const WHEEL_SHARES: readonly { tier: 'reindeer' | 'santa'; m: number; share: number }[] = [
	{ tier: 'reindeer', m: 4, share: 0.12666666666666665 },
	{ tier: 'reindeer', m: 5, share: 0.35333333333333333 },
	{ tier: 'reindeer', m: 6, share: 0.13999999999999999 },
	{ tier: 'reindeer', m: 8, share: 0.04666666666666667 },
	{ tier: 'santa', m: 10, share: 0.09999999999999999 },
	{ tier: 'santa', m: 12, share: 0.09 },
	{ tier: 'santa', m: 15, share: 0.06666666666666667 },
	{ tier: 'santa', m: 30, share: 0.07666666666666666 },
];

export type WheelSlice = { tier: ColumnTier; m: number };
export type WheelPlan = {
	/** the seed (FNV-1a 32 of the events' canon), for the probe and the notes */
	seed: number;
	/** the eight wedges clockwise from wedge 1 (the one under the peg while the wheel rests) */
	slices: WheelSlice[];
	/** the book's own wedge among them, and the stop point inside it (wedge widths from its middle, -0.3 to 0.3) */
	at: number;
	off: number;
	/** the book's opening: its character, multiplier and reel (0 to 4) */
	real: { tier: ColumnTier; m: number; reel: number };
	/** the column ring: its start place (0 to 4, under its pointer) and the stop point inside the book's place */
	ringStart: number;
	ringOff: number;
};

type EventLike = { type: string; board?: readonly (readonly string[])[]; bonusType?: string; cells?: readonly number[]; totalFs?: number; reel?: number; tier?: string; multiplier?: number; start?: boolean };

/** the round's events as one line, from its first up to and including the opening column (fields read by name) */
export const wheelCanon = (events: readonly EventLike[]): string => {
	const parts: string[] = [];
	for (const e of events) {
		let s = e.type;
		if (e.board) s += ':' + e.board.map((r) => r.join(',')).join('/');
		if (e.type === 'freeSpinTrigger') s += ':' + e.bonusType + ':' + (e.cells ?? []).join(',') + ':' + e.totalFs;
		if (e.type === 'columnWild') s += ':' + e.reel + ',' + e.tier + ',' + e.multiplier;
		parts.push(s);
		if (e.type === 'columnWild' && e.start) break;
	}
	return parts.join('|');
};
const fnv1a = (str: string): number => {
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h >>> 0;
};
const mulberry32 = (seed: number) => {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** the opening column of a round's events (Super's `columnWild` with `start: true`), or null */
export const openingOf = (events: readonly EventLike[]): EventLike | null => events.find((e) => e.type === 'columnWild' && e.start === true) ?? null;

/** THE WHEEL of a round, from its events (the whole round as the RGS gave it: index 0 on). null: no opening column. */
export const buildWheelPlan = (events: readonly EventLike[]): WheelPlan | null => {
	const start = openingOf(events);
	if (!start || typeof start.reel !== 'number' || typeof start.multiplier !== 'number' || !start.tier) return null;
	const real = { tier: start.tier as ColumnTier, m: start.multiplier, reel: start.reel };
	const seed = fnv1a(wheelCanon(events));
	const rng = mulberry32(seed);
	const pick = () => {
		let u = rng();
		for (const o of WHEEL_SHARES) if ((u -= o.share) < 0) return o;
		return WHEEL_SHARES[WHEEL_SHARES.length - 1];
	};
	const filler: WheelSlice[] = [];
	const used = new Map<string, number>([[real.tier + real.m, 1]]);
	const seen = new Set<string>([`${real.tier}${real.m}:${real.reel + 1}`]);
	let guard = 0;
	while (filler.length < WHEEL_SLICES - 1 && guard++ < 500) {
		const o = pick();
		// (the mock's wedges carried a column until round 5: its draw stays, and still tells two wedges of one value apart)
		const col = 1 + Math.floor(rng() * 5);
		const n = used.get(o.tier + o.m) ?? 0;
		const key = `${o.tier}${o.m}:${col}`;
		if (seen.has(key) || n >= 2) continue;
		seen.add(key);
		used.set(o.tier + o.m, n + 1);
		filler.push({ tier: o.tier, m: o.m });
	}
	// (a book whose stream could not fill the wheel in 500 draws: cannot happen with these shares; fill with the commonest)
	while (filler.length < WHEEL_SLICES - 1) filler.push({ tier: 'reindeer', m: 5 });
	const at = Math.floor(rng() * WHEEL_SLICES);
	const off = rng() * 0.6 - 0.3;
	rng(); // the mock's extra part turn (unused since round 2)
	const slices = filler.slice();
	slices.splice(at, 0, { tier: real.tier, m: real.m });
	// the second pick's draws, after all of spin one's (P1's order of the five numbers and its wedge: made, not used)
	for (let i = 4; i > 0; i--) rng();
	rng();
	const ringOff = rng() * 0.6 - 0.3;
	const ringStart = Math.floor(rng() * 5);
	return { seed, slices, at, off, real, ringStart, ringOff };
};

// ---- THE SPIN'S CURVE (the mock's, round 3): fixed the moment his hooves touch the rim, then the wheel only follows it ---
export type WheelCurve = { from: number; dTot: number; ta: number; tb: number; p: number; vMax: number };
export type CurveTimes = { driveMs: number; decelMs: readonly [number, number]; power: number; minDeg: number; extraTurns: number; crawlDeg: number };

/** the curve from angle `theta` (degrees, the disc's turn) to the plan's stop: a speed-up of `driveMs` under his run, then
 *  only a slow-down (an ease out of power `power`) whose last `crawlDeg` take as long as the approved round 2 curve's */
export const spinCurve = (theta: number, plan: WheelPlan, T: CurveTimes): WheelCurve => {
	const target = -(WHEEL_STEP / 2 + plan.at * WHEEL_STEP + plan.off * WHEEL_STEP);
	let dOld = (((theta - target) % 360) + 360) % 360;
	while (dOld < T.minDeg + T.crawlDeg) dOld += 360;
	const ta = T.driveMs / 1000;
	const p = T.power;
	const span = T.decelMs[1] - T.decelMs[0];
	const tbOld = (T.decelMs[0] + span * Math.min(1, Math.max(0, (dOld - T.minDeg - T.crawlDeg) / 360))) / 1000;
	const tail = (d: number, tb: number) => {
		const v = d / (ta / 2 + tb / (p + 1));
		const dd = (v * tb) / (p + 1);
		return tb * Math.pow(Math.min(1, T.crawlDeg / dd), 1 / (p + 1));
	};
	const want = tail(dOld, tbOld);
	const dTot = dOld + 360 * T.extraTurns;
	let lo = tbOld;
	let hi = tbOld + 6;
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		if (tail(dTot, mid) < want) lo = mid;
		else hi = mid;
	}
	const tb = T.extraTurns > 0 ? (lo + hi) / 2 : tbOld;
	return { from: theta, dTot, ta, tb, p, vMax: dTot / (ta / 2 + tb / (p + 1)) };
};

/** the column ring's curve from `phi` to the book's column: a short wind up, then a slow-down, at least `minDeg` */
export const ringCurve = (phi: number, plan: WheelPlan, T: { driveMs: number; decelMs: readonly [number, number]; power: number; minDeg: number }): WheelCurve => {
	const target = -(plan.real.reel * 72 + plan.ringOff * 72);
	let dTot = (((phi - target) % 360) + 360) % 360;
	while (dTot < T.minDeg) dTot += 360;
	const ta = T.driveMs / 1000;
	const tb = (T.decelMs[0] + (T.decelMs[1] - T.decelMs[0]) * ((dTot - T.minDeg) / 360)) / 1000;
	return { from: phi, dTot, ta, tb, p: T.power, vMax: dTot / (ta / 2 + tb / (T.power + 1)) };
};

/** degrees turned `t` seconds into a curve (never more than its whole turn) */
export const curveAt = (c: WheelCurve, t: number): number => {
	if (t <= 0) return 0;
	if (t <= c.ta) return 0.5 * (c.vMax / c.ta) * t * t;
	const u = Math.min(1, (t - c.ta) / c.tb);
	return Math.min(c.dTot, 0.5 * c.vMax * c.ta + ((c.vMax * c.tb) / (c.p + 1)) * (1 - Math.pow(1 - u, c.p + 1)));
};
export const curveLength = (c: WheelCurve): number => c.ta + c.tb;

/** the wedge under the peg at a disc angle, and the ring's place under its pointer at a ring angle */
export const slotAtPeg = (theta: number): number => Math.floor((((-theta % 360) + 360) % 360) / WHEEL_STEP) % WHEEL_SLICES;
export const ringAtPointer = (phi: number): number => Math.floor(((((-phi + 36) % 360) + 360) % 360) / 72) % 5;

// ---- THE PLAN OF THE ROUND IN PLAY ----------------------------------------------------------------------------------
// Made from the round's WHOLE events the moment the game has them (a live play and a replay: game/utils.ts playBet; a
// resumed round: game/actor.ts onResumeGameActive, before the resume cut drops the events already played), and read by
// the opening column's handler (game/bookEventHandlerMap.ts).
let planned: WheelPlan | null = null;
export const planWheel = (events: readonly EventLike[]): WheelPlan | null => (planned = buildWheelPlan(events));
/** the plan for this opening column: the round's own (when it is that column's), else one made from the events at hand */
export const wheelPlanFor = (events: readonly EventLike[], opening: { reel: number; tier: string; multiplier: number }): WheelPlan | null => {
	if (planned && planned.real.reel === opening.reel && planned.real.tier === opening.tier && planned.real.m === opening.multiplier) return planned;
	return buildWheelPlan(events);
};

if (import.meta.env.DEV && typeof window !== 'undefined') {
	// house rule: extend __reindeer, never a new global
	Object.assign(((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {}), {
		/** the wheel a round's events make (the probe: the same events give the same wheel; the stop is the book's) */
		wheelPlan: (events: EventLike[]) => buildWheelPlan(events),
		wheelPlanned: () => planned,
	});
}
