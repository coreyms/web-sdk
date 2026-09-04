// Word-wrapping layout for Corey's stencil glyph atlases — the prose counterpart to ArtAmount.
//
// ArtAmount lays out AMOUNTS: one line, tabular cells, so a counting value never reflows. Body
// copy needs the opposite: proportional advances, word wrap, mixed faces (the white stencil atlas
// for copy, the gold bonus-board alphabet for titles), per-run tinting, and inline symbol art.
// Both draw batched sprites off resident atlas pages, so NOTHING here rasterizes text (house
// rule 1) — the bonus-intro screen adds zero PIXI.Text.
//
// This module is pure: `layoutStencil` returns positioned frames plus the block's measured
// extent, so BonusIntro can MEASURE a composition and shrink it to fit the door window before
// anything is drawn (the "never spill" guarantee) instead of discovering the overflow on screen.

import { NUMERAL_GLYPHS, NUMERAL_DIGIT_H } from './numeralGlyphs';
import { numeralGlyphName } from './numeralTokens';
import { GOLD_GLYPHS, GOLD_CAP_H } from './goldGlyphs';

export type StencilFace = 'white' | 'gold';

/** A run of text in one face/tint, or an inline piece of symbol art (the Glowing Leaf). */
export type StencilPart =
	| { text: string; face?: StencilFace; tint?: number; capScale?: number }
	| { icon: string; scale?: number; aspect?: number };

export type PlacedGlyph = {
	key: string;
	x: number;
	y: number;
	w: number;
	h: number;
	tint?: number;
};

export type StencilBlock = {
	glyphs: PlacedGlyph[];
	/** Width of the widest line; lines are aligned within this box. */
	width: number;
	/** Cap top of the first line to the deepest descender of the last. */
	height: number;
	lines: number;
	/** False when a character had no glyph in either atlas (it was dropped). */
	complete: boolean;
};

// The white face is the generated stencil atlas: A-Z a-z 0-9, punctuation and currency marks
// (game/numeralTokens.ts is the single source of what it can draw). `complete` reports a character
// with no glyph in either atlas.
const SPACES = new Set([' ', '\u00a0', '\u202f', '\u2009', '\n']);

const TRACKING = 0.06; // inter-glyph gap, fraction of cap height
const SPACE = 0.3; // word space, fraction of cap height

type Metric = { w: number; h: number; d: number };

/** Normalized metrics + atlas frame name for one character on one face. */
const glyphFor = (ch: string, face: StencilFace): { key: string; m: Metric } | null => {
	if (face === 'gold') {
		const g = GOLD_GLYPHS[ch];
		// The gold sheet is A-Z + the boxed numerals only. A gold title that reaches for a digit
		// or punctuation falls back to the white sheet rather than dropping the character.
		if (g) return { key: `gold_${ch}.png`, m: { w: g.w, h: g.h, d: g.d } };
	}
	const name = numeralGlyphName(ch);
	if (!name) return null;
	const n = NUMERAL_GLYPHS[name];
	if (!n) return null;
	// `d` is the frame bottom below the digit baseline (negative for floating glyphs like the dash)
	return { key: `num_${name}.png`, m: { w: n.w, h: n.h, d: n.d } };
};

/** Boxed rule-number badge from the gold sheet ('1' | '2' | '3'). */
export const goldBadgeFrame = (n: 1 | 2 | 3) => `gold_box${n}.png`;
export const goldBadgeAspect = (n: 1 | 2 | 3) => {
	const g = GOLD_GLYPHS[`box${n}`];
	return g ? g.w / g.h : 1;
};

type Item = { key: string; w: number; h: number; dy: number; adv: number; tint?: number };

