<script lang="ts">
	// Bonus-buy modal: bet adjuster + 4 cards (desktop grid / mobile swipe carousel) + confirm dialog.
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

	let confirmTarget = $state<{ opt: BonusCardSpec; price: number } | null>(null);
	let dontAsk = $state(false);
	const skipConfirm = $state<Record<string, boolean>>({});

	const onbuy = (opt: BonusCardSpec, price: number) => {
		controls.sound('soundPressGeneral');
		if (opt.toggle) {
			controls.activateMode(opt.mode);
			return;
		}
		if (skipConfirm[opt.mode]) controls.buyMode(opt.mode);
		else {
			dontAsk = false;
			confirmTarget = { opt, price };
		}
	};
	const confirmYes = () => {
		if (!confirmTarget) return;
		if (dontAsk) skipConfirm[confirmTarget.opt.mode] = true;
		const mode = confirmTarget.opt.mode;
		confirmTarget = null;
		controls.buyMode(mode);
	};

	// ── mobile carousel ──
	let idx = $state(0);
	let dragX = $state(0);
	let dragging = $state(false);
	let startX = 0;
	const canPrev = $derived(idx > 0);
	const canNext = $derived(idx < BONUS_CARDS.length - 1);
	const go = (d: number) => {
		idx = Math.max(0, Math.min(BONUS_CARDS.length - 1, idx + d));
		dragX = 0;
	};
	const onDown = (e: PointerEvent) => {
		startX = e.clientX;
		dragging = true;
	};
	const onMove = (e: PointerEvent) => {
		if (dragging) dragX = (e.clientX - startX) / scale;
	};
	const onUp = () => {
		if (!dragging) return;
		dragging = false;
		if (dragX < -40 && canNext) go(1);
		else if (dragX > 40 && canPrev) go(-1);
		else dragX = 0;
	};
	const current = $derived(BONUS_CARDS[idx]);
	$effect(() => {
		if (!open) {
			confirmTarget = null;
			idx = 0;
		}
	});
</script>

