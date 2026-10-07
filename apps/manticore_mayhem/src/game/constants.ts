import { quadIn, quadOut, quartIn, backIn, backOut } from 'svelte/easing';

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
/** THE SYMBOLS FIT INSIDE THE LATTICE CELLS (Corey 2026-10-06 21:32): the drawn tile (CELL_FILL) and the
 *  multiplier badge (size AND offset) are scaled by this so the opaque symbol art and the badge disc clear
 *  every bar edge and rivet of the lattice (board_v4h since 2026-10-07 11:35; still 0.81) by 1 master px
 *  (landscape, portrait) / 1.5 screen px (phone). Solved per cell over all 64 cells and every static tile by
 *  tools/build_board_layers.py (prints it, and BOARD_ART.symbolFit records it): 0.81, bound by the bottom-right
 *  cell (the wide l2 against the side bar, where the 4 degree tilt narrows the lattice). v4h: the opening is
 *  SQUARE, so rows 0 and 7 are held to the top / bottom outer bars like every other bar (BOARD_ART.holdRows; no
 *  overhang, clearance beyond the margin landscape 1.14, portrait 0.10, phone 0.32 master px) and every
 *  crossing counts as a rivet (v4i: the real top and bottom bars' rivets; the top rail's bar clips are gone). Up to v4g the lattice was
 *  wider than tall and those two rows hung over the top / bottom outer bars by a few px. */
// v4k (2026-10-07): bars thinned to 0.64 of v4j and the lattice rivets dropped; the solver reaches 0.86 in every
// layout (landscape 0.90), still bound by the l2 in the bottom-right cell under the tilt.
export const SYMBOL_FIT = 0.86;
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
// Everything is authored at normal speed and divided by timeScale() (TURBO_SCALE: turbo 2.2, instant 4)
// at playback, so turbo compresses the whole choreography uniformly.

/** style-time divisor by turbo level (0 normal, 1 turbo, 2 instant). Corey 2026-10-06: "2.2 feels right for
 *  turbo 1 and instant feels like turbo 2". Manticore-local: the shared stateBet.timeScale() is a 1 / 2 switch
 *  and Angry Mantis (frozen) keeps using it. */
export const TURBO_SCALE = [1, 2.2, 4] as const;
// MOTION PASS 1 (Corey 2026-10-05, Manticore Motion Playground preset "Corey 2026-10-05", "final with
// the placeholder shapes; may change with real symbols"). Every number below is the playground's.
export const DROP = {
	/**
	 * Every tile that enters the board starts ABOVE it (Corey 2026-09-23: "full drop in, they
	 * currently half drop in"). A column's incoming symbols are stacked in order above row 0 with
	 * this much clearance from the top edge, so the board mask hides them until they fall in.
	 */
	clearance: 2.9,
	/**
	 * One gravity for the whole column: a fall of D cells takes gravityMs * sqrt(D), which is what
	 * constant acceleration gives. Two tiles that start together under the same acceleration keep
	 * their gap until the lower one lands, so a stacked column can never overtake or overlap itself
	 * whatever mix of distances it has (the old per-cell linear timing could). 8 cells = 525 ms.
	 */
	gravityMs: 185.6,
	/** ms between columns of a full reveal (left to right) */
	columnStaggerMs: 67,
	/** ms between rows within a column on a full reveal (the bottom row lands first) */
	rowStaggerMs: 36,
	easing: quartIn,
};

/** landing beat: squash wide-and-short on contact (about the tile's BOTTOM edge), settle back through
 *  a small overshoot, and a hop back up (bounce) that runs alongside the squash */
export const GRAVITY_DROP = {
	squash: 0.25,
	squashMs: 85,
	settleRatio: 0.11,
	settleMs: 95,
	/** the tile lifts this many cells over bounceMs (sine), from contact */
	bounceCells: 0.08,
	bounceMs: 145,
};

/** per-symbol landing animation (tools/SYMBOL_SHEETS.md, sheets from tools/pack_symbol_sheets.py).
 *  squash: GRAVITY_DROP's sprite squash for this symbol (L4 bakes its own stamp squash into its drop
 *  frames, so the sprite must not squash it again). dropFrom: the first drop frame the game plays
 *  (S frames 0..5 show the fall inside the frame and the game already moves the sprite; L3 frame 0 is
 *  only the identity check). idle: whether a moving idle loop exists; without one the cell rests on
 *  its last drop frame (L3 has none, L2's is a single still). The frame COUNT always comes from the
 *  loaded sheet, never from here. */
