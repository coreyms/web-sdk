<script lang="ts">
	// Opens the Autoplay menu (AutoplayModal). While a run is live the button turns into the
	// stop control (Manticore red) (AUTOPLAY_COLOURS, Corey 2026-10-21 "deeper green and Manticore Red").
	import ChunkyBtn from './ChunkyBtn.svelte';
	import Icon from './Icon.svelte';
	import type { Controls } from './controls.svelte';
	import { AUTOPLAY_COLOURS } from '../game/constants';

	type Props = { size?: number; controls: Controls; compact?: boolean };
	const { size = 42, controls, compact = false }: Props = $props();
	void compact;

	const running = $derived(controls.autoRunning());
</script>

<ChunkyBtn glass {size} color={running ? AUTOPLAY_COLOURS.stop : '#fff'} active={running} disabled={controls.autoDisabled()} onclick={controls.autoPress} ariaLabel="Autoplay">
	{#if running}<Icon name="close" s={size * 0.5} />{:else}<Icon name="auto" s={size * 0.42} />{/if}
</ChunkyBtn>
