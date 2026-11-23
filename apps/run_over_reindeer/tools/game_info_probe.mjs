// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{ui/GameInfoModal.svelte,game/gameInfoText.ts,game/bonusStockRules.ts};
// WATCHES: ; __reindeer.hud, __reindeer.atRest, __reindeer.stockRules, AUTOPLAY_RESUME_PAUSE_MS, data-gameinfo, data-guide, data-guide-row, data-tab
// WATCHES: ; AUTO_PLAYS_BASE, FEATURE_NOT_IN_AUTO, startAutoplay
// WATCHES: ; .content, .tabs, .guide-row, .guide-icon, .guide-name, GuideId, guideRowShown
// WATCHES: ; TIERS, tier, narrow, short, lowHead, .brk, .tab, .face, .x, .hd, .ttl, data-gi-close, data-gi-tier
// WATCHES: ; .sp-plate, .sm-plate, --sp-f-top, --sp-f-bot, stackPays, payCells
// WATCHES: ; gs, --gi-s, --gi-mv, marginV, signVars
// THE GAME INFO PROBE (2026-11-18): the rules page's UI GUIDE section (ui/GameInfoModal.svelte, game/gameInfoText.ts
// guide), at every size the game is shown at, Stake's two popouts included (S 400 x 225, L 800 x 450):
//   · the page opens from the menu's GAME INFO; the UI Guide tab is there; a press on it scrolls the guide to the top of
//     the page's scroller (the page scrolls inside itself, the window never does)
//   · the guide holds its rows (THE FAST LANE, Spin, Tap to Speed Up, Autoplay, Turbo, Menu, Sound, the amount,
//     Readouts, the symbol pays, Keyboard, Replay Mode), each with its glyph, name and text
//   · every row fits the page's width: no row, name or text wider than the scroller, no horizontal scroll, the glyph
//     inside its well
//   · the scroller reaches the guide's last row and the page's end (scrolled to the bottom)
//   · the Autoplay row states the pause after a bonus round as the game's own AUTOPLAY_RESUME_PAUSE_MS (read from the
//     game), and the Turbo row states the bonus round's regular speed and the base speed coming back
//   · autoplay never plays a loaded feature (2026-11-19, ui/controls.svelte.ts startAutoplay): the Autoplay row says it
//     plays base game spins (Ante spins with the Ante on) and that starting a run unloads a loaded round; the feature
//     menu's row says a round cannot be loaded while a run is playing
//   - the menu's START begins the run (2026-11-23): the Autoplay row names START and that it starts the run right away,
//     and no row says LOAD or that a run waits on the Spin button
//   · the rules' paragraph on the Super wheel (2026-11-19): what each spin shows, that the opening is decided when the
//     round is triggered, the Autoplay Bonuses start
//   · the words: printable ASCII only, no em dash, in the standard session; in a social session (?social=true) also no
//     restricted word (bet, buy, cash, money, paid, credit, gamble, wager, stake) anywhere on the page
//   - THE TAB STRIP (2026-11-22, wip/smallsizes, Corey "AO Yes"; ONLY=tabs runs it alone): at Stake's sizes and the
//     phone browser's 390 x 620 (TAB_SIZES), every tab of the strip whole inside the window and the strip, none with
//     its word cut, the strip never scrolling sideways, at most two rows, the words at 11 px or more (10 until the
//     guide sign; under 720 wide the strip wraps to two rows; at the 2026-11-22 survey GAME MODES, MAX WIN & RTP and
//     LEGAL sat off the right edge at 320, 375 and 400 wide)
//   - THE GUIDE SIGN (2026-11-23, Corey's pick from the mock game_info_sign_r1_2026-11-23, candidate A; ONLY=tabs runs
//     it with the strip): at every size of TAB_SIZES the page is one green sign, its color and band the Menu pop-out's
//     own (.sm-plate, read off the open menu: the same computed gradient, band color, band width and corner), 1000 px
//     wide at most and inside the window (above 1440 wide, THE LARGE SCREEN SCALE below); every word on the page at 11 px or more (the strip's words too); the close key
//     and every tab a press box of 44 x 44 px or more; at 400 x 225 no title and the close key at the end of the
//     strip's first row
//   - THE LARGE SCREEN SCALE (2026-11-23, wip/reindeer-superline, Corey: "Let the sign grow wider and its text larger
//     above 1440 wide"; ONLY=tabs runs it): at 1440 wide and under the sign carries no scale (no --gi-s) and is 1000 px
//     wide at most, as before; above, its --gi-s is the scale rule's (1.35 at 1920 x 1080, 1.6 at 2560 x 1440), it is
//     1000 x the scale wide at most and never over 88 % of the window's width, from a scale of 1.35 never over 88 % of its
//     height, its reading text the tier's size times the scale, and its band and corner the Menu plate's times the scale
// With SHOTS=<dir> it saves the guide at each size (<w>x<h>_guide.png) and the strip (<w>x<h>_tabs.png).
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [ONLY=a,b] [SHOTS=dir] node tools/game_info_probe.mjs
// Uses the dev server that is already running. One headless browser, muted. Wrap it in the shared browser lock:
//   tools/browser_lock.sh run game -- node tools/game_info_probe.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3014';
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZES = [
	{ name: 'desktop', vp: { width: 1920, height: 1080 } },
	{ name: 'desk1440', vp: { width: 1440, height: 900 } },
	{ name: 'popoutL', vp: { width: 800, height: 450 } },
	{ name: 'popoutS', vp: { width: 400, height: 225 } },
	{ name: 'phone', vp: { width: 390, height: 844 }, touch: true },
	{ name: 'small', vp: { width: 360, height: 640 }, touch: true },
	{ name: 'sideways', vp: { width: 844, height: 390 }, touch: true },
	{ name: 'ipad', vp: { width: 820, height: 1180 }, touch: true },
	// (2026-11-23, THE LARGE SCREEN SCALE: the sign at its largest)
	{ name: 'desk2560', vp: { width: 2560, height: 1440 } },
];
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
// the tab strip's sizes: Stake's player sizes (1200 x 675 to 320 x 568), its full screen 1920 x 1080 and the phone browser
const TAB_SIZES = [
	{ name: 'tabs1200', vp: { width: 1200, height: 675 } },
	{ name: 'tabs1024', vp: { width: 1024, height: 576 } },
	{ name: 'tabs800', vp: { width: 800, height: 450 } },
	{ name: 'tabs400', vp: { width: 400, height: 225 } },
	{ name: 'tabs1920', vp: { width: 1920, height: 1080 } },
	{ name: 'tabs425', vp: { width: 425, height: 812 }, touch: true },
	{ name: 'tabs375', vp: { width: 375, height: 667 }, touch: true },
	{ name: 'tabs320', vp: { width: 320, height: 568 }, touch: true },
	{ name: 'tabs390', vp: { width: 390, height: 620 }, touch: true },
	// (since the guide sign of 2026-11-23: the desktop windows 1440 x 900 and 1280 x 720 and the phones of the game's
	// layout tables, 440 x 742, 413 x 586 and 390 x 844 upright, 832 x 376 and 844 x 390 sideways)
	{ name: 'tabs1440', vp: { width: 1440, height: 900 } },
	{ name: 'tabs1280', vp: { width: 1280, height: 720 } },
	{ name: 'tabs440', vp: { width: 440, height: 742 }, touch: true },
	{ name: 'tabs413', vp: { width: 413, height: 586 }, touch: true },
	{ name: 'tabs390u', vp: { width: 390, height: 844 }, touch: true },
	{ name: 'tabs832', vp: { width: 832, height: 376 }, touch: true },
	{ name: 'tabs844', vp: { width: 844, height: 390 }, touch: true },
	// (2026-11-23, THE LARGE SCREEN SCALE: the sign at its largest)
	{ name: 'tabs2560', vp: { width: 2560, height: 1440 } },
];
// COPY OF src/ui/GameInfoModal.svelte TIERS (lab, tabf: the least of them) and the sign's 1000 px cap: the guide sign's
// least word size and press box, and its widest
const MIN_TEXT_PX = 11;
const MIN_PRESS_PX = 44;
const SIGN_MAX_W = 1000;
// COPY OF src/ui/GameInfoModal.svelte gs (THE LARGE SCREEN SCALE): 1 at 1440 wide and under; above, from 1 at 1440 to 1.35
// at 1920 and 1.6 from 2560, never more than vh / 800 or 0.88 vw / 1000; and TIERS.wide.body, the reading text's size
const signScale = (vw, vh) => {
	if (vw <= 1440) return 1;
	const curve = vw <= 1920 ? 1 + (0.35 * (vw - 1440)) / 480 : Math.min(1.6, 1.35 + (0.25 * (vw - 1920)) / 640);
	return Math.round(Math.max(1, Math.min(curve, vh / 800, (0.88 * vw) / 1000)) * 1000) / 1000;
};
const WIDE_BODY_PX = 14.5;
const ROWS = ['feature', 'spin', 'boardTap', 'skip', 'autoplay', 'turbo', 'menu', 'sound', 'amount', 'readouts', 'symbols', 'keyboard', 'replay'];
const BANNED = /\b(bets?|buy|buys|bought|cash|money|paid|credits?|gamble|gambling|wager|wagers|stake)\b/i;

