<script lang="ts">
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

<img class="logo" src="/assets/ui/logo-landscape.webp" alt="Angry Mantis" draggable="false" />
<div class="tagline"><span>WIN UP TO 20,000×</span></div>

<div class="stats">
	<TrioStat label="BALANCE" value={controls.balanceText()} accent="#ffdc4a" />
	<TrioStat label="WIN" value={controls.winText()} accent={controls.hasWin() ? '#fff' : 'rgba(255,255,255,.45)'} />
	<TrioStat label="SPIN" value={controls.betText()} accent="#ffdc4a" onclick={replay ? undefined : controls.openDenom} disabled={controls.betDisabled()} overhead={controls.anteActive() ? 'ANTE MODE' : null} />
</div>

<div class="cluster-left">
	{#if !replay}<BonusButton size={84} {controls} />{/if}
	<div class="col">
		{#if !replay}<CoinButton size={46} {controls} />{/if}
		<MenuButton size={46} {controls} compact />
	</div>
</div>

<div class="rail">
	{#if !replay}<AutoplayButton size={52} {controls} compact />{/if}
	{#if !replay}<SquareSpin size={116} {controls} />{/if}
	<TurboButton size={52} {controls} />
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
		left: 340px;
		width: 800px;
		display: flex;
		justify-content: center;
		align-items: flex-end;
		gap: 70px;
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
	/* Right-edge thumb rail: auto / spin / turbo, vertically centred. */
	.rail {
		position: absolute;
		right: 26px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 18px;
		pointer-events: none;
		z-index: 2;
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
</style>
