<script lang="ts">
	import { stamp } from '../game/assets';
	// Desktop / landscape master (1280×720). Corey's 2026-09-06 layout: the BALANCE / WIN / SPIN row
	// is keyed to the reel frame ART's edges — BALANCE flush left, WIN on the centre line, the +
	// stepper flush right with SPIN right-justified against it and the − stepper a fixed slot to the
	// left. [Bonus · Menu] bottom-left with their bottoms aligned; [Auto/Turbo · Spin] bottom-right
	// with the auto top on the spin top and the turbo bottom on the spin bottom (42 + 8 + 42 = 92).
	import type { Controls } from './controls.svelte';
	import { frameArtRect } from '../game/layoutSpec';
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
	// SPIN slot: the widest price the current mode can show at the 'lg' digit height (19), plus air;
	// capped so a trillion-scale menu never pushes the − into the WIN column (TrioStat shrinks)
	const slot = $derived(betSlotWidth(19, 205) + 6);
</script>

<ClockStrip side="left" clock text="ANGRY MANTIS" />
<ClockStrip side="right" text="POLYMATH GAMES" />

<!-- logo + tagline each carry a Shine: a subtle glint every 5 s while idle, a full one on spin, in sync -->
<div class="logo"><img src={stamp('/assets/ui/logo-landscape.webp')} alt="Angry Mantis" draggable="false" /><Shine src={stamp('/assets/ui/logo-landscape.webp')} /></div>
<!-- "WIN UP TO 20,000x" set from Corey's branded glyphs (tools/build_branded_glyphs.py), sized to the text it replaced -->
<div class="tagline"><span class="tag"><img src={stamp('/assets/ui/20000x.webp')} alt="Win up to 20,000×" draggable="false" /><Shine src={stamp('/assets/ui/20000x.webp')} /></span></div>

<!-- readout row on the frame art's edges; maxWidth auto-shrinks huge values (stake.us GC balances hit trillions) -->
<div class="trio" style:left="{art.x}px" style:width="{art.width}px">
	<div class="cell left">
		{#if !replay}<TrioStat label="BALANCE" value={controls.balanceText()} accent="#ffdc4a" size="lg" align="left" maxWidth={205} />{/if}
	</div>
	<div class="cell centre">
		<TrioStat label="WIN" value={controls.winText()} accent="#ffdc4a" size="lg" maxWidth={205} />
	</div>
	<div class="cell right">
		{#if !replay}<StepButton dir={-1} size={28} {controls} />{/if}
		<div class="spin-slot" style:margin-left={replay ? '0' : '18px'}>
			<TrioStat label="SPIN" value={controls.betText()} accent="#ffdc4a" size="lg" align="right" maxWidth={205} minWidth={slot} onclick={replay ? undefined : controls.openDenom} disabled={controls.betDisabled()} />
		</div>
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
	.logo {
		position: absolute;
		top: 90px;
		left: 48px;
		width: 225px;
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
		top: 218px;
		left: 48px;
		width: 225px;
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
