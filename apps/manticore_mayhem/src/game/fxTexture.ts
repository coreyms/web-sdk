import * as PIXI from 'pixi.js';
import { MULT_PLATE, SWIPE_FX, STING_FX, type StingLook } from './constants';

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

/** THE PLAQUE'S HALO (constants PLAQUE_GLOW, branch portrait-glow-r1): the plaque body's own outline, blurred, white with
 *  alpha, baked ONCE per halo kind into a small 2D canvas (the canvas's shadowBlur, as game/logo/still.ts bakes the logo's
 *  shadow; no filter in the renderer) and drawn as a plain sprite behind the plaque with a tint. `body` is the body
 *  sprite's texture (its frame of the plaque atlas), `bodyW` / `bodyH` its size in ship px. Returns the texture and its
 *  box in ship px relative to the body's top left corner, and how it was made (`silhouette` false: the atlas image could
 *  not be drawn, so the halo is of the body's rounded box instead). */
export type PlaqueHalo = { texture: PIXI.Texture; x: number; y: number; width: number; height: number; silhouette: boolean; bakeMs: number; bytes: number; profile: { down: number[]; left: number[]; shipPerPx: number } | null };
const halos = new Map<string, PlaqueHalo>();
export const plaqueHaloTexture = (key: string, body: PIXI.Texture, bodyW: number, bodyH: number, spec: { reach: number; blur: number; passes: number; bakeWidth: number }): PlaqueHalo => {
	const had = halos.get(key);
	if (had) return had;
	const t0 = performance.now();
	const pad = spec.reach * bodyW;
	const W = spec.bakeWidth;
	const k = W / (bodyW + 2 * pad); // canvas px per ship px
	const H = Math.round((bodyH + 2 * pad) * k);
	const c = document.createElement('canvas');
	c.width = W;
	c.height = H;
	const ctx = c.getContext('2d')!;
	const bw = bodyW * k;
	const bh = bodyH * k;
	const px = pad * k;
	// the shape itself is drawn off the canvas; only its blurred shadow lands on it, `passes` times over
	const off = W + bw + 16;
	ctx.shadowColor = '#fff';
	ctx.shadowBlur = spec.blur * bodyW * k;
	ctx.shadowOffsetX = off;
	const image = body.source?.resource as CanvasImageSource | undefined;
	const f = body.frame;
	let silhouette = false;
	for (let i = 0; i < spec.passes; i += 1) {
		try {
			if (!image) throw new Error('no image');
			ctx.drawImage(image, f.x, f.y, f.width, f.height, px - off, px, bw, bh);
			silhouette = true;
		} catch {
			ctx.fillStyle = '#fff';
			ctx.beginPath();
			ctx.roundRect(px - off, px, bw, bh, bh * 0.08);
			ctx.fill();
		}
	}
	const out: PlaqueHalo = { texture: PIXI.Texture.from(c), x: -pad, y: -pad, width: bodyW + 2 * pad, height: bodyH + 2 * pad, silhouette, bakeMs: 0, bytes: W * H * 4, profile: null };
	out.bakeMs = performance.now() - t0;
	if (import.meta.env.DEV) {
		// DEV (the cost and reach report): the halo's alpha (0..1) outward from the body's box, one sample per ship px of
		// body width share: down the centre column from the body's bottom edge, along the middle row from its left edge
		const col = ctx.getImageData(Math.floor(W / 2), 0, 1, H).data;
		const row = ctx.getImageData(0, Math.floor(H / 2), W, 1).data;
		const bottom = Math.round(px + bh);
		out.profile = {
			down: Array.from({ length: H - bottom }, (_, i) => col[(bottom + i) * 4 + 3] / 255),
			left: Array.from({ length: Math.round(px) }, (_, i) => row[(Math.round(px) - 1 - i) * 4 + 3] / 255),
			shipPerPx: 1 / k,
		};
	}
	halos.set(key, out);
	return out;
};

// ---- THE STING, r1 (constants STING_FX; components/Sting.svelte) -------------------------------------------------
// Baked ONCE per look (or once for all looks) on first use; Sting.svelte asks for every look at mount so a DEV switch
// never bakes mid strike. No per-frame texture, no filter. All white with alpha (a sprite tint colours them) except the
// ribbon and the look's mark, which carry the look's own colours for an additive sprite, like the claw streak.

