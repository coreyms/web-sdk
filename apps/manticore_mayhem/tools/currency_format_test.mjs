// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// THE CURRENCY FORMAT, A PURE TEST (no browser): src/game/currencyFormat.ts, the table every amount of the game is formatted
// by (game/amount.ts wires it to the session), against Stake's own table.
//   node --experimental-strip-types --no-warnings tools/currency_format_test.mjs
// Checked:
//   - every row of Stake's RGS page table (re-fetched 2026-11-21) formats 10 as its Example column: symbol, placement,
//     decimals ("$10.00", "¥10", "10.00 kr", "10.000000 BTC", "10.00 GC", "10.00 SC")
//   - the reviewers' set ([78], [219]): USD, EUR, CAD, MXN, JPY, USDT, BTC, XSC, XGC at several amounts, no "$" on GC / SC
//   - an unknown code shows itself after the amount with 2 decimals; a lower case code reads as its upper case one
//   - sub-unit wins ([273]): a 0.25x win on a 0.01 bet keeps its digits, float noise never adds one, never past 6
//   - a count-up's digits pinned to its target; the balance's exact decimals (BTC keeps its 6, JPY 0)
//   - the canvas form: every mark the Pixi glyph atlases can draw is kept; GEL and UAH (their signs are in no atlas) fall
//     back to the code after the amount, and every canvas string tokenizes in the stencil numerals and has a glyph in the
//     plaque's atlas, the cluster labels' atlas and both banner glyph sheets
//   - the app never asks Intl for its 'currency' style (it throws on USDT and has never heard of XGC)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURRENCY_TABLE, canvasMetaFor, currencyMetaFor, formatCurrency } from '../src/game/currencyFormat.ts';
import { tokenizeNumerals } from '../src/game/numeralTokens.ts';
import { NUMERAL_GLYPHS } from '../src/game/numeralGlyphs.ts';
import { LABEL_GLYPHS } from '../src/game/labelGlyphs.ts';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
let checks = 0;
const check = (ok, what, detail) => {
	checks++;
	if (!ok) {
		fails++;
		if (fails <= 40) console.log(`  FAIL ${what}${detail !== undefined ? ' ' + JSON.stringify(detail) : ''}`);
	}
};
// the locale's plain number, as the game's en session (and every social session) formats it
const en = (v, d) => new Intl.NumberFormat('en-US', d).format(v);
const fmt = (v, c, o) => formatCurrency(v, c, en, o);

// COPY OF Stake Engine's RGS page "Supported currencies" table, Example column (stake-engine.com/docs/rgs, fetched
// 2026-11-21): written out separately from the code's table on purpose, so a drift in either one fails here
const STAKE_EXAMPLES = {
	USD: '$10.00', CAD: 'CA$10.00', JPY: '¥10', EUR: '€10.00', RUB: '₽10.00', CNY: 'CN¥10.00', PHP: '₱10.00', INR: '₹10.00',
	IDR: 'Rp10', KRW: '₩10', BRL: 'R$10.00', MXN: 'MX$10.00', DKK: '10.00 kr', PLN: '10.00 zł', VND: '10 ₫', TRY: '₺10.00',
	CLP: '10 CLP', ARS: '10.00 ARS', PEN: 'S/10.00', NGN: '₦10.00', SAR: '10.00 SAR', ILS: '₪10.00', AED: '10.00 AED',
	TWD: 'NT$10.00', NOK: '10.00 kr', KWD: 'KD10.000', JOD: 'JD10.000', CRC: '₡10.00', TND: '10.000 TND', SGD: 'SG$10.00',
	MYR: 'RM10.00', OMR: '10.000 OMR', QAR: '10.00 QAR', BHD: 'BD10.000', PKR: '₨10.00', EGP: '10.00 EGP', NZD: 'NZ$10.00',
	BOB: 'Bs10.00', GHS: 'GH₵10.00', KES: 'KSh10.00', MAD: '10.00 MAD', BAM: 'KM10.00', ISK: '10 kr', TZS: 'TSh10.00',
	UGX: 'USh10', XOF: '10 CFA', AUD: 'A$10.00', BWP: 'P10.00', GEL: '₾10.00', HNL: 'L10.00', JMD: 'J$10.00',
	KGS: '10.00 KGS', MZN: '10.00 MZN', PGK: 'K10.00', TMT: '10.00 TMT', TTD: 'TT$10.00', UAH: '₴10.00', XCD: 'EC$10.00',
	APE: '10.0000 APE', BCH: '10.000000 BCH', BNB: '10.000000 BNB', BTC: '10.000000 BTC', BUSD: '10.00 BUSD',
	CRO: '10.0000 CRO', DAI: '10.00 DAI', DOGE: '10.0000 DOGE', EOS: '10.0000 EOS', ETH: '10.000000 ETH',
	LINK: '10.0000 LINK', LTC: '10.000000 LTC', POL: '10.0000 POL', SAND: '10.0000 SAND', SHIB: '10 SHIB',
	SOL: '10.000000 SOL', TRUMP: '10.0000 TRUMP', TRX: '10.0000 TRX', UNI: '10.0000 UNI', USDC: '10.00 USDC',
	USDT: '10.00 USDT', XRP: '10.0000 XRP', XGC: '10.00 GC', XSC: '10.00 SC', XEC: '10.00 SC', XRC: '10.00 SC', WRW: '10.00 SC',
};

