<script lang="ts">
	import { stamp } from '../game/assets';
	// Phone-landscape master (1480×740): board centred and near full height, logo + tagline + the
	// BALANCE/WIN/SPIN stack in the left column, button clusters in the bottom corners of both side
	// columns. Nothing chrome-side sits in the bottom ~40 master px: the master's bottom edge IS the
	// phone's bottom edge (fit by height), and iOS draws the home indicator over the last ~21 CSS px
	// (≈40 master px at scale 0.527). The stats used to sit 3 CSS px from the edge, under the bar
	// (Stake review 2026-09-02). The band under the board is too shallow to lift them (frame art to
	// ≈730, ModePlaque on the rail), so they moved to the left column — empty in the base game; in a
	// bonus Marky stands there and the stack rides over his antennae, same character-behind-HUD
	// composition as the spin cluster over Marty. env(safe-area-inset-bottom) is added on top wherever
	// the host exposes it (Stake's wrapper decides; it reads 0 in plain Safari without viewport-fit=cover).
	// The master scales HARD on real phones (844×390 → scale ≈0.527), so the 52px rail buttons render
	// ~27 CSS px — the ≥44 CSS px touch-target rule is met by the transparent ::after hit extensions
	// below, not by the visual size.
	import type { Controls } from './controls.svelte';
	import ClockStrip from './ClockStrip.svelte';
	import TrioStat from './TrioStat.svelte';
	import BonusButton from './BonusButton.svelte';
	import CoinButton from './CoinButton.svelte';
	import MenuButton from './MenuButton.svelte';
	import AutoplayButton from './AutoplayButton.svelte';
	import TurboButton from './TurboButton.svelte';
	import SquareSpin from './SquareSpin.svelte';

	type Props = { controls: Controls };
	const { controls }: Props = $props();
	const replay = $derived(controls.isReplay());
</script>

<ClockStrip side="left" clock text="ANGRY MANTIS" />
<ClockStrip side="right" text="POLYMATH GAMES" />

<img class="logo" src={stamp('/assets/ui/logo-landscape.webp')} alt="Angry Mantis" draggable="false" />
<!-- Corey's "WIN UP TO 20,000x" art (colour-graded to the logo), sized to the text it replaced -->
<div class="tagline"><img src={stamp('/assets/ui/20000x.webp')} alt="Win up to 20,000×" draggable="false" /></div>

<!-- left-column stack under the tagline (see header); maxWidth auto-shrinks trillion-scale balances -->
<div class="stats">
	{#if !replay}<TrioStat label="BALANCE" value={controls.balanceText()} accent="#ffdc4a" align="left" maxWidth={240} />{/if}
	<TrioStat label="WIN" value={controls.winText()} accent={controls.hasWin() ? '#fff' : 'rgba(255,255,255,.45)'} align="left" maxWidth={240} />
	<TrioStat label="SPIN" value={controls.betText()} accent="#ffdc4a" align="left" maxWidth={240} onclick={replay ? undefined : controls.openDenom} disabled={controls.betDisabled()} />
</div>

<!-- grouped like portrait: [Bonus · Coin/Menu] bottom-left, [Auto/Turbo · Spin] bottom-right -->
<div class="cluster-left">
	{#if !replay}<BonusButton size={116} {controls} />{/if}
	<div class="col">
		{#if !replay}<CoinButton size={52} {controls} />{/if}
		<MenuButton size={52} {controls} compact />
	</div>
</div>

<div class="cluster-right">
	<div class="col">
		{#if !replay}<AutoplayButton size={52} {controls} compact />{/if}
		<TurboButton size={52} {controls} />
	</div>
	<SquareSpin size={116} {controls} />
</div>

<style>
	.logo {
		position: absolute;
		top: 42px;
		left: 50px;
		width: 240px;
		height: auto;
		pointer-events: none;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.7));
	}
	.tagline {
		position: absolute;
		top: 148px;
		left: 50px;
		width: 240px;
		text-align: center;
		pointer-events: none;
	}
	.tagline img {
		width: 176px; /* the old 14px text measured 176 master px wide */
		height: auto;
		filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.7));
	}
	/* Stats stack: left column under the tagline (tagline art ends ≈ 190). */
	.stats {
		position: absolute;
		top: 206px;
		left: 50px;
		width: 240px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		pointer-events: none;
		z-index: 3;
	}
	/* Clusters clear the home-indicator zone by a fixed 60 master px (≈32 CSS px at scale 0.527), plus
	   the host's safe-area inset (in CSS px, so divided back into master units by the fit scale). */
	.cluster-left {
		position: absolute;
		bottom: calc(60px + env(safe-area-inset-bottom, 0px) / var(--fit-scale, 1));
		left: 28px;
		display: flex;
		align-items: center;
		gap: 10px;
		pointer-events: none;
		z-index: 2;
	}
	.cluster-right {
		position: absolute;
		bottom: calc(60px + env(safe-area-inset-bottom, 0px) / var(--fit-scale, 1));
		right: 24px;
		display: flex;
		align-items: center;
		gap: 10px;
		pointer-events: none;
		z-index: 2;
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	/* TAP TARGETS: at the worst documented fit (844×390 → scale 0.527) the 52px Coin/Menu/Auto/Turbo
	   buttons render ~27 CSS px. A transparent ::after (buttons are position:relative via .slot-btn)
	   grows each hit box to 84 master px ≈ 44.3 CSS px without moving a pixel visually. Vertical:
	   the outer edge takes the slack (-28px), the shared edge only half the 8px column gap, so the
	   stacked pair never steal each other's taps. Horizontal: the open side gets -22px, the side
	   facing the big Bonus/Spin button only the 10px cluster gap (Spin is later in the DOM and would
	   win any contested overlap). */
	.col :global(.slot-btn.chunky)::after {
		content: '';
		position: absolute;
		top: -4px;
		bottom: -4px;
	}
	.cluster-left .col :global(.slot-btn.chunky)::after {
		left: -10px;
		right: -22px;
	}
	.cluster-right .col :global(.slot-btn.chunky)::after {
		left: -22px;
		right: -10px;
	}
	.col > :global(.slot-btn.chunky:first-child)::after,
	.col > :global(:first-child .slot-btn.chunky)::after {
		top: -28px;
	}
	.col > :global(.slot-btn.chunky:last-child)::after,
	.col > :global(:last-child .slot-btn.chunky)::after {
		bottom: -28px;
	}
</style>
