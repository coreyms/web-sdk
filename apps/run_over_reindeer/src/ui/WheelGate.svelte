<script lang="ts">
	// THE SUPER WHEEL'S PRESS (game/road/superWheel.ts, constants SUPER_WHEEL; Corey 2026-11-18: "When a player clicks spin,
	// Reindeer runs in to spin it"). Mounted while the wheel waits. The Spin key starts it (ui/controls.svelte.ts); so does
	// a press on the wheel itself (this round target, exactly over the disc and under the HUD, which stays live: Turbo and
	// the Auto key still work), and Space (one press, one action: a held key's repeat does nothing; Enter too when no
	// control has the focus). Space belongs to the wheel while it waits (stateGame.pressGates), as it does to a card.
	import { onMount } from 'svelte';
	import { stateModal } from 'state-shared';

	import { getContext } from '../game/context';

	const context = getContext();
	const box = $derived(context.stateGame.wheelBox);
	const press = () => {
		context.eventEmitter.broadcast({ type: 'soundPressBet' });
		context.eventEmitter.broadcast({ type: 'wheelPress' });
	};

	onMount(() => {
		context.stateGame.pressGates += 1;
		const key = (e: KeyboardEvent) => {
			const own = e.code === 'Space' || (e.code === 'Enter' && !(document.activeElement instanceof HTMLButtonElement && !document.activeElement.hasAttribute('data-wheel-gate')));
			// (never under an open modal: the key is the modal's)
			if (!own || stateModal.modal != null) return;
			e.preventDefault();
			if (e.repeat) return;
			press();
		};
		window.addEventListener('keydown', key);
		return () => {
			window.removeEventListener('keydown', key);
			context.stateGame.pressGates = Math.max(0, context.stateGame.pressGates - 1);
		};
	});
</script>

{#if box}
	<button
		class="am-ui catch"
		data-wheel-gate
		onclick={press}
		aria-label="Spin the wheel"
		style:left="{box.cx - box.d / 2}px"
		style:top="{box.cy - box.d / 2}px"
		style:width="{box.d}px"
		style:height="{box.d}px"
	></button>
{/if}

<style>
	.catch {
		position: fixed;
		z-index: 10;
		border: none;
		padding: 0;
		border-radius: 50%;
		background: transparent;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.catch:focus-visible {
		outline: 3px solid #ffd21f;
		outline-offset: -3px;
	}
</style>
