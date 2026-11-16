// LANE BY LANE TRAFFIC AND THE SCATTER TEASE (constants LANE_FLOW): the release plan of one drive in. A plain function of
// the board's cars, so the road (game/road/roadBoard.ts) plays it and the probe (tools/lane_stagger_probe.mjs) can hold
// it against Corey's page. It is the page's schedule() (lane_stagger_mock_2026-11-16.html) with the game's own
// additions: a car may be missing (a held column Wild: its place keeps its normal time, nothing else moves), the deciding
// count is 4 in the base game and 3 in a feature, and the cap.
import { LANE_FLOW } from '../constants';

/** one car of the drive in: its lane, its place in the lane counted from the lead (0 = the lead, the one going
 *  farthest), whether it carries a scatter */
export type FlowCar = { lane: number; k: number; scatter: boolean };

export type FlowParams = {
	laneGapMs: number;
	carGapMs: number;
	clearGapMs: number;
	driveInMs: number;
	shortShare: number;
	seenMs: number;
	/** the tease's gaps (0 = no tease at that count) */
	twoGapMs: number;
	threeGapMs: number;
	/** the scatter count that decides the last outcome (base game 4: Super; a feature 3: the retrigger) */
	decideAt: number;
	/** the lanes' order (lane 0 = top) */
	laneOrder: number[];
	/** the most the plan may take, first release to the last car's stop, ms (Infinity = no cap) */
	budgetMs: number;
	/** cars per lane (the share of the distance) */
	perLane: number;
};

export type PlannedCar = FlowCar & {
	/** its normal release (no tease), its release, its drive, its arrival: ms from the plan's start */
	nr: number;
	rel: number;
	dur: number;
	arr: number;
	/** the tease level when it left: 0 normal, 1 two seen, 2 three seen, 3 cleared */
	level: number;
};

export type FlowPlan = {
	cars: PlannedCar[];
	/** when each scatter is seen, sorted */
	seen: number[];
	/** the last car's arrival */
	end: number;
	/** the first and last release */
	firstRelease: number;
	lastRelease: number;
	/** the tease: from the second scatter seen while cars remain (null: none), its step at three seen (null: none), and
	 *  when it is over (the deciding scatter seen, or the last car seen) */
	teaseFrom: number | null;
	threeFrom: number | null;
	teaseEnd: number | null;
	/** the cap's factor on the tease gaps (1 = as set) */
	factor: number;
	/** cars held back by the tease (released later than their normal time) */
	held: number;
	decideAt: number;
};

/** the tease level at plan time t, from the seen times */
export const flowLevel = (seen: number[], t: number, decideAt: number): number => {
	let n = 0;
	for (const s of seen) if (s <= t) n += 1;
	return n >= decideAt ? 3 : n >= 3 ? 2 : n >= 2 ? 1 : 0;
};

