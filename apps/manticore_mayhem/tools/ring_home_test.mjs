// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// THE SPIN RING'S HOME POSE, A PURE TEST (no browser): src/ui/hud/ringPlan.ts (the ring's path and its brain, the same
// file the game runs) is driven through many simulated rounds the way HudSpin's tick drives it on the page, and every
// round's rest is checked against home.
//   node --experimental-strip-types --no-warnings tools/ring_home_test.mjs [ROUNDS=20000] [SEED=7]
// (Run Over Reindeer's tools/ring_home_test.mjs, copied with the ring's files.)
// The simulated board: a press (the ring winds up at once, as HudSpin's Play to Stop effect starts it), the board's own
// spin count a moment later, the board's rest learned some time in (here: the reveal's drop starts, game/stateGame
// revealPace) and the rest after it;
// a stop press at a random moment brings the rest forward (the board's hurry, 3x); back to back autoplay rounds (the
// next spin starts 0 to 30 ms after the board's rest, so the ring is often still braking), a bonus round on the
// thinned ring (its face rebuilt mid spin at the start), Turbo 0, 1 and 2, and reduced motion; a desktop hover's enter
// and leave at random moments (at rest, a press during a hover, a hover during the spin or the brake). Each round's
// frames come at one steady interval or a random one from 8 to 700 ms. Checked:
//   - every planned rest is home within 0.5 degrees (the art has no rotational symmetry, so home only), hovers' too
//   - ONE STANDING POSITION: on every frame where the ring is still and no hover is on, it is on home (0.5 degrees)
//   - THE BOUNCE on every arrival: 6 to 10 degrees past home, back over 180 to 260 ms (a hover's way back aside)
//   - forward only on the way home (a stop press's rush, every steered brake)
//   - THE WAY BACK (2026-11-21, Corey: "I would prefer it goes backwards in that one scenario"): every hover left with
//     no press turns back to home: its angle never above where it left, its travel the way back plus twice the settle
//     (not a turn on round), the settle at most 3 degrees short of home, all within 75 + 2 ms a degree (255 at most) + 90 ms (a full
//     quarter 345 ms); and the hover cases one by one (hoverCases below): a whole quarter, a leave mid turn, a hover
//     again on the way back, a press on the way back and a press during the hover (both forward into the spin)
//   - no brake longer than its bound: today's brake + 150 ms, a stop press today's stop + 250 ms, the bounce included
//     (the cruise steer; long and fixed are reported)
//   - BACK TO BACK SHORT ROUNDS (2026-11-21, the probe host: Super Turbo rounds of 417 ms left the ring still): runs of
//     rounds of 250 to 600 ms at each turbo level, the rest learned at any moment, the next start 0 to 400 ms after the
//     board's rest (so it lands in every phase of the arrival): the ring 10 degrees on within 400 ms of every start,
//     never still through a whole round, and the run's last rest on home
//   - the cruise speed within 40 % of the loop's
//   - the path never jumps (each piece starts where the last one is) and its speed never steps (but at a wind-up from
//     rest or a hover's start, as today, and where a forward-only brake starts from a ring winding back)
//   - the page's keyframes (linear between samples) follow the path within 0.25 degrees and end on home
//   - reduced motion: nothing is ever planned or drawn
import { RingCore, RingPath, ringMotion, RING_HOME, HOME_EXTRA_MS, STOP_EXTRA_MS, STEER_CAP, REST_METHODS, wrap180, HOVER_DEG, HOVER_MS, BACK_SETTLE_DEG, BACK_SETTLE_MS, backMs } from '../src/ui/hud/ringPlan.ts';

