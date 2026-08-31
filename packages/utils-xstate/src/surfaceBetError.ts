import { stateBet, stateModal } from 'state-shared';

/**
 * Mirrors handleRequestBet's failure surface (createPrimaryMachines.ts): stop any
 * auto-spin repeats, show the error modal, and log the cause. Used by the intermediate
 * machines' onError transitions so an exception during book playback finalises the
 * machine (and the root game actor returns to idle) instead of wedging it silently.
 */
export const surfaceBetError = (error: unknown) => {
	console.error(error);
	stateBet.autoSpinsCounter = 0;
	stateModal.modal = { name: 'error', error };
};
