// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{ui/ResumeCard.svelte,game/resumeRound.svelte.ts,ui/LandingScreen.svelte,game/actor.ts,components/ResumeBet.svelte}, apps/run_over_reindeer/src/game/bookEventHandlerMap.ts;
// WATCHES: ; __reindeer.resumeRound, __reindeer.fixtures, __reindeer.hud, __reindeer.atRest, __reindeer.gameType, __reindeer.roadSounds, __reindeer.stockRules
// WATCHES: apps/run_over_reindeer/src/{ui/hud/HudReadout.svelte,ui/hud/winOdometer.ts}; __reindeer.hud.winOdometer, data-odo, .od
// WATCHES: ; roundHasNothingLeft, countLeft, ledCountDone, SKIP_SHOW_MS, settleWinsAfterPresentation, settleEarly, OPEN_KEY, data-resume-card, data-resume, data-resume-mode, skipToResult, toSkippedBet, RESUME_TEXT, createBonusSnapshot, .landing, .pressText, .press-target
// THE RESUME PROBE (2026-11-18, the resume card, a stock rule for every game: game/resumeRound.svelte.ts,
// ui/ResumeCard.svelte). A reload into a round the RGS holds open (the fixture RGS's fixtures.resume: the session comes
// back with that book open at that event, as a real RGS's would) with the showcase books of the math (real books):
//   · no landing screen: no PRESS ANYWHERE line, no full-screen press target, no LED press screen; the card is up, the
//     HUD hidden and inert under it, nothing played and no sound before the press (the Sound layer mounts only after)
//   · its words: "Play Round" and "Skip to Result" (Manticore's card's, word for word), the round's mode named;
//     printable ASCII; in a social session (?social=true) no restricted word
//   · Play Round has the focus; Enter held with the keyboard's repeat chooses once
//   · PLAY ROUND on a base round and a feature round: the round plays on as before, to its end
//   · SKIP TO RESULT on the same rounds: no strike, no line show, no traffic, no reel stop sound (the road's sound log),
//     the book's final board (the last reveal's) on the road, a bonus round's Total Win card, back in the base game
//   · either way: the end-round sent exactly once, WIN equals the book's finalWin, BALANCE the fixture wallet's, idle and
//     at rest, the turbo level the base one, no page error
//   - the WIN odometer (2026-11-21, ui/hud/winOdometer.ts): a feature round's wrap-up card ran it to its end (plain on its
//     total), and after the round WIN reads the book's finalWin in plain text, no digit window left
//   · a reload while the card is up brings the card back
//   · the card at every layout (1920 x 1080, 1440 x 900, 1280 x 720, tablet 1180 x 820 and 820 x 1180, phones 390 x 844,
//     390 x 620, 360 x 640, sideways 844 x 390, Stake's popouts 800 x 450 and 400 x 225): inside the window with a margin,
//     both buttons inside the card and at least 44 x 44 CSS px on touch sizes (30 in the 225 px popout), no text past
//     its box. With SHOTS=<dir> it saves each (<w>x<h>_card.png, at device pixel ratio 3).
//   · moments (2026-11-18, a base win stays open until shown): a winning base spin played for real and the page reloaded
//     before its lines (the card; Play Round), mid its count-up (the card; Skip to Result), just after its end-round went
//     (no card, nothing open), and a 0x spin (no end-round, nothing open): one end-round across both pages, the wallet
//     credited once
//   · cadence: autoplay of a winning base spin at turbo 0 and 2, the end-round after the win against the old timing
//     (?settleEarly=1, DEV only): the time a round takes, and the difference
//   · ledcount: a manual winning base spin's end-round goes with the LED board's count landed (turbo 0 and 2)
// Sections: ONLY=layouts,words,play,skip,reload,moments,cadence,ledcount (default all).
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [ONLY=a,b] [SHOTS=dir] node tools/resume_probe.mjs
// Uses the dev server that is already running. One headless browser, muted. Wrap it in the shared browser lock:
//   tools/browser_lock.sh run game -- node tools/resume_probe.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3014';
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (s) => !ONLY.length || ONLY.includes(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BANNED = /\b(bets?|buy|buys|bought|cash|money|paid|credits?|gamble|gambling|wager|wagers|stake)\b/i;

let pass = 0;
let fail = 0;
const check = (ok, what, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${!ok && detail !== undefined ? `\n     ${JSON.stringify(detail).slice(0, 700)}` : ''}`);
};

// the open rounds: a paying base round, a natural bonus round mid way, and a bought Super
const ROUNDS = [
	{ name: 'plain_line_win', event: 0, feature: false },
	{ name: 'natural_free_spins', event: 9, feature: true },
	{ name: 'super_typical', event: 4, feature: true },
];

async function context(browser, vp = { width: 1440, height: 900 }, touch = false, dpr = 1) {
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
				if (m) window.__rgsCalls.push({ path: m[1], at: performance.now(), board: (() => { const sh = window.__reindeer?.scoreboard?.()?.show; return sh ? `${sh.kind} ${sh.phase}` : 'none'; })() });
				return inner(input, init);
			};
		}, 5);
	});
	return ctx;
}

/** a page with the round `name` left open at `event`: boot, then the fixture's resume (it reloads into the open round) */
async function openRound(ctx, R, extra = '', vp = { width: 1440, height: 900 }) {
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=resume${Date.now()}${extra}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 100 && !(await p.evaluate(() => !!window.__reindeer?.fixtures).catch(() => false)); i++) await sleep(300);
	await p.evaluate(([n, e]) => window.__reindeer.fixtures.resume(n, e), [R.name, R.event]).catch(() => {});
	await sleep(1200);
	await p.waitForLoadState('domcontentloaded').catch(() => {});
	// (the first page's own loads, cut by that reload, may log a failed fetch: only the reloaded page's errors count)
	errs.length = 0;
	const up = await cardUp(p);
	return { p, errs, up, vp };
}

async function cardUp(p, ms = 90000) {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) {
		if (await p.evaluate(() => !!document.querySelector('[data-resume-card] [data-resume="play"]')).catch(() => false)) return true;
		await sleep(250);
	}
	return false;
}

/** what the screen shows while the card is up */
const underCard = (p) =>
	p.evaluate(() => ({
		press: !!document.querySelector('.landing .pressText'),
		target: !!document.querySelector('.landing .press-target'),
		ledSign: !!window.__reindeer?.led?.() || !!window.__reindeer?.scoreboard?.()?.press?.up,
		hudHidden: !!document.querySelector('.am-ui.layer.hidden') || !document.querySelector('.hudp'),
		plays: window.__reindeer.fixtures.log().plays.length,
		calls: window.__rgsCalls.map((c) => c.path),
		focus: document.activeElement?.getAttribute('data-resume') ?? null,
		texts: [...document.querySelectorAll('[data-resume-card] h3, [data-resume-card] p, [data-resume-card] .rows div, [data-resume-card] button')].map((e) => e.textContent.trim()),
		mode: document.querySelector('[data-resume-mode]')?.textContent ?? null,
		sound: !!window.__reindeer?.soundTap,
	}));

/** press the round's cards as a player would, until idle and at rest (the HUD back) */
async function settle(p, ms = 240000) {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) {
		const st = await p.evaluate(() => ({ g: window.__reindeer.hud?.gates?.() ?? 0, idle: window.__reindeer.hud?.idle?.(), rest: window.__reindeer.atRest?.(), busy: window.__reindeer.resumeRound ? null : null })).catch(() => null);
		if (st?.g > 0) await p.evaluate(() => document.querySelector('button.catch')?.click()).catch(() => {});
		// (the round handed over: components/ResumeBet.svelte has mounted, its dev hook is there; between the landing
		// screen's going and that mount the actor is still idle and the board at rest, with the open round not yet resumed)
		else if (st?.idle && st.rest && (await p.evaluate(() => !!window.__reindeer.resume && !document.querySelector('[data-resume-card]') && !document.querySelector('.landing')))) {
			// (and still so a moment later)
			await sleep(700);
			const again = await p.evaluate(() => window.__reindeer.hud.idle() && window.__reindeer.atRest() && (window.__reindeer.hud.gates?.() ?? 0) === 0).catch(() => false);
			if (again) return true;
		}
		await sleep(300);
	}
	return false;
}

/** the book as the fixtures hand it over */
const bookOf = (p, name) => p.evaluate(async (n) => (await import('/src/fixtures/fixtureRgs.ts')).FIXTURE_ROUNDS.find((r) => r.name === n)?.events ?? null, name);

async function choiceCase(browser, R, choice) {
	const tag = `${choice} ${R.name}@${R.event}`;
	const ctx = await context(browser);
	const { p, errs, up } = await openRound(ctx, R);
	check(up, `${tag}: the resume card is up after the reload`);
	if (!up) return void (await ctx.close());
	const u = await underCard(p);
	check(!u.press && !u.target && !u.ledSign, `${tag}: no landing screen under it (no PRESS ANYWHERE, no press target, no LED press screen)`, u);
	check(u.hudHidden && u.plays === 0 && !u.calls.includes('wallet/end-round') && !u.calls.includes('wallet/play'), `${tag}: the HUD hidden under it, nothing played, no end-round before the press`, u);
	check(u.focus === 'play', `${tag}: Play Round has the focus (${u.focus})`, u);
	const book = await bookOf(p, R.name);
	const fin = book?.findLast?.((e) => e.type === 'finalWin')?.amount ?? book?.filter((e) => e.type === 'finalWin').pop()?.amount;
	const lastReveal = book?.filter((e) => e.type === 'reveal').pop();
	// the road's sound log from the press on
	await p.evaluate(() => window.__reindeer.roadSounds?.(true));
	const t0 = await p.evaluate(() => performance.now());
	// the HUD's WIN and BALANCE texts, watched from the press: when each first shows its end value (the result before the settle)
	await p.evaluate(() => {
		const rd = (k) => document.querySelector(`.hudp [data-hud="${k}"] .value`)?.textContent ?? document.querySelector(`.hudp [data-hud="${k}"]`)?.textContent ?? '';
		const w = (window.__hudWatch = { bal0: null, balAt: null, wins: [] });
		const t = setInterval(() => {
			const b = rd('balance');
			if (w.bal0 === null && b) w.bal0 = b;
			else if (w.bal0 !== null && b !== w.bal0 && w.balAt === null) w.balAt = performance.now();
			const v = rd('win');
			if (!w.wins.length || w.wins[w.wins.length - 1].v !== v) w.wins.push({ v, at: performance.now() });
		}, 20);
		setTimeout(() => clearInterval(t), 120000);
	});
	await p.click(`[data-resume-card] [data-resume="${choice}"]`);
	// (the Sound layer mounts after the press; its log starts with it)
	for (let i = 0; i < 40 && !(await p.evaluate(() => !!window.__reindeer.soundTap).catch(() => false)); i++) await sleep(100);
	await p.evaluate(() => window.__reindeer.soundTap?.(true)).catch(() => {});
	const ok = await settle(p);
	const end = await p.evaluate(
		([t0]) => ({
			calls: window.__rgsCalls.filter((c) => c.at >= t0).map((c) => c.path),
			win: window.__reindeer.hud.win(),
			wallet: window.__reindeer.fixtures.log().balance,
			balanceText: document.querySelector('.hudp [data-hud="balance"] .value')?.textContent ?? document.querySelector('.hudp [data-hud="balance"]')?.textContent ?? '',
			gameType: window.__reindeer.gameType(),
			board: window.__reindeer.board?.() ?? null,
			road: (window.__reindeer.roadSounds?.() ?? []).filter((e) => e.kind === 'sound').map((e) => e.what),
			marks: (window.__reindeer.roadSounds?.() ?? []).filter((e) => e.kind !== 'sound').map((e) => `${e.what} ${e.detail ?? ''}`),
			sr: window.__reindeer.stockRules?.() ?? null,
			card: !!document.querySelector('[data-resume-card]'),
			odo: window.__reindeer.hud.winOdometer?.() ?? null,
			winText: document.querySelector('.hudp [data-hud="win"] .value')?.textContent ?? '',
			winWindows: document.querySelector('.hudp [data-hud="win"] .value')?.querySelectorAll('.od').length ?? -1,
			winData: document.querySelector('.hudp [data-hud="win"] .value')?.getAttribute('data-odo') ?? null,
			finText: window.__reindeer.bookAmount ? window.__reindeer.bookAmount(window.__reindeer.hud.win()) : null,
		}),
		[t0],
	);
	const ends = end.calls.filter((c) => c === 'wallet/end-round').length;
	const plays = end.calls.filter((c) => c === 'wallet/play').length;
	check(ok && !end.card && end.gameType === 'basegame', `${tag}: the round reaches its end, back in the base game, idle and at rest`, { ok, gameType: end.gameType });
	check(ends === 1 && plays === 0, `${tag}: the end-round sent exactly once, no new play (${ends} end-round, ${plays} play)`, end.calls);
	check(fin !== undefined && end.win === fin, `${tag}: WIN is the book's finalWin (${end.win} vs ${fin})`, { win: end.win, fin });
	// THE WIN ODOMETER (2026-11-21): no rolling digit stuck after a resumed round; a feature round's wrap-up ran it and it
	// landed on its total (the readout's text against the book's finalWin, in the currency's units)
	const winNum = Number(String(end.winText).replace(/[^0-9.]/g, ''));
	check(!!end.odo && end.odo.mode === 'off' && end.winWindows === 0 && end.winData === null && end.finText !== null && Math.abs(winNum - end.finText) < 0.005, `${tag}: after the round WIN is plain text on the book's total (${end.winText.trim()}), no digit window left`, { odo: end.odo, winText: end.winText, windows: end.winWindows, finText: end.finText });
	if (R.feature) check(!!end.odo && end.odo.plans >= 1 && end.odo.doneT !== null && Math.abs(Number(String(end.odo.text).replace(/[^0-9.]/g, '')) - end.finText) < 0.005, `${tag}: the wrap-up's odometer ran and went plain on the total (${end.odo?.text}, plain at ${end.odo?.doneT} ms)`, end.odo);
	const wallet = end.wallet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	check(end.balanceText.replace(/[^0-9.,]/g, '').includes(wallet), `${tag}: BALANCE reads the wallet after the end-round (${end.balanceText.trim()} vs ${wallet})`, { balanceText: end.balanceText, wallet });
	check(end.sr === null || end.sr.turbo === end.sr.base, `${tag}: the speed is the base game's after the round`, end.sr && { turbo: end.sr.turbo, base: end.sr.base });
	if (choice === 'skip' && !R.feature) {
		const w = await p.evaluate(() => window.__hudWatch);
		const lastWin = w.wins[w.wins.length - 1];
		const winDone = w.wins.find((x) => x.v === lastWin.v)?.at ?? null;
		check(w.balAt !== null && winDone !== null && winDone <= w.balAt + 20, `${tag}: the HUD's WIN reads its end value (${lastWin.v}) before BALANCE moves (${winDone !== null && w.balAt !== null ? Math.round(w.balAt - winDone) : '?'} ms before)`, w);
	}
	if (choice === 'skip') {
		// (his idle snort is his end state, not a step: the strike's own run, dart, turn and alert are)
		const skipped = end.road.filter((w) => /^sfx_(reindeer_(run|dart|turn|alert)|line_show|lane_stop|reel|traffic|crash|column|grandma|multiplier|redbox|sting|present|scatter)/.test(w));
		check(skipped.length === 0, `${tag}: no sound of a skipped step (${end.road.length} road sounds: ${[...new Set(end.road)].join(', ') || 'none'})`, skipped);
		const strikes = end.marks.filter((m) => /grandmaStrike|strike/.test(m));
		check(strikes.length === 0 && end.marks.some((m) => /skipToResult/.test(m)), `${tag}: no strike played, the skip's final board put up`, end.marks.slice(0, 8));
		if (end.board && lastReveal) check(JSON.stringify(end.board) === JSON.stringify(lastReveal.board), `${tag}: the road shows the book's final board (its last reveal)`, { board: end.board, last: lastReveal.board });
	}
	check(errs.length === 0, `${tag}: no page errors`, errs.slice(0, 4));
	await ctx.close();
}

async function sectionReload(browser) {
	const R = ROUNDS[1];
	const ctx = await context(browser);
	const { p, errs, up } = await openRound(ctx, R);
	// a reload while the card is up: the RGS still holds the round (the fixture's resume says so again)
	await p.evaluate(([n, e]) => window.__reindeer.fixtures.resume(n, e), [R.name, R.event]).catch(() => {});
	await sleep(1200);
	errs.length = 0; // (the card page's own loads, cut by the reload, may log a failed fetch)
	const again = await cardUp(p);
	const u = again ? await underCard(p) : null;
	check(up && again && u.plays === 0 && !u.calls.includes('wallet/end-round'), `reload: a reload while the card is up brings the card back, nothing played or ended`, u);
	await p.click('[data-resume-card] [data-resume="play"]');
	const ok = await settle(p);
	check(ok, `reload: the round then plays to its end`);
	check(errs.length === 0, `reload: no page errors`, errs.slice(0, 4));
	await ctx.close();
}

async function sectionWords(browser) {
	for (const social of [false, true]) {
		const ctx = await context(browser);
		const { p, up } = await openRound(ctx, ROUNDS[1], social ? '&social=true' : '');
		const u = up ? await underCard(p) : null;
		const all = (u?.texts ?? []).join(' | ');
		check(up && u.texts.includes('Play Round') && u.texts.includes('Skip to Result'), `words${social ? ' social' : ''}: the two choices read "Play Round" and "Skip to Result"`, u?.texts);
		check(up && /Free Spins/.test(u.mode ?? ''), `words${social ? ' social' : ''}: the round is named (${u?.mode})`, u?.mode);
		check(up && !/[^\x20-\x7e]/.test(all), `words${social ? ' social' : ''}: printable ASCII only`, all);
		if (social) check(up && !BANNED.test(all), `words social: no restricted word`, all.match(BANNED));
		// ENTER HELD with the key's repeat: one choice only
		if (!social && up) {
			await p.keyboard.down('Enter');
			for (let i = 0; i < 20; i++) {
				await p.keyboard.down('Enter');
				await sleep(30);
			}
			await p.keyboard.up('Enter');
			const st = await p.evaluate(() => window.__reindeer.resumeRound());
			check(st.choice === 'play', `keyboard: Enter on the focused Play Round chooses it, once (${st.choice})`, st);
			await settle(p);
			const calls = await p.evaluate(() => window.__rgsCalls.map((c) => c.path));
			check(calls.filter((c) => c === 'wallet/end-round').length === 1, `keyboard: one end-round`, calls);
		}
		await ctx.close();
	}
}

const LAYOUTS = [
	{ vp: { width: 1920, height: 1080 } },
	{ vp: { width: 1440, height: 900 } },
	{ vp: { width: 1280, height: 720 } },
	{ vp: { width: 1180, height: 820 }, touch: true },
	{ vp: { width: 820, height: 1180 }, touch: true },
	{ vp: { width: 390, height: 844 }, touch: true, phone: true },
	{ vp: { width: 390, height: 620 }, touch: true, phone: true },
	{ vp: { width: 360, height: 640 }, touch: true, phone: true },
	{ vp: { width: 844, height: 390 }, touch: true, phone: true },
	{ vp: { width: 800, height: 450 } },
	{ vp: { width: 400, height: 225 } },
];

async function sectionLayouts(browser) {
	for (const L of LAYOUTS) {
		const tag = `layout ${L.vp.width}x${L.vp.height}`;
		const ctx = await context(browser, L.vp, !!L.touch, 3);
		const { p, up } = await openRound(ctx, ROUNDS[1], L.phone ? '&tier=phone' : '', L.vp);
		check(up, `${tag}: the card is up`);
		if (!up) {
			await ctx.close();
			continue;
		}
		await sleep(500);
		const g = await p.evaluate(() => {
			const box = (e) => {
				const b = e.getBoundingClientRect();
				return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom, w: b.width, h: b.height };
			};
			const card = document.querySelector('[data-resume-card] .card');
			const btns = [...card.querySelectorAll('button')].map((b) => ({ ...box(b), over: b.scrollWidth - b.clientWidth }));
			const texts = [...card.querySelectorAll('h3, p, .rows div')].map((e) => ({ t: e.textContent.slice(0, 20), over: e.scrollWidth - e.clientWidth }));
			return { card: box(card), btns, texts, vw: innerWidth, vh: innerHeight };
		});
		const m = 6;
		check(g.card.x0 >= m && g.card.y0 >= m && g.card.x1 <= g.vw - m && g.card.y1 <= g.vh - m, `${tag}: the card inside the window with a margin (${Math.round(g.card.w)} x ${Math.round(g.card.h)})`, g.card);
		check(g.btns.every((b) => b.x0 >= g.card.x0 && b.x1 <= g.card.x1 && b.over <= 1) && g.texts.every((t) => t.over <= 1), `${tag}: both buttons inside the card, no text past its box`, { btns: g.btns, texts: g.texts.filter((t) => t.over > 1) });
		const minH = L.vp.height <= 225 ? 30 : 44;
		if (L.touch || L.vp.height <= 450) check(g.btns.every((b) => b.h >= minH - 0.5 && b.w >= 44), `${tag}: both buttons at least ${minH} px tall and 44 wide (${g.btns.map((b) => `${Math.round(b.w)} x ${Math.round(b.h)}`).join(', ')})`, g.btns);
		if (SHOTS) await p.screenshot({ path: join(SHOTS, `${L.vp.width}x${L.vp.height}_card.png`) });
		await ctx.close();
	}
}

