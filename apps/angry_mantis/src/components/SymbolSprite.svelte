<script lang="ts">
	import { Sprite } from 'pixi-svelte';
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { waitForTimeout } from 'utils-shared/wait';

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

	// "win" animation: a SLIGHT grow (the board-level dim on non-winners does the highlighting —
	// Corey 2026-08-29: big grows read badly), then report completion.
	const pulse = new Tween(1, { duration: TIMINGS.symbolWin / 2, easing: cubicOut });

	// NEVER await pulse.set(): a newer set aborts the in-flight tween task, and an aborted svelte
	// Tween promise stays pending FOREVER — the old code left runState suspended mid-pulse with
	// oncomplete unfired (leaking every resolver parked on it) whenever a state/skin change
	// re-entered. Timeouts always fire; runId keeps only the NEWEST run reporting completion, so
	// oncomplete fires exactly once per latest run and the scale always lands back at 1.
	let runId = 0;
	const runState = async (state?: SymbolState) => {
		const id = ++runId;
		if (state === 'win') {
			pulse.set(1.06);
			await waitForTimeout(TIMINGS.symbolWin / 2);
			if (id !== runId) return;
			pulse.set(1);
			await waitForTimeout(TIMINGS.symbolWin / 2);
			if (id !== runId) return;
			props.oncomplete?.();
		} else {
			// a win pulse cut short mid-grow must still settle the sprite back to rest
			if (pulse.current !== 1) pulse.set(1);
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
