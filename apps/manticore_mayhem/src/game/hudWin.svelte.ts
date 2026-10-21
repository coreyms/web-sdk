// THE HUD WIN (1.0.04; harsh review 2026-10-20 must-fix 3; constants AUTOPLAY_WIN_SEEN). Every write of the round's win to
// the HUD's WIN (stateBet.winBookEventAmount) goes through here. Corey's rule (2026-10-21): "On a losing round it should be
// blank, it should clear after a winning round when the spin button is hit": every press clears it, by hand, by the space
// bar or by Autoplay; the book's amounts land as they come. Autoplay's pacing (the win seen before the next press) is in
// game/bookEventHandlerMap.ts's cascade handler.
import { stateBet } from 'state-shared';

/** a spin's press: WIN clears (Corey's rule, every press) */
export const hudWinPress = () => {
	stateBet.winBookEventAmount = 0;
};

/** the book arrived (playBet): WIN starts blank */
export const hudWinRoundStart = () => {
	stateBet.winBookEventAmount = 0;
};

/** the round's win as the book has it */
export const setHudWin = (amount: number) => {
	stateBet.winBookEventAmount = amount;
};
