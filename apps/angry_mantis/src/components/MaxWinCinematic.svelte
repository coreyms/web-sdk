<script lang="ts" module>
	export type EmitterEventMaxWinCinematic = { type: 'maxWinCinematicPlay'; payout: number };
</script>

<script lang="ts">
	// THE MAX-WIN SCREEN (rebuilt 2026-09-15 to Corey's brief).
	//
	// The beat starts BEFORE this component: the spin's own count-up ladder (Win.svelte →
	// WinStinger) is told by bookEventHandlerMap's setWin that a maxWinCinematic follows, so it
	// keeps climbing past this spin's tier all the way to the book's payout and slams the MAX plate
	// in at the top. bgm_maxwin starts on that landing (game/maxWin.svelte.ts `maxWinBegin`), and
	// every stage below is an offset from it, so the screen is cut to the track:
	//
	//   t 0        MAX plate lands, track starts (quiet until ~0.75 s)
	//   t dimAt    the screen dims FULLY — uiHide({ deep: true }) takes even the logo and the WIN
	//              readout this once — and THEY ATE EVERYTHING slams in large; the tray rain starts
	//   t slamAt   the track is fully up: MAX WIN slams on top (tier 4 + glint), THEY ATE
	//              EVERYTHING recedes and shrinks behind it, the payout and its bet multiple read
	//              underneath, and the rain builds to a downpour
	//   t ~16 s    the track's 5 s fade begins; the rain thins with it
	//   t ~21.9 s  the track ENDS — only then does the press gate arm (with a duration + 500 ms
	//              fallback, because a muted/blocked audio context never delivers 'ended')
	//
	// The timeline hangs off the TRACK, not off the book's maxWinCinematic event: a wincap book puts
	// the round's last strike/eat BETWEEN setWin and maxWinCinematic, and waiting for that event put
	// the dim ~13 s into a 21.9 s track (measured with the Playwright probe, 2026-09-15). So the MAX
	// plate's landing starts this screen and the last bug is eaten behind the dim; the book's own
	// event handler simply awaits the screen.
	//
	// Numbers: the payout is the book's own maxWinCinematic.payout and the multiple under it is
	// that payout in base-bet multiples. Nothing is computed here.
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { Container } from 'pixi-svelte';
	import { onMount } from 'svelte';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { stateBet } from 'state-shared';
	import { bookEventAmountToCurrencyString, bookEventAmountToBetAmountMultiplier } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import GameText from './GameText.svelte';
	import ArtAmount, { artAmountSupports } from './ArtAmount.svelte';
	import BrandedTitle from './BrandedTitle.svelte';
	import TrayRain from './TrayRain.svelte';
	import PressToContinue from './PressToContinue.svelte';
	import { MAX_WIN } from '../game/constants';
	import { layoutKind } from '../game/layoutSpec';
	import {
		installMaxWinProbe,
		maxWinBegin,
		maxWinElapsed,
		maxWinReset,
		maxWinState,
		maxWinTrackEnded,
	} from '../game/maxWin.svelte';

	const context = getContext();

	let show = $state(false);
	let payout = $state(0);
	let amountShown = $state(0);
	let taePhase = $state<'idle' | 'enter'>('idle');
	let slammed = $state(false);
	let gateArmed = $state(false);
	let oncomplete = $state(() => {});
	/** ms since the track started, refreshed on the app ticker while the screen is up */
	let t = $state(0);
	/** 0..1 of the THEY-ATE-EVERYTHING recede (it shrinks and lifts as MAX WIN slams over it) */
	let recede = $state(0);

	const master = $derived(context.stateLayoutDerived.mainLayout());
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const L = $derived(MAX_WIN.layout[kind]);

	const payoutText = $derived(bookEventAmountToCurrencyString(amountShown));
	// the wincap in base-bet multiples, straight off the book payout (never a hard-coded 20000x)
	const multiplierText = $derived(`${Math.round(bookEventAmountToBetAmountMultiplier(payout))}x`);

	/** wait until `ms` after the track started (returns at once if that moment has passed) */
	const waitUntil = async (ms: number) => {
		const left = ms - maxWinElapsed();
		if (left > 0) await waitForTimeout(left);
	};

	onMount(() => {
		installMaxWinProbe();
		const ticker = context.stateApp.pixiApplication?.ticker;
		const tick = () => {
			if (!show && !gateArmed) return;
			t = maxWinElapsed();
			if (slammed && recede < 1) recede = Math.min(1, recede + (ticker?.deltaMS ?? 16) / MAX_WIN.recedeMs);
		};
		ticker?.add(tick);
		return () => ticker?.remove(tick);
	});

	// ---- the screen's own run, started by the MAX plate landing ----
	/** resolves when the whole screen is done; the book's maxWinCinematic handler awaits it */
	let done: (() => void) | undefined;
	let donePromise: Promise<void> | undefined;
	let running = false;

	const run = async () => {
		payout = maxWinState.payout;
		amountShown = Math.min(stateBet.winBookEventAmount, payout);
		slammed = false;
		recede = 0;
		gateArmed = false;
		taePhase = 'idle';

		// ---- the dim + THEY ATE EVERYTHING ----
		await waitUntil(MAX_WIN.dimAt);
		const dimmedAt = maxWinElapsed();
		maxWinState.phase = 'dim';
		// the DEEP hide: this is the one screen that takes the logo and the WIN readout too
		context.eventEmitter.broadcast({ type: 'uiHide', deep: true });
		show = true;
		taePhase = 'enter';

		// ---- the MAX WIN slam ---- (keeps the dim -> slam gap even if the dim itself ran late)
		await waitUntil(Math.max(MAX_WIN.slamAt, dimmedAt + (MAX_WIN.slamAt - MAX_WIN.dimAt)));
		maxWinState.phase = 'slam';
		slammed = true;
		// the amount counts to the book's final only if it is not already there
		if (amountShown < payout) {
			const from = amountShown;
			const t0 = performance.now();
			await new Promise<void>((resolve) => {
				const step = () => {
					const q = Math.min(1, (performance.now() - t0) / MAX_WIN.amountCountMs);
					// rounded: a book amount is an integer, and a fractional one formats as $15,204.4445
					amountShown = Math.round(from + (payout - from) * q);
					if (q < 1) requestAnimationFrame(step);
					else {
						amountShown = payout;
						resolve();
					}
				};
				step();
			});
		}

		// ---- the gate: shut until the track has actually ended ----
		await maxWinTrackEnded();
		maxWinState.phase = 'gate';
		gateArmed = true;
		await Promise.race([
			waitForResolve((resolve) => (oncomplete = resolve)),
			waitForTimeout(MAX_WIN.autoAdvanceMs),
		]);
		gateArmed = false;
		show = false;
		slammed = false;
		taePhase = 'idle';
		done?.();
	};

	/** start the screen's run once per clock start (idempotent) */
	const ensureRunning = () => {
		if (maxWinState.startedAt === 0 || running) return;
		running = true;
		donePromise = new Promise<void>((resolve) => (done = resolve));
		void run();
	};
	// the normal path: the MAX plate's landing (WinStinger -> maxWinBegin) starts the clock and
	// this effect picks it up on the next flush
	$effect(() => {
		void maxWinState.startedAt;
		ensureRunning();
	});

	context.eventEmitter.subscribeOnMount({
		maxWinCinematicPlay: async (emitterEvent) => {
			// By the time the book reaches this event the screen is normally already running (the
			// MAX plate started it). Safety net for any path that arrives without that landing (a
			// forced or resumed book): start the clock, the track and the HUD hide from here.
			if (maxWinState.startedAt === 0) {
				await context.eventEmitter.broadcastAsync({ type: 'uiHide' });
				maxWinBegin(emitterEvent.payout);
			}
			// SYNCHRONOUSLY: the effect above only runs on the next flush, and awaiting a promise
			// that does not exist yet returned at once and reset the clock under the running screen
			// (caught by the wincap playthrough 2026-09-15)
			ensureRunning();
			payout = emitterEvent.payout; // the book's own number always wins
			await donePromise;
			running = false;
			// the wrap-up (bonusEnd / freeSpinEnd) takes it from here; its uiShow clears the deep hide
			maxWinReset();
		},
	});
