// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/ui/RoundCard.svelte; ROUND.wrapAutoHoldMs
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,fixtures/showcaseBooks.ts,game/bookEventHandlerMap.ts,game/constants.ts,game/road/roadBoard.ts,game/road/roadSounds.ts};
// WATCHES: apps/run_over_reindeer/src/{game/scoreboard/race.ts,game/scoreboard/scoreboardDraw.ts,game/scoreboard/ledGrid.ts,game/sound.ts,ui/RoundCard.svelte,ui/hud/hudLayout.ts};
// WATCHES: apps/run_over_reindeer/src/{game/scoreboard/ambient.ts,game/scoreboard/entryScenes.ts,game/scoreboard/totalLadder.ts,game/scoreboard/ideasKit.ts,game/scoreboard/explainDraw.ts,game/scoreboard/show.ts,game/scoreboardArtSpec.ts,game/config.ts};
// WATCHES: ; LED_BOARD.ideas
// WATCHES: ; __reindeer.atRest, __reindeer.boardLayout, __reindeer.bookAmount, __reindeer.fixtures, __reindeer.gagsAsked, __reindeer.hud
// WATCHES: ; LED_BOARD.density, __reindeer.raceSeed, __reindeer.raceTally, __reindeer.raceTrace, __reindeer.roadBoard, __reindeer.roadSounds, __reindeer.scene
// WATCHES: ; __reindeer.scoreboard, __reindeer.scoreboardCard, __reindeer.scoreboardCardEnd, __reindeer.scoreboardCardPress
// WATCHES: ; __reindeer.scoreboardFace, __reindeer.scoreboardGag, __reindeer.scoreboardLower, __reindeer.scoreboardManual
// WATCHES: ; __reindeer.scoreboardRace, __reindeer.scoreboardRaise, __reindeer.scoreboardSkip, __reindeer.scoreboardStep
// WATCHES: ; __reindeer.scoreboardWin, __reindeer.soundTap, __reindeer.tune, __reindeer.turbo, INTRO_LINE, LED_BOARD.fps, LED_BOARD, ROUND
// WATCHES: ; SHOWCASE_ROUNDS, sfx_win_*, sfx_win_big, sfx_win_epic, sfx_win_max, sfx_win_mega, sfx_win_super, data-round-card, data-round-board
// WATCHES: ; data-top-up, .landing, .hudp, .spin, .am-ui, .wrap, .layer, .modals, .go
// THE LED SCOREBOARD PROBE (part A, 2026-11-17; bigwin_led_r3_2026-11-16 "r3b"; constants LED_BOARD, game/scoreboard/). At each size:
//   - THE STRIP'S RULE per layout class, worked out here from the game's own geometry (the road picture's place, the board,
//     the HUD's layout functions): desktop and tablet 0.62 of the road picture, centred on the window, top the bottom lane
//     line + 0.15 of the band down to the dock, height min(125 road px, 0.85 of that band); upright phones 0.9 of the screen;
//     a phone held sideways 0.86 of the lanes (1349 road px), centred on the road; and against the mock's own numbers
//   - the dots, the pitch (the press screen's), the GPU memory of the whole system under 1.2 MB
//   - THE RISE (desktop, upright, sideways), driven by hand 10 ms at a time: it overshoots its seat, drops back with one
//     bounce, and is seated (within 0.5 px, its bottom rail under the strip's snow cap) from the end of the bounce; the
//     lowered board hides under the strip; while it rises and lowers nothing of it shows under or beside the strip (the
//     foreground snow: the pixels there match the scene's with the board down); it lowers back out of sight
// On the desktop size:
//   - THE GRANDMA GAG: its words exactly; started by a real Grandma strike; on for 5 s; cut short by a new spin's press and by
//     a win message on the strip
//   - THE RACE: 300 seeded runs within RACE_ODDS 45 / 45 / 10, the lead changes hands, the one ahead at the line is the
//     drawn result, each forced result plays; its random source is its own (no Math.random, nothing of a round)
//   - NOTHING STRANDS A ROUND: a Spin press during the rise (the count lands, the round ends), a slam stop then the win
//     plays out by itself, a tap on the board skips a count when Spin is spent, autoplay at turbo 2 (three Mega rounds:
//     the short hold, the count at the turbo rate, the run stops and the game comes back to rest)
//   - the words the scoreboard draws: plain capitals and the gag's line, none of the restricted words, no symbol characters
//   - no page errors
// PART B (2026-11-17), sections `scenes` (desktop and upright phone, driven by hand), `cards` (real bonus rounds, desktop):
//   - THE CARDS ON THE BACK BOARD: the Free Spins entry, the Super entry and the Total Win rise and draw their scenes; the
//     press line comes on the strip at its time (entries 2.3 s and 2.9 s into the scene, the Total Win 0.3 s after its count
//     lands); a press before it lands the scene (the entry's READY beat, the Total Win's amount), the next continues; the card
//     ends, the board powers down and lowers out of sight; the Super entry shakes the road with the board
//   - THE WIN SCENES: Mega (the traffic jam), Epic (the honk meter), Max (the race in the bottom band): each tier's moment and
//     sound ONCE, in order (asked of the road's sound log, and reaching the effects sprite when it is in); a skip during the rise
//     plays only the final tier's sound, a skip in the count the tiers reached plus the final; Mega and up shake
//   - THE GAG'S RULE: a small win waits for the gag and shows after it; a Big message cuts it; a Mega (the back board) cuts it
//     (since 2026-11-17: never with the back board up, and none starts while a card is up)
//     on the strip; in a real Grandma strike round the gag is no longer cut by the round's own small win
//   - THE CHASE AS RUNS draws the same picture as dot by dot (the face's pixels hashed both ways), and its cost both ways
//   - THE GAG'S RULE (2026-11-17): base_grandma_strike's base game strike plays the gag; in floor_top_up's free spins the
//     first Grandma strike (no win) plays it, a later one on a paying spin plays it, a later one with no win does not
//   - THE ENTRY'S SENTENCE (scenes, 2026-11-17): while an entry waits, the intro card's sentence (constants INTRO_LINE,
//     the same words the HTML card shows) scrolls on the strip and the press line is never more than 3 s away
//   - THE TITLES (section titles, every size, 2026-11-17): BIG to MAX WIN, FREE SPINS and TOTAL WIN centered on the back
//     board's face by their drawn dots within half a dot, 4 dots clear of each side, the bounce inside the top; again with
//     the class's size knob at 2 and 0.3
//   - REAL ROUNDS: natural_free_spins (the entry on the board, a press lands it, a press continues; the Total Win on the board),
//     floor_top_up (its wrap-up keeps the HTML card: the top-up line); autoplay's tier sounds once per tier per round
//   - THE CURRENCY (section currency, desktop, sideways, upright, 2026-11-17 led_currency): with the play currency set by hand
//     (USD, EUR, JPY, BRL, INR, a made-up XQZ, social XSC) a small win's amount on the strip is, dot for dot, the game's own
//     drawRow of the expected text (symbol, number, decimals as the HUD writes them; XQZ the number alone) inside the face, and
//     a Mega win's amount on the big board is that text with its lit dots inside the face; no page errors
//     (2026-11-18: and for USD, EUR, JPY and BRL a free spin's strip win with cents, 39.2x, counted at LINE_WIN.slam
//     stripCountMs, ends on exactly the amount it counts to and never reads more on the way)
// THE FINER GRID (section density, 2026-11-19, constants LED_BOARD.density, game/scoreboard/ledGrid.ts), at the device's own
// pixel ratio: the rule (1.5 LEDs per dot where an LED stays at least 2 device px: 1440 x 900 at 2x, 1920 x 1080 at 1x, the
// phones at 3x and a sideways phone at 2x; today's grid on a 1440 x 900 desktop at 1x and an upright phone at 2x), both faces
// at one density with one face each, their LEDs, the GPU budget, a one dot chase border the same number of LEDs all round,
// the draw cost per layout; a rotation (sideways to upright at 2x and back) and the tune panel switch the density cleanly
// (never two densities on screen, no face left over); M4 and the currency's drawRow check again on the finer grid
// THE LED ANIMATION FIXES (section ledAnim, 2026-11-19, wip/ledanim), at the device's own pixel ratio (desktop 1440 x 900 at
// 2x and 1x, wide 1920 x 1080 at 1x, upright 390 x 844 at 3x and 2x, sideways 844 x 390 at 3x: both grids, every layout
// class), driven by hand:
//   - THE PLOW'S SNOW EDGE ("so the snow line disappears with the back tire"): on every 10 ms step of the van's drive the
//     pile's last column is the van's rear wheel's trailing edge, read from the FACE'S PIXELS (the snow's color; the tire:
//     the van's lit LEDs below its body's lowest row at its middle, on its rear half) within one LED, never snow behind it,
//     and the game's own record (the edge measured on the van's bake) agrees within one LED
//   - THE RIDERS ("Grandma in the cars, santa in the sleighs"): the LED sheets' car and sleigh pictures carry their rider
//     above the vehicle (scoreboardArtSpec.ts and ledArtSpec.ts: a `vehicle` box with headroom); in the strip's parade,
//     peek, sleigh and the gag's bump, the Super entry's sweep, the Total Win's band (and the Mega jam when its Grandma car
//     is in), each vehicle drawn with its rider has lit LEDs over at least 12% of the rider's part of its picture (an empty
//     vehicle lights none; a seated rider about 22%), and on the strip the rider's head is inside the face (the picture's
//     top at row 0 or below)
// THE ROUND 1 LED IDEAS (section ledIdeas, 2026-11-19, wip/ledideas; LED_BOARD.ideas): see ideasChecks below (the Super
// entry's presents all red, the tease reading nothing of the round, the stack's contact, the ladder's marks, the count by size
// and the cap's hold, the rotation, the press screen's light string, the cost)
// M4 (section m4, desktop and upright, 2026-11-19, driven by hand): the strip's scan to a message leaves the old picture alone
//   right of its line (never the two drawn at once); the Total Win's amount is lit whenever its title is, the landing blink too
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [ONLY=desktop,...] [SECTIONS=rule,rise,gag,race,round,scenes,cards,titles] node tools/led_board_probe.mjs
// Uses the dev server that is already running (it never starts one). One headless browser, muted, closed at the end. Run it
// through tools/browser_lock.sh (the game lane).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PNG } = require('playwright-core/lib/utilsBundle');

const APP = process.env.APP || 'http://localhost:3014';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SECTIONS = (process.env.SECTIONS || 'press,rule,rise,gag,race,round,scenes,cards,titles,dim,raceCard,strip,scatter,gagModes,bonusStrip,explain,currency,m4,density,ledAnim,ledIdeas').split(',');
const SEC = (s) => SECTIONS.includes(s);
// the intro card's sentence, exactly (game/constants.ts INTRO_LINE, which ui/RoundCard.svelte shows too)
const INTRO = (() => {
	const c = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'game', 'constants.ts'), 'utf8');
	const m = /export const INTRO_LINE = \{\s*bonus: '([^']*)',\s*super: '([^']*)',/.exec(c);
	return m ? { bonus: m[1], super: m[2] } : { bonus: '', super: '' };
})();
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// the mock's strip per size (NOTES section 1: "Rule (w x h at x, y)"); its road edges were read by eye to about 3 px
const SIZES = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, phone: false, cls: 'desktop', mock: { w: 684, h: 90, x: 378, y: 732.5 }, rise: true, flows: true, scenes: true },
	{ name: 'wide', vp: { width: 1920, height: 1080 }, phone: false, cls: 'desktop', mock: { w: 912, h: 80, x: 504, y: 905 } },
	{ name: 'side', vp: { width: 844, height: 390 }, phone: true, cls: 'phone', mock: { w: 391, h: 53, x: 227, y: 317 }, rise: true },
	{ name: 'portrait', vp: { width: 390, height: 844 }, phone: true, cls: 'portrait', mock: { w: 351, h: 71, x: 19.5, y: 600 }, rise: true, throttle: true, scenes: true },
	{ name: 'short', vp: { width: 390, height: 620 }, phone: true, cls: 'portrait', mock: { w: 351, h: 58, x: 19.5, y: 430 }, acceptRuleH: true },
].filter((s) => !ONLY.length || ONLY.includes(s.name));

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
const R = (p, fn, arg) => p.evaluate(fn, arg);
const r1 = (v) => Math.round(v * 10) / 10;

async function boot(browser, S) {
	// (the sizes run at a device pixel ratio of 1; the density section at the device's own: S.dpr)
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.dpr ?? 1, isMobile: S.phone, hasTouch: S.phone });
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=led${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 200; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && !document.querySelector('.landing') && window.__reindeer.scoreboard?.())).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	await sleep(800);
	return { ctx, p, errs };
}

/** the rule worked out here, from the game's geometry (the road picture, the board, the HUD's own layout functions) */
const expectRule = (p) =>
	R(p, async () => {
		const H = await import('/src/ui/hud/hudLayout.ts');
		const vw = innerWidth;
		const vh = innerHeight;
		const pic = window.__reindeer.scene().picture;
		const bl = window.__reindeer.boardLayout();
		const f = H.hudFrame({ kind: bl.kind, phone: Math.min(vw, vh) <= 480, vw, vh, safe: H.readSafeInsets() });
		const k = pic.k;
		if (bl.kind === 'landscape') {
			const dock = H.desktopGeo(f, 0).y0 * f.u;
			const lane = pic.y + 851 * k;
			const w = 0.62 * 1535 * k;
			const y = lane + 0.15 * (dock - lane);
			return { cls: f.variant === 'tablet' ? 'tablet' : 'desktop', w, x: vw / 2 - w / 2, y, h: Math.min(125 * k, 0.85 * (dock - lane)), hud: dock };
		}
		if (bl.kind === 'portrait') {
			const G = H.portraitGeo(f, 0);
			const hud = Math.min(G.win.y, G.amt.y, G.spin.y, G.bar.y0) * f.u;
			const y = pic.y + 948 * k;
			return { cls: 'portrait', w: 0.9 * vw, x: 0.05 * vw, y, h: 0.75 * (hud - y), hud };
		}
		const w = 0.86 * 1349 * k;
		const y = pic.y + 874 * k + 1;
		return { cls: 'phone', w, x: pic.x + 768 * k - w / 2, y, h: 0.72 * (vh - y), hud: vh, columns: [H.landscapeGeo(f).cap.x1 * f.u, H.landscapeGeo(f).kc.x0 * f.u] };
	});

/** a region of the page as pixels (device px = CSS px at scale 1) */
const grab = async (p, r) => {
	const clip = { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.max(1, Math.floor(r.w)), height: Math.max(1, Math.floor(r.h)) };
	const png = PNG.sync.read(await p.screenshot({ clip }));
	return png;
};
/** the largest channel difference between two grabs, and how many pixels differ by more than 3 */
const diff = (a, b) => {
	let most = 0;
	let n = 0;
	for (let i = 0; i < a.data.length; i += 4) {
		const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
		if (d > most) most = d;
		if (d > 3) n += 1;
	}
	return { most, n, px: a.data.length / 4 };
};

async function sizeChecks(p, S, memory) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	const sb = await R(p, () => window.__reindeer.scoreboard());
	// ---- THE RULE ----
	if (SEC('rule')) {
		const E = await expectRule(p);
		const st = sb.strip;
		check(sb.cls === E.cls, `${tag}: layout class ${sb.cls} (rule: ${E.cls})`);
		const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;
		check(near(st.w, E.w) && near(st.x, E.x) && near(st.y, E.y) && near(st.h, E.h), `${tag}: the strip ${r1(st.w)} x ${r1(st.h)} at ${r1(st.x)}, ${r1(st.y)} follows its class's rule (${r1(E.w)} x ${r1(E.h)} at ${r1(E.x)}, ${r1(E.y)})`, { st, E });
		check(Math.abs(st.x + st.w / 2 - (S.cls === 'phone' ? E.x + E.w / 2 : S.vp.width / 2)) <= 0.6, `${tag}: the strip is centred (${S.cls === 'phone' ? 'on the road' : 'on the window'})`);
		// (390 x 620: Corey accepted the game's own strip height on 2026-11-17, 6.1 px under the mock's by-eye 58: the
		// expected height there is the game's rule, E.h, and the strip must stand between the road's edge and the HUD)
		const M = S.acceptRuleH ? { ...S.mock, h: E.h } : S.mock;
		if (S.acceptRuleH) check(st.y >= E.y - 0.6 && st.housingBottom <= E.hud + 0.5, `${tag}: the strip stands between the road's edge (${r1(E.y)}) and the HUD's top (${r1(E.hud)}): ${r1(st.y)} to ${r1(st.housingBottom)}`);
		const dm = { w: r1(st.w - M.w), x: r1(st.x - M.x), y: r1(st.y - M.y), h: r1(st.h - M.h) };
		check(Math.abs(dm.w) <= 6 && Math.abs(dm.x) <= 6 && Math.abs(dm.y) <= 6 && Math.abs(dm.h) <= 6, `${tag}: against the mock's own numbers (${M.w} x ${M.h} at ${M.x}, ${M.y}): w ${dm.w}, x ${dm.x}, y ${dm.y}, h ${dm.h} (within 6 px: the mock read the road's edges by eye)`, dm);
		check(st.housingBottom <= E.hud + 0.5, `${tag}: the strip ends (${st.housingBottom}) above the HUD's top (${r1(E.hud)})`);
		if (E.columns) check(sb.back.housing.x >= E.columns[0] && sb.back.housing.x + sb.back.housing.w <= E.columns[1], `${tag}: held sideways the strip and the back board stand between the HUD's columns (${r1(E.columns[0])} to ${r1(E.columns[1])})`);
		check(Math.abs(sb.pitch - (S.name === 'desktop' ? 2.49 : S.name === 'wide' ? 3.31 : S.name === 'side' ? 1.56 : 1.3)) <= 0.03, `${tag}: the dot pitch ${sb.pitch} CSS px (the press screen's)`);
		check(st.dotsH >= 14 && st.dotsW >= 200, `${tag}: the strip's face ${st.dotsW} x ${st.dotsH} dots (the mock's smallest: 16 tall at 1920 x 1080), the back board's ${sb.back.dotsW} x ${sb.back.dotsH}`);
		check(sb.gpuBytes <= 1.2 * 1048576, `${tag}: the scoreboard holds ${(sb.gpuBytes / 1048576).toFixed(3)} MB of GPU textures (budget 1.2 MB; the snow cover adds none)`);
		memory[S.name] = { gpuMB: Math.round((sb.gpuBytes / 1048576) * 1000) / 1000, strip: `${st.dotsW}x${st.dotsH}`, back: `${sb.back.dotsW}x${sb.back.dotsH}`, cover: sb.cover };
	}
	// ---- THE COST on a phone profile, the CPU throttled 4x (CDP): a content step of the strip alone, and with the back board up
	if (SEC('rule') && S.throttle) {
		const cdp = await p.context().newCDPSession(p);
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
		const sample = async () =>
			R(p, async () => {
				const out = [];
				const frames = [];
				let last = performance.now();
				const t0 = last;
				const s0 = window.__reindeer.scoreboard().cost.steps;
				await new Promise((res) => {
					const tick = () => {
						const now = performance.now();
						frames.push(now - last);
						last = now;
						out.push(window.__reindeer.scoreboard().cost.drawMs);
						if (now - t0 > 3000) res();
						else requestAnimationFrame(tick);
					};
					requestAnimationFrame(tick);
				});
				const sorted = [...frames].sort((a, b) => a - b);
				return { drawMsAvg: Math.round((out.reduce((a, b) => a + b, 0) / out.length) * 100) / 100, drawMsMax: Math.max(...out), steps: window.__reindeer.scoreboard().cost.steps - s0, frameMsMedian: Math.round(sorted[Math.floor(sorted.length / 2)]), frameMsP95: Math.round(sorted[Math.floor(sorted.length * 0.95)]) };
			});
		const idle = await sample();
		await R(p, () => window.__reindeer.scoreboardRaise(98.75));
		await sleep(1200);
		const up = await R(p, () => null).then(sample);
		// part B: the same with the chase borders drawn dot by dot (the cost before the runs)
		await R(p, () => (window.__reindeer.tune.ledBoard.fastChase = false));
		const upDots = await sample();
		await R(p, () => (window.__reindeer.tune.ledBoard.fastChase = true));
		console.log(`  ${tag} cost, CPU 4x throttled, the Mega scene: chase as runs ${up.drawMsAvg} ms a step (max ${up.drawMsMax}), dot by dot ${upDots.drawMsAvg} ms (max ${upDots.drawMsMax})`);
		memory[`${S.name}CostDots`] = upDots;
		await R(p, () => window.__reindeer.scoreboardLower());
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
		await sleep(1500);
		console.log(`  ${tag} cost, CPU 4x throttled: strip alone ${JSON.stringify(idle)}; with the back board up ${JSON.stringify(up)}`);
		memory[`${S.name}Cost`] = { idle, up };
		check(idle.drawMsAvg < 4 && up.drawMsAvg < 8, `${tag}: a content step costs ${idle.drawMsAvg} ms (strip) and ${up.drawMsAvg} ms (both faces) on average with the CPU throttled 4x`);
	}
	// ---- THE RISE, by hand ----
	if (SEC('rise') && S.rise) {
		await R(p, () => {
			window.__reindeer.tune.ledBoard.dim.alpha = 0; // the cover's pixels are compared with the scene's: no dim
			window.__reindeer.scoreboardManual(true);
		});
		await sleep(300);
		const g0 = await R(p, () => window.__reindeer.scoreboard());
		const st = g0.strip;
		// the regions where only the scene may show: under the strip down to the HUD (or the screen's foot), the board's width
		const under = { x: g0.back.housing.x, y: st.housingBottom + 1, w: g0.back.housing.w, h: Math.max(1, Math.min(g0.hudTop, S.vp.height) - st.housingBottom - 2) };
		const sides = [
			{ x: st.x - 7, y: st.y + st.h * 0.45, w: 5, h: st.h * 0.45 },
			{ x: st.x + st.w + 2, y: st.y + st.h * 0.45, w: 5, h: st.h * 0.45 },
		];
		const base = { under: await grab(p, under), sides: await Promise.all(sides.map((r) => grab(p, r))) };
		await R(p, () => void window.__reindeer.scoreboardWin(98.75));
		const rows = [];
		let worst = { under: 0, sides: 0, frames: 0 };
		let shots = 0;
		for (let i = 0; i < 160; i++) {
			const s = await R(p, () => {
				const s = window.__reindeer.scoreboardStep(10);
				// (part B: the seated board shakes at the tiers; its seat is read without the shake)
return { t: s.show?.t ?? -1, phase: s.show?.phase, off: s.back.offset - s.shake, down: s.back.down, vis: s.back.visible, bottom: s.back.bottomNow - s.shake, seat: s.back.seatBottom, top: s.back.topNow };
			});
			rows.push(s);
			// two frames of the rise against the scene: its first move and half way up
			if ((shots === 0 && s.off < s.down * 0.93 && s.vis) || (shots === 1 && s.off < s.down * 0.5)) {
				shots += 1;
				const u = diff(base.under, await grab(p, under));
				const sd = await Promise.all(sides.map(async (r, k) => diff(base.sides[k], await grab(p, r))));
				worst.under = Math.max(worst.under, u.n);
				worst.sides = Math.max(worst.sides, ...sd.map((d) => d.n));
				worst.frames += 1;
				console.log(`  ${tag} rise frame t ${s.t} offset ${s.off}: under the strip ${u.n} of ${u.px} px differ (largest ${u.most}), beside it ${sd.map((d) => d.n).join(' / ')}`);
			}
			if (s.t > 1500) break;
		}
		const D = rows[0].down;
		const seatedAt = 60 + 560 + 220;
		const overshoot = Math.min(...rows.map((r) => r.off));
		const after = rows.filter((r) => r.t >= seatedAt);
		const bounce = rows.filter((r) => r.t > 620 && r.t < seatedAt);
		check(rows[0].off > D * 0.9 && overshoot < -0.5 && overshoot > -D * 0.2, `${tag}: rise style C: it starts under the strip (offset ${rows[0].off} of ${D}) and overshoots its seat by ${r1(-overshoot)} px`);
		check(bounce.some((r) => r.off > 0.3), `${tag}: it drops back into place with one bounce (largest ${r1(Math.max(0, ...bounce.map((r) => r.off)))} px)`);
		check(after.length > 0 && after.every((r) => Math.abs(r.off) < 0.5 && Math.abs(r.bottom - r.seat) < 0.5), `${tag}: seated from ${seatedAt} ms within 0.5 px: its bottom rail at ${after[0]?.bottom} under the strip's cap (seat ${after[0]?.seat})`, after.slice(0, 3));
		check(worst.frames === 2 && worst.under === 0 && worst.sides === 0, `${tag}: while it rises nothing of it shows under or beside the strip (the foreground snow: ${worst.under} px under, ${worst.sides} beside differ from the scene)`, worst);
		// skip, then the power down and the lowering, by hand
		await R(p, () => window.__reindeer.scoreboardSkip());
		const low = [];
		for (let i = 0; i < 400; i++) {
			const s = await R(p, () => {
				const s = window.__reindeer.scoreboardStep(10);
				return { phase: s.show?.phase ?? 'none', off: s.back.offset, down: s.back.down, vis: s.back.visible, busy: s.busy };
			});
			low.push(s);
			if (s.phase === 'none' && i > 5) break;
		}
		const last = low[low.length - 1];
		check(low.some((r) => r.phase === 'hold') && low.some((r) => r.phase === 'lowering') && low.some((r) => r.off < -0.5 && r.phase === 'lowering'), `${tag}: the skip lands the count; after the hold it hops up, then lowers`);
		check(last.phase === 'none' && Math.abs(last.off - last.down) < 0.5 && !last.vis && !last.busy, `${tag}: lowered out of sight behind the strip (offset ${last.off} of ${last.down}, hidden)`, last);
		await R(p, () => {
			window.__reindeer.scoreboardManual(false);
			window.__reindeer.tune.ledBoard.dim.alpha = 0.336;
		});
	}
}

