// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,fixtures/showcaseBooks.ts,game/road/roadSounds.ts,game/road/winLights.ts,game/sound.ts};
// WATCHES: ; __reindeer.atRest, __reindeer.boardLayout, __reindeer.clock, __reindeer.fixtures, __reindeer.frame, __reindeer.hud
// WATCHES: ; __reindeer.road, __reindeer.roadSounds, __reindeer.roadSprites, __reindeer.soundTap, __reindeer.step, __reindeer.tune
// WATCHES: ; __reindeer.turbo, __reindeer.winLights, __reindeer.winLightsShown, LINE_WIN, sfx_line_show, .landing, .hudp, .spin
// THE WIN LINES PROBE (the Christmas lights, Corey 2026-11-15; constants LINE_WIN lights, game/road/winLights.ts). Posed
// books handed to the fixtures through the dev hook (presentation only, no math): a one line win, a three line win (three
// different paying symbols), and three palette boards that between them pay on every symbol (H1 to H4, a line of Wilds
// only, the five signs). At desktop 1440x900 and phone 390x844, the board clock frozen once the traffic has stopped and
// stepped one 60 Hz frame at a time through the whole win:
//   - THE LINE SCHEDULE (pass 6, Corey 2026-11-16; his timing page's schedule()): line i starts after gaps of staggerMs,
//     then each gapRatio times the one before (never under gapFloorMs), strings over drawMs x gapRatio^i (never under
//     drawFloorMs), comes down by downMode ('next', 'hold', 'end'; stayLitMs) over takeDownMs and is then gone; every
//     time x holdShare at turbo 1 and 2. Worked out here from the tunables on their own (sched below), so the checks
//     follow whatever numbers he picks; never more lines up at once than the schedule has; a symbol pulses only while
//     a line through it is up; the total when the last light is down
//   - a twelve line win from the fixtures (base_two_columns: two Wild columns, 12 lines) at normal speed and with a slam
//   - the line show's rate rises rateStep per line up to rateMax (the Howl's own rate per play), and in real time at
//     turbo 2 (the twelve line fixture, the clock not stepped) no line show overlaps the one before: each has ended or
//     was stopped as the next started
//   - each line's own amount appears on the frame its line completes (a one line win: none, its total is the amount),
//     and no two amounts touch; the total follows (its pop) and the line amounts fade
//   - each line's bulbs light one after another (never fewer than the frame before while it draws) in the palette of the
//     symbol the line pays
//   - sfx_line_show once per line, on the frame that line starts (the road's sound log against the Howl's own plays)
//   - after the win, and after a slam stop during it: nothing of the lights, the amounts or the total on screen
//   - the sprites and the WebGL draw calls per frame of a three line win, with the lights and without (the same frame)
//   - no page errors
// With OUT=<dir>: per-frame tables (table_<case>_<size>.md), frames for 60 fps clips (frames_<case>_<size>/, VIDEO=1),
// stills of each palette at 3 device px per CSS px (palette_<board>_<size>.png, crops.json; the caller upscales to 4x).
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [OUT=<dir>] [VIDEO=1] \
//     [ONLY=desktop,portrait] node tools/win_lines_probe.mjs
// Uses the dev server that is already running (it never starts one). One headless browser, muted, closed at the end.
// Take the shared browser lock around it (mkdir /tmp/hud_mock_shot.lock ... rmdir).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3014';
const OUT = process.env.OUT || '';
const VIDEO = process.env.VIDEO === '1';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
// (2026-11-17) the cases in three parts, each inside one browser lock turn: a (one, three, treatment B's own wins), b (the
// turbo levels and the slam stop), c (twelve lines, the cost, the palette stills)
const PART = (process.env.PART || 'a,x,b,c,clear').split(',');
const part = (x) => PART.includes(x);
if (OUT) mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FRAME = 1000 / 60;

// (2026-11-18, PART=clear) the sizes the amounts' clearance is checked at: Corey's 2000x945 window and the common desktop and
// wide sizes, with the existing two
const CLEAR_SIZES = [
	{ name: 'w2000', vp: { width: 2000, height: 945 }, dpr: 1, phone: false },
	{ name: 'w1280', vp: { width: 1280, height: 720 }, dpr: 1, phone: false },
	{ name: 'w1366', vp: { width: 1366, height: 768 }, dpr: 1, phone: false },
	{ name: 'w2560', vp: { width: 2560, height: 1080 }, dpr: 1, phone: false },
	{ name: 'desktop', vp: { width: 1440, height: 900 }, dpr: 1, phone: false },
	{ name: 'wide', vp: { width: 1920, height: 1080 }, dpr: 1, phone: false },
	{ name: 'portrait', vp: { width: 390, height: 844 }, dpr: 2, phone: true },
].filter((s) => !ONLY.length || ONLY.includes(s.name));
const SIZES = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, dpr: 2, phone: false },
	{ name: 'portrait', vp: { width: 390, height: 844 }, dpr: 3, phone: true },
].filter((s) => !ONLY.length || ONLY.includes(s.name));

