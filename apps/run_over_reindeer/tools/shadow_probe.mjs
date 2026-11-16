// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// THE SHADOW PROBE (the contact shadows, Corey 2026-11-15; game/road/shadows.ts, tools/build_shadows.py, constants
// SHADOW). From the running game, at each size (desktop 1440x900, phones 390x844 and 390x620 on the phone tier):
//   - a full board posed with every symbol frame (each car and the sleigh in both directions, the five signs, two
//     presents): every symbol drawn has exactly one shadow under it, at its frame's table place (to 0.5 road px), the
//     shadow's centre within N road px of the measured footprint's middle, its lower edge 0 to 6 road px under the
//     measured ground (it touches, and stops short of the lane line), and wide enough to cover the footprint
//   - a book driving out and in, stepped one 30 fps frame at a time with the board clock frozen: on every frame each
//     drawn symbol has its shadow on its x and no hidden or retired symbol has one; nothing is left after the round
//   - a strike stepped frame by frame: the reindeer's shadow is on his feet point in the same frame (to 0.5 road px), its
//     size and darkness follow his draw scale and his feet's height (shadowSpec.ts run.lift), it fades with him, and
//     is gone once he is; the Santa column it makes gets its feet shadow, and that goes when the column leaves
//   - a slam stop (base_one_column, the Spin pressed again as he sets off): after the round no runner shadow, no column
//     shadow of a column that left, and exactly one per symbol drawn
//   - no page errors, no console errors
// It also reads the sprites the road draws and the WebGL draw calls per frame on the full board with the shadows off,
// light and firm. With OUT=<dir> it writes shadow_probe.json, the screenshots for the sheets (board_<size>_<mode>.png,
// columns_<size>_<mode>.png, crops.json) and, with VIDEO=1, the strike's frames at 1440x900 (light) and its per-frame table
// (strike_table.md); the caller makes the mp4 with ffmpeg.
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [OUT=<dir>] [VIDEO=1] [ONLY=desktop] \
//     node tools/shadow_probe.mjs
// Uses the dev server that is already running (it never starts one). One headless browser, muted, closed at the end.
// Take the shared browser lock around it (mkdir /tmp/hud_mock_shot.lock ... rmdir).
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3014';
const OUT = process.env.OUT || '';
const VIDEO = process.env.VIDEO === '1';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
if (OUT) mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STEP = 1000 / 30;
/** the strike is stepped at 60 Hz (a render frame: he runs 60 poses a second along the snow) */
const STRIKE_STEP = 1000 / 60;
const NEAR = 3; // road px: a shadow's centre from its footprint's middle
const SPEC = (() => {
	const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'game', 'shadowSpec.ts'), 'utf8');
	return JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
})();