let pass = 0;
let fail = 0;
const check = (ok, what, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${!ok && detail !== undefined ? `\n     ${JSON.stringify(detail).slice(0, 600)}` : ''}`);
};

async function boot(browser, S, extra = '') {
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.touch ? 3 : 2, isMobile: !!S.touch, hasTouch: !!S.touch });
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	await p.goto(`${APP}/?lang=en&sessionID=gi${S.name}${Date.now()}${extra}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 160; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && document.querySelector('.hudp') && !document.querySelector('.landing'))).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	await sleep(800);
	return { ctx, p, errs };
}

/** opens the page from the menu; returns the sign panels' plate as the open menu draws it (.sm-plate, the sign bar's
 *  Menu pop-out): its gradient, band color, band width and corner. With the glass dock (no pop-out) a bare
 *  .sp.sp-plate stands in: the same shared rule (ui/sign/signPanel.css). */
async function openInfo(p) {
	await p.evaluate(() => document.querySelector('.hudp [data-hud="menu-key"]')?.click());
	await sleep(450);
	const menuPlate = await p.evaluate(() => {
		const look = (el, from) => {
			const cs = getComputedStyle(el);
			return { from, bg: cs.backgroundImage, band: cs.borderTopColor, bw: cs.borderTopWidth, rad: cs.borderTopLeftRadius };
		};
		const m = document.querySelector('.sm-plate');
		if (m) return look(m, 'the Menu pop-out');
		const d = document.createElement('div');
		d.className = 'sp sp-plate';
		document.body.appendChild(d);
		const v = look(d, 'a bare .sp-plate');
		d.remove();
		return v;
	});
	await p.evaluate(() => document.querySelector('.hudp [aria-label="Game info"]')?.click());
	for (let i = 0; i < 20 && !(await p.$('[data-gameinfo]')); i++) await sleep(150);
	await sleep(500);
	return menuPlate;
}

