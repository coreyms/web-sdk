// THE GAME'S MONEY TEXT (2026-11-21, Corey: "Yes" to building Stake's written currency rule). Every amount the player
// sees goes through this file: the bar (balance, win, the play price, the ante price), the WIN odometer, the LED boards
// (game/scoreboard/ledCurrency.ts turns this text into dots), the cards, the feature menu, autoplay, the rules, the
// replay, the resume card and the symbol popup.
//
// Stake's rule (docs rgs "Supported currencies", re-fetched 2026-11-21; rgs-communication: "Games must show every
// supported currency with the right symbol, decimals and placement"; Engine's review items [78] and [219]): the symbol,
// the decimals and the side come from Stake's table below, copied entry for entry from its CurrencyMeta helper. A symbol
// before the number sits against it ("$10.00", "CA$10.00", "KD10.000"); a symbol after it is spaced ("10.00 GC",
// "10.00 SC", "10.000000 BTC", "10.00 USDT"). A code the table does not list shows after the number, 2 decimals, as
// Stake's own helper falls back. Intl's 'currency' style is never used: it throws a RangeError for any code that is not
// exactly three letters (USDT, TRUMP) and disagrees with the table elsewhere.
//
// This replaces packages/utils-shared/amount.ts for this game only: that file is shared with Angry Mantis (live,
// frozen) and Manticore, and wrote the social coins first with no forced decimals ("GC 1", "GC 1.4") and several
// fiat entries off the table. Its non text helpers are re-exported unchanged.
//
// Two house rules kept from it:
//   - the locale's grouping and decimal marks (stateI18n; components-shared LoadI18n pins a social session to 'en', so
//     social amounts read "1,234.00 GC" whatever ?lang= asks for);
//   - a WIN finer than the currency's own decimals shows the digits it really carries, up to 2 more and never past the
//     6 decimals RGS amounts carry (Stake: "Display payouts below one cent with enough precision", review item [273]):
//     a 0.25x win on a 0.01 bet reads "$0.0025", not "$0.00". A count-up pins the digit count to its final amount.
import { stateBet, stateI18n } from 'state-shared';

export { bookEventAmountToBetAmountMultiplier, bookEventAmountToNormalisedAmount } from 'utils-shared/amount';
import { bookEventAmountToNormalisedAmount } from 'utils-shared/amount';

export type CurrencyMeta = { symbol: string; decimals: number; symbolAfter?: boolean };

