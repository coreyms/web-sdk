import { quadIn, quadOut, quartIn, backIn, backOut } from 'svelte/easing';

import type { SymbolName } from './types';
import config from './config';

// ---- FEATURE MENU NAME ----------------------------------------------------------------------
// THE ARMOURY (Corey 2026-10-13; Angry Mantis called it the Chow Line). ONE constant so
// renaming is one edit. The name carries its own article: write "in THE ARMOURY" / "Opens THE ARMOURY", never
// "the ${FEATURE_MENU_NAME} menu" (that read "the THE ARMOURY menu"; game/gameInfoText.ts).
export const FEATURE_MENU_NAME = 'THE ARMOURY';

// ---- THE ARMOURY (the feature menu; spec: ~/Desktop/Manticore Mayhem/feedback/armoury_build_r1/SPEC.md) ----------
// The name's partner values: everything the owner tuned in the prototype (values of 2026-10-13 14:05, locked 14:16),
// every breakpoint and every number a probe checks. Type sizes stay in the component's stylesheet in design px (spec
// 4.6). The reusable parts (ui/armoury/menuFrame.ts, motion.ts, heroGrid.ts, fit.ts) take these as arguments; the
// game's data and copy are game/armouryData.ts and game/armouryText.ts.
/** the desktop hero's pointer centre in the 1440 x 810 design box (spec 4.3); the hero's near spans are its distances
 *  to the box's left and top edges (ARMOURY.hero) */
const HERO_POINTER = { x: 365, y: 271 } as const;
export const ARMOURY = {
	/** the dim over the game: flat colour layers; a new mode's colour fades in over the old one */
	tint: { opacity: 0.72, confirmAdd: 0.12, confirmMax: 0.95, inMs: 50, outMs: 150, crossMs: 400, confirmMs: 170 },
	/** the ease is 1 - exp(-t / tauMs), run for `run` tau (520 ms); large moves (hero, confirm card) use tau * large */
	motion: {
		tauMs: 80,
		run: 6.5,
		large: 1.66,
		/** points of the CSS linear() ease */
		easePoints: 21,
		staggerMs: 49,
		firstTileMs: 30,
		heroAtMs: 120,
		plateAtMs: 200,
		contentAtMs: [200, 240, 280],
		contentFadeMs: 160,
		/** the open: the tray slab's fade, and the name's and the close button's */
		trayFadeMs: 90,
		headFadeMs: 120,
		slide: 80,
		/** portrait, tablet and sideways (commits 7 and 8): every slide is halved there */
		slideTouch: 40,
		swapOutMs: 120,
		heroSwapSlide: 0.45,
		textSwapSlide: 0.25,
		textSwapDelayMs: 30,
		heroSwapRun: 1.25,
		/** CONFIRM is not live before this, then appears in confirmFadeMs (a wrong click guard; kept under reduced motion) */
		confirmGuardMs: 350,
		confirmFadeMs: 80,
		confirmDelayMs: 60,
		/** activate: the tiles not chosen sink this far (desktop) while the tray fades */
		sinkPx: 15,
		cardFrom: { y: 30, scale: 0.92 },
		cardOutMs: 130,
		backMs: 330,
		closeMs: 150,
		closeDoneMs: 170,
		flashMs: 40,
		veilMs: 100,
	},
	hero: {
		follow: 1.0,
		lagMs: 120,
		degPer500: 3,
		maxDeg: 6,
		/** design px of pointer travel from the hero's centre to the grid's outermost yaw / pitch at follow 1, one span per
		 *  side. THE FULL TURN BOTH WAYS (owner 2026-10-14 16:51, "Yes"): the pointer centre is off the box's middle, so the
		 *  near sides take the distance from the centre to the box's edge (left 365, top 271) and a real pointer at the
		 *  box's left or top edge reaches the outermost column or row. The far sides keep 700 and 450, which are inside
		 *  the box (right edge 1075 away, bottom 539): full yaw at x 1065, full pitch at y 721, as before. The desktop box
		 *  is the master rectangle and the small 16:9 frames show the same box scaled, so its edges are inside the window at
		 *  every desktop size: full yaw and pitch at every window edge. A pointer step's motion at the hero's edge is the
		 *  grid's own step (5 degrees, the dagger 2.5, the crown 1), unchanged; only the pointer travel per step on the left
		 *  (365 px for 10 degrees) and the top is shorter */
		yawSpanLeft: HERO_POINTER.x,
		yawSpanRight: 700,
		pitchSpanTop: HERO_POINTER.y,
		pitchSpanBottom: 450,
		/** the desktop hero's centre for the pointer, design px (spec 4.3) */
		pointerCentre: HERO_POINTER,
		/** NO CROSS-BLEND BETWEEN FRAMES, EVER (owner, prototype v9): one opaque frame shows and a change is a hard swap.
		 *  The new frame may fade in ON TOP of the old one (which stays fully opaque under it) only on a step of
		 *  `fromDeg` degrees or more: `ms` at most, ramped as the prototype's fadeFor (0 at fromDeg, `ms` at
		 *  fromDeg + rampDeg). `hold`: a pointer resting near the half way line keeps the frame it has (no flicker). */
		frameFade: { ms: 45, fromDeg: 2, rampDeg: 3, hold: 0.56 },
		parallax: { x: 2.2, y: 1.6, rays: -0.6, shadow: 0.5 },
		breathe: { on: true, scale: 0.012, y: 2.5, periodMs: 5200 },
		idleTurn: { deg: 6, periodMs: 7000, easeMs: 90 },
		/** a decoded grid replaces the flat art by fading in on top of it (the flat art is its straight-on frame) */
		swapInMs: 150,
		/** at most this many hero atlases are held decoded: the one on show and the one before it */
		keepDecoded: 2,
		gridAfterOpenMs: 1000,
	},
	swipe: { startPx: 8, goPx: 40, flickPx: 12, flickSpeed: 0.5, endPull: 0.3, carryPx: 60, backMs: 200, yawPerPx: 0.06, yawMax: 12, clickBlockMs: 350 },
	fit: {
		price: { floor: 18, floorTouch: 15, floorStacked: 13, pad: 64, padTouch: 50 },
		/** tile multiple: room is the tile less `pad` (desktop), `padTouch`, or `padTwoWide` (the phone's two wide tiles) */
		tile: { floor: 14, floorTouch: 11, pad: 22, padTouch: 12, padTwoWide: 70 },
		confirm: { total: 16, row: 13, totalTouch: 13, rowTouch: 11, gap: 14 },
	},
	layout: {
		/** the desktop menu is the 1440 x 810 box over the 1280 x 720 master. `scaledUnderRatio` (owner 2026-10-13
		 *  22:18, "desktop scaled"): where the game shows its phone sideways chrome on a frame narrower than this ratio
		 *  (the 400 x 225 mini player, 800 x 450 popouts, 16:9 phones held sideways), the menu is the desktop box fitted
		 *  to the window, with its own copies of the bet controls. 2.16 to 1 phones keep the sideways layout. */
		desktop: { w: 1440, h: 810, master: 1280, scaledUnderRatio: 1.9 },
		/** portrait phone P1b (page.css 276-392). `nameGap`: when the band above the clock strip is too short for the name
		 *  it goes under the strip and the content starts this much lower (the tablet's 28 / 52). The hero is the piece
		 *  that gives: under `minHero` design px it is dropped (spec risk 4: short phones, browser bars showing). The
		 *  confirm card is `card` design px, centred, `cardGap` under the first content line; on a phone too short for it,
		 *  it is scaled down to the room between that line and the bottom of the content (never over the HUD row) */
		portrait: { w: 390, minHero: 44, gapToHud: 6, underClock: 2, nameBandMin: 16, minHitCss: 44, nameGap: 24, card: { w: 366, h: 549 }, cardGap: 4, rays: { perH: 1.22, max: 300 } },
		tablet: { w: 569, minFrame: 512, maxContent: 720, nameTop: 28, contentTop: 52, cardTop: 40 },
		/** phone sideways (page.css 427-482). The name sits `nameAbove` design px above the HUD's BALANCE label; the rail's
		 *  tiles keep `edge` design px off the right edge (beyond the safe area) and the close sits `edge` px outside them;
		 *  the confirm is the tray's own slab, `slab` wide, `slabTop` down, centred */
		sideways: { w: 844, h: 390, rail: 324, minLeft: 180, hudGap: 8, heroDropUnder: 56, nameAbove: 31, edge: 6, slab: 420, slabTop: 14 },
	},
	/** static/assets/ui/armoury/, made by tools/build_armoury_assets.py (its own copy of these sizes, kept in step) */
	assets: {
		/** FINAL 10 (owner 2026-10-14 16:51, "Yes"; spec 3.4 said 7, on an estimate of 5 to 6 MB of grids). Measured
		 *  2026-10-14 with all six grids at the owner's sizes: 9.25 MB (grids 6.97, phone strips 1.15, menu core 0.81,
		 *  card-frame-lg 0.31). Kept in step with scripts/stamp-assets.mjs and tools/build_armoury_assets.py */
		folderMaxMb: 10,
		thumbCell: 256,
		heroFullH: 640,
		heroHalfH: 320,
		crestH: 96,
		/** the angle grids' frame height (owner 2026-10-13 "640px"); the dagger and the crown at 512 (owner 2026-10-14 10:58
		 *  "Okay 512 then"); the phone tier's strip (the pitch 0 row) at half the grid's frame height */
		gridH: 640,
		gridHFor: { dagger: 512, crown: 512 },
		turnShare: 0.5,
	},
} as const;

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

/** THE SYMBOL OVERHAUL (Corey 2026-10-13 12:06, Symbol Fit Playground v7; values file
 *  images/symbol_fit_r1/values/corey_symbol_fit_2026-10-13_1206_CURRENT.txt; the playground's src/app.js is the
 *  reference). Per symbol: `size` x the old drawn side (SYMBOL_SIZE x CELL_FILL x SYMBOL_FIT, 0.8084 of the pitch;
 *  `global` multiplies every symbol), `dx` / `dy` in DESKTOP MASTER px at the playground's pitch `refPitch` (they scale
 *  with the pitch in every layout: board px = master px / refPitch x SYMBOL_SIZE), `top` the "on top" number.
 *  PLACEMENT: every symbol on the TRUE centre of its lattice opening (BOARD_ART.crossings per cell), not the uniform
 *  tile grid; a tile in the air takes its column's centre interpolated by the row it is passing.
 *  DRAW ORDER (the playground's sort): the POP BAND first (any symbol pulsing or popping: a win pulse, a cluster
 *  removal, a sting pop, the scatter trigger, the tease breathing) draws above every resting symbol (Corey 12:05);
 *  inside each band the "on top" number, then lower rows on top, then the cell. Back to the resting order when the
 *  pop ends. The scatter hanging into the cell below at 1.525 / dy +4.5 is intended.
 *  Symbols draw OVER the bars; the board window does not clip a symbol that is on the board (only a tile still
 *  coming in over the top edge or leaving under the bottom edge is cut at the window: BoardCells' fall layer). */
// Corey 2026-10-16 15:28: the Wild grows to ~89% (x 89/75) and the Key, Dagger and Seal to ~82% (x 82/75); the rest
// stay. Values file: tools/manticore/ref/symbol_fit/corey_symbol_fit_2026-10-16_1528_CURRENT.txt.
export const SYMBOL_PLACE = {
	refPitch: 53.438,
	global: 1,
	symbols: {
		H1: { size: 1.33, dx: 0, dy: 0, top: 7 },
		M3: { size: 1.235, dx: 0, dy: -0.3, top: 6 },
		M2: { size: 1.427, dx: 0, dy: 0, top: 5 },
		M1: { size: 1.37, dx: -1.4, dy: 1.5, top: 4 },
		L4: { size: 1.421, dx: 0, dy: 0, top: 3 },
		L3: { size: 1.575, dx: 0.5, dy: -2.1, top: 2 },
		L2: { size: 1.395, dx: 0, dy: 0, top: 1 },
		L1: { size: 1.285, dx: 0.3, dy: 0, top: 0 },
		W: { size: 1.3, dx: 0, dy: 0, top: 8 },
		S: { size: 1.525, dx: 0, dy: 4.5, top: 9 },
	} as Record<string, { size: number; dx: number; dy: number; top: number }>,
};
/** the pop sizes of the same values (mode 'multiply': the factor multiplies the symbol's own size; every symbol's
 *  "pop x" is 1). The engine's own constants carry them: tease ANTICIPATION_TEASE.landedPulse (1 + 0.185), win pulse
 *  CLUSTER.winScale, scatter trigger SCATTER_STING.triggerScale, sting STING.popScale / bigPopScale, the remove-cells
 *  pop and the cluster removal peak (1.13 x 1.12) in stateGame, the landing squash GRAVITY_DROP. Listed here for the
 *  probe (tools/manticore/symbols_probe.js) to hold them to the values file. */
/** a symbol's drawn size as a multiple of the old uniform side (SYMBOL_PLACE.global x its own size) */
export const symbolScale = (name: string) => SYMBOL_PLACE.global * (SYMBOL_PLACE.symbols[name]?.size ?? 1);
export const SYMBOL_POPS = { tease: 1.185, winPulse: 1.13, scatterTrigger: 1.2, clusterRemoval: 1.266, removeCells: 1.4, bigSting: 1.45, sting: 1.5, squashW: 1.25, squashH: 0.75, mode: 'multiply' as const };
/** THE DARK RIM round every symbol (Corey 2026-10-13 12:06): `masterPx` desktop master px at each symbol's own size
 *  (refPitch above), the silhouette (outline and shadow included) grown by it, softened by a gaussian of `softness` x
 *  max(masterPx, 0.5), `color` at `opacity`, under the art. BAKED into every static, drop and idle cell of both tiers
 *  by tools/pack_symbol_sheets.py (which reads these numbers and SYMBOL_PLACE from this file): no filter, no extra
 *  sprite. */
export const SYMBOL_RIM = { masterPx: 0.7, opacity: 1, softness: 0.39, color: 0x0c0806 };

/** THE RENDERER'S RESOLUTION CAP (components/Game.svelte clamps renderer.resolution to it; game/deviceTier.ts
 *  renderResolutionCap() picks one). It was 1.5 for every device, a house rule that came from iOS performance.
 *  Corey 2026-10-09: "Yes let's raise the resolution to 2x on Desktop". The phone asset tier (PHONE_TIER) keeps
 *  1.5 exactly as before; everything else is capped at 2. A DPR 1 desktop was never capped and is unchanged.
 *  EVERY PHONE AT 3 (Corey 2026-10-17 12:30: "Yes let's raise it to 3x for all phones"): his Samsung A13 5G (Mali-G57
 *  MC2, 4 GB, 384 x 853 CSS at DPR 1.875) ran 9.4 minutes at ?rescap=3 with a steady 16.6 ms median, no heat, no
 *  battery drop. The renderer is min(devicePixelRatio, cap), so a phone never draws more than its own screen: a
 *  DPR 2 phone draws at 2, a DPR 3 phone at 3. The phone ASSET tier (PHONE_TIER, the half sheets) is unchanged; only
 *  the renderer's resolution moves. The two iPhone allowlists below are switched off (every phone gets `phone`);
 *  ROLLBACK: `phone: 1.5` and both lists `on: true` restore the 2026-10-14 rule. */
export const RENDER_RESOLUTION_CAP = { phone: 3, desktop: 2, phone3x: 3 } as const;

/** PHONES ALLOWED THE DESKTOP CAP (docs/device-quality-plan-v3.md section 6; Corey 2026-10-13): an iPhone whose screen
 *  density is `density` and whose short side is at least `minShort` CSS px and not one of `notShort` is an iPhone 12 or
 *  newer by screen size (375 and 414 wide are the 2017 to 2021 phones: X, XS, 11 Pro, 12 / 13 mini, the Plus and Max
 *  models up to the 11 Pro Max) and renders at RENDER_RESOLUTION_CAP.desktop. Every other phone keeps
 *  RENDER_RESOLUTION_CAP.phone. Read once from static signals before the renderer exists (game/deviceTier.ts): never
 *  a frame-rate cap, never a start-up benchmark, never a change mid session. Rollback: `on` false. */
/** OFF since 2026-10-17 (every phone at RENDER_RESOLUTION_CAP.phone = 3); kept for the rollback. */
export const PHONE_2X_ALLOW = { on: false, density: 3, minShort: 390, notShort: [414] } as const;

