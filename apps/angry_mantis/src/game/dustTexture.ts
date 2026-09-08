import * as PIXI from 'pixi.js';

// One shared soft dust lobe (radial gradient, 128×64, warm floor-grey) for the gravity-drop landing
// puff (ReelSymbol.svelte): two of them, scaled out and faded, spread from a tile's bottom edge.
// Built once and cached — house rule: no per-landing textures. Placeholder until Corey's drawn
// dust sheet lands (512×192 frames, 4×2, pivot bottom-centre); swap the Sprite key, keep the timing.
let tex: PIXI.Texture | null = null;
export const dustTexture = (): PIXI.Texture => {
	if (tex) return tex;
	const c = document.createElement('canvas');
	c.width = 128;
	c.height = 64;
	const ctx = c.getContext('2d')!;
	const g = ctx.createRadialGradient(64, 32, 0, 64, 32, 64);
	g.addColorStop(0, 'rgba(214,196,160,1)');
	g.addColorStop(0.5, 'rgba(214,196,160,0.55)');
	g.addColorStop(1, 'rgba(214,196,160,0)');
	ctx.fillStyle = g;
	ctx.setTransform(1, 0, 0, 0.5, 0, 16);
	ctx.fillRect(0, -32, 128, 128);
	tex = PIXI.Texture.from(c);
	return tex;
};
