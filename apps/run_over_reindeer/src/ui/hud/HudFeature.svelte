<script lang="ts">
	// THE FEATURE BUTTON (Drop 6, the second hero; Manticore's ui/hud/HudArmoury.svelte under this game's name): a pill on
	// the big screens, a circle on the landscape phone (34 px, icon only) and, on the portrait phone (round 6), a small
	// wide pill with its icon over its word. Its press is controls.bonusPress, unchanged (it opens THE FAST LANE; with a
	// mode on, on that mode). With a mode ON it takes the theme's "on" state and says the mode's name, never changing size:
	//   an Ante level, an armed buy (BONUS, SUPER)   the "on" rim and glow, the name
	//   the top Ante level (HUD_CONFIG.topAnteKey)    a step hotter: a double rim
	// Its glyph is HUD_CONFIG.featureGlyph's (none by default since the bet bar fix, 2026-11-19: the word alone).
	// Disabled whenever controls.bonusDisabled() says (a spin, free spins, a held round).
	import { stateBet } from 'state-shared';
	import type { Controls } from '../controls.svelte';
	import { soc } from '../../game/social';
	import { modeShortLabel } from '../../game/betModeMeta';
	import { FEATURE_MENU_TEXT } from '../../game/featureMenuData';
	import { HUD_CONFIG } from '../hudTheme';
	import HudIcon, { featureArt } from './HudIcon.svelte';

	type Props = { controls: Controls; x: number; y: number; w: number; h: number; shape: 'pill' | 'circ' | 'ln' | 'wide'; cls?: string };
	const { controls, x, y, w, h, shape, cls = '' }: Props = $props();

	const onLabel = $derived(controls.anteActive() ? modeShortLabel(stateBet.activeBetModeKey) : controls.armedLabel());
	const on = $derived(onLabel !== null);
	const two = $derived(onLabel !== null && onLabel.includes(' '));
	const words = $derived((onLabel ?? '').split(' '));
	const sante = $derived(stateBet.activeBetModeKey.toUpperCase() === HUD_CONFIG.topAnteKey);
	// the glyph (bet bar fix 2026-11-19): HUD_CONFIG.featureGlyph's candidate, or none (the word alone, .noic)
	const glyph = featureArt() !== null;
</script>

<button
	type="button"
	class="slot-btn hg fbtn fb hit {shape === 'pill' ? '' : 'circ'} {shape === 'ln' ? 'ln gl-fs' : ''} {shape === 'wide' ? 'wide' : ''} {cls}"
	class:ante={on}
	class:sante
	class:noic={!glyph}
	style:left="{x}px"
	style:top="{y}px"
	style:width="{w}px"
	style:height="{h}px"
	style:--k="{h}px"
	disabled={controls.bonusDisabled()}
	onclick={controls.bonusPress}
	aria-label={on ? `${FEATURE_MENU_TEXT.name}: ${onLabel ?? ''} is on` : soc('Buy bonus', 'Get bonus')}
>
	{#if glyph}<HudIcon name="arm" />{/if}
	{#if on && two}
		<span class="lb two"><b>{words[0]}</b> <b>{words.slice(1).join(' ')}</b></span>
	{:else}
		<span class="lb" class:long={(onLabel ?? '').length > 5}>{onLabel ?? HUD_CONFIG.featureName}</span>
	{/if}
</button>
