<script lang="ts">
	import { stamp } from '../game/assets';
	import { getContext } from '../game/context';
	// Portrait master (412x760): the stacked logo on top (unchanged).
	// THE HUD (round 5, "Drop 6", Corey 2026-11-12): one glass bar low on the floor, as tall as its keys need, with the
	// Spin set in its middle: the Spin stands about 39 % above the bar's top edge and drops 6 px below its bottom edge,
	// the bar's border flowing round both arcs. ARMOURY and MENU on the left shoulder, AUTO and TURBO on the right.
	// Over the left shoulder WIN above BALANCE; over the right the amount, with minus and plus under it at the far right
	// (68 px clear of the Spin's edge on a 390 phone). The help menu rises over the left side, its tail on Menu; what it
	// covers fades. Geometry: ui/hud/hudLayout.ts portraitGeo. The chrome spans the real viewport width; the HUD hangs
	// from the viewport's bottom edge (a home-indicator band under it on a tall phone, as the mockup had).
	import type { Controls } from './controls.svelte';
	import { MASTER, isPhoneSizeType } from '../game/layoutSpec';
	import { logoArtRect } from '../game/logo/layout';
	import { logoState } from '../game/logo/state.svelte';
	import { stateUi } from 'state-shared';
	import Shine from './Shine.svelte';
	import ClockStrip from './ClockStrip.svelte';
	import { portraitGeo, outlineBead, type HudFrame } from './hud/hudLayout';
	import { createHudState } from './hud/hudState';
	import HudGlass from './hud/HudGlass.svelte';
	import HudSweep from './hud/HudSweep.svelte';
	import HudSpin from './hud/HudSpin.svelte';
	import HudKey from './hud/HudKey.svelte';
	import HudArmoury from './hud/HudArmoury.svelte';
	import HudStep from './hud/HudStep.svelte';
	import HudReadout from './hud/HudReadout.svelte';
	import HudMenuPanel from './hud/HudMenuPanel.svelte';

	type Props = { controls: Controls; hud: HudFrame };
	const { controls, hud }: Props = $props();
	const hs = createHudState(controls);
	const replay = $derived(controls.isReplay());
	const rh = $derived(hs.replay());
	const context = getContext();
	// THE LOGO (game/logo/layout.ts), exactly as before
	const vw = $derived(context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale);
	const phone = $derived(isPhoneSizeType(context.stateLayoutDerived.canvasSizeType()));
	const logo = $derived(logoArtRect('portrait', vw, phone));
	const logoDx = $derived(logo.x + logo.width / 2 - MASTER.portrait.width / 2);

	const G = $derived(portraitGeo(hud, 0));
	const outline = $derived(outlineBead(G.bar, G.n));
	const ante = $derived(hs.anteLevel());
	const lit = $derived(hs.winLit());
	const amtLabel = $derived(rh ? rh.label : hs.amtLabel());
	const amtValue = $derived(rh ? rh.total : controls.betText());
	const plane = $derived(`width:${hud.W}px;height:${hud.H}px;transform:${hud.transform};--hit:${44 / hud.u}px`);
	const at = (c: { cx: number; cy: number; d: number }) => ({ x: c.cx - c.d / 2, y: c.cy - c.d / 2, d: c.d });
	const K = $derived({ arm: at(G.arm), menu: at(G.menu), auto: at(G.auto), turbo: at(G.turbo), minus: at(G.minus), plus: at(G.plus) });
</script>

<ClockStrip side="left" clock text="MANTICORE UNLEASHED" />
<ClockStrip side="right" text="POLYMATH GAMES" />

<div class="top keep" style:top="{logo.y}px" style:transform="translateX({logoDx}px)">
	<!-- THE CANVAS DRAWS THE LOGO (components/Logo.svelte, game/logo/still.ts: under the creature); this is the fallback
	     until the canvas has it, hidden from then on (logoState.canvas) -->
	<span class="logo" class:canvas={logoState.canvas} style:width="{logo.width}px"><img src={stamp('/assets/ui/logo-stacked.webp')} alt="Manticore Unleashed" draggable="false" /><Shine src={stamp('/assets/ui/logo-stacked-glint.webp')} calm /></span>
</div>

