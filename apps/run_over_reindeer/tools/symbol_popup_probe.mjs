// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{components/SymbolPopup.svelte,game/symbolPopup.ts,game/symbolPopupSpec.ts,game/boardIdle.ts};
// WATCHES: apps/run_over_reindeer/src/{game/landingBoard.ts,game/gameInfoText.ts,game/config.ts,components/Board.svelte};
// WATCHES: ; data-resume-card, data-resume
// WATCHES: ; __reindeer.symbolPopup, __reindeer.setBoard, __reindeer.grandmaWild, __reindeer.ledCurrency, __reindeer.hurryLevel
// WATCHES: ; __reindeer.fixtures, __reindeer.hud, __reindeer.atRest, __reindeer.road, __reindeer.gameType, FIRST_TAP.ignoreMs
// WATCHES: ; SYMBOL_POPUP, data-symbol-popup, data-hud, data-hud-step, .sp-pop, .landing, .hudp
// WATCHES: apps/run_over_reindeer/src/game/currency.ts;
// THE SYMBOL PAY POPUP PROBE (components/SymbolPopup.svelte, Corey 2026-11-17: "click on tiles to show their
// value/payouts during idle, the same way it's set up for manticore mayhem"). Modeled on Manticore's
// tools/manticore/symbol_popup_probe.js: its checks are the behavior contract Corey approved there, mapped onto this
// game (five reels of four lanes, line pays, the column Wilds, the crash cloud, the LED cards).
// Sections (ONLY=a,b; each one boots its own browser, closed between; one turn of the browser lock each is plenty):
//   main     1440 x 900: the first board's three standing columns (Reindeer, Santa, Grandma: any cell of the reel shows
//            that character, a second tap anywhere in the reel closes it); a posed board with every symbol and a crash
//            cloud: every kind opens the right content; the amounts == paytable x play amount through Game Info's rule
//            (the HUD's formatter) at two play amounts; the probe's paytable == config.ts; the Wild's, the Present's,
//            the cloud's and the columns' lines == Game Info's sentences; no restricted word; a tap on another symbol
//            moves it; the timeout; closes on Escape, another key, a press on empty canvas, the menu (and a tap with the
//            menu open opens nothing), the + step, turbo, the Autoplay card (a modal), Space (which still spins, once)
//            and the Spin button (which still spins, once, no later than a Spin press with no popup up); the board
//            click that hurries a live spin still hurries it and opens nothing
//   rounds   1440 x 900: taps on the board all through a base round, a natural Free Spins round (its entry and wrap-up
//            cards included) and an autoplay run: the popup never up unless the board is idle and quiet; after each, a
//            tap at rest opens it and starts no round; a round resumed after a reload: never up until it is over
//   social   1440 x 900 ?social=true: AMOUNTS in the session's coin as the HUD writes them (SC, then GC: the play
//            currency set by the dev hook ledCurrency; Corey 2026-11-17 "Amounts like Manticore"), never Nx multiples,
//            the WINS heading, the social Wild line, no restricted word
//   sizes    1440 x 900, 1920 x 1080, 844 x 390 (touch), 390 x 844 (touch), 390 x 620 (touch), 360 x 640 (touch):
//            every one of the 20 cells opens its own symbol, inside the screen, never over the tapped cell (or the
//            standing column); each first board column tapped in all four rows; the cell sizes (tap targets) reported;
//            SHOTS: one popup per kind
//   firsttap a tap every 100 ms from PRESS ANYWHERE: none opens the popup within FIRST_TAP.ignoreMs, one after it does
//   clip     390 x 844 touch, recorded: open, switch, close, open again and a Spin press with it up (webm, made a GIF by
//            ffmpeg into OUT)
// Run (the dev server must be up; it never starts one), from apps/run_over_reindeer:
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3018 OUT=<dir> [ONLY=main] [SHOTS=1] \
//     /Users/corey/Projects/stake-engine/tools/browser_lock.sh run game -- nice -n 19 node tools/symbol_popup_probe.mjs
// One headless browser at a time, muted.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));

const APP = process.env.APP || 'http://localhost:3018';
const OUT = process.env.OUT || join(tmpdir(), `symbol_popup_${Date.now()}`);
mkdirSync(OUT, { recursive: true });
const SHOTS = process.env.SHOTS === '1';
const ONLY = (process.env.ONLY || 'main,rounds,social,sizes,firsttap').split(',').filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// config.ts symbols[code].paytable, written out independently (and cross-checked against the file)
const PAYTABLE = { H1: [1.5, 5, 25], H2: [1, 2.5, 10], H3: [0.8, 2, 7.5], H4: [0.5, 1.5, 5], L1: [0.3, 0.8, 2.5], L2: [0.3, 0.6, 2], L3: [0.2, 0.5, 1.5], L4: [0.2, 0.4, 1.3], L5: [0.1, 0.3, 1] };
const KINDS = ['3', '4', '5'];
// Game Info's sentences (game/gameInfoText.ts), written out independently
const LINES = {
	standard: {
		W: ["**Santa's Sleigh is Wild**: it stands in for every paying symbol. A line of only Wilds pays as Grandma's Car."],
		// (2026-11-17: Game Info's sentence now also says which Presents show in red)
		S: ['**The Present is the Scatter.**', '3 Presents award 10 Free Spins and 4 or more award 10 Super Free Spins: the 4th and 5th Present to land in a spin show in red.'],
		GW: ["If the reindeer hits **Grandma's Car**, that one cell becomes a Wild with a multiplier (2x to 10x in the base game, up to 100x in a bonus round) for that spin only."],
		CW_reindeer: ["If the reindeer hits **Santa's Sleigh**, the whole column becomes a Wild with a multiplier of its own.", 'The Reindeer is the lowest (3x to 8x in the base game).'],
		CW_santa: ["If the reindeer hits **Santa's Sleigh**, the whole column becomes a Wild with a multiplier of its own.", 'Santa is in the middle (10x to 20x).'],
		CW_grandma: ["If the reindeer hits **Santa's Sleigh**, the whole column becomes a Wild with a multiplier of its own.", 'Grandma is the highest (40x to 75x).'],
	},
};
LINES.social = { ...LINES.standard, W: ["**Santa's Sleigh is Wild**: it stands in for every regular symbol. A line of only Wilds wins as Grandma's Car."] };
const COLUMN_NOTE = 'In the base game a column Wild lasts for that spin.';
const NAMES = { W: "Santa's Sleigh Wild", S: 'Present Scatter', GW: 'Grandma Wild', CW_reindeer: 'Reindeer', CW_santa: 'Santa', CW_grandma: 'Grandma' };
const KIND_WORD = { W: 'Wild', S: 'Scatter', GW: 'Wild', CW_reindeer: 'Column Wild', CW_santa: 'Column Wild', CW_grandma: 'Column Wild', H1: 'Premium', H2: 'High', H3: 'High', H4: 'High', L1: 'Low', L2: 'Low', L3: 'Low', L4: 'Low', L5: 'Low' };
const HEAD = { standard: ['IN A ROW', 'PAYS'], social: ['IN A ROW', 'WINS'] };
// the brief's restricted words (player-visible text)
const BANNED = /\b(bets?|betting|buy|buys|buying|cash|money|paid|credits?|gamble|gambling|wager|wagers|stake)\b/i;
const SOCIAL_BANNED = /\b(bet|bets|betting|buy|buys|bought|purchase\w*|paid|pay|pays|paying|payout\w*|paytable\w*|payline\w*|wager\w*|gambl\w*|cash|money|cost|costs|price|prices|priced|stake|credits?)\b/gi;

