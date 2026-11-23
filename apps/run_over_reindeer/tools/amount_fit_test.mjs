// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// THE AMOUNT FIT TEST (2026-11-21, wip/pricefit): node only, no browser, no canvas. It runs the game's own formatter
// (src/game/currency.ts, the real @lingui/core and a stand-in for the Svelte state) and the game's own fit
// (src/ui/fitAmount.ts fitAmountPx) over the WORST string every amount box can be asked to show, in all of Stake's
// currencies, measured with the advance widths of the game's own bundled fonts (tools/amount_fit_metrics.json, from
// tools/build_amount_metrics.py: kerning off and every digit at the widest digit's width, so each width is an upper bound).
//   node --experimental-strip-types --no-warnings tools/amount_fit_test.mjs            (from apps/run_over_reindeer)
//   TABLE=1 node --experimental-strip-types --no-warnings tools/amount_fit_test.mjs    (prints the worst-case table too)
// Checked:
//   1. THE FIT: fitAmountPx answers the nominal size when a string fits, else a size at which it fits (under the box by
//      the headroom), in 0.1 px steps, never bigger for a longer string of the same face
//   2. NO BREAK INSIDE AN AMOUNT: in every currency and 12 locales, every amount the formatter writes has no breaking
//      space in it (the space before a trailing code is U+00A0), so a sentence ("Every spin uses 2.000000 BTC until you
//      switch it off here.") keeps the number and its code on one line; the Fast Lane's sentences, filled the way the
//      menu fills them, keep the amount whole
//   3. THE WORST CASE PER BOX: for each box, its longest string over the 85 currencies at the top bet (the larger of
//      the probe host's ladder and a $1,000 top bet at today's rates, see LADDERS) and the largest multiple it can show
//      (300x Super for a price, the 7,777x cap for a total, 10,000x the top bet for a balance), fitted at no less than
//      the box's floor. Boxes that wrap by design (sentences) are checked for the no-break rule instead.
// Pass: every line PASS, "0 fail" and exit 0.
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const SDK = join(APP, '..', '..');
const LINGUI = pathToFileURL(join(APP, 'node_modules', '@lingui', 'core', 'dist', 'index.mjs')).href;
const STATE = `import { i18n } from ${JSON.stringify(LINGUI)};
export const stateBet = { currency: 'USD', wageredBetAmount: 1 };
export const stateI18n = { i18n };
export const setLocale = (l) => { i18n.load(l, {}); i18n.activate(l); };`;
const STATE_URL = 'data:text/javascript,' + encodeURIComponent(STATE);
const BET_URL = pathToFileURL(join(SDK, 'packages', 'constants-shared', 'bet.ts')).href;
const AMOUNT_URL = pathToFileURL(join(SDK, 'packages', 'utils-shared', 'amount.ts')).href;
register(
	'data:text/javascript,' +
		encodeURIComponent(`export async function resolve(s, c, n) {
	if (s === 'state-shared') return { url: ${JSON.stringify(STATE_URL)}, shortCircuit: true };
	if (s === 'constants-shared/bet') return { url: ${JSON.stringify(BET_URL)}, shortCircuit: true };
	if (s === 'utils-shared/amount') return { url: ${JSON.stringify(AMOUNT_URL)}, shortCircuit: true };
	if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return n(s + '.ts', c);
	return n(s, c);
}`),
);
const state = await import(STATE_URL);
const cur = await import(pathToFileURL(join(APP, 'src', 'game', 'currency.ts')).href);
const fit = await import(pathToFileURL(join(APP, 'src', 'ui', 'fitAmount.ts')).href);
const M = JSON.parse(readFileSync(join(APP, 'tools', 'amount_fit_metrics.json'), 'utf8'));

