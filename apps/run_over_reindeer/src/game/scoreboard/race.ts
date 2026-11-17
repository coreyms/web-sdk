// THE GREAT RACE (Corey's r3b, bigwin_led_r3_2026-11-16 NOTES "The race is a small program"; constants LED_BOARD.race):
// the reindeer against the police car on the LED strip. DECORATION ONLY: each run draws its own result at its start from
// RACE_ODDS with ITS OWN random source (a small seeded generator below, never Math.random, never anything of a round),
// then animates toward that result with three random wobbles in the lead, so the lead changes hands; over the last
// quarter the winner pulls clear and crosses the checkered finish line ahead, or both noses meet the line together (a tie).
// Nothing here is tied to a spin, a book, a bet or anything the player chose.
import { LED_BOARD } from '../constants';

export type RaceOutcome = 'reindeer' | 'police' | 'tie';
export type Race = { outcome: RaceOutcome; w: { f: number; ph: number; a: number }[]; id: number };

/** a small, fast, seeded generator (mulberry32): the race's own random source, 0 <= x < 1 */
export const raceRandom = (seed: number) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** the live races' source: seeded once from the clock and the page's own crypto (never shared with anything else) */
const seed0 = (() => {
	try {
		const u = new Uint32Array(1);
		globalThis.crypto?.getRandomValues?.(u);
		return (u[0] ^ Date.now()) >>> 0;
	} catch {
		return Date.now() >>> 0;
	}
})();
let liveRandom = raceRandom(seed0);

/** DEV / probes: reseed the live races (the probe's seeded runs) */
export const reseedRace = (seed: number) => {
	liveRandom = raceRandom(seed);
};

/** a new run: its result first (RACE_ODDS), then its three wobbles; `force` plays a chosen result (the tune panel) */
export const newRace = (force: RaceOutcome | null = null, rnd: () => number = liveRandom): Race => {
	const O = LED_BOARD.race.odds;
	let outcome = force;
	const r = rnd();
	if (!outcome) outcome = r < O.reindeer ? 'reindeer' : r < O.reindeer + O.police ? 'police' : 'tie';
	const w = [0, 1, 2].map(() => ({ f: 1.5 + rnd() * 2.5, ph: rnd() * Math.PI * 2, a: 0.5 + rnd() * 0.5 }));
	return { outcome, w, id: rnd() };
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => {
	t = clamp(t, 0, 1);
	return t * t * (3 - 2 * t);
};

/** both racers' progress, 0 at the start line, 1 at the finish line, at race time t (ms) */
export const raceProgress = (race: Race, t: number) => {
	const R = LED_BOARD.race;
	const u = clamp(t / R.runMs, 0, 1);
	let lead = 0;
	for (const k of race.w) lead += k.a * Math.sin(u * Math.PI * 2 * k.f + k.ph);
	lead *= 0.09 * Math.sin(Math.PI * Math.min(1, u / 0.8));
	// the decider: over the last quarter the winner pulls clear (or, for a tie, the two meet exactly)
	const end = ease(clamp((u - 0.72) / 0.28, 0, 1));
	const gap = race.outcome === 'tie' ? 0 : race.outcome === 'reindeer' ? R.finishGap * 2 : -R.finishGap * 2;
	lead = lead * (1 - end) + gap * end;
	const r = u + lead / 2;
	const c = u - lead / 2;
	return { r: Math.min(r, 1), c: Math.min(c, 1), u, lead };
};

/** DEV / probes: how a run plays out, sampled every `stepMs` (the lead changes, who reached the line first) */
export const raceTrace = (race: Race, stepMs = 10) => {
	const R = LED_BOARD.race;
	let changes = 0;
	let sign = 0;
	let first: RaceOutcome | null = null;
	let rAt = -1;
	let cAt = -1;
	for (let t = 0; t <= R.runMs; t += stepMs) {
		const p = raceProgress(race, t);
		const s = Math.abs(p.lead) < 1e-3 ? 0 : Math.sign(p.lead);
		if (s !== 0 && sign !== 0 && s !== sign && t < R.runMs * 0.72) changes += 1;
		if (s !== 0) sign = s;
		if (rAt < 0 && p.r >= 1) rAt = t;
		if (cAt < 0 && p.c >= 1) cAt = t;
	}
	const end = raceProgress(race, R.runMs * 0.999);
	if (Math.abs(end.r - end.c) < 0.005) first = 'tie';
	else first = end.r > end.c ? 'reindeer' : 'police';
	return { outcome: race.outcome, leadChanges: changes, ahead: first, gapAtLine: Math.round((end.r - end.c) * 1000) / 1000, reindeerAt: rAt, policeAt: cAt };
};

/** DEV / probes: `n` seeded runs and their results (decoration only: the same function the strip draws from) */
export const raceTally = (seed: number, n: number) => {
	const rnd = raceRandom(seed);
	const out = { reindeer: 0, police: 0, tie: 0, leadChangesMin: Infinity, leadChangesMax: 0, mismatches: 0 };
	for (let i = 0; i < n; i++) {
		const race = newRace(null, rnd);
		out[race.outcome] += 1;
		const tr = raceTrace(race);
		out.leadChangesMin = Math.min(out.leadChangesMin, tr.leadChanges);
		out.leadChangesMax = Math.max(out.leadChangesMax, tr.leadChanges);
		if (tr.ahead !== race.outcome) out.mismatches += 1;
	}
	return out;
};
