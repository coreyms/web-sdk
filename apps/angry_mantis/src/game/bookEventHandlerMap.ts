import _ from 'lodash';

import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { stateBet } from 'state-shared';
import { sequence } from 'utils-shared/sequence';

import config from './config';
import { eventEmitter } from './eventEmitter';
import { playBookEvent } from './utils';
import { winLevelMap, type WinLevel, type WinLevelData } from './winLevelMap';
import { stateGame, stateGameDerived } from './stateGame.svelte';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';
import type { Position } from './types';

const winLevelSoundsPlay = ({ winLevelData }: { winLevelData: WinLevelData }) => {
	if (winLevelData?.alias === 'max') eventEmitter.broadcastAsync({ type: 'uiHide' });
	if (winLevelData?.type === 'big') {
		eventEmitter.broadcast({ type: 'martyReact', kind: 'celebrate' });
		eventEmitter.broadcast({ type: 'soundDuck', level: 0.35 });
	}
	if (winLevelData?.sound?.sfx) eventEmitter.broadcast({ type: 'soundOnce', name: winLevelData.sound.sfx });
	if (winLevelData?.sound?.bgm) eventEmitter.broadcast({ type: 'soundMusic', name: winLevelData.sound.bgm });
};

const winLevelSoundsStop = () => {
	eventEmitter.broadcast({ type: 'soundMusic', name: modeMusic() });
	eventEmitter.broadcast({ type: 'soundDuck', level: 1 });
	eventEmitter.broadcastAsync({ type: 'uiShow' });
};

const modeMusic = () => {
	if (stateGame.gameType !== 'freegame') return 'bgm_base' as const;
	if (stateGame.bonusMode === 'feast') return 'bgm_feast' as const;
	if (stateGame.bonusMode === 'super') return 'bgm_super' as const;
	return 'bgm_free' as const;
};

