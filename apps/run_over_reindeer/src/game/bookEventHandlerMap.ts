// THE ONE PLACE A ROUND IS PLAYED: one handler per book event type, called in book order (utils-book).
// The frontend never computes an outcome. A handler shows what its event says and nothing else: which cell was
// struck, which tier stepped out, which multiplier, what a line paid, what a top-up added.
// Contract: math-sdk/games/run_over_reindeer/EVENT_SCHEMA.md, version 2026-11-15a (2026-11-10a plus winInfo capped, the clear path rule and the bought Super's floor).
import { strikePlace } from './strikeOrder';
import { stateBet, stateBetDerived } from 'state-shared';
import { bookEventAmountToBetAmountMultiplier, bookEventAmountToCurrencyString } from 'utils-shared/amount';
import { waitForTimeout } from 'utils-shared/wait';
import type { BookEventHandlerMap } from 'utils-book';

import { eventEmitter } from './eventEmitter';
import { LED_BOARD, LINE_WIN, REINDEER_SOUND, ROUND, SUPER_WHEEL } from './constants';
import { wheelPlanFor } from './superWheelPlan';
import config from './config';
import type { SoundEffectName } from './sound';
import { setHudWin } from './hudWin.svelte';
import { ledCountDone, playBookEvent } from './utils';
import { boardRate, stateGame, type RoundCard } from './stateGame.svelte';
import { sceneHooks, stateScene } from './stateScene.svelte';
import { presetForMode } from './scenePresets';
import { loadClip } from './road/columnClips';
import { presentWheelDone } from './road/present';
import type { Board } from './types';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';
import { bonusEntered, bonusLeft } from './bonusStockRules';

const ROWS = 4;

/** DEV: a moment into the road's sound log (the sound probe: the music's hand-over, against the road's ambience) */
const devMark = (what: string, detail?: string) => {
	if (import.meta.env.DEV) (globalThis as unknown as { __reindeer?: { markMoment?: (what: string, detail?: string) => void } }).__reindeer?.markMoment?.(what, detail);
};

/** Skip to Result (the resume card): the longest wait for the standing columns' pictures before the final board goes up */
const SKIP_CLIP_WAIT_MS = 2500;
/** ...and how long a skipped base round shows its win before its end (the HUD's WIN counts in 0.55 s, ui/controls) */
const SKIP_SHOW_MS = 600;

/** a pause on the road's own pace: shorter at turbo, shorter still under a slam stop */
const pace = (ms: number) => waitForTimeout(Math.max(1, ms / boardRate()));

/** put one of the bonus round's cards up and wait for it to be dismissed (ui/RoundCard.svelte resolves it) */
let cardDone: (() => void) | null = null;
const showCard = async (card: RoundCard) => {
	eventEmitter.broadcast({ type: 'uiHide' });
	// THE CARD ON THE LED BACK BOARD (constants LED_BOARD.cards, part B): the Free Spins entry, the Super entry and the Total
	// Win play as the board's staged scenes, with the press line on the strip; the HTML card keeps the press, its timers and
	// its sounds and draws nothing. Since 2026-11-17 a wrap-up that says a top-up or the cap plays on the board too, its line
	// scrolled on the strip (Corey: "the Wrap up total was shown on the plain old card, not the billboard": his round was
	// one of these, the only wrap-ups that kept the HTML card)
	const board = LED_BOARD.on && LED_BOARD.cards === 'board';
	if (board)
		eventEmitter.broadcast(
			card.kind === 'intro'
				? { type: 'boardScoreboardCard', kind: card.bonus === 'super' ? 'sfs' : 'fs', spins: card.spins, amount: 0 }
				: { type: 'boardScoreboardCard', kind: 'total', spins: 0, amount: card.amount, topUp: card.topUp ?? null, capped: !!card.capped },
		);
	stateGame.roundCard = board ? { ...card, board: true } : card;
	await new Promise<void>((resolve) => (cardDone = resolve));
	stateGame.roundCard = null;
	if (board) eventEmitter.broadcast({ type: 'boardScoreboardCardEnd' });
	eventEmitter.broadcast({ type: 'uiShow' });
};
/** ui/RoundCard.svelte: the card was pressed, or its time ran out */
export const dismissRoundCard = () => {
	const done = cardDone;
	cardDone = null;
	done?.();
};

