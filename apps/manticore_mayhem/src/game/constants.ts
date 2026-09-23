import { quadIn, quadOut, backOut } from 'svelte/easing';

import type { SymbolName } from './types';
import config from './config';

// ---- FEATURE MENU NAME ----------------------------------------------------------------------
// Corey has not picked the final name for the feature menu yet (Angry Mantis called it the Chow
// Line). BAZAAR is the placeholder; it is deliberately ONE constant so renaming is one edit.
export const FEATURE_MENU_NAME = 'BAZAAR';

// ---- Board ------------------------------------------------------------------------------------
export const GRID = 8; // 8 reels x 8 rows (config.numReels / numRows)
export const SYMBOL_SIZE = 110; // one cell in board units; layoutSpec scales the whole board
export const CELL_FILL = 0.94; // drawn tile size as a share of the cell pitch
export const CELL_COUNT = GRID * GRID;

export const BOARD_SIZES = { width: SYMBOL_SIZE * GRID, height: SYMBOL_SIZE * GRID };
export const BOARD_DIMENSIONS = { x: GRID, y: GRID };

/** cellIndex (the book's addressing) <-> reel/row */
export const cellOf = (reel: number, row: number) => reel * GRID + row;
export const reelOf = (cell: number) => Math.floor(cell / GRID);
export const rowOf = (cell: number) => cell % GRID;

// The board shown between PRESS ANYWHERE and the first spin. A deliberate showcase: every paying
// symbol plus W and S, arranged so no five orthogonally-adjacent cells share a symbol (nothing on
// it reads as a win). board[reel][row].
export const INITIAL_BOARD: SymbolName[][] = [
	['L1', 'M1', 'L3', 'H1', 'L2', 'M2', 'L4', 'M3'],
	['M2', 'L4', 'S', 'L1', 'M3', 'L3', 'H1', 'L2'],
	['L3', 'H1', 'L2', 'M2', 'L4', 'M1', 'L1', 'W'],
	['M1', 'L2', 'M3', 'L4', 'W', 'L1', 'M2', 'L3'],
	['L4', 'M3', 'L1', 'M1', 'L3', 'H1', 'S', 'M2'],
	['H1', 'L1', 'M2', 'L3', 'M1', 'L4', 'M3', 'L1'],
	['L2', 'W', 'L4', 'M3', 'L1', 'M2', 'L3', 'H1'],
	['M3', 'L3', 'M1', 'L2', 'H1', 'S', 'M1', 'L4'],
];

export const BACKGROUND_RATIO = 1920 / 1080;
export const PORTRAIT_BACKGROUND_RATIO = 1242 / 2208;

// ---- Motion -----------------------------------------------------------------------------------
// The Angry Mantis gravity feel, mapped onto a tumble drop: tiles accelerate in from above with
// quadIn, land bottom row first with no y-bounce, and squash on contact. There is no reel spin and
// no anticipation here — an 8x8 cascade board never "spins".
// Everything is authored at normal speed and divided by stateBetDerived.timeScale() (turbo 2.2,
// instant 4) at playback, so turbo compresses the whole choreography uniformly.
export const DROP = {
	/** how far above its landing row a new tile starts, in cells */
	from: 2.2,
	/** ms for one cell of travel — a tile falling further takes proportionally longer */
	msPerCell: 78,
	/** the shortest a drop may take whatever the distance */
	minMs: 150,
	/** the longest, so a full-board reveal still lands promptly */
	maxMs: 420,
	/** ms between columns of a full reveal (left to right) */
	columnStaggerMs: 26,
	/** ms between rows within a column (the bottom row lands first) */
	rowStaggerMs: 22,
	easing: quadIn,
};

/** landing beat: squash wide-and-short on contact, then settle back through a small overshoot */
export const GRAVITY_DROP = {
	squash: 0.18,
	squashMs: 90,
	settleRatio: 0.32,
	settleMs: 150,
};

/** a winning cluster's highlight, and the removal that follows it */
export const CLUSTER = {
	/** the winners grow to this while the readout is up */
	winScale: 1.1,
	winRiseMs: 120,
	winEasing: backOut,
	/** how long a cluster's readout is held before the tiles leave */
	holdMs: 620,
	/** non-winners dim to this while a cluster is presented */
	dimAlpha: 0.38,
	dimMs: 140,
	/** the removal pop: grow a hair, then shrink away to nothing */
	removeMs: 190,
	removeEasing: quadOut,
	/** the readout's height as a share of one cell */
	readoutHeight: 0.42,
};

