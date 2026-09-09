<script lang="ts">
	// Post-intro landing screen (HTML overlay over the Pixi cafeteria Background): logo, gold loading
	// bar, then PRESS ANYWHERE TO CONTINUE. Nothing else — the feature-tour menu cards were pulled
	// (Corey 2026-09-08) so the live scene (lamps, roaches, fly, birds, fan) is what the player sees
	// while the assets land. Pressing hands off to the Pixi transition via onpress
	// (see components/LoadingScreen.svelte).
	import { onMount } from 'svelte';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';

	import { getContext } from '../game/context';
	import { MASTER, layoutKind } from '../game/layoutSpec';
	import { stamp } from '../game/assets';
	import { sound } from '../game/sound';
	import Shine from './Shine.svelte';

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

	// per-kind sizing (master units)
	const SZ = $derived(
		kind === 'phone'
			? { logoW: 380, tag: 22, barW: 520, barH: 14, press: 30, pad: 26 }
			: kind === 'portrait'
				? { logoW: 250, tag: 13, barW: 280, barH: 10, press: 17, pad: 16 }
				: { logoW: 300, tag: 14, barW: 420, barH: 10, press: 18, pad: 16 },
	);
	const logoSrc = $derived(kind === 'portrait' ? stamp('/assets/ui/logo-wide.webp') : stamp('/assets/ui/logo-landscape.webp'));

	const press = () => {
		// same tap target serves both states: while assets are missing it retries instead of entering
		if (assetsFailed) {
			context.stateApp.retryFailedAssets?.();
			return;
		}
		if (!ready || pressed) return;
		pressed = true;
		// the continue press has a voice of its own (the minor click, Corey 2026-09-02); the sprite
		// is guaranteed loaded here — it is one of the things this screen waited for
		sound.players.once.play({ name: 'sfx_ui_minor' });
		props.onpress();
	};
</script>

<div class="landing" class:pressed>
	<!-- full-screen continue target -->
	<button class="press-target" aria-label={assetsFailed ? 'Retry loading' : 'Continue'} disabled={pressed || (!ready && !assetsFailed)} onclick={press}></button>

	<div class="fit" style:width="{master.width}px" style:height="{master.height}px" style:transform="translate({left}px, {top}px) scale({scale})">
		<div class="col" style:padding="{SZ.pad}px">
			<div class="logo">
				<span class="shine-host" style:width="{SZ.logoW}px"><img src={logoSrc} alt="Angry Mantis" width={SZ.logoW} draggable="false" /><Shine src={logoSrc} /></span>
				<span class="shine-host tag" style:width="{SZ.tag * 12}px"><img src={stamp('/assets/ui/20000x.webp')} alt="Win up to 20,000×" draggable="false" /><Shine src={stamp('/assets/ui/20000x.webp')} /></span>
			</div>

			<div class="gate">
				{#if assetsFailed}
					<!-- same stencil style as PRESS ANYWHERE; the full-screen target retries instead of entering -->
					<div class="pressText" style:font-size="{SZ.press}px">CONNECTION PROBLEM · TAP TO RETRY</div>
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
	.shine-host {
		position: relative;
		display: block;
		filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.7));
	}
	.shine-host img {
		display: block;
		width: 100%;
		height: auto;
	}
	.tag {
		/* branded-glyph tagline in place of the old text; width tracks the tag font size it replaced (~12x) */
		filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.7));
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
	}
</style>
