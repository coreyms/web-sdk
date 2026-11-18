// @ts-nocheck: a node check script, not app code (svelte-check picks up .mjs files)
// THE LED CURRENCY CHECK (2026-11-17, led_currency_2026-11-17): node only, no browser. It runs the HUD's own formatter
// (packages/utils-shared/amount.ts, with the real @lingui/core and a stand-in for the Svelte state) beside the LED rule
// (src/game/scoreboard/ledCurrency.ts) and the LED glyphs (src/game/scoreboard/ledSigns.ts), and checks:
//   1. THE TABLE: every currency of the HUD's table is one of LED_CURRENCIES with the same symbol, and back
//   2. THE SAME AMOUNT: for every currency, 16 locales and a spread of amounts, the LED number is the HUD's number (its
//      grouping and decimal marks, its decimals, a grouping space as the faces' one space), the symbol is the HUD's on the
//      HUD's side with the HUD's space (₨ written Rs, a right to left symbol in its order on the page)
//   3. THE GLYPHS: every character the rule can give has a glyph on the amount face and on the sentence face; every sign
//      has lit dots at every cap from 5 to 80 and none cut off by its canvas
//   4. THE COUNT: the count-up's row keeps its width (the faces' tabular cells) and the symbol its place, frame to frame
//   5. THE FALLBACK: a made-up code (XQZ) and a symbol without glyphs give the number alone, the HUD's decimals, no throw
//   6. SOCIAL: GC and SC as the HUD writes them (en, a space after the marker; GC whole, SC two decimals)
//   7. THE FIT: the longest amount at the smallest cap (5) fits the narrowest face less the tag title (200 dots)
//   node --experimental-strip-types --no-warnings tools/led_currency_check.mjs      (from apps/run_over_reindeer)
// Pass: every line PASS, "0 fail" and exit 0.
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const SDK = join(APP, '..', '..');
const LINGUI = pathToFileURL(join(APP, 'node_modules', '@lingui', 'core', 'dist', 'index.mjs')).href;
// the Svelte state the HUD's formatter reads, stood in by plain objects (the formatter itself is the real file)
const STATE = `import { i18n } from ${JSON.stringify(LINGUI)};
export const stateBet = { currency: 'USD', wageredBetAmount: 1 };
export const stateI18n = { i18n };
export const setLocale = (l) => { i18n.load(l, {}); i18n.activate(l); };`;
const STATE_URL = 'data:text/javascript,' + encodeURIComponent(STATE);
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
const led = await import(pathToFileURL(join(APP, 'src', 'game', 'scoreboard', 'ledCurrency.ts')).href);
const signs = await import(pathToFileURL(join(APP, 'src', 'game', 'scoreboard', 'ledSigns.ts')).href);

let pass = 0;
let fail = 0;
const check = (ok, msg, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail).slice(0, 900) : ''}`);
};

// the HUD's table, read from its source (it is not exported)
const src = readFileSync(join(SDK, 'packages', 'utils-shared', 'amount.ts'), 'utf8');
const META = {};
for (const m of src.matchAll(/^\t([A-Z]{3}): \{ symbol: '([^']*)', decimals: (\d)(, after: true)? \}/gm)) META[m[1]] = { symbol: m[2], decimals: +m[3], after: !!m[4] };
const SPACED = new Set(['XGC', 'XSC', 'XEC']);
// left out of LED_CURRENCIES on purpose (ledCurrency.ts): they take the fallback, the number alone
const UNSIGNED = new Set(['EGP']);
const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'id', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'vi', 'zh', 'fi', 'hi'];
const AMOUNTS = [0, 0.2, 0.0025, 1, 9.99, 12.5, 1234.5, 99999.99, 100000, 12345678, 987654321.12];

// 1. THE TABLE
const codes = Object.keys(META);
check(codes.length >= 45, `the HUD's table read from amount.ts (${codes.length} currencies)`);
const tableDiff = codes.filter((c) => (UNSIGNED.has(c) ? c in led.LED_CURRENCIES : led.LED_CURRENCIES[c] !== META[c].symbol)).concat(Object.keys(led.LED_CURRENCIES).filter((c) => !META[c]));
check(tableDiff.length === 0, 'every HUD currency is an LED currency with the same symbol, and every LED currency is in the HUD table', tableDiff);

