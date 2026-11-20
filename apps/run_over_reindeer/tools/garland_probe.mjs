// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{game/road/garland.ts,game/road/roadFeatures.ts,game/garlandSpec.ts,components/Board.svelte};
// WATCHES: ; __reindeer.atRest, __reindeer.board, __reindeer.clock, __reindeer.hud, __reindeer.roadBoard, __reindeer.setBoard,
// WATCHES: ; __reindeer.step, __reindeer.tune, __reindeer.turbo, __reindeer.wildFrames, __reindeer.garlandMemory, __reindeer.wildMult,
// WATCHES: ; WILD_FRAME, WILD_MULT.place, WILD_MULT.maxValue, COLUMN.growMs, COLUMN.impactMs, COLUMN.loadWaitMs, .landing
// THE WILD FRAMES' GARLAND PROBE (Corey 2026-11-19: "I'd go for Garland (F), but I'd go Red for Santa", "just swap the
// garland on santa and grandma"; game/road/garland.ts, constants WILD_FRAME, tools/build_garland.py) and THE ENTRANCE
// WHILE THE BOX GROWS (Corey 2026-11-19: "Is it possible to have the video alreday playing within the border boundaries
// while it grows?"; game/road/roadFeatures.ts growEntrance). At 1440x900 and 390x844 (the phone tier), device scale 1
// and 3 (DPRS):
//   - THE ATLAS: on the GPU, the device tier's sheet, its weight said
//   - THE LOOK PER CHARACTER: each column's frame in its character's set (WILD_FRAME.look: Reindeer silver with red
//     baubles, Santa red with gold, Grandma green with gold), the single Grandma Wild cell's and a marked car's in theirs
//     (WILD_FRAME.cell, mark); read from the frames as laid AND from the screen (the band's mean color, the baubles')
//   - THE BAND: a column's and a cell's thickness (WILD_FRAME.band), in CSS px on this screen
//   - THE NUMBER CLEAR OF THE BAUBLES: at each character's largest real value (WILD_MULT.maxValue, 2026-11-19: 8x, 30x,
//     75x; it fills the frame's inside width) no letter of a column's number overlaps a bauble
//   - THE GROW: each character's column from a struck cell, stepped one 60 Hz frame at a time: at several heights of
//     the grow the garland covers every band and corner with no seam (the frame alone against no frame); the
//     entrance's frame index advances DURING the grow, is the frame for the time since the grow began on every step
//     (none skipped, none repeated past its time) and carries on across the hand-over to the entrance; the moving cloud
//     stays inside the box as it grows; the baubles drop once the box is whole
//   - THE REVEAL'S LENGTH: from the grow's start to standing, board ms, at turbo 0, 1 and 2: the entrance's own length
//     (it started with the grow), not grow + entrance any more; real ms at each turbo's board rate
//   - DRAW CALLS: the opening board's three columns at rest, WebGL draw calls per frame with their frames drawn and not
//   - no page errors
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [ONLY=desktop,phone] [DPRS=1,3] \
//     [OUT=<dir>] node tools/garland_probe.mjs
// Uses the dev server that is already running (it never starts one). One headless browser, muted, closed at the end.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PNG } = require('playwright-core/lib/utilsBundle');

const APP = process.env.APP || 'http://localhost:3014';
const OUT = process.env.OUT || '';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const DPRS = (process.env.DPRS || '1,3').split(',').map(Number);
if (OUT) mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FRAME = 1000 / 60;
const TIERS = ['reindeer', 'santa', 'grandma'];
/** the grow runs: GROW_TIERS=reindeer and LEVELS=0 narrow them (an owning case on its own) */
const GROW_TIERS = (process.env.GROW_TIERS || TIERS.join(',')).split(',').filter(Boolean);
const LEVELS = (process.env.LEVELS || '0,1,2').split(',').map(Number);
const SIZES = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, phone: false },
	{ name: 'phone', vp: { width: 390, height: 844 }, phone: true },
].filter((s) => !ONLY.length || ONLY.includes(s.name));
const BOARD = [['L4', 'H3', 'L2', 'H2'], ['L3', 'L1', 'L4', 'L5'], ['L3', 'L5', 'L1', 'L4'], ['H4', 'L4', 'L2', 'L4'], ['H3', 'L1', 'L4', 'H1']];

