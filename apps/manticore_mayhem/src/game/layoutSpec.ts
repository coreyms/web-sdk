// Design master coordinates. Both the PixiJS scene (MainContainer) and the HTML chrome (FitFrame)
// are authored in these units and scaled uniformly to the viewport, so a coordinate here lands on
// the same pixel in both layers.
//
// Manticore's board is 8x8 and SQUARE, which is the one structural difference from Angry Mantis's
// 5x4: every LayoutKind has to find room for a square, and the landscape/phone masters keep a
// column clear on the RIGHT for the manticore (spec F: right of the board in landscape and
// phone-sideways, mirrored from the render so it faces the board; portrait hides it).
import { SYMBOL_SIZE, GRID } from './constants';

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
	// 549 of cells + 2x14.5 inset = 578 square. x is set so the frame ART rect starts at 300, which
	// is where the HTML chrome keys the BALANCE / WIN / SPIN row from (ui/ChromeLandscape.svelte):
	// any further left and BALANCE collides with the bottom-left button cluster. Right edge 890
	// leaves 900..1280 clear for the manticore.
	landscape: { x: 306, y: 34, width: 578, height: 578, inset: 14.5, cell: 66, gap: 3, margin: 6 },
	// 344 of cells + 2x11 = 366 square, centred; frameFor() grows it on wide phones.
	portrait: { x: 23, y: 168, width: 366, height: 366, inset: 11, cell: 40.5, gap: 3, margin: 5 },
	// 632.5 of cells + 2x16 = 664.5 square, centred on the master so the chrome's 340-wide side
	// columns stay clear; the manticore stands in the right one.
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

// Portrait phones are usually WIDER than the 412x760 master (the fit is by height), which would
// letterbox the board with dead side space. frameFor() grows the portrait frame uniformly — every
// dimension x k — to span almost the full real viewport width. Other layouts pass through.
export const frameFor = (kind: LayoutKind, viewportMasterWidth?: number) => {
	const base = FRAME[kind];
	if (kind !== 'portrait' || !viewportMasterWidth) return base;
	const SIDE = 7; // master px kept clear on each side of the frame
	const MAX_K = 1.12; // height budget: the board's bottom edge must stay clear of the spin-win readout
	const k = Math.min(Math.max((viewportMasterWidth - SIDE * 2) / base.width, 1), MAX_K);
	if (k <= 1) return base;
	return {
		...base,
		x: MASTER.portrait.width / 2 - (base.width * k) / 2,
		width: base.width * k,
		height: base.height * k,
		inset: base.inset * k,
		cell: base.cell * k,
		gap: base.gap * k,
		margin: base.margin * k,
	};
};

/** The board frame's outer rectangle in master units. The HTML chrome keys the BALANCE / WIN / SPIN
 *  row to these edges (ui/ChromeLandscape.svelte). With no frame ART yet this is the frame rect
 *  itself plus its margin, so the readouts still line up with the board's visible edges. */
export const frameArtRect = (kind: LayoutKind, viewportMasterWidth?: number) => {
	const f = frameFor(kind, viewportMasterWidth);
	const x = f.x - f.margin;
	const y = f.y - f.margin;
	const width = f.width + f.margin * 2;
	const height = f.height + f.margin * 2;
	return { x, y, width, height, right: x + width, bottom: y + height };
};

/** the board's horizontal centre in master units. The landscape board is deliberately LEFT of the
 *  master centre (the manticore has the right column), so anything that belongs to the board —
 *  the mode plaque, the spin-win readout — has to centre on this and not on the master. */
export const boardCenterX = (kind: LayoutKind, viewportMasterWidth?: number) => {
	const f = frameFor(kind, viewportMasterWidth);
	return f.x + f.width / 2;
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
		// the free band between the board's bottom edge (618) and the BALANCE / WIN / SPIN row (~655)
		pressToContinue: { y: 700, width: 620, height: 48 },
		modePlaque: { y: 323, height: 34, width: 500 },
		spinWin: { y: 640, height: 28, width: 400 },
	},
	portrait: {
		pressToContinue: { y: 700, width: 300, height: 44 },
		modePlaque: { y: 360, height: 28, width: 356 },
		spinWin: { y: 614, height: 26, width: 340 },
	},
	phone: {
		// phone has no free band under the board (the board runs to 680 of 740 and the strip below it
		// is only 60 master px), so the prompt rides above it — the side columns hold the chrome and
		// the centre top is empty. The plaque OVERLAYS the board centre for the same reason: below it
		// there is no room for the plate, and the board is static whenever the plaque is up.
		pressToContinue: { y: 26, width: 600, height: 44 },
		modePlaque: { y: 364, height: 34, width: 560 },
		spinWin: { y: 718, height: 24, width: 420 },
	},
};
