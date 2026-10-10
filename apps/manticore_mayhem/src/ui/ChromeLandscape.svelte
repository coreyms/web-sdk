<script lang="ts">
	import { stamp } from '../game/assets';
	// Desktop / landscape master (1280×720). Corey's 2026-09-06 layout: the BALANCE / WIN / SPIN row
	// is keyed to the reel frame ART's edges — BALANCE flush left, WIN on the centre line, the +
	// stepper flush right with SPIN right-justified against it and the − stepper a fixed slot to the
	// left. [Bonus · Menu] bottom-left with their bottoms aligned; [Auto/Turbo · Spin] bottom-right
	// with the auto top on the spin top and the turbo bottom on the spin bottom (42 + 8 + 42 = 92).
	import type { Controls } from './controls.svelte';
	import { frameArtRect } from '../game/layoutSpec';
	import { PHONE_TIER } from '../game/deviceTier';
	import { logoArtRect } from '../game/logo/layout';
	import { logoState } from '../game/logo/state.svelte';
	import { betSlotWidth } from './betStep';
	import ClockStrip from './ClockStrip.svelte';
	import Shine from './Shine.svelte';

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
	const art = frameArtRect('landscape'); // 295.3 .. 984.2
	const logo = logoArtRect('landscape'); // the logo's art box (constants LOGO.landscape)
	// SPIN slot: the widest price the current mode can show at the 'lg' digit height (19), plus air;
	// capped so a trillion-scale menu never pushes the − into the WIN column (TrioStat shrinks)
	const slot = $derived(betSlotWidth(19, 205) + 6);
</script>

<ClockStrip side="left" clock text="MANTICORE MAYHEM" />
<ClockStrip side="right" text="POLYMATH GAMES" />

<!-- THE LOGO. Desktop tier: the canvas draws it, animated, in this same box (components/Logo.svelte), and this
     still is only the stand-in until that is in (logoState.canvas hides it; no Shine, so nothing changes at the
     hand over). Phone tier: this still IS the logo, with the house Shine (a subtle glint every 5 s while idle, a
     full one on spin). -->
<div class="logo keep" class:canvas={logoState.canvas} style:left="{logo.x}px" style:top="{logo.y}px" style:width="{logo.width}px">
	<img src={stamp('/assets/ui/logo-stacked.webp')} alt="Manticore Mayhem" draggable="false" />{#if PHONE_TIER}<Shine src={stamp('/assets/ui/logo-stacked.webp')} />{/if}
</div>
<!-- no tagline in this game: the WIN UP TO 10,000x placeholder was dropped (Corey 2026-10-09) -->

<!-- readout row on the frame art's edges; maxWidth auto-shrinks huge values (stake.us GC balances hit trillions) -->
<div class="trio hud-group" style:left="{art.x}px" style:width="{art.width}px">
	<div class="cell left">
		{#if !replay}<TrioStat label="BALANCE" value={controls.balanceText()} accent="#ffdc4a" size="lg" align="left" maxWidth={205} />{/if}
	</div>
	<div class="cell centre keep">
		<TrioStat label="WIN" value={controls.winText()} accent="#ffdc4a" size="lg" maxWidth={205} />
	</div>
	<div class="cell right">
		{#if !replay}<StepButton dir={-1} size={28} {controls} />{/if}
		<!-- REPLAY: no bet readout at all (owner 2026-10-09). The replay card states the bet, the mode's
		     multiplier and the real cost; this readout fell back to the base "SPIN" amount when a bought
		     round ended (finalWin returns a buy to the base game), which misstated what the round cost. -->
		{#if !replay}
			<div class="spin-slot" style:margin-left="18px">
				<TrioStat label={controls.betLabel()} value={controls.betText()} accent="#ffdc4a" size="lg" align="right" maxWidth={205} minWidth={slot} onclick={controls.openDenom} disabled={controls.betDisabled()} />
			</div>
		{/if}
		{#if !replay}<StepButton dir={1} size={28} {controls} />{/if}
	</div>
</div>

<div class="bar">
	<div class="cluster">
		{#if !replay && !controls.jurisdiction().disabledBuyFeature}<BonusButton size={92} {controls} />{/if}
		<MenuButton size={42} {controls} />
	</div>
	<div class="cluster right">
		<div class="col">
			{#if !replay && !controls.jurisdiction().disabledAutoplay}<AutoplayButton size={42} {controls} />{/if}
			{#if !controls.jurisdiction().disabledTurbo}<TurboButton size={42} {controls} />{/if}
		</div>
		<SquareSpin size={92} {controls} />
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
	/* The row's content bottom (718 − 18 − 4 = 696) is the spin button's bottom edge less its 4px
	   shadow seat, so the three amounts share the button baseline. */
	.trio {
		position: absolute;
		bottom: 18px;
		height: 92px;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: end;
		padding-bottom: 4px;
		pointer-events: none;
		z-index: 3;
	}
	.cell {
		display: flex;
		align-items: flex-end;
	}
	.cell.left {
		justify-content: flex-start;
	}
	.cell.centre {
		justify-content: center;
	}
	.cell.right {
		justify-content: flex-end;
		gap: 12px; /* amount → + : tight, the pair reads as one control */
	}
	.cell.right :global(.slot-btn.chunky) {
		margin-bottom: 2px; /* steppers sit on the amount's baseline, not the label's */
	}
	/* − / + : 28 master px ≈ 28 CSS px on desktop, well under the 44 touch rule for a tablet in
	   landscape — a transparent ::after grows each hit box to 44 without moving a pixel. */
	.cell.right :global(.slot-btn.chunky)::after {
		content: '';
		position: absolute;
		inset: -8px;
	}
	.bar {
		position: absolute;
		bottom: 18px;
		left: 66px; /* Corey's 2026-09-06 layout: clusters sit in from the master edges */
		right: 86px;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		z-index: 2;
		pointer-events: none;
	}
	.cluster {
		display: flex;
		align-items: flex-end; /* menu bottom on the bonus bottom */
		gap: 14px;
	}
	.cluster.right {
		align-items: center; /* the 92-tall column spans the spin button exactly */
		gap: 18px;
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
</style>
