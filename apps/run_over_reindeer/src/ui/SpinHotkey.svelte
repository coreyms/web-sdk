<script lang="ts">
	// (Run Over Reindeer 2026-11-18, Corey "Yes": Manticore Mayhem's ui/SpinHotkey.svelte carried over unchanged)
	// ONE PRESS, ONE ROUND (harsh review 2026-11-17 M4, Corey "M4 we should fix"): Stake's rule is that one action never
	// places consecutive plays and that autoplay starts only through its confirmation step. The shared OnHotkey calls its
	// onpress on every keyDown until its 400 ms hold timer fires, so the key's auto-repeat pressed Spin again, and the
	// shared EnableSpaceHold turned a held key into a play loop (stateBet.isSpaceHold, re-entered by the bet machine's
	// checkSpaceHold). This app no longer mounts EnableSpaceHold (ui/Chrome.svelte), so isSpaceHold stays false, and this
	// handler takes the Space hotKey in place of OnHotkey: a keyDown while the key is already down is an auto-repeat and
	// does nothing, so a held key plays exactly one round; a new round needs a release and a new press. A new press during
	// a round still reaches controls.spin, which stops or hurries the spin exactly as before. The shared packages are
	// unchanged.
	import { getContextEventEmitter } from 'utils-event-emitter';

	type EmitterEventHotKey = { type: 'hotKey'; key: string; action: 'keyUp' | 'keyDown' };
	type Props = { disabled?: boolean; onpress: () => void };

	const props: Props = $props();
	const context = getContextEventEmitter<EmitterEventHotKey>();
	// tracked whether or not the handler is disabled, so a press made under a modal or a press gate and held past it
	// never plays when the gate closes
	let down = false;
	// the browser's own auto-repeat flag, read in the capture phase before EnableHotkey's bubble-phase listener
	// broadcasts the hotKey (the emitter event does not carry it): a repeat after a lost keyup is ignored too
	let repeat = false;
	const onKeyCapture = (e: KeyboardEvent) => {
		if (e.key === ' ') repeat = e.repeat;
	};

	context.eventEmitter.subscribeOnMount({
		hotKey: (emitterEvent) => {
			if (emitterEvent.key !== 'Space') return;
			if (emitterEvent.action === 'keyUp') {
				down = false;
				return;
			}
			if (emitterEvent.action !== 'keyDown' || down || repeat) return;
			down = true;
			if (props.disabled) return;
			props.onpress();
		},
	});

	// a key released while the page had no focus sends no keyup here
	const release = () => (down = false);
</script>

<svelte:window onblur={release} onkeydowncapture={onKeyCapture} />
<svelte:document onvisibilitychange={release} />
