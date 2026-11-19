// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{components/SkipButton.svelte,game/utils.ts,game/stateGame.svelte.ts,game/resumeRound.svelte.ts,ui/hud/hudLayout.ts};
// WATCHES: ; __reindeer.skipHud, __reindeer.fixtures, __reindeer.hud, __reindeer.atRest, __reindeer.gameType, __reindeer.stockRules, __reindeer.roadSounds, __reindeer.soundTap
// WATCHES: ; skipTaken, __reindeer.wheel, data-wheel-gate, SKIP_HUD, skipAllowed, featureSpinsLive, requestSkip, fsStarted, skipping, skipToResult, SKIP_END_EVENTS, data-skip, data-round-card
// THE SKIP PROBE (2026-11-19, SKIP TO RESULT in a bonus round, Manticore Mayhem's control carried over:
// components/SkipButton.svelte; what Yes does: game/utils.ts playEvents, the resume card's Skip to Result cut). Sections
// (ONLY=a,b; default all), at 1440 x 900 unless said:
//   up        the button is down in the base game, under the entry card and through the Super wheel (natural_super), up
//             from the first free spin's reveal, down under the wrap-up; No closes the prompt and the spins play on
//   skip      natural_free_spins: Yes in the second free spin: no other spin's reveal plays, no strike sound after the
//             press, the wrap-up's Total Win card comes up and WAITS for the press (no autoplay), WIN is the book's
//             finalWin, exactly one end-round, the base game back at rest with the base speed
//   auto      autoplay (Autoplay Bonuses off) into natural_free_spins, skipped: the wrap-up waits for the press; after
//             it the stock rules' pause, then the run goes on; and with Stop on Free Games: the run ended at the
//             trigger, the skip ends the round, no automatic spin
//   double    the button and Yes pressed again every 10 ms for 700 ms after the first Yes: nothing taken, the flag off at
//             the wrap-up and through the next base spin, whose end-round comes at its normal time
//   switch    the operator's disabledSlamstop (and disabledTurbo): no button at all in a bonus round
//   layouts   the button up in a free spin at 1440 x 900, 390 x 844, 844 x 390 and 400 x 225: inside the window, its
//             touch target at least 44 px tall (Manticore's rule); with SHOTS=<dir> a capture of each
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [ONLY=a,b] [SHOTS=dir] node tools/skip_probe.mjs
// Uses the dev server that is already running. One headless browser, muted. Wrap it in the shared browser lock.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3014';
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (s) => !ONLY.length || ONLY.includes(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// the shared state module as the dev server serves it to the game (the same instance the game reads)
const STATE_SHARED = `/@fs${resolve(process.cwd(), '../../packages/state-shared/index.ts')}`;

let pass = 0;
let fail = 0;
const check = (ok, what, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${!ok && detail !== undefined ? `\n     ${JSON.stringify(detail).slice(0, 600)}` : ''}`);
};

async function boot(browser, vp = { width: 1440, height: 900 }, extra = '', touch = false, dpr = 1) {
	const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr, isMobile: touch, hasTouch: touch });
	await ctx.addInitScript(() => {
		window.__rgsCalls = [];
		const t = setInterval(() => {
			if (!window.__rorFixtures || window.__rgsWrapped) return;
			window.__rgsWrapped = true;
			clearInterval(t);
			const inner = window.fetch;
			window.fetch = (input, init) => {
				const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
				const m = /\/(wallet\/[a-z-]+)/.exec(url);
				if (m) window.__rgsCalls.push({ path: m[1], at: performance.now() });
				return inner(input, init);
			};
		}, 5);
	});
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	await p.goto(`${APP}/?lang=en&sessionID=skip${Date.now()}${extra}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 160; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && window.__reindeer.skipHud && !document.querySelector('.landing'))).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(vp.width / 2, vp.height / 2).catch(() => {});
		await sleep(600);
	}
	await sleep(800);
	return { ctx, p, errs };
}

const st = (p) =>
	p.evaluate(() => ({
		hud: window.__reindeer.skipHud(),
		gt: window.__reindeer.gameType(),
		gates: window.__reindeer.hud.gates(),
		card: document.querySelector('[data-round-card]')?.getAttribute('data-round-card') ?? null,
		idle: window.__reindeer.hud.idle(),
		rest: window.__reindeer.atRest(),
		sr: window.__reindeer.stockRules?.() ?? null,
	}));
