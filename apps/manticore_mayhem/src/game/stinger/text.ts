// THE PLAQUE'S TEXT LAYOUT: strings set from the forged glyph atlas (tools/build_plaque_text.py: Rakkas,
// with Noto Serif for the nine currency marks Rakkas lacks) with its metrics and pair kerning. The port of
// the layout the approved mocks used (model/scripts/a1_timing.py text_layer / amount_layer). Pure: it fills
// a preallocated GlyphRun; game/stinger/plaqueText.ts draws one.
//
//   scale     px size / em; a row wider than maxWidth shrinks to it
//   pen       per glyph: x += kern(previous, this) then draw at (x + ox, baseline + oy), x += adv
//   tabular   AMOUNTS: every digit takes the widest digit's advance (centred in it) and pairs are not
//             kerned, so a counting value never reflows. With `reserve` (the count's FINAL string) the box
//             and the fit come from the final string and the live one right aligns inside it: nothing moves
//             when a digit is added.
//   origin    x = 0 is the row's centre, y = 0 the centre of the cap height (what the layout's *_cy place)
import type { StingerJson } from './types';

type Glyph = { adv: number; ox: number; oy: number; w: number; h: number; frame: number };

// layout only spaces (Intl's group separators) and the direction marks amount.ts pins EGP's symbol with;
// the same normalisation as game/numeralTokens.ts. EGP's Arabic letters are set in STRING order, left to
// right, exactly as the stencil numerals do (components/ArtAmount.svelte): the two renderers stay in step.
const SPACES = new Set([' ', ' ', ' ', ' ']);
const ZERO_WIDTH = new Set(['‎', '‏', '​']);
const ALIAS: Record<string, string> = { '’': "'", '–': '-', '—': '-', '￥': '¥' };

export class GlyphRun {
	count = 0;
	/** the laid out width and the scale used (after the maxWidth fit), ship px */
	width = 0;
	scale = 1;
	/** index into PlaqueFont.frames */
	frame: Int16Array;
	x: Float32Array;
	y: Float32Array;
	w: Float32Array;
	h: Float32Array;
	capacity: number;
	constructor(capacity = 48) {
		this.capacity = capacity;
		this.frame = new Int16Array(capacity);
		this.x = new Float32Array(capacity);
		this.y = new Float32Array(capacity);
		this.w = new Float32Array(capacity);
		this.h = new Float32Array(capacity);
	}
}

export class PlaqueFont {
	readonly em: number;
	readonly cap: number;
	/** atlas frame names, indexed by GlyphRun.frame */
	readonly frames: string[] = [];
	private glyphs = new Map<string, Glyph>();
	private kern: Record<string, number>;
	private digitAdv = 0;

	constructor(json: StingerJson) {
		const T = json.text;
		this.em = T.em;
		this.cap = T.cap;
		this.kern = T.kern;
		for (const [ch, g] of Object.entries(T.glyphs)) {
			if (g.length === 1) this.glyphs.set(ch, { adv: g[0], ox: 0, oy: 0, w: 0, h: 0, frame: -1 });
			else {
				this.glyphs.set(ch, { adv: g[0], ox: g[1], oy: g[2], w: g[3], h: g[4], frame: this.frames.length });
				this.frames.push(g[5]);
			}
		}
		for (const d of '0123456789') this.digitAdv = Math.max(this.digitAdv, this.glyphs.get(d)?.adv ?? 0);
	}

	private glyph(ch: string): Glyph | null | undefined {
		if (ZERO_WIDTH.has(ch)) return null;
		return this.glyphs.get(SPACES.has(ch) ? ' ' : (ALIAS[ch] ?? ch));
	}

	/** the characters of `text` the atlas cannot draw ('' = every one is there) */
	missing(text: string): string {
		let out = '';
		for (const ch of text) if (this.glyph(ch) === undefined && !out.includes(ch)) out += ch;
		return out;
	}

	private measure(text: string, tabular: boolean): number {
		let w = 0;
		let prev = '';
		for (const ch of text) {
			const g = this.glyph(ch);
			if (!g) continue;
			if (!tabular && prev) w += this.kern[prev + ch] ?? 0;
			w += tabular && ch >= '0' && ch <= '9' ? this.digitAdv : g.adv;
			prev = ch;
		}
		return w;
	}

	/**
	 * Lay `text` out at em size `px` into `run`. Characters the atlas lacks are skipped (ask missing() first
	 * and decide; the plaque reports them). Returns the run.
	 */
	layout(text: string, px: number, run: GlyphRun, opts: { maxWidth?: number; tabular?: boolean; reserve?: string; fit?: string } = {}): GlyphRun {
		const tabular = !!opts.tabular;
		const own = this.measure(text, tabular);
		const box = opts.reserve === undefined ? own : Math.max(own, this.measure(opts.reserve, tabular));
		let sc = px / this.em;
		// `fit`: the maxWidth fit is taken from THIS string's width (a count's final string), so the glyph size
		// is the same on every frame of the count while the row itself stays as wide as its own text
		const fitBox = opts.fit === undefined ? box : Math.max(box, this.measure(opts.fit, tabular));
		if (opts.maxWidth && fitBox * sc > opts.maxWidth) sc = opts.maxWidth / fitBox;
		let pen = -box / 2 + (box - own); // right aligned inside the reserved box
		let n = 0;
		let prev = '';
		for (const ch of text) {
			const g = this.glyph(ch);
			if (!g) continue;
			const digit = tabular && ch >= '0' && ch <= '9';
			if (!tabular && prev) pen += this.kern[prev + ch] ?? 0;
			const adv = digit ? this.digitAdv : g.adv;
			if (g.frame >= 0 && n < run.capacity) {
				run.frame[n] = g.frame;
				run.x[n] = (pen + (adv - g.adv) / 2 + g.ox) * sc;
				run.y[n] = (g.oy + this.cap / 2) * sc; // oy hangs from the baseline; the cap centre is cap / 2 above it
				run.w[n] = g.w * sc;
				run.h[n] = g.h * sc;
				n += 1;
			}
			pen += adv;
			prev = ch;
		}
		run.count = n;
		run.width = box * sc;
		run.scale = sc;
		return run;
	}
}
