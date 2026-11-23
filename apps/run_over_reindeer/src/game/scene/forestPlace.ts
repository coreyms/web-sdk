// WHERE THE FOREST AND ITS TREE LINE STAND (the rule game/scene/sceneLayers.ts draws by, components/Board.svelte seats
// the billboard logo by, and the roaming reindeer's ground is read from: game/roamGround.ts). Pure: no canvas, so the
// node tests read the same rule (tools/sign_layout_test.mjs).
import { SCENE } from '../constants';
import { SCENE_ART } from '../sceneArtSpec';
import { FOREST_LINE } from '../forestLineSpec';

const IMG = { width: 1536, height: 1024 };
const FOREST_ASPECT = SCENE_ART.snowDay.forest.aspect;

/** the part of the road's plane the screen shows, road px */
export type RoadRect = { left: number; top: number; right: number; bottom: number };

/** the forest's bottom edge (road px from the picture's top) for `snow` road px of snow above the picture (SCENE.forest) */
export const forestBottom = (rect: RoadRect, width: number): number => {
	const F = SCENE.forest;
	const [a, b] = F.anchors;
	const snow = -rect.top;
	const t = (snow - a.snow) / (b.snow - a.snow);
	let bottom = a.bottom + (b.bottom - a.bottom) * t;
	// the trees always run off the top of the screen, and never far into the picture
	const height = width * FOREST_ASPECT;
	bottom = Math.min(bottom, rect.top - F.topSpare + height, F.maxBelow);
	return bottom;
};

/** WHERE THE FOREST IS DRAWN on an upright phone (road px): the screen's width or the picture's, whichever is wider,
 *  its bottom by forestBottom. The one rule for the scene below, the roaming reindeer's tree line (the drawn forest) and
 *  the billboard logo's foot (forestLineY). */
export const forestBox = (rect: RoadRect) => {
	const width = Math.max(IMG.width, rect.right - rect.left);
	const height = width * FOREST_ASPECT;
	const bottom = forestBottom(rect, width);
	return { x: IMG.width / 2 - width / 2, y: bottom - height, width, height };
};

/** THE TREE LINE over x0 to x1 (road px) of the forest drawn for `rect`: the lowest tree pixel there, of every kit's
 *  forest (game/forestLineSpec.ts), so what stands on it keeps one place through a scene swap. -Infinity: none there */
export const forestLineY = (rect: RoadRect, x0: number, x1: number): number => {
	const f = forestBox(rect);
	let y = -Infinity;
	for (const kit of Object.values(FOREST_LINE)) {
		const line = kit.line as readonly number[];
		for (let i = 0; i < line.length; i++) {
			const a = f.x + (f.width * i) / line.length;
			const b = f.x + (f.width * (i + 1)) / line.length;
			if (b <= x0 || a >= x1) continue;
			y = Math.max(y, f.y + f.height * line[i]);
		}
	}
	return y;
};
