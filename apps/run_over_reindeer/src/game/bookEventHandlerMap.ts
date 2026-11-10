// THE ONE PLACE A ROUND IS PLAYED: one handler per book event type, called in book order (utils-book).
// The frontend never computes an outcome. A handler shows what its event says and nothing else.
//
// FIRST PASS: the reveal (the traffic spin), the line wins and the totals are presented. The feature events
// (strike, crossing, grandmaWild, columnWild, the free spin events, wincap) have handlers so a real book plays
// through to its finalWin, but they draw nothing yet: each is marked NOT PRESENTED below.
import { stateBet, stateBetDerived } from 'state-shared';
import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
import { waitForTimeout } from 'utils-shared/wait';
import type { BookEventHandlerMap } from 'utils-book';

import { eventEmitter } from './eventEmitter';
import { LINE_WIN } from './constants';
import { setHudWin } from './hudWin.svelte';
import { playBookEvent } from './utils';
import { stateGame } from './stateGame.svelte';
import type { Board } from './types';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';

/** DEV: the feature events a book carried that this build does not draw yet (window.__reindeer.notPresented()) */
const notPresented: Record<string, number> = {};
const skip = (type: string) => {
	notPresented[type] = (notPresented[type] ?? 0) + 1;
};
if (import.meta.env.DEV && typeof window !== 'undefined') {
	Object.assign(((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {}), { notPresented: () => ({ ...notPresented }) });
}

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: async (bookEvent: BookEventOfType<'reveal'>) => {
		stateGame.gameType = bookEvent.gameType;
		if (bookEvent.fs !== undefined) stateGame.spinsPlayed = Math.max(0, bookEvent.fs - 1);
		if (bookEvent.totalFs !== undefined) stateGame.totalFs = bookEvent.totalFs;
		const board = bookEvent.board.map((reel) => [...reel]) as Board;
		stateGame.board = board;
		// the traffic spin: resolves when every symbol has settled on its mark
		await eventEmitter.broadcastAsync({ type: 'boardDriveIn', board });
	},

	winInfo: async (bookEvent: BookEventOfType<'winInfo'>) => {
		if (!bookEvent.wins.length) return;
		await waitForTimeout(LINE_WIN.leadInMs);
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_cluster_remove' });
		// the HUD's WIN counts up to the spin's amount while the lines show (the base game's round total is the spin's;
		// the free spins' running total arrives with setTotalWin)
		if (stateGame.gameType === 'basegame') setHudWin(bookEvent.totalWin);
		await eventEmitter.broadcastAsync({
			type: 'boardWinShow',
			wins: bookEvent.wins.map((win) => ({ cells: win.cells, line: win.line })),
			amountText: bookEventAmountToCurrencyString(bookEvent.totalWin),
		});
		eventEmitter.broadcast({ type: 'boardWinClear' });
	},

	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		setHudWin(bookEvent.amount);
	},

	// ---- NOT PRESENTED in the first pass (the reindeer strikes, the Wilds, the bonus rounds) ----
	strike: async () => skip('strike'),
	crossing: async () => skip('crossing'),
	grandmaWild: async () => skip('grandmaWild'),
	columnWild: async () => skip('columnWild'),
	freeSpinTrigger: async (bookEvent: BookEventOfType<'freeSpinTrigger'>) => {
		skip('freeSpinTrigger');
		stateGame.bonusMode = bookEvent.bonusType === 'super' ? 'super' : 'bonus';
		stateGame.totalFs = bookEvent.totalFs;
	},
	freeSpinRetrigger: async (bookEvent: BookEventOfType<'freeSpinRetrigger'>) => {
		skip('freeSpinRetrigger');
		stateGame.totalFs = bookEvent.totalFs;
	},
	freeSpinEnd: async () => {
		skip('freeSpinEnd');
		stateGame.gameType = 'basegame';
		stateGame.bonusMode = null;
		stateGame.totalFs = 0;
		stateGame.spinsPlayed = 0;
	},
	wincap: async () => skip('wincap'),

	finalWin: async (bookEvent: BookEventOfType<'finalWin'>) => {
		// finalWin is the LAST event of every book. A bought feature plays ONE round: back to the base game, so the
		// next feature round is a fresh choice and a fresh confirmation (Stake review rule, as in the other games).
		if (stateBetDerived.activeBetMode()?.type === 'buy') stateBet.activeBetModeKey = 'BASE';
		setHudWin(bookEvent.amount);
		stateGame.busy = false;
	},

	// frontend-only (resume): rebuild the session state an interrupted round had reached, silently
	createBonusSnapshot: async (bookEvent: BookEventOfType<'createBonusSnapshot'>) => {
		const { bookEvents } = bookEvent;
		const last = [...bookEvents].reverse().find((e) => e.type === 'setTotalWin');
		if (last) await playBookEvent(last, { bookEvents });
	},
};
