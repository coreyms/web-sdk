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
import { ROAM_AREAS } from './roamPaths';
import { forestBox, type RoadRect } from './scene/forestPlace';
import { FOREST_LINE } from './forestLineSpec';
import { forestOn, sceneFit } from '../ui/sign/signLayout';

/** the asphalt's band in road px (the road picture's own: from under its top snow rim to its bottom rim): the roaming
 *  reindeer's feet never go there */
export const ROAM_ROAD = { top: 120, bottom: 905 } as const;
/** his feet stay this many road px under the forest's tree line (game/road/roam.ts) */
export const ROAM_TREE_PAD = 6;

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
		if (Number.isFinite(low)) treeY = oy + low * k;
	}
	// the lower edge of his area above the board: the lowest corner of its edge along the top snow rim, and never on the
	// asphalt (the sideways and desktop areas are drawn down to the rim's foot and past it: the asphalt's top is the line)
	const rim = Math.min(ROAM_ROAD.top, Math.max(...ROAM_AREAS[kind].corners.filter((c) => c.y < ROAM_ROAD.top + 80).map((c) => c.y)));
	return { k, ox, oy, rect, forest, treeY, top: treeY === null ? 0 : treeY + ROAM_TREE_PAD * k, bottom: oy + rim * k, roadY: oy + ROAM_ROAD.top * k };
};
