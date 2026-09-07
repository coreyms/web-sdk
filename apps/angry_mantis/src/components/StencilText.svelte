<script lang="ts">
	// Renders a block already laid out by game/stencilLayout — batched sprites off the resident
	// glyph atlases, zero PIXI.Text (house rule 1). The caller does the layoutStencil() call
	// itself so the block it MEASURED for fitting is byte-for-byte the block that gets drawn.
	import type * as PIXI from 'pixi.js';
	import { Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import type { StencilBlock } from '../game/stencilLayout';

	// The glyph sheets are cut at ~205 px per digit; a 12 px plaque label is a 15× minification, and
	// without mipmaps WebGL samples that from the full-size sheet — the "blocky" plaque text (Corey
	// 2026-09-06). Mipmaps on the sheet's source fix every small stencil block at once (WebGL2 takes
	// non-power-of-two sizes). One-shot per source; the big amounts are unaffected.
	const mipped = new WeakSet<object>();
	const context = getContext();
	const ensureMips = (key: string) => {
		const src = (context.stateApp.loadedAssets?.[key] as PIXI.Texture | undefined)?.source;
		if (!src || mipped.has(src)) return;
		mipped.add(src);
		src.autoGenerateMipmaps = true;
		src.scaleMode = 'linear';
		src.update();
	};

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
	$effect(() => {
		for (const g of block.glyphs) ensureMips(g.key);
	});
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