export type SymbolAnim = { squash: number; dropFrom: number; idle: boolean };
export const SYMBOL_ANIM_DEFAULT: SymbolAnim = { squash: GRAVITY_DROP.squash, dropFrom: 0, idle: true };
export const SYMBOL_ANIM: Partial<Record<string, Partial<SymbolAnim>>> = {
	L4: { squash: 0 },
	S: { dropFrom: 6 },
	L3: { dropFrom: 1, idle: false },
	L2: { idle: false },
};
const symbolAnimCache = new Map<string, SymbolAnim>();
/** cached per name: safe to call every frame (no allocation after the first call) */
export const symbolAnim = (name: string): SymbolAnim => {
	let a = symbolAnimCache.get(name);
	if (!a) symbolAnimCache.set(name, (a = { ...SYMBOL_ANIM_DEFAULT, ...SYMBOL_ANIM[name] }));
	return a;
};
/** the sheets' frame rate, in STYLE time (divided by timeScale like every other duration) */
export const SHEET_FPS = 30;

/** a winning cluster's highlight, and the removal that follows it */
export const CLUSTER = {
	/** several clusters on one landing present one after another ('sequence'); 'together' is the
	 *  playground's other mode and is not implemented here */
	clusterMode: 'sequence' as const,
	/** sequence mode: cluster i+1 starts at max(cluster i start, cluster i removal end + this).
	 *  Negative overlaps: the next cluster starts before the previous one has finished leaving. */
	clusterGapMs: -1800,
	/** the winners grow to this while the readout is up */
	winScale: 1.13,
	winRiseMs: 90,
	winEasing: backOut,
	/** how long a cluster's readout is held (after the count-up) before the tiles leave */
	holdMs: 800,
	/** non-winners dim to this while the win set is presented (ONCE per win set, not per cluster) */
	dimAlpha: 0.5,
	dimMs: 35,
	/** the winners of the next cascade glow for this long as they land (presentation only) */
	auraMs: 230,
	/** the removal pop: grow a hair, then shrink away to nothing */
	removeStyle: 'shrink' as const,
	removeMs: 135,
	removeEasing: quadIn,
	/** after the last removal, before the refill drops (MULT_PLATE, Corey 2026-10-07 13:25: was 0), so a
	 *  plate's count-over (changeDelayMs + changeMs) plays before the refill lands on it */
	refillDelayMs: 400,
	/** the readout's height as a share of one cell */
	readoutHeight: 0.42,
};

/** the cluster readout: "base  xmult" sit apart, slam together, punch, count up in place, then
 *  CLUSTER.holdMs. The numbers shown are the book's (win.p, win.m, win.w); a win with no tile
 *  (m = 0) skips the raw / slam phases and counts 0 -> w. */
export const READOUT = {
	rawMs: 200,
	/** how far apart the amount and the multiplier sit before the slam, in cells */
	rawGapCells: 0.4,
	slamMs: 225,
	slamEasing: backIn,
	/** the merged amount pops to this on impact */
	slamScale: 1.2,
	slamPunchMs: 400,
	countMs: 420,
	countEasing: quadOut,
	/** the raw parts' colours: the amount, the multiplier */
	amountTint: 0xf2b63c,
	multTint: 0x5fd3c8,
};

/** sparkle burst on each cleared cell (components/BoardCells.svelte). A new random pattern every
 *  burst; the refill does NOT wait for the sparkles. */
export const SPARKLE = {
	lifeMs: 900,
	/** particles per cell; the low device tier caps it at `countPhone` */
	count: 40,
	countPhone: 40,
	spreadCells: 0.55,
	/** dot radius in board px at the start of its life, before the per-dot 0.6..1.4 roll */
	sizePx: 2.5,
	gravity: 0.5,
	shape: 'dot' as const,
	/** 'tile': tinted the cleared symbol's colour (SYMBOL_COLORS) */
	color: 'tile' as const,
	/** cells burst in order of distance from the cluster centre, this far apart */
	staggerMs: 21,
	/** a white flash on the cell well at the burst, over the first 30% of the life */
	cellFlashAlpha: 0.5,
	/** the particle pool is sized once at mount for this many cells bursting at once (a burst lasts
	 *  lifeMs, bursts are staggerMs apart, so lifeMs / staggerMs cells can be in flight) */
	maxCells: 43,
};

