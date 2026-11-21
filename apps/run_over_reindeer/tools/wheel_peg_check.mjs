// @ts-nocheck: a node check script, not app code (svelte-check picks up .mjs files)
// THE SUPER WHEEL'S PEG CHECK (2026-11-20; the deeper pin, Corey: "Go deeper, by dropping lower I was trying to make it
// move more visibly"). Node only, no browser: it steps the game's own peg (src/game/road/wheelPeg.ts) with the game's own
// constants (SUPER_WHEEL.peg), geometry (superWheelSpec.ts: the studs, the tip's radius, the flapper's length and drawn
// outline) and spin curve (superWheelPlan.ts spinCurve, curveAt, as superWheel.ts drives it), through random spins at
// frame steps from 8 to 700 ms (fixed, and mixed at random), on every layout's peg size (pegScale x SUPER_WHEEL.peg.size),
// and checks:
//   1. CONTACT: every stud that crosses the top in a spin meets the flapper (its drawn outline)
//   2. KICKS: at least KICK_SHARE of the studs swing the pin more than KICK_DEG degrees while they pass; on the layouts'
//      pegs a stud's median kick is at least KICK_MEDIAN degrees and the median spin's largest swing is between LARGEST[0]
//      and LARGEST[1], never past maxSwing (the clear motion Corey asked for)
//   3. TICKS: one per stud's first contact; through the game's gate (a tick sounds only tickMinMs or more after the last,
//      on the frame's clock as superWheel.ts tick() reads performance.now()) none is closer than tickMinMs, and every
//      contact sounds unless one sounded under tickMinMs before
//   4. REST: REST_AFTER_S after the stop the pin is either straight (|phi| at most REST_DEG, no stud on it) or LEANING on
//      a stud: in contact with its side (the gap between the flapper's outline and the stud's circle within LEAN_GAP wheel
//      units: not hovering, not drawn into it), and still (no jitter, no creep: over its last REST_STILL_S it moves less
//      than STILL_DEG); from rest it never turns before a stud touches it (the stop's extremes, +-0.3 of a wedge, are run
//      on purpose every other spin)
//   5. NO JAM: a stud never fails to push the flapper out
//   6. FRAME RATE: the same spins at every frame step give the same picture (reported: the largest swing's spread against
//      the 8 ms run)
// It also reports, for the notes: the share of stops that end leaning over the eight wedges' whole stop range (an even
// spread of stops, +-0.3 of a wedge) and their lean angles, the kicks over 30 degrees, the kicks while the wheel is fast,
// the share kicked over 8 degrees at 60 drawn frames a second (what the layout page counted), and the same numbers for
// the shallow build (6a95d3b: tip 11 in, the centre line contact, stiffness 600, damping 6, flick 0.94) and the layout
// page's 0.65 default (tip 20 in, stiffness 350, damping 8, flick 0.3) through the same steps.
//   node --experimental-strip-types --no-warnings tools/wheel_peg_check.mjs      (from apps/run_over_reindeer)
// Pass: every line PASS, "0 fail" and exit 0.
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// the app's modules read import.meta.env (Vite): stood in as a production build's
register(
	'data:text/javascript,' +
		encodeURIComponent(`export async function load(u, c, n) {
	const r = await n(u, c);
	if (u.endsWith('.ts') && r.source) return { ...r, source: String(r.source).replaceAll('import.meta.env', '({ DEV: false })') };
	return r;
}`),
);
const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = (p) => import(pathToFileURL(join(APP, 'src', 'game', p)).href);
const { stepPeg, pegRest, flapGap, studAt } = await mod('road/wheelPeg.ts');
const { spinCurve, curveAt, curveLength, WHEEL_STEP } = await mod('superWheelPlan.ts');
const { SUPER_WHEEL } = await mod('constants.ts');
const { SUPER_WHEEL_ART: ART } = await mod('superWheelSpec.ts');

