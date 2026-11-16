// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
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
//   - THE CAP: a tease that would take the spin past capMs is compressed so the press to rest is at most capMs
//   - A FEATURE ROUND: a free spin decides at three (the retrigger) and teases at most once per round
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
		console.log(`-- ${S.name} ${S.vp.width}x${S.vp.height}`);
		const tune = await R(p, () => JSON.parse(JSON.stringify({ flow: window.__reindeer.tune.laneFlow, light: window.__reindeer.tune.stoplight.tease, brake: window.__reindeer.tune.brakeLights, sound: window.__reindeer.tune.sound.tease, motion: window.__reindeer.tune.motion })));
		T.check(tune.flow.normal.laneGapMs === PAGE.gap && tune.flow.driveInMs === PAGE.travel && tune.flow.normal.carGapMs === PAGE.car && tune.flow.tease.twoGapMs === PAGE.t1 && tune.flow.tease.threeGapMs === PAGE.t2 && tune.flow.normal.clearGapMs === PAGE.clear && tune.flow.seenMs === PAGE.seen, `${S.name}: the game's numbers are Corey's (lane gap 100, drive in 680, car gap 70, two seen 360, three seen 390, clear 60, seen 110)`, tune.flow);
		const levels = S.name === 'desktop' ? [0, 1, 2] : [0];
		// every case at normal speed on the desktop; the turbo levels and the phone the cases that differ (none, a tease
		// that misses, three, four, the cap)
		const casesFor = (level) => (S.name === 'desktop' && level === 0 ? Object.keys(CASES) : S.name === 'desktop' ? ['none', 'miss', 'top3', 'sup', 'cap'] : ['none', 'miss', 'fs']);
		for (const level of levels) {
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
				const capped = page.end > budget && plan.factor < 1;
				// 1. THE PLAN against the page (a capped case: against the page with the compressed tease gaps)
				const ref = capped ? pageSchedule(scat, { ...P, t1: P.t1 * plan.factor, t2: P.t2 * plan.factor }) : page;
				const byKey = new Map(ref.cars.map((q) => [`${q.l}:${q.k}`, q]));
				const bad = plan.cars.filter((c) => {
					const q = byKey.get(`${c.lane}:${c.k}`);
					return !q || Math.abs(q.rel - c.rel) > 0.2 || Math.abs(q.dur - c.dur) > 0.2 || q.fs !== c.scatter;
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
				if (level === 0) T.check(spin && spin.boardMs <= 6500 + FRAME * 2, `${tag}: the press to rest ${spin?.boardMs} ms is within the 6.5 s cap`, spin);
				if (name === 'cap' && level === 0) T.check(page.end > budget && plan.factor < 1, `${tag}: the tease would end the drive in at ${Math.round(page.end)} ms, past the budget ${budget}: compressed by ${plan.factor}`, { pageEnd: page.end, budget, factor: plan.factor });
			}
		}

		// 7. THE SLAM STOP during a tease: straight to the stopped board, the tease sound stops, one stop sound
		{
			const scat = CASES.miss;
			await R(p, () => window.__reindeer.roadSounds(true));
			let slamAt = null;
			const rows = await stepRound(p, {
				book: book(boardOf(scat, 3)),
				read: READ,
				onFrame: async (i, s) => {
					if (slamAt !== null) return;
					const f = await R(p, () => window.__reindeer.flow().plan);
					if (f && f.teaseFrom !== null && s.sample.clock - f.start > f.teaseFrom + 120) {
						slamAt = i;
						await p.click('.hudp button.spin');
					}
				},
			});
			const log = await R(p, () => window.__reindeer.roadSounds());
			const fl = await R(p, () => window.__reindeer.flow());
			const cut = log.find((e) => e.what === 'slamCut');
			T.check(slamAt !== null && !!cut && fl.plan.cut, `${S.name}: a slam stop pressed during the tease cut the drive in`, { slamAt, cut });
			// (the cut's moment is logged on the clock of the frame before it: the road's sound log takes its clock as a frame
			// begins its features' update, and the cut comes first in the frame)
			const after = rows.filter((r) => cut && r.sample.clock > cut.clock);
			T.check(after.length > 0 && after.every((r) => r.sample.cars.every((c) => c[2] === 'rest' || (c[2] === 'in' && c[4]))), `${S.name}: from the cut every car stands at its spot (none left in the tunnel or on its way)`, after[0]?.sample.cars.filter((c) => !(c[2] === 'rest' || c[4])));
			const teaseStop = log.find((e) => e.what === 'sfx_scatter_tease' && /slam stop/.test(e.detail || ''));
			T.check(!!teaseStop && cut && teaseStop.clock === cut.clock, `${S.name}: the tease loop stops on the cut's frame`, log.filter((e) => e.what === 'sfx_scatter_tease'));
			const stopsAfter = log.filter((e) => e.kind === 'sound' && /^sfx_lane_stop_/.test(e.what) && cut && e.clock >= cut.clock);
			T.check(stopsAfter.length === 1, `${S.name}: the cut's stops sound once (${stopsAfter.length})`, stopsAfter);
			T.check(after.slice(0, 3).every((r) => r.sample.lights.every((l) => l[0] === 'red')), `${S.name}: both lights red at the slam`, after.slice(0, 3).map((r) => r.sample.lights));
			// the round's next spin is not hurried: the hurry ends with the round (a later free spin hurried would have no tease)
		}

		// 8. SKIP TO RESULT during a tease: the loop stops
		{
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
		}

		// 9. A FEATURE ROUND: decides at three, at most one tease per round
		if (S.name === 'desktop') {
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
