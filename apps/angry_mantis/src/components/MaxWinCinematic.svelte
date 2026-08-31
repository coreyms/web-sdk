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
	import ArtAmount, { artAmountSupports } from './ArtAmount.svelte';
	import { TIMINGS, BOARD_DIMENSIONS } from '../game/constants';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();
	let show = $state(false);
	let payout = $state(0);
	let cellsEaten = $state(0);
	let roar = $state(false);
	let oncomplete = $state(() => {});
	const walk = new Tween(0, { duration: TIMINGS.maxWinWalkOn, easing: cubicOut });
	const payoutText = $derived(bookEventAmountToCurrencyString(payout));

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
			<!-- same character headshots as the feast BonusIntro (Marky left, Marty right), sliding
			     in from their edges; text stacks BELOW them so nothing collides (Corey 2026-08-29) -->
			{#if roar}
				<Sprite key="textMaxWinBang" anchor={0.5} y={-250} scale={0.68} />
			{:else}
				<Sprite key="textTheyAteEverything" anchor={0.5} y={-250} scale={0.5} />
			{/if}
			<Sprite anchor={0.5} x={-130 - w * 0.35 * (1 - walk.current)} y={-60} width={220} height={220} key="markyHeadshot" />
			<Sprite anchor={0.5} x={130 + w * 0.35 * (1 - walk.current)} y={-60} width={220} height={220} key="martyHeadshot" />
			{#if !roar}
				<ArtAmount y={120} text={`${cellsEaten} / ${BOARD_DIMENSIONS.x * BOARD_DIMENSIONS.y}`} height={48} />
			{:else}
				{#if artAmountSupports(payoutText)}
					<ArtAmount y={130} text={payoutText} height={80} maxWidth={700} />
				{:else}
					<!-- locale currency outside the stencil glyph set (e.g. zł/₫/₩): styled text, raised
					     height/2 because ArtAmount's y is its baseline while GameText anchors its centre -->
					<GameText y={90} text={payoutText} size={80} maxWidth={700} />
				{/if}
				<ArtAmount y={215} text="20000x" height={40} />
			{/if}
		</Container>
	</MainContainer>
	{#if roar}
		<PressToContinue onpress={() => oncomplete()} />
	{/if}
</FadeContainer>
