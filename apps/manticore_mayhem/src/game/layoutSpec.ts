// Design master coordinates. Both the PixiJS scene (MainContainer) and the HTML chrome (FitFrame)
// are authored in these units and scaled uniformly to the viewport, so a coordinate here lands on
// the same pixel in both layers.
//
// Manticore's board is 8x8 and SQUARE, which is the one structural difference from Angry Mantis's
// 5x4: every LayoutKind has to find room for a square, and the landscape/phone masters keep a
// column clear on the RIGHT for the manticore (spec F: right of the board in landscape and
// phone-sideways, mirrored from the render so it faces the board; portrait hides it).
import { SYMBOL_SIZE, GRID } from './constants';
import { BOARD_ART } from './boardArtSpec';
import { PORTRAIT_BOARD, PORTRAIT_BOARD_VARIANTS } from './boardSizeVariant';
import { BOARD_PLAQUE_SPEC } from './boardPlaqueSpec';

export type LayoutKind = 'landscape' | 'portrait' | 'phone';

export const MASTER: Record<LayoutKind, { width: number; height: number }> = {
	landscape: { width: 1280, height: 720 },
	portrait: { width: 412, height: 760 },
	// Phone held sideways (layoutType 'landscape': ratio >= 1.3 AND device width <= 480).
	phone: { width: 1480, height: 740 },
};

// ---- THE DESKTOP BOARD SIZE (2026-10-16; Stake's review of the first submission, 5.3 / 9: "Small grid") ----------------
// The landscape master's cell area was 425.18 (59 % of a 16:9 screen's height). The board_size_r1 mockups put a 538
// board next to it (75 % of a 16:9 height) and an 80 % one; Corey picked 75 % ("I actually like the 80% more but it
// covers too much of the sky"). This is that board, 524 of cell area (72.8 % of a 16:9 height; on a 1920 x 1080 screen
// a cell is 98.8 CSS px, was 80.2):
//   BOTTOM  the bronze spin amount plaque hangs under the board, right over the HUD's WIN readout (its labels start at
//           y 660: ui/ChromeLandscape.svelte). The board keeps the 75 % mockup's bottom: the plaque's drawn bottom at
//           654.8 (its sprite box 659.1), cells' top + 1.14888 x the cell area. So the board grew UP.
//   TOP     on a 16:9 screen the master IS the screen, and at 538 the top rail's spikes and the corner finials were
//           above the screen edge and the gears cut. At 524 the whole top rail, its gears and its spikes are on a 16:9
//           screen (the spike tips 5.2 under the edge) and only the four corner finials go over it; on 16:10 (the
//           master fitted by width, 40 master units of canvas above it) the whole art is on the screen, finials and
//           all (art top -37.8). The 538 board, 2.6 % bigger, cut the gears at 16:9 and the finial tips at 16:10
//           (feedback/board_75_final/finials_*.png: the options side by side).
// The frame art, its chains, the cells, the plaque and everything registered to them scale together about the cell
// area's centre line (x 640.27, as before). tools/build_board_layers.py still prints the k 1 rect (its frameRects):
// this one is that rect x 1.23242 (landscapeFrame below).
export const LANDSCAPE_BOARD = {
	/** the cell area's side (8 cells + 7 gaps), master units */
	cellArea: 524,
	/** the cell area's top edge, master units */
	cellTop: 57.1,
	/** the board_v5l fit at k 1 (the frame rect the tool prints) */
	k1: { x: 416.451, y: 103.76, width: 447.641, height: 447.641, inset: 11.23, cell: 51.115, gap: 2.323, margin: 4.647 },
};

/** the landscape frame rect: LANDSCAPE_BOARD.k1, every dimension x k (k = cellArea / the k 1 cell area, 1.23242) about
 *  the cell area's centre line, the cell area's top at cellTop. Gives x 364.431, y 43.26, width 551.68, inset 13.84,
 *  cell 62.995, gap 2.863 (pitch 65.858), cells x 378.27..902.27, y 57.1..581.1. */
const landscapeFrame = (cellArea: number = LANDSCAPE_BOARD.cellArea, cellTop: number = LANDSCAPE_BOARD.cellTop) => {
	const b = LANDSCAPE_BOARD.k1;
	const k = cellArea / (b.width - 2 * b.inset);
	const cx = b.x + b.width / 2;
	const width = b.width * k;
	return { x: cx - width / 2, y: cellTop - b.inset * k, width, height: width, inset: b.inset * k, cell: b.cell * k, gap: b.gap * k, margin: b.margin * k };
};

