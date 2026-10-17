// THE IDLE BOARD: one rule, shared. The symbol pay popup (components/SymbolPopup.svelte, Corey 2026-10-16 15:32) opens
// only here and closes the moment it stops being true; the plaque's explainer lines (components/BoardPlaque.svelte,
// game/plaqueTips.ts, Corey 2026-10-16 17:41) show only here and hide the moment it stops being true. Moved out of
// SymbolPopup.svelte unchanged so the two can never disagree about what "idle" means.
//
// Idle: no round in flight, no autoplay run, no feature, no modal or menu (the armoury included), no press gate,
// plaque, win screen or max win screen, not loading, not a replay, not a held open round, nothing being skipped, no
// pay readout over the board, the Space bar not held. It reads Svelte state, so a $derived / $effect that calls it
// re-runs when any of these change.
import { stateBet, stateBetDerived, stateModal, stateUi } from 'state-shared';

import { stateXstateDerived } from './stateXstate';
import { stateLayout } from './stateLayout';
import { stateGame as sg } from './stateGame.svelte';
import { maxWinState } from './maxWin.svelte';
import { armouryView } from '../ui/armoury/armouryView.svelte';

export const boardIdle = (): boolean =>
	stateXstateDerived.isIdle() &&
	!sg.resumeHold &&
	stateUi.config.mode !== 'replay' &&
	!stateLayout.showLoadingScreen &&
	stateModal.modal == null &&
	!stateUi.menuOpen &&
	!armouryView.shown &&
	!stateBetDerived.hasAutoBetCounter() &&
	!stateBet.isSpaceHold &&
	sg.gameType !== 'freegame' &&
	sg.pressGates === 0 &&
	!sg.winShowing &&
	sg.plaque === null &&
	!sg.skipping &&
	!sg.busy &&
	sg.readouts.length === 0 &&
	maxWinState.phase === 'idle';