// board[reel][row]; cells are reel * 4 + row; the paylines are config.paylines (1: top row, 2: second, 3: third, 4: bottom)
const book = (board, wins) => {
	const total = wins.reduce((n, w) => n + w.win, 0);
	return [
		{ index: 0, type: 'reveal', gameType: 'basegame', board },
		{ index: 1, type: 'winInfo', totalWin: total, wins },
		{ index: 2, type: 'setTotalWin', amount: total },
		{ index: 3, type: 'finalWin', amount: total },
	];
};
const row = (r, n) => Array.from({ length: n }, (_, reel) => reel * 4 + r);
const BOOKS = {
	// one line: police cars on line 2
	one: book([['L2', 'H4', 'L3', 'L5'], ['L3', 'H4', 'L5', 'L2'], ['L5', 'H4', 'L2', 'L3'], ['L4', 'L1', 'L3', 'L2'], ['L1', 'L3', 'L4', 'L5']], [{ symbol: 'H4', kind: 3, line: 2, win: 50, multiplier: 1, cells: row(1, 3) }]),
	// three lines, three palettes: Grandma's car x4 on line 1, police x3 on line 2, A x5 on line 4
	three: book(
		[['H1', 'H4', 'L3', 'L1'], ['H1', 'H4', 'L2', 'L1'], ['H1', 'H4', 'L5', 'L1'], ['H1', 'L3', 'L2', 'L1'], ['L4', 'L2', 'L5', 'L1']],
		[
			{ symbol: 'H1', kind: 4, line: 1, win: 500, multiplier: 1, cells: row(0, 4) },
			{ symbol: 'H4', kind: 3, line: 2, win: 50, multiplier: 1, cells: row(1, 3) },
			{ symbol: 'L1', kind: 5, line: 4, win: 250, multiplier: 1, cells: row(3, 5) },
		],
	),
	// (2026-11-18) the bottom lane only: lines 4, 10 and 12 all through the bottom lane (L1 five of a kind each, 3x and 1x),
	// competing for the same places: some go to the lane line under the bottom row, next to the LED strip
	bottom: book(
		[['H2', 'L3', 'L4', 'L1'], ['H3', 'L5', 'L1', 'L1'], ['L2', 'L4', 'L1', 'L1'], ['H4', 'L5', 'L1', 'L1'], ['L3', 'H2', 'L5', 'L1']],
		[
			{ symbol: 'L1', kind: 5, line: 4, win: 750, multiplier: 3, cells: row(3, 5) },
			{ symbol: 'L1', kind: 5, line: 10, win: 250, multiplier: 1, cells: [3, 7, 10, 15, 19] },
			{ symbol: 'L1', kind: 5, line: 12, win: 750, multiplier: 3, cells: [3, 6, 11, 14, 19] },
		],
	),
	// TREATMENT B (2026-11-17): three lines, the first and the third through a 5x Wild (posed: presentation only), the second
	// plain (x1: no multiplier, no slam)
	// (a small win in all, 9x: the strip counts its total)
	mixed: book(
		[['L4', 'H4', 'L3', 'L1'], ['L4', 'H4', 'L2', 'L1'], ['L4', 'H4', 'L5', 'L1'], ['H1', 'L3', 'L2', 'L1'], ['L2', 'L2', 'L5', 'L1']],
		[
			{ symbol: 'L4', kind: 3, line: 1, win: 100, multiplier: 5, cells: row(0, 3) },
			{ symbol: 'H4', kind: 3, line: 2, win: 50, multiplier: 1, cells: row(1, 3) },
			{ symbol: 'L1', kind: 5, line: 4, win: 750, multiplier: 3, cells: row(3, 5) },
		],
	),
	// the palette boards: every paying symbol once
	palA: book(
		[['H1', 'H2', 'H3', 'H4'], ['H1', 'H2', 'H3', 'H4'], ['H1', 'H2', 'H3', 'H4'], ['L5', 'L4', 'L5', 'L4'], ['L3', 'L5', 'L4', 'L5']],
		[
			{ symbol: 'H1', kind: 3, line: 1, win: 150, multiplier: 1, cells: row(0, 3) },
			{ symbol: 'H2', kind: 3, line: 2, win: 100, multiplier: 1, cells: row(1, 3) },
			{ symbol: 'H3', kind: 3, line: 3, win: 80, multiplier: 1, cells: row(2, 3) },
			{ symbol: 'H4', kind: 3, line: 4, win: 50, multiplier: 1, cells: row(3, 3) },
		],
	),
	palB: book(
		[['W', 'L1', 'L2', 'L3'], ['W', 'L1', 'L2', 'L3'], ['W', 'L1', 'L2', 'L3'], ['L5', 'L4', 'L5', 'L4'], ['L4', 'L5', 'L4', 'L5']],
		[
			{ symbol: 'W', kind: 3, line: 1, win: 150, multiplier: 1, cells: row(0, 3) },
			{ symbol: 'L1', kind: 3, line: 2, win: 30, multiplier: 1, cells: row(1, 3) },
			{ symbol: 'L2', kind: 3, line: 3, win: 30, multiplier: 1, cells: row(2, 3) },
			{ symbol: 'L3', kind: 3, line: 4, win: 20, multiplier: 1, cells: row(3, 3) },
		],
	),
	palC: book(
		[['L4', 'L5', 'H2', 'L1'], ['L4', 'L5', 'L1', 'H3'], ['L4', 'L5', 'H3', 'L2'], ['L1', 'L2', 'L3', 'H2'], ['L2', 'L3', 'H2', 'L1']],
		[
			{ symbol: 'L4', kind: 3, line: 1, win: 20, multiplier: 1, cells: row(0, 3) },
			{ symbol: 'L5', kind: 3, line: 2, win: 10, multiplier: 1, cells: row(1, 3) },
		],
	),
};

