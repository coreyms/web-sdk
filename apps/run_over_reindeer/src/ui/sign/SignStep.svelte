<script lang="ts">
	// THE BET SYMBOLS on the sign bar (desktop_hud_r8): a bare red < and a bare green >, no plate and no glass, with a
	// white and a thin dark outline so they read on snow and on rock. Stepping rules and the sub click are the dock's
	// (ui/hud/HudStep.svelte, ui/betStep.ts): disabled at the end of the bet menu, past what the balance affords, and
	// whenever the bet is locked. The press area is the unseen box round the symbol, never under 44 CSS px, and it is
	// that box the widest amount rule seats (ui/sign/signLayout.ts seatAmount), clear of the Play's diamond.
	import { soc } from '../../game/social';
	import type { Controls } from '../controls.svelte';
	import { betStepTarget } from '../betStep';
	import { stepDraw } from './signLayout';
	import { stepSvg } from './signDraw';

	type Props = { dir: 1 | -1; controls: Controls; x: number; y: number; w: number; h: number; size: number };
	/** x, y, w, h: the press box, bar px; size: the symbol's height, bar px */
	const { dir, controls, x, y, w, h, size }: Props = $props();
	const target = $derived(controls.betDisabled() ? undefined : betStepTarget(dir));
	const step = () => {
		const next = betStepTarget(dir);
		if (next === undefined || controls.betDisabled()) return;
		controls.sound('soundPressSub');
		controls.setBet(next, { silent: true });
	};
	const label = $derived(dir > 0 ? soc('Increase bet', 'Increase play amount') : soc('Decrease bet', 'Decrease play amount'));
	const html = $derived(stepSvg(dir, stepDraw(size), w, h));
</script>

<button
	type="button"
	class="slot-btn hg sgb sgs"
	data-hud-step={dir > 0 ? 'plus' : 'minus'}
	style:left="{x}px"
	style:top="{y}px"
	style:width="{w}px"
	style:height="{h}px"
	disabled={target === undefined}
	onclick={step}
	aria-label={label}
>
	<svg class="s-in" viewBox="0 0 {w} {h}" aria-hidden="true">{@html html}</svg>
</button>
