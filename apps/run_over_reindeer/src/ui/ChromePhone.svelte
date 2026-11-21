<script lang="ts">
	// Phone-landscape master (1480x740): the board between the two side columns (layoutSpec PHONE_SIDE_COLUMN), the
	// billboard logo top left (in the canvas: game/scene/logoSign.ts).
	// THE HUD (the house HUD: Manticore's HUD round 5, "Drop 6", Corey 2026-11-12, the landscape of "Win Crown", in this
	// game's "Frost" theme): a compact glass capsule low in the left column with BALANCE, WIN and the amount between its
	// minus and plus; FAST LANE and MENU (34 px circles, icon only) above it; the Spin low in the right column; AUTO and
	// TURBO in a small capsule top right. The help menu opens down over the capsule; what it covers fades. Geometry:
	// ui/hud/hudLayout.ts landscapeGeo (anchored to the master, like the board). Every piece stands in the side columns,
	// on the rock beside the tunnels, clear of the board.
	import type { Controls } from './controls.svelte';
	import { TITLE } from '../game/layoutSpec';
	import { stateUi } from 'state-shared';
	import TitleSign from './TitleSign.svelte';
	import ClockStrip from './ClockStrip.svelte';
	import { landscapeGeo, outlineArch, type HudFrame } from './hud/hudLayout';
	import { createHudState } from './hud/hudState';
	import HudGlass from './hud/HudGlass.svelte';
	import HudSpin from './hud/HudSpin.svelte';
	import HudKey from './hud/HudKey.svelte';
	import HudFeature from './hud/HudFeature.svelte';
	import HudStep from './hud/HudStep.svelte';
	import HudReadout from './hud/HudReadout.svelte';
	import HudMenuPanel from './hud/HudMenuPanel.svelte';

	type Props = { controls: Controls; hud: HudFrame };
	const { controls, hud }: Props = $props();
	const hs = createHudState(controls);
	const replay = $derived(controls.isReplay());
	const rh = $derived(hs.replay());
	const title = TITLE.phone; // the title's box (layoutSpec TITLE)

	const G = $derived(landscapeGeo(hud));
	const capO = $derived(outlineArch(G.cap));
	const kcO = $derived(outlineArch(G.kc));
	const ante = $derived(hs.anteLevel());
	const lit = $derived(hs.winLit());
	const amtLabel = $derived(rh ? rh.label : hs.amtLabel());
	const amtValue = $derived(rh ? rh.total : controls.betText());
	const plane = $derived(`width:${hud.W}px;height:${hud.H}px;transform:${hud.transform};--hit:${44 / hud.u}px`);
	const at = (c: { cx: number; cy: number; d: number }) => ({ x: c.cx - c.d / 2, y: c.cy - c.d / 2, d: c.d });
	const K = $derived({ arm: at(G.arm), menu: at(G.menu), auto: at(G.auto), turbo: at(G.turbo), minus: at(G.minus), plus: at(G.plus) });
	const ringR = $derived(G.n.r + 3.5);
</script>

<ClockStrip side="left" clock text="RUN OVER REINDEER" />
<ClockStrip side="right" text="POLYMATH GAMES" />

<!-- THE NAME is the billboard logo in the canvas at the top of the left column (game/scene/logoSign.ts, scene pass 9); the
     highway sign shows only in a bonus round, with its counter, under it (ui/TitleSign.svelte roundOnly) -->
<div class="logo" style:left="{title.x}px" style:top="{title.y}px"><TitleSign width={title.width} height={title.height} lines={title.lines} roundOnly plate="phone" /></div>

