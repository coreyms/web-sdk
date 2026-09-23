<script lang="ts">
	// Opens the Autoplay Loadout menu (AutoplayModal). While a run is live the button turns into the
	// stop control; while a loadout is parked on the spin button it glows green as a reminder.
	import ChunkyBtn from './ChunkyBtn.svelte';
	import Icon from './Icon.svelte';
	import type { Controls } from './controls.svelte';

	type Props = { size?: number; controls: Controls; compact?: boolean };
	const { size = 42, controls, compact = false }: Props = $props();
	void compact;

	const running = $derived(controls.autoRunning());
	const loaded = $derived(controls.autoLoadout() !== null);
</script>

<ChunkyBtn glass {size} color={running ? '#ff5a8a' : loaded ? '#9CD92F' : '#fff'} active={running || loaded} disabled={controls.autoDisabled()} onclick={controls.autoPress} ariaLabel="Autoplay">
	{#if running}<Icon name="close" s={size * 0.5} />{:else}<Icon name="auto" s={size * 0.42} />{/if}
</ChunkyBtn>
