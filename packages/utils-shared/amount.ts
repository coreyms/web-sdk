import { stateI18n } from 'state-shared';

import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { stateBet } from 'state-shared';

const NO_LOCALISATION_CURRENCY_MAP: Record<string, string> = {
	XGC: 'GC',
	XSC: 'SC',
};

// Stake social Gold Coins are a whole-number coin — they are never fractional, so a padded
// ".00" is noise on every GC amount. Sweeps Cash tracks $1 and keeps its cents.
const WHOLE_UNIT_CURRENCIES = new Set(['XGC']);

// Sub-cent precision. The ladder starts at $0.01, where a real win is routinely a fraction of a
// cent (a 0.25× win on $0.01 is $0.0025) — pinned 2-decimal formatting renders those as "$0.00".
// So: exact-cent amounts keep exactly 2 decimals (round denominations stay clean) and only an
// amount that ACTUALLY carries sub-cent precision extends to 3 or 4, trimmed to its significant
// sub-cent digits. Amounts reach here through /API_AMOUNT_MULTIPLIER and /BOOK_AMOUNT_MULTIPLIER
// divisions, so the decision is taken on the value ROUNDED to the finest displayable unit —
// otherwise float noise (0.03000000000000000444) would read as sub-cent precision on an exact
// cent. Intl still rounds the raw value, and it agrees with the rounded decision by construction.
const SUB_CENT_UNIT = 1e-4; // finest amount the display resolves: 1/100 of a cent
const subCentUnits = (value: number) => Math.round(Math.abs(value) / SUB_CENT_UNIT);
const maximumFractionDigitsFor = (value: number) => {
	const units = subCentUnits(value);
	if (!Number.isSafeInteger(units)) return 2; // GC-scale magnitudes: nothing sub-cent to show
	const subCent = units % 100;
	if (subCent === 0) return 2;
	return subCent % 10 === 0 ? 3 : 4;
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

// A currency's own minor-unit width, per Intl: USD/EUR/BRL 2, JPY 0, KWD 3. XGC/XSC are not ISO
// codes (Intl throws on them) and are treated as 2-decimal like SC's $1 peg. Cached: constructing
// a NumberFormat is not cheap and `maximumFractionDigits` callers hit this on every readout.
const minorUnitCache = new Map<string, number>();
const currencyMinorUnits = (currency: string) => {
	const cached = minorUnitCache.get(currency);
	if (cached !== undefined) return cached;
	let digits = 2;
	try {
		digits =
			new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions()
				.maximumFractionDigits ?? 2;
	} catch {
		digits = 2; // non-ISO marker currency (XGC/XSC)
	}
	minorUnitCache.set(currency, digits);
	return digits;
};

const format = (
	value: number,
	digits: { minimumFractionDigits: number; maximumFractionDigits: number },
) => {
	if (stateBet.currency in NO_LOCALISATION_CURRENCY_MAP) {
		// XGC/XSC are not ISO codes — Intl's 'currency' style throws on them, so the number is
		// formatted on its own (grouping/separators still localised) and the marker prefixed.
		return `${NO_LOCALISATION_CURRENCY_MAP[stateBet.currency]} ${stateI18n.i18n.number(numberToFloat(value), digits)}`;
	}

	return stateI18n.i18n.number(value, {
		...digits,
		style: 'currency',
		currency: stateBet.currency,
		// numberingSystem: 'latn',
	});
};

export const numberToCurrencyString = (
	value: number,
	opts?: { fractionDigitsOf?: number; maximumFractionDigits?: number },
) => {
	// Count-ups format a fresh intermediate value every frame, and deciding precision per frame
	// makes the decimal tail flicker: a tween passing through 30,711,111.1111 renders 4 decimals
	// on a GC win that ends whole, and the string length jumps every frame (live-caught
	// 2026-08-31). `fractionDigitsOf` pins the decision to the count-up TARGET — every frame
	// shows exactly the digits the final amount will show, so sub-cent digits appear only when
	// the actual win carries sub-cent precision, and the length stays constant mid-count.
	const pin = opts?.fractionDigitsOf;
	const basis = pin ?? value;
	// a whole GC amount shows no decimals at all; a fractional one still shows its digits
	const wholeCoin = WHOLE_UNIT_CURRENCIES.has(stateBet.currency) && subCentUnits(basis) % 10_000 === 0;

	// `maximumFractionDigits` opts out of the sub-cent scheme above and pins the readout to the
	// currency's own minor units, capped at the given width. The BALANCE uses it: sub-cent digits
	// are meaningful on a WIN (a 0.25× win on a $0.01 bet really is $0.0025) but a wallet reading
	// "$10,069.789" after play at the $0.01 denomination is just noise (Corey 2026-09-02). Capped
	// at the currency's own width so JPY still shows 0 decimals rather than a forced 2.
	const cap = opts?.maximumFractionDigits;
	if (cap !== undefined) {
		const digits = Math.min(currencyMinorUnits(stateBet.currency), cap);
		return format(value, { minimumFractionDigits: wholeCoin ? 0 : digits, maximumFractionDigits: digits });
	}

	const maximumFractionDigits = pin !== undefined && wholeCoin ? 0 : maximumFractionDigitsFor(basis);
	const minimumFractionDigits = wholeCoin ? 0 : pin !== undefined ? maximumFractionDigits : 2;

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
