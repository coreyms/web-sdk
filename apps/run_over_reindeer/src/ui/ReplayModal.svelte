<script lang="ts" module>
	export type EmitterEventReplay = { type: 'replayFinished' };
</script>

<script lang="ts">
	// Stake Engine replay card (checklist: round auto-loads, explicit start button, slim UI, play
	// again afterwards). Rows follow the layout Stake's own replay window uses (Corey 2026-09-02,
	// from the Discord creators' channel): MODE · BASE PLAY · PLAY MULTIPLIER · TOTAL PLAY, then the
	// round's MULTIPLIER and TOTAL WIN. Same cream card stock as the Chow Line / Autoplay so it
	// reads as part of the game, not a browser dialog. While the round plays the card is gone and
	// the spin button carries a static REPLAY banner (ui/hud/HudSpin.svelte, ui/sign/SignPlay.svelte).
	//
	// Numbers: `amount` in the replay URL is the BASE play (one press at 1×); the mode's cost
	// multiplier gives the total play; `payoutMultiplier` from /bet/replay is in base-play
	// multiples (the books' payoutMultiplier / 100), so total win = base × multiplier — the same
	// arithmetic the win counter uses during the round.
	import { untrack } from 'svelte';
	import { stateBet, stateModal, stateUrlDerived, type BetToResume } from 'state-shared';
	import { replayFault } from '../game/replayFault';
	import { numberToCurrencyString } from '../game/currency';
	import { fitAmount } from './fitAmount';

	import { getContext } from '../game/context';
	import { betModeMeta, modeShortLabel } from '../game/betModeMeta';
	import { soc } from '../game/social';
	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import { replayState } from './replayState.svelte';
	import { awaitReplayNeeds, replayLoad, replayRetried } from '../game/replayLoad.svelte';
	import { replayPct } from '../game/replayWait';

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

	// the card is the FIRST start only; later replays come from the spin button. NEVER UNDER THE ERROR CARD (2026-11-23,
	// game/replayGuard.ts): a replay the RGS did not serve, or one whose fetch failed, shows the error card alone (this
	// card used to stand behind it, reading "Fetching the round").
	// THE CARD FIRST (2026-11-26, constants REPLAY_LOAD; Corey: "make sure the text card recap is the first thing that comes
	// up on a slow connection"): it is plain HTML and needs the bundle, its CSS and the replay answer only, so it opens the
	// moment the game's HTML mounts, over the shell splash's backdrop (src/app.html #am-splash.am-replay). Until then it also
	// waited for the whole Pixi preload and its fade (showLoadingScreen): Decimus measured the card 3.1 s (phone) and 8.6 s
	// (desktop, the 5.5 MB symbols atlas) after the first contentful paint on Fast 4G. It stays up while a press waits
	// (replayLoad.waiting), its loading sign in START's place.
	const open = $derived(stateUrlDerived.replay() && (replayState.phase === 'ready' || replayLoad.waiting) && stateModal.modal?.name !== 'error');

	// THE LOADING SIGN (game/replayLoad.svelte.ts): the start-up art, by the Pixi preload's own progress (weighted by bytes,
	// pixi-svelte AssetsLoader), the one thing START waits for. Never backwards.
	const rawPct = $derived(replayPct(context.stateApp.preLoaded ? 1 : context.stateApp.loadingProgress / 100));
	let highWater = $state(0);
	$effect(() => {
		const p = rawPct;
		untrack(() => {
			if (p > highWater) highWater = p;
		});
	});
	const pct = $derived(Math.max(rawPct, highWater));

	const modeKey = $derived((replayBet?.mode ?? stateBet.activeBetModeKey ?? 'BASE').toUpperCase());
	const meta = $derived(betModeMeta[modeKey]);
	const modeLabel = $derived(meta?.type === 'default' || !meta ? 'BASE GAME' : meta.text.title);
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
			label: meta?.type === 'buy' ? modeShortLabel(modeKey) : soc('SPIN', 'PLAY'),
			total: numberToCurrencyString(totalPlay),
			base: numberToCurrencyString(base),
			isBase: modeKey === 'BASE',
		};
	});

	const start = async () => {
		// (no round, or one with no book events in it: nothing to play, so nothing starts and nothing is held)
		if (!replayBet || replayFault(replayBet, true) !== null || replayLoad.waiting) return;
		controls.sound('soundPressMinor');
		// event '0' = play the round from its first book event. The replay URL's `event` param is
		// the ROUND identifier (the last path segment of /bet/replay/...), NOT an index into this
		// round's events — feeding it in here would make convertTorResumableBet (game/utils.ts)
		// drop every event before it, i.e. the whole round (checked 2026-09-20).
		stateBet.betToResume = { ...replayBet, active: true, event: '0' };
		// upper case whatever the URL said (mode=bonus and mode=BONUS are the same round): the mode table,
		// the labels and the handlers all key on the upper-case RGS name
		if (replayBet.mode) stateBet.activeBetModeKey = replayBet.mode.toUpperCase();
		// THE GAME DRAWN (game/replayLoad.svelte.ts): at once when it is (the usual case once the card has been read), else with
		// the card's loading sign up until the moment the card itself used to open; never the audio (a replay never waited for
		// it). Until 2026-11-26 this waited on game/assetGate.ts awaitDeferredAssets, which resolved with the preload (nothing
		// is deferred), because the card itself came only after it.
		await awaitReplayNeeds(
			() => !context.stateLayout.showLoadingScreen,
			() => context.stateApp,
		);
		replayState.phase = 'playing';
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};
	replayState.start = start;
	// TAP TO RETRY (the start-up art is stuck, replayLoad.stalled), as the landing screen offers it: a file the loader gave
	// up is fetched again by the loader's own retry (stateApp.retryFailedAssets); a file that is only held cannot be asked
	// again from here, so the replay link opens anew (what is already in comes from the browser's cache)
	const retry = () => {
		controls.sound('soundPressMinor');
		if (replayLoad.stalled === 'failed' && context.stateApp.retryFailedAssets) {
			context.stateApp.retryFailedAssets();
			replayRetried();
		} else location.reload();
	};
