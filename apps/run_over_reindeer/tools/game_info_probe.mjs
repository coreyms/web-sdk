// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{ui/GameInfoModal.svelte,game/gameInfoText.ts,game/bonusStockRules.ts};
// WATCHES: ; __reindeer.hud, __reindeer.atRest, __reindeer.stockRules, AUTOPLAY_RESUME_PAUSE_MS, data-gameinfo, data-guide, data-guide-row, data-tab
// WATCHES: ; .content, .tabs, .guide-row, .guide-icon, .guide-name, GuideId, guideRowShown
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
//   · the rules' paragraph on the Super wheel (2026-11-19): what each spin shows, that the opening is decided when the
//     round is triggered, the Autoplay Bonuses start
//   · the words: printable ASCII only, no em dash, in the standard session; in a social session (?social=true) also no
//     restricted word (bet, buy, cash, money, paid, credit, gamble, wager, stake) anywhere on the page
// With SHOTS=<dir> it saves the guide at each size (<w>x<h>_guide.png).
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
];
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
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

async function openInfo(p) {
	await p.evaluate(() => document.querySelector('.hudp [data-hud="menu-key"]')?.click());
	await sleep(450);
	await p.evaluate(() => document.querySelector('.hudp [aria-label="Game info"]')?.click());
	for (let i = 0; i < 20 && !(await p.$('[data-gameinfo]')); i++) await sleep(150);
	await sleep(500);
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

const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
	for (const S of SIZES.filter((s) => !ONLY.length || ONLY.includes(s.name))) await runSize(browser, S);
	for (const S of SIZES.filter((s) => (!ONLY.length || ONLY.includes(s.name)) && ['desk1440', 'phone', 'popoutS'].includes(s.name))) await runSize(browser, S, true);
} catch (e) {
	fail++;
	console.log('FAIL probe error', e?.stack ?? e);
} finally {
	await browser.close();
}
console.log(`\ngame_info_probe: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
