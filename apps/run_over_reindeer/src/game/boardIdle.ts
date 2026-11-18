// THE IDLE BOARD: the one rule for when the symbol pay popup (components/SymbolPopup.svelte) may open; it closes the
// moment this stops being true. Manticore Mayhem's rule (apps/manticore_mayhem/src/game/boardIdle.ts; Corey 2026-11-17:
// "We can use the same 'when' rules as Manticore"), each condition mapped onto this game's own state:
//
//   Manticore                                  here
//   the actor idle (no round in flight)        the same (stateXstateDerived.isIdle)
//   no held open round (resumeHold)            the same (stateGame.resumeHold)
//   not a replay                               the same
//   not loading                                the same (stateLayout.showLoadingScreen: the LED press screen included)
//   no modal (the armoury is its own view)     no modal (the Fast Lane feature menu IS a modal here: buyBonus)
//   the menu closed                            the same (stateUi.menuOpen)
//   no autoplay run                            the same (stateBetDerived.hasAutoBetCounter)
//   the Space bar not held                     the same
//   not in free spins                          the same (gameType freegame)
//   no press gate                              the same (the bonus round's entry and wrap-up cards, ui/RoundCard.svelte)
//   no win screen                              the LED scoreboard counting or holding a win (stateGame.winShowing)
//   no plaque, nothing skipped, not busy       the same (none in this game yet; kept so they hold when they come)
//   no pay readout over the board              none in this game
//   the max win screen idle                    none in this game (a max win ends on the wrap-up card's press gate)
//
// Reindeer's additions (not reactive, so they are asked at the tap only, game/symbolPopup.ts boardView): the road at
// rest (every car parked on its mark) and the LED back board down (its entry or Total Win scene not up or still lowering).
// It reads Svelte state, so a $derived / $effect that calls it re-runs when any of the above change.
import { stateBet, stateBetDerived, stateModal, stateUi } from 'state-shared';

import { stateXstateDerived } from './stateXstate';
import { stateLayout } from './stateLayout';
import { stateGame as sg } from './stateGame.svelte';
import { boot } from './boot.svelte';

/** when PRESS ANYWHERE was pressed (performance.now; -Infinity before it): the popup's first tap window
 *  (symbolPopupSpec FIRST_TAP, components/SymbolPopup.svelte) */
export const landing = { pressedAt: -Infinity };

export const boardIdle = (): boolean =>
	stateXstateDerived.isIdle() &&
	!sg.resumeHold &&
	stateUi.config.mode !== 'replay' &&
	!stateLayout.showLoadingScreen &&
	!boot.ledSign &&
	stateModal.modal == null &&
	!stateUi.menuOpen &&
	!stateBetDerived.hasAutoBetCounter() &&
	!stateBet.isSpaceHold &&
	sg.gameType !== 'freegame' &&
	sg.pressGates === 0 &&
	sg.roundCard === null &&
	!sg.winShowing &&
	sg.plaque === null &&
	!sg.skipping &&
	!sg.busy;
