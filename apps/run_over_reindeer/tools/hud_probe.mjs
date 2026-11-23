// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,ui/hud/hudLayout.ts,ui/Chrome.svelte,ui/RoundCard.svelte,game/bookEventHandlerMap.ts};
// WATCHES: ; hudHeld, .hud-held, button.catch, data-round-card, data-skip, __reindeer.scoreboard
// WATCHES: apps/run_over_reindeer/src/{ui/hud/HudReadout.svelte,ui/hud/winOdometer.ts,ui/controls.svelte.ts,game/scoreboard/scoreboard.ts};
// WATCHES: ; __reindeer.hud.winOdometer, data-odo, .od, .oc, .odo-pop, winOdoText, totalCount
// WATCHES: ; __reindeer.skipHud, data-skip, __reindeer.atRest, __reindeer.boardLayout, __reindeer.fixtures, __reindeer.gameType, __reindeer.hud, __reindeer.scene
// WATCHES: ; data-title-sign, data-hud, data-hud-step, data-st, .hudp, .landing, .fb, .lb, .am-ui, .lbw, .value, .mp, .is-open, .mpsh, .layer
// WATCHES: ; .modals, .panel, .sweep, .go, .spin, .cg, .rr, .rw, .rs, .fx, .halo, data-face, data-run
// WATCHES: apps/run_over_reindeer/src/{ui/hud/HudSpin.svelte,ui/hud/spinRing.ts,ui/hud/ringPlan.ts};
// WATCHES: ; __reindeer.ringMethod, __reindeer.ringRounds, __reindeer.ringNow, __reindeer.spinSerial
// WATCHES: apps/run_over_reindeer/src/{game/currency.ts,fixtures/fixtureRgs.ts};
// WATCHES: apps/run_over_reindeer/src/{ui/sign/SignHud.svelte,ui/sign/signLayout.ts,ui/sign/signZones.ts,ui/sign/SignPlay.svelte,ui/hudTheme.ts,ui/sign/SignMenuPanel.svelte};
// WATCHES: ; __reindeer.sign, __reindeer.hud.bar, HUD_BAR, .sgw, .s-words, .s-ring, data-shape, data-total, data-bar, .sgpad, .sgpads, data-pad, padPlaces, padShapes, pressOwner, pressShape, __reindeer.sign.pads, __reindeer.sign.owner, __reindeer.sign.shapes, .sgcatch, data-catch, data-l, .am-ui, .menu-open
// WATCHES: apps/run_over_reindeer/src/{game/actor.ts,game/utils.ts,game/stateGame.svelte.ts,ui/SpinHotkey.svelte};
// WATCHES: ; __reindeer.pressReady, __reindeer.spinTail, roundSettled, roundTailFinish, landSmall, SPIN_TAIL, flipGraceMs, ledCountDone, data-resume-card
// THE HUD PROBE (the house glass HUD from Manticore, "Win over Balance, Drop 6" plus round 6, in this game's "Frost"
// theme; ported from tools/manticore/hud_probe.js in the main repo). The HUD is HTML over the canvas (ui/Chrome*.svelte,
// ui/hud/*: ui/hud/hudLayout.ts places it in the mockup's own px, scaled by the chrome's fit). At each size:
//   · every control is there: Spin, the feature button (.fb), Menu, Auto, Turbo, minus, plus, and BALANCE, WIN and the
//     amount readouts; on the touch sizes each control's hit area (its box grown by its transparent ::after) is at least
//     44 x 44 CSS px
//   · no control and no readout overlaps the board (the five columns, __reindeer.boardLayout().css), the title sign
//     (the billboard logo, __reindeer.scene().logo.css, since scene pass 9), the bonus round's counter sign
//     ([data-title-sign]) or the reindeer's run band (the snow above the top lane, across the road picture's width: where
//     it runs before it turns down a reel, which is the board)
//   · the stepper keys never neighbour the Spin: their hit areas do not touch the Spin's, and the clear gap between
//     their circles and the Spin's is at least 18.5 mock px (x the HUD's scale)
//   · no control or readout changes its box between idle, spinning, autoplay running, a win shown, free spins, and
//     each Ante level on (0.5 px)
//   · the three amount fields hold the long values at their fixed type size: BALANCE "$9,999,999.99", WIN
//     "$1,250,000.00", the amount "$1,000.00"; the feature button: no word at rest (the engraved mark), 2X ANTE, 4X ANTE
//     or 10X ANTE whole inside it with an Ante level on
//   · desktop sizes: the WIN readout's centre within 2 px of the viewport's vertical centre line
//   · the help menu opens fully on screen and off the Spin, a plain panel with no tail (its box is its body, since the bet
//     bar fix 2026-11-19), and closes on a second Menu press; the Autoplay menu opens
//     fully on screen and closes on its close key
//   · portrait (round 6): one row inside the bar, left to right feature, Menu, Auto, Spin, Turbo, minus, plus; every key
//     inside the bar's height; WIN over BALANCE at the left and the amount at the right, BALANCE and the amount ending
//     just above the bar (0 to 4 mock px); each word 1 mock px over its number; no readout on a control; the key words 18 %
//     (Menu, Auto, Turbo: the feature key shows only the engraved PolyMath mark at rest since 2026-11-19, its word only
//     with a mode on)
//     of their key's height
//   · no win streak on the glass after a win (.sweep)
//   · THE LANE RING (the Spin's face, concept G2, 2026-11-20; ui/hud/spinRing.ts): the ring is there at rest and no stop
//     square; the square (.cg) shows only while the stop is available (a round playing) and is gone again at rest; the
//     ring turns in a round (data-run 1); the autoplay and free spins faces carry the thinned ring and no square; with
//     reduced motion nothing on the Spin turns or loops at rest or in a round (the square only fades); the Spin's hit
//     area at least 44 x 44 at every size
//   · EVERY ROUND TURNS THE RING (section `rounds`, 2026-11-20): an autoplay run of at least 6 rounds back to back (Super
//     Turbo, the no-win fixture on every round) and a free spins round: at each spin's start (the board's own count,
//     game/boardPace.ts serial) data-run 1 within 100 ms and the ring 10 degrees on within 400 ms; then an autoplay run
//     of 10 to its own end and the free spins round: once the key is idle the ring's turning layer holds still over 3 s
//   - THE HOME POSE (section `home`, 2026-11-20, Corey "Fix it": the ring came to rest at a random angle;
//     ui/hud/ringPlan.ts): 10 rounds at 1440 x 900 (three at Regular, two at Super Turbo, two stop presses at Regular
//     300 and 900 ms in, a run of three autoplay rounds; the run's ending Stop press brakes a fourth, reported, not
//     judged), each a line with its rest's distance from home (as planned and as drawn on the page), its brake against
//     today's and the cruise's largest speed change (as planned and as drawn). Then two desktop hovers (800 and 300 ms
//     over the key, then off it): their way home: BACK the way they came (2026-11-21, Corey: "I would prefer it goes backwards in that one
//     scenario"), home and still, the angle never above where the pointer left and the travel about the hover's angle
//     (not 360 less it); then a press during a hover: forward into the spin. Each line also prints the bounce's overshoot (planned and drawn) and
//     the round's bound. Pass: 9 of 10 or better within 2 degrees of home, both hovers home, no brake over its bound
//     (today's + 150 ms; a stop press today's + 250 ms; the bounce inside). HOME_METHODS=steer,long,fixed records each rest method in turn (the dev
//     hook's ringMethod; steer, the game's, by default)
//   · THE HUD UNDER THE BONUS ROUND'S CARDS (section `cards`, 2026-11-20): on the entry and the wrap-up, at 390 x 844,
//     844 x 390 and 1440 x 900, the HUD is held on screen (hud-held, inert, not hud-off), BALANCE and WIN readable, every
//     key on screen, nothing focusable, the Spin's spot takes the card's press; on the wrap-up WIN holds the round's total
//     (the card's amount); after it the HUD is live again
//     THE WIN ODOMETER (2026-11-21, Corey: "Odomoter roll defaults works for me"; ui/hud/winOdometer.ts): every frame of
//     the wrap-up is sampled in the page (the board's show, __reindeer.hud.winOdometer, the WIN readout's box): WIN never
//     reads the total (nor goes plain) before the card's count ends, goes plain on the total within two frames of the
//     end, its width does not move through the roll (0.25 px, the pop's frames aside), no digit window is left after the
//     lock, the landing pops once, the readout's aria name is the total throughout; on the desktop run the card is pressed
//     40 % into its count (the skip): plain within two frames of the press, one pop; with reduced motion (1440 x 900)
//     nothing rolls (the total's zeros, then the total, no pop); the capped wrap-up (max_win, 390 x 844, the bar hidden)
//     never runs the odometer; after the wrap-up the readout is today's plain text
//   · THE ROUND'S TAIL (section `tail`, 2026-11-22, Corey's ruling: the Spin key reads Spin once the round's board is
//     settled, and a press there always starts the next round; a press on Stop never does): see tailSection below
//   · the words: no character outside printable ASCII in the HUD's and the Autoplay menu's visible text; in social mode
//     (?social=true) also no restricted word (bet, buy, cash, money, paid, credit, gamble, wager, stake), aria included
//   · social coins (2026-11-21, Stake's table, game/currency.ts): with &currency=XSC and &currency=XGC at 390 x 844,
//     844 x 390 and 1440 x 900 the bar's amounts read "1,000.00 SC" / "1,000.00 GC" (the amount first, two decimals, a
//     no-break space, the code), no "$" in the page's text, each amount whole inside its field
// With SHOTS=<dir> it saves the idle and the spinning HUD at each size (phones at device pixel ratio 3, the rest at 2).
// With FLIP=<file.json> it also records the Spin's stop square popping in and out frame by frame at 1440 x 900 (both
// directions).
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [ONLY=a,b] [SKIPFS=1] [SHOTS=dir] \
//     [FLIP=file] [HOME_METHODS=steer,long,fixed] node tools/hud_probe.mjs
// Uses the dev server that is already running (it never starts one). One headless browser, closed at the end. Take the
// shared browser lock around it (mkdir /tmp/hud_mock_shot.lock ... rmdir).
import { createRequire } from 'node:module';
import { pressRoundCards } from './round_card_press.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import zlib from 'node:zlib';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3014';
const SHOTS = process.env.SHOTS || '';
const FLIP = process.env.FLIP || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// phone: the phone asset tier and touch; dpr: the capture density
const SIZES = [
	{ name: 'portrait', vp: { width: 390, height: 844 }, touch: true, phone: true, family: 'portrait' },
	{ name: 'short', vp: { width: 390, height: 620 }, touch: true, phone: true, family: 'portrait' },
	{ name: 'small', vp: { width: 360, height: 640 }, touch: true, phone: true, family: 'portrait' },
	{ name: 'big', vp: { width: 440, height: 956 }, touch: true, phone: true, family: 'portrait' },
	{ name: 'landscape', vp: { width: 844, height: 390 }, touch: true, phone: true, family: 'landscape' },
	{ name: 'ipad', vp: { width: 820, height: 1180 }, touch: true, phone: false, family: 'portrait' },
	{ name: 'ipad768', vp: { width: 768, height: 1024 }, touch: true, phone: false, family: 'portrait' },
	{ name: 'desk1610', vp: { width: 1440, height: 900 }, touch: false, phone: false, family: 'desktop', centre: true },
	{ name: 'desktop', vp: { width: 1920, height: 1080 }, touch: false, phone: false, family: 'desktop', centre: true },
	{ name: 'wide', vp: { width: 1920, height: 810 }, touch: false, phone: false, family: 'desktop', centre: true },
	{ name: 'mock1440', vp: { width: 1440, height: 810 }, touch: false, phone: false, family: 'desktop', centre: true },
	{ name: 'tablet', vp: { width: 1180, height: 820 }, touch: true, phone: false, family: 'desktop', centre: true },
];
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const CONTROLS = {
	spin: '.hudp button.spin',
	feature: '.hudp .fb',
	menu: '.hudp [data-hud="menu-key"]',
	auto: '.hudp button[aria-label="Autoplay"]',
	turbo: '.hudp button[aria-label^="Turbo"]',
	minus: '.hudp [data-hud-step="minus"]',
	plus: '.hudp [data-hud-step="plus"]',
};
const READOUTS = { balance: '.hudp [data-hud="balance"]', win: '.hudp [data-hud="win"]', amount: '.hudp [data-hud="amount"]' };
const BANNED = /\b(bets?|buy|buys|cash|money|paid|credits?|gamble|gambling|wager|wagers|stake)\b/i;

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
const r1 = (v) => Math.round(v * 10) / 10;
const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

const H = () => window.__reindeer;
/** THE GAME BAR IN USE (ui/hudTheme.ts HUD_BAR, read through __reindeer.hud.bar; 2026-11-22). The sections written for
 *  the glass dock's own drawing (its geometry per size, the lane ring) do not run under the sign bar: they say so and
 *  pass over. Set HUD_BAR to 'dock' to run them. The sign bar's own checks are section `signhud`. */
const barOf = (p) => p.evaluate(() => window.__reindeer?.hud?.bar ?? 'dock').catch(() => 'dock');
const dockOnly = async (p, what) => {
	if ((await barOf(p)) !== 'sign') return false;
	console.log(`SKIP ${what}: the glass dock's section, and the game bar in use is the sign bar`);
	return true;
};

async function boot(browser, S, extra = '') {
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.phone ? 3 : 2, isMobile: S.touch && S.family !== 'desktop', hasTouch: S.touch, reducedMotion: S.reduced ? 'reduce' : 'no-preference' });
	// (2026-11-17: the bonus entry waits for the press: round_card_press.mjs presses it on the old card's timing; the
	// `cards` section presses its cards itself, S.ownPress)
	if (!S.ownPress) await pressRoundCards(ctx);
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=hud${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}${extra}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 160; i++) {
		const ok = await p
			.evaluate(() => {
				const h = window.__reindeer;
				return !!(h && h.atRest && h.atRest() && h.hud && document.querySelector('.hudp') && !document.querySelector('.landing'));
			})
			.catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	await sleep(1200);
	return { ctx, p, errs };
}

/** press through every press-to-continue gate, wait until the game is idle and the board at rest */
async function settle(p, S, maxMs = 120000) {
	const t0 = Date.now();
	for (;;) {
		const st = await p.evaluate(() => ({ g: window.__reindeer.hud.gates(), idle: window.__reindeer.hud.idle(), rest: window.__reindeer.atRest() })).catch(() => null);
		if (st && st.g > 0) {
			await p.mouse.click(S.vp.width / 2, S.vp.height * 0.4).catch(() => {});
			await sleep(400);
			continue;
		}
		if (st && st.idle && st.rest) return true;
		if (Date.now() - t0 > maxMs) return false;
		await sleep(250);
	}
}

const snap = (p) =>
	p.evaluate(
		([C, R]) => {
			const box = (b) => ({ x0: b.left, y0: b.top, x1: b.right, y1: b.bottom });
			const out = { c: {}, r: {}, u: null };
			for (const [k, sel] of Object.entries(C)) {
				const el = document.querySelector(sel);
				if (!el) continue;
				const b = el.getBoundingClientRect();
				const u = el.offsetWidth ? b.width / el.offsetWidth : 1;
				out.u = out.u ?? u;
				const a = getComputedStyle(el, '::after');
				const has = a.content && a.content !== 'none';
				const n = (v) => (has && v !== 'auto' ? parseFloat(v) || 0 : 0);
				out.c[k] = { ...box(b), hit: { x0: b.left + n(a.left) * u, y0: b.top + n(a.top) * u, x1: b.right - n(a.right) * u, y1: b.bottom - n(a.bottom) * u }, disabled: el.disabled };
			}
			for (const [k, sel] of Object.entries(R)) {
				const el = document.querySelector(sel);
				if (el) out.r[k] = box(el.getBoundingClientRect());
			}
			return out;
		},
		[CONTROLS, READOUTS],
	);

/** the board (its five columns), the title sign, the reindeer's run band (the snow above the top lane, across the road
 *  picture: the picture is 1536 road px wide, the columns start at road x 142), CSS px */
const scene = (p) =>
	p.evaluate(() => {
		const L = window.__reindeer.boardLayout();
		const c = L.css;
		const k = c.width / 1250;
		// the title: the billboard logo in the canvas since scene pass 9 (__reindeer.scene().logo.css); the highway sign
		// ([data-title-sign]) now shows only in a bonus round, with its counter, and is checked as its own box
		const lg = window.__reindeer.scene?.()?.logo?.css;
		const t = lg ? { left: lg.x, top: lg.y, right: lg.x + lg.width, bottom: lg.y + lg.height } : null;
		const rs = document.querySelector('[data-title-sign]')?.getBoundingClientRect();
		return {
			kind: L.kind,
			board: { x0: c.x, y0: c.y, x1: c.x + c.width, y1: c.y + c.height },
			title: t ? { x0: t.left, y0: t.top, x1: t.right, y1: t.bottom } : null,
			round: rs ? { x0: rs.left, y0: rs.top, x1: rs.right, y1: rs.bottom } : null,
			run: { x0: c.x - 142 * k, x1: c.x + (1536 - 142) * k, y0: 0, y1: c.y },
		};
	});

const same = (a, b) => ['x0', 'y0', 'x1', 'y1'].every((k) => Math.abs(a[k] - b[k]) <= 0.5);
const compare = (name, label, base, now) => {
	const moved = [];
	for (const [k, v] of Object.entries(base.c)) if (now.c[k] && !same(v, now.c[k])) moved.push(`${k} ${JSON.stringify([r1(v.x0), r1(v.y0), r1(v.x1), r1(v.y1)])} -> ${JSON.stringify([r1(now.c[k].x0), r1(now.c[k].y0), r1(now.c[k].x1), r1(now.c[k].y1)])}`);
	for (const [k, v] of Object.entries(base.r)) if (now.r[k] && !same(v, now.r[k])) moved.push(`${k} readout moved`);
	const missing = Object.keys(base.c).filter((k) => !now.c[k]);
	check(moved.length === 0 && missing.length === 0, `${name}: no control or readout changes its box between idle and ${label}`, { moved, missing });
};

/** THE FEATURE KEY'S FACE, measured on a screenshot of the key (the disabled key's checks, 2026-11-20): the WCAG relative
 *  luminance of the pixels in the key's middle (70 % across, 60 % down, clear of the rim), as the mean and two
 *  percentiles. A small PNG reader (8 bit RGB or RGBA, not interlaced: what Playwright writes), so no package is needed. */