/** the spin total (components/SpinWin.svelte): a running bump as each cluster's count-up finishes,
 *  then the final presentation after the last refill. finalRiseMs 0 / finalCountMs 0 = it just sits. */
export const SPIN_TOTAL = {
	bumpScale: 1.2,
	bumpMs: 140,
	finalDelayMs: 150,
	finalRiseMs: 0,
	finalScale: 1,
	finalEasing: backOut,
	finalCountMs: 0,
	finalHoldMs: 280,
};

/** the aura's colour (the playground's landing glow) */
export const AURA_COLOR = 0x7cff8a;

/** each symbol's tile colour, for the 'tile' sparkle colour (the placeholder plate hues from
 *  apps/manticore_mayhem/tools/make_placeholders.py SYMBOLS; retune when the real art lands) */
export const SYMBOL_COLORS: Record<string, number> = {
	L1: 0x8a929a,
	L2: 0xc4bcaa,
	L3: 0x6c8a7a,
	L4: 0x2eb0a8,
	M1: 0x7692b0,
	M2: 0x967884,
	M3: 0xc49e4a,
	H1: 0xe2b648,
	W: 0xd4af37,
	S: 0xd04040,
};

/** The frame art's on-screen level (Corey 2026-10-06 21:32: "TOO BRIGHT", it glowed against the courtyard).
 *  A sprite / mesh TINT on the frame and the chains (components/BoardFrame.svelte), not a filter: free, and
 *  it keeps the art's own contrast. The proper fix is a darker re-render of the board layers (the
 *  render_layers_tilt.py exposure) once Corey picks the level; then these go back to 0xffffff. */
export const FRAME_ART = { tint: 0xb4b4b4, chainTint: 0xb4b4b4 };

// ---- The multiplier plates (MOTION_SPEC "Dim rule ... and multiplier plates", LOCKED Corey 2026-10-07 13:25) ----
// A multiplier is a property of the CELL, drawn as a plate UNDER the symbol (the old top-right badge is
// retired): a translucent rounded fill and a bright border in one colour per value, and a large "x<value>"
// from the numerals atlas with a soft glow, at numberAlphaUnderSymbol while a symbol covers it and 1 when it
// is exposed. On a clear: the reveal pop (revealPopScale over revealPopMs) and, changeDelayMs after the
// symbol has left, the value COUNTS over (the old number shrinks away over the first 45 % with quadIn, the
// new one grows in with backOut) over changeMs while the plate colour lerps old -> new (quadOut).
// Drawn by components/BoardCells.svelte; the timing is stateGame's (plateChange). px are playground px
// (x PLAYGROUND_PX at draw time); ms are style time.
export const MULT_PLATE = {
	style: 'plate' as const,
	colors: { 2: 0xe32400, 4: 0xea4d00, 8: 0xf07500, 16: 0xf79e00, 32: 0xfec700, 64: 0xffe37f, 128: 0xfff1bf, 256: 0xffffff } as Record<number, number>,
	fillAlpha: 0.46,
	borderAlpha: 0.82,
	borderPx: 2.5,
	/** inside the cell's clear lattice opening (see BoardCells: the playground's cell well is the opening here) */
	insetCells: 0.01,
	cornerPx: 8,
	/** the number's FONT SIZE (Barlow Condensed 700, the playground's canvas px) as a share of a cell:
	 *  0.48 per Corey 2026-10-07 (the locked spec said 0.46). Never shrunk: a value wider than the plate
	 *  closes its tracking instead (BoardCells layoutPlate) */
	numberSizeCells: 0.48,
	numberAnchor: 'centre' as const,
	numberAlphaUnderSymbol: 0.56,
	numberGlowPx: 12,
	symbolAlphaOnPlate: 1,
	symbolScaleOnPlate: 1,
	revealPopScale: 1.3,
	revealPopMs: 60,
	changeStyle: 'count' as const,
	changeMs: 600,
	changeDelayMs: 100,
};
/** the plate colour for a value: the log2 ramp's nearest step, clamped to x2..x256. Corey 2026-10-07: x128 is
 *  pale gold and white is kept for x256 (the math's ladder caps at 128 today, so white is headroom). */
