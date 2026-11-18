// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,game/road/roadBoard.ts,game/road/roadFeatures.ts};
// WATCHES: ; __reindeer.atRest, __reindeer.board, __reindeer.boardLayout, __reindeer.clock, __reindeer.frame, __reindeer.hud
// WATCHES: ; __reindeer.roadBoard, __reindeer.setBoard, __reindeer.step, __reindeer.tune, __reindeer.turbo, COLUMN.loadWaitMs, COLUMN, RED_BOX
// WATCHES: ; .landing
// THE COLUMN FRAME PROBE (pass 6, Corey 2026-11-16; game/road/roadFeatures.ts, constants COLUMN, RED_BOX). A full column
// Wild's red frame and what may pass it:
//   - THE EDGES (Corey: "you can still see the white lines of the videos behind the border sides"): a strip of device
//     px just outside the frame's dark outer line on all four sides, at the end of the box's growth (the moving cloud
//     at full height), in the entrance's cloud frames and with the column standing (its character hidden), compared
//     against the same frame with the column's clouds and character not drawn: nothing pale (no cloud) outside the
//     frame, at 1440x900, 390x844 and 390x620, each at device scale 1, 2 and 3
//   - THE RIGHT BORDER (Corey: "keep the left, top, bottom border as a character boundary, but let them overlap on the
//     right borders"): a standing character (idle and win) is cropped at the left, top and bottom (inside the frame's
//     dark line) and not on the right; the right band draws under the characters, the other three bands over them; the
//     clouds never pass the frame on any side (the entrance's cloud frames are cropped on the right too)
//   - THE CLEAN RECTANGLE (2026-11-17, Corey: "it should draw as a rectangle"): with its clouds and character not drawn, each
//     band's red unbroken from corner to corner along its middle and each inner dark line unbroken (no stray line or notch
//     on any side), at grow end and standing, every size and device scale
//   - LEFT TO RIGHT (2026-11-17): four layouts of five columns side by side holding every pair of the three characters at
//     every reel (two of them sticky, as in the bonus rounds), idle and win, and a grow beside a standing Santa: each
//     character draws over its right-hand neighbor's left band and character and under the neighbor's rails and number;
//     the neighbor's left band pixels its spill covers (hidden and shown) are listed, and at least Santa's idle must show
//   - THE ARRIVAL (2026-11-17): each character's column at normal speed, turbo 1 and 2, stepped frame by frame from its
//     moving cloud until it stands: the inside covered on every frame (the moving or the still cloud drawn)
//   - no page errors
// With OUT=<dir>: crops of each side per character (side_<size>_<tier>_<phase>_<side>.png, the caller upscales 4x), the
//   edge strips' crops (edge_<size>_<moment>_<side>.png, 6x by the caller), a held column next to a neighbor
//   (neighbor_<size>.png), and with VIDEO=1 frames of an entrance and a win (frames_<tier>_<size>/, 60 fps clock steps;
//   VIDEO_TIERS picks the characters, all three by default: each takes a while headless).
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [OUT=<dir>] [VIDEO=1] \
//     [ONLY=desktop,portrait,short] [DPRS=1,2,3] node tools/column_frame_probe.mjs
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
const DPRS = (process.env.DPRS || '1,2,3').split(',').map(Number);
/** PARTS=edges,arrival,right,pairs picks the parts (default all; a lock turn is 15 minutes) */
const PARTS = (process.env.PARTS || 'edges,arrival,right,pairs').split(',');
const PART = (x) => PARTS.includes(x);
if (OUT) mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FRAME = 1000 / 60;
const TIERS = ['reindeer', 'santa', 'grandma'];
/** the characters whose entrance and win are recorded with VIDEO=1 (VIDEO_TIERS=grandma,...; all by default) */
const VIDEO_TIERS = (process.env.VIDEO_TIERS || TIERS.join(',')).split(',').filter(Boolean);

const SIZES = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, phone: false },
	{ name: 'portrait', vp: { width: 390, height: 844 }, phone: true },
	{ name: 'short', vp: { width: 390, height: 620 }, phone: true },
].filter((s) => !ONLY.length || ONLY.includes(s.name));
// a quiet board: no wins
const BOARD = [['L4', 'H3', 'L2', 'H2'], ['L3', 'L1', 'L4', 'L5'], ['L3', 'L5', 'L1', 'L4'], ['H4', 'L4', 'L2', 'L4'], ['H3', 'L1', 'L4', 'H1']];

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

/** how long a column may wait for its entrance pictures in this probe (real ms; the game's own wait is 4 s) */
const COLUMN_LOAD_WAIT_MS = 90000;
async function boot(browser, S, dpr) {
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: dpr, isMobile: S.phone, hasTouch: S.phone });
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=colframe${S.name}${dpr}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 160; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && !document.querySelector('.landing'))).catch(() => false);
		// (pass 7: the first board keeps the posed columns until the first spin; this probe stands its own columns, so the
		// posed ones go first, as the landing's end used to take them)
		if (ok) await p.evaluate(() => window.__reindeer.setBoard(window.__reindeer.board())).catch(() => {});
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	await R(p, ([b, waitMs]) => {
		const h = window.__reindeer;
		h.clock(1);
		h.setBoard(b);
		// (2026-11-17, the Linux host: a column waits in its 'wait' for its entrance pictures at most COLUMN.loadWaitMs, 4 real
		// seconds, then grows without its cloud; a slow host's reload of the pictures took longer, so the column grew
		// empty and the "grow end" moment, which needs the cloud, never came. In this probe the column waits for them as
		// long as they take (the game's own wait, made patient: a probe setting, not the game's), and startColumn waits
		// in real time until the column leaves its wait.)
		h.tune.column.loadWaitMs = waitMs;
	}, [BOARD, COLUMN_LOAD_WAIT_MS]);
	await sleep(800);
	return { ctx, p, errs };
}

