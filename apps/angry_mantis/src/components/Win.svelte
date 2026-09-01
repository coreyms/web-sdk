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
	// one presentation per winUpdate: the {#key} below rebuilds the provider/OnMount subtree even
	// when the previous fade-out hasn't cleared winLevelData yet (the persistent FadeContainer no
	// longer unmounts it for us) — a remount-armed count-up would otherwise never start and the
	// awaited winUpdate would never resolve (turbo/backgrounded autoplay stalled forever)
	let presentId = $state(0);
	let oncomplete = $state(() => {});
	const pop = new Tween(0.6, { duration: 420, easing: backOut });

	// money-counter is a rhythmic ~0.78 s tick bed, so it runs as a loop for as long as the amount is
	// climbing (see the OnMount below). bookEventHandlerMap's winLevelSoundsStop also stops it as a
	// backstop, in case a presentation is superseded before its count-up ever resolves.
	const countSound = (type: 'soundLoop' | 'soundStop') =>
		context.eventEmitter.broadcast({ type, name: 'sfx_money_counter' });

	context.eventEmitter.subscribeOnMount({
		winShow: () => (show = true),
		winHide: () => (show = false),
		winUpdate: async (emitterEvent) => {
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			presentId += 1;
			pop.set(0.6, { duration: 0 });
			pop.set(1);
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});

	const layout = $derived(context.stateGameDerived.boardLayout());
	const master = $derived(context.stateLayoutDerived.mainLayout());
	const textScale = $derived(Math.min(1, master.width / 800));
</script>

<!-- persistent: the container claims its Game.svelte template slot at game start and keeps it —
     a lazy (re)mount joins the stage LAST, above layers that must cover it (z-order trap) -->
<FadeContainer
	persistent
	{show}
	oncomplete={() => {
		// drop the presentation only once the fade-OUT settles (a superseded fade's promise never
		// resolves, and the guard re-checks, so a winShow overlap can't wipe the incoming one);
		// while empty, the subtree's press rect and hotkey are gone too
		if (!show) winLevelData = undefined;
	}}
>
	{#key presentId}
		{#if winLevelData}
			{@const isBigWin = winLevelData.type === 'big'}
			{@const finalAlias = winLevelData.alias}
			{@const duration = winLevelData.presentDuration / stateBetDerived.timeScale()}
			<StagedCountUpProvider {amount} {duration}>
				{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
					{#if isBigWin}
						<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.6} />
					{/if}

					<OnMount
						onmount={async () => {
							const done = oncomplete; // pin to THIS presentation — a stale chain must not resolve a future one
							// the ticking money loop belongs to the big-win staging only — a small win's short
							// count stays dry. startCountUp() resolves on a natural settle AND on a press-to-skip
							// (finishCountUp interrupts it), so this one stop covers both exits.
							if (isBigWin) countSound('soundLoop');
							await startCountUp();
							if (isBigWin) countSound('soundStop');
							await waitForTimeout(isBigWin ? 1400 : 300);
							done();
						}}
					/>
					<!-- tap while the amount is counting = jump to the final amount -->
					<PressToContinue onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())} />

					<MainContainer>
						{#if isBigWin}
							<Container x={master.width * 0.5} y={master.height * 0.45} scale={pop.current * textScale}>
								<StagedWinTitle amount={countUpAmount} {finalAlias} size={88} y={-80} />
								<CountUpText amount={countUpAmount} target={amount} settled={countUpCompleted} preset="silver" size={72} y={68} maxWidth={760} />
							</Container>
						{:else}
							<!-- same anchor + size as the big-win amount so every win pop reads consistent -->
							<Container x={master.width * 0.5} y={master.height * 0.45} scale={pop.current * textScale}>
								<CountUpText amount={countUpAmount} target={amount} settled={countUpCompleted} preset="gold" size={72} maxWidth={520} />
							</Container>
						{/if}
					</MainContainer>

				{/snippet}
			</StagedCountUpProvider>
		{/if}
	{/key}
</FadeContainer>
