<script lang="ts" module>
	export type EmitterEventSpinWin = { type: 'spinWinShow'; amount: number } | { type: 'spinWinHide' };
</script>

<script lang="ts">
	// The running total of the spin being cascaded (cascade.spinWin). It is NOT the round total —
	// the HUD's WIN readout owns that — so it sits under the board and clears on the next reveal.
	import { MainContainer } from 'components-layout';
	// SteadyTween, not svelte/motion's Tween: that one leaks a task per set() (game/tween.svelte.ts)
	import { SteadyTween as Tween } from '../game/tween.svelte';
	import { cubicOut } from 'svelte/easing';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { HUD, layoutKind, boardCenterX } from '../game/layoutSpec';
	import { TIMINGS } from '../game/constants';
	import ArtAmount from './ArtAmount.svelte';

	const context = getContext();
	const slot = $derived(HUD[layoutKind(context.stateLayoutDerived.layoutType())].spinWin);
	const master = $derived(context.stateLayoutDerived.mainLayout());
	const vw = $derived(context.stateLayoutDerived.canvasSizes().width / master.scale);
	const cx = $derived(boardCenterX(layoutKind(context.stateLayoutDerived.layoutType()), vw));

	const alpha = new Tween(0, { duration: 180, easing: cubicOut });
	const amount = new Tween(0, { duration: 420, easing: cubicOut });

	context.eventEmitter.subscribeOnMount({
		spinWinShow: ({ amount: value }) => {
			// while a skip runs the readout snaps to the book's running total instead of chasing it
			const snap = context.stateGame.skipping ? { duration: 0 } : undefined;
			void alpha.set(1, snap);
			void amount.set(value, snap);
		},
		spinWinHide: () => {
			void alpha.set(0, { duration: TIMINGS.winClearMs });
			amount.set(0, { duration: 0 });
		},
	});

	const text = $derived(`SPIN ${bookEventAmountToCurrencyString(Math.round(amount.current))}`);
</script>

<MainContainer>
	{#if alpha.current > 0 && !context.stateGame.plaque}
		<ArtAmount text={text} height={slot.height} x={cx} y={slot.y} maxWidth={slot.width} alpha={alpha.current} tint={0xe0b64a} />
	{/if}
</MainContainer>
