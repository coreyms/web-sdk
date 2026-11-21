import { createPlayBookUtils } from 'utils-book';

import { eventEmitter } from './eventEmitter';
import type { Bet, BookEventOfType } from './typesBookEvent';
import { bookEventHandlerMap } from './bookEventHandlerMap';
import { hudWinRoundStart } from './hudWin.svelte';
import { preloadForEvents, roundEndRelease } from './road/columnClips';
import { presentsForBook } from './road/present';
import { brawlForBook, brawlRoundEnd, brawlRoundEndRelease } from './road/brawlCloud';
import { openingOf, planWheel } from './superWheelPlan';
import { loadWheelArt, releaseWheelArt } from './road/superWheel';
import { SUPER_WHEEL } from './constants';
import { STAGING_TOOLS, perfMark } from './staging';
import { stateBet } from 'state-shared';
import { scoreboardDev } from './scoreboard/scoreboard';
import { stateGame } from './stateGame.svelte';
import { SKIP_END_EVENTS, toSkippedBet } from './resumeRound.svelte';

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

/** the book's events in order (playBookEvents' own way: each handler awaited, the whole book as its context), with SKIP TO
 *  RESULT (2026-11-19, Corey: "This game needs a skip to result option in bonus rounds like manticore has"): once it is
 *  asked (stateGame.skipping, components/SkipButton.svelte), the event in play finishes (the Yes also slams the spin in
 *  play), the round's other events up to its end are not played, and the round's end is played as the resume card's
 *  Skip to Result plays it: the SAME cut (game/resumeRound.svelte.ts toSkippedBet: the final board, every column standing
 *  at the end, the round's total), then the book's own end events not played yet (the top-up, the Total Win card that
 *  waits for its press, the cap, finalWin). The per-spin sounds are dropped while skipping; `skipping` clears before the
 *  wrap-up, so it sounds. Nothing here decides an outcome: every amount is the book's. */
const playEvents = async (bet: Bet) => {
	const events = bet.state;
	for (let i = 0; i < events.length; i++) {
		if (stateGame.skipping) {
			const cut = toSkippedBet(bet).state;
			const skip = cut.find((e) => e.type === 'skipToResult');
			const tail = events.slice(i).filter((e) => SKIP_END_EVENTS.includes(e.type));
			if (skip) await playBookEvent(skip, { bookEvents: events });
			stateGame.skipping = false;
			for (const e of tail) await playBookEvent(e, { bookEvents: events });
			return;
		}
		await playBookEvent(events[i], { bookEvents: events });
	}
	// (asked after the last event began: nothing was left to cut)
	stateGame.skipping = false;
};

/** play one round's book, event by event, in book order */
export const playBet = async (bet: Bet) => {
	// SKIP TO RESULT never outlives its round: whatever set it, a new round's book starts with it off
	stateGame.skipping = false;
	stateGame.skipTaken = false;
	// a fresh WIN (game/hudWin.svelte.ts)
	hudWinRoundStart();
	// the column characters this book calls for start loading now, well before its first strike reaches its target
	preloadForEvents(bet.state);
	// a book with a trigger: the presents' full open starts loading now (game/road/present.ts); one without lets it go
	presentsForBook(bet.state);
	// BRAWL: a book with a Grandma Wild warms its brawl cloud's frames now (game/road/brawlCloud.ts)
	brawlForBook(bet.state);
	// a book with a Super opening: its wheel (a resumed round's state starts with the snapshot: its wheel was planned from
	// the whole round already)
	if (bet.state[0]?.type !== 'createBonusSnapshot') prepareWheel(bet.state);
	await playEvents(bet);
	// THE WHEEL'S SHEET NEVER OUTLIVES ITS ROUND (2026-11-19): a wheel that played let it go as it left; one that never
	// played (its pictures late, the wheel switched off) is let go here (nothing happens when it is not loaded)
	void releaseWheelArt();
	// BRAWL: the round is over; the brawl cloud's frames go once no Grandma Wild stands
	brawlRoundEnd();
	// THE BONUS SHEETS AT THE ROUND'S END (constants GPU_MEMORY.releaseBonusSheets, OFF by default): the column win and
	// entrance sheets and the brawl win sheet go once the board is at rest; never waited for here
	void roundEndRelease();
	void brawlRoundEndRelease();
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
