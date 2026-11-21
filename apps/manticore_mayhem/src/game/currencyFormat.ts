// THE CURRENCY TABLE, as Stake Engine's RGS page writes it (stake-engine.com/docs/rgs "Supported currencies", re-fetched
// 2026-11-21; Corey's "Yes" to building it the same day): each code's symbol, its decimals, and whether the symbol goes
// AFTER the amount (letter-code symbols, kr, zl, the dong sign, GC and SC: "10.00 GC", "10.00 SC", "10.000000 BTC").
// Review items [78] and [219] test USD, EUR, CAD, MXN, JPY, USDT, BTC, and XSC and XGC in social mode.
//
// Manticore-local on purpose: the shared packages/utils-shared/amount.ts is what the live, frozen Angry Mantis ships, so it
// is not edited. game/amount.ts wires this pure table to the session (stateBet.currency, the locale's separators) under the
// shared module's own names, and every amount in this app goes through it.
//
// Pure: no imports, so the node test (tools/currency_format_test.mjs) checks it against the table directly.
// Intl.NumberFormat's 'currency' style is never used: it throws a RangeError on any code that is not exactly three letters
// (USDT, TRUMP) and has never heard of XGC or XSC. Only the plain number goes through the locale.

export type CurrencyMeta = { symbol: string; decimals: number; after?: boolean };

/** Stake's table, row for row, in its order */
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
	DKK: { symbol: 'kr', decimals: 2, after: true },
	PLN: { symbol: 'zł', decimals: 2, after: true },
	VND: { symbol: '₫', decimals: 0, after: true },
	TRY: { symbol: '₺', decimals: 2 },
	CLP: { symbol: 'CLP', decimals: 0, after: true },
	ARS: { symbol: 'ARS', decimals: 2, after: true },
	PEN: { symbol: 'S/', decimals: 2 },
	NGN: { symbol: '₦', decimals: 2 },
	SAR: { symbol: 'SAR', decimals: 2, after: true },
	ILS: { symbol: '₪', decimals: 2 },
	AED: { symbol: 'AED', decimals: 2, after: true },
	TWD: { symbol: 'NT$', decimals: 2 },
	NOK: { symbol: 'kr', decimals: 2, after: true },
	KWD: { symbol: 'KD', decimals: 3 },
	JOD: { symbol: 'JD', decimals: 3 },
	CRC: { symbol: '₡', decimals: 2 },
	TND: { symbol: 'TND', decimals: 3, after: true },
	SGD: { symbol: 'SG$', decimals: 2 },
	MYR: { symbol: 'RM', decimals: 2 },
	OMR: { symbol: 'OMR', decimals: 3, after: true },
	QAR: { symbol: 'QAR', decimals: 2, after: true },
	BHD: { symbol: 'BD', decimals: 3 },
	PKR: { symbol: '₨', decimals: 2 },
	EGP: { symbol: 'EGP', decimals: 2, after: true },
	NZD: { symbol: 'NZ$', decimals: 2 },
	BOB: { symbol: 'Bs', decimals: 2 },
	GHS: { symbol: 'GH₵', decimals: 2 },
	KES: { symbol: 'KSh', decimals: 2 },
	MAD: { symbol: 'MAD', decimals: 2, after: true },
	BAM: { symbol: 'KM', decimals: 2 },
	ISK: { symbol: 'kr', decimals: 0, after: true },
	TZS: { symbol: 'TSh', decimals: 2 },
	UGX: { symbol: 'USh', decimals: 0 },
	XOF: { symbol: 'CFA', decimals: 0, after: true },
	AUD: { symbol: 'A$', decimals: 2 },
	BWP: { symbol: 'P', decimals: 2 },
	GEL: { symbol: '₾', decimals: 2 },
	HNL: { symbol: 'L', decimals: 2 },
	JMD: { symbol: 'J$', decimals: 2 },
	KGS: { symbol: 'KGS', decimals: 2, after: true },
	MZN: { symbol: 'MZN', decimals: 2, after: true },
	PGK: { symbol: 'K', decimals: 2 },
	TMT: { symbol: 'TMT', decimals: 2, after: true },
	TTD: { symbol: 'TT$', decimals: 2 },
	UAH: { symbol: '₴', decimals: 2 },
	XCD: { symbol: 'EC$', decimals: 2 },
	APE: { symbol: 'APE', decimals: 4, after: true },
	BCH: { symbol: 'BCH', decimals: 6, after: true },
	BNB: { symbol: 'BNB', decimals: 6, after: true },
	BTC: { symbol: 'BTC', decimals: 6, after: true },
	BUSD: { symbol: 'BUSD', decimals: 2, after: true },
	CRO: { symbol: 'CRO', decimals: 4, after: true },
	DAI: { symbol: 'DAI', decimals: 2, after: true },
	DOGE: { symbol: 'DOGE', decimals: 4, after: true },
	EOS: { symbol: 'EOS', decimals: 4, after: true },
	ETH: { symbol: 'ETH', decimals: 6, after: true },
	LINK: { symbol: 'LINK', decimals: 4, after: true },
	LTC: { symbol: 'LTC', decimals: 6, after: true },
	POL: { symbol: 'POL', decimals: 4, after: true },
	SAND: { symbol: 'SAND', decimals: 4, after: true },
	SHIB: { symbol: 'SHIB', decimals: 0, after: true },
	SOL: { symbol: 'SOL', decimals: 6, after: true },
	TRUMP: { symbol: 'TRUMP', decimals: 4, after: true },
	TRX: { symbol: 'TRX', decimals: 4, after: true },
	UNI: { symbol: 'UNI', decimals: 4, after: true },
	USDC: { symbol: 'USDC', decimals: 2, after: true },
	USDT: { symbol: 'USDT', decimals: 2, after: true },
	XRP: { symbol: 'XRP', decimals: 4, after: true },
	// Stake's social coins: two decimals, the mark after the amount
	XGC: { symbol: 'GC', decimals: 2, after: true },
	XSC: { symbol: 'SC', decimals: 2, after: true },
	XEC: { symbol: 'SC', decimals: 2, after: true },
	XRC: { symbol: 'SC', decimals: 2, after: true },
	WRW: { symbol: 'SC', decimals: 2, after: true },
};

