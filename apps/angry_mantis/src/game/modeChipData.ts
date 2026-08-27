// Game-mode plaque data + shared price helpers. Lives outside the HTML controls layer because the
// plaque renders in Pixi (components/ModePlaque.svelte — behind the mantises, per Corey 2026-08-26)
// while the HTML buttons still need the same numbers. All state comes from the state-shared singletons.
import { stateBet, stateBetDerived } from 'state-shared';
import { numberToCurrencyString } from 'utils-shared/amount';

// full price of the next press: bet × mode multiplier. The SDK's betCost() applies the multiplier
// only to 'activate' modes (buys are charged server-side), so an armed buy would read as the base
// bet — wrong price on the button and no affordability gate. This covers all modes.
export const betCostFull = () => stateBet.betAmount * (stateBetDerived.activeBetMode()?.costMultiplier ?? 1);

// K/M/B/T abbreviation: button faces have hard width budgets and stake.us GC amounts reach
// trillions — a price must never spill its button. Full precision lives in the bet picker.
export const abbrevCurrency = (amount: number, threshold = 10_000): string => {
	if (amount < threshold) return numberToCurrencyString(amount);
	const symbol = (numberToCurrencyString(amount).match(/^[^\d.,-]*/) ?? [''])[0];
	for (const [div, suffix] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as const) {
		if (amount >= div) {
			const v = amount / div;
			const text = v >= 100 ? `${Math.round(v)}` : `${v.toFixed(1)}`.replace(/\.0$/, '');
			return `${symbol}${text}${suffix}`;
		}
	}
	return numberToCurrencyString(amount);
};

/** mode plaque on the reel frame: active mode + the true cost of one spin press (null in base game) */
export const modeChipData = (): { label: string; cost: string } | null => {
	const mode = stateBetDerived.activeBetMode();
	if (mode?.type === 'activate') return { label: 'ANTE MODE', cost: abbrevCurrency(betCostFull(), 100_000) };
	if (mode?.type === 'buy') {
		const label = mode.text?.betAmountLabel ?? stateBet.activeBetModeKey;
		return { label, cost: abbrevCurrency(betCostFull(), 100_000) };
	}
	return null;
};