<div class="hudp hud-group v-landscape" class:menu-open={stateUi.menuOpen} data-plane="base" style={plane}>
	<div class="shadow" style:left="{G.cap.x0 + 14}px" style:top="{G.cap.y1 - 14}px" style:width="{G.cap.x1 - G.cap.x0 - 28}px" style:height="28px"></div>
	<div class="shadow" style:left="{G.kc.x0 + 14}px" style:top="{G.kc.y1 - 14}px" style:width="{G.kc.x1 - G.kc.x0 - 28}px" style:height="28px"></div>
	<div class="shadow" style:left="{G.n.cx - G.n.r + 4}px" style:top="{G.n.cy + G.n.r - 18}px" style:width="{2 * G.n.r - 8}px" style:height="26px"></div>
	<HudGlass outline={capO} frame={{ x0: G.cap.x0, x1: G.cap.x1, y0: G.cap.y0, y1: G.cap.y1 }} {ante} W={hud.W} H={hud.H} />
	<HudGlass outline={kcO} frame={{ x0: G.kc.x0, x1: G.kc.x1, y0: G.kc.y0, y1: G.kc.y1 }} W={hud.W} H={hud.H} />
	<!-- the Spin's outer accent ring (painted, under the button) -->
	<svg class="ol" width={hud.W} height={hud.H} viewBox="0 0 {hud.W} {hud.H}" aria-hidden="true">
		<defs>
			<linearGradient id="hudring" gradientUnits="userSpaceOnUse" x1="0" y1={G.n.cy - G.n.r - 4} x2="0" y2={G.n.cy + G.n.r + 4}>
				<stop offset="0" style="stop-color:rgb(var(--hud-ink-rgb));stop-opacity:0" />
				<stop offset=".45" style="stop-color:rgb(var(--hud-ink-rgb));stop-opacity:.18" />
				<stop offset=".8" style="stop-color:rgb(var(--hud-accent-rgb));stop-opacity:.7" />
				<stop offset="1" style="stop-color:rgb(var(--hud-accent-hi-rgb));stop-opacity:.9" />
			</linearGradient>
		</defs>
		<circle cx={G.n.cx} cy={G.n.cy} r={ringR} fill="none" stroke="url(#hudring)" stroke-width="1" />
	</svg>
	{#if !replay && !controls.jurisdiction().disabledBuyFeature}<HudFeature {controls} x={K.arm.x} y={K.arm.y} w={K.arm.d} h={K.arm.d} shape="ln" />{/if}
	<HudKey kind="menu" {controls} x={K.menu.x} y={K.menu.y} d={K.menu.d} cls="ln fs" />
	{#if !replay && !controls.jurisdiction().disabledAutoplay}<HudKey kind="auto" {controls} x={K.auto.x} y={K.auto.y} d={K.auto.d} cls="ln q" />{/if}
	{#if !controls.jurisdiction().disabledTurbo}<HudKey kind="turbo" {controls} x={K.turbo.x} y={K.turbo.y} d={K.turbo.d} cls="ln q" />{/if}
	<HudSpin {controls} x={G.spin.x} y={G.spin.y} d={G.spin.d} />
	<HudReadout label="WIN" pre={hs.winPre()} value={controls.winText()} odo={controls.winOdoText()} x={G.win.x} y={G.win.y} w={G.win.w} h={G.win.h} nominal={15} cls="lc win uc {hs.winPre() ? 'fsw' : ''} {lit ? 'is-lit' : ''} {hs.winBig() ? 'is-big' : ''}" hud="win" keep />
	<i class="hl hz uc" style:left="{G.hz.x}px" style:top="{G.hz.y}px" style:width="{G.hz.w}px"></i>
	<HudMenuPanel {controls} x={G.panel.x} y={G.panel.top} W={G.panel.w} H={G.panel.h} tip={G.panel.tip} up cls="pls" />
</div>

<!-- the lit plane: BALANCE and the amount row -->
<div class="hudp hud-group v-landscape stats" class:menu-open={stateUi.menuOpen} data-plane="lit" style={plane}>
	{#if !replay}<HudReadout label="BALANCE" value={controls.balanceText()} x={G.bal.x} y={G.bal.y} w={G.bal.w} h={G.bal.h} nominal={15} cls="lc bal uc" hud="balance" lit />
	{:else if rh && !rh.isBase}<HudReadout label="BASE AMOUNT" value={rh.base} x={G.bal.x} y={G.bal.y} w={G.bal.w} h={G.bal.h} nominal={15} cls="lc bal uc" hud="balance" lit />{/if}
	<div class="spin-row dc">
		{#if !replay}<HudStep dir={-1} {controls} x={K.minus.x} y={K.minus.y} d={K.minus.d} cls="uc" />{/if}
		{#if !replay || rh}
			<HudReadout
				label={amtLabel}
				value={amtValue}
				x={G.amt.x}
				y={G.amt.y}
				w={G.amt.w}
				h={G.amt.h}
				nominal={14}
				cls="lc amt uc {!replay && hs.modeOn() ? 'ante' : ''} {ante === 2 ? 'sante' : ''} {!replay && controls.betDisabled() ? 'is-locked' : ''}"
				onclick={replay ? undefined : controls.openDenom}
				disabled={replay || controls.betDisabled()}
				hud="amount"
				lit
			/>
		{/if}
		{#if !replay}<HudStep dir={1} {controls} x={K.plus.x} y={K.plus.y} d={K.plus.d} cls="uc" />{/if}
	</div>
</div>

<style>
	/* placed by the layout rule (inline left / top: layoutSpec TITLE) */
	.logo {
		position: absolute;
		pointer-events: none;
	}
</style>
