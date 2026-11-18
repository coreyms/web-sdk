// @ts-nocheck: a node script, not app code (svelte-check picks up .mjs files)
// THE LED CURRENCY PREVIEW (2026-11-17, led_currency_2026-11-17): writes one standalone page (led_currency_preview.html) that
// draws every currency of the HUD's table on mocks of the strip and the big board with the game's own drawing code: the
// page carries src/game/scoreboard/ledSigns.ts and ledCurrency.ts whole, and the amount face (scoreboardDraw.ts vglyph to
// drawRow) and the sentence face (landing/ledScreens.ts FONT to drawText) cut from their files as they are, types stripped;
// the HUD's text for each amount is made here by the HUD's own formatter (as tools/led_currency_check.mjs runs it); the
// dot grille is the scoreboard's (round soft holes, one a dot, over the unlit dots). Overpass Heavy rides inside the page.
//   node --experimental-strip-types --no-warnings tools/led_currency_preview.mjs [out dir]
//   SHOT=1 adds SHEET.png of the page (one muted headless Chromium; run it through tools/browser_lock.sh, lane game):
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules SHOT=1 node --experimental-strip-types --no-warnings tools/led_currency_preview.mjs
import { register, stripTypeScriptTypes, createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const SDK = join(APP, '..', '..');
const OUT = process.argv[2] || join(homedir(), 'Desktop', 'Run Over Reindeer', 'led_currency_2026-11-17');
mkdirSync(OUT, { recursive: true });

// ---- the HUD's own text for each amount (the real formatter; the Svelte state stood in, as the check script does) ----
const LINGUI = pathToFileURL(join(APP, 'node_modules', '@lingui', 'core', 'dist', 'index.mjs')).href;
const STATE_URL =
	'data:text/javascript,' +
	encodeURIComponent(`import { i18n } from ${JSON.stringify(LINGUI)};
export const stateBet = { currency: 'USD', wageredBetAmount: 1 };
export const stateI18n = { i18n };
export const setLocale = (l) => { i18n.load(l, {}); i18n.activate(l); };`);
const BET_URL = pathToFileURL(join(SDK, 'packages', 'constants-shared', 'bet.ts')).href;
register(
	'data:text/javascript,' +
		encodeURIComponent(`export async function resolve(s, c, n) {
	if (s === 'state-shared') return { url: ${JSON.stringify(STATE_URL)}, shortCircuit: true };
	if (s === 'constants-shared/bet') return { url: ${JSON.stringify(BET_URL)}, shortCircuit: true };
	if (s.startsWith('./') && !/\\.[a-z]+$/.test(s)) return n(s + '.ts', c);
	return n(s, c);
}`),
);
const state = await import(STATE_URL);
const hud = await import(pathToFileURL(join(SDK, 'packages', 'utils-shared', 'amount.ts')).href);
const ledMod = await import(pathToFileURL(join(APP, 'src', 'game', 'scoreboard', 'ledCurrency.ts')).href);
state.setLocale('en');
const AMOUNTS = [1234.5, 0.2, 12345678];
const rows = Object.keys(ledMod.LED_CURRENCIES).map((code) => {
	state.stateBet.currency = code;
	return { code, hud: AMOUNTS.map((v) => hud.numberToCurrencyString(v)), topUp: hud.numberToCurrencyString(12.34) };
});
// three locales' marks on one currency each (the rule follows the HUD's locale)
const locales = [
	['de', 'EUR'],
	['fr', 'EUR'],
	['hi', 'INR'],
	['pl', 'PLN'],
	['pt', 'BRL'],
].map(([loc, code]) => {
	state.setLocale(loc);
	state.stateBet.currency = code;
	return { code, loc, hud: AMOUNTS.map((v) => hud.numberToCurrencyString(v)) };
});
state.setLocale('en');
state.stateBet.currency = 'XQZ';
const made = { code: 'XQZ', hud: AMOUNTS.map((v) => hud.numberToCurrencyString(v)), topUp: hud.numberToCurrencyString(12.34) };

// ---- the game's code, as it is ----
const strip = (p) => stripTypeScriptTypes(readFileSync(join(APP, 'src', p), 'utf8'), { mode: 'strip' });
const slice = (src, from, to) => {
	const a = src.indexOf(from);
	const b = src.indexOf(to, a);
	if (a < 0 || b < 0) throw new Error(`slice ${from} .. ${to} not found`);
	return src.slice(a, b);
};
const signsJs = strip('game/scoreboard/ledSigns.ts');
const currencyJs = strip('game/scoreboard/ledCurrency.ts').replace("from './ledSigns'", "from 'ledSigns'");
const screens = strip('game/landing/ledScreens.ts');
const draw = strip('game/scoreboard/scoreboardDraw.ts');
const coreJs = [
	"import { ledSignCanvas, SENTENCE_SIGNS } from 'ledSigns';",
	slice(screens, 'export const mk', '// ---- the LED palette'),
	slice(screens, 'const FONT', 'function wrap('),
	slice(draw, 'const vgCache', '// ---- LED PICTURE HELPERS'),
	'export { vglyph, rowInfo, fitCap, drawRow, drawTitle };',
].join('\n');
const b64 = (s) => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const font = readFileSync(join(APP, 'static', 'assets', 'fonts', 'overpass', 'Overpass-heavy.woff2')).toString('base64');

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>LED Currency Sheet</title>
<style>
@font-face { font-family: 'Overpass'; font-weight: 900; src: url(data:font/woff2;base64,${font}) format('woff2'); }
:root { --bg: #0b0d11; --ink: #e9e4d8; --dim: #8b8f98; --line: #23262d; --gold: #ffd23a; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.4 -apple-system, system-ui, sans-serif; }
main { padding: 20px 16px 40px; width: max-content; }
h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 17px; margin: 28px 0 8px; color: var(--gold); }
p { margin: 0 0 8px; color: var(--dim); max-width: 1100px; }
.row { display: flex; align-items: center; gap: 14px; margin: 0 0 6px; }
.lab { width: 210px; flex: none; } .lab b { font-size: 15px; } .lab span { display: block; color: var(--dim); font-size: 12px; white-space: pre; }
.grid { display: flex; flex-wrap: wrap; gap: 14px; max-width: 2250px; }
.cell { display: flex; flex-direction: column; gap: 4px; } .cell small { color: var(--dim); }
canvas { display: block; image-rendering: pixelated; }
.weak { outline: 2px solid #ff7a3a; outline-offset: 3px; }
</style>
<script type="importmap">${JSON.stringify({ imports: { ledSigns: b64(signsJs), ledCurrency: b64(currencyJs), core: b64(coreJs) } })}</script>
</head><body><main id="m">
<h1>LED currency sheet</h1>
<p>Every currency of the HUD's table, drawn by the game's own LED code (ledSigns.ts, ledCurrency.ts, scoreboardDraw.ts vglyph to drawRow, ledScreens.ts drawText) through a port of the scoreboard's dot grille. The HUD text beside each is the HUD's own formatter's output for the same amount. Strip: the 1440 x 900 desktop strip, 267 x 26 dots; narrow strip: the 1920 x 1080 strip, 270 x 16 dots (the smallest digits in play, cap 11); board: the upright phone's big board, 257 x 184 dots.</p>
</main>
<script type="module">
import { ledAmountText, ledAmountParts } from 'ledCurrency';
import { signDots, AMOUNT_OUTLINES, AMOUNT_HAND, SENTENCE_SIGNS } from 'ledSigns';
import { mk, rowInfo, fitCap, drawRow, drawTitle, drawText, textW } from 'core';
const ROWS = ${JSON.stringify(rows)};
const LOCALES = ${JSON.stringify(locales)};
const MADE = ${JSON.stringify(made)};
const WEAK = new Set(${JSON.stringify(['ج', 'م', '₡', '₺', '₱'])});
await document.fonts.load("900 40px 'Overpass'");
const m = document.getElementById('m');
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

// THE GRILLE (scoreboard.ts: GRILLE 16 px cells, a hole of radius 0.47 a cell, solid to 0.5, half at 0.78, over the unlit dots)
const UNLIT = '#22262d', BASE = '#040507';
const hole = (() => { const s = 16, c = mk(s, s); const rg = c.ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.47); rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(0.5, 'rgba(0,0,0,1)'); rg.addColorStop(0.78, 'rgba(0,0,0,0.5)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); c.ctx.fillStyle = rg; c.ctx.fillRect(0, 0, s, s); return c; })();
function dots(face, pitch) {
	const W = face.width, H = face.height, dpr = 2;
	const c = document.createElement('canvas');
	c.width = Math.round(W * pitch * dpr); c.height = Math.round(H * pitch * dpr);
	c.style.width = W * pitch + 'px'; c.style.height = H * pitch + 'px';
	const g = c.getContext('2d');
	g.fillStyle = UNLIT; g.fillRect(0, 0, c.width, c.height);
	g.imageSmoothingEnabled = false; g.drawImage(face, 0, 0, c.width, c.height);
	const gr = mk(c.width, c.height);
	gr.ctx.fillStyle = BASE; gr.ctx.fillRect(0, 0, c.width, c.height);
	gr.ctx.globalCompositeOperation = 'destination-out';
	const p = pitch * dpr;
	for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) gr.ctx.drawImage(hole, i * p, j * p, p, p);
	g.drawImage(gr, 0, 0);
	return c;
}
// THE STRIP'S WIN LINE (scoreboardDraw.ts winLayout, the strip's tag: the title as two lines beside the number at full height)
function stripFace(W, H, str, title = 'WIN') {
	const F = mk(W, H), g = F.ctx;
	const m = H >= 30 ? 4 : 2;
	let best = null;
	for (const ts of [2, 1]) {
		const words = title.split(' ');
		const tw = Math.max(...words.map((x) => textW(x, ts)));
		const th = 14 * ts + Math.max(1, ts);
		if (th > H - 2 * m && ts > 1) continue;
		let cap = H - 2 * m - 1;
		while (cap > 5 && tw + 6 + rowInfo(str, cap).w > W - 2 * m - 4) cap--;
		if (best && best.cap >= cap) continue;
		const total = tw + 6 + rowInfo(str, cap).w;
		const x0 = Math.round((W - total) / 2);
		best = { ts, tw, cap, x0, th, words };
	}
	const { ts, tw, cap, x0, words } = best;
	const th7 = 7 * ts, gap = Math.max(1, ts);
	const y0 = words.length > 1 ? Math.round((H - (14 * ts + gap)) / 2) : Math.round((H - th7) / 2);
	words.slice(0, 2).forEach((w, i) => drawTitle(g, w, x0 + tw / 2, y0 + i * (th7 + gap), ts, '#7cc4ff'));
	drawRow(g, str, x0 + tw + 6, Math.round((H - cap) / 2), cap, '#ffffff');
	return { F, cap };
}
// THE BIG BOARD'S WIN (winLayout's stacked layout: the title over the amount, the amount as large as the width allows)
function boardFace(W, H, str, title = 'BIG WIN') {
	const F = mk(W, H), g = F.ctx;
	const m = H >= 30 ? 4 : 2;
	let ts = 1;
	for (const s of [5, 4, 3, 2, 1]) if (textW(title, s) <= W - 2 * m - 6 && 7 * s <= H * 0.24) { ts = s; break; }
	const tH = 7 * ts, gap = Math.max(2, Math.round(H * 0.06));
	const cap = fitCap(str, W - 2 * m - 8, Math.min(H - 2 * m - tH - gap - 3, H * 0.5));
	const y0 = Math.round((H - (tH + gap + cap)) / 2);
	drawTitle(g, title, W / 2, y0, ts, '#ffd23a');
	const w = rowInfo(str, cap).w;
	drawRow(g, str, Math.round((W - w) / 2), y0 + tH + gap, cap, 'gold');
	return { F, cap };
}
const stripShot = (W, H, str, pitch) => { const r = stripFace(W, H, str); const c = dots(r.F, pitch); c.title = 'cap ' + r.cap; return c; };
const boardShot = (W, H, str, pitch) => { const r = boardFace(W, H, str); return dots(r.F, pitch); };
/** the amount alone, cropped to its row, for the 3x look */
function amountCrop(str, cap, pitch) {
	const ri = rowInfo(str, cap); const h = Math.ceil(cap * 1.4) + 4;
	const F = mk(ri.w + 6, h); drawRow(F.ctx, str, 3, 2, cap, '#ffffff');
	return dots(F, pitch);
}

const label = (r, extra = '') => el('div', 'lab', '<b>' + r.code + (r.loc ? ' (' + r.loc + ')' : '') + '</b><span>HUD: ' + esc(r.hud[0]) + '\\nLED: ' + esc(ledAmountText(r.hud[0], r.code)) + extra + '</span>');

// 1. THE STRIP, REAL SIZE (desktop, three amounts)
m.append(el('h2', '', '1. The strip at real size (1440 x 900 desktop, 267 x 26 dots, 2.49 px a dot): 1,234.50, 0.20, 12,345,678.00'));
for (const r of [...ROWS, ...LOCALES, MADE]) {
	const row = el('div', 'row'); row.append(label(r));
	for (const t of r.hud) row.append(stripShot(267, 26, ledAmountText(t, r.code), 2.49));
	if ([...ledAmountText(r.hud[0], r.code)].some((ch) => WEAK.has(ch))) row.classList.add('weak');
	m.append(row);
}
// 2. THE NARROW STRIP AT 3x (1920 x 1080: 16 dots tall, the amount at cap 11, the smallest digits the game shows)
m.append(el('h2', '', '2. The narrowest strip\\'s digits (cap 11, 1920 x 1080) at 3x: 3.3 px a dot x 3'));
const g2 = el('div', 'grid'); m.append(g2);
for (const r of [...ROWS, MADE]) {
	const c = el('div', 'cell'); c.append(amountCrop(ledAmountText(r.hud[0], r.code), 11, 10), el('small', '', r.code));
	g2.append(c);
}
// 3. THE BIG BOARD, REAL SIZE (the upright phone's, 257 x 184 dots at 1.37 px a dot)
m.append(el('h2', '', '3. The big board at real size (upright phone, 257 x 184 dots, 1.37 px a dot): 1,234.50'));
const g3 = el('div', 'grid'); m.append(g3);
for (const r of [...ROWS, MADE]) {
	const c = el('div', 'cell'); c.append(boardShot(257, 184, ledAmountText(r.hud[0], r.code), 1.37), el('small', '', r.code + ': ' + esc(ledAmountText(r.hud[0], r.code))));
	g3.append(c);
}
// 4. THE SIGNS, DOT BY DOT (each cap the boards use, 4 px a dot; hand placed caps marked)
m.append(el('h2', '', '4. Each sign beside a 0, dot by dot at 4 px a dot, at the caps in play (5 to 9 placed by hand, from 10 the outline fitted to the dots)'));
const CAPS = [5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 21, 28, 37];
for (const ch of Object.keys(AMOUNT_OUTLINES)) {
	const row = el('div', 'row'); row.append(el('div', 'lab', '<b style="font-size:22px">' + ch + '</b><span>' + (WEAK.has(ch) ? 'weak at the small caps' : '') + '</span>'));
	if (WEAK.has(ch)) row.classList.add('weak');
	for (const cap of CAPS) {
		const ri = rowInfo('0' + ch, cap); const h = Math.ceil(cap * 1.4) + 4;
		const F = mk(ri.w + 4, h); F.ctx.fillStyle = '#1d2027'; F.ctx.fillRect(0, 2, ri.w + 4, cap);
		drawRow(F.ctx, '0' + ch, 2, 2, cap, '#ffffff');
		const c = el('div', 'cell'); const big = document.createElement('canvas'); big.width = F.width * 4; big.height = F.height * 4;
		const bg = big.getContext('2d'); bg.imageSmoothingEnabled = false; bg.drawImage(F, 0, 0, big.width, big.height);
		bg.strokeStyle = 'rgba(255,255,255,0.06)'; for (let x = 0; x <= F.width; x++) { bg.beginPath(); bg.moveTo(x * 4 + 0.5, 0); bg.lineTo(x * 4 + 0.5, big.height); bg.stroke(); } for (let y = 0; y <= F.height; y++) { bg.beginPath(); bg.moveTo(0, y * 4 + 0.5); bg.lineTo(big.width, y * 4 + 0.5); bg.stroke(); }
		c.append(big, el('small', '', cap + (signDots(ch, cap).hand ? ' hand' : '')));
		row.append(c);
	}
	m.append(row);
}
// 5. THE SENTENCE FACE (the 5 x 7 font: the wrap-up's top-up line on the strip, at 1 and at 2)
m.append(el('h2', '', '5. The strip\\'s sentence face (5 x 7 dots, EPX at 2): the wrap-up\\'s top-up line, at 1 and 2'));
const g5 = el('div', 'grid'); m.append(g5);
for (const r of [...ROWS, MADE]) {
	const s = 'Includes ' + ledAmountText(r.topUp, r.code) + ' added';
	const c = el('div', 'cell');
	for (const z of [1, 2]) { const F = mk(textW(s, z) + 4, 7 * z + 4); drawText(F.ctx, s, 2, 2, z, '#ffd23a'); c.append(dots(F, 2.49)); }
	c.append(el('small', '', r.code));
	g5.append(c);
}
document.body.dataset.ready = '1';
</script></body></html>`;
writeFileSync(join(OUT, 'led_currency_preview.html'), page);
console.log('wrote', join(OUT, 'led_currency_preview.html'), Math.round(page.length / 1024), 'KB');

if (process.env.SHOT) {
	const require = createRequire(import.meta.url);
	const { chromium } = require('playwright');
	const browser = await chromium.launch({ args: ['--mute-audio'] });
	try {
		const p = await browser.newPage({ viewport: { width: 2300, height: 1200 }, deviceScaleFactor: 1 });
		const errs = [];
		p.on('pageerror', (e) => errs.push(e.message));
		p.on('console', (msg) => msg.type() === 'error' && errs.push(msg.text()));
		await p.goto(pathToFileURL(join(OUT, 'led_currency_preview.html')).href);
		await p.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 120000 });
		await p.screenshot({ path: join(OUT, 'SHEET.png'), fullPage: true });
		// the 4x close look at the sign table alone, for the pre-check
		const h2 = await p.$$('h2');
		const box4 = await h2[3].boundingBox();
		const box5 = await h2[4].boundingBox();
		await p.screenshot({ path: join(OUT, 'SHEET_signs_4x.png'), clip: { x: 0, y: box4.y - 6, width: 2300, height: box5.y - box4.y }, fullPage: true });
		console.log('page errors:', errs.length ? errs : 'none');
	} finally {
		await browser.close();
	}
}
