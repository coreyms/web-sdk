<script lang="ts">
	import { Sprite } from 'pixi-svelte';
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import type { SymbolInfo } from '../game/constants';
	import { SYMBOL_SIZE, TIMINGS } from '../game/constants';
	import type { SymbolState } from '../game/types';

	type Props = {
		x?: number;
		y?: number;
		symbolInfo: SymbolInfo;
		state?: SymbolState;
		oncomplete?: () => void;
	};

	const props: Props = $props();

	// Placeholder "win" animation: a quick scale pulse, then report completion.
	const pulse = new Tween(1, { duration: TIMINGS.symbolWin / 2, easing: cubicOut });

	const runState = async (state?: SymbolState) => {
		if (state === 'win') {
			await pulse.set(1.18);
			await pulse.set(1);
			props.oncomplete?.();
		} else {
			props.oncomplete?.();
		}
	};

	onMount(() => {
		runState(props.state);
	});

	$effect(() => {
		props.symbolInfo;
		runState(props.state);
	});
</script>

<Sprite
	x={props.x}
	y={props.y}
	anchor={0.5}
	key={props.symbolInfo.assetKey}
	width={SYMBOL_SIZE * props.symbolInfo.sizeRatios.width * pulse.current}
	height={SYMBOL_SIZE * props.symbolInfo.sizeRatios.height * pulse.current}
	alpha={props.state === 'eaten' ? 0.45 : 1}
/>
