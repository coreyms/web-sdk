// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,game/road/roadSounds.ts,game/road/shadows.ts,game/scene/logoSign.ts};
// WATCHES: ; __reindeer.atRest, __reindeer.board, __reindeer.boardLayout, __reindeer.clock, __reindeer.column, __reindeer.crosshairStrike
// WATCHES: ; __reindeer.fixtures, __reindeer.hud, __reindeer.logoHold, __reindeer.pressReady, __reindeer.road, __reindeer.roadSounds, __reindeer.roadSprites
// WATCHES: ; __reindeer.runMemory, __reindeer.seatTime, __reindeer.setBoard, __reindeer.shadows, __reindeer.step, __reindeer.tune, ROUND
// WATCHES: ; SHADOW.alpha, SHADOW.angle, SHADOW.column, SHADOW, .landing, .hudp, .spin
// THE SHADOW PROBE, ROUND 2 (the cast shadows, Corey 2026-11-15; game/road/shadows.ts, constants SHADOW). Every symbol,
// the through traffic, the column characters and the running reindeer throw their own silhouette: a twin sprite of the
// owner's own texture, pinned at its ground point, flattened and leaned up and to the left. From the running game, at
// each size (desktop 1440x900, phones 390x844 and 390x620 on the phone tier):
//   - a full board posed with every symbol frame (each car and the sleigh both ways, the five signs, two presents):
//     every symbol has exactly one twin, with its owner's texture, anchor and ground point, its owner's width (and
//     mirror), SHADOW.length of its height, leaned SHADOW.angle, never rotated, at SHADOW.alpha, in the ground layer
//     under every lane
//   - THE PICTURE (pixels: a screenshot with the shadows off against one with them on, compared in the page): the art
//     of every symbol is untouched (no shadow over a symbol), and each symbol's shadow darkens a real patch of road
//     beside it (its area in CSS px and how much darker it is: the "does it read" numbers)
//   - the WebGL draw calls per frame with the shadows off and on (no extra draw call; the billboard's lamps held lit)
//   - three columns standing: each character's twin lies on its own cloud (in its column's back layer, over the
//     backdrop, under the character and the red frame), moved by SHADOW.column, cropped to the inside of the box, from
//     the very sheet the character draws; they leave with their columns
//   - a book driving out and in, stepped one 30 fps frame at a time with the board clock frozen: on every frame each
//     drawn symbol has its twin on its ground point and texture in the same frame, never tilted with the dive, and no
//     hidden or retired symbol has one; nothing is left after the round
//   - a strike stepped frame by frame at 60 Hz: the reindeer's twin is his own frame (view, stride, mirror) pinned at
//     his feet, in the ground layer (under the traffic) on every frame, fades with him, and is gone once he is; he runs
//     down the gap (round 2's path); the Santa column it makes gets its shadow
//   - a slam stop (base_one_column, the Spin pressed again as he sets off): after the round no runner shadow, one
//     column shadow per standing column, exactly one twin per symbol drawn
//   - no page errors, no console errors
// With OUT=<dir> it writes shadow_probe.json and the pictures for the sheets (board_<size>_<off|on>.png,
// columns_<size>_<off|on>.png, runner_<size>_<view>.png, crops.json) and, with VIDEO=1, the strike's frames at 1440x900
// and 390x844 (strike_frames_<size>/) and their per-frame tables (strike_table_<size>.md); the caller makes the mp4s
// with ffmpeg.
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [OUT=<dir>] [VIDEO=1] \
//     [ONLY=desktop,portrait,short] node tools/shadow_probe.mjs
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
const STEP = 1000 / 30;
/** the strike is stepped at 60 Hz (a render frame) */
const STRIKE_STEP = 1000 / 60;
const BOARD_X = 142;
const LANE_TOP = 167;
const PITCH = 250;

