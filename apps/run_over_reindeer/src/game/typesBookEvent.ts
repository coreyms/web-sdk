import type { BetType } from 'rgs-requests';

import type { SymbolName, GameType, CellIndex } from './types';

// One-to-one with math-sdk/games/run_over_reindeer/EVENT_SCHEMA.md, "Contract version 2026-11-10a" (variant F + C).
// Keep them in step: the schema is the contract, this file is only its TypeScript shadow.
//
// The contract's rule: every strike, target cell, multiplier, column tier and top-up is decided in the book. The
// frontend never rolls, never picks a cell or a character, and never adds a multiplier itself. It plays the events in
// the written order and never sorts them. HOW the reindeer gets to its target (the run in the snow above the board
// and the turn down into the target's reel) is presentation, decided by the game alone (constants STRIKE).
//
// Conventions from the schema:
//   amounts  integer CENTS OF THE BET (100 = 1.0x bet, 777700 = the 7,777x cap)
//   board    board[reel][row], reel 0-4 left to right, row 0-3 TOP LANE TO BOTTOM LANE, no padding rows
//   cells    one integer, reel * 4 + row (0-19)
//
// A spin, in order: reveal; all Grandma strikes (strike, grandmaWild), then all Santa strikes (strike, columnWild),
// each kind left to right by reel and top to bottom within a reel (Corey 2026-11-10: "grandma first, santa last... if
// multiple strikes are happening on the same spin, from left to right columns"; the book writes them so); winInfo and
// setTotalWin if it pays; freeSpinTrigger (base) or freeSpinRetrigger (free). There is no crossing (Corey 2026-11-10:
// "I don't think the column wilds should ever multiply from their original set value"): a held column keeps the
// multiplier its columnWild gave it for the whole round.
// After the last free spin: floorTopUp (natural rounds under their floor), freeSpinEnd, wincap (if reached), finalWin.

export type ColumnTier = 'reindeer' | 'santa' | 'grandma';
/** a sticky column held at the start of a free spin */
export type HeldColumn = { reel: number; tier: ColumnTier; multiplier: number };

type BookEventReveal = {
	index: number;
	type: 'reveal';
	gameType: GameType;
	/** after the book's placements and before this spin's strikes; a held column shows as four CW */
	board: SymbolName[][];
	/** free spins only: this spin (1-based) and the round's length before this spin's retrigger */
	fs?: number;
	totalFs?: number;
	/** free spins only: EVERY sticky column held at the start of this spin, with the multiplier it landed with (they
	 *  never change). A replay or a resume draws the held columns from this list alone. */
	held?: HeldColumn[];
};

type BookEventWinInfo = {
	index: number;
	type: 'winInfo';
	totalWin: number;
	wins: {
		/** the paying symbol (W for a line of Wilds only, which pays as Grandma's car) */
		symbol: SymbolName;
		/** how many of a kind (3, 4 or 5) */
		kind: number;
		/** the payline, 1-based (config.paylines[line - 1]) */
		line: number;
		/** line pay x multiplier */
		win: number;
		/** the SUM of the multipliers of the Wilds among the paid cells, at least 1 (a plain sleigh adds nothing) */
		multiplier: number;
		/** the paid cells, from reel 0 */
		cells: CellIndex[];
	}[];
};

/** a reindeer strike: the target cell and its reel, nothing about the path (the game runs it in the snow above the
 *  board and turns it down into `reel`) */
type BookEventStrike = {
	index: number;
	type: 'strike';
	target: 'grandmaCar' | 'santaSleigh';
	/** the target cell: the reveal holds H1 or W there */
	cell: CellIndex;
	/** cell // 4, given by the book for convenience */
	reel: number;
};
/** the crash cloud Wild: this spin only, in every mode */
type BookEventGrandmaWild = { index: number; type: 'grandmaWild'; cell: CellIndex; multiplier: number };
/** the red box grows to a full column Wild; `tier` is the character that steps out of the cloud */
type BookEventColumnWild = {
	index: number;
	type: 'columnWild';
	reel: number;
	tier: ColumnTier;
	multiplier: number;
	/** true in Free Spins and Super (held to the end of the round), false in the base game (that spin only) */
	sticky: boolean;
	/** Grandma tier only: the Grandma in the column, never struck on her own (Corey 2026-11-10: "It doesn't need to
	 *  strike the grandma, we could draw a red box around the grandma when it happens though, that gets covered by the
	 *  santa strike column wild"). `wasWild` true = she was already a Grandma Wild, and `add` is her multiplier,
	 *  already in `multiplier`; false (always, under variant F) = a car, which adds nothing. */
	grandma?: { cell: CellIndex; wasWild: boolean; add: number };
	/** true only for Super's opening column: right after freeSpinTrigger, no strike before it */
	start?: boolean;
};
type BookEventFreeSpinTrigger = { index: number; type: 'freeSpinTrigger'; bonusType: 'freespins' | 'super'; cells: CellIndex[]; totalFs: number };
type BookEventFreeSpinRetrigger = { index: number; type: 'freeSpinRetrigger'; cells: CellIndex[]; added: number; totalFs: number };
/** natural rounds only, when the free spins' own total is under the floor: `amount` is what is added */
type BookEventFloorTopUp = { index: number; type: 'floorTopUp'; floor: number; featureWin: number; amount: number };
/** `amount`: the bonus round's own total, including any top-up (the trigger spin is not in it) */
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
	| BookEventGrandmaWild
	| BookEventColumnWild
	| BookEventFreeSpinTrigger
	| BookEventFreeSpinRetrigger
	| BookEventFloorTopUp
	| BookEventFreeSpinEnd
	| BookEventWincap
	| BookEventSetTotalWin
	| BookEventFinalWin
	| BookEventCreateBonusSnapshot;

export type Bet = BetType<BookEvent>;
export type BookEventOfType<T> = Extract<BookEvent, { type: T }>;
export type BookEventContext = { bookEvents: BookEvent[] };
