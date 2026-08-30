<script lang="ts" module>
	import { NUMERAL_GLYPHS } from '../game/numeralGlyphs';

	const CHAR_TO_GLYPH: Record<string, string> = {
		'0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
		'5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
		'.': 'period', ',': 'comma',
		$: 'dollar', '€': 'euro', '£': 'pound', '¥': 'yen', '₹': 'rupee',
		G: 'G', C: 'C', S: 'S', R: 'R',
	};
	const PAIRS: Record<string, string> = { GC: 'GC', SC: 'SC', R$: 'RS' };

	/** Can every character of this formatted amount be drawn from the glyph atlas?
	 *  (Space and NBSP are layout-only.) Callers fall back to styled text when not. */
	export const artAmountSupports = (text: string) =>
		[...text].every((ch) => ch === ' ' || ch === ' ' || ch in CHAR_TO_GLYPH);
</script>

<script lang="ts">
	// Amounts drawn from Corey's prison-stencil glyph atlas: batched sprites off one resident
	// texture, so changing the value costs a few transforms — no canvas raster, no texture upload
	// (the thing CountUpText's 15Hz throttle existed to survive). Digits bottom-align on a shared
	// baseline; the comma hangs below it like real numerals; GC/SC/R$ use the pre-kerned pairs.
	import { Sprite } from 'pixi-svelte';

	import { NUMERAL_DIGIT_H } from '../game/numeralGlyphs';

	type Props = { text: string; height?: number; x?: number; y?: number; maxWidth?: number; alpha?: number };
	const { text, height = 72, x = 0, y = 0, maxWidth, alpha = 1 }: Props = $props();

	const GAP = 0.06; // inter-glyph gap, fraction of digit height
	const SPACE = 0.35;
	const COMMA_HANG = 21 / NUMERAL_DIGIT_H;

	const layout = $derived.by(() => {
		const s = height / NUMERAL_DIGIT_H;
		const glyphs: { key: string; w: number; h: number; hang: boolean }[] = [];
		let i = 0;
		while (i < text.length) {
			const pair = PAIRS[text.slice(i, i + 2)];
			const ch = text[i];
			if (pair) {
				const g = NUMERAL_GLYPHS[pair];
				glyphs.push({ key: pair, w: g.w * s, h: g.h * s, hang: false });
				i += 2;
				continue;
			}
			if (ch === ' ' || ch === ' ') {
				glyphs.push({ key: '', w: height * SPACE, h: 0, hang: false });
			} else {
				const name = CHAR_TO_GLYPH[ch];
				const g = name ? NUMERAL_GLYPHS[name] : undefined;
				if (g) glyphs.push({ key: name, w: g.w * s, h: g.h * s, hang: name === 'comma' });
			}
			i += 1;
		}
		const gap = height * GAP;
		let total = glyphs.reduce((sum, g) => sum + g.w, 0) + gap * Math.max(0, glyphs.length - 1);
		const fit = maxWidth && total > maxWidth ? maxWidth / total : 1;
		total *= fit;
		let cx = -total / 2;
		const placed = glyphs.map((g) => {
			const w = g.w * fit;
			const h = g.h * fit;
			// baseline at height/2 below centre: glyph bottoms sit there; commas hang past it
			const gy = height / 2 - h + (g.hang ? COMMA_HANG * height : 0) * fit;
			const p = { key: g.key, x: cx, y: gy, w, h };
			cx += w + gap * fit;
			return p;
		});
		return placed;
	});
</script>

{#each layout as g, i (i)}
	{#if g.key}
		<Sprite key="num_{g.key}.png" x={x + g.x} y={y - height / 2 + g.y} width={g.w} height={g.h} {alpha} />
	{/if}
{/each}
