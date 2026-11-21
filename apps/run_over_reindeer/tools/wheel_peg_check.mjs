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
//   4. REST: REST_AFTER_S after the stop the pin is straight (|phi| at most REST_DEG, no stud on it). Until 2026-11-21 it
//      could instead be LEANING on a stud: in contact with its side (the gap between the flapper's outline and the stud's
//      circle within LEAN_GAP wheel units), and still (over its last REST_STILL_S it moved less than STILL_DEG); since
//      THE STOP'S RELEASE (Corey: "Give the pin spring in those cases, so it rolls back inward towards the wedge") a lean
//      is a fail. From rest it never turns before a stud touches it (the stop's extremes, +-0.3 of a wedge, are run on
//      purpose every other spin)
//      (2026-11-21) and the browser probe's rest rule: once inside REST_DEG for a whole ring of the spring, it never
//      turns over REST_DEG without a stud on it, the free ring after the last stud included; a kick given with no stud
//      near is caught (the rule's own test)
//   5. NO JAM: a stud never fails to push the flapper out
//   6. FRAME RATE: the same spins at every frame step give the same picture (reported: the largest swing's spread against
//      the 8 ms run)
//   7. THE STOP'S RELEASE (2026-11-21; game/road/wheelPeg.ts pegReleaseDeg): RELEASE_SPINS spins on every peg size, their
//      stops spread evenly over the whole stop range (+-0.3 of a wedge), at frame steps from 8 to 700 ms, each run twice
//      from the same start, without the release (the build before it) and with it: every stop that ended leaning has a
//      release and every stop that ended free has none and ends at the very same angle with the very same pin; with the
//      release every stop ends straight with no stud on it, the flapper is never inside a stud (from a second before the
//      curve's stop to the rest), the book's wedge is under the peg at least POINTER_MARGIN degrees from both its
//      dividers, a released stop's pointer went exactly its release deeper into the wedge (away from the divider it
//      rested by), the release is at most RELEASE_MAX_DEG degrees and RELEASE_MAX_MS long, no stud is met during it (no
//      tick) and none touches the flapper after it
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
const { stepPeg, pegRest, flapGap, studAt, pegReleaseDeg, pegReleaseTurn, pegReleaseMs, pegReleaseAngle } = await mod('road/wheelPeg.ts');
const { spinCurve, curveAt, curveLength, slotAtPeg, WHEEL_STEP } = await mod('superWheelPlan.ts');
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
// THE STOP'S RELEASE (section 7): spins per peg size; its bounds; the pointer's least distance from the wedge's dividers
// (the plan's stop is at most 0.3 of a wedge off the middle: 9 degrees from a divider); the flapper's allowed depth inside
// a stud (wheel units: stepPeg pushes it out to a millionth of a degree)
const RELEASE_SPINS = 480;
const RELEASE_MAX_DEG = 5;
const RELEASE_MAX_MS = 600;
const POINTER_MARGIN = 8.9;
const GAP_TOL = 1e-3;
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
	// THE STOP'S RELEASE (SUPER_WHEEL.peg.release); the comparisons below have none (their stops stay as they were)
	release: P0.release,
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

/** ONE RING of the spring (ms): 2 pi over the damped spring's speed (272 ms at stiffness 550, damping 8). A free swing over
 *  REST_DEG cannot stay inside REST_DEG that long, so a flapper quiet for a whole ring is truly at rest (the browser
 *  probe's rest rule, tools/wheel_probe.mjs pin) */
const ringMs = (P) => {
	const zeta = P.damping / (2 * Math.sqrt(P.stiffness));
	return (2 * Math.PI * 1000) / (Math.sqrt(P.stiffness) * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta)));
};
/** one spin: returns the studs passed, met and kicked, the ticks, the rest. kickAtS (the rule's own test only): that many
 *  seconds after the stop the flapper is given KICK_TEST degrees a second with no stud near, the untouched start the
 *  rest rule must catch */
