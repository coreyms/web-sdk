<script lang="ts">
	// One meal ticket (Corey's Claude Design "Meal Tickets 1a", 2026-09-02): paper card with the art
	// breaking out of the top, a dashed name plate in the mode's accent, the pitch, the hunger meter,
	// then a perforated tear to the price stub + CTA. `compact` = the portrait 2×2 grid sizing.
	import { stateBet } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import { HUNGER_LEAF, type BonusCardSpec } from './bonusCards';
	import { betModeMeta } from '../game/betModeMeta';

	type Props = { opt: BonusCardSpec; compact?: boolean; onbuy: (opt: BonusCardSpec, price: number) => void };
	const { opt, compact = false, onbuy }: Props = $props();

	const multiplier = $derived(betModeMeta[opt.mode].costMultiplier);
	const price = $derived(stateBet.betAmount * multiplier);
	const canAfford = $derived(stateBet.balanceAmount >= price);
	// every card shows what a play costs, ante included (its 2x price, not a "+" surcharge)
	const costText = $derived(numberToCurrencyString(price));
	const pips = $derived([1, 2, 3, 4].map((i) => (i <= opt.hunger ? HUNGER_LEAF : 'rgba(0,0,0,.12)')));
	// The price is one line at a fixed display size, and "GC 2,000,000,000" (Gold Coins at a
	// 1,000,000 bet) is wider than the stub — it ran off the phone-sideways ticket (Corey
	// 2026-09-02). Measure the glyph run against the stub's content box and scale it down only
	// when it would overflow; every currency and bet level then fits without touching the layout.
	let stubW = $state(0);
	let priceW = $state(0);
	const priceFit = $derived(stubW > 0 && priceW > 0 ? Math.min(1, stubW / priceW) : 1);
	const ctaBg = $derived(
		canAfford ? `linear-gradient(180deg, ${opt.accent}, ${opt.accentDark})` : 'linear-gradient(180deg, #8f8977, #6b6659)',
	);
</script>

