<script lang="ts">
	// Glint overlay for a chrome image (logo, tagline): a white band masked by the image's own
	// alpha sweeps across it — a subtle one every IDLE_MS while idle and a full one the moment a
	// spin is pressed (Corey 2026-09-05). Pure CSS mask + background animation on the compositor;
	// no backdrop-filter (house rule), no canvas. Every Shine on the page restarts its animation
	// on the same `bet` event, so the logo and the tagline sweep in sync.
	import { getContext } from '../game/context';

	type Props = { src: string; idleMs?: number };
	const { src, idleMs = 5000 }: Props = $props();
	const context = getContext();
	let tick = $state(0);
	context.eventEmitter.subscribeOnMount({ bet: () => tick++ });
</script>

{#key tick}
	<span class="shine" class:big={tick > 0} style:--m="url({src})" style:--idle="{idleMs}ms" aria-hidden="true"></span>
{/key}

<style>
	.shine {
		position: absolute;
		inset: 0;
		pointer-events: none;
		-webkit-mask-image: var(--m);
		mask-image: var(--m);
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		background: linear-gradient(105deg, rgba(255, 255, 255, 0) 35%, rgba(255, 255, 255, 0.95) 50%, rgba(255, 255, 255, 0) 65%);
		background-size: 300% 100%;
		background-position: 120% 0;
		opacity: 0;
		animation: idle var(--idle) linear infinite;
	}
	.shine.big {
		animation:
			big 520ms ease-out 1,
			idle var(--idle) linear 520ms infinite;
	}
	/* the sweep takes the first ~18% of the idle period, then rests */
	@keyframes idle {
		0% { opacity: 0; background-position: 120% 0; }
		2% { opacity: 0.4; }
		16% { opacity: 0.4; background-position: -20% 0; }
		18% { opacity: 0; background-position: -20% 0; }
		100% { opacity: 0; background-position: -20% 0; }
	}
	@keyframes big {
		0% { opacity: 0; background-position: 120% 0; }
		15% { opacity: 1; }
		100% { opacity: 0; background-position: -20% 0; }
	}
	@media (prefers-reduced-motion: reduce) {
		.shine { animation: none; }
	}
</style>