let pass = 0;
let fail = 0;
const check = (ok, msg, detail) => {
	if (ok) pass += 1;
	else fail += 1;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail).slice(0, 700) : ''}`);
};
const R = (p, fn, arg) => p.evaluate(fn, arg);
const shot = async (p) => PNG.sync.read(await p.screenshot());

async function boot(browser, S, dpr) {
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: dpr, isMobile: S.phone, hasTouch: S.phone });
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text().slice(0, 200)));
	await p.goto(`${APP}/?lang=en&sessionID=garland${S.name}${dpr}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 200; i++) {
		const ok = await R(p, () => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && !document.querySelector('.landing'))).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	await R(p, (b) => {
		const h = window.__reindeer;
		h.setBoard(h.board());
		h.clock(1);
		h.setBoard(b);
		h.tune.column.loadWaitMs = 90000;
	}, BOARD);
	await sleep(800);
	// every tier's pictures in first (a real round has them from the book's arrival)
	for (const tier of TIERS) {
		await R(p, (tier) => window.__reindeer.roadBoard().features.columnWild(1, tier, 5, false, null), tier);
		for (let i = 0; i < 200 && !(await R(p, () => window.__reindeer.roadBoard().features.columns.some((c) => c.phase === 'idle'))); i++) await sleep(150);
		await clearAll(p);
	}
	return { ctx, p, errs };
}
const clearAll = async (p) => {
	await R(p, () => {
		window.__reindeer.clock(1);
		window.__reindeer.roadBoard().features.clearAll();
	});
	await sleep(500);
};
/** the frames as laid, in CSS px too (each frame's outer box through its own transform) */
const FRAMES = () => {
	const F = window.__reindeer.roadBoard().features;
	const cv = document.querySelector('canvas').getBoundingClientRect();
	const css = (box) => {
		const o = box.parts().outer;
		const a = box.root.toGlobal({ x: o.x, y: o.y });
		const b = box.root.toGlobal({ x: o.x + o.w, y: o.y + o.h });
		const k = (b.x - a.x) / o.w;
		return { X0: cv.x + a.x, Y0: cv.y + a.y, X1: cv.x + b.x, Y1: cv.y + b.y, k, T: box.parts().band * k };
	};
	const baubles = (box) => box.baubles.filter((b) => b.visible).map((b) => {
		const g = b.getBounds();
		// the ball's centre: 26 road px under the hook on the 51.9 road px picture (garlandSpec bauble ballY - hookY)
		const c = b.toGlobal({ x: 0, y: (26 / 51.875) * b.texture.frame.height });
		return { x: cv.x + g.x, y: cv.y + g.y, w: g.width, h: g.height, cx: cv.x + c.x, cy: cv.y + c.y };
	});
	return {
		columns: F.columns.filter((c) => c.phase !== 'leave').map((c) => ({ reel: c.reel, tier: c.tier, phase: c.phase, frame: c.frame, cloud: c.cloud.visible ? { y: c.cloud.y, y1: c.cloud.y + c.cloud.height } : null, ...c.box.parts(), css: css(c.box), bb: baubles(c.box) })),
		cells: F.clouds.filter((c) => c.leaving === null).map((c) => ({ cell: c.cell, ...c.box.parts(), css: css(c.box), bb: baubles(c.box) })),
		marks: F.marks.map((m) => ({ cell: m.cell, ...m.box.parts(), css: css(m.box), bb: baubles(m.box) })),
		want: { look: window.__reindeer.tune.wildFrame.look, cell: window.__reindeer.tune.wildFrame.cell, mark: window.__reindeer.tune.wildFrame.mark, band: window.__reindeer.tune.wildFrame.band },
	};
};
const at = (img, x, y, dpr) => {
	const X = Math.min(img.width - 1, Math.max(0, Math.round(x * dpr - 0.5)));
	const Y = Math.min(img.height - 1, Math.max(0, Math.round(y * dpr - 0.5)));
	const i = (Y * img.width + X) * 4;
	return [img.data[i], img.data[i + 1], img.data[i + 2]];
};
const differ = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 24;
/** the band covered (frame alone `a` against no frame `b`) at a quarter, half and three quarters of its depth along every
 *  straight run and round each corner at half its depth; a seam = all three depths uncovered at one place */
