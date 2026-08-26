<script lang="ts">
	import { stateBet } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import type { BonusCardSpec } from './bonusCards';
	import { betModeMeta } from '../game/betModeMeta';

	type Props = { opt: BonusCardSpec; compact?: boolean; onbuy: (opt: BonusCardSpec, price: number) => void };
	const { opt, compact = false, onbuy }: Props = $props();

	const multiplier = $derived(betModeMeta[opt.mode].costMultiplier);
	const price = $derived(stateBet.betAmount * multiplier);
	const canAfford = $derived(opt.toggle ? stateBet.balanceAmount >= price : stateBet.balanceAmount >= price);
	const sz = $derived(
		compact
			? { headerH: 105, overlap: 52, descFs: 12, detailFs: 11, detailMinH: 62, descPad: '58px 16px 14px', costFs: 15, costPad: '8px 0', ctaH: 44, ctaFs: 14 }
			: { headerH: 135, overlap: 68, descFs: 13, detailFs: 12, detailMinH: 66, descPad: '76px 18px 14px', costFs: 16, costPad: '9px 0', ctaH: 48, ctaFs: 15 },
	);
	const bodyBg = $derived(
		opt.tone.dual
			? 'linear-gradient(135deg, #19050b 0%, #100808 50%, #06170d 100%)'
			: `linear-gradient(180deg, ${opt.tone.body} 0%, #060309 100%)`,
	);
	const ctaBg = $derived(
		!canAfford
			? 'linear-gradient(180deg, #2a2a2a, #161616)'
			: opt.tone.dual
				? `linear-gradient(135deg, ${opt.tone.accent} 0%, ${opt.tone.accent2} 100%)`
				: `linear-gradient(180deg, ${opt.tone.accent} 0%, ${opt.tone.accent}cc 100%)`,
	);
	const costText = $derived(
		opt.toggle ? `+${numberToCurrencyString(price - stateBet.betAmount)} / SPIN` : numberToCurrencyString(price),
	);
</script>

<div class="card">
	<div class="header" style:height="{sz.headerH}px" style:margin-bottom="-{sz.overlap}px">
		<img src={opt.image} alt={opt.label} draggable="false" />
	</div>
	<div
		class="body"
		style:background={bodyBg}
		style:border="1.5px solid {opt.tone.accent}55"
		style:padding={sz.descPad}
		style:box-shadow={opt.tone.dual
			? `0 12px 28px rgba(0,0,0,.55), inset 0 0 30px ${opt.tone.accent}10, inset 0 0 30px ${opt.tone.accent2}10`
			: `0 12px 28px rgba(0,0,0,.55), inset 0 0 30px ${opt.tone.accent}10`}
	>
		<div class="desc" style:font-size="{sz.descFs}px">{opt.description}</div>
		<div class="detail" style:font-size="{sz.detailFs}px" style:min-height="{sz.detailMinH}px">{opt.detail}</div>
		<div class="slot-num cost" style:padding={sz.costPad} style:font-size="{sz.costFs}px" style:color={opt.tone.dual ? '#fff' : opt.tone.accent} style:border="1px solid {opt.tone.accent}33">{costText}</div>
		<button
			class="slot-btn cta"
			disabled={!canAfford}
			onclick={() => onbuy(opt, price)}
			style:height="{sz.ctaH}px"
			style:font-size="{sz.ctaFs}px"
			style:background={ctaBg}
			style:box-shadow={canAfford ? `inset 0 1px 0 rgba(255,255,255,.4), 0 3px 0 ${opt.tone.body}, 0 6px 12px rgba(0,0,0,.5)` : 'inset 0 0 0 1px rgba(255,255,255,.05)'}
			style:color={canAfford ? '#0a0410' : 'rgba(255,255,255,.35)'}
		>{opt.cta}</button>
	</div>
</div>

<style>
	.card {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		flex: 1;
		min-width: 0;
		position: relative;
	}
	.header {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.header img {
		max-height: 100%;
		max-width: 95%;
		object-fit: contain;
		filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.75));
	}
	.body {
		border-radius: 14px;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 10px;
		position: relative;
	}
	.desc {
		min-height: 36px;
		font-weight: 800;
		letter-spacing: 1.2px;
		line-height: 1.35;
		color: #fff;
		text-align: center;
		text-transform: uppercase;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
	}
	.detail {
		color: rgba(255, 255, 255, 0.78);
		line-height: 1.45;
		text-align: center;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
	}
	.cost {
		text-align: center;
		background: rgba(0, 0, 0, 0.5);
		border-radius: 8px;
		font-weight: 700;
		letter-spacing: 0.5px;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
		white-space: nowrap;
	}
	.cta {
		border-radius: 10px;
		font-weight: 900;
		letter-spacing: 2px;
	}
</style>