// the posed board (reel-major: board[reel][row]); a Grandma crash cloud then goes on GW_CELL
const POSE = [
	['H1', 'L1', 'H2', 'L2'],
	['L3', 'H3', 'W', 'L4'],
	['H4', 'L5', 'S', 'H1'],
	['L2', 'H2', 'L1', 'H3'],
	['H4', 'L3', 'L5', 'L4'],
];
const GW_AT = [4, 1];
const SPOTS = { high: ['H1', 0, 0], low: ['L5', 2, 1], wild: ['W', 1, 2], scatter: ['S', 2, 2], cloud: ['GW', ...GW_AT], edge: ['L4', 4, 3], mid: ['L1', 3, 2] };
// the first board's columns (game/landingBoard.ts): reels 1, 2 and 3 (from 0)
const LANDING_COLUMNS = { 1: 'CW_reindeer', 2: 'CW_santa', 3: 'CW_grandma' };

const results = [];
let section = '';
const ok = (cond, name, detail) => {
	results.push({ section, ok: !!cond, name, detail: cond ? undefined : detail });
	console.log(`${cond ? 'PASS' : 'FAIL'} [${section}] ${name}${cond || detail === undefined ? '' : ' ' + JSON.stringify(detail).slice(0, 600)}`);
	return !!cond;
};
const info = (msg) => console.log(`INFO [${section}] ${msg}`);

