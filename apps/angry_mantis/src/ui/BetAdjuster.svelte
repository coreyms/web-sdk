<script lang="ts">
	import type { Controls } from './controls.svelte';

	type Props = { controls: Controls; compact?: boolean };
	const { controls, compact = false }: Props = $props();
	const btn = $derived(compact ? 38 : 46);
</script>

<div class="adj" style:padding={compact ? '8px 14px' : '10px 18px'}>
	<button class="slot-btn arrow" disabled={!controls.canStepBet(-1)} onclick={() => controls.stepBet(-1)} style:width="{btn}px" style:height="{btn}px" style:font-size="{compact ? 18 : 22}px" aria-label="Decrease bet">−</button>
	<button class="slot-btn mid" onclick={() => (controls.sound('soundPressGeneral'), (controls.openDenom()))} style:min-width="{compact ? 120 : 150}px">
		{#if controls.anteActive()}<span class="ante" style:font-size="{compact ? 9 : 10}px">ANTE MODE</span>{/if}
		<span class="lbl" style:font-size="{compact ? 10 : 11}px">SPIN</span>
		<span class="slot-num val" style:font-size="{compact ? 18 : 22}px">{controls.betText()}</span>
	</button>
	<button class="slot-btn arrow" disabled={!controls.canStepBet(1)} onclick={() => controls.stepBet(1)} style:width="{btn}px" style:height="{btn}px" style:font-size="{compact ? 18 : 22}px" aria-label="Increase bet">+</button>
</div>

<style>
	.adj {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		background: rgba(0, 0, 0, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 14px;
	}
	.arrow {
		border-radius: 10px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.04) 100%);
		box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.35), 0 3px 0 rgba(0, 0, 0, 0.4);
		color: #fff;
		font-weight: 900;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.arrow:disabled {
		background: rgba(255, 255, 255, 0.04);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
		color: rgba(255, 255, 255, 0.25);
		opacity: 1;
	}
	.mid {
		background: transparent;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}
	.ante {
		font-weight: 900;
		letter-spacing: 2px;
		color: #e8b04a;
		background: rgba(232, 176, 74, 0.15);
		padding: 2px 6px;
		border-radius: 4px;
		text-shadow: 0 0 8px rgba(232, 176, 74, 0.6);
		margin-bottom: 2px;
	}
	.lbl {
		font-weight: 900;
		letter-spacing: 2.5px;
		color: #ffdc4a;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
	}
	.val {
		font-weight: 700;
		color: #fff;
		text-shadow: 0 2px 3px rgba(0, 0, 0, 0.6);
	}
</style>