// 2. THE SAME AMOUNT
const BIDI = /[‎‏؜]/g;
const norm = (s) => s.replace(/[   ]/g, ' ');
const ledSym = (sym) => {
	const s = sym.replace(/₨/g, 'Rs');
	return /[֐-ࣿ]/.test(s) ? [...s].reverse().join('') : s;
};
const emitted = new Set();
let compared = 0;
const wrong = [];
for (const loc of LOCALES) {
	state.setLocale(loc);
	for (const code of codes) {
		state.stateBet.currency = code;
		const M = META[code];
		for (const v of AMOUNTS) {
			for (const opts of [undefined, { fractionDigitsOf: v }, { maximumFractionDigits: 2 }]) {
				const text = hud.numberToCurrencyString(v, opts);
				const p = led.ledAmountParts(text, code);
				// the HUD's number: its text without its symbol and marks, independently of the LED's own parsing
				const bare = text.replace(BIDI, '').split(M.symbol).join('').trim();
				if (UNSIGNED.has(code)) {
					compared++;
					if (p.text !== norm(bare) || p.number !== norm(bare)) wrong.push({ loc, code, v, opts, text, led: p.text, want: norm(bare) });
					continue;
				}
				const want = M.after ? `${norm(bare)} ${ledSym(M.symbol)}` : SPACED.has(code) ? `${ledSym(M.symbol)} ${norm(bare)}` : `${ledSym(M.symbol)}${norm(bare)}`;
				compared++;
				if (p.text !== want || p.number !== norm(bare) || p.before === M.after) wrong.push({ loc, code, v, opts, text, led: p.text, want });
				for (const ch of p.text) emitted.add(ch);
			}
		}
	}
}
check(wrong.length === 0, `the LED text is the HUD's text for every currency, locale and amount (${compared} compared)`, wrong.slice(0, 4));
state.setLocale('en');
state.stateBet.currency = 'USD';
const spot = (code, v, want, loc = 'en', opts) => {
	state.setLocale(loc);
	state.stateBet.currency = code;
	const got = led.ledAmountText(hud.numberToCurrencyString(v, opts), code);
	check(got === want, `${code} ${v} (${loc}): "${got}"`, { want });
};
spot('USD', 1234.5, '$1,234.50');
spot('USD', 0.2, '$0.20');
spot('USD', 12345678, '$12,345,678.00');
spot('EUR', 1234.5, '€1.234,50', 'de');
spot('EUR', 1234.5, '€1 234,50', 'fr');
spot('JPY', 1234.5, '¥1,234.5', 'en', { fractionDigitsOf: 1234.5 });
spot('JPY', 1234, '¥1,234');
spot('BRL', 1234.5, 'R$1.234,50', 'pt');
spot('INR', 12345678, '₹1,23,45,678.00', 'hi');
spot('PLN', 1234.5, '1234,50 zł', 'pl');
spot('VND', 12345678, '12.345.678 ₫', 'vi');
spot('PKR', 1234.5, 'Rs1,234.50');
spot('EGP', 1234.5, '1,234.50'); // no sign on purpose (ledCurrency.ts: left out of LED_CURRENCIES until an Arabic reader approves the drawn letters)
spot('CAD', 0.2, 'CA$0.20');
spot('TND', 1.5, '1.500 TND');
spot('DKK', 1234.5, '1,234.50 KR');

// 3. THE GLYPHS
const noAmount = [...emitted].filter((ch) => !signs.amountFaceHas(ch));
const noSentence = [...emitted].filter((ch) => !signs.sentenceFaceHas(ch));
check(noAmount.length === 0, `every character the rule gives has an amount face glyph (${emitted.size} characters: ${[...emitted].sort().join('')})`, noAmount);
check(noSentence.length === 0, 'every character the rule gives has a sentence face glyph', noSentence);
const bad = [];
for (const ch of Object.keys(signs.AMOUNT_OUTLINES)) {
	for (let cap = 5; cap <= 80; cap++) {
		const d = signs.signDots(ch, cap);
		let lit = 0;
		let edge = 0;
		for (let y = 0; y < d.h; y++)
			for (let x = 0; x < d.w; x++)
				if (d.a[y * d.w + x]) {
					lit++;
					if (y === 0 || y === d.h - 1 || x === d.w - 1) edge++;
				}
		// (the top row may be lit by a sign's bar above the cap, as the font's own $; the bottom row and the right edge never)
		const bottom = [...Array(d.w).keys()].some((x) => d.a[(d.h - 1) * d.w + x]);
		if (!lit || bottom || [...Array(d.h).keys()].some((y) => d.a[y * d.w + d.w - 1])) bad.push({ ch, cap, lit, edge });
	}
	// ($ is the sentence font's own: ledScreens FONT)
	if (ch !== '$') check(Array.isArray(signs.SENTENCE_SIGNS[ch]) && signs.SENTENCE_SIGNS[ch].length === 7 && signs.SENTENCE_SIGNS[ch].every((r) => r.length === signs.SENTENCE_SIGNS[ch][0].length), `${ch}: its 5 x 7 sentence glyph is 7 even rows`);
}
check(bad.length === 0, 'every sign has lit dots at every cap from 5 to 80, none cut by its canvas', bad.slice(0, 6));
check(
	Object.entries(signs.AMOUNT_HAND).every(([ch, by]) => Object.entries(by).every(([cap, h]) => h.rows.length <= +cap + (h.up ?? 0) + Math.ceil(+cap * 0.4) + 1)),
	'every hand placed sign fits its canvas',
);