/** Stake's supported currency table (docs rgs, CurrencyMeta, 2026-11-21), entry for entry */
export const CURRENCY_TABLE: Record<string, CurrencyMeta> = {
	USD: { symbol: '$', decimals: 2 },
	CAD: { symbol: 'CA$', decimals: 2 },
	JPY: { symbol: '¥', decimals: 0 },
	EUR: { symbol: '€', decimals: 2 },
	RUB: { symbol: '₽', decimals: 2 },
	CNY: { symbol: 'CN¥', decimals: 2 },
	PHP: { symbol: '₱', decimals: 2 },
	INR: { symbol: '₹', decimals: 2 },
	IDR: { symbol: 'Rp', decimals: 0 },
	KRW: { symbol: '₩', decimals: 0 },
	BRL: { symbol: 'R$', decimals: 2 },
	MXN: { symbol: 'MX$', decimals: 2 },
	DKK: { symbol: 'kr', decimals: 2, symbolAfter: true },
	PLN: { symbol: 'zł', decimals: 2, symbolAfter: true },
	VND: { symbol: '₫', decimals: 0, symbolAfter: true },
	TRY: { symbol: '₺', decimals: 2 },
	CLP: { symbol: 'CLP', decimals: 0, symbolAfter: true },
	ARS: { symbol: 'ARS', decimals: 2, symbolAfter: true },
	PEN: { symbol: 'S/', decimals: 2 },
	NGN: { symbol: '₦', decimals: 2 },
	SAR: { symbol: 'SAR', decimals: 2, symbolAfter: true },
	ILS: { symbol: '₪', decimals: 2 },
	AED: { symbol: 'AED', decimals: 2, symbolAfter: true },
	TWD: { symbol: 'NT$', decimals: 2 },
	NOK: { symbol: 'kr', decimals: 2, symbolAfter: true },
	KWD: { symbol: 'KD', decimals: 3 },
	JOD: { symbol: 'JD', decimals: 3 },
	CRC: { symbol: '₡', decimals: 2 },
	TND: { symbol: 'TND', decimals: 3, symbolAfter: true },
	SGD: { symbol: 'SG$', decimals: 2 },
	MYR: { symbol: 'RM', decimals: 2 },
	OMR: { symbol: 'OMR', decimals: 3, symbolAfter: true },
	QAR: { symbol: 'QAR', decimals: 2, symbolAfter: true },
	BHD: { symbol: 'BD', decimals: 3 },
	PKR: { symbol: '₨', decimals: 2 },
	EGP: { symbol: 'EGP', decimals: 2, symbolAfter: true },
	NZD: { symbol: 'NZ$', decimals: 2 },
	BOB: { symbol: 'Bs', decimals: 2 },
	GHS: { symbol: 'GH₵', decimals: 2 },
	KES: { symbol: 'KSh', decimals: 2 },
	MAD: { symbol: 'MAD', decimals: 2, symbolAfter: true },
	BAM: { symbol: 'KM', decimals: 2 },
	ISK: { symbol: 'kr', decimals: 0, symbolAfter: true },
	TZS: { symbol: 'TSh', decimals: 2 },
	UGX: { symbol: 'USh', decimals: 0 },
	XOF: { symbol: 'CFA', decimals: 0, symbolAfter: true },
	AUD: { symbol: 'A$', decimals: 2 },
	BWP: { symbol: 'P', decimals: 2 },
	GEL: { symbol: '₾', decimals: 2 },
	HNL: { symbol: 'L', decimals: 2 },
	JMD: { symbol: 'J$', decimals: 2 },
	KGS: { symbol: 'KGS', decimals: 2, symbolAfter: true },
	MZN: { symbol: 'MZN', decimals: 2, symbolAfter: true },
	PGK: { symbol: 'K', decimals: 2 },
	TMT: { symbol: 'TMT', decimals: 2, symbolAfter: true },
	TTD: { symbol: 'TT$', decimals: 2 },
	UAH: { symbol: '₴', decimals: 2 },
	XCD: { symbol: 'EC$', decimals: 2 },
	APE: { symbol: 'APE', decimals: 4, symbolAfter: true },
	BCH: { symbol: 'BCH', decimals: 6, symbolAfter: true },
	BNB: { symbol: 'BNB', decimals: 6, symbolAfter: true },
	BTC: { symbol: 'BTC', decimals: 6, symbolAfter: true },
	BUSD: { symbol: 'BUSD', decimals: 2, symbolAfter: true },
	CRO: { symbol: 'CRO', decimals: 4, symbolAfter: true },
	DAI: { symbol: 'DAI', decimals: 2, symbolAfter: true },
	DOGE: { symbol: 'DOGE', decimals: 4, symbolAfter: true },
	EOS: { symbol: 'EOS', decimals: 4, symbolAfter: true },
	ETH: { symbol: 'ETH', decimals: 6, symbolAfter: true },
	LINK: { symbol: 'LINK', decimals: 4, symbolAfter: true },
	LTC: { symbol: 'LTC', decimals: 6, symbolAfter: true },
	POL: { symbol: 'POL', decimals: 4, symbolAfter: true },
	SAND: { symbol: 'SAND', decimals: 4, symbolAfter: true },
	SHIB: { symbol: 'SHIB', decimals: 0, symbolAfter: true },
	SOL: { symbol: 'SOL', decimals: 6, symbolAfter: true },
	TRUMP: { symbol: 'TRUMP', decimals: 4, symbolAfter: true },
	TRX: { symbol: 'TRX', decimals: 4, symbolAfter: true },
	UNI: { symbol: 'UNI', decimals: 4, symbolAfter: true },
	USDC: { symbol: 'USDC', decimals: 2, symbolAfter: true },
	USDT: { symbol: 'USDT', decimals: 2, symbolAfter: true },
	XRP: { symbol: 'XRP', decimals: 4, symbolAfter: true },
	XGC: { symbol: 'GC', decimals: 2, symbolAfter: true },
	XSC: { symbol: 'SC', decimals: 2, symbolAfter: true },
	XEC: { symbol: 'SC', decimals: 2, symbolAfter: true },
	XRC: { symbol: 'SC', decimals: 2, symbolAfter: true },
	WRW: { symbol: 'SC', decimals: 2, symbolAfter: true },
};

