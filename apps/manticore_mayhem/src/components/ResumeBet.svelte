<script lang="ts">
	import { stateBet, stateUrlDerived } from 'state-shared';
	import { getContext } from '../game/context';
	import { awaitPlaqueAssets } from '../game/assetGate';
	import { onMount } from 'svelte';

	const context = getContext();

	// THE OPEN ROUND COMES FIRST (Engine guideline 187, 2026-10-13). After a reload with a round still open the game
	// used to wait here for the WHOLE deferred phase (18 to 20 s on the dev build once the creature's sheets were in
	// it, 30 s at most) with Spin enabled: a press in that window sent a new play over the open round, whose win was
	// then never shown and never ended. Two things changed:
	//   1. stateGame.resumeHold is set from boot and cleared only here, once the round has been handed to the game
	//      actor (the same call stack: the actor is busy from then until the round's end-round is answered, which is
	//      the controls' normal busy state) or once it is known there is none. While it is set nothing starts a round.
	//   2. the resume waits for the win plaque's own set only (game/assetGate.ts awaitPlaqueAssets, the first deferred
	//      group). A resumed round draws nothing a round started by the first Spin press does not: the symbols' drop
	//      and idle sheets, the label caps, the night scene, the frame's night set and the creature are each picked
	//      up by their own component when they land, and the plaque screens wait on this same gate themselves.
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
		// no open round: nothing to protect, play is free at once (the broadcast below only snaps the board to the
		// last round's picture)
		if (!open) context.stateGame.resumeHold = false;
		let waitMs = -1;
		if (import.meta.env.DEV) {
			// house rule: extend __manticore, never a new global (tools/manticore/resume_probe.js reads it)
			((window as any).__manticore ??= {}).resume = () => ({ open, hold: context.stateGame.resumeHold, mountedAt: Math.round(t0), waitMs });
		}
		await awaitPlaqueAssets();
		context.eventEmitter.broadcast({ type: 'resumeBet' });
		context.stateGame.resumeHold = false;
		waitMs = Math.round(performance.now() - t0);
	});
</script>
