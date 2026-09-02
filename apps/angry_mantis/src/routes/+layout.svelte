<script lang="ts">
	import { type Snippet } from 'svelte';
	import { GlobalStyle } from 'components-ui-html';
	import { Authenticate, LoaderStakeEngine, LoadI18n } from 'components-shared';
	import PolyMathIntro from '../ui/PolyMathIntro.svelte';
	import ChromeStyles from '../ui/ChromeStyles.svelte';
	import Game from '../components/Game.svelte';
	import { setContext } from '../game/context';
	import { startSoundPreload } from '../game/sound';

	import messagesMap from '../i18n/messagesMap';

	type Props = { children: Snippet };

	const props: Props = $props();

	let showIntro = $state(false);

	const loaderUrlStakeEngine = new URL('../../stake-engine-loader.gif', import.meta.url).href;

	setContext();

	// Start the audiosprite download here, at the very top of the app, so it overlaps the Pixi image
	// preload and the RGS auth round-trip instead of queueing behind them. The landing screen gates
	// PRESS ANYWHERE on it finishing (ui/LandingScreen.svelte).
	startSoundPreload();
</script>

<GlobalStyle>
	<Authenticate>
		<LoadI18n {messagesMap}>
			<Game />
		</LoadI18n>
	</Authenticate>
</GlobalStyle>

<ChromeStyles />
<LoaderStakeEngine src={loaderUrlStakeEngine} oncomplete={() => (showIntro = true)} />

<!-- PolyMath Games intro: after the Stake Engine loader, over the game's loading screen -->
{#if showIntro}
	<PolyMathIntro accent="#9CD92F" oncomplete={() => (showIntro = false)} />
{/if}

{@render props.children()}