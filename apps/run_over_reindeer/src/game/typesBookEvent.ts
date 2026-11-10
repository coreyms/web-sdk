import type { BetType } from 'rgs-requests';

import type { SymbolName, GameType, CellIndex } from './types';

// One-to-one with math-sdk/games/run_over_reindeer/EVENT_SCHEMA.md (the first simulation draft, 2026-11-09).
// Keep them in step: the schema is the contract, this file is only its TypeScript shadow.
//
// The contract's rule: every strike, target cell, multiplier, crossing and column tier is decided in the book.
// The frontend never rolls, never picks a cell, never picks a character and never adds up a multiplier itself.
// It plays the events in their written order.
//
// Conventions from the schema:
//   amounts  integer CENTS OF THE BET (100 = 1.0x bet, 777700 = the 7,777x cap)
//   board    board[reel][row], reel 0-4 left to right, row 0-3 TOP LANE TO BOTTOM LANE, no padding rows
//   cells    one integer, reel * 4 + row (0-19), never a { reel, row } object

type BookEventReveal = {
	index: number;
	type: 'reveal';
	gameType: GameType;
	board: SymbolName[][];
	/** free spins only: this spin (1-based) and the round's length before this spin's retrigger */
	fs?: number;
	totalFs?: number;
	/** free spins only, when any Wild is held: the held Wilds with their CURRENT multipliers */
	sticky?: ({ kind: 'grandma'; cell: CellIndex; multiplier: number } | { kind: 'column'; reel: number; tier: ColumnTier; multiplier: number })[];
};

type BookEventWinInfo = {
	index: number;
	type: 'winInfo';
	totalWin: number;
	wins: {
		symbol: SymbolName;
		/** how many of a kind (3, 4 or 5) */
		kind: number;
		/** the payline, 1-based (config.paylines[line - 1]) */
		line: number;
		win: number;
		/** the SUM of the Wild multipliers on the paid cells, at least 1 (a plain sleigh adds nothing) */
		multiplier: number;
		/** the paid cells, from reel 0 */
		cells: CellIndex[];
	}[];
};

// ---- the feature events. NOT presented in the first pass: bookEventHandlerMap.ts has a handler for each so a real
// book plays to its end, but they draw nothing yet. ----
export type ColumnTier = 'reindeer' | 'santa' | 'grandma';
/** a reindeer strike: `from` the shoulder it darts in from, `path` the cells of that column it passes on the way */
type BookEventStrike = { index: number; type: 'strike'; target: 'grandma' | 'santa'; cell: CellIndex; from: 'top' | 'bottom'; path: CellIndex[] };
/** a held Wild doubled on a Grandma strike's path (bonus rounds only) */
type BookEventCrossing = { index: number; type: 'crossing'; cell: CellIndex; from: number; to: number };
/** the crash cloud Wild from a Grandma strike */
type BookEventGrandmaWild = { index: number; type: 'grandmaWild'; cell: CellIndex; multiplier: number; sticky: boolean };
/** the red box grows to a full column Wild; `tier` is the character that steps out of the cloud */
type BookEventColumnWild = {
	index: number;
	type: 'columnWild';
	reel: number;
	tier: ColumnTier;
	/** the column's own rolled multiplier */
	roll: number;
	/** what the column carries: roll + grandmaAdd, capped at 100 */
	multiplier: number;
	sticky: boolean;
	/** Grandma tier only */
	grandmaCell?: CellIndex | null;
	grandmaAdd?: number;
	absorbed?: { cell: CellIndex; multiplier: number }[];
	/** true only for Super's opening column (right after freeSpinTrigger, no strike before it) */
	start?: boolean;
};
type BookEventFreeSpinTrigger = { index: number; type: 'freeSpinTrigger'; bonusType: 'freespins' | 'super'; cells: CellIndex[]; totalFs: number };
type BookEventFreeSpinRetrigger = { index: number; type: 'freeSpinRetrigger'; cells: CellIndex[]; added: number; totalFs: number };
/** `amount`: the bonus round's own total (the trigger spin's win is not in it) */
type BookEventFreeSpinEnd = { index: number; type: 'freeSpinEnd'; amount: number };
type BookEventWincap = { index: number; type: 'wincap'; amount: number };

// ---- core SDK events ----
type BookEventSetTotalWin = { index: number; type: 'setTotalWin'; amount: number };
type BookEventFinalWin = { index: number; type: 'finalWin'; amount: number };

// frontend-only (resume): replays the state-bearing events of an interrupted round
type BookEventCreateBonusSnapshot = { index: number; type: 'createBonusSnapshot'; bookEvents: BookEvent[] };

export type BookEvent =
	| BookEventReveal
	| BookEventWinInfo
	| BookEventStrike
	| BookEventCrossing
	| BookEventGrandmaWild
	| BookEventColumnWild
	| BookEventFreeSpinTrigger
	| BookEventFreeSpinRetrigger
	| BookEventFreeSpinEnd
	| BookEventWincap
	| BookEventSetTotalWin
	| BookEventFinalWin
	| BookEventCreateBonusSnapshot;

export type Bet = BetType<BookEvent>;
export type BookEventOfType<T> = Extract<BookEvent, { type: T }>;
export type BookEventContext = { bookEvents: BookEvent[] };