let pass = 0;
let fail = 0;
const fails = [];
const check = (ok, msg, detail) => {
	if (ok) pass += 1;
	else {
		fail += 1;
		fails.push(msg);
	}
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 700)) : ''}`);
};

const DRAW_COUNTER = () => {
	window.__dc = { calls: 0, frames: 0 };
	for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
		if (!C) continue;
		for (const fn of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
			const orig = C.prototype[fn];
			if (!orig) continue;
			C.prototype[fn] = function (...a) {
				window.__dc.calls += 1;
				return orig.apply(this, a);
			};
		}
	}
	const tick = () => {
		window.__dc.frames += 1;
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
};

async function boot(browser, S, extra = '') {
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.dpr, isMobile: S.phone, hasTouch: S.phone });
	await ctx.addInitScript(DRAW_COUNTER);
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=lights${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}${extra}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 160; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && !document.querySelector('.landing'))).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	// the effects sprite in (the line show is checked against the Howl's own plays)
	for (let i = 0; i < 60 && !(await p.evaluate(() => !!window.__reindeer?.soundTap?.()).catch(() => false)); i++) await sleep(500);
	await sleep(500);
	return { ctx, p, errs };
}

const R = (p, fn, arg) => p.evaluate(fn, arg);

/** the board's box on the page (CSS px), for clips and stills */
const boardClip = (p) =>
	R(p, () => {
		const L = window.__reindeer.boardLayout();
		const k = L.css.pitch / 250;
		return { x: Math.max(0, L.css.x - 40 * k), y: Math.max(0, L.css.y - 60 * k), width: Math.min(window.innerWidth, 1330 * k), height: Math.min(window.innerHeight, 760 * k) };
	});

/** a spin of a posed book; the board clock frozen once the lanes stop, stepped to the frame the lines show, then stepped
 *  frame by frame (60 Hz) to the round's end. Returns a row per frame. */
async function playWin(p, S, bookEvents, { turbo = 0, slamAt = null, frames = null, clip = null } = {}) {
	await R(p, ({ book, turbo }) => {
		const h = window.__reindeer;
		h.clock(1);
		h.turbo(turbo);
		h.roadSounds(true);
		h.soundTap?.(true);
		h.fixtures.queue(book, 1.5);
	}, { book: bookEvents, turbo });
	await p.click('.hudp button.spin');
	for (let i = 0; i < 800; i++) {
		if (await R(p, () => window.__reindeer.road().lanesStopped.every(Boolean) && window.__reindeer.road().atRest)) break;
		await sleep(10);
	}
	await R(p, () => window.__reindeer.clock(0));
	for (let i = 0; i < 1500; i++) {
		if (await R(p, (ms) => (window.__reindeer.roadSounds().some((e) => e.what === 'lines') ? true : (window.__reindeer.step(ms, 1), false)), FRAME)) break;
		await sleep(0);
	}
	const rows = [];
	let slammed = false;
	const first = await R(p, () => ({ frame: window.__reindeer.frame(), w: window.__reindeer.winLights() }));
	rows.push({ i: 0, frame: first.frame, ...first.w });
	for (let i = 1; i < 900; i++) {
		if (slamAt !== null && i === slamAt) {
			await R(p, () => window.__reindeer.clock(1));
			await p.click('.hudp button.spin').catch(() => {});
			slammed = true;
			await R(p, () => window.__reindeer.clock(0));
		}
		const s = await R(p, (ms) => {
			const h = window.__reindeer;
			h.step(ms, 1);
			// (the strip picks on its own drawn steps, 30 a second in real time: a draw of this moment first, so the pick read
			// is this frame's)
			h.scoreboardStep?.(0);
			const b = h.scoreboard?.();
			return { frame: h.frame(), w: h.winLights(), sb: b ? { kind: b.show?.kind ?? null, finalStr: b.show?.finalStr ?? null, item: b.stripPick?.item ?? null } : null };
		}, FRAME);
		rows.push({ i, frame: s.frame, ...s.w, sb: s.sb });
		if (frames) await p.screenshot({ path: join(frames, `f${String(i).padStart(4, '0')}.png`), ...(clip ? { clip } : {}) });
		if (s.w.ms === null && !s.w.visible && i > 5) break;
	}
	const log = await R(p, () => ({ road: window.__reindeer.roadSounds(), tap: window.__reindeer.soundTap?.() ?? null }));
	await R(p, () => window.__reindeer.clock(1));
	for (let i = 0; i < 200; i++) {
		if (await R(p, () => window.__reindeer.atRest() && window.__reindeer.hud.idle())) break;
		await sleep(150);
	}
	await sleep(300);
	const after = await R(p, () => window.__reindeer.winLights());
	await R(p, () => window.__reindeer.turbo(0));
	return { rows, log, after, slammed };
}

/** THE SCHEDULE from the tunables (Corey's timing page win_line_timing.html, its schedule(), written out here on its
 *  own, not read from the app): per line its start, string time, fully strung, coming down and gone, ms at `share`; a
 *  one line win's line stays up (its amount is the total, which comes as it is strung) */
const sched = (T, n, share) => {
	const X = T.lights;
	const r = X.gapRatio;
	const s = [];
	const d = [];
	const full = [];
	let t = 0;
	for (let i = 0; i < n; i++) {
		s[i] = t;
		d[i] = Math.max(Math.min(X.drawFloorMs, X.drawMs), X.drawMs * Math.pow(r, i));
		full[i] = s[i] + d[i];
		t += Math.max(X.gapFloorMs, X.staggerMs * Math.pow(r, i));
	}
	const last = Math.max(0, ...full);
	const off = [];
	const end = [];
	for (let i = 0; i < n; i++) {
		off[i] = n === 1 ? Infinity : X.downMode === 'end' ? last + X.stayLitMs : X.downMode === 'next' && i < n - 1 ? Math.max(full[i], s[i + 1]) : full[i] + X.stayLitMs;
		end[i] = off[i] + X.takeDownMs;
	}
	const k = (a) => a.map((v) => v * share);
	const E = k(end);
	return { starts: k(s), draws: k(d), full: k(full), off: k(off), end: E, linesEnd: n === 1 ? full[0] * share : Math.max(0, ...E), done: Math.max(0, ...k(full)) };
};
/** TREATMENT B'S SCHEDULE from the tunables (constants LINE_WIN slam; the mock's buildPlan, written out here on its own):
 *  the lines start and string as the lights' schedule, each stays lit perLineLitMs, the beats scale by lit / 1000; the
 *  upright phone keeps at most maxUp amounts up and ends the lines at today's line time; the strip's total as the last line
 *  starts down (one line: as its slam lands, or its pop), the win holdMs after it */
const slamSched = (T, n, share, phone, multi1) => {
	const X = T.lights;
	const Y = T.slam;
	const P = Y.phone;
	const prod = Y.beats.plain + Y.beats.side + Y.beats.both + Y.beats.squash;
	const s = [];
	const d = [];
	const lits = [];
	let fo = null;
	if (phone && P.on && n > 1) {
		const LE = sched(T, n, 1).linesEnd;
		const litMax = (LE - X.drawMs - ((n - 1) * P.downWindowMs) / P.maxUp) / (1 + (n - 1) / P.maxUp);
		const lit = Math.max(1, Math.min(Y.perLineLitMs, litMax));
		const g = (lit + P.downWindowMs) / P.maxUp;
		for (let i = 0; i < n; i++) {
			d[i] = i === 0 ? X.drawMs : X.drawFloorMs;
			s[i] = X.drawMs + i * g - d[i];
			lits[i] = lit;
		}
		fo = Math.max(0.2, Math.min(Y.perLineLitMs / 1000, (lit - P.readMs) / prod));
	} else {
		let t = 0;
		for (let i = 0; i < n; i++) {
			s[i] = t;
			d[i] = Math.max(Math.min(X.drawFloorMs, X.drawMs), X.drawMs * Math.pow(X.gapRatio, i));
			lits[i] = Y.perLineLitMs;
			t += Math.max(X.gapFloorMs, X.staggerMs * Math.pow(X.gapRatio, i));
		}
	}
	const starts = s.map((v) => v * share);
	const draws = d.map((v) => Math.max(1, v * share));
	const full = starts.map((v, i) => v + draws[i]);
	const off = full.map((v, i) => (n === 1 ? Infinity : v + lits[i] * share));
	const end = off.map((v) => v + X.takeDownMs * share);
	const f = lits.map((l) => (n === 1 ? share : (fo ?? l / 1000) * share));
	const totalAt = n === 1 ? full[0] + (multi1 ? prod * f[0] : X.amount.popMs * share) : Math.max(...off);
	const endAt = n === 1 ? full[0] + T.holdMs * share : totalAt + T.holdMs * share;
	return { starts, draws, full, off, end, f, totalAt, endAt, linesEnd: n === 1 ? full[0] : Math.max(...end), done: Math.max(0, ...full), prod, slam: true };
};
/** how many lines the schedule has up at win time t */
/** a planned time that falls on a 60 Hz frame within 0.1 ms (the phone rule's starts can): the readout rounds the win clock
 *  to 0.1 ms and the app's summed clock may sit a hair either side, so either of the two frames there is right */
const tie = (v) => Math.abs(v / FRAME - Math.round(v / FRAME)) * FRAME < 0.1;
const upAt = (P, t) => P.starts.filter((v, i) => t >= v && t < P.end[i]).length;
const r1 = (v) => (v === null || v === undefined ? '' : Math.round(v * 10) / 10);

/** the checks every played win gets */
function judge(tag, W, T, share, bookEvents, { expectAmounts, phone = false }) {
	const info = bookEvents.find((e) => e.type === 'winInfo');
	const n = info.wins.length;
	const live = W.rows.filter((r) => r.active);
	check(live.length > 10, `${tag}: the win ran ${live.length} frames`);
	const L = live[live.length - 1]?.lines ?? [];
	check(L.length === n, `${tag}: ${n} light line(s) drawn (${L.length})`);
	// (2026-11-17, treatment B: every line its own amount, a one line win's too; the slam's own schedule)
	const SL = !!T.slam?.on && !info.capped;
	if (SL) expectAmounts = true;
	const plan = SL ? slamSched(T, n, share, phone, n === 1 && info.wins[0].multiplier > 1) : sched(T, n, share);
	// the accelerating starts, in the book's order, each with its symbol
	L.forEach((l, k) => {
		check(Math.abs(l.start - plan.starts[k]) < 0.6, `${tag}: line ${k + 1} (${l.symbol}) starts at ${l.start} ms (want ${r1(plan.starts[k])}${k > 0 ? `, ${r1(plan.starts[k] - plan.starts[k - 1])} after the last` : ''})`);
		check(Math.abs(l.drawMs - plan.draws[k]) < 0.6, `${tag}: line ${k + 1} draws over ${l.drawMs} ms (want ${r1(plan.draws[k])})`);
		check(l.symbol === info.wins[k].symbol, `${tag}: line ${k + 1} pays ${info.wins[k].symbol} (${l.symbol})`);
		const want = (T.lights.palettes[l.symbol] ?? []).map((c) => c.toString(16).padStart(6, '0'));
		const tints = l.litTints;
		check(tints.length > 0 && tints.every((c, b) => c === want[b % want.length]), `${tag}: line ${k + 1} bulbs in the ${l.symbol} palette (${tints.join(' ')} vs ${want.join(' ')})`);
	});
	// draw fraction and bulbs over time, per line
	for (let k = 0; k < n; k++) {
		let mono = true;
		let litMono = true;
		let before = null;
		let startFrame = null;
		let doneFrame = null;
		for (const r of live) {
			const l = r.lines[k];
			if (!l) continue;
			if (before) {
				if (l.frac < before.frac - 1e-6) mono = false;
				if (l.frac < 1 && l.lit < before.lit) litMono = false;
			}
			if (startFrame === null && l.frac > 0) startFrame = r;
			// (complete: the frame its own amount pops, or with no amount its draw fraction reaching 1; the readout's
			// fraction is rounded, so a frame that lands within a rounding of the end, 499.99 of 500 ms, shows 1 while the
			// line is not quite done: the next frame is the one)
			if (doneFrame === null && l.frac >= 1 && (!l.amount || l.amount.shown || Math.abs(r.ms - (r.lines[k].start + r.lines[k].drawMs)) > 0.05)) doneFrame = r;
			before = l;
		}
		check(mono && litMono, `${tag}: line ${k + 1}: its wire only draws forward, its bulbs only light up while it draws`);
		const st = plan.starts[k];
		const draw = plan.draws[k];
		const prevOf = (r) => live[live.indexOf(r) - 1];
		check(!!startFrame && startFrame.ms >= st - 0.06 && (!prevOf(startFrame) || prevOf(startFrame).ms < st + 0.01 || k === 0 || (tie(st) && prevOf(startFrame).ms >= st - 0.1)), `${tag}: line ${k + 1} first drawn on the first frame at or after ${r1(st)} ms (frame at ${startFrame?.ms} ms)`);
		check(!!doneFrame && doneFrame.ms >= st + draw - 0.06 && (!prevOf(doneFrame) || prevOf(doneFrame).ms < st + draw + 0.05 || (tie(st + draw) && prevOf(doneFrame).ms >= st + draw - 0.1)), `${tag}: line ${k + 1} complete on the first frame at or after ${r1(st + draw)} ms (${doneFrame?.ms})`);
		// every bulb lit once its wire is complete (on a frame before it starts coming down; a line that comes down the
		// moment it is strung has none, and its most lit is checked instead)
		const nb = live[live.length - 1].lines[k].bulbs;
		const litFrames = live.filter((r) => r.lines[k] && r.lines[k].frac >= 1 && r.ms < plan.off[k]);
		const most = Math.max(0, ...live.filter((r) => r.lines[k]).map((r) => r.lines[k].lit));
		if (litFrames.length) check(litFrames[0].lines[k].lit === nb, `${tag}: line ${k + 1}: every bulb lit once its wire is complete (${litFrames[0].lines[k].lit} of ${nb})`);
		else check(most >= nb - 2, `${tag}: line ${k + 1} comes down as it is strung: at most ${most} of ${nb} bulbs lit at once`);
		// its own amount
		const amt = (r) => r.lines[k]?.amount;
		const firstShown = live.find((r) => amt(r)?.shown);
		if (expectAmounts) {
			check(!!firstShown && firstShown === doneFrame, `${tag}: line ${k + 1}'s own amount (${amt(live[live.length - 1])?.text}) appears on the frame its line completes (${firstShown?.ms} vs ${doneFrame?.ms})`);
		} else check(!firstShown, `${tag}: line ${k + 1}: no amount of its own (${n === 1 ? 'one line: its amount is the total' : 'capped'})`);
	}
	// the amounts never touch (treatment B: those up at the same time; an amount long gone does not block a place)
	if (expectAmounts) {
		const rects = L.map((l) => l.amount?.rect).filter(Boolean);
		const upTo = (k) => (SL ? plan.off[k] + (phone ? 0.3 : 1) * (plan.end[k] - plan.off[k]) : Infinity);
		let touching = 0;
		for (let a = 0; a < rects.length; a++)
			for (let b = a + 1; b < rects.length; b++) {
				const A = rects[a];
				const B = rects[b];
				const together = plan.full[a] < upTo(b) && plan.full[b] < upTo(a);
				if (together && A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) touching += 1;
			}
		check(rects.length === n && touching === 0, `${tag}: the ${rects.length} line amounts do not touch (${touching} pair(s) overlap)`, rects);
	}
	// each line comes down when the schedule says (downMode) and is gone after the take-down; never more lines up at
	// once than the schedule has up
	L.forEach((l, k) => {
		if (n === 1) check(l.offMs === null, `${tag}: a one line win's line stays up (off ${l.offMs})`);
		else check(Math.abs(l.offMs - plan.off[k]) < 0.6 && Math.abs(l.endMs - plan.end[k]) < 0.6, `${tag}: line ${k + 1} comes down at ${l.offMs} ms and is gone at ${l.endMs} (want ${r1(plan.off[k])} / ${r1(plan.end[k])}, ${T.lights.downMode})`);
		if (n > 1) {
			const lateUp = live.filter((r) => r.ms >= plan.end[k] - 0.01 && r.lines[k] && (r.lines[k].sprites > 0 || r.lines[k].amount?.shown));
			const downing = live.filter((r) => r.ms > plan.off[k] + 0.01 && r.ms < plan.end[k] - 0.01 && r.lines[k]);
			const shrinks = downing.every((r, i) => i === 0 || r.lines[k].lit <= downing[i - 1].lines[k].lit);
			check(lateUp.length === 0 && shrinks, `${tag}: line ${k + 1} is down: nothing of it (wire, bulbs, amount) from ${r1(plan.end[k])} ms (${lateUp.length} frames with some), its bulbs going out while it comes down`);
		}
	});
	let tooMany = 0;
	let peak = 0;
	for (const r of live) {
		const up = r.lines.filter((l) => l.sprites > 0 || l.amount?.shown).length;
		peak = Math.max(peak, up);
		if (up > upAt(plan, r.ms) && !plan.starts.some((v, i) => Math.abs(r.ms - v) < 0.1 || Math.abs(r.ms - plan.end[i]) < 0.1)) tooMany += 1;
	}
	check(tooMany === 0, `${tag}: never more lines up than the schedule has (${tooMany} frames over; peak ${peak} at once)`);
	// a winning symbol pulses only while a line through it is up
	const strayPulse = live.filter((r) => (r.pulsing ?? []).some((cell) => !(r.lineCells ?? []).some((cells, i) => cells.includes(cell) && r.ms >= plan.starts[i] - 0.05 && r.ms < plan.end[i] + 0.05) && !(T.lights.pulseWithTotal && r.ms >= r.totalAt)));
	check(strayPulse.length === 0, `${tag}: a symbol pulses only while a line through it is up (${strayPulse.length} frames with a stray pulse)`, strayPulse.slice(0, 2).map((r) => ({ ms: r.ms, pulsing: r.pulsing })));
	// the total: when the last light is down (treatment B: due on the strip as the last line starts to come down; never over
	// the board, never with a multiplier)
	const totalAt = live[0].totalAt;
	const wantTotal = SL ? plan.totalAt : plan.linesEnd;
	check(Math.abs(totalAt - wantTotal) < 0.6, `${tag}: the total comes at ${totalAt} ms (want ${r1(wantTotal)})`);
	const tFirst = live.find((r) => r.total?.shown);
	if (SL) check(!tFirst && !live.some((r) => r.mult), `${tag}: no total and no multiplier over the board (treatment B: the strip carries the total)`);
	else check(!!tFirst && tFirst.ms >= totalAt - 0.01 && live.filter((r) => r.ms < totalAt - 0.01).every((r) => !r.total?.shown), `${tag}: the total is not up before ${totalAt} ms, and is from ${tFirst?.ms}`);
	if (SL) check(Math.abs(live[0].slam.length - plan.endAt) < 0.6 || live[0].slam.length <= plan.endAt, `${tag}: the win lasts ${live[0].slam.length} ms (the slam's own ${r1(plan.endAt)}; today's ${r1(sched(T, n, share).linesEnd + T.holdMs * share)})`);
	// gone after
	const end = W.rows[W.rows.length - 1];
	check(!end.visible && !W.after.visible && W.after.sprites === 0 && !W.after.total?.shown, `${tag}: after the win nothing of it is on screen (lights ${W.after.sprites} sprites, visible ${W.after.visible}, total ${W.after.total?.shown})`, W.after);
	// the line show, once per line on the frame each line starts
	const marks = W.log.road.filter((e) => e.kind === 'moment' && e.what === 'lineShow');
	const plays = (W.log.tap?.log ?? []).filter((e) => e.what === 'play' && e.name === 'sfx_line_show');
	check(marks.length === n && plays.length === n, `${tag}: sfx_line_show once per line (${marks.length} moments, ${plays.length} plays for ${n} lines)`);
	marks.forEach((m, k) => {
		const pl = plays[k];
		check(!!pl && pl.frame === m.frame, `${tag}: line ${k + 1}'s line show on the frame it lights (play frame ${pl?.frame}, moment ${m.frame})`);
		if (k > 0) {
			const at = W.rows.find((r) => r.frame === m.frame);
			const prev = W.rows.find((r) => r.frame === m.frame - 1);
			check(!!at && at.ms >= plan.starts[k] - 0.06 && (!prev || prev.ms < plan.starts[k] || (tie(plan.starts[k]) && prev.ms >= plan.starts[k] - 0.1)), `${tag}: line ${k + 1}'s line show on the first frame at or after its start (${at?.ms} ms, the frame before ${prev?.ms})`);
		}
		// its own rate, rising per line (the Howl's rate for this play id)
		const S = T.lights.sound;
		const want = Math.min(S.rateMax, 1 + S.rateStep * k);
		const rt = pl ? (W.log.tap?.log ?? []).find((e) => e.what === 'rate' && e.id === pl.id) : null;
		check(!!rt && Math.abs(Number(rt.detail) - want) < 1e-6, `${tag}: line ${k + 1}'s line show at rate ${rt?.detail} (want ${want.toFixed(2)})`);
	});
}

