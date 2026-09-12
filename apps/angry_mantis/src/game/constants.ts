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
	winClear: 500, // win plate fade-out (FadeContainer default 400 ms, unscaled) + a beat before a bell rings under it
	bellSettle: 500, // opening bite: the hero bell sits at the board centre this long before it rings (Corey 2026-09-10)
	ring: 480, // Service Bell press (game/bell.ts): 9 slots of ~53 ms — frames 1-5 once, then rest; ding on the downstroke
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
	scatterFlash: 160, // scatter landing: the white card flash on contact (SCATTER_LAND)
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

// ---- Per-insect symbol poses (Corey 2026-09-11, fly first) ----
// Each insect may ship ONE pose atlas built by tools/make_placeholders.py from Corey's BoneRutter
// export (<p>-poses.png/.json in assets/images/tile → static/assets/sprites/poses-<p>.{webp,json},
// registered in game/assets.ts as a deferred `sprites` key). Every frame is fitted to the still
// cutout's place on the tray by the builder, so plate + contact shadow + a moving insect compose
// EXACTLY the baked tile on frame 0 — components/SymbolPose.svelte swaps the insect texture per
// frame over `<SYM>_eaten.png` (the plate) and `<SYM>_shadow.png` (the shadow, which stays put).
//
// Poses are OPTIONAL everywhere: a symbol with no entry here, an entry whose pose is null, or an
// atlas that has not finished downloading simply never animates — the baked tile shows instead
// (game/symbolPoses.svelte.ts returns null and the layer stays invisible).
//
// Beats, and how each clip is played:
//   land    the tile's landing beat (ReelSymbol's 'land' → 'static' hand-off) — a SHORT burst:
//           `landLoops` passes of the clip
//   ambient a resting board's idle twitch — a LONGER burst: a random count from `ambientLoops`
//   win     loops for as long as the cell is in the 'win' state (TIMINGS.symbolWin, and while the
//           scatter-trigger hold keeps it there). The sprite's own 1.06 pulse is hidden underneath,
//           so a symbol WITH a win pose animates instead of pulsing; symbols without keep the pulse.
//   eat     played ONCE and FROZEN on eatFreezeFrame (else its last frame) by the course served
//           front and centre ONLY (Mantis.svelte's hero tray, symbolPoses HERO_REEL) — the board
//           tiles of that species do not cower (Corey 2026-09-11). It starts when the tray's drop
//           lands, TIMINGS.strike (650 ms) before the claw, so a clip that freezes within ~15
//           frames is held before contact, and Mantis.svelte's pickup sprite carries that SAME
//           frozen frame off to the mouth.
// land and win playback is divided by stateBetDerived.timeScale() so it compresses with the rest of
// the spin; ambient and eat run at the authored fps (an idle board and the strike window are both
// real time — TIMINGS.strike is unscaled).
//
// Ambient cadence: on a RESTING board (all reels stopped, no spin, no win presentation, no strike
// in flight, no door/intro/outro, any game mode), each insect TYPE present on the board animates
// ONE randomly chosen visible tile, then waits a random ambientGapMs before that type goes again.
// Types are staggered on first arm (ambientStaggerMs apart) so the board never moves all at once,
// and a type never has two tiles animating at the same time.
export const SYMBOL_POSES = {
	fps: 24, // authored frame rate of every sheet (meta.fps); per-symbol overrides below
	landLoops: 4, // passes of the land clip on contact (Corey 2026-09-11: two were not enough); per-symbol override below
	ambientLoops: [5, 5], // passes of the ambient clip per idle-board burst (Corey 2026-09-11: five); per-symbol override below
	ambientGapMs: [8000, 15000],
	ambientStaggerMs: 2600,
	symbols: {
		L2: {
			sheet: 'posesL2',
			poses: { land: 'wing_twitch', ambient: 'wing_twitch', win: 'idle', eat: 'scared' },
			fps: 24,
			// the eat clip plays up to THIS frame and freezes there (the mantis carries that frame off).
			// Corey's scared clip rears the forelegs over the eyes across frames 4-7 and settles back
			// to rest by 10, so freezing on the last frame carried the fly off looking calm; 6 is the
			// eyes-covered peak. Omit to freeze on the clip's last frame.
			eatFreezeFrame: 6,
		},
		M1: {
			// the beetle (Corey 2026-09-11): a 24-frame settle instead of a 6-frame twitch, so it
			// gets ONE pass per beat where the fly gets four / five; its scared clip tucks in
			// progressively and is at its smallest on the last frame, so no freeze override
			sheet: 'posesM1',
			poses: { land: 'legs_and_head_adjusting', ambient: 'legs_and_head_adjusting', win: 'idle', eat: 'scared' },
			fps: 24,
			landLoops: 1,
			ambientLoops: [1, 1],
		},
		M2: {
			// the spider (Corey 2026-09-11): an 18-frame legs settle; scared draws the legs in over
			// six frames and is tightest on the last, so no freeze override
			sheet: 'posesM2',
			poses: { land: 'legs_adjusting', ambient: 'legs_adjusting', win: 'idle', eat: 'scared' },
			fps: 24,
			landLoops: 1,
			ambientLoops: [1, 2],
		},
		M3: {
			// the scorpion (Corey 2026-09-11): an 18-frame claw pinch; its scared clip rears up and
			// peaks at frame 12 before settling back by 17, so the freeze sits on the peak
			sheet: 'posesM3',
			poses: { land: 'claws_pinching', ambient: 'claws_pinching', win: 'idle', eat: 'scared' },
			fps: 24,
			landLoops: 1,
			ambientLoops: [1, 2],
			eatFreezeFrame: 12,
		},
	} as Record<string, { sheet: string; poses: { land: string | null; ambient: string | null; win: string | null; eat: string | null }; fps: number; eatFreezeFrame?: number; landLoops?: number; ambientLoops?: [number, number] }>,
} as const;
export type PoseBeat = 'land' | 'ambient' | 'win' | 'eat';

