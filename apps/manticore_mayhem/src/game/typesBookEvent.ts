import type { BetType } from 'rgs-requests';

import type { SymbolName, GameType, BonusMode, MysteryOutcome, CellIndex } from './types';

// One-to-one with math-sdk/games/manticore_mayhem/EVENT_SCHEMA.md. Keep them in sync: the schema
// is the contract, this file is only its TypeScript shadow.
//
// Conventions from the schema:
//   amounts  integer CENTS OF THE BET (100 = 1.0x bet, 1_000_000 = the 10,000x cap)
//   board    board[reel][row], reel 0-7 left to right, row 0-7 TOP TO BOTTOM, no padding rows
//   cells    a single integer `reel * 8 + row` (0-63)
//   tiles    [[cellIndex, value], ...] — a cell with no tile is simply absent
//   fill     fill[reel] = the new symbols entering that column, TOP-DOWN; [] for untouched columns

/** [cellIndex, multiplierValue] */
export type TileEntry = [CellIndex, number];
/** fill[reel] — new symbols entering that column, top-down */
export type Fill = SymbolName[][];

type BookEventReveal = {
	index: number;
	type: 'reveal';
	board: SymbolName[][];
	gameType: GameType;
	/** free game only: 1-based spin index and the session length */
	fs?: number;
	totalFs?: number;
	/** present only when the multiplier grid is non-empty (a persistent feature after its first pay) */
	tiles?: TileEntry[];
	/** per-reel scatter tease, omitted when every entry is zero */
	anticipation?: number[];
};

/** one cascade step: what paid, what leaves, what the tiles became, what drops in */
type BookEventCascade = {
	index: number;
	type: 'cascade';
	wins: {
		/** symbol */ s: SymbolName;
		/** cluster size */ n: number;
		/** cells */ c: CellIndex[];
		/** base pay for the band, before the tiles */ p: number;
		/** SUM of the tiles under the cluster; 0 = no tile, i.e. pay x1 */ m: number;
		/** the cluster's total win */ w: number;
	}[];
	removed: CellIndex[];
	/** the new value of every cell that stepped up the ladder — a SUBSET of `removed`.
	 *  The client applies what it is sent and NEVER re-derives this. */
	tiles: TileEntry[];
	fill: Fill;
	/** running total for this spin, after this step */
	spinWin: number;
};

/** the paw clears the middle band (rows 3-5), doubling the tiles there, then the board refills */
type BookEventSwipe = {
	index: number;
	type: 'swipe';
	rows: number[];
	/** cleared cells — scatters survive the paw and are not listed */
	removed: CellIndex[];
	tiles: TileEntry[];
	fill: Fill;
};

/** the tail injects wilds. The old symbol is replaced in place: there is no refill. */
type BookEventSting = {
	index: number;
	type: 'sting';
	cells: CellIndex[];
	/** false = Sting (3-5 wilds), true = Super Sting (6-10, Super/Epic only) */
	super: boolean;
};

/** every low leaves the board and it refills; multiplier tiles under them are untouched */
type BookEventRoar = {
	index: number;
	type: 'roar';
	removed: CellIndex[];
	fill: Fill;
};

type BookEventBonusStart = {
	index: number;
	type: 'bonusStart';
	bonus: BonusMode;
	/** 8 / 10 / 12 — there are no retriggers */
	totalFs: number;
	/** the ladder this session runs on: 64 (Bonus) or 128 (Super, Epic) */
	tileCap: number;
	/** triggering scatter cells; [] for a Mystery award (there is no scatter board) */
	scatters: CellIndex[];
};

type BookEventBonusEnd = {
	index: number;
	type: 'bonusEnd';
	bonus: BonusMode;
	totalSessionWin: number;
	spinsPlayed: number;
};

/** the 250x Mystery buy, first event of the book. Never a regular bonus. */
type BookEventMystery = { index: number; type: 'mystery'; outcome: MysteryOutcome };

// ---- core SDK events kept as-is ----
type BookEventSetTotalWin = { index: number; type: 'setTotalWin'; amount: number };
type BookEventWincap = { index: number; type: 'wincap'; amount: number };
type BookEventFreeSpinEnd = { index: number; type: 'freeSpinEnd'; amount: number; winLevel: number };
type BookEventFinalWin = { index: number; type: 'finalWin'; amount: number };

// frontend-only (resume): replays the state-bearing events of an interrupted round
type BookEventCreateBonusSnapshot = { index: number; type: 'createBonusSnapshot'; bookEvents: BookEvent[] };

export type BookEvent =
	| BookEventReveal
	| BookEventCascade
	| BookEventSwipe
	| BookEventSting
	| BookEventRoar
	| BookEventBonusStart
	| BookEventBonusEnd
	| BookEventMystery
	| BookEventSetTotalWin
	| BookEventWincap
	| BookEventFreeSpinEnd
	| BookEventFinalWin
	| BookEventCreateBonusSnapshot;

export type Bet = BetType<BookEvent>;
export type BookEventOfType<T> = Extract<BookEvent, { type: T }>;
export type BookEventContext = { bookEvents: BookEvent[] };
