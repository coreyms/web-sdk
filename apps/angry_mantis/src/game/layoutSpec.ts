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

// Bonus-intro composition (BonusIntro.svelte). EVERY number below is a PERCENTAGE of the door
// window (W x H) — that is how Corey specced the concept render, and keeping the table in those
// units is what makes "does it match the render" checkable rather than a matter of taste. The
// composition is authored in a design box of the window's aspect and uniformly scaled onto the
// window, so a percentage here is literally that percentage of the door opening on screen.
//
// CONTAINMENT (Corey's primary acceptance test): everything on this screen stays INSIDE the door
// window on every layout. Only the ModePlaque and the PRESS ANYWHERE prompt live outside, in their
// HUD slots below the frame. Because every LayoutKind's frame is a uniform scale of the same art,
// the window aspect is ~1.252 everywhere (594x474.4 landscape, 742.5x593 phone, 348x277.6
// portrait), so one design aspect serves all three and `fit` uses the full window in both axes.
//
// Landscape/phone follow the render exactly: header, two mugshot plates, the big count art, then
// THREE EQUAL RULE COLUMNS with hairline dividers. Portrait's window is only ~330 CSS px wide, so
// three columns of body copy would fall under ~8px caps; it alone drops to three stacked centred
// rows and gives the freed height back to the copy (Corey 2026-09-01: "keep 3 columns if legible
// else 3 stacked centred rows - only in portrait").
export type BonusIntroSpec = {
	design: { w: number; h: number };
	/** header art width, % of W (height follows the art's aspect); top edge, % of H */
	header: { w: number; top: number };
	/** mugshot band: top and plate height as % of H, gap between plates as % of W */
	mugs: { top: number; h: number; gap: number };
	/** Free-spin count art. The band is DERIVED, not tabled: it starts one `gap` (% of H) below the
	 *  bottom of the head ink — the head hangs MUGSHOT_HEAD.overhang past its plate, and hard-coding
	 *  a top here is what let the "10" collide with Marky's antennae — and runs to the rules band,
	 *  so the art always fills every pixel left between the two. */
	spins: { gap: number };
	rules: {
		/** band top and height, % of H; total width, % of W */
		top: number;
		h: number;
		w: number;
		/** 'columns' -> three equal columns with dividers. 'rows' -> three stacked centred rows. */
		layout: 'columns' | 'rows';
		/** gap between columns / rows, % of W / % of H */
		gap: number;
		/** boxed numeral height and gold title cap height, % of H */
		badge: number;
		titleCap: number;
		/** columns only: the Glowing Leaf tile beside column 1's copy, height as % of H */
		leaf: number;
		/** body copy cap height, % of H, and its line advance as a multiple of the cap */
		bodyCap: number;
		lead: number;
		copy: 'full' | 'medium' | 'short';
	};
};