/** a spin of a showcase round; resolves when the game is back at rest with nothing up (or the limit passes) */
// (2026-11-18, Corey "Yes": the wrap-up waits for the player's press as Manticore's does, autoplay or not, unless Autoplay
// Bonuses runs: ui/RoundCard.svelte. A round played here is pressed on at its Total Win, as a player would, 1.5 s after
// the board shows its press line; pressTotal false leaves the press to the caller)
async function playRound(p, name, { during, limit = 90000, pressTotal = true } = {}) {
	await R(p, (n) => window.__reindeer.fixtures.next(n), name);
	const t0 = Date.now();
	await p.click('.hudp button.spin');
	const seen = [];
	let lastKey = '';
	let totalWaits = null;
	let totalPressed = false;
	while (Date.now() - t0 < limit) {
		const s = await R(p, () => {
			const s = window.__reindeer.scoreboard();
			return { phase: s.show?.phase ?? 'none', kind: s.show?.kind ?? null, tier: s.show?.tier ?? -1, skipped: s.show?.skipped ?? false, final: s.show?.final ?? null, idle: window.__reindeer.hud.idle(), rest: window.__reindeer.atRest(), busy: s.busy, gag: s.gag?.words ?? null, hold: s.show ? s.show.exitAt - s.show.countEnd : null, count: s.show ? s.show.countEnd - s.show.countStart : null };
		});
		const key = `${s.phase}|${s.tier}|${s.idle}|${s.gag}`;
		if (key !== lastKey) {
			seen.push({ at: Date.now() - t0, ...s });
			lastKey = key;
		}
		if (during) await during(s, Date.now() - t0);
		if (pressTotal && s.kind === 'total' && s.phase === 'waits' && !totalPressed) {
			totalWaits ??= Date.now();
			if (Date.now() - totalWaits > 1500) {
				totalPressed = true;
				await R(p, () => document.querySelector('button.catch')?.click());
			}
		}
		if (s.idle && s.rest && s.phase === 'none' && Date.now() - t0 > 1200) return { ok: true, ms: Date.now() - t0, seen };
		await sleep(60);
	}
	return { ok: false, ms: Date.now() - t0, seen };
}

// ---- PART B: THE STAGED SCENES, THE TIER SOUNDS, THE SHAKES, THE GAG'S RULE, driven by hand ----
const TIER_SFX = /^sfx_win_(big|super|mega|epic|max)$/;
async function scenes(p, S) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	const step = (ms, n = 1) => R(p, ([ms, n]) => window.__reindeer.scoreboardStep(ms, n), [ms, n]);
	const face = (w) => R(p, (w) => window.__reindeer.scoreboardFace(w), w);
	/** the tier sounds asked since the last clear (the road's sound log), and those that reached the effects sprite (null: not in) */
	const tierSounds = async () => {
		const o = await R(p, () => ({ road: window.__reindeer.roadSounds(true), tap: window.__reindeer.soundTap?.(true) ?? null }));
		// (a tier sound's fade out, 2026-11-17, is noted in the same log as a "stop": not a sound asked)
		return { asked: o.road.filter((e) => e.kind === 'sound' && TIER_SFX.test(e.what) && !/^stop/.test(e.detail || '')).map((e) => e.what), played: o.tap ? o.tap.log.filter((e) => e.what === 'play' && TIER_SFX.test(e.name)).map((e) => e.name) : null };
	};
	const roadY = () => R(p, () => window.__reindeer.roadBoard().root.y);
	await R(p, () => {
		window.__reindeer.raceSeed(20261117);
		window.__reindeer.scoreboardManual(true);
	});
	await tierSounds();
	const C = 620; // the scene starts as the board seats (backAtMs 60 + riseMs 560)
	/** step to show ms `to` from `from`, 10 ms at a time, collecting what `pick` returns per step */
	// (stepped inside the page, one call for the whole run: a call per step is too slow for one lock turn)
	const run = (from, to) =>
		R(p, ([from, to]) => {
			const rows = [];
			for (let t = from; t < to; t += 10) {
				const s = window.__reindeer.scoreboardStep(10);
				rows.push({ t: s.show?.t ?? -1, phase: s.show?.phase ?? 'none', tier: s.show?.tier ?? -1, shake: s.shake, sceneT: s.show?.sceneT, amount: s.show?.amount, vis: s.back.visible, off: s.back.offset, down: s.back.down, card: s.card, stripKey: s.stripKey });
			}
			return rows;
		}, [from, to]);
	const finish = async () => {
		await R(p, () => {
			window.__reindeer.scoreboardCardEnd();
			window.__reindeer.scoreboardLower();
		});
		const rows = await run(0, 3000);
		return rows[rows.length - 1];
	};

	// ---- THE ENTRIES: the scene draws, the press line at its time, the land, the end ----
	for (const kind of ['fs', 'sfs']) {
		const press = kind === 'fs' ? 2300 : 2900;
		const ready = kind === 'fs' ? 2200 : 2800;
		const base = await roadY();
		await R(p, (k) => window.__reindeer.scoreboardCard(k), kind);
		const rows = await run(0, C + press + 300);
		const lit = await face('back');
		const waitsAt = rows.find((r) => r.phase === 'waits')?.t;
		check(rows.some((r) => r.phase === 'rising') && rows.some((r) => r.phase === 'show') && Math.abs(waitsAt - (C + press)) <= 10, `${tag}: the ${kind === 'fs' ? 'Free Spins' : 'Super'} entry rises, plays its scene and waits for the press from ${waitsAt} ms (rule ${C + press})`, rows.filter((r, i) => i % 40 === 0));
		check(lit && lit.lit > lit.dots * 0.03 && rows[rows.length - 1].card === kind && /^show/.test(rows[rows.length - 1].stripKey), `${tag}: its back board face is lit (${lit?.lit} of ${lit?.dots} dots) and the strip carries its line (${rows[rows.length - 1].stripKey})`, lit);
		// THE ENTRY'S SENTENCE (2026-11-17): while it waits, the intro card's sentence scrolls on the strip, the press line
		// never more than about 3 s away; sampled every 100 ms for 8 s of the wait
		{
			const want = INTRO[kind === 'sfs' ? 'super' : 'bonus'];
			// (2026-11-18: with LED_BOARD.explain on, the sentence is on the BIG board and the strip says the press line alone;
			// read from the game which of the two is in use)
			const explainOn = await R(p, () => !!window.__reindeer.tune.ledBoard.explain?.on);
			const waitRows = await R(p, () => {
				const out = [];
				for (let i = 0; i < 80; i++) {
					window.__reindeer.scoreboardStep(100);
					const f = window.__reindeer.scoreboardFace('strip');
					const b = window.__reindeer.scoreboardFace('back');
					out.push({ wait: f?.entryWait ?? null, ex: b?.explain ?? null, item: window.__reindeer.scoreboard().stripPick?.item });
				}
				return out;
			});
			if (explainOn) {
				const pages = waitRows.filter((r) => r.ex && r.ex.page === 'explain');
				const words = pages.length ? pages[pages.length - 1].ex.lines.join(' ') : '';
				const layout = pages[0]?.ex.layout;
				// (layout B shows the sentence on every other page; one page layouts from the first wipe on)
				check(pages.length >= (layout === 'B' ? 20 : 70) && words === want && waitRows.every((r) => !r.wait && r.item === 'entry'), `${tag}: while the ${kind} entry waits its sentence is on the big board (layout ${layout}, ${pages.length} of 80 samples: "${words}") and the strip shows the press line alone (no sentence on it)`, { want, words, pages: pages.length, strip: [...new Set(waitRows.map((r) => r.item))] });
			}
			const drawn = waitRows.map((r) => r.wait).filter(Boolean);
			const sentences = [...new Set(drawn.map((w) => w.sentence))];
			let gap = 0;
			let worst = 0;
			for (const r of waitRows) {
				const w = r.wait;
				gap = w && w.press ? 0 : gap + 100;
				worst = Math.max(worst, gap);
			}
			const xs = drawn.filter((w) => w.sentenceX !== null).map((w) => w.sentenceX);
			const card = readFileSync(join(SRC, 'ui', 'RoundCard.svelte'), 'utf8');
			check(/import \{ INTRO_LINE[,} ]/.test(card) && card.includes('{INTRO_LINE[card.bonus]}') && want.length > 20, `${tag}: the HTML intro card and the strip take the sentence from the one place (constants INTRO_LINE)`);
			if (!explainOn) check(drawn.length === waitRows.length && sentences.length === 1 && sentences[0] === want && worst <= 3000 && new Set(xs).size > 10, `${tag}: while the ${kind} entry waits the strip scrolls "${sentences[0]}" (${drawn[0]?.mode}, size ${drawn[0]?.size}, ${new Set(xs).size} places in 8 s) and the press line is never more than ${worst} ms away (within 3000)`, { want, sentences, worst, mode: drawn[0]?.mode });
		}
		if (kind === 'sfs') {
			const sh = rows.filter((r) => r.t >= C && r.t < C + 480).map((r) => Math.abs(r.shake));
			const moved = Math.abs((await roadY()) - base);
			check(Math.max(...sh) > 1.5 && rows.filter((r) => r.t > C + 500).every((r) => r.shake === 0) && moved < 0.05, `${tag}: the Super entry shakes once as its scene starts (largest ${r1(Math.max(...sh))} px) and the road is back in place (${r1(moved)} px off)`, sh);
		}
		const end = await finish();
		check(end.phase === 'none' && !end.vis && Math.abs(end.off - end.down) < 0.5, `${tag}: after the card the board powers down and lowers out of sight`, end);
		// a press before the press line lands the scene on its READY beat; the next press continues
		await R(p, (k) => window.__reindeer.scoreboardCard(k), kind);
		await run(0, C + 600);
		const l1 = await R(p, () => window.__reindeer.scoreboardCardPress());
		const after = await R(p, () => window.__reindeer.scoreboardStep(10).show);
		const l2 = await R(p, () => window.__reindeer.scoreboardCardPress());
		check(l1 === true && after.sceneT >= ready && after.phase === 'waits' && l2 === false, `${tag}: a press 600 ms into the ${kind} scene lands it (scene at ${after.sceneT} ms, its READY beat from ${ready}, the press line up); the next press continues`, { l1, l2, after: { sceneT: after.sceneT, phase: after.phase } });
		await finish();
	}

	// ---- THE TOTAL WIN: the count, the landing, the press line, a press lands the count ----
	{
		// (2026-11-19, Corey: "yes on the total count wins": the count's length by the round's size, LED_BOARD.ideas.totalBySize,
		// worked out here from the tiers' bars: 248.5x is past the Epic bar, "huge"; off: scenes.totalCountMs)
		const CNT = await R(p, () => {
			const L = window.__reindeer.tune.ledBoard;
			const x = 248.5;
			const tier = L.tiers.reduce((k, t, i) => (x >= t.bar ? i : k), -1);
			const size = tier < 0 ? 'small' : tier < 3 ? 'big' : 'huge';
			return { size, ms: L.ideas.totalBySize.on ? L.ideas.totalBySize.ms[size] : L.scenes.totalCountMs, after: L.scenes.totalPressAfterMs };
		});
		await R(p, () => window.__reindeer.scoreboardCard('total', { x: 248.5 }));
		const rows = await run(0, C + CNT.ms + 400);
		const mid = rows.find((r) => r.t === C + CNT.ms / 2);
		const land = rows.find((r) => r.t >= C + CNT.ms);
		const waitsAt = rows.find((r) => r.phase === 'waits')?.t;
		const fin = await R(p, () => window.__reindeer.scoreboard().show.finalStr);
		check(mid?.phase === 'count' && mid.amount !== fin && land?.amount === fin && Math.abs(waitsAt - (C + CNT.ms + CNT.after)) <= 10, `${tag}: the Total Win (${CNT.size}) counts (${mid?.amount} half way), lands on ${land?.amount} (the amount asked, ${fin}) at ${C + CNT.ms} and waits from ${waitsAt} ms (rule ${C + CNT.ms + CNT.after})`, rows.filter((r, i) => i % 50 === 0));
		const lit = await face('back');
		check(lit && lit.lit > lit.dots * 0.03, `${tag}: its back board face is lit (${lit?.lit} of ${lit?.dots} dots)`, lit);
		await finish();
		await R(p, () => window.__reindeer.scoreboardCard('total', { x: 248.5 }));
		await run(0, C + 1200);
		const l1 = await R(p, () => window.__reindeer.scoreboardCardPress());
		const after = await R(p, () => window.__reindeer.scoreboardStep(10).show);
		const l2 = await R(p, () => window.__reindeer.scoreboardCardPress());
		check(l1 && after.amount === after.finalStr && after.phase !== 'count' && l2 === false, `${tag}: a press during the Total Win's count lands it (${after.amount}); the next press continues`, { l1, l2, after: { amount: after.amount, phase: after.phase } });
		await finish();
	}

	// ---- THE WIN SCENES: each tier's moment and sound once, in order; the bands; the shakes ----
	const NAMES = ['sfx_win_big', 'sfx_win_super', 'sfx_win_mega', 'sfx_win_epic', 'sfx_win_max'];
	for (const [x, final, what] of [
		[98.75, 2, 'Mega (the traffic jam)'],
		[312.45, 3, 'Epic (the honk meter)'],
		[7777, 4, 'Max (the race in the bottom band)'],
	]) {
		await tierSounds();
		await R(p, (x) => void window.__reindeer.scoreboardWin(x), x);
		const { rows, mid, race } = await R(p, (final) => {
			const rows = [];
			let mid = null;
			let race = null;
			for (let i = 0; i < 1200; i++) {
				const q = window.__reindeer.scoreboardStep(10);
				const s = { t: q.show?.t ?? -1, phase: q.show?.phase ?? 'none', tier: q.show?.tier ?? -1, shake: q.shake, fired: q.show?.fired ?? null, countStart: q.show?.countStart, countEnd: q.show?.countEnd, events: q.show?.events, maxRace: q.show?.maxRace ?? null, raceAt: q.show?.maxRaceAt ?? null };
				rows.push(s);
				if (!mid && s.tier === final && (s.phase === 'count' || s.phase === 'hold')) mid = window.__reindeer.scoreboardFace('back');
				if (s.maxRace) race = s.maxRace;
				if (s.phase === 'none') break;
			}
			return { rows, mid, race };
		}, final);
		const fired = rows.filter((r) => r.fired).pop()?.fired ?? [];
		// (2026-11-17) EACH TIER'S SOUND FADES THE ONE BEFORE: as the next tier's starts the one before is faded out over at
		// most 200 ms (the road's log: its stop note, within 50 real ms of the next one's play)
		{
			const L = await R(p, () => window.__reindeer.roadSounds());
			const plays = L.filter((e) => e.kind === 'sound' && TIER_SFX.test(e.what) && /scoreboard tier/.test(e.detail || ''));
			const pairs = plays.slice(1).map((e, i) => {
				const prev = plays[i];
				const st = L.find((x) => x.what === prev.what && /^stop \(the next tier/.test(x.detail || '') && Math.abs(x.t - e.t) < 50);
				const ms = st ? Number(/, (\d+) ms fade/.exec(st.detail)?.[1]) : null;
				return { prev: prev.what, next: e.what, fade: ms };
			});
			check(pairs.length === final && pairs.every((x) => x.fade !== null && x.fade <= 200), `${tag}: ${what}: as each tier's sound starts the one before fades out within 200 ms (${pairs.map((x) => `${x.prev} ${x.fade} ms`).join(', ')})`, pairs);
		}
		const want = Array.from({ length: final + 1 }, (_, i) => i);
		const snd = await tierSounds();
		const events = rows.find((r) => r.events?.length === final + 1)?.events ?? [];
		const shakeAt = (tier) => {
			const e = events.find((x) => x.tier === tier);
			return e ? Math.max(...rows.filter((r) => r.t >= e.at && r.t < e.at + 200).map((r) => Math.abs(r.shake))) : 0;
		};
		check(fired.join() === want.join() && snd.asked.join() === NAMES.slice(0, final + 1).join() && (snd.played === null || snd.played.join() === snd.asked.join()), `${tag}: ${what}: each tier's moment once, in order (${fired.join(' ')}), and its sound once (${snd.asked.join(', ')}${snd.played === null ? '; the sprite not in' : '; all reached the sprite'})`, { fired, snd });
		check(mid && mid.lit > mid.dots * 0.05, `${tag}: ${what}: the back board's scene is lit at its tier (${mid?.lit} of ${mid?.dots} dots)`, mid);
		const sh = want.filter((t) => t >= 2).map((t) => r1(shakeAt(t)));
		check(sh.every((v) => v > 1) && shakeAt(0) === 0, `${tag}: ${what}: Mega and up shake as they are reached (${sh.join(', ')} px), Big does not`, sh);
		if (final === 4) {
			check(!!race, `${tag}: the Max scene runs the race in its bottom band (this run: ${race})`);
			// (2026-11-17) THE RACE OVER THE WHOLE COUNT: under way early in the count, at the finish line as the count lands
			const cs = rows.find((r) => r.countStart !== undefined)?.countStart;
			const ce = rows.filter((r) => r.countEnd !== undefined).at(-1)?.countEnd;
			const early = rows.find((r) => cs !== undefined && r.t >= cs + (ce - cs) * 0.15 && r.t < cs + (ce - cs) * 0.3);
			const mid = rows.find((r) => r.t >= cs + (ce - cs) * 0.5);
			// (the face is drawn at its own refresh, LED_BOARD.fps: read a step or two after the landing)
			const land = rows.find((r) => r.t >= ce + 80);
			const before = rows.filter((r) => r.t < ce).at(-1);
			check(!!early && early.raceAt > 0 && early.raceAt < 0.4 && mid.raceAt > 0.4 && mid.raceAt < 0.6 && before.raceAt < 1 && land.raceAt === 1, `${tag}: the race starts with the count and runs the whole of it (${early?.raceAt?.toFixed(3)} of its run 15 to 30% into the count, ${mid?.raceAt?.toFixed(3)} at half, ${before?.raceAt?.toFixed(3)} just before the landing, ${land?.raceAt} just after it lands)`, { cs, ce, early, mid, land });
		}
	}
	// a skip during the rise plays only the final tier's sound; a skip in the count, the tiers reached and the final
	for (const [at, want] of [
		[300, ['sfx_win_mega']],
		[1000, ['sfx_win_big', 'sfx_win_mega']],
	]) {
		await tierSounds();
		await R(p, () => void window.__reindeer.scoreboardWin(98.75));
		await run(0, at);
		await R(p, () => window.__reindeer.scoreboardSkip());
		const rows = await run(at, 6000);
		const snd = await tierSounds();
		check(rows[rows.length - 1].phase === 'none' && snd.asked.join() === want.join(), `${tag}: a skip ${at} ms into a Mega win sounds ${snd.asked.join(', ') || 'nothing'} (want ${want.join(', ')})`, snd);
	}

	// a skip in a Max count lands it, and the race jumps to its finish line
	{
		await R(p, () => void window.__reindeer.scoreboardWin(7777));
		await run(0, 2500);
		const pre = await R(p, () => window.__reindeer.scoreboardStep(10).show);
		await R(p, () => window.__reindeer.scoreboardSkip());
		const post = await R(p, () => window.__reindeer.scoreboardStep(80).show);
		await run(0, 9000);
		check(pre && pre.phase === 'count' && pre.maxRaceAt > 0 && pre.maxRaceAt < 1 && post && post.maxRaceAt === 1, `${tag}: a skip during the Max count lands it and the race jumps to its finish (${pre?.maxRaceAt?.toFixed(3)} of its run before, ${post?.maxRaceAt} after)`, { pre: pre && { phase: pre.phase, at: pre.maxRaceAt }, post: post && { phase: post.phase, at: post.maxRaceAt } });
	}

	// ---- THE CHASE AS RUNS draws the same picture as dot by dot ----
	const same = [];
	for (const [start, to] of [
		["void window.__reindeer.scoreboardWin(98.75)", 4000],
		["window.__reindeer.scoreboardCard('fs')", 1000],
		["window.__reindeer.scoreboardCard('sfs')", 3600],
		["window.__reindeer.scoreboardCard('total', { x: 248.5 })", 1500],
	]) {
		await p.evaluate(start);
		await run(0, to);
		const a = await R(p, () => {
			window.__reindeer.tune.ledBoard.fastChase = true;
			window.__reindeer.scoreboardStep(0);
			return [window.__reindeer.scoreboardFace('back').hash, window.__reindeer.scoreboardFace('strip').hash];
		});
		const b = await R(p, () => {
			window.__reindeer.tune.ledBoard.fastChase = false;
			window.__reindeer.scoreboardStep(0);
			const out = [window.__reindeer.scoreboardFace('back').hash, window.__reindeer.scoreboardFace('strip').hash];
			window.__reindeer.tune.ledBoard.fastChase = true;
			return out;
		});
		same.push(a.join() === b.join());
		await finish();
	}
	check(same.every(Boolean), `${tag}: the chase borders drawn as runs give the same dots as dot by dot (back board and strip, 4 scenes: ${same.join(' ')})`, same);

	// ---- THE GAG'S RULE ----
	await R(p, () => window.__reindeer.scoreboardGag());
	await step(200, 2);
	await R(p, () => void window.__reindeer.scoreboardWin(3.4));
	const g1 = await R(p, () => window.__reindeer.scoreboardStep(10));
	const rows = await run(0, 5000);
	const shownAt = rows.findIndex((r) => r.phase !== 'none');
	const log = await R(p, () => window.__reindeer.scoreboard().log.slice(-12));
	// (2026-11-17, the strip's priority order: the spin's win amount is above the Grandma line and nothing queues: the small
	// win shows at once over the gag, which is not cut and keeps its own clock under it)
	check(!g1.pendingSmall && g1.gag && g1.show?.kind === 'small' && g1.stripPick?.item === 'winAmount' && shownAt === 0 && !log.some((l) => l.what === 'gag' && /cut/.test(l.detail ?? '')), `${tag}: a small win shows at once over the gag (the gag uncut under it, nothing queued)`, { g1: { pending: g1.pendingSmall, gag: g1.gag, strip: g1.stripPick?.item }, log });
	await run(0, 3000);
	await R(p, () => window.__reindeer.scoreboardGag());
	await step(200, 2);
	await R(p, () => void window.__reindeer.scoreboardWin(98.75));
	const g2 = await R(p, () => window.__reindeer.scoreboardStep(1000));
	// (2026-11-17: the gag never plays with the back board up; it used to keep playing under a Mega, the mock's rule)
	check(!g2.gag && g2.show?.kind === 'win' && g2.show.arrive, `${tag}: a Mega win (the back board) cuts the gag`, { gag: g2.gag, show: g2.show?.kind });
	await R(p, () => window.__reindeer.scoreboardSkip());
	await run(0, 4000);
	// and none starts while a card is up
	await R(p, () => window.__reindeer.scoreboardCard('total', { x: 248.5 }));
	await run(0, 1500);
	await R(p, () => window.__reindeer.scoreboardGag());
	const g3 = await R(p, () => window.__reindeer.scoreboardStep(100));
	check(!g3.gag && g3.show?.kind === 'total', `${tag}: no gag starts while the Total Win is up`, { gag: g3.gag, show: g3.show?.kind });
	await R(p, () => {
		window.__reindeer.scoreboardCardEnd();
		window.__reindeer.scoreboardLower();
	});
	await run(0, 3000);
	await R(p, () => window.__reindeer.scoreboardManual(false));
}

