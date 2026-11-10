<script lang="ts">
	// THE LANDING SCREEN (HTML over the canvas): the title, the loading bar that carries on from the shell splash,
	// then PRESS ANYWHERE. The road itself is drawn behind it by the canvas as soon as the Pixi preload is in
	// (components/Game.svelte). No explainer cards yet: they come with the features they explain.
	import { onMount, untrack } from 'svelte';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';

	import { getContext } from '../game/context';
	import { boot, releaseSplash, splashShare } from '../game/boot.svelte';
	import { MASTER, TITLE, layoutKind } from '../game/layoutSpec';
	import { LOAD_GATE } from '../game/constants';
	import { sound } from '../game/sound';
	import TitleSign from './TitleSign.svelte';

	type Props = { onpress: () => void };
	const props: Props = $props();
	const context = getContext();

	let fontsReady = $state(false);
	let pressed = $state(false);
	onMount(async () => {
		boot.landingMounted = true;
		try {
			await Promise.all([document.fonts.load('900 40px Outfit'), document.fonts.load('700 40px Sora'), document.fonts.load("900 40px 'Overpass'")]);
		} catch {
			/* fall through: fonts.ready best effort */
		}
		fontsReady = true;
	});

	const assetsFailed = $derived(context.stateApp.failedAssets.length > 0);
	// the splash hands over once the Pixi preload is in (or has failed: the retry line must be reachable)
	$effect(() => {
		if (!boot.landingReady) return;
		if (!(context.stateApp.preLoaded || assetsFailed)) return;
		const id = setTimeout(releaseSplash, 350);
		return () => clearTimeout(id);
	});

	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const master = $derived(MASTER[kind]);
	const scale = $derived(Math.min((innerWidth.current ?? 1) / master.width, (innerHeight.current ?? 1) / master.height));
	const left = $derived(((innerWidth.current ?? 1) - master.width * scale) / 2);
	const top = $derived(((innerHeight.current ?? 1) - master.height * scale) / 2);
	const title = $derived(TITLE[kind]);

	// ONE loading scale across the splash and this screen: the bar starts where the splash's stopped and the audio
	// carries it to 100
	const start = Math.round(splashShare() * 100);
	const audioReady = $derived(sound.isReady);
	const rawProgress = $derived(Math.round(Math.min(100, start + (100 - start) * sound.progress)));
	let highWater = $state(0);
	$effect(() => {
		const p = rawProgress;
		untrack(() => {
			if (p > highWater) highWater = p;
		});
	});
	const progress = $derived(Math.max(rawProgress, highWater));
	// the splash's segmented bar: 20 segments lit whole, a jump lighting them 45 ms apart
	const SEG = 20;
	const SEG_PTS = 100 / SEG;
	const STAGGER_MS = 45;
	const litFrom = Math.min(SEG, Math.floor(start / SEG_PTS));
	let lit = $state(litFrom);
	let segDelay = $state<number[]>(Array(SEG).fill(0));
	$effect(() => {
		const m = Math.min(SEG, Math.floor(progress / SEG_PTS));
		untrack(() => {
			if (m <= lit) return;
			const d = segDelay.slice();
			for (let i = lit; i < m; i += 1) d[i] = (i - lit) * STAGGER_MS;
			segDelay = d;
			lit = m;
		});
	});
	const litPct = $derived(lit * SEG_PTS);
	const loadingLabel = $derived(context.stateApp.preLoaded && !audioReady ? 'LOADING AUDIO' : 'LOADING');

	// the audio that never lands must not keep the game shut: PRESS shows after LOAD_GATE.stallMs anyway
	let stalled = $state(false);
	$effect(() => {
		if (!context.stateApp.preLoaded || audioReady) return;
		const id = setTimeout(() => (stalled = true), LOAD_GATE.stallMs);
		return () => clearTimeout(id);
	});
	const ready = $derived(context.stateApp.preLoaded && fontsReady && (audioReady || stalled) && boot.splashOut);

	const GATE = { landscape: { barW: 420, barH: 18, press: 20, pct: 11.5, bottom: 26 }, portrait: { barW: 280, barH: 18, press: 17, pct: 10.5, bottom: 40 }, phone: { barW: 520, barH: 14, press: 30, pct: 17.5, bottom: 34 } } as const;
	const SZ = $derived(GATE[kind]);

	const press = () => {
		// same tap target serves both states: while assets are missing it retries instead of entering
		if (assetsFailed) {
			context.stateApp.retryFailedAssets?.();
			return;
		}
		if (!ready || pressed) return;
		pressed = true;
		// the continue press has a voice of its own (the minor click); dropped silently if the sprite stalled
		if (audioReady) sound.players.once.play({ name: 'sfx_ui_minor' });
		props.onpress();
	};
</script>