const readPng = (buf) => {
	let o = 8;
	let w = 0, h = 0, ct = 0;
	const idat = [];
	while (o < buf.length) {
		const len = buf.readUInt32BE(o);
		const type = buf.toString('ascii', o + 4, o + 8);
		const data = buf.subarray(o + 8, o + 8 + len);
		if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
		else if (type === 'IDAT') idat.push(data);
		else if (type === 'IEND') break;
		o += 12 + len;
	}
	const bpp = ct === 6 ? 4 : 3;
	const raw = zlib.inflateSync(Buffer.concat(idat));
	const stride = w * bpp;
	const px = Buffer.alloc(h * stride);
	for (let y = 0; y < h; y++) {
		const f = raw[y * (stride + 1)];
		const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		for (let x = 0; x < stride; x++) {
			const a = x >= bpp ? px[y * stride + x - bpp] : 0;
			const b = y > 0 ? px[(y - 1) * stride + x] : 0;
			const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
			let v = line[x];
			if (f === 1) v += a;
			else if (f === 2) v += b;
			else if (f === 3) v += (a + b) >> 1;
			else if (f === 4) { const p0 = a + b - c; const pa = Math.abs(p0 - a), pb = Math.abs(p0 - b), pc = Math.abs(p0 - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
			px[y * stride + x] = v & 255;
		}
	}
	return { w, h, bpp, px };
};
const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const keyFace = async (p) => {
	// (a page screenshot clipped to the key's box: an element screenshot came back with the frame before the change)
	const box = await p.evaluate(() => { const b = document.querySelector('.hudp .fb')?.getBoundingClientRect(); return b ? { x: b.left, y: b.top, width: b.width, height: b.height } : null; });
	if (!box) return null;
	const { w, h, bpp, px } = readPng(await p.screenshot({ clip: box }));
	const L = [];
	for (let y = Math.round(h * 0.2); y < Math.round(h * 0.8); y++)
		for (let x = Math.round(w * 0.15); x < Math.round(w * 0.85); x++) {
			const i = (y * w + x) * bpp;
			L.push(0.2126 * lin(px[i]) + 0.7152 * lin(px[i + 1]) + 0.0722 * lin(px[i + 2]));
		}
	L.sort((a, b) => a - b);
	const q = (t) => L[Math.min(L.length - 1, Math.floor(L.length * t))];
	const mean = L.reduce((s, v) => s + v, 0) / L.length;
	// the mark against the glass: its bright inlay (the top 5 %) over the glass (the darkest 15 %: on the sideways phone's
	// small key the steel covers most of the middle)
	return { mean, mark: q(0.95), glass: q(0.15), contrast: (q(0.95) + 0.05) / (q(0.15) + 0.05) };
};

const featureWordInside = (p) =>
	p.evaluate(() => {
		const b = document.querySelector('.hudp .fb');
		const l = b?.querySelector('.lb');
		if (!b || !l) return null;
		const B = b.getBoundingClientRect();
		const R = l.getBoundingClientRect();
		const shown = getComputedStyle(l).display !== 'none';
		return { text: l.textContent.trim(), shown, inside: !shown || (R.left >= B.left - 0.5 && R.right <= B.right + 0.5 && R.top >= B.top - 0.5 && R.bottom <= B.bottom + 0.5), lb: [R.left, R.right, R.top, R.bottom].map((v) => Math.round(v * 10) / 10), btn: [B.left, B.right, B.top, B.bottom].map((v) => Math.round(v * 10) / 10) };
	});

const hudWords = (p) =>
	p.evaluate(() => {
		const out = [];
		const walk = (el) => {
			for (const n of el.childNodes) {
				if (n.nodeType === 3) {
					const t = n.textContent.trim();
					if (!t) continue;
					const e = n.parentElement;
					const cs = getComputedStyle(e);
					if (cs.display === 'none' || cs.visibility === 'hidden') continue;
					out.push(t);
				} else if (n.nodeType === 1) walk(n);
			}
		};
		document.querySelectorAll('.am-ui').forEach(walk);
		return out;
	});

/** THE LANE RING: what the Spin's face shows now */
const ringNow = (p) =>
	p.evaluate(() => {
		const b = document.querySelector('.hudp button.spin');
		if (!b) return null;
		const cg = b.querySelector('.cg');
		const R = b.getBoundingClientRect();
		// (the key's own press dip and rim transitions are the bar's, not the face's)
		const running = b.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && a.effect?.target !== b);
		return {
			face: b.dataset.face,
			st: b.dataset.st,
			run: b.dataset.run,
			mode: [...b.classList].find((c) => c.startsWith('m-')),
			ring: !!b.querySelector('.fx .rr svg.rs'),
			counted: !!b.querySelector('.fx.cnt-face'),
			square: cg ? Math.round(parseFloat(getComputedStyle(cg).opacity) * 100) / 100 : null,
			turning: running.filter((a) => !(typeof CSSTransition !== 'undefined' && a instanceof CSSTransition && a.transitionProperty === 'opacity')).map((a) => a.animationName ?? a.transitionProperty ?? 'script'),
			w: R.width,
			h: R.height,
		};
	});


/** THE WIN'S SUNBURST (2026-11-20, ui/hud/HudReadout.svelte): is it lit, does the WIN box keep its amount inside it, is the
 *  pill gone, and which CSS animations run on it (the readout and the rays) */
const burstNow = (p) =>
	p.evaluate(() => {
		const w = document.querySelector('.hudp [data-hud="win"]');
		const b = document.querySelector('.hudp .wburst');
		if (!w || !b) return null;
		const W = w.getBoundingClientRect();
		const V = w.querySelector('.value').getBoundingClientRect();
		const anims = [...b.getAnimations({ subtree: true }), ...w.getAnimations({ subtree: true })].filter((a) => a.animationName && a.playState === 'running').map((a) => a.animationName);
		return { on: b.classList.contains('on'), phase: [...b.classList].find((c) => /^wb-(off|cnt|land|hold|out)$/.test(c)) ?? null, opacity: Number(getComputedStyle(b).opacity), pill: getComputedStyle(w).backgroundImage, inside: V.left >= W.left - 0.5 && V.right <= W.right + 0.5, anims };
	});

async function spinOnce(p) {
	await p.evaluate(() => window.__reindeer.hud.emit({ type: 'bet' }));
	for (let i = 0; i < 60 && (await p.evaluate(() => window.__reindeer.hud.idle())); i++) await sleep(50);
}

async function runSize(browser, S) {
	const { ctx, p, errs } = await boot(browser, S);
	if (await dockOnly(p, "the glass dock's geometry at this size (the sign bar's is section signhud)")) return void (await ctx.close());
	const name = `${S.name} ${S.vp.width}x${S.vp.height}`;
	await settle(p, S);
	await sleep(600);
	const idle = await snap(p);
	const b0 = await burstNow(p);
	check(!!b0 && !b0.on && b0.anims.length === 0, `${name}: at rest the WIN sunburst is off and nothing of it runs`, b0);
	const sc = await scene(p);
	const u = idle.u ?? 1;
	if (SHOTS) await p.screenshot({ path: join(SHOTS, `${S.vp.width}x${S.vp.height}_idle.png`) });

	const want = Object.keys(CONTROLS);
	check(want.every((k) => idle.c[k]) && Object.keys(READOUTS).every((k) => idle.r[k]), `${name}: every control and readout present`, { controls: Object.keys(idle.c), readouts: Object.keys(idle.r) });
	if (S.touch) {
		const small = Object.entries(idle.c).filter(([, v]) => v.hit.x1 - v.hit.x0 < 43.9 || v.hit.y1 - v.hit.y0 < 43.9).map(([k, v]) => `${k} ${r1(v.hit.x1 - v.hit.x0)}x${r1(v.hit.y1 - v.hit.y0)}`);
		check(small.length === 0, `${name}: every control's hit area at least 44 x 44 CSS px`, small);
	}
	// clear of the scene
	const hits = [];
	const things = { ...Object.fromEntries(Object.entries(idle.c).map(([k, v]) => [k, v])), ...Object.fromEntries(Object.entries(idle.r).map(([k, v]) => [`${k} readout`, v])) };
	const bar = await p.evaluate(() => {
		const e = document.querySelector('.hudp [data-hud="bar"]');
		if (!e) return null;
		const b = e.getBoundingClientRect();
		return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom };
	});
	if (bar) things['portrait bar'] = bar;
	for (const [k, v] of Object.entries(things)) {
		for (const [what, rect] of Object.entries({ board: sc.board, 'title sign': sc.title, 'round counter sign': sc.round, "reindeer's run band": sc.run })) {
			if (rect && inter(v, rect) > 0.5) hits.push(`${k} on the ${what} (${r1(inter(v, rect))} px2)`);
		}
	}
	check(hits.length === 0, `${name}: no control or readout overlaps the board, the title sign or the reindeer's run band`, hits);
	const hudTop = Math.min(...Object.values(things).map((v) => v.y0));
	console.log(`  INFO ${name}: HUD scale ${r1(u * 100) / 100}; board ${r1(sc.board.x0)}..${r1(sc.board.x1)} x ${r1(sc.board.y0)}..${r1(sc.board.y1)}; HUD top ${r1(hudTop)} (${r1(hudTop - sc.board.y1)} px under the board)`);

	// the stepper keys and the Spin
	const sp = idle.c.spin;
	if (sp && idle.c.minus && idle.c.plus) {
		const circ = (b) => ({ cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, r: (b.x1 - b.x0) / 2 });
		const s = circ(sp);
		const gaps = ['minus', 'plus'].map((k) => {
			const c = circ(idle.c[k]);
			return { k, gap: Math.hypot(c.cx - s.cx, c.cy - s.cy) - c.r - s.r, touch: inter(idle.c[k].hit, sp.hit) > 0 };
		});
		check(gaps.every((g) => !g.touch), `${name}: the stepper keys' hit areas do not touch the Spin's`, gaps);
		check(gaps.every((g) => g.gap >= 18.5 * u - 0.5), `${name}: stepper to Spin clear gap at least 18.5 x ${r1(u * 100) / 100} = ${r1(18.5 * u)} px (${gaps.map((g) => `${g.k} ${r1(g.gap)}`).join(', ')})`, gaps);
	}
	// the portrait row (round 6)
	if (S.family === 'portrait') {
		const row = await p.evaluate(() => {
			const R = (e) => {
				if (!e) return null;
				const b = e.getBoundingClientRect();
				return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom };
			};
			const q = (s) => document.querySelector(s);
			const fz = (e) => (e ? parseFloat(getComputedStyle(e).fontSize) : null);
			const plane = q('.hudp');
			const u = plane.getBoundingClientRect().width / plane.offsetWidth;
			const word = (sel, key) => {
				const k = q(sel);
				const w = k?.querySelector(key);
				return k && w ? { font: fz(w) * u, h: k.getBoundingClientRect().height } : null;
			};
			const rd = (k) => {
				const e = q(`.hudp [data-hud="${k}"]`);
				return e ? { box: R(e), lb: R(e.querySelector('.lbw')), vl: R(e.querySelector('.value')), lbPx: fz(e.querySelector('.lbw')) * u, vlPx: fz(e.querySelector('.value')) * u } : null;
			};
			return {
				u,
				bar: R(q('.hudp [data-hud="bar"]')),
				hf: window.__reindeer.hud.frame(),
				words: { menu: word('.hudp [data-hud="menu-key"]', '.kl'), auto: word('.hudp button[aria-label="Autoplay"]', '.kl'), turbo: word('.hudp button[aria-label^="Turbo"]', '.kl'), feature: word('.hudp .fb', '.lb') },
				read: { win: rd('win'), balance: rd('balance'), amount: rd('amount') },
			};
		});
		const c = idle.c;
		const cx = (b) => (b.x0 + b.x1) / 2;
		const order = ['feature', 'menu', 'auto', 'spin', 'turbo', 'minus', 'plus'];
		const xs = order.map((k) => (c[k] ? cx(c[k]) : NaN));
		check(xs.every((x, i) => i === 0 || x > xs[i - 1]), `${name}: one row, left to right feature, Menu, Auto, Spin, Turbo, minus, plus`, xs.map(r1));
		check(c.turbo.x0 >= c.spin.x1 - 0.5 && c.turbo.x1 <= c.minus.x0 + 0.5, `${name}: Turbo sits between the Spin and minus`);
		const B = row.bar;
		const outside = order.filter((k) => k !== 'spin' && c[k] && (c[k].y0 < B.y0 - 0.5 || c[k].y1 > B.y1 + 0.5)).map((k) => `${k} ${r1(c[k].y0)}..${r1(c[k].y1)}`);
		check(!!B && outside.length === 0, `${name}: every key inside the bar's height (${B ? `${r1(B.y0)}..${r1(B.y1)}` : 'no bar'})`, outside);
		const R = row.read;
		const ru = row.u;
		const above = ['balance', 'amount'].map((k) => ({ k, gap: B.y0 - R[k].box.y1 }));
		check(above.every((a) => a.gap >= -0.5 && a.gap <= 4 * ru + 0.5), `${name}: BALANCE and the amount end just above the bar, never on it (${above.map((a) => `${a.k} ${r1(a.gap)} px`).join(', ')})`, above);
		check(R.win.box.y1 <= R.balance.box.y0 + 0.5 && R.win.box.x0 < 200 && R.amount.box.x1 > S.vp.width - 200, `${name}: WIN over BALANCE at the left, the amount at the right`);
		const wg = Object.entries(R).map(([k, v]) => ({ k, gap: v.vl.y0 - v.lb.y1 }));
		check(wg.every((g) => Math.abs(g.gap - ru) <= 0.6), `${name}: each word 1 mock px (${r1(ru)} px) over its number (${wg.map((g) => `${g.k} ${r1(g.gap)}`).join(', ')})`, wg);
		const onCtl = [];
		for (const [rk, rv] of Object.entries(R)) for (const [ck, cv] of Object.entries(c)) if (inter(rv.box, cv) > 0.5) onCtl.push(`${rk} on ${ck}`);
		check(onCtl.length === 0, `${name}: no readout on a control`, onCtl);
		const W = Object.entries(row.words)
			.filter(([, v]) => v)
			.map(([k, v]) => ({ k, ratio: v.font / v.h }));
		// (the feature key has no word at rest since the engraved mark, 2026-11-19: Menu, Auto and Turbo)
		check(W.length === 3 && !row.words.feature && W.every((w) => Math.abs(w.ratio - 0.18) <= 0.006), `${name}: the key words 18 % of their key's height (${W.map((w) => `${w.k} ${(w.ratio * 100).toFixed(1)} %`).join(', ')})`, W);
		const sz = (b) => `${r1(b.x1 - b.x0)}x${r1(b.y1 - b.y0)}`;
		console.log(`  INFO ${name}: u ${ru.toFixed(3)}, row t ${row.hf ? row.hf.t.toFixed(3) : '-'}, band ${row.hf ? r1(row.hf.gap * ru) : '-'} px; Spin ${sz(c.spin)}, feature ${sz(c.feature)}, Menu ${sz(c.menu)}, Auto ${sz(c.auto)}, Turbo ${sz(c.turbo)}, minus ${sz(c.minus)}, plus ${sz(c.plus)}`);
		console.log(`  INFO ${name}: numbers ${R.balance.vlPx.toFixed(2)} px, words ${R.balance.lbPx.toFixed(2)} px; WIN top to the board ${r1(R.win.box.y0 - sc.board.y1)} px, Spin top to the board ${r1(c.spin.y0 - sc.board.y1)} px; minus to the Spin's edge ${r1(c.minus.x0 - c.spin.x1)} px`);
	}
	if (S.centre && idle.r.win) {
		const c = (idle.r.win.x0 + idle.r.win.x1) / 2;
		check(Math.abs(c - S.vp.width / 2) <= 2, `${name}: the WIN readout's centre ${r1(c)} within 2 px of the screen's centre ${S.vp.width / 2}`);
	}
	// the long values at the fixed type size
	const fits = await p.evaluate((R) => {
		const vals = { balance: '$9,999,999.99', win: '$1,250,000.00', amount: '$1,000.00' };
		const out = {};
		for (const [k, sel] of Object.entries(R)) {
			const el = document.querySelector(sel);
			if (!el) continue;
			const cl = el.cloneNode(true);
			cl.style.visibility = 'hidden';
			el.parentElement.appendChild(cl);
			const v = cl.querySelector('.value');
			v.textContent = vals[k];
			v.style.fontSize = '';
			const sb = cl.getBoundingClientRect();
			const vb = v.getBoundingClientRect();
			out[k] = { field: Math.round(sb.width * 10) / 10, value: Math.round(vb.width * 10) / 10, left: Math.round((vb.left - sb.left) * 10) / 10, right: Math.round((sb.right - vb.right) * 10) / 10, font: getComputedStyle(v).fontSize };
			cl.remove();
		}
		return out;
	}, READOUTS);
	check(Object.values(fits).length === 3 && Object.values(fits).every((f) => f.left >= -0.5 && f.right >= -0.5), `${name}: the long values fit their fields at the fixed type size`, fits);
	console.log(`  INFO ${name}: long values ${Object.entries(fits).map(([k, f]) => `${k} ${f.value} in ${f.field} at ${f.font}`).join(', ')}`);
	// the social coins' long values (2026-11-21, Stake's table: the amount first, two decimals, the code; three characters
	// longer than the old "GC 9,999,999"): at the fixed type size, for the record only; a longer string shrinks to fit
	// (HudReadout's fitFont), and the social section checks the real amounts sit whole in their fields
	const socFits = await p.evaluate((R) => {
		const vals = { balance: '9,999,999.99 GC', win: '1,250,000.00 SC', amount: '1,000.00 GC' };
		const out = {};
		for (const [k, sel] of Object.entries(R)) {
			const el = document.querySelector(sel);
			if (!el) continue;
			const cl = el.cloneNode(true);
			cl.style.visibility = 'hidden';
			el.parentElement.appendChild(cl);
			const v = cl.querySelector('.value');
			v.textContent = vals[k];
			v.style.fontSize = '';
			const sb = cl.getBoundingClientRect();
			const vb = v.getBoundingClientRect();
			out[k] = { text: vals[k], fits: vb.left - sb.left >= -0.5 && sb.right - vb.right >= -0.5, value: Math.round(vb.width * 10) / 10, field: Math.round(sb.width * 10) / 10 };
			cl.remove();
		}
		return out;
	}, READOUTS);
	console.log(`  INFO ${name}: social long values at the fixed size ${Object.entries(socFits).map(([k, f]) => `${k} "${f.text}" ${f.value} in ${f.field}${f.fits ? '' : ' (shrinks)'}`).join(', ')}`);
	// THE ENGRAVED MARK (2026-11-19, Corey: "No text. Only logo"): at rest the feature button has no word, only the
	// PolyMath mark etched into its glass (and its aria-label names it); with a mode on the word comes back (below)
	const fr = await p.evaluate(() => {
		const b = document.querySelector('.hudp .fb');
		const rest = b?.querySelector('.em-rest svg');
		return b ? { text: b.textContent.trim(), aria: b.getAttribute('aria-label'), mark: !!rest && getComputedStyle(rest.parentElement).opacity === '1', on: !!b.querySelector('.em-on svg') } : null;
	});
	check(!!fr && fr.text === '' && fr.mark && fr.on && !!fr.aria, `${name}: the feature button at rest: the etched mark and no word (aria-label "${fr?.aria}")`, fr);
	const restFace = await keyFace(p);
	const ringRest = await ringNow(p);
	check(!!ringRest && ringRest.face === 'lane-ring' && ringRest.ring && !ringRest.counted && ringRest.square === 0 && ringRest.run === '0', `${name}: the Spin at rest: the lane ring, no stop square`, ringRest);
	check(!!sp && sp.hit.x1 - sp.hit.x0 >= 43.9 && sp.hit.y1 - sp.hit.y0 >= 43.9, `${name}: the Spin's hit area at least 44 x 44 (${sp ? `${r1(sp.hit.x1 - sp.hit.x0)} x ${r1(sp.hit.y1 - sp.hit.y0)}` : '-'})`);

	// the words, real mode: no symbol character (the restricted words are checked in social mode, where the soc()
	// switch takes them out; real mode keeps "BET" as the house's soc() pattern does)
	const words = await hudWords(p);
	const bad = words.filter((w) => /[^\x20-\x7e]/.test(w));
	check(bad.length === 0, `${name}: the HUD's visible words carry no symbol character`, bad);

	// the help menu
	await p.click(CONTROLS.menu);
	await sleep(500);
	const mp = await p.evaluate(() => {
		const e = document.querySelector('.hudp .mp.is-open');
		if (!e) return null;
		const b = e.getBoundingClientRect();
		const body = e.querySelector('.mpsh').getBoundingClientRect();
		return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom, body: { x0: body.left, y0: body.top, x1: body.right, y1: body.bottom } };
	});
	check(!!mp && mp.x0 >= -0.5 && mp.y0 >= -0.5 && mp.x1 <= S.vp.width + 0.5 && mp.y1 <= S.vp.height + 0.5 && inter(mp.body, sp) === 0, `${name}: the help menu opens fully on screen, its body off the Spin`, mp);
	// THE BET BAR FIX (2026-11-19, Corey: "Make this not look like a chat bubble"): no tail, so the panel's box IS its body
	check(!!mp && ['x0', 'y0', 'x1', 'y1'].every((k) => Math.abs(mp[k] - mp.body[k]) <= 0.5), `${name}: the help menu is a plain panel (no tail: its box is its body)`, mp);
	if (mp) console.log(`  INFO ${name}: help menu body over the board ${r1(inter(mp.body, sc.board))} px2`);
	if (SHOTS) await p.screenshot({ path: join(SHOTS, `${S.vp.width}x${S.vp.height}_menu.png`) });
	await p.click(CONTROLS.menu);
	await sleep(500);
	check(!(await p.evaluate(() => !!document.querySelector('.hudp .mp.is-open'))), `${name}: a second Menu press closes it`);
	// the Autoplay menu
	await p.click(CONTROLS.auto);
	await sleep(700);
	const am = await p.evaluate(() => {
		const e = document.querySelector('.am-ui.layer.modals .panel');
		if (!e) return null;
		const b = e.getBoundingClientRect();
		return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom, scroll: e.scrollHeight > e.clientHeight + 1 };
	});
	check(!!am && am.x0 >= -0.5 && am.y0 >= -0.5 && am.x1 <= S.vp.width + 0.5 && am.y1 <= S.vp.height + 0.5, `${name}: the Autoplay menu opens fully on screen`, am);
	if (am) console.log(`  INFO ${name}: Autoplay menu ${r1(am.x1 - am.x0)} x ${r1(am.y1 - am.y0)}${am.scroll ? ', scrolls' : ''}`);
	const amWords = (await hudWords(p)).filter((w) => /[^\x20-\x7e]/.test(w));
	check(amWords.length === 0, `${name}: the Autoplay menu's words carry no symbol character`, amWords);
	if (SHOTS && S.name === 'portrait') await p.screenshot({ path: join(SHOTS, `${S.vp.width}x${S.vp.height}_autoplay.png`) });
	await p.click('.am-ui.layer.modals button.x[aria-label="Close"]');
	let amOpen = true;
	for (let i = 0; i < 20 && amOpen; i++) {
		await sleep(150);
		amOpen = await p.evaluate(() => !!document.querySelector('.am-ui.layer.modals .panel'));
	}
	check(!amOpen, `${name}: its close key closes it`);

	// the Ante levels
	for (const mode of ['ANTE_2', 'ANTE_4', 'ANTE_10']) {
		await p.evaluate((m) => window.__reindeer.hud.setMode(m), mode);
		await sleep(450);
		const s = await snap(p);
		compare(name, `${mode} on`, idle, s);
		const f = await featureWordInside(p);
		const cls = await p.evaluate(() => document.querySelector('.hudp .fb')?.className ?? '');
		// the level's word (Corey 2026-11-20: "2X ANTE, 4X ANTE, 10X ANTE"): its number is the mode's RGS cost
		const cost = await p.evaluate((k) => window.__reindeer.fastLane?.rgsCost?.(k) ?? null, mode);
		const want = `${cost ?? mode.split('_')[1]}X ANTE`;
		check(f?.text === want && f.inside && /\bante\b/.test(cls) && (mode === 'ANTE_10') === /\bsante\b/.test(cls), `${name}: ${mode}: the feature button says ${f?.text} (${want}), whole inside the key, in its "on" state${mode === 'ANTE_10' ? ' with the double rim' : ''}`, { f, cls });
		if (SHOTS && mode === 'ANTE_10' && (S.name === 'portrait' || S.name === 'desk1610' || S.name === 'landscape')) await p.screenshot({ path: join(SHOTS, `${S.vp.width}x${S.vp.height}_ante10.png`) });
	}
	await p.evaluate(() => window.__reindeer.hud.setMode('BASE'));
	await sleep(300);
	// spinning, then a win (the fixture's base order: a plain spin, then a line win)
	let spun = null;
	let won = null;
	for (let i = 0; i < 8 && !won; i++) {
		await spinOnce(p);
		if (!spun) {
			await sleep(260);
			spun = await snap(p);
			const rr = await ringNow(p);
			check(!!rr && rr.st === 'run' && rr.square > 0.9 && rr.run === '1', `${name}: in a round the stop square shows over the turning ring`, rr);
			// THE FAST LANE KEY KEEPS ITS LOOK IN A ROUND (2026-11-24, Corey: "while spinning the Fast Lane Button gets
			// visibly disabled, much like Manticore was, which is distracting for a user. For this game, I would suggest
			// leaving the button the way it is visibly during spins, and make user taps not work during a spin."; it was
			// "Cold Inlay", 2026-11-20: the attribute, a steel mark, a darker glass). In a round the key is not a disabled
			// button and says aria-disabled="true"; its mark is the rest etch (the steel one hidden), its lights are not
			// dark, its glass reads as at rest (the luminance of its middle within 0.03 of the rest face; the old dim
			// glass was darker by far more); and a press on its middle while the round plays opens no Fast Lane.
			// (read at once and again 300 ms on: nothing cross-fades any more)
			const keyNow = () =>
				p.evaluate(() => {
					const b = document.querySelector('.hudp .fb');
					const op = (s) => { const e = b?.querySelector(s); return e ? Number(getComputedStyle(e).opacity) : null; };
					const r = b?.getBoundingClientRect();
					return b ? { disabled: b.disabled, aria: b.getAttribute('aria-disabled'), busy: b.classList.contains('is-busy'), lights: b.getAttribute('data-l'), off: op('.em-off'), rest: op('.em-rest'), ink: op('.s-ink'), cursor: getComputedStyle(b).cursor, idle: window.__reindeer.hud.idle(), at: r ? [r.left + r.width / 2, r.top + r.height / 2] : null } : null;
				});
			const dk = await keyNow();
			const df = await keyFace(p);
			await sleep(300);
			const dk2 = await keyNow();
			const same = (k) => !!k && k.disabled === false && k.aria === 'true' && k.busy && k.lights !== 'off' && (k.off === null || k.off === 0) && (k.rest === null || k.rest === 1) && (k.ink === null || k.ink === 1);
			// (a key in a round that is already over when it is read says so: the check is then not made on that read)
			const inRound = [dk, dk2].filter((k) => k && !k.idle);
			check(inRound.length > 0 && inRound.every(same) && !!df && !!restFace && Math.abs(df.glass - restFace.glass) <= 0.03, `${name}: in a round the Fast Lane key keeps its resting look: not a disabled button, aria-disabled="true", the rest etch and full ink, its lights ${dk?.lights}, its glass ${df ? df.glass.toFixed(3) : '?'} against ${restFace ? restFace.glass.toFixed(3) : '?'} at rest`, { dk, dk2, df, restFace });
			if (dk && !dk.idle && dk.at) {
				// (a press while the round plays: by mouse or by touch, as the size is)
				if (S.touch) await p.touchscreen.tap(dk.at[0], dk.at[1]).catch(() => {});
				else await p.mouse.click(dk.at[0], dk.at[1]).catch(() => {});
				await sleep(150);
				const after = await p.evaluate(() => ({ menu: !!document.querySelector('[data-feature-menu]'), idle: window.__reindeer.hud.idle() }));
				// (the press is judged only if the round was still playing after it: a round that ended under the press is the
				// live key's)
				if (!after.idle) check(!after.menu, `${name}: a press on the Fast Lane key while the round plays opens nothing`, after);
				else if (after.menu) await p.keyboard.press('Escape').catch(() => {});
			}
			if (SHOTS) await p.screenshot({ path: join(SHOTS, `${S.vp.width}x${S.vp.height}_spinning.png`) });
		}
		await settle(p, S);
		await sleep(700);
		if (i === 0) {
			const ra = await ringNow(p);
			check(!!ra && ra.square === 0 && ra.st === 'idle' && ra.run === '0', `${name}: the round over, the square gone and the ring at rest`, ra);
		}
		if ((await p.evaluate(() => window.__reindeer.hud.win())) > 0) {
			won = await snap(p);
			check(!(await p.evaluate(() => !!document.querySelector('.hudp .sweep'))), `${name}: no win streak on the glass after a win`);
			// THE WIN'S SUNBURST: lit while the win shows, the pill gone, the amount inside its box; the long amount at the
			// fixed type size is checked above (the long values); reduced motion: lit and still (no CSS animation runs)
			await sleep(900);
			const bw = await burstNow(p);
			check(!!bw && bw.on && bw.opacity > 0.9 && bw.pill === 'none' && bw.inside, `${name}: a win shows: the sunburst lit (${bw?.phase}), no pill, the amount inside its box`, bw);
			await p.emulateMedia({ reducedMotion: 'reduce' });
			await sleep(500);
			const br = await burstNow(p);
			check(!!br && br.on && br.anims.length === 0, `${name}: reduced motion: the sunburst lit and still (no animation runs)`, br);
			await p.emulateMedia({ reducedMotion: null });
			if (SHOTS && (S.name === 'portrait' || S.name === 'desk1610')) await p.screenshot({ path: join(SHOTS, `${S.vp.width}x${S.vp.height}_win.png`) });
		}
	}
	if (spun) compare(name, 'spinning', idle, spun);
	if (won) compare(name, 'a win shown', idle, won);
	else console.log(`  NOTE ${name}: no win in 8 spins (the win state not compared)`);
	// autoplay running (the menu's START begins the run at once: no Spin press, 2026-11-23)
	await p.click(CONTROLS.auto);
	await sleep(700);
	await p.click('.am-ui.layer.modals .go');
	let auto = null;
	for (let i = 0; i < 40 && !auto; i++) {
		await sleep(100);
		if (await p.evaluate(() => document.querySelector('.hudp button.spin')?.getAttribute('aria-label')?.startsWith('Stop autoplay') === true)) auto = await snap(p);
	}
	check(!!auto, `${name}: an autoplay run started from the Autoplay menu's START`);
	const rAuto = await ringNow(p);
	check(!!rAuto && rAuto.counted && rAuto.ring && rAuto.square === null, `${name}: autoplay running: the thinned ring round the count, no stop square in the face`, rAuto);
	if (auto) compare(name, 'autoplay running', idle, auto);
	await p.click(CONTROLS.spin).catch(() => {});
	await settle(p, S, 180000);
	// free spins (the fixture's natural free spins round)
	if (process.env.SKIPFS !== '1') {
		await p.evaluate(() => window.__reindeer.fixtures.next('natural_free_spins'));
		await spinOnce(p);
		let fs = null;
		const t0 = Date.now();
		while (!fs && Date.now() - t0 < 90000) {
			const st = await p.evaluate(() => ({ gt: window.__reindeer.gameType(), gates: window.__reindeer.hud.gates(), fs: !!document.querySelector('.hudp button.spin.m-feature') }));
			if (st.gates > 0) await p.mouse.click(S.vp.width / 2, S.vp.height * 0.4).catch(() => {});
			else if (st.gt === 'freegame' && st.fs) {
				await sleep(200);
				fs = await snap(p);
			}
			await sleep(300);
		}
		check(!!fs, `${name}: free spins reached`);
		if (fs) {
			const rf = await ringNow(p);
			const fill = await p.evaluate(() => !!document.querySelector('.hudp button.spin .fx svg.fill .lit'));
			check(!!rf && rf.counted && rf.ring && rf.square === null && fill, `${name}: free spins: the thinned ring over the filled track, no stop square`, { rf, fill });
		}
		if (fs) compare(name, 'free spins', idle, fs);
		// SKIP TO RESULT (2026-11-19, components/SkipButton.svelte, Manticore's place: ui/hud/hudLayout.ts hudSkipRect): up in
		// the free spins, inside the window, on no HUD control (their hit areas), not on the board or the title sign
		if (fs) {
			const sk = await p.evaluate(() => {
				const e = document.querySelector('[data-skip="button"]');
				if (!e) return null;
				const b = e.getBoundingClientRect();
				return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom, up: window.__reindeer.skipHud?.().up ?? false, vw: innerWidth, vh: innerHeight };
			});
			const on = sk ? Object.entries(fs.c).filter(([, v]) => inter(sk, v.hit ?? v) > 0.5).map(([k]) => k) : [];
			const scf = await scene(p);
			const over = sk ? Object.entries({ board: scf.board, 'title sign': scf.title }).filter(([, r]) => r && inter(sk, r) > 0.5).map(([k]) => k) : [];
			check(!!sk && sk.up && sk.x0 >= 0 && sk.y0 >= 0 && sk.x1 <= sk.vw && sk.y1 <= sk.vh && on.length === 0 && over.length === 0, `${name}: SKIP up in the free spins, inside the window, on no control (${on.join(', ') || 'none'}), not on ${over.join(', ') || 'the board or the title sign'}`, { sk, on, over });
		}
		// THE COUNTER'S ONE READING (2026-11-18): after a flip (spin 2 on) the button's text holds ONE number and OF the
		// total (the outgoing face is drawn from data-d by CSS, aria-hidden, no text), and its label says the same count
		if (fs) {
			let rd = null;
			const t1 = Date.now();
			while (Date.now() - t1 < 60000) {
				rd = await p.evaluate(() => {
					const b = document.querySelector('.hudp button.spin.m-feature');
					if (!b) return null;
					const old = b.querySelector('.cnt.old');
					return { text: b.innerText.replace(/\s+/g, ' ').trim(), label: b.getAttribute('aria-label'), old: old ? { hidden: old.getAttribute('aria-hidden'), text: old.textContent, d: old.dataset.d } : null };
				});
				if (rd?.old) break;
				const gates = await p.evaluate(() => window.__reindeer.hud.gates()).catch(() => 0);
				if (gates > 0) await p.mouse.click(S.vp.width / 2, S.vp.height * 0.4).catch(() => {});
				await sleep(250);
			}
			const m = rd ? /^(\d+) OF (\d+)$/.exec(rd.text) : null;
			const lm = rd ? /Free spins: (\d+) of (\d+)$/.exec(rd.label ?? '') : null;
			check(!!rd?.old && rd.old.hidden === 'true' && rd.old.text === '' && !!m && !!lm && m[1] === lm[1] && m[2] === lm[2], `${name}: the free spins counter reads once ("${rd?.text}", label "${rd?.label}"; the outgoing face aria-hidden, its digit "${rd?.old?.d}" not text)`, rd);
		}
		if (SHOTS && fs && (S.name === 'portrait' || S.name === 'desk1610' || S.name === 'landscape')) await p.screenshot({ path: join(SHOTS, `${S.vp.width}x${S.vp.height}_freespins.png`) });
		await settle(p, S, 240000);
	}
	const e = errs.filter((x) => !/favicon/.test(x));
	check(e.length === 0, `${name}: no console errors`, e.slice(0, 5));
	await ctx.close();
}

