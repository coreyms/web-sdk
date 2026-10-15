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
	import { createControls } from './controls.svelte';
	import ChromeStyles from './ChromeStyles.svelte';
	import ChromeLandscape from './ChromeLandscape.svelte';
	import ChromePortrait from './ChromePortrait.svelte';
	import ChromePhone from './ChromePhone.svelte';
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

	// THE ARMOURY (spec feedback/armoury_build_r1): the feature menu, in every layout (desktop, portrait phone, tablet,
	// sideways, and the desktop box scaled on small 16:9 frames). It follows the chrome (ui/armoury/menuFrame.ts).
	const vw = $derived(innerWidth.current ?? 1);
	const vh = $derived(innerHeight.current ?? 1);
	const phone = $derived(isPhoneSizeType(context.stateLayoutDerived.canvasSizeType()));
	const armouryFrame = $derived(menuFrame({ kind, phone, vw, vh, scale, master, fitWidth }, ARMOURY.layout));
	// the real HUD's BALANCE and bet row are lit above the tint in every layout but the desktop box scaled onto a phone
	// sideways chrome (the small 16:9 frames): there the menu draws its own copies and the whole HUD stays under the tint
	const armouryLit = $derived(armouryView.shown && !armouryFrame.hudCopies);
	// ...and there the real HUD steps aside under the tint (the spec 2.3 fallback), so its own BALANCE and bet never show
	// twice beside the menu's copies
	const armouryCopies = $derived(armouryView.shown && armouryFrame.hudCopies);

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
	class:armoury-lit={armouryLit}
	class:armoury-copies={armouryCopies}
	class:armoury-snap={armouryView.snapping}
	data-chrome={kind}
	class:armoury-confirm={armouryView.confirm}
	class:armoury-closing={armouryView.closing}
	style:--arm-ease={pickEase(ARMOURY.motion)}
	style:--arm-back="{armouryView.reduced ? 0 : ARMOURY.motion.backMs}ms"
	style:--arm-step="{armouryView.reduced ? 0 : ARMOURY.tint.confirmMs}ms"
	style:--arm-close="{armouryView.reduced ? 0 : ARMOURY.motion.closeMs}ms"
	style:--arm-dim={1 - ARMOURY.tint.confirmAdd - ARMOURY.tint.opacity}
