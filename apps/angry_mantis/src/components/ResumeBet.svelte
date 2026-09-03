<script lang="ts">
	import { stateBet, stateUrlDerived } from 'state-shared';
	import { getContext } from '../game/context';
	import { onMount } from 'svelte';

	const context = getContext();

	onMount(() => {
		if (stateBet.betToResume?.active && stateBet.betToResume.mode) {
			stateBet.activeBetModeKey = stateBet.betToResume.mode;
		}
		// In replay mode the replay card / REPLAY button own playback (ui/ReplayModal.svelte).
		if (stateUrlDerived.replay()) return;
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	});
</script>
