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

// Marty's stage slot (base game AND the bonus mantises, which stand in the same spot). Centre +
// square size, in master units. Portrait's y is NOT read from here: martyFor() derives it from the
// frame art's bottom edge so his antennae touch the counter on every phone (frameFor() grows the
// portrait frame with the viewport, so no fixed y can do that) — Corey 2026-09-06.
export const MARTY: Record<LayoutKind, { x: number; y: number; size: number }> = {
	landscape: { x: 1060, y: 507, size: 480 }, // +17 (Corey 2026-09-07): upper front foot tucks under the counter
	// y is the k=1 value for reference only; see martyFor()
	portrait: { x: 340, y: 685, size: 340 },
	// Same composition as landscape, transposed onto the phone master's 340-wide right column
	// (frame edge 1140 → x = 1140 + 100 × 340/320): the mantis stands at desktop scale, overlapping
	// the frame edge and running behind the spin cluster exactly as he does on desktop, instead of
	// a 300 px figure tucked in the corner (Corey 2026-09-02). Marky mirrors to the left column.
	phone: { x: 1246, y: 480, size: 460 },
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

// The cafeteria frame ART's rectangle in master units (BoardFrame anchors the art's transparent
// window to the cell area, so the art overhangs the FRAME rect by its rails). The chrome keys the
// BALANCE / WIN / SPIN row to these edges, and Marty's portrait y to `bottom` (Corey 2026-09-06).
export const frameArtRect = (kind: LayoutKind, viewportMasterWidth?: number) => {
	const f = frameFor(kind, viewportMasterWidth);
	const winX = f.x + f.inset;
	const winY = f.y + f.inset;
	const sx = (f.width - f.inset * 2) / FRAME_ART.winW;
	const sy = (f.height - f.inset * 2) / FRAME_ART.winH;
	const x = winX - FRAME_ART.winX * sx;
	const y = winY - FRAME_ART.winY * sy;
	const width = FRAME_ART.w * sx;
	const height = FRAME_ART.h * sy;
	return { x, y, width, height, right: x + width, bottom: y + height };
};

// Antenna tip above the rig's origin, in body sizes. The origin is the idle-pose box centre and
// `size` its larger side (window.__angryMantis.rigIdleBounds in DEV: a 1254² square), but the box
// is padded — the tips actually sit ~40 master px below its top at size 480 (measured on the
// desktop render 2026-09-06: tips at y≈289 for a box top of 250). Re-measure after a rig re-export.
export const MARTY_TOP = 0.42;

// Where Marty stands for a given master. Portrait: antennae touching the frame's bottom counter,
// x and size from MARTY; other kinds pass MARTY through.
export const martyFor = (kind: LayoutKind, viewportMasterWidth?: number) => {
	const m = MARTY[kind];
	if (kind !== 'portrait') return m;
	const OVERLAP = 3; // a hair into the rail so the tips read as touching, not floating
	return { x: m.x, size: m.size, y: frameArtRect(kind, viewportMasterWidth).bottom + m.size * MARTY_TOP - OVERLAP };
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

// Bonus-intro composition (BonusIntro.svelte) — a PLAIN BOX TABLE measured off Corey's concept
// render. Every element gets a box expressed as FRACTIONS OF THE DOOR-WINDOW RECT (x, y, w, h),
// and its art is fit INSIDE that box (contain, centered). No derived bands, no gap allowances, no
// overhang reservations: those quietly ate ~10% of the door and shrank the artwork.
//
// ONE table serves all three LayoutKinds. Every LayoutKind's frame is a uniform scale of the same
// art, so the window aspect is ~1.252 everywhere (594x474.4 landscape, 742.5x593 phone,
// 348x277.6 portrait) — a fraction of the window means the same thing on all three. The ONLY
// window aspect is ~1.252 everywhere, so one table serves every kind with no per-kind branch.
//
// Vertical budget, top to bottom (the 1/2/3 rules band that closed the door came off 2026-09-09,
// and its 20% went to the three art pieces, every box scaled by the same 1.22):
//   3% air | header 29% | 1% | plates 27% | 1% | count art 36% | 3% air
// The count art may kiss the bottom of the head ink by ~1% of H — that is intended, it is what
// puts the "10" close to the faces in the render.
//
// The plaque and the PRESS ANYWHERE prompt live OUTSIDE the door in their HUD slots; no layout
// reserves a band for them inside the window.
export type IntroBox = { x: number; y: number; w: number; h: number };

export const BONUS_INTRO = {
	/** full-width box; the header art contains into it (aspect ~3.03 -> ~58% W) */
	header: { x: 0, y: 0.03, w: 1, h: 0.29 } as IntroBox,
	// Both chalk plates contain into IDENTICAL boxes and centre inside them. Their source aspects
	// differ (1.303 vs 1.498), so INMATE 02 draws wider than 01 within the same slot — that is the
	// art, not a layout bug; what matters is that the two slots are the same size and aligned.
	plates: { y: 0.33, h: 0.27, w: 0.32, x: [0.16, 0.52], soloX: 0.34 },
	// Head: 1.05x the plate BOX height, centred horizontally on the plate box, with its vertical
	// centre at 55% down the box — the render's heads sit on the plate and barely overhang it.
	head: { scale: 1.05, centerAt: 0.55 },
	/** full-width box; the count art contains into it (aspect ~2.07 -> ~60% W strip) */
	spins: { x: 0, y: 0.61, w: 1, h: 0.36 } as IntroBox,
} as const;

// The design space the boxes are resolved into. Its aspect matches the window on every kind, so
// `fit` uses the full window in both axes and a fraction maps to that fraction of the door.
export const INTRO_DESIGN = { w: 620, h: 495 };

// Big-win STINGER plate (components/WinStinger.svelte): width as a fraction of the master width,
// centre as a fraction of the master height. Desktop 62% / centre 45% and portrait 92% / 40% are
// the preview's numbers (Corey 2026-09-09); phone-sideways gets the desktop treatment scaled to
// its wider master so the plate covers the same share of the reel window.
export const STINGER: Record<LayoutKind, { w: number; cy: number }> = {
	landscape: { w: 0.62, cy: 0.45 },
	phone: { w: 0.54, cy: 0.45 },
	portrait: { w: 0.92, cy: 0.4 },
};

// HUD slots (master units) for the Pixi-side overlays: the eaten-symbol pool tray and the
// PRESS ANYWHERE prompt. (The FREE SPIN n/total readout is owned by the HTML chrome's spin
// button — components/FreeSpinCounter.svelte and its fsCounter slot were deleted 2026-09-02.)
// `modePlaque.railArtY` is where ModePlaque's pill centres on the frame's bottom rail, given as a
// y in FRAME ART pixels (the rail reads: top face 1121-1142 / highlight seam / front face
// 1149-1208). It has to be art-space, not master: portrait's frame is grown by frameFor() on wide
// phones, so any master y would drift off the rail there.
export const HUD: Record<
	LayoutKind,
	{
		pool: { x: number; y: number; cols: number; cell: number };
		pressToContinue: { y: number; width: number; height: number };
		modePlaque: { railArtY: number };
	}
> = {
	landscape: {
		pool: { x: 1100, y: 150, cols: 4, cell: 52 }, // top-right, clear of Marty and the frame art's right edge (~984)
		// PressToContinue renders the text spanning [y − 0.92h, y − 0.5h] (glyphs 0.42h tall, baseline
		// at y − 0.5h). 670/56 → span 618.5..642, centred (~630) in the free band between the frame
		// art's bottom rail (window bottom 547.4 + 120×0.4816 sy ≈ 605) and the BALANCE/WIN/SPIN
		// text top (trio box bottom 702, pad 4, ~43px content → ~655).
		pressToContinue: { y: 670, width: 620, height: 56 },
		// front face of the rail — nothing else is down there on this kind (stats sit at 702+, well
		// below the frame art)
		modePlaque: { railArtY: (1149 + 1208) / 2 },
	},
	portrait: {
		pool: { x: 206, y: 150, cols: 8, cell: 48 }, // one row overlapping the frame's top edge (48: Corey 2026-09-05, "bigger")
		// Bottom of the page (Corey 2026-09-02). The old 590 slot assumed phones render the
		// unexpanded frame, but real phones are WIDER than the 412 master, so frameFor() grows the
		// frame (k→1.36, art bottom ≈ 609) and the prompt landed on the bottom rail — straight
		// through the ModePlaque (seen on an iPhone). The HTML chrome is hidden (uiHide) for every
		// press-gated presentation, so the stats/spin band at the foot of the master (656..744) is
		// empty then: 745/48 → text spans 700.8..721, under the mantis heads, on the floor.
		pressToContinue: { y: 745, width: 260, height: 48 },
		// front face, same as landscape; the portrait stats block starts at ~656, far below the rail
		modePlaque: { railArtY: (1149 + 1208) / 2 },
	},
	phone: {
		// top-right, like landscape: centred in the right column (1140..1480), above the mantis's
		// head and clear of the spin cluster (x ≥ 1276, y ≥ 600). It used to sit in the left column
		// at y 420, where the bigger Marky now stands (Corey 2026-09-02).
		pool: { x: 1310, y: 150, cols: 4, cell: 56 },
		// The prompt rides the frame's TOP rail on this kind. Phone is the only layout with no free
		// band anywhere below the board: the frame art runs to ≈730 of 740, its bottom rail's front
		// face is taken by the ModePlaque (~690..724) and the stats sit at ~691..734 — so the old
		// y 640 slot put the text INSIDE the door, over the bonus-intro rules band (Corey
		// 2026-09-02). The top rail is genuinely empty: the art's top rail spans ≈ -3..64.75 (window
		// top) and the phone logo/tagline live in the left column (x ≤ 290), clear of the prompt's
		// centred 620-wide span (x 430..1050). 79/62 → text spans 22..48, entirely above the window
		// top, so it cannot overlap intro or outro content at any copy length. Pressing is
		// full-screen (OnPressFullScreen), so the small text costs no touch target.
		pressToContinue: { y: 79, width: 620, height: 62 },
		// NOT the front face on this kind: the HTML stats strip (ChromePhone .stats) owns master
		// y 701.6..734 across the whole frame width, and its centred WIN column lands right on top
		// of the pill — measured 2026-09-02, the plaque rendered at 689.2..724.7 with "WIN / $0.00"
		// drawn straight through it. Sitting the pill on the rail's TOP face instead centres it in
		// the free band between the reel window (657.75) and the stats (701.6): 661.9..697.4, ~4
		// master px clear at both ends. (The stats strip left the band on 2026-09-02 — it now stacks in
		// the left column, clear of the iOS home indicator — so the front face is free again if the
		// pill ever wants to match the other kinds; the top face still reads fine, left as is.)
		// front face like the other kinds (Corey 2026-09-06): the stats strip left this band on
		// 2026-09-02, so the pill no longer has to dodge it — the top-face perch read as misaligned
		modePlaque: { railArtY: (1149 + 1208) / 2 },
	},
};
