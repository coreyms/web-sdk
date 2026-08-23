<script lang="ts">
	// Desktop / landscape master (1280×720): logo + tagline left, stats trio centred on the button
	// baseline, [Bonus · Coin/Menu] left and [Auto/Turbo · Spin] right.
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

<div class="trio">
	<TrioStat label="BALANCE" value={controls.balanceText()} accent="#ffdc4a" size="lg" />
	<TrioStat label="WIN" value={controls.winText()} accent={controls.hasWin() ? '#fff' : 'rgba(255,255,255,.45)'} size="lg" />
	<TrioStat label="SPIN" value={controls.betText()} accent="#ffdc4a" size="lg" onclick={replay ? undefined : controls.openDenom} disabled={controls.betDisabled()} overhead={controls.anteActive() ? 'ANTE MODE' : null} />
</div>

<div class="bar">
	<div class="cluster">
		{#if !replay}<BonusButton size={92} {controls} />{/if}
		<div class="col">
			{#if !replay}<CoinButton size={42} {controls} />{/if}
			<MenuButton size={42} {controls} />
		</div>
	</div>
	<div class="cluster right">
		<div class="col">
			{#if !replay}<AutoplayButton size={42} {controls} />{/if}
			<TurboButton size={42} {controls} />
		</div>
		{#if !replay}<SquareSpin size={92} {controls} />{/if}
	</div>
</div>

<style>
	.logo {
		position: absolute;
		top: 90px;
		left: 48px;
		width: 225px;
		height: auto;
		pointer-events: none;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.7));
	}
	.tagline {
		position: absolute;
		top: 218px;
		left: 48px;
		width: 225px;
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
	.trio {
		position: absolute;
		bottom: 18px;
		left: 0;
		right: 0;
		height: 92px;
		display: flex;
		justify-content: center;
		align-items: flex-end;
		gap: 80px;
		padding-bottom: 4px;
		pointer-events: none;
		z-index: 3;
	}
	.bar {
		position: absolute;
		bottom: 18px;
		left: 28px;
		right: 28px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		z-index: 2;
		pointer-events: none;
	}
	.cluster {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.cluster.right {
		gap: 12px;
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
</style>
