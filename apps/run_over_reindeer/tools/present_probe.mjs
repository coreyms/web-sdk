// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// THE PRESENT PROBE (the scatter present, Corey 2026-11-15; game/road/present.ts, tools/build_present.py). From the
// running game with its board clock frozen and stepped one 30 fps frame at a time (__reindeer.clock(0), step), at each
// size:
//   - the placeholder is gone: the symbol atlas has no S frame, and a present on the road draws the present's own still
//     (its texture is the still sheet's size, nothing from the atlas)
//   - a landing peek: a book with two presents and no trigger. Each present plays the peek once, from its stop point
//     (its 11 slots, o01 .. c09), and never the full open
//   - the peek does not lengthen the spin: the same book with the peek switched off (__reindeer.tune.present.peek.on)
//     has the same drive in schedule (to 0.5 ms), comes to rest and ends within one 33 ms step of it (the convoy sets
//     off on or off the step grid by the fetch's real time), with the same gap from rest to the round's end
//   - a trigger (the natural_free_spins book): the trigger's presents, and only they, play the full open (open, hold,
//     close) with the light on; the open's sheets are in for it and let go after it (presentMemory), the peek's stay
//   - THE RED PRESENT (Corey 2026-11-17, design E): in a spin with 4 or more presents (natural_super, 4; a posed book with
//     5), the 4th and the 5th present to appear (first frame out of the tunnel, the landing order the tease counts) are
//     red from their first frame (the red still, or the red pieces while they animate) and the first three never are;
//     on the Super trigger all four play the full open (open, hold, close), the red one with the red pieces; a spin with
//     fewer than 4 (the peek book, natural_free_spins) never shows red; the red sheets are let go after the trigger
//   - no page errors (the Pixi 8 "reading 'addressModeU'" one included) and no console errors
// It records the presents' GPU weight per tier (at rest and at the trigger's peak) and the frame counts of each clip.
// With OUT=<dir> and SUPER_FRAMES=1 also a 30 fps frame sequence of the natural_super spin at 1440x900 (frames_super_1440x900).
// With OUT=<dir> it writes present_probe.json and the per-frame tables (peek_<size>.md, trigger_<size>.md); with FRAMES=1
// also a 30 fps frame sequence of the peek and the trigger at 1440x900 and 390x844 (the caller makes the mp4 files with
// ffmpeg) and, with STILLS=1, the present in its cell next to its neighbours (closed, peek peak, open hold) at 4x
// (desktop) and 3x (phone).
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [OUT=<dir>] [FRAMES=1] [STILLS=1] \
//     [ONLY=a,b] node tools/present_probe.mjs
// Uses the dev server that is already running (it never starts one). One headless browser, closed at the end. Take the
// shared browser lock around it (mkdir /tmp/hud_mock_shot.lock ... rmdir).
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3014';
const OUT = process.env.OUT || '';
const FRAMES = process.env.FRAMES === '1';
const STILLS = process.env.STILLS === '1';
const SUPER_FRAMES = process.env.SUPER_FRAMES === '1';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'assets');
if (OUT) mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STEP = 1000 / 30;