const animateSymbols = async ({ positions }: { positions: Position[] }) => {
	eventEmitter.broadcast({ type: 'boardShow' });
	await eventEmitter.broadcastAsync({ type: 'boardWithAnimateSymbols', symbolPositions: positions });
};

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: async (bookEvent: BookEventOfType<'reveal'>, { bookEvents }: BookEventContext) => {
		stateGame.consumedLeaves = []; // fresh board, fresh leaves
		stateGame.pendingStrikePos = null;
		// Dinner-leaf strike order for this board: math strikes leaves reel-major (reel asc, then row asc
		// — board.py scan feeding leaf_strikes), so the k-th leaf eats the k-th symbol of upcomingEats().
		// bookEvent.board rows are PADDED (visible = 1..len-2); store rows in symbolIndexOfBoard space.
		stateGame.leafOrder = bookEvent.board.flatMap((reel, reelIndex) =>
			reel
				.map((symbol, row) => ({ name: symbol.name, row }))
				.filter(({ name, row }) => row > 0 && row < reel.length - 1 && name === 'GL')
				.map(({ row }) => ({ reel: reelIndex, row: row - 1 })),
		);
		const isBonusGame = checkIsMultipleRevealEvents({ bookEvents });
		if (isBonusGame) {
			eventEmitter.broadcast({ type: 'stopButtonEnable' });
			recordBookEvent({ bookEvent });
		}
		if (bookEvent.gameType === 'basegame') {
			stateGameDerived.resetSession();
		}
		stateGame.gameType = bookEvent.gameType;
		eventEmitter.broadcast({ type: 'soundLoop', name: 'sfx_reel_spin' });
		await stateGameDerived.enhancedBoard.spin({ revealEvent: bookEvent });
		eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_reel_spin' });
		eventEmitter.broadcast({ type: 'boardCheckGrid' });
		eventEmitter.broadcast({ type: 'soundScatterCounterClear' });
		if (bookEvent.gameType === 'basegame') {
			// the hold survives only across consecutive ante spins
			stateGame.antePrevLocked = stateGame.anteLocked;
			stateGame.anteLocked = false;
		} else {
			stateGame.antePrevLocked = false;
			// free spins: scatters that land while the +3 retrigger cap is reached award nothing — say so
			const scatters = bookEvent.board.reduce(
				(n, reel) => n + reel.filter((sym, row) => row > 0 && row < reel.length - 1 && sym.name === 'S').length,
				0,
			);
			if (scatters > 0) {
				const upcoming = bookEvents.slice(bookEvents.indexOf(bookEvent) + 1);
				const nextReveal = upcoming.findIndex((e) => e.type === 'reveal');
				const scope = nextReveal === -1 ? upcoming : upcoming.slice(0, nextReveal);
				if (!scope.some((e) => e.type === 'retriggerSpins')) {
					eventEmitter.broadcast({ type: 'retriggerShow', added: 0, newTotalFs: stateGame.totalFs });
				}
			}
		}
	},
	winInfo: async (bookEvent: BookEventOfType<'winInfo'>) => {
		await sequence(bookEvent.wins, async (win) => {
			await animateSymbols({ positions: win.positions });
		});
	},
	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		stateBet.winBookEventAmount = bookEvent.amount;
	},
	wincap: async (bookEvent: BookEventOfType<'wincap'>) => {
		stateBet.winBookEventAmount = bookEvent.amount;
	},
	anteLock: async (bookEvent: BookEventOfType<'anteLock'>) => {
		// presentation-free: the locked scatter simply stays on the board (see getLockedRows);
		// bookEvent.scatterPosition is implied by the lock row
		void bookEvent;
		stateGame.anteLocked = true;
	},
	freeSpinTrigger: async (bookEvent: BookEventOfType<'freeSpinTrigger'>) => {
		await animateSymbols({ positions: bookEvent.positions });
		stateGame.totalFs = bookEvent.totalFs;
		// the bonusStart event that follows plays the mode-specific intro
	},
	bonusStart: async (bookEvent: BookEventOfType<'bonusStart'>) => {
		stateGameDerived.resetSession();
		stateGame.bonusMode = bookEvent.mode;
		stateGame.bonusHost = bookEvent.host;
		stateGame.totalFs = bookEvent.totalFs;

		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		await eventEmitter.broadcastAsync({ type: 'transition' });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_ui_bonus' });
		eventEmitter.broadcast({ type: 'soundMusic', name: modeMusic() });
		await eventEmitter.broadcastAsync({
			type: 'bonusIntroShow',
			mode: bookEvent.mode,
			host: bookEvent.host,
			totalFs: bookEvent.totalFs,
		});
		stateGame.gameType = 'freegame';
		eventEmitter.broadcast({ type: 'bonusIntroHide' });
		eventEmitter.broadcast({ type: 'boardFrameGlowShow' });
		eventEmitter.broadcast({ type: 'freeSpinCounterShow' });
		eventEmitter.broadcast({ type: 'freeSpinCounterUpdate', current: undefined, total: bookEvent.totalFs });
		eventEmitter.broadcast({ type: 'mantisShow', host: bookEvent.host });
		await eventEmitter.broadcastAsync({ type: 'uiShow' });
		await eventEmitter.broadcastAsync({ type: 'drawerButtonShow' });
		eventEmitter.broadcast({ type: 'drawerFold' });
	},
	updateFreeSpin: async (bookEvent: BookEventOfType<'updateFreeSpin'>) => {
		stateGame.spinsPlayed = bookEvent.amount;
		stateGame.totalFs = bookEvent.total;
		eventEmitter.broadcast({ type: 'freeSpinCounterShow' });
		eventEmitter.broadcast({ type: 'freeSpinCounterUpdate', current: bookEvent.amount, total: bookEvent.total });
	},
	strike: async (bookEvent: BookEventOfType<'strike'>) => {
		stateGame.strikeCount = bookEvent.strikeIndex + 1;
		// leaf cell the eat flight starts from. Math emits PADDED-array rows (game_events._row = row+1);
		// normalize to symbolIndexOfBoard space (visible rows 0-3) used by ReelSymbol overlays and getSymbolY.
		stateGame.pendingStrikePos = bookEvent.position
			? { reel: bookEvent.position.reel, row: bookEvent.position.row - 1 }
			: null;
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_marty_strike' });
		await eventEmitter.broadcastAsync({
			type: 'mantisStrike',
			striker: bookEvent.striker,
			trigger: bookEvent.trigger,
			position: bookEvent.position,
		});
	},
	eat: async (bookEvent: BookEventOfType<'eat'>) => {
		if (bookEvent.symbolEaten) {
			// consume the leaf AND the pool entry BEFORE the flight starts, so the on-leaf insect
			// vanishes the instant the flying insect appears (updating only one would double the bug
			// on this leaf — or shift the next leaf's preview — for the duration of the flight)
			const from = stateGame.pendingStrikePos;
			if (from) {
				stateGame.consumedLeaves = [...stateGame.consumedLeaves, from];
				stateGame.pendingStrikePos = null;
			}
			stateGame.symbolPool = [...bookEvent.remainingPool];
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_marty_eat' });
			await eventEmitter.broadcastAsync({
				type: 'mantisEat',
				striker: bookEvent.striker,
				symbol: bookEvent.symbolEaten,
				from,
			});
			eventEmitter.broadcast({ type: 'boardMarkEaten', symbol: bookEvent.symbolEaten });
		} else {
			// cosmetic strike: pool already empty
			await eventEmitter.broadcastAsync({ type: 'mantisEat', striker: bookEvent.striker, symbol: null });
			stateGame.symbolPool = [...bookEvent.remainingPool];
		}
	},
	removeSymbolFromPool: async (bookEvent: BookEventOfType<'removeSymbolFromPool'>) => {
		stateGame.symbolPool = [...bookEvent.remainingPool];
		stateGame.eatenSymbols = config.eatOrder.filter((s) => !bookEvent.remainingPool.includes(s));
		await eventEmitter.broadcastAsync({ type: 'poolRemove', symbol: bookEvent.symbol });
	},
	retriggerSpins: async (bookEvent: BookEventOfType<'retriggerSpins'>) => {
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_leaf_land' });
		await animateSymbols({ positions: bookEvent.positions });
		stateGame.totalFs = bookEvent.newTotalFs;
		eventEmitter.broadcast({ type: 'freeSpinCounterUpdate', current: undefined, total: bookEvent.newTotalFs });
		await eventEmitter.broadcastAsync({
			type: 'retriggerShow',
			added: bookEvent.added,
			newTotalFs: bookEvent.newTotalFs,
		});
	},
	maxWinCinematic: async (bookEvent: BookEventOfType<'maxWinCinematic'>) => {
		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_maxwin' });
		await eventEmitter.broadcastAsync({ type: 'maxWinCinematicPlay', payout: bookEvent.payout });
		stateBet.winBookEventAmount = bookEvent.payout;
	},
	bonusEnd: async (bookEvent: BookEventOfType<'bonusEnd'>) => {
		eventEmitter.broadcast({ type: 'mantisHide' });
		await eventEmitter.broadcastAsync({
			type: 'sessionSummaryShow',
			mode: bookEvent.mode,
			totalSessionWin: bookEvent.totalSessionWin,
			spinsPlayed: bookEvent.spinsPlayed,
			symbolsEaten: bookEvent.symbolsEaten,
			eatenList: bookEvent.eatenList,
		});
	},
	freeSpinEnd: async (bookEvent: BookEventOfType<'freeSpinEnd'>) => {
		const winLevelData = winLevelMap[bookEvent.winLevel as WinLevel];

		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		stateGame.gameType = 'basegame';
		eventEmitter.broadcast({ type: 'boardFrameGlowHide' });
		eventEmitter.broadcast({ type: 'freeSpinOutroShow' });
		winLevelSoundsPlay({ winLevelData });
		await eventEmitter.broadcastAsync({ type: 'freeSpinOutroCountUp', amount: bookEvent.amount, winLevelData });
		winLevelSoundsStop();
		eventEmitter.broadcast({ type: 'freeSpinOutroHide' });
		eventEmitter.broadcast({ type: 'freeSpinCounterHide' });
		await eventEmitter.broadcastAsync({ type: 'transition' });
		await eventEmitter.broadcastAsync({ type: 'uiShow' });
		await eventEmitter.broadcastAsync({ type: 'drawerUnfold' });
		eventEmitter.broadcast({ type: 'drawerButtonHide' });
	},
	setWin: async (bookEvent: BookEventOfType<'setWin'>) => {
		const winLevelData = winLevelMap[bookEvent.winLevel as WinLevel];

		eventEmitter.broadcast({ type: 'winShow' });
		winLevelSoundsPlay({ winLevelData });
		await eventEmitter.broadcastAsync({ type: 'winUpdate', amount: bookEvent.amount, winLevelData });
		winLevelSoundsStop();
		eventEmitter.broadcast({ type: 'winHide' });
	},
	finalWin: async (bookEvent: BookEventOfType<'finalWin'>) => {
		// spec: ~1/15 losing base spins get an angry reaction from Marty
		if (bookEvent.amount === 0 && stateGame.gameType === 'basegame' && Math.random() < 1 / 15) {
			eventEmitter.broadcast({ type: 'martyReact', kind: 'angry' });
		}
		// Do nothing
	},
	// frontend-only: resume an active bonus from the last snapshot-worthy events
	createBonusSnapshot: async (bookEvent: BookEventOfType<'createBonusSnapshot'>) => {
		const { bookEvents } = bookEvent;

		function findLastBookEvent<T>(type: T) {
			return _.findLast(bookEvents, (bookEvent) => bookEvent.type === type) as BookEventOfType<T> | undefined;
		}

		const lastBonusStartEvent = findLastBookEvent('bonusStart' as const);
		const lastEatEvent = findLastBookEvent('eat' as const);
		const lastUpdateFreeSpinEvent = findLastBookEvent('updateFreeSpin' as const);
		const lastRetriggerEvent = findLastBookEvent('retriggerSpins' as const);
		const lastSetTotalWinEvent = findLastBookEvent('setTotalWin' as const);

		if (lastBonusStartEvent) await playBookEvent(lastBonusStartEvent, { bookEvents });
		if (lastEatEvent) {
			stateGame.symbolPool = [...lastEatEvent.remainingPool];
			stateGame.eatenSymbols = config.eatOrder.filter((s) => !lastEatEvent.remainingPool.includes(s));
		}
		if (lastRetriggerEvent) stateGame.totalFs = lastRetriggerEvent.newTotalFs;
		if (lastUpdateFreeSpinEvent) playBookEvent(lastUpdateFreeSpinEvent, { bookEvents });
		if (lastSetTotalWinEvent) playBookEvent(lastSetTotalWinEvent, { bookEvents });
	},
};
