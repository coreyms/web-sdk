// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// (2026-11-17: with constants LED_SIGN.onBoard the press screen is the game's own expanded LED board; boardPress() below
// checks it at every size and the billboard's checks are skipped. They still run with LED_SIGN.onBoard false.)
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,game/assets.ts,game/config.ts,game/constants.ts,game/landing/ledScreens.ts,game/landing/ledSign.ts};
// WATCHES: apps/run_over_reindeer/src/{game/landingBoard.ts,game/scene/logoSign.ts,game/sceneArtSpec.ts,game/gpuWarm.ts,game/road/roadFeatures.ts,game/scoreboard/ledGrid.ts,game/scoreboard/scoreboard.ts,game/scoreboard/ambient.ts};
// WATCHES: apps/run_over_reindeer/{static/assets/audio/music.json,static/assets/audio/sounds.json,static/assets/symbols/symbols-phone.json,static/assets/symbols/symbols.json};
// WATCHES: ; data-resume-card, data-resume, __reindeer.atRest, __reindeer.board, __reindeer.boardLayout, __reindeer.fixtures, __reindeer.gameType, __reindeer.led
// WATCHES: ; __reindeer.gpuWarm, GPU_WARM, LED_BOARD.density, __reindeer.scoreboard, __reindeer.scoreboardFace
// WATCHES: apps/run_over_reindeer/src/game/scenePrefetch.ts; prefetchOtherSceneSet
// WATCHES: ; __reindeer.ledFreeze, __reindeer.road, __reindeer.scene, __reindeer.tune, LED_SIGN, SCENE_ART, SCREENS, data-title-sign, .landing
// WATCHES: ; .pressText, .title, .am-ui, .hidden, .hudp, .spin
// THE LANDING PROBE. Pass 7 (Corey 2026-11-16): the press screen after the studio splash is the LED BILLBOARD
// (led_billboard_r2_2026-11-16; constants LED_SIGN, game/landing/ledSign.ts), and the posed board (the landing mock V2, game/
// landingBoard.ts) is the FIRST BOARD after the press. At each size:
//   - PRESS ANYWHERE is reached (the press gate's rules: the billboard's ticker shows it, the HTML line steps aside)
//   - behind the billboard the road shows the posed board: reels 1 and 5 the eight ordinary symbols once each, reels 2, 3
//     and 4 the Reindeer, Santa and Grandma columns standing at the top multipliers the math config gives (their stills
//     hand over to their idle loops once the clips are in: Corey 2026-11-19; checked on the first board after the press)
//   - the billboard: its dots (desktop 362 x 143 and a 362 x 11 ticker, 2.49 CSS px; the other sizes from the page's
//     rules), its face centred on the board, its snow cap under the title sign (the billboard logo since scene pass 9: its visible art, not its box; on
//     an upright phone since 2026-11-17 the sign rests on the cap, its lowest visible pixels 0 to 2 px into the cap's drawn top, and is back at its own
//     place in the game), its housing above the screen's foot,
//     held sideways clear of both HUD columns; the three screens cycle (each captured, with 4x crops of its words); its
//     first screen's figure is the max win from game/config.ts
//   - the press powers it down: the game's chrome is up by the hand over, the sign is gone and unloaded after
//   - the first board after the press is the posed board, at rest, its three columns playing their idle loops (each
//     column's frame changes over 1.5 s); the first spin's press takes its columns away
//   - a resumed round (the fixture RGS's resume: a free spin with a held column) comes back with its own column only
//   - the billboard's cost per content step on a phone profile with the CPU throttled 4x (CDP), its GPU bytes, the bytes
//     it adds to the press gate
//   - THE PRESS SCREEN ON THE LED BOARD (LED_SIGN.onBoard): the board's grid by the density rule (constants LED_BOARD.density,
//     2026-11-19: 1.5 LEDs per dot at every size here, both faces at it, the faces' LEDs their dots x 1.5)
//   - no page errors
// With OUT=<dir> it saves each screen at each size (phones at device pixel ratio 3, desktop at 2, 1920x1080 at 1), 4x crops
// of the face, the exit, the board after the press, and bytes.json.
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [OUT=<dir>] [ONLY=desktop,...] node tools/landing_probe.mjs
// Uses the dev server that is already running (it never starts one). One headless browser, muted, closed at the end. Take
// the shared browser lock around it (mkdir /tmp/hud_mock_shot.lock ... rmdir).
import { createRequire } from 'node:module';
import { mkdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3014';
const OUT = process.env.OUT || '';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'assets');
if (OUT) mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// dots: the page's grid where the face keeps the page's size (null: worked out from the layout's rule, checked loosely)
const SIZES = [
	// (ledK: the LED board's LEDs per dot at that size, constants LED_BOARD.density, 2026-11-19: 1.5 at every size here)
	{ name: 'desktop', vp: { width: 1440, height: 900 }, dpr: 2, phone: false, dots: [362, 143], pitch: 2.49, ledK: 1.5 },
	{ name: 'wide', vp: { width: 1920, height: 1080 }, dpr: 1, phone: false, dots: [362, 143], pitch: 3.31, ledK: 1.5 },
	{ name: 'landscape', vp: { width: 844, height: 390 }, dpr: 3, phone: true, hudColumns: true, ledK: 1.5 },
	{ name: 'portrait', vp: { width: 390, height: 844 }, dpr: 3, phone: true, resume: true, dots: [257, 221], throttle: true, upright: true, ledK: 1.5 },
	{ name: 'short', vp: { width: 390, height: 620 }, dpr: 3, phone: true, dots: [257, 167], upright: true, ledK: 1.5 },
	{ name: 'phone402', vp: { width: 402, height: 874 }, dpr: 3, phone: true, upright: true, ledK: 1.5 },
].filter((s) => !ONLY.length || ONLY.includes(s.name));
const POSE_SIDES = { 0: ['H2', 'L1', 'H4', 'L3'], 4: ['L2', 'H3', 'L4', 'L5'] };
const NEXT = [
	['L5', 'H4', 'L2', 'H3'],
	['H2', 'L3', 'W', 'L1'],
	['L4', 'H1', 'L5', 'H2'],
	['H3', 'L1', 'L4', 'L3'],
	['L2', 'H4', 'L4', 'H1'],
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

const srcOf = (rel) => readFileSync(join(ASSETS, '..', '..', 'src', rel), 'utf8');
/** the top multipliers of the BASE GAME as the game's config states them (game/config.ts multipliers.column.base), read
 *  here independently of the game. The first board is a base game board at rest, so it poses each column at the base
 *  game's top (2026-11-17: no longer a bonus round's rare start, which no base spin lands) */
const tops = () => {
	const src = srcOf('game/config.ts');
	const block = src.slice(src.indexOf('multipliers: {'), src.indexOf('bonusColumnCap'));
	const base = /\bbase: \{ reindeer[^}]*\}/.exec(block.slice(block.indexOf('column: {')))[0];
	const top = {};
	for (const tier of ['reindeer', 'santa', 'grandma']) top[tier] = Number(new RegExp(`${tier}: \\[(\\d+), (\\d+)\\]`).exec(base)[2]);
	return top;
};
const maxWin = () => Number(/maxWin: (\d+)/.exec(srcOf('game/config.ts'))[1]);
/** the billboard logo's sheet as built (game/sceneArtSpec.ts, generated by tools/build_scene.py): its base frame and tiers */
const signSheet = () => {
	const s = srcOf('game/sceneArtSpec.ts');
	const a = s.indexOf('{', s.indexOf('SCENE_ART'));
	const L = JSON.parse(s.slice(a, s.lastIndexOf('} as const') + 1)).logoSign;
	return { base: L.frames.base, tiers: L.tiers };
};

