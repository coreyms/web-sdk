// THE ONE PLACE A ROUND IS PLAYED: one handler per book event type, called in book order (utils-book).
// The frontend never computes an outcome. A handler shows what its event says and nothing else: which cell was
// struck, which tier stepped out, which multiplier, what a line paid, what a top-up added.
// Contract: math-sdk/games/run_over_reindeer/EVENT_SCHEMA.md, version 2026-11-10a.
import { stateBet, stateBetDerived } from 'state-shared';
import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
import { waitForTimeout } from 'utils-shared/wait';
import type { BookEventHandlerMap } from 'utils-book';

import { eventEmitter } from './eventEmitter';
import { LINE_WIN, ROUND } from './constants';
import { setHudWin } from './hudWin.svelte';
import { playBookEvent } from './utils';
import { boardRate, stateGame, type RoundCard } from './stateGame.svelte';
import { loadClip } from './road/columnClips';
import type { Board } from './types';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';

const ROWS = 4;

/** a pause on the road's own pace: shorter at turbo, shorter still under a slam stop */
const pace = (ms: number) => waitForTimeout(Math.max(1, ms / boardRate()));

/** put one of the bonus round's cards up and wait for it to be dismissed (ui/RoundCard.svelte resolves it) */
let cardDone: (() => void) | null = null;
const showCard = async (card: RoundCard) => {
	eventEmitter.broadcast({ type: 'uiHide' });
	stateGame.roundCard = card;
	await new Promise<void>((resolve) => (cardDone = resolve));
	stateGame.roundCard = null;
	eventEmitter.broadcast({ type: 'uiShow' });
};
/** ui/RoundCard.svelte: the card was pressed, or its time ran out */
export const dismissRoundCard = () => {
	const done = cardDone;
	cardDone = null;
	done?.();
};

