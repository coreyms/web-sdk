// @ts-nocheck: a node check script, not app code (svelte-check picks up .mjs files)
// THE HIT ALWAYS SHOWS BEFORE HE RUNS (2026-11-21; game/road/chargeWindup.ts THE ROOM and THE GUARANTEE, planWindup,
// windupFirstFrame; game/road/roam.ts Roam.alert and Roam.update's hitShown; constants ROAM.charge.hitMarginMs). Corey
// picked option (b) of the frame 18 question: planWindup aims the hit (frame 9, CHARGE_HIT) no later than one long frame
// (hitMarginMs) before his set off, and his pace rule ("I don't want to slow the spin pace down") means the set off and
// the run never wait or move. Node only, no browser. planWindup sees a spot only through its stand (the set off less the
// strike's start: CROSSHAIR.leadMs or, under SKIP TO RESULT, STRIKE.leadInMs, plus planRoamStrike's waitMs, which a far
// spot makes negative) and the crosshair's hop landings, so this sweeps every stand from below zero to past any real
// one in 1 ms steps against every hop the hit can take (none, each hop time in the hit window in 2 ms steps, and hops
// outside it) and so covers every spot. Each plan is stepped the way Roam.update draws it (the first board clock after
// the strike's start at a random phase, then one frame step at a time; at or past the set off he is gone; the first
// frame at or past the hit's time draws the hit) at frame steps of 8.3, 16.7, 28.3 (Turbo 1), 33.3 (a 30 Hz screen),
// 43.3 (Turbo 2 changed in mid strike), 50 (a slam stop's hurry from mid strike) and 56.7 (Turbo 1 on a 30 Hz screen)
// board ms, steady and changed in mid strike, and checks:
//   1. THE HIT SHOWS: every stand longer than hitMarginMs draws frame 9 before the set off at every step pattern and
//      phase; a stand of hitMarginMs or less has the hit at the start (frame 9 his first frame, so any frame of him drawn
//      standing is the hit first); a stand of zero or less shows no wind-up frame at all (as before)
//   2. THE ROOM: the hit no later than hitMarginMs before the set off, never before the start, the frames in order
//   3. NOTHING ELSE MOVES: the plan's set off is the one given, and the frame he goes on is the same as with the old plan
//   4. ROOM, AS BEFORE: a strike whose hit had the room is the old plan frame for frame (k, hop, every frame's time)
//   5. TIGHT ONLY WHEN NEEDED: the hit moves only when the old one was later than hitMarginMs before the set off, and to
//      exactly that latest time (or the start); the frames after it at the rig's pace from its new time
//   6. TURBO 2 AND A HURRY FROM THE START: the head down only, as before (no hit)
//   7. DETERMINISTIC: the same inputs (any order of hops) give the same plan (replay and resume)
//   8. WHAT FOLLOWS THE HIT: the kicked snow's frames (10 to 15 and 17, those before the set off: ChargeFx.begin's rule)
//      and the lock's puff frame (windupFrame at the lock) come from the new plan's times
//   INFO (not asserted): steps longer than hitMarginMs (Turbo 2 changed or a hurry on a 30 Hz screen, a dropped frame),
//   how many of those stands still miss the hit
//   node --experimental-strip-types --no-warnings tools/charge_hit_check.mjs      (from apps/run_over_reindeer)
// Pass: every line PASS, "0 fail" and exit 0.
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// the app's modules read import.meta.env and $env (Vite and SvelteKit): stood in as a dev build's; their own imports
// leave out the .ts (Vite's way): added here
register(
	'data:text/javascript,' +
		encodeURIComponent(`export async function resolve(s, c, n) {
	if (s.startsWith('$env/')) return { url: 'data:text/javascript,export {}', shortCircuit: true };
	if (/^\\.\\.?\\//.test(s) && !/\\.[a-z]+$/.test(s)) return n(s + '.ts', c);
	return n(s, c);
}
export async function load(u, c, n) {
	const r = await n(u, c);
	if (u.endsWith('.ts') && r.source) return { ...r, source: String(r.source).replaceAll('import.meta.env', '({ DEV: true })') };
	return r;
}`),
);
const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = (p) => import(pathToFileURL(join(APP, 'src', 'game', p)).href);
const { planWindup, windupFrame, windupFirstFrame, CHARGE_HIT } = await mod('road/chargeWindup.ts');
const { ROAM, CROSSHAIR, STRIKE, ROAD_MOTION } = await mod('constants.ts');
const { REINDEER_ROAM } = await mod('reindeerRoamSpec.ts');