const SIZES = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, dpr: 2, phone: false, video: true },
	{ name: 'portrait', vp: { width: 390, height: 844 }, dpr: 3, phone: true, video: true },
	{ name: 'short', vp: { width: 390, height: 620 }, dpr: 3, phone: true, video: false },
].filter((s) => !ONLY.length || ONLY.includes(s.name));
// board[reel][row]; rows 0 and 1 drive right, 2 and 3 left: every car and the sleigh both ways, the five signs, two presents
const FULL_BOARD = [
	['H1', 'L1', 'H2', 'S'],
	['L2', 'H3', 'W', 'L3'],
	['H4', 'L4', 'L5', 'H1'],
	['S', 'H2', 'H3', 'W'],
	['W', 'L5', 'H4', 'L2'],
];
const DRIVE_BOOK = [
	{ index: 0, type: 'reveal', gameType: 'basegame', board: [['L4', 'H3', 'L2', 'H2'], ['L3', 'S', 'L4', 'L5'], ['L3', 'L5', 'W', 'L4'], ['H4', 'L4', 'S', 'L4'], ['H3', 'L1', 'L4', 'H1']] },
	{ index: 1, type: 'finalWin', amount: 0 },
];

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

// counts WebGL draw calls per animation frame (read on a still board)
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

async function boot(browser, S) {
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.dpr, isMobile: S.phone, hasTouch: S.phone });
	await ctx.addInitScript(DRAW_COUNTER);
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=shadow${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 160; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && !document.querySelector('.landing'))).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	// the run views load in the background: the strike needs them (the placeholder would stand in otherwise)
	for (let i = 0; i < 240 && !(await p.evaluate(() => window.__reindeer.runMemory().loaded)); i++) await sleep(250);
	await sleep(400);
	return { ctx, p, errs };
}

const R = (p, fn, arg) => p.evaluate(fn, arg);

/** in the page: every symbol's twin against its owner and the rule (SHADOW angle, length, alpha, the tunnel fade) */
const TWIN_CHECK = () => {
	const h = window.__reindeer;
	const T = h.tune.shadow;
	const s = h.shadows();
	const lean = (T.angle * Math.PI) / 180;
	const bad = [];
	let drawn = 0;
	let shown = 0;
	for (const c of s.cars) {
		const isDrawn = c.phase !== 'free' && c.ownerVisible;
		if (isDrawn) drawn += 1;
		if (c.visible) shown += 1;
		// a twin may be hidden for an owner fully in a tunnel (alpha 0 there): only a twin without an owner is a fault
		if (c.visible && !isDrawn) {
			bad.push({ why: 'shadow left behind', c });
			continue;
		}
		if (!isDrawn) continue;
		if (!c.visible) {
			if (c.phase === 'rest') bad.push({ why: 'no shadow', c });
			continue;
		}
		const why = [];
		if (!c.sameTexture) why.push('texture');
		if (Math.abs(c.anchor[0] - c.ownerAnchor[0]) > 1e-6 || Math.abs(c.anchor[1] - c.ownerAnchor[1]) > 1e-6) why.push('anchor');
		if (Math.abs(c.x - c.ownerX) > 0.01 || Math.abs(c.y - c.ownerY) > 0.01) why.push('ground point');
		if (Math.abs(c.scaleX - c.ownerScaleX) > 1e-3) why.push('width');
		if (Math.abs(c.scaleY - c.ownerScaleY * T.length) > 1e-3) why.push('length');
		if (Math.abs(c.skewX - lean) > 1e-6 || Math.abs(c.skewY) > 1e-6 || Math.abs(c.rotation) > 1e-6) why.push('lean');
		if (!c.inGround) why.push('not on the ground layer');
		if (c.phase === 'rest' && Math.abs(c.alpha - T.alpha) > 0.002) why.push(`alpha ${c.alpha}`);
		if (why.length) bad.push({ why: why.join(','), frame: c.frame, c });
	}
	const perCell = {};
	for (const c of s.cars) if (c.visible && c.cell !== null) perCell[c.cell] = (perCell[c.cell] ?? 0) + 1;
	const doubled = Object.entries(perCell).filter(([, n]) => n !== 1);
	return { drawn, shown, bad: bad.slice(0, 3), badCount: bad.length, doubled, lanesAbove: s.lanesAbove, groundSprites: s.groundSprites, frames: [...new Set(s.cars.filter((c) => c.visible).map((c) => c.frame))].sort() };
};

/** in the page: two screenshots (base64 PNG) compared over regions. For each symbol parked now: its own art (a box in
 *  its middle) must not change; the patch beside it that the shadow falls on (from its ground point to its top, from
 *  its left edge out to where its top's shadow lands) is counted: pixels at least 12 levels darker, their area in CSS px
 *  and their mean brightness before and after. */
