import * as PIXI from 'pixi.js';

// Mantis floor shadows (Corey's values from the Mantis Shadow artifact, 2026-09-08). Everything
// length-like is a share of H, the rig's idle-pose height on screen (0.72 × `size`: measured
// 345 px for size 480), so the look holds across layouts. Angles are the screen direction the
// shadow points (90 = toward the camera, 270 = toward the back wall).
export const MANTIS_SHADOW = {
	bodyH: 0.72,
	feet: {
		width: 0.15, // oval width as a share of H
		aspect: 0.16, // oval height as a share of its width
		alpha: 0.21,
		softness: 0.0507, // gaussian blur radius, share of H (17.5 px at H 345)
		toe: -0.0014, // all ovals up/down, share of H
		// ankle bone → toe tip, in RIG units (measured on the idle pose from the silhouette), plus
		// Corey's per-foot nudges as shares of H
		offsets: {
			'Right Foot': { rig: { x: -37, y: 22 }, nudge: { x: 0.0522, y: 0.0058 } }, // middle
			Foot: { rig: { x: -85, y: 56 }, nudge: { x: 0.0609, y: 0.0058 } }, // raised front
			'Left Front Foot': { rig: { x: -80, y: 68 }, nudge: { x: 0.0783, y: 0.0058 } }, // planted front
			'Left Back Foot': { rig: { x: 86, y: 63 }, nudge: { x: -0.0464, y: 0.0087 } }, // rear
		} as Record<string, { rig: { x: number; y: number }; nudge: { x: number; y: number } }>,
		liftSpan: 0.35, // a foot this far (share of `size`) above its rest line has lost its oval
	},
	// the rig rendered into a small render texture, tinted black and flattened onto the floor
	front: { angleDeg: 101, length: 0.49, width: 1, alpha: 0.24, resolution: 0.35, fade: 0.82, start: -0.0058 },
	back: { angleDeg: 273, length: 0.18, width: 1, alpha: 0.21, resolution: 0.12, fade: 0.85, start: 0 },
	// the same soft silhouette thrown upright onto the board frame's post beside the mantis
	frame: { alpha: 0.22, dx: -0.1, dy: 0, scale: 1 },
	rtMargin: 0.15, // render-texture bounds: the idle pose's local bounds grown by this share each side
};

// ---- baked textures (once per size; house rule: no per-frame textures) ----
const ovals = new Map<string, PIXI.Texture>();
/** a black ellipse w×h blurred by `blur` px, drawn at 2× into a padded canvas */
export const footOvalTexture = (w: number, h: number, blur: number): PIXI.Texture => {
	const key = `${Math.round(w)}x${Math.round(h)}b${Math.round(blur)}`;
	const have = ovals.get(key);
	if (have) return have;
	const S = 2;
	const pad = Math.ceil(blur * 2.5) + 2;
	const c = document.createElement('canvas');
	c.width = Math.ceil((w + pad * 2) * S);
	c.height = Math.ceil((h + pad * 2) * S);
	const ctx = c.getContext('2d')!;
	ctx.filter = blur > 0 ? `blur(${blur * S}px)` : 'none';
	ctx.fillStyle = '#000';
	ctx.beginPath();
	ctx.ellipse(c.width / 2, c.height / 2, (w / 2) * S, (h / 2) * S, 0, 0, Math.PI * 2);
	ctx.fill();
	const tex = PIXI.Texture.from(c);
	ovals.set(key, tex);
	return tex;
};
/** 1×64 vertical strip: alpha `fade` at the top down to 0 at the bottom (an 'erase' pass over the
 *  silhouette thins the far end of a shadow to 1 − fade) */
const fades = new Map<number, PIXI.Texture>();
export const fadeTexture = (fade: number): PIXI.Texture => {
	const key = Math.round(fade * 100);
	const have = fades.get(key);
	if (have) return have;
	const c = document.createElement('canvas');
	c.width = 1;
	c.height = 64;
	const ctx = c.getContext('2d')!;
	const g = ctx.createLinearGradient(0, 0, 0, 64);
	g.addColorStop(0, `rgba(255,255,255,${fade})`);
	g.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 1, 64);
	const tex = PIXI.Texture.from(c);
	fades.set(key, tex);
	return tex;
};

// ---- registry: what FrameShadow.svelte needs from each mounted rig ----
export type MantisShadowSource = {
	texture: PIXI.Texture; // the soft (back) render texture, updated every tick
	mirror: boolean;
	/** screen px per render-texture unit (the rig's on-screen scale; the texture is in view-local units) */
	k: number;
	/** anchor of the toe line inside the texture (0..1) */
	anchor: { x: number; y: number };
	/** the toe line's centre, in world (canvas) px */
	toeWorld: () => { x: number; y: number };
	/** idle-pose height on screen, master px */
	H: number;
};
const sources = new Map<string, MantisShadowSource>();
export const setMantisShadowSource = (name: string, src: MantisShadowSource | null) => {
	if (src) sources.set(name, src);
	else sources.delete(name);
};
export const mantisShadowSources = () => sources;
