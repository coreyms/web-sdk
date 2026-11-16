<script lang="ts">
	// Pixi half of the landing flow: just the fade-through-black handoff. All landing visuals
	// (logo, feature tour, gold loading bar, press-to-continue) live in ui/LandingScreen.svelte —
	// HTML over the Pixi jungle Background — per the approved "Mantis Landing" design.
	import TransitionAnimation from './TransitionAnimation.svelte';
	import LedExit from './LedExit.svelte';

	// led: the LED billboard is up (components/Board.svelte): the press powers it down instead of the fade through black
	type Props = { play: boolean; led?: boolean; onloaded: () => void };
	const props: Props = $props();
</script>

{#if props.play}
	{#if props.led}<LedExit oncomplete={props.onloaded} />{:else}<TransitionAnimation oncomplete={props.onloaded} />{/if}
{/if}
