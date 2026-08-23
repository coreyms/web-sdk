<script lang="ts">
	// Bet-amount picker: grid of the RGS bet options, sized for large social-currency values.
	import { stateBet, stateModal } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import Icon from './Icon.svelte';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { controls, master, scale, left, top, compact = false }: Props = $props();

	const open = $derived(stateModal.modal?.name === 'betAmountMenu');
	const close = () => (stateModal.modal = null);
	const select = (v: number) => {
		controls.setBet(v);
		close();
	};
	const cols = $derived(compact ? 4 : 6);
</script>

<ModalShell {open} onclose={close} {master} {scale} {left} {top} zIndex={3}>
	<button class="slot-btn x" onclick={(e) => (e.stopPropagation(), close())} style:top="{compact ? 14 : 22}px" style:right="{compact ? 14 : 24}px" style:width="{compact ? 38 : 46}px" style:height="{compact ? 38 : 46}px" aria-label="Close">
		<Icon name="close" s={compact ? 16 : 20} />
	</button>
	<div class="center">
		<div class="panel" onclick={(e) => e.stopPropagation()} role="presentation" style:padding={compact ? '24px 14px' : '32px 28px'} style:max-width={compact ? '100%' : '980px'}>
			<div class="title" style:font-size="{compact ? 12 : 13}px" style:margin-bottom="{compact ? 14 : 20}px">SELECT SPIN DENOMINATION</div>
			<div class="grid" style:grid-template-columns="repeat({cols}, minmax(0, 1fr))" style:gap="{compact ? 6 : 10}px" style:max-height="{compact ? 0.6 * master.height : 0.64 * master.height}px">
				{#each controls.betOptions() as v (v)}
					{@const selected = v === stateBet.betAmount}
					<button class="slot-btn opt" class:selected onclick={() => select(v)} style:height="{compact ? 52 : 62}px">
						<span class="slot-num" style:font-size="{compact ? 14 : 18}px">{numberToCurrencyString(v)}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>
</ModalShell>

<style>
	.x {
		position: absolute;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.4);
		box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.7);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
	}
	.center {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.panel {
		width: 100%;
		pointer-events: auto;
	}
	.title {
		font-weight: 900;
		letter-spacing: 3px;
		color: rgba(255, 255, 255, 0.65);
		text-align: center;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
	}
	.grid {
		display: grid;
		overflow-y: auto;
		padding-right: 4px;
	}
	.opt {
		min-width: 0;
		padding: 0 8px;
		border-radius: 12px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(0, 0, 0, 0.45));
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 4px 0 rgba(0, 0, 0, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.opt span {
		font-weight: 800;
		letter-spacing: 0.5px;
		color: #fff;
		text-shadow: 0 2px 0 rgba(0, 0, 0, 0.6);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.opt.selected {
		background: linear-gradient(180deg, rgba(62, 224, 126, 0.18), rgba(20, 40, 28, 0.55));
		box-shadow: inset 0 0 0 1.5px rgba(62, 224, 126, 0.7), 0 0 18px rgba(62, 224, 126, 0.25);
	}
	.opt.selected span {
		color: #3ee07e;
		text-shadow: 0 0 8px rgba(62, 224, 126, 0.7), 0 2px 0 rgba(0, 0, 0, 0.6);
	}
</style>