export const BONUS_INTRO: Record<LayoutKind, BonusIntroSpec> = {
	// Bands are contiguous from 1.5% to 99% of H, so the door reads FULL rather than sparse.
	landscape: {
		design: { w: 620, h: 495 },
		header: { w: 50, top: 1.5 },
		mugs: { top: 24.15, h: 22, gap: 5 },
		spins: { gap: 1 },
		// titleCap is 4.4% rather than the render's ~5.5%: every rule title is 10 characters
		// ("EPIC FEAST" / "HEAD START") and at 5.5% the badge+title line no longer fits its
		// column, wrapping the title in half. The solver in BonusIntro shrinks it further only
		// if a title still would not fit, and uses ONE cap for all three so they stay a set.
		rules: {
			top: 77,
			h: 22,
			w: 99,
			layout: 'columns',
			gap: 0.8,
			badge: 5.6,
			titleCap: 4.4,
			bodyCap: 3.2,
			lead: 1.3,
			leaf: 9,
			copy: 'short',
		},
	},
	// Phone-sideways keeps the render's three columns. Its design box is WIDER (780 x 495, aspect
	// 1.58) than the others' because this is the one layout that reserves a band for the press
	// prompt: fitting a 1.252 box into the remaining 742.5 x 473 window would have left ~150 master
	// px of door width unused and squeezed the rule columns to ~7.5 CSS px caps. Matching the box to
	// the USABLE window instead widens each column by ~30%, so the copy wraps to three lines and the
	// caps go back up to portrait's ~9.7 CSS px. Percentages still read as percentages of the door
	// window; only `header.w` is re-tuned (48 instead of 60), because a % of a wider W would
	// otherwise make the header taller than its band.
	// header is 40% W, not landscape's 50%: this design box maps its WIDTH to the full door
	// (742.5 master) but its HEIGHT only to the window minus the reserved prompt band, so a
	// 55%-W header would eat 28.6% of the usable height and starve the count art.
	phone: {
		design: { w: 780, h: 495 },
		header: { w: 40, top: 1.5 },
		mugs: { top: 24.3, h: 22, gap: 4 },
		spins: { gap: 1 },
		rules: {
			top: 77,
			h: 22,
			w: 99,
			layout: 'columns',
			gap: 1,
			badge: 5.6,
			titleCap: 4.4,
			bodyCap: 3.2,
			lead: 1.3,
			leaf: 9,
			copy: 'short',
		},
	},
	// Portrait: the art bands shrink a little to buy the rules the height that three stacked rows
	// need at a cap that still reads on a ~330 CSS px wide door.
	portrait: {
		design: { w: 620, h: 495 },
		header: { w: 48, top: 1.5 },
		mugs: { top: 23.3, h: 18.5, gap: 5 },
		spins: { gap: 1 },
		// The rules band gets 36.7% of H — the freed header/plate/count height — because three
		// stacked rows at a 4.1% cap need it; any less and the group self-scales down, which is
		// what was quietly shrinking portrait's copy to 3.7%.
		rules: {
			top: 62.3,
			h: 36.7,
			w: 96,
			layout: 'rows',
			gap: 1.6,
			badge: 6.6,
			titleCap: 4.1,
			bodyCap: 4.1,
			lead: 1.34,
			leaf: 0,
			copy: 'short',
		},
	},
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
		// PressToContinue renders the text spanning [y − 0.92h, y − 0.5h] (glyphs 0.42h tall, baseline
		// at y − 0.5h). 670/56 → span 618.5..642, centred (~630) in the free band between the frame
		// art's bottom rail (window bottom 547.4 + 120×0.4816 sy ≈ 605) and the BALANCE/WIN/SPIN
		// text top (trio box bottom 702, pad 4, ~43px content → ~655).
		pressToContinue: { y: 670, width: 620, height: 56 },
	},
	portrait: {
		fsCounter: { x: 12, y: 578, scale: 0.7 }, // below the EXPANDED frame bottom (see frameFor)
		pool: { x: 206, y: 152, cols: 8, cell: 40 }, // one row overlapping the frame's top edge
		// 590/48 → text span 545.8..566, centred (~556) between the unexpanded frame art bottom
		// (455.6 window bottom + 120×0.2818 sy ≈ 489) and the BALANCE/SPIN stats content top
		// (row bottom 656, ~33px content → ~623) — clear of the spin/bet cluster (bar 666..744)
		// and, with the fs counter hidden before the outro presents, of its 578..628 slot too.
		// On EXPANDED tablet frames (frameFor k→1.36, art bottom →~609) the prompt rides the
		// door/rail band instead — no interactive collision, phones (k=1) are the design target.
		pressToContinue: { y: 590, width: 260, height: 48 },
	},
	phone: {
		fsCounter: { x: 60, y: 190, scale: 1 }, // left column, under the logo/tagline
		pool: { x: 170, y: 420, cols: 4, cell: 52 }, // left column, between fs counter and the stats
		// frame art bottom ≈ 730 of 740 — no free band below the rail, so the prompt stays on the
		// door's lower band: 640/100 → text span 548..590, below the outro content (≤ ~532) and
		// clear of the plaque (~690..724) and stats (~691..734).
		pressToContinue: { y: 640, width: 620, height: 100 },
	},
};
