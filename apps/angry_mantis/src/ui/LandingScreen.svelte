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
	import { sound } from '../game/sound';
	import { LANDING_CARDS } from './landingCards';
	import Icon from './Icon.svelte';

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

	// The audiosprite is roughly a third of the payload and downloads in parallel with the images
	// (game/sound.ts), so the bar blends both — otherwise it parks at 100% for however long the
	// audio still needs. Weights are a fixed approximation of the byte split; the label switches to
	// LOADING AUDIO once the images are done so a long audio tail doesn't look like a hang.
	const IMAGE_WEIGHT = 0.7;
	const AUDIO_WEIGHT = 0.3;
	const audioReady = $derived(sound.isReady);
	// stateApp.loadingProgress now ticks once per settled asset promise (pixi-svelte AssetsLoader),
	// so it moves continuously through the image phase; `loaded` still pins the readout to exactly
	// 100 at the moment the phase closes, so rounding can never leave it at 99.
	// the gate is the PRELOAD phase (game/assets.ts): the deferred keys keep downloading behind the game
	const imageProgress = $derived(context.stateApp.preLoaded ? 100 : context.stateApp.loadingProgress);
	const progress = $derived(
		Math.round(Math.min(100, imageProgress * IMAGE_WEIGHT + sound.progress * 100 * AUDIO_WEIGHT)),
	);
	const loadingLabel = $derived(context.stateApp.preLoaded && !audioReady ? 'LOADING AUDIO' : 'LOADING');
	// An asset that exhausted its retries stops the load dead (AssetsLoader leaves `loaded` false and
	// lists the keys): entering with missing money glyphs / headshots / mode labels is worse than
	// asking for a tap. Audio is deliberately NOT in here — a dead audiosprite lets the player in
	// silently by design (sound.isReady goes true on error), which is why the gate below still hangs
	// off `ready` alone.
	const assetsFailed = $derived(context.stateApp.failedAssets.length > 0);
	// audio joins images + fonts in the gate: PRESS ANYWHERE must not appear over a silent game
	const ready = $derived(context.stateApp.preLoaded && fontsReady && audioReady);

	// per-kind sizing (master units). Phone-sideways is authored large so touch targets stay ≥44 CSS px.
	const SZ = $derived(
		kind === 'phone'
			? { logoW: 380, tag: 22, cardW: 660, cardH: 0, imgBig: 118, imgMini: 118, title: 24, body: 17, arrow: 132, dot: 14, barW: 520, barH: 14, press: 30, pad: 26 }
			: kind === 'portrait'
				? { logoW: 250, tag: 13, cardW: 284, cardH: 470, imgBig: 104, imgMini: 60, title: 16, body: 13, arrow: 74, dot: 8, barW: 280, barH: 10, press: 17, pad: 16 }
				: { logoW: 300, tag: 14, cardW: 206, cardH: 0, imgBig: 84, imgMini: 44, title: 13, body: 12, arrow: 0, dot: 0, barW: 420, barH: 10, press: 18, pad: 16 },
	);
	const carousel = $derived(kind !== 'landscape');
	// arrows are a mouse affordance: a touch device turns pages by swiping (Corey 2026-09-04), so
	// the discs only render for a fine pointer (a desktop browser sized into the phone/portrait masters)
	let coarse = $state(false);
	onMount(() => {
		const mq = window.matchMedia('(pointer: coarse)');
		coarse = mq.matches;
		const h = (e: MediaQueryListEvent) => (coarse = e.matches);
		mq.addEventListener('change', h);
		return () => mq.removeEventListener('change', h);
	});
	const arrows = $derived(carousel && !coarse);
	const arrowW = $derived(arrows ? SZ.arrow : 0);
	const logoSrc = $derived(kind === 'portrait' ? stamp('/assets/ui/logo-wide.webp') : stamp('/assets/ui/logo-landscape.webp'));

	// ── self-rotating carousel ──
	let slide = $state(0);
	// auto page turn every AUTO_MS; a manual turn (swipe, arrow, dot) means the player is reading,
	// so the clock holds for READ_MS before the auto turn resumes (Corey 2026-09-04)
	const AUTO_MS = 4000;
	const READ_MS = 12000;
	let rotateTimer: ReturnType<typeof setTimeout> | undefined;
	const startRotate = (delay = AUTO_MS) => {
		clearTimeout(rotateTimer);
		rotateTimer = setTimeout(() => {
			go(slide + 1);
			startRotate();
		}, delay);
	};
	onMount(() => {
		startRotate();
		return () => clearTimeout(rotateTimer);
	});
	// page turn (Corey 2026-09-04: it's a menu, so pages turn instead of sliding). Forward: the
	// current page swings out on its left edge (spine) and the next page is already underneath.
	// Back: the previous page swings back in on top. One CSS 3D rotation, no filters.
	let turning = $state<{ page: number; dir: 'out' | 'in' } | null>(null);
	const go = (i: number, manual = false) => {
		const n = LANDING_CARDS.length;
		const next = ((i % n) + n) % n;
		if (next === slide) return;
		const forward = i > slide || (slide === n - 1 && next === 0 && i >= n);
		turning = forward ? { page: slide, dir: 'out' } : { page: next, dir: 'in' };
		slide = next;
		if (manual) startRotate(READ_MS);
	};
	const turned = () => (turning = null);
	let swipeX: number | null = null;
	const onPointerDown = (e: PointerEvent) => (swipeX = e.clientX);
	const onPointerUp = (e: PointerEvent) => {
		if (swipeX === null) return;
		const dx = e.clientX - swipeX;
		if (dx < -40) go(slide + 1, true);
		else if (dx > 40) go(slide - 1, true);
		// a plain tap on the card (no swipe) means "continue" — the carousel viewport sits above the
		// full-screen press target, so PRESS ANYWHERE must fall through here too
		else if (Math.abs(dx) < 8) press();
		swipeX = null;
	};

	const press = () => {
		// same tap target serves both states: while assets are missing it retries instead of entering
		if (assetsFailed) {
			context.stateApp.retryFailedAssets?.();
			return;
		}
		if (!ready || pressed) return;
		pressed = true;
		clearTimeout(rotateTimer);
		// the continue press has a voice of its own (the minor click, Corey 2026-09-02); the sprite
		// is guaranteed loaded here — it is one of the things this screen waited for
		sound.players.once.play({ name: 'sfx_ui_minor' });
		props.onpress();
	};
