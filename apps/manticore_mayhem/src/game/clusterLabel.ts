// THE CLUSTER LABELS' FONT (CLUSTER_LABEL): the plaque's forged Rakkas glyphs, baked a second time AT THE
// SIZES THE LABELS ARE DRAWN (tools/build_plaque_text.py --labels -> static/assets/ui/labels/
// label-glyphs-<cap>.{webp,json} and game/labelGlyphs.ts), one small atlas per cap height in canvas pixels.
//
// Why its own atlases (Corey 2026-10-09, on a desktop retina screen: "they look pixellated even on Desktop"):
// the first cut drew the PLAQUE's glyph atlas, whose caps are 64 texels tall (43 in the phone tier), at a cap
// of 21 to 36 canvas pixels: a 1.7x to 3x minification (with no mip chain at all on the phone tier), and the
// dark rim was four offset copies of that already minified glyph. Here a glyph is sampled within about 0.9x
// to 1.12x of its texture, every edge was antialiased by the builder (rendered 4x, box-reduced), and the
// outline and shadow are a second BAKED frame under the face, so the face alone takes the cream / teal tint.
//
// This file is the layout (pure: integer texel positions from the generated metrics) and the little shared
// state the board engine and components/ClusterLabels.svelte agree through: which caps are loaded and which
// one is in use. One cap is preloaded (game/assets.ts picks it from the screen), the others arrive with the
// deferred phase; the component always draws from the loaded cap nearest the size on screen.
import { LABEL_CAPS, LABEL_DIGIT_ADV, LABEL_GLYPHS, LABEL_KERN, LABEL_PREFIX } from './labelGlyphs';

export const labelFont = {
	/** which cap atlases are in stateApp.loadedAssets (written by ClusterLabels.svelte's tick) */
	loaded: LABEL_CAPS.map(() => false) as boolean[],
	/** the cap in use, an index into LABEL_CAPS; -1 until one is loaded (written by the same tick) */
	cap: -1,
	/** DEV / probe: draw the stencil fallback even though the forged glyphs are ready */
	forceStencil: false,
};

// layout only spaces (Intl's group separators) and the direction marks amount.ts pins EGP's symbol with:
// the same normalisation as game/stinger/text.ts and game/numeralTokens.ts
const SPACES = new Set([' ', ' ', ' ', ' ']);
const ZERO_WIDTH = new Set(['‎', '‏', '​']);
const ALIAS: Record<string, string> = { '’': "'", '–': '-', '—': '-', '￥': '¥' };
/** the atlas character for `ch`: '' = draws nothing and takes no room, undefined = the atlas lacks it */
const glyphChar = (ch: string): string | undefined => {
	if (ZERO_WIDTH.has(ch)) return '';
	const c = SPACES.has(ch) ? ' ' : (ALIAS[ch] ?? ch);
	return LABEL_GLYPHS[c] ? c : undefined;
};

/** the frame names of a character's face and under layer at a cap */
export const labelFrames = (ch: string, capIndex: number) => {
	const base = `${LABEL_PREFIX}${LABEL_CAPS[capIndex]}_${ch.codePointAt(0)!.toString(16).padStart(4, '0')}`;
	return { face: base, under: `${base}_u` };
};

/** the cap index nearest (as a ratio) to a cap height of `canvasPx` canvas pixels, among the loaded ones; -1 if none */
export const pickLabelCap = (canvasPx: number, loaded: readonly boolean[] = labelFont.loaded): number => {
	let best = -1;
	let bestD = Infinity;
	for (let i = 0; i < LABEL_CAPS.length; i += 1) {
		if (!loaded[i]) continue;
		const d = Math.abs(Math.log(Math.max(canvasPx, 1) / LABEL_CAPS[i]));
		if (d < bestD) {
			bestD = d;
			best = i;
		}
	}
	return best;
};

export const forgedReady = () => labelFont.cap >= 0 && !labelFont.forceStencil;

/** can this string be set whole from the label atlas, right now? */
export const forgedSupports = (text: string) => {
	if (!forgedReady()) return false;
	for (const ch of text) if (glyphChar(ch) === undefined) return false;
	return true;
};

/** one laid out row: per glyph its character and the top left of its face and under frames, in WHOLE texels
 *  of the cap it was laid out for; x from the row's centre, y from the centre of the cap height */
export class LabelRun {
	count = 0;
	/** the row's advance width, texels */
	width = 0;
	chars: string[] = [];
	faceX: Int16Array;
	faceY: Int16Array;
	underX: Int16Array;
	underY: Int16Array;
	readonly capacity: number;
	constructor(capacity = 40) {
		this.capacity = capacity;
		this.faceX = new Int16Array(capacity);
		this.faceY = new Int16Array(capacity);
		this.underX = new Int16Array(capacity);
		this.underY = new Int16Array(capacity);
	}
}

const advanceOf = (text: string, capIndex: number, tabular: boolean): number => {
	let w = 0;
	let prev = '';
	for (const raw of text) {
		const ch = glyphChar(raw);
		if (!ch) continue;
		const digit = tabular && ch >= '0' && ch <= '9';
		if (!tabular && prev) w += LABEL_KERN[prev + ch]?.[capIndex] ?? 0;
		w += digit ? LABEL_DIGIT_ADV[capIndex] : LABEL_GLYPHS[ch][capIndex][0];
		prev = ch;
	}
	return w;
};

/**
 * Lay `text` out at cap `capIndex` into `run`. `tabular` (a counting amount): every digit takes the widest
 * digit's advance, centred in it, and pairs are not kerned, so the row never reflows while it counts.
 * Characters the atlas lacks are skipped (ask forgedSupports first). Every position is a whole texel, so a
 * row whose origin sits on a canvas pixel draws texel on pixel at a scale of 1.
 */
export const layoutLabel = (text: string, capIndex: number, tabular: boolean, run: LabelRun): LabelRun => {
	const cap = LABEL_CAPS[capIndex];
	const width = advanceOf(text, capIndex, tabular);
	let pen = -Math.round(width / 2);
	const base = cap / 2; // the caps are even: the baseline is a whole texel under the cap's centre
	let n = 0;
	let prev = '';
	for (const raw of text) {
		const ch = glyphChar(raw);
		if (!ch) continue;
		const g = LABEL_GLYPHS[ch][capIndex];
		const digit = tabular && ch >= '0' && ch <= '9';
		if (!tabular && prev) pen += LABEL_KERN[prev + ch]?.[capIndex] ?? 0;
		const adv = digit ? LABEL_DIGIT_ADV[capIndex] : g[0];
		if (g.length > 1 && n < run.capacity) {
			const x = pen + (digit ? Math.floor((adv - g[0]) / 2) : 0);
			run.chars[n] = ch;
			run.faceX[n] = x + g[1];
			run.faceY[n] = base + g[2];
			run.underX[n] = x + g[5];
			run.underY[n] = base + g[6];
			n += 1;
		}
		pen += adv;
		prev = ch;
	}
	run.count = n;
	run.width = width;
	return run;
};

/** the laid out width of `text` at a cap height of `capPx` (any unit), measured on the cap in use */
export const forgedWidth = (text: string, capPx: number, tabular = false) =>
	labelFont.cap < 0 ? 0 : (advanceOf(text, labelFont.cap, tabular) * capPx) / LABEL_CAPS[labelFont.cap];
