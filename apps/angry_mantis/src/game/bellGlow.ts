import * as PIXI from 'pixi.js';

// Glow behind the Service Bell (Corey 2026-09-10, picked from the bell-glow artifact: "rays +
// ding ripple"). Three WHITE textures baked once at boot and tinted at draw time, so the colour
// is one constant here — Corey is not sold on the hue yet — and the same three sprites serve any
// future re-tint. Drawn additively under the hero bell (Mantis.svelte); the board tile gets a
// static bake of the halo + rays behind its frames from tools/make_placeholders.py (same hex).
// No filters, nothing rasterised per frame (house rule 1): the ticker only moves alpha/rotation.
export const BELL_GLOW = {
	color: 0xc4bc00, // keep in sync with BELL_GLOW_HEX in tools/make_placeholders.py
	strength: 1.0, // alpha ceiling of the halo
	size: 2.4, // halo/ray wheel diameter in bell widths
	pulseHz: 0.9, // halo breathes 0.75..1 of strength on a sine
	raysAlpha: 0.75,
	raysRadPerSec: 0.35, // slow turn
	haloScale: 0.7, // the halo under the rays is smaller than the wheel
	fadeInMs: 390, // rides the bell's drop (Mantis dropMs)
	ripple: { size: 2.0, ms: 950 }, // ring expands 0.6 → size bell widths and fades over ms, once per ding
	// the bell TILE on the board (ReelSymbol): the same live halo + ray wheel under it, smaller and
	// softer than the hero's so it lights the neighbours without swallowing them. The static bake
	// in the sheet (make_placeholders) is clipped to the cell and reads as nothing next to the hero
	// (Corey 2026-09-11).
	tile: { size: 1.7, strength: 0.7 },
} as const;

const TEX = 512;
const RAYS = 14;
let halo: PIXI.Texture | undefined;
let rays: PIXI.Texture | undefined;
let ring: PIXI.Texture | undefined;

const canvas = () => {
	const c = document.createElement('canvas');
	c.width = c.height = TEX;
	return c;
};

/** soft radial blob, opaque white core to transparent rim */
export const bellHaloTexture = (): PIXI.Texture => {
	if (halo) return halo;
	const c = canvas();
	const ctx = c.getContext('2d')!;
	const g = ctx.createRadialGradient(TEX / 2, TEX / 2, 0, TEX / 2, TEX / 2, TEX / 2);
	g.addColorStop(0, 'rgba(255,255,255,0.9)');
	g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
	g.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, TEX, TEX);
	halo = PIXI.Texture.from(c);
	return halo;
};

/** sunburst wheel: RAYS wedges fading out towards the rim */
export const bellRaysTexture = (): PIXI.Texture => {
	if (rays) return rays;
	const c = canvas();
	const ctx = c.getContext('2d')!;
	ctx.translate(TEX / 2, TEX / 2);
	for (let i = 0; i < RAYS; i++) {
		ctx.rotate((Math.PI * 2) / RAYS);
		const g = ctx.createLinearGradient(0, 0, TEX / 2, 0);
		g.addColorStop(0, 'rgba(255,255,255,0.55)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(TEX / 2, -22);
		ctx.lineTo(TEX / 2, 22);
		ctx.closePath();
		ctx.fill();
	}
	rays = PIXI.Texture.from(c);
	return rays;
};

/** the ding ripple: one soft ring (blur baked here, once) */
export const bellRingTexture = (): PIXI.Texture => {
	if (ring) return ring;
	const c = canvas();
	const ctx = c.getContext('2d')!;
	ctx.strokeStyle = 'rgba(255,255,255,0.85)';
	ctx.lineWidth = 18;
	ctx.shadowColor = 'rgba(255,255,255,0.9)';
	ctx.shadowBlur = 24;
	ctx.beginPath();
	ctx.arc(TEX / 2, TEX / 2, 200, 0, Math.PI * 2);
	ctx.stroke();
	ring = PIXI.Texture.from(c);
	return ring;
};

/** per-frame pose of the glow: t = ms since the bell started dropping, ding = ms since the ding (or null) */
export const bellGlowPose = (t: number, ding: number | null) => {
	const fade = Math.min(1, t / BELL_GLOW.fadeInMs);
	const pulse = 0.75 + 0.25 * Math.sin((t / 1000) * BELL_GLOW.pulseHz * Math.PI * 2);
	const k = ding === null ? 1 : ding / BELL_GLOW.ripple.ms;
	return {
		haloAlpha: BELL_GLOW.strength * fade * 0.8 * pulse,
		raysAlpha: BELL_GLOW.strength * fade * BELL_GLOW.raysAlpha,
		raysRotation: (t / 1000) * BELL_GLOW.raysRadPerSec,
		// ring: 0.6 → ripple.size bell widths, alpha 1 → 0; null once it has faded
		ring: ding !== null && k < 1 ? { size: 0.6 + k * BELL_GLOW.ripple.size, alpha: BELL_GLOW.strength * (1 - k) } : null,
	};
};
