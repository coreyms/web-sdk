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

/** THE RENDERER'S RESOLUTION CAP (components/Game.svelte clamps renderer.resolution to it; game/deviceTier.ts
 *  renderResolutionCap() picks one). It was 1.5 for every device, a house rule that came from iOS performance.
 *  Corey 2026-10-09: "Yes let's raise the resolution to 2x on Desktop". The phone asset tier (PHONE_TIER) keeps
 *  1.5 exactly as before; everything else is capped at 2. A DPR 1 desktop was never capped and is unchanged. */
export const RENDER_RESOLUTION_CAP = { phone: 1.5, desktop: 2 } as const;

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

/** THE BOARD EXIT (Corey 2026-10-09, played on an iPhone: "there is no symbol drop out animation ... the
 *  symbols need to fall off the board"). The previous board falls off the BOTTOM of the opening the way
 *  Angry Mantis's reels empty (its SPIN_OPTIONS fall-out: 60 ms between reels, 25 ms between rows with the
 *  bottom row first, every tile the same ~255 ms quadIn fall, tipping 0.45 rad, alternate cells opposite
 *  ways). Style time like everything else here (divided by TURBO_SCALE), so turbo 1 = 27 / 11 / 116 ms and
 *  turbo 2 = 15 / 6 / 64 ms. It starts on the spin press (game/actor.ts, before the book arrives, like the
 *  Angry Mantis pre-spin) or, where there is no press (a free spin, a resume, a synthetic book), at the
 *  reveal; the new board's own drop is not delayed for it: a column's incoming stack waits DROP.clearance
 *  above the opening and only shows 440 ms after its start, 10 ms after that column's last old tile has
 *  gone (175 + 255), so the two never share a column. stateGame.exitGate() checks exactly that and holds the
 *  drop only by what is missing (0 with these numbers). */
export const BOARD_EXIT = {
	/** ms between columns, left to right (Angry Mantis reelFallOutDelay) */
	columnStaggerMs: 60,
	/** ms between rows of a column, the bottom row first (Angry Mantis symbolFallOutInterval) */
	rowStaggerMs: 25,
	/** every tile's fall, whatever its row (Angry Mantis: reel length / symbolFallOutSpeed) */
	fallMs: 255,
	/** how far it falls, in cells: its own board height plus this, so a tipped tile's corner is out too */
	extraCells: 0.25,
	easing: quadIn,
	/** the tile tips this far over its fall, alternate cells opposite ways (Angry Mantis tipRadians) */
	tipRadians: 0.45,
	/** a base spin's multiplier plates (the reveal clears them: the book's rule) shrink away over this
	 *  instead of blinking out under the falling symbols; a feature's carried plates never move */
	plateOutMs: 135,
	/** FREE SPINS never show more than this many scatters at once (a math invariant the pictures must keep):
	 *  the new board's drop is held until enough of the old board's scatters have left (stateGame.exitGate) */
	maxScattersVisible: 3,
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
	/** a cluster's count never lands sooner than this after the one before it (book order: an unmultiplied
	 *  win's readout is rawMs + slamMs shorter than a multiplied one's) */
	countOrderMs: 150,
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
	/** the raw parts' colours: the amount, the multiplier (the STENCIL fallback, drawn only until the forged
	 *  glyph atlas is in: see CLUSTER_LABEL) */
	amountTint: 0xf2b63c,
	multTint: 0x5fd3c8,
};

/** THE CLUSTER LABELS IN THE PLAQUE'S FORGED FONT (Corey 2026-10-09). The per-cluster readout is set in the
 *  win plaque's forged Rakkas glyphs, from the labels' OWN small atlases: the same face baked at the sizes
 *  the labels are drawn (tools/build_plaque_text.py --labels; game/clusterLabel.ts lays a row out,
 *  components/ClusterLabels.svelte draws it as pooled sprites at about 1:1), with the dark outline and soft
 *  shadow baked as a second frame under each face. The amount keeps the face's cream (tint white, as on the
 *  plaque), the multiplier is tinted the title's teal. Sprite tints only. One atlas is preloaded and the
 *  rest are deferred; the stencil readout (Board.svelte) draws only before any is in, or for a character
 *  the atlas lacks. */
export const CLUSTER_LABEL = {
	/** the cap height as a share of one cell (the stencil readout's digit height is CLUSTER.readoutHeight) */
	capCells: 0.4,
	amountTint: 0xffffff,
	/** the teal of the word MAYHEM in the title (tools/make_placeholders.py TURQUOISE = 46, 176, 168; the
	 *  same value as SYMBOL_COLORS.L4) */
	teal: 0x2eb0a8,
	/** the multiplier's sprite tint. A tint MULTIPLIES the glyph's cream face (0xeadec2 at its upper
	 *  quartile, sampled from the plaque's glyph atlas; the label atlases bake the same face), so the plain
	 *  teal would draw darker and greener than the title's; this is `teal` divided by that face, so the lit
	 *  part of the drawn number is `teal` */
	multTint: 0x32cadd,
	/** the row's origin is put on a whole canvas pixel while the label is still (the glyph positions are whole
	 *  texels, so at a scale of 1 it then draws texel on pixel); a moving or punching label is left off-grid */
	snapToPixels: true,
};

