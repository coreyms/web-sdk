// Width arithmetic for the prison-stencil numeral atlas, shared by the HTML renderer
// (ui/StencilAmount.svelte) and anything that must know how wide an amount WILL be before it
// renders — the HUD's SPIN slot is sized from the widest bet option (Corey 2026-09-06: the −/+
// steppers must never move when the bet changes, and the gap must fit the biggest amount the
// currency can show). Pure glyph metrics, no DOM measurement, so both agree exactly.
import { NUMERAL_GLYPHS, NUMERAL_DIGIT_H } from './numeralGlyphs';
import { tokenizeNumerals } from './numeralTokens';

export const NUMERAL_GAP = 0.05; // between cells, in digit heights
export const NUMERAL_SPACE = 0.32; // a layout-only space cell, in digit heights
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
// digits and separators sit in fixed cells so amounts stay tabular
export const DIGIT_CELL = Math.max(...DIGITS.map((d) => NUMERAL_GLYPHS[d].w));
export const SEP_CELL = Math.max(NUMERAL_GLYPHS.comma.w, NUMERAL_GLYPHS.period.w);

export type NumeralCell = { key: string; cellW: number; w: number; h: number; d: number };

/** one cell per token at the given digit height (null token = space cell) */
export const numeralCells = (tokens: (string | null)[], height: number): NumeralCell[] => {
	const s = height / NUMERAL_DIGIT_H;
	return tokens.map((name) => {
		if (name === null) return { key: '', cellW: height * NUMERAL_SPACE, w: 0, h: 0, d: 0 };
		const g = NUMERAL_GLYPHS[name];
		const isDigit = DIGITS.includes(name);
		const isSep = name === 'comma' || name === 'period';
		const w = g.w * s;
		return { key: name, cellW: isDigit ? DIGIT_CELL * s : isSep ? SEP_CELL * s : w, w, h: g.h * s, d: g.d * s };
	});
};

/** unfitted row width of `cells` at `height` */
export const numeralRowWidth = (cells: NumeralCell[], height: number) =>
	cells.reduce((sum, c) => sum + c.cellW, 0) + height * NUMERAL_GAP * Math.max(0, cells.length - 1);

/** width the atlas renders `text` at `height`; null when the atlas cannot draw it (text fallback) */
export const measureNumerals = (text: string, height: number): number | null => {
	const tokens = tokenizeNumerals(text);
	if (!tokens) return null;
	return numeralRowWidth(numeralCells(tokens, height), height);
};
