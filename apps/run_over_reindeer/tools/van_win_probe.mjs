// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,game/road/roadSounds.ts,game/road/vanWin.ts};
// WATCHES: ; __reindeer.atRest, __reindeer.boardLayout, __reindeer.clock, __reindeer.fixtures, __reindeer.hud, __reindeer.pressReady
// WATCHES: ; __reindeer.road, __reindeer.roadSounds, __reindeer.roadSprites, __reindeer.roundIdle, __reindeer.step, __reindeer.tune
// WATCHES: ; __reindeer.turbo, __reindeer.vans, VAN_WIN
// WATCHES: ; .landing, .hudp, .spin
// THE VAN WIN PROBE (Corey 2026-11-15: the van, H3, lurches and backfires, then rocks with a flashlight in its windows
// when it wins; constants VAN_WIN, game/road/vanWin.ts). A posed book (handed to the fixtures through the dev hook;
// presentation only, no math): five vans, three of them in the one winning line (reel 1 second lane driving right, reels
// 2 and 3 in the two lanes driving left) and two that are not. At desktop 1440x900 and phone 390x844, the board clock
// frozen and stepped one 60 Hz frame at a time through the whole win:
//   - before the lines show, every van is still (upright, on its mark) with nothing drawn
//   - during the win only the three winning vans move; the other two never do
//   - the lurch phase first (lurchMs) with the backfire's puffs, then the rocking with the flashlight; the glows are
//     never wider than the glass is deep at their slots (they stay inside the windows)
//   - the frame the win's hold ends, every van is upright on its mark and nothing is drawn; the same after the round
//   - a slam stop during the win, turbo 2: nothing left once the win goes
//   - every round it plays: the press on a ready Spin key started a round and its lines showed (a line of its own, so a
//     round that never started is never read as a game fault); the slam press has its own line too (2026-11-22, below)
//   - the WebGL draw calls per frame with the van's win on and off at the same frozen moment; the sprites
//   - no page errors, no console errors
// With OUT=<dir>: per-frame tables (van_table_<size>.md), the frames for a 60 fps clip (van_frames_<size>/), stills
// frozen on a puff and on a bright flashlight (van_<size>_<moment>.png with van_crops.json). The caller makes the mp4.
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [OUT=<dir>] [VIDEO=1] \
//     [ONLY=desktop,portrait] node tools/van_win_probe.mjs
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

