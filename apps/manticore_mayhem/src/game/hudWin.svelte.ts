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

/** THE WIN ODOMETER's cue (2026-11-21, ui/hud/winOdometer.ts): the TOTAL WIN banner's amount (book units) while its screen
 *  is up, null otherwise. components/WarBanner.svelte writes it (its wrap up sets it, its hide and its end clear it);
 *  ui/controls.svelte.ts winOdoText reads it, so the bar's WIN rolls only under the war banner's TOTAL WIN. A capped round
 *  (the MAX WIN wrap up on the plaque, components/FreeSpinOutro.svelte) never asks the banner, so it never sets this. */
export const hudWinOdometer = $state<{ amount: number | null }>({ amount: null });