// ---- page helpers -------------------------------------------------------------------------------------------------
const H = (p, fn, arg) => p.evaluate(fn, arg);
const st = (p) => H(p, () => window.__reindeer.symbolPopup.state());
const lastLog = (p) => H(p, () => window.__reindeer.symbolPopup.log().slice(-1)[0] ?? null);
const idleNow = (p) => H(p, () => window.__reindeer.symbolPopup.idle() && window.__reindeer.symbolPopup.quiet()).catch(() => false);
const plays = (p) => H(p, () => window.__reindeer.fixtures.log().plays.length);
async function tapCell(ctx, reel, row, wait = 260) {
	const pt = await H(ctx.p, ([r, w]) => window.__reindeer.symbolPopup.cellPoint(r, w), [reel, row]);
	if (!pt) throw new Error(`no point for ${reel},${row}`);
	if (ctx.touch) await ctx.p.touchscreen.tap(pt.x, pt.y);
	else await ctx.p.mouse.click(pt.x, pt.y);
	if (wait) await sleep(wait);
	return pt;
}
async function waitClosed(p, ms = 6000) {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) {
		if (!(await st(p)).open) return true;
		await sleep(50);
	}
	return false;
}
async function settle(ctx, maxMs = 180000) {
	const { p, vp } = ctx;
	const t0 = Date.now();
	for (;;) {
		const s = await H(p, () => ({ g: window.__reindeer.hud.gates(), idle: window.__reindeer.hud.idle(), rest: window.__reindeer.atRest(), quiet: window.__reindeer.symbolPopup.quiet() })).catch(() => null);
		if (s && s.g > 0) {
			await p.mouse.click(vp.width / 2, vp.height * 0.4).catch(() => {});
			await sleep(500);
			continue;
		}
		if (s && s.idle && s.rest && s.quiet) return true;
		if (Date.now() - t0 > maxMs) return false;
		await sleep(250);
	}
}
async function boot(vp, opts = {}) {
	const touch = !!opts.touch;
	const browser = await chromium.launch({ args: ['--mute-audio'] });
	const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: opts.dpr ?? (touch ? 2 : 1), isMobile: touch, hasTouch: touch, ...(opts.video ? { recordVideo: { dir: opts.video, size: vp } } : {}) });
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=sp${section}${vp.width}x${vp.height}${Date.now()}${touch ? '&tier=phone' : ''}${opts.query ?? ''}`, { waitUntil: 'domcontentloaded' });
	const c = { browser, ctx, p, errs, vp, touch };
	await pressIn(c);
	return c;
}
/** press PRESS ANYWHERE until the game is up and at rest, then let the first tap window pass */
async function pressIn(c) {
	const { p, vp } = c;
	for (let i = 0; i < 200; i++) {
		const up = await H(p, () => {
			const h = window.__reindeer;
			return !!(h && h.atRest && h.atRest() && h.symbolPopup && h.hud && !document.querySelector('.landing'));
		}).catch(() => false);
		if (up) break;
		if (i % 2 === 1) await p.mouse.click(vp.width / 2, vp.height / 2).catch(() => {});
		await sleep(600);
	}
	await settle(c, 60000);
	const ft = await H(p, () => window.__reindeer.symbolPopup.firstTap());
	const since = await H(p, () => performance.now());
	await sleep(Math.max(0, ft.ignoreMs - (since - ft.pressedAt)) + 400);
	// the press clicks land on the board's middle: one after the first tap window rightly opens a popup there
	if ((await st(p)).open) {
		info('a press click after the first tap window opened a popup on the board (as a player tapping on would); closed with Escape');
		await p.keyboard.press('Escape');
		await sleep(200);
	}
}
/** the posed board at rest, a crash cloud on GW_AT (both by the dev hook: no book) */
async function placeBoard(c) {
	await H(c.p, (board) => window.__reindeer.setBoard(board), POSE);
	await H(c.p, ([r, w]) => {
		void window.__reindeer.grandmaWild(r * 4 + w, 5);
	}, GW_AT);
	await sleep(900);
	const b = await H(c.p, () => window.__reindeer.symbolPopup.board());
	const want = POSE.map((col, r) => col.map((s, w) => (r === GW_AT[0] && w === GW_AT[1] ? 'GW' : s)));
	ok(JSON.stringify(b) === JSON.stringify(want), 'the posed board stands as posed (the cloud on its cell)', { b, want });
	return want;
}
const popupText = (p) => H(p, () => document.querySelector('[data-symbol-popup]')?.innerText ?? '');
const num = (s) => Number(String(s).replace(/[^0-9.]/g, ''));

/** what the popup says for `code`, checked against the paytable, Game Info's rule and its sentences */
async function checkContent(p, code, label, wording = 'standard', coinMark = null) {
	const s = await st(p);
	ok(s.kind === KIND_WORD[code], `${label}: the kind line says ${s.kind}`, { kind: s.kind });
	if (NAMES[code]) ok(s.name === NAMES[code], `${label}: named ${s.name}`, { name: s.name });
	if (LINES[wording][code]) {
		ok(JSON.stringify(s.lines) === JSON.stringify(LINES[wording][code]) && s.rows.length === 0, `${label}: Game Info's own sentences`, { lines: s.lines, want: LINES[wording][code] });
		ok(s.note === (code.startsWith('CW_') ? COLUMN_NOTE : null), `${label}: the foot note ${s.note === null ? '(none)' : `"${s.note}"`}`, { note: s.note });
		return s;
	}
	const bet = await H(p, () => window.__reindeer.symbolPopup.bet());
	const keys = s.rows.map((r) => r.k);
	const got = s.rows.map((r) => r.v);
	// amounts in the HUD's own formatter in every session, social included (its GC / SC; never "Nx" multiples)
	const want = await H(p, (m) => m.map((x) => window.__reindeer.symbolPopup.fmt(x * window.__reindeer.symbolPopup.bet())), PAYTABLE[code]);
	const rule = await H(p, (m) => m.map((x) => window.__reindeer.symbolPopup.payText(x)), PAYTABLE[code]);
	const numeric = got.every((v, i) => Math.abs(num(v) - PAYTABLE[code][i] * bet) < 0.0051) && !got.some((v) => /x$/.test(v));
	const coin = !coinMark || got.every((v) => v.endsWith(coinMark) && /^[0-9,]+\.\d{2,4}\u00a0[A-Z]{2}$/.test(v) && !v.includes('$'));
	ok(JSON.stringify(keys) === JSON.stringify(KINDS) && JSON.stringify(got) === JSON.stringify(want) && JSON.stringify(got) === JSON.stringify(rule) && numeric && coin, `${label}: ${code} at ${bet} == paytable x play amount in the HUD's formatter (${got.join(' / ')})`, { keys, got, want, rule, bet, coinMark });
	ok(JSON.stringify(s.head) === JSON.stringify(HEAD[wording]) && s.rows[2]?.top === true, `${label}: heading ${JSON.stringify(s.head)}, the 5 in a row in the accent`, { head: s.head, rows: s.rows });
	return s;
}
/** inside the screen, never over its own cell (or column); also whether it is inside the board */
function geometry(s, vp) {
	const P = s.place;
	const c = s.cell;
	const inScreen = P.x >= -0.5 && P.y >= -0.5 && P.x + P.width <= vp.width + 0.5 && P.y + P.height <= vp.height + 0.5;
	const overCell = P.x < c.x + c.width - 0.5 && P.x + P.width > c.x + 0.5 && P.y < c.y + c.height - 0.5 && P.y + P.height > c.y + 0.5;
	const B = s.board;
	const inBoard = P.x >= B.x - 0.5 && P.y >= B.y - 0.5 && P.x + P.width <= B.x + B.width + 0.5 && P.y + P.height <= B.y + B.height + 0.5;
	// a standing column with no room around it (SymbolPopup.svelte's fallback): it may lie over the column, never over
	// the tapped cell itself; reported, not hidden
	const t = s.tapped;
	const overTapped = !!t && P.x < t.x + t.width - 0.5 && P.x + P.width > t.x + 0.5 && P.y < t.y + t.height - 0.5 && P.y + P.height > t.y + 0.5;
	if (s.column && overCell && !overTapped) {
		info(`${s.code} at ${s.reel},${s.row}: no room clear of the whole column; clear of the tapped cell instead (over the column's other cells)`);
		return { inScreen, overCell: false, inBoard, overColumn: true };
	}
	return { inScreen, overCell, inBoard };
}
async function shot(p, name) {
	if (!SHOTS) return;
	await sleep(260);
	await p.screenshot({ path: join(OUT, name) });
	// where the popup and its cell are in the shot (the sheet builder crops around them)
	const s = await st(p);
	const vp = p.viewportSize();
	writeFileSync(join(OUT, name.replace(/\.png$/, '.json')), JSON.stringify({ vp, place: s.place, cell: s.cell, code: s.code }));
}
/** the words a player sees: no restricted word, nothing outside printable ASCII */
async function words(p, label, social = false) {
	const t = await popupText(p);
	const hits = t.match(social ? SOCIAL_BANNED : BANNED) || [];
	ok(hits.length === 0 && /^[\x20-\x7e\n\u00a0]*$/.test(t), `${label}: no restricted word, plain ASCII (and an amount's no-break space)`, { hits, t });
	return t;
}

/** the 20 cell sweep: each tap moves the popup there */
async function sweep(c, label) {
	const { p, vp } = c;
	const board = await H(p, () => window.__reindeer.symbolPopup.board());
	const bad = [];
	let inBoard = 0;
	let last = null;
	for (let reel = 0; reel < 5; reel++) {
		for (let row = 0; row < 4; row++) {
			// a standing column: one tap per reel (a second tap in it would close it)
			const col = board[reel][row]?.startsWith('CW_');
			if (col && last === reel) continue;
			if (!col && (await st(p)).open && (await st(p)).column) {
				await p.keyboard.press('Escape');
				await sleep(150);
			}
			await tapCell(c, reel, row, 220);
			last = col ? reel : null;
			const s = await st(p);
			if (!s.open || s.code !== board[reel][row] || s.reel !== reel) {
				bad.push({ reel, row, open: s.open, code: s.code, want: board[reel][row] });
				continue;
			}
			const g = geometry(s, vp);
			if (!g.inScreen || g.overCell) bad.push({ reel, row, ...g, place: s.place, cell: s.cell });
			if (g.inBoard) inBoard++;
		}
	}
	await p.keyboard.press('Escape');
	await sleep(200);
	ok(bad.length === 0, `${label}: every cell opens its own symbol, inside the screen, never over the tapped cell (${inBoard} inside the board)`, { bad: bad.slice(0, 6), n: bad.length });
}