const R = (p, fn, arg) => p.evaluate(fn, arg);

/** in the page: the column on `reel`, its frame's outer box in CSS px, and the state of its parts */
const COLUMN_STATE = (reel) => {
	const h = window.__reindeer;
	const F = h.roadBoard().features;
	const c = F.columns.find((x) => x.reel === reel && x.phase !== 'leave');
	if (!c) return null;
	const cv = document.querySelector('canvas').getBoundingClientRect();
	const g = (s) => {
		const b = s.getBounds();
		return { x: cv.x + b.x, y: cv.y + b.y, w: b.width, h: b.height };
	};
	const outer = c.box.outer.map(g);
	const box = { x: outer[2].x, y: outer[0].y, w: outer[3].x + outer[3].w - outer[2].x, h: outer[1].y + outer[1].h - outer[0].y };
	// the road px box of the frame's outer edge and of the body as drawn
	const band = c.box.sides.map((q) => ({ x: q.x, y: q.y, w: q.width, h: q.height }));
	const ob = c.box.outer.map((q) => ({ x: q.x, y: q.y, w: q.width, h: q.height }));
	const roadOuter = { x: ob[2].x, y: ob[0].y, x1: ob[3].x + ob[3].w, y1: ob[1].y + ob[1].h };
	const body = c.body.visible ? { x: c.body.x, y: c.body.y, x1: c.body.x + c.body.width, y1: c.body.y + c.body.height } : null;
	const cloud = c.cloud.visible ? { x: c.cloud.x, y: c.cloud.y, x1: c.cloud.x + c.cloud.width, y1: c.cloud.y + c.cloud.height } : null;
	const backdrop = c.backdrop.visible ? { x: c.backdrop.x, y: c.backdrop.y, x1: c.backdrop.x + c.backdrop.width, y1: c.backdrop.y + c.backdrop.height } : null;
	// the layers (2026-11-17: one stack per reel, right band, body, left band; the rails over every stack): each part's
	// place in the drawing order of the features layer (a walk of its tree, bottom to top)
	const order = new Map();
	let n = 0;
	const walk = (o) => {
		order.set(o, n++);
		for (const ch of o.children ?? []) walk(ch);
	};
	walk(F.layer);
	const at = (o) => (o && order.has(o) ? order.get(o) : -1);
	const stack = F.stacks[reel];
	return {
		phase: c.phase,
		frame: c.frame,
		enterCloud: c.enterCloud,
		over: c.body.parent === stack.body,
		box,
		roadOuter,
		body,
		cloud,
		backdrop,
		band: band.map((b) => ({ x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, w: Math.round(b.w * 10) / 10, h: Math.round(b.h * 10) / 10 })),
		layers: { body: c.body.parent === stack.body ? at(c.body) : -1, rightBand: at(c.box.rightRoot), leftBand: at(c.box.leftRoot), rails: at(c.box.root), number: at(c.label.root) },
		edge: h.tune.redBox.edge,
	};
};

/** in the page: two screenshots compared in strips just outside the box (CSS px box), `px` device px wide, skipping
 *  `gap` device px next to the edge; returns per side the count of pixels brighter by over 10 levels and the max */
const STRIP_DIFF = async ({ a, b, box, dpr, px, gap }) => {
	const load = async (b64) => {
		const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
		const c = new OffscreenCanvas(img.width, img.height);
		const g = c.getContext('2d');
		g.drawImage(img, 0, 0);
		return g.getImageData(0, 0, img.width, img.height);
	};
	const A = await load(a);
	const B = await load(b);
	const W = A.width;
	const x0 = Math.floor(box.x * dpr);
	const x1 = Math.ceil((box.x + box.w) * dpr);
	const y0 = Math.floor(box.y * dpr);
	const y1 = Math.ceil((box.y + box.h) * dpr);
	const sides = {
		left: { xs: [x0 - gap - px, x0 - gap], ys: [y0 + 4, y1 - 4] },
		right: { xs: [x1 + gap, x1 + gap + px], ys: [y0 + 4, y1 - 4] },
		top: { xs: [x0 + 4, x1 - 4], ys: [y0 - gap - px, y0 - gap] },
		bottom: { xs: [x0 + 4, x1 - 4], ys: [y1 + gap, y1 + gap + px] },
	};
	const out = {};
	for (const [k, s] of Object.entries(sides)) {
		let n = 0;
		let max = 0;
		let total = 0;
		for (let y = Math.max(0, s.ys[0]); y < Math.min(A.height, s.ys[1]); y++)
			for (let x = Math.max(0, s.xs[0]); x < Math.min(W, s.xs[1]); x++) {
				const i = (y * W + x) * 4;
				const d = (A.data[i] + A.data[i + 1] + A.data[i + 2] - B.data[i] - B.data[i + 1] - B.data[i + 2]) / 3;
				total += 1;
				if (d > 10) n += 1;
				if (d > max) max = d;
			}
		out[k] = { pale: n, max: Math.round(max), px: total };
	}
	return out;
};