<ModalShell {open} onclose={close} {master} {scale} {left} {top}>
	<button class="slot-btn x" onclick={(e) => (e.stopPropagation(), close())} style:top="{compact ? 14 : 22}px" style:right="{compact ? 14 : 24}px" style:width="{compact ? 38 : 46}px" style:height="{compact ? 38 : 46}px" aria-label="Close">
		<Icon name="close" s={compact ? 16 : 20} />
	</button>

	<div class="center">
		{#if compact}
			<div class="mobile" onclick={(e) => e.stopPropagation()} role="presentation">
				<BetAdjuster {controls} compact />
				<div class="carousel">
					<div class="viewport" onpointerdown={onDown} onpointermove={onMove} onpointerup={onUp} onpointerleave={onUp} onpointercancel={onUp}>
						<div class="slide" style:transform="translateX({dragX}px)" style:transition={dragging ? 'none' : 'transform .25s ease'}>
							<BonusBuyCard opt={current} compact {onbuy} />
						</div>
						<button class="slot-btn arrow left" disabled={!canPrev} onclick={() => go(-1)} style:background={canPrev ? `linear-gradient(180deg, ${current.tone.accent}, ${current.tone.accent}aa)` : 'rgba(255,255,255,.06)'} style:box-shadow={canPrev ? `inset 0 1px 0 rgba(255,255,255,.4), 0 0 16px ${current.tone.accent}99` : 'inset 0 0 0 1px rgba(255,255,255,.1)'} style:color={canPrev ? '#0a0410' : 'rgba(255,255,255,.25)'} aria-label="Previous"><Icon name="chevronLeft" s={14} /></button>
						<button class="slot-btn arrow right" disabled={!canNext} onclick={() => go(1)} style:background={canNext ? `linear-gradient(180deg, ${current.tone.accent}, ${current.tone.accent}aa)` : 'rgba(255,255,255,.06)'} style:box-shadow={canNext ? `inset 0 1px 0 rgba(255,255,255,.4), 0 0 16px ${current.tone.accent}99` : 'inset 0 0 0 1px rgba(255,255,255,.1)'} style:color={canNext ? '#0a0410' : 'rgba(255,255,255,.25)'} aria-label="Next"><Icon name="chevronRight" s={14} /></button>
					</div>
					<div class="dots">
						{#each BONUS_CARDS as o, i (o.mode)}
							<button class="slot-btn dot" class:on={i === idx} style:background={i === idx ? o.tone.accent : 'rgba(255,255,255,.2)'} onclick={() => go(i - idx)} aria-label={o.label}></button>
						{/each}
					</div>
				</div>
			</div>
		{:else}
			<div class="desktop" onclick={(e) => e.stopPropagation()} role="presentation">
				<BetAdjuster {controls} />
				<div class="grid">
					{#each BONUS_CARDS as opt (opt.mode)}
						<BonusBuyCard {opt} {onbuy} />
					{/each}
				</div>
			</div>
		{/if}
	</div>

	{#if confirmTarget}
		{@const opt = confirmTarget.opt}
		<div class="confirm-bg" onclick={(e) => (e.stopPropagation(), (confirmTarget = null))} role="presentation">
			<div class="confirm" onclick={(e) => e.stopPropagation()} role="presentation" style:border="2px solid {opt.tone.accent}" style:box-shadow="0 30px 80px rgba(0,0,0,.8), 0 0 40px {opt.tone.accent}44">
				<div class="c-title">ARE YOU SURE?</div>
				<div class="c-body">
					Clicking OKAY will deduct <span class="slot-num c-price">{numberToCurrencyString(confirmTarget.price)}</span> from your balance and start
					<span style:color={opt.tone.accent} style:font-weight="800">{opt.label}</span>.
					It stays loaded on the Spin button — every press plays it again at the same price until you switch it off.
				</div>
				<label class="c-check">
					<input type="checkbox" bind:checked={dontAsk} style:accent-color={opt.tone.accent} />
					DON'T SHOW THIS AGAIN
				</label>
				<div class="c-actions">
					<button class="slot-btn c-cancel" onclick={() => (confirmTarget = null)}>CANCEL</button>
					<button class="slot-btn c-ok" onclick={confirmYes} style:background="linear-gradient(180deg, {opt.tone.accent} 0%, {opt.tone.accent}cc 100%)" style:box-shadow="inset 0 1px 0 rgba(255,255,255,.4), 0 3px 0 {opt.tone.body}, 0 6px 12px rgba(0,0,0,.5)">OKAY</button>
				</div>
			</div>
		</div>
	{/if}
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
		justify-content: center;
		pointer-events: none;
	}
	.desktop {
		padding: 0 28px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 18px;
		max-width: 1180px;
		margin: 0 auto;
		width: 100%;
		pointer-events: auto;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 18px;
		width: 100%;
	}
	.mobile {
		width: 100%;
		padding: 0 12px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		pointer-events: auto;
	}
	.carousel {
		position: relative;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.viewport {
		width: 100%;
		overflow: hidden;
		position: relative;
		padding: 4px 36px;
		touch-action: pan-y;
	}
	.arrow {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 36px;
		height: 36px;
		border-radius: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.arrow:disabled {
		opacity: 0.4;
	}
	.arrow.left {
		left: 2px;
	}
	.arrow.right {
		right: 2px;
	}
	.dots {
		display: flex;
		gap: 8px;
		margin-top: 14px;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 4px;
		transition: all 0.2s ease;
	}
	.dot.on {
		width: 22px;
	}
	.confirm-bg {
		position: absolute;
		inset: 0;
		z-index: 300;
		background: rgba(0, 0, 0, 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		animation: slot-count 0.2s ease both;
		pointer-events: auto;
	}
	.confirm {
		width: min(420px, 86%);
		background: linear-gradient(180deg, #1d0e2a 0%, #0a0414 100%);
		border-radius: 14px;
		padding: 24px 22px 20px;
	}
	.c-title {
		font-weight: 900;
		font-size: 22px;
		letter-spacing: 2px;
		color: #fff;
		text-align: center;
		margin-bottom: 6px;
	}
	.c-body {
		font-size: 13px;
		letter-spacing: 0.8px;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.8);
		text-align: center;
		margin-bottom: 18px;
	}
	.c-price {
		color: #fff;
		font-weight: 700;
	}
	.c-check {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		margin-bottom: 16px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		cursor: pointer;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.75);
		letter-spacing: 0.5px;
	}
	.c-check input {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}
	.c-actions {
		display: flex;
		gap: 10px;
	}
	.c-cancel,
	.c-ok {
		flex: 1;
		height: 46px;
		border-radius: 8px;
		font-weight: 800;
		font-size: 13px;
		letter-spacing: 2px;
	}
	.c-cancel {
		background: linear-gradient(180deg, #2c2235, #15101e);
		box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.15);
		color: #fff;
	}
	.c-ok {
		color: #0a0410;
		font-weight: 900;
	}
</style>
