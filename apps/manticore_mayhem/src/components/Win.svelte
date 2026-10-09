<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData }
		| { type: 'winHide' };
</script>

<script lang="ts">
	// The base-game win presentation.
	//   BIG WIN AND ABOVE (level type 'big'): the animated win plaque (components/StingerPlaque.svelte) slams
	//     in, counts the amount with the house pacing and steps its title up through the tiers the amount
	//     crosses, never past the book's own level. A press while it counts lands on the final amount and
	//     tier; then the press-to-continue gate, as before (no gate while auto bonuses run).
	//   ANYTHING SMALLER: the plain dim, tier word and count-up below, unchanged. It is also what a Big Win
	//     falls back to if the plaque's art never arrived.
	// This component still owns the events, the gate and stateGame.winShowing in both cases.
	// The AMOUNT is always the book's; only the tier word is derived, and only for presentation.
	import { Rectangle } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	// SteadyTween, not svelte/motion's Tween: that one leaks a task per set() (game/tween.svelte.ts)
	import { SteadyTween as Tween } from '../game/tween.svelte';
	import { cubicOut } from 'svelte/easing';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { awaitDeferredAssets } from '../game/assetGate';
	import { STINGER_PLAQUE } from '../game/constants';
	import { WIN_TIER_SOUND, WIN_TIER_STAGES } from '../game/winLevelMap';
	import { autoBonusesRunning } from '../game/stateGame.svelte';
	import { stingerPlaque } from './StingerPlaque.svelte';
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
	// the plaque is carrying this win (nothing of the plain screen is drawn), and its amount is still counting
	let viaPlaque = $state(false);
	let counting = $state(false);
	let presentation = 0; // a winHide that finishes after the next winShow must not hide it
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
			presentation += 1;
			show = true;
			void dim.set(0.55);
		},
		winUpdate: async ({ amount, winLevelData }) => {
			const big = winLevelData.type === 'big';
			const tier = Math.max(0, WIN_TIER_STAGES.findIndex((s) => s.alias === winLevelData.alias));
			// the plaque's atlases are deferred assets: only a Big Win and above waits for them
			if (big) await awaitDeferredAssets();
			const flow = big ? stingerPlaque.flow : null;
			if (flow?.ready()) {
				viaPlaque = true;
				void dim.set(0, { duration: 0 }); // the plaque brings its own scene dim
				counting = true;
				await flow.win({ amount, finalTier: tier, durationMs: winLevelData.presentDuration / context.stateGameDerived.timeScale() });
				counting = false;
				if (!autoBonusesRunning()) {
					gated = true;
					await waitForResolve((resolve) => (resolveGate = resolve));
					gated = false;
				} else {
					await waitForTimeout(STINGER_PLAQUE.winAutoHoldMs);
				}
				return;
			}
			// the plain screen has no tier landings: a Big Win shown here plays its own tier's clip once
			if (big) context.eventEmitter.broadcast({ type: 'soundOnce', name: WIN_TIER_SOUND[tier] });
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
			if (viaPlaque) {
				const mine = presentation;
				counting = false;
				// the text fades and the plaque lifts out; the round has already moved on, as with the plain fade
				await stingerPlaque.flow?.hide();
				if (mine !== presentation) return;
				viaPlaque = false;
				show = false;
				return;
			}
			await dim.set(0, { duration: 240 });
			// a superseded SteadyTween set() resolves early: only hide if nothing re-showed meanwhile
			if (dim.target === 0) show = false;
		},
	});
</script>

{#if show && !viaPlaque}
	<MainContainer>
		<Rectangle width={master.width} height={master.height} backgroundColor={0x05060a} alpha={dim.current} />
		{#if title}
			<ArtAmount text={title} height={master.height * 0.09} x={master.width / 2} y={master.height * 0.44} maxWidth={master.width * 0.8} tint={0xe0b64a} />
		{/if}
		<CountUpText amount={counted.current} {target} settled={counted.current === target} size={master.height * 0.1} x={master.width / 2} y={master.height * 0.58} maxWidth={master.width * 0.8} />
	</MainContainer>
{/if}

<!-- a press while the plaque counts lands the amount; once it has landed, the press continues -->
{#if counting || (gated && resolveGate)}
	<PressToContinue showText={gated} onpress={() => (counting ? stingerPlaque.flow?.skip() : dismiss())} />
{/if}