const M = ROAM.charge.hitMarginMs;
const FR = 1000 / REINDEER_ROAM.fps;
const TH = (CHARGE_HIT - 1) * FR;
const [LO, HI] = ROAM.charge.hitWindow;
const N = REINDEER_ROAM.clips.charge.rigFrames;
const SNOW = [...REINDEER_ROAM.fx.snow.drag.frames, REINDEER_ROAM.fx.snow.kick.frame];

let pass = 0;
let fail = 0;
const check = (ok, msg, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail).slice(0, 700) : ''}`);
};
const info = (msg) => console.log(`INFO ${msg}`);
const mulberry = (a) => () => {
	a |= 0;
	a = (a + 0x6d2b79f5) | 0;
	let t = Math.imul(a ^ (a >>> 15), 1 | a);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const r1 = (v) => Math.round(v * 10) / 10;

/** THE OLD RULE (planWindup before 2026-11-21, copied as it was): the hit on the first hop in the window, or its own pace */
const oldPlan = (start, setOff, hops, quick) => {
	if (quick) return { clip: 'chargeDown', start, setOff, k: 1, hop: null, hitAt: null, at: Array.from({ length: REINDEER_ROAM.clips.chargeDown.rigFrames }, (_, i) => start + i * FR) };
	const sorted = [...hops].map((h) => h - start).sort((a, b) => a - b);
	const h = sorted.find((d) => d >= LO * TH - 1e-6 && d <= HI * TH + 1e-6) ?? null;
	const k = h === null ? 1 : h / TH;
	const at = Array.from({ length: N }, (_, j) => (j + 1 <= CHARGE_HIT ? start + j * FR * k : start + TH * k + (j + 1 - CHARGE_HIT) * FR));
	return { clip: 'charge', start, setOff, k, hop: h === null ? null : start + h, hitAt: at[CHARGE_HIT - 1], at };
};

/** HOW ROAM DRAWS IT (Roam.alert, then Roam.update each frame): `steps` board ms per frame (a function of the frame's
 *  index), `phase` board ms from the strike's start to the first frame. Returns the frames drawn standing (before the set
 *  off), and the index of the frame he goes on (the first at or past the set off) */
const drawn = (plan, steps, phase) => {
	const shown = [];
	let hitShown = false;
	let clock = plan.start + phase;
	for (let i = 0; i < 400; i++) {
		if (clock >= plan.setOff) return { shown, goneOn: i, goneAt: clock };
		let f = windupFrame(plan, clock);
		if (plan.clip === 'charge' && !hitShown && f >= CHARGE_HIT) {
			f = CHARGE_HIT;
			hitShown = true;
		}
		shown.push(f);
		clock += steps(i);
	}
	return { shown, goneOn: -1, goneAt: clock };
};

// THE STEP PATTERNS (board ms per frame; the rates are constants ROAD_MOTION's)
const T1 = ROAD_MOTION.turbo1.rate;
const T2 = ROAD_MOTION.turbo2.rate;
const HU = ROAD_MOTION.hurryRate;
const F60 = 1000 / 60;
const F30 = 1000 / 30;
const steady = (ms) => () => ms;
/** a change in mid strike after `n` frames */
const change = (a, b, n) => (i) => (i < n ? a : b);
const PATTERNS = [
	{ name: `120 Hz regular (${r1(1000 / 120)} ms)`, max: 1000 / 120, at: () => steady(1000 / 120) },
	{ name: `60 Hz regular (${r1(F60)} ms)`, max: F60, at: () => steady(F60) },
	{ name: `60 Hz Turbo 1 (${r1(F60 * T1)} ms)`, max: F60 * T1, at: () => steady(F60 * T1) },
	{ name: `30 Hz regular (${r1(F30)} ms)`, max: F30, at: () => steady(F30) },
	{ name: `60 Hz Turbo 2 steady (${r1(F60 * T2)} ms)`, max: F60 * T2, at: () => steady(F60 * T2) },
	{ name: `60 Hz a slam's hurry steady (${r1(F60 * HU)} ms)`, max: F60 * HU, at: () => steady(F60 * HU) },
	{ name: `30 Hz Turbo 1 (${r1(F30 * T1)} ms)`, max: F30 * T1, at: () => steady(F30 * T1) },
	{ name: `60 Hz regular, Turbo 2 from mid strike (${r1(F60)} then ${r1(F60 * T2)} ms)`, max: F60 * T2, at: (rnd) => change(F60, F60 * T2, Math.floor(rnd() * 40)) },
	{ name: `60 Hz Turbo 1, Turbo 2 from mid strike (${r1(F60 * T1)} then ${r1(F60 * T2)} ms)`, max: F60 * T2, at: (rnd) => change(F60 * T1, F60 * T2, Math.floor(rnd() * 30)) },
	{ name: `60 Hz regular, a slam's hurry from mid strike (${r1(F60)} then ${r1(F60 * HU)} ms)`, max: F60 * HU, at: (rnd) => change(F60, F60 * HU, Math.floor(rnd() * 40)) },
	{ name: `30 Hz regular, Turbo 1 from mid strike (${r1(F30)} then ${r1(F30 * T1)} ms)`, max: F30 * T1, at: (rnd) => change(F30, F30 * T1, Math.floor(rnd() * 20)) },
	{ name: `mixed 16.7 to 56.7 ms, random per frame`, max: F30 * T1, at: (rnd) => { const s = Array.from({ length: 400 }, () => F60 + rnd() * (F30 * T1 - F60)); return (i) => s[i]; } },
];
// (longer than the margin: information only)
const BEYOND = [
	{ name: `30 Hz regular, Turbo 2 from mid strike (${r1(F30)} then ${r1(F30 * T2)} ms)`, at: (rnd) => change(F30, F30 * T2, Math.floor(rnd() * 20)) },
	{ name: `30 Hz regular, a slam's hurry from mid strike (${r1(F30)} then ${r1(F30 * HU)} ms)`, at: (rnd) => change(F30, F30 * HU, Math.floor(rnd() * 20)) },
	{ name: `60 Hz regular, one dropped frame of 100 ms at a random frame`, at: (rnd) => { const n = Math.floor(rnd() * 30); return (i) => (i === n ? 100 : F60); } },
];