export const plateColor = (v: number) => MULT_PLATE.colors[Math.max(2, Math.min(256, 1 << Math.round(Math.log2(Math.max(2, v)))))] ?? MULT_PLATE.colors[2];

/** the manticore's set pieces share these. The swipe and the roar have their own blocks below. */
export const FEATURE_FX = {
	/** flashCells' default strength (a feature colour flash on a set of cells) */
	swipeFlashAlpha: 0.55,
};

/** The playground draws on a 66.5 px cell ((560 - 28) / 8); every px value Corey tuned there is in
 *  those px. The board is SYMBOL_SIZE units a cell, so a playground px is this many board units
 *  (landscape's on-screen cell is 66 master px, so on a desktop the two read the same size). */
export const PLAYGROUND_PX = SYMBOL_SIZE / 66.5;

// ---- The claw swipe (MOTION_SPEC "Claw swipe", LOCKED Corey 2026-10-06 10:02 + the slant mapping) ----
// Tears rake right to left across the swiped band, hold, then fade while the band's symbols leave;
// the refill drops after max(exitMs, tearFadeMs). Drawn by components/ClawSwipe.svelte (raw Pixi,
// polygons only, no filters); the cells' exit is the board engine's (stateGame.swipeBand).
// Every px is playground px (x PLAYGROUND_PX at draw time); every ms is style time.
export const SWIPE_FX = {
	tearCount: 4,
	/** 'rows': the slant comes from the event's rows (top band slantTopDeg, bottom band slantBottomDeg);
	 *  'fixed': tearSlantDeg */
	slantMode: 'rows' as 'rows' | 'fixed',
	slantTopDeg: -6,
	slantBottomDeg: 3,
	tearSlantDeg: -3,
	/** random y jitter along each tear's centreline (26 segments) */
	tearJitterPx: 5,
	/** the core's thickness */
	tearThickPx: 9.5,
	/** the hot bands' width outside the core, before the spikes */
	tearEdgePx: 6.5,
	tearEdgeColor: 0x000000,
	/** the glow under the bands (the playground's shadowBlur, here a stack of soft strokes) */
	tearGlowColor: 0xff2600,
	tearGlowAlpha: 1,
	tearGlowPx: 10,
	/** torn-paper spikes on the bands' outer side (78 segments, alternating 1.0 / 0.25) */
	tearEdgeJitterPx: 9.5,
	/** the bands show the board captured at the swipe's start at this alpha (flipped on the top band) */
	tearReflect: 0.8,
	/** the core cuts through the symbols to the bare board, then black at this alpha over it */
	tearCoreAlpha: 0.7,
	/** each tear is revealed right to left over this (quadOut) */
	tearSweepMs: 110,
	/** between tears, top to bottom */
	tearStaggerMs: 5,
	tearHoldMs: 370,
	tearFadeMs: 380,
	/** how the swiped symbols leave, starting with the tears' fade */
	exit: 'fade' as const,
	exitMs: 260,
	/** slideLeft only (not chosen) */
	slideCells: 1.3,
	/** the board kick on the last tear: (0.6k, k), k = kickPx (1 - u) sin(6 pi u) */
	kickPx: 5,
	kickMs: 180,
	/** after the symbols have gone, before the refill */
	refillDelayMs: 0,
};

