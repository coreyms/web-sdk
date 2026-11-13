<script lang="ts">
	import { stamp } from '../game/assets';
	// Desktop / landscape master (1280x720), and the same layout on wide screens and landscape tablets.
	// THE HUD (round 5, "Drop 6", Corey 2026-11-12): Side Stepper's one obsidian glass dock on the floor band, in this
	// order: ARMOURY, MENU | BALANCE | WIN | minus, the amount, plus | AUTO, TURBO, Spin (the dock's right end IS the
	// Spin circle). It is laid out outward from the screen's vertical centre line, so the WIN readout's centre sits on
	// it (and on the board's and the plaque's). The help menu opens over the scenery left of the board, its tail on Menu.
	// Geometry: ui/hud/hudLayout.ts desktopGeo (the mock's own numbers, mock px, scaled by the chrome's fit). The tablet
	// variant (the master drawn under 1:1) is the mock's tablet still: a wider dock with bigger keys.
	// The clock strip and the logo fallback are exactly as before.
	import type { Controls } from './controls.svelte';
	import { frameArtRect } from '../game/layoutSpec';
	import { PHONE_TIER } from '../game/deviceTier';
	import { logoArtRect } from '../game/logo/layout';
	import { logoState } from '../game/logo/state.svelte';
	import ClockStrip from './ClockStrip.svelte';
	import Shine from './Shine.svelte';
	import { desktopGeo, outlineTerm, type HudFrame } from './hud/hudLayout';
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
	const logo = $derived(logoArtRect('landscape')); // the logo's art box (constants LOGO.landscape, LOGO.landscapeTall)

	// the board art's left edge in mock px: the help menu never opens over the board
	const artLeft = $derived((hud.fit.fitLeft + frameArtRect('landscape').x * hud.fit.scale) / hud.u);
	const G = $derived(desktopGeo(hud, artLeft));
	const outline = $derived(outlineTerm({ x0: G.x0, y0: G.y0, y1: G.y1 }, G.n));
	const tablet = $derived(hud.variant === 'tablet');
	const ante = $derived(hs.anteLevel());
	const lit = $derived(hs.winLit());
	const nominal = $derived(tablet ? { v: 18, win: 20 } : { v: 19, win: 22 });
	const amtLabel = $derived(rh ? rh.label : hs.amtLabel());
	const amtValue = $derived(rh ? rh.total : controls.betText());
	const plane = $derived(`width:${hud.W}px;height:${hud.H}px;transform:${hud.transform};--hit:${44 / hud.u}px`);
</script>

<ClockStrip side="left" clock text="MANTICORE UNLEASHED" />
<ClockStrip side="right" text="POLYMATH GAMES" />

<!-- THE LOGO. The canvas draws it in this same box in every tier (components/Logo.svelte: animated on the desktop
     tier, the still of game/logo/still.ts otherwise, both under the creature). This <img> is only the fallback until
     the canvas has it (logoState.canvas hides it, Shine and all). -->