// ---- THE BACK BOARD'S TITLES AND AMOUNTS (2026-11-17): every title (BIG to MAX WIN, FREE SPINS, SUPER over the Super
// entry's number, TOTAL WIN) and every amount (the win's count, the entries' number, the Total Win) centered on the face by
// its drawn dots within 1 dot (the bouncing letters at rest), its margins equal, a title 4 dots or more clear of each side
// and its bounce inside the top, at every size; again with the class's size knob at 2 and 0.3, and the gap and bounce knobs
// at their ends. The amounts are judged at rest (a win's hold, a card waiting for its press).
const TITLE_MARGIN = 4;
// ---- THE CURRENCY (2026-11-17, led_currency_2026-11-17) ----
// the expected LED text, worked out here (not by the game's rule): Stake's symbol on its side, en-US marks, the currency's
// decimals extended only by digits the amount really carries (as the HUD's formatter does); a made-up code: the number alone
const CUR = { USD: ['$', 2, ''], EUR: ['€', 2, ''], JPY: ['¥', 0, ''], BRL: ['R$', 2, ''], INR: ['₹', 2, ''], XQZ: [null, 2, ''], XSC: ['SC', 2, ' '] };
const ledExpect = (code, v) => {
	const [sym, dec, sp] = CUR[code];
	let d = dec;
	while (d < dec + 2 && Math.abs(Math.round(v * 10 ** d) - v * 10 ** d) > 1e-6) d++;
	const n = v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
	return sym === null ? n : `${sym}${sp}${n}`;
};
/** a section starts from a quiet board whatever an earlier one left up (a card waiting, a win, the back board, a scatter
 *  count by hand): one failure never cascades into the next section */
const quietBoard = (p) =>
	R(p, () => {
		const h = window.__reindeer;
		h.scoreboardScatter?.(undefined);
		h.scoreboardCardEnd();
		h.scoreboardSkip();
		h.scoreboardSkip();
		h.scoreboardLower();
		const m = h.scoreboard().manual;
		for (let i = 0; i < 40; i++) h.scoreboardStep(100);
		return m;
	});

async function currencyChecks(p, S) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	await quietBoard(p);
	await R(p, () => window.__reindeer.scoreboardManual(true));
	const bet = await R(p, async () => (await import('/src/game/scoreboard/scoreboard.ts')).scoreboardDev.bet());
	for (const code of Object.keys(CUR)) {
		// THE STRIP: a small win (3.4x), stepped to the end of its count (before the reindeer's hop), its white dots read
		const small = Math.round(3.4 * bet * 100) / 100;
		const want = ledExpect(code, small);
		const st = await R(
			p,
			async ([code, want]) => {
				const R0 = window.__reindeer;
				R0.ledCurrency(code);
				void R0.scoreboardWin(3.4, { small: true });
				let q = R0.scoreboardStep(10);
				for (let i = 0; i < 600 && q.show && q.show.t + 10 <= q.show.countEnd; i++) q = R0.scoreboardStep(10);
				if (q.show && q.show.t < q.show.countEnd) q = R0.scoreboardStep(q.show.countEnd - q.show.t);
				const D = await import('/src/game/scoreboard/scoreboardDraw.ts');
				const LG = await import('/src/game/scoreboard/ledGrid.ts');
				const board = (await import('/src/game/scoreboard/scoreboard.ts')).scoreboardDev.board;
				const F = board.strip.F;
				// (2026-11-19, the finer grid: read LED by LED; the face is F.k LEDs per dot, the box below is in LEDs)
				const W = F.ledW;
				const H = F.ledH;
				const d = F.out.ctx.getImageData(0, 0, W, H).data;
				// the amount is the only white on the small win's face (WIN is blue, the hop comes after the count)
				const white = (x, y) => d[(y * W + x) * 4 + 3] > 0 && d[(y * W + x) * 4] > 240 && d[(y * W + x) * 4 + 1] > 240 && d[(y * W + x) * 4 + 2] > 240;
				let l = W, r = -1, t = H, b = -1;
				for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (white(x, y)) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
				// the same text by the game's drawRow at each cap: one must give exactly these dots
				let match = null;
				for (let cap = 5; cap <= H && r >= 0; cap++) {
					// (a scratch face of the strip's own density: drawRow there draws as it does on the strip)
					const c = LG.mkFace(F.dotsW + 40, F.dotsH + 20, F.k);
					const g = c.ctx;
					D.drawRow(g, want, 4, 4, cap, '#ffffff');
					const e = g.getImageData(0, 0, c.width, c.height).data;
					let L = c.width, Rr = -1, T = c.height, Bb = -1;
					for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (e[(y * c.width + x) * 4 + 3] > 0) { L = Math.min(L, x); Rr = Math.max(Rr, x); T = Math.min(T, y); Bb = Math.max(Bb, y); }
					if (Rr - L !== r - l || Bb - T !== b - t) continue;
					let same = true;
					for (let y = 0; y <= b - t && same; y++) for (let x = 0; x <= r - l; x++) if ((e[((T + y) * c.width + L + x) * 4 + 3] > 0) !== white(l + x, t + y)) { same = false; break; }
					if (same) { match = cap; break; }
				}
				const shown = q.show?.amount ?? null;
				for (let i = 0; i < 400 && R0.scoreboard().show; i++) R0.scoreboardStep(10);
				return { shown, box: [l, t, r, b], W, H, match, k: F.k };
			},
			[code, want],
		);
		check(st.shown === want && st.match !== null && st.box[0] >= 1 && st.box[2] <= st.W - 2 && st.box[1] >= 0 && st.box[3] <= st.H - 1, `${tag}: ${code} on the strip reads "${st.shown}" (want "${want}"), drawn LED for LED as drawRow draws it (cap ${st.match}) inside the ${st.W} x ${st.H} LED face (${st.k} LEDs per dot)`, st);
		// THE COUNT ENDS ON ITS AMOUNT (2026-11-18, the BRL capture "WIN R$39.00" beside the HUD's R$39.20: book 6239 spin 7,
		// 39.00x after 0.20x, the strip shows the spin's win and the HUD the round's total): a free spin's strip win with
		// cents (39.2x), counted at the line win's own count length, stepped frame by frame: from the count's end on, every
		// frame reads exactly the amount it counted to (ledExpect, worked out here), and no frame before it reads more
		if (['USD', 'EUR', 'JPY', 'BRL'].includes(code)) {
			const v = Math.round(39.2 * bet * 100) / 100;
			const wantE = ledExpect(code, v);
			const ce = await R(p, (cm) => {
				const R0 = window.__reindeer;
				void R0.scoreboardWin(39.2, { small: true, countMs: cm });
				let q = R0.scoreboardStep(10);
				const during = [];
				const after = new Set();
				let final = null;
				let peak = null;
				const n = (t) => Number(String(t).replace(/[^0-9.]/g, '')) || 0;
				for (let i = 0; i < 1000 && q.show; i++) {
					if (q.show.t < q.show.countEnd) {
						during.push(q.show.amount);
						if (peak === null || n(q.show.amount) > n(peak)) peak = q.show.amount;
					}
					else after.add(q.show.amount);
					final = q.show.finalStr;
					q = R0.scoreboardStep(10);
				}
				return { during: during.slice(-3), n: during.length, peak, after: [...after], final };
			}, await R(p, () => window.__reindeer.tune.lineWin.slam.stripCountMs));
			const num = (t) => Number(String(t).replace(/[^0-9.]/g, '')) || 0;
			const over = ce.peak !== null && num(ce.peak) > num(wantE) + 1e-9 ? [ce.peak] : [];
			check(ce.after.length === 1 && ce.after[0] === wantE && ce.final === wantE && over.length === 0, `${tag}: ${code} a free spin's strip win counts to "${wantE}" and ends on it (the last count frames ${ce.during.join(', ')}; after the count ${ce.after.join(', ')})`, ce);
		}
		// THE BIG BOARD: a win at the back board's own bar (read from the game: LED_BOARD.tiers[backFromTier], Mega, 60x; a
		// 30x win is a Super, on the strip only, and left the board's last record in place) stepped to the end of its count;
		// its amount's record (the lit box drawn)
		const bar = await R(p, () => { const L = window.__reindeer.tune.ledBoard; return L.tiers[L.backFromTier].bar; });
		const big = Math.round(bar * bet * 100) / 100;
		const wantB = ledExpect(code, big);
		const bk = await R(p, (bar) => {
			const R0 = window.__reindeer;
			void R0.scoreboardWin(bar);
			let q = R0.scoreboardStep(10);
			for (let i = 0; i < 1500 && q.show && q.show.t <= q.show.countEnd + 50; i++) q = R0.scoreboardStep(10);
			const f = R0.scoreboardFace('back');
			const am = (f?.titles ?? []).filter((x) => x.kind === 'amount').at(-1) ?? null;
			R0.scoreboardSkip();
			for (let i = 0; i < 1500 && R0.scoreboard().show; i++) R0.scoreboardStep(10);
			R0.scoreboardLower();
			for (let i = 0; i < 300; i++) R0.scoreboardStep(10);
			return { am, W: f?.W, H: f?.H };
		}, bar);
		const a = bk.am;
		check(!!a && a.str === wantB && a.x0 >= 1 && a.x1 <= bk.W - 1 && a.y0 >= 0 && a.y1 <= bk.H, `${tag}: ${code} on the big board reads "${a?.str}" (want "${wantB}"), its lit dots inside the ${bk.W} x ${bk.H} face`, bk);
	}
	await R(p, () => window.__reindeer.ledCurrency('USD'));
	await R(p, () => window.__reindeer.scoreboardManual(false));
}

async function titles(p, S) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	await R(p, () => window.__reindeer.scoreboardManual(true));
	const cls = await R(p, () => window.__reindeer.scoreboard().cls);
	const knob = cls === 'tablet' ? 'desktop' : cls;
	/** start a scene and step it to its end, every title and amount on the back board at each step */
	const sample = (start, ms) =>
		R(p, ([start, ms]) => {
			eval(start);
			const out = [];
			for (let t = 0; t < ms; t += 10) {
				const q = window.__reindeer.scoreboardStep(10);
				const f = window.__reindeer.scoreboardFace('back');
				if (q.show && f?.titles) for (const r of f.titles) out.push({ sceneT: q.show.sceneT, t: q.show.t, phase: q.show.phase, ...r, W: f.W, H: f.H });
				if (!q.show && t > 500) break;
			}
			window.__reindeer.scoreboardCardEnd();
			window.__reindeer.scoreboardLower();
			for (let t = 0; t < 3000; t += 10) window.__reindeer.scoreboardStep(10);
			return out;
		}, [start, ms]);
	const scenes = [
		['void window.__reindeer.scoreboardWin(98.75)', 9000],
		['void window.__reindeer.scoreboardWin(312.45)', 10000],
		['void window.__reindeer.scoreboardWin(7777)', 11000],
		["window.__reindeer.scoreboardCard('fs')", 4000],
		["window.__reindeer.scoreboardCard('sfs')", 4500],
		// (2026-11-19: 248.5x counts 4 s by its size, LED_BOARD.ideas.totalBySize: run on to its wait)
		["window.__reindeer.scoreboardCard('total', { x: 248.5 })", 6500],
	];
	const judge = (rows) => {
		const by = new Map();
		for (const r of rows) {
			// at rest: TOTAL WIN after its drop, SUPER after its march, every amount in a hold or a wait (HERE WE GO, which
			// marches in and fades, is not a title at rest)
			if (r.kind === 'title' && r.str === 'TOTAL WIN' && r.sceneT < 350) continue;
			// (2026-11-19: the Super entry's tease marches SUPER in from 1900 ms, landed by 2500)
			if (r.kind === 'title' && r.str === 'SUPER' && r.sceneT < 2500) continue;
			if (r.kind === 'title' && r.str === 'HERE WE GO') continue;
			if (r.kind === 'amount' && r.phase !== 'hold' && r.phase !== 'waits') continue;
			const key = `${r.kind}:${r.kind === 'amount' ? 'amount' : r.str}`;
			if (!by.has(key)) by.set(key, []);
			by.get(key).push(r);
		}
		const out = [];
		for (const [key, list] of by) {
			const W = list[0].W;
			const off = Math.max(...list.map((r) => Math.abs((r.x0 + r.x1) / 2 - W / 2)));
			const left = Math.min(...list.map((r) => r.x0));
			const right = W - Math.max(...list.map((r) => r.x1));
			const top = Math.min(...list.map((r) => r.y0 - r.lift));
			out.push({ key, str: list[0].str, kind: list[0].kind, W, H: list[0].H, ts: list[0].ts, off: r1(off), left, right, top, n: list.length });
		}
		return out;
	};
	const ok = (x) => x.off <= 1 && Math.abs(x.left - x.right) <= 2 && x.top >= 1 && (x.kind === 'title' ? x.left >= TITLE_MARGIN && x.right >= TITLE_MARGIN : x.left >= 2 && x.right >= 2);
	const all = [];
	for (const [start, ms] of scenes) all.push(...judge(await sample(start, ms)));
	const want = ['BIG WIN', 'SUPER WIN', 'MEGA WIN', 'EPIC WIN', 'MAX WIN', 'FREE SPINS', 'SUPER', 'TOTAL WIN'];
	const seen = new Set(all.filter((x) => x.kind === 'title').map((x) => x.str));
	check(want.every((w) => seen.has(w)) && all.some((x) => x.kind === 'amount'), `${tag}: every back board title and amount drawn and measured (${[...seen].join(', ')}; ${all.filter((x) => x.kind === 'amount').length} amount groups)`);
	for (const x of all) check(ok(x), `${tag}: ${x.kind === 'title' ? x.str : `the amount (${x.str})`} (size ${x.ts}) centered on the ${x.W} x ${x.H} face within ${x.off} dots (1 wanted), ${x.left} and ${x.right} dots clear left and right, ${x.top} dots under the top${x.kind === 'title' ? ' with its bounce' : ''}`, x);
	console.log(`  ${tag} titles and amounts (class ${knob}): ${all.map((x) => `${x.kind === 'amount' ? 'amount ' + x.str : x.str} s${x.ts} off ${x.off} L${x.left} R${x.right} T${x.top}`).join('; ')}`);
	// the taste knobs at their ends: still centered and inside the face
	for (const [label, set, reset] of [
		[`the ${knob} title size at 2`, `window.__reindeer.tune.ledBoard.titles.${knob}.size = 2`, `window.__reindeer.tune.ledBoard.titles.${knob}.size = 1`],
		[`the ${knob} title size at 0.3`, `window.__reindeer.tune.ledBoard.titles.${knob}.size = 0.3`, `window.__reindeer.tune.ledBoard.titles.${knob}.size = 1`],
		['the gap at 20 dots and the bounce at 2', 'window.__reindeer.tune.ledBoard.titles.gap = 20; window.__reindeer.tune.ledBoard.titles.bounce = 2', 'window.__reindeer.tune.ledBoard.titles.gap = 0; window.__reindeer.tune.ledBoard.titles.bounce = 1'],
	]) {
		await p.evaluate(set);
		const rows = [];
		for (const [start, ms] of [scenes[0], scenes[3], scenes[5]]) rows.push(...judge(await sample(start, ms)));
		await p.evaluate(reset);
		const bad = rows.filter((x) => !ok(x));
		check(rows.length >= 4 && bad.length === 0, `${tag}: ${label}: every title and amount centered and inside the face (${rows.map((x) => `${x.kind === 'amount' ? 'amount' : x.str} s${x.ts} off ${x.off} L${x.left} R${x.right} T${x.top}`).join(', ')})`, bad);
	}
	await R(p, () => window.__reindeer.scoreboardManual(false));
}

/** what the page shows of a card now */
const cardNow = (p) =>
	R(p, () => {
		const s = window.__reindeer.scoreboard();
		return { card: s.card, phase: s.show?.phase ?? 'none', kind: s.show?.kind ?? null, sceneT: s.show?.sceneT ?? null, amount: s.show?.amount ?? null, html: !!document.querySelector('.am-ui.wrap [data-round-card]'), board: document.querySelector('[data-round-board]')?.getAttribute('data-round-card') ?? null, log: s.log.slice(-4) };
	});

// ---- PART B: THE CARDS IN REAL BONUS ROUNDS (desktop) ----
// the showcase books as the fixtures hand them over (src/fixtures/showcaseBooks.ts): one round's events by its key
const BOOKS = (() => {
	const t = readFileSync(join(SRC, 'fixtures', 'showcaseBooks.ts'), 'utf8');
	const a = t.indexOf('SHOWCASE_ROUNDS = ') + 18;
	return JSON.parse(t.slice(a, t.lastIndexOf('] as unknown') + 1));
})();
const bookOf = (name) => {
	const r = BOOKS.find((x) => x.name === name);
	return r?.events ?? BOOKS.find((x) => x.name === r?.sameBookAs)?.events ?? [];
};

