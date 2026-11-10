// Design master coordinates. Both the PixiJS scene and the HTML chrome (ui/Chrome.svelte) are authored in these
// units and scaled uniformly to the viewport, so a coordinate here lands on the same pixel in both layers.
//
// Three layouts, as in every house game: desktop landscape, phone held sideways, portrait.
//
// THE ROAD. The board is one picture drawn in "road px" (the 1536 x 1024 background, game/roadArtSpec.ts): the
// background, the lanes, the symbols and the tunnel portals. Each layout says only how wide that picture is drawn
// in master units and where its centre sits (ROAD_LAYOUT, roadPlacement). Nothing else about the board is per layout.
import { ROAD_ART } from './roadArtSpec';

export type LayoutKind = 'landscape' | 'portrait' | 'phone';

export const MASTER: Record<LayoutKind, { width: number; height: number }> = {
	landscape: { width: 1280, height: 720 },
	portrait: { width: 412, height: 760 },
	// Phone held sideways (layoutType 'landscape': ratio >= 1.3 AND device width <= 480).
	phone: { width: 1480, height: 740 },
};

// desktop -> the 1280x720 landscape master; phone sideways -> the wide phone master.
export const layoutKind = (layoutType: 'desktop' | 'landscape' | 'portrait' | 'tablet'): LayoutKind => {
	if (layoutType === 'portrait' || layoutType === 'tablet') return 'portrait';
	return layoutType === 'landscape' ? 'phone' : 'landscape';
};

/** a portrait screen is a phone (short side at most 480 CSS px) by utils-layout's size class, else a tablet */
export const isPhoneSizeType = (sizeType: string) => sizeType === 'smallMobile' || sizeType === 'mobile';

// ---- THE TALLER DESKTOP SCREENS (the house HUD rule, unchanged) ---------------------------------------------------------
// On a desktop screen narrower than 16:9 the master is fitted by WIDTH, so the screen shows `extra` master units of
// canvas above the master and as many below it (40 each at 16:10). The HUD's bottom row rides down by `extra` to the
// screen's bottom edge (ui/Chrome.svelte --vp-extra-bottom). The growth stops at 3:2.
export const LANDSCAPE_TALL = { minAspect: 1.5, minExtra: 0.5 };

let landscapeViewport: (() => number) | null = null;
export const setLandscapeViewportSource = (source: () => number) => {
	landscapeViewport = source;
};

/** the master units of canvas the desktop screen shows above the master and as many below it: 0 at 16:9 and wider */
export const landscapeExtraY = (masterHeight: number | null = landscapeViewport?.() ?? null) => {
	if (masterHeight === null) return 0;
	const M = MASTER.landscape;
	const most = (M.width / LANDSCAPE_TALL.minAspect - M.height) / 2;
	const extra = Math.min((masterHeight - M.height) / 2, most);
	return extra < LANDSCAPE_TALL.minExtra ? 0 : extra;
};

/** the live portrait viewport: the master width and height the screen shows (the 412 x 760 master plus the side
 *  room of a tablet and the letterbox the HUD rides down into). game/stateLayout.ts sets the source. */
export type PortraitViewport = { masterWidth: number; masterHeight: number };
let portraitViewport: (() => PortraitViewport) | null = null;
export const setPortraitViewportSource = (source: () => PortraitViewport) => {
	portraitViewport = source;
};

// ---- THE ROAD'S PLACE PER LAYOUT ----------------------------------------------------------------------------------------
// width: the background picture's width in master units (so one road px is width / 1536 master units).
// centreX / centreY: where the picture's centre sits in the master.
//   landscape  the picture covers the 16:9 master's height with a hair to spare (736 of 720), so its top and bottom
//              edges are off the screen; the lanes run y 104 to 596, clear of the HUD's bottom row (top 610). The board
//              is 898 of the 1280 wide. Left and right of the picture is flat snow (the desktop overpass art is not made).
//   phone      the board stands between the HUD's two side columns (340 master units each): the five columns span
//              340 to 1140 exactly, the portals stand under the columns' inner edges.
//   portrait   the picture spans the screen's width (see roadPlacement), centred in the band between the title and
//              the BALANCE row.
export const ROAD_LAYOUT = {
	landscape: { width: 1104, centreX: 640, centreY: 352 },
	phone: { width: 983, centreX: 740, centreY: 368 },
	portrait: {
		/** the picture is never drawn wider than this (tablets), master units */
		maxWidth: 560,
		/** the free band: from under the title to the BALANCE / SPIN row's top (which rides down with the letterbox) */
		bandTop: 150,
		hudTop: 622,
		/** where the road's centre sits in that band, 0 = top, 1 = bottom */
		bandShare: 0.47,
	},
};

