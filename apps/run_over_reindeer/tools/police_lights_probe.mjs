// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,game/road/policeLights.ts,game/road/roadSounds.ts,game/utils.ts};
// WATCHES: ; __reindeer.atRest, __reindeer.pressReady, __reindeer.boardLayout, __reindeer.clock, __reindeer.fixtures, __reindeer.hud, __reindeer.police
// WATCHES: ; __reindeer.road, __reindeer.roadSounds, __reindeer.roadSprites, __reindeer.step, __reindeer.tune, __reindeer.turbo, POLICE_LIGHTS
// WATCHES: ; .landing, .hudp, .spin
// THE POLICE LIGHTS PROBE (Corey 2026-11-15: the police car's light bar lights up in a win with it; constants
// POLICE_LIGHTS, game/road/policeLights.ts). A posed book (handed to the fixtures through the dev hook; presentation only,
// no math): five police cars, three of them in the one winning line (reel 1 top lane and reel 2 second lane, driving
// right; reel 3 third lane, driving left) and two that are not. At desktop 1440x900 and phone 390x844, with the board
// clock frozen and stepped one 60 Hz frame at a time through the whole win:
//   - before the lines show, every police car is dark
//   - during the win only the three winning cars light; the other two never do
//   - the three are in phase (the same lens, the same level, every frame), and the lens follows the rule: dark before
//     onsetMs, then red and blue in turn every halfMs (both colors seen)
//   - the frame the win's hold ends, all dark; and dark after the round
//   - a slam stop during the win (the Spin pressed while the lines show), turbo 2 (a short hold): dark when the win goes
//   - the WebGL draw calls per frame with the lights on and off at the same frozen moment of the win; the sprites
//   - no page errors, no console errors
// With OUT=<dir>: per-frame tables (police_table_<size>.md), the frames for a 60 fps clip (police_frames_<size>/), 4x
// stills of each lens lit in each direction (police_<size>_<frame>_<color>.png with crops.json). The caller makes the mp4.
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [OUT=<dir>] [VIDEO=1] \
//     [ONLY=desktop,portrait] node tools/police_lights_probe.mjs
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

