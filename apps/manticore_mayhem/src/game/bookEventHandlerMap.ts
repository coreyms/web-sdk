import _ from 'lodash';

import { waitForTimeout } from 'utils-shared/wait';

import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { stateBet, stateBetDerived } from 'state-shared';

import { eventEmitter } from './eventEmitter';
import type { MusicName } from './sound';
import { playBookEvent } from './utils';
import { winLevelMap, type WinLevel, type WinLevelData } from './winLevelMap';
import { getWinLevelDataByBookEventAmount } from './winLevelMap';
import {
	stateGame,
	stateGameDerived,
	revealBoard,
	presentWinSet,
	removeCells,
	applyTiles,
	dropFill,
	stingHit,
	stingBig,
	swipeBand,
	roarBlow,
	flashCells,
	waitStyle,
	resetTiles,
	settleBoard,
	boardInvariant,
	newRun,
	currentRun,
	revealTease,
	scatterHold,
	scatterRing,
	scatterTrigger,
	plateReveal,
} from './stateGame.svelte';
import { motionLog } from './sparkles';
import { fxRecord, fxStamp, chainHaulPress } from './featureFx';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';
import type { CellIndex } from './types';
import {
	TIMINGS,
	STING,
	CLUSTER,
	MULT_PLATE,
	SWIPE_FX,
	SCATTER_STING,
	ANTICIPATION_TEASE,
	scatterWait,
	BONUS_TRIGGER_SOUND_MAP,
	BONUS_MODE_LABEL,
	SCATTER_LAND_SOUND_MAP,
	STINGER_PLAQUE,
	CHAIN_BOW,
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

/** the music loop a mode plays. Tracks come from tools/build_audiosprite.py --game manticore_mayhem; a mode without its own source yet ships an Angry Mantis placeholder (see the builder's MM_MUSIC). */
const modeMusic = (): MusicName => {
	if (stateGame.gameType !== 'freegame') return 'bgm_base';
	if (stateGame.bonusMode === 'epic') return 'bgm_epic';
	if (stateGame.bonusMode === 'super') return 'bgm_super';
	return 'bgm_bonus';
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
	// the STANDARD scatter landing beat: the ring + its glow (SCATTER_STING.landMs) and the tint flash
	scatterRing(cell);
	void flashCells([cell], STING.scatterColor, TIMINGS.scatterFlashMs, id);
};

/** the house bonus-confirm SFX, played ONCE per round: at the scatter trigger pulse (a tease hit, the end
 *  of a scatter sting run) when the book goes on to a bonusStart, else at bonusStart itself */
let triggerSfxPlayed = false;
const playTriggerSfx = (from: BookEvent, bookEvents: BookEvent[]) => {
	const start = bookEvents.slice(bookEvents.indexOf(from) + 1).find((e) => e.type === 'bonusStart') as BookEventOfType<'bonusStart'> | undefined;
	if (!start || triggerSfxPlayed) return;
	triggerSfxPlayed = true;
	eventEmitter.broadcast({ type: 'soundOnce', name: BONUS_TRIGGER_SOUND_MAP[start.bonus] });
};

/** this scatter sting's place in its run (the book's scatter stings after the last reveal): k of n */
const scatterRunOf = (bookEvent: BookEvent, bookEvents: BookEvent[]) => {
	const at = bookEvents.indexOf(bookEvent);
	let from = at;
	while (from > 0 && bookEvents[from - 1].type !== 'reveal') from -= 1;
	let to = at;
	while (to + 1 < bookEvents.length && bookEvents[to + 1].type !== 'reveal') to += 1;
	const run = bookEvents.slice(from, to + 1).filter((e) => e.type === 'sting' && e.kind === 'scatter');
	return { k: Math.max(0, run.indexOf(bookEvent)), n: Math.max(1, run.length) };
};

/** THE AURA LOOK-AHEAD (presentation only): the winners of the cascade that follows `bookEvent`
 *  glow as they land in this event's drop. The book is fully known, so the next event is simply read.
 *  Anything but a cascade next (a sting changes the board first) means no aura on landing; the win
 *  set then plays its standalone aura. */
const nextCascadeWinners = (bookEvent: BookEvent, bookEvents: BookEvent[]): Set<CellIndex> => {
	const next = bookEvents[bookEvents.indexOf(bookEvent) + 1];
	const out = new Set<CellIndex>();
	if (next?.type !== 'cascade') return out;
	for (const w of next.wins) for (const c of w.c) out.add(c);
	return out;
};

// ---- THE MAX WIN CUT (Corey 2026-10-09; presentation only) ----------------------------------------
// The book writes `wincap` straight after the cascade step that takes the ROUND total to the cap, and that
// step still lists every cluster of its board (each clamped at the cap). The player must not watch clusters
// clear and count past the cap: the step is presented up to the cluster at which the round total (all book
// numbers: the last setTotalWin, this spin's earlier cascade.spinWin, each win.w) reaches the cap amount,
// then the round goes straight to its Max Win screen and the rest of the step (the unshown clusters' removal,
// the tiles, the refill) is applied WITHOUT motion under that screen's plaque, so the board ends on exactly
// the book's board. Nothing here changes an amount: the plaque counts to the book's own capped amount.
//   IN A FEATURE (every max win book known): the Max Win screen IS the wrap up (freeSpinEnd), titled MAX WIN
//     instead of TOTAL WIN; `wincap` itself presents nothing and the capping spin gets no win screen of its own.
//   IN THE BASE GAME (no wrap up exists; no such book is known): the win plaque at `wincap`, as a safety net.
/** the book said `wincap` this round: the capping spin's setTotalWin presents nothing, the wrap up is the MAX WIN one */
let capShown = false;
/** the rest of the capped cascade step, owed to the board (run under the Max Win screen's entrance; finalWin
 *  lands it if nothing else did) */
let capTail: (() => Promise<void>) | null = null;
/** land what the capped step still owes the board, with no motion */
const landCapTail = async () => {
	const tail = capTail;
	capTail = null;
	if (!tail) return;
	await quietly(tail);
	if (import.meta.env.DEV) capLog.tailAt = performance.now();
};
/** DEV: what the last cut did (tools/manticore/skip_probe.js) */
const capLog: { clusters: number; shown: number; spinStepMax: number; spinWin: number; tailAt: number; via: '' | 'wrap' | 'win' } = { clusters: 0, shown: 0, spinStepMax: 0, spinWin: 0, tailAt: 0, via: '' };
/** DEV: every win screen a setTotalWin / wincap asked for (the probes read which spins got one) */
const winAsks: { from: 'setTotalWin' | 'wincap'; gameType: string; amount: number; total: number; alias: string }[] = [];
if (import.meta.env.DEV && typeof window !== 'undefined') {
	Object.assign(((window as any).__manticore ??= {}), { capLog: () => ({ ...capLog, capShown }), winAsks: () => winAsks.slice() });
}

/** how many of this cascade's clusters to present when `wincap` is the next event (null = no cap here) */
const capCut = (bookEvent: BookEventOfType<'cascade'>, bookEvents: BookEvent[]): number | null => {
	const at = bookEvents.indexOf(bookEvent);
	const cap = bookEvents[at + 1];
	if (cap?.type !== 'wincap') return null;
	// the round total before this step: the last setTotalWin (a resumed round keeps it in its snapshot)
	// plus what this spin's earlier steps made (the previous cascade.spinWin since the reveal)
	let running = 0;
	let inSpin = true;
	for (let i = at - 1; i >= 0; i -= 1) {
		const e = bookEvents[i];
		if (e.type === 'cascade' && inSpin) {
			running += e.spinWin;
			inSpin = false;
		} else if (e.type === 'reveal') {
			inSpin = false;
		} else if (e.type === 'setTotalWin') {
			running += e.amount;
			break;
		} else if (e.type === 'createBonusSnapshot') {
			const last = _.findLast(e.bookEvents, (x) => x.type === 'setTotalWin') as BookEventOfType<'setTotalWin'> | undefined;
			running += last?.amount ?? 0;
			break;
		}
	}
	for (let k = 0; k < bookEvent.wins.length; k += 1) {
		running += bookEvent.wins[k].w;
		if (running >= cap.amount) return k + 1;
	}
	return bookEvent.wins.length;
};

/** apply board changes with no motion at all: the SKIP TO RESULT rule (every wait collapses, every step
 *  writes its final state), held only for the microtasks these calls take */
const quietly = async (fn: () => Promise<void>) => {
	const was = stateGame.skipping;
	stateGame.skipping = true;
	try {
		await fn();
	} finally {
		stateGame.skipping = was;
	}
};

/** a FREE SPIN's own win: the book's running spin total after the spin's last cascade (cascade.spinWin).
 *  setTotalWin.amount is the ROUND total there, so it is not the number for a per spin win screen. */
const spinOwnWin = (bookEvent: BookEvent, bookEvents: BookEvent[]): number => {
	for (let i = bookEvents.indexOf(bookEvent) - 1; i >= 0; i -= 1) {
		const e = bookEvents[i];
		if (e.type === 'cascade') return e.spinWin;
		if (e.type === 'reveal' || e.type === 'setTotalWin') break;
	}
	return 0;
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
		// The Mystery marker is event 0 of its book, and a RESUMED round replays only from its last
		// recorded reveal (utils.ts convertTorResumableBet), so the marker is not in `bookEvents`
		// then. The round's own bet mode says it just as well: Authenticate / ResumeBet restore it
		// from round.mode, and a bought Mystery keeps it until finalWin.
		const mysteryEvent = bookEvents.find((e) => e.type === 'mystery') as BookEventOfType<'mystery'> | undefined;
		const isMystery = !!mysteryEvent || stateBet.activeBetModeKey === 'MYSTERY';
		// resetSession cleared the outcome the `mystery` handler had just written (DEV / probe read)
		if (mysteryEvent) stateGame.mysteryOutcome = mysteryEvent.outcome;

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
			// THE CHAIN HAUL IN FREE SPINS (Corey 2026-10-09): a free spin has no press, so its reveal hauls
			// the chain as the press does in the base game (game/actor.ts onNewGameStart). Not while skipping.
			if (CHAIN_BOW.haulOnSpin && !stateGame.skipping) chainHaulPress(Math.max(0.2, stateGameDerived.timeScale()));
		}

		// THE BOOK'S ANTICIPATION ARRAY IS HONOURED IN MYSTERY ONLY (RULE_PASS_2 section D): the
		// Mystery spin-in always lands 3 War Standards in columns 0-2 and teases columns 3-7, and
		// the book writes that tease itself. Every other mode ignores the field and plays the DERIVED
		// tease instead (ANTICIPATION_TEASE: read off this board, presentation only).
		const anticipation = isMystery && bookEvent.gameType === 'basegame' ? bookEvent.anticipation : undefined;

		// each scatter's house landing beat plays at its own landing contact, in landing order
		stateGame.scatterCells = [];
		if (bookEvent.gameType === 'basegame') triggerSfxPlayed = false;
		const rec = fxRecord('reveal', { turbo: stateGame.turboLevel, mystery: isMystery });
		// Corey's reel_spin (2026-10-07): a 1.88 s one-shot as the columns pour in (the Angry Mantis
		// spin LOOP is replaced in the Manticore sprite by tools/build_audiosprite.py MM_EVENTS)
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_reel_spin', forcePlay: true });
		const id = await revealBoard(bookEvent.board, {
			anticipation,
			tease: !isMystery,
			aura: nextCascadeWinners(bookEvent, bookEvents),
			onScatterLand: (cell) => scatterLand(cell, currentRun()),
		});
		fxStamp(rec, 'landed');
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_reel_stop', forcePlay: true });
		if (isMystery && bookEvent.gameType === 'basegame') eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_mystery_decision', forcePlay: true });

		// the derived tease's outcome: a hit plays the trigger pulse (and the house bonus-confirm SFX), a
		// miss rests. A scatter sting run straight after is its own rest (SCATTER_STING.holdMs), so a miss
		// that the stings will complete does not rest twice.
		if (revealTease.teased) {
			rec.info = { ...(rec.info ?? {}), tease: { hit: revealTease.hit, scatters: revealTease.scatters.slice() } };
			const next = bookEvents[bookEvents.indexOf(bookEvent) + 1];
			if (revealTease.hit) await scatterTrigger(stateGame.scatterCells, id, rec, () => playTriggerSfx(bookEvent, bookEvents));
			else if (!(next?.type === 'sting' && next.kind === 'scatter')) await scatterHold(stateGame.scatterCells, ANTICIPATION_TEASE.missHoldMs, { pulse: 0, hz: 1 }, id, rec, 'miss');
			settleBoard();
		}
		fxStamp(rec, 'end');
	},

	// ---- cascade: one step of wins, removal, tiles, refill ---------------------------------------
	// MOTION PASS 1: the clusters present in sequence with overlap (stateGame.presentWinSet), each
	// removing ITS OWN cells (win.c) after its readout. The book's `removed` is ONE list after all the
	// wins, so its order carries no per-cluster meaning: the client plays win.c per cluster, then
	// removes whatever `removed` still lists, and the SET of cells gone before `tiles` / `fill` must
	// equal `removed` exactly (asserted in DEV and by tools/manticore/motion_probe.js). The amounts
	// shown are the book's: win.p (base), win.m (tile sum) and win.w (the cluster's total).
	cascade: async (bookEvent: BookEventOfType<'cascade'>, { bookEvents }: BookEventContext) => {
		const id = newRun();
		// the running spin total: the previous step's spinWin plus each cluster's win as its count-up
		// lands, then SNAPPED to the book's cascade.spinWin at the end of the step (never derived past it)
		let running = stateGame.spinWin;
		// THE PLATES: each removed cell's plate plays its beat changeDelayMs after its symbol has left,
		// counting over to the book's new value where `tiles` lists one (MULT_PLATE)
		const tileMap = new Map(bookEvent.tiles);
		const onCleared = (cell: CellIndex) => plateReveal(cell, tileMap.get(cell) ?? null);
		// THE MAX WIN CUT (see capCut): only the clusters up to the one that reaches the cap are presented
		const cut = capCut(bookEvent, bookEvents);
		const ours = await presentWinSet(
			(cut === null ? bookEvent.wins : bookEvent.wins.slice(0, cut)).map((w) => ({ cells: w.c, base: w.p, mult: w.m, total: w.w, symbol: w.s })),
			id,
			{
				onClusterStart: () => eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_cluster_remove', forcePlay: true }),
				onCountDone: (_i, total) => {
					running += total;
					// the capped step: the book clamps each cluster and the step's spinWin separately, so the running
					// sum is never shown past the book's own spin total
					if (cut !== null) running = Math.min(running, bookEvent.spinWin);
					eventEmitter.broadcast({ type: 'spinWinStep', amount: running });
					if (import.meta.env.DEV) {
						motionLog.steps.push({ amount: running, at: performance.now(), cascade: motionLog.cascadeIndex });
						if (motionLog.steps.length > 400) motionLog.steps.splice(0, 200);
					}
				},
				onCleared,
			},
		);
		const oursSet = new Set(ours);
		const book = new Set(bookEvent.removed);
		const rest = bookEvent.removed.filter((c) => !oursSet.has(c));
		const extra = ours.filter((c) => !book.has(c));
		if (import.meta.env.DEV) {
			motionLog.lastCascade = { ours: ours.length, book: bookEvent.removed.length, rest: rest.length, extra };
			if (extra.length) console.warn('[manticore] win set removed cells the book did not list', extra);
		}
		if (cut !== null) {
			// the cap is reached: no more clears, no tiles beat, no refill motion, no spin total presentation.
			// The rest of the step is owed to the board and lands without motion under the Max Win screen.
			capTail = async () => {
				if (rest.length) await removeCells(rest, id, onCleared);
				await applyTiles(bookEvent.tiles, id);
				await dropFill(bookEvent.fill, id);
				settleBoard();
			};
			stateGame.spinWin = bookEvent.spinWin;
			eventEmitter.broadcast({ type: 'spinWinShow', amount: bookEvent.spinWin });
			if (import.meta.env.DEV) {
				motionLog.cascadeIndex += 1;
				Object.assign(capLog, { clusters: bookEvent.wins.length, shown: cut, spinStepMax: running, spinWin: bookEvent.spinWin, tailAt: 0, via: '' });
			}
			return;
		}
		if (rest.length) await removeCells(rest, id, onCleared);
		// Playback order is fixed by the schema: show the wins, remove `removed`, set `tiles`,
		// drop `fill`. The client never has to reconstruct an intermediate board.
		if (bookEvent.tiles.length) eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_tile_double', forcePlay: true });
		await applyTiles(bookEvent.tiles, id);
		// CLUSTER.refillDelayMs: the plates' count-over plays before the refill lands on them
		await waitStyle(CLUSTER.refillDelayMs);
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_cascade', forcePlay: true });
		await dropFill(bookEvent.fill, id, nextCascadeWinners(bookEvent, bookEvents));

		settleBoard();
		stateGame.spinWin = bookEvent.spinWin;
		if (import.meta.env.DEV) motionLog.cascadeIndex += 1;
		eventEmitter.broadcast({ type: 'spinWinShow', amount: bookEvent.spinWin });
		// the last cascade of the spin: the spin total's final presentation (SPIN_TOTAL), after the refill
		const next = bookEvents[bookEvents.indexOf(bookEvent) + 1];
		if (next?.type !== 'cascade') await eventEmitter.broadcastAsync({ type: 'spinWinFinal', amount: bookEvent.spinWin });
	},

	// ---- swipe: the paw clears a band of three rows (the book's `rows`) ---------------------------
	// SWIPE_FX: the tears rake the band right to left, hold, then fade while the band's symbols leave
	// (scatters survive the paw: they are not in `removed`); the swipe's tiles pop as the symbols
	// start to leave, and the refill drops once they are gone.
	swipe: async (bookEvent: BookEventOfType<'swipe'>, { bookEvents }: BookEventContext) => {
		const id = newRun();
		const rec = fxRecord('swipe', { rows: bookEvent.rows, removed: bookEvent.removed.length, turbo: stateGame.turboLevel, skipping: stateGame.skipping });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_swipe', forcePlay: true });
		eventEmitter.broadcast({ type: 'featureBeat', beat: 'swipe', rows: bookEvent.rows });
		// the plates in the band play their beat once the symbols have faded (exitMs) + changeDelayMs
		const tileMap = new Map(bookEvent.tiles);
		const plates = () => {
			for (const cell of bookEvent.removed) plateReveal(cell, tileMap.get(cell) ?? null, SWIPE_FX.exitMs + MULT_PLATE.changeDelayMs);
		};
		await swipeBand(bookEvent.removed, bookEvent.rows, id, { rec, onExit: plates });
		await applyTiles(bookEvent.tiles, id, SWIPE_FX.exitMs + MULT_PLATE.changeDelayMs);
		fxStamp(rec, 'refill');
		await dropFill(bookEvent.fill, id, nextCascadeWinners(bookEvent, bookEvents));
		settleBoard();
		fxStamp(rec, 'settled');
	},

	// ---- sting: the tail strikes cells in place ---------------------------------------------------
	// Four kinds, one playback each (RULE_PASS_2 section F, STING locked 2026-10-06). `cells -> symbol`
	// is applied exactly as written: the shape is never re-derived from `center`, which is
	// presentation only (where the telegraph and the ripple rings sit).
	sting: async (bookEvent: BookEventOfType<'sting'>, { bookEvents }: BookEventContext) => {
		const id = newRun();
		const { kind, center, cells } = bookEvent;
		const rec = fxRecord('sting', { kind, cells: cells.length, turbo: stateGame.turboLevel, skipping: stateGame.skipping });
		const beat = (phase: 'charge' | 'wait' | 'strike') =>
			eventEmitter.broadcast({ type: 'stingBeat', phase, kind, center, cells });

		if (kind === 'scatter') {
			// SCATTER_STING (locked 2026-10-06 18:29). One event per scatter, in the book's order; how many
			// is the book's, the beat is presentation only. The first holds the resting board (everything but
			// the scatters darkened); each is the normal tail hit, the cell becoming a War Standard with the
			// STANDARD landing ring and the house scatter SFX at the flip; then the ladder's wait (the last
			// waits the next rung), and after the last every scatter pulses together (bonus-confirm SFX).
			const { k, n } = scatterRunOf(bookEvent, bookEvents);
			rec.info = { ...(rec.info ?? {}), k, n };
			const dim = { dimTo: SCATTER_STING.holdDimAlpha, pulse: SCATTER_STING.holdPulse, hz: SCATTER_STING.holdPulseHz };
			if (k === 0) {
				beat('wait');
				await scatterHold(stateGame.scatterCells, SCATTER_STING.holdMs, dim, id, rec, 'hold');
			}
			beat('strike');
			fxStamp(rec, 'strike');
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_scatter_sting', forcePlay: true });
			await stingHit(cells, bookEvent.symbol, { ms: SCATTER_STING.hitMs, popScale: STING.popScale, kind, onHit: () => scatterLand(cells[0], id) }, id, rec);
			settleBoard();
			const wait = scatterWait(k, n);
			if (wait > 0) await scatterHold(stateGame.scatterCells, wait, dim, id, rec, 'wait');
			fxStamp(rec, 'waited');
			if (k === n - 1) await scatterTrigger(stateGame.scatterCells, id, rec, () => playTriggerSfx(bookEvent, bookEvents));
			settleBoard();
			fxStamp(rec, 'end');
			return;
		}

		if (kind === 'big' || kind === 'super') {
			// always the LAST sting of the spin: the board dims, the telegraph breathes at the centre,
			// then the whole plus / block turns wild together and the rings ripple out
			beat('charge');
			eventEmitter.broadcast({ type: 'soundOnce', name: kind === 'super' ? 'sfx_sting_super_charge' : 'sfx_sting_big_charge', forcePlay: true });
			await stingBig(cells, center, bookEvent.symbol, kind, id, {
				rec,
				onStrike: () => {
					beat('strike');
					eventEmitter.broadcast({ type: 'soundOnce', name: kind === 'super' ? 'sfx_sting_super_hit' : 'sfx_sting_big_hit', forcePlay: true });
				},
			});
			settleBoard();
			return;
		}

		// normal: the tail streak, the hit on the one cell. Several fire back to back with a short gap.
		beat('strike');
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_sting_hit', forcePlay: true });
		await stingHit(cells, bookEvent.symbol, { ms: STING.normalMs, popScale: STING.popScale, kind }, id, rec);
		settleBoard();
		const next = bookEvents[bookEvents.indexOf(bookEvent) + 1];
		if (next?.type === 'sting') {
			await waitStyle(STING.gapMs);
			fxStamp(rec, 'gap');
		}
	},

	// ---- roar: every low is blown off the board --------------------------------------------------
	// ROAR_FX (shakeLoose): the roar SFX on the wind-up, every low rattles harder and harder, then
	// they drop off bottom rows first with the board kicking in step; refill after the last is gone.
	roar: async (bookEvent: BookEventOfType<'roar'>, { bookEvents }: BookEventContext) => {
		const id = newRun();
		const rec = fxRecord('roar', { removed: bookEvent.removed.slice(), turbo: stateGame.turboLevel, skipping: stateGame.skipping });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_roar', forcePlay: true });
		eventEmitter.broadcast({ type: 'featureBeat', beat: 'roar', rows: [] });
		await roarBlow(bookEvent.removed, id, rec);
		fxStamp(rec, 'refill');
		// the multiplier tiles under the removed lows are untouched (EVENT_SCHEMA.md)
		await dropFill(bookEvent.fill, id, nextCascadeWinners(bookEvent, bookEvents));
		settleBoard();
		fxStamp(rec, 'settled');
	},

	// ---- feature entry ---------------------------------------------------------------------------
	bonusStart: async (bookEvent: BookEventOfType<'bonusStart'>) => {
		// the feature-entry confirmation sound carries over from Angry Mantis unchanged; a scatter trigger
		// pulse this round has already played it (playTriggerSfx), so it is never heard twice
		if (!triggerSfxPlayed) eventEmitter.broadcast({ type: 'soundOnce', name: BONUS_TRIGGER_SOUND_MAP[bookEvent.bonus] });
		triggerSfxPlayed = false;
		stateGame.bonusMode = bookEvent.bonus;
		stateGame.tileCap = bookEvent.tileCap;
		stateGame.totalFs = bookEvent.totalFs;
		stateGame.fs = 0;
		stateGame.spinsPlayed = 0;
		// a new session has no recap yet (bonusEnd writes it; requestSkip / SkipButton read it as
		// "the spins are over")
		stateGame.sessionRecap = null;
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
			// the animated plaque's intro screen for this mode (components/ModePlaque.svelte)
			intro: { mode: bookEvent.bonus, totalFs: bookEvent.totalFs, tileCap: bookEvent.tileCap },
		});
		await eventEmitter.broadcastAsync({ type: 'uiShow' });
	},

	bonusEnd: async (bookEvent: BookEventOfType<'bonusEnd'>) => {
		// SKIP TO RESULT ends HERE, before anything else: the wrap-up that follows (freeSpinEnd) plays
		// at normal speed exactly as it does unskipped, and its total is the book's own amount
		stateGameDerived.finishSkip();
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
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_mystery_tease', forcePlay: true });
	},

	// ---- core SDK events -------------------------------------------------------------------------
	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>, { bookEvents }: BookEventContext) => {
		stateBet.winBookEventAmount = bookEvent.amount;
		// the round reached the cap (the book's `wincap`): the Max Win screen is the round's one presentation
		// (the wrap up in a feature), so the capping spin gets no win screen of its own
		if (capShown || bookEvent.amount <= 0) return;
		// Presentation only. The book carries no winLevel for a spin (there is no `setWin` in this
		// schema), so the TIER WORD is derived from the amount the book already gave us — the number on
		// screen is always the book's, never ours.
		//   BASE GAME: the amount is setTotalWin's (the round total is the spin's).
		//   A FREE SPIN (Corey 2026-10-09): setTotalWin is the ROUND total there, so the spin's OWN win is read
		//   from the book's cascade.spinWin, and a SKIP TO RESULT plays none of them. The wrap up at the end of
		//   the feature is unchanged.
		//   ONLY BIG AND ABOVE (15x) GETS A WIN SCREEN, everywhere (Corey 2026-10-09: "no Nice win level"): a
		//   smaller win is the board's own run up and nothing more.
		const free = stateGame.gameType !== 'basegame';
		if (free && stateGame.skipping) return;
		const amount = free ? spinOwnWin(bookEvent, bookEvents) : bookEvent.amount;
		if (amount <= 0) return;
		const winLevelData = getWinLevelDataByBookEventAmount({ bookEventAmount: amount });
		if (!winLevelData || winLevelData.type !== 'big') return;
		if (import.meta.env.DEV) winAsks.push({ from: 'setTotalWin', gameType: stateGame.gameType, amount, total: bookEvent.amount, alias: winLevelData.alias });
		eventEmitter.broadcast({ type: 'winShow' });
		winLevelSoundsPlay({ winLevelData });
		await eventEmitter.broadcastAsync({ type: 'winUpdate', amount, winLevelData });
		winLevelSoundsStop();
		eventEmitter.broadcast({ type: 'winHide' });
	},

	wincap: async (bookEvent: BookEventOfType<'wincap'>, { bookEvents }: BookEventContext) => {
		// a skip never swallows the max win: clear it FIRST so the cap presentation plays in full.
		stateGameDerived.finishSkip();
		stateBet.winBookEventAmount = bookEvent.amount;
		capShown = true;
		eventEmitter.broadcast({ type: 'spinWinHide' });
		// IN A FEATURE (Corey 2026-10-09: "Max win should go directly to the wrap up screen, and we should show
		// Max Win instead of Total Win"): nothing is presented here. The book goes on to setTotalWin, bonusEnd
		// and freeSpinEnd, whose wrap up is the MAX WIN one; what the cut step still owes the board lands under
		// that plaque's entrance (freeSpinEnd).
		if (bookEvents.slice(bookEvents.indexOf(bookEvent) + 1).some((e) => e.type === 'freeSpinEnd')) return;
		// THE BASE GAME SAFETY NET (no wrap up exists there; no such book is known): the count up to the cap on
		// the win plaque (the book's wincap.amount, the Max tier, the house 7 s pacing; each tier's clip plays
		// as it lands, sfx_win_max last), the owed board changes landing under its slam.
		const winLevelData = winLevelMap[10];
		if (import.meta.env.DEV) {
			winAsks.push({ from: 'wincap', gameType: stateGame.gameType, amount: bookEvent.amount, total: bookEvent.amount, alias: winLevelData.alias });
			capLog.via = 'win';
		}
		eventEmitter.broadcast({ type: 'winShow' });
		winLevelSoundsPlay({ winLevelData });
		const shown = eventEmitter.broadcastAsync({ type: 'winUpdate', amount: bookEvent.amount, winLevelData });
		// under the plaque's slam (its scene dim is in by then), never before it
		if (capTail) await waitForTimeout(STINGER_PLAQUE.enterMs);
		await landCapTail();
		await shown;
		winLevelSoundsStop();
		eventEmitter.broadcast({ type: 'winHide' });
	},

	freeSpinEnd: async (bookEvent: BookEventOfType<'freeSpinEnd'>) => {
		const winLevelData = winLevelMap[bookEvent.winLevel as WinLevel];
		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		stateGame.gameType = 'basegame';
		eventEmitter.broadcast({ type: 'spinWinHide' });
		// A CAPPED ROUND (the book's `wincap` came before this): the wrap up is the MAX WIN screen. Same plaque,
		// same line and gate, titled with the win ladder's words instead of TOTAL WIN and counting the book's
		// amount through Big / Super / Mega / Epic to Max on the house 7 s pacing (components/FreeSpinOutro.svelte).
		// What the cut cascade step still owes the board lands with no motion under the plaque's entrance.
		const capped = capShown;
		winLevelSoundsPlay({ winLevelData });
		await eventEmitter.broadcastAsync({ type: 'freeSpinOutroShow' });
		const counted = eventEmitter.broadcastAsync({ type: 'freeSpinOutroCountUp', amount: bookEvent.amount, winLevelData, capped });
		if (capped) {
			if (import.meta.env.DEV) capLog.via = 'wrap';
			if (capTail) await waitForTimeout(STINGER_PLAQUE.enterMs);
			await landCapTail();
		}
		await counted;
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
		// the round's Max Win bookkeeping ends with the round (a cut step nothing landed is landed here, so the
		// board is the book's whatever path the round took)
		await landCapTail();
		capShown = false;
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
