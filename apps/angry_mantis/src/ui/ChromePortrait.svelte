<script lang="ts">
	import { stamp } from '../game/assets';
	// Portrait master (412×760): wide logo on top, BALANCE/SPIN above the controls, WIN on the button baseline.
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

<div class="top"><img src={stamp('/assets/ui/logo-wide.webp')} alt="Angry Mantis" draggable="false" /></div>

<div class="stats">
	{#if replay}<div></div>{:else}<TrioStat label="BALANCE" value={controls.balanceText()} accent="#ffdc4a" align="left" maxWidth={180} />{/if}
	<TrioStat label="SPIN" value={controls.betText()} accent="#ffdc4a" align="right" maxWidth={180} onclick={replay ? undefined : controls.openDenom} disabled={controls.betDisabled()} />
</div>
<div class="win">
	<TrioStat label="WIN" value={controls.winText()} accent={controls.hasWin() ? '#fff' : 'rgba(255,255,255,.45)'} align="center" maxWidth={240} />
</div>

<div class="bar">
	<div class="cluster">
		{#if !replay}<BonusButton size={78} {controls} />{/if}
		<div class="col">
			{#if !replay}<CoinButton size={36} {controls} />{/if}
			<MenuButton size={36} {controls} compact />
		</div>
	</div>
	<div class="cluster">
		<div class="col">
			{#if !replay}<AutoplayButton size={36} {controls} compact />{/if}
			<TurboButton size={36} {controls} />
		</div>
		<SquareSpin size={78} {controls} />
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
	.top img {
		width: 330px;
		height: auto;
		margin: -8px 0;
		filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.6));
	}
	.stats {
		position: absolute;
		bottom: 104px;
		left: 14px;
		right: 14px;
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		pointer-events: none;
	}
	.win {
		position: absolute;
		bottom: 16px;
		left: 0;
		right: 0;
		height: 78px;
		display: flex;
		justify-content: center;
		align-items: flex-end;
		padding-bottom: 4px;
		pointer-events: none;
	}
	.bar {
		position: absolute;
		bottom: 16px;
		left: 4px;
		right: 4px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		z-index: 2;
		pointer-events: none;
	}
	.cluster {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	/* TAP TARGETS: at the worst documented fit (390px-wide phone → scale 412/390 ≈ 0.946) the 36px
	   Coin/Menu/Auto/Turbo buttons render ~34 CSS px, under the ≥44 CSS px rule. A transparent
	   ::after (buttons are position:relative via .slot-btn) grows each hit box to ≥47 master px
	   ≈ 44.5 CSS px without moving a pixel visually. The outer vertical edge takes the slack (-8px),
	   the shared edge only half the 6px column gap; the ±8px sides exactly fill the 8px cluster gap
	   to the big Bonus/Spin button, so no hit box is contested. */
	.col :global(.slot-btn.chunky)::after {
		content: '';
		position: absolute;
		top: -3px;
		bottom: -3px;
		left: -8px;
		right: -8px;
	}
	.col > :global(.slot-btn.chunky:first-child)::after,
	.col > :global(:first-child .slot-btn.chunky)::after {
		top: -8px;
	}
	.col > :global(.slot-btn.chunky:last-child)::after,
	.col > :global(:last-child .slot-btn.chunky)::after {
		bottom: -8px;
	}
</style>