const SIZES = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, dpr: 1, phone: false, frames: true },
	{ name: 'portrait', vp: { width: 390, height: 844 }, dpr: 2, phone: true, frames: true },
	{ name: 'short', vp: { width: 390, height: 620 }, dpr: 2, phone: true },
	{ name: 'landscape', vp: { width: 844, height: 390 }, dpr: 2, phone: true },
];
// two presents (reel 2 row 2, reel 4 row 3), nothing that pays, no trigger
const PEEK_BOOK = [
	{ index: 0, type: 'reveal', gameType: 'basegame', board: [['L4', 'H3', 'L2', 'H2'], ['L3', 'S', 'L4', 'L5'], ['L3', 'L5', 'L5', 'L4'], ['H4', 'L4', 'S', 'L4'], ['H3', 'L1', 'L4', 'H1']] },
	{ index: 1, type: 'finalWin', amount: 0 },
];
const PEEK_CELLS = [5, 14];
const TRIGGER_CELLS = [3, 15, 16]; // natural_free_spins: freeSpinTrigger cells
const SUPER_CELLS = [1, 11, 12, 19]; // natural_super: freeSpinTrigger cells (4 presents)
// five presents, one per reel (a posed book: the base game can land 5, about 1 spin in 100,000), nothing that pays
const FIVE_BOOK = [
	{ index: 0, type: 'reveal', gameType: 'basegame', board: [['L4', 'S', 'L2', 'H2'], ['L3', 'L1', 'S', 'L5'], ['S', 'L5', 'L5', 'L4'], ['H4', 'L4', 'L1', 'S'], ['H3', 'S', 'L4', 'H1']] },
	{ index: 1, type: 'finalWin', amount: 0 },
];

/** THE RED PRESENT'S CHECK of a stepped run: per present cell its first frame on screen (out of the tunnel), the order of
 *  those, and whether it was red on every frame it showed (still: the red still sheet; animating: the red pieces) */
function redOrder(run) {
	const first = new Map();
	const frames = new Map();
	// only this spin's presents: a cell counts from the frame its present is seen driving in (the board before it, at rest
	// or driving out at the start of the run, is not this spin's)
	const arrived = new Set();
	run.log.forEach((s, i) => {
		for (const x of s.presents) {
			if (x.phase === 'in') arrived.add(x.cell);
			if (!arrived.has(x.cell) || x.phase === 'out' || x.phase === 'through') continue;
			const shown = x.stillDrawn || x.busy;
			if (!shown) continue;
			if (!first.has(x.cell)) first.set(x.cell, i);
			const red = x.busy ? x.variant === 'red' : x.stillRed;
			const f = frames.get(x.cell) ?? { red: 0, teal: 0, flag: x.red };
			f[red ? 'red' : 'teal'] += 1;
			frames.set(x.cell, f);
		}
	});
	const order = [...first.entries()].sort((a, b) => a[1] - b[1]).map(([cell, step]) => ({ cell, step }));
	// a tie on the frame where the 3rd and the 4th first show would make "the 4th" a guess
	const ties = order.length > 3 && order[3].step === order[2].step;
	const traceVariant = {};
	for (const r of run.trace) (traceVariant[r.cell] ??= new Set()).add(r.variant);
	return { order, frames: Object.fromEntries(frames), ties, traceVariant: Object.fromEntries(Object.entries(traceVariant).map(([c, v]) => [c, [...v].join(',')])) };
}
/** no red on this spin's presents (from the frame each is seen driving in; the board before it may leave red) */
const noRed = (run) => {
	const arrived = new Set();
	return run.log.every((s) => s.presents.every((x) => {
		if (x.phase === 'in') arrived.add(x.cell);
		if (!arrived.has(x.cell) || x.phase === 'out' || x.phase === 'through') return true;
		return !x.red && !x.stillRed && (!x.busy || x.variant !== 'red');
	})) && run.trace.filter((r) => r.t >= (run.tIn ?? 0)).every((r) => r.variant === 'teal');
};
const BANNED_ERR = /addressModeU|Cannot read properties of null/;

let pass = 0;
let fail = 0;
const fails = [];
const check = (ok, msg, detail) => {
	if (ok) pass += 1;
	else {
		fail += 1;
		fails.push(msg);
	}
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
};

async function boot(browser, S) {
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.dpr, isMobile: S.phone, hasTouch: S.phone });
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=present${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 160; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && !document.querySelector('.landing'))).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	// the peek's sheet loads in the background after the board is up
	for (let i = 0; i < 40 && !(await p.evaluate(() => window.__reindeer.presentMemory().peek.loaded)); i++) await sleep(250);
	await sleep(500);
	return { ctx, p, errs };
}

