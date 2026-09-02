<script lang="ts">
	// Renders a block already laid out by game/stencilLayout — batched sprites off the resident
	// glyph atlases, zero PIXI.Text (house rule 1). The caller does the layoutStencil() call
	// itself so the block it MEASURED for fitting is byte-for-byte the block that gets drawn.
	import { Sprite } from 'pixi-svelte';

	import type { StencilBlock } from '../game/stencilLayout';

	type Props = {
		block: StencilBlock;
		/** Anchor point. `origin` says which part of the block lands on it. */
		x?: number;
		y?: number;
		/** 'center' → x is the block's horizontal centre; 'left' → its left edge. */
		origin?: 'center' | 'left';
		/** Fallback tint for glyphs that carry none (the white sheet is near-white, so it tints). */
		tint?: number;
		alpha?: number;
	};
	const { block, x = 0, y = 0, origin = 'center', tint, alpha = 1 }: Props = $props();

	const ox = $derived(origin === 'center' ? x - block.width / 2 : x);
</script>

{#each block.glyphs as g, i (i)}
	<Sprite
		key={g.key}
		x={ox + g.x}
		y={y + g.y}
		width={g.w}
		height={g.h}
		tint={g.tint ?? tint ?? 0xffffff}
		{alpha}
	/>
{/each}