</script>

<ModalShell {open} onclose={() => {}} {master} {scale} {left} {top} dim="rgba(0,0,0,0.55)" blur={6} zIndex={4}>
	<div class="center">
		<div class="panel sp-skin" class:compact onclick={(e) => e.stopPropagation()} role="presentation">
			<div class="head">
				<div class="title am-stencil">ROUND REPLAY</div>
				<div class="pill">SHARED ROUND</div>
			</div>

			{#if replayBet}
				<div class="block">
					<div class="row"><span class="k">MODE</span><span class="v mode" use:fitAmount={modeLabel}>{modeLabel}</span></div>
					<div class="row"><span class="k">{soc('BASE BET', 'BASE PLAY')}</span><span class="v slot-num" use:fitAmount={{ text: numberToCurrencyString(base), floor: 10 }} data-replay-amount>{numberToCurrencyString(base)}</span></div>
					<div class="row"><span class="k">{soc('BET MULTIPLIER', 'PLAY MULTIPLIER')}</span><span class="v slot-num" use:fitAmount={xText(costMultiplier)}>{xText(costMultiplier)}</span></div>
					<div class="row"><span class="k">{soc('TOTAL BET', 'TOTAL PLAY')}</span><span class="v slot-num" use:fitAmount={{ text: numberToCurrencyString(totalPlay), floor: 10 }} data-replay-amount>{numberToCurrencyString(totalPlay)}</span></div>
				</div>
				<div class="block one">
					<div class="row"><span class="k">MULTIPLIER</span><span class="v slot-num" use:fitAmount={xText(multiplier)}>{xText(multiplier)}</span></div>
				</div>
				<div class="block one win" class:zero={totalWin === 0}>
					<div class="row"><span class="k">TOTAL WIN</span><span class="v slot-num big" use:fitAmount={{ text: numberToCurrencyString(totalWin), floor: 12 }} data-replay-amount>{numberToCurrencyString(totalWin)}</span></div>
				</div>
			{:else}
				<div class="loading">Fetching the round…</div>
			{/if}

			<div class="tear"></div>
			{#if replayLoad.waiting && replayLoad.stalled}
				<!-- the landing screen's words for a start-up file that will not come (ui/LandingScreen.svelte), on two lines -->
				<button class="slot-btn go retry" onclick={retry} aria-label="Connection problem. Tap to retry"><span>CONNECTION PROBLEM</span><span>TAP TO RETRY</span></button>
			{:else if replayLoad.waiting}
				<div class="go wait" role="status" aria-live="polite">
					<div class="wbar" aria-hidden="true"><div class="wfill" style:transform="scaleX({pct / 100})"></div></div>
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
	/* THE SIGN STYLE (2026-11-23, style A of the mock menus_r1_2026-11-23; a plain restyle: no size, place or word
	   changes): the card is ui/sign/signPanel.css .sp-skin; its rows stand in dark plates, SHARED ROUND is a plate
	   with a white line, the win's row has the yellow line and yellow figures, START REPLAY is the yellow main key. */
	.panel {
		--ink: var(--sp-ink);
		--body: var(--sp-ink2);
		--muted: var(--sp-ink2);
		--faint: var(--sp-ink3);
		--rule: var(--sp-rule);
		/* the win's accent: the sign panels' yellow (it was the game's gold) */
		--accent: var(--sp-acc);
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
		color: var(--ink);
	}
	.pill {
		border-radius: 999px;
		padding: 6px 14px;
		background: var(--sp-well);
		box-shadow: inset 0 0 0 var(--sp-wl) var(--sp-band);
		color: var(--ink);
		font-size: clamp(9px, 2.3vmin, 11px);
		font-weight: 800;
		letter-spacing: 2px;
		white-space: nowrap;
	}
	.block {
		display: flex;
		flex-direction: column;
		background: var(--sp-well);
		border: 1px solid var(--rule);
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
		border-top: 1px solid var(--rule);
	}
	.k {
		flex: none;
		font-size: clamp(9px, 2.5vmin, 12px);
		font-weight: 800;
		letter-spacing: 3px;
		color: var(--muted);
		white-space: nowrap;
	}
	/* a value takes the row's rest and its text fits it (ui/fitAmount.ts, 2026-11-21): one line, never broken (it was
	   overflow-wrap: anywhere, which broke a long BTC or GC total in the middle of its digits) */
	.v {
		flex: 1 1 0;
		font-size: clamp(12px, 3.4vmin, 17px);
		font-weight: 800;
		color: var(--ink);
		text-align: right;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
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
	}
	.win.zero {
		border-color: var(--rule);
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
		border-top: 1px solid var(--rule);
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
			border-top: 1px solid var(--rule);
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
		/* the loading sign keeps START REPLAY's height in Stake's Popout S */
		.wait {
			gap: 2px;
			padding: 3px 12px;
		}
		.wbar {
			height: 8px;
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
		/* the sign panels' main key (the Turbo yellow, its white band as an inset line, a black line, the dark drop) */
		color: var(--sp-acc-ink);
		background: linear-gradient(180deg, var(--sp-acc-top), var(--sp-acc-bot));
		box-shadow:
			inset 0 0 0 3px var(--sp-band),
			0 0 0 1.5px var(--sp-ki-c),
			0 5px 0 1.5px var(--sp-acc-deep);
	}
	.go:active:not(:disabled) {
		transform: translateY(2px);
		box-shadow:
			inset 0 0 0 3px var(--sp-band),
			0 0 0 1.5px var(--sp-ki-c),
			0 3px 0 1.5px var(--sp-acc-deep);
	}
	.retry {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		line-height: 1.15;
		text-align: center;
	}
	.retry span {
		white-space: nowrap;
	}
	/* THE LOADING SIGN in START REPLAY's place (the same box, so the card does not jump): the sign panels' slider track
	   (ui/sign/signPanel.css .sp-sl-t: the dark track, the white band, the yellow fill) and the card's key type. A transform
	   moves the fill; no filters. */
	.wait {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding: 6px 16px;
		background: var(--sp-well);
		box-shadow: inset 0 0 0 var(--sp-wl) var(--sp-band);
	}
	.wbar {
		position: relative;
		width: min(100%, 300px);
		height: 10px;
		box-sizing: border-box;
		border-radius: 5px;
		background: var(--sp-trk);
		border: 1.5px solid var(--sp-band);
		overflow: hidden;
	}
	.wfill {
		position: absolute;
		inset: 0;
		background: var(--sp-acc);
		transform-origin: left center;
		transition: transform 160ms linear;
	}
	.wtext {
		font-size: clamp(9px, 2.5vmin, 12px);
		font-weight: 800;
		letter-spacing: 3px;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.cap {
		text-align: center;
		font-size: clamp(9px, 2.4vmin, 11.5px);
		font-weight: 500;
		color: var(--faint);
		margin-top: 7px; /* clear of START REPLAY's drop edge (was -4px: the first line touched it, Decimus stills 2026-11-24) */
	}

	/* ── compact (phone sideways / portrait): the clamps above already carry the type sizes, so
	      only the card's own width is narrowed here ── */
	.compact {
		width: min(380px, 94vw);
	}
</style>
