<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData }
		| { type: 'freeSpinOutroHide' };
</script>

<script lang="ts">
	// The feature wrap-up: how many spins were played and what the whole session paid. Plain, like
	// the mode plaque — the cinematic version is a later milestone.
	import { Rectangle } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { waitForResolve } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { autoBonusesRunning } from '../game/stateGame.svelte';
	import { BONUS_MODE_LABEL } from '../game/constants';
	import CountUpText from './CountUpText.svelte';
	import ArtAmount from './ArtAmount.svelte';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();
	const master = $derived(context.stateLayoutDerived.mainLayout());
	const recap = $derived(context.stateGame.sessionRecap);

	let show = $state(false);
	let target = $state(0);
	let resolveGate: (() => void) | null = $state(null);
	const dim = new Tween(0, { duration: 280, easing: cubicOut });
	const counted = new Tween(0, { duration: 1200, easing: cubicOut });

	const dismiss = () => {
		const r = resolveGate;
		resolveGate = null;
		r?.();
	};

	context.eventEmitter.subscribeOnMount({
		freeSpinOutroShow: async () => {
			show = true;
			await dim.set(0.68);
		},
		freeSpinOutroCountUp: async ({ amount, winLevelData }) => {
			target = amount;
			counted.set(0, { duration: 0 });
			await counted.set(amount, { duration: Math.max(900, winLevelData.presentDuration) });
			if (!autoBonusesRunning()) await waitForResolve((resolve) => (resolveGate = resolve));
		},
		freeSpinOutroHide: async () => {
			dismiss();
			await dim.set(0, { duration: 260 });
			show = false;
		},
	});
</script>

{#if show}
	<MainContainer>
		<Rectangle width={master.width} height={master.height} backgroundColor={0x05060a} alpha={dim.current} />
		<ArtAmount
			text={recap ? BONUS_MODE_LABEL[recap.mode] : 'FREE SPINS'}
			height={master.height * 0.06}
			x={master.width / 2}
			y={master.height * 0.34}
			maxWidth={master.width * 0.8}
			tint={0x9fd9d4}
		/>
		<ArtAmount text="TOTAL WIN" height={master.height * 0.045} x={master.width / 2} y={master.height * 0.44} maxWidth={master.width * 0.6} alpha={0.8} />
		<CountUpText amount={counted.current} {target} settled={counted.current === target} size={master.height * 0.11} x={master.width / 2} y={master.height * 0.58} maxWidth={master.width * 0.84} />
		{#if recap}
			<ArtAmount text="{recap.spinsPlayed} SPINS PLAYED" height={master.height * 0.035} x={master.width / 2} y={master.height * 0.68} maxWidth={master.width * 0.6} alpha={0.7} />
		{/if}
	</MainContainer>
{/if}

{#if resolveGate}
	<PressToContinue showText onpress={dismiss} />
{/if}
