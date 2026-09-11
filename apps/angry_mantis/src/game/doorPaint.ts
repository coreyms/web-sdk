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
		super: { w: 0.97, introY: 0.23, outroY: 0.23 }, // same height on both doors (Corey 2026-09-10 evening)
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
		// the eaten trays LEAN on the door with their feet on the counter (the frame's bottom rail),
		// lined up like someone set them down (Corey 2026-09-11): each casts a wedge of shadow onto
		// the door behind it — nothing where its top corners touch the door, flaring outward and
		// darkening down to its foot — and mirrors onto the band of rail under it.
		trays: {
			size: 0.15, // × door width
			gap: 0.105,
			railSit: 30, // frame-art px below the window bottom where the trays' bottom edge rests (rail top face 1121-1142, seam to 1149; window bottom 1097)
			artBottom: 0.962, // the tray art's bottom pixel as a fraction of its frame (measured 0.957-0.973 across the eaten frames): the tray STANDS on this edge and the reflection starts from it
			shadow: { flare: 0.14, alpha: 0.75, bands: 12, artWidth: 0.96, artTop: 0.04 }, // flare × size each side at the foot; alpha at the foot (0 at the top); bands = the ramp's slices; the tray art's width and top inset as fractions of its frame
			reflect: { squash: 0.25, alpha: 0.6, tint: 0x9fd2ff }, // FrameReflections' steel-blue additive sheen, clipped to the band under the trays
		},
		plate: { w: 0.99, y: 0.62 }, // 8 px lower than the first pass, placed live with Corey (2026-09-11)
		// h × plate height; dy × plate height; dx × plate width; maxW × plate width — a long string
		// (GC 819,300.00) shrinks to fit the plate's clear panel instead of spilling off the door,
		// the same cap the mid-feature stinger applies (STINGER_BOX.big w 50% × fillW .96)
		amountInPlate: { h: 0.36, dy: 0.12, dx: 0.12, maxW: 0.48 },
		// bare steel under big win: h × door width, maxW × door width; bigger than the first pass —
		// it was hard to read on a phone (Corey 2026-09-10)
		amountOnDoor: { h: 0.1, y: 0.6, maxW: 0.9 },
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

// A layer never samples its texture's outermost rows/columns: on a minified draw the GPU's
// filtering blends those with the transparent margin (and, on the mipmapped plate, with whatever
// colour the encoder left under alpha 0), which painted a bright hairline along the plate's top
// edge on Corey's monitor (2026-09-11) while the headless renderer showed nothing. Every painted
// texture keeps an empty margin wider than this inset.
const float EDGE = 0.004;
vec4 box(sampler2D t, vec2 uv) {
	return (uv.x > EDGE && uv.x < 1.0 - EDGE && uv.y > EDGE && uv.y < 1.0 - EDGE) ? texture(t, uv) : vec4(0.0);
}
// Lossy WebP leaves an alpha floor of a few /255 across a texture's transparent area, and the
// numeral frames carry a baked drop shadow at low alpha over most of their box: painted at face
// value, both read as a faint lighter rectangle around every glyph on a large monitor (Corey
// 2026-09-11). Anything under 3% is not paint.
float paintAlpha(float a) {
	return clamp((a - 0.03) / 0.97, 0.0, 1.0);
}
// a numeral texel is INK only where it is white: the outline and shadow in the frame are dark
float inkAlpha(vec4 s) {
	return s.a * smoothstep(0.35, 0.75, s.r);
}
vec3 paintOver(vec3 under, vec3 base, float a) {
	a = paintAlpha(a);
	vec3 shade = vec3(pow(max(ratio, 0.001), uMetal.z));
	float floorK = 1.0 - uMetal.w * clamp(1.0 - ratio, 0.0, 1.0);
	// the steel-lip highlight belongs on SOLID paint only: at a layer's anti-aliased edge (the
	// header band's soft bottom over the slat seam beneath it) it was added — white, unscaled by
	// the base — and mixed in by the fringe's alpha, so that one seam glowed as a hairline between
	// the header and the plate (Corey 2026-09-11, on a large monitor). Fringes get no lip at all.
	vec3 paint = base * shade * floorK + vec3(uLip * max(grad, 0.0) * smoothstep(0.65, 0.95, a));
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
		vec2 cuv = vec2(d.x / uCountBox.z + 0.5, d.y / uCountBox.w + 0.5);
		vec4 c = box(uCount, cuv);
		// the plate (uCountRGB): its art carries a light bevel highlight along its top and bottom
		// rims (rows 8-14 of 651 at the top), which the groove treatment flattened into a bright
		// hairline along the rust wherever a rim met a slat seam (Corey 2026-09-11, on a large
		// monitor). Ease the plate in over its top and bottom 3% so the rims melt into the rust;
		// the ragged edges keep their shape.
		float plateIn = uCountRGB > 0.5 ? smoothstep(EDGE, EDGE + 0.03, cuv.y) * smoothstep(EDGE, EDGE + 0.03, 1.0 - cuv.y) : 1.0;
		// premultiplied on upload: un-premultiply (floored, so faint edge texels are not amplified)
		col = paintOver(col, uCountRGB > 0.5 ? c.rgb / max(c.a, 0.25) : uCream, c.a * plateIn);
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
			col = paintOver(col, uShadowColor, inkAlpha(s));
		}
	}
	for (int i = 0; i < 16; i++) {
		if (float(i) >= uGlyphCount) break;
		vec4 b = uGlyphBox[i];
		vec4 q = uGlyphUV[i];
		vec2 p = vUV;
		if (p.x > b.x && p.x < b.z && p.y > b.y && p.y < b.w) {
			vec4 s = texture(uNumerals, vec2(mix(q.x, q.z, (p.x - b.x) / (b.z - b.x)), mix(q.y, q.w, (p.y - b.y) / (b.w - b.y))));
			col = paintOver(col, uAmtColor, inkAlpha(s));
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
