<script lang="ts">
	// HTML skin over the Pixi canvas. A FitFrame scales the design master (layoutSpec.ts) exactly like
	// the Pixi MainContainer does, so HTML and canvas coordinates line up. Fades on uiHide / uiShow.
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { EnableSpaceHold, OnHotkey } from 'components-shared';
	import { stateModal } from 'state-shared';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { MASTER, layoutKind, isPhoneSizeType } from '../game/layoutSpec';
	import { ARMOURY } from '../game/constants';
	import { ARMOURY_SWITCH } from '../game/armourySwitch';
	import { createControls } from './controls.svelte';
	import ChromeStyles from './ChromeStyles.svelte';
	import ChromeLandscape from './ChromeLandscape.svelte';
	import ChromePortrait from './ChromePortrait.svelte';
	import ChromePhone from './ChromePhone.svelte';
	import BonusBuyModal from './BonusBuyModal.svelte';
	import AutoplayModal from './AutoplayModal.svelte';
	import DenomModal from './DenomModal.svelte';
	import ReplayModal from './ReplayModal.svelte';
	import GameInfoModal from './GameInfoModal.svelte';
	import NoticeModal from './NoticeModal.svelte';
	import Armoury from './armoury/Armoury.svelte';
	import ArmouryTint from './armoury/ArmouryTint.svelte';
	import { armouryView, hudHiddenByModal } from './armoury/armouryView.svelte';
	import { menuFrame } from './armoury/menuFrame';
	import { pickEase } from './armoury/motion';

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
	// Portrait, the other axis: a phone TALLER than the master (390×844 fits by width, leaving ~66
	// master px of letterbox above and below) used to strand the HUD mid-screen. The Pixi scene stays
	// centred (the frame, the tray, Marty all keep their master y), only the chrome's bottom-anchored
	// HUD reaches down through this extra to the real viewport edge (Corey 2026-09-06).
	const extraBottom = $derived(kind === 'portrait' ? Math.max(0, ((innerHeight.current ?? 1) / scale - master.height) / 2) : 0);

	// THE ARMOURY (DEV switch ?armoury=1, game/armourySwitch.ts; spec feedback/armoury_build_r1): the menu follows the
	// chrome (ui/armoury/menuFrame.ts). It takes over from the old menu only where its layout is built: the desktop
	// layout over the landscape chrome (commit 4). Everywhere else, and always without the switch, the old menu stays.
	const vw = $derived(innerWidth.current ?? 1);
	const vh = $derived(innerHeight.current ?? 1);
	const phone = $derived(isPhoneSizeType(context.stateLayoutDerived.canvasSizeType()));
	const armouryFrame = $derived(menuFrame({ kind, phone, vw, vh, scale, master, fitWidth }, ARMOURY.layout));
	const armouryTakes = $derived(ARMOURY_SWITCH && armouryFrame.layout === 'desktop' && !armouryFrame.hudCopies);
	$effect.pre(() => {
		armouryView.takes = armouryTakes;
	});

	let show = $state(true);
	// the max-win screen's DEEP hide: fades even the `keep` elements (logo, WIN readout). Set
	// outside the `if (show)` guard below — the max flow hides the HUD at the win plate and only
	// deepens it later, so a deep uiHide must land even when the chrome is already faded.
	let deep = $state(false);
	const FADE = 350;
	context.eventEmitter.subscribeOnMount({
		uiShow: async () => {
			deep = false;
			if (!show) {
				show = true;
				await waitForTimeout(FADE);
			}
		},
		uiHide: async (emitterEvent) => {
			const wasDeep = deep;
			deep = emitterEvent.deep ?? false;
			if (show) {
				show = false;
				await waitForTimeout(FADE);
			} else if (deep !== wasDeep) {
				await waitForTimeout(FADE);
			}
		},
	});
</script>