check(M >= F30 * T1 && M >= F60 * T2 && M >= F60 * HU, `hitMarginMs ${M} covers the longest slow drag steps named (Turbo 1 at 30 Hz ${r1(F30 * T1)}, a hurry from mid strike ${r1(F60 * HU)}, Turbo 2 from mid strike ${r1(F60 * T2)} ms)`);
check(M < F30 * T2, `hitMarginMs ${M} is one long frame, not more (under Turbo 2's ${r1(F30 * T2)} ms on a 30 Hz screen): a ${CROSSHAIR.leadMs} ms stand's hit moves only for a hop later than ${r1(CROSSHAIR.leadMs - M)} ms, by ${r1(HI * TH - (CROSSHAIR.leadMs - M))} ms at most`);

// THE HOPS the hit can take: none (its own pace), each time in the window, and some outside it (ignored)
const HOPSETS = [[]];
for (let d = LO * TH; d <= HI * TH + 1e-9; d += 2) HOPSETS.push([d]);
HOPSETS.push([HI * TH]);
HOPSETS.push([LO * TH]);
HOPSETS.push([LO * TH - 20, 300, 900]);
HOPSETS.push([HI * TH + 30, 120]);
HOPSETS.push([500, 40, 330]);
// THE STANDS: below zero to past any real one (CROSSHAIR.leadMs 420 or STRIKE.leadInMs plus waitMs), 1 ms apart, and the
// edges at hitMarginMs and at the old latest hit plus hitMarginMs
const STANDS = [];
for (let s = -60; s <= 1300; s += 1) STANDS.push(s);
for (const s of [M - 1e-3, M, M + 1e-3, TH + M - 1e-3, TH + M, TH + M + 1e-3, HI * TH + M - 1e-3, HI * TH + M, HI * TH + M + 1e-3, CROSSHAIR.leadMs, STRIKE.leadInMs]) STANDS.push(s);

