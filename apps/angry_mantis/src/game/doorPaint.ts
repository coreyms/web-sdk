// Painted-on door layers (Corey 2026-09-10, values from the "Painted Door Screens" artifact).
//
// The bonus intro and the wrap-up no longer lay art OVER the steel door: DoorPaint.svelte draws one
// mesh the exact size of the door with a fragment shader that multiplies every painted pixel by the
// metal under it (static/assets/ui/paint/door-groove.webp, tools/build_groove_map.py), so the stencil
// sits in the grooves, the strokes push beside the numeral, the stars turn, and the whole thing rides
// the door as it rolls — with no filter pass and no render texture (house rules 1 and 6).
//
// Every position is a FRACTION OF THE DOOR IMAGE: x of its width, y of its height (top-left
// origin), sizes of its width. Those are the artifact's readout units verbatim, so a re-tune is a
// number change here. The door rect itself comes from layoutSpec.doorRect().
import type { BonusMode } from './types';

export const DOOR_PAINT = {
	yellow: 0xf0b013, // the logo's yellow: header + stars
	cream: 0xefe6cf, // free-spin count + strokes
	metal: { opacity: 1, wear: 0.1, grooveStrength: 0.25, grooveFloor: 0.63, lipHighlight: 0.79 },
	// mode header (paint/header-{bonus,super,feast}.webp), centred; y differs between the intro
	// and the wrap-up (Super sits higher on the wrap-up)
	header: {
		free: { w: 0.9, introY: 0.2, outroY: 0.2 },
		super: { w: 0.97, introY: 0.23, outroY: 0.185 },
		feast: { w: 1.0, introY: 0.22, outroY: 0.22 },
	} satisfies Record<BonusMode, { w: number; introY: number; outroY: number }>,
	// a star in each header bracket, the left one turning anticlockwise and the right clockwise
	stars: {
		free: { size: 0.135, x: 0.345, dy: -0.045 },
		super: { size: 0.14, x: 0.385, dy: -0.035 },
		feast: { size: 0.14, x: 0.385, dy: -0.035 },
	} satisfies Record<BonusMode, { size: number; x: number; dy: number }>,
	starDegPerSec: 180,
	// the free-spin count (paint/free-spins-{8,10}.webp), intro only
	count: { w: 0.52, y: 0.645 },
	// six brush strokes (paint/ray.webp), three per side of the numeral, each pushing in and out
	// along its own axis. 'sym' fans above and below the horizontal; 'up' keeps the bottom stroke
	// flat and steps the others up (the 10 reads better that way)
	rays: {
		free: { layout: 'sym', y: 0.56, fanDeg: 21, dist: 0.21 },
		super: { layout: 'up', y: 0.685, fanDeg: 17, dist: 0.275 },
		feast: { layout: 'up', y: 0.685, fanDeg: 17, dist: 0.275 },
	} satisfies Record<BonusMode, { layout: 'sym' | 'up'; y: number; fanDeg: number; dist: number }>,
	rayMotion: { strokeLen: 0.13, push: 0.001, pushHz: 1.7, stagger: 0.6, sideOffset: 0, stretch: 0.05 },
	// wrap-up: eaten trays (sprites over the door, FreeSpinOutro), the BIG WIN plate painted in
	// its own colours with the amount inside it, or — under big win — no plate, amount on the door
	outro: {
		trays: { size: 0.15, gap: 0.105, y: 0.83 },
		plate: { w: 0.99, y: 0.605 },
		amountInPlate: { h: 0.36, dy: 0.12, dx: 0.12 }, // h × plate height; dy × plate height; dx × plate width
		amountOnDoor: { h: 0.075, y: 0.6 }, // h × door width
		amountColor: 0xffffff,
		amountShadow: 0x000000,
		shadowOffset: { dx: 0.054, dy: 0.059 }, // × digit height (StingerPlate's run)
	},
} as const;

/** door-image aspect, height over width — y fractions are scaled by it wherever a size is in x units */
export const DOOR_ASPECT = 1028 / 1246;

export const MAX_PAINTED_GLYPHS = 16;

// ---- shader ----------------------------------------------------------------------------------
// GLSL for Pixi 8's GL renderer (it prepends the version / WebGL1 defines itself). Coordinates are
// door-image uv; `uAspect` = (1, DOOR_ASPECT) turns uv deltas into x-width units so sizes read the
// same on both axes. Layers composite in order: header + stars (yellow), count/plate, strokes,
// amount shadow then amount. Each layer is one texture box test; the strokes are six.

export const DOOR_PAINT_VERTEX = /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
	mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
	gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
	vUV = aUV;
}
`;

export const DOOR_PAINT_FRAGMENT = /* glsl */ `
precision mediump float;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uDoor;
uniform sampler2D uGroove;
uniform sampler2D uHeader;
uniform sampler2D uStar;
uniform sampler2D uCount;
uniform sampler2D uRays;
uniform sampler2D uNumerals;
uniform vec2 uAspect;
uniform vec3 uYellow;
uniform vec3 uCream;
uniform vec3 uAmtColor;
uniform vec3 uShadowColor;
uniform vec4 uMetal;   // opacity, wear, groove strength, groove floor
uniform float uLip;
uniform vec4 uHeaderBox; // cx, cy, w, h  (0 w = off)
uniform vec2 uStarPos[2];
uniform float uStarAng[2];
uniform float uStarSize;   // 0 = off
uniform vec4 uCountBox;    // cx, cy, w, h (0 w = off)
uniform float uCountRGB;   // 1 = paint with the texture's own colours (the plate)
uniform vec2 uRayPos[6];
uniform float uRayAng[6];
uniform float uRayStretch[6];
uniform vec3 uRayDims;     // len, wid, flip (0 len = off)
uniform vec4 uGlyphUV[16];  // atlas u0 v0 u1 v1
uniform vec4 uGlyphBox[16]; // door uv x0 y0 x1 y1
uniform float uGlyphCount;
uniform vec2 uShadowOff;

