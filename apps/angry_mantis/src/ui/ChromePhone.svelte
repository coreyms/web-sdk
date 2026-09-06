<script lang="ts">
	import { stamp } from '../game/assets';
	import { getContext } from '../game/context';
	// Phone-landscape master (1480×740): board centred and near full height, logo + tagline + the
	// BALANCE/WIN/SPIN stack in the left column, button clusters in the bottom corners of both side
	// columns. Corey's 2026-09-06 layout: the three readouts share one left edge with the logo column,
	// SPIN reads larger, its − stepper sits outboard in the screen margin and its + after a fixed
	// slot; the whole SPIN cluster hides during bonuses (bet locked, and the column belongs to Marky).
	// Nothing chrome-side sits in the bottom ~40 master px: the master's bottom edge IS the phone's
	// bottom edge (fit by height), and iOS draws the home indicator over the last ~21 CSS px (≈40
	// master px at scale 0.527). env(safe-area-inset-bottom) is added on top wherever the host exposes
	// it. The master scales HARD on real phones (844×390 → scale ≈0.527), so the 52px rail buttons
	// render ~27 CSS px — the ≥44 CSS px touch-target rule is met by the transparent ::after hit
	// extensions below, not by the visual size.
	import type { Controls } from './controls.svelte';
	import { betSlotWidth } from './betStep';
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
	const freegame = $derived(context.stateGame.gameType !== 'basegame');
	// SPIN slot at the 'xl' digit height (26): widest price of the current mode, capped to the column
	const slot = $derived(betSlotWidth(26, 200) + 6);
</script>

<ClockStrip side="left" clock text="ANGRY MANTIS" />
<ClockStrip side="right" text="POLYMATH GAMES" />

<!-- logo + tagline each carry a Shine: a subtle glint every 5 s while idle, a full one on spin, in sync -->
<div class="logo"><img src={stamp('/assets/ui/logo-landscape.webp')} alt="Angry Mantis" draggable="false" /><Shine src={stamp('/assets/ui/logo-landscape.webp')} /></div>
<!-- "WIN UP TO 20,000x" set from Corey's branded glyphs (tools/build_branded_glyphs.py), sized to the text it replaced -->
<div class="tagline"><span class="tag"><img src={stamp('/assets/ui/20000x.webp')} alt="Win up to 20,000×" draggable="false" /><Shine src={stamp('/assets/ui/20000x.webp')} /></span></div>