/** a multiplier tile lighting up or doubling in place */
export const TILE = {
	/** the pop a tile makes when it is seeded or doubled */
	popScale: 1.35,
	popMs: 200,
	popEasing: backOut,
	/** The badge's size as a share of a cell. It sits INSIDE the tile's top-right corner and must
	 *  never cover the symbol's letter (Corey 2026-09-22): at 0.40 of a cell, offset to
	 *  CELL_FILL/2 - size/2 - a hair, it clips the corner and nothing else. */
	size: 0.4,
	/** where the disc sits in its cell, in cell fractions from the centre (top-right) */
	offset: { x: 0.26, y: -0.26 },
};

/** the manticore's three set pieces. Milestone 1 has no character, so these are board-only beats. */
export const FEATURE_FX = {
	/** swipe: the three cleared rows flash before they go */
	swipeFlashMs: 220,
	swipeFlashAlpha: 0.55,
	swipeColor: 0x2eb0a8,
	/** sting: each injected wild pops in */
	stingStaggerMs: 55,
	stingPopMs: 220,
	/** roar: the lows blow off the board */
	roarStaggerMs: 16,
	roarFlashMs: 260,
	roarColor: 0xd64a2a,
};

export const TIMINGS = {
	/** a scatter landing beat, per scatter in landing order */
	scatterStaggerMs: 110,
	scatterFlashMs: 180,
	/** after the last cascade of a spin, before the next reveal */
	spinSettleMs: 240,
	/** feature plaque in / hold / out (components/ModePlaque.svelte) */
	plaqueInMs: 320,
	plaqueHoldMs: 1400,
	plaqueOutMs: 300,
	/** the Mystery `nothing` resolution: shown, then gone. No decoy round (EVENT_SCHEMA.md). */
	mysteryNothingMs: 1300,
	/** the spin win readout's fade */
	winClearMs: 320,
};

export const MOTION_BLUR_VELOCITY = 31;

// Stake approval rule: explicit player confirmation before activating any bet mode costing more
// than 2x. Every Manticore mode above Base clears this, so all six confirm.
export const CONFIRM_COST_MULTIPLIER = 2;

export const zIndexes = {
	background: { backdrop: -3, normal: -2, feature: -1 },
};

/** dark wash over the backdrop so the board and the chrome read on top of it */
export const BACKGROUND_WASH = { base: 0.3, freegame: 0.4 };

// ---- Symbol art ---------------------------------------------------------------------------------
export type SymbolInfo = { type: 'sprite'; assetKey: string; sizeRatios: { width: number; height: number } };

const staticSprite = (name: SymbolName, size = CELL_FILL): SymbolInfo => ({
	type: 'sprite',
	assetKey: `${name}.png`,
	sizeRatios: { width: size, height: size },
});

export const SYMBOL_INFO_MAP: Record<SymbolName, SymbolInfo> = Object.fromEntries(
	(Object.keys(config.symbols) as SymbolName[]).map((name) => [name, staticSprite(name)]),
) as Record<SymbolName, SymbolInfo>;

/** the multiplier values the placeholder atlas carries (tools/make_placeholders.py) */
export const TILE_VALUES = [2, 4, 8, 16, 32, 64, 128] as const;

// ---- Sound map ----------------------------------------------------------------------------------
// Scatter landings and the feature-entry confirmation are carried over from Angry Mantis UNCHANGED
// (Corey 2026-09-22). Everything else in the sprite is a placeholder for Manticore's own audio.
export const SCATTER_LAND_SOUND_MAP = {
	1: 'sfx_scatter_land_1',
	2: 'sfx_scatter_land_2',
	3: 'sfx_scatter_land_3',
	4: 'sfx_scatter_land_4',
	5: 'sfx_scatter_land_5',
} as const;

/** the feature-entry fanfare, keyed by the tier that was opened */
export const BONUS_TRIGGER_SOUND_MAP = {
	bonus: 'sfx_bonus_trigger_free',
	super: 'sfx_bonus_trigger_super',
	epic: 'sfx_bonus_trigger_feast',
} as const;

export const BONUS_MODE_LABEL = {
	bonus: 'FREE SPINS',
	super: 'SUPER FREE SPINS',
	epic: 'EPIC FREE SPINS',
} as const;

// ---- Spin-button price fit (carried over from Angry Mantis, Stake review 2026-09-20) -------------
// The price on the spin button is the FULL currency string — no K/M abbreviation anywhere a bet
// level is shown — so the face measures the string (game/textFit.ts) and shrinks it instead.
export const SPIN_PRICE_FIT = {
	boxFrac: 0.86,
	nominal: 0.23,
	nominalLoaded: 0.19,
	nominalLoadedArmed: 0.17,
	minScale: 0.7,
	weight: 800,
	letterSpacing: -0.5,
} as const;