/** THE FRAME IN INK (2026-11-20, the probe host at 390 x 844 @1x): a phone pixel at 1x averages about four road px of
 *  tinsel, strands and dark core together, and on the silver Reindeer frame that average is a mid gray within 24 levels
 *  of the gray road or a pale lane mark under it (seen: frame 126,131,135 over road 128,128,130), so a covered sample read
 *  as a gap. A sample is covered when the frame drawn as it is OR the frame drawn all in black (every one of its sprites
 *  tinted 0x000000 for one screenshot) differs from the road under it: a pixel the frame really covers changes with the
 *  frame's color, a real gap (nothing of the frame there) reads the same as the road in both, so a gap is still caught. */
const setInk = (p, on) =>
	p.evaluate((on) => {
		const F = window.__reindeer.roadBoard().features;
		const saved = (window.__inkSaved ??= new Map());
		const walk = (o) => {
			if (!o) return;
			if (o.texture && 'tint' in o) {
				if (on) {
					if (!saved.has(o)) saved.set(o, o.tint);
					o.tint = 0x000000;
				} else if (saved.has(o)) {
					o.tint = saved.get(o);
					saved.delete(o);
				}
			}
			for (const ch of o.children ?? []) walk(ch);
		};
		for (const box of [...F.columns.map((c) => c.box), ...F.clouds.map((c) => c.box), ...F.marks.map((m) => m.box)]) for (const r of [box.root, box.rightRoot, box.leftRoot, box.fxRoot]) walk(r);
	}, on);
