<script lang="ts">
	import type { Snippet } from 'svelte';

	import { Tween } from 'svelte/motion';
	import { Container } from 'pixi-svelte';
	import { getContextBoard } from 'components-shared';

	import { SYMBOL_SIZE, BOARD_DIMENSIONS } from '../game/constants';

	type Props = {
		debug?: boolean;
		x: number;
		y: number;
		zIndex?: number;
		animating: boolean;
		dim?: boolean;
		lift?: boolean;
		children: Snippet;
	};

	const props: Props = $props();
	const dimAlpha = new Tween(1, { duration: 180 });
	$effect(() => {
		dimAlpha.set(props.dim ? 0.35 : 1);
	});
	// hero lift: the leaf a strike is targeting grows off the board so the meal reads every spin
	const liftScale = new Tween(1, { duration: 220 });
	$effect(() => {
		liftScale.set(props.lift ? 1.3 : 1);
	});
	const boardContext = getContextBoard();
	const show = $derived(
		(boardContext.animate && props.animating) || (!boardContext.animate && !props.animating),
	);
	const top = 0;
	const bottom = SYMBOL_SIZE * BOARD_DIMENSIONS.y;
	const inFrame = $derived(props.y >= top && props.y <= bottom);
</script>

{#if props.debug || (show && inFrame)}
	<Container x={props.x} y={props.y} zIndex={props.lift ? 20 : (props.zIndex ?? 0)} alpha={dimAlpha.current} scale={liftScale.current}>
		{@render props.children()}
	</Container>
{/if}