vec3 door; float ratio; float grad; float chip;

vec4 box(sampler2D t, vec2 uv) {
	return (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? texture(t, uv) : vec4(0.0);
}
vec3 paintOver(vec3 under, vec3 base, float a) {
	vec3 shade = vec3(pow(max(ratio, 0.001), uMetal.z));
	float floorK = 1.0 - uMetal.w * clamp(1.0 - ratio, 0.0, 1.0);
	vec3 paint = base * shade * floorK + vec3(uLip * max(grad, 0.0));
	paint = mix(paint, paint * (0.6 + 0.8 * door), 0.25); // the door's own hue bleeds through a touch
	return mix(under, paint, a * chip * uMetal.x);
}
void main() {
	door = texture(uDoor, vUV).rgb;
	vec3 g = texture(uGroove, vUV).rgb;
	ratio = g.r * 2.0;
	grad = (g.g - 0.5) * 2.0;
	chip = smoothstep(uMetal.y - 0.12, uMetal.y + 0.12, g.b);
	vec3 col = door;
	// 1. header + stars
	float aY = 0.0;
	if (uHeaderBox.z > 0.0) {
		vec2 d = (vUV - uHeaderBox.xy) * uAspect;
		aY = box(uHeader, vec2(d.x / uHeaderBox.z + 0.5, d.y / uHeaderBox.w + 0.5)).a;
	}
	if (uStarSize > 0.0) {
		for (int i = 0; i < 2; i++) {
			vec2 d = (vUV - uStarPos[i]) * uAspect / uStarSize;
			float ca = cos(uStarAng[i]), sa = sin(uStarAng[i]);
			aY = max(aY, box(uStar, vec2(d.x * ca - d.y * sa, d.x * sa + d.y * ca) + 0.5).a);
		}
	}
	col = paintOver(col, uYellow, aY);
	// 2. the count (cream) or the plate (its own colours)
	if (uCountBox.z > 0.0) {
		vec2 d = (vUV - uCountBox.xy) * uAspect;
		vec4 c = box(uCount, vec2(d.x / uCountBox.z + 0.5, d.y / uCountBox.w + 0.5));
		col = paintOver(col, uCountRGB > 0.5 ? c.rgb : uCream, c.a);
	}
	// 3. six strokes
	if (uRayDims.x > 0.0) {
		float aR = 0.0;
		for (int i = 0; i < 6; i++) {
			vec2 d = (vUV - uRayPos[i]) * uAspect;
			float ca = cos(uRayAng[i]), sa = sin(uRayAng[i]);
			float u = (d.x * ca + d.y * sa) / (uRayDims.x * uRayStretch[i]);
			float w = (-d.x * sa + d.y * ca) / uRayDims.y;
			aR = max(aR, box(uRays, vec2(0.5 + u * uRayDims.z, 0.5 + w)).a);
		}
		col = paintOver(col, uCream, aR);
	}
	// 4. the amount: shadow run, then ink. The atlas bakes an outline + drop shadow into each
	// frame, so only the white INK (alpha × red) is painted. Array indexing stays on the loop
	// symbol: GLSL ES 1.00 (WebGL1) forbids indexing a uniform array by a function argument.
	for (int i = 0; i < 16; i++) {
		if (float(i) >= uGlyphCount) break;
		vec4 b = uGlyphBox[i];
		vec4 q = uGlyphUV[i];
		vec2 p = vUV - uShadowOff;
		if (p.x > b.x && p.x < b.z && p.y > b.y && p.y < b.w) {
			vec4 s = texture(uNumerals, vec2(mix(q.x, q.z, (p.x - b.x) / (b.z - b.x)), mix(q.y, q.w, (p.y - b.y) / (b.w - b.y))));
			col = paintOver(col, uShadowColor, s.a * s.r);
		}
	}
	for (int i = 0; i < 16; i++) {
		if (float(i) >= uGlyphCount) break;
		vec4 b = uGlyphBox[i];
		vec4 q = uGlyphUV[i];
		vec2 p = vUV;
		if (p.x > b.x && p.x < b.z && p.y > b.y && p.y < b.w) {
			vec4 s = texture(uNumerals, vec2(mix(q.x, q.z, (p.x - b.x) / (b.z - b.x)), mix(q.y, q.w, (p.y - b.y) / (b.w - b.y))));
			col = paintOver(col, uAmtColor, s.a * s.r);
		}
	}
	finalColor = vec4(col, 1.0);
}
`;

/** can the wrap-up paint this amount? (every character in the stencil atlas, and few enough glyphs
 *  for the shader's fixed slots) — otherwise FreeSpinOutro lays the sprite count-up over the door */
export const paintedAmountSupported = (text: string, tokenize: (t: string) => (string | null)[] | null) => {
	const tokens = tokenize(text);
	return tokens !== null && tokens.filter((t) => t !== null).length <= MAX_PAINTED_GLYPHS;
};