/** social mode: the words, and the coins as Stake's table writes them (2026-11-21, game/currency.ts; Engine's review item
 *  [78]: with currency=XSC and currency=XGC the amounts read "10.00 SC" / "10.00 GC" and no "$" appears anywhere). The
 *  fixture RGS answers ?currency= (fixtures/fixtureRgs.ts). At 1440 x 900 the words of the HUD, the help menu and the
 *  Autoplay menu; at 390 x 844, 844 x 390 and 1440 x 900 the bar's amounts in each coin (the amount first, two decimals, a
 *  no-break space, the code), no "$" in the page's text, and each amount whole inside its field. */
async function socialWords(browser) {
	const S = SIZES.find((x) => x.name === 'desk1610');
	for (const [cur, code] of [['XSC', 'SC'], ['XGC', 'GC']]) {
		for (const Z of [S, SIZES.find((x) => x.name === 'portrait'), SIZES.find((x) => x.name === 'landscape')]) {
			const { ctx, p } = await boot(browser, Z, `&social=true&currency=${cur}`);
			await settle(p, Z);
			const tag = `social ${cur} ${Z.vp.width}x${Z.vp.height}`;
			const am = await p.evaluate((R) => {
				const out = {};
				for (const [k, sel] of Object.entries(R)) {
					const el = document.querySelector(sel);
					const v = el?.querySelector('.value');
					if (!el || !v) continue;
					const fb = el.getBoundingClientRect();
					const vb = v.getBoundingClientRect();
					out[k] = { text: v.textContent.trim(), left: Math.round((vb.left - fb.left) * 10) / 10, right: Math.round((fb.right - vb.right) * 10) / 10 };
				}
				return { out, dollar: document.body.innerText.includes('$') };
			}, READOUTS);
			const shown = Object.entries(am.out).filter(([, v]) => v.text);
			// (the space before the code is a no-break space, U+00A0: game/currency.ts AMOUNT_SPACE, wip/pricefit)
			const coin = new RegExp(`^[0-9,]+\\.\\d{2,4}\\u00a0${code}$`);
			check(shown.length >= 2 && shown.every(([k, v]) => k === 'win' ? v.text === '' || coin.test(v.text) : coin.test(v.text)), `${tag}: the bar's amounts read the amount first, two decimals, then ${code} (${shown.map(([k, v]) => `${k} "${v.text}"`).join(', ')})`, am.out);
			check(!am.dollar, `${tag}: no "$" anywhere in the page's text`);
			check(shown.every(([, v]) => v.left >= -0.5 && v.right >= -0.5), `${tag}: each amount whole inside its field`, am.out);
			if (Z === S && cur === 'XSC') {
				const w1 = await hudWords(p);
				await p.click(CONTROLS.menu);
				await sleep(500);
				const w2 = await hudWords(p);
				await p.click(CONTROLS.menu);
				await sleep(400);
				await p.click(CONTROLS.auto);
				await sleep(700);
				const w3 = await hudWords(p);
				const aria = await p.evaluate(() => [...document.querySelectorAll('.hudp [aria-label]')].map((e) => e.getAttribute('aria-label')));
				const all = [...w1, ...w2, ...w3];
				const bad = all.filter((w) => BANNED.test(w) || /[^\x20-\x7e\u00a0]/.test(w) || w.includes('$'));
				check(bad.length === 0, `social ${S.vp.width}x${S.vp.height}: the HUD, help menu and Autoplay menu words carry no restricted word, no symbol character and no "$"`, bad);
				const badAria = aria.filter((w) => BANNED.test(w));
				check(badAria.length === 0, `social: the HUD's spoken labels (aria) carry no restricted word`, badAria);
				console.log(`  INFO social: amount word "${await p.evaluate(() => document.querySelector('.hudp [data-hud="amount"] .label')?.textContent)}"`);
			}
			await ctx.close();
		}
	}
}

/** EVERY ROUND TURNS THE RING (2026-11-20, the probe host: rounds that started back to back with no gap missed it). A
 *  frame by frame record of the board's own spin count (game/boardPace.ts serial, through the dev hook's spinSerial),
 *  the Spin's data-run and the ring's angle; each spin start must show data-run 1 within 100 ms and the
 *  ring 10 degrees on within 400 ms. */
const spinRecStart = (p) =>
	p.evaluate(() => {
		const serial = () => window.__reindeer.spinSerial?.() ?? 0;
		const rec = (window.__spinRec = { on: true, rows: [] });
		const m = (el) => {
			const v = el && getComputedStyle(el).transform.match(/matrix\(([^)]+)\)/);
			if (!v) return 0;
			const q = v[1].split(',').map(parseFloat);
			return (Math.atan2(q[1], q[0]) * 180) / Math.PI;
		};
		let un = null;
		let last = null;
		const f = (t) => {
			if (!rec.on) return;
			const b = document.querySelector('.hudp button.spin');
			const a = b ? (((m(b.querySelector('.rw')) + m(b.querySelector('.rr'))) % 360) + 360) % 360 : 0;
			if (un === null) un = a;
			else {
				let d = a - last;
				if (d > 180) d -= 360;
				if (d < -180) d += 360;
				un += d;
			}
			last = a;
			rec.rows.push({ t, s: serial(), run: b?.dataset.run, a: un });
			requestAnimationFrame(f);
		};
		requestAnimationFrame(f);
	});
const spinRecStop = (p) => p.evaluate(() => { const r = window.__spinRec; r.on = false; return r.rows; });
function spinJudge(rows, tag, want, until = Infinity) {
	const starts = [];
	for (let i = 1; i < rows.length; i++) if (rows[i].s !== rows[i - 1].s && rows[i].t < until) starts.push(i);
	const missed = [];
	for (const i of starts) {
		const t0 = rows[i].t;
		// (within 100 ms, or on the first frame after the start when this machine's frames come further apart)
		const lim = Math.max(100, (rows[i + 1]?.t ?? t0) - t0 + 1);
		const runAt = rows.slice(i).find((r) => r.run === '1' && r.t - t0 <= lim);
		const on = rows.slice(i).find((r) => r.t - t0 >= 400) ?? rows[rows.length - 1];
		if (!runAt || on.a - rows[i].a < 10) missed.push(`${Math.round(t0)} ms: ${runAt ? `only ${Math.round(on.a - rows[i].a)} degrees` : 'no data-run 1 within 100 ms'}`);
	}
	const gaps = rows.slice(1).map((r, k) => r.t - rows[k].t).sort((x, y) => x - y);
	check(starts.length >= want && missed.length === 0, `rounds ${tag}: every spin start turns the ring (${starts.length} starts, ${missed.length} missed; frames every ${Math.round(gaps[Math.floor(gaps.length / 2)] ?? 0)} ms median)`, missed.slice(0, 4));
}

/** THE RING HOLDS STILL AT IDLE (2026-11-21, the probe host, on both live games: after an autoplay run's own last round
 *  and after a free spins round the ring went on turning with the key idle): from 1 s after the game is idle, the
 *  ring's turning layer (.rr, the driver's own: the idle hop on .rw moves by design) unchanged over 3 s, read every
 *  250 ms (so a loop cannot hide behind a whole turn) */
async function ringStill(p, tag) {
	await sleep(1000);
	const rd = () =>
		p.evaluate(() => {
			const el = document.querySelector('.hudp button.spin .rr');
			const v = el && getComputedStyle(el).transform.match(/matrix\(([^)]+)\)/);
			if (!v) return 0;
			const q = v[1].split(',').map(parseFloat);
			return (Math.atan2(q[1], q[0]) * 180) / Math.PI;
		});
	const a0 = await rd();
	let moved = 0;
	for (let i = 0; i < 12; i++) {
		await sleep(250);
		const a = await rd();
		moved = Math.max(moved, Math.abs((((a - a0 + 540) % 360) + 360) % 360 - 180));
	}
	const run = await p.evaluate(() => document.querySelector('.hudp button.spin')?.dataset.run);
	check(moved <= 0.05, `rounds ${tag}: once the key is idle the ring holds still over 3 s (its turning layer moved ${moved.toFixed(2)} degrees at most; data-run ${run})`);
}

async function everyRoundTurns(browser) {
	const S = { name: 'rounds', vp: { width: 1440, height: 900 }, phone: false, touch: false, family: 'desktop' };
	const { ctx, p, errs } = await boot(browser, S);
	if (await dockOnly(p, 'rounds: the lane ring turning each round')) return void (await ctx.close());
	await settle(p, S);
	await sleep(500);
	// AUTOPLAY, BACK TO BACK: Super Turbo, every round the no-win fixture (sticky), so each round starts as the one before ends
	for (let k = 0; k < 3; k++) {
		if ((await p.evaluate(() => +document.querySelector('.hudp button.spin').dataset.tb)) === 2) break;
		await p.click(CONTROLS.turbo);
		await sleep(300);
	}
	await p.evaluate(() => window.__reindeer.fixtures.next('no_win_1', true));
	await p.click(CONTROLS.auto);
	await sleep(700);
	await spinRecStart(p);
	await p.click('.am-ui.layer.modals .go'); // START: the run begins at once
	for (let i = 0; i < 300; i++) {
		const n = await p.evaluate(() => { const r = window.__spinRec.rows; return r.length ? r[r.length - 1].s - r[0].s : 0; });
		if (n >= 7) break;
		await sleep(100);
	}
	// (the press that ends the run is a Stop on the round then playing: it brakes the ring at once, as a stop should, so
	// a start within 450 ms before that press, or after it, is not judged)
	const stopAt = await p.evaluate(() => performance.now());
	await p.click(CONTROLS.spin).catch(() => {});
	await settle(p, S, 120000);
	await sleep(600);
	spinJudge(await spinRecStop(p), 'autoplay back to back (Super Turbo, no win)', 6, stopAt - 450);
	// AN AUTOPLAY RUN TO ITS OWN END (10 rounds, Super Turbo, no win): the ring still once the key is idle
	await p.click(CONTROLS.auto);
	await sleep(700);
	await p.locator('.am-ui.layer.modals button.chip').first().click().catch(() => {});
	await sleep(300);
	await p.click('.am-ui.layer.modals .go'); // START: the run begins at once
	await sleep(1500);
	for (let i = 0; i < 1200 && (await p.evaluate(() => !!document.querySelector('.hudp button.spin.m-auto'))); i++) await sleep(100);
	await settle(p, S, 120000);
	await ringStill(p, "after an autoplay run's own last round");
	await p.evaluate(() => window.__reindeer.fixtures.clear?.());
	for (let k = 0; k < 3; k++) {
		if ((await p.evaluate(() => +document.querySelector('.hudp button.spin').dataset.tb)) === 0) break;
		await p.click(CONTROLS.turbo);
		await sleep(300);
	}
	// A FEATURE ROUND: every free spin turns it
	if (process.env.SKIPFS !== '1') {
		await p.evaluate(() => window.__reindeer.fixtures.next('natural_free_spins'));
		await spinRecStart(p);
		await spinOnce(p);
		await settle(p, S, 240000);
		await sleep(600);
		spinJudge(await spinRecStop(p), 'a free spins round', 5);
		await ringStill(p, 'after a free spins round');
	}
	check(errs.filter((x) => !/favicon/.test(x)).length === 0, 'rounds: no console errors', errs.slice(0, 5));
	await ctx.close();
}

/** THE HOME POSE (section `home`, 2026-11-20, Corey on the ring coming to rest at a random angle: "Fix it";
 *  ui/hud/ringPlan.ts). The page records the ring every frame (its phase and its angle on the page, the two driven
 *  wrappers) while 10 rounds play; the dev hook's ringRounds says what each round planned (its kind, its brake and
 *  today's for the same end and its bound, its cruise speed change, its bounce, its planned rest); then two desktop
 *  hovers. Each round prints one line; the rule: 9 of 10 or better within 2 degrees of home, both hovers home (the angle drawn on the page just after the planned rest; a round the next spin
 *  began before its rest is judged by its plan), and no brake over today's + 150 ms (as planned, and as drawn: the first
 *  frame from which the drawn angle sits on the planned rest, less that frame's gap). */
const HOME_TOL = 2;
const HOME_EXTRA = 150;
const homeRecStart = (p) =>
	p.evaluate(() => {
		const rec = (window.__homeRec = { on: true, rows: [] });
		let un = null;
		let last = null;
		const f = (t) => {
			if (!rec.on) return;
			const n = window.__reindeer.ringNow?.();
			const a = n && n.angle !== null ? n.angle : null;
			if (a !== null) {
				if (un === null) un = a;
				else {
					let d = a - last;
					if (d > 180) d -= 360;
					if (d < -180) d += 360;
					un += d;
				}
				last = a;
			}
			rec.rows.push({ t, ph: n?.phase, a, u: un });
			requestAnimationFrame(f);
		};
		requestAnimationFrame(f);
	});
const homeRows = (p) => p.evaluate(() => window.__homeRec.rows.slice());
const homeRecStop = (p) => p.evaluate(() => (window.__homeRec.on = false));
const ringRounds = (p) => p.evaluate(() => window.__reindeer.ringRounds?.() ?? []);
const lastRingN = async (p) => {
	const r = await ringRounds(p);
	return r.length ? r[r.length - 1].n : 0;
};
const fold = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
/** one round's line: the plan (ringRounds) against the page's frames */
function homeJudge(R, rows, tag) {
	// (the plan's own fastest speed, as a share of the loop's: the cruise's steered speed or the brake's peak)
	const out = { tag, peak: Math.max(R.peak ?? 0, 1 + (R.steer ?? 0)), err: R.err, page: null, brake: R.brakeMs, today: R.todayMs, bound: R.boundMs, seen: null, steer: R.steer, pageSteer: null, over: R.over, pageOver: null, ended: R.ended, kind: `${R.kind}/${R.shape}` };
	if (R.restAt !== null) {
		// the angle drawn on the first frame at or after the planned rest
		const at = rows.find((r) => r.t >= R.restAt && r.a !== null);
		if (at && R.ended === 'rest') out.page = Math.abs(fold(at.a));
		// the brake as drawn: from the planned brake start to the first of the frames that sit on the planned rest (within
		// 0.1 degrees) up to the first frame at or after the planned rest; if that frame is not on it (late), the first
		// frame after it that is (within 400 ms; past the rest the idle hop moves the ring again, so no later); its slack
		// is that frame's own gap to the one before
		const near = (r) => r.a !== null && Math.abs(fold(r.a - R.rest)) < 0.1;
		const k = rows.findIndex((r) => r.t >= R.restAt);
		let j = -1;
		if (k >= 0 && near(rows[k])) {
			j = k;
			while (j > 0 && rows[j - 1].t >= R.brakeAt && near(rows[j - 1])) j--;
		} else if (k >= 0) {
			for (let i = k; i < rows.length && rows[i].t <= R.restAt + 400; i++)
				if (near(rows[i])) {
					j = i;
					break;
				}
		}
		if (j >= 0 && R.ended === 'rest') {
			out.seen = rows[j].t - R.brakeAt;
			out.slack = j > 0 ? rows[j].t - rows[j - 1].t : 0;
		}
		// THE BOUNCE as drawn: the farthest past the rest from the end of the way home (40 ms early) to the rest (a hover's
		// way back: the deepest short of home, its soft settle)
		if (R.shape === 'back' && R.ended === 'rest') {
			const B = rows.filter((r) => r.t >= R.startAt && r.t <= R.restAt + 5 && r.a !== null);
			if (B.length) out.pageOver = Math.max(0, -Math.min(...B.map((r) => fold(r.a - R.rest))));
		} else if (R.over && R.bounceMs && R.ended === 'rest') {
			const B = rows.filter((r) => r.t >= R.restAt - R.bounceMs - 40 && r.t <= R.restAt + 5 && r.a !== null);
			if (B.length) out.pageOver = Math.max(...B.map((r) => fold(r.a - R.rest)));
		}
	}
	// the cruise as drawn: frame to frame speed against the loop's, from the wind-up's end to the brake
	if (R.brakeAt !== null && R.kind !== 'hover') {
		// (only where a frame cannot carry the ring past 150 degrees: further apart, the turn between two frames is
		// ambiguous and the speed read from it means nothing)
		const cr = rows.filter((r) => r.t > R.upEnd + 20 && r.t < R.brakeAt - 5 && r.u !== null);
		let m = 0;
		let far = false;
		for (let i = 1; i < cr.length; i++) {
			const dt = cr[i].t - cr[i - 1].t;
			if (dt * R.v * 1.4 > 150) far = true;
			if (dt > 0) m = Math.max(m, Math.abs((cr[i].u - cr[i - 1].u) / dt / R.v - 1));
		}
		if (cr.length > 2) out.pageSteer = far ? 'far' : m;
	}
	return out;
}
/** THE WAY BACK as drawn (2026-11-21, Corey: "if you go off the hover over without pressing spin ... I would prefer it
 *  goes backwards in that one scenario"): a hover's way home from the pointer's leave (its record's startAt, the angle
 *  it left at its `from`) to its rest, on the page's frames: never above where it left (1 degree for the frames), the
 *  travel about the hover's angle (the way back plus twice the settle, 6 degrees for the frames; never near 360 less
 *  it), then home and still over the 500 ms after the rest. */
function hoverBack(R, rows) {
	const out = { from: R.from ?? null, top: null, travel: null, off: null, moved: null, ms: R.restAt !== null ? R.restAt - R.startAt : null, ok: false };
	if (R.shape !== 'back' || R.from === null || R.from === undefined || R.restAt === null) return out;
	const W = rows.filter((r) => r.t >= R.startAt && r.t <= R.restAt + 20 && r.a !== null && r.u !== null);
	const after = rows.filter((r) => r.t >= R.restAt + 20 && r.t <= R.restAt + 520 && r.a !== null);
	if (W.length < 2 || after.length < 2) return out;
	out.top = Math.max(...W.map((r) => fold(r.a)));
	// (from where it left, R.from, to the first frame after the leave, then frame to frame)
	let travel = Math.abs(R.from - fold(W[0].a));
	for (let i = 1; i < W.length; i++) travel += Math.abs(W[i].u - W[i - 1].u);
	out.travel = travel;
	out.off = Math.max(...after.map((r) => Math.abs(fold(r.a))));
	out.moved = Math.max(...after.map((r) => fold(r.a - after[0].a))) - Math.min(...after.map((r) => fold(r.a - after[0].a)));
	const settle = R.over ?? 0;
	out.ok = R.ended === 'rest' && out.top <= R.from + 1 && Math.abs(travel - R.from - 2 * settle) <= 6 && travel < 180 && out.off <= HOME_TOL && out.moved <= 0.05;
	return out;
}

/** every ring round of the section has a plan that ended at home (none with no plan, but one whose face was rebuilt
 *  under it: its drawing went with the old face), and the backstop never had to bring a loop home */
