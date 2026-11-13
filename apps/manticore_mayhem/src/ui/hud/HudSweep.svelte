<script lang="ts">
	// THE WIN STREAK: once per win, a short bright streak runs along the glass's straight top edge (Drop 6 "the dock's top
	// edge is brightest right above WIN" and a thread that travels on a win). A translate and an opacity on one small
	// element, 1.5 s, then nothing: no per-frame script, no stroke animation.
	import { untrack } from 'svelte';
	type Props = { x0: number; x1: number; y: number; lit: boolean };
	const { x0, x1, y, lit }: Props = $props();
	let n = $state(0);
	let was = false;
	$effect(() => {
		const on = lit;
		if (on && !was) untrack(() => (n += 1));
		was = on;
	});
</script>

{#key n}
	{#if n > 0}
		<div class="sweep go" style:left="{x0}px" style:top="{y - 3}px" style:width="{x1 - x0}px" style:--sweep-w="{x1 - x0}px"><i></i></div>
	{/if}
{/key}
