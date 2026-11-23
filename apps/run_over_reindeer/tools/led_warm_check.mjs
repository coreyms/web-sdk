// @ts-nocheck: a node check script, not app code (svelte-check picks up .mjs files)
// THE CARDS MADE AHEAD, NODE ONLY (2026-11-22, wip/ledhitch; constants LED_BOARD.warm, game/scoreboard/warmGate.ts,
// scoreboard.ts prepare / warmStep, scoreboardDraw.ts advOf, ledSigns.ts signAdv). No browser: the game's own scoreboard
// (game/scoreboard/scoreboard.ts, the real class, its real programs) runs on a small software canvas made here (below), with
// pixi.js, the device tier and the staging flags stood in (the scoreboard's GPU side is not what is judged). It checks:
//   1. THE ADVANCES: a currency sign's advance alone (signAdv) is its dot count's (signDots adv) for every sign at every cap
//      from 1 to 200, so the size searches pick the caps they always did
//   2. DOT FOR DOT: the Free Spins entry, the Super entry, a Total Win in dollars and a capped Total Win (MAX WIN, its line,
//      the explanation page) on the upright phone's faces (259 x 189 dots, 1.5 LEDs per dot: 390 x 844 at device scale 3),
//      drawn step by step the old way (nothing made ahead, every picture made as the card comes up) and after the card was
//      made ahead (prepare, then frames of warmStep at a budget that stops it mid draw again and again): both faces' LEDs
//      hashed at every LED step from the card's start to past its press line are the same, step for step
//   3. NOTHING MADE AS IT COMES UP: after the card was made ahead its first 25 steps make no new canvas at all (the old way
//      made dozens on the first step: the Total Win's ~400 ms frame); the warm finished ('done') and let its scratch faces go
//   4. THE SMALL WIN (2026-11-22, wip/winlights; LED_BOARD.warm.small, scoreboard.ts prepareSmall): a line win's strip total
//      ($1,234.56 and $0.40, counted over LINE_WIN.slam stripCountMs) drawn the old way and after it was made ahead: the strip
//      dot for dot the same at every step from 450 ms to its end, and made ahead it makes no new canvas at any step it is up
//   5. THE GRID MADE AHEAD (2026-11-22, wip/ledpitch; LED_BOARD.warm.regrid, scoreboard.ts ensureFaces / regridHolds): since
//      the smallest dot rule (LED_BOARD.pitch) the dot count follows the window. With a Total Win up, and with the press
//      screen up, the phone is turned (390 x 844 to 844 x 390, the game's own geometry for each): the faces keep the grid
//      before, held, while the show is drawn ahead for the new one a little each frame; the board then changes to the new
//      grid, and the frames round the change make only the new faces' own canvases, where the old way (regrid off, the
//      faces rebuilt at once) makes the show's pictures in that one frame; from the change on both faces are dot for dot
//      what the old way shows at the same clock
// SINCE THE SMALLEST DOT RULE the upright phone's faces below are laid out by it (168 x 122 dots at one LED a dot, the
// strip 168 x 23: layout.ts ledPitchGeo at the phone floor), where they were 259 x 189 at 1.5.
// Each card in each way runs in its own node process (fresh caches, as a fresh page).
//   node --experimental-strip-types --no-warnings tools/led_warm_check.mjs      (from apps/run_over_reindeer)
// Pass: every line PASS, "0 fail" and exit 0.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { APP, canvasCount, geometryFor, install, patternSheet, src } from './led_node_kit.mjs';

const SELF = fileURLToPath(import.meta.url);
const CARDS = {
	fs: { kind: 'fs', spins: 10, amount: 0, presents: 3 },
	sfs: { kind: 'sfs', spins: 10, amount: 0, presents: 4 },
	total: { kind: 'total', spins: 0, amount: 1234.56, x: 123.456 },
	cap: { kind: 'total', spins: 0, amount: 77770, x: 7777, capped: true, title: 'MAX WIN', line: '7,777x the play amount, the most a round can award.' },
};
// the strip's small wins (a line win's total, counted at LINE_WIN.slam stripCountMs at turbo 0)
const SMALLS = {
	small: { amount: 1234.56, x: 12.3456 },
	smallCents: { amount: 0.4, x: 0.4 },
};

