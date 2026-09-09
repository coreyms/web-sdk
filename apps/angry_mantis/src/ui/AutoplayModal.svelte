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
	// mode chip shortens to BASE · $1.00 / SPIN so the head stays one row.
	// The bet stepper sits under the sheet, as it does on the bonus-buy screen (Corey 2026-09-02).
	import { stateModal } from 'state-shared';

	import { modeChipData } from '../game/modeChipData';
	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import BetAdjuster from './BetAdjuster.svelte';
	import Icon from './Icon.svelte';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { controls, master, scale, left, top, compact = false }: Props = $props();
	// compact covers phone-sideways (1480×740) and portrait (412×760); only portrait is narrow
	const portrait = $derived(master.width < master.height);

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
	const pill = $derived(modeChipData() ?? { label: 'BASE GAME', cost: controls.abbrev(perSpin, 100_000) });
	const countText = (c: number) => (c === Infinity ? '∞' : `${c}`);
	const totalText = $derived(count === Infinity ? '∞' : controls.abbrev(count * perSpin));

	const load = () => {
		controls.loadAutoplay({ count, lossMult, winMult, stopFree: stopFreeOn, autoBonuses: stopFreeOn ? false : autoBonuses });
	};
	// reopening while a loadout waits: allow clearing it
	const hasLoadout = $derived(controls.autoLoadout() !== null);
</script>

<ModalShell {open} onclose={close} {master} {scale} {left} {top} dim="rgba(6,4,10,0.55)" zIndex={3}>
	<div class="center" style:gap="{compact ? 10 : 14}px">
		<div class="panel am-glass" class:compact class:portrait onclick={(e) => e.stopPropagation()} role="presentation" style:max-height="{master.height - (portrait ? 96 : 100)}px">
			<div class="head">
				<div class="title">AUTOPLAY</div>
				<div class="pill"><span class="mode">{portrait ? pill.label.replace(' GAME', '') : pill.label}</span><span class="dot">·</span><span class="slot-num cost">{pill.cost}</span><span class="per">/ SPIN</span></div>
				<button class="slot-btn x" onclick={() => (controls.sound('soundPressSub'), close())} aria-label="Close"><Icon name="close" s={16} /></button>
			</div>

			<div class="sec">
				<div class="sec-label"><h3>Number of spins</h3><span class="hint">selecting only previews, nothing starts</span></div>
				<div class="chips four">
					{#each COUNTS as c (c)}
						<button class="slot-btn chip" class:on={count === c} onclick={() => (controls.sound('soundPressSub'), (count = c))}>
							<span class="slot-num big">{countText(c)}</span>
							<span class="slot-num sub">{c === Infinity ? 'until stopped' : controls.abbrev(c * perSpin)}</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="total">
				<span class="k">{soc('TOTAL BET AMOUNT', 'TOTAL PLAY AMOUNT')}</span>
				<span class="v-wrap"><span class="slot-num v">{totalText}</span><span class="slot-num math">{count === Infinity ? 'until stopped' : `${count} × ${controls.abbrev(perSpin)}`}</span></span>
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
		pointer-events: none;
	}
	.stepper {
		pointer-events: auto;
	}

	/* ── the glass sheet (surface from .am-glass) ── */
	.panel {
		width: 420px;
		max-width: 96%;
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
	.title {
		font-size: 18px;
		font-weight: 900;
		letter-spacing: 3.5px;
		color: var(--ui-ink);
		white-space: nowrap;
	}
	.pill {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
		border-radius: 999px;
		padding: 7px 10px;
		border: 1px solid var(--ui-rule-2);
		color: var(--ui-ink-2);
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 1.6px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
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
	.chip .sub {
		font-size: 10px;
		color: var(--ui-ink-3);
		white-space: nowrap;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
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
	.v-wrap {
		display: flex;
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
