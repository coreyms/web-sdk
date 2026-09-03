<script lang="ts" module>
	export type EmitterEventReplay = { type: 'replayFinished' };
</script>

<script lang="ts">
	// Stake Engine replay card (checklist: round auto-loads, explicit start button, slim UI, play
	// again afterwards). Rows follow the layout Stake's own replay window uses (Corey 2026-09-02,
	// from the Discord creators' channel): MODE · BASE PLAY · PLAY MULTIPLIER · TOTAL PLAY, then the
	// round's MULTIPLIER and TOTAL WIN. Same cream card stock as the Chow Line / Autoplay so it
	// reads as part of the game, not a browser dialog. While the round plays the card is gone and
	// the spin button carries a static REPLAY banner (SquareSpin.svelte).
	//
	// Numbers: `amount` in the replay URL is the BASE play (one press at 1×); the mode's cost
	// multiplier gives the total play; `payoutMultiplier` from /bet/replay is in base-play
	// multiples (the books' payoutMultiplier / 100), so total win = base × multiplier — the same
	// arithmetic the win counter uses during the round.
	import { stateBet, stateUrlDerived, type BetToResume } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { betModeMeta } from '../game/betModeMeta';
	import { soc } from '../game/social';
	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import { replayState } from './replayState.svelte';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { controls, master, scale, left, top, compact = false }: Props = $props();

	const context = getContext();

	let replayBet = $state<BetToResume>(null);

	// Authenticate resolves the replay before any child mounts, so the round is already here;
	// the effect also covers a late arrival
	$effect(() => {
		if (!replayBet && stateBet.betToResume) replayBet = stateBet.betToResume;
	});

	context.eventEmitter.subscribeOnMount({
		replayFinished: () => (replayState.phase = 'done'),
	});

	// the card is the FIRST start only; later replays come from the spin button
	const open = $derived(stateUrlDerived.replay() && replayState.phase === 'ready' && !context.stateLayout.showLoadingScreen);

	const modeKey = $derived((replayBet?.mode ?? stateBet.activeBetModeKey ?? 'BASE').toUpperCase());
	const meta = $derived(betModeMeta[modeKey]);
	const modeLabel = $derived(meta?.type === 'default' || !meta ? 'BASE GAME' : meta.text.title);
	const base = $derived(stateBet.betAmount);
	const costMultiplier = $derived(meta?.costMultiplier ?? 1);
	const totalPlay = $derived(base * costMultiplier);
	const multiplier = $derived(Number((replayBet as { payoutMultiplier?: number } | null)?.payoutMultiplier ?? 0));
	const totalWin = $derived(base * multiplier);
	const xText = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}x`;

	const start = () => {
		if (!replayBet) return;
		controls.sound('soundPressMinor');
		stateBet.betToResume = { ...replayBet, active: true, event: '0' };
		if (replayBet.mode) stateBet.activeBetModeKey = replayBet.mode;
		replayState.phase = 'playing';
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};
	replayState.start = start;
</script>

<ModalShell {open} onclose={() => {}} {master} {scale} {left} {top} dim="rgba(0,0,0,0.55)" blur={6} zIndex={4}>
	<div class="center" style:padding={compact ? '16px' : '0'}>
		<div class="panel" class:compact onclick={(e) => e.stopPropagation()} role="presentation">
			<div class="grain"></div>
			<div class="head">
				<div class="title">ROUND REPLAY</div>
				<div class="pill">SHARED ROUND</div>
			</div>

			{#if replayBet}
				<div class="block">
					<div class="row"><span class="k">MODE</span><span class="v mode">{modeLabel}</span></div>
					<div class="row"><span class="k">{soc('BASE BET', 'BASE PLAY')}</span><span class="v slot-num">{numberToCurrencyString(base)}</span></div>
					<div class="row"><span class="k">{soc('BET MULTIPLIER', 'PLAY MULTIPLIER')}</span><span class="v slot-num">{xText(costMultiplier)}</span></div>
					<div class="row"><span class="k">{soc('TOTAL BET', 'TOTAL PLAY')}</span><span class="v slot-num">{numberToCurrencyString(totalPlay)}</span></div>
				</div>
				<div class="block one">
					<div class="row"><span class="k">MULTIPLIER</span><span class="v slot-num">{xText(multiplier)}</span></div>
				</div>
				<div class="block one win" class:zero={totalWin === 0}>
					<div class="row"><span class="k">TOTAL WIN</span><span class="v slot-num big">{numberToCurrencyString(totalWin)}</span></div>
				</div>
			{:else}
				<div class="loading">Fetching the round…</div>
			{/if}

			<div class="tear"></div>
			<button class="slot-btn go" disabled={!replayBet} onclick={start}>START REPLAY</button>
			<div class="cap">{soc('Watching only — nothing is wagered. Speed, sound and game info still work.', 'Watching only — no play amount is used. Speed, sound and game info still work.')}</div>
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

	/* ── the paper card (same stock as AutoplayModal / BonusBuyModal) ── */
	.panel {
		--ink: #1b1204;
		--body: #2a241a;
		--muted: #6b6250;
		--faint: #8a8069;
		--rule: #a99c7d;
		--green: #4e7d15;
		width: min(460px, 100%);
		pointer-events: auto;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 18px 24px 16px;
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
	}
	.title {
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
	.block {
		display: flex;
		flex-direction: column;
		border: 3px dashed var(--rule);
		border-radius: 12px;
		padding: 4px 16px;
	}
	.block.one {
		padding: 8px 16px;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 16px;
		padding: 7px 0;
	}
	.block:not(.one) .row + .row {
		border-top: 1px solid rgba(0, 0, 0, 0.1);
	}
	.k {
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 3px;
		color: var(--muted);
		white-space: nowrap;
	}
	.v {
		font-size: 17px;
		font-weight: 800;
		color: var(--ink);
		text-align: right;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.v.mode {
		letter-spacing: 2px;
		font-size: 15px;
	}
	.v.big {
		font-size: 26px;
		color: var(--green);
	}
	.win {
		border-style: solid;
		border-color: var(--green);
		background: rgba(166, 228, 87, 0.28);
	}
	.win.zero {
		border-color: var(--rule);
		background: rgba(0, 0, 0, 0.04);
	}
	.win.zero .v.big {
		color: var(--muted);
	}
	.loading {
		text-align: center;
		padding: 24px 0;
		font-weight: 600;
		color: var(--faint);
	}
	.tear {
		height: 0;
		border-top: 3px dashed var(--rule);
		margin: 0 -12px;
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
	.go:active:not(:disabled) {
		transform: translateY(2px);
		box-shadow: 0 3px 0 rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.45);
	}
	.cap {
		text-align: center;
		font-size: 11.5px;
		font-weight: 500;
		color: var(--faint);
		margin-top: -4px;
	}

	/* ── compact (phone sideways / portrait) ── */
	.compact {
		gap: 9px;
		padding: 14px 16px 12px;
		border-radius: 14px;
		width: min(380px, 100%);
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
	.compact .block {
		border-width: 2px;
		border-radius: 9px;
		padding: 2px 12px;
	}
	.compact .block.one {
		padding: 5px 12px;
	}
	.compact .row {
		padding: 5px 0;
	}
	.compact .k {
		font-size: 10px;
		letter-spacing: 2px;
	}
	.compact .v {
		font-size: 14px;
	}
	.compact .v.mode {
		font-size: 12px;
	}
	.compact .v.big {
		font-size: 20px;
	}
	.compact .go {
		padding: 11px 14px;
		font-size: 13px;
		letter-spacing: 2px;
	}
	.compact .cap {
		font-size: 10px;
	}
</style>
