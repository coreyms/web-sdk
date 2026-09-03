import { stateI18n } from 'state-shared';

import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { stateBet } from 'state-shared';

// Stake Engine's supported-currency table (docs: rgs-communication "Supported Currencies", and the
// CurrencyMeta reference Corey pasted 2026-09-02): the display symbol, its minor units, and whether
// it trails the number. Intl's own 'currency' style is NOT used any more — it disagrees with this
// table (it renders "US$" under a zh locale, "1,00 $" under de, and throws on XGC/XSC), and the
// social coins need a marker Intl has never heard of. Number grouping/decimal separators still
// come from the active locale via stateI18n — which components-shared/LoadI18n pins to 'en' for a
// social (stake.us) session, so social amounts always read en-US no matter what ?lang= asks for.
type Meta = { symbol: string; decimals: number; after?: boolean };
const META: Record<string, Meta> = {
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
	DKK: { symbol: 'KR', decimals: 2, after: true },
	PLN: { symbol: 'zł', decimals: 2, after: true },
	VND: { symbol: '₫', decimals: 0, after: true },
	TRY: { symbol: '₺', decimals: 2 },
	CLP: { symbol: 'CLP', decimals: 0, after: true },
	ARS: { symbol: 'ARS', decimals: 2, after: true },
	PEN: { symbol: 'S/', decimals: 2, after: true },
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
	EGP: { symbol: 'ج.م', decimals: 2 },
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
	// Stake social coins. Gold Coins are a whole-number coin (a padded ".00" is noise on every GC
	// amount); Sweeps Cash tracks $1 and keeps its cents. Marker first with a space — the stencil
	// numeral atlas carries GC/SC glyphs for the Pixi count-ups in exactly that form.
	XGC: { symbol: 'GC', decimals: 0 },
	XSC: { symbol: 'SC', decimals: 2 },
	XEC: { symbol: 'SC', decimals: 2 },
};
const SPACED_PREFIX = new Set(['XGC', 'XSC', 'XEC']);
// an operator currency outside the table shows its code after the number, as Stake's own helper does
const metaFor = (currency: string): Meta => META[currency] ?? { symbol: currency, decimals: 2, after: true };

/** A currency's minor-unit width per Stake's table: USD 2, JPY 0, KWD 3. */
export const currencyMinorUnits = (currency: string = stateBet.currency) => metaFor(currency).decimals;

// Sub-unit precision. The ladder starts at 1 minor unit, where a real win is routinely a fraction
// of it (a 0.25× win on $0.01 is $0.0025) — pinned formatting renders those as "$0.00". So: an
// amount exact to the currency's minor units keeps exactly those digits (round denominations stay
// clean) and only an amount that ACTUALLY carries finer precision extends by one or two digits.
// Amounts reach here through /API_AMOUNT_MULTIPLIER and /BOOK_AMOUNT_MULTIPLIER divisions, so the
// decision is taken on the value ROUNDED to the finest displayable unit — otherwise float noise
// (0.03000000000000000444) would read as extra precision on an exact cent. Intl still rounds the
// raw value, and it agrees with the rounded decision by construction.
const EXTRA_DIGITS = 2; // beyond the currency's minor units: 1/100 of a cent for a 2-decimal currency
const fineUnits = (value: number, minor: number) => Math.round(Math.abs(value) * 10 ** (minor + EXTRA_DIGITS));
const maximumFractionDigitsFor = (value: number, minor: number) => {
	const units = fineUnits(value, minor);
	if (!Number.isSafeInteger(units)) return minor; // GC-scale magnitudes: nothing finer to show
	const fine = units % 100;
	if (fine === 0) return minor;
	return fine % 10 === 0 ? minor + 1 : minor + 2;
};

