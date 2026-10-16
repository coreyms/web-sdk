// BOARD SIZE MOCKUP, round 1 (branch board-size-r1, 2026-10-15; NOT for merge as is). Stake's review of the first
// submission (5.3 / 9) said "Small grid": on a desktop the cell area was 425.18 of the 720 master (59 % of a 16:9
// screen's height, 53 % of a 16:10 one's). These are the numbers for a bigger DESKTOP board (the 'landscape' kind
// only; the phone and portrait masters are untouched), side by side so Corey can pick one.
//
// Every number is in the 1280 x 720 landscape master unless it says scene px (the 2560 x 1440 courtyard frame the
// creature stands in). The board art scales uniformly about the cell area's centre line (x 640.27, as now); the
// layout facts below are measured on the shipped board_v5l art at k 1 and scale with it:
//   above the cells   the top rail's gear tops 0.0757 x the cell area, the small spikes 0.099, the corner finials
//                     0.182 (the art's top)
//   below the cells   the frame's feet 0.0765, the bronze spin amount plaque's bottom 0.1407
//   width             the art (chains and corner gears) 1.408 x the cell area
// THE LIMIT is the HUD readout row (BALANCE / WIN / SPIN): its labels start at y 660 (ui/ChromeLandscape.svelte:
// bottom 18, 92 tall, content at the bottom). The plaque hangs under the board, right over the WIN readout, so the
// plaque's bottom has to stay above ~655. On a 16:9 screen that leaves 655 - 0.2164 x S for the cells' top (S = the
// cell area), and the top of the art is cut by the screen edge once S passes about 425. On 16:10 (1440 x 900, 1512
// x 982) the master is fitted by width and the canvas has 40 master units of scene above it, so more of the top shows.
//
//   current  S 425.18, cells y 114.99: as shipped.
//   h75      S 538 (74.7 % of a 16:9 height): cells y 41, the top rail's gears just on the screen at 16:9 (y 0.3),
//            the spikes and finials above the screen edge; plaque bottom 654.7.
//   h80      S 572 (79.4 % of a 16:9 height): cells y 2.5, the whole top rail above the screen edge at 16:9 (it shows
//            at 16:10); plaque bottom 655.
//
// What moves with the board (each value here, per variant):
//   logo      LOGO.landscape's rule (constants.ts): centred between the screen's left edge and the frame's solid post,
//             26 clear of both, its top kept at 47 (under the clock strip). The post is render x 82.2 of the board
//             art (352 master at k 1), so the logo shrinks as the board grows.
//   creature  CREATURE.place.desktop (scene px, the 16:9 mapping is 2 scene px per master unit): his drawn left
//             edge (the left wing tip, 416 px of the rig's 1024 canvas left of the feet point) kept 15 scene px over
//             the cell area's right edge, as now; scale chosen so his right wing tip (372 canvas px right of the feet)
//             stays on a 16:9 screen. He stays in front of the board's right post and chain (layer 'front').
//   prompt    HUD.landscape.pressToContinue y: the band it used (art bottom to the readout row) is gone, so the
//             prompt moves up over the board's bottom rows, under the intro / wrap up plaque (glyphs y - 44 .. y - 24).
//   trio      the readout row stays keyed to the art's edges, but never closer than 20 to the [Bonus, Menu] cluster
//             (ends x 214) or 16 to the [Auto / Turbo, Spin] cluster (starts x 1042): TRIO_CLEAR in layoutSpec.ts.
//
// WHICH ONE RUNS: the shipped constant is BOARD_SIZE_DEFAULT. In a DEV build only, `?board=75` or `?board=80` on the
// page URL picks another for the mockups (no window global; read once at module load).
export type BoardSizeKey = 'current' | 'h75' | 'h80';

export type BoardSizeVariant = {
	/** the cell area's side (8 cells + 7 gaps), master units */
	cellArea: number;
	/** the cell area's top edge, master units */
	cellTop: number;
	/** LOGO.landscape: the logo art box's centre and width */
	logo: { cx: number; cy: number; width: number };
	/** CREATURE.place.desktop: the feet point in scene px and the draw scale of the rig's 1024 canvas */
	creature: { x: number; y: number; scale: number };
	/** HUD.landscape.pressToContinue.y */
	promptY: number;
};

export const BOARD_SIZE_VARIANTS: Record<BoardSizeKey, BoardSizeVariant> = {
	current: { cellArea: 425.18, cellTop: 114.99, logo: { cx: 176, cy: 106, width: 300 }, creature: { x: 2089.9, y: 1213.3, scale: 0.96 }, promptY: 672 },
	// post 371.27 + (82.2 - 329.571) x 0.38715 = 275.5: logo 26..249.5, width 223.5 (0.745 of today's), centre 137.7
	// creature: cells' right edge 909.27 = 1818.5 scene px; left wing tip 1803.5, scale 0.86 (right tip 2481)
	h75: { cellArea: 538, cellTop: 41, logo: { cx: 137.7, cy: 91.1, width: 223.5 }, creature: { x: 2161.3, y: 1213.3, scale: 0.86 }, promptY: 560 },
	// post 354.27 + (82.2 - 329.571) x 0.41162 = 252.4: logo 26..226.4, width 200.4 (0.668), centre 126.2
	// creature: cells' right edge 926.27 = 1852.5 scene px; left wing tip 1837.5, scale 0.82 (right tip 2483.7)
	h80: { cellArea: 572, cellTop: 2.5, logo: { cx: 126.2, cy: 86.6, width: 200.4 }, creature: { x: 2178.6, y: 1213.3, scale: 0.82 }, promptY: 540 },
};

/** the variant a release build ships (today's board) */
export const BOARD_SIZE_DEFAULT: BoardSizeKey = 'current';

/** the page's `?board=` value in a DEV build, null in a release build */
const boardParam = (): string | null => {
	if (!import.meta.env.DEV || typeof location === 'undefined') return null;
	return new URLSearchParams(location.search).get('board');
};

const pick = (): BoardSizeKey => {
	const q = boardParam();
	return q === '75' ? 'h75' : q === '80' ? 'h80' : BOARD_SIZE_DEFAULT;
};

export const BOARD_SIZE_KEY: BoardSizeKey = pick();
export const BOARD_SIZE: BoardSizeVariant = BOARD_SIZE_VARIANTS[BOARD_SIZE_KEY];

// ---- PHONE PORTRAIT, round 1 (branch board-phone-r1, 2026-10-16; NOT for merge as is) -------------------------------
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
// The growth k is capped at maxK (a height guard for odd viewports; no phone checked comes near it). The board grows
// UPWARD ONLY: the art's bottom edge stays where the shipped rule puts it on that viewport (layoutSpec frameFor), so
// the spin amount plaque, the spin win readout and the BALANCE / SPIN row keep today's places; the frame's top comes
// closer to the logo and covers more of the creature, who stands behind the board.
// `?board=half` or `?board=off` in a DEV build; a release build ships 'current'. Landscape and phone sideways are
// untouched (the sideways board is limited by the screen's HEIGHT, not by its chains).
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

export const PORTRAIT_BOARD_DEFAULT: PortraitBoardKey = 'current';

const pickPortrait = (): PortraitBoardKey => {
	const q = boardParam();
	return q === 'half' ? 'chainsHalf' : q === 'off' ? 'chainsOff' : PORTRAIT_BOARD_DEFAULT;
};

export const PORTRAIT_BOARD_KEY: PortraitBoardKey = pickPortrait();
export const PORTRAIT_BOARD: PortraitBoardVariant = PORTRAIT_BOARD_VARIANTS[PORTRAIT_BOARD_KEY];