// ---- The roar (MOTION_SPEC "Roar", Corey 2026-10-06 17:44, kick sync after) ----------------------
// shakeLoose: every low rattles harder and harder, then drops off; bottom rows leave first. Nothing
// is drawn for the wave (waveMs only spreads the leave times). The multiplier tiles under the lows
// are untouched (EVENT_SCHEMA). Cells: stateGame.roarBlow; the cell flash: ClawSwipe.svelte's well layer.
export const ROAR_FX = {
	style: 'shakeLoose' as const,
	from: 'right' as const,
	/** the shout before anything moves; the roar SFX lands at its start */
	windupMs: 350,
	/** leave time = windupMs + rattleMs + waveMs * (1 - (row + 0.5) / 8) */
	waveMs: 600,
	rattleMs: 800,
	/** the rattle grows as u^1.5 to this, x sin / y cos at 1.3x (0.6 of it), twist rattleRotDeg */
	rattleAmpPx: 2.5,
	rattleHz: 10,
	rattleRotDeg: 0.5,
	/** each low falls exitDistCells (quadIn) over exitMs with 0.3 x exitSpinDeg, fading over the last 40% */
	exitMs: 450,
	exitDistCells: 1.3,
	exitSpinDeg: 20,
	/** the cell flashes this colour as its low leaves (fading over the first 120 ms of a 240 ms beat) */
	flashAlpha: 0.4,
	flashColor: 0xd64a2a,
	flashMs: 240,
	/** 'withRattle': the board kicks (0.6k, k), k = kickPx u^1.5 sin(2 pi rattleHz t), over the whole
	 *  rattle window (first rattle start to last rattle end) */
	kickSync: 'withRattle' as const,
	kickPx: 6,
	refillDelayMs: 0,
};

// ---- The board's chains (LOCKED Corey 2026-10-06 21:01 in the playground) ------------------------
// The chain ends ride the kicked frame (the leaned top link stays joined to link 00) and only the middle
// lags. components/BoardFrame.svelte draws each run as a vertex strip, s = 0 at the top pivot .. 1 at the
// bottom anchor:
//   k       the kick's scalar (boardKick is (0.6 k, k)), in PLAYGROUND px so the feel is the same at every
//           layout's scale
//   lag     a first-order filter on k, time constant lagMs
//   spring  d'' = w^2 (gain lagged k - d) - 2 zeta w d', w = 2 pi settleHz; zeta = damping while |k| >
//           0.05 px, else min(damping, 3 / (w settleAfterMs / 1000)) so the chain keeps swinging after the
//           board has stopped and dies to ~5 % over settleAfterMs. Fixed 2 ms steps.
//   point   anchor(s) + kick + (D - kick) bow(s), D = (0.6 d, vertical d),
//           bow(s) = sin(pi s) (1 - s) + bottomAllowance s
// Times are style time, divided by stateGameDerived.timeScale() at runtime.
export const CHAIN_BOW = {
	endsFollowFrame: true,
	gain: 10,
	lagMs: 54,
	settleHz: 14.5,
	damping: 0.55,
	settleAfterMs: 650,
	bottomAllowance: 0.1,
	vertical: 0.4,
	segments: 10,
	// THE HAUL (LOCKED Corey 2026-10-07 13:25): the chains are a continuous loop into the cap and the plinth.
	// Each run is a seamless two-link tile repeating along the strip (tools/build_board_layers.py); on every
	// spin press, after haulDelayMs, the texture scrolls DOWN by haulLinks link pitches over haulMs with
	// haulEasing (accumulating, modulo the tile). The bow displacement above is independent of it.
	haulOnSpin: true,
	haulLinks: 1,
	haulDelayMs: 80,
	haulMs: 1280,
	haulEasing: backOut,
};

/** the flat backing behind the cell wells and the tiles, under the board kick: covers the frame's
 *  inner opening (the cell area plus the inset). A texture replaces the colour when Corey has the
 *  asset (BoardFrame.svelte draws it). */
export const BOARD_BACKING = { color: 0x000000 };

