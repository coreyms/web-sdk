import { type SpinningReelSymbolState } from 'utils-slots';
import type config from './config';

export type SymbolName = keyof typeof config.symbols;
export type PayingSymbolName = (typeof config.eatOrder)[number];
export type RawSymbol = {
	name: SymbolName;
	scatter?: boolean;
	wild?: boolean;
	strike?: boolean;
};
export type BetMode = keyof typeof config.betModes;
export type GameType = keyof typeof config.paddingReels;
export type BonusMode = 'free' | 'super' | 'feast';
export type BonusHost = 'marty' | 'marky' | 'both';
export type Striker = 'marty' | 'marky';

export const SYMBOL_STATES = ['static', 'spin', 'land', 'win', 'postWinStatic', 'eaten'] as const;

export type SymbolState = SpinningReelSymbolState | (typeof SYMBOL_STATES)[number];

export type Position = {
	reel: number;
	row: number;
};
