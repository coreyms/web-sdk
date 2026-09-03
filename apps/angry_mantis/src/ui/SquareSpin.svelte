<script lang="ts">
	// Spin / Stop / Autoplay-countdown button. While autoplay runs it never shows a stop icon:
	// it shows the live count with ACTIVE underneath, and tapping cancels the sequence.
	import Icon from './Icon.svelte';
	import type { Controls } from './controls.svelte';
	import { replayState } from './replayState.svelte';

	type Props = { size?: number; controls: Controls };
	const { size = 92, controls }: Props = $props();

	// replay: the button is a static REPLAY banner while the round plays and re-arms afterwards
	const replay = $derived(controls.isReplay());
	const replayAgain = $derived(replay && replayState.phase === 'done');
	const autoActive = $derived(controls.autoRunning());
	const showStop = $derived(controls.showStop());
	const countText = $derived(controls.autoCountText());
	const countFont = $derived(countText.length > 3 ? 0.28 : countText === '∞' ? 0.55 : 0.32);
	const background = $derived(
		showStop ? 'rgba(120, 30, 45, .85)' : autoActive ? 'rgba(60, 90, 20, .85)' : 'rgba(10, 14, 10, .6)',
	);
	// armed buy mode: the selected feature is loaded on this button until cancelled — make that
	// unmistakable: short feature name + the (K/M/B/T-abbreviated) price each press will wager
	const armed = $derived(controls.armedBuy() !== null);
	const armedLabel = $derived(controls.armedLabel());
	const armedFont = $derived((controls.playCostText() ?? '').length > 7 ? 0.19 : 0.23);
	const freegame = $derived(controls.freeSpin() !== null);
	const fs = $derived(controls.freeSpin());
	// a parked autoplay loadout: green ring, spins + per-spin price; pressing starts the run
	const loaded = $derived(controls.autoLoadout());
	// during free games the button keeps its classic white ring — colour marks an idle button only
	const ring = $derived(freegame ? '#fff' : autoActive || loaded ? '#9CD92F' : armed ? '#ffdc4a' : '#fff');
</script>

<button
	class="slot-btn spin"
	disabled={replay ? !replayAgain : controls.spinDisabled()}
	onclick={replay ? () => replayState.start?.() : controls.spin}
	aria-label={replay ? 'Replay' : showStop ? 'Stop' : autoActive ? 'Stop autoplay' : 'Spin'}
	style:width="{size}px"
	style:height="{size}px"
	style:background
	style:box-shadow="inset 0 0 0 4px {ring}, inset 0 1px 0 rgba(255,255,255,.3), 0 0 0 1px rgba(0,0,0,.5), 0 14px 28px rgba(0,0,0,.55)"
>
	{#if replay}
		<span class="replay-label" style:font-size="{Math.max(10, size * 0.19)}px">REPLAY</span>
	{:else if freegame && fs}
		<div class="count">
			<span class="active fs-label" style:font-size="{Math.max(8, size * 0.1)}px">Free spin</span>
			<span class="slot-num num" style:font-size="{size * 0.3}px">{fs.current}<span class="of">/{fs.total}</span></span>
		</div>
	{:else if showStop}
		<Icon name="stop" s={size * 0.4} />
	{:else if autoActive}
		<div class="count">
			<span class="slot-num num" style:font-size="{size * countFont}px">{countText}</span>
			<span class="active" style:font-size="{Math.max(9, size * 0.115)}px">Active</span>
		</div>
	{:else if loaded}
		<div class="count">
			<span class="auto-loaded" style:font-size="{Math.max(9, size * 0.105)}px">AUTO {loaded.count === Infinity ? '∞' : loaded.count}</span>
			{#if armed}<span class="armed-label" style:font-size="{Math.max(8, size * 0.095)}px">{armedLabel}</span>{/if}
			<span class="slot-num num" style:font-size="{size * (armed ? 0.17 : armedFont)}px">{controls.playCostText()}</span>
		</div>
	{:else if armed}
		<div class="count">
			<Icon name="play" s={size * 0.24} />
			<span class="armed-label" style:font-size="{Math.max(9, size * 0.115)}px">{armedLabel}</span>
			<span class="slot-num num" style:font-size="{size * armedFont}px">{controls.playCostText()}</span>
		</div>
	{:else}
		<Icon name="play" s={size * 0.44} />
	{/if}
</button>

<style>
	.spin {
		border-radius: 18px;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.08s ease, background 0.2s ease;
	}
	.spin:active:not(:disabled) {
		transform: translateY(1px);
	}
	.count {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		line-height: 1;
		gap: 2px;
	}
	.num {
		font-weight: 800;
		color: #fff;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.7);
		letter-spacing: -0.5px;
	}
	.of {
		font-size: 0.6em;
		opacity: 0.75;
	}
	.fs-label {
		color: #ffdc4a;
	}
	.armed-label {
		font-weight: 900;
		letter-spacing: 1.2px;
		color: #ffdc4a;
		text-transform: uppercase;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
		white-space: nowrap;
	}
	.auto-loaded {
		font-weight: 900;
		letter-spacing: 1.2px;
		color: #9cd92f;
		text-transform: uppercase;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
		white-space: nowrap;
	}
	.replay-label {
		font-weight: 900;
		letter-spacing: 2px;
		color: #fff;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.7);
	}
	.active {
		font-weight: 900;
		letter-spacing: 1.4px;
		color: #dff39a;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
		text-transform: uppercase;
	}
</style>
