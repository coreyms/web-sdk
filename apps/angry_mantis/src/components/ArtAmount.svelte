<script lang="ts" module>
	import { tokenizeNumerals as tokenize } from '../game/numeralTokens';

	/** Can every character of this formatted amount be drawn from the glyph atlas?
	 *  (Spaces are layout-only.) Callers whose text changes per frame must use this guard
	 *  and provide their own throttled styled-text fallback (see CountUpText); anyone else
	 *  who skips it still renders whole via the internal GameText fallback below. */
	export const artAmountSupports = (text: string) => tokenize(text) !== null;
</script>

<script lang="ts">
	// Amounts drawn from the prison-stencil glyph atlas (tools/build_stencil_atlas.py): batched sprites
	// off one resident texture, so changing the value costs a few transforms — no canvas raster, no
	// texture upload. The row layout (tabular cells, odometer reserve) is game/numeralLayout.ts,
	// shared with the painted door (DoorPaint.svelte).
	// VERTICAL ANCHOR: prop `y` is the BASELINE — full-height glyphs span [y - height, y].
	import { Sprite } from 'pixi-svelte';

	import { layoutNumerals } from '../game/numeralLayout';
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
		/** multiply tint on the white sheet (the stencil takes tint cleanly: cream, dark, rust) */
		tint?: number;
		/** a second, tinted run drawn FIRST and offset (fractions of `height`) — a hard drop shadow */
		shadow?: { dx: number; dy: number; tint: number };
	};
	const { text, reserve, height = 72, x = 0, y = 0, maxWidth, alpha = 1, tint = 0xffffff, shadow }: Props = $props();

	const tokens = $derived(tokenize(text));
	const layout = $derived(tokens ? (layoutNumerals(text, height, { reserve, maxWidth }) ?? []) : []);
</script>

{#if tokens}
	{#if shadow}
		{#each layout as g, i (i)}
			{#if g.key}
				<Sprite key="num_{g.key}.png" x={x + g.x + shadow.dx * height} y={y - height / 2 + g.y + shadow.dy * height} width={g.w} height={g.h} {alpha} tint={shadow.tint} />
			{/if}
		{/each}
	{/if}
	{#each layout as g, i (i)}
		{#if g.key}
			<Sprite key="num_{g.key}.png" x={x + g.x} y={y - height / 2 + g.y} width={g.w} height={g.h} {alpha} {tint} />
		{/if}
	{/each}
{:else}
	<!-- Safety net for unguarded callers (a character outside the stencil set, e.g. an operator code in another script):
	     the WHOLE string as styled text — never a partial art render with glyphs dropped.
	     The art path's baseline sits at prop y (optical centre y - height/2); GameText anchors
	     its centre, so shift up by height/2 so both paths land on the same optical centre.
	     Not for per-frame text: this re-rasterizes on every change (house rule 1) — count-ups
	     must keep guarding with artAmountSupports and throttling their own fallback. -->
	<GameText {text} size={height} {x} y={y - height / 2} {maxWidth} {alpha} />
{/if}
