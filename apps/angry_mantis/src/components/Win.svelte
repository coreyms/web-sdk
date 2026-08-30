<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winHide' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	// Text-based win presentation (temporary, replaces the Mining Mayhem big-win Spine + coin shower).
	// Small/medium: the amount pops over the board. Big+: dimmed screen, tier title, count-up, press to continue.
	import { Container } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';

	import PressToContinue from './PressToContinue.svelte';
	import StagedWinTitle from './StagedWinTitle.svelte';
	import StagedCountUpProvider from './StagedCountUpProvider.svelte';
	import CountUpText from './CountUpText.svelte';
	import { getContext } from '../game/context';
	import { stateBetDerived } from 'state-shared';

	const context = getContext();

	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});
	const pop = new Tween(0.6, { duration: 420, easing: backOut });

	context.eventEmitter.subscribeOnMount({
		winShow: () => (show = true),
		winHide: () => (show = false),
		winUpdate: async (emitterEvent) => {
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			pop.set(0.6, { duration: 0 });
			pop.set(1);
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});

	const layout = $derived(context.stateGameDerived.boardLayout());
	const master = $derived(context.stateLayoutDerived.mainLayout());
	const textScale = $derived(Math.min(1, master.width / 800));
</script>

<FadeContainer {show}>
	{#if winLevelData}
		{@const isBigWin = winLevelData.type === 'big'}
		{@const duration = winLevelData.presentDuration / stateBetDerived.timeScale()}
		<StagedCountUpProvider {amount} {duration}>
			{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
				{#if isBigWin}
					<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.6} />
				{/if}

				<OnMount
					onmount={async () => {
						await startCountUp();
						await waitForTimeout(isBigWin ? 1400 : 300);
						oncomplete();
					}}
				/>
				<!-- tap while the amount is counting = jump to the final amount -->
				<PressToContinue onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())} />

				<MainContainer>
					{#if isBigWin}
						<Container x={master.width * 0.5} y={master.height * 0.45} scale={pop.current * textScale}>
							<StagedWinTitle amount={countUpAmount} finalAlias={winLevelData.alias} size={110} y={-85} />
							<CountUpText amount={countUpAmount} settled={countUpCompleted} preset="silver" size={72} y={62} maxWidth={760} />
						</Container>
					{:else}
						<Container x={layout.x} y={layout.y} scale={pop.current * layout.scale}>
							<CountUpText amount={countUpAmount} settled={countUpCompleted} preset="gold" size={96} maxWidth={520} />
						</Container>
					{/if}
				</MainContainer>

			{/snippet}
		</StagedCountUpProvider>
	{/if}
</FadeContainer>
