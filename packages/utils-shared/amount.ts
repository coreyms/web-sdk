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

export const numberToCurrencyString = (value: number) => {
	const maximumFractionDigits = maximumFractionDigitsFor(value);
	// a whole GC amount shows no decimals at all; a fractional one still shows its digits
	const minimumFractionDigits =
		WHOLE_UNIT_CURRENCIES.has(stateBet.currency) && subCentUnits(value) % 10_000 === 0 ? 0 : 2;

	if (stateBet.currency in NO_LOCALISATION_CURRENCY_MAP) {
		// XGC/XSC are not ISO codes — Intl's 'currency' style throws on them, so the number is
		// formatted on its own (grouping/separators still localised) and the marker prefixed.
		return `${NO_LOCALISATION_CURRENCY_MAP[stateBet.currency]} ${stateI18n.i18n.number(numberToFloat(value), {
			minimumFractionDigits,
			maximumFractionDigits,
		})}`;
	}

	return stateI18n.i18n.number(value, {
		minimumFractionDigits,
		maximumFractionDigits,
		style: 'currency',
		currency: stateBet.currency,
		// numberingSystem: 'latn',
	});
};

export const bookEventAmountToCurrencyString = (bookEventAmount: number) => {
	const normalisedAmount = bookEventAmountToNormalisedAmount(bookEventAmount);
	return numberToCurrencyString(normalisedAmount);
};
