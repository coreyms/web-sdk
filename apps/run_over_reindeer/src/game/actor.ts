import _ from 'lodash';

import { stateBet, stateUrlDerived } from 'state-shared';
import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { requestBalance } from 'rgs-requests';
import { checkIsMultipleRevealEvents } from 'utils-book';
import { createPrimaryMachines, createIntermediateMachines, createGameActor } from 'utils-xstate';

import type { Bet } from './typesBookEvent';
import { playBet, convertTorResumableBet, prepareWheel } from './utils';
import { stateGame } from './stateGame.svelte';
import { eventEmitter } from './eventEmitter';
import { hudWinPress } from './hudWin.svelte';
import { autoSpinPause, roundStarting } from './bonusStockRules';
import { resumeRound, toSkippedBet } from './resumeRound.svelte';
import type { Board } from './types';

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
	onResumeGameActive: (betToResume) => {
		// a round left open is being played on: the board is busy until its finalWin, as for a round just started
		stateGame.busy = true;
		// THE SUPER WHEEL's plan is made from the round's whole events, before the cut below drops the ones already played:
		// a round resumed before its opening column shows the same wheel it showed (or would have shown) live
		prepareWheel(betToResume.state);
		// THE RESUME CARD (game/resumeRound.svelte.ts): Skip to Result plays the round's end at once; Play Round (and no card
		// asked, a replay) plays it on from the event the RGS has reached, as before
		return resumeRound.choice === 'skip' ? toSkippedBet(betToResume) : convertTorResumableBet(betToResume);
	},
	onResumeGameInactive: (betToResume) => {
		// snap the board to where the last round left it, with no motion
		const lastReveal = _.findLast(betToResume.state, (bookEvent) => bookEvent?.type === 'reveal');
		if (lastReveal && lastReveal.type === 'reveal') {
			stateGame.board = lastReveal.board.map((reel) => [...reel]) as Board;
			eventEmitter.broadcast({ type: 'boardSnap', board: stateGame.board });
		}
	},
	onNewGameStart: async () => {
		roundStarting();
		// THE PRESS: the play request goes out and the old board drives away at once, before the book is in (pictures
		// only: the board is still the last book's until the reveal replaces it, and a failed play puts it back)
		stateGame.busy = true;
		eventEmitter.broadcast({ type: 'boardDriveOut' });
		// THE HUD WIN: every spin's press clears it
		hudWinPress();
	},
	// a failed play: the old board comes back as it was, and the wallet readout is read again from the RGS
	onNewGameError: () => {
		stateGame.busy = false;
		eventEmitter.broadcast({ type: 'boardSnap', board: stateGame.board });
		void refreshBalance();
	},
	onPlayGame: async (bet) => {
		await playBet(bet);
		if (stateUrlDerived.replay()) eventEmitter.broadcast({ type: 'replayFinished' });
	},
	checkIsBonusGame: (bet) => checkIsMultipleRevealEvents({ bookEvents: bet.state }),
	// THE STOCK RULES' PAUSE (game/bonusStockRules.ts rule 4): between two autoplay rounds, after a bonus round's wrap-up
	onAutoSpinPause: autoSpinPause,
	// A BASE WIN SETTLES AFTER IT IS SHOWN (2026-11-18, Corey: "Yes base spins should carry it as well"): a base spin with a
	// win keeps its round open at the RGS until its lines, its count and the HUD's WIN are done, then sends the end-round
	// once (as a feature round does), so a reload during the win finds it open and the resume card asks
	// (DEV only: ?settleEarly=1 keeps the old timing, the end-round at the play reply, to measure the cadence against)
	settleWinsAfterPresentation: !(import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('settleEarly')),
});

const intermediateMachines = createIntermediateMachines(primaryMachines);

export const gameActor = createGameActor(intermediateMachines);
