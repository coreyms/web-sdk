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

// Soft halo for a STINGER plate: a rounded rectangle at the plates' ~2.9 aspect, blurred once into
// a cached canvas (one raster at boot, never per frame — house rule 1). Drawn as a BaseSprite behind
// the plate at PLATE_SHADOW.scaleX / scaleY of its size so the blur margin lands at ~4% of the
// plate width all round; alpha set by the caller. No filters.
const SH = { rectW: 435, rectH: 150, margin: 24, blur: 16, radius: 14 };
export const PLATE_SHADOW = {
	scaleX: (SH.rectW + SH.margin * 2) / SH.rectW,
	scaleY: (SH.rectH + SH.margin * 2) / SH.rectH,
} as const;
let plateTex: PIXI.Texture | undefined;
export const plateShadowTexture = (): PIXI.Texture => {
	if (plateTex) return plateTex;
	const c = document.createElement('canvas');
	c.width = SH.rectW + SH.margin * 2;
	c.height = SH.rectH + SH.margin * 2;
	const ctx = c.getContext('2d')!;
	// draw the rect off-canvas and let only its shadow land, so the halo has no hard core edge
	ctx.shadowColor = 'rgba(0,0,0,1)';
	ctx.shadowBlur = SH.blur;
	ctx.shadowOffsetX = c.width * 2;
	ctx.fillStyle = '#000';
	ctx.beginPath();
	ctx.roundRect(SH.margin - c.width * 2, SH.margin, SH.rectW, SH.rectH, SH.radius);
	ctx.fill();
	plateTex = PIXI.Texture.from(c);
	return plateTex;
};
