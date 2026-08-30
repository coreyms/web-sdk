<script lang="ts">
	// Currency text for count-ups. A naive per-frame GameText re-rasterizes gradient+stroke+blurred-shadow
	// text and uploads a new GPU texture 60×/s — visibly choppy on iOS, and the discarded textures trigger
	// GC right as the next spin's reels fall in. Two mitigations:
	//   1. the DISPLAYED string updates at ~15Hz (trailing edge guarantees the final value lands);
	//   2. while counting, the drop shadow is un-blurred (canvas shadowBlur is the expensive raster path);
	//      once `settled`, the full-quality style returns for the resting amount.
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import GameText, { type GameTextPreset } from './GameText.svelte';
	import ArtAmount, { artAmountSupports } from './ArtAmount.svelte';

	type Props = {
		amount: number;
		settled?: boolean;
		preset?: GameTextPreset;
		size?: number;
		x?: number;
		y?: number;
		maxWidth?: number;
	};
	const { amount, settled = false, preset = 'gold', size = 72, x = 0, y = 0, maxWidth }: Props = $props();

	const INTERVAL = 66; // ~15Hz text updates; the underlying tween still animates at full frame rate
	let display = $state(0);
	const displayText = $derived(bookEventAmountToCurrencyString(display));
	let last = 0;
	let trailing: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const v = amount;
		const now = performance.now();
		clearTimeout(trailing);
		if (settled || now - last >= INTERVAL) {
			last = now;
			display = v;
		} else {
			trailing = setTimeout(() => {
				last = performance.now();
				display = v;
			}, INTERVAL);
		}
		return () => clearTimeout(trailing);
	});
</script>

{#if artAmountSupports(displayText)}
	<!-- stencil glyph sprites: zero raster/upload cost, so no styling downgrade while counting -->
	<ArtAmount text={displayText} height={size} {x} {y} {maxWidth} />
{:else}
	<!-- session currency outside the glyph set: the original styled-text path -->
	<GameText
		text={displayText}
		{preset}
		{size}
		{x}
		{y}
		{maxWidth}
		extra={settled ? {} : { dropShadow: { color: 0x000000, alpha: 0.6, blur: 0, distance: size * 0.07, angle: Math.PI / 2 } }}
	/>
{/if}
