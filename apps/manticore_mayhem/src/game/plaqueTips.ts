// THE PLAQUE'S EXPLAINER LINES (Corey 2026-10-16: "Intentional, but maybe we can put some messages or explainers
// there"; 17:41 "Yes on the explainer lines", line 1 first and more often). On an idle base game board the empty bronze
// plaque under the board shows one short line at a time, engraved in the plaque's brass.
//
// r2 and r3 (2026-10-17 08:52 to 10:17) formed the lines out of gold particles. r4 (11:28) takes that out: "I think the
// particals was a bad idea, that's on me. Let's just use a side scroll for these, where the words start from the right
// edge, never show the full sentence, they need to be fed it. On exit they have to exit all the way to the left edge,
// not stop."
//
// So every line is a plain MARQUEE on every screen: one row at the scroll size, it enters from fully outside the right
// edge of the plaque's text box, moves left at one constant speed (a short ease in at its start, none at its end) and
// keeps going until its last letter has left the box's left edge. It never pauses or holds, and since every line is
// fed through the box it is never shown whole at once. Between lines the box is empty; no crest (r3).
//
// r5 (12:38): "I'd hope we could do the edges for enter and exit the slanted lines of the sides of the panel". The plaque
// is a trapezoid, wider at the bottom; the line now enters and leaves along the dark field's two SLANTED inner edges
// (PLAQUE_TIPS.edges, measured from the plaque art in its own px), so a letter is cut on the slant as it passes. The cut
// is the mesh itself: its four corners are that trapezoid window and the line scrolls through it by its UVs, on a
// texture drawn once per line and padded with clear pixels (clamped, so nothing repeats). No mask, filter or shader.
// components/BoardPlaque.svelte draws it; this file has the words, the order, the numbers and the path.
//
// PRESENTATION ONLY: nothing here reads or changes an outcome. The words are Corey's, exactly; tools' rules_probe.js
// banned-word list is checked against every line by feedback/plaque_tips_r4/plaque_tips_probe.js.

import { PLAQUE_RECAP } from './constants';

/** one plaque art's slanted inner edges (PLAQUE_TIPS.edges), art px */
export type PlaqueEdgeArt = { tex: readonly [number, number]; top: number; bottom: number; left: readonly [number, number]; right: readonly [number, number] };

/** Every number of the explainer lines. Layout units are the plaque figures' own flat space (boardPlaqueSpec.ts
 *  figureBlock: the figure row is 638 x 64 of them, centred on 0, y down), put through the same halved-lean homography
 *  as the figures, so the lines lean with the plaque. */