/** THE LARGE IPHONES AT 3x (Corey 2026-10-14 19:38: "Yes 3x on Plus and Pro Max IPhones"; his 16-17 Pro Max class phone,
 *  440 x 956 @3, held 58.4 Hz at both 3 and 2): an iPhone that PHONE_2X_ALLOW admits (density 3, not 414) whose short
 *  side is at least `minShort` CSS px renders at RENDER_RESOLUTION_CAP.phone3x. 420 takes in the Air (420), the 12 / 13
 *  Pro Max and 14 Plus (428), the 14 Pro Max, 15 Plus, 15 Pro Max and 16 Plus (430) and the 16 / 17 Pro Max (440); the
 *  390 to 402 iPhones stay at 2 and every other phone at 1.5. The ASSET tier does not change (PHONE_TIER: the half
 *  sheets), only the renderer's resolution. Read once before the renderer exists, like the 2x list. Rollback: `on`
 *  false (those phones go back to 2). The staging `?rescap=` override still wins. */
/** OFF since 2026-10-17 (every phone at RENDER_RESOLUTION_CAP.phone = 3); kept for the rollback. */
export const PHONE_3X_ALLOW = { on: false, minShort: 420 } as const;

/** THE CANVAS PIXEL CEILING (Corey 2026-10-13), everything that is NOT the phone tier: the renderer's resolution is
 *  min(devicePixelRatio, the cap, sqrt(RENDER_MAX_PIXELS / (CSS width x CSS height))) and never under 1. 8.3 million
 *  is a 4K screen's worth (3840 x 2160 = 8,294,400), so a normal retina window is untouched at 2 (1920 x 1080 CSS at 2
 *  is exactly a 4K canvas) and a full screen 5K (2560 x 1440 CSS at DPR 2: 14.7 MP at 2) lands at 1.5005.
 *  RECOMPUTED ON RESIZE WITH HYSTERESIS (components/Game.svelte): only once the window's size has stood still for
 *  RENDER_RESIZE.settleMs, and then only if the wanted value differs from the renderer's by more than
 *  RENDER_RESIZE.band of it, or is the plain cap again (so a window back under the ceiling is exactly at 2). A drag
 *  therefore changes the resolution at most once, when it ends. */
export const RENDER_MAX_PIXELS = 8_300_000;
export const RENDER_RESIZE = { settleMs: 250, band: 0.04 } as const;

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
/** THE SLAM STOP HURRIES THE SPIN (2026-10-13; ui/controls.svelte.ts, stateGame.hurryLevel): a Spin press or a board tap
 *  during a live spin runs the rest of it at the fastest turbo level the operator allows (TURBO_SCALE above: 4, or
 *  2.2 where super turbo is disabled, nothing where turbo is). false = the slam stop is as it was before (the shared
 *  turbo flag only, which this game's motion does not read). */
export const SLAM_HURRY = true;
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

/** THE CUT LINES (Corey 2026-10-15 10:06 and 10:08, "A is the right answer"): BoardCells' one cut layer (its one mask)
 *  cuts every tile leaving under the bottom edge (the board exit from the spin press on, the roar's fall), every tile
 *  coming in over the top edge, and the anticipation reels (components/Anticipation.svelte), at the INNER WINDOW EDGE
 *  where the black lattice ends: the outer face of the lattice's bottom bar for the bottom line and of its top bar for
 *  the top line, read from each layout's own board registration (symbolPlace.ts latticeEdges). Not from the symbols: a
 *  resting tile is never in the cut layer, so a resting overhang (the row-7 scatter over the bottom rail) shows whole
 *  while it rests and is cut once it starts to fall.
 *  `edge`: 'outer' (where the lattice ends, the bronze rail begins), 'centre' (the bar's centre line) or 'opening'
 *  (the bar's inner face). `offsetPx`: board px moved OUTWARD from that edge (down at the bottom, up at the top). */
export const FALL_CUT: { edge: 'opening' | 'centre' | 'outer'; offsetPx: number } = { edge: 'outer', offsetPx: 0 };

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
/** the sheets' frame rate. The DROP sheet (a landing) plays in STYLE time, divided by timeScale like every other
 *  duration; the IDLE loop of a resting piece by SHEET_IDLE_TURBO below */
export const SHEET_FPS = 30;
/** Corey 2026-10-12: "slow down the idle glints/animations on board pieces in Turbo/Turbo 2 to match regular, keep same
 *  animation speeds for landing/clearing/drop in etc." false: a resting piece's idle loop runs at SHEET_FPS in REAL
 *  time at every turbo level (what turbo 0 always did). true: the old behaviour, the loop sped up by TURBO_SCALE
 *  (2.2 and 4 times). Nothing waits for an idle loop: it is only which frame a resting cell shows. */
export const SHEET_IDLE_TURBO = false;
/** THE IDLE GLINTS REST BETWEEN LOOPS (Corey 2026-10-16 15:38: "I think we have too many idle glints happening across the
 *  board on the symbols"). Every resting piece used to loop its idle sheet back to back (about 2 s a loop), so all 64
 *  cells glinted all the time. Now each cell HOLDS its rest frame (idle 0 = the drop's last frame, no jump) for a rest
 *  of its own between minMs and maxMs (fixed per board position, so neighbours never sync), then plays one loop. A cell
 *  that has just landed starts in its rest, so the board does not glint in unison after every spin. With the defaults
 *  about 64 x 2 / (2 + 13) = 8 or 9 cells glint at any moment instead of 64. Presentation only. */
export const SYMBOL_IDLE_REST = { minMs: 7000, maxMs: 19000 };

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

/** THE WIN EFFECT, ROUND 1 (Corey 2026-10-16, "Yes that sounds good" to the code-only fix of the design review
 *  2026-10-15 item 2, "Poor animations"). Replaces the 'old' look above (the 1.13 grow and still hold, the 135 ms
 *  shrink, the white square flash and the 2.5 px dots), which stays selectable for comparison: DEV `?winfx=old`
 *  (game/winFx.ts). Per winning symbol, all in STYLE ms (divided by the turbo scale; a skip spawns nothing):
 *    rise    the same 1.13 grow over CLUSTER.winRiseMs, then a slow breath (`breathe`) while the readout is up
 *    shine   a slanted light band sweeps across the symbol (the logo's Shine, LOGO.still.shine: the symbol's own
 *            frame cut into strips, each strip an additive copy whose opacity is the band; no mask, no filter), once
 *            as the cluster starts and again, softer, as its count lands
 *    pop     replaces the shrink: squash wide and short with a slight twist (the symbol heats up), pop out bigger
 *            with the twist reversed, then collapse to nothing still turning (`pop`)
 *    burst   at the pop: a soft round glow and a ray burst tinted the symbol's colour (`colors`), plus 6 to 10
 *            embers that fly out and fall (`embers`); no white square
 *    shake   a cluster of `shake.minCluster`+ symbols nudges the whole board 1 to 2 screen px as it pops
 *  components/BoardCells.svelte draws the shine, the burst and the embers from pooled sprites; game/stateGame.svelte.ts
 *  (presentWinSet, removeCells) drives the cells, the shine values and the shake. */
export const WIN_FX = {
	/** the default look; DEV `?winfx=old|new` overrides it (game/winFx.ts) */
	style: 'new' as 'new' | 'old',
	/** each symbol's own colour for its burst and embers, SAMPLED FROM THE ART (the static atlas frames,
	 *  mmSymbols.webp, 2026-10-16): the mean of the lit pixels of the dominant hue, value lifted to at least 0.8.
	 *  L4 is the green of its wax (the largest area: the gold gryphon is the brighter but smaller part). */
	colors: {
		L1: 0xcc9567, // the shackle's aged bronze
		L2: 0xcca372, // the bull skull's bone
		L3: 0xda9a46, // the key's gold
		L4: 0x6fcc5c, // the seal's green wax
		M1: 0xcc944e, // the helmet's gold
		M2: 0xcc9750, // the dagger's bronze blade
		M3: 0xdaa154, // the chalice's gold
		H1: 0xe8a544, // the crown's gold
		W: 0xfbb25c, // the Wild medallion's copper gold
		S: 0xef1d10, // the War Standard's red
	} as Record<string, number>,
	/** the winners breathe while the readout is up: scale winScale x (1 + amp sin), one period of periodMs, eased in
	 *  over the rise and out over the fadeMs before the pop (so the pop always starts from winScale exactly) */
	breathe: { amp: 0.03, periodMs: 700, fadeMs: 140 },
	/** THE SHINE. The symbol's frame in `cols` x `rows` strips (phone tier: colsPhone x rowsPhone), each an additive
	 *  copy tinted `tint`. A band `band` symbol widths wide (a triangle, its peak in the middle) runs from `from` to
	 *  `to` symbol widths over sweepMs, leaning by `slant` (the band's centre at the top is slant x 0.5 widths ahead of
	 *  the middle, at the bottom behind). Its opacity ramps in and out over rampShare of the sweep, peaking at `peak`
	 *  (the first sweep, at the cluster's start + startMs) and `secondPeak` (the second, when the count lands). Cells
	 *  start staggerMs apart in order of distance from the cluster centre, the stagger capped at staggerCapMs. */
	shine: { cols: 12, rows: 3, colsPhone: 8, rowsPhone: 2, tint: 0xfff0d2, band: 0.55, from: -0.4, to: 1.4, slant: -0.45, sweepMs: 520, rampShare: 0.18, peak: 1, secondPeak: 0.7, startMs: 40, staggerMs: 14, staggerCapMs: 140 },
	/** THE POP (replaces CLUSTER.removeStyle 'shrink'), one symbol, removeMs long from its removal start (the cells
	 *  still leave SPARKLE.staggerMs apart, nearest the centre first). Scales are multiples of CLUSTER.winScale.
	 *    0 .. squashShare     squash to (1 + squashX, 1 - squashY), twist to twistIn (alternate cells opposite
	 *                         ways), heat (the whole symbol as an additive copy) up to heatSquash
	 *    .. + popShare        pop out to popScale both ways, the twist reversed to -twistPop, heat to heatPop: the
	 *                         burst and the embers start at the beginning of this phase
	 *    .. 1                 collapse to 0 (quadIn), turning on to -twistOut, the alpha fading from fadeFrom of
	 *                         this phase, the heat going down with it */
	pop: { removeMs: 210, squashShare: 0.36, squashX: 0.15, squashY: 0.13, twistIn: 0.06, heatSquash: 0.45, popShare: 0.2, popScale: 1.28, twistPop: 0.1, heatPop: 0.75, twistOut: 0.42, fadeFrom: 0.45 },
	/** THE BURST on the pop: a ray burst (`rays`, the fxTexture burst, tinted the symbol's colour) growing from
	 *  fromCells to toCells cells across while it turns by spin radians, and a soft round glow (`core`, tinted the colour
	 *  whitened by `whiten`) from fromCells to toCells. Each fades in over inShare of its life and out after. Pool: one
	 *  ray + one core per cell, maxCells cells in flight (lifeMs / SPARKLE.staggerMs). */
	burst: {
		rays: { lifeMs: 420, fromCells: 0.5, toCells: 2, peak: 1, inShare: 0.1, spin: 0.35 },
		core: { lifeMs: 300, fromCells: 0.6, toCells: 1.4, peak: 0.9, inShare: 0.12, whiten: 0.55 },
		maxCells: 43,
	},
	/** THE EMBERS: `count` per cell (phone tier `countPhone`), a streak sizePx board px long at the start (shrinking
	 *  over its life), flying out spreadCells (x 0.6..1.4 per ember) on a quadOut, lifted by `lift` cells, pulled down
	 *  by `gravity` cells over the life, turned along its path. Tinted the symbol's colour whitened by `whiten`,
	 *  flickering by `flicker`. Life lifeMs x 0.7..1.0 per ember. One ParticleContainer, pool count x maxCells. */
	embers: { count: 8, countPhone: 6, sizePx: 22, spreadCells: 0.85, lift: 0.35, gravity: 0.9, lifeMs: 800, whiten: 0.5, flicker: 0.25, maxCells: 43 },
	/** THE SHAKE: a cluster of at least minCluster symbols moves the board (featureFx.boardKick, board px) as its first
	 *  symbol pops: a decaying wobble of ampPx board px (about 1.5 to 2 screen px on a 1440 x 900 desktop, 1 to 1.5 on
	 *  a phone) at hz (style time) over ms; the y wobble is yShare of the x one, a quarter period behind */
	shake: { minCluster: 15, ampPx: 3.5, hz: 17, ms: 320, yShare: 0.6 },
};

/** the spin total (components/BoardPlaque.svelte, the plaque under the board; SpinWin.svelte until 2026-10-14): a running bump as each cluster's count-up finishes,
 *  then the final presentation after the last refill. finalRiseMs 0 / finalCountMs 0 = it just sits. */
export const SPIN_TOTAL = {
	/** 1.08 on the plaque (images/spin_amount_final/SPEC.md: 1.2 pokes the longest amount over the lip), scaled about the
	 *  figure block's centre */
	bumpScale: 1.08,
	bumpMs: 140,
	finalDelayMs: 150,
	finalRiseMs: 0,
	finalScale: 1,
	finalEasing: backOut,
	finalCountMs: 0,
	finalHoldMs: 280,
};

/** THE SPIN AMOUNT PLAQUE (Corey 2026-10-13, images/spin_amount_final/SPEC.md; components/BoardPlaque.svelte): the
 *  leaning plaque at 35 degrees under the board, face R4, figures N1 (Cinzel Bold, inlaid brass, no outline, no shadow)
 *  from their own atlas (game/plaqueNumeralGlyphs.ts), the lion crest on the empty plaque, the figure block at the
 *  HALVED lean. Its boxes and homographies are game/boardPlaqueSpec.ts (render px, through the frame's registration).
 *  gap / space: the figures' spacing in digit heights (layoutNumerals' GAP / SPACE for this set). maxWidthPerHeight:
 *  the figure block's width at height 1; a longer string shrinks uniformly and is centred on the figure line.
 *  crestOutMs: the crest fades out on the first figures of a spin, then the figures fade in over figuresInMs;
 *  crestBackMs: when the figures clear, the crest comes back. Night: a plain tint on the figures, the mode's, lerped
 *  with the scene's night. All ms are style time (divided by timeScale; 0 while a skip runs). */