<div class="logo keep" class:canvas={logoState.canvas} style:left="{logo.x}px" style:top="{logo.y}px" style:width="{logo.width}px">
	<img src={stamp('/assets/ui/logo-stacked.webp')} alt="Manticore Unleashed" draggable="false" />{#if PHONE_TIER}<Shine src={stamp('/assets/ui/logo-stacked-glint.webp')} calm />{/if}
</div>

<!-- the dock: glass, keys, WIN and Spin (under THE ARMOURY's tint) -->
<div class="hudp hud-group v-{hud.variant}" data-plane="base" style={plane}>
	<div class="shadow" style:left="{G.x0 + 14}px" style:top="{G.y1 - 14}px" style:width="{G.xr - G.x0 - 28}px" style:height="28px"></div>
	<HudGlass {outline} frame={{ x0: G.x0, x1: G.xr, y0: G.n.cy - G.n.R, y1: G.y1, peak: (G.c - G.x0) / (G.xr - G.x0) }} {ante} W={hud.W} H={hud.H} />
	<HudSweep x0={outline.topStraight[0]} x1={outline.topStraight[1]} y={outline.topStraight[2]} {lit} />
	{#if !replay && !controls.jurisdiction().disabledBuyFeature}<HudArmoury {controls} x={G.arm.x} y={G.arm.y} w={G.arm.w} h={G.arm.h} shape="pill" />{/if}
	<HudKey kind="menu" {controls} x={G.menu.x} y={G.menu.y} d={G.menu.d} />
	{#each G.hl as h, i (i)}<i class="hl" class:wn={h.wn} style:left="{h.x}px" style:top="{h.y}px"></i>{/each}
	<HudReadout label="WIN" pre={hs.winPre()} value={controls.winText()} x={G.win.x} y={G.win.y} w={G.win.w} h={G.win.h} nominal={nominal.win} cls="win {hs.winPre() ? 'fsw' : ''} {lit ? 'is-lit' : ''} {hs.winBig() ? 'is-big' : ''}" hud="win" keep />
	{#if !replay && !controls.jurisdiction().disabledAutoplay}<HudKey kind="auto" {controls} x={G.auto.x} y={G.auto.y} d={G.auto.d} />{/if}
	{#if !controls.jurisdiction().disabledTurbo}<HudKey kind="turbo" {controls} x={G.turbo.x} y={G.turbo.y} d={G.turbo.d} />{/if}
	<HudSpin {controls} x={G.spin.x} y={G.spin.y} d={G.spin.d} />
	<HudMenuPanel {controls} x={G.panel.x} y={G.panel.bottom - 9 - G.panel.h} W={G.panel.w} H={G.panel.h} tip={G.panel.tip} cls={G.panel.nar ? 'nar' : ''} />
</div>

<!-- what THE ARMOURY keeps lit above its tint: BALANCE and the amount with its minus and plus (Chrome.svelte) -->
<div class="hudp hud-group v-{hud.variant}" data-plane="lit" style={plane}>
<div class="trio dc">
	<div class="cell left dc">
		{#if !replay}<HudReadout label="BALANCE" value={controls.balanceText()} x={G.bal.x} y={G.bal.y} w={G.bal.w} h={G.bal.h} nominal={nominal.v} cls="bal" hud="balance" lit />
		{:else if rh && !rh.isBase}<HudReadout label="BASE AMOUNT" value={rh.base} x={G.bal.x} y={G.bal.y} w={G.bal.w} h={G.bal.h} nominal={nominal.v} cls="bal" hud="balance" lit />{/if}
	</div>
	<div class="cell right dc">
		{#if !replay}<HudStep dir={-1} {controls} x={G.minus.x} y={G.minus.y} d={G.minus.d} />{/if}
		{#if !replay || rh}
			<HudReadout
				label={amtLabel}
				value={amtValue}
				x={G.amt.x}
				y={G.amt.y}
				w={G.amt.w}
				h={G.amt.h}
				nominal={nominal.v}
				cls="amt {!replay && hs.modeOn() ? 'ante' : ''} {ante === 2 ? 'sante' : ''} {!replay && controls.betDisabled() ? 'is-locked' : ''}"
				onclick={replay ? undefined : controls.openDenom}
				disabled={replay || controls.betDisabled()}
				hud="amount"
				lit
			/>
		{/if}
		{#if !replay}<HudStep dir={1} {controls} x={G.plus.x} y={G.plus.y} d={G.plus.d} />{/if}
	</div>
</div>
</div>

<style>
	/* placed by the layout rule (inline left / top / width: game/logo/layout.ts) */
	.logo {
		position: absolute;
		pointer-events: none;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.7));
	}
	.logo.canvas {
		visibility: hidden;
	}
	.logo img {
		display: block;
		width: 100%;
		height: auto;
	}
</style>
