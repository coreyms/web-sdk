<script lang="ts">
	// Jungle backdrop from the design (bg-jungle.webp, cover-fit) under a dark green wash so the
	// board and chrome read on top. Replaces the `ways` Spine foreground animations (much cheaper to draw).
	import { Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	const IMAGE_RATIO = 1536 / 1024;

	const cover = $derived.by(() => {
		const { width, height } = context.stateLayoutDerived.canvasSizes();
		const canvasRatio = width / height;
		return canvasRatio > IMAGE_RATIO
			? { width, height: width / IMAGE_RATIO }
			: { width: height * IMAGE_RATIO, height };
	});
	const freegame = $derived(context.stateGame.gameType === 'freegame');
</script>

<Rectangle {...context.stateLayoutDerived.canvasSizes()} backgroundColor={0x06120a} zIndex={-3} />

<Sprite
	key="bgJungle"
	anchor={0.5}
	x={context.stateLayoutDerived.canvasSizes().width / 2}
	y={context.stateLayoutDerived.canvasSizes().height / 2}
	width={cover.width}
	height={cover.height}
	zIndex={-2}
/>

<!-- linear-gradient(rgba(8,14,8,.55) → rgba(4,10,4,.7)); a touch darker in free spins -->
<Rectangle
	{...context.stateLayoutDerived.canvasSizes()}
	backgroundColor={0x060c06}
	alpha={freegame ? 0.72 : 0.62}
	zIndex={-1}
/>