export const layoutStencil = (opts: {
	parts: StencilPart[];
	/** Cap height in design units — every metric scales from this. */
	cap: number;
	maxWidth?: number;
	/** Line advance as a multiple of cap. */
	lead?: number;
	align?: 'left' | 'center';
}): StencilBlock => {
	const { parts, cap, maxWidth, lead = 1.45, align = 'center' } = opts;
	const sWhite = cap / NUMERAL_DIGIT_H;
	const sGold = cap / GOLD_CAP_H;
	const tracking = cap * TRACKING;
	const spaceW = cap * SPACE;
	let complete = true;

	// One flat stream of words. A word is a run of items with no space inside it; runs from
	// different parts join into the SAME word when no space separates them, so a tinted phrase
	// can start mid-word without changing where the line breaks.
	const words: Item[][] = [];
	let word: Item[] = [];
	const flush = () => {
		if (word.length) words.push(word);
		word = [];
	};

	for (const part of parts) {
		if ('icon' in part) {
			const scale = part.scale ?? 1.3;
			const aspect = part.aspect ?? 1;
			const h = cap * scale;
			const w = h * aspect;
			// centred on the cap band: top = baseline - cap - (h - cap) / 2. Pinned to white so a
			// block-wide fallback tint (body copy is warm off-white) never discolours real art —
			// the inline Glowing Leaf tile and the gold rule badges both ride this path.
			words.push([{ key: part.icon, w, h, dy: -cap - (h - cap) / 2, adv: w + tracking, tint: 0xffffff }]);
			continue;
		}
		const face = part.face ?? 'white';
		// a run may set its own cap (a gold title inline in body copy sits a size up); glyphs still
		// share the line's baseline, so a bigger run simply rises above the cap line
		const capScale = part.capScale ?? 1;
		for (const ch of part.text) {
			if (SPACES.has(ch)) {
				flush();
				continue;
			}
			const g = glyphFor(ch, face);
			if (!g) {
				complete = false;
				continue;
			}
			const s = (g.key.startsWith('gold_') ? sGold : sWhite) * capScale;
			const w = g.m.w * s;
			const h = g.m.h * s;
			word.push({ key: g.key, w, h, dy: -(h - g.m.d * s), adv: w + tracking, tint: part.tint });
		}
		flush();
	}
	flush();

	const wordWidth = (items: Item[]) =>
		items.reduce((sum, it) => sum + it.adv, 0) - (items.length ? tracking : 0);

	// greedy wrap
	const rows: Item[][][] = [];
	let row: Item[][] = [];
	let rowW = 0;
	for (const w of words) {
		const ww = wordWidth(w);
		const next = row.length ? rowW + spaceW + ww : ww;
		if (row.length && maxWidth !== undefined && next > maxWidth) {
			rows.push(row);
			row = [w];
			rowW = ww;
		} else {
			row.push(w);
			rowW = next;
		}
	}
	if (row.length) rows.push(row);

	const rowWidths = rows.map(
		(r) => r.reduce((sum, w) => sum + wordWidth(w), 0) + spaceW * Math.max(0, r.length - 1),
	);
	const width = rowWidths.length ? Math.max(...rowWidths) : 0;

	const glyphs: PlacedGlyph[] = [];
	let minTop = 0;
	let maxBottom = 0;
	rows.forEach((r, i) => {
		// baseline of row i, measured from the first line's cap top
		const baseline = i * cap * lead + cap;
		let x = align === 'center' ? (width - rowWidths[i]) / 2 : 0;
		for (const w of r) {
			for (const it of w) {
				glyphs.push({ key: it.key, x, y: baseline + it.dy, w: it.w, h: it.h, tint: it.tint });
				minTop = Math.min(minTop, baseline + it.dy);
				maxBottom = Math.max(maxBottom, baseline + it.dy + it.h);
				x += it.adv;
			}
			x += spaceW - tracking;
		}
	});

	// Normalize so y=0 is the TOP of the drawn ink, whatever overhangs the first line's cap box
	// (an oversized inline title, the Glowing Leaf icon). Without this the reported height would
	// under-measure the block and the "fits inside the door" check would pass on a block that
	// actually pokes out the top.
	if (minTop < 0) for (const g of glyphs) g.y -= minTop;

	return {
		glyphs,
		width,
		height: rows.length ? maxBottom - minTop : 0,
		lines: rows.length,
		complete,
	};
};
