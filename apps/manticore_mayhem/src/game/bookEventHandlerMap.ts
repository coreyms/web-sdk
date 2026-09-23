import _ from 'lodash';

import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { stateBet, stateBetDerived } from 'state-shared';
import { waitForTimeout } from 'utils-shared/wait';
import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

import { eventEmitter } from './eventEmitter';
import type { MusicName } from './sound';
import { playBookEvent } from './utils';
import { winLevelMap, type WinLevel, type WinLevelData } from './winLevelMap';
import { getWinLevelDataByBookEventAmount } from './winLevelMap';
import {
	stateGame,
	stateGameDerived,
	revealBoard,
	presentCluster,
	removeCells,
	applyTiles,
	dropFill,
	stingCharge,
	stingStrike,
	flashCells,
	waitStyle,
	resetTiles,
	settleBoard,
	boardInvariant,
	newRun,
} from './stateGame.svelte';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';
import {
	TIMINGS,
	FEATURE_FX,
	STING,
	BONUS_TRIGGER_SOUND_MAP,
	BONUS_MODE_LABEL,
	SCATTER_LAND_SOUND_MAP,
	cellOf,
} from './constants';

// ================================================================================================
// Every state change the player sees comes from THIS file, and every one of them comes from a book
// event. Nothing here computes an outcome, a pay, a tile value or a refill symbol — the schema
// (math-sdk/games/manticore_mayhem/EVENT_SCHEMA.md) is the contract and the client only plays it.
//
// The one place that could tempt a re-derivation is `cascade.tiles`, which is a SUBSET of
// `removed` (a capped cell, or a cluster under the seed/grow threshold, is simply absent). The
// schema says in as many words: the client must not re-derive this. applyTiles() writes what it
// is sent, nothing more.
// ================================================================================================

const musicPlay = (name: MusicName) => eventEmitter.broadcast({ type: 'soundMusic', name });

/** the music loop a mode plays. Angry Mantis's tracks are the placeholder set (Corey 2026-09-22). */
const modeMusic = (): MusicName => {
	if (stateGame.gameType !== 'freegame') return 'bgm_base';
	if (stateGame.bonusMode === 'epic') return 'bgm_feast';
	if (stateGame.bonusMode === 'super') return 'bgm_super';
	return 'bgm_free';
};

const winLevelSoundsPlay = ({ winLevelData }: { winLevelData: WinLevelData }) => {
	if (winLevelData?.alias === 'max') eventEmitter.broadcastAsync({ type: 'uiHide' });
	if (winLevelData?.type === 'big') eventEmitter.broadcast({ type: 'soundDuck', level: 0.85 });
	if (winLevelData?.sound?.sfx) eventEmitter.broadcast({ type: 'soundOnce', name: winLevelData.sound.sfx });
	if (winLevelData?.sound?.bgm) musicPlay(winLevelData.sound.bgm);
};

const winLevelSoundsStop = ({ keepMusic = false, keepUi = false } = {}) => {
	eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_money_counter' });
	if (!keepMusic) {
		musicPlay(modeMusic());
		eventEmitter.broadcast({ type: 'soundDuck', level: 1 });
	}
	if (!keepUi) eventEmitter.broadcastAsync({ type: 'uiShow' });
};

/** ONE scatter landing: it joins the running count (so 4 / 5 / 6 reads correctly before
 *  bonusStart, whether the scatter fell in or was stung in) and plays Angry Mantis's own ladder of
 *  scatter sounds, which carry over to Manticore UNCHANGED (Corey 2026-09-22). */
const scatterLand = (cell: number, id: number) => {
	stateGame.scatterCells = [...stateGame.scatterCells, cell];
	const n = Math.min(5, stateGame.scatterCells.length) as 1 | 2 | 3 | 4 | 5;
	eventEmitter.broadcast({ type: 'soundOnce', name: SCATTER_LAND_SOUND_MAP[n] });
	eventEmitter.broadcast({ type: 'soundScatterCounterIncrease' });
	void flashCells([cell], STING.scatterColor, TIMINGS.scatterFlashMs, id);
};

/** the reveal's own scatters, left to right */
const scatterBeat = async (cells: number[], id: number) => {
	if (!cells.length) return;
	for (const cell of [...cells].sort((a, b) => a - b)) {
		scatterLand(cell, id);
		await waitForTimeout(TIMINGS.scatterStaggerMs);
	}
};

const scattersOf = (board: BookEventOfType<'reveal'>['board']): number[] => {
	const cells: number[] = [];
	board.forEach((column, reel) =>
		column.forEach((name, row) => {
			if (name === 'S') cells.push(cellOf(reel, row));
		}),
	);
	return cells;
};