/** TREATMENT B's own checks (constants LINE_WIN slam): each line's PLAIN amount first (the book's win / its multiplier), the
 *  multiplier beside it, the line's win only once the slam's beats are done, equal to the book's; a multiplier 1 line never
 *  shows a multiplier or a slam; the strip's total due at totalAt, the book's total, no multiplier on it; on the upright
 *  phone the top row's amounts inside the tunnel and their cap at phone.capPx CSS px */
async function slamJudge(p, tag, W, T, share, bookEvents, { phone = false, big = false } = {}) {
	const info = bookEvents.find((e) => e.type === 'winInfo');
	const n = info.wins.length;
	const live = W.rows.filter((r) => r.active);
	const plan = slamSched(T, n, share, phone, n === 1 && info.wins[0].multiplier > 1);
	const money = (str) => Number(String(str).replace(/[^0-9.]/g, ''));
	const book = await R(p, (a) => a.map((v) => window.__reindeer.bookAmount(v)), [info.totalWin, ...info.wins.map((w) => w.win), ...info.wins.map((w) => w.win / Math.max(1, w.multiplier))]);
	const bookTotal = book[0];
	for (let k = 0; k < n; k++) {
		const w = info.wins[k];
		const multi = w.multiplier > 1;
		const rows = live.filter((r) => r.lines[k]?.amount?.shown);
		const first = rows[0]?.lines[k].amount;
		const states = [...new Set(rows.map((r) => r.lines[k].amount.state))];
		const winRows = rows.filter((r) => r.lines[k].amount.state === 'win');
		const firstWin = winRows[0];
		const last = rows[rows.length - 1]?.lines[k].amount;
		const multRows = rows.filter((r) => r.lines[k].amount.multiplier);
		if (multi) {
			check(!!first && first.state === 'plain' && Math.abs(money(first.text) - book[1 + n + k]) < 0.005, `${tag}: line ${k + 1} (x${w.multiplier}) shows its PLAIN amount first (${first?.text}, the book's win / ${w.multiplier} = ${book[1 + n + k]})`, first);
			const due = plan.full[k] + plan.prod * plan.f[k];
			check(!!firstWin && firstWin.ms >= due - 0.05 && rows.filter((r) => r.ms < due - 0.05).every((r) => r.lines[k].amount.state !== 'win'), `${tag}: line ${k + 1}: its multiplier slams in and the line's win shows only once the beats are done (from ${firstWin?.ms} ms, due ${r1(due)}; states ${states.join(' > ')})`);
			check(multRows.length > 0 && multRows.every((r) => ['side', 'squash'].includes(r.lines[k].amount.state)), `${tag}: line ${k + 1}: its x${w.multiplier} shows beside the amount only before the slam (${multRows.length} frames)`);
		} else {
			check(states.join() === 'win' && multRows.length === 0, `${tag}: line ${k + 1} (x1): its amount alone, no multiplier and no slam (states ${states.join(' > ')})`);
		}
		check(!!last && last.state === 'win' && Math.abs(money(last.text) - book[1 + k]) < 0.005 && last.win === last.text, `${tag}: line ${k + 1}: the final amount is the book's line win (${last?.text} = ${book[1 + k]})`, last);
		check(first?.plain !== undefined && /^\$?[0-9.,]+$/.test(first.plain) && /^\$?[0-9.,]+$/.test(first.win), `${tag}: line ${k + 1}: its amounts carry no multiplier text ("${first?.plain}", "${first?.win}")`);
	}
	// the strip's total
	const sb = W.rows.filter((r) => r.sb);
	const smallRows = sb.filter((r) => r.sb.kind === 'small' && r.ms !== null);
	if (big) check(smallRows.length === 0, `${tag}: a big win: no win amount on the strip during the lines (the big count follows them)`);
	else {
		const s0 = smallRows[0];
		// (the arbiter's pick is read off the strip's drawn steps, 30 a second: the first sample within 100 ms that has drawn it)
		const picked = s0 ? smallRows.find((r) => r.ms <= s0.ms + 100 * share && r.sb.item === 'winAmount') : null;
		// (rows after the road's win has gone carry no win time: they are not "before" the total)
		check(!!s0 && s0.ms >= plan.totalAt - 0.05 && sb.filter((r) => r.ms !== null && r.ms < plan.totalAt - 0.05).every((r) => r.sb.kind !== 'small'), `${tag}: the strip's total comes as the last line starts down (from ${s0?.ms} ms, due ${r1(plan.totalAt)})`);
		check(!!s0 && Math.abs(money(s0.sb.finalStr) - bookTotal) < 0.005 && /^[0-9.,]+$/.test(s0.sb.finalStr) && !!picked, `${tag}: the strip's total is the book's (${s0?.sb.finalStr} = ${bookTotal}), plain, with no multiplier on it (the strip shows ${picked?.sb.item ?? s0?.sb.item})`, s0?.sb);
	}
	// the upright phone: the amounts at phone.capPx, the top row inside the tunnel
	if (phone) {
		const lay = await R(p, async () => {
			const A = (await import('/src/game/roadArtSpec.ts')).ROAD_ART;
			return { top: A.laneLines[0], k: window.__reindeer.boardLayout().css.pitch / 250 };
		});
		const L = live[live.length - 1].lines;
		const fs = L[0]?.amount?.fontSize ?? 0;
		const cap = T.slam.capRatio * fs * lay.k;
		check(Math.abs(cap - T.slam.phone.capPx) < 0.6 || (cap > T.slam.phone.capPx && fs === T.lights.amount.size), `${tag}: the amounts' digit cap is ${r1(cap)} CSS px (want ${T.slam.phone.capPx})`);
		const tops = L.map((l) => l.amount?.rect?.y).filter((v) => v !== undefined);
		check(tops.every((y) => y >= lay.top + T.slam.phone.topClearRoad - 1), `${tag}: every amount's top is inside the tunnel, under the top lane line (${tops.join(', ')} >= ${lay.top + T.slam.phone.topClearRoad})`, tops);
	}
}