// ---- The sting (RULE_PASS_2 section F) ----------------------------------------------------------
// Four kinds, one presentation each, all driven by the book's `kind`:
//   normal  a fast tail hit on the one cell; several fire back to back with `gapMs` between them
//   big     a charge-up beat (the rest of the board dims, the shape pulses), then the whole plus
//   super   the same beat, the 3x3 block, a longer charge and a heavier hit
//   scatter the board is already at rest: SCATTER_STING below (hold, the normal tail hit per scatter,
//           the anticipation ladder, the trigger pulse)
// Every number here is style time and is divided by stateGameDerived.timeScale() at playback.
// The visuals are components/Sting.svelte, which is kind-driven so a Spine rig can replace the
// placeholder strike without touching this file or the handler.
// LOCKED Corey 2026-10-06 10:36 (MOTION_SPEC "Sting"); the scatter beat moved to SCATTER_STING (18:29).
export const STING = {
	/** a normal hit: the tail streak winds up, the symbol flips at `hitAt` of it */
	normalMs: 430,
	/** between two stings of the same spin */
	gapMs: 150,
	/** big / super: the charge-up before the shape turns */
	chargeMs: 300,
	superChargeMs: 990,
	/** big / super: the shape turning wild together */
	bigHitMs: 540,
	/** where in a hit the symbol actually changes (share of the hit) */
	hitAt: 0.72,
	/** peak scale of a struck cell (sin over the whole hit), by weight */
	popScale: 1.5,
	bigPopScale: 1.45,
	/** the charge pulse on the shape: amplitude (0 = the cells do not pulse) and beats in the charge */
	chargePulse: 0,
	chargeBeats: 3,
	/** everything outside a big / super shape dims to this over dimMs, back over undimMs after the hit */
	dimAlpha: 0.32,
	dimMs: 200,
	undimMs: 400,
	/** the white flash on a struck cell at the hit, fading over 120 ms */
	flashAlpha: 0.25,
	/** normal: one ring per cell, 0.22 -> ringScale / 2 cells over ringMs (quadOut, fades) */
	ringMs: 180,
	ringScale: 1.2,
	/** big / super: bigRings rings from the shape centre, bigRingGapMs apart, each 0.2 -> reach cells
	 *  over bigRingMs, reach = bigRingReach x (plus 1.5, 3x3 1.5 sqrt 2), width bigRingPx shrinking 60% */
	bigRingMs: 200,
	bigRingReach: 0.6,
	bigRingPx: 16,
	bigRings: 2,
	bigRingGapMs: 30,
	/** normal: the tail streak from off the top-right corner into the cell during the wind-up */
	streak: true,
	streakPx: 6,
	wildColor: 0xffd76a,
	scatterColor: 0xffe08a,
} as const;

// ---- The scatter sting (MOTION_SPEC "Scatter sting", LOCKED Corey 2026-10-06 18:29) ---------------
// The reveal lands one (or more) scatter short. On the scatter-kind stings the resting board holds holdMs
// with everything but the scatters darkened to holdDimAlpha (the dim rule: a darkening, never alpha; the
// envelope is sin(pi u)^0.5 over each hold, the playground's), the scatters' glow breathing at holdPulseHz
// (holdPulse 0: they do not scale). Each missing scatter is stung in with the normal streak / hitAt / pop
// over hitMs, the cell becoming S with the STANDARD scatter landing ring + glow over landMs (reach
// landRingScale / 2 cells) and the house scatter SFX. THE LADDER: after the k-th stung scatter lands the
// board holds (same dim) waitMs[k]; beyond the list it climbs by max(0, w[2] - w[1]); the LAST one waits
// the NEXT rung (lastWaitsOneMore). Then every scatter pulses together over triggerMs at triggerScale with
// the house bonus-confirm SFX. How many stings come is the book's; the beat is presentation only.
export const SCATTER_STING = {
	holdMs: 1410,
	holdPulse: 0,
	holdPulseHz: 2.1,
	holdDimAlpha: 0.75,
	hitMs: 240,
	waitMs: [710, 1410, 0],
	lastWaitsOneMore: true,
	landMs: 420,
	landRingScale: 1.6,
	triggerMs: 800,
	triggerScale: 1.2,
	scatterColor: 0xffe08a,
};
/** the ladder's k-th rung (0-based): waitMs[k], then climbing by max(0, w[2] - w[1]) per step */
export const scatterRung = (k: number) => {
	const w = SCATTER_STING.waitMs;
	return k < w.length ? w[k] : w[w.length - 1] + (k - (w.length - 1)) * Math.max(0, w[w.length - 1] - w[w.length - 2]);
};
/** the wait after the k-th of n stung scatters (0-based); the last waits the next rung */
export const scatterWait = (k: number, n: number) => (k < n - 1 ? scatterRung(k) : SCATTER_STING.lastWaitsOneMore ? scatterRung(k + 1) : scatterRung(k));

