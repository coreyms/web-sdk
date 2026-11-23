// THE ROAMING REINDEER'S GROUND ON A PHONE (2026-11-23, with Corey's round 3 phone layout). Corey: "is that agent going
// to remap the reindeers walking area so it's below the tree lines, and above the board area for phones, where the baord
// and treeline where moved?"
//
// It is, by construction, and this file is where that is written down and checked:
//   - his area (game/roamPaths.ts ROAM_AREAS) is in ROAD px, the road picture's own coordinates. The board with its LED
//     strip is the road: where Corey moved the board (ui/sign/signLayout.ts sceneFit boardDy, through
//     game/layoutSpec.ts roadPlacement) the area, his bed, his walk in edge, his standing spots, his shadow, the places
//     he strikes from, the tunnel mouths and the snow under his feet all move with it, to the px.
//   - the tree line is the drawn forest's (game/scene/forestPlace.ts): the forest is placed by the road's OWN place and
//     then takes Corey's own move of the tree line (sceneFit treeDy), and the roamer reads the forest as drawn
//     (game/road/roam.ts refreshTrees), so his feet stay under the trees wherever they were moved to.
//   - under a key: every key's box is a keep-out (components/Board.svelte roamZones), read from the page.
// UPRIGHT (a tree line is drawn): his ground is the strip from the tree line (plus the roamer's TREE_PAD) down to his
// area's lower edge, the snow rim above the board's first lane. SIDEWAYS (no tree line): the top of his ground is the
// window's top edge (his whole body stays on the screen) and the top line's text; below, the same snow rim, and the snow
// right of the right tunnel down to his area's foot above the Spin.
// roamGround gives those lines in CSS px for a window, from the same rules the canvas is laid out with: the node test
// (tools/sign_layout_test.mjs) holds the strip at every swept window, and tools/roam_probe.mjs compares it with the
// live scene.
import { MASTER, roadPlacement, type LayoutKind } from './layoutSpec';
import { ROAM_AREAS, ROAM_TUNNEL_MOUTH, type RoamArea, type RoamCorner } from './roamPaths';
import { forestBox, type RoadRect } from './scene/forestPlace';
import { FOREST_LINE } from './forestLineSpec';
import { forestOn, sceneFit } from '../ui/sign/signLayout';

/** the asphalt's band in road px (the road picture's own: from under its top snow rim to its bottom rim): the roaming
 *  reindeer's feet never go there */
export const ROAM_ROAD = { top: 120, bottom: 905 } as const;
/** his feet stay this many road px under the forest's tree line (game/road/roam.ts) */
export const ROAM_TREE_PAD = 6;

