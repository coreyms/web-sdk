<script lang="ts">
	import { getContext } from '../game/context';
	import Anticipation from './Anticipation.svelte';

	const context = getContext();
</script>

{#each context.stateGame.board as reel}
	{#if reel.reelState.anticipating}
		<Anticipation {reel} oncomplete={() => (reel.reelState.anticipating = false)} />
	{/if}
{/each}