/** where the road picture is drawn for a layout: `scale` master units per road px, and the master position of the
 *  picture's top left corner. Reactive: a $derived that calls it follows a resize (the viewport sources). */
export const roadPlacement = (kind: LayoutKind) => {
	const img = ROAD_ART.image;
	let width: number;
	let cx: number;
	let cy: number;
	if (kind === 'portrait') {
		const P = ROAD_LAYOUT.portrait;
		const view = portraitViewport?.() ?? { masterWidth: MASTER.portrait.width, masterHeight: MASTER.portrait.height };
		width = Math.min(Math.max(view.masterWidth, MASTER.portrait.width), P.maxWidth);
		cx = MASTER.portrait.width / 2;
		const hudTop = P.hudTop + Math.max(0, (view.masterHeight - MASTER.portrait.height) / 2);
		cy = P.bandTop + (hudTop - P.bandTop) * P.bandShare;
	} else {
		const L = ROAD_LAYOUT[kind];
		width = L.width;
		cx = L.centreX;
		cy = L.centreY;
	}
	const scale = width / img.width;
	return { scale, x: cx - (img.width * scale) / 2, y: cy - (img.height * scale) / 2, width, height: img.height * scale };
};

/** the five columns' rectangle (lane 1's top line to lane 4's bottom line) in master units */
export const boardRect = (kind: LayoutKind) => {
	const p = roadPlacement(kind);
	const b = ROAD_ART.board;
	const lines = ROAD_ART.laneLines;
	const x = p.x + b.x * p.scale;
	const y = p.y + lines[0] * p.scale;
	const width = b.width * p.scale;
	const height = (lines[lines.length - 1] - lines[0]) * p.scale;
	return { x, y, width, height, right: x + width, bottom: y + height };
};

// ---- THE HUD'S READOUT ROW (desktop) --------------------------------------------------------------------------------------
/** the landscape HUD's readout row (BALANCE / WIN / SPIN) is keyed to the board's edges, but never closer than this
 *  to the button clusters (master units), as in Manticore: left = the [Feature, Menu] cluster's right edge + 20;
 *  right = the [Auto / Turbo, Spin] cluster's left edge - 16. */
export const TRIO_CLEAR = { left: 234, right: 1026 };

export const landscapeTrioSpan = () => {
	const a = boardRect('landscape');
	const x0 = Math.max(a.x, TRIO_CLEAR.left);
	const x1 = Math.min(a.right, TRIO_CLEAR.right);
	return { x: x0, width: x1 - x0 };
};

/** THE PHONE HUD'S SIDE COLUMNS (phone held sideways): the HTML chrome keeps its title, the BALANCE / WIN / SPIN
 *  stack and the button clusters inside a column this wide at each end of the 1480 master. */
export const PHONE_SIDE_COLUMN = 340;

// ---- THE TITLE (placeholder: a highway sign drawn in CSS, ui/TitleSign.svelte) ----------------------------------------------
// The box the title sign is fitted into, master units. Portrait centres on the screen's centre line.
export const TITLE: Record<LayoutKind, { x: number; y: number; width: number; height: number; lines: 1 | 2 }> = {
	landscape: { x: 440, y: 20, width: 400, height: 50, lines: 1 },
	phone: { x: 34, y: 50, width: 204, height: 96, lines: 2 },
	portrait: { x: 96, y: 44, width: 220, height: 92, lines: 2 },
};
