<script lang="ts">
	// Active game-mode plaque, centred under the reel frame in every aspect ratio (Corey 2026-08-26):
	// mode name + the TRUE cost of one spin press. The SPIN readout keeps the base bet; the spin
	// button carries the abbreviated price. Phone-sideways has the stats strip in the band below the
	// frame, so there the plaque sits on the frame's bottom border instead.
	import type { Controls } from './controls.svelte';
	import { FRAME, type LayoutKind } from '../game/layoutSpec';

	type Props = { controls: Controls; kind: LayoutKind; offsetX?: number };
	const { controls, kind, offsetX = 0 }: Props = $props();

	const chip = $derived(controls.modeChip());
	const f = $derived(FRAME[kind]);
	const top = $derived(kind === 'phone' ? f.y + f.height - 34 : f.y + f.height + (kind === 'portrait' ? 4 : 8));
	const fs = $derived(kind === 'phone' ? 16 : 13);
</script>

{#if chip}
	<div class="wrap" style:left="{offsetX + f.x}px" style:width="{f.width}px" style:top="{top}px">
		<span class="plaque" style:font-size="{fs}px">
			<b>{chip.label}</b>
			<span class="dot">·</span>
			<span class="slot-num cost">{chip.cost}</span>
			<span class="per">/ SPIN</span>
		</span>
	</div>
{/if}

<style>
	.wrap {
		position: absolute;
		display: flex;
		justify-content: center;
		pointer-events: none;
		z-index: 4;
	}
	.plaque {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		padding: 3px 14px;
		border-radius: 999px;
		background: rgba(10, 6, 2, 0.72);
		box-shadow: inset 0 0 0 1px rgba(232, 176, 74, 0.55), 0 2px 8px rgba(0, 0, 0, 0.5);
		color: #e8b04a;
		font-family: var(--ui-font);
		letter-spacing: 1.6px;
		text-shadow: 0 0 8px rgba(232, 176, 74, 0.4);
		white-space: nowrap;
	}
	.plaque b {
		font-weight: 900;
	}
	.dot {
		opacity: 0.6;
	}
	.cost {
		color: #fff;
		font-weight: 700;
	}
	.per {
		font-size: 0.72em;
		opacity: 0.7;
		font-weight: 800;
	}
</style>
