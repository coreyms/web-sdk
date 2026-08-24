<script lang="ts">
	// PolyMath Games intro (from the design's "PolyMath Intro.html"): the six edges of the equilateral
	// mark draw in, nodes pop, the lockup rises. Sequence completes at ~880 ms, holds, then fades out.
	// Shown after the Stake Engine loader, over the game's own loading screen. Accent is one token.
	import { onMount } from 'svelte';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { fade } from 'svelte/transition';

	type Props = { accent?: string; hold?: number; oncomplete?: () => void };
	const { accent = '#9CD92F', hold = 1500, oncomplete }: Props = $props();

	const A = [50, 17.6], B = [14, 80], C = [86, 80], M = [50, 59.2];
	const EDGES: [string, number][] = [
		[`M${A.join(' ')} L${B.join(' ')}`, 0],
		[`M${B.join(' ')} L${C.join(' ')}`, 50],
		[`M${C.join(' ')} L${A.join(' ')}`, 100],
		[`M${A.join(' ')} L${M.join(' ')}`, 165],
		[`M${B.join(' ')} L${M.join(' ')}`, 205],
		[`M${C.join(' ')} L${M.join(' ')}`, 245],
	];
	const NODES: [number, number, number][] = [[...A, 300], [...B, 340], [...C, 380], [...M, 430]] as any;

	const L = { w: 1280, h: 720, mark: 132, stroke: 5, node: 7.5, gapMark: 16, gapWm: 14, wmSize: 56, subSize: 15, subLs: '.52em', ruleW: 180, legalFs: 11, legalB: 40 };
	const P = { w: 412, h: 760, mark: 104, stroke: 5.5, node: 8, gapMark: 12, gapWm: 11, wmSize: 40, subSize: 12, subLs: '.46em', ruleW: 132, legalFs: 10, legalB: 34 };
	const portrait = $derived((innerWidth.current ?? 1) / (innerHeight.current ?? 1) < 0.8);
	const o = $derived(portrait ? P : L);
	const scale = $derived(Math.min((innerWidth.current ?? 1) / o.w, (innerHeight.current ?? 1) / o.h));
	const left = $derived(((innerWidth.current ?? 1) - o.w * scale) / 2);
	const top = $derived(((innerHeight.current ?? 1) - o.h * scale) / 2);

	let show = $state(true);
	onMount(() => {
		const t = setTimeout(() => (show = false), 880 + hold);
		return () => clearTimeout(t);
	});
</script>

{#if show}
	<div class="pm-intro" style:--accent={accent} out:fade={{ duration: 450 }} onoutroend={() => oncomplete?.()} role="presentation">
		<div class="stage" style:width="{o.w}px" style:height="{o.h}px" style:transform="translate({left}px, {top}px) scale({scale})">
			<div class="intro" style:--sub-ls={o.subLs} style:--legal-fs="{o.legalFs}px">
				<div class="lock" style:gap="{o.gapMark}px">
					<div class="glow" style:width="{o.mark * 2.1}px" style:height="{o.mark * 2.1}px" style:top="{-o.mark * 0.55}px"></div>
					<svg class="mark" width={o.mark} height={o.mark} viewBox="0 0 100 100">
						{#each EDGES as [d, delay]}
							<path class="edge" {d} pathLength="1" style:stroke-width={o.stroke} style:animation-delay="{delay}ms" />
						{/each}
						{#each NODES as [cx, cy, delay], i}
							<circle class="node" {cx} {cy} r={o.node} fill={i === 3 ? 'var(--accent)' : '#0B0C10'} stroke={i === 3 ? 'var(--accent)' : '#F4F6FB'} stroke-width={o.stroke} style:animation-delay="{delay}ms" />
						{/each}
					</svg>
					<div class="lockup" style:gap="{o.gapWm}px">
						<div class="wm" style:font-size="{o.wmSize}px">Poly<em>Math</em></div>
						<div class="rule" style:width="{o.ruleW}px"></div>
						<div class="sub" style:font-size="{o.subSize}px">Games</div>
					</div>
				</div>
				<div class="legal" style:bottom="{o.legalB}px">Play responsibly · 18+</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Background lives on the full-viewport layer, not the letterboxed stage, so every aspect is covered. */
	.pm-intro {
		position: fixed;
		inset: 0;
		z-index: 998;
		background: radial-gradient(120% 90% at 50% 42%, #171a22 0%, #0b0c10 62%, #07080b 100%);
		overflow: hidden;
		font-family: 'Outfit', system-ui, sans-serif;
		color: #f4f6fb;
	}
	.pm-intro::after {
		content: '';
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.014) 0 1px, transparent 1px 3px);
		pointer-events: none;
	}
	.stage {
		position: absolute;
		left: 0;
		top: 0;
		transform-origin: top left;
	}
	.intro {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
	}
	.lock {
		display: flex;
		flex-direction: column;
		align-items: center;
		position: relative;
		z-index: 2;
	}
	.glow {
		position: absolute;
		border-radius: 50%;
		background: radial-gradient(circle, color-mix(in oklab, var(--accent) 22%, transparent), transparent 68%);
		opacity: 0;
		animation: glow 520ms ease-out 240ms forwards;
	}
	@keyframes glow {
		0% { opacity: 0; transform: scale(0.7); }
		40% { opacity: 1; }
		100% { opacity: 0.55; transform: scale(1); }
	}
	.mark {
		overflow: visible;
		display: block;
	}
	.edge {
		fill: none;
		stroke: #f4f6fb;
		stroke-linecap: round;
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: draw 260ms cubic-bezier(0.5, 0, 0.25, 1) forwards;
	}
	@keyframes draw { to { stroke-dashoffset: 0; } }
	.node {
		opacity: 0;
		transform-box: fill-box;
		transform-origin: center;
		animation: pop 200ms cubic-bezier(0.2, 1.5, 0.4, 1) forwards;
	}
	@keyframes pop {
		0% { opacity: 0; transform: scale(0.2); }
		60% { opacity: 1; transform: scale(1.18); }
		100% { opacity: 1; transform: scale(1); }
	}
	.lockup {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.wm {
		font-family: 'Sora', system-ui, sans-serif;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1;
		opacity: 0;
		transform: translateY(9px);
		animation: rise 300ms cubic-bezier(0.2, 0.7, 0.2, 1) 490ms forwards;
	}
	.wm em {
		font-style: normal;
		font-weight: 400;
		color: rgba(244, 246, 251, 0.62);
	}
	.rule {
		height: 1px;
		background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--accent) 62%, transparent), transparent);
		transform: scaleX(0);
		animation: rule 300ms cubic-bezier(0.2, 0.7, 0.2, 1) 560ms forwards;
	}
	@keyframes rule { to { transform: scaleX(1); } }
	.sub {
		font-weight: 500;
		color: var(--accent);
		text-transform: uppercase;
		line-height: 1;
		opacity: 0;
		animation: sub 320ms cubic-bezier(0.2, 0.7, 0.2, 1) 580ms forwards;
	}
	@keyframes rise { to { opacity: 1; transform: translateY(0); } }
	@keyframes sub {
		0% { opacity: 0; letter-spacing: 0.02em; transform: translateY(6px); }
		100% { opacity: 0.95; letter-spacing: var(--sub-ls); transform: translateY(0); }
	}
	.legal {
		position: absolute;
		left: 0;
		right: 0;
		text-align: center;
		font-size: var(--legal-fs);
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba(244, 246, 251, 0.26);
		opacity: 0;
		animation: rise 300ms ease-out 660ms forwards;
	}
</style>
