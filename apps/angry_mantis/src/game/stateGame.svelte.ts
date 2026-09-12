import _ from 'lodash';

import { stateBet, stateBetDerived } from 'state-shared';
import { createEnhanceBoard, createReelForCascading } from 'utils-slots';
import { createGetWinLevelDataByWinLevelAlias } from 'utils-shared/winLevel';
import { waitForResolve, waitForTimeout } from 'utils-shared/wait';

import type { GameType, RawSymbol, BonusMode, BonusHost, PayingSymbolName, Position, Scene } from './types';
import { stateLayoutDerived } from './stateLayout';
import { boardPlacement, layoutKind } from './layoutSpec';
import { winLevelMap } from './winLevelMap';
import { eventEmitter } from './eventEmitter';
import { screenKick } from './screenKick';
import { stateApp } from './stateApp';
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
	SCATTER_LAND,
} from './constants';

const onSymbolLand = ({ rawSymbol, visible }: { rawSymbol: RawSymbol; visible?: boolean }) => {
	// hidden padding rows (0/5) land too — a scatter or bell there must not play the
	// counter sting / landing sound the player can't see (code-review 2026-08-31)
	if (visible === false) return;
	// a scatter's contact is the SLAP, not the strip landing (ReelSymbol → ScatterDrop →
	// scatterContact below): the count, the sound and the kick all fire there
	if (rawSymbol.name === 'GL') {
		// Service Bell landing: the ding itself belongs to the ring at strike time (Mantis.svelte)
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_leaf_land' });
		eventEmitter.broadcast({ type: 'menuGlow', on: true }); // ON THE MENU lights up until the eat
	}
	// forcePlay: two wilds settling a reel apart must both sparkle (the once-player otherwise
	// drops a name that is still sounding)
	if (rawSymbol.name === 'W') {
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_wild_land', forcePlay: true });
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
export const autoBonusesRunning = (): boolean => isReplayPlayback() || (stateGame.autoPlayBonuses && stateBet.autoSpinsCounter > 0);

/** a shared-round replay is a recording: its door screens continue on their own instead of
 * waiting for a press (Stake's own replay window plays the round through unattended). */
const isReplayPlayback = (): boolean =>
	typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('replay') === 'true';

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

	// By turbo level, not by spinType: a reel at/after the first anticipated one is never 'fast'
	// (createEnhanceBoardSpin), and it used to fall back to the DEFAULT timings even in turbo, so
	// a teased spin lost its turbo entirely. The hold and the drop now scale with the level too.
	reel.reelState.spinOptions = () =>
		stateGame.turboLevel === 2 ? SPIN_OPTIONS_INSTANT : stateGame.turboLevel === 1 ? SPIN_OPTIONS_FAST : SPIN_OPTIONS_DEFAULT;

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
	// mirrors Win.svelte's `show` (DEV soak hook only; nothing gameplay-side reads it)
	winShowing: false,
	// Service Bell strike bookkeeping: where the pending strike's bell sits (it rings there), which
	// bells on this board have already been answered, and every bell position of the current board
	// in the order the math strikes them (reel-major). All reset on each reveal.
	// the course being served right now (its tray is growing out of the ON THE MENU icon, or is on
	// its way into the mantis): PoolHud dims that icon from the first frame of the growth, not from
	// the eat event that follows (Corey 2026-09-10)
	servingSymbol: null as PayingSymbolName | null,
	pendingStrikePos: null as Position | null,
	consumedLeaves: [] as Position[],
	leafOrder: [] as Position[],
	eatenSymbols: [] as PayingSymbolName[],
	strikeCount: 0,
	turboLevel: 0 as 0 | 1 | 2, // 0 off · 1 turbo · 2 instant (see controls.turboPress)
	// the level the player chose for base / ante / mystery play. Turbo is remembered PER WORLD:
	// every bonus starts at normal speed (bonusStart), a turbo press during the bonus only lasts
	// that bonus, and freeSpinEnd hands the base level back (Corey 2026-09-12). This is the level
	// that persists between sessions (Sound.svelte), never the live one.
	baseTurboLevel: 0 as 0 | 1 | 2,
	// autoplay loadout on the spin button (pressing Spin starts it); flags of the RUNNING autoplay:
	// stop-on-free-games (checked by the freeSpinTrigger book event handler) and autoplay-bonuses
	// (door screens self-continue — see autoBonusesRunning above)
	autoLoadout: null as AutoLoadout | null,
	autoStopOnFreeGames: false,
	autoPlayBonuses: false,
	// count of ACTIVE press-to-continue gates (see PressToContinue.svelte): while > 0, Chrome's
	// Space→spin/stop hotkey is disabled so a continue press can't leak into stopButtonClick
	pressGates: 0,
	// ---- scatter landing (SCATTER_LAND, constants.ts) ----
	// cells whose scatter is being slapped down right now (ReelSymbol hides its own tile meanwhile,
	// ScatterDrop.svelte draws the card above the frame)
	scatterDrops: [] as Position[],
	// scatters that have made contact this spin, in landing order (the ante-held one is added when
	// the lit set forms: it counts, it just never re-lands)
	scatterLanded: [] as Position[],
	// the lit set from the third scatter on: every member flashes + rims on each hit (hitAt), the
	// cards that landed as a 3rd+ lift; the wrap-up sweep (sweepAt) puts them out left to right
	// and the accent (accentAt) flashes them all together before the trigger's grow
	scatterSet: null as null | { hitAt: number; order: (Position & { lift: boolean })[]; sweepAt: number | null; accentAt: number | null },
	scatterBulbAt: 0, // board-window flashbulb start (performance.now), 0 = none
	scatterGrowHold: false, // the trigger's win grow stays up until the door has closed
	scatterGrowAt: 0, // when that grow started (performance.now), 0 = none; ReelSymbol breathes on it
	antePrevLocked: false, // previous spin ended with the ante scatter on screen
	// which cafeteria room is on the backdrop (Background.svelte). Set by the handlers at the
	// lights cut (LIGHTS_CUT), NOT derived from gameType: the room must change while the lamps
	// are out, and the base game's regular free spins share the base room.
	scene: 'base' as Scene,
	lightsDark: false, // the lamps are out (between lights-out and the first restrike pop)
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

/** the ONE way to change the live turbo level: keeps the SDK's isTurbo flag (timeScale, the
 *  reel options) in step with the level the button and the reels read */
const setTurboLevel = (level: 0 | 1 | 2) => {
	stateGame.turboLevel = level;
	stateBetDerived.updateIsTurbo(level > 0, { persistent: true });
};

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

/** left-to-right (then top-to-bottom) order for the lit set */
const byReel = (a: Position, b: Position) => a.reel - b.reel || a.row - b.row;

let dropWaiters: (() => void)[] = [];
/** ReelSymbol: the strip has landed with this scatter's cell empty; the card comes down now */
const scatterDropStart = (pos: Position) => {
	if (stateGame.scatterDrops.some((p) => p.reel === pos.reel && p.row === pos.row)) return;
	trace('drop', { reel: pos.reel, row: pos.row });
	stateGame.scatterDrops = [...stateGame.scatterDrops, pos];
};
/** ScatterDrop: the card has hit the cell — the scatter's real landing moment */
const scatterDropDone = (pos: Position) => {
	const before = stateGame.scatterDrops.length;
	stateGame.scatterDrops = stateGame.scatterDrops.filter((p) => !(p.reel === pos.reel && p.row === pos.row));
	if (stateGame.scatterDrops.length === before) return; // already done (idempotent)
	scatterContact(pos);
	if (!stateGame.scatterDrops.length) {
		const waiters = dropWaiters;
		dropWaiters = [];
		waiters.forEach((w) => w());
	}
};
/** resolves once no scatter card is mid-slap */
const scatterDropsSettled = () =>
	waitForResolve((resolve) => {
		if (!stateGame.scatterDrops.length) resolve();
		else dropWaiters.push(resolve);
	});

// DEV: __angryMantis.scatterTrace — the scatter timeline of the current spin (hits, sweep, accent,
// grow) with performance.now() stamps, so a harness can prove the wrap-up ran and in what order
const trace = (event: string, extra: Record<string, unknown> = {}) => {
	if (!import.meta.env.DEV || typeof window === 'undefined') return;
	const am = ((window as any).__angryMantis ??= {});
	(am.scatterTrace ??= []).push({ t: Math.round(performance.now()), event, ...extra });
};

const scatterContact = (pos: Position) => {
	eventEmitter.broadcast({ type: 'soundScatterCounterIncrease' });
	const count = scatterLandIndex();
	eventEmitter.broadcast({ type: 'soundOnce', name: SCATTER_LAND_SOUND_MAP[count] });
	stateGame.scatterLanded = [...stateGame.scatterLanded, pos];
	trace('hit', { count, reel: pos.reel, row: pos.row });
	const kick = SCATTER_LAND.kick[Math.min(SCATTER_LAND.kick.length, count) - 1];
	if (kick) screenKick(stateApp.pixiApplication, kick * stateLayoutDerived.mainLayout().scale);
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		const am = ((window as any).__angryMantis ??= {});
		am.landBeat ??= { highLandings: 0, glintFrames: 0 };
		am.landBeat.scatterHits = (am.landBeat.scatterHits ?? 0) + 1;
	}
	// the lit set: from the third scatter of a base-game spin (free-game scatters keep the
	// landing beat only — their retrigger banner owns what follows)
	if (count < 3 || stateGame.gameType !== 'basegame') return;
	const now = performance.now();
	const members: (Position & { lift: boolean })[] = stateGame.scatterLanded.map((p) => ({
		...p,
		lift: stateGame.scatterSet?.order.find((m) => m.reel === p.reel && m.row === p.row)?.lift ?? (p.reel === pos.reel && p.row === pos.row),
	}));
	if (heldScatterCount() && !members.some((m) => m.reel === 0 && m.row === 3)) members.push({ reel: 0, row: 3, lift: false });
	members.sort(byReel);
	stateGame.scatterSet = { hitAt: now, order: members, sweepAt: null, accentAt: null };
	stateGame.scatterBulbAt = now;
};

/** At the trigger (freeSpinTrigger), with a lit set on the board: the wrap-up — a breath, the
 * left-to-right sweep, the all-together accent — returning just before the grow is due. It runs
 * HERE and not at the end of the reveal so a triggering spin that also pays presents its wins
 * first (the set stays lit through them) and the sweep, accent and grow still land back to back. */
const scatterWrapUp = async () => {
	const set = stateGame.scatterSet;
	if (!set) return;
	const ts = stateBetDerived.timeScale();
	await waitForTimeout(SCATTER_LAND.sweepDelayMs / ts);
	if (stateGame.scatterSet !== set) return;
	set.sweepAt = performance.now();
	trace('sweep', { cards: set.order.length });
	await waitForTimeout(((set.order.length - 1) * SCATTER_LAND.sweepStaggerMs + SCATTER_LAND.accentDelayMs) / ts);
	if (stateGame.scatterSet !== set) return;
	set.accentAt = performance.now();
	trace('accent');
	await waitForTimeout(SCATTER_LAND.growDelayMs / ts);
};

/** a new spin, a settle, or the closed bonus door: nothing scatter-side may outlive it */
const clearScatterFx = () => {
	trace('clear'); // append-only: a harness reads the whole spin after the bonus has started
	stateGame.scatterDrops = [];
	stateGame.scatterLanded = [];
	stateGame.scatterSet = null;
	stateGame.scatterBulbAt = 0;
	stateGame.scatterGrowHold = false;
	stateGame.scatterGrowAt = 0;
	const waiters = dropWaiters;
	dropWaiters = [];
	waiters.forEach((w) => w());
};

const { enhanceBoard } = createEnhanceBoard();
const enhancedBoard = enhanceBoard({ board: stateGame.board });

export const { getWinLevelDataByWinLevelAlias } = createGetWinLevelDataByWinLevelAlias({ winLevelMap });

export const stateGameDerived = {
	onSymbolLand,
	scatterDropStart,
	scatterDropDone,
	scatterDropsSettled,
	scatterTrace: trace,
	scatterWrapUp,
	clearScatterFx,
	boardLayout,
	boardRaw,
	scatterLandIndex,
	enhancedBoard,
	getWinLevelDataByWinLevelAlias,
	resetSession,
	setTurboLevel,
};