>
	<div class="fit" style:width="{fitWidth}px" style:height="{master.height}px" style:transform="translate({fitLeft}px, {top}px) scale({scale})" style:--fit-scale={scale} style:--vp-extra-bottom="{extraBottom}px">
		{#if kind === 'landscape'}
			<ChromeLandscape {controls} />
		{:else if kind === 'phone'}
			<ChromePhone {controls} />
		{:else}
			<ChromePortrait {controls} />
		{/if}
		<ArmouryTint {fitLeft} {top} {scale} {vw} {vh} />
	</div>
</div>

<div class="am-ui layer modals">
	<Armoury {controls} frame={armouryFrame} />
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
	/* THE LIT HUD under THE ARMOURY (spec 2.3). The tint (ArmouryTint, z 11, inside .fit) covers every HUD element; the
	   pieces that stay lit (the BALANCE readout, the bet readout and its two steppers) are the real HUD's own elements,
	   raised above it one by one (z 12), so the steppers are the real ones (rules, sounds, disabled states). Their row
	   gives up its own stacking so its cells can be ordered alone. WIN, Spin, the feature button, autoplay and turbo
	   stay under. The bet readout takes no pointer (it would open the bet picker, which would replace the menu). In
	   confirm the lit pieces step back to 0.16 and take nothing; they come back over the cancel's 330 ms. Per chrome:
	     landscape (desktop): the trio's BALANCE cell and its bet cell (minus, readout, plus)
	     portrait (portrait phone, tablet): the .stats row (BALANCE, bet readout) and the grid's plus and minus
	     phone (sideways): the column's BALANCE and its .spin-row (minus, readout, plus)
	   Not lit on the phone chrome's small 16:9 frames (the desktop box scaled): the menu draws its own copies there. */
	.layer.armoury-lit[data-chrome='landscape'] :global(.trio),
	.layer.armoury-lit[data-chrome='portrait'] :global(.bar),
	.layer.armoury-lit[data-chrome='phone'] :global(.stats) {
		z-index: auto;
	}
	.layer.armoury-lit[data-chrome='landscape'] :global(.trio > .cell.left),
	.layer.armoury-lit[data-chrome='landscape'] :global(.trio > .cell.right),
	.layer.armoury-lit[data-chrome='portrait'] :global(.stats),
	.layer.armoury-lit[data-chrome='portrait'] :global(.bar .grid > :nth-child(2)),
	.layer.armoury-lit[data-chrome='portrait'] :global(.bar .grid > :nth-child(4)),
	.layer.armoury-lit[data-chrome='phone'] :global(.stats > :first-child),
	.layer.armoury-lit[data-chrome='phone'] :global(.stats > .spin-row) {
		z-index: 12;
		transition: opacity var(--arm-back) var(--arm-ease);
	}
	.layer.armoury-lit[data-chrome='landscape'] :global(.trio > .cell.left),
	.layer.armoury-lit[data-chrome='landscape'] :global(.trio > .cell.right),
	.layer.armoury-lit[data-chrome='phone'] :global(.stats > :first-child),
	.layer.armoury-lit[data-chrome='phone'] :global(.stats > .spin-row) {
		position: relative;
	}
	.layer.armoury-lit[data-chrome='landscape'] :global(.trio .stat),
	.layer.armoury-lit[data-chrome='portrait'] :global(.stats .stat),
	.layer.armoury-lit[data-chrome='phone'] :global(.spin-row .stat) {
		pointer-events: none !important;
	}
	.layer.armoury-lit.armoury-confirm[data-chrome='landscape'] :global(.trio > .cell.left),
	.layer.armoury-lit.armoury-confirm[data-chrome='landscape'] :global(.trio > .cell.right),
	.layer.armoury-lit.armoury-confirm[data-chrome='portrait'] :global(.stats),
	.layer.armoury-lit.armoury-confirm[data-chrome='portrait'] :global(.bar .grid > :nth-child(2)),
	.layer.armoury-lit.armoury-confirm[data-chrome='portrait'] :global(.bar .grid > :nth-child(4)),
	.layer.armoury-lit.armoury-confirm[data-chrome='phone'] :global(.stats > :first-child),
	.layer.armoury-lit.armoury-confirm[data-chrome='phone'] :global(.stats > .spin-row) {
		opacity: var(--arm-dim);
		transition: opacity var(--arm-step) var(--arm-ease);
	}
	/* the phone chrome's BALANCE is a TrioStat itself, whose own rule holds it at opacity 1 !important */
	.layer.armoury-lit.armoury-confirm[data-chrome='phone'] :global(.stats > .stat:first-child) {
		opacity: var(--arm-dim) !important;
	}
	.layer.armoury-lit.armoury-confirm[data-chrome='landscape'] :global(.trio > .cell *),
	.layer.armoury-lit.armoury-confirm[data-chrome='portrait'] :global(.stats *),
	.layer.armoury-lit.armoury-confirm[data-chrome='portrait'] :global(.bar .grid *),
	.layer.armoury-lit.armoury-confirm[data-chrome='phone'] :global(.stats *) {
		pointer-events: none !important;
	}
	.layer.armoury-lit.armoury-closing[data-chrome='landscape'] :global(.trio > .cell.left),
	.layer.armoury-lit.armoury-closing[data-chrome='landscape'] :global(.trio > .cell.right),
	.layer.armoury-lit.armoury-closing[data-chrome='portrait'] :global(.stats),
	.layer.armoury-lit.armoury-closing[data-chrome='portrait'] :global(.bar .grid > :nth-child(2)),
	.layer.armoury-lit.armoury-closing[data-chrome='portrait'] :global(.bar .grid > :nth-child(4)),
	.layer.armoury-lit.armoury-closing[data-chrome='phone'] :global(.stats > :first-child),
	.layer.armoury-lit.armoury-closing[data-chrome='phone'] :global(.stats > .spin-row) {
		transition: opacity var(--arm-close) linear;
	}
	/* a layout change with the menu open (rotation, resize): two frames with no transition anywhere in the HUD, so the lit
	   pieces of a chrome remounted for the new layout simply are what the menu's state says (spec 5.6) */
	.layer.armoury-snap :global(*) {
		transition: none !important;
	}
	/* the small 16:9 frames: the desktop box scaled over the phone sideways chrome draws its own bet controls; the HUD
	   under the tint steps aside (the tint stays) and comes back with the HUD's own return when the menu closes */
	.layer.armoury-copies .fit > :global(:not(.armoury-tint)) {
		opacity: 0;
		transition: opacity var(--arm-step) linear;
	}
	.fit {
		position: absolute;
		left: 0;
		top: 0;
		transform-origin: top left;
		pointer-events: none;
	}
</style>