const PIXELS = async ({ off, on, dpr }) => {
	const load = async (b64) => {
		const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
		const bmp = await createImageBitmap(blob);
		const c = new OffscreenCanvas(bmp.width, bmp.height);
		const g = c.getContext('2d');
		g.drawImage(bmp, 0, 0);
		return g.getImageData(0, 0, bmp.width, bmp.height);
	};
	const A = await load(off);
	const B = await load(on);
	const h = window.__reindeer;
	const L = h.boardLayout();
	const k = L.css.pitch / 250;
	const T = h.tune.shadow;
	const lean = (T.angle * Math.PI) / 180;
	const px = (x, y) => [Math.round((L.css.x + (x - 142) * k) * dpr), Math.round((L.css.y + (y - 167) * k) * dpr)];
	const lum = (D, i) => (D.data[i] + D.data[i + 1] + D.data[i + 2]) / 3;
	const out = [];
	for (const c of h.shadows().cars) {
		if (c.phase !== 'rest' || !c.ownerVisible) continue;
		// the owner's picture as drawn (its trim inside its canvas), road px from its anchor
		const art = c.ownerArt;
		const H = -art.y0;
		const half = art.w / 2;
		const midX = c.ownerX + art.x0 + half;
		const [ax0, ay0] = px(midX - 0.36 * half, c.ownerY + art.y0 + 0.3 * art.h);
		const [ax1, ay1] = px(midX + 0.36 * half, c.ownerY + art.y0 + 0.7 * art.h);
		let artMax = 0;
		for (let y = ay0; y < ay1; y++)
			for (let x = ax0; x < ax1; x++) {
				const i = (y * A.width + x) * 4;
				artMax = Math.max(artMax, Math.abs(lum(A, i) - lum(B, i)));
			}
		// the patch the shadow falls on, left of the owner
		const reachX = Math.sin(lean) * T.length * H;
		const [sx0, sy0] = px(c.ownerX + art.x0 - reachX, c.ownerY - H);
		const [sx1, sy1] = px(c.ownerX + art.x0 + art.w, c.ownerY + 4);
		let n = 0;
		let before = 0;
		let after = 0;
		for (let y = Math.max(0, sy0); y < Math.min(A.height, sy1); y++)
			for (let x = Math.max(0, sx0); x < Math.min(A.width, sx1); x++) {
				const i = (y * A.width + x) * 4;
				const a = lum(A, i);
				const b = lum(B, i);
				if (a - b >= 12) {
					n += 1;
					before += a;
					after += b;
				}
			}
		out.push({ frame: c.frame, cell: c.cell, artMax: Math.round(artMax * 10) / 10, areaCss: Math.round(n / (dpr * dpr)), before: n ? Math.round(before / n) : null, after: n ? Math.round(after / n) : null, ratio: n ? Math.round((after / before) * 100) / 100 : null });
	}
	return out;
};

async function setShadows(p, on) {
	await R(p, (v) => {
		window.__reindeer.tune.shadow.on = v;
	}, on);
	await sleep(300);
}

