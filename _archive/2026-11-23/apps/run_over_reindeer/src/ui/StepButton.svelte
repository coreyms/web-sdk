<script lang="ts">
	// Inline bet stepper for the HUD (Corey 2026-09-06): a small glass square with a − or + glyph
	// beside the SPIN readout. Same stepping rules as the modal BetAdjuster (betStep.ts); disabled
	// at the end of the bet menu, past what the balance affords, and whenever the bet is locked.
	import { soc } from '../game/social';
	import ChunkyBtn from './ChunkyBtn.svelte';
	import type { Controls } from './controls.svelte';
	import { betStepTarget } from './betStep';

	type Props = { dir: 1 | -1; size?: number; controls: Controls };
	const { dir, size = 28, controls }: Props = $props();
	const target = $derived(controls.betDisabled() ? undefined : betStepTarget(dir));
	const step = () => {
		const next = betStepTarget(dir);
		if (next === undefined || controls.betDisabled()) return;
		controls.sound('soundPressSub');
		controls.setBet(next, { silent: true });
	};
	const label = $derived(dir > 0 ? soc('Increase bet', 'Increase play amount') : soc('Decrease bet', 'Decrease play amount'));
</script>

<ChunkyBtn glass {size} disabled={target === undefined} onclick={step} ariaLabel={label}>
	<span class="glyph" style:font-size="{Math.round(size * 0.68)}px" style:line-height="{size}px">{dir > 0 ? '+' : '−'}</span>
</ChunkyBtn>

<style>
	.glyph {
		font-family: var(--ui-font);
		font-weight: 800;
		color: #fff;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
		display: block;
		margin-top: -1px; /* optical centre: the glyphs sit a hair low in Outfit's box */
	}
</style>
