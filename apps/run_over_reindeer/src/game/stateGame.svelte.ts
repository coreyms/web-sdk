// The game's own session state. Small on purpose in the first pass: the board's picture lives in the road board
// (game/road/roadBoard.ts), which components/Board.svelte owns; this file holds what the HUD, the sound layer and
// the book event handlers share.
//
// Outcomes only ever come from book events (game/bookEventHandlerMap.ts). Nothing here computes a result.
import { stateBetDerived, stateConfig } from 'state-shared';

import { ROAD_MOTION, motionFor } from './constants';
import type { Board, GameType } from './types';

/** the board shown before the first spin: every symbol, one sleigh, one present, and no line of three from the left */
export const LANDING_BOARD: Board = [
	['L5', 'H4', 'L2', 'H3'],
	['H2', 'L3', 'W', 'L1'],
	['L4', 'H1', 'L5', 'H2'],
	['H3', 'L1', 'S', 'L3'],
	['L2', 'H4', 'L4', 'H1'],
];

/** the bonus round's two cards. Amounts are book amounts (cents of the bet). */
export type RoundCard =
	| { kind: 'intro'; bonus: 'bonus' | 'super'; spins: number; board?: boolean; presents?: number }
	| { kind: 'outro'; bonus: 'bonus' | 'super'; amount: number; capped: boolean; board?: boolean };
// (board: the card plays on the LED back board, game/scoreboard/; the HTML card keeps its press and draws nothing;
// presents: the scatters the round triggered with, the book's freeSpinTrigger cells, for the LED entry)

/** a configured autoplay run waiting on the spin button (built in AutoplayModal, consumed on start) */
export type AutoLoadout = {
	count: number; // Infinity allowed
	lossMult: number | null;
	winMult: number | null;
	stopFree: boolean;
	autoBonuses: boolean;
};