let pass = 0;
let fail = 0;
const check = (ok, msg, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail).slice(0, 900) : ''}`);
};

// ---- the measure: the bundled faces' advances (em), the fallback face's width for a sign no face has -------------------
const faceKey = (face, weight) => {
	const name = /Outfit Text/.test(face) ? 'Outfit Text' : /Overpass/.test(face) ? 'Overpass' : /Sora/.test(face) ? 'Sora' : 'Outfit';
	const ws = Object.keys(M.faces).filter((k) => k.startsWith(name + '|')).map((k) => Number(k.split('|')[1]));
	const w = ws.reduce((b, x) => (Math.abs(x - weight) < Math.abs(b - weight) ? x : b), ws[0]);
	return `${name}|${w}`;
};
const measure = (text, px, weight, trackPx, face) => {
	const adv = M.faces[faceKey(face, weight)];
	let em = 0;
	for (const ch of text) em += adv[/\d/.test(ch) ? '0' : ch] ?? M.missing;
	return em * px + trackPx * [...text].length;
};

// ---- 1. THE FIT ------------------------------------------------------------------------------------------------------
{
	const F = { face: 'Overpass', weight: 900 };
	const bad = [];
	for (const [t, nominal, box] of [
		['$10.00', 40, 244],
		['100.000000\u00a0BTC', 40, 244],
		['100.000000\u00a0BTC', 23, 144],
		['300.00\u00a0USDT', 23, 141],
		['30,000.000000\u00a0BTC', 23, 141],
		['Rp4,950,000,000', 23, 141],
	]) {
		const px = fit.fitAmountPx(t, nominal, box, F, measure);
		const w = measure(t, px, 900, 0, 'Overpass');
		const fitsAtNominal = measure(t, nominal, 900, 0, 'Overpass') <= box;
		if (fitsAtNominal ? px !== nominal : !(w <= box * fit.FIT_HEADROOM + 0.01) || px > nominal) bad.push({ t, nominal, box, px, w });
		if (Math.round(px * 10) !== px * 10) bad.push({ t, px, step: '0.1' });
	}
	check(bad.length === 0, 'fitAmountPx: the nominal size when the string fits, else a size under the box, in 0.1 px steps', bad);
	const a = fit.fitAmountPx('10.000000\u00a0BTC', 23, 141, F, measure);
	const b = fit.fitAmountPx('100.000000\u00a0BTC', 23, 141, F, measure);
	check(b <= a, `fitAmountPx: a longer string never gets a bigger size (${a} then ${b})`);
	check(fit.fitAmountPx('', 23, 141, F, measure) === 23 && fit.fitAmountPx('$1', 23, 0, F, measure) === 23, 'fitAmountPx: no text or no box leaves the nominal size');
}

// ---- 2. NO BREAK INSIDE AN AMOUNT --------------------------------------------------------------------------------------
// a breaking space: any Unicode space separator but U+00A0 and U+202F (narrow no-break), or a tab
const BREAKING = /[\u0020\u1680\u2000-\u200b\u205f\u3000\t]/;
const LOCALES = ['en', 'de', 'fr', 'es', 'pt', 'it', 'ru', 'tr', 'pl', 'ja', 'ko', 'ar'];
const CODES = Object.keys(cur.CURRENCY_TABLE).concat(['XQZ']);
{
	const bad = [];
	for (const loc of LOCALES) {
		state.setLocale(loc);
		for (const code of CODES) {
			state.stateBet.currency = code;
			for (const v of [0.0025, 1, 10, 1234.5, 1234567.891, 7777000000]) {
				for (const opts of [undefined, { fixed: true }]) {
					const t = cur.numberToCurrencyString(v, opts);
					if (BREAKING.test(t)) bad.push({ loc, code, v, t });
				}
			}
		}
	}
	state.setLocale('en');
	check(bad.length === 0, `no breaking space inside any amount (${CODES.length} currencies, ${LOCALES.length} locales, free and fixed)`, bad.slice(0, 6));
	// the Fast Lane's sentences, filled as FeatureMenu.svelte's runs() fills them: the amount stays one unbreakable run
	const menu = readFileSync(join(APP, 'src', 'game', 'featureMenuData.ts'), 'utf8');
	const templates = [...menu.matchAll(/'([^'\n]*\{amount\}[^'\n]*)'/g)].map((m) => m[1]);
	const whole = [];
	for (const code of ['USD', 'BTC', 'USDT', 'XGC', 'XSC', 'TRUMP', 'KWD', 'IDR', 'SHIB']) {
		state.stateBet.currency = code;
		const amount = cur.numberToCurrencyString(300 * 100);
		for (const tpl of templates) {
			const filled = tpl.replace(/\{(\w+)\}/g, (_, k) => (k === 'amount' ? amount : 'ANTE 10x')).split('**').join('');
			if (!filled.includes(amount) || BREAKING.test(amount)) whole.push({ code, tpl, amount });
		}
	}
	check(templates.length >= 6 && whole.length === 0, `the Fast Lane's ${templates.length} sentences with an amount (social variants share them) keep it on one line in BTC, USDT, GC, SC and long codes`, whole.slice(0, 4));
	check(cur.AMOUNT_SPACE === '\u00a0' && /\$\{AMOUNT_SPACE\}/.test(readFileSync(join(APP, 'src', 'game', 'currency.ts'), 'utf8')), 'placeSymbol joins a trailing code with AMOUNT_SPACE (U+00A0)');
}

