// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{game/replayGuard.ts,game/replayFault.ts,ui/ReplayModal.svelte,ui/NoticeModal.svelte,components/Game.svelte};
// WATCHES: ; __reindeer.replayGuard, guardReplay, replayFault, data-replay-amount, REPLAY_FAILED, data-skip, .stamp, .ok
// THE REPLAY LINK PROBE (2026-11-23): a replay link whose round the RGS does not serve. Found in the sister game: a 400
// from /bet/replay/... with the body {"error":"ERR_VAL","message":"invalid bet mode"} opened the ROUND REPLAY card with
// zeros (MULTIPLIER 0x, TOTAL WIN 0.00), and START REPLAY left the game on SKIP with nothing playing. The shared
// fetcher hands any JSON body back whatever its status and the shared Authenticate stores it as the round; the app's
// own guard (src/game/replayGuard.ts) now turns every such answer into the error card.
// The probe needs no RGS: it opens replay links against a host that does not exist and answers /bet/replay itself
// (page.route), one case to a page, at 1280 x 720:
//   nope      mode=NOPE, the RGS's 400 ERR_VAL "invalid bet mode" (what the mock RGS answers from parent commit 356bc47 on)
//   missing   mode=BASE and a book id that does not exist: a 400 with an error body
//   error200  a 200 whose body carries an error
//   empty     a 200 with an empty body; nostate: a 200 with an empty state
//   html      a 200 that is not JSON; down: no answer at all (the request fails)
//   oddmode   a real book answered for mode=NOPE
// In each: the error card is up in its replay words (REPLAY NOT AVAILABLE, RELOAD), the replay card never opens (no
// MODE / MULTIPLIER / TOTAL WIN rows, no START REPLAY), SKIP is not up, and the guard names the fault it saw.
//   good      a real book (the fixtures' first showcase round) for mode=BASE: the replay card opens with its
//             multiplier, no error card, START REPLAY enabled
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [ONLY=a,b] [SHOTS=dir] node tools/replay_probe.mjs
// Uses the dev server that is already running. One headless browser, muted. Wrap it in the shared browser lock.
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
// a host that resolves nowhere: every /bet/replay request to it is answered here
const RGS = 'replay-probe.invalid';

let pass = 0;
let fail = 0;
const check = (ok, what, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${!ok && detail !== undefined ? `\n     ${JSON.stringify(detail).slice(0, 600)}` : ''}`);
};
const json = (status, body) => (route) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

/** what is on screen: the error card (its title and key), the replay card (its rows), SKIP, the guard's fault */
const read = (p) =>
	p.evaluate(() => {
		const modals = document.querySelector('.am-ui.layer.modals');
		const stamp = modals?.querySelector('.stamp');
		const card = stamp?.closest('.card') ?? null;
		const replay = modals?.querySelector('[data-replay-amount]')?.closest('.panel') ?? null;
		const start = [...(modals?.querySelectorAll('button.go') ?? [])].find((b) => /START REPLAY/.test(b.textContent ?? '')) ?? null;
		return {
			mounted: !!modals,
			error: card ? { title: card.querySelector('.title')?.textContent?.trim() ?? '', key: card.querySelector('button.ok')?.textContent?.trim() ?? '', detail: card.querySelector('.detail')?.textContent?.trim() ?? '' } : null,
			replay: replay ? replay.innerText.replace(/\s+/g, ' ').trim() : null,
			start: start ? { disabled: start.disabled } : null,
			skipUp: !!document.querySelector('[data-skip="button"].up'),
			fault: window.__reindeer?.replayGuard?.().fault ?? null,
			gameType: window.__reindeer?.gameType?.() ?? null,
		};
	});

async function open(browser, name, mode, event, answer) {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
	const p = await ctx.newPage();
	const errs = [];
	const calls = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	// (the shared fetcher sends Content-Type on its GET, so the browser asks first: that preflight is always allowed)
	await p.route(new RegExp(`^https?://${RGS.replace(/\./g, '\\.')}/`), (route) => {
		if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' } });
		calls.push(route.request().url());
		return answer(route);
	});
	await p.goto(`${APP}/?lang=en&replay=true&rgs_url=${RGS}&game=run_over_reindeer&version=1&mode=${mode}&event=${event}&amount=1000000&currency=USD`, { waitUntil: 'domcontentloaded' });
	// until the error card or the replay card is up (the game loads first: no press screen in a replay)
	let s = null;
	for (let i = 0; i < 150; i++) {
		s = await read(p).catch(() => null);
		if (s && (s.error || s.replay)) break;
		await sleep(600);
	}
	// and a little longer: nothing else may come up after it
	await sleep(2500);
	s = await read(p).catch(() => s);
	if (SHOTS) await p.screenshot({ path: join(SHOTS, `replay_${name}.png`) });
	return { ctx, p, s, errs, calls };
}

