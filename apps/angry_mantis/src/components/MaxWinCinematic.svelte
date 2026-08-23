<script lang="ts" module>
	export type EmitterEventMaxWinCinematic = { type: 'maxWinCinematicPlay'; payout: number };
</script>

<script lang="ts">
	// Placeholder for spec §12 max-win cinematic: walk-on, per-cell eating, centre roar.
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { Sprite, Container } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { waitForTimeout, waitForResolve } from 'utils-shared/wait';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import GameText from './GameText.svelte';
	import { TIMINGS, BOARD_DIMENSIONS } from '../game/constants';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();
	let show = $state(false);
	let payout = $state(0);
	let cellsEaten = $state(0);
	let roar = $state(false);
	let oncomplete = $state(() => {});
	const walk = new Tween(0, { duration: TIMINGS.maxWinWalkOn, easing: cubicOut });

	context.eventEmitter.subscribeOnMount({
		maxWinCinematicPlay: async (emitterEvent) => {
			payout = emitterEvent.payout;
			cellsEaten = 0;
			roar = false;
			show = true;
			await walk.set(1);
			const total = BOARD_DIMENSIONS.x * BOARD_DIMENSIONS.y;
			for (let i = 0; i < total; i++) {
				cellsEaten = i + 1;
				await waitForTimeout(TIMINGS.maxWinPerCell);
			}
			roar = true;
			await waitForTimeout(TIMINGS.maxWinRoar);
			// auto-advance after a short hold; a tap (PressToContinue) skips it
			await Promise.race([waitForResolve((resolve) => (oncomplete = resolve)), waitForTimeout(3500)]);
			show = false;
			walk.set(0, { duration: 0 });
		},
	});
</script>

<FadeContainer {show}>
	<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.85} />
	<MainContainer>
		{@const w = context.stateLayoutDerived.mainLayout().width}
		{@const h = context.stateLayoutDerived.mainLayout().height}
		<Container x={w * 0.5} y={h * 0.42} scale={Math.min(1, w / 800)}>
			<Sprite anchor={0.5} x={-w * 0.35 * (1 - walk.current) - 200} y={0} width={240} height={240} key="marty_strike.png" />
			<Sprite anchor={0.5} x={w * 0.35 * (1 - walk.current) + 200} y={0} width={240} height={240} key="marky_strike.png" />
			<GameText
				y={-230}
				text={roar ? 'MAX WIN!' : 'EVERYTHING IS EATEN...'}
			 preset="gold" size={roar ? 96 : 56} />
			{#if !roar}
				<GameText y={0} text={`${cellsEaten} / ${BOARD_DIMENSIONS.x * BOARD_DIMENSIONS.y}`}  preset="silver" size={48} />
			{:else}
				<GameText y={0} text={bookEventAmountToCurrencyString(payout)}  preset="gold" size={80} />
				<GameText y={90} text="20000X"  preset="silver" size={40} />
			{/if}
		</Container>
	</MainContainer>
	{#if roar}
		<PressToContinue onpress={() => oncomplete()} />
	{/if}
</FadeContainer>