// ---- 3. THE WORST CASE PER BOX -----------------------------------------------------------------------------------------
// LADDERS. The top bet the RGS can send is not known per currency, so the worst case takes the larger of two:
//  - the probe host's ladder (COPY OF tools/mock_rgs.py DENOMS / CURRENCY_SCALE and src/fixtures/fixtureRgs.ts BET_LEVELS):
//    100 currency units at the top, 10,000 for the zero-decimal fiat it scales (JPY IDR KRW VND CLP ISK UGX XOF),
//    1,000,000 GC; every other code, crypto included, the fiat ladder as is (so 100 BTC: no real ladder is that big,
//    which makes it the safe bound for BTC, ETH and the other 6 decimal coins);
//  - a $1,000 top bet (the HUD's own sizing: "the amount $1,000.00") at UNITS_PER_USD, rounded up (an estimate of
//    2026 rates; only the digit count matters, and every entry is rounded up to keep a digit of headroom where it is close).
const MOCK_SCALE = { XGC: 10_000, JPY: 100, IDR: 100, KRW: 100, VND: 100, CLP: 100, ISK: 100, UGX: 100, XOF: 100 };
const UNITS_PER_USD = {
	USD: 1, CAD: 1.45, JPY: 160, EUR: 1, RUB: 110, CNY: 7.5, PHP: 60, INR: 95, IDR: 17000, KRW: 1500, BRL: 6.5, MXN: 21,
	DKK: 7.5, PLN: 4.5, VND: 27000, TRY: 45, CLP: 1000, ARS: 2000, PEN: 4, NGN: 1700, SAR: 3.8, ILS: 4, AED: 3.7, TWD: 33,
	NOK: 11.5, KWD: 0.31, JOD: 0.71, CRC: 520, TND: 3.2, SGD: 1.4, MYR: 4.8, OMR: 0.39, QAR: 3.7, BHD: 0.38, PKR: 300,
	EGP: 52, NZD: 1.8, BOB: 7, GHS: 16, KES: 135, MAD: 10.5, BAM: 1.9, ISK: 145, TZS: 2800, UGX: 3900, XOF: 650, AUD: 1.6,
	BWP: 14, GEL: 2.8, HNL: 27, JMD: 160, KGS: 90, MZN: 65, PGK: 4.2, TMT: 3.6, TTD: 7, UAH: 43, XCD: 2.8,
	// crypto, units per USD at 2026 prices, rounded up (a fall in price is more units)
	APE: 5, BCH: 0.005, BNB: 0.003, BTC: 0.00002, BUSD: 1, CRO: 15, DAI: 1, DOGE: 10, EOS: 5, ETH: 0.0005, LINK: 0.1,
	LTC: 0.02, POL: 8, SAND: 6, SHIB: 120000, SOL: 0.01, TRUMP: 0.3, TRX: 6, UNI: 0.2, USDC: 1, USDT: 1, XRP: 1,
	XGC: 1000, XSC: 1, XEC: 1, XRC: 1, WRW: 1,
};
check(Object.keys(cur.CURRENCY_TABLE).every((c) => c in UNITS_PER_USD), "the worst case covers every currency of the game's table", Object.keys(cur.CURRENCY_TABLE).filter((c) => !(c in UNITS_PER_USD)));
/** a top bet's units, rounded to the currency's decimals' worth of a "round" bet (two significant figures up) */
const roundUp = (v) => {
	const p = 10 ** Math.max(0, Math.floor(Math.log10(v)) - 1);
	return Math.ceil(v / p) * p;
};
const topBet = (code) => Math.max(100 * (MOCK_SCALE[code] ?? 1), roundUp(1000 * UNITS_PER_USD[code]));
const fmt = (code, v, opts) => {
	state.stateBet.currency = code;
	return cur.numberToCurrencyString(v, opts);
};
/** a figure of every digit 9 with the magnitude of v: the widest string of that length (digits are measured at the widest
 *  digit anyway; this keeps the grouping marks at their most) */