const R = (p, fn, arg) => p.evaluate(fn, arg);

/** press Spin with the clock frozen, then step 30 fps frames until the round is over (or `until` says stop). Each frame:
 *  the board clock, whether the cars are at rest, whether the round is busy, and (frames) a screenshot. */
async function playStepped(p, { frames = null, maxSteps = 900, stopWhen = null } = {}) {
	await R(p, () => window.__reindeer.presentTrace(true));
	await R(p, () => window.__reindeer.clock(0));
	await R(p, () => window.__reindeer.hud.emit({ type: 'bet' }));
	const log = [];
	let tIn = null;
	let tRest = null;
	let tDone = null;
	for (let i = 0; i < maxSteps; i++) {
		const s = await R(p, (ms) => {
			const snap = window.__reindeer.step(ms, 1);
			return { clock: snap.clock, rest: snap.atRest, inPhase: snap.phases.in ?? 0, idle: window.__reindeer.atRest(), presents: snap.presents, spin: snap.spin };
		}, STEP);
		if (tIn === null && s.inPhase > 0) tIn = s.clock;
		if (tIn !== null && tRest === null && s.rest) tRest = s.clock;
		if (tIn !== null && tDone === null && s.idle) tDone = s.clock;
		log.push(s);
		if (frames && tIn !== null) await frames(i, s);
		// let the page's own timers (fetch latency, the handlers' waits) run between frames
		await sleep(frames ? 0 : 12);
		if (stopWhen && (await stopWhen(s, tIn, tRest, tDone))) break;
		if (!stopWhen && tDone !== null) break;
	}
	const spin = log[log.length - 1]?.spin ?? {};
	return { log, tIn, tRest, tDone, spin, trace: await R(p, () => window.__reindeer.presentTrace()) };
}

/** the clip's own table: one row per video frame (30 fps, frame n = the n-th picture of the clip), each present's
 *  numbers at that frame's board clock */
function videoTable(shots, trace, title) {
	const rows = [`# ${title}`, '', 'One row per frame of the mp4 (30 fps). ms: from the clip\'s first frame. Per present (cell): the delivered frame of that 30 fps slot (src), the frame drawn (shown; a dropped frame shows its nearest kept neighbour, "still" the closed picture), the lid lift (units; the pop tops out at 0.61), the lid tilt back (deg) and the light\'s level (glow, 0 to 1). A dash: that present is closed and still.', ''];
	const cells = [...new Set(trace.map((r) => r.cell))].sort((a, b) => a - b);
	rows.push(`| frame | ms | ${cells.map((c) => `cell ${c}: clip part slot src > shown, lift, tilt, glow`).join(' | ')} |`);
	rows.push(`|---|---|${cells.map(() => '---').join('|')}|`);
	const t0 = shots[0]?.clock ?? 0;
	shots.forEach((sh, n) => {
		const at = trace.filter((r) => Math.abs(r.t - sh.clock) < 0.6);
		rows.push(`| ${n} | ${Math.round(sh.clock - t0)} | ${cells.map((c) => {
			const r = at.find((x) => x.cell === c);
			return r ? `${r.kind} ${r.part} ${r.slot} ${r.src} > ${r.show}, ${r.lift.toFixed(3)}, ${r.pitch.toFixed(1)}, ${r.glow.toFixed(2)}` : '-';
		}).join(' | ')} |`);
	});
	return rows.join('\n') + '\n';
}

function table(trace, t0, title) {
	const rows = [`# ${title}`, '', 'Board clock ms from the first present frame; one row per present per 30 fps frame. lift: the delivered lid lift (units, 0.61 at the pop\'s peak); tilt: the lid\'s pitch back (deg); glow: the light\'s level (0 to 1); src: the delivered frame of that 30 fps slot; shown: the frame drawn (a dropped frame shows its nearest kept neighbour).', '', '| ms | cell | clip | part | slot | src | shown | lift | tilt | glow |', '|---|---|---|---|---|---|---|---|---|---|'];
	for (const r of trace) rows.push(`| ${Math.round(r.t - t0)} | ${r.cell} | ${r.kind} | ${r.part} | ${r.slot} | ${r.src} | ${r.show} | ${r.lift.toFixed(3)} | ${r.pitch.toFixed(1)} | ${r.glow.toFixed(2)} |`);
	return rows.join('\n') + '\n';
}