const plan0 = (input: FlowCar[], p: FlowParams, factor: number): FlowPlan => {
	const laneIndex = (lane: number) => Math.max(0, p.laneOrder.indexOf(lane));
	const cars: PlannedCar[] = input.map((c) => {
		const share = (p.perLane - c.k) / p.perLane;
		const dur = p.driveInMs * (p.shortShare + (1 - p.shortShare) * share);
		return { ...c, nr: laneIndex(c.lane) * p.laneGapMs + c.k * p.carGapMs, rel: 0, dur, arr: 0, level: 0 };
	});
	cars.sort((a, b) => a.nr - b.nr || laneIndex(a.lane) - laneIndex(b.lane));
	const two = p.twoGapMs * factor;
	const three = p.threeGapMs * factor;
	const seen: number[] = [];
	let prevRel = -1e9;
	let held = 0;
	for (const q of cars) {
		let rel = q.nr;
		for (let it = 0; it < 4; it++) {
			const lv = flowLevel(seen, rel, p.decideAt);
			if (lv === 3) {
				const decided = seen.slice().sort((a, b) => a - b)[p.decideAt - 1];
				rel = Math.max(prevRel + p.clearGapMs, decided);
				break;
			}
			if (lv === 0) break;
			const need = prevRel + (lv === 1 ? two : three);
			if (rel >= need) break;
			rel = need;
		}
		q.rel = rel;
		q.arr = rel + q.dur;
		q.level = flowLevel(seen, rel, p.decideAt);
		if (rel > q.nr + 1) held += 1;
		if (q.scatter) seen.push(rel + p.seenMs);
		prevRel = rel;
	}
	seen.sort((a, b) => a - b);
	const end = cars.reduce((m, q) => Math.max(m, q.arr), 0);
	const firstRelease = cars.length ? cars[0].rel : 0;
	const lastRelease = cars.reduce((m, q) => Math.max(m, q.rel), 0);
	// the tease runs from the second scatter seen while a car is still to leave; it steps at three; it is over when the
	// deciding scatter is seen or the last car is seen
	const second = seen.length >= 2 && (two > 0 || three > 0) ? seen[1] : null;
	const teaseFrom = second !== null && second < lastRelease && p.decideAt > 2 ? second : null;
	const decided = seen.length >= p.decideAt ? seen[p.decideAt - 1] : Infinity;
	const lastSeen = lastRelease + p.seenMs;
	const teaseEnd = teaseFrom === null ? null : Math.min(decided, lastSeen);
	const threeAt = seen.length >= 3 && p.decideAt > 3 ? seen[2] : null;
	const threeFrom = teaseFrom !== null && threeAt !== null && threeAt < (teaseEnd ?? 0) && threeAt < lastRelease ? Math.max(threeAt, teaseFrom) : null;
	return { cars, seen, end, firstRelease, lastRelease, teaseFrom, threeFrom, teaseEnd, factor, held, decideAt: p.decideAt };
};

/** THE PLAN: the page's schedule, then the cap (the tease gaps compressed in proportion until the last car's stop fits
 *  the budget) */
export const planFlow = (input: FlowCar[], p: FlowParams): FlowPlan => {
	const full = plan0(input, p, 1);
	if (full.end <= p.budgetMs || full.held === 0) return full;
	let lo = 0;
	let hi = 1;
	let best = plan0(input, p, 0);
	if (best.end > p.budgetMs) return best;
	for (let i = 0; i < 22; i++) {
		const mid = (lo + hi) / 2;
		const t = plan0(input, p, mid);
		if (t.end <= p.budgetMs) {
			lo = mid;
			best = t;
		} else hi = mid;
	}
	return best;
};

/** the plan's numbers for a turbo level (LANE_FLOW), `free`: a feature round's spin (decides at 3), `tease`: allowed */
export const flowParams = (level: 0 | 1 | 2, opts: { free: boolean; tease: boolean; budgetMs: number }): FlowParams => {
	const F = LANE_FLOW;
	const L = level === 2 ? F.turbo2 : level === 1 ? F.turbo1 : F.normal;
	const half = level === 2 && F.tease.turbo2 === 'half' ? 0.5 : 1;
	const on = opts.tease && F.tease.on && !(level === 2 && F.tease.turbo2 === 'drop');
	return {
		laneGapMs: L.laneGapMs,
		carGapMs: L.carGapMs,
		clearGapMs: L.clearGapMs,
		driveInMs: F.driveInMs,
		shortShare: F.shortShare,
		seenMs: F.seenMs,
		twoGapMs: on ? F.tease.twoGapMs * half : 0,
		threeGapMs: on ? F.tease.threeGapMs * half : 0,
		// no tease: no levels at all (normal flow to the end, no clear either)
		decideAt: on ? (opts.free ? 3 : 4) : 99,
		laneOrder: [0, 1, 2, 3],
		budgetMs: opts.budgetMs,
		perLane: 5,
	};
};
