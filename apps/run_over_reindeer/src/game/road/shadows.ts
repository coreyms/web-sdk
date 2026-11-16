// THE CONTACT SHADOWS (Corey 2026-11-15; constants SHADOW, tools/build_shadows.py made the texture and
// game/shadowSpec.ts): one soft ellipse texture, stretched to each thing's footprint as measured from its art.
//
// Every shadow is a plain sprite with alpha (normal blend), so it batches with the symbol atlas in the same draw call.
// Nothing here allocates per frame: a sprite is made once with its owner and only moved, sized and faded after.
//   - a symbol on the road: its own frame's shadow, drawn in the road's ground layer under every lane
//     (game/road/roadBoard.ts), following its sprite's x and the win pulse's scale, hidden with it
//   - a column character: at its feet, between the column's cloud and its red frame (game/road/roadFeatures.ts)
//   - the running reindeer: on the ground under him, per view and per stride, smaller and lighter while his feet are
//     off the ground; drawn just under him and over the traffic he crosses (game/road/roadFeatures.ts)
import * as PIXI from 'pixi.js';

import { SHADOW } from '../constants';
import { SHADOW_ART } from '../shadowSpec';
import type { RunView } from './reindeerRun';

export type ShadowShape = { readonly width: number; readonly height: number; readonly dx: number; readonly dy: number; readonly alpha: number };

const SYMBOLS = SHADOW_ART.symbols as unknown as Record<string, ShadowShape>;
const COLUMNS = SHADOW_ART.columns as unknown as Record<string, ShadowShape>;
const RUN = SHADOW_ART.run;
const RUN_VIEWS = RUN.views as unknown as Record<RunView, { width: number; height: number; dx: number; dy: number }>;
const RUN_LIFT = RUN.lift as unknown as Record<RunView, Record<string, number>>;

/** the darkest point of a shadow now (0 when they are off) */
export const shadowStrength = (): number => (SHADOW.on ? (SHADOW.alpha[SHADOW.strength] ?? 0) : 0);

/** a symbol frame's shadow (frameFor's name: H1_R, L3, S...), or null for a frame with none */
export const symbolShadow = (frame: string): ShadowShape | null => SYMBOLS[frame] ?? null;

/** a column character's shadow at its feet */
export const columnShadow = (tier: string): ShadowShape | null => COLUMNS[tier] ?? null;

/** a shadow sprite (hidden until placed); `texture` null draws nothing */
export const makeShadow = (texture: PIXI.Texture | null | undefined): PIXI.Sprite => {
	const s = new PIXI.Sprite(texture ?? PIXI.Texture.EMPTY);
	s.anchor.set(0.5);
	s.tint = SHADOW.tint;
	s.visible = false;
	s.label = 'shadow';
	return s;
};

/** put a shadow's centre at (x, y), w x h road px, at `alpha` (0 hides it) */
export const placeShadow = (s: PIXI.Sprite, x: number, y: number, w: number, h: number, alpha: number) => {
	const t = s.texture;
	if (alpha <= 0.002 || t.width <= 1 || w <= 0 || h <= 0) {
		s.visible = false;
		return;
	}
	if (s.tint !== SHADOW.tint) s.tint = SHADOW.tint;
	s.visible = true;
	s.position.set(x, y);
	s.scale.set(w / t.width, h / t.height);
	s.alpha = alpha;
};

/** THE REINDEER'S SHADOW for a view and stride: where its centre is from his feet point (road px, already mirrored by
 *  `dir`), its size and its alpha share, from his draw scale `k`. Written into `out` (no allocation). */
export type RunShadow = { x: number; y: number; w: number; h: number; share: number; lift: number };
/** `along`: how far he is (0 to 1) from this stride's pose to the next one's: his foot height is eased between the two
 *  measured poses (when the view has the next one), so the shadow breathes with the stride instead of jumping */
export const runShadow = (view: RunView, stride: number | null, k: number, dir: 1 | -1, out: RunShadow, along = 0): RunShadow => {
	const v = RUN_VIEWS[view];
	const table = RUN_LIFT[view];
	const here = stride === null ? 0 : (table?.[String(stride)] ?? 0);
	const next = stride === null ? undefined : table?.[String((stride % 16) + 1)];
	const lift = next === undefined ? here : here + (next - here) * Math.max(0, Math.min(1, along));
	const u = Math.min(1, Math.max(0, lift) / RUN.liftFull);
	const shrink = 1 - RUN.shrink * u;
	const road = RUN.roadPxPerFramePx * k;
	out.x = dir * v.dx * road;
	// the centre stays on the ground: only its size and darkness answer his feet
	out.y = v.dy * road;
	out.w = v.width * road * shrink;
	out.h = v.height * road * shrink;
	out.share = RUN.alpha * (1 - RUN.fade * u);
	out.lift = lift;
	return out;
};
