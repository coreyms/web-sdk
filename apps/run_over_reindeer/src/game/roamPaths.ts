// THE ROAMING REINDEER'S AREAS (2026-11-17; game/road/roam.ts, constants ROAM). Corey, after the first build: "I was
// kind of hoping not for a specific path the reindeer walks but an allowed to walk area where it randomly chooses where
// to go in that area." Tuned in his mock (roam_2026-11-17/area_mock, corey_area_settings_2026-11-17.json).
//
// One AREA per layout class (landscape = desktop and tablet, phone = held sideways, portrait = upright): a polygon of the
// spots his FEET may stand on. He picks a random spot inside it, walks there, sniffs a while and picks another. A spot is
// never chosen where his body would cover a keep-out zone (the road under his feet, the HUD, the LED strip, the logo, the
// top line) or leave the screen, nor one whose walk there would. `side` is the edge he walks in from and strikes from.
//
// ROUND 4 (Corey on staging: at a 2000 x 945 window "the Reindeer just moves around in the corner back and forth between
// two spots"): the corners are in ROAD PX, the scene's own coordinates (the road picture's 1536 x 1024 art; negative or
// past 1536 = the snow beyond it), so the area stays on the same snow of the art at every window shape. Round 3 stored
// them as fractions of the screen's room beyond the art: a wider or shorter window stretched them off the snow (the right
// side ran off the screen, the top band rose above it) and left a sliver in the corner. `beyond`: the snow past the art's
// sides (past the tunnels) is allowed ground too, as far as the window shows it (a wide window gets more of it).
// Corey's desktop corners (drawn at 1440 x 900) and upright ones (390 x 844), and my sideways ones (844 x 390), were
// converted at the size they were drawn at: there they are unchanged (to the rounding, 0.1 road px).
// The staging tune panel's "Reindeer area" group edits these live (src/staging/tune/RoamEditor.svelte).
import { ROAD_ART } from './roadArtSpec';
import type { LayoutKind } from './layoutSpec';

/** a corner, road px (the scene's coordinates) */
export type RoamCorner = { x: number; y: number };
export type RoamArea = {
	/** the side he walks in from (and strikes from) */
	side: 'left' | 'right';
	/** the polygon his feet stay inside, in order round its edge (3 corners or more), road px */
	corners: RoamCorner[];
	/** the snow past the art's left and right edges (beyond the tunnels) is allowed ground too, as far as the window
	 *  shows it */
	beyond: boolean;
};

/** round 3's corners (fractions of anchors: the picture, or the screen's room beyond it), read only to convert an old
 *  saved area */
export type RoamAnchorX = 'picture' | 'left' | 'right';
export type RoamAnchorY = 'picture' | 'top' | 'bottom';
export type RoamPoint = { ax: RoamAnchorX; x: number; ay: RoamAnchorY; y: number };

/** the screen in road px (components/Board.svelte: the part of the road's plane the canvas shows) */
export type RoadRect = { left: number; top: number; right: number; bottom: number };

const W = ROAD_ART.image.width;
const H = ROAD_ART.image.height;

export const ROAM_AREAS: Record<LayoutKind, RoamArea> = {
	// Corey's (drawn at 1440 x 900): the whole top snow rim, and down the right side
	landscape: {
		side: 'right',
		beyond: true,
		corners: [
			{ x: 115.5, y: -59.4 },
			{ x: 1499.8, y: -59.5 },
			{ x: 1752.6, y: -62.3 },
			{ x: 1743.2, y: 187.1 },
			{ x: 1588.5, y: 104.9 },
			{ x: 1537.0, y: 21.4 },
			{ x: 1410.7, y: 18.6 },
			{ x: 1324.6, y: 72.1 },
			{ x: 1208.1, y: 67.7 },
			{ x: 1057.1, y: 48.6 },
			{ x: 886.5, y: 73.6 },
			{ x: 693.7, y: 52.2 },
			{ x: 562.0, y: 79.0 },
			{ x: 408.8, y: 62.9 },
			{ x: 263.1, y: 69.5 },
			{ x: 179.2, y: 51.4 },
		],
	},
	// mine (844 x 390): the open snow right of the right tunnel, between the Auto / Turbo capsule and the Spin
	phone: {
		side: 'right',
		beyond: true,
		corners: [
			{ x: 1606.3, y: 168.2 },
			{ x: 1994.1, y: 168.2 },
			{ x: 1994.1, y: 769.5 },
			{ x: 1606.3, y: 769.5 },
		],
	},
	// Corey's (drawn at 390 x 844): the snow above the road under the forest, right of the logo
	portrait: {
		side: 'right',
		beyond: false,
		corners: [
			{ x: 554.8, y: -390.7 },
			{ x: 1530.5, y: -421.3 },
			{ x: 1532.3, y: 11.1 },
			{ x: 1409.4, y: 1.2 },
			{ x: 1267.4, y: 54.0 },
			{ x: 195.8, y: 51.4 },
			{ x: 149.0, y: -30.7 },
			{ x: 560.5, y: -32.7 },
		],
	},
};

