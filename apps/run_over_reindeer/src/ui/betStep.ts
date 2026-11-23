// Bet stepping shared by the HUD's inline −/+ buttons (StepButton) and the modal BetAdjuster.
// Never step onto an option state-shared's correctBetAmount would clamp: it caps any pick at
// balance ÷ costMultiplier ('activate' modes only, mirroring its betCostMultiplier), so an
// unaffordable option becomes an off-menu amount the next spin posts and the RGS rejects into a
// reload-only error. DenomModal greys the same options out.
import { stateBet, stateBetDerived, stateConfig } from 'state-shared';
import { numberToCurrencyString } from '../game/currency';

import { fontPxForCap, measureUiText } from './uiMeasure';

export const affordableBet = (v: number) => {
	const mode = stateBetDerived.activeBetMode();
	const mult = mode?.type === 'activate' ? (mode.costMultiplier ?? 1) : 1;
	return v <= stateBet.balanceAmount / mult;
};

/** the next bet option in `dir`, or undefined at the end of the menu / past what the balance affords */
export const betStepTarget = (dir: 1 | -1) => {
	const options = [...stateConfig.betAmountOptions].sort((a, b) => (a - b) * dir);
	return options.find((o) => (dir > 0 ? o > stateBet.betAmount : o < stateBet.betAmount) && affordableBet(o));
};

// The SPIN readout's slot: wide enough for the WIDEST price the current mode can show, measured
// in the chrome's number face at the readout's digit height (Corey 2026-09-06). Sized from the bet
// menu (finite, known from authenticate) × the active mode's multiplier, so the −/+ buttons hold
// still across bet steps and only re-seat when a mode is armed. Before the font is ready the
// width is estimated from length. `cap` keeps a trillion-scale GC menu from pushing the stepper
// into the neighbouring readout: TrioStat's fit shrinks the amount instead.
export const betSlotWidth = (height: number, cap: number) => {
	const mult = stateBetDerived.activeBetMode()?.costMultiplier ?? 1;
	let widest = 0;
	for (const o of stateConfig.betAmountOptions) {
		const text = numberToCurrencyString(o * mult);
		widest = Math.max(widest, measureUiText(text, fontPxForCap(height)) ?? text.length * height * 0.62);
	}
	return Math.min(cap, Math.ceil(widest));
};

// THE SIGN BAR'S WIDEST AMOUNT (ui/sign/, 2026-11-22): betSlotWidth's rule in the sign bar's own face. The widest price
// the current mode can show over the whole bet menu, in em of the amount's face (`em` measures one string); the caller
// reserves that width at its type size and seats the two bet symbols either side of it (ui/sign/signLayout.ts
// seatAmount), so they hold still across bet steps and only re-seat when a mode is armed.
// (2026-11-24, Corey: "I should have said per game mode ... The arrows should stay where they are at": the sign bar seats
// its symbols for the BASE game's widest price, `mult` 1, and sizes the number for the mode in play, `mult` left out:
// ui/sign/signLayout.ts amountType.)
export const betWidestEm = (em: (text: string) => number, mult: number = stateBetDerived.activeBetMode()?.costMultiplier ?? 1) => {
	let widest = 0;
	let text = '';
	for (const o of stateConfig.betAmountOptions) {
		const t = numberToCurrencyString(o * mult);
		const w = em(t);
		if (w > widest) {
			widest = w;
			text = t;
		}
	}
	return { em: widest, text };
};