const nines = (v) => Number('9'.repeat(Math.max(1, Math.floor(Math.log10(Math.max(1, v))) + 1)));
const KINDS = {
	bet: (c) => [fmt(c, topBet(c))],
	ante: (c) => [fmt(c, 10 * topBet(c))],
	price: (c) => [fmt(c, 300 * topBet(c))],
	// a total: the cap (7,777x) at the currency's decimals, or a 300x win carrying two finer digits (a 0.25x line win on
	// a bet with cents), whichever is longer
	win: (c) => [fmt(c, 7777 * topBet(c)), fmt(c, 300 * topBet(c) + 0.0025 * 10 ** -(cur.currencyMinorUnits(c) - 2))],
	pay: (c) => [fmt(c, 25 * topBet(c))],
	balance: (c) => [fmt(c, nines(10_000 * topBet(c)) + 0.99, { fixed: true })],
	// a session's net: down by a max win's worth (7,777x the top bet), the most a session's figure is read at
	net: (c) => ['-' + fmt(c, 7777 * topBet(c), { fixed: true })],
	autoTotal: (c) => [fmt(c, 1000 * 10 * topBet(c))],
};
/** the currencies Stake's reviewers load (review item [219] and the social coins, [78]) */
const REVIEW = ['USD', 'EUR', 'CAD', 'MXN', 'JPY', 'USDT', 'BTC', 'XSC', 'XGC'];
const worstOf = (kind, face, px, codes = Object.keys(cur.CURRENCY_TABLE)) => {
	let best = { w: -1 };
	for (const c of codes)
		for (const t of KINDS[kind](c)) {
			const w = measure(t, px, face.weight, face.trackPx ?? 0, face.face);
			if (w > best.w) best = { w, t, c };
		}
	return best;
};

