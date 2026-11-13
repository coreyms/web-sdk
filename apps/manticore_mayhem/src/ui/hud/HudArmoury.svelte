<script lang="ts">
	// THE FEATURE BUTTON (Drop 6, the second hero): an ember pill on the big screens, an ember circle on the phones (34 px
	// and icon only on the landscape phone). Its press is controls.bonusPress, unchanged (it opens THE ARMOURY; with a
	// mode on, on that mode). With a mode ON it turns gold and says the mode's name, never changing size:
	//   Ante, an armed buy (BONUS, SUPER, EPIC, MYSTERY)  gold rim and glow, the name
	//   Super Ante                                         a step hotter: a double rim, SUPER over ANTE
	// Disabled whenever controls.bonusDisabled() says (a spin, free spins, a held round).
	import { stateBet } from 'state-shared';
	import type { Controls } from '../controls.svelte';
	import { soc } from '../../game/social';
	import { modeShortLabel } from '../../game/betModeMeta';
	import { ARMOURY_TEXT, fill } from '../../game/armouryText';
	import { HUD_CONFIG } from '../hudTheme';
	import HudIcon from './HudIcon.svelte';

	type Props = { controls: Controls; x: number; y: number; w: number; h: number; shape: 'pill' | 'circ' | 'ln'; cls?: string };
	const { controls, x, y, w, h, shape, cls = '' }: Props = $props();

	const onLabel = $derived(controls.anteActive() ? modeShortLabel(stateBet.activeBetModeKey) : controls.armedLabel());
	const on = $derived(onLabel !== null);
	const two = $derived(onLabel !== null && onLabel.includes(' '));
	const words = $derived((onLabel ?? '').split(' '));
	const sante = $derived(stateBet.activeBetModeKey.toUpperCase() === 'SUPER_ANTE');
</script>

<button
	type="button"
	class="slot-btn hg fbtn fb hit {shape === 'pill' ? '' : 'circ'} {shape === 'ln' ? 'ln gl-fs' : ''} {cls}"
	class:ante={on}
	class:sante
	style:left="{x}px"
	style:top="{y}px"
	style:width="{w}px"
	style:height="{h}px"
	style:--k="{h}px"
	disabled={controls.bonusDisabled()}
	onclick={controls.bonusPress}
	aria-label={on ? fill(ARMOURY_TEXT.aria.hudButtonOn, { name: onLabel ?? '' }) : soc('Buy bonus', 'Get bonus')}
>
	<HudIcon name="arm" />
	{#if on && two}
		<span class="lb two"><b>{words[0]}</b> <b>{words.slice(1).join(' ')}</b></span>
	{:else}
		<span class="lb" class:long={(onLabel ?? '').length > 5}>{onLabel ?? HUD_CONFIG.featureName}</span>
	{/if}
</button>
