<script lang="ts">
	// Bet-amount picker: grid of the RGS bet options, sized for large social-currency values.
	// The ladder is 32 levels ($0.01 … $100, ×10,000 on a GC account), so every option has to be
	// reachable without scrolling on desktop AND on a phone in either orientation.
	import { stateBet, stateBetDerived, stateModal } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { layoutKind, type LayoutKind } from '../game/layoutSpec';
	import { abbrevCurrency } from '../game/modeChipData';
	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import Icon from './Icon.svelte';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { controls, master, scale, left, top, compact = false }: Props = $props();

	const open = $derived(stateModal.modal?.name === 'betAmountMenu');
	const close = () => (stateModal.modal = null);
	// state-shared's correctBetAmount clamps any pick to balance ÷ costMultiplier ('activate' modes
	// only, mirroring its betCostMultiplier) — an unaffordable option would silently land on an
	// off-menu amount that the next spin posts and the RGS rejects into a reload-only error. Grey
	// those options out instead of letting the clamp corrupt the bet level. BetAdjuster's stepper
	// applies the same guard.
	const clampMultiplier = $derived.by(() => {
		const mode = stateBetDerived.activeBetMode();
		return mode?.type === 'activate' ? (mode.costMultiplier ?? 1) : 1;
	});
	const affordable = (v: number) => v <= stateBet.balanceAmount / clampMultiplier;
	const select = (v: number) => {
		if (!affordable(v)) return;
		controls.setBet(v);
		close();
	};

	// Grid geometry per LayoutKind, in master units — 'compact' alone can't serve both phone masters:
	// portrait is 412 wide (4 across) while phone-sideways is 1480 (8 across, all 32 on screen at once).
	// `h` is a TOUCH TARGET: the modal frame scales with the rest of the chrome, so the CSS size is
	// h × the layout's worst scale — phone-sideways scales hardest (667×375 → 0.451, so 100px ≈ 45 CSS
	// px), portrait ≈0.878 (56px ≈ 49 CSS px). Both stay over the 44px house minimum. maxH is a
	// fraction of the master height, chosen so the full ladder fits without scrolling in every layout.
	const GRID: Record<LayoutKind, { cols: number; h: number; font: number; gap: number; maxH: number }> = {
		landscape: { cols: 6, h: 62, font: 18, gap: 10, maxH: 0.64 },
		phone: { cols: 8, h: 100, font: 28, gap: 10, maxH: 0.66 },
		portrait: { cols: 4, h: 56, font: 14, gap: 6, maxH: 0.66 },
	};
	const context = getContext();
	const g = $derived(GRID[layoutKind(context.stateLayoutDerived.layoutType())]);

	// Usable width inside one option, in master units: panel minus its padding, the grid's scrollbar
	// gutter and the column gaps, split by the columns, minus the button's own side padding.
	const panelWidth = $derived(compact ? master.width : Math.min(master.width, 980));
	const cellWidth = $derived((panelWidth - (compact ? 28 : 56) - 4 - g.gap * (g.cols - 1)) / g.cols - 16);
	const CHAR_W = 0.58; // estimate fallback when canvas is unavailable (SSR/test)
	// A denomination must never spill or ellipsis its button, and a GC ladder tops out at
	// "GC 1,000,000" against a ~75px portrait cell. Exact label wherever it fits; otherwise the same
	// K/M/B abbreviation the mode plaque uses (threshold 0 = abbreviate as soon as it can), and the
	// font still shrinks to fit whatever comes back — no ellipsis on a number the player must read.
	// Width comes from a REAL canvas measure of the .opt span face (Sora 800 + 0.5px tracking): the
	// per-glyph estimate ran ~4% narrow and CSS-ellipsized "GC 1,000,000" (live-caught 2026-08-31).
	let measurer: CanvasRenderingContext2D | null = null;
	const textW = (text: string, font: number) => {
		measurer ??= typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
		if (!measurer) return text.length * CHAR_W * font;
		measurer.font = `800 ${font}px Sora, ui-sans-serif, sans-serif`;
		return measurer.measureText(text).width + 0.5 * text.length; // + letter-spacing
	};
	const label = (v: number) => {
		const full = numberToCurrencyString(v);
		return textW(full, g.font) <= cellWidth ? full : abbrevCurrency(v, 0);
	};
	const labelFont = (text: string) => {
		const atNominal = textW(text, g.font);
		return atNominal <= cellWidth ? g.font : Math.max(9, Math.floor(g.font * (cellWidth / atNominal)));
	};
</script>

<ModalShell {open} onclose={close} {master} {scale} {left} {top} zIndex={3}>
	<button class="slot-btn x" onclick={(e) => (e.stopPropagation(), close())} style:top="{compact ? 14 : 22}px" style:right="{compact ? 14 : 24}px" style:width="{compact ? 38 : 46}px" style:height="{compact ? 38 : 46}px" aria-label="Close">
		<Icon name="close" s={compact ? 16 : 20} />
	</button>
	<div class="center">
		<div class="panel" onclick={(e) => e.stopPropagation()} role="presentation" style:padding={compact ? '24px 14px' : '32px 28px'} style:max-width={compact ? '100%' : '980px'}>
			<div class="title" style:font-size="{compact ? 12 : 13}px" style:margin-bottom="{compact ? 14 : 20}px">SELECT SPIN DENOMINATION</div>
			<div class="grid" style:grid-template-columns="repeat({g.cols}, minmax(0, 1fr))" style:gap="{g.gap}px" style:max-height="{g.maxH * master.height}px">
				{#each controls.betOptions() as v (v)}
					{@const selected = v === stateBet.betAmount}
					{@const ok = affordable(v)}
					{@const text = label(v)}
					<button class="slot-btn opt" class:selected disabled={!ok} onclick={() => select(v)} style:height="{g.h}px">
						<span class="slot-num" style:font-size="{labelFont(text)}px">{text}</span>
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
	.opt:disabled {
		background: rgba(255, 255, 255, 0.03);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
	}
	.opt:disabled span {
		color: rgba(255, 255, 255, 0.3);
		text-shadow: none;
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