// ---- the parent: run every card both ways in child processes and compare -------------------------------------------------
if (process.argv[2] !== 'child') {
	let pass = 0;
	let fail = 0;
	const check = (ok, msg, detail) => {
		if (ok) pass++;
		else fail++;
		console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail).slice(0, 900) : ''}`);
	};
	const run = (mode, card, extra = '') => {
		const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', SELF, 'child', mode, card, extra], { cwd: APP, encoding: 'utf8', maxBuffer: 64 * 1048576 });
		const line = (r.stdout || '').split('\n').find((l) => l.startsWith('RESULT '));
		if (!line) return { error: (r.stderr || r.stdout || '').slice(-1500) };
		return JSON.parse(line.slice(7));
	};
	const adv = run('adv', 'none');
	check(!adv.error && adv.bad.length === 0 && adv.n > 0, `1. a sign's advance alone is its dot count's at every cap 1 to 200 (${adv.n} signs x caps checked)`, adv.error ?? adv.bad?.slice(0, 8));
	for (const card of Object.keys(SMALLS)) {
		const cold = run('cold', card);
		const warm = run('warm', card);
		if (cold.error || warm.error) {
			check(false, `${card}: both ways ran`, cold.error ?? warm.error);
			continue;
		}
		const n = Math.min(cold.strip.length, warm.strip.length);
		const bad = [];
		for (let i = 0; i < n; i++) if (cold.strip[i] !== warm.strip[i]) bad.push(i);
		check(n === cold.strip.length && n === warm.strip.length && n > 40, `4. ${card} (${SMALLS[card].amount}): ${n} steps both ways`, { cold: cold.strip.length, warm: warm.strip.length });
		check(bad.length === 0, `4. ${card}: the strip dot for dot the same at every step, made ahead or not`, bad.slice(0, 10));
		check(warm.warm?.state === 'done' && warm.warm.samples === warm.warm.of && warm.warm.made > 0, `4. ${card}: the small win made ahead ran to its end (${warm.warm?.state}, ${warm.warm?.samples} of ${warm.warm?.of} samples, ${warm.warm?.made} pictures over ${warm.frames} frames)`, warm.warm);
		check(cold.madeAll >= 3, `4. ${card}: the old way made ${cold.madeAll} canvases while it showed`, cold.madeAll);
		check(warm.madeAll === 0, `4. ${card}: made ahead, it makes no new canvas at any step (${warm.madeAll})`, warm.madeAll);
	}
	for (const card of Object.keys(CARDS)) {
		const cold = run('cold', card);
		const warm = run('warm', card);
		if (cold.error || warm.error) {
			check(false, `${card}: both ways ran`, cold.error ?? warm.error);
			continue;
		}
		const n = Math.min(cold.back.length, warm.back.length);
		const backBad = [];
		const stripBad = [];
		for (let i = 0; i < n; i++) {
			if (cold.back[i] !== warm.back[i]) backBad.push(i);
			if (cold.strip[i] !== warm.strip[i]) stripBad.push(i);
		}
		const lit = cold.lit.filter((v) => v > 0).length;
		check(n === cold.back.length && n === warm.back.length && n > 60 && lit > 20, `${card}: ${n} steps both ways (${lit} with the back board lit)`, { cold: cold.back.length, warm: warm.back.length, lit });
		check(backBad.length === 0, `2. ${card}: the back board dot for dot the same at every step, made ahead or not`, backBad.slice(0, 10));
		check(stripBad.length === 0, `2. ${card}: the strip dot for dot the same at every step, made ahead or not`, stripBad.slice(0, 10));
		check(warm.warm?.state === 'done' && warm.warm.samples > 20 && warm.yields > 0, `3. ${card}: the warm ran to its end (${warm.warm?.state}, ${warm.warm?.samples} samples, ${warm.warm?.made} pictures, stopped mid draw ${warm.yields} times over ${warm.frames} frames) and let its scratch faces go`, warm.warm);
		check(cold.madeFirst >= 10, `3. ${card}: the old way made ${cold.madeFirst} canvases on the card's first steps`, cold.madeFirst);
		check(warm.madeFirst === 0, `3. ${card}: made ahead, its first 25 steps make no new canvas (${warm.madeFirst})`, warm.madeFirst);
	}
	// 5. THE GRID MADE AHEAD: a show up, the phone turned
	for (const card of ['total', 'press']) {
		const warm = run('regrid', card, 'warm');
		const cold = warm.error ? warm : run('regrid', card, String(warm.held));
		if (cold.error || warm.error) {
			check(false, `5. ${card}: both ways ran`, cold.error ?? warm.error);
			continue;
		}
		check(warm.keyA !== warm.keyB && cold.keyB === warm.keyB, `5. ${card}: the turn changes the grid (${warm.keyA} to ${warm.keyB})`, { warm: [warm.keyA, warm.keyB], cold: [cold.keyA, cold.keyB] });
		check(warm.held >= 2 && warm.heldKey === warm.keyA && warm.job?.state === 'done' && warm.job.samples > 5, `5. ${card}: the faces kept the grid before for ${warm.held} frames while the show was made ahead (${warm.job?.state}, ${warm.job?.samples} samples, ${warm.job?.made} pictures)`, warm.job);
		check(cold.heldAtOnce === false && cold.madeAtChange > warm.madeAtChange && warm.madeAtChange <= warm.faceCanvases + 2, `5. ${card}: the frames round the change make ${warm.madeAtChange} canvases (the new faces' own ${warm.faceCanvases}); rebuilt at once, ${cold.madeAtChange}`, { warm: warm.madeAtChange, cold: cold.madeAtChange });
		const bad = [];
		for (let i = 0; i < warm.hashes.length; i++) if (warm.hashes[i] !== cold.hashes[i]) bad.push(i);
		check(warm.hashes.length >= 40 && bad.length === 0, `5. ${card}: from the change on both faces are dot for dot the old way's at the same clock (${warm.hashes.length} frames)`, bad.slice(0, 10));
	}
	console.log(`\nled_warm_check: ${pass} pass, ${fail} fail`);
	process.exit(fail ? 1 : 0);
}