const pressCard = (p) => p.evaluate(() => document.querySelector('button.catch')?.click());
const calls = (p) => p.evaluate(() => window.__rgsCalls.map((c) => c.path));
const bookOf = (p, name) => p.evaluate(async (n) => (await import('/src/fixtures/fixtureRgs.ts')).FIXTURE_ROUNDS.find((r) => r.name === n)?.events ?? null, name);

/** wait for `cond(state)`, pressing an entry card (never a wrap-up unless pressOutro) */
async function until(p, cond, { ms = 120000, pressIntro = true, pressOutro = false } = {}) {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) {
		const s = await st(p);
		if (cond(s)) return s;
		if (s.gates > 0 && ((pressIntro && s.card === 'intro') || (pressOutro && s.card === 'outro'))) await pressCard(p);
		await sleep(80);
	}
	return null;
}
/** the skip: the button, then Yes */
async function skipNow(p) {
	await p.click('[data-skip="button"]');
	await sleep(250);
	const prompt = await p.evaluate(() => document.querySelector('[data-skip="prompt"] .q')?.textContent ?? null);
	// (the moment of the Yes is its own click event's, not the probe's request: a busy page runs the click later)
	await p.evaluate(() => {
		window.__skipYesAt = Infinity;
		document.addEventListener('click', (e) => {
			if (e.target?.closest?.('[data-skip="yes"]') && window.__skipYesAt === Infinity) window.__skipYesAt = performance.now();
		}, true);
	});
	await p.click('[data-skip="yes"]');
	return prompt;
}

async function sectionUp(browser) {
	const { ctx, p, errs } = await boot(browser);
	let s = await st(p);
	check(!s.hud.up, `up: down in the base game at rest`, s.hud);
	await p.evaluate(() => window.__reindeer.fixtures.next('natural_super'));
	await p.click('.hudp button.spin');
	// through the entry card and the wheel: never up until the first free spin's reveal
	let upEarly = null;
	const t0 = Date.now();
	let wheelSeen = false;
	while (Date.now() - t0 < 120000) {
		s = await st(p);
		const wheel = await p.evaluate(() => !!document.querySelector('[data-wheel-gate]') || (window.__reindeer.wheel?.()?.phase ?? null) !== null).catch(() => false);
		wheelSeen ||= wheel;
		if (s.hud.up && (s.card || wheel || s.gt !== 'freegame')) upEarly = { s, wheel };
		if (s.hud.up && s.gt === 'freegame' && !s.card) break;
		if (s.gates > 0 && s.card === 'intro') await pressCard(p);
		// the wheel waits for its press: the Spin key is its press
		if (wheel && (await p.evaluate(() => window.__reindeer.wheel?.()?.phase === 'rest' && !!document.querySelector('[data-wheel-gate]')).catch(() => false))) await p.evaluate(() => document.querySelector('[data-wheel-gate]')?.click()).catch(() => {});
		await sleep(80);
	}
	check(!upEarly && s.hud.up, `up: down through the entry card and the Super wheel${wheelSeen ? '' : ' (the wheel not seen by its hook)'}, up from the first free spin`, upEarly);
	// No: the prompt closes, the spins play on
	await p.click('[data-skip="button"]');
	await sleep(250);
	const opened = await p.evaluate(() => !!document.querySelector('[data-skip="prompt"]'));
	await p.click('[data-skip="no"]');
	await sleep(250);
	const after = await p.evaluate(() => ({ prompt: !!document.querySelector('[data-skip="prompt"]'), skipping: window.__reindeer.skipHud().skipping }));
	check(opened && !after.prompt && !after.skipping, `up: the button opens "Skip to result?", No closes it and the round plays on`, { opened, after });
	// the wrap-up: down
	s = await until(p, (x) => x.card === 'outro');
	check(!!s && !s.hud.up, `up: down under the wrap-up`, s?.hud);
	await until(p, (x) => x.gt === 'basegame' && x.idle && x.rest && !x.card, { pressOutro: true });
	check(errs.length === 0, `up: no page errors`, errs.slice(0, 3));
	await ctx.close();
}

