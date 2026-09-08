import * as PIXI from 'pixi.js';

// Baked light textures for the scatter tease (Anticipation.svelte), built once and cached —
// house rule: no per-frame textures, no filters. Colours are the artifact's.

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