/** WHERE THE CLUSTER LABELS SIT (game/labelPlacement.ts, a pure function; self check
 *  tools/manticore/label_place_check.mjs). Corey 2026-10-09: "when multiple clusters are near each other
 *  ... the numbers end up overlapping so we can't see the individual amounts". Each label starts on its
 *  cluster's visual centre (the centroid, snapped onto a cell of the cluster when it falls in a hole),
 *  overlapping labels are pushed apart along the axis of least overlap and kept inside the opening, and a
 *  set that still cannot fit shrinks step by step to `minScale`; whatever still collides then is staggered
 *  in time (the later cluster's readout waits for the earlier one's to leave). */
export const LABEL_PLACE = {
	/** clear space kept between two labels, and between a label and the opening's edge, in cells */
	gapCells: 0.08,
	edgeCells: 0.06,
	/** relaxation passes per size */
	passes: 24,
	/** the sizes tried, largest first; the last is the floor (portrait phone: 0.8 x 0.4 of a ~46 CSS px cell
	 *  is a 15 px cap height, still a readable number) */
	scales: [1, 0.92, 0.86, 0.8],
	/** a label's box is its widest moment: the raw "amount  xmult" pair, or the merged total at its punch */
	padXCells: 0.06,
	padYCells: 0.05,
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
	// 2026-10-09 (Corey): retimed to his charge sounds (sting_big_charge 1.00 s builds to its end;
	// sting_super_charge 2.00 s peaks at about 1.8 s). Were 300 / 990.
	chargeMs: 1000,
	superChargeMs: 1800,
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

// ---- The animated win plaque ("stinger", components/StingerPlaque.svelte, game/stinger/) ---------
// The plaque's art, motion tracks and overlay recipes are data (static/assets/ui/stinger/stinger.json,
// tools/build_stinger_assets.py); what is here is the choreography AROUND them. Every number runs in REAL
// time at every turbo level, the way Angry Mantis's stinger does (its STINGER_MOTION is never scaled): the
// entrance, the text beats, the exit, the idle loop, the flares and every pulse. Turbo shortens the COUNT
// only (winLevelMap presentDuration / timeScale(), split by game/stinger/count.ts).
export const STINGER_PLAQUE = {
	/** the entrance: the plaque slams in from above (accelerating, like the tiles), scale settling to 1, fading in */
	enterMs: 250,
	enterDropPx: 60, // ship px of the 946 x 532 plaque frame
	enterScale: 1.12,
	enterFadeShare: 0.6, // the fade in is done after this share of the drop
	/** the impact kicks the board (featureFx.boardKick, the swipe's own formula: (0.6k, k), k = kickPx (1 - u)
	 *  sin(6 pi u), playground px); a tier up kicks lighter, as Angry Mantis's shove does */
	kickPx: 4,
	kickTierPx: 2,
	kickMs: 180,
	/** the touch down: a short squash about the panel centre, then back */
	squashMs: 100,
	squash: 0.015,
	/** the exit: a lift with a fade */
	exitMs: 200,
	exitLiftPx: 60,
	/** land_flare frame 2 is the impact (stinger_eye_flare_fx.json timing): the flare starts this many frames before it */
	landFlareLeadFrames: 2,
	/** the overlap rule: the old flare delta blends out over this while the new one starts from zero */
	flareBlendMs: 100,
	/** the beats after the impact / a tier up (stinger_eye_flare_fx.json "timing") */
	eyeFlareDelayMs: 33,
	glintLandDelayMs: 300,
	glintTierHoldMs: 700,
	/** a tier step eases the veins (base, peak, tint, glow, period) over this */
	veinStepMs: 400,
	/** barb charge one shot: min(1, peak + chargeLift) decaying over chargeMs */
	chargeMs: 500,
	chargeLift: 0.25,
	// ---- THE TEXT (stage 2; the approved timing mocks, drafts/stinger_timing_review). T0 = the impact --------
	/** the title punches in at T0 + titleDelayMs: scale titlePunchFrom to 1 with a back out overshoot, alpha over titleFadeMs */
	titleDelayMs: 80,
	titlePunchMs: 160,
	titlePunchFrom: 1.35,
	titleFadeMs: 100,
	/** an Epic / Max title's halo fades in behind it */
	titleGlowMs: 200,
	/** the amount appears at T0 + amountDelayMs and the count starts there */
	amountDelayMs: 150,
	amountFadeMs: 80,
	/** a tier up at T (the count runs on): the old title scales to tierOldScale and fades over tierOldOutMs; the new
	 *  one starts at T + tierTitleDelayMs, scale tierTitleFrom to 1 over titlePunchMs, alpha over tierTitleFadeMs;
	 *  the amount pulses once to tierPulse (up over tierPulseUpMs, back over the rest of tierPulseMs) */
	tierTitleDelayMs: 33,
	tierTitleFrom: 1.4,
	tierTitleFadeMs: 60,
	tierOldOutMs: 60,
	tierOldScale: 1.15,
	tierPulseMs: 250,
	tierPulseUpMs: 120,
	tierPulse: 1.12,
	/** the count's end: the amount pulses to endPulse (half up, half back) and brightens (an additive copy at
	 *  endBrighten, gone after endBrightenMs); one glint sweep glintEndDelayMs later (glintTierHoldMs when the last
	 *  tier landed on the same frame) */
	endPulseMs: 260,
	endPulse: 1.15,
	endBrighten: 0.6,
	endBrightenMs: 120,
	glintEndDelayMs: 100,
	/** a digit is added: the centred row starts offset so the digits already there do not jump, and eases back (cubic out) */
	amountSlideMs: 180,
	/** the intro's rows: each fades in and rises rowRisePx (ship px), the first at T0 + rowsDelayMs, rowStaggerMs apart */
	rowsDelayMs: 200,
	rowStaggerMs: 90,
	rowFadeMs: 200,
	rowRisePx: 10,
	/** the wrap up's line fades in once the end pulse is over */
	lineFadeMs: 200,
	/** the exit: the text is gone after textExitMs while the plaque lifts for exitMs */
	textExitMs: 150,
	/** the wrap up never counts faster than this (Angry Mantis: Math.max(1200, presentDuration / timeScale)) */
	wrapMinCountMs: 1200,
	/** holds once the screen has settled, when no press is asked for (auto bonuses / replay): the win's is what
	 *  the plain screen used, the wrap up's is Angry Mantis's (it presses on a second after the count) */
	winAutoHoldMs: 400,
	/** THE WIN PLAQUE NEVER ASKS FOR A PRESS (Corey 2026-10-09): once its count has landed it holds this long and
	 *  leaves by itself (winAutoHoldMs instead while auto bonuses / a replay run). Real time at every turbo level,
	 *  like the entrance and the exit. A press during the hold only ends it early. */
	winHoldMs: 1200,
	wrapAutoHoldMs: 1000,
	/** THE PLAQUE'S OWN MOTION (Corey 2026-10-09: "some slight motion to the object itself ... it needs to remain
	 *  readable"). ONE rigid transform on the whole plaque (frame, lions, overlays, embers, title, amount, lines:
	 *  game/stinger/view.ts writes it on the body, about the panel centre), in MASTER px and degrees, real time at
	 *  every turbo level. The scene dim, the board and the placement other code reads do not move.
	 *    hover   the idle drift: y = px sin(2 pi t / periodMs), tilt = deg sin(2 pi t / tiltPeriodMs); the two
	 *            periods are not commensurate, so it never reads as a loop. Zero phase at the impact, faded in
	 *            over the settle, so nothing jumps.
	 *    settle  after the slam: a damped rock, px e^(-decay u) sin(2 pi cycles u) and the same for deg, u = 0..1 over ms
	 *    nudge   each tier landing: down px and back with a hint of tilt, one half sine over ms (on top of the board kick)
	 *    calm    while an amount counts, and for the whole feature intro (three lines of small text), the hover is
	 *            scaled by `calm.scale`; it eases back to full over calm.easeMs once the count has landed
	 *    max     THE HARD LIMITS: whatever the values above add up to is clamped to these, so it cannot be tuned unreadable */
	hover: {
		px: 3,
		periodMs: 3200,
		deg: 0.3,
		tiltPeriodMs: 4700,
		settle: { ms: 500, px: 3, deg: 0.4, cycles: 2, tiltCycles: 1.5, decay: 5 },
		nudge: { ms: 180, px: 2, deg: 0.1 },
		calm: { scale: 0.5, easeMs: 300 },
		max: { px: 5, deg: 0.5 },
	},
	/** the veins / embers level of each feature's intro (STINGER_TIERS) */
	introTier: { bonus: 'super', super: 'mega', epic: 'epic' },
	/** eye glow pulse: additive strength low..high of the glow sprite, one cycle per period, a third of a cycle between heads */
	eyePulse: { low: 0.1, high: 0.32, periodMs: 3500 },
	/** blinks, one head at a time: the gap to a head's next blink, the chance of a double and its second start */
	blink: { gapMinMs: 2400, gapMaxMs: 6200, doubleChance: 0.2, doubleGapMs: 300, afterFlareMs: 850 },
} as const;

// ---- The logo (components/Logo.svelte, game/logo/, the HTML chromes) --------------------------------
// ONE stacked logo with wings in every layout (Corey 2026-10-09). Two ways of drawing it, by device tier:
//   phone tier   a static HTML <img> in the chrome (ui/Chrome*.svelte) with the house Shine glint. The chrome
//                is drawn at the screen's own density while the canvas is capped at 1.5, and the breathing is
//                about 2.5 CSS px of tip travel at phone size: not worth a vertex upload.
//   desktop      the animated logo in the canvas, on the landscape master only: entrance, idle breathe, glint,
//                flare, from the layered data (static/assets/ui/logo/, tools/build_logo_assets.py). The same
//                <img> stands in until that data is in, and in the other two layouts.
// Both are placed by ONE rule per layout (game/logo/layout.ts): the box of the logo's ART in master px. Every
// number runs in REAL time at every turbo level.
export const LOGO = {
	/** the static still's art box, px (tools/build_logo_assets.py prints it): only its aspect is used */
	art: { width: 2380, height: 940 },
	/** LANDSCAPE master (1280 x 720): the art's width and centre. The centre is the old placeholder's (160.5, 150)
	 *  moved to the middle of the column left of the board art (0 .. 340); the width is the one the approved
	 *  clips were judged at (logo_review_5, 5_in_game_landscape: 300), which puts the lettering at the
	 *  placeholder's size. */
	landscape: { cx: 168, cy: 150, width: 300 },
	/** PHONE SIDEWAYS master (1480 x 740): the left column, from the clock strip's left edge to the board art's
	 *  post (293), above the BALANCE readout (236). */
	phone: { left: 16, top: 46, width: 274 },
	/** PORTRAIT master (412 x 760, wider on wide screens): the largest box of the art's aspect inside the band
	 *  from `top` (the clock row ends at 25) down to `gapAbove` over the frame art's finial tips (198.8, or 176.6
	 *  where the frame has grown on a wide screen), no wider than maxWidth, centred in that band and on the screen.
	 *  IN A FEATURE the SKIP TO RESULT plate owns the lower part of that band (HUD.portrait.skipButton, from
	 *  115): the logo steps back to the box that ends `gapAbove` over the plate, over compactMs. */
	portrait: { top: 31, gapAbove: 8, maxWidth: 348, compactGap: 4, compactMs: 350 },
	/** the landing screen's logo (ui/LandingScreen.svelte): the art's width and centre per master, above the cards */
	landing: { landscape: { width: 380, cx: 640, cy: 92 }, phone: { width: 380, cx: 740, cy: 92 }, portrait: { width: 348, cx: 206, cy: 110 } },

	// ---- the canvas logo --------------------------------------------------------------------------
	/** the wing vertices are rewritten at most this often (30 a second: every second frame at 60 Hz) */
	vertexIntervalMs: 1000 / 30,
	/** a frame that comes this much early still counts (60 Hz frames arrive 15 to 18 ms apart, not 16.7) */
	vertexSlackMs: 4,
	/** the entrance starts this long after the game first shows (the HUD is fading in) */
	entranceDelayMs: 150,
	/** the entrance's glint: gold from this entrance frame, the red sweep later (frames of 1 / 30 s) */
	entranceGlint: { atFrame: 24, gold: { frames: 18, peak: 0.9 }, red: { delayFrames: 7, frames: 16, peak: 0.6 } },
	/** the idle glint: once per breath (135 frames, 4.5 s), when the idle passes this frame, only at rest */
	idleGlint: { atFrame: 30, gold: { frames: 24, peak: 0.7 }, red: { delayFrames: 11, frames: 21, peak: 0.45 } },
	/** the flare's glint, from the flare's own frames */
	flareGlint: { atFrame: 4, gold: { frames: 11, peak: 1 }, red: { delayFrames: 4, frames: 10, peak: 0.65 } },
	/** A FLARE ON A WIN: when a spin's total is final (spinWinFinal) and it is at least this many times the bet.
	 *  One per spin, never while SKIP TO RESULT runs, never while a flare or the entrance is running, and no
	 *  sooner than flareMinGapMs after the last one started (turbo and autoplay must not strobe it). */
	flareMinXBet: 1,
	flareMinGapMs: 2500,
	/** the logo fades with the HUD's kept elements (a modal, the max win screen): Chrome.svelte's 350 ms */
	fadeMs: 350,
	/** the data came in after the game showed: the canvas logo takes over from the still on its bind pose and
	 *  eases into the breathing over this much rest */
	takeoverBlendMs: 600,
	/** mip chain on the atlas (drawn at 0.3 to 0.9 of its size), as the plaque's full tier has */
	mipmaps: true,
} as const;

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
