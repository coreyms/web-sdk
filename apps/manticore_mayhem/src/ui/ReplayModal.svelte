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
	import { untrack } from 'svelte';
	import { stateBet, stateModal, stateUrlDerived, type BetToResume } from 'state-shared';
	import { numberToCurrencyString } from '../game/amount';

	import { getContext } from '../game/context';
	import { betModeMeta, modeShortLabel } from '../game/betModeMeta';
	import { soc } from '../game/social';
	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import { replayState } from './replayState.svelte';
	import { replayRoundUsable } from './replayRound';
	import { awaitReplayNeeds, replayGatePlan, replayLoad } from '../game/replayLoad.svelte';
	import { loadGate } from '../game/loadGate.svelte';
	import { bootSizes } from '../game/assetStamp';
	import { LANDING_BAR } from '../game/introCards';
	import { sound } from '../game/sound';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { controls, master, scale, left, top, compact = false }: Props = $props();

	const context = getContext();

	let replayBet = $state<BetToResume>(null);

	// Authenticate resolves the replay before any child mounts, so the round is already here.
	// A REPLAY THAT DID NOT LOAD (2026-11-24, ui/replayRound.ts): the shared fetch hands an RGS error's body on as if it
	// were the round (a 400 for a mode the RGS no longer serves, a book it does not have), and gives nothing at all when
	// the answer was empty. Either way there is no round: the card never opens on zeros and nothing can be started. The
	// game's error card (ui/NoticeModal.svelte: REPLAY NOT AVAILABLE, RELOAD) is shown, unless Authenticate has already
	// put it up (a fetch that threw), and the unusable answer is taken out of the resume slot so no playback can pick
	// it up. Only the error's code reaches the card (NoticeModal), never the payload.
	$effect(() => {
		if (replayBet || replayState.phase === 'failed' || !stateUrlDerived.replay()) return;
		const answer = stateBet.betToResume;
		if (replayRoundUsable(answer)) {
			replayBet = answer;
			// (the round's files are worked out now, while the card is up: the loading sign's total is whole from its first
			// moment, so its percent only climbs)
			untrack(replayGatePlan);
			return;
		}
		untrack(() => {
			replayState.phase = 'failed';
			stateBet.betToResume = null;
			if (stateModal.modal?.name !== 'error') stateModal.modal = { name: 'error', error: answer ?? {} };
		});
	});

	context.eventEmitter.subscribeOnMount({
		replayFinished: () => (replayState.phase = 'done'),
	});

	// the card is the FIRST start only; later replays come from the spin button. It stays up (or comes back) while a press
	// waits for the round's files: its loading sign (below) is then in START REPLAY's place.
	// THE CARD FIRST (2026-11-26, Corey on Slow 4G: "We should immediately show the replay card"): it is plain HTML and
	// needs the replay answer and its styles only, so it opens the moment the game's HTML mounts, over the splash's
	// backdrop (src/app.html), and no longer waits for the start-up art (the Pixi preload behind showLoadingScreen: the
	// page stayed black for 42 s on Slow 4G). START pressed before the game is drawn waits for that as well (below).
	const open = $derived(stateUrlDerived.replay() && (replayState.phase === 'ready' || replayLoad.waiting));

	// THE LOADING SIGN (2026-11-26, constants REPLAY_LOAD): START REPLAY pressed before the round's own files and the audio
	// are in (game/replayLoad.svelte.ts awaitReplayNeeds). Never a still board with nothing on it: the card stays up and the
	// button gives way to the landing screen's bar and its words (LANDING_BAR: the splash's segmented red bar, "LOADING ·
	// N%"), plain HTML and CSS. N counts the bytes START waits for: the start-up art (the Pixi preload, by its own
	// progress), those files as the gate lands them (they are its first groups), a feature round's banner motion once in,
	// and the audio, by bytes as the landing screen weighs it. Every part of the total is known from the card's first
	// moment, so it only climbs (and a high-water mark holds it where the audio's own count restarts).
	const SEG = LANDING_BAR.segments;
	const SEGS = Array.from({ length: SEG }, (_, i) => i);
	const AUDIO_BYTES = bootSizes.audio;
	const PRELOAD_BYTES = bootSizes.preload;
	const rawPct = $derived.by(() => {
		const app = context.stateApp;
		const pre = app.preLoaded ? PRELOAD_BYTES : (Math.min(100, Math.max(0, app.loadingProgress)) / 100) * PRELOAD_BYTES;
		const need = replayLoad.needBytes;
		const files = replayLoad.neededIn ? need : Math.min(loadGate.doneBytes, need);
		const motion = replayLoad.motionIn ? replayLoad.motionBytes : 0;
		const audio = sound.isReady ? AUDIO_BYTES : sound.progress * AUDIO_BYTES;
		return Math.round((100 * (pre + files + motion + audio)) / Math.max(1, PRELOAD_BYTES + need + replayLoad.motionBytes + AUDIO_BYTES));
	});
	let highWater = $state(0);
	$effect(() => {
		const p = rawPct;
		untrack(() => {
			if (p > highWater) highWater = p;
		});
	});
	// (99 at most: the sign is up only while something is still coming, the layout's board art included, game/replayLoad)
	const pct = $derived(Math.min(99, Math.max(rawPct, highWater)));
	const lit = $derived(Math.min(SEG, Math.floor((pct * SEG) / 100)));

	const modeKey = $derived((replayBet?.mode ?? stateBet.activeBetModeKey ?? 'BASE').toUpperCase());
	const meta = $derived(betModeMeta[modeKey]);
	// A MODE THE GAME NO LONGER OFFERS (2026-11-21: the Epic and Mystery buys left; an old link can still name EPIC or
	// MYSTERY): the card names it by its short name ("EPIC", "MYSTERY") rather than calling it the base game. If the RGS
	// still serves that round it plays from its book like any other (a Mystery book plays as a base spin: its `mystery`
	// marker is ignored since the Mystery playback left the game, 2026-11-21); if it does not (an error answer, or no
	// round in it), the effect above shows the error card with RELOAD and this card never opens
	const modeLabel = $derived(!meta ? (modeKey === 'BASE' ? 'BASE GAME' : modeShortLabel(modeKey)) : meta.type === 'default' ? 'BASE GAME' : meta.text.title);
	const base = $derived(stateBet.betAmount);
	// the replay response is the authority on what the round cost; the local table is only a fallback
	const costMultiplier = $derived(Number((replayBet as { costMultiplier?: number } | null)?.costMultiplier) || meta?.costMultiplier || 1);
	const totalPlay = $derived(base * costMultiplier);
	const multiplier = $derived(Number((replayBet as { payoutMultiplier?: number } | null)?.payoutMultiplier ?? 0));
	const totalWin = $derived(base * multiplier);
	const xText = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}x`;
	// THE REPLAY'S BET LINE (replayState.hud): the HUD's right readout as it reads in play (a bought feature's short name,
	// else SPIN / PLAY) over the round's total cost; the base amount for any mode but the base game
	$effect(() => {
		if (!replayBet) return;
		replayState.hud = {
			label: meta?.type === 'buy' || (!meta && modeKey !== 'BASE') ? modeShortLabel(modeKey) : soc('SPIN', 'PLAY'),
			total: numberToCurrencyString(totalPlay),
			base: numberToCurrencyString(base),
			isBase: modeKey === 'BASE',
		};
	});

	const start = async () => {
		if (!replayBet || replayState.phase === 'failed' || replayLoad.waiting) return;
		controls.sound('soundPressMinor');
		// event '0' = play the round from its first book event. The replay URL's `event` param is
		// the ROUND identifier (the last path segment of /bet/replay/...), NOT an index into this
		// round's events — feeding it in here would make convertTorResumableBet (game/utils.ts)
		// drop every event before it, i.e. the whole round (checked 2026-09-20).
		stateBet.betToResume = { ...replayBet, active: true, event: '0' };
		// upper case whatever the URL said (mode=bonus and mode=BONUS are the same round): the mode table,
		// the labels and the handlers all key on the upper-case RGS name
		if (replayBet.mode) stateBet.activeBetModeKey = replayBet.mode.toUpperCase();
		// THE REPLAY'S OWN FILES (2026-11-26, constants REPLAY_LOAD; game/replayNeeds.ts has the wait table): only what this
		// round draws and the audio, at once when they are in, else with the loading sign up, never longer than the cap.
		// Until then this waited for the WHOLE deferred phase or 30 s (game/assetGate.ts awaitDeferredAssets), with the card
		// gone and the board standing still. The round itself is started exactly as before, once.
		// (and the game drawn: the round's handlers mount with it, so START never sends the round before they can take it)
		await awaitReplayNeeds(() => !context.stateLayout.showLoadingScreen);
		replayState.phase = 'playing';
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};
	replayState.start = start;
</script>

<ModalShell {open} onclose={() => {}} {master} {scale} {left} {top} dim="rgba(0,0,0,0.55)" blur={6} zIndex={4}>
	<div class="center">
		<div class="panel am-glass" class:compact onclick={(e) => e.stopPropagation()} role="presentation">
			<div class="head">
				<div class="title am-stencil">ROUND REPLAY</div>
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
			{#if replayLoad.waiting}
				<div class="go wait" role="status" aria-live="polite">
					<div class="wbar" aria-hidden="true">
						{#each SEGS as i (i)}<i class:on={i < lit}></i>{/each}
					</div>
					<div class="wtext">LOADING · {pct}%</div>
				</div>
			{:else}
				<button class="slot-btn go" disabled={!replayBet} onclick={start}>START REPLAY</button>
			{/if}
			<div class="cap">{soc('Watching only. Nothing is wagered. Speed, sound and game info still work.', 'Watching only. No play amount is used. Speed, sound and game info still work.')}</div>
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
		padding: clamp(4px, 2vmin, 16px);
		box-sizing: border-box;
		pointer-events: none;
	}

	/* ── black glass (the same surface as the Chow Line / Autoplay / Game Info; the paper card
	      went with the approval review 2026-09-15) ── */
	.panel {
		--ink: var(--ui-ink);
		--body: var(--ui-ink-2);
		--muted: var(--ui-ink-2);
		--faint: var(--ui-ink-3);
		--rule: var(--ui-rule-2);
		/* the win's accent: the game's gold, not Angry Mantis's lime (Corey 2026-10-17 20:27) */
		--accent: var(--ui-gold);
		/* Sized against the VIEWPORT (Stake review FIX 5): in a 400x225 popout the shell used to
		   scale this card to 103 CSS px wide with sub-3 px labels. Now the card fills the window
		   and every line has a real minimum size; it scrolls if the window is shorter than it. */
		width: min(460px, 94vw);
		max-height: 94vh;
		overflow-y: auto;
		scrollbar-width: none;
		box-sizing: border-box;
		pointer-events: auto;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: clamp(4px, 1.8vmin, 12px);
		padding: clamp(8px, 2.6vmin, 18px) clamp(12px, 3.2vmin, 24px) clamp(7px, 2.4vmin, 16px);
		color: var(--body);
		border-radius: 18px;
	}
	.panel::-webkit-scrollbar {
		display: none;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
	}
	.title {
		font-size: clamp(14px, 4.4vmin, 22px);
	}
	.pill {
		border-radius: 999px;
		padding: 6px 14px;
		background: var(--ui-gold);
		color: var(--ui-gold-ink);
		font-size: clamp(9px, 2.3vmin, 11px);
		font-weight: 800;
		letter-spacing: 2px;
		white-space: nowrap;
	}
	.block {
		display: flex;
		flex-direction: column;
		background: var(--ui-glass-well);
		border: 1px solid var(--ui-rule);
		border-radius: 12px;
		padding: clamp(2px, 0.8vmin, 4px) clamp(8px, 2.4vmin, 16px);
	}
	.block.one {
		padding: clamp(3px, 1.4vmin, 8px) clamp(8px, 2.4vmin, 16px);
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: clamp(6px, 2vmin, 16px);
		padding: clamp(2px, 1.3vmin, 7px) 0;
	}
	.block:not(.one) .row + .row {
		border-top: 1px solid var(--ui-rule);
	}
	.k {
		font-size: clamp(9px, 2.5vmin, 12px);
		font-weight: 800;
		letter-spacing: 3px;
		color: var(--muted);
		white-space: nowrap;
	}
	.v {
		font-size: clamp(12px, 3.4vmin, 17px);
		font-weight: 800;
		color: var(--ink);
		text-align: right;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.v.mode {
		letter-spacing: 2px;
		font-size: clamp(11px, 3vmin, 15px);
	}
	.v.big {
		font-size: clamp(16px, 5vmin, 26px);
		color: var(--accent);
	}
	.win {
		border-color: var(--accent);
		background: rgba(255, 220, 74, 0.14); /* --ui-gold at 0.14 */
	}
	.win.zero {
		border-color: var(--ui-rule);
		background: var(--ui-glass-well);
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
		border-top: 1px solid var(--ui-rule);
		margin: 0 -12px;
	}
	/* Stake's Popout S is 400x225: the card only clears that window if the four play rows run two
	   to a line and the hairline goes. Everything stays on screen, nothing shrinks below 9 px. */
	@media (max-height: 260px) {
		.tear {
			display: none;
		}
		.block:not(.one) {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			column-gap: 12px;
		}
		.block:not(.one) .row + .row {
			border-top: 0;
		}
		.block:not(.one) .row:nth-child(n + 3) {
			border-top: 1px solid var(--ui-rule);
		}
		/* two-up rows share the width: the value never breaks ("300 / x" grew the card past the
		   window and put the sticky button over TOTAL WIN, Corey 2026-09-20) and the key gives up
		   tracking instead */
		.block:not(.one) .row {
			min-width: 0;
		}
		.block:not(.one) .k {
			letter-spacing: 1.5px;
			font-size: clamp(8px, 2.3vmin, 11px);
		}
		.v {
			white-space: nowrap;
			overflow-wrap: normal;
		}
		.cap {
			line-height: 1.25;
		}
	}
	/* sticky: in a 225 px popout the card is taller than the window and scrolls, and START REPLAY
	   is the one control on it — it must never be below the fold (Stake review FIX 5) */
	.go {
		position: sticky;
		bottom: 0;
		border-radius: 12px;
		padding: clamp(8px, 2.4vmin, 14px) 16px;
		/* >=30 CSS px in a 225-tall popout, a full 44 px touch target on any real phone */
		min-height: max(28px, min(44px, 14vmin));
		font-size: clamp(11px, 3vmin, 15px);
		font-weight: 900;
		letter-spacing: 3px;
		color: var(--ui-gold-ink);
		/* the game's gold (the bet picker's chosen chip, ui/DenomModal.svelte: --ui-gold to --ui-amber), not Angry Mantis's
		   lime (harsh review 2026-10-20 must-fix 7; Corey 2026-10-21 "2, 3, 5, and 7 are obvious fixes") */
		background: linear-gradient(180deg, var(--ui-gold), var(--ui-amber));
		box-shadow: 0 5px 0 rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.45);
	}
	/* THE LOADING SIGN in START REPLAY's place (same box, so the card does not jump): the landing screen's segmented bar
	   (ui/LandingScreen.svelte .gbar: the splash's red, skewed segments lit whole) and its readout. No filters. */
	.wait {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 6px 16px;
		background: var(--ui-glass-well);
		border: 1px solid var(--ui-rule);
		box-shadow: none;
	}
	.wbar {
		--accent: #e32400;
		display: flex;
		gap: 3px;
		width: min(100%, 300px);
		height: 12px;
		padding: 3px;
		box-sizing: border-box;
		border-radius: 5px;
		background: rgba(0, 0, 0, 0.6);
		box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.07);
		transform: skewX(-14deg);
	}
	.wbar i {
		flex: 1;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.06);
		transition: background-color 140ms ease-out;
	}
	.wbar i.on {
		background: linear-gradient(180deg, color-mix(in oklab, var(--accent) 55%, #fff), var(--accent) 55%, color-mix(in oklab, var(--accent) 70%, #000));
	}
	.wtext {
		font-family: var(--ui-font, inherit);
		font-size: clamp(10px, 2.6vmin, 12px);
		font-weight: 700;
		letter-spacing: 1.5px;
		color: var(--ui-ink-2);
		font-variant-numeric: tabular-nums;
	}
	.go:active:not(:disabled) {
		transform: translateY(2px);
		box-shadow: 0 3px 0 rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.45);
	}
	.cap {
		text-align: center;
		font-size: clamp(9px, 2.4vmin, 11.5px);
		font-weight: 500;
		color: var(--faint);
		margin-top: -4px;
	}

	/* ── compact (phone sideways / portrait): the clamps above already carry the type sizes, so
	      only the card's own width is narrowed here ── */
	.compact {
		width: min(380px, 94vw);
	}

	/* Stake's Popout S (400x225) and anything as short: the loading sign keeps START REPLAY's height (after its own rules,
	   so these win) */
	@media (max-height: 260px) {
		.wait {
			gap: 2px;
			padding: 3px 12px;
		}
		.wbar {
			height: 9px;
			padding: 2px;
		}
	}
</style>
