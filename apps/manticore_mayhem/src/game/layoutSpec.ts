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

export type LayoutKind = 'landscape' | 'portrait' | 'phone';

export const MASTER: Record<LayoutKind, { width: number; height: number }> = {
	landscape: { width: 1280, height: 720 },
	portrait: { width: 412, height: 760 },
	// Phone held sideways (layoutType 'landscape': ratio >= 1.3 AND device width <= 480).
	phone: { width: 1480, height: 740 },
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
	landscape: { x: 416.451, y: 103.76, width: 447.641, height: 447.641, inset: 11.23, cell: 51.115, gap: 2.323, margin: 4.647 },
	// CHAIN-FIT (Corey 2026-10-06 21:32: portrait was too small): each chain's centreline 10 master px
	// inside the screen edge (x 10 and 402), the posts and finials overhang off screen (art x -17.9 ..
	// 429.5); vertically the dead band between the tagline (150) and the BALANCE / BET row (688) is split
	// 1 : 1.3 above / below the art (art y 198.77 .. 624.6, board_v4h: the taller square-opening art; was
	// 205.85 .. 615.4 with v4g). 316.95 of cell area + 2 x 10.135, cells 37.2 (pitch 39.96, as v4g; 300.24 /
	// 37.86 with v4f). frameFor() grows it on wide portrait viewports the same way (PORTRAIT_FIT).
	portrait: { x: 37.389, y: 246.027, width: 337.222, height: 337.222, inset: 10.135, cell: 37.207, gap: 2.756, margin: 4.607 },
	// 632.5 of cells + 2x16 = 664.5 square, centred on the master so the chrome's 340-wide side
	// columns stay clear; the manticore stands in the right one. Approved as is (Corey 2026-10-06):
	// here the art is registered TO these cells, so it overhangs the master top and bottom (board_v4h: art y
	// -66.53 .. 783.24 of the 740 master, 66.5 over the top and 43.2 under the bottom).
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
 *  bottom) split 1 : `gapRatio` above / below the art, growth capped at `maxK` (height budget). */
export const PORTRAIT_FIT = { chainInset: 10, bandTop: 150, hudTop: 688, gapRatio: 1.3, maxK: 1.12 };

// Portrait viewports WIDER than the 412x760 master (tablets, foldables: the fit is by height) would
// leave dead side space. frameFor() grows the portrait frame uniformly, every dimension x k about the
// master's centre line, until the chains sit chainInset inside the real viewport edges again (cap maxK),
// and re-places it vertically by the same 1 : gapRatio split. Other layouts pass through.
export const frameFor = (kind: LayoutKind, viewportMasterWidth?: number) => {
	const base = FRAME[kind];
	if (kind !== 'portrait' || !viewportMasterWidth) return base;
	const P = PORTRAIT_FIT;
	const k = Math.min(Math.max((viewportMasterWidth - P.chainInset * 2) / chainSpanOf(base), 1), P.maxK);
	if (k <= 1) return base;
	const art = artRectOf(base);
	const top = P.bandTop + Math.max(P.hudTop - P.bandTop - art.height * k, 0) / (1 + P.gapRatio);
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
 *  the BALANCE / BET row (the art moves with frameFor's growth); the others use their HUD slot. */
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
//  · skipButton      — the SKIP TO RESULT plate (components/SkipButton.svelte), up during the spins of
//                      a feature. x/y is the HIT AREA's top-left; the plate is drawn inside it. The
//                      height is the touch target (>= 47 master px in every layout).
export const HUD: Record<
	LayoutKind,
	{
		pressToContinue: { y: number; width: number; height: number };
		modePlaque: { y: number; height: number; width: number };
		spinWin: { y: number; height: number; width: number };
		skipButton: { x: number; y: number; width: number; height: number };
	}
> = {
	// THE MODE PLAQUE OVERLAYS THE BOARD CENTRE in every layout. There is no free band tall enough
	// for the plate under the board on any master (landscape has 37 master px between the board's
	// bottom edge and the readout row, phone has 60), and the board is static for the whole time
	// the plaque is up, so the centre is both the readable place and the only one that fits.
	landscape: {
		// the free band between the board's bottom edge (618) and the BALANCE / WIN / SPIN row (~655): the prompt's
		// glyphs span y - 44 .. y - 24 (PressToContinue). It was y 700 (656 .. 676), on top of the HTML HUD's WIN label
		// (Corey 2026-10-09). The only prompts left are the feature intro and the wrap up, where the SPIN readout
		// that shares this band is down.
		pressToContinue: { y: 672, width: 620, height: 48 },
		// the cell area's centre (114.99 + 425.18 / 2, board_v4h) and ~0.9 of its width
		modePlaque: { y: 327.6, height: 34, width: 380 },
		spinWin: { y: 640, height: 28, width: 400 },
		// top right of the page: the band above the manticore (which stands at y 380, size 430, so
		// its head reaches ~165) and clear of the board art (right edge 940, skip plate from 1010) and the clock strip
		skipButton: { x: 1010, y: 34, width: 230, height: 48 },
	},
	portrait: {
		pressToContinue: { y: 700, width: 300, height: 44 },
		// the cell area's centre at k 1 (256.16 + 316.95 / 2, board_v4h); ModePlaque uses boardCenterY (follows the growth)
		modePlaque: { y: 414.6, height: 28, width: 260 },
		// y at k 1: midway between the art bottom (624.6, board_v4h) and the BALANCE / BET row (688); SpinWin uses
		// spinWinY (follows the growth)
		spinWin: { y: 656.3, height: 26, width: 340 },
		// the tagline band under the logo (logo bottom ~114, frame art top 198.77 at k 1, board_v4h): the chrome
		// hides the tagline for the whole free game, so this band is free in every portrait fit.
		skipButton: { x: 96, y: 115, width: 220, height: 48 },
	},
	phone: {
		// phone has no free band under the board (the board runs to 680 of 740 and the strip below it
		// is only 60 master px), so the prompt rides above it — the side columns hold the chrome and
		// the centre top is empty. The plaque OVERLAYS the board centre for the same reason: below it
		// there is no room for the plate, and the board is static whenever the plaque is up.
		pressToContinue: { y: 26, width: 600, height: 44 },
		modePlaque: { y: 364, height: 34, width: 560 },
		spinWin: { y: 718, height: 24, width: 420 },
		// centre top, the same empty band the PRESS ANYWHERE prompt rides in; the two are never up
		// at once (the prompt only while the game waits for a press, the skip only while it spins).
		// The band is only 32 master px tall (the frame's top rail starts at 32), so the 48 hit area
		// starts at the master's top edge and its 40 plate (4..44) laps the rail but never the cells
		// (first row at 48). The clock strip's texts sit in the side columns, the centre is clear.
		// top right like landscape (Corey 2026-10-05): under the clock strip, above the manticore band
		skipButton: { x: 1230, y: 40, width: 230, height: 48 },
	},
};
