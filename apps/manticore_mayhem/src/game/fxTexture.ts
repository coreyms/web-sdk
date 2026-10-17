import * as PIXI from 'pixi.js';
import { MULT_PLATE, SWIPE_FX } from './constants';

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

/** THE CLAW STREAK (SWIPE_FX.tex, claw-swipe r1 / r2): one claw cut, baked once and shared by the four claws and
 *  their scars (components/ClawSwipe.svelte crops a frame of it per sprite to draw a claw on). Coloured, for an
 *  additive sprite: a near-white core that is thickest at peakU and tapers to a point at both ends, a gold edge and
 *  a red-orange falloff to deep red. The centreline runs from (pad, yEnd) to (w - pad, yEnd): straight along the
 *  middle at sag 0 (r2), else a circular arc bowing `sag` towards +y (r1). Computed per pixel from the path (exact
 *  distance and position along it), no canvas strokes, so it looks the same in every browser. `yAt(u)` is the
 *  centreline's y at u (0 = the start, 1 = the end). */
export type ClawGeom = { texture: PIXI.Texture; w: number; h: number; pad: number; chord: number; yEnd: number; corePx: number; yAt: (u: number) => number };
let claw: ClawGeom | null = null;
export const clawTexture = (): ClawGeom => {
	if (claw) return claw;
	const { w, h, sagFrac, corePx, peakU, glowPx } = SWIPE_FX.tex;
	const pad = glowPx + 4;
	const chord = w - 2 * pad;
	const sag = sagFrac * chord;
	// sag 0 (r2): a straight stroke along the texture's middle
	const straight = sag <= 0.5;
	const yEnd = straight ? h / 2 : pad;
	// the circle through both ends and the bowed middle; its centre is above the texture
	const R = straight ? 1 : (chord * chord) / 4 / (2 * sag) + sag / 2;
	const cx = w / 2;
	const cy = yEnd + sag - R;
	const phi1 = straight ? 0 : Math.asin(chord / 2 / R);
	const gamma = Math.log(0.5) / Math.log(peakU);
	const taper = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.pow(Math.sin(Math.PI * Math.pow(u, gamma)), 0.85));
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const ctx = c.getContext('2d')!;
	const img = ctx.createImageData(w, h);
	const D = img.data;
	// core, gold edge, red-orange, deep red
	const C0 = [255, 252, 240];
	const C1 = [255, 196, 92];
	const C2 = [255, 72, 18];
	const C3 = [186, 22, 4];
	const mix = (a: number[], b: number[], t: number, k: number) => a[k] + (b[k] - a[k]) * t;
	for (let y = 0; y < h; y += 1) {
		for (let x = 0; x < w; x += 1) {
			let u: number;
			let off: number;
			let len: number;
			if (straight) {
				u = (x + 0.5 - pad) / chord;
				off = y + 0.5 - yEnd;
				len = chord;
			} else {
				const dx = x + 0.5 - cx;
				const dy = y + 0.5 - cy;
				u = (Math.atan2(dx, dy) + phi1) / (2 * phi1);
				off = Math.hypot(dx, dy) - R;
				len = 2 * phi1 * R;
			}
			const uc = Math.max(0, Math.min(1, u));
			// past an end: the distance runs on along the path from that end
			const beyond = u < 0 ? -u * len : u > 1 ? (u - 1) * len : 0;
			const d = Math.hypot(off, beyond);
			const tp = taper(uc);
			const hw = (corePx / 2) * tp;
			const core = hw <= 0 ? 0 : Math.max(0, Math.min(1, (hw + 0.75 - d) / 1.5));
			const gw = glowPx * (0.3 + 0.7 * tp);
			const s = Math.max(0, d - hw) / gw;
			const glow = Math.exp(-s * s * 4.5) * (0.3 + 0.7 * tp) * 0.9;
			const a = Math.max(core, glow);
			const k = (y * w + x) * 4;
			if (a <= 0.002) {
				D[k + 3] = 0;
				continue;
			}
			const t1 = Math.min(1, s / 0.45);
			const t2 = Math.max(0, Math.min(1, (s - 0.45) / 0.55));
			for (let ch = 0; ch < 3; ch += 1) {
				const g = s < 0.45 ? mix(C1, C2, t1, ch) : mix(C2, C3, t2, ch);
				D[k + ch] = Math.round(core * C0[ch] + (1 - core) * g);
			}
			D[k + 3] = Math.round(255 * a);
		}
	}
	ctx.putImageData(img, 0, 0);
	const yAt = (u: number) => {
		if (straight) return yEnd;
		const phi = -phi1 + 2 * phi1 * Math.max(0, Math.min(1, u));
		return cy + R * Math.cos(phi);
	};
	claw = { texture: PIXI.Texture.from(c), w, h, pad, chord, yEnd, corePx, yAt };
	return claw;
};
