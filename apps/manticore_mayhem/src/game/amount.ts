// THE ONE MONEY FORMATTER of this app: every amount the player sees (the bar, the WIN odometer, the plaque, the banner,
// the Armoury, autoplay, the rules, replay) goes through here. It keeps the names of the shared utils-shared/amount
// module so a call site reads the same, but formats by Stake's 2026-11-21 currency table (game/currencyFormat.ts):
// "10.00 GC", "10.00 SC", "$10.00", "¥10", "10.000000 BTC". The shared module stays as it is: the live, frozen Angry
// Mantis ships it.
//
// Number separators still come from the active locale (stateI18n), which components-shared/LoadI18n pins to 'en' for
// a social session, so social amounts always read en-US whatever ?lang= asks for.
import { stateBet, stateI18n } from 'state-shared';
import { bookEventAmountToNormalisedAmount } from 'utils-shared/amount';

import { currencyMetaFor, formatCurrency, type FormatOptions } from './currencyFormat';

export { bookEventAmountToBetAmountMultiplier, bookEventAmountToNormalisedAmount, numberToFloat } from 'utils-shared/amount';

/** a currency's decimals per Stake's table: USD 2, JPY 0, KWD 3, BTC 6, GC 2 */
export const currencyMinorUnits = (currency: string = stateBet.currency) => currencyMetaFor(currency).decimals;

const localeNumber = (value: number, digits: { minimumFractionDigits: number; maximumFractionDigits: number }) => stateI18n.i18n.number(value, digits);

/** an amount in currency units (1 = one dollar, one coin) in the session's currency */
export const numberToCurrencyString = (value: number, opts?: FormatOptions) => formatCurrency(value, stateBet.currency, localeNumber, opts);

/** a book event amount (100 = 1x the wagered bet) in the session's currency; `fractionDigitsOfBookAmount` pins the
 *  digits to a count's target book amount; `canvas` asks for the mark a Pixi glyph atlas can draw */
export const bookEventAmountToCurrencyString = (bookEventAmount: number, opts?: { fractionDigitsOfBookAmount?: number; canvas?: boolean }) => {
	const pin = opts?.fractionDigitsOfBookAmount;
	return numberToCurrencyString(bookEventAmountToNormalisedAmount(bookEventAmount), {
		fractionDigitsOf: pin === undefined ? undefined : bookEventAmountToNormalisedAmount(pin),
		canvas: opts?.canvas,
	});
};
