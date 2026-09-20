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
	<!-- two boxes on purpose: the counter-scale lives on the outer one, the entrance animation on
	     the inner one. slot-count animates `transform` with fill mode `both`, so a scale on the
	     same element is wiped the moment the animation lands. -->
	<div
		class="pop-scale"
		style:bottom="{offset}px"
		style:left={side === 'left' ? '0' : 'auto'}
		style:right={side === 'right' ? '0' : 'auto'}
		style:transform-origin={side === 'left' ? 'bottom left' : 'bottom right'}
	>
		<div bind:this={el} class="popover am-glass" style:width={typeof width === 'number' ? `${width}px` : width}>
			{@render children()}
			<span class="tail" style:left={side === 'left' ? `${tail}px` : 'auto'} style:right={side === 'right' ? `${tail}px` : 'auto'}></span>
		</div>
	</div>
{/if}

<style>
	/* COUNTER-SCALE (Stake review 2026-09-20, FIX 5). Unlike the modal sheets this panel is
	   anchored to a control inside the chrome's .fit frame, so it cannot leave the master — it has
	   to line up with the button it points at. Instead it undoes the frame's own fit scale, up to
	   3x, so its CSS size is true (or near it) at every viewport: 15 px type and 44 px rows stay
	   15 px and 44 px on a real phone, and in Stake's 400x225 popout (fit scale 0.27) the 3x cap
	   still lands the panel at ~0.8 of true size instead of 0.27. --fit-scale is published by
	   Chrome.svelte's .fit; on desktop it is ~1 and this is a no-op. transform-origin is set inline
	   to the anchored corner so the panel grows away from the edge it is pinned to. */
	.pop-scale {
		position: absolute;
		z-index: 50;
		pointer-events: auto;
		transform: scale(min(calc(1 / var(--fit-scale, 1)), 3));
	}
	.popover {
		/* opaque, unlike the sheets: no ModalShell dim sits behind a popover, so at .88 the reel
		   frame read straight through it with a hard edge (approval review 2026-09-15) */
		--ui-glass: #0f0f13;
		position: relative;
		padding: 10px;
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