<div class="hudp hud-group v-portrait" class:menu-open={stateUi.menuOpen} data-plane="base" style={plane}>
	<div class="shadow" style:left="{G.bar.x0 + 14}px" style:top="{G.bar.y1 - 14}px" style:width="{G.bar.x1 - G.bar.x0 - 28}px" style:height="28px"></div>
	<HudGlass {outline} frame={{ x0: G.bar.x0, x1: G.bar.x1, y0: G.n.cy - G.n.R, y1: G.n.cy + (G.n.Rb ?? G.n.R), peak: 0.5 }} {ante} W={hud.W} H={hud.H} />
	<HudSweep x0={outline.topStraight[0]} x1={G.bar.x1 - (G.bar.y1 - G.bar.y0) / 2} y={outline.topStraight[2]} {lit} />
	{#if !replay && !controls.jurisdiction().disabledBuyFeature}<HudArmoury {controls} x={K.arm.x} y={K.arm.y} w={K.arm.d} h={K.arm.d} shape="circ" />{/if}
	<HudKey kind="menu" {controls} x={K.menu.x} y={K.menu.y} d={K.menu.d} />
	{#if !replay && !controls.jurisdiction().disabledAutoplay}<HudKey kind="auto" {controls} x={K.auto.x} y={K.auto.y} d={K.auto.d} />{/if}
	{#if !controls.jurisdiction().disabledTurbo}<HudKey kind="turbo" {controls} x={K.turbo.x} y={K.turbo.y} d={K.turbo.d} />{/if}
	<HudSpin {controls} x={G.spin.x} y={G.spin.y} d={G.spin.d} />
	<HudReadout label="WIN" pre={hs.winPre()} value={controls.winText()} x={G.win.x} y={G.win.y} w={G.win.w} nominal={15} cls="pt l win uc {lit ? 'is-lit' : ''} {hs.winBig() ? 'is-big' : ''}" hud="win" keep />
	<HudMenuPanel {controls} x={G.panel.x} y={G.panel.bottom - G.panel.h} W={G.panel.w} H={G.panel.h} tip={G.panel.tip} T={G.panel.tail} />
</div>

<!-- what THE ARMOURY keeps lit above its tint: BALANCE, the amount, minus and plus (Chrome.svelte) -->
<div class="hudp hud-group v-portrait stats" class:menu-open={stateUi.menuOpen} data-plane="lit" style={plane}>
	{#if !replay}<HudReadout label="BALANCE" value={controls.balanceText()} x={G.bal.x} y={G.bal.y} w={G.bal.w} nominal={15} cls="pt l bal uc" hud="balance" lit />
	{:else if rh && !rh.isBase}<HudReadout label="BASE AMOUNT" value={rh.base} x={G.bal.x} y={G.bal.y} w={G.bal.w} nominal={15} cls="pt l bal uc" hud="balance" lit />{/if}
	{#if !replay || rh}
		<HudReadout
			label={amtLabel}
			value={amtValue}
			x={G.W - G.amt.right - G.amt.w}
			y={G.amt.y}
			w={G.amt.w}
			nominal={15}
			cls="pt r amt uc {!replay && hs.modeOn() ? 'ante' : ''} {ante === 2 ? 'sante' : ''} {!replay && controls.betDisabled() ? 'is-locked' : ''}"
			onclick={replay ? undefined : controls.openDenom}
			disabled={replay || controls.betDisabled()}
			hud="amount"
			lit
		/>
	{/if}
	{#if !replay}
		<HudStep dir={-1} {controls} x={K.minus.x} y={K.minus.y} d={K.minus.d} cls="fs uc" />
		<HudStep dir={1} {controls} x={K.plus.x} y={K.plus.y} d={K.plus.d} cls="fs uc" />
	{/if}
</div>

<style>
	/* top and the logo's width come from the layout rule (inline: game/logo/layout.ts) */
	.top {
		position: absolute;
		left: 12px;
		right: 12px;
		display: flex;
		justify-content: center;
		align-items: center;
		pointer-events: none;
	}
	.top .logo {
		position: relative;
		display: inline-block;
		filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.6));
	}
	.top .logo.canvas {
		visibility: hidden;
	}
	.top img {
		display: block;
		width: 100%;
		height: auto;
	}
</style>
