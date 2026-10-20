import * as PIXI from 'pixi.js';

// THE PLAQUE'S SOFT GOLD DOT (1.0.04; the move to the HUD's streak, its trail and the pulse behind the HUD's WIN, and the
// hit badge's glow: components/BoardPlaque.svelte). One white radial falloff baked ONCE and cached, the
// game/beamTexture.ts pattern (house rule: no per-frame textures, no filters); drawn tinted and with the additive blend.
let dot: PIXI.Texture | null = null;
export const plaqueGlowTexture = (): PIXI.Texture => {
	if (dot) return dot;
	const N = 64;
	const c = document.createElement('canvas');
	c.width = c.height = N;
	const ctx = c.getContext('2d') as CanvasRenderingContext2D;
	const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
	// a gaussian-like falloff (exp(-1.6 r^2), the mock-ups' own)
	for (let i = 0; i <= 10; i += 1) {
		const r = i / 10;
		g.addColorStop(r, `rgba(255,255,255,${Math.exp(-1.6 * r * r * 4).toFixed(4)})`);
	}
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, N, N);
	dot = PIXI.Texture.from(c);
	dot.label = 'plaque-glow';
	return dot;
};
