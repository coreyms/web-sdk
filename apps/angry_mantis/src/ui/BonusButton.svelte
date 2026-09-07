<script lang="ts">
	import { soc } from '../game/social';
	// Feature (bonus-buy) button — Corey's "Feature Button Final" design (claude.ai/design 178e68a3,
	// 2026-09-06), scaled from its 176px tile onto our 92 / 116 / 78 sizes; position, size and corner
	// shape stay as the HUD pass set them. OFF: dark glass tile, faint rim, white PolyMath mark with the
	// green hub. ON (ante active or a buy mode armed): solid ink fill, gold rim + glow, the mode name in
	// gold above the mark; tapping switches the mode off. The design's blur(6) is dropped — house rule 2,
	// no backdrop-filter in the chrome.
	import Icon from './Icon.svelte';
	import type { Controls } from './controls.svelte';

	type Props = { size?: number; controls: Controls };
	const { size = 92, controls }: Props = $props();
	const ante = $derived(controls.anteActive());
	const armedKey = $derived(controls.armedBuy());
	const onLabel = $derived(ante ? 'ANTE' : armedKey ? armedKey : null);
	const on = $derived(onLabel !== null);
	const k = $derived(size / 176); // design tile → our tile
	const mark = $derived(Math.round(104 * k)); // 104×93 at 176
	const label = $derived(Math.max(9, 19 * k));
	const rim = $derived(Math.max(1.5, 2.5 * k));
	const glow = $derived(34 * k);
	const radius = $derived(Math.round(Math.min(size * 0.22, 8 + size * 0.07))); // same shape as the other buttons
	const shadow = $derived(
		on
			? `0 0 0 ${rim}px #F9B705, 0 0 ${glow}px rgba(249,183,5,.45), 0 ${10 * k}px ${24 * k}px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.18), inset 0 -${3 * k}px 0 rgba(0,0,0,.18)`
			: `0 0 0 ${rim}px rgba(244,246,251,.16), 0 ${10 * k}px ${24 * k}px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.18), inset 0 -${3 * k}px 0 rgba(0,0,0,.18)`,
	);
</script>

<button
	class="slot-btn chunky fb"
	class:on
	disabled={controls.bonusDisabled()}
	onclick={controls.bonusPress}
	aria-label={ante ? 'Disable Ante' : armedKey ? `Cancel ${armedKey}` : soc('Buy bonus', 'Get bonus')}
	style:width="{size}px"
	style:height="{size}px"
	style:border-radius="{radius}px"
	style:box-shadow={shadow}
	style:gap="{Math.max(3, 10 * k)}px"
	style:--pm-hole={on ? '#0B0C10' : '#15161c'}
>
	{#if onLabel}<span class="lb" style:font-size="{label}px">{onLabel}</span>{/if}
	<span class="mark" style:width="{mark}px"><Icon name="polymath" s={mark} /></span>
</button>

<style>
	.fb {
		--pm-core: #9cd92f;
		background: rgba(11, 12, 16, 0.72);
		color: #f4f6fb; /* the mark */
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		transition:
			box-shadow 0.25s,
			background 0.25s,
			transform 0.08s ease;
	}
	.fb.on {
		background: #0b0c10;
	}
	.fb:active:not(:disabled) {
		transform: translateY(1px);
	}
	.mark {
		display: block;
		pointer-events: none;
	}
	.lb {
		font-family: var(--ui-font);
		font-weight: 800;
		letter-spacing: 0.12em;
		text-indent: 0.12em;
		line-height: 1;
		color: #f9b705;
		white-space: nowrap;
	}
</style>
