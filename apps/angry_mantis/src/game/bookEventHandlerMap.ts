import _ from 'lodash';

import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { stateBet, stateBetDerived } from 'state-shared';
import { waitForTimeout } from 'utils-shared/wait';

import config from './config';
import { eventEmitter } from './eventEmitter';
import type { MusicName } from './sound';
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
	if (winLevelData?.sound?.bgm) musicPlay(winLevelData.sound.bgm);
};

const winLevelSoundsStop = () => {
	// backstop only — Win/FreeSpinOutro stop this the instant their count settles or is skipped.
	// This catches a presentation torn down before its count-up ever resolved (stop is a no-op
	// when the loop isn't running).
	eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_money_counter' });
	musicPlay(modeMusic());
	eventEmitter.broadcast({ type: 'soundDuck', level: 1 });
	eventEmitter.broadcastAsync({ type: 'uiShow' });
};

const modeMusic = () => {
	if (stateGame.gameType !== 'freegame') return 'bgm_base' as const;
	if (stateGame.bonusMode === 'feast') return 'bgm_feast' as const;
	if (stateGame.bonusMode === 'super') return 'bgm_super' as const;
	return 'bgm_free' as const;
};

// Every music-loop start in this file funnels through here. (It used to also stop the separate 15s
// bgm_base_intro boot stinger, which rode the once-player where soundMusic's pause-all-music could
// not reach it; base-loop.ogg is self-contained since 2026-09-01, so there is nothing to stop.)
const musicPlay = (name: MusicName) => {
	eventEmitter.broadcast({ type: 'soundMusic', name });
};

// per-free-spin outcome tracking for mantis reactions (reveal resets, setWin marks)
let freeSpinHadWin = false;

