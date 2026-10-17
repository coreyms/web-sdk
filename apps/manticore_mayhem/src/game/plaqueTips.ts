// THE PLAQUE'S EXPLAINER LINES (Corey 2026-10-16: "Intentional, but maybe we can put some messages or explainers
// there"; 17:41 "Yes on the explainer lines", line 1 first and more often). On an idle base game board the empty bronze
// plaque under the board shows one short line at a time, engraved in the plaque's brass.
//
// r2, PARTICLE TEXT (Corey 2026-10-17): 08:52 "I think the messages are too freequent, but perhaps we can make this
// look animated like have a bunch of dots on the little screen swirling around, then come together to form the
// sentence, and explode back into particles when existing, so most of the time it shows particals moving around, then
// maybe every 10 seconds it shows a message"; 08:59 "Yes" to "a message every 10 s, holding 4 s?"; 09:12 "What if we
// incorporated sides scroll in this as well, so it appears larger on small screens still. The particles would come
// together to form the first part of the sentence and explode on the last part."
//
// So: gold motes drift in the plaque's text box whenever the board is idle (game/plaqueMotes.ts moves them); every
// gapMs a line forms out of them, holds, and bursts back into them. A line that would be under readableCss on this
// screen side scrolls instead, one row at scrollCss: the motes form its beginning, it scrolls right to left (the
// letters crumble back into motes at the left edge, new ones are fed in from the swarm at the right) and its end
// bursts. components/BoardPlaque.svelte draws it all; this file has the words, the order, the numbers and the fit.
//
// PRESENTATION ONLY: nothing here reads or changes an outcome. The words are Corey's, exactly; tools' rules_probe.js
// banned-word list is checked against every line by feedback/plaque_tips_r2/plaque_tips_probe.js.

/** Every number of the explainer lines. Layout units are the plaque figures' own flat space (boardPlaqueSpec.ts
 *  figureBlock: the figure row is 638 x 64 of them, centred on 0, y down), put through the same halved-lean homography
 *  as the figures, so the lines and the motes lean with the plaque. */
