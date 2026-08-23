<script lang="ts">
	// HTML skin over the Pixi canvas. A FitFrame scales the design master (layoutSpec.ts) exactly like
	// the Pixi MainContainer does, so HTML and canvas coordinates line up. Fades on uiHide / uiShow.
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { EnableSpaceHold, OnHotkey } from 'components-shared';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { MASTER, layoutKind } from '../game/layoutSpec';
	import { createControls } from './controls.svelte';
	import ChromeStyles from './ChromeStyles.svelte';
	import ChromeLandscape from './ChromeLandscape.svelte';
	import ChromePortrait from './ChromePortrait.svelte';
	import BonusBuyModal from './BonusBuyModal.svelte';
	import DenomModal from './DenomModal.svelte';
	import GameInfoModal from './GameInfoModal.svelte';
	import NoticeModal from './NoticeModal.svelte';

	const context = getContext();
	const controls = createControls();

	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const master = $derived(MASTER[kind]);
	const scale = $derived(Math.min((innerWidth.current ?? 1) / master.width, (innerHeight.current ?? 1) / master.height));
	const left = $derived(((innerWidth.current ?? 1) - master.width * scale) / 2);
	const top = $derived(((innerHeight.current ?? 1) - master.height * scale) / 2);

	let show = $state(true);
	const FADE = 350;
	context.eventEmitter.subscribeOnMount({
		uiShow: async () => {
			if (!show) {
				show = true;
				await waitForTimeout(FADE);
			}
		},
		uiHide: async () => {
			if (show) {
				show = false;
				await waitForTimeout(FADE);
			}
		},
	});
</script>

<ChromeStyles />
<EnableSpaceHold />
<OnHotkey hotkey="Space" disabled={controls.spinDisabled() || controls.isReplay() || context.stateLayout.showLoadingScreen} onpress={controls.spin} />

<div class="am-ui layer" class:hidden={!show || context.stateLayout.showLoadingScreen}>
	<div class="fit" style:width="{master.width}px" style:height="{master.height}px" style:transform="translate({left}px, {top}px) scale({scale})">
		{#if kind === 'landscape'}
			<ChromeLandscape {controls} />
		{:else}
			<ChromePortrait {controls} />
		{/if}
	</div>
</div>

<div class="am-ui layer modals">
	<BonusBuyModal {controls} {master} {scale} {left} {top} compact={kind === 'portrait'} />
	<DenomModal {controls} {master} {scale} {left} {top} compact={kind === 'portrait'} />
	<GameInfoModal {controls} {master} {scale} {left} {top} compact={kind === 'portrait'} />
	<NoticeModal {controls} {master} {scale} {left} {top} compact={kind === 'portrait'} />
</div>

<style>
	.layer {
		position: fixed;
		inset: 0;
		z-index: 20;
		pointer-events: none;
		overflow: hidden;
		transition: opacity 0.35s ease;
	}
	.layer.hidden {
		opacity: 0;
	}
	.layer.hidden :global(*) {
		pointer-events: none !important;
	}
	.modals {
		z-index: 60;
	}
	.fit {
		position: absolute;
		left: 0;
		top: 0;
		transform-origin: top left;
		pointer-events: none;
	}
</style>
