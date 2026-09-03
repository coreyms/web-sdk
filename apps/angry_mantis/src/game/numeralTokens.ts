// One tokenizer for every renderer of the prison-stencil numeral atlas (components/ArtAmount.svelte
// in Pixi, ui/StencilAmount.svelte in HTML), so they agree EXACTLY on what the atlas can draw: a text
// that tokenizes renders every character; a text with any unsupported character yields null and the
// caller falls back to styled text for the WHOLE string — never a partial render with glyphs dropped.
const CHAR_TO_GLYPH: Record<string, string> = {
	'0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
	'5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
	'.': 'period', ',': 'comma',
	$: 'dollar', '€': 'euro', '£': 'pound', '¥': 'yen', '￥': 'yen', '₹': 'rupee',
	'+': 'plusStencil', '!': 'bang', x: 'multx',
	'/': 'slash', '-': 'dash', '–': 'dash', '·': 'middot',
	...Object.fromEntries([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => [c, c])),
};
const PAIRS: Record<string, string> = { GC: 'GC', SC: 'SC', R$: 'RS' };
// Layout-only spaces: regular, NBSP, and the narrow/thin spaces Intl emits as group
// separators (fr formats '1 234,56 €' with U+202F NARROW NO-BREAK SPACE).
const SPACES = new Set([' ', '\u00a0', '\u202f', '\u2009']);

/** Glyph names in order; null entries are layout-only space cells; null result = unsupported text. */
export const tokenizeNumerals = (text: string): (string | null)[] | null => {
	const tokens: (string | null)[] = [];
	let i = 0;
	while (i < text.length) {
		const pair = PAIRS[text.slice(i, i + 2)];
		if (pair) {
			tokens.push(pair);
			i += 2;
			continue;
		}
		const ch = text[i];
		if (SPACES.has(ch)) tokens.push(null);
		else if (ch in CHAR_TO_GLYPH) tokens.push(CHAR_TO_GLYPH[ch]);
		else return null;
		i += 1;
	}
	return tokens;
};
