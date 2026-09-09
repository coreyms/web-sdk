import { quadIn } from 'svelte/easing';

import type { RawSymbol, SymbolState, SymbolName, BonusMode } from './types';
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

// Gravity drop (Corey 2026-09-08, picked from the reel-motion artifact over the shipped drop,
// reel scroll, serve slam and steel shutter). Old tiles tip off the shelf and accelerate out; new
// ones accelerate in from above, land bottom row first with NO y-bounce, squash on contact and kick
// up dust (ReelSymbol.svelte + GRAVITY_DROP below). Speeds are px/ms over the reel's fixed travel:
// fall-out 660 px (6 cells), fall-in 605 px (5.5 cells), so 2.6 ≈ 255 ms out and 2.0 ≈ 300 ms in.
// Turbo (level 1) runs everything 2.2× faster, instant (level 2) 4×, the rates of the artifact.
//
// Spin length. The artifact's normal spin is ~1.6 s press-to-rest; the game has to fit an RGS
// round trip inside that, so the fall-out is the short phase (reel stagger 60 ms, ~255 ms drop)
// and the fall-in starts per reel as soon as THAT reel is empty and the reveal is in — anchored
// to reel 1's start so the 110 ms reel stagger holds (createEnhanceBoardSpin + fallIn's
// staggerFrom) instead of waiting for all five reels to empty first (2026-09-08, Corey: the game
// read considerably slower than the artifact).
//
// Scatter anticipation hold: an anticipated reel's fall-in waits reelFallInDelay × (padding/6 − 1),
// with padding accumulating left to right (createReelForCascading). reelPaddingMultiplierAnticipated
// 10.34 = 1.25 (the normal stagger) + 9.09, so a teased reel adds 88 × 9.09 = 800 ms on top of its
// stagger at normal speed, 364 ms in turbo (reelFallInDelay 40) and 200 ms instant (22), scaled
// per reel by reelState.holdScale (ANTICIPATION.holdDecay: 0.8× per further teased reel, reset by
// a new scatter): the artifact's "hold per reel 800, decay 0.80".
const SPIN_OPTIONS_SHARED = {
	reelPaddingMultiplierNormal: 1.25,
	reelPaddingMultiplierAnticipated: 10.34, // (10.34 − 1.25) × reelFallInDelay = the full hold: 800 ms normal / 364 turbo / 200 instant
	reelFallOutDelay: 60,
	fallInEasing: quadIn,
	fallOutEasing: quadIn,
	symbolFallInBounceSpeed: 0.15, // unused while the bounce size is 0, kept for the option shape
	symbolFallInBounceSizeMulti: 0,
};

export const SPIN_OPTIONS_DEFAULT = {
	...SPIN_OPTIONS_SHARED,
	reelFallInDelay: 88, // 110 ms between reels (× 1.25)
	symbolFallInSpeed: 2.0,
	symbolFallInInterval: 70, // bottom row lands first, each row above 70 ms later
	symbolFallOutSpeed: 2.6,
	symbolFallOutInterval: 25,
	tipRadians: 0.45,
};

// Turbo (level 1): 2.2× the artifact's normal rate.
export const SPIN_OPTIONS_FAST = {
	...SPIN_OPTIONS_SHARED,
	reelFallInDelay: 40,
	reelFallOutDelay: 27,
	symbolFallInSpeed: 4.4,
	symbolFallInInterval: 32,
	symbolFallOutSpeed: 5.7,
	symbolFallOutInterval: 11,
	tipRadians: 0.45,
};

// Instant (turbo level 2): 4×; rows drop together, tiles barely tip.
export const SPIN_OPTIONS_INSTANT = {
	...SPIN_OPTIONS_SHARED,
	reelFallInDelay: 22,
	reelFallOutDelay: 0,
	symbolFallInSpeed: 8,
	symbolFallInInterval: 0,
	symbolFallOutSpeed: 10,
	symbolFallOutInterval: 0,
	tipRadians: 0.2,
};