// ---- THE TALLER DESKTOP SCREENS (layout_1610_r1; the harsh re-review of 2026-10-17: the board was 72.8 % of the height
// on every 16:9 screen but 65.5 % at 1440 x 900; Corey 2026-10-17 20:27: "We should do this for widescreen") ----------
// On a desktop screen narrower than 16:9 (16:10 laptops, 3:2) the master is fitted by WIDTH, so the screen shows `extra`
// master units of canvas above the master and as many below it (40 each at 16:10, 66.7 at 3:2). There the board takes
// the 16:9 board's share of the height the screen shows, and the HUD's bottom row (BALANCE / WIN / SPIN and both button
// clusters) rides down by `extra` to the screen's bottom edge (ui/Chrome.svelte --vp-extra-bottom), so everything under
// the board keeps its 16:9 place against that edge:
//   cell area  LANDSCAPE_BOARD.cellArea x (720 + 2 extra) / 720: 582.2 at 16:10 (72.8 %, a cell 73.7 -> 81.9 CSS px at
//              1440 x 900), 621.0 at 3:2
//   bottom     the spin amount plaque's sprite box (cells' top + plaqueK x the cell area) ends `extra` lower than the 16:9
//              board's (659.1), over the WIN readout that rode down by the same: the board grows UP from there
//   top        then the top rail's spike tips are 12.5 master units under the screen's top edge at 16:10 and 17.5 at 3:2
//              (16:9: 5.2), and only the four corner finials go over that edge, as on every 16:9 screen
//   sideways   the board scales about the cell area's centre line (x 640.27) as before: at 16:10 the art spans x 230.3 ..
//              1050.3; the logo's box follows its post (constants LOGO.landscapeTall), the readout row stays inside
//              TRIO_CLEAR, the creature's 16:10 spot (CREATURE.desktopTall) was set again for it
//   HUD top    the clock strip rides UP by `extra` to the screen's top edge (ui/ClockStrip.svelte --vp-extra-top) and the
//              logo's box with it: at 3:2 the bigger board's top left gear stands where the strip was. The SKIP button
//              keeps its place (it is right of the art at every shape)
// The growth stops at `minAspect` (3:2): a narrower desktop screen (4:3) keeps the 3:2 layout and the rest of its height
// stays letterbox. 16:9 and wider: extra 0, frameFor returns FRAME.landscape itself, so nothing there moves.
export const LANDSCAPE_TALL = {
	/** the screen shape (width / height) the growth stops at */
	minAspect: 1.5,
	/** the spin amount plaque's sprite box bottom, as a multiple of the cell area under the cells' top (57.1 + 1.14888 x
	 *  524 = 659.1 on the 16:9 board) */
	plaqueK: 1.14888,
	/** less letterbox than this (master units, under a CSS px on any desktop) counts as none: a 16:9 screen whose height
	 *  over the fit's scale comes out a hair over 720 keeps the 16:9 layout exactly */
	minExtra: 0.5,
};

/** the live landscape (desktop) viewport: the master height the screen shows (720 plus the letterbox above and below).
 *  game/stateLayout.ts sets the source, which gives 720 whenever the layout is not the desktop one, so this is 0 on a
 *  phone, a tablet and a portrait screen; without a source (node tools) it is 0 as well. */
let landscapeViewport: (() => number) | null = null;
export const setLandscapeViewportSource = (source: () => number) => {
	landscapeViewport = source;
};

/** the master units of canvas the desktop screen shows above the master and as many below it, as far as the board uses
 *  them (LANDSCAPE_TALL): 0 at 16:9 and wider, 40 at 16:10, 66.7 at 3:2 and held there below 3:2. Reactive (a $derived
 *  or $effect that calls it follows a resize). */
export const landscapeExtraY = (masterHeight: number | null = landscapeViewport?.() ?? null) => {
	if (masterHeight === null) return 0;
	const M = MASTER.landscape;
	const most = (M.width / LANDSCAPE_TALL.minAspect - M.height) / 2;
	const extra = Math.min((masterHeight - M.height) / 2, most);
	return extra < LANDSCAPE_TALL.minExtra ? 0 : extra;
};

/** the landscape frame rect for a desktop screen that shows `extra` master units above and below the master
 *  (LANDSCAPE_TALL); extra 0 is FRAME.landscape itself */
const landscapeTallFrame = (extra: number) => {
	if (extra <= 0) return FRAME.landscape;
	const B = LANDSCAPE_BOARD;
	const H = MASTER.landscape.height;
	const cellArea = (B.cellArea * (H + 2 * extra)) / H;
	const plaqueBottom = B.cellTop + LANDSCAPE_TALL.plaqueK * B.cellArea + extra;
	return landscapeFrame(cellArea, plaqueBottom - LANDSCAPE_TALL.plaqueK * cellArea);
};

// Board frame geometry. inset = the distance from the frame edge to the first cell; the 8x8 cell
// area is `width - 2*inset` square by construction.
export const FRAME: Record<
	LayoutKind,
	{ x: number; y: number; width: number; height: number; inset: number; cell: number; gap: number; margin: number }
