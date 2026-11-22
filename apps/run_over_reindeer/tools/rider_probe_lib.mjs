// @ts-nocheck: a node probe helper, not app code (svelte-check picks up .mjs files)
// THE RIDERS' PROBES' SHARED PARTS (tools/wagon_tree_probe.mjs, tools/seated_probe.mjs): boot the running dev server in one
// muted Chromium, count WebGL draw calls, play a posed book with the board clock frozen and stepped one 60 Hz frame at a
// time (exact timings whatever the machine is doing), and the pass / fail tally. Never starts a dev server.
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');

export const APP = process.env.APP || 'http://localhost:3014';
export const FRAME = 1000 / 60;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const SIZES_ALL = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, dpr: 2, phone: false },
	{ name: 'portrait', vp: { width: 390, height: 844 }, dpr: 3, phone: true },
	{ name: 'short', vp: { width: 390, height: 620 }, dpr: 3, phone: true },
];

export const tally = () => {
	const t = { pass: 0, fail: 0, fails: [] };
	t.check = (ok, msg, detail) => {
		if (ok) t.pass += 1;
		else {
			t.fail += 1;
			t.fails.push(msg);
		}
		console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 900)) : ''}`);
	};
	return t;
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

export const R = (p, fn, arg) => p.evaluate(fn, arg);

export async function boot(browser, S, tag) {
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.dpr, isMobile: S.phone, hasTouch: S.phone });
	await ctx.addInitScript(DRAW_COUNTER);
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=${tag}${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 160; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && !document.querySelector('.landing'))).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	await sleep(500);
	return { ctx, p, errs };
}

/** draw calls per frame over a moment of real frames (the board clock frozen: the same picture every frame) */
export const drawCalls = (p) =>
	R(p, async () => {
		const b = { ...window.__dc };
		await new Promise((r) => setTimeout(r, 700));
		return Math.round(((window.__dc.calls - b.calls) / Math.max(1, window.__dc.frames - b.frames)) * 100) / 100;
	});

/** press Spin on a queued book with the board clock frozen, then step it one 60 Hz frame at a time until the game is idle
 *  again; `read` (a page function) is sampled after every frame; `frames` (a dir) takes a screenshot of every frame;
 *  `onFrame(i, sample)` may act between frames (a slam press); `stepMs` (a slow motion capture: FRAME / 4). Returns the
 *  samples. */
export async function stepRound(p, { book, turbo = 0, read, frames = null, clip = null, maxFrames = 1600, onFrame = null, setup = null, stepMs = FRAME }) {
	// THE PRESS MUST BE TAKEN (2026-11-20, seated_probe's Grandma strike round "0 frames"): since 2da57cb (2026-11-18) a
	// manual base round with a win stays open after its board is at rest until the LED count has landed (game/utils.ts
	// ledCountDone), and a Spin press in that window is the round's STOP, not a new round. The round after a winning one
	// then never started, and its frames sampled the board before. Wait (real time, the clock running) until the game
	// takes a press (__reindeer.pressReady: the round machine idle, no round live).
	// THE ROUND'S TAIL (2026-11-22, ui/controls.svelte.ts): since then the key reads Spin from the board's rest and a press
	// there is kept until the round machine is idle, so pressReady comes before the press starts its round at once. This
	// steps the new round from its press frame, so it waits for the machine itself (__reindeer.roundIdle).
	for (let i = 0; i < 80; i++) {
		const ready = await R(p, () => (window.__reindeer.roundIdle ? window.__reindeer.roundIdle() : window.__reindeer.pressReady ? window.__reindeer.pressReady() : true));
		if (ready) break;
		await sleep(100);
	}
	await R(p, ({ book, turbo }) => {
		const h = window.__reindeer;
		h.turbo(turbo);
		// (latency is a function: assigning 0 to it left the fixtures' 120 real ms wait on, which a fast host steps through
		// as many board frames and a slow one as none, so the book came at a host dependent board time)
		if (typeof h.fixtures.latency === 'function') h.fixtures.latency(0);
		h.fixtures.queue(book, 0);
		h.clock(0);
	}, { book, turbo });
	if (setup) await setup();
	await p.click('.hudp button.spin');
	const rows = [];
	let idleFor = 0;
	for (let i = 0; i < maxFrames; i++) {
		const s = await R(p, ({ ms, read }) => {
			const h = window.__reindeer;
			h.step(ms, 1);
			// eslint-disable-next-line no-new-func
			return { idle: h.atRest(), sample: new Function('h', `return (${read})(h)`)(h) };
		}, { ms: stepMs, read: read.toString() });
		rows.push({ i, ...s });
		if (frames) await p.screenshot({ path: join(frames, `f${String(i).padStart(4, '0')}.png`), ...(clip ? { clip } : {}) });
		if (onFrame) await onFrame(i, s);
		await sleep(2);
		idleFor = s.idle ? idleFor + 1 : 0;
		if (idleFor > 20 * (FRAME / stepMs) && i > 40) break;
	}
	await R(p, () => window.__reindeer.clock(1));
	for (let i = 0; i < 60; i++) {
		if (await R(p, () => window.__reindeer.atRest())) break;
		await sleep(150);
	}
	await R(p, () => window.__reindeer.turbo(0));
	return rows;
}

/** the CSS px box of a cell's symbol (road px box around its anchor: dx0..dx1 across, up above the sit line, down below) */
export const cellBox = (p, cell, { left = 130, right = 130, up = 175, down = 14 } = {}) =>
	R(p, ({ cell, left, right, up, down }) => {
		const L = window.__reindeer.boardLayout();
		const k = L.css.pitch / 250;
		const lines = [167, 338, 509, 680, 851];
		const reel = Math.floor(cell / 4);
		const row = cell % 4;
		const cx = 142 + (reel + 0.5) * 250;
		const sit = lines[row + 1] - 10;
		const x0 = L.css.x + (cx - left - 142) * k;
		const y0 = L.css.y + (sit - up - 167) * k;
		return { x: x0, y: y0, width: (left + right) * k, height: (up + down) * k };
	}, { cell, left, right, up, down });