// Landing beat of the gravity drop (every visible cell, ReelSymbol.svelte): on contact the tile
// squashes wide-and-short by `squash` over squashMs, then overshoots the other way by
// squash × settleRatio over settleMs, while the dust sheet (game/dustTexture.ts) plays its six
// frames over dustMs on the tile's bottom edge, fading through the last third. Dust numbers are
// Corey's picks from the reel-motion artifact (2026-09-08).
// Durations are divided by stateBetDerived.timeScale() (turbo 2.2, instant 4).
export const GRAVITY_DROP = {
	squash: 0.2,
	squashMs: 90,
	settleRatio: 0.35,
	settleMs: 150,
	dustMs: 320,
	dustAlpha: 0.55,
	dustWidth: 1.35, // frame width in tiles
	dustY: 0, // dust mass offset from the tile's bottom edge, in tiles (positive = down)
	dustFadeFrom: 0.66, // fraction of dustMs after which the puff fades to zero
};

// Scatter anticipation (Anticipation.svelte). From the reel after the second landed scatter, every
// reel still to come teases for its hold: a prison-yard searchlight swings through the empty
// column over a faint rain of loose symbols, while a warm light spill grows in from the column
// edges as the hold runs out; everything fades as the real symbols drop. Corey's picks from the
// reel-motion artifact (2026-09-08): searchlight + rain behind + light spill, hold 800 ms with
// 0.8× decay per further teased reel, rain 2.0×, strength 0.75 (0.5 turbo, 0.3 instant), no
// urgency ramp. Lengths are in tiles (SYMBOL_SIZE) or board heights; times are style time (the
// beam swings faster under turbo, like the hold shrinks).
export const ANTICIPATION = {
	holdMs: 800, // the full hold at normal speed — must match reelPaddingMultiplierAnticipated above
	holdDecay: 0.8, // each further teased reel holds this × the previous (a new scatter resets it)
	holdFloorMs: 300, // never shorter than this share of the full hold
	strength: [0.75, 0.5, 0.3], // beam + spill alpha multiplier by turbo level
	rainSpeed: 4.18, // master px/ms down the column (1.9 × 2.0 of the artifact's 100 px cells × 1.1)
	rainAlpha: 0.2, // half the artifact's rain: it sits behind the beam
	rainStretch: 1.12, // ghosts are drawn slightly taller: cheap motion blur
	rainGhostOffset: 12, // px between the three ghost copies of each loose symbol
	beamOriginY: -0.55, // beam pivot above the column, in column heights
	beamLength: 1.9, // in column heights
	beamHalfWidth: 0.24, // half-width at the far end, as a share of the length
	beamSwing: 0.13, // radians either side of straight down
	beamPeriodMs: 840, // one full swing there and back, style time
	spillWidth: 0.1, // edge glow width at the start of the hold, in tiles
	spillGrow: 0.42, // extra width by the end of the hold, in tiles
	spillAlpha: 0.12, // edge glow alpha at the start of the hold (× strength)
	spillAlphaGrow: 0.4, // extra alpha by the end of the hold
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
	// All-wild top-up beat (AllWildTopUp.svelte): the board of wilds that presents the book's
	// wincap top-up before the cinematic. All three are scaled by stateBetDerived.timeScale().
	maxWinTopUpHold: 900, // multiplier readable before the running total starts climbing
	maxWinTopUpCount: 1000, // covers the HUD win tween (550ms, controls.svelte.ts) plus a beat
	maxWinTopUpOutro: 350, // settle before the cinematic takes the screen
	retrigger: 1300, // gold-art banner needs a readable beat (was 800 as plain text)
	highLandSquash: 180, // high-symbol landing beat (Corey 2026-09-05, picked from the comparison artifact)
	highLandGlint: 320,
};

// Dark wash over the cafeteria backdrops (Background.svelte) so the board and chrome read on
// top: alpha of a near-black rectangle. Corey picked 30% for the base game from the wash slider
// artifact (2026-09-05, was 50%); free games stay ten points darker.
export const BACKGROUND_WASH = { base: 0.3, freegame: 0.4 };

// High-symbol landing beat (H1/M1/M2/M3, ReelSymbol.svelte): once the tile's landing bounce has
// settled, the cell squashes (wide × short, easing back) while a soft white strip sweeps the
// tray. The strip is a texture fill clipped by ONE rounded square shared by every tray (measured
// from the plate art: full width, ~0.96 tall, corners ~0.265 of the width, centre 1.3% above the
// tile centre) and the insect cutout is drawn on top, so the glint lights the tray only.
export const HIGH_LAND = {
	symbols: ['H1', 'M1', 'M2', 'M3'],
	squashX: 0.048, // "louder" beat strength from the artifact: 1.6 × (3% / 5%)
	squashY: 0.08,
	glintAlpha: 0.5, // "medium" glint from the comparison artifact
	glintWidth: 0.46, // bright core as a fraction of the tile
	glintAngle: (18 * Math.PI) / 180,
	trayHeight: 0.96,
	trayRadius: 0.265,
	trayCenterY: -0.013,
};

