// THE CAST SHADOWS (Corey 2026-11-15, round 2; constants SHADOW): every thing on the road throws its own silhouette on
// the ground, away from the camera and well to the left, from one light for the whole scene.
//
// The shadow is a TWIN of its owner: a plain sprite with the very texture, frame and anchor its owner draws this
// frame, tinted near black, at SHADOW.alpha. It is pinned at the owner's ground contact point (its anchor: the bottom
// of the tyres, the sleigh's runners, a sign's post, the present's base, the reindeer's feet point), keeps the owner's
// width (and its mirror), is flattened to SHADOW.length of the owner's height and leaned SHADOW.angle toward the left
// by a skew. So it is the shape of the car or sign, lying on the road, touching it where it touches the ground.
// No new texture (the twin shares the owner's), no filter, mask, shader or blur; it follows an animated frame for
// free, and it batches with its owner's texture in the same draw call.
//
// Where they lie (the draw order):
//   - a symbol on the road (and through traffic) and the running reindeer: the road's ground layer, under all four
//     lanes (game/road/roadBoard.ts), so no shadow is ever drawn over a symbol; it shows on the road in the gaps
//   - a column character: on its column's cloud, behind it and under the red frame (game/road/roadFeatures.ts). The
//     cloud stands in the reel like a wall behind the character, so there the same light throws the twin up and to the
//     left onto it (a plain offset, no lean), cropped to the inside of the box by its texture frame (a crop, not a mask)
// Nothing allocates per frame: a twin is made once with its owner and only re-pointed, moved and faded.
import * as PIXI from 'pixi.js';

import { SHADOW } from '../constants';

/** the darkest a shadow is drawn now (0 when they are off) */
export const shadowStrength = (): number => (SHADOW.on ? Math.max(0, Math.min(1, SHADOW.alpha)) : 0);

/** a shadow sprite (hidden until placed) */
export const makeShadow = (): PIXI.Sprite => {
	const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
	s.tint = SHADOW.tint;
	s.visible = false;
	s.label = 'shadow';
	return s;
};

const hasPicture = (t: PIXI.Texture | null | undefined): t is PIXI.Texture => !!t && t !== PIXI.Texture.EMPTY && !t.destroyed && t.width > 1;

/** THE CAST: `s` becomes the shadow of a sprite drawing `texture` with anchor (ax, ay) at (x, y) and scale (sx, sy):
 *  pinned at that anchor (the owner's ground point), flattened and leaned by SHADOW.length and SHADOW.angle. `alpha`
 *  0 (or no picture) hides it. Never copies a rotation: the ground does not tilt. */
export const castShadow = (s: PIXI.Sprite, texture: PIXI.Texture | null | undefined, ax: number, ay: number, x: number, y: number, sx: number, sy: number, alpha: number) => {
	if (alpha <= 0.002 || !hasPicture(texture)) {
		if (s.visible) s.visible = false;
		return;
	}
	if (s.texture !== texture) s.texture = texture;
	if (s.anchor.x !== ax || s.anchor.y !== ay) s.anchor.set(ax, ay);
	if (s.tint !== SHADOW.tint) s.tint = SHADOW.tint;
	s.position.set(x, y);
	// local (0, -h) (the owner's top) lands at (-sin(angle), -cos(angle)) x h x length from the ground point
	s.scale.set(sx, sy * SHADOW.length);
	const lean = (SHADOW.angle * Math.PI) / 180;
	if (s.skew.x !== lean || s.skew.y !== 0) s.skew.set(lean, 0);
	s.alpha = alpha;
	s.visible = true;
};

/** where a cast shadow's owner's top lands, from its ground point, per road px of the owner's height (the probes and
 *  the notes): x to the left (negative), y up (negative) */
export const castReach = () => {
	const lean = (SHADOW.angle * Math.PI) / 180;
	return { x: -Math.sin(lean) * SHADOW.length, y: -Math.cos(lean) * SHADOW.length };
};

/** a box in road px */
export type ShadowBox = { x: number; y: number; w: number; h: number };

/** THE COLUMN CHARACTER'S SHADOW on its cloud: the twin of `body` (a sprite with anchor 0, drawn at its x, y, width,
 *  height from a plain frame of a sheet) moved by SHADOW.column (dx, dy), cropped to `box` by its own texture's frame.
 *  `tex` is the shadow's own dynamic texture (made on the first call, kept by the caller, re-pointed after); returns it. */
export const dropShadow = (s: PIXI.Sprite, tex: PIXI.Texture | null, body: PIXI.Sprite, box: ShadowBox, alpha: number): PIXI.Texture | null => {
	const src = body.texture;
	if (alpha <= 0.002 || !hasPicture(src) || body.width <= 0 || body.height <= 0) {
		if (s.visible) s.visible = false;
		return tex;
	}
	const C = SHADOW.column;
	const x0s = body.x + C.dx;
	const y0s = body.y + C.dy;
	const x0 = Math.max(x0s, box.x);
	const x1 = Math.min(x0s + body.width, box.x + box.w);
	const y0 = Math.max(y0s, box.y);
	const y1 = Math.min(y0s + body.height, box.y + box.h);
	if (x1 - x0 < 1 || y1 - y0 < 1) {
		if (s.visible) s.visible = false;
		return tex;
	}
	const f = src.frame;
	const perX = f.width / body.width;
	const perY = f.height / body.height;
	// dynamic: the sprite follows a texture whose frame changes when the texture says so (the column cloud's crop does
	// the same)
	tex ??= new PIXI.Texture({ source: src.source, frame: f.clone(), dynamic: true });
	if (tex.source !== src.source) tex.source = src.source;
	tex.frame.x = f.x + (x0 - x0s) * perX;
	tex.frame.y = f.y + (y0 - y0s) * perY;
	tex.frame.width = Math.max(1, (x1 - x0) * perX);
	tex.frame.height = Math.max(1, (y1 - y0) * perY);
	tex.update();
	if (s.texture !== tex) s.texture = tex;
	if (s.anchor.x !== 0 || s.anchor.y !== 0) s.anchor.set(0, 0);
	if (s.skew.x !== 0) s.skew.set(0, 0);
	if (s.tint !== SHADOW.tint) s.tint = SHADOW.tint;
	s.position.set(x0, y0);
	s.width = x1 - x0;
	s.height = y1 - y0;
	s.alpha = alpha;
	s.visible = true;
	return tex;
};
