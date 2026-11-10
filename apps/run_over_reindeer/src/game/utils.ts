import { createPlayBookUtils } from 'utils-book';

import { eventEmitter } from './eventEmitter';
import type { Bet, BookEventOfType } from './typesBookEvent';
import { bookEventHandlerMap } from './bookEventHandlerMap';
import { hudWinRoundStart } from './hudWin.svelte';

export const { playBookEvent, playBookEvents } = createPlayBookUtils({ bookEventHandlerMap });

/** play one round's book, event by event, in book order */
export const playBet = async (bet: Bet) => {
	// a fresh WIN (game/hudWin.svelte.ts)
	hudWinRoundStart();
	await playBookEvents(bet.state);
	eventEmitter.broadcast({ type: 'stopButtonEnable' });
};

// resume bet: the events that carry SESSION state, replayed silently to rebuild it
const BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT = ['freeSpinTrigger', 'setTotalWin'];

export const convertTorResumableBet = (betToResume: Bet) => {
	const resumingIndex = Number(betToResume.event);
	const bookEventsBeforeResume = betToResume.state.filter((_e, i) => i < resumingIndex);
	const bookEventsAfterResume = betToResume.state.filter((_e, i) => i >= resumingIndex);

	const bookEventToCreateSnapshot: BookEventOfType<'createBonusSnapshot'> = {
		index: 0,
		type: 'createBonusSnapshot',
		bookEvents: bookEventsBeforeResume.filter((bookEvent) => BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT.includes(bookEvent.type)),
	};

	return { ...betToResume, state: [bookEventToCreateSnapshot, ...bookEventsAfterResume] };
};
