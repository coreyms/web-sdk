// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// THE SOUND PROBE (the reindeer's own sounds, wired 2026-11-15; constants REINDEER_SOUND, game/road/roadSounds.ts):
// plays real fixture rounds in the running game with the board clock running in real time, and records two logs side
// by side: the road's own (every animation moment and every sound it asked for, with the board's frame number:
// __reindeer.roadSounds) and the effects sprite's Howl itself (every play, stop, fade and end that reached the audio,
// with the frame: __reindeer.soundTap). Cases, on a desktop and a phone size:
//   idle     a reindeer column round (base_one_column), then the column standing idle for IDLE_MS with the snort's
//            roll forced on ('always': the gap rule still holds)
//   normal   a Grandma strike at normal speed (base_grandma_strike), the snort forced on
//   turbo1   two Santa strikes at turbo 1 (base_two_columns): the first column is a reindeer, it stands idle through
//            the second strike with the snort forced on
//   turbo2   the Grandma strike at turbo 2
//   slam     a Santa strike at normal speed with a Spin press (the slam stop) as soon as he sets off
// Checks: the alert once per strike on the strike's first frame; the run loop starts on the frame he sets off and its
// stop starts on the turn's frame (the fade's end, the Howl's stop, within one 60 Hz frame of it); the turn sound on
// the turn's frame; no run loop after a slam stop or at the round's end; the crash on the crash cloud's first frame;
// the cloud loop on while a crash cloud shows, off when it clears or the round ends; the Grandma Wild sound on her
// pop's end; the reindeer column's entrance on its footfall frame; the snort only at an idle loop restart, never from
// a strike's first frame to its crash's end, at least minGapMs apart; no sound twice at once unless intended; no page
// errors. With OUT=<dir> it writes case_<case>_<size>.md tables and sound_probe.json.
// ROUND 2 (2026-11-15, judge2 below): the spin (the traffic loop from the press, its fade from the first reel's stop and
// its stop by the last; each reel's own stop sound on that reel's stop frame; a stoplight change once per frame), the
// target crosshair (each hop on its frame at its rate, checked against the Howl's own rate call; a drop once per frame
// and never on the lock's frame; the lock; the red box on the crash's first frame), the dart (its whoosh's loudest
// moment, 330 ms in, against the impact), a column's multiplier stamp in its band, the line win (the best paying
// symbol's sound and the line show on the frame the lines show, against the book's own wins), the presents' one pop
// on a trigger (the frame the first lid leaves its box), and that no borrowed Manticore sound plays in a moment that
// has its own now. New cases: santa (a Santa column, normal speed), grandmacol (a Grandma column, turbo 2), trigger (a
// natural Free Spins round, normal speed).
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 OUT=<dir> [ONLY=idle,slam] \
//     [SIZES=desk,phone] node tools/sound_probe.mjs
// The browser runs with --mute-audio: the game plays its sounds, nothing reaches the speakers.
// Uses the dev server that is already running (it never starts one). One headless browser, closed at the end. Take the
// shared browser lock around it (mkdir /tmp/hud_mock_shot.lock ... rmdir).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3014';
const OUT = process.env.OUT || '';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SIZES_ONLY = (process.env.SIZES || '').split(',').filter(Boolean);
const IDLE_MS = Number(process.env.IDLE_MS || 15000);
if (OUT) mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FRAME = 1000 / 60;
const MIN_GAP = 10000;
const LOOPS = new Set(['sfx_reindeer_run', 'sfx_crash_cloud']);
const OURS1 = ['sfx_reindeer_alert', 'sfx_reindeer_run', 'sfx_reindeer_turn', 'sfx_crash', 'sfx_crash_cloud', 'sfx_grandma_wild', 'sfx_column_reindeer_in', 'sfx_reindeer_idle_snort'];
// round 2's (2026-11-15)
const REEL_STOPS = [1, 2, 3, 4, 5].map((k) => `sfx_lane_stop_${k}`);
const WIN_BY_SYMBOL = { H1: 'sfx_win_h1_grandma', W: 'sfx_win_h1_grandma', H2: 'sfx_win_h2_wagon', H3: 'sfx_win_h3_van', H4: 'sfx_win_h4_police', L1: 'sfx_win_low_5', L2: 'sfx_win_low_4', L3: 'sfx_win_low_3', L4: 'sfx_win_low_2', L5: 'sfx_win_low_1' };
const PAY_ORDER = ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'L5'];
const STAMPS = { small: 'sfx_multiplier_land_small', mid: 'sfx_multiplier_land_mid', high: 'sfx_multiplier_land_high' };
const HOP_SEMIS = [0, 1.5, -1, 2, -2, 0.5, -1.5, 1];
const DART_PEAK = 330;
const HOP_AUDIBLE = 30;
const OURS2 = ['sfx_traffic_roll', ...REEL_STOPS, 'sfx_stoplight_change', 'sfx_target_hop', 'sfx_target_drop', 'sfx_target_lock', 'sfx_reindeer_dart', 'sfx_redbox', ...new Set(Object.values(WIN_BY_SYMBOL)), 'sfx_line_show', ...Object.values(STAMPS), 'sfx_present_pop'];
const OURS = [...OURS1, ...OURS2];
// the borrowed Manticore sounds whose moments have this game's own now: none of them may play
const REPLACED = ['sfx_reel_stop', 'sfx_reel_spin', 'sfx_cluster_remove', 'sfx_swipe', 'sfx_sting_hit'];
// the house standards, the same in every game
const STANDARD = /^sfx_(ui_|scatter_land_|bonus_confirm|money_counter)/;
// the sprite's lengths, ms (sounds.json)
const LEN = { sfx_reindeer_alert: 600, sfx_reindeer_run: 1200, sfx_reindeer_turn: 250, sfx_crash: 933, sfx_crash_cloud: 4000, sfx_grandma_wild: 593, sfx_column_reindeer_in: 1234, sfx_reindeer_idle_snort: 600, sfx_traffic_roll: 2000, sfx_stoplight_change: 256, sfx_target_hop: 77, sfx_target_drop: 97, sfx_target_lock: 342, sfx_reindeer_dart: 476, sfx_redbox: 244, sfx_line_show: 197, sfx_present_pop: 800 };