/** (2026-11-17) in the page: the billboard logo's VISIBLE art. Its box (scene().logo.css) is the whole picture, its
 *  transparent margin included; this reads the sheet the game loaded (the base frame, per tier) and returns per art
 *  column the CSS y of its lowest pixel at alpha 16 of 255 or more, and the visible box */
const SIGN_ART = async ({ base, tiers }) => {
	const logo = window.__reindeer.scene?.()?.logo;
	if (!logo) return null;
	const names = performance.getEntriesByType('resource').map((e) => e.name);
	// the loaded file when the page's resource list still holds it (it keeps 250 entries), else the tier's file where the
	// game asks for it (game/assets.ts: static/assets/ served at /assets/; the phone tier by the probe's own tier=phone)
	const seen = names.find((n) => /logo-sign-phone\.webp/.test(n)) ?? names.find((n) => /logo-sign\.webp/.test(n));
	const tier = seen ? (/logo-sign-phone/.test(seen) ? 'phone' : 'full') : /[?&]tier=phone/.test(location.search) ? 'phone' : 'full';
	const url = seen ?? `${location.origin}/assets/${tiers[tier].file}`;
	const k = tiers[tier].scale;
	const fx = Math.round(base.x * k);
	const fy = Math.round(base.y * k);
	const fw = Math.round(base.width * k);
	const fh = Math.round(base.height * k);
	const img = await createImageBitmap(await (await fetch(url)).blob());
	const c = new OffscreenCanvas(fw, fh);
	const g = c.getContext('2d');
	g.drawImage(img, -fx, -fy);
	const d = g.getImageData(0, 0, fw, fh).data;
	const css = logo.css;
	const sx = css.width / fw;
	const sy = css.height / fh;
	const bottoms = [];
	const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
	for (let x = 0; x < fw; x++) {
		let low = fh - 1;
		while (low >= 0 && d[(low * fw + x) * 4 + 3] < 16) low--;
		bottoms.push(low < 0 ? null : css.y + (low + 1) * sy);
		if (low < 0) continue;
		let high = 0;
		while (d[(high * fw + x) * 4 + 3] < 16) high++;
		box.left = Math.min(box.left, css.x + x * sx);
		box.right = Math.max(box.right, css.x + (x + 1) * sx);
		box.top = Math.min(box.top, css.y + high * sy);
		box.bottom = Math.max(box.bottom, css.y + (low + 1) * sy);
	}
	return { tier, x: css.x, sx, bottoms, box };
};

async function open(browser, S, ctx = null) {
	ctx ??= await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.dpr, isMobile: S.phone, hasTouch: S.phone });
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	return { ctx, p, errs };
}

async function waitPress(p) {
	for (let i = 0; i < 300; i++) {
		// (2026-11-17: the press screen on the game's own LED board: its strip line's gate, else the billboard's ticker)
		const ok = await p.evaluate(() => !!document.querySelector('.landing') && !!window.__reindeer?.road && (!!window.__reindeer?.led?.()?.ready || !!window.__reindeer?.scoreboard?.()?.press?.ready)).catch(() => false);
		if (ok) return true;
		await sleep(400);
	}
	return false;
}