export const BOARD_PLAQUE = {
	gap: 0.03,
	space: 0.32,
	maxWidthPerHeight: 9.2475,
	lean: 'halved' as 'halved' | 'full',
	crestOutMs: 100,
	figuresInMs: 180,
	crestBackMs: 220,
	tintDay: 0xffffff,
	tintSuper: 0xedebf2,
	tintEpic: 0xf7e0d6,
	/** quads in the figures' mesh: the longest Stake amount is 17 glyphs */
	maxGlyphs: 32,
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

// ---- The frame's relight and its turning gears (approved Corey 2026-10-11; components/BoardFrame.svelte) ----------
// The frame art is three layers and six gear loops per layout (tools/build_board_layers.py + tools/board_relight.py;
// every position is in game/boardArtSpec.ts `relight`):
//   DAY     the D1 plate (the frame without its six turning parts) at FRAME_ART.tint, then the six day loops
//   NIGHT   (SUPER and EPIC) the night plate, the fire plate ADDED, the six night loops, the six fire loops ADDED.
//           The night layers fade in over the day layers with the scene's own day to night change, and the fire
//           layers are tinted by the scene's own fire level, flicker and mode tint (game/scene.ts sceneLight: the
//           courtyard's numbers, SCENE.modes and SCENE.fire, nothing of the frame's own):
//             night layers   FRAME_ART.tint x the mode's foreTint (EPIC 1, 0.86, 0.86), opacity = the scene's night
//             fire layers    fireGain x the scene's fire level (0.7 SUPER, 1 EPIC, flickering) x its fireTint (EPIC
//                            1, 0.7, 0.5) x the scene's night, so there is no fire light on the frame by day. NOT
//                            times FRAME_ART.tint and not times the scene's dim: the pictures were approved that way
//           The chains are lit the same three ways (one tile sheet, three strips per run).
//   SHADOW  the contact shadow on the floor under the feet, UNDER the frame and the black backing: a white cut-out
//           whose tint is the shadow's colour and whose opacity its strength, day to night with the same fade.
//   GEARS   the chain wheel, the key pinion (with its back ring) and the end gear at each top corner turn with THE
//           HAUL (CHAIN_BOW.haul*), never with the board kick: links = the haul's own offset, as drawn this frame
//           (the backOut overshoot included, so the gears run past and come back with the chain), and
//           frame = round(links x loopsPerLink x N) mod N (N = 20 frames a loop; the end gear's loop is 10). One
//           link is one whole loop, so at rest every loop is on frame 0, which is the locked picture. All six
//           loops always show the same frame number (their cells only add up in step). A frame change is a swap
//           between textures of one atlas that is already on the GPU: nothing is created or uploaded.
export const FRAME_RELIGHT = {
	fireGain: 1,
	shadow: {
		// Corey 2026-10-12: "The shadow could probably be a little bit stronger": the strength (opacity, not size) up
		// in every layout and mode: day 0.6 -> 0.78 -> 1, night 0.75 -> 0.975.
		// Later the same day ("Stronger 2x"): BY DAY the shadow is drawn TWICE (a second sprite on the same cut-out,
		// straight over the first, components/BoardFrame.svelte): with the cut-out's own alpha m the floor gets
		// 1 - (1 - m)^2 where one layer at full strength gave m. `dayDouble` is the second layer's strength (0 = one
		// layer as before, 1 = the full double); its opacity is day.alpha x dayDouble x (1 - night), so it leaves with
		// the day to night fade and NIGHT is one layer at night.alpha, exactly as it was.
		day: { color: [24, 12, 6], alpha: 1 },
		dayDouble: 1,
		night: { color: [2, 3, 8], alpha: 0.975 },
	},
	gears: { loopsPerLink: 1 },
} as const;

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
	/** THE WHOLE-CELL TILE (Corey 2026-10-13 12:06, Symbol Fit Playground v7): the lit square is the cell's own
	 *  lattice opening grown by half a bar each way (bar centre line to bar centre line, per cell, square), drawn
	 *  UNDER the frame art (BoardFrame's `under`, between the black backing and the day plate); neighbours join under
	 *  the shared bar. fill 0, border alpha 0 (width 3 desktop master px, not drawn), corner 0, the INNER GLOW (one
	 *  pre-made white square, bright at the edge and clear in the middle, tinted the level colour and stretched to the
	 *  cell) at innerGlowAlpha, the number at 0.45 of a pitch in the level colour, 0.65 under a symbol and 0.65 on an
	 *  empty lit cell. The 'plate' numbers below (insetCells, cornerPx, borderPx) are the retired plate's. */
	style: 'cell' as const,
	innerGlowAlpha: 1,
	/** the playground's glow square: 128 px, alpha 255 x (1 - e)^2.2, e = distance to the nearest edge / half side */
	innerGlowPx: 128,
	innerGlowPower: 2.2,
	borderMasterPx: 3,
	/** the number's alpha on a lit cell no symbol covers (it was a literal 1 in BoardCells) */
	numberAlphaEmpty: 0.65,
	colors: { 2: 0xe32400, 4: 0xea4d00, 8: 0xf07500, 16: 0xf79e00, 32: 0xfec700, 64: 0xffe37f, 128: 0xfff1bf, 256: 0xffffff } as Record<number, number>,
	fillAlpha: 0,
	borderAlpha: 0,
	borderPx: 2.5,
	/** inside the cell's clear lattice opening (see BoardCells: the playground's cell well is the opening here) */
	insetCells: 0.01,
	cornerPx: 0,
	/** the number's FONT SIZE (Barlow Condensed 700, the playground's canvas px) as a share of a cell:
	 *  0.45 per Corey 2026-10-13 12:06 (0.48 from 2026-10-07; the locked spec said 0.46). Never shrunk: a value wider than the tile
	 *  closes its tracking instead (BoardCells layoutPlate) */
	numberSizeCells: 0.45,
	numberAnchor: 'centre' as const,
	numberAlphaUnderSymbol: 0.65,
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

// ---- The claw swipe (claw-swipe-r1, 2026-10-16; the timing contract is MOTION_SPEC "Claw swipe", LOCKED Corey
// 2026-10-06 10:02) ----------------------------------------------------------------------------------------------
// The harsh design review (2026-10-15 item 5): the old torn red bands "read as a glitch, not a claw". Corey 17:32:
// "The manticore has four claws, but it was on my mind to improve that." So: FOUR claw strokes rake the band right
// to left (he stands right of the board), one after another. r2, Corey 2026-10-17 09:52: "The look of the claw swipe
// looks better, but I don't like the claw curves. If we could use that style claw mark in the directions/angles we
// already had it, that would probably look great." So each claw is a STRAIGHT stroke laid exactly where the old
// tears were: across the board's whole width, evenly down the band, at the band's slant; a short warm-white impact
// flash on the slashed rows and the board kick land with the first claw; each claw leaves an ember scar and the
// struck symbols take an ember tint until they leave. The symbols leave and the tiles pop at exitAtMs exactly as
// before (the book's beat), the scars fade with them and the refill drops after max(exitMs, scarFadeMs).
// Drawn by components/ClawSwipe.svelte: pooled additive sprites of ONE baked streak texture (game/fxTexture.ts
// clawTexture, made once), no filters, no masks; the cells' exit and the kick are stateGame.swipeBand's.
// Every px is playground px (x PLAYGROUND_PX at draw time); every ms is style time (turbo divides it).
export const SWIPE_FX = {
	/** "The manticore has four claws" (Corey 2026-10-16 17:32) */
	clawCount: 4,
	/** THE GAP BETWEEN CLAWS: each claw starts this long after the one above it. r3, Corey 2026-10-17 10:31: "let's
	 *  lower the latency between the individual claw marks" (it was 40, the review's stagger) */
	clawStaggerMs: 20,
	/** each claw draws on right to left over clawDrawMs (quadOut, the hot tip leading), holds, then from clawTailAtMs
	 *  BURNS OUT right to left: its right end retreats across the board at a steady speed over clawTailMs with an
	 *  ember riding it, and the tiles light in its wake (r3, Corey 10:31: "They should really follow the fade out of
	 *  the claw marks"; slow enough that the sweep reads at normal speed). A claw lives clawTailAtMs + clawTailMs.
	 *  r1 / r2 had a 65 ms quadIn tail (140 ms a claw) */
	clawDrawMs: 60,
	clawTailAtMs: 70,
	clawTailMs: 300,
	/** the burning claw's alpha falls to 1 - this by the end of its tail */
	clawTailFade: 0.55,
	/** THE OLD TEARS' LAYOUT (MOTION_SPEC "Claw swipe", Corey 2026-10-06 + the slant mapping), kept for the claws:
	 *  each claw spans the board's width, its middle at the band's (i + 0.5) / clawCount, top claw first, drawn
	 *  right to left. 'rows': the slant comes from the band's centre row (the top of the board slantTopDeg, the
	 *  bottom slantBottomDeg; negative = the right end higher); 'fixed': clawSlantDeg */
	slantMode: 'rows' as 'rows' | 'fixed',
	slantTopDeg: -6,
	slantBottomDeg: 3,
	clawSlantDeg: -3,
	/** the claw's core at its thickest (the texture is scaled to it), playground px */
	clawCorePx: 9,
	/** per claw tint over the baked colours (white keeps them: bright core, red-orange falloff) */
	clawTints: [0xffffff, 0xfff0e2, 0xffffff, 0xffe8d8],
	/** the hot tip riding the claw's front while it draws on: the soft dot, stretched along the claw */
	tipPx: 15,
	tipStretch: 2.6,
	tipTint: 0xfff4dc,
	tipAlpha: 0.95,
	/** the ember riding the burn-out's front (the same dot), its colour and alpha */
	emberTint: 0xffa04a,
	emberAlpha: 0.85,
	/** the ember scar each claw leaves along its path: the same streak tinted this, at this alpha, until the
	 *  symbols leave, then fading over scarFadeMs */
	scarTint: 0xff4a24,
	scarAlpha: 0.45,
	scarFadeMs: 380,
	/** THE IMPACT (the review: a 60 ms white flash on the slashed rows): an additive warm-white quad over the band,
	 *  up in impactRiseMs, gone by impactFlashMs. The board kick starts on it. */
	impactAtMs: 40,
	impactFlashMs: 60,
	impactRiseMs: 10,
	impactAlpha: 0.5,
	impactTint: 0xfff0dc,
	/** the struck symbols take this tint (the cells' flash) from the impact, up over woundRiseMs, until they leave */
	woundColor: 0xb8402a,
	woundAlpha: 0.42,
	woundRiseMs: 90,
	/** THE TILES FOLLOW THE CLAWS (r2, Corey 2026-10-17 09:55: "I would also suggest for this the multipliers light up
	 *  following the claw marks from right to left"; r3, 10:31: "They should really follow the fade out of the claw
	 *  marks"): each tile of the band pops, lights or doubles (the plate's own beat, the book's values) when the
	 *  burn-out of the claw over its row passes the middle of its cell, column by column right to left
	 *  (stateGame.swipeTileDelayMs), plus this lag. With 4 claws 20 ms apart the last tile pops at about 411 ms, its
	 *  pop done by 471, before the symbols leave at exitAtMs. Before r2 they all started at exitAtMs + exitMs +
	 *  MULT_PLATE.changeDelayMs (855 ms); in r2 on the claw's tip (all by ~180 ms). */
	tileLagMs: 0,
	/** THE BOOK'S BEAT, unchanged by the claws: the band's symbols start to leave this long after the swipe starts (it
	 *  was the four tears' 125 ms + their 370 ms hold); the refill drops at exitAtMs + max(exitMs, scarFadeMs) */
	exitAtMs: 495,
	/** how the swiped symbols leave, from exitAtMs */
	exit: 'fade' as const,
	exitMs: 260,
	/** slideLeft only (not chosen) */
	slideCells: 1.3,
	/** the board kick from the impact: (0.6k, k), k = kickPx (1 - u) sin(6 pi u); peak 0.92 kickPx. The review: "a 2
	 *  to 4 px shake" (5 before the claws, a 4.6 px peak) */
	kickPx: 3.5,
	kickMs: 180,
	/** after the symbols have gone, before the refill */
	refillDelayMs: 0,
	/** the baked streak (game/fxTexture.ts clawTexture), texture px: its size, the arc's sag (fraction of the
	 *  chord; 0 = a straight stroke, r2 "I don't like the claw curves"; r1 had 0.055), the core's full width at
	 *  its thickest and where along the claw that is (0 = the tip's start), the glow's reach past the core */
	tex: { w: 1024, h: 64, sagFrac: 0, corePx: 10, peakU: 0.38, glowPx: 24 },
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

// ---- The chain gusts (Corey 2026-10-10: "a timed reaction like the wind from the drop ins is pushing them") ----
// A drop-in (the win plaque's slam, the logo's entrance, a count-up passing a tier) displaces air that reaches the
// chains a beat later: the board's own chains (components/BoardFrame.svelte) and the courtyard's (game/scene.ts)
// lean away from where it landed, smoothly, then swing back and settle. Never a board shake: the kick path is
// untouched and the gust adds to it. The pulse is one half sine of `ms`, REAL time at every turbo level (it is
// air); the delays are divided by the turbo scale when `delaysFollowTurbo` so they stay in step with the beats.
// `strength` is a FRACTION OF ONE CLAW SWIPE KICK's chain travel (SWIPE_FX.kickPx 5 when measured; 3.5 since the claws, r1): `unitPx` is the pulse
// amplitude, in playground px, that moves each system as far as that kick does, measured by
// tools/manticore/chain_gust_probe.js KICKREF (a rattle and a pulse of the same px do not move a chain the
// same distance, so the two systems calibrate separately). Tune strengths and delays; leave unitPx to the probe.
// The board's runs take the gust sideways at the kick's own travel per px of the spring (hypot(0.6, CHAIN_BOW
// .vertical)), plus `vertical` x the spring downwards, so a strength reads as the same share of a kick's travel.
// Direction: away from the landing. `sourceX` null (the plaque and the tier, centred on the board): left chains
// lean left, right chains right. The logo lands high in the left column: with logo.fromLogo each chain leans
// away from the logo's centre (the courtyard's left chain left, the rest right); false = the centre rule.
export const CHAIN_GUST = {
	enabled: true,
	ms: 260,
	/** measured 2026-10-10 by chain_gust_probe.js KICKREF (desktop: a strength 1 gust moves each system as far as one kick) */
	unitPx: { board: 1.07, scene: 1.74 },
	/** the courtyard chains are farther away: they lean this much after the board's own */
	sceneLagMs: 90,
	vertical: 0,
	delaysFollowTurbo: true,
	/** no gust is ever stronger than a kick, whatever the values below say */
	maxStrength: 1,
	plaque: { strength: 0.5, delayMs: 70 },
	/** landFrame: the entrance frame (30 fps, from LOGO.entranceDelayMs) where the letters set down */
	logo: { strength: 0.33, delayMs: 70, landFrame: 8, fromLogo: true },
	tier: { strength: 0.17, delayMs: 50 },
} as const;

/** the flat backing behind the cell wells and the tiles, under the board kick: covers the frame's
 *  inner opening (the cell area plus the inset). The wells (WELLS) are drawn over it; it is what shows in the
 *  frame's inset round the cells and for the moment before the wells' atlas is in (BoardFrame.svelte draws it). */
export const BOARD_BACKING = { color: 0x000000 };

/** THE BOARD WELLS (Corey 2026-10-16 16:40 "Well backgrounds look good": option D of feedback/wells_r1 and r2).
 *  Black marble cut from the Big Win plaque's own slab, with continuous dull gold veins (tools/build_board_wells.py):
 *  four 256 px variants 2 x 2 in one 512 atlas (ui/board-wells.webp; the phone tier's half atlas has 128 px cells),
 *  one sprite per cell on the cell's whole box (bar centre line to bar centre line, symbolPlace.ts op.box), over
 *  BOARD_BACKING and under the multiplier tiles and the frame (game/wells.ts). Each cell takes a variant and one of
 *  the 8 turns from a fixed table (`seed`; no two edge neighbours share a variant), so the 64 cells never look
 *  stamped. A well darkens with the symbol on it while a win set is up (the dim rule's factor, as the tiles do):
 *  without it the dimmed symbols lose their black surround and the win reads muddier. */
export const WELLS = {
	variants: 4,
	cellPx: 256,
	cellPxPhone: 128,
	seed: 0x5eed,
	dimWithBoard: true,
};

/** THE REACTIVE VEINS (wells_r2, Corey 2026-10-16 15:25 + 15:27 "Yes", approved 16:40). The stinger plaque's own
 *  vein rule (images/ui/model/stinger_vein_fx.json): per cell ONE static additive sprite of the well's own veins
 *  (ui/board-wells-glow.webp: greyscale, brightness = intensity, bloom baked; additive, so its black adds nothing),
 *  drawn over the multiplier tiles (a lit tile is nearly opaque) and under the frame and the symbols; the game moves
 *  only its alpha and tint. One flare = in (sine) over `inMs`, held `holdMs`, out over `outMs` ((1 - u)^1.6);
 *  overlapping flares on a cell take the strongest. Times are STYLE ms (divided by the turbo scale of the beat).
 *  Presentation only: the beats' own call sites cue them (game/wellsFx.ts), nothing waits on them, none while skipping.
 *    light / double  a multiplier lights (0 -> x2) or steps up under the cell, as the plate's count-over starts
 *    win             a paying cluster, as its pulse starts: a ripple from its first cell (the book's order) outward
 *    swipe           the swiped rows, right to left with the claws, over sweepMs
 *    sting           the struck cell at the hit, then outward ring by ring (reach, falloff per ring); not scatters
 *    power           free spins only: every vein rests at a glow that rises with the board's total tile value
 *                    (log scale from refValue, full at fullValue, capped at `cap`), eased over riseMs, with a slow
 *                    shimmer (each cell its own phase) so the board breathes rather than sits lit
 *  The wells (not the glow) take the scene's night and fire: night x `night` per channel times the mode's foreTint,
 *  and the fire's warmth by fire x night. cueMax / cueMaxAgeMs: the cue queue's bound and the age past which a cue
 *  that was never read (a hidden tab) is dropped instead of played late. */
export const WELLS_FX = {
	tint: { light: 0xffa63c, double: 0xffc860, win: 0xffb852, swipe: 0xff6a24, sting: 0xff8a2e, power: 0xff9a3a },
	light: { peak: 0.85, inMs: 380, holdMs: 120, outMs: 900 },
	double: { peak: 1, inMs: 420, holdMs: 180, outMs: 1100 },
	win: { peak: 0.8, inMs: 170, holdMs: 260, outMs: 700, stepMs: 55 },
	/** swipe: sweepMs in step with the four claws drawing on right to left (claw-swipe r3: the last claw starts at 60
	 *  ms and is half drawn by 90; 150 in r1 / r2, 240 with the old tears). The tiles' own light-ups follow the
	 *  claws' slower burn-out (SWIPE_FX.clawTailMs) and flare their cells' veins as they come */
	swipe: { peak: 0.9, inMs: 110, holdMs: 220, outMs: 800, sweepMs: (SWIPE_FX.clawCount - 1) * SWIPE_FX.clawStaggerMs + SWIPE_FX.clawDrawMs / 2 },
	sting: { peak: 0.95, inMs: 110, holdMs: 120, outMs: 800, stepMs: 70, reach: 2, falloff: 0.55 },
	power: { cap: 0.34, refValue: 8, fullValue: 2048, riseMs: 2200, fallMs: 900, shimmer: 0.35, periodMs: 3500 },
	night: [0.6, 0.64, 0.82] as [number, number, number],
	fireWarm: [1, 0.85, 0.72] as [number, number, number],
	/** below this a glow sprite is hidden (not drawn at all) */
	epsilon: 0.004,
	/** the flare pool's size (each a plain object, reused) */
	pool: 256,
	cueMax: 64,
	cueMaxAgeMs: 1500,
};

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
// NO SPOTLIGHT ON A REGULAR SPIN (Corey 2026-10-16 17:32: "anticipation columns look good on mystery but not on regular
// spins, the difference is the spotlight, it should be removed. We can adjust the rain to make it look better."). The
// narrow gold searchlight that swung through every held column (beamAlpha, beamColor, beamSwing, beamPeriodMs) is off:
// `beam: false` hides it, and its column mask with it. The Mystery tease (ANTICIPATION below) keeps its own light.
// THE RAIN WITHOUT IT (harsh review 2026-10-15 design item 16: "multi-exposed ghost strips"): it was three equal copies
// of every loose symbol at 0.2 (one 0.1 cell above, one below), which over a black well reads as a smear. Now ONE
// symbol at rainAlpha with a single TRAIL copy above it (the way it came from) at rainTrailAlpha of that, rainStretch
// taller so it reads as falling fast, and nothing below it. The teased column also gets a faint warm edge glow from
// the Mystery's own spill strips (spillAlpha, spillWidth cells), so it still reads as a column being teased.
export const ANTICIPATION_TEASE = {
	triggerAfter: 3,
	holdMs: 700,
	holdDecay: 0.82,
	holdFloorMs: 300,
	fallSlow: 1.7,
	fadeMs: 260,
	/** the searchlight on a regular spin's teased columns: off (Corey 17:32). true brings the old gold beam back */
	beam: false,
	beamAlpha: 0.75,
	beamColor: 0xffe08a,
	beamSwing: 0.13,
	beamPeriodMs: 840,
	spillAlpha: 0.22,
	spillWidth: 0.16,
	rainAlpha: 0.3,
	/** the trail copy above each loose symbol, as a share of rainAlpha (0 = no trail) */
	rainTrailAlpha: 0.4,
	rainSpeedCellsPerS: 5.5,
	rainStretch: 1.3,
	/** where the trail copy sits above its symbol, in cells (the copies themselves are ANTICIPATION.rainGhosts either
	 *  side, shared with the Mystery; a regular spin shows only the one above) */
	rainGhostOffset: 0.16,
	/** the breathing scatters grow to 1 + this (SYMBOL_POPS.tease, Corey 2026-10-13 12:06: 1.185, was 1.05) */
	landedPulse: 0.185,
	landedPulseHz: 1.5,
	missHoldMs: 500,
};

// ---- THE TRIGGER BEAT (harsh review 2026-10-15 design item 8; Corey 2026-10-16 17:32: "A1. Sounds good") ----------
// A feature trigger had no celebration of its own: the War Standards sat still, the screen dipped to black and the
// intro plaque opened. Now, at the book's bonusStart and before the intro plaque (stateGame.triggerBeat, drawn by
// components/TriggerBeat.svelte), in STYLE ms (divided by the turbo scale like every board beat, so turbo shortens it):
//   0          the board around the scatters darkens to dimTo; every triggering scatter (the bonusStart's cells) lifts to
//              liftScale over liftMs (backOut) with its glow full in glowColor; a light column rises from each
//              (shaftInMs, shaftCells tall over the scatter, shaftAlpha) and a halo flares at the lift's peak (flareMs)
//   roarAt     the manticore roars (his roar clip and sfx_roar: the same beat the book's roar and the Max Win screen use)
//   relightAt  SUPER and EPIC only: the scene relights IN FRONT of the player (the night sky, the fire braziers, his
//              night or fire look) over the scene's own crossfade (SCENE.crossfadeMs), before the intro plaque, not under it
//   the last releaseMs  everything settles back to rest
// `ms` is the Free Spins beat and `msRelit` the Super / Epic one (the relight lands in view). Then the intro plaque.
// The scatter landing ladder and the house bonus-confirm SFX are untouched (cross-game standard). blackFade false: the
// beat replaces the old fade to black before the plaque (the "whole screen dims" the review saw); true puts the fade
// back after the beat.
export const TRIGGER_BEAT = {
	on: true,
	ms: 1250,
	msRelit: 1500,
	liftMs: 260,
	liftScale: 1.25,
	releaseMs: 300,
	dimTo: 0.5,
	dimInMs: 220,
	glowColor: 0xffd25a,
	/** the lifted scatters' glow breathes between 1 and 1 - breathe at breatheHz */
	breathe: 0.25,
	breatheHz: 2.4,
	roarAt: 140,
	relightAt: 120,
	shaftInMs: 320,
	/** the column's height above the scatter's centre, in cells (it rises out of the board's top on the upper rows) */
	shaftCells: 5.5,
	shaftWidthCells: 1.15,
	shaftAlpha: 1,
	shaftColor: 0xffd27a,
	flareMs: 380,
	flareCells: 2.3,
	flareAlpha: 0.9,
	blackFade: false,
} as const;

// ---- THE CREATURE'S NIGHT LIFT (harsh review 2026-10-15 design item 11; Corey 2026-10-16: "1. Yes" to the cheap lift
// as an interim) ---------------------------------------------------------------------------------------------------
// In SUPER (night) and EPIC (fire) his own sheets are composited dark (creatureSpec: night + 0.70 x fire, and night +
// 1.00 x fire x (1, 0.7, 0.5)) and read as a brown silhouette against the night courtyard. Nothing in the code darkens
// him further (the scene's foreTint and dim never reach his body node), so the lift is LIGHT ADDED, not a tint taken
// away: one additive copy of the frame on show (game/creature.ts `lift`) at `add` x that look's share of the crossfade,
// tinted `tint`. A pixel of colour c becomes c x (1 + add x tint): one brightness step that keeps his own contrast and
// colours, nothing outside his outline. The day look gets none. INTERIM: the Rig is re-rendering the night and fire
// sheets with a proper rim light; set both `add` to 0 when they land. EPIC landed 2026-10-16 (drop 5, web-sdk 8fdce3d),
// so epic's add is 0; SUPER keeps the lift (Corey: rim light "epic only").
export const CREATURE_LIFT = {
	super: { add: 0.35, tint: 0xd8e2ff },
	epic: { add: 0, tint: 0xffe2c8 }, // was 0.3 until the drop 5 rim light
} as const;

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

// ---- THE FOREGROUND KICK (Corey 2026-10-12: "Probably the entire foreground but not the background should kick.") ----
// On every board kick (the claw swipe's, the roar's, the win plaque's impact and tier ups) the courtyard's FOREGROUND
// is shoved by the SAME offset as the board, on the same frame: floor, columns, pedestals, braziers, the fire light
// pass, the flames with their embers and rim cuts, and the knocker chains (which keep their own swing on top; that
// swing is still driven once, by the kick's size, game/scene.ts). The painted backdrop, every sky layer (aurora,
// clouds, ridge cut-outs, birds, bats, fog), the logo and the HTML HUD stay still.
//   HOW   components/BoardFrame.svelte reads featureFx.boardKick once a tick for the frame, and hands that same read,
//         in canvas px, to featureFx.shoveForeground; components/Background.svelte passes it to the scenes, and
//         game/scene.ts moves ONE container, SceneView.foreground. A future foreground creature joins that container.
//   on        false = the board alone kicks, as before (and the foreground is not drawn oversize)
//   coverPx   the largest kick any feature asks for, PLAYGROUND px (read from the kicks' own constants, so a kick
//             made larger is still covered). The shove is (0.6 x, 1 x) this.
//   slackPx   CANVAS px kept beyond the largest shove (the scaled picture's own soft last pixel)
// THE OVERSIZE: so no edge of the foreground ever shows, it is drawn larger about the frame's centre by the SMALLEST
// uniform scale that keeps every edge of the canvas covered at the largest shove in that layout (components/
// Background.svelte, `foregroundOver`): an edge the cover fit already crops by more than the shove needs nothing.
// It is not one fixed percentage because the shove is in board px and the frame is fitted to the screen: measured
// 2026-10-12 (chain_gust_probe.js FOREGROUND) it comes to 0.66 % at 844 x 390, 0.93 % at 390 x 844, 1.32 % at
// 1440 x 900 and 1.48 % at 1280 x 720 (the largest seen: 1.94 % at 667 x 375). A fixed 0.5 % about the centre
// would leave up to 3 px of the backdrop showing under the floor on a roar at 1440 x 900.
export const FOREGROUND_KICK = {
	on: true,
	coverPx: Math.max(SWIPE_FX.kickPx, ROAR_FX.kickPx, STINGER_PLAQUE.kickPx, STINGER_PLAQUE.kickTierPx),
	slackPx: 0.5,
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
/** THE INTRO CARDS' BODY SHRINK TO FIT (ui/LandingScreen.svelte, 2026-10-15). On Linux Chromium (the decimus probe host)
 *  Sora sets wider than on a Mac or an iPhone, and the scatters card's body wrapped to 5 lines in a zone that holds about
 *  4.5 (8 to 9 CSS px over at 1440 x 900, 1280 x 720, 390 x 844, 360 x 640; the clusters card at 768 x 1024): the zone
 *  clips the top of line 1 and the descenders of line 5. Once the fonts are in, and on every resize, a body taller than
 *  its zone steps its font size down by `stepPx` (layout px, before the card's scale) until it fits, never under
 *  `floor` x the slate's size (INTRO_CARD_STYLE.body.size). A body that already fits is not touched. `slackPx`: how far
 *  over the zone's height a body may be and still count as fitting (sub-pixel rounding). */
export const INTRO_BODY_FIT = { stepPx: 0.25, floor: 0.85, slackPx: 0.5 } as const;

export const LOGO = {
	/** the static still's art box, px (tools/build_logo_assets.py prints it): only its aspect is used */
	art: { width: 2380, height: 940 },
	/** LANDSCAPE master (1280 x 720): the art's width and centre. Centred between the screen's left edge and the
	 *  board frame's visible post (the frame art starts at 340, its solid post at 352: midpoint 176), and high
	 *  in the column (Corey 2026-10-10: up, clear of the scene's chains; it may cover the lion knocker's head).
	 *  The width is the one the approved clips were judged at (logo_review_5, 5_in_game_landscape: 300).
	 *  2026-10-16, THE BIGGER BOARD (layoutSpec LANDSCAPE_BOARD): the same rule. The post is now at 285.0 (render x 82.2
	 *  of the board art: 378.27 + (82.2 - 329.571) x 0.377077), so the box runs from 26 to 259.0, 26 clear of the
	 *  screen's left edge and of the post: width 233.0 (0.777 of 300), centre 142.5; its top stays at 46.76, under the
	 *  clock strip (centre y 46.76 + 92.02 / 2). It was { cx: 176, cy: 106, width: 300 }. */
	landscape: { cx: 142.5, cy: 92.77, width: 233 },
	/** PHONE SIDEWAYS master (1480 x 740): the left column, from the clock strip's left edge to the board art's
	 *  post (293), above the BALANCE readout (236). */
	phone: { left: 16, top: 46, width: 274 },
	/** PORTRAIT master (412 x 760, wider on wide screens): the largest box of the art's aspect inside the band
	 *  from `top` (the clock row ends at 25) down to `gapAbove` over the frame art's finial tips (226.4, or 207.5
	 *  where the frame has grown on a wide screen: board_v5j with its base on v4l's, 2026-10-11; 198.8 / 176.6 with
	 *  v4l), no wider than maxWidth, centred in that band and on the screen. At 226.4 the box is maxWidth wide (as it
	 *  was with v4l) and its top is at 55.96 (42.17 with v4l): the same size, 13.8 lower, centred in the taller band.
	 *  THAT IS THE TABLET'S RULE (and any portrait screen that is not a phone). It gives centre 206.0, 115.2 and width
	 *  348 at 768 x 1024. `skipGap`: on a narrow tablet the box is also kept this far left of the SKIP button (layoutSpec
	 *  SKIP), which stands beside the logo's upper right; at 768 x 1024 that allows 369, so the 348 stands.
	 *  THE LOGO STAYS WHERE IT IS IN A FEATURE (Corey 2026-10-12: its step back to centre 206, 71, width 202.6 above the
	 *  old SKIP TO RESULT plate is gone, phone and tablet). */
	portrait: { top: 31, gapAbove: 8, maxWidth: 348, skipGap: 8 },
	/** PORTRAIT PHONE (the layout system's size class, short side at most 480 CSS px: layoutSpec isPhoneSizeType), the
	 *  owner's own box (Corey 2026-10-12 22:11, placement playground v3): up in the left corner, clear of the creature
	 *  who stands top right behind the board, and drawn in front of him (the HTML HUD is over the whole canvas).
	 *  Centre and width in the 412 wide master (scale 0.74 of the 348); on a wider phone the box keeps its distance
	 *  from the screen's centre line, like the canvas. It was centre 206.0, 124.7, width 348. */
	portraitPhone: { cx: 138.7, cy: 100.7, width: 257.5 },
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

	// ---- the still, in the canvas (game/logo/still.ts; 2026-10-13: every logo is in the canvas, under the creature) ----
	/** the still's drop shadow per master, master px: what the chrome's <img> wore as a CSS drop-shadow (offset down,
	 *  blur radius, opacity). Baked once into a texture `shadowBakeWidth` px of art wide (no filters in the canvas).
	 *  THE SHINE (ui/Shine.svelte's numbers): the glint texture in `strips` vertical strips; a white band `band` art
	 *  widths wide (a triangle, `peak` at its centre) whose centre runs from `from` to `to` art widths; every idleMs a
	 *  sweep of idleSweepMs at idleOpacity (ramped in and out over idleRampMs), and on a spin press a full one over
	 *  bigMs (ease out, opacity up to 1 by bigRampAt of it, then down to 0). */
	still: {
		shadow: { landscape: { dy: 4, blur: 8, alpha: 0.7 }, phone: { dy: 4, blur: 8, alpha: 0.7 }, portrait: { dy: 3, blur: 6, alpha: 0.6 } },
		shadowBakeWidth: 256,
		shine: { strips: 40, band: 0.9, from: -0.9, to: 1.9, peak: 0.95, idleMs: 5000, idleSweepMs: 800, idleRampMs: 100, idleOpacity: 0.4, bigMs: 520, bigRampAt: 0.15 },
	},
} as const;

/** THE SKIP BUTTON AND ITS PROMPT (components/SkipButton.svelte, HTML; placement is layoutSpec SKIP). The button is
 *  the Play button's plate at half its height with a fast forward glyph and no text. A press does not skip: it opens
 *  the prompt "Skip to result?" beside it; Yes skips, No, a tap anywhere else or promptMs with no answer closes it.
 *  Nothing waits on any of it: the feature plays on underneath. */
export const SKIP_HUD = {
	inMs: 220,
	outMs: 120,
	/** the prompt closes by itself after this long with no answer */
	promptMs: 4000,
	/** (the look is the Play button's bronze plate, ui/ChromeStyles.svelte .am-plate.half, since 2026-10-15) */
	/** the glyph's height as a share of the button's height */
	glyphShare: 0.62,
	/** the touch target is grown (invisibly) to at least this, CSS px */
	minHitCss: 44,
	/** the prompt, as shares of the Play button's size on screen, each with a floor in CSS px. Yes and No are at
	 *  least 52 x 40 CSS px on any screen. */
	prompt: {
		gapCss: 6,
		button: { w: 0.6, h: 0.42, minW: 52, minH: 40 },
		font: { share: 0.15, min: 12 },
		pad: { share: 0.1, min: 8 },
		gap: { share: 0.08, min: 6 },
		/** the question's line box, in ems */
		line: 1.3,
	},
} as const;

export const MOTION_BLUR_VELOCITY = 31;

// Stake approval rule: explicit player confirmation before activating any bet mode costing more
// than 2x. Every Manticore mode above Base clears this, so all six confirm.
export const CONFIRM_COST_MULTIPLIER = 2;

export const zIndexes = {
	// scene: the courtyard scene (SCENE below) draws OVER the placeholder and its wash, which it replaces
	background: { backdrop: -3, normal: -2, feature: -1, scene: -0.5 },
};

/** dark wash over the backdrop so the board and the chrome read on top of it */
export const BACKGROUND_WASH = { base: 0.3, freegame: 0.4 };

// ---- The courtyard scene (components/Background.svelte, game/scene.ts; assets by tools/build_scene_assets.py) ----
// The background in every layout (Corey 2026-10-10): painted backdrop, 3D foreground, the braziers' fire light as one
// additive pass, and in LANDSCAPE and PHONE SIDEWAYS the knocker rings and chains as moving pieces. PORTRAIT has its
// own 9:16 scene (floor, backdrop, fire pass) with the same modes, flicker, crossfade and dim, and no moving pieces.
// Every px below is a px of the scene's 2560 x 1440 frame (game/sceneSpec.ts); every ms is REAL time at every turbo
// level (it is scenery, like the logo), and the idle never pauses (Corey 2026-10-10: it keeps running through spins
// and win screens).
//   modes     the game's four background keys (Background.svelte `family`). night: 0 the day scene, 1 the night
//             scene. The pass's level is in `fire`, per layout. fireTint / foreTint: the EPIC red (the foreground and the chains take
//             foreTint; the painted backdrop is never tinted). flicker: the band the level pulses in, as multiples
//             of the level; EPIC only pulses DOWN from 100% (the gold burns out above it).
//   dim       the old wash as a TINT on every layer (dims are tints, never alpha overlays): 1 - BACKGROUND_WASH.
//   flicker   level x (lo + (hi - lo) (1 + n(t)) / 2), n = sum of weight sin(2 pi hz t + phase): three slow terms
//             whose rates share no period, weights summing to 1, so n stays in -1 .. 1 and never visibly loops.
//   chains    game/scene.ts has the model. Both react to the board's kick (featureFx.boardKick, the scalar the
//             board's own chains use, components/BoardFrame.svelte): its size, lagged by kickLagMs, shoves each
//             chain, x'' = -w^2 x - 2 zeta w x' + gain w e (1 - |x| / max), so a short kick moves it gain x (the
//             kick's px x seconds) whatever its period, and a long one cannot push it past max.
//             hang   pinned at the TOP only: a pendulum. x is the free end's sideways travel; a link at s (0 the
//                    knocker's mouth, 1 the free end) moves x s^shape, the lower links trailing by lagMs. The
//                    period is periodMsPerRootPx x sqrt(its length), so the two sides differ when their lengths do,
//                    times the side's own `period`. Lightly damped: it is still swinging when the swag has stopped.
//                    The ring turns about the mouth so its bottom stays on the chain's top link.
//                    side.hold: the share of the free end's travel taken away over the last holdFrom..1 of the
//                    chain. LEFT (knocker_r2): its end RESTS on the column's base moulding, so it is held there
//                    (hold), shoved less (gain) and damped harder; the right one hangs free.
//             swag   pinned at BOTH ends (the ring's hook, which it follows, and the bowl rim; anything showing
//                    again under the rim stays still): a slack chain. b is its middle's travel along `dir`, shaped
//                    sin(pi s). Slower and larger than the board's taut chains, moderately damped: two swings.
//             idle   wind on the free ends: per side its own three slow terms ([period ms, weight, phase]) and
//                    size, so the sides are never in step. Written at most every idleIntervalMs. The twist of the
//                    lower links is NOT drawn (a flat sprite cannot turn; a width change read as rubber).
export const SCENE = {
	modes: {
		base: { night: 0, fireTint: [1, 1, 1], foreTint: [1, 1, 1], flicker: [0.85, 1.15] },
		bonus: { night: 0, fireTint: [1, 1, 1], foreTint: [1, 1, 1], flicker: [0.85, 1.15] },
		super: { night: 1, fireTint: [1, 1, 1], foreTint: [1, 1, 1], flicker: [0.85, 1.15] },
		epic: { night: 1, fireTint: [1, 0.7, 0.5], foreTint: [1, 0.86, 0.86], flicker: [0.8, 1] },
	},
	/** the fire pass's level per mode, PER LAYOUT so portrait can be tuned without touching landscape ('landscape' is
	 *  also phone sideways). Both are the approved 50 / 50 / 70 / 100 today. */
	fire: {
		landscape: { base: 0.5, bonus: 0.5, super: 0.7, epic: 1 },
		portrait: { base: 0.5, bonus: 0.5, super: 0.7, epic: 1 },
	},
	// the scene keeps the base wash as its dim; in a feature it stays at the level the lit stills were approved at (0.69)
	dim: { base: 1 - BACKGROUND_WASH.base, freegame: 0.69 },
	/** a change of mode (day to night and back, the levels, the tints, the dim), and the scene's first appearance over
	 *  the placeholder when its files land after the layout is already showing */
	crossfadeMs: 600,
	flicker: {
		terms: [
			[0.83, 0.5, 0],
			[2.17, 0.3, 1.3],
			[5.3, 0.2, 4.1],
		],
	},
	/** the flicker and the idle are written at most this often (30 a second) */
	idleIntervalMs: 33,
	chain: {
		kickLagMs: 54,
		/** fixed integration step, and the travel under which a chain with no kick on it is put back at rest */
		stepMs: 4,
		restPx: 0.04,
		hang: {
			segments: 12,
			periodMsPerRootPx: 103,
			shape: 1.6,
			lagMs: 140,
			holdFrom: 0.72,
			L: { period: 1, damping: 0.24, gain: 14, max: 9, hold: 0.8 },
			R: { period: 1.04, damping: 0.085, gain: 36, max: 20, hold: 0 },
		},
		swag: {
			segments: 10,
			periodMs: 1250,
			damping: 0.3,
			dir: [0.92, 0.38],
			L: { gain: 14, max: 8 },
			R: { gain: 22, max: 13 },
		},
		idle: {
			hang: {
				L: { px: 0.9, terms: [[7300, 0.5, 0.4], [4100, 0.3, 2.9], [2700, 0.2, 5.1]] },
				R: { px: 2.6, terms: [[8900, 0.5, 3.3], [5300, 0.3, 0.7], [3100, 0.2, 2.2]] },
			},
			swag: {
				L: { px: 0.35, terms: [[9700, 0.6, 1.9], [6100, 0.4, 4.4]] },
				R: { px: 0.7, terms: [[11300, 0.6, 0.2], [6700, 0.4, 3.6]] },
			},
		},
	},
} as const;

// ---- The ambient sky (game/sky.ts, drawn by game/scene.ts; assets by tools/build_scene_assets.py --sky) ----------
// LANDSCAPE and PHONE SIDEWAYS (Corey 2026-10-11), and PORTRAIT with the same code (Corey 2026-10-12: "Full sky in
// portrait"; its numbers are SKY.portrait, at the end of this comment). Six layers between the painted backdrop and the 3D
// foreground, back to front: the AURORA (EPIC), CLOUDS, the RIDGE cut-out (the skyline cut from the same painting, so
// the aurora and the clouds pass behind the peaks), BIRDS (day), BATS (night), canyon FOG. Every px is a px of the scene's 2560 x 1440 frame, every
// px/s and ms REAL time at every turbo level; it never pauses and knows nothing of spins, wins or features.
// THE NUMBERS of clouds, birds, bats, fog and aurora are Corey's own, tuned in the sky playground and pasted
// 2026-10-11 (images/sky_r1/corey_sky_values_2026-10-11_1848.txt, with its 19:17, 19:23 and 19:52 blocks). The phone sideways fit crops
// about 128 px of the frame at the top and at the bottom, so the top of every band is off the screen there.
//   modes     per background key, blended by the scene's own mode crossfade (SCENE.crossfadeMs) with everything
//             else: the clouds' and the fog's tint (times the scene's dim, like every layer) and their layer's
//             opacity, and the flyers' shares: birds 1 in the day modes and 0 at night, bats the other way round. A
//             flock in flight fades with the crossfade and is gone at share 0; none of a kind is sent until its
//             share is fully 1, so the two kinds are never in the air together. `aurora`: the aurora's level, 1 in
//             EPIC and 0 elsewhere, so it fades in and out with EPIC's crossfade. EPIC's fog is near white on purpose
//             (Corey: the fires redden the foreground, not the mist) and its clouds barely there and pale green
//             (Corey: "barely visible during Epic, so the Aurora pops").
//   aurora    EPIC ONLY, behind the clouds and the cut-out (the peaks hide it as they hide a cloud). `ribbons`
//             curtains, each a row of `columns` + 1 ADDITIVE sprites of the atlas's one coloured cell (sky_aurora:
//             clear, violet, teal, green, a bright lower edge), FW / columns apart and twice that wide: the cell's
//             alpha is a triangle across, so neighbours overlap by half and sum to 1, which interpolates height,
//             lower edge and brightness from column to column with no seam. Per column at u = 2 pi x / FW, with
//             tw = t x waveSpeed, ts = t x shimmerSpeed (t in s) and ph = ribbon x ribbonPhase (the shape's own
//             numbers are in game/sky.ts writeAurora, from the playground's reference):
//               lower edge  base - ribbon x spread + wave x (two sines along u, drifting with tw), never under the
//                           cut-out's lower edge
//               height      height x (0.65 .. 1)
//               opacity     strength x (1 - shimmer + shimmer x rays) x swell, x `further` for every curtain after
//                           the first; rays 0 .. 1 are the fine moving streaks (ts), swell 0.1 .. 1 the slow
//                           brightening along the curtain
//             Tinted by the scene's dim like every layer. columns: 96 keeps the finest streak (23 along the frame)
//             at four columns a period; fewer is cheaper and softer.
//   clouds    the Angry Mantis cloud model (ambientSpec.ts CLOUDS): each cloud takes scale, speed and opacity from
//             a depth (0 = the far values, 1 = the near ones), speed and scale then each jittered by +- `jitter`.
//             sets: 'two' = TWO SEPARATE SETS (Corey): the clouds are alternately far and near for good (the even
//             ones far, the odd ones near: 23 gives 12 far and 11 near), each using only its set's values, every
//             near cloud drawn over every far one; 'blended' = the first model: each rolls a depth anywhere in
//             0 .. 1 at every wrap and sits between the far and the near values. y anywhere in the band (held clear
//             of the cut-out's lower edge: a cloud's lower edge never passes it); drifts `direction` (-1 right to
//             left) and wraps with fresh rolls, entering up to `lead` px outside the frame; the first fill spreads
//             them over `spread` px. scale is of the wisp cell (640 x 96 frame px, SCENE_SPEC.sky.wisp).
//   birds     the Angry Mantis bird system (ambientSpec.ts BIRDS, AmbientSky.svelte). Per flock: a side, a depth t
//             (size far..near, speed x speedByDepth x (1 +- jitter), opacity alpha[0]..alpha[1], the small-bird row
//             under farBelow, else one of the big rows), a height in the band, min..max birds. formation 'v': a
//             loose V, each bird `spacing` x the size behind and beside the last, all at the flock's speed. Per
//             bird: its own size jitter, flap phase and bob (bob px at bobRate rad/s), plus `flutter` px of a faster
//             uneven wobble (0 for the birds). The next flock after everyMs x (1 +- spread); the first after
//             firstS. Spawned `margin` px outside the frame, gone `exit` px past it, each by itself. pool: the
//             sprites built once (a flock that would not fit is not sent and counted as refused; 96 because the
//             slowest far flock, 4.85 px/s, takes over nine minutes to cross: 20000 simulated hours peak at 80 in
//             flight, mean 29, and 48 refused one flock in 180); parkX / parkY: where a bird that is not flying
//             waits, transparent, far off the frame. intervalMs: how often they are moved (33 like everything
//             here; 0 = every frame).
//   bats      NIGHT ONLY (SUPER, EPIC): the birds' code and fields with their own numbers and THEIR OWN FRAMES
//             (Corey 2026-10-12: a bat sheet made from the birds' by erasing, bats.json beside birds.json, the same
//             rows and rectangles; `frames` is the frame names' prefix, <frames>_<row>_<frame>.png; it rides the
//             scene's NIGHT set, and until it lands there are no bats, never a bird standing in). The sheet is
//             black already, so `tint` is 1, 1, 1: the bats take only the scene's dim, like the birds (it stays a
//             constant, times the dim, to tune). formation 'scattered' (Corey: not in a V, more
//             randomness): each bat starts up to looseX px behind the flock's lead point and up to looseY px above
//             or below its height, and flies at the flock's speed x (1 +- looseSpeed), so the group drifts apart;
//             `spacing` is only read by a V. Every number is Corey's own from the playground (2026-10-12 21:01),
//             but for three. bobBySize / flutterBySize (Corey: "the bob height variation should be handled by the
//             bird size"): a bat's bob, and its flutter, is the number here x (its own size / size.near), so a
//             small far bat swings less than a big near one; the birds have neither switch and keep one bob for
//             every bird. minGapX / minGapY / gapTries / gapPassS: THE GAP, no two bats nearly on top of each other,
//             decided when the flock is rolled (the note is at the numbers). pool 112: a flock every 1.08 to 6.92 s of 3..8, each bat starting up to 1200 px behind
//             the lead and flying 20 to 672 px/s, so the slowest possible crossing is 195 s. 100000 simulated hours
//             (90 million flocks) of the 2560 frame peak at 96 in flight, mean 36, and of the 1440 portrait frame
//             at 75, mean 25; the old 64 would have refused one flock in 1300 in landscape (and 63 in 90 million
//             in portrait). 112 is that peak plus two full flocks.
//   fog       soft mist bands in the gorge, behind the courtyard: per band its atlas cell, where it starts, its
//             scale of the fog cell (1280 x 400 frame px), drift (px/s, it wraps once it has wholly left the
//             frame), and opacity, which breathes by +- `breath` over breathMs (one period per band) while the band
//             bobs bobPx over bobMs.
//   portrait  THE PORTRAIT SKY (Corey 2026-10-12). The portrait scene is its own 1440 x 2560 frame with its own cut-out
//             (SCENE_SPEC_PORTRAIT.sky, cut from the portrait backdrops by the same matte); it draws the same atlas,
//             birds and bats, by the same code, with the same modes, crossfade and dim. Its numbers are NOT a second
//             free set: every one is a landscape number above put through one of four rules, and whatever is not
//             listed in the block is the landscape value itself. Tune from here.
//             K  `scale` = 1. Screen px per frame px in portrait over the same in landscape. Both scenes are cover
//                fitted and the two frames are each other turned (1440 x 2560, 2560 x 1440), so on ANY screen the
//                portrait fit equals the fit of the same screen held sideways: phone 390 x 844 0.3297 both ways, tablet
//                768 x 1024 0.5333 both ways. So K is exactly 1 and a cloud, bird or bat is the same size and speed in
//                screen px as on that phone held sideways. game/sky.ts multiplies by K every SIZE and SPEED: clouds
//                scale, speed, lead; birds and bats size, speed, bob, flutter, looseX, looseY, margin, exit; fog scale,
//                speed, bobPx; aurora wave. (The painting itself is drawn smaller in portrait, 891 rows against 1440,
//                0.619: with K = 0.619 everything would keep its size against the MOUNTAINS instead of on the screen.
//                One number to change if that is wanted.)
//             W  1440 / 2560 = 0.5625, the frame's width over landscape's: COUNTS along the frame, so the density
//                along it matches.     clouds.count 23 -> 13 (7 far, 6 near); aurora.columns 96 -> 54 (the same 26.67
//                px a column, and the curtain's folds keep their landscape length: it is the landscape curtain's
//                first 1440 px); clouds.spread 3200 -> 2080 (the frame plus the same 640 beyond it); fog x 620 -> 349,
//                2050 -> 1153. The flocks keep everyMs and min..max (a flock crosses the narrower frame sooner, so
//                the number in the air at once falls by W by itself) and the pools keep their sizes (never refused).
//             S  592 / 400 = 1.48, the portrait cut-out's lower edge over landscape's (the sky is the top of the frame
//                down to the skyline, rows 385 .. 582 here, 74 .. 393 there): every BAND and height IN THE SKY.
//                clouds.band 0 .. 400 -> 0 .. 592; birds.band 0 .. 600 -> 0 .. 888; bats.band 0 .. 261 -> 0 .. 386;
//                aurora.base 360 -> 533, spread 60 -> 89, height 415 -> 614.
//             P  y -> 340 + y x 891 / 1440, the same place IN THE PAINTING (its rows 340 .. 1231 of the portrait
//                frame): the FOG, which belongs to the painting's gorge. The portrait painting has the same gorge
//                (the cliffs under the bridge and the river valley below them), so the two bands sit on the same
//                two places of it: y 988 -> 951, 748 -> 803. On a phone the board covers most of that (the bands
//                are 1200 px tall, so their upper half shows between the logo and the board and beside the frame).
export const SKY = {
	/** positions and opacities are written at most this often, and a step never covers more than maxStepMs (a tab
	 *  that was hidden does not jump the sky on) */
	intervalMs: 33,
	maxStepMs: 100,
	modes: {
		base: { clouds: [1, 0.94, 0.82], cloudAlpha: 1, fog: [1, 0.9, 0.76], fogAlpha: 1, birds: 1, bats: 0, aurora: 0 },
		bonus: { clouds: [1, 0.94, 0.82], cloudAlpha: 1, fog: [1, 0.9, 0.76], fogAlpha: 1, birds: 1, bats: 0, aurora: 0 },
		super: { clouds: [0.68, 0.8, 1], cloudAlpha: 0.7, fog: [0.55, 0.7, 1], fogAlpha: 1, birds: 0, bats: 1, aurora: 0 },
		epic: { clouds: [0.72, 0.95, 0.82], cloudAlpha: 0.15, fog: [0.92, 0.95, 1], fogAlpha: 1, birds: 0, bats: 1, aurora: 1 },
	},
	aurora: {
		strength: 0.55,
		ribbons: 4,
		base: 360,
		spread: 60,
		height: 415,
		wave: 23,
		waveSpeed: 0.25,
		shimmer: 0.14,
		shimmerSpeed: 2.2,
		further: 0.7,
		ribbonPhase: 2.1,
		columns: 96,
	},
	clouds: {
		count: 23,
		sets: 'two' as 'two' | 'blended',
		band: { y0: 0, y1: 400 },
		scale: { near: 2.5, far: 0.9 },
		speed: { near: 151, far: 62 },
		alpha: { near: 0.6, far: 0.71 },
		jitter: 0.86,
		direction: -1,
		spread: 3200,
		lead: 400,
	},
	birds: {
		everyMs: 15000,
		spread: 0.5,
		firstS: 2,
		flock: { min: 3, max: 6 },
		size: { near: 31.8, far: 15.4 },
		sizeJitter: [0.85, 1.15],
		speed: 121.2,
		speedByDepth: [0.2, 0.57],
		jitter: 0.8,
		alpha: [0.11, 0.68],
		flapFps: 15,
		bob: 7.5,
		bobRate: 1.1,
		flutter: 0,
		band: { y0: 0, y1: 600 },
		farBelow: 0.35,
		formation: 'v',
		spacing: { x: 1.65, y: 0.7 },
		looseX: 0,
		looseY: 0,
		looseSpeed: 0,
		margin: 80,
		exit: 107,
		pool: 96,
		parkX: -4000.5,
		parkY: -4000.5,
		intervalMs: 33,
	},
	bats: {
		// COREY'S OWN VALUES, tuned in the sky playground v7 and pasted 2026-10-12 21:01
		// (~/Desktop/Manticore Mayhem/images/sky_r3/corey_bat_values_2026-10-12_2100.txt), put in exactly. From the
		// values before: alpha 0.67 .. 0.86 -> 0.84 .. 1; size near 26 -> 46.5, far 16 -> 26; sizeJitter 0.85 -> 0.49;
		// everyMs 3000 -> 4000; spread 0.5 -> 0.73; firstS 2 -> 1; flock 2..5 -> 3..8; speed 230 -> 261; flapFps 24 -> 15;
		// bob 30 -> 11; flutter 14 -> 20.5; band 61 .. 311 -> 0 .. 261; farBelow 0.35 -> 0.59; margin 80 -> 108;
		// looseX 320 -> 1200; looseY 110 -> 258; looseSpeed 0.35 -> 0.61. NOT his: bobBySize, flutterBySize and pool
		// (each has its own note below).
		everyMs: 4000,
		spread: 0.73,
		firstS: 1,
		flock: { min: 3, max: 8 },
		size: { near: 46.5, far: 26 },
		sizeJitter: [0.49, 1.15],
		speed: 261,
		speedByDepth: [0.5, 1],
		jitter: 0.6,
		alpha: [0.84, 1],
		flapFps: 15,
		bob: 11,
		bobRate: 8,
		flutter: 20.5,
		// Corey 2026-10-12, with the values: "I really think the bob height variation should be handled by the bird size".
		// bobBySize: a bat's bob is `bob` x (its own drawn size / size.near), its size being the flock's by depth x its
		// own sizeJitter, so `bob` is the bob of a bat of exactly the near size: far 26 x 0.49 = 12.74 px bobs 3.01 px,
		// near 46.5 x 1.15 = 53.5 px bobs 12.65 px. flutterBySize: the same for `flutter` (5.62 .. 23.58 px), my choice,
		// not his words: false gives every bat the whole `flutter` again. (The playground he tuned in gave every bat
		// the whole bob and the whole flutter.)
		bobBySize: true,
		flutterBySize: true,
		// THE FLAP-TIMED BOB (Build B2, 2026-10-14; Corey: "Yes go with the build on the flap timed bob and glides, I trust
		// you", values mine, judged by him on a clip: images/sky_r6). The bob is no longer on bobRate's clock: it follows
		// each bat's own wing cycle (8 frames a flap at flapFps 15, so one bob per 0.53 s). In the sheet the wings rise
		// over frames 0 to 7 (the silhouette's weight climbs from low to high) and beat down in the swap from 7 back to 0.
		// The body LIFTS over `rise` of the cycle centred on `downAt` (a position in frames: 0 is that swap, 0.25 a
		// quarter frame after it) and SINKS over the rest, eased at both ends; the swing is still +-bob x its size / near.
		// rise 0.35 = a quick lift over 2.8 frames and a slower sink over 5.2, the power stroke and the recovery. The
		// flutter (above, by size) stays on its own clock on top, but at `flutter` x its height while flapping: at its full
		// 20.5 (about 4 wobbles a second, up to twice the bob) it drowned the beat, so a bat bobbed in time with its wings
		// in one flap and against them in the next (sky_r6/NOTES.md). 1 gives today's whole flutter back; the 20.5 above
		// and its scaling by size are unchanged. bobRate now drives only that flutter.
		flapBob: { downAt: 0.25, rise: 0.35, flutter: 0.4 },
		// THE GLIDES: every so often a bat holds its wings spread. Each bat has its own schedule (its first glide firstS
		// after it takes off, then everyS after the last one ends, each a fresh random), so a flock never glides together.
		// A glide that is due waits for its row's `frame` to come up in the cycle (at most one flap, 0.53 s), then holds
		// that frame for holdS: the bob stands still (its wing cycle is held, so its height is held), the flutter eases
		// out over easeS, the bat sinks sinkPx x its size / near (smoothly, eased at both ends), then it flaps on from
		// the same frame, the flutter eases back in over easeS and the sink climbs back over recoverS (keep recoverS under everyS[0]). frame: per row of the sheet, the
		// frame with the wings out level (rows 0 and 1: frame 5, row 2: frame 7, the small row 3: frame 4). The gap rule
		// counts the sink in each bat's envelope (game/sky.ts near), so it holds as before.
		glide: { firstS: [0.6, 8], everyS: [3, 8], holdS: [0.5, 1.2], frame: [5, 5, 7, 4], sinkPx: 14, easeS: 0.18, recoverS: 1.4 },
		band: { y0: 0, y1: 261 },
		farBelow: 0.59,
		formation: 'scattered',
		spacing: { x: 2.4, y: 1.4 },
		looseX: 1200,
		looseY: 258,
		looseSpeed: 0.61,
		// THE GAP (Corey 2026-10-12, of the EPIC capture sky_r4/sky_desktop_1440x900_epic_bats_15s.mp4: "there were two
		// bats so close together they were almost overlapping and swapping places up and down. Not exactly on top of each
		// other, but so close that it didn't look right."). Decided when a flock is rolled, never per frame (game/sky.ts,
		// Flyers.spawn and near). A bat's path is its straight flight (where it starts, its lane, its own speed) with a
		// vertical envelope of its own bob + flutter + half its height. Two bats are too close if, at any time while both
		// are over the frame (plus the larger one's width each side), they come within minGapX x the larger one's width
		// of each other along the flight AND their envelopes are closer than minGapY x the larger one's height. That is
		// worked out in closed form against every bat of the same flock and every bat already in flight. A bat that is
		// too close has its place (behind the lead, above or below) rolled again, up to gapTries times; its size and speed
		// are never rolled again. Still too close: it is left out of the flock; or, where that would take the flock under
		// flock.min, it is moved to the nearest free lane inside the flock's own looseY, and failing that to just above
		// the frame, out of sight. A bat whose envelope is wholly above the frame is never seen and blocks nobody.
		// gapPassS (NOT in his words, mine, 0 = off = the rule exactly as above): a pass that keeps two bats within
		// minGapX for no longer than this many seconds is let through. It is here because the rule at 0 costs most of
		// the bats on screen (sky_r5/NOTES.md has the numbers): the one number to raise if the sky is too empty.
		// Only the bats have these (the birds fly a V with fixed spacing and are approved as they are).
		minGapX: 1.5,
		minGapY: 1.5,
		gapTries: 12,
		gapPassS: 1, // set by Claude 2026-10-13 00:05 while Corey slept: strict (0) leaves 7.5 bats on screen against his 19.7; 1 s keeps 16.2 and still stops pairs flying together. His call in the morning.
		frames: 'bat',
		tint: [1, 1, 1],
		margin: 108,
		exit: 107,
		// 64 -> 112 with his values (bigger flocks, longer trails: see the comment above)
		pool: 112,
		parkX: -4000.5,
		parkY: -4000.5,
		intervalMs: 33,
	},
	fog: {
		bands: [
			{ cell: 0, x: 620, y: 988, scale: 3, speed: 59, alpha: 0.43 },
			{ cell: 1, x: 2050, y: 748, scale: 3, speed: 60, alpha: 0.48 },
		],
		breath: 0.2,
		breathMs: [23000, 31000],
		breathPhase: 2.1,
		bobPx: 10.5,
		bobMs: 41000,
	},
	/** THE PORTRAIT SKY: only what differs from the numbers above, each by its rule (K, W, S, P in the comment) */
	portrait: {
		scale: 1,
		aurora: { base: 533, spread: 89, height: 614, columns: 54 },
		clouds: { count: 13, band: { y0: 0, y1: 592 }, spread: 2080 },
		birds: { band: { y0: 0, y1: 888 } },
		// Corey's bat values 2026-10-12: the band 0 .. 261 by rule S (x 1.48)
		bats: { band: { y0: 0, y1: 386 } },
		fog: {
			bands: [
				{ x: 349, y: 951 },
				{ x: 1153, y: 803 },
			],
		},
	},
} as const;

// ---- The brazier flames (game/flames.ts, drawn by game/scene.ts; assets by tools/build_flame_assets.py) -----------
// LANDSCAPE and PHONE SIDEWAYS only (Corey 2026-10-11). One fire in each of the courtyard's two brazier bowls, over
// the foreground and the fire light pass and under the chains; each flame's base is hidden behind its bowl by a RIM
// OCCLUDER cut from the foreground art (no mask, no filter). Every px is a px of the scene's 2560 x 1440 frame unless
// it says canvas px (a clip's own canvas), every ms REAL time at every turbo level; it never pauses.
//   bowls     per side the flame's anchor point: the bowl's centre on the rim line (game/flameSpec.ts `bowls`, measured
//             from the foreground by the tool: the rim slab runs x 338.5 .. 696 on the left and mirrors on the right;
//             its top silhouette is at y 715.7 at the centre).
//   clips     as delivered (flames-drop-1 meta.json): the canvas and the anchor in canvas px (on the rim line at the
//             bowl's centre; the art runs about 10% of its height under it, behind the rim), fps, frames, and the draw
//             scale, each its own constant.
//   modes     which clip a background key burns: the braziers ARE lit in the base game.
//   twin      both bowls play the same clip from one copy of the textures; the right one is mirrored and `phase` of
//             a loop ahead, so they never look alike.
//   The crossfade between two clips is the scene's own (SCENE.crossfadeMs, linear, with the night crossfade): the
//   outgoing clip's opacity runs down while the incoming one's runs up, both on the same anchor. A clip whose sheet is
//   not in yet (super and epic ride the deferred phase) leaves the base clip burning until it lands.
//   flicker   light and flame agree: the scene's flicker signal n(t), -1 .. 1 (SCENE.flicker, the one the fire light
//             pass pulses on) also drives the flame: its brightness (a tint) is 1 - dim (1 - n) / 2 and its scale
//             1 + breath n about the anchor.
//   dim       how much of the scene's dim (SCENE.dim, the wash) the flame takes: 0 none (a flame is a light), 1 all
//             of it like every painted layer. The embers have their own share.
//   epicTint  EPIC's red, three treatments to choose from (`default`; __manticore.flames.treatment('A' | 'B' | 'C')):
//             A the fire light's own multiply (SCENE.modes.epic.fireTint: it kills the pale core), B a gentler
//             multiply, C the flame untinted over a red ADDITIVE copy of the same frame (`red` its tint, `alpha` its
//             opacity, `scale` its size against the flame's), so the core stays pale and the fringe goes red.
//   embers    SUPER and EPIC only (`strength` per key, blended by the scene's crossfade; 0 = none): per bowl a pool of
//             `count` additive dots (0 turns them off). At strength 1 a bowl sends one every everyMs. Each starts
//             inside the flame (within +- spread x the flame's half width of the centre, `from` x the flame's height
//             above the rim line), rises at `rise` px/s easing off by `slow` over its life, drifts up to `drift` px/s
//             sideways with a sway of sway.px at sway.hz, is `size` px across and shrinks by `shrink`, lives lifeMs,
//             fades in over the first `fadeIn` of its life and out as (1 - u)^fadePow from `alpha`, twinkling by
//             twinkle.depth at twinkle.hz. tint per key; dim: its share of the scene's dim. parkX / parkY: where an
//             ember that is not burning waits, transparent, far off the frame.
export const FLAMES = {
	/** frames, brightness and embers are written at most this often (the scene's slow step), and a step never covers
	 *  more than maxStepMs */
	intervalMs: 33,
	maxStepMs: 100,
	bowls: { L: [517.25, 715.7], R: [2042.75, 715.7] },
	clips: {
		base: { canvas: [256, 256], anchor: [128, 224], fps: 15, frames: 32, drawScale: 0.85 },
		super: { canvas: [320, 448], anchor: [160, 400], fps: 30, frames: 64, drawScale: 1 },
		epic: { canvas: [384, 704], anchor: [192, 640], fps: 30, frames: 64, drawScale: 1.2 },
	},
	modes: { base: 'base', bonus: 'base', super: 'super', epic: 'epic' },
	twin: { mirror: true, phase: 0.5 },
	flicker: { dim: 0.14, breath: 0.02 },
	dim: 0.35,
	epicTint: {
		default: 'B' as 'A' | 'B' | 'C',
		A: [1, 0.7, 0.5],
		B: [1, 0.85, 0.72],
		C: { flame: [1, 1, 1], red: [1, 0.16, 0.05], alpha: 0.55, scale: 1.05 },
	},
	embers: {
		count: 14,
		strength: { base: 0, bonus: 0, super: 0.6, epic: 1 },
		tint: { base: [1, 0.72, 0.38], bonus: [1, 0.72, 0.38], super: [1, 0.72, 0.38], epic: [1, 0.52, 0.3] },
		dim: 0.35,
		everyMs: 170,
		spread: 0.55,
		from: [0.1, 0.6],
		rise: [70, 150],
		slow: 0.5,
		drift: 26,
		sway: { px: 9, hz: [0.5, 1.3] },
		size: [5, 11],
		shrink: 0.4,
		lifeMs: [1100, 2300],
		alpha: 0.9,
		fadeIn: 0.12,
		fadePow: 1.6,
		twinkle: { depth: 0.4, hz: [5, 11] },
		parkX: -4000.5,
		parkY: -4000.5,
	},
} as const;

// ---- The fire loops (game/fireSound.ts; sprite entries by tools/build_audiosprite.py MM_EVENTS) ------------------
// Tied to the flames' modes: SUPER plays sfx_fire_super (a crackle), EPIC sfx_fire_epic (a low roar with that crackle
// layered on since 2026-10-12; the roar alone was inaudible under the EPIC music), both 6.00 s
// seamless loops, quietly under the music for the whole round; the base game and the regular Bonus have none.
//   fadeMs       in and out with the scene's change of mode (the sound system's own fade of a playing sprite sound).
//   stopAfterMs  a faded-out loop is stopped this long after its fade has ended.
//   volume       the loop's level, a gain on the clip as it is in the sprite (no gain is baked in for these two):
//                the crackle 0.44 = -7.1 dB, which puts it at -45.8 LUFS, 12 dB under the coin counter loop (-33.6);
//                EPIC's loop 0.49 = -6.2 dB (2026-10-12; it was 0.355 for the roar alone). The new clip is the old roar
//                x 0.634 (-4.0 dB) plus SUPER's own crackle x 0.892 (-1.0 dB), sample aligned (least squares fit of
//                the two sources to it, residual -57 dBFS). What Corey hears in SUPER is the crackle at 0.44, so
//                EPIC's copy of it is put at the same level: 0.44 / 0.892 = 0.493, rounded to 0.49 (0.437, 0.06 dB
//                under SUPER's). The roar under it then plays at 0.634 x 0.49 = 0.31, 1.2 dB under where it was at
//                0.355. Whole clip: -24.9 LUFS in the sprite, -31.1 as played (it measured -30.1 as the roar alone
//                and could not be heard: nearly all of that number is the roar's energy under 120 Hz, so the full
//                band figure says nothing about audibility; over 500 Hz the old loop's loudest 50 ms played 15.7 dB
//                under SUPER's crackle's (rms 3.8 dB under) and the new one's plays level with it (rms 1.2 dB
//                over)). Super and Epic share one music track at volume 0.6. Both loops then follow the effects
//                volume and mute like every effect.
export const FIRE_SOUND = {
	fadeMs: SCENE.crossfadeMs,
	stopAfterMs: 60,
	loops: {
		super: { name: 'sfx_fire_super', volume: 0.44 },
		epic: { name: 'sfx_fire_epic', volume: 0.49 },
	},
} as const;

// ---- The chain sounds (game/chainSound.ts; sprite entries by tools/build_audiosprite.py MM_EVENTS) ----------------
// Corey's mapping (2026-10-11): a feature's BOARD KICK (the claw swipe's, the roar's) plays the heavy clank; the WIN
// PLAQUE dropping in plays the light rattle; the LOGO landing the light rattle, quieter; a win TIER landing nothing
// (each tier has its own sound). The LEVELS are in the sprite (build_audiosprite.py MM_SOURCE_GAIN_DB and
// MM_ALIAS_VOLUME): the clank 8 dB under sfx_cluster_remove, the plaque's rattle 10 dB under, the logo's 16, each
// measured on the clip's loudest 50 ms.
//   kickThresholdPx  the clank sounds when a kick's ENVELOPE first reaches this (playground px, like the kick itself;
//                    the envelope, not the rattle's value on one frame): at the very start of a swipe's kick (its
//                    5 px decay from there), and 0.4 of the way into a roar's rattle (6 px x u^1.5: about 0.55 s
//                    into 1.4 s), as its shaking becomes visible. Once per kick.
//   kickMinGapMs     no second clank inside this many REAL ms of the last (the clank is 1.15 s long). Two swipes
//                    one after the other are 2.03 s apart at normal speed, 0.92 s at turbo 1 and 0.54 s at turbo 2
//                    (measured, tools/manticore/win_sound_probe.js): so each clanks at normal speed and turbo 1, and
//                    at turbo 2 every second one does.
//   gust             which rattle a chain gust kind plays when the board's chains start to lean (null: none).
export const CHAIN_SOUND = {
	kickThresholdPx: 1.5,
	kickMinGapMs: 800,
	gust: { plaque: 'sfx_chain_light', logo: 'sfx_chain_light_logo', tier: null },
} as const;

// ---- Symbol art ---------------------------------------------------------------------------------
// ---- THE MANTICORE (game/creature.ts, game/creatureLoad.ts, game/creatureAssets.ts; wired 2026-10-13) ----------
// The creature sprite from rig drop 4 with its glow add-on (2026-10-13; tools/build_creature_assets.py; clip facts in the generated game/creatureSpec.ts,
// never typed here). Decisions: Corey 2026-10-12 / 13 unless marked. Idle and the idle alternates run in REAL time at
// every turbo level; the attack clips in STYLE time (x TURBO_SCALE) like the board effects they belong to. Nothing in
// the game waits for him.
//   place     PER LAYOUT (Corey's placement playground, 2026-10-12 22:11): the feet point (canvas col 512, feetRow) in
//             px of that layout's scene frame INSIDE the foreground container (so the oversize and the kick are in it),
//             the draw scale of the rig's 1024 canvas in those px, and the layer: 'front' = in front of the board, its
//             frame and its chains (and behind the HTML HUD and every canvas overlay), 'behind' = in the scene's
//             foreground, behind the board. His shadow lies on the floor (the scene's foreground) in both.
//             WHICH PORTRAIT: a portrait screen is 'portraitPhone' or 'portraitTablet', never between: by the layout
//             system's own size class (utils-layout canvasSizeType, the test that already tells a phone held sideways
//             from a desktop window): the screen's SHORT side at most 480 CSS px is a phone, wider is a tablet.
//             TABLET (2026-10-15, approval review major 1): was { x 1254.2, y 2026.8, scale 0.555, front } on the floor
//             right of the board, where at 1024 x 1366 his wing hid most of the bottom right cell and the edge of
//             column 7, the tail rose past rows 6 and 7 and he sat under the SPIN readout. Now as on the phone: behind
//             the board, on the frame's top right corner beside the logo, his claws on or behind the top rail. His
//             drawn pixels clear the cell area and every HUD text at 600 x 960, 768 x 1024, 820 x 1180, 834 x 1194 and
//             1024 x 1366 (creature_probe.js PLACE). shadow false: his feet are off the floor there (the shadow would
//             float on the cliffs). The SKIP TO RESULT plate (features only) covers the tip of his tail at 768 and 1024.
//   looks     the look each mode shows. ONE is resident; a change of mode crosses to the new one over lookFadeMs (the
//             scene's own crossfade) once its idle sheet is uploaded. The rig's fourth look ("night", no fire) is not
//             shipped: no mode shows it.
//   lookLoad  WHEN A FEATURE'S LOOK IS FETCHED (Corey 2026-10-14 17:19: "The 12MB download, not okay [...] It's probably
//             okay to start the download after loading everything else and the player is playing, though. Not okay to
//             wait til the feature and show the wrong manticore"; 17:21: "I'd rather load the wrong manticore in the
//             rare case a player gets a super or epic on first spin, not hide it completely"; game/creatureLoad.ts).
//             prefetch: once every deferred group is in AND the player's first round has settled, the files of
//             `prefetchLooks` (this tier's only) are fetched into the HTTP cache, one file at a time at low priority,
//             never decoded and never uploaded (one look stays resident); a new file does not start while a round's
//             play request is on the wire (`waitMs`: how often it looks again; a file already on its way runs on, at
//             low priority: a fetch cannot be paused). early: the look of a feature that is coming (a book with a Super or Epic in it, or a
//             Super or Epic buy armed) starts loading at once, its idle sheet decoded and uploaded during the trigger
//             and the intro; its attacks and alternates wait until the mode asks for it and the crossover to it is
//             over (every change of look), so only its idle sheet is on the GPU beside the look on show until then. If it is still not in when the feature shows, he
//             stays in the look on show until it is (no hiding), then the two cross over as before
//   landingFadeMs   THE LANDING SCREEN (Corey 2026-10-13: he stood behind the intro cards, his head and wing between
//             the logo and the card on a portrait phone): while the landing screen is up he is not drawn (body and
//             shadow, in every layout) and makes no sound; his sheets load as before. When the landing screen goes he
//             fades in over this many REAL ms, under the black of the transition as it clears (350 ms).
//   landingFadeStepMs   ...and no tick moves that fade by more than this many ms' worth. The board mounts in the
//             frames in which the landing screen goes (over a second in the dev build): counted by the clock alone the
//             fade would be over when the next frame is drawn, which is a pop. Two 60 Hz frames.
//   holdMs    the freeze on a clip's hold frame (the rig's default), style time
//   rushMs    an action asked for mid idle: the idle runs to its frame 1 the short way round inside this (style time)
//             and the clip starts then; from the loop's last rushFreeFrames frames or its first rushFreeFrames + 1 it
//             starts at once (creature_loader_spec.md 3.2: only those seven are within two idle steps of frame 1)
//   strikeLead   a sting_hit starts (holdFrame - 1) frames BEFORE the hit, so the tail lands on it (false: on it)
//   sting     the board's own beats the strike is timed from, style ms: where a normal and a scatter sting's cell flips
//             in its beat, the scatter run's first hold, the two charge lengths (all read from STING / SCATTER_STING)
//   recrouch  BETWEEN TWO STINGS of a run (drop 4): the rig's sting_recrouch follows sting_hit's hold frame f6 (the tail
//             whips back: 24 % of the outline, the size of sting_hit's own step out of its hold) and its f7 is
//             charge_loop f12's outline exactly, so it hands over to charge_loop f1 as the loop's own seam (2.6 %). The
//             old cut (sting_hit f13 to charge_loop f6) is gone. strikeFromFrame: a strike that comes due during the
//             re-crouch starts from this frame of it on (3.9 % and 12 px to sting_hit f1; from f4 it is 4.9 % and
//             39 px). Measured joins: creature/prep_2026-10-13/creature_loader_spec_delta.md 4.1.
//   crouchUpFrame   NO STING CAME after all (crouchTimeoutMs): he gets up by playing sting_hit from the frame AFTER this
//             one, out of whatever charge_loop frame he is on (there is no stand up clip). The old cut's frame: 8.6 %
//             at best (charge_loop f6 to sting_hit f13), 10.4 % from f14.
//   glow      THE LIT STRIKE (the glow add-on, Corey 2026-10-13 "the glow must stay lit until the sting lands"): a big
//             or super sting's tail keeps the charge's glow at `strength` from sting_hit f1 through the hold frame the
//             hit lands on, then fades over the rig's three glow frames after it (sting_hit f7..f9, or sting_recrouch
//             f1..f3 when another sting follows), along the rig's gain hint (0.75 / 0.5 / 0.25 at each frame's start)
//             and on to 0 at the end of the third, in a straight line. fadeMs: STYLE (clip) ms of that fade, so it
//             follows turbo (45 ms at 2.2, 25 at 4); not above 100, the glow frames end there. A normal or scatter
//             sting has no glow at all (unchanged).
//   glowPhase BEFORE A LIT STRIKE the crouch starts on the charge_loop frame that makes its LAST frame before sting_hit
//             f12, so the strike's glow follows on from the glow frame the rig built it to follow (spec delta 8.7).
//             Started on f1, the loop is left on f7 / f8 (the strike starts strikeLead early) and the strike's glow
//             f1 is 0.55 to 0.65 of the light the frame before it, with half the lit area moving, for one frame
//             (measured on the shipped atlas 2026-10-14; from loop f1 it is x1.00 and 10 %; the loop's own seam is
//             x0.62). The body join this moves, charge_in f6 to charge_loop f6, is 3.25 % and 5 px. false: always f1.
//   glowAim   ...and when he is ALREADY DOWN as a lit charge starts (a big or super after normal stings: no phase can be
//             picked), the crouch loop runs at most maxRate faster or slower than 1 until the strike so that it still
//             leaves the loop on f1 (a super after two normal stings: about 4 %); a rate beyond that is not used. Only
//             with minFrames or more loop frames left. Presentation only: the strike's time is the board's.
//   poke      (Corey 2026-10-13 14:37) a tap or click on his body while he and the game are idle plays one of `clips`
//             at random (snarl or growl, NEVER the roar), with the voice's own rules (never the take that played last,
//             a random rate). cooldownMs: REAL ms after that clip has ended before he takes another poke.
//             rollQuietMs: REAL ms after it has ended before the idle roll may play an alternate again (the poke
//             resets his random idle timer: three idle loops). area: his body's hit area, a polygon in px of the rig's
//             1024 canvas about the feet point (x, y pairs; y up is negative), head, mane, shoulders and front legs,
//             no wings, no tail, the gap between the forelegs left out. It never takes a tap on the board's opening
//             (that stays the board's: game/boardTap.ts) and lies under every HTML control.
//   snarlOdds, growlOdds   rolled once at each idle loop restart, snarl first, never both, plain Math.random
//   breath    one quiet breath sound per idle loop, the two takes in turn, stopped when anything else of his starts
//   voice     the snarl and the growl only (the breaths are left alone): never the same take twice in a row per sound,
//             and each play at a random playback rate from rateMin to rateMax (pitch and length move together, about
//             a semitone either way). The snarl's accent is 0.218 s into its trimmed take, so the extremes move it by
//             +11 / -10 ms against the animation: a third of a 33 ms frame.
//   beatWaitMs   REAL ms the swipe's strike pose waits for the board's own beat before going on without it;
//   crouchTimeoutMs   REAL ms in the crouch with no sting coming before he gets up
//   cueBiasMs REAL ms a read-ahead estimate is put LATE on purpose. The board's step before a feature ends on a frame
//             boundary and that frame is a busy one (the drop settles, the next handler starts): measured 2026-10-13
//             in the dev build, the feature's beat came 25 to 49 ms after the drop's own arithmetic. The swipe's
//             wind-up starts on the arithmetic and is spread to the late anchor; the beat itself lands the strike. So
//             he is not seen striking before the tears, and a prompt beat costs one wind-up frame at most.
//   cueBeatBiasMs   the same for a roar and for the first sting's charge_in, which have no strike to protect: half of
//             it, so the clip starts within about a frame of its beat either way
export const CREATURE = {
	on: true,
	place: {
		// DESKTOP, 16:9 and wider (2026-10-16, THE BIGGER BOARD, layoutSpec LANDSCAPE_BOARD; was { x 2089.9, y 1213.3,
		// scale 0.96 } beside the k 1 board): see desktopTall below for the rule and the numbers.
		desktop: { x: 2180, y: 1213.3, scale: 0.86, layer: 'front' },
		phoneSideways: { x: 2249.3, y: 1157.2, scale: 0.97, layer: 'behind' },
		portraitPhone: { x: 1039.9, y: 1001.6, scale: 0.77, layer: 'behind' },
		portraitTablet: { x: 1210, y: 905, scale: 0.58, layer: 'behind', shadow: false },
	},
	/** THE DESKTOP SPOT FOLLOWS THE SCREEN'S SHAPE (2026-10-16, with the bigger board, layoutSpec LANDSCAPE_BOARD). The
	 *  scene is fitted to COVER the canvas and the master to FIT it, so on a screen narrower than 16:9 the scene's sides
	 *  are cut and the HUD sits higher in the scene: one spot cannot clear the cells, the screen's right edge and the
	 *  [Auto / Turbo] buttons on both 16:9 and 16:10. place.desktop is the spot at desktopWide.aspect (16:9) and wider;
	 *  desktopTall is the spot at its aspect (16:10); every other screen takes the straight line through the two (feet
	 *  point and scale), held at desktopMinAspect (4:3) at the narrow end (game/creature.ts creaturePlaceFor).
	 *  The rule both were set by: his drawn body (alpha > 96, over 3.4 s of idle) at least 5 CSS px clear of the cell
	 *  area, his wing tips and claws on the screen, nothing of him under a readout or the [Auto / Turbo] buttons, only
	 *  his right paw under the Play button (as since 2026-10-12, and less of it than before). The 16:9 spot is the 75 %
	 *  mockup's ({ x 2161.3, scale 0.86 }) 18.7 scene px right, clear of the cells (its wing tip was over column 8);
	 *  the 16:10 one is smaller and further back on the floor. Measured at 1920 x 1080, 1280 x 720, 1024 x 576,
	 *  1440 x 900, 1680 x 1050, 1512 x 982, 1360 x 800 and 1024 x 768 (feedback/board_75_final/creature_check.json).
	 *  A 21:9 screen (2560 x 1080) takes the 16:9 spot: there his claws go 21 CSS px under the screen's bottom and his
	 *  paws under the Play and Turbo buttons (not tuned: no 21:9 spot yet). */
	desktopTall: { aspect: 1.6, x: 2090, y: 1150, scale: 0.76 },
	desktopWide: { aspect: 16 / 9 },
	desktopMinAspect: 4 / 3,
	looks: { base: 'day', bonus: 'day', super: 'super', epic: 'epic' },
	// prefetchGroups (2026-10-15, download analysis S3, Corey yes): the prefetch takes only these load groups of each look
	// (game/creatureLoad.ts GROUPS); the alternates (snarl, growl) load when the mode asks for the look, like any look.
	// Until a sheet is in its action is simply not played, so a feature that starts first shows no snarl / growl
	// until they land. Saves 6.6 MB desktop / 3.7 MB phone per session.
	lookLoad: { prefetch: true, prefetchLooks: ['super', 'epic'], prefetchGroups: ['creatureIdle', 'creatureActs'], early: true, waitMs: 250 },
	/** HIS PLACE IN THE LOAD (first-minute plan D, Corey 2026-10-16 17:21 "Yes D"; until then CREATURE.deferredAfter put
	 *  his idle sheet straight after the plaque and his attacks behind the symbols' sheets). Now:
	 *    - his STILL (idle frame 1 of the base look and its shadow, tools/build_creature_still.py, 45 KB / 25 KB) is in the
	 *      FIRST download (game/assets.ts creatureStill): he stands in the courtyard from the game's first frame
	 *      (game/creature.ts setStill) and starts breathing, from that same picture and with no fade, when his idle sheet
	 *      lands. A round resumed in a Super or Epic has no still of its look: he appears as before, when its sheet lands.
	 *    - the win plaque and the symbols' sheets are the GATE (LOAD_GATE): PRESS ANYWHERE waits for them
	 *    - after the gate (game/deferredLoad.ts): his idle sheet, then his attacks, then the scene's night set, the night
	 *      frame, the flames, the labels, then his alternates, then the shared loader's remainder and the Armoury.
	 *  restHeldAfter: the group of the boot look after which the rest of it is HELD until game/deferredLoad.ts lets it go
	 *  (DEV `?creaturehold=1` holds after his idle group instead, so a probe can ask for an attack with only it in). */
	restHeldAfter: 'creatureActs' as 'creatureIdle' | 'creatureActs',
	/** the look his still is of (the base look: a fresh session always starts in it) */
	stillLook: 'day' as const,
	lookFadeMs: SCENE.crossfadeMs,
	landingFadeMs: 400,
	landingFadeStepMs: 34,
	holdMs: 150,
	rushMs: 100,
	rushFreeFrames: 3,
	strikeLead: true,
	sting: {
		normalHitMs: STING.hitAt * STING.normalMs,
		scatterHitMs: STING.hitAt * SCATTER_STING.hitMs,
		scatterHoldMs: SCATTER_STING.holdMs,
		chargeMs: STING.chargeMs,
		superChargeMs: STING.superChargeMs,
	},
	recrouch: { strikeFromFrame: 5 },
	crouchUpFrame: 13,
	glow: { strength: 1, fadeMs: 100 },
	glowPhase: true,
	glowAim: { maxRate: 0.12, minFrames: 12 },
	poke: {
		on: true,
		clips: ['snarl', 'growl'] as const,
		cooldownMs: 600,
		rollQuietMs: 5400,
		area: [-60, -485, 60, -485, 160, -420, 240, -335, 295, -250, 305, -150, 320, 25, 110, 30, 80, -70, -140, -70, -160, 30, -335, 25, -315, -150, -300, -260, -245, -350, -160, -425],
	},
	snarlOdds: 1 / 20,
	growlOdds: 1 / 30,
	breath: true,
	voice: { rateMin: 0.95, rateMax: 1.05 },
	shadowAlpha: 1,
	beatWaitMs: 300,
	crouchTimeoutMs: 3000,
	cueBiasMs: 34,
	cueBeatBiasMs: 17,
} as const;
/** which of CREATURE.place a layout takes */
export type CreatureSpot = keyof typeof CREATURE.place;

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
// THE SIXTH (Corey 2026-10-11): the house ladder is five sounds, each the first a whole tone up. An Epic
// lands six scatters in a spin (one per column, on the reveal or stung in), so the sixth landing has its
// own sound, the first at +10 semitones (tools/build_audiosprite.py MM_EVENTS). Until then the sixth
// landing replayed the fifth. THE 8 SCATTER EPIC (math 2026.10.13, Corey's decision): a feature never
// triggers on 7, and 8 (one in every column) is only ever an Epic's forced first board, on the reveal or
// with 5 or 6 of them stung in; its 7th and 8th landings replay the sixth (Math.min below), no new sound.
export const SCATTER_LAND_SOUND_MAP = {
	1: 'sfx_scatter_land_1',
	2: 'sfx_scatter_land_2',
	3: 'sfx_scatter_land_3',
	4: 'sfx_scatter_land_4',
	5: 'sfx_scatter_land_5',
	6: 'sfx_scatter_land_6',
} as const;
/** the last rung of the scatter landing ladder */
export const SCATTER_LAND_SOUNDS = 6;

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

// ---- THE MAX WIN SCREEN (Corey 2026-10-15 18:10; Stake approval review 2026-10-15, Major 2) ------------
// components/MaxWinCinematic.svelte, game/maxWin.svelte.ts, game/medallionRain.ts. Modelled on the one
// Angry Mantis ships: ONE beat scored by bgm_maxwin, played ONCE (loop: false, the manifest says loop), every stage an
// offset in ms from the instant the MAX tier lands on the plaque's count, which is also the instant the track starts.
// THE TRACK, MEASURED (bgm_maxwin.ogg, 30.000 s; RMS per 0.25 s and per band, ffmpeg + python, 2026-10-15):
//   0 to 0.75 s   the attack (-50 to -22 dB); full from 1.0 s (-13.8 dB, the downbeat)
//   1 to 10 s     a steady body, -14 to -17 dB; the top band (over 3 kHz) about -33 dB
//   10.25 s       THE SWELL: the body rises to -13.3 dB at 10.25 s and the top band 6 dB (-30.9 dB at 10 s, -26.6 at
//                 11 s), and stays that bright to the fade
//   26.0 s        the fade starts (-15 dB at 26.0, -19 at 26.25, -26 at 27.0, -41 at 28.0, -59 at 29.0, -85 at 29.75)
//   30.0 s        the end ('ended' is what opens the gate)
// NOTHING here is divided by timeScale(): turbo never outruns the music (the plaque's count before it is turbo's).
export const MAX_WIN = {
	/** the MAX plaque holds its landing this long (its 3 s tier clip plays out), then the deep dim */
	dimAt: 3000,
	/** the dim's alpha over the board, the plaque and the canvas logo (the HTML HUD goes by uiHide { deep }) */
	dimAlpha: 0.88,
	dimFadeMs: 700,
	/** the screen leaving after the gate: the dim, the rain and the titles fade together, then he goes back down */
	outFadeMs: 500,
	/** the roar where he stands, with the dim (his clip, sfx_roar) */
	roarAt: 3000,
	/** MAYHEM UNLEASHED slams in: the roar's mouth is open by then (roar clip f18 of 53 at 30 fps) */
	unleashedAt: 3600,
	/** UNLEASHED lands this long after MAYHEM */
	unleashedStaggerMs: 140,
	/** MAX WIN slams on the track's swell; MAYHEM UNLEASHED recedes behind it */
	slamAt: 10250,
	/** the slam: a title punches in from slamFrom x its size to 1 over slamMs (an overshoot ease), alpha in over slamFadeMs */
	slamMs: 340,
	slamFrom: 1.7,
	slamFadeMs: 160,
	/** the halo flares to this x its strength on the landing and settles over glowSettleMs */
	glowFlare: 1.8,
	glowSettleMs: 900,
	/** the payout and the multiple fade in under MAX WIN this long after its slam */
	amountAt: 260,
	amountFadeMs: 320,
	recedeMs: 520,
	/** MAYHEM UNLEASHED's alpha once receded */
	recedeAlpha: 0.9,
	/** bgm_maxwin's length (music.json duration). Only the FALLBACK timer uses it: a real 'ended' always wins */
	trackMs: 30000,
	/** added to trackMs for the fallback gate (a muted or blocked audio context never delivers 'ended') */
	gatePad: 500,
	/** after the gate arms the screen also moves on by itself (Angry Mantis; a press just gets there sooner) */
	autoAdvanceMs: 3000,
	/** the sound of each slam: the plaque's own landing thump (STINGER_PLAQUE's impacts) */
	slamSound: 'sfx_plaque_land',
	/** Title and amount slots per LayoutKind, in that kind's MASTER px from its centre: `*Cap` are cap heights,
	 *  `*Width` shrink-to-fit caps, `x` / `*Y` fractions of the master width / height. `mayhem*` / `unleashed*` are the
	 *  two lines of MAYHEM UNLEASHED; `recede*` where that pair sits (its centre) and its scale once MAX WIN is on it. */
	layout: {
		landscape: {
			x: 0.46,
			lineCap: 92, lineWidth: 1040, mayhemY: 0.36, unleashedY: 0.53,
			recedeScale: 0.48, recedeY: 0.15,
			maxCap: 104, maxWidth: 1060, maxY: 0.47,
			amountCap: 62, amountWidth: 900, amountY: 0.66,
			multCap: 34, multWidth: 420, multY: 0.77,
		},
		phone: {
			x: 0.47,
			lineCap: 100, lineWidth: 1140, mayhemY: 0.36, unleashedY: 0.54,
			recedeScale: 0.48, recedeY: 0.15,
			maxCap: 112, maxWidth: 1160, maxY: 0.47,
			amountCap: 66, amountWidth: 980, amountY: 0.67,
			multCap: 36, multWidth: 460, multY: 0.78,
		},
		portrait: {
			x: 0.5,
			lineCap: 46, lineWidth: 380, mayhemY: 0.43, unleashedY: 0.52,
			recedeScale: 0.55, recedeY: 0.1,
			maxCap: 52, maxWidth: 384, maxY: 0.5,
			amountCap: 32, amountWidth: 372, amountY: 0.6,
			multCap: 20, multWidth: 220, multY: 0.67,
		},
	},
	/** THE WILD MEDALLION RAIN (game/medallionRain.ts): the Wild's static tile (`W.png` in the mmSymbols
	 *  atlas) falling and turning over like thrown coins behind the creature and the titles. One pooled container,
	 *  every sprite made up front, moved by ONE ticker callback; density = how many of the pool are live. */
	rain: {
		texture: 'W.png',
		/** pool size per LayoutKind (portrait fewer: a phone must stay readable) */
		count: { landscape: 46, phone: 52, portrait: 24 },
		/** drawn width as a fraction of the master width */
		size: { landscape: [0.035, 0.085], phone: [0.035, 0.085], portrait: [0.08, 0.17] },
		/** fall speed in master px per second at the largest size (a small one is further away and slower) */
		speed: [220, 560],
		/** the coin turn (the width follows cos of it) in turns per second, and a slower roll in radians per second */
		flip: [0.35, 1.3],
		roll: [-0.9, 0.9],
		/** a far (small) medallion is dimmer: alpha from alpha[0] at the smallest to alpha[1] at the largest */
		alpha: [0.42, 0.92],
		/** ms from track start: sparse with the dim, building to a downpour on the MAX WIN slam, held through the
		 *  track's body, thinning with its fade so the screen is clear as the music ends */
		sparseAt: 3000,
		downpourAt: 10250,
		holdUntil: 26000,
		emptyAt: 28000,
		/** and the whole rain fades with the music's own tail (the ones still falling go with it) */
		fadeFrom: 27000,
		fadeTo: 29500,
		/** the narrowest a turning medallion gets, as a share of its width (edge on it read as a dark scratch) */
		minTurn: 0.16,
		sparseShare: 0.18,
		fullShare: 1,
	},
} as const;

// THE LOADING GATE (first-minute plan D, Corey 2026-10-16 17:21 "Yes D"; measurements and the options in
// ~/Desktop/Manticore Mayhem/feedback/firstminute_r1/REPORT.md, the result in firstminute_r2/). Until then PRESS ANYWHERE
// waited for the audio alone and every deferred file started after it: a reviewer who pressed at once spun on a FROZEN
// board (no symbol sheet in) in an empty courtyard, for 24 s on desktop fast 4G and the whole first minute on slow 4G.
// Now PRESS ANYWHERE (ui/LandingScreen.svelte) waits for the audio AND the gate: the win plaque's set and the symbols'
// drop and idle sheets (game/assets.ts GATE_ORDER, loaded by game/deferredLoad.ts loadGate), which start the moment the
// audio is in (besideAudioFiles below: the plan said beside the audio, which measured worse), and the loading bar
// counts them with the audio. But never more than capMs after the audio is ready: past the cap PRESS shows and the rest of
// the gate lands behind the game as before.
//   capMs        the cap, real ms after the audio is ready (the plan's 10 s: desktop fast 4G about +10 s to the first spin,
//                phone fast 4G about +5 s, slow 4G +10 s either way)
//   scatter      the scatter's two sheets (3.3 MB full tier, 0.85 MB phone tier) are in the gate. false = the plan's
//                cheaper variant (they load straight after the gate instead)
//   besideAudioFiles   how many of the gate's files may be on the wire at once WHILE THE AUDIO IS STILL LOADING (all of a
//                group's once it is in). 0: none, the gate starts the moment the audio is in. MEASURED 2026-10-16
//                (firstminute_r2, production build, Chrome's throttles): with 1 the link shares itself between the audio and
//                the gate's file, the audio is ready later (desktop slow 4G 61.4 s instead of 54.3) and so is the cap counted
//                from it: PRESS ANYWHERE at 71.7 s (+17.4 s) against 64.7 s (+10.4 s, the plan's number) with 0; desktop fast
//                4G 21.9 against 21.1 s, phone fast 4G 13.7 against 14.4 s, phone slow 4G 56.2 against 51.0 s. Starting
//                beside the audio buys nothing on a link the download fills, and costs the audio its share of it.
//   musicSideTracks   the four other music tracks are not buffered ahead beside the gate's files (game/sound.ts): when
//                the gate was capped they stream when first played instead
//   sceneBesideAttacks   AFTER THE GATE (game/deferredLoad.ts): his idle sheet alone first, then his attacks BESIDE the
//                scene's night set, night frame, flames and labels (true), or strictly before them (false). His sheets
//                go one at a time, each decoded and uploaded before the next is asked for, so the link idles between
//                them; the scene's files fill those gaps. Nothing after the gate can delay the gate. Measured (desktop
//                fast 4G): his attacks and the scene's groups, 10.8 MB, went at 0.83 MB/s side by side, 0.68 MB/s one
//                after the other.
// NO CAP (Corey 2026-10-17 08:19 / 08:21: "We should just wait to show until everything is loaded for the first spin",
// then "Yes that's what I meant" to removing the 10 s cap): capMs null = PRESS ANYWHERE waits for the whole gate. The
// only way past it unsettled is stallMs: no gate file landing (done or failed) for that long, so a request that never
// answers cannot keep the game from starting.
export const LOAD_GATE = {
	capMs: null as number | null,
	/** real ms with no gate file landing after which PRESS shows anyway (a hung request), counted from the audio */
	stallMs: 90_000,
	scatter: true,
	besideAudioFiles: 0,
	musicSideTracks: 'afterGate' as 'afterGate' | 'asBefore',
	sceneBesideAttacks: true,
} as const;

// THE IN-GAME PRESS ANYWHERE TO CONTINUE (fonts r2, Corey 2026-10-17 14:01, option 1): Cinzel 700, the display face, in
// the landing screen's PRESS ANYWHERE colour and tracking (ui/LandingScreen.svelte .pressText: #eef0e6, 0.05em, text
// shadow 0 2px 4px rgba(0, 0, 0, 0.7) at its 18 px desktop size, here in ems of the font). It keeps the old line's slot,
// cap height, centring and maxWidth fit (components/PressToContinue.svelte), its blink and, over the board, its veil and
// its hard drop shadow. Drawn once into a texture (game/pressPrompt.ts, components/PressPromptText.svelte).
export const PRESS_PROMPT = {
	/** the words, the same on every site (social included) */
	text: 'PRESS ANYWHERE TO CONTINUE',
	family: 'Cinzel',
	weight: 700,
	/** what document.fonts.load waits on before the line is ever drawn */
	fontCheck: '700 32px Cinzel',
	/** the landing's letter spacing, in ems */
	trackEm: 0.05,
	/** the letters' colour (the texture is white, the sprite is tinted): the landing's #eef0e6 */
	ink: 0xeef0e6,
	/** the landing's soft text shadow, baked into the texture: 2 px down and a 4 px blur at 18 px, 70 % black */
	soft: { dyEm: 2 / 18, blurEm: 4 / 18, color: 'rgba(0, 0, 0, 0.7)' },
	/** the texture's clear margin: this many blurs plus this share of the font size, for the shadow and the overhang */
	padBlurs: 1.5,
	padEm: 0.08,
	/** the size the face is measured at (its cap height and the line's width per font size) */
	measurePx: 100,
	/** the texture's largest side in px */
	texMax: 4096,
	/** how many sizes stay cached with nobody showing them (the desktop's over the board line and the max win's) */
	keep: 2,
} as const;
