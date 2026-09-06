<script lang="ts">
	// Menu popover: Game Info + Music/SFX sliders (tap the icon to mute). Bound to the SDK sound state.
	import { stateSound, stateUi, stateBet, stateConfig } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import config from '../game/config';
	import { soc } from '../game/social';

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
	<Popover open={stateUi.menuOpen} onclose={() => (stateUi.menuOpen = false)} side="left" offset={size + 14} width={compact ? 260 : 304}>
		<div class="rows">
			<button class="slot-btn info-row" style:height="{rowH}px" onclick={controls.openGameInfo}>
				<span class="ibox" style:width="{iconBox}px" style:height="{iconBox}px"><Icon name="info" s={iconBox * 0.62} /></span>
				<span class="info-label" style:font-size="{compact ? 14 : 16}px">GAME INFO</span>
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
						<div class="srow"><span class="sk">RTP</span><span class="slot-num sv">{(config.rtp * 100).toFixed(2)}%</span></div>
					{/if}
					{#if j.displayNetPosition}
						<div class="srow"><span class="sk">{soc('NET POSITION', 'NET RESULT')}</span><span class="slot-num sv" class:neg={net < 0} class:pos={net > 0}>{netText}</span></div>
					{/if}
					{#if j.displaySessionTimer}
						<div class="srow"><span class="sk">SESSION</span><span class="slot-num sv">{elapsedText}</span></div>
					{/if}
				</div>
			{/if}
		</div>
	</Popover>
</div>

<style>
	/* paper-ticket popover (Popover.svelte carries the stock); tokens as the other tickets */
	.wrap {
		--ink: #1b1204;
		--body: #2a241a;
		--muted: #6b6250;
		--rule: #a99c7d;
		--green: #4e7d15;
		position: relative;
		display: inline-block;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	/* GAME INFO: the dark stamp, like the tickets' pill */
	.info-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 14px;
		border-radius: 10px;
		background: var(--body);
		box-shadow: 0 3px 0 rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15);
		color: #ebe3cf;
		text-align: left;
	}
	.info-row:active {
		transform: translateY(2px);
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15);
	}
	.ibox {
		border-radius: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #f2c14e;
	}
	.info-label {
		font-weight: 900;
		letter-spacing: 2.5px;
	}
	.sound-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 12px 0 6px;
		border-radius: 10px;
		border: 2px dashed var(--rule);
	}
	.ibtn {
		border-radius: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		color: var(--ink);
	}
	.ibtn.muted {
		color: var(--muted);
		opacity: 0.6;
	}
	.sound-row input {
		flex: 1;
	}
	/* operator readouts: a ruled block under the sliders, same dashed stock as the sound rows */
	.session {
		display: flex;
		flex-direction: column;
		padding: 4px 12px;
		border-radius: 10px;
		border: 2px dashed var(--rule);
	}
	.srow {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		padding: 6px 0;
	}
	.srow + .srow {
		border-top: 1px solid rgba(0, 0, 0, 0.1);
	}
	.sk {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 2px;
		color: var(--muted);
	}
	.sv {
		font-size: 14px;
		font-weight: 800;
		color: var(--ink);
	}
	.sv.neg {
		color: #b8371e;
	}
	.sv.pos {
		color: var(--green);
	}
	/* paper slider: scoped rules outrank the global .vol-slider (ChromeStyles) */
	.vol-slider {
		height: 6px;
		border-radius: 3px;
		background: linear-gradient(90deg, var(--green) var(--fill, 0%), rgba(0, 0, 0, 0.14) var(--fill, 0%));
	}
	.vol-slider.off {
		background: rgba(0, 0, 0, 0.14);
	}
	.vol-slider::-webkit-slider-thumb {
		width: 18px;
		height: 18px;
		background: var(--body);
		box-shadow: inset 0 0 0 3px #ebe3cf, 0 1px 3px rgba(0, 0, 0, 0.5);
	}
	.vol-slider::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border: 0;
		border-radius: 50%;
		background: var(--body);
		box-shadow: inset 0 0 0 3px #ebe3cf, 0 1px 3px rgba(0, 0, 0, 0.5);
	}
</style>