/** a round with taps on the board all through it: the popup never up unless the board is idle and quiet */
async function tapsThrough(c, label, start, maxMs = 300000, strict = false) {
	const { p } = c;
	let opened = 0;
	let taps = 0;
	let done = false;
	let started = false;
	c.stopStrict = false;
	const run = start().then((r) => ((done = true), r), (e) => ((done = true), ok(false, `${label}: threw`, String(e).slice(0, 300))));
	const cells = [[0, 1], [2, 2], [4, 0], [3, 3]];
	const t0 = Date.now();
	while (!done && Date.now() - t0 < maxMs) {
		if (strict && c.stopStrict) break;
		if (strict && !started) {
			started = !(await idleNow(p));
			if (!started) {
				await sleep(50);
				continue;
			}
		}
		const notIdle = strict || !(await idleNow(p));
		if (notIdle) {
			const [r, w] = cells[taps % cells.length];
			await tapCell(c, r, w, 0).catch(() => {});
			taps++;
		}
		for (let i = 0; i < 4; i++) {
			const s = await st(p).catch(() => ({ open: false }));
			const idle = strict ? false : await idleNow(p);
			if (s.open && !idle) opened++;
			await sleep(90);
		}
	}
	await run;
	ok(opened === 0 && taps > 0, `${label}: ${taps} taps on the board while it played, the popup never up while not idle`, { opened, taps });
}