<div class="landing" class:pressed>
	<!-- full-screen continue target -->
	<button class="press-target" aria-label={assetsFailed ? 'Retry loading' : 'Continue'} disabled={pressed || (!ready && !assetsFailed)} onclick={press}></button>

	<div class="fit" style:width="{master.width}px" style:height="{master.height}px" style:transform="translate({left}px, {top}px) scale({scale})">
		<!-- the title in the HUD's own title box, so it does not move when the game opens -->
		<div class="title" style:left="{title.x}px" style:top="{title.y}px"><TitleSign width={title.width} height={title.height} lines={title.lines} /></div>

		<div class="gate" style:bottom="{SZ.bottom}px">
			{#if assetsFailed}
				<!-- same display style as PRESS ANYWHERE; the full-screen target retries instead of entering -->
				<div class="pressText" style:font-size="{SZ.press}px">CONNECTION PROBLEM. TAP TO RETRY</div>
			{:else if !ready}
				<!-- the splash's segmented bar: segments, a shine clipped to the lit part, a spark on its edge -->
				<div class="bar gbar" style:width="{SZ.barW}px" style:height="{SZ.barH}px" style:--spark="{(SZ.barH / 1.8) * 2.8}px" aria-hidden="true">
					<div class="gs">
						{#each segDelay as d, i (i)}<i class:on={i < lit} class:still={i < litFrom} style:--d="{d}ms"></i>{/each}
					</div>
					<div class="gw"><div class="gc" style:transform="translateX({litPct - 100}%)"><div class="gi" style:transform="translateX({100 - litPct}%)"><div class="gsh"></div></div></div></div>
					<div class="gk" class:on={lit > 0 && lit < SEG} style:transform="translateX({litPct}%)"><b></b></div>
				</div>
				<div class="pct" style:font-size="{SZ.pct}px">{loadingLabel} {progress}%</div>
			{:else}
				<div class="pressText" style:font-size="{SZ.press}px">PRESS ANYWHERE TO CONTINUE</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.landing {
		position: fixed;
		inset: 0;
		z-index: 30;
		overflow: hidden;
		transition: opacity 0.3s ease;
		font-family: var(--ui-font);
	}
	.landing.pressed {
		opacity: 0;
		pointer-events: none;
	}
	.press-target {
		position: absolute;
		inset: 0;
		z-index: 1;
		border: none;
		background: transparent;
		cursor: pointer;
		padding: 0;
	}
	.press-target:disabled {
		cursor: default;
	}
	.fit {
		position: absolute;
		left: 0;
		top: 0;
		transform-origin: top left;
		pointer-events: none;
		z-index: 2;
	}
	.title {
		position: absolute;
	}
	/* the gate stands on the one panel surface (black glass), so it reads over snow and road alike */
	.gate {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 12px 22px;
		border-radius: 12px;
		background: var(--ui-glass);
		border: 1px solid var(--ui-glass-edge);
		z-index: 5;
	}
	/* THE SPLASH'S SEGMENTED BAR (src/app.html #am-splash .gbar): the same segments, shine and spark in this
	   screen's master px, lit in the game's accent. Only transform and opacity animate. */
	.gbar {
		--accent: #19d3da;
		position: relative;
		padding: 3px;
		box-sizing: border-box;
		border-radius: 5px;
		background: rgba(0, 0, 0, 0.6);
		box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.07);
		transform: skewX(-14deg);
	}
	.gs {
		display: flex;
		gap: 3px;
		height: 100%;
	}
	.gs i {
		flex: 1;
		position: relative;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.06);
	}
	.gs i::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 2px;
		background: linear-gradient(180deg, color-mix(in oklab, var(--accent) 55%, #fff), var(--accent) 55%, color-mix(in oklab, var(--accent) 70%, #000));
		box-shadow: 0 0 8px color-mix(in oklab, var(--accent) 55%, transparent);
		opacity: 0;
		transition: opacity 140ms ease-out var(--d, 0ms);
	}
	.gs i.on::after {
		opacity: 1;
		animation: landing-seg-pop 260ms cubic-bezier(0.2, 1.6, 0.4, 1) var(--d, 0ms);
	}
	/* the segments the splash had lit: lit from the first frame, no pop (the handoff reads as one bar) */
	.gs i.still::after {
		transition: none;
		animation: none;
	}
	@keyframes landing-seg-pop {
		from {
			transform: scaleY(1.6);
		}
		to {
			transform: scaleY(1);
		}
	}
	.gw {
		position: absolute;
		inset: 3px;
		overflow: hidden;
		border-radius: 2px;
	}
	.gc {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}
	.gi {
		position: absolute;
		inset: 0;
	}
	.gc,
	.gi,
	.gk {
		transition: transform 160ms ease-out;
	}
	.gsh {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 22%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
		animation: landing-shine 1800ms ease-in-out 600ms infinite both;
	}
	@keyframes landing-shine {
		0% {
			transform: translateX(-100%);
		}
		70%,
		100% {
			transform: translateX(460%);
		}
	}
	.gk {
		position: absolute;
		inset: 3px;
		opacity: 0;
		pointer-events: none;
	}
	.gk.on {
		opacity: 1;
	}
	.gk b {
		position: absolute;
		left: 0;
		top: 50%;
		width: var(--spark);
		height: var(--spark);
		margin: calc(var(--spark) / -2) 0 0 calc(var(--spark) / -2);
		border-radius: 50%;
		background: radial-gradient(circle, #fff 0 12%, color-mix(in oklab, var(--accent) 50%, #fff) 24%, transparent 62%);
		animation: landing-spark 170ms linear infinite alternate;
	}
	@keyframes landing-spark {
		from {
			transform: scale(0.7) rotate(0);
			opacity: 0.7;
		}
		to {
			transform: scale(1.15) rotate(45deg);
			opacity: 1;
		}
	}
	.pct {
		font-family: var(--ui-font, inherit);
		font-weight: 700;
		letter-spacing: 1.5px;
		color: rgba(238, 240, 230, 0.6);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	/* PRESS ANYWHERE in the game's display face (Overpass Heavy, ChromeStyles --ui-font-display) */
	.pressText {
		font-family: var(--ui-font-display);
		font-weight: var(--ui-display-weight);
		letter-spacing: 0.05em;
		color: #eef0e6;
		white-space: nowrap;
		animation: landing-pulse 1.6s ease-in-out infinite;
	}
	@keyframes landing-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.45;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pressText {
			animation: none;
		}
		.gsh,
		.gk {
			display: none;
		}
		.gs i.on::after {
			animation: none;
		}
	}
</style>
