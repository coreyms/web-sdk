import type { RawSymbol, SymbolState, SymbolName } from './types';
import config from './config';

export const SYMBOL_SIZE = 110;
// Symbols are centred in their column (0.5). Cell art fills CELL_FILL of the pitch (design: 115.6 / 119.6).
export const REEL_PADDING = 0.5;
export const CELL_FILL = 0.966;

// Landing board shown between CONTINUE and the first spin: a deliberate, mirror-symmetric showcase
// of every symbol (5 reels x 4 rows + top/bottom padding; visible rows are indices 1-4).
// Rules: every paying symbol + W + S appears (GL is feature-only, excluded); no symbol occupies
// 3 consecutive reels, so nothing reads as a win. Specials (S, M3, H1) hold the center column.
export const INITIAL_BOARD: RawSymbol[][] = [
	['L2', 'H1', 'M1', 'L1', 'L3', 'L4'],
	['L1', 'M2', 'L4', 'W', 'L2', 'L3'],
	['L4', 'L3', 'S', 'M3', 'H1', 'L1'],
	['L1', 'M2', 'L4', 'W', 'L2', 'L3'],
	['L2', 'H1', 'M1', 'L1', 'L3', 'L4'],
].map((reel) => reel.map((name) => ({ name: name as SymbolName })));

export const BOARD_DIMENSIONS = { x: config.numReels, y: config.numRows[0] };

export const BOARD_SIZES = {
	width: SYMBOL_SIZE * BOARD_DIMENSIONS.x,
	height: SYMBOL_SIZE * BOARD_DIMENSIONS.y,
};

export const BACKGROUND_RATIO = 2039 / 1000;
export const PORTRAIT_BACKGROUND_RATIO = 1242 / 2208;
const PORTRAIT_RATIO = 800 / 1422;
const LANDSCAPE_RATIO = 1600 / 900;
const DESKTOP_RATIO = 1422 / 800;

const DESKTOP_HEIGHT = 800;
const LANDSCAPE_HEIGHT = 900;
const PORTRAIT_HEIGHT = 1422;
export const DESKTOP_MAIN_SIZES = { width: DESKTOP_HEIGHT * DESKTOP_RATIO, height: DESKTOP_HEIGHT };
export const LANDSCAPE_MAIN_SIZES = { width: LANDSCAPE_HEIGHT * LANDSCAPE_RATIO, height: LANDSCAPE_HEIGHT };
export const PORTRAIT_MAIN_SIZES = { width: PORTRAIT_HEIGHT * PORTRAIT_RATIO, height: PORTRAIT_HEIGHT };

export const INITIAL_SYMBOL_STATE: SymbolState = 'static';

const SPIN_OPTIONS_SHARED = {
	reelFallInDelay: 80,
	reelPaddingMultiplierNormal: 1.25,
	reelPaddingMultiplierAnticipated: 14.5, // was 18 — ~20% shorter anticipation hold
	reelFallOutDelay: 145,
};

export const SPIN_OPTIONS_DEFAULT = {
	...SPIN_OPTIONS_SHARED,
	symbolFallInSpeed: 3.5,
	symbolFallInInterval: 30,
	symbolFallInBounceSpeed: 0.15,
	symbolFallInBounceSizeMulti: 0.5,
	symbolFallOutSpeed: 3.5,
	symbolFallOutInterval: 20,
};

// Turbo (level 1): noticeably quicker than base, still reads as a spin.
export const SPIN_OPTIONS_FAST = {
	...SPIN_OPTIONS_SHARED,
	reelFallInDelay: 40,
	symbolFallInSpeed: 5,
	symbolFallInInterval: 10,
	symbolFallInBounceSpeed: 0.22,
	symbolFallInBounceSizeMulti: 0.35,
	symbolFallOutSpeed: 5,
	symbolFallOutInterval: 8,
};

// Instant (turbo level 2): reels drop in with no stagger or bounce.
// Instant (level 2): a step quicker than turbo (this was the old turbo).
export const SPIN_OPTIONS_INSTANT = {
	...SPIN_OPTIONS_SHARED,
	symbolFallInSpeed: 7,
	symbolFallInInterval: 0,
	symbolFallInBounceSpeed: 0.3,
	symbolFallInBounceSizeMulti: 0.25,
	symbolFallOutSpeed: 7,
	symbolFallOutInterval: 0,
};

export const MOTION_BLUR_VELOCITY = 31;

export const zIndexes = {
	background: { backdrop: -3, normal: -2, feature: -1 },
};

// Animation timings (ms) for the placeholder choreography. Tune when real Spine rigs land.
export const TIMINGS = {
	symbolWin: 350, // was 700 — Corey 2026-08-29: highlight must feel snappy
	strike: 650,
	eat: 800,
	anteLock: 300,
	bonusIntro: 1800,
	maxWinWalkOn: 800,
	maxWinPerCell: 90,
	maxWinRoar: 1500,
	retrigger: 1300, // gold-art banner needs a readable beat (was 800 as plain text)
};