// Scatter landing beat (Corey 2026-09-11, picked from the scatter-landing artifact). A Marky
// scatter never lands as part of the reel strip: the strip refills with its cell EMPTY, settles,
// and the card is then SLAPPED down from the front (ScatterDrop.svelte, a layer above the frame:
// 1.6× → 1.0 on a quad-in, fading in over the first 60 ms, its contact shadow closing under it).
// On contact the cell runs the gravity beat with a heavier slam, a white card flash, wider dust,
// the count's landing sound and a screen kick that climbs with the scatter count. From the THIRD
// scatter of a base-game spin, every scatter on the board joins a lit set: a board-window
// flashbulb, every card flashes and takes a breathing hot rim, the new card lifts, and every
// other tile dims (the win-focus dim). The set stays lit while the remaining reels finish — a
// fourth or fifth joins it with its own hit — and once the last reel is down the wrap-up sweep
// runs left to right putting out each card's rim and lift; as it leaves the last card every
// scatter flashes together and the trigger's grow follows straight on it, HELD until the bonus
// door has closed over the board. The ante-held scatter fires no land event, so it gets no beat
// after its first landing and never re-sounds (the same rule the sound always followed).
// All durations are divided by stateBetDerived.timeScale() (turbo 2.2, instant 4).
export const SCATTER_LAND = {
	// the well: the scatter's own SHADOW (its texture tinted black, so the exact card shape) rides
	// down in its cell with the strip at wellAlphaFrom and darkens to wellAlphaTo over the slap,
	// as if the card were closing in on it (Corey 2026-09-11: "40% black in the scatter's exact
	// shape, darker as the scatter is about to drop"). The flying card's contact shadow
	// (ScatterDrop) is the same silhouette, so the two merge on the frame it lands.
	wellAlphaFrom: 0.4,
	wellAlphaTo: 0.85,
	dropShadowAlpha: 0.35, // under the flying card, fading in with it
	dropShadowGrow: 0.2, // at the top of the slap the shadow is this much wider than the FLYING card
	dropShadowDrop: 0.35, // and thrown this many tiles below it (a high card casts a displaced shadow)
	slapDelayMs: 120, // after the strip settles, before the card comes down
	slapMs: 200, // 1.6× → 1.0, quadIn
	slapFrom: 1.6,
	slapFadeMs: 60,
	squashX: 0.18, // slam on top of GRAVITY_DROP.squash (wide)
	squashY: 0.26, // and short
	flashAlpha: 0.8, // white card flash on contact, over TIMINGS.scatterFlash
	dustWidth: 2.0, // vs GRAVITY_DROP.dustWidth 1.35
	kick: [2, 4, 6, 9, 12], // master px by scatter count 1..5 (game/screenKick.ts)
	// the lit set (3rd scatter and up, base game only)
	bulbAlpha: 0.45, // board-window flashbulb
	bulbMs: 110,
	dimMs: 180, // lights down on every non-scatter tile (SymbolWrap's 0.35 dim)
	rimRampMs: 80, // hot rim fade-in; then breathes 0.55 ± 0.35 on a ~140 ms sine
	rimPeriodMs: 140,
	rimColor: 0xffdc8c,
	holdScale: 1.1, // the new card lifts to this (120 ms in, after a 120 ms beat)
	holdDelayMs: 120,
	holdMs: 120,
	litAlpha: 0.22, // warm wash on a lifted card while it holds (± 0.08 on the rim's sine)
	litColor: 0xff7850,
	// the wrap-up, once every reel is down
	sweepDelayMs: 320, // a breath after the last reel lands
	sweepStaggerMs: 60, // left to right, per card
	sweepFlashMs: 180, // the link flash that puts each card out
	accentDelayMs: 60, // after the sweep reaches the last card: every scatter flashes together
	growDelayMs: 80, // and the trigger's grow follows (freeSpinTrigger → animateSymbols)
	// the grow lives on the cell's container (ReelSymbol), not the sprite: SymbolWrap remounts the
	// sprite when a tile leaves its 'win' layer, which snapped a sprite-held grow back to 1
	// (Corey 2026-09-11, seen in slow motion). Up to growScale, then a slow breath around it at
	// the bell halo's rate until the door has closed over the board.
	growScale: 1.06,
	growMs: 175, // TIMINGS.symbolWin / 2, the old pulse's rise
	breathAmp: 0.02, // ± around growScale
	breathHz: 0.9, // BELL_GLOW.pulseHz
} as const;

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
	S: symbolStates('S'), // tray size (was 1.0: the square card read 3.5% bigger than the trays, Corey 2026-09-11)
	GL: symbolStates('GL', 1.0),
};