> = {
	// DERIVED FROM THE FRAME ART (Corey 2026-10-06, tools/build_board_layers.py prints these as
	// frameRects): the whole art, finials to plinth with both posts and chains, spans x 340..940 from
	// y 38 (bottom 609.24, clear of the BALANCE / WIN / SPIN row), CENTRED on the 1280 master (Corey
	// 2026-10-07: it was 300..900, 300 left / 380 right). The chrome keys that row from the art's edges,
	// so the row moves with it (more room from the bottom-left buttons); the art reaches 40 px into the
	// manticore column (MANTICORE.landscape, not drawn yet: accepted). The cells are the art's lattice
	// at that scale: 425.18 of cell area + 2 x 11.23 inset (board_v4h / v4i, 2026-10-07: the top raised so the
	// opening is SQUARE and the lattice uniform both ways; the art is taller, bottom 609.24, was 587.2 with
	// v4g's 425.03 and 402.63 with v4f).
	// board_v5j (2026-10-11): THE CELLS DID NOT MOVE. Its art box is 3 render px narrower on the left, 1 on the
	// right and 121 shorter at the bottom (no plinth stones), so at the same scale and origin (the tool's FIT_ART)
	// the art now spans x 340.92..939.69 (centre 640.31) from y 38 to 572.22, and the readout row keyed to its
	// edges is 0.92 narrower on the left and 0.31 on the right.
	// 2026-10-16 (LANDSCAPE_BOARD above): this fit x 1.23242, the cells 378.27..902.27 x 57.1..581.1, the art x
	// 271.34..1009.28 from y -37.78 to 620.59 (the plaque under it). It was the k 1 rect, LANDSCAPE_BOARD.k1.
	landscape: landscapeFrame(),
	// CHAIN-FIT (Corey 2026-10-06 21:32: portrait was too small): each chain's centreline 10 master px
	// inside the screen edge (x 10 and 402), the posts and finials overhang off screen (art x -17.9 ..
	// 429.5); vertically the dead band between the tagline (150) and the BALANCE / BET row (688) is split
	// 1 : 1.3 above / below the art (art y 198.77 .. 624.6, board_v4h: the taller square-opening art; was
	// 205.85 .. 615.4 with v4g). 316.95 of cell area + 2 x 10.135, cells 37.2 (pitch 39.96, as v4g; 300.24 /
	// 37.86 with v4f). frameFor() grows it on wide portrait viewports the same way (PORTRAIT_FIT).
	// board_v5j (2026-10-11): the art is 121 render px (27.60 master) shorter at the bottom (no plinth stones).
	// THE RULE NOW (Corey 2026-10-11, on the portrait before / after: "Portrait Board position I'd go lower, set the
	// base of the new to same bottom as the base of the old"): THE ART'S BOTTOM EDGE SITS WHERE board_v4l's SAT, at
	// every growth k. The 1 : 1.3 split is still made, but on v4l's art box (PORTRAIT_FIT.baseRows), and this art
	// hangs from that box's bottom edge: art y 226.37..624.60 at k 1 (v4l 198.77..624.60), gap above 76.37, below
	// 63.40 as v4l. The frame rect's y is 273.625 (v4l 246.027 + the 27.598 the art lost; the plain split on the v5j
	// box, tried first the same day, gave 258.026 and art y 210.77..609.00). Size, x and the cells' pitch are v4l's.
	portrait: { x: 37.389, y: 273.625, width: 337.222, height: 337.222, inset: 10.135, cell: 37.207, gap: 2.756, margin: 4.607 },
	// 632.5 of cells + 2x16 = 664.5 square, centred on the master so the chrome's 340-wide side
	// columns stay clear; the manticore stands in the right one. Approved as is (Corey 2026-10-06):
	// here the art is registered TO these cells, so it overhangs the master top and bottom (board_v4h: art y
	// -66.53 .. 783.24 of the 740 master, 66.5 over the top and 43.2 under the bottom). board_v5j (2026-10-11):
	// the cells as before; the shorter art ends at y 728.17, so its bottom edge is now ON the screen, 11.8
	// above the master's bottom edge (art x 294.68..1185.42).
	phone: { x: 407.75, y: 32, width: 664.5, height: 664.5, inset: 16, cell: 76, gap: 3.5, margin: 7 },
};

/** the manticore's stage slot (spec F). Milestone 1 draws nothing here — the space is reserved and
 *  `faceLeft` records that the render is mirrored so the beast faces the board. */
export const MANTICORE: Record<LayoutKind, { x: number; y: number; size: number; faceLeft: boolean; hidden?: boolean }> = {
	landscape: { x: 1080, y: 380, size: 430, faceLeft: true },
	phone: { x: 1300, y: 390, size: 380, faceLeft: true },
	// portrait: hidden in milestone 1 (Corey 2026-09-20: above the board or hidden)
	portrait: { x: 206, y: 96, size: 220, faceLeft: true, hidden: true },
};

/** the portrait chain-fit (tools/build_board_layers.py CHAIN_FIT, keep the two in step): the chain
 *  centrelines `chainInset` inside the viewport edges, the dead band between the tagline (`bandTop`) and
 *  the BALANCE / BET row's top (`hudTop`, measured in the running game, pinned to the real viewport
 *  bottom) split 1 : `gapRatio` above / below the BASE BOX, growth capped at `maxK` (height budget).
 *  `baseRows` = the render rows (top, bottom) of board_v4l's art, finials to the plinth's base: the split is
 *  made on that box and the art's bottom edge is put on that box's bottom edge (Corey 2026-10-11: "set the
 *  base of the new to same bottom as the base of the old"). board_v5j's art ends at row 1792, so it stands
 *  121 render px lower than the plain split would put its top. An art whose rows are baseRows gets the plain split. */
export const PORTRAIT_FIT = { chainInset: 10, bandTop: 150, hudTop: 688, gapRatio: 1.3, maxK: 1.12, baseRows: [46, 1913] };

