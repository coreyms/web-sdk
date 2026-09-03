<script lang="ts">
	// Bonus-buy modal — "CHOW LINE" (Corey's Claude Design "Meal Tickets 1a", 2026-09-02):
	// a row of four tilted meal tickets over the dimmed game with the bet stepper beneath
	// (landscape + phone-sideways), or a 2×2 ticket grid with the stepper at the bottom (portrait —
	// no carousel any more). Bonus/Super/Feast confirm on a paper slip; Ante arms straight away.
	import { stateModal } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import type { Controls } from './controls.svelte';
	import { BONUS_CARDS, type BonusCardSpec } from './bonusCards';
	import ModalShell from './ModalShell.svelte';
	import BetAdjuster from './BetAdjuster.svelte';
	import BonusBuyCard from './BonusBuyCard.svelte';
	import Icon from './Icon.svelte';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { controls, master, scale, left, top, compact = false }: Props = $props();

	const open = $derived(stateModal.modal?.name === 'buyBonus');
	const close = () => (stateModal.modal = null);

	// The confirm slip shows on EVERY buy: the old "don't show this again" checkbox (persisted in
	// localStorage) let a player permanently defeat the price confirmation on a 100×–2000× purchase
	// (Stake review 2026-09-02; removed on Corey's call).
	let confirmTarget = $state<{ opt: BonusCardSpec; price: number } | null>(null);

	const onbuy = (opt: BonusCardSpec, price: number) => {
		controls.sound('soundPressMinor'); // every ticket's ACTIVATE (Corey 2026-09-02)
		if (opt.toggle) {
			controls.activateMode(opt.mode);
			return;
		}
		confirmTarget = { opt, price };
	};
	const confirmYes = () => {
		if (!confirmTarget) return;
		const mode = confirmTarget.opt.mode;
		confirmTarget = null;
		controls.buyMode(mode);
	};

	$effect(() => {
		if (!open) confirmTarget = null;
	});
</script>

