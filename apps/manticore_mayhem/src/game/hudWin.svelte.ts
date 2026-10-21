// THE HUD WIN UNDER AUTOPLAY (1.0.04, constant HUD_WIN_CARRY; harsh review 2026-10-20 must-fix 3). Every write of the
// round's win to the HUD's WIN (stateBet.winBookEventAmount) goes through here. The amounts are the book's; this only
// decides when the last round's win is replaced.
import { stateBet } from 'state-shared';

import { HUD_WIN_CARRY } from './constants';

/** carry: the WIN still shows the last round's win (an autoplay or held space bar press kept it); fresh: counts the
 *  writes that replaced a carried win (ui/controls.svelte.ts restarts the WIN's count from zero on each) */
export const hudWin = $state({ carry: false, fresh: 0 });

/** a press: by hand the WIN clears; under Autoplay or a held space bar (HUD_WIN_CARRY) a win on it stays */
export const hudWinPress = (auto: boolean, spaceHold: boolean) => {
	if ((auto && HUD_WIN_CARRY.autoplay) || (spaceHold && HUD_WIN_CARRY.spaceHold)) {
		hudWin.carry = stateBet.winBookEventAmount > 0;
		return;
	}
	hudWin.carry = false;
	stateBet.winBookEventAmount = 0;
};

/** the book arrived (playBet): a fresh WIN unless the last win is carried */
export const hudWinRoundStart = () => {
	if (!hudWin.carry) stateBet.winBookEventAmount = 0;
};

/** the round's win as the book has it: a carried win stays until this round has a win of its own */
export const setHudWin = (amount: number) => {
	if (hudWin.carry) {
		if (amount <= 0) return;
		hudWin.carry = false;
		hudWin.fresh += 1;
	}
	stateBet.winBookEventAmount = amount;
};
