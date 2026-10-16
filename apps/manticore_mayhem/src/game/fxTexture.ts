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

// ---- THE WIN EFFECT (constants WIN_FX, 2026-10-16): three more baked textures, white with alpha so the tint colours
// them, built once on first use (BoardCells builds them at mount). No per-frame texture, no filter.

/** the burst's rays: `RAY_COUNT` soft tapered rays of two lengths round a faint centre, 128 px across */
let rays: PIXI.Texture | null = null;
export const RAYS_PX = 128;
const RAY_COUNT = 12;
export const raysTexture = (): PIXI.Texture => {
	if (rays) return rays;
	const c = document.createElement('canvas');
	c.width = RAYS_PX;
	c.height = RAYS_PX;
	const ctx = c.getContext('2d')!;
	const r = RAYS_PX / 2;
	ctx.translate(r, r);
	ctx.globalCompositeOperation = 'lighter';
	for (let i = 0; i < RAY_COUNT; i += 1) {
		// long and short rays alternate; each a thin wedge fading out along its length
		const len = (i % 2 ? 0.62 : 0.98) * r;
		const half = (i % 2 ? 0.05 : 0.07) * Math.PI;
		ctx.save();
		ctx.rotate((i / RAY_COUNT) * Math.PI * 2);
		const g = ctx.createLinearGradient(0, 0, len, 0);
		g.addColorStop(0, 'rgba(255,255,255,0.75)');
		g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(len * Math.cos(half), len * Math.sin(half));
		ctx.lineTo(len, 0);
		ctx.lineTo(len * Math.cos(half), -len * Math.sin(half));
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}
	// a faint halo the rays grow out of
	const h = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.55);
	h.addColorStop(0, 'rgba(255,255,255,0.45)');
	h.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = h;
	ctx.fillRect(-r, -r, RAYS_PX, RAYS_PX);
	rays = PIXI.Texture.from(c);
	return rays;
};

/** the soft round glow at the heart of the burst (the brief: "no white square, a soft round glow at most"): a smooth
 *  falloff to nothing at the edge, 64 px across */
let core: PIXI.Texture | null = null;
export const CORE_PX = 64;
export const coreTexture = (): PIXI.Texture => {
	if (core) return core;
	const c = document.createElement('canvas');
	c.width = CORE_PX;
	c.height = CORE_PX;
	const ctx = c.getContext('2d')!;
	const r = CORE_PX / 2;
	const g = ctx.createRadialGradient(r, r, 0, r, r, r);
	g.addColorStop(0, 'rgba(255,255,255,1)');
	g.addColorStop(0.25, 'rgba(255,255,255,0.7)');
	g.addColorStop(0.6, 'rgba(255,255,255,0.2)');
	g.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, CORE_PX, CORE_PX);
	core = PIXI.Texture.from(c);
	return core;
};

/** an ember: a streak twice as long as it is tall, a hot centre and a soft edge, EMBER_W x EMBER_H px; drawn turned
 *  along its path (the long axis is x) */
let ember: PIXI.Texture | null = null;
export const EMBER_W = 32;
export const EMBER_H = 16;
export const emberTexture = (): PIXI.Texture => {
	if (ember) return ember;
	const c = document.createElement('canvas');
	c.width = EMBER_W;
	c.height = EMBER_H;
	const ctx = c.getContext('2d')!;
	ctx.translate(EMBER_W / 2, EMBER_H / 2);
	ctx.scale(EMBER_W / EMBER_H, 1);
	const r = EMBER_H / 2;
	const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
	g.addColorStop(0, 'rgba(255,255,255,1)');
	g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
	g.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(0, 0, r, 0, Math.PI * 2);
	ctx.fill();
	ember = PIXI.Texture.from(c);
	return ember;
};