const rgbOf = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
/** a small seeded PRNG (mulberry32) so a baked shape is the same on every load */
const seeded = (seed: number) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const canvasOf = (w: number, h: number) => {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	return { c, ctx: c.getContext('2d')! };
};
const css = (c: number, a: number) => {
	const [r, g, b] = rgbOf(c);
	return `rgba(${r},${g},${b},${a})`;
};

/** THE STRIKE RIBBON of a look: x runs along the trail (0 its tail, 1 the head), y across it. A white-hot core a fifth
 *  of the width, the look's edge and outer colours falling off to nothing at the sides; the tail end cools to the look's
 *  `tail` colour and fades out. Computed per pixel. */
const ribbonTexture = (look: StingLook): PIXI.Texture => {
	const L = STING_FX.looks[look];
	const { ribbonW: w, ribbonH: h } = STING_FX.tex;
	const { c, ctx } = canvasOf(w, h);
	const img = ctx.createImageData(w, h);
	const D = img.data;
	const C0 = rgbOf(L.core);
	const C1 = rgbOf(L.edge);
	const C2 = rgbOf(L.outer);
	const CT = rgbOf(L.tail);
	for (let y = 0; y < h; y += 1) {
		const d = Math.abs(((y + 0.5) / h) * 2 - 1);
		for (let x = 0; x < w; x += 1) {
			const u = (x + 0.5) / w;
			const core = Math.max(0, Math.min(1, (0.26 - d) / 0.1 + 0.5)) * Math.pow(u, 0.8);
			const glow = Math.min(1, 1.05 * Math.exp(-Math.pow(d / 0.62, 2) * 1.9) * Math.pow(u, 0.35));
			const a = Math.max(core, glow);
			const k = (y * w + x) * 4;
			if (a < 0.003) {
				D[k + 3] = 0;
				continue;
			}
			const cool = Math.pow(1 - u, 1.6) * 0.85;
			const t = Math.min(1, d / 0.55);
			for (let ch = 0; ch < 3; ch += 1) {
				let g = d < 0.3 ? C1[ch] + (C2[ch] - C1[ch]) * (d / 0.3) : C2[ch];
				g = g + (CT[ch] - g) * cool * t;
				const cc = C0[ch] + (C1[ch] - C0[ch]) * cool;
				D[k + ch] = Math.round(core * cc + (1 - core) * g);
			}
			D[k + 3] = Math.round(255 * a);
		}
	}
	ctx.putImageData(img, 0, 0);
	return PIXI.Texture.from(c);
};

/** the ember look's mark: cracks burnt out from the strike point, a scorch under them (coloured) */
const crackTexture = (look: StingLook): PIXI.Texture => {
	const L = STING_FX.looks[look];
	const N = STING_FX.tex.markPx;
	const { c, ctx } = canvasOf(N, N);
	const R = N / 2;
	const rnd = seeded(7);
	const scorch = ctx.createRadialGradient(R, R, 0, R, R, R * 0.62);
	scorch.addColorStop(0, css(L.edge, 0.85));
	scorch.addColorStop(0.35, css(L.outer, 0.45));
	scorch.addColorStop(1, css(L.tail, 0));
	ctx.fillStyle = scorch;
	ctx.fillRect(0, 0, N, N);
	const paths: [number, number][][] = [];
	const branch = (x: number, y: number, ang: number, len: number, depth: number) => {
		const pts: [number, number][] = [[x, y]];
		const steps = Math.max(3, Math.round(len / 9));
		for (let i = 0; i < steps; i += 1) {
			ang += (rnd() - 0.5) * 0.7;
			x += Math.cos(ang) * (len / steps);
			y += Math.sin(ang) * (len / steps);
			pts.push([x, y]);
			if (depth < 1 && i === Math.floor(steps / 2) && rnd() < 0.6) branch(x, y, ang + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.4), len * 0.45, depth + 1);
		}
		paths.push(pts);
	};
	const arms = 8;
	for (let i = 0; i < arms; i += 1) {
		const a = (i / arms) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
		branch(R + Math.cos(a) * 5, R + Math.sin(a) * 5, a, R * (0.62 + rnd() * 0.3), 0);
	}
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	const pass = (color: string, width: number) => {
		ctx.strokeStyle = color;
		ctx.lineWidth = width;
		for (const pts of paths) {
			ctx.beginPath();
			ctx.moveTo(pts[0][0], pts[0][1]);
			for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
			ctx.stroke();
		}
	};
	pass(css(L.outer, 0.35), 9);
	pass(css(L.edge, 0.85), 3.6);
	pass(css(L.core, 1), 1.4);
	const hot = ctx.createRadialGradient(R, R, 0, R, R, R * 0.2);
	hot.addColorStop(0, css(L.core, 1));
	hot.addColorStop(1, css(L.edge, 0));
	ctx.fillStyle = hot;
	ctx.fillRect(0, 0, N, N);
	return PIXI.Texture.from(c);
};

