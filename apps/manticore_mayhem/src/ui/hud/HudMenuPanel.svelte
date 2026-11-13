<script lang="ts" module>
	let uid = 0;
</script>

<script lang="ts">
	// THE HELP MENU (Drop 6, "Bookends"): a glass panel with a small tail pointing at the Menu key: GAME INFO, then MUSIC
	// and EFFECTS, each a mute key and a slider. Bound to the SDK's sound state exactly as the old popover was (the same
	// mute memory, the same Game Info press), with the operator's readouts (RTP, NET, TIME) under the sliders where the
	// jurisdiction asks for them. Always mounted, shown by stateUi.menuOpen (opacity and a short rise: no layout work).
	// A tap anywhere else closes it; the Menu key itself toggles it.
	import { stateSound, stateUi, stateBet, stateConfig } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';
	import config from '../../game/config';
	import { sound } from '../../game/sound';
	import type { Controls } from '../controls.svelte';
	import { panelPath } from './hudLayout';
	import HudIcon from './HudIcon.svelte';

	type Props = { controls: Controls; x: number; y: number; W: number; H: number; tip: number; up?: boolean; T?: number; cls?: string };
	const { controls, x, y, W, H, tip, up = false, T = 9, cls = '' }: Props = $props();
	const id = `hudp${++uid}`;

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
	// diagnostics for the iOS audio work: ?audiodiag=1 on the dev server only (compiled away in a build)
	const audioDiag = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('audiodiag');

	// operator readouts (authenticate jurisdiction flags), as the old popover had them
	const j = $derived(stateConfig.jurisdiction);
	const showSession = $derived(j.displayRTP || j.displayNetPosition || j.displaySessionTimer || audioDiag);
	let now = $state(Date.now());
	$effect(() => {
		if (!(j.displaySessionTimer || audioDiag) || !stateUi.menuOpen) return;
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});
	const net = $derived(stateBet.balanceAmount - stateBet.sessionStartBalanceAmount);
	const netText = $derived(`${net < 0 ? '-' : net > 0 ? '+' : ''}${numberToCurrencyString(Math.abs(net), { maximumFractionDigits: 2 })}`);
	const elapsedText = $derived.by(() => {
		const s = Math.max(0, Math.floor((now - (stateBet.sessionStartedAt || now)) / 1000));
		const two = (n: number) => String(n).padStart(2, '0');
		const hh = Math.floor(s / 3600);
		return hh > 0 ? `${hh}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}` : `${two(Math.floor(s / 60))}:${two(s % 60)}`;
	});

	// the operator strip grows the panel AWAY from its tail, so the tail stays on the Menu key
	const extra = $derived(showSession ? (cls === 'pls' ? 16 : 24) : 0);
	const BH = $derived(H + extra);
	const top = $derived(up ? y : y - extra);
	const y0 = $derived(up ? T : 0);
	const path = $derived(panelPath(W, BH, tip, up, T));

	let el: HTMLDivElement | undefined = $state();
	$effect(() => {
		if (!stateUi.menuOpen) return;
		const away = (e: PointerEvent) => {
			const t = e.target as Element | null;
			if (el && t && !el.contains(t) && !t.closest?.('[data-hud="menu-key"]')) stateUi.menuOpen = false;
		};
		document.addEventListener('pointerdown', away, true);
		return () => document.removeEventListener('pointerdown', away, true);
	});
</script>