async function homeEnds(p, method, nStart) {
	const all = (await ringRounds(p)).filter((r) => r.n > nStart);
	const bad = all.filter((r) => r.kind === null && r.ended !== 'face');
	const off = all.filter((r) => r.kind !== null && r.ended === 'rest' && r.err !== null && r.err > HOME_TOL);
	const wd = (await p.evaluate(() => window.__reindeer.ringNow?.()))?.watchdogs ?? null;
	check(bad.length === 0 && off.length === 0, `home ${method}: every one of the section's ${all.length} ring rounds had a plan to home (${bad.length} without, ${off.length} off home)`, [...bad, ...off].map((r) => `#${r.n} ${r.kind}/${r.shape} ended ${r.ended}`));
	check(wd === 0, `home ${method}: the backstop never had to bring a loop home (${wd})`);
}
const homeLine = (method, i, o, of = 10) =>
	console.log(
		`  HOME ${method} ${String(i).padStart(2)}/${of} ${o.tag.padEnd(22)} rest ${o.err === null ? '?' : o.err.toFixed(2)} deg from home (page ${o.page === null ? (o.ended === 'next' ? 'none: the next spin began first' : '?') : o.page.toFixed(2)}), overshoot ${o.over === null ? '?' : o.over.toFixed(1)} deg (page ${o.pageOver === null ? '?' : o.pageOver.toFixed(1)}), ${o.today === null ? `way home ${Math.round(o.brake ?? 0)} ms (page ${o.seen === null ? '?' : Math.round(o.seen)} ms)` : `brake ${o.brake === null ? '?' : Math.round(o.brake)} ms against today's ${Math.round(o.today)} (${o.brake === null ? '?' : `${o.brake - o.today >= 0 ? '+' : ''}${Math.round(o.brake - o.today)}`}, bound ${o.bound === null ? '?' : Math.round(o.bound)}; page ${o.seen === null ? '?' : Math.round(o.seen)} ms)`}, peak ${o.peak.toFixed(2)} x the loop's (planned), cruise speed change ${Math.round(100 * (o.steer ?? 0))} % (page ${o.pageSteer === null ? '?' : o.pageSteer === 'far' ? '? frames too far apart' : Math.round(100 * o.pageSteer) + ' %'}), ${o.kind}`,
	);

async function setTurboR(p, want) {
	for (let k = 0; k < 3; k++) {
		if ((await p.evaluate(() => +document.querySelector('.hudp button.spin').dataset.tb)) === want) return;
		await p.click(CONTROLS.turbo);
		await sleep(300);
	}
}

async function homePose(browser) {
	const methods = (process.env.HOME_METHODS || 'steer').split(',').filter(Boolean);
	for (const method of methods) {
		const S = { name: 'home', vp: { width: 1440, height: 900 }, phone: false, touch: false, family: 'desktop' };
		const { ctx, p, errs } = await boot(browser, S);
		if (await dockOnly(p, 'home: the lane ring coming to rest on its home pose')) {
			await ctx.close();
			return;
		}
		await settle(p, S);
		await sleep(500);
		// (the pointer off the Spin: a desktop hover turns the ring itself since 2026-11-20; the hover rounds below put it on)
		await p.mouse.move(4, 4);
		const got = await p.evaluate((m) => window.__reindeer.ringMethod?.(m) ?? null, method);
		if (got !== method) {
			check(false, `home ${method}: the dev hook's ringMethod took the method`, got);
			await ctx.close();
			continue;
		}
		await p.evaluate(() => window.__reindeer.fixtures.next('no_win_1', true));
		await homeRecStart(p);
		const nStart = await lastRingN(p);
		const judged = [];
		// THE IDLE KEY (2026-11-21, the probe host: after an autoplay run's last round and after a free spins round the
		// ring went on turning at rest): 1 s after the game is idle the ring is home, and still over the next 3 s
		const idleHome = async (what) => {
			await sleep(1000);
			const a = await p.evaluate(() => window.__reindeer.ringNow?.());
			await sleep(3000);
			const b = await p.evaluate(() => window.__reindeer.ringNow?.());
			const off = a && a.angle !== null ? Math.abs(fold(a.angle)) : null;
			const moved = a && b && a.angle !== null && b.angle !== null ? Math.abs(fold(b.angle - a.angle)) : null;
			console.log(`  HOME ${method} idle after ${what}: ${off === null ? '?' : off.toFixed(2)} deg from home 1 s after idle, moved ${moved === null ? '?' : moved.toFixed(2)} deg over the next 3 s, phase ${a?.phase}`);
			check(off !== null && off <= HOME_TOL && moved !== null && moved <= 0.05 && a.phase === 'rest', `home ${method}: 1 s after ${what} the ring is home (${off === null ? '?' : off.toFixed(2)} deg, phase ${a?.phase}) and still over 3 s (${moved === null ? '?' : moved.toFixed(2)} deg)`);
		};
		const restWait = async () => {
			await settle(p, S, 120000);
			for (let i = 0; i < 40 && (await p.evaluate(() => window.__reindeer.ringNow?.().phase)) !== 'rest'; i++) await sleep(100);
			await sleep(300);
		};
		const one = async (tag, turbo, haltMs = null) => {
			await setTurboR(p, turbo);
			const n0 = await lastRingN(p);
			await p.click(CONTROLS.spin);
			// (the stop press as the key's own click, at once: Playwright's click waits for the key to hold still, and the
			// key pops at the press, so the probe's stop came only after the round in this Mac's first smoke runs)
			let stopAt = null;
			if (haltMs !== null) {
				await sleep(haltMs);
				stopAt = await p.evaluate(() => {
					document.querySelector('.hudp button.spin')?.click();
					return performance.now();
				});
			}
			await restWait();
			const R = (await ringRounds(p)).filter((r) => r.n > n0);
			if (!R.length) check(false, `home ${method} ${tag}: the ring recorded the round`);
			else judged.push([R[R.length - 1], stopAt === null ? tag : `${tag} (${Math.round(stopAt - R[R.length - 1].startAt)} in)`]);
		};
		await one('regular', 0);
		await one('regular', 0);
		await one('regular', 0);
		await one('super turbo', 2);
		await one('super turbo', 2);
		await one('stop at 300 ms', 0, 300);
		await one('stop at 900 ms', 0, 900);
		// TWO HOVER ROUNDS (a desktop pointer): over the key 800 ms, then 300 ms (the quarter turn forward, cut short), and
		// off it with no press: THE WAY BACK (2026-11-21), back the way it came to home and a soft settle
		const hovers = [];
		await p.mouse.move(4, 4);
		await sleep(500);
		for (const ms of [800, 300]) {
			const n1 = await lastRingN(p);
			const b = await p.evaluate(() => {
				const r = document.querySelector('.hudp button.spin').getBoundingClientRect();
				return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
			});
			await p.mouse.move(b.x, b.y, { steps: 4 });
			await sleep(ms);
			await p.mouse.move(4, 4, { steps: 4 });
			await sleep(1200);
			const H = (await ringRounds(p)).filter((r) => r.n > n1 && r.kind === 'hover');
			if (!H.length) check(false, `home ${method} hover ${ms} ms: the ring recorded the hover's way home`);
			else hovers.push([H[H.length - 1], `hover ${ms} ms`]);
		}
		// A PRESS DURING A HOVER: over the key 300 ms, then the press where the pointer is: forward into the spin from the
		// hover's angle (no way back first), home after the round
		const pressHover = { R: null, back: 0, fwd: null };
		{
			await setTurboR(p, 0);
			const n2 = await lastRingN(p);
			const b = await p.evaluate(() => {
				const r = document.querySelector('.hudp button.spin').getBoundingClientRect();
				return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
			});
			await p.mouse.move(b.x, b.y, { steps: 4 });
			await sleep(300);
			await p.mouse.down();
			await p.mouse.up();
			await restWait();
			await p.mouse.move(4, 4, { steps: 4 });
			await sleep(500);
			const R2 = (await ringRounds(p)).filter((r) => r.n > n2);
			pressHover.back = R2.filter((r) => r.kind === 'hover').length;
			pressHover.R = R2.filter((r) => r.kind !== 'hover').pop() ?? null;
		}
		// A SHORT AUTOPLAY RUN (Regular): three rounds back to back judged; the run's ending Stop press brakes the fourth
		await setTurboR(p, 0);
		const n0 = await lastRingN(p);
		await p.click(CONTROLS.auto);
		await sleep(700);
		await p.click('.am-ui.layer.modals .go'); // START: the run begins at once
		for (let i = 0; i < 600; i++) {
			const R = (await ringRounds(p)).filter((r) => r.n > n0);
			if (R.length >= 4) break;
			await sleep(100);
		}
		await p.click(CONTROLS.spin).catch(() => {});
		await restWait();
		await idleHome("the autoplay run's end");
		const A = (await ringRounds(p)).filter((r) => r.n > n0);
		A.slice(0, 3).forEach((r, k) => judged.push([r, `autoplay ${k + 1} of 3`]));
		await homeRecStop(p);
		const rows = await homeRows(p);
		const res = judged.map(([R, tag], i) => {
			const o = homeJudge(R, rows, tag);
			homeLine(method, i + 1, o);
			return o;
		});
		const hres = hovers.map(([R, tag], i) => {
			const o = homeJudge(R, rows, tag);
			homeLine(method, i + 1, o, 2);
			return o;
		});
		// THE WAY BACK as drawn, each hover
		const hback = hovers.map(([R, tag]) => {
			const o = hoverBack(R, rows);
			const f = (x, d = 1) => (x === null ? '?' : x.toFixed(d));
			console.log(`  HOME ${method} ${tag} way back: left at ${f(o.from)} deg past home, back to home in ${o.ms === null ? '?' : Math.round(o.ms)} ms (settle ${f(R.over ?? null)} deg short), highest on the way ${f(o.top)} deg, travel ${f(o.travel)} deg (a turn on round would be ${o.from === null ? '?' : (360 - o.from).toFixed(0)}), then ${f(o.off, 2)} deg from home and moved ${f(o.moved, 3)} deg over 500 ms, ${R.kind}/${R.shape}`);
			return [tag, o];
		});
		check(hback.length === 2 && hback.every(([, o]) => o.ok), `home ${method}: both hovers left with no press go BACK to home (never above where they left, travel about the hover's angle, not 360 less it) and are home and still after`, hback.map(([tag, o]) => `${tag} from ${o.from?.toFixed(1)} top ${o.top?.toFixed(1)} travel ${o.travel?.toFixed(1)} off ${o.off?.toFixed(2)} moved ${o.moved?.toFixed(3)}`));
		// THE PRESS DURING A HOVER as drawn: from the press to the round's rest, the ring's net way forward
		{
			const R = pressHover.R;
			let fwd = null;
			if (R && R.restAt !== null) {
				const a = rows.filter((r) => r.t >= R.startAt && r.u !== null)[0];
				const z = rows.filter((r) => r.t >= R.restAt + 20 && r.u !== null)[0];
				if (a && z) fwd = z.u - a.u;
			}
			const o = R ? homeJudge(R, rows, 'press during a hover') : null;
			console.log(`  HOME ${method} press during a hover: ${R ? `${R.kind}/${R.shape}, forward ${fwd === null ? '?' : fwd.toFixed(1)} deg from the press to the rest, rest ${o.err === null ? '?' : o.err.toFixed(2)} deg from home (page ${o.page === null ? '?' : o.page.toFixed(2)}), ways back recorded ${pressHover.back}` : 'no round recorded'}`);
			check(!!R && pressHover.back === 0 && fwd !== null && fwd >= 300 && o.err !== null && o.err <= HOME_TOL && (o.page === null || o.page <= HOME_TOL), `home ${method}: a press during a hover goes FORWARD into the spin (${fwd === null ? '?' : fwd.toFixed(0)} deg forward to its rest, ${pressHover.back} ways back) and rests home`);
		}
		if (A[3]) {
			const o = homeJudge(A[3], rows, "autoplay's Stop press");
			console.log(`  INFO home ${method}: the run's ending Stop press (not judged): rest ${o.err === null ? '?' : o.err.toFixed(2)} deg, page ${o.page === null ? '?' : o.page.toFixed(2)}, brake ${Math.round(o.brake ?? 0)} ms against today's ${Math.round(o.today ?? 0)}, ${o.kind}`);
		}
		const within = res.filter((o) => (o.page ?? o.err) !== null && (o.page ?? o.err) <= HOME_TOL && (o.err ?? 99) <= HOME_TOL).length;
		const gaps = rows.slice(1).map((r, k) => r.t - rows[k].t).sort((x, y) => x - y);
		const med = gaps[Math.floor(gaps.length / 2)] ?? 0;
		// (half a ms for the sums' rounding; the brake as drawn is seen on the first frame at its rest, so that frame's gap
		// is its slack)
		// (each brake against its own bound from the plan: today's + 150 ms, a stop press today's + 250 ms, the bounce inside)
		const lim = (o) => o.bound ?? o.today + HOME_EXTRA;
		const over = res.filter((o) => o.brake !== null && (o.brake > lim(o) + 0.5 || (o.seen !== null && o.seen - (o.slack ?? 0) > lim(o) + 1)));
		const worst = Math.max(...res.filter((o) => o.brake !== null).map((o) => o.brake - o.today));
		const worstSeen = Math.max(...res.filter((o) => o.seen !== null).map((o) => o.seen - o.today));
		check(res.length === 10 && within >= 9, `home ${method}: ${within} of ${res.length} rounds rest within ${HOME_TOL} degrees of home (9 of 10 needed; frames every ${Math.round(med)} ms median)`, res.map((o) => `${o.tag} ${o.err?.toFixed(2)} / ${o.page?.toFixed(2)}`));
		check(res.length === 10 && over.length === 0, `home ${method}: no brake over its bound, today's + ${HOME_EXTRA} ms or a stop press's today's + 250 ms (worst ${worst >= 0 ? '+' : ''}${Math.round(worst)} ms as planned, ${Number.isFinite(worstSeen) ? `${worstSeen >= 0 ? '+' : ''}${Math.round(worstSeen)}` : '?'} ms as drawn with frames every ${Math.round(med)} ms)`, over.map((o) => `${o.tag} ${Math.round(o.brake)} / page ${Math.round(o.seen ?? 0)} against ${Math.round(o.today)}`));
		const hin = hres.filter((o) => o.err !== null && o.err <= HOME_TOL && (o.page === null || o.page <= HOME_TOL)).length;
		check(hovers.length === 2 && hin === 2, `home ${method}: after both hovers the ring is home within ${HOME_TOL} degrees (${hin} of ${hovers.length})`, hres.map((o) => `${o.tag} ${o.err?.toFixed(2)} / ${o.page?.toFixed(2)}`));
		const allO = [...res, ...hres].filter((o) => o.over !== null && o.over > 0);
		console.log(`  INFO home ${method}: overshoot planned ${Math.min(...allO.map((o) => o.over)).toFixed(1)} to ${Math.max(...allO.map((o) => o.over)).toFixed(1)} deg; drawn ${allO.filter((o) => o.pageOver !== null).map((o) => o.pageOver.toFixed(1)).join(', ') || '?'}`);
		await p.evaluate(() => window.__reindeer.fixtures.clear?.());
		// A FREE SPINS ROUND, to its wrap-up and the return to the base game
		if (process.env.SKIPFS !== '1') {
			await p.evaluate(() => window.__reindeer.fixtures.next('natural_free_spins'));
			await spinOnce(p);
			await settle(p, S, 240000);
			await idleHome('the free spins round');
		}
		await homeEnds(p, method, nStart);
		check(errs.filter((x) => !/favicon/.test(x)).length === 0, `home ${method}: no console errors`, errs.slice(0, 5));
		await ctx.close();
	}
}

/** THE HUD UNDER THE BONUS ROUND'S CARDS (section `cards`, 2026-11-20, Manticore Unleashed's rule from its harsh review
 *  2026-11-17 m8): the entry and the wrap-up (the LED back board's scenes, ui/RoundCard.svelte's catch) keep the HUD on
 *  screen, disabled: the layer hud-held and inert (not hud-off), BALANCE and WIN readable (text, opacity 1), every key on
 *  screen, none of them focusable, and the Spin's own spot takes the card's press (button.catch), not the Spin; on the
 *  wrap-up WIN holds the round's total, the amount the card counts to (stateBet.winBookEventAmount against the board's
 *  card amount, its digits). Upright phone 390 x 844, sideways phone 844 x 390, desktop 1440 x 900; natural_free_spins, SKIP TO RESULT
 *  from the first free spin to reach the wrap-up sooner. */
async function cardsHud(browser) {
	const SIZES_CARDS = [
		{ name: 'cards-portrait', vp: { width: 390, height: 844 }, touch: true, phone: true, family: 'portrait', ownPress: true },
		{ name: 'cards-landscape', vp: { width: 844, height: 390 }, touch: true, phone: true, family: 'landscape', ownPress: true },
		{ name: 'cards-desktop', vp: { width: 1440, height: 900 }, touch: false, phone: false, family: 'desktop', ownPress: true, skip: true },
		// (2026-11-21, the WIN odometer: reduced motion rolls nothing; the capped wrap-up hides the bar, nothing rolls)
		{ name: 'cards-reduced', vp: { width: 1440, height: 900 }, touch: false, phone: false, family: 'desktop', ownPress: true, reduced: true },
		{ name: 'cards-max', vp: { width: 390, height: 844 }, touch: true, phone: true, family: 'portrait', ownPress: true, fixture: 'max_win', capped: true },
	];
	// THE WIN ODOMETER'S WATCH (2026-11-21): from the entry's press on, every frame while the wrap-up card is up, in the
	// page: the board's show (its clock, its count's start and end), the odometer's own read and the WIN readout's box.
	// `skip`: the card is pressed 40 % into its count (the press lands it, landCard).
	const armOdo = (p, skip) =>
		p.evaluate((skip) => {
			const W = (window.__odoWatch = { samples: [], press: null, pops0: window.__reindeer.hud.winOdometer().pops, on: true });
			const tick = () => {
				if (!W.on) return;
				if (document.querySelector('[data-round-card="outro"]')) {
					const s = window.__reindeer.scoreboard?.()?.show;
					const o = window.__reindeer.hud.winOdometer();
					const v = document.querySelector('.hudp [data-hud="win"] .value');
					const st = v?.closest('.stat');
					if (skip && !W.press && s && s.kind === 'total' && o.mode === 'roll' && s.t >= s.countStart + 0.4 * (s.countEnd - s.countStart) && s.t < s.countEnd) {
						document.querySelector('button.catch:not([data-wheel-gate])')?.click();
						W.press = { t: s.t, at: performance.now(), countEnd: s.countEnd };
					}
					W.samples.push({
						at: Math.round(performance.now()),
						kind: s?.kind ?? null,
						t: s?.t ?? null,
						cs: s?.countStart ?? null,
						ce: s?.countEnd ?? null,
						skipped: !!s?.skipped,
						finalStr: s?.finalStr ?? null,
						mode: o.mode,
						reading: o.reading,
						text: o.text,
						hudT: o.t,
						doneT: o.doneT,
						data: v?.getAttribute('data-odo') ?? null,
						windows: v ? v.querySelectorAll('.od').length : -1,
						shown: v ? v.textContent : null,
						w: v ? Math.round(v.getBoundingClientRect().width * 100) / 100 : null,
						ow: v ? v.offsetWidth : null,
						pop: !!st?.classList.contains('odo-pop'),
						popAnim: st ? st.getAnimations().some((a) => a.animationName === 'wb-pop-cell') : false,
						aria: st?.getAttribute('aria-label') ?? null,
					});
					if (W.samples.length > 4000) W.samples.shift();
				}
				requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		}, skip);
	const readOdo = (p) =>
		p.evaluate(() => {
			const W = window.__odoWatch;
			W.on = false;
			return { samples: W.samples, press: W.press, pops: window.__reindeer.hud.winOdometer().pops - W.pops0, now: window.__reindeer.hud.winOdometer() };
		});
	const digitsOf = (t) => String(t ?? '').replace(/[^0-9]/g, '');
	/** the odometer judged from its watch */
	const judgeOdo = (W, S, tag) => {
		const X = W.samples.filter((x) => x.kind === 'total' && x.t !== null);
		console.log(`  INFO ${tag}: ${X.length} frames of the wrap-up sampled; modes ${[...new Set(X.map((x) => x.mode))].join(', ')}; the count ${X[0]?.cs} to ${X[X.length - 1]?.ce} ms${W.press ? `, pressed at ${Math.round(W.press.t)} ms` : ''}; the odometer went plain at ${W.now.doneT} ms; pops ${W.pops}`);
		if (S.capped) {
			const on = W.samples.filter((x) => x.mode !== 'off' || x.data !== null || x.windows > 0 || x.pop);
			check(X.length > 0 && on.length === 0 && W.pops === 0, `${tag}: the capped wrap-up (the bar hidden) never runs the odometer (${on.length} of ${W.samples.length} frames with it on, ${W.pops} pops)`, on.slice(0, 3));
			return;
		}
		check(X.length >= 10, `${tag}: the wrap-up's frames sampled (${X.length})`);
		if (X.length < 10) return;
		const text = X.find((x) => x.text)?.text ?? '';
		const ce = X[X.length - 1].ce;
		check(!!text && digitsOf(text) === digitsOf(X[0].finalStr), `${tag}: the odometer lands on the card's total (${text} against the board's ${X[0].finalStr})`);
		// never the total, never plain, before the count's end (the show's clock as the page read it; the readout reads the
		// same clock, never ahead of it)
		const early = X.filter((x) => x.t < x.ce && (x.mode === 'done' || x.reading === x.text || (x.shown && x.mode !== 'roll' && x.shown === x.text)));
		check(early.length === 0, `${tag}: WIN never shows the total before the count ends (${early.length} frames)`, early.slice(0, 3));
		// plain on the total within two frames of the end (or of the press)
		const iEnd = X.findIndex((x) => x.t >= x.ce);
		const late = iEnd < 0 ? null : X.slice(iEnd + 2).filter((x) => x.mode !== 'done');
		check(iEnd >= 0 && late && late.length === 0 && X[Math.min(X.length - 1, iEnd + 2)].mode === 'done', `${tag}: WIN goes plain on the total within two frames of the count's end (the first frame at the end ${iEnd >= 0 ? X[iEnd].mode : 'none'}, ${late?.length ?? '?'} later frames not plain)`, late?.slice(0, 3));
		// (two of the page's own frames at the end, in the board's ms, at least 50)
		const steps = X.slice(Math.max(1, iEnd - 3), iEnd + 4).map((x, i, a) => (i ? x.t - a[i - 1].t : 0));
		const twoFrames = Math.max(50, 2 * Math.max(0, ...steps));
		const after = X.filter((x) => x.mode === 'done');
		check(after.length > 0 && after.every((x) => x.windows === 0 && x.shown === x.text), `${tag}: after the lock no digit window is left, the readout reads ${text}`, after.filter((x) => x.windows !== 0 || x.shown !== x.text).slice(0, 3));
		// the width: one width from the first odometer frame to the last (the pop's own frames aside)
		const sized = X.filter((x) => x.mode !== 'off' && !x.pop && !x.popAnim && x.w !== null);
		const ws = sized.map((x) => x.w);
		const ows = [...new Set(sized.map((x) => x.ow))];
		const spread = ws.length ? Math.max(...ws) - Math.min(...ws) : Infinity;
		// (the layout width, offsetWidth, is the drawn width rounded to a whole px: a readout steady to 0.25 px whose width
		// stands near a half px reads two neighboring whole numbers. The probe host at 390 x 844 on 930a7748: 51.48 to 51.55
		// px drawn, layout widths 52 and 51. So the layout widths may differ by that one rounding step, no more)
		const owSpread = ows.length ? Math.max(...ows) - Math.min(...ows) : Infinity;
		check(ws.length >= 5 && spread <= 0.25 && owSpread <= 1, `${tag}: the readout's width does not move through the roll and the landing (${ws.length} frames, ${spread.toFixed(2)} px apart; layout widths ${ows.join(', ')})`, { min: Math.min(...ws), max: Math.max(...ws), ows });
		check(X.every((x) => x.mode === 'off' || (x.aria ?? '').includes(text)), `${tag}: the readout's aria name carries the total throughout (${X.find((x) => x.aria)?.aria})`, X.filter((x) => x.mode !== 'off' && !(x.aria ?? '').includes(text)).slice(0, 2));
		if (S.reduced) {
			const moved = X.filter((x) => x.mode === 'roll' || x.windows > 0);
			check(moved.length === 0 && W.pops === 0 && X.some((x) => x.mode === 'still'), `${tag}: reduced motion: nothing rolls (${moved.length} frames with windows), the total's zeros until the end, no pop (${W.pops})`, moved.slice(0, 2));
			const zeros = X.filter((x) => x.mode === 'still' && x.shown !== text.replace(/[0-9]/g, '0'));
			check(zeros.length === 0, `${tag}: reduced motion: the readout reads the total's zeros while the card counts`, zeros.slice(0, 2));
			return;
		}
		const rolled = X.filter((x) => x.mode === 'roll');
		check(rolled.length >= 5 && rolled.every((x) => x.windows === digitsOf(text).length), `${tag}: the digits roll in a window each while the card counts (${rolled.length} frames, ${rolled[0]?.windows} windows for ${digitsOf(text).length} digits)`);
		check(W.pops === 1 && X.some((x) => x.pop), `${tag}: the landing pops once (${W.pops})`);
		if (S.skip) {
			check(!!W.press && X[X.length - 1].skipped, `${tag}: the card was pressed during its count and landed (skipped)`, W.press);
			if (W.press) {
				const i = X.findIndex((x) => x.at >= W.press.at && x.ce <= W.press.t + 1);
				check(i >= 0 && X.slice(i + 2).every((x) => x.mode === 'done') && W.now.doneT !== null && W.now.doneT <= W.press.t + twoFrames, `${tag}: the press lands the readout at once (plain at ${W.now.doneT} ms, pressed at ${Math.round(W.press.t)} ms, the count was to end at ${W.press.countEnd}; two frames ${Math.round(twoFrames)} ms)`);
			}
		} else check(W.now.doneT !== null && W.now.doneT >= ce && W.now.doneT - ce <= twoFrames, `${tag}: the readout went plain at the count's end (${W.now.doneT} against ${ce} ms; two frames ${Math.round(twoFrames)} ms)`);
	};
	const read = (p) =>
		p.evaluate((C) => {
			const layer = document.querySelector('.am-ui.layer:not(.modals)');
			const op = (e) => {
				let o = 1;
				for (let x = e; x && x !== document.body; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity);
				return o;
			};
			const rd = (sel) => {
				const e = document.querySelector(sel);
				return e ? { text: e.textContent.replace(/\s+/g, ' ').trim(), op: Math.round(op(e) * 100) / 100 } : null;
			};
			const keys = Object.entries(C).map(([k, sel]) => {
				const e = document.querySelector(sel);
				return { k, there: !!e, op: e ? Math.round(op(e) * 100) / 100 : 0 };
			});
			const focusable = [...(layer?.querySelectorAll('button, [tabindex]') ?? [])].filter((e) => {
				e.focus();
				return document.activeElement === e;
			}).length;
			const spin = document.querySelector(C.spin);
			const b = spin?.getBoundingClientRect();
			const hit = b ? document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) : null;
			const show = window.__reindeer.scoreboard?.()?.show;
			return {
				held: !!layer?.classList.contains('hud-held'),
				off: !!layer?.classList.contains('hud-off'),
				inert: !!layer?.inert,
				balance: rd('.hudp [data-hud="balance"]'),
				win: rd('.hudp [data-hud="win"]'),
				keys,
				focusable,
				spinHit: hit ? (hit.closest('.hudp') ? 'hud' : hit.matches('button.catch') ? 'catch' : hit.tagName.toLowerCase()) : null,
				card: document.querySelector('[data-round-card]')?.getAttribute('data-round-card') ?? null,
				show: show ? { kind: show.kind, phase: show.phase, amount: show.amount ?? null } : null,
				hudWin: window.__reindeer.hud.win(),
			};
		}, CONTROLS);
	const waitCard = async (p, kind, ms) => {
		const t0 = Date.now();
		while (Date.now() - t0 < ms) {
			const st = await p
				.evaluate((kind) => {
					document.querySelector('button[data-wheel-gate]')?.click();
					if (kind === 'outro' && !document.querySelector('[data-round-card]')) {
						const yes = document.querySelector('[data-skip="yes"]');
						if (yes) yes.click();
						else {
							const b = document.querySelector('[data-skip="button"]');
							if (b && !b.disabled && parseFloat(getComputedStyle(b).opacity) > 0.5) b.click();
						}
					}
					const s = window.__reindeer.scoreboard?.()?.show;
					return !!document.querySelector(`[data-round-card="${kind}"]`) && !!s && s.phase === 'waits';
				}, kind)
				.catch(() => false);
			if (st) return true;
			await sleep(250);
		}
		return false;
	};
	const judge = (r, tag) => {
		check(r.held && !r.off && r.inert, `${tag}: the HUD layer is held (on screen, inert), not faded`, { held: r.held, off: r.off, inert: r.inert });
		check(!!r.balance?.text && r.balance.op >= 0.99 && !!r.win?.text && r.win.op >= 0.99, `${tag}: BALANCE (${r.balance?.text}) and WIN (${r.win?.text}) readable`, { balance: r.balance, win: r.win });
		// (a key's disabled look may dim it a little; a faded HUD is 0)
		const gone = r.keys.filter((k) => !k.there || k.op <= 0.2);
		check(gone.length === 0, `${tag}: every key on screen under the card, not faded out`, gone);
		check(r.focusable === 0 && r.spinHit === 'catch', `${tag}: no HUD control can take focus and the Spin's spot takes the card's press (${r.spinHit})`, { focusable: r.focusable, spinHit: r.spinHit });
	};
	for (const S of SIZES_CARDS) {
		const tag = `cards ${S.vp.width}x${S.vp.height}`;
		const { ctx, p, errs } = await boot(browser, S);
		await settle(p, S);
		await p.evaluate((f) => window.__reindeer.fixtures.next(f), S.fixture ?? 'natural_free_spins');
		await spinOnce(p);
		const intro = await waitCard(p, 'intro', 180000);
		check(intro, `${tag}: the entry card is up and waiting for the press`);
		if (intro) {
			await sleep(900);
			judge(await read(p), `${tag} entry`);
		}
		await p.evaluate(() => document.querySelector('button.catch:not([data-wheel-gate])')?.click());
		await armOdo(p, !!S.skip);
		const outro = await waitCard(p, 'outro', 300000);
		check(outro, `${tag}: the wrap-up card is up and waiting for the press`);
		if (outro) {
			await sleep(900);
			const r = await read(p);
			judgeOdo(await readOdo(p), S, `${tag} wrap-up odometer`);
			// (the capped wrap-up hides the bar: Corey 2026-11-20, "Yes, hide the bar on the max win screen.")
			if (!S.capped) {
				judge(r, `${tag} wrap-up`);
				// (the board's card amount is the formatted string it draws; WIN's own text carries the same digits)
				const digits = (t) => String(t ?? '').replace(/[^0-9]/g, '');
				check(r.show?.kind === 'total' && r.hudWin > 0 && !!digits(r.show.amount) && digits(r.show.amount) === digits(r.win?.text), `${tag} wrap-up: WIN holds the round's total, the card's amount (${r.win?.text} against ${r.show?.amount})`, r.show);
			}
		}
		await p.evaluate(() => document.querySelector('button.catch:not([data-wheel-gate])')?.click());
		await settle(p, S, 120000);
		const after = await p.evaluate(() => {
			const layer = document.querySelector('.am-ui.layer:not(.modals)');
			const v = document.querySelector('.hudp [data-hud="win"] .value');
			return { held: !!layer?.classList.contains('hud-held'), off: !!layer?.classList.contains('hud-off'), inert: !!layer?.inert, odo: window.__reindeer.hud.winOdometer().mode, data: v?.getAttribute('data-odo') ?? null, boxes: v ? v.children.length : -1, text: v?.textContent ?? null, win: window.__reindeer.hud.win(), bar: window.__reindeer.hud.bar ?? 'dock', odoBoxes: v ? v.querySelectorAll('.od, .oc, .ods, .odz').length : -1, digits: ((v?.textContent ?? '').match(/\d/g) ?? []).length, cells: v ? [...v.children].every((c) => c.classList.contains('tg') && c.children.length === 0 && /^\d$/.test(c.textContent ?? '') && getComputedStyle(c).transform === 'none' && c.getAnimations().length === 0) : false };
		});
		check(!after.held && !after.off && !after.inert, `${tag}: after the wrap-up the HUD is live again`, after);
		// (2026-11-21) after the card the readout is today's: plain text, no odometer
		// THE PLAIN READOUT: the odometer is off and nothing of it is left in the number. On the dock that is a number with no
		// boxes in it at all. On the sign bar (2026-11-22, ui/hud/HudReadout.svelte `tabular`: its face has no tabular
		// figures) the plain number's digits stand in static cells one 0 wide, so there: no odometer box of any kind (window,
		// strip, hidden 0, character box), and every child is such a cell: one digit, no child of its own, no transform, no
		// animation, one per digit of the amount
		const plain = after.bar === 'sign' ? after.odoBoxes === 0 && after.cells && after.boxes === after.digits : after.boxes === 0;
		check(after.odo === 'off' && after.data === null && plain && !!after.text && after.win > 0, `${tag}: after the wrap-up WIN is today's plain readout (${after.text})`, after);
		check(errs.filter((x) => !/favicon/.test(x)).length === 0, `${tag}: no console errors`, errs.slice(0, 5));
		await ctx.close();
	}
}