const N = +(process.env.ROUNDS || 20000);
let seed = +(process.env.SEED || 7);
const rnd = () => {
	seed |= 0;
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const U = (a, b) => a + (b - a) * rnd();
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const REGIMES = [8, 16.7, 33.3, 100, 250, 400, 700, 'jitter'];
const nextFrame = (t, reg) => t + (reg === 'jitter' ? U(8, 700) : reg);

let failCount = 0;
const fails = [];
const fail = (msg) => {
	failCount += 1;
	if (fails.length < 25) fails.push(msg);
};

/** the path's own checks on its current segments: no jump, no step in speed */
function checkPath(core, tag) {
	// (a piece cut to no length at a new plan's start is passed over: the pieces on either side of it meet)
	const S = core.path.segs.filter((s, i, all) => s.te > s.t0 || i === all.length - 1);
	for (let i = 1; i < S.length; i++) {
		const a = S[i - 1];
		const b = S[i];
		if (Math.abs(a.te - b.t0) > 1e-6) fail(`${tag}: piece ${i} starts at ${b.t0}, the last ended at ${a.te}`);
		const end = core.path.pos(b.t0 - 1e-7);
		if (Math.abs(end - b.a0) > 1e-3) fail(`${tag}: a jump of ${(b.a0 - end).toFixed(4)} degrees into piece ${i} (${b.k})`);
		if (b.k === 'bez') continue;
		const v0 = speedOf(a, b.t0);
		const v1 = speedOf(b, b.t0);
		// (THE WAY BACK starts from still wherever the quarter turn was: the turn back is the change of direction)
		if (a.k === 'bez' && b.k === 'herm' && b.m0 === 0 && b.d <= 0 && Math.abs(v1) < 1e-4) continue;
		// (a forward-only way home that starts while the ring winds back starts from still)
		if (v0 < 0 && Math.abs(v1) < 1e-4) continue;
		if (Math.abs(v1 - v0) > 1e-3 + 0.002 * Math.abs(core.v)) fail(`${tag}: a speed step of ${(v1 - v0).toFixed(5)} deg/ms into piece ${i} (${a.k} to ${b.k})`);
	}
}
function speedOf(seg, t) {
	// the piece's own speed at t (the path's vel() picks the piece by time; at a boundary we want each side's)
	const tmp = new RingPath();
	tmp.segs = [{ ...seg, te: seg.te + 1e-9 }];
	const e = 1e-4;
	return t <= seg.t0 + e ? tmp.vel(seg.t0 + e) : tmp.vel(Math.min(t, seg.te) - e);
}

/** THE WAY BACK as planned, from the leave at t: never above where it left, its travel about the way back (the way
 *  back plus twice the settle), ending home and still, within its time. Adds its numbers to W for the summary. */
const WAYBACK_TOL = 1e-6;
function checkWayBack(core, t, tag, W) {
	const P = core.path;
	const a0 = P.pos(t);
	const from = wrap180(a0 - RING_HOME);
	const end = P.end;
	const ms = end - t;
	let top = -Infinity;
	let travel = 0;
	let low = Infinity;
	let prev = a0;
	const n = 400;
	for (let i = 1; i <= n; i++) {
		const x = P.pos(t + (ms * i) / n);
		top = Math.max(top, x);
		low = Math.min(low, x - (a0 - from));
		travel += Math.abs(x - prev);
		prev = x;
	}
	const settle = Math.max(0, -low);
	const rest = wrap180(P.pos(end) - RING_HOME);
	const still = Math.abs(P.pos(end + 500) - P.pos(end));
	W.n += 1;
	W.msFull = Math.max(W.msFull, from > HOVER_DEG - 1 ? ms : 0);
	W.msMax = Math.max(W.msMax, ms);
	W.settleMax = Math.max(W.settleMax, settle);
	W.travelOff = Math.max(W.travelOff, Math.abs(travel - Math.abs(from) - 2 * settle));
	if (top > a0 + WAYBACK_TOL) fail(`${tag}: the way back rises ${(top - a0).toFixed(4)} degrees above where it left`);
	if (Math.abs(travel - Math.abs(from) - 2 * settle) > 0.01) fail(`${tag}: the way back travels ${travel.toFixed(2)} degrees from ${from.toFixed(2)} past home (settle ${settle.toFixed(2)})`);
	if (from > 0 && travel > 180) fail(`${tag}: the way back travels ${travel.toFixed(1)} degrees, a turn on round`);
	if (settle > BACK_SETTLE_DEG + 1e-6) fail(`${tag}: the settle runs ${settle.toFixed(2)} degrees short of home`);
	if (ms > backMs(from) + BACK_SETTLE_MS + 1e-6) fail(`${tag}: the way back takes ${ms.toFixed(0)} ms from ${from.toFixed(1)} degrees`);
	if (from >= HOVER_DEG - 1 && ms > 350) fail(`${tag}: a whole quarter's way back takes ${ms.toFixed(0)} ms (350 at most)`);
	if (Math.abs(rest) > 1e-6 || still > 1e-9) fail(`${tag}: the way back ends ${rest.toFixed(4)} degrees off home, moving ${still.toFixed(4)}`);
}

/** the page's keyframes against the path: the linear interpolation between samples within 0.25 degrees, the end home */
function checkKeyframes(core, now, tag, worst) {
	if (core.open || !Number.isFinite(core.path.end)) return;
	const base = pick([0, 40, 120, 317.3, -80]);
	const kf = core.path.keyframes(now, base);
	const t1 = core.path.end;
	const D = t1 - now;
	if (!(D > 0)) return;
	for (let i = 0; i < 60; i++) {
		const t = now + D * rnd();
		const x = (t - now) / D;
		let j = 1;
		while (j < kf.length - 1 && kf[j].offset < x) j++;
		const A = kf[j - 1];
		const B = kf[j];
		const w = B.offset > A.offset ? (x - A.offset) / (B.offset - A.offset) : 0;
		const lin = A.deg + (B.deg - A.deg) * w;
		const dev = Math.abs(lin - (core.path.pos(t) - base));
		worst.kf = Math.max(worst.kf, dev);
		if (dev > 0.25) fail(`${tag}: keyframes ${dev.toFixed(3)} degrees off the path at ${Math.round(t - now)} of ${Math.round(D)} ms`);
	}
	// (a hover's quarter turn ends where it holds while the pointer is over the key)
	if (core.hovering) return;
	const endDeg = kf[kf.length - 1].deg + base;
	const e = Math.abs(wrap180(endDeg - RING_HOME));
	if (e > 0.5) fail(`${tag}: the keyframes end ${e.toFixed(3)} degrees off home`);
}

function run(method) {
	const core = new RingCore();
	core.method = method;
	core.record = true;
	let now = 0;
	let serial = 0;
	core.lastSerial = 0;
	let hop = 0;
	const worst = { err: 0, over: -Infinity, overKind: '', steer: 0, kf: 0 };
	const tally = {};
	const byKind = {};
	const byTurbo = { 0: { n: 0, over: [] }, 1: { n: 0, over: [] }, 2: { n: 0, over: [] } };
	let checked = 0;
	let reducedRounds = 0;
	let unseen = 0;
	let stillChecks = 0;
	let widened = 0;
	const stopPeaks = [];
	const arrivals = { n: 0, grazes: 0, overMin: Infinity, overMax: 0, msMin: Infinity, msMax: 0, backMin: Infinity, stopMax: -Infinity, stopPast150: 0, stops: 0, stopPeak: 0, hovers: 0 };
	const wayBack = { n: 0, msFull: 0, msMax: 0, settleMax: 0, travelOff: 0 };
	let lastVersion = core.version;
	// THE PAGE: what the driver last drew (a copy of the path at each new version), kept through a face change that leaves
	// the same elements showing, gone with one that builds new ones (they stand at home)
	let page = null;
	let endChecks = 0;
	const drawn = () => (page = { segs: core.path.segs.map((x) => ({ ...x })), open: core.open });
	const pageAngle = (t) => {
		if (!page || !page.segs.length) return 0;
		const P = new RingPath();
		P.segs = page.segs;
		return P.pos(t);
	};
	let nextF = 0;
	let round = 0;
	while (round < N) {
		// ---- one session: a few single rounds, an autoplay run, or a bonus round ----
		// (resume: a reload into an unfinished round, the ring started by the board's count with the rest known at once;
		// bonus: a free spins round, its face rebuilt as it begins and ends, sometimes cut short by Skip)
		const kindRun = pick(['single', 'single', 'auto', 'bonus', 'reduced', 'resume']);
		const turbo = pick([0, 1, 2]);
		const reg = pick(REGIMES);
		const count = kindRun === 'single' || kindRun === 'resume' ? 1 : kindRun === 'reduced' ? 2 : Math.floor(U(3, 9));
		const reduced = kindRun === 'reduced';
		let t = now + U(200, 3000);
		for (let k = 0; k < count && round < N; k++, round++) {
			const M = ringMotion(turbo);
			const lead = M.brake + M.settle;
			// the round's own times (real ms): its press or pull away, the spin count, the rest learned, the board at rest
			const p = t;
			const pressed = kindRun === 'single' || kindRun === 'reduced' || (k === 0 && kindRun !== 'resume');
			const sAt = p + (pressed ? U(0, 60) : 0);
			const learn = kindRun === 'resume' ? p : p + U(30, [1500, 900, 500][turbo]);
			const driveIn = rnd() < 0.08 ? U(20, lead) : U([350, 220, 120][turbo], [2600, 1600, 800][turbo]);
			let restAt = learn + driveIn;
			const last = k === count - 1;
			// SKIP in a bonus round: the board jumps to its rest at once
			if (kindRun === 'bonus' && last && rnd() < 0.3) restAt = U(p + 20, restAt);
			// a stop press (only a pressed round can be stopped by the Spin; an autoplay round too: the run's Stop)
			const halt = !reduced && rnd() < 0.3 ? U(p + 10, restAt) : Infinity;
			if (halt < restAt) restAt = halt < learn ? learn + driveIn / 3 : halt + (restAt - halt) / 3;
			const faceAt = kindRun === 'bonus' && k === 0 ? U(p + 20, restAt) : Infinity;
			// THE END OF A RUN (2026-11-21, the probe host: after an autoplay run's last round and after a free spins round the
			// ring went on turning with the key idle): the key changes face (auto or feature to the plain face) somewhere about
			// the last rest, and is idle from then on
			const runEnd = (kindRun === 'auto' || kindRun === 'bonus') && last;
			const endFaceAt = runEnd ? U(restAt - 200, restAt + 400) : Infinity;
			let faced = false;
			let endFaced = false;
			let started = false;
			const aDom = (at) => ((pageAngle(at) % 360) + 360) % 360;
			const resting = kindRun === 'single' || kindRun === 'reduced' || kindRun === 'resume';
			const gap = runEnd || kindRun === 'resume' ? 1700 : kindRun === 'auto' || kindRun === 'bonus' ? U(20, 50) : U(300, 2500);
			const until = restAt + gap;
			const faceChange = (f, live) => {
				// the face's elements: the same ones still showing (the drawing stays on screen), or new ones at home
				const same = rnd() < 0.5;
				core.faceChanged(f, same, turbo);
				if (!same) page = null;
				if (live) core.forgetSerial();
			};
			let seen = 0;
			const step = (f) => {
				if (f >= sAt && f < until) seen += 1;
				if (f >= sAt && serial < round + 1) serial = round + 1;
				const live = f >= p && f < restAt;
				if (!faced && f >= faceAt) {
					faced = true;
					// the bonus round's face is built (the thinned ring)
					faceChange(f, live);
				}
				if (!endFaced && f >= endFaceAt) {
					endFaced = true;
					faceChange(f, live);
				}
				const restIn = f >= learn && f < restAt ? restAt - f : null;
				// THE BACKSTOP as the driver runs it: a loop still drawn at rest with no plan
				if (!reduced && core.phase === 'rest' && page && page.open) core.rescue(f, aDom(f), turbo);
				core.frame(f, { live, restIn, serial, halted: f >= halt, reduced, turbo, resting: (resting && !live) || endFaced }, () => {
					if (reduced) return;
					core.start(f, turbo, aDom(f));
					started = true;
				});
				// (under reduced motion the driver cancels its animations: the face stands at home)
				if (reduced) page = null;
				if (reduced && (core.phase !== 'rest' || core.version !== lastVersion)) fail(`reduced: the ring turns (phase ${core.phase}, a new path ${core.version !== lastVersion})`);
				// ONE STANDING POSITION: still (its path run out), at rest, no hover on: on home
				if (core.phase === 'rest' && !core.hovering && core.path.segs.length && f >= core.path.end) {
					stillChecks += 1;
					const e = Math.abs(wrap180(core.path.pos(f) - RING_HOME));
					if (e > 0.5) fail(`${method} r${round} t${turbo} ${reg}: still at ${f.toFixed(0)} ms ${e.toFixed(2)} degrees off home`);
				}
				if (core.version !== lastVersion) {
					lastVersion = core.version;
					drawn();
					checkPath(core, `${method} r${round} t${turbo} ${reg}`);
					checkKeyframes(core, f, `${method} r${round} t${turbo} ${reg}`, worst);
				}
			};
			// the events between frames, in time order: the press (HudSpin's Play to Stop effect starts the ring at once, not
			// on a frame) and a desktop hover's enter and leave (pointer events, not on a frame): anywhere from the end of the
			// last round to this one's end, so at rest, across the press, during the spin or the brake
			const ev = [];
			if (pressed && !reduced) ev.push({ t: p, k: 'press' });
			if (!reduced && rnd() < 0.4) {
				const hIn = U(now, until);
				ev.push({ t: hIn, k: 'in' }, { t: Math.min(until - 0.01, hIn + pick([U(5, 60), U(60, 700), U(700, 2500)])), k: 'out' });
			}
			ev.sort((x, y) => x.t - y.t);
			const doEv = (e) => {
				const leaving = e.k === 'out' && core.hovering && core.phase === 'rest';
				if (e.k === 'press') {
					core.start(e.t, turbo, aDom(e.t));
					started = true;
				} else core.hover(e.t, e.k === 'in', aDom(e.t));
				if (core.version !== lastVersion) {
					lastVersion = core.version;
					drawn();
					checkPath(core, `${method} r${round} ${e.k}`);
					checkKeyframes(core, e.t, `${method} r${round} ${e.k}`, worst);
					if (leaving) checkWayBack(core, e.t, `${method} r${round} hover out`, wayBack);
				}
			};
			while (nextF < until) {
				while (ev.length && ev[0].t <= nextF) doEv(ev.shift());
				step(nextF);
				nextF = nextFrame(nextF, reg);
			}
			while (ev.length) doEv(ev.shift());
			// AFTER A RUN, A RESUMED ROUND, A ROUND WITH ITS ARRIVAL DONE: the ring on the page is home and still
			if (!reduced && !core.hovering && (runEnd || kindRun === 'resume' || gap >= 1000)) {
				endChecks += 1;
				// (a hover's way home or an arrival that began late lands after `until`: judged where its drawing ends)
				const pe = page && page.segs.length ? page.segs[page.segs.length - 1].te : -Infinity;
				const tc = Number.isFinite(pe) ? Math.max(until, pe + 1) : until;
				const a1 = pageAngle(tc + 150);
				const a0 = pageAngle(tc);
				const e = Math.abs(wrap180(a1 - RING_HOME));
				if (e > 0.5 || Math.abs(a1 - a0) > 0.01 || (page && page.open)) fail(`${method} r${round} ${kindRun} t${turbo} ${reg}: ${Math.round(gap)} ms after the last rest the ring is ${e.toFixed(1)} degrees off home, ${Math.abs(a1 - a0) > 0.01 || (page && page.open) ? 'turning' : 'still'}`);
			}
			now = until;
			t = until;
			if (reduced) {
				reducedRounds += 1;
				continue;
			}
			// (a round no frame falls in, an autoplay round shorter than one 700 ms frame, cannot be seen by anything on
			// the page: the next round's count starts the ring)
			if (!started && seen > 0) fail(`${method} r${round}: the ring never started`);
			if (!started && seen === 0) unseen += 1;
			// a new random hop offset at rest (the idle hop moves the ring between rounds)
			if (resting && core.phase === 'rest') hop = pick([0, 40, 80, 120, 23.7]);
		}
	}
	// the rounds' records
	for (const r of core.rounds.length ? allRounds(core) : []) {
		if (r.kind === null) continue;
		checked += 1;
		const key = `${r.kind}/${r.shape}`;
		tally[key] = (tally[key] ?? 0) + 1;
		if (r.err > worst.err) worst.err = r.err;
		if (r.err > 0.5) fail(`${method} round ${r.n} (${r.kind}, t${r.turbo}): rests ${r.err.toFixed(3)} degrees off home`);
		// THE BOUNCE on every arrival (a hover's way back has its own soft settle instead, checkWayBack)
		const graze = r.kind === 'hover' && r.shape === 'snap';
		if (graze) arrivals.grazes += 1;
		if (r.kind === 'hover' && r.shape !== 'back') fail(`${method} round ${r.n}: a hover's way home is ${r.shape}, not THE WAY BACK`);
		if (r.kind === 'hover' && r.shape === 'back') {
			if (!(r.over <= BACK_SETTLE_DEG + 1e-9 && r.bounceMs <= BACK_SETTLE_MS && r.low <= 1e-9 && typeof r.from === 'number')) fail(`${method} round ${r.n}: the way back's record (settle ${r.over} degrees over ${r.bounceMs} ms, from ${r.from}, low ${r.low})`);
		} else if (!graze) {
			arrivals.n += 1;
			arrivals.overMin = Math.min(arrivals.overMin, r.over);
			arrivals.overMax = Math.max(arrivals.overMax, r.over);
			arrivals.msMin = Math.min(arrivals.msMin, r.bounceMs);
			arrivals.msMax = Math.max(arrivals.msMax, r.bounceMs);
			if (!(r.over >= 6 && r.over <= 10 && r.bounceMs >= 180 && r.bounceMs <= 260)) fail(`${method} round ${r.n} (${r.kind}): bounce ${r.over} degrees over ${r.bounceMs} ms`);
			// forward only on the way home (the steer's every end; 'fixed' may swing back by design)
			if (method !== 'fixed') {
				arrivals.backMin = Math.min(arrivals.backMin, r.back);
				if (r.back < -1e-3) fail(`${method} round ${r.n} (${r.kind}/${r.shape}, t${r.turbo}): turns back on its way home (${r.back.toFixed(3)} x the loop's)`);
			}
		}
		if (r.kind === 'hover') {
			arrivals.hovers += 1;
			continue;
		}
		if (r.kind === 'halt') {
			arrivals.stops += 1;
			arrivals.stopMax = Math.max(arrivals.stopMax, r.brakeMs - r.todayMs);
			if (r.brakeMs - r.todayMs > HOME_EXTRA_MS + 1e-6) arrivals.stopPast150 += 1;
			arrivals.stopPeak = Math.max(arrivals.stopPeak, r.peak);
			stopPeaks.push(r.peak);
		}
		if (method === 'steer' && r.brakeMs > r.boundMs + 1e-6) fail(`steer round ${r.n} (${r.kind}, t${r.turbo}): brake ${Math.round(r.brakeMs)} ms over its bound ${Math.round(r.boundMs)} (today's ${Math.round(r.todayMs)})`);
		if (method === 'steer' && r.boundMs > r.todayMs + (r.kind === 'halt' ? STOP_EXTRA_MS : HOME_EXTRA_MS) + 1e-6) widened += 1;
		const over = r.brakeMs - r.todayMs;
		if (over > worst.over) {
			worst.over = over;
			worst.overKind = `${r.kind}/${r.shape} t${r.turbo}: ${Math.round(r.brakeMs)} ms against today's ${Math.round(r.todayMs)}`;
		}
		byTurbo[r.turbo].n += 1;
		byTurbo[r.turbo].over.push(over);
		const kk = `${r.kind} t${r.turbo}`;
		const B = (byKind[kk] ??= { n: 0, snap: 0, over: [], peak: 0, low: 0, steer: [] });
		B.n += 1;
		if (r.shape === 'snap') B.snap += 1;
		B.over.push(over);
		B.peak = Math.max(B.peak, r.peak);
		B.low = Math.min(B.low, r.low);
		B.steer.push(r.steer);
		if (method === 'steer' && r.steer > STEER_CAP + 1e-6) fail(`steer round ${r.n}: cruise speed ${Math.round(r.steer * 100)} % off the loop's`);
		worst.steer = Math.max(worst.steer, r.steer);
	}
	if (core.watchdogs) fail(`${method}: the backstop brought home ${core.watchdogs} loops left with no plan`);
	return { method, checked, reducedRounds, unseen, worst, tally, byTurbo, byKind, stillChecks, arrivals, widened, stopPeaks, endChecks, watchdogs: core.watchdogs, wayBack };
}
// (the core keeps its last 60 rounds; the test keeps every one)
const ALL = new WeakMap();
function allRounds(core) {
	return ALL.get(core) ?? core.rounds;
}
// collect every round: wrap the core's push
for (const name of ['start', 'hover']) {
	const orig = RingCore.prototype[name];
	RingCore.prototype[name] = function (...args) {
		const r = orig.apply(this, args);
		if (!ALL.has(this)) ALL.set(this, []);
		const last = this.rounds[this.rounds.length - 1];
		const all = ALL.get(this);
		if (last && all[all.length - 1] !== last) all.push(last);
		return r;
	};
}

/** BACK TO BACK SHORT ROUNDS: see the header */
function backToBack(method) {
	const out = { runs: 0, starts: 0, miss: 0, still: 0, finalOff: 0, minAdvance: Infinity };
	for (let run = 0; run < 1500; run++) {
		const core = new RingCore();
		core.method = method;
		const turbo = run % 3;
		const v = 360 / ((840 / [1, 1.7, 2.6][turbo]));
		let serial = 0;
		let f = 0;
		const dt = pick([16.7, 16.7, 8, 33.3, 'j']);
		const step = () => (f += dt === 'j' ? U(8, 50) : dt);
		const starts = [];
		const rows = [];
		let t = 500;
		const n = Math.floor(U(3, 9));
		for (let k = 0; k < n; k++) {
			const L = U(250, 600);
			const learn = t + U(0, L);
			const rest = t + L;
			const gap = pick([0, U(0, 40), U(40, 150), U(150, 400)]);
			// (the run's last round waits for its rest: the long brake can run for seconds)
			const end = rest + (k === n - 1 ? (method === 'long' ? 12000 : 1500) : gap);
			while (f < end) {
				step();
				if (f >= t && serial < k + 1) serial = k + 1;
				const live = f >= t && f < rest;
				core.frame(f, { live, restIn: f >= learn && f < rest ? rest - f : null, serial, halted: false, reduced: false, turbo, resting: k === n - 1 && f >= rest }, () => {
					core.start(f, turbo, 0);
					starts.push(f);
				});
				rows.push([f, core.angle(f), core.speed(f)]);
			}
			t = end;
		}
		out.runs += 1;
		const last = rows[rows.length - 1][0];
		for (let i = 0; i < starts.length; i++) {
			const s0 = starts[i];
			out.starts += 1;
			const a0 = rows.find((r) => r[0] >= s0)[1];
			const r4 = rows.find((r) => r[0] >= s0 + 400) ?? rows[rows.length - 1];
			const adv = r4[1] - a0;
			out.minAdvance = Math.min(out.minAdvance, adv);
			if (s0 + 400 <= last && adv < 10) {
				out.miss += 1;
				fail(`${method} back to back t${turbo} run ${run}: start ${i + 1} at ${Math.round(s0)} ms, only ${adv.toFixed(1)} degrees in 400 ms`);
			}
			const s1 = starts[i + 1] ?? last;
			const fastest = Math.max(...rows.filter((r) => r[0] >= s0 && r[0] < s1).map((r) => Math.abs(r[2])));
			if (fastest < 0.3 * v) {
				out.still += 1;
				fail(`${method} back to back t${turbo} run ${run}: round ${i + 1} never turns (fastest ${(fastest / v).toFixed(2)} x the loop's)`);
			}
		}
		const e = Math.abs(wrap180(core.angle(last) - RING_HOME));
		if (core.phase !== 'rest' || e > 0.5) {
			out.finalOff += 1;
			fail(`${method} back to back t${turbo} run ${run}: the run ends ${core.phase}, ${e.toFixed(2)} degrees off home`);
		}
	}
	return out;
}

/** THE HOVER CASES one by one (THE WAY BACK, 2026-11-21): each from a ring at rest on home after a round */
function hoverCases() {
	const out = [];
	const W = { n: 0, msFull: 0, msMax: 0, settleMax: 0, travelOff: 0 };
	const fresh = () => {
		const core = new RingCore();
		core.record = true;
		// (a round's rest, a few turns on: the unwrapped angle a multiple of 360)
		core.path.reset(RING_HOME + 720, 0);
		return core;
	};
	const line = (name, ok, msg) => {
		out.push(`   ${ok ? 'ok  ' : 'FAIL'} ${name}: ${msg}`);
		if (!ok) fail(`hover case ${name}: ${msg}`);
	};
	// a whole quarter: over the key past its turn, then off
	{
		const c = fresh();
		c.hover(1000, true, 0);
		const top = c.path.pos(1000 + HOVER_MS + 50) - 720;
		c.hover(1000 + HOVER_MS + 200, false, 0);
		checkWayBack(c, 1000 + HOVER_MS + 200, 'hover case whole quarter', W);
		const r = c.rounds[c.rounds.length - 1];
		line('whole quarter', Math.abs(top - HOVER_DEG) < 1e-6 && r.shape === 'back' && Math.abs(r.from - HOVER_DEG) < 1e-6 && r.brakeMs <= 350, `the turn to ${top.toFixed(2)} degrees, back from ${r.from.toFixed(2)} in ${r.brakeMs.toFixed(0)} ms (settle ${r.over.toFixed(2)} degrees short, forward to home over ${r.bounceMs} ms), rest ${r.err.toFixed(4)} off home`);
	}
	// a leave mid turn: back from wherever it is, sooner
	for (const at of [60, 150, 300]) {
		const c = fresh();
		c.hover(1000, true, 0);
		const p = c.path.pos(1000 + at) - 720;
		c.hover(1000 + at, false, 0);
		checkWayBack(c, 1000 + at, `hover case leave ${at} ms in`, W);
		const r = c.rounds[c.rounds.length - 1];
		line(`leave ${at} ms in`, Math.abs(r.from - p) < 1e-6 && r.brakeMs <= backMs(p) + BACK_SETTLE_MS + 1e-6, `back from ${r.from.toFixed(2)} degrees in ${r.brakeMs.toFixed(0)} ms (settle ${r.over.toFixed(2)}), rest ${r.err.toFixed(4)} off home`);
	}
	// a hover again on the way back: forward again from where it is to the same quarter, then off: back again
	{
		const c = fresh();
		c.hover(1000, true, 0);
		c.hover(1000 + HOVER_MS + 100, false, 0);
		const t2 = 1000 + HOVER_MS + 100 + 120;
		const p2 = c.path.pos(t2) - 720;
		c.hover(t2, true, 0);
		const first = c.rounds[c.rounds.length - 1];
		const v2 = c.path.vel(t2 + 5);
		const top = c.path.pos(t2 + HOVER_MS + 50) - 720;
		c.hover(t2 + HOVER_MS + 100, false, 0);
		checkWayBack(c, t2 + HOVER_MS + 100, 'hover case again on the way back', W);
		const r = c.rounds[c.rounds.length - 1];
		line('hover again on the way back', first.ended === 'next' && v2 > 0 && Math.abs(top - HOVER_DEG) < 1e-6 && r !== first && Math.abs(r.from - HOVER_DEG) < 1e-6, `the way back cut at ${p2.toFixed(2)} degrees (${first.ended}), forward again (${v2.toFixed(3)} deg/ms) to ${top.toFixed(2)}, back again from ${r.from.toFixed(2)}`);
	}
	// a press on the way back and a press during the hover: forward into the spin, home after it
	for (const [name, leaveAt, pressAt] of [
		['press on the way back', 1000 + HOVER_MS + 50, 1000 + HOVER_MS + 150],
		['press during the hover', null, 1000 + 300],
	]) {
		for (const turbo of [0, 1, 2]) {
			const c = fresh();
			c.hover(1000, true, 0);
			if (leaveAt !== null) c.hover(leaveAt, false, 0);
			const a0 = c.path.pos(pressAt);
			let serial = 0;
			c.lastSerial = 0;
			c.start(pressAt, turbo, 0);
			const restAt = pressAt + 1600;
			let f = pressAt;
			let lo = Infinity;
			while (f < restAt + 1500) {
				f += 16.7;
				if (f >= pressAt + 20) serial = 1;
				const live = f < restAt;
				c.frame(f, { live, restIn: f >= pressAt + 300 && f < restAt ? restAt - f : null, serial, halted: false, reduced: false, turbo, resting: !live }, () => c.start(f, turbo, 0));
				lo = Math.min(lo, c.path.pos(f) - a0);
			}
			const a1 = c.path.pos(f);
			const err = Math.abs(wrap180(a1 - RING_HOME));
			const R = c.rounds[c.rounds.length - 1];
			line(`${name} t${turbo}`, R.kind !== 'hover' && a1 - a0 >= 300 && err < 0.5 && c.phase === 'rest' && lo >= -20, `forward ${(a1 - a0).toFixed(1)} degrees from the press to the rest (wind back ${Math.max(0, -lo).toFixed(1)}), rest ${err.toFixed(3)} off home, ${R.kind}/${R.shape}`);
		}
	}
	return { out, W };
}

const pct = (xs, q) => {
	const s = [...xs].sort((a, b) => a - b);
	return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
};
const methods = (process.env.METHODS || REST_METHODS.join(',')).split(',');
let steerOk = true;
for (const m of methods) {
	const before = failCount;
	const R = run(m);
	const ok = failCount === before;
	if (m === 'steer') steerOk = ok;
	console.log(`\n== ${m}: ${R.checked} rounds braked and checked (+ ${R.reducedRounds} reduced motion, ${R.unseen} autoplay rounds shorter than one frame), ${ok ? 'no failures' : `${failCount - before} failures`}`);
	console.log(`   worst rest error ${R.worst.err.toFixed(4)} degrees; keyframes worst ${R.worst.kf.toFixed(4)} degrees off the path; ${R.stillChecks} still frames all on home`);
	const A = R.arrivals;
	console.log(`   bounce on ${A.n} arrivals: ${A.overMin} to ${A.overMax} degrees over, back in ${A.msMin} to ${A.msMax} ms (${A.grazes} hover grazes spring straight back); ${A.hovers} hover returns; slowest speed on the way home ${A.backMin.toFixed(3)} x the loop's`);
	console.log(`   stop presses: ${A.stops}, worst ${Math.round(A.stopMax)} ms over today's stop (${A.stopPast150} past +150), fastest ${A.stopPeak.toFixed(2)} x the loop's (median ${pct(R.stopPeaks, 0.5).toFixed(2)}, 90th ${pct(R.stopPeaks, 0.9).toFixed(2)}); bounds widened past today's + 150 / + 250 by a short brake and the bounce: ${R.widened}`);
	console.log(`   worst brake against today's: ${R.worst.over >= 0 ? '+' : ''}${Math.round(R.worst.over)} ms (${R.worst.overKind}); largest cruise speed change ${Math.round(R.worst.steer * 100)} %`);
	for (const t of [0, 1, 2]) {
		const o = R.byTurbo[t].over;
		console.log(`   turbo ${t}: ${R.byTurbo[t].n} rounds, brake over today's: median ${Math.round(pct(o, 0.5))} ms, 90th ${Math.round(pct(o, 0.9))} ms, max ${Math.round(pct(o, 1))} ms`);
	}
	const BB = backToBack(m);
	if (m === 'steer') steerOk = steerOk && BB.miss === 0 && BB.still === 0 && BB.finalOff === 0;
	console.log(`   ends of things (autoplay runs ending on their last round or by a press, free spins rounds ending, Skip, resumed rounds, every round after its arrival): ${R.endChecks} checks, the ring home and still; backstop used ${R.watchdogs} times`);
	const WB = R.wayBack;
	console.log(`   THE WAY BACK on ${WB.n} hovers left with no press: never above where it left; travel within ${WB.travelOff.toFixed(4)} degrees of the way back plus twice the settle; settle at most ${WB.settleMax.toFixed(2)} degrees; longest ${Math.round(WB.msMax)} ms (a whole quarter ${Math.round(WB.msFull)} ms)`);
	console.log(`   back to back short rounds: ${BB.runs} runs, ${BB.starts} starts: ${BB.miss} under 10 degrees in 400 ms (least ${BB.minAdvance.toFixed(1)}), ${BB.still} rounds still, ${BB.finalOff} runs ending off home`);
	console.log(`   ends (kind/shape): ${Object.entries(R.tally).sort().map(([k, v]) => `${k} ${v}`).join(', ')}`);
	if (process.env.DETAIL !== '0')
		for (const [k, B] of Object.entries(R.byKind).sort()) console.log(`     ${k.padEnd(10)} ${String(B.n).padStart(5)} rounds, snap ${String(Math.round((100 * B.snap) / B.n)).padStart(3)} %, brake over today's median ${Math.round(pct(B.over, 0.5))} / max ${Math.round(pct(B.over, 1))} ms, cruise change median ${Math.round(100 * pct(B.steer, 0.5))} % / max ${Math.round(100 * pct(B.steer, 1))} %, brake speed ${B.low.toFixed(2)} to ${B.peak.toFixed(2)} x the loop's`);
}
{
	const before = failCount;
	const H = hoverCases();
	console.log(`\n== the hover cases (THE WAY BACK): ${failCount === before ? 'no failures' : `${failCount - before} failures`}`);
	console.log(H.out.join('\n'));
	steerOk = steerOk && failCount === before;
}
if (fails.length) console.log('\nFAILURES (first 25):\n  ' + fails.join('\n  '));
console.log(`\nring_home_test: ${steerOk ? 'PASS' : 'FAIL'} (the cruise steer, the default)${failCount ? `; ${failCount} failures in all` : ''}`);
process.exit(steerOk ? 0 : 1);
