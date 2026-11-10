// The game's own session state. Small on purpose in the first pass: the board's picture lives in the road board
// (game/road/roadBoard.ts), which components/Board.svelte owns; this file holds what the HUD, the sound layer and
// the book event handlers share.
//
// Outcomes only ever come from book events (game/bookEventHandlerMap.ts). Nothing here computes a result.
import { stateBetDerived } from 'state-shared';

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
	| { kind: 'intro'; bonus: 'bonus' | 'super'; spins: number }
	| { kind: 'outro'; bonus: 'bonus' | 'super'; amount: number; topUp: null | { floor: number; amount: number }; capped: boolean };

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
	/** free spins: the round's length and how many spins are done (the book's fs / totalFs) */
	totalFs: 0,
	spinsPlayed: 0,
	/** which bonus round is running */
	bonusMode: null as null | 'bonus' | 'super',
	/** the bonus round's card that is up now (ui/RoundCard.svelte draws it), null when none is */
	roundCard: null as null | RoundCard,
	/** a natural round's floor top-up, kept from its event until the wrap-up card has shown it */
	topUp: null as null | { floor: number; featureWin: number; amount: number },
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
	/** a win screen is up (none in the first pass: line wins show on the board itself) */
	winShowing: false,
	/** a mode plaque is up (none in the first pass) */
	plaque: null as null | { title: string; sub: string },
	/** SKIP TO RESULT is running (no skip in the first pass) */
	skipping: false,
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

export const stateGameDerived = {
	setTurboLevel,
	boardRate,
};