/** THE LANE RING WITH REDUCED MOTION (2026-11-20): nothing on the Spin turns or loops at rest or in a round; the stop
 *  square only fades in (the ring's driver checks the same query) */
async function reducedMotion(browser) {
	const S = { name: 'reduced', vp: { width: 1440, height: 900 }, phone: false, touch: false, family: 'desktop', reduced: true };
	const { ctx, p, errs } = await boot(browser, S);
	if (await dockOnly(p, 'reduced: the lane ring under reduced motion')) return void (await ctx.close());
	await settle(p, S);
	await sleep(600);
	const a = await ringNow(p);
	check(!!a && a.ring && a.turning.length === 0, `reduced motion: nothing runs on the Spin at rest (${a?.turning.join(', ') || 'none'})`, a);
	await p.click(CONTROLS.spin);
	const seen = [];
	for (let i = 0; i < 12; i++) {
		await sleep(90);
		const r = await ringNow(p);
		if (r) seen.push(r);
	}
	const moving = seen.filter((r) => r.turning.length > 0 || r.run === '1');
	check(seen.some((r) => r.st === 'run' && r.square > 0.9) && moving.length === 0, `reduced motion: in a round the square shows and nothing turns (${moving.length} of ${seen.length} reads moving)`, moving.slice(0, 3));
	await settle(p, S);
	check(errs.filter((x) => !/favicon/.test(x)).length === 0, 'reduced motion: no console errors', errs.slice(0, 5));
	await ctx.close();
}

/** THE STOP SQUARE, frame by frame from the running game (the lane ring's J1 stop, 2026-11-20; it replaced the Play to
 *  Stop flip). Headless frames on a loaded machine come far apart, so the motion is read off the game's own CSS
 *  transitions instead: at the press, and when the round ends, every running CSS transition and animation on the
 *  square (.cg), the face (.fx) and the press ring (.halo) is paused and stepped in 1/60 s frames, and the computed
 *  scale and opacity are read at each frame. The ring's own turn (Web Animations on .rw / .rr) is checked as started.
 *  The live frames seen are reported beside it. */
async function flip(browser) {
	const S = { name: 'flip', vp: { width: 1440, height: 900 }, phone: false, touch: false, family: 'desktop' };
	const { ctx, p } = await boot(browser, S);
	if (await dockOnly(p, "flip: the lane ring's face flip")) return void (await ctx.close());
	await settle(p, S);
	await sleep(400);
	const arm = (want) =>
		p.evaluate((want) => {
			window.__flipCap = null;
			const b = document.querySelector('.hudp button.spin');
			const mo = new MutationObserver(() => {
				if (b.getAttribute('data-st') !== want) return;
				mo.disconnect();
				void getComputedStyle(b.querySelector('.cg') ?? b).transform;
				const parts = { cg: b.querySelector('.cg'), fx: b.querySelector('.fx'), halo: b.querySelector('.halo') };
				const anims = [];
				for (const el of Object.values(parts)) if (el) for (const a of el.getAnimations()) if (a instanceof CSSTransition || a instanceof CSSAnimation) anims.push(a);
				const caught = anims.map((a) => a.currentTime ?? 0);
				for (const a of anims) a.pause();
				const sc = (el) => {
					if (!el) return null;
					const t = getComputedStyle(el).transform;
					if (!t || t === 'none') return 1;
					const v = t.match(/matrix\(([^)]+)\)/);
					if (!v) return t;
					const q = v[1].split(',').map(parseFloat);
					return Math.round(Math.hypot(q[0], q[1]) * 1000) / 1000;
				};
				const o = (el) => (el ? Math.round(parseFloat(getComputedStyle(el).opacity) * 1000) / 1000 : null);
				let end = 0;
				for (const a of anims) {
					const t = a.effect.getComputedTiming();
					end = Math.max(end, (t.delay ?? 0) + (t.activeDuration === Infinity ? 0 : t.activeDuration));
				}
				const rows = [];
				const step = 1000 / 60;
				for (let k = 0; k * step <= end + step; k++) {
					const at = k * step;
					for (const a of anims) a.currentTime = at;
					rows.push({ frame: k, ms: Math.round(at * 10) / 10, cg: sc(parts.cg), cgA: o(parts.cg), fx: sc(parts.fx), halo: o(parts.halo) });
				}
				for (const a of anims) {
					try {
						a.finish();
					} catch {
						a.play();
					}
				}
				const nm = (a) => (a.effect.target.getAttribute('class') || '').split(' ')[0];
				window.__flipCap = { st: want, caughtAtMs: caught.map((c) => Math.round(c * 10) / 10), anims: anims.map((a) => ({ el: nm(a), prop: a.transitionProperty ?? a.animationName, delay: a.effect.getComputedTiming().delay, dur: a.effect.getComputedTiming().duration, easing: a.effect.getComputedTiming().easing })), rows };
			});
			mo.observe(b, { attributes: true, attributeFilter: ['data-st'] });
		}, want);
	const take = async () => {
		for (let i = 0; i < 600; i++) {
			const c = await p.evaluate(() => window.__flipCap);
			if (c) return c;
			await sleep(25);
		}
		return { st: null, anims: [], rows: [] };
	};
	await p.evaluate(() => {
		window.__ft = [];
		const loop = (t) => {
			window.__ft.push(t);
			if (window.__ft.length < 400) requestAnimationFrame(loop);
		};
		requestAnimationFrame(loop);
	});
	await arm('run');
	await p.evaluate(() => document.querySelector('.hudp button.spin').click());
	const press = await take();
	// the ring winds up at the press: a script animation on its wrappers within a few frames
	let wound = false;
	for (let i = 0; i < 20 && !wound; i++) {
		wound = await p.evaluate(() => {
			const b = document.querySelector('.hudp button.spin');
			return b.dataset.run === '1' && [...b.querySelectorAll('.rw, .rr')].some((e) => e.getAnimations().some((a) => !(a instanceof CSSAnimation) && !(a instanceof CSSTransition)));
		});
		if (!wound) await sleep(25);
	}
	await arm('idle');
	const end = await take();
	const ft = await p.evaluate(() => window.__ft);
	const gaps = ft.slice(1).map((t, i) => t - ft[i]);
	const med = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
	const out = { liveFrameMedianMs: Math.round(med * 10) / 10, press, end };
	if (FLIP) writeFileSync(FLIP, JSON.stringify(out, null, 1));
	const P = press.rows;
	const shown = P.find((r) => r.cgA !== null && r.cgA >= 0.999);
	const peak = Math.max(...P.map((r) => (typeof r.cg === 'number' ? r.cg : 0)));
	check(press.st === 'run' && !!shown, `flip: on the press the stop square pops in (fully shown by ${shown?.ms} ms)`, press.anims);
	check(peak > 1 && peak < 1.3, `flip: the square pops in with an overshoot (peak scale ${peak})`);
	check(wound, 'flip: the ring winds up at the press (a script animation on its wrappers, data-run 1)');
	const E = end.rows;
	const gone = E.find((r) => r.cgA !== null && r.cgA <= 0.001);
	check(end.st === 'idle' && (!!gone || E.length === 0), `flip: at the round's end the square goes (gone by ${gone?.ms ?? 0} ms)`, end.anims);
	const haloEnd = Math.max(0, ...E.map((r) => r.halo ?? 0));
	const fxEnd = Math.max(...E.map((r) => (typeof r.fx === 'number' ? r.fx : 1)));
	check(haloEnd === 0 && fxEnd <= 1.0001, `flip: no halo and no pop at a no-win round's end (halo opacity peak ${haloEnd}, face scale peak ${fxEnd})`);
	console.log(`  INFO flip: live frames on this machine every ${out.liveFrameMedianMs} ms (median); ${P.length} press frames, ${E.length} end frames; press animations ${press.anims.map((a) => `${a.el.trim()} ${a.prop} ${a.delay}+${a.dur} ms`).join('; ')}`);
	await ctx.close();
}

/** THE ROUND'S TAIL (section `tail`, 2026-11-22, Corey: "Flip the button to spin seems like the right choice there, after
 *  the round settles it's animations and such."; why: "the player might think it will speed up it finishing again, not
 *  hit another spin"; ui/controls.svelte.ts). At 1440 x 900 the page records the Spin key every frame (its words, data-st,
 *  pressReady, the controls' tail, atRest, the round machine, the board's big count, the bonus cards, the autoplay count,
 *  the plays sent, the strip's show) through each kind of round:
 *    the slam stopped column round (base_one_column, Decimus's finding of 2026-11-22) pressed at 0, 120, 250, 400 and
 *    600 ms after the board is at rest; a column round, a plain line win at 0 and 250 ms, a round with no win, the line
 *    win at Turbo and Super Turbo, the column at Super Turbo, a big win (column_30x: its count on the board holds the
 *    round), a free spins round to its Total Win (SKIPFS=1 leaves it out), a press made in the frame the key turns from
 *    Stop to Spin, the Space bar, an autoplay run to its own end and a resumed round (Play Round)
 *  Pass, for every round: from the frame the board is at rest (__reindeer.atRest) the key reads Spin, and once the change
 *  is SPIN_TAIL.flipGraceMs old pressReady is true; a press inside the grace (the "+0" presses) started no
 *  round and a later press did; otherwise the press read Spin and pressReady and started the next round
 *  (a play sent within 4 s); WIN at the press is the round's total as it was at rest (the book's); the strip's small
 *  count stands on its final amount after the press; the wallet took the round's win once (the fixture RGS's balance is
 *  the plays' sum, the end-rounds as many as the paying rounds) and BALANCE reads it; the old round's count is never seen
 *  counting once the new round runs; the key never reads Spin while the board's big count, a bonus card or a press gate
 *  owns the screen. A press on Stop (the slam) never started a round; a press in the frame of the change (aimed at the
 *  Stop it showed) started none, and the next press did. Autoplay: the key never read Spin while the run had spins
 *  left, no press was kept, every loaded round played. A replay is not covered here (the REPLAY face is its own). */
const TAIL_GRACE = 35; // COPY OF src/game/constants.ts:SPIN_TAIL.flipGraceMs (read live as __reindeer.spinTail().graceMs)
const tailRecStart = (p) =>
	p.evaluate(() => {
		const rec = (window.__tailRec = { on: true, rows: [] });
		const f = () => {
			if (!rec.on) return;
			const h = window.__reindeer;
			const b = document.querySelector('.hudp button.spin');
			const sb = h.scoreboard?.();
			const s = sb?.show;
			const label = b?.getAttribute('aria-label') ?? '';
			rec.rows.push({
				t: performance.now(),
				act: label.split(/[.:]/)[0],
				st: b?.dataset.st ?? null,
				dis: !!b?.disabled,
				ready: !!h.pressReady?.(),
				tail: h.spinTail?.() ?? null,
				rest: h.atRest(),
				idle: h.hud.idle(),
				big: !!sb?.busy,
				card: !!document.querySelector('[data-round-card]'),
				gates: h.hud.gates(),
				auto: h.hud.autoLimits().count,
				plays: h.fixtures.log().plays.length,
				win: h.hud.win(),
				led: s ? { id: s.id, kind: s.kind, amount: s.amount, fin: s.finalStr, phase: s.phase } : null,
			});
			requestAnimationFrame(f);
		};
		requestAnimationFrame(f);
	});
const tailRecStop = (p) => p.evaluate(() => ((window.__tailRec.on = false), window.__tailRec.rows.slice()));
const wallet = (p) =>
	p.evaluate(() => {
		const l = window.__reindeer.fixtures.log();
		const txt = document.querySelector('.hudp [data-hud="balance"] .value')?.textContent ?? document.querySelector('.hudp [data-hud="balance"]')?.textContent ?? '';
		return { bal: l.balance, plays: l.plays.slice(), settled: l.settled, shown: Number(txt.replace(/[^0-9.]/g, '')) };
	});
const playsNow = (p) => p.evaluate(() => window.__reindeer.fixtures.log().plays.length);
/** in the page: resolves with the first frame the board is at rest (and WIN then) */
const restFrame = (p, maxMs = 240000) =>
	p.evaluate(
		(maxMs) =>
			new Promise((res) => {
				const t0 = performance.now();
				const f = () => {
					const h = window.__reindeer;
					if (h.atRest()) res({ at: performance.now(), win: h.hud.win() });
					else if (performance.now() - t0 > maxMs) res(null);
					else requestAnimationFrame(f);
				};
				f();
			}),
		maxMs,
	);
/** in the page: `ms` after `at`, read the key and press it in the same task (or, `key`, press the Space bar) */
const tailPress = (p, at, ms, key) =>
	p.evaluate(
		([at, ms, key]) =>
			new Promise((res) => {
				const go = () => {
					const h = window.__reindeer;
					const b = document.querySelector('.hudp button.spin');
					const pre = { t: performance.now() - at, act: (b?.getAttribute('aria-label') ?? '').split(/[.:]/)[0], st: b?.dataset.st, dis: !!b?.disabled, ready: !!h.pressReady?.(), tail: h.spinTail?.(), win: h.hud.win(), idle: h.hud.idle(), plays: h.fixtures.log().plays.length };
					if (key) {
						window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
						window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));
					} else b?.click();
					requestAnimationFrame(() => {
						const s = h.scoreboard?.()?.show;
						res({ pre, led: s ? { id: s.id, kind: s.kind, amount: s.amount, fin: s.finalStr } : null, after: { act: (b?.getAttribute('aria-label') ?? '').split(/[.:]/)[0], tail: h.spinTail?.() } });
					});
				};
				setTimeout(go, Math.max(0, at + ms - performance.now()));
			}),
		[at, ms, !!key],
	);
/** the key turns from Stop to Spin: press it in that same moment (a MutationObserver on its words), aimed at the Stop */
const pressAtFlip = (p) =>
	p.evaluate(
		() =>
			new Promise((res) => {
				const h = window.__reindeer;
				const b = document.querySelector('.hudp button.spin');
				const mo = new MutationObserver(() => {
					if (!(b.getAttribute('aria-label') ?? '').startsWith('Spin') || !h.spinTail?.()?.tail) return;
					mo.disconnect();
					const pre = { tail: h.spinTail(), plays: h.fixtures.log().plays.length, at: performance.now() };
					b.click();
					res(pre);
				});
				mo.observe(b, { attributes: true, attributeFilter: ['aria-label'] });
				setTimeout(() => (mo.disconnect(), res(null)), 240000);
			}),
	);
const actAt = (r) => (r.act || '').trim();

/** the screen-owner rule over a whole recording: the key never reads Spin while the big count, a card or a gate is up */
function ownerRule(tag, rows) {
	const bad = rows.filter((r) => actAt(r) === 'Spin' && !r.idle && (r.big || r.card || r.gates > 0));
	check(bad.length === 0, `tail ${tag}: the key never read Spin while the board's big count, a bonus card or a press gate owned the screen (${bad.length} frames)`, bad.slice(0, 3));
}

/** one round of `fixture`, then the tail press `ms` after rest; the next round is no_win_1 */
async function tailRound(p, S, c) {
	const { tag, fixture, turbo = 0, slam = null, ms = 0, key = false, flipPress = false } = c;
	await setTurboR(p, turbo);
	const w0 = await wallet(p);
	await p.evaluate((n) => window.__reindeer.fixtures.next(n), fixture);
	await tailRecStart(p);
	await p.click(CONTROLS.spin);
	for (let i = 0; i < 100 && (await playsNow(p)) === w0.plays.length; i++) await sleep(50);
	await p.evaluate(() => window.__reindeer.fixtures.next('no_win_1'));
	let slamPre = null;
	if (slam !== null) {
		await sleep(slam);
		slamPre = await p.evaluate(() => {
			const b = document.querySelector('.hudp button.spin');
			const pre = { act: (b?.getAttribute('aria-label') ?? '').split(/[.:]/)[0], plays: window.__reindeer.fixtures.log().plays.length };
			b?.click();
			return pre;
		});
	}
	let flip = null;
	if (flipPress) {
		flip = await pressAtFlip(p);
		await sleep(400);
		flip.after = await p.evaluate(() => ({ plays: window.__reindeer.fixtures.log().plays.length, tail: window.__reindeer.spinTail?.() ?? null }));
	}
	const rest = await restFrame(p);
	if (!rest) {
		await tailRecStop(p);
		check(false, `tail ${tag}: the board came to rest`);
		return;
	}
	let press = await tailPress(p, rest.at, flipPress ? 100 : ms, key);
	// THE GRACE (2026-11-22, Decimus's run of 88392637: the "+0" presses landed 1 to 2 ms after the change): a press inside
	// SPIN_TAIL.flipGraceMs of the change from Stop to Spin was aimed at the Stop shown, so it lands the readout and starts
	// no round; a press on Spin after it starts one. (A "+0" press on a machine already idle, no win, is an ordinary press.)
	let grace = null;
	if (!press.pre.idle && press.pre.tail?.tail && !press.pre.ready) {
		grace = press;
		await sleep(400);
		grace.later = await p.evaluate(() => ({ plays: window.__reindeer.fixtures.log().plays.length, tail: window.__reindeer.spinTail?.() ?? null }));
		press = await tailPress(p, rest.at, grace.pre.t + 400, key);
	}
	let started = false;
	for (let i = 0; i < 80 && !started; i++) {
		started = (await playsNow(p)) >= w0.plays.length + 2;
		if (!started) await sleep(50);
	}
	await settle(p, S, 120000);
	await sleep(300);
	const rows = await tailRecStop(p);
	const w1 = await wallet(p);
	const [p1, p2] = w1.plays.slice(w0.plays.length);
	const pressAt = rest.at + press.pre.t;
	// 1. from the frame at rest: Spin; pressReady once the change is the grace old (until the press)
	const atRest = rows.filter((r) => r.t >= rest.at && r.t < pressAt && r.plays === w0.plays.length + 1);
	const notSpin = atRest.filter((r) => actAt(r) !== 'Spin' || r.dis);
	const notReady = atRest.filter((r) => r.t >= rest.at + TAIL_GRACE + 20 && !r.ready);
	check(notSpin.length === 0, `tail ${tag}: from the frame the board is at rest the key reads Spin (${atRest.length} frames before the press, ${atRest.filter((r) => !r.idle).length} of them in the tail)`, notSpin.slice(0, 3));
	check(notReady.length === 0, `tail ${tag}: from ${TAIL_GRACE} ms after the change pressReady is true`, notReady.slice(0, 3));
	if (grace) {
		check(grace.pre.act === 'Spin' && !grace.pre.ready && grace.later.plays === w0.plays.length + 1 && !grace.later.tail?.kept, `tail ${tag}: the press ${Math.round(grace.pre.t)} ms after rest, inside the ${TAIL_GRACE} ms grace (pressReady false), started no round`, { pre: grace.pre, later: grace.later });
		if (grace.led && grace.led.kind === 'small') check(grace.led.amount === grace.led.fin, `tail ${tag}: the grace press landed the strip's count on its amount (${grace.led.amount} of ${grace.led.fin})`, grace.led);
	}
	// 2. the press read Spin and pressReady, and started the next round (after a grace press: the later press)
	check(press.pre.act === 'Spin' && press.pre.ready, `tail ${tag}: the press ${Math.round(press.pre.t)} ms after rest read Spin and pressReady (${press.pre.idle ? 'machine idle' : 'in the tail'}${key ? ', Space bar' : ''})`, press.pre);
	check(started && !!p2 && p2.name === 'no_win_1', `tail ${tag}: the press started the next round`, { started, p2 });
	// 3. the round's win: WIN at the press is its total as at rest; the strip's count stands on its amount
	check(press.pre.win === rest.win && (p1?.payout > 0 ? rest.win > 0 : rest.win === 0), `tail ${tag}: WIN at the press is the round's total (${press.pre.win}, at rest ${rest.win}, the play paid ${p1?.payout})`);
	if (press.led && press.led.kind === 'small') check(press.led.amount === press.led.fin, `tail ${tag}: after the press the strip's count stands on its amount (${press.led.amount} of ${press.led.fin})`, press.led);
	const oldId = press.led?.kind === 'small' ? press.led.id : null;
	const counting = rows.filter((r) => r.t > pressAt && !r.rest && r.led && r.led.id === oldId && r.led.kind === 'small' && r.led.amount !== r.led.fin);
	check(counting.length === 0, `tail ${tag}: the old round's count is never seen counting in the new round`, counting.slice(0, 3));
	// 4. the wallet took the win once, and BALANCE reads it
	const want = w0.bal - (p1?.amount ?? 0) + (p1?.payout ?? 0) - (p2?.amount ?? 0) + (p2?.payout ?? 0);
	const ends = w1.settled - w0.settled;
	const wantEnds = (p1?.payout > 0 ? 1 : 0) + (p2?.payout > 0 ? 1 : 0);
	check(Math.abs(w1.bal - want) < 1e-6 && ends === wantEnds && Math.abs(w1.shown - w1.bal) < 0.005, `tail ${tag}: the win credited once (wallet ${w1.bal}, plays say ${want}; ${ends} end-round(s) for ${wantEnds} paying round(s); BALANCE ${w1.shown})`);
	// 5. a press on Stop never started a round
	if (slamPre) {
		const early = rows.filter((r) => r.t < pressAt && r.plays > w0.plays.length + 1);
		check(slamPre.act === 'Stop' && early.length === 0, `tail ${tag}: the slam press read Stop and started no round (${early.length} frames with a second play before the Spin press)`, slamPre);
	}
	if (flipPress) {
		check(!!flip && flip.after.plays === w0.plays.length + 1 && !flip.after.tail?.kept, `tail ${tag}: the press in the frame the key turned to Spin (aimed at the Stop it showed; the change ${flip?.tail?.flipAt == null ? 'not yet recorded' : `${Math.round((flip?.at ?? 0) - flip.tail.flipAt)} ms old`}) started no round`, flip);
	}
	ownerRule(tag, rows);
}