<!-- left-column stack under the tagline (see header); maxWidth auto-shrinks trillion-scale balances -->
<div class="stats">
	{#if !replay}<TrioStat label="BALANCE" value={controls.balanceText()} accent="#ffdc4a" size="lg" align="left" maxWidth={240} />{/if}
	<TrioStat label="WIN" value={controls.winText()} accent={controls.hasWin() ? '#fff' : 'rgba(255,255,255,.45)'} size="lg" align="left" maxWidth={240} />
	{#if !freegame}
		<div class="spin-row">
			{#if !replay}<div class="minus"><StepButton dir={-1} size={32} {controls} /></div>{/if}
			<TrioStat label="SPIN" value={controls.betText()} accent="#ffdc4a" size="xl" align="left" maxWidth={200} minWidth={slot} onclick={replay ? undefined : controls.openDenom} disabled={controls.betDisabled()} />
			{#if !replay}<StepButton dir={1} size={32} {controls} />{/if}
		</div>
	{/if}
</div>

<!-- [Bonus · Menu] bottom-left, bottoms aligned; [Auto/Turbo · Spin] bottom-right, the column
     (52 + 12 + 52 = 116) spanning the spin button exactly -->
<div class="cluster-left">
	{#if !replay && !controls.jurisdiction().disabledBuyFeature}<BonusButton size={116} {controls} />{/if}
	<MenuButton size={52} {controls} compact />
</div>

<div class="cluster-right">
	<div class="col">
		{#if !replay && !controls.jurisdiction().disabledAutoplay}<AutoplayButton size={52} {controls} compact />{/if}
		{#if !controls.jurisdiction().disabledTurbo}<TurboButton size={52} {controls} />{/if}
	</div>
	<SquareSpin size={116} {controls} />
</div>

<style>
	.logo {
		position: absolute;
		top: 42px;
		left: 50px;
		width: 240px;
		pointer-events: none;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.7));
	}
	.logo img {
		display: block;
		width: 100%;
		height: auto;
	}
	.tagline {
		position: absolute;
		top: 176px; /* logo is 240 wide → 124 tall from top 42 (bottom 166); the old 148 overlapped MANTIS on an iPhone (Corey 2026-09-02) */
		left: 50px;
		width: 240px;
		text-align: center;
		pointer-events: none;
	}
	.tagline .tag {
		position: relative;
		display: inline-block;
		width: 176px; /* the old 14px text measured 176 master px wide */
		filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.7));
	}
	.tagline img {
		display: block;
		width: 100%;
		height: auto;
	}
	/* Stats stack: left column under the tagline (tagline art 176 wide → 22 tall from 176, ends ≈ 198).
	   One left edge for all three readouts — the logo column's edge, 50. */
	.stats {
		position: absolute;
		top: 236px;
		left: 50px;
		width: 240px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 22px;
		pointer-events: none;
		z-index: 3;
	}
	.spin-row {
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: 12px;
	}
	.spin-row :global(.slot-btn.chunky) {
		margin-bottom: 2px;
	}
	/* − sits outboard, in the margin left of the column (x 2..34), centred on the amount */
	.minus {
		position: absolute;
		left: -48px;
		bottom: 0;
	}
	/* stepper hit boxes: 32 master px ≈ 17 CSS px at scale 0.527 — ::after grows each to ≥84 master */
	.spin-row :global(.slot-btn.chunky)::after {
		content: '';
		position: absolute;
		inset: -26px;
	}
	/* Clusters clear the home-indicator zone by a fixed 60 master px (≈32 CSS px at scale 0.527), plus
	   the host's safe-area inset (in CSS px, so divided back into master units by the fit scale).
	   Corey's 2026-09-06 layout sets them in from the master edges (78 / 79). */
	.cluster-left {
		position: absolute;
		bottom: calc(60px + env(safe-area-inset-bottom, 0px) / var(--fit-scale, 1));
		left: 78px;
		display: flex;
		align-items: flex-end; /* menu bottom on the bonus bottom */
		gap: 10px;
		pointer-events: none;
		z-index: 2;
	}
	.cluster-right {
		position: absolute;
		bottom: calc(60px + env(safe-area-inset-bottom, 0px) / var(--fit-scale, 1));
		right: 79px;
		display: flex;
		align-items: center;
		gap: 12px;
		pointer-events: none;
		z-index: 2;
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	/* TAP TARGETS: at the worst documented fit (844×390 → scale 0.527) the 52px Menu/Auto/Turbo
	   buttons render ~27 CSS px. A transparent ::after (buttons are position:relative via .slot-btn)
	   grows each hit box to 84 master px ≈ 44.3 CSS px without moving a pixel visually. Vertical:
	   the outer edge takes the slack, the shared edge only half the 12px column gap, so the
	   stacked pair never steal each other's taps. Horizontal: the open side gets -22px, the side
	   facing the big Bonus/Spin button only the cluster gap (Spin is later in the DOM and would
	   win any contested overlap). The lone menu button takes the slack on all open sides. */
	.col :global(.slot-btn.chunky)::after {
		content: '';
		position: absolute;
		top: -6px;
		bottom: -6px;
		left: -22px;
		right: -12px;
	}
	.col > :global(.slot-btn.chunky:first-child)::after,
	.col > :global(:first-child .slot-btn.chunky)::after {
		top: -28px;
	}
	.col > :global(.slot-btn.chunky:last-child)::after,
	.col > :global(:last-child .slot-btn.chunky)::after {
		bottom: -28px;
	}
	.cluster-left > :global(:last-child .slot-btn.chunky)::after {
		content: '';
		position: absolute;
		top: -32px;
		bottom: -16px;
		left: -10px;
		right: -22px;
	}
</style>