async function stills(p, S, tag) {
	// a posed board, the present in reel 3 row 3 with its neighbours; closed, the peek's peak (o04), the open's hold
	const board = [['L4', 'H3', 'L2', 'H2'], ['L3', 'H2', 'L1', 'L5'], ['L3', 'L5', 'S', 'H4'], ['H4', 'L2', 'L3', 'L4'], ['H3', 'L1', 'L4', 'H1']];
	await R(p, (b) => window.__reindeer.setBoard(b), board);
	await R(p, () => window.__reindeer.clock(0));
	await R(p, (ms) => window.__reindeer.step(ms, 2), STEP);
	const lay = await R(p, () => window.__reindeer.boardLayout().css);
	const cw = lay.width / 5;
	const ch = lay.height / 4;
	const clip = { x: Math.max(0, lay.x + 1 * cw), y: Math.max(0, lay.y + 0.6 * ch), width: 3 * cw, height: 3.2 * ch };
	const shot = async (name) => p.screenshot({ path: join(OUT, `still_${tag}_${name}.png`), clip });
	await shot('closed');
	await R(p, () => window.__reindeer.presentPeek(10));
	await R(p, () => window.__reindeer.step(1000 / 30, 3)); // slot 3: o04, the lid's highest in the peek
	await shot('peek_peak');
	await R(p, () => window.__reindeer.step(1000 / 30, 12));
	await R(p, () => window.__reindeer.presentLoad('open'));
	void R(p, () => window.__reindeer.presentOpen([10]));
	await sleep(300);
	await R(p, () => window.__reindeer.step(1000 / 30, 24)); // through the open into its hold
	await shot('open_hold');
	await R(p, () => window.__reindeer.step(1000 / 30, 40));
	await R(p, () => window.__reindeer.clock(1));
	return clip;
}

/** THE RED PRESENT on a Super trigger: a fresh page (the base game at rest), natural_super stepped from the press to the
 *  presents closed again; the Super round that follows is not played */