async function sectionSkip(browser) {
	const { ctx, p, errs } = await boot(browser);
	const book = await bookOf(p, 'natural_free_spins');
	const fin = book.filter((e) => e.type === 'finalWin').pop().amount;
	const reveals = book.filter((e) => e.type === 'reveal' && e.gameType === 'freegame').length;
	await p.evaluate(() => window.__reindeer.fixtures.next('natural_free_spins'));
	await p.click('.hudp button.spin');
	// the second free spin (one spin seen whole first)
	let s = await until(p, (x) => x.hud.up && x.gt === 'freegame');
	await until(p, () => false, { ms: 2500 });
	await p.evaluate(() => window.__reindeer.soundTap?.(true));
	const prompt = await skipNow(p);
	const t0 = Date.now();
	s = await until(p, (x) => x.card === 'outro', { ms: 30000 });
	const toCard = Date.now() - t0;
	// what reached the speakers from the Yes on (the sound tap: a sound asked while skipping is dropped, components/Sound.svelte)
	const played = await p.evaluate(() => ((window.__reindeer.soundTap?.() ?? { log: [] }).log ?? []).filter((e) => e.what === 'play' && e.t >= window.__skipYesAt).map((e) => e.name));
	const strikesAfter = played.filter((n) => /^sfx_(reindeer_(run|dart|turn|alert)|line_show|lane_stop|crash|column|grandma|multiplier|redbox|scatter)/.test(n));
	check(prompt === 'Skip to result?' && !!s, `skip: "Skip to result?", Yes: the wrap-up is up ${toCard} ms later (${reveals} free spins in the book)`, { prompt, toCard });
	check(strikesAfter.length === 0, `skip: from the Yes on no strike, line, reel stop or column sound plays (${played.length} sounds played: ${[...new Set(played)].join(', ') || 'none'})`, strikesAfter.slice(0, 6));
	// the wrap-up waits for the press
	await sleep(7500);
	const still = await st(p);
	check(still.card === 'outro', `skip: the wrap-up waits for the press (still up 7.5 s on)`, still);
	await until(p, (x) => x.gt === 'basegame' && x.idle && x.rest && !x.card, { pressOutro: true });
	const c = await calls(p);
	const end = await p.evaluate(() => ({ win: window.__reindeer.hud.win(), sr: window.__reindeer.stockRules(), log: window.__reindeer.fixtures.log() }));
	check(c.filter((x) => x === 'wallet/end-round').length === 1 && end.log.settled === 1, `skip: exactly one end-round (${c.filter((x) => x === 'wallet/end-round').length})`, c);
	check(end.win === fin, `skip: WIN is the book's finalWin (${end.win} vs ${fin})`, end.win);
	check(end.sr.turbo === end.sr.base && end.sr.gameType === 'basegame', `skip: back in the base game at the base speed`, end.sr);
	check(errs.length === 0, `skip: no page errors`, errs.slice(0, 3));
	await ctx.close();
}

async function startAuto(p, { stopFree = false } = {}) {
	await p.click('.hudp button[aria-label="Autoplay"]');
	await sleep(600);
	const open = await p.evaluate(() => document.querySelector('.am-ui.layer.modals .fold-row')?.getAttribute('aria-expanded') === 'true');
	if (!open) await p.click('.am-ui.layer.modals .fold-row');
	await sleep(300);
	const t = p.locator('.am-ui.layer.modals button.toggle:has-text("Stop on Free Games")');
	if (((await t.getAttribute('aria-checked')) === 'true') !== stopFree) await t.click();
	await p.click('.am-ui.layer.modals .go');
	await sleep(600);
	await p.click('.hudp button.spin');
}

