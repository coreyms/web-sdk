<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		| { type: 'freeSpinOutroHide' }
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	// End-of-feature total win (text-based; replaces the Mining Mayhem fsOutro Spine + sprites).
	import { Container } from 'pixi-svelte';
	import { FadeContainer, WinCountUpProvider } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { stateBetDerived } from 'state-shared';
	import { BONUS_MODE_LABEL } from '../game/constants';
	import PressToContinue from './PressToContinue.svelte';
	import GameText from './GameText.svelte';
	import CountUpText from './CountUpText.svelte';

	const context = getContext();

	let show = $state(true);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});
	const pop = new Tween(0.6, { duration: 420, easing: backOut });

	context.eventEmitter.subscribeOnMount({
		freeSpinOutroShow: () => {
			show = true;
			pop.set(0.6, { duration: 0 });
			pop.set(1);
		},
		freeSpinOutroHide: async () => (show = false),
		freeSpinOutroCountUp: async (emitterEvent) => {
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});

	const master = $derived(context.stateLayoutDerived.mainLayout());
	const textScale = $derived(Math.min(1, master.width / 800));
	const title = $derived(`${BONUS_MODE_LABEL[context.stateGame.bonusMode] ?? 'FREE SPINS'} COMPLETE`);
</script>

<FadeContainer {show}>
	{#if winLevelData}
		{@const duration = Math.max(1200, winLevelData.presentDuration / stateBetDerived.timeScale())}
		<WinCountUpProvider {amount} {duration} oncomplete={() => {}}>
			{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
				<OnMount onmount={() => startCountUp()} />
				<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.6} />
				<MainContainer>
					<Container x={master.width * 0.5} y={master.height * 0.45} scale={pop.current * textScale}>
						<GameText text={title} preset="gold" size={64} y={-110} maxWidth={760} />
						<GameText text="TOTAL WIN" preset="silver" size={28} y={-30} extra={{ letterSpacing: 6 }} />
						<CountUpText amount={countUpAmount} settled={countUpCompleted} preset="gold" size={96} y={50} maxWidth={760} />
					</Container>
				</MainContainer>
				<PressToContinue showText onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())} />
			{/snippet}
		</WinCountUpProvider>
	{/if}
</FadeContainer>