const md = (tag, W) => {
	const n = Math.max(...W.rows.map((r) => r.lines?.length ?? 0));
	const head = ['frame', 'win ms', ...Array.from({ length: n }, (_, k) => `line ${k + 1} drawn`), ...Array.from({ length: n }, (_, k) => `line ${k + 1} bulbs lit`), ...Array.from({ length: n }, (_, k) => `line ${k + 1} amount`), 'lines up', 'total', 'lights sprites'];
	const out = [`# ${tag}: per frame (the board clock stepped at 60 Hz from the frame the lines show)`, '', `| ${head.join(' | ')} |`, `|${head.map(() => '---:').join('|')}|`];
	for (const r of W.rows) {
		const L = r.lines ?? [];
		out.push(`| ${r.i} | ${r.ms ?? '-'} | ${Array.from({ length: n }, (_, k) => L[k]?.frac ?? '-').join(' | ')} | ${Array.from({ length: n }, (_, k) => (L[k] ? `${L[k].lit}/${L[k].bulbs}` : '-')).join(' | ')} | ${Array.from({ length: n }, (_, k) => (L[k]?.amount ? (L[k].amount.shown ? `${L[k].amount.text} (${L[k].amount.alpha})` : '-') : 'none')).join(' | ')} | ${L.filter((l) => l.sprites > 0 || l.amount?.shown).length} | ${r.total?.shown ? `${r.total.text} x${r.total.scale}` : '-'} | ${r.sprites} |`);
	}
	return out.join('\n') + '\n';
};