/** the column's clouds and character drawn or not (the frame and the number stay) */
const setInside = (p, reel, on) =>
	R(p, ({ reel, on }) => {
		const c = window.__reindeer.roadBoard().features.columns.find((x) => x.reel === reel && x.phase !== 'leave');
		c.back.renderable = on;
		c.body.renderable = on;
	}, { reel, on });

const shot = async (p) => (await p.screenshot()).toString('base64');

/** a column in `reel` of `tier`, from a struck cell (row 1), the board clock frozen; the hook returns once placed */
async function startColumn(p, reel, tier, multiplier = 10) {
	await R(p, ({ reel, tier, multiplier }) => {
		const h = window.__reindeer;
		const F = h.roadBoard().features;
		h.clock(0);
		window.__colDone = false;
		F.columnWild(reel, tier, multiplier, false, reel * 4 + 1).then(() => (window.__colDone = true));
	}, { reel, tier, multiplier });
	return waitLoaded(p, reel);
}
/** the board clock is held: wait in REAL time while the column on `reel` waits for its pictures (the game's own state,
 *  'wait'), up to COLUMN_LOAD_WAIT_MS and a little; false (and the caller skips what depends on it) if it never left */
async function waitLoaded(p, reel) {
	const t0 = Date.now();
	while (Date.now() - t0 < COLUMN_LOAD_WAIT_MS + 5000) {
		const ph = await R(p, (reel) => window.__reindeer.roadBoard().features.columns.find((x) => x.reel === reel && x.phase !== 'leave')?.phase ?? null, reel);
		if (ph !== 'wait') return ph !== null;
		await sleep(150);
	}
	return false;
}
/** every column still waiting for its pictures, in real time (the pairs' five columns) */
async function waitAllLoaded(p) {
	const t0 = Date.now();
	while (Date.now() - t0 < COLUMN_LOAD_WAIT_MS + 5000) {
		const waiting = await R(p, () => window.__reindeer.roadBoard().features.columns.some((x) => x.phase === 'wait'));
		if (!waiting) return true;
		await sleep(150);
	}
	return false;
}
const stepTo = async (p, reel, until, max = 600) => {
	for (let i = 0; i < max; i++) {
		const st = await R(p, COLUMN_STATE, reel);
		if (st && until(st)) return st;
		await R(p, (ms) => window.__reindeer.step(ms, 1), FRAME);
	}
	return R(p, COLUMN_STATE, reel);
};
/** start the win clip on these reels (its pictures load on first use: asked again until it plays, real time running) */
const startWin = async (p, reels) => {
	for (let i = 0; i < 60; i++) {
		const ok = await R(p, (reels) => {
			const F = window.__reindeer.roadBoard().features;
			F.winColumns(reels);
			return reels.every((r) => F.columns.find((c) => c.reel === r && c.phase !== 'leave')?.phase === 'win');
		}, reels);
		if (ok) break;
		await R(p, () => window.__reindeer.clock(0));
		await sleep(150);
	}
};
const clearColumns = (p) =>
	R(p, () => {
		const h = window.__reindeer;
		const F = h.roadBoard().features;
		for (const c of [...F.columns]) F.removeColumn(c.reel, true);
		h.clock(1);
	});

// ---- THE CLEAN RECTANGLE (2026-11-17, Corey: "There shouldn't be visible lines on the top and bottom of the right side of the
// columns, it should draw as a rectangle"): the frame's parts in CSS px, from its quads as drawn
const FRAME_GEO = (reel) => {
	const F = window.__reindeer.roadBoard().features;
	const c = F.columns.find((x) => x.reel === reel && x.phase !== 'leave');
	if (!c) return null;
	const cv = document.querySelector('canvas').getBoundingClientRect();
	const top = c.box.outer[0];
	const b = top.getBounds();
	const k = b.width / top.width;
	const parts = c.box.parts();
	const ob = c.box.outer.map((q) => q.getBounds());
	const X0 = cv.x + ob[2].x;
	const Y0 = cv.y + ob[0].y;
	const X1 = cv.x + ob[3].x + ob[3].width;
	const Y1 = cv.y + ob[1].y + ob[1].height;
	return { X0, Y0, X1, Y1, e: window.__reindeer.tune.redBox.edge * k, t: parts.sides[2].w * k, k };
};
const { PNG } = require('playwright-core/lib/utilsBundle');
/** the frame's center lines (each band's red, corner to corner) and its inner dark lines, read from a screenshot: the
 *  samples that are not red (bands) or not dark (inner lines) */