async function tailSection(browser) {
	const S = { name: 'tail', vp: { width: 1440, height: 900 }, phone: false, touch: false, family: 'desktop' };
	const { ctx, p, errs } = await boot(browser, S);
	await settle(p, S);
	await sleep(500);
	await p.mouse.move(4, 4);
	const grace = await p.evaluate(() => window.__reindeer.spinTail?.()?.graceMs ?? null);
	check(grace === TAIL_GRACE, `tail: the dev hook reads the grace (${grace} ms, the probe's copy ${TAIL_GRACE})`);
	// (a press the old way first: the probe waits for the machine to be idle between cases)
	for (const ms of [0, 120, 250, 400, 600]) await tailRound(p, S, { tag: `slam column +${ms}`, fixture: 'base_one_column', slam: 700, ms });
	await tailRound(p, S, { tag: 'column +120', fixture: 'base_one_column', ms: 120 });
	await tailRound(p, S, { tag: 'line +0', fixture: 'plain_line_win', ms: 0 });
	await tailRound(p, S, { tag: 'line +250', fixture: 'plain_line_win', ms: 250 });
	await tailRound(p, S, { tag: 'no win +0', fixture: 'no_win_2', ms: 0 });
	await tailRound(p, S, { tag: 'line turbo +0', fixture: 'plain_line_win', turbo: 1, ms: 0 });
	await tailRound(p, S, { tag: 'line super turbo +0', fixture: 'plain_line_win', turbo: 2, ms: 0 });
	await tailRound(p, S, { tag: 'column super turbo +120', fixture: 'base_one_column', turbo: 2, ms: 120 });
	await tailRound(p, S, { tag: 'big win +0', fixture: 'column_30x', ms: 0 });
	await tailRound(p, S, { tag: 'press at the change', fixture: 'plain_line_win', flipPress: true });
	await tailRound(p, S, { tag: 'Space bar +200', fixture: 'plain_line_win', ms: 200, key: true });
	if (process.env.SKIPFS !== '1') await tailRound(p, S, { tag: 'free spins +120', fixture: 'natural_free_spins', ms: 120 });
	// AUTOPLAY: a run to its own end (the first count in the menu), a line win every round
	await setTurboR(p, 0);
	const a0 = await wallet(p);
	await p.evaluate(() => window.__reindeer.fixtures.next('plain_line_win', true));
	await p.click(CONTROLS.auto);
	await sleep(700);
	await p.locator('.am-ui.layer.modals button.chip').first().click().catch(() => {});
	await sleep(300);
	await tailRecStart(p);
	await p.click('.am-ui.layer.modals .go'); // START: the run begins at once
	await sleep(1500);
	for (let i = 0; i < 2400 && (await p.evaluate(() => window.__reindeer.hud.autoLimits().count > 0 || !!document.querySelector('.hudp button.spin.m-auto'))); i++) await sleep(100);
	await settle(p, S, 120000);
	await p.evaluate(() => window.__reindeer.fixtures.clear?.());
	const arows = await tailRecStop(p);
	const a1 = await wallet(p);
	// (the run's count: its counter is set by the menu's START, ui/controls.svelte.ts startAutoplay, and counts down
	// after each round, so its largest value over the run is the count started; before the press it reads 0)
	const count = Math.max(0, ...arows.map((r) => r.auto));
	const inRun = arows.filter((r) => r.auto > 0);
	const spinInRun = inRun.filter((r) => actAt(r) === 'Spin');
	check(inRun.length > 0 && spinInRun.length === 0, `tail autoplay: the key never read Spin while the run had spins left (${spinInRun.length} of ${inRun.length} frames)`, spinInRun.slice(0, 3));
	check(arows.every((r) => !r.tail?.kept), 'tail autoplay: no press was kept (the run starts its own rounds)');
	check(count > 0 && a1.plays.length - a0.plays.length === (count === Infinity ? -1 : count), `tail autoplay: every round of the run played (${a1.plays.length - a0.plays.length} of ${count})`);
	const lastRest = arows.filter((r) => r.auto === 0 && r.rest && r.plays === a1.plays.length);
	check(lastRest.length > 0 && lastRest.every((r) => actAt(r) === 'Spin'), `tail autoplay: after the run's last round, at rest, the key reads Spin (${lastRest.length} frames)`, lastRest.filter((r) => actAt(r) !== 'Spin').slice(0, 3));
	ownerRule('autoplay', arows);
	check(errs.filter((x) => !/favicon/.test(x)).length === 0, 'tail: no console errors', errs.slice(0, 5));
	// A RESUMED ROUND (Play Round on the resume card): its tail follows the same rule
	await p.evaluate(() => window.__reindeer.fixtures.resume('plain_line_win', 0)).catch(() => {});
	await sleep(1500);
	await p.waitForLoadState('domcontentloaded').catch(() => {});
	let up = false;
	for (let i = 0; i < 300 && !up; i++) {
		up = await p.evaluate(() => !!document.querySelector('[data-resume-card] [data-resume="play"]')).catch(() => false);
		if (!up) await sleep(250);
	}
	check(up, 'tail resume: the resume card is up after the reload');
	if (up) {
		const pays = await p.evaluate(() => window.__reindeer.fixtures.list().find((r) => r.name === 'plain_line_win').pays);
		const r0 = await wallet(p);
		await p.evaluate(() => window.__reindeer.fixtures.next('no_win_1'));
		await p.click('[data-resume-card] [data-resume="play"]');
		for (let i = 0; i < 100 && !(await p.evaluate(() => !!window.__reindeer.spinTail && !!document.querySelector('.hudp button.spin')).catch(() => false)); i++) await sleep(100);
		// (the resumed round first takes the board: then its rest)
		for (let i = 0; i < 100 && (await p.evaluate(() => window.__reindeer.atRest()).catch(() => true)); i++) await sleep(50);
		await tailRecStart(p);
		const rest = await restFrame(p);
		const press = rest ? await tailPress(p, rest.at, 120, false) : null;
		let started = false;
		for (let i = 0; i < 80 && !started; i++) {
			started = (await playsNow(p)) >= r0.plays.length + 1;
			if (!started) await sleep(50);
		}
		await settle(p, S, 120000);
		const rows = await tailRecStop(p);
		const r1 = await wallet(p);
		const before = rest && press ? rows.filter((r) => r.t >= rest.at && r.t < rest.at + press.pre.t) : [];
		check(!!press && before.every((r) => actAt(r) === 'Spin') && press.pre.act === 'Spin' && press.pre.ready, `tail resume: from rest the key reads Spin and the press +120 ms read Spin and pressReady`, press?.pre);
		check(started, 'tail resume: the press started the next round');
		const want = r0.bal + pays - (r1.plays.at(-1)?.amount ?? 0);
		check(Math.abs(r1.bal - want) < 1e-6 && r1.settled - r0.settled === 1 && Math.abs(r1.shown - r1.bal) < 0.005, `tail resume: the resumed round's win credited once (wallet ${r1.bal}, want ${want}; ${r1.settled - r0.settled} end-round; BALANCE ${r1.shown})`);
	}
	await ctx.close();
}

// ---- THE SIGN BAR (ONLY=signhud; 2026-11-22, wip/signhud; ui/sign/, ui/hudTheme.ts HUD_BAR 'sign') ----
// ROUND 3 (2026-11-23, wip/phonefit): his windows on a phone are now the seven he laid out at the real sizes a phone
// browser gives the game (signLayout.ts PHONE_R3 and LAND_R3; marked r3 below: 440x742, 413x586, 375x530, 626x816
// upright, 832x376 and 667x311 sideways, 890x552 on the desktop bar). The sizes round 2 was set at (Stake's 425x812,
// 375x667, 320x568 and the full screen ones) stay in the list as windows the RULE answers: they take round 3's
// arrangement (Auto and Turbo beside the Spin upright, the amount under them). Added with it:
//   - ONE NUMBER SIZE (Corey: "The text sizes were different in the mock up for the Balance, Spin amount, and WIN,
//     Ideally those all stay about the same size"): the three numbers' nominal sizes within 1 px of each other
//     (__reindeer.sign.type), each number drawn at its nominal size times its own fit, on every phone window and r3
//   - sideways touch phones, his 832x376 and 667x311: nothing pressed or read in the bottom 20 px (the home
//     indicator), the bet symbols' press boxes and the Win box's glass included. At 667x311 his own placing had them
//     in it; Corey 2026-11-24: "Nudge them up": the amount group and the Win box stand 9.5 px above his export there
//     and Balance 6.2 px (signLayout.ts homeLifts, read as __reindeer.sign.geo().lift): his places are judged with
//     that taken out
//   - BALANCE AND WIN AT THE AMOUNT'S SIZE, a DEV look (Corey: "Show me what they look like please"; signLayout.ts
//     matchedType, __reindeer.sign.matchNumbers, ?numbers=match): at 390x844, 375x667 and 320x568 with the look on
//     the three are drawn one size; off again, as before (since the amount is sized per game mode the base game's
//     amount is the common size there in USD and the look changes nothing; it shows at Ante 10x and in long currencies)
//   - AUTO AND TURBO LEVEL UPRIGHT (Corey 2026-11-24: "I wanted the Turbo and Auto Modes to be at the same height on
//     the page for portait modes"): at every upright window their boxes' centers are on one line and one size
//   - SKIP TO RESULT at his windows is his box (__reindeer.sign.scene: his box and its share here)
// At each of Corey's own windows, the sizes the rule answers, three more desktop sizes and the two popouts:
//   - every piece is drawn within 1 CSS px of his place (his own table, read through __reindeer.sign.his(), never a
//     copy; at a window he did not set, of the place the rule answers: tools/sign_layout_test.mjs proves the rule)
//   - every press region holds a 44 CSS px circle (2026-11-23: his own Auto and Turbo stand closer than 44 at
//     568 x 320 and 667 x 375, and there their unseen press pads stand apart, signLayout.ts padPlaces). The pads are
//     tested by their REAL SHAPES (padShapes, read through __reindeer.sign.pads): a press at points inside a pad's
//     own outline (its middle, 16 rays half way out and 1.5 px inside the outline) lands on that pad or its own key,
//     and along the line through the two pads' middles no press on one key's side of the middle line lands on the
//     other key's pad. (The first form of this check pressed 21 px from the middle of a 44 px round box, 1 px
//     inside it and 1.5 px from the other pad: a browser's own whole px test of a rounded box is looser than that.)
//     And a press on each control's middle lands on that control
//   - WHOSE PRESS IS IT, OF AUTO AND TURBO (2026-11-23): where the two drawn keys overlap, the key drawn on top
//     (Turbo; the drawn diamonds overlap at no window, their upright boxes do); outside that, the key whose drawing
//     or pad the place is in; anywhere else, neither. Touch taps on the phone sizes: bare ground between the two
//     presses neither, each pad's ground nearest the other key presses its own key (__reindeer.sign.owner)
//   - WHAT THE RULE NAMES A CONTROL'S GROUND IS COVERED (2026-11-23): wherever __reindeer.sign.owner names a control
//     (a grid 2 px apart over every control's press shape, __reindeer.sign.shapes), the top element is a key, a pad
//     or that control's catch outline (.sgcatch, data-catch), never the canvas; a press 0.5 px inside Menu's edge
//     nearest the Spin opens the menu (the walk's sizes)
//   - THE SPIN'S NEIGHBOURS (2026-11-23, sizes marked walk: 1200x675 by mouse; 844x390, 667x375, 568x320, 390x844 by
//     touch): a round starts only from a press that went down inside the Spin's own diamond. 2 px inside Auto's and
//     Turbo's edges nearest the Spin: no round, the key acts; 2 px inside the Spin's edge nearest each: a round, the
//     key as it was (__reindeer.atRest, __reindeer.hud.idle, fixtures no_win_1)
//   - nothing is on the board, the LED strip or the logo by real shape, and no bet symbol's press box is on the Play
//   - the amount fits its reserved width (the widest amount of the bet menu at the type size in use), the symbols hold
//     still across bet steps AND when a mode is loaded (2026-11-24: the seat is the base game's; the number is sized
//     for the mode in play, in the room between the drawn symbols); in three currencies at four of the sizes
//   - the Win box is hidden at rest, shows on a win, goes at the next spin, and stays through free spins
//   - the Play says SPIN at rest and STOP while a round's stop is available
//   - the free spins ring holds one LED per free spin, the lit count is the spin in play, and a retrigger adds three
//   - (2026-11-22, the probe host's eye) every frame from a round's press to the next round's rest: the Play's face
//     color and its word agree (SPIN outside a run on green, STOP on red, the two tints never part way); the Win box
//     is gone, not painted, a quarter second after its win clears and never shows without an amount, through rounds
//     pressed back to back and through an Autoplay run; in free spins at every sideways size the Win box (its glass,
//     its header plate and its number) is the size it is for WIN and clear of the LED strip
//   - Balance keeps his anchor in a room inside the window, and a very long balance (10,000,000 at every size; in JPY,
//     BTC and the social coin at four sizes, 1,000,000,000 GC) stays whole, inside the window and its room
// Popout S (400 x 225) is the least important size: what fails there is listed, and only "everything can be pressed"
// is asked of it.
const SIGN_SIZES = [
	// his round 3 windows (r3: one of the layout file's own; `his` is then the table's row)
	{ walk: true, name: '440x742', vp: { width: 440, height: 742 }, touch: true, phone: true, family: 'portrait', his: true, r3: true, cur: true, fs: 'retrigger', auto: true },
	{ name: '413x586', vp: { width: 413, height: 586 }, touch: true, phone: true, family: 'portrait', his: true, r3: true, fs: 'natural_free_spins' },
	{ name: '375x530', vp: { width: 375, height: 530 }, touch: true, phone: true, family: 'portrait', his: true, r3: true },
	// (the phablet is not a phone by the game's device tier: its short side is over 500 CSS px)
	{ name: '626x816', vp: { width: 626, height: 816 }, touch: true, phone: false, family: 'portrait', his: true, r3: true },
	{ walk: true, name: '832x376', vp: { width: 832, height: 376 }, touch: true, phone: true, family: 'landscape', his: true, r3: true, fs: 'retrigger', low: 'strict' },
	{ name: '667x311', vp: { width: 667, height: 311 }, touch: true, phone: true, family: 'landscape', his: true, r3: true, cur: true, fs: 'natural_free_spins', low: 'strict', lift: [9.5, 6.2] },
	{ name: '890x552', vp: { width: 890, height: 552 }, touch: true, phone: false, family: 'landscape', his: true, r3: true, fs: 'natural_free_spins' },
	// the sizes round 2 was set at: the rule's places now
	{ name: '425x812', vp: { width: 425, height: 812 }, touch: true, phone: true, family: 'portrait' },
	{ name: '375x667', vp: { width: 375, height: 667 }, touch: true, phone: true, family: 'portrait', match: true },
	{ name: '320x568', vp: { width: 320, height: 568 }, touch: true, phone: true, family: 'portrait', cur: true, match: true },
	{ walk: true, name: '390x844', vp: { width: 390, height: 844 }, touch: true, phone: true, family: 'portrait', cur: true, fs: 'retrigger', auto: true, match: true },
	{ name: '390x620', vp: { width: 390, height: 620 }, touch: true, phone: true, family: 'portrait' },
	{ name: '812x425', vp: { width: 812, height: 425 }, touch: true, phone: true, family: 'landscape', fs: 'natural_free_spins' },
	{ walk: true, name: '667x375', vp: { width: 667, height: 375 }, touch: true, phone: true, family: 'landscape', fs: 'natural_free_spins' },
	{ walk: true, name: '568x320', vp: { width: 568, height: 320 }, touch: true, phone: true, family: 'landscape', cur: true, fs: 'natural_free_spins' },
	{ walk: true, name: '844x390', vp: { width: 844, height: 390 }, touch: true, phone: true, family: 'landscape', fs: 'retrigger' },
	{ name: '1920x1080', vp: { width: 1920, height: 1080 }, touch: false, phone: false, family: 'desktop', his: true, fs: 'retrigger', auto: true },
	{ walk: true, name: '1200x675', vp: { width: 1200, height: 675 }, touch: false, phone: false, family: 'desktop' },
	{ name: '1024x576', vp: { width: 1024, height: 576 }, touch: false, phone: false, family: 'desktop', cur: true },
	{ name: '800x450', vp: { width: 800, height: 450 }, touch: false, phone: false, family: 'desktop' },
	{ name: '400x225', vp: { width: 400, height: 225 }, touch: false, phone: false, family: 'desktop', listOnly: true },
];
// (the Play, Auto and Turbo buttons are their drawn diamonds; each one's box, his place, is the element inside marked *-box)
const SIGN_PIECES = { play: '.hudp [data-hud="play-box"]', auto: '.hudp [data-hud="auto-box"]', turbo: '.hudp [data-hud="turbo-box"]', menu: '.hudp [data-hud="menu-key"]', bonus: '.hudp .fb', bal: '.hudp [data-hud="balance"]', win: '.hudp [data-hud="win"]', amt: '.hudp [data-hud="amount"]' };
const signRead = (p) =>
	p.evaluate((SEL) => {
		const S = window.__reindeer.sign;
		if (!S) return null;
		const dom = {};
		for (const [id, sel] of Object.entries(SEL)) {
			const e = document.querySelector(sel);
			if (!e) continue;
			const b = e.getBoundingClientRect();
			dom[id] = { x: b.left, y: b.top, w: b.width, h: b.height };
		}
		const hitOk = {};
		for (const id of ['play', 'auto', 'turbo', 'menu', 'bonus']) {
			const e = document.querySelector(SEL[id])?.closest('button') ?? document.querySelector(SEL[id]);
			if (!e) continue;
			const b = e.getBoundingClientRect();
			const at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
			hitOk[id] = !!at && (at === e || e.contains(at));
		}
		for (const [id, sel] of [['down', '.hudp [data-hud-step="minus"]'], ['up', '.hudp [data-hud-step="plus"]']]) {
			const e = document.querySelector(sel);
			if (!e) continue;
			const b = e.getBoundingClientRect();
			dom[id] = { x: b.left, y: b.top, w: b.width, h: b.height };
			const at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
			hitOk[id] = !!at && (at === e || e.contains(at));
		}
		// AUTO'S AND TURBO'S PRESS PADS (2026-11-23): each pad's real shape (the rule's outline, CSS px: a 44 px circle, cut
		// at the middle line where the two share their ground), where the page drew it, and what a press lands on at
		// points INSIDE that shape: its middle, and along 16 rays from it half way out and 1.5 px inside the outline (its
		// own pad or its own key, nothing else). THE MIDDLE LINE: along the line through the two pads' middles, every
		// 1 px, a point more than 1 px on one key's side of the middle line never lands on the other key's pad (the
		// pads are what could cover each other; a drawn key takes the presses on its own diamond).
		// A point that lands elsewhere is reported with what took it (tag, class, marks, its box) and what lay under it.
		const padHit = {};
		const padsAt = S.pads ? S.pads() : null;
		const who = (at) => (at ? `${at.tagName.toLowerCase()}${at.getAttribute('class') ? '.' + String(at.getAttribute('class')).trim().split(/\s+/).join('.') : ''}${['data-pad', 'data-hud', 'data-hud-step'].map((k) => (at.getAttribute(k) ? `[${k}=${at.getAttribute(k)}]` : '')).join('')}` : 'nothing');
		const boxOf = (at) => {
			const b = at.getBoundingClientRect();
			return `${b.left.toFixed(1)},${b.top.toFixed(1)} ${b.width.toFixed(1)}x${b.height.toFixed(1)}`;
		};
		const padEl = (id) => document.querySelector(`.hudp .sgpad[data-pad="${id}"]`);
		const keyEl = (id) => document.querySelector(SEL[id])?.closest('button');
		const mine = (id, at) => !!at && (at === padEl(id) || at === keyEl(id) || !!keyEl(id)?.contains(at));
		for (const id of ['auto', 'turbo']) {
			const e = padEl(id);
			const key = keyEl(id);
			const shape = padsAt?.shapes?.[id];
			if (!e || !key || !shape) continue;
			const P = shape.poly;
			const c = shape.c;
			// how far the outline is from the pad's middle along a direction
			const reach = (dx, dy) => {
				let best = Infinity;
				for (let k = 0; k < P.length; k++) {
					const a = P[k];
					const b = P[(k + 1) % P.length];
					const ex = b[0] - a[0];
					const ey = b[1] - a[1];
					const den = dx * ey - dy * ex;
					if (Math.abs(den) < 1e-9) continue;
					const t = ((a[0] - c[0]) * ey - (a[1] - c[1]) * ex) / den;
					const w = ((a[0] - c[0]) * dy - (a[1] - c[1]) * dx) / den;
					if (t > 0 && w >= -1e-9 && w <= 1 + 1e-9) best = Math.min(best, t);
				}
				return best;
			};
			const pts = [c];
			for (let k = 0; k < 16; k++) {
				const dx = Math.cos((k * Math.PI) / 8);
				const dy = Math.sin((k * Math.PI) / 8);
				const r = reach(dx, dy);
				if (!Number.isFinite(r) || r < 3) continue;
				pts.push([c[0] + dx * (r / 2), c[1] + dy * (r / 2)], [c[0] + dx * (r - 1.5), c[1] + dy * (r - 1.5)]);
			}
			const other = pts
				.map((q) => {
					const at = document.elementFromPoint(q[0], q[1]);
					if (mine(id, at)) return null;
					const under = document.elementsFromPoint(q[0], q[1]).slice(0, 4);
					return `(${q[0].toFixed(1)}, ${q[1].toFixed(1)}) lands on ${who(at)}${at ? ` at ${boxOf(at)}` : ''}; under it: ${under.slice(1).map(who).join(' > ') || 'nothing'}`;
				})
				.filter(Boolean);
			const b = e.getBoundingClientRect();
			const xs = P.map((q) => q[0]);
			const ys = P.map((q) => q[1]);
			padHit[id] = { drawn: [b.left, b.top, b.right, b.bottom], want: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], c, key: padsAt.keys[id], split: shape.split, points: pts.length, other };
		}
		// the middle line between the two pads
		let padLine = null;
		if (padsAt?.shapes?.auto && padsAt?.shapes?.turbo && padEl('auto') && padEl('turbo')) {
			const a = padsAt.shapes.auto.c;
			const t = padsAt.shapes.turbo.c;
			const d = Math.hypot(t[0] - a[0], t[1] - a[1]);
			const n = [(t[0] - a[0]) / d, (t[1] - a[1]) / d];
			const wrong = [];
			let points = 0;
			for (let v = -22; v <= d + 22; v += 1) {
				const q = [a[0] + n[0] * v, a[1] + n[1] * v];
				const s = v - d / 2;
				if (Math.abs(s) <= 1) continue;
				points++;
				const at = document.elementFromPoint(q[0], q[1]);
				const far = s < 0 ? 'turbo' : 'auto';
				if (at && at === padEl(far)) wrong.push(`(${q[0].toFixed(1)}, ${q[1].toFixed(1)}), ${Math.abs(s).toFixed(1)} px on ${s < 0 ? "Auto's" : "Turbo's"} side, lands on ${who(at)} at ${boxOf(at)}`);
			}
			padLine = { apart: d, points, wrong };
		}
		const seat = S.seat();
		// the widest amount of the bet menu at the type in use, measured in the page's own face
		const m = document.createElement('span');
		m.style.cssText = `position:absolute;left:-9999px;top:0;white-space:pre;font:900 ${seat.px}px 'Overpass',sans-serif;font-variant-numeric:tabular-nums`;
		m.textContent = seat.widest;
		document.body.appendChild(m);
		const widestPx = m.getBoundingClientRect().width;
		m.remove();
		const val = document.querySelector('.hudp [data-hud="amount"] .value')?.getBoundingClientRect();
		const box = document.querySelector('.hudp .sgw');
		const words = [...document.querySelectorAll('.hudp button.spin .s-words text')].map((t) => t.textContent);
		const ring = document.querySelector('.hudp button.spin .s-ring');
		return {
			inputs: S.inputs(),
			geo: S.geo(),
			seat,
			press: S.press(),
			problems: S.problems(),
			his: S.his(),
			dom,
			hitOk,
			padHit,
			padLine,
			widestPx,
			value: val ? { x0: val.left, x1: val.right, text: document.querySelector('.hudp [data-hud="amount"] .value').textContent } : null,
			win: { on: S.winOn(), opacity: box ? Number(getComputedStyle(box).opacity) : null, shape: box?.dataset.shape ?? null, text: document.querySelector('.hudp [data-hud="win"] .value')?.textContent ?? '', rects: Object.fromEntries([['glass', '.hudp .sgw .s-glass'], ['plate', '.hudp [data-hud="win"] .lbw'], ['value', '.hudp [data-hud="win"] .value']].map(([k, sel]) => { const q = document.querySelector(sel)?.getBoundingClientRect(); return [k, q ? { x: q.left, y: q.top, w: q.width, h: q.height } : null]; })) },
			play: { words, label: document.querySelector('.hudp button.spin')?.getAttribute('aria-label'), st: document.querySelector('.hudp button.spin')?.getAttribute('data-st'), red: document.querySelector('.hudp button.spin')?.classList.contains('is-red') },
			ring: ring ? { total: Number(ring.dataset.total), leds: ring.querySelectorAll('.ib').length, lit: ring.querySelectorAll('.ib.lit').length } : null,
			gameType: window.__reindeer.gameType?.(),
			mode: window.__reindeer.hud.mode(),
			readouts: S.readouts(),
			// round 3: his scene here and the type sizes the layout answers; each number's drawn size (its own font size at
			// the bar's scale) and every pressed or read thing's lowest edge
			scene: S.scene?.() ?? null,
			type: S.type?.() ?? null,
			fonts: Object.fromEntries(
				[['bal', 'balance'], ['amt', 'amount'], ['win', 'win']].map(([id, name]) => {
					const e = document.querySelector(`.hudp [data-hud="${name}"] .value`);
					if (!e) return [id, null];
					// (the bar is drawn at its own scale: the element's drawn height over its layout height, or the bar's own
					// where the element has no height now, the Win box at rest)
					const bar = document.querySelector('.hudp');
					const kb = bar && bar.offsetWidth ? bar.getBoundingClientRect().width / bar.offsetWidth : 1;
					const hh = e.getBoundingClientRect().height;
					const k = e.offsetHeight && hh > 0 ? hh / e.offsetHeight : kb;
					return [id, parseFloat(getComputedStyle(e).fontSize) * k];
				}),
			),
			lows: Object.fromEntries(
				[['Balance (its plate and number)', '.hudp [data-hud="balance"] .lbw, .hudp [data-hud="balance"] .value'], ['the amount (its plate and number)', '.hudp [data-hud="amount"] .lbw, .hudp [data-hud="amount"] .value'], ['Menu', '.hudp [data-hud="menu-key"]'], ['the Fast Lane', '.hudp .fb'], ['the Spin', '.hudp button.spin'], ['Auto', '.hudp [data-hud="auto-box"]'], ['Turbo', '.hudp [data-hud="turbo-box"]']].map(([n, sel]) => [n, Math.max(-1, ...[...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => r.bottom))]),
			),
			balValue: (() => {
				const q = document.querySelector('.hudp [data-hud="balance"] .value');
				const r = q?.getBoundingClientRect();
				return r ? { x0: r.left, x1: r.right, text: q.textContent } : null;
			})(),
			skip: (() => {
				const e = document.querySelector('[data-skip="button"]');
				if (!e) return null;
				const q = e.getBoundingClientRect();
				return { x: q.left, y: q.top, w: q.width, h: q.height, up: window.__reindeer.skipHud?.().up ?? e.classList.contains('up') };
			})(),
		};
	}, SIGN_PIECES);
/** every frame: the Play's word, its mode and its face's two tints, and the Win box (on, its opacity, whether it is
 *  painted, its amount) */
const signRecStart = (p) =>
	p.evaluate(() => {
		const rec = (window.__signRec = { on: true, rows: [] });
		const f = () => {
			if (!rec.on) return;
			const b = document.querySelector('.hudp button.spin');
			const box = document.querySelector('.hudp .sgw');
			const op = (sel) => {
				const e = b?.querySelector(sel);
				return e ? Number(getComputedStyle(e).opacity) : null;
			};
			const cs = box ? getComputedStyle(box) : null;
			rec.rows.push({ t: performance.now(), w: [...(b?.querySelectorAll('.s-words text') ?? [])].map((x) => x.textContent).join(' '), m: (b?.className.match(/\bm-([a-z]+)/) ?? [])[1] ?? '', red: !!b?.classList.contains('is-red'), tr: op('.t-red'), tg: op('.t-green'), on: window.__reindeer.sign.winOn(), wo: cs ? Number(cs.opacity) : null, wv: cs ? cs.visibility : null, wt: document.querySelector('.hudp [data-hud="win"] .value')?.textContent ?? '' });
			requestAnimationFrame(f);
		};
		requestAnimationFrame(f);
	});
const signRecStop = (p) =>
	p.evaluate(() => {
		const r = window.__signRec;
		if (r) r.on = false;
		return r ? r.rows : [];
	});
