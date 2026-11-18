// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{ui/ResumeCard.svelte,game/resumeRound.svelte.ts,ui/LandingScreen.svelte,game/actor.ts,components/ResumeBet.svelte}, apps/run_over_reindeer/src/game/bookEventHandlerMap.ts;
// WATCHES: ; __reindeer.resumeRound, __reindeer.fixtures, __reindeer.hud, __reindeer.atRest, __reindeer.gameType, __reindeer.roadSounds, __reindeer.stockRules
// WATCHES: ; data-resume-card, data-resume, data-resume-mode, skipToResult, toSkippedBet, RESUME_TEXT, createBonusSnapshot, .landing, .pressText, .press-target
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
//   · a reload while the card is up brings the card back
//   · the card at every layout (1920 x 1080, 1440 x 900, 1280 x 720, tablet 1180 x 820 and 820 x 1180, phones 390 x 844,
//     390 x 620, 360 x 640, sideways 844 x 390, Stake's popouts 800 x 450 and 400 x 225): inside the window with a margin,
//     both buttons inside the card and at least 44 x 44 CSS px on touch sizes (30 in the 225 px popout), no text past
//     its box. With SHOTS=<dir> it saves each (<w>x<h>_card.png, at device pixel ratio 3).
// Sections: ONLY=layouts,words,play,skip,reload (default all).
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
				if (m) window.__rgsCalls.push({ path: m[1], at: performance.now() });
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
		else if (st?.idle && st.rest && (await p.evaluate(() => !document.querySelector('[data-resume-card]') && !document.querySelector('.landing')))) return true;
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
		}),
		[t0],
	);
	const ends = end.calls.filter((c) => c === 'wallet/end-round').length;
	const plays = end.calls.filter((c) => c === 'wallet/play').length;
	check(ok && !end.card && end.gameType === 'basegame', `${tag}: the round reaches its end, back in the base game, idle and at rest`, { ok, gameType: end.gameType });
	check(ends === 1 && plays === 0, `${tag}: the end-round sent exactly once, no new play (${ends} end-round, ${plays} play)`, end.calls);
	check(fin !== undefined && end.win === fin, `${tag}: WIN is the book's finalWin (${end.win} vs ${fin})`, { win: end.win, fin });
	const wallet = end.wallet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	check(end.balanceText.replace(/[^0-9.,]/g, '').includes(wallet), `${tag}: BALANCE reads the wallet after the end-round (${end.balanceText.trim()} vs ${wallet})`, { balanceText: end.balanceText, wallet });
	check(end.sr === null || end.sr.turbo === end.sr.base, `${tag}: the speed is the base game's after the round`, end.sr && { turbo: end.sr.turbo, base: end.sr.base });
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

const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
	if (want('layouts')) await sectionLayouts(browser);
	if (want('words')) await sectionWords(browser);
	if (want('play')) for (const R of ROUNDS) await choiceCase(browser, R, 'play');
	if (want('skip')) for (const R of ROUNDS) await choiceCase(browser, R, 'skip');
	if (want('reload')) await sectionReload(browser);
} catch (e) {
	fail++;
	console.log('FAIL probe error', e?.stack ?? e);
} finally {
	await browser.close();
}
console.log(`\nresume_probe: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
