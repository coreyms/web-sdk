import * as PIXI from 'pixi.js';

import { SYMBOL_SIZE, BOARD_DIMENSIONS, ANTICIPATION } from './constants';

// The scatter-anticipation rim (Anticipation.svelte): a rounded column outline with a soft glow,
// three strokes from wide-and-faint to narrow-and-bright, baked ONCE into a texture at board
// resolution ×2 and shown as a sprite whose alpha pulses. A Graphics redraw per frame did the
// same job but rebuilt GPU geometry sixty times a second for the whole tease (house rule: no
// per-frame geometry/texture churn).
export const RIM_PAD = 24; // px of glow beyond the column on every side, board units
const SCALE = 2;
let tex: PIXI.Texture | null = null;
export const rimTexture = (): PIXI.Texture => {
	if (tex) return tex;
	const w = SYMBOL_SIZE + 10 + RIM_PAD * 2;
	const h = SYMBOL_SIZE * BOARD_DIMENSIONS.y + 10 + RIM_PAD * 2;
	const c = document.createElement('canvas');
	c.width = w * SCALE;
	c.height = h * SCALE;
	const ctx = c.getContext('2d')!;
	ctx.scale(SCALE, SCALE);
	const color = `#${ANTICIPATION.rimColor.toString(16).padStart(6, '0')}`;
	const strokes: [number, number][] = [[18, 0.15], [10, 0.35], [4, 0.9]];
	for (const [width, alpha] of strokes) {
		ctx.globalAlpha = alpha;
		ctx.strokeStyle = color;
		ctx.lineWidth = width;
		ctx.beginPath();
		ctx.roundRect(RIM_PAD, RIM_PAD, SYMBOL_SIZE + 10, SYMBOL_SIZE * BOARD_DIMENSIONS.y + 10, 8);
		ctx.stroke();
	}
	tex = PIXI.Texture.from(c);
	return tex;
};