async function cards(p, S, full) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	await R(p, () => window.__reindeer.turbo(0));
	// (2026-11-17) natural_free_spins with no autoplay: THE ENTRY WAITS for the press (Corey: "Free Spin Entry does not wait
	// for Press for Continue"): untouched for 5.5 s it is still up and waiting; one press then continues; its Total Win plays
	// on the back board (Corey: "the Wrap up total was shown on the plain old card") and lands on the book's own wrap-up
	// amount, the one the old HTML card showed (freeSpinEnd's, the free spins' total; the HUD's WIN is the round's)
	const seen = { intro: null, waited: null, after: null, outro: null, outroHtml: false, landed: null };
	let introAt = null;
	let pressed = false;
	const a = await playRound(p, 'natural_free_spins', {
		limit: 240000,
		during: async (s, ms) => {
			const c = await cardNow(p);
			if ((c.card === 'fs' || c.card === 'sfs') && !pressed) {
				if (introAt === null) {
					introAt = ms;
					seen.intro = c;
				}
				// (round 2, 2026-11-18) ONE PROMPT: while the board's card is up the strip says PRESS ANYWHERE; no DOM text
				// says it again (the press target is the transparent, labelled button)
				if (ms - introAt > 2500 && !seen.domPrompt) {
					seen.domPrompt = await R(p, () => [...document.querySelectorAll('body *')].filter((el) => {
						const r = el.getBoundingClientRect();
						const cs = getComputedStyle(el);
						return el.childElementCount === 0 && /continue|anywhere/i.test(el.textContent || '') && r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0;
					}).map((el) => `${el.tagName}.${el.className}: ${el.textContent.trim().slice(0, 40)}`));
					check(seen.domPrompt.length === 0, `${tag}: one prompt only: the strip's line, no DOM text prompt with the board's entry up (${seen.domPrompt.join('; ') || 'none'})`, seen.domPrompt);
				}
				// (5.5 s untouched, and pressed once the press line is up: on a slow page the scene's own clock runs behind
				// real time, and a press before the press line lands the scene instead of continuing)
				if (ms - introAt >= 5500 && c.phase === 'waits') {
					seen.waited = { ...c, after: ms - introAt };
					pressed = true;
					await p.mouse.click(S.vp.width / 2, S.vp.height * 0.3);
					await sleep(500);
					seen.after = await cardNow(p);
				}
			}
			if (c.card === 'total') {
				seen.outro ??= c;
				if (await R(p, () => !!document.querySelector('.am-ui.wrap [data-round-card="outro"]'))) seen.outroHtml = true;
				const sh = await R(p, () => window.__reindeer.scoreboard().show);
				// (landed: the count has reached its end; the last such reading is kept)
				if (sh && sh.kind === 'total' && sh.t >= sh.countEnd) seen.landed = sh;
				seen.totalSeen = sh ? { phase: sh.phase, t: sh.t, countEnd: sh.countEnd, amount: sh.amount } : seen.totalSeen;
			}
		},
	});
	check(!!seen.intro && seen.intro.board === 'intro' && !seen.intro.html, `${tag}: natural_free_spins: the entry plays on the back board (${seen.intro?.card}), the HTML card draws nothing`, seen.intro);
	check(!!seen.waited && (seen.waited.card === 'fs' || seen.waited.card === 'sfs') && seen.waited.phase === 'waits' && seen.waited.after >= 5000, `${tag}: with no autoplay the entry waits for the press: ${seen.waited ? Math.round(seen.waited.after) : 'none'} ms untouched and still up (${seen.waited?.phase})`, seen.waited);
	check(!!seen.after && seen.after.card !== 'fs' && seen.after.card !== 'sfs', `${tag}: one press then continues (the card after it: ${seen.after?.card ?? 'none'})`, seen.after);
	check(!!seen.outro && seen.outro.board === 'outro' && !seen.outroHtml && a.ok, `${tag}: its Total Win plays on the back board, not the HTML card, and the round comes back to rest (${a.ms} ms)`, { outro: seen.outro, html: seen.outroHtml, last: a.seen.slice(-3) });
	// (2026-11-17, the owner: the wrap-up's total is the round's, the HUD's WIN at the round's end: natural_free_spins's
	// trigger spin wins 50 of its 4570, so the board must read the 4570, not freeSpinEnd's 4520)
	const ev = bookOf('natural_free_spins');
	const fsEnd = ev.find((e) => e.type === 'freeSpinEnd')?.amount;
	const fin = ev.find((e) => e.type === 'finalWin')?.amount;
	const trig = ev.slice(0, ev.findIndex((e) => e.type === 'freeSpinTrigger')).filter((e) => e.type === 'winInfo').reduce((a, e) => a + e.totalWin, 0);
	const hud = await R(p, () => window.__reindeer.bookAmount(window.__reindeer.hud.win()));
	// (the LED amount carries the currency's sign since the LED currency work: only its digits are compared)
	const got = seen.landed ? Number(String(seen.landed.amount).replace(/[^0-9.]/g, '')) : NaN;
	check(trig > 0 && Math.abs(got - hud) < 0.005 && Math.abs(hud - (await R(p, (a) => window.__reindeer.bookAmount(a), fin))) < 0.005, `${tag}: the Total Win lands on ${seen.landed?.amount}, the HUD's WIN at the round's end (${hud}: finalWin ${fin}, the trigger spin's ${trig} with the free spins' ${fsEnd})`, { landed: seen.landed, last: seen.totalSeen, fsEnd, fin, hud });
	if (!full) return;
	// THE GRANDMA GAG'S RULE (2026-11-17, Corey: "let's only do the Grandma Got Run Over by a Reindeer in regular games, and
	// free spins only on the first strike or when it results in a win"): every Grandma strike's ruling (the book handler's
	// mark) and every gag the strikes asked for (the dev hook's count)
	await R(p, () => {
		window.__reindeer.gagsAsked(true);
		window.__reindeer.roadSounds(true);
	});
	const strikes = [];
	const drainStrikes = async () => {
		const log = await R(p, () => window.__reindeer.roadSounds(true));
		for (const e of log) if (e.what === 'grandmaStrike') strikes.push(e.detail);
	};
	const base = await playRound(p, 'base_grandma_strike', { limit: 60000, during: drainStrikes });
	await drainStrikes();
	const baseCalls = await R(p, () => window.__reindeer.gagsAsked(true));
	check(base.ok && strikes.length === 1 && / gag true$/.test(strikes[0]) && /^basegame/.test(strikes[0]) && baseCalls === 1, `${tag}: base_grandma_strike: a base game Grandma strike plays the gag (${strikes.join('; ')}; gags asked ${baseCalls})`, { strikes, baseCalls });
	strikes.length = 0;
	// floor_top_up: its free spins hold three Grandma strikes (the round's first on a spin with no win, a later one on a
	// paying spin, a later one with no win); its wrap-up (a top-up) plays on the back board since 2026-11-17, its top-up line
	// scrolled on the strip, no HTML card
	let fIntro = null;
	let fPressed = 0;
	const top = { board: false, html: false, line: null, lineAt: 0, pressed: false, waited: false };
	await R(p, () => window.__reindeer.gagModes(true));
	const b = await playRound(p, 'floor_top_up', {
		pressTotal: false,
		limit: 240000,
		during: async (s, ms) => {
			await drainStrikes();
			const c = await cardNow(p);
			if (c.card === 'fs' || c.card === 'sfs') {
				fIntro ??= ms;
				if (fPressed < 2 && ms - fIntro > 1500 + fPressed * 800) {
					fPressed += 1;
					await p.mouse.click(S.vp.width / 2, S.vp.height * 0.3);
				}
			}
			if (c.card === 'total') {
				top.board = true;
				if (await R(p, () => !!document.querySelector('.am-ui.wrap [data-round-card="outro"]') || !!document.querySelector('[data-top-up]'))) top.html = true;
				// (2026-11-18, LED_BOARD.explain: the wrap-up's line is on the BIG board, the strip says the press line alone; with
				// explain off it scrolls on the strip as before)
				const w = await R(p, () => {
					const h = window.__reindeer;
					if (h.tune.ledBoard.explain?.on) {
						const ex = h.scoreboardFace('back')?.explain;
						return ex && ex.page === 'explain' && !h.scoreboardFace('strip')?.entryWait ? ex.lines.join(' ') : null;
					}
					return h.scoreboardFace('strip')?.entryWait?.sentence ?? null;
				});
				if (w && !top.line) {
					top.line = w;
					top.lineAt = ms;
				}
				// (the wrap-up with a line waits for the press with no autoplay: pressed 3 s after its line came)
				if (top.line && !top.pressed && ms - top.lineAt > 3000) {
					top.pressed = true;
					top.waited = (await cardNow(p)).card === 'total';
					await p.mouse.click(S.vp.width / 2, S.vp.height * 0.3);
				}
			}
		},
	});
	check(top.board && !top.html && !!top.line && /^Includes \$[0-9.,]+ added to bring this round up to its [0-9.]+x minimum\.$/.test(top.line) && top.waited && b.ok, `${tag}: floor_top_up: the wrap-up plays on the back board with its top-up line on the big board (the strip with explain off) ("${top.line}"), no HTML card, it waits for the press, and the round ends`, top);
	await drainStrikes();
	const fsCalls = await R(p, () => window.__reindeer.gagsAsked(true));
	const rulings = strikes.map((x) => / gag (true|false)$/.exec(x)?.[1]);
	check(strikes.length === 3 && strikes.every((x) => /^freegame/.test(x)) && rulings.join() === 'true,true,false' && fsCalls === 2, `${tag}: floor_top_up's free spins: the first Grandma strike plays the gag, a later one on a paying spin plays it, a later one on a spin with no win does not (${strikes.join('; ')}; gags asked ${fsCalls})`, { strikes, fsCalls });
	// (2026-11-17) in a bonus round the gag is the short line, one screen
	const fsModes = await R(p, () => window.__reindeer.gagModes(true));
	check(fsModes.length === fsCalls && fsModes.every((m) => m === 'short'), `${tag}: floor_top_up's free spins: each gag is the short line (${fsModes.join(', ')})`, fsModes);
}

// ---- THE RACE'S RESULT CARDS (2026-11-17, Corey: the picture sat behind the words): REINDEER, POLICE CAR and the TIE, the
// pictures' columns and the words' lit columns never meet, all inside the strip
async function raceCards(p, S) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	await R(p, () => window.__reindeer.scoreboardManual(true));
	for (const force of ['reindeer', 'police', 'tie']) {
		const got = await R(p, (force) => {
			const h = window.__reindeer;
			h.scoreboardRace(force);
			const R0 = h.tune.ledBoard.race.runMs;
			const seen = [];
			for (let t = 0; t < R0 + 150 + 2400; t += 50) {
				h.scoreboardStep(50);
				const f = h.scoreboardFace('strip');
				if (f?.raceCard && (force !== 'tie' || f.raceCard.words === 'TIE')) seen.push({ ...f.raceCard, W: f.W, H: f.H });
			}
			return seen;
		}, force);
		const bad = got.filter((c) => c.pics.some(([a, b]) => !(b <= c.text[0] || c.text[1] <= a)) || c.pics.some(([a, b]) => a < 1 || b > c.W - 1) || c.text[0] < 1 || c.text[1] > c.W - 1);
		const c = got[0];
		check(got.length > 0 && bad.length === 0, `${tag}: the ${force} result card: picture${c?.pics.length > 1 ? 's' : ''} ${c ? c.pics.map(([a, b]) => `${a} to ${b}`).join(' and ') : 'none'}, the words "${c?.words}" ${c ? `${c.text[0]} to ${c.text[1]}` : ''} on the ${c?.W} dot strip: never over each other (${got.length} steps)`, bad.slice(0, 2));
	}
	await R(p, () => window.__reindeer.scoreboardManual(false));
}

// ---- THE DIM (2026-11-17, Corey: "the background fading is cut off, not covering the entire screen"): with the back board
// up the scene is dimmed edge to edge: the top band, the bottom band and the far left and right are darker than with the
// dim off
async function dimCheck(p, S) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	const W = S.vp.width;
	const H = S.vp.height;
	const regions = { top: { x: W * 0.3, y: 2, w: W * 0.4, h: 8 }, bottom: { x: W * 0.3, y: H - 10, w: W * 0.4, h: 8 }, left: { x: 2, y: H * 0.35, w: 8, h: H * 0.2 }, right: { x: W - 10, y: H * 0.35, w: 8, h: H * 0.2 } };
	const mean = (png) => {
		let t = 0;
		for (let i = 0; i < png.data.length; i += 4) t += png.data[i] + png.data[i + 1] + png.data[i + 2];
		return t / (png.data.length / 4) / 3;
	};
	await R(p, () => window.__reindeer.scoreboardManual(true));
	await R(p, () => void window.__reindeer.scoreboardWin(98.75));
	await R(p, () => window.__reindeer.scoreboardStep(10, 150));
	const on = {};
	for (const [k, r] of Object.entries(regions)) on[k] = mean(await grab(p, r));
	const alpha = await R(p, () => window.__reindeer.tune.ledBoard.dim.alpha);
	await R(p, () => (window.__reindeer.tune.ledBoard.dim.alpha = 0));
	await R(p, () => window.__reindeer.scoreboardStep(10, 60));
	const off = {};
	for (const [k, r] of Object.entries(regions)) off[k] = mean(await grab(p, r));
	await R(p, (a) => (window.__reindeer.tune.ledBoard.dim.alpha = a), alpha);
	const rect = await R(p, () => window.__reindeer.scoreboard().dim.rect);
	await R(p, () => window.__reindeer.scoreboardSkip());
	await R(p, () => window.__reindeer.scoreboardStep(10, 600));
	await R(p, () => window.__reindeer.scoreboardManual(false));
	const ratio = Object.fromEntries(Object.keys(regions).map((k) => [k, Math.round((on[k] / Math.max(1, off[k])) * 100) / 100]));
	check(rect && rect.x <= 0 && rect.y <= 0 && rect.x + rect.w >= W && rect.y + rect.h >= H && Object.values(ratio).every((v) => v <= 0.85), `${tag}: with the back board up the dim covers the whole screen (${JSON.stringify(rect)}): top, bottom, left and right at ${Object.values(ratio).join(', ')} of their undimmed brightness (0.85 or less wanted)`, { on, off, rect });
}

