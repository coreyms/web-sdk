<script lang="ts">
	// One Chow Line card on black glass (Corey's pick, 2026-09-09): a well with a hairline, the name
	// pill in the mode colour, the pitch, a four-segment volatility bar, the price in Sora with PER
	// SPIN under it, and one button in the mode colour. `active` = this mode is already armed (Ante
	// on, or a feature loaded): the card carries an ON tag, a ring in its colour, and the button
	// turns into the way off. `compact` = the portrait 2×2 grid sizing.
	import { stateBet } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import type { BonusCardSpec } from './bonusCards';
	import { betModeMeta } from '../game/betModeMeta';

	type Props = { opt: BonusCardSpec; compact?: boolean; active?: boolean; onbuy: (opt: BonusCardSpec, price: number) => void; onoff: (opt: BonusCardSpec) => void };
	const { opt, compact = false, active = false, onbuy, onoff }: Props = $props();

	const multiplier = $derived(betModeMeta[opt.mode].costMultiplier);
	const price = $derived(stateBet.betAmount * multiplier);
	const canAfford = $derived(stateBet.balanceAmount >= price);
	// every card shows what a play costs, ante included (its 3x price, not a "+" surcharge)
	const costText = $derived(numberToCurrencyString(price));
	// The price is one line at a fixed display size, and "GC 2,000,000,000" (Gold Coins at a
	// 1,000,000 bet) is wider than the card — it ran off the phone-sideways ticket (Corey
	// 2026-09-02). Measure the glyph run against the card's content box and scale it down only
	// when it would overflow; every currency and bet level then fits without touching the layout.
	let rowW = $state(0);
	let priceW = $state(0);
	const priceFit = $derived(rowW > 0 && priceW > 0 ? Math.min(1, rowW / priceW) : 1);
</script>

<div class="card" class:compact class:active style:--m={opt.accent}>
	{#if active}<span class="on-tag">ON</span>{/if}
	<span class="pill">{opt.label}</span>
	<div class="pitch">{opt.pitch}</div>
	<div class="volm">
		<span class="volm-lbl">VOLATILITY</span>
		<span class="bar">
			{#each [1, 2, 3, 4] as i (i)}
				<span class="seg" class:on={i <= opt.volatility}></span>
			{/each}
		</span>
	</div>
	<div class="price-row" bind:clientWidth={rowW}>
		<span class="slot-num price" bind:clientWidth={priceW} style:transform="scale({priceFit})">{costText}</span>
	</div>
	<span class="per">PER SPIN</span>
	{#if active}
		<button class="slot-btn cta off" onclick={() => onoff(opt)}>{opt.toggle ? 'SWITCH OFF' : 'UNLOAD'}</button>
	{:else}
		<button class="slot-btn cta" disabled={!canAfford} onclick={() => onbuy(opt, price)}>{opt.cta}</button>
	{/if}
</div>

<style>
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 14px 12px 12px;
		border: 1px solid var(--ui-rule-2);
		border-radius: 12px;
		background: var(--ui-glass-well);
		text-align: center;
		min-width: 0;
	}
	.card.active {
		border-color: var(--m);
		box-shadow: 0 0 0 1px var(--m);
	}
	.on-tag {
		position: absolute;
		top: 10px;
		right: 10px;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 1.5px;
		padding: 5px 7px;
		border-radius: 999px;
		background: var(--m);
		color: var(--ui-gold-ink);
	}
	.pill {
		font-size: 13px;
		font-weight: 900;
		letter-spacing: 2.5px;
		line-height: 1;
		padding: 7px 14px;
		border-radius: 999px;
		background: var(--m);
		color: var(--ui-gold-ink);
	}
	.pitch {
		font-size: 11.5px;
		line-height: 1.4;
		color: var(--ui-ink-2);
		min-height: 48px;
		text-wrap: pretty;
	}
	.volm {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.volm-lbl {
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 1.8px;
		color: var(--ui-ink-3);
	}
	.bar {
		display: flex;
		gap: 3px;
	}
	.seg {
		width: 14px;
		height: 6px;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.12);
	}
	.seg.on {
		background: var(--m);
	}
	/* flex centring, not text-align: an inline block WIDER than the row is left-aligned by
	   text-align, so the shrink pivoted right of centre and the tail still ran off. Flex centres an
	   overflowing item on the row's midpoint, and the scale pivots there too. */
	.price-row {
		display: flex;
		justify-content: center;
		width: 100%;
		margin-top: auto;
		line-height: 1;
	}
	.price {
		display: block;
		flex: none;
		font-size: 22px;
		font-weight: 700;
		color: var(--ui-ink);
		white-space: nowrap;
		transform-origin: 50% 50%;
	}
	.per {
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 1.5px;
		color: var(--ui-ink-3);
		margin-top: -4px;
	}
	.cta {
		width: 100%;
		border-radius: 9px;
		padding: 12px;
		font-size: 13px;
		font-weight: 900;
		letter-spacing: 2.5px;
		color: var(--ui-gold-ink);
		background: var(--m);
		box-shadow: 0 3px 0 rgba(0, 0, 0, 0.45);
	}
	.cta:active {
		transform: translateY(2px);
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
	}
	.cta:disabled {
		opacity: 0.4;
	}
	.cta.off {
		background: transparent;
		color: var(--m);
		box-shadow: inset 0 0 0 1.5px var(--m);
	}

	/* ── portrait 2×2 grid ── */
	.compact {
		padding: 12px 8px 10px;
		gap: 6px;
	}
	.compact .pill {
		font-size: 12px;
		padding: 6px 12px;
	}
	.compact .pitch {
		font-size: 10.5px;
		min-height: 56px;
	}
	.compact .price {
		font-size: 19px;
	}
	.compact .cta {
		padding: 11px;
		font-size: 12px;
	}
</style>
