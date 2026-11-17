// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
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
	await R(p, (b) => {
		const h = window.__reindeer;
		h.clock(1);
		h.setBoard(b);
	}, BOARD);
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
	// the layers: where the right band and the body sit
	const rightRoot = c.box.rightRoot ?? null;
	const layerOf = (o) => (o && o.parent ? F.layer.children.indexOf(o.parent) : -1);
	return {
		phase: c.phase,
		frame: c.frame,
		enterCloud: c.enterCloud,
		over: c.body.parent === F.bodyLayer,
		box,
		roadOuter,
		body,
		cloud,
		backdrop,
		band: band.map((b) => ({ x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, w: Math.round(b.w * 10) / 10, h: Math.round(b.h * 10) / 10 })),
		layers: { body: c.body.parent === F.bodyLayer ? F.layer.children.indexOf(F.bodyLayer) : -1, rightBand: rightRoot ? layerOf(rightRoot) : layerOf(c.box.root), otherBands: layerOf(c.box.root) },
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
			await startColumn(p, reel, 'santa');
			for (const [name, until] of moments) {
				const st = await stepTo(p, reel, until);
				check(!!st && until(st), `${tag}: the santa column reached "${name}" (${st?.phase} frame ${st?.frame})`);
				if (!st) continue;
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

			// THE RIGHT BORDER, per character, idle and win (desktop and portrait at 2x / 3x only: the rule is the same)
			if (dpr === (S.phone ? 3 : 2) && S.name !== 'short') {
				for (const tier of TIERS) {
					await startColumn(p, reel, tier);
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
						check(st.layers.rightBand >= 0 && st.layers.rightBand < st.layers.body && st.layers.otherBands > st.layers.body, `${tag}: ${tier} ${phase}: the right band under the characters, the other three over them (layers ${JSON.stringify(st.layers)})`);
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
				const order = await R(p, () => {
					const F = window.__reindeer.roadBoard().features;
					const L = F.layer.children;
					return { numbers: L.indexOf(F.numberLayer), bodies: L.indexOf(F.bodyLayer), boxes: L.indexOf(F.boxLayer) };
				});
				check(!!g && !!n2 && order.numbers > order.bodies && order.boxes > order.bodies, `${tag}: grandma next to a santa column: every number and the neighbor's left, top and bottom bands over her (layers ${JSON.stringify(order)})`);
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
function r1(v) {
	return v === null || v === undefined ? '' : Math.round(v * 10) / 10;
}
console.log(`\n${pass} passed, ${fail} failed${fails.length ? '\n  ' + fails.join('\n  ') : ''}`);
if (OUT) writeFileSync(join(OUT, 'column_frame_probe.json'), JSON.stringify({ pass, fail, fails, ...result }, null, 1));
process.exit(fail ? 1 : 0);