// ---- sections --------------------------------------------------------------------------------------------------------
async function main() {
	section = 'main';
	const vp = { width: 1440, height: 900 };
	const c = await boot(vp);
	const { p } = c;
	try {
		ok(!(await st(p)).open && (await H(p, () => window.__reindeer.symbolPopup.idle())), 'booted idle, no popup up');
		const cfg = readFileSync(join(HERE, '../src/game/config.ts'), 'utf8');
		const fromCfg = {};
		for (const m of cfg.matchAll(/(\w\d):\s*\{[^}]*paytable:\s*\[([^\]]+)\]/g)) fromCfg[m[1]] = m[2].split(',').map(Number);
		ok(JSON.stringify(fromCfg) === JSON.stringify(PAYTABLE), "the probe's paytable == config.ts", fromCfg);

		// the first board's standing columns: any cell of the reel shows that character
		const lb = await H(p, () => window.__reindeer.symbolPopup.board());
		for (const [reel, code] of Object.entries(LANDING_COLUMNS)) {
			const r = Number(reel);
			ok(lb[r].every((x) => x === code), `the first board: reel ${r + 1} is the ${code.slice(3)} column in all four cells`, lb[r]);
			await tapCell(c, r, r % 4);
			const s = await st(p);
			ok(s.open && s.code === code && s.column, `a tap on the ${code.slice(3)} column opens its popup`, s);
			await checkContent(p, code, `column ${code.slice(3)}`);
			const g = geometry(s, vp);
			ok(g.inScreen && !g.overCell, `column ${code.slice(3)}: inside the screen, clear of the whole column (side ${s.place?.side})`, { g, place: s.place, cell: s.cell });
			await words(p, `column ${code.slice(3)}`);
			await shot(p, `desk1440_${code}.png`);
			await tapCell(c, r, (r + 2) % 4);
			const l = await lastLog(p);
			ok(!(await st(p)).open && l?.why === 'same symbol', `column ${code.slice(3)}: a second tap elsewhere in the same column closes it`, l);
		}

		await placeBoard(c);
		const hud = await H(p, () => document.querySelector('.hudp [data-hud="amount"]')?.innerText?.trim());
		const fmtBet = await H(p, () => window.__reindeer.symbolPopup.fmt(window.__reindeer.symbolPopup.bet()));
		ok(hud && hud.includes(fmtBet), `the HUD's amount readout (${hud}) shows the popup's formatter at the play amount (${fmtBet})`, { hud, fmtBet });

		// every kind
		for (const [key, [code, reel, row]] of Object.entries(SPOTS)) {
			await tapCell(c, reel, row);
			const s = await st(p);
			ok(s.open && s.code === code, `${key}: a click on ${code} at ${reel},${row} opens its popup`, s);
			if (!s.open) continue;
			await checkContent(p, code, key);
			const g = geometry(s, vp);
			ok(g.inScreen && !g.overCell, `${key}: inside the screen and beside the cell (side ${s.place.side}, inside the board: ${g.inBoard})`, { g, place: s.place, cell: s.cell });
			await words(p, key);
			await shot(p, `desk1440_${key}.png`);
			await tapCell(c, reel, row);
			const l = await lastLog(p);
			ok(!(await st(p)).open && l?.why === 'same symbol', `${key}: a second tap on the same symbol closes it`, l);
		}
		// every paying symbol (the posed board holds all nine)
		for (const code of Object.keys(PAYTABLE)) {
			const r = POSE.findIndex((col) => col.includes(code));
			await tapCell(c, r, POSE[r].indexOf(code));
			await checkContent(p, code, `paytable ${code}`);
		}
		await p.keyboard.press('Escape');
		await sleep(150);

		// the switch: another symbol moves it, without a close
		await tapCell(c, 0, 0);
		await tapCell(c, 2, 1);
		const s2 = await st(p);
		const l2 = await H(p, () => window.__reindeer.symbolPopup.log().slice(-2));
		ok(s2.open && s2.code === 'L5' && l2.every((e) => e.what === 'open'), 'a tap on another symbol moves the popup there (no close between)', { s2, l2 });

		// the timeout
		await p.keyboard.press('Escape');
		await sleep(150);
		await tapCell(c, 0, 0, 0);
		const closed = await waitClosed(p, 6000);
		const log = await H(p, () => window.__reindeer.symbolPopup.log().slice(-2));
		const spec = await H(p, () => window.__reindeer.symbolPopup.spec());
		const dt = log.length === 2 ? log[1].at - log[0].at : -1;
		ok(closed && log[1]?.why === 'timeout' && dt >= spec.timeoutMs - 20 && dt - spec.timeoutMs < 450, `the timeout: closed by itself after ${Math.round(dt)} ms (constant ${spec.timeoutMs}; a busy main thread under nice 19 runs a timer late)`, { log, dt });

		// what closes it
		const open = async () => {
			await tapCell(c, 0, 0);
			return (await st(p)).open;
		};
		const closesOn = async (label, act, why = 'press') => {
			const was = await open();
			await act();
			await sleep(250);
			const l = await lastLog(p);
			ok(was && !(await st(p)).open && (why == null || l?.why === why), `closes on ${label}`, { was, l });
		};
		await closesOn('Escape', () => p.keyboard.press('Escape'), 'escape');
		await closesOn('another key (Shift)', () => p.keyboard.press('Shift'), 'key');
		// empty canvas: the snow above the road (the canvas must be what is there)
		const bc = await H(p, () => window.__reindeer.symbolPopup.boardCss());
		const empty = { x: bc.x + bc.width * 0.5, y: Math.max(8, bc.y - 24) };
		const onCanvas = await H(p, ([x, y]) => document.elementFromPoint(x, y)?.tagName, [empty.x, empty.y]);
		ok(onCanvas === 'CANVAS', `the empty space point (${Math.round(empty.x)}, ${Math.round(empty.y)}) is bare canvas`, onCanvas);
		await closesOn('a press on empty space', () => p.mouse.click(empty.x, empty.y));
		ok(!(await st(p)).open && (await lastLog(p))?.why === 'press', 'that press opened nothing either');
		await closesOn('the Menu key (and the menu opens)', () => p.click('.hudp [data-hud="menu-key"]'));
		ok(!(await H(p, () => window.__reindeer.symbolPopup.idle())), 'with the menu open the board is not idle');
		await tapCell(c, 3, 2);
		ok(!(await st(p)).open, 'a tap on a symbol with the menu open: no popup (the press only closes the menu)');
		if (!(await H(p, () => window.__reindeer.symbolPopup.idle()))) await p.click('.hudp [data-hud="menu-key"]').catch(() => {});
		await sleep(400);
		ok(await H(p, () => window.__reindeer.symbolPopup.idle()), 'menu closed again: idle');
		await tapCell(c, 3, 2);
		ok((await st(p)).open, 'the next tap opens it');
		await p.keyboard.press('Escape');
		await sleep(150);

		// two play amounts
		const bet1 = await H(p, () => window.__reindeer.symbolPopup.bet());
		await closesOn('the + step', () => p.click('.hudp [data-hud-step="plus"]'));
		await sleep(200);
		const bet2 = await H(p, () => window.__reindeer.symbolPopup.bet());
		ok(bet2 > bet1, `the play amount went up (${bet1} -> ${bet2})`);
		for (const [code, r, w] of [SPOTS.high, SPOTS.low, SPOTS.mid]) {
			await tapCell(c, r, w);
			await checkContent(p, code, 'play amount 2');
		}
		await p.keyboard.press('Escape');
		await p.click('.hudp [data-hud-step="minus"]');
		await sleep(300);
		ok((await H(p, () => window.__reindeer.symbolPopup.bet())) === bet1, 'play amount back to level 1');

		const turboLabel = () => H(p, () => document.querySelector('.hudp button[aria-label^="Turbo"]')?.getAttribute('aria-label'));
		const t0 = await turboLabel();
		await closesOn('turbo', () => p.click('.hudp button[aria-label^="Turbo"]'));
		for (let i = 0; i < 3 && (await turboLabel()) !== t0; i++) {
			await p.click('.hudp button[aria-label^="Turbo"]');
			await sleep(200);
		}
		ok((await turboLabel()) === t0, `turbo back to "${t0}"`);

		// a modal: the autoplay card
		await closesOn('the Autoplay key (its card opens)', () => p.click('.hudp button[aria-label="Autoplay"]'));
		await sleep(300);
		ok(!(await H(p, () => window.__reindeer.symbolPopup.idle())), 'with a modal open the board is not idle');
		await tapCell(c, 0, 0).catch(() => {});
		ok(!(await st(p)).open, 'a tap where a symbol is, with the card up: no popup');
		await p.keyboard.press('Escape');
		await sleep(500);
		if (!(await H(p, () => window.__reindeer.symbolPopup.idle()))) {
			await p.keyboard.press('Escape');
			await sleep(500);
		}
		ok(await H(p, () => window.__reindeer.symbolPopup.idle()), 'card closed: idle');

		// a Spin press: the time from the press going down to the round leaving idle, with no popup and with one up
		const pressToRound = async () => {
			await H(p, () => {
				const w = window;
				w.__spT = { down: null, round: null };
				const down = () => {
					w.__spT.down = performance.now();
					window.removeEventListener('pointerdown', down, true);
					const poll = () => {
						if (!window.__reindeer.hud.idle()) w.__spT.round = performance.now();
						else requestAnimationFrame(poll);
					};
					poll();
				};
				window.addEventListener('pointerdown', down, true);
			});
			await p.click('.hudp button.spin');
			for (let i = 0; i < 40; i++) {
				const t = await H(p, () => window.__spT);
				if (t.round !== null) return t.round - t.down;
				await sleep(25);
			}
			return Infinity;
		};
		await H(p, () => window.__reindeer.fixtures.next('no_win_1'));
		let n0 = await plays(p);
		const plain = await pressToRound();
		await settle(c);
		await placeBoard(c);
		await H(p, () => window.__reindeer.fixtures.next('no_win_1'));
		const was = await open();
		const withPopup = await pressToRound();
		await sleep(300);
		const lw = await lastLog(p);
		ok(was && !(await st(p)).open && (lw?.why === 'press' || lw?.why === 'not idle'), `the Spin button with the popup up closes it (${lw?.why})`, { was, lw });
		await settle(c);
		ok((await plays(p)) === n0 + 2, 'the two Spin presses started exactly one round each', { plays: (await plays(p)) - n0 });
		ok(withPopup <= plain + 34 && withPopup < 250, `the round leaves idle ${withPopup.toFixed(1)} ms after the press with the popup up, ${plain.toFixed(1)} ms with none (no delay)`, { plain, withPopup });

		// Space still spins, and closes it
		await placeBoard(c);
		await H(p, () => window.__reindeer.fixtures.next('no_win_2'));
		n0 = await plays(p);
		await closesOn('Space (and the round starts)', () => p.keyboard.press('Space'), 'key');
		await sleep(600);
		ok((await plays(p)) === n0 + 1, 'Space with the popup up started exactly one round', { rounds: (await plays(p)) - n0 });
		await settle(c);

		// THE HURRY: a board click during a live spin still hurries it and opens nothing
		await H(p, () => window.__reindeer.fixtures.next('plain_line_win'));
		await p.click('.hudp button.spin');
		await sleep(250);
		const h0 = await H(p, () => window.__reindeer.hurryLevel());
		await tapCell(c, 2, 1, 120);
		const h1 = await H(p, () => window.__reindeer.hurryLevel());
		const sh = await st(p);
		ok(h0 === 0 && h1 > 0 && !sh.open, `a board click 250 ms into a spin hurries it (hurry ${h0} -> ${h1}) and opens no popup`, { h0, h1, open: sh.open });
		await settle(c);
		// a tap at rest after a round: opens again, and starts nothing
		n0 = await plays(p);
		await tapCell(c, 2, 1, 400);
		const sr = await st(p);
		ok(sr.open && (await plays(p)) === n0, `after a round, a tap at rest opens the popup (${sr.code}) and starts no round`, sr);
		await p.keyboard.press('Escape');
		ok(c.errs.length === 0, 'no page or console errors', c.errs.slice(0, 5));
	} finally {
		await c.browser.close();
	}
}

