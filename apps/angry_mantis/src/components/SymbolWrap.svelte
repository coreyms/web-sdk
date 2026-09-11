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
		children: Snippet;
	};

	const props: Props = $props();
	// non-focus tiles are DARKENED, never faded: at 0.35 alpha the board backdrop's plate showed
	// through every dimmed tray (Corey 2026-09-11, the same rule the eaten trays follow —
	// SymbolSprite's EATEN_TINT). One tweened brightness, applied as a multiply tint on the
	// wrapper so the tile and everything drawn over it darken together.
	const dimLevel = new Tween(1, { duration: 180 });
	$effect(() => {
		dimLevel.set(props.dim ? 0.35 : 1);
	});
	const dimTint = $derived.by(() => {
		const v = Math.round(255 * dimLevel.current);
		return (v << 16) | (v << 8) | v;
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
	<Container x={props.x} y={props.y} zIndex={props.zIndex ?? 0} tint={dimTint}>
		{@render props.children()}
	</Container>
{/if}