const animateSymbols = async ({ positions }: { positions: Position[] }) => {
	eventEmitter.broadcast({ type: 'boardShow' });
	await eventEmitter.broadcastAsync({ type: 'boardWithAnimateSymbols', symbolPositions: positions });
};

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: async (bookEvent: BookEventOfType<'reveal'>, { bookEvents }: BookEventContext) => {
		freeSpinHadWin = false;
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
		// No scatter anticipation in free games — a single scatter already retriggers there,
		// so the pulse + extended reel hold is noise; the tease only runs in the base game.
		const revealEvent =
			bookEvent.gameType === 'freegame'
				? { ...bookEvent, anticipation: [] }
				: bookEvent;
		if (bookEvent.gameType === 'freegame') {
			// the ante hold must NOT survive into a free-game reveal: clearing it only after the
			// spin left the base scatter's cell locked through the first free board's cascade
			// (code-review 2026-08-31)
			stateGame.antePrevLocked = false;
		}
		await stateGameDerived.enhancedBoard.spin({ revealEvent });
		eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_reel_spin' });
		eventEmitter.broadcast({ type: 'boardCheckGrid' });
		eventEmitter.broadcast({ type: 'soundScatterCounterClear' });
		if (bookEvent.gameType === 'basegame') {
			// the hold survives only across consecutive ante spins
			stateGame.antePrevLocked = stateGame.anteLocked;
			stateGame.anteLocked = false;
		}
		// NOTE: no "spins maxed" fallback anymore. The math guarantees every landed free-game
		// scatter awards +1 (never more than 3 delivered per session); the only reveals that
		// carry scatters without a retriggerSpins event are session-terminating spins — a
		// max-win cinematic OR a ways-win wincap (which can itself be followed by a cinematic
		// with no second wincap) — where the 20,000x presentation owns the screen.
	},
	winInfo: async (bookEvent: BookEventOfType<'winInfo'>, { bookEvents }: BookEventContext) => {
		// Overlapping presentation (Mother Clucker study, Corey 2026-08-30): combos light ~220ms
		// apart and ADDITIVELY — earlier combos stay focused, every amount floats concurrently on
		// its own cluster (ComboWin floaters outlive this handler). Nothing presents serially:
		// three combos are fully on screen in ~0.6s instead of ~2.3s.
		// The HUD WIN counter starts counting WITH the first combo, not after: apply this spin's
		// upcoming setTotalWin now — same value, just concurrent with the reveal.
		const idx = bookEvents.indexOf(bookEvent);
		const upcomingTotal = bookEvents
			.slice(idx + 1)
			.find((e): e is BookEventOfType<'setTotalWin'> => e.type === 'setTotalWin');
		if (upcomingTotal) stateBet.winBookEventAmount = upcomingTotal.amount;
		const lit: Position[] = [];
		for (const [i, win] of bookEvent.wins.entries()) {
			lit.push(...win.positions);
			stateGame.winFocus = [...lit];
			void animateSymbols({ positions: win.positions }); // pulse runs underneath, un-awaited
			eventEmitter.broadcast({ type: 'comboWinShow', amount: win.win, positions: win.positions });
			if (i < bookEvent.wins.length - 1) await waitForTimeout(220 / stateBetDerived.timeScale());
		}
		// short hold so the last combo's flash registers before the strike/eat choreography starts;
		// the floaters keep riding over whatever comes next
		await waitForTimeout(400 / stateBetDerived.timeScale());
		stateGame.winFocus = null;
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
		// autoplay "stop on free games": the feature still plays out in full, but the run ends with
		// this round instead of rolling into more auto spins
		if (stateGame.autoStopOnFreeGames && stateBet.autoSpinsCounter > 0) {
			stateBet.autoSpinsCounter = 0;
		}
		await animateSymbols({ positions: bookEvent.positions });
		stateGame.totalFs = bookEvent.totalFs;
		// the bonusStart event that follows plays the mode-specific intro
	},
	bonusStart: async (bookEvent: BookEventOfType<'bonusStart'>) => {
		stateGameDerived.resetSession();
		stateGame.bonusMode = bookEvent.mode;
		stateGame.bonusHost = bookEvent.host;
		stateGame.totalFs = bookEvent.totalFs;

		// super is Marky's stage: base Marty walks off in full view before the door drops
		if (bookEvent.mode === 'super') await eventEmitter.broadcastAsync({ type: 'martyWalkOut' });
		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		// the steel door IS the transition: it rolls down over the base board, the intro plays
		// on top of it, and the board swaps to the freegame reels behind it
		await eventEmitter.broadcastAsync({ type: 'doorClose' });
		// gameType flips HERE, before the music pick — modeMusic() reads it, so flipping it only
		// after the intro started every bonus on bgm_base, and only a WINNING free spin's
		// winLevelSoundsStop ever corrected it (zero-win bonuses and snapshot resumes never did).
		// mantisShow rides the same flush: MartyArt vanishes the instant gameType leaves
		// 'basegame', so the bonus rigs must claim his slot in the same frame (feast/free keep
		// "he just keeps standing"; super's Marty already walked out above).
		stateGame.gameType = 'freegame';
		eventEmitter.broadcast({ type: 'mantisShow', host: bookEvent.host });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_ui_bonus' });
		musicPlay(modeMusic());
		await eventEmitter.broadcastAsync({
			type: 'bonusIntroShow',
			mode: bookEvent.mode,
			host: bookEvent.host,
			totalFs: bookEvent.totalFs,
		});
		eventEmitter.broadcast({ type: 'bonusIntroHide' });
		eventEmitter.broadcast({ type: 'boardFrameGlowShow' });
		await eventEmitter.broadcastAsync({ type: 'doorOpen' });
		await eventEmitter.broadcastAsync({ type: 'uiShow' });
	},
	updateFreeSpin: async (bookEvent: BookEventOfType<'updateFreeSpin'>) => {
		if (!freeSpinHadWin && Math.random() < 1 / 3) {
			eventEmitter.broadcast({ type: 'mantisReact', kind: 'angry' });
		}
		stateGame.spinsPlayed = bookEvent.amount;
		stateGame.totalFs = bookEvent.total;
		// the FREE SPIN n/total readout is the HTML chrome's spin button (controls.freeSpin()),
		// derived from stateGame.spinsPlayed/totalFs — nothing to broadcast
	},
	strike: async (bookEvent: BookEventOfType<'strike'>) => {
		stateGame.strikeCount = bookEvent.strikeIndex + 1;
		// leaf cell the eat flight starts from. Math emits PADDED-array rows (game_events._row = row+1);
		// normalize to symbolIndexOfBoard space (visible rows 0-3) used by ReelSymbol overlays and getSymbolY.
		stateGame.pendingStrikePos = bookEvent.position
			? { reel: bookEvent.position.reel, row: bookEvent.position.row - 1 }
			: null;
		// sfx_marty_strike is NOT fired here: the sting belongs to the arms' lunge, which happens
		// TIMINGS.strike into the animation, so Mantis.svelte's mantisStrike owns its timing.
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
			// sfx_marty_eat is fired by mantisEat at the pluck, right behind the strike impact
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
		// Each awarded scatter pops its own '+1 SPIN' floater straight off the symbol — same
		// style/size/speed as the combo-win amounts (Corey 2026-08-30, replacing the banner).
		eventEmitter.broadcast({ type: 'mantisReact', kind: 'astonished' });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_leaf_land' });
		void animateSymbols({ positions: bookEvent.positions }); // pulse runs underneath, un-awaited
		const awarded = bookEvent.positions.slice(0, bookEvent.added);
		for (const [i, pos] of awarded.entries()) {
			eventEmitter.broadcast({ type: 'comboWinShow', text: '+1 SPIN', positions: [pos] });
			if (i < awarded.length - 1) await waitForTimeout(220 / stateBetDerived.timeScale());
		}
		stateGame.totalFs = bookEvent.newTotalFs;
		await waitForTimeout(400 / stateBetDerived.timeScale());
	},
	maxWinCinematic: async (bookEvent: BookEventOfType<'maxWinCinematic'>) => {
		// All-wild top-up beat (Corey 2026-09-01) — presentation ONLY, see AllWildTopUp.svelte.
		// The math ends the session the moment the pool empties, topping the round up to the cap in
		// one go; this event fires BEFORE the book's wincap/setTotalWin, so winBookEventAmount still
		// holds the pre-top-up running total and the gap to `payout` IS the book's top-up. A board of
		// wilds drops, that gap is read out as a bet multiplier, and the total then climbs to
		// `payout` — the same number the book itself writes two events later. Guarded on topUp > 0 so
		// any path that already applied the total (or a zero-gap book) goes straight to the cinematic.
		const topUp = bookEvent.payout - stateBet.winBookEventAmount;
		if (topUp > 0) {
			await eventEmitter.broadcastAsync({ type: 'allWildTopUpPlay', topUp, total: bookEvent.payout });
		}
		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		// the max-win moment is scored solely by bgm_maxwin, which carries Corey's 21.9 s max-win track
		// (2026-09-01: it replaced both the old max-win music and the separate sfx stinger layer)
		musicPlay('bgm_maxwin');
		await eventEmitter.broadcastAsync({ type: 'maxWinCinematicPlay', payout: bookEvent.payout });
		stateBet.winBookEventAmount = bookEvent.payout;
	},
	bonusEnd: async (bookEvent: BookEventOfType<'bonusEnd'>) => {
		eventEmitter.broadcast({ type: 'mantisHide' });
		// door down over the freegame board — no presentation and no press gate here: the recap is
		// stashed for freeSpinEnd, whose outro presents recap + total win on the closed door in ONE
		// screen (Corey 2026-08-31, replacing the separate SessionSummary); freeSpinEnd rolls it back up
		await eventEmitter.broadcastAsync({ type: 'doorClose' });
		stateGame.sessionRecap = {
			mode: bookEvent.mode,
			spinsPlayed: bookEvent.spinsPlayed,
			symbolsEaten: bookEvent.symbolsEaten,
			eatenList: bookEvent.eatenList,
		};
	},
	freeSpinEnd: async (bookEvent: BookEventOfType<'freeSpinEnd'>, { bookEvents }: BookEventContext) => {
		const winLevelData = winLevelMap[bookEvent.winLevel as WinLevel];
		// TOTAL WIN on the wrap-up is the ROUND total, not the free-spins subtotal. The book's
		// freeSpinEnd.amount covers only the free games — a base-game trigger win sits outside it
		// (books_base #17: trigger 20 + free spins 1320 → freeSpinEnd.amount 1320, finalWin 1340),
		// and the HUD WIN (running setTotalWin) is on screen at the same time showing 1340. So the
		// count-up target is the book's own finalWin when it has one, else the running total the
		// HUD is already displaying. The wincap path stays consistent by construction: maxWinCinematic
		// has already pinned winBookEventAmount to the book payout, which is what finalWin carries.
		const idx = bookEvents.indexOf(bookEvent);
		const finalWinEvent = bookEvents
			.slice(idx + 1)
			.find((e): e is BookEventOfType<'finalWin'> => e.type === 'finalWin');
		const roundTotal = Math.max(
			bookEvent.amount,
			finalWinEvent?.amount ?? stateBet.winBookEventAmount,
		);

		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		stateGame.gameType = 'basegame';
		eventEmitter.broadcast({ type: 'boardFrameGlowHide' });
		eventEmitter.broadcast({ type: 'freeSpinOutroShow' });
		winLevelSoundsPlay({ winLevelData });
		await eventEmitter.broadcastAsync({ type: 'freeSpinOutroCountUp', amount: roundTotal, winLevelData });
		winLevelSoundsStop();
		eventEmitter.broadcast({ type: 'freeSpinOutroHide' });
		await eventEmitter.broadcastAsync({ type: 'doorOpen' });
		await eventEmitter.broadcastAsync({ type: 'uiShow' });
	},
	setWin: async (bookEvent: BookEventOfType<'setWin'>) => {
		const winLevelData = winLevelMap[bookEvent.winLevel as WinLevel];

		if (stateGame.gameType === 'freegame' && bookEvent.amount > 0) {
			freeSpinHadWin = true;
			// hosts celebrate medium+ spins (plays under the win presentation)
			if (winLevelData.type !== 'small') eventEmitter.broadcast({ type: 'mantisReact', kind: 'celebrate' });
		}
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
		// order matters: updateFreeSpin is emitted BEFORE the spin's retriggerSpins in the book,
		// so replay it first — the retrigger's newTotalFs must win or a disconnect on a
		// retrigger spin resumes with the stale pre-retrigger total (code-review 2026-08-31)
		if (lastUpdateFreeSpinEvent) playBookEvent(lastUpdateFreeSpinEvent, { bookEvents });
		if (lastRetriggerEvent) stateGame.totalFs = lastRetriggerEvent.newTotalFs;
		if (lastSetTotalWinEvent) playBookEvent(lastSetTotalWinEvent, { bookEvents });
	},
};
