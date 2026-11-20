<script lang="ts">
	// THE FEATURE BUTTON (Drop 6, the second hero): an ember pill on the big screens, an ember circle on the landscape
	// phone (34 px, icon only) and, on the portrait phone (round 6), a small wide pill with its icon over its word. Its
	// press is controls.bonusPress, unchanged (it opens THE ARMOURY; with a mode on, on that mode). With a mode ON it turns gold and says the mode's name, never changing size:
	//   Ante, an armed buy (BONUS, SUPER, EPIC, MYSTERY)  gold rim and glow, the name
	//   Super Ante                                         a step hotter: a double rim, SUPER over ANTE
	// Disabled whenever controls.bonusDisabled() says (a spin, free spins, a held round).
	import { stateBet } from 'state-shared';
	import type { Controls } from '../controls.svelte';
	import { soc } from '../../game/social';
	import { modeShortLabel } from '../../game/betModeMeta';
	import { ARMOURY_TEXT, fill } from '../../game/armouryText';
	import { HUD_CONFIG } from '../hudTheme';
	import HudIcon, { featureArt } from './HudIcon.svelte';
	import { engraving } from './engrave';

	type Props = { controls: Controls; x: number; y: number; w: number; h: number; shape: 'pill' | 'circ' | 'ln' | 'wide'; cls?: string };
	const { controls, x, y, w, h, shape, cls = '' }: Props = $props();

	const onLabel = $derived(controls.anteActive() ? modeShortLabel(stateBet.activeBetModeKey) : controls.armedLabel());
	const on = $derived(onLabel !== null);
	const two = $derived(onLabel !== null && onLabel.includes(' '));
	const words = $derived((onLabel ?? '').split(' '));
	const sante = $derived(stateBet.activeBetModeKey.toUpperCase() === 'SUPER_ANTE');
	// the glyph (bet bar fix 2026-11-19): HUD_CONFIG.featureGlyph's candidate, or none (the word alone, .noic)
	const glyph = featureArt() !== null;
	// THE ENGRAVED MARK (2026-11-19, HUD_CONFIG.featureMark): no word at rest, only the PolyMath mark etched into the
	// glass; with a mode on the same mark inlaid in gold, the mode's word over it (as before); the two cross-fade (150 ms).
	// The key's padding box is w x h inside its 1 px border. Its aria-label is unchanged.
	const M = HUD_CONFIG.featureMark;
	const place = (st: NonNullable<typeof M>['rest']) => (shape === 'ln' && M?.round ? { ...st, ...M.round } : st);
	const restMark = $derived(M ? engraving(w - 2, h - 2, place(M.rest)) : '');
	const onMark = $derived(M ? engraving(w - 2, h - 2, place(M.on)) : '');
	// disabled ("Cold Inlay", 2026-11-20): the mark inlaid in steel (hud.css shows it only while the key is disabled)
	const offMark = $derived(M?.off ? engraving(w - 2, h - 2, place(M.off)) : '');
</script>

<button
	type="button"
	class="slot-btn hg fbtn fb hit {shape === 'pill' ? '' : 'circ'} {shape === 'ln' ? 'ln gl-fs' : ''} {shape === 'wide' ? 'wide' : ''} {cls}"
	class:ante={on}
	class:sante
	class:noic={!glyph || !!M}
	class:mark={!!M}
	style:left="{x}px"
	style:top="{y}px"
	style:width="{w}px"
	style:height="{h}px"
	style:--k="{h}px"
	disabled={controls.bonusDisabled()}
	onclick={controls.bonusPress}
	aria-label={on ? fill(ARMOURY_TEXT.aria.hudButtonOn, { name: onLabel ?? '' }) : soc('Buy bonus', 'Get bonus')}
>
	{#if M}
		<span class="ec"><span class="em em-rest">{@html restMark}</span><span class="em em-on">{@html onMark}</span>{#if offMark}<span class="em em-off">{@html offMark}</span>{/if}</span>
		<i class="scr"></i>
	{/if}
	<i class="lt"></i>
	{#if glyph && !M}<HudIcon name="arm" />{/if}
	{#if on && two}
		<span class="lb two"><b>{words[0]}</b> <b>{words.slice(1).join(' ')}</b></span>
	{:else if on || !M}
		<span class="lb" class:long={(onLabel ?? '').length > 5}>{onLabel ?? HUD_CONFIG.featureName}</span>
	{/if}
</button>