/** the samples that read uncovered in the last cover() calls (their place, the frame's pixel and the road's) */
const misses = [];
function cover(a, b, G, dpr, k = null) {
	const differ2 = (A, Bk, x, y) => differ(at(A, x, y, dpr), at(Bk, x, y, dpr)) || (!!k && differ(at(k, x, y, dpr), at(Bk, x, y, dpr)));
	const { X0, Y0, X1, Y1, T } = G;
	const out = {};
	const run = (name, x0, y0, x1, y1, nx, ny) => {
		const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) * dpr));
		let seams = 0;
		const miss = [0, 0, 0];
		const where = [];
		for (let i = 0; i <= n; i++) {
			const x = x0 + ((x1 - x0) * i) / n;
			const y = y0 + ((y1 - y0) * i) / n;
			const hit = [0.25, 0.5, 0.75].map((f) => differ2(a, b, x + nx * T * f, y + ny * T * f));
			hit.forEach((h, j) => {
				miss[j] += h ? 0 : 1;
				if (!h && misses.length < 12) misses.push({ run: name, depth: [0.25, 0.5, 0.75][j], x: Math.round((x + nx * T * [0.25, 0.5, 0.75][j]) * 10) / 10, y: Math.round((y + ny * T * [0.25, 0.5, 0.75][j]) * 10) / 10, frame: at(a, x + nx * T * [0.25, 0.5, 0.75][j], y + ny * T * [0.25, 0.5, 0.75][j], dpr), bare: at(b, x + nx * T * [0.25, 0.5, 0.75][j], y + ny * T * [0.25, 0.5, 0.75][j], dpr) });
			});
			if (!hit.some(Boolean)) {
				seams += 1;
				if (where.length < 4) where.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
			}
		}
		out[name] = { n: n + 1, seams, miss, where, bad: seams > 0 || miss.some((m) => m > 0.03 * (n + 1)) };
	};
	run('top', X0 + T, Y0, X1 - T, Y0, 0, 1);
	run('bottom', X0 + T, Y1, X1 - T, Y1, 0, -1);
	if (Y1 - Y0 > 2 * T + 2) {
		run('left', X0, Y0 + T, X0, Y1 - T, 1, 0);
		run('right', X1, Y0 + T, X1, Y1 - T, -1, 0);
	}
	[[X0 + T, Y0 + T, Math.PI, 1.5 * Math.PI], [X1 - T, Y0 + T, 1.5 * Math.PI, 2 * Math.PI], [X1 - T, Y1 - T, 0, 0.5 * Math.PI], [X0 + T, Y1 - T, 0.5 * Math.PI, Math.PI]].forEach(([cx, cy, a0, a1], i) => {
		const n = Math.max(4, Math.round(T * 0.8 * dpr));
		let miss = 0;
		for (let k = 0; k <= n; k++) {
			const q = a0 + ((a1 - a0) * k) / n;
			if (!differ2(a, b, cx + Math.cos(q) * T * 0.5, cy + Math.sin(q) * T * 0.5)) miss += 1;
		}
		out[`corner${i}`] = { n: n + 1, seams: miss, miss: [miss], where: [], bad: miss > 0 };
	});
	return out;
}
/** the mean color of the band's middle line where the frame covers the road (frame alone `a`, none `b`) */
function bandColor(a, b, G, dpr) {
	const { X0, Y0, X1, Y1, T } = G;
	const sum = [0, 0, 0];
	let n = 0;
	const take = (x, y) => {
		const c = at(a, x, y, dpr);
		if (!differ(c, at(b, x, y, dpr))) return;
		sum[0] += c[0];
		sum[1] += c[1];
		sum[2] += c[2];
		n += 1;
	};
	for (let x = X0 + T * 2; x < X1 - T * 2; x += 0.5) take(x, Y0 + T / 2);
	for (let y = Y0 + T * 2; y < Y1 - T * 2; y += 0.5) take(X0 + T / 2, y);
	return n ? sum.map((v) => Math.round(v / n)) : null;
}
const kindOf = (c) => {
	if (!c) return 'none';
	const [r, g, b] = c;
	if (r > g + 40 && r > b + 30) return 'red';
	if (g > r + 25 && g > b) return 'green';
	if (Math.max(r, g, b) - Math.min(r, g, b) < 45 && r + g + b > 240) return 'silver';
	return `other ${c.join(',')}`;
};
const ballKind = (c) => (c[0] > 150 && c[1] > 110 && c[2] < 110 ? 'gold' : c[0] > 120 && c[1] < 70 ? 'red' : `other ${c.join(',')}`);
const setFrames = (p, on) =>
	R(p, (on) => {
		const F = window.__reindeer.roadBoard().features;
		for (const box of [...F.columns.map((c) => c.box), ...F.clouds.map((c) => c.box), ...F.marks.map((m) => m.box)]) for (const r of [box.root, box.rightRoot, box.leftRoot, box.fxRoot]) if (r) r.renderable = on;
	}, on);
const setInsides = (p, on) =>
	R(p, (on) => {
		const F = window.__reindeer.roadBoard().features;
		for (const c of F.columns) {
			c.back.renderable = on;
			c.body.renderable = on;
			c.label.root.renderable = on;
		}
		for (const c of F.clouds) for (const ch of c.root.children) if (ch !== c.box.root) ch.renderable = on;
	}, on);

