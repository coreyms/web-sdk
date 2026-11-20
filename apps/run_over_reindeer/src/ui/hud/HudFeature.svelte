<script lang="ts">
	// THE FEATURE BUTTON (Drop 6, the second hero; Manticore's ui/hud/HudArmoury.svelte under this game's name): a pill on
	// the big screens, a circle on the landscape phone (34 px, icon only) and, on the portrait phone (round 6), a small
	// wide pill with its icon over its word. Its press is controls.bonusPress, unchanged (it opens THE FAST LANE; with a
	// mode on, on that mode). With a mode ON it takes the theme's "on" state and says the mode's name, never changing size:
	//   an Ante level, an armed buy (BONUS, SUPER)   the "on" rim and glow, the name
	//   the top Ante level (HUD_CONFIG.topAnteKey)    a step hotter: a double rim
	// Its glyph is HUD_CONFIG.featureGlyph's (none by default since the bet bar fix, 2026-11-19: the word alone).
	// THE ENGRAVED MARK (2026-11-19, HUD_CONFIG.featureMark): no word at rest, only the PolyMath mark etched into the
	// glass; with a mode on the same mark inlaid in gold, the mode's word over it (as before). The two engravings are
	// both drawn and cross-fade (150 ms). Its aria-label is unchanged.
	// Disabled whenever controls.bonusDisabled() says (a spin, free spins, a held round).
	import { stateBet } from 'state-shared';
	import type { Controls } from '../controls.svelte';
	import { soc } from '../../game/social';
	import { modeCost, modeShortLabel } from '../../game/betModeMeta';
	import { FEATURE_MENU_TEXT } from '../../game/featureMenuData';
	import { HUD_CONFIG } from '../hudTheme';
	import HudIcon, { featureArt } from './HudIcon.svelte';
	import { engraving } from './engrave';

	type Props = { controls: Controls; x: number; y: number; w: number; h: number; shape: 'pill' | 'circ' | 'ln' | 'wide'; cls?: string };
	const { controls, x, y, w, h, shape, cls = '' }: Props = $props();

	// an Ante level says its level (Corey 2026-11-20: "can we have the button say 2X ANTE, 4X ANTE, 10X ANTE?"): the
	// number is the mode's own cost (game/betModeMeta.ts modeCost, as THE FAST LANE's slider reads it), never a table here
	const anteWord = (key: string) => `${modeCost(key)}X ${modeShortLabel(key)}`;
	const onLabel = $derived(controls.anteActive() ? anteWord(stateBet.activeBetModeKey) : controls.armedLabel());
	const on = $derived(onLabel !== null);
	// two lines ("10X" over "ANTE") on the phones' small keys; one line on the wide pill
	const two = $derived(onLabel !== null && onLabel.includes(' ') && shape !== 'pill');
	const words = $derived((onLabel ?? '').split(' '));
	const sante = $derived(stateBet.activeBetModeKey.toUpperCase() === HUD_CONFIG.topAnteKey);
	// the glyph (bet bar fix 2026-11-19): HUD_CONFIG.featureGlyph's candidate, or none (the word alone, .noic)
	const glyph = featureArt() !== null;
	// the engraved mark: the key's padding box (its 1 px border inside w x h), the circle's own place and size
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
	aria-label={on ? `${FEATURE_MENU_TEXT.name}: ${onLabel ?? ''} is on` : soc('Buy bonus', 'Get bonus')}
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
