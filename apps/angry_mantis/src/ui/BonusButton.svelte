<script lang="ts">
	import { soc } from '../game/social';
	// Bonus-buy button: flat green square with the PolyMath Games mark (Corey 2026-09-06, same geometry as PolyMathIntro)
	// (the mantis head it replaced stays in static/assets/ui for the modals). Green = open the bonus
	// modal; amber "ANTE ON" / "<MODE> ON" = tap to switch the mode off.
	import ChunkyBtn from './ChunkyBtn.svelte';
	import Icon from './Icon.svelte';
	import type { Controls } from './controls.svelte';

	type Props = { size?: number; controls: Controls };
	const { size = 92, controls }: Props = $props();
	const ante = $derived(controls.anteActive());
	// armed buy mode mirrors the ante affordance: amber head + "<MODE> ON", tap to switch off
	const armedKey = $derived(controls.armedBuy());
	// just the mode name (Corey 2026-09-06): "MYSTERY ON" clipped on the 78px portrait button
	const onLabel = $derived(ante ? 'ANTE' : armedKey ? armedKey : null);
	const icon = $derived(Math.round(size * 0.66));
</script>

<ChunkyBtn {size} color={onLabel ? '#e8b04a' : '#9CD92F'} active disabled={controls.bonusDisabled()} onclick={controls.bonusPress} ariaLabel={ante ? 'Disable Ante' : armedKey ? `Cancel ${armedKey}` : soc('Buy bonus', 'Get bonus')}>
	<Icon name="polymath" s={icon} />
	{#if onLabel}
		<span class="ante" style:font-size="{size > 80 ? 12 : 10}px" style:top="{size > 80 ? 6 : 5}px">{onLabel}</span>
	{/if}
</ChunkyBtn>

<style>
	.ante {
		position: absolute;
		left: 0;
		right: 0;
		font-family: var(--ui-font);
		font-weight: 900;
		letter-spacing: 1.2px;
		color: #1a0c00;
		text-align: center;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.25);
	}
</style>