async function runSuper(browser, S, report) {
	const { ctx, p, errs } = await boot(browser, S);
	const name = `${S.name} ${S.vp.width}x${S.vp.height}`;
	const out = report.find((r) => r.size === name) ?? { size: name };
	// ---- THE RED PRESENT: a Super trigger (natural_super, 4 presents) ----
	await R(p, () => window.__reindeer.fixtures.next('natural_super'));
	const shotsSuper = SUPER_FRAMES && OUT && S.name === 'desktop' ? join(OUT, `frames_super_${S.vp.width}x${S.vp.height}`) : null;
	if (shotsSuper) mkdirSync(shotsSuper, { recursive: true });
	let superPeak = null;
	let superOpen = false;
	const sup = await playStepped(p, {
		maxSteps: 500,
		frames: async (i, s) => {
			const m = await R(p, () => window.__reindeer.presentMemory());
			if (!superPeak || m.totalMb > superPeak.totalMb) superPeak = m;
			if (s.presents.some((x) => x.opening)) superOpen = true;
			if (shotsSuper) await p.screenshot({ path: join(shotsSuper, `f${String(i).padStart(4, '0')}.png`) });
		},
		stopWhen: async (s) => superOpen && !s.presents.some((x) => x.busy),
	});
	const rs = redOrder(sup);
	const redCells = rs.order.slice(3).map((o) => o.cell);
	const tealCells = rs.order.slice(0, 3).map((o) => o.cell);
	check(rs.order.length === 4 && !rs.ties, `${name}: natural_super: 4 presents, appearing in order ${rs.order.map((o) => `${o.cell}@${o.step}`).join(', ')} (no tie at the 3rd / 4th)`, rs.order);
	check(redCells.every((c) => rs.frames[c].teal === 0 && rs.frames[c].red > 0 && rs.frames[c].flag), `${name}: natural_super: the 4th present (cell ${redCells.join(',')}) is red on every frame from its first appearance`, rs.frames);
	check(tealCells.every((c) => rs.frames[c].red === 0 && !rs.frames[c].flag), `${name}: natural_super: the first three (cells ${tealCells.join(',')}) are teal on every frame`, rs.frames);
	const sOpen = sup.trace.filter((r) => r.kind === 'open');
	const sParts = (c) => [...new Set(sOpen.filter((r) => r.cell === c).map((r) => r.part))].join(',');
	check(SUPER_CELLS.every((c) => sParts(c) === 'open,hold,close'), `${name}: natural_super: all four presents play the full open (open, hold, close)`, Object.fromEntries(SUPER_CELLS.map((c) => [c, sParts(c)])));
	check(SUPER_CELLS.every((c) => rs.traceVariant[c] === (redCells.includes(c) ? 'red' : 'teal')), `${name}: natural_super: the red present animates with the red pieces only, the teal ones with the teal pieces only`, rs.traceVariant);
	check(superPeak && superPeak.openRed.sheets.length > 0 && superPeak.peekRed.sheets.length > 0 && superPeak.open.sheets.length > 0, `${name}: natural_super: the red peek and open sheets and the teal open were in for the trigger`, superPeak);
	let superAfter = null;
	await R(p, () => window.__reindeer.clock(1));
	for (let i = 0; i < 20; i++) {
		superAfter = await R(p, () => window.__reindeer.presentMemory());
		if (!superAfter.open.sheets.length && !superAfter.openRed.sheets.length && !superAfter.peekRed.sheets.length) break;
		await sleep(150);
	}
	check(superAfter && !superAfter.openRed.sheets.length && !superAfter.peekRed.sheets.length && !superAfter.open.sheets.length && superAfter.peek.loaded, `${name}: natural_super: after the trigger the red sheets and the teal open are let go, the teal peek stays`, superAfter);
	out.super = { order: rs.order, red: redCells, frames: rs.frames, traceVariant: rs.traceVariant, peakMemory: superPeak, afterMemory: superAfter };
	if (OUT) writeFileSync(join(OUT, `super_${S.vp.width}x${S.vp.height}.md`), table(sOpen, sOpen[0]?.t ?? 0, `Super trigger (natural_super), ${name}`));
	check(errs.length === 0, `${name}: natural_super: no page or console errors`, errs.slice(0, 5));
	await ctx.close();
}