/** THE RESUME CARD (2026-11-18, ui/ResumeCard.svelte): a reload into an open round shows it in place of the press screen */
async function waitResumeCard(p) {
	for (let i = 0; i < 300; i++) {
		if (await p.evaluate(() => !!document.querySelector('[data-resume-card] [data-resume="play"]')).catch(() => false)) return true;
		await sleep(400);
	}
	return false;
}

// THE FIRST BOARD'S COLUMNS PLAY THEIR IDLE (Corey 2026-11-19): each posed column's still hands over to its tier's
// idle loop once the clip is in (game/road/roadFeatures.ts loadLandingIdle), and its frame then changes over 1.5 s
// (its own function since 2026-11-19: both press screens, the LED board's and the billboard's, end on this board)
async function columnsIdle(p, tag) {
	let live = null;
	for (let i = 0; i < 60; i++) {
		live = await p.evaluate(() => window.__reindeer.road().features.columns.map((x) => ({ reel: x.reel, landing: x.landing, frame: x.frame })));
		if (live.length === 3 && live.every((x) => x.landing === 'live')) break;
		await sleep(150);
	}
	const seen = new Map();
	for (let i = 0; i < 10; i++) {
		const cols = await p.evaluate(() => window.__reindeer.road().features.columns.map((x) => ({ reel: x.reel, landing: x.landing, frame: x.frame })));
		for (const x of cols) {
			if (!seen.has(x.reel)) seen.set(x.reel, new Set());
			if (x.landing === 'live') seen.get(x.reel).add(x.frame);
		}
		await sleep(150);
	}
	const frames = [1, 2, 3].map((r) => `${r}:${seen.get(r)?.size ?? 0}`);
	check(live.length === 3 && live.every((x) => x.landing === 'live') && [1, 2, 3].every((r) => (seen.get(r)?.size ?? 0) >= 3), `${tag}: the first board's three columns play their idle loop (distinct frames over 1.5 s per reel ${frames.join(' ')})`, live);
}

/** THE PRESS SCREEN ON THE GAME'S OWN LED BOARD (2026-11-17, Corey approved; constants LED_SIGN.onBoard): no separate
 *  sign; the posed board behind; the scoreboard's back board EXPANDED (seated, the press show up), the explainer screens
 *  advancing on it, PRESS ANYWHERE TO CONTINUE on the strip as its top item, the scene dimmed as a big win dims it, the logo
 *  at its game place; the press lowers the board and lifts the dim, the game's chrome comes up, the logo has not moved, and
 *  a spin after it comes back to rest */
