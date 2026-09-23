<script lang="ts">
	import { stateBet, stateUrlDerived } from 'state-shared';
	import { getContext } from '../game/context';
	import { awaitDeferredAssets } from '../game/assetGate';
	import { onMount } from 'svelte';

	const context = getContext();

	onMount(async () => {
		if (stateBet.betToResume?.active && stateBet.betToResume.mode) {
			stateBet.activeBetModeKey = stateBet.betToResume.mode;
		}
		// In replay mode the replay card / REPLAY button own playback (ui/ReplayModal.svelte).
		if (stateUrlDerived.replay()) return;
		// a resumed round may snap straight into a bonus (door, headers, backdrop are deferred assets)
		await awaitDeferredAssets();
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	});
</script>