<ModalShell {open} onclose={close} {master} {scale} {left} {top}>
	{#if compact}
		<div class="mobile" onclick={(e) => e.stopPropagation()} role="presentation">
			<div class="m-head">
				<span class="m-title">CHOW LINE</span>
				<button class="slot-btn x" onclick={(e) => (e.stopPropagation(), close())} style:width="40px" style:height="40px" aria-label="Close">
					<Icon name="close" s={16} />
				</button>
			</div>
			<div class="grid">
				{#each BONUS_CARDS as opt (opt.mode)}
					<BonusBuyCard {opt} compact {onbuy} />
				{/each}
			</div>
			<BetAdjuster {controls} compact />
		</div>
	{:else}
		<button class="slot-btn x x-desk" onclick={(e) => (e.stopPropagation(), close())} aria-label="Close">
			<Icon name="close" s={20} />
		</button>
		<div class="desktop" onclick={(e) => e.stopPropagation()} role="presentation">
			<div class="title"><span class="rule l"></span>CHOW LINE — PICK YOUR PLATE<span class="rule r"></span></div>
			<div class="row">
				{#each BONUS_CARDS as opt (opt.mode)}
					<BonusBuyCard {opt} {onbuy} />
				{/each}
			</div>
			<BetAdjuster {controls} />
		</div>
	{/if}
</ModalShell>

<!-- Confirm slip rides its OWN ModalShell: the dim backdrop must cover the full physical viewport
     (position:fixed outside the scaled frame), not just the master rect — a backdrop inside the
     frame leaves bright uncovered strips at the real screen edges. -->
{#if confirmTarget}
	{@const opt = confirmTarget.opt}
	<ModalShell open={true} onclose={() => (confirmTarget = null)} {master} {scale} {left} {top} dim="rgba(0,0,0,0.62)" zIndex={3}>
		<div class="confirm-center" style:padding={compact ? '20px' : '0'}>
			<div class="slip" class:compact onclick={(e) => e.stopPropagation()} role="presentation">
				<div class="s-upper">
					<div class="grain"></div>
					<div class="s-plate" style:background={opt.accent}>{opt.label}</div>
					<div class="s-msg">
						ACTIVATE loads {opt.label} onto the Spin button at <span class="s-price">{numberToCurrencyString(confirmTarget.price)}</span> per play.
						It only applies when you press Spin, and stays loaded until you switch it off.
					</div>
				</div>
				<div class="s-stub">
					<div class="grain"></div>
					<div class="s-tear"></div>
					<button class="slot-btn s-cancel" onclick={() => (confirmTarget = null)}>CANCEL</button>
					<button class="slot-btn s-ok" onclick={confirmYes} style:background="linear-gradient(180deg, {opt.accent}, {opt.accentDark})">OKAY</button>
				</div>
			</div>
		</div>
	</ModalShell>
{/if}

<style>
	.x {
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.55);
		border: 2px solid rgba(255, 255, 255, 0.25);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.x-desk {
		position: absolute;
		top: 22px;
		right: 26px;
		width: 44px;
		height: 44px;
		z-index: 2;
	}

	/* ── landscape / phone-sideways: title, ticket row, stepper ── */
	.desktop {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 34px;
		padding: 30px 60px;
		pointer-events: auto;
	}
	.title {
		display: flex;
		align-items: center;
		gap: 18px;
		font: 400 22px/1 'Black Ops One', 'Outfit', system-ui, sans-serif;
		letter-spacing: 6px;
		color: #e6dcc3;
		text-shadow: 0 2px 0 #000;
		white-space: nowrap;
	}
	.rule {
		width: 90px;
		height: 2px;
	}
	.rule.l {
		background: linear-gradient(90deg, transparent, #e6dcc3);
	}
	.rule.r {
		background: linear-gradient(90deg, #e6dcc3, transparent);
	}
	.row {
		display: flex;
		gap: 26px;
		align-items: flex-end;
	}

	/* ── portrait: title row, 2×2 grid, stepper ── */
	.mobile {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		padding: 30px 16px 18px;
		gap: 14px;
		pointer-events: auto;
	}
	.m-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.m-title {
		font: 400 16px/1 'Black Ops One', 'Outfit', system-ui, sans-serif;
		letter-spacing: 3px;
		color: #e6dcc3;
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-auto-rows: 1fr;
		gap: 14px;
		flex: 1;
		align-content: center;
		min-height: 0;
	}
	.mobile :global(.adj) {
		width: 100%;
		justify-content: space-between;
		border: 2px solid rgba(255, 255, 255, 0.18);
	}

	/* ── confirm slip ── */
	.confirm-center {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.slip {
		--r: 16px;
		pointer-events: auto;
		width: 520px;
		max-width: 100%;
		transform: rotate(-1deg);
		filter: drop-shadow(0 30px 30px rgba(0, 0, 0, 0.8));
		display: flex;
		flex-direction: column;
	}
	.s-upper,
	.s-stub {
		position: relative;
		box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.08);
	}
	.s-upper {
		background: linear-gradient(180deg, #ebe3cf, #d9cfb4);
		border-radius: var(--r) var(--r) 0 0;
		-webkit-mask-image: radial-gradient(circle at -3px 100%, transparent 11px, #000 12px), radial-gradient(circle at calc(100% + 3px) 100%, transparent 11px, #000 12px);
		mask-image: radial-gradient(circle at -3px 100%, transparent 11px, #000 12px), radial-gradient(circle at calc(100% + 3px) 100%, transparent 11px, #000 12px);
		-webkit-mask-composite: source-in;
		mask-composite: intersect;
	}
	.s-stub {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		padding: 18px 20px 20px;
		background: #d3c9ae;
		border-radius: 0 0 var(--r) var(--r);
		-webkit-mask-image: radial-gradient(circle at -3px 0, transparent 11px, #000 12px), radial-gradient(circle at calc(100% + 3px) 0, transparent 11px, #000 12px);
		mask-image: radial-gradient(circle at -3px 0, transparent 11px, #000 12px), radial-gradient(circle at calc(100% + 3px) 0, transparent 11px, #000 12px);
		-webkit-mask-composite: source-in;
		mask-composite: intersect;
	}
	.grain {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.035) 0 1px, transparent 1px 3px);
		pointer-events: none;
	}
	.s-plate {
		margin: 18px -4px 0;
		color: #1b1204;
		text-align: center;
		font: 400 34px/1 'Lilita One', 'Outfit', system-ui, sans-serif;
		letter-spacing: 3px;
		padding: 12px 0 10px;
		text-shadow: 0 2px 0 rgba(255, 255, 255, 0.35);
		border-top: 3px dashed rgba(0, 0, 0, 0.25);
		border-bottom: 3px dashed rgba(0, 0, 0, 0.25);
		position: relative;
	}
	.s-msg {
		padding: 20px 34px 8px;
		text-align: center;
		color: #2a241a;
		font-size: 15px;
		font-weight: 600;
		line-height: 1.45;
		text-wrap: pretty;
		position: relative;
	}
	.s-price {
		font-family: var(--ui-font-num);
		font-weight: 800;
		color: #1b1204;
	}
	.s-tear {
		position: absolute;
		left: 12px;
		right: 12px;
		top: -1.5px;
		border-top: 3px dashed #a99c7d;
	}
	.s-cancel,
	.s-ok {
		position: relative;
		text-align: center;
		font: 400 22px/1 'Lilita One', 'Outfit', system-ui, sans-serif;
		letter-spacing: 3px;
		padding: 14px 0;
		border-radius: 10px;
	}
	.s-cancel {
		background: #2a241a;
		color: #ebe3cf;
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.5);
	}
	.s-ok {
		color: #1b1204;
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.45);
	}
	.slip.compact {
		--r: 14px;
		width: 100%;
		filter: drop-shadow(0 24px 25px rgba(0, 0, 0, 0.8));
	}
	.slip.compact .s-upper,
	.slip.compact .s-stub {
		-webkit-mask-image: none;
		mask-image: none;
	}
	.slip.compact .s-plate {
		margin: 14px 0 0;
		font-size: 26px;
		letter-spacing: 2px;
		padding: 10px 0 8px;
		border-width: 2px;
	}
	.slip.compact .s-msg {
		padding: 16px 20px 6px;
		font-size: 13px;
	}
	.slip.compact .s-tear {
		left: 10px;
		right: 10px;
		top: -1px;
		border-top-width: 2px;
	}
	.slip.compact .s-stub {
		gap: 10px;
		padding: 14px;
	}
	.slip.compact .s-cancel,
	.slip.compact .s-ok {
		font-size: 17px;
		letter-spacing: 2px;
		padding: 13px 0;
		border-radius: 8px;
		box-shadow: 0 3px 0 rgba(0, 0, 0, 0.45);
	}
</style>
