<script lang="ts">
	// registers renderer.prepare (PrepareSystem): used to upload textures ahead during the loading screen
	import 'pixi.js/prepare';
	import * as PIXI from 'pixi.js';
	import { onMount, tick } from 'svelte';

	import { EnablePixiExtension } from 'components-pixi';
	import { EnableHotkey } from 'components-shared';
	import { App } from 'pixi-svelte';
	import { stateMeta, stateUrlDerived, stateConfig } from 'state-shared';

	import { getContext } from '../game/context';
	import { IS_SOCIAL } from '../game/social';
	import { applyRgsBetModes, betModeMeta } from '../game/betModeMeta';
	import { markAssetsLoaded } from '../game/assetGate';
	import { guardReplay, replayGuard } from '../game/replayGuard';
	import { renderResolutionCap, renderResolutionFor } from '../game/deviceTier';
	import { RENDER_RESIZE } from '../game/constants';
	import { installPixelDrop } from '../game/pixelDrop';
	import { boot, reportPreload } from '../game/boot.svelte';
	import { releaseMusicSideTracks, sound, startSoundPreload } from '../game/sound';
	import EnableSound from './EnableSound.svelte';
	import EnableGameActor from './EnableGameActor.svelte';
	import ResumeBet from './ResumeBet.svelte';
	import Sound from './Sound.svelte';
	import Background from './Background.svelte';
	import LoadingScreen from './LoadingScreen.svelte';
	import Board from './Board.svelte';
	import HudBeds from './HudBeds.svelte';
	// (the beds belong to the glass dock: the sign bar's pieces carry their own outlines, ui/hudTheme.ts HUD_BAR)
	import { HUD_BAR } from '../ui/hudTheme';
	import Chrome from '../ui/Chrome.svelte';
	import RoundCard from '../ui/RoundCard.svelte';
	import SkipButton from './SkipButton.svelte';
	import WheelGate from '../ui/WheelGate.svelte';
	import LandingScreen from '../ui/LandingScreen.svelte';
	import SymbolPopup from './SymbolPopup.svelte';
	import { landing } from '../game/boardIdle';
	import { GPU_WARM, gpuWarmLog, gpuWarmPending, stageSources, warmSources } from '../game/gpuWarm';
	import { seatedAt } from '../game/scoreboard/show';

	const context = getContext();

	// WHY: authenticate has resolved by the time this mounts, so fold the RGS-declared cost
	// multipliers into the table before anything reads a price from it.
	applyRgsBetModes();
	stateMeta.betModeMeta = betModeMeta;
	// A REPLAY LINK THE RGS DOES NOT SERVE (game/replayGuard.ts): the error card, never the replay card on zeros. Here,
	// before anything that shows or plays the round mounts.
	guardReplay();
	if (import.meta.env.DEV && typeof window !== 'undefined') ((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {}).replayGuard = () => ({ fault: replayGuard.fault });

	// landing flow: the HTML LandingScreen collects the press, then the Pixi LoadingScreen plays
	// the fade transition and calls onloaded. A replay has no landing screen to press.
	let landingPressed = $state(stateUrlDerived.replay());

	// stake.us safety net: the URL param is the documented switch (game/social.ts), but if the
	// operator's authenticate declares a social casino without it, reload once with it set so the
	// module-scope string tables are built in social mode.
	const redirecting = $derived(stateConfig.jurisdiction.socialCasino && !IS_SOCIAL);
	$effect(() => {
		if (stateConfig.jurisdiction.socialCasino && !IS_SOCIAL && typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			if (url.searchParams.get('social') !== 'true') {
				url.searchParams.set('social', 'true');
				window.location.replace(url.toString());
			}
		}
	});

	onMount(() => {
		context.stateLayout.showLoadingScreen = true;
	});

	$effect(() => {
		reportPreload(context.stateApp.preLoaded ? 100 : context.stateApp.loadingProgress);
		// the audio starts once the Pixi preload is in, so the two never share a slow link (the house boot order)
		if (context.stateApp.preLoaded) startSoundPreload();
	});
	// the music's other tracks may be listed once the effects sprite and the base loop are in (game/sound.ts)
	$effect(() => {
		if (sound.isReady) releaseMusicSideTracks();
	});
	// every asset is in: anything waiting on the deferred gate may go (game/assetGate.ts)
	$effect(() => {
		if (context.stateApp.loaded) markAssetsLoaded();
	});

	// Retina and 5K canvases at full density are the biggest GPU cost: the renderer's resolution is capped per
	// device (game/deviceTier.ts, constants RENDER_RESOLUTION_CAP and RENDER_MAX_PIXELS). Renderable GC stays
	// DISABLED (house rule 8: Pixi 8.8.1's CanvasTextPipe dereferences a GC-evicted _gpuText entry with no null
	// guard and takes the HTML chrome down with it): poll until the system has armed its scheduler, THEN cancel
	// it, because a disable issued against the uninitialised system is a silent no-op that init overwrites.
	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;
		let cancelled = false;
		let framesWaited = 0;
		let clamped = false;
		const clamp = () => {
			if (cancelled) return;
			if (!app.renderer) {
				requestAnimationFrame(clamp);
				return;
			}
			// the boot's clamp, once (this function is polled below until the GC system is armed)
			if (!clamped) {
				clamped = true;
				applyResolution(app, true);
				// textures stay resident about 30 min from the start (game/gpuWarm.ts): a texture sent up while the player
				// waits on the press screen is never unloaded by the GC's one minute idle limit and sent up again after it
				app.renderer.textureGC.maxIdle = GPU_WARM.gcMaxIdle;
				// THE SECOND COPY LET GO (game/pixelDrop.ts, constants PIXEL_DROP): from here every picture's decoded copy is
				// closed once it is on the GPU (what went up before this is looked at too), with the lost-context restore
				installPixelDrop(app.renderer as PIXI.Renderer);
			}
			if (!app.renderer.renderableGC.enabled) {
				if (framesWaited++ < 600) requestAnimationFrame(clamp);
				return;
			}
			app.renderer.renderableGC.enabled = false;
		};
		clamp();
		// the pixel ceiling follows the window: recomputed when the size has stood still for settleMs, so a drag
		// changes the renderer's resolution at most once, at its end
		let settle: ReturnType<typeof setTimeout> | undefined;
		const onResize = () => {
			clearTimeout(settle);
			settle = setTimeout(() => {
				if (!cancelled && app.renderer) applyResolution(app, false);
			}, RENDER_RESIZE.settleMs);
		};
		window.addEventListener('resize', onResize);
		return () => {
			cancelled = true;
			clearTimeout(settle);
			window.removeEventListener('resize', onResize);
		};
	});

	/** the renderer's resolution for the window as it is now (game/deviceTier.ts renderResolutionFor). `first`: the
	 *  boot's clamp, applied whatever the difference. Later (a resize): only outside the hysteresis band, or back to
	 *  the plain cap. */
	const applyResolution = (app: PIXI.Application, first: boolean) => {
		const want = renderResolutionFor(window.innerWidth, window.innerHeight);
		const now = app.renderer.resolution;
		if (want === now) return;
		const plain = Math.min(window.devicePixelRatio || 1, renderResolutionCap());
		if (!first && Math.abs(want - now) <= now * RENDER_RESIZE.band && want !== plain) return;
		app.renderer.resolution = want;
		app.resize();
	};

	// THE GPU WARM-UP (game/gpuWarm.ts): every texture on the stage goes to the GPU WHILE THE PRESS SCREEN WAITS (the
	// press gate open: the preload is in and the board, the first board's columns, the scene, the logo and the LED board
	// playing the press screen are all on the stage), a source a frame after the render, skipping what is already there.
	// At the press a second pass takes only what was added since (the HUD's beds); normally it finds everything resident,
	// so the first frames after the press upload nothing. A source destroyed or let go meanwhile is never sent up.
	let warmedAtPress = false;
	const warmGpu = async (pass: string) => {
		const app = context.stateApp.pixiApplication;
		if (!app?.renderer) return;
		await tick();
		await warmSources(app, stageSources(app.stage), pass);
	};
	$effect(() => {
		// the press screen is up and its gate open; a replay (no press screen) warms at its loading screen's end instead.
		// It waits out the LED board's rise (game/scoreboard/show.ts seatedAt, plus GPU_WARM.afterSeatMs) so no upload
		// lands in the frames of that motion; a press before then leaves it all to the press's pass.
		if (warmedAtPress || !context.stateApp.preLoaded || !boot.pressReady || !context.stateLayout.showLoadingScreen || !context.stateApp.pixiApplication) return;
		warmedAtPress = true;
		setTimeout(() => {
			if (context.stateLayout.showLoadingScreen) void warmGpu('press screen');
		}, seatedAt() + GPU_WARM.afterSeatMs);
	});
	if (import.meta.env.DEV && typeof window !== 'undefined') ((window as any).__reindeer ??= {}).gpuWarm = { log: gpuWarmLog, pending: gpuWarmPending, spec: () => ({ ...GPU_WARM }) };
