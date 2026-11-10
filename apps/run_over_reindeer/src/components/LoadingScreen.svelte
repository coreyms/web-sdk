<script lang="ts">
	// Pixi half of the landing flow: just the fade-through-black handoff. All landing visuals
	// (logo, feature tour, gold loading bar, press-to-continue) live in ui/LandingScreen.svelte —
	// HTML over the Pixi jungle Background — per the approved "Mantis Landing" design.
	import TransitionAnimation from './TransitionAnimation.svelte';

	type Props = { play: boolean; onloaded: () => void };
	const props: Props = $props();
</script>

{#if props.play}
	<TransitionAnimation oncomplete={props.onloaded} />
{/if}
