<script lang="ts">
	// Autoplay Loadout (design approved 2026-08-26; Meal Ticket skin from Corey's Claude Design
	// "Autoplay 2a", 2026-09-02): configure a run, preview its TRUE total, then LOAD it onto the spin
	// button — pressing Spin is what starts it. Loss/win stops are multiples of one spin's play
	// amount; "stop on free games" only exists outside armed feature modes. The skin is the same
	// cream card stock as the Chow Line so bonus-buy and autoplay read as one system: green = go,
	// red = loss stop, yellow only on the mode pill. Fonts stay the chrome's own (Outfit labels,
	// Sora numbers) — Corey wants the autoplay faces unchanged, not the design's display fonts.
	// The bet stepper sits under the card, as it does on the bonus-buy screen (Corey 2026-09-02).
	import { stateModal } from 'state-shared';

	import { modeChipData } from '../game/modeChipData';
	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import BetAdjuster from './BetAdjuster.svelte';
	import Icon from './Icon.svelte';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { controls, master, scale, left, top, compact = false }: Props = $props();

	const open = $derived(stateModal.modal?.name === 'autoSpin');
	const close = () => (stateModal.modal = null);

	const COUNT_ROWS: number[][] = [
		[10, 25, 50, 100],
		[250, 500, 1000, Infinity],
	];
	const LIMITS: (number | null)[] = [null, 5, 10, 25, 100, 500]; // null = OFF

	let count = $state(25);
	let lossMult = $state<number | null>(null);
	let winMult = $state<number | null>(null);
	let stopFree = $state(false);
	let autoBonuses = $state(false);

	const armed = $derived(controls.armedBuy() !== null);
	// effective stop-on-free-games (armed buy modes force it off); autoplay bonuses only exists while this is off
	const stopFreeOn = $derived(!armed && stopFree);
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