// Feature-trigger fanfare by the scatter count that triggered it (Corey's bonus-trigger-*.ogg,
// 2026-09-02). Fired at freeSpinTrigger — the moment the scatters pulse — before the door drops.
export const BONUS_TRIGGER_SOUND_MAP: Record<3 | 4 | 5, 'sfx_bonus_trigger_free' | 'sfx_bonus_trigger_super' | 'sfx_bonus_trigger_feast'> = {
	3: 'sfx_bonus_trigger_free',
	4: 'sfx_bonus_trigger_super',
	5: 'sfx_bonus_trigger_feast',
};

// ---- Lights cut: "lamps out, lamps on" (mode transition, Corey 2026-09-11) ----
// Entering or leaving the SUPER / FEAST rooms the cafeteria LAMPS go out, the world changes in the
// dim room, and the new room's tubes restrike. Nothing blacks the canvas out (the first cut did and
// read as a glitch): every step is a crossfade between two renders of the SAME cafeteria, one lit
// and one with the lamps off, so the door, the board and the rigs stay on screen throughout.
// The invariant that makes it read: THE SKY AND THE ROOM ALWAYS CARRY THE SAME ALPHA. Each room
// render's window bars are lit to match its own sky, so a sky that leads or lags the room shows
// rims that do not belong to the glass. Lamps-out and restrike happen between two renders that
// SHARE a sky, so the sky never moves there; the world change happens in the dark as one
// synchronized room+sky crossfade between the two lamps-off renders.
//   1 doorClose (already painted with the intro)   4 hold
//   2 lamps out: lit -> off, wash deepens          5 restrike: the new room's tubes stutter in
//   3 hold, then the world switch: off -> off        over its off render, sky dead still
//     with the sky in lockstep                     6 bonusIntroShow as before
// Leaving mirrors it. Regular free spins share the base room and keep the door-only transition.
// The sequencer is game/lightsCut.svelte.ts (LightsCut.svelte only wires the events to it) and the
// layers are Background.svelte. All durations are divided by stateBetDerived.timeScale().
export const LIGHTS_CUT = {
	modes: ['super', 'feast'] as BonusMode[],
	offMs: 120, // lamps out: the lit room fades off its own lamps-off render
	holdOutMs: 250, // beat in the dim room before the world changes
	switchMs: 250, // dark-to-dark room + sky crossfade (the world change)
	holdSwitchMs: 200, // beat in the new dim room before its tubes try
	// fluorescent restrike before the tubes hold: [lit level 0..1, ms] steps, played on the LIT
	// layer over the off render. A cafeteria tube never comes on clean: a bright pop, dark, a dim
	// try, dark, a longer flash, a sag.
	restrike: [
		[0.7, 50],
		[0, 80],
		[0.35, 40],
		[0, 130],
		[0.85, 60],
		[0.5, 50],
	] as [number, number][],
	onMs: 220, // final warm-up from the last step to full brightness
	// extra wash alpha (over BACKGROUND_WASH) while the lamps are out, so the whole scene reads
	// darker and not just the backdrop; it follows the lamps, deepening and lifting with them.
	washExtra: 0.15,
	// SFX hooks (Corey's side): a breaker thunk at the cut and a tube tick-buzz at the restrike.
	// Wired in LightsCut.svelte once sfx_lights_off / sfx_lights_on exist in the audiosprite.
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

// ---- Bonus-intro art ----
// The mode header and the free-spin count are PAINTED on the steel door (game/doorPaint.ts).



