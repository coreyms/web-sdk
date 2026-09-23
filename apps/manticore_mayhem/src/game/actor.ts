import _ from 'lodash';

import { stateBet, stateUrlDerived } from 'state-shared';
import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { requestBalance } from 'rgs-requests';
import { checkIsMultipleRevealEvents } from 'utils-book';
import { createPrimaryMachines, createIntermediateMachines, createGameActor } from 'utils-xstate';

import type { Bet } from './typesBookEvent';
import { stateXstateDerived } from './stateXstate';
import { playBet, convertTorResumableBet } from './utils';
import { stateGameDerived } from './stateGame.svelte';
import { eventEmitter } from './eventEmitter';

const refreshBalance = async () => {
	if (stateUrlDerived.replay()) return;
	try {
		const data = await requestBalance({ sessionID: stateUrlDerived.sessionID(), rgsUrl: stateUrlDerived.rgsUrl() });
		const amount = data?.balance?.amount;
		if (typeof amount === 'number') stateBet.balanceAmount = amount / API_AMOUNT_MULTIPLIER;
	} catch {
		// the error card is already up for the failed play; a failed balance read changes nothing
	}
};

const primaryMachines = createPrimaryMachines<Bet>({
	onResumeGameActive: (betToResume) => convertTorResumableBet(betToResume),
	onResumeGameInactive: (betToResume) => {
		const lastRevealEvent = _.findLast(
			betToResume.state,
			(emitterEvent) => emitterEvent?.type === 'reveal',
		);

		// snap the board to where the interrupted round left it, with no drop
		if (lastRevealEvent) stateGameDerived.setBoardFromSymbols(lastRevealEvent.board);
	},
	onNewGameStart: async () => {
		// There is no pre-spin here: a cascade board has no reel to empty before the book arrives.
		// The reveal's own drop is the whole "spin" (game/stateGame.svelte.ts revealBoard).
		if ((stateBet.isTurbo && stateXstateDerived.isAutoBetting()) || stateBet.isSpaceHold) return;
		stateBet.winBookEventAmount = 0;
	},
	// a failed play leaves the wallet readout on its pre-error value until the next successful
	// round; re-read it from the RGS so the player sees the truth straight away (review 2026-09-06)
	onNewGameError: () => {
		void refreshBalance();
	},
	onPlayGame: async (bet) => {
		await playBet(bet);
		if (stateUrlDerived.replay()) eventEmitter.broadcast({ type: 'replayFinished' });
	},
	checkIsBonusGame: (bet) => checkIsMultipleRevealEvents({ bookEvents: bet.state }),
});

const intermediateMachines = createIntermediateMachines(primaryMachines);

export const gameActor = createGameActor(intermediateMachines);
