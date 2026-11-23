// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,game/road/brakeLights.ts,game/road/laneFlow.ts,game/road/roadBoard.ts,game/road/roadSounds.ts,game/stateGame.svelte.ts};
// WATCHES: apps/run_over_reindeer/src/ui/controls.svelte.ts;
// WATCHES: ; __reindeer.atRest, __reindeer.boardLayout, __reindeer.brakes, __reindeer.clock, __reindeer.fixtures, __reindeer.flow
// WATCHES: ; __reindeer.flowLite, __reindeer.freeSpinNow, __reindeer.hud, __reindeer.hurryLevel, __reindeer.road, __reindeer.roadBoard
// WATCHES: ; __reindeer.roadSoundState, __reindeer.roadSounds, __reindeer.skip, __reindeer.step, __reindeer.tune, __reindeer.turbo
// WATCHES: ; BRAKE_LIGHTS, LANE_FLOW, REINDEER_SOUND.tease, ROUND, STOPLIGHT.tease, sfx_lane_stop_*, sfx_scatter_tease, sfx_stoplight_change
// WATCHES: ; sfx_traffic_roll, .hudp, .spin, .am-ui, .layer, .modals, .go
// THE LANE STAGGER PROBE (Corey 2026-11-16: lane by lane traffic, the scatter tease, the brake lights; constants
// LANE_FLOW, STOPLIGHT.tease, REINDEER_SOUND.tease, BRAKE_LIGHTS; game/road/laneFlow.ts, roadBoard.ts, brakeLights.ts).
// Posed books handed to the fixtures through the dev hook (presentation only, no math), the board clock frozen and
// stepped one 60 Hz frame at a time. Checks:
//   - THE PLAN against Corey's page: this file carries its own copy of the page's schedule() (lane_stagger_mock_2026-11-16
//     .html, his numbers); for boards with 0, 1, 2, 3, 4 and 5 scatters in several places (two and three in the top lane
//     too) every car's release and drive in the game's plan match it, at normal speed and at both turbo levels (the
//     page's schedule with the turbo level's gaps)
//   - THE MOTION: every car leaves the tunnel on its planned release and reaches its stop point on its planned arrival;
//     between the two it never slows except in its own brake (a car already on the road never waits for the tease)
//   - THE LIGHTS: while two are seen and a light's lanes still have cars to come it flashes amber; three seen, red and
//     amber in turn, faster; green for greenMs on each release from its lanes; after its lanes' last release the stop
//     behavior (red before the stop); no light change sound while it teases
//   - THE TEASE'S SOUND: sfx_scatter_tease starts on the frame the tease starts, steps its rate at three seen, stops on
//     the tease's end (decided or the last car seen), on a slam stop and under SKIP TO RESULT; never without a tease
//   - ONE STOP SOUND PER LANE (one per spin at turbo 2 and on a slam stop's cut); the traffic loop never fades before
//     the last car is out
//   - THE SLAM STOP during a tease cuts straight to the stopped board; a spin driving in already hurried has no tease
//   - PASS 8: the slam stop at tease level 1, at level 2 (the Free Spins trigger following) and in the frame a car is
//     released, sampled from the press until the board reports at rest (an empty sample fails): every car at its spot,
//     brake lights stopped, both stoplights red and still, the tease loop stopped, the round going on, the next spin
//     normal; after SKIP TO RESULT the next spin normal; autoplay at turbo 1 teasing each spin with nothing left over
//   - THE CAP: a tease that would take the spin past capMs is compressed so the press to rest is at most capMs
//   - A FEATURE ROUND: a free spin decides at three (the retrigger) and teases at most once per round
//   - A SLAM IN A BONUS ROUND (2026-11-17): a board tap in free spin 2 of a Free Spins and a Super round, at normal speed
//     and turbo 1, cuts that spin only; free spin 3 runs with no hurry, its full normal length (as free spin 1, the same
//     board) and its lane stops sound; the round ends at rest
//   - THE BRAKE LIGHTS: every car (H1 to H4) off while it cruises in, bright while it brakes, dim while stopped and at
//     rest, off as it pulls away; drawn only while the car is; never on a sleigh or a sign
// With OUT=<dir>: table.md (each case's spin length and release times at normal speed and both turbo levels), and with
// CLIPS=1 the 60 fps clips' frames (clips/<case>_<size>/) for tools' ffmpeg. ONLY=desktop,portrait picks sizes.
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [OUT=<dir>] [CLIPS=1] node tools/lane_stagger_probe.mjs
// Uses the dev server that is already running. One headless browser, muted, closed at the end. Take the shared browser
// lock around it (mkdir /tmp/hud_mock_shot.lock ... rmdir).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { R, SIZES_ALL, boot, chromium, sleep, stepRound, tally, FRAME } from './rider_probe_lib.mjs';

const OUT = process.env.OUT || '';
const CLIPS = process.env.CLIPS === '1' || process.env.CLIPSONLY === '1';
/** only the clips (no checks) */
const CLIPSONLY = process.env.CLIPSONLY === '1';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
/** SECTIONS=plans,slam,skip,autoplay,feature,bonusSlam picks the sections (default all) */
const SECTIONS = (process.env.SECTIONS || '').split(',').filter(Boolean);
const SEC = (name) => !SECTIONS.length || SECTIONS.includes(name);
if (OUT) mkdirSync(OUT, { recursive: true });
const SIZES = SIZES_ALL.filter((s) => (ONLY.length ? ONLY.includes(s.name) : s.name !== 'short'));
const RATE = [1, 1.7, 2.6];

// ---- Corey's page, his numbers ("lane gap 100 ms, drive-in 680 ms, car gap 70 ms, car gap at two seen 360 ms, car gap at
// three seen 390 ms, clear gap 60 ms, 2 stoplights"), and its schedule() as written there (decideAt 4: n >= 4 clears).
// The turbo levels' gaps are the game's (constants LANE_FLOW turbo1 / turbo2), read from the page's tune at run time.
// (the page's own slider default for the clear gap is 50; Corey's read back number is 60)
const PAGE = { gap: 100, travel: 680, car: 70, t1: 360, t2: 390, clear: 60, seen: 110 };
const COLS = 5;
const ROWS = 4;
const DIR = [1, 1, -1, -1];
function pageSchedule(scat, P, decideAt = 4) {
	const isS = (l, c) => scat.some((q) => q[0] === l && q[1] === c);
	const cars = [];
	for (let l = 0; l < ROWS; l++)
		for (let k = 0; k < COLS; k++) {
			const c = DIR[l] > 0 ? COLS - 1 - k : k;
			const dist = (COLS - k) / COLS;
			cars.push({ l, k, c, nr: l * P.gap + k * P.car, dur: P.travel * (0.55 + 0.45 * dist), fs: isS(l, c) });
		}
	cars.sort((a, b) => a.nr - b.nr || a.l - b.l);
	const seen = [];
	const level = (t) => {
		const n = seen.filter((x) => x <= t).length;
		return n >= decideAt ? 3 : n >= 3 ? 2 : n >= 2 ? 1 : 0;
	};
	let prevRel = -1e9;
	for (const q of cars) {
		let rel = q.nr;
		for (let it = 0; it < 4; it++) {
			const lv = level(rel);
			if (lv === 3) {
				const T4 = seen.slice().sort((a, b) => a - b)[decideAt - 1];
				rel = Math.max(prevRel + P.clear, T4);
				break;
			}
			if (lv === 0) break;
			const need = prevRel + (lv === 1 ? P.t1 : P.t2);
			if (rel >= need) break;
			rel = need;
		}
		q.rel = rel;
		q.arr = rel + q.dur;
		if (q.fs) seen.push(rel + P.seen);
		prevRel = rel;
	}
	seen.sort((a, b) => a - b);
	return { cars, seen, end: Math.max(...cars.map((q) => q.arr)) };
}