async function flows(p, S, errs) {
	const tag = `${S.name}`;
	// ---- THE WORDS ----
	const consts = readFileSync(join(SRC, 'game', 'constants.ts'), 'utf8');
	const block = consts.slice(consts.indexOf('export const LED_BOARD'), consts.indexOf('/** everything tunable'));
	const gagM = /gag: \{[^}]*first: '([^']*)', second: '([^']*)', third: '([^']*)'/.exec(block);
	const gagLine = gagM ? `${gagM[1]} ${gagM[2]} ${gagM[3]}` : '';
	if (SEC('gag')) {
		check(gagLine === 'Oooh.. Grandma Got Run Over!?', `${tag}: the gag's words are exactly Corey's line ("${gagLine}")`);
		const titles = [...block.matchAll(/title: '([^']*)'/g)].map((m) => m[1]);
		const draw = readFileSync(join(SRC, 'game', 'scoreboard', 'scoreboardDraw.ts'), 'utf8');
		const draw2 = readFileSync(join(SRC, 'game', 'scoreboard', 'stripDraw.ts'), 'utf8');
		const drawn = [...draw.matchAll(/'([A-Z][A-Z ]+)'/g), ...draw2.matchAll(/'([A-Z][A-Z ]+)'/g), ...draw2.matchAll(/`\$\{[^}]*\} ([A-Z]+) \$\{/g)].map((m) => m[1]).filter((x) => x.length > 1);
		const shortLine = /short: \{ text: '([^']*)'/.exec(block)?.[1] ?? '';
		check(shortLine === 'GRANDMA GOT RUN OVER!', `${tag}: the short Grandma line reads "${shortLine}"`);
		const words = [...titles, ...drawn, gagLine, shortLine];
		const banned = /\b(bets?|buy|buys|cash|money|paid|credits?|gamble|gambling|wager|wagers|stake)\b/i;
		check(words.length > 8 && !words.some((w) => banned.test(w)) && words.every((w) => /^[A-Za-z0-9 .,?'!]+$/.test(w)), `${tag}: the scoreboard's words have none of the restricted words and no symbol characters (${[...new Set(words)].join(' / ')})`, words);

		// the gag by hand: 5 s, its beats
		await R(p, () => window.__reindeer.scoreboardManual(true));
		await R(p, () => window.__reindeer.scoreboardGag());
		const beats = [];
		for (let t = 0; t <= 5100; t += 100) {
			const g = await R(p, () => window.__reindeer.scoreboardStep(100).gag);
			beats.push({ t: t + 100, words: g?.words ?? null });
		}
		const on = beats.filter((b) => b.words !== null);
		const shown = [...new Set(on.map((b) => b.words).filter(Boolean))].join(' ');
		check(on.length >= 49 && on.length <= 50 && beats[beats.length - 1].words === null, `${tag}: the gag stays ${on.length * 100} ms (5 s) and goes`, beats.slice(-4));
		check(shown === gagLine, `${tag}: its beats show "${shown}"`);
		await R(p, () => window.__reindeer.scoreboardManual(false));
		// cut by a Big message on the strip (part B: a small win waits for the gag instead; the scenes section checks it by hand)
		await R(p, () => window.__reindeer.scoreboardGag());
		await sleep(400);
		await R(p, () => void window.__reindeer.scoreboardWin(21.85));
		await sleep(150);
		// (the log since the win was asked: the strip's own lines, 2026-11-17, came between the cut and the last 3 entries)
		const c1 = await R(p, () => ({ gag: window.__reindeer.scoreboard().gag, log: window.__reindeer.scoreboard().log.slice(-8) }));
		check(c1.gag === null && c1.log.some((l) => l.what === 'gag' && /cut: a win on the strip/.test(l.detail)), `${tag}: a Big win message on the strip cuts the gag short`, c1);
		await R(p, () => window.__reindeer.scoreboardSkip());
		await sleep(300);
		await R(p, () => window.__reindeer.scoreboardSkip());
		await sleep(1500);
		// cut by a new spin's press
		await R(p, () => window.__reindeer.scoreboardGag());
		await sleep(500);
		const r = await playRound(p, 'no_win_1', { limit: 30000 });
		const c2 = await R(p, () => window.__reindeer.scoreboard().log.slice(-6));
		check(r.ok && c2.some((l) => l.what === 'gag' && /cut: a new spin/.test(l.detail)), `${tag}: a new spin's press cuts the gag short`, c2);
		// a real Grandma strike starts it (base_grandma_strike: the reindeer strikes Grandma's car); part B: the round's own small
		// win no longer cuts it, it waits and shows after the gag
		const g = await playRound(p, 'base_grandma_strike', { limit: 60000 });
		await sleep(6000);
		const c3all = await R(p, () => window.__reindeer.scoreboard().log.slice(-14));
		// (this round's gag: the last start, and what follows it)
		const st = [...c3all].reverse().find((l) => l.what === 'gag' && l.detail === 'start');
		const c3 = st ? c3all.filter((l) => l.at >= st.at) : c3all;
		const cut = c3.find((l) => l.what === 'gag' && /cut/.test(l.detail ?? ''));
		const end = c3.find((l) => l.what === 'gag' && l.detail === 'end');
		const waited = c3.find((l) => l.what === 'small' && /waits for the gag/.test(l.detail ?? ''));
		const small = c3.find((l) => l.what === 'show' && /^small/.test(l.detail ?? ''));
		check(g.ok && !!st, `${tag}: a real strike on a Grandma starts the gag (base_grandma_strike)`, c3);
		// (2026-11-17, the strip's priority order: the round's small win shows over the gag when it is due, nothing queues; the
		// gag is not cut and ends at its own time)
		check(!!st && !cut && !!end && end.at - st.at >= 4900 && !waited && (!small || small.at < end.at), `${tag}: in base_grandma_strike the gag runs its ${end && st ? end.at - st.at : '?'} ms uncut; the round's small win does not wait for it (${small ? `shown ${small.at - st.at} ms into the gag` : 'none'})`, c3);
	}

	// ---- THE RACE ----
	if (SEC('race')) {
		const T = await R(p, () => window.__reindeer.raceTally(20261117, 300));
		const sd = (q) => Math.sqrt(300 * q * (1 - q));
		const within = (n, q) => Math.abs(n - 300 * q) <= 3 * sd(q);
		check(within(T.reindeer, 0.45) && within(T.police, 0.45) && within(T.tie, 0.1), `${tag}: 300 seeded races: reindeer ${T.reindeer}, police car ${T.police}, tie ${T.tie} (odds 45 / 45 / 10, each within 3 standard deviations)`, T);
		check(T.mismatches === 0, `${tag}: in every run the one ahead at the line is the drawn result`, T);
		check(T.leadChangesMin >= 1, `${tag}: the lead changes hands in every run (${T.leadChangesMin} to ${T.leadChangesMax} times)`, T);
		for (const force of ['reindeer', 'police', 'tie']) {
			const tr = await R(p, (f) => window.__reindeer.raceTrace(f), force);
			check(tr.outcome === force && tr.ahead === force, `${tag}: a forced ${force} result plays as ${tr.ahead} (gap at the line ${tr.gapAtLine})`, tr);
		}
		const race = readFileSync(join(SRC, 'game', 'scoreboard', 'race.ts'), 'utf8');
		const code = race.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
		check(!/Math\.random/.test(code) && /raceRandom/.test(code), `${tag}: the race draws from its own seeded source (no Math.random in its code)`);
		const handlers = readFileSync(join(SRC, 'game', 'bookEventHandlerMap.ts'), 'utf8');
		// Promise.race is JavaScript's own (the handlers use it to cap a clip wait); only the scoreboard's race counts
		check(!/race/i.test(handlers.replace(/Promise\.race/g, '')), `${tag}: nothing of a round touches the race (the book handlers never mention it)`);
		// on the strip: the race cartoon, forced, plays and its card says the result
		await R(p, () => window.__reindeer.scoreboardRace('tie'));
		await sleep(400);
		const sr = await R(p, () => window.__reindeer.scoreboard().cartoon);
		check(sr.key === 'race' && sr.race?.outcome === 'tie', `${tag}: the race plays on the strip with the chosen result (${sr.key}, ${sr.race?.outcome})`, sr);
	}

	// ---- NOTHING STRANDS A ROUND ----
	if (SEC('round')) {
		// a Spin press during the rise lands the count; the round ends
		let pressed = false;
		const a = await playRound(p, 'base_two_columns', {
			during: async (s) => {
				if (!pressed && s.phase === 'rising') {
					pressed = true;
					await p.click('.hudp button.spin').catch(() => {});
				}
			},
		});
		const skippedA = a.seen.some((x) => x.skipped);
		check(pressed && skippedA && a.ok, `${tag}: a Spin press during the rise lands the count and the round ends (${a.ms} ms; Mega ${a.seen.some((x) => x.tier === 2) ? 'shown' : 'not shown'})`, a.seen.slice(-6));
		// a slam stop during the spin, then the win plays out by itself
		let slammed = false;
		const b = await playRound(p, 'base_two_columns', {
			during: async (s, ms) => {
				if (!slammed && ms > 350 && s.phase === 'none' && !s.idle) {
					slammed = true;
					await p.click('.hudp button.spin').catch(() => {});
				}
			},
		});
		check(slammed && b.ok && b.seen.some((x) => x.tier === 2) && !b.seen.some((x) => x.skipped), `${tag}: after a slam stop the Mega win plays out by itself and the round ends (${b.ms} ms)`, b.seen.slice(-6));
		// slammed, so Spin is spent: a tap on the board skips the count
		let slam2 = false;
		let tapped = false;
		const c = await playRound(p, 'base_two_columns', {
			during: async (s, ms) => {
				if (!slam2 && ms > 350 && s.phase === 'none' && !s.idle) {
					slam2 = true;
					await p.click('.hudp button.spin').catch(() => {});
				}
				if (slam2 && !tapped && s.phase === 'count' && s.tier >= 0) {
					tapped = true;
					await p.mouse.click(S.vp.width / 2, S.vp.height * 0.4);
				}
			},
		});
		check(tapped && c.ok && c.seen.some((x) => x.skipped), `${tag}: with Spin spent by a slam, a tap on the board skips the count (${c.ms} ms)`, c.seen.slice(-6));
		// AUTOPLAY AT TURBO 2: three Mega rounds in a row
		await R(p, () => {
			window.__reindeer.turbo(2);
			window.__reindeer.fixtures.next('base_two_columns', true);
		});
		await p.click('.hudp button[aria-label="Autoplay"]');
		await sleep(700);
		await p.click('.am-ui.layer.modals .go');
		await sleep(700);
		const plays0 = await R(p, () => window.__reindeer.fixtures.log().plays.length);
		await p.click('.hudp button.spin');
		const t0 = Date.now();
		const shows = new Map();
		let stopped = false;
		await R(p, () => window.__reindeer.roadSounds(true));
		while (Date.now() - t0 < 150000) {
			const s = await R(p, () => {
				const s = window.__reindeer.scoreboard();
				return { id: s.show?.id ?? null, kind: s.show?.kind, hold: s.show ? s.show.exitAt - s.show.countEnd : null, count: s.show ? s.show.countEnd - s.show.countStart : null, plays: window.__reindeer.fixtures.log().plays.length, auto: document.querySelector('.hudp button.spin')?.getAttribute('aria-label')?.startsWith('Stop autoplay') === true, fired: s.show?.fired ?? [] };
			});
			if (s.id && s.kind === 'win' && !shows.has(s.id)) shows.set(s.id, s);
			if (s.id && shows.has(s.id) && s.fired.length >= shows.get(s.id).fired.length) shows.get(s.id).fired = s.fired;
			if (!stopped && s.plays - plays0 >= 3) {
				stopped = true;
				await R(p, () => window.__reindeer.fixtures.clear());
				await p.click('.hudp button.spin').catch(() => {});
			}
			if (stopped) {
				const done = await R(p, () => window.__reindeer.hud.idle() && window.__reindeer.atRest() && !window.__reindeer.scoreboard().show && document.querySelector('.hudp button.spin')?.getAttribute('aria-label')?.startsWith('Stop autoplay') !== true);
				if (done) break;
			}
			await sleep(80);
		}
		// (the round the Stop press lands in is no longer an autoplay round: its hold is the normal one)
		const list = [...shows.values()].filter((x) => x.auto);
		const end = await R(p, () => ({ idle: window.__reindeer.hud.idle(), rest: window.__reindeer.atRest(), show: window.__reindeer.scoreboard().show?.phase ?? null, plays: window.__reindeer.fixtures.log().plays.length }));
		check(stopped && end.idle && end.rest && !end.show, `${tag}: autoplay at turbo 2 ran ${end.plays - plays0} Mega rounds and came back to rest when stopped`, end);
		check(list.length >= 2 && list.every((x) => x.hold === 400 && Math.abs(x.count - 5000 / 2.6) < 30), `${tag}: in autoplay each win holds 400 ms and counts at the turbo rate (${list.map((x) => `${Math.round(x.count)} ms + ${x.hold}`).join(', ')}; 5000 / 2.6 = ${Math.round(5000 / 2.6)})`, list);
// part B: the tier sounds at turbo 2 in autoplay, once per tier per round (asked of the road's sound log)
const asked = (await R(p, () => window.__reindeer.roadSounds())).filter((e) => e.kind === 'sound' && /^sfx_win_(big|super|mega|epic|max)$/.test(e.what) && !/^stop/.test(e.detail || ''));
const firedAll = [...shows.values()].reduce((a, x) => a + x.fired.length, 0);
check(list.length >= 2 && list.every((x) => x.fired.join() === '0,1,2') && asked.length === firedAll, `${tag}: autoplay at turbo 2: each Mega round sounds Big, Super and Mega once (${asked.length} tier sounds for ${shows.size} wins: ${[...shows.values()].map((x) => x.fired.join('')).join(' ')})`, { asked: asked.map((e) => e.what), fired: [...shows.values()].map((x) => x.fired) });
		await R(p, () => window.__reindeer.turbo(0));
	}
	check(errs.length === 0, `${tag}: no page errors`, errs);
}

// ---- 2026-11-17: THE STRIP'S PRIORITY ORDER, THE SCATTER COUNT, THE SHORT GRANDMA LINE (constants LED_BOARD stripOrder,
// scatterCount, gag.short, gagShortIn; game/scoreboard/stripArbiter.ts) ----
// (2026-11-18: 'wheel', the Super wheel's line, just under a card's own, game/road/superWheel.ts)
const ORDER = 'entry,wheel,bigWin,scatter,winAmount,spinsLeft,gag,cartoon,race';
async function stripOrder(p, S) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	const step = (ms, n = 1) => R(p, ([ms, n]) => window.__reindeer.scoreboardStep(ms, n), [ms, n]);
	const it = (s) => s.stripPick?.item;
	const logSince = async (at) => (await R(p, () => window.__reindeer.scoreboard().log)).filter((l) => l.at >= at);
	const consts = readFileSync(join(SRC, 'game', 'constants.ts'), 'utf8');
	const m = /stripOrder: \[([^\]]*)\]/.exec(consts);
	const order = m ? [...m[1].matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1]).join() : '';
	check(order === ORDER, `${tag}: the strip's order is data in constants LED_BOARD.stripOrder (${order})`);
	await quietBoard(p);
	await R(p, () => {
		window.__reindeer.scoreboardManual(true);
		window.__reindeer.scoreboardScatter(undefined);
	});
	await step(100, 40);
	// 1. the spin's win amount over the Grandma line: at once, the gag not cut and not queued; the gag back after it while it is
	// still in its time
	let s0 = await step(0);
	await R(p, () => window.__reindeer.scoreboardGag());
	let s = await step(100, 3);
	const g0 = it(s);
	await R(p, () => void window.__reindeer.scoreboardWin(3.4));
	s = await step(100, 2);
	const a1 = { item: it(s), gag: s.stripPick.truth.gag, small: s.show?.kind };
	s = await step(100, 28);
	const a2 = { item: it(s), gag: s.gag?.words ?? null, show: s.show?.phase ?? null };
	let L = await logSince(s0.clock);
	check(g0 === 'gag' && a1.item === 'winAmount' && a1.gag && a2.item === 'gag' && !L.some((l) => l.what === 'gag' && /cut/.test(l.detail ?? '')) && !L.some((l) => /waits/.test(l.detail ?? '')), `${tag}: ORDER 4 over 6: a small win cuts the Grandma line at once (strip ${g0} then ${a1.item}, the gag still true under it) and nothing queues; when the win amount ends the gag shows again, still in its time (${a2.item}, "${a2.gag}")`, { g0, a1, a2, log: L.slice(-8) });
	await step(100, 30);
	// 2. a big win over the spin's win amount
	s0 = await step(0);
	await R(p, () => void window.__reindeer.scoreboardWin(3.4));
	s = await step(100, 2);
	const b1 = it(s);
	await R(p, () => void window.__reindeer.scoreboardWin(21.85));
	s = await step(100, 3);
	check(b1 === 'winAmount' && it(s) === 'bigWin', `${tag}: ORDER 2 over 4: a Big win cuts the spin's win amount at once (${b1} then ${it(s)})`);
	await R(p, () => window.__reindeer.scoreboardSkip());
	await step(100, 2);
	await R(p, () => window.__reindeer.scoreboardSkip());
	await step(100, 40);
	// 3. the bonus entry over everything; a lower item that comes while it is up is dropped (nothing queues)
	s0 = await step(0);
	await R(p, () => window.__reindeer.scoreboardCard('fs'));
	s = await step(100, 12);
	const c1 = it(s);
	await R(p, () => void window.__reindeer.scoreboardWin(3.4));
	await R(p, () => window.__reindeer.scoreboardGag());
	await R(p, () => window.__reindeer.scoreboardScatter({ id: 7, count: 2, need: 3, live: true, hit: false, reached: 0 }));
	s = await step(100, 3);
	L = await logSince(s0.clock);
	check(c1 === 'entry' && it(s) === 'entry' && s.show?.kind === 'fs' && L.some((l) => l.what === 'small' && /dropped/.test(l.detail ?? '')), `${tag}: ORDER 1: the bonus entry is never cut: a small win, the gag and a scatter count while it is up leave it on the strip (${it(s)}; the small win dropped)`, { c1, now: it(s), log: L.slice(-6) });
	await R(p, () => {
		window.__reindeer.scoreboardScatter(undefined);
		window.__reindeer.scoreboardCardEnd();
		window.__reindeer.scoreboardLower();
	});
	await step(100, 40);
	// 4. the scatter count over the win amount and the gag; under a big win, and back when the big win ends (still true)
	await R(p, () => window.__reindeer.scoreboardScatter({ id: 8, count: 2, need: 3, live: true, hit: false, reached: 0 }));
	s = await step(100, 2);
	const d0 = it(s);
	await R(p, () => void window.__reindeer.scoreboardWin(3.4));
	await R(p, () => window.__reindeer.scoreboardGag());
	s = await step(100, 2);
	const d1 = { item: it(s), small: s.stripPick.truth.winAmount, gag: s.stripPick.truth.gag };
	await R(p, () => void window.__reindeer.scoreboardWin(21.85));
	s = await step(100, 3);
	const d2 = it(s);
	await R(p, () => window.__reindeer.scoreboardSkip());
	await step(100, 2);
	await R(p, () => window.__reindeer.scoreboardSkip());
	s = await step(100, 10);
	const d3 = it(s);
	check(d0 === 'scatter' && d1.item === 'scatter' && d1.small && d1.gag && d2 === 'bigWin' && d3 === 'scatter', `${tag}: ORDER 3: the scatter count over the win amount and the gag (${d0}, ${d1.item} with both true under it), under a Big win (${d2}), back when it ends (${d3})`, { d0, d1, d2, d3 });
	// a trigger: the fireworks; then the entry takes over at once
	await R(p, () => window.__reindeer.scoreboardScatter({ id: 8, count: 3, need: 4, live: false, hit: true, reached: 3 }));
	s = await step(100, 2);
	const e1 = { item: it(s), fw: s.scatter?.fireworks, words: s.scatter?.words };
	await R(p, () => window.__reindeer.scoreboardCard('fs'));
	s = await step(100, 1);
	check(e1.item === 'scatter' && e1.fw && e1.words === '3 OF 3' && it(s) === 'entry', `${tag}: a trigger plays the fireworks over the count ("${e1.words}") and the bonus entry takes the strip at once by priority (${it(s)})`, { e1, now: it(s) });
	await R(p, () => {
		window.__reindeer.scoreboardScatter(undefined);
		window.__reindeer.scoreboardCardEnd();
		window.__reindeer.scoreboardLower();
	});
	await step(100, 40);
	// 5. a bonus round: the spins left over the gag, the cartoons in their turn, the win amount over the spins left
	await R(p, () => window.__reindeer.roundSign(true));
	await sleep(120);
	s = await step(100, 1);
	const f0 = it(s);
	await R(p, () => window.__reindeer.scoreboardGag());
	s = await step(100, 3);
	const f1 = { item: it(s), gag: s.stripPick.truth.gag };
	const seq = [];
	for (let i = 0; i < 90; i++) {
		s = await step(100);
		if (seq[seq.length - 1] !== it(s)) seq.push(it(s));
	}
	// (2026-11-18, Corey: no idle animations in a bonus round: the spins left are the resting state, the Grandma line shows
	// over them, never a cartoon)
	check(f0 === 'spinsLeft' && f1.item === 'gag' && f1.gag && seq.includes('spinsLeft') && !seq.includes('cartoon') && !seq.includes('race'), `${tag}: a bonus round rests on the spins left, the Grandma line shows over them, no cartoon or race (${f0}, then ${f1.item}; ${seq.join(' > ')})`, { f0, f1, seq });
	await R(p, () => void window.__reindeer.scoreboardWin(3.4));
	s = await step(100, 2);
	check(it(s) === 'winAmount', `${tag}: ORDER 4 over 5: a win amount in a bonus round shows over the spins left (${it(s)})`);
	await step(100, 30);
	// 6. the race only at true idle
	await R(p, () => window.__reindeer.roundSign(false));
	await sleep(120);
	await step(100, 3);
	await R(p, () => window.__reindeer.scoreboardRace('reindeer'));
	s = await step(100, 3);
	const r0 = it(s);
	s0 = await step(0);
	await R(p, () => window.__reindeer.roundSign(true));
	await sleep(120);
	s = await step(100, 3);
	L = await logSince(s0.clock);
	const r1x = it(s);
	await R(p, () => window.__reindeer.roundSign(false));
	await sleep(120);
	s = await step(100, 3);
	// (a bonus round shows no idle content since 2026-11-18: the race is simply not shown there)
	check(r0 === 'race' && r1x !== 'race' && r1x !== 'cartoon', `${tag}: ORDER 8: the race plays at true idle (${r0}); away from it (a bonus round) it is cut (${r1x})`, { r0, r1x, cartoon: s.cartoon, log: L.slice(-5) });
	await step(100, 30);
	// THE SHORT GRANDMA LINE by hand: one screen, its words, about 1.5 s
	await R(p, () => window.__reindeer.scoreboardGag(true));
	const beats = [];
	for (let t = 0; t <= 1800; t += 100) {
		const g = (await step(100)).gag;
		beats.push(g ? `${g.short ? 'short' : 'full'}:${g.words}` : null);
	}
	const on = beats.filter(Boolean);
	check(on.length >= 14 && on.length <= 15 && new Set(on).size === 1 && on[0] === 'short:GRANDMA GOT RUN OVER!' && beats[beats.length - 1] === null, `${tag}: the short Grandma line is ONE screen, "GRANDMA GOT RUN OVER!", for ${on.length * 100} ms`, beats);
	const face = await R(p, () => {
		window.__reindeer.scoreboardGag(true);
		window.__reindeer.scoreboardStep(1000);
		return window.__reindeer.scoreboardFace('strip');
	});
	check(face.lit > 40, `${tag}: the short line draws on the strip (${face.lit} lit dots of ${face.dots})`);
	await step(100, 10);
	await R(p, () => window.__reindeer.scoreboardManual(false));
}

/** THE SCATTER COUNT in real rounds: a posed miss (two presents early, no third), natural_free_spins and natural_super (a
 *  trigger: fireworks, then the entry takes over). Every 25 ms: the strip's pick and the count */
async function scatterRounds(p, S) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	await quietBoard(p);
	await R(p, () => window.__reindeer.turbo(0));
	const watch = async (name, book, { untilEntry = false, limit = 30000 } = {}) => {
		if (book) await R(p, (b) => window.__reindeer.fixtures.queue(b, 0), book);
		else await R(p, (n) => window.__reindeer.fixtures.next(n), name);
		const rows = [];
		const t0 = Date.now();
		await p.click('.hudp button.spin');
		while (Date.now() - t0 < limit) {
			// (the strip picks on its own drawn steps, 30 a second: a draw of this moment first, so the pick read is the
			// one for the state read with it)
			const r = await R(p, () => {
				window.__reindeer.scoreboardStep(0);
				const s = window.__reindeer.scoreboard();
				return { item: s.stripPick?.item, sc: s.scatter, card: s.card, rest: window.__reindeer.atRest(), idle: window.__reindeer.hud.idle(), log: s.log.slice(-3) };
			});
			rows.push({ ms: Date.now() - t0, ...r });
			if (untilEntry && r.card) break;
			if (!untilEntry && r.idle && r.rest && Date.now() - t0 > 2500 && !r.sc) break;
			await sleep(25);
		}
		const log = await R(p, () => window.__reindeer.scoreboard().log);
		return { rows, log };
	};
	// the posed miss: the top lane's lead and second cars carry presents (seen first), nothing else
	const dir = await R(p, () => window.__reindeer.tune.road.laneDirection);
	const col = (lane, k) => (dir[lane] > 0 ? 4 - k : k);
	const FILL = ['L1', 'H2', 'L3', 'H3', 'L5', 'H4', 'L2', 'L4'];
	const board = Array.from({ length: 5 }, (_, reel) => Array.from({ length: 4 }, (_, row) => FILL[(reel * 3 + row * 5) % FILL.length]));
	board[col(0, 0)][0] = 'S';
	board[col(0, 1)][0] = 'S';
	const miss = [
		{ index: 0, type: 'reveal', gameType: 'basegame', board },
		{ index: 1, type: 'setTotalWin', amount: 0 },
		{ index: 2, type: 'finalWin', amount: 0 },
	];
	const M = await watch('miss', miss);
	const live = M.rows.filter((r) => r.sc?.live);
	const words = [...new Set(live.map((r) => r.sc.words))];
	const fwM = M.rows.some((r) => r.sc?.fireworks);
	const missLog = M.log.filter((l) => l.what === 'scatter');
	check(live.length > 3 && live.every((r) => r.item === 'scatter') && words.join() === '2 OF 3', `${tag}: MISS: two presents seen with cars still to come: the strip shows the count "${words.join(', ')}" (${live.length} samples, strip ${[...new Set(live.map((r) => r.item))].join()})`, { words, n: live.length });
	check(!fwM && missLog.some((l) => /^miss 2/.test(l.detail)) && M.rows[M.rows.length - 1].item !== 'scatter', `${tag}: MISS: it clears quietly when the last car is seen (no fireworks; ${missLog.map((l) => l.detail).join(', ')}; then ${M.rows[M.rows.length - 1].item})`, missLog);
	// the hits
	for (const name of ['natural_free_spins', 'natural_super']) {
		const H = await watch(name, null, { untilEntry: true, limit: 40000 });
		const hl = H.log.filter((l) => l.what === 'scatter').map((l) => l.detail);
		const ticks = hl.filter((d) => /^tick/.test(d));
		const fwRows = H.rows.filter((r) => r.sc?.fireworks);
		const strip = [];
		for (const r of H.rows) if (strip[strip.length - 1] !== r.item) strip.push(r.item);
		const iFw = strip.indexOf('scatter');
		check(hl.some((d) => /^count 2 of 3/.test(d)) && hl.some((d) => /^hit /.test(d)) && fwRows.length > 0 && fwRows.every((r) => r.item === 'scatter' || r.card), `${tag}: HIT ${name}: the count starts at 2 of 3, ticks up (${ticks.join(', ') || 'none'}), and the trigger plays its fireworks on the strip (${hl.join('; ')})`, { hl, strip });
		check(iFw >= 0 && strip.slice(iFw).includes('entry') && H.rows[H.rows.length - 1].card, `${tag}: HIT ${name}: then the bonus entry takes the strip by priority (${strip.join(' > ')})`, strip);
		// finish the round: press through the cards
		for (let i = 0; i < 400; i++) {
			const st = await R(p, () => ({ card: window.__reindeer.scoreboard().card, idle: window.__reindeer.hud.idle(), rest: window.__reindeer.atRest(), html: !!document.querySelector('.round-card, .roundcard, [data-round-card]') }));
			if (st.idle && st.rest && !st.card) break;
			if (st.card) await p.mouse.click(S.vp.width / 2, S.vp.height * 0.3).catch(() => {});
			// (the Super wheel waits for its press too, 2026-11-18: ui/WheelGate.svelte)
			else await R(p, () => document.querySelector('button[data-wheel-gate]')?.click());
			await sleep(400);
		}
	}
	// nothing of the count on the back board: it is the strip's only (the back board is down through the count)
	check(M.rows.every((r) => !r.card), `${tag}: the scatter count never uses the back board`);
}

/** THE SHORT GRANDMA LINE BY PLAY MODE (constants LED_BOARD.gagShortIn): manual base play the full line; turbo the short */
async function gagModes(p, S) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	await R(p, () => window.__reindeer.gagModes(true));
	await R(p, () => window.__reindeer.turbo(0));
	const a = await playRound(p, 'base_grandma_strike', { limit: 60000 });
	const m0 = await R(p, () => window.__reindeer.gagModes(true));
	await R(p, () => window.__reindeer.turbo(1));
	const b = await playRound(p, 'base_grandma_strike', { limit: 60000 });
	const m1 = await R(p, () => window.__reindeer.gagModes(true));
	await R(p, () => window.__reindeer.turbo(0));
	check(a.ok && b.ok && m0.join() === 'full' && m1.join() === 'short', `${tag}: base_grandma_strike in manual base play plays the full line (${m0.join()}), at turbo 1 the short one (${m1.join()})`, { m0, m1 });
	// autoplay: two rounds of base_grandma_strike
	await R(p, () => window.__reindeer.fixtures.next('base_grandma_strike', true));
	await p.click('.hudp button[aria-label="Autoplay"]');
	await sleep(700);
	await p.click('.am-ui.layer.modals .go');
	await sleep(700);
	const plays0 = await R(p, () => window.__reindeer.fixtures.log().plays.length);
	await p.click('.hudp button.spin');
	const t0 = Date.now();
	let stopped = false;
	while (Date.now() - t0 < 120000) {
		const st = await R(p, () => ({ plays: window.__reindeer.fixtures.log().plays.length, idle: window.__reindeer.hud.idle(), rest: window.__reindeer.atRest(), auto: document.querySelector('.hudp button.spin')?.getAttribute('aria-label')?.startsWith('Stop autoplay') === true }));
		if (!stopped && st.plays - plays0 >= 2) {
			stopped = true;
			await R(p, () => window.__reindeer.fixtures.clear());
			await p.click('.hudp button.spin').catch(() => {});
		}
		if (stopped && st.idle && st.rest && !st.auto) break;
		await sleep(150);
	}
	const m2 = await R(p, () => window.__reindeer.gagModes(true));
	// (the round the Stop press lands in may be played as a manual round: its gag is the full one)
	check(stopped && m2.length >= 1 && m2[0] === 'short', `${tag}: in autoplay the Grandma gag is the short line (${m2.join(', ')})`, m2);
}

