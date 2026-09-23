<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData }
		| { type: 'winHide' };
</script>

<script lang="ts">
	// The base-game win presentation: a dim, the tier word and a count-up. Milestone 1 has no
	// stinger plates and no cinematic — this is the whole thing.
	// The AMOUNT is always the book's; only the tier word is derived, and only for presentation.
	import { Rectangle } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { autoBonusesRunning } from '../game/stateGame.svelte';
	import CountUpText from './CountUpText.svelte';
	import ArtAmount from './ArtAmount.svelte';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();
	const master = $derived(context.stateLayoutDerived.mainLayout());

	let show = $state(false);
	let title = $state('');
	let target = $state(0);
	let gated = $state(false);
	let resolveGate: (() => void) | null = $state(null);
	const dim = new Tween(0, { duration: 260, easing: cubicOut });
	const counted = new Tween(0, { duration: 900, easing: cubicOut });

	const dismiss = () => {
		const r = resolveGate;
		resolveGate = null;
		r?.();
	};

	$effect(() => {
		context.stateGame.winShowing = show;
	});

	context.eventEmitter.subscribeOnMount({
		winShow: () => {
			show = true;
			void dim.set(0.55);
		},
		winUpdate: async ({ amount, winLevelData }) => {
			title = winLevelData.text ?? '';
			target = amount;
			counted.set(0, { duration: 0 });
			await counted.set(amount, { duration: Math.max(600, winLevelData.presentDuration) });
			// a big win holds on a press; anything smaller just breathes and goes
			if (winLevelData.type === 'big' && !autoBonusesRunning()) {
				gated = true;
				await waitForResolve((resolve) => (resolveGate = resolve));
				gated = false;
			} else {
				await waitForTimeout(400);
			}
		},
		winHide: async () => {
			dismiss();
			await dim.set(0, { duration: 240 });
			show = false;
		},
	});
</script>

{#if show}
	<MainContainer>
		<Rectangle width={master.width} height={master.height} backgroundColor={0x05060a} alpha={dim.current} />
		{#if title}
			<ArtAmount text={title} height={master.height * 0.09} x={master.width / 2} y={master.height * 0.44} maxWidth={master.width * 0.8} tint={0xe0b64a} />
		{/if}
		<CountUpText amount={counted.current} {target} settled={counted.current === target} size={master.height * 0.1} x={master.width / 2} y={master.height * 0.58} maxWidth={master.width * 0.8} />
	</MainContainer>
{/if}

{#if gated && resolveGate}
	<PressToContinue showText onpress={dismiss} />
{/if}