/** the cluster readout: the band pay, the tile sum under it, and what the two make */
const clusterReadout = (win: BookEventOfType<'cascade'>['wins'][number]) => {
	const total = bookEventAmountToCurrencyString(win.w);
	if (!win.m) return total;
	return `${bookEventAmountToCurrencyString(win.p)} × ${win.m} = ${total}`;
};

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	// ---- reveal: a whole new board falls in ------------------------------------------------------
	reveal: async (bookEvent: BookEventOfType<'reveal'>, { bookEvents }: BookEventContext) => {
		const isBonusGame = checkIsMultipleRevealEvents({ bookEvents });
		if (isBonusGame) {
			eventEmitter.broadcast({ type: 'stopButtonEnable' });
			recordBookEvent({ bookEvent });
		}
		if (bookEvent.gameType === 'basegame') stateGameDerived.resetSession();

		stateGame.gameType = bookEvent.gameType;
		stateGame.spinWin = 0;
		stateGame.busy = true;
		eventEmitter.broadcast({ type: 'soundScatterCounterClear' });
		eventEmitter.broadcast({ type: 'spinWinHide' });

		// THE MULTIPLIER GRID IS THE BOOK'S, NEVER OURS. In the spin modes tiles reset every spin, so
		// the reveal carries none and the grid clears; inside a persistent feature the reveal carries
		// the grid it inherited. Either way this one line is the whole persistence rule.
		resetTiles();
		if (bookEvent.tiles?.length) {
			for (const [cell, value] of bookEvent.tiles) {
				const tile = stateGame.tiles[cell];
				if (tile) tile.value = value;
			}
		}

		if (bookEvent.gameType === 'freegame') {
			stateGame.fs = bookEvent.fs ?? stateGame.fs + 1;
			stateGame.totalFs = bookEvent.totalFs ?? stateGame.totalFs;
			// the HUD counter reads spinsPlayed + 1 (controls.freeSpin), so it holds COMPLETED spins
			stateGame.spinsPlayed = Math.max(0, stateGame.fs - 1);
		}

		// THE BOOK'S ANTICIPATION ARRAY IS HONOURED IN MYSTERY ONLY (RULE_PASS_2 section D): the
		// Mystery spin-in always lands 3 War Standards in columns 0-2 and teases columns 3-7, and
		// the book writes that tease itself. Every other mode ignores the field, exactly as before.
		const isMystery = bookEvents.some((e) => e.type === 'mystery');
		const anticipation = isMystery && bookEvent.gameType === 'basegame' ? bookEvent.anticipation : undefined;

		const id = await revealBoard(bookEvent.board, { anticipation });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_reel_stop', forcePlay: true });

		stateGame.scatterCells = [];
		await scatterBeat(scattersOf(bookEvent.board), id);
	},

	// ---- cascade: one step of wins, removal, tiles, refill ---------------------------------------
	cascade: async (bookEvent: BookEventOfType<'cascade'>) => {
		const id = newRun();
		for (const win of bookEvent.wins) {
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_leaf_land', forcePlay: true });
			await presentCluster(win.c, clusterReadout(win), id);
		}
		// Playback order is fixed by the schema: show the wins, remove `removed`, set `tiles`,
		// drop `fill`. The client never has to reconstruct an intermediate board.
		await removeCells(bookEvent.removed, id);
		if (bookEvent.tiles.length) eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_service_bell', forcePlay: true });
		await applyTiles(bookEvent.tiles, id);
		await dropFill(bookEvent.fill, id);

		settleBoard();
		stateGame.spinWin = bookEvent.spinWin;
		eventEmitter.broadcast({ type: 'spinWinShow', amount: bookEvent.spinWin });
	},

	// ---- swipe: the paw clears the middle band ---------------------------------------------------
	swipe: async (bookEvent: BookEventOfType<'swipe'>) => {
		const id = newRun();
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_marty_strike', forcePlay: true });
		eventEmitter.broadcast({ type: 'featureBeat', beat: 'swipe', rows: bookEvent.rows });
		await flashCells(bookEvent.removed, FEATURE_FX.swipeColor, FEATURE_FX.swipeFlashMs, id);
		await removeCells(bookEvent.removed, id);
		await applyTiles(bookEvent.tiles, id);
		await dropFill(bookEvent.fill, id);
		settleBoard();
	},

	// ---- sting: the tail strikes cells in place ---------------------------------------------------
	// Four kinds, one playback each (RULE_PASS_2 section F). `cells -> symbol` is applied exactly as
	// written: the shape is never re-derived from `center`, which is presentation only.
	sting: async (bookEvent: BookEventOfType<'sting'>, { bookEvents }: BookEventContext) => {
		const id = newRun();
		const { kind, center, cells } = bookEvent;
		const beat = (phase: 'charge' | 'wait' | 'strike') =>
			eventEmitter.broadcast({ type: 'stingBeat', phase, kind, center, cells });

		if (kind === 'scatter') {
			// the board is already at rest: hold the disappointment / anticipation beat, then the
			// same tail hit, and the cell becomes a War Standard with the STANDARD scatter landing
			// SFX and the scatter beat. One event per scatter, played in the book's order.
			beat('wait');
			await waitStyle(STING.scatterHoldMs);
			beat('strike');
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_marty_strike', forcePlay: true });
			await stingStrike(cells, bookEvent.symbol, { ms: STING.scatterHitMs, popScale: STING.popScale, color: STING.scatterColor }, id);
			scatterLand(cells[0], id);
			settleBoard();
			return;
		}

		if (kind === 'big' || kind === 'super') {
			// always the LAST sting of the spin: a charge-up beat with the rest of the board dimmed
			// away, then the whole plus / block turns wild together with a bigger hit
			beat('charge');
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_marty_angry', forcePlay: true });
			await stingCharge(cells, kind === 'super' ? STING.superChargeMs : STING.chargeMs, id);
			beat('strike');
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_wild_land', forcePlay: true });
			await stingStrike(cells, bookEvent.symbol, { ms: STING.bigHitMs, popScale: STING.bigPopScale, color: STING.wildColor }, id);
			settleBoard();
			return;
		}

		// normal: a fast tail hit on the one cell. Several fire back to back with a short gap.
		beat('strike');
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_wild_land', forcePlay: true });
		await stingStrike(cells, bookEvent.symbol, { ms: STING.normalMs, popScale: STING.popScale, color: STING.wildColor }, id);
		settleBoard();
		const next = bookEvents[bookEvents.indexOf(bookEvent) + 1];
		if (next?.type === 'sting') await waitStyle(STING.gapMs);
	},

	// ---- roar: every low is blown off the board --------------------------------------------------
	roar: async (bookEvent: BookEventOfType<'roar'>) => {
		const id = newRun();
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_marty_angry', forcePlay: true });
		eventEmitter.broadcast({ type: 'featureBeat', beat: 'roar', rows: [] });
		await flashCells(bookEvent.removed, FEATURE_FX.roarColor, FEATURE_FX.roarFlashMs, id);
		await removeCells(bookEvent.removed, id);
		// the multiplier tiles under the removed lows are untouched (EVENT_SCHEMA.md)
		await dropFill(bookEvent.fill, id);
		settleBoard();
	},

	// ---- feature entry ---------------------------------------------------------------------------
	bonusStart: async (bookEvent: BookEventOfType<'bonusStart'>) => {
		// the feature-entry confirmation sound carries over from Angry Mantis unchanged
		eventEmitter.broadcast({ type: 'soundOnce', name: BONUS_TRIGGER_SOUND_MAP[bookEvent.bonus] });
		stateGame.bonusMode = bookEvent.bonus;
		stateGame.tileCap = bookEvent.tileCap;
		stateGame.totalFs = bookEvent.totalFs;
		stateGame.fs = 0;
		stateGame.spinsPlayed = 0;
		// every feature starts at normal speed; the base level comes back at freeSpinEnd
		stateGameDerived.setTurboLevel(0);

		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		await eventEmitter.broadcastAsync({ type: 'transition' });
		stateGame.gameType = 'freegame';
		musicPlay(modeMusic());
		await eventEmitter.broadcastAsync({
			type: 'modePlaqueShow',
			title: BONUS_MODE_LABEL[bookEvent.bonus],
			sub: `${bookEvent.totalFs} SPINS · TILES UP TO ${bookEvent.tileCap}x`,
			gated: true,
		});
		await eventEmitter.broadcastAsync({ type: 'uiShow' });
	},

	bonusEnd: async (bookEvent: BookEventOfType<'bonusEnd'>) => {
		stateGame.sessionRecap = {
			mode: bookEvent.bonus,
			spinsPlayed: bookEvent.spinsPlayed,
			totalSessionWin: bookEvent.totalSessionWin,
		};
	},

	// ---- the Mystery spin -------------------------------------------------------------------------
	// RULE PASS 2 (section D): a Mystery is a REAL SPIN now. The `mystery` event is still the first
	// event of the book, but it is a marker, not a resolution: the reveal that follows always lands
	// three War Standards in columns 0-2 and teases 3-7, the tail may sting two more in for a Super
	// or three for an Epic, and a `nothing` Mystery plays on as a base spin whose clusters pay.
	// The old instant path — the NO FEATURE plaque, the "THE MYSTERY OPENS" spoiler plaque, and the
	// early return that assumed the book carried no board — is gone with it.
	mystery: async (bookEvent: BookEventOfType<'mystery'>) => {
		stateGame.mysteryOutcome = bookEvent.outcome;
	},

	// ---- core SDK events -------------------------------------------------------------------------
	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		stateBet.winBookEventAmount = bookEvent.amount;
		// Presentation only. The book carries no winLevel for a base-game spin (there is no
		// `setWin` in this schema), so the TIER WORD is derived from the amount the book already
		// gave us — the number on screen is always the book's, never ours.
		if (stateGame.gameType !== 'basegame' || bookEvent.amount <= 0) return;
		const winLevelData = getWinLevelDataByBookEventAmount({ bookEventAmount: bookEvent.amount });
		if (!winLevelData || winLevelData.presentDuration <= 0) return;
		eventEmitter.broadcast({ type: 'winShow' });
		winLevelSoundsPlay({ winLevelData });
		await eventEmitter.broadcastAsync({ type: 'winUpdate', amount: bookEvent.amount, winLevelData });
		winLevelSoundsStop();
		eventEmitter.broadcast({ type: 'winHide' });
	},

	wincap: async (bookEvent: BookEventOfType<'wincap'>) => {
		stateBet.winBookEventAmount = bookEvent.amount;
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_win_max' });
	},

	freeSpinEnd: async (bookEvent: BookEventOfType<'freeSpinEnd'>) => {
		const winLevelData = winLevelMap[bookEvent.winLevel as WinLevel];
		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		stateGame.gameType = 'basegame';
		eventEmitter.broadcast({ type: 'spinWinHide' });
		winLevelSoundsPlay({ winLevelData });
		await eventEmitter.broadcastAsync({ type: 'freeSpinOutroShow' });
		await eventEmitter.broadcastAsync({ type: 'freeSpinOutroCountUp', amount: bookEvent.amount, winLevelData });
		winLevelSoundsStop({ keepUi: true });
		eventEmitter.broadcast({ type: 'freeSpinOutroHide' });
		await eventEmitter.broadcastAsync({ type: 'transition' });
		stateGame.bonusMode = null;
		stateGame.tileCap = 64;
		resetTiles();
		musicPlay(modeMusic());
		// turbo is remembered per world: the base level comes back when the feature ends
		stateGameDerived.setTurboLevel(stateGame.baseTurboLevel);
		await eventEmitter.broadcastAsync({ type: 'uiShow' });
	},

	finalWin: async (bookEvent: BookEventOfType<'finalWin'>) => {
		// finalWin is the LAST event of every book, a Mystery that awarded nothing included, so this
		// is where a bought round ends. Stake review 2026-09-20: a bought feature must not re-arm
		// itself — the game returns to the base game and the player selects and confirms the price
		// again to play another. The two Ante modes are type 'activate' and deliberately persist.
		if (stateBetDerived.activeBetMode()?.type === 'buy') stateBet.activeBetModeKey = 'BASE';
		// belt and braces: a round that paid nothing emits no setTotalWin at all (EVENT_SCHEMA.md),
		// so the HUD's amount has to land on the book's own final number either way
		stateBet.winBookEventAmount = bookEvent.amount;
		// the round is over: the board must be back on its grid, one sprite per cell, nothing
		// left mid-animation. DEV shouts if the book's own diff did not add up.
		settleBoard();
		if (import.meta.env.DEV) {
			const report = boardInvariant();
			if (!report.ok) console.warn('[manticore] board invariant broken at finalWin', report.problems);
		}
		stateGame.busy = false;
		stateGame.spinWin = 0;
		eventEmitter.broadcast({ type: 'spinWinHide' });
		eventEmitter.broadcast({ type: 'modePlaqueHide' });
	},

	// ---- resume (frontend-only) -------------------------------------------------------------------
	createBonusSnapshot: async (bookEvent: BookEventOfType<'createBonusSnapshot'>) => {
		const { bookEvents } = bookEvent;
		const findLast = <T>(type: T) =>
			_.findLast(bookEvents, (e) => e.type === type) as BookEventOfType<T> | undefined;

		const bonusStart = findLast('bonusStart' as const);
		const setTotalWin = findLast('setTotalWin' as const);
		if (bonusStart) {
			stateGame.bonusMode = bonusStart.bonus;
			stateGame.tileCap = bonusStart.tileCap;
			stateGame.totalFs = bonusStart.totalFs;
			stateGame.gameType = 'freegame';
			musicPlay(modeMusic());
		}
		if (setTotalWin) await playBookEvent(setTotalWin, { bookEvents });
	},
};