/** amounts carry six decimal places (RGS integers x 1,000,000): nothing finer is ever shown */
export const MAX_FRACTION_DIGITS = 6;

/** a code outside the table shows itself after the amount with 2 decimals (Stake's own helper does the same) */
export const currencyMetaFor = (currency: string): CurrencyMeta => {
	const code = String(currency ?? '').toUpperCase();
	return CURRENCY_TABLE[code] ?? { symbol: code, decimals: 2, after: true };
};

/** the marks every Pixi glyph atlas of this game carries (the plaque's and the labels' forged atlases from
 *  tools/build_plaque_text.py, the banner's glyph sheets, the stencil numerals): A to Z, the lower case letters the
 *  table's marks use, and the currency signs. GEL's lari sign and UAH's hryvnia sign are in none of them yet. */
export const CANVAS_MARK_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZhkprsz/$€£¥₹₽₱₩₫₺₦₡₨₵₪ł';

/** the mark as a canvas surface draws it: the table's symbol, or, when an atlas cannot draw it (GEL, UAH), the code
 *  after the amount, never an amount with its mark silently dropped */
export const canvasMetaFor = (currency: string): CurrencyMeta => {
	const meta = currencyMetaFor(currency);
	if ([...meta.symbol].every((c) => CANVAS_MARK_CHARS.includes(c))) return meta;
	return { symbol: String(currency ?? '').toUpperCase(), decimals: meta.decimals, after: true };
};

// SUB-UNIT PRECISION (review item [273]): the ladder starts at one minor unit, where a real win is often a fraction of it (a
// 0.25x win on a 0.01 bet is 0.0025). An amount exact to the currency's decimals keeps exactly those digits; only an amount
// that really carries finer precision extends, by one or two digits, never past six. The decision is taken on the value
// rounded to the finest unit shown, so float noise (0.03000000000000000444) never reads as extra precision.
const EXTRA_DIGITS = 2;
export const fractionDigitsFor = (value: number, minor: number): number => {
	const finest = Math.min(MAX_FRACTION_DIGITS, minor + EXTRA_DIGITS);
	if (finest <= minor) return minor;
	const units = Math.round(Math.abs(value) * 10 ** finest);
	if (!Number.isSafeInteger(units)) return minor; // huge magnitudes: nothing finer to show
	for (let d = minor; d < finest; d += 1) if (units % 10 ** (finest - d) === 0) return d;
	return finest;
};

export type NumberFn = (value: number, digits: { minimumFractionDigits: number; maximumFractionDigits: number }) => string;

export type FormatOptions = {
	/** count-ups: decide the digits on the count's TARGET, so every frame shows the final amount's digit count and the
	 *  string length never jumps mid count */
	fractionDigitsOf?: number;
	/** exactly the currency's own decimals, nothing finer (the balance: a wallet reading 10,069.789 is noise) */
	exact?: boolean;
	/** the mark as a Pixi glyph atlas can draw it (canvasMetaFor) */
	canvas?: boolean;
};

/** the amount in `currency`: the number from `number` (the locale's separators), the mark before or after it */
export const formatCurrency = (value: number, currency: string, number: NumberFn, opts: FormatOptions = {}): string => {
	const meta = opts.canvas ? canvasMetaFor(currency) : currencyMetaFor(currency);
	const minor = meta.decimals;
	let digits: { minimumFractionDigits: number; maximumFractionDigits: number };
	if (opts.exact) digits = { minimumFractionDigits: minor, maximumFractionDigits: minor };
	else {
		const pin = opts.fractionDigitsOf;
		const max = fractionDigitsFor(pin ?? value, minor);
		digits = { minimumFractionDigits: pin !== undefined ? max : minor, maximumFractionDigits: max };
	}
	const n = number(Number.parseFloat(`${value}`), digits);
	return meta.after ? `${n} ${meta.symbol}` : `${meta.symbol}${n}`;
};
