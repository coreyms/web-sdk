<script lang="ts" module>
	import { NUMERAL_GLYPHS } from '../game/numeralGlyphs';

	const CHAR_TO_GLYPH: Record<string, string> = {
		'0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
		'5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
		'.': 'period', ',': 'comma',
		$: 'dollar', '€': 'euro', '£': 'pound', '¥': 'yen', '₹': 'rupee',
		'+': 'plusStencil', '!': 'bang', x: 'multx',
		'/': 'slash', '-': 'dash', '–': 'dash', '·': 'middot',
		...Object.fromEntries([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => [c, c])),
	};
	const PAIRS: Record<string, string> = { GC: 'GC', SC: 'SC', R$: 'RS' };

	/** Can every character of this formatted amount be drawn from the glyph atlas?
	 *  (Space and NBSP are layout-only.) Callers fall back to styled text when not. */
	export const artAmountSupports = (text: string) =>
		[...text].every((ch) => ch === ' ' || ch === ' ' || ch in CHAR_TO_GLYPH);
</script>

<script lang="ts">
	// Amounts drawn from Corey's prison-stencil glyph atlas: batched sprites off one resident
	// texture, so changing the value costs a few transforms — no canvas raster, no texture upload.
	// TABULAR figures: every digit sits centred in an identical fixed-width cell, so a counting
	// value never reflows — only the glyph inside each cell changes. This (plus per-frame value
	// updates in CountUpText) is how slot count-ups read smooth. Currency symbols and letters
	// normalise to digit height (the sheet draws some taller); commas hang below the baseline.
	import { Sprite } from 'pixi-svelte';

	import { NUMERAL_DIGIT_H } from '../game/numeralGlyphs';

	type Props = { text: string; height?: number; x?: number; y?: number; maxWidth?: number; alpha?: number };
	const { text, height = 72, x = 0, y = 0, maxWidth, alpha = 1 }: Props = $props();

	const GAP = 0.05; // inter-cell gap, fraction of digit height
	const SPACE = 0.32;
	const COMMA_HANG = 21 / NUMERAL_DIGIT_H;
	const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
	const DIGIT_CELL = Math.max(...DIGITS.map((d) => NUMERAL_GLYPHS[d].w));
	const SEP_CELL = Math.max(NUMERAL_GLYPHS.comma.w, NUMERAL_GLYPHS.period.w);

	const layout = $derived.by(() => {
		const s = height / NUMERAL_DIGIT_H;
		type G = { key: string; cellW: number; w: number; h: number; va: string };
		const glyphs: G[] = [];
		const push = (name: string) => {
			const g = NUMERAL_GLYPHS[name]; // metrics are pre-normalized display units
			const isDigit = DIGITS.includes(name);
			const isSep = name === 'comma' || name === 'period';
			const w = g.w * s;
			const cellW = isDigit ? DIGIT_CELL * s : isSep ? SEP_CELL * s : w;
			glyphs.push({ key: name, cellW, w, h: g.h * s, va: g.va });
		};
		let i = 0;
		while (i < text.length) {
			const pair = PAIRS[text.slice(i, i + 2)];
			const ch = text[i];
			if (pair) {
				push(pair);
				i += 2;
				continue;
			}
			if (ch === ' ' || ch === ' ') glyphs.push({ key: '', cellW: height * SPACE, w: 0, h: 0, va: 'base' });
			else if (CHAR_TO_GLYPH[ch]) push(CHAR_TO_GLYPH[ch]);
			i += 1;
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

{#each layout as g, i (i)}
	{#if g.key}
		<Sprite key="num_{g.key}.png" x={x + g.x} y={y - height / 2 + g.y} width={g.w} height={g.h} {alpha} />
	{/if}
{/each}
