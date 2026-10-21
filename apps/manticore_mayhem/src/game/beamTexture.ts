import * as PIXI from 'pixi.js';

import { SUN_TEASE } from './constants';

// Baked light textures for the Mystery scatter tease (Anticipation.svelte), built once and cached —
// house rule: no per-frame textures, no filters. Carried over from Angry Mantis unchanged; the
// colours are Corey's from the reel-motion artifact.

// Searchlight wedge: apex at the top centre, full width at the bottom, brightest a third of the
// way down and gone at the far end. Drawn with an additive sprite (anchor 0.5, 0) that is
// rotated about the apex.
let beam: PIXI.Texture | null = null;
export const beamTexture = (): PIXI.Texture => {
	if (beam) return beam;
	const W = 256;
	const H = 1024;
	const c = document.createElement('canvas');
	c.width = W;
	c.height = H;
	const ctx = c.getContext('2d')!;
	const g = ctx.createLinearGradient(0, 0, 0, H);
	g.addColorStop(0, 'rgba(255,244,210,0.05)');
	g.addColorStop(0.35, 'rgba(255,240,200,0.5)');
	g.addColorStop(1, 'rgba(255,236,190,0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.moveTo(W / 2, 0);
	ctx.lineTo(0, H);
	ctx.lineTo(W, H);
	ctx.closePath();
	ctx.fill();
	beam = PIXI.Texture.from(c);
	return beam;
};

// Light spill: a warm strip fading from one edge to nothing, one per side of the column
// ('left' fades rightwards from the column's left edge, 'right' the mirror).
const spills: Partial<Record<'left' | 'right', PIXI.Texture>> = {};
export const spillTexture = (side: 'left' | 'right'): PIXI.Texture => {
	const have = spills[side];
	if (have) return have;
	const W = 64;
	const c = document.createElement('canvas');
	c.width = W;
	c.height = 4;
	const ctx = c.getContext('2d')!;
	const g = side === 'left' ? ctx.createLinearGradient(0, 0, W, 0) : ctx.createLinearGradient(W, 0, 0, 0);
	g.addColorStop(0, 'rgba(255,232,180,1)');
	g.addColorStop(1, 'rgba(255,232,180,0)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, W, 4);
	const tex = PIXI.Texture.from(c);
	spills[side] = tex;
	return tex;
};

// THE TRIGGER BEAT's light column (constants TRIGGER_BEAT, components/TriggerBeat.svelte): a soft vertical shaft,
// brightest at its foot (anchor 0.5, 1: it stands on the scatter) and gone at its top, its sides falling off smoothly.
// White: the sprite's tint is the colour. Built once.
let shaft: PIXI.Texture | null = null;
export const shaftTexture = (): PIXI.Texture => {
	if (shaft) return shaft;
	const W = 64;
	const H = 512;
	const c = document.createElement('canvas');
	c.width = W;
	c.height = H;
	const ctx = c.getContext('2d')!;
	const img = ctx.createImageData(W, H);
	for (let y = 0; y < H; y += 1) {
		const v = y / (H - 1); // 0 top .. 1 foot
		const along = Math.pow(v, 1.6) * (v > 0.94 ? (1 - v) / 0.06 : 1);
		for (let x = 0; x < W; x += 1) {
			const u = (x + 0.5) / W - 0.5;
			const across = Math.exp(-(u * u) / (2 * 0.17 * 0.17));
			const a = Math.round(255 * along * across);
			const i = (y * W + x) * 4;
			img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
			img.data[i + 3] = a;
		}
	}
	ctx.putImageData(img, 0, 0);
	shaft = PIXI.Texture.from(c);
	return shaft;
};

// THE TRIGGER BEAT's flare: a round soft halo, white (tinted by the sprite), anchor 0.5. Built once.
let halo: PIXI.Texture | null = null;
export const haloTexture = (): PIXI.Texture => {
	if (halo) return halo;
	const S = 128;
	const c = document.createElement('canvas');
	c.width = S;
	c.height = S;
	const ctx = c.getContext('2d')!;
	const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
	g.addColorStop(0, 'rgba(255,255,255,1)');
	g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
	g.addColorStop(0.6, 'rgba(255,255,255,0.15)');
	g.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, S, S);
	halo = PIXI.Texture.from(c);
	return halo;
};

// THE WAR STANDARD'S SUN (SUN_TEASE, components/SunTease.svelte): the disc of twelve long rays and twelve short ones, in
// gold, soft at the tips, with no near-white core (it is drawn additive at a low alpha over the dark wells; the house
// rule allows no new blend mode). Anchor 0.5. Built once.
let sun: PIXI.Texture | null = null;
export const sunTexture = (): PIXI.Texture => {
	if (sun) return sun;
	const S = 512;
	const c = document.createElement('canvas');
	c.width = S;
	c.height = S;
	const ctx = c.getContext('2d')!;
	const m = S / 2;
	// the glow behind it all
	const glow = ctx.createRadialGradient(m, m, 0, m, m, m);
	glow.addColorStop(0, 'rgba(255,196,96,0.42)');
	glow.addColorStop(0.35, 'rgba(255,176,72,0.16)');
	glow.addColorStop(1, 'rgba(255,160,60,0)');
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, S, S);
	const star = (n: number, ro: number, ri: number, off: number, inner: string, outer: string) => {
		const g = ctx.createRadialGradient(m, m, ri * 0.4, m, m, ro);
		g.addColorStop(0, inner);
		g.addColorStop(1, outer);
		ctx.fillStyle = g;
		ctx.beginPath();
		for (let i = 0; i < 2 * n; i += 1) {
			const a = (Math.PI * i) / n + off;
			const r = i % 2 === 0 ? ro : ri;
			const x = m + r * Math.sin(a);
			const y = m - r * Math.cos(a);
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.closePath();
		ctx.fill();
	};
	ctx.shadowColor = 'rgba(255,180,80,0.9)';
	ctx.shadowBlur = S * 0.03;
	// the short rays between, then the twelve long ones (the War Standard's emblem)
	star(12, S * 0.4, S * 0.19, Math.PI / 12, 'rgba(255,200,104,0.6)', 'rgba(255,170,60,0)');
	star(12, S * 0.49, S * 0.2, 0, 'rgba(255,208,118,0.9)', 'rgba(255,176,66,0)');
	// the disc: a gold face, a darker ring cut, the inner face
	const disc = (r: number, col: string) => {
		ctx.fillStyle = col;
		ctx.beginPath();
		ctx.arc(m, m, r, 0, Math.PI * 2);
		ctx.fill();
	};
	disc(S * 0.2, 'rgba(255,200,104,0.88)');
	ctx.shadowBlur = 0;
	disc(S * 0.165, 'rgba(214,150,62,0.85)');
	disc(S * 0.14, 'rgba(255,212,128,0.9)');
	sun = PIXI.Texture.from(c);
	return sun;
};

// The sun's light down the well: rising softly from its top edge (SUN_TEASE.washRamp), gone at its foot, its sides falling off. White (the sprite's
// tint is the colour). Anchor 0.5, 0. Built once.
let wash: PIXI.Texture | null = null;
export const washTexture = (): PIXI.Texture => {
	if (wash) return wash;
	const W = 32;
	const H = 256;
	const c = document.createElement('canvas');
	c.width = W;
	c.height = H;
	const ctx = c.getContext('2d')!;
	const img = ctx.createImageData(W, H);
	for (let y = 0; y < H; y += 1) {
		const v = y / (H - 1);
		// a soft top (2026-10-21, Corey: "The glow should be distributed throughout the sun"): it rises from nothing over
		// the first SUN_TEASE.washRamp of its length instead of starting at full, which drew a hard line across the sun
		const r = Math.min(1, v / SUN_TEASE.washRamp);
		const along = r * r * (3 - 2 * r) * Math.pow(1 - v, 0.8);
		for (let x = 0; x < W; x += 1) {
			const u = ((x + 0.5) / W) * 2 - 1;
			const across = Math.pow(Math.max(0, Math.cos((u * Math.PI) / 2)), 1.5);
			const i = (y * W + x) * 4;
			img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
			img.data[i + 3] = Math.round(255 * along * across);
		}
	}
	ctx.putImageData(img, 0, 0);
	wash = PIXI.Texture.from(c);
	return wash;
};

// A thread of light: a thin soft line along x, its ends faded. White. Anchor 0, 0.5 (it starts at its War Standard and is
// stretched to the sun). Built once.
let thread: PIXI.Texture | null = null;
export const threadTexture = (): PIXI.Texture => {
	if (thread) return thread;
	const W = 64;
	const H = 16;
	const c = document.createElement('canvas');
	c.width = W;
	c.height = H;
	const ctx = c.getContext('2d')!;
	const img = ctx.createImageData(W, H);
	for (let y = 0; y < H; y += 1) {
		const v = (y + 0.5) / H - 0.5;
		const across = Math.exp(-(v * v) / (2 * 0.16 * 0.16));
		for (let x = 0; x < W; x += 1) {
			const ends = Math.min(1, x / 4, (W - 1 - x) / 4);
			const i = (y * W + x) * 4;
			img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
			img.data[i + 3] = Math.round(255 * across * ends);
		}
	}
	ctx.putImageData(img, 0, 0);
	thread = PIXI.Texture.from(c);
	return thread;
};