/** the two rules on a record: the face and the word agree on every frame; the Win box is gone a quarter second after
 *  its win clears and never shows without an amount */
const signRecJudge = (tag, rows, { stop = true } = {}) => {
	const part = rows.filter((r) => !((r.tr === 0 && r.tg === 1) || (r.tr === 1 && r.tg === 0)));
	const redSpin = rows.filter((r) => r.w === 'SPIN' && (r.red || r.tr !== 0));
	const greenStop = rows.filter((r) => (r.w === 'STOP' || r.m === 'auto' || r.m === 'spinning') && (!r.red || r.tr !== 1));
	const words = [...new Set(rows.map((r) => r.w))];
	check(rows.length >= 60 && words.includes('SPIN') && (!stop || words.includes('STOP')) && part.length === 0 && redSpin.length === 0 && greenStop.length === 0, `${tag}: on every frame the Play's face and its word agree (SPIN on green, STOP and a run on red, never part way; ${rows.length} frames, words ${words.filter((w) => !/\d/.test(w)).join(', ')})`, { partWay: part.length, redSpin: redSpin.slice(0, 2), greenStop: greenStop.slice(0, 2) });
	let offAt = null;
	const late = [];
	const empty = [];
	let shown = 0;
	let off = 0;
	for (let i = 0; i < rows.length; i++) {
		const r = rows[i];
		if (r.on) offAt = null;
		else if (offAt === null) offAt = i > 0 && rows[i - 1].on ? r.t : -1e9;
		if (r.on && r.wo > 0.9) shown++;
		if (!r.on) {
			off++;
			if (r.t - offAt > 250 && (r.wo !== 0 || r.wv !== 'hidden')) late.push({ ms: Math.round(r.t - offAt), opacity: r.wo, painted: r.wv });
		}
		// (a win's count starts from zero, so its first frames read 0.00: an amount all the same; empty is no number at all)
		if (r.wo > 0.05 && r.wv === 'visible' && !/\d/.test(r.wt)) empty.push({ on: r.on, opacity: r.wo, text: r.wt });
	}
	check(shown > 5 && off > 30 && late.length === 0 && empty.length === 0, `${tag}: the Win box is gone (opacity 0, not painted) a quarter second after its win clears, and never shows without an amount (${shown} frames up, ${off} frames away)`, { late: late.slice(0, 3), empty: empty.slice(0, 3) });
};
/** A VERY LONG BALANCE (2026-11-22: 568 x 320 in BTC ran past the window): shown through the DEV hook, it must stay whole
 *  (never abbreviated), inside the window and inside Balance's room, with nothing of Balance on the scene or the Play;
 *  the balance is put back */
