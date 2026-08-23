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
	import MartyArt from './MartyArt.svelte';
	import Board from './Board.svelte';
	import Anticipations from './Anticipations.svelte';
	import Win from './Win.svelte';
	import BonusIntro from './BonusIntro.svelte';
	import FreeSpinOutro from './FreeSpinOutro.svelte';
	import Transition from './Transition.svelte';
	import Mantis from './Mantis.svelte';
	import PoolHud from './PoolHud.svelte';
	import RetriggerBanner from './RetriggerBanner.svelte';
	import MaxWinCinematic from './MaxWinCinematic.svelte';
	import SessionSummary from './SessionSummary.svelte';
	import ReplayOverlay from './ReplayOverlay.svelte';
	import Chrome from '../ui/Chrome.svelte';

	const context = getContext();

	stateMeta.betModeMeta = betModeMeta;

	onMount(() => {
		context.stateLayout.showLoadingScreen = true;
		// Retina/5K canvases at full DPR are the biggest GPU cost; 1.5× is visually indistinguishable for this art.
		const app = context.stateApp.pixiApplication;
		if (app && app.renderer.resolution > 1.5) {
			app.renderer.resolution = 1.5;
			app.resize();
		}
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
			onloaded={() => {
				context.stateLayout.showLoadingScreen = false;
				warmGpu();
			}}
		/>
	{:else}
		<ResumeBet />
		<!-- Sound mounts after the first user interaction (loading screen click) per browser autoplay rules -->
		<Sound />

		<MainContainer>
			<BoardFrame />
		</MainContainer>

		<MainContainer>
			<Board />
			<Anticipations />
		</MainContainer>

		<PoolHud />
		<!-- characters draw over the board (Pixi order) but stay under the HTML chrome buttons -->
		<MainContainer>
			<MartyArt />
		</MainContainer>
		<Mantis />

		<Win />
		<RetriggerBanner />
		<BonusIntro />
		<SessionSummary />
		<MaxWinCinematic />
		<FreeSpinOutro />
		<Transition />
	{/if}
</App>

<!-- HTML chrome (design "Graffiti Grunge"): control bar, bonus buy, bet picker, game info -->
<Chrome />
<ReplayOverlay />

<style lang="scss">
	:global(html) {
		font-size: 16px;
		@media screen and (max-width: 500px) {
			font-size: 50%;
		}
	}
</style>
