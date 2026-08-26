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
	import ModeChip from './ModeChip.svelte';
	import ChromeLandscape from './ChromeLandscape.svelte';
	import ChromePortrait from './ChromePortrait.svelte';
	import ChromePhone from './ChromePhone.svelte';
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
	// Portrait: phones inside casino wrappers are often WIDER than the 412×760 master, which then sits
	// letterboxed with side margins the chrome couldn't reach. The portrait chrome only uses edge-relative
	// or centred x positions, so let its fit frame span the real viewport width (vertical stays master-based).
	const fitWidth = $derived(kind === 'portrait' ? Math.max(master.width, (innerWidth.current ?? 1) / scale) : master.width);
	const fitLeft = $derived(kind === 'portrait' ? ((innerWidth.current ?? 1) - fitWidth * scale) / 2 : left);

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
	<div class="fit" style:width="{fitWidth}px" style:height="{master.height}px" style:transform="translate({fitLeft}px, {top}px) scale({scale})">
		{#if kind === 'landscape'}
			<ChromeLandscape {controls} />
		{:else if kind === 'phone'}
			<ChromePhone {controls} />
		{:else}
			<ChromePortrait {controls} />
		{/if}
		<!-- active game-mode plaque, centred under the reel frame in every layout. The portrait fit
		     frame can be wider than the master, so re-centre onto the real board position. -->
		<ModeChip {controls} {kind} offsetX={kind === 'portrait' ? (fitWidth - master.width) / 2 : 0} />
	</div>
</div>

<div class="am-ui layer modals">
	<BonusBuyModal {controls} {master} {scale} {left} {top} compact={kind !== 'landscape'} />
	<DenomModal {controls} {master} {scale} {left} {top} compact={kind !== 'landscape'} />
	<GameInfoModal {controls} {master} {scale} {left} {top} compact={kind !== 'landscape'} />
	<NoticeModal {controls} {master} {scale} {left} {top} compact={kind !== 'landscape'} />
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
