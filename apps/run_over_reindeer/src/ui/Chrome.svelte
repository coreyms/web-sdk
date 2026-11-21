<script lang="ts">
	// HTML skin over the Pixi canvas. A FitFrame scales the design master (layoutSpec.ts) exactly like
	// the Pixi MainContainer does, so HTML and canvas coordinates line up. Fades on uiHide / uiShow.
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	// (EnableSpaceHold and OnHotkey are no longer mounted here: ui/SpinHotkey.svelte takes the Space bar, 2026-11-18)
	// import { EnableSpaceHold, OnHotkey } from 'components-shared';
	import { stateModal, stateBet } from 'state-shared';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { MASTER, layoutKind, isPhoneSizeType, landscapeExtraY } from '../game/layoutSpec';
	import { createControls } from './controls.svelte';
	import ChromeStyles from './ChromeStyles.svelte';
	import HudStyles from './hud/HudStyles.svelte';
	import { hudFrame, readSafeInsets, portraitBoardBottoms } from './hud/hudLayout';
	import { readOdoDev } from './hud/winOdometer';
	import ChromeLandscape from './ChromeLandscape.svelte';
	import ChromePortrait from './ChromePortrait.svelte';
	import ChromePhone from './ChromePhone.svelte';
	import AutoplayModal from './AutoplayModal.svelte';
	import DenomModal from './DenomModal.svelte';
	import ReplayModal from './ReplayModal.svelte';
	import GameInfoModal from './GameInfoModal.svelte';
	import SpinHotkey from './SpinHotkey.svelte';
	import NoticeModal from './NoticeModal.svelte';
	import FeatureMenu from './FeatureMenu.svelte';

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
	// centred, only the chrome's bottom-anchored
	// HUD reaches down through this extra to the real viewport edge (Corey 2026-09-06).
	// Desktop, a screen narrower than 16:9 (16:10, 3:2): the screen shows canvas above and below the master
	// (layoutSpec LANDSCAPE_TALL), and the HUD's bottom row rides down by that `extra` to the screen's bottom edge
	// (ui/ChromeLandscape.svelte). 0 at 16:9 and wider.
	const extraBottom = $derived(kind === 'portrait' ? Math.max(0, ((innerHeight.current ?? 1) / scale - master.height) / 2) : kind === 'landscape' ? landscapeExtraY((innerHeight.current ?? 1) / scale) : 0);
	// ...and its top row (the clock strip) rides UP by the same, to the screen's top edge
	const extraTop = $derived(kind === 'landscape' ? extraBottom : 0);

	// THE HUD (the house HUD, Manticore's round 5 "Drop 6" and round 6, this game's "Frost" theme): its planes, in the
	// mockup's own px scaled by this same fit (ui/hud/hudLayout.ts). The safe-area insets are read on a resize or a
	// rotation only.
	const vw = $derived(innerWidth.current ?? 1);
	const vh = $derived(innerHeight.current ?? 1);
	const phone = $derived(isPhoneSizeType(context.stateLayoutDerived.canvasSizeType()));
	const safe = $derived.by(() => {
		void vw;
		void vh;
		return readSafeInsets();
	});
	const hud = $derived(hudFrame({ kind, phone, vw, vh, safe }));
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		// house rule: extend __reindeer, never a new global (tools/hud_probe.mjs reads the HUD's scale, the portrait row's
		// t and the board box the rule placed it under, and drives the game through these)
		((window as any).__reindeer ??= {}).hud = {
			frame: () => ({ variant: hud.variant, u: hud.u, t: hud.t, gap: hud.gap, board: kind === 'portrait' ? portraitBoardBottoms(vw, vh) : null }),
			idle: () => context.stateXstateDerived.isIdle(),
			gates: () => context.stateGame.pressGates,
			win: () => stateBet.winBookEventAmount,
			mode: () => stateBet.activeBetModeKey,
			setMode: (key: string) => (stateBet.activeBetModeKey = key),
			// the run's stops as amounts (ui/controls.svelte.ts startLoadout): fast_lane_probe's autofeature reads them
			autoLimits: () => ({ loss: stateBet.autoSpinsLossLimitAmount, win: stateBet.autoSpinsSingleWinLimitAmount, count: stateBet.autoSpinsCounter }),
			emit: (event: any) => context.eventEmitter.broadcast(event),
			// THE WIN ODOMETER's state (ui/hud/winOdometer.ts; tools/hud_probe.mjs section `cards`): its mode, the total, what
			// the readout reads now (locked digits, '#' for a moving one), the show and the show ms it drew at, the count's
			// end, when it went plain and whether by a skip, the pops played
			winOdometer: () => readOdoDev(),
		};
	}

	let show = $state(true);
	// the max-win screen's DEEP hide: fades even the `keep` elements (logo, WIN readout). Set
	// outside the `if (show)` guard below — the max flow hides the HUD at the win plate and only
	// deepens it later, so a deep uiHide must land even when the chrome is already faded.
	let deep = $state(false);
	// THE HUD UNDER THE BONUS ROUND'S CARDS (2026-11-20, Manticore Unleashed's rule; game/stateGame hudHeld): a plain uiHide
	// while the game holds the HUD leaves it on screen as it is, inert (no pointer, no focus: the press reaches the card's
	// catch as when it was faded), BALANCE and WIN readable. A deep uiHide still takes it all
	let held = $state(false);
	const FADE = 350;
	context.eventEmitter.subscribeOnMount({
		uiShow: async () => {
			held = false;
			deep = false;
			if (!show) {
				show = true;
				await waitForTimeout(FADE);
			}
		},
		uiHide: async (emitterEvent) => {
			if (context.stateGame.hudHeld && !emitterEvent.deep && show) {
				held = true;
				return;
			}
			held = false;
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
<HudStyles />
<!-- ONE PRESS, ONE ROUND (2026-11-18, Corey "Yes"; Manticore Mayhem's fix of harsh review 2026-11-17 M4): the shared
     EnableSpaceHold (hold Space to keep playing) is no longer mounted, so stateBet.isSpaceHold stays false and the bet
     machine's checkSpaceHold never chains a round; SpinHotkey (in place of the shared OnHotkey) ignores the key's
     auto-repeat, so a held Space plays one round. It was:
     {#if !controls.isReplay() && !controls.jurisdiction().disabledSpacebar && stateModal.modal == null}<EnableSpaceHold />{/if} -->
<!-- Space must never spin under an open modal: with a buy mode armed that press is a real 100×–300×
     purchase behind the dialog, and with a parked autoplay loadout it starts the whole run.
     pressGates: while a press-to-continue presentation is up, Space belongs to it alone — otherwise
     the same press also hit controls.spin → stopButtonClick, force-enabling turbo. -->
<SpinHotkey
	disabled={controls.spinDisabled() || controls.isReplay() || controls.jurisdiction().disabledSpacebar || context.stateLayout.showLoadingScreen || stateModal.modal != null || context.stateGame.pressGates > 0}
	onpress={controls.spin}
/>

<!-- The HUD fades out under every modal (Corey 2026-09-02): the paper modals carry their own SPIN/price
     readout, so the dimmed HUD behind them showed the same amount twice; modals live in their own layer.
     uiHide (bonus intro, the wrap-up, max win) fades the HUD too, but NOT the elements marked `keep`:
     the landscape and portrait logos and every layout's WIN readout stay up through every presentation
     (Corey 2026-09-15; the wrap-up total is then readable off the HUD as well as the plate). The phone
     logo shares its column with the prompt, so it still goes with the HUD there.
     Since 2026-11-20 the bonus round's cards hold the HUD on screen instead (hud-held, game/stateGame hudHeld): inert,
     BALANCE and WIN readable under the entry and the wrap-up. -->
<div
	class="am-ui layer"
	class:hidden={context.stateLayout.showLoadingScreen || stateModal.modal != null}
	class:hud-off={!show}
	class:hud-deep={!show && deep}
	class:hud-held={held}
	inert={held}
	data-chrome={kind}
>
	<div class="fit" style:width="{fitWidth}px" style:height="{master.height}px" style:transform="translate({fitLeft}px, {top}px) scale({scale})" style:--fit-scale={scale} style:--vp-extra-bottom="{extraBottom}px" style:--vp-extra-top="{extraTop}px">
		{#if kind === 'landscape'}
			<ChromeLandscape {controls} {hud} />
		{:else if kind === 'phone'}
			<ChromePhone {controls} {hud} />
		{:else}
			<ChromePortrait {controls} {hud} />
		{/if}
	</div>
</div>

<div class="am-ui layer modals">
	<!-- THE FAST LANE: this game's feature menu (ui/FeatureMenu.svelte) -->
	<FeatureMenu {controls} {master} {scale} {left} {top} compact={kind !== 'landscape'} />
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
	.layer.hud-off :global(*),
	.layer.hud-held :global(*) {
		pointer-events: none !important;
	}
	/* uiHide: every top-level chrome element fades except the ones marked keep (the logo, the WIN
	   readout). A hud-group container is not faded itself; its children are, keep honoured, so a
	   kept element can sit inside a row (the WIN cell in the landscape trio, Corey 2026-09-15: the
	   wrap-up amount gets a second place to read it). */
	.fit > :global(*),
	:global(.hud-group > *),
	:global(.hud-group .dc > *) {
		/* the 0.3 s delay is the RETURN only (below, the hide runs at once): a kept readout that
		   slid to centre while the HUD was away moves back before its row-mates reappear */
		transition: opacity 0.35s ease 0.3s;
	}
	.layer.hud-off .fit > :global(:not(.keep):not(.hud-group)),
	.layer.hud-off :global(.hud-group > :not(.keep)),
	.layer.hud-off :global(.hud-group .dc > :not(.keep)) {
		opacity: 0;
		transition-delay: 0s;
	}
	/* uiHide({ deep: true }) — the max-win screen only: even the kept logo and WIN readout go, so
	   the dimmed canvas carries THEY ATE EVERYTHING / MAX WIN alone (Corey 2026-09-15). */
	.layer.hud-deep .fit > :global(*),
	.layer.hud-deep :global(.hud-group > *),
	.layer.hud-deep :global(.hud-group .dc > *) {
		opacity: 0;
	}
	.modals {
		z-index: 60;
	}
	/* THE HUD'S TWO PLANES (ui/hud/hudLayout.ts): the base plane (the glass, the keys, WIN, Spin, the help menu) and over
	   it the lit plane (BALANCE, the amount and its minus and plus). */
	.fit > :global(.hudp[data-plane='base']) {
		z-index: 2;
	}
	.fit > :global(.hudp[data-plane='lit']) {
		z-index: 3;
	}
	.fit {
		position: absolute;
		left: 0;
		top: 0;
		transform-origin: top left;
		pointer-events: none;
	}
</style>
