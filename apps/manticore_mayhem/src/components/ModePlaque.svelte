<script lang="ts" module>
	import type { StingerMode } from '../game/stinger/types';

	export type EmitterEventModePlaque =
		| {
				type: 'modePlaqueShow';
				title: string;
				sub: string;
				/** true = wait for a press (feature entry); false = hold for holdMs and go */
				gated: boolean;
				holdMs?: number;
				/** a FEATURE ENTRY: the animated plaque's intro screen for this mode carries it (the book's own
				 *  spin count and tile cap are checked against the plaque's baked copy first) */
				intro?: { mode: StingerMode; totalFs: number; tileCap: number };
		  }
		| { type: 'modePlaqueHide' };
</script>

<script lang="ts">
	// The mode plaque. A FEATURE ENTRY (event.intro) is the animated win plaque's intro screen
	// (components/StingerPlaque.svelte): the title punches in and the mode's three rows rise in, then the same
	// gate as before (a press, or the hold while auto bonuses run). The plain plate below stays for anything
	// else, and for a feature entry whose book numbers the plaque's baked copy does not say (or whose art
	// never arrived): the mode, its spin count and its tile ladder on one readable plate over the board.
	import { Rectangle } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { TIMINGS } from '../game/constants';
	import { HUD as HUD_SLOTS, layoutKind as kindOf, boardCenterX, boardCenterY } from '../game/layoutSpec';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { autoBonusesRunning } from '../game/stateGame.svelte';
	import { awaitDeferredAssets } from '../game/assetGate';
	import { stingerPlaque } from './StingerPlaque.svelte';
	import ArtAmount from './ArtAmount.svelte';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();
	const slot = $derived(HUD_SLOTS[kindOf(context.stateLayoutDerived.layoutType())].modePlaque);
	const master = $derived(context.stateLayoutDerived.mainLayout());
	// the plaque belongs to the BOARD, which is left of the master centre in landscape
	const vw = $derived(context.stateLayoutDerived.canvasSizes().width / master.scale);
	const cx = $derived(boardCenterX(kindOf(context.stateLayoutDerived.layoutType()), vw));
	// portrait follows frameFor's growth (the cell area's centre); the others keep their HUD slot
	const py = $derived(kindOf(context.stateLayoutDerived.layoutType()) === 'portrait' ? boardCenterY('portrait', vw) : slot.y);

	let title = $state('');
	let sub = $state('');
	let gated = $state(false);
	const alpha = new Tween(0, { duration: TIMINGS.plaqueInMs, easing: cubicOut });
	let resolveGate: (() => void) | null = $state(null);

	const dismiss = () => {
		const r = resolveGate;
		resolveGate = null;
		r?.();
	};

	context.eventEmitter.subscribeOnMount({
		modePlaqueShow: async (event) => {
			title = event.title;
			sub = event.sub;
			gated = event.gated;
			context.stateGame.plaque = { title: event.title, sub: event.sub };
			if (event.intro && event.gated) {
				await awaitDeferredAssets();
				const flow = stingerPlaque.flow;
				const says = !!flow?.ready() && flow.introMatches(event.intro.mode, event.intro.totalFs, event.intro.tileCap);
				if (flow && says) {
					await flow.intro({ mode: event.intro.mode });
					if (!autoBonusesRunning()) await waitForResolve((resolve) => (resolveGate = resolve));
					else await waitForTimeout(event.holdMs ?? TIMINGS.plaqueHoldMs);
					resolveGate = null;
					await flow.hide();
					context.stateGame.plaque = null;
					return;
				}
				if (import.meta.env.DEV && flow?.ready()) console.warn('[manticore] the plaque intro copy does not match the book: plain plate shown', event.intro);
			}
			await alpha.set(1);
			if (event.gated && !autoBonusesRunning()) {
				await waitForResolve((resolve) => (resolveGate = resolve));
			} else {
				await waitForTimeout(event.holdMs ?? TIMINGS.plaqueHoldMs);
			}
			await alpha.set(0, { duration: TIMINGS.plaqueOutMs });
			context.stateGame.plaque = null;
		},
		modePlaqueHide: async () => {
			dismiss();
			// finalWin hides the plaque on EVERY round: skip the no-op fade when it is already down.
			// Each svelte/motion Tween.set() keeps the task it replaced alive (Svelte 5.20), so the
			// unconditional set leaked one task chain link per spin (phone perf pass, 2026-09-23).
			if (alpha.target !== 0 || alpha.current !== 0) await alpha.set(0, { duration: TIMINGS.plaqueOutMs });
			context.stateGame.plaque = null;
		},
	});
</script>

<MainContainer>
	{#if alpha.current > 0}
		<Rectangle
			x={cx - slot.width / 2}
			y={py - slot.height * 1.5}
			width={slot.width}
			height={slot.height * 2.2}
			backgroundColor={0x0d0e12}
			alpha={alpha.current * 0.82}
		/>
		<ArtAmount text={title} height={slot.height * 0.62} x={cx} y={py - slot.height * 0.22} maxWidth={slot.width * 0.92} alpha={alpha.current} />
		<ArtAmount text={sub} height={slot.height * 0.34} x={cx} y={py + slot.height * 0.52} maxWidth={slot.width * 0.92} alpha={alpha.current * 0.85} tint={0x9fd9d4} />
	{/if}
</MainContainer>

{#if gated && resolveGate}
	<PressToContinue showText onpress={dismiss} />
{/if}
