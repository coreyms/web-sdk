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
// fed through the box it is never shown whole at once. The box cuts it hard at both edges (the mesh only spans the part
// inside the box: no mask). Between lines the box is empty; no crest (r3).
// components/BoardPlaque.svelte draws it; this file has the words, the order, the numbers and the path.
//
// PRESENTATION ONLY: nothing here reads or changes an outcome. The words are Corey's, exactly; tools' rules_probe.js
// banned-word list is checked against every line by feedback/plaque_tips_r4/plaque_tips_probe.js.

/** Every number of the explainer lines. Layout units are the plaque figures' own flat space (boardPlaqueSpec.ts
 *  figureBlock: the figure row is 638 x 64 of them, centred on 0, y down), put through the same halved-lean homography
 *  as the figures, so the lines lean with the plaque. */
export const PLAQUE_TIPS = {
	// ---- the cadence ----
	/** the board settles (idle, the spin amount gone from the plaque) this long before the cadence starts (r1's delay) */
	startDelayMs: 1200,
	/** "hidden as soon as a spin starts": a line on show fades out this fast when the board stops being idle */
	hideMs: 120,
	/** "Remove the icon in the middle of that board" (r3, 10:17): the plaque's crest is never drawn (false) */
	crest: false,
	/** the first line of an idle spell enters this long after startDelayMs. r4 keeps r3's first line timing: r3 started
	 *  its first line 1200 + 700 (r3's fade in) + 4000 ms after the board settled, 5900 ms in all */
	firstMs: 4700,
	/** "maybe every 10 seconds it shows a message" (08:52, 08:59 "Yes"): from one line fully gone past the left edge to
	 *  the next one entering at the right edge; the box is empty in between */
	gapMs: 10000,
	/** "line 1 coming back every 3 lines (1, 2, 3, 1, 4, 5, 1, ...)": every this many lines is line 1 */
	firstEvery: 3,
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
	 *  the box's width, so no line ever fits in the box whole. On the six probed layouts r3's sizes already give 1.07 or
	 *  more, so this changes nothing there; on a big desktop (about 1700 CSS px wide and up), where scrollMaxCss would let
	 *  a short line fit, it lifts the size just enough. Never over the scrollCapMax height rule */
	scrollNarrowestOverBox: 1.04,

	// ---- the face and the box (r1) ----
	/** THE TEXT BOX inside the plaque's dark field, in layout units: [halfWidth, top, bottom]. The field measured from
	 *  the day plaque art (x +-331, y -49.5 to 44.5 in every layout but the phone's, x +-344, y -43.7 to 37.8 there),
	 *  less a margin so the letters never touch the rim. The marquee is cut at its left and right edges */
	box: {
		landscape: [312, -42, 38],
		portrait: [312, -42, 38],
		portraitTablet: [312, -42, 38],
		phone: [326, -37, 32],
	} as Record<string, readonly [number, number, number]>,
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

/** THE TWELVE LINES, Corey's words (brief of 2026-10-17; 11:29: the lines that began "His" begin "Manticore's"),
 *  line 1 first. `mouse`: the player has a mouse (Click, not Tap). Line 1 is the social wording r1 had for stake.us
 *  ("see its wins"), now on every site, so it needs no soc(); no line has a word of rules_probe.js SOCIAL_BANNED. */
export const tipLines = (mouse: boolean): string[] => [
	mouse ? 'Click a symbol to see its wins' : 'Tap a symbol to see its wins',
	'5 touching symbols make a cluster',
	'Lit tiles double on every win',
	'Wilds fill in for all but the War Standard',
	'4 War Standards: Free Spins',
	'5 War Standards: Super Free Spins',
	'6 or more War Standards: Epic Free Spins',
	"Manticore's sting can reveal War Standards",
	"Manticore's sting turns symbols Wild",
	"Manticore's Claw Swipe clears 3 rows and lights tiles",
	"Manticore's roar clears low symbols in Super and Epic",
	'In Free Spins, lit tiles stay all round',
];
export const TIP_COUNT = 12;

/** THE ORDER. `slot` counts the lines shown since the board settled (0 first); `other` is the running count of the
 *  other lines shown so far (kept across idle spells, so each spell goes on where the last one stopped). Returns the
 *  line's index (0 is line 1) and whether it used up an "other". */
export const tipAt = (slot: number, other: number): { index: number; usesOther: boolean } =>
	slot % PLAQUE_TIPS.firstEvery === 0
		? { index: 0, usesOther: false }
		: { index: 1 + (other % (TIP_COUNT - 1)), usesOther: true };

/** the size of every line on this screen (one row, one size for all). The box is [halfWidth, top, bottom], `kCss` the
 *  CSS px per layout unit across the box, `capK` the face's cap height per font size and `narrowestK` the narrowest
 *  line's width per font size. Returns the font size in layout units: scrollBoxFrac of the box's height, scrollMinCss
 *  to scrollMaxCss on screen, but never so small that the narrowest line is under scrollNarrowestOverBox of the box's
 *  width, and its cap never over scrollCapMax of the box */
export const tipFont = (box: readonly [number, number, number], kCss: number, capK: number, narrowestK: number): number => {
	const Hh = box[2] - box[1];
	const k = kCss > 0 ? kCss : 1;
	const r3 = Math.min(Math.max(PLAQUE_TIPS.scrollBoxFrac * Hh, PLAQUE_TIPS.scrollMinCss / k), PLAQUE_TIPS.scrollMaxCss / k);
	const neverWhole = narrowestK > 0 ? (PLAQUE_TIPS.scrollNarrowestOverBox * 2 * box[0]) / narrowestK : 0;
	return Math.min(Math.max(r3, neverWhole), (PLAQUE_TIPS.scrollCapMax * Hh) / Math.max(0.3, capK));
};

/** THE MARQUEE'S PATH. A line's strip (its text and a stripPad margin) starts with its left edge on the box's right
 *  edge and ends with its right edge on the box's left edge: `dist` is the box's width plus the strip's, at `v` layout
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
