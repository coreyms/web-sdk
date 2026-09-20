<script lang="ts">
	import { soc } from '../game/social';
	// Autoplay Loadout (design approved 2026-08-26): configure a run, preview its TRUE total, then LOAD
	// it onto the spin button — pressing Spin is what starts it. Loss/win stops are multiples of one
	// spin's play amount; "stop on free games" only exists outside armed feature modes.
	// Black glass (Corey's "Black Glass Panels" pick, 2026-09-09): the sheet opens on the spin count,
	// the true total and one gold LOAD; the loss stop, single-win stop and the two toggles live behind
	// a STOP OPTIONS fold whose closed row summarises what is set, and the sheet opens unfolded
	// whenever something non-default is set — a stop is never hidden. Gold = the chosen count, white
	// = a chosen limit, red = OFF. Fonts stay the chrome's own (Outfit labels, Sora numbers).
	// Portrait (412 wide, 760 tall): the expanded sheet must fit above the bet stepper with NO scroll,
	// so the limits run six to a row, the wrap-prone hints / toggle blurbs / footer line go, and the
	// mode chip shortens to BASE · $1.00 / SPIN so the head stays one row (a bought feature's chip
	// reads "$100.00 TOTAL" instead: the price is for the whole round, not for each free spin).
	// The bet stepper sits under the sheet, as it does on the bonus-buy screen (Corey 2026-09-02).
	import { untrack } from 'svelte';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { stateModal } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import { modeChipData } from '../game/modeChipData';
	import { fitFont } from '../game/textFit';
	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import BetAdjuster from './BetAdjuster.svelte';
	import Icon from './Icon.svelte';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { controls, master, scale, left, top, compact = false }: Props = $props();
	// compact covers phone-sideways (1480×740) and portrait (412×760); only portrait is narrow
	const portrait = $derived(master.width < master.height);
	// ModalShell's frame is the VIEWPORT now (Stake review FIX 5), so the sheet sizes itself against
	// real CSS px: `tiny` is Stake's Popout S band (400×225), where the sheet scrolls and the
	// secondary lines step aside so the numbers stay legible.
	const vw = $derived(innerWidth.current ?? 1280);
	const vh = $derived(innerHeight.current ?? 720);
	const tiny = $derived(vh < 300 || vw < 360);
	// the armed-mode pill reads "MYSTERY · $300.00 / SPIN", not "MYSTERY SPIN · $300.00 / SPIN":
	// the mode word alone, since "/ SPIN" already says the rest and the long labels clipped the
	// pill on phones (Corey 2026-09-15)
	const shortMode = (label: string) =>
		label === 'FREE SPINS' ? 'BONUS' : label.replace(/ (FREE SPINS|SPINS?|BET|MODE|GAME)$/, '');

	const open = $derived(stateModal.modal?.name === 'autoSpin');
	const close = () => (stateModal.modal = null);

	const COUNTS: number[] = [10, 25, 50, 100, 250, 500, 1000, Infinity];
	const LIMITS: (number | null)[] = [null, 5, 10, 25, 100, 500]; // null = OFF

	let count = $state(25);
	let lossMult = $state<number | null>(null);
	let winMult = $state<number | null>(null);
	let stopFree = $state(false);
	let autoBonuses = $state(false);

	const armed = $derived(controls.armedBuy() !== null);
	// effective stop-on-free-games (armed buy modes force it off); autoplay bonuses only exists while this is off
	const stopFreeOn = $derived(!armed && stopFree);
	let advanced = $state(false);
	const anySet = $derived(lossMult !== null || winMult !== null || stopFree || autoBonuses);
	$effect(() => {
		if (open && anySet) advanced = true;
	});
	const advSummary = $derived.by(() => {
		const parts: string[] = [];
		parts.push(lossMult !== null ? `Loss limit ${lossMult}×` : 'Loss limit off');
		parts.push(winMult !== null ? `Win limit ${winMult}×` : 'Win limit off');
		if (stopFreeOn) parts.push('Stops on free games');
		else if (autoBonuses) parts.push('Bonuses autoplay');
		else parts.push('Bonuses wait for a press');
		return parts.join(' · ');
	});

	const perSpin = $derived(controls.playCost());
	const pill = $derived(modeChipData() ?? { label: 'BASE GAME', cost: numberToCurrencyString(perSpin), unit: soc('/ SPIN', '/ PLAY') });
	const countText = (c: number) => (c === Infinity ? '∞' : `${c}`);
	// Every amount on this sheet is the FULL currency string — Stake's review (2026-09-20) bars
	// K/M abbreviation on any bet-level readout. The long ones are fitted, not abbreviated:
	// the grand total shrinks to a floor (it is the number the player is deciding on, so it never
	// disappears), and the per-count sub-line under a chip drops when it cannot be fitted — that
	// same number is one tap away on the chip's own total row.
	const totalText = $derived(count === Infinity ? '∞' : numberToCurrencyString(count * perSpin));
	const perSpinText = $derived(numberToCurrencyString(perSpin));
	// chip cell width, mirroring the CSS: panel width − padding − 3 gaps, over 4 columns, less the
	// chip's own side padding
	const panelW = $derived(Math.min(portrait ? 380 : 420, vw * 0.94));
	const chipW = $derived((panelW - 2 * (portrait ? 16 : 18) - 3 * 8) / 4 - 8);
	// 9.5 px is the hide threshold: a per-count total either reads or it steps aside — it is
	// never shrunk into illegibility and never ellipsised.
	const subFont = (text: string) => fitFont({ text, nominal: 10, box: chipW, minScale: 0.95, weight: 600, letterSpacing: 0 });
	// the total row: label + value share the row, so the value gets a little over half of it
	const totalBox = $derived(panelW - 2 * (portrait ? 16 : 18) - 24 - 12);
	const totalFont = $derived(fitFont({ text: totalText, nominal: 20, box: totalBox * 0.58, floor: 12 }) ?? 12);
	// HEAD: the mode pill carries a price, so it is never clipped — and the AUTOPLAY title is never
	// truncated either (review 2026-09-20). When the two cannot share the row the pill drops to its
	// own line under the title. A canvas estimate of the three boxes ran ~23 px pessimistic and
	// stacked the head on a Popout S that had room for it, so the widths come from the REAL
	// elements: `scrollWidth` on the two nowrap boxes is their CONTENT width in either state, and
	// the head is full-bleed in either state, so the measurement cannot oscillate with the class it
	// decides. The effect only WRITES its two state cells (house rule: never read-modify-write
	// shared state in an effect), and re-runs on the inputs that can change the content.
	let headEl: HTMLDivElement | undefined = $state();
	let titleEl: HTMLDivElement | undefined = $state();
	let pillEl: HTMLDivElement | undefined = $state();
	let xEl: HTMLButtonElement | undefined = $state();
	let headW = $state(0);
	let headNeedW = $state(0);
	const HEAD_GAP = 10;
	$effect(() => {
		// deps: anything that changes the head's content or the sheet's width
		void [pill.label, pill.cost, pill.unit, panelW, tiny, portrait, open];
		const h = headEl, t = titleEl, pi = pillEl, x = xEl;
		if (!h || !t || !pi || !x) return;
		untrack(() => {
			headW = h.clientWidth;
			headNeedW = t.scrollWidth + pi.scrollWidth + x.offsetWidth + 2 * HEAD_GAP;
		});
	});
	const headFits = $derived(headW === 0 || headNeedW <= headW);

	const load = () => {
		controls.loadAutoplay({ count, lossMult, winMult, stopFree: stopFreeOn, autoBonuses: stopFreeOn ? false : autoBonuses });
	};
	// reopening while a loadout waits: allow clearing it
	const hasLoadout = $derived(controls.autoLoadout() !== null);
