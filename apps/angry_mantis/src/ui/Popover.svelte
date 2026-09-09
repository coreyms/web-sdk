<script lang="ts">
	// Black-glass popover anchored above a control (the am-glass recipe from ChromeStyles), with a
	// small tail pointing down at the control; closes on outside pointerdown. Was the paper ticket
	// until the "Black Glass Panels" pass (2026-09-09).
	import type { Snippet } from 'svelte';

	type Props = { open: boolean; onclose: () => void; side?: 'left' | 'right'; offset?: number; width?: number | string; tail?: number; children: Snippet };
	const { open, onclose, side = 'left', offset = 56, width = 'auto', tail = 14, children }: Props = $props();

	let el: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (!open) return;
		const handler = (e: PointerEvent) => {
			if (el && !el.contains(e.target as Node)) onclose();
		};
		document.addEventListener('pointerdown', handler, true);
		return () => document.removeEventListener('pointerdown', handler, true);
	});
</script>

{#if open}
	<div
		bind:this={el}
		class="popover am-glass"
		style:bottom="{offset}px"
		style:left={side === 'left' ? '0' : 'auto'}
		style:right={side === 'right' ? '0' : 'auto'}
		style:width={typeof width === 'number' ? `${width}px` : width}
	>
		{@render children()}
		<span class="tail" style:left={side === 'left' ? `${tail}px` : 'auto'} style:right={side === 'right' ? `${tail}px` : 'auto'}></span>
	</div>
{/if}

<style>
	.popover {
		position: absolute;
		padding: 10px;
		z-index: 50;
		pointer-events: auto;
		animation: slot-count 0.18s ease both;
	}
	/* the tail: a rotated square sharing the glass and its edge, tucked under the panel's bottom edge */
	.tail {
		position: absolute;
		bottom: -8px;
		width: 14px;
		height: 14px;
		background: var(--ui-glass);
		border-right: 1px solid var(--ui-glass-edge);
		border-bottom: 1px solid var(--ui-glass-edge);
		transform: rotate(45deg);
		pointer-events: none;
	}
</style>
