<script lang="ts">
	// Bet-amount picker: a PRICE LIST of tear-off price tags. The ladder is 32 levels ($0.01 … $100,
	// ×10,000 on a GC account), so every option has to be reachable on desktop AND on a phone in
	// either orientation — and, since Stake's review (2026-09-20, FIX 4), every option shows its
	// FULL amount and currency: no K/M abbreviation, no ellipsis, no truncation, at any size.
	//
	// How that is made to hold: the widest label in the ladder is measured ONCE (game/textFit.ts)
	// and the column count is derived from it — cols = floor(usable / (widest + padding)), capped
	// at 8 — so a "GC 1,000,000" ladder simply runs fewer, wider columns instead of shrinking into
	// an abbreviation. The grid scrolls when the ladder is taller than the card.
	//
	// Geometry is in CSS px: ModalShell's frame is the viewport now (FIX 5), not the design master.
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { stateBet, stateBetDerived, stateModal } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import { measureFitText } from '../game/textFit';
	import { soc } from '../game/social';
	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import Icon from './Icon.svelte';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { controls, master, scale, left, top }: Props = $props();

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

	// ── viewport geometry (CSS px) ──
	const vw = $derived(innerWidth.current ?? 1280);
	const vh = $derived(innerHeight.current ?? 720);
	// Stake's Popout S is a 400×225 iframe: there is no room for generous padding or 44px rows
	// there, but every label still has to be legible. `tight` is the popout/phone-narrow band.
	const tiny = $derived(vh < 300 || vw < 360);
	const narrowCard = $derived(vw < 560); // Popout S and portrait phones
	const tight = $derived(tiny || narrowCard || vh < 460);
	const MARGIN = $derived(narrowCard ? 8 : 14);
	// 880 (not the old 740): the shell is the viewport now, so the card is free to use the window
	// it is centred in, and the extra width is what buys the columns back on the worst ladder.
	const CARD_MAX = 880;
	const cardWidth = $derived(Math.min(CARD_MAX, vw - 2 * MARGIN));
	// touch: 44 CSS px rows everywhere a finger can reach them; only the tiny popout drops below
	const rowH = $derived(tiny ? 30 : 44);
	const gridMaxH = $derived(vh * (tiny ? 0.52 : 0.56));
	const nominalFont = $derived(tiny ? 13 : tight ? 15 : 17);

	// Card + tag geometry, mirroring the CSS below so the fit measures the REAL usable width inside
	// one price tag: card width minus the panel padding, the well (border + padding), the grid's
	// scrollbar gutter and the column gaps, split by the columns, minus the tag's own border and
	// side padding.
	const CARD_PAD = $derived(narrowCard ? 10 : 14); // .panel horizontal padding
	const GUTTER = 4; // .grid padding-right (scrollbar gutter)
	const TAG = 4 + 1; // .opt padding-inline + border, per side
	const AIR = 4; // breathing room either side of the label inside its tag
	const GAP = 6;
	const WELL = $derived((tight ? 2 : 3) + 6); // .block border + padding, per side
	const usable = $derived(cardWidth - 2 * CARD_PAD - 2 * WELL - GUTTER);

	// Width comes from a REAL canvas measure of the .opt span face (Sora 800 + 0.5px tracking):
	// a per-glyph estimate ran ~4% narrow and CSS-ellipsized "GC 1,000,000" (live-caught
	// 2026-08-31). One measurement per ladder/size change, never per frame.
	const labels = $derived(controls.betOptions().map((v) => numberToCurrencyString(v)));
	const REF = 12; // the reference size the widest label is measured at; widths scale linearly
	const widestRef = $derived(labels.reduce((m, t) => Math.max(m, measureFitText(t, REF, 800, 0.5)), 0));

	// COLUMNS. The first cut derived them from the widest label AT THE NOMINAL FONT, which was far
	// too conservative: "GC 1,000,000" measured at 17 px booked a ~144 px column, so the desktop
	// card ran 4 near-empty columns and the player scrolled eight rows (review 2026-09-20).
	// Instead, walk the column counts and take the MOST columns whose resulting label size is still
	// comfortable — 13 px on a roomy card, 10 px where the card itself is narrow (Popout S, a
	// portrait phone), which is the same floor Game Info uses. The type then grows back up to fill
	// whatever cell that gives, capped at nominal. A short ladder ($0.01 … $100.00) still reaches
	// the 8-column cap; only a GC ladder is wide enough to cost columns.
	const COMFORT = $derived(narrowCard ? 10 : 13);
	const fontFor = (c: number) => {
		const box = (usable - GAP * (c - 1)) / c - 2 * TAG - AIR;
		if (widestRef <= 0) return nominalFont;
		return Math.min(nominalFont, (REF * box) / widestRef);
	};
	const cols = $derived.by(() => {
		let best = 1;
		for (let c = 2; c <= 8; c++) if (fontFor(c) >= COMFORT) best = c;
		return best;
	});
	// 9 px is the hard floor the review set for modal text; the comfort walk above keeps the real
	// size well over it for every ladder the RGS can send.
	const labelFont = $derived(Math.max(9, Math.floor(fontFor(cols) * 10) / 10));