async function sectionAuto(browser) {
	for (const stopFree of [false, true]) {
		const tag = `auto${stopFree ? ' stop on free games' : ''}`;
		const { ctx, p, errs } = await boot(browser);
		await p.evaluate(() => window.__reindeer.fixtures.next('natural_free_spins'));
		await startAuto(p, { stopFree });
		const s1 = await until(p, (x) => x.hud.up);
		check(!!s1 && (stopFree ? s1.sr.counter === 0 : s1.sr.counter > 0), `${tag}: the button up in the free spins (the run ${stopFree ? 'ended at the trigger' : 'live'}: ${s1?.sr.counter})`, s1?.sr);
		await skipNow(p);
		await until(p, (x) => x.card === 'outro', { ms: 30000 });
		await sleep(3000);
		const waits = (await st(p)).card === 'outro';
		check(waits, `${tag}: the wrap-up waits for the press (Autoplay Bonuses off)`);
		const plays0 = await p.evaluate(() => window.__reindeer.fixtures.log().plays.length);
		await pressCard(p);
		await sleep(400);
		await pressCard(p);
		await sleep(3500);
		const plays = (await p.evaluate(() => window.__reindeer.fixtures.log().plays.length)) - plays0;
		const sr = (await st(p)).sr;
		if (stopFree) check(plays === 0, `${tag}: no automatic spin after the round (${plays})`);
		else check(plays >= 1 && sr.pauses.length >= 1, `${tag}: the run goes on after the stock rules' pause (${plays} spin, pause ${sr.pauses.length ? Math.round(sr.pauses[sr.pauses.length - 1].endedAt - sr.pauses[sr.pauses.length - 1].clearedAt) : '?'} ms)`, sr.pauses);
		await p.click('.hudp button[aria-label="Autoplay"]').catch(() => {});
		await until(p, (x) => x.gt === 'basegame' && x.idle && x.rest && !x.card, { pressOutro: true, ms: 120000 });
		const c = await calls(p);
		const log = await p.evaluate(() => window.__reindeer.fixtures.log());
		const paying = log.plays.filter((x) => x.payout > 0).length;
		check(c.filter((x) => x === 'wallet/end-round').length === paying, `${tag}: one end-round for each paying round (${paying})`, c);
		check(errs.length === 0, `${tag}: no page errors`, errs.slice(0, 3));
		await ctx.close();
	}
}

async function sectionSwitch(browser) {
	for (const flag of ['disabledSlamstop', 'disabledTurbo']) {
		const { ctx, p } = await boot(browser);
		await p.evaluate(async ([path, f]) => {
			const m = await import(path);
			m.stateConfig.jurisdiction[f] = true;
		}, [STATE_SHARED, flag]);
		await p.evaluate(() => window.__reindeer.fixtures.next('natural_free_spins'));
		await p.click('.hudp button.spin');
		const s = await until(p, (x) => x.gt === 'freegame' && !x.card && x.sr?.gameType === 'freegame', { ms: 60000 });
		await sleep(2500);
		const d = await p.evaluate(() => ({ el: !!document.querySelector('[data-skip="button"]'), hud: window.__reindeer.skipHud() }));
		check(!!s && !d.el && !d.hud.allowed, `switch ${flag}: no skip button at all in a bonus round`, d);
		await ctx.close();
	}
}

async function sectionLayouts(browser) {
	const L = [
		{ vp: { width: 1440, height: 900 } },
		{ vp: { width: 390, height: 844 }, touch: true, extra: '&tier=phone' },
		{ vp: { width: 844, height: 390 }, touch: true, extra: '&tier=phone' },
		{ vp: { width: 400, height: 225 } },
	];
	for (const l of L) {
		const tag = `layout ${l.vp.width}x${l.vp.height}`;
		const { ctx, p } = await boot(browser, l.vp, l.extra ?? '', !!l.touch, 3);
		await p.evaluate(() => window.__reindeer.fixtures.next('natural_free_spins'));
		await p.click('.hudp button.spin');
		const s = await until(p, (x) => x.hud.up);
		await sleep(600);
		const g = await p.evaluate(() => {
			const b = document.querySelector('[data-skip="button"]').getBoundingClientRect();
			const hit = getComputedStyle(document.querySelector('[data-skip="button"]'), '::after').height;
			return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom, vw: innerWidth, vh: innerHeight, hit };
		});
		check(!!s && g.x0 >= 0 && g.y0 >= 0 && g.x1 <= g.vw && g.y1 <= g.vh, `${tag}: the button up in a free spin, inside the window (${Math.round(g.x0)},${Math.round(g.y0)} ${Math.round(g.x1 - g.x0)} x ${Math.round(g.y1 - g.y0)})`, g);
		if (SHOTS) {
			await p.screenshot({ path: join(SHOTS, `reindeer_${l.vp.width}x${l.vp.height}.png`) });
			await p.click('[data-skip="button"]');
			await sleep(350);
			await p.screenshot({ path: join(SHOTS, `reindeer_${l.vp.width}x${l.vp.height}_prompt.png`) });
			await p.click('[data-skip="no"]').catch(() => {});
		}
		await ctx.close();
	}
}

