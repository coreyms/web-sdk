<script lang="ts">
	// THE WAR STANDARDS (gear bar 2026-11-22; the approved mock desktop_r6_2026-11-22): Menu in dark glass and the Armoury
	// in red cloth, hung on chains under the logo, a dark gold border inside the cloth. The Armoury carries the game's own
	// PolyMath mark in flat gold and no word; with a mode on, the mark inlaid in gold under the mode's name, as the dock's
	// key shows it. What each does is unchanged:
	//   Menu     ui/hud/HudKey.svelte's Menu key (controls.menuPress; lit while the help menu is open)
	//   Armoury  ui/hud/HudArmoury.svelte's key (controls.bonusPress; disabled whenever controls.bonusDisabled() says)
	// The press box is the standard's own box and never changes size; a press shrinks the drawing inside it.
	import { stateBet, stateUi } from 'state-shared';
	import type { Controls } from '../controls.svelte';
	import { soc } from '../../game/social';
	import { modeShortLabel } from '../../game/betModeMeta';
	import { ARMOURY_TEXT, fill } from '../../game/armouryText';
	import HudIcon from '../hud/HudIcon.svelte';
	import { STD, standardSvg } from './gearArt';
	import type { Box } from './gearLayout';

	/** chain: CSS px from the box's top up to the logo plate's underside */
	type Props = { kind: 'menu' | 'arm'; controls: Controls; box: Box; chain: number };
	const { kind, controls, box, chain }: Props = $props();

	const s = $derived(box.w / STD.w);
	const body = $derived(standardSvg(kind, Math.round((chain / s) * 2) / 2));
	const onLabel = $derived(kind === 'arm' ? (controls.anteActive() ? modeShortLabel(stateBet.activeBetModeKey) : controls.armedLabel()) : null);
	const on = $derived(onLabel !== null);
	const two = $derived(onLabel !== null && onLabel.includes(' '));
	const words = $derived((onLabel ?? '').split(' '));
	const sante = $derived(stateBet.activeBetModeKey.toUpperCase() === 'SUPER_ANTE');
</script>

{#if kind === 'menu'}
	<button type="button" class="slot-btn hg gs gs-menu hit" class:is-on={stateUi.menuOpen} data-hud="menu-key" data-piece="menu" style:left="{box.x}px" style:top="{box.y}px" style:width="{box.w}px" style:height="{box.h}px" style:--s="{s}px" onclick={controls.menuPress} aria-label="Menu" aria-expanded={stateUi.menuOpen}>
		<span class="gsa">{@html body}<HudIcon name="menu" /><span class="kl">MENU</span></span>
	</button>
{:else}
	<button
		type="button"
		class="slot-btn hg gs fb gs-arm hit"
		class:is-on={on}
		class:ante={on}
		class:sante
		data-piece="arm"
		style:left="{box.x}px"
		style:top="{box.y}px"
		style:width="{box.w}px"
		style:height="{box.h}px"
		style:--s="{s}px"
		disabled={controls.bonusDisabled()}
		onclick={controls.bonusPress}
		aria-label={on ? fill(ARMOURY_TEXT.aria.hudButtonOn, { name: onLabel ?? '' }) : soc('Buy bonus', 'Get bonus')}
	>
		<span class="gsa">
			{@html body}
			{#if on && two}
				<span class="lb two"><b>{words[0]}</b> <b>{words.slice(1).join(' ')}</b></span>
			{:else if on}
				<span class="lb">{onLabel}</span>
			{/if}
		</span>
	</button>
{/if}