/** THE PHONE'S BIGGER BOARD (game/boardSizeVariant.ts, Corey 2026-10-16): the growth past the shipped rule goes down as
 *  far as the gap from the spin amount plaque's bottom to the BALANCE / SPIN row allows: that gap never closes below
 *  today's on that phone or `minHudGapCss` CSS px, whichever is smaller. The rest goes up.
 *  `hudRowTop`: the row's top (the BALANCE label) in the scene's master px with no letterbox (ui/ChromePortrait.svelte
 *  .stats: bottom 100 of the 760, 37.55 tall); it rides down with the letterbox under the master (Chrome.svelte
 *  --vp-extra-bottom). Measured: 546.3 CSS px at 375 x 667 (622.47), 713.8 at 390 x 844 (688.25 = 622.44 + 65.81).
 *  PORTRAIT_FIT.hudTop (688) is the same row on a 390 x 844 phone. */
export const PORTRAIT_GROW = { minHudGapCss: 24, hudRowTop: 622.45 };

/** the live portrait viewport: the master height the screen shows (the 760 master plus the letterbox the HUD rides
 *  down into), CSS px per master px, and whether the screen is a phone (isPhoneSizeType). game/stateLayout.ts sets the
 *  source once; frameFor reads it on every call, so a $derived that calls frameFor follows a height-only resize too.
 *  Without a source (node tools) frameFor is the shipped tablet rule. */
export type PortraitViewport = { masterHeight: number; cssPerMaster: number; phone: boolean };
let portraitViewport: (() => PortraitViewport) | null = null;
export const setPortraitViewportSource = (source: () => PortraitViewport) => {
	portraitViewport = source;
};
/** the live portrait viewport now (null without a source: node tools) */
export const portraitViewportNow = (): PortraitViewport | null => portraitViewport?.() ?? null;

/** the shipped growth k on a portrait viewport this wide (master units): the chain centrelines chainInset inside its
 *  edges, 1 .. maxK. Above 1 the spin amount plaque uses its tablet numbers (components/BoardPlaque.svelte), whatever
 *  the bigger phone board does, so every screen keeps the plaque it had. */
export const portraitShippedK = (viewportMasterWidth: number) =>
	Math.min(Math.max((viewportMasterWidth - PORTRAIT_FIT.chainInset * 2) / chainSpanOf(FRAME.portrait), 1), PORTRAIT_FIT.maxK);

/** render px from the frame art's bottom edge (BOARD_ART.art) down to the spin amount plaque's bottom edge */
const plaqueBelowArtPx = (tablet: boolean) => {
	const box = BOARD_PLAQUE_SPEC.layouts[tablet ? 'portraitTablet' : 'portrait'].render.plaqueBox;
	return box[1] + box[3] - BOARD_ART.art[3];
};

// Portrait viewports WIDER than the 412x760 master (tablets, foldables: the fit is by height) would
// leave dead side space. frameFor() grows the portrait frame uniformly, every dimension x k about the
// master's centre line, until the chains sit chainInset inside the real viewport edges again (cap maxK),
// and re-places it vertically by the same rule as k 1: the 1 : gapRatio split on the base box (baseRows) grown by
// k, the art's bottom edge on that box's bottom edge. So at every k the art's bottom is where board_v4l's was at
// that k (624.60 at k 1, 653.48 at the 1.12 cap). The landscape frame follows the desktop screen's shape below 16:9
// (LANDSCAPE_TALL); the phone's passes through.
export const frameFor = (kind: LayoutKind, viewportMasterWidth?: number) => {
	const base = FRAME[kind];
	// the desktop board on a screen narrower than 16:9 (LANDSCAPE_TALL); FRAME.landscape itself at 16:9 and wider
	if (kind === 'landscape') return landscapeTallFrame(landscapeExtraY());
	if (kind !== 'portrait' || !viewportMasterWidth) return base;
	const P = PORTRAIT_FIT;
	// the shipped growth: the chain centrelines chainInset inside the viewport's edges
	const kShip = portraitShippedK(viewportMasterWidth);
	// THE PHONE'S BIGGER BOARD (game/boardSizeVariant.ts): on a phone the variant holds a point of the art at or outside
	// the chains' centrelines on the screen edges instead ('chainsHalf' ships); a tablet keeps the shipped rule
	const view = portraitViewport?.() ?? null;
	const V = view?.phone ? PORTRAIT_BOARD : PORTRAIT_BOARD_VARIANTS.current;
	const m0 = registrationOf(base).m;
	const k = V.edgeOut === null ? kShip : Math.min(Math.max(viewportMasterWidth / (chainSpanOf(base) - 2 * V.edgeOut * m0), kShip), V.maxK);
	if (k <= 1) return base;
	const art = artRectOf(base);
	const bottomAt = (kk: number) => {
		const baseHeight = (P.baseRows[1] - P.baseRows[0]) * m0 * kk;
		return P.bandTop + Math.max(P.hudTop - P.bandTop - baseHeight, 0) / (1 + P.gapRatio) + baseHeight;
	};
	// the shipped rule's bottom; the growth past it goes DOWN as far as the room over the BALANCE / SPIN row allows
	// (PORTRAIT_GROW), so the frame's top (and the creature behind it) stays put where the screen is tall enough
	let bottom = bottomAt(kShip);
	if (k > kShip && view) {
		const below = plaqueBelowArtPx(kShip > 1) * m0;
		const hudTop = PORTRAIT_GROW.hudRowTop + Math.max(0, (view.masterHeight - MASTER.portrait.height) / 2);
		const gapToday = hudTop - (bottom + below * kShip);
		const minGap = Math.min(gapToday, PORTRAIT_GROW.minHudGapCss / view.cssPerMaster);
		const down = gapToday - minGap - below * (k - kShip);
		bottom += Math.min(Math.max(down, 0), art.height * (k - kShip));
	}
	const top = bottom - art.height * k;
	const cx = MASTER.portrait.width / 2;
	return {
		...base,
		x: cx + (base.x - cx) * k,
		y: top + (base.y - art.y) * k,
		width: base.width * k,
		height: base.height * k,
		inset: base.inset * k,
		cell: base.cell * k,
		gap: base.gap * k,
		margin: base.margin * k,
	};
};

