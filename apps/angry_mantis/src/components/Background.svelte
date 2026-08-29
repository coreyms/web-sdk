<script lang="ts">
	// Cafeteria backdrops (cover-fit) under a dark wash so the board and chrome read on top.
	// One image per game state: base/ante/regular bonus share bgCafeteriaBase; super and feast get
	// their own scene. All three stay mounted and crossfade on mode change (cheap: three static
	// sprites, only alpha animates). Layered on purpose — an animated layer can slot between the
	// backdrop and the wash later without rework.
	import { Tween } from 'svelte/motion';
	import { Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	const IMAGE_RATIO = 1920 / 1080;
	const FADE = 600;

	const cover = $derived.by(() => {
		const { width, height } = context.stateLayoutDerived.canvasSizes();
		const canvasRatio = width / height;
		return canvasRatio > IMAGE_RATIO
			? { width, height: width / IMAGE_RATIO }
			: { width: height * IMAGE_RATIO, height };
	});
	const freegame = $derived(context.stateGame.gameType === 'freegame');
	const active = $derived.by(() => {
		if (!freegame) return 'bgCafeteriaBase';
		if (context.stateGame.bonusMode === 'super') return 'bgCafeteriaSuper';
		if (context.stateGame.bonusMode === 'feast') return 'bgCafeteriaFeast';
		return 'bgCafeteriaBase';
	});

	const LAYERS = ['bgCafeteriaBase', 'bgCafeteriaSuper', 'bgCafeteriaFeast'] as const;
	const alphas = LAYERS.map((key) => new Tween(key === 'bgCafeteriaBase' ? 1 : 0, { duration: FADE }));
	$effect(() => {
		LAYERS.forEach((key, i) => alphas[i].set(key === active ? 1 : 0));
	});
</script>

<Rectangle {...context.stateLayoutDerived.canvasSizes()} backgroundColor={0x06120a} zIndex={-3} />

{#each LAYERS as key, i (key)}
	{#if alphas[i].current > 0}
		<Sprite
			{key}
			anchor={0.5}
			x={context.stateLayoutDerived.canvasSizes().width / 2}
			y={context.stateLayoutDerived.canvasSizes().height / 2}
			width={cover.width}
			height={cover.height}
			alpha={alphas[i].current}
			zIndex={-2}
		/>
	{/if}
{/each}

<!-- dark wash so board/chrome contrast holds on the busier cafeteria art; a touch darker in free spins -->
<Rectangle
	{...context.stateLayoutDerived.canvasSizes()}
	backgroundColor={0x060c06}
	alpha={freegame ? 0.6 : 0.5}
	zIndex={-1}
/>
