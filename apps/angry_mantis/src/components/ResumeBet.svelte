<script lang="ts">
	import { stateBet, stateUrlDerived } from 'state-shared';
	import { getContext } from '../game/context';
	import { awaitDeferredAssets } from '../game/assetGate';
	import { onMount } from 'svelte';

	const context = getContext();

	// THE OPEN ROUND COMES FIRST (Engine guideline 187; Manticore's fix of 2026-10-13, ported 2026-10-15).
	// After a reload with a round still open the game waits here for the deferred assets (a resumed round
	// may snap straight into a bonus: the door, its paint, the backdrops), and until 1.0.12 Spin was
	// enabled all that time: a press in that window sent a new play over the open round, whose win was
	// then never shown and never ended. stateGame.resumeHold is set from boot and cleared only here, once
	// the round has been handed to the game actor (the same call stack: the actor is busy from then until
	// the round's end-round is answered, which is the controls' normal busy state) or once it is known
	// there is none. While it is set nothing starts a round (ui/controls.svelte.ts, EnableGameActor.svelte).
	onMount(async () => {
		const t0 = performance.now();
		const open = !!stateBet.betToResume?.active;
		if (open && stateBet.betToResume?.mode) {
			stateBet.activeBetModeKey = stateBet.betToResume.mode;
		}
		// In replay mode the replay card / REPLAY button own playback (ui/ReplayModal.svelte).
		if (stateUrlDerived.replay()) {
			context.stateGame.resumeHold = false;
			return;
		}
		// no open round: nothing to protect, play is free at once (the broadcast below only snaps the board
		// to the last round's picture)
		if (!open) context.stateGame.resumeHold = false;
		let waitMs = -1;
		if (import.meta.env.DEV) {
			// house rule: extend __angryMantis, never a new global (the 1.0.13 resume probe reads it)
			((window as any).__angryMantis ??= {}).resume = () => ({ open, hold: context.stateGame.resumeHold, mountedAt: Math.round(t0), waitMs });
		}
		await awaitDeferredAssets();
		context.eventEmitter.broadcast({ type: 'resumeBet' });
		context.stateGame.resumeHold = false;
		waitMs = Math.round(performance.now() - t0);
	});
</script>