const longBalance = async (tag, p, S, amount, digits) => {
	const was = await p.evaluate((a) => window.__reindeer.sign.tryBalance(a), amount);
	await sleep(250);
	const e = await signRead(p);
	await p.evaluate((a) => void window.__reindeer.sign.tryBalance(a), was);
	await sleep(150);
	const v = e?.balValue;
	const rm = e?.readouts.bal.room;
	const pr = (e?.problems ?? []).filter((x) => /^bal\b/.test(x));
	const whole = !!v && (v.text.match(/\d/g) ?? []).join('').startsWith(digits);
	check(!!v && whole && v.x0 >= -0.5 && v.x1 <= S.vp.width + 0.5 && v.x0 >= rm.x - 1 && v.x1 <= rm.x + rm.w + 1 && pr.length === 0, `${tag}: a very long balance (${v?.text}) is whole, inside the window and its room, at ${r1(e?.readouts.bal.px ?? 0)} CSS px (${Math.round((e?.readouts.bal.k ?? 0) * 100)} %${e?.readouts.bal.under ? ', past the floor' : ''})`, { value: v, room: rm, problems: pr });
};
// THE AMOUNT BETWEEN ITS SYMBOLS (2026-11-24, Corey: "I would prefer the Play gets bigger ... per game mode ... The
// arrows should stay where they are at"; signLayout.ts amountType). The seat is the base game's: the reserved width
// stands between the two press boxes. The number is sized for the widest amount of the MODE IN PLAY (seat.widest) in
// the room between the two DRAWN symbols (seat.room: their middles' distance less a drawn symbol, seat.sym, and
// 4 bar px clear each side), never over the window's common number size: so the widest amount of the mode fits that
// room at the type in use, and the amount shown stands between the drawn symbols with that clearance.
const amountFits = (tag, d) => {
	const s = d.seat;
	const slot = s.up.x - (s.down.x + s.down.w);
	const clear = (s.upC[0] - s.downC[0] - s.sym - s.room) / 2;
	const common = d.type ? d.type.num.bal : Infinity;
	check(d.widestPx <= s.room + 0.75 && s.W <= slot + 0.01 && s.px <= common + 0.05, `${tag}: the widest amount of the mode in play (${d.seat.widest}) fits the room between the two drawn symbols (${r1(s.room)} px) at the type in use (${r1(s.px)} px, the common number size ${r1(common)})`, { widest: r1(d.widestPx), room: r1(s.room), slot: r1(slot), reserved: r1(s.W), type: r1(s.px), share: s.k, under: s.under });
	const lo = s.downC[0] + s.sym / 2 + clear;
	const hi = s.upC[0] - s.sym / 2 - clear;
	if (d.value) check(d.value.x0 >= lo - 0.75 && d.value.x1 <= hi + 0.75, `${tag}: the amount shown (${d.value.text}) stands between its two drawn symbols, ${r1(clear)} px clear of each`, { value: [r1(d.value.x0), r1(d.value.x1)], from: r1(lo), to: r1(hi) });
};
async function signHud(browser) {
	for (const S of SIGN_SIZES) {
		const tag = `signhud ${S.name}`;
		const { ctx, p, errs } = await boot(browser, S);
		try {
			await settle(p, S);
			if ((await barOf(p)) !== 'sign') {
				check(false, `${tag}: the game bar in use is the sign bar (ui/hudTheme.ts HUD_BAR)`);
				continue;
			}
			let d = await signRead(p);
			check(!!d, `${tag}: __reindeer.sign answers`);
			if (!d) continue;
			const kind = d.inputs.kind;
			console.log(`     ${tag}: layout ${kind}, u ${d.geo.u.toFixed(3)}, weights ${d.geo.weights.map((w) => w.toFixed(2)).join(' ') || '-'}${d.geo.moved.length ? ', guards: ' + d.geo.moved.join('; ') : ''}`);
			// ---- places ----
			// (round 3: his phablet held sideways, 890 x 552, is laid out with the desktop bar and has its own row, `land`)
			const ref = !S.r3 ? null : kind !== 'landscape' ? d.his.phone[kind].find((r) => r.vw === S.vp.width && r.vh === S.vp.height) : d.his.land.vw === S.vp.width && d.his.land.vh === S.vp.height ? d.his.land : null;
			if (S.r3) check(!!ref, `${tag}: this is one of his round 3 windows in the layout file`);
			// (the nudge up: the amount group and the Win box `lift.d` above his export, Balance `lift.bal`; zeros elsewhere)
			const lift = d.geo.lift ?? { d: 0, bal: 0 };
			const upOf = (id) => (id === 'amt' || id === 'win' ? lift.d : id === 'bal' ? lift.bal : 0);
			if (S.r3) check(S.lift ? Math.abs(lift.d - S.lift[0]) <= 0.1 && Math.abs(lift.bal - S.lift[1]) <= 0.1 : lift.d === 0 && lift.bal === 0, `${tag}: the nudge up is ${S.lift ? `${S.lift[0]} px for the amount group and the Win box, ${S.lift[1]} px for Balance` : 'nothing here'}`, lift);
			const want = (id) => (ref ? { x: ref.p[id][0], y: ref.p[id][1] - upOf(id), w: ref.p[id][2], h: ref.p[id][3] } : d.geo.box[id]);
			const off = [];
			// (the Win box is hidden at rest 12 bar px under its place, the start of its short rise: its place is read below,
			// once a win has brought it up)
			for (const id of Object.keys(SIGN_PIECES).filter((k) => k !== 'win')) {
				const a = d.dom[id];
				const b = want(id);
				if (!a) {
					off.push(`${id} not drawn`);
					continue;
				}
				// (the amount's element is its reserved width about his center: its middle and its height are his)
				const dd = id === 'amt' ? Math.max(Math.abs(a.x + a.w / 2 - (b.x + b.w / 2) - d.seat.nudge), Math.abs(a.y - b.y), Math.abs(a.h - b.h)) : Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));
				if (dd > 1) off.push(`${id} ${r1(dd)} px`);
			}
			check(off.length === 0, `${tag}: every piece within 1 CSS px of ${ref ? 'his place' : S.his ? 'his place (his 1920 x 1080 layout by the rule)' : "the rule's place"}`, off);
			{
				// BALANCE KEEPS HIS ANCHOR: left set, his left edge (inside the window); centered, his center; never wider than his box
				const hb = want('bal');
				const rm = d.readouts.bal.room;
				const left = d.geo.just.bal === 'left';
				const anchored = left ? Math.abs(rm.x - Math.max(hb.x, 2 * d.geo.u)) <= 1 : Math.abs(rm.x + rm.w / 2 - (hb.x + hb.w / 2)) <= 1;
				check(anchored && rm.w <= hb.w + 0.5 && rm.x >= 0 && rm.x + rm.w <= S.vp.width, `${tag}: Balance's room keeps his ${left ? 'left edge' : 'center'}, inside his box and the window (${r1(rm.x)} to ${r1(rm.x + rm.w)}; his box ${r1(hb.x)} to ${r1(hb.x + hb.w)})`, { room: rm, his: hb });
			}
			if (S.his && !S.r3 && kind === 'landscape') {
				const D = d.his.desktop;
				const u = d.geo.u;
				// (each piece named with what is off: its drawn width against his, its distance up from the bottom edge against his;
				// the amount's element is its reserved width, so its width is not his box's and only its distance is read)
				const bad = Object.keys(D.p)
					.map((id) => ({ id, dw: id === 'amt' ? 0 : d.dom[id].w - D.p[id][2] * u, dy: S.vp.height - d.geo.box[id].y - (D.plane.h - D.p[id][1]) * u }))
					.filter((x) => Math.abs(x.dw) > 1 || Math.abs(x.dy) > 0.5)
					.map((x) => `${x.id}: width ${x.dw >= 0 ? '+' : ''}${r1(x.dw)} px, from the bottom ${x.dy >= 0 ? '+' : ''}${r1(x.dy)} px`);
				check(Math.abs(u - S.vp.width / D.plane.w) < 0.001 && bad.length === 0, `${tag}: his 1440 x 810 plane at this window's scale, every piece his distance from the bottom edge`, bad);
			}
			if (kind === 'portrait' && d.dom.auto && d.dom.turbo) {
				const A = d.dom.auto;
				const T = d.dom.turbo;
				check(Math.abs(A.y + A.h / 2 - (T.y + T.h / 2)) <= 0.5 && Math.abs(A.w - T.w) <= 0.5, `${tag}: upright, Auto and Turbo are level (centers at y ${r1(A.y + A.h / 2)} and ${r1(T.y + T.h / 2)}) and one size (${r1(A.w)} and ${r1(T.w)} px)`, { auto: A, turbo: T });
			}
			check(d.win.shape === (kind === 'landscape' ? 'pill' : 'rect'), `${tag}: the Win box is a ${kind === 'landscape' ? 'pill' : 'rectangle'}`, d.win.shape);
			// ---- ONE NUMBER SIZE (round 3; Corey 2026-11-23) on every phone window and his seven: the three nominal sizes
			// within 1 px of each other, each number drawn at its nominal size times its own fit, 9 px or more at his seven
			if (d.type && d.fonts && (kind !== 'landscape' || S.r3)) {
				const n = d.type.num;
				const spread = Math.max(n.amt, n.bal, n.win) - Math.min(n.amt, n.bal, n.win);
				const fit = { amt: d.seat.k, bal: d.readouts.bal.k, win: d.readouts.win.k };
				const offs = ['amt', 'bal', 'win'].filter((id) => d.fonts[id] !== null && Math.abs(d.fonts[id] - n[id] * fit[id]) > 0.6).map((id) => `${id} drawn ${r1(d.fonts[id])} for ${r1(n[id] * fit[id])}`);
				const tags = d.type.head;
				check(spread <= 1 && offs.length === 0 && (!S.r3 || Math.min(n.amt, n.bal, n.win) >= 9) && Math.max(tags.amt, tags.bal, tags.win) - Math.min(tags.amt, tags.bal, tags.win) <= 0.6, `${tag}: Balance, the amount and Win are one number size (${r1(n.bal)} px; the amount's fit ${Math.round(fit.amt * 100)} %, Balance's ${Math.round(fit.bal * 100)} %, Win's ${Math.round(fit.win * 100)} %) and one tag size (${r1(tags.bal)} px)`, { nominal: n, drawn: d.fonts, fit, tags, offs });
			}
			// ---- BALANCE AND WIN AT THE AMOUNT'S SIZE, the DEV look (matchedType), at the sizes where the amount alone steps
			// down: off, the amount is the smaller; on, the three numbers are drawn one size; off again, as it was
			if (S.match && d.fonts) {
				const sizes = async () => (await signRead(p)).fonts;
				const off = d.fonts;
				await p.evaluate(() => void window.__reindeer.sign.matchNumbers(true));
				await sleep(120);
				const on = await sizes();
				await p.evaluate(() => void window.__reindeer.sign.matchNumbers(false));
				await sleep(120);
				const back = await sizes();
				const spread = (f) => Math.max(f.amt, f.bal, f.win) - Math.min(f.amt, f.bal, f.win);
				// (since the amount is sized per game mode, 2026-11-24, the base game's amount is the common size at most of
				// these windows and the look then changes nothing: what is asked is that with it on the three are one drawn
				// size, never larger than before, and that off puts Balance and Win back)
				check(spread(on) <= 0.6 && Math.abs(on.amt - off.amt) <= 0.3 && on.bal <= off.bal + 0.3 && on.win <= off.win + 0.3 && Math.abs(back.bal - off.bal) <= 0.3 && Math.abs(back.win - off.win) <= 0.3, `${tag}: the DEV look: by default the amount is ${r1(off.amt)} px beside Balance ${r1(off.bal)} and Win ${r1(off.win)} (${r1(off.bal - off.amt)} px apart); with sign.matchNumbers(true) the three are drawn ${r1(on.amt)} / ${r1(on.bal)} / ${r1(on.win)} px; off again as before`, { off, on, back });
			}
			// ---- THE HOME INDICATOR'S 20 px on a sideways touch phone (round 3, and the nudge up of 2026-11-24): nothing
			// pressed or read in it at his 832 x 376 and 667 x 311, the press boxes and the Win box's glass included
			if (S.low && d.lows) {
				const floor = S.vp.height - 20;
				// (the bet symbols as drawn: the layout's symbol height about each one's middle)
				const lows = { ...d.lows, 'the bet symbols drawn': Math.max(d.seat.downC[1], d.seat.upC[1]) + (d.geo.step * d.geo.u) / 2 };
				const drawn = Object.entries(lows).filter(([, y]) => y > floor + 0.5).map(([n, y]) => `${n} ends at ${r1(y)}`);
				const also = [["the bet symbols' press boxes", Math.max(d.seat.down.y + d.seat.down.h, d.seat.up.y + d.seat.up.h)], ['the Win box', d.geo.winGlass.y + d.geo.winGlass.h]].filter(([, y]) => y > floor + 0.5).map(([n, y]) => `${n} ends at ${r1(y)}`);
				check(drawn.length === 0 && (S.low !== 'strict' || also.length === 0), `${tag}: nothing a player presses or reads in the bottom 20 px (under ${floor})${S.low === 'strict' ? '' : ', of what is drawn'}`, [...drawn, ...also]);
				if (S.low !== 'strict' && also.length) console.log(`     ${tag}, listed (his own placing): ${also.join('; ')} of ${S.vp.height}`);
			}
			// ---- press regions ----
			// (2026-11-23: 44 at every window, his 568 x 320 and 667 x 375 too: there Auto's and Turbo's pads stand apart)
			const small = Object.entries(d.press).filter(([, v]) => v < 44 - 0.06).map(([id, v]) => `${id} ${r1(v)}`);
			const cannot = Object.entries(d.hitOk).filter(([, ok]) => !ok).map(([id]) => id);
			if (S.listOnly) console.log(`     ${tag}, listed only: press regions under 44: ${small.join(', ') || 'none'}; problems: ${d.problems.join('; ') || 'none'}; amount ${r1(d.seat.px)} px${d.seat.under ? ' (under the floor)' : ''}`);
			else check(small.length === 0, `${tag}: every press region holds a 44 CSS px circle`, small);
			check(cannot.length === 0, `${tag}: a press on each control's middle lands on that control`, cannot);
			// ---- Auto's and Turbo's press pads (where their drawn diamonds hold less than 44 px), by their real shapes ----
			{
				const pads = Object.entries(d.padHit ?? {});
				const off = pads.filter(([, q]) => q.drawn.some((v, k) => Math.abs(v - q.want[k]) > 0.6)).map(([id, q]) => `${id} drawn ${q.drawn.map(r1).join(', ')} for ${q.want.map(r1).join(', ')}`);
				const stray = pads.flatMap(([id, q]) => q.other.map((x) => `${id}: ${x}`));
				const moved = pads.map(([id, q]) => `${id} ${r1(Math.hypot(q.c[0] - q.key[0], q.c[1] - q.key[1]))} px from its key's middle${q.split ? ', cut at the middle line' : ''}`).join(', ');
				const tested = pads.reduce((n, [, q]) => n + q.points, 0);
				const line = d.padLine;
				if (S.listOnly) console.log(`     ${tag}, listed only: the press pads: ${moved || 'none'}${stray.length ? '; ' + stray.join('; ') : ''}${line?.wrong.length ? '; the middle line: ' + line.wrong.join('; ') : ''}`);
				else if (pads.length) {
					check(off.length === 0 && stray.length === 0, `${tag}: Auto's and Turbo's press pads are drawn as the rule's shapes (${moved}), and a press at each of ${tested} points inside a pad's own shape (its middle, and on 16 rays half way out and 1.5 px inside its outline) lands on that pad or its own key`, [...off, ...stray]);
					if (line) check(line.wrong.length === 0, `${tag}: along the line through the two pads' middles (${r1(line.apart)} px apart, ${line.points} points 1 px apart) no press on one key's side of the middle line lands on the other key's pad`, line.wrong);
				}
			}
			// ---- WHOSE PRESS IS IT, OF AUTO AND TURBO (2026-11-23, signLayout.ts pressOwner; the probe host's tap at
			// 844 x 390 in the bare ground between the two diamonds turned Turbo on). THE RULE: where the two drawn keys
			// overlap, the key drawn on top (Turbo, drawn after Auto; the drawn diamonds overlap at no window, their upright
			// boxes do); outside that, the key whose drawing or pad the place is in; anywhere else, neither. Tested with
			// TOUCH taps (a browser hands a touch to a nearby button by the buttons' boxes and paint order; the bar judges
			// the press by where the finger went down), on the line through the two pads' middles:
			//   bare ground, 1 px each side of the middle line (where the rule says nobody's): nothing happens
			//   Auto's pad, 1.5 px inside its outline toward Turbo: Turbo's level stays, the autoplay card opens (closed again)
			//   Turbo's pad, 1.5 px inside its outline toward Auto: Turbo steps one level, no autoplay card (set back)
			if (S.touch && !S.listOnly && d.padLine && d.padHit?.auto && d.padHit?.turbo) {
				const a = d.padHit.auto.c;
				const t = d.padHit.turbo.c;
				const dist = Math.hypot(t[0] - a[0], t[1] - a[1]);
				const n = [(t[0] - a[0]) / dist, (t[1] - a[1]) / dist];
				const on = (v) => [a[0] + n[0] * v, a[1] + n[1] * v];
				const owner = (q) => p.evaluate((q) => window.__reindeer.sign.owner(q[0], q[1]), q);
				const read = () => p.evaluate(() => ({ turbo: document.querySelector('.hudp [data-hud="turbo"]')?.dataset.l ?? null, card: !!document.querySelector('.am-ui.layer.modals .panel') }));
				const tap = async (q) => {
					await p.touchscreen.tap(q[0], q[1]);
					await sleep(300);
					const got = await read();
					const under = await p.evaluate((q) => document.elementsFromPoint(q[0], q[1]).slice(0, 3).map((e) => `${e.tagName.toLowerCase()}${e.getAttribute('data-pad') ? `[data-pad=${e.getAttribute('data-pad')}]` : ''}${e.getAttribute('data-hud') ? `[data-hud=${e.getAttribute('data-hud')}]` : ''}`), q);
					return { ...got, at: q.map(r1), under };
				};
				const settle0 = async (want) => {
					// back to how it was: the autoplay card closed, Turbo at its level (presses on the key's own middle)
					if (await p.evaluate(() => !!document.querySelector('.am-ui.layer.modals .panel'))) {
						await p.click('.am-ui.layer.modals button.x[aria-label="Close"]').catch(() => {});
						for (let k = 0; k < 20 && (await read()).card; k++) await sleep(150);
					}
					for (let k = 0; k < 3 && (await read()).turbo !== want; k++) {
						await p.click('.hudp [data-hud="turbo"]');
						await sleep(200);
					}
				};
				const was = await read();
				// bare ground
				const bare = [];
				for (const s of [-1, 1]) {
					const q = on(dist / 2 + s);
					if ((await owner(q)) !== null) continue;
					const got = await tap(q);
					bare.push({ side: s < 0 ? "1 px on Auto's side" : "1 px on Turbo's side", ...got });
					await settle0(was.turbo);
				}
				if (bare.length) check(bare.every((b) => b.turbo === was.turbo && !b.card), `${tag}: a touch tap in the bare ground between Auto and Turbo (in neither drawn key and neither pad, ${bare.map((b) => `${b.side} of the middle line at ${b.at.join(', ')}`).join(' and ')}) presses neither key`, { was, bare });
				else console.log(`     ${tag}: no bare ground on the line between Auto's and Turbo's pads (they stand ${r1(dist - 44)} px apart): the bare ground taps are not made`);
				// each pad's ground nearest the other key
				const qa = on(22 - 1.5);
				const qt = on(dist - 22 + 1.5);
				if ((await owner(qa)) === 'auto' && (await owner(qt)) === 'turbo') {
					const ga = await tap(qa);
					await settle0(was.turbo);
					const gt = await tap(qt);
					await settle0(was.turbo);
					const stepped = gt.turbo !== null && gt.turbo !== was.turbo;
					check(ga.turbo === was.turbo && ga.card && stepped && !gt.card, `${tag}: a touch tap in Auto's pad 1.5 px from its edge toward Turbo is Auto's (the autoplay card opens, Turbo stays at ${was.turbo}), and one in Turbo's pad 1.5 px from its edge toward Auto is Turbo's (its level steps, no autoplay card)`, { was, auto: ga, turbo: gt });
					const end = await read();
					check(end.turbo === was.turbo && !end.card, `${tag}: after the taps Turbo is back at ${was.turbo} and the autoplay card is closed`, end);
				}
			}
			// ---- WHAT THE RULE NAMES A CONTROL'S GROUND IS COVERED (2026-11-23; the probe host on b32bacde: owner() named
			// places a key's where only the canvas lay, so a press there did nothing: the Spin's top corner on the desktop,
			// Auto's bottom corner at 568 x 320). The rule's shapes are the buttons' own round cornered ones now, and each
			// is drawn once more as a catch outline under the controls (.sgcatch). On a grid 2 px apart over every control's
			// ground (__reindeer.sign.shapes and the pads, 3 px round each): wherever owner() names a control, the top
			// element there is one of the bar's own press takers (a button, a pad or a catch outline), never the canvas.
			{
				const cover = await p.evaluate(() => {
					const S = window.__reindeer.sign;
					if (!S.shapes) return null;
					const shapes = S.shapes();
					const pads = S.pads().shapes;
					const groups = Object.entries(shapes).map(([id, P]) => [id, [...P, ...(pads[id]?.poly ?? [])]]);
					const bar = document.querySelector('.hudp.sg');
					const naked = [];
					let owned = 0;
					let viaCatch = 0;
					for (const [, P] of groups) {
						const xs = P.map((q) => q[0]);
						const ys = P.map((q) => q[1]);
						for (let y = Math.max(0.5, Math.min(...ys) - 3); y <= Math.min(window.innerHeight - 0.5, Math.max(...ys) + 3); y += 2)
							for (let x = Math.max(0.5, Math.min(...xs) - 3); x <= Math.min(window.innerWidth - 0.5, Math.max(...xs) + 3); x += 2) {
								const o = S.owner(x, y);
								if (!o) continue;
								owned++;
								const at = document.elementFromPoint(x, y);
								const taker = at && bar.contains(at) ? at.closest('button, .sgpad, .sgcatch') : null;
								if (taker?.matches('.sgcatch')) viaCatch++;
								if (!taker && naked.length < 6) naked.push(`(${x.toFixed(1)}, ${y.toFixed(1)}) is ${o}'s and the top element is ${at ? at.tagName.toLowerCase() + (at.getAttribute('class') ? '.' + String(at.getAttribute('class')).trim().split(/\s+/)[0] : '') : 'nothing'}`);
								else if (!taker) naked.push('');
							}
					}
					return { owned, viaCatch, naked: naked.filter(Boolean), nakedCount: naked.length, catches: document.querySelectorAll('.hudp.sg .sgcatch').length, controls: Object.keys(shapes).length };
				});
				if (!cover) check(false, `${tag}: the bar tells its controls' press shapes (__reindeer.sign.shapes)`);
				else check(cover.nakedCount === 0 && cover.catches === cover.controls, `${tag}: every place the press rule names a control's (${cover.owned} tried, 2 px apart) has one of the bar's own press takers on top (a key, a pad, or the control's catch outline: ${cover.viaCatch} of them); a catch outline for each of the ${cover.controls} controls`, cover);
			}
			// MENU'S EDGE (the probe host by hand, 390 x 844 touch: 0.1 to 0.5 px inside Menu's bottom edge, owner menu,
			// nothing happened): at the walk's sizes, a press 0.5 px inside Menu's edge nearest the Spin opens the menu.
			if (S.walk) {
				const M = await p.evaluate(() => {
					const g = window.__reindeer.sign.geo();
					return { menu: g.box.menu, play: g.box.play };
				});
				const a = [M.menu.x + M.menu.w / 2, M.menu.y + M.menu.h / 2];
				const b = [M.play.x + M.play.w / 2, M.play.y + M.play.h / 2];
				const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
				const n = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
				const last = await p.evaluate(
					({ a, n, len }) => {
						let v = 0;
						while (v + 0.1 <= len && window.__reindeer.sign.owner(a[0] + n[0] * (v + 0.1), a[1] + n[1] * (v + 0.1)) === 'menu') v += 0.1;
						return v;
					},
					{ a, n, len },
				);
				const q = [a[0] + n[0] * (last - 0.5), a[1] + n[1] * (last - 0.5)];
				const open = () => p.evaluate(() => !!document.querySelector('.hudp.sg.menu-open'));
				const was = await open();
				if (S.touch) await p.touchscreen.tap(q[0], q[1]);
				else await p.mouse.click(q[0], q[1]);
				await sleep(350);
				const now = await open();
				check(!was && now, `${tag}: a ${S.touch ? 'touch tap' : 'mouse press'} 0.5 px inside Menu's edge nearest the Spin (${q.map(r1).join(', ')}, ${r1(last)} px from its middle) opens the menu`, { was, now, under: await p.evaluate((q) => document.elementsFromPoint(q[0], q[1]).slice(0, 3).map((e) => e.tagName.toLowerCase() + (e.getAttribute('data-catch') ? `[data-catch=${e.getAttribute('data-catch')}]` : '') + (e.getAttribute('data-hud') ? `[data-hud=${e.getAttribute('data-hud')}]` : '')), q) });
				if (await open()) {
					await p.click('.hudp [data-hud="menu-key"]');
					await sleep(350);
				}
				check(!(await open()), `${tag}: a press on Menu's middle closes the menu again`);
				// ESCAPE (2026-11-23, the probe host: Escape left the green pop-out open, and at 400 x 225 it then covered the
				// Auto key; ui/sign/SignMenuPanel.svelte): it closes the menu, the Menu key has the focus, no round starts
				{
					const playsWas = await p.evaluate(() => window.__reindeer.fixtures?.log?.().plays.length ?? 0);
					await p.click('.hudp [data-hud="menu-key"]');
					await sleep(350);
					const up = await open();
					await p.keyboard.press('Escape');
					await sleep(350);
					const esc = await p.evaluate(() => ({ open: !!document.querySelector('.hudp.sg.menu-open'), focus: document.activeElement?.getAttribute('data-hud') ?? null, plays: window.__reindeer.fixtures?.log?.().plays.length ?? 0 }));
					check(up && !esc.open && esc.focus === 'menu-key' && esc.plays === playsWas, `${tag}: Escape closes the open menu, the Menu key has the focus after, no round starts`, { up, ...esc, playsWas });
				}
			}
			// ---- THE SPIN'S NEIGHBOURS (2026-11-23; the probe host, touch, 844 x 390 and 667 x 375: a tap 2 px inside
			// Turbo's edge nearest the Spin STARTED A ROUND and left Turbo as it was; a mouse at the same place turned Turbo
			// on). THE RULE: a round starts only from a press that went down inside the Spin's own diamond; a press that went
			// down in Auto's or Turbo's drawing or pad is that key's and never starts a round. A browser hands a touch to a
			// nearby button by the buttons' upright boxes and paint order (the Spin's box covers its neighbours' ground and
			// it is drawn after them); the bar judges every click by where the pointer went down (SignHud.svelte barPress).
			// THE WALK (sizes marked walk: 1200x675 by mouse; 844x390, 667x375, 568x320 and 390x844 by touch): on the line
			// from each of Auto's and Turbo's middles to the Spin's middle, by __reindeer.sign.owner every 0.5 px:
			//   2 px inside the key's last place   no round starts (still at rest and idle 900 ms on); the key acts (Turbo
			//                                      steps a level, Auto opens the autoplay card)
			//   2 px inside the Spin's first place a round starts (not at rest or not idle within 1.5 s); Turbo's level is
			//                                      as it was and no autoplay card opened
			// Rounds are no win fixture rounds; everything is set back.
			if (S.walk) {
				const press = S.touch ? (q) => p.touchscreen.tap(q[0], q[1]) : (q) => p.mouse.click(q[0], q[1]);
				const how = S.touch ? 'touch tap' : 'mouse press';
				const G = await p.evaluate(() => {
					const g = window.__reindeer.sign.geo();
					return { play: g.box.play, auto: g.box.auto, turbo: g.box.turbo };
				});
				const mid = (b) => [b.x + b.w / 2, b.y + b.h / 2];
				const read = () => p.evaluate(() => ({ turbo: document.querySelector('.hudp [data-hud="turbo"]')?.dataset.l ?? null, card: !!document.querySelector('.am-ui.layer.modals .panel'), rest: window.__reindeer.atRest(), idle: window.__reindeer.hud.idle() }));
				const under = (q) => p.evaluate((q) => document.elementsFromPoint(q[0], q[1]).slice(0, 3).map((e) => `${e.tagName.toLowerCase()}${e.getAttribute('data-pad') ? `[data-pad=${e.getAttribute('data-pad')}]` : ''}${e.getAttribute('data-hud') ? `[data-hud=${e.getAttribute('data-hud')}]` : ''}`), q);
				/** did a round start within `ms` of now */
				const started = async (ms) => {
					for (const t0 = Date.now(); Date.now() - t0 < ms; ) {
						const st = await read();
						if (!st.rest || !st.idle) return true;
						await sleep(60);
					}
					return false;
				};
				const back = async (want) => {
					if ((await read()).card) {
						await p.click('.am-ui.layer.modals button.x[aria-label="Close"]').catch(() => {});
						for (let k = 0; k < 20 && (await read()).card; k++) await sleep(150);
					}
					await settle(p, S);
					for (let k = 0; k < 3 && (await read()).turbo !== want; k++) {
						await p.click('.hudp [data-hud="turbo"]');
						await sleep(200);
					}
				};
				await p.evaluate(() => window.__reindeer.fixtures.next('no_win_1', true));
				await settle(p, S);
				const was = await read();
				for (const id of ['turbo', 'auto']) {
					if (!(await p.evaluate((id) => !!document.querySelector(`.hudp button[data-hud="${id}"]`), id))) continue;
					const a = mid(G[id]);
					const b = mid(G.play);
					const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
					const n = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
					const owners = await p.evaluate(
						({ a, n, len }) => {
							const out = [];
							for (let v = 0; v <= len; v += 0.5) out.push(window.__reindeer.sign.owner(a[0] + n[0] * v, a[1] + n[1] * v));
							return out;
						},
						{ a, n, len },
					);
					let last = -1;
					while (last + 1 < owners.length && owners[last + 1] === id) last++;
					const first = owners.indexOf('play');
					// the walk as runs: whose ground from where to where (another control may lie between: upright, Auto stands
					// between Turbo and the Spin)
					const runs = [];
					owners.forEach((o, k) => {
						const who = o === null ? "nobody's" : o === 'play' ? 'the Spin' : o;
						if (runs.length && runs[runs.length - 1].who === who) runs[runs.length - 1].to = k / 2;
						else runs.push({ who, from: k / 2, to: k / 2 });
					});
					const walk = runs.map((r) => `${r.who} ${r.from}..${r.to}`).join(' | ');
					// (2026-11-23: this line asked for nobody's ground alone between the key and the Spin, and failed at 390 x 844,
					// where Auto's ground lies between Turbo and the Spin; what must hold is the key's ground first, the Spin's
					// last and unbroken to its middle, and neither of the two in between)
					if (last < 4 || first < 0 || owners.slice(last + 1, first).some((o) => o === id || o === 'play') || owners.slice(first).some((o) => o !== 'play')) {
						check(false, `${tag}: on the line from ${id}'s middle to the Spin's the ground is ${id}'s, then other controls' or nobody's, then the Spin's to its middle`, walk);
						continue;
					}
					const qk = [a[0] + n[0] * (last / 2 - 2), a[1] + n[1] * (last / 2 - 2)];
					const qp = [a[0] + n[0] * (first / 2 + 2), a[1] + n[1] * (first / 2 + 2)];
					const inSpinBox = await p.evaluate((q) => {
						const r = document.querySelector('.hudp button[data-hud="play"]')?.getBoundingClientRect();
						return !!r && q[0] >= r.left && q[0] <= r.right && q[1] >= r.top && q[1] <= r.bottom;
					}, qk);
					// the key's edge: its own press, no round
					const uk = await under(qk);
					await press(qk);
					const roundK = await started(900);
					const gk = await read();
					const acted = id === 'turbo' ? gk.turbo !== null && gk.turbo !== was.turbo : gk.card;
					check(!roundK && acted && (id === 'turbo' ? !gk.card : gk.turbo === was.turbo), `${tag}: a ${how} 2 px inside ${id === 'turbo' ? "Turbo's" : "Auto's"} edge nearest the Spin (${qk.map(r1).join(', ')}, ${inSpinBox ? "inside the Spin button's upright box" : "outside the Spin button's box"}) starts no round and is ${id === 'turbo' ? "Turbo's (its level steps, no autoplay card)" : "Auto's (the autoplay card opens, Turbo's level stays)"}`, { walk, was, got: gk, round: roundK, under: uk });
					await back(was.turbo);
					// the Spin's edge: a round, the key untouched
					const up2 = await under(qp);
					await press(qp);
					const roundP = await started(1500);
					const gp = await read();
					check(roundP && gp.turbo === was.turbo && !gp.card, `${tag}: a ${how} 2 px inside the Spin's edge nearest ${id === 'turbo' ? 'Turbo' : 'Auto'} (${qp.map(r1).join(', ')}) starts a round and leaves ${id === 'turbo' ? 'Turbo' : 'Auto'} as it was`, { walk, was, got: gp, round: roundP, under: up2 });
					await back(was.turbo);
				}
				await p.evaluate(() => window.__reindeer.fixtures.clear?.());
				const end = await read();
				check(end.turbo === was.turbo && !end.card && end.rest && end.idle, `${tag}: after the walk the game is at rest, Turbo back at ${was.turbo}, no autoplay card`, end);
			}
			// ---- the scene and the Play ----
			const real = d.problems.filter((x) => !/press region/.test(x));
			if (!S.listOnly) check(real.length === 0, `${tag}: nothing on the board, the LED strip or the logo, no bet symbol on the Play (by real shape)`, real);
			// ---- the amount ----
			if (!S.listOnly) {
				amountFits(tag, d);
				const before = JSON.stringify([d.dom.down, d.dom.up]);
				for (let i = 0; i < 3; i++) {
					await p.click('.hudp [data-hud-step="plus"]', { timeout: 1500 }).catch(() => {});
					await sleep(120);
				}
				let e = await signRead(p);
				check(JSON.stringify([e.dom.down, e.dom.up]) === before, `${tag}: the bet symbols hold still across bet steps (${d.value?.text} to ${e.value?.text})`);
				for (let i = 0; i < 3; i++) {
					await p.click('.hudp [data-hud-step="minus"]', { timeout: 1500 }).catch(() => {});
					await sleep(120);
				}
				const base = d.mode;
				await p.evaluate(() => window.__reindeer.hud.setMode('ANTE_10'));
				await sleep(500);
				e = await signRead(p);
				amountFits(`${tag} with 10X ANTE on`, e);
				// (2026-11-24) THE ARROWS STAY WHERE THEY ARE when a mode is loaded; the number's size is the mode's own
				// (never larger than in the base game, whose widest amount is the shorter)
				check(JSON.stringify([e.dom.down, e.dom.up]) === before && e.seat.px <= d.seat.px + 0.05, `${tag} with 10X ANTE on: the bet symbols have not moved, and the number is sized for this mode's widest amount (${r1(e.seat.px)} px for ${e.seat.widest}; the base game's ${r1(d.seat.px)} px for ${d.seat.widest})`, { base: [d.dom.down, d.dom.up], ante: [e.dom.down, e.dom.up] });
				const pr = e.problems.filter((x) => !/press region/.test(x));
				check(pr.length === 0, `${tag} with 10X ANTE on: still nothing on the scene or the Play`, pr);
				await p.evaluate((m) => window.__reindeer.hud.setMode(m), base);
				await sleep(400);
			}
			if (!S.listOnly) await longBalance(tag, p, S, 1e7, '10000000');
			// ---- the words and the Win box ----
			check(d.play.words.join(' ') === 'SPIN' && d.play.label === 'Spin' && !d.play.red, `${tag}: at rest the Play says SPIN on its green face`, d.play);
			check(d.win.on === false && d.win.opacity === 0, `${tag}: the Win box is hidden at rest`, d.win);
			await p.evaluate(() => window.__reindeer.fixtures.next('plain_line_win'));
			await signRecStart(p);
			await spinOnce(p);
			let stop = null;
			for (let i = 0; i < 30 && !stop; i++) {
				const e = await signRead(p);
				if (e.play.words.join(' ') === 'STOP') stop = e.play;
				else await sleep(60);
			}
			check(!!stop && stop.label === 'Stop' && stop.red, `${tag}: while the round's stop is available the Play says STOP on its red face`, stop);
			let shown = null;
			let shownGlass = null;
			for (let i = 0; i < 160 && !shown; i++) {
				const e = await signRead(p);
				if (e.win.on && e.win.opacity > 0.9) shown = e.win;
				else await sleep(120);
			}
			check(!!shown && /[1-9]/.test(shown.text), `${tag}: a win shows the Win box with its amount`, shown);
			{
				// its place, risen: his box (the header plate and the amount inside it)
				await sleep(600);
				const e = await signRead(p);
				shownGlass = e.win.rects.glass;
				const a = e.dom.win;
				const b = want('win');
				const dd = a ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h)) : 99;
				check(dd <= 1, `${tag}: the Win box, up, within 1 CSS px of ${ref ? 'his place' : "the rule's place"}`, { off: r1(dd), drawn: a, his: b });
			}
			await settle(p, S);
			await p.evaluate(() => window.__reindeer.fixtures.next('no_win_1'));
			await spinOnce(p);
			let gone = null;
			for (let i = 0; i < 60 && !gone; i++) {
				const e = await signRead(p);
				if (!e.win.on && e.win.opacity < 0.05) gone = e.win;
				else await sleep(100);
			}
			check(!!gone, `${tag}: the next spin takes the Win box away`, gone);
			await settle(p, S);
			await sleep(700);
			signRecJudge(`${tag} two rounds, one press each`, await signRecStop(p));
			// ---- an Autoplay run: a win, then rounds with none (the box must not linger between them) ----
			if (S.auto) {
				const plays = () => p.evaluate(() => window.__reindeer.fixtures.log().plays.length);
				const n0 = await plays();
				await p.evaluate(() => window.__reindeer.fixtures.next('plain_line_win'));
				await p.click('.hudp button[aria-label="Autoplay"]');
				await sleep(700);
				await signRecStart(p);
				await p.click('.am-ui.layer.modals .go'); // START: the run begins at once
				for (let i = 0; i < 200 && (await plays()) < n0 + 1; i++) await sleep(50);
				await p.evaluate(() => window.__reindeer.fixtures.next('no_win_1', true));
				for (let i = 0; i < 600 && (await plays()) < n0 + 4; i++) await sleep(100);
				const ran = (await plays()) - n0;
				// (the Auto key's press stops a live run)
				await p.click('.hudp button[aria-label="Autoplay"]', { timeout: 2000 }).catch(() => {});
				await settle(p, S);
				await sleep(500);
				const rows = await signRecStop(p);
				await p.evaluate(() => window.__reindeer.fixtures.clear());
				check(ran >= 4 && rows.some((r) => r.m === 'auto'), `${tag}: an Autoplay run played ${ran} rounds (a win, then rounds with none)`);
				signRecJudge(`${tag} Autoplay`, rows, { stop: false });
				await settle(p, S);
			}
			// ---- free spins: the Win box stays, the ring counts, a retrigger adds three ----
			if (S.fs && !process.env.SKIPFS) {
				// (his place for WIN, risen, read above: the glass must be the same box all through free spins)
				const glass0 = shownGlass;
				const strip = d.inputs.zones.strip;
				await p.evaluate((f) => window.__reindeer.fixtures.next(f), S.fs);
				await spinOnce(p);
				const seen = [];
				let inFs = false;
				const t0 = Date.now();
				for (;;) {
					const st = await p.evaluate(() => ({ g: window.__reindeer.hud.gates(), idle: window.__reindeer.hud.idle(), rest: window.__reindeer.atRest() })).catch(() => null);
					const e = await signRead(p).catch(() => null);
					if (e && e.gameType === 'freegame' && e.ring) {
						inFs = true;
						seen.push({ total: e.ring.total, leds: e.ring.leds, lit: e.ring.lit, words: e.play.words.join(' '), win: e.win.on, box: e.win.opacity, red: e.play.red, rects: e.win.rects, skip: e.skip });
					}
					if (st && st.g > 0) await p.mouse.click(S.vp.width / 2, S.vp.height * 0.4).catch(() => {});
					else if (st && st.idle && st.rest && (inFs || Date.now() - t0 > 20000)) break;
					if (Date.now() - t0 > 300000) break;
					await sleep(200);
				}
				const totals = [...new Set(seen.map((x) => x.total))];
				if (S.fs === 'retrigger') check(seen.length > 10 && totals[0] === 10 && totals.includes(13) && totals.every((t, i) => i === 0 || t === totals[i - 1] + 3), `${tag}: the ring starts at 10 LEDs and a retrigger adds three (totals seen ${totals.join(', ')})`, seen.length);
				else check(seen.length > 10 && totals[0] === 10, `${tag}: the ring starts at 10 LEDs (totals seen ${totals.join(', ')})`, seen.length);
				check(seen.every((x) => x.leds === x.total), `${tag}: one LED per free spin of the round's total`, seen.find((x) => x.leds !== x.total));
				{
					// SKIP TO RESULT, up in the free spins: on no piece of the bar; upright (Corey 2026-11-22: "I'd move it to the left
					// of the Menu Button on Portrait") on Menu's row at Menu's height, to Menu's left and clear of it, inside the
					// window, off the logo sign and under the top line, at least 44 CSS px to press
					const sk = seen.find((x) => x.skip?.up)?.skip ?? null;
					check(!!sk, `${tag}: SKIP TO RESULT is up in the free spins`);
					if (sk) {
						const meets = (q) => !!q && Math.min(sk.x + sk.w, q.x + q.w) - Math.max(sk.x, q.x) > 0.5 && Math.min(sk.y + sk.h, q.y + q.h) - Math.max(sk.y, q.y) > 0.5;
						const on = Object.entries(d.dom).filter(([id, q]) => id !== 'win' && meets(q)).map(([id]) => id);
						check(on.length === 0, `${tag}: SKIP TO RESULT stands on no piece of the bar`, { skip: sk, on });
						if (kind === 'portrait') {
							const m = d.dom.menu;
							const topLine = await p.evaluate(() => Math.max(0, ...[...document.querySelectorAll('[data-top-line]')].map((e) => e.getBoundingClientRect().bottom)));
							// (round 3: at and near his windows the button is his own box by its share there, __reindeer.sign.scene; his
							// box at 413 x 586 and 375 x 530 is under 44 px tall, and the button's unseen pad, SkipButton .skip::after,
							// makes its press area up to 44: the rule's own box is asked for 44 only where his has no share)
							const share = d.scene?.skip ? d.scene.share : 0;
							const hisBox = share > 0 ? d.scene.skip : null;
							const onHis = !hisBox || ['x', 'y', 'w', 'h'].every((k) => Math.min(Math.abs(sk[k] - hisBox[k]), share >= 1 ? Infinity : 0) <= 1);
							check((share > 0 ? onHis && Math.abs(sk.y - m.y) <= 6 : Math.abs(sk.y - m.y) <= 1 && Math.abs(sk.h - m.h) <= 1 && Math.min(sk.w, sk.h) >= 43.9) && sk.x + sk.w <= m.x - 2 && sk.x >= 0 && !meets(d.inputs.zones.logo) && !meets(d.inputs.zones.board) && sk.y >= topLine - 0.5, `${tag}: upright, SKIP TO RESULT is on Menu's row to Menu's left (${r1(sk.x)}, ${r1(sk.y)}, ${r1(sk.w)} x ${r1(sk.h)}; Menu from ${r1(m.x)}), off the logo, the board and the top line, 44 px to press`, { skip: sk, menu: m, logo: d.inputs.zones.logo, topLine });
						}
					}
				}
				check(seen.every((x) => x.words === `SPIN ${x.lit} OF ${x.total}` && x.red), `${tag}: the lit LEDs are the spin in play, as the Play's words say (SPIN n OF total, red face)`, seen.find((x) => x.words !== `SPIN ${x.lit} OF ${x.total}`));
				check(seen.every((x, i) => i === 0 || x.lit >= seen[i - 1].lit), `${tag}: a lit LED never goes dark in the round`);
				check(seen.every((x) => x.win) && seen.slice(5).every((x) => x.box > 0.9), `${tag}: the Win box stays all through free spins`, seen.find((x) => !x.win));
				{
					// THE FREE SPINS WIN BOX: the same glass as WIN's, its header plate inside the glass's width, and the whole of it
					// (glass, plate, number) clear of the LED strip, on every sample once it has risen
					const up = seen.slice(5).filter((x) => x.rects?.glass && x.rects.plate && x.rects.value);
					const same = up.filter((x) => !glass0 || ['x', 'y', 'w', 'h'].some((k) => Math.abs(x.rects.glass[k] - glass0[k]) > 0.6));
					const wide = up.filter((x) => x.rects.plate.x < x.rects.glass.x - 0.6 || x.rects.plate.x + x.rects.plate.w > x.rects.glass.x + x.rects.glass.w + 0.6);
					const gapTo = (q) => Math.max(strip.x - (q.x + q.w), q.x - (strip.x + strip.w), strip.y - (q.y + q.h), q.y - (strip.y + strip.h));
					const gaps = up.map((x) => Math.min(gapTo(x.rects.glass), gapTo(x.rects.plate), gapTo(x.rects.value)));
					const least = gaps.length ? Math.min(...gaps) : -1;
					check(up.length > 5 && same.length === 0 && wide.length === 0, `${tag}: in free spins the Win box is the box it is for WIN, its FREE SPINS WIN plate inside the glass (${up.length} samples)`, { glassForWin: glass0, moved: same[0]?.rects.glass, plateOut: wide[0]?.rects });
					check(least >= 0, `${tag}: in free spins the Win box (glass, plate and number) is clear of the LED strip (${r1(least)} px at the nearest)`, { strip, least: r1(least) });
				}
			}
			if (SHOTS) await p.screenshot({ path: join(SHOTS, `signhud_${S.name}.png`) });
			check(errs.length === 0, `${tag}: no page errors`, errs.slice(0, 3));
		} finally {
			await ctx.close();
		}
		// ---- three currencies: the amount still fits (two more boots at four of the sizes) ----
		if (S.cur)
			for (const cur of ['JPY', 'BTC', 'XGC']) {
				// (XGC is the social site's coin: its page is the social one)
				const b = await boot(browser, S, `${cur === 'XGC' ? '&social=true' : ''}&currency=${cur}`);
				try {
					await settle(b.p, S);
					const d = await signRead(b.p);
					if (d) {
						amountFits(`signhud ${S.name} ${cur}`, d);
						const pr = d.problems.filter((x) => !/press region/.test(x));
						check(pr.length === 0, `signhud ${S.name} ${cur}: nothing on the scene or the Play`, pr);
						await longBalance(`signhud ${S.name} ${cur}`, b.p, S, cur === 'XGC' ? 1e9 : 1e7, cur === 'XGC' ? '1000000000' : '10000000');
					} else check(false, `signhud ${S.name} ${cur}: __reindeer.sign answers`);
				} finally {
					await b.ctx.close();
				}
			}
	}
}

(async () => {
	const browser = await chromium.launch({ args: ['--mute-audio'] }); // muted: every probe browser on the owner's Mac
	try {
		for (const S of SIZES) {
			if (ONLY.length && !ONLY.includes(S.name)) continue;
			try {
				await runSize(browser, S);
			} catch (e) {
				check(false, `${S.name}: ran to the end`, String(e).slice(0, 300));
			}
		}
		if (!ONLY.length || ONLY.includes('signhud')) {
			try {
				await signHud(browser);
			} catch (e) {
				check(false, 'signhud: ran to the end', String(e).slice(0, 300));
			}
		}
		if (!ONLY.length || ONLY.includes('social')) {
			try {
				await socialWords(browser);
			} catch (e) {
				check(false, 'social: ran to the end', String(e).slice(0, 300));
			}
		}
		if (!ONLY.length || ONLY.includes('rounds')) {
			try {
				await everyRoundTurns(browser);
			} catch (e) {
				check(false, 'rounds: ran to the end', String(e).slice(0, 300));
			}
		}
		if (!ONLY.length || ONLY.includes('home')) {
			try {
				await homePose(browser);
			} catch (e) {
				check(false, 'home: ran to the end', String(e).slice(0, 300));
			}
		}
		if (!ONLY.length || ONLY.includes('cards')) {
			try {
				await cardsHud(browser);
			} catch (e) {
				check(false, 'cards: ran to the end', String(e).slice(0, 300));
			}
		}
		if (!ONLY.length || ONLY.includes('reduced')) {
			try {
				await reducedMotion(browser);
			} catch (e) {
				check(false, 'reduced: ran to the end', String(e).slice(0, 300));
			}
		}
		if (!ONLY.length || ONLY.includes('tail')) {
			try {
				await tailSection(browser);
			} catch (e) {
				check(false, 'tail: ran to the end', String(e).slice(0, 300));
			}
		}
		if (FLIP && (!ONLY.length || ONLY.includes('flip'))) {
			try {
				await flip(browser);
			} catch (e) {
				check(false, 'flip: ran to the end', String(e).slice(0, 300));
			}
		}
	} finally {
		await browser.close();
	}
	console.log(`\nhud_probe: ${pass} pass, ${fail} fail`);
	process.exit(fail ? 1 : 0);
})();
