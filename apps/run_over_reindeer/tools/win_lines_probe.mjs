// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// THE WIN LINES PROBE (the Christmas lights, Corey 2026-11-15; constants LINE_WIN lights, game/road/winLights.ts). Posed
// books handed to the fixtures through the dev hook (presentation only, no math): a one line win, a three line win (three
// different paying symbols), and three palette boards that between them pay on every symbol (H1 to H4, a line of Wilds
// only, the five signs). At desktop 1440x900 and phone 390x844, the board clock frozen once the traffic has stopped and
// stepped one 60 Hz frame at a time through the whole win:
//   - the lines start staggerMs apart (x holdShare at turbo 1 and 2), in the book's order, each drawn in over drawMs
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
if (OUT) mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FRAME = 1000 / 60;

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
	for (let i = 0; i < 300; i++) {
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
			return { frame: h.frame(), w: h.winLights() };
		}, FRAME);
		rows.push({ i, frame: s.frame, ...s.w });
		if (frames) await p.screenshot({ path: join(frames, `f${String(i).padStart(4, '0')}.png`), ...(clip ? { clip } : {}) });
		if (s.w.ms === null && !s.w.visible && i > 5) break;
	}
	const log = await R(p, () => ({ road: window.__reindeer.roadSounds(), tap: window.__reindeer.soundTap?.() ?? null }));
	await R(p, () => window.__reindeer.clock(1));
	for (let i = 0; i < 80; i++) {
		if (await R(p, () => window.__reindeer.atRest() && window.__reindeer.hud.idle())) break;
		await sleep(150);
	}
	await sleep(300);
	const after = await R(p, () => window.__reindeer.winLights());
	await R(p, () => window.__reindeer.turbo(0));
	return { rows, log, after, slammed };
}

const r1 = (v) => (v === null || v === undefined ? '' : Math.round(v * 10) / 10);

/** the checks every played win gets */
function judge(tag, W, T, share, bookEvents, { expectAmounts }) {
	const info = bookEvents.find((e) => e.type === 'winInfo');
	const n = info.wins.length;
	const live = W.rows.filter((r) => r.active);
	check(live.length > 10, `${tag}: the win ran ${live.length} frames`);
	const L = live[live.length - 1]?.lines ?? [];
	check(L.length === n, `${tag}: ${n} light line(s) drawn (${L.length})`);
	const stagger = T.lights.staggerMs * share;
	const draw = T.lights.drawMs * share;
	// starts staggerMs apart, in the book's order, each with its symbol
	L.forEach((l, k) => {
		check(Math.abs(l.start - k * stagger) < 0.6, `${tag}: line ${k + 1} (${l.symbol}) starts at ${l.start} ms (want ${r1(k * stagger)}: ${T.lights.staggerMs} x ${share} apart)`);
		check(Math.abs(l.drawMs - draw) < 0.6, `${tag}: line ${k + 1} draws over ${l.drawMs} ms (want ${r1(draw)})`);
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
			if (doneFrame === null && l.frac >= 1) doneFrame = r;
			before = l;
		}
		check(mono && litMono, `${tag}: line ${k + 1}: its wire only draws forward, its bulbs only light up while it draws`);
		const st = k * stagger;
		const prevOf = (r) => live[live.indexOf(r) - 1];
		check(!!startFrame && startFrame.ms >= st - 0.01 && (!prevOf(startFrame) || prevOf(startFrame).ms < st + 0.01 || k === 0), `${tag}: line ${k + 1} first drawn on the first frame at or after ${r1(st)} ms (frame at ${startFrame?.ms} ms)`);
		check(!!doneFrame && doneFrame.ms >= st + draw - 0.01 && (!prevOf(doneFrame) || prevOf(doneFrame).ms < st + draw), `${tag}: line ${k + 1} complete on the first frame at or after ${r1(st + draw)} ms (${doneFrame?.ms})`);
		const lastLit = live.filter((r) => r.lines[k] && r.lines[k].frac >= 1).map((r) => r.lines[k].lit)[0];
		check(lastLit === live[live.length - 1].lines[k].bulbs, `${tag}: line ${k + 1}: every bulb lit once its wire is complete (${lastLit} of ${live[live.length - 1].lines[k].bulbs})`);
		// its own amount
		const amt = (r) => r.lines[k]?.amount;
		const firstShown = live.find((r) => amt(r)?.shown);
		if (expectAmounts) {
			check(!!firstShown && firstShown === doneFrame, `${tag}: line ${k + 1}'s own amount (${amt(live[live.length - 1])?.text}) appears on the frame its line completes (${firstShown?.ms} vs ${doneFrame?.ms})`);
		} else check(!firstShown, `${tag}: line ${k + 1}: no amount of its own (${n === 1 ? 'one line: its amount is the total' : 'capped'})`);
	}
	// the amounts never touch
	if (expectAmounts) {
		const rects = L.map((l) => l.amount?.rect).filter(Boolean);
		let touching = 0;
		for (let a = 0; a < rects.length; a++)
			for (let b = a + 1; b < rects.length; b++) {
				const A = rects[a];
				const B = rects[b];
				if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) touching += 1;
			}
		check(rects.length === n && touching === 0, `${tag}: the ${rects.length} line amounts do not touch (${touching} pair(s) overlap)`, rects);
	}
	// the total: at totalAt, after the last line (and the amounts' hold)
	const totalAt = live[0].totalAt;
	const wantTotal = (n - 1) * stagger + draw + (n > 1 ? T.lights.amount.holdMs * share : 0);
	check(Math.abs(totalAt - wantTotal) < 0.6, `${tag}: the total comes at ${totalAt} ms (want ${r1(wantTotal)})`);
	const tFirst = live.find((r) => r.total?.shown);
	check(!!tFirst && tFirst.ms >= totalAt - 0.01 && live.filter((r) => r.ms < totalAt - 0.01).every((r) => !r.total?.shown), `${tag}: the total is not up before ${totalAt} ms, and is from ${tFirst?.ms}`);
	if (expectAmounts) {
		const late = live.filter((r) => r.ms > totalAt + T.lights.amount.fadeMs * share + 20 && r.lines.some((l) => l.amount?.shown));
		check(late.length === 0, `${tag}: the line amounts have faded ${r1(T.lights.amount.fadeMs * share)} ms after the total`);
	}
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
			check(!!at && at.ms >= k * stagger - 0.01 && (!prev || prev.ms < k * stagger), `${tag}: line ${k + 1}'s line show on the first frame at or after its start (${at?.ms} ms, the frame before ${prev?.ms})`);
		}
	});
}

