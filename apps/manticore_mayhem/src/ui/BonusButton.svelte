<script lang="ts">
	import { soc } from '../game/social';
	// Feature (bonus-buy) button — Corey's "Feature Button Final" design (claude.ai/design 178e68a3,
	// 2026-09-06), scaled from its 176px tile onto our 92 / 116 / 78 sizes; position, size and corner
	// shape stay as the HUD pass set them. OFF: dark glass tile, faint rim, white PolyMath mark with the
	// green hub. ON (ante active or a buy mode armed): solid ink fill, gold rim + glow, the mode name in
	// gold above the mark; tapping switches the mode off. Rim/text/glow colours and ring weight are the
	// Play button's (white at rest, #ffdc4a armed), not the design's #F9B705 — Corey 23:14. The design's blur(6) is dropped — house rule 2,
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
	// rim, text and glow follow the Play button (Corey 23:14): its white outline at rest, its armed
	// gold (#ffdc4a) when a mode is on — same ring weight and inset ring as SquareSpin
	const rim = $derived(Math.max(3, size * 0.03));
	const GOLD = '#ffdc4a';
	const glow = $derived(34 * k);
	const radius = $derived(Math.round(Math.min(size * 0.22, 8 + size * 0.07))); // same shape as the other buttons
	const shadow = $derived(
		on
			? `inset 0 0 0 ${rim}px ${GOLD}, 0 0 ${glow}px rgba(255,220,74,.45), 0 4px 12px rgba(0,0,0,.45)`
			: `inset 0 0 0 ${rim}px #fff, 0 4px 12px rgba(0,0,0,.45)`,
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
		color: #ffdc4a;
		white-space: nowrap;
	}
</style>