const KICK_TEST = 30;
/** THE DISC'S TURN t seconds into a spin, as game/road/superWheel.ts spinAt turns it: the curve, then the stop's release
 *  (deg degrees on past the curve's stop; 0: none) */
const spinAt = (c, deg, R, t) => {
	const len = curveLength(c);
	if (deg <= 0 || t <= len) return c.from - curveAt(c, t);
	return c.from - curveAt(c, len) - pegReleaseTurn(deg, (t - len) * 1000, R);
};
const spin = (cfg, ps, frames, rnd, offForce, kickAtS) => {
	const G = geomOf(cfg, ps);
	// the wheel rests near a wedge's middle (it drifts there while it waits), then the book's stop
	const from = -WHEEL_STEP / 2 - Math.floor(rnd() * 8) * WHEEL_STEP - rnd() * 8;
	const plan = { at: Math.floor(rnd() * 8), off: offForce ?? rnd() * 0.6 - 0.3 };
	const c = spinCurve(from, plan, TIMES);
	// (the stop's release, when the build has one, as superWheel.ts adds it: the spin's stop is the release's end)
	const deg = cfg.release ? pegReleaseDeg(c.from - curveAt(c, curveLength(c)), G, cfg.params, cfg.release) : 0;
	const len = curveLength(c) + (cfg.release ? pegReleaseMs(deg, cfg.release) / 1000 : 0);
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
	// THE UNTOUCHED START over the whole spin and its rest: a frame turning over REST_DEG (its largest swing, maxAbs) with
	// no stud on it, none met in it and none within LEAN_GAP, after a whole ring of the spring inside REST_DEG
	const RING = ringMs(cfg.params);
	let quietSince = null;
	let untouched = 0;
	let kickGiven = false;
	// (a kick still to give runs on until a frame starts in its window: with 700 ms frames none may start in the last half
	// second; since the release moved some stops' end, 2026-11-21)
	while (t < len + REST_AFTER_S || (kickAtS !== undefined && !kickGiven)) {
		const dtMs = frames[fi++ % frames.length];
		const t0 = t;
		t += dtMs / 1000;
		if (kickAtS !== undefined && !kickGiven && t0 >= len + kickAtS) {
			F.v += KICK_TEST;
			kickGiven = true;
		}
		const path = (u) => spinAt(c, deg, cfg.release, Math.min(len, t0 + u * (t - t0)));
		const onBefore = F.onStud;
		const r = stepPeg(F, path, dtMs / 1000, G, cfg.params, (th, phi) => {
			const near = Math.round(-th / WHEEL_STEP);
			kick.set(near, Math.max(kick.get(near) ?? 0, Math.abs(phi)));
		});
		{
			let gap = Infinity;
			const k0 = Math.round(-F.theta / WHEEL_STEP);
			for (let k = k0 - 1; k <= k0 + 1; k++) {
				const [sx, sy] = studAt(k, F.theta, G);
				gap = Math.min(gap, flapGap(F.phi, sx, sy, G));
			}
			// (quiet up to this frame's start: a long frame's own time is not rest; a stud on it at the frame's start that
			// let go inside the frame is a touch)
			const quiet = r.maxAbs <= REST_DEG;
			if (!quiet && quietSince !== null && t0 * 1000 - quietSince >= RING && onBefore === null && r.on === null && r.contacts.length === 0 && gap > LEAN_GAP) untouched++;
			if (!quiet) quietSince = null;
			else if (quietSince === null) quietSince = t0 * 1000;
		}
		jams += r.jams;
		edge += r.edgeRelease;
		// the studs that pass while the wheel is fast (over 60% of its top speed)
		const speed = (spinAt(c, deg, cfg.release, Math.min(len, t0)) - spinAt(c, deg, cfg.release, Math.min(len, t))) / (t - t0);
		if (speed > 0.6 * c.vMax) fastStuds.add(Math.round(-spinAt(c, deg, cfg.release, Math.min(len, t)) / WHEEL_STEP));
		// the 60 drawn frames a second the page counted (only frames of 16.7 ms or less: the frame's end stands in)
		if (dtMs <= 16.7) {
			while (at60 <= t) {
				const near = Math.round(-spinAt(c, deg, cfg.release, Math.min(len, at60)) / WHEEL_STEP);
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
	const k1 = Math.floor(-(c.from - c.dTot - deg) / WHEEL_STEP);
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
		untouched,
		off: plan.off,
		release: deg,
	};
};

const run = (cfg, ps, frames, seed, n = SPINS, even = false, kickAtS) => {
	const rnd = mulberry(seed);
	const out = [];
	// (an even spread of stops over the wedge's whole range, or the extremes every other spin)
	for (let i = 0; i < n; i++) out.push(spin(cfg, ps, frames, rnd, even ? -0.3 + (0.6 * (i + 0.5)) / n : i % 4 === 0 ? 0.3 : i % 4 === 1 ? -0.3 : undefined, kickAtS));
	return out;
};
const sum = (a, f) => a.reduce((n, x) => n + f(x), 0);
const median = (v) => {
	const s = [...v].sort((a, b) => a - b);
	return s[Math.floor(s.length / 2)];
};
const r1 = (v) => Math.round(v * 10) / 10;
/** AT REST: straight with no stud on it (since the stop's release, 2026-11-21); leanOk the rule before it, a lean in
 *  contact and still also passing (the build without the release, reported for the notes) */
const restOk = (r) => Math.abs(r.rest) <= REST_DEG && r.restOn === null;
const leanOk = (r) => restOk(r) || (r.restOn !== null && r.restGap !== null && Math.abs(r.restGap) <= LEAN_GAP && r.restMove <= STILL_DEG);

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
		const released = res.filter((r) => r.release > 0);
		check(bad.length === 0 && leaning.length === 0, `${tag}: ${REST_AFTER_S} s after every stop straight with no stud on it (largest ${Math.max(0, ...res.filter((r) => r.restOn === null).map((r) => Math.abs(r.rest))).toFixed(3)} degrees; ${leaning.length} leaning; ${released.length} freed by the stop's release, ${released.length ? `${r1(Math.min(...released.map((r) => r.release)))} to ${r1(Math.max(...released.map((r) => r.release)))} degrees` : '-'}; ${sum(res, (r) => r.edge)} let go from a stud's top)`, bad.slice(0, 3).map((r) => ({ off: r.off, rest: r.rest, on: r.restOn, gap: r.restGap, move: r.restMove, release: r.release })));
		check(sum(res, (r) => r.jams) === 0 && Math.max(...res.map((r) => r.quietTurn)) === 0, `${tag}: no stud ever held at the largest swing, and no turn from rest before a contact`);
		check(sum(res, (r) => r.untouched) === 0, `${tag}: from rest (inside ${REST_DEG} degrees for a whole ring of the spring, ${r1(ringMs(BUILT.params))} ms) it never turns without a stud on it, the free ring after the last stud included (${sum(res, (r) => r.untouched)} frames)`);
		// the rule's own test: the same spins, each given a kick with no stud near 2.5 s after its stop (the release's end
		// when it has one); every one that stopped straight (a lean is in contact) must be caught
		if (layout && (fr[0] === 16.7 || fr === 'mixed')) {
			const kicked2 = run(BUILT, ps, frames, SEED0 + Math.round(ps * 1000), SPINS, false, 2.5);
			const straight = kicked2.filter((r) => r.restOn === null);
			const caught = straight.filter((r) => r.untouched > 0).length;
			check(straight.length > 0 && caught === straight.length, `${tag}: the rest rule catches an untouched start (${KICK_TEST} degrees a second given 2.5 s after the stop, no stud near): ${caught} of ${straight.length} straight stops`);
		}
		const spread = r1(Math.max(...res.map((r, i) => Math.abs(r.largest - base[i].largest))));
		check(Math.max(...big) <= BUILT.params.maxSwing + 1e-6, `${tag}: the largest swing per spin at most ${r1(Math.max(...big))} degrees (limit ${BUILT.params.maxSwing}); against 8 ms frames it differs by up to ${spread}`);
		if (fr[0] === 16.7) summary[ps] = { kickMedian: r1(median(kicks)), fastKickMedian: r1(median(res.flatMap((r) => r.fastKicks))), over8Pct: r1((100 * kicked) / passed), over30Pct: r1((100 * sum(res, (r) => r.over30)) / passed), drawnOver8Pct: r1((100 * sum(res, (r) => r.drawnKicked)) / passed), largestMedian: r1(median(big)), largestMax: r1(Math.max(...big)) };
	}
}
// 7. THE STOP'S RELEASE: one stop run without the release and with it, from the same start (they share every frame up
// to the release's first turn, holdMs after the curve's stop; from there each goes on alone)
const releaseStop = (ps, frames, from, plan) => {
	const G = geomOf(BUILT, ps);
	const P = BUILT.params;
	const R = BUILT.release;
	const c = spinCurve(from, plan, TIMES);
	const len = curveLength(c);
	const curveStop = c.from - curveAt(c, len);
	const deg = pegReleaseDeg(curveStop, G, P, R);
	const relMs = pegReleaseMs(deg, R);
	const gapAt = (th, phi) => {
		let g = Infinity;
		const k0 = Math.round(-th / WHEEL_STEP);
		for (let k = k0 - 1; k <= k0 + 1; k++) {
			const [sx, sy] = studAt(k, th, G);
			g = Math.min(g, flapGap(phi, sx, sy, G));
		}
		return g;
	};
	const F = pegRest(from);
	stepPeg(F, from, 0, G, P);
	let t = 0;
	let fi = 0;
	// (shared: frames that end before the release's first turn)
	const shareTo = len + R.holdMs / 1000;
	let minGap = Infinity;
	// (the lean moment: a piece of a step with the disc standing at the curve's stop, the release's hold, and a stud on
	// the flapper)
	let held = false;
	const watch = (t0) => (th, phi, on) => {
		if (t0 >= len - 1) minGap = Math.min(minGap, gapAt(th, phi));
		if (th === curveStop && on !== null) held = true;
	};
	while (t + frames[fi % frames.length] / 1000 <= shareTo) {
		const dt = frames[fi++ % frames.length] / 1000;
		const t0 = t;
		t += dt;
		stepPeg(F, (u) => c.from - curveAt(c, t0 + u * dt), dt, G, P, watch(t0));
	}
	const sharedMin = minGap;
	const sharedHeld = held;
	const branch = (withRelease) => {
		const B = { ...F };
		const d = withRelease ? deg : 0;
		const end = len + (withRelease ? relMs / 1000 : 0);
		let tt = t;
		let j = fi;
		minGap = sharedMin;
		held = sharedHeld;
		let during = 0;
		let after = 0;
		let thetaMoves = 0;
		let lastTheta = null;
		while (tt < end + REST_AFTER_S) {
			const dt = frames[j++ % frames.length] / 1000;
			const t0 = tt;
			tt += dt;
			const r = stepPeg(B, (u) => spinAt(c, d, R, Math.min(end, t0 + u * dt)), dt, G, P, watch(t0));
			// (contacts made inside the release: a stud first met while the disc rolls on; the stud already on the flapper
			// at the stop is not a new contact)
			if (t0 < end) during += r.contacts.length;
			if (t0 >= end && (r.on !== null || r.contacts.length)) after++;
			if (t0 >= end && lastTheta !== null && B.theta !== lastTheta) thetaMoves++;
			if (t0 >= end) lastTheta = B.theta;
		}
		return { theta: B.theta, phi: B.phi, on: B.onStud, v: B.v, minGap, during, after, thetaMoves, heldAtStop: held };
	};
	const before = branch(false);
	const now = branch(true);
	// the pointer (the disc's angle under the peg) against the book's wedge: its dividers at plan.at and plan.at + 1
	const ptr = (th) => ((-th % 360) + 360) % 360;
	const lowerOf = (th) => ptr(th) - plan.at * WHEEL_STEP;
	const lower = lowerOf(now.theta);
	const upper = WHEEL_STEP - lower;
	return { plan, deg, relMs, before, now, slot: slotAtPeg(now.theta), lower, upper, lowerBefore: lowerOf(before.theta), curveStop };
};
const relRows = {};
let relAll = 0;
for (const ps of PEG_SCALES) {
	const rnd = mulberry(SEED0 + 77 + Math.round(ps * 1000));
	const FR = [[16.7], [8], [33.3], MIXED, [100], [250], [700]];
	const res = [];
	for (let i = 0; i < RELEASE_SPINS; i++) {
		const from = -WHEEL_STEP / 2 - Math.floor(rnd() * 8) * WHEEL_STEP - rnd() * 8;
		// (an even spread of stops over the whole range, each in a wedge at random)
		const plan = { at: Math.floor(rnd() * 8), off: -0.3 + (0.6 * (i + 0.5)) / RELEASE_SPINS };
		res.push(releaseStop(ps, FR[i % FR.length], from, plan));
	}
	relAll += res.length;
	const tag = `release, pegScale ${ps}`;
	const leaned = res.filter((r) => r.before.on !== null);
	const free = res.filter((r) => r.before.on === null);
	const rel = res.filter((r) => r.deg > 0);
	check(leaned.every((r) => r.deg > 0) && free.every((r) => r.deg === 0), `${tag}: every stop that ended leaning without the release has one (${leaned.length} of ${res.length}, ${r1((100 * leaned.length) / res.length)}%, one in ${r1(res.length / Math.max(1, leaned.length))}), every free stop none (${free.length})`, [...leaned.filter((r) => r.deg <= 0), ...free.filter((r) => r.deg > 0)].slice(0, 3).map((r) => ({ off: r.plan.off, deg: r.deg, before: r.before })));
	check(free.every((r) => r.now.theta === r.before.theta && r.now.phi === r.before.phi && r.now.on === null), `${tag}: every free stop is exactly as before (the same final angle and the same pin, to the last bit)`, free.filter((r) => r.now.theta !== r.before.theta || r.now.phi !== r.before.phi).slice(0, 3).map((r) => ({ off: r.plan.off, a: r.before.theta, b: r.now.theta })));
	const notStraight = res.filter((r) => r.now.on !== null || Math.abs(r.now.phi) > REST_DEG);
	check(notStraight.length === 0, `${tag}: with the release every stop ends straight with no stud on it, ${REST_AFTER_S} s after its stop (largest ${Math.max(...res.map((r) => Math.abs(r.now.phi))).toFixed(4)} degrees; the leaning stops were ${leaned.length ? `${r1(Math.min(...leaned.map((r) => r.before.phi)))} to ${r1(Math.max(...leaned.map((r) => r.before.phi)))}` : '-'} degrees)`, notStraight.slice(0, 3).map((r) => ({ off: r.plan.off, deg: r.deg, now: r.now })));
	const deepest = Math.min(...res.map((r) => r.now.minGap));
	check(deepest >= -GAP_TOL, `${tag}: the flapper is never inside a stud, from a second before the curve's stop through the release to the rest (least gap ${deepest.toFixed(5)} wheel units)`, res.filter((r) => r.now.minGap < -GAP_TOL).slice(0, 3).map((r) => ({ off: r.plan.off, gap: r.now.minGap })));
	const wrong = res.filter((r) => r.slot !== r.plan.at || Math.min(r.lower, r.upper) < POINTER_MARGIN);
	check(wrong.length === 0, `${tag}: the book's wedge under the peg every time, at least ${POINTER_MARGIN} degrees from both its dividers (nearest ${r1(Math.min(...res.map((r) => Math.min(r.lower, r.upper))))}; the released stops now ${rel.length ? `${r1(Math.min(...rel.map((r) => r.lower)))} to ${r1(Math.max(...rel.map((r) => r.lower)))}` : '-'} degrees from the divider they rested by, ${rel.length ? `${r1(Math.min(...rel.map((r) => r.upper)))}` : '-'} or more from the other)`, wrong.slice(0, 3).map((r) => ({ off: r.plan.off, slot: r.slot, at: r.plan.at, lower: r.lower, upper: r.upper })));
	const inward = rel.filter((r) => Math.abs(r.lower - r.lowerBefore - r.deg) > 1e-6 || r.lower <= r.lowerBefore);
	check(inward.length === 0, `${tag}: a released stop's pointer goes exactly its release deeper into the wedge, away from the divider it rested by, never toward either divider`, inward.slice(0, 3).map((r) => ({ off: r.plan.off, deg: r.deg, lower: r.lower, before: r.lowerBefore })));
	const big = rel.filter((r) => r.deg > RELEASE_MAX_DEG || r.relMs > RELEASE_MAX_MS);
	check(big.length === 0, `${tag}: the release at most ${RELEASE_MAX_DEG} degrees and ${RELEASE_MAX_MS} ms (${rel.length ? `${r1(Math.min(...rel.map((r) => r.deg)))} to ${r1(Math.max(...rel.map((r) => r.deg)))} degrees` : '-'}, ${rel.length ? rel[0].relMs : 0} ms: held ${BUILT.release.holdMs}, rolled ${BUILT.release.rollMs})`, big.slice(0, 3).map((r) => ({ off: r.plan.off, deg: r.deg, ms: r.relMs })));
	const noisy = res.filter((r) => r.now.during > 0 || r.now.after > 0 || r.now.thetaMoves > 0);
	check(noisy.length === 0, `${tag}: no stud met during a release (no extra tick), none on the flapper after it, and the disc never moves after it`, noisy.slice(0, 3).map((r) => ({ off: r.plan.off, during: r.now.during, after: r.now.after, moves: r.now.thetaMoves })));
	check(rel.every((r) => r.now.heldAtStop), `${tag}: the lean moment stays: every released stop arrives with the stud holding the flapper, then rolls it free`, rel.filter((r) => !r.now.heldAtStop).slice(0, 3).map((r) => r.plan.off));
	relRows[ps] = { leaningBeforePct: r1((100 * leaned.length) / res.length), releaseDeg: rel.length ? [r1(Math.min(...rel.map((r) => r.deg))), r1(Math.max(...rel.map((r) => r.deg)))] : null, releaseMs: rel.length ? rel[0].relMs : 0, releaseAngle: r1(pegReleaseAngle(geomOf(BUILT, ps), BUILT.params.maxSwing)), pointerFromDivider: rel.length ? [r1(Math.min(...rel.map((r) => r.lowerBefore))), r1(Math.max(...rel.map((r) => r.lowerBefore))), r1(Math.min(...rel.map((r) => r.lower))), r1(Math.max(...rel.map((r) => r.lower)))] : null };
}
// THE STOPS OVER THE WEDGES' WHOLE RANGE (an even spread, +-0.3 of a wedge): how often a stop ends leaning, at what angle
const leanRows = {};
// (the built peg before the stop's release, without it: how often a stop leaned; and with it)
const BEFORE = { ...BUILT, name: 'built without the release', release: null };
for (const cfg of [BEFORE, BUILT, SHALLOW]) {
	for (const ps of [0.798, 0.789]) {
		const res = run(cfg, ps, [16.7], SEED0 + 7, 120, true);
		const lean = res.filter((r) => r.restOn !== null);
		const rel = res.filter((r) => r.release > 0);
		leanRows[`${cfg.name} ${ps}`] = { leaningPct: r1((100 * lean.length) / res.length), angles: lean.length ? [r1(Math.min(...lean.map((r) => Math.abs(r.rest)))), r1(Math.max(...lean.map((r) => Math.abs(r.rest))))] : null, releasedPct: r1((100 * rel.length) / res.length), allRestOk: res.every(cfg === BEFORE ? leanOk : restOk) };
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
console.log(`SUMMARY the stop's release (${relAll} stops, each run without and with it; pointerFromDivider: before, then after, least and most degrees):`, JSON.stringify(relRows));
console.log('SUMMARY comparisons (16.7 ms frames):', JSON.stringify(compare));
console.log(`${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