<ChromeStyles />
{#if !controls.isReplay() && !controls.jurisdiction().disabledSpacebar && stateModal.modal == null}<EnableSpaceHold />{/if}
<!-- Space must never spin under an open modal: with a buy mode armed that press is a real 100×–300×
     purchase behind the dialog, and with a parked autoplay loadout it starts the whole run.
     pressGates: while a press-to-continue presentation is up, Space belongs to it alone — otherwise
     the same press also hit controls.spin → stopButtonClick, force-enabling turbo. -->
<OnHotkey
	hotkey="Space"
	disabled={controls.spinDisabled() || controls.isReplay() || controls.jurisdiction().disabledSpacebar || context.stateLayout.showLoadingScreen || stateModal.modal != null || context.stateGame.pressGates > 0}
	onpress={controls.spin}
/>

<!-- The HUD fades out under every modal (Corey 2026-09-02): the paper modals carry their own SPIN/price
     readout, so the dimmed HUD behind them showed the same amount twice; modals live in their own layer.
     uiHide (bonus intro, the wrap-up, max win) fades the HUD too, but NOT the elements marked `keep`:
     the landscape and portrait logos and every layout's WIN readout stay up through every presentation
     (Corey 2026-09-15; the wrap-up total is then readable off the HUD as well as the plate). The phone
     logo shares its column with the prompt, so it still goes with the HUD there. -->
<!-- THE ARMOURY is the one modal the HUD stays up under (hudHiddenByModal): its tint is inside the frame below and the
     BALANCE and bet row are raised above it (the .armoury-open rules), lit; everything else is under the tint. -->
<div
	class="am-ui layer"
	class:hidden={context.stateLayout.showLoadingScreen || hudHiddenByModal(stateModal.modal)}
	class:hud-off={!show}
	class:hud-deep={!show && deep}
	class:armoury-open={armouryView.shown}
	class:armoury-confirm={armouryView.confirm}
	class:armoury-closing={armouryView.closing}
	style:--arm-ease={ARMOURY_SWITCH ? pickEase(ARMOURY.motion) : null}
	style:--arm-back={ARMOURY_SWITCH ? `${ARMOURY.motion.backMs}ms` : null}
	style:--arm-step={ARMOURY_SWITCH ? `${ARMOURY.tint.confirmMs}ms` : null}
	style:--arm-close={ARMOURY_SWITCH ? `${ARMOURY.motion.closeMs}ms` : null}
	style:--arm-dim={ARMOURY_SWITCH ? 1 - ARMOURY.tint.confirmAdd - ARMOURY.tint.opacity : null}
>
	<div class="fit" style:width="{fitWidth}px" style:height="{master.height}px" style:transform="translate({fitLeft}px, {top}px) scale({scale})" style:--fit-scale={scale} style:--vp-extra-bottom="{extraBottom}px">
		{#if kind === 'landscape'}
			<ChromeLandscape {controls} />
		{:else if kind === 'phone'}
			<ChromePhone {controls} />
		{:else}
			<ChromePortrait {controls} />
		{/if}
		{#if ARMOURY_SWITCH}<ArmouryTint {fitLeft} {top} {scale} {vw} {vh} />{/if}
	</div>
</div>

<div class="am-ui layer modals">
	{#if !armouryTakes}<BonusBuyModal {controls} {master} {scale} {left} {top} compact={kind === 'portrait'} />{/if}
	{#if ARMOURY_SWITCH}<Armoury {controls} frame={armouryFrame} takes={armouryTakes} />{/if}
	<AutoplayModal {controls} {master} {scale} {left} {top} compact={kind !== 'landscape'} />
	<DenomModal {controls} {master} {scale} {left} {top} compact={kind !== 'landscape'} />
	<GameInfoModal {controls} {master} {scale} {left} {top} compact={kind !== 'landscape'} />
	<NoticeModal {controls} {master} {scale} {left} {top} compact={kind !== 'landscape'} />
	<ReplayModal {controls} {master} {scale} {left} {top} compact={kind !== 'landscape'} />
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
	.layer.hidden :global(*),
	.layer.hud-off :global(*) {
		pointer-events: none !important;
	}
	/* uiHide: every top-level chrome element fades except the ones marked keep (the logo, the WIN
	   readout). A hud-group container is not faded itself; its children are, keep honoured, so a
	   kept element can sit inside a row (the WIN cell in the landscape trio, Corey 2026-09-15: the
	   wrap-up amount gets a second place to read it). */
	.fit > :global(*),
	:global(.hud-group > *) {
		/* the 0.3 s delay is the RETURN only (below, the hide runs at once): a kept readout that
		   slid to centre while the HUD was away moves back before its row-mates reappear */
		transition: opacity 0.35s ease 0.3s;
	}
	.layer.hud-off .fit > :global(:not(.keep):not(.hud-group)),
	.layer.hud-off :global(.hud-group > :not(.keep)) {
		opacity: 0;
		transition-delay: 0s;
	}
	/* uiHide({ deep: true }) — the max-win screen only: even the kept logo and WIN readout go, so
	   the dimmed canvas carries THEY ATE EVERYTHING / MAX WIN alone (Corey 2026-09-15). */
	.layer.hud-deep .fit > :global(*),
	.layer.hud-deep :global(.hud-group > *) {
		opacity: 0;
	}
	.modals {
		z-index: 60;
	}
	/* THE LIT HUD under THE ARMOURY (spec 2.3; landscape chrome, the only one the Armoury draws over yet). The tint
	   (ArmouryTint, z 11, inside .fit) covers every HUD element; the trio gives up its own stacking so its BALANCE cell
	   and its bet cell (the real minus, readout and plus) can sit above the tint one by one. WIN stays under. The bet
	   readout takes no pointer here (it would open the bet picker, which would replace the menu). In confirm the lit
	   cells step back to 0.16 and take nothing; they come back over the cancel's 330 ms. */
	.layer.armoury-open :global(.trio) {
		z-index: auto;
	}
	.layer.armoury-open :global(.trio > .cell.left),
	.layer.armoury-open :global(.trio > .cell.right) {
		position: relative;
		z-index: 12;
		transition: opacity var(--arm-back) var(--arm-ease);
	}
	.layer.armoury-open :global(.trio .stat) {
		pointer-events: none !important;
	}
	.layer.armoury-confirm :global(.trio > .cell.left),
	.layer.armoury-confirm :global(.trio > .cell.right) {
		opacity: var(--arm-dim);
		transition: opacity var(--arm-step) var(--arm-ease);
	}
	.layer.armoury-confirm :global(.trio > .cell *) {
		pointer-events: none !important;
	}
	.layer.armoury-closing :global(.trio > .cell.left),
	.layer.armoury-closing :global(.trio > .cell.right) {
		transition: opacity var(--arm-close) linear;
	}
	.fit {
		position: absolute;
		left: 0;
		top: 0;
		transform-origin: top left;
		pointer-events: none;
	}
</style>
