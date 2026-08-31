<script lang="ts" module>
	// Escape must only close the TOPMOST shell: stacked modals (e.g. the buy modal + its ARE YOU
	// SURE confirm) each register a keydown listener, and the same Escape keydown reaches both in
	// the one dispatch — without this stack, one press closed the whole pile. Cleanup pops in a
	// Svelte flush AFTER the dispatch, so every handler of that keydown still sees the confirm on
	// top and only it acts.
	const escStack: symbol[] = [];
</script>

<script lang="ts">
	// Full-viewport blurred backdrop + a design-master-sized content frame (scaled), so modals
	// are authored in master units like the rest of the chrome. Click outside content = close.
	import type { Snippet } from 'svelte';

	type Props = {
		open: boolean;
		onclose: () => void;
		master: { width: number; height: number };
		scale: number;
		left: number;
		top: number;
		dim?: string;
		blur?: number;
		zIndex?: number;
		children: Snippet;
	};
	const { open, onclose, master, scale, left, top, dim = 'rgba(8,4,16,0.8)', blur = 12, zIndex = 1, children }: Props = $props();

	$effect(() => {
		if (!open) return;
		const token = Symbol('modal');
		escStack.push(token);
		const h = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && escStack[escStack.length - 1] === token) onclose();
		};
		document.addEventListener('keydown', h);
		return () => {
			const i = escStack.indexOf(token);
			if (i !== -1) escStack.splice(i, 1);
			document.removeEventListener('keydown', h);
		};
	});
</script>

{#if open}
	<div class="backdrop" style:background={dim} style:z-index={zIndex} onclick={onclose} role="presentation"></div>
	<div class="frame" style:z-index={zIndex + 1} style:width="{master.width}px" style:height="{master.height}px" style:transform="translate({left}px, {top}px) scale({scale})" onclick={onclose} role="presentation">
		{@render children()}
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		pointer-events: auto;
		animation: slot-count 0.25s ease both;
	}
	.frame {
		position: absolute;
		left: 0;
		top: 0;
		transform-origin: top left;
		pointer-events: auto;
		animation: slot-count 0.25s ease both;
	}
</style>