async function boardPress(p, S, tag, errs) {
	const TOP = tops();
	const a = await p.evaluate(() => window.__reindeer.road());
	const cols = a.features.columns;
	check(cols.length === 3 && [['reindeer', 1], ['santa', 2], ['grandma', 3]].every(([t, r]) => cols.some((c) => c.reel === r && c.tier === t && c.multiplier === TOP[t])), `${tag}: behind the board, reels 2, 3, 4 hold the three columns at their top multipliers`, cols);
	check([0, 4].every((r) => JSON.stringify(a.board[r]) === JSON.stringify(POSE_SIDES[r])), `${tag}: reels 1 and 5 hold the eight ordinary symbols once each`, a.board);
	const html = await p.evaluate(() => !!document.querySelector('.landing .pressText'));
	check(!html, `${tag}: the HTML press line steps aside for the strip's line`);
	const s0 = await p.evaluate(() => ({ s: window.__reindeer.scoreboard(), led: window.__reindeer.led(), dimWant: window.__reindeer.tune.ledBoard.dim.alpha, logo: window.__reindeer.scene()?.logo?.css ?? null, face: window.__reindeer.scoreboardFace('strip'), rule: { ...window.__reindeer.tune.ledBoard.density } }));
	const s = s0.s;
	check(!s0.led, `${tag}: no separate billboard (one board)`);
	check(s.show?.kind === 'press' && s.back.visible && Math.abs(s.back.offset) < 0.5 && s.press.up, `${tag}: the game's LED back board is up and seated (expanded: offset ${s.back.offset}, the press show ${s.show?.phase})`, { show: s.show, back: s.back });
	check(Math.abs(s.dim.alpha - s0.dimWant) < 0.01, `${tag}: the scene behind is dimmed as a big win dims it (${s.dim.alpha}, a big win's ${s0.dimWant})`);
	check(s.stripPick?.item === 'entry' && s.press.ready && s0.face.lit > 20, `${tag}: PRESS ANYWHERE TO CONTINUE runs on the strip as its top item (${s.stripPick?.item}, ${s0.face.lit} dots lit)`);
	// THE FINER GRID (2026-11-19, constants LED_BOARD.density): the board's LEDs per dot by the rule (1.5 where an LED stays at
	// least minDevicePx device px at the renderer's resolution, else 1; every size here gets 1.5), both faces at it, the
	// strip's and the back board's LEDs its dots x k, the dot pitch (CSS px) the layout's as before
	const dn = s.density;
	const DR = s0.rule;
	const wantK = !!dn && DR.on && (s.pitch * dn.ratio) / DR.k >= DR.minDevicePx ? DR.k : 1;
	const sf = s0.face;
	check(!!dn && Math.abs(dn.ratio - S.dpr) < 0.01 && dn.k === wantK && (S.ledK === undefined || dn.k === S.ledK) && dn.strip === dn.k && dn.back === dn.k && dn.faceRoots.strip === 1 && dn.faceRoots.back === 1 && sf.k === dn.k && sf.ledW === Math.round(sf.W * dn.k) && sf.ledH === Math.round(sf.H * dn.k), `${tag}: the board's grid: ${dn?.k} LEDs per dot (the rule: pitch ${s.pitch} x ${dn?.ratio} / ${DR.k} = ${dn ? Math.round(((s.pitch * dn.ratio) / DR.k) * 100) / 100 : '-'} device px against ${DR.minDevicePx}${S.ledK !== undefined ? `; want ${S.ledK}` : ''}), the strip ${sf.W} x ${sf.H} dots in ${sf.ledW} x ${sf.ledH} LEDs, the back board ${dn?.backLeds}, both faces at one density`, { dn, sf: { W: sf.W, H: sf.H, k: sf.k, ledW: sf.ledW, ledH: sf.ledH } });
	// the screens advance (driven by hand 100 ms at a time: 3 screens of LED_SIGN holdS + transS)
	const seen = await p.evaluate(() => {
		window.__reindeer.scoreboardManual(true);
		const out = [];
		for (let i = 0; i < 130; i++) {
			const x = window.__reindeer.scoreboardStep(100);
			if (out[out.length - 1] !== x.press?.screen) out.push(x.press?.screen);
		}
		window.__reindeer.scoreboardManual(false);
		return out;
	});
	check(seen.length >= 3 && new Set(seen).size === 3, `${tag}: the explainer screens cycle on the expanded board (${seen.join(' > ')})`);
	// THE GPU WARM-UP (game/gpuWarm.ts, 2026-11-17): while the press screen waits, every texture on the stage is sent to the
	// GPU, a source a frame; it has finished before the press (the probe waits for it, as a player who reads the screens does)
	let warm0 = [];
	for (let i = 0; i < 100; i++) {
		const w = await p.evaluate(() => ({ log: window.__reindeer.gpuWarm?.log() ?? [], pending: window.__reindeer.gpuWarm?.pending() ?? 0 }));
		warm0 = w.log;
		if (warm0.length && !w.pending) break;
		await sleep(100);
	}
	check(warm0.some((e) => e.pass === 'press screen'), `${tag}: the GPU warm-up ran on the press screen, before the press (${warm0.length} sources: ${warm0.filter((e) => e.result === 'uploaded').length} sent up, the rest already there)`, warm0.slice(0, 5));
	// the press
	await p.mouse.click(S.vp.width / 2, S.vp.height * 0.45);
	let gone = null;
	for (let i = 0; i < 40; i++) {
		await sleep(100);
		gone = await p.evaluate(() => { const s = window.__reindeer.scoreboard(); return { vis: s.back.visible, dim: s.dim.alpha, press: s.press, show: s.show?.kind ?? null, landing: !!document.querySelector('.landing'), logo: window.__reindeer.scene()?.logo?.css ?? null }; });
		if (!gone.vis && gone.dim === 0 && !gone.press && !gone.landing) break;
	}
	check(!!gone && !gone.vis && gone.dim === 0 && !gone.press && !gone.landing, `${tag}: the press lowers the board out of sight, lifts the dim and the game is there`, gone);
	const L0 = s0.logo;
	const L1 = gone?.logo;
	// ...so the press's own pass (what the stage holds once the game is there) sends nothing up: the first frames after the
	// press draw only textures already on the GPU, and no source destroyed or let go is ever sent up again
	let warm1 = [];
	for (let i = 0; i < 30 && !warm1.length; i++) {
		warm1 = await p.evaluate(() => (window.__reindeer.gpuWarm?.log() ?? []).filter((e) => e.pass === 'press'));
		if (!warm1.length) await sleep(100);
	}
	check(warm1.length > 0 && warm1.every((e) => e.result !== 'uploaded'), `${tag}: the press's warm-up pass finds everything already on the GPU (${warm1.length} sources, ${warm1.filter((e) => e.result === 'uploaded').length} sent up after the press)`, warm1.filter((e) => e.result === 'uploaded').slice(0, 5));
	check(!!L0 && !!L1 && Math.abs(L0.x - L1.x) < 0.6 && Math.abs(L0.y - L1.y) < 0.6 && Math.abs(L0.width - L1.width) < 0.6, `${tag}: the logo sign stays at its game place through the press (${L0 ? `${Math.round(L0.x)},${Math.round(L0.y)}` : '-'} then ${L1 ? `${Math.round(L1.x)},${Math.round(L1.y)}` : '-'})`, { L0, L1 });
	await p.evaluate(() => window.__reindeer.fixtures.next('plain_line_win'));
	// the first board's three columns play their idle (before the first spin lets the clips go)
	await columnsIdle(p, tag);
	await p.click('.hudp button.spin').catch(() => {});
	let rest = false;
	for (let i = 0; i < 100 && !rest; i++) {
		await sleep(300);
		rest = await p.evaluate(() => window.__reindeer.hud.idle() && window.__reindeer.atRest() && window.__reindeer.fixtures.log().plays.length > 0).catch(() => false);
	}
	check(rest, `${tag}: a spin after the press comes back to rest`);
	if (S.resume) {
		// a round left open (natural_free_spins event 9): since 2026-11-18 (the resume card, ui/ResumeCard.svelte) no press
		// screen: the card over the posed board, then Play Round and the resumed spin as before
		await p.evaluate(() => window.__reindeer.fixtures.resume('natural_free_spins', 9));
		await sleep(1500);
		check(await waitResumeCard(p), `${tag} resume: the resume card is up after the reload`);
		await sleep(800);
		const up = await p.evaluate(() => ({ kind: window.__reindeer.scoreboard()?.show?.kind ?? null, cols: window.__reindeer.road().features.columns.length }));
		check(up.kind !== 'press' && up.cols === 3, `${tag} resume: no press screen on the board, the posed board behind the card (${up.kind}, ${up.cols} columns)`, up);
		await p.click('[data-resume-card] [data-resume="play"]');
		let r = null;
		for (let i = 0; i < 200; i++) {
			const st = await p.evaluate(() => ({ landing: !!document.querySelector('.landing'), gt: window.__reindeer.gameType(), cols: window.__reindeer.road().features.columns.map((x) => `${x.reel}:${x.tier}:${x.multiplier}`), press: window.__reindeer.scoreboard()?.press ?? null }));
			if (!st.landing && st.gt === 'freegame' && st.cols.length) {
				r = st;
				break;
			}
			await sleep(100);
		}
		check(!!r && r.cols.length === 1 && r.cols[0] === '3:reindeer:4', `${tag} resume: the resumed free spin stands its own held column only (${r?.cols.join(' ')})`, r);
	}
	check(errs.length === 0, `${tag}: no page errors`, errs);
}

