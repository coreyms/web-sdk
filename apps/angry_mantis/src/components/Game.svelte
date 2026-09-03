<script lang="ts">
	// registers renderer.prepare (PrepareSystem) — used to pre-upload textures during the loading screen
	import 'pixi.js/prepare';
	import { onMount, tick } from 'svelte';

	import { EnablePixiExtension } from 'components-pixi';
	import { EnableHotkey } from 'components-shared';
	import { MainContainer } from 'components-layout';
	import { App } from 'pixi-svelte';
	import { stateMeta } from 'state-shared';


	import { getContext } from '../game/context';
	import { betModeMeta } from '../game/betModeMeta';
	import EnableSound from './EnableSound.svelte';
	import EnableGameActor from './EnableGameActor.svelte';
	import ResumeBet from './ResumeBet.svelte';
	import Sound from './Sound.svelte';
	import Background from './Background.svelte';
	import LoadingScreen from './LoadingScreen.svelte';
	import BoardFrame from './BoardFrame.svelte';
	import FrameReflections from './FrameReflections.svelte';
	import ReflectSource from './ReflectSource.svelte';
	import DoorSteel from './DoorSteel.svelte';
	import MartyArt from './MartyArt.svelte';
	import Board from './Board.svelte';
	import Anticipations from './Anticipations.svelte';
	import Win from './Win.svelte';
	import ComboWin from './ComboWin.svelte';
	import BonusIntro from './BonusIntro.svelte';
	import FreeSpinOutro from './FreeSpinOutro.svelte';
	import Transition from './Transition.svelte';
	import Mantis from './Mantis.svelte';
	import PoolHud from './PoolHud.svelte';
	import ModePlaque from './ModePlaque.svelte';
	import AllWildTopUp from './AllWildTopUp.svelte';
	import MaxWinCinematic from './MaxWinCinematic.svelte';
		import Chrome from '../ui/Chrome.svelte';
	import LandingScreen from '../ui/LandingScreen.svelte';
	import TextWarmup from './TextWarmup.svelte';

	const context = getContext();

	stateMeta.betModeMeta = betModeMeta;

	// landing flow: the HTML LandingScreen collects the press, then the Pixi LoadingScreen plays
	// the fade transition and calls onloaded
	let landingPressed = $state(false);

	onMount(() => {
		context.stateLayout.showLoadingScreen = true;
	});

	// Retina/5K canvases at full DPR are the biggest GPU cost; 1.5× is visually indistinguishable
	// for this art. stateApp.pixiApplication is assigned BEFORE Application.init() resolves
	// (pixi-svelte InitialiseApplication.svelte) and a class instance isn't deeply reactive, so
	// this effect wakes on the assignment and then polls a frame at a time until the renderer
	// exists (init installs app.resize in the same tick), then clamps. Idempotent per app; later
	// ResizePlugin resizes call renderer.resize(w, h) with no resolution arg, so 1.5 sticks.
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
			// Renderable GC OFF (Pixi 8.8.1 bug, reproduced 2026-09-02). CanvasTextPipe's
			// _destroyRenderableById does `decreaseReferenceCount(this._gpuText[uid].currentKey)`
			// with no null guard, and it is the same method that sets `_gpuText[uid] = null`.
			// RenderableGCSystem.run() evicts any renderable whose _lastUsed is older than
			// maxUnusedTime (default 60s) — and a MOUNTED BUT UNRENDERED PIXI.Text never refreshes
			// _lastUsed, so hidden FadeContainer text and TextWarmup's off-screen nodes are prime
			// candidates. Actively drawn text self-heals (the next frame re-inits the entry), but an
			// unrendered one stays null until something destroys it: a Svelte unmount, or
			// CanvasTextPipe.destroy()'s loop over every _gpuText key. That throws
			// "Cannot read properties of null (reading 'currentKey')" out of root.svelte and takes
			// the whole HTML chrome down with it (zero buttons left in the DOM) on long-idle pages.
			// We destroy our own renderables explicitly, so this safety net only costs us crashes.
			// Disabling cancels all three of the system's schedulers (see its `enabled` setter).
			// Recheck when Pixi ships the null guard; pairs with the ~30 min textureGC.maxIdle below.
			// Ordering trap (live-caught): app.renderer is readable a few frames BEFORE
			// RenderableGCSystem.init() runs, and init sets enabled=true — while the `enabled`
			// setter early-returns when the value already matches, so a disable issued against the
			// uninitialised system is a SILENT no-op that init then overwrites. So poll until the
			// system has armed its scheduler, and only then cancel it. The frame budget keeps this
			// from spinning for the life of the page if a future Pixi ships it off by default.
			if (!app.renderer.renderableGC.enabled) {
				if (framesWaited++ < 600) requestAnimationFrame(clamp);
				return;
			}
			// Verify via `renderer.scheduler._tasks` (the GC's three entries are spliced out), NOT
			// via `renderableGC.enabled` — Pixi's disable branch cancels the schedulers but never
			// clears `_handler`, and the getter is `!!this._handler`, so it keeps reporting true.
			app.renderer.renderableGC.enabled = false;
		};
		clamp();
		return () => {
			cancelled = true;
		};
	});

	// GPU warm-up at loading-screen dismissal: pre-upload every mounted texture (symbol/character
	// atlases, frame, background) so the first win/eat/feature doesn't hitch on lazy upload, and keep
	// textures resident ~30 min (default texture GC evicts after ~60s idle — mid-session eviction means
	// a visible re-upload hitch the next time a rare sprite state appears).
	const warmGpu = async () => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;
		app.renderer.textureGC.maxIdle = 60 * 60 * 30; // frames: ~30 min at 60fps
		await tick(); // main scene mounts in the same flush that hides the loading screen
		await app.renderer.prepare.upload(app.stage);
	};

</script>

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
		<!-- keeps fixed presentation strings' text textures resident (see TextWarmup) -->
		<TextWarmup />
		<!-- Sound mounts after the first user interaction (loading screen click) per browser autoplay rules -->
		<Sound />

		<MainContainer>
			<BoardFrame />
			<!-- reel reflections on the frame's steel lips: masked to the lips, so it never overlaps
			     the window; sits under the reels/door in z-order by template position -->
			<FrameReflections />
		</MainContainer>

		<MainContainer>
			<!-- tags THIS container as what FrameReflections mirrors (reels + anticipations) -->
			<ReflectSource />
			<Board />
			<Anticipations />
		</MainContainer>

		<!-- steel roll-down door: covers the frame window during transitions (doorClose/doorOpen) -->
		<DoorSteel />

		<PoolHud />
		<!-- mode plaque BEFORE the characters: the mantises stand in front of it -->
		<ModePlaque />
		<!-- characters draw over the board (Pixi order) but stay under the HTML chrome buttons -->
		<MainContainer>
			<MartyArt />
		</MainContainer>
		<Mantis />

		<ComboWin />
		<Win />
		<BonusIntro />
		<!-- the all-wild top-up board reads UNDER the cinematic that follows it (both always-mounted,
		     so template order is their z-order) -->
		<AllWildTopUp />
		<MaxWinCinematic />
		<FreeSpinOutro />
		<Transition />
	{/if}
</App>

<!-- HTML chrome (design "Graffiti Grunge"): control bar, bonus buy, bet picker, game info -->
<Chrome />
{#if context.stateLayout.showLoadingScreen}
	<LandingScreen onpress={() => (landingPressed = true)} />
{/if}

<style lang="scss">
	:global(html) {
		font-size: 16px;
		@media screen and (max-width: 500px) {
			font-size: 50%;
		}
	}
</style>