function frameLines(png, G, dpr) {
	const px = (x, y) => {
		const X = Math.min(png.width - 1, Math.max(0, Math.round(x * dpr - 0.5)));
		const Y = Math.min(png.height - 1, Math.max(0, Math.round(y * dpr - 0.5)));
		const i = (Y * png.width + X) * 4;
		return [png.data[i], png.data[i + 1], png.data[i + 2]];
	};
	const red = ([r, g, b]) => r >= 170 && g <= 80 && b <= 100;
	const dark = ([r, g, b]) => r < 120 && r + g + b < 260;
	const { X0, Y0, X1, Y1, e, t } = G;
	const trim = Math.max(1 / dpr, e * 0.5);
	const line = (x0, y0, x1, y1, ok) => {
		const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) * dpr));
		let bad = 0;
		const where = [];
		for (let i = 0; i <= n; i++) {
			const x = x0 + ((x1 - x0) * i) / n;
			const y = y0 + ((y1 - y0) * i) / n;
			if (!ok(px(x, y))) {
				bad += 1;
				if (where.length < 4) where.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10, px(x, y).join('/')]);
			}
		}
		return { bad, n: n + 1, where };
	};
	const out = {
		top: line(X0 + e + trim, Y0 + e + t / 2, X1 - e - trim, Y0 + e + t / 2, red),
		bottom: line(X0 + e + trim, Y1 - e - t / 2, X1 - e - trim, Y1 - e - t / 2, red),
		left: line(X0 + e + t / 2, Y0 + e + trim, X0 + e + t / 2, Y1 - e - trim, red),
		right: line(X1 - e - t / 2, Y0 + e + trim, X1 - e - t / 2, Y1 - e - trim, red),
	};
	// the inner dark lines, where they are at least 1.5 device px thick (thinner, the screen blends them)
	if (e * dpr >= 1.5) {
		const m = e * 0.5;
		out.innerTop = line(X0 + e + t + m, Y0 + e + t + m, X1 - e - t - m, Y0 + e + t + m, dark);
		out.innerBottom = line(X0 + e + t + m, Y1 - e - t - m, X1 - e - t - m, Y1 - e - t - m, dark);
		out.innerLeft = line(X0 + e + t + m, Y0 + e + t + m, X0 + e + t + m, Y1 - e - t - m, dark);
		out.innerRight = line(X1 - e - t - m, Y0 + e + t + m, X1 - e - t - m, Y1 - e - t - m, dark);
	}
	return out;
}

const LAYOUTS = [
	['santa', 'reindeer', 'grandma', 'santa', 'grandma'],
	['reindeer', 'santa', 'reindeer', 'grandma', 'reindeer'],
	['grandma', 'grandma', 'reindeer', 'reindeer', 'santa'],
	['santa', 'santa', 'grandma', 'grandma', 'santa'],
];
const MULTS = [15, 3, 5, 10, 40];
/** the CSS px pixels of a region that differ (by over 10 levels) between two screenshots, the region's size */
const regionDiff = (a, b, r, dpr) => {
	let n = 0;
	let total = 0;
	for (let y = Math.max(0, Math.floor(r.y * dpr)); y < Math.min(a.height, Math.ceil((r.y + r.h) * dpr)); y++)
		for (let x = Math.max(0, Math.floor(r.x * dpr)); x < Math.min(a.width, Math.ceil((r.x + r.w) * dpr)); x++) {
			const i = (y * a.width + x) * 4;
			total += 1;
			if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 30) n += 1;
		}
	return { n, total };
};
const allPhase = (p, phase, minFrame = -1) =>
	R(p, ({ phase, minFrame }) => {
		const F = window.__reindeer.roadBoard().features;
		const cs = F.columns.filter((c) => c.phase !== 'leave');
		return cs.length === 5 && cs.every((c) => c.phase === phase && c.frame >= minFrame);
	}, { phase, minFrame });
