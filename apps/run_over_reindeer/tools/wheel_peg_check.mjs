// @ts-nocheck: a node check script, not app code (svelte-check picks up .mjs files)
// THE SUPER WHEEL'S PEG CHECK (2026-11-20, the layout page round 3 built: whole flapper contact, the flick on release,
// the flapper 1.22 long). Node only, no browser: it steps the game's own peg (src/game/road/wheelPeg.ts) with the game's
// own constants (SUPER_WHEEL.peg), geometry (superWheelSpec.ts: the studs, the tip's radius, the flapper's art length)
// and spin curve (superWheelPlan.ts spinCurve, curveAt, as superWheel.ts drives it), through random spins at frame steps
// from 8 to 700 ms (fixed, and mixed at random), on every layout's peg size (pegScale x SUPER_WHEEL.peg.size), and checks:
//   1. CONTACT: every stud that crosses the top in a spin meets the flapper (whole flapper contact)
//   2. KICKS: at least KICK_SHARE of the studs swing the pin more than KICK_DEG degrees while they pass (the brief: 90%)
//   3. TICKS: one per stud's first contact; through the game's gate (a tick sounds only tickMinMs or more after the last,
//      on the frame's clock as superWheel.ts tick() reads performance.now()) none is closer than tickMinMs, and every
//      contact sounds unless one sounded under tickMinMs before
//   4. REST: REST_AFTER_S after the stop the pin is straight (|phi| at most REST_DEG) with no stud on it, every spin
//      (a stop lands at least 9 degrees past a stud: superWheelPlan.ts, within 30% of its wedge's middle; the extremes
//      +-0.3 are run on purpose), and from rest it never turns before a stud touches it
//   5. NO JAM: a stud never fails to push the flapper out (held at its largest swing)
//   6. FRAME RATE: the same spins at every frame step give the same contacts and kicks (reported: the largest swing's
//      spread against the 8 ms run)
// It also reports, for the notes: the largest swing per spin (median, largest), the share of studs kicked over 8 degrees
// at 60 drawn frames a second (what the layout page counted), and the layout page's own default (flapper 0.65, tip
// reach 20, stiffness 350, damping 8, flick 0.3) through the same steps, for the comparison.
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
const { stepPeg, pegRest } = await mod('road/wheelPeg.ts');
const { spinCurve, curveAt, curveLength, WHEEL_STEP } = await mod('superWheelPlan.ts');
const { SUPER_WHEEL } = await mod('constants.ts');
const { SUPER_WHEEL_ART: ART } = await mod('superWheelSpec.ts');

const KICK_DEG = 8;
const KICK_SHARE = 0.9;
const REST_AFTER_S = 2.5;
const REST_DEG = 0.05;
const SPINS = 48;
// the spins' seed (PEG_SEED=<n> runs other spins; the pass is made with the default)
const SEED0 = Number(process.env.PEG_SEED ?? 1000);
// the layouts' pegScale (Board.svelte wheelGeoOf, read in the browser 2026-11-20: sideways 844x390, 390x844, desktop
// 1440x900, 360x560) and 1, the largest it can be
const PEG_SCALES = [0.772, 0.789, 0.798, 0.83, 1];
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
	size: P0.size,
	params: { stiffness: P0.stiffness, damping: P0.damping, fling: P0.fling, maxSwing: P0.maxSwing, subDeg: P0.subDeg, springStepS: P0.springStepMs / 1000, flingMax: P0.flingMax },
};
// PEG_TRY='{"stiffness":700,"fling":0.95}' tries other numbers over the constants (the builder's tuning; never in a pass)
if (process.env.PEG_TRY) Object.assign(BUILT.params, JSON.parse(process.env.PEG_TRY));
// the layout page's round 3 default (its app.js R3): flapper 0.65 of the 1.0 art, tip reach 20 into the studs
const ART1 = ART.pegFit.flap.tipBelowBoltUnits / ART.flap.length;
const PAGE = { name: 'page 0.65', tipR: U.stud + U.studOut - 20, boltTip: 165 * 0.65, artTip: ART1 * 0.65, size: 1.11, params: { ...BUILT.params, stiffness: 350, damping: 8, fling: 0.3, maxSwing: 60 } };

