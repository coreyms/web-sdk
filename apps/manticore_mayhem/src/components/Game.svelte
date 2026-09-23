<script lang="ts">
	// registers renderer.prepare (PrepareSystem) — used to pre-upload textures during the loading screen
	import 'pixi.js/prepare';
	import * as PIXI from 'pixi.js';
	import { onMount, tick } from 'svelte';

	import { EnablePixiExtension } from 'components-pixi';
	import { EnableHotkey } from 'components-shared';
	import { MainContainer } from 'components-layout';
	import { App } from 'pixi-svelte';
	import { stateMeta, stateUrlDerived, stateConfig } from 'state-shared';

	import { getContext } from '../game/context';
	import { IS_SOCIAL } from '../game/social';
	import { applyRgsBetModes, betModeMeta } from '../game/betModeMeta';
	import { markAssetsLoaded } from '../game/assetGate';
	import { boot, reportPreload } from '../game/boot.svelte';
	import { sound, startSoundPreload } from '../game/sound';
	import EnableSound from './EnableSound.svelte';
	import EnableGameActor from './EnableGameActor.svelte';
	import ResumeBet from './ResumeBet.svelte';
	import Sound from './Sound.svelte';
	import Background from './Background.svelte';
	import LoadingScreen from './LoadingScreen.svelte';
	import Board from './Board.svelte';
	import SpinWin from './SpinWin.svelte';
	import ModePlaque from './ModePlaque.svelte';
	import Win from './Win.svelte';
	import FreeSpinOutro from './FreeSpinOutro.svelte';
	import Transition from './Transition.svelte';
	import Chrome from '../ui/Chrome.svelte';
	import LandingScreen from '../ui/LandingScreen.svelte';
	import TextWarmup from './TextWarmup.svelte';

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
		if (context.stateApp.preLoaded) startSoundPreload();
	});

	// the deferred Pixi phase must not share a slow link with the audio
	context.stateApp.beforeDeferred = () =>
		new Promise<void>((resolve) => {
			const t0 = performance.now();
			const poll = () => {
				if (sound.isReady || performance.now() - t0 > 30000) resolve();
				else setTimeout(poll, 250);
			};
			poll();
		});

	$effect(() => {
		if (context.stateApp.loaded) markAssetsLoaded();
	});

	// Retina/5K canvases at full DPR are the biggest GPU cost; 1.5x is visually indistinguishable
	// for this art (house rule 3). Renderable GC stays DISABLED (house rule 8, Pixi 8.8.1's
	// CanvasTextPipe dereferences a GC-evicted _gpuText entry with no null guard and takes the HTML
	// chrome down with it): poll until the system has armed its scheduler, THEN cancel it, because
	// a disable issued against the uninitialised system is a silent no-op that init overwrites.
	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;
		let cancelled = false;
		let framesWaited = 0;
		const clamp = () => {
			if (cancelled) return;
			if (!app.renderer) {
				requestAnimationFrame(clamp);
				return;
			}
			if (app.renderer.resolution > 1.5) {
				app.renderer.resolution = 1.5;
				app.resize();
			}
			if (!app.renderer.renderableGC.enabled) {
				if (framesWaited++ < 600) requestAnimationFrame(clamp);
				return;
			}
			app.renderer.renderableGC.enabled = false;
		};
		clamp();
		return () => {
			cancelled = true;
		};
	});

	// GPU warm-up at loading-screen dismissal: pre-upload every mounted TEXTURE (never the stage
	// itself — prepare.upload(stage) also queues Graphics contexts, and a context replaced meanwhile
	// is iterated after it was destroyed) and keep textures resident ~30 min.
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
     game/boot.svelte.ts has the landing screen's own fonts, logo and primer cards is the gate. -->
{#if boot.landingReady}
	<App>
		<EnableSound />
		<EnableHotkey />
		<EnableGameActor />
		<EnablePixiExtension />

		<Background />

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
			<TextWarmup />
			<!-- Sound mounts after the first user interaction (loading screen click) per autoplay rules -->
			<Sound />

			<MainContainer>
				<Board />
			</MainContainer>

			<!-- ALWAYS MOUNTED, visibility-toggled (house rule: the conditional-mount z-order trap).
			     Order here is the z-order: readouts, then the plaque, then the presentations. -->
			<SpinWin />
			<ModePlaque />
			<Win />
			<FreeSpinOutro />
			<Transition />
		{/if}
	</App>
{/if}

<!-- HTML chrome: control bar, feature menu, bet picker, game info -->
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