const browser = await chromium.launch({ args: ['--mute-audio'] });
const result = {};
try {
	for (const S of SIZES) {
		for (const dpr of DPRS) {
			const tag = `${S.name} ${S.vp.width}x${S.vp.height} @${dpr}x`;
			const { ctx, p, errs } = await boot(browser, S, dpr);
			// the pictures in first (each tier's clips load on first use), then the frozen runs
			for (const tier of TIERS) {
				await R(p, ({ tier }) => window.__reindeer.roadBoard().features.columnWild(1, tier, 5, false, null), { tier });
				for (let i = 0; i < 80 && !(await R(p, () => window.__reindeer.roadBoard().features.columns.some((c) => c.phase === 'idle'))); i++) await sleep(150);
				await clearColumns(p);
				await sleep(600);
			}
			// THE EDGES: reel 2 (a neighbor each side), santa (its entrance cloud reaches furthest)
			const reel = 2;
			const moments = [
				['grow end', (st) => st.phase === 'grow' && st.cloud && st.cloud.y1 - st.cloud.y > 600],
				['entrance cloud', (st) => st.phase === 'enter' && st.enterCloud && st.frame >= 3],
				['standing', (st) => st.phase === 'idle'],
			];
			const edgesLoaded = PART('edges') ? await startColumn(p, reel, 'santa') : false;
			if (PART('edges') && !edgesLoaded) check(false, `${tag}: the santa column never left its wait for its entrance pictures in ${COLUMN_LOAD_WAIT_MS / 1000} s: the edge and rectangle checks are skipped`);
			for (const [name, until] of PART('edges') && edgesLoaded ? moments : []) {
				const st = await stepTo(p, reel, until);
				const reached = !!st && until(st);
				check(reached, `${tag}: the santa column reached "${name}" (${st?.phase} frame ${st?.frame})`);
				// (a moment not reached is not measured: nothing of its checks runs on a frame that is not that moment)
				if (!reached) continue;
				// standing: the character hidden in both (only the clouds are judged here; the right overlap is below)
				if (name === 'standing') await R(p, (reel) => (window.__reindeer.roadBoard().features.columns.find((x) => x.reel === reel).body.renderable = false), reel);
				const a = await shot(p);
				await setInside(p, reel, false);
				const b = await shot(p);
				await setInside(p, reel, true);
				const diff = await R(p, STRIP_DIFF, { a, b, box: st.box, dpr, px: Math.max(2, dpr * 2), gap: 0 });
				const pale = Object.entries(diff).filter(([, d]) => d.pale > 0);
				// (2026-11-17) a pale strip keeps its own evidence: the two screenshots compared and the state, so a host that
				// sees it (Linux headless, scene pass 9: desktop @3x grow end) can be checked against one that does not
				if (pale.length && OUT) {
					const base = join(OUT, `pale_${S.name}_${dpr}x_${name.replace(' ', '_')}`);
					writeFileSync(`${base}_A.png`, Buffer.from(a, 'base64'));
					writeFileSync(`${base}_B.png`, Buffer.from(b, 'base64'));
					writeFileSync(`${base}.json`, JSON.stringify({ dpr, st, diff }, null, 1));
				}
				// THE CLEAN RECTANGLE: the frame alone (its clouds and character not drawn), each band's red unbroken corner to
				// corner and its inner dark line unbroken (no stray line or notch on any side)
				if (name !== 'entrance cloud') {
					const G = await R(p, FRAME_GEO, reel);
					const lines = frameLines(PNG.sync.read(Buffer.from(b, 'base64')), G, dpr);
					const badSides = Object.entries(lines).filter(([, l]) => l.bad > 0);
					check(!!G && badSides.length === 0, `${tag}: ${name}: the frame draws as one clean rectangle (${Object.entries(lines).map(([k, l]) => `${k} ${l.bad}/${l.n}`).join(', ')} samples off)`, Object.fromEntries(badSides.map(([k, l]) => [k, l.where])));
				}
				check(pale.length === 0, `${tag}: ${name}: nothing pale just outside the frame on any side (${Object.entries(diff).map(([k, d]) => `${k} ${d.pale}/${d.px} max ${d.max}`).join(', ')})`, { cloud: st.cloud, body: st.body, roadOuter: st.roadOuter });
				if (st.cloud) check(st.cloud.x >= st.roadOuter.x - 0.01 && st.cloud.x1 <= st.roadOuter.x1 + 0.01, `${tag}: ${name}: the moving cloud inside the frame's outer edge (road x ${r1(st.cloud.x)} to ${r1(st.cloud.x1)}, frame ${r1(st.roadOuter.x)} to ${r1(st.roadOuter.x1)})`);
				if (st.backdrop) check(st.backdrop.x >= st.roadOuter.x - 0.01 && st.backdrop.x1 <= st.roadOuter.x1 + 0.01, `${tag}: ${name}: the still cloud inside the frame's outer edge`);
				if (name === 'entrance cloud') check(!!st.body && !st.over && st.body.x1 <= st.roadOuter.x1 + 0.01 && st.body.x >= st.roadOuter.x - 0.01, `${tag}: entrance cloud frames: the clip (cloud and all) is cropped on all four sides (road x ${r1(st.body?.x)} to ${r1(st.body?.x1)})`);
				if (name === 'standing') await R(p, (reel) => (window.__reindeer.roadBoard().features.columns.find((x) => x.reel === reel).body.renderable = true), reel);
				if (OUT && dpr === 2 && S.name !== 'short') {
					for (const side of ['left', 'right']) {
						const bx = st.box;
						const w = 24;
						const clip = { x: side === 'left' ? bx.x - w / 2 : bx.x + bx.w - w / 2, y: bx.y + bx.h * 0.3, width: w, height: 60 };
						await p.screenshot({ path: join(OUT, `edge_${S.name}_${name.replace(' ', '_')}_${side}.png`), clip });
					}
				}
			}
			await R(p, () => window.__reindeer.clock(1));
			await clearColumns(p);
			await sleep(500);

			// THE ARRIVAL NEVER SHOWS AN EMPTY COLUMN (2026-11-17, Corey: "the video disappears in one of them, which looks
			// like a big glitch"): each character's column from a struck cell, at normal speed, turbo 1 and turbo 2, stepped one
			// 60 Hz frame at a time from the first frame of its moving cloud until it stands: on every frame the inside is
			// covered (the moving cloud or the still cloud drawn; the entrance's picture lies over them)
			if (PART('arrival') && dpr === 1 && S.name !== 'short') {
				let reveals = 0;
				let blanks = 0;
				for (const level of [0, 1, 2]) {
					for (const tier of TIERS) {
						await R(p, (level) => window.__reindeer.turbo(level), level);
						// (the tier's entrance pictures in first, as a real round has them from the book's arrival: a helper column
						// of the tier on reel 5 waits for them in real time; the measured column then never waits on a load)
						await R(p, (tier) => {
							window.__reindeer.clock(0);
							void window.__reindeer.roadBoard().features.columnWild(4, tier, 5, false, null);
						}, tier);
						for (let i = 0; i < 100; i++) {
							const ph = await R(p, () => window.__reindeer.roadBoard().features.columns.find((x) => x.reel === 4 && x.phase !== 'leave')?.phase ?? null);
							if (ph !== 'wait') break;
							await sleep(150);
						}
						await startColumn(p, reel, tier);
						let seenCloud = false;
						const empty = [];
						let frames = 0;
						for (let i = 0; i < 900; i++) {
							const st = await R(p, (reel) => {
								const c = window.__reindeer.roadBoard().features.columns.find((x) => x.reel === reel && x.phase !== 'leave');
								if (!c) return null;
								const on = (q) => q.visible && q.renderable && q.alpha > 0 && q.width > 0.5 && q.height > 0.5;
								return { phase: c.phase, frame: c.frame, cloud: on(c.cloud), backdrop: on(c.backdrop), body: on(c.body), back: c.back.renderable && c.back.alpha > 0 };
							}, reel);
							if (!st) break;
							if (st.cloud) seenCloud = true;
							if (seenCloud) {
								frames += 1;
								if (!(st.back && (st.cloud || st.backdrop))) empty.push({ i, ...st });
							}
							if (st.phase === 'idle') break;
							await R(p, (ms) => window.__reindeer.step(ms, 1), FRAME);
						}
						reveals += 1;
						if (empty.length) blanks += 1;
						check(seenCloud && empty.length === 0, `${tag}: ${tier} at turbo ${level}: the column's inside covered on all ${frames} frames from its moving cloud to standing (${empty.length} empty)`, empty.slice(0, 3));
						await R(p, () => window.__reindeer.clock(1));
						await clearColumns(p);
						await sleep(300);
					}
				}
				await R(p, () => window.__reindeer.turbo(0));
				console.log(`  ${tag}: arrivals with an empty frame: ${blanks} of ${reveals}`);
			}

			// THE RIGHT BORDER, per character, idle and win (desktop and portrait at 2x / 3x only: the rule is the same)
			if (dpr === (S.phone ? 3 : 2) && S.name !== 'short') {
				for (const tier of PART('right') ? TIERS : []) {
					if (!(await startColumn(p, reel, tier))) {
						check(false, `${tag}: the ${tier} column never left its wait for its pictures in ${COLUMN_LOAD_WAIT_MS / 1000} s: its right border checks are skipped`);
						await R(p, () => window.__reindeer.clock(1));
						await clearColumns(p);
						continue;
					}
					const idle = await stepTo(p, reel, (st) => st.phase === 'idle', 900);
					for (const phase of ['idle', 'win']) {
						let st = idle;
						if (phase === 'win') {
							await startWin(p, [reel]);
							// into the win clip a way (its widest moment is the caller's to see in the clip)
							st = await stepTo(p, reel, (s) => s.phase === 'win' && s.frame >= 8, 300);
						}
						const ok = !!st && st.phase === phase && st.body;
						check(ok, `${tag}: ${tier} ${phase}: drawn (${st?.phase})`);
						if (!ok) continue;
						const E = st.edge;
						const cropL = st.body.x >= st.roadOuter.x - 0.01;
						const cropT = st.body.y >= st.roadOuter.y - 0.01;
						const cropB = st.body.y1 <= st.roadOuter.y1 + 0.01;
						const past = st.body.x1 > st.roadOuter.x1 + 0.01;
						check(st.over && cropL && cropT && cropB, `${tag}: ${tier} ${phase}: cropped at the left, top and bottom inside the frame (body road ${r1(st.body.x)}, ${r1(st.body.y)} to ${r1(st.body.x1)}, ${r1(st.body.y1)}; frame ${r1(st.roadOuter.x)}, ${r1(st.roadOuter.y)} to ${r1(st.roadOuter.x1)}, ${r1(st.roadOuter.y1)})`);
						check(past, `${tag}: ${tier} ${phase}: not cropped on the right (its picture reaches ${r1(st.body.x1 - st.roadOuter.x1)} road px past the frame)`);
						check(st.layers.rightBand >= 0 && st.layers.rightBand < st.layers.body && st.layers.leftBand > st.layers.body && st.layers.rails > st.layers.body, `${tag}: ${tier} ${phase}: the right band under its character, the left band and the rails over it (draw order ${JSON.stringify(st.layers)})`);
						if (OUT) {
							const bx = st.box;
							const k = bx.w / 250;
							const pad = 34 * k;
							const sides = {
								left: { x: bx.x - pad, y: bx.y + bx.h * 0.25, width: 2 * pad, height: bx.h * 0.5 },
								right: { x: bx.x + bx.w - pad, y: bx.y + bx.h * 0.15, width: 2 * pad + 70 * k, height: bx.h * 0.7 },
								top: { x: bx.x, y: bx.y - pad, width: bx.w, height: 2 * pad + 40 * k },
								bottom: { x: bx.x, y: bx.y + bx.h - pad - 40 * k, width: bx.w, height: 2 * pad + 40 * k },
							};
							for (const [side, clip] of Object.entries(sides)) await p.screenshot({ path: join(OUT, `side_${S.name}_${tier}_${phase}_${side}.png`), clip: { x: Math.max(0, clip.x), y: Math.max(0, clip.y), width: clip.width, height: clip.height } });
						}
					}
					await R(p, () => window.__reindeer.clock(1));
					await clearColumns(p);
					await sleep(400);
				}
				if (PART('right')) {
				// A HELD COLUMN NEXT TO A NEIGHBOR: grandma on reel 1 (her win reaches furthest right) beside a santa column on
				// reel 2, and the same grandma beside plain symbols (reel 3 has none), in their win: the neighbor's number and
				// frame stay over her
				await startColumn(p, 2, 'santa', 20);
				await stepTo(p, 2, (st) => st.phase === 'idle', 900);
				await startColumn(p, 1, 'grandma', 40);
				await stepTo(p, 1, (st) => st.phase === 'idle', 900);
				await startWin(p, [1, 2]);
				const g = await stepTo(p, 1, (s) => s.phase === 'win' && s.frame >= 10, 300);
				const n2 = await R(p, COLUMN_STATE, 2);
				const order = { grandma: g?.layers, santa: n2?.layers };
				check(!!g && !!n2 && n2.layers.number > g.layers.body && n2.layers.rails > g.layers.body && g.layers.body > n2.layers.leftBand && g.layers.body > n2.layers.body, `${tag}: grandma (reel 2) next to a santa column (reel 3): she draws over its left band and its character, its number and its rails over her (draw order ${JSON.stringify(order)})`);
				if (OUT) {
					const bx = g.box;
					await p.screenshot({ path: join(OUT, `neighbor_column_${S.name}.png`), clip: { x: Math.max(0, bx.x - bx.w * 0.1), y: Math.max(0, bx.y - 10), width: bx.w * 2.3, height: bx.h + 20 } });
				}
				await R(p, () => window.__reindeer.clock(1));
				await clearColumns(p);
				await sleep(500);
				await startColumn(p, 2, 'grandma', 40);
				await stepTo(p, 2, (st) => st.phase === 'idle', 900);
				await startWin(p, [2]);
				const g2 = await stepTo(p, 2, (s) => s.phase === 'win' && s.frame >= 10, 300);
				if (OUT && g2) {
					const bx = g2.box;
					await p.screenshot({ path: join(OUT, `neighbor_symbols_${S.name}.png`), clip: { x: Math.max(0, bx.x - bx.w * 0.1), y: Math.max(0, bx.y - 10), width: bx.w * 2.3, height: bx.h + 20 } });
				}
				await R(p, () => window.__reindeer.clock(1));
				await clearColumns(p);
				await sleep(500);
				}

				// LEFT TO RIGHT (2026-11-17, Corey: "the characters spill over should be left to right, so Santa's Elbow here
				// should be above the left hand border from the Reindeer column"): five columns side by side in four layouts
				// that hold every pair of the three characters at every reel; in their idle and their win (and one grow next to
				// a standing neighbor), each character draws over its right-hand neighbor's left band and character, under its
				// rails and its number; the pixels of the neighbor's left band that change when the left character is hidden
				// are its spill drawn over the band
				if (PART('pairs')) await pairs(p, S, dpr, tag);

				// CLIPS: an entrance and a win per character, frames at 60 Hz clock steps
				if (OUT && VIDEO) {
					for (const tier of VIDEO_TIERS) {
						const dir = join(OUT, `frames_${tier}_${S.name}`);
						mkdirSync(dir, { recursive: true });
						const L0 = await R(p, () => {
							const L = window.__reindeer.boardLayout();
							return L.css;
						});
						const k = L0.pitch / 250;
						const clip = { x: Math.max(0, L0.x + 1 * L0.pitch - 40 * k), y: Math.max(0, L0.y - 40 * k), width: 3 * L0.pitch + 80 * k, height: Math.min(S.vp.height, 780 * k) };
						await startColumn(p, 2, tier);
						let n = 0;
						for (let i = 0; i < 400; i++) {
							const st = await R(p, COLUMN_STATE, 2);
							await p.screenshot({ path: join(dir, `f${String(n++).padStart(4, '0')}.png`), clip });
							if (st?.phase === 'idle') break;
							await R(p, (ms) => window.__reindeer.step(ms, 1), FRAME);
						}
						for (let i = 0; i < 20; i++) {
							await R(p, (ms) => window.__reindeer.step(ms, 1), FRAME);
							await p.screenshot({ path: join(dir, `f${String(n++).padStart(4, '0')}.png`), clip });
						}
						await startWin(p, [2]);
						for (let i = 0; i < 400; i++) {
							await R(p, (ms) => window.__reindeer.step(ms, 1), FRAME);
							await p.screenshot({ path: join(dir, `f${String(n++).padStart(4, '0')}.png`), clip });
							const st = await R(p, COLUMN_STATE, 2);
							if (st?.phase === 'idle' && i > 10) break;
						}
						await R(p, () => window.__reindeer.clock(1));
						await clearColumns(p);
						await sleep(400);
					}
				}
			}
			check(errs.length === 0, `${tag}: no page errors, no console errors`, errs);
			await ctx.close();
		}
	}
} finally {
	await browser.close();
}
async function pairs(p, S, dpr, tag) {
	const summary = [];
	for (const [li, tiers] of LAYOUTS.entries()) {
		const sticky = li % 2 === 1;
		await R(p, ({ tiers, sticky, MULTS }) => {
			const h = window.__reindeer;
			const F = h.roadBoard().features;
			h.clock(0);
			tiers.forEach((t, r) => void F.columnWild(r, t, MULTS[r], sticky, null));
		}, { tiers, sticky, MULTS });
		await waitAllLoaded(p);
		for (let i = 0; i < 1200 && !(await allPhase(p, 'idle')); i++) await R(p, (ms) => window.__reindeer.step(ms, 1), FRAME);
		const label = `${tag}: layout ${tiers.join(' ')}${sticky ? ' (sticky)' : ''}`;
		check(await allPhase(p, 'idle'), `${label}: all five stand`);
		for (const phase of ['idle', 'win']) {
			if (phase === 'win') {
				await startWin(p, [0, 1, 2, 3, 4]);
				for (let i = 0; i < 300 && !(await allPhase(p, 'win', 8)); i++) await R(p, (ms) => window.__reindeer.step(ms, 1), FRAME);
				if (!(await allPhase(p, 'win', 8))) {
					check(false, `${label}: all five in their win`);
					continue;
				}
			}
			const st = [];
			for (let r = 0; r < 5; r++) st.push(await R(p, COLUMN_STATE, r));
			const a = PNG.sync.read(await p.screenshot());
			for (let r = 0; r < 4; r++) {
				const L = st[r];
				const N = st[r + 1];
				const ok = L.over && N.over && L.layers.body > N.layers.leftBand && L.layers.body > N.layers.body && N.layers.rails > L.layers.body && N.layers.number > L.layers.body;
				// the spill: the neighbor's left band (between its rails), and its inside, with the left character hidden
				const G = await R(p, FRAME_GEO, r + 1);
				await R(p, (r) => (window.__reindeer.roadBoard().features.columns.find((x) => x.reel === r && x.phase !== 'leave').body.renderable = false), r);
				const b = PNG.sync.read(await p.screenshot());
				await R(p, (r) => (window.__reindeer.roadBoard().features.columns.find((x) => x.reel === r && x.phase !== 'leave').body.renderable = true), r);
				const band = { x: G.X0, y: G.Y0 + G.e + G.t, w: 2 * G.e + G.t, h: G.Y1 - G.Y0 - 2 * (G.e + G.t) };
				const inside = { x: G.X0 + 2 * G.e + G.t, y: band.y, w: G.X1 - G.X0 - 2 * (2 * G.e + G.t), h: band.h };
				const face = { ...inside, h: inside.h * 0.45 };
				const dBand = regionDiff(a, b, band, dpr);
				const dInside = regionDiff(a, b, inside, dpr);
				const dFace = regionDiff(a, b, face, dpr);
				const reach = r1(L.body.x1 - N.roadOuter.x);
				summary.push({ layout: li, phase, reel: r, left: tiers[r], right: tiers[r + 1], reach, band: dBand.n, inside: dInside.n, face: dFace.n });
				check(ok, `${label} ${phase}: ${tiers[r]} (reel ${r + 1}) over ${tiers[r + 1]}'s left band and character, under its rails and number (its picture reaches ${reach} road px into the neighbor's frame; ${dBand.n} band px, ${dInside.n} inside px, ${dFace.n} in the top 45% drawn by it)`, { L: L.layers, N: N.layers });
			}
			if (OUT && li === 0 && phase === 'idle') {
				const bx = st[0].box;
				await p.screenshot({ path: join(OUT, `pairs_${S.name}_layout${li}_${phase}.png`), clip: { x: Math.max(0, bx.x - 10), y: Math.max(0, bx.y - 10), width: Math.min(S.vp.width - Math.max(0, bx.x - 10), st[4].box.x + st[4].box.w - bx.x + 20), height: bx.h + 20 } });
			}
		}
		if (li === 0) {
			// a grow next to a standing neighbor: santa stands on reel 1, a reindeer column grows on reel 2 from a struck cell
			await R(p, () => window.__reindeer.clock(1));
			await R(p, () => {
				const F = window.__reindeer.roadBoard().features;
				F.removeColumn(1, true);
			});
			await startColumn(p, 1, 'reindeer');
			const gr = await stepTo(p, 1, (x) => x.phase === 'grow', 600);
			const L = await R(p, COLUMN_STATE, 0);
			check(!!gr && gr.phase === 'grow' && L.over && L.layers.body > gr.layers.leftBand && gr.layers.rails > L.layers.body, `${tag}: santa standing on reel 1 draws over the left band of the column growing on reel 2 (draw order ${JSON.stringify({ L: L.layers, N: gr?.layers })})`);
		}
		await R(p, () => window.__reindeer.clock(1));
		await clearColumns(p);
		await sleep(500);
	}
	const seen = summary.filter((x) => x.band > 0);
	check(seen.length > 0 && seen.some((x) => x.left === 'santa' && x.phase === 'idle'), `${tag}: a spill is drawn over the neighbor's left band (${seen.length} of ${summary.length} pairs and moments, Santa's idle among them: ${seen.map((x) => `${x.phase} ${x.left}>${x.right} r${x.reel + 1} ${x.band} px`).join(', ')})`);
	result[`pairs_${S.name}_${dpr}`] = summary;
	console.log(`  ${tag} spill summary: ${summary.map((x) => `${x.phase} ${x.left}>${x.right} r${x.reel + 1} reach ${x.reach} band ${x.band} inside ${x.inside} face ${x.face}`).join('; ')}`);
}

function r1(v) {
	return v === null || v === undefined ? '' : Math.round(v * 10) / 10;
}
console.log(`\n${pass} passed, ${fail} failed${fails.length ? '\n  ' + fails.join('\n  ') : ''}`);
if (OUT) writeFileSync(join(OUT, 'column_frame_probe.json'), JSON.stringify({ pass, fail, fails, ...result }, null, 1));
process.exit(fail ? 1 : 0);
