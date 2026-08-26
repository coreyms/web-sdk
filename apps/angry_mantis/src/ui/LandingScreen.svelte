<script lang="ts">
	// Post-intro landing screen (HTML overlay over the Pixi jungle Background): logo, feature tour,
	// gold loading bar, then PRESS ANYWHERE TO CONTINUE. Landscape shows all four cards; portrait and
	// phone-sideways run a self-rotating carousel (4s loop; swiping/arrows/dots restart the clock).
	// Pressing hands off to the Pixi transition via onpress (see components/LoadingScreen.svelte).
	import { onMount } from 'svelte';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';

	import { getContext } from '../game/context';
	import { MASTER, layoutKind } from '../game/layoutSpec';
	import { stamp } from '../game/assets';
	import { LANDING_CARDS } from './landingCards';

	type Props = { onpress: () => void };
	const props: Props = $props();
	const context = getContext();

	// canvas text rasterises with whatever font is loaded — gate the handoff like the old screen did
	let fontsReady = $state(false);
	let pressed = $state(false);
	onMount(async () => {
		try {
			await Promise.all([document.fonts.load('900 40px Outfit'), document.fonts.load('700 40px Sora')]);
		} catch {
			/* fall through — fonts.ready best effort */
		}
		fontsReady = true;
	});

	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const master = $derived(MASTER[kind]);
	const scale = $derived(Math.min((innerWidth.current ?? 1) / master.width, (innerHeight.current ?? 1) / master.height));
	const left = $derived(((innerWidth.current ?? 1) - master.width * scale) / 2);
	const top = $derived(((innerHeight.current ?? 1) - master.height * scale) / 2);

	const progress = $derived(Math.round(context.stateApp.loadingProgress));
	const ready = $derived(context.stateApp.loaded && fontsReady);

	// per-kind sizing (master units). Phone-sideways is authored large so touch targets stay ≥44 CSS px.
	const SZ = $derived(
		kind === 'phone'
			? { logoW: 380, tag: 22, cardW: 660, imgBig: 150, imgMini: 72, title: 26, body: 19, arrow: 84, dot: 14, barW: 520, barH: 14, press: 30, pad: 26 }
			: kind === 'portrait'
				? { logoW: 250, tag: 13, cardW: 330, imgBig: 96, imgMini: 44, title: 15, body: 13, arrow: 46, dot: 8, barW: 280, barH: 10, press: 17, pad: 16 }
				: { logoW: 300, tag: 14, cardW: 272, imgBig: 84, imgMini: 40, title: 13, body: 12, arrow: 0, dot: 0, barW: 420, barH: 10, press: 18, pad: 16 },
	);
	const carousel = $derived(kind !== 'landscape');
	const logoSrc = $derived(kind === 'portrait' ? stamp('/assets/ui/logo-wide.webp') : stamp('/assets/ui/logo-landscape.webp'));

	// ── self-rotating carousel ──
	let slide = $state(0);
	let rotateTimer: ReturnType<typeof setInterval> | undefined;
	const startRotate = () => {
		clearInterval(rotateTimer);
		rotateTimer = setInterval(() => {
			slide = (slide + 1) % LANDING_CARDS.length;
		}, 4000);
	};
	onMount(() => {
		startRotate();
		return () => clearInterval(rotateTimer);
	});
	const go = (i: number, manual = false) => {
		slide = ((i % LANDING_CARDS.length) + LANDING_CARDS.length) % LANDING_CARDS.length;
		if (manual) startRotate();
	};
	let swipeX: number | null = null;
	const onPointerDown = (e: PointerEvent) => (swipeX = e.clientX);
	const onPointerUp = (e: PointerEvent) => {
		if (swipeX === null) return;
		const dx = e.clientX - swipeX;
		if (dx < -40) go(slide + 1, true);
		else if (dx > 40) go(slide - 1, true);
		swipeX = null;
	};

	const press = () => {
		if (!ready || pressed) return;
		pressed = true;
		clearInterval(rotateTimer);
		props.onpress();
	};
</script>