<ModalShell {open} onclose={close} {master} {scale} {left} {top} zIndex={3}>
	<button class="slot-btn x" onclick={(e) => (e.stopPropagation(), close())} style:top="{compact ? 14 : 22}px" style:right="{compact ? 14 : 26}px" style:width="{compact ? 40 : 44}px" style:height="{compact ? 40 : 44}px" aria-label="Close">
		<Icon name="close" s={compact ? 16 : 20} />
	</button>
	<div class="center" style:gap="{compact ? 10 : 14}px">
		<div class="panel" class:compact onclick={(e) => e.stopPropagation()} role="presentation" style:max-height="{master.height - (compact ? 118 : 130)}px">
			<div class="grain"></div>
			<div class="head">
				<div class="title">AUTOPLAY</div>
				<div class="pill"><b>{compact ? pill.label.replace(' GAME', '') : pill.label}</b><span class="dot">·</span><span class="slot-num cost">{pill.cost}</span><span class="per">/ SPIN</span></div>
			</div>

			<div class="sec">
				<div class="sec-label"><h3>Number of spins</h3><span class="hint">{compact ? 'selecting only previews' : 'selecting only previews — nothing starts'}</span></div>
				<!-- landscape's 720-tall master has no room for two count rows under the rest of the card,
				     so the eight counts run as one row there; compact keeps the design's 4×2 -->
				{#each compact ? COUNT_ROWS : [COUNT_ROWS.flat()] as row, r (r)}
					<div class="chips" class:four={compact} class:eight={!compact}>
						{#each row as c (c)}
							<button class="slot-btn chip" class:on={count === c} onclick={() => (count = c)}>
								<span class="slot-num big">{countText(c)}</span>
								<span class="slot-num sub">{c === Infinity ? 'until stopped' : controls.abbrev(c * perSpin)}</span>
							</button>
						{/each}
					</div>
				{/each}
				<div class="total">
					<span class="k">{compact ? 'TOTAL PLAY' : 'TOTAL PLAY AMOUNT'}</span>
					<span class="v-wrap"><span class="slot-num v">{totalText}</span><span class="slot-num math">{count === Infinity ? 'until stopped' : `${count} × ${controls.abbrev(perSpin)}`}</span></span>
				</div>
			</div>

			<div class="sec">
				<div class="sec-label"><h3>Stop on loss</h3><span class="hint">{compact ? 'net loss since start' : 'run stops if net loss since the start reaches this'}</span></div>
				<div class="chips six">
					{#each LIMITS as m (m)}
						<button class="slot-btn chip" class:on={lossMult === m} class:off-red={lossMult === m && m === null} onclick={() => (lossMult = m)}>
							<span class="slot-num big small">{m === null ? 'OFF' : `${m}×`}</span>
							<span class="slot-num sub">{m === null ? 'no loss stop' : controls.abbrev(m * perSpin)}</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="sec">
				<div class="sec-label"><h3>Stop on single win</h3><span class="hint">{compact ? 'one spin wins this much' : 'run stops if one spin wins this much'}</span></div>
				<div class="chips six">
					{#each LIMITS as m (m)}
						<button class="slot-btn chip" class:on={winMult === m} onclick={() => (winMult = m)}>
							<span class="slot-num big small">{m === null ? 'OFF' : `${m}×`}</span>
							<span class="slot-num sub">{m === null ? 'no win stop' : controls.abbrev(m * perSpin)}</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="toggles">
				<button class="slot-btn toggle" class:on={stopFreeOn} disabled={armed} onclick={() => { stopFree = !stopFree; if (stopFree) autoBonuses = false; }}>
					<span class="t-text">
						<span class="t-main">Stop on Free Games</span>
						<span class="t-sub" class:warn={armed}>{armed ? 'Unavailable — every spin already plays the loaded feature' : compact ? 'Ends when a feature triggers (it still plays out)' : 'Autoplay ends when a feature triggers naturally (it still plays out)'}</span>
					</span>
					<span class="knob"></span>
				</button>
				<button class="slot-btn toggle" class:on={autoBonuses && !stopFreeOn} disabled={stopFreeOn} onclick={() => (autoBonuses = !autoBonuses)}>
					<span class="t-text">
						<span class="t-main">Autoplay Bonuses</span>
						<span class="t-sub" class:warn={stopFreeOn}>{stopFreeOn ? 'Unavailable — turn off Stop on Free Games first' : compact ? 'Bonus screens continue on their own' : 'Bonus screens continue on their own while autoplay runs'}</span>
					</span>
					<span class="knob"></span>
				</button>
			</div>

			<div class="tear"></div>

			<button class="slot-btn go" onclick={load}>
				LOAD {countText(count)} AUTO SPINS{#if count !== Infinity}&nbsp;—&nbsp;<span class="slot-num">{totalText}</span>{/if}
			</button>
			<div class="cap">{compact ? 'Loads to the Spin button. Press Spin to start; press again to stop.' : 'Loads to the Spin button. Pressing Spin starts the run; pressing it again stops.'}</div>
			{#if hasLoadout}
				<button class="slot-btn unload" onclick={() => { controls.clearAutoplay(); close(); }}>UNLOAD CURRENT AUTO SPINS</button>
			{/if}
		</div>
		<div class="stepper" onclick={(e) => e.stopPropagation()} role="presentation">
			<BetAdjuster {controls} {compact} />
		</div>
	</div>
</ModalShell>

<style>
	.x {
		position: absolute;
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.55);
		border: 2px solid rgba(255, 255, 255, 0.25);
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
	.stepper {
		pointer-events: auto;
	}

	/* ── the paper card ── */
	.panel {
		--ink: #1b1204;
		--body: #2a241a;
		--muted: #6b6250;
		--faint: #8a8069;
		--rule: #a99c7d;
		--green: #4e7d15;
		--green-bg: #a6e457;
		--green-glow: rgba(143, 209, 63, 0.35);
		--red: #b8371e;
		--red-bg: #ff8a70;
		--red-glow: rgba(239, 90, 60, 0.3);
		width: min(720px, 96%);
		pointer-events: auto;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 18px 26px 16px;
		overflow-y: auto;
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
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.title {
		font-size: 24px;
		font-weight: 900;
		letter-spacing: 5px;
		color: var(--ink);
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
	}
	.pill {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
		border-radius: 999px;
		padding: 8px 18px;
		background: var(--body);
		color: #ebe3cf;
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 2.5px;
		white-space: nowrap;
	}
	.pill b {
		color: #f2c14e;
		font-weight: 800;
	}
	.pill .dot {
		opacity: 0.5;
	}
	.pill .cost {
		font-size: 15px;
		color: #fff;
		font-weight: 800;
	}
	.pill .per {
		font-size: 10px;
		font-weight: 700;
		opacity: 0.6;
	}
	.sec {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.sec-label {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 10px;
		flex-wrap: wrap;
	}
	.sec-label h3 {
		margin: 0;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 3px;
		color: var(--muted);
		text-transform: uppercase;
	}
	.hint {
		font-size: 12px;
		font-weight: 500;
		color: var(--faint);
	}
	.chips {
		display: grid;
		gap: 10px;
	}
	.chips.four {
		grid-template-columns: repeat(4, 1fr);
	}
	.chips.six {
		grid-template-columns: repeat(6, 1fr);
	}
	.chips.eight {
		grid-template-columns: repeat(8, 1fr);
	}
	.chips.eight .chip .sub {
		font-size: 10px; /* "until stopped" clips at 11px in an eighth of the card */
	}
	.chip {
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		padding: 8px 4px 6px;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.06);
		border: 2px solid rgba(0, 0, 0, 0.14);
		color: var(--ink);
	}
	.chip .big {
		font-size: 20px;
		font-weight: 800;
		line-height: 1.1;
	}
	.chip .big.small {
		font-size: 17px;
	}
	.chip .sub {
		font-size: 11px;
		font-weight: 600;
		color: var(--faint);
		white-space: nowrap;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.chip.on {
		background: var(--green-bg);
		border-color: var(--green);
		box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.06), 0 0 18px var(--green-glow);
	}
	.chip.on .sub {
		color: #2f5309;
	}
	/* loss stop OFF reads as the red side of the scale */
	.chip.on.off-red {
		background: var(--red-bg);
		border-color: var(--red);
		box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.06), 0 0 18px var(--red-glow);
	}
	.chip.on.off-red .sub {
		color: var(--red);
	}
	.total {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		border: 3px dashed var(--rule);
		border-radius: 12px;
		padding: 8px 20px;
	}
	.total .k {
		font-size: 14px;
		font-weight: 800;
		letter-spacing: 3px;
		color: var(--muted);
	}
	.v-wrap {
		display: flex;
		align-items: baseline;
		gap: 12px;
	}
	.total .v {
		font-size: 26px;
		font-weight: 800;
		color: var(--ink);
	}
	.total .math {
		font-size: 12px;
		font-weight: 600;
		color: var(--faint);
	}
	.toggles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding: 10px 14px;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.06);
		border: 2px solid rgba(0, 0, 0, 0.12);
		color: var(--ink);
		text-align: left;
		min-width: 0;
		min-height: 44px;
	}
	.toggle:disabled {
		opacity: 0.55;
	}
	.t-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.t-main {
		font-size: 14px;
		font-weight: 800;
	}
	.t-sub {
		font-size: 11px;
		font-weight: 500;
		line-height: 1.35;
		color: var(--muted);
		text-wrap: pretty;
	}
	.t-sub.warn {
		color: var(--red);
	}
	.knob {
		flex: 0 0 auto;
		width: 52px;
		height: 28px;
		border-radius: 999px;
		background: var(--rule);
		position: relative;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
	}
	.knob::after {
		content: '';
		position: absolute;
		top: 4px;
		left: 4px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 2px 3px rgba(0, 0, 0, 0.4);
		transition: left 0.15s;
	}
	.toggle.on .knob {
		background: #6fb52a;
	}
	.toggle.on .knob::after {
		left: 28px;
	}
	.tear {
		height: 0;
		border-top: 3px dashed var(--rule);
		margin: 0 -14px;
	}
	.go {
		border-radius: 12px;
		padding: 14px 16px;
		font-size: 15px;
		font-weight: 900;
		letter-spacing: 3px;
		color: var(--ink);
		background: linear-gradient(180deg, #9be04a, #6fb52a);
		box-shadow: 0 5px 0 rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.45);
	}
	.cap {
		text-align: center;
		font-size: 11.5px;
		font-weight: 500;
		color: var(--faint);
		margin-top: -4px;
	}
	.unload {
		align-self: center;
		border-radius: 9px;
		padding: 8px 16px;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 1.5px;
		color: #ebe3cf;
		background: var(--body);
		box-shadow: 0 3px 0 rgba(0, 0, 0, 0.45);
	}

	/* ── compact (phone sideways / portrait) ── */
	.compact {
		gap: 9px;
		padding: 14px 14px 12px;
		border-radius: 14px;
	}
	.compact .title {
		font-size: 18px;
		letter-spacing: 2px;
	}
	.compact .pill {
		gap: 5px;
		padding: 6px 10px;
		font-size: 9px;
		letter-spacing: 1px;
	}
	.compact .pill .cost {
		font-size: 12px;
	}
	.compact .pill .per {
		font-size: 8px;
	}
	.compact .sec {
		gap: 6px;
	}
	.compact .sec-label h3 {
		font-size: 10px;
		letter-spacing: 2.5px;
	}
	.compact .hint {
		font-size: 9.5px;
	}
	.compact .chips.four {
		gap: 7px;
	}
	.compact .chips.six {
		gap: 5px;
	}
	.compact .chip {
		padding: 7px 3px 5px;
		border-radius: 9px;
	}
	.compact .chip .big {
		font-size: 16px;
	}
	.compact .chip .big.small {
		font-size: 13px;
	}
	.compact .chip .sub {
		font-size: 9px;
	}
	.compact .total {
		border-width: 2px;
		border-radius: 9px;
		padding: 6px 12px;
	}
	.compact .total .k {
		font-size: 10px;
		letter-spacing: 2px;
	}
	.compact .total .v {
		font-size: 19px;
	}
	.compact .total .math {
		font-size: 10px;
	}
	.compact .toggles {
		grid-template-columns: 1fr;
		gap: 7px;
	}
	.compact .toggle {
		padding: 8px 12px;
		border-radius: 9px;
		min-height: 40px;
	}
	.compact .t-main {
		font-size: 12.5px;
	}
	.compact .t-sub {
		font-size: 10px;
	}
	.compact .knob {
		width: 46px;
		height: 26px;
	}
	.compact .knob::after {
		top: 3px;
		left: 3px;
	}
	.compact .toggle.on .knob::after {
		left: 23px;
	}
	.compact .tear {
		border-top-width: 2px;
		margin: 0 -6px;
	}
	.compact .go {
		padding: 12px 12px;
		font-size: 13px;
		letter-spacing: 2px;
		border-radius: 10px;
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.45);
	}
	.compact .cap {
		font-size: 9.5px;
	}
</style>