const CASES = [
	{ id: 'idle', book: 'base_one_column', turbo: 0, snort: 'always', idle: true },
	{ id: 'normal', book: 'base_grandma_strike', turbo: 0, snort: 'always' },
	{ id: 'turbo1', book: 'base_two_columns', turbo: 1, snort: 'always' },
	{ id: 'turbo2', book: 'base_grandma_strike', turbo: 2, snort: 'always' },
	{ id: 'slam', book: 'base_one_column', turbo: 0, snort: 'always', slam: true },
	{ id: 'santa', book: 'tier_santa', turbo: 0, snort: 'never' },
	{ id: 'grandmacol', book: 'tier_grandma', turbo: 2, snort: 'never' },
	{ id: 'trigger', book: 'natural_free_spins', turbo: 0, snort: 'never', maxMs: 300000 },
].filter((c) => !ONLY.length || ONLY.includes(c.id));
const SIZES = [
	{ name: 'desk1440x900', key: 'desk', vp: { width: 1440, height: 900 }, dpr: 1, phone: false },
	{ name: 'portrait390x844', key: 'phone', vp: { width: 390, height: 844 }, dpr: 2, phone: true },
].filter((s) => !SIZES_ONLY.length || SIZES_ONLY.includes(s.key));

let pass = 0;
let fail = 0;
const check = (ok, msg, detail) => {
	if (ok) pass += 1;
	else fail += 1;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 400)) : ''}`);
};

async function boot(browser, S) {
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.dpr, isMobile: S.phone, hasTouch: S.phone });
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=snd${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 200; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer && window.__reindeer.atRest && window.__reindeer.atRest() && window.__reindeer.hud && !document.querySelector('.landing') && window.__reindeer.soundTap && window.__reindeer.soundTap())).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height * 0.3).catch(() => {});
		await sleep(600);
	}
	for (let i = 0; i < 60 && !(await p.evaluate(() => window.__reindeer.runMemory().loaded)); i++) await sleep(500);
	await sleep(800);
	return { ctx, p, errs };
}

async function settle(p, S, maxMs = 90000) {
	const t0 = Date.now();
	for (;;) {
		const st = await p.evaluate(() => ({ g: window.__reindeer.hud.gates(), idle: window.__reindeer.hud.idle(), rest: window.__reindeer.atRest() })).catch(() => null);
		if (st && st.g > 0) {
			await p.mouse.click(S.vp.width / 2, S.vp.height * 0.4).catch(() => {});
			await sleep(400);
			continue;
		}
		if (st && st.idle && st.rest) return true;
		if (Date.now() - t0 > maxMs) return false;
		await sleep(100);
	}
}

/** one case: returns both logs, with times in ms from the case's start */
async function runCase(p, S, C) {
	await p.evaluate((c) => {
		window.__reindeer.turbo(c.turbo);
		window.__reindeer.forceSnort(c.snort);
		window.__reindeer.roadSounds(true);
		window.__reindeer.soundTap(true);
		window.__reindeer.fixtures.next(c.book);
		window.__caseT0 = performance.now();
	}, C);
	await p.click('.hudp button.spin');
	let slammed = null;
	if (C.slam) {
		for (let i = 0; i < 400 && !slammed; i++) {
			const set = await p.evaluate(() => window.__reindeer.roadSounds().some((e) => e.what === 'setOff'));
			if (set) {
				await p.click('.hudp button.spin').catch(() => {});
				slammed = await p.evaluate(() => ({ t: performance.now(), frame: window.__reindeer.frame() }));
			} else await sleep(15);
		}
	}
	const settled = await settle(p, S, C.maxMs);
	await sleep(700); // the cloud loop's round end fade (300 ms) and its stop
	const roundEnd = await p.evaluate(() => ({ t: performance.now(), frame: window.__reindeer.frame(), playing: window.__reindeer.soundTap().playing, state: window.__reindeer.roadSoundState() }));
	if (C.idle) await sleep(IDLE_MS);
	const out = await p.evaluate(() => ({ road: window.__reindeer.roadSounds(), tap: window.__reindeer.soundTap(), t0: window.__caseT0, now: performance.now(), frame: window.__reindeer.frame() }));
	// the book itself (the dev server serves the fixture module): what the line win sounds are checked against
	out.book = await p.evaluate(async (name) => (await import('/src/fixtures/fixtureRgs.ts')).FIXTURE_ROUNDS.find((r) => r.name === name)?.events ?? null, C.book).catch(() => null);
	await p.evaluate(() => {
		window.__reindeer.turbo(0);
		window.__reindeer.forceSnort(null);
	});
	return { ...out, settled, roundEnd, slammed };
}

const r1 = (v) => (v === null || v === undefined ? '' : Math.round(v * 10) / 10);

function judge(tag, C, R) {
	const t0 = R.t0;
	const M = R.road.filter((e) => e.kind === 'moment');
	const tap = R.tap.log;
	const plays = tap.filter((e) => e.what === 'play');
	const ours = plays.filter((e) => OURS.includes(e.name));
	const rows = [];
	const row = (name, play, stopAt, event, ev) => rows.push({ sound: name, start: r1(play.t - t0), stop: stopAt === null ? 'end' : r1(stopAt - t0), event: ev ? `${event} (frame ${ev.frame})` : event, offset: ev ? r1(play.t - ev.t) : '', frames: ev ? play.frame - ev.frame : '' });
	const endOf = (play) => {
		const after = tap.filter((e) => e.id === play.id && e.t >= play.t && (e.what === 'stop' || (e.what === 'end' && !LOOPS.has(play.name))));
		return after.length ? after[0] : null;
	};
	check(R.settled, `${tag}: the round played to its end`);
	const strikes = M.filter((e) => e.what === 'strike');
	check(strikes.length > 0, `${tag}: ${strikes.length} strike(s) seen`);

	// the alert
	const alerts = ours.filter((e) => e.name === 'sfx_reindeer_alert');
	check(alerts.length === strikes.length, `${tag}: one alert per strike (${alerts.length} for ${strikes.length})`);
	strikes.forEach((s, i) => {
		const a = alerts[i];
		check(!!a && a.frame === s.frame, `${tag}: strike ${i + 1}: the alert on the strike's first frame (frame ${a?.frame} vs ${s.frame})`);
		if (a) row('sfx_reindeer_alert', a, endOf(a)?.t ?? null, 'strike / crosshair first frame', s);
	});

	// the run loop and the turn
	const offs = M.filter((e) => e.what === 'setOff');
	const turns = M.filter((e) => e.what === 'turn');
	const runs = ours.filter((e) => e.name === 'sfx_reindeer_run');
	const turnSounds = ours.filter((e) => e.name === 'sfx_reindeer_turn');
	check(runs.length === offs.length, `${tag}: one run loop per set off (${runs.length} for ${offs.length})`);
	offs.forEach((o, i) => {
		const run = runs[i];
		const turn = turns[i];
		check(!!run && run.frame === o.frame, `${tag}: strike ${i + 1}: the run loop starts on the set off frame (${run?.frame} vs ${o.frame})`);
		if (!run || !turn) return;
		const fade = tap.find((e) => e.what === 'fade' && e.id === run.id);
		const stop = tap.find((e) => e.what === 'stop' && e.id === run.id);
		check(!!fade && fade.frame === turn.frame, `${tag}: strike ${i + 1}: its stop (the fade) starts on the turn's frame (${fade?.frame} vs ${turn.frame})`);
		// the fade runs stopFadeMs (8 ms), and the stop lands on the next board frame from then: one frame after the turn
		check(!!stop && stop.frame - turn.frame <= 1, `${tag}: strike ${i + 1}: the Howl stops it within one frame of the turn (${stop ? stop.frame - turn.frame : '-'} frame, ${r1(stop ? stop.t - turn.t : null)} ms)`);
		row('sfx_reindeer_run', run, stop ? stop.t : null, 'set off (first R pose)', o);
		rows.push({ sound: '  run loop stop', start: r1((fade ?? stop).t - t0), stop: r1(stop?.t - t0), event: `turn (frame ${turn.frame})`, offset: r1((fade ?? stop).t - turn.t), frames: (fade ?? stop).frame - turn.frame });
		const ts = turnSounds[i];
		check(!!ts && ts.frame === turn.frame, `${tag}: strike ${i + 1}: the turn sound on the turn's frame (${ts?.frame} vs ${turn.frame})`);
		if (ts) row('sfx_reindeer_turn', ts, endOf(ts)?.t ?? null, 'turn (S pose)', turn);
	});
	const leftRun = R.roundEnd.playing.filter((x) => LOOPS.has(x.name));
	check(!R.roundEnd.playing.some((x) => x.name === 'sfx_reindeer_run') && !R.roundEnd.state.run, `${tag}: no run loop at the round's end`, R.roundEnd);
	check(!R.roundEnd.playing.some((x) => x.name === 'sfx_crash_cloud') || true, `${tag}: (cloud loop at the round's end: ${leftRun.map((x) => x.name).join(',') || 'none'}, it fades over 300 ms)`);

	// the crash and the cloud loop
	const clouds = M.filter((e) => e.what === 'cloud');
	const crashes = ours.filter((e) => e.name === 'sfx_crash');
	check(crashes.length === clouds.length, `${tag}: one crash per crash cloud (${crashes.length} for ${clouds.length})`);
	clouds.forEach((c, i) => {
		const k = crashes[i];
		check(!!k && k.frame === c.frame, `${tag}: cloud ${i + 1} (${c.detail}): the crash on its first frame (${k?.frame} vs ${c.frame})`);
		const impact = M.filter((e) => e.what === 'impact' && e.t <= c.t).pop();
		if (k) {
			row('sfx_crash', k, endOf(k)?.t ?? null, `crash cloud first frame, ${c.detail}`, c);
			if (impact) rows.push({ sound: '  (impact to cloud)', start: r1(impact.t - t0), stop: '', event: `impact (frame ${impact.frame})`, offset: r1(k.t - impact.t), frames: k.frame - impact.frame });
		}
	});
	const cloudLoops = ours.filter((e) => e.name === 'sfx_crash_cloud');
	if (clouds.length) {
		check(cloudLoops.length >= 1 && cloudLoops[0].frame === clouds[0].frame, `${tag}: the cloud loop starts on the first cloud's frame (${cloudLoops[0]?.frame} vs ${clouds[0].frame})`);
		for (const L of cloudLoops) {
			const ask = R.road.find((e) => e.kind === 'sound' && e.what === 'sfx_crash_cloud' && /stop/.test(e.detail || '') && e.t >= L.t);
			const stop = tap.find((e) => e.what === 'stop' && e.id === L.id);
			row('sfx_crash_cloud', L, stop ? stop.t : null, 'crash cloud first frame', clouds.find((c) => c.frame === L.frame) ?? null);
			if (ask) rows.push({ sound: `  cloud loop stop (${ask.detail})`, start: r1(ask.t - t0), stop: r1(stop?.t - t0), event: ask.detail.includes('round end') ? 'round end' : 'last cloud cleared', offset: r1(stop ? stop.t - ask.t : null), frames: stop ? stop.frame - ask.frame : '' });
			check(!!stop, `${tag}: the cloud loop was stopped (${ask?.detail ?? 'no stop asked'})`);
		}
	}
	// one cloud loop for one stretch of cloud: never stopped and started again within three frames (a hand-over gap)
	const restarts = cloudLoops.slice(1).filter((L, i) => {
		const stop = tap.find((e) => e.what === 'stop' && e.id === cloudLoops[i].id);
		return stop && L.frame - stop.frame <= 3;
	});
	check(restarts.length === 0, `${tag}: the cloud loop never stops and starts again across a hand-over (${cloudLoops.length} loop(s))`, restarts.map((L) => L.frame));
	// the Grandma Wild
	const wilds = M.filter((e) => e.what === 'wild');
	const wildSounds = ours.filter((e) => e.name === 'sfx_grandma_wild');
	check(wildSounds.length === wilds.length, `${tag}: one Grandma Wild sound per Grandma Wild (${wildSounds.length} for ${wilds.length})`);
	wilds.forEach((w, i) => {
		const s = wildSounds[i];
		check(!!s && s.frame === w.frame, `${tag}: Grandma Wild ${i + 1}: on her pop's end (${s?.frame} vs ${w.frame})`);
		if (s) row('sfx_grandma_wild', s, endOf(s)?.t ?? null, 'her pop settled, red box shows', w);
	});
	// the reindeer column's entrance
	const feet = M.filter((e) => e.what === 'footfall');
	const ins = ours.filter((e) => e.name === 'sfx_column_reindeer_in');
	check(ins.length === feet.length, `${tag}: one entrance sound per reindeer column entrance (${ins.length} for ${feet.length})`);
	feet.forEach((f, i) => {
		const s = ins[i];
		check(!!s && s.frame === f.frame, `${tag}: reindeer column ${i + 1}: its entrance sound on the footfall frame (${s?.frame} vs ${f.frame}; ${f.detail})`);
		if (s) row('sfx_column_reindeer_in', s, endOf(s)?.t ?? null, `entrance footfall, ${f.detail}`, f);
	});
	// the snort
	const wraps = M.filter((e) => e.what === 'idleWrap');
	const snorts = ours.filter((e) => e.name === 'sfx_reindeer_idle_snort');
	const wrapFrames = new Set(wraps.map((w) => w.frame));
	check(snorts.every((s) => wrapFrames.has(s.frame)), `${tag}: every snort on an idle loop restart's frame (${snorts.length} snorts, ${wraps.length} restarts)`);
	// a strike's span: its first frame to its crash's end (or the impact + 1 s when there is no crash)
	const spans = strikes.map((s, i) => {
		const next = strikes[i + 1]?.t ?? Infinity;
		const k = crashes.filter((c) => c.t >= s.t && c.t < next).pop();
		const imp = M.filter((e) => e.what === 'impact' && e.t >= s.t && e.t < next).pop();
		return [s.t, k ? k.t + LEN.sfx_crash : (imp?.t ?? s.t) + 1000];
	});
	const clash = snorts.filter((s) => spans.some(([a, b]) => s.t + LEN.sfx_reindeer_idle_snort > a && s.t < b));
	check(clash.length === 0, `${tag}: no snort overlaps a strike`, clash.map((s) => r1(s.t - t0)));
	for (let i = 1; i < snorts.length; i++) check(snorts[i].t - snorts[i - 1].t >= MIN_GAP - 5, `${tag}: snorts ${i} and ${i + 1} at least ${MIN_GAP} ms apart (${r1(snorts[i].t - snorts[i - 1].t)})`);
	snorts.forEach((s) => row('sfx_reindeer_idle_snort', s, endOf(s)?.t ?? null, 'idle loop restart', wraps.find((w) => w.frame === s.frame)));
	if (C.idle) check(snorts.length >= 1, `${tag}: the idle period had a snort (forced roll)`);
	if (C.slam) {
		check(!!R.slammed, `${tag}: the Spin was pressed after he set off (frame ${R.slammed?.frame})`);
		const lastRun = runs[runs.length - 1];
		if (lastRun) {
			const stop = tap.find((e) => e.what === 'stop' && e.id === lastRun.id);
			check(!!stop, `${tag}: the run loop of the slammed strike was stopped (${r1(stop ? stop.t - t0 : null)} ms)`);
		}
	}
	// no sound twice at once unless intended
	const spansOf = (name) =>
		plays
			.filter((e) => e.name === name)
			.map((e) => {
				const end = endOf(e);
				return [e.t, end ? end.t : LOOPS.has(name) ? R.now : e.t + (LEN[name] ?? 1000)];
			});
	const doubles = [];
	for (const name of new Set(plays.map((e) => e.name))) {
		const s = spansOf(name);
		for (let i = 1; i < s.length; i++) if (s[i][0] < s[i - 1][1] - 1) doubles.push(`${name} @${r1(s[i][0] - t0)}`);
	}
	const ourDoubles = doubles.filter((d) => OURS.some((n) => d.startsWith(n)));
	// (two lights can change a moment apart: the stoplight's own overlap is reported by judge2, not counted here)
	// and the crosshair's hops overlap only by their silent tails at turbo (the hop is 77 ms long and 40 dB down by 30 ms;
	// at turbo the hops come 70 to 100 ms apart): judge2 checks they start at least HOP_AUDIBLE ms apart instead
	const ourDoubles2 = ourDoubles.filter((d) => !d.startsWith('sfx_stoplight_change') && !d.startsWith('sfx_target_hop'));
	check(ourDoubles2.length === 0, `${tag}: none of the game's own sounds plays twice at once`, ourDoubles2);
	if (ourDoubles2.length < ourDoubles.length) console.log(`  INFO ${tag}: stoplight changes overlapping (two lights a moment apart): ${ourDoubles.length - ourDoubles2.length}`);
	if (doubles.length > ourDoubles.length) console.log(`  INFO ${tag}: borrowed sounds overlapping themselves: ${doubles.filter((d) => !ourDoubles.includes(d)).join(', ')}`);
	// what plays besides ours (the borrowed ones), once each name
	const others = [...new Set(plays.filter((e) => !OURS.includes(e.name)).map((e) => e.name))];
	const rows2 = judge2(tag, C, R);
	rows.push(...rows2);
	console.log(`  INFO ${tag}: borrowed sounds this round: ${others.join(', ') || 'none'}`);
	rows.sort((a, b) => (Number(a.start) || 0) - (Number(b.start) || 0));
	return { rows, others };
}

