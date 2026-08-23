<script lang="ts">
	import { onMount } from 'svelte';

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
	import AnteLock from './AnteLock.svelte';
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

</script>

<App>
	<EnableSound />
	<EnableHotkey />
	<EnableGameActor />
	<EnablePixiExtension />

	<Background />

	{#if context.stateLayout.showLoadingScreen}
		<LoadingScreen onloaded={() => (context.stateLayout.showLoadingScreen = false)} />
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

		<AnteLock />
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