export const stateGame = $state({
	gameType: 'basegame' as GameType,
	/** the board as the last book left it (the road board draws it; this copy is for the dev hook and the resume) */
	board: LANDING_BOARD.map((reel) => [...reel]) as Board,
	/** a round is being presented */
	busy: false,
	/** THE ROUND'S TAIL (ui/controls.svelte.ts): the round's finalWin has played (the board is settled, its presentation
	 *  is over), from then until the next round's press. The round machine may still be finishing (the strip's count, the
	 *  end-round); the Spin key reads Spin meanwhile */
	roundSettled: false,
	/** free spins: the round's length and how many spins are done (the book's fs / totalFs) */
	totalFs: 0,
	spinsPlayed: 0,
	/** which bonus round is running */
	bonusMode: null as null | 'bonus' | 'super',
	/** the bonus round's card that is up now (ui/RoundCard.svelte draws it), null when none is */
	roundCard: null as null | RoundCard,
	/** the round reached the 7,777x cap (the wrap-up card says so) */
	capped: false,
	scatterCounter: 0,

	// ---- the house HUD's fields (ui/controls.svelte.ts), as in Manticore Mayhem ----
	/** the live turbo level: 0 off, 1 turbo, 2 instant */
	turboLevel: 0 as 0 | 1 | 2,
	/** the level the player chose in the base game (remembered between sessions; a bonus runs at its own) */
	baseTurboLevel: 0 as 0 | 1 | 2,
	/** a slam stop: the rest of the live spin runs faster (speed only). 0 = none */
	hurryLevel: 0 as 0 | 1 | 2,
	/** an open round is waiting to be resumed after a reload: nothing may start a round until it is handed over */
	resumeHold: true,
	autoLoadout: null as AutoLoadout | null,
	autoStopOnFreeGames: true,
	autoPlayBonuses: false,
	/** how many press-to-continue screens are up (Space belongs to them): the bonus round's cards */
	pressGates: 0,
	/** THE HUD UNDER THE BONUS ROUND'S CARDS (2026-11-20, Manticore Unleashed's rule, its harsh review 2026-11-17 m8): set by
	 *  game/bookEventHandlerMap.ts showCard around its uiHide .. uiShow (the entry and the wrap-up). While it is set a plain
	 *  uiHide keeps the HUD on screen, inert (ui/Chrome.svelte hud-held: no pointer, no focus, the press still reaches the
	 *  card's catch), BALANCE and WIN readable. finalWin clears it */
	hudHeld: false,
	/** a win screen is up (none in the first pass: line wins show on the board itself) */
	winShowing: false,
	/** a mode plaque is up (none in the first pass) */
	plaque: null as null | { title: string; sub: string },
	/** SKIP TO RESULT is running (2026-11-19, components/SkipButton.svelte: set by requestSkip, cleared by game/utils.ts
	 *  playBet once the round's final board is up, before the wrap-up; while it is set the per-spin sounds are dropped,
	 *  components/Sound.svelte, and the road's own, components/Board.svelte) */
	skipping: false,
	/** this round's SKIP TO RESULT has been taken (2026-11-19, the probe host: the button came back for about 120 ms
	 *  between the cut and the wrap-up, and a second Yes left `skipping` set through the next base spin): set with
	 *  `skipping` by requestSkip, it keeps the button down and refuses another skip until the round is over (cleared at
	 *  the round's finalWin and at the start of the next round's book, game/utils.ts playBet) */
	skipTaken: false,
	/** this bonus round's first free spin has begun (its reveal): SKIP TO RESULT is offered from then on (Manticore's fs >= 1;
	 *  so never during the entry card or the Super wheel, which play before it) */
	fsStarted: false,
	/** this feature round has had its one scatter tease (constants LANE_FLOW tease.oncePerFeature) */
	featureTeased: false,
	/** THE SUPER WHEEL (game/road/superWheel.ts) is up, and what it is doing; 'rest': it waits for the Spin press */
	wheelPhase: null as null | string,
	/** where the wheel stands, canvas CSS px (components/Board.svelte sets it on every layout pass; ui/WheelGate.svelte) */
	wheelBox: null as null | { cx: number; cy: number; d: number },
	/** the Grandma strikes so far in this bonus round (the Grandma gag plays on the first, later only on a paying spin) */
	bonusGrandmaStrikes: 0,
});

/** the board clock's rate right now: the turbo level's own rate, times the hurry of a slam stop */
export const boardRate = (): number => {
	const rate = motionFor(stateGame.turboLevel).rate * (stateGame.hurryLevel > 0 ? ROAD_MOTION.hurryRate : 1);
	return Math.min(ROAD_MOTION.maxRate, Math.max(0.2, rate));
};

/** the ONE way to change the live turbo level */
const setTurboLevel = (level: 0 | 1 | 2) => {
	stateGame.turboLevel = level;
	stateBetDerived.updateIsTurbo(level > 0, { persistent: true });
};

/** STAKE'S JURISDICTION SWITCHES (Manticore Mayhem's rule): with disabledSlamstop or disabledTurbo there is no SKIP TO
 *  RESULT at all (nothing of it is drawn, and the game info's guide does not name it) */
export const skipAllowed = (): boolean => !stateConfig.jurisdiction?.disabledSlamstop && !stateConfig.jurisdiction?.disabledTurbo;
/** a bonus round's spins are playing (from its first free spin's reveal to its wrap-up) */
export const featureSpinsLive = (): boolean => stateGame.gameType === 'freegame' && stateGame.fsStarted;
/** SKIP TO RESULT asked (components/SkipButton.svelte's Yes): the spin in play finishes, the rest of the round's spins are
 *  not shown, the round's final board and its wrap-up follow (game/utils.ts playBet). True when it took. */
const requestSkip = (): boolean => {
	if (!skipAllowed() || !featureSpinsLive() || stateGame.skipping || stateGame.skipTaken) return false;
	stateGame.skipping = true;
	stateGame.skipTaken = true;
	return true;
};

export const stateGameDerived = {
	setTurboLevel,
	boardRate,
	requestSkip,
};
