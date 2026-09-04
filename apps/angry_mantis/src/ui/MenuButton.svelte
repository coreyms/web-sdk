<script lang="ts">
	// Menu popover: Game Info + Music/SFX sliders (tap the icon to mute). Bound to the SDK sound state.
	import { stateSound, stateUi } from 'state-shared';

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