</script>

<div class="landing" class:pressed>
	<!-- full-screen continue target; the carousel controls sit above it -->
	<button class="press-target" aria-label={assetsFailed ? 'Retry loading' : 'Continue'} disabled={pressed || (!ready && !assetsFailed)} onclick={press}></button>

	<div class="fit" style:width="{master.width}px" style:height="{master.height}px" style:transform="translate({left}px, {top}px) scale({scale})">
		<div class="col" style:padding="{SZ.pad}px">
			<div class="logo">
				<img src={logoSrc} alt="Angry Mantis" width={SZ.logoW} draggable="false" />
				<img class="tag" src={stamp('/assets/ui/20000x.webp')} alt="Win up to 20,000×" style:width="{SZ.tag * 12}px" draggable="false" />
			</div>

			{#if carousel}
				<div class="carousel" style:width="{Math.min(master.width - 12, SZ.cardW + arrowW * 2 + 24)}px">
					<div class="viewport" style:width="{SZ.cardW}px" onpointerdown={onPointerDown} onpointerup={onPointerUp}>
						<div class="book">
							{#each LANDING_CARDS as card, i (card.title)}
								<div
									class="slide"
									class:current={i === slide}
									class:turn-out={turning?.page === i && turning.dir === 'out'}
									class:turn-in={turning?.page === i && turning.dir === 'in'}
									onanimationend={turned}
								>
									<div class="card tall" class:cover={card.cover} style:min-height={SZ.cardH ? `${SZ.cardH}px` : undefined}>
										<div class="course" style:font-size="{Math.round(SZ.body * 0.72)}px">{card.course}</div>
										<div class="imgzone" class:emblem={card.cover} style:height="{SZ.imgBig + 8}px">
											{#each card.images as src (src)}
												<img {src} alt="" width={card.images.length > 1 ? SZ.imgMini : SZ.imgBig} height={card.images.length > 1 ? SZ.imgMini : SZ.imgBig} draggable="false" />
											{/each}
										</div>
										<div class="tear"></div>
										<h3 class:cover-title={card.cover} style:font-size="{card.cover ? Math.round(SZ.title * 1.45) : SZ.title}px">{card.title}</h3>
										<p style:font-size="{SZ.body}px">{card.body}</p>
										{#if SZ.cardH}
											<!-- a tall menu page closes with a footer line, like the printed article -->
											<div class="foot" style:font-size="{Math.round(SZ.body * 0.7)}px"><span class="foot-rule"></span>BLOCK B CAFETERIA · {i + 1} OF {LANDING_CARDS.length}<span class="foot-rule"></span></div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
					{#if arrows}
					<button class="arrow left" style:width="{SZ.arrow}px" style:height="{SZ.arrow}px" onclick={() => go(slide - 1, true)} aria-label="Previous"><span class="flip"><Icon name="chevronRight" s={Math.round(SZ.arrow * 0.46)} /></span></button>
					<button class="arrow right" style:width="{SZ.arrow}px" style:height="{SZ.arrow}px" onclick={() => go(slide + 1, true)} aria-label="Next"><Icon name="chevronRight" s={Math.round(SZ.arrow * 0.46)} /></button>
					{/if}
					<div class="dots">
						{#each LANDING_CARDS as card, i (card.title)}
							<button class="dot" class:on={i === slide} style:height="{SZ.dot}px" style:width="{i === slide ? SZ.dot * 2.6 : SZ.dot}px" onclick={() => go(i, true)} aria-label={card.title}></button>
						{/each}
					</div>
				</div>
			{:else}
				<div class="cards">
					{#each LANDING_CARDS as card (card.title)}
						<div class="card" class:cover={card.cover} style:width="{SZ.cardW}px">
							<div class="course" style:font-size="{Math.round(SZ.body * 0.72)}px">{card.course}</div>
							<div class="imgzone" class:emblem={card.cover} style:height="{SZ.imgBig + 8}px">
								{#each card.images as src (src)}
									<img {src} alt="" width={card.images.length > 1 ? SZ.imgMini : SZ.imgBig} height={card.images.length > 1 ? SZ.imgMini : SZ.imgBig} draggable="false" />
								{/each}
							</div>
							<div class="tear"></div>
							<h3 class:cover-title={card.cover} style:font-size="{card.cover ? Math.round(SZ.title * 1.45) : SZ.title}px">{card.title}</h3>
							<p style:font-size="{SZ.body}px">{card.body}</p>
						</div>
					{/each}
				</div>
			{/if}

			<div class="gate">
				{#if assetsFailed}
					<!-- same stencil style as PRESS ANYWHERE; the full-screen target retries instead of entering -->
					<div class="pressText" style:font-size="{SZ.press}px">CONNECTION PROBLEM — TAP TO RETRY</div>
				{:else if !ready}
					<div class="bar" style:width="{SZ.barW}px" style:height="{SZ.barH}px">
						<div class="fill" style:width="{Math.max(4, progress)}%"></div>
					</div>
					<div class="pct" style:font-size="{Math.max(10, SZ.tag * 0.8)}px">{loadingLabel} · {progress}%</div>
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
		/* Corey's art in place of the old text; width tracks the tag font size it replaced (~12x) */
		height: auto;
		filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.7));
	}
	/* the feature tour on meal-ticket stock — same cream, grain, tokens and dashed blocks as the
	   Autoplay / Bonus Buy / Replay / Price List / Game Info tickets. Fixed grid rows keep image,
	   header and description on the same lines across the four cards. */
	.cards {
		display: flex;
		gap: 14px;
		justify-content: center;
	}
	.card {
		--ink: #1b1204;
		--body: #2a241a;
		--muted: #6b6250;
		--rule: #a99c7d;
		position: relative;
		color: var(--body);
		background: linear-gradient(180deg, #ebe3cf, #d9cfb4);
		border-radius: 14px;
		box-shadow: 0 14px 34px rgba(0, 0, 0, 0.6), inset 0 0 0 2px rgba(0, 0, 0, 0.08);
		padding: 12px 14px 14px;
		display: grid;
		grid-template-rows: auto auto auto auto 1fr;
		align-items: start;
		justify-items: center;
		gap: 8px;
		text-align: center;
		overflow: hidden;
	}
	.card::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.035) 0 1px, transparent 1px 3px);
		pointer-events: none;
	}
	.card > * {
		position: relative;
	}
	/* the cover: a double rule inside the stock, the emblem loose (no dashed block), Black Ops title */
	.card.cover {
		box-shadow: 0 14px 34px rgba(0, 0, 0, 0.6), inset 0 0 0 2px rgba(0, 0, 0, 0.08), inset 0 0 0 7px #ebe3cf, inset 0 0 0 9px var(--rule), inset 0 0 0 11px #ebe3cf, inset 0 0 0 12px var(--rule);
	}
	.imgzone.emblem {
		border: 0;
		padding: 0;
	}
	.imgzone.emblem img {
		box-shadow: none;
		border-radius: 0;
		filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.35));
	}
	.card h3.cover-title {
		font-family: 'Black Ops One', var(--ui-font);
		font-weight: 400;
		letter-spacing: 2px;
		line-height: 1.05;
		text-wrap: balance;
	}
	.course {
		font-weight: 800;
		letter-spacing: 3px;
		color: var(--muted);
	}
	.imgzone {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		max-width: 100%;
		padding: 4px 8px;
		border: 2px dashed var(--rule);
		border-radius: 12px;
		box-sizing: content-box;
	}
	.imgzone img {
		border-radius: 10px;
		box-shadow: 0 3px 6px rgba(0, 0, 0, 0.35);
	}
	.tear {
		width: calc(100% + 28px);
		height: 0;
		border-top: 3px dashed var(--rule);
		margin: 2px -14px 0;
	}
	.card h3 {
		margin: 0;
		font-weight: 900;
		letter-spacing: 2.5px;
		color: var(--ink);
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
		align-self: center;
	}
	.card p {
		margin: 0;
		color: var(--body);
		line-height: 1.5;
	}
	.carousel {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		pointer-events: auto;
	}
	.viewport {
		touch-action: pan-y;
		perspective: 1400px;
	}
	/* every page in the same grid cell: the book is as tall as its tallest page */
	.book {
		display: grid;
		transform-style: preserve-3d;
	}
	.slide {
		grid-area: 1 / 1;
		visibility: hidden;
		transform-origin: left center;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}
	.slide.current {
		visibility: visible;
		z-index: 2;
	}
	.slide.turn-out,
	.slide.turn-in {
		visibility: visible;
		z-index: 3;
	}
	.slide.turn-out {
		animation: page-out 1.1s cubic-bezier(0.4, 0, 0.25, 1) both;
	}
	.slide.turn-in {
		animation: page-in 1.1s cubic-bezier(0.4, 0, 0.25, 1) both;
	}
	@keyframes page-out {
		from {
			transform: rotateY(0deg);
		}
		to {
			transform: rotateY(-180deg);
		}
	}
	@keyframes page-in {
		from {
			transform: rotateY(-180deg);
		}
		to {
			transform: rotateY(0deg);
		}
	}
	.card.tall {
		min-height: 100%;
		box-sizing: border-box;
		align-content: start;
		grid-template-rows: auto auto auto auto 1fr auto;
	}
	.foot {
		align-self: end;
		justify-self: stretch;
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 800;
		letter-spacing: 2px;
		color: var(--muted);
		white-space: nowrap;
		padding-top: 8px;
	}
	.foot-rule {
		flex: 1;
		height: 0;
		border-top: 2px dashed var(--rule);
	}
	/* carousel controls on the ticket's dark stamp: ink disc, paper ring, cream chevron */
	.arrow {
		position: absolute;
		top: 42%;
		transform: translateY(-50%);
		border: 3px solid #ebe3cf;
		border-radius: 999px;
		cursor: pointer;
		background: #2a241a;
		color: #ebe3cf;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 3px 0 rgba(0, 0, 0, 0.45), 0 8px 18px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12);
		z-index: 3;
	}
	.arrow:active {
		transform: translateY(calc(-50% + 2px));
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.45), 0 4px 10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12);
	}
	.arrow.left {
		left: 0;
	}
	.arrow .flip {
		display: inline-flex;
		transform: scaleX(-1);
	}
	.arrow.right {
		right: 0;
	}
	.dots {
		display: flex;
		gap: 8px;
		position: relative;
		z-index: 4; /* never under a page: the book's tallest page sets the height, the dots sit below it */
		margin-top: 18px;
	}
	.dot {
		border: 2px solid rgba(235, 227, 207, 0.55);
		border-radius: 999px;
		padding: 0;
		background: transparent;
		cursor: pointer;
		transition: all 0.2s ease;
		box-sizing: border-box;
	}
	.dot.on {
		background: #ebe3cf;
		border-color: #ebe3cf;
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
		.slide.turn-out,
		.slide.turn-in {
			animation-duration: 0.01s;
		}
	}
</style>
