// Design master coordinates from the Claude Design project ("Graffiti Grunge", v5.2).
// Both the PixiJS scene (MainContainer) and the HTML chrome (FitFrame) are authored in
// these units and scaled uniformly to the viewport, so a coordinate here lands on the
// same pixel in both layers.
import { SYMBOL_SIZE } from './constants';

export type LayoutKind = 'landscape' | 'portrait';

export const MASTER: Record<LayoutKind, { width: number; height: number }> = {
	landscape: { width: 1280, height: 720 },
	portrait: { width: 412, height: 760 },
};

// Reel frame geometry. inset = border + padding + grid padding (distance from frame edge to first cell).
// The frame PNGs are rendered at 2x from the same numbers (static/assets/ui/frame-*.png) with a 6px
// transparent margin on every side for the outer ring.
export const FRAME: Record<
	LayoutKind,
	{ x: number; y: number; width: number; height: number; inset: number; cell: number; gap: number; image: string; margin: number }
> = {
	landscape: { x: 320, y: 50, width: 640, height: 520.4, inset: 23, cell: 115.6, gap: 4, image: 'frameDesktop', margin: 6 },
	portrait: { x: 12, y: 120, width: 388, height: 317.6, inset: 20, cell: 66.4, gap: 4, image: 'frameMobile', margin: 6 },
};

// Static Marty illustration (base game). Centre + square size, in master units.
export const MARTY: Record<LayoutKind, { x: number; y: number; size: number }> = {
	landscape: { x: 1060, y: 490, size: 480 },
	portrait: { x: 262, y: 590, size: 340 },
};

export const layoutKind = (layoutType: 'desktop' | 'landscape' | 'portrait' | 'tablet'): LayoutKind =>
	layoutType === 'portrait' || layoutType === 'tablet' ? 'portrait' : 'landscape';

// Where the Pixi board (5 × SYMBOL_SIZE by 4 × SYMBOL_SIZE, unscaled) sits for a given master.
export const boardPlacement = (kind: LayoutKind) => {
	const f = FRAME[kind];
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
		mantis: { marky: { x: number; y: number }; marty: { x: number; y: number }; size: number };
		pressToContinue: { y: number; width: number; height: number };
	}
> = {
	landscape: {
		fsCounter: { x: 50, y: 250, scale: 1 },
		pool: { x: 1076, y: 150, cols: 4, cell: 52 }, // top-right, clear of Marty
		mantis: { marky: { x: 160, y: 450 }, marty: { x: 1060, y: 470 }, size: 150 }, // Marky left column, Marty right of the board
		pressToContinue: { y: 612, width: 620, height: 104 },
	},
	portrait: {
		fsCounter: { x: 12, y: 446, scale: 0.7 },
		pool: { x: 206, y: 114, cols: 8, cell: 40 }, // one row overlapping the frame's top edge
		mantis: { marky: { x: 80, y: 600 }, marty: { x: 330, y: 600 }, size: 100 },
		pressToContinue: { y: 572, width: 260, height: 44 },
	},
};
