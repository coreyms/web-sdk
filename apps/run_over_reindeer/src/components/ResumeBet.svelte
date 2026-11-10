<script lang="ts">
	import { stateBet, stateUrlDerived } from 'state-shared';
	import { getContext } from '../game/context';
	import { onMount } from 'svelte';

	const context = getContext();

	// THE OPEN ROUND COMES FIRST (Engine guideline 187; the house rule from Manticore Mayhem). After a reload with a
	// round still open, nothing may start a new round until the open one has been handed to the game actor:
	// stateGame.resumeHold is set from boot and cleared only here, once the round has been handed over (the actor is
	// busy from then until the round's end-round is answered) or once it is known there is none.
	onMount(() => {
		const open = !!stateBet.betToResume?.active;
		if (open && stateBet.betToResume?.mode) {
			stateBet.activeBetModeKey = stateBet.betToResume.mode;
		}
		// In replay mode the replay card / REPLAY button own playback (ui/ReplayModal.svelte).
		if (stateUrlDerived.replay()) {
			context.stateGame.resumeHold = false;
			return;
		}
		if (import.meta.env.DEV) {
			// house rule: extend __reindeer, never a new global
			((window as any).__reindeer ??= {}).resume = () => ({ open, hold: context.stateGame.resumeHold });
		}
		context.eventEmitter.broadcast({ type: 'resumeBet' });
		context.stateGame.resumeHold = false;
	});
</script>
