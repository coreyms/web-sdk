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
// thinned ring (its face rebuilt mid spin at the start), Turbo 0, 1 and 2, and reduced motion. Each round's frames come
// at one steady interval or a random one from 8 to 700 ms. Checked:
//   - every planned rest is home within 0.5 degrees (the art has no rotational symmetry, so home only)
//   - no brake longer than today's brake for the same end plus 150 ms (the cruise steer; long and fixed are reported)
//   - the cruise speed within 40 % of the loop's
//   - the path never jumps (each piece starts where the last one is) and its speed never steps (but into the settle's
//     swing back, as today, and at a wind-up from rest)
//   - the page's keyframes (linear between samples) follow the path within 0.25 degrees and end on home
//   - reduced motion: nothing is ever planned or drawn
import { RingCore, RingPath, ringMotion, RING_HOME, HOME_EXTRA_MS, STEER_CAP, REST_METHODS, wrap180 } from '../src/ui/hud/ringPlan.ts';

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
		if (b.k === 'set' || b.k === 'bez') continue;
		const v0 = speedOf(a, b.t0);
		const v1 = speedOf(b, b.t0);
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
	let lastVersion = core.version;
	let nextF = 0;
	let round = 0;
	while (round < N) {
		// ---- one session: a few single rounds, an autoplay run, or a bonus round ----
		const kindRun = pick(['single', 'single', 'auto', 'bonus', 'reduced']);
		const turbo = pick([0, 1, 2]);
		const reg = pick(REGIMES);
		const count = kindRun === 'single' ? 1 : kindRun === 'reduced' ? 2 : Math.floor(U(3, 9));
		const reduced = kindRun === 'reduced';
		let t = now + U(200, 3000);
		for (let k = 0; k < count && round < N; k++, round++) {
			const M = ringMotion(turbo);
			const lead = M.brake + M.settle;
			// the round's own times (real ms): its press or pull away, the spin count, the rest learned, the board at rest
			const p = t;
			const pressed = kindRun === 'single' || kindRun === 'reduced' || k === 0;
			const sAt = p + (pressed ? U(0, 60) : 0);
			const learn = p + U(30, [1500, 900, 500][turbo]);
			const driveIn = rnd() < 0.08 ? U(20, lead) : U([350, 220, 120][turbo], [2600, 1600, 800][turbo]);
			let restAt = learn + driveIn;
			// a stop press (only a pressed round can be stopped by the Spin; an autoplay round too: the run's Stop)
			const halt = !reduced && rnd() < 0.3 ? U(p + 10, restAt) : Infinity;
			if (halt < restAt) restAt = halt < learn ? learn + driveIn / 3 : halt + (restAt - halt) / 3;
			const faceAt = kindRun === 'bonus' && k === 0 ? U(p + 20, restAt) : Infinity;
			let faced = false;
			let started = false;
			const aDom = (at) => (((core.path.segs.length ? core.path.pos(at) : 0) % 360) + hop + 360) % 360;
			const resting = kindRun === 'single' || kindRun === 'reduced';
			const gap = kindRun === 'auto' || kindRun === 'bonus' ? U(20, 50) : U(300, 2500);
			const until = restAt + gap;
			let seen = 0;
			const step = (f) => {
				if (f >= sAt && f < until) seen += 1;
				if (f >= sAt && serial < round + 1) serial = round + 1;
				if (!faced && f >= faceAt) {
					faced = true;
					// the bonus round's face is built (the thinned ring): the old one's path is gone, a live spin starts again
					core.rest();
					core.forgetSerial();
				}
				const live = f >= p && f < restAt;
				const restIn = f >= learn && f < restAt ? restAt - f : null;
				core.frame(f, { live, restIn, serial, halted: f >= halt, reduced, turbo, resting: resting && !live }, () => {
					if (reduced) return;
					core.start(f, turbo, aDom(f));
					started = true;
				});
				if (reduced && (core.phase !== 'rest' || core.version !== lastVersion)) fail(`reduced: the ring turns (phase ${core.phase}, a new path ${core.version !== lastVersion})`);
				if (core.version !== lastVersion) {
					lastVersion = core.version;
					checkPath(core, `${method} r${round} t${turbo} ${reg}`);
					checkKeyframes(core, f, `${method} r${round} t${turbo} ${reg}`, worst);
				}
			};
			// the frames before the press, the press (HudSpin's Play to Stop effect starts the ring at once, not on a frame),
			// then the frames until the board is at rest and a little after (the next round, if any, follows)
			while (nextF < p) {
				step(nextF);
				nextF = nextFrame(nextF, reg);
			}
			if (pressed && !reduced) {
				core.start(p, turbo, aDom(p));
				started = true;
				if (core.version !== lastVersion) {
					lastVersion = core.version;
					checkPath(core, `${method} r${round} press`);
				}
			}
			while (nextF < until) {
				step(nextF);
				nextF = nextFrame(nextF, reg);
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
		if (method === 'steer' && over > HOME_EXTRA_MS + 1e-6) fail(`steer round ${r.n} (${r.kind}, t${r.turbo}): brake ${Math.round(r.brakeMs)} ms, today's ${Math.round(r.todayMs)} + ${HOME_EXTRA_MS}`);
		if (method === 'steer' && r.steer > STEER_CAP + 1e-6) fail(`steer round ${r.n}: cruise speed ${Math.round(r.steer * 100)} % off the loop's`);
		worst.steer = Math.max(worst.steer, r.steer);
	}
	return { method, checked, reducedRounds, unseen, worst, tally, byTurbo, byKind };
}
// (the core keeps its last 60 rounds; the test keeps every one)
const ALL = new WeakMap();
function allRounds(core) {
	return ALL.get(core) ?? core.rounds;
}
// collect every round: wrap the core's push
const origStart = RingCore.prototype.start;
RingCore.prototype.start = function (...args) {
	const r = origStart.apply(this, args);
	if (!ALL.has(this)) ALL.set(this, []);
	const last = this.rounds[this.rounds.length - 1];
	const all = ALL.get(this);
	if (last && all[all.length - 1] !== last) all.push(last);
	return r;
};

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
	console.log(`   worst rest error ${R.worst.err.toFixed(4)} degrees; keyframes worst ${R.worst.kf.toFixed(4)} degrees off the path`);
	console.log(`   worst brake against today's: ${R.worst.over >= 0 ? '+' : ''}${Math.round(R.worst.over)} ms (${R.worst.overKind}); largest cruise speed change ${Math.round(R.worst.steer * 100)} %`);
	for (const t of [0, 1, 2]) {
		const o = R.byTurbo[t].over;
		console.log(`   turbo ${t}: ${R.byTurbo[t].n} rounds, brake over today's: median ${Math.round(pct(o, 0.5))} ms, 90th ${Math.round(pct(o, 0.9))} ms, max ${Math.round(pct(o, 1))} ms`);
	}
	console.log(`   ends (kind/shape): ${Object.entries(R.tally).sort().map(([k, v]) => `${k} ${v}`).join(', ')}`);
	if (process.env.DETAIL !== '0')
		for (const [k, B] of Object.entries(R.byKind).sort()) console.log(`     ${k.padEnd(10)} ${String(B.n).padStart(5)} rounds, snap ${String(Math.round((100 * B.snap) / B.n)).padStart(3)} %, brake over today's median ${Math.round(pct(B.over, 0.5))} / max ${Math.round(pct(B.over, 1))} ms, cruise change median ${Math.round(100 * pct(B.steer, 0.5))} % / max ${Math.round(100 * pct(B.steer, 1))} %, brake speed ${B.low.toFixed(2)} to ${B.peak.toFixed(2)} x the loop's`);
}
if (fails.length) console.log('\nFAILURES (first 25):\n  ' + fails.join('\n  '));
console.log(`\nring_home_test: ${steerOk ? 'PASS' : 'FAIL'} (the cruise steer, the default)${failCount ? `; ${failCount} failures in all` : ''}`);
process.exit(steerOk ? 0 : 1);