// ---- THE SHORT UPRIGHT GROUND (2026-11-25; Corey drew it in red on Decimus's annotated 413 x 586 still: "Look at my
// shape") -------------------------------------------------------------------------------------------------------------
// WHY HE NEVER CAME THERE (Decimus on 49c95c03: no roamer in two minutes at 413 x 586 and 375 x 530; the floor 2 spots,
// span 0.12). On a short upright page the forest stands low over the road: its tree line at road y 4 to 16, under the
// right tunnel mouth's top (road y 11.9). Under the old rule his feet stayed under the tree line plus ROAM_TREE_PAD, so his
// ground was a strip 8.6 CSS px tall (161.1 to 169.7 at 413 x 586), and that strip ran into the mouth's keep-out at his
// side: no walk in from past the right edge reached it, behind the Fast Lane sign or not, and his first appearance is a
// walk in (game/road/roam.ts update). Inside the strip his keep-out box (29 CSS px each side of his feet, 45 up, his
// shadow's lean 41 px more to the left) fitted only between the logo's box and the Fast Lane key (feet x 213 to 272):
// 2 spots 12 % of the width apart, and the floor widened his area to the free snow elsewhere, with still no way in.
// HIS SHAPE: the snow in front of the trees. The TOP edge follows the snow mounds at the trees' feet (they are in the
// forest picture: the line moves with the forest), up to 25 CSS px over the tree line; the BOTTOM edge is the top of the
// wall's snow cap (the road picture's: road px); at his side the bottom edge notches up over the tunnel mouth's arch, so
// he comes in above the arch, behind the Fast Lane sign (Corey 2026-11-24: "Let him pass under the sign"). Both edges
// are the inner edges of his red stroke, traced at 413 x 586 (CSS px to road px by that window's k 0.26888 and oy 155.18).
// Where it applies: an upright page with a tree line whose foot (plus ROAM_TREE_PAD) leaves under `gap` road px of snow
// above the mouth's top (the old strip had no way past the mouth). Elsewhere nothing changes (tools/roam_ground_test.mjs
// holds the other windows' ground unchanged).
export const ROAM_SHORT = {
	/** road px of snow above the mouth's top the old strip must leave, or the short ground applies */
	gap: 4,
	/** the forest as drawn at 413 x 586, road px (scene/forestPlace.ts forestBox): the top edge is stored at it */
	refForest: { x: 0, y: -1122.6, width: 1536, height: 1182.6 },
	/** the top edge, left to right, road px at refForest (it moves and stretches with the forest) */
	top: [
		{ x: 343, y: 49.6 },
		{ x: 366.7, y: 26.6 },
		{ x: 390.5, y: 5.8 },
		{ x: 426.1, y: -7.6 },
		{ x: 449.9, y: 1.3 },
		{ x: 485.5, y: 16.2 },
		{ x: 497.4, y: 20.6 },
		{ x: 604.3, y: 20.6 },
		{ x: 640, y: 11.7 },
		{ x: 687.4, y: -1.6 },
		{ x: 746.8, y: -20.9 },
		{ x: 770.5, y: -25.3 },
		{ x: 829.9, y: -25.3 },
		{ x: 865.6, y: -43.1 },
		{ x: 925, y: -69.8 },
		{ x: 948.7, y: -41.7 },
		{ x: 972.5, y: -20.9 },
		{ x: 1008.1, y: -4.6 },
		{ x: 1031.9, y: 2.8 },
		{ x: 1067.5, y: 7.3 },
		{ x: 1103.1, y: 11.7 },
		{ x: 1150.6, y: 17.7 },
		{ x: 1174.4, y: 20.6 },
		{ x: 1186.3, y: 20.6 },
		{ x: 1198.1, y: 14.7 },
		{ x: 1221.9, y: 1.3 },
		{ x: 1257.5, y: -9 },
		{ x: 1305, y: -22.4 },
		{ x: 1340.7, y: -34.2 },
		{ x: 1447.6, y: -34.2 },
		{ x: 1471.3, y: -26.8 },
		{ x: 1507, y: -16.5 },
		{ x: 1536, y: -12 },
	] as RoamCorner[],
	/** the bottom edge, right to left, road px (the wall's snow cap; the notch over the right mouth's arch) */
	bottom: [
		{ x: 1536, y: 65 },
		{ x: 1518.8, y: 48.8 },
		{ x: 1495.1, y: 31 },
		{ x: 1471.3, y: 14.7 },
		{ x: 1447.6, y: -1.6 },
		{ x: 1423.8, y: 4.3 },
		{ x: 1400.1, y: 19.1 },
		{ x: 1376.3, y: 47.3 },
		{ x: 1340.7, y: 57.7 },
		{ x: 1305, y: 68.1 },
		{ x: 1269.4, y: 74 },
		{ x: 1233.8, y: 79.9 },
		{ x: 1126.9, y: 79.9 },
		{ x: 1091.2, y: 72.5 },
		{ x: 1055.6, y: 65.1 },
		{ x: 1031.9, y: 59.2 },
		{ x: 996.2, y: 60.7 },
		{ x: 960.6, y: 63.6 },
		{ x: 877.4, y: 71 },
		{ x: 818.1, y: 62.1 },
		{ x: 770.5, y: 60.7 },
		{ x: 746.8, y: 63.6 },
		{ x: 699.3, y: 68.1 },
		{ x: 663.7, y: 71 },
		{ x: 509.2, y: 71 },
		{ x: 461.7, y: 66.6 },
		{ x: 426.1, y: 62.1 },
		{ x: 390.5, y: 59.2 },
		{ x: 354.8, y: 50.3 },
	] as RoamCorner[],
};
/** the right tunnel mouth's top, road px (the highest point of its keep-out) */
const MOUTH_TOP = Math.min(...ROAM_TUNNEL_MOUTH.map((p) => p.y));

export type ForestBox = { x: number; y: number; width: number; height: number };

/** the forest's lowest tree row over the screen's columns (road px; every kit's line, as the scene keeps one place through
 *  a swap), or -Infinity where none shows */
export const forestLow = (forest: ForestBox, rect: RoadRect): number => {
	let low = -Infinity;
	for (const kit of Object.values(FOREST_LINE)) {
		const line = kit.line as readonly number[];
		for (let i = 0; i < line.length; i++) {
			const a = forest.x + (forest.width * i) / line.length;
			const b = forest.x + (forest.width * (i + 1)) / line.length;
			if (b <= rect.left || a >= rect.right) continue;
			low = Math.max(low, forest.y + forest.height * line[i]);
		}
	}
	return low;
};

/** does the short upright ground apply: the old strip under a tree line whose lowest row is at road y `low` leaves under
 *  ROAM_SHORT.gap road px above the tunnel mouth's top */
export const roamShortOn = (low: number): boolean => Number.isFinite(low) && low + ROAM_TREE_PAD > MOUTH_TOP - ROAM_SHORT.gap;

/** Corey's top edge for the forest as drawn now (road px, left to right) */
export const roamShortTop = (forest: ForestBox): RoamCorner[] => {
	const R = ROAM_SHORT.refForest;
	return ROAM_SHORT.top.map((p) => ({ x: forest.x + ((p.x - R.x) / R.width) * forest.width, y: forest.y + ((p.y - R.y) / R.height) * forest.height }));
};