async function runSize(browser, S, report) {
	const { ctx, p, errs } = await boot(browser, S);
	const name = `${S.name} ${S.vp.width}x${S.vp.height}`;
	const out = { size: name };

	// ---- the placeholder is gone ----
	const atlas = JSON.parse(readFileSync(join(ASSETS, 'symbols', S.phone ? 'symbols-phone.json' : 'symbols.json'), 'utf8'));
	check(!('S' in atlas.frames), `${name}: the symbol atlas has no S (placeholder) frame`);
	const spec = await R(p, () => window.__reindeer.presentMemory());
	await R(p, (b) => window.__reindeer.setBoard(b), PEEK_BOOK[0].board);
	const still = await R(p, () => window.__reindeer.road().presents);
	const specSrc = readFileSync(join(ASSETS, '..', '..', 'src', 'game', 'presentSpec.ts'), 'utf8');
	const stillSpec = JSON.parse(specSrc.slice(specSrc.indexOf('{'), specSrc.lastIndexOf('}') + 1)).tiers[S.phone ? 'phone' : 'full'].still;
	const want = { w: stillSpec.w, h: stillSpec.h };
	check(still.length === 2 && still.every((s) => s.stillDrawn && s.frame && s.frame.w === want.w && s.frame.h === want.h), `${name}: a present on the road draws the present's still (${want.w} x ${want.h} sheet), not the atlas`, still);
	out.memoryAtRest = spec;

	// ---- the peek ----
	await R(p, (ev) => window.__reindeer.fixtures.queue(ev, 0), PEEK_BOOK);
	const shotsPeek = FRAMES && S.frames && OUT ? join(OUT, `frames_peek_${S.vp.width}x${S.vp.height}`) : null;
	if (shotsPeek) mkdirSync(shotsPeek, { recursive: true });
	let firstPeek = null;
	const peekShots = [];
	const on = await playStepped(p, {
		frames: shotsPeek
			? async (i, s) => {
					const busy = s.presents.some((x) => x.busy);
					if (busy && firstPeek === null) firstPeek = i;
					if (firstPeek !== null || s.inPhase > 0) {
						await p.screenshot({ path: join(shotsPeek, `f${String(i).padStart(4, '0')}.png`) });
						peekShots.push({ file: `f${String(i).padStart(4, '0')}.png`, clock: s.clock });
					}
				}
			: null,
	});
	const peeks = on.trace.filter((r) => r.kind === 'peek');
	const opens = on.trace.filter((r) => r.kind === 'open');
	const perCell = Object.fromEntries(PEEK_CELLS.map((c) => [c, peeks.filter((r) => r.cell === c)]));
	check(PEEK_CELLS.every((c) => perCell[c].length === 11 && perCell[c][0].src === 'o01' && perCell[c][10].src === 'c09'), `${name}: each landed present plays the peek once, o01 to c09 (11 frames)`, Object.fromEntries(PEEK_CELLS.map((c) => [c, perCell[c].map((r) => r.src).join(',')])));
	check(opens.length === 0, `${name}: no full open without a trigger`, opens.length);
	check(noRed(on), `${name}: a spin with 2 presents never shows red (still or pieces)`);
	const peakLift = Math.max(...peeks.map((r) => r.lift));
	check(peakLift > 0.1 && peakLift < 0.15, `${name}: the peek's lid lift tops out at a little (${peakLift.toFixed(3)} units; the full pop is 0.61)`);
	await R(p, () => (window.__reindeer.tune.present.peek.on = false));
	await R(p, (ev) => window.__reindeer.fixtures.queue(ev, 0), PEEK_BOOK);
	const off = await playStepped(p);
	await R(p, () => (window.__reindeer.tune.present.peek.on = true));
	// the drive in's own schedule (exact), and what was seen: the cars at rest and the round's end, from the convoy's
	// start, on the 33 ms step grid (the convoy starts off the grid in one run and on it in another: one step apart at most)
	const span = (r) => ({ schedule: Math.round((r.spin.homeAt - r.spin.convoyAt) * 10) / 10, rest: Math.round(r.tRest - r.spin.convoyAt), done: Math.round(r.tDone - r.spin.convoyAt) });
	const dOn = span(on);
	const dOff = span(off);
	check(off.trace.filter((r) => r.kind === 'peek').length === 0, `${name}: with the peek off no present animates (the control run)`);
	check(Math.abs(dOn.schedule - dOff.schedule) < 0.5 && Math.abs(dOn.rest - dOff.rest) < STEP + 1 && Math.abs(dOn.done - dOff.done) < STEP + 1 && Math.abs(dOn.done - dOn.rest - (dOff.done - dOff.rest)) <= 1, `${name}: the peek does not lengthen the spin (drive in ${dOn.schedule} vs ${dOff.schedule} ms with the peek off; seen at rest ${dOn.rest} vs ${dOff.rest}, round over ${dOn.done} vs ${dOff.done} ms after the convoy set off)`, { on: dOn, off: dOff });
	out.peek = { slots: 11, framesPerPresent: perCell[PEEK_CELLS[0]].length, shown: [...new Set(peeks.map((r) => r.show))], spinWithPeek: dOn, spinWithoutPeek: dOff };
	if (OUT) writeFileSync(join(OUT, `peek_${S.vp.width}x${S.vp.height}.md`), table(peeks, peeks[0]?.t ?? 0, `Peek on landing, ${name}`));
	if (shotsPeek) writeFileSync(join(OUT, `clip_peek_${S.vp.width}x${S.vp.height}.md`), videoTable(peekShots, on.trace, `Clip: a book with two presents landing (peek), ${name}`));
	await R(p, () => window.__reindeer.clock(1));

	// ---- THE RED PRESENT: five presents (a posed book) ----
	await R(p, (ev) => window.__reindeer.fixtures.queue(ev, 0), FIVE_BOOK);
	const five = await playStepped(p);
	const r5 = redOrder(five);
	const red5 = r5.order.slice(3).map((o) => o.cell);
	const teal5 = r5.order.slice(0, 3).map((o) => o.cell);
	check(r5.order.length === 5 && !r5.ties, `${name}: five presents, appearing in order ${r5.order.map((o) => `${o.cell}@${o.step}`).join(', ')} (no tie at the 3rd / 4th / 5th)`, r5.order);
	check(red5.length === 2 && red5.every((c) => r5.frames[c].teal === 0 && r5.frames[c].red > 0 && r5.frames[c].flag), `${name}: five presents: the 4th and 5th (cells ${red5.join(',')}) are red on every frame from their first appearance`, r5.frames);
	check(teal5.every((c) => r5.frames[c].red === 0 && !r5.frames[c].flag), `${name}: five presents: the first three (cells ${teal5.join(',')}) are teal on every frame`, r5.frames);
	const p5 = five.trace.filter((r) => r.kind === 'peek');
	const peeked = (c) => p5.filter((r) => r.cell === c).length;
	check(r5.order.every((o) => peeked(o.cell) === 11) && red5.every((c) => r5.traceVariant[c] === 'red') && teal5.every((c) => r5.traceVariant[c] === 'teal'), `${name}: five presents: every one plays its peek on landing, the red ones with the red pieces`, { peeked: Object.fromEntries(r5.order.map((o) => [o.cell, peeked(o.cell)])), variant: r5.traceVariant });
	out.five = { order: r5.order, red: red5, frames: r5.frames, traceVariant: r5.traceVariant };

	await R(p, () => window.__reindeer.clock(1));

	// ---- the trigger ----
	await R(p, () => window.__reindeer.fixtures.next('natural_free_spins'));
	const shotsTrig = FRAMES && S.frames && OUT ? join(OUT, `frames_trigger_${S.vp.width}x${S.vp.height}`) : null;
	if (shotsTrig) mkdirSync(shotsTrig, { recursive: true });
	let peak = null;
	let openStarted = false;
	let after = null;
	const trigShots = [];
	const trig = await playStepped(p, {
		maxSteps: 400,
		frames: async (i, s) => {
			const m = await R(p, () => window.__reindeer.presentMemory());
			if (!peak || m.totalMb > peak.totalMb) peak = m;
			const busy = s.presents.some((x) => x.opening);
			if (busy) openStarted = true;
			if (shotsTrig && (s.presents.some((x) => x.busy) || openStarted)) {
				await p.screenshot({ path: join(shotsTrig, `f${String(i).padStart(4, '0')}.png`) });
				trigShots.push({ file: `f${String(i).padStart(4, '0')}.png`, clock: s.clock });
			}
		},
		stopWhen: async (s) => openStarted && !s.presents.some((x) => x.busy),
	});
	// the let-go waits two rendered frames after the batches are rebuilt: give the page real frames
	await R(p, () => window.__reindeer.clock(1));
	for (let i = 0; i < 20; i++) {
		after = await R(p, () => window.__reindeer.presentMemory());
		if (!after.open.sheets.length) break;
		await sleep(150);
	}
	const tOpen = trig.trace.filter((r) => r.kind === 'open');
	const cells = [...new Set(tOpen.map((r) => r.cell))].sort((a, b) => a - b);
	check(JSON.stringify(cells) === JSON.stringify(TRIGGER_CELLS), `${name}: the full open plays on the trigger's presents, and only they (cells ${cells.join(',')})`);
	const parts = (c) => [...new Set(tOpen.filter((r) => r.cell === c).map((r) => r.part))].join(',');
	check(TRIGGER_CELLS.every((c) => parts(c) === 'open,hold,close'), `${name}: each plays open, hold, close`, Object.fromEntries(TRIGGER_CELLS.map((c) => [c, parts(c)])));
	const full = tOpen.filter((r) => r.cell === TRIGGER_CELLS[0]);
	check(Math.max(...full.map((r) => r.glow)) === 1 && Math.max(...full.map((r) => r.lift)) > 0.6, `${name}: with the light full and the whole pop (lift ${Math.max(...full.map((r) => r.lift)).toFixed(3)})`);
	check(peak && peak.open.sheets.length > 0, `${name}: the open's sheets were in for the trigger`, peak);
	check(after && after.open.sheets.length === 0 && !after.open.loaded && after.peek.loaded, `${name}: after the trigger the open's sheets are let go, the peek's stay`, after);
	check(noRed(trig) && after && !after.peekRed.sheets.length && !after.openRed.sheets.length, `${name}: a spin with 3 presents (natural_free_spins) never shows red, and no red sheet is held after it`, { peekRed: after?.peekRed, openRed: after?.openRed });
	out.trigger = { cells, rowsPerPresent: full.length, srcSlots: [...new Set(full.map((r) => r.src))].length, shownFrames: [...new Set(full.map((r) => r.show))].length, peakMemory: peak, afterMemory: after };
	if (OUT) writeFileSync(join(OUT, `trigger_${S.vp.width}x${S.vp.height}.md`), table(tOpen, tOpen[0]?.t ?? 0, `Trigger (natural_free_spins), ${name}`));
	if (shotsTrig) writeFileSync(join(OUT, `clip_trigger_${S.vp.width}x${S.vp.height}.md`), videoTable(trigShots, trig.trace, `Clip: the trigger book (natural_free_spins): the presents land, then the full open, ${name}`));

	if (STILLS && OUT && S.frames) {
		// a fresh page with the board at rest (the intro card is up on this one)
		const b = await boot(browser, { ...S, dpr: S.phone ? 3 : 2 });
		await stills(b.p, S, `${S.vp.width}x${S.vp.height}`);
		errs.push(...b.errs);
		await b.ctx.close();
	}

	const bad = errs.filter((e) => BANNED_ERR.test(e));
	check(bad.length === 0, `${name}: no "addressModeU" / null texture error`, bad);
	check(errs.length === 0, `${name}: no page or console errors`, errs.slice(0, 5));
	out.errors = errs;
	report.push(out);
	await ctx.close();
}

const browser = await chromium.launch({ args: ['--mute-audio'] });
const report = [];
try {
	for (const S of SIZES) {
		if (ONLY.length && !ONLY.includes(S.name)) continue;
		try {
			await runSize(browser, S, report);
			await runSuper(browser, S, report);
		} catch (e) {
			check(false, `${S.name}: ran to the end`, String(e?.stack ?? e).slice(0, 400));
		}
	}
} finally {
	await browser.close();
}
if (OUT) writeFileSync(join(OUT, 'present_probe.json'), JSON.stringify({ pass, fail, fails, report }, null, 1));
console.log(`\n${pass} passed, ${fail} failed${fails.length ? ':\n  ' + fails.join('\n  ') : ''}`);
process.exit(fail ? 1 : 0);