type FrameRect = (typeof FRAME)[LayoutKind];

/** THE ART REGISTRATION for a frame rect: the lattice's mid-height width (BOARD_ART.lattice, render px)
 *  spans the cell area (width - 2 inset) and its centre line is centred on it. m = master px per render
 *  px; map() takes a render px to master units. components/BoardFrame.svelte draws through this. */
export const registrationOf = (f: FrameRect) => {
	const L = BOARD_ART.lattice;
	const size = f.width - 2 * f.inset;
	const m = size / (L.x1 - L.x0);
	const cellX = f.x + f.inset;
	const cellY = f.y + f.inset;
	const latH = (L.y1 - L.y0) * m;
	const oy = cellY + (size - latH) / 2;
	return {
		m,
		cell: { x: cellX, y: cellY, size },
		lattice: { x: cellX, y: oy, width: size, height: latH },
		mismatch: size - latH,
		map: (u: number, v: number) => ({ x: cellX + (u - L.x0) * m, y: oy + (v - L.y0) * m }),
	};
};

/** the distance between the two chain centrelines (mean of each run's top pivot and bottom anchor) */
const chainSpanOf = (f: FrameRect) => {
	const r = registrationOf(f);
	const a = BOARD_ART.anchors;
	const mid = (s: 'L' | 'R') => r.map((a[s].top[0] + a[s].bottom[0]) / 2, 0).x;
	return mid('R') - mid('L');
};

/** THE CLEAR SPAN BETWEEN THE CHAINS in master units: the left chain strip's inner edge to the right one's
 *  (centreline +/- BOARD_ART.chains halfWidthPx). The win plaque's art runs exactly this wide on the desktop
 *  master (game/stinger/layout.ts), so it follows the board art and never covers a chain. */
export const chainClearSpan = (kind: LayoutKind, viewportMasterWidth?: number) => {
	const f = frameFor(kind, viewportMasterWidth);
	return chainSpanOf(f) - 2 * BOARD_ART.chains[kind].halfWidthPx * registrationOf(f).m;
};

/** THE PHONE HUD'S SIDE COLUMNS (phone held sideways): the HTML chrome keeps its logo, the BALANCE / WIN /
 *  SPIN stack and the button clusters inside a column this wide at each end of the 1480 master (FRAME.phone:
 *  "centred on the master so the chrome's 340-wide side columns stay clear"; ui/ChromePhone.svelte's widest
 *  pieces, the logo and the menu / autoplay buttons, end about 310 from the edge). */
export const PHONE_SIDE_COLUMN = 340;

/** THE SPAN CLEAR OF THE HTML HUD's side columns, in master units, or null where the HUD has no side columns
 *  over the board's band (desktop: the HUD is a row under the board; portrait: rows above and below). The win
 *  plaque's art stays inside it on a phone held sideways (game/stinger/layout.ts). */
export const hudClearSpan = (kind: LayoutKind): { x0: number; x1: number; width: number } | null => {
	if (kind !== 'phone') return null;
	const x0 = PHONE_SIDE_COLUMN;
	const x1 = MASTER.phone.width - PHONE_SIDE_COLUMN;
	return { x0, x1, width: x1 - x0 };
};

/** the frame ART's rectangle (frame + chains alpha bbox) in master units for a frame rect */
const artRectOf = (f: FrameRect) => {
	const r = registrationOf(f);
	const [u0, v0, u1, v1] = BOARD_ART.art;
	const a = r.map(u0, v0);
	const b = r.map(u1, v1);
	return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, right: b.x, bottom: b.y };
};

/** The board frame ART's rectangle in master units (finials to plinth, posts and chains included). The
 *  HTML chrome keys the BALANCE / WIN / SPIN row to its edges (ui/ChromeLandscape.svelte). */
export const frameArtRect = (kind: LayoutKind, viewportMasterWidth?: number) => artRectOf(frameFor(kind, viewportMasterWidth));

/** the PRESS ANYWHERE prompt's y in each layout's band UNDER the board (HUD.<kind>.pressToContinue before the desktop
 *  board grew, 2026-10-16). The max win screen keeps its prompt there (components/PressToContinue atHudBand): it hides
 *  the board, and its own lines run down to y 0.77 of the screen. Phone and portrait are the same as their HUD slot. */