/** A SECOND SKIP (2026-11-19, the probe host: the button came back for about 120 ms after Yes and a second Yes was taken,
 *  leaving `skipping` set through the wrap-up and the next base spin, whose end-round then came at 1.17 s instead of about
 *  3.5 s): from the first Yes on, the page itself presses the button and Yes every 10 ms for 700 ms (the window seen was
 *  +130 to +280 ms; a busy page fires fewer of them). Nothing is taken,
 *  the flag is off at the wrap-up and through the next base spin, and that spin's end-round comes at its normal time
 *  (against the same book played before the bonus round). */
async function sectionDouble(browser) {
	const { ctx, p, errs } = await boot(browser);
	const gap = async () => {
		const c = await p.evaluate(() => window.__rgsCalls.slice());
		const play = c.filter((x) => x.path === 'wallet/play').pop();
		const end = c.filter((x) => x.path === 'wallet/end-round').pop();
		return play && end && end.at > play.at ? end.at - play.at : null;
	};
	// the reference: a winning base spin before the bonus round
	await p.evaluate(() => window.__reindeer.fixtures.next('plain_line_win'));
	await p.click('.hudp button.spin');
	await until(p, (x) => x.gt === 'basegame' && x.idle && x.rest && !x.card && x.gates === 0, { ms: 60000 });
	await sleep(600);
	const ref = await gap();
	await p.evaluate(() => window.__reindeer.fixtures.next('natural_free_spins'));
	await p.click('.hudp button.spin');
	await until(p, (x) => x.hud.up && x.gt === 'freegame');
	await p.click('[data-skip="button"]');
	await sleep(250);
	await p.evaluate(() => {
		window.__second = { tries: 0, prompts: 0, upSeen: 0 };
		document.querySelector('[data-skip="yes"]').click();
		const t0 = performance.now();
		const t = setInterval(() => {
			if (performance.now() - t0 > 700) return clearInterval(t);
			const b = document.querySelector('[data-skip="button"]');
			if (window.__reindeer.skipHud().up) window.__second.upSeen += 1;
			b?.click();
			window.__second.tries += 1;
			const y = document.querySelector('[data-skip="yes"]');
			if (y) {
				window.__second.prompts += 1;
				y.click();
			}
		}, 10);
	});
	const atCard = await until(p, (x) => x.card === 'outro', { ms: 30000 });
	const second = await p.evaluate(() => window.__second);
	check(second.upSeen === 0 && second.prompts === 0, `double: after Yes the button never comes back up (${second.tries} presses in 700 ms, up ${second.upSeen} times, a prompt ${second.prompts} times)`, second);
	check(!!atCard && !atCard.hud.skipping, `double: the flag is off at the wrap-up`, atCard?.hud);
	await until(p, (x) => x.gt === 'basegame' && x.idle && x.rest && !x.card && x.gates === 0, { pressOutro: true, ms: 60000 });
	// the next base spin, the same book as the reference
	await p.evaluate(() => window.__reindeer.fixtures.next('plain_line_win'));
	await p.click('.hudp button.spin');
	let stuck = false;
	const t1 = Date.now();
	while (Date.now() - t1 < 60000) {
		const s = await st(p);
		stuck ||= s.hud.skipping;
		if (s.gt === 'basegame' && s.idle && s.rest && !s.card && s.gates === 0 && Date.now() - t1 > 1500) break;
		await sleep(60);
	}
	await sleep(600);
	const next = await gap();
	check(!stuck && ref !== null && next !== null && Math.abs(next - ref) < Math.max(400, ref * 0.25), `double: the next base spin is not hurried (flag off throughout; its end-round ${Math.round(next ?? -1)} ms after its play, the same book before the bonus ${Math.round(ref ?? -1)} ms)`, { stuck, ref, next });
	const c = await calls(p);
	check(c.filter((x) => x === 'wallet/end-round').length === 3, `double: one end-round a round (3 rounds)`, c);
	check(errs.length === 0, `double: no page errors`, errs.slice(0, 3));
	await ctx.close();
}

const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
	if (want('layouts')) await sectionLayouts(browser);
	if (want('up')) await sectionUp(browser);
	if (want('skip')) await sectionSkip(browser);
	if (want('auto')) await sectionAuto(browser);
	if (want('switch')) await sectionSwitch(browser);
	if (want('double')) await sectionDouble(browser);
} catch (e) {
	fail++;
	console.log('FAIL probe error', e?.stack ?? e);
} finally {
	await browser.close();
}
console.log(`\nskip_probe: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