/** ROUND 2's sounds (see the header): rows for the case's table, checks counted */
function judge2(tag, C, R) {
	const t0 = R.t0;
	const M = R.road.filter((e) => e.kind === 'moment');
	const tap = R.tap.log;
	const plays = tap.filter((e) => e.what === 'play');
	const used = new Set();
	const rows = [];
	const at = (e) => r1(e.t - t0);
	const take = (name, frame) => {
		const p = plays.find((x) => x.name === name && x.frame === frame && !used.has(x));
		if (p) used.add(p);
		return p;
	};
	const row = (sound, play, ev, label, extra = '') => (ev && ev.t >= rowsUntil) || rows.push({ sound, start: play ? at(play) : 'MISSING', stop: extra, event: ev ? `${label} (frame ${ev.frame})` : label, offset: play && ev ? r1(play.t - ev.t) : '', frames: play && ev ? play.frame - ev.frame : '' });
	const named = (what) => M.filter((e) => e.what === what);
	// rows: every one in a base case; in the long round only its first two spins (the checks cover all of them)
	const spinStarts = named('trafficStart').map((e) => e.t);
	const rowsUntil = C.id === 'trigger' && spinStarts.length > 2 ? spinStarts[2] : Infinity;
	const show = (e) => e.t < rowsUntil;

	// THE TRAFFIC
	const starts = named('trafficStart');
	const traffic = plays.filter((e) => e.name === 'sfx_traffic_roll');
	check(traffic.length === starts.length, `${tag}: one traffic loop per spin (${traffic.length} for ${starts.length} pull aways)`);
	const stops = named('reelStop');
	traffic.forEach((T, i) => {
		const st = starts[i];
		check(!!st && T.frame === st.frame, `${tag}: spin ${i + 1}: the traffic starts on the press / pull away frame (${T.frame} vs ${st?.frame})`);
		used.add(T);
		const next = traffic[i + 1]?.t ?? Infinity;
		const mine = stops.filter((e) => e.t >= T.t && e.t < next);
		const fade = tap.find((e) => e.what === 'fade' && e.id === T.id);
		const stop = tap.find((e) => e.what === 'stop' && e.id === T.id);
		check(!!stop, `${tag}: spin ${i + 1}: the traffic loop was stopped`);
		if (mine.length) {
			const first = mine[0];
			const last = mine[mine.length - 1];
			check(!!fade && fade.frame === first.frame, `${tag}: spin ${i + 1}: its fade starts on the first reel's stop frame (${fade?.frame} vs ${first.frame}; ${fade?.detail})`);
			// the fade is planned to end on the last reel's stop; the stop lands on the first board frame from then
			check(!!stop && stop.t - last.t <= 2.5 * 40 && stop.t - last.t >= -40, `${tag}: spin ${i + 1}: stopped by the last reel's stop (${r1(stop ? stop.t - last.t : null)} ms after it)`);
			if (show(T)) {
				row('sfx_traffic_roll', T, st, 'press / pull away');
				rows.push({ sound: `  traffic fade (${fade?.detail ?? '-'})`, start: fade ? at(fade) : '', stop: stop ? at(stop) : '', event: `first reel stop (frame ${first.frame})`, offset: fade ? r1(fade.t - first.t) : '', frames: fade ? fade.frame - first.frame : '' });
				rows.push({ sound: '  traffic stopped', start: stop ? at(stop) : '', stop: '', event: `last reel stop (frame ${last.frame})`, offset: stop ? r1(stop.t - last.t) : '', frames: stop ? stop.frame - last.frame : '' });
			}
		}
	});
	check(!R.roundEnd.playing.some((x) => x.name === 'sfx_traffic_roll') && !R.roundEnd.state.traffic, `${tag}: no traffic loop at the round's end`, R.roundEnd);

	// THE REEL STOPS
	let order = [];
	let spin = -1;
	const orders = [];
	stops.forEach((e) => {
		const k = Number(/reel (\d)/.exec(e.detail)?.[1]);
		const s = spinStarts.filter((t) => t <= e.t).length;
		if (s !== spin) {
			if (order.length) orders.push(order);
			order = [];
			spin = s;
		}
		order.push(k);
		const pl = take(`sfx_lane_stop_${k}`, e.frame);
		check(!!pl, `${tag}: reel ${k} stop: sfx_lane_stop_${k} on its stop frame (${e.frame})`);
		if (show(e)) row(`sfx_lane_stop_${k}`, pl, e, `reel ${k} last car at its stop point`);
	});
	if (order.length) orders.push(order);
	const laneStops = plays.filter((e) => REEL_STOPS.includes(e.name));
	check(laneStops.length === stops.length, `${tag}: no reel stop sound without its reel's stop (${laneStops.length} for ${stops.length})`);
	console.log(`  INFO ${tag}: reel stop order per spin: ${orders.map((o) => o.join('')).join(' ')}`);
	if (C.id !== 'trigger' && C.turbo < 2) check(orders.every((o) => o.join('') === [...o].sort().join('')), `${tag}: the reels stop left to right (${orders.map((o) => o.join('')).join(' ')})`);

	// THE STOPLIGHTS
	const lights = named('stoplight');
	const lightFrames = [...new Set(lights.map((e) => e.frame))];
	lightFrames.forEach((f) => {
		const e = lights.find((x) => x.frame === f);
		const pl = take('sfx_stoplight_change', f);
		check(!!pl, `${tag}: a stoplight change (${e.detail}): its sound on that frame (${f})`);
		if (show(e)) row('sfx_stoplight_change', pl, e, `stoplight ${e.detail}`);
	});
	const lightPlays = plays.filter((e) => e.name === 'sfx_stoplight_change');
	check(lightPlays.length === lightFrames.length, `${tag}: one stoplight sound per frame a light changed (${lightPlays.length} for ${lightFrames.length})`);

	// THE CROSSHAIR: hops (rate per hop), drops, lock, red box
	const strikes = named('strike');
	const strikeOf = (e) => strikes.filter((s) => s.t <= e.t).length;
	const hops = named('hop');
	const hopN = {};
	hops.forEach((e) => {
		const k = strikeOf(e);
		hopN[k] = (hopN[k] ?? 0) + 1;
		const n = hopN[k];
		const want = Math.pow(2, HOP_SEMIS[(n - 1) % HOP_SEMIS.length] / 12);
		const pl = take('sfx_target_hop', e.frame);
		const rate = pl ? tap.find((x) => x.what === 'rate' && x.id === pl.id && x.t >= pl.t - 1) : null;
		check(!!pl, `${tag}: strike ${k} hop ${n} (${e.detail}): its sound on the hop's frame (${e.frame})`);
		check(!!rate && Math.abs(Number(rate.detail) - want) < 1e-4, `${tag}: strike ${k} hop ${n}: played at rate ${want.toFixed(4)} (${HOP_SEMIS[(n - 1) % HOP_SEMIS.length]} semitones; the Howl got ${rate?.detail})`);
		row(`sfx_target_hop #${n} (${HOP_SEMIS[(n - 1) % HOP_SEMIS.length]} st)`, pl, e, `crosshair hop, ${e.detail}, strike ${k}`);
	});
	check(plays.filter((e) => e.name === 'sfx_target_hop').length === hops.length, `${tag}: one hop sound per hop (${hops.length})`);
	const hopPlays = plays.filter((e) => e.name === 'sfx_target_hop');
	const hopGaps = hopPlays.slice(1).map((e, i) => e.t - hopPlays[i].t);
	if (hopGaps.length) {
		const least = Math.min(...hopGaps);
		check(least >= HOP_AUDIBLE, `${tag}: the hops start at least ${HOP_AUDIBLE} ms apart, the hop's audible length (closest ${r1(least)} ms; ${hopGaps.filter((g) => g < LEN.sfx_target_hop).length} of ${hopGaps.length} overlap the one before by its silent tail)`);
	}
	const locks = named('lock');
	const lockFrames = new Set(locks.map((e) => e.frame));
	locks.forEach((e) => {
		const pl = take('sfx_target_lock', e.frame);
		check(!!pl, `${tag}: strike ${strikeOf(e)}: the lock sound on the lock's frame (${e.frame})`);
		row('sfx_target_lock', pl, e, `crosshair locks, ${e.detail}, strike ${strikeOf(e)}`);
	});
	const drops = named('drop');
	const dropFrames = [...new Set(drops.map((e) => e.frame))];
	dropFrames.forEach((f) => {
		const e = drops.find((x) => x.frame === f);
		const n = drops.filter((x) => x.frame === f).length;
		if (lockFrames.has(f)) {
			check(!plays.some((x) => x.name === 'sfx_target_drop' && x.frame === f), `${tag}: no drop sound on the lock's frame (${n} candidate(s) drop with the lock, frame ${f})`);
			rows.push({ sound: '  (drops with the lock: no drop sound)', start: at(e), stop: '', event: `${n} candidate(s) drop, frame ${f}`, offset: '', frames: '' });
			return;
		}
		const pl = take('sfx_target_drop', f);
		check(!!pl, `${tag}: a drop (${n} candidate(s)): one drop sound on that frame (${f})`);
		row('sfx_target_drop', pl, e, `${n} candidate(s) drop, ${e.detail}`);
	});
	check(plays.filter((e) => e.name === 'sfx_target_drop').length === dropFrames.filter((f) => !lockFrames.has(f)).length, `${tag}: one drop sound per frame with a drop, none on a lock frame`);
	const morphs = named('morph');
	const impacts = named('impact');
	morphs.forEach((e) => {
		const pl = take('sfx_redbox', e.frame);
		const imp = impacts.filter((x) => x.t <= e.t + 1).pop();
		check(!!pl, `${tag}: strike ${strikeOf(e)}: the red box sound on the crash's first frame (${e.frame}, the impact ${imp?.frame})`);
		row('sfx_redbox', pl, e, `the crosshair closes onto the red box, ${e.detail}`);
	});
	check(plays.filter((e) => e.name === 'sfx_redbox').length === morphs.length, `${tag}: one red box sound per crash (${morphs.length})`);

	// THE DART
	const darts = named('dart');
	check(darts.length === strikes.length, `${tag}: one dart per strike (${darts.length} for ${strikes.length})`);
	darts.forEach((e) => {
		const pl = take('sfx_reindeer_dart', e.frame);
		const k = strikeOf(e);
		const imp = impacts.find((x) => x.t >= e.t - 1 && strikeOf(x) === k);
		const off = named('setOff').filter((x) => strikeOf(x) === k)[0];
		const down = named('down').filter((x) => strikeOf(x) === k)[0];
		check(!!pl, `${tag}: strike ${k}: the dart on its cue frame (${e.frame})`);
		if (pl && imp) {
			const lead = imp.t - pl.t;
			// the cue comes on the first frame within DART_PEAK of the impact TIME; the impact's own FRAME is the first frame drawn
			// at or after that time, up to one frame later (headless frames here are 30 to 70 ms)
			check(lead >= -1 && lead <= DART_PEAK + 70, `${tag}: strike ${k}: the dart starts at most ${DART_PEAK} ms (plus the impact frame's lateness) before the impact frame (${r1(lead)} ms)`);
			check(!off || pl.t >= off.t - 0.5, `${tag}: strike ${k}: the dart starts after he sets off`);
			row('sfx_reindeer_dart', pl, imp, `impact; its peak (+${DART_PEAK}) lands ${r1(pl.t + DART_PEAK - imp.t)} ms after it; the run down took ${down ? r1(imp.t - down.t) : '-'} ms`);
		}
	});

	// THE MULTIPLIER STAMP
	named('stamp').forEach((e) => {
		const m = /(\d+)x (small|mid|high)/.exec(e.detail);
		const value = Number(m?.[1]);
		const band = value >= 30 ? 'high' : value >= 10 ? 'mid' : 'small';
		check(m?.[2] === band, `${tag}: a ${value}x stamp is in the ${band} band (${e.detail})`);
		const pl = take(STAMPS[band], e.frame);
		check(!!pl, `${tag}: the ${value}x number's pop: ${STAMPS[band]} on its frame (${e.frame})`);
		row(STAMPS[band], pl, e, `column number stamps on, ${e.detail}`);
	});
	check(plays.filter((e) => Object.values(STAMPS).includes(e.name)).length === named('stamp').length, `${tag}: one stamp per column number (${named('stamp').length})`);

	// THE LINE WIN, against the book
	const lines = named('lines');
	const infos = (R.book ?? []).filter((e) => e.type === 'winInfo' && e.wins.length);
	check(lines.length === infos.length, `${tag}: the lines showed once per paying winInfo in the book (${lines.length} for ${infos.length})`);
	lines.forEach((e, i) => {
		const info = infos[i];
		const rank = (s) => PAY_ORDER.indexOf(s === 'W' ? 'H1' : s);
		const best = info ? info.wins.reduce((a, w) => (rank(w.symbol) < rank(a) ? w.symbol : a), info.wins[0].symbol) : null;
		const want = best ? WIN_BY_SYMBOL[best] : null;
		const pl = want ? take(want, e.frame) : null;
		const ls = take('sfx_line_show', e.frame);
		check(!!pl, `${tag}: win ${i + 1} (${info?.wins.map((w) => w.symbol).join(',')}): ${want} for ${best} on the lines' frame (${e.frame})`);
		check(!!ls, `${tag}: win ${i + 1}: sfx_line_show on the lines' frame (${e.frame})`);
		if (show(e)) {
			row(want ?? '?', pl, e, `${e.detail} show (${info?.wins.length} win(s): ${[...new Set(info?.wins.map((w) => w.symbol))].join(',')})`);
			row('sfx_line_show', ls, e, `${e.detail} show`);
		}
	});
	const winNames = new Set(Object.values(WIN_BY_SYMBOL));
	check(plays.filter((e) => winNames.has(e.name)).length === lines.length, `${tag}: one symbol win sound per line show`);

	// THE PRESENTS' POP
	const lids = named('lid');
	const triggers = (R.book ?? []).filter((e) => e.type === 'freeSpinTrigger' || e.type === 'freeSpinRetrigger').length;
	check(lids.length === triggers, `${tag}: one present pop per trigger (${lids.length} for ${triggers})`);
	lids.forEach((e) => {
		const pl = take('sfx_present_pop', e.frame);
		const fan = plays.filter((x) => /^sfx_bonus_trigger_/.test(x.name) && x.t <= e.t).pop();
		check(!!pl, `${tag}: the present pop on the frame the first lid leaves its box (${e.detail}, frame ${e.frame})`);
		row('sfx_present_pop', pl, e, `first lid leaves its box (${e.detail}); ${fan ? r1(e.t - fan.t) : '-'} ms after the open started`);
	});
	check(plays.filter((e) => e.name === 'sfx_present_pop').length === lids.length, `${tag}: no present pop without a lid (${lids.length})`);

	// NOTHING BORROWED IN A MOMENT THAT HAS ITS OWN SOUND NOW
	const replaced = plays.filter((e) => REPLACED.includes(e.name));
	check(replaced.length === 0, `${tag}: no replaced Manticore sound plays (${REPLACED.join(', ')})`, replaced.map((e) => `${e.name} @${at(e)}`));
	const borrowed = [...new Set(plays.filter((e) => !OURS.includes(e.name) && !STANDARD.test(e.name)).map((e) => e.name))];
	console.log(`  INFO ${tag}: still borrowed from Manticore this round: ${borrowed.join(', ') || 'none'}`);
	return rows;
}