const rnd = mulberry(20261121);
const PHASES = 3;
const per = PATTERNS.map(() => ({ runs: 0, miss: [], noneShown: 0, wrongGone: [], oldMiss: 0, oldMissLead: 0 }));
const beyond = BEYOND.map(() => ({ runs: 0, miss: 0, oldMiss: 0, stands: new Set() }));
let plans = 0;
let roomy = 0;
let tight = 0;
let maxEarly = 0;
let maxEarlyCase = null;
const tightByStand = { neg: 0, short: 0, mid: 0, lead: 0 };
const roomBad = [];
const roomyBad = [];
const tightBad = [];
const orderBad = [];
const setOffBad = [];
const snowBad = [];
const detBad = [];
let tightInLeadRange = 0;
let tightInLeadMax = 0;

for (const hops of HOPSETS) {
	for (const stand of STANDS) {
		const start = 10000 + rnd() * 50000;
		const setOff = start + stand;
		const absHops = hops.map((d) => start + d);
		const P = planWindup(start, setOff, absHops, false);
		const O = oldPlan(start, setOff, absHops, false);
		plans++;
		// 7. deterministic: again, and with the hops in another order
		const P2 = planWindup(start, setOff, [...absHops].reverse(), false);
		if (JSON.stringify(P) !== JSON.stringify(P2)) detBad.push({ stand, hops });
		// 3. the set off as given
		if (P.setOff !== setOff || P.start !== start) setOffBad.push({ stand, hops });
		// 2. the room
		const hitOff = P.hitAt - start;
		const latest = Math.max(0, stand - M);
		if (hitOff > latest + 1e-6 || hitOff < -1e-9) roomBad.push({ stand, hops, hitOff, latest });
		for (let i = 1; i < N; i++) if (P.at[i] < P.at[i - 1] - 1e-9) orderBad.push({ stand, hops, i });
		const oldOff = O.hitAt - start;
		if (oldOff <= latest + 1e-6) {
			// 4. it had the room: the old plan exactly
			roomy++;
			if (!(P.k === O.k && P.hop === O.hop && P.early === 0 && P.at.every((t, i) => t === O.at[i]))) roomyBad.push({ stand, hops, P, O });
		} else {
			// 5. tight: moved to the latest (or the start), the frames after it at the rig's pace
			tight++;
			const okMove = Math.abs(hitOff - latest) < 1e-6 && Math.abs(P.early - (oldOff - latest)) < 1e-6 && P.hop === null && P.at.slice(CHARGE_HIT).every((t, j) => Math.abs(t - (P.hitAt + (j + 1) * FR)) < 1e-6);
			if (!okMove) tightBad.push({ stand, hops, hitOff, latest, early: P.early, oldOff });
			if (P.early > maxEarly) {
				maxEarly = P.early;
				maxEarlyCase = { stand, hops: hops.map(r1), old: r1(oldOff), now: r1(hitOff) };
			}
			if (stand <= 0) tightByStand.neg++;
			else if (stand <= M) tightByStand.short++;
			else if (stand < CROSSHAIR.leadMs) tightByStand.mid++;
			else tightByStand.lead++;
			if (stand >= CROSSHAIR.leadMs) {
				tightInLeadRange++;
				tightInLeadMax = Math.max(tightInLeadMax, P.early);
			}
		}
		// 8. what follows the hit: the snow frames before the set off at the new plan's times; the lock's puff frame
		const due = SNOW.filter((f) => P.at[f - 1] < setOff);
		const snow = due.map((f) => P.at[f - 1]);
		const snowOld = SNOW.filter((f) => O.at[f - 1] < setOff).map((f) => O.at[f - 1]);
		const fromHit = due.every((f, i) => Math.abs(snow[i] - (P.hitAt + (f - CHARGE_HIT) * FR)) < 1e-6);
		if (oldOff <= latest + 1e-6 ? JSON.stringify(snow) !== JSON.stringify(snowOld) : !fromHit) snowBad.push({ stand, hops, due, snow });
		// (the lock's puff: the nose of windupFrame at the lock, on the new plan)
		const lockAt = start + rnd() * Math.max(1, stand + 200);
		const pf = windupFrame(P, lockAt);
		if (!(pf >= 1 && pf <= N && (lockAt < P.hitAt - 1e-6 ? pf < CHARGE_HIT : pf >= CHARGE_HIT))) snowBad.push({ stand, hops, lockAt, pf, why: 'puff frame' });
		// 1 and 3. drawn at every step pattern and phase
		PATTERNS.forEach((pat, pi) => {
			for (let q = 0; q < PHASES; q++) {
				const steps = pat.at(rnd);
				const s0 = steps(0);
				const phase = q === 0 ? 0 : q === 1 ? s0 : rnd() * s0;
				const d = drawn(P, steps, phase);
				const dOld = drawn(O, steps, phase);
				const R = per[pi];
				R.runs++;
				if (d.goneOn !== dOld.goneOn || d.goneAt !== dOld.goneAt) R.wrongGone.push({ stand, hops, phase });
				// (the old plan, for the record: a stand drawn without its hit)
				if (dOld.shown.length && !dOld.shown.includes(CHARGE_HIT)) {
					R.oldMiss++;
					if (stand >= CROSSHAIR.leadMs) R.oldMissLead++;
				}
				if (d.shown.length === 0) {
					R.noneShown++;
					if (stand > pat.max + 1e-6) R.miss.push({ stand, hops, phase, why: 'nothing drawn' });
					continue;
				}
				const has9 = d.shown.includes(CHARGE_HIT);
				// (a stand of hitMarginMs or less: the hit at the start, so the first frame drawn is the hit)
				if (!has9 || (stand <= M && d.shown[0] !== CHARGE_HIT)) R.miss.push({ stand, hops, phase, shown: d.shown.join(' ') });
			}
		});
		BEYOND.forEach((pat, bi) => {
			for (let q = 0; q < 2; q++) {
				const steps = pat.at(rnd);
				const phase = rnd() * steps(0);
				const d = drawn(P, steps, phase);
				const dOld = drawn(O, steps, phase);
				beyond[bi].runs++;
				if (dOld.shown.length && !dOld.shown.includes(CHARGE_HIT)) beyond[bi].oldMiss++;
				if (d.shown.length && !d.shown.includes(CHARGE_HIT)) {
					beyond[bi].miss++;
					beyond[bi].stands.add(Math.round(stand));
				}
			}
		});
	}
}

