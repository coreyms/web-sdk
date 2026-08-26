<script lang="ts">
	import { stamp } from '../game/assets';
	// Phone-landscape master (1480×740): board centred and near full height, logo + free-spin HUD in the
	// left column, vertical control rail on the right edge (thumb zone), stats strip under the board.
	// Buttons are authored larger than desktop so they stay ≥44 CSS px after the master is scaled down.
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
<div class="tagline"><span>WIN UP TO 20,000×</span></div>

<!-- anchored to the reel frame edges, same as desktop; maxWidth auto-shrinks trillion-scale balances -->
<div class="stats">
	<TrioStat label="BALANCE" value={controls.balanceText()} accent="#ffdc4a" align="left" maxWidth={255} />
	<TrioStat label="WIN" value={controls.winText()} accent={controls.hasWin() ? '#fff' : 'rgba(255,255,255,.45)'} maxWidth={255} />
	<TrioStat label="SPIN" value={controls.betText()} accent="#ffdc4a" align="right" maxWidth={255} onclick={replay ? undefined : controls.openDenom} disabled={controls.betDisabled()} />
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
	{#if !replay}<SquareSpin size={116} {controls} />{/if}
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
	.tagline span {
		font-size: 14px;
		font-weight: 900;
		color: #ffdc4a;
		letter-spacing: 2.5px;
		text-shadow: 0 2px 3px rgba(0, 0, 0, 0.7);
	}
	/* Stats strip in the band between the frame bottom (686.5) and the master edge (740). */
	.stats {
		position: absolute;
		bottom: 6px;
		left: 340px; /* FRAME.phone.x */
		width: 800px; /* FRAME.phone.width */
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		justify-items: stretch;
		align-items: end;
		pointer-events: none;
		z-index: 3;
	}
	.cluster-left {
		position: absolute;
		bottom: 16px;
		left: 28px;
		display: flex;
		align-items: center;
		gap: 10px;
		pointer-events: none;
		z-index: 2;
	}
	.cluster-right {
		position: absolute;
		bottom: 16px;
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
</style>
