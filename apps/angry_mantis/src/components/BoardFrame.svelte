<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	// Pre-rendered reel frame from the design CSS (orange gradient, gold border, 5×4 cell grid).
	import { Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { frameFor, layoutKind } from '../game/layoutSpec';

	const context = getContext();
	const vw = $derived(
		context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale,
	);
	const frame = $derived(frameFor(layoutKind(context.stateLayoutDerived.layoutType()), vw));
</script>

<Sprite
	key={frame.image}
	x={frame.x - frame.margin}
	y={frame.y - frame.margin}
	width={frame.width + frame.margin * 2}
	height={frame.height + frame.margin * 2}
/>