// Where the AUDIBLE transient sits inside an sfx clip (measured from the sources 2026-09-01).
// A clip is fired this many ms EARLY so its attack lands on the visual beat it scores, instead of
// on the moment the book event happened. marty-strike.ogg: ~67ms of lead-in, impact peaks at 102ms.
export const SFX_TRANSIENT = {
	martyStrike: 102,
};

// BoneRutter character rig (static/assets/rig/mantis-set.*): clip names as authored in the export,
// grouped for the game's needs. Reactions are pools — a random member plays each time so repeated
// wins/pokes don't loop the identical take.
export const RIG = {
	idle: 'idle',
	// idle variety (2026-09-05 export): the primary idle dominates, Idle 2 is the regular
	// alternate, and idle 3 turns up about a quarter as often (Corey). Every return-to-idle and
	// mid-idle rotation rolls this pool; the bored clip is rolled separately (boredChance per
	// pick) and plays once before the pool is rolled again. RULE (Corey 2026-09-05): after ANY
	// variant (Idle 2 / idle 3 / bored) the next idlesBetweenVariants picks are forced to the
	// primary idle, so variants never repeat or run back to back.
	idles: [
		{ name: 'idle', weight: 0.7 },
		{ name: 'Idle 2', weight: 0.22 },
		{ name: 'idle 3', weight: 0.08 },
	],
	idlesBetweenVariants: 2,
	bored: 'bored',
	boredChance: 1 / 50,
	anticipation: 'Anticipation',
	// the rig's clip labels are the wrong way round (Corey 2026-09-08): 'Walking Backwards' is the
	// forward stride, 'Walking' the backward one — mapped here so game code reads by intent
	walk: { forward: 'Walking Backwards', backward: 'Walking' },
	// clip speed while a mantis crosses the stage: the cycle is authored slower than the walk-on /
	// walk-off translation (WALK_MS over ~650 master px) — Corey 2026-09-08
	walkSpeed: 2,
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

// Clips a skin must never play. 'Astonished 3' has Marty's GREEN jaw-drop baked into the clip, so
// on the Marky skin it flashes the wrong colour (Corey 2026-09-02) — Marky draws from the other
// two takes instead, and a pool that filters to nothing simply doesn't fire.
export const RIG_SKIN_EXCLUDE: Record<'marty' | 'marky', readonly string[]> = {
	marty: [],
	marky: ['Astonished 3'],
};
export const reactionPoolFor = (kind: RigReaction, name: 'marty' | 'marky'): readonly string[] =>
	RIG.reactions[kind].filter((clip) => !RIG_SKIN_EXCLUDE[name].includes(clip));

// Voice clips that play WITH a reaction animation — three takes each (Corey 2026-09-02), picked at
// random so a repeated reaction never plays the identical clip. Keyed by reaction so every
// broadcaster (mantisReact / martyReact / the poke hit area) gets the audio for free — the sound
// is emitted from inside each rig component's react(), AFTER its on-stage/busy guards, so a beat
// that broadcasts to both the base-game rig and the bonus rigs still only ever sounds once.
// Marky has no reaction voice of his own yet: both skins speak with Marty's takes.
export const REACTION_SOUND_POOLS = {
	angry: ['sfx_marty_angry', 'sfx_marty_angry_2', 'sfx_marty_angry_3'],
	celebrate: ['sfx_marty_happy', 'sfx_marty_happy_2', 'sfx_marty_happy_3'],
	poke: ['sfx_marty_poke', 'sfx_marty_poke_2', 'sfx_marty_poke_3'],
	astonished: ['sfx_marty_astonished', 'sfx_marty_astonished_2', 'sfx_marty_astonished_3'],
} as const satisfies Record<RigReaction, readonly string[]>;
const pick = <T,>(pool: readonly T[]) => pool[Math.floor(Math.random() * pool.length)];
export const reactionVoice = (kind: RigReaction) => pick(REACTION_SOUND_POOLS[kind]);
// per-striker strike + eat voices: Marty randomises over his three takes, Marky has one of each
export const STRIKE_VOICES = {
	marty: ['sfx_marty_strike', 'sfx_marty_strike_2', 'sfx_marty_strike_3'],
	marky: ['sfx_marky_strike'],
} as const;
export const EAT_VOICES = {
	marty: ['sfx_marty_eat', 'sfx_marty_eat_2', 'sfx_marty_eat_3'],
	marky: ['sfx_marky_eat'],
} as const;
export const strikeVoice = (striker: 'marty' | 'marky') => pick(STRIKE_VOICES[striker]);
export const eatVoice = (striker: 'marty' | 'marky') => pick(EAT_VOICES[striker]);

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

// Feature-trigger fanfare by the scatter count that triggered it (Corey's bonus-trigger-*.ogg,
// 2026-09-02). Fired at freeSpinTrigger — the moment the scatters pulse — before the door drops.
export const BONUS_TRIGGER_SOUND_MAP: Record<3 | 4 | 5, 'sfx_bonus_trigger_free' | 'sfx_bonus_trigger_super' | 'sfx_bonus_trigger_feast'> = {
	3: 'sfx_bonus_trigger_free',
	4: 'sfx_bonus_trigger_super',
	5: 'sfx_bonus_trigger_feast',
};

export const SCATTER_LAND_SOUND_MAP = {
	1: 'sfx_scatter_land_1',
	2: 'sfx_scatter_land_2',
	3: 'sfx_scatter_land_3',
	4: 'sfx_scatter_land_4',
	5: 'sfx_scatter_land_5',
} as const;

export const BONUS_MODE_LABEL = {
	free: 'FREE SPINS',
	super: 'SUPER FREE SPINS',
	feast: 'MANTIS FEAST',
} as const;

// ---- Bonus-intro art (Corey's colour-graded branding exports) ----
// Stencil headers: one image carries BOTH lines ("FEAST" + "ALL-YOU-CAN-EAT BONUS"). All three are
// cropped from a common box, so they share an aspect and land on the same baseline in every mode.
// The wrap-up (FreeSpinOutro) heads with the same art, so intro and outro read as one feature
// (Corey 2026-09-02, replacing the label-*.webp buy-card pieces there).
export const BONUS_INTRO_HEADER = {
	free: 'headerBonus', // BONUS * MARTY'S SPECIAL
	super: 'headerSuper', // SUPER * MARKY'S SPECIAL
	feast: 'headerFeast', // FEAST * ALL-YOU-CAN-EAT BONUS
} as const;
export const BONUS_INTRO_HEADER_ASPECT = 880 / 290;
// Big numeral + speed lines + "* FREE SPINS *" strip. Keyed on the ACTUAL spin count from the
// bonusStart event, not the mode, so the picture can never disagree with the counter.
export const FREE_SPINS_ART = {
	8: { key: 'freeSpins8', aspect: 620 / 375 },
	10: { key: 'freeSpins10', aspect: 620 / 300 },
} as const;

// Mugshot height-chart plates (Corey's art, 2026-09-01). Each plate bakes in its INMATE label and
// foot marks, and the two are MIRRORED — 01 runs its chart numbers down the left edge, 02 down the
// right — so the head is nudged toward the plate's clear side. The pair is laid out at a common
// HEIGHT with each plate keeping its own aspect, so the strokes never scale non-uniformly. Both
// plates share one 400×267 canvas since Corey's 2026-09-02 re-export, so they draw the same size.
export const INMATE_PLATE = {
	marky: { key: 'inmateChalk1', aspect: 400 / 267, headShift: 0.07 }, // INMATE 01, labels left
	marty: { key: 'inmateChalk2', aspect: 400 / 267, headShift: -0.07 }, // INMATE 02, labels right
} as const;

// Head geometry on a mugshot plate, as fractions of the PLATE HEIGHT. Shared with BonusIntro so the
// composition measures the same box MugshotPanel draws: the head hangs OVERHANG below the plate's
// bottom rule, and forgetting that in the measurement mis-centres the whole screen (caught 2026-09-01,
// it pushed the rules band 15px out the bottom of the door).
export const MUGSHOT_HEAD = { size: 1.0, overhang: 0.25 } as const;

// Tint for the GREEN STRIKE emphasis in the rules copy (the white stencil sheet takes tint).
export const STRIKE_GREEN = 0x8fd14f;

export type RuleCopyDensity = 'full' | 'medium' | 'short';

/** One rule column/row: a boxed gold numeral, a gold stencil title, white stencil body copy.
 *  `leafIcon` inlines the REAL Glowing Leaf symbol texture into the flow. */
export type RuleCopy = { title: string; body: string; leafIcon?: boolean };

// EVERY line here is checked against math-sdk/games/angry_mantis:
//  1 EAT     — game_executables.leaf_strikes(): one strike per Glowing Leaf (GL) on the board;
//              perform_strike pops symbol_pool[0], and game_config.EAT_ORDER is ascending
//              5-of-a-kind pay (L4 L3 L2 L1 M3 M2 M1 H1), so the lowest symbol always goes first.
//  2 REMOVE  — game_calculations.get_filtered_reel_id(): eaten symbols are substituted out of the
//              reelstrips for the rest of the session ("removed symbols simply never appear again").
//  3         — game_executables.auto_strikes(): `range(2 if bonus_mode == "feast" else 1)`, with
//              next_striker() alternating marty/marky ONLY in feast. So feast opens with two bites,
//              one per mantis; super opens with one from Marky; bonus opens with one from Marty.
//              Every mode really does have an opening bite — no invented mechanic, no mode where
//              this rule has to be swapped out for the retrigger rule.
const RULE_3: Record<BonusMode, Record<RuleCopyDensity, RuleCopy>> = {
	free: {
		full: { title: 'HEAD START', body: 'MARTY EATS ONE SYMBOL BEFORE THE FIRST SPIN.' },
		medium: { title: 'HEAD START', body: 'MARTY EATS ONE SYMBOL BEFORE THE FIRST SPIN.' },
		short: { title: 'HEAD START', body: 'MARTY EATS ONE SYMBOL BEFORE THE FIRST SPIN.' },
	},
	super: {
		full: { title: 'HEAD START', body: 'MARKY EATS ONE SYMBOL BEFORE THE FIRST SPIN.' },
		medium: { title: 'HEAD START', body: 'MARKY EATS ONE SYMBOL BEFORE THE FIRST SPIN.' },
		short: { title: 'HEAD START', body: 'MARKY EATS ONE SYMBOL BEFORE THE FIRST SPIN.' },
	},
	feast: {
		full: { title: 'EPIC FEAST', body: 'BOTH MANTISES EAT ONE SYMBOL EACH BEFORE THE FIRST SPIN.' },
		medium: { title: 'EPIC FEAST', body: 'BOTH MANTISES EAT ONE SYMBOL EACH BEFORE THE FIRST SPIN.' },
		// 'EACH MANTIS EATS ONE' is the same fact as 'both mantises eat one each' (auto_strikes
		// runs twice in feast, alternating marty/marky) in 6 fewer characters — that trim is what
		// funds the >=3.2%-of-H body cap in the three-column band.
		short: { title: 'EPIC FEAST', body: 'EACH EATS ONE SYMBOL BEFORE THE FIRST SPIN.' },
	},
};

// "GREEN STRIKE" is tinted green wherever it appears (it names the Glowing Leaf tile). The copy is
// uppercase and apostrophe-free because both stencil sheets are caps-only with no apostrophe glyph.
const RULE_1: Record<RuleCopyDensity, RuleCopy> = {
	full: {
		title: 'EAT',
		body: 'SYMBOLS ON THE GREEN STRIKE LEAF ARE EATEN. LOWEST SYMBOLS FIRST.',
	},
	medium: {
		title: 'EAT',
		body: 'GREEN STRIKE LEAF SYMBOLS ARE EATEN. LOWEST SYMBOLS FIRST.',
	},
	short: {
		title: 'EAT',
		body: 'GREEN STRIKE LEAF SYMBOLS ARE EATEN. LOWEST FIRST.',
	},
};

const RULE_2: Record<RuleCopyDensity, RuleCopy> = {
	full: { title: 'REMOVE', body: 'EATEN SYMBOLS DISAPPEAR FOR THE REST OF THE BONUS.' },
	medium: { title: 'REMOVE', body: 'EATEN SYMBOLS ARE GONE FOR THE REST OF THE BONUS.' },
	short: { title: 'REMOVE', body: 'EATEN SYMBOLS NEVER RETURN.' },
};

export const rulesFor = (mode: BonusMode, density: RuleCopyDensity): RuleCopy[] => [
	RULE_1[density],
	RULE_2[density],
	RULE_3[mode][density],
];