/** the window each class's round 3 corners were drawn at (their screen in road px): an old saved area converts there */
export const ROAM_REF_RECT: Record<LayoutKind, RoadRect> = {
	landscape: { left: -233.0577, top: -143.8493, right: 1769.0577, bottom: 1107.4497 },
	phone: { left: -483.1755, top: -63.0221, right: 2019.1755, bottom: 1093.2721 },
	portrait: { left: 0, top: -1415.5463, right: 1536, bottom: 1908.5463 },
};

/** the defaults as shipped (the editor's Reset and the probe's reference) */
export const ROAM_AREAS_DEFAULT: Record<LayoutKind, RoamArea> = JSON.parse(JSON.stringify(ROAM_AREAS));

/** the areas' edit count: the editor bumps it after a change, the roamer re-reads its corners */
export const ROAM_EDIT = { version: 0 };

/** a point's x in road px for this screen */
export const roamX = (ax: RoamAnchorX, x: number, r: RoadRect): number => (ax === 'picture' ? x * W : ax === 'left' ? x * r.left : W + x * (r.right - W));
/** a point's y in road px for this screen */
export const roamY = (ay: RoamAnchorY, y: number, r: RoadRect): number => (ay === 'picture' ? y * H : ay === 'top' ? y * r.top : H + y * (r.bottom - H));

/** the fraction of an anchor that puts a point at road x (the editor's drag keeps a point's anchors) */
export const roamFracX = (ax: RoamAnchorX, x: number, r: RoadRect): number => {
	const v = ax === 'picture' ? x / W : ax === 'left' ? (Math.abs(r.left) > 1e-6 ? x / r.left : 0) : Math.abs(r.right - W) > 1e-6 ? (x - W) / (r.right - W) : 0;
	return Math.round(v * 10000) / 10000;
};
/** the fraction of an anchor that puts a point at road y */
export const roamFracY = (ay: RoamAnchorY, y: number, r: RoadRect): number => {
	const v = ay === 'picture' ? y / H : ay === 'top' ? (Math.abs(r.top) > 1e-6 ? y / r.top : 0) : Math.abs(r.bottom - H) > 1e-6 ? (y - H) / (r.bottom - H) : 0;
	return Math.round(v * 10000) / 10000;
};

/** a point at road px (x, y) on this screen, as fractions of the anchors it lies in (a new point with no anchors yet). A point inside
 *  the picture's span takes the picture; outside, the room between the picture and that screen edge. */
export const roamPointAt = (x: number, y: number, r: RoadRect): RoamPoint => {
	const round = (v: number) => Math.round(v * 10000) / 10000;
	let ax: RoamAnchorX = 'picture';
	let fx = x / W;
	if (x < 0 && r.left < -1) {
		ax = 'left';
		fx = x / r.left;
	} else if (x > W && r.right > W + 1) {
		ax = 'right';
		fx = (x - W) / (r.right - W);
	}
	let ay: RoamAnchorY = 'picture';
	let fy = y / H;
	if (y < 0 && r.top < -1) {
		ay = 'top';
		fy = y / r.top;
	} else if (y > H && r.bottom > H + 1) {
		ay = 'bottom';
		fy = (y - H) / (r.bottom - H);
	}
	return { ax, x: round(fx), ay, y: round(fy) };
};

/** an area read back from JSON (the editor's store or a paste): every class that is a well formed area is taken, in
 *  road px corners or round 3's anchored ones (converted at the window they were drawn at); anything else (the first
 *  build's waypoint paths among them) is left out. Never throws. */
export const roamAreasFrom = (raw: unknown): Partial<Record<LayoutKind, RoamArea>> => {
	const out: Partial<Record<LayoutKind, RoamArea>> = {};
	if (!raw || typeof raw !== 'object') return out;
	for (const kind of ['landscape', 'phone', 'portrait'] as const) {
		const a = (raw as Record<string, unknown>)[kind] as { side?: unknown; corners?: unknown; beyond?: unknown } | undefined;
		if (!a || (a.side !== 'left' && a.side !== 'right') || !Array.isArray(a.corners) || a.corners.length < 3) continue;
		const list = a.corners as Record<string, unknown>[];
		const plain = list.every((c) => Number.isFinite(c?.x) && Number.isFinite(c?.y) && c.ax === undefined);
		const anchored = list.every((c) => ['picture', 'left', 'right'].includes(c?.ax as string) && ['picture', 'top', 'bottom'].includes(c?.ay as string) && Number.isFinite(c?.x) && Number.isFinite(c?.y));
		if (!plain && !anchored) continue;
		const R = ROAM_REF_RECT[kind];
		const round = (v: number) => Math.round(v * 10) / 10;
		const corners = list.map((c) => (plain ? { x: c.x as number, y: c.y as number } : { x: round(roamX(c.ax as RoamAnchorX, c.x as number, R)), y: round(roamY(c.ay as RoamAnchorY, c.y as number, R)) }));
		out[kind] = { side: a.side, corners, beyond: typeof a.beyond === 'boolean' ? a.beyond : ROAM_AREAS_DEFAULT[kind].beyond };
	}
	return out;
};
