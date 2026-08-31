// Design master coordinates from the Claude Design project ("Graffiti Grunge", v5.2).
// Both the PixiJS scene (MainContainer) and the HTML chrome (FitFrame) are authored in
// these units and scaled uniformly to the viewport, so a coordinate here lands on the
// same pixel in both layers.
import { SYMBOL_SIZE } from './constants';

export type LayoutKind = 'landscape' | 'portrait' | 'phone';

export const MASTER: Record<LayoutKind, { width: number; height: number }> = {
	landscape: { width: 1280, height: 720 },
	portrait: { width: 412, height: 760 },
	// Phone held sideways (layoutType 'landscape': ratio ≥ 1.3 AND device width ≤ 480). Wide master so
	// the full screen width is used, controls authored large enough to stay ≥44 CSS px when scaled down.
	phone: { width: 1480, height: 740 },
};

// Reel frame geometry. inset = border + padding + grid padding (distance from frame edge to first cell).
// The frame PNGs are rendered at 2x from the same numbers (static/assets/ui/frame-*.png) with a 6px
// transparent margin on every side for the outer ring.
export const FRAME: Record<
	LayoutKind,
	{ x: number; y: number; width: number; height: number; inset: number; cell: number; gap: number; margin: number }
> = {
	landscape: { x: 320, y: 50, width: 640, height: 520.4, inset: 23, cell: 115.6, gap: 4, margin: 6 },
	portrait: { x: 12, y: 158, width: 388, height: 317.6, inset: 20, cell: 66.4, gap: 4, margin: 6 },
	// Uniform 1.25× of the landscape frame centred in the 1480-wide master: board fills the
	// height, side columns (340 each) hold the controls.
	phone: { x: 340, y: 36, width: 800, height: 650.5, inset: 28.75, cell: 144.5, gap: 5, margin: 7.5 },
};

// Cafeteria frame art (static/assets/ui/board-frame-cafeteria.webp): canvas 1415×1217 with a
// transparent interior window at (98,112) 1220×985. BoardFrame anchors the window to the cell
// area (frame rect inset by `inset`), so the art stretches <1% to absorb 1.2386 vs 1.25.
// One export serves every LayoutKind — the window resolution (1220×985) exceeds both the
// desktop @2x (1188×949) and portrait @3x (1044×833) targets from assets.csv rows 129/130.
export const FRAME_ART = { w: 1415, h: 1217, winX: 98, winY: 112, winW: 1220, winH: 985 };
// Steel roll-down door art (door-steel.webp), pre-cropped to the opaque door. Wider AND taller
// than the frame window at any layout, so scaled-to-window-width it always covers fully.
export const DOOR_ART = { w: 1246, h: 1028 };

// Static Marty illustration (base game). Centre + square size, in master units.
export const MARTY: Record<LayoutKind, { x: number; y: number; size: number }> = {
	landscape: { x: 1060, y: 490, size: 480 },
	// Low so only head/arms show above the screen bottom edge; antennae just overlap the (expanded)
	// frame's bottom border. Same x and size as before — Corey's spec: move him down only.
	portrait: { x: 340, y: 685, size: 340 },
	phone: { x: 1210, y: 480, size: 300 }, // right column, tucked against the board edge, behind the control rail
};

// Portrait phones are usually WIDER than the 412×760 master (the fit is by height), which used to
// letterbox the reel frame with dead side space. frameFor() grows the portrait frame uniformly —
// every dimension ×k, so the frame PNG's baked cell-well grid keeps registering with the cells —
// to span almost the full real viewport width. Other layouts pass through unchanged.
export const frameFor = (kind: LayoutKind, viewportMasterWidth?: number) => {
	const base = FRAME[kind];
	if (kind !== 'portrait' || !viewportMasterWidth) return base;
	const SIDE = 7; // master px kept clear on each side of the frame
	const MAX_K = 1.36; // height budget: the frame bottom must stay clear of the stats block (tablets)
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

// desktop → the 1280×720 landscape master; phone-sideways ('landscape' layoutType) → the wide phone master.
export const layoutKind = (layoutType: 'desktop' | 'landscape' | 'portrait' | 'tablet'): LayoutKind => {
	if (layoutType === 'portrait' || layoutType === 'tablet') return 'portrait';
	return layoutType === 'landscape' ? 'phone' : 'landscape';
};

// Where the Pixi board (5 × SYMBOL_SIZE by 4 × SYMBOL_SIZE, unscaled) sits for a given master.
export const boardPlacement = (kind: LayoutKind, viewportMasterWidth?: number) => {
	const f = frameFor(kind, viewportMasterWidth);
	const pitch = f.cell + f.gap;
	const innerWidth = 5 * f.cell + 4 * f.gap;
	const innerHeight = 4 * f.cell + 3 * f.gap;
	return {
		x: f.x + f.width / 2,
		y: f.y + f.inset + innerHeight / 2,
		scale: pitch / SYMBOL_SIZE,
		innerWidth,
		innerHeight,
		pitch,
	};
};

// Free-spin HUD slots (master units). Landscape uses the empty column under the logo; portrait uses
// the band between the frame and the stats (the static Marty art is hidden during free spins).
export const HUD: Record<
	LayoutKind,
	{
		fsCounter: { x: number; y: number; scale: number };
		pool: { x: number; y: number; cols: number; cell: number };
		pressToContinue: { y: number; width: number; height: number };
	}
> = {
	landscape: {
		fsCounter: { x: 50, y: 250, scale: 1 },
		pool: { x: 1100, y: 150, cols: 4, cell: 52 }, // top-right, clear of Marty and the frame art's right edge (~984)
		pressToContinue: { y: 668, width: 620, height: 80 }, // below the counter (frame art bottom ~605), above the balance row (~655)
	},
	portrait: {
		fsCounter: { x: 12, y: 578, scale: 0.7 }, // below the EXPANDED frame bottom (see frameFor)
		pool: { x: 206, y: 152, cols: 8, cell: 40 }, // one row overlapping the frame's top edge
		pressToContinue: { y: 572, width: 260, height: 44 },
	},
	phone: {
		fsCounter: { x: 60, y: 190, scale: 1 }, // left column, under the logo/tagline
		pool: { x: 170, y: 420, cols: 4, cell: 52 }, // left column, between fs counter and the stats
		pressToContinue: { y: 640, width: 620, height: 100 }, // low door band, clear of intro detail text
	},
};
