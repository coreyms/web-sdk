<script lang="ts" module>
	import type { BonusMode, PayingSymbolName } from '../game/types';

	export type EmitterEventSessionSummary = {
		type: 'sessionSummaryShow';
		mode: BonusMode;
		totalSessionWin: number;
		spinsPlayed: number;
		symbolsEaten: number;
		eatenList: PayingSymbolName[];
	};
</script>

<script lang="ts">
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { Sprite, Container } from 'pixi-svelte';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { autoBonusesRunning } from '../game/stateGame.svelte';
	import { BONUS_MODE_HEADER } from '../game/constants';
	import ArtAmount from './ArtAmount.svelte';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();
	let show = $state(false);
	let data = $state<Omit<EmitterEventSessionSummary, 'type'> | null>(null);
	let oncomplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		sessionSummaryShow: async (emitterEvent) => {
			data = emitterEvent;
			show = true;
			// gated on player input (Corey 2026-08-30) — the door holds until they press. A running
			// autoplay with AUTOPLAY BONUSES on presses for them ~1s after the summary is ready.
			const pressed = waitForResolve((resolve) => (oncomplete = resolve));
			await (autoBonusesRunning() ? Promise.race([pressed, waitForTimeout(1000)]) : pressed);
			show = false;
		},
	});
</script>

<FadeContainer {show}>
	<!-- no dim backdrop: the closed steel door IS the backdrop (Corey 2026-08-30) -->
	{#if data}
		<MainContainer>
			{@const w = context.stateLayoutDerived.mainLayout().width}
			{@const h = context.stateLayoutDerived.mainLayout().height}
			<Container x={w * 0.5} y={h * 0.42} scale={Math.min(1, w / 800)}>
				<!-- Corey's COMPLETE stamp will overlay this header when it lands -->
				<Sprite key={BONUS_MODE_HEADER[data.mode]} anchor={0.5} y={-205} scale={0.62} />
				<ArtAmount y={-110} text={`${data.spinsPlayed} SPIN${data.spinsPlayed === 1 ? '' : 'S'} - ${data.symbolsEaten} SYMBOL${data.symbolsEaten === 1 ? '' : 'S'} EATEN`} height={30} maxWidth={700} />
				{#each data.eatenList as symbol, i (symbol)}
					<Sprite anchor={0.5} x={(i - (data.eatenList.length - 1) / 2) * 80} y={-20} width={70} height={70} key="{symbol}_eaten.png" />
				{/each}
				<ArtAmount y={110} text={bookEventAmountToCurrencyString(data.totalSessionWin)} height={72} maxWidth={700} />
			</Container>
		</MainContainer>
	{/if}
	<PressToContinue showText onpress={() => oncomplete()} />
</FadeContainer>
