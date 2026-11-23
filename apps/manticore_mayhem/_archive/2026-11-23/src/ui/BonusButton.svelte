<script lang="ts">
	import { soc } from '../game/social';
	// Feature (bonus-buy) button — Corey's "Feature Button Final" design (claude.ai/design 178e68a3,
	// 2026-09-06), scaled from its 176px tile onto our 92 / 116 / 78 sizes; position, size and corner
	// shape stay as the HUD pass set them. OFF: dark glass tile, faint rim, white PolyMath mark with the
	// green hub. ON (ante active or a buy mode armed): solid ink fill, gold rim + glow, the mode name in
	// gold above the mark; tapping opens the feature menu on that mode. Rim/text/glow colours and ring weight are the
	// Play button's (white at rest, #ffdc4a armed), not the design's #F9B705 — Corey 23:14. The design's blur(6) is dropped — house rule 2,
	// no backdrop-filter in the chrome.
	import Icon from './Icon.svelte';
	import type { Controls } from './controls.svelte';
	// THE ARMOURY: with a mode on this button OPENS the menu on that mode (controls.bonusPress), so its label says so
	import { ARMOURY_TEXT, fill } from '../game/armouryText';

	type Props = { size?: number; controls: Controls };
	const { size = 92, controls }: Props = $props();
	const ante = $derived(controls.anteActive());
	const armedKey = $derived(controls.armedLabel()); // the mode's short NAME (controls.armedLabel), not the raw key
	const onLabel = $derived(ante ? 'ANTE' : armedKey ? armedKey : null);
	const on = $derived(onLabel !== null);
	const k = $derived(size / 176); // design tile → our tile
	const mark = $derived(Math.round(104 * k)); // 104×93 at 176
	const label = $derived(Math.max(9, 19 * k));
	// rim, text and glow follow the Play button (Corey 23:14): its bezel at rest, its armed gold when a mode is on.
	// THE BRONZE PLATE (2026-10-15, ui/ChromeStyles.svelte .am-plate): the rim is the plate's bezel metal; the glow
	// stays, on the plate (34 at the design's 176, drawn in CSS px there: --plate-css is the button's size on screen).
	const GLOW = `0 0 calc(var(--plate-css) * ${34 / 176}) rgba(255,220,74,.45)`;
</script>

<button
	class="slot-btn chunky fb am-plate"
	class:on
	class:plate-gold={on}
	disabled={controls.bonusDisabled()}
	onclick={controls.bonusPress}
	aria-label={onLabel ? fill(ARMOURY_TEXT.aria.hudButtonOn, { name: onLabel }) : soc('Buy bonus', 'Get bonus')}
	style:width="{size}px"
	style:height="{size}px"
	style:--plate-s="{size}px"
	style:--plate-glow={on ? GLOW : undefined}
	style:gap="{Math.max(3, 10 * k)}px"
	style:--pm-hole={on ? '#0B0C10' : '#15161c'}
>
	{#if onLabel}<span class="lb" style:font-size="{label}px">{onLabel}</span>{/if}
	<span class="mark" style:width="{mark}px"><Icon name="polymath" s={mark} /></span>
</button>

<style>
	.fb {
		--pm-core: #e32400; /* theme accent: Manticore red (Angry Mantis green is #9cd92f) */
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		transition:
			transform 0.08s ease,
			filter var(--ui-hover-ms) ease;
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
