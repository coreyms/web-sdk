import * as PIXI from 'pixi.js';

// One shared 1024×2 gradient: transparent, a bright white core in the middle, transparent again.
// Drawn as a Graphics texture fill in 'global' texture space (matrix in texels, no fitting to
// the shape); Pixi forces that mode to repeat, so the width is what keeps the next copy of the
// strip well outside a tile (period ≈ 1024 × 0.3 px ≈ 310 px vs a 106 px cell). The rounded-rect
// geometry IS the clip — no mask, and the glint is locked to the tray silhouette rather than
// the plate's alpha (Corey 2026-09-05).
export const GLINT_TEX_W = 1024;
export const GLINT_CORE = 160; // texels from transparent, through white, back to transparent

let tex: PIXI.Texture | null = null;
export const glintTexture = (): PIXI.Texture => {
	if (tex) return tex;
	const c = document.createElement('canvas');
	c.width = GLINT_TEX_W;
	c.height = 2;
	const ctx = c.getContext('2d')!;
	const g = ctx.createLinearGradient(0, 0, GLINT_TEX_W, 0);
	const half = GLINT_CORE / 2 / GLINT_TEX_W;
	g.addColorStop(0, 'rgba(255,255,255,0)');
	g.addColorStop(0.5 - half, 'rgba(255,255,255,0)');
	g.addColorStop(0.5, 'rgba(255,255,255,1)');
	g.addColorStop(0.5 + half, 'rgba(255,255,255,0)');
	g.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, GLINT_TEX_W, 2);
	tex = PIXI.Texture.from(c);
	return tex;
};