async function rounds() {
	section = 'rounds';
	const vp = { width: 1440, height: 900 };
	let c = await boot(vp);
	try {
		const { p } = c;
		// a base round with a line win, from the Spin button
		await H(p, () => window.__reindeer.fixtures.next('plain_line_win'));
		await tapsThrough(c, 'a base round', async () => {
			await p.click('.hudp button.spin');
			await sleep(400);
			await settle(c);
		});
		// a base round with a column Wild standing after it: at rest it shows the column's popup
		await H(p, () => window.__reindeer.fixtures.next('base_one_column'));
		await tapsThrough(c, 'a base round with a column Wild', async () => {
			await p.click('.hudp button.spin');
			await sleep(400);
			await settle(c);
		});
		const cols = await H(p, () => window.__reindeer.road().features.columns.map((x) => ({ reel: x.reel, tier: x.tier })));
		if (cols.length) {
			await tapCell(c, cols[0].reel, 1);
			const s = await st(p);
			ok(s.open && s.code === `CW_${cols[0].tier}`, `after it, the standing ${cols[0].tier} column (reel ${cols[0].reel + 1}) shows its popup at rest`, s);
			await p.keyboard.press('Escape');
		} else info('base_one_column left no column standing at rest');
		// a natural Free Spins round: its entry card, the spins and the wrap-up card
		await H(p, () => window.__reindeer.fixtures.next('natural_free_spins'));
		await tapsThrough(c, 'a Free Spins round (entry and wrap-up cards included)', async () => {
			await p.click('.hudp button.spin');
			await sleep(400);
			await settle(c, 280000);
		}, 300000);
		await sleep(500);
		let n0 = await plays(p);
		await tapCell(c, 0, 0, 400);
		ok((await st(p)).open && (await plays(p)) === n0, 'after the Free Spins round, a tap at rest opens it and starts no round');
		await p.keyboard.press('Escape');

		// an autoplay run: load 10 and start, taps all through the run (its gaps too), then stop
		n0 = await plays(p);
		await p.click('.hudp button[aria-label="Autoplay"]');
		await sleep(600);
		await p.click('.am-ui.layer.modals .go');
		await sleep(600);
		await tapsThrough(c, 'an autoplay run', async () => {
			await p.click('.hudp button.spin');
			const t0 = Date.now();
			while (Date.now() - t0 < 90000 && (await plays(p)) < n0 + 3) await sleep(200);
			ok((await plays(p)) >= n0 + 3, `the autoplay run played ${(await plays(p)) - n0} rounds before the stop`);
			c.stopStrict = true;
			await sleep(400);
			await p.click('.hudp button.spin').catch(() => {});
			await sleep(800);
			await settle(c);
		}, 300000, true);
		await sleep(400);
		await tapCell(c, 2, 1);
		ok((await st(p)).open, 'after the autoplay run stopped, a tap at rest opens it again');
		await p.keyboard.press('Escape');
		ok(c.errs.length === 0, 'no page or console errors', c.errs.slice(0, 5));

		// a round resumed after a reload (a free spin's reveal): taps through the resume, never up until it is over
		await H(p, () => window.__reindeer.fixtures.resume('natural_free_spins', 9)).catch(() => {});
		await sleep(1500);
		c.errs.length = 0;
		let opened = 0;
		let taps = 0;
		let pressed = false;
		const t0 = Date.now();
		while (Date.now() - t0 < 240000) {
			const s = await H(p, () => {
				const h = window.__reindeer;
				if (!h?.symbolPopup || !h.hud) return { up: false };
				return { up: true, idle: h.symbolPopup.idle() && h.symbolPopup.quiet(), open: h.symbolPopup.state().open, gates: h.hud.gates(), landing: !!document.querySelector('.landing'), resume: h.resume?.() ?? null, gt: h.gameType() };
			}).catch(() => ({ up: false }));
			if (!s.up || s.landing) {
				// (the resume card, 2026-11-18: Play Round; a click on its dim does nothing)
				await H(p, () => document.querySelector('[data-resume-card] [data-resume="play"]')?.click()).catch(() => {});
				await p.mouse.click(vp.width / 2, vp.height / 2).catch(() => {});
				await sleep(500);
				continue;
			}
			pressed = true;
			if (s.open && !s.idle) opened++;
			if (s.idle && s.gt !== 'freegame' && taps > 4) break;
			if (s.gates > 0) await p.mouse.click(vp.width / 2, vp.height * 0.4).catch(() => {});
			else {
				await tapCell(c, (taps % 5), taps % 4, 0).catch(() => {});
				taps++;
			}
			await sleep(250);
		}
		ok(pressed && taps > 4 && opened === 0, `a round resumed after a reload: ${taps} taps through it, the popup never up while not idle`, { opened, taps });
		await settle(c);
		await sleep(2500);
		await tapCell(c, 0, 0, 400);
		ok((await st(p)).open, 'after the resumed round, a tap at rest opens it');
		ok(c.errs.length === 0, 'no page or console errors (the resume)', c.errs.slice(0, 5));
	} finally {
		await c.browser.close();
	}
}

