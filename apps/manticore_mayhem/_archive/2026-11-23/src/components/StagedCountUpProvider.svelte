<script lang="ts">
	// Drop-in for WinCountUpProvider that paces the count-up per win tier. A single linear tween
	// makes a 10000x win cross the BIG/SUPER/MEGA bars in the first few milliseconds — the staged
	// titles would flash by unseen. Instead each crossed tier bar gets a short segment of the
	// presentation (so every title dwells on screen), and the final tier gets the remainder.
	import { Tween } from 'svelte/motion';
	import type { Snippet } from 'svelte';

	import { createInterruptible } from 'utils-shared/interruptible';
	import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
	import { WIN_TIER_STAGES, type WinTierStage } from '../game/winLevelMap';
	import { stagedSegments } from '../game/stinger/count';

	type Props = {
		amount: number;
		duration: number;
		stages?: readonly WinTierStage[];
		children: Snippet<
			[
				{
					countUpAmount: number;
					startCountUp: () => Promise<void>;
					finishCountUp: () => void;
					countUpCompleted: boolean;
				},
			]
		>;
	};
	const { amount, duration, stages = WIN_TIER_STAGES, children }: Props = $props();

	const countUpAmount = new Tween(0);
	const interruptible = createInterruptible();
	let countUpCompleted = $state(false);
	let generation = 0; // finishCountUp abandons the running segment loop; a stale loop must not resume

	// the pacing itself is game/stinger/count.ts (the win plaque's ticker runs the same function)
	const segments = () =>
		stagedSegments(
			amount,
			duration,
			stages.slice(1).map((s) => s.xBet * BOOK_AMOUNT_MULTIPLIER),
		);

	const countUp = async () => {
		const mine = ++generation;
		for (const seg of segments()) {
			await countUpAmount.set(seg.to, { duration: seg.duration });
			if (mine !== generation) return;
		}
	};
	const finishCountUp = () => interruptible.interrupt();
	const startCountUp = async () => {
		await interruptible.add(countUp);
		generation++; // invalidate the loop before snapping, in case its pending await resolves
		countUpAmount.set(amount, { duration: 0 });
		countUpCompleted = true;
		interruptible.clear();
	};
</script>

{@render children({ countUpAmount: countUpAmount.current, startCountUp, finishCountUp, countUpCompleted })}
