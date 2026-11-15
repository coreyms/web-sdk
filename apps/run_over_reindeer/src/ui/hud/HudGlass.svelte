<script lang="ts" module>
	let uid = 0;
</script>

<script lang="ts">
	// One painted glass shape (the dock, a capsule): a blue-black fill, a white top edge and a gold bottom edge (each a
	// 1 px gradient brightest at `peak`), a specular line under the top edge, and with a mode on (Ante, Super Ante) a
	// gold thread along the whole top edge. All painted SVG: no filter, no blur.
	import type { Outline } from './hudLayout';

	type Props = {
		outline: Outline;
		/** the gradient frame: x0..x1 across, y0..y1 down, peak (0..1) where the edges are brightest */
		frame: { x0: number; x1: number; y0: number; y1: number; peak?: number };
		/** 1 Ante, 2 Super Ante */
		ante?: 0 | 1 | 2;
		W: number;
		H: number;
	};
	const { outline, frame, ante = 0, W, H }: Props = $props();
	const id = `hudg${++uid}`;
	const p = $derived(frame.peak ?? 0.5);
</script>

<svg class="ol" width={W} height={H} viewBox="0 0 {W} {H}" aria-hidden="true">
	<defs>
		<linearGradient id="{id}t" gradientUnits="userSpaceOnUse" x1={frame.x0} y1="0" x2={frame.x1} y2="0">
			<stop offset="0" style="stop-color:rgb(var(--hud-edge-top-rgb));stop-opacity:calc(var(--hud-edge-top-a) * 0.15)" />
			<stop offset={p} style="stop-color:rgb(var(--hud-edge-top-rgb));stop-opacity:var(--hud-edge-top-a)" />
			<stop offset="1" style="stop-color:rgb(var(--hud-edge-top-rgb));stop-opacity:calc(var(--hud-edge-top-a) * 0.15)" />
		</linearGradient>
		<linearGradient id="{id}b" gradientUnits="userSpaceOnUse" x1={frame.x0} y1="0" x2={frame.x1} y2="0">
			<stop offset="0" style="stop-color:rgb(var(--hud-edge-bottom-rgb));stop-opacity:calc(var(--hud-edge-bottom-a) * 0.15)" />
			<stop offset={p} style="stop-color:rgb(var(--hud-edge-bottom-rgb));stop-opacity:var(--hud-edge-bottom-a)" />
			<stop offset="1" style="stop-color:rgb(var(--hud-edge-bottom-rgb));stop-opacity:calc(var(--hud-edge-bottom-a) * 0.15)" />
		</linearGradient>
		<linearGradient id="{id}f" gradientUnits="userSpaceOnUse" x1="0" y1={frame.y0} x2="0" y2={frame.y1}>
			<stop offset="0" style="stop-color:rgb(var(--hud-glass-top-rgb));stop-opacity:var(--hud-glass-top-a)" />
			<stop offset=".45" style="stop-color:rgb(var(--hud-glass-mid-rgb));stop-opacity:var(--hud-glass-mid-a)" />
			<stop offset="1" style="stop-color:rgb(var(--hud-glass-bottom-rgb));stop-opacity:var(--hud-glass-bottom-a)" />
		</linearGradient>
		<linearGradient id="{id}s" gradientUnits="userSpaceOnUse" x1={frame.x0} y1="0" x2={frame.x1} y2="0">
			<stop offset="0" style="stop-color:rgb(var(--hud-ink-rgb));stop-opacity:0" />
			<stop offset={p} style="stop-color:rgb(var(--hud-ink-rgb));stop-opacity:var(--hud-spec-a)" />
			<stop offset="1" style="stop-color:rgb(var(--hud-ink-rgb));stop-opacity:0" />
		</linearGradient>
	</defs>
	<path d={outline.fill} fill="url(#{id}f)" />
	<path d={outline.spec} stroke="url(#{id}s)" stroke-width="1" fill="none" />
	<path d={outline.top} stroke="url(#{id}t)" stroke-width="1" fill="none" />
	<path d={outline.bot} stroke="url(#{id}b)" stroke-width="1" fill="none" />
	{#if ante > 1}<path d={outline.top} fill="none" style="stroke:rgb(var(--hud-accent-hi-rgb));stroke-opacity:.2" stroke-width="5" stroke-linecap="round" />{/if}
	{#if ante}<path d={outline.top} fill="none" style="stroke:rgb({ante > 1 ? 'var(--hud-accent-ink-rgb)' : 'var(--hud-accent-rgb)'});stroke-opacity:{ante > 1 ? 1 : 0.92}" stroke-width={ante > 1 ? 1.4 : 1.2} stroke-linecap="round" />{/if}
</svg>
