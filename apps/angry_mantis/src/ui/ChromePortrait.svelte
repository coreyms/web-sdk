<script lang="ts">
	import { stamp } from '../game/assets';
	import { getContext } from '../game/context';
	// Portrait master (412×760): wide logo on top. Corey's 2026-09-06 layout for the foot of the
	// page: BALANCE left above the bonus button, SPIN right above a 2×2 grid [Auto +][Turbo −] that
	// spans the spin button's height exactly (36 + 6 + 36 = 78), the menu button top-aligned with the
	// bonus button, and a small WIN centred between the two big buttons. The whole HUD anchors to the
	// REAL viewport bottom (Chrome.svelte's --vp-extra-bottom): on a phone taller than the master it
	// rides down into the letterbox instead of floating mid-screen.
	import type { Controls } from './controls.svelte';
	import Shine from './Shine.svelte';
	import ClockStrip from './ClockStrip.svelte';
	import TrioStat from './TrioStat.svelte';
	import StepButton from './StepButton.svelte';
	import BonusButton from './BonusButton.svelte';
	import MenuButton from './MenuButton.svelte';
	import AutoplayButton from './AutoplayButton.svelte';
	import TurboButton from './TurboButton.svelte';
	import SquareSpin from './SquareSpin.svelte';

	type Props = { controls: Controls };
	const { controls }: Props = $props();
	const replay = $derived(controls.isReplay());
	const context = getContext();
	// the ON THE MENU pool tray takes the band under the logo during free games (HUD.portrait.pool)
	const freegame = $derived(context.stateGame.gameType === 'freegame');
</script>

<ClockStrip side="left" clock text="ANGRY MANTIS" />
<ClockStrip side="right" text="POLYMATH GAMES" />