// 1. the whole table
check(Object.keys(STAKE_EXAMPLES).length === 85 && Object.keys(CURRENCY_TABLE).length === 85, 'all 85 rows of the table', [Object.keys(STAKE_EXAMPLES).length, Object.keys(CURRENCY_TABLE).length]);
for (const [c, want] of Object.entries(STAKE_EXAMPLES)) {
	check(c in CURRENCY_TABLE, `${c} is in the code's table`);
	check(fmt(10, c) === want, `${c}: 10 reads "${want}"`, fmt(10, c));
	check(fmt(10, c, { exact: true }) === want, `${c}: the exact (balance) form of 10 reads "${want}"`, fmt(10, c, { exact: true }));
}

// 2. the reviewers' set, at several amounts
const SET = [
	['XGC', 10, '10.00 GC'], ['XSC', 10, '10.00 SC'], ['XGC', 1, '1.00 GC'], ['XGC', 1.4, '1.40 GC'], ['XGC', 250000, '250,000.00 GC'],
	['XGC', 1000000000, '1,000,000,000.00 GC'], ['XSC', 0.2, '0.20 SC'], ['XSC', 1234.5, '1,234.50 SC'], ['XSC', 0.0025, '0.0025 SC'],
	['USD', 10, '$10.00'], ['USD', 1234567.89, '$1,234,567.89'], ['USD', 0.1, '$0.10'], ['EUR', 10, '€10.00'], ['EUR', 0.5, '€0.50'],
	['CAD', 10, 'CA$10.00'], ['MXN', 10, 'MX$10.00'], ['JPY', 10, '¥10'], ['JPY', 1500, '¥1,500'], ['USDT', 10, '10.00 USDT'],
	['USDT', 0.1, '0.10 USDT'], ['BTC', 10, '10.000000 BTC'], ['BTC', 0.0001, '0.000100 BTC'], ['BTC', 0.000001, '0.000001 BTC'],
];
for (const [c, v, want] of SET) check(fmt(v, c) === want, `${c} ${v} reads "${want}"`, fmt(v, c));
for (const c of ['XGC', 'XSC', 'XEC', 'XRC', 'WRW']) {
	const t = fmt(1234.5, c);
	check(!t.includes('$') && /^[0-9,]+\.\d\d (GC|SC)$/.test(t), `${c}: amount first, two decimals, then its code, no "$" (${t})`);
}

// 3. outside the table
check(fmt(10, 'ABCD') === '10.00 ABCD', 'an unknown code after the amount, 2 decimals', fmt(10, 'ABCD'));
check(fmt(10, 'xgc') === '10.00 GC' && fmt(10, 'usd') === '$10.00', 'a lower case code reads as its upper case one', [fmt(10, 'xgc'), fmt(10, 'usd')]);
check(currencyMetaFor('').after === true, 'an empty code is safe');

// 4. sub-unit wins and float noise
check(fmt(0.0025, 'USD') === '$0.0025', 'a 0.25x win on a $0.01 bet keeps its digits', fmt(0.0025, 'USD'));
check(fmt(0.025, 'USD') === '$0.025', 'one extra digit when only one is real', fmt(0.025, 'USD'));
check(fmt(0.03000000000000000444, 'USD') === '$0.03', 'float noise adds no digit', fmt(0.03000000000000000444, 'USD'));
check(fmt(0.5, 'JPY') === '¥0.5' && fmt(10, 'JPY') === '¥10', 'JPY: whole yen, a real fraction extends', [fmt(0.5, 'JPY'), fmt(10, 'JPY')]);
check(fmt(0.00001, 'DOGE') === '0.00001 DOGE' && fmt(0.0000001, 'DOGE') === '0.0000 DOGE', 'a 4 decimal coin extends to 6 at most', [fmt(0.00001, 'DOGE'), fmt(0.0000001, 'DOGE')]);