// BoneRutter character rig (static/assets/rig/mantis-set.*): clip names as authored in the export,
// grouped for the game's needs. Reactions are pools — a random member plays each time so repeated
// wins/pokes don't loop the identical take.
export const RIG = {
	idle: 'idle',
	// idle variety (2026-08-29 export): the primary idle dominates; Idle 2 appears on some
	// returns-to-idle and occasional mid-idle rotations so long waits don't read as a statue
	idles: ['idle', 'Idle 2'],
	idlePrimaryWeight: 0.7,
	anticipation: 'Anticipation',
	walk: { forward: 'Walking', backward: 'Walking Backwards' },
	reactions: {
		angry: ['Angry 1', 'Angry 2', 'Angry 3'],
		celebrate: ['Celebrating 1', 'Celebrating 2', 'Celebrating 3'],
		astonished: ['Astonished 1', 'Astonished 2', 'Astonished 3'],
		poke: ['Poke', 'Poke 2', 'Poke 3'],
	},
	// One Strike clip covers the whole strike-AND-eat performance: wind-up, claw impact (~frame 18
	// of 66 — arms at peak extension, mouth opens at 19), then recovery/chomp. `speed` is chosen so
	// the impact lands exactly at TIMINGS.strike (18 frames / 24fps / 1.154 = 650ms); the tail then
	// plays out underneath the insect's flight to the mouth. If Corey re-times the clip in
	// BoneRutter, retune hitFrame (and speed follows) — or better, replace this whole block with
	// event markers (strike/chomp) once the export carries them; Rig.on('event') is already wired.
	strike: { marty: 'Strike', marky: 'Marky-Strike', hitFrame: 18, fps: 24 },
} as const;
export type RigReaction = keyof typeof RIG.reactions;

// Voice clip that plays WITH a reaction animation. Keyed by reaction so every broadcaster
// (mantisReact / martyReact / the poke hit area) gets the audio for free — the sound is emitted
// from inside each rig component's react(), AFTER its on-stage/busy guards, so a beat that
// broadcasts to both the base-game rig and the bonus rigs still only ever sounds once.
// 'astonished' is intentionally absent: marty-astonished.ogg has not been delivered yet.
export const REACTION_SOUND_MAP: Partial<Record<RigReaction, 'sfx_marty_angry' | 'sfx_marty_happy' | 'sfx_marty_poke'>> = {
	angry: 'sfx_marty_angry',
	celebrate: 'sfx_marty_happy',
	poke: 'sfx_marty_poke',
};

export type SymbolInfo = {
	type: 'sprite';
	assetKey: string;
	sizeRatios: { width: number; height: number };
};

// Every symbol state currently maps to a static placeholder sprite from amSymbols.
// Real art: swap individual states for Spine entries (see ways reference app) without touching callers.
const staticSprite = (name: SymbolName, size = CELL_FILL): SymbolInfo => ({
	type: 'sprite',
	assetKey: `${name}.png`,
	sizeRatios: { width: size, height: size },
});
const winSprite = (name: SymbolName): SymbolInfo => staticSprite(name, CELL_FILL * 1.08);
const eatenSprite = (name: SymbolName): SymbolInfo => ({
	type: 'sprite',
	assetKey: `${name}_eaten.png`,
	// same plate as the live tile minus the bug — must render at identical size or the swap pops
	sizeRatios: { width: CELL_FILL, height: CELL_FILL },
});

const symbolStates = (name: SymbolName, size?: number) => ({
	static: staticSprite(name, size),
	spin: staticSprite(name, size),
	land: staticSprite(name, size),
	win: winSprite(name),
	postWinStatic: staticSprite(name, size),
	eaten: eatenSprite(name),
});

export const SYMBOL_INFO_MAP: Record<SymbolName, Record<SymbolState, SymbolInfo>> = {
	H1: symbolStates('H1'),
	M1: symbolStates('M1'),
	M2: symbolStates('M2'),
	M3: symbolStates('M3'),
	L1: symbolStates('L1'),
	L2: symbolStates('L2'),
	L3: symbolStates('L3'),
	L4: symbolStates('L4'),
	W: symbolStates('W', 1.0),
	S: symbolStates('S', 1.0),
	GL: symbolStates('GL', 1.0),
};

export const SCATTER_LAND_SOUND_MAP = {
	1: 'sfx_scatter_land_1',
	2: 'sfx_scatter_land_2',
	3: 'sfx_scatter_land_3',
	4: 'sfx_scatter_land_4',
	5: 'sfx_scatter_land_5',
} as const;

// gold header art per bonus mode (label-*.webp — same pieces as the buy cards)
export const BONUS_MODE_HEADER = {
	free: 'labelBonus',
	super: 'labelSuper',
	feast: 'labelFeast',
} as const;

export const BONUS_MODE_LABEL = {
	free: 'FREE SPINS',
	super: 'SUPER FREE SPINS',
	feast: 'MANTIS FEAST',
} as const;