async function runSize(browser, S, social = false) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}${social ? ' social' : ''}`;
	const { ctx, p, errs } = await boot(browser, S, social ? '&social=true' : '');
	await openInfo(p);
	const open = !!(await p.$('[data-gameinfo]'));
	check(open, `${tag}: GAME INFO opens from the menu`);
	if (!open) return void (await ctx.close());
	// the tab: press it, the guide comes to the top of the scroller
	const tab = await p.$('[data-gameinfo] [data-tab="guide"]');
	check(!!tab, `${tag}: the UI Guide tab is there`);
	if (tab) await tab.click();
	await sleep(900);
	const g = await p.evaluate(() => {
		const panel = document.querySelector('[data-gameinfo]');
		const sc = panel.querySelector('.content');
		const sec = panel.querySelector('[data-guide]');
		const sb = sc.getBoundingClientRect();
		const gb = sec.getBoundingClientRect();
		const rows = [...sec.querySelectorAll('[data-guide-row]')].map((r) => {
			const b = r.getBoundingClientRect();
			const icon = r.querySelector('.guide-icon');
			const ib = icon.getBoundingClientRect();
			const svg = icon.querySelector('svg');
			const vb = svg?.getBoundingClientRect();
			const name = r.querySelector('.guide-name');
			const text = r.querySelector('.v');
			return {
				id: r.dataset.guideRow,
				x0: b.left, x1: b.right,
				over: Math.max(name.scrollWidth - name.clientWidth, text.scrollWidth - text.clientWidth, r.scrollWidth - r.clientWidth),
				icon: !!vb && vb.width > 4 && vb.left >= ib.left - 0.5 && vb.right <= ib.right + 0.5 && vb.top >= ib.top - 0.5 && vb.bottom <= ib.bottom + 0.5,
				name: name.textContent.trim(),
				text: text.textContent.trim(),
			};
		});
		// what reaches past the scroller's right edge, if anything (named for the report)
		const inner = sb.right - parseFloat(getComputedStyle(sc).paddingRight);
		const past = [...sc.querySelectorAll('*')]
			.filter((e) => e.getBoundingClientRect().right > inner + 0.5 && e.getBoundingClientRect().width > 0)
			.slice(0, 60)
			.map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} in ${e.closest('section')?.querySelector('h2')?.textContent ?? '?'} (${Math.round(e.getBoundingClientRect().right - inner)} px past the text column)`);
		return { past, inner, sc: { x0: sb.left, x1: sb.right, y0: sb.top, scrollW: sc.scrollWidth, clientW: sc.clientWidth }, guideTop: gb.top - sb.top, rows, winScroll: document.scrollingElement.scrollTop, docW: document.documentElement.scrollWidth, vw: innerWidth };
	});
	check(g.guideTop >= -2 && g.guideTop <= 40, `${tag}: the tab brings the guide to the top of the page (${Math.round(g.guideTop)} px)`, g.guideTop);
	const ids = g.rows.map((r) => r.id);
	check(ROWS.every((id) => ids.includes(id)), `${tag}: the guide's ${ROWS.length} rows (${ids.join(', ')})`, ids);
	const wide = g.rows.filter((r) => r.over > 1 || r.x0 < g.sc.x0 - 0.5 || r.x1 > g.inner + 0.5).map((r) => `${r.id} ${r.over}`);
	const guidePast = g.past.filter((x) => / in User Interface Guide /.test(x));
	check(wide.length === 0 && guidePast.length === 0 && g.docW <= g.vw + 1 && g.winScroll === 0, `${tag}: every guide row fits the page's text column (the window never scrolls sideways)`, { wide, guidePast, docW: g.docW });
	// the rest of the page is not this probe's: what reaches past the text column there is reported, not judged
	if (g.past.length > guidePast.length) console.log(`  INFO ${tag}: outside the guide, past the text column: ${g.past.filter((x) => !guidePast.includes(x)).slice(0, 4).join('; ')} (scroller ${g.sc.scrollW} wide in ${g.sc.clientW})`);
	check(g.rows.every((r) => r.icon && r.name.length > 0 && r.text.length > 20), `${tag}: every row has its glyph inside its well, a name and a text`, g.rows.filter((r) => !r.icon).map((r) => r.id));
	if (SHOTS && !social) await p.screenshot({ path: join(SHOTS, `${S.vp.width}x${S.vp.height}_guide.png`) });
	// the scroller reaches the guide's last row, then the page's end
	const end = await p.evaluate(async () => {
		const sc = document.querySelector('[data-gameinfo] .content');
		const last = [...document.querySelectorAll('[data-gameinfo] [data-guide-row]')].pop();
		last.scrollIntoView({ block: 'end' });
		await new Promise((r) => setTimeout(r, 300));
		const lb = last.getBoundingClientRect();
		const sb = sc.getBoundingClientRect();
		// its end in view (a row taller than a popout's scroller shows its last lines, as the mode cards do there)
		const lastIn = lb.bottom <= sb.bottom + 1 && lb.bottom > sb.top + Math.min(lb.height, sb.height) - 2;
		sc.scrollTop = sc.scrollHeight;
		await new Promise((r) => setTimeout(r, 300));
		return { lastIn, atEnd: Math.abs(sc.scrollTop + sc.clientHeight - sc.scrollHeight) <= 2, scrollable: sc.scrollHeight > sc.clientHeight };
	});
	check(end.lastIn && end.atEnd && end.scrollable, `${tag}: the page scrolls inside itself to the guide's last row and to its end`, end);
	// the rules' own numbers, from the game
	const pauseMs = await p.evaluate(() => window.__reindeer.stockRules?.().pauseMs ?? null);
	const auto = g.rows.find((r) => r.id === 'autoplay')?.text ?? '';
	const turbo = g.rows.find((r) => r.id === 'turbo')?.text ?? '';
	const secs = pauseMs === null ? null : `${Math.round(pauseMs / 100) / 10} second`;
	check(!!secs && auto.includes(secs) && /stop the run/.test(auto) && /free spins too/.test(auto), `${tag}: the Autoplay row states the stop in free spins and the ${secs} pause (the game's ${pauseMs} ms)`, auto);
	const feat = g.rows.find((r) => r.id === 'feature')?.text ?? '';
	check(/plays base game spins/.test(auto) && /Ante spins while Ante is on/.test(auto) && /starting a run unloads one/.test(auto), `${tag}: the Autoplay row says it plays base game spins (or Ante spins) and that starting a run unloads a loaded round`, auto);
	check(/Autoplay never plays a loaded round/.test(feat) && /cannot be loaded while a run is playing/.test(feat), `${tag}: the feature menu's row says autoplay never plays a loaded round and none loads during a run`, feat);
	const spinRow = g.rows.find((r) => r.id === 'spin')?.text ?? '';
	check(/\bSTART\b/.test(auto) && /starts the run right away/.test(auto) && !/\bLOAD\b/.test(auto) && !/waits on the Spin/.test(auto + feat) && !/Autoplay loaded/.test(spinRow), `${tag}: the Autoplay row says START starts the run right away; no row speaks of loading a run onto Spin`, { auto, spinRow });
	check(/Every bonus round starts at regular speed/.test(turbo) && /base game comes back/.test(turbo), `${tag}: the Turbo row states the bonus round's regular speed and the base speed coming back`, turbo);
	// the words of the whole page
	const words = await p.evaluate(() => document.querySelector('[data-gameinfo]').innerText);
	// THE SUPER WHEEL'S PARAGRAPH (2026-11-19, Corey: "We probably also need to add the wheel info to the Rules for Super
	// Free Spins"; game/gameInfoText.ts howTo): what the wheel does, said plainly, and that it only shows an opening that
	// was decided when the round was triggered
	const wheel = /The Super wheel\.[^\n]*/.exec(words)?.[0] ?? '';
	check(
		/opens with a wheel/.test(wheel) && /the Reindeer or Santa/.test(wheel) && /multiplier/.test(wheel) && /inner ring/.test(wheel) && /column/.test(wheel) && /decided when the round is triggered/.test(wheel) && /changes nothing/.test(wheel) && /not equally likely/.test(wheel) && /Autoplay Bonuses/.test(wheel) && /starts by itself/.test(wheel),
		`${tag}: the rules describe the Super wheel (the first spin: who and the multiplier; the inner ring: the column; decided when the round is triggered; Autoplay Bonuses starts it)`,
		wheel,
	);
	const badChar = [...new Set(words.match(/[^\x20-\x7e\n\t]/g) ?? [])].filter((c) => c !== '©'); // the disclaimer's (c) is Stake's verbatim template
	check(badChar.length === 0 && !/—/.test(words), `${tag}: printable ASCII only on the page (no em dash; the legal template's copyright sign aside)`, badChar);
	if (social) {
		const guideWords = g.rows.map((r) => `${r.name} ${r.text}`).join(' ');
		const bad = (words.match(new RegExp(BANNED.source, 'gi')) ?? []).concat(guideWords.match(new RegExp(BANNED.source, 'gi')) ?? []);
		check(bad.length === 0, `${tag}: no restricted word on the page`, [...new Set(bad)]);
	}
	check(errs.length === 0, `${tag}: no page errors`, errs.slice(0, 3));
	await ctx.close();
}

