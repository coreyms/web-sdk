<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winHide' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	// Win presentation. Small/medium: the amount pops over the board. Big+: dimmed screen and Corey's
	// tier STINGER plate (WinStinger) carrying the count-up, press to continue.
	import { Container } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';

	import PressToContinue from './PressToContinue.svelte';
	import WinStinger from './WinStinger.svelte';
	import StagedCountUpProvider from './StagedCountUpProvider.svelte';
	import { STINGER_MOTION, STINGER_SMALL_BOX } from '../game/stinger';
	import StingerPlate from './StingerPlate.svelte';
	import { STINGER_SMALL, layoutKind } from '../game/layoutSpec';
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
	let onleft = $state(() => {});
	// a press once the count has settled: cuts the hold short (to a brief beat), never past the exit
	let skipHold = $state(() => {});
	// big+ only: flips true after the hold so the plate plays its drop-out before the fade
	let leaving = $state(false);
	const pop = new Tween(0.6, { duration: 420, easing: backOut });

	// money-counter is a rhythmic ~0.78 s tick bed, so it runs as a loop for as long as the amount is
	// climbing (see the OnMount below). bookEventHandlerMap's winLevelSoundsStop also stops it as a
	// backstop, in case a presentation is superseded before its count-up ever resolves.
	const countSound = (type: 'soundLoop' | 'soundStop') =>
		context.eventEmitter.broadcast({ type, name: 'sfx_money_counter' });

	context.eventEmitter.subscribeOnMount({
		winShow: () => (show = context.stateGame.winShowing = true),
		winHide: () => (show = context.stateGame.winShowing = false),
		winUpdate: async (emitterEvent) => {
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			leaving = false;
			presentId += 1;
			pop.set(0.6, { duration: 0 });
			pop.set(1);
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});

	const layout = $derived(context.stateGameDerived.boardLayout());
	const master = $derived(context.stateLayoutDerived.mainLayout());
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const small = $derived(STINGER_SMALL[kind]);
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
			<!-- the book's own tier, in base-bet multiples, whatever the round cost (Corey 2026-09-09:
			     the same as every other Stake game mid-feature; the wrap-up is where a buy that did
			     not pay for itself is held back — see bookEventHandlerMap freeSpinEnd) -->
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
							// the ticking money loop runs under every count-up that actually counts (Corey
							// 2026-09-08: regular wins were dry); a zero-duration pop has nothing to tick over.
							// startCountUp() resolves on a natural settle AND on a press-to-skip (finishCountUp
							// interrupts it), so this one stop covers both exits.
							const ticks = duration > 0;
							// big+: the plate drops in first, the count starts as it settles
							if (isBigWin) await waitForTimeout(STINGER_MOTION.enter);
							if (ticks) countSound('soundLoop');
							await startCountUp();
							if (ticks) countSound('soundStop');
							// hold on the settled amount; a press shortens it to a brief beat but the plate's
							// exit still plays and the round only continues after it (Corey 2026-09-09: skip
							// to the last card and amount, pause a moment, then carry on)
							const skipped = waitForResolve((resolve) => (skipHold = resolve));
							const beat = isBigWin ? 600 : 150;
							await Promise.race([waitForTimeout(isBigWin ? 1400 : 300), skipped.then(() => waitForTimeout(beat))]);
							if (isBigWin) {
								// drop the plate off the bottom; the fade-out follows (backstop: never wedge on it)
								const left = waitForResolve((resolve) => (onleft = resolve));
								leaving = true;
								await Promise.race([left, waitForTimeout(STINGER_MOTION.exit + 200)]);
							}
							done();
						}}
					/>
					<!-- tap while counting = jump to the final plate and amount; tap after = shorten the hold -->
					<PressToContinue onpress={() => (countUpCompleted ? skipHold() : finishCountUp())} />

					<MainContainer>
						{#if isBigWin}
							<WinStinger amount={countUpAmount} target={amount} {finalAlias} settled={countUpCompleted} {leaving} onleft={() => onleft()} />
						{:else}
							<!-- the plain plate backs every regular win, smaller than the tier plates, popping in
							     as one piece with the cream amount centred on it (Corey 2026-09-09) -->
							<Container x={master.width * 0.5} y={master.height * small.cy} scale={pop.current}>
								<StingerPlate plate="normal" width={master.width * small.w} box={STINGER_SMALL_BOX[kind]} amount={countUpAmount} target={amount} settled={countUpCompleted} />
							</Container>
						{/if}
					</MainContainer>

				{/snippet}
			</StagedCountUpProvider>
		{/if}
	{/key}
</FadeContainer>
