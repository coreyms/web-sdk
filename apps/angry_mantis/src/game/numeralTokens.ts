// One tokenizer for every renderer of the prison-stencil glyph atlas (components/ArtAmount.svelte and
// game/stencilLayout.ts in Pixi, ui/StencilAmount.svelte in HTML), so they agree EXACTLY on what the
// atlas can draw: a text that tokenizes renders every character; a text with any unsupported character
// yields null and the caller falls back to styled text for the WHOLE string — never a partial render
// with glyphs dropped. The atlas is generated from Black Ops One by tools/build_stencil_atlas.py and
// covers A-Z a-z 0-9, punctuation and every Stake currency mark (utils-shared/amount.ts META).
const CHAR_TO_GLYPH: Record<string, string> = {
	...Object.fromEntries([...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'].map((c) => [c, c])),
	'.': 'period', ',': 'comma', '-': 'dash', '–': 'dash', '—': 'dash', '/': 'slash', '!': 'bang',
	'·': 'middot', '+': 'plusStencil', ':': 'colon', ';': 'semicolon', '%': 'percent', '?': 'question',
	"'": 'apos', '’': 'apos', '"': 'quote', '(': 'lparen', ')': 'rparen', '*': 'asterisk', '&': 'amp',
	'#': 'hash', '@': 'at', '=': 'equals', '_': 'underscore', '~': 'tilde', '^': 'caret',
	'[': 'lbracket', ']': 'rbracket', '{': 'lbrace', '}': 'rbrace', '<': 'lt', '>': 'gt', '`': 'backtick',
	'×': 'multx',
	// currency marks (Stake's supported-currency table); multi-letter marks (CA$, kr, zł, GH₵, ج.م …)
	// tokenize letter by letter through the maps above
	$: 'dollar', '€': 'euro', '£': 'pound', '¥': 'yen', '￥': 'yen', '₹': 'rupee', '₽': 'ruble',
	'₱': 'peso', '₩': 'won', '₫': 'dong', '₺': 'lira', '₦': 'naira', '₡': 'colonSign', '₨': 'rupeeSign',
	'₵': 'cedi', '₪': 'shekel', 'ł': 'lstroke', 'ج': 'jeem', 'م': 'meem',
};
// Layout-only spaces: regular, NBSP, and the narrow/thin spaces Intl emits as group
// separators (fr formats '1 234,56 €' with U+202F NARROW NO-BREAK SPACE).
const SPACES = new Set([' ', '\u00a0', '\u202f', '\u2009']);
// Zero-width direction marks: amount.ts pins EGP's right-to-left "ج.م" with an LRM; nothing to draw.
const ZERO_WIDTH = new Set(['\u200e', '\u200f', '\u200b']);

/** Atlas frame name for one character, or null when the atlas has no glyph for it. */
export const numeralGlyphName = (ch: string): string | null => CHAR_TO_GLYPH[ch] ?? null;

/** Glyph names in order; null entries are layout-only space cells; null result = unsupported text. */
export const tokenizeNumerals = (text: string): (string | null)[] | null => {
	const tokens: (string | null)[] = [];
	for (const ch of text) {
		if (ZERO_WIDTH.has(ch)) continue;
		if (SPACES.has(ch)) tokens.push(null);
		else if (ch in CHAR_TO_GLYPH) tokens.push(CHAR_TO_GLYPH[ch]);
		else return null;
	}
	return tokens;
};
