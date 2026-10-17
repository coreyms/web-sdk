import * as PIXI from 'pixi.js';
import { MULT_PLATE } from './constants';

// Baked textures for the motion pass (components/BoardCells.svelte), built ONCE and cached — house
// rule: no per-frame textures, no filters. Both are white with alpha so a sprite tint colours them.

/** a soft dot for the sparkle particles: solid centre, feathered edge. 16 px across. */
let dot: PIXI.Texture | null = null;
export const DOT_PX = 16;
export const dotTexture = (): PIXI.Texture => {
	if (dot) return dot;
	const c = document.createElement('canvas');
	c.width = DOT_PX;
	c.height = DOT_PX;
	const ctx = c.getContext('2d')!;
	const r = DOT_PX / 2;
	const g = ctx.createRadialGradient(r, r, 0, r, r, r);
	g.addColorStop(0, 'rgba(255,255,255,1)');
	g.addColorStop(0.55, 'rgba(255,255,255,1)');
	g.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, DOT_PX, DOT_PX);
	dot = PIXI.Texture.from(c);
	return dot;
};

/** the landing aura: a rounded square halo that fades out from the tile's edge, drawn behind the
 *  tile on an additive sprite. 128 px across; the tile occupies the middle ~70% of it. */
let glow: PIXI.Texture | null = null;
export const GLOW_PX = 128;
export const glowTexture = (): PIXI.Texture => {
	if (glow) return glow;
	const c = document.createElement('canvas');
	c.width = GLOW_PX;
	c.height = GLOW_PX;
	const ctx = c.getContext('2d')!;
	const r = GLOW_PX / 2;
	const g = ctx.createRadialGradient(r, r, r * 0.3, r, r, r);
	g.addColorStop(0, 'rgba(255,255,255,0.95)');
	g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
	g.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, GLOW_PX, GLOW_PX);
	glow = PIXI.Texture.from(c);
	return glow;
};

/** THE MULTIPLIER TILE'S INNER GLOW (MULT_PLATE.innerGlow*, Corey 2026-10-13 12:06; the Symbol Fit Playground's
 *  glowFor): one white square, alpha 255 x (1 - e)^power with e the distance to the nearest edge over half the side,
 *  bright at the edge and clear in the middle. Tinted the level colour and stretched to each cell's box. */
let innerGlow: PIXI.Texture | null = null;
export const innerGlowTexture = (): PIXI.Texture => {
	if (innerGlow) return innerGlow;
	const N = MULT_PLATE.innerGlowPx;
	const c = document.createElement('canvas');
	c.width = N;
	c.height = N;
	const ctx = c.getContext('2d')!;
	const d = ctx.createImageData(N, N);
	for (let j = 0; j < N; j += 1) {
		for (let i = 0; i < N; i += 1) {
			const e = Math.min(i + 0.5, j + 0.5, N - i - 0.5, N - j - 0.5) / (N / 2);
			const k = (j * N + i) * 4;
			d.data[k] = d.data[k + 1] = d.data[k + 2] = 255;
			d.data[k + 3] = Math.round(255 * Math.pow(1 - e, MULT_PLATE.innerGlowPower));
		}
	}
	ctx.putImageData(d, 0, 0);
	innerGlow = PIXI.Texture.from(c);
	return innerGlow;
};
