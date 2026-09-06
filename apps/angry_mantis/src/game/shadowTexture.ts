import * as PIXI from 'pixi.js';

// One shared soft dark blob (radial gradient, 256×128) for the backdrop under the branded titles:
// stretched to a title's bounds it reads as a blurred drop shadow behind the letters, so BIG WIN
// and friends separate from the board art and the steel door (Corey 2026-09-05) without any
// runtime blur filter (house rule: no filters on iOS).
let tex: PIXI.Texture | null = null;
export const shadowTexture = (): PIXI.Texture => {
	if (tex) return tex;
	const c = document.createElement('canvas');
	c.width = 256;
	c.height = 128;
	const ctx = c.getContext('2d')!;
	const g = ctx.createRadialGradient(128, 64, 0, 128, 64, 128);
	g.addColorStop(0, 'rgba(0,0,0,1)');
	g.addColorStop(0.45, 'rgba(0,0,0,0.85)');
	g.addColorStop(0.75, 'rgba(0,0,0,0.35)');
	g.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = g;
	// squash the circle into the canvas ellipse
	ctx.setTransform(1, 0, 0, 0.5, 0, 32);
	ctx.fillRect(0, -64, 256, 256);
	tex = PIXI.Texture.from(c);
	return tex;
};
