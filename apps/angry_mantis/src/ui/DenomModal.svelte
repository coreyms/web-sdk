<script lang="ts">
	// Bet-amount picker, on the same cream "Meal Ticket" paper card as the Chow Line / Autoplay /
	// Replay modals: a PRICE LIST of tear-off price tags. The ladder is 32 levels ($0.01 … $100,
	// ×10,000 on a GC account), so every option has to be reachable without scrolling on desktop AND
	// on a phone in either orientation.
	import { stateBet, stateBetDerived, stateModal } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { layoutKind, type LayoutKind } from '../game/layoutSpec';
	import { abbrevCurrency } from '../game/modeChipData';
	import { soc } from '../game/social';
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
	// `cardW` caps the paper card: landscape 740 keeps it inside the reel frame instead of spanning
	// the whole master, phone matches the frame's 800; portrait (null) is full width minus the margin.
	const GRID: Record<LayoutKind, { cols: number; h: number; font: number; gap: number; maxH: number; cardW: number | null }> = {
		landscape: { cols: 8, h: 52, font: 17, gap: 6, maxH: 0.64, cardW: 740 },
		// phone: 1180 is the narrowest card that still renders the widest price ("$100.00", or an
		// abbreviated GC amount) at ~28 master px — 8 columns inside the 800 frame width left the
		// long labels shrunk to ~16 master px, which is ~8 CSS px on a 844×390 phone.
		phone: { cols: 8, h: 100, font: 28, gap: 6, maxH: 0.66, cardW: 1180 },
		portrait: { cols: 4, h: 56, font: 14, gap: 6, maxH: 0.66, cardW: null },
	};
	const context = getContext();
	const g = $derived(GRID[layoutKind(context.stateLayoutDerived.layoutType())]);

	// Card + paper geometry, mirroring the CSS below so the label fit measures the REAL usable width
	// inside one price tag: card width minus the panel padding, the dashed block (border + padding),
	// the grid's scrollbar gutter and the column gaps, split by the columns, minus the tag's own
	// border and side padding.
	const CARD_PAD = 14; // .panel horizontal padding
	const GUTTER = 4; // .grid padding-right (scrollbar gutter)
	const TAG = 4 + 2; // .opt padding-inline + border, per side
	const cardWidth = $derived(g.cardW === null ? master.width - 20 : Math.min(master.width, g.cardW));
	const block = $derived((compact ? 2 : 3) + 6); // .block border + padding, per side
	const cellWidth = $derived((cardWidth - 2 * CARD_PAD - 2 * block - GUTTER - g.gap * (g.cols - 1)) / g.cols - 2 * TAG);
	const CHAR_W = 0.58; // estimate fallback when canvas is unavailable (SSR/test)
	// A denomination must never spill or ellipsis its button, and a GC ladder tops out at
	// "GC 1,000,000" against a ~75px portrait cell. Exact label wherever it fits; otherwise the same
	// K/M/B abbreviation the mode plaque uses (threshold 0 = abbreviate as soon as it can), and the
	// font still shrinks to fit whatever comes back — no ellipsis on a number the player must read.
	// Width comes from a REAL canvas measure of the .opt span face (Sora 800 + 0.5px tracking): the
	// per-glyph estimate ran ~4% narrow and CSS-ellipsized "GC 1,000,000" (live-caught 2026-08-31).
	// Digits are normalised to '0' first: the span renders with .slot-num's font-variant-numeric:
	// tabular-nums (every digit on the widest advance) but canvas measureText has no way to ask for
	// that face, so a proportional "1" measured ~9px narrow per glyph and every price containing a 1
	// ellipsized on the phone grid (live-caught 2026-09-03). '0' is a safe upper bound on the
	// tabular advance, so the fit stays conservative.
	let measurer: CanvasRenderingContext2D | null = null;
	const textW = (text: string, font: number) => {
		measurer ??= typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
		if (!measurer) return text.length * CHAR_W * font;
		measurer.font = `800 ${font}px Sora, ui-sans-serif, sans-serif`;
		return measurer.measureText(text.replace(/\d/g, '0')).width + 0.5 * text.length; // + letter-spacing
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
	<div class="center" style:padding={compact ? '10px' : '0'}>
		<div class="panel" class:compact onclick={(e) => e.stopPropagation()} role="presentation" style:width="{cardWidth}px">
			<div class="grain"></div>
			<div class="head">
				<div class="title">PRICE LIST</div>
				<div class="pill">{soc('PER SPIN', 'PER PLAY')}</div>
				<button class="slot-btn x" onclick={(e) => (e.stopPropagation(), close())} aria-label="Close">
					<Icon name="close" s={compact ? 14 : 16} />
				</button>
			</div>

			<div class="block">
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

			<div class="cap">{soc('Amount per spin. Feature prices are multiples of this.', 'Amount per play. Feature prices are multiples of this.')}</div>
		</div>
	</div>
</ModalShell>

<style>
	.center {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	/* ── the paper card (same stock as ReplayModal / AutoplayModal / BonusBuyModal) ── */
	.panel {
		--ink: #1b1204;
		--body: #2a241a;
		--muted: #6b6250;
		--faint: #8a8069;
		--rule: #a99c7d;
		--green: #4e7d15;
		max-width: 100%;
		pointer-events: auto;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px 14px 14px;
		color: var(--body);
		background: linear-gradient(180deg, #ebe3cf, #d9cfb4);
		border-radius: 18px;
		box-shadow: 0 30px 70px rgba(0, 0, 0, 0.7), inset 0 0 0 2px rgba(0, 0, 0, 0.08);
	}
	.grain {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.035) 0 1px, transparent 1px 3px);
		pointer-events: none;
	}
	.panel > :not(.grain) {
		position: relative;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 4px;
	}
	.title {
		flex: 1;
		font-size: 22px;
		font-weight: 900;
		letter-spacing: 4px;
		color: var(--ink);
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
	}
	.pill {
		border-radius: 999px;
		padding: 6px 14px;
		background: var(--body);
		color: #f2c14e;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 2px;
		white-space: nowrap;
	}
	.x {
		flex: none;
		width: 34px;
		height: 34px;
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.05);
		box-shadow: inset 0 0 0 2px var(--rule);
		color: var(--body);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.x:hover {
		background: rgba(0, 0, 0, 0.12);
	}
	.block {
		border: 3px dashed var(--rule);
		border-radius: 12px;
		padding: 6px;
	}

	/* ── the price tags ── */
	.grid {
		display: grid;
		overflow-y: auto;
		padding-right: 4px;
	}
	.opt {
		min-width: 0;
		padding: 0 4px;
		border: 2px solid var(--rule);
		border-radius: 8px;
		background: linear-gradient(180deg, #f6f0dd, #e6dcc2);
		box-shadow: 0 2px 0 rgba(0, 0, 0, 0.16);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.1s ease, box-shadow 0.1s ease;
	}
	.opt span {
		font-weight: 800;
		letter-spacing: 0.5px;
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.opt:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.22);
	}
	.opt:active:not(:disabled) {
		transform: translateY(1px);
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.16);
	}
	.opt:disabled {
		opacity: 0.45;
		cursor: not-allowed;
		background: rgba(0, 0, 0, 0.03);
		box-shadow: none;
	}
	.opt:disabled span {
		text-decoration: line-through;
		color: var(--muted);
	}
	.opt.selected {
		border-color: var(--green);
		background: linear-gradient(180deg, #9be04a, #6fb52a);
		box-shadow: 0 5px 0 rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.45);
	}
	.opt.selected:hover {
		box-shadow: 0 7px 0 rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.45);
	}
	.opt.selected span {
		color: var(--ink);
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
	}
	.cap {
		text-align: center;
		font-size: 11.5px;
		font-weight: 500;
		color: var(--faint);
	}

	/* ── compact (phone sideways / portrait) ── */
	.compact {
		gap: 9px;
		padding: 12px 14px 10px;
		border-radius: 14px;
	}
	.compact .title {
		font-size: 17px;
		letter-spacing: 2px;
	}
	.compact .pill {
		padding: 5px 10px;
		font-size: 9px;
		letter-spacing: 1px;
	}
	.compact .x {
		width: 28px;
		height: 28px;
		border-radius: 8px;
	}
	.compact .block {
		border-width: 2px;
		border-radius: 9px;
	}
	.compact .cap {
		font-size: 10px;
	}
</style>