export const PLAQUE_TIPS = {
	// ---- the cadence ----
	/** THE LINES COME BACK this long after the board goes idle (1.0.04, Corey 2026-10-20: "maybe after 4 seconds"): the
	 *  first line of an idle spell enters idleResumeMs after the board settles (was startDelayMs 1200 + firstMs 800) */
	idleResumeMs: 4000,
	/** (before 1.0.04: the board settles this long before the cadence starts; idleResumeMs replaces it) */
	startDelayMs: 1200,
	/** "hidden as soon as a spin starts": a line on show fades out this fast when the board stops being idle */
	hideMs: 120,
	/** "Remove the icon in the middle of that board" (r3, 10:17): the plaque's crest is never drawn (false) */
	crest: false,
	/** the first line of an idle spell enters this long after startDelayMs: 2 s after the board settles in all (Corey
	 *  2026-10-17 20:43 "Fix the explainer lines", after the harsh re-review found a player who keeps spinning rarely
	 *  sees one; was 4700, 5900 ms in all) */
	firstMs: 800,
	/** from one line fully gone past the left edge to the next one entering at the right edge; the box is empty in
	 *  between. 6 s since 2026-10-17 20:43 (was 10 s, "maybe every 10 seconds it shows a message", 08:52) */
	gapMs: 6000,
	/** "muted enough that it does not compete with the board": the lines' opacity */
	alpha: 0.82,

	// ---- the marquee (r4, 11:28) ----
	/** THE SPEED, in ems (the line's font size) a second. r3's 4.5 em/s is about 7 letters a second, slower than reading
	 *  pace. Tune here: the same number on every screen, so a line takes the same time per letter everywhere */
	scrollEmPerSec: 4.5,
	/** a short ease in at the start of the line (no ease at its end: it leaves at full speed) */
	scrollEaseInMs: 300,

	// ---- the size (r3, kept) ----
	/** THE SIZE: a font this share of the text box's height (layout units; on the desktop about 24 CSS px), never under
	 *  scrollMinCss on screen (the phones), never over scrollMaxCss, nor with a cap height over scrollCapMax of the box */
	scrollBoxFrac: 0.56,
	scrollMinCss: 12.5,
	scrollMaxCss: 26,
	scrollCapMax: 0.6,
	/** "never show the full sentence" (r4, 11:28): the narrowest line on this screen is always at least this many times
	 *  the box's width, so no line ever fits in the box whole. Since r5 "the box's width" is the slanted window's width
	 *  at its narrowest row (its top), a little wider than r4's box, so this now lifts the size a few per cent on most
	 *  screens. On the six probed layouts r3's sizes already give 1.07 or
	 *  more, so this changes nothing there; on a big desktop (about 1700 CSS px wide and up), where scrollMaxCss would let
	 *  a short line fit, it lifts the size just enough. Never over the scrollCapMax height rule */
	scrollNarrowestOverBox: 1.04,

	// ---- the face and the box (r1) ----
	/** THE TEXT BOX inside the plaque's dark field, in layout units: [halfWidth, top, bottom]. The field measured from
	 *  the day plaque art (x +-331, y -49.5 to 44.5 in every layout but the phone's, x +-344, y -43.7 to 37.8 there),
	 *  less a margin so the letters never touch the rim. Since r5 its top and bottom are the window's top and bottom
	 *  rows and its halfWidth only sets the scale (CSS px per unit); the left and right cut is PLAQUE_TIPS.edges */
	box: {
		landscape: [312, -42, 38],
		portrait: [312, -42, 38],
		portraitTablet: [312, -42, 38],
		phone: [326, -37, 32],
	} as Record<string, readonly [number, number, number]>,
	/** THE SLANTED SIDES (r5, Corey 12:38): the inner edges of the plaque's dark text field, where the marquee is cut,
	 *  measured from each day plaque art in the art's OWN px (static/assets/ui/board-plaque-<art>.webp at its full size
	 *  `tex`; x right, y down). `top` and `bottom` are the field's top and bottom rows; `left` and `right` are each
	 *  edge's x at those two rows [atTop, atBottom]. Landscape and portrait: the inner side of the inlaid gold line
	 *  that rings the field; the phone art has no inlay, so the field's own edge. Every px is read as a share of `tex`
	 *  (so the half size tier, or any size the art is drawn at, gives the same line) and goes through the layout's
	 *  plaque box and homography (game/plaqueTips.ts slantEdges), so the cut sits on the art on every layout. The
	 *  portrait tablet layout draws the portrait art */
	edges: {
		landscape: { tex: [620, 123], top: 27, bottom: 93, left: [60.9, 36.8], right: [559.8, 584.1] },
		portrait: { tex: [648, 127], top: 27, bottom: 97, left: [64.1, 38.1], right: [584.7, 610.9] },
		phone: { tex: [612, 106], top: 20, bottom: 84, left: [39.5, 24.1], right: [572.2, 587.9] },
	} as Record<string, PlaqueEdgeArt>,
	/** the cut sits this many art px inside each measured edge, so no letter pixel ever lands on the gold line itself */
	edgeInsetArtPx: 0.5,
	/** the face: Cinzel, the intro cards' title face (ui/fontFaces.ts), a Roman inscription face; no new family */
	font: "700 {px}px Cinzel, 'Times New Roman', serif",
	fontCheck: '700 32px Cinzel',
	/** the brass of the letters, top to bottom of a line (the plaque figures' inlaid brass, a shade darker) */
	brassTop: '#e3c487',
	brassBottom: '#a8844c',
	/** the engraving: a dark lip above the letter and a faint warm light under it (layout units, colours) */
	lipOffset: -1.6,
	lipColor: 'rgba(14, 8, 3, 0.85)',
	lightOffset: 1.4,
	lightColor: 'rgba(255, 226, 170, 0.22)',
	/** the line's strip: this much (layout units) of empty margin each side of its text in the canvas, for the engraving */
	stripPad: 4,
	/** the texture's pixels per screen pixel (1: drawn at the screen's own density, the renderer's resolution) and its
	 *  largest side (a longer line is drawn a little softer rather than bigger) */
	texScale: 1,
	texMax: 2048,
	/** the mesh the texture is drawn on: columns x rows of quads through the homography */
	gridX: 24,
	gridY: 2,
};