/** THE AMOUNTS' CLEARANCE (PART=clear, 2026-11-18, Corey: "the Win Amount is partially hidden behind the small LED screen
 *  below the board" at about 2000x945): through every frame of a 12 line win and a bottom lane win, every line's amount and
 *  multiplier, as drawn (their bounds on the canvas, CSS px), stays clear of the LED strip (from its snow cap's top), the HUD
 *  (from its top), the logo sign (its visible art's box) and the road's frame (inside the tunnel mouths) */
async function clearance(browser) {
	for (const S of CLEAR_SIZES) {
		const { ctx, p, errs } = await boot(browser, S);
		const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
		const geo = await R(p, async () => {
			const A = (await import('/src/game/roadArtSpec.ts')).ROAD_ART;
			const sb = window.__reindeer.scoreboard();
			const pic = window.__reindeer.scene().picture;
			const logo = window.__reindeer.scene()?.logo?.css ?? null;
			return { strip: sb?.strip ?? null, hudTop: sb?.hudTop ?? null, logo, mouthL: pic.x + A.covers.left.mouth * pic.k, mouthR: pic.x + A.covers.right.mouth * pic.k };
		});
		const twelveBook = await R(p, async () => (await import('/src/fixtures/showcaseBooks.ts')).SHOWCASE_ROUNDS.find((r) => r.name === 'base_two_columns').events);
		for (const [name, bk] of [['twelve lines (base_two_columns)', twelveBook], ['bottom lane', BOOKS.bottom]]) {
			const W = await playWin(p, S, bk);
			const hits = [];
			let boxes = 0;
			for (const r of W.rows)
				for (const l of r.lines ?? []) {
					const b = l.amount?.box;
					if (!b || !l.amount.shown) continue;
					boxes += 1;
					const over = (o) => !!o && b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h;
					const strip = geo.strip ? { x: geo.strip.x, y: geo.strip.capTop, w: geo.strip.w, h: geo.strip.housingBottom - geo.strip.capTop } : null;
					const why = [];
					if (over(strip)) why.push('strip');
					if (geo.hudTop !== null && b.y + b.h > geo.hudTop) why.push('HUD');
					if (geo.logo && over({ x: geo.logo.x, y: geo.logo.y, w: geo.logo.width, h: geo.logo.height })) why.push('logo');
					if (b.x < geo.mouthL || b.x + b.w > geo.mouthR) why.push('frame');
					if (why.length) hits.push({ ms: r.ms, line: l.line, state: l.amount.state, why: why.join('+'), box: b });
				}
			check(boxes > 20 && hits.length === 0, `${tag} ${name}: every line's amount and multiplier stays clear of the LED strip, the HUD, the logo sign and the frame through the whole slam (${boxes} drawn boxes, ${hits.length} touching)`, { hits: hits.slice(0, 4), strip: geo.strip, hudTop: geo.hudTop });
		}
		check(errs.length === 0, `${tag}: no page errors`, errs);
		await ctx.close();
	}
}

