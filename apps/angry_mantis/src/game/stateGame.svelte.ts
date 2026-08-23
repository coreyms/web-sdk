import _ from 'lodash';

import { stateBet } from 'state-shared';
import { createEnhanceBoard, createReelForCascading } from 'utils-slots';
import { createGetWinLevelDataByWinLevelAlias } from 'utils-shared/winLevel';

import type { GameType, RawSymbol, BonusMode, BonusHost, PayingSymbolName } from './types';
import { stateLayoutDerived } from './stateLayout';
import { boardPlacement, layoutKind } from './layoutSpec';
import { winLevelMap } from './winLevelMap';
import { eventEmitter } from './eventEmitter';
import config from './config';
import {
	SYMBOL_SIZE,
	BOARD_SIZES,
	INITIAL_BOARD,
	BOARD_DIMENSIONS,
	SPIN_OPTIONS_DEFAULT,
	SPIN_OPTIONS_FAST,
	SPIN_OPTIONS_INSTANT,
	INITIAL_SYMBOL_STATE,
	SCATTER_LAND_SOUND_MAP,
} from './constants';

const onSymbolLand = ({ rawSymbol }: { rawSymbol: RawSymbol }) => {
	if (rawSymbol.name === 'S') {
		eventEmitter.broadcast({ type: 'soundScatterCounterIncrease' });
		eventEmitter.broadcast({ type: 'soundOnce', name: SCATTER_LAND_SOUND_MAP[scatterLandIndex()] });
	}
	if (rawSymbol.name === 'GL') {
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_leaf_land' });
	}
};

// ante hold: once the forced reel-1 scatter has dropped in, it stays through later ante spins.
// Live check: pre-spin fall-out happens before the book's anteLock event arrives, so the hold must be
// derived, not event-driven — ante mode active AND the scatter is already on screen. Shared by the reel
// (skip its motion) and ReelSymbol (draw it above the symbols cascading behind it).
export const isAnteLockedSymbol = (reelIndex: number, symbolIndexOfBoard: number): boolean =>
	reelIndex === 0 &&
	symbolIndexOfBoard === 3 &&
	stateBet.activeBetModeKey.toUpperCase() === 'ANTE' &&
	stateGame.antePrevLocked;

const board = _.range(BOARD_DIMENSIONS.x).map((reelIndex) => {
	const reel = createReelForCascading({
		reelIndex,
		symbolHeight: SYMBOL_SIZE,
		initialSymbols: INITIAL_BOARD[reelIndex],
		initialSymbolState: INITIAL_SYMBOL_STATE,
		getLockedRows: (): number[] => (isAnteLockedSymbol(reelIndex, 3) ? [3] : []),
		onReelStopping: () => {
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_reel_stop', forcePlay: !stateBet.isTurbo });
		},
		onSymbolLand,
	});

	reel.reelState.spinOptions = () =>
		reel.reelState.spinType === 'fast' ? (stateGame.turboLevel === 2 ? SPIN_OPTIONS_INSTANT : SPIN_OPTIONS_FAST) : SPIN_OPTIONS_DEFAULT;

	return reel;
});

export type Reel = (typeof board)[number];
export type ReelSymbol = Reel['reelState']['symbols'][number];

export const stateGame = $state({
	board,
	gameType: 'basegame' as GameType,
	scatterCounter: 0,
	// Mantis session state (driven purely by book events; never computed locally)
	bonusMode: 'free' as BonusMode,
	bonusHost: 'marty' as BonusHost,
	symbolPool: [...config.eatOrder] as PayingSymbolName[],
	eatenSymbols: [] as PayingSymbolName[],
	strikeCount: 0,
	turboLevel: 0 as 0 | 1 | 2, // 0 off · 1 turbo · 2 instant (see controls.turboPress)
	antePrevLocked: false, // previous spin ended with the ante scatter on screen
	spinsPlayed: 0,
	totalFs: 0,
	anteLocked: false,
});

const resetSession = () => {
	stateGame.symbolPool = [...config.eatOrder];
	stateGame.eatenSymbols = [];
	stateGame.strikeCount = 0;
	stateGame.spinsPlayed = 0;
	stateGame.totalFs = 0;
};

// Board placement in master units (see layoutSpec.ts). width/height are the UNSCALED Pixi board sizes
// (children of BoardContainer live in that space); `scale` maps them onto the design's reel frame.
const boardLayout = () => {
	const placement = boardPlacement(layoutKind(stateLayoutDerived.layoutType()));
	return {
		x: placement.x,
		y: placement.y,
		scale: placement.scale,
		anchor: { x: 0.5, y: 0.5 },
		pivot: { x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 },
		...BOARD_SIZES,
	};
};

const boardRaw = () => board.map((reel) => reel.reelState.symbols.map((reelSymbol) => reelSymbol.rawSymbol));

const scatterLandIndex = () => {
	if (stateGame.scatterCounter > 5) return 5;
	if (stateGame.scatterCounter < 1) return 1;
	return stateGame.scatterCounter as 1 | 2 | 3 | 4 | 5;
};

const { enhanceBoard } = createEnhanceBoard();
const enhancedBoard = enhanceBoard({ board: stateGame.board });

export const { getWinLevelDataByWinLevelAlias } = createGetWinLevelDataByWinLevelAlias({ winLevelMap });

export const stateGameDerived = {
	onSymbolLand,
	boardLayout,
	boardRaw,
	scatterLandIndex,
	enhancedBoard,
	getWinLevelDataByWinLevelAlias,
	resetSession,
};