// board[reel][row]: vans at cells 1 (reel 1 row 2, drives right), 6 and 11 (reels 2 and 3, rows 3 and 4: drive left) in
// the win, 13 and 16 not
const WIN_CELLS = [1, 6, 11];
const OTHER = [13, 16];
const BOOK = [
	{ index: 0, type: 'reveal', gameType: 'basegame', board: [['L1', 'H3', 'L2', 'L3'], ['L2', 'L4', 'H3', 'L5'], ['L3', 'L4', 'L5', 'H3'], ['L5', 'H3', 'L1', 'L2'], ['H3', 'L1', 'L3', 'L4']] },
	// (the line also runs through cell 9, a sign, so the amount, drawn on the line's middle cell, sits clear of the vans)
	{ index: 1, type: 'winInfo', totalWin: 100, wins: [{ symbol: 'H3', kind: 4, line: 3, win: 100, multiplier: 1, cells: [1, 6, 9, 11] }] },
	{ index: 2, type: 'setTotalWin', amount: 100 },
	{ index: 3, type: 'finalWin', amount: 100 },
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
	// (the detail's flags come first in each object and the cut is long: a cut at 700 once hid the slam's flag)
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 2400)) : ''}`);
};
const skip = (msg, why) => console.log(`SKIP ${msg}: not judged, ${why}`);

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
	await p.goto(`${APP}/?lang=en&sessionID=van${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
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

/** THE PRESS MUST START A ROUND (2026-11-22, Decimus: the slam line failed on desktop and portrait with slammed false and
 *  12 rows; by hand the game was right). Since the Spin key change (web-sdk 88392637, ui/controls.svelte.ts "THE ROUND'S
 *  TAIL") the key reads Spin from the round's finalWin, the same moment atRest() turns true (bookEventHandlerMap's finalWin
 *  clears stateGame.busy), while the round machine still runs its tail (the strip's count, the end-round). A press in the
 *  first SPIN_TAIL.flipGraceMs after that change only completes the readout and starts nothing; a later one is kept until
 *  the machine is idle and only then starts its round. This probe pressed right after waiting for atRest(), so the press
 *  after a winning round started no round at once (or none at all); the wait for the lanes to stop then broke on the old
 *  board, still at rest, the clock was frozen and the stepping read a board with no win (the slam frame never came; the
 *  turbo 2 run passed on no win at all). Now: wait (real time, the clock running) for the round machine itself
 *  (__reindeer.roundIdle, as tools/rider_probe_lib.mjs stepRound and tools/police_lights_probe.mjs do), then queue the
 *  book and empty the sound log (nothing of the round before can come after that), press, and see the new round start
 *  (the board leaves rest: actor.ts onNewGameStart sets busy) before anything is stepped. */
async function startRound(p, { book, turbo }) {
	await R(p, () => window.__reindeer.clock(1));
	let ready = false;
	for (let i = 0; i < 100 && !ready; i++) {
		ready = await R(p, () => (window.__reindeer.roundIdle ? window.__reindeer.roundIdle() : window.__reindeer.pressReady ? window.__reindeer.pressReady() : true));
		if (!ready) await sleep(100);
	}
	await R(p, ({ book, turbo }) => {
		const h = window.__reindeer;
		h.clock(1);
		h.turbo(turbo);
		h.roadSounds(true);
		h.fixtures.queue(book, 1);
	}, { book, turbo });
	await p.click('.hudp button.spin');
	let started = false;
	for (let i = 0; i < 40 && !started; i++) {
		started = !(await R(p, () => window.__reindeer.atRest()));
		if (!started) await sleep(50);
	}
	return { ready, started };
}

/** a spin of the posed book, the clock frozen once the lines show; steps it frame by frame to the round's end */
async function playWin(p, S, { turbo = 0, slamAt = null, frames = null, shots = null } = {}) {
	const { ready, started } = await startRound(p, { book: BOOK, turbo });
	// let it run in real time until every lane has stopped, then freeze the board clock and step it to the frame the
	// lines show (so the win is seen from its very first frame)
	let shown = false;
	let landed = false;
	const before = [];
	for (let i = 0; i < 800; i++) {
		const s = await R(p, () => ({ stopped: window.__reindeer.road().lanesStopped.every(Boolean) && window.__reindeer.road().atRest, vans: window.__reindeer.vans() }));
		before.push(s.vans);
		if (s.stopped) {
			landed = true;
			break;
		}
		await sleep(10);
	}
	await R(p, () => window.__reindeer.clock(0));
	for (let i = 0; i < 200 && !shown; i++) {
		const s = await R(p, (ms) => {
			const h = window.__reindeer;
			if (h.roadSounds().some((e) => e.what === 'lines')) return { lines: true };
			h.step(ms, 1);
			return { lines: false, vans: h.vans() };
		}, FRAME);
		if (s.lines) shown = true;
		else before.push(s.vans);
		await sleep(0);
	}
	const rows = [];
	let slammed = false;
	// (the win showing on the frame before the slam frame: the press is made only then, so a press made is a slam of the win)
	let winAtSlam = null;
	for (let i = 0; i < 400; i++) {
		if (slamAt !== null && i === slamAt) {
			winAtSlam = !!rows[i - 1]?.win;
			if (winAtSlam) {
				// the Spin pressed while the lines show: a slam stop / skip of the win
				await R(p, () => window.__reindeer.clock(1));
				await p.click('.hudp button.spin').catch(() => {});
				slammed = true;
				await R(p, () => window.__reindeer.clock(0));
			}
		}
		const s = await R(p, (ms) => {
			const h = window.__reindeer;
			h.step(ms, 1);
			return { vans: h.vans(), idle: h.atRest(), win: h.road().winShowing };
		}, FRAME);
		rows.push({ i, ...s });
		if (frames) await p.screenshot({ path: join(frames, `f${String(i).padStart(4, '0')}.png`), ...(shots?.clip ? { clip: shots.clip } : {}) });
		const anyLit = s.vans.some((c) => c.phase !== 'off');
		if (!s.win && !anyLit && i > 10 && rows.slice(-6).every((r) => !r.win)) break;
	}
	await R(p, () => window.__reindeer.clock(1));
	for (let i = 0; i < 80; i++) {
		if (await R(p, () => window.__reindeer.atRest())) break;
		await sleep(150);
	}
	await sleep(400);
	const after = await R(p, () => window.__reindeer.vans());
	await R(p, () => window.__reindeer.turbo(0));
	return { before, rows, after, slammed, winAtSlam, ready, started, landed, shown };
}

/** the round's own line: the press on a ready key started it and its lines showed (printed before the game's lines) */
const checkStart = (S, label, W) =>
	check(W.started && W.landed && W.shown, `${S.name}: ${label}: the press on a ready Spin key started a round and its lines showed`, { ready: W.ready, started: W.started, landed: W.landed, shown: W.shown, nrows: W.rows?.length });

// a van at rest after its win: nothing drawn, upright on its mark; one driving (a slam stop drives the board away, a new
// spin brings it in) is judged on the win's drawing only (the road moves and dives it, not the win)
const still = (c) => c.phase === 'off' && c.glows === 0 && c.puffs === 0 && Math.abs(c.skew) < 1e-9 && (c.cell === null || (Math.abs(c.rotation) < 1e-9 && Math.abs(c.x - c.restX) < 0.01 && Math.abs(c.y - c.sitY) < 0.01));
const browser = await chromium.launch({ args: ['--mute-audio'] });
const result = {};
const crops = {};
try {
	for (const S of SIZES) {
		const { ctx, p, errs } = await boot(browser, S);
		const T = await R(p, () => JSON.parse(JSON.stringify(window.__reindeer.tune.vanWin)));
		console.log(`-- ${S.name} ${S.vp.width}x${S.vp.height}`);
		const frameDir = OUT && VIDEO ? join(OUT, `van_frames_${S.name}`) : null;
		if (frameDir) mkdirSync(frameDir, { recursive: true });
		const W = await playWin(p, S, { frames: frameDir });
		checkStart(S, 'the win', W);
		// (before the win a van may be driving in, tilted by its own brake dive: only the win's motion and drawing count)
		const idle = (c) => c.phase === 'off' && c.glows === 0 && c.puffs === 0 && Math.abs(c.skew) < 1e-9;
		check(W.before.length > 0 && W.before.every((list) => list.every(idle)), `${S.name}: no van does anything of its win before the lines show (${W.before.length} samples)`, W.before.flat().find((c) => !idle(c)));
		const at = (r, cell) => r.vans.find((c) => c.cell === cell);
		const live = W.rows.filter((r) => r.vans.some((c) => c.winActive));
		check(W.rows.every((r) => OTHER.every((cell) => still(at(r, cell)))), `${S.name}: the two vans not in the win never move`);
		const phases = new Set();
		let wrongPhase = 0;
		let unfit = 0;
		let puffInRock = 0;
		let glowInLurch = 0;
		let outOfStep = 0;
		for (const r of live) {
			const ms = r.vans[0].winMs;
			const cars = WIN_CELLS.map((cell) => at(r, cell));
			for (const c of cars) {
				phases.add(c.phase);
				if (c.phase !== (ms < T.lurchMs ? 'lurch' : 'rock')) wrongPhase += 1;
				if (!c.fit) unfit += 1;
				if (c.phase === 'lurch' && c.glows > 0) glowInLurch += 1;
			}
			if (new Set(cars.map((c) => `${c.phase}:${Math.abs(c.squat).toFixed(5)}:${c.glowAlpha}:${c.puffAlpha}`)).size !== 1) outOfStep += 1;
			void puffInRock;
		}
		const puffs = live.filter((r) => at(r, WIN_CELLS[0]).puffAlpha > 0.05).length;
		const glows = live.filter((r) => at(r, WIN_CELLS[0]).glowAlpha > 0.05).length;
		const leans = live.map((r) => at(r, WIN_CELLS[0]).lean);
		const squats = live.map((r) => at(r, WIN_CELLS[0]).squat);
		check(live.length > 20 && wrongPhase === 0 && phases.has('lurch') && phases.has('rock'), `${S.name}: the lurch for ${T.lurchMs} ms, then the rocking (${live.length} frames of the win)`, { wrongPhase, phases: [...phases] });
		check(outOfStep === 0, `${S.name}: the three winning vans move together, in step`, { outOfStep });
		check(puffs > 5 && glows > 10 && glowInLurch === 0, `${S.name}: the backfire's puffs show (${puffs} frames) and the flashlight shows in the rocking only (${glows} frames)`, { puffs, glows, glowInLurch });
		check(unfit === 0, `${S.name}: no flashlight glow wider than the glass is deep at its slot (it stays inside the windows)`, { unfit });
		check(Math.max(...squats.map(Math.abs)) > 0.01 && Math.max(...leans.map(Math.abs)) > 0.01, `${S.name}: the body squats (up to ${(Math.max(...squats.map(Math.abs)) * 180 / Math.PI).toFixed(2)} deg) and leans (up to ${(Math.max(...leans.map(Math.abs)) * 180 / Math.PI).toFixed(2)} deg)`);
		const endFrame = W.rows.findIndex((r, k) => k > 0 && W.rows[k - 1].vans.some((c) => c.winActive) && !r.vans.some((c) => c.winActive));
		check(endFrame > 0 && W.rows[endFrame].vans.every(still), `${S.name}: on the frame the win's hold ends every van is upright on its mark, nothing drawn (frame ${endFrame})`, W.rows[endFrame]);
		check(W.after.every(still), `${S.name}: all still after the round`, W.after);
		if (OUT) {
			const md = [`# The van's win per frame (${S.vp.width}x${S.vp.height}, the board clock stepped at 60 Hz from the frame the lines show; the van in reel 1, row 2)`, '', `Tilt: the body's rotation (degrees; the squat about the rear wheel, nose up). Lean: its skew (degrees). Glow: the brightest flashlight glow's x (road px) and alpha. Puff: the brightest puff's alpha.`, '', '| frame | win ms | phase | tilt (deg) | lean (deg) | bounce | glow x | glow alpha | glows shown | puff alpha |', '|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|'];
			for (const r of W.rows) {
				const c = at(r, WIN_CELLS[0]);
				md.push(`| ${r.i} | ${c.winMs ?? ''} | ${c.phase} | ${(c.squat * 180 / Math.PI).toFixed(2)} | ${(c.lean * 180 / Math.PI).toFixed(2)} | ${c.bounce.toFixed(4)} | ${c.glowX || ''} | ${c.glowAlpha} | ${c.glows} | ${c.puffAlpha} |`);
			}
			writeFileSync(join(OUT, `van_table_${S.name}.md`), md.join('\n') + '\n');
		}

		// THE COST, and the stills: the win again, frozen on the puffs and on a bright flashlight
		// (the press waits for a ready key and must start a round, as in playWin: startRound)
		const C = await startRound(p, { book: BOOK, turbo: 0 });
		// freeze once the lanes have stopped, then step to the frame the lines show (the win's first frame)
		for (let i = 0; i < 800; i++) {
			if (await R(p, () => window.__reindeer.road().lanesStopped.every(Boolean) && window.__reindeer.road().atRest)) {
				C.landed = true;
				break;
			}
			await sleep(10);
		}
		await R(p, () => window.__reindeer.clock(0));
		for (let i = 0; i < 200 && !C.shown; i++) {
			C.shown = await R(p, (ms) => (window.__reindeer.roadSounds().some((e) => e.what === 'lines') ? true : (window.__reindeer.step(ms, 1), false)), FRAME);
			await sleep(0);
		}
		checkStart(S, 'the cost', C);
		const cost = {};
		// the puff moment (the second puff a third through its life), then the brightest glow in the rocking
		const glowFrame = (() => {
			let best = null;
			for (const r of live) {
				const c = at(r, WIN_CELLS[0]);
				if (c.phase === 'rock' && (!best || c.glowAlpha > best.a)) best = { a: c.glowAlpha, ms: c.winMs };
			}
			return best ? best.ms : T.lurchMs + 300;
		})();
		let done = 0;
		for (const [label, ms] of [
			['puff', T.puffs[1] + 120],
			['light', glowFrame],
		]) {
			await R(p, (n) => window.__reindeer.step(1000 / 60, n), Math.max(0, Math.round((ms - done) / FRAME)));
			done = Math.max(done, Math.round(ms / FRAME) * FRAME);
			await sleep(200);
			const read = async () =>
				R(p, async () => {
					const b = { ...window.__dc };
					await new Promise((r) => setTimeout(r, 700));
					return { callsPerFrame: Math.round(((window.__dc.calls - b.calls) / Math.max(1, window.__dc.frames - b.frames)) * 100) / 100, vans: window.__reindeer.vans(), sprites: window.__reindeer.roadSprites() };
				});
			const on = await read();
			if (OUT) {
				const buf = await p.screenshot();
				writeFileSync(join(OUT, `van_${S.name}_${label}.png`), buf);
				crops[`${S.name}_${label}`] = await R(p, () => {
					const h = window.__reindeer;
					const L = h.boardLayout();
					const k = L.css.pitch / 250;
					const toCss = (x, y) => ({ x: L.css.x + (x - 142) * k, y: L.css.y + (y - 167) * k });
					const box = (cell) => {
						const reel = Math.floor(cell / 4);
						const row = cell % 4;
						const lines = [167, 338, 509, 680, 851];
						const cx = 142 + (reel + 0.5) * 250;
						const sit = lines[row + 1] - 10;
						// (wide on both sides: the puffs drift out behind the rear, left or right)
						const a = toCss(cx - 180, sit - 200);
						const b = toCss(cx + 180, sit + 12);
						return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
					};
					return { dpr: window.devicePixelRatio, H3_R: box(1), H3_L: box(6) };
				});
			}
			await R(p, () => (window.__reindeer.tune.vanWin.on = false));
			await R(p, () => window.__reindeer.step(0.001, 1));
			const off = await read();
			await R(p, () => (window.__reindeer.tune.vanWin.on = true));
			await R(p, () => window.__reindeer.step(0.001, 1));
			cost[label] = { on: on.callsPerFrame, off: off.callsPerFrame, sprites: on.sprites.sprites, spritesOff: off.sprites.sprites, van: on.vans.find((c) => c.cell === WIN_CELLS[0]) };
		}
		console.log(`  ${S.name} cost: draw calls per frame on the puffs ${cost.puff.on} (the van's win off ${cost.puff.off}), on the flashlight ${cost.light.on} (off ${cost.light.off}); road sprites ${cost.light.sprites} with it, ${cost.light.spritesOff} without`);
		await R(p, () => window.__reindeer.clock(1));
		for (let i = 0; i < 80; i++) {
			if (await R(p, () => window.__reindeer.atRest())) break;
			await sleep(150);
		}

		// A SLAM STOP during the win, and TURBO 2
		const slamAt = Math.ceil((T.lurchMs + 120) / FRAME);
		const slam = await playWin(p, S, { slamAt });
		checkStart(S, 'the slam', slam);
		// THE SLAM PRESS, a line of its own (2026-11-22): a press never made is the probe's fault, never the game's, so it
		// fails here by name and the game's line below is not judged on a round that had no slam
		const slamFlags = { slammed: slam.slammed, winAtSlam: slam.winAtSlam, slamAt, nrows: slam.rows.length, started: slam.started, shown: slam.shown };
		check(slam.slammed, slam.slammed ? `${S.name}: the slam press was made while the win showed (frame ${slamAt})` : `${S.name}: the slam press was not made: no win was showing at the slam frame (${slamAt})`, slamFlags);
		const leftAfterSlam = slam.rows.filter((r) => !r.vans.some((c) => c.winActive) && !r.vans.every(still));
		const slamLine = `${S.name}: a slam stop during the win: nothing left once the win goes, every van upright on its mark`;
		if (slam.slammed) check(leftAfterSlam.length === 0 && slam.after.every(still), slamLine, { ...slamFlags, leftN: leftAfterSlam.length, bad: slam.after.filter((c) => !still(c)).map((c) => c.cell), left: leftAfterSlam[0], after: slam.after });
		else skip(slamLine, 'the slam press was not made (its own FAIL line above)');
		const t2 = await playWin(p, S, { turbo: 2 });
		checkStart(S, 'turbo 2', t2);
		check(t2.rows.filter((r) => !r.vans.some((c) => c.winActive) && !r.vans.every(still)).length === 0 && t2.after.every(still), `${S.name}: turbo 2: the van moves only while the win shows, still after`);
		check(errs.length === 0, `${S.name}: no page errors, no console errors`, errs);
		result[S.name] = { tune: T, rows: W.rows.length, cost };
		await ctx.close();
	}
} finally {
	await browser.close();
}
if (OUT) writeFileSync(join(OUT, 'van_crops.json'), JSON.stringify(crops, null, 1));
console.log(`\n${pass} passed, ${fail} failed${fails.length ? '\n  ' + fails.join('\n  ') : ''}`);
if (OUT) writeFileSync(join(OUT, 'van_win_probe.json'), JSON.stringify({ pass, fail, fails, ...result }, null, 1));
process.exit(fail ? 1 : 0);