/** THE BONUS ROUND'S STRIP (2026-11-18, Corey: "take the idle animations on the small LED screen out of Bonus Games, it's
 *  causing them to flash back and forth"): over a whole natural_free_spins round and a natural_super round, from the entry
 *  board's end to the wrap-up board's end the strip shows no cartoon or race; the Grandma line at most LED_BOARD.gagPerBonus
 *  times; no two changes of the strip closer than LED_BOARD.bonusHoldMs unless the new item ranks higher (an interrupt);
 *  the spins left whenever nothing else is due */
async function bonusStrip(p, S) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	await quietBoard(p);
	const K = await R(p, () => ({ hold: window.__reindeer.tune.ledBoard.bonusHoldMs, gags: window.__reindeer.tune.ledBoard.gagPerBonus, order: window.__reindeer.tune.ledBoard.stripOrder }));
	const rank = (x) => K.order.indexOf(x);
	for (const name of ['natural_free_spins', 'natural_super']) {
		const seen = new Map();
		const samples = [];
		let pressed = 0;
		const r = await playRound(p, name, {
			limit: 300000,
			during: async () => {
				const o = await R(p, () => { const s = window.__reindeer.scoreboard(); return { log: s.log, free: s.free, item: s.stripPick?.item, truth: s.stripPick?.truth, card: s.card, clock: s.clock }; });
				for (const l of o.log) seen.set(`${l.at}|${l.what}|${l.detail}`, l);
				samples.push(o);
				// press through the cards (entry and wrap-up) after a short look
				if (o.card && pressed < 6) {
					pressed += 1;
					await sleep(1200);
					await p.mouse.click(S.vp.width / 2, S.vp.height * 0.3).catch(() => {});
				}
				// (the Super wheel waits for its press too, 2026-11-18: ui/WheelGate.svelte)
				else if (!o.card) await R(p, () => document.querySelector('button[data-wheel-gate]')?.click());
			},
		});
		const log = [...seen.values()].sort((a, b) => a.at - b.at);
		// the bonus round's span: from the first spin played under it (free true) to the wrap-up's end
		const freeSamples = samples.filter((x) => x.free && !x.card);
		const t0 = freeSamples[0]?.clock ?? Infinity;
		const t1 = freeSamples[freeSamples.length - 1]?.clock ?? -Infinity;
		const inRound = log.filter((l) => l.at >= t0 && l.at <= t1);
		const strip = inRound.filter((l) => l.what === 'strip').map((l) => ({ at: l.at, item: /^(\w+)/.exec(l.detail)[1], was: /was (\w+)/.exec(l.detail)?.[1] }));
		const idle = strip.filter((x) => x.item === 'cartoon' || x.item === 'race');
		check(r.ok && freeSamples.length > 10 && idle.length === 0 && !freeSamples.some((x) => x.item === 'cartoon' || x.item === 'race'), `${tag} ${name}: in the bonus round the strip never shows a cartoon or the race (${strip.length} changes: ${[...new Set(strip.map((x) => x.item))].join(', ')})`, { idle: idle.slice(0, 4), ok: r.ok });
		const gags = inRound.filter((l) => l.what === 'gag' && /^start/.test(l.detail ?? ''));
		check(gags.length <= K.gags, `${tag} ${name}: the Grandma line at most ${K.gags} times in the round (${gags.length}: ${gags.map((g) => g.detail).join(', ')})`);
		const fast = strip.filter((x, i) => i > 0 && x.at - strip[i - 1].at < K.hold && !(rank(x.item) < rank(x.was)));
		check(fast.length === 0, `${tag} ${name}: no two changes of the strip closer than ${K.hold} ms unless the new item ranks higher (${fast.length} too close)`, fast.slice(0, 4));
		const rest = freeSamples.filter((x) => x.truth && Object.entries(x.truth).every(([k, v]) => !v || ['spinsLeft', 'cartoon', 'race'].includes(k)));
		check(rest.length > 0 && rest.every((x) => x.item === 'spinsLeft'), `${tag} ${name}: the spins left show whenever nothing else is due (${rest.length} samples, ${rest.filter((x) => x.item !== 'spinsLeft').length} not)`);
	}
}

/** M4 (2026-11-19, the blind review's garbled strip and the Total Win without its amount), driven by hand:
 *  - THE CLEAN SCAN: when the strip scans to a message (a small win over the cartoons), right of the scan line the face is the
 *    old picture alone, dot for dot (alpha; the shimmer only tints lit dots), on every step of the scan: the new message is
 *    never drawn under the old one there ("$9.10EFT" was the two at once for the whole 150 ms)
 *  - THE TOTAL WIN'S AMOUNT: from the board's power on (its scan done) to its power down, whenever the title is lit the amount
 *    is lit too, the landing blink's dim beats included (they used to put it out while the press line was up) */
async function m4Checks(p, S) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	await quietBoard(p);
	const r = await R(p, async () => {
		const h = window.__reindeer;
		const alphaOf = async (which) => {
			const f = h.scoreboardFace(which, true);
			const img = new Image();
			img.src = f.png;
			await img.decode();
			// (2026-11-19, the finer grid: the face's png is one pixel per LED, f.k LEDs per dot; W, H here are its LEDs and the
			// records (in dots) are read at x k)
			const c = document.createElement('canvas');
			c.width = f.ledW;
			c.height = f.ledH;
			const g = c.getContext('2d');
			g.drawImage(img, 0, 0);
			const d = g.getImageData(0, 0, f.ledW, f.ledH).data;
			const a = new Uint8Array(f.ledW * f.ledH);
			for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
			return { a, W: f.ledW, H: f.ledH, k: f.k, titles: f.titles };
		};
		h.scoreboardManual(true);
		h.scoreboardScatter(undefined);
		h.scoreboardStep(100, 30);
		// 1. the scan, from a clean picture (not inside a switch of its own, a cartoon's dissolve into the next)
		let s = h.scoreboardStep(0);
		for (let i = 0; i < 60 && !(s.stripSwitch && s.stripSwitch.since > 500); i++) s = h.scoreboardStep(50);
		const item0 = s.stripPick?.item;
		const A0 = await alphaOf('strip');
		let lit0 = 0;
		for (const v of A0.a) if (v > 40) lit0 += 1;
		void h.scoreboardWin(0.5, { small: true });
		const steps = [];
		for (let i = 0; i < 8; i++) {
			s = h.scoreboardStep(i === 0 ? 0 : 20);
			const sw = s.stripSwitch;
			if (!sw || sw.kind !== 'scan' || sw.since >= h.tune.ledBoard.strip.switchMs) break;
			const A = await alphaOf('strip');
			// the line (one dot: max(1, round(k)) LEDs) at its LED column; right of it the old picture
			const x = Math.round((sw.since / h.tune.ledBoard.strip.switchMs) * A.W);
			const u = Math.max(1, Math.round(A.k));
			let bad = 0;
			let oldLit = 0;
			for (let y = 0; y < A.H; y++)
				for (let xx = x + u; xx < A.W; xx++) {
					const j = y * A.W + xx;
					if (A.a[j] !== A0.a[j]) bad += 1;
					if (A0.a[j] > 40) oldLit += 1;
				}
			steps.push({ since: sw.since, x, bad, oldLit, item: s.stripPick?.item });
		}
		h.scoreboardSkip();
		h.scoreboardStep(100, 40);
		// 2. the Total Win
		h.scoreboardCard('total', { x: 248.5 });
		const L = h.tune.ledBoard.rise;
		const from = L.backAtMs + L.riseMs - 120 + L.scanMs;
		const rows = [];
		for (let t = 0; t < 7000; t += 25) {
			s = h.scoreboardStep(25);
			if (!s.show || s.show.kind !== 'total') break;
			if (s.show.t < from || s.show.t >= s.show.exitAt) continue;
			const B = await alphaOf('back');
			const title = B.titles.filter((x) => x.kind === 'title').at(-1);
			const amt = B.titles.filter((x) => x.kind === 'amount').at(-1);
			const litIn = (b) => {
				if (!b) return 0;
				let n = 0;
				const q = B.k;
				for (let y = Math.max(0, Math.floor(b.y0 * q)); y < Math.min(B.H, Math.ceil(b.y1 * q)); y++) for (let x = Math.max(0, Math.floor(b.x0 * q)); x < Math.min(B.W, Math.ceil(b.x1 * q)); x++) if (B.a[y * B.W + x] > 40) n += 1;
				return n;
			};
			rows.push({ t: s.show.t, land: s.show.t - s.show.countEnd, press: s.show.pressLineAt !== null && s.show.t >= s.show.pressLineAt, title: litIn(title), amount: litIn(amt), str: amt?.str });
			if (s.show.phase === 'waits' && s.show.t - s.show.countEnd > 1500) break;
		}
		h.scoreboardCardEnd();
		h.scoreboardLower();
		h.scoreboardStep(100, 30);
		h.scoreboardManual(false);
		return { item0, lit0, steps, rows };
	});
	const sc = r.steps;
	check(r.item0 === 'cartoon' && r.lit0 > 50 && sc.length >= 3 && sc.every((x) => x.bad === 0) && sc.some((x) => x.oldLit > 50), `${tag}: M4 THE CLEAN SCAN: a small win scanning over the ${r.item0} (${r.lit0} lit dots): right of the line the face is the old picture alone on all ${sc.length} steps (dots differing: ${sc.map((x) => x.bad).join(', ')})`, sc);
	const tr = r.rows;
	const final = tr.filter((x) => x.land >= 1000).map((x) => x.amount);
	const full = final.length ? Math.max(...final) : 0;
	const dark = tr.filter((x) => x.title > 0 && x.amount < full * 0.5);
	const blink = tr.filter((x) => x.land >= 0 && x.land < 900);
	check(tr.length > 40 && full > 50 && blink.length > 10 && dark.length === 0, `${tag}: M4 THE TOTAL WIN'S AMOUNT: from power on to power down the amount (${tr.at(-1)?.str}) is lit whenever the title is (${tr.length} steps, ${blink.length} in the landing blink, ${tr.filter((x) => x.press).length} with the press line; title without its amount: ${dark.length})`, dark.slice(0, 6));
}

/** THE EXPLANATION ON THE BIG BOARD (2026-11-18, constants LED_BOARD.explain): for the Free Spins entry, the Super entry and a
 *  wrap-up with a line (a top-up), in layouts A and B, driven by hand past the READY beat: the sentence's text box lies inside
 *  the back board's face and touches nothing (A: not the head), every word is there, and the strip shows the press line alone
 *  (no sentence on it) */
async function explainBoards(p, S) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	await quietBoard(p);
	const line = 'Includes $12.30 added to bring this round up to its 10x minimum.';
	const want = await R(p, () => window.__reindeer.tune);
	void want;
	// (round 2, 2026-11-18: layout C, one page with B's look and the heavy face, compositions C1 and C2, the default C1)
	for (const layout of ['C1', 'C2', 'A', 'B']) {
		for (const [kind, opts, sentenceOf] of [
			['fs', {}, (c) => c.bonus],
			['sfs', {}, (c) => c.super],
			['total', { line }, () => line],
		]) {
			const r = await R(p, ([layout, kind, opts]) => {
				const h = window.__reindeer;
				h.tune.ledBoard.explain.layout = layout;
				h.scoreboardManual(true);
				h.scoreboardCard(kind, opts);
				const rows = [];
				for (let t = 0; t < 12000; t += 100) {
					const s = h.scoreboardStep(100);
					const back = h.scoreboardFace('back');
					const strip = h.scoreboardFace('strip');
					if (back.explain && back.explain.page === 'explain') rows.push({ t: s.show?.t, ex: back.explain, stripWait: strip.entryWait, item: s.stripPick?.item });
					if (rows.length > 3) break;
				}
				h.scoreboardCardEnd();
				h.scoreboardLower();
				h.scoreboardStep(100, 30);
				h.scoreboardManual(false);
				h.tune.ledBoard.explain.layout = 'C1';
				return rows;
			}, [layout, kind, opts]);
			const sentence = sentenceOf(INTRO);
			const e = r[r.length - 1]?.ex;
			const b = e?.box;
			const inside = !!b && b.x >= 0 && b.y >= 0 && b.x + b.w <= e.W && b.y + b.h <= e.H;
			const hd = e?.head;
			// (apart above or below it, or beside it: layout C2 sets the number to the left of the sentence)
			const apart = !hd || !b || b.y >= hd.y + hd.h || hd.y >= b.y + b.h || b.x >= hd.x + hd.w || hd.x >= b.x + b.w;
			const words = e ? e.lines.join(' ') : '';
			check(r.length > 0 && inside && apart && words === sentence.replace(/\s+/g, ' '), `${tag} ${kind} layout ${layout}: the explanation is on the big board, inside its face (${b ? `${b.x},${b.y} ${b.w}x${b.h} of ${e.W}x${e.H}` : 'none'}) and clear of the head, every word there, ${e?.lines.length ?? 0} line(s) at size ${e?.z ?? '-'}`, { e, sentence });
			check(r.length > 0 && r.every((x) => !x.stripWait && x.item === 'entry'), `${tag} ${kind} layout ${layout}: the strip shows the press line alone (no sentence on it)`, r.map((x) => x.stripWait));
		}
	}
}

/** THE PRESS SCREEN ON THE BOARD (2026-11-17, constants LED_SIGN.onBoard): a fresh page, the splash left to play out, then
 *  the board's own expanded state with the dim and the strip's line, the screens advancing, and the press lowering it */
async function pressBoard(browser, S) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: 1, isMobile: S.phone, hasTouch: S.phone });
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	try {
		await p.goto(`${APP}/?lang=en&sessionID=ledpress${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
		let s = null;
		for (let i = 0; i < 300; i++) {
			s = await R(p, () => window.__reindeer?.scoreboard?.() ?? null).catch(() => null);
			// (seated: the rise and its bounce are over, the game's own seatedAt)
			if (s?.press?.ready && s.show?.phase === 'hold' && s.show.t >= s.show.seatedAt) break;
			await sleep(400);
		}
		const want = await R(p, () => window.__reindeer.tune.ledBoard.dim.alpha);
		check(!!s?.press && s.show?.kind === 'press' && s.back.visible && Math.abs(s.back.offset) < 0.5 && Math.abs(s.dim.alpha - want) < 0.01 && s.stripPick?.item === 'entry', `${tag}: PRESS: the back board expanded (offset ${s?.back?.offset}), the scene dimmed (${s?.dim?.alpha}), the strip's top item the press line (${s?.stripPick?.item})`, s && { show: s.show, back: s.back, dim: s.dim, press: s.press });
		const seen = await R(p, () => {
			window.__reindeer.scoreboardManual(true);
			const out = [];
			for (let i = 0; i < 130; i++) {
				const x = window.__reindeer.scoreboardStep(100);
				if (out[out.length - 1] !== x.press?.screen) out.push(x.press?.screen);
			}
			window.__reindeer.scoreboardManual(false);
			return out;
		});
		check(new Set(seen).size === 3, `${tag}: PRESS: the explainer screens advance on the board (${seen.join(' > ')})`);
		// ONE PROMPT ON THE DEMO PATH (2026-11-18, Corey's capture at 2000x945: the tune panel's Free Spins entry raised over
		// the press screen showed the strip's line AND the press screen's HTML line): the press screen's line stays aside while
		// the strip says it, and comes back as the only prompt once the card is gone
		const promptText = () => R(p, () => [...document.querySelectorAll('body *')].filter((el) => {
			const r = el.getBoundingClientRect();
			const cs = getComputedStyle(el);
			return el.childElementCount === 0 && /continue|anywhere/i.test(el.textContent || '') && r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none';
		}).map((el) => `${el.tagName}.${el.className}`));
		for (const layout of ['C1', 'B', 'A']) {
			const st = await R(p, (layout) => {
				const h = window.__reindeer;
				h.tune.ledBoard.explain.layout = layout;
				h.scoreboardManual(true);
				h.scoreboardCard('fs');
				for (let i = 0; i < 60; i++) h.scoreboardStep(100);
				h.scoreboardManual(false);
				return { item: h.scoreboard().stripPick?.item };
			}, layout);
			await sleep(400);
			const during = await promptText();
			await R(p, () => {
				const h = window.__reindeer;
				h.scoreboardCardEnd();
				h.scoreboardLower();
				h.tune.ledBoard.explain.layout = 'C1';
			});
			// the press screen comes back once the card has gone (its rise and the line), still one prompt
			let back = null;
			for (let i = 0; i < 40 && !back?.up; i++) {
				await sleep(150);
				back = await R(p, () => window.__reindeer.scoreboard().press);
			}
			await sleep(300);
			const after = await promptText();
			check(st.item === 'entry' && during.length === 0 && !!back?.up && after.length === 0, `${tag}: PRESS: a Free Spins entry raised by hand over the press screen (layout ${layout}) shows one prompt, the strip's (DOM prompts with it: ${during.length}); once it is gone the press screen is back on the board, still one prompt (${after.length})`, { st, during, back, after });
		}
		await p.mouse.click(S.vp.width / 2, S.vp.height * 0.45);
		let g = null;
		for (let i = 0; i < 40; i++) {
			await sleep(100);
			g = await R(p, () => { const s = window.__reindeer.scoreboard(); return { vis: s.back.visible, dim: s.dim.alpha, press: s.press, landing: !!document.querySelector('.landing') }; });
			if (!g.vis && g.dim === 0 && !g.press && !g.landing) break;
		}
		check(!!g && !g.vis && g.dim === 0 && !g.press && !g.landing, `${tag}: PRESS: the press lowers the board and lifts the dim`, g);
		check(errs.length === 0, `${tag}: PRESS: no page errors`, errs);
	} finally {
		await ctx.close();
	}
}


/** THE FINER GRID (2026-11-19): the density rule per layout at the device's own pixel ratio, a clean switch on a rotation and
 *  on the tune panel, a one dot border the same LEDs all round, the cost; M4 and the currency check again at 1.5 */
const DENSITY_CASES = [
	{ name: 'density desktop@2', vp: { width: 1440, height: 900 }, dpr: 2, phone: false, want: 1.5, deep: true },
	{ name: 'density desktop@1', vp: { width: 1440, height: 900 }, dpr: 1, phone: false, want: 1 },
	{ name: 'density wide@1', vp: { width: 1920, height: 1080 }, dpr: 1, phone: false, want: 1.5 },
	{ name: 'density upright@3', vp: { width: 390, height: 844 }, dpr: 3, phone: true, want: 1.5, deep: true },
	{ name: 'density upright@2', vp: { width: 390, height: 844 }, dpr: 2, phone: true, want: 1 },
	{ name: 'density sideways@3', vp: { width: 844, height: 390 }, dpr: 3, phone: true, want: 1.5 },
	{ name: 'density sideways@2', vp: { width: 844, height: 390 }, dpr: 2, phone: true, want: 1.5, rotate: true },
].filter((s) => !ONLY.length || ONLY.includes(s.name.split(' ')[1].split('@')[0]) || ONLY.includes('density'));
/** the scoreboard's density now and its faces (both faces' k, their LEDs, one face root each) */
const densityNow = (p) =>
	R(p, () => {
		const h = window.__reindeer;
		const s = h.scoreboard();
		const st = h.scoreboardFace('strip');
		const bk = h.scoreboardFace('back');
		const D = h.tune.ledBoard.density;
		return { cls: s.cls, pitch: s.pitch, density: s.density, gpuBytes: s.gpuBytes, strip: st && { W: st.W, H: st.H, k: st.k, ledW: st.ledW, ledH: st.ledH }, back: bk && { W: bk.W, H: bk.H, k: bk.k, ledW: bk.ledW, ledH: bk.ledH }, rule: { k: D.k, min: D.minDevicePx, on: D.on }, res: window.__reindeer.renderRes?.cap ?? null };
	});
