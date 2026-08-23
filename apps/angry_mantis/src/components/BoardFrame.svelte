<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	// Pre-rendered reel frame from the design CSS (orange gradient, gold border, 5×4 cell grid).
	import { Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { FRAME, layoutKind } from '../game/layoutSpec';

	const context = getContext();
	const frame = $derived(FRAME[layoutKind(context.stateLayoutDerived.layoutType())]);
</script>

<Sprite
	key={frame.image}
	x={frame.x - frame.margin}
	y={frame.y - frame.margin}
	width={frame.width + frame.margin * 2}
	height={frame.height + frame.margin * 2}
/>
