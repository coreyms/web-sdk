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
				<input type="range" min="0" max="100" bind:value={stateSound.volumeValueMusic} class="vol-slider" style:accent-color={stateSound.volumeValueMusic === 0 ? '#6b7280' : '#9CD92F'} aria-label="Music volume" />
			</div>

			<div class="sound-row" style:height="{rowH}px">
				<button class="slot-btn ibtn" class:muted={stateSound.volumeValueSoundEffect === 0} style:width="{iconBox}px" style:height="{iconBox}px" onclick={toggleSfx} aria-label="Mute sound effects">
					<Icon name={stateSound.volumeValueSoundEffect === 0 ? 'volumeMute' : 'volume'} s={iconBox * 0.62} />
				</button>
				<input type="range" min="0" max="100" bind:value={stateSound.volumeValueSoundEffect} class="vol-slider" style:accent-color={stateSound.volumeValueSoundEffect === 0 ? '#6b7280' : '#9CD92F'} aria-label="Sound effects volume" />
			</div>
		</div>
	</Popover>
</div>

<style>
	.wrap {
		position: relative;
		display: inline-block;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.info-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 14px;
		border-radius: 10px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(0, 0, 0, 0.45) 100%);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 3px 0 rgba(0, 0, 0, 0.4);
		color: #fff;
		text-align: left;
	}
	.ibox {
		border-radius: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #ffdc4a;
	}
	.info-label {
		font-weight: 900;
		letter-spacing: 1.5px;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
	}
	.sound-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 12px 0 8px;
		border-radius: 10px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(0, 0, 0, 0.35) 100%);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
	}
	.ibtn {
		border-radius: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		color: #fff;
	}
	.ibtn.muted {
		color: rgba(255, 255, 255, 0.45);
	}
	.sound-row input {
		flex: 1;
	}
</style>
