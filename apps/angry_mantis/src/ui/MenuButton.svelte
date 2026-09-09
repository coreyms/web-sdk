<script lang="ts">
	// Menu popover on black glass (2026-09-09): Game Info + Music/SFX sliders (tap the icon to mute).
	// Bound to the SDK sound state. Three rows, an operator footer only where the jurisdiction asks.
	import { stateSound, stateUi, stateBet, stateConfig } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import config from '../game/config';

	import ChunkyBtn from './ChunkyBtn.svelte';
	import Icon from './Icon.svelte';
	import Popover from './Popover.svelte';
	import type { Controls } from './controls.svelte';

	type Props = { size?: number; controls: Controls; compact?: boolean };
	const { size = 42, controls, compact = false }: Props = $props();

	let lastMusic = 75;
	let lastSfx = 75;
	const toggleMusic = () => {
		if (stateSound.volumeValueMusic === 0) stateSound.volumeValueMusic = lastMusic || 75;
		else {
			lastMusic = stateSound.volumeValueMusic;
			stateSound.volumeValueMusic = 0;
		}
	};
	const toggleSfx = () => {
		if (stateSound.volumeValueSoundEffect === 0) stateSound.volumeValueSoundEffect = lastSfx || 75;
		else {
			lastSfx = stateSound.volumeValueSoundEffect;
			stateSound.volumeValueSoundEffect = 0;
		}
	};

	const rowH = $derived(compact ? 44 : 52);
	const iconBox = $derived(compact ? 36 : 42);

	// operator readouts (authenticate jurisdiction flags): shown only where the operator asks.
	// Net position = balance now minus the balance the session opened with; the timer counts from
	// authenticate. Both live in stateBet (set in Authenticate.svelte).
	const j = $derived(stateConfig.jurisdiction);
	const showSession = $derived(j.displayRTP || j.displayNetPosition || j.displaySessionTimer);
	let now = $state(Date.now());
	$effect(() => {
		if (!j.displaySessionTimer || !stateUi.menuOpen) return;
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});
	const net = $derived(stateBet.balanceAmount - stateBet.sessionStartBalanceAmount);
	const netText = $derived(`${net < 0 ? '−' : net > 0 ? '+' : ''}${numberToCurrencyString(Math.abs(net), { maximumFractionDigits: 2 })}`);
	const elapsedText = $derived.by(() => {
		const s = Math.max(0, Math.floor((now - (stateBet.sessionStartedAt || now)) / 1000));
		const hh = Math.floor(s / 3600);
		const mm = Math.floor((s % 3600) / 60);
		const ss = s % 60;
		const two = (n: number) => String(n).padStart(2, '0');
		return hh > 0 ? `${hh}:${two(mm)}:${two(ss)}` : `${two(mm)}:${two(ss)}`;
	});
</script>

<div class="wrap">
	<ChunkyBtn glass {size} color="#fff" onclick={controls.menuPress} ariaLabel="Menu">
		<Icon name="menu" s={size * 0.42} />
	</ChunkyBtn>
	<Popover open={stateUi.menuOpen} onclose={() => (stateUi.menuOpen = false)} side="left" offset={size + 14} width={compact ? 260 : 304} tail={Math.round(size / 2) - 7}>
		<div class="rows">
			<button class="slot-btn info-row" style:height="{rowH}px" onclick={controls.openGameInfo}>
				<span class="ibox gold" style:width="{iconBox}px" style:height="{iconBox}px"><Icon name="info" s={iconBox * 0.55} /></span>
				<span class="info-label" style:font-size="{compact ? 14 : 15}px">GAME INFO</span>
			</button>

			<div class="sound-row" style:height="{rowH}px">
				<button class="slot-btn ibtn" class:muted={stateSound.volumeValueMusic === 0} style:width="{iconBox}px" style:height="{iconBox}px" onclick={toggleMusic} aria-label="Mute music">
					<Icon name={stateSound.volumeValueMusic === 0 ? 'musicMute' : 'music'} s={iconBox * 0.62} />
				</button>
				<input type="range" min="0" max="100" bind:value={stateSound.volumeValueMusic} class="vol-slider" style:--fill="{stateSound.volumeValueMusic}%" class:off={stateSound.volumeValueMusic === 0} aria-label="Music volume" />
			</div>

			<div class="sound-row" style:height="{rowH}px">
				<button class="slot-btn ibtn" class:muted={stateSound.volumeValueSoundEffect === 0} style:width="{iconBox}px" style:height="{iconBox}px" onclick={toggleSfx} aria-label="Mute sound effects">
					<Icon name={stateSound.volumeValueSoundEffect === 0 ? 'volumeMute' : 'volume'} s={iconBox * 0.62} />
				</button>
				<input type="range" min="0" max="100" bind:value={stateSound.volumeValueSoundEffect} class="vol-slider" style:--fill="{stateSound.volumeValueSoundEffect}%" class:off={stateSound.volumeValueSoundEffect === 0} aria-label="Sound effects volume" />
			</div>

			{#if showSession}
				<div class="session">
					{#if j.displayRTP}
						<span class="srow"><span class="sk">RTP</span><span class="slot-num sv">{(config.rtp * 100).toFixed(2)}%</span></span>
					{/if}
					{#if j.displayNetPosition}
						<span class="srow"><span class="sk">NET</span><span class="slot-num sv" class:neg={net < 0} class:pos={net > 0}>{netText}</span></span>
					{/if}
					{#if j.displaySessionTimer}
						<span class="srow"><span class="sk">TIME</span><span class="slot-num sv">{elapsedText}</span></span>
					{/if}
				</div>
			{/if}
		</div>
	</Popover>
</div>

<style>
	/* black glass popover (Popover.svelte carries the surface); tokens from ChromeStyles */
	.wrap {
		position: relative;
		display: inline-block;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	/* GAME INFO: the one tappable row, on a well, with the one gold icon box on the panel */
	.info-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 6px 0 4px;
		border-radius: 10px;
		background: var(--ui-glass-well);
		color: var(--ui-ink);
		text-align: left;
	}
	.info-row:hover {
		background: var(--ui-glass-well-2);
	}
	.info-row:active {
		transform: translateY(1px);
	}
	.ibox {
		border-radius: 10px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--ui-glass-well);
		color: var(--ui-ink);
		flex: 0 0 auto;
	}
	.ibox.gold {
		background: var(--ui-gold);
		color: var(--ui-gold-ink);
	}
	.info-label {
		font-weight: 800;
		letter-spacing: 2px;
	}
	.sound-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 6px 0 4px;
	}
	.ibtn {
		border-radius: 10px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--ui-glass-well);
		color: var(--ui-ink);
		flex: 0 0 auto;
	}
	.ibtn.muted {
		color: var(--ui-ink-3);
	}
	.sound-row input {
		flex: 1;
		min-width: 0;
	}
	/* operator readouts: a hairline-topped footer strip, faint labels, Sora values */
	.session {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 4px 12px;
		padding: 8px 8px 2px;
		border-top: 1px solid var(--ui-rule);
	}
	.srow {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
	}
	.sk {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 1.5px;
		color: var(--ui-ink-3);
	}
	.sv {
		font-size: 12px;
		font-weight: 600;
		color: var(--ui-ink-2);
	}
	.sv.neg {
		color: #ff8a70;
	}
	.sv.pos {
		color: var(--ui-green);
	}
</style>
