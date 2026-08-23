import type { BetType } from 'rgs-requests';

import type { SymbolName, RawSymbol, GameType, Position, BonusMode, BonusHost, Striker, PayingSymbolName } from './types';

// ---- core SDK events (see math-sdk/src/events/events.py) ----
type BookEventReveal = {
	index: number;
	type: 'reveal';
	board: RawSymbol[][];
	paddingPositions: number[];
	anticipation: number[];
	gameType: GameType;
};

type BookEventSetTotalWin = { index: number; type: 'setTotalWin'; amount: number };
type BookEventFinalWin = { index: number; type: 'finalWin'; amount: number };
type BookEventWincap = { index: number; type: 'wincap'; amount: number };
type BookEventFreeSpinTrigger = { index: number; type: 'freeSpinTrigger'; totalFs: number; positions: Position[] };
type BookEventUpdateFreeSpin = { index: number; type: 'updateFreeSpin'; amount: number; total: number };
type BookEventSetWin = { index: number; type: 'setWin'; amount: number; winLevel: number };
type BookEventFreeSpinEnd = { index: number; type: 'freeSpinEnd'; amount: number; winLevel: number };

type BookEventWinInfo = {
	index: number;
	type: 'winInfo';
	totalWin: number;
	wins: {
		symbol: SymbolName;
		kind: number;
		win: number;
		positions: Position[];
		meta: { ways: number; globalMult?: number; winWithoutMult?: number };
	}[];
};

// ---- Angry Mantis events (see math-sdk/games/angry_mantis/game_events.py) ----
type BookEventAnteLock = { index: number; type: 'anteLock'; scatterPosition: Position };
type BookEventBonusStart = {
	index: number;
	type: 'bonusStart';
	mode: BonusMode;
	host: BonusHost;
	totalFs: number;
	scatterPositions: Position[];
};
type BookEventStrike = {
	index: number;
	type: 'strike';
	striker: Striker;
	trigger: 'auto' | 'glowingLeaf';
	strikeIndex: number;
	position?: Position;
};
type BookEventEat = {
	index: number;
	type: 'eat';
	striker: Striker;
	symbolEaten: PayingSymbolName | null;
	strikeIndex: number;
	remainingPool: PayingSymbolName[];
};
type BookEventRemoveSymbolFromPool = {
	index: number;
	type: 'removeSymbolFromPool';
	symbol: PayingSymbolName;
	remainingPool: PayingSymbolName[];
};
type BookEventRetriggerSpins = {
	index: number;
	type: 'retriggerSpins';
	added: number;
	newTotalFs: number;
	cappedFrom: number;
	positions: Position[];
};
type BookEventMaxWinCinematic = { index: number; type: 'maxWinCinematic'; payout: number };
type BookEventBonusEnd = {
	index: number;
	type: 'bonusEnd';
	mode: BonusMode;
	totalSessionWin: number;
	spinsPlayed: number;
	symbolsEaten: number;
	eatenList: PayingSymbolName[];
};

// frontend-only (resume)
type BookEventCreateBonusSnapshot = { index: number; type: 'createBonusSnapshot'; bookEvents: BookEvent[] };

export type BookEvent =
	| BookEventReveal
	| BookEventWinInfo
	| BookEventSetTotalWin
	| BookEventFinalWin
	| BookEventWincap
	| BookEventFreeSpinTrigger
	| BookEventUpdateFreeSpin
	| BookEventSetWin
	| BookEventFreeSpinEnd
	| BookEventAnteLock
	| BookEventBonusStart
	| BookEventStrike
	| BookEventEat
	| BookEventRemoveSymbolFromPool
	| BookEventRetriggerSpins
	| BookEventMaxWinCinematic
	| BookEventBonusEnd
	| BookEventCreateBonusSnapshot;

export type Bet = BetType<BookEvent>;
export type BookEventOfType<T> = Extract<BookEvent, { type: T }>;
export type BookEventContext = { bookEvents: BookEvent[] };