const md = (tag, W) => {
	const n = Math.max(...W.rows.map((r) => r.lines?.length ?? 0));
	const head = ['frame', 'win ms', ...Array.from({ length: n }, (_, k) => `line ${k + 1} drawn`), ...Array.from({ length: n }, (_, k) => `line ${k + 1} bulbs lit`), ...Array.from({ length: n }, (_, k) => `line ${k + 1} amount`), 'total', 'lights sprites'];
	const out = [`# ${tag}: per frame (the board clock stepped at 60 Hz from the frame the lines show)`, '', `| ${head.join(' | ')} |`, `|${head.map(() => '---:').join('|')}|`];
	for (const r of W.rows) {
		const L = r.lines ?? [];
		out.push(`| ${r.i} | ${r.ms ?? '-'} | ${Array.from({ length: n }, (_, k) => L[k]?.frac ?? '-').join(' | ')} | ${Array.from({ length: n }, (_, k) => (L[k] ? `${L[k].lit}/${L[k].bulbs}` : '-')).join(' | ')} | ${Array.from({ length: n }, (_, k) => (L[k]?.amount ? (L[k].amount.shown ? `${L[k].amount.text} (${L[k].amount.alpha})` : '-') : 'none')).join(' | ')} | ${r.total?.shown ? `${r.total.text} x${r.total.scale}` : '-'} | ${r.sprites} |`);
	}
	return out.join('\n') + '\n';
};

const browser = await chromium.launch({ args: ['--mute-audio'] });
const result = {};
const crops = {};
try {
	for (const S of SIZES) {
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
		// ONE LINE, normal
		const one = await playWin(p, S, BOOKS.one, { frames: dir('one'), clip });
		judge(`${S.name} one line`, one, T, 1, BOOKS.one, { expectAmounts: false });
		// THREE LINES: normal, turbo 1, turbo 2, a slam stop during the stagger
		const three = await playWin(p, S, BOOKS.three, { frames: dir('three'), clip });
		judge(`${S.name} three lines`, three, T, 1, BOOKS.three, { expectAmounts: true });
		if (OUT) writeFileSync(join(OUT, `table_three_${S.name}.md`), md(`${S.name} three lines, normal speed`, three));
		if (OUT) writeFileSync(join(OUT, `table_one_${S.name}.md`), md(`${S.name} one line, normal speed`, one));
		for (const turbo of [1, 2]) {
			const W = await playWin(p, S, BOOKS.three, { turbo, frames: turbo === 2 ? dir('three_turbo2') : null, clip });
			judge(`${S.name} three lines turbo ${turbo}`, W, T, T.holdShare[turbo], BOOKS.three, { expectAmounts: true });
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

		// THE COST: a three line win frozen in its chase (every line drawn, the amounts up), lights on and off
		await R(p, ({ book }) => {
			const h = window.__reindeer;
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
		await R(p, (n) => window.__reindeer.step(1000 / 60, n), Math.ceil((2 * T.lights.staggerMs + T.lights.drawMs + 60) / FRAME));
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
		const cost = { callsOn: on.callsPerFrame, callsOff: off.callsPerFrame, roadSpritesOn: on.sprites, roadSpritesOff: off.sprites, lightsSprites: on.w.sprites, perLine: on.w.lines.map((l) => ({ symbol: l.symbol, bulbs: l.bulbs, sprites: l.sprites })) };
		console.log(`  ${S.name} cost (three lines, frozen in the chase): draw calls per frame ${cost.callsOn} with the lights, ${cost.callsOff} without; road sprites ${cost.roadSpritesOn} with, ${cost.roadSpritesOff} without (the lights: ${cost.lightsSprites})`);
		check(on.w.lines.length === 3 && on.w.lines.every((l) => l.frac >= 1), `${S.name}: frozen with all three lines drawn for the cost`, on.w.lines.map((l) => l.frac));
		await R(p, () => window.__reindeer.clock(1));
		for (let i = 0; i < 80; i++) {
			if (await R(p, () => window.__reindeer.atRest() && window.__reindeer.hud.idle())) break;
			await sleep(150);
		}
		check(errs.length === 0, `${S.name}: no page errors, no console errors`, errs);
		result[S.name] = { cost, one: one.rows.length, three: three.rows.length };
		await ctx.close();

		// THE PALETTES: each board frozen in its chase, stills at 3 device px per CSS px (?rescap=3)
		const still = await boot(browser, { ...S, dpr: 3 }, '&rescap=3');
		for (const name of ['palA', 'palB', 'palC']) {
			const bk = BOOKS[name];
			await R(still.p, ({ book }) => {
				const h = window.__reindeer;
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
			await R(still.p, (n) => window.__reindeer.step(1000 / 60, n), Math.floor(((nLines - 1) * T.lights.staggerMs + T.lights.drawMs - 30) / FRAME));
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