/** the face's box in device px of a screenshot, recorded next to it (the evidence's 4x crops are cut from it) */
async function crop4x(file, box, dpr, out) {
	writeFileSync(out, JSON.stringify({ file, box, dpr, scale: 4 / dpr }));
}

(async () => {
	const TOP = tops();
	const MAX = `${maxWin().toLocaleString('en-US')}X`;
	console.log('top multipliers from game/config.ts:', JSON.stringify(TOP), 'max win', MAX);
	const browser = await chromium.launch({ args: ['--mute-audio'] });
	const costs = {};
	try {
		for (const S of SIZES) {
			const { ctx, p, errs } = await open(browser, S);
			const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
			try {
				await p.goto(`${APP}/?lang=en&sessionID=land${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
				check(await waitPress(p), `${tag}: PRESS ANYWHERE reached (the billboard's ticker is up)`);
				await sleep(1000);
				// THE PRESS SCREEN ON THE GAME'S OWN LED BOARD (constants LED_SIGN.onBoard, 2026-11-17): its own checks, then the
				// next size (the billboard's checks below are for LED_SIGN.onBoard false)
				if (await p.evaluate(() => !!window.__reindeer.tune.ledSign.onBoard && !!window.__reindeer.scoreboard()?.press)) {
					await boardPress(p, S, tag, errs);
					continue;
				}
				const a = await p.evaluate(() => window.__reindeer.road());
				const cols = a.features.columns;
				const want = [
					{ reel: 1, tier: 'reindeer' },
					{ reel: 2, tier: 'santa' },
					{ reel: 3, tier: 'grandma' },
				];
				check(cols.length === 3 && want.every((w) => cols.some((c) => c.reel === w.reel && c.tier === w.tier && c.multiplier === TOP[w.tier])), `${tag}: behind the sign reels 2, 3, 4 hold the Reindeer ${TOP.reindeer}x, Santa ${TOP.santa}x and Grandma ${TOP.grandma}x columns`, cols);
				check([0, 4].every((r) => JSON.stringify(a.board[r]) === JSON.stringify(POSE_SIDES[r])) && [1, 2, 3].every((r) => a.board[r].every((x) => x === null)), `${tag}: reels 1 and 5 hold the eight ordinary symbols once each`, a.board);
				const html = await p.evaluate(() => ({ text: document.querySelector('.landing')?.innerText ?? '', press: !!document.querySelector('.landing .pressText') }));
				check(!html.press, `${tag}: the HTML press line steps aside for the ticker`);
				// THE SIGN
				const L = await p.evaluate(() => ({ led: window.__reindeer.led(), board: window.__reindeer.boardLayout().css, title: (() => { const c = window.__reindeer.scene?.()?.logo?.css; return c ? { left: c.x, top: c.y, right: c.x + c.width, bottom: c.y + c.height } : (() => { const e = document.querySelector('[data-title-sign], .landing .title'); return e ? { ...e.getBoundingClientRect().toJSON(), html: true } : null; })(); })() }));
				const g = L.led;
				if (S.dots) check(g.face.dotsW === S.dots[0] && Math.abs(g.face.dotsH - S.dots[1]) <= 1 && g.ticker.dotsW === S.dots[0] && g.ticker.dotsH === 11, `${tag}: the face ${g.face.dotsW} x ${g.face.dotsH} dots, the ticker ${g.ticker.dotsW} x ${g.ticker.dotsH} (the page: ${S.dots.join(' x ')}, ${S.dots[0]} x 11)`, g);
				else check(g.face.dotsW >= 200 && g.face.dotsH >= 100 && g.ticker.dotsH === 11, `${tag}: the face ${g.face.dotsW} x ${g.face.dotsH} dots, the ticker ${g.ticker.dotsW} x 11`, g);
				if (S.pitch) check(Math.abs(g.pitch - S.pitch) < 0.02, `${tag}: the dot pitch ${g.pitch} CSS px (the page: ${S.pitch})`);
				const boardMid = L.board.y + L.board.height / 2;
				const faceMid = g.face.y + g.face.h / 2;
				check(Math.abs(faceMid - boardMid) <= 1 && Math.abs(g.face.x + g.face.w / 2 - (L.board.x + L.board.width / 2)) <= 1, `${tag}: the face is centred on the board (face centre ${faceMid.toFixed(1)}, board centre ${boardMid.toFixed(1)})`);
				// (held sideways the title stands in the left HUD column, beside the sign: only an overlap across counts)
				// (2026-11-17) the billboard logo is judged by its visible art, not its box (the box is the picture's whole canvas,
				// its transparent margin included): over the snow cap's width (the housing and the cap's ends, half a frame each
				// side; the frame is the face's inset in the housing), the art's lowest visible pixel against the cap's top
				const art = L.title && !L.title.html ? await p.evaluate(SIGN_ART, signSheet()).catch((e) => ({ error: String(e) })) : null;
				if (art && !art.error) {
					const f = g.face.x - g.housing.x;
					const capL = g.housing.x - f / 2;
					const capR = g.housing.x + g.housing.w + f / 2;
					let low = null;
					let overL = null;
					let overR = null;
					art.bottoms.forEach((b, i) => {
						const x0 = art.x + i * art.sx;
						if (b === null || x0 + art.sx <= capL || x0 >= capR) return;
						low = low === null ? b : Math.max(low, b);
						overL = overL === null ? x0 : Math.min(overL, x0);
						overR = overR === null ? x0 + art.sx : Math.max(overR, x0 + art.sx);
					});
					const r1 = (v) => (v === null ? 'none' : v.toFixed(1));
					const vis = art.box;
					console.log(`  ${tag}: the logo's visible art ${r1(vis.left)}..${r1(vis.right)} x ${r1(vis.top)}..${r1(vis.bottom)} (box ${L.title.left.toFixed(1)}..${L.title.right.toFixed(1)} x ${L.title.top.toFixed(1)}..${L.title.bottom.toFixed(1)}); the cap ${capL.toFixed(1)}..${capR.toFixed(1)}, top ${g.housing.y}; art over the cap's width ${low === null ? 'none (beside it, ' + (capL - vis.right).toFixed(1) + ' px clear)' : `x ${r1(overL)}..${r1(overR)}, its lowest pixel ${r1(low)}: ${(low - g.housing.y).toFixed(1)} px into the cap`}`);
					// (2026-11-17, Corey approved) on an upright phone the sign RESTS on the cap: its lowest visible pixel over the cap's
					// width 0 to 2 px into the cap's top, no gap; elsewhere it stays clear of the cap as before
					// (judged column by column against the cap's DRAWN top, the billboard's capTop profile: its scalloped outline)
					if (S.upright) {
						let deep = null;
						const T = g.capTop;
						art.bottoms.forEach((b, i) => {
							if (b === null || !T) return;
							const j = Math.round(art.x + (i + 0.5) * art.sx - T.x0);
							if (j < 0 || j >= T.ys.length) return;
							deep = deep === null ? b - T.ys[j] : Math.max(deep, b - T.ys[j]);
						});
						check(deep !== null && deep >= 0 && deep <= 2, `${tag}: the title sign rests on the snow cap: its lowest visible pixels ${deep === null ? 'nowhere over the cap' : deep.toFixed(2) + ' px into the cap\'s drawn top at the deepest'} (0 to 2 wanted; ${low === null ? '' : (low - g.housing.y).toFixed(1) + ' px past the cap\'s nominal top ' + g.housing.y})`, { art: vis, cap: [capL, capR], box: L.title });
					}
					else check(low === null || g.housing.y >= low + 2, `${tag}: the snow cap (top ${g.housing.y}) stays under the title sign's visible art (${low === null ? `beside it, its art ends at x ${r1(vis.right)}, the cap starts at ${capL.toFixed(1)}` : `its lowest visible pixel over the cap ${r1(low)}`})`, { art: vis, cap: [capL, capR], box: L.title });
				} else {
					const across = L.title && L.title.right > g.housing.x && L.title.left < g.housing.x + g.housing.w;
					check(!across || g.housing.y >= L.title.bottom + 2, `${tag}: the snow cap (top ${g.housing.y}) stays under the title sign (bottom ${L.title?.bottom?.toFixed(1)}${across ? '' : ', beside it'})`, art?.error ?? L.title);
				}
				check(g.housing.bottom <= S.vp.height - 8 && g.housing.x >= 0 && g.housing.x + g.housing.w <= S.vp.width, `${tag}: the housing stands inside the screen, its foot ${g.housing.bottom} above the drift (${S.vp.height})`);
				check(g.signAlpha === 1 && Math.abs(g.dimAlpha - 0.66) < 0.01 && g.mode === 'live', `${tag}: the sign lit over the 0.66 dim`);
				// THE THREE SCREENS (each frozen mid hold), the ticker, the words
				const shots = [];
				for (const [i, t] of [[0, 1.6], [1, 3.9 + 2.6], [2, 7.8 + 2.6]]) {
					await p.evaluate((t) => window.__reindeer.ledFreeze(t), t);
					await sleep(400);
					const sn = await p.evaluate(() => window.__reindeer.led());
					check(sn.screen === i, `${tag}: screen ${i + 1} shows at ${t} s`, sn.screen);
					if (OUT) {
						const file = join(OUT, `screen${i + 1}_${S.name}_${S.vp.width}x${S.vp.height}.png`);
						await p.screenshot({ path: file });
						const face = { x: Math.round(g.face.x * S.dpr), y: Math.round(g.face.y * S.dpr), w: Math.round(g.face.w * S.dpr), h: Math.round((g.ticker.y + g.ticker.h - g.face.y) * S.dpr) };
						await crop4x(file, face, S.dpr, file.replace('.png', '.crop.json'));
						shots.push(file);
					}
				}
				await p.evaluate(() => window.__reindeer.ledFreeze(null));
				// the words the sign draws: from the constants and the config, no banned word, no symbol character
				const words = srcOf('game/constants.ts');
				const textBlock = words.slice(words.indexOf('text: {', words.indexOf('export const LED_SIGN')), words.indexOf('layout: {', words.indexOf('export const LED_SIGN')));
				const strs = [...textBlock.matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
				check(strs.length === 8 && strs.every((x) => /^[A-Z0-9 ,'X.]+$/.test(x)) && !strs.some((x) => /\b(BET|BUY|CASH|MONEY|PAID|CREDIT|GAMBLE|WAGER|STAKE)\b/.test(x)), `${tag}: the sign's words are plain capitals, none of the restricted words (${strs.join(' / ')})`, strs);
				check(MAX === '7,777X', `${tag}: screen 1's figure is the max win from game/config.ts (${MAX})`);
				// THE COST on the phone profile, the CPU throttled 4x
				if (S.throttle) {
					const cdp = await ctx.newCDPSession(p);
					await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
					const sample = await p.evaluate(async () => {
						const out = [];
						const frames = [];
						let last = performance.now();
						let steps0 = window.__reindeer.led().cost.steps;
						const t0 = performance.now();
						await new Promise((res) => {
							const tick = () => {
								const now = performance.now();
								frames.push(now - last);
								last = now;
								const c = window.__reindeer.led().cost;
								out.push(c.drawMs);
								if (now - t0 > 4000) res();
								else requestAnimationFrame(tick);
							};
							requestAnimationFrame(tick);
						});
						const steps = window.__reindeer.led().cost.steps - steps0;
						const sorted = [...frames].sort((a, b) => a - b);
						return { drawMsAvg: out.reduce((a, b) => a + b, 0) / out.length, drawMsMax: Math.max(...out), steps, frameMsMedian: sorted[Math.floor(sorted.length / 2)], frameMsP95: sorted[Math.floor(sorted.length * 0.95)], frames: frames.length, gpuBytes: window.__reindeer.led().gpuBytes, uploadBytes: window.__reindeer.led().cost.uploadBytes };
					});
					await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
					costs[S.name] = sample;
					console.log(`  ${tag} cost, CPU 4x throttled: ${JSON.stringify(sample)}`);
					check(sample.drawMsAvg < 8, `${tag}: a content step costs ${sample.drawMsAvg.toFixed(2)} ms on average (max ${sample.drawMsMax.toFixed(2)}) with the CPU throttled 4x, ${sample.steps} steps in 4 s`);
				} else costs[S.name] = { gpuBytes: g.gpuBytes, uploadBytes: g.cost.uploadBytes, drawMs: g.cost.drawMs };
				// THE PRESS
				await p.mouse.click(S.vp.width / 2, S.vp.height / 2);
				await sleep(320);
				const mid = await p.evaluate(() => window.__reindeer.led());
				check(!!mid && mid.mode === 'exit', `${tag}: the press powers the sign down`, mid);
				if (OUT) await p.screenshot({ path: join(OUT, `exit_${S.name}_${S.vp.width}x${S.vp.height}.png`) });
				let gone = null;
				for (let i = 0; i < 60; i++) {
					gone = await p.evaluate(() => ({ led: window.__reindeer.led(), landing: !!document.querySelector('.landing'), chrome: !!document.querySelector('.am-ui:not(.hidden)') }));
					if (!gone.led && !gone.landing) break;
					await sleep(100);
				}
				check(!gone.led && !gone.landing && gone.chrome, `${tag}: the sign is gone and unloaded, the landing screen gone, the game's chrome up`, gone);
				await sleep(600);
				const c = await p.evaluate(() => window.__reindeer.road());
				check(c.features.columns.length === 3 && c.atRest && [0, 4].every((r) => JSON.stringify(c.board[r]) === JSON.stringify(POSE_SIDES[r])), `${tag}: the first board after the press is the posed board (${c.features.columns.length} columns), at rest`, c.features.columns);
				if (OUT) await p.screenshot({ path: join(OUT, `after_press_${S.name}_${S.vp.width}x${S.vp.height}.png`) });
				await columnsIdle(p, tag);
				// the sign is back at its in-game place once the press screen has gone (an upright phone's rests on the cap
				// only on the press screen): its box's foot on the rule's (tune.logoSign.place.<class>.foot, road px)
				if (S.upright) {
					const back = await p.evaluate(() => ({ box: window.__reindeer.scene?.()?.logo?.road ?? null, foot: window.__reindeer.tune.logoSign.place.portrait.foot }));
					check(!!back.box && Math.abs(back.box.y + back.box.height - back.foot) < 0.01, `${tag}: in the game the sign is back at its own place (foot ${back.box ? (back.box.y + back.box.height).toFixed(2) : 'none'} road px, the rule's ${back.foot})`, back);
				}
				if (S.hudColumns) {
					const hud = await p.evaluate(() => {
						const left = [];
						const right = [];
						for (const el of document.querySelectorAll('.am-ui *')) {
							const r = el.getBoundingClientRect();
							const cs = getComputedStyle(el);
							if (r.width < 2 || r.height < 2 || r.width > 500 || cs.visibility === 'hidden' || cs.display === 'none') continue;
							if (r.right < window.innerWidth / 2) left.push(r.right);
							else if (r.left > window.innerWidth / 2) right.push(r.left);
						}
						return { left: Math.max(...left), right: Math.min(...right) };
					});
					check(g.housing.x >= hud.left && g.housing.x + g.housing.w <= hud.right, `${tag}: held sideways the housing (${g.housing.x.toFixed(1)} to ${(g.housing.x + g.housing.w).toFixed(1)}) clears both HUD columns (${hud.left.toFixed(1)}, ${hud.right.toFixed(1)})`, hud);
				}
				// the first spin's press takes the posed columns away
				await p.evaluate((b) => {
					const h = window.__reindeer;
					h.fixtures.queue([{ index: 0, type: 'reveal', gameType: 'basegame', board: b }, { index: 1, type: 'finalWin', amount: 0 }], 0);
				}, NEXT);
				await p.click('.hudp button.spin');
				let after = null;
				for (let i = 0; i < 80; i++) {
					await sleep(150);
					after = await p.evaluate(() => ({ rest: window.__reindeer.atRest(), cols: window.__reindeer.road().features.columns.length }));
					if (after.rest && after.cols === 0) break;
				}
				check(after.rest && after.cols === 0, `${tag}: the first spin's press takes the posed columns away`, after);

				if (S.resume) {
					// a round left open: the free spin with a held reindeer column on reel 4 (natural_free_spins event 9)
					await p.evaluate(() => window.__reindeer.fixtures.resume('natural_free_spins', 9));
					await sleep(1500);
					check(await waitResumeCard(p), `${tag} resume: the resume card is up after the reload (no press screen)`);
					await sleep(800);
					const r0 = await p.evaluate(() => window.__reindeer.road().features.columns.map((x) => `${x.reel}:${x.tier}:${x.multiplier}`));
					check(r0.length === 3, `${tag} resume: the card shows over the posed board (${r0.join(' ')})`);
					await p.click('[data-resume-card] [data-resume="play"]');
					let r = null;
					for (let i = 0; i < 200; i++) {
						const st = await p.evaluate(() => ({ landing: !!document.querySelector('.landing'), gt: window.__reindeer.gameType(), cols: window.__reindeer.road().features.columns.map((x) => `${x.reel}:${x.tier}:${x.multiplier}`) }));
						if (!st.landing && st.gt === 'freegame' && st.cols.length) {
							r = st;
							break;
						}
						await sleep(100);
					}
					check(!!r && r.cols.length === 1 && r.cols[0] === '3:reindeer:4', `${tag} resume: the resumed free spin stands its own held column only (${r?.cols.join(' ')})`, r);
					if (OUT) await p.screenshot({ path: join(OUT, `resume_${S.vp.width}x${S.vp.height}.png`) });
				}
			} catch (e) {
				check(false, `${tag}: ran to the end`, String(e).slice(0, 300));
			} finally {
				const e = errs.filter((x) => !/favicon/.test(x));
				check(e.length === 0, `${tag}: no page errors`, e.slice(0, 4));
				await ctx.close();
			}
		}
	} finally {
		await browser.close();
	}
	// the press gate's bytes: the preload (the loading bar's own count) and what the billboard adds
	const size = (rel) => statSync(join(ASSETS, rel)).size;
	const atlasImage = (json) => join(dirname(json), JSON.parse(readFileSync(join(ASSETS, json), 'utf8')).meta.image.split('?')[0]);
	const sets = {
		desktop: ['symbols/symbols.json', atlasImage('symbols/symbols.json'), 'road/road.webp', 'road/tunnel-left.webp', 'road/tunnel-right.webp', 'columns/landing-stills.webp', 'audio/sounds.json', 'audio/music.json'],
		phone: ['symbols/symbols-phone.json', atlasImage('symbols/symbols-phone.json'), 'road/road.webp', 'road/tunnel-left.webp', 'road/tunnel-right.webp', 'columns/landing-stills-phone.webp', 'audio/sounds.json', 'audio/music.json'],
	};
	// (2026-11-19, game/scenePrefetch.ts) NOT IN THE BLOCKING SET: once the preload and the audio are in, the Scene
	// setting's other set (its base scene) is fetched into the browser's cache in the background at low priority, so a
	// press on Snow or Dark on the press screen cross-fades at once. Those requests come after the press gate's own and
	// are counted here apart (a Snow boot's grass pieces; the phone tier with the forest and, held upright, no ends)
	const background = {
		desktop: ['road', 'tunnel-left', 'tunnel-right', 'field', 'band-top', 'band-bottom', 'end-left', 'end-right'].map((k) => `scene/grass-day-${k}.webp`),
		phoneUpright: ['road', 'tunnel-left', 'tunnel-right', 'field', 'band-top', 'band-bottom', 'forest'].map((k) => `scene/grass-day-${k}.webp`),
	};
	const bytes = { ledArt: size('landing/led-art.webp'), costs, backgroundSceneSet: Object.fromEntries(Object.entries(background).map(([k, files]) => [k, { files: files.length, bytes: files.reduce((n, f) => n + size(f), 0) }])) };
	for (const [tier, files] of Object.entries(sets)) bytes[tier] = { preloadImagesAndManifests: files.reduce((n, f) => n + size(f), 0), ledArtShare: Math.round((size('landing/led-art.webp') / files.reduce((n, f) => n + size(f), 0)) * 1000) / 10 };
	console.log('bytes:', JSON.stringify(bytes));
	if (OUT) writeFileSync(join(OUT, 'bytes.json'), JSON.stringify(bytes, null, 1));
	console.log(`\nlanding_probe: ${pass} pass, ${fail} fail`);
	for (const f of fails) console.log('  FAIL: ' + f);
	process.exit(fail ? 1 : 0);
})();
