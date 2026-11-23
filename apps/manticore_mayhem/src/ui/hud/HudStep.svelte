<script lang="ts">
	// THE STEPPER KEYS (Drop 6): minus and plus, small glass circles. Stepping rules and the sub click are the old
	// StepButton's (ui/betStep.ts): disabled at the end of the bet menu, past what the balance affords, and whenever the
	// bet is locked (a spin, free spins, a held round). Never a neighbour of the Spin (Corey: accidental changes there are
	// "like stealing in my eyes"): every layout keeps the mock's distance (ui/hud/hudLayout.ts).
	import { soc } from '../../game/social';
	import type { Controls } from '../controls.svelte';
	import { betStepTarget } from '../betStep';
	import HudIcon from './HudIcon.svelte';
	import { chevronSvg } from '../gear/gearArt';

	// THE GEAR BAR (2026-11-22, ui/gear/GearBar.svelte): `chev` draws the key as a bare gold < or > (no glass); what the
	// key does is the same.
	type Props = { dir: 1 | -1; controls: Controls; x: number; y: number; d: number; cls?: string; chev?: boolean };
	const { dir, controls, x, y, d, cls = '', chev = false }: Props = $props();
	const target = $derived(controls.betDisabled() ? undefined : betStepTarget(dir));
	const step = () => {
		const next = betStepTarget(dir);
		if (next === undefined || controls.betDisabled()) return;
		controls.sound('soundPressSub');
		controls.setBet(next, { silent: true });
	};
	const label = $derived(dir > 0 ? soc('Increase bet', 'Increase play amount') : soc('Decrease bet', 'Decrease play amount'));
</script>

<button
	type="button"
	class="slot-btn hg {chev ? 'bare' : 'gl'} sk hit {cls}"
	data-hud-step={dir > 0 ? 'plus' : 'minus'}
	style:left="{x}px"
	style:top="{y}px"
	style:width="{d}px"
	style:height="{d}px"
	disabled={target === undefined}
	onclick={step}
	aria-label={label}
>
	{#if chev}{@html chevronSvg(dir)}{:else}<HudIcon name={dir > 0 ? 'plus' : 'minus'} />{/if}
</button>