// 5. count-ups pinned to the target; the balance's exact decimals
check(fmt(0.001, 'USD', { fractionDigitsOf: 0.0025 }) === '$0.0010', 'a count pinned to its target shows the target\'s digits', fmt(0.001, 'USD', { fractionDigitsOf: 0.0025 }));
check(fmt(123.4, 'XGC', { fractionDigitsOf: 250000 }) === '123.40 GC', 'a GC count shows the two decimals all the way', fmt(123.4, 'XGC', { fractionDigitsOf: 250000 }));
check(fmt(10069.789, 'USD', { exact: true }) === '$10,069.79', 'the balance: the currency\'s own decimals, nothing finer', fmt(10069.789, 'USD', { exact: true }));
check(fmt(0.12345678, 'BTC', { exact: true }) === '0.123457 BTC', 'the balance in BTC keeps its 6 decimals', fmt(0.12345678, 'BTC', { exact: true }));
check(fmt(1234.4, 'JPY', { exact: true }) === '¥1,234', 'the balance in JPY: no decimals', fmt(1234.4, 'JPY', { exact: true }));
check(fmt(99999.5, 'XGC', { exact: true }) === '99,999.50 GC', 'a GC balance: two decimals', fmt(99999.5, 'XGC', { exact: true }));

// 6. the canvas form and the atlases
const read = (p) => JSON.parse(fs.readFileSync(path.join(APP, p), 'utf8'));
const plaque = read('static/assets/ui/stinger/stinger.json').text.glyphs;
const banner = ['D', 'P'].map((cls) => read(`static/assets/ui/banner/banner-glyphs-${cls}.json`).frames);
const SKIP = new Set([' ', ' ', ' ', ' ']);
for (const c of Object.keys(CURRENCY_TABLE)) {
	const plain = fmt(1234567.89, c);
	const canvas = fmt(1234567.89, c, { canvas: true });
	if (c === 'GEL' || c === 'UAH') check(canvas === `${fmt(1234567.89, 'ABC').replace(' ABC', '')} ${c}`, `${c}: the canvas form puts the code after the amount (its sign is in no atlas)`, canvas);
	else check(canvas === plain, `${c}: the canvas form is the table's own (${plain})`, canvas);
	check(canvasMetaFor(c).decimals === CURRENCY_TABLE[c].decimals, `${c}: the canvas form keeps the decimals`);
	const toks = tokenizeNumerals(canvas);
	check(!!toks && toks.every((t) => t === null || t in NUMERAL_GLYPHS), `${c}: "${canvas}" draws in the stencil numerals`, toks);
	for (const ch of canvas) {
		if (SKIP.has(ch)) continue;
		check(ch in plaque, `${c}: the plaque's atlas has "${ch}"`);
		check(ch in LABEL_GLYPHS, `${c}: the cluster labels' atlas has "${ch}"`);
		const key = `stg_g_${ch.codePointAt(0).toString(16).padStart(4, '0')}`;
		check(banner.every((f) => key in f), `${c}: both banner glyph sheets have "${ch}"`);
	}
}

// 7. no Intl currency style anywhere in the app
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const intlCurrency = walk(path.join(APP, 'src')).filter((f) => /\.(ts|svelte)$/.test(f) && /style:\s*['"]currency['"]/.test(fs.readFileSync(f, 'utf8')));
check(intlCurrency.length === 0, 'no Intl currency style in the app', intlCurrency);
const shared = walk(path.join(APP, 'src')).filter((f) => /\.(ts|svelte)$/.test(f) && /from '[^']*utils-shared\/amount'/.test(fs.readFileSync(f, 'utf8')));
check(shared.length === 1 && shared[0].endsWith(path.join('game', 'amount.ts')), 'only game/amount.ts imports the shared amount module', shared.map((f) => path.relative(APP, f)));

console.log(`currency format: ${checks - fails} of ${checks} checks pass`);
if (fails) {
	console.log(`FAIL ${fails}`);
	process.exit(1);
}
console.log('PASS');