const KICK_DEG = 8;
const KICK_SHARE = 0.9;
const KICK_MEDIAN = 35;
const LARGEST = [45, 60];
const REST_AFTER_S = 3;
const REST_DEG = 0.05;
const LEAN_GAP = 0.05;
const REST_STILL_S = 1;
const STILL_DEG = 0.01;
const SPINS = 48;
// the spins' seed (PEG_SEED=<n> runs other spins; the pass is made with the default)
const SEED0 = Number(process.env.PEG_SEED ?? 1000);
// the layouts' pegScale (Board.svelte wheelGeoOf, read in the browser 2026-11-20: sideways 844x390, 390x844, desktop
// 1440x900, tablet 820x1180, 360x560), held to the motion targets; and 1, the largest it can be, held to the rest
const LAYOUT_SCALES = [0.772, 0.789, 0.798, 0.826, 0.83];
const PEG_SCALES = [...LAYOUT_SCALES, 1];
const FRAMES = [[8], [16.7], [33.3], [100], [250], [700], 'mixed'];
const MIXED = [8, 16.7, 12, 33.3, 700, 50, 100, 250, 8, 400, 16.7, 70];

let pass = 0;
let fail = 0;
const check = (ok, msg, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail).slice(0, 600) : ''}`);
};
const mulberry = (a) => () => {
	a |= 0;
	a = (a + 0x6d2b79f5) | 0;
	let t = Math.imul(a ^ (a >>> 15), 1 | a);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const T = SUPER_WHEEL.spin;
const TIMES = { driveMs: SUPER_WHEEL.run.driveMs, decelMs: T.decelMs, power: T.power, minDeg: T.minDeg, crawlDeg: T.crawlDeg, extraTurns: T.extraTurns };
const U = ART.units;
const P0 = SUPER_WHEEL.peg;
const BUILT = {
	name: 'built',
	tipR: U.peg.tipR,
	boltTip: U.peg.tip,
	artTip: ART.pegFit.flap.tipBelowBoltUnits,
	profile: ART.pegFit.flap.profile,
	size: P0.size,
	params: { stiffness: P0.stiffness, damping: P0.damping, fling: P0.fling, maxSwing: P0.maxSwing, subDeg: P0.subDeg, springStepS: P0.springStepMs / 1000, flingMax: P0.flingMax, edgeDeg: P0.edgeDeg },
};
// PEG_TRY='{"stiffness":700,"fling":1.3}' tries other numbers over the constants (the builder's tuning; never in a pass)
if (process.env.PEG_TRY) Object.assign(BUILT.params, JSON.parse(process.env.PEG_TRY));
// THE COMPARISONS (reported only): the shallow build 6a95d3b and the layout page's round 3 default (its app.js R3: the
// flapper 0.65 of the 1.0 art, tip reach 20 into the studs), both with the page's centre line contact
const ART1 = ART.pegFit.flap.tipBelowBoltUnits / ART.flap.length;
const LINE = { maxSwing: 60, subDeg: P0.subDeg, springStepS: P0.springStepMs / 1000, flingMax: P0.flingMax };
const SHALLOW = { name: 'shallow 6a95d3b', tipR: U.stud + U.studOut - 11, boltTip: U.peg.tip, artTip: ART.pegFit.flap.tipBelowBoltUnits, profile: null, size: 1.11, params: { ...LINE, stiffness: 600, damping: 6, fling: 0.94 } };
const PAGE = { name: 'page 0.65', tipR: U.stud + U.studOut - 20, boltTip: 165 * 0.65, artTip: ART1 * 0.65, profile: null, size: 1.11, params: { ...LINE, stiffness: 350, damping: 8, fling: 0.3 } };

const geomOf = (cfg, ps) => {
	const s = ps * cfg.size;
	const G = { L: cfg.artTip * s, by: -(cfg.tipR + cfg.boltTip * s), rc: U.studOut + P0.tipRadius, studR: U.stud, step: WHEEL_STEP };
	if (cfg.profile) Object.assign(G, { studOut: U.studOut, hw: cfg.profile.map((v) => v * s) });
	return G;
};

/** one spin: returns the studs passed, met and kicked, the ticks, the rest */
const spin = (cfg, ps, frames, rnd, offForce) => {
	const G = geomOf(cfg, ps);
	// the wheel rests near a wedge's middle (it drifts there while it waits), then the book's stop
	const from = -WHEEL_STEP / 2 - Math.floor(rnd() * 8) * WHEEL_STEP - rnd() * 8;
	const plan = { at: Math.floor(rnd() * 8), off: offForce ?? rnd() * 0.6 - 0.3 };
	const c = spinCurve(from, plan, TIMES);
	const len = curveLength(c);
	const F = pegRest(from);
	stepPeg(F, from, 0, G, cfg.params);
	// from rest, half a second before the spin: no turn without a stud on it
	let quietTurn = 0;
	for (let i = 0; i < 30; i++) {
		const r = stepPeg(F, from, 1 / 60, G, cfg.params);
		if (r.on === null) quietTurn = Math.max(quietTurn, Math.abs(F.phi));
	}
	const kick = new Map();
	const drawn = new Map();
	const fastStuds = new Set();
	const met = new Set();
	const ticks = [];
	let contacts = 0;
	let unheard = 0;
	let lastTick = -Infinity;
	let largest = 0;
	let jams = 0;
	let edge = 0;
	let t = 0;
	let fi = 0;
	let at60 = 1 / 60;
	const still = [];
	while (t < len + REST_AFTER_S) {
		const dtMs = frames[fi++ % frames.length];
		const t0 = t;
		t += dtMs / 1000;
		const path = (u) => c.from - curveAt(c, Math.min(len, t0 + u * (t - t0)));
		const r = stepPeg(F, path, dtMs / 1000, G, cfg.params, (th, phi) => {
			const near = Math.round(-th / WHEEL_STEP);
			kick.set(near, Math.max(kick.get(near) ?? 0, Math.abs(phi)));
		});
		jams += r.jams;
		edge += r.edgeRelease;
		// the studs that pass while the wheel is fast (over 60% of its top speed)
		const speed = (curveAt(c, Math.min(len, t)) - curveAt(c, Math.min(len, t0))) / (t - t0);
		if (speed > 0.6 * c.vMax) fastStuds.add(Math.round(-(c.from - curveAt(c, Math.min(len, t))) / WHEEL_STEP));
		// the 60 drawn frames a second the page counted (only frames of 16.7 ms or less: the frame's end stands in)
		if (dtMs <= 16.7) {
			while (at60 <= t) {
				const near = Math.round(-(c.from - curveAt(c, Math.min(len, at60))) / WHEEL_STEP);
				drawn.set(near, Math.max(drawn.get(near) ?? 0, Math.abs(F.phi)));
				at60 += 1 / 60;
			}
		}
		if (t0 < len) largest = Math.max(largest, r.maxAbs);
		if (t >= len + REST_AFTER_S - REST_STILL_S) still.push(F.phi);
		// the game's tick gate: performance.now() at the frame (its end here), tickMinMs of real time
		const now = t * 1000;
		for (const x of r.contacts) {
			met.add(x.stud);
			if (t0 >= len) continue;
			contacts++;
			if (now - lastTick >= SUPER_WHEEL.sound.tickMinMs) {
				ticks.push(now);
				lastTick = now;
			} else unheard++;
		}
	}
	const k0 = Math.floor(-c.from / WHEEL_STEP);
	const k1 = Math.floor(-(c.from - c.dTot) / WHEEL_STEP);
	const passed = [];
	for (let k = k0 + 1; k <= k1; k++) passed.push(k);
	const gaps = ticks.slice(1).map((v, i) => v - ticks[i]);
	let restGap = null;
	if (F.onStud !== null) {
		const [sx, sy] = studAt(F.onStud, F.theta, G);
		restGap = flapGap(F.phi, sx, sy, G);
	}
	return {
		passed: passed.length,
		met: passed.filter((k) => met.has(k)).length,
		kicked: passed.filter((k) => (kick.get(k) ?? 0) > KICK_DEG).length,
		over30: passed.filter((k) => (kick.get(k) ?? 0) > 30).length,
		kicks: passed.map((k) => kick.get(k) ?? 0),
		fastKicks: passed.filter((k) => fastStuds.has(k)).map((k) => kick.get(k) ?? 0),
		drawnKicked: passed.filter((k) => (drawn.get(k) ?? 0) > KICK_DEG).length,
		ticks: ticks.length,
		contacts,
		unheard,
		minGap: gaps.length ? Math.min(...gaps) : Infinity,
		rest: F.phi,
		restOn: F.onStud,
		restGap,
		restMove: still.length ? Math.max(...still) - Math.min(...still) : 0,
		largest,
		jams,
		edge,
		quietTurn,
		off: plan.off,
	};
};

const run = (cfg, ps, frames, seed, n = SPINS, even = false) => {
	const rnd = mulberry(seed);
	const out = [];
	// (an even spread of stops over the wedge's whole range, or the extremes every other spin)
	for (let i = 0; i < n; i++) out.push(spin(cfg, ps, frames, rnd, even ? -0.3 + (0.6 * (i + 0.5)) / n : i % 4 === 0 ? 0.3 : i % 4 === 1 ? -0.3 : undefined));
	return out;
};
const sum = (a, f) => a.reduce((n, x) => n + f(x), 0);
const median = (v) => {
	const s = [...v].sort((a, b) => a - b);
	return s[Math.floor(s.length / 2)];
};
const r1 = (v) => Math.round(v * 10) / 10;
const restOk = (r) => (Math.abs(r.rest) <= REST_DEG && r.restOn === null) || (r.restOn !== null && r.restGap !== null && Math.abs(r.restGap) <= LEAN_GAP && r.restMove <= STILL_DEG);

console.log(`the peg: flapper ${ART.flap.length} of its art (${r1(BUILT.artTip)} units at pegScale 1, its drawn outline in contact), tip at radius ${U.peg.tipR} (${ART.units.peg.bite} inside the studs' outer edge ${r1(U.stud + U.studOut)}), stiffness ${BUILT.params.stiffness}, damping ${BUILT.params.damping}, flick ${BUILT.params.fling}, largest swing ${BUILT.params.maxSwing}, edge ${BUILT.params.edgeDeg}; ${SPINS} spins per row, the stop's extremes (+-0.3 of a wedge, 9 degrees past a stud) every other spin`);
const summary = {};
for (const ps of PEG_SCALES) {
	const layout = LAYOUT_SCALES.includes(ps);
	const base = run(BUILT, ps, [8], SEED0 + Math.round(ps * 1000));
	for (const fr of FRAMES) {
		const frames = fr === 'mixed' ? MIXED : fr;
		const tag = `pegScale ${ps}, frames ${fr === 'mixed' ? 'mixed 8 to 700' : fr[0]} ms`;
		const res = fr[0] === 8 ? base : run(BUILT, ps, frames, SEED0 + Math.round(ps * 1000));
		const passed = sum(res, (r) => r.passed);
		const met = sum(res, (r) => r.met);
		const kicked = sum(res, (r) => r.kicked);
		const kicks = res.flatMap((r) => r.kicks);
		const big = res.map((r) => r.largest);
		check(met === passed, `${tag}: every stud that crossed the top met the flapper (${met} of ${passed})`);
		check(kicked >= KICK_SHARE * passed, `${tag}: studs that swung the pin over ${KICK_DEG} degrees ${kicked} of ${passed} (${r1((100 * kicked) / passed)}%, at least ${KICK_SHARE * 100}%)`);
		if (layout) {
			check(median(kicks) >= KICK_MEDIAN, `${tag}: a stud's kick, median ${r1(median(kicks))} degrees (at least ${KICK_MEDIAN}); over 30 degrees ${r1((100 * sum(res, (r) => r.over30)) / passed)}%`);
			check(median(big) >= LARGEST[0] && median(big) <= LARGEST[1], `${tag}: a spin's largest swing, median ${r1(median(big))} degrees (${LARGEST[0]} to ${LARGEST[1]})`);
		}
		const minGap = Math.min(...res.map((r) => r.minGap));
		const contacts = sum(res, (r) => r.contacts);
		const ticks = sum(res, (r) => r.ticks);
		check(minGap >= SUPER_WHEEL.sound.tickMinMs - 1e-6, `${tag}: ${ticks} ticks for ${contacts} contacts, none closer than ${SUPER_WHEEL.sound.tickMinMs} ms (closest ${r1(minGap)} ms), ${sum(res, (r) => r.unheard)} inside the gate`);
		const bad = res.filter((r) => !restOk(r));
		const leaning = res.filter((r) => r.restOn !== null);
		check(bad.length === 0, `${tag}: ${REST_AFTER_S} s after every stop straight (largest ${Math.max(0, ...res.filter((r) => r.restOn === null).map((r) => Math.abs(r.rest))).toFixed(3)} degrees) or leaning on a stud in contact and still (${leaning.length} leaning, ${leaning.length ? `${r1(Math.min(...leaning.map((r) => Math.abs(r.rest))))} to ${r1(Math.max(...leaning.map((r) => Math.abs(r.rest))))} degrees, gap within ${Math.max(...leaning.map((r) => Math.abs(r.restGap))).toFixed(4)} units, moving ${Math.max(...leaning.map((r) => r.restMove)).toFixed(5)} degrees in its last ${REST_STILL_S} s` : '-'}; ${sum(res, (r) => r.edge)} let go from a stud's top)`, bad.slice(0, 3).map((r) => ({ off: r.off, rest: r.rest, on: r.restOn, gap: r.restGap, move: r.restMove })));
		check(sum(res, (r) => r.jams) === 0 && Math.max(...res.map((r) => r.quietTurn)) === 0, `${tag}: no stud ever held at the largest swing, and no turn from rest before a contact`);
		const spread = r1(Math.max(...res.map((r, i) => Math.abs(r.largest - base[i].largest))));
		check(Math.max(...big) <= BUILT.params.maxSwing + 1e-6, `${tag}: the largest swing per spin at most ${r1(Math.max(...big))} degrees (limit ${BUILT.params.maxSwing}); against 8 ms frames it differs by up to ${spread}`);
		if (fr[0] === 16.7) summary[ps] = { kickMedian: r1(median(kicks)), fastKickMedian: r1(median(res.flatMap((r) => r.fastKicks))), over8Pct: r1((100 * kicked) / passed), over30Pct: r1((100 * sum(res, (r) => r.over30)) / passed), drawnOver8Pct: r1((100 * sum(res, (r) => r.drawnKicked)) / passed), largestMedian: r1(median(big)), largestMax: r1(Math.max(...big)) };
	}
}
// THE STOPS OVER THE WEDGES' WHOLE RANGE (an even spread, +-0.3 of a wedge): how often a stop ends leaning, at what angle
const leanRows = {};
for (const cfg of [BUILT, SHALLOW]) {
	for (const ps of [0.798, 0.789]) {
		const res = run(cfg, ps, [16.7], SEED0 + 7, 120, true);
		const lean = res.filter((r) => r.restOn !== null);
		leanRows[`${cfg.name} ${ps}`] = { leaningPct: r1((100 * lean.length) / res.length), angles: lean.length ? [r1(Math.min(...lean.map((r) => Math.abs(r.rest)))), r1(Math.max(...lean.map((r) => Math.abs(r.rest))))] : null, allRestOk: res.every(restOk) };
	}
}
// THE COMPARISONS (16.7 ms frames, the desktop and the upright phone's pegs)
const compare = {};
for (const cfg of [SHALLOW, PAGE]) {
	for (const ps of [0.798, 0.789]) {
		const res = run(cfg, ps, [16.7], SEED0 + Math.round(ps * 1000));
		const passed = sum(res, (r) => r.passed);
		const big = res.map((r) => r.largest);
		compare[`${cfg.name} ${ps}`] = { kickMedian: r1(median(res.flatMap((r) => r.kicks))), fastKickMedian: r1(median(res.flatMap((r) => r.fastKicks))), over8Pct: r1((100 * sum(res, (r) => r.kicked)) / passed), over30Pct: r1((100 * sum(res, (r) => r.over30)) / passed), metPct: r1((100 * sum(res, (r) => r.met)) / passed), largestMedian: r1(median(big)), largestMax: r1(Math.max(...big)) };
	}
}
console.log('SUMMARY built (16.7 ms frames):', JSON.stringify(summary));
console.log('SUMMARY stops leaning (an even spread over the stop range):', JSON.stringify(leanRows));
console.log('SUMMARY comparisons (16.7 ms frames):', JSON.stringify(compare));
console.log(`${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