/** A BASE WIN STAYS OPEN UNTIL IT IS SHOWN (2026-11-18, Corey "Yes base spins should carry it as well"; game/actor.ts
 *  settleWinsAfterPresentation): a winning base spin is played for real, the page reloaded at a moment of it, and what
 *  the RGS and the game do is counted across both pages: the end-round requests, the wallet, the card. */
async function bootFresh(ctx, extra = '') {
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	await p.goto(`${APP}/?lang=en&sessionID=moment${Date.now()}${extra}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 160; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && document.querySelector('.hudp') && !document.querySelector('.landing'))).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(720, 450).catch(() => {});
		await sleep(600);
	}
	await sleep(800);
	return { p, errs };
}
const wallet = (p) => p.evaluate(() => window.__reindeer.fixtures.log());
const calls = (p) => p.evaluate(() => window.__rgsCalls.map((c) => c.path));

async function moment(browser, { name, when, label, choice }) {
	const tag = `moment ${label}`;
	const ctx = await context(browser);
	const { p, errs } = await bootFresh(ctx);
	const before = await wallet(p);
	const book = await bookOf(p, name);
	const fin = book.filter((e) => e.type === 'finalWin').pop().amount;
	await p.evaluate((n) => window.__reindeer.fixtures.next(n), name);
	await p.click('.hudp button.spin');
	// the moment: `when` on the page's own state
	const t0 = Date.now();
	let hit = null;
	while (Date.now() - t0 < 60000 && !hit) {
		hit = await p.evaluate(when).catch(() => null);
		if (!hit) await sleep(40);
	}
	const c1 = await calls(p);
	const w1 = await wallet(p);
	await p.reload({ waitUntil: 'domcontentloaded' });
	const up = choice ? await cardUp(p, 60000) : false;
	const e1 = c1.filter((c) => c === 'wallet/end-round').length;
	if (choice) {
		check(!!hit && e1 === 0 && up, `${tag}: reloaded ${hit}: no end-round sent before it, the round still open, the resume card up`, { hit, c1 });
		if (up) await p.click(`[data-resume-card] [data-resume="${choice}"]`);
		const ok = await settle(p);
		const c2 = await calls(p);
		const w2 = await wallet(p);
		const win = await p.evaluate(() => window.__reindeer.hud.win());
		const e2 = c2.filter((c) => c === 'wallet/end-round').length;
		const want = Math.round((before.balance - w1.plays[0].amount + fin / 100 * w1.plays[0].amount) * 100) / 100;
		check(ok && e1 + e2 === 1 && w2.settled === 1, `${tag}: ${choice === 'play' ? 'Play Round' : 'Skip to Result'}: the round ends with exactly one end-round across both pages (${e1} + ${e2})`, { c1, c2, settled: w2.settled });
		check(Math.abs(w2.balance - want) < 0.005 && win === fin, `${tag}: the wallet ${w2.balance} (${before.balance} less the play, plus the book's win once: ${want}), WIN ${win} the book's ${fin}`, { w2, want, win, fin });
	} else {
		// after the presentation, the end-round already out: nothing to resume, the win already credited, no card
		check(!!hit && e1 === 1 && !up, `${tag}: reloaded ${hit}: the end-round was out before it, no card after it`, { hit, c1 });
		await sleep(3000);
		const after = await p.evaluate(() => ({ card: !!document.querySelector('[data-resume-card]'), log: window.__reindeer?.fixtures?.log?.() ?? null }));
		const want = Math.round((before.balance - w1.plays[0].amount + fin / 100 * w1.plays[0].amount) * 100) / 100;
		check(!after.card && after.log && !after.log.open, `${tag}: after the reload: no card, no open round (authenticate's round is none)`, after);
		void want;
	}
	check(errs.length === 0, `${tag}: no page errors on the first page`, errs.slice(0, 3));
	await ctx.close();
}

/** THE LED COUNT BEFORE THE SETTLE (2026-11-18): a manual winning base spin's end-round goes once the board's count has
 *  landed, at turbo 0 and 2 (autoplay unchanged: its next press cuts the count) */
async function sectionLedCount(browser) {
	for (const L of [0, 2]) {
		const ctx = await context(browser);
		const { p } = await bootFresh(ctx);
		await p.evaluate((l) => window.__reindeer.turbo(l), L);
		await p.evaluate(() => window.__reindeer.fixtures.next('plain_line_win'));
		await p.click('.hudp button.spin');
		await settle(p, 60000);
		const end = await p.evaluate(() => window.__rgsCalls.filter((c) => c.path === 'wallet/end-round'));
		check(end.length === 1 && !/ count$/.test(end[0].board), `ledcount turbo ${L}: the end-round went with the board's count landed (the board then: ${end[0]?.board})`, end);
		await ctx.close();
	}
}

async function sectionMoments(browser) {
	// before the lines: the reveal is on the road, no line shown yet
	await moment(browser, { name: 'plain_line_win', label: 'before the lines', choice: 'play', when: () => (window.__reindeer.fixtures.log().plays.length > 0 && window.__reindeer.gameType && window.__reindeer.hud.win() === 0 ? 'with the traffic driving in' : null) });
	// mid count: a base Mega win counting on the LED board
	await moment(browser, { name: 'base_two_columns', label: 'mid count-up', choice: 'skip', when: () => (window.__reindeer.scoreboard()?.show?.kind === 'win' && window.__reindeer.scoreboard().show.phase === 'count' ? 'mid count-up' : null) });
	// the presentation over, the end-round sent (the HUD's WIN final, idle)
	await moment(browser, { name: 'plain_line_win', label: 'after the presentation', choice: null, when: () => (window.__rgsCalls.some((c) => c.path === 'wallet/end-round') ? 'just after the end-round went' : null) });
	// an end-round that fails once (a 500 from the RGS): the retry the feature path has (END_ROUND_RETRY_DELAYS_MS), one
	// settle, the wallet right
	{
		const ctx = await context(browser);
		const { p, errs } = await bootFresh(ctx);
		const before = await wallet(p);
		await p.evaluate(() => {
			let fails = 1;
			const inner = window.fetch;
			window.fetch = (input, init) => {
				const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
				if (/wallet\/end-round/.test(url) && fails > 0) {
					fails -= 1;
					window.__rgsCalls.push({ path: 'wallet/end-round (failed)', at: performance.now() });
					return Promise.resolve(new Response(JSON.stringify({ error: 'ERR_GEN', message: 'probe' }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
				}
				return inner(input, init);
			};
		});
		await p.evaluate(() => window.__reindeer.fixtures.next('plain_line_win'));
		await p.click('.hudp button.spin');
		const ok = await settle(p);
		const c = await calls(p);
		const w = await wallet(p);
		const book = await bookOf(p, 'plain_line_win');
		const fin = book.filter((e) => e.type === 'finalWin').pop().amount;
		const want = Math.round((before.balance - w.plays[0].amount + (fin / 100) * w.plays[0].amount) * 100) / 100;
		check(ok && c.filter((x) => x === 'wallet/end-round (failed)').length === 1 && c.filter((x) => x === 'wallet/end-round').length === 1 && w.settled === 1 && Math.abs(w.balance - want) < 0.005, `moment end-round error: a failed end-round is retried once, the round settles once, the wallet ${w.balance} (${want})`, { c, w });
		const modal = await p.evaluate(() => !!document.querySelector('.am-ui.layer.modals [data-notice], .am-ui.layer.modals .notice'));
		console.log(`  INFO moment end-round error: an error card up after the retry: ${modal}; page errors ${errs.length}`);
		await ctx.close();
	}
	// A DEAD SPIN THEN A RELOAD (2026-11-18, the probe host on staging: tools/mock_rgs.py, and now the fixture RGS, report
	// a 0x base round active until the next play): no card, the landing screen as usual, no end-round, the next play fine
	{
		const ctx = await context(browser);
		const { p, errs } = await bootFresh(ctx);
		await p.evaluate(() => window.__reindeer.fixtures.next('no_win_1'));
		await p.click('.hudp button.spin');
		await settle(p, 60000);
		const open = (await wallet(p)).open;
		await p.reload({ waitUntil: 'domcontentloaded' });
		let landing = false;
		for (let i = 0; i < 150 && !landing; i++) {
			landing = await p.evaluate(() => !!document.querySelector('.landing') && !!window.__reindeer?.scoreboard?.()?.press?.ready).catch(() => false);
			await sleep(400);
		}
		const card = await p.evaluate(() => !!document.querySelector('[data-resume-card]'));
		const reported = await p.evaluate(() => window.__reindeer.fixtures.log().open);
		await p.mouse.click(720, 450);
		const ok = await settle(p, 60000);
		const c1 = await calls(p);
		await p.evaluate(() => window.__reindeer.fixtures.next('plain_line_win'));
		await p.click('.hudp button.spin');
		const ok2 = await settle(p, 90000);
		const c2 = await calls(p);
		const w = await wallet(p);
		check(open && reported && landing && !card && ok && !c1.includes('wallet/end-round'), `moment dead spin: the 0x round reported active after the reload (${reported}), the landing screen and no card, no end-round, at rest`, { open, reported, landing, card, ok, c1 });
		check(ok2 && c2.filter((x) => x === 'wallet/play').length === 1 && c2.filter((x) => x === 'wallet/end-round').length === 1 && w.settled === 1, `moment dead spin: the next play is accepted and settles once`, { c2, w });
		check(errs.length === 0, `moment dead spin: no page errors`, errs.slice(0, 3));
		await ctx.close();
	}
	// a round with no win: no end-round, and a reload mid spin shows no card
	const ctx = await context(browser);
	const { p } = await bootFresh(ctx);
	await p.evaluate(() => window.__reindeer.fixtures.next('no_win_1'));
	await p.click('.hudp button.spin');
	await sleep(400);
	const c = await calls(p);
	await p.reload({ waitUntil: 'domcontentloaded' });
	const up = await cardUp(p, 25000);
	check(!up && !c.includes('wallet/end-round'), `moment no win: a 0x round sends no end-round, and a reload mid spin shows no card`, c);
	await ctx.close();
}

/** THE CADENCE: autoplay of a winning base book, the end-round after the presentation against the old timing
 *  (?settleEarly=1, DEV only), at turbo 0 and 2: the time from one play request to the next */
async function sectionCadence(browser) {
	const out = {};
	for (const early of [true, false]) {
		for (const L of [0, 2]) {
			const ctx = await context(browser);
			const { p } = await bootFresh(ctx, early ? '&settleEarly=1' : '');
			await p.evaluate((l) => window.__reindeer.turbo(l), L);
			await p.evaluate(() => window.__reindeer.fixtures.next('plain_line_win', true));
			await p.click('.hudp button[aria-label="Autoplay"]');
			await sleep(600);
			await p.click('.am-ui.layer.modals .go');
			await sleep(600);
			await p.click('.hudp button.spin');
			const t0 = Date.now();
			while (Date.now() - t0 < 90000 && (await p.evaluate(() => window.__rgsCalls.filter((c) => c.path === 'wallet/play').length)) < 7) await sleep(200);
			const plays = await p.evaluate(() => window.__rgsCalls.filter((c) => c.path === 'wallet/play').map((c) => c.at));
			const ends = await p.evaluate(() => window.__rgsCalls.filter((c) => c.path === 'wallet/end-round').length);
			await p.click('.hudp button[aria-label="Autoplay"]').catch(() => {});
			await settle(p, 60000);
			const gaps = plays.slice(1).map((t, i) => t - plays[i]).slice(1); // the first gap carries the run's start
			out[`${early ? 'early' : 'after'}${L}`] = { mean: gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length), n: gaps.length, ends, plays: plays.length };
			await ctx.close();
		}
	}
	for (const L of [0, 2]) {
		const a = out[`after${L}`];
		const e = out[`early${L}`];
		console.log(`  INFO cadence turbo ${L}: ${a.mean.toFixed(0)} ms a round with the end-round after the win (${a.n} gaps), ${e.mean.toFixed(0)} ms with it at the play reply: +${(a.mean - e.mean).toFixed(0)} ms (${(((a.mean - e.mean) / e.mean) * 100).toFixed(1)} %)`);
		check(a.ends >= a.plays - 1 && a.mean - e.mean < 400, `cadence turbo ${L}: autoplay of a winning base spin: +${(a.mean - e.mean).toFixed(0)} ms a round (${a.mean.toFixed(0)} against ${e.mean.toFixed(0)}), one end-round a round`, out);
	}
}

const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
	if (want('layouts')) await sectionLayouts(browser);
	if (want('words')) await sectionWords(browser);
	if (want('play')) for (const R of ROUNDS) await choiceCase(browser, R, 'play');
	if (want('skip')) for (const R of ROUNDS) await choiceCase(browser, R, 'skip');
	if (want('reload')) await sectionReload(browser);
	if (want('moments')) await sectionMoments(browser);
	if (want('cadence')) await sectionCadence(browser);
	if (want('ledcount')) await sectionLedCount(browser);
} catch (e) {
	fail++;
	console.log('FAIL probe error', e?.stack ?? e);
} finally {
	await browser.close();
}
console.log(`\nresume_probe: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
