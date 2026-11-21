// @ts-nocheck: a node check script, not app code (svelte-check picks up .mjs files)
// THE SNORT AT THE LOCK, EVERY STRIKE (2026-11-21; game/road/lockSnort.ts, game/road/roadSounds.ts lockSnort and
// idleWrap, constants REINDEER_SOUND.snort, ROAM.charge). Node only, no browser: it steps the game's own rule
// (lockSnortOn, lockSnortDue, lockSnortLeft) and the game's own RoadSounds (with a stand-in player that keeps every play
// of the snort's key and when it stops or ends) through seeded multi-strike rounds, frame by frame, in the order
// roadFeatures.updateRunner asks on each frame (the strike's first frame: the alert; then the lock's snort if due; on the
// impact's frame the lock's snort if still not asked, then the impact), with the reindeer columns' idle loop restarting
// every 4 board seconds (the idle snort's roll forced on), and checks:
//   1. ONE PER STRIKE: every strike has exactly one lockSnort (never none, never two), his own and the ones from off the
//      screen, the first and every later strike of a spin (one right after an impact, one whose lock is at its own
//      instant, one with a long run up), at every frame step (8 to 250 ms, and mixed), every turbo level's rate, a turbo
//      change and a slam stop's hurry in the middle of a strike
//   2. AT THE LOCK: asked on the first frame with lockPeakMs real ms or less left to the lock (never a frame earlier,
//      never after the lock's own frame); a lock at the strike's instant on the strike's first frame; a strike with no
//      crosshair, or one whose lock would come after its impact, on the impact's frame
//   3. ONE COPY: no play of the snort's key while another is still sounding (the lock's stop then play)
//   4. THE IDLE SNORT'S RULE: every idle snort minGapMs real ms or more after any snort before it (a lock's included)
//   5. THE SWITCHES: ROAM.charge off, no lock snort at all; lockEveryStrike false, only his own strikes snort
//   node --experimental-strip-types --no-warnings tools/lock_snort_check.mjs      (from apps/run_over_reindeer)
// Pass: every line PASS, "0 fail" and exit 0.
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// the app's modules read import.meta.env (Vite): stood in as a dev build's (RoadSounds keeps its log in DEV only); their
// own imports leave out the .ts (Vite's way): added here
register(
	'data:text/javascript,' +
		encodeURIComponent(`export async function resolve(s, c, n) {
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
const { lockSnortDue, lockSnortLeft, lockSnortOn } = await mod('road/lockSnort.ts');
const { RoadSounds } = await mod('road/roadSounds.ts');
const { REINDEER_SOUND } = await mod('constants.ts');

const S = REINDEER_SOUND.snort;
const N = REINDEER_SOUND.names;
const SNORT = N.snort;
const SNORT_MS = 600;
const PEAK = S.lockPeakMs;

let pass = 0;
let fail = 0;
const check = (ok, msg, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail).slice(0, 700) : ''}`);
};
const mulberry = (a) => () => {
	a |= 0;
	a = (a + 0x6d2b79f5) | 0;
	let t = Math.imul(a ^ (a >>> 15), 1 | a);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// THE REAL CLOCK (performance.now, which RoadSounds reads): a stand-in the run steps
let realNow = 1000;
performance.now = () => realNow;

/** one round: `strikes` [{ his, lockMs (from the strike's start, board ms; null: no crosshair), impactMs, gapMs (real ms
 *  from the impact to the next strike's start) }], `steps` real ms per frame (cycled), `rate` the board's rate per
 *  frame index within a strike (a function: turbo, a change, a slam's hurry) */
function runRound({ strikes, steps, rateAt, charge = true, every = S.lockEveryStrike }) {
	realNow += 20000;
	const sounds = new RoadSounds();
	sounds.forceSnort = 'always';
	const plays = [];
	const live = (name) => plays.filter((q) => q.name === name && q.stop === null && realNow < q.t + SNORT_MS);
	const overlaps = [];
	sounds.env = {
		play: (name) => {
			if (name === SNORT && live(SNORT).length) overlaps.push({ t: realNow, live: live(SNORT).map((q) => q.t) });
			plays.push({ name, t: realNow, stop: null });
		},
		loop: () => {},
		fade: () => {},
		stop: (name) => {
			for (const q of plays) if (q.name === name && q.stop === null) q.stop = realNow;
		},
		roundLive: () => true,
	};
	let clock = 0;
	let frame = 0;
	let si = 0;
	let nextIdle = 4000;
	const out = [];
	const stepOf = () => steps[frame % steps.length];
	// (a strike starts between two frames, at the board clock of the frame before, as strike() runs after a frame)
	for (const [k, St] of strikes.entries()) {
		const start = clock;
		const lockAt = St.lockMs === null ? null : start + St.lockMs;
		const impactAt = start + St.impactMs;
		const r = { his: St.his, snorted: false, alerted: false, impact: null, start, lockAt, impactAt, snort: null, frames: [] };
		let fi = 0;
		for (;;) {
			const dt = stepOf();
			const rate = rateAt(k, fi);
			realNow += dt;
			clock += dt * rate;
			frame++;
			fi++;
			sounds.beginFrame(frame, clock);
			// (roadFeatures.updateRunner)
			if (!r.alerted) {
				r.alerted = true;
				sounds.mark('strike', `strike ${k}`);
				sounds.cue('alert');
			}
			const ask = (impact) => {
				if (r.snorted || !lockSnortOn(charge, r.his, every)) return;
				if (!lockSnortDue(r.snorted, lockAt, clock, rate, PEAK, impact)) return;
				r.snorted = true;
				r.snort = { clock, frame, fi, rate, left: lockSnortLeft(lockAt, clock, rate), impact };
				sounds.lockSnort(`strike ${k}`);
			};
			const left = lockSnortLeft(lockAt, clock, rate);
			r.frames.push({ clock, frame, rate, left });
			ask(false);
			if (clock >= impactAt) {
				ask(true);
				r.impact = { clock, frame };
				sounds.mark('impact', `strike ${k}`);
			}
			// (the idle loop restarts of a standing reindeer column, after the features: then endFrame)
			while (clock >= nextIdle) {
				sounds.idleWrap(0);
				nextIdle += 4000;
			}
			sounds.endFrame(0, 0, r.impact === null);
			if (r.impact) break;
		}
		out.push(r);
		// the gap to the next strike, frames with no strike (the board at its own pace)
		const until = realNow + St.gapMs;
		while (realNow < until) {
			const dt = stepOf();
			realNow += dt;
			clock += dt;
			frame++;
			sounds.beginFrame(frame, clock);
			while (clock >= nextIdle) {
				sounds.idleWrap(0);
				nextIdle += 4000;
			}
			sounds.endFrame(0, 0, false);
		}
		si++;
	}
	// a quiet board after the round: the idle snorts keep coming
	for (let i = 0; i < 2000; i++) {
		const dt = stepOf();
		realNow += dt;
		clock += dt;
		frame++;
		sounds.beginFrame(frame, clock);
		while (clock >= nextIdle) {
			sounds.idleWrap(0);
			nextIdle += 4000;
		}
		sounds.endFrame(0, 0, false);
	}
	return { strikes: out, log: sounds.trace(), plays, overlaps };
}

/** the checks on one round */
function judge(tag, R, { charge = true, every = S.lockEveryStrike } = {}) {
	const marks = R.log.filter((e) => e.kind === 'moment' && e.what === 'lockSnort');
	const bad = [];
	const late = [];
	const early = [];
	for (const [k, r] of R.strikes.entries()) {
		const want = lockSnortOn(charge, r.his, every);
		const mine = marks.filter((e) => e.detail === `strike ${k}`);
		if (mine.length !== (want ? 1 : 0)) {
			bad.push({ k, his: r.his, n: mine.length, want, lockAt: r.lockAt, start: r.start, impact: r.impactAt });
			continue;
		}
		if (!want) continue;
		const s = r.snort;
		// the frame it is due on: the first with PEAK real ms or less left to the lock (the strike's first frame for a
		// lock at its instant), else the impact's frame (no crosshair, or a lock that would come after the impact)
		const idx = r.frames.findIndex((f) => f.left !== null && f.left <= PEAK + 1e-9);
		const due = idx >= 0 ? r.frames[idx] : r.frames[r.frames.length - 1];
		if (s.frame !== due.frame) early.push({ k, snortFrame: s.frame, dueFrame: due.frame, left: s.left, lockAt: r.lockAt, start: r.start });
		// never after the lock's own frame: the frame before it had the lock still ahead
		const i = r.frames.findIndex((f) => f.frame === s.frame);
		if (i > 0 && r.frames[i - 1].left !== null && r.frames[i - 1].left <= 0) late.push({ k, left: s.left, prevLeft: r.frames[i - 1].left, i });
		if (idx < 0 && !(s.impact && s.frame === r.impact.frame)) late.push({ k, what: 'no lock by the impact: not on the impact frame', s, impact: r.impact });
	}
	check(bad.length === 0, `${tag}: every strike has exactly ${charge ? 'one' : 'no'} lock snort${!every && charge ? ' (his own only)' : ''} (${R.strikes.length} strikes, ${marks.length} lock snorts)`, bad.slice(0, 4));
	if (charge) {
		check(early.length === 0, `${tag}: each lock snort on the first frame within ${PEAK} real ms of its lock (the strike's first frame for a lock at its instant)`, early.slice(0, 4));
		check(late.length === 0, `${tag}: none after its lock's frame; a strike with no lock by its impact snorts on the impact's frame`, late.slice(0, 4));
	}
	check(R.overlaps.length === 0, `${tag}: one copy of the snort at a time (${R.plays.filter((q) => q.name === SNORT).length} plays)`, R.overlaps.slice(0, 3));
	// the idle snort: minGapMs after any snort, never in a strike's quiet
	const snortPlays = R.log.filter((e) => e.kind === 'sound' && e.what === SNORT && !/^stop/.test(e.detail || ''));
	const gaps = [];
	for (let i = 1; i < snortPlays.length; i++) {
		const idle = !/^lock:/.test(snortPlays[i].detail || '');
		if (idle && snortPlays[i].t - snortPlays[i - 1].t < S.minGapMs - 1e-6) gaps.push({ at: snortPlays[i].t, gap: snortPlays[i].t - snortPlays[i - 1].t });
	}
	const idles = snortPlays.filter((e) => !/^lock:/.test(e.detail || ''));
	check(gaps.length === 0 && idles.length >= 1, `${tag}: every idle snort ${S.minGapMs} real ms or more after the snort before it, a lock's included (${idles.length} idle snorts)`, gaps.slice(0, 3));
}

// THE ROUNDS
const TURBO = [1, 1.6, 2.5];
const SLAM = 6;
const STEPS = { '8': [8], '16.7': [16.7], '33.3': [33.3], '100': [100], '250': [250], mixed: [8, 16.7, 12, 33.3, 250, 50, 100, 16.7, 8, 70] };

// the probe host's shapes (2026-11-21 forced Free Spins, 1440x900 and 390x844): his strike from standing, then a second
// strike 267 ms after the impact with its lock at its own instant; one with a long run up (1067 ms); a third
const hostShapes = [
	{ his: true, lockMs: 1200, impactMs: 1500, gapMs: 267 },
	{ his: false, lockMs: 0, impactMs: 900, gapMs: 267 },
	{ his: false, lockMs: 1067, impactMs: 1400, gapMs: 400 },
	{ his: true, lockMs: 0, impactMs: 1100, gapMs: 2500 },
	{ his: false, lockMs: 1133, impactMs: 1500, gapMs: 267 },
];
for (const [name, steps] of Object.entries(STEPS))
	for (const [li, rate] of TURBO.entries()) {
		const R = runRound({ strikes: hostShapes, steps, rateAt: () => rate });
		judge(`host shapes, ${name} ms frames, turbo ${li}`, R);
	}

// random rounds: 1 to 4 strikes a spin, several spins, his first strike or one from off the screen, locks at the
// instant, inside the run, at the turn's edge, no crosshair (SKIP TO RESULT), a lock after the impact (never planned:
// the rule still gives one), a turbo change or a slam's hurry mid strike
const rnd = mulberry(20261121);
const randomRound = () => {
	const strikes = [];
	const spins = 1 + Math.floor(rnd() * 4);
	for (let s = 0; s < spins; s++) {
		const n = 1 + Math.floor(rnd() * 4);
		for (let i = 0; i < n; i++) {
			const impactMs = 500 + rnd() * 1500;
			const u = rnd();
			const lockMs = u < 0.25 ? 0 : u < 0.85 ? rnd() * (impactMs - 300) : u < 0.93 ? null : impactMs + 50 + rnd() * 300;
			strikes.push({ his: i === 0 && rnd() < 0.7, lockMs, impactMs, gapMs: i === n - 1 ? 1500 + rnd() * 4000 : 100 + rnd() * 500 });
		}
	}
	return strikes;
};
let rounds = 0;
for (const [name, steps] of Object.entries(STEPS))
	for (let j = 0; j < 40; j++) {
		const strikes = randomRound();
		const base = TURBO[Math.floor(rnd() * 3)];
		const mode = j % 4;
		const at = 2 + Math.floor(rnd() * 20);
		// 0 steady, 1 a turbo change mid strike, 2 a slam's hurry mid strike, 3 a slam's hurry from the start
		const rateAt = (k, fi) => (mode === 1 && fi >= at ? TURBO[(TURBO.indexOf(base) + 1) % 3] : mode === 2 && fi >= at ? SLAM : mode === 3 ? SLAM : base);
		const R = runRound({ strikes, steps, rateAt });
		judge(`random round ${j + 1} (${strikes.length} strikes, ${['steady', 'turbo change', 'slam mid strike', 'slam from the start'][mode]}), ${name} ms frames`, R);
		rounds++;
	}

// the switches
{
	const R = runRound({ strikes: hostShapes, steps: STEPS['16.7'], rateAt: () => 1, charge: false });
	judge('ROAM.charge off', R, { charge: false });
	const R2 = runRound({ strikes: hostShapes, steps: STEPS['16.7'], rateAt: () => 1, every: false });
	judge('lockEveryStrike false', R2, { every: false });
	check(S.lockEveryStrike === true, `REINDEER_SOUND.snort.lockEveryStrike is on (every strike snorts)`);
}

console.log(`\n${pass} pass, ${fail} fail (${rounds} random rounds)`);
process.exit(fail ? 1 : 0);
