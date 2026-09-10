<script lang="ts">
	// Feeds a count-up's live value into the painted door (game/doorPaint.svelte.ts) — the
	// StagedCountUpProvider hands its value to a snippet, and an $effect is the tidy way to turn
	// that into state writes. DoorPaint turns each string into glyph boxes (uniforms only).
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { doorPaintState } from '../game/doorPaint.svelte';

	type Props = { value: number; target: number; enabled: boolean };
	const { value, target, enabled }: Props = $props();
	$effect(() => {
		if (!enabled) return;
		doorPaintState.amountReserve = bookEventAmountToCurrencyString(target);
		doorPaintState.amountText = bookEventAmountToCurrencyString(value, { fractionDigitsOfBookAmount: target });
	});
</script>
