// THE ROAMING REINDEER'S AREAS (2026-11-17; game/road/roam.ts, constants ROAM). Corey, after the first build: "I was
// kind of hoping not for a specific path the reindeer walks but an allowed to walk area where it randomly chooses where
// to go in that area." Tuned in his mock (roam_2026-11-17/area_mock, corey_area_settings_2026-11-17.json).
//
// One AREA per layout class (landscape = desktop and tablet, phone = held sideways, portrait = upright): a polygon of the
// spots his FEET may stand on. He picks a random spot inside it, walks there, sniffs a while and picks another. A spot is
// never chosen where his body would cover a keep-out zone (the road under his feet, the HUD, the LED strip, the logo, the
// top line) or leave the screen, nor one whose walk there would. `side` is the edge he walks in from and strikes from.
//
// THE CORNERS ARE FRACTIONS OF STABLE ANCHORS, never raw pixels, so an area holds across screen sizes within its class:
//   x  'picture'  share of the road picture's width (0 its left edge, 1 its right edge)
//      'left'     share of the room from the picture's left edge (0) out to the screen's left edge (1)
//      'right'    share of the room from the picture's right edge (0) out to the screen's right edge (1)
//   y  'picture'  share of the road picture's height (0 its top, 1 its bottom)
//      'top'      share of the room from the picture's top (0) up to the screen's top (1)
//      'bottom'   share of the room from the picture's bottom (0) down to the screen's bottom (1)
// Corey's desktop (1440 x 900) and upright (390 x 844) corners were converted from his mock's screen fractions; the phone
// held sideways is mine, in the same spirit (the open snow right of the right tunnel: the top has no room for his body).
// The staging tune panel's "Reindeer area" group edits these live (src/staging/tune/RoamEditor.svelte).
import { ROAD_ART } from './roadArtSpec';
import type { LayoutKind } from './layoutSpec';

export type RoamAnchorX = 'picture' | 'left' | 'right';
export type RoamAnchorY = 'picture' | 'top' | 'bottom';
export type RoamPoint = { ax: RoamAnchorX; x: number; ay: RoamAnchorY; y: number };
export type RoamArea = {
	/** the side he walks in from (and strikes from) */
	side: 'left' | 'right';
	/** the polygon his feet stay inside, in order round its edge (3 corners or more) */
	corners: RoamPoint[];
};

/** the screen in road px (components/Board.svelte: the part of the road's plane the canvas shows) */
export type RoadRect = { left: number; top: number; right: number; bottom: number };

const W = ROAD_ART.image.width;
const H = ROAD_ART.image.height;

export const ROAM_AREAS: Record<LayoutKind, RoamArea> = {
	// Corey's: the whole top snow rim from 17 % to 99 % of the screen's width, and down the right side to 26 % of its height
	landscape: {
		side: 'right',
		corners: [
			{ ax: 'picture', x: 0.0752, ay: 'top', y: 0.4128 },
			{ ax: 'picture', x: 0.9764, ay: 'top', y: 0.4137 },
			{ ax: 'right', x: 0.9296, ay: 'top', y: 0.4328 },
			{ ax: 'right', x: 0.8892, ay: 'picture', y: 0.1827 },
			{ ax: 'right', x: 0.2251, ay: 'picture', y: 0.1025 },
			{ ax: 'right', x: 0.0043, ay: 'picture', y: 0.0209 },
			{ ax: 'picture', x: 0.9184, ay: 'picture', y: 0.0181 },
			{ ax: 'picture', x: 0.8624, ay: 'picture', y: 0.0704 },
			{ ax: 'picture', x: 0.7865, ay: 'picture', y: 0.0662 },
			{ ax: 'picture', x: 0.6882, ay: 'picture', y: 0.0475 },
			{ ax: 'picture', x: 0.5772, ay: 'picture', y: 0.0719 },
			{ ax: 'picture', x: 0.4516, ay: 'picture', y: 0.051 },
			{ ax: 'picture', x: 0.3659, ay: 'picture', y: 0.0772 },
			{ ax: 'picture', x: 0.2662, ay: 'picture', y: 0.0614 },
			{ ax: 'picture', x: 0.1713, ay: 'picture', y: 0.0679 },
			{ ax: 'picture', x: 0.1167, ay: 'picture', y: 0.0502 },
		],
	},
	// mine: the open snow right of the right tunnel, between the Auto / Turbo capsule and the Spin
	phone: {
		side: 'right',
		corners: [
			{ ax: 'right', x: 0.1455, ay: 'picture', y: 0.1643 },
			{ ax: 'right', x: 0.9482, ay: 'picture', y: 0.1643 },
			{ ax: 'right', x: 0.9482, ay: 'picture', y: 0.7515 },
			{ ax: 'right', x: 0.1455, ay: 'picture', y: 0.7515 },
		],
	},
	// Corey's: the snow above the road under the forest, right of the logo
	portrait: {
		side: 'right',
		corners: [
			{ ax: 'picture', x: 0.3612, ay: 'top', y: 0.276 },
			{ ax: 'picture', x: 0.9964, ay: 'top', y: 0.2976 },
			{ ax: 'picture', x: 0.9976, ay: 'picture', y: 0.0109 },
			{ ax: 'picture', x: 0.9176, ay: 'picture', y: 0.0011 },
			{ ax: 'picture', x: 0.8251, ay: 'picture', y: 0.0528 },
			{ ax: 'picture', x: 0.1275, ay: 'picture', y: 0.0502 },
			{ ax: 'picture', x: 0.097, ay: 'top', y: 0.0217 },
			{ ax: 'picture', x: 0.3649, ay: 'top', y: 0.0231 },
		],
	},
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

/** an area read back from JSON (the editor's store or a paste): every class that is a well formed area is taken; anything
 *  else (the old waypoint paths of the first build among them) is left out. Never throws. */
export const roamAreasFrom = (raw: unknown): Partial<Record<LayoutKind, RoamArea>> => {
	const out: Partial<Record<LayoutKind, RoamArea>> = {};
	if (!raw || typeof raw !== 'object') return out;
	for (const kind of ['landscape', 'phone', 'portrait'] as const) {
		const a = (raw as Record<string, unknown>)[kind] as { side?: unknown; corners?: unknown } | undefined;
		if (!a || (a.side !== 'left' && a.side !== 'right') || !Array.isArray(a.corners) || a.corners.length < 3) continue;
		const ok = a.corners.every((c: { ax?: unknown; x?: unknown; ay?: unknown; y?: unknown }) => ['picture', 'left', 'right'].includes(c?.ax as string) && ['picture', 'top', 'bottom'].includes(c?.ay as string) && Number.isFinite(c?.x) && Number.isFinite(c?.y));
		if (ok) out[kind] = { side: a.side, corners: (a.corners as RoamPoint[]).map((c) => ({ ax: c.ax, x: c.x, ay: c.ay, y: c.y })) };
	}
	return out;
};