// THE BOXES. `box` is the content width the amount has at the smallest layout that box appears in (design px inside the
// Fast Lane's scaled box; mock px in the bar), read from the CSS (file and selector named); `nominal` its CSS size;
// `floor` the size the fit must not need to go under (null: not a floor box, reported only); `how` what the box does with
// a long string. Fast Lane price plate widths are the probe host's clientWidth on dba8b786 less the plate's padding.
const OV = (weight) => ({ face: 'Overpass', weight });
const OUT = { face: 'Outfit', weight: 900 };
const SORA = { face: 'Sora', weight: 800 };
const BOXES = [
	// THE FAST LANE (ui/FeatureMenu.svelte)
	{ id: 'fl.price.desk', el: 'Fast Lane price plate, desktop (.desk .price .amt)', kind: 'price', f: OV(900), nominal: 40, box: 260 - 16, floor: 20, how: 'fitAmount' },
	{ id: 'fl.price.up', el: 'Fast Lane price plate, upright phone (.up .price .amt)', kind: 'price', f: OV(900), nominal: 23, box: 152 - 8, floor: 12, how: 'fitAmount' },
	{ id: 'fl.price.side', el: 'Fast Lane price plate, sideways phone (.side .price .amt)', kind: 'price', f: OV(900), nominal: 23, box: 149 - 8, floor: 12, how: 'fitAmount' },
	{ id: 'fl.bal.desk', el: 'Fast Lane BALANCE, desktop (.desk .hud .val, 262 wide)', kind: 'balance', f: OV(900), nominal: 30, box: 262, floor: 14, how: 'fitAmount' },
	{ id: 'fl.bal.up', el: 'Fast Lane BALANCE, upright (.up .hud .bal: 366 less 196 and 12)', kind: 'balance', f: OV(900), nominal: 19, box: 158, floor: 9, how: 'fitAmount' },
	{ id: 'fl.bal.side', el: 'Fast Lane BALANCE, sideways (.side .hud, the 184 px column)', kind: 'balance', f: OV(900), nominal: 18, box: 184, floor: 9, how: 'fitAmount' },
	{ id: 'fl.amt.desk', el: 'Fast Lane PLAY AMOUNT, desktop (262 less two 48 px steps and gaps)', kind: 'bet', f: OV(900), nominal: 32, box: 146, floor: 14, how: 'fitAmount' },
	{ id: 'fl.amt.up', el: 'Fast Lane PLAY AMOUNT, upright (196 less two 44 px steps and gaps)', kind: 'bet', f: OV(900), nominal: 19, box: 96, floor: 9, how: 'fitAmount' },
	{ id: 'fl.amt.side', el: 'Fast Lane PLAY AMOUNT, sideways (184 less two 44 px steps and gaps)', kind: 'bet', f: OV(900), nominal: 18, box: 84, floor: 9, how: 'fitAmount' },
	// the confirm card's rows (grid auto | minmax(0, 1fr)): the amounts' column is the card's inside less the widest word
	// ("SUPER FREE SPINS" and "PLAY AMOUNT" at 15 px 700, "EVERY SPIN" at 20 px 900) and the 12 px gap; the upright card
	// 340 less 10 border less 32 padding = 298, the sideways 400 (358), the desktop 470 (412)
	{ id: 'fl.card.amount.up', el: 'Fast Lane confirm card, PLAY AMOUNT row, upright (.card.c-up .rows)', kind: 'bet', f: OV(900), nominal: 15, box: 298 - 12, floor: 10, how: 'fitAmount', label: true },
	{ id: 'fl.card.total.up', el: 'Fast Lane confirm card, EVERY SPIN / TOTAL row, upright (.rows div.tot)', kind: 'price', f: OV(900), nominal: 20, box: 298 - 12, floor: 11, how: 'fitAmount', label: true },
	{ id: 'fl.card.total.desk', el: 'Fast Lane confirm card, total row, desktop (470 card)', kind: 'price', f: OV(900), nominal: 20, box: 412 - 12, floor: 11, how: 'fitAmount', label: true },
	// THE BAR (ui/hud/HudReadout.svelte fitted(): shrinks with no floor; mock px, about CSS px at 1440 x 900 and 390 x 844)
	{ id: 'hud.bal.desk', el: 'Bar BALANCE, desktop (hudLayout desktop balW 178, pad 12)', kind: 'balance', f: OUT, nominal: 19, box: 166, floor: null, how: 'fitted()' },
	{ id: 'hud.win.desk', el: 'Bar WIN, desktop (winW 190, pad 12)', kind: 'win', f: OUT, nominal: 22, box: 178, floor: null, how: 'fitted()' },
	{ id: 'hud.amt.desk', el: 'Bar amount, desktop (amtW 106, pad 12; Super loaded shows 300x)', kind: 'price', f: OUT, nominal: 19, box: 94, floor: null, how: 'fitted()' },
	{ id: 'hud.bal.pt', el: 'Bar BALANCE, upright (row6 col 6.83 x 17 = 117, pad 0)', kind: 'balance', f: OUT, nominal: 17, box: 117, floor: null, how: 'fitted()' },
	{ id: 'hud.win.pt', el: 'Bar WIN, upright (117, pad 0)', kind: 'win', f: OUT, nominal: 17, box: 117, floor: null, how: 'fitted()' },
	{ id: 'hud.amt.pt', el: 'Bar amount, upright (row6 amt 4.77 x 17 = 82, pad 0)', kind: 'price', f: OUT, nominal: 17, box: 82, floor: null, how: 'fitted()' },
	{ id: 'hud.bal.lc', el: 'Bar BALANCE, sideways phone (capsule 128, pad 12)', kind: 'balance', f: OUT, nominal: 15, box: 116, floor: null, how: 'fitted()' },
	{ id: 'hud.win.lc', el: 'Bar WIN, sideways phone (128, pad 12)', kind: 'win', f: OUT, nominal: 15, box: 116, floor: null, how: 'fitted()' },
	{ id: 'hud.amt.lc', el: 'Bar amount, sideways phone (80, pad 12)', kind: 'price', f: OUT, nominal: 14, box: 68, floor: null, how: 'fitted()' },
	// THE SIGN BAR'S AMOUNT, PER GAME MODE (2026-11-24, Corey: "I should have said per game mode ... The arrows should stay
	// where they are at"; ui/sign/signLayout.ts amountType, tools/sign_layout_test.mjs section 8 h holds the rule and
	// prints the table): the number is sized for the widest amount of the mode in play in the room between the two DRAWN
	// bet symbols, which stay at the base game's seat. `box` is that room in USD at the tightest of Corey's windows of each
	// family (sideways 667 x 311: 66 px at the 10.3 px common number size; upright 375 x 530: 77.9 px at 12.2 px), for the
	// base game, the top Ante level (10x) and a loaded Super (300x). No floor: where a long currency's widest needs less
	// than 9 px it is drawn at what fits, never clipped (the rule's `under`), and what that is is listed here.
	{ id: 'sign.amt.base.side', el: 'Sign bar amount, base game, 667 x 311 (room 66, common size 10.3)', kind: 'bet', f: OV(900), nominal: 10.3, box: 66, floor: null, how: 'amountType()' },
	{ id: 'sign.amt.ante.side', el: 'Sign bar amount, Ante 10x, 667 x 311', kind: 'ante', f: OV(900), nominal: 10.3, box: 66, floor: null, how: 'amountType()' },
	{ id: 'sign.amt.super.side', el: 'Sign bar amount, Super loaded (300x), 667 x 311', kind: 'price', f: OV(900), nominal: 10.3, box: 66, floor: null, how: 'amountType()' },
	{ id: 'sign.amt.base.up', el: 'Sign bar amount, base game, 375 x 530 (room 77.9, common size 12.2)', kind: 'bet', f: OV(900), nominal: 12.2, box: 77.9, floor: null, how: 'amountType()' },
	{ id: 'sign.amt.ante.up', el: 'Sign bar amount, Ante 10x, 375 x 530', kind: 'ante', f: OV(900), nominal: 12.2, box: 77.9, floor: null, how: 'amountType()' },
	{ id: 'sign.amt.super.up', el: 'Sign bar amount, Super loaded (300x), 375 x 530', kind: 'price', f: OV(900), nominal: 12.2, box: 77.9, floor: null, how: 'amountType()' },
	// MODALS
	{ id: 'replay.total', el: 'Replay card TOTAL WIN, 390 wide (.v.big 5vmin = 19.5 px; 321 less "TOTAL WIN" 84 and gap 8)', kind: 'win', f: SORA, nominal: 19.5, box: 229, floor: 12, how: 'fitAmount (was overflow-wrap: anywhere)' },
	{ id: 'replay.bet', el: 'Replay card TOTAL BET, 390 wide (.v 3.4vmin = 13.3 px; 321 less "TOTAL BET" 84 and gap 8)', kind: 'price', f: SORA, nominal: 13.3, box: 229, floor: 10, how: 'fitAmount (was overflow-wrap: anywhere)' },
	// Game Info's pays (the guide sign, 2026-11-23): beside the name while the row has 430 px and the three widest leave
	// the name its longest word (GameInfoModal stackPays), else stacked under it, three cells across while the widest
	// single pay fits a cell at its size, else one per line. One per line at 320 wide is the tightest: 320 less the
	// sign's 2 x 6 margin, its 2 x 4 band and 2 x 10 padding, the plaque's 2 x 2 line and 2 x 12 padding, 27 the row's
	// padding and line, about 10 for the count and 12 its gap = 203
	{ id: 'gi.pay', el: 'Game Info paytable pay, 320 wide, stacked one per line (.row.stack .pay-v, Overpass 900 15 px)', kind: 'pay', f: OV(900), nominal: 15, box: 203, floor: 11, how: 'stacked when long + fitAmount (was three across, nowrap, no fit)' },
	{ id: 'popup.pay', el: 'Symbol popup 5 IN A ROW pay (236 x 0.86 wide, pad 12, border 3; less "5" and 0.8 em: 152)', kind: 'pay', f: OV(900), nominal: 14, box: 152, floor: null, how: 'fixed width, nowrap (checked: fits at nominal)' },
	{ id: 'menu.net', el: 'Menu panel NET, tablet (narrow panel 178 less 22 padding and 8; 9 px, 0.14 em tracking)', kind: 'net', f: { face: 'Outfit', weight: 900, trackPx: 1.26 }, nominal: 9, box: 156 - measure('NET', 9, 900, 1.26 * 3, 'Outfit') - 5, floor: null, how: 'fitFont to the panel line (HudMenuPanel netFont; was no fit)' },
	// (2026-11-23, the sign panels: the Autoplay card's total is Overpass 900 at 22 px in every layout; its box is 0.58 of
	// the tiles' column less 4: 412 less 2 x 14 padding and the 2 x 4 band upright, half of 760 less the same and the 18
	// gap on the wide card. The sign bar's Menu pop-out fits its NET like the dock's panel: 296 less 2 x 15, 10 px type)
	{ id: 'auto.total', el: 'Autoplay TOTAL, upright (fitFont floor 12 into 0.58 of 372)', kind: 'autoTotal', f: OV(900), nominal: 22, box: 0.58 * 372, floor: 12, how: 'fitFont floor 12' },
	{ id: 'auto.total.wide', el: 'Autoplay TOTAL, the wide card (fitFont floor 12 into 0.58 of 349)', kind: 'autoTotal', f: OV(900), nominal: 22, box: 0.58 * 349, floor: 12, how: 'fitFont floor 12' },
	{ id: 'menu.net.sign', el: 'Sign bar Menu pop-out NET alone on its line (296 less 30; 10 px, 0.1 em tracking)', kind: 'net', f: { face: 'Overpass', weight: 900, trackPx: 1 }, nominal: 10, box: 266 - measure('NET', 10, 900, 1 * 3, 'Overpass') - 5, floor: null, how: 'fitFont to the panel line (SignMenuPanel netFont)' },
	// the Autoplay card at Stake's 400 x 225 popout (ui/AutoplayModal.svelte LOW, 2026-11-22, wip/smallsizes; in the sign
	// style since 2026-11-23): the right column is (392 less the 2 x 4 band, 20 padding and the 10 gap) / 2.25 = 157.3. A
	// long total takes that column's own line (less 4), START's amount the key's inside (less its 2 x 3 band and 16
	// padding; letter-spacing 0.04 em, here as 20 letters of it)
	{ id: 'auto.total.low', el: 'Autoplay TOTAL, 400 x 225 (LOW: its own line, 153.3)', kind: 'autoTotal', f: OV(900), nominal: 14, box: 153.3, floor: 11, how: 'fitFont floor 11' },
	{ id: 'auto.go.low', el: "Autoplay START's amount, 400 x 225 (LOW: under the words, 135.3)", kind: 'autoTotal', f: OV(900), nominal: 12, box: 135.3 - 20 * 0.48, floor: 8.5, how: 'fitFont floor 8.5' },
];
// the confirm card's value column is the inside less its label's own width (computed here from the face)
const CARD_WORDS = Math.max(measure('SUPER FREE SPINS', 15, 700, 0, 'Overpass'), measure('PLAY AMOUNT', 15, 700, 0, 'Overpass'), measure('EVERY SPIN', 20, 900, 0, 'Overpass'));
for (const b of BOXES) if (b.label) b.box -= CARD_WORDS;