/** one spin: returns the studs passed, met and kicked, the ticks, the rest */
const spin = (cfg, ps, frames, rnd, offForce) => {
	const s = ps * cfg.size;
	const G = { L: cfg.artTip * s, by: -(cfg.tipR + cfg.boltTip * s), rc: U.studOut + P0.tipRadius, studR: U.stud, step: WHEEL_STEP };
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
	const met = new Set();
	const ticks = [];
	let contacts = 0;
	let unheard = 0;
	let lastTick = -Infinity;
	let largest = 0;
	let jams = 0;
	let t = 0;
	let fi = 0;
	let at60 = 1 / 60;
	while (t < len + REST_AFTER_S) {
		const dtMs = frames[fi++ % frames.length];
		const t0 = t;
		t += dtMs / 1000;
		const path = (u) => c.from - curveAt(c, Math.min(len, t0 + (u * (t - t0))));
		let subT = 0;
		const nSub = { n: 0 };
		const r = stepPeg(F, path, dtMs / 1000, G, cfg.params, (th, phi) => {
			nSub.n++;
			const near = Math.round(-th / WHEEL_STEP);
			kick.set(near, Math.max(kick.get(near) ?? 0, Math.abs(phi)));
		});
		jams += r.jams;
		// the 60 drawn frames a second the page counted: the swing at each 1/60 s boundary inside this frame (the frame's end
		// stands in for it: only frames of 16.7 ms or less are counted)
		if (dtMs <= 16.7) {
			while (at60 <= t) {
				const near = Math.round(-(c.from - curveAt(c, Math.min(len, at60))) / WHEEL_STEP);
				drawn.set(near, Math.max(drawn.get(near) ?? 0, Math.abs(F.phi)));
				at60 += 1 / 60;
			}
		}
		if (t0 < len) largest = Math.max(largest, r.maxAbs);
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
		void subT;
	}
	const k0 = Math.floor(-c.from / WHEEL_STEP);
	const k1 = Math.floor(-(c.from - c.dTot) / WHEEL_STEP);
	const passed = [];
	for (let k = k0 + 1; k <= k1; k++) passed.push(k);
	const gaps = ticks.slice(1).map((v, i) => v - ticks[i]);
	return {
		passed: passed.length,
		met: passed.filter((k) => met.has(k)).length,
		kicked: passed.filter((k) => (kick.get(k) ?? 0) > KICK_DEG).length,
		kicks: passed.map((k) => kick.get(k) ?? 0),
		drawnKicked: passed.filter((k) => (drawn.get(k) ?? 0) > KICK_DEG).length,
		drawnSeen: drawn.size > 0,
		ticks: ticks.length,
		contacts,
		unheard,
		minGap: gaps.length ? Math.min(...gaps) : Infinity,
		rest: Math.abs(F.phi),
		restOn: F.onStud,
		largest,
		jams,
		quietTurn,
		off: plan.off,
	};
};

const run = (cfg, ps, frames, seed) => {
	const rnd = mulberry(seed);
	const out = [];
	for (let i = 0; i < SPINS; i++) out.push(spin(cfg, ps, frames, rnd, i % 4 === 0 ? 0.3 : i % 4 === 1 ? -0.3 : undefined));
	return out;
};
const sum = (a, f) => a.reduce((n, x) => n + f(x), 0);
const median = (v) => {
	const s = [...v].sort((a, b) => a - b);
	return s[Math.floor(s.length / 2)];
};
const r1 = (v) => Math.round(v * 10) / 10;

