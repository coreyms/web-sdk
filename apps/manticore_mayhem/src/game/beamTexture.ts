import * as PIXI from 'pixi.js';

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