export const HUD_BAND_PROMPT_Y: Record<LayoutKind, number> = { landscape: 672, portrait: 700, phone: 752 };

/** THE DESKTOP PROMPT'S ROW (was PROMPT_VEIL, 2026-10-16; the veil removed 2026-10-17, Corey 15:31 "on desktop does it
 *  really hold a tinted background over the board?", 15:32 "2. Yes, that's a great idea!"). The desktop's prompt is
 *  drawn on the board plaque now (components/BoardPlaque.svelte, constants PLAQUE_PROMPT). Only its FALLBACK (the
 *  plaque not ready yet, or Cinzel never loading: components/PressToContinue.svelte) is still drawn over the board, on
 *  this row (the bottom one), with no veil. */
export const PROMPT_BOARD_ROW = 7;
/** fonts r2 (2026-10-17): the Cinzel prompt is about 44 % wider than the old stencil line at the same cap height, and
 *  at the slot's own maxWidth (620) it ran 6 to 8 px past the bottom row onto the frame's posts. Over the board (the
 *  fallback only since the prompt went on the plaque) it is fitted to this share of that row's width as well (desktop
 *  only; 0.94 leaves about 16 px each side) */
export const PROMPT_IN_ROW = 0.94;

/** one board row's cells (the full cell area's width, one cell tall) in master units */
export const boardRowRect = (kind: LayoutKind, row: number, viewportMasterWidth?: number) => rowRectOf(frameFor(kind, viewportMasterWidth), row);
const rowRectOf = (f: FrameRect, row: number) => ({ x: f.x + f.inset, y: f.y + f.inset + row * (f.cell + f.gap), width: f.width - 2 * f.inset, height: f.cell });

/** how far a board row's centre is below where it is on the 16:9 desktop board (master units): 0 at 16:9 and wider and
 *  in every other layout; on a taller desktop screen the bigger board's (LANDSCAPE_TALL). What sits over a row (the
 *  desktop prompt's fallback, HUD.landscape.pressToContinue) moves by it. */
export const boardRowShift = (kind: LayoutKind, row: number) => {
	if (kind !== 'landscape' || landscapeExtraY() <= 0) return 0;
	const a = rowRectOf(frameFor('landscape'), row);
	const b = rowRectOf(FRAME.landscape, row);
	return a.y + a.height / 2 - (b.y + b.height / 2);
};

/** the landscape HUD's readout row (BALANCE / WIN / SPIN) is keyed to the frame art's edges, but never closer than this
 *  to the button clusters (master units): left = the [Bonus, Menu] cluster's right edge (66 + 148 = 214) + 20; right =
 *  the [Auto / Turbo, Spin] cluster's left edge (1042) - 16. The art (271.34 .. 1009.28) is inside both today, so the
 *  row is keyed to it at 16:9; the taller desktop screens' bigger board (LANDSCAPE_TALL) is held here. */
export const TRIO_CLEAR = { left: 234, right: 1026 };

/** the landscape readout row's span (ui/ChromeLandscape.svelte and THE ARMOURY's copy of it). On a desktop screen
 *  narrower than 16:9 the art is wider (LANDSCAPE_TALL: x 230.3 .. 1050.3 at 16:10) and the row is held to TRIO_CLEAR.
 *  `at169`: the 16:9 board's span whatever the screen (THE ARMOURY's copy, drawn in its own 16:9 desktop box). */
export const landscapeTrioSpan = (at169 = false) => {
	const a = at169 ? artRectOf(FRAME.landscape) : frameArtRect('landscape');
	const x0 = Math.max(a.x, TRIO_CLEAR.left);
	const x1 = Math.min(a.right, TRIO_CLEAR.right);
	return { x: x0, width: x1 - x0 };
};

/** the board's horizontal centre in master units. The landscape board is deliberately LEFT of the
 *  master centre (the manticore has the right column), so anything that belongs to the board —
 *  the mode plaque, the spin-win readout — has to centre on this and not on the master. */
export const boardCenterX = (kind: LayoutKind, viewportMasterWidth?: number) => {
	const f = frameFor(kind, viewportMasterWidth);
	return f.x + f.width / 2;
};

/** the cell area's vertical centre (the mode plaque overlays it) */
export const boardCenterY = (kind: LayoutKind, viewportMasterWidth?: number) => {
	const f = frameFor(kind, viewportMasterWidth);
	return f.y + f.height / 2;
};

/** the spin-win readout's centre y. Portrait: the middle of the band between the frame art's bottom and
 *  the BALANCE / BET row (the art moves with frameFor's growth; its bottom is board_v4l's at every k, so this
 *  is where it was with v4l: 656.3 at k 1, 670.74 at the 1.12 cap); the others use their HUD slot. */
export const spinWinY = (kind: LayoutKind, viewportMasterWidth?: number) => {
	if (kind !== 'portrait') return HUD[kind].spinWin.y;
	return (frameArtRect(kind, viewportMasterWidth).bottom + PORTRAIT_FIT.hudTop) / 2;
};

/** where the manticore stands for a given master (portrait derives nothing yet — see MANTICORE) */
export const manticoreFor = (kind: LayoutKind) => MANTICORE[kind];