const summary = { sizes: {} };
const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
	for (const S of SIZES) {
		for (const dpr of DPRS) {
			const tag = `${S.name} ${S.vp.width}x${S.vp.height} @${dpr}x`;
			const { ctx, p, errs } = await boot(browser, S, dpr);
			const sum = (summary.sizes[tag] = {});
			// THE ATLAS
			const mem = await R(p, () => window.__reindeer.garlandMemory());
			check(mem.loaded && mem.size === (S.phone ? 'phone' : 'full'), `${tag}: the frame atlas is in, the ${mem.size} sheet (${mem.sheet?.w} x ${mem.sheet?.h}, ${mem.kb} KB, ${mem.mb} MB on the GPU, ${mem.mbWithMips} with its mips)`, mem);
			sum.memory = mem;

			// THE LOOK PER CHARACTER, THE BAND, THE NUMBER CLEAR OF THE BAUBLES (each character's largest real value)
			await R(p, () => {
				const F = window.__reindeer.roadBoard().features;
				const top = window.__reindeer.tune.wildMult.maxValue;
				window.__done = false;
				Promise.all([[0, 'reindeer'], [2, 'santa'], [4, 'grandma']].map(([r, t]) => F.columnWild(r, t, top[t], true, null))).then(() => (window.__done = true));
			});
			for (let i = 0; i < 200 && !(await R(p, () => window.__done)); i++) await sleep(150);
			await R(p, () => {
				const F = window.__reindeer.roadBoard().features;
				F.grandmaWild(5, 25);
				F.markCell(13);
			});
			await sleep(1800);
			await R(p, () => window.__reindeer.clock(0));
			await sleep(200);
			let L = await R(p, FRAMES);
			for (const c of L.columns) {
				const want = L.want.look[c.tier];
				check(c.look.tinsel === want.tinsel && c.look.bauble === want.bauble && c.atlas && !c.plain, `${tag}: the ${c.tier} column's frame is ${c.look.tinsel} tinsel with ${c.look.bauble} baubles (want ${want.tinsel} / ${want.bauble}), drawn from the atlas`, c.look);
				check(Math.abs(c.band - L.want.band.col) < 0.01, `${tag}: the ${c.tier} column's band is ${c.band} road px (${c.css.T.toFixed(1)} CSS px)`);
				check(c.baubles.every(Boolean), `${tag}: the ${c.tier} column's four baubles hang`, c.baubles);
			}
			const cell = L.cells[0];
			check(!!cell && cell.look.tinsel === L.want.cell.tinsel && cell.look.bauble === L.want.cell.bauble && Math.abs(cell.band - L.want.band.cell) < 0.01, `${tag}: the Grandma Wild cell's frame is ${cell?.look.tinsel} with ${cell?.look.bauble} baubles, band ${cell?.band} road px (${cell?.css.T.toFixed(1)} CSS px)`, cell?.look);
			const mark = L.marks[0];
			check(!!mark && mark.look.tinsel === L.want.mark.tinsel && mark.look.bauble === L.want.mark.bauble, `${tag}: the marked car's frame is ${mark?.look.tinsel} with ${mark?.look.bauble} baubles`, mark?.look);
			sum.bandCss = { col: L.columns[0]?.css.T, cell: cell?.css.T };
			// from the screen: the frames alone against no frames
			await setInsides(p, false);
			const a = await shot(p);
			// the baubles' color at their ball's centre (the frame alone)
			const balls = L.columns.map((c) => ({ tier: c.tier, kinds: c.bb.map((b) => ballKind(at(a, b.cx, b.cy, dpr))) }));
			await setInk(p, true);
			const ink = await shot(p);
			await setInk(p, false);
			await setFrames(p, false);
			const b = await shot(p);
			await setFrames(p, true);
			await setInsides(p, true);
			for (const c of L.columns) {
				const col = bandColor(a, b, c.css, dpr);
				check(kindOf(col) === L.want.look[c.tier].tinsel, `${tag}: on screen the ${c.tier} column's band reads ${kindOf(col)} (mean ${col?.join(',')})`);
				const bl = balls.find((x) => x.tier === c.tier);
				check(bl.kinds.length === 4 && bl.kinds.every((k) => k === L.want.look[c.tier].bauble), `${tag}: on screen the ${c.tier} column's baubles read ${bl.kinds.join(', ')}`);
				const cv = cover(a, b, c.css, dpr, ink);
				const bad = Object.entries(cv).filter(([, l]) => l.bad);
				check(bad.length === 0, `${tag}: the ${c.tier} column's garland standing: every band and corner covered, no seam (${Object.entries(cv).map(([k, l]) => `${k} ${l.seams}`).join(', ')})`, Object.fromEntries(bad));
			}
			// each character's largest number clear of the baubles
			const m = await R(p, () => window.__reindeer.wildMult());
			for (const c of L.columns) {
				const n = m.columns.find((x) => x.reel === c.reel);
				// (the glass ball itself: a circle of 20.1 of the picture's 40 road px; a letter's box less a tenth each side for
				// its baked pad and soft shadow)
				const hit = (n?.glyphs ?? []).filter((g) =>
					c.bb.some((q) => {
						const r = (q.w * 20.1) / 40;
						const x0 = g.x + g.w * 0.1, x1 = g.x + g.w * 0.9, y0 = g.y + g.h * 0.1, y1 = g.y + g.h * 0.9;
						const dx = Math.max(x0 - q.cx, 0, q.cx - x1);
						const dy = Math.max(y0 - q.cy, 0, q.cy - y1);
						return Math.hypot(dx, dy) < r;
					}),
				);
				check(!!n && n.value === n.max && n.glyphs.length === `${n.max}x`.length && hit.length === 0, `${tag}: the ${c.tier} column's largest real value, ${n?.text}, stays clear of its baubles (${hit.length} letters over one)`, { glyphs: n?.glyphs, bb: c.bb });
			}
			if (OUT) await p.screenshot({ path: join(OUT, `look_${S.name}_${dpr}x.png`) });
			await clearAll(p);

			// DRAW CALLS: the opening board's three columns at rest, frames drawn and not
			if (dpr === DPRS[0]) {
				await R(p, () => {
					const F = window.__reindeer.roadBoard().features;
					window.__done = false;
					Promise.all([[1, 'reindeer', 8], [2, 'santa', 20], [3, 'grandma', 75]].map(([r, t, v]) => F.columnWild(r, t, v, true, null))).then(() => (window.__done = true));
				});
				for (let i = 0; i < 200 && !(await R(p, () => window.__done)); i++) await sleep(150);
				await sleep(1500);
				// (2026-11-20: the board clock held and the frames shown and hidden on alternate frames, so the scene's own
				// changes (a light, the roaming reindeer) fall on both sides alike; one pass of six frames each way read 40 or
				// 44 without the frames as the scene moved)
				const { on, off } = await R(p, async () => {
					const h = window.__reindeer;
					const F = h.roadBoard().features;
					h.clock(0);
					const cv = document.querySelector('canvas');
					const gl = cv.getContext('webgl2') || cv.getContext('webgl');
					let n = 0;
					const de = gl.drawElements;
					const da = gl.drawArrays;
					gl.drawElements = function (...a) {
						n += 1;
						return de.apply(this, a);
					};
					gl.drawArrays = function (...a) {
						n += 1;
						return da.apply(this, a);
					};
					const show = (v) => {
						for (const c of F.columns) for (const r of [c.box.root, c.box.rightRoot, c.box.leftRoot, c.box.fxRoot]) if (r) r.renderable = v;
					};
					const on = [];
					const off = [];
					for (let i = 0; i < 12; i++) {
						show(i % 2 === 0);
						await new Promise((r) => requestAnimationFrame(r));
						n = 0;
						await new Promise((r) => requestAnimationFrame(r));
						(i % 2 === 0 ? on : off).push(n);
					}
					show(true);
					gl.drawElements = de;
					gl.drawArrays = da;
					h.clock(1);
					return { on, off };
				});
				const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
				const L2 = await R(p, FRAMES);
				const sprites = L2.columns.reduce((n, c) => n + c.sprites, 0);
				sum.drawCalls = { withFrames: med(on), without: med(off), sprites };
				check(med(on) - med(off) <= 6, `${tag}: the opening board's three garlands cost ${med(on) - med(off)} draw calls a frame (${med(on)} with, ${med(off)} without; ${sprites} frame sprites drawn)`, { on, off });
				await clearAll(p);
			}

			// THE GROW, per character: the entrance plays as the box grows, the garland whole at every height
			const lengths = {};
			for (const level of dpr === DPRS[0] ? LEVELS : [0]) {
				await R(p, (l) => window.__reindeer.turbo(l), level);
				for (const tier of GROW_TIERS) {
					await R(p, (tier) => {
						const h = window.__reindeer;
						h.clock(0);
						window.__done = false;
						h.roadBoard().features.columnWild(2, tier, 25, false, 2 * 4 + 1).then(() => (window.__done = true));
					}, tier);
					for (let i = 0; i < 300; i++) {
						const ph = await R(p, () => window.__reindeer.roadBoard().features.columns.find((x) => x.reel === 2 && x.phase !== 'leave')?.phase ?? null);
						if (ph !== 'wait') break;
						await sleep(150);
					}
					const info = await R(p, (tier) => {
						const C = window.__reindeer.tune.column;
						const clip = window.__reindeer.roadBoard().features.columns.find((x) => x.reel === 2);
						return { growMs: C.growMs, impactMs: C.impactMs, rate: window.__reindeer.roadBoard().features.rate };
					}, tier);
					const rows = [];
					let growAt = null;
					let standAt = null;
					let doneAt = null;
					const heights = new Set();
					const seamFails = [];
					let boardMs = 0;
					for (let i = 0; i < 600; i++) {
						const st = await R(p, () => {
							const F = window.__reindeer.roadBoard().features;
							const c = F.columns.find((x) => x.reel === 2 && x.phase !== 'leave');
							if (!c) return null;
							const fr = F.frames().columns.find((x) => x.reel === 2);
							const reveal = window.__reindeer.roadBoard().features.columns.find((x) => x.reel === 2);
							return { phase: c.phase, frame: c.frame, cloud: c.cloud.visible ? { y: c.cloud.y, y1: c.cloud.y + c.cloud.height } : null, outer: fr.outer, band: fr.band, baubles: fr.baubles.filter(Boolean).length, done: window.__done };
						});
						if (!st) break;
						if (st.phase === 'grow' && growAt === null) growAt = boardMs;
						if (growAt !== null) rows.push({ t: Math.round((boardMs - growAt) * 10) / 10, ...st });
						if (st.phase === 'idle' && standAt === null) standAt = boardMs;
						if (st.done && doneAt === null) doneAt = boardMs;
						// the garland at four heights of the grow (normal speed only: a screenshot each)
						if (level === 0 && st.phase === 'grow' && growAt !== null) {
							const u = (boardMs - growAt) / info.growMs;
							const want = [0.15, 0.4, 0.7, 0.95].find((q) => u >= q && !heights.has(q));
							if (want !== undefined) {
								heights.add(want);
								await setInsides(p, false);
								const a2 = await shot(p);
								await setInk(p, true);
								const ink2 = await shot(p);
								await setInk(p, false);
								await setFrames(p, false);
								const b2 = await shot(p);
								await setFrames(p, true);
								await setInsides(p, true);
								const G = (await R(p, FRAMES)).columns.find((x) => x.reel === 2).css;
								const cv = cover(a2, b2, G, dpr, ink2);
								const bad = Object.entries(cv).filter(([, l]) => l.bad);
								if (bad.length) seamFails.push({ u: want, bad: Object.fromEntries(bad) });
								if (OUT && dpr === DPRS[DPRS.length - 1]) writeFileSync(join(OUT, `grow_${S.name}_${tier}_${Math.round(want * 100)}.png`), PNG.sync.write(a2));
							}
						}
						if (st.phase === 'idle' && st.done) break;
						await R(p, (ms) => window.__reindeer.step(ms, 1), FRAME);
						boardMs += FRAME * (await R(p, () => window.__reindeer.roadBoard().features.rate));
					}
					const grow = rows.filter((r) => r.phase === 'grow');
					// the entrance's own frame count and fps (tools/build_columns.py PICK: 31 at 24 fps since 2026-11-19)
					const clipInfo = await R(p, () => window.__reindeer.wildFrames().columns.find((x) => x.reel === 2)?.clips?.reveal ?? null);
					const fps = clipInfo?.fps ?? 24;
					const last = (clipInfo?.frames ?? 31) - 1;
					const frames = grow.map((r) => r.frame);
					const distinct = new Set(frames).size;
					// the frame for the time since the grow began: floor(t x fps) (a step's own rounding: within one frame)
					const off = rows.filter((r) => (r.phase === 'grow' || r.phase === 'enter') && r.frame >= 0).filter((r) => Math.abs(r.frame - Math.min(last, Math.floor((r.t / 1000) * fps))) > 1);
					const back = rows.filter((r, i) => i > 0 && (r.phase === 'grow' || r.phase === 'enter') && rows[i - 1].frame > r.frame);
					const hand = rows.findIndex((r) => r.phase === 'enter');
					const handOk = hand > 0 && rows[hand].frame >= rows[hand - 1].frame && rows[hand].frame - rows[hand - 1].frame <= 1;
					const tag2 = `${tag} turbo ${level} ${tier}`;
					check(distinct >= 3, `${tag2}: the entrance plays during the grow (${distinct} distinct frames: ${frames.join(' ')})`, frames);
					check(off.length === 0 && back.length === 0, `${tag2}: every step shows the entrance's frame for the time since the grow began, never going back (${off.length} off, ${back.length} back)`, { off: off.slice(0, 3), back: back.slice(0, 3) });
					check(handOk, `${tag2}: the hand-over from grow to entrance keeps the frame running (${rows[hand - 1]?.frame} then ${rows[hand]?.frame})`);
					const outside = grow.filter((r) => r.cloud && (r.cloud.y < r.outer.y - 0.01 || r.cloud.y1 > r.outer.y + r.outer.h + 0.01));
					check(grow.some((r) => r.cloud) && outside.length === 0, `${tag2}: the moving cloud is cropped to the growing box on every step (${outside.length} outside)`, outside.slice(0, 2));
					const early = grow.filter((r) => r.baubles > 0);
					check(early.length === 0 && rows.some((r) => r.phase !== 'grow' && r.baubles === 4), `${tag2}: the baubles drop once the box is whole (none during the grow)`);
					if (level === 0) check(seamFails.length === 0 && heights.size === 4, `${tag2}: the garland at ${heights.size} heights of the grow covers every band and corner with no seam`, seamFails);
					const len = standAt !== null && growAt !== null ? standAt - growAt : null;
					lengths[`${level}:${tier}`] = { board: len === null ? null : Math.round(len), rate: info.rate, real: len === null ? null : Math.round(len / Math.max(0.01, info.rate)), growMs: info.growMs, impactMs: info.impactMs };
					check(len !== null && len < 1333 + 60 && len > 1333 - 60, `${tag2}: grow start to standing ${Math.round(len)} board ms (the entrance's 1333, was ${info.growMs} + 1333)`);
					await clearAll(p);
				}
			}
			await R(p, () => window.__reindeer.turbo(0));
			sum.reveal = lengths;
			check(errs.length === 0, `${tag}: no page errors`, errs.slice(0, 4));
			await ctx.close();
		}
	}
} finally {
	await browser.close();
}
summary.misses = misses;
if (OUT) writeFileSync(join(OUT, 'garland_probe.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
