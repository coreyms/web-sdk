<script lang="ts">
	// Bonus-buy modal — "CHOW LINE" on black glass (Corey's pick, 2026-09-09; was the meal-ticket
	// row from Claude Design "Meal Tickets 1a"): one glass panel with a small CHOW LINE head, the
	// four cards in a row (landscape + phone-sideways) or a 2×2 grid (portrait), and the bet
	// stepper under the panel. No headline, no header art. Bonus/Super/Mystery confirm on a glass
	// slip; Ante arms straight away. A card whose mode is already armed shows ON with the way off.
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
	// localStorage) let a player permanently defeat the price confirmation on a 100×–300× purchase
	// (Stake review 2026-09-02; removed on Corey's call).
	let confirmTarget = $state<{ opt: BonusCardSpec; price: number } | null>(null);

	const onbuy = (opt: BonusCardSpec, price: number) => {
		controls.sound('soundPressMinor'); // every card's ACTIVATE (Corey 2026-09-02)
		if (opt.toggle) {
			controls.activateMode(opt.mode);
			return;
		}
		confirmTarget = { opt, price };
	};
	// the armed card's SWITCH OFF / UNLOAD: the same disarm as the HUD's feature button
	const onoff = () => {
		controls.sound('soundPressMinor');
		controls.cancelArmed();
		close();
	};
	const isActive = (opt: BonusCardSpec) => (opt.toggle ? controls.anteActive() : controls.armedBuy() === opt.mode);
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

<ModalShell {open} onclose={close} {master} {scale} {left} {top} dim="rgba(6,4,10,0.62)">
	<div class="center" style:gap="{compact ? 10 : 14}px">
		<div class="panel am-glass" class:compact onclick={(e) => e.stopPropagation()} role="presentation">
			<div class="head">
				<span class="title">CHOW LINE</span>
				<button class="slot-btn x" onclick={() => (controls.sound('soundPressSub'), close())} aria-label="Close"><Icon name="close" s={16} /></button>
			</div>
			<div class="cards">
				{#each BONUS_CARDS as opt (opt.mode)}
					<BonusBuyCard {opt} {compact} active={isActive(opt)} {onbuy} {onoff} />
				{/each}
			</div>
		</div>
		<div class="stepper" onclick={(e) => e.stopPropagation()} role="presentation">
			<BetAdjuster {controls} {compact} />
		</div>
	</div>
</ModalShell>

<!-- Confirm slip rides its OWN ModalShell: the dim backdrop must cover the full physical viewport
     (position:fixed outside the scaled frame), not just the master rect — a backdrop inside the
     frame leaves bright uncovered strips at the real screen edges. -->
{#if confirmTarget}
	{@const opt = confirmTarget.opt}
	<ModalShell open={true} onclose={() => (confirmTarget = null)} {master} {scale} {left} {top} dim="rgba(0,0,0,0.5)" zIndex={3}>
		<div class="confirm-center" style:padding={compact ? '16px' : '0'}>
			<div class="slip am-glass" class:compact onclick={(e) => e.stopPropagation()} role="presentation" style:--m={opt.accent}>
				<span class="s-pill">{opt.label}</span>
				<p class="s-msg">
					ACTIVATE loads {opt.label} onto the Spin button at <span class="slot-num s-price">{numberToCurrencyString(confirmTarget.price)}</span> per play.
					It only applies when you press Spin, and stays loaded until you switch it off.
				</p>
				<div class="s-btns">
					<button class="slot-btn s-cancel" onclick={() => (confirmTarget = null)}>CANCEL</button>
					<button class="slot-btn s-ok" onclick={confirmYes}>OKAY</button>
				</div>
			</div>
		</div>
	</ModalShell>
{/if}

<style>
	.center {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.stepper {
		pointer-events: auto;
	}

	/* ── the glass panel (surface from .am-glass) ── */
	.panel {
		width: 1100px;
		max-width: 96%;
		box-sizing: border-box;
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 14px 18px 18px;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.title {
		font-size: 18px;
		font-weight: 900;
		letter-spacing: 3.5px;
		color: var(--ui-ink);
	}
	.x {
		width: 34px;
		height: 34px;
		border-radius: 9px;
		background: var(--ui-glass-well);
		color: var(--ui-ink);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.x:hover {
		background: var(--ui-glass-well-2);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px;
		align-items: stretch;
	}

	/* ── portrait: 2×2 in a 380 panel ── */
	.compact {
		width: 380px;
		padding: 12px 12px 12px;
		gap: 10px;
	}
	.compact .cards {
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.compact .x {
		width: 40px;
		height: 40px;
	}

	/* ── confirm slip on glass ── */
	.confirm-center {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.slip {
		pointer-events: auto;
		width: 400px;
		max-width: 100%;
		box-sizing: border-box;
		padding: 18px 18px 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: center;
		text-align: center;
	}
	.s-pill {
		font-size: 15px;
		font-weight: 900;
		letter-spacing: 3px;
		line-height: 1;
		padding: 9px 18px;
		border-radius: 999px;
		background: var(--m);
		color: var(--ui-gold-ink);
	}
	.s-msg {
		margin: 0;
		font-size: 13.5px;
		line-height: 1.5;
		color: var(--ui-ink-2);
		text-wrap: pretty;
	}
	.s-price {
		font-weight: 700;
		color: var(--ui-ink);
	}
	.s-btns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		width: 100%;
	}
	.s-cancel,
	.s-ok {
		border-radius: 10px;
		padding: 14px;
		font-size: 13px;
		font-weight: 900;
		letter-spacing: 2.5px;
	}
	.s-cancel {
		background: var(--ui-glass-well-2);
		color: var(--ui-ink);
	}
	.s-ok {
		background: var(--m);
		color: var(--ui-gold-ink);
		box-shadow: 0 3px 0 rgba(0, 0, 0, 0.45);
	}
	.s-ok:active {
		transform: translateY(2px);
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
	}
	.slip.compact {
		width: 100%;
		padding: 16px 14px 14px;
	}
	.slip.compact .s-msg {
		font-size: 13px;
	}
</style>
