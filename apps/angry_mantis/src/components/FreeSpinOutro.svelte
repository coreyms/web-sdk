<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		| { type: 'freeSpinOutroHide' }
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	// End-of-feature total win (text-based; replaces the Mining Mayhem fsOutro Spine + sprites).
	import { Container, Sprite } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { autoBonusesRunning } from '../game/stateGame.svelte';
	import { stateBetDerived } from 'state-shared';
	import { BONUS_MODE_HEADER } from '../game/constants';
	import PressToContinue from './PressToContinue.svelte';
	import GameText from './GameText.svelte';
	import CountUpText from './CountUpText.svelte';
	import StagedWinTitle from './StagedWinTitle.svelte';
	import StagedCountUpProvider from './StagedCountUpProvider.svelte';
	import { WIN_TIER_STAGES_END_FEATURE } from '../game/winLevelMap';

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

	// AUTOPLAY BONUSES: a running autoplay presses on for the player 1s AFTER the count-up has
	// settled (startCountUp resolves once countUpCompleted is set, finishCountUp interrupts
	// included) — the total-win count is never cut short
	const autoContinueAfterCountUp = async () => {
		if (!autoBonusesRunning()) return;
		const press = oncomplete; // pin to this outro's gate — a late timer must not press a future one
		await waitForTimeout(1000);
		press();
	};

	const master = $derived(context.stateLayoutDerived.mainLayout());
	const textScale = $derived(Math.min(1, master.width / 800));
</script>

<FadeContainer {show}>
	{#if winLevelData}
		{@const duration = Math.max(1200, winLevelData.presentDuration / stateBetDerived.timeScale())}
		<StagedCountUpProvider {amount} {duration} stages={WIN_TIER_STAGES_END_FEATURE}>
			{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
				<OnMount onmount={() => startCountUp().then(autoContinueAfterCountUp)} />
				<!-- no dim backdrop: the closed steel door IS the backdrop (Corey 2026-08-30) -->
				<MainContainer>
					<Container x={master.width * 0.5} y={master.height * 0.45} scale={pop.current * textScale}>
						<!-- Corey's COMPLETE stamp will overlay this header when it lands -->
						<Sprite key={BONUS_MODE_HEADER[context.stateGame.bonusMode] ?? 'labelBonus'} anchor={0.5} y={-160} scale={0.62} />
						{#if winLevelData?.type === 'big'}
							<StagedWinTitle amount={countUpAmount} finalAlias={winLevelData?.alias ?? 'big'} stages={WIN_TIER_STAGES_END_FEATURE} size={52} y={-55} />
						{:else}
							<GameText text="TOTAL WIN" preset="silver" size={28} y={-55} extra={{ letterSpacing: 6 }} />
						{/if}
						<CountUpText amount={countUpAmount} settled={countUpCompleted} preset="gold" size={72} y={45} maxWidth={720} />
					</Container>
				</MainContainer>
				<PressToContinue showText onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())} />
			{/snippet}
		</StagedCountUpProvider>
	{/if}
</FadeContainer>
