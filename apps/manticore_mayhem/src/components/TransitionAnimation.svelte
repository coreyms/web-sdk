<script lang="ts">
	// Quick fade to black and back (replaces the Mining Mayhem purple Spine wipe).
	import { Rectangle } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';

	type Props = { oncomplete: () => void };
	const props: Props = $props();
	const context = getContext();
	const alpha = new Tween(0, { duration: 220 });

	onMount(async () => {
		await alpha.set(1);
		props.oncomplete();
		await alpha.set(0, { duration: 350 });
	});
</script>

<Rectangle {...context.stateLayoutDerived.canvasSizes()} backgroundColor={0x020503} alpha={alpha.current} />
