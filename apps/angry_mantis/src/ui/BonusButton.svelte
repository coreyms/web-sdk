<script lang="ts">
	import { soc } from '../game/social';
	import { stamp } from '../game/assets';
	// Mantis-head bonus-buy button. Green = open the bonus modal; amber "ANTE ON" = tap to switch Ante off.
	import ChunkyBtn from './ChunkyBtn.svelte';
	import type { Controls } from './controls.svelte';

	type Props = { size?: number; controls: Controls };
	const { size = 92, controls }: Props = $props();
	const ante = $derived(controls.anteActive());
	// armed buy mode mirrors the ante affordance: amber head + "<MODE> ON", tap to switch off
	const armedKey = $derived(controls.armedBuy());
	const onLabel = $derived(ante ? 'ANTE ON' : armedKey ? `${armedKey} ON` : null);
	const icon = $derived(Math.round(size * 0.7));
</script>

<ChunkyBtn {size} color={onLabel ? '#e8b04a' : '#9CD92F'} active disabled={controls.bonusDisabled()} onclick={controls.bonusPress} ariaLabel={ante ? 'Disable Ante' : armedKey ? `Cancel ${armedKey}` : soc('Buy bonus', 'Get bonus')}>
	<img src={stamp('/assets/ui/mantis-head.png')} alt="" style:width="{icon}px" style:height="{icon}px" draggable="false" />
	{#if onLabel}
		<span class="ante" style:font-size="{size > 80 ? 12 : 10}px" style:top="{size > 80 ? 6 : 5}px">{onLabel}</span>
	{/if}
</ChunkyBtn>

<style>
	img {
		object-fit: contain;
		pointer-events: none;
	}
	.ante {
		position: absolute;
		left: 0;
		right: 0;
		font-family: var(--ui-font);
		font-weight: 900;
		letter-spacing: 1.5px;
		color: #1a0c00;
		text-align: center;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.25);
	}
</style>
