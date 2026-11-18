// THE LED BOARDS' AMOUNTS (2026-11-17, led_currency_2026-11-17): one rule for the big board and the strip. The amount is
// the HUD's own text for it (utils-shared/amount numberToCurrencyString: the symbol, its side, the space, the decimals, the
// locale's grouping and decimal marks, GC and SC on stake.us), turned into what the LED faces draw:
//   - the number exactly as the HUD writes it; a grouping space of any width becomes the faces' one fixed space (U+00A0),
//     Arabic and Persian digits and marks (a locale that asks for them) the faces' 0 to 9 and . ,
//   - the symbol on the HUD's side, with the HUD's space or none, drawn as LED glyphs (game/scoreboard/ledSigns.ts), when
//     the play currency is one of LED_CURRENCIES and every character of its symbol has a glyph on both faces; a right to
//     left symbol (Egypt's ج.م) is set in its order on the page; ₨ is written Rs (its own compatibility spelling)
//   - otherwise (a currency the RGS adds later, a symbol with no glyph) the number alone, as the HUD formats it for that
//     currency (its default 2 decimals), no box, no error; one console line in a dev build, once per currency
// Count-ups keep their width: the HUD's text pins the decimals to the final amount (fractionDigitsOf), the faces set every
// digit in one tabular cell, and the symbol keeps its place (before the number: the row's left; after it: the right).
import { amountFaceHas, sentenceFaceHas } from './ledSigns';

/** the currencies the LED boards write with their symbol (Stake's table in utils-shared/amount, 2026-11-17), and the symbol
 *  the HUD writes for each (the check script compares this with the HUD's own text for every one) */
export const LED_CURRENCIES: Record<string, string> = {
	USD: '$', CAD: 'CA$', JPY: '¥', EUR: '€', RUB: '₽', CNY: 'CN¥', PHP: '₱', INR: '₹', IDR: 'Rp', KRW: '₩', BRL: 'R$',
	MXN: 'MX$', DKK: 'KR', PLN: 'zł', VND: '₫', TRY: '₺', CLP: 'CLP', ARS: 'ARS', PEN: 'S/', NGN: '₦', SAR: 'SAR', ILS: 'ILS',
	AED: 'AED', TWD: 'NT$', NOK: 'kr', KWD: 'KD', JOD: 'JD', CRC: '₡', TND: 'TND', SGD: 'SG$', MYR: 'RM', OMR: 'OMR', QAR: 'QAR',
	BHD: 'BD', PKR: '₨', EGP: 'ج.م', NZD: 'NZ$', BOB: 'Bs', GHS: 'GH₵', KES: 'KSh', MAD: 'MAD', BAM: 'KM', ISK: 'kr', TZS: 'TSh',
	UGX: 'USh', XOF: 'CFA', XGC: 'GC', XSC: 'SC', XEC: 'SC',
};

// the digits of other numbering systems (Arabic-Indic, Persian) and their marks, as the faces' own
const DIGIT = /[٠-٩۰-۹]/g;
const digitOf = (c: string) => String((c.codePointAt(0)! - (c >= '۰' ? 0x6f0 : 0x660)) % 10);
const D = '0-9\\u0660-\\u0669\\u06f0-\\u06f9';
// the number: from its first digit to its last, through the marks a locale groups and splits it with
const NUMBER = new RegExp(`[${D}](?:[${D}.,\\u00a0\\u202f\\u2009\\u066b\\u066c'\\u2019 ]*[${D}])?`);
const BIDI = /[‎‏؜‪-‮⁦-⁩]/g;
const RTL = /[֐-ࣿ]/;

const warned = new Set<string>();
const devNote = (code: string, why: string) => {
	if (warned.has(code)) return;
	warned.add(code);
	if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) console.info(`[led] ${code}: ${why}; the LED boards show the number without a symbol`);
};

/** what a face can draw of a symbol (the amount face and the sentence face both, so both boards agree) */
const drawable = (sym: string) => [...sym].every((ch) => amountFaceHas(ch) && sentenceFaceHas(ch));

export type LedAmount = { text: string; number: string; symbol: string | null; before: boolean; spaced: boolean };

/** THE RULE: the HUD's text for an amount in `currency`, as the LED faces write it (see the top of this file) */
export function ledAmountParts(hud: string, currency: string): LedAmount {
	const clean = hud.replace(BIDI, '');
	const m = NUMBER.exec(clean);
	if (!m) return { text: clean.trim(), number: clean.trim(), symbol: null, before: true, spaced: false };
	const number = m[0]
		.replace(DIGIT, digitOf)
		.replace(/٫/g, '.')
		.replace(/٬/g, ',')
		.replace(/[   ]/g, ' ')
		.replace(/’/g, "'");
	const pre = clean.slice(0, m.index);
	const post = clean.slice(m.index + m[0].length);
	const before = pre.trim().length > 0;
	const raw = (before ? pre : post).trim();
	const spaced = before ? /\s$/.test(pre) : /^\s/.test(post);
	let symbol: string | null = raw.length ? raw.replace(/₨/g, 'Rs') : null;
	if (symbol !== null) {
		if (!(currency in LED_CURRENCIES)) {
			devNote(currency, 'not one of the LED currencies');
			symbol = null;
		} else if (!drawable(symbol)) {
			devNote(currency, `no LED glyph for a character of "${symbol}"`);
			symbol = null;
		} else if (RTL.test(symbol)) symbol = [...symbol].reverse().join('');
	}
	const sp = spaced ? ' ' : '';
	const text = symbol === null ? number : before ? `${symbol}${sp}${number}` : `${number}${sp}${symbol}`;
	return { text, number, symbol, before, spaced };
}
/** the LED text of the HUD's text for an amount */
export const ledAmountText = (hud: string, currency: string): string => ledAmountParts(hud, currency).text;

/** a sentence's amount on the strip (the wrap-up's top-up line): the same rule */
export const ledSentenceAmount = ledAmountText;