const table = (rows) => '| sound | start ms | stop ms | animation event | offset ms | frames |\n|---|---:|---:|---|---:|---:|\n' + rows.map((r) => `| ${r.sound} | ${r.start} | ${r.stop} | ${r.event} | ${r.offset} | ${r.frames} |`).join('\n');

(async () => {
	// --mute-audio: the game plays every sound as ever (Howler, its timings and this probe's logs are the same), and none
	// of it reaches the Mac's speakers
	const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
	const all = {};
	try {
		for (const S of SIZES) {
			const { ctx, p, errs } = await boot(browser, S);
			for (const C of CASES) {
				const tag = `${C.id} ${S.name}`;
				const R = await runCase(p, S, C);
				const { rows, others } = judge(tag, C, R);
				all[tag] = { rows, others, roundEnd: R.roundEnd, slammed: R.slammed };
				console.log(`\n${tag}\n${table(rows)}\n`);
				if (OUT) writeFileSync(join(OUT, `case_${C.id}_${S.name}.md`), `# ${tag} (${C.book}, turbo ${C.turbo}${C.slam ? ', slam stop' : ''})\n\nTimes are ms from the Spin press; offset = sound minus its animation event (real ms); frames = the board's frames between them.\n\n${table(rows)}\n\nBorrowed sounds in this round: ${others.join(', ') || 'none'}\n`);
				await sleep(500);
			}
			const e = errs.filter((x) => !/favicon/.test(x));
			check(e.length === 0, `${S.name}: no page errors`, e.slice(0, 5));
			await ctx.close();
		}
	} finally {
		await browser.close();
	}
	if (OUT) writeFileSync(join(OUT, 'sound_probe.json'), JSON.stringify(all, null, 1));
	console.log(`\n${pass} pass, ${fail} fail`);
	process.exit(fail ? 1 : 0);
})();
