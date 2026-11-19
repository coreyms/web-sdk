import { createPlayBookUtils } from 'utils-book';

import { eventEmitter } from './eventEmitter';
import type { Bet, BookEventOfType } from './typesBookEvent';
import { bookEventHandlerMap } from './bookEventHandlerMap';
import { hudWinRoundStart } from './hudWin.svelte';
import { preloadForEvents } from './road/columnClips';
import { presentsForBook } from './road/present';
import { openingOf, planWheel } from './superWheelPlan';
import { loadWheelArt } from './road/superWheel';
import { SUPER_WHEEL } from './constants';
import { STAGING_TOOLS, perfMark } from './staging';
import { stateBet } from 'state-shared';
import { scoreboardDev } from './scoreboard/scoreboard';

/** resolves once the LED board has no win count running (at most maxMs real time) */
export const ledCountDone = async (maxMs = 2500) => {
	const t0 = performance.now();
	while ((scoreboardDev.board?.countLeft() ?? 0) > 0 && performance.now() - t0 < maxMs) await new Promise((r) => setTimeout(r, 30));
};

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

/** THE SUPER WHEEL'S PLAN AND PICTURES for a round's WHOLE events (index 0 on; a resumed round's are read before the
 *  resume cut, game/actor.ts): the plan is the book's own (game/superWheelPlan.ts), the sheet starts loading now */
export const prepareWheel = (events: Bet['state']) => {
	if (!SUPER_WHEEL.on || !openingOf(events)) return;
	planWheel(events);
	void loadWheelArt();
};

/** play one round's book, event by event, in book order */
export const playBet = async (bet: Bet) => {
	// a fresh WIN (game/hudWin.svelte.ts)
	hudWinRoundStart();
	// the column characters this book calls for start loading now, well before its first strike reaches its target
	preloadForEvents(bet.state);
	// a book with a trigger: the presents' full open starts loading now (game/road/present.ts); one without lets it go
	presentsForBook(bet.state);
	// a book with a Super opening: its wheel (a resumed round's state starts with the snapshot: its wheel was planned from
	// the whole round already)
	if (bet.state[0]?.type !== 'createBonusSnapshot') prepareWheel(bet.state);
	await playBookEvents(bet.state);
	// THE LED COUNT LANDS BEFORE THE ROUND SETTLES (2026-11-18, the probe host: the end-round went with the strip's small
	// count at $9.72 of $10.00): the round's presentation is over once the board's count is too. Not in autoplay, where the
	// next spin's press cuts the small message anyway and waiting would slow every winning round (by up to its count's
	// rest, about 0.26 s at turbo 2)
	if (!(stateBet.autoSpinsCounter > 0)) await ledCountDone();
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
