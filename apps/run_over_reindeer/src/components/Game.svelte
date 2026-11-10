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
	import { renderResolutionCap, renderResolutionFor } from '../game/deviceTier';
	import { RENDER_RESIZE } from '../game/constants';
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
	import Chrome from '../ui/Chrome.svelte';
	import LandingScreen from '../ui/LandingScreen.svelte';

	const context = getContext();

	// WHY: authenticate has resolved by the time this mounts, so fold the RGS-declared cost
	// multipliers into the table before anything reads a price from it.
	applyRgsBetModes();
	stateMeta.betModeMeta = betModeMeta;

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

	// GPU warm-up at loading-screen dismissal: upload every mounted TEXTURE ahead (never the stage itself:
	// prepare.upload(stage) also queues Graphics contexts, and a context replaced meanwhile is iterated after it
	// was destroyed) and keep textures resident about 30 min.
	const warmGpu = async () => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;
		app.renderer.textureGC.maxIdle = 60 * 60 * 30;
		await tick();
		const textures = new Set<PIXI.Texture>();
		const walk = (node: PIXI.Container) => {
			const t = (node as PIXI.Sprite).texture;
			if (t instanceof PIXI.Texture && !t.destroyed && t.source) textures.add(t);
			for (const child of node.children) walk(child);
		};
		walk(app.stage);
		await app.renderer.prepare.upload([...textures]);
	};
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
		{#if !context.stateLayout.showLoadingScreen}<HudBeds />{/if}

		{#if context.stateLayout.showLoadingScreen}
			<LoadingScreen
				play={landingPressed}
				onloaded={() => {
					context.stateLayout.showLoadingScreen = false;
					warmGpu();
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
	{#if context.stateLayout.showLoadingScreen && !stateUrlDerived.replay()}
		<LandingScreen onpress={() => (landingPressed = true)} />
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
