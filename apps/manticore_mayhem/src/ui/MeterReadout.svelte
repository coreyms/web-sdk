<script lang="ts">
	// THE POWER METER MOCKUP, placement C (DEV ?meter=C; game/powerMeter.svelte.ts): the board's tile sum as a HUD
	// readout in the HUD's own TrioStat (same face, label colour and digit height as BALANCE / WIN), shown in a feature
	// only. Every rise re-keys the wrapper, which replays a CSS scale pop (bigger for a big rise). Transform and opacity
	// only: no filter, no backdrop.
	import { POWER_METER } from '../game/constants';
	import { meter, meterNumber } from '../game/powerMeter.svelte';
	import TrioStat from './TrioStat.svelte';

	type Props = { size?: 'sm' | 'md' | 'lg'; align?: 'left' | 'center' | 'right' };
	const { size = 'lg', align = 'center' }: Props = $props();
</script>

<div class="meter" class:on={meter.on} style:--fade="{POWER_METER.fadeMs}ms">
	{#key meter.popSeq}
		<div class="pop" class:big={meter.big} class:align-right={align === 'right'} style:--pop="{POWER_METER.popMs}ms" style:--s="{1 + POWER_METER.popScale}" style:--sb="{1 + POWER_METER.bigPopScale}">
			<TrioStat label={POWER_METER.word} value={meterNumber(meter.shown)} accent="#ffdc4a" {size} {align} />
		</div>
	{/key}
</div>

<style>
	.meter {
		opacity: 0;
		transition: opacity var(--fade) linear;
		pointer-events: none;
	}
	.meter.on {
		opacity: 1;
	}
	.pop {
		transform-origin: 50% 70%;
		animation: pop var(--pop) ease-out;
	}
	.pop.align-right {
		transform-origin: 100% 70%;
	}
	.pop.big {
		animation-name: popbig;
	}
	@keyframes pop {
		50% {
			transform: scale(var(--s));
		}
	}
	@keyframes popbig {
		50% {
			transform: scale(var(--sb));
		}
	}
</style>