/** the venom look's mark: a splash, a body with lobes round it, flung drops and their streaks (coloured) */
const splashTexture = (look: StingLook): PIXI.Texture => {
	const L = STING_FX.looks[look];
	const N = STING_FX.tex.markPx;
	const { c, ctx } = canvasOf(N, N);
	const R = N / 2;
	const rnd = seeded(23);
	const blob = (x: number, y: number, r: number, hot: number) => {
		const g = ctx.createRadialGradient(x, y, 0, x, y, r);
		g.addColorStop(0, css(hot ? L.edge : L.outer, 0.95));
		g.addColorStop(0.7, css(L.outer, 0.9));
		g.addColorStop(1, css(L.tail, 0));
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
	};
	// streaks first, under the drops
	ctx.lineCap = 'round';
	const drops: [number, number, number][] = [];
	for (let i = 0; i < 12; i += 1) {
		const a = (i / 12) * Math.PI * 2 + (rnd() - 0.5) * 0.4;
		const d = R * (0.6 + rnd() * 0.32);
		drops.push([R + Math.cos(a) * d, R + Math.sin(a) * d, R * (0.025 + rnd() * 0.045)]);
		ctx.strokeStyle = css(L.outer, 0.55);
		ctx.lineWidth = 2 + rnd() * 2;
		ctx.beginPath();
		ctx.moveTo(R + Math.cos(a) * R * 0.3, R + Math.sin(a) * R * 0.3);
		ctx.lineTo(R + Math.cos(a) * d * 0.92, R + Math.sin(a) * d * 0.92);
		ctx.stroke();
	}
	for (let i = 0; i < 9; i += 1) {
		const a = (i / 9) * Math.PI * 2 + rnd() * 0.5;
		const d = R * (0.22 + rnd() * 0.22);
		blob(R + Math.cos(a) * d, R + Math.sin(a) * d, R * (0.12 + rnd() * 0.1), 0);
	}
	blob(R, R, R * 0.36, 1);
	for (const [x, y, r] of drops) blob(x, y, r * 1.6, 0);
	const hot = ctx.createRadialGradient(R, R, 0, R, R, R * 0.22);
	hot.addColorStop(0, css(L.core, 0.95));
	hot.addColorStop(1, css(L.edge, 0));
	ctx.fillStyle = hot;
	ctx.fillRect(0, 0, N, N);
	return PIXI.Texture.from(c);
};

/** the gold look's mark: an eight point starburst, long and short sharp rays round a hot centre (coloured) */
const burstTexture = (look: StingLook): PIXI.Texture => {
	const L = STING_FX.looks[look];
	const N = STING_FX.tex.markPx;
	const { c, ctx } = canvasOf(N, N);
	const R = N / 2;
	ctx.translate(R, R);
	ctx.globalCompositeOperation = 'lighter';
	for (let i = 0; i < 16; i += 1) {
		const long = i % 2 === 0;
		const len = (long ? 0.98 : 0.55) * R;
		const half = (long ? 0.075 : 0.06) * Math.PI;
		ctx.save();
		ctx.rotate((i / 16) * Math.PI * 2);
		const g = ctx.createLinearGradient(0, 0, len, 0);
		g.addColorStop(0, css(L.core, 0.95));
		g.addColorStop(0.35, css(L.edge, 0.7));
		g.addColorStop(1, css(L.outer, 0));
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(len * 0.3 * Math.cos(half), len * 0.3 * Math.sin(half));
		ctx.lineTo(len, 0);
		ctx.lineTo(len * 0.3 * Math.cos(half), -len * 0.3 * Math.sin(half));
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}
	const hot = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.32);
	hot.addColorStop(0, css(L.core, 1));
	hot.addColorStop(1, css(L.edge, 0));
	ctx.fillStyle = hot;
	ctx.fillRect(-R, -R, N, N);
	return PIXI.Texture.from(c);
};

