// THE ROAMING REINDEER'S PATHS (2026-11-17; game/road/roam.ts, constants ROAM). Corey: "the reindeer is supposed to end
// up being on the screen ... A new reindeer should walk in towards the next spin and stay on the screen doing it's idle
// stuff. So we need to set a path of where it can walk around."
//
// One path per layout class (landscape = desktop and tablet, phone = held sideways, portrait = upright). A path is the
// strike side it lives on, the point it walks in from (just past that screen edge, at `enter`'s height), and its
// waypoints in order: it walks only along the line through them (and from the entry point to the first one), idles at
// a waypoint, and wanders to another one.
//
// THE POINTS ARE FRACTIONS OF STABLE ANCHORS, never raw pixels, so a path holds across screen sizes within its class:
//   x  'picture'  share of the road picture's width (0 its left edge, 1 its right edge)
//      'left'     share of the room from the picture's left edge (0) out to the screen's left edge (1)
//      'right'    share of the room from the picture's right edge (0) out to the screen's right edge (1)
//   y  'picture'  share of the road picture's height (0 its top, 1 its bottom)
//      'top'      share of the room from the picture's top (0) up to the screen's top (1)
//      'bottom'   share of the room from the picture's bottom (0) down to the screen's bottom (1)
// The staging tune panel's "Reindeer path" group edits these live and reads them back as JSON (src/staging/tune/).
// tools/roam_probe.mjs checks the defaults' every point and segment against the HUD, the road, the LED strip, the logo,
// the bonus counter plate and the top line at every probe size.
import { ROAD_ART } from './roadArtSpec';
import type { LayoutKind } from './layoutSpec';

export type RoamAnchorX = 'picture' | 'left' | 'right';
export type RoamAnchorY = 'picture' | 'top' | 'bottom';
export type RoamPoint = { ax: RoamAnchorX; x: number; ay: RoamAnchorY; y: number };
export type RoamPath = {
	/** the side it lives on and enters from: its strike starts toward the board from here */
	side: 'left' | 'right';
	/** the height it walks in at (its x is just past the screen's edge on `side`) */
	enter: { ay: RoamAnchorY; y: number };
	points: RoamPoint[];
};

/** the screen in road px (components/Board.svelte: the part of the road's plane the canvas shows) */
export type RoadRect = { left: number; top: number; right: number; bottom: number };

const W = ROAD_ART.image.width;
const H = ROAD_ART.image.height;

export const ROAM_PATHS: Record<LayoutKind, RoamPath> = {
	// desktop and tablet: the snow on the trench's top rim at the right and over the right tunnel's end, right of the bonus
	// counter plate and under the top line (16:9 leaves only a little snow above the rim: the feet stay on the rim's snow)
	landscape: {
		side: 'right',
		enter: { ay: 'picture', y: 0.096 },
		points: [
			{ ax: 'right', x: 0.45, ay: 'picture', y: 0.096 },
			{ ax: 'picture', x: 0.938, ay: 'picture', y: 0.096 },
			{ ax: 'picture', x: 0.86, ay: 'picture', y: 0.092 },
			{ ax: 'picture', x: 0.782, ay: 'picture', y: 0.097 },
		],
	},
	// held sideways: the open snow right of the right tunnel, between the Auto / Turbo capsule and the Spin
	phone: {
		side: 'right',
		enter: { ay: 'picture', y: 0.34 },
		points: [
			{ ax: 'right', x: 0.79, ay: 'picture', y: 0.34 },
			{ ax: 'right', x: 0.52, ay: 'picture', y: 0.355 },
			{ ax: 'right', x: 0.25, ay: 'picture', y: 0.34 },
		],
	},
	// upright: the snow above the road, right of the billboard logo, under the forest
	portrait: {
		side: 'right',
		enter: { ay: 'picture', y: -0.135 },
		points: [
			{ ax: 'picture', x: 0.9, ay: 'picture', y: -0.135 },
			{ ax: 'picture', x: 0.72, ay: 'picture', y: -0.11 },
			{ ax: 'picture', x: 0.54, ay: 'picture', y: -0.145 },
		],
	},
};

/** the defaults as shipped (the editor's Reset and the probe's reference) */
export const ROAM_PATHS_DEFAULT: Record<LayoutKind, RoamPath> = JSON.parse(JSON.stringify(ROAM_PATHS));

/** the paths' edit count: the editor bumps it after a change, the roamer re-reads its points when it moves */
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