/** his short ground as an area (road px): the top edge, then the bottom edge back; he walks in from the right */
export const roamShortArea = (forest: ForestBox): RoamArea => ({ side: 'right', beyond: false, corners: [...roamShortTop(forest), ...ROAM_SHORT.bottom.map((p) => ({ ...p }))] });

/** the highest his feet may stand over road x0 to x1 under the top edge: its lowest point there (NaN where the edge does
 *  not reach) */
export const roamShortLimit = (top: RoamCorner[], x0: number, x1: number): number => {
	let y = NaN;
	const at = (x: number) => {
		for (let i = 0; i + 1 < top.length; i++) {
			const a = top[i];
			const b = top[i + 1];
			if (x >= a.x && x <= b.x) return b.x - a.x > 1e-9 ? a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x) : Math.max(a.y, b.y);
		}
		return NaN;
	};
	const take = (v: number) => {
		if (Number.isFinite(v)) y = Number.isFinite(y) ? Math.max(y, v) : v;
	};
	take(at(Math.max(x0, top[0].x)));
	take(at(Math.min(x1, top[top.length - 1].x)));
	for (const p of top) if (p.x > x0 && p.x < x1) take(p.y);
	return x1 <= top[0].x || x0 >= top[top.length - 1].x ? NaN : y;
};

export type RoamGround = {
	/** the road's plane on the screen: CSS px per road px, the picture's top left corner (CSS px), the screen in road px */
	k: number;
	ox: number;
	oy: number;
	rect: RoadRect;
	/** the forest as drawn (road px), or null where no tree line is drawn */
	forest: { x: number; y: number; width: number; height: number } | null;
	/** CSS px from the window's top: the tree line's lowest point over the window (null: none), the highest his feet may
	 *  stand under it, the lower edge of his area above the board (the snow rim), the asphalt's top */
	treeY: number | null;
	top: number;
	bottom: number;
	roadY: number;
	/** the short upright ground applies (ROAM_SHORT): `top` is then the highest point of Corey's top edge over the window
	 *  and `bottom` the lowest of his bottom edge */
	short: boolean;
};

export const roamGround = (kind: LayoutKind, vw: number, vh: number, phoneSize: boolean): RoamGround => {
	const M = MASTER[kind];
	const scale = Math.min(vw / M.width, vh / M.height);
	const view = { masterWidth: vw / scale, masterHeight: vh / scale, vw, vh };
	const place = roadPlacement(kind, view);
	const left = vw / 2 - (M.width * scale) / 2;
	const top = vh / 2 - (M.height * scale) / 2;
	const k = place.scale * scale;
	const ox = left + place.x * scale;
	const oy = top + place.y * scale;
	const rect = { left: -ox / k, top: -oy / k, right: (vw - ox) / k, bottom: (vh - oy) / k };
	const fit = sceneFit(kind, vw, vh);
	// the forest: by the road's own place (his move of the board taken out), then his own move of the tree line
	let forest: RoamGround['forest'] = null;
	let treeY: number | null = null;
	if (forestOn(kind, vw, vh, phoneSize)) {
		const oyOwn = oy - fit.boardDy;
		const f = forestBox({ ...rect, top: -oyOwn / k, bottom: (vh - oyOwn) / k });
		forest = { ...f, y: f.y + (fit.treeDy - fit.boardDy) / k };
		const low = forestLow(forest, rect);
		if (Number.isFinite(low)) treeY = oy + low * k;
	}
	// THE SHORT UPRIGHT GROUND (ROAM_SHORT): Corey's band, its top edge's highest point over the window and its bottom
	// edge's lowest
	const short = kind === 'portrait' && forest !== null && treeY !== null && roamShortOn((treeY - oy) / k);
	if (short && forest) {
		const T = roamShortTop(forest).filter((p) => p.x >= rect.left && p.x <= rect.right);
		const B = ROAM_SHORT.bottom.filter((p) => p.x >= rect.left && p.x <= rect.right);
		return { k, ox, oy, rect, forest, treeY, top: oy + Math.min(...T.map((p) => p.y)) * k, bottom: oy + Math.min(ROAM_ROAD.top, Math.max(...B.map((p) => p.y))) * k, roadY: oy + ROAM_ROAD.top * k, short };
	}
	// the lower edge of his area above the board: the lowest corner of its edge along the top snow rim, and never on the
	// asphalt (the sideways and desktop areas are drawn down to the rim's foot and past it: the asphalt's top is the line)
	const rim = Math.min(ROAM_ROAD.top, Math.max(...ROAM_AREAS[kind].corners.filter((c) => c.y < ROAM_ROAD.top + 80).map((c) => c.y)));
	return { k, ox, oy, rect, forest, treeY, top: treeY === null ? 0 : treeY + ROAM_TREE_PAD * k, bottom: oy + rim * k, roadY: oy + ROAM_ROAD.top * k, short };
};