/** a touch screen or a mouse (the HUD's own test, ui/ChromeStyles.svelte): line 1 says Tap or Click */
export const pointerIsMouse = (): boolean =>
	typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;

/** THE LINES (twelve of Corey's words, and since 1.0.04 line 2 pointing at the recap), Corey's words (brief of 2026-10-17; 11:29: the lines that began "His" begin "Manticore's"),
 *  line 1 first. `mouse`: the player has a mouse (Click, not Tap). Line 1 is the social wording r1 had for stake.us
 *  ("see its wins"), now on every site, so it needs no soc(); no line has a word of rules_probe.js SOCIAL_BANNED. */
/** `superAnte` (1.0.04): in Super Ante 4 or 5 War Standards are a Super (game_calculations.py bonus_type_from_scatters),
 *  so line 5 says so and line 6 is skipped (an empty line is never shown: the cadence goes on to the next) */
export const tipLines = (mouse: boolean, superAnte = false, recapLine = false): string[] => [
	mouse ? 'Click a symbol to see its wins' : 'Tap a symbol to see its wins',
	// THE RECAP (1.0.04, PLAQUE_RECAP): skipped ('') while autoplay runs or is loaded, and with nothing to show
	recapLine ? (mouse ? PLAQUE_RECAP.lineMouse : PLAQUE_RECAP.lineTouch) : '',
	'5 touching symbols make a cluster',
	'A win on a lit tile doubles it',
	'Wilds fill in for all but the War Standard',
	superAnte ? '4 or 5 War Standards: Super Free Spins' : '4 War Standards: Free Spins',
	superAnte ? '' : '5 War Standards: Super Free Spins',
	'6 or more War Standards: Epic Free Spins',
	"Manticore's sting can reveal War Standards",
	"Manticore's sting turns symbols Wild",
	// harsh review 2026-10-20 math 7 (Corey 2026-10-21 approved i): the War Standards in the band are never cleared and a lit
	// tile doubles, so the line says what the swipe does to the tiles of its 3 rows (was "clears 3 rows and lights tiles")
	"Manticore's Claw Swipe lights or doubles tiles in 3 rows",
	"Manticore's roar clears low symbols in Super and Epic",
	'In Free Spins, lit tiles stay all round',
];
export const TIP_COUNT = 13;

/** THE ORDER (2026-10-17 20:43). `slot` counts the lines shown this session (0 first), kept across idle spells, so
 *  each spell goes on where the last one stopped: line 1 leads once, then all twelve take their turn (was line 1
 *  back every third line, and every spell restarting at line 1). Returns the line's index (0 is line 1); `other` and
 *  `usesOther` stay for the caller and are no longer used. */
export const tipAt = (slot: number, _other = 0): { index: number; usesOther: boolean } => ({ index: slot % TIP_COUNT, usesOther: false });

/** the size of every line on this screen (one row, one size for all). The box is [halfWidth, top, bottom], `kCss` the
 *  CSS px per layout unit across the box, `capK` the face's cap height per font size, `narrowestK` the narrowest
 *  line's width per font size and `windowW` the width (layout units) a line must never fit in: the slanted window at
 *  its narrowest row (r5; r4's box width when not given). Returns the font size in layout units: scrollBoxFrac of the
 *  box's height, scrollMinCss to scrollMaxCss on screen, but never so small that the narrowest line is under
 *  scrollNarrowestOverBox of windowW, and its cap never over scrollCapMax of the box */
