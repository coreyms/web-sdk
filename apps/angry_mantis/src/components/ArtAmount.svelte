<script lang="ts" module>
	import { NUMERAL_GLYPHS } from '../game/numeralGlyphs';

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

	/** One tokenizer feeds both the public guard and the layout, so they agree EXACTLY:
	 *  a text that passes artAmountSupports renders every character, and a text with any
	 *  unsupported character yields null — never a partial render with glyphs dropped.
	 *  Tokens are glyph names; null entries are layout-only space cells. */
	const tokenize = (text: string): (string | null)[] | null => {
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

	/** Can every character of this formatted amount be drawn from the glyph atlas?
	 *  (Spaces are layout-only.) Callers whose text changes per frame must use this guard
	 *  and provide their own throttled styled-text fallback (see CountUpText); anyone else
	 *  who skips it still renders whole via the internal GameText fallback below. */
	export const artAmountSupports = (text: string) => tokenize(text) !== null;
</script>

<script lang="ts">
	// Amounts drawn from Corey's prison-stencil glyph atlas: batched sprites off one resident
	// texture, so changing the value costs a few transforms — no canvas raster, no texture upload.
	// TABULAR figures: every digit sits centred in an identical fixed-width cell, so a counting
	// value never reflows — only the glyph inside each cell changes. This (plus per-frame value
	// updates in CountUpText) is how slot count-ups read smooth. Currency symbols and letters
	// normalise to digit height (the sheet draws some taller); commas hang below the baseline.
	// VERTICAL ANCHOR: prop `y` is the BASELINE — full-height glyphs span [y - height, y].
	import { Sprite } from 'pixi-svelte';

	import { NUMERAL_DIGIT_H } from '../game/numeralGlyphs';
	import GameText from './GameText.svelte';

	type Props = { text: string; height?: number; x?: number; y?: number; maxWidth?: number; alpha?: number };
	const { text, height = 72, x = 0, y = 0, maxWidth, alpha = 1 }: Props = $props();

	const GAP = 0.05; // inter-cell gap, fraction of digit height
	const SPACE = 0.32;
	const COMMA_HANG = 21 / NUMERAL_DIGIT_H;
	const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
	const DIGIT_CELL = Math.max(...DIGITS.map((d) => NUMERAL_GLYPHS[d].w));
	const SEP_CELL = Math.max(NUMERAL_GLYPHS.comma.w, NUMERAL_GLYPHS.period.w);

	const tokens = $derived(tokenize(text));
	const layout = $derived.by(() => {
		if (!tokens) return [];
		const s = height / NUMERAL_DIGIT_H;
		type G = { key: string; cellW: number; w: number; h: number; va: string };
		const glyphs: G[] = [];
		for (const name of tokens) {
			if (name === null) {
				glyphs.push({ key: '', cellW: height * SPACE, w: 0, h: 0, va: 'base' });
				continue;
			}
			const g = NUMERAL_GLYPHS[name]; // metrics are pre-normalized display units
			const isDigit = DIGITS.includes(name);
			const isSep = name === 'comma' || name === 'period';
			const w = g.w * s;
			const cellW = isDigit ? DIGIT_CELL * s : isSep ? SEP_CELL * s : w;
			glyphs.push({ key: name, cellW, w, h: g.h * s, va: g.va });
		}
		const gap = height * GAP;
		let total = glyphs.reduce((sum, g) => sum + g.cellW, 0) + gap * Math.max(0, glyphs.length - 1);
		const fit = maxWidth && total > maxWidth ? maxWidth / total : 1;
		total *= fit;
		let cx = -total / 2;
		return glyphs.map((g) => {
			const cellW = g.cellW * fit;
			const w = g.w * fit;
			const h = g.h * fit;
			// baseline at height/2 below centre; commas hang past it; '+' centres on the cap band
			let gy = height / 2 - h;
			if (g.va === 'hang') gy += COMMA_HANG * height * fit;
			else if (g.va === 'mid') gy -= (height * fit - h) / 2;
			const p = { key: g.key, x: cx + (cellW - w) / 2, y: gy, w, h };
			cx += cellW + gap * fit;
			return p;
		});
	});
</script>

{#if tokens}
	{#each layout as g, i (i)}
		{#if g.key}
			<Sprite key="num_{g.key}.png" x={x + g.x} y={y - height / 2 + g.y} width={g.w} height={g.h} {alpha} />
		{/if}
	{/each}
{:else}
	<!-- Safety net for unguarded callers (locale currency outside the stencil set, e.g. zł/₫/₩):
	     the WHOLE string as styled text — never a partial art render with glyphs dropped.
	     The art path's baseline sits at prop y (optical centre y - height/2); GameText anchors
	     its centre, so shift up by height/2 so both paths land on the same optical centre.
	     Not for per-frame text: this re-rasterizes on every change (house rule 1) — count-ups
	     must keep guarding with artAmountSupports and throttling their own fallback. -->
	<GameText {text} size={height} {x} y={y - height / 2} {maxWidth} {alpha} />
{/if}
