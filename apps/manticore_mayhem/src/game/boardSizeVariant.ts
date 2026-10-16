// THE BOARD SIZE ON A PORTRAIT PHONE. The desktop / landscape board's size lives in layoutSpec.ts (LANDSCAPE_BOARD,
// branch board-75-final, Corey 2026-10-16 14:30); its round 1 variants (?board=75 / 80) were folded in there and are gone.
// This file now holds only the portrait phone's variants below (branch board-phone-r1).

/** the page's `?board=` value in a DEV build, null in a release build */
const boardParam = (): string | null => {
	if (!import.meta.env.DEV || typeof location === 'undefined') return null;
	return new URLSearchParams(location.search).get('board');
};

// ---- PHONE PORTRAIT (branch board-phone-r1, 2026-10-16) --------------------------------------------------------------
// CHAINS HALF CLIPPED SHIPS (Corey 2026-10-16 14:59, on board_phone_r1: "2. Half Clipped. 3. Yes"). The variants below
// were round 1's mockups; 'chainsHalf' is now the layout a release build ships on a portrait PHONE (the layout system's
// size class, layoutSpec isPhoneSizeType). A portrait tablet keeps the shipped rule ('current') whatever is picked.
// Corey: "on phone, we should do bigger board mock ups as well ... so the chains on the side of the board are on screen,
// but maybe half of each side of the chains could be clipped by the edges of the page".
//
// THE LIMIT TODAY is the screen's WIDTH: the portrait frame is sized so each chain's centreline sits
// PORTRAIT_FIT.chainInset (10 master px) inside the screen edge (layoutSpec frameFor; the 412 master is fitted by width
// on every phone taller than 412 x 760, so the board is 77 % of the screen's width there whatever the height). The
// height has room to spare on every phone checked (the HUD rides down to the real bottom edge), so the only way to
// grow is to let the art run off the sides.
//
// A variant names the render x of the board art (board_v5l, render px, left side; the right side mirrors it about the
// lattice's centre) that is held ON the screen's left edge, as an offset outward from the left chain's centreline (render
// x 164.70, the mean of its top pivot and bottom anchor; BOARD_ART.anchors). The two held points are then the
// screen's width apart: k = viewport width / (chain span - 2 x offset), both in master units at k 1.
//   current     the shipped rule (centreline 10 master px inside the edge), untouched
//   chainsHalf  offset 0: the centreline on the edge, the outer half of each chain off screen
//   chainsOff   offset 49.5: the frame POST's outer face (render x 214.2: board-frame-portrait.webp column 89 of 1006,
//               the solid post at mid height) on the edge; the chain's visible links (42 of the strip's 55 texture px,
//               centreline +/- 40.9 render px) are wholly off screen, only the post's small brackets (to render 200.5)
//               are cut. The upper bound: past it the post itself is cut.
// The growth k is capped at maxK (a height guard for odd viewports; no phone checked comes near it). WHERE THE GROWTH
// GOES (Corey 2026-10-16, question 3: "Yes"): DOWN first, so the frame's top and the creature behind it stay where they
// are, as far as the room under the board allows; the rest goes up. The room is the gap from the spin amount plaque
// to the BALANCE / SPIN row: it never closes below today's gap on that phone or PORTRAIT_GROW.minHudGapCss, whichever
// is smaller (layoutSpec frameFor). On a 375 x 667 iPhone SE there is no room (the plaque already sits behind the
// row), so there it all goes up.
// DEV only: `?board=current` (the old rule, for comparing) or `?board=off`. Landscape and phone sideways are untouched
// (the sideways board is limited by the screen's HEIGHT, not by its chains).
export type PortraitBoardKey = 'current' | 'chainsHalf' | 'chainsOff';

export type PortraitBoardVariant = {
	/** render px from the left chain's centreline outward to the art point held on the screen edge; null = shipped rule */
	edgeOut: number | null;
	/** the growth cap for this variant */
	maxK: number;
};

export const PORTRAIT_BOARD_VARIANTS: Record<PortraitBoardKey, PortraitBoardVariant> = {
	current: { edgeOut: null, maxK: 1.12 },
	chainsHalf: { edgeOut: 0, maxK: 1.25 },
	chainsOff: { edgeOut: 49.5, maxK: 1.25 },
};

/** the variant a release build ships on a portrait phone */
export const PORTRAIT_BOARD_DEFAULT: PortraitBoardKey = 'chainsHalf';

const pickPortrait = (): PortraitBoardKey => {
	const q = boardParam();
	return q === 'current' ? 'current' : q === 'off' ? 'chainsOff' : PORTRAIT_BOARD_DEFAULT;
};

export const PORTRAIT_BOARD_KEY: PortraitBoardKey = pickPortrait();
export const PORTRAIT_BOARD: PortraitBoardVariant = PORTRAIT_BOARD_VARIANTS[PORTRAIT_BOARD_KEY];