// desktop -> the 1280x720 landscape master; phone-sideways -> the wide phone master.
export const layoutKind = (layoutType: 'desktop' | 'landscape' | 'portrait' | 'tablet'): LayoutKind => {
	if (layoutType === 'portrait' || layoutType === 'tablet') return 'portrait';
	return layoutType === 'landscape' ? 'phone' : 'landscape';
};

/** Where the Pixi board (GRID x GRID x SYMBOL_SIZE, unscaled) sits for a given master. */
export const boardPlacement = (kind: LayoutKind, viewportMasterWidth?: number) => {
	const f = frameFor(kind, viewportMasterWidth);
	const pitch = f.cell + f.gap;
	const inner = GRID * f.cell + (GRID - 1) * f.gap;
	return {
		x: f.x + f.width / 2,
		y: f.y + f.inset + inner / 2,
		scale: pitch / SYMBOL_SIZE,
		innerWidth: inner,
		innerHeight: inner,
		pitch,
	};
};

// HUD slots (master units) for the Pixi-side overlays.
//  · pressToContinue — the PRESS ANYWHERE prompt
//  · modePlaque      — the plain mode plaque over the board centre (feature start/end)
//  · spinWin         — the running spin total shown while a spin cascades
// (The SKIP button is HTML, over the canvas: SKIP below.)
export const HUD: Record<
	LayoutKind,
	{
		pressToContinue: { y: number; width: number; height: number };
		modePlaque: { y: number; height: number; width: number };
		spinWin: { y: number; height: number; width: number };
	}
> = {
	// THE MODE PLAQUE OVERLAYS THE BOARD CENTRE in every layout. There is no free band tall enough
	// for the plate under the board on any master (landscape has 37 master px between the board's
	// bottom edge and the readout row, phone has 60), and the board is static for the whole time
	// the plaque is up, so the centre is both the readable place and the only one that fits.
	landscape: {
		// the prompt's glyphs span y - 44 .. y - 24 (PressToContinue). Up to 2026-10-16 it sat in the free band between
		// the board's bottom edge (618) and the BALANCE / WIN / SPIN row (~655), at y 672 (it was y 700, 656 .. 676, on
		// top of the HTML HUD's WIN label: Corey 2026-10-09). The only prompts left are the feature intro and the wrap
		// up, where the SPIN readout is down.
		// 2026-10-16, THE BIGGER BOARD (LANDSCAPE_BOARD): that band is gone (the board's plaque fills it down to the WIN
		// readout), so the prompt is OVER THE BOARD, its glyphs centred on the bottom row (cells y 518.1 .. 581.1, centre
		// 549.6: glyphs 539.5 .. 559.7), under the feature intro and the wrap up (the win plaque's art ends about 475),
		// on that row veiled (PROMPT_VEIL) and with the hard drop shadow the board's readouts use. The max win screen
		// keeps 672 (HUD_BAND_PROMPT_Y). Was y 672 (glyphs 628 .. 648).
		// 2026-10-17 (Corey 15:32): the prompt is drawn ON THE BOARD PLAQUE instead (components/BoardPlaque.svelte,
		// constants PLAQUE_PROMPT) and the veil is gone. This slot is only the fallback's (PROMPT_BOARD_ROW).
		pressToContinue: { y: 583.7, width: 620, height: 48 },
		// the cell area's centre (57.1 + 524 / 2; was 327.6 with the k 1 board), the plain plate's slot
		modePlaque: { y: 319.1, height: 34, width: 380 },
		spinWin: { y: 640, height: 28, width: 400 },
	},
	portrait: {
		pressToContinue: { y: 700, width: 300, height: 44 },
		// the cell area's centre at k 1 (283.76 + 316.95 / 2, board_v5j with its base on v4l's, 2026-10-11; 256.16 +
		// 316.95 / 2 = 414.6 with v4h); ModePlaque uses boardCenterY (follows the growth)
		modePlaque: { y: 442.2, height: 28, width: 260 },
		// y at k 1: midway between the art bottom (624.6, the same with board_v5j as with v4h since 2026-10-11) and
		// the BALANCE / BET row (688); SpinWin uses spinWinY (follows the growth)
		spinWin: { y: 656.3, height: 26, width: 340 },
	},
	phone: {
		// The prompt sits in the HUD band UNDER the board (2026-10-15, approval review major 6): the strip from the
		// board's bottom (680) to the master's (740), where the spin amount plaque is, empty while a prompt is up
		// (feature intro, wrap up, max win wrap up). Its glyphs span y - 40.5 .. y - 22 = 711.5 .. 730. It was y 26,
		// above the board: the glyphs ran from -14.5 to 4, so only their lower half showed at 844 x 390. The plaque
		// OVERLAYS the board centre: below it there is no room for the plate, and the board is static whenever the
		// plaque is up.
		pressToContinue: { y: 752, width: 600, height: 44 },
		modePlaque: { y: 364, height: 34, width: 560 },
		spinWin: { y: 718, height: 24, width: 420 },
	},
};

