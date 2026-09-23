// Game-mode plaque data + shared price helpers. Lives outside the HTML controls layer because the
// plaque renders in Pixi (components/ModePlaque.svelte — behind the mantises, per Corey 2026-08-26)
// while the HTML buttons still need the same numbers. All state comes from the state-shared singletons.
import { stateBet, stateBetDerived } from 'state-shared';
import { numberToCurrencyString } from 'utils-shared/amount';

import { soc } from './social';

// full price of the next press: bet × mode multiplier. The SDK's betCost() applies the multiplier
// only to 'activate' modes (buys are charged server-side), so an armed buy would read as the base
// bet — wrong price on the button and no affordability gate. This covers all modes.
export const betCostFull = () => stateBet.betAmount * (stateBetDerived.activeBetMode()?.costMultiplier ?? 1);

/**
 * Mode plaque on the reel frame: active mode + the true cost of one press (null in base game).
 * The price is the FULL currency string — Stake's review (2026-09-20) bars K/M abbreviation on
 * every bet-level readout, so the plaque shrinks its type to fit instead (ModePlaque.svelte).
 * `unit` is what follows the price. A buy is a ONE-OFF price for the whole feature round, so it
 * reads TOTAL: "$100.00 / SPIN" on a 100x feature read as a 100x charge per free spin (Stake
 * review 2026-09-20). Ante is genuinely a per-spin price and keeps the per-spin wording.
 */
export const modeChipData = (): { label: string; cost: string; unit: string } | null => {
	const mode = stateBetDerived.activeBetMode();
	if (mode?.type === 'activate')
		return { label: soc('ANTE BET', 'ANTE MODE'), cost: numberToCurrencyString(betCostFull()), unit: soc('/ SPIN', '/ PLAY') };
	if (mode?.type === 'buy') {
		const label = mode.text?.betAmountLabel ?? stateBet.activeBetModeKey;
		return { label, cost: numberToCurrencyString(betCostFull()), unit: 'TOTAL' };
	}
	return null;
};