check(detBad.length === 0, `7. deterministic: ${plans} plans the same again and with the hops in any order`, detBad.slice(0, 3));
check(setOffBad.length === 0, `3. every plan keeps the set off and the start it was given (${plans} plans)`, setOffBad.slice(0, 3));
check(roomBad.length === 0, `2. the hit never later than hitMarginMs (${M}) before the set off, never before the start (${plans} plans, stands ${STANDS[0]} to 1300 ms, ${HOPSETS.length} hop sets)`, roomBad.slice(0, 3));
check(orderBad.length === 0, `2. every plan's frames in order`, orderBad.slice(0, 3));
check(roomyBad.length === 0, `4. ${roomy} plans whose hit had the room are the old plan frame for frame (k, hop, all ${N} frame times)`, roomyBad.slice(0, 2));
check(tightBad.length === 0, `5. ${tight} tight plans: the hit moved exactly to the latest (or the start), off the hop, the frames after it at 30 fps from it`, tightBad.slice(0, 3));
check(snowBad.length === 0, `8. the kicked snow's frames before the set off (the old ones where there was room, from the new hit where it moved) and the lock's puff frame from the new plan`, snowBad.slice(0, 3));
PATTERNS.forEach((pat, pi) => {
	const R = per[pi];
	check(R.miss.length === 0, `1. ${pat.name}: frame 9 drawn before the set off in every case drawn (${R.runs} runs; ${R.noneShown} with a stand shorter than the first frame, nothing of him drawn standing, as before)`, R.miss.slice(0, 3));
	check(R.wrongGone.length === 0, `3. ${pat.name}: he goes on the same frame and board clock as with the old plan (${R.runs} runs)`, R.wrongGone.slice(0, 3));
});

