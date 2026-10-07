<script lang="ts" module>
	export type EmitterEventSpinWin =
		/** the step is over: SNAP to the book's cascade.spinWin (the running steps already got here) */
		| { type: 'spinWinShow'; amount: number }
		/** a cluster's count-up landed: the running number jumps to `amount` and bumps */
		| { type: 'spinWinStep'; amount: number }
		/** the last refill of the spin is down: the final presentation (SPIN_TOTAL), awaited */
		| { type: 'spinWinFinal'; amount: number }
		| { type: 'spinWinHide' };
</script>

<script lang="ts">
	// The running total of the spin being cascaded (cascade.spinWin). It is NOT the round total —
	// the HUD's WIN readout owns that — so it sits under the board and clears on the next reveal.
	//
	// MOTION PASS 1: the number is the previous step's spinWin plus each cluster's win as its count-up
	// lands (spinWinStep, with a bump), SNAPPED to the book's cascade.spinWin at the end of the step
	// (spinWinShow), and after the spin's last refill the final presentation (spinWinFinal: delay,
	// rise to finalScale, count, hold; finalRiseMs 0 and finalCountMs 0 mean it just sits). Every
	// duration is style time divided by timeScale; while a skip runs they all collapse to 0.
	import { MainContainer } from 'components-layout';
	// SteadyTween, not svelte/motion's Tween: that one leaks a task per set() (game/tween.svelte.ts)
	import { SteadyTween as Tween } from '../game/tween.svelte';
	import { cubicOut } from 'svelte/easing';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { HUD, layoutKind, boardCenterX, spinWinY } from '../game/layoutSpec';
	import { TIMINGS, SPIN_TOTAL } from '../game/constants';
	import ArtAmount from './ArtAmount.svelte';

	const context = getContext();
	const slot = $derived(HUD[layoutKind(context.stateLayoutDerived.layoutType())].spinWin);
	const master = $derived(context.stateLayoutDerived.mainLayout());
	const vw = $derived(context.stateLayoutDerived.canvasSizes().width / master.scale);
	const cx = $derived(boardCenterX(layoutKind(context.stateLayoutDerived.layoutType()), vw));
	const sy = $derived(spinWinY(layoutKind(context.stateLayoutDerived.layoutType()), vw));

	const alpha = new Tween(0, { duration: 180, easing: cubicOut });
	const amount = new Tween(0, { duration: 0 });
	// the bump / final-rise scale, 0..1 of its curve; the scale is derived so the curve stays here
	const bump = new Tween(0, { duration: 0 });
	const rise = new Tween(0, { duration: 0 });
	let finalScale = $state(1);

	/** a style duration in real ms; 0 while SKIP TO RESULT runs */
	const real = (ms: number) => (context.stateGame.skipping ? 0 : ms / Math.max(0.2, context.stateGameDerived.timeScale()));
	// the bump is a sine over bumpMs: a 0 -> 1 linear tween, read through sin(pi t)
	const sine = (t: number) => Math.sin(Math.PI * t);
	let finalRun = 0;

	context.eventEmitter.subscribeOnMount({
		spinWinStep: ({ amount: value }) => {
			void alpha.set(1, { duration: real(180) });
			amount.set(value, { duration: 0 });
			bump.current = 0;
			void bump.set(1, { duration: real(SPIN_TOTAL.bumpMs) });
		},
		spinWinShow: ({ amount: value }) => {
			void alpha.set(1, { duration: real(180) });
			amount.set(value, { duration: 0 });
		},
		spinWinFinal: async ({ amount: value }) => {
			const run = ++finalRun;
			await waitForTimeout(Math.max(1, real(SPIN_TOTAL.finalDelayMs)));
			if (run !== finalRun) return;
			void alpha.set(1, { duration: real(180) });
			finalScale = SPIN_TOTAL.finalScale;
			rise.current = 0;
			void rise.set(1, { duration: real(SPIN_TOTAL.finalRiseMs), easing: SPIN_TOTAL.finalEasing });
			if (SPIN_TOTAL.finalCountMs > 0) {
				amount.current = 0;
				void amount.set(value, { duration: real(SPIN_TOTAL.finalCountMs), delay: real(SPIN_TOTAL.finalRiseMs), easing: cubicOut });
			} else {
				amount.set(value, { duration: 0 });
			}
			await waitForTimeout(Math.max(1, real(SPIN_TOTAL.finalRiseMs + SPIN_TOTAL.finalCountMs + SPIN_TOTAL.finalHoldMs)));
		},
		spinWinHide: () => {
			finalRun += 1;
			void alpha.set(0, { duration: TIMINGS.winClearMs });
			amount.set(0, { duration: 0 });
			bump.set(0, { duration: 0 });
			rise.set(0, { duration: 0 });
			finalScale = 1;
		},
	});

	const scale = $derived(Math.max(1 + (SPIN_TOTAL.bumpScale - 1) * sine(bump.current), 1 + (finalScale - 1) * rise.current));
	const text = $derived(`SPIN ${bookEventAmountToCurrencyString(Math.round(amount.current))}`);
</script>

<MainContainer>
	{#if alpha.current > 0 && !context.stateGame.plaque}
		<ArtAmount text={text} height={slot.height} x={cx} y={sy} maxWidth={slot.width} alpha={alpha.current} {scale} tint={0xe0b64a} />
	{/if}
</MainContainer>