/** THE TAB STRIP at one size, standard and social (the social strip says SYMBOLS for PAYTABLE) */
async function tabStrip(browser, S) {
	for (const social of [false, true]) {
		const tag = `tabs ${S.vp.width}x${S.vp.height}${social ? ' social' : ''}`;
		const { ctx, p, errs } = await boot(browser, S, social ? '&social=true' : '');
		const menuPlate = await openInfo(p);
		const t = await p.evaluate(() => {
			const nav = document.querySelector('[data-gameinfo] .tabs');
			if (!nav) return null;
			const nb = nav.getBoundingClientRect();
			const tabs = [...nav.querySelectorAll('[data-tab]')].map((e) => {
				const b = e.getBoundingClientRect();
				return { id: e.dataset.tab, x0: b.left, x1: b.right, y0: b.top, y1: b.bottom, w: b.width, h: b.height, sw: e.scrollWidth, cw: e.clientWidth, px: parseFloat(getComputedStyle(e).fontSize) };
			});
			const sign = document.querySelector('[data-gameinfo]');
			const sgb = sign.getBoundingClientRect();
			const cs = getComputedStyle(sign);
			const x = sign.querySelector('[data-gi-close]');
			const xb = x?.getBoundingClientRect();
			// every word on the page, scrolled out of view or not (the size of a text's own element)
			let minText = Infinity;
			let minAt = '';
			const walk = document.createTreeWalker(sign, NodeFilter.SHOW_TEXT);
			for (let n = walk.nextNode(); n; n = walk.nextNode()) {
				if (!n.nodeValue.trim()) continue;
				const el = n.parentElement;
				if (!el || !el.getClientRects().length) continue;
				const px = parseFloat(getComputedStyle(el).fontSize);
				if (px < minText) {
					minText = px;
					minAt = `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${n.nodeValue.trim().slice(0, 24)}"`;
				}
			}
			return {
				nav: { x0: nb.left, x1: nb.right, y0: nb.top, y1: nb.bottom, sw: nav.scrollWidth, cw: nav.clientWidth },
				tabs,
				vw: innerWidth,
				vh: innerHeight,
				tier: sign.dataset.giTier,
				sign: { x0: sgb.left, x1: sgb.right, y0: sgb.top, y1: sgb.bottom, w: sgb.width, h: sgb.height, bg: cs.backgroundImage, band: cs.borderTopColor, bw: cs.borderTopWidth, rad: cs.borderTopLeftRadius, giS: cs.getPropertyValue('--gi-s').trim(), body: parseFloat(getComputedStyle(sign.querySelector('.content')).fontSize) },
				close: xb ? { x0: xb.left, x1: xb.right, y0: xb.top, y1: xb.bottom, w: xb.width, h: xb.height, inNav: nav.contains(x) } : null,
				title: !!sign.querySelector('.ttl'),
				minText,
				minAt,
				winScroll: document.scrollingElement.scrollTop,
				docW: document.documentElement.scrollWidth,
			};
		});
		check(!!t && t.tabs.length === 7, `${tag}: the strip's seven tabs are there`, t?.tabs.map((x) => x.id));
		if (t) {
			const off = t.tabs.filter((x) => x.x0 < -0.5 || x.x1 > t.vw + 0.5 || x.x0 < t.nav.x0 - 0.5 || x.x1 > t.nav.x1 + 0.5 || x.y0 < t.nav.y0 - 0.5 || x.y1 > t.nav.y1 + 0.5).map((x) => `${x.id} ${Math.round(x.x0)}..${Math.round(x.x1)}`);
			check(off.length === 0, `${tag}: every tab whole inside the window and the strip`, off);
			const cut = t.tabs.filter((x) => x.sw > x.cw + 1).map((x) => `${x.id} ${x.sw}/${x.cw}`);
			check(cut.length === 0, `${tag}: no tab's word cut`, cut);
			check(t.nav.sw <= t.nav.cw + 1, `${tag}: the strip does not scroll sideways (${t.nav.sw} in ${t.nav.cw})`, t.nav);
			const rows = new Set(t.tabs.map((x) => Math.round(x.y0))).size;
			check(rows <= 2, `${tag}: the strip in at most two rows (${rows})`, rows);
			check(t.tabs.every((x) => x.px >= MIN_TEXT_PX - 0.01), `${tag}: the tabs' words at ${MIN_TEXT_PX} px or more`, t.tabs.map((x) => x.px));
			// THE GUIDE SIGN (2026-11-23)
			// (THE LARGE SCREEN SCALE: 1 at 1440 wide and under, where the sign is exactly the Menu's plate)
			const gs = signScale(t.vw, t.vh);
			const near = (a, b) => Math.abs(parseFloat(a) - parseFloat(b) * gs) <= (gs === 1 ? 0 : 1);
			check(!!menuPlate && /gradient/.test(t.sign.bg) && t.sign.bg === menuPlate.bg && t.sign.band === menuPlate.band && (gs === 1 ? t.sign.bw === menuPlate.bw && t.sign.rad === menuPlate.rad : near(t.sign.bw, menuPlate.bw) && near(t.sign.rad, menuPlate.rad)), `${tag}: the sign is the Menu's green plate (against ${menuPlate?.from}: the same gradient, band and corner${gs === 1 ? '' : `, the band and corner times ${gs}`})`, { sign: t.sign, menuPlate, gs });
			const maxW = SIGN_MAX_W * gs;
			check(t.sign.w <= maxW + 0.5 && (gs === 1 || t.sign.w <= 0.88 * t.vw + 0.5) && t.sign.x0 >= -0.5 && t.sign.x1 <= t.vw + 0.5 && t.sign.y0 >= -0.5 && t.sign.y1 <= t.vh + 0.5 && t.docW <= t.vw + 1 && t.winScroll === 0, `${tag}: the sign inside the window, ${Math.round(maxW)} px wide at most (${Math.round(t.sign.w)} x ${Math.round(t.sign.h)}), the window never scrolls`, { sign: t.sign, docW: t.docW, winScroll: t.winScroll });
			if (t.vw <= 1440) check(t.sign.giS === '', `${tag}: at 1440 wide and under the sign carries no scale (no --gi-s)`, t.sign.giS);
			else {
				const tall = gs < 1.35 || t.sign.h <= 0.88 * t.vh + 1;
				const bodyOk = t.tier !== 'wide' || Math.abs(t.sign.body - WIDE_BODY_PX * gs) <= 0.06;
				check(Math.abs(parseFloat(t.sign.giS || '1') - gs) < 0.0015 && tall && bodyOk, `${tag}: the large screen scale ${gs} (the sign's --gi-s ${t.sign.giS || 'none'}), the sign ${Math.round(t.sign.h)} of ${t.vh} tall (88 % at most from 1.35), its reading text ${t.sign.body} px (${WIDE_BODY_PX} x ${gs})`, { sign: t.sign, gs });
			}
			check(t.minText >= MIN_TEXT_PX - 0.01, `${tag}: every word on the page at ${MIN_TEXT_PX} px or more (smallest ${t.minText} px, ${t.minAt})`, { minText: t.minText, at: t.minAt });
			const small = t.tabs.filter((x) => x.w < MIN_PRESS_PX - 0.05 || x.h < MIN_PRESS_PX - 0.05).map((x) => `${x.id} ${x.w.toFixed(1)}x${x.h.toFixed(1)}`);
			check(small.length === 0, `${tag}: every tab a press box of ${MIN_PRESS_PX} x ${MIN_PRESS_PX} px or more`, small);
			check(!!t.close && t.close.w >= MIN_PRESS_PX - 0.05 && t.close.h >= MIN_PRESS_PX - 0.05 && t.close.x1 <= t.sign.x1 + 0.5 && t.close.y0 >= t.sign.y0 - 0.5, `${tag}: the close key a press box of ${MIN_PRESS_PX} x ${MIN_PRESS_PX} px or more, on the sign (${t.close ? `${t.close.w.toFixed(1)} x ${t.close.h.toFixed(1)}` : 'none'})`, t.close);
			if (t.tier === 'short') {
				const mid = (b) => (b.y0 + b.y1) / 2;
				const first = t.tabs[0];
				const row1 = t.tabs.filter((x) => Math.abs(mid(x) - mid(first)) < 4);
				const ends = !!t.close && Math.abs(mid(t.close) - mid(first)) < 4 && row1.every((x) => x.x1 <= t.close.x0 + 0.5);
				check(!t.title && !!t.close?.inNav && ends, `${tag}: no title; the close key ends the strip's first row`, { title: t.title, close: t.close, row1: row1.map((x) => x.id) });
			}
		}
		if (SHOTS && !social) await p.screenshot({ path: join(SHOTS, `${S.vp.width}x${S.vp.height}_tabs.png`) });
		check(errs.length === 0, `${tag}: no page errors`, errs.slice(0, 3));
		await ctx.close();
	}
}

const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
	for (const S of SIZES.filter((s) => !ONLY.length || ONLY.includes(s.name))) await runSize(browser, S);
	if (!ONLY.length || ONLY.includes('tabs')) for (const S of TAB_SIZES) await tabStrip(browser, S);
	for (const S of SIZES.filter((s) => (!ONLY.length || ONLY.includes(s.name)) && ['desk1440', 'phone', 'popoutS'].includes(s.name))) await runSize(browser, S, true);
} catch (e) {
	fail++;
	console.log('FAIL probe error', e?.stack ?? e);
} finally {
	await browser.close();
}
console.log(`\ngame_info_probe: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