</script>

<!-- persistent + always mounted: a lazy mount would join the stage LAST and land over whatever
     must cover it (the conditional-mount z-order trap). Everything inside toggles visible/alpha. -->
<FadeContainer persistent {show} duration={MAX_WIN.dimFadeMs}>
	<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={MAX_WIN.dimAlpha} />

	<!-- the rain sits BEHIND the titles: template order is z-order for always-mounted nodes -->
	<MainContainer>
		<TrayRain {t} visible={show} />
	</MainContainer>

	<MainContainer>
		<!-- THEY ATE EVERYTHING — two lines, sized from this LayoutKind's master so it fills
		     desktop, phone-sideways and portrait alike. It recedes (shrinks and lifts) rather than
		     leaving, so both titles stay legible under the MAX slam. -->
		<Container
			x={master.width * 0.5}
			y={master.height * (L.taeY + (L.taeSmallY - L.taeY) * recede)}
			scale={1 + (L.taeSmallScale - 1) * recede}
			visible={show}
		>
			<!-- mounted only while the screen is up: BrandedTitle's idle wave holds a permanent
			     requestAnimationFrame and rewrites a $state cell per glyph per frame, so an
			     always-mounted title ran that loop for the whole session and starved the reels
			     (caught on the probe 2026-09-15). Its wrapper Container is what stays mounted, so
			     the z-order of the two titles is still fixed by template order. -->
			{#if show}
				<BrandedTitle lines={['THEY ATE', 'EVERYTHING']} height={L.taeHeight} maxWidth={L.taeWidth} tier={3} phase={taePhase} />
			{/if}
		</Container>

		<!-- the MAX WIN slam, tier 4 with the glint, over everything -->
		<Container x={master.width * 0.5} y={master.height * L.maxY} visible={show && slammed}>
			{#if slammed}
				<BrandedTitle lines={['MAX WIN']} height={L.maxHeight} maxWidth={L.maxWidth} tier={4} phase="enter" glint />
			{/if}
		</Container>

		<!-- the payout, then the same payout as a bet multiple -->
		<Container x={master.width * 0.5} visible={show && slammed}>
			{#if artAmountSupports(payoutText)}
				<ArtAmount y={master.height * L.amountY} text={payoutText} reserve={bookEventAmountToCurrencyString(payout)} height={L.amountHeight} maxWidth={L.amountWidth} />
			{:else}
				<!-- a currency mark the stencil atlas cannot draw (zl/dong/won): the whole string as
				     styled text, raised height/2 because ArtAmount's y is a baseline, GameText centres -->
				<GameText y={master.height * L.amountY - L.amountHeight / 2} text={payoutText} size={L.amountHeight} maxWidth={L.amountWidth} />
			{/if}
			<ArtAmount y={master.height * L.multY} text={multiplierText} height={L.multHeight} maxWidth={L.multWidth} />
		</Container>
	</MainContainer>

	<!-- the gate only exists once the track has ended: until then nothing here takes a press and
	     stateGame.pressGates stays 0, so the round cannot be skipped through the whole screen -->
	{#if gateArmed}
		<PressToContinue showText onpress={() => oncomplete()} />
	{/if}
</FadeContainer>