async function social() {
	section = 'social';
	const vp = { width: 1440, height: 900 };
	const c = await boot(vp, { query: '&social=true' });
	const { p } = c;
	try {
		await placeBoard(c);
		// a stake.us session plays in Stake Cash or Gold Coins: the play currency set by the dev hook (the fixtures
		// answer USD), the popup's amounts read in that coin as Stake's table writes it, the amount first, two decimals,
		// then the code ("1.50 SC", "2.00 GC"; game/currency.ts, 2026-11-21)
		// (the code after a no-break space, U+00A0: game/currency.ts AMOUNT_SPACE, wip/pricefit)
		for (const [cur, mark] of [['XSC', '\u00a0SC'], ['XGC', '\u00a0GC']]) {
			await H(p, (code) => window.__reindeer.ledCurrency(code), cur);
			await sleep(150);
			for (const [key, [code, reel, row]] of Object.entries(SPOTS)) {
				if (cur === 'XGC' && !['high', 'low'].includes(key)) continue;
				if ((await st(p)).open) {
					await p.keyboard.press('Escape');
					await sleep(200);
				}
				await tapCell(c, reel, row);
				const s = await st(p);
				ok(s.open && s.code === code, `${cur} ${key}: opens in social`, s);
				await checkContent(p, code, `social ${cur} ${key}`, 'social', mark);
				await words(p, `social ${cur} ${key}`, true);
				if (key === 'high') await shot(p, `social_desk1440_high_${cur}.png`);
			}
		}
		ok(c.errs.length === 0, 'no page or console errors', c.errs.slice(0, 5));
	} finally {
		await c.browser.close();
	}
}

const SIZES = [
	{ name: 'desk1440', vp: { width: 1440, height: 900 }, touch: false, kinds: true },
	{ name: 'desk1920', vp: { width: 1920, height: 1080 }, touch: false },
	{ name: 'side844', vp: { width: 844, height: 390 }, touch: true },
	{ name: 'up844', vp: { width: 390, height: 844 }, touch: true, kinds: true },
	{ name: 'up620', vp: { width: 390, height: 620 }, touch: true, kinds: true },
	// (2026-11-17) the narrowest upright phone the game is drawn for: the column popups' fallback
	{ name: 'up640', vp: { width: 360, height: 640 }, touch: true, kinds: true },
];
async function sizes() {
	for (const S of SIZES) {
		if (process.env.SIZES && !process.env.SIZES.split(',').includes(S.name)) continue;
		section = `sizes ${S.name}`;
		const c = await boot(S.vp, { touch: S.touch });
		const { p } = c;
		try {
			// the first board's columns
			await sweep(c, `${S.name} the first board (three columns)`);
			// every column, tapped in each of its four rows (2026-11-17: the small phones' fallback, browser checked): inside
			// the screen, never over the tapped cell; clear of the whole column wherever the usual or the tight margins
			// (SYMBOL_POPUP.tight, read from the page) leave room, which the INFO line reports
			const spec = await H(p, () => window.__reindeer.symbolPopup.spec());
			for (const [reel, code] of Object.entries(LANDING_COLUMNS)) {
				for (let row = 0; row < 4; row++) {
					await tapCell(c, Number(reel), row);
					const s = await st(p);
					const g = geometry(s, S.vp);
					const t = s.tapped;
					const P = s.place;
					const gapCol = P ? Math.max(s.cell.x - (P.x + P.width), P.x - (s.cell.x + s.cell.width), s.cell.y - (P.y + P.height), P.y - (s.cell.y + s.cell.height)) : null;
					ok(s.open && s.code === code && s.row === row && g.inScreen && !g.overCell, `${S.name} ${code} row ${row}: inside the screen, clear of the ${g.overColumn ? 'tapped cell' : 'column'} (side ${P?.side}, ${Math.round(P?.width)} x ${Math.round(P?.height)} at ${Math.round(P?.x)}, ${Math.round(P?.y)})`, { g, place: P, cell: s.cell, tapped: t });
					if (!g.overColumn && gapCol !== null && gapCol < spec.gapCss - 0.5) info(`${S.name} ${code} row ${row}: clear of the column with the tight margins (gap ${gapCol.toFixed(1)} px, usual ${spec.gapCss}, tight ${spec.tight.gapCss})`);
					if (S.kinds && row === 1) await shot(p, `${S.name}_${code}.png`);
					await p.keyboard.press('Escape');
					await sleep(150);
				}
			}
			await placeBoard(c);
			await sweep(c, `${S.name} the posed board`);
			for (const [key, [code, reel, row]] of Object.entries(SPOTS)) {
				await tapCell(c, reel, row);
				const s = await st(p);
				const g = geometry(s, S.vp);
				ok(s.open && s.code === code && g.inScreen && !g.overCell, `${S.name} ${key}: inside the screen and beside the cell (side ${s.place?.side}, inside the board ${g.inBoard}, ${Math.round(s.place?.width)} x ${Math.round(s.place?.height)}, k ${s.k?.toFixed(2)})`, { g, place: s.place, cell: s.cell });
				// no text spills out of the sign
				const spill = await H(p, () => {
					const pop = document.querySelector('[data-symbol-popup] .sp-pop');
					if (!pop) return ['no sign'];
					const pr = pop.getBoundingClientRect();
					const out = [];
					for (const e of pop.querySelectorAll('*')) {
						const r = e.getBoundingClientRect();
						if (r.width === 0) continue;
						if (r.left < pr.left - 0.5 || r.right > pr.right + 0.5 || r.top < pr.top - 0.5 || r.bottom > pr.bottom + 0.5 || e.scrollWidth > e.clientWidth + 1) out.push(e.className);
					}
					return out;
				});
				ok(spill.length === 0, `${S.name} ${key}: nothing spills out of the sign`, spill);
				if (S.kinds && ['high', 'low', 'wild', 'scatter', 'cloud'].includes(key)) await shot(p, `${S.name}_${key}.png`);
				if (!S.kinds && key === 'high') await shot(p, `${S.name}_${key}.png`);
				await p.keyboard.press('Escape');
				await sleep(150);
			}
			// the tap targets: a cell's size on screen (the whole cell is the target)
			const cell = await H(p, () => window.__reindeer.symbolPopup.cellCss(0, 1));
			const fs = await (async () => {
				await tapCell(c, 2, 1);
				const f = await H(p, () => {
					const q = (s) => document.querySelector(`[data-symbol-popup] ${s}`);
					return { name: parseFloat(getComputedStyle(q('.sp-name')).fontSize), row: parseFloat(getComputedStyle(q('.sp-v')).fontSize) };
				});
				await p.keyboard.press('Escape');
				return f;
			})();
			info(`${S.name}: a cell is ${cell.width.toFixed(1)} x ${cell.height.toFixed(1)} CSS px (the tap target); popup text ${fs.name.toFixed(1)} px name, ${fs.row.toFixed(1)} px amounts`);
			ok(Math.min(cell.width, cell.height) >= 44 || S.vp.width <= 400, `${S.name}: a cell is at least 44 px each way, or this is a small phone where the whole cell is the target`, cell);
			ok(c.errs.length === 0, `${S.name}: no page or console errors`, c.errs.slice(0, 5));
		} finally {
			await c.browser.close();
		}
	}
}