/** a currency's entry, or Stake's fallback for a code the table does not list: the code after the number, 2 decimals */
export const currencyMeta = (currency: string): CurrencyMeta => CURRENCY_TABLE[currency] ?? { symbol: currency, decimals: 2, symbolAfter: true };

/** a currency's own decimals per Stake's table: USD 2, JPY 0, KWD 3, BTC 6 */
export const currencyMinorUnits = (currency: string = stateBet.currency) => currencyMeta(currency).decimals;

/** RGS amounts carry six decimals: no amount shows more */
const RGS_DECIMALS = 6;
/** a win's finer digits beyond the currency's own (1/100 of a cent for a 2 decimal currency) */
const EXTRA_DIGITS = 2;

/** how many decimals a value needs: the currency's own, or more (up to EXTRA_DIGITS, never past RGS_DECIMALS) when the
 *  value really carries them. Taken on the value rounded to the finest unit shown, so float noise
 *  (0.03000000000000000444) never reads as extra precision on an exact cent. */
export const fractionDigitsFor = (value: number, minor: number) => {
	const top = Math.max(minor, Math.min(RGS_DECIMALS, minor + EXTRA_DIGITS));
	if (top === minor) return minor;
	const units = Math.round(Math.abs(value) * 10 ** top);
	if (!Number.isSafeInteger(units)) return minor; // huge coin balances: nothing finer to show
	for (let d = minor; d < top; d++) if (units % 10 ** (top - d) === 0) return d;
	return top;
};

/** the symbol on its side of an already formatted number: before it with no space, after it with one */
export const placeSymbol = (number: string, currency: string) => {
	const meta = currencyMeta(currency);
	return meta.symbolAfter ? `${number} ${meta.symbol}` : `${meta.symbol}${number}`;
};

const format = (value: number, digits: number) =>
	placeSymbol(stateI18n.i18n.number(Number.parseFloat(`${value}`), { minimumFractionDigits: digits, maximumFractionDigits: digits }), stateBet.currency);

/**
 * An amount in the session's currency, as the player reads it.
 * - free standing: the currency's own decimals, more only when the value carries them (a win under a cent);
 * - `fractionDigitsOf`: a count-up's frames, every frame shows exactly the digits its final amount needs, so the
 *   string keeps its length mid count (a tween through 30,711,111.1111 never flickers a decimal tail);
 * - `fixed`: exactly the currency's own decimals, never more (the BALANCE and the session's net: a wallet reading
 *   "$10,069.789" after play at the 0.01 denomination is noise, Corey 2026-09-02; JPY still 0, BTC still 6).
 */
export const numberToCurrencyString = (value: number, opts?: { fractionDigitsOf?: number; fixed?: boolean }) => {
	const minor = currencyMinorUnits();
	if (opts?.fixed) return format(value, minor);
	return format(value, fractionDigitsFor(opts?.fractionDigitsOf ?? value, minor));
};

/** a book event's amount (100 = 1x the play amount) in the session's currency; `fractionDigitsOfBookAmount` pins a
 *  count-up's digits to its final book amount */
export const bookEventAmountToCurrencyString = (bookEventAmount: number, opts?: { fractionDigitsOfBookAmount?: number }) => {
	const pin = opts?.fractionDigitsOfBookAmount;
	return numberToCurrencyString(
		bookEventAmountToNormalisedAmount(bookEventAmount),
		pin === undefined ? undefined : { fractionDigitsOf: bookEventAmountToNormalisedAmount(pin) },
	);
};