// ---- the child: one card, one way --------------------------------------------------------------------------------------
const [, , , MODE, CARD, EXTRA] = process.argv;

// (the software canvas and the stand-ins: tools/led_node_kit.mjs)
install({ phoneTier: true, ratio: 3 });


if (MODE === 'adv') {
	const signs = await import(src('scoreboard/ledSigns.ts'));
	const bad = [];
	let n = 0;
	for (const ch of Object.keys(signs.AMOUNT_OUTLINES))
		for (let cap = 1; cap <= 200; cap++) {
			n += 1;
			const a = signs.signAdv(ch, cap);
			const d = signs.signDots(ch, cap);
			if (!d || a !== d.adv) bad.push({ ch, cap, adv: a, dots: d?.adv });
		}
	console.log('RESULT ' + JSON.stringify({ n, bad }));
	process.exit(0);
}

const { LED_BOARD } = await import(src('constants.ts'));
const draw = await import(src('scoreboard/scoreboardDraw.ts'));
const { Scoreboard } = await import(src('scoreboard/scoreboard.ts'));

// the art sheet: a fixed pattern at the sheet's size (scoreboardArtSpec.ts), so every picture bake runs
const { SCOREBOARD_ART } = await import(src('scoreboardArtSpec.ts'));
draw.setScoreboardArt(patternSheet(SCOREBOARD_ART.width, SCOREBOARD_ART.height));
const fmt = (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

if (MODE === 'regrid') {
	// 5. THE GRID MADE AHEAD, one way: EXTRA 'warm' (regrid on: the frames the faces were held are counted), or that count
	// (regrid off: the faces rebuilt at once, then as many frames before the same 45 are read)
	const screens = await import(src('landing/ledScreens.ts'));
	const { LED_ART } = await import(src('ledArtSpec.ts'));
	const { LED_WILDS } = await import(src('ledWildsSpec.ts'));
	const { LED_SIGN } = await import(src('constants.ts'));
	screens.setLedArt({ image: patternSheet(LED_ART.width, LED_ART.height), frames: LED_ART.frames });
	screens.setLedWildArt({ image: patternSheet(LED_WILDS.tiers.phone.width, LED_WILDS.tiers.phone.height), frames: LED_WILDS.tiers.phone.frames }, 'phone');
	const geoA = await geometryFor(390, 844);
	const geoB = await geometryFor(844, 390);
	const warmWay = EXTRA === 'warm';
	LED_BOARD.warm.budgetMs = 25;
	LED_BOARD.warm.regridMaxMs = 1e9;
	LED_BOARD.warm.regrid = warmWay;
	const sb = new Scoreboard();
	sb.deviceRatio = () => 3;
	sb.layout(geoA, []);
	const env = { free: CARD === 'total', left: 0, idle: false, scatter: null };
	if (CARD === 'press') {
		const T = LED_SIGN.text;
		sb.press({ win: { top: T.winTop, num: '7,777X' }, sleigh: { head: T.sleighHead, body: T.sleighBody, mult: T.sleighMult }, car: { head: T.carHead, body: T.carBody, mult: T.carMult, bodyScales: [2, 1] }, face: { head: T.faceHead, body: T.faceBody }, ticker: T.ticker });
		sb.pressGate(true);
	} else sb.card({ kind: 'total', spins: 0, amount: 1234.56, fmt, rate: 1, title: null, line: null, x: 123.456, capped: false, auto: false, presents: 0 });
	const FRAME = 1000 / 60;
	for (let i = 0; i < 90; i++) sb.update(FRAME, env);
	const keyA = sb.ledsInfo().key;
	const faceCanvases = 10; // (two faces: out, a, b, prev and the halo each)
	let before = canvasCount();
	sb.layout(geoB, []);
	const heldAtOnce = sb.ledsInfo().held;
	const heldKey = sb.ledsInfo().key;
	let held = 0;
	let madeAtChange = 0;
	if (warmWay) {
		while (sb.ledsInfo().held && held < 200000) {
			before = canvasCount();
			sb.update(FRAME, env);
			held += 1;
		}
		for (let i = 0; i < 2; i++) sb.update(FRAME, env);
		madeAtChange = canvasCount() - before;
	} else {
		for (let i = 0; i < 3; i++) sb.update(FRAME, env);
		madeAtChange = canvasCount() - before;
		for (let i = 3; i < Number(EXTRA) + 2; i++) sb.update(FRAME, env);
	}
	const hashes = [];
	for (let i = 0; i < 45; i++) {
		sb.update(FRAME, env);
		hashes.push(sb.faceStats('back').hash + '/' + sb.faceStats('strip').hash);
	}
	console.log('RESULT ' + JSON.stringify({ keyA, keyB: sb.ledsInfo().key, heldAtOnce, heldKey, held, madeAtChange, faceCanvases, job: sb.warmInfo().find((j) => j.kind === 'regrid') ?? null, hashes }));
	process.exit(0);
}

// THE UPRIGHT PHONE'S FACES (390 x 844 at device scale 3; the place below is the one before the smallest dot rule, 259 dots
// across at 1.3 CSS px: the scoreboard lays its faces out by the rule, 168 x 122 and the strip's 168 x 23 at 2 CSS px a dot)
const face = (x, y, dotsW, dotsH, p) => ({ x, y, w: dotsW * p, h: dotsH * p, dotsW, dotsH });
const P = 1.3;
const geo = {
	cls: 'portrait',
	W: 390,
	H: 844,
	pitch: P,
	f: 7,
	ol: 7 / 3,
	strip: { box: { x: 19.5, y: 600, w: 351, h: 71 }, face: face(26.5, 612, 259, 36, P), housing: { x: 19.5, y: 600, w: 351, h: 66 }, cap: 9.3 },
	back: { face: face(26.5, 330, 259, 189, P), housing: { x: 19.5, y: 318, w: 351, h: 265 }, cap: 14, backH: 280, sc: 280 / 420 },
	dim: { x: -4, y: -4, w: 398, h: 852 },
	hudTop: 700,
	road: { ox: 0, oy: 0, k: 0.25 },
};
const sb = new Scoreboard();
sb.deviceRatio = () => 3;
sb.layout(geo, []);
const env = { free: true, left: 10, idle: false, scatter: null };
if (SMALLS[CARD]) {
	// THE SMALL WIN, one way (4 above): its request as components/Board.svelte makes it for a line win's strip total
	const Q = SMALLS[CARD];
	const { LINE_WIN } = await import(src('constants.ts'));
	const wreq = { x: Q.x, amount: Q.amount, bet: 100, fmt, rate: 1, auto: false, small: true, countMs: LINE_WIN.slam.stripCountMs };
	let warmS = null;
	let framesS = 0;
	if (MODE === 'warm') {
		LED_BOARD.warm.budgetMs = 25;
		sb.prepareSmall(wreq);
		for (let i = 0; i < 20000; i++) {
			sb.update(1000 / 60, env);
			framesS += 1;
			const w = sb.smallWarmInfo();
			if (!w || w.state !== 'running') {
				warmS = w;
				break;
			}
		}
	}
	sb.manual = true;
	sb.clock = 0;
	void sb.win(wreq);
	const shown = sb.snapshot().show;
	const step = 1000 / LED_BOARD.fps;
	const outS = { strip: [], madeAll: 0, warm: warmS, frames: framesS };
	const before = canvasCount();
	// (the small win's own steps: the one after its end draws the strip's resting state, the bonus round's counter)
	for (let t = 0; t + step < shown.end; t += step) {
		sb.step(step);
		const s = sb.faceStats('strip');
		outS.strip.push(t >= 450 ? s.hash : '-');
	}
	outS.madeAll = canvasCount() - before;
	console.log('RESULT ' + JSON.stringify(outS));
	process.exit(0);
}
const C = CARDS[CARD];
const req = { kind: C.kind, spins: C.spins, amount: C.amount, fmt, rate: 1, title: C.title ?? null, line: C.line ?? null, x: C.x ?? 0, capped: !!C.capped, auto: false, presents: C.presents ?? 0 };

let warm = null;
let yields = 0;
let frames = 0;
if (MODE === 'warm') {
	// a budget that still stops the warm mid draw (this software canvas is far slower than a browser's; 25 until the
	// smallest dot rule made the upright phone's faces 168 x 122 dots, which the Free Spins entry's warm no longer filled)
	LED_BOARD.warm.budgetMs = 6;
	sb.prepare([req]);
	for (let i = 0; i < 20000; i++) {
		sb.update(1000 / 60, env);
		frames += 1;
		const w = sb.warmInfo().find((j) => j.kind === req.kind);
		if (w && w.samples < w.of && w.frames > 0) yields = Math.max(yields, w.frames - w.samples);
		if (!w || (w.state !== 'queued' && w.state !== 'running')) {
			warm = w;
			break;
		}
	}
}
// THE CARD, step by step at the LED rate on the board's own clock from 0 (both ways the same clock, the same steps)
sb.manual = true;
sb.clock = 0;
sb.card(req);
const show = sb.snapshot().show;
const end = (show.pressLineAt ?? show.countEnd) + 1500;
const step = 1000 / LED_BOARD.fps;
const out = { back: [], strip: [], lit: [], madeFirst: 0, warm, yields, frames };
const before = canvasCount();
for (let t = 0, i = 0; t <= end; t += step, i++) {
	sb.step(step);
	if (i === 25) out.madeFirst = canvasCount() - before;
	const b = sb.faceStats('back');
	const s = sb.faceStats('strip');
	out.back.push(b.hash);
	// (the strip's own switch from the cartoon before the card is a dissolve of the picture before: compared from 450 ms on)
	out.strip.push(t >= 450 ? s.hash : '-');
	out.lit.push(b.lit);
}
console.log('RESULT ' + JSON.stringify(out));
