<script lang="ts">
	// Cafeteria backdrops (cover-fit) under a dark wash so the board and chrome read on top.
	// One image per game state: base/ante/regular bonus share bgCafeteriaBase; super and feast get
	// their own scene. All three stay mounted and crossfade on mode change (cheap: three static
	// sprites, only alpha animates). Layered on purpose — an animated layer can slot between the
	// backdrop and the wash later without rework.
	import { Tween } from 'svelte/motion';
	import { Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { BACKGROUND_WASH } from '../game/constants';
	import { BACKDROP, FAN } from '../game/ambientSpec';
	import AmbientFan from './AmbientFan.svelte';
	import AmbientSky from './AmbientSky.svelte';

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
	const backdropScale = $derived(cover.width / BACKDROP.w); // backdrop px → canvas px
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

<!-- sky + bonus clouds, UNDER the rooms: the room art's panes are cut to alpha, so this layer shows
     only through the glass. Same crossfade alphas as the rooms, same cover fit. -->
<AmbientSky
	x={context.stateLayoutDerived.canvasSizes().width / 2 - (BACKDROP.w / 2) * backdropScale}
	y={context.stateLayoutDerived.canvasSizes().height / 2 - (BACKDROP.h / 2) * backdropScale}
	scale={backdropScale}
	alphas={alphas.map((a) => a.current)}
	zIndex={-2.5}
/>

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

<!-- ambient layer, between the base backdrop and the wash: authored in backdrop px (ambientSpec.ts),
     mapped through the same cover fit as the backdrop sprite. Only the base scene has the fan housing. -->
<AmbientFan
	x={context.stateLayoutDerived.canvasSizes().width / 2 + (FAN.hub.x - BACKDROP.w / 2) * backdropScale}
	y={context.stateLayoutDerived.canvasSizes().height / 2 + (FAN.hub.y - BACKDROP.h / 2) * backdropScale}
	scale={backdropScale}
	alpha={alphas[0].current}
	visible={alphas[0].current > 0}
	zIndex={-1.5}
/>

<!-- dark wash so board/chrome contrast holds on the busier cafeteria art; a touch darker in free
     spins (levels in BACKGROUND_WASH) -->
<Rectangle
	{...context.stateLayoutDerived.canvasSizes()}
	backgroundColor={0x060c06}
	alpha={freegame ? BACKGROUND_WASH.freegame : BACKGROUND_WASH.base}
	zIndex={-1}
/>