const browser = await chromium.launch({ args: ['--mute-audio'] });
const result = {};
if (part('clear')) await clearance(browser);
const crops = {};
try {
	for (const S of ['a', 'x', 'b', 'c'].some(part) ? SIZES : []) {
		const { ctx, p, errs } = await boot(browser, S);
		const T = await R(p, () => JSON.parse(JSON.stringify(window.__reindeer.tune.lineWin)));
		console.log(`-- ${S.name} ${S.vp.width}x${S.vp.height}`);
		const clip = await boardClip(p);
		const dir = (name) => {
			if (!OUT || !VIDEO) return null;
			const d = join(OUT, `frames_${name}_${S.name}`);
			mkdirSync(d, { recursive: true });
			return d;
		};
		let one = null;
		let three = null;
		let cost = null;
		if (part('a')) {
		// ONE LINE, normal
		one = await playWin(p, S, BOOKS.one, { frames: dir('one'), clip });
		judge(`${S.name} one line`, one, T, 1, BOOKS.one, { expectAmounts: false, phone: S.phone });
		if (T.slam?.on) await slamJudge(p, `${S.name} one line`, one, T, 1, BOOKS.one, { phone: S.phone });
		// THREE LINES: normal, turbo 1, turbo 2, a slam stop during the stagger
		three = await playWin(p, S, BOOKS.three, { frames: dir('three'), clip });
		judge(`${S.name} three lines`, three, T, 1, BOOKS.three, { expectAmounts: true, phone: S.phone });
		// TREATMENT B: three lines, two through multipliers, one plain; a one line win with a 5x column (base_one_column)
		if (T.slam?.on) {
			await slamJudge(p, `${S.name} three lines`, three, T, 1, BOOKS.three, { phone: S.phone });
			const mixed = await playWin(p, S, BOOKS.mixed, { frames: dir('mixed'), clip });
			judge(`${S.name} mixed x5 x1 x3`, mixed, T, 1, BOOKS.mixed, { expectAmounts: true, phone: S.phone });
			await slamJudge(p, `${S.name} mixed x5 x1 x3`, mixed, T, 1, BOOKS.mixed, { phone: S.phone });
		}
		if (OUT) writeFileSync(join(OUT, `table_three_${S.name}.md`), md(`${S.name} three lines, normal speed`, three));
		if (OUT) writeFileSync(join(OUT, `table_one_${S.name}.md`), md(`${S.name} one line, normal speed`, one));
		}
		// (x: treatment B's one line win through a 5x column, and its turbo levels)
		if (part('x') && T.slam?.on) {
			const oneCol = await R(p, async () => (await import('/src/fixtures/showcaseBooks.ts')).SHOWCASE_ROUNDS.find((r) => r.name === 'base_one_column').events);
			const oc = await playWin(p, S, oneCol, { frames: dir('one_column'), clip });
			judge(`${S.name} base_one_column (one line x5)`, oc, T, 1, oneCol, { expectAmounts: true, phone: S.phone });
			await slamJudge(p, `${S.name} base_one_column (one line x5)`, oc, T, 1, oneCol, { phone: S.phone });
			for (const turbo of [1, 2]) {
				const mt = await playWin(p, S, BOOKS.mixed, { turbo });
				judge(`${S.name} mixed turbo ${turbo}`, mt, T, T.holdShare[turbo], BOOKS.mixed, { expectAmounts: true, phone: S.phone });
				await slamJudge(p, `${S.name} mixed turbo ${turbo}`, mt, T, T.holdShare[turbo], BOOKS.mixed, { phone: S.phone });
			}
		}
		if (part('b')) {
		for (const turbo of [1, 2]) {
			const W = await playWin(p, S, BOOKS.three, { turbo, frames: turbo === 2 ? dir('three_turbo2') : null, clip });
			judge(`${S.name} three lines turbo ${turbo}`, W, T, T.holdShare[turbo], BOOKS.three, { expectAmounts: true, phone: S.phone });
			if (OUT && turbo === 2) writeFileSync(join(OUT, `table_three_turbo2_${S.name}.md`), md(`${S.name} three lines, turbo 2`, W));
		}
		// a slam stop as the second line starts: the win runs on hurried, and nothing is left when it goes
		const slamAt = Math.ceil((T.lights.staggerMs + 30) / FRAME);
		const slam = await playWin(p, S, BOOKS.three, { slamAt, frames: dir('three_slam'), clip });
		const hurried = slam.rows.filter((r) => r.active && r.i > slamAt);
		const realMs = hurried.length * FRAME;
		check(slam.slammed && hurried.length > 0, `${S.name} slam: pressed at frame ${slamAt} of the win (${r1(slamAt * FRAME)} ms); the win's clock then ran ${r1(hurried.length ? hurried[hurried.length - 1].ms - hurried[0].ms : 0)} ms in ${r1(realMs)} real ms`);
		const sEnd = slam.rows[slam.rows.length - 1];
		check(!sEnd.visible && !slam.after.visible && slam.after.sprites === 0 && !slam.after.total?.shown, `${S.name} slam: nothing of the win left on screen after it`, slam.after);
		if (OUT) writeFileSync(join(OUT, `table_three_slam_${S.name}.md`), md(`${S.name} three lines, slam stop at frame ${slamAt}`, slam));
		}
		if (part('c')) {

		// TWELVE LINES: the fixtures' longest line win (base_two_columns, a real book: two Wild columns, 12 lines), normal
		// speed, then a slam as its fourth line starts
		const twelveBook = await R(p, async () => (await import('/src/fixtures/showcaseBooks.ts')).SHOWCASE_ROUNDS.find((r) => r.name === 'base_two_columns').events);
		const twelveN = twelveBook.find((e) => e.type === 'winInfo').wins.length;
		check(twelveN === 12, `${S.name}: base_two_columns pays ${twelveN} lines`);
		const twelve = await playWin(p, S, twelveBook, { frames: dir('twelve'), clip });
		judge(`${S.name} twelve lines`, twelve, T, 1, twelveBook, { expectAmounts: true, phone: S.phone });
		if (T.slam?.on) await slamJudge(p, `${S.name} twelve lines`, twelve, T, 1, twelveBook, { phone: S.phone, big: true });
		if (OUT) writeFileSync(join(OUT, `table_twelve_${S.name}.md`), md(`${S.name} twelve lines (base_two_columns), normal speed`, twelve));
		const slam12At = Math.ceil((sched(T, 4, 1).starts[3] + 10) / FRAME);
		const slam12 = await playWin(p, S, twelveBook, { slamAt: slam12At, clip });
		const e12 = slam12.rows[slam12.rows.length - 1];
		check(slam12.slammed && !e12.visible && !slam12.after.visible && slam12.after.sprites === 0 && !slam12.after.total?.shown, `${S.name} twelve lines slam at frame ${slam12At}: nothing of the win left on screen after it`, slam12.after);
		// THE LINE SHOW IN REAL TIME at turbo 2 (the clock not stepped): one voice at a time
		{
			await R(p, ({ book }) => {
				const h = window.__reindeer;
				h.clock(1);
				h.turbo(2);
				h.roadSounds(true);
				h.soundTap?.(true);
				h.fixtures.queue(book, 1.5);
			}, { book: twelveBook });
			await p.click('.hudp button.spin');
			await sleep(1500);
			for (let i = 0; i < 120; i++) {
				if (await R(p, () => window.__reindeer.atRest() && window.__reindeer.hud.idle() && window.__reindeer.roadSounds().some((e) => e.what === 'lines'))) break;
				await sleep(150);
			}
			const tap = (await R(p, () => window.__reindeer.soundTap?.()))?.log ?? [];
			await R(p, () => window.__reindeer.turbo(0));
			const shows = tap.filter((e) => e.what === 'play' && e.name === 'sfx_line_show');
			const S2 = T.lights.sound;
			let overlaps = 0;
			let stops = 0;
			const gaps = [];
			for (let k = 1; k < shows.length; k++) {
				const a = shows[k - 1];
				const b = shows[k];
				const rate = Math.min(S2.rateMax, 1 + S2.rateStep * (k - 1));
				const ends = a.t + S2.lengthMs / rate;
				const cut = tap.find((e) => (e.what === 'stop' || e.what === 'end') && e.id === a.id && e.t <= b.t + 1);
				if (cut?.what === 'stop') stops += 1;
				if (!cut && ends > b.t + 2) overlaps += 1;
				gaps.push(Math.round(b.t - a.t));
			}
			check(shows.length === 12 && overlaps === 0, `${S.name} twelve lines turbo 2 in real time: ${shows.length} line shows, none over the one before (${stops} stopped as the next started; real gaps ${gaps.join(' ')} ms)`);
		}

		// THE COST: a three line win frozen in its chase (every line drawn, the amounts up), lights on and off. Every
		// line up at once (downMode 'end' for this one win, put back after): the most a three line win can draw
		await R(p, ({ book }) => {
			const h = window.__reindeer;
			h.__mode = h.tune.lineWin.lights.downMode;
			h.tune.lineWin.lights.downMode = 'end';
			h.roadSounds(true);
			h.fixtures.queue(book, 1.5);
		}, { book: BOOKS.three });
		await p.click('.hudp button.spin');
		for (let i = 0; i < 800; i++) {
			if (await R(p, () => window.__reindeer.road().lanesStopped.every(Boolean) && window.__reindeer.road().atRest)) break;
			await sleep(10);
		}
		await R(p, () => window.__reindeer.clock(0));
		for (let i = 0; i < 300; i++) {
			if (await R(p, (ms) => (window.__reindeer.roadSounds().some((e) => e.what === 'lines') ? true : (window.__reindeer.step(ms, 1), false)), FRAME)) break;
			await sleep(0);
		}
		// (with the slam on, its own schedule: the upright phone's rule strings the lines later than the lights' schedule)
		const costPlan = T.slam?.on ? slamSched(T, 3, 1, S.phone, false) : sched(T, 3, 1);
		await R(p, (n) => window.__reindeer.step(1000 / 60, n), Math.ceil((costPlan.done + 60) / FRAME));
		const read = () =>
			R(p, async () => {
				const b = { ...window.__dc };
				await new Promise((r) => setTimeout(r, 900));
				return { callsPerFrame: Math.round(((window.__dc.calls - b.calls) / Math.max(1, window.__dc.frames - b.frames)) * 100) / 100, sprites: window.__reindeer.roadSprites().sprites, w: window.__reindeer.winLights() };
			});
		await sleep(200);
		const on = await read();
		await R(p, () => window.__reindeer.winLightsShown(false));
		const off = await read();
		await R(p, () => window.__reindeer.winLightsShown(true));
		await R(p, () => (window.__reindeer.tune.lineWin.lights.downMode = window.__reindeer.__mode));
		cost = { callsOn: on.callsPerFrame, callsOff: off.callsPerFrame, roadSpritesOn: on.sprites, roadSpritesOff: off.sprites, lightsSprites: on.w.sprites, perLine: on.w.lines.map((l) => ({ symbol: l.symbol, bulbs: l.bulbs, sprites: l.sprites })) };
		console.log(`  ${S.name} cost (three lines, frozen in the chase): draw calls per frame ${cost.callsOn} with the lights, ${cost.callsOff} without; road sprites ${cost.roadSpritesOn} with, ${cost.roadSpritesOff} without (the lights: ${cost.lightsSprites})`);
		check(on.w.lines.length === 3 && on.w.lines.every((l) => l.frac >= 1), `${S.name}: frozen with all three lines drawn for the cost`, on.w.lines.map((l) => l.frac));
		await R(p, () => window.__reindeer.clock(1));
		for (let i = 0; i < 80; i++) {
			if (await R(p, () => window.__reindeer.atRest() && window.__reindeer.hud.idle())) break;
			await sleep(150);
		}
		}
		check(errs.length === 0, `${S.name}: no page errors, no console errors`, errs);
		result[S.name] = { cost, one: one?.rows.length ?? null, three: three?.rows.length ?? null };
		await ctx.close();
		if (!part('c')) continue;

		// THE PALETTES: each board frozen in its chase, stills at 3 device px per CSS px (?rescap=3)
		const still = await boot(browser, { ...S, dpr: 3 }, '&rescap=3');
		for (const name of ['palA', 'palB', 'palC']) {
			const bk = BOOKS[name];
			await R(still.p, ({ book }) => {
				const h = window.__reindeer;
				// every line of the board up at once for its still (downMode 'end'; this page only makes stills)
				h.tune.lineWin.lights.downMode = 'end';
				h.clock(1);
				h.roadSounds(true);
				h.fixtures.queue(book, 1.5);
			}, { book: bk });
			await still.p.click('.hudp button.spin');
			for (let i = 0; i < 800; i++) {
				if (await R(still.p, () => window.__reindeer.road().lanesStopped.every(Boolean) && window.__reindeer.road().atRest)) break;
				await sleep(10);
			}
			await R(still.p, () => window.__reindeer.clock(0));
			for (let i = 0; i < 300; i++) {
				if (await R(still.p, (ms) => (window.__reindeer.roadSounds().some((e) => e.what === 'lines') ? true : (window.__reindeer.step(ms, 1), false)), FRAME)) break;
				await sleep(0);
			}
			const nLines = bk.find((e) => e.type === 'winInfo').wins.length;
			// all drawn, during the drawing's last moment (every bulb fully lit, before the chase dims two in three)
			await R(still.p, (n) => window.__reindeer.step(1000 / 60, n), Math.floor((sched(T, nLines, 1).done - 30) / FRAME));
			const w = await R(still.p, () => window.__reindeer.winLights());
			const info = bk.find((e) => e.type === 'winInfo');
			w.lines.forEach((l, k) => {
				const want = (T.palettes ?? T.lights.palettes)[info.wins[k].symbol].map((c) => c.toString(16).padStart(6, '0'));
				check(l.symbol === info.wins[k].symbol && l.litTints.every((c, b) => c === want[b % want.length]), `${S.name} palette ${info.wins[k].symbol}: bulbs ${l.litTints.join(' ')}`);
			});
			if (OUT) {
				await sleep(150);
				const c = await boardClip(still.p);
				await still.p.screenshot({ path: join(OUT, `palette_${name}_${S.name}.png`), clip: c });
				crops[`${name}_${S.name}`] = { clip: c, dpr: 3, lines: w.lines.map((l) => ({ symbol: l.symbol, palette: l.palette })) };
			}
			await R(still.p, () => window.__reindeer.clock(1));
			for (let i = 0; i < 80; i++) {
				if (await R(still.p, () => window.__reindeer.atRest() && window.__reindeer.hud.idle())) break;
				await sleep(150);
			}
		}
		check(still.errs.length === 0, `${S.name} stills: no page errors`, still.errs);
		await still.ctx.close();
	}
} finally {
	await browser.close();
}
if (OUT) writeFileSync(join(OUT, 'crops.json'), JSON.stringify(crops, null, 1));
console.log(`\n${pass} passed, ${fail} failed${fails.length ? '\n  ' + fails.join('\n  ') : ''}`);
if (OUT) writeFileSync(join(OUT, 'win_lines_probe.json'), JSON.stringify({ pass, fail, fails, ...result }, null, 1));
process.exit(fail ? 1 : 0);