<div bind:this={el} class="mp {cls}" class:up class:is-open={stateUi.menuOpen} style:left="{x}px" style:top="{top}px" style:width="{W}px" style:height="{BH + T}px" role="dialog" aria-label="Menu" aria-hidden={!stateUi.menuOpen}>
	<div class="mpsh" style:top="{y0}px" style:height="{BH}px"></div>
	<svg class="mpg" width={W} height={BH + T} viewBox="0 0 {W} {BH + T}" aria-hidden="true">
		<defs>
			<linearGradient id="{id}f" gradientUnits="userSpaceOnUse" x1="0" y1={y0} x2="0" y2={y0 + BH}>
				<stop offset="0" style="stop-color:rgb(var(--hud-glass-top-rgb));stop-opacity:var(--hud-panel-top-a)" />
				<stop offset=".5" style="stop-color:rgb(var(--hud-glass-mid-rgb));stop-opacity:var(--hud-panel-mid-a)" />
				<stop offset="1" style="stop-color:rgb(var(--hud-glass-bottom-rgb));stop-opacity:var(--hud-panel-bottom-a)" />
			</linearGradient>
			<linearGradient id="{id}e" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={BH + T}>
				<stop offset="0" style="stop-color:rgb(var(--hud-edge-top-rgb));stop-opacity:.55" />
				<stop offset=".4" style="stop-color:rgb(var(--hud-edge-top-rgb));stop-opacity:.08" />
				<stop offset=".7" style="stop-color:rgb(var(--hud-edge-bottom-rgb));stop-opacity:.12" />
				<stop offset="1" style="stop-color:rgb(var(--hud-edge-bottom-rgb));stop-opacity:.8" />
			</linearGradient>
			<linearGradient id="{id}s" x1="0" y1="0" x2="1" y2="0">
				<stop offset="0" style="stop-color:rgb(var(--hud-ink-rgb));stop-opacity:0" />
				<stop offset=".5" style="stop-color:rgb(var(--hud-ink-rgb));stop-opacity:.34" />
				<stop offset="1" style="stop-color:rgb(var(--hud-ink-rgb));stop-opacity:0" />
			</linearGradient>
		</defs>
		<path d={path} fill="url(#{id}f)" stroke="url(#{id}e)" stroke-width="1" />
		<path d="M22 {y0 + 2.1} H{W - 22}" stroke="url(#{id}s)" stroke-width="1" />
	</svg>
	<div class="mpc" style:top="{y0}px" style:height="{BH}px">
		<button type="button" class="slot-btn hg gl info-row" onclick={controls.openGameInfo} aria-label="Game info">
			<HudIcon name="info" /><span class="it">GAME INFO</span><HudIcon name="chev" cls="chv" />
		</button>
		<i class="hl hz" style="position:relative"></i>
		<div class="vrow">
			<button type="button" class="slot-btn hg gl mk" class:is-muted={stateSound.volumeValueMusic === 0} onclick={toggleMusic} aria-pressed={stateSound.volumeValueMusic === 0} aria-label="Mute music">
				<HudIcon name={stateSound.volumeValueMusic === 0 ? 'musicOff' : 'music'} />
			</button>
			<label class="vs"><span class="vt">MUSIC</span><input type="range" min="0" max="100" step="1" bind:value={stateSound.volumeValueMusic} style:--f={stateSound.volumeValueMusic} aria-label="Music volume" /></label>
			<span class="vn">{stateSound.volumeValueMusic}</span>
		</div>
		<div class="vrow">
			<button type="button" class="slot-btn hg gl mk" class:is-muted={stateSound.volumeValueSoundEffect === 0} onclick={toggleSfx} aria-pressed={stateSound.volumeValueSoundEffect === 0} aria-label="Mute sound effects">
				<HudIcon name={stateSound.volumeValueSoundEffect === 0 ? 'soundOff' : 'sound'} />
			</button>
			<label class="vs"><span class="vt">EFFECTS</span><input type="range" min="0" max="100" step="1" bind:value={stateSound.volumeValueSoundEffect} style:--f={stateSound.volumeValueSoundEffect} aria-label="Sound effects volume" /></label>
			<span class="vn">{stateSound.volumeValueSoundEffect}</span>
		</div>
		{#if showSession}
			<div class="session">
				{#if j.displayRTP}<span><span class="sk2">RTP</span>{(config.rtp * 100).toFixed(2)}%</span>{/if}
				{#if j.displayNetPosition}<span><span class="sk2">NET</span><span class:neg={net < 0} class:pos={net > 0}>{netText}</span></span>{/if}
				{#if j.displaySessionTimer}<span><span class="sk2">TIME</span>{elapsedText}</span>{/if}
				{#if audioDiag}<span><span class="sk2">AUDIO</span>{now ? sound.diag() : ''}</span>{/if}
			</div>
		{/if}
	</div>
</div>