/** a soft ring (white): a band at 0.82 of the radius (0.1 of it wide) with a faint fill inside it */
let stingRing: PIXI.Texture | null = null;
export const stingRingTexture = (): PIXI.Texture => {
	if (stingRing) return stingRing;
	const N = STING_FX.tex.ringPx;
	const { c, ctx } = canvasOf(N, N);
	const img = ctx.createImageData(N, N);
	for (let y = 0; y < N; y += 1) {
		for (let x = 0; x < N; x += 1) {
			const r = Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) / (N / 2);
			const band = Math.exp(-Math.pow((r - 0.82) / 0.1, 2));
			const fill = r < 0.82 ? 0.1 * r * r : 0;
			const k = (y * N + x) * 4;
			img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
			img.data[k + 3] = Math.round(255 * Math.min(1, band + fill));
		}
	}
	ctx.putImageData(img, 0, 0);
	stingRing = PIXI.Texture.from(c);
	return stingRing;
};

/** a glint (white): a four point star with shorter diagonals and a soft centre */
let glint: PIXI.Texture | null = null;
export const glintTexture = (): PIXI.Texture => {
	if (glint) return glint;
	const N = STING_FX.tex.glintPx;
	const { c, ctx } = canvasOf(N, N);
	const img = ctx.createImageData(N, N);
	const spike = (a: number, b: number, w: number) => Math.exp(-Math.pow(a / w, 2)) * Math.pow(Math.max(0, 1 - Math.abs(b)), 2.4);
	for (let y = 0; y < N; y += 1) {
		for (let x = 0; x < N; x += 1) {
			const nx = ((x + 0.5) / N) * 2 - 1;
			const ny = ((y + 0.5) / N) * 2 - 1;
			const dx = (nx + ny) * Math.SQRT1_2;
			const dy = (nx - ny) * Math.SQRT1_2;
			const r = Math.hypot(nx, ny);
			const a = Math.max(spike(nx, ny, 0.07), spike(ny, nx, 0.07), 0.55 * spike(dx, dy * 1.6, 0.06), 0.55 * spike(dy, dx * 1.6, 0.06), Math.exp(-Math.pow(r / 0.2, 2)));
			const k = (y * N + x) * 4;
			img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
			img.data[k + 3] = Math.round(255 * Math.min(1, a));
		}
	}
	ctx.putImageData(img, 0, 0);
	glint = PIXI.Texture.from(c);
	return glint;
};

export type StingTextures = { ribbon: PIXI.Texture; mark: PIXI.Texture; particle: PIXI.Texture; particleW: number; particleH: number };
const stingTex = new Map<StingLook, StingTextures>();
/** a look's strike textures: its ribbon and mark (baked for it), its particle (shared) */
export const stingTextures = (look: StingLook): StingTextures => {
	const had = stingTex.get(look);
	if (had) return had;
	const L = STING_FX.looks[look];
	const mark = L.mark === 'crack' ? crackTexture(look) : L.mark === 'splash' ? splashTexture(look) : burstTexture(look);
	const particle = L.particle === 'ember' ? emberTexture() : L.particle === 'drop' ? dotTexture() : glintTexture();
	const [particleW, particleH] = L.particle === 'ember' ? [EMBER_W, EMBER_H] : L.particle === 'drop' ? [DOT_PX, DOT_PX] : [STING_FX.tex.glintPx, STING_FX.tex.glintPx];
	const out = { ribbon: ribbonTexture(look), mark, particle, particleW, particleH };
	stingTex.set(look, out);
	return out;
};