/** the feature trigger's own state, with nothing shown (a live trigger, and a resumed round's rebuild) */
const enterBonus = (bookEvent: BookEventOfType<'freeSpinTrigger'>) => {
	stateGame.bonusMode = bookEvent.bonusType === 'super' ? 'super' : 'bonus';
	stateGame.gameType = 'freegame';
	stateGame.totalFs = bookEvent.totalFs;
	stateGame.spinsPlayed = 0;
	stateGame.topUp = null;
	stateGame.capped = false;
	eventEmitter.broadcast({ type: 'soundMusic', name: stateGame.bonusMode === 'super' ? 'bgm_super' : 'bgm_bonus' });
};

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: async (bookEvent: BookEventOfType<'reveal'>) => {
		stateGame.gameType = bookEvent.gameType;
		if (bookEvent.fs !== undefined) stateGame.spinsPlayed = Math.max(0, bookEvent.fs - 1);
		if (bookEvent.totalFs !== undefined) stateGame.totalFs = bookEvent.totalFs;
		const board = bookEvent.board.map((reel) => [...reel]) as Board;
		stateGame.board = board;
		if (bookEvent.gameType === 'freegame') await pace(ROUND.betweenSpinsMs);
		// the sticky columns this spin starts with, exactly as the book lists them; every cloud cell and every column
		// that is not held leaves here (a replay or a resume builds its columns from this list alone)
		eventEmitter.broadcast({ type: 'boardHeld', held: bookEvent.held ?? [] });
		// the traffic spin: resolves when every symbol has settled on its mark
		await eventEmitter.broadcastAsync({ type: 'boardDriveIn', board });
	},

	// ---- the reindeer strike ----
	// Played in the book's order, never sorted here: the book writes the Grandma strikes first, then the Santa strikes,
	// each left to right. Nothing on the board depends on that order (the columns draw reel 1 on top whatever order
	// they arrive in), so a book in any order would still show correctly.
	strike: async (bookEvent: BookEventOfType<'strike'>, { bookEvents }: BookEventContext) => {
		// a Santa strike's column comes next: its entrance pictures may have been let go since the last one of its tier
		const next = bookEvents[bookEvents.indexOf(bookEvent) + 1];
		const column = next?.type === 'columnWild' && next.reel === bookEvent.reel ? next : null;
		if (column) void loadClip(column.tier, 'reveal');
		// a Grandma car in the struck Santa reel is not struck: she gets a red box as the reindeer comes down, and the
		// column then grows over it (Corey 2026-11-10). A Grandma already Wild has her own box already.
		const markCell = column?.grandma && !column.grandma.wasWild ? column.grandma.cell : null;
		await eventEmitter.broadcastAsync({ type: 'boardStrike', strike: { cell: bookEvent.cell, markCell } });
	},
	grandmaWild: async (bookEvent: BookEventOfType<'grandmaWild'>) => {
		await eventEmitter.broadcastAsync({ type: 'boardGrandmaWild', cell: bookEvent.cell, multiplier: bookEvent.multiplier });
	},
	columnWild: async (bookEvent: BookEventOfType<'columnWild'>, { bookEvents }: BookEventContext) => {
		// the cell the box grows from is the strike's target (the event before); Super's opening column has none
		const before = bookEvents[bookEvents.indexOf(bookEvent) - 1];
		const fromCell = !bookEvent.start && before?.type === 'strike' && Math.floor(before.cell / ROWS) === bookEvent.reel ? before.cell : null;
		await eventEmitter.broadcastAsync({
			type: 'boardColumnWild',
			reel: bookEvent.reel,
			tier: bookEvent.tier,
			multiplier: bookEvent.multiplier,
			sticky: bookEvent.sticky,
			fromCell,
			// a Grandma Wild already standing in the reel adds her multiplier: the number shows the column's own first,
			// then the sum (`multiplier` already holds it). Never happens under variant F.
			joinAdd: bookEvent.grandma?.wasWild ? bookEvent.grandma.add : 0,
		});
	},

	winInfo: async (bookEvent: BookEventOfType<'winInfo'>) => {
		if (!bookEvent.wins.length) return;
		await waitForTimeout(LINE_WIN.leadInMs);
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_cluster_remove' });
		// the HUD's WIN counts up to the spin's amount while the lines show (the base game's round total is the spin's;
		// a free spin's running total arrives with setTotalWin)
		if (stateGame.gameType === 'basegame') setHudWin(bookEvent.totalWin);
		// the multiplier shown over the amount is the book's own, the highest among the winning lines
		const multiplier = bookEvent.wins.reduce((most, win) => Math.max(most, win.multiplier), 1);
		await eventEmitter.broadcastAsync({
			type: 'boardWinShow',
			wins: bookEvent.wins.map((win) => ({ cells: win.cells, line: win.line })),
			amountText: bookEventAmountToCurrencyString(bookEvent.totalWin),
			multiplier,
		});
		eventEmitter.broadcast({ type: 'boardWinClear' });
	},

	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		setHudWin(bookEvent.amount);
	},

	// ---- the bonus rounds ----
	freeSpinTrigger: async (bookEvent: BookEventOfType<'freeSpinTrigger'>) => {
		eventEmitter.broadcast({ type: 'soundOnce', name: bookEvent.bonusType === 'super' ? 'sfx_bonus_trigger_super' : 'sfx_bonus_trigger_free' });
		await eventEmitter.broadcastAsync({ type: 'boardPulse', cells: bookEvent.cells, ms: ROUND.triggerPulseMs });
		enterBonus(bookEvent);
		await showCard({ kind: 'intro', bonus: stateGame.bonusMode ?? 'bonus', spins: bookEvent.totalFs });
	},
	freeSpinRetrigger: async (bookEvent: BookEventOfType<'freeSpinRetrigger'>) => {
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_bonus_trigger_free' });
		await eventEmitter.broadcastAsync({ type: 'boardPulse', cells: bookEvent.cells, ms: ROUND.triggerPulseMs * 0.6 });
		stateGame.totalFs = bookEvent.totalFs;
		await eventEmitter.broadcastAsync({ type: 'boardMessage', text: `+${bookEvent.added} FREE SPINS`, ms: ROUND.retriggerMs });
	},
	floorTopUp: async (bookEvent: BookEventOfType<'floorTopUp'>) => {
		// said plainly on the wrap-up card as part of the final win; the HUD's WIN takes it with the setTotalWin after
		stateGame.topUp = { floor: bookEvent.floor, featureWin: bookEvent.featureWin, amount: bookEvent.amount };
	},
	wincap: async () => {
		stateGame.capped = true;
	},
	freeSpinEnd: async (bookEvent: BookEventOfType<'freeSpinEnd'>, { bookEvents }: BookEventContext) => {
		// the book writes wincap AFTER freeSpinEnd: the card needs to know now
		const capped = stateGame.capped || bookEvents.slice(bookEvents.indexOf(bookEvent) + 1).some((e) => e.type === 'wincap');
		await pace(350);
		await showCard({
			kind: 'outro',
			bonus: stateGame.bonusMode ?? 'bonus',
			amount: bookEvent.amount,
			topUp: stateGame.topUp ? { floor: stateGame.topUp.floor, amount: stateGame.topUp.amount } : null,
			capped,
		});
		stateGame.gameType = 'basegame';
		stateGame.bonusMode = null;
		stateGame.totalFs = 0;
		stateGame.spinsPlayed = 0;
		stateGame.topUp = null;
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_base' });
	},

	finalWin: async (bookEvent: BookEventOfType<'finalWin'>) => {
		// finalWin is the LAST event of every book. A bought feature plays ONE round: back to the base game, so the
		// next feature round is a fresh choice and a fresh confirmation (Stake review rule, as in the other games).
		if (stateBetDerived.activeBetMode()?.type === 'buy') stateBet.activeBetModeKey = 'BASE';
		setHudWin(bookEvent.amount);
		stateGame.capped = false;
		stateGame.busy = false;
	},

	// frontend-only (resume): rebuild the session state an interrupted round had reached, with nothing shown. The
	// sticky columns are NOT rebuilt here: the next reveal's `held` list draws them.
	createBonusSnapshot: async (bookEvent: BookEventOfType<'createBonusSnapshot'>) => {
		const { bookEvents } = bookEvent;
		const trigger = bookEvents.find((e) => e.type === 'freeSpinTrigger');
		if (trigger && trigger.type === 'freeSpinTrigger') enterBonus(trigger);
		const last = [...bookEvents].reverse().find((e) => e.type === 'setTotalWin');
		if (last) await playBookEvent(last, { bookEvents });
	},
};
