<script lang="ts">
	// Paper-ticket popover anchored above a control (same stock as the meal-ticket modals); closes on outside pointerdown.
	import type { Snippet } from 'svelte';

	type Props = { open: boolean; onclose: () => void; side?: 'left' | 'right'; offset?: number; width?: number | string; children: Snippet };
	const { open, onclose, side = 'left', offset = 56, width = 'auto', children }: Props = $props();

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
		class="popover"
		style:bottom="{offset}px"
		style:left={side === 'left' ? '0' : 'auto'}
		style:right={side === 'right' ? '0' : 'auto'}
		style:width={typeof width === 'number' ? `${width}px` : width}
	>
		{@render children()}
	</div>
{/if}

<style>
	.popover {
		position: absolute;
		padding: 12px;
		color: #2a241a;
		background: linear-gradient(180deg, #ebe3cf, #d9cfb4);
		border-radius: 14px;
		box-shadow: 0 24px 56px rgba(0, 0, 0, 0.7), inset 0 0 0 2px rgba(0, 0, 0, 0.08);
		z-index: 50;
		pointer-events: auto;
		animation: slot-count 0.18s ease both;
	}
	.popover::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.035) 0 1px, transparent 1px 3px);
		pointer-events: none;
	}
	.popover > :global(*) {
		position: relative;
	}
</style>
