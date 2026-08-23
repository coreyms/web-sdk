<script lang="ts" module>
	export type EmitterEventReplay = { type: 'replayFinished' };
</script>

<script lang="ts">
	// Stake Engine replay checklist: round auto-loads, explicit PLAY button, slim UI, PLAY AGAIN afterwards.
	import { onMount } from 'svelte';
	import { stateBet, stateUrlDerived, type BetToResume } from 'state-shared';
	import { zIndex } from 'constants-shared/zIndex';

	import { getContext } from '../game/context';

	const context = getContext();

	let replayBet = $state<BetToResume>(null);
	let phase = $state<'ready' | 'playing' | 'done'>('ready');

	onMount(() => {
		replayBet = stateBet.betToResume;
	});

	context.eventEmitter.subscribeOnMount({
		replayFinished: () => (phase = 'done'),
	});

	const play = () => {
		if (!replayBet) return;
		stateBet.betToResume = { ...replayBet, active: true, event: '0' };
		if (replayBet.mode) stateBet.activeBetModeKey = replayBet.mode;
		phase = 'playing';
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};
</script>

{#if stateUrlDerived.replay() && phase !== 'playing' && !context.stateLayout.showLoadingScreen}
	<div class="replay" style="z-index: {zIndex.modal - 1}">
		<div class="card">
			<div class="title">ROUND REPLAY</div>
			{#if replayBet}
				<div class="meta">
					{replayBet.mode ?? ''} · payout {((replayBet.payoutMultiplier ?? 0) as number).toLocaleString()}x
				</div>
			{/if}
			<button type="button" onclick={play}>{phase === 'ready' ? 'PLAY' : 'PLAY AGAIN'}</button>
		</div>
	</div>
{/if}

<style lang="scss">
	.replay {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.card {
		pointer-events: auto;
		background: rgba(0, 0, 0, 0.75);
		border: 2px solid #f1c40f;
		border-radius: 1rem;
		padding: 1.5rem 2.5rem;
		color: white;
		text-align: center;
		font-family: system-ui, sans-serif;
	}
	.title { font-size: 1.4rem; letter-spacing: 0.1em; margin-bottom: 0.4rem; }
	.meta { opacity: 0.8; margin-bottom: 1rem; }
	button {
		font: inherit;
		font-size: 1.2rem;
		letter-spacing: 0.1em;
		padding: 0.7rem 2.5rem;
		border-radius: 999px;
		border: none;
		background: #f1c40f;
		color: #1a1a1a;
		cursor: pointer;
	}
</style>