</script>

<ModalShell {open} onclose={close} {master} {scale} {left} {top} zIndex={3}>
	<div class="center" style:padding="{MARGIN}px">
		<div class="panel am-glass" class:tight class:tiny onclick={(e) => e.stopPropagation()} role="presentation" style:width="{cardWidth}px">
			<div class="head">
				<div class="title am-stencil">PRICE LIST</div>
				<div class="pill">{soc('PER SPIN', 'PER PLAY')}</div>
				<button class="slot-btn x" onclick={(e) => (e.stopPropagation(), close())} aria-label="Close">
					<Icon name="close" s={tiny ? 13 : 16} />
				</button>
			</div>

			<div class="block">
				<div class="grid" style:grid-template-columns="repeat({cols}, minmax(0, 1fr))" style:gap="{GAP}px" style:max-height="{gridMaxH}px">
					{#each controls.betOptions() as v (v)}
						{@const selected = v === stateBet.betAmount}
						{@const ok = affordable(v)}
						{@const text = numberToCurrencyString(v)}
						<button class="slot-btn opt" class:selected disabled={!ok} onclick={() => select(v)} style:height="{rowH}px">
							<span class="slot-num" style:font-size="{labelFont}px">{text}</span>
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

	/* ── black glass (the same surface as the Chow Line / Autoplay; the paper card went with the
	      approval review 2026-09-15) ── */
	.panel {
		--ink: var(--ui-ink);
		--body: var(--ui-ink-2);
		--muted: var(--ui-ink-2);
		--faint: var(--ui-ink-3);
		--rule: var(--ui-rule-2);
		--green: var(--ui-green);
		max-width: 100%;
		pointer-events: auto;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px 14px 14px;
		color: var(--body);
		border-radius: 18px;
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
	}
	.pill {
		border-radius: 999px;
		padding: 6px 14px;
		background: var(--ui-gold);
		color: var(--ui-gold-ink);
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
		background: var(--ui-glass-well);
		color: var(--ink);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.x:hover {
		background: var(--ui-glass-well-2);
	}
	.block {
		background: var(--ui-glass-well);
		border: 1px solid var(--ui-rule);
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
		border: 1px solid var(--ui-rule-2);
		border-radius: 8px;
		background: var(--ui-glass-well-2);
		box-shadow: 0 2px 0 rgba(0, 0, 0, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.1s ease, box-shadow 0.1s ease;
	}
	/* no ellipsis and no overflow clip: a bet level is never allowed to be truncated (Stake
	   review 2026-09-20). The column count + the font fit above guarantee the string fits. */
	.opt span {
		font-weight: 800;
		letter-spacing: 0.5px;
		color: var(--ink);
		white-space: nowrap;
	}
	.opt:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.4);
	}
	.opt:active:not(:disabled) {
		transform: translateY(1px);
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
	}
	.opt:disabled {
		opacity: 0.45;
		cursor: not-allowed;
		background: transparent;
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
		color: var(--ui-gold-ink);
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
	}
	.cap {
		text-align: center;
		font-size: 11.5px;
		font-weight: 500;
		color: var(--faint);
	}

	/* ── tight (phone / small popout) and tiny (Stake Popout S, 400x225) ── */
	.tight {
		gap: 9px;
		padding: 12px 14px 10px;
		border-radius: 14px;
	}
	.tight .title {
		font-size: 17px;
		letter-spacing: 2px;
	}
	.tight .pill {
		padding: 5px 10px;
		font-size: 9px;
		letter-spacing: 1px;
	}
	.tight .x {
		width: 30px;
		height: 30px;
		border-radius: 8px;
	}
	.tight .block {
		border-radius: 9px;
	}
	.tight .cap {
		font-size: 10px;
	}
	.tiny {
		gap: 6px;
		padding: 8px 10px 8px;
		border-radius: 10px;
	}
	.tiny .title {
		font-size: 13px;
		letter-spacing: 1.5px;
	}
	.tiny .pill {
		padding: 3px 7px;
		font-size: 9px;
		letter-spacing: 0.5px;
	}
	.tiny .x {
		width: 26px;
		height: 26px;
		border-radius: 7px;
	}
	.tiny .head {
		gap: 6px;
		padding: 0;
	}
	/* the caption is the one line that can go: the grid itself is what has to be readable */
	.tiny .cap {
		display: none;
	}
</style>