export const PLAQUE_TIPS = {
	// ---- the cadence (r2) ----
	/** the board settles (idle, the spin amount gone from the plaque) this long before the motes come in (r1's delay) */
	startDelayMs: 1200,
	/** the motes' fade in once the board has settled ("most of the time it shows particals moving around") */
	motesInMs: 700,
	/** "hidden as soon as a spin starts": motes and text fade out this fast when the board stops being idle */
	hideMs: 120,
	/** the first line of an idle spell comes this long after the motes are in (Corey named only the gap; this is ours:
	 *  a new player sees "Tap a symbol" soon, a player spinning on sees few lines) */
	firstMs: 4000,
	/** "maybe every 10 seconds it shows a message" (08:52, 08:59 "Yes"): from the END of one line (its burst done) to
	 *  the start of the next one's gather */
	gapMs: 10000,
	/** "come together to form the sentence": the motes' stream into the letters (each mote takes 1 - gatherJitter to
	 *  1 times this, so they land one after another, not all at once) */
	gatherMs: 800,
	gatherJitter: 0.3,
	/** "the crisp text fades in as they land": from this far into the gather, over textInMs */
	textInStartMs: 380,
	textInMs: 480,
	/** "holding 4 s" (08:59 "Yes"): a fitted line is fully formed this long, from the gather's end to the burst */
	holdMs: 4000,
	/** "explode back into particles when existing": the burst (the text goes in burstTextMs, the motes fly out and
	 *  settle back into the drift over burstMs) */
	burstMs: 500,
	burstTextMs: 160,
	/** "line 1 coming back every 3 lines (1, 2, 3, 1, 4, 5, 1, ...)": every this many lines is line 1 */
	firstEvery: 3,
	/** "muted enough that it does not compete with the board": the lines' opacity at full fade */
	alpha: 0.82,

	// ---- the side scroll (r2, 09:12 "so it appears larger on small screens still") ----
	/** a line that fits (one or two rows) at this size on screen or larger is formed in place; smaller, it scrolls.
	 *  The brief: "aim for at least about 11 CSS px" */
	readableCss: 11,
	/** the scroll's letters on screen, CSS px (the old fit gave 6 to 8 on the small phones) */
	scrollCss: 12.5,
	/** ...never above this, nor with a cap height over scrollCapMax of the text box's height */
	scrollMaxCss: 16,
	scrollCapMax: 0.6,
	/** the scroll's speed, in ems (the scroll font's size) a second: 4.5 em/s is about 7 letters a second, slower than
	 *  reading pace, so a line reads comfortably while it moves */
	scrollEmPerSec: 4.5,
	/** the scroll eases in and out over this long (no jolt at its start or end) */
	scrollRampMs: 400,
	/** "form the first part of the sentence": the beginning is held still this long after it forms, so its first words
	 *  read before it moves */
	scrollStartReadMs: 1000,
	/** "explode on the last part": the end is held still this long before it bursts, so its last words read */
	scrollEndReadMs: 1100,
	/** a scrolling line is up at least this long, gather end to burst (the fitted line's holdMs) */
	scrollMinUpMs: 4000,
	/** the scroll starts and ends with the text this far (layout units) in from the box's edge */
	scrollPad: 8,
	/** at the right edge the next letters are fed from the swarm: a mote is sent this long before its point comes in */
	feedMs: 520,

	// ---- the face and the box (r1) ----
	/** THE TEXT BOX inside the plaque's dark field, in layout units: [halfWidth, top, bottom]. The field measured from
	 *  the day plaque art (x +-331, y -49.5 to 44.5 in every layout but the phone's, x +-344, y -43.7 to 37.8 there),
	 *  less a margin so the letters never touch the rim. The motes stay inside it too ("nothing goes outside the
	 *  plaque") */
	box: {
		landscape: [312, -42, 38],
		portrait: [312, -42, 38],
		portraitTablet: [312, -42, 38],
		phone: [326, -37, 32],
	} as Record<string, readonly [number, number, number]>,
	/** the biggest the letters get when formed in place (font size, layout units; the figures are 69 tall) */
	maxFont: 34,
	/** line spacing, x the font size */
	lineHeight: 1.12,
	/** at most this many rows per line when formed in place ("shrink to fit or wrap to 2 lines") */
	maxLines: 2,
	/** ONE size for every line formed in place (the smallest any of them needs), so the plaque's lettering never jumps
	 *  between lines */
	sameSize: true,
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
	/** the texture's pixels per screen pixel (1: drawn at the screen's own density, the renderer's resolution) and its
	 *  largest side (a longer scrolling line is drawn a little softer rather than bigger) */
	texScale: 1,
	texMax: 2048,
	/** the mesh the texture is drawn on: columns x rows of quads through the homography */
	gridX: 24,
	gridY: 2,
	/** the glyph points the motes form: a brass pixel of the line's own canvas (red x alpha at least this, of 255; the
	 *  dark lip and the faint light under the letters are left out) on a grid of about this many layout units */
	pointInk: 120,
	pointGridUnits: 1.2,
};

/** a touch screen or a mouse (the HUD's own test, ui/ChromeStyles.svelte): line 1 says Tap or Click */
export const pointerIsMouse = (): boolean =>
	typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;

/** THE TWELVE LINES, Corey's words (brief of 2026-10-17), line 1 first. `mouse`: the player has a mouse (Click, not
 *  Tap). Line 1 is the social wording r1 had for stake.us ("see its wins"), now on every site, so it needs no soc();
 *  no line has a word of rules_probe.js SOCIAL_BANNED. */