const densityOk = (d) => !!d?.density && d.strip.k === d.back.k && d.density.k === d.strip.k && d.density.faceRoots.strip === 1 && d.density.faceRoots.back === 1 && d.strip.ledW === Math.round(d.strip.W * d.strip.k) && d.back.ledH === Math.round(d.back.H * d.back.k);
async function densityChecks(browser) {
	const table = [];
	for (const S of DENSITY_CASES) {
		const tag = S.name + ` ${S.vp.width}x${S.vp.height}`;
		const { ctx, p, errs } = await boot(browser, S);
		try {
			const d = await densityNow(p);
			// the rule, worked out here: an LED of the finer grid at least minDevicePx device px (the renderer's resolution)
			const ratio = d.density.ratio;
			const want = d.rule.on && (d.pitch * ratio) / d.rule.k >= d.rule.min ? d.rule.k : 1;
			check(Math.abs(ratio - S.dpr) < 0.01, `${tag}: the rule reads the renderer's resolution (${ratio}, the device's ${S.dpr})`, d.density);
			check(d.density.k === S.want && d.density.k === want, `${tag}: ${d.density.k} LEDs per dot (want ${S.want}; the rule: pitch ${d.pitch} x ${ratio} / ${d.rule.k} = ${r1((d.pitch * ratio) / d.rule.k)} device px against ${d.rule.min})`, d.density);
			check(densityOk(d), `${tag}: both faces at ${d.density.k} (strip ${d.strip.k}, back ${d.back.k}), one face each (${d.density.faceRoots.strip}, ${d.density.faceRoots.back}): the strip ${d.strip.W} x ${d.strip.H} dots in ${d.strip.ledW} x ${d.strip.ledH} LEDs, the back board ${d.back.W} x ${d.back.H} in ${d.back.ledW} x ${d.back.ledH}`, d);
			check(d.gpuBytes <= 1.2 * 1048576, `${tag}: the scoreboard holds ${(d.gpuBytes / 1048576).toFixed(3)} MB of GPU textures (budget 1.2 MB)`);
			if (d.density.k > 1) check(d.density.devicePx >= d.rule.min, `${tag}: an LED is ${d.density.devicePx} device px (at least ${d.rule.min})`);
			// a ONE DOT chase border the same LEDs all round (the short Grandma line's gold chase), and the cost per layout
			const r = await R(p, async () => {
				const h = window.__reindeer;
				h.scoreboardManual(true);
				h.scoreboardStep(100, 30);
				h.scoreboardGag(true);
				h.scoreboardStep(33, 20);
				const f = h.scoreboardFace('strip', true);
				const img = new Image();
				img.src = f.png;
				await img.decode();
				const c = document.createElement('canvas');
				c.width = f.ledW;
				c.height = f.ledH;
				const g = c.getContext('2d');
				g.drawImage(img, 0, 0);
				const a = g.getImageData(0, 0, f.ledW, f.ledH).data;
				const W = f.ledW;
				const H = f.ledH;
				const lit = (x, y) => a[(y * W + x) * 4 + 3] > 0;
				const fullRow = (y) => { for (let x = 0; x < W; x++) if (!lit(x, y)) return false; return true; };
				const fullCol = (x) => { for (let y = 0; y < H; y++) if (!lit(x, y)) return false; return true; };
				let top = 0; while (top < H && fullRow(top)) top++;
				let bottom = 0; while (bottom < H && fullRow(H - 1 - bottom)) bottom++;
				let left = 0; while (left < W && fullCol(left)) left++;
				let right = 0; while (right < W && fullCol(W - 1 - right)) right++;
				h.scoreboardStep(100, 30);
				// the cost: the game's own draw ms per step on the Super entry's explanation page and the Total Win
				const med = (n) => { const v = []; for (let i = 0; i < n; i++) v.push(h.scoreboardStep(33).cost.drawMs); v.sort((x, y) => x - y); return { med: v[n >> 1], p90: v[Math.floor(n * 0.9)] }; };
				h.scoreboardCard('sfs', { spins: 10 });
				for (let i = 0; i < 400; i++) { const s = h.scoreboardStep(33); if (h.scoreboardFace('back')?.explain?.page === 'explain' && s.show.t > s.show.pressLineAt + 600) break; }
				const sfs = med(60);
				const sfsLit = h.scoreboardFace('back');
				h.scoreboardCardEnd(); h.scoreboardLower(); h.scoreboardStep(100, 30);
				h.scoreboardCard('total', { x: 248.5 });
				for (let i = 0; i < 600; i++) { const s = h.scoreboardStep(33); if (s.show && s.show.t > s.show.countEnd + 1400) break; }
				const total = med(60);
				const snap = h.scoreboard();
				h.scoreboardCardEnd(); h.scoreboardLower(); h.scoreboardStep(100, 30);
				h.scoreboardManual(false);
				return { u: Math.max(1, Math.round(f.k)), top, bottom, left, right, sfs, total, upload: snap.cost.uploadBytes, sfsLit: { lit: sfsLit.lit, dots: sfsLit.dots } };
			});
			check([r.top, r.bottom, r.left, r.right].every((v) => v === r.u), `${tag}: the one dot chase border is ${r.u} LED${r.u > 1 ? 's' : ''} all round (top ${r.top}, bottom ${r.bottom}, left ${r.left}, right ${r.right})`, r);
			check(r.sfsLit.lit > r.sfsLit.dots * 0.03, `${tag}: the Super entry's page is lit (${r.sfsLit.lit} of ${r.sfsLit.dots} LEDs)`);
			table.push({ case: S.name, k: d.density.k, devicePx: d.density.devicePx, strip: `${d.strip.W}x${d.strip.H} dots = ${d.strip.ledW}x${d.strip.ledH} LEDs`, back: `${d.back.W}x${d.back.H} dots = ${d.back.ledW}x${d.back.ledH} LEDs`, gpuMB: Math.round((d.gpuBytes / 1048576) * 1000) / 1000, uploadKB: Math.round(r.upload / 1024), sfsDrawMs: r.sfs, totalDrawMs: r.total });
			// THE TUNE PANEL: the density off and on again, both faces switch together on the next frame
			const tu = await R(p, async () => {
				const h = window.__reindeer;
				const read = () => { const s = h.scoreboard().density; return { k: s.k, strip: s.strip, back: s.back, roots: s.faceRoots }; };
				h.tune.ledBoard.density.on = false;
				await new Promise((r) => setTimeout(r, 300));
				const off = read();
				h.tune.ledBoard.density.on = true;
				await new Promise((r) => setTimeout(r, 300));
				return { off, on: read() };
			});
			check(tu.off.k === 1 && tu.off.strip === 1 && tu.off.back === 1 && tu.on.k === d.density.k && tu.on.strip === tu.on.k && tu.on.back === tu.on.k && tu.off.roots.strip === 1 && tu.on.roots.back === 1, `${tag}: the tune panel's switch: off gives today's grid on both faces, on gives ${d.density.k} again (one face each)`, tu);
			if (S.deep) {
				if (SEC('m4')) await m4Checks(p, { ...S, name: S.name });
				if (SEC('currency') && S.dpr === 2) await currencyChecks(p, { ...S, name: S.name });
			}
			// A ROTATION (sideways to upright at 2x and back): the density follows the layout, both faces at one density on every
			// frame of the change, one face each after it, the GPU bytes those faces'
			if (S.rotate) {
				const watch = async (vp) => {
					const seen = [];
					await p.setViewportSize(vp);
					for (let i = 0; i < 40; i++) {
						const x = await R(p, () => { const s = window.__reindeer.scoreboard(); return { cls: s.cls, k: s.density.k, strip: s.density.strip, back: s.density.back, roots: s.density.faceRoots, gpu: s.gpuBytes, leds: [s.density.stripLeds, s.density.backLeds] }; });
						seen.push(x);
						await sleep(50);
					}
					return seen;
				};
				const up = await watch({ width: 390, height: 844 });
				const last = up.at(-1);
				check(up.every((x) => x.strip === x.back && x.k === x.strip) && last.cls === 'portrait' && last.k === 1 && last.roots.strip === 1 && last.roots.back === 1, `${tag}: turned upright (390 x 844 at 2x): today's grid (k ${last.k}), both faces at one density on all ${up.length} frames of the change, one face each`, up.filter((x) => x.strip !== x.back).slice(0, 3).concat([last]));
				const back = await watch(S.vp);
				const end = back.at(-1);
				check(back.every((x) => x.strip === x.back && x.k === x.strip) && end.cls === 'phone' && end.k === 1.5 && end.roots.strip === 1 && end.roots.back === 1 && end.gpu === d.gpuBytes, `${tag}: turned back sideways: 1.5 again on both faces, one face each, the GPU bytes as at the start (${(end.gpu / 1048576).toFixed(3)} MB)`, end);
			}
			check(errs.length === 0, `${tag}: no page errors`, errs);
		} catch (e) {
			check(false, `${tag}: the density checks ran to their end`, String(e?.stack ?? e).slice(0, 600));
		} finally {
			await ctx.close();
		}
	}
	console.log('DENSITY', JSON.stringify(table, null, 1));
}

// ---- THE LED ANIMATION FIXES (section ledAnim, 2026-11-19): the plow's snow edge and the riders ---------------------------
const LEDANIM_CASES = [
	{ name: 'ledAnim desktop@2', vp: { width: 1440, height: 900 }, dpr: 2, phone: false },
	{ name: 'ledAnim desktop@1', vp: { width: 1440, height: 900 }, dpr: 1, phone: false },
	{ name: 'ledAnim wide@1', vp: { width: 1920, height: 1080 }, dpr: 1, phone: false },
	{ name: 'ledAnim upright@3', vp: { width: 390, height: 844 }, dpr: 3, phone: true },
	{ name: 'ledAnim upright@2', vp: { width: 390, height: 844 }, dpr: 2, phone: true },
	{ name: 'ledAnim sideways@3', vp: { width: 844, height: 390 }, dpr: 3, phone: true },
].filter((s) => !ONLY.length || ONLY.includes(s.name.split(' ')[1].split('@')[0]) || ONLY.includes('ledAnim'));
/** the LED sheets' rider pictures, from the generated specs: each with a vehicle box and room above it for the rider */
function riderSpecs() {
	const out = [];
	for (const [file, name] of [['scoreboardArtSpec.ts', 'SCOREBOARD_ART'], ['ledArtSpec.ts', 'LED_ART']]) {
		const src = readFileSync(join(SRC, 'game', file), 'utf8');
		const spec = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
		for (const pic of ['car', 'sleigh']) {
			const f = spec.frames[pic];
			out.push({ spec: name, pic, h: f?.h, vehicle: f?.vehicle ?? null, ok: !!f?.vehicle && f.vehicle.y + f.vehicle.h === f.h && f.vehicle.y >= 0.15 * f.vehicle.h && f.vehicle.w <= f.w });
		}
	}
	return out;
}
/** in the page: a face's picture as pixels, and the plow's and riders' reads of it */
const faceReads = () => {
	window.__ledAnimRead = async (which) => {
		const h = window.__reindeer;
		const f = h.scoreboardFace(which, true);
		const img = new Image();
		img.src = f.png;
		await img.decode();
		const c = document.createElement('canvas');
		c.width = f.ledW;
		c.height = f.ledH;
		const g = c.getContext('2d');
		g.drawImage(img, 0, 0);
		const d = g.getImageData(0, 0, f.ledW, f.ledH).data;
		const W = f.ledW;
		const H = f.ledH;
		const px = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
		const out = { W, H, k: f.k, plow: f.plow, riders: f.riders, read: null, riderLit: [] };
		if (f.plow) {
			const hex = f.plow.color;
			const sc = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
			// (the pile's color within a few steps: a face shimmer or switch can move it by one or two)
			const isSnow = (p) => p[3] > 200 && Math.abs(p[0] - sc[0]) <= 6 && Math.abs(p[1] - sc[1]) <= 6 && Math.abs(p[2] - sc[2]) <= 6;
			const isFlake = (p) => p[0] >= 250 && p[1] >= 250 && p[2] >= 250;
			// the pile's end: one past its rightmost LED anywhere on the face
			let snow = 0;
			for (let y = 0; y < H; y++) for (let x = W - 1; x >= snow; x--) if (isSnow(px(x, y))) { snow = x + 1; break; }
			let wheel = null;
			if (f.plow.van) {
				// the van's own LEDs (lit, not snow, not a flake or the spray): its body's lowest row at its middle, the rear tire
				// below it on the rear half (the van faces left), and the tire's last column
				const [vx, vy, vw, vh] = f.plow.van;
				const isVan = (x, y) => x >= 0 && x < W && y >= 0 && y < H && (() => { const p = px(x, y); return p[3] > 0 && !isSnow(p) && !isFlake(p); })();
				const mid = vx + Math.floor(vw / 2);
				let body = -1;
				for (let y = Math.min(H - 1, vy + vh - 1); y >= Math.max(0, vy); y--) if (isVan(mid, y)) { body = y; break; }
				let e = null;
				for (let y = body + 1; y < Math.min(H, vy + vh); y++) for (let x = Math.min(W - 1, vx + vw - 1); x >= mid; x--) if (isVan(x, y)) { e = Math.max(e ?? 0, x + 1); break; }
				wheel = { body, edge: e, mid };
			}
			out.read = { snow, wheel };
		}
		// each rider: the share of its part of the picture (above its vehicle, inside the face) that is lit
		for (const r of f.riders ?? []) {
			const [px0, py0, pw] = r.pic;
			const top = r.vehicle[1];
			let lit = 0;
			let n = 0;
			for (let y = Math.max(0, py0); y < Math.min(H, top); y++)
				for (let x = Math.max(0, px0); x < Math.min(W, px0 + pw); x++) {
					n++;
					if (px(x, y)[3] > 0) lit++;
				}
			out.riderLit.push({ name: r.name, pic: r.pic, vehicle: r.vehicle, share: n ? Math.round((lit / n) * 1000) / 1000 : null, inside: px0 >= 0 && px0 + pw <= W });
		}
		return out;
	};
};
async function ledAnimChecks(browser) {
	const specs = riderSpecs();
	check(specs.every((x) => x.ok), `ledAnim: the LED sheets' car and sleigh carry their rider (a vehicle box at the picture's bottom with at least 15% headroom: ${specs.map((x) => `${x.spec} ${x.pic} ${x.vehicle ? `${x.vehicle.h} of ${x.h}` : 'none'}`).join(', ')})`, specs);
	for (const S of LEDANIM_CASES) {
		const tag = S.name + ` ${S.vp.width}x${S.vp.height}`;
		const { ctx, p, errs } = await boot(browser, S);
		try {
			await R(p, faceReads);
			// THE PLOW: pinned, to the van's start, then every 10 ms step of its drive
			const plow = await R(p, async () => {
				const h = window.__reindeer;
				h.scoreboardManual(true);
				h.scoreboardStep(100, 30);
				h.tune.ledBoard.cartoon = 'plow';
				h.scoreboardStep(1);
				h.scoreboardStep(10, 379);
				const rows = [];
				for (let i = 0; i < 225; i++) {
					h.scoreboardStep(10);
					const r = await window.__ledAnimRead('strip');
					rows.push({ i, k: r.k, W: r.W, rec: r.plow, read: r.read });
				}
				return rows;
			});
			const withVan = plow.filter((r) => r.rec?.van);
			const onFace = withVan.filter((r) => r.read?.wheel?.edge != null && r.read.wheel.edge > 1 && r.read.wheel.edge < r.W - 1 && r.read.wheel.body >= 0);
			const bad = onFace.filter((r) => Math.abs(r.read.snow - r.read.wheel.edge) > 1 || r.read.snow > r.read.wheel.edge + 1 || Math.abs(r.rec.wheel - r.read.wheel.edge) > 1 || r.rec.edge !== Math.max(0, Math.min(r.W, r.rec.wheel)));
			const gaps = onFace.map((r) => r.read.snow - r.read.wheel.edge);
			check(withVan.length >= 200 && onFace.length >= Math.round(withVan.length * 0.5) && bad.length === 0, `${tag}: THE PLOW: on all ${onFace.length} steps with the van's rear wheel on the strip (of ${withVan.length}) the snow ends at the rear tire's trailing edge read from the face within one LED (snow minus tire: ${Math.min(...gaps)} to ${Math.max(...gaps)} LEDs), never behind it, the game's record agreeing`, bad.slice(0, 4));
			const past = withVan.filter((r) => r.rec.wheel !== null && r.rec.wheel <= 0);
			check(past.every((r) => r.read.snow === 0), `${tag}: THE PLOW: once the van's rear wheel has left the strip no snow is left (${past.length} steps)`, past.filter((r) => r.read.snow !== 0).slice(0, 3));
			// THE RIDERS: the strip's cartoons and the gag, the Super entry's sweep, the Total Win's band, the Mega jam
			let riders = await R(p, async () => {
				const h = window.__reindeer;
				const rd = window.__ledAnimRead;
				const out = [];
				const pin = (key) => { h.tune.ledBoard.cartoon = key; h.scoreboardStep(1); };
				// (2026-11-19, LED_BOARD.ideas: the new takeoff cartoon carries Santa in his sleigh too; the Super entry's sweep and
				// the Total Win's band are today's scenes, read only when those switches say 'today')
				const I = h.tune.ledBoard.ideas;
				for (const [key, times] of [['parade', [1600, 2600, 3600]], ['peek', [500, 1300, 2400]], ['sleigh', [1200, 2300, 3400]], ['takeoff', [500, 1100, 1700]]]) {
					pin(key);
					let t = 0;
					for (const at of times) {
						h.scoreboardStep(10, Math.round((at - t) / 10));
						t = at;
						out.push({ where: `${key} ${at}`, face: 'strip', ...(await rd('strip')) });
					}
				}
				h.tune.ledBoard.cartoon = 'auto';
				const G = h.tune.ledBoard.gag;
				h.scoreboardGag(false);
				h.scoreboardStep(10, Math.round((G.firstMs + G.bumpMs * 0.3) / 10));
				out.push({ where: 'gag bump', face: 'strip', ...(await rd('strip')) });
				h.scoreboardStep(100, 60);
				let s = h.scoreboardStep(0);
				if (I.sfsEntry === 'today') {
					h.scoreboardCard('sfs', { spins: 10 });
					s = h.scoreboardStep(0);
					for (let i = 0; i < 400 && s.show.sceneT < 1050; i++) s = h.scoreboardStep(10);
					out.push({ where: 'super sweep', face: 'back', ...(await rd('back')) });
					h.scoreboardCardEnd(); h.scoreboardLower(); h.scoreboardStep(100, 30);
				}
				if (I.total === 'today') {
					h.scoreboardCard('total', { x: 248.5 });
					for (let i = 0; i < 600; i++) { s = h.scoreboardStep(33); if (s.show && s.show.t > s.show.countEnd + 1400) break; }
					out.push({ where: 'total band', face: 'back', ...(await rd('back')) });
					h.scoreboardCardEnd(); h.scoreboardLower(); h.scoreboardStep(100, 40);
				}
				h.scoreboardWin(100);
				for (let i = 0; i < 600; i++) { s = h.scoreboardStep(33); if (s.show && s.show.t > s.show.countEnd + 300) break; }
				for (let i = 0; i < 4; i++) {
					out.push({ where: `mega jam ${i}`, face: 'back', ...(await rd('back')) });
					h.scoreboardStep(10, 150);
				}
				h.scoreboardSkip?.();
				h.scoreboardStep(100, 60);
				h.scoreboardManual(false);
				return { I: { sfsEntry: I.sfsEntry, total: I.total }, rows: out.map((o) => ({ where: o.where, face: o.face, H: o.H, riderLit: o.riderLit })) };
			});
			const ideasNow = riders.I;
			riders = riders.rows;
			const seen = riders.flatMap((o) => o.riderLit.filter((r) => r.inside && r.share !== null).map((r) => ({ where: o.where, face: o.face, ...r })));
			const where = (w) => seen.some((r) => r.where.startsWith(w));
			// (the Mega jam's Grandma car is its fourth vehicle and only enters after about 5 s of the jam, often after the show:
			// counted when it is in, not required)
			const wantR = ['parade', 'peek', 'sleigh', 'takeoff', 'gag', ...(ideasNow.sfsEntry === 'today' ? ['super'] : []), ...(ideasNow.total === 'today' ? ['total'] : [])];
			check(wantR.every(where), `${tag}: THE RIDERS: a vehicle with its rider drawn in ${wantR.join(', ')} (${[...new Set(seen.map((r) => r.where.split(' ')[0]))].join(', ')})`, riders.map((o) => ({ where: o.where, n: o.riderLit.length })));
			// (an empty vehicle lights none of it; a seated rider about 0.22 of it, the rest is room beside her or him)
			const dark = seen.filter((r) => r.share < 0.12);
			check(seen.length > 0 && dark.length === 0, `${tag}: THE RIDERS: each rider's part of its picture is lit over at least 12% (least ${Math.min(...seen.map((r) => r.share))} over ${seen.length} riders)`, dark.slice(0, 4));
			const clipped = seen.filter((r) => r.face === 'strip' && r.pic[1] < 0);
			check(clipped.length === 0, `${tag}: THE RIDERS: on the strip every rider's head is inside the face (the picture's top row at 0 or below)`, clipped.slice(0, 4));
			check(errs.length === 0, `${tag}: no page errors`, errs);
		} catch (e) {
			check(false, `${tag}: the ledAnim checks ran to their end`, String(e?.stack ?? e).slice(0, 600));
		} finally {
			await ctx.close();
		}
	}
}