// bookEventAmount: is the amount or win numbers in the events of books, e.g. the amount in setTotalWin bookEvent
// {
// 	"index": 3,
// 	"type": "setTotalWin",
// 	"amount": 100
// },
// if betting on $1,   100 bookEventAmount equals to $1.    betAmountMultiplier is (100 / BOOK_AMOUNT_MULTIPLIER =) 1
// if betting on $1,    50 bookEventAmount equals to $0.5.  betAmountMultiplier is ( 50 / BOOK_AMOUNT_MULTIPLIER =) 0.5
// if betting on $0.5, 100 bookEventAmount equals to $0.5.  betAmountMultiplier is (100 / BOOK_AMOUNT_MULTIPLIER =) 1
// if betting on $0.5,  50 bookEventAmount equals to $0.25. betAmountMultiplier is ( 50 / BOOK_AMOUNT_MULTIPLIER =) 0.5

export const bookEventAmountToBetAmountMultiplier = (bookEventAmount: number) =>
	bookEventAmount / BOOK_AMOUNT_MULTIPLIER;

export const bookEventAmountToNormalisedAmount = (bookEventAmount: number) => {
	const betAmountMultiplier = bookEventAmountToBetAmountMultiplier(bookEventAmount);
	return stateBet.wageredBetAmount * betAmountMultiplier;
};

export const numberToFloat = (value: number) => Number.parseFloat(`${value}`);

const format = (
	value: number,
	digits: { minimumFractionDigits: number; maximumFractionDigits: number },
) => {
	const currency = stateBet.currency;
	const meta = metaFor(currency);
	const number = stateI18n.i18n.number(numberToFloat(value), digits);
	// a right-to-left symbol (EGP's ج.م) pulls the digits into its own run and renders AFTER the
	// number in a left-to-right page; a left-to-right mark after it pins "ج.م10.00" the way the
	// Stake table shows it
	const symbol = /[\u0590-\u08FF]/.test(meta.symbol) ? `${meta.symbol}\u200E` : meta.symbol;
	if (meta.after) return `${number} ${symbol}`;
	return SPACED_PREFIX.has(currency) ? `${symbol} ${number}` : `${symbol}${number}`;
};

export const numberToCurrencyString = (
	value: number,
	opts?: { fractionDigitsOf?: number; maximumFractionDigits?: number },
) => {
	const minor = currencyMinorUnits();
	// Count-ups format a fresh intermediate value every frame, and deciding precision per frame
	// makes the decimal tail flicker: a tween passing through 30,711,111.1111 renders 4 decimals
	// on a GC win that ends whole, and the string length jumps every frame (live-caught
	// 2026-08-31). `fractionDigitsOf` pins the decision to the count-up TARGET — every frame
	// shows exactly the digits the final amount will show, so finer digits appear only when
	// the actual win carries them, and the length stays constant mid-count.
	const pin = opts?.fractionDigitsOf;
	const basis = pin ?? value;

	// `maximumFractionDigits` opts out of the finer-precision scheme above and pins the readout to
	// the currency's own minor units, capped at the given width. The BALANCE uses it: extra digits
	// are meaningful on a WIN (a 0.25× win on a $0.01 bet really is $0.0025) but a wallet reading
	// "$10,069.789" after play at the $0.01 denomination is just noise (Corey 2026-09-02). Capped
	// at the currency's own width so JPY still shows 0 decimals rather than a forced 2.
	const cap = opts?.maximumFractionDigits;
	if (cap !== undefined) {
		const digits = Math.min(minor, cap);
		return format(value, { minimumFractionDigits: digits, maximumFractionDigits: digits });
	}

	const maximumFractionDigits = maximumFractionDigitsFor(basis, minor);
	// pinned (count-up): every frame shows the target's digit count; free-standing: the currency's
	// own width, extended only by digits the value really carries
	const minimumFractionDigits = pin !== undefined ? maximumFractionDigits : minor;

	return format(value, { minimumFractionDigits, maximumFractionDigits });
};

export const bookEventAmountToCurrencyString = (
	bookEventAmount: number,
	opts?: { fractionDigitsOfBookAmount?: number },
) => {
	const normalisedAmount = bookEventAmountToNormalisedAmount(bookEventAmount);
	const pin = opts?.fractionDigitsOfBookAmount;
	return numberToCurrencyString(
		normalisedAmount,
		pin === undefined ? undefined : { fractionDigitsOf: bookEventAmountToNormalisedAmount(pin) },
	);
};
