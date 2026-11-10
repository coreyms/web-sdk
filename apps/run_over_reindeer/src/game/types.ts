import type config from './config';

export type SymbolName = keyof typeof config.symbols;
export type PayingSymbolName = (typeof config.payOrder)[number];
export type BetMode = keyof typeof config.betModes;
export type GameType = keyof typeof config.paddingReels;

/** a cell of the 5 x 4 board, addressed the way the book does: `reel * 4 + row`, 0-19, row 0 = the top lane */
export type CellIndex = number;

/** board[reel][row]: reel 0-4 left to right, row 0-3 top lane to bottom lane, no padding rows */
export type Board = SymbolName[][];
