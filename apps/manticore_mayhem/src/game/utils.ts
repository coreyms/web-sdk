import { stateBet } from 'state-shared';
import { createPlayBookUtils } from 'utils-book';

import { SYMBOL_SIZE, SYMBOL_INFO_MAP } from './constants';
import { eventEmitter } from './eventEmitter';
import type { Bet, BookEventOfType } from './typesBookEvent';
import { bookEventHandlerMap } from './bookEventHandlerMap';
import type { SymbolName } from './types';
import { STAGING_TOOLS, perfMark } from './staging';

// STAGING READOUT ONLY (game/staging.ts perfMark): each book event leaves its type as a label, so a long frame
// can be traced to the step of the round it fell in. A production build uses the map as it is.
const markedHandlerMap = (): typeof bookEventHandlerMap => {
	const out: Record<string, unknown> = {};
	for (const [type, handler] of Object.entries(bookEventHandlerMap as Record<string, (...args: unknown[]) => unknown>)) {
		out[type] = (...args: unknown[]) => {
			perfMark(`book:${type}`);
			return handler(...args);
		};
	}
	return out as typeof bookEventHandlerMap;
};

export const { playBookEvent, playBookEvents } = createPlayBookUtils({ bookEventHandlerMap: STAGING_TOOLS ? markedHandlerMap() : bookEventHandlerMap });

export const playBet = async (bet: Bet) => {
	stateBet.winBookEventAmount = 0;
	await playBookEvents(bet.state);
	eventEmitter.broadcast({ type: 'stopButtonEnable' });
};

// resume bet — the events that carry SESSION state, replayed silently to rebuild it
const BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT = ['bonusStart', 'setTotalWin'];

export const convertTorResumableBet = (betToResume: Bet) => {
	const resumingIndex = Number(betToResume.event);
	const bookEventsBeforeResume = betToResume.state.filter((_e, i) => i < resumingIndex);
	const bookEventsAfterResume = betToResume.state.filter((_e, i) => i >= resumingIndex);

	const bookEventToCreateSnapshot: BookEventOfType<'createBonusSnapshot'> = {
		index: 0,
		type: 'createBonusSnapshot',
		bookEvents: bookEventsBeforeResume.filter((bookEvent) =>
			BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT.includes(bookEvent.type),
		),
	};

	return { ...betToResume, state: [bookEventToCreateSnapshot, ...bookEventsAfterResume] };
};

/** board-space centre of a cell (the board is drawn in SYMBOL_SIZE units, see layoutSpec) */
export const getSymbolX = (reel: number) => SYMBOL_SIZE * (reel + 0.5);
export const getSymbolY = (row: number) => SYMBOL_SIZE * (row + 0.5);

export const getSymbolInfo = ({ name }: { name: SymbolName }) => SYMBOL_INFO_MAP[name];