/** SUPER'S OPENING COLUMN HAS JUST LANDED (Corey 2026-11-18: "once it lands on the board the first spin should start"):
 *  the first free spin's reveal takes it and skips the pause between two free spins */
let openingLanded = false;

/** the spin of the event at `from` pays: its own winInfo (between `from` and the next reveal) awards more than zero */
const spinPays = (bookEvents: BookEvent[], from: number): boolean => {
	for (let i = from + 1; i < bookEvents.length; i++) {
		const e = bookEvents[i];
		if (e.type === 'reveal') return false;
		if (e.type === 'winInfo') return e.totalWin > 0;
	}
	return false;
};

/** the feature trigger's own state, with nothing shown (a live trigger, and a resumed round's rebuild) */
const enterBonus = (bookEvent: BookEventOfType<'freeSpinTrigger'>) => {
	stateGame.bonusMode = bookEvent.bonusType === 'super' ? 'super' : 'bonus';
	stateGame.gameType = 'freegame';
	stateGame.totalFs = bookEvent.totalFs;
	stateGame.spinsPlayed = 0;
	stateGame.topUp = null;
	stateGame.capped = false;
	stateGame.featureTeased = false;
	stateGame.bonusGrandmaStrikes = 0;
	stateGame.fsStarted = false;
	// THE STOCK RULES (game/bonusStockRules.ts): every bonus round starts at regular speed (a live trigger, a bought round
	// and a resumed one all come through here), and autoplay's Stop on Free Games ends the run with this round
	bonusEntered();
	eventEmitter.broadcast({ type: 'soundMusic', name: stateGame.bonusMode === 'super' ? 'bgm_super' : 'bgm_bonus' });
	devMark('music', stateGame.bonusMode === 'super' ? 'bgm_super' : 'bgm_bonus');
};

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: async (bookEvent: BookEventOfType<'reveal'>, context: BookEventContext) => {
		// THE SCENE SWAP (game/scene/sceneSwap.ts): a base spin whose book holds a trigger starts loading its night scene now,
		// so it is in by the time the entry scene's back board is seated (nothing waits on it)
		if (bookEvent.gameType === 'basegame') {
			const trigger = (context?.bookEvents ?? []).find((e) => e.type === 'freeSpinTrigger');
			if (trigger && trigger.type === 'freeSpinTrigger') sceneHooks.prefetch(presetForMode(trigger.bonusType === 'super' ? 'super' : 'bonus', stateScene.set));
		}
		// A SLAM STOP HURRIES ITS OWN SPIN ONLY (2026-11-17, Corey: "if you click on the board during free spins, or super
		// free spins all of the free spins are speed up, instead of the current spin only"). The slam (ui/controls.svelte.ts
		// stopButtonClick) sets the hurry and takes the stop for the rest of the round, and only the round's end
		// (utils.ts playBet: stopButtonEnable) gave them back; a bonus round is one round, so a slam in one free spin
		// hurried every free spin after it and no later press could slam again. Each free spin's start now ends the spin
		// before's slam the same way (the hurry off, the stop open again); the player's Turbo setting and autoplay are
		// not touched (stopButtonEnable resets only the slam's own non-persistent flag).
		if (bookEvent.gameType === 'freegame') eventEmitter.broadcast({ type: 'stopButtonEnable' });
		stateGame.gameType = bookEvent.gameType;
		// SKIP TO RESULT is offered from the first free spin on (components/SkipButton.svelte)
		if (bookEvent.gameType === 'freegame') stateGame.fsStarted = true;
		if (bookEvent.fs !== undefined) stateGame.spinsPlayed = Math.max(0, bookEvent.fs - 1);
		if (bookEvent.totalFs !== undefined) stateGame.totalFs = bookEvent.totalFs;
		const board = bookEvent.board.map((reel) => [...reel]) as Board;
		stateGame.board = board;
		// (no pause before the first free spin of a Super round: its opening column has just landed, openingLanded)
		if (bookEvent.gameType === 'freegame' && !openingLanded) await pace(ROUND.betweenSpinsMs);
		openingLanded = false;
		// the sticky columns this spin starts with, exactly as the book lists them; every cloud cell and every column
		// that is not held leaves here (a replay or a resume builds its columns from this list alone)
		eventEmitter.broadcast({ type: 'boardHeld', held: bookEvent.held ?? [] });
		// the traffic spin: resolves when every symbol has settled on its mark
		await eventEmitter.broadcastAsync({ type: 'boardDriveIn', board });
	},

	// ---- the reindeer strike ----
	// Played in the book's order, never sorted here: the book writes the Grandma strikes first, then the Santa strikes,
	// each left to right. Nothing on the board depends on that order (the columns draw reel 1 on top whatever order
	// they arrive in), so a book in any order would still show correctly.
	strike: async (bookEvent: BookEventOfType<'strike'>, { bookEvents }: BookEventContext) => {
		// a Santa strike's column comes next: its entrance pictures may have been let go since the last one of its tier
		const next = bookEvents[bookEvents.indexOf(bookEvent) + 1];
		const column = next?.type === 'columnWild' && next.reel === bookEvent.reel ? next : null;
		if (column) void loadClip(column.tier, 'reveal');
		// a Grandma car in the struck Santa reel is not struck: she gets a red box as the reindeer comes down, and the
		// column then grows over it (Corey 2026-11-10). A Grandma already Wild has her own box already.
		const markCell = column?.grandma && !column.grandma.wasWild ? column.grandma.cell : null;
		// THE ROAMING REINDEER (constants STRIKE.roam): the first strike of the spin (since its reveal) is his, and a new one
		// walks in after the last. Presentation only: which reindeer runs never changes what the book says.
		const { first, last } = strikePlace(bookEvents, bookEvents.indexOf(bookEvent));
		// THE GRANDMA GAG'S RULE (constants LED_BOARD.gag; Corey 2026-11-17: "let's only do the Grandma Got Run Over by a
		// Reindeer in regular games, and free spins only on the first strike or when it results in a win"): a Grandma strike
		// in the base game always; in a bonus round only its first Grandma strike, or a later one whose spin pays (the
		// spin's own winInfo in the book, totalWin above zero; nothing is worked out here)
		const struck = stateGame.board[Math.floor(bookEvent.cell / ROWS)]?.[bookEvent.cell % ROWS];
		let gag = false;
		if (struck === 'H1') {
			if (stateGame.gameType !== 'freegame') gag = true;
			else {
				const firstGrandma = stateGame.bonusGrandmaStrikes === 0;
				stateGame.bonusGrandmaStrikes += 1;
				gag = firstGrandma || spinPays(bookEvents, bookEvents.indexOf(bookEvent));
			}
			devMark('grandmaStrike', `${stateGame.gameType} cell ${bookEvent.cell} strike ${stateGame.bonusGrandmaStrikes} gag ${gag}`);
		}
		// (BRAWL: a Grandma car's strike ends at the car's rear and lands the brawl cloud, game/road/brawlCloud.ts)
		await eventEmitter.broadcastAsync({ type: 'boardStrike', strike: { cell: bookEvent.cell, markCell, first, last, grandma: struck === 'H1' }, gag });
	},
	grandmaWild: async (bookEvent: BookEventOfType<'grandmaWild'>) => {
		await eventEmitter.broadcastAsync({ type: 'boardGrandmaWild', cell: bookEvent.cell, multiplier: bookEvent.multiplier });
	},
	columnWild: async (bookEvent: BookEventOfType<'columnWild'>, { bookEvents }: BookEventContext) => {
		// the cell the box grows from is the strike's target (the event before); Super's opening column has none
		const before = bookEvents[bookEvents.indexOf(bookEvent) - 1];
		const fromCell = !bookEvent.start && before?.type === 'strike' && Math.floor(before.cell / ROWS) === bookEvent.reel ? before.cell : null;
		// THE SUPER WHEEL (constants SUPER_WHEEL, game/road/superWheel.ts): the round's opening column is first shown by the
		// wheel, which stops on this event's own character, multiplier and reel (the plan holds them; every other wedge is
		// made from the round's own events, game/superWheelPlan.ts). The trigger board drives out under it, so the column
		// then grows on an empty road. Presentation only; SKIP TO RESULT never comes here (its book has no opening event).
		if (bookEvent.start === true && SUPER_WHEEL.on && !stateGame.skipping) {
			const plan = wheelPlanFor(bookEvents, bookEvent);
			devMark('wheel', plan ? `${plan.real.tier} ${plan.real.m}x reel ${plan.real.reel} seed ${plan.seed.toString(16)}` : 'no plan');
			if (plan) await eventEmitter.broadcastAsync({ type: 'boardSuperWheel', plan });
		}
		// THE RED PRESENT'S SHEETS were kept past the trigger for the wheel (game/road/present.ts): whatever happened above
		// (the wheel played, could not play, is switched off, or the round has no plan), they are not needed past here
		if (bookEvent.start === true) presentWheelDone();
		await eventEmitter.broadcastAsync({
			type: 'boardColumnWild',
			reel: bookEvent.reel,
			tier: bookEvent.tier,
			multiplier: bookEvent.multiplier,
			sticky: bookEvent.sticky,
			fromCell,
			// a Grandma Wild already standing in the reel adds her multiplier: the number shows the column's own first,
			// then the sum (`multiplier` already holds it). Never happens under variant F.
			joinAdd: bookEvent.grandma?.wasWild ? bookEvent.grandma.add : 0,
		});
		if (bookEvent.start === true) {
			openingLanded = true;
			devMark('openingLanded', `reel ${bookEvent.reel}`);
		}
	},

	winInfo: async (bookEvent: BookEventOfType<'winInfo'>) => {
		if (!bookEvent.wins.length) return;
		await waitForTimeout(LINE_WIN.leadInMs);
		// THE LINE WIN'S SOUND (constants REINDEER_SOUND winBySymbol, round 2): ONE symbol sound for the whole win, as the
		// one borrowed sfx_cluster_remove before it, the best paying symbol among the lines (W pays as Grandma's car), and
		// the line show under it, on the frame the lines show (boardWinShow, just below, in this same tick)
		const rank = (symbol: string) => {
			const i = (config.payOrder as readonly string[]).indexOf(symbol === 'W' ? 'H1' : symbol);
			return i < 0 ? Infinity : i;
		};
		const best = bookEvent.wins.reduce((a, w) => (rank(w.symbol) < rank(a) ? w.symbol : a), bookEvent.wins[0].symbol as string);
		const symbolSound = REINDEER_SOUND.winBySymbol[best];
		if (symbolSound) eventEmitter.broadcast({ type: 'soundOnce', name: symbolSound as SoundEffectName });
		// (sfx_line_show: once per line as it lights since round 3, the road's own cue, game/road/roadBoard.ts)
		// the HUD's WIN counts up to the spin's amount while the lines show (the base game's round total is the spin's;
		// a free spin's running total arrives with setTotalWin)
		if (stateGame.gameType === 'basegame') setHudWin(bookEvent.totalWin);
		// the multiplier shown over the amount is the book's own, the highest among the winning lines
		const multiplier = bookEvent.wins.reduce((most, win) => Math.max(most, win.multiplier), 1);
		// THE LED SCOREBOARD (game/scoreboard/, constants LED_BOARD): a base game spin's win of the Big bar (15x) or more is
		// counted on the strip, or on the back board from Mega up, AFTER its lines, and the round waits for it (a press lands
		// the count, a second ends the hold). Anything smaller, and every free spin's win, is the strip's small message: WIN
		// and the amount, started with the lines and never waited for (the bonus round's total is the wrap-up card's).
		const big = stateGame.gameType === 'basegame' && bookEventAmountToBetAmountMultiplier(bookEvent.totalWin) >= LED_BOARD.tiers[0].bar;
		// (LINE WINS, TREATMENT B, constants LINE_WIN slam: the small win's strip total comes when the lines say it is due,
		// boardWinShow's stripTotal below; the old way it starts with the lines)
		if (!big && !LINE_WIN.slam.on) eventEmitter.broadcast({ type: 'boardScoreboardWin', amount: bookEvent.totalWin, small: true });
		// THE CHRISTMAS LIGHTS (constants LINE_WIN lights): each line lights in the book's order with its own amount (the
		// book's line pay), then the total. On the spin that reaches the cap (capped: the book's totalWin is what is
		// awarded, less than the lines' pays) no line's own amount shows: only the total, the awarded amount.
		// TREATMENT B (constants LINE_WIN slam): each line's plain amount is its paytable win, the book's win over the line's
		// own multiplier; the line's win shown after the slam is the book's own
		await eventEmitter.broadcastAsync({
			type: 'boardWinShow',
			wins: bookEvent.wins.map((win) => ({ cells: win.cells, line: win.line, symbol: win.symbol, amountText: bookEventAmountToCurrencyString(win.win), plainText: bookEventAmountToCurrencyString(win.win / Math.max(1, win.multiplier)), multiplier: win.multiplier })),
			amountText: bookEventAmountToCurrencyString(bookEvent.totalWin),
			multiplier,
			capped: bookEvent.capped === true,
			stripTotal: !big && LINE_WIN.slam.on ? bookEvent.totalWin : null,
			big,
		});
		eventEmitter.broadcast({ type: 'boardWinClear' });
		if (big) await eventEmitter.broadcastAsync({ type: 'boardScoreboardWin', amount: bookEvent.totalWin });
	},

	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		setHudWin(bookEvent.amount);
	},

	// ---- the bonus rounds ----
	freeSpinTrigger: async (bookEvent: BookEventOfType<'freeSpinTrigger'>) => {
		openingLanded = false;
		// the marimba family's success (2026-11-17), one sound for Free Spins and Super Free Spins, where the tier fanfares played
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_scatter_success' });
		await eventEmitter.broadcastAsync({ type: 'boardPulse', cells: bookEvent.cells, ms: ROUND.triggerPulseMs });
		enterBonus(bookEvent);
		await showCard({ kind: 'intro', bonus: stateGame.bonusMode ?? 'bonus', spins: bookEvent.totalFs });
	},
	freeSpinRetrigger: async (bookEvent: BookEventOfType<'freeSpinRetrigger'>) => {
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_scatter_success' });
		await eventEmitter.broadcastAsync({ type: 'boardPulse', cells: bookEvent.cells, ms: ROUND.triggerPulseMs * 0.6 });
		stateGame.totalFs = bookEvent.totalFs;
		await eventEmitter.broadcastAsync({ type: 'boardMessage', text: `+${bookEvent.added} FREE SPINS`, ms: ROUND.retriggerMs });
	},
	floorTopUp: async (bookEvent: BookEventOfType<'floorTopUp'>) => {
		// said plainly on the wrap-up card as part of the final win; the HUD's WIN takes it with the setTotalWin after
		stateGame.topUp = { floor: bookEvent.floor, featureWin: bookEvent.featureWin, amount: bookEvent.amount };
	},
	wincap: async () => {
		stateGame.capped = true;
	},
	freeSpinEnd: async (bookEvent: BookEventOfType<'freeSpinEnd'>, { bookEvents }: BookEventContext) => {
		// the book writes wincap AFTER freeSpinEnd: the card needs to know now
		const after = bookEvents.slice(bookEvents.indexOf(bookEvent) + 1);
		const capped = stateGame.capped || after.some((e) => e.type === 'wincap');
		// THE WRAP-UP'S TOTAL IS THE ROUND'S (2026-11-17, the owner: the board read 45.20 while the HUD's WIN read 45.70):
		// the book's own round total, finalWin (the trigger spin's win with the free spins', the figure the HUD's WIN ends
		// on), not freeSpinEnd's (the free spins alone). Read from the book, never added up here; a book without a finalWin
		// after this event keeps freeSpinEnd's.
		const fin = after.find((e) => e.type === 'finalWin');
		// the last board alone for a beat before the Total Win: 350 ms on the road's pace; after a SKIP TO RESULT 350 ms of real
		// time (Manticore's FEATURE_PACING.beforeWrapMs: the skip's slam hurry made the paced beat about 120 ms)
		await (stateGame.skipTaken ? waitForTimeout(350) : pace(350));
		await showCard({
			kind: 'outro',
			bonus: stateGame.bonusMode ?? 'bonus',
			amount: fin && fin.type === 'finalWin' ? fin.amount : bookEvent.amount,
			topUp: stateGame.topUp ? { floor: stateGame.topUp.floor, amount: stateGame.topUp.amount } : null,
			capped,
		});
		stateGame.gameType = 'basegame';
		stateGame.bonusMode = null;
		stateGame.totalFs = 0;
		stateGame.spinsPlayed = 0;
		stateGame.topUp = null;
		stateGame.featureTeased = false;
		stateGame.bonusGrandmaStrikes = 0;
		stateGame.fsStarted = false;
		// THE STOCK RULES (game/bonusStockRules.ts): the wrap-up is cleared, the base game's own speed comes back, and a
		// running autoplay owes its pause before the next spin
		bonusLeft();
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_base' });
		devMark('music', 'bgm_base');
	},

	finalWin: async (bookEvent: BookEventOfType<'finalWin'>) => {
		// finalWin is the LAST event of every book. A bought feature plays ONE round: back to the base game, so the
		// next feature round is a fresh choice and a fresh confirmation (Stake review rule, as in the other games).
		if (stateBetDerived.activeBetMode()?.type === 'buy') stateBet.activeBetModeKey = 'BASE';
		// SKIP TO RESULT ends with its round, whatever path set it (a stuck flag would hurry the next round)
		stateGame.skipping = false;
		stateGame.skipTaken = false;
		setHudWin(bookEvent.amount);
		stateGame.capped = false;
		stateGame.busy = false;
	},

	// frontend-only (the resume card's SKIP TO RESULT, game/resumeRound.svelte.ts): the round's final board at once, with
	// no strike, no line show, no sound of the steps skipped. The board snaps to the last spin's board with every column
	// standing at the round's end drawn still (boardHeld: the same draw a resume uses), the spin counter at its end, WIN at
	// the round's total so far; a base game round's win is said on the strip's small message. The book's own end events
	// follow (the Total Win card of a bonus round, finalWin), and the resume machine sends the end-round once.
	skipToResult: async (bookEvent: BookEventOfType<'skipToResult'>) => {
		stateGame.gameType = bookEvent.gameType;
		if (bookEvent.totalFs !== undefined) stateGame.totalFs = bookEvent.totalFs;
		if (bookEvent.fs !== undefined) stateGame.spinsPlayed = bookEvent.fs;
		// the standing columns' characters first (their idle pictures, at most SKIP_CLIP_WAIT_MS): a column drawn before its
		// pictures are in shows its smoke alone until they land
		await Promise.race([Promise.all(bookEvent.columns.map((c) => loadClip(c.tier, 'idle'))), waitForTimeout(SKIP_CLIP_WAIT_MS)]);
		if (bookEvent.board.length) {
			const board = bookEvent.board.map((reel) => [...reel]) as Board;
			stateGame.board = board;
			eventEmitter.broadcast({ type: 'boardSnap', board });
		}
		eventEmitter.broadcast({ type: 'boardHeld', held: bookEvent.columns });
		setHudWin(bookEvent.winSoFar);
		if (bookEvent.gameType === 'basegame' && bookEvent.winSoFar > 0) {
			eventEmitter.broadcast({ type: 'boardScoreboardWin', amount: bookEvent.winSoFar, small: true });
			// THE RESULT BEFORE THE SETTLE (2026-11-18, the probe host: the balance jumped, then WIN counted up): a base round's
			// end-round follows its finalWin at once, so the HUD's WIN count (0.55 s) and the strip's count land first
			await waitForTimeout(SKIP_SHOW_MS);
			await ledCountDone();
		}
		devMark('skipToResult', `${bookEvent.gameType} ${bookEvent.columns.length} columns`);
	},

	// frontend-only (resume): rebuild the session state an interrupted round had reached, with nothing shown. The
	// sticky columns are NOT rebuilt here: the next reveal's `held` list draws them.
	createBonusSnapshot: async (bookEvent: BookEventOfType<'createBonusSnapshot'>) => {
		const { bookEvents } = bookEvent;
		const trigger = bookEvents.find((e) => e.type === 'freeSpinTrigger');
		if (trigger && trigger.type === 'freeSpinTrigger') enterBonus(trigger);
		const last = [...bookEvents].reverse().find((e) => e.type === 'setTotalWin');
		if (last) await playBookEvent(last, { bookEvents });
	},
};