// ---- THE SKIP BUTTON (components/SkipButton.svelte; HTML over the canvas, so nothing in the canvas covers it) ----
// Corey 2026-10-12 22:11 (corey_placement_2026-10-12_2211.txt): "like a half height Play Button with two arrows, like
// a fast forward button", top right in every view. It is the Play (spin) button's width and half its height, so it
// scales exactly as the HUD does. One rule per spot; `play` is that layout's Play button size in master px
// (ui/Chrome*.svelte: SquareSpin size).
//   landscape, phone   placed in the MASTER, like everything in those two chromes: x / y are its top left.
//                      As an offset from the Play button's top left: landscape +69.5, -570.9; phone +123.1, -525.3.
//   portrait           the portrait chrome spans the REAL viewport width and its Play cluster hangs from the right
//                      edge, so the button does too: `right` is the gap from the viewport's right edge to its own
//                      right edge, in master px. y is in the master, with the clock row and the logo (the Play
//                      button hangs from the viewport's bottom, so an offset from it would wander with the height).
//                      A portrait screen is a phone or a tablet by the layout system's size class, the creature's
//                      own test (isPhoneSizeType): the owner placed the two apart.
// The four reference screens come out at (CSS px, the owner's numbers in brackets): 1440 x 900 left 1317.9 top 89.0,
// 103.5 x 51.8 (1317.9, 89.0, 103.5 x 51.8); 844 x 390 774.1, 20.4, 61.1 x 30.6 (774.1, 20.4, 61.1 x 30.6);
// 390 x 844 310.5, 97.2, 73.8 x 36.9 (310.5, 97.2, 73.8 x 36.9); 768 x 1024 643.4, 51.3, 105.1 x 52.5 (643.4, 51.3,
// 105.1 x 52.5). tools/manticore/skip_probe.js holds them to 1 px.
export type SkipSpot = 'landscape' | 'phone' | 'portraitPhone' | 'portraitTablet';
export const SKIP: {
	slots: { landscape: { play: number; x: number; y: number }; phone: { play: number; x: number; y: number }; portraitPhone: { play: number; right: number; y: number }; portraitTablet: { play: number; right: number; y: number } };
	edgeCss: number;
	clockBottom: number;
} = {
	slots: {
		landscape: { play: 92, x: 1171.5, y: 39.1 },
		// (its right edge is 44 master px past the 1480 master: on a phone the master is fitted by height and the
		// screen is wider, so that is on the screen; where it is not, edgeCss below holds it in)
		phone: { play: 116, x: 1408.1, y: 38.7 },
		portraitPhone: { play: 78, right: 6, y: 36.9 },
		portraitTablet: { play: 78, right: 14.5, y: 38.1 },
	},
	/** never closer to a screen edge than this, CSS px (the button and its prompt) */
	edgeCss: 4,
	/** the clock row's lower edge in every master (ui/ClockStrip.svelte: top 10, 12 px type): the prompt stays under it */
	clockBottom: 28,
};

/** a portrait screen is a phone (short side at most 480 CSS px) by utils-layout's size class, else a tablet */
export const isPhoneSizeType = (sizeType: string) => sizeType === 'smallMobile' || sizeType === 'mobile';

export const skipSpot = (kind: LayoutKind, phone: boolean): SkipSpot => (kind === 'portrait' ? (phone ? 'portraitPhone' : 'portraitTablet') : kind);

export type CssRect = { x: number; y: number; width: number; height: number };

/** the SKIP button's box in CSS px for a viewport, by the fit the chrome and the canvas both use */
export const skipButtonRect = (spot: SkipSpot, view: { width: number; height: number }): CssRect => {
	const M = MASTER[spot === 'landscape' || spot === 'phone' ? spot : 'portrait'];
	const scale = Math.min(view.width / M.width, view.height / M.height);
	const left = (view.width - M.width * scale) / 2;
	const top = (view.height - M.height * scale) / 2;
	const slot = SKIP.slots[spot];
	const width = slot.play * scale;
	const height = width / 2;
	const x = 'x' in slot ? left + slot.x * scale : view.width - (slot.right + slot.play) * scale;
	return { x: Math.max(SKIP.edgeCss, Math.min(x, view.width - SKIP.edgeCss - width)), y: Math.max(SKIP.edgeCss, top + slot.y * scale), width, height };
};

/** THE PROMPT'S BOX for a button box, CSS px: under the button with their right edges in line; to the button's left
 *  when there is no room under it; always inside the screen and under the clock row. `size` is the prompt's own. */
export const skipPromptRect = (spot: SkipSpot, button: CssRect, size: { width: number; height: number }, gap: number, view: { width: number; height: number }): CssRect => {
	const M = MASTER[spot === 'landscape' || spot === 'phone' ? spot : 'portrait'];
	const scale = Math.min(view.width / M.width, view.height / M.height);
	const minY = Math.max(SKIP.edgeCss, (view.height - M.height * scale) / 2 + SKIP.clockBottom * scale);
	const below = button.y + button.height + gap + size.height <= view.height - SKIP.edgeCss;
	const x = below ? button.x + button.width - size.width : button.x - gap - size.width;
	const y = below ? button.y + button.height + gap : button.y;
	const hold = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
	return { x: hold(x, SKIP.edgeCss, view.width - SKIP.edgeCss - size.width), y: hold(y, minY, Math.max(minY, view.height - SKIP.edgeCss - size.height)), ...size };
};