<div class="ticket" class:compact style:transform={compact ? 'none' : `rotate(${opt.tilt}deg)`}>
	<!-- art slot: sits above the paper, bottom-aligned, breaks out of the top edge -->
	<div class="art" style:filter={opt.artShadow}>
		{#if opt.artB}
			<img class="art-b" src={opt.artB} alt="" draggable="false" />
		{/if}
		<img class="art-a" src={opt.art} alt="" draggable="false" style:transform="translateX({compact ? opt.shift * 0.55 : opt.shift}px)" />
	</div>
	<div class="paper">
		<div class="upper">
			<div class="grain"></div>
			<div class="spacer"></div>
			<div class="plate" style:background={opt.accent}>{opt.label}</div>
			<div class="pitch">{opt.pitch}</div>
			<div class="hunger">
				{#if !compact}<span class="hunger-lbl">HUNGER</span>{/if}
				<span class="pips">
					{#each pips as fill, i (i)}
						<span class="pip" style:background={fill}></span>
					{/each}
				</span>
			</div>
		</div>
		<div class="stub">
			<div class="grain"></div>
			<div class="tear"></div>
			<div class="price-row" bind:clientWidth={stubW}>
				<span class="price" bind:clientWidth={priceW} style:transform="scale({priceFit})">{costText}</span>
			</div>
			<button class="slot-btn cta" disabled={!canAfford} onclick={() => onbuy(opt, price)} style:background={ctaBg}>{opt.cta}</button>
		</div>
	</div>
</div>

<style>
	.ticket {
		--r: 14px;
		--ink: #1b1204;
		position: relative;
		width: 262px;
		padding-top: 72px;
		flex: none;
		display: flex;
		flex-direction: column;
	}
	.art {
		position: absolute;
		left: 50%;
		top: 0;
		width: 210px;
		height: 150px;
		transform: translateX(-50%);
		z-index: 2;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		pointer-events: none;
	}
	.art-a {
		position: relative;
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		border-radius: var(--r);
	}
	.art-b {
		position: absolute;
		left: 8px;
		bottom: -6px;
		width: 120px;
		height: 120px;
		object-fit: contain;
		transform: rotate(-8deg);
	}
	/* the paper is two halves so the perforation can punch REAL holes (a mask on each half); the
	   drop shadow rides the wrapper's filter, so it follows the notches instead of filling them */
	.paper {
		flex: 1;
		display: flex;
		flex-direction: column;
		filter: drop-shadow(0 20px 20px rgba(0, 0, 0, 0.6));
	}
	.upper,
	.stub {
		position: relative;
		box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.08);
	}
	.upper {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: linear-gradient(180deg, #ebe3cf, #d9cfb4);
		border-radius: var(--r) var(--r) 0 0;
		-webkit-mask-image: radial-gradient(circle at -3px 100%, transparent 11px, #000 12px), radial-gradient(circle at calc(100% + 3px) 100%, transparent 11px, #000 12px);
		mask-image: radial-gradient(circle at -3px 100%, transparent 11px, #000 12px), radial-gradient(circle at calc(100% + 3px) 100%, transparent 11px, #000 12px);
		-webkit-mask-composite: source-in;
		mask-composite: intersect;
	}
	.stub {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px 18px 18px;
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
	.spacer {
		height: 82px;
	}
	.plate {
		margin: 0 -4px;
		color: var(--ink);
		text-align: center;
		font: 400 38px/1 'Lilita One', 'Outfit', system-ui, sans-serif;
		letter-spacing: 2px;
		padding: 12px 0 10px;
		text-shadow: 0 2px 0 rgba(255, 255, 255, 0.35);
		border-top: 3px dashed rgba(0, 0, 0, 0.25);
		border-bottom: 3px dashed rgba(0, 0, 0, 0.25);
		position: relative;
	}
	.pitch {
		flex: 1;
		padding: 14px 20px 12px;
		text-align: center;
		color: #2a241a;
		font-size: 13.5px;
		font-weight: 600;
		line-height: 1.35;
		letter-spacing: 0.2px;
		text-wrap: pretty;
		position: relative;
	}
	.hunger {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 0 0 14px;
		position: relative;
	}
	.hunger-lbl {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 3px;
		color: #6b6250;
	}
	.pips {
		display: flex;
		gap: 5px;
	}
	.pip {
		width: 14px;
		height: 14px;
		border-radius: 0 100% 0 100%;
		transform: rotate(-20deg);
		box-shadow: inset 0 0 0 1.5px rgba(0, 0, 0, 0.35);
	}
	.tear {
		position: absolute;
		left: 10px;
		right: 10px;
		top: -1.5px;
		border-top: 3px dashed #a99c7d;
	}
	/* flex centring, not text-align: an inline block WIDER than the row is left-aligned by
	   text-align, so the shrink pivoted right of centre and the tail still ran off the stub.
	   Flex centres an overflowing item on the row's midpoint, and the scale pivots there too. */
	.price-row {
		display: flex;
		justify-content: center;
		position: relative;
		line-height: 1;
	}
	.price {
		display: block;
		flex: none;
		font: 400 32px/1 'Lilita One', 'Outfit', system-ui, sans-serif;
		color: var(--ink);
		white-space: nowrap;
		transform-origin: 50% 50%;
	}
	.cta {
		position: relative;
		color: var(--ink);
		text-align: center;
		font: 400 24px/1 'Lilita One', 'Outfit', system-ui, sans-serif;
		letter-spacing: 3px;
		padding: 14px 0;
		border-radius: 10px;
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.45);
	}
	.cta:disabled {
		color: rgba(27, 18, 4, 0.5);
		box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
	}

	/* ── portrait 2×2 grid ── */
	.compact {
		--r: 12px;
		width: auto;
		padding-top: 40px;
	}
	.compact .art {
		width: 130px;
		height: 84px;
	}
	.compact .art-a {
		border-radius: 10px;
	}
	.compact .art-b {
		left: 4px;
		bottom: -4px;
		width: 68px;
		height: 68px;
	}
	.compact .paper {
		filter: drop-shadow(0 12px 13px rgba(0, 0, 0, 0.6));
	}
	.compact .upper,
	.compact .stub {
		-webkit-mask-image: none;
		mask-image: none;
	}
	.compact .spacer {
		height: 46px;
	}
	.compact .plate {
		margin: 0;
		font-size: 24px;
		letter-spacing: 1px;
		padding: 8px 0 7px;
		border-width: 2px;
	}
	.compact .pitch {
		padding: 8px 10px 6px;
		font-size: 10.5px;
		line-height: 1.3;
	}
	.compact .hunger {
		padding: 0 0 8px;
	}
	.compact .pips {
		gap: 4px;
	}
	.compact .pip {
		width: 10px;
		height: 10px;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
	}
	.compact .stub {
		gap: 6px;
		padding: 8px 10px 10px;
	}
	.compact .tear {
		left: 6px;
		right: 6px;
		top: -1px;
		border-top-width: 2px;
	}
	.compact .price {
		font-size: 20px;
	}
	.compact .cta {
		font-size: 16px;
		letter-spacing: 2px;
		padding: 12px 0;
		border-radius: 8px;
		box-shadow: 0 3px 0 rgba(0, 0, 0, 0.45);
	}
</style>