/** THE FIRST TAP: from PRESS ANYWHERE a tap every 100 ms on a symbol; none opens within ignoreMs, one after does */
async function firsttap() {
	for (const [name, vp, touch] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
		section = `firsttap ${name}`;
		const browser = await chromium.launch({ args: ['--mute-audio'] });
		const ctx = await browser.newContext({ viewport: vp, ...(touch ? { deviceScaleFactor: 3, isMobile: true, hasTouch: true } : {}) });
		const p = await ctx.newPage();
		const errs = [];
		p.on('pageerror', (e) => errs.push(e.message));
		await p.goto(`${APP}/?lang=en&sessionID=firsttap${name}${Date.now()}${touch ? '&tier=phone' : ''}`);
		const taps = [];
		let after = 0;
		const t0 = Date.now();
		while (Date.now() - t0 < 120000) {
			const s = await H(p, () => {
				const sp = window.__reindeer?.symbolPopup;
				const ft = sp?.firstTap?.() ?? null;
				return { landing: !!document.querySelector('.landing'), hook: !!sp, ft, pt: sp?.cellPoint?.(0, 1) ?? null, now: performance.now() };
			}).catch(() => null);
			if (s && s.hook && s.ft && s.ft.pressedAt > -1e12 && s.pt) {
				if (touch) await p.touchscreen.tap(s.pt.x, s.pt.y);
				else await p.mouse.click(s.pt.x, s.pt.y);
				taps.push({ since: Math.round(s.now - s.ft.pressedAt) });
				if (s.now - s.ft.pressedAt > s.ft.ignoreMs + 600) after += 1;
				if (after >= 3) break;
			} else if (s?.landing || !s?.hook) {
				if (touch) await p.touchscreen.tap(vp.width / 2, vp.height / 2).catch(() => {});
				else await p.mouse.click(vp.width / 2, vp.height / 2).catch(() => {});
			}
			await sleep(100);
		}
		const ft = await H(p, () => window.__reindeer.symbolPopup.firstTap());
		const log = await H(p, () => window.__reindeer.symbolPopup.log());
		const opens = log.filter((e) => e.what === 'open').map((e) => Math.round(e.at - ft.pressedAt));
		const inWin = taps.filter((t) => t.since < ft.ignoreMs);
		ok(ft.ignoreMs === 2000, `FIRST_TAP.ignoreMs is 2000 (${ft.ignoreMs})`, ft);
		ok(opens.every((o) => o >= ft.ignoreMs), `${inWin.length} taps on a symbol inside the ${ft.ignoreMs} ms after PRESS ANYWHERE open nothing (first tap at ${taps[0]?.since ?? '-'} ms)`, { inWin: inWin.map((t) => t.since), opens });
		ok(opens.length >= 1, `a tap after the window opens one (${opens[0] ?? '-'} ms after the press)`, { opens, taps: taps.map((t) => t.since) });
		ok(errs.length === 0, 'no page error', errs.slice(0, 3));
		await browser.close();
	}
}

/** the clip for Corey: an upright phone, recorded; open, switch, close, open, Spin with it up */
async function clip() {
	section = 'clip';
	const vp = { width: 390, height: 844 };
	const videoDir = join(tmpdir(), `sp_video_${Date.now()}`);
	mkdirSync(videoDir, { recursive: true });
	const c = await boot(vp, { touch: true, dpr: 2, video: videoDir });
	const { p } = c;
	let span = null;
	try {
		await placeBoard(c);
		await sleep(800);
		const a = await H(p, () => performance.now() / 1000);
		await sleep(600);
		await tapCell(c, 0, 0, 1500);
		await tapCell(c, 2, 2, 1500);
		await tapCell(c, 4, 1, 1500);
		await tapCell(c, 4, 1, 900);
		await tapCell(c, 2, 1, 1300);
		await H(p, () => window.__reindeer.fixtures.next('plain_line_win'));
		await p.locator('.hudp button.spin').tap();
		await sleep(2600);
		const b = await H(p, () => performance.now() / 1000);
		span = { from: a, to: b };
		ok(!(await st(p)).open, 'the clip: the Spin press closed it and the round runs');
	} finally {
		const video = p.video();
		await p.close().catch(() => {});
		await c.browser.close();
		if (video && span) {
			const src = await video.path();
			const gif = join(OUT, 'symbol_popup_idle_and_spin.gif');
			const ss = Math.max(0, span.from).toFixed(2);
			const dur = (span.to - span.from + 0.2).toFixed(2);
			try {
				execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss, '-i', src, '-t', dur, '-vf', 'fps=12,scale=300:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', gif]);
				console.log('clip', { ss, dur, gif });
			} catch (e) {
				console.log('ffmpeg failed', String(e).slice(0, 300));
			}
			rmSync(videoDir, { recursive: true, force: true });
		}
	}
}

const t0 = Date.now();
for (const [name, fn] of Object.entries({ main, rounds, social, sizes, firsttap, clip })) {
	if (!ONLY.includes(name)) continue;
	try {
		await fn();
	} catch (e) {
		ok(false, `${name} threw`, String(e?.stack || e).slice(0, 800));
	}
}
const fails = results.filter((r) => !r.ok);
const out = join(OUT, `probe_results_${ONLY.join('-')}${process.env.SIZES ? '_' + process.env.SIZES.replace(/,/g, '-') : ''}.json`);
writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), passed: results.length - fails.length, failed: fails.length, results }, null, 1));
console.log(`\n${results.length - fails.length} PASS / ${fails.length} FAIL  (${out})`);
process.exit(fails.length ? 1 : 0);
