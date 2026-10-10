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
	//     tier. THERE IS NO PRESS GATE AND NO PROMPT (Corey 2026-10-09: "these should go away naturally"): once
	//     the count has landed the plaque holds STINGER_PLAQUE.winHoldMs (winAutoHoldMs while auto bonuses run)
	//     and leaves by itself; a press during the hold only ends it early. The press catcher stays up, with no
	//     text, from the count until the hide starts, so a press never falls through to the spin button.
	//   ANYTHING SMALLER GETS NO WIN SCREEN AT ALL (Corey 2026-10-09: "no Nice win level"): setTotalWin never
	//     asks for one, so everything here is a Big Win or above.
	//   THE PLAIN SCREEN below (dim, tier word, count up) is ONLY the fallback for a Big Win whose plaque art
	//     never arrived. That fallback is counted and, in DEV, warned about (`__manticore.winScreen()`, read by
	//     tools/manticore/stinger_flow_probe.js): a Big Win without its plaque is a bug to find, not a state to
	//     pass silently. While the win waits for the deferred art only the dim is up (never a plain "0.00").
	//   A FREE SPIN's own Big Win and a base game Max Win come through the same events
	//     (game/bookEventHandlerMap.ts setTotalWin / wincap); nothing here tells them apart.
	// This component still owns the events, the gate and stateGame.winShowing in both cases.
	// The AMOUNT is always the book's; only the tier word is derived, and only for presentation.
	import { Rectangle } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	// SteadyTween, not svelte/motion's Tween: that one leaks a task per set() (game/tween.svelte.ts)
	import { SteadyTween as Tween } from '../game/tween.svelte';
	import { cubicOut } from 'svelte/easing';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';
	import { awaitPlaqueAssets } from '../game/assetGate';
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
	// the count has landed and the screen is holding before it leaves by itself (a press ends the hold early)
	let holding = $state(false);
	let resolveGate: (() => void) | null = $state(null);
	// the plaque is carrying this win (nothing of the plain screen is drawn), and its amount is still counting
	let viaPlaque = $state(false);
	let counting = $state(false);
	// the plain screen's title and count are being drawn (false while a Big Win still waits for the plaque's art)
	let plain = $state(false);
	// Big Wins that had to fall back to the plain screen, and why (DEV probes; must stay empty)
	const fallbacks: { amount: number; alias: string; why: string }[] = [];
	let presentation = 0; // a winHide that finishes after the next winShow must not hide it
	const dim = new Tween(0, { duration: 260, easing: cubicOut });
	const counted = new Tween(0, { duration: 900, easing: cubicOut });

	const dismiss = () => {
		const r = resolveGate;
		resolveGate = null;
		r?.();
	};
	/** the hold after the count: over by itself, or at once on a press. `holding` stays up until winHide. */
	const hold = async () => {
		holding = true;
		await Promise.race([waitForTimeout(autoBonusesRunning() ? STINGER_PLAQUE.winAutoHoldMs : STINGER_PLAQUE.winHoldMs), waitForResolve((resolve) => (resolveGate = resolve))]);
		resolveGate = null;
	};

	$effect(() => {
		context.stateGame.winShowing = show;
	});

	context.eventEmitter.subscribeOnMount({
		winShow: () => {
			presentation += 1;
			plain = false;
			holding = false;
			show = true;
			void dim.set(0.55);
		},
		winUpdate: async ({ amount, winLevelData }) => {
			const tier = Math.max(0, WIN_TIER_STAGES.findIndex((s) => s.alias === winLevelData.alias));
			// the plaque's atlases are deferred assets
			await awaitPlaqueAssets();
			const flow = stingerPlaque.flow;
			if (flow?.ready()) {
				viaPlaque = true;
				void dim.set(0, { duration: 0 }); // the plaque brings its own scene dim
				counting = true;
				await flow.win({ amount, finalTier: tier, durationMs: winLevelData.presentDuration / context.stateGameDerived.timeScale() });
				counting = false;
				await hold();
				return;
			}
			// THE FALLBACK. The plain screen has no tier landings: the win's own tier clip plays once
			const why = !flow ? 'the plaque is not mounted' : 'the plaque art or its motion data is not in (deferred assets timed out or failed)';
			fallbacks.push({ amount, alias: winLevelData.alias, why });
			if (import.meta.env.DEV) console.warn(`[manticore] a ${winLevelData.alias} win fell back to the plain screen: ${why}`);
			context.eventEmitter.broadcast({ type: 'soundOnce', name: WIN_TIER_SOUND[tier] });
			plain = true;
			title = winLevelData.text ?? '';
			target = amount;
			counted.set(0, { duration: 0 });
			await counted.set(amount, { duration: Math.max(600, winLevelData.presentDuration) });
			// the same rule as the plaque: no gate, a hold, then it leaves by itself
			await hold();
		},
		winHide: async () => {
			dismiss();
			holding = false;
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

	// DEV hook: which screen carried the win, the plain title, and every Big Win that missed its plaque
	onMount(() => {
		if (!import.meta.env.DEV || typeof window === 'undefined') return;
		Object.assign(((window as any).__manticore ??= {}), {
			winScreen: () => ({ show, viaPlaque, plain, title: plain ? title : '', holding, counting, fallbacks: fallbacks.slice() }),
		});
		return () => delete (window as any).__manticore?.winScreen;
	});
</script>

{#if show && !viaPlaque}
	<MainContainer>
		<Rectangle width={master.width} height={master.height} backgroundColor={0x05060a} alpha={dim.current} />
		{#if plain && title}
			<ArtAmount text={title} height={master.height * 0.09} x={master.width / 2} y={master.height * 0.44} maxWidth={master.width * 0.8} tint={0xe0b64a} />
		{/if}
		{#if plain}<CountUpText amount={counted.current} {target} settled={counted.current === target} size={master.height * 0.1} x={master.width / 2} y={master.height * 0.58} maxWidth={master.width * 0.8} />{/if}
	</MainContainer>
{/if}

<!-- never a prompt: a press while the plaque counts lands the amount, a press during the hold ends it early.
     Up until winHide (the hide's start), so no press falls through to the spin button meanwhile. -->
{#if counting || holding}
	<PressToContinue showText={false} onpress={() => (counting ? stingerPlaque.flow?.skip() : dismiss())} />
{/if}