</script>

<ModalShell {open} onclose={close} {master} {scale} {left} {top} dim="rgba(6,4,10,0.55)" zIndex={3}>
	<div class="center" style:gap="{compact ? 10 : 14}px">
		<div class="panel am-glass" class:compact class:portrait class:tiny onclick={(e) => e.stopPropagation()} role="presentation">
			<div class="head" class:stacked={!headFits} bind:this={headEl}>
				<div class="title am-stencil" bind:this={titleEl}>AUTOPLAY</div>
				<div class="pill" bind:this={pillEl}><span class="mode">{shortMode(pill.label)}</span><span class="dot">·</span><span class="slot-num cost">{pill.cost}</span><span class="per">{pill.unit}</span></div>
				<button class="slot-btn x" bind:this={xEl} onclick={() => (controls.sound('soundPressSub'), close())} aria-label="Close"><Icon name="close" s={16} /></button>
			</div>

			<div class="sec">
				<div class="sec-label"><h3>Number of spins</h3><span class="hint">selecting only previews, nothing starts</span></div>
				<div class="chips four">
					{#each COUNTS as c (c)}
						{@const sub = c === Infinity ? 'until stopped' : numberToCurrencyString(c * perSpin)}
						{@const sf = subFont(sub)}
						<button class="slot-btn chip" class:on={count === c} onclick={() => (controls.sound('soundPressSub'), (count = c))}>
							<span class="slot-num big">{countText(c)}</span>
							{#if sf !== null}<span class="slot-num sub" style:font-size="{sf}px">{sub}</span>{/if}
						</button>
					{/each}
				</div>
			</div>

			<div class="total">
				<span class="k">{soc('TOTAL BET AMOUNT', 'TOTAL PLAY AMOUNT')}</span>
				<span class="v-wrap"><span class="slot-num v" style:font-size="{totalFont}px">{totalText}</span><span class="slot-num math">{count === Infinity ? 'until stopped' : `${count} × ${perSpinText}`}</span></span>
			</div>

			<div class="fold" class:open={advanced}>
				<button class="slot-btn fold-row" onclick={() => { controls.sound('soundPressSub'); advanced = !advanced; }} aria-expanded={advanced}>
					<span class="fold-k">Stop options</span>
					<span class="fold-sum">{advSummary}</span>
					<span class="chev" class:down={advanced}><Icon name="chevronRight" s={16} /></span>
				</button>

				{#if advanced}
					<div class="fold-body">
						<div class="sec">
							<div class="sec-label"><h3>Stop on loss</h3><span class="hint">run stops if net loss reaches this</span></div>
							<div class="chips six">
								{#each LIMITS as m (m)}
									<button class="slot-btn lim" class:on={lossMult === m} class:off={m === null} onclick={() => (controls.sound('soundPressSub'), (lossMult = m))}>
										<span class="slot-num">{m === null ? 'OFF' : `${m}×`}</span>
									</button>
								{/each}
							</div>
						</div>

						<div class="sec">
							<div class="sec-label"><h3>Stop on single win</h3><span class="hint">run stops if one spin wins this much</span></div>
							<div class="chips six">
								{#each LIMITS as m (m)}
									<button class="slot-btn lim" class:on={winMult === m} class:off={m === null} onclick={() => (controls.sound('soundPressSub'), (winMult = m))}>
										<span class="slot-num">{m === null ? 'OFF' : `${m}×`}</span>
									</button>
								{/each}
							</div>
						</div>

						<button class="slot-btn toggle" class:on={stopFreeOn} disabled={armed} onclick={() => { controls.sound('soundPressSub'); stopFree = !stopFree; if (stopFree) autoBonuses = false; }} role="switch" aria-checked={stopFreeOn}>
							<span class="t-text">
								<span class="t-main">Stop on Free Games</span>
								<span class="t-sub" class:warn={armed}>{armed ? 'Unavailable: every spin already plays the loaded feature' : 'Autoplay ends when a feature triggers (it still plays out)'}</span>
							</span>
							<span class="knob"></span>
						</button>
						<button class="slot-btn toggle" class:on={autoBonuses && !stopFreeOn} disabled={stopFreeOn} onclick={() => (controls.sound('soundPressSub'), (autoBonuses = !autoBonuses))} role="switch" aria-checked={autoBonuses && !stopFreeOn}>
							<span class="t-text">
								<span class="t-main">Autoplay Bonuses</span>
								<span class="t-sub" class:warn={stopFreeOn}>{stopFreeOn ? 'Unavailable: turn off Stop on Free Games first' : 'Feature screens continue on their own while autoplay runs'}</span>
							</span>
							<span class="knob"></span>
						</button>
					</div>
				{/if}
			</div>

			<button class="slot-btn go" onclick={load}>
				LOAD <span class="slot-num n">{countText(count)}</span> AUTO SPINS{#if count !== Infinity}&nbsp;·&nbsp;<span class="slot-num n">{totalText}</span>{/if}
			</button>
			<div class="cap">Loads to the Spin button. Pressing Spin starts the run; pressing again stops it.</div>
			{#if hasLoadout}
				<!-- a run already parked on the Spin button: LOAD above replaces it, this clears it -->
				<button class="slot-btn unload" onclick={() => { controls.sound('soundPressSub'); controls.clearAutoplay(); close(); }}>UNLOAD CURRENT AUTO SPINS</button>
			{/if}
		</div>
		<div class="stepper" onclick={(e) => e.stopPropagation()} role="presentation">
			<BetAdjuster {controls} {compact} pressSound="soundPressSub" />
		</div>
	</div>
</ModalShell>

<style>
	.center {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 6px;
		box-sizing: border-box;
		pointer-events: none;
	}
	.stepper {
		pointer-events: auto;
	}

	/* ── the glass sheet (surface from .am-glass) ── */
	/* viewport-sized (FIX 5): the sheet fills what the window gives it and scrolls inside itself
	   rather than shrinking with a master transform */
	.panel {
		width: 420px;
		max-width: 94vw;
		max-height: 86vh;
		box-sizing: border-box;
		pointer-events: auto;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px 18px 18px;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: none;
	}
	.panel::-webkit-scrollbar {
		display: none;
	}
	.panel > * {
		min-width: 0;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.head > * {
		min-width: 0;
	}
	/* Neither the title nor the price pill may be truncated (Stake review 2026-09-20): when they
	   cannot share the row the head restacks, title + close on top and the pill on its own line. */
	.title {
		flex: 0 0 auto;
		font-size: 18px;
		font-weight: 900;
		letter-spacing: 3.5px;
		color: var(--ui-ink);
		white-space: nowrap;
	}
	.head.stacked {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-areas: 'title x' 'pill pill';
		justify-items: start;
		align-items: center;
		row-gap: 8px;
	}
	.head.stacked .title {
		grid-area: title;
	}
	.head.stacked .pill {
		grid-area: pill;
	}
	.head.stacked .x {
		grid-area: x;
	}
	.pill {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
		border-radius: 999px;
		padding: 7px 10px;
		border: 1px solid var(--ui-rule-2);
		color: var(--ui-ink-2);
		flex: 0 0 auto;
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 1.6px;
		white-space: nowrap;
	}
	.pill .dot {
		opacity: 0.5;
	}
	.pill .cost {
		color: var(--ui-gold);
		font-weight: 600;
		letter-spacing: 0;
		font-size: 11.5px;
	}
	.x {
		flex: 0 0 auto;
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
	.sec {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.sec-label {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 10px;
	}
	.sec-label h3 {
		margin: 0;
		font-size: 10.5px;
		font-weight: 800;
		letter-spacing: 2.2px;
		color: var(--ui-ink-2);
		text-transform: uppercase;
		white-space: nowrap;
	}
	.hint {
		font-size: 11px;
		font-weight: 500;
		color: var(--ui-ink-3);
		text-align: right;
	}
	.chips {
		display: grid;
		gap: 8px;
	}
	.chips.four {
		grid-template-columns: repeat(4, 1fr);
	}
	.chips.six {
		grid-template-columns: repeat(6, 1fr);
		gap: 6px;
	}
	/* count chip: value over its total; the chosen one is the sheet's one gold fill */
	.chip {
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 9px 4px 7px;
		border-radius: 10px;
		background: var(--ui-glass-well);
		border: 1px solid var(--ui-rule-2);
		color: var(--ui-ink);
	}
	.chip .big {
		font-size: 17px;
		font-weight: 700;
		line-height: 1;
	}
	/* no ellipsis: the per-count total is an amount, so it is fitted or dropped, never truncated */
	.chip .sub {
		font-size: 10px;
		color: var(--ui-ink-3);
		white-space: nowrap;
		max-width: 100%;
	}
	.chip.on {
		background: var(--ui-gold);
		border-color: var(--ui-gold);
		color: var(--ui-gold-ink);
	}
	.chip.on .sub {
		color: rgba(27, 18, 4, 0.65);
	}
	/* limit chip: white when chosen, red when the chosen one is OFF */
	.lim {
		min-width: 0;
		padding: 7px 2px;
		border-radius: 8px;
		background: var(--ui-glass-well);
		border: 1px solid var(--ui-rule-2);
		color: var(--ui-ink);
		font-size: 12px;
		font-weight: 600;
		text-align: center;
	}
	.lim.on {
		background: var(--ui-ink);
		border-color: var(--ui-ink);
		color: #101014;
	}
	.lim.on.off {
		background: var(--ui-red);
		border-color: var(--ui-red);
		color: #fff;
	}
	.total {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		border: 1px dashed var(--ui-rule-2);
		border-radius: 10px;
		padding: 10px 12px;
	}
	.total .k {
		font-size: 10.5px;
		font-weight: 800;
		letter-spacing: 2.2px;
		color: var(--ui-ink-2);
		white-space: nowrap;
	}
	/* the "25 x GC 1,000,000" derivation wraps under the total rather than being clipped: it is
	   an amount, and an amount is never truncated (Stake review 2026-09-20) */
	.v-wrap {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: baseline;
		gap: 8px;
		white-space: nowrap;
	}
	.total .v {
		font-size: 20px;
		font-weight: 700;
		color: var(--ui-ink);
	}
	.total .math {
		font-size: 11px;
		color: var(--ui-ink-3);
	}
	/* the stop-options fold */
	.fold {
		border: 1px solid var(--ui-rule);
		border-radius: 10px;
	}
	.fold-row {
		width: 100%;
		background: transparent;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 10px 12px;
		text-align: left;
		color: var(--ui-ink);
	}
	.fold-row > * {
		min-width: 0;
	}
	.fold-k {
		font-size: 10.5px;
		font-weight: 800;
		letter-spacing: 2.2px;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.fold-sum {
		flex: 1;
		font-size: 11px;
		color: var(--ui-ink-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.chev {
		flex: 0 0 auto;
		display: inline-flex;
		color: var(--ui-ink-2);
		transition: transform 0.2s ease;
	}
	.chev.down {
		transform: rotate(90deg);
	}
	.fold-body {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 4px 12px 10px;
		border-top: 1px solid var(--ui-rule);
	}
	.toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		background: transparent;
		color: var(--ui-ink);
		text-align: left;
		min-width: 0;
		min-height: 32px;
	}
	.toggle:disabled {
		opacity: 0.55;
	}
	.t-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.t-main {
		font-size: 12.5px;
		font-weight: 700;
	}
	.t-sub {
		font-size: 11px;
		font-weight: 500;
		line-height: 1.35;
		color: var(--ui-ink-3);
		text-wrap: pretty;
	}
	.t-sub.warn {
		color: #ff8a70;
	}
	.knob {
		flex: 0 0 auto;
		width: 44px;
		height: 24px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.16);
		position: relative;
	}
	.knob::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #fff;
		transition: left 0.15s;
	}
	.toggle.on .knob {
		background: var(--ui-green);
	}
	.toggle.on .knob::after {
		left: 23px;
	}
	/* LOAD: the one gold button; UNLOAD takes the same slot in red */
	.go {
		border-radius: 12px;
		padding: 16px;
		font-size: 15px;
		font-weight: 900;
		letter-spacing: 2.5px;
		color: var(--ui-gold-ink);
		background: var(--ui-gold);
		box-shadow: 0 4px 0 #b8961f, 0 10px 24px rgba(0, 0, 0, 0.5);
	}
	.go:active {
		transform: translateY(2px);
		box-shadow: 0 2px 0 #b8961f;
	}
	.go .n {
		letter-spacing: 0;
		font-weight: 700;
	}
	.unload {
		align-self: center;
		border-radius: 8px;
		padding: 8px 14px;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 1.5px;
		color: #fff;
		background: var(--ui-red);
		margin-top: -4px;
	}
	/* the footer line steps aside while the fold is open: the 720-tall landscape master has no room for both */
	.fold.open ~ .cap {
		display: none;
	}
	.cap {
		text-align: center;
		font-size: 11px;
		font-weight: 500;
		color: var(--ui-ink-3);
		margin-top: -4px;
	}

	/* ── compact (phone sideways): the 740-tall master has room, only the gaps tighten ── */
	.compact {
		gap: 10px;
	}

	/* ── tiny (Stake Popout S, 400x225): the sheet has to be a reading surface in 225 px of
	      height. Gaps close up, the explanatory lines step aside, the sheet scrolls. Type sizes
	      stay where they are — the numbers are the point. ── */
	.tiny {
		gap: 7px;
		padding: 10px 12px 12px;
		/* the bet stepper shares the window under the sheet, so the sheet takes two thirds of it */
		max-height: 68vh;
	}
	.tiny .hint,
	.tiny .cap,
	.tiny .t-sub:not(.warn) {
		display: none;
	}
	.tiny .title {
		font-size: 15px;
		letter-spacing: 2px;
	}
	.tiny .chip {
		padding: 6px 3px 5px;
	}
	.tiny .go {
		padding: 11px;
		font-size: 13px;
	}
	.tiny .x {
		width: 28px;
		height: 28px;
	}

	/* ── portrait: the expanded sheet fits above the stepper with no scroll ── */
	.portrait {
		width: 380px;
		padding: 14px 16px 16px;
		gap: 10px;
	}
	.portrait .hint,
	.portrait .t-sub,
	.portrait .cap {
		display: none;
	}
	.portrait .t-sub.warn {
		display: block; /* an unavailable toggle still says why */
	}
	.portrait .chip {
		padding: 7px 4px 6px;
	}
	.portrait .chips.six {
		gap: 5px;
	}
	/* touch: 40px chips and close on a phone (the 412 master lands at ~0.95 CSS px per unit) */
	.portrait .lim {
		padding: 11px 0;
		font-size: 11.5px;
	}
	.portrait .x {
		width: 40px;
		height: 40px;
	}
	.portrait .total {
		padding: 8px 12px;
	}
	.portrait .fold-body {
		gap: 10px;
		padding-bottom: 10px;
	}
</style>