// the scatter stories: [lane (row), reel]. The page's own, plus two and three in the top lane, five, and the cap
const CASES = {
	none: [],
	one: [[1, 2]],
	miss: [[0, 1], [1, 3]],
	top2: [[0, 1], [0, 3]],
	top3: [[0, 0], [0, 2], [0, 4]],
	fs: [[0, 1], [1, 3], [2, 2]],
	fslate: [[0, 3], [1, 1], [3, 2]],
	late: [[2, 4], [3, 0]],
	sup: [[0, 1], [1, 3], [2, 2], [3, 0]],
	five: [[0, 1], [1, 3], [2, 2], [3, 0], [3, 4]],
	cap: [[0, 4], [0, 3]],
};
const FILL = ['L1', 'H1', 'L2', 'H2', 'L3', 'H3', 'L4', 'H4', 'L5', 'W'];
const boardOf = (scat, salt = 0) => {
	const b = Array.from({ length: COLS }, (_, reel) => Array.from({ length: ROWS }, (_, row) => FILL[(reel * 7 + row * 3 + reel * row + salt) % FILL.length]));
	for (const [row, reel] of scat) b[reel][row] = 'S';
	return b;
};
const book = (board, gameType = 'basegame') => [{ index: 0, type: 'reveal', gameType, board }, { index: 1, type: 'finalWin', amount: 0 }];

/** what each frame reads */
const READ = (h) => {
	const f = h.flowLite();
	return {
		clock: f.clock,
		lights: f.lights.map((l) => [l.showing, l.teasing, l.lanes[0]]),
		cars: h.brakes().map((b) => [b.lane, b.col, b.phase, b.x, b.visible, b.state, b.level, b.shown, b.symbol]),
		signs: h.road().phases,
	};
};

