<script lang="ts" module>
	import { NUMERAL_GLYPHS } from '../game/numeralGlyphs';

	import { tokenizeNumerals as tokenize } from '../game/numeralTokens';

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

	type Props = {
		text: string;
		/** count-up anchor: the FINAL string of the count. Its width defines the centred box and
		 *  the maxWidth fit, and `text` right-aligns inside it — so a growing value ticks in place
		 *  like an odometer (new digits appear on the left) instead of re-centring on every added
		 *  digit or comma. Omit for static amounts. */
		reserve?: string;
		height?: number;
		x?: number;
		y?: number;
		maxWidth?: number;
		alpha?: number;
	};
	const { text, reserve, height = 72, x = 0, y = 0, maxWidth, alpha = 1 }: Props = $props();

	const GAP = 0.05; // inter-cell gap, fraction of digit height
	const SPACE = 0.32;
	const COMMA_HANG = 21 / NUMERAL_DIGIT_H;
	const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
	const DIGIT_CELL = Math.max(...DIGITS.map((d) => NUMERAL_GLYPHS[d].w));
	const SEP_CELL = Math.max(NUMERAL_GLYPHS.comma.w, NUMERAL_GLYPHS.period.w);

	const tokens = $derived(tokenize(text));
	const reserveTokens = $derived(reserve === undefined ? null : tokenize(reserve));
	const layout = $derived.by(() => {
		if (!tokens) return [];
		const s = height / NUMERAL_DIGIT_H;
		type G = { key: string; cellW: number; w: number; h: number; va: string };
		const cellsFor = (toks: (string | null)[]) => {
			const glyphs: G[] = [];
			for (const name of toks) {
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
			return glyphs;
		};
		const gap = height * GAP;
		const rowW = (glyphs: G[]) =>
			glyphs.reduce((sum, g) => sum + g.cellW, 0) + gap * Math.max(0, glyphs.length - 1);
		const glyphs = cellsFor(tokens);
		const total = rowW(glyphs);
		// the reserved (final) string defines the box, so the fit scale and centring are decided
		// ONCE for the whole count; the live string right-aligns inside it (odometer growth)
		const reserved = reserveTokens ? Math.max(rowW(cellsFor(reserveTokens)), total) : total;
		const fit = maxWidth && reserved > maxWidth ? maxWidth / reserved : 1;
		let cx = (reserved / 2 - total) * fit;
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
