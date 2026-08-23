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
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { Sprite, Container } from 'pixi-svelte';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import GameText from './GameText.svelte';
	import { BONUS_MODE_LABEL } from '../game/constants';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();
	let show = $state(false);
	let data = $state<Omit<EmitterEventSessionSummary, 'type'> | null>(null);
	let oncomplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		sessionSummaryShow: async (emitterEvent) => {
			data = emitterEvent;
			show = true;
			// auto-advance after a short hold; a tap (PressToContinue) skips it
			await Promise.race([waitForResolve((resolve) => (oncomplete = resolve)), waitForTimeout(3200)]);
			show = false;
		},
	});
</script>

<FadeContainer {show}>
	<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.7} />
	{#if data}
		<MainContainer>
			{@const w = context.stateLayoutDerived.mainLayout().width}
			{@const h = context.stateLayoutDerived.mainLayout().height}
			<Container x={w * 0.5} y={h * 0.42} scale={Math.min(1, w / 800)}>
				<GameText y={-200} text={`${BONUS_MODE_LABEL[data.mode]} COMPLETE`}  preset="gold" size={56} />
				<GameText y={-110} text={`${data.spinsPlayed} SPIN${data.spinsPlayed === 1 ? '' : 'S'}  -  ${data.symbolsEaten} SYMBOL${data.symbolsEaten === 1 ? '' : 'S'} EATEN`}  preset="silver" size={32} />
				{#each data.eatenList as symbol, i (symbol)}
					<Sprite anchor={0.5} x={(i - (data.eatenList.length - 1) / 2) * 80} y={-20} width={70} height={70} key="{symbol}_eaten.png" />
				{/each}
				<GameText y={110} text={bookEventAmountToCurrencyString(data.totalSessionWin)}  preset="gold" size={72} />
			</Container>
		</MainContainer>
	{/if}
	<PressToContinue onpress={() => oncomplete()} />
</FadeContainer>