// ---- The scatter tease in EVERY mode (MOTION_SPEC "Scatter tease", LOCKED Corey 2026-10-06 18:52) ----
// A PolyMath Games standard. Derived in the frontend from the reveal's board (which columns carry a
// scatter, in landing order by column), never from the book's anticipation array (that stays Mystery's,
// ANTICIPATION below, untouched). Once the THIRD scatter is REVEALED (its centre crosses the board's top
// edge during its fall, solved on the drop easing), every column behind it holds above the board (holdMs x
// holdDecay^i, floored at holdFloorMs, chained from that moment), falls fallSlow slower, and shows the beam
// and the rain from components/Anticipation.svelte (NO edge spill). The rain locks to the incoming stack
// once the column launches and lasts until it lands; the beam fades over fadeMs from the launch. The landed
// scatters breathe (landedPulse at landedPulseHz) until the drop ends. Hit (a 4th scatter on the board):
// SCATTER_STING's trigger pulse. Miss: a missHoldMs rest. The frontend only reads the board it was given.
export const ANTICIPATION_TEASE = {
	triggerAfter: 3,
	holdMs: 700,
	holdDecay: 0.82,
	holdFloorMs: 300,
	fallSlow: 1.7,
	fadeMs: 260,
	beamAlpha: 0.75,
	beamColor: 0xffe08a,
	beamSwing: 0.13,
	beamPeriodMs: 840,
	spillAlpha: 0,
	spillWidth: 0.2,
	rainAlpha: 0.2,
	rainSpeedCellsPerS: 5.5,
	rainStretch: 1.12,
	rainGhosts: 1,
	rainGhostOffset: 0.1,
	landedPulse: 0.05,
	landedPulseHz: 1.5,
	missHoldMs: 500,
};

// ---- Scatter tease on a Mystery reveal (RULE_PASS_2 section D) -----------------------------------
// Angry Mantis's Anticipation.svelte, adapted from five spinning reels to an 8x8 drop: an
// anticipated COLUMN holds above the board before it falls, falls slower when it does, and shows
// the searchlight / rain / edge-spill tease while it waits. The array comes from the book and is
// used VERBATIM in Mystery only ([0,0,0,1,1,1,1,1] there); every other mode ignores it.
export const ANTICIPATION = {
	holdMs: 700, // the first teased column's hold at normal speed
	holdDecay: 0.82, // each further teased column holds this much of the previous one
	holdFloorMs: 300,
	fallSlow: 1.7, // a teased column falls this much slower than a normal one
	fadeMs: 260, // the tease cross-fades out over the column's fall
	strength: [0.75, 0.5, 0.3], // beam + spill alpha multiplier by turbo level
	rainSpeed: 0.55, // cells/ms down the column
	rainAlpha: 0.2,
	rainStretch: 1.12,
	rainGhosts: 1, // ghost copies per loose symbol, either side (cheap motion blur; house rule: no filters)
	rainGhostOffset: 0.1, // cells between the ghosts
	beamOriginY: -0.55, // beam pivot above the column, in column heights
	beamLength: 1.9,
	beamHalfWidth: 0.24,
	beamSwing: 0.13, // radians either side of straight down
	beamPeriodMs: 840,
	spillWidth: 0.1, // edge glow width at the start of the hold, in cells
	spillGrow: 0.42,
	spillAlpha: 0.12,
	spillAlphaGrow: 0.4,
} as const;

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
	/** the spin win readout's fade */
	winClearMs: 320,
};

/** the SKIP TO RESULT plate (components/SkipButton.svelte); placement is layoutSpec HUD.skipButton */
export const SKIP_BUTTON = {
	inMs: 220,
	outMs: 120,
	/** the drawn plate's height inside the (taller) hit area, and its inset from the slot's sides */
	plateHeight: 40,
	plateInset: 0,
	radius: 7,
	plateColor: 0x0d0e12,
	plateAlpha: 0.82,
	edgeColor: 0x9fd9d4,
	edgeAlpha: 0.32,
	highlightAlpha: 0.14,
	textTint: 0x9fd9d4,
	/** glyph height as a share of the plate height */
	textShare: 0.4,
	pressedAlpha: 0.6,
} as const;

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