// ---- THE ROUND 1 LED IDEAS (section ledIdeas, 2026-11-19, wip/ledideas; constants LED_BOARD.ideas) -------------------------
// Corey's picks of led_anim_ideas_r1_2026-11-19 built in the game, at the device's own pixel ratio on both grids (1.5 and the
// 1x fallback) and every layout class, driven by hand:
//   - THE SUPER ENTRY'S PRESENTS ARE RED ("on super free spins the presents next tot he 10 Super free spins should also be
//     red"): every present the Super entry's scene and its explanation page draw is the red present, on every 25 ms step
//     from the rise to well into the wait (the game's records), and inside each of the page's present boxes the face's own
//     LEDs are red, no teal present LED; the Free Spins entry's page keeps the teal one
//   - THE TEASE NEVER SHOWS THE WHEEL'S RESULT: the tease's code reads nothing of the round (only the show's clock and its
//     spin count; no book, state or wheel import), and its reel shows the same characters at the same scene time on every run
//   - THE STACK IS KNOCKED DOWN BY CONTACT ("if it did with the knock down, it would look good"): on every 10 ms step no
//     present moves before the reindeer's lit box meets the stack's left edge (within one LED); the first step any present
//     moves his front is at the stack; the moving presents go his way (right); none is left on the strip by the clear
//   - THE LADDER'S MARKS ARE THE GAME'S TIERS: the rungs are LED_BOARD.tiers' bars with the top one config.maxWin (7,777),
//     labeled as the game writes a multiple; which rungs are lit at the landing for 1x, 125x, 6,250x and the cap
//   - THE COUNT BY SIZE AND THE CAP'S HOLD (Corey: "yes on the total count wins and 1.5 second hold on max win"): each
//     size's count length (LED_BOARD.ideas.totalBySize, a turbo rate dividing it), the house pacer's first rung at its
//     segment's end, the cap's page capPageHold after the landing (none when Autoplay Bonuses continues it, none on an
//     uncapped round); a press during the count still lands it at once
//   - THE ROTATION: the strip's cartoons in LED_BOARD.ideas.cartoons' order, each new one drawing lit LEDs
//   - THE PRESS SCREEN'S LIGHT STRING (desktop@2, the press screen at boot): bulbs drawn over the screens, the tug at a change,
//     the screens still advance
//   - the cost: the ladder's and the entries' draw step (median, p90) and the GPU bytes the same as today's scenes
const IDEAS_CASES = [
	{ name: 'ledIdeas desktop@2', vp: { width: 1440, height: 900 }, dpr: 2, phone: false, press: true },
	{ name: 'ledIdeas desktop@1', vp: { width: 1440, height: 900 }, dpr: 1, phone: false },
	{ name: 'ledIdeas upright@3', vp: { width: 390, height: 844 }, dpr: 3, phone: true },
	{ name: 'ledIdeas upright@2', vp: { width: 390, height: 844 }, dpr: 2, phone: true },
	{ name: 'ledIdeas sideways@3', vp: { width: 844, height: 390 }, dpr: 3, phone: true },
].filter((s) => !ONLY.length || ONLY.includes(s.name.split(' ')[1].split('@')[0]) || ONLY.includes('ledIdeas'));
async function ideasChecks(browser) {
	// THE TEASE READS NOTHING OF THE ROUND (read from its source)
	{
		const src = readFileSync(join(SRC, 'game', 'scoreboard', 'entryScenes.ts'), 'utf8');
		const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
		const body = src.slice(src.indexOf('export function teaseEntry'));
		const reads = [...new Set([...body.matchAll(/\bs\.(\w+)/g)].map((m) => m[1]))];
		const okImp = imports.every((m) => !/book|stateGame|wheel|road|fixtures|state-shared/i.test(m));
		check(okImp && reads.every((r) => ['t', 'sceneAt', 'spins'].includes(r)) && /const REEL: ArtName\[\] = \['reindeer_col', 'santa_col', 'grandma_col'\]/.test(src), `ledIdeas: the Super tease reads nothing of the round (imports ${imports.join(', ')}; it reads the show's ${reads.join(', ')}; its reel a fixed order)`, { imports, reads });
	}
	for (const S of IDEAS_CASES) {
		const tag = S.name + ` ${S.vp.width}x${S.vp.height}`;
		const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.dpr, isMobile: S.phone, hasTouch: S.phone });
		const p = await ctx.newPage();
		const errs = [];
		p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
		try {
			await p.goto(`${APP}/?lang=en&sessionID=ledideas${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
			// THE PRESS SCREEN'S LIGHT STRING (before the first press)
			if (S.press) {
				let s = null;
				for (let i = 0; i < 300; i++) {
					s = await R(p, () => window.__reindeer?.scoreboard?.() ?? null).catch(() => null);
					if (s?.press?.ready && s.show?.phase === 'hold' && s.show.t >= s.show.seatedAt) break;
					await sleep(400);
				}
				const pl = await R(p, () => {
					const h = window.__reindeer;
					h.scoreboardManual(true);
					const out = [];
					for (let i = 0; i < 120; i++) {
						const x = h.scoreboardStep(100);
						const f = h.scoreboardFace('back');
						out.push({ screen: x.press?.screen, lights: f?.ideas?.pressLights ?? null });
					}
					h.scoreboardManual(false);
					return out;
				});
				const want = await R(p, () => window.__reindeer.tune.ledBoard.ideas.pressLights);
				check(!want || (pl.every((r) => r.lights && r.lights.bulbs > 10) && pl.some((r) => r.lights.tug !== null) && new Set(pl.map((r) => r.screen)).size === 3), `${tag}: PRESS LIGHTS: the light string over the press screen on all ${pl.length} steps (${pl[0]?.lights?.bulbs} bulbs), the tug at a change (${pl.filter((r) => r.lights?.tug !== null).length} steps), the three screens still advance`, pl.filter((r, i) => i % 15 === 0));
			}
			for (let i = 0; i < 200; i++) {
				const ok = await R(p, () => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && !document.querySelector('.landing') && window.__reindeer.scoreboard?.())).catch(() => false);
				if (ok) break;
				if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height * 0.45).catch(() => {});
				await sleep(600);
			}
			await sleep(600);
			await R(p, faceReads);
			// in the page: a face's present boxes read for red and teal LEDs
			await R(p, () => {
				window.__presentInks = async (which, boxes) => {
					const f = window.__reindeer.scoreboardFace(which, true);
					const img = new Image();
					img.src = f.png;
					await img.decode();
					const c = document.createElement('canvas');
					c.width = f.ledW;
					c.height = f.ledH;
					const g = c.getContext('2d');
					g.drawImage(img, 0, 0);
					const d = g.getImageData(0, 0, f.ledW, f.ledH).data;
					return boxes.map((b) => {
						let red = 0;
						let teal = 0;
						let n = 0;
						for (let y = Math.max(0, Math.floor(b.y * f.k)); y < Math.min(f.ledH, Math.ceil((b.y + b.h) * f.k)); y++)
							for (let x = Math.max(0, Math.floor(b.x * f.k)); x < Math.min(f.ledW, Math.ceil((b.x + b.w) * f.k)); x++) {
								const i = (y * f.ledW + x) * 4;
								if (d[i + 3] < 120) continue;
								n++;
								const [r, gg, bb] = [d[i], d[i + 1], d[i + 2]];
								if (r > 150 && gg < 110 && bb < 110) red++;
								if (gg > 140 && bb > 140 && r < 110) teal++;
							}
						return { red, teal, n };
					});
				};
			});
			// THE ENTRIES' PRESENTS
			for (const kind of ['sfs', 'fs']) {
				const r = await R(p, async (kind) => {
					const h = window.__reindeer;
					h.scoreboardManual(true);
					h.scoreboardStep(100, 20);
					h.scoreboardCard(kind, { spins: 10 });
					const names = new Set();
					const page = new Set();
					let inks = null;
					let reel1300 = null;
					let steps = 0;
					for (let i = 0; i < 260; i++) {
						const s = h.scoreboardStep(25);
						const f = h.scoreboardFace('back');
						steps++;
						for (const n of f?.ideas?.entry?.presents ?? []) names.add(n);
						for (const q of f?.explain?.presents ?? []) page.add(q.name);
						if (s.show && s.show.sceneT >= 1300 && reel1300 === null && f?.ideas?.entry) reel1300 = f.ideas.entry.reel ?? [];
						if (!inks && f?.explain?.page === 'explain' && f.explain.presents.length) inks = { boxes: f.explain.presents, read: await window.__presentInks('back', f.explain.presents) };
					}
					h.scoreboardCardEnd();
					h.scoreboardLower();
					h.scoreboardStep(100, 30);
					return { names: [...names], page: [...page], inks, reel1300, steps };
				}, kind);
				if (kind === 'sfs') {
					const allRed = r.names.length > 0 && r.names.every((n) => n === 'present_red') && r.page.length > 0 && r.page.every((n) => n === 'present_red');
					const px = r.inks?.read ?? [];
					check(allRed && px.length >= 2 && px.every((x) => x.teal === 0 && x.red > x.n * 0.25), `${tag}: SUPER: every present on the entry (${r.names.join(', ')}) and on its page (${r.page.join(', ')}) is the red present; the page's ${px.length} present boxes are red on the face (${px.map((x) => `${x.red} red, ${x.teal} teal of ${x.n}`).join('; ')})`, r);
					// the same reel at the same scene time on a second run
					const again = await R(p, () => {
						const h = window.__reindeer;
						h.scoreboardCard('sfs', { spins: 10 });
						let reel = null;
						for (let i = 0; i < 200 && reel === null; i++) {
							const s = h.scoreboardStep(25);
							const f = h.scoreboardFace('back');
							if (s.show && s.show.sceneT >= 1300 && f?.ideas?.entry) reel = f.ideas.entry.reel ?? [];
						}
						h.scoreboardCardEnd();
						h.scoreboardLower();
						h.scoreboardStep(100, 30);
						return reel;
					});
					check(JSON.stringify(again) === JSON.stringify(r.reel1300) && (r.reel1300?.length ?? 0) > 0, `${tag}: SUPER: the tease's reel shows the same characters at the same scene time on two runs (${r.reel1300?.join(', ')}): a fixed loop, not the round's`, { a: r.reel1300, b: again });
				} else {
					const px = r.inks?.read ?? [];
					check(r.names.length > 0 && r.names.every((n) => n === 'present') && r.page.every((n) => n === 'present') && px.every((x) => x.teal > 0), `${tag}: FREE SPINS: the entry's presents (${r.names.join(', ')}) and its page's (${r.page.join(', ')}) are the teal present`, r);
				}
			}
			// THE STACK: contact before any present moves
			const st = await R(p, () => {
				const h = window.__reindeer;
				h.tune.ledBoard.cartoon = 'trot';
				h.scoreboardStep(1);
				h.tune.ledBoard.cartoon = 'stack';
				h.scoreboardStep(1);
				const rows = [];
				let t = 0;
				for (let i = 0; i < 560; i++) {
					h.scoreboardStep(10);
					t += 10;
					const f = h.scoreboardFace('strip');
					const c = h.scoreboard().cartoon;
					if (c.key !== 'stack') break;
					rows.push({ t: c.t, st: f?.ideas?.stack ?? null });
				}
				h.tune.ledBoard.cartoon = 'auto';
				h.scoreboardStep(1);
				return rows;
			});
			{
				const rec = st.filter((r) => r.st);
				const first = rec.find((r) => r.st.moved);
				const before = rec.filter((r) => !r.st.moved && r.st.deer);
				const overlapEarly = before.filter((r) => r.st.deer[0] + r.st.deer[2] > r.st.stack[0] + 1);
				const meet = first?.st.deer ? first.st.deer[0] + first.st.deer[2] - first.st.stack[0] : null;
				check(!!first && overlapEarly.length === 0 && meet !== null && meet >= -1 && before.length > 20, `${tag}: STACK: no present moves while the reindeer runs in (${before.length} steps, his front never past the stack's edge); the first step one moves (${first?.t} ms) his lit front is at the stack (${meet} LEDs past its left edge)`, { first, overlapEarly: overlapEarly.slice(0, 3) });
				// the presents go his way, and are gone by the clear
				const after = rec.filter((r) => r.st.moved);
				const lefts = after.map((r) => Math.min(...r.st.presents.map((b) => b[0]), Infinity));
				let back = 0;
				for (let i = 1; i < lefts.length; i++) if (Number.isFinite(lefts[i]) && Number.isFinite(lefts[i - 1]) && lefts[i] < lefts[i - 1] - 1) back++;
				const late = rec.filter((r) => r.t >= 4300 && r.st.presents.length > 0);
				check(after.length > 10 && back === 0 && late.length === 0, `${tag}: STACK: the knocked presents move his way (no step back to the left over ${after.length} steps) and none is left on the strip from 4.3 s`, { back, late: late.slice(0, 3) });
			}
			// THE LADDER, THE COUNT BY SIZE, THE CAP'S HOLD
			const L = await R(p, async () => {
				const h = window.__reindeer;
				const cfg = (await import('/src/game/config.ts')).default;
				const B = h.tune.ledBoard;
				const out = { tiers: B.tiers.map((t) => t.bar), maxWin: cfg.maxWin, I: JSON.parse(JSON.stringify(B.ideas)), pace: { ...B.pace }, after: B.scenes.totalPressAfterMs, flat: B.scenes.totalCountMs, rows: [] };
				const CAP = `${(7777).toLocaleString('en-US')}x the play amount, the most a round can award.`;
				for (const [key, o] of [
					['small', { x: 1, play: 1 }],
					['big', { x: 125, play: 2 }],
					['huge', { x: 6250, play: 2 }],
					['max', { x: 7777, play: 1000, title: 'MAX WIN', line: CAP, capped: true }],
					['max turbo', { x: 7777, play: 1000, title: 'MAX WIN', line: CAP, capped: true, rate: 2 }],
					['max autoplay', { x: 7777, play: 1000, title: 'MAX WIN', line: CAP, capped: true, auto: true }],
					['top-up line', { x: 20, play: 1, line: 'Includes $1.00 added to bring this round up to its 20x minimum.' }],
				]) {
					h.scoreboardCard('total', o);
					let s = h.scoreboardStep(0);
					const sh = s.show;
					const seg = Math.min((sh.countEnd - sh.countStart) * B.pace.barShare, B.pace.barMaxMs);
					let atFirst = null;
					let land = null;
					for (let i = 0; i < 900; i++) {
						s = h.scoreboardStep(10);
						if (!s.show) break;
						if (atFirst === null && s.show.t >= sh.countStart + seg) atFirst = s.show.amount;
						if (s.show.t >= s.show.countEnd + 300 && !land) land = h.scoreboardFace('back')?.ideas?.ladder ?? null;
						if (s.show.t > s.show.countEnd + 2000) break;
					}
					out.rows.push({ key, o, countMs: sh.countEnd - sh.countStart, pressAfter: sh.pressLineAt - sh.countEnd, atFirst, finalStr: sh.finalStr, land });
					h.scoreboardCardEnd();
					h.scoreboardLower();
					h.scoreboardStep(100, 30);
				}
				// a press during a long count lands it at once
				h.scoreboardCard('total', { x: 7777, play: 1000, title: 'MAX WIN', capped: true });
				h.scoreboardStep(10, 150);
				const l1 = h.scoreboardCardPress();
				const after = h.scoreboardStep(10).show;
				out.press = { l1, amount: after.amount, finalStr: after.finalStr, phase: after.phase };
				h.scoreboardCardEnd();
				h.scoreboardLower();
				h.scoreboardStep(100, 30);
				return out;
			});
			{
				const want = [...L.tiers.slice(0, -1), L.maxWin];
				const mx = L.rows.find((r) => r.key === 'max');
				const rungs = mx?.land?.rungs ?? [];
				check(L.maxWin === 7777 && L.tiers.at(-1) === L.maxWin && rungs.map((r) => r.bar).join() === want.join() && rungs.every((r) => r.label === `${r.bar.toLocaleString('en-US')}X`), `${tag}: LADDER: the rungs are the game's tiers ${rungs.map((r) => r.label).join(', ')} (LED_BOARD.tiers ${L.tiers.join(', ')}, the top config.maxWin ${L.maxWin})`, rungs);
				const litOf = (k) => (L.rows.find((r) => r.key === k)?.land?.rungs ?? []).map((r) => (r.lit ? 1 : 0)).join('');
				check(litOf('small') === '00000' && litOf('big') === '11100' && litOf('huge') === '11110' && litOf('max') === '11111', `${tag}: LADDER: lit at the landing: 1x ${litOf('small')}, 125x ${litOf('big')}, 6,250x ${litOf('huge')}, the cap ${litOf('max')}`, L.rows.map((r) => ({ k: r.key, size: r.land?.size })));
				const ms = L.I.totalBySize.on ? L.I.totalBySize.ms : { small: L.flat, big: L.flat, huge: L.flat, max: L.flat };
				const len = (k) => L.rows.find((r) => r.key === k)?.countMs;
				const okLen = Math.abs(len('small') - ms.small) <= 1 && Math.abs(len('big') - ms.big) <= 1 && Math.abs(len('huge') - ms.huge) <= 1 && Math.abs(len('max') - ms.max) <= 1 && Math.abs(len('max turbo') - ms.max / 2) <= 1 && Math.abs(len('top-up line') - ms.big) <= 1;
				check(okLen, `${tag}: COUNT BY SIZE (${L.I.totalBySize.on ? 'on' : 'off'}): small ${len('small')}, big ${len('big')}, huge ${len('huge')}, max ${len('max')} ms, max at a turbo rate of 2 ${len('max turbo')} ms`, L.rows.map((r) => ({ k: r.key, ms: r.countMs })));
				const pa = (k) => L.rows.find((r) => r.key === k)?.pressAfter;
				const hold = L.I.capPageHold.on ? L.I.capPageHold.ms : 0;
				check(pa('max') === hold && pa('max autoplay') === 0 && pa('top-up line') === 0 && pa('big') === L.after, `${tag}: THE CAP'S HOLD (${L.I.capPageHold.on ? 'on' : 'off'}): the cap's page ${pa('max')} ms after the landing (${hold}), with Autoplay Bonuses continuing it ${pa('max autoplay')}, a top-up's line ${pa('top-up line')}, a plain Total Win's press line ${pa('big')}`, L.rows.map((r) => ({ k: r.key, after: r.pressAfter })));
				const big = L.rows.find((r) => r.key === 'big');
				const first = big ? `$${(15 * 2).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : null;
				check(L.I.total !== 'ladder' || big?.atFirst === first, `${tag}: THE PACER: 125x at $2 reads ${big?.atFirst} as its first rung's segment ends (want ${first}: 15x)`, big);
				check(L.press.l1 && L.press.amount === L.press.finalStr && L.press.phase !== 'count', `${tag}: a press 1.5 s into the cap's 5 s count lands it at once (${L.press.amount})`, L.press);
			}
			// THE ROTATION
			const rot = await R(p, () => {
				const h = window.__reindeer;
				const want = [...h.tune.ledBoard.ideas.cartoons];
				const out = [];
				for (const key of ['tree', 'chew', 'takeoff', 'signroll', 'stack']) {
					h.tune.ledBoard.cartoon = key;
					h.scoreboardStep(1);
					h.scoreboardStep(10, 200);
					const f = h.scoreboardFace('strip');
					out.push({ key, now: h.scoreboard().cartoon.key, lit: f.lit, dots: f.dots });
				}
				h.tune.ledBoard.cartoon = 'auto';
				h.scoreboardStep(1);
				h.scoreboardManual(false);
				return { want, out };
			});
			check(rot.want.join() === 'trot,tree,parade,chew,plow,takeoff,sleigh,signroll,peek,stack,race' && rot.out.every((x) => x.now === x.key && x.lit > x.dots * 0.01), `${tag}: ROTATION: ${rot.want.join(' > ')}; each new cartoon draws (${rot.out.map((x) => `${x.key} ${x.lit}`).join(', ')} lit LEDs)`, rot);
			// THE COST: draw step and GPU bytes, the picks against today's scenes
			const cost = await R(p, () => {
				const h = window.__reindeer;
				h.scoreboardManual(true);
				const I = h.tune.ledBoard.ideas;
				const run = (start, n) => {
					start();
					const v = [];
					for (let i = 0; i < n; i++) v.push(h.scoreboardStep(33).cost.drawMs);
					const gpu = h.scoreboard().gpuBytes;
					h.scoreboardCardEnd();
					h.scoreboardLower();
					h.scoreboardStep(100, 30);
					v.sort((a, b) => a - b);
					return { med: v[n >> 1], p90: v[Math.floor(n * 0.9)], max: v[n - 1], gpu };
				};
				const max = () => h.scoreboardCard('total', { x: 7777, play: 1000, title: 'MAX WIN', capped: true });
				const o = { ladder: run(max, 200), tease: run(() => h.scoreboardCard('sfs'), 110), presents: run(() => h.scoreboardCard('fs'), 110) };
				const keep = { ...I };
				I.total = 'today';
				I.sfsEntry = 'today';
				I.fsEntry = 'today';
				o.todayTotal = run(max, 200);
				o.todaySfs = run(() => h.scoreboardCard('sfs'), 110);
				Object.assign(I, keep);
				h.scoreboardManual(false);
				return o;
			});
			console.log(`  ${tag} cost (drawMs median / p90 / max): ladder ${cost.ladder.med} / ${cost.ladder.p90} / ${cost.ladder.max} (today's Total Win ${cost.todayTotal.med} / ${cost.todayTotal.p90}), tease ${cost.tease.med} / ${cost.tease.p90} (today's ${cost.todaySfs.med} / ${cost.todaySfs.p90}), presents ${cost.presents.med} / ${cost.presents.p90}; GPU ${cost.ladder.gpu} B (today's ${cost.todayTotal.gpu})`);
			check(cost.ladder.gpu === cost.todayTotal.gpu && cost.ladder.gpu < 1.2 * 1048576 && cost.ladder.med <= Math.max(2, cost.todayTotal.med * 2) && cost.tease.med <= Math.max(2, cost.todaySfs.med * 2), `${tag}: COST: the picks draw on the same faces (GPU ${(cost.ladder.gpu / 1048576).toFixed(3)} MB, today's ${(cost.todayTotal.gpu / 1048576).toFixed(3)}), the ladder's step ${cost.ladder.med} ms median (today's ${cost.todayTotal.med}), the tease's ${cost.tease.med} (today's ${cost.todaySfs.med})`, cost);
			check(errs.length === 0, `${tag}: no page errors`, errs);
		} catch (e) {
			check(false, `${tag}: the ledIdeas checks ran to their end`, String(e?.stack ?? e).slice(0, 600));
		} finally {
			await ctx.close();
		}
	}
}

(async () => {
	const browser = await chromium.launch({ args: ['--mute-audio'] });
	const memory = {};
	try {
		for (const S of SIZES) {
			if (SEC('press')) await pressBoard(browser, S).catch((e) => check(false, `${S.name}: PRESS ran to its end`, String(e).slice(0, 300)));
			const { ctx, p, errs } = await boot(browser, S);
			try {
				await sizeChecks(p, S, memory);
				if (S.scenes && SEC('scenes')) await scenes(p, S);
				if (SEC('titles')) await titles(p, S);
				if (SEC('dim') && ['desktop', 'side', 'portrait'].includes(S.name)) await dimCheck(p, S);
				if (SEC('raceCard')) await raceCards(p, S);
				if (SEC('cards') && ['side', 'portrait'].includes(S.name)) await cards(p, S, false);
				if (S.flows && SEC('cards')) await cards(p, S, true);
				// 2026-11-17: the strip's priority order and the short line by hand (desktop, upright), the scatter count in real
				// rounds (desktop, upright), the short line by play mode (desktop)
				if (SEC('strip') && ['desktop', 'portrait'].includes(S.name)) await stripOrder(p, S);
				if (SEC('scatter') && ['desktop', 'portrait'].includes(S.name)) await scatterRounds(p, S);
				if (SEC('gagModes') && S.flows) await gagModes(p, S);
				if (SEC('bonusStrip') && ['desktop', 'portrait'].includes(S.name)) await bonusStrip(p, S);
				if (SEC('explain')) await explainBoards(p, S);
				if (SEC('m4') && ['desktop', 'portrait'].includes(S.name)) await m4Checks(p, S);
				if (SEC('currency') && ['desktop', 'side', 'portrait'].includes(S.name)) await currencyChecks(p, S);
				if (S.flows) await flows(p, S, errs);
				else check(errs.length === 0, `${S.name}: no page errors`, errs);
			} catch (e) {
				check(false, `${S.name}: the probe ran to its end`, String(e?.stack ?? e).slice(0, 600));
			} finally {
				await ctx.close();
			}
		}
		if (SEC('density')) await densityChecks(browser);
		if (SEC('ledAnim')) await ledAnimChecks(browser);
		if (SEC('ledIdeas')) await ideasChecks(browser);
	} finally {
		await browser.close();
	}
	console.log('MEMORY', JSON.stringify(memory));
	console.log(`\nled_board_probe: ${pass} pass, ${fail} fail`);
	if (fails.length) console.log('FAILS:\n  ' + fails.join('\n  '));
	process.exit(fail ? 1 : 0);
})();