export const tipFont = (box: readonly [number, number, number], kCss: number, capK: number, narrowestK: number, windowW = 2 * box[0]): number => {
	const Hh = box[2] - box[1];
	const k = kCss > 0 ? kCss : 1;
	const r3 = Math.min(Math.max(PLAQUE_TIPS.scrollBoxFrac * Hh, PLAQUE_TIPS.scrollMinCss / k), PLAQUE_TIPS.scrollMaxCss / k);
	const neverWhole = narrowestK > 0 ? (PLAQUE_TIPS.scrollNarrowestOverBox * windowW) / narrowestK : 0;
	return Math.min(Math.max(r3, neverWhole), (PLAQUE_TIPS.scrollCapMax * Hh) / Math.max(0.3, capK));
};

/** THE SLANTED WINDOW (r5) in layout units: each slanted edge's x at the box's top row and at its bottom row (left
 *  top, left bottom, right top, right bottom). `art` is the plaque art's edges (PLAQUE_TIPS.edges), `plaqueBox` the
 *  render box the art is drawn over ([x, y, w, h], boardPlaqueSpec render.plaqueBox), `H` the layout's homography
 *  (layout units to render px, h8 = 1). Each edge's two ends go art px, to render px, back through H to layout units;
 *  a homography keeps a line a line, so the edge is straight in layout units too and is read off at the two rows */
export type SlantEdges = { lt: number; lb: number; rt: number; rb: number };
export const slantEdges = (art: PlaqueEdgeArt, plaqueBox: readonly number[], H: readonly number[], top: number, bot: number): SlantEdges => {
	const inset = PLAQUE_TIPS.edgeInsetArtPx;
	/** art px to layout units: the render point (X, Y) solved back through H */
	const back = (ax: number, ay: number): [number, number] => {
		const X = plaqueBox[0] + (ax / art.tex[0]) * plaqueBox[2];
		const Y = plaqueBox[1] + (ay / art.tex[1]) * plaqueBox[3];
		const a = H[0] - X * H[6];
		const b = H[1] - X * H[7];
		const c = H[3] - Y * H[6];
		const d = H[4] - Y * H[7];
		const e = X - H[2];
		const f = Y - H[5];
		const det = a * d - b * c;
		return [(e * d - b * f) / det, (a * f - c * e) / det];
	};
	const at = (p: [number, number], q: [number, number], y: number) => p[0] + ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1]);
	const l0 = back(art.left[0] + inset, art.top);
	const l1 = back(art.left[1] + inset, art.bottom);
	const r0 = back(art.right[0] - inset, art.top);
	const r1 = back(art.right[1] - inset, art.bottom);
	return { lt: at(l0, l1, top), lb: at(l0, l1, bot), rt: at(r0, r1, top), rb: at(r0, r1, bot) };
};
/** a slanted edge's x at layout row y (x0 at the box's top row, x1 at its bottom row) */
export const edgeAt = (x0: number, x1: number, top: number, bot: number, y: number): number => x0 + ((x1 - x0) * (y - top)) / (bot - top);

/** THE MARQUEE'S PATH. A line's strip (its text and a stripPad margin) starts with its left edge on the window's
 *  outermost right point (the right slanted edge's bottom end: all of it outside that edge) and ends with its right
 *  edge on the window's outermost left point (all of it past the left slanted edge): `dist` is the window's widest
 *  span plus the strip's, at `v` layout
 *  units a ms. marqueeSpan: its whole length in ms (the ease in costs half of scrollEaseInMs); marqueeAt: how far it has
 *  moved `t` ms in (0 to dist), easing in over the first scrollEaseInMs and then at v to the end, no ease out */
export const marqueeSpan = (dist: number, v: number): { ms: number; ease: number } => {
	if (dist <= 0 || v <= 0) return { ms: 0, ease: 0 };
	const ease = Math.min(PLAQUE_TIPS.scrollEaseInMs, dist / v);
	return { ms: dist / v + ease / 2, ease };
};
export const marqueeAt = (t: number, dist: number, v: number, ms: number, ease: number): number => {
	if (dist <= 0 || t <= 0) return 0;
	if (t >= ms) return dist;
	if (ease > 0 && t < ease) return (v * t * t) / (2 * ease);
	return Math.min(dist, (v * ease) / 2 + v * (t - ease));
};