// THE POLICY. Every box FITS every string (the fit's own construction, checked below). The floor is a readability floor:
//   - in the reviewers' nine currencies every floor box stays at or above its floor (FAIL otherwise);
//   - in the other 76 a box under its floor is a WARN line: the fit goes on shrinking (the element reads
//     data-fit="under"), it is never clipped. Those are the cases the notes weigh the two-line form for.
const NB = String.fromCharCode(160);
const plainT = (t) => t.split(NB).join(' ');
const rows = [];
let warns = 0;
for (const b of BOXES) {
	const worst = worstOf(b.kind, b.f, b.nominal);
	const rev = worstOf(b.kind, b.f, b.nominal, REVIEW);
	const px = fit.fitAmountPx(worst.t, b.nominal, b.box, b.f, measure);
	const rpx = fit.fitAmountPx(rev.t, b.nominal, b.box, b.f, measure);
	const fitsNominal = px >= b.nominal;
	rows.push({ ...b, worst, px, rev, rpx, fitsNominal });
	if (b.how.startsWith('fixed')) {
		// a box with no fit: the reviewers' worst must fit at the nominal size; another currency's is a WARN
		check(rev.w <= b.box, `${b.id}: reviewers' worst "${plainT(rev.t)}" (${rev.c}) fits at its nominal ${b.nominal} px (box ${b.box.toFixed(0)}, ${rev.w.toFixed(0)} wide)`);
		if (!fitsNominal) {
			warns++;
			console.log(`WARN ${b.id}: worst of all "${plainT(worst.t)}" (${worst.c}) is ${worst.w.toFixed(0)} wide at ${b.nominal} px, over the box ${b.box.toFixed(0)}`);
		}
		continue;
	}
	const fitsBox = measure(worst.t, px, b.f.weight, 0, b.f.face) <= b.box && measure(rev.t, rpx, b.f.weight, 0, b.f.face) <= b.box;
	check(fitsBox, `${b.id}: both worst strings fit the box once fitted (all ${px} px, reviewers' ${rpx} px)`);
	if (b.floor !== null) {
		check(rpx >= b.floor, `${b.id}: reviewers' worst "${plainT(rev.t)}" (${rev.c}) at ${rpx} px of ${b.nominal} (floor ${b.floor}, box ${b.box.toFixed(0)})`, { need: rpx });
		if (px < b.floor) {
			warns++;
			console.log(`WARN ${b.id}: worst of all "${plainT(worst.t)}" (${worst.c}) needs ${px} px, under the floor ${b.floor}: fitted (data-fit="under"), never clipped`);
		}
	} else console.log(`INFO ${b.id}: worst "${plainT(worst.t)}" (${worst.c}) fitted at ${px} px of ${b.nominal}; reviewers' "${plainT(rev.t)}" (${rev.c}) ${rpx} px (${b.how}, no floor)`);
}
// the reported strings of 2026-11-21 (Decimus on dba8b786) fit their plates now
{
	const F = OV(900);
	const at = (t, nominal, box) => fit.fitAmountPx(t, nominal, box, F, measure);
	const cases = [
		['100.000000\u00a0BTC', 40, 244],
		['100.000000\u00a0BTC', 23, 144],
		['100.000000\u00a0BTC', 23, 141],
		['100.00\u00a0USDT', 40, 244],
		['300.00\u00a0USDT', 23, 144],
		['300.00\u00a0USDT', 23, 141],
	].map(([t, n, b]) => ({ t, n, b, px: at(t, n, b), w: measure(t, at(t, n, b), 900, 0, 'Overpass') }));
	check(cases.every((c) => c.w <= c.b), "the probe host's clipped plates (BTC 100x, USDT 100x and 300x at 1440 x 900, 390 x 844, 844 x 390) fit", cases);
}

// the longest cap totals by characters (for the LED boards' own fit check, tools/led_currency_check.mjs section 7)
if (process.env.LONGEST) {
	const all = Object.keys(cur.CURRENCY_TABLE).map((c) => plainT(KINDS.win(c)[0]));
	console.log(all.sort((x, y) => y.length - x.length).slice(0, 12).join(' | '));
}
if (process.env.TABLE) {
	console.log("\n| element | box | nominal | floor | worst of all 85 | fitted | worst of the reviewers' 9 | fitted | handled |");
	console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
	for (const r of rows) console.log(`| ${r.el} | ${r.box.toFixed(0)} | ${r.nominal} | ${r.floor ?? '-'} | ${plainT(r.worst.t)} (${r.worst.c}) | ${r.px} | ${plainT(r.rev.t)} (${r.rev.c}) | ${r.rpx} | ${r.how} |`);
}
console.log(`amount_fit_test: ${pass} pass, ${fail} fail (${warns} warn: under a floor outside the reviewers' currencies, fitted)`);
process.exit(fail ? 1 : 0);
