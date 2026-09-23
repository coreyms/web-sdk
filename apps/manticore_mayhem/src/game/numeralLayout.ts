// Layout of a prison-stencil glyph row (the numerals atlas, tools/build_stencil_atlas.py). ONE
// implementation for every renderer of the atlas: ArtAmount draws the result as batched sprites,
// DoorPaint paints it into the steel door from the same rects. TABULAR figures: every digit sits
// centred in an identical fixed-width cell, so a counting value never reflows — only the glyph
// inside each cell changes. Every glyph carries `d`, its frame bottom below the digit baseline
// (comma and descenders hang, the dash floats).
import { NUMERAL_DIGIT_H, NUMERAL_GLYPHS } from './numeralGlyphs';
import { tokenizeNumerals } from './numeralTokens';

const GAP = 0.05; // inter-cell gap, fraction of digit height
const SPACE = 0.32;
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const DIGIT_CELL = Math.max(...DIGITS.map((d) => NUMERAL_GLYPHS[d].w));
const SEP_CELL = Math.max(NUMERAL_GLYPHS.comma.w, NUMERAL_GLYPHS.period.w);

export type GlyphPlacement = { key: string; x: number; y: number; w: number; h: number };

type Cell = { key: string; cellW: number; w: number; h: number; d: number };

/**
 * Glyph rects for `text` at digit height `height`. x is relative to the row's centred box, y is
 * relative to the row's optical centre (baseline at +height/2). `reserve` (a count-up's FINAL
 * string) fixes the box and the maxWidth fit ONCE so the live string right-aligns inside it like
 * an odometer. Returns null when the text has a character the atlas cannot draw.
 */
export const layoutNumerals = (
	text: string,
	height: number,
	opts: { reserve?: string; maxWidth?: number } = {},
): GlyphPlacement[] | null => {
	const tokens = tokenizeNumerals(text);
	if (!tokens) return null;
	const reserveTokens = opts.reserve === undefined ? null : tokenizeNumerals(opts.reserve);
	const s = height / NUMERAL_DIGIT_H;
	const cellsFor = (toks: (string | null)[]): Cell[] =>
		toks.map((name) => {
			if (name === null) return { key: '', cellW: height * SPACE, w: 0, h: 0, d: 0 };
			const g = NUMERAL_GLYPHS[name]; // metrics are pre-normalized display units
			const isDigit = DIGITS.includes(name);
			const isSep = name === 'comma' || name === 'period';
			const w = g.w * s;
			return { key: name, cellW: isDigit ? DIGIT_CELL * s : isSep ? SEP_CELL * s : w, w, h: g.h * s, d: g.d * s };
		});
	const gap = height * GAP;
	const rowW = (cells: Cell[]) => cells.reduce((sum, c) => sum + c.cellW, 0) + gap * Math.max(0, cells.length - 1);
	const cells = cellsFor(tokens);
	const total = rowW(cells);
	const reserved = reserveTokens ? Math.max(rowW(cellsFor(reserveTokens)), total) : total;
	const fit = opts.maxWidth && reserved > opts.maxWidth ? opts.maxWidth / reserved : 1;
	let cx = (reserved / 2 - total) * fit;
	return cells.map((c) => {
		const cellW = c.cellW * fit;
		const w = c.w * fit;
		const h = c.h * fit;
		const gy = height / 2 - h + c.d * fit; // baseline at height/2 below centre; frame bottom `d` below it
		const p = { key: c.key, x: cx + (cellW - w) / 2, y: gy, w, h };
		cx += cellW + gap * fit;
		return p;
	});
};
