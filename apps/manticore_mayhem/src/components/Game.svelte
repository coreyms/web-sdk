<script lang="ts">
	// registers renderer.prepare (PrepareSystem) — used to pre-upload textures during the loading screen
	import 'pixi.js/prepare';
	import * as PIXI from 'pixi.js';
	import { onMount, tick, untrack } from 'svelte';

	import { EnablePixiExtension } from 'components-pixi';
	import { EnableHotkey } from 'components-shared';
	import { MainContainer } from 'components-layout';
	import { App } from 'pixi-svelte';
	import { stateBet, stateMeta, stateUrlDerived, stateConfig } from 'state-shared';
	import { checkIsMultipleRevealEvents } from 'utils-book';
	import { settleDeadSpin } from '../game/resumeChoice';

	import { getContext } from '../game/context';
	import { landing } from '../game/boardIdle';
	import { IS_SOCIAL } from '../game/social';
	import { applyRgsBetModes, betModeMeta } from '../game/betModeMeta';
	import { markAssetsLoaded } from '../game/assetGate';
	import { loadDeferredInOrder, loadGate } from '../game/deferredLoad';
	import { gateSettled, loadGate as gateState } from '../game/loadGate.svelte';
	import { loadArmouryCore } from '../game/armouryLoad';
	import { loadCoinFlip } from '../game/coinFlip';
	import { creatureDeferredDone } from '../game/creatureLoad';
	import { epicLandingPassed, epicStartupDone } from '../game/epicLoad';
	import { installPixelDrop } from '../game/pixelDrop';
	import { replayGatePlan } from '../game/replayLoad.svelte';
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
	import BoardFrame from './BoardFrame.svelte';
	import BoardTap from './BoardTap.svelte';
	import CreatureFront from './CreatureFront.svelte';
	import BoardPlaque from './BoardPlaque.svelte';
	import SkipButton from './SkipButton.svelte';
	import SymbolPopup from './SymbolPopup.svelte';
	import SpinRecap from './SpinRecap.svelte';
	import ModePlaque from './ModePlaque.svelte';
	import StingerPlaque from './StingerPlaque.svelte';
	import Win from './Win.svelte';
	import FreeSpinOutro from './FreeSpinOutro.svelte';
	import WarBanner from './WarBanner.svelte';
	import MaxWinCinematic from './MaxWinCinematic.svelte';
	import Transition from './Transition.svelte';
	import Logo from './Logo.svelte';
	import Chrome from '../ui/Chrome.svelte';
	import LandingScreen from '../ui/LandingScreen.svelte';
	import ResumeCard from '../ui/ResumeCard.svelte';
	import TextWarmup from './TextWarmup.svelte';

	const context = getContext();

	// WHY: authenticate has resolved by the time this mounts, so fold the RGS-declared cost
	// multipliers into the table before anything reads a price from it.
	applyRgsBetModes();
	stateMeta.betModeMeta = betModeMeta;

	// landing flow: the HTML LandingScreen collects the press, then the Pixi LoadingScreen plays
	// the fade transition and calls onloaded. A replay has no landing screen to press.
	let landingPressed = $state(stateUrlDerived.replay());
	// THE RESUME CARD (ui/ResumeCard.svelte, game/resumeChoice.ts; a stock rule, Corey 2026-11-18): a load with an
	// unfinished round shows the card in place of the landing screen (never in a replay). Read once: authenticate has
	// answered before this component mounts
	// (a losing base spin an RGS still reports active is finished: no card for it, game/resumeChoice.ts settleDeadSpin)
	const deadSpin = !stateUrlDerived.replay() && settleDeadSpin(stateBet, (bet) => checkIsMultipleRevealEvents({ bookEvents: bet.state }));
	if (import.meta.env.DEV) ((window as any).__manticore ??= {}).deadSpin = () => deadSpin;
	const resuming = !stateUrlDerived.replay() && !!stateBet.betToResume?.active;

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
		// THE GATE (first-minute plan D, constants LOAD_GATE): the win plaque and the symbols' sheets, from the moment the audio
		// is in, and PRESS ANYWHERE waits for them, up to the cap (ui/LandingScreen.svelte; game/deferredLoad.ts loadGate)
		// A REPLAY (game/replayLoad.svelte.ts): the same files, the ones its round draws first, from the moment its card is up
		if (context.stateApp.preLoaded) void loadGate(context.stateApp, () => sound.isReady, untrack(replayGatePlan));
	});
	// the music's side tracks buffer only once the gate is in (game/sound.ts)
	void gateSettled.then(releaseMusicSideTracks);

	// the rest of the deferred Pixi phase must not share a slow link with the audio or the gate: it starts once both are in
	// (the audio: or after AUDIO_WAIT_MS, as before; the gate always settles)
	const AUDIO_WAIT_MS = 30_000;
	const POLL_MS = 250;
	context.stateApp.beforeDeferred = () =>
		new Promise<void>((resolve) => {
			const t0 = performance.now();
			const poll = () => {
				if (gateState.settled && (sound.isReady || performance.now() - t0 > AUDIO_WAIT_MS)) resolve();
				else setTimeout(poll, POLL_MS);
			};
			poll();
		}).then(() => loadDeferredInOrder(context.stateApp)); // his idle sheet, his attacks, the scene, his alternates (game/deferredLoad.ts)

	$effect(() => {
		if (context.stateApp.loaded) markAssetsLoaded();
		// THE ARMOURY's menu core (the feature menu's small pictures, 0.3 to 0.6 MB): the deferred phase's last group, after
		// everything else is in, so it is never in front of anything that loaded before it (game/armouryLoad.ts)
		// ...and when it is in, every deferred group is: the creature's prefetch may start (game/creatureLoad.ts)
		// ...then THE TURNING MEDALLION (the Max Win rain's and the plaque's coins, game/coinFlip.ts): flat W.png until it is in
		// ...and with that start-up loading is over: the Epic's background line may start at rest (game/epicLoad.ts)
		if (context.stateApp.loaded) {
			const renderer = context.stateApp.pixiApplication?.renderer as PIXI.Renderer | undefined;
			void loadArmouryCore()
				.then(creatureDeferredDone)
				.then(() => loadCoinFlip(renderer))
				.then(epicStartupDone);
		}
	});

	// Retina/5K canvases at full DPR are the biggest GPU cost: the renderer's resolution is capped
	// (RENDER_RESOLUTION_CAP: 3 on the phone tier since 2026-10-17 (was 1.5, house rule 3); 2 on desktop since
	// 2026-10-09; off the phone tier also the pixel ceiling RENDER_MAX_PIXELS). Renderable GC stays DISABLED (house rule 8, Pixi 8.8.1's
	// CanvasTextPipe dereferences a GC-evicted _gpuText entry with no null guard and takes the HTML
	// chrome down with it): poll until the system has armed its scheduler, THEN cancel it, because
	// a disable issued against the uninitialised system is a silent no-op that init overwrites.
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
				// THE SECOND COPY LET GO (game/pixelDrop.ts, constants PIXEL_DROP): from here every picture's decoded copy is
				// closed once it is on the GPU (what went up before this is looked at too)
				installPixelDrop(app.renderer as PIXI.Renderer);
			}
			if (!app.renderer.renderableGC.enabled) {
				if (framesWaited++ < 600) requestAnimationFrame(clamp);
				return;
			}
			app.renderer.renderableGC.enabled = false;
		};
		clamp();
		// THE PIXEL CEILING FOLLOWS THE WINDOW (constants RENDER_MAX_PIXELS / RENDER_RESIZE): recomputed when the size
		// has stood still for settleMs, so a drag changes the renderer's resolution at most once, at its end
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
	 *  the plain cap. DEV counts the changes (tools/manticore/res_probe.js). */
	const resChanges = { count: 0, last: 0 };
	const applyResolution = (app: PIXI.Application, first: boolean) => {
		const want = renderResolutionFor(window.innerWidth, window.innerHeight);
		const now = app.renderer.resolution;
		if (want === now) return;
		const plain = Math.min(window.devicePixelRatio || 1, renderResolutionCap());
		if (!first && Math.abs(want - now) <= now * RENDER_RESIZE.band && want !== plain) return;
		app.renderer.resolution = want;
		app.resize();
		resChanges.count += 1;
		resChanges.last = want;
	};
	if (import.meta.env.DEV && typeof window !== 'undefined') ((window as any).__manticore ??= {}).resChanges = () => ({ ...resChanges });

	// DEV, tools/manticore/safari_perf.js (2026-10-18, the Safari lag): every texture's FIRST upload to the GPU from the
	// first call on, [performance.now(), ms the call took, width, height, the file]. Installed by that first call.
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		const log: [number, number, number, number, string][] = [];
		let wrapped = false;
		((window as any).__manticore ??= {}).gpuUploads = () => {
			const sys = context.stateApp.pixiApplication?.renderer?.texture as unknown as { _initSource?: (s: PIXI.TextureSource) => unknown } | undefined;
			if (!wrapped && sys?._initSource) {
				wrapped = true;
				const first = sys._initSource.bind(sys);
				sys._initSource = (s: PIXI.TextureSource) => {
					const t = performance.now();
					const out = first(s);
					const res = s.resource as { src?: string; currentSrc?: string } | undefined;
					log.push([t, performance.now() - t, s.pixelWidth, s.pixelHeight, String(s.label || res?.currentSrc || res?.src || s.uid).split('/').pop()!.split('?')[0]]);
					return out;
				};
			}
			return log.slice();
		};
	}

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

			<!-- THE LOGO, in the canvas in every layout and tier (components/Logo.svelte): straight over the scene and UNDER
			     the creature, the board and everything below this line (a constant mount, so no z order trap) -->
			<Logo />
			<!-- the creature, where he stands BEHIND the board (portrait phone, phone sideways): over the logo -->
			<CreatureFront layer="behind" />

			<MainContainer>
				<!-- the frame + backing (under the board, kicked with it) and the chains (beside it) -->
				<BoardFrame />
				<Board />
				<!-- the board's tap area (draws nothing): a tap during a live spin hurries it, as the Spin press does -->
				<BoardTap />
			</MainContainer>
			<!-- the creature, where he stands IN FRONT of the board (desktop, portrait tablet): over the board, under
			     everything below this line and under the HTML HUD -->
			<CreatureFront layer="front" />

			<!-- ALWAYS MOUNTED, visibility-toggled (house rule: the conditional-mount z-order trap).
			     Order here is the z-order: readouts, then the plaque, then the presentations. -->
			<BoardPlaque />
			<ModePlaque />
			<!-- the animated win plaque: the Big Win and above screen, the feature intro and the wrap up
			     (driven by Win / ModePlaque / FreeSpinOutro through StingerPlaque.svelte's `stingerPlaque.flow`) -->
			<StingerPlaque />
			<!-- THE WAR STANDARD BANNER (components/WarBanner.svelte): the feature intro and the TOTAL WIN wrap up, unrolled
			     from the frame's pole (driven by ModePlaque / FreeSpinOutro through `warBanner.flow`); its roll goes under
			     the frame plate while it is behind the rail (BoardFrame's bannerBackSlot) -->
			<WarBanner />
			<Win />
			<FreeSpinOutro />
			<!-- THE MAX WIN SCREEN (components/MaxWinCinematic.svelte): over the board, the plaques and the win screens, its
			     own dim, the lifted creature and its titles; under the scene transition and the HTML HUD -->
			<MaxWinCinematic />
			<Transition />
		{/if}
	</App>
{/if}

<!-- HTML chrome: control bar, feature menu, bet picker, game info -->
{#if !redirecting}
	<Chrome />
	<!-- the SKIP button and its prompt: HTML over the canvas and the HUD, so the creature never covers it -->
	<SkipButton />
	<!-- the symbol pay popup: a tap on a symbol of an idle board (HTML, takes no pointer) -->
	<SymbolPopup />
	<!-- the recap: a tap on the idle plaque (1.0.04, HTML; only its box takes a press) -->
	<SpinRecap />
	{#if context.stateLayout.showLoadingScreen && !stateUrlDerived.replay() && resuming}
		<ResumeCard
			onchoose={() => {
				landing.pressedAt = performance.now();
				landingPressed = true;
				epicLandingPassed();
			}}
		/>
	{:else if context.stateLayout.showLoadingScreen && !stateUrlDerived.replay()}
		<LandingScreen
			onpress={() => {
				landing.pressedAt = performance.now();
				landingPressed = true;
				epicLandingPassed();
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