// board[reel][row]: police cars at cells 0 (reel 1 row 1), 5 (reel 2 row 2), 10 (reel 3 row 3: drives left) in the win,
// 12 and 19 not
const WIN_CELLS = [0, 5, 10];
const OTHER_POLICE = [12, 19];
const BOOK = [
	{ index: 0, type: 'reveal', gameType: 'basegame', board: [['H4', 'L1', 'L2', 'L3'], ['L2', 'H4', 'L3', 'L4'], ['L3', 'L4', 'H4', 'L5'], ['H4', 'L5', 'L1', 'L2'], ['L4', 'L1', 'L3', 'H4']] },
	{ index: 1, type: 'winInfo', totalWin: 150, wins: [{ symbol: 'H4', kind: 3, line: 2, win: 150, multiplier: 1, cells: WIN_CELLS }] },
	{ index: 2, type: 'setTotalWin', amount: 150 },
	{ index: 3, type: 'finalWin', amount: 150 },
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
	await p.goto(`${APP}/?lang=en&sessionID=police${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 160; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && !document.querySelector('.landing'))).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	await sleep(500);
	return { ctx, p, errs };
}

const R = (p, fn, arg) => p.evaluate(fn, arg);

/** THE PRESS MUST BE TAKEN (2026-11-20, the probe host: the cost section's "lit": [] at 1440x900 and 390x844): since
 *  2da57cb (2026-11-18) a manual base round with a win stays open after its board is at rest until the LED count has
 *  landed (game/utils.ts ledCountDone), and a Spin press in that window is the round's STOP, not a new round. The press
 *  after a winning round then started nothing, the board was read as stopped at once and frozen, and the lines never
 *  showed. Wait (real time, the clock running) until the game takes a press (__reindeer.pressReady), as
 *  tools/rider_probe_lib.mjs stepRound does. */
async function pressWhenReady(p) {
	for (let i = 0; i < 80; i++) {
		if (await R(p, () => (window.__reindeer.pressReady ? window.__reindeer.pressReady() : true))) break;
		await sleep(100);
	}
	await p.click('.hudp button.spin');
}

/** the rule, written out again: which lens is lit `ms` into the win (null: none) */
const expectLens = (T, ms) => {
	const t = ms - T.onsetMs;
	if (t < 0) return null;
	return Math.floor(t / T.halfMs) % 2 === 0 ? 'red' : 'blue';
};

/** a spin of the posed book, the clock frozen once the lines show; steps it frame by frame to the round's end */
async function playWin(p, S, { turbo = 0, slamAt = null, frames = null, shots = null } = {}) {
	await R(p, ({ book, turbo }) => {
		const h = window.__reindeer;
		h.clock(1);
		h.turbo(turbo);
		h.roadSounds(true);
		h.fixtures.queue(book, 1.5);
	}, { book: BOOK, turbo });
	await pressWhenReady(p);
	// let it run in real time until every lane has stopped, then freeze the board clock and step it to the frame the
	// lines show (so the win is seen from its very first frame)
	let shown = false;
	const before = [];
	for (let i = 0; i < 800; i++) {
		const s = await R(p, () => ({ stopped: window.__reindeer.road().lanesStopped.every(Boolean) && window.__reindeer.road().atRest, police: window.__reindeer.police() }));
		before.push(s.police);
		if (s.stopped) break;
		await sleep(10);
	}
	await R(p, () => window.__reindeer.clock(0));
	for (let i = 0; i < 200 && !shown; i++) {
		const s = await R(p, (ms) => {
			const h = window.__reindeer;
			if (h.roadSounds().some((e) => e.what === 'lines')) return { lines: true };
			h.step(ms, 1);
			return { lines: false, police: h.police() };
		}, FRAME);
		if (s.lines) shown = true;
		else before.push(s.police);
		await sleep(0);
	}
	const rows = [];
	let slammed = false;
	for (let i = 0; i < 400; i++) {
		if (slamAt !== null && i === slamAt) {
			// the Spin pressed while the lines show: a slam stop / skip of the win
			await R(p, () => window.__reindeer.clock(1));
			await p.click('.hudp button.spin').catch(() => {});
			slammed = true;
			await R(p, () => window.__reindeer.clock(0));
		}
		const s = await R(p, (ms) => {
			const h = window.__reindeer;
			h.step(ms, 1);
			const sp = h.roadSprites();
			return { police: h.police(), idle: h.atRest(), win: h.road().winShowing };
		}, FRAME);
		rows.push({ i, ...s });
		if (frames) await p.screenshot({ path: join(frames, `f${String(i).padStart(4, '0')}.png`), ...(shots?.clip ? { clip: shots.clip } : {}) });
		const anyLit = s.police.some((c) => c.lit);
		if (!s.win && !anyLit && i > 10 && rows.slice(-6).every((r) => !r.win)) break;
	}
	await R(p, () => window.__reindeer.clock(1));
	for (let i = 0; i < 80; i++) {
		if (await R(p, () => window.__reindeer.atRest())) break;
		await sleep(150);
	}
	await sleep(400);
	const after = await R(p, () => window.__reindeer.police());
	await R(p, () => window.__reindeer.turbo(0));
	return { before, rows, after, slammed };
}

const browser = await chromium.launch({ args: ['--mute-audio'] });
const result = {};
const crops = {};
try {
	for (const S of SIZES) {
		const { ctx, p, errs } = await boot(browser, S);
		const T = await R(p, () => ({ ...window.__reindeer.tune.policeLights }));
		console.log(`-- ${S.name} ${S.vp.width}x${S.vp.height}`);
		const frameDir = OUT && VIDEO ? join(OUT, `police_frames_${S.name}`) : null;
		if (frameDir) mkdirSync(frameDir, { recursive: true });
		const W = await playWin(p, S, { frames: frameDir });
		check(W.before.length > 0 && W.before.every((list) => list.every((c) => !c.lit)), `${S.name}: every police car dark before the lines show (${W.before.length} samples)`);
		const live = W.rows.filter((r) => r.police.some((c) => c.winActive));
		const lit = (r, cell) => r.police.find((c) => c.cell === cell);
		const others = W.rows.filter((r) => OTHER_POLICE.some((cell) => lit(r, cell)?.lit));
		check(others.length === 0, `${S.name}: the two police cars not in the win never light`, others[0]);
		const notWinners = W.rows.filter((r) => r.police.some((c) => c.lit && !WIN_CELLS.includes(c.cell)));
		check(notWinners.length === 0, `${S.name}: only cars of the winning line light`);
		// in phase and by the rule
		let outOfPhase = 0;
		let offRule = 0;
		const seen = new Set();
		for (const r of live) {
			const ms = r.police[0].winMs;
			const want = expectLens(T, ms);
			const cars = WIN_CELLS.map((cell) => lit(r, cell));
			if (new Set(cars.map((c) => `${c?.lit}:${c?.level}`)).size !== 1) outOfPhase += 1;
			const got = cars[0]?.lit ?? null;
			if (got) seen.add(got);
			// a lens may be dark at the very start of its turn (attack from 0): only a wrong color counts
			if (got !== want && !(got === null && want !== null && ((ms - T.onsetMs) % T.halfMs) < 1)) offRule += 1;
		}
		check(live.length > 20 && outOfPhase === 0, `${S.name}: the three winning police cars flash in phase on every frame (${live.length} frames of the win)`, { outOfPhase });
		check(offRule === 0, `${S.name}: the lens follows the rule (dark for ${T.onsetMs} ms, then red and blue in turn every ${T.halfMs} ms)`, { offRule });
		check(seen.has('red') && seen.has('blue'), `${S.name}: both colors seen (${[...seen].join(', ')})`);
		const endFrame = W.rows.findIndex((r, k) => k > 0 && W.rows[k - 1].police.some((c) => c.winActive) && !r.police.some((c) => c.winActive));
		check(endFrame > 0 && W.rows[endFrame].police.every((c) => !c.lit), `${S.name}: all dark on the frame the win's hold ends (frame ${endFrame})`, W.rows[endFrame]);
		check(W.after.every((c) => !c.lit), `${S.name}: all dark after the round`, W.after);
		// the table
		if (OUT) {
			const md = [`# Police lights per frame (${S.vp.width}x${S.vp.height}, the board clock stepped at 60 Hz from the frame the lines show)`, '', `Rule: dark for ${T.onsetMs} ms (the sound's first whoop), then red and blue in turn every ${T.halfMs} ms. Level = the lit lens's brightness (its core's alpha is level x ${T.core.alpha}).`, '', '| frame | win ms | cell 0 (R) | cell 5 (R) | cell 10 (L) | level | cells 12, 19 (not in the win) |', '|---:|---:|---|---|---|---:|---|'];
			for (const r of W.rows) {
				const c = (cell) => lit(r, cell)?.lit ?? '-';
				md.push(`| ${r.i} | ${r.police[0]?.winMs ?? ''} | ${c(0)} | ${c(5)} | ${c(10)} | ${lit(r, 0)?.level ?? ''} | ${c(12)}, ${c(19)} |`);
			}
			writeFileSync(join(OUT, `police_table_${S.name}.md`), md.join('\n') + '\n');
		}

		// THE COST, and the 4x stills: the win again, frozen on a red moment and on a blue moment
		await R(p, ({ book }) => {
			const h = window.__reindeer;
			h.roadSounds(true);
			h.fixtures.queue(book, 1.5);
		}, { book: BOOK });
		await pressWhenReady(p);
		// freeze once the lanes have stopped, then step to the frame the lines show (the win's first frame)
		for (let i = 0; i < 800; i++) {
			if (await R(p, () => window.__reindeer.road().lanesStopped.every(Boolean) && window.__reindeer.road().atRest)) break;
			await sleep(10);
		}
		await R(p, () => window.__reindeer.clock(0));
		for (let i = 0; i < 200; i++) {
			if (await R(p, (ms) => (window.__reindeer.roadSounds().some((e) => e.what === 'lines') ? true : (window.__reindeer.step(ms, 1), false)), FRAME)) break;
			await sleep(0);
		}
		const cost = {};
		for (const [label, steps] of [
			['red', Math.ceil((T.onsetMs + T.halfMs * 0.3) / FRAME)],
			['blue', Math.ceil(T.halfMs / FRAME)],
		]) {
			await R(p, (n) => window.__reindeer.step(1000 / 60, n), steps);
			await sleep(200);
			const read = async () =>
				R(p, async () => {
					const b = { ...window.__dc };
					await new Promise((r) => setTimeout(r, 700));
					let lights = 0;
					const walk = (n) => {
						if (!n.visible || n.alpha <= 0) return;
						if (n.label === 'policeLight') lights += 1;
						for (const c of n.children ?? []) walk(c);
					};
					return { callsPerFrame: Math.round(((window.__dc.calls - b.calls) / Math.max(1, window.__dc.frames - b.frames)) * 100) / 100, police: window.__reindeer.police(), sprites: window.__reindeer.roadSprites() };
				});
			const on = await read();
			if (OUT) {
				const buf = await p.screenshot();
				writeFileSync(join(OUT, `police_${S.name}_${label}.png`), buf);
				crops[`${S.name}_${label}`] = await R(p, () => {
					const h = window.__reindeer;
					const L = h.boardLayout();
					const k = L.css.pitch / 250;
					const toCss = (x, y) => ({ x: L.css.x + (x - 142) * k, y: L.css.y + (y - 167) * k });
					// cell 0 (H4_R) and cell 10 (H4_L): a box around the light bar
					const box = (cell) => {
						const reel = Math.floor(cell / 4);
						const row = cell % 4;
						const lines = [167, 338, 509, 680, 851];
						const cx = 142 + (reel + 0.5) * 250;
						const sit = lines[row + 1] - 10;
						const a = toCss(cx - 110, sit - 200);
						const b = toCss(cx + 110, sit - 40);
						return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
					};
					return { dpr: window.devicePixelRatio, H4_R: box(0), H4_L: box(10) };
				});
			}
			await R(p, () => (window.__reindeer.tune.policeLights.on = false));
			await R(p, () => window.__reindeer.step(0.001, 1));
			const off = await read();
			await R(p, () => (window.__reindeer.tune.policeLights.on = true));
			await R(p, () => window.__reindeer.step(0.001, 1));
			cost[label] = { on: on.callsPerFrame, off: off.callsPerFrame, lit: on.police.filter((c) => c.lit).map((c) => `${c.cell}:${c.lit}`), sprites: on.sprites.sprites, spritesOff: off.sprites.sprites };
		}
		check(cost.red.lit.every((x) => x.endsWith('red')) && cost.blue.lit.every((x) => x.endsWith('blue')) && cost.red.lit.length === 3 && cost.blue.lit.length === 3, `${S.name}: frozen on a red moment and a blue moment, all three lit in that color`, cost);
		console.log(`  ${S.name} cost: draw calls per frame red ${cost.red.on} (lights off ${cost.red.off}), blue ${cost.blue.on} (off ${cost.blue.off}); road sprites ${cost.red.sprites} with the lights, ${cost.red.spritesOff} without`);
		await R(p, () => window.__reindeer.clock(1));
		for (let i = 0; i < 80; i++) {
			if (await R(p, () => window.__reindeer.atRest())) break;
			await sleep(150);
		}

		// A SLAM STOP during the win, and TURBO 2
		const slam = await playWin(p, S, { slamAt: Math.ceil((T.onsetMs + 60) / FRAME) });
		const litAfterSlam = slam.rows.filter((r) => !r.win && r.police.some((c) => c.lit));
		check(slam.slammed && litAfterSlam.length === 0 && slam.after.every((c) => !c.lit), `${S.name}: a slam stop during the win: no light left once the win goes`, { litAfterSlam: litAfterSlam[0], after: slam.after });
		const t2 = await playWin(p, S, { turbo: 2 });
		const t2Live = t2.rows.filter((r) => r.police.some((c) => c.winActive)).length;
		check(t2.rows.filter((r) => !r.police.some((c) => c.winActive) && r.police.some((c) => c.lit)).length === 0 && t2.after.every((c) => !c.lit), `${S.name}: turbo 2 (a ${t2Live} frame hold): lit only while the win shows, dark after`);
		check(errs.length === 0, `${S.name}: no page errors, no console errors`, errs);
		result[S.name] = { tune: T, rows: W.rows.length, cost };
		await ctx.close();
	}
} finally {
	await browser.close();
}
if (OUT) writeFileSync(join(OUT, 'police_crops.json'), JSON.stringify(crops, null, 1));
console.log(`\n${pass} passed, ${fail} failed${fails.length ? '\n  ' + fails.join('\n  ') : ''}`);
if (OUT) writeFileSync(join(OUT, 'police_lights_probe.json'), JSON.stringify({ pass, fail, fails, ...result }, null, 1));
process.exit(fail ? 1 : 0);
