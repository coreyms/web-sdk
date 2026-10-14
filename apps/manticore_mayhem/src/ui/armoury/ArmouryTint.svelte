<script lang="ts">
	// THE ARMOURY'S TINT (spec feedback/armoury_build_r1 2.3, 2.4). Reusable: no game names, colours or copy.
	//
	// Mounted by Chrome.svelte INSIDE the HUD layer's scaled frame (.fit), so the real BALANCE and bet row can be raised
	// above it by z-index (Chrome.svelte's .armoury-open rules) and every other HUD button stays under it, dead: the tint
	// takes the pointer. It is sized to cover the whole viewport from inside the frame (left -fitLeft / scale, top
	// -top / scale, the window over scale). It exists only while the menu is shown ({#if}): a tint left mounted at zero
	// opacity would be a screen sized leaf over the logo (logo_probe.js and skip_probe.js scan every leaf of the frame).
	//
	// Flat colour layers, opacity only: the open fade, the confirm step (0.72 to 0.84), the close fade, and a new mode's
	// colour fading in OVER the old one (never brighter in between), the old layer removed when it is covered.
	import { untrack } from 'svelte';
	import { armouryView } from './armouryView.svelte';
	import { prefersReducedMotion } from './motion';
	import { ARMOURY } from '../../game/constants';

	type Props = { fitLeft: number; top: number; scale: number; vw: number; vh: number };
	const { fitLeft, top, scale, vw, vh }: Props = $props();

	const T = ARMOURY.tint;
	const reduced = prefersReducedMotion();
	const opacity = $derived(armouryView.open ? (armouryView.confirm ? Math.min(T.opacity + T.confirmAdd, T.confirmMax) : T.opacity) : 0);

	type Layer = { key: number; color: string; fresh: boolean };
	let layers = $state<Layer[]>([]);
	let next = 0;
	// The bottom layer is always fully opaque, so the board is never brighter in between: a new colour fades in OVER
	// it, and only when that fade has ENDED (its own animationend, not a timer that could fire a frame early) are the
	// layers under it removed. At most three: a fourth change drops the middle one (a colour jump under an opaque
	// bottom, never a brightness jump).
	$effect(() => {
		const color = armouryView.tint;
		const shown = armouryView.shown;
		untrack(() => {
			if (!shown) {
				layers = [];
				return;
			}
			const last = layers[layers.length - 1];
			if (last && last.color === color) return;
			const key = ++next;
			// the first colour of an open is there at once; a change fades in over the old one
			if (!last || reduced) {
				layers = [{ key, color, fresh: false }];
				return;
			}
			const kept = layers.length >= 3 ? [layers[0], layers[layers.length - 1]] : layers;
			layers = [...kept, { key, color, fresh: true }];
		});
	});
	const covered = (key: number) => {
		const i = layers.findIndex((l) => l.key === key);
		if (i < 0) return;
		layers = layers.slice(i).map((l, j) => (j === 0 ? { ...l, fresh: false } : l));
	};
	// a layout change (rotation, resize) while moving: every animation stops, the newest colour is simply there
	$effect(() => {
		void armouryView.snap;
		untrack(() => {
			if (layers.length > 1) layers = [{ ...layers[layers.length - 1], fresh: false }];
		});
	});
	// reduced motion: every duration 0 (spec 5.5)
	const msv = (n: number) => `${reduced ? 0 : n}ms`;
</script>

{#if armouryView.shown}
	<div class="armoury-tint" style:left="{-fitLeft / scale}px" style:top="{-top / scale}px" style:width="{vw / scale}px" style:height="{vh / scale}px" aria-hidden="true">
		<div class="tints" class:open={armouryView.open} class:confirm={armouryView.confirm} class:reduced style:opacity style:--in-ms={msv(T.inMs)} style:--out-ms={msv(T.outMs)} style:--confirm-ms={msv(T.confirmMs)} style:--cross-ms={msv(T.crossMs)}>
			{#each layers as l (l.key)}
				<div class="tint" class:fresh={l.fresh} style:background={l.color} onanimationend={() => covered(l.key)}></div>
			{/each}
		</div>
	</div>
{/if}

<style>
	/* the wrapper never changes its own opacity (the frame's children carry the HUD's 0.35 s return transition) */
	.armoury-tint {
		position: absolute;
		z-index: 11; /* over the clock strip (10) and every HUD row; the lit cells sit at 12 (Chrome.svelte) */
		pointer-events: auto;
	}
	.tints {
		position: absolute;
		inset: 0;
		transition: opacity var(--out-ms) ease-out;
		animation: tint-in var(--in-ms) linear backwards;
	}
	.tints.open {
		transition: opacity var(--in-ms) linear;
	}
	.tints.open.confirm {
		transition: opacity var(--confirm-ms) linear;
	}
	.tint {
		position: absolute;
		inset: 0;
	}
	.tint.fresh {
		animation: tint-in var(--cross-ms) linear backwards;
	}
	.tints.reduced,
	.tints.reduced .tint {
		transition-duration: 0s !important;
		animation: none !important;
	}
	@keyframes tint-in {
		from {
			opacity: 0;
		}
	}
</style>