const refused = async (browser, name, what, mode, event, answer, faults) => {
	if (!want(name)) return;
	const { ctx, s, errs, calls } = await open(browser, name, mode, event, answer);
	const tag = `${name} (${what})`;
	check(calls.some((u) => u.includes(`/bet/replay/run_over_reindeer/1/${mode}/${event}`)), `${tag}: the game asked /bet/replay for mode ${mode}, round ${event}`, calls);
	check(!!s?.error && s.error.title === 'REPLAY NOT AVAILABLE' && s.error.key === 'RELOAD', `${tag}: the error card is up in its replay words, with RELOAD (${s?.error?.title}, ${s?.error?.key}, ${s?.error?.detail})`, s);
	check(!!s && s.replay === null && s.start === null, `${tag}: the replay card never opens (no rows on zeros, no START REPLAY)`, s);
	check(!!s && !s.skipUp && (s.gameType === null || s.gameType === 'basegame'), `${tag}: SKIP is not up and no bonus round is held`, s);
	check(!!s && faults.includes(s.fault), `${tag}: the guard saw ${faults.map((f) => `'${f}'`).join(' or ')} (${s?.fault})`, s);
	check(errs.length === 0, `${tag}: no page errors`, errs.slice(0, 3));
	await ctx.close();
};

const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
	// a real book, read from the dev server's own fixtures (the game's module, never a copy)
	let book = null;
	{
		const ctx = await browser.newContext();
		const p = await ctx.newPage();
		await p.goto(`${APP}/?lang=en&sessionID=replayprobe${Date.now()}`, { waitUntil: 'domcontentloaded' });
		book = await p.evaluate(async () => {
			const m = await import('/src/fixtures/showcaseBooks.ts');
			const r = m.SHOWCASE_ROUNDS.find((x) => x.mode === 'base' && x.events);
			return r ? { name: r.name, payoutMultiplier: r.payoutMultiplier, events: r.events } : null;
		}).catch(() => null);
		await ctx.close();
	}
	check(!!book, `a showcase book to answer with (${book?.name}, ${book?.payoutMultiplier}x)`);
	const round = book ? { payoutMultiplier: book.payoutMultiplier, costMultiplier: 1, state: book.events } : {};

	await refused(browser, 'nope', 'a made-up mode, 400 ERR_VAL', 'NOPE', '7', json(400, { error: 'ERR_VAL', message: 'invalid bet mode' }), ['error']);
	await refused(browser, 'missing', 'a book id that does not exist, 400', 'BASE', '999999999', json(400, { error: 'ERR_VAL', message: 'invalid event id' }), ['error']);
	await refused(browser, 'error200', 'a 200 whose body is an error', 'BASE', '7', json(200, { error: 'ERR_GEN', message: 'internal error' }), ['error']);
	await refused(browser, 'empty', 'a 200 with an empty body', 'BASE', '7', json(200, {}), ['no round']);
	await refused(browser, 'nostate', 'a 200 with an empty state', 'BASE', '7', json(200, { payoutMultiplier: 0, costMultiplier: 1, state: [] }), ['no round']);
	// (these two never reach the guard: the shared Authenticate raises the error card itself)
	await refused(browser, 'html', 'a 200 that is not JSON', 'BASE', '7', (route) => route.fulfill({ status: 200, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html><body>not the RGS</body></html>' }), [null]);
	await refused(browser, 'down', 'no answer at all', 'BASE', '7', (route) => route.abort('connectionrefused'), [null]);
	if (book) await refused(browser, 'oddmode', 'a real book for a mode the game does not know', 'NOPE', '7', json(200, round), ['mode']);

	if (book && want('good')) {
		const { ctx, s, errs } = await open(browser, 'good', 'BASE', '7', json(200, round));
		check(!!s && s.error === null && s.fault === null, `good: a real round shows no error card (${s?.error?.title ?? 'none'})`, s);
		check(!!s?.replay && /ROUND REPLAY/.test(s.replay) && s.replay.includes(`${book.payoutMultiplier}x`) && !!s.start && !s.start.disabled, `good: the replay card opens with the round's ${book.payoutMultiplier}x and START REPLAY enabled`, s);
		check(errs.length === 0, 'good: no page errors', errs.slice(0, 3));
		await ctx.close();
	}
} finally {
	await browser.close();
}
console.log(`replay_probe: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
