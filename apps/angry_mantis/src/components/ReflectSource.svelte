<script lang="ts">
	// Marks the enclosing pixi-svelte container as the reflection source (see FrameReflections).
	// Place it as the FIRST child inside the MainContainer that holds the reels: pixi-svelte gives
	// no handle to its Container instance, but every child can reach it through the parent context.
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { setReflectSource } from '../game/reflection';

	const { parent } = getContextParent();
	onMount(() => {
		setReflectSource(parent);
		return () => setReflectSource(null);
	});
</script>
