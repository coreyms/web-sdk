<script lang="ts">
	// Loading screen: jungle backdrop (already drawn by Background), logo, slim progress bar, press to continue.
	import { Container, Rectangle, Sprite } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';
	import { MASTER, layoutKind } from '../game/layoutSpec';
	import TransitionAnimation from './TransitionAnimation.svelte';
	import PressToContinue from './PressToContinue.svelte';
	import GameText from './GameText.svelte';

	type Props = { onloaded: () => void };
	const props: Props = $props();
	const context = getContext();

	let loadingType = $state<'start' | 'transition'>('start');
	let fontsReady = $state(false);
	onMount(async () => {
		// Pixi Text rasterises with whatever font is available at draw time — wait for the bundled faces.
		try {
			await Promise.all([document.fonts.load('900 40px Outfit'), document.fonts.load('700 40px Sora')]);
		} catch {}
		fontsReady = true;
	});

	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const master = $derived(MASTER[kind]);
	const logoW = $derived(kind === 'landscape' ? 420 : 300);
	const barW = $derived(kind === 'landscape' ? 360 : 260);
	const progress = $derived(context.stateApp.loadingProgress / 100);
</script>

<FadeContainer show={loadingType === 'start'}>
	<MainContainer>
		<Container x={master.width * 0.5} y={master.height * 0.42}>
			<Sprite key={kind === 'landscape' ? 'logoLandscape' : 'logoWide'} anchor={0.5} width={logoW} height={logoW * (kind === 'landscape' ? 223 / 431 : 157 / 900)} />
			{#if fontsReady}
				<GameText text="WIN UP TO 20,000×" preset="gold" size={kind === 'landscape' ? 26 : 18} y={kind === 'landscape' ? logoW * 0.36 : 60} />
			{/if}
			{#if !context.stateApp.loaded}
				<Container x={-barW / 2} y={kind === 'landscape' ? logoW * 0.46 : 90}>
					<Rectangle width={barW} height={10} borderRadius={5} backgroundColor={0x000000} alpha={0.55} />
					<Rectangle width={Math.max(10, barW * progress)} height={10} borderRadius={5} backgroundColor={0x9cd92f} />
				</Container>
			{/if}
		</Container>
	</MainContainer>
</FadeContainer>

<FadeContainer show={loadingType === 'start' && context.stateApp.loaded && fontsReady}>
	<PressToContinue showText onpress={() => (loadingType = 'transition')} />
</FadeContainer>

<FadeContainer show={loadingType === 'transition'}>
	<TransitionAnimation oncomplete={props.onloaded} />
</FadeContainer>
