// THE PLAQUE'S EXPLAINER LINES (Corey 2026-10-16: "Intentional, but maybe we can put some messages or explainers
// there"; 17:41 "Yes on the explainer lines", line 1 first and more often). On an idle base game board the empty bronze
// plaque under the board shows one short line at a time, engraved in the plaque's brass, fading in and out.
// components/BoardPlaque.svelte draws them; this file has the words, the order, the timings and the fit.
//
// PRESENTATION ONLY: nothing here reads or changes an outcome. The words are Corey's, exactly; the social wording
// (stake.us) goes through soc() like the rules page, and tools' rules_probe.js banned-word list is checked against
// every line by feedback/plaque_tips_r1/plaque_tips_probe.js.
import { soc } from './social';

/** Every number of the explainer lines (Corey 2026-10-16 17:41). Layout units are the plaque figures' own flat space
 *  (boardPlaqueSpec.ts figureBlock: the figure row is 638 x 64 of them, centred on 0, y down), put through the same
 *  halved-lean homography as the figures, so the lines lean with the plaque. */
export const PLAQUE_TIPS = {
	/** "fading in and out (about 300 ms)" */
	fadeMs: 300,
	/** "each held about 6 s": the time a line is fully up, between its fade in and its fade out */
	holdMs: 6000,
	/** the board settles (idle, the spin amount gone from the plaque) this long before line 1 comes in */
	startDelayMs: 1200,
	/** "hidden as soon as a spin starts": the fade out when the board stops being idle */
	hideMs: 120,
	/** "line 1 coming back every 3 lines (1, 2, 3, 1, 4, 5, 1, ...)": every this many lines is line 1 */
	firstEvery: 3,
	/** "muted enough that it does not compete with the board": the lines' opacity at full fade */
	alpha: 0.82,
	/** THE TEXT BOX inside the plaque's dark field, in layout units: [halfWidth, top, bottom]. The field measured from
	 *  the day plaque art (x +-331, y -49.5 to 44.5 in every layout but the phone's, x +-344, y -43.7 to 37.8 there),
	 *  less a margin so the letters never touch the rim */
	box: {
		landscape: [312, -42, 38],
		portrait: [312, -42, 38],
		portraitTablet: [312, -42, 38],
		phone: [326, -37, 32],
	} as Record<string, readonly [number, number, number]>,
	/** the biggest the letters get (font size, layout units; the figures are 69 tall) */
	maxFont: 34,
	/** line spacing, x the font size */
	lineHeight: 1.12,
	/** at most this many lines per explainer ("shrink to fit or wrap to 2 lines") */
	maxLines: 2,
	/** ONE size for every line (the smallest any of them needs), so the plaque's lettering never jumps between lines */
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
	 *  largest side */
	texScale: 1,
	texMax: 2048,
	/** the mesh the texture is drawn on: columns x rows of quads through the homography */
	gridX: 24,
	gridY: 2,
};

/** a touch screen or a mouse (the HUD's own test, ui/ChromeStyles.svelte): line 1 says Tap or Click */
export const pointerIsMouse = (): boolean =>
	typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;

/** THE NINE LINES, Corey's words (2026-10-16 17:41), line 1 first. `mouse`: the player has a mouse (Click, not Tap). */
export const tipLines = (mouse: boolean): string[] => [
	mouse
		? soc('Click a symbol to see what it pays', 'Click a symbol to see its wins')
		: soc('Tap a symbol to see what it pays', 'Tap a symbol to see its wins'),
	'5 or more matching symbols that touch make a cluster',
	'Every win lights the Multiplier Tiles under it',
	'A lit tile doubles each time it is part of another win',
	'The Wild stands in for every symbol except the War Standard',
	'4 War Standards start Free Spins. 5 or 6 open bigger rounds',
	"The Manticore's sting turns symbols Wild",
	'His swipe lights or doubles 24 tiles at once',
	'In Free Spins, lit tiles stay for the whole round',
];
export const TIP_COUNT = 9;

/** THE ORDER. `slot` counts the lines shown since the board settled (0 first); `other` is the running count of the
 *  other lines shown so far (kept across idle spells, so each spell goes on where the last one stopped). Returns the
 *  line's index (0 is line 1) and whether it used up an "other". */
export const tipAt = (slot: number, other: number): { index: number; usesOther: boolean } =>
	slot % PLAQUE_TIPS.firstEvery === 0
		? { index: 0, usesOther: false }
		: { index: 1 + (other % (TIP_COUNT - 1)), usesOther: true };

export type TipFit = { font: number; rows: string[][] };

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

/**
 * THE FIT: every line as large as the box lets it be (PLAQUE_TIPS.maxFont at most), on one row when it fits, else on
 * two; with sameSize, every line at the size the hardest one needs. `width(s)` is the width of `s` at font size 1 (layout
 * units); the box is [halfWidth, top, bottom]. Never overflows: the result's rows are inside the box at the result's font.
 */
export const fitTips = (
	texts: string[],
	width: (s: string) => number,
	box: readonly [number, number, number],
): TipFit[] => {
	const W = box[0] * 2;
	const Hh = box[2] - box[1];
	const lh = PLAQUE_TIPS.lineHeight;
	const best = texts.map((text) => {
		const words = text.split(' ');
		const one = Math.min(W / width(text), Hh / lh);
		const rows = splitRows(words, PLAQUE_TIPS.maxLines, width);
		const rowW = Math.max(...rows.map((r) => width(r.join(' '))));
		const two = Math.min(W / rowW, Hh / (lh * rows.length));
		return { words, one, two, rows };
	});
	const common = PLAQUE_TIPS.sameSize
		? Math.min(PLAQUE_TIPS.maxFont, ...best.map((b) => Math.max(b.one, b.two)))
		: Infinity;
	return best.map((b, i) => {
		const font = Math.min(PLAQUE_TIPS.maxFont, common, Math.max(b.one, b.two));
		// one row whenever it fits at this size
		if (width(texts[i]) * font <= W + 1e-6 && font * lh <= Hh + 1e-6)
			return { font, rows: [b.words] };
		return { font, rows: b.rows };
	});
};