const T = tally();
const table = [];
const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
	for (const S of CLIPSONLY ? [] : SIZES) {
		const { p, errs } = await boot(browser, S, 'lanes');
		// (2026-11-17: with no autoplay the bonus intro waits for the player's press; this probe's bonus rounds are played
		// through without one, so the intro continues by itself after its 4 s here, as it did before)
		await R(p, () => (window.__reindeer.tune.round.introWaitsForPress = false));
		console.log(`-- ${S.name} ${S.vp.width}x${S.vp.height}`);
		const tune = await R(p, () => JSON.parse(JSON.stringify({ flow: window.__reindeer.tune.laneFlow, light: window.__reindeer.tune.stoplight.tease, brake: window.__reindeer.tune.brakeLights, sound: window.__reindeer.tune.sound.tease, motion: window.__reindeer.tune.motion })));
		T.check(tune.flow.normal.laneGapMs === PAGE.gap && tune.flow.driveInMs === PAGE.travel && tune.flow.normal.carGapMs === PAGE.car && tune.flow.tease.twoGapMs === PAGE.t1 && tune.flow.tease.threeGapMs === PAGE.t2 && tune.flow.normal.clearGapMs === PAGE.clear && tune.flow.seenMs === PAGE.seen, `${S.name}: the game's numbers are Corey's (lane gap 100, drive in 680, car gap 70, two seen 360, three seen 390, clear 60, seen 110)`, tune.flow);
		const levels = S.name === 'desktop' ? [0, 1, 2] : [0];
		// every case at normal speed on the desktop; the turbo levels and the phone the cases that differ (none, a tease
		// that misses, three, four, the cap)
		const casesFor = (level) => (S.name === 'desktop' && level === 0 ? Object.keys(CASES) : S.name === 'desktop' ? ['none', 'miss', 'top3', 'sup', 'cap'] : ['none', 'miss', 'fs']);
		for (const level of SEC('plans') ? levels : []) {
			const L = level === 2 ? tune.flow.turbo2 : level === 1 ? tune.flow.turbo1 : tune.flow.normal;
			const half = level === 2 && tune.flow.tease.turbo2 === 'half' ? 0.5 : 1;
			const P = { gap: L.laneGapMs, travel: tune.flow.driveInMs, car: L.carGapMs, t1: tune.flow.tease.twoGapMs * half, t2: tune.flow.tease.threeGapMs * half, clear: L.clearGapMs, seen: tune.flow.seenMs };
			const frameMs = FRAME * RATE[level];
			for (const name of casesFor(level)) {
				const scat = CASES[name];
				const tag = `${S.name} turbo ${level} ${name} (${scat.length} scatter${scat.length === 1 ? '' : 's'})`;
				await R(p, () => window.__reindeer.roadSounds(true));
				const rows = await stepRound(p, { book: book(boardOf(scat, level)), turbo: level, read: READ });
				const fl = await R(p, () => window.__reindeer.flow());
				const plan = fl.plan;
				const log = await R(p, () => window.__reindeer.roadSounds());
				if (!plan) {
					T.check(false, `${tag}: a plan was played`);
					continue;
				}
				const page = pageSchedule(scat, P);
				const budget = 6500 - tune.motion.base.in.delayMs - tune.motion.base.in.settleMs;
				// (pass 8: the game's budget also takes the press to the drive in's start out, so the plan's own factor says it was capped)
					const capped = plan.factor < 1;
				// 1. THE PLAN against the page (a capped case: against the page with the compressed tease gaps)
				const ref = capped ? pageSchedule(scat, { ...P, t1: P.t1 * plan.factor, t2: P.t2 * plan.factor }) : page;
				const byKey = new Map(ref.cars.map((q) => [`${q.l}:${q.k}`, q]));
				const bad = plan.cars.filter((c) => {
					const q = byKey.get(`${c.lane}:${c.k}`);
					// (a capped plan is compared through the snapshot's factor, rounded to 4 places: on a release near 5 s that is
					// up to 0.25 ms, so 1 ms there)
					const tol = capped ? 1 : 0.2;
					return !q || Math.abs(q.rel - c.rel) > tol || Math.abs(q.dur - c.dur) > tol || q.fs !== c.scatter;
				});
				T.check(plan.cars.length === 20 && bad.length === 0, `${tag}: all 20 releases and drives match the page's schedule()${capped ? ` (capped, factor ${plan.factor})` : ''}`, bad.slice(0, 3).map((c) => ({ c, page: byKey.get(`${c.lane}:${c.k}`) })));
				T.check(JSON.stringify(plan.seen) === JSON.stringify(ref.seen.map((x) => Math.round(x * 10) / 10)), `${tag}: the scatters are seen at ${plan.seen.join(', ') || 'none'} ms, as the page sees them`, { game: plan.seen, page: ref.seen });
				const wantTease = ref.seen.length >= 2 && ref.seen[1] < Math.max(...ref.cars.map((q) => q.rel)) && P.t1 > 0;
				T.check((plan.teaseFrom !== null) === wantTease, `${tag}: ${wantTease ? `a tease from ${plan.teaseFrom} ms` : 'no tease'}`, plan);
				// 2. THE MOTION: release and arrival on plan, cruise unchanged until its own brake
				const start = plan.start;
				const relOk = [];
				const slowBad = [];
				const tracks = new Map();
				for (const r of rows) for (const c of r.sample.cars) {
					if (c[2] !== 'in' && c[2] !== 'rest') continue;
					const key = `${c[0]}:${c[1]}`;
					if (!tracks.has(key)) tracks.set(key, []);
					tracks.get(key).push({ t: r.sample.clock, x: c[3], vis: c[4], phase: c[2] });
				}
				const carsNow = await R(p, () => window.__reindeer.brakes());
				for (const pc of plan.cars) {
					const col = DIR[pc.lane] > 0 ? COLS - 1 - pc.k : pc.k;
					const key = `${pc.lane}:${col}`;
					const tr = tracks.get(key) ?? [];
					const firstVis = tr.find((s) => s.vis);
					if (firstVis) relOk.push(firstVis.t - (start + pc.rel) >= -0.6 && firstVis.t - (start + pc.rel) <= frameMs + 260);
					const meta = carsNow.find((b) => b.lane === pc.lane && b.col === col);
					// speed between frames on the road, before its brake: its own cruise speed
					for (let i = 1; i < tr.length; i++) {
						const a = tr[i - 1];
						const b = tr[i];
						if (!meta || a.t < start + pc.rel || b.t > start + pc.arr - (meta.b ?? 270) || !a.vis) continue;
						const v = (Math.abs(b.x - a.x) / Math.max(0.001, b.t - a.t)) * 1000;
						if (Math.abs(v - meta.v) > meta.v * 0.01 + 2) slowBad.push({ key, t: b.t, v, want: meta.v });
					}
				}
				T.check(relOk.length > 0 && relOk.every(Boolean), `${tag}: every car comes out of the tunnel at its planned release (${relOk.length} seen)`);
				T.check(slowBad.length === 0, `${tag}: no car on the road ever slows or waits before its own brake`, slowBad.slice(0, 4));
				const last = rows.at(-1).sample;
				T.check(last.cars.every((c) => c[2] === 'rest'), `${tag}: every car parked at the end`);
				// 3. THE LIGHTS
				const lightBad = [];
				let flashN = 0;
				let altN = 0;
				let greenN = 0;
				for (const r of rows) {
					const t = r.sample.clock - start;
					const n = plan.seen.filter((s) => s <= t).length;
					const lv = n >= plan.decideAt ? 3 : n >= 3 ? 2 : n >= 2 ? 1 : 0;
					r.sample.lights.forEach((L, li) => {
						const lanes = L[2] === 0 ? [0, 1] : [2, 3];
						const rels = plan.cars.filter((c) => lanes.includes(c.lane)).map((c) => start + c.rel);
						const remain = rels.some((x) => x > r.sample.clock);
						const [showing, teasing] = r.sample.lights[li];
						const shouldTease = plan.teaseFrom !== null && (lv === 1 || lv === 2) && remain && t > 0;
						const near = [...plan.seen, ...rels.map((x) => x - start)].some((x) => Math.abs(x - t) < 0.5);
						if (shouldTease !== teasing) return near ? null : lightBad.push({ t, li, lv, remain, showing, teasing });
						if (!shouldTease) return;
						const green = rels.some((x) => x <= r.sample.clock && r.sample.clock - x < tune.light.greenMs);
						const want = green ? 'green' : lv === 1 ? (Math.floor(t / tune.light.flashMs) % 2 === 0 ? 'amber' : null) : Math.floor(t / tune.light.alternateMs) % 2 === 0 ? 'red' : 'amber';
						// (a frame within half a ms of a flash's beat may round either way)
						const edge = Math.min(...[tune.light.flashMs, tune.light.alternateMs].map((m) => Math.abs(t / m - Math.round(t / m)) * m), ...rels.map((x) => Math.min(Math.abs(x - r.sample.clock), Math.abs(x + tune.light.greenMs - r.sample.clock))));
						if (showing !== want && edge > 0.5) lightBad.push({ t, li, want, showing });
						if (green) greenN++;
						else if (lv === 1) flashN++;
						else altN++;
					});
				}
				T.check(lightBad.length === 0, `${tag}: the lights tease exactly while a light's lanes have cars to come (flash ${flashN}, red and amber ${altN}, green ${greenN} light frames)`, lightBad.slice(0, 4));
				// a change sound names its lights ("top amber>red"): none of them may be teasing on that frame or the one before
				const voicedInTease = log.filter((e) => {
					if (e.kind !== 'sound' || e.what !== 'sfx_stoplight_change') return false;
					const i = rows.findIndex((r) => r.sample.clock === e.clock);
					const named = (e.detail || '').split(', ').map((x) => (x.startsWith('top') ? 0 : 2));
					return [rows[i], rows[i - 1]].some((r) => r && r.sample.lights.some((l) => l[1] && named.includes(l[2])));
				});
				T.check(voicedInTease.length === 0, `${tag}: no light change sound from a teasing light`, voicedInTease.slice(0, 3));
				// 4. THE TEASE'S SOUND
				const tease = log.filter((e) => e.what === 'sfx_scatter_tease');
				if (plan.teaseFrom === null) T.check(tease.length === 0, `${tag}: no tease sound`, tease);
				else {
					const st = tease.find((e) => /loop start/.test(e.detail || ''));
					const rate = tease.find((e) => /^rate/.test(e.detail || ''));
					const stop = tease.find((e) => /stop/.test(e.detail || ''));
					T.check(!!st && st.clock - start >= plan.teaseFrom - 0.2 && st.clock - start < plan.teaseFrom + frameMs + 0.2, `${tag}: the tease loop starts on the tease's first frame (${st ? (st.clock - start).toFixed(1) : '-'} ms, plan ${plan.teaseFrom})`, tease);
					T.check(plan.threeFrom === null ? !rate : !!rate && rate.clock - start >= plan.threeFrom - 0.2 && rate.clock - start < plan.threeFrom + frameMs + 0.2, `${tag}: ${plan.threeFrom === null ? 'no step (never three seen with cars to come)' : `its rate steps up at three seen (${(rate?.clock - start).toFixed(1)} ms, plan ${plan.threeFrom})`}`, tease);
					T.check(!!stop && stop.clock - start >= plan.teaseEnd - 0.2 && stop.clock - start < plan.teaseEnd + frameMs + 0.2 && tease.filter((e) => /loop start/.test(e.detail || '')).length === 1, `${tag}: it stops once, with its fade, when the tease is over (${stop ? (stop.clock - start).toFixed(1) : '-'} ms, plan ${plan.teaseEnd}: ${stop?.detail})`, tease);
				}
				// 5. ONE STOP SOUND PER LANE, the traffic's fade
				const stops = log.filter((e) => e.kind === 'sound' && /^sfx_lane_stop_/.test(e.what));
				const laneStops = [0, 1, 2, 3].map((l) => Math.max(...plan.cars.filter((c) => c.lane === l).map((c) => start + c.arr)));
				if (level < 2) {
					const ok = stops.length === 4 && stops.every((e, i) => e.what === `sfx_lane_stop_${i + 1}` && e.clock >= laneStops[i] - 0.2 && e.clock < Math.max(...laneStops.slice(0, i + 1)) + frameMs + 0.2);
					T.check(ok, `${tag}: one stop sound per lane, top lane first, on the frame its last car stops`, { stops: stops.map((e) => [e.what, e.clock]), laneStops });
				} else T.check(stops.length >= 1 && stops.length <= 4 && stops.every((e, i) => i === 0 || e.t - stops[i - 1].t >= 100), `${tag}: turbo 2: one stop sound per moment (${stops.length})`, stops.map((e) => [e.what, e.clock]));
				const fade = log.find((e) => e.what === 'sfx_traffic_roll' && /stop/.test(e.detail || ''));
				T.check(!!fade && fade.clock >= start + plan.lastRelease - 0.2, `${tag}: the traffic loop never fades before the last car is out (${fade ? (fade.clock - start).toFixed(1) : '-'} ms, last release ${plan.lastRelease})`, fade);
				// 6. THE BRAKE LIGHTS
				const brakeBad = [];
				const seenBrake = new Set();
				for (const r of rows) for (const c of r.sample.cars) {
					const [lane, col, phase, , vis, state, lvl, shown, sym] = c;
					if (!['H1', 'H2', 'H3', 'H4'].includes(sym)) {
						if (shown || state !== 'off') brakeBad.push({ c, why: 'lit on a sign or a sleigh' });
						continue;
					}
					if (shown && !vis) brakeBad.push({ c, why: 'drawn without its car' });
					if (phase === 'out' && state !== 'off') brakeBad.push({ c, why: 'lit pulling away' });
					if (phase === 'rest' && state !== 'stopped') brakeBad.push({ c, why: 'not dim at rest' });
					if (state === 'brake') seenBrake.add(`${lane}:${col}`);
				}
				const carCells = plan.cars.length ? last.cars.filter((c) => ['H1', 'H2', 'H3', 'H4'].includes(c[8])) : [];
				T.check(brakeBad.length === 0, `${tag}: brake lights only on cars, never drawn without the car, off pulling away, dim at rest`, brakeBad.slice(0, 3));
				T.check(carCells.every((c) => seenBrake.has(`${c[0]}:${c[1]}`)) && carCells.every((c) => c[7] && Math.abs(c[6] - tune.brake.stopped) < 0.01), `${tag}: every one of the ${carCells.length} cars lit bright while braking and stands dim (${tune.brake.stopped}) at rest`, carCells.filter((c) => !seenBrake.has(`${c[0]}:${c[1]}`) || !c[7]));
				const spin = fl.spins.at(-1);
				table.push({ size: S.name, level, name, scatters: scat.length, boardMs: spin?.boardMs, realMs: spin?.boardMs ? Math.round(spin.boardMs / RATE[level]) : null, teaseFrom: plan.teaseFrom, threeFrom: plan.threeFrom, teaseEnd: plan.teaseEnd, end: plan.end, factor: plan.factor, held: plan.held, rel: plan.cars.map((c) => `${c.lane + 1}.${c.k + 1}${c.scatter ? 'S' : ''}@${c.rel}`).join(' ') });
				// (pass 8: the cap is the press to the board at rest, measured here on the board clock: restClock - pressClock)
					if (level === 0) T.check(spin && spin.boardMs <= 6500, `${tag}: the press to rest ${spin?.boardMs} ms (board clock) is within the 6.5 s cap`, spin);
				if (name === 'cap' && level === 0) T.check(page.end > budget && plan.factor < 1, `${tag}: the tease would end the drive in at ${Math.round(page.end)} ms, past the budget ${budget}: compressed by ${plan.factor}`, { pageEnd: page.end, budget, factor: plan.factor });
			}
		}

		// 7. THE SLAM STOP during a tease (pass 8: sampled from the frame after the press until the board reports at rest, an
		// empty sample is a FAIL): pressed at level 1 (two seen), at level 2 (three seen, the round's Free Spins trigger
		// following) and at the fastest moment (in the frame a car is released). After it: every car at its spot, the brake
		// lights stopped, both stoplights red and not teasing, the tease loop stopped and not held, one stop sound, the
		// round goes on (the trigger, the free spins) and the next spin is a normal one (its own tease, no cut)
		if (SEC('slam')) {
			const trig = [[0, 1], [1, 3], [2, 2]];
			const fsBook = [
				{ type: 'reveal', gameType: 'basegame', board: boardOf(trig, 9) },
				{ type: 'freeSpinTrigger', totalFs: 3, cells: [1 * 4 + 0, 3 * 4 + 1, 2 * 4 + 2], bonusType: 'freespins' },
				{ type: 'reveal', gameType: 'freegame', board: boardOf([], 10), fs: 1, totalFs: 3, held: [] },
				{ type: 'reveal', gameType: 'freegame', board: boardOf([], 11), fs: 2, totalFs: 3, held: [] },
				{ type: 'reveal', gameType: 'freegame', board: boardOf([], 12), fs: 3, totalFs: 3, held: [] },
				{ type: 'freeSpinEnd', amount: 0 },
				{ type: 'setTotalWin', amount: 0 },
				{ type: 'finalWin', amount: 0 },
			].map((e, i) => ({ index: i, ...e }));
			const SLAMS = [
				{ name: 'level 1 (two seen)', book: book(boardOf(CASES.miss, 3)), when: (f, t) => f.teaseFrom !== null && t > f.teaseFrom + 120 && (f.threeFrom === null || t < f.threeFrom) },
				{ name: 'level 2 (three seen, the trigger follows)', book: fsBook, feature: true, when: (f, t) => f.threeFrom !== null && t > f.threeFrom + 60 && t < f.teaseEnd },
				// the press lands before the next step, which releases a car: that car is released and stopped in one frame
				{ name: 'the fastest moment (a car released in the slam frame)', book: book(boardOf(CASES.miss, 13)), release: true, when: (f, t) => f.teaseFrom !== null && t > f.teaseFrom && f.cars.some((c) => c.rel > t && c.rel <= t + FRAME) },
			];
			// THE SLOW REAL CLOCK (2026-11-16, the probe host's steady fails): the board clock is stepped by hand, but the game
			// keys a few things to real time (performance.now: the one moment stop sound's gap, the fades). A host that steps
			// fast puts many board frames in a few real ms, a slow one the other way round, so each slam is played twice: as
			// the host steps, and with the page's real clock run at 1/50 (performance.now shimmed for that round only), which
			// on any machine is a host that steps 50 times faster, and the Linux probe host's result on the Mac
			const slowReal = (on) =>
				R(p, (on) => {
					const P = performance;
					P.__realNow ??= P.now.bind(P);
					window.__slowReal = on ? { base: P.__realNow(), k: 0.02 } : null;
					P.now = () => {
						const q = window.__slowReal;
						return q ? q.base + (P.__realNow() - q.base) * q.k : P.__realNow();
					};
				}, on);
			for (const SL of SLAMS.flatMap((x) => [x, { ...x, slow: true }])) {
				const tag = `${S.name}: slam at ${SL.name}${SL.slow ? ', the real clock at 1/50' : ''}`;
				await slowReal(!!SL.slow);
				await R(p, () => window.__reindeer.roadSounds(true));
				let slamAt = null;
				let releasedAt = null;
				const t0 = Date.now();
				const rows = await stepRound(p, {
					book: SL.book,
					read: READ,
					maxFrames: SL.feature ? 4000 : 1600,
					onFrame: async (i, s) => {
						if (slamAt !== null) return;
						const f = await R(p, () => window.__reindeer.flow().plan);
						if (!f || f.cut) return;
						const t = s.sample.clock - f.start;
						if (SL.when(f, t)) {
							slamAt = i;
							releasedAt = SL.release ? f.cars.filter((c) => c.rel > t && c.rel <= t + FRAME).map((c) => `${c.lane}:${c.k}`) : null;
							await p.click('.hudp button.spin');
						}
					},
				});
				await slowReal(false);
				console.log(`   (${tag}: ${rows.length} stepped frames in ${Date.now() - t0} real ms)`);
				const log = await R(p, () => window.__reindeer.roadSounds());
				const fl = await R(p, () => window.__reindeer.flow());
				const st = await R(p, () => window.__reindeer.roadSoundState());
				const cut = log.find((e) => e.what === 'slamCut');
				const cutSpin = SL.feature ? fl.spins.at(-4) : fl.spins.at(-1);
				T.check(slamAt !== null && !!cut && !!cutSpin?.cut, `${tag}: the slam stop cut the drive in`, { slamAt, cut, cutSpin });
				// the drive in's frames from the press to the board at rest: the cut spin's own rest on the road clock (a feature
				// round is not idle until its end), else the first idle frame after the press
				const restAt = cutSpin?.restClock ?? null;
				const restI = rows.findIndex((r) => slamAt !== null && r.i > slamAt && (restAt !== null ? r.sample.clock >= restAt : r.idle));
				const after = rows.filter((r) => slamAt !== null && r.i > slamAt && (restI < 0 || r.i <= rows[restI].i));
				T.check(after.length > 0 && restI > 0, `${tag}: ${after.length} frame(s) sampled from the press to the board at rest`, { slamAt, restI });
				// (the board before's cars pulling away, phase 'out', and the through traffic that crossed while the book was
				// awaited, phase 'through', are not this spin's)
				const badCars = after.flatMap((r) => r.sample.cars.filter((c) => c[2] !== 'out' && c[2] !== 'through' && !(c[2] === 'rest' || (c[2] === 'in' && c[4]))).map((c) => ({ i: r.i, c })));
				T.check(after.length > 0 && badCars.length === 0, `${tag}: from the cut every car stands at its spot (none left in the tunnel or on its way)`, badCars.slice(0, 3));
				const isCar = (c) => ['H1', 'H2', 'H3', 'H4'].includes(c[8]);
				const restRow = restI > 0 ? rows[restI].sample : null;
				T.check(!!restRow && restRow.cars.length > 0 && restRow.cars.filter((c) => c[2] !== 'out').every((c) => c[2] === 'rest' && (isCar(c) ? c[5] === 'stopped' && Math.abs(c[6] - tune.brake.stopped) < 0.01 : c[5] === 'off')), `${tag}: at rest every car parked, every brake light in its stopped state`, restRow?.cars.filter((c) => c[2] !== 'out' && (c[2] !== 'rest' || c[5] !== (isCar(c) ? 'stopped' : 'off'))).slice(0, 3));
				T.check(after.length > 0 && after.every((r) => r.sample.lights.every((l) => l[0] === 'red' && !l[1])), `${tag}: both stoplights red, none teasing, from the cut to the rest`, after.slice(0, 3).map((r) => r.sample.lights));
				const teaseStop = log.find((e) => e.what === 'sfx_scatter_tease' && /slam stop/.test(e.detail || ''));
				T.check(!!teaseStop && !!cut && teaseStop.clock === cut.clock && log.filter((e) => e.what === 'sfx_scatter_tease' && /loop start/.test(e.detail || '') && e.clock > cut.clock && e.t < (rows[restI]?.t ?? Infinity)).length === 0, `${tag}: the tease loop stops on the cut's frame and does not start again`, log.filter((e) => e.what === 'sfx_scatter_tease'));
				T.check(!st.tease, `${tag}: the tease loop is not held after the round`, st);
				const restClock = restRow ? restRow.clock : Infinity;
				const stopsAfter = log.filter((e) => e.kind === 'sound' && /^sfx_lane_stop_/.test(e.what) && cut && e.clock >= cut.clock && e.clock <= restClock);
				// (on a fail: every stop of the cut spin with its real ms (t) and board clock, and the cut's)
				const spinStops = log.filter((e) => e.kind === 'sound' && /^sfx_lane_stop_/.test(e.what) && e.clock <= restClock).map((e) => [e.what, e.clock, Math.round(e.t)]);
				T.check(stopsAfter.length === 1, `${tag}: the cut's stops sound once (${stopsAfter.length})`, { stopsAfter, spinStops, cut: cut && [cut.clock, Math.round(cut.t)], reelStops: log.filter((e) => e.what === 'reelStop').map((e) => [e.detail, e.clock, Math.round(e.t)]) });
				if (SL.release) {
					const keys = new Set(releasedAt ?? []);
					const tr = rows.find((r) => r.i === slamAt + 1);
					const want = fl.plan.cars.filter((pc) => keys.has(`${pc.lane}:${pc.k}`)).map((pc) => [pc.lane, DIR[pc.lane] > 0 ? COLS - 1 - pc.k : pc.k]);
					const relCars = (tr?.sample.cars ?? []).filter((c) => want.some(([l, col]) => l === c[0] && col === c[1]));
					T.check(keys.size > 0 && relCars.length === keys.size && relCars.every((c) => c[4] && (c[2] === 'in' || c[2] === 'rest') && Math.abs(c[3] - (tr.sample.cars.find((x) => x === c) ?? c)[3]) < 1e9), `${tag}: the car(s) released in the slam frame (${[...keys].join(', ')}) are out of the tunnel on that very frame`, { releasedAt, relCars });
				}
				if (SL.feature) {
					const spins = fl.spins.slice(-4);
					T.check(spins.length === 4 && spins[0].cut && spins.slice(1).every((x) => !x.cut && x.boardMs !== null), `${tag}: the trigger went on into its 3 free spins, each driving in whole (no cut)`, spins.map((x) => [x.cut, x.boardMs]));
				}
				T.check(await R(p, () => window.__reindeer.atRest()), `${tag}: the round ended at rest`);
				// THE NEXT SPIN: a normal one with its own tease, nothing left from the slam
				await R(p, () => window.__reindeer.roadSounds(true));
				const nrows = await stepRound(p, { book: book(boardOf(CASES.miss, 14)), read: READ });
				const nf = await R(p, () => window.__reindeer.flow());
				const nlog = await R(p, () => window.__reindeer.roadSounds());
				T.check(!!nf.plan && !nf.plan.cut && nf.plan.teaseFrom !== null && nlog.some((e) => e.what === 'teaseStart') && !nlog.some((e) => e.what === 'slamCut'), `${tag}: the next spin drives in whole with its own tease (no hurry left over)`, nf.plan && { cut: nf.plan.cut, teaseFrom: nf.plan.teaseFrom });
				T.check(nrows.at(-1).sample.cars.every((c) => c[2] === 'rest') && nrows.at(-1).sample.lights.every((l) => !l[1]) && !(await R(p, () => window.__reindeer.roadSoundState().tease)), `${tag}: the next spin ends parked, lights not teasing, the tease loop off`);
			}
		}

		// 8. SKIP TO RESULT during a tease: the loop stops
		if (SEC('skip')) {
			await R(p, () => window.__reindeer.roadSounds(true));
			let skipped = false;
			await stepRound(p, {
				book: book(boardOf(CASES.miss, 4)),
				read: READ,
				onFrame: async (i, s) => {
					if (skipped) return;
					const f = await R(p, () => window.__reindeer.flow().plan);
					if (f && f.teaseFrom !== null && s.sample.clock - f.start > f.teaseFrom + 60) {
						skipped = true;
						await R(p, () => window.__reindeer.skip(true));
					}
				},
			});
			await R(p, () => window.__reindeer.skip(false));
			const log = await R(p, () => window.__reindeer.roadSounds());
			const st = log.find((e) => e.what === 'sfx_scatter_tease' && /stop/.test(e.detail || ''));
			T.check(skipped && !!st && /skip/.test(st.detail), `${S.name}: under SKIP TO RESULT the tease loop stops (${st?.detail})`, log.filter((e) => e.what === 'sfx_scatter_tease'));
			// nothing left over into the next spin (the game has no skip control; the dev switch stands for it)
			await R(p, () => window.__reindeer.roadSounds(true));
			const nrows = await stepRound(p, { book: book(boardOf(CASES.miss, 15)), read: READ });
			const nlog = await R(p, () => window.__reindeer.roadSounds());
			const nf = await R(p, () => window.__reindeer.flow());
			T.check(!nf.plan.cut && nlog.some((e) => e.what === 'teaseStart') && nlog.some((e) => e.what === 'sfx_scatter_tease' && /loop start/.test(e.detail || '')) && nrows.at(-1).sample.cars.every((c) => c[2] === 'rest') && !(await R(p, () => window.__reindeer.roadSoundState().tease)), `${S.name}: after a skip the next spin teases and sounds normally, ends parked, the loop off`, { cut: nf.plan.cut, tease: nlog.filter((e) => /tease/i.test(e.what)).map((e) => e.what + ' ' + (e.detail || '')) });
		}

		// 8b. AUTOPLAY AT TURBO 1 through teasing spins (pass 8), in real time: every spin teases on its own (no hurry and
		// no tease left over from the one before), and after the run nothing is held (the loop off, the lights still).
		// The Stop autoplay press is also the slam stop of the spin it lands in (controls.svelte.ts spin()), so WHERE it
		// lands decides the last spin's tease: pressed before that spin's tease began, the cut comes first and that spin
		// never starts its loop (right: a slam before the tease has no tease); pressed in its tease, it starts and the cut
		// stops it. Which one happened used to depend on the host's speed (the probe host pressed early, the Mac late), so
		// both are played on purpose: 'early' freezes the board clock on the third play and presses then, 'late' presses
		// once the third spin's tease has begun. One loop start and one stop for each tease that began.
		for (const mode of S.name === 'desktop' && SEC('autoplay') ? ['early', 'late'] : []) {
			const tagA = `${S.name}: autoplay at turbo 1 (Stop pressed ${mode === 'early' ? 'before' : 'in'} the last spin's tease)`;
			await R(p, () => {
				const h = window.__reindeer;
				h.clock(1);
				h.turbo(1);
				h.roadSounds(true);
				h.fixtures.latency(0);
			});
			const queueOne = (salt) => R(p, (b) => window.__reindeer.fixtures.queue(b, 0), book(boardOf(CASES.miss, salt)));
			const before = (await R(p, () => window.__reindeer.fixtures.log().plays.length)) ?? 0;
			// (the spin log keeps the last 40: this run's spins are the ones pressed from this board clock on)
			const clockBefore = await R(p, () => window.__reindeer.flow().clock);
			await queueOne(20);
			await p.click('.hudp button[aria-label="Autoplay"]');
			await sleep(700);
			// the menu's START begins the run at once (2026-11-23: no Spin press; a Spin press now would stop the run)
			await p.click('.am-ui.layer.modals .go').catch(() => {});
			let started = false;
			for (let i = 0; i < 20 && !started; i++) {
				started = await R(p, () => document.querySelector('.hudp button.spin')?.getAttribute('aria-label')?.startsWith('Stop autoplay') === true);
				if (!started) await sleep(150);
			}
			let played = 0;
			const t0 = Date.now();
			while (played < 3 && Date.now() - t0 < 60000) {
				// ('early': the board clock stops in the same page turn that sees the third play, so its tease cannot begin)
				const n = ((await R(p, ({ early, before }) => {
					const h = window.__reindeer;
					const k = h.fixtures.log().plays.length;
					if (early && k - before >= 3) h.clock(0);
					return k;
				}, { early: mode === 'early', before })) ?? 0) - before;
				if (n > played) {
					played = n;
					if (played < 3) await queueOne(20 + played);
				}
				await sleep(20);
			}
			if (mode === 'late')
				for (let i = 0; i < 400; i++) {
					if ((await R(p, () => window.__reindeer.roadSounds().filter((e) => e.what === 'teaseStart').length)) >= 3) break;
					await sleep(20);
				}
			// stop the run (the board clock goes again after the press in 'early'), then wait for the round to end at rest
			if (await R(p, () => document.querySelector('.hudp button.spin')?.getAttribute('aria-label')?.startsWith('Stop autoplay') === true)) await p.click('.hudp button.spin').catch(() => {});
			await sleep(300);
			await R(p, () => window.__reindeer.clock(1));
			for (let i = 0; i < 300; i++) {
				const st = await R(p, () => ({ idle: window.__reindeer.hud.idle(), rest: window.__reindeer.atRest(), auto: document.querySelector('.hudp button.spin')?.getAttribute('aria-label')?.startsWith('Stop autoplay') === true }));
				if (st.idle && st.rest && !st.auto) break;
				await sleep(150);
			}
			const fl = await R(p, () => window.__reindeer.flow());
			const spins = fl.spins.filter((x) => x.pressClock >= clockBefore);
			const st = await R(p, () => window.__reindeer.roadSoundState());
			const lite = await R(p, () => ({ lights: window.__reindeer.flowLite().lights.map((l) => [l.showing, l.teasing]), cars: window.__reindeer.brakes().map((b) => b.phase) }));
			const log = await R(p, () => window.__reindeer.roadSounds());
			T.check(started && spins.length >= 3, `${tagA}: ran ${spins.length} spin(s)`, { started, played });
			T.check(spins.length >= 3 && spins.every((x, i) => x.teaseFrom !== null && x.level === 1 && (!x.cut || i === spins.length - 1)), `${tagA}: every spin planned its own tease, none cut or hurried but the one the Stop press landed in`, spins.map((x) => [x.level, x.teaseFrom, x.cut]));
			const begun = log.filter((e) => e.what === 'teaseStart').length;
			const starts = log.filter((e) => e.what === 'sfx_scatter_tease' && /loop start/.test(e.detail || '')).length;
			const stops = log.filter((e) => e.what === 'sfx_scatter_tease' && /stop/.test(e.detail || '')).length;
			const want = mode === 'early' ? spins.length - 1 : spins.length;
			T.check(spins.length >= 3 && spins.at(-1).cut && begun === want, `${tagA}: the last spin cut, ${begun} of ${spins.length} teases begun (${want} wanted)`, { begun, cut: spins.map((x) => x.cut) });
			T.check(starts === begun && stops === begun && !st.tease, `${tagA}: one tease loop started and stopped per tease begun (${starts} / ${stops} for ${begun}), none held after`, { st, tease: log.filter((e) => e.what === 'sfx_scatter_tease' || /^tease|slamCut/.test(e.what)).map((e) => [e.what, e.detail, e.clock]) });
			T.check(lite.lights.every((l) => !l[1]) && lite.cars.every((ph) => ph === 'rest'), `${tagA}: after the run every car parked, no light teasing`, lite);
			await R(p, () => window.__reindeer.turbo(0));
		}

		// 9. A FEATURE ROUND: decides at three, at most one tease per round
		// 11. A SLAM IN A BONUS ROUND HURRIES ITS OWN SPIN ONLY (2026-11-17, Corey: "if you click on the board during free
		// spins, or super free spins all of the free spins are speed up, instead of the current spin only"): in a Free
		// Spins round and a Super round, at normal speed and at turbo 1, a board tap in free spin 2 cuts that spin; free
		// spin 3 (the same board as free spin 1) then runs its whole normal length with no hurry, its lane stops sound as
		// free spin 1's did, and the round ends at rest
		if (S.name === 'desktop' && SEC('bonusSlam')) {
			const plain = boardOf([], 21);
			// (BONUSTURBO=0 or 1 plays that turbo level's two rounds only: four rounds take longer than one lock turn)
			const BT = process.env.BONUSTURBO;
			for (const [bonusType, turbo] of [['freespins', 0], ['super', 0], ['freespins', 1], ['super', 1]].filter(([, t]) => BT === undefined || String(t) === BT)) {
				const tag = `${S.name}: ${bonusType === 'super' ? 'Super' : 'Free Spins'} at turbo ${turbo}, a board tap in free spin 2`;
				const ev = [
					{ type: 'reveal', gameType: 'basegame', board: boardOf([[0, 1], [1, 3], [2, 2]], 20) },
					{ type: 'freeSpinTrigger', totalFs: 3, cells: [1 * 4 + 0, 3 * 4 + 1, 2 * 4 + 2], bonusType },
					{ type: 'reveal', gameType: 'freegame', board: plain, fs: 1, totalFs: 3, held: [] },
					{ type: 'reveal', gameType: 'freegame', board: boardOf([], 22), fs: 2, totalFs: 3, held: [] },
					{ type: 'reveal', gameType: 'freegame', board: plain, fs: 3, totalFs: 3, held: [] },
					{ type: 'freeSpinEnd', amount: 0 },
					{ type: 'setTotalWin', amount: 0 },
					{ type: 'finalWin', amount: 0 },
				].map((e, i) => ({ index: i, ...e }));
				await R(p, () => window.__reindeer.roadSounds(true));
				const bl = await R(p, () => window.__reindeer.boardLayout().css);
				let tapped = null;
				let fs2At = null;
				// (the free spin under way: stateGame.spinsPlayed is set at each free spin's reveal; the road's spin log keeps 40)
				const rows = await stepRound(p, {
					book: ev,
					turbo,
					maxFrames: 5000,
					read: (h) => ({ fs: h.freeSpinNow(), hurry: h.hurryLevel(), clock: h.road().clock }),
					onFrame: async (i, s) => {
						if (tapped !== null || s.sample.fs !== 2) return;
						fs2At ??= s.sample.clock;
						const f = await R(p, () => window.__reindeer.flow().plan);
						if (!f || f.cut || f.start < fs2At || s.sample.clock - f.start < 150) return;
						tapped = i;
						await p.mouse.click(bl.x + bl.width / 2, bl.y + bl.height / 2);
					},
				});
				const fl = await R(p, () => window.__reindeer.flow());
				const log = await R(p, () => window.__reindeer.roadSounds());
				// the round's four drive ins: the trigger spin, free spins 1, 2 and 3
				const sp = fl.spins.slice(-4);
				const stopsIn = (x) => (x ? log.filter((e) => e.kind === 'sound' && /^sfx_lane_stop_/.test(e.what) && e.clock >= x.startClock - 1 && e.clock <= (x.restClock ?? Infinity) + 1).length : -1);
				const s1 = sp[1];
				const s3 = sp[3];
				// each free spin's own frames from its drive in to its rest, on the board clock
				const lenOf = (fs, x) => (x && x.restClock !== null ? rows.filter((r) => r.sample.fs === fs && r.sample.clock >= x.startClock && r.sample.clock <= x.restClock).length : -1);
				const len1 = lenOf(1, s1);
				const len3 = lenOf(3, s3);
				const f1 = rows.filter((r) => r.sample.fs === 1).length;
				const hurry3 = rows.filter((r) => r.sample.fs === 3).map((r) => r.sample.hurry);
				const f3 = hurry3.length;
				T.check(tapped !== null && sp.length === 4 && sp[2].cut && !sp[1].cut && !sp[3].cut, `${tag}: the tap cut free spin 2 only (cuts: ${sp.map((x) => x.cut).join(' ')})`, { tapped, sp: sp.map((x) => [x.cut, x.level]) });
				T.check(f3 > 0 && hurry3.length > 0 && hurry3.every((h) => h === 0), `${tag}: free spin 3 runs with no hurry on any of its ${hurry3.length} frames`, [...new Set(hurry3)]);
				T.check(len1 > 0 && len3 > 0 && Math.abs(len3 - len1) <= 2 && s3.level === s1.level && s3.level === 0, `${tag}: free spin 3 takes its full normal length: ${len3} frames from its drive in to its rest, as free spin 1 (same board) took ${len1} (speed level ${s3?.level}, as free spin 1's ${s1?.level}: a bonus round enters at regular speed whatever the base game's turbo level, the stock rule of 2026-11-17)`, { len1, len3, f1 });
				const st1 = stopsIn(s1);
				const st3 = stopsIn(s3);
				T.check(st1 > 0 && st3 === st1, `${tag}: free spin 3's lane stops sound as free spin 1's did (${st3} and ${st1})`, { st1, st3 });
				T.check(await R(p, () => window.__reindeer.atRest() && window.__reindeer.hud.idle()), `${tag}: the round ended at rest`);
				await R(p, () => window.__reindeer.clock(1));
				await sleep(800);
			}
		}

		if (S.name === 'desktop' && SEC('feature')) {
			const two = boardOf(CASES.miss, 5);
			const two2 = boardOf(CASES.top2, 6);
			const three = boardOf(CASES.fs, 7);
			const trigger = boardOf([[0, 1], [1, 3], [2, 2]], 8);
			const ev = [
				{ type: 'reveal', gameType: 'basegame', board: trigger },
				{ type: 'freeSpinTrigger', totalFs: 3, cells: [1 * 4 + 0, 3 * 4 + 1, 2 * 4 + 2], bonusType: 'freespins' },
				{ type: 'reveal', gameType: 'freegame', board: two, fs: 1, totalFs: 3, held: [] },
				{ type: 'reveal', gameType: 'freegame', board: two2, fs: 2, totalFs: 3, held: [] },
				{ type: 'reveal', gameType: 'freegame', board: three, fs: 3, totalFs: 3, held: [] },
				{ type: 'freeSpinEnd', amount: 0 },
				{ type: 'setTotalWin', amount: 0 },
				{ type: 'finalWin', amount: 0 },
			].map((e, i) => ({ index: i, ...e }));
			await R(p, () => window.__reindeer.roadSounds(true));
			await stepRound(p, { book: ev, read: (h) => h.road().clock, maxFrames: 4000 });
			const fl = await R(p, () => window.__reindeer.flow());
			const spins = fl.spins.slice(-4);
			T.check(spins.length === 4 && spins[0].teaseFrom !== null && spins[1].teaseFrom !== null && spins[2].teaseFrom === null && spins[3].teaseFrom === null, `${S.name}: the feature round: the trigger spin teased (base game), the first free spin with two teased, the next free spins had none (one per feature)`, spins.map((x) => [x.scatters, x.teaseFrom]));
			// the decide rule of a feature spin, by hand: three scatters decide (the retrigger), so no red and amber step
			await R(p, (b) => {
				const r = window.__reindeer.roadBoard();
				window.__reindeer.clock(0);
				r.driveIn(b, 0, { free: true, tease: true });
			}, three);
			await R(p, (ms) => window.__reindeer.step(ms, 260), FRAME);
			const fp = (await R(p, () => window.__reindeer.flow())).plan;
			const page3 = pageSchedule(CASES.fs, PAGE, 3);
			T.check(fp.decideAt === 3 && fp.threeFrom === null && fp.teaseEnd === fp.seen[2] && fp.cars.every((c) => {
				const q = page3.cars.find((x) => x.l === c.lane && x.k === c.k);
				return Math.abs(q.rel - c.rel) < 0.2;
			}), `${S.name}: a free spin with three: the tease ends at the third seen (the retrigger decided) and the rest clear through, as the page's schedule with three deciding`, fp);
			await R(p, () => window.__reindeer.clock(1));
			await sleep(800);
		}
		T.check(errs.length === 0, `${S.name}: no page errors or console errors`, errs.slice(0, 5));
	}

	// 10. CLIPS (60 fps frames of the board, CLIPS=1): a plain spin, a tease that misses, three, four, and a slam in a tease
	if (CLIPS && OUT) {
		// CLIPCASES=a,b picks clips; CLIPDPR=<n> renders them at that device pixel ratio (the frames are the board's box)
		const pick = (process.env.CLIPCASES || '').split(',').filter(Boolean);
		for (const S0 of SIZES.filter((s) => s.name !== 'short')) {
			const S = process.env.CLIPDPR ? { ...S0, dpr: Number(process.env.CLIPDPR) } : S0;
			const { p } = await boot(browser, S, 'laneclip');
			const box = await R(p, () => window.__reindeer.boardLayout().css);
			const clip = { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 60), width: Math.min(S.vp.width - Math.max(0, box.x - 40), box.width + 80), height: box.height + 120 };
			for (const [name, scat, slam] of [['plain', CASES.none], ['tease_miss', CASES.miss], ['three_free_spins', CASES.fs], ['four_super', CASES.sup], ['slam_in_tease', CASES.miss, true]].filter(([n]) => !pick.length || pick.includes(`${n}_${S.name}`))) {
				const dir = join(OUT, 'clips', `${name}_${S.name}`);
				mkdirSync(dir, { recursive: true });
				let slamDone = false;
				await stepRound(p, {
					book: book(boardOf(scat, 9)),
					read: (h) => h.road().clock,
					frames: dir,
					clip,
					onFrame: slam
						? async (i) => {
								if (slamDone) return;
								const f = await R(p, () => window.__reindeer.flow().plan);
								const c = await R(p, () => window.__reindeer.road().clock);
								if (f && f.teaseFrom !== null && c - f.start > f.teaseFrom + 360) {
									slamDone = true;
									await p.click('.hudp button.spin');
								}
							}
						: null,
				});
				console.log(`clip ${name} ${S.name}`);
			}
			await p.context().close();
		}
	}
} finally {
	await browser.close();
}
if (OUT && !CLIPSONLY) {
	const md = ['# Lane by lane traffic: spin length and release times per scatter case', '', 'boardMs: the press to the board at rest on the road clock; realMs: the same in real time at that turbo level (board ms / rate). teaseFrom / threeFrom / teaseEnd / end: ms from the first release. rel: lane.place (S = scatter) @ release ms.', '', '| size | turbo | case | scatters | press to rest (real ms) | board ms | tease from | three from | tease end | last stop | cap factor | held back |', '|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
	for (const r of table) md.push(`| ${r.size} | ${r.level} | ${r.name} | ${r.scatters} | ${r.realMs} | ${r.boardMs} | ${r.teaseFrom ?? '-'} | ${r.threeFrom ?? '-'} | ${r.teaseEnd ?? '-'} | ${r.end} | ${r.factor} | ${r.held} |`);
	md.push('', '## Release times (ms from the first release)', '');
	for (const r of table) md.push(`- ${r.size} turbo ${r.level} ${r.name}: ${r.rel}`);
	writeFileSync(join(OUT, 'table.md'), md.join('\n'));
	writeFileSync(join(OUT, 'table.json'), JSON.stringify(table, null, 1));
}
console.log(`\nlane_stagger_probe: ${T.pass} pass, ${T.fail} fail`);
for (const f of T.fails) console.log('  FAIL: ' + f);
process.exit(T.fail ? 1 : 0);
