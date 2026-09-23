import type config from './config';

export type SymbolName = keyof typeof config.symbols;
export type PayingSymbolName = (typeof config.payOrder)[number];
export type BetMode = keyof typeof config.betModes;
export type GameType = keyof typeof config.paddingReels;

/** which feature a round is in — the book's `bonus` field (bonusStart / bonusEnd) */
export type BonusMode = 'bonus' | 'super' | 'epic';
/** the Mystery buy's resolution (mystery event) */
export type MysteryOutcome = 'nothing' | 'super' | 'epic';

/** a cell of the 8x8 board, addressed the way the book does: `reel * 8 + row`, 0-63 */
export type CellIndex = number;

export type Position = { reel: number; row: number };

export const SYMBOL_STATES = ['static', 'win', 'removing', 'dim'] as const;
export type SymbolState = (typeof SYMBOL_STATES)[number];
