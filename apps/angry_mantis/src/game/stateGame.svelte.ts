import _ from 'lodash';

import { stateBet } from 'state-shared';
import { createEnhanceBoard, createReelForCascading } from 'utils-slots';
import { createGetWinLevelDataByWinLevelAlias } from 'utils-shared/winLevel';

import type { GameType, RawSymbol, BonusMode, BonusHost, PayingSymbolName, Position } from './types';
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

const onSymbolLand = ({ rawSymbol, visible }: { rawSymbol: RawSymbol; visible?: boolean }) => {
	// hidden padding rows (0/5) land too — a scatter or leaf there must not play the
	// counter sting / leaf sound the player can't see (code-review 2026-08-31)
	if (visible === false) return;
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
/** the species the NEXT strike will eat: lowest-paying symbol still in the pool */
export const nextSymbolToEat = (): PayingSymbolName | undefined =>
	config.eatOrder.find((sym) => stateGame.symbolPool.includes(sym));

/** symbols still in the pool, in the order they will be eaten (lowest pay first) */
export const upcomingEats = (): PayingSymbolName[] =>
	config.eatOrder.filter((sym) => stateGame.symbolPool.includes(sym));

/** a configured autoplay run waiting on the spin button (built in AutoplayModal, consumed on start) */
export type AutoLoadout = {
	count: number; // Infinity allowed
	lossMult: number | null; // × one spin's play amount; null = no loss stop
	winMult: number | null; // × one spin's play amount; null = no single-win stop
	stopFree: boolean; // end the run when a feature triggers naturally (base/ante only)
	autoBonuses: boolean; // auto-continue the press-gated bonus door screens (only offered while stopFree is off)
};

/** the RUNNING autoplay wants the press-gated bonus door screens to continue on their own.
 * Live check on every gate: the counter only decrements AFTER the whole bet (feature included)
 * plays out, so it is still >0 through the doors of an auto spin — and already 0 if the player
 * pressed stop, which restores the hard press-gate. */
export const autoBonusesRunning = (): boolean => stateGame.autoPlayBonuses && stateBet.autoSpinsCounter > 0;

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
	// combo currently being presented by winInfo (positions in symbols[] index space, i.e. padded
	// rows like boardWithAnimateSymbols); non-members dim so the undimmed set reads as the win
	winFocus: null as Position[] | null,
	bonusHost: 'marty' as BonusHost,
	symbolPool: [...config.eatOrder] as PayingSymbolName[],
	// dinner-leaf strike bookkeeping: where the pending strike's leaf sits, which leaves this board
	// have already had their insect eaten (so their overlay hides), and every leaf position of the
	// current board in the order the math strikes them (reel-major). All reset on each reveal.
	pendingStrikePos: null as Position | null,
	consumedLeaves: [] as Position[],
	leafOrder: [] as Position[],
	eatenSymbols: [] as PayingSymbolName[],
	strikeCount: 0,
	turboLevel: 0 as 0 | 1 | 2, // 0 off · 1 turbo · 2 instant (see controls.turboPress)
	// autoplay loadout on the spin button (pressing Spin starts it); flags of the RUNNING autoplay:
	// stop-on-free-games (checked by the freeSpinTrigger book event handler) and autoplay-bonuses
	// (door screens self-continue — see autoBonusesRunning above)
	autoLoadout: null as AutoLoadout | null,
	autoStopOnFreeGames: false,
	autoPlayBonuses: false,
	// count of ACTIVE press-to-continue gates (see PressToContinue.svelte): while > 0, Chrome's
	// Space→spin/stop hotkey is disabled so a continue press can't leak into stopButtonClick
	pressGates: 0,
	antePrevLocked: false, // previous spin ended with the ante scatter on screen
	spinsPlayed: 0,
	totalFs: 0,
	anteLocked: false,
	// bonus wrap-up recap, stashed by the bonusEnd book event (no presentation of its own) and
	// rendered by the freeSpinEnd outro on the closed door — ONE merged wrap-up screen
	// (Corey 2026-08-31, replacing the separate SessionSummary)
	sessionRecap: null as null | {
		mode: BonusMode;
		spinsPlayed: number;
		symbolsEaten: number;
		eatenList: PayingSymbolName[];
	},
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
	// viewport width in master units: lets the portrait frame expand into the letterbox side space
	const vw = stateLayoutDerived.canvasSizes().width / stateLayoutDerived.mainLayout().scale;
	const placement = boardPlacement(layoutKind(stateLayoutDerived.layoutType()), vw);
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

/** The ante hold keeps its scatter on reel 1 across spins, and a locked row never runs its move
 * callback (createReelForCascading's moveAllSymbolsWith), so the held scatter fires no land event.
 * That is right for the sound — it must not re-sting on every ante spin — but it is still ON the
 * board, so it has to count toward the escalation: with it held, the next NEW scatter that lands
 * beside it is the second scatter on screen and plays _2, not _1 (Corey 2026-09-01). Derived live,
 * never event-driven — the same rule getLockedRows follows. */
const heldScatterCount = (): number => (isAnteLockedSymbol(0, 3) ? 1 : 0);

const scatterLandIndex = () => {
	const count = stateGame.scatterCounter + heldScatterCount();
	if (count > 5) return 5;
	if (count < 1) return 1;
	return count as 1 | 2 | 3 | 4 | 5;
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