const SIZES = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, dpr: 2, phone: false },
	{ name: 'portrait', vp: { width: 390, height: 844 }, dpr: 2, phone: true },
	{ name: 'short', vp: { width: 390, height: 620 }, dpr: 2, phone: true },
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
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 600)) : ''}`);
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
	for (let i = 0; i < 60 && !(await p.evaluate(() => window.__reindeer.runMemory().loaded)); i++) await sleep(250);
	await sleep(400);
	return { ctx, p, errs };
}

const R = (p, fn, arg) => p.evaluate(fn, arg);

/** in the page: every symbol's shadow against its table place and its measured footprint */
const SYMBOL_CHECK = (near) => {
	const s = window.__reindeer.shadows();
	const bad = [];
	let drawn = 0;
	let shown = 0;
	for (const c of s.cars) {
		const isDrawn = c.phase !== 'free' && c.ownerVisible;
		if (isDrawn) drawn += 1;
		if (c.visible) shown += 1;
		if (isDrawn !== c.visible) {
			bad.push({ why: isDrawn ? 'no shadow' : 'shadow left behind', c });
			continue;
		}
		if (!isDrawn || !c.shape) continue;
		const sh = c.shape;
		const pulse = c.w / sh.width;
		const ex = c.ownerX + sh.dx * pulse;
		const ey = c.ownerY + sh.dy * pulse;
		if (Math.abs(c.x - ex) > 0.5 || Math.abs(c.y - ey) > 0.5 || Math.abs(c.h / sh.height - pulse) > 0.01) bad.push({ why: 'off its table place', c, ex, ey });
		const mid = c.ownerX + ((sh.foot[0] + sh.foot[1]) / 2) * pulse;
		const under = c.y + c.h / 2 - (c.ownerY + sh.ground * pulse);
		const covers = c.x - c.w / 2 <= c.ownerX + sh.foot[0] * pulse + 0.01 && c.x + c.w / 2 >= c.ownerX + sh.foot[1] * pulse - 0.01;
		if (Math.abs(c.x - mid) > near || under < 0 || under > 6 || !covers) bad.push({ why: 'off its footprint', frame: c.frame, dMid: c.x - mid, under, covers });
	}
	// exactly one shadow under each parked cell drawn
	const perCell = {};
	for (const c of s.cars) if (c.visible && c.cell !== null) perCell[c.cell] = (perCell[c.cell] ?? 0) + 1;
	const doubled = Object.entries(perCell).filter(([, n]) => n !== 1);
	return { drawn, shown, bad: bad.slice(0, 4), badCount: bad.length, doubled, groundSprites: s.groundSprites, runnerLayer: s.features.layers.runner, feetLayer: s.features.layers.feet, frames: [...new Set(s.cars.filter((c) => c.visible).map((c) => c.frame))].sort() };
};

/** expected runner shadow for a snapshot row (the spec's numbers) */
const expectRunner = (r, strength) => {
	const view = r.view === 'placeholder' ? 'R' : r.view;
	const v = SPEC.run.views[view];
	// the foot height the game drew (eased between this pose's measured height and the next one's): checked to lie between them
	const here = SPEC.run.lift[view]?.[String(r.stride)] ?? 0;
	const next = SPEC.run.lift[view]?.[String((r.stride % 16) + 1)] ?? here;
	const lift = r.view === 'placeholder' ? 0 : r.lift;
	const inTable = r.view === 'placeholder' || (lift >= Math.min(here, next) - 0.01 && lift <= Math.max(here, next) + 0.01);
	const u = Math.min(1, Math.max(0, lift) / SPEC.run.liftFull);
	const road = SPEC.run.roadPxPerFramePx * r.scale;
	const shrink = 1 - SPEC.run.shrink * u;
	return { x: r.feetX, y: r.feetY + v.dy * road, w: v.width * road * shrink, h: v.height * road * shrink, alpha: strength * SPEC.run.alpha * (1 - SPEC.run.fade * u) * r.spriteAlpha, lift, inTable };
};

async function stills(p, S, out) {
	// THE FULL BOARD, off / light / firm, and the road's sprites and draw calls for each
	await R(p, (b) => {
		const h = window.__reindeer;
		h.clock(1);
		h.setBoard(b);
	}, FULL_BOARD);
	await sleep(600);
	const c = await R(p, SYMBOL_CHECK, NEAR);
	check(c.drawn === 20 && c.shown === 20 && c.badCount === 0 && c.doubled.length === 0, `${S.name}: full board: every one of the 20 symbols has exactly one shadow at its table place and within ${NEAR} road px of its footprint, touching its ground`, c);
	check(c.frames.length === 16, `${S.name}: the board shows all 16 shadow shapes (4 cars and the sleigh both ways, 5 signs, the present)`, c.frames);
	const modes = {};
	for (const mode of ['off', 'light', 'firm']) {
		await R(p, (m) => {
			const t = window.__reindeer.tune.shadow;
			t.on = m !== 'off';
			if (m !== 'off') t.strength = m;
		}, mode);
		await sleep(250);
		const stats = await R(p, async () => {
			const before = { ...window.__dc };
			await new Promise((r) => setTimeout(r, 1000));
			const calls = window.__dc.calls - before.calls;
			const frames = window.__dc.frames - before.frames;
			return { sprites: window.__reindeer.roadSprites(), callsPerFrame: Math.round((calls / Math.max(1, frames)) * 100) / 100, frames };
		});
		modes[mode] = stats;
		if (OUT) await p.screenshot({ path: join(OUT, `board_${S.name}_${mode}.png`) });
	}
	check(modes.light.sprites.shadows === 20 && modes.off.sprites.shadows === 0, `${S.name}: shadows drawn: off 0, light 20`, modes);
	check(modes.light.callsPerFrame <= modes.off.callsPerFrame + 0.01, `${S.name}: no extra draw call for the shadows (off ${modes.off.callsPerFrame}, light ${modes.light.callsPerFrame}, firm ${modes.firm.callsPerFrame} per frame)`, modes);
	out.board = { check: c, modes };

	// crops: per symbol frame, a box around its bottom (road px -> CSS px)
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
			const a = toCss(c.ownerX - 125, c.ownerY - 95);
			const b = toCss(c.ownerX + 125, c.ownerY + 22);
			boxes.push({ name: c.frame, x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y });
		}
		return { boxes, cssPerRoad: s };
	});

	// THE COLUMNS (their feet): three standing, off / light / firm
	await R(p, () => {
		const h = window.__reindeer;
		h.tune.shadow.on = true;
		h.tune.shadow.strength = 'light';
		h.column(1, 'reindeer', 5, null);
		h.column(2, 'santa', 10, null);
		h.column(3, 'grandma', 3, null);
	});
	for (let i = 0; i < 40; i++) {
		const ok = await R(p, () => window.__reindeer.shadows().features.columns.filter((c) => c.phase === 'idle' && c.visible).length === 3);
		if (ok) break;
		await sleep(250);
	}
	await sleep(300);
	const cols = await R(p, () => window.__reindeer.shadows().features.columns);
	const colOk = cols.length === 3 && cols.every((c) => {
		const sh = SPEC_COLUMNS[c.tier];
		return c.visible && Math.abs(c.x - (c.footX + sh.dx)) < 0.5 && Math.abs(c.y - (c.footY + sh.dy)) < 0.5 && Math.abs(c.w - sh.width) < 0.5;
	});
	check(colOk, `${S.name}: each standing column character has one shadow at its feet (table place)`, cols);
	const colShots = {};
	for (const mode of ['off', 'light', 'firm']) {
		await R(p, (m) => {
			const t = window.__reindeer.tune.shadow;
			t.on = m !== 'off';
			if (m !== 'off') t.strength = m;
		}, mode);
		await sleep(250);
		if (OUT) await p.screenshot({ path: join(OUT, `columns_${S.name}_${mode}.png`) });
		colShots[mode] = await R(p, () => window.__reindeer.roadSprites());
	}
	const colCrops = await R(p, () => {
		const h = window.__reindeer;
		const L = h.boardLayout();
		const s = L.css.pitch / 250;
		const toCss = (x, y) => ({ x: L.css.x + (x - 142) * s, y: L.css.y + (y - 167) * s });
		return h.shadows().features.columns.map((c) => {
			const a = toCss(c.footX - 125, c.footY - 120);
			const b = toCss(c.footX + 125, c.footY + 20);
			return { name: `column_${c.tier}`, x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
		});
	});
	// the columns leave: their shadows go with them
	await R(p, () => {
		window.__reindeer.tune.shadow.on = true;
		window.__reindeer.tune.shadow.strength = 'light';
		window.__reindeer.setBoard(window.__reindeer.board());
	});
	await R(p, () => window.__reindeer.hud && window.__reindeer.tune && null);
	await R(p, () => {
		// clearAll is what a press does (boardDriveOut): every column leaves
		const h = window.__reindeer;
		h.crosshairStrike({ cells: [], poseOnly: true });
	});
	await sleep(1200);
	const after = await R(p, () => window.__reindeer.shadows().features);
	check(after.columns.length === 0 && after.layers.feet === 0, `${S.name}: the columns left and took their shadows with them`, after);
	out.columns = { cols, colShots };
	if (OUT) {
		const all = JSON.parse((() => {
			try {
				return readFileSync(join(OUT, 'crops.json'), 'utf8');
			} catch {
				return '{}';
			}
		})());
		all[S.name] = { dpr: S.dpr, symbols: crops.boxes, columns: colCrops, cssPerRoad: crops.cssPerRoad };
		writeFileSync(join(OUT, 'crops.json'), JSON.stringify(all, null, 1));
	}
}
let SPEC_COLUMNS = SPEC.columns;

async function driveCheck(p, S, out) {
	await R(p, (ev) => window.__reindeer.fixtures.queue(ev, 0), DRIVE_BOOK);
	await R(p, () => window.__reindeer.clock(0));
	await R(p, () => window.__reindeer.hud.emit({ type: 'bet' }));
	let frames = 0;
	let badFrames = 0;
	let firstBad = null;
	let maxShown = 0;
	let tIn = null;
	for (let i = 0; i < 900; i++) {
		const s = await R(p, ([ms, near]) => {
			const snap = window.__reindeer.step(ms, 1);
			const sh = window.__reindeer.shadows();
			const bad = sh.cars.filter((c) => (c.phase !== 'free' && c.ownerVisible) !== c.visible || (c.visible && c.shape && Math.abs(c.x - (c.ownerX + c.shape.dx * (c.w / c.shape.width))) > 0.5));
			return { inPhase: snap.phases.in ?? 0, idle: window.__reindeer.atRest(), shown: sh.cars.filter((c) => c.visible).length, bad: bad.slice(0, 2), badCount: bad.length };
		}, [STEP, NEAR]);
		frames += 1;
		maxShown = Math.max(maxShown, s.shown);
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
	const end = await R(p, SYMBOL_CHECK, NEAR);
	check(badFrames === 0, `${S.name}: drive out and in (${frames} frames stepped): every drawn symbol has its shadow on its x in the same frame, none on a hidden or retired one`, firstBad);
	check(end.drawn === 20 && end.shown === 20 && end.badCount === 0 && end.doubled.length === 0, `${S.name}: after the round: exactly one shadow per symbol, none left behind (ground sprites ${end.groundSprites}, drawn ${end.shown})`, end);
	out.drive = { frames, maxShown, end };
}

async function strikeCheck(p, S, out, video) {
	await R(p, () => {
		const h = window.__reindeer;
		h.tune.shadow.on = true;
		h.tune.shadow.strength = 'light';
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
	const rows = [];
	let off = 0;
	let firstOff = null;
	let sawRunner = false;
	let goneAt = null;
	let leftOver = null;
	let tail = 0;
	const strength = SPEC_STRENGTH;
	for (let i = 0; i < 800; i++) {
		const s = await R(p, (ms) => {
			window.__reindeer.step(ms, 1);
			const f = window.__reindeer.shadows().features;
			// (the stepped clock)
			return { runner: f.runner, layers: f.layers, columns: f.columns, done: window.__strikeDone };
		}, STRIKE_STEP);
		if (video && OUT) await p.screenshot({ path: join(OUT, 'strike_frames', `f${String(i).padStart(4, '0')}.png`) });
		const r = s.runner;
		if (r && r.spriteVisible) {
			sawRunner = true;
			const e = expectRunner(r, strength);
			const sh = r.shadow;
			const miss = !e.inTable ? 'foot height not from the table' : !sh.visible && e.alpha > 0.003 ? 'hidden' : Math.abs(sh.x - e.x) > 0.5 || Math.abs(sh.y - e.y) > 0.5 || Math.abs(sh.w - e.w) > 0.5 || Math.abs(sh.alpha - e.alpha) > 0.01 ? 'off' : null;
			if (miss) {
				off += 1;
				firstOff ??= { i, miss, r, e };
			}
			rows.push({ frame: i, phase: r.phase, view: r.view, stride: r.stride, scale: r.scale, liftFramePx: e.lift, liftRoad: r.liftRoad, feetX: r.feetX, feetY: r.feetY, shadowX: sh.x, shadowY: sh.y, shadowW: sh.w, shadowH: sh.h, alpha: sh.alpha, visible: sh.visible });
		} else if (sawRunner && goneAt === null && !r) {
			goneAt = i;
			if (s.layers.runner !== 0) leftOver = s.layers;
		}
		// after the strike resolves (the character steps in), a second more: the column stands and its shadow comes in
		if (s.done && goneAt !== null) {
			tail += 1;
			out.strikeColumn = s.columns;
			if (tail > 72) break;
		}
		await sleep(0);
	}
	await R(p, () => window.__reindeer.clock(1));
	check(sawRunner && rows.length > 40, `${S.name}: strike: ${rows.length} frames with the reindeer drawn`);
	check(off === 0, `${S.name}: strike: his shadow is on his feet point in the same frame on every frame (to 0.5 road px), sized and faded by his scale and foot height`, firstOff);
	const lifts = rows.map((r) => r.liftFramePx);
	check(Math.max(...lifts) > 60 && Math.min(...lifts) < 20, `${S.name}: strike: his feet leave the ground and come back during the run (foot height ${Math.min(...lifts)} to ${Math.max(...lifts)} frame px), and the shadow answers`);
	check(goneAt !== null && leftOver === null, `${S.name}: strike: once he is gone into the cloud his shadow is gone too (no runner shadow left in his layer)`, { goneAt, leftOver });
	const col = (out.strikeColumn ?? []).find((c) => c.tier === 'santa');
	check(!!col && col.visible, `${S.name}: the Santa column the strike made has its feet shadow`, out.strikeColumn);
	out.strike = { frames: rows.length, rows };
	return rows;
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
	const c = await R(p, SYMBOL_CHECK, NEAR);
	const f = await R(p, () => window.__reindeer.shadows().features);
	const standing = f.columns.filter((x) => x.phase !== 'leave');
	check(slammed && c.badCount === 0 && c.doubled.length === 0 && c.shown === c.drawn && f.layers.runner === 0 && f.columns.every((x) => x.visible === (x.bodyVisible && x.phase !== 'leave') || x.phase === 'leave'), `${S.name}: after a slam stop: one shadow per symbol drawn (${c.shown}), no runner shadow, ${standing.length} column shadow(s) for ${standing.length} standing column(s)`, { slammed, c, f });
	out.slam = { c, f };
	// the next press clears the column: its shadow goes with it
	await R(p, () => window.__reindeer.fixtures.queue([{ index: 0, type: 'reveal', gameType: 'basegame', board: [['L4', 'H3', 'L2', 'H2'], ['L3', 'S', 'L4', 'L5'], ['L3', 'L5', 'W', 'L4'], ['H4', 'L4', 'S', 'L4'], ['H3', 'L1', 'L4', 'H1']] }, { index: 1, type: 'finalWin', amount: 0 }], 0));
	await p.click('.hudp button.spin');
	for (let i = 0; i < 120; i++) {
		if (await R(p, () => window.__reindeer.atRest())) break;
		await sleep(150);
	}
	await sleep(800);
	const g = await R(p, () => window.__reindeer.shadows().features);
	const c2 = await R(p, SYMBOL_CHECK, NEAR);
	check(g.columns.length === 0 && g.layers.feet === 0 && c2.badCount === 0 && c2.shown === 20, `${S.name}: the next spin: the column and its shadow gone, 20 symbols with 20 shadows`, { g, c2 });
}

let SPEC_STRENGTH = 0.5;
const browser = await chromium.launch({ args: ['--mute-audio'] });
const result = { sizes: {} };
try {
	for (const S of SIZES) {
		const { ctx, p, errs } = await boot(browser, S);
		SPEC_STRENGTH = await R(p, () => window.__reindeer.tune.shadow.alpha.light);
		const out = { texture: await R(p, () => window.__reindeer.shadows().texture) };
		console.log(`-- ${S.name} ${S.vp.width}x${S.vp.height} texture ${JSON.stringify(out.texture)}`);
		await stills(p, S, out);
		await R(p, () => window.__reindeer.setBoard(window.__reindeer.board()));
		await driveCheck(p, S, out);
		if (VIDEO && OUT && S.name === 'desktop') mkdirSync(join(OUT, 'strike_frames'), { recursive: true });
		const rows = await strikeCheck(p, S, out, VIDEO && S.name === 'desktop');
		if (OUT && S.name === 'desktop') {
			const md = ['# The reindeer\'s shadow, per frame (1440x900, light, board clock stepped at 60 Hz, one render frame per row)', '', 'Road px. Foot height: his lowest hoof over the ground (the view\'s anchor), frame px of the rig and road px at his draw scale. The shadow\'s centre against his feet point (the sprite\'s anchor).', '', '| frame | phase | view | stride | scale | foot height (frame px) | foot height (road px) | his feet x, y | shadow x, y | shadow - feet | shadow w x h | alpha |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
			for (const r of rows) md.push(`| ${r.frame} | ${r.phase} | ${r.view} | ${r.stride} | ${r.scale} | ${Math.round(r.liftFramePx * 10) / 10} | ${r.liftRoad} | ${r.feetX}, ${r.feetY} | ${r.shadowX}, ${r.shadowY} | ${(r.shadowX - r.feetX).toFixed(2)}, ${(r.shadowY - r.feetY).toFixed(2)} | ${r.shadowW} x ${r.shadowH} | ${r.alpha} |`);
			writeFileSync(join(OUT, 'strike_table.md'), md.join('\n') + '\n');
		}
		await slamCheck(p, S, out);
		check(errs.length === 0, `${S.name}: no page errors, no console errors`, errs);
		result.sizes[S.name] = out;
		await ctx.close();
	}
} finally {
	await browser.close();
}
console.log(`\n${pass} passed, ${fail} failed${fails.length ? '\n  ' + fails.join('\n  ') : ''}`);
if (OUT) writeFileSync(join(OUT, 'shadow_probe.json'), JSON.stringify({ pass, fail, fails, ...result }, null, 1));
process.exit(fail ? 1 : 0);
