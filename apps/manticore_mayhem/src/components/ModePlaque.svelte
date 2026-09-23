<script lang="ts" module>
	export type EmitterEventModePlaque =
		| {
				type: 'modePlaqueShow';
				title: string;
				sub: string;
				/** true = wait for a press (feature entry); false = hold for holdMs and go */
				gated: boolean;
				holdMs?: number;
		  }
		| { type: 'modePlaqueHide' };
</script>

<script lang="ts">
	// The plain mode plaque. Milestone 1 has no cinematics and no character, so a feature starts and
	// ends on one readable plate under the board: the mode, its spin count and its tile ladder.
	import { Rectangle } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { TIMINGS } from '../game/constants';
	import { HUD as HUD_SLOTS, layoutKind as kindOf, boardCenterX } from '../game/layoutSpec';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { autoBonusesRunning } from '../game/stateGame.svelte';
	import ArtAmount from './ArtAmount.svelte';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();
	const slot = $derived(HUD_SLOTS[kindOf(context.stateLayoutDerived.layoutType())].modePlaque);
	const master = $derived(context.stateLayoutDerived.mainLayout());
	// the plaque belongs to the BOARD, which is left of the master centre in landscape
	const vw = $derived(context.stateLayoutDerived.canvasSizes().width / master.scale);
	const cx = $derived(boardCenterX(kindOf(context.stateLayoutDerived.layoutType()), vw));

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
			await alpha.set(0, { duration: TIMINGS.plaqueOutMs });
			context.stateGame.plaque = null;
		},
	});
</script>

<MainContainer>
	{#if alpha.current > 0}
		<Rectangle
			x={cx - slot.width / 2}
			y={slot.y - slot.height * 1.5}
			width={slot.width}
			height={slot.height * 2.2}
			backgroundColor={0x0d0e12}
			alpha={alpha.current * 0.82}
		/>
		<ArtAmount text={title} height={slot.height * 0.62} x={cx} y={slot.y - slot.height * 0.22} maxWidth={slot.width * 0.92} alpha={alpha.current} />
		<ArtAmount text={sub} height={slot.height * 0.34} x={cx} y={slot.y + slot.height * 0.52} maxWidth={slot.width * 0.92} alpha={alpha.current * 0.85} tint={0x9fd9d4} />
	{/if}
</MainContainer>

{#if gated && resolveGate}
	<PressToContinue showText onpress={dismiss} />
{/if}