</script>

<!-- LANDING FIRST: <App> is what starts pixi-svelte's AssetsLoader. Holding it unmounted until
     game/boot.svelte.ts has the landing screen's own fonts is the gate. -->
{#if boot.landingReady}
	<App>
		<EnableSound />
		<EnableHotkey />
		<EnableGameActor />
		<EnablePixiExtension />

		<Background />
		<!-- THE BOARD: the road, its traffic and the line win (game/road/roadBoard.ts). Mounted the moment the preload is
		     in, so the landing screen stands over the real board; ONE mount for the whole session, before the loading
		     screen's fade, so nothing mounted later can land under it (the conditional mount z order trap). -->
		{#if context.stateApp.preLoaded}<Board />{/if}
		<!-- the dark beds under the HUD zones that would sit on snow (components/HudBeds.svelte) -->
		{#if !context.stateLayout.showLoadingScreen && HUD_BAR === 'dock'}<HudBeds />{/if}

		{#if context.stateLayout.showLoadingScreen}
			<LoadingScreen
				play={landingPressed}
				led={boot.ledSign}
				onloaded={() => {
					// under the fade's black: the landing's posed board goes before anything of the game shows
					context.eventEmitter.broadcast({ type: 'boardLandingEnd' });
					context.stateLayout.showLoadingScreen = false;
					void warmGpu('press');
					// A REPLAY (src/app.html #am-splash.am-replay): the splash's backdrop has stood under the round card since the
					// first paint; the game is drawn now (the fade through black's darkest moment), so it leaves with the
					// splash's own exit
					if (stateUrlDerived.replay()) window.__amSplash?.done();
				}}
			/>
		{:else}
			<ResumeBet />
			<!-- Sound mounts after the first user interaction (loading screen click) per autoplay rules -->
			<Sound />
		{/if}
	</App>
{/if}

<!-- HTML chrome: control bar, feature menu, bet picker, game info. Always the top layer (house rule). -->
{#if !redirecting}
	<Chrome />
	<!-- SKIP TO RESULT in a bonus round (components/SkipButton.svelte, Manticore's, 2026-11-19): its own layer over the HUD -->
	<SkipButton />
	<!-- the symbol pay popup on an idle board (components/SymbolPopup.svelte): over the HUD, under the cards and modals -->
	<SymbolPopup />
	<!-- the bonus round's intro and wrap-up cards (keyed, so each card mounts fresh with its own press gate) -->
	{#if context.stateGame.roundCard}{#key context.stateGame.roundCard}<RoundCard card={context.stateGame.roundCard} />{/key}{/if}
	<!-- THE SUPER WHEEL waits for its press (ui/WheelGate.svelte) -->
	{#if context.stateGame.wheelPhase === 'rest'}<WheelGate />{/if}
	{#if context.stateLayout.showLoadingScreen && !stateUrlDerived.replay()}
		<LandingScreen
			onpress={() => {
				landingPressed = true;
				// the symbol pay popup's first tap window starts here (symbolPopupSpec FIRST_TAP)
				landing.pressedAt = performance.now();
			}}
		/>
	{/if}
{/if}

<style lang="scss">
	:global(html) {
		font-size: 16px;
		@media screen and (max-width: 500px) {
			font-size: 50%;
		}
	}
</style>