<div class="top"><span class="logo"><img src={stamp('/assets/ui/logo-wide.webp')} alt="Angry Mantis" draggable="false" /><Shine src={stamp('/assets/ui/logo-wide.webp')} /></span></div>
<!-- the WIN UP TO 20,000x tagline the other two layouts carry under the logo (Corey 2026-09-03);
     hidden during free games, where the ON THE MENU pool tray sits in that band -->
{#if !freegame}
	<div class="tagline"><span class="tag"><img src={stamp('/assets/ui/20000x.webp')} alt="Win up to 20,000×" draggable="false" /><Shine src={stamp('/assets/ui/20000x.webp')} /></span></div>
{/if}

<div class="stats">
	{#if replay}<div></div>{:else}<TrioStat label="BALANCE" value={controls.balanceText()} accent="#ffdc4a" align="left" maxWidth={180} />{/if}
	<TrioStat label="SPIN" value={controls.betText()} accent="#ffdc4a" size="lg" align="right" maxWidth={180} onclick={replay ? undefined : controls.openDenom} disabled={controls.betDisabled()} />
</div>

<!-- WIN is centred between the two BIG buttons (bonus right edge 102 .. spin left edge W−170), not
     between the clusters: its centre is W/2 − 34, i.e. 50% of this bar (24..W−4) minus 44 -->
<div class="bar">
	<div class="cluster">
		{#if !replay && !controls.jurisdiction().disabledBuyFeature}<BonusButton size={78} {controls} />{/if}
		<MenuButton size={36} {controls} compact />
	</div>
	<div class="win">
		<TrioStat label="WIN" value={controls.winText()} accent={controls.hasWin() ? '#fff' : 'rgba(255,255,255,.45)'} size="sm" align="center" maxWidth={120} />
	</div>
	<div class="cluster">
		<SquareSpin size={78} {controls} />
		<div class="grid">
			{#if !replay && !controls.jurisdiction().disabledAutoplay}<AutoplayButton size={36} {controls} compact />{:else}<div></div>{/if}
			{#if !replay}<StepButton dir={1} size={36} {controls} />{:else}<div></div>{/if}
			{#if !controls.jurisdiction().disabledTurbo}<TurboButton size={36} {controls} />{:else}<div></div>{/if}
			{#if !replay}<StepButton dir={-1} size={36} {controls} />{:else}<div></div>{/if}
		</div>
	</div>
</div>

<style>
	.top {
		position: absolute;
		top: 56px; /* just below the clock strip; frees a little height for the expanded board */
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
		width: 330px;
		margin: -8px 0;
		filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.6));
	}
	.top img {
		display: block;
		width: 100%;
		height: auto;
	}
	/* logo-wide is 900×157 → 330×57.6 from top 56 (bottom ≈ 114); the tagline sits in the 114..150
	   band above the frame's top rail, at the same width ratio to the logo as landscape (0.73) */
	.tagline {
		position: absolute;
		top: 116px;
		left: 0;
		right: 0;
		text-align: center;
		pointer-events: none;
	}
	.tagline .tag {
		position: relative;
		display: inline-block;
		width: 220px;
		filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.7));
	}
	.tagline img {
		display: block;
		width: 100%;
		height: auto;
	}
	/* Foot of the page. `--vp-extra-bottom` (Chrome.svelte) is the letterbox below the master on
	   tall phones, so these bottoms are measured from the REAL viewport edge; the host's safe-area
	   inset (CSS px → master via the fit scale) keeps the row above the iOS home indicator. */
	.stats {
		position: absolute;
		bottom: calc(100px - var(--vp-extra-bottom, 0px) + env(safe-area-inset-bottom, 0px) / var(--fit-scale, 1));
		left: 24px;
		right: 8px;
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		pointer-events: none;
	}
	.bar {
		position: absolute;
		bottom: calc(16px - var(--vp-extra-bottom, 0px) + env(safe-area-inset-bottom, 0px) / var(--fit-scale, 1));
		left: 24px;
		right: 4px;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		z-index: 2;
		pointer-events: none;
	}
	.win {
		position: absolute;
		left: calc(50% - 44px);
		bottom: 4px;
		transform: translateX(-50%);
		display: flex;
		justify-content: center;
	}
	.cluster {
		display: flex;
		align-items: flex-start; /* menu top on the bonus top; the grid spans the spin height anyway */
		gap: 8px;
	}
	.cluster:last-child {
		gap: 10px;
	}
	.grid {
		display: grid;
		grid-template-columns: 36px 36px;
		grid-template-rows: 36px 36px;
		gap: 6px;
	}
	/* TAP TARGETS: at the worst documented fit (390px-wide phone → scale 412/390 ≈ 0.946) the 36px
	   Menu/Auto/Turbo/−/+ buttons render ~34 CSS px, under the ≥44 CSS px rule. A transparent
	   ::after (buttons are position:relative via .slot-btn) grows each hit box to ≥47 master px
	   ≈ 44.5 CSS px without moving a pixel visually. Grid cells: the shared edges take half the
	   6px gap, the outer edges the slack; the side facing the spin button only the 10px cluster gap
	   (Spin is earlier in the DOM here, the grid cells win a contested overlap, so keep it clear). */
	.grid :global(.slot-btn.chunky)::after {
		content: '';
		position: absolute;
		inset: -3px;
	}
	.grid > :global(:nth-child(1) .slot-btn.chunky)::after,
	.grid > :global(:nth-child(2) .slot-btn.chunky)::after {
		top: -8px;
	}
	.grid > :global(:nth-child(3) .slot-btn.chunky)::after,
	.grid > :global(:nth-child(4) .slot-btn.chunky)::after {
		bottom: -8px;
	}
	.grid > :global(:nth-child(1) .slot-btn.chunky)::after,
	.grid > :global(:nth-child(3) .slot-btn.chunky)::after {
		left: -9px;
	}
	.grid > :global(:nth-child(2) .slot-btn.chunky)::after,
	.grid > :global(:nth-child(4) .slot-btn.chunky)::after {
		right: -8px;
	}
	/* menu: open on top and the right, the bonus side only the 8px cluster gap */
	.cluster > :global(:last-child .slot-btn.chunky)::after {
		content: '';
		position: absolute;
		top: -8px;
		bottom: -8px;
		left: -8px;
		right: -10px;
	}
</style>