export const tipLines = (mouse: boolean): string[] => [
	mouse ? 'Click a symbol to see its wins' : 'Tap a symbol to see its wins',
	'5 touching symbols make a cluster',
	'Lit tiles double on every win',
	'Wilds fill in for all but the War Standard',
	'4 War Standards: Free Spins',
	'5 War Standards: Super Free Spins',
	'6 or more War Standards: Epic Free Spins',
	'His sting can reveal War Standards',
	'His sting turns symbols Wild',
	'His Claw Swipe clears 3 rows and lights tiles',
	'His roar clears low symbols in Super and Epic',
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

export type TipFit = { font: number; rows: string[][] };
/** a line's plan on this screen: formed in place (one or two rows) or scrolled (one row) */
export type TipPlan = TipFit & { mode: 'fit' | 'scroll' };

/** the best split of `words` into `n` rows (the widest row as narrow as it can be) */
const splitRows = (words: string[], n: number, width: (s: string) => number): string[][] => {
	if (n <= 1 || words.length < 2) return [words];
	let best: string[][] = [words];
	let bestW = Infinity;
	// two rows (maxLines is 2); a longer ask falls back to the same two-row search
	for (let k = 1; k < words.length; k += 1) {
		const a = words.slice(0, k);
		const b = words.slice(k);
		const w = Math.max(width(a.join(' ')), width(b.join(' ')));
		if (w < bestW) {
			bestW = w;
			best = [a, b];
		}
	}
	return best;
};

/** the biggest a line can be formed in place (one row or two, PLAQUE_TIPS.maxFont at most), and its rows */
const bestFit = (text: string, width: (s: string) => number, box: readonly [number, number, number]) => {
	const W = box[0] * 2;
	const Hh = box[2] - box[1];
	const lh = PLAQUE_TIPS.lineHeight;
	const words = text.split(' ');
	const one = Math.min(W / width(text), Hh / lh);
	const rows = splitRows(words, PLAQUE_TIPS.maxLines, width);
	const rowW = Math.max(...rows.map((r) => width(r.join(' '))));
	const two = Math.min(W / rowW, Hh / (lh * rows.length));
	return { words, rows, size: Math.min(PLAQUE_TIPS.maxFont, Math.max(one, two)) };
};

/**
 * THE PLAN for every line on this screen. `width(s)` is the width of `s` at font size 1 (layout units), the box is
 * [halfWidth, top, bottom], `kCss` the CSS px per layout unit across the box and `capK` the face's cap height per
 * font size. A line that can be formed in place at readableCss or more is ('fit'), every such line at the size the
 * hardest of them needs (sameSize), on one row whenever it fits at that size, else two; the rest scroll ('scroll'), one
 * row at scrollCss (never so tall its cap passes scrollCapMax of the box). Never overflows: a fitted line's rows are
 * inside the box at its font; a scrolled line's row is inside the box's height.
 */
export const planTips = (
	texts: string[],
	width: (s: string) => number,
	box: readonly [number, number, number],
	kCss: number,
	capK: number,
): TipPlan[] => {
	const W = box[0] * 2;
	const Hh = box[2] - box[1];
	const lh = PLAQUE_TIPS.lineHeight;
	const k = kCss > 0 ? kCss : 1;
	const best = texts.map((t) => bestFit(t, width, box));
	const fits = best.map((b) => b.size * k >= PLAQUE_TIPS.readableCss - 1e-6);
	const common = PLAQUE_TIPS.sameSize
		? Math.min(PLAQUE_TIPS.maxFont, ...best.filter((_, i) => fits[i]).map((b) => b.size))
		: Infinity;
	const scrollFont = Math.min(PLAQUE_TIPS.scrollCss / k, PLAQUE_TIPS.scrollMaxCss / k, (PLAQUE_TIPS.scrollCapMax * Hh) / Math.max(0.3, capK));
	return best.map((b, i) => {
		if (!fits[i]) return { mode: 'scroll', font: scrollFont, rows: [b.words] };
		const font = Math.min(PLAQUE_TIPS.maxFont, common, b.size);
		// one row whenever it fits at this size
		if (width(texts[i]) * font <= W + 1e-6 && font * lh <= Hh + 1e-6) return { mode: 'fit', font, rows: [b.words] };
		return { mode: 'fit', font, rows: b.rows };
	});
};

/** r1's fit (every line formed in place, whatever its size), kept for the record and the probe's comparison */
export const fitTips = (texts: string[], width: (s: string) => number, box: readonly [number, number, number]): TipFit[] =>
	planTips(texts, width, box, 1e9, 0.7).map(({ font, rows }) => ({ font, rows }));

/** THE SCROLL'S PATH: how far (layout units, 0 to `dist`) the text has moved `t` ms after the scroll starts, at `v`
 *  units a ms, easing in and out over PLAQUE_TIPS.scrollRampMs; and the scroll's whole length in ms */
export const scrollSpan = (dist: number, v: number): { ms: number; ramp: number } => {
	if (dist <= 0 || v <= 0) return { ms: 0, ramp: 0 };
	const ramp = Math.min(PLAQUE_TIPS.scrollRampMs, dist / v);
	return { ms: dist / v + ramp, ramp };
};
export const scrollAt = (t: number, dist: number, v: number, ms: number, ramp: number): number => {
	if (dist <= 0 || t <= 0) return 0;
	if (t >= ms) return dist;
	if (ramp <= 0) return Math.min(dist, v * t);
	if (t < ramp) return (v * t * t) / (2 * ramp);
	if (t > ms - ramp) return dist - (v * (ms - t) * (ms - t)) / (2 * ramp);
	return (v * ramp) / 2 + v * (t - ramp);
};
