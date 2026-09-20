<script lang="ts">
	// Spin / Stop / Autoplay-countdown button. While autoplay runs it never shows a stop icon:
	// it shows the live count with ACTIVE underneath, and tapping cancels the sequence.
	import Icon from './Icon.svelte';
	import type { Controls } from './controls.svelte';
	import { replayState } from './replayState.svelte';
	import { SPIN_PRICE_FIT } from '../game/constants';
	import { fitFont } from '../game/textFit';

	type Props = { size?: number; controls: Controls };
	const { size = 92, controls }: Props = $props();

	// replay: the button is a static REPLAY banner while the round plays and re-arms afterwards
	const replay = $derived(controls.isReplay());
	const replayAgain = $derived(replay && replayState.phase === 'done');
	const autoActive = $derived(controls.autoRunning());
	const showStop = $derived(controls.showStop());
	const countText = $derived(controls.autoCountText());
	const countFont = $derived(countText.length > 3 ? 0.28 : countText === '∞' ? 0.55 : 0.32);
	// Corey's 2026-09-06 spec: a near-black flat square with a THIN outline. The old state colours
	// stay (Corey 16:20): red fill while stopping, green fill while an autoplay run is live, a green
	// outline with a loadout parked, gold with a buy mode armed, white otherwise.
	const background = $derived(
		showStop ? 'rgba(120, 30, 45, .88)' : autoActive ? 'rgba(60, 90, 20, .88)' : 'rgba(20, 18, 16, .85)',
	);
	const ring = $derived(Math.max(2, size * 0.03));
	const radius = $derived(Math.round(Math.min(size * 0.22, 8 + size * 0.07)));
	// armed buy mode: the selected feature is loaded on this button until cancelled — make that
	// unmistakable: short feature name + the price each press will wager
	const armed = $derived(controls.armedBuy() !== null);
	const armedLabel = $derived(controls.armedLabel());
	// The free-spin counter outranks the REPLAY banner WHILE the replayed round is playing (Stake
	// review 2026-09-20: the counter has to be visible during a replay too). Between replays the
	// button is the banner again, because that is what re-arms the playback.
	const showFreeSpins = $derived(!replay || replayState.phase === 'playing');
	const freegame = $derived(controls.freeSpin() !== null);
	const fs = $derived(controls.freeSpin());
	// a parked autoplay loadout: green outline, spins + per-spin price; pressing starts the run
	const loaded = $derived(controls.autoLoadout());
	// PRICE FIT (Stake review 2026-09-20, FIX 4): the price is the FULL currency string, never
	// K/M-abbreviated, and the button must never overflow. Measure it once per string/size change
	// (game/textFit.ts — a metrics call, not a render) and shrink to the SPIN_PRICE_FIT floor;
	// below the floor the line is dropped and the button shows only the mode word. The HUD's
	// SPIN / TOTAL readout always prints the full amount, so nothing becomes unreadable.
	const priceText = $derived(controls.playCostText() ?? '');
	const priceNominal = $derived(
		size * (loaded ? (armed ? SPIN_PRICE_FIT.nominalLoadedArmed : SPIN_PRICE_FIT.nominalLoaded) : SPIN_PRICE_FIT.nominal),
	);
	const priceFont = $derived(
		fitFont({
			text: priceText,
			nominal: priceNominal,
			box: size * SPIN_PRICE_FIT.boxFrac,
			minScale: SPIN_PRICE_FIT.minScale,
			weight: SPIN_PRICE_FIT.weight,
			letterSpacing: SPIN_PRICE_FIT.letterSpacing,
		}),
	);
	// during free games the button keeps its white outline — colour marks an idle button only
	const ringColor = $derived(freegame ? '#fff' : autoActive || loaded ? '#9CD92F' : armed ? '#ffdc4a' : '#fff');
</script>

<button
	class="slot-btn spin"
	disabled={replay ? !replayAgain : controls.spinDisabled()}
	onclick={replay ? () => replayState.start?.() : controls.spin}
	aria-label={replay ? 'Replay' : showStop ? 'Stop' : autoActive ? 'Stop autoplay' : 'Spin'}
	style:width="{size}px"
	style:height="{size}px"
	style:background
	style:border-radius="{radius}px"
	style:box-shadow="inset 0 0 0 {ring}px {ringColor}, 0 4px 12px rgba(0,0,0,.45)"
>
	{#if freegame && fs && showFreeSpins}
		<div class="count">
			<span class="active fs-label" style:font-size="{Math.max(8, size * 0.1)}px">Free spin</span>
			<span class="slot-num num" style:font-size="{size * 0.3}px">{fs.current}<span class="of">/{fs.total}</span></span>
		</div>
	{:else if replay}
		<span class="replay-label" style:font-size="{Math.max(10, size * 0.19)}px">REPLAY</span>
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
			{#if priceFont !== null}<span class="slot-num num" style:font-size="{priceFont}px">{priceText}</span>{/if}
		</div>
	{:else if armed}
		<div class="count">
			<Icon name="play" s={size * 0.24} />
			<span class="armed-label" style:font-size="{Math.max(9, size * 0.115)}px">{armedLabel}</span>
			{#if priceFont !== null}<span class="slot-num num" style:font-size="{priceFont}px">{priceText}</span>{/if}
		</div>
	{:else}
		<Icon name="play" s={size * 0.44} />
	{/if}
</button>

<style>
	.spin {
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