<div class="landing" class:pressed>
	<!-- full-screen continue target; the carousel controls sit above it -->
	<button class="press-target" aria-label="Continue" disabled={!ready || pressed} onclick={press}></button>

	<div class="fit" style:width="{master.width}px" style:height="{master.height}px" style:transform="translate({left}px, {top}px) scale({scale})">
		<div class="col" style:padding="{SZ.pad}px">
			<div class="logo">
				<img src={logoSrc} alt="Angry Mantis" width={SZ.logoW} draggable="false" />
				<span class="tag" style:font-size="{SZ.tag}px">WIN UP TO 20,000×</span>
			</div>

			{#if carousel}
				<div class="carousel" style:width="{Math.min(master.width - 12, SZ.cardW + SZ.arrow * 2 + 24)}px">
					<div class="viewport" style:width="{SZ.cardW}px" onpointerdown={onPointerDown} onpointerup={onPointerUp}>
						<div class="track" style:transform="translateX(-{slide * 100}%)">
							{#each LANDING_CARDS as card (card.title)}
								<div class="slide">
									<div class="card tall">
										<div class="imgzone" style:height="{SZ.imgBig + 8}px">
											{#each card.images as src (src)}
												<img {src} alt="" width={card.images.length > 1 ? SZ.imgMini : SZ.imgBig} height={card.images.length > 1 ? SZ.imgMini : SZ.imgBig} draggable="false" />
											{/each}
										</div>
										<h3 style:font-size="{SZ.title}px">{card.title}</h3>
										<p style:font-size="{SZ.body}px">{card.body}</p>
									</div>
								</div>
							{/each}
						</div>
					</div>
					<button class="arrow left" style:width="{SZ.arrow}px" style:height="{SZ.arrow}px" onclick={() => go(slide - 1, true)} aria-label="Previous">‹</button>
					<button class="arrow right" style:width="{SZ.arrow}px" style:height="{SZ.arrow}px" onclick={() => go(slide + 1, true)} aria-label="Next">›</button>
					<div class="dots">
						{#each LANDING_CARDS as card, i (card.title)}
							<button class="dot" class:on={i === slide} style:height="{SZ.dot}px" style:width="{i === slide ? SZ.dot * 2.6 : SZ.dot}px" onclick={() => go(i, true)} aria-label={card.title}></button>
						{/each}
					</div>
				</div>
			{:else}
				<div class="cards">
					{#each LANDING_CARDS as card (card.title)}
						<div class="card" style:width="{SZ.cardW}px">
							<div class="imgzone" style:height="{SZ.imgBig + 8}px">
								{#each card.images as src (src)}
									<img {src} alt="" width={card.images.length > 1 ? SZ.imgMini : SZ.imgBig} height={card.images.length > 1 ? SZ.imgMini : SZ.imgBig} draggable="false" />
								{/each}
							</div>
							<h3 style:font-size="{SZ.title}px">{card.title}</h3>
							<p style:font-size="{SZ.body}px">{card.body}</p>
						</div>
					{/each}
				</div>
			{/if}

			<div class="gate">
				{#if !ready}
					<div class="bar" style:width="{SZ.barW}px" style:height="{SZ.barH}px">
						<div class="fill" style:width="{Math.max(4, progress)}%"></div>
					</div>
					<div class="pct" style:font-size="{Math.max(10, SZ.tag * 0.8)}px">LOADING · {progress}%</div>
				{:else}
					<div class="pressText" style:font-size="{SZ.press}px">PRESS ANYWHERE TO CONTINUE</div>
				{/if}
			</div>
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
	.col {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
	}
	.logo {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}
	.logo img {
		height: auto;
		filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.7));
	}
	.tag {
		font-weight: 900;
		letter-spacing: 3px;
		color: #e8b04a;
		text-shadow: 0 2px 3px rgba(0, 0, 0, 0.7);
	}
	/* fixed grid rows keep image / header / description on the same lines across cards */
	.cards {
		display: flex;
		gap: 14px;
		justify-content: center;
	}
	.card {
		background: linear-gradient(180deg, rgba(10, 15, 8, 0.78), rgba(5, 9, 4, 0.86));
		border: 1px solid rgba(238, 240, 230, 0.1);
		border-radius: 16px;
		padding: 16px 14px;
		display: grid;
		grid-template-rows: auto auto 1fr;
		align-items: start;
		justify-items: center;
		gap: 8px;
		text-align: center;
		overflow: hidden;
	}
	.imgzone {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		max-width: 100%;
	}
	.imgzone img {
		border-radius: 10px;
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
	}
	.card h3 {
		margin: 0;
		font-weight: 900;
		letter-spacing: 1.6px;
		color: #ffdc4a;
		align-self: center;
	}
	.card p {
		margin: 0;
		color: rgba(238, 240, 230, 0.72);
		line-height: 1.5;
	}
	.carousel {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		pointer-events: auto;
	}
	.viewport {
		overflow: hidden;
		touch-action: pan-y;
	}
	.track {
		display: flex;
		transition: transform 0.3s ease;
	}
	.slide {
		flex: 0 0 100%;
	}
	.card.tall {
		min-height: 100%;
	}
	.arrow {
		position: absolute;
		top: 42%;
		transform: translateY(-50%);
		border: none;
		border-radius: 999px;
		cursor: pointer;
		background: linear-gradient(180deg, #ffdc4a, #dfb02c);
		color: #14100a;
		font-size: 1.2em;
		font-weight: 900;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 3px 0 #6b4c00, 0 6px 12px rgba(0, 0, 0, 0.5);
		z-index: 3;
	}
	.arrow.left {
		left: 0;
	}
	.arrow.right {
		right: 0;
	}
	.dots {
		display: flex;
		gap: 8px;
	}
	.dot {
		border: none;
		border-radius: 999px;
		padding: 0;
		background: rgba(255, 255, 255, 0.25);
		cursor: pointer;
		transition: all 0.2s ease;
	}
	.dot.on {
		background: #ffdc4a;
	}
	.gate {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		min-height: 56px;
		justify-content: flex-end;
	}
	.bar {
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.55);
		box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.6);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		border-radius: 6px;
		background: linear-gradient(90deg, #dfb02c, #ffdc4a);
		box-shadow: 0 0 12px rgba(255, 220, 74, 0.5);
		transition: width 0.15s linear;
	}
	.pct {
		font-family: var(--num-font, inherit);
		font-weight: 700;
		letter-spacing: 1.5px;
		color: rgba(238, 240, 230, 0.5);
		font-variant-numeric: tabular-nums;
	}
	.pressText {
		font-weight: 900;
		letter-spacing: 2.5px;
		color: #eef0e6;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.7);
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
		.track {
			transition: none;
		}
	}
</style>