async function stills(p, S, out) {
	await R(p, (b) => {
		const h = window.__reindeer;
		h.clock(1);
		h.tune.shadow.on = true;
		h.setBoard(b);
	}, FULL_BOARD);
	await sleep(700);
	const c = await R(p, TWIN_CHECK);
	check(c.drawn === 20 && c.shown === 20 && c.badCount === 0 && c.doubled.length === 0, `${S.name}: full board: each of the 20 symbols has exactly one twin (its own texture and anchor, on its ground point, its width, SHADOW.length of its height, leaned SHADOW.angle, never rotated, at SHADOW.alpha)`, c);
	check(c.frames.length === 16, `${S.name}: the board shows all 16 symbol frames with their twins (4 cars and the sleigh both ways, 5 signs, the present)`, c.frames);
	check(c.lanesAbove, `${S.name}: the ground layer (every twin) is under all four lanes`);
	const modes = {};
	const shots = {};
	// (pass 8) the seated drivers' idle animations (pass 7: Santa's and Grandma's heads) run on performance.now(): held on
	// one moment (the dev hook seatTime) and the board clock frozen for the two pictures, so they compare the same
	// animation frame (a moved head is not a shadow over the art)
	// (scene pass 9 fix, 2026-11-17) the billboard's lamps blink on real time, and a lit lamp costs draw calls of its own
	// (its glass and its added glow: 9 calls a frame with both dark, 10 one lit, 12 both): held lit for the two windows, so
	// the off and on counts compare the same frame and not two moments of the blink
	await R(p, () => {
		const h = window.__reindeer;
		h.seatTime(1000);
		h.clock(0);
		const L = h.tune.logoSign?.lamps;
		if (h.logoHold && L) h.logoHold(L.darkMs + L.stepMs + L.fadeMs + 50);
	});
	for (const mode of ['off', 'on']) {
		await setShadows(p, mode === 'on');
		const stats = await R(p, async () => {
			const before = { ...window.__dc };
			await new Promise((r) => setTimeout(r, 1000));
			const calls = window.__dc.calls - before.calls;
			const frames = window.__dc.frames - before.frames;
			return { sprites: window.__reindeer.roadSprites(), callsPerFrame: Math.round((calls / Math.max(1, frames)) * 100) / 100, frames };
		});
		modes[mode] = stats;
		const buf = await p.screenshot();
		shots[mode] = buf.toString('base64');
		if (OUT) writeFileSync(join(OUT, `board_${S.name}_${mode}.png`), buf);
	}
	check(modes.on.sprites.shadows === 20 && modes.off.sprites.shadows === 0, `${S.name}: twins drawn: off 0, on 20`, modes);
	check(modes.on.callsPerFrame <= modes.off.callsPerFrame + 0.01, `${S.name}: no extra draw call for the shadows (off ${modes.off.callsPerFrame}, on ${modes.on.callsPerFrame} per frame)`, modes);
	// THE PICTURE
	await R(p, () => {
		window.__reindeer.clock(1);
		window.__reindeer.seatTime(null);
		window.__reindeer.logoHold?.(null);
	});
	const pix = await R(p, PIXELS, { off: shots.off, on: shots.on, dpr: S.dpr });
	const art = pix.filter((x) => x.artMax > 3);
	check(pix.length === 20 && art.length === 0, `${S.name}: no shadow is drawn over any symbol's art (its middle unchanged by the shadows, to 3 levels)`, art);
	// each symbol's shadow darkens a patch of road beside it: at least this many CSS px, at least a third darker
	const minArea = S.phone ? 25 : 150;
	const weak = pix.filter((x) => x.areaCss < minArea || x.ratio === null || x.ratio > 0.67);
	check(weak.length === 0, `${S.name}: every symbol's shadow shows on the road beside it (at least ${minArea} CSS px at least 12 levels and a third darker)`, weak);
	const byFrame = {};
	for (const x of pix) (byFrame[x.frame] ??= []).push(x);
	console.log(`  ${S.name} shadow patches (CSS px, mean brightness before -> after): ` + Object.entries(byFrame).map(([f, xs]) => `${f} ${xs.map((x) => `${x.areaCss}px ${x.before}->${x.after}`).join(' / ')}`).join(' | '));
	out.board = { check: c, modes, pixels: pix };

	// crops: per symbol frame, a box around it and its shadow (road px -> CSS px)
	const crops = await R(p, () => {
		const h = window.__reindeer;
		const L = h.boardLayout();
		const s = L.css.pitch / 250;
		const toCss = (x, y) => ({ x: L.css.x + (x - 142) * s, y: L.css.y + (y - 167) * s });
		const seen = new Set();
		const boxes = [];
		for (const c of h.shadows().cars) {
			if (!c.visible || seen.has(c.frame)) continue;
			seen.add(c.frame);
			const a = toCss(c.ownerX - 230, c.ownerY - 168);
			const b = toCss(c.ownerX + 115, c.ownerY + 14);
			boxes.push({ name: c.frame, x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y });
		}
		return { boxes, cssPerRoad: s };
	});

	// THE COLUMNS: three standing
	await R(p, () => {
		const h = window.__reindeer;
		h.tune.shadow.on = true;
		h.column(1, 'reindeer', 5, null);
		h.column(2, 'santa', 10, null);
		h.column(3, 'grandma', 3, null);
	});
	for (let i = 0; i < 60; i++) {
		const ok = await R(p, () => window.__reindeer.shadows().features.columns.filter((c) => c.phase === 'idle' && c.visible).length === 3);
		if (ok) break;
		await sleep(250);
	}
	await sleep(400);
	const cols = await R(p, () => {
		const h = window.__reindeer;
		const C = h.tune.shadow.column;
		return h.shadows().features.columns.map((c) => {
			const want = { x: Math.max(c.body.x + C.dx, c.box.x), y: Math.max(c.body.y + C.dy, c.box.y) };
			const right = Math.min(c.body.x + C.dx + c.body.w, c.box.x + c.box.w);
			const bottom = Math.min(c.body.y + C.dy + c.body.h, c.box.y + c.box.h);
			const inBox = c.x >= c.box.x - 0.01 && c.y >= c.box.y - 0.01 && c.x + c.w <= c.box.x + c.box.w + 0.01 && c.y + c.h <= c.box.y + c.box.h + 0.01;
			const placed = Math.abs(c.x - want.x) < 0.02 && Math.abs(c.y - want.y) < 0.02 && Math.abs(c.x + c.w - right) < 0.05 && Math.abs(c.y + c.h - bottom) < 0.05;
			// the crop is the body's own frame, offset by what was cut off
			const perX = c.body.frame.w / c.body.w;
			const frameOk = c.source === c.body.source && Math.abs(c.frame.x - (c.body.frame.x + (want.x - (c.body.x + C.dx)) * perX)) < 0.6;
			return { tier: c.tier, visible: c.visible, inBack: c.inBack, inBox, placed, frameOk, alpha: c.alpha, want: C.alpha };
		});
	});
	check(cols.length === 3 && cols.every((c) => c.visible && c.inBack && c.inBox && c.placed && c.frameOk && Math.abs(c.alpha - c.want) < 0.002), `${S.name}: each standing column character's twin lies on its own cloud (back layer), moved by SHADOW.column, cropped to the inside of its box, from the sheet it draws`, cols);
	const colShots = {};
	for (const mode of ['off', 'on']) {
		await setShadows(p, mode === 'on');
		const buf = await p.screenshot();
		if (OUT) writeFileSync(join(OUT, `columns_${S.name}_${mode}.png`), buf);
		colShots[mode] = await R(p, () => window.__reindeer.roadSprites());
	}
	const colCrops = await R(p, () => {
		const h = window.__reindeer;
		const L = h.boardLayout();
		const s = L.css.pitch / 250;
		const toCss = (x, y) => ({ x: L.css.x + (x - 142) * s, y: L.css.y + (y - 167) * s });
		return h.shadows().features.columns.map((c) => {
			const a = toCss(c.box.x - 40, c.box.y - 30);
			const b = toCss(c.box.x + c.box.w + 40, c.box.y + c.box.h + 30);
			return { name: `column_${c.tier}`, x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
		});
	});
	// the columns leave: their shadows go with them
	await R(p, () => {
		const h = window.__reindeer;
		h.tune.shadow.on = true;
		h.crosshairStrike({ cells: [], poseOnly: true });
	});
	await sleep(1200);
	const after = await R(p, () => window.__reindeer.shadows().features);
	check(after.columns.length === 0 && after.layers.feet === 0, `${S.name}: the columns left and took their shadows with them`, after);
	out.columns = { cols, colShots };
	return { crops, colCrops };
}

async function driveCheck(p, S, out) {
	await R(p, (ev) => window.__reindeer.fixtures.queue(ev, 0), DRIVE_BOOK);
	await R(p, () => window.__reindeer.clock(0));
	await R(p, () => window.__reindeer.hud.emit({ type: 'bet' }));
	let frames = 0;
	let badFrames = 0;
	let firstBad = null;
	let maxShown = 0;
	let tiltedOwners = 0;
	let tIn = null;
	for (let i = 0; i < 900; i++) {
		const s = await R(p, (ms) => {
			const h = window.__reindeer;
			const snap = h.step(ms, 1);
			const sh = h.shadows();
			const lean = (h.tune.shadow.angle * Math.PI) / 180;
			const bad = sh.cars.filter((c) => {
				const drawn = c.phase !== 'free' && c.ownerVisible;
				if (c.visible && !drawn) return true;
				if (!c.visible) return false;
				return !c.sameTexture || Math.abs(c.x - c.ownerX) > 0.01 || Math.abs(c.y - c.ownerY) > 0.01 || Math.abs(c.rotation) > 1e-6 || Math.abs(c.skewX - lean) > 1e-6;
			});
			// the drive's dive tilts the owner, never the twin
			const tilted = sh.cars.filter((c) => c.visible && Math.abs(c.ownerRotation) > 0.002).length;
			return { inPhase: snap.phases.in ?? 0, idle: h.atRest(), shown: sh.cars.filter((c) => c.visible).length, bad: bad.slice(0, 2), badCount: bad.length, tilted };
		}, STEP);
		frames += 1;
		maxShown = Math.max(maxShown, s.shown);
		tiltedOwners += s.tilted;
		if (s.badCount) {
			badFrames += 1;
			firstBad ??= s.bad;
		}
		if (tIn === null && s.inPhase > 0) tIn = i;
		if (tIn !== null && s.idle) break;
		await sleep(10);
	}
	await R(p, () => window.__reindeer.clock(1));
	await sleep(300);
	const end = await R(p, TWIN_CHECK);
	check(badFrames === 0, `${S.name}: drive out and in (${frames} frames stepped): every drawn symbol's twin is on its ground point with its texture in the same frame, never tilted (${tiltedOwners} tilted owner frames seen), none on a hidden or retired one`, firstBad);
	check(end.drawn === 20 && end.shown === 20 && end.badCount === 0 && end.doubled.length === 0, `${S.name}: after the round: exactly one twin per symbol, none left behind (ground sprites ${end.groundSprites}, drawn ${end.shown})`, end);
	out.drive = { frames, maxShown, tiltedOwners, end };
}

async function strikeCheck(p, S, out, video) {
	await R(p, () => {
		const h = window.__reindeer;
		h.tune.shadow.on = true;
		h.tune.strike.entry = 'far';
		h.clock(1);
	});
	await R(p, () => window.__reindeer.crosshairStrike({ cells: [9, 2, 17], kinds: ['W', 'H1', 'H1'], poseOnly: true }));
	await sleep(400);
	await R(p, () => {
		window.__reindeer.clock(0);
		window.__strikeDone = false;
		window.__reindeer.crosshairStrike({ cells: [9, 2, 17], kinds: ['W', 'H1', 'H1'], target: 9, follow: true }).then(() => (window.__strikeDone = true));
	});
	await sleep(200);
	const frameDir = video && OUT ? join(OUT, `strike_frames_${S.name}`) : null;
	if (frameDir) mkdirSync(frameDir, { recursive: true });
	const rows = [];
	let off = 0;
	let firstOff = null;
	let sawRunner = false;
	let goneAt = null;
	let leftOver = null;
	let tail = 0;
	let shot = 0;
	const viewShots = {};
	for (let i = 0; i < 800; i++) {
		const s = await R(p, (ms) => {
			const h = window.__reindeer;
			h.step(ms, 1);
			const f = h.shadows().features;
			return { runner: f.runner, run: h.road().features.runner, layers: f.layers, columns: f.columns, done: window.__strikeDone, strength: h.tune.shadow.on ? h.tune.shadow.alpha : 0, length: h.tune.shadow.length, lean: (h.tune.shadow.angle * Math.PI) / 180 };
		}, STRIKE_STEP);
		const r = s.runner;
		const live = r && r.spriteVisible;
		if (frameDir && (live || (sawRunner && goneAt === null) || (s.done && tail < 30))) await p.screenshot({ path: join(frameDir, `f${String(shot++).padStart(4, '0')}.png`) });
		if (live) {
			sawRunner = true;
			const sh = r.shadow;
			const why = [];
			if (!sh.visible && s.strength * r.spriteAlpha > 0.003) why.push('hidden');
			if (sh.visible) {
				if (!sh.sameTexture) why.push('texture');
				if (!sh.inGround) why.push('not on the ground');
				if (Math.abs(sh.x - r.feetX) > 0.01 || Math.abs(sh.y - r.feetY) > 0.01) why.push('not at his feet');
				if (Math.abs(sh.scaleX - r.spriteScaleX) > 1e-3 || Math.abs(sh.scaleY - r.spriteScaleY * s.length) > 1e-3) why.push('size or mirror');
				if (Math.abs(sh.skewX - s.lean) > 1e-6) why.push('lean');
				if (Math.abs(sh.alpha - s.strength * r.spriteAlpha) > 0.002) why.push('alpha');
			}
			if (why.length) {
				off += 1;
				firstOff ??= { i, why, r };
			}
			const key = r.phase === 'cut' ? 'cut' : r.view;
			// (the side run's still once he is well on the board: its first frames are off the picture's edge)
			if (OUT && !viewShots[key] && r.phase !== 'impact' && (S.name === 'desktop' || S.name === 'portrait') && (key !== 'R' || (r.feetX > 330 && r.feetX < 1200))) {
				const buf = await p.screenshot();
				writeFileSync(join(OUT, `runner_${S.name}_${key}.png`), buf);
				viewShots[key] = await R(p, (rr) => {
					const h = window.__reindeer;
					const L = h.boardLayout();
					const k = L.css.pitch / 250;
					const toCss = (x, y) => ({ x: L.css.x + (x - 142) * k, y: L.css.y + (y - 167) * k });
					const a = toCss(rr.feetX - 250, rr.feetY - 260);
					const b = toCss(rr.feetX + 110, rr.feetY + 20);
					return { name: `runner_${rr.key}`, view: rr.view, stride: rr.stride, x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
				}, { ...r, key });
			}
			const run = s.run;
			const impactAt = run ? run.impactMs : null;
			rows.push({ frame: i, phase: r.phase, view: r.view, stride: r.stride, mirrored: r.spriteScaleX < 0, scale: r.scale, feetX: r.feetX, feetY: r.feetY, gapX: r.gapX, shadowX: sh.x, shadowY: sh.y, alpha: sh.alpha, visible: sh.visible, pose: run?.pose ?? null, impactMs: impactAt, toImpact: run && impactAt !== null && r.phase !== 'impact' ? Math.round((impactAt - run.elapsedMs) * 10) / 10 : r.phase === 'impact' ? 0 : null });
		} else if (sawRunner && goneAt === null && !r) {
			goneAt = i;
			if (s.layers.runner !== 0) leftOver = s.layers;
		}
		if (s.done && goneAt !== null) {
			tail += 1;
			out.strikeColumn = s.columns;
			if (tail > 72) break;
		}
		await sleep(0);
	}
	await R(p, () => window.__reindeer.clock(1));
	check(sawRunner && rows.length > 40, `${S.name}: strike: ${rows.length} frames with the reindeer drawn`);
	check(off === 0, `${S.name}: strike: on every frame his twin is his own frame (view, stride, mirror), pinned at his feet, on the ground layer under the traffic, leaned and faded with him`, firstOff);
	const down = rows.filter((r) => r.view === 'C');
	check(down.length > 0 && down.every((r) => Math.abs(r.feetX - r.gapX) < 0.01) && rows.some((r) => r.phase === 'cut'), `${S.name}: strike: he runs down the gap (x ${rows[0]?.gapX}) between the traffic, then cuts into the target`, { down: down.length, cut: rows.filter((r) => r.phase === 'cut').length });
	check(goneAt !== null && leftOver === null, `${S.name}: strike: once he is gone into the cloud his twin is gone too`, { goneAt, leftOver });
	const col = (out.strikeColumn ?? []).find((c) => c.tier === 'santa');
	check(!!col && col.visible && col.inBack, `${S.name}: the Santa column the strike made has its shadow on its cloud`, out.strikeColumn);
	out.strike = { frames: rows.length, rows, views: viewShots };
	return { rows, viewShots };
}

async function slamCheck(p, S, out) {
	await R(p, () => {
		const h = window.__reindeer;
		h.clock(1);
		h.roadSounds(true);
		h.fixtures.next('base_one_column');
	});
	await p.click('.hudp button.spin');
	let slammed = false;
	for (let i = 0; i < 600 && !slammed; i++) {
		const set = await R(p, () => window.__reindeer.roadSounds().some((e) => e.what === 'setOff'));
		if (set) {
			await p.click('.hudp button.spin').catch(() => {});
			slammed = true;
		} else await sleep(15);
	}
	for (let i = 0; i < 120; i++) {
		if (await R(p, () => window.__reindeer.atRest() && !window.__reindeer.shadows().features.runner)) break;
		await sleep(150);
	}
	await sleep(600);
	const c = await R(p, TWIN_CHECK);
	const f = await R(p, () => window.__reindeer.shadows().features);
	const standing = f.columns.filter((x) => x.phase !== 'leave');
	check(slammed && c.badCount === 0 && c.doubled.length === 0 && c.shown === c.drawn && f.layers.runner === 0 && standing.every((x) => x.visible === (x.bodyVisible && x.bodyOver)), `${S.name}: after a slam stop: one twin per symbol drawn (${c.shown}), no runner shadow, ${standing.filter((x) => x.visible).length} column shadow(s) for ${standing.length} standing column(s)`, { slammed, c, f });
	out.slam = { c, f };
	// the next press clears the column: its shadow goes with it
	await R(p, () => window.__reindeer.fixtures.queue([{ index: 0, type: 'reveal', gameType: 'basegame', board: [['L4', 'H3', 'L2', 'H2'], ['L3', 'S', 'L4', 'L5'], ['L3', 'L5', 'W', 'L4'], ['H4', 'L4', 'S', 'L4'], ['H3', 'L1', 'L4', 'H1']] }, { index: 1, type: 'finalWin', amount: 0 }], 0));
	// (2026-11-22: after a slam stopped column round the board reads atRest() while the key is still the round's Stop key
	// (the LED total is finishing), so this press was sometimes spent as a Stop, no spin ran and the standing column was
	// read as a leftover: 5 of 9 cases on 9b46ba74, 5 of 12 on 48d852ca (Decimus). Wait until the game takes a press,
	// then for the spin to really start (not at rest) before waiting for its rest.)
	for (let i = 0; i < 80; i++) {
		if (await R(p, () => (window.__reindeer.pressReady ? window.__reindeer.pressReady() : true))) break;
		await sleep(100);
	}
	await p.click('.hudp button.spin');
	let spun = false;
	for (let i = 0; i < 40 && !spun; i++) {
		spun = !(await R(p, () => window.__reindeer.atRest()));
		if (!spun) await sleep(50);
	}
	for (let i = 0; i < 120; i++) {
		if (await R(p, () => window.__reindeer.atRest())) break;
		await sleep(150);
	}
	await sleep(800);
	check(spun, `${S.name}: the next spin: the press on a ready key started a spin`, { spun });
	const g = await R(p, () => window.__reindeer.shadows().features);
	const c2 = await R(p, TWIN_CHECK);
	check(g.columns.length === 0 && g.layers.feet === 0 && c2.badCount === 0 && c2.shown === 20, `${S.name}: the next spin: the column and its shadow gone, 20 symbols with 20 twins`, { g, c2 });
}

const browser = await chromium.launch({ args: ['--mute-audio'] });
const result = { sizes: {} };
const allCrops = {};
try {
	for (const S of SIZES) {
		const { ctx, p, errs } = await boot(browser, S);
		const out = { tune: await R(p, () => ({ ...window.__reindeer.tune.shadow })) };
		console.log(`-- ${S.name} ${S.vp.width}x${S.vp.height} ${JSON.stringify(out.tune)}`);
		const { crops, colCrops } = await stills(p, S, out);
		await R(p, () => window.__reindeer.setBoard(window.__reindeer.board()));
		await driveCheck(p, S, out);
		const { rows, viewShots } = await strikeCheck(p, S, out, VIDEO && S.video);
		allCrops[S.name] = { dpr: S.dpr, symbols: crops.boxes, columns: colCrops, runner: Object.values(viewShots), cssPerRoad: crops.cssPerRoad };
		if (OUT && VIDEO && S.video) {
			const md = [
				`# The strike with the new path, per frame (${S.vp.width}x${S.vp.height}, board clock stepped at 60 Hz, one render frame per row)`,
				'',
				'Road px (the 1536 x 1024 board picture). His feet point is the run view\'s anchor; his shadow is his twin pinned there, so its anchor is at his feet and it leans up and to the left from them. "To impact": road clock ms from this frame to the planned impact. Mirrored: the run views flipped (running to the left).',
				'',
				'| frame | phase | view | stride | mirrored | his x, y | shadow anchor x, y | shadow alpha | to impact (ms) |',
				'|---:|---|---|---:|---|---|---|---:|---:|',
			];
			for (const r of rows) md.push(`| ${r.frame} | ${r.phase} | ${r.view} | ${r.stride} | ${r.mirrored ? 'yes' : 'no'} | ${r.feetX}, ${r.feetY} | ${r.shadowX}, ${r.shadowY} | ${r.alpha} | ${r.toImpact ?? ''} |`);
			writeFileSync(join(OUT, `strike_table_${S.name}.md`), md.join('\n') + '\n');
		}
		await slamCheck(p, S, out);
		check(errs.length === 0, `${S.name}: no page errors, no console errors`, errs);
		result.sizes[S.name] = out;
		await ctx.close();
	}
} finally {
	await browser.close();
}
if (OUT) writeFileSync(join(OUT, 'crops.json'), JSON.stringify(allCrops, null, 1));
console.log(`\n${pass} passed, ${fail} failed${fails.length ? '\n  ' + fails.join('\n  ') : ''}`);
if (OUT) writeFileSync(join(OUT, 'shadow_probe.json'), JSON.stringify({ pass, fail, fails, ...result }, null, 1));
process.exit(fail ? 1 : 0);