// 6. Turbo 2 and a hurry from the start: as before
{
	let bad = 0;
	for (const stand of [-20, 0, 10, 60, 200, 420, 900]) {
		const P = planWindup(100, 100 + stand, [200, 330], true);
		const O = oldPlan(100, 100 + stand, [200, 330], true);
		const { early, ...rest } = P;
		if (early !== 0 || JSON.stringify(rest) !== JSON.stringify(O)) bad++;
	}
	check(bad === 0, `6. Turbo 2 or a hurry from the start: the head down only, the plan as before (no hit)`);
}

// windupFirstFrame (Roam.alert): frame 1, or the hit when it is at the start
{
	const a = planWindup(0, 420, [], false);
	const b = planWindup(0, 50, [], false);
	const c = planWindup(0, M, [300], false);
	const d = planWindup(0, 420, [], true);
	check(windupFirstFrame(a) === 1 && windupFirstFrame(b) === CHARGE_HIT && windupFirstFrame(c) === CHARGE_HIT && windupFirstFrame(d) === 1, `Roam.alert's first frame: 1 with room, the hit (9) for a stand of hitMarginMs or less, 1 for the head down`, [windupFirstFrame(a), windupFirstFrame(b), windupFirstFrame(c), windupFirstFrame(d)]);
}

// the cases that move, in the real range (a stand of CROSSHAIR.leadMs or more is every strike with waitMs >= 0)
info(`tight plans: ${tight} of ${plans} (stands <= 0: ${tightByStand.neg}, 0 to ${M}: ${tightByStand.short}, ${M} to ${CROSSHAIR.leadMs}: ${tightByStand.mid}, ${CROSSHAIR.leadMs} or more: ${tightByStand.lead})`);
info(`with a stand of ${CROSSHAIR.leadMs} ms or more (waitMs >= 0), ${tightInLeadRange} plans move, by ${r1(tightInLeadMax)} ms at most (a hop later than ${r1(CROSSHAIR.leadMs - M)} ms)`);
info(`the largest move of all: ${r1(maxEarly)} ms ${JSON.stringify(maxEarlyCase)}`);
PATTERNS.forEach((pat, pi) => info(`the old plan, ${pat.name}: ${per[pi].oldMiss} runs drew him standing without the hit (${per[pi].oldMissLead} with a stand of ${CROSSHAIR.leadMs} ms or more)`));
BEYOND.forEach((pat, bi) => {
	const B = beyond[bi];
	const st = [...B.stands].sort((a, b) => a - b);
	info(`beyond the margin, ${pat.name}: ${B.miss} of ${B.runs} runs drew no hit (stands ${st.length ? `${st[0]} to ${st[st.length - 1]}` : 'none'} ms; the old plan ${B.oldMiss})`);
});

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