console.log(`the peg: flapper ${ART.flap.length} of its art (${r1(BUILT.artTip)} units at pegScale 1), tip at radius ${U.peg.tipR} (${ART.units.peg.bite} inside the studs' outer edge ${r1(U.stud + U.studOut)}), stiffness ${P0.stiffness}, damping ${P0.damping}, flick ${P0.fling}, largest swing ${P0.maxSwing}; ${SPINS} spins per row, the stop's extremes (+-0.3 of a wedge, 9 degrees past a stud) every other spin`);
const summary = {};
for (const ps of PEG_SCALES) {
	const base = run(BUILT, ps, [8], SEED0 + Math.round(ps * 1000));
	for (const fr of FRAMES) {
		const frames = fr === 'mixed' ? MIXED : fr;
		const tag = `pegScale ${ps}, frames ${fr === 'mixed' ? 'mixed 8 to 700' : fr[0]} ms`;
		const res = fr[0] === 8 ? base : run(BUILT, ps, frames, SEED0 + Math.round(ps * 1000));
		const passed = sum(res, (r) => r.passed);
		const met = sum(res, (r) => r.met);
		const kicked = sum(res, (r) => r.kicked);
		check(met === passed, `${tag}: every stud that crossed the top met the flapper (${met} of ${passed})`);
		check(kicked >= KICK_SHARE * passed, `${tag}: studs that swung the pin over ${KICK_DEG} degrees ${kicked} of ${passed} (${r1((100 * kicked) / passed)}%, at least ${KICK_SHARE * 100}%)`);
		const minGap = Math.min(...res.map((r) => r.minGap));
		const contacts = sum(res, (r) => r.contacts);
		const ticks = sum(res, (r) => r.ticks);
		check(minGap >= SUPER_WHEEL.sound.tickMinMs - 1e-6, `${tag}: ${ticks} ticks for ${contacts} contacts, none closer than ${SUPER_WHEEL.sound.tickMinMs} ms (closest ${r1(minGap)} ms), ${sum(res, (r) => r.unheard)} inside the gate`);
		const badRest = res.filter((r) => r.rest > REST_DEG || r.restOn !== null);
		check(badRest.length === 0, `${tag}: straight at rest ${REST_AFTER_S} s after every stop (largest ${Math.max(...res.map((r) => r.rest)).toFixed(3)} degrees), no stud on it`, badRest.slice(0, 3).map((r) => ({ off: r.off, rest: r.rest, on: r.restOn })));
		check(sum(res, (r) => r.jams) === 0 && Math.max(...res.map((r) => r.quietTurn)) === 0, `${tag}: no stud ever held at the largest swing, and no turn from rest before a contact`);
		const big = res.map((r) => r.largest);
		const spread = r1(Math.max(...res.map((r, i) => Math.abs(r.largest - base[i].largest))));
		check(Math.max(...big) <= P0.maxSwing + 1e-6, `${tag}: the largest swing per spin median ${r1(median(big))}, largest ${r1(Math.max(...big))} degrees (limit ${P0.maxSwing}); against 8 ms frames it differs by up to ${spread}`);
		if (fr[0] === 16.7) summary[ps] = { kickedPct: r1((100 * kicked) / passed), drawnPct: r1((100 * sum(res, (r) => r.drawnKicked)) / passed), largestMedian: r1(median(big)), largestMax: r1(Math.max(...big)), kickMedian: r1(median(res.flatMap((r) => r.kicks))) };
	}
}
// THE COMPARISON (for the notes): the page's 0.65 default through the same steps (60 drawn frames a second)
const pageRows = {};
for (const ps of [0.798, 0.789]) {
	const res = run(PAGE, ps, [16.7], SEED0 + Math.round(ps * 1000));
	const passed = sum(res, (r) => r.passed);
	const big = res.map((r) => r.largest);
	pageRows[ps] = { kickedPct: r1((100 * sum(res, (r) => r.kicked)) / passed), drawnPct: r1((100 * sum(res, (r) => r.drawnKicked)) / passed), metPct: r1((100 * sum(res, (r) => r.met)) / passed), largestMedian: r1(median(big)), largestMax: r1(Math.max(...big)), kickMedian: r1(median(res.flatMap((r) => r.kicks))), restBad: res.filter((r) => r.rest > REST_DEG || r.restOn !== null).length };
}
console.log('SUMMARY built (16.7 ms frames):', JSON.stringify(summary));
console.log('SUMMARY page 0.65 default (16.7 ms frames):', JSON.stringify(pageRows));
console.log(`${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