// 4. THE COUNT (the row's width as drawRow sets it: Overpass Heavy's advances at cap / 0.72 px, digits in one cell)
const ADV = {};
'0123456789.,ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzł  '.split('').forEach((c, i) => (ADV[c] = [667, 416, 611, 599, 656, 604, 623, 545, 638, 623, 252, 261, 737, 708, 635, 724, 637, 581, 663, 732, 311, 565, 733, 570, 812, 723, 720, 643, 720, 703, 621, 613, 724, 698, 853, 716, 707, 635, 573, 584, 564, 584, 568, 376, 584, 606, 297, 297, 575, 305, 890, 606, 572, 584, 584, 431, 505, 401, 606, 581, 765, 608, 588, 563, 305, 258, 258][i]));
const advOf = (ch, cap) => signs.signDots(ch, cap)?.adv ?? Math.ceil(((ADV[ch] ?? 600) * cap) / 0.72 / 1000);
const rowOf = (str, cap) => {
	const dcell = Math.max(...'0123456789'.split('').map((d) => advOf(d, cap)));
	const sp = Math.max(1, Math.round(cap * 0.07));
	const cells = [...str].map((ch) => (/\d/.test(ch) ? dcell : advOf(ch, cap)));
	const xs = [];
	let x = 0;
	for (const c of cells) {
		xs.push(x);
		x += c + sp;
	}
	return { w: x - sp, xs };
};
const jitter = [];
for (const code of codes) {
	state.stateBet.currency = code;
	for (const loc of ['en', 'de', 'fr', 'hi']) {
		state.setLocale(code.startsWith('X') ? 'en' : loc);
		for (const final of [0.37, 48.25, 2210.5, 123456.78]) {
			const fmt = (v) => led.ledAmountParts(hud.numberToCurrencyString(v, { fractionDigitsOf: final }), code);
			const byLen = new Map();
			for (let i = 0; i <= 400; i++) {
				const v = (final * i) / 400;
				const p = fmt(v);
				for (const cap of [11, 21, 37]) {
					const r = rowOf(p.text, cap);
					const k = `${[...p.text].length}|${cap}`;
					const symAt = p.symbol === null ? -1 : p.before ? r.xs[0] : r.xs[[...p.text].length - [...p.symbol].length];
					const prev = byLen.get(k);
					if (prev && (prev.w !== r.w || prev.symAt !== symAt)) jitter.push({ code, loc, final, v, text: p.text, cap, w: r.w, was: prev.w });
					else byLen.set(k, { w: r.w, symAt });
				}
			}
		}
	}
}
check(jitter.length === 0, 'a count-up keeps its row width and the symbol its place at every length (every currency, en de fr hi, caps 11 21 37)', jitter.slice(0, 3));

// 5. THE FALLBACK
state.setLocale('en');
state.stateBet.currency = 'XQZ';
let threw = null;
let fb = null;
const logs = [];
const info = console.info;
console.info = (...a) => logs.push(a.join(' '));
try {
	const text = hud.numberToCurrencyString(1234.5);
	fb = { hud: text, led: led.ledAmountParts(text, 'XQZ'), small: led.ledAmountText(hud.numberToCurrencyString(0.2), 'XQZ'), again: led.ledAmountText(hud.numberToCurrencyString(7), 'XQZ') };
} catch (e) {
	threw = String(e);
}
console.info = info;
check(!threw && fb.led.text === '1,234.50' && fb.led.symbol === null && fb.small === '0.20' && fb.again === '7.00', `a made-up currency (XQZ): the HUD writes "${fb?.hud}", the LED "${fb?.led.text}", "${fb?.small}", "${fb?.again}" (the number alone, 2 decimals)`, { threw, fb });
check(logs.length === 0, 'no console line outside a dev build (node has no import.meta.env.DEV)', logs);
led.LED_CURRENCIES.KZT = '₸';
const kz = led.ledAmountParts('₸1,234.50', 'KZT');
delete led.LED_CURRENCIES.KZT;
check(kz.text === '1,234.50' && kz.symbol === null, `a listed currency whose symbol has no glyph (₸): "${kz.text}"`);
check(led.ledAmountText('1,234.50 ₸', 'USD') === '1,234.50', 'a symbol with no glyph after the number: the number alone');

// 6. SOCIAL
spot('XGC', 1234, 'GC 1,234');
spot('XGC', 5000000000, 'GC 5,000,000,000');
spot('XSC', 1234.5, 'SC 1,234.50');
spot('XSC', 0.2, 'SC 0.20');
spot('XEC', 12.5, 'SC 12.50');

// 7. THE FIT
const longest = ['GC 999,999,999,999', '999,999,999.000 TND', 'ج.م999,999,999.99'.replace('ج.م', 'م.ج'), 'CA$999,999,999.9999', '₹99,99,99,999.99'];
const over = longest.map((s) => ({ s, w: rowOf(s, 5).w })).filter((r) => r.w > 200);
check(over.length === 0, `the longest amounts fit 200 dots at cap 5 (${longest.map((s) => rowOf(s, 5).w).join(', ')} dots)`, over);

console.log(`\nled_currency_check: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
