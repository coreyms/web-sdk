<script lang="ts">
	// Scatter anticipation: a pulsing gold column over the reel that is still spinning.
	// (Replaces the Mining Mayhem Spine effect.)
	import { Rectangle } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { sineInOut } from 'svelte/easing';
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, BOARD_DIMENSIONS } from '../game/constants';
	import type { Reel } from '../game/stateGame.svelte';

	type Props = { reel: Reel; oncomplete: () => void };
	const props: Props = $props();
	const context = getContext();

	const pulse = new Tween(0.25, { duration: 380, easing: sineInOut });
	let alive = true;
	onMount(() => {
		(async () => {
			while (alive) {
				await pulse.set(0.7);
				await pulse.set(0.25);
			}
		})();
		return () => (alive = false);
	});

	$effect(() => {
		if (props.reel.reelState.motion === 'stopped') props.oncomplete();
	});

	const layout = $derived(context.stateGameDerived.boardLayout());
	const x = $derived(layout.x + (-layout.width * 0.5 + props.reel.reelIndex * SYMBOL_SIZE) * layout.scale);
	const y = $derived(layout.y - layout.height * 0.5 * layout.scale);
</script>

<Rectangle
	{x}
	{y}
	width={SYMBOL_SIZE * layout.scale}
	height={SYMBOL_SIZE * BOARD_DIMENSIONS.y * layout.scale}
	backgroundColor={0xffdc4a}
	alpha={pulse.current * 0.35}
	borderWidth={3}
	borderColor={0xffdc4a}
	borderRadius={6}
/>
