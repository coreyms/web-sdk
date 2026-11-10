// THE HUD WIN (the house rule, from Manticore Mayhem; Corey 2026-10-21): every write of the round's win to the HUD's
// WIN readout (stateBet.winBookEventAmount) goes through here. "On a losing round it should be blank, it should
// clear after a winning round when the spin button is hit": every press clears it, by hand, by the space bar or by
// Autoplay; the book's amounts land as they come.
import { stateBet } from 'state-shared';

/** a spin's press: WIN clears */
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
