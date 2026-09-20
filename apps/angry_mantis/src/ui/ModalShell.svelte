<script lang="ts" module>
	// Escape must only close the TOPMOST shell: stacked modals (e.g. the buy modal + its ARE YOU
	// SURE confirm) each register a keydown listener, and the same Escape keydown reaches both in
	// the one dispatch — without this stack, one press closed the whole pile. Cleanup pops in a
	// Svelte flush AFTER the dispatch, so every handler of that keydown still sees the confirm on
	// top and only it acts.
	const escStack: symbol[] = [];
</script>

<script lang="ts">
	// Full-viewport dim + a content frame that IS the viewport. Click outside content = close.
	//
	// Until 2026-09-20 the frame was sized to the design master and carried the chrome's uniform
	// fit scale, so every modal was authored in master units like the rest of the chrome. That
	// broke in Stake's Popout S (a 400×225 CSS px iframe): the phone master 1480×740 fits at 0.27,
	// so the compact replay card (380 master px) rendered 103 CSS px wide with sub-3 CSS px labels
	// (Stake review FIX 5). Modals are a READING surface, not part of the scene — none of them
	// registers on the canvas or has to line up with a Pixi coordinate — so the frame now spans the
	// real viewport at scale 1 and every panel sizes itself in viewport-relative clamps with real
	// minimum type sizes. `master` / `scale` / `left` / `top` stay in the prop type (every caller
	// still passes them, and they are still the right thing to pass if a modal ever needs to line
	// up with the scene again) but the shell no longer applies them.
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
	const { open, onclose, dim = 'rgba(8,4,16,0.8)', zIndex = 1, children }: Props = $props();

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
	<div class="frame" style:z-index={zIndex + 1} onclick={onclose} role="presentation">
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
		position: fixed;
		inset: 0;
		pointer-events: auto;
		animation: slot-count 0.25s ease both;
	}
</style>
