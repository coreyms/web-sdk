<script lang="ts">
	// THE SIGN BAR'S MENU POP-OUT (2026-11-23; Corey's pick from the mock menus_r1_2026-11-23, style A "Guide sign": "I
	// like the green menus"): the help menu as a green guide sign by the Menu key: GAME INFO (a plate row), SCENE (Auto,
	// Snow, Dark: three pills, the picked one a white plate), then MUSIC and EFFECTS, each a mute key and a slider (a
	// line with the bar's yellow diamond on it). Until then the sign bar opened the glass dock's blue-grey panel
	// (ui/hud/HudMenuPanel.svelte, which the dock itself still uses: ui/hudTheme.ts HUD_BAR 'dock').
	// What it holds and does is that panel's, unchanged: the SDK's sound state with the same mute memory, the same Game
	// Info press, the scene choice (ui/hud/SceneSwitch.svelte), and the operator's readouts (RTP, NET, TIME) under the
	// sliders where the jurisdiction asks for them. Always mounted, shown by stateUi.menuOpen (opacity and a short
	// rise: no layout work). A press anywhere else closes it; the Menu key itself toggles it; Escape closes it (2026-11-23,
	// the probe host: Escape left it open, and at 400 x 225 it then covered the Auto key; the glass panel never took
	// Escape either). However it closes, the Menu key has the focus after (not when GAME INFO opens over it).
	// ITS SIZE AND PLACE are ui/sign/signPanelLayout.ts's (the mock's rule): drawn 296 px wide at the bar's scale, never
	// under 1 (so none of its words is under its CSS size) and never larger than the window holds; over the Menu key
	// where there is room, under it where the key is at the top, beside it otherwise. On a touch layout every press box
	// is 44 CSS px (the pills, the mute keys, the sliders' rows).
	import { untrack } from 'svelte';
	import { stateSound, stateUi, stateBet, stateConfig, stateModal } from 'state-shared';
	import { numberToCurrencyString } from '../../game/currency';
	import { fitFont, measureFitText } from '../../game/textFit';
	import config from '../../game/config';
	import { sound } from '../../game/sound';
	import type { LayoutKind } from '../../game/layoutSpec';
	import type { Controls } from '../controls.svelte';
	import HudIcon from '../hud/HudIcon.svelte';
	import SceneSwitch from '../hud/SceneSwitch.svelte';
	import type { Box } from './signLayout';
	import { MENU_PANEL, menuClass, menuPanelPlace, type PanelInsets } from './signPanelLayout';
	import SignSlider from './SignSlider.svelte';
	import './signPanel.css';

	type Props = { controls: Controls; kind: LayoutKind; menu: Box; u: number; vw: number; vh: number; safe: PanelInsets };
	/** menu: the Menu key's box, CSS px; u: CSS px per bar px (the plane this panel stands in is drawn in bar px) */
	const { controls, kind, menu, u, vw, vh, safe }: Props = $props();

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

	// operator readouts (authenticate jurisdiction flags), as the dock's panel has them
	const j = $derived(stateConfig.jurisdiction);
	const showSession = $derived(j.displayRTP || j.displayNetPosition || j.displaySessionTimer || audioDiag);
	let now = $state(Date.now());
	$effect(() => {
		if (!(j.displaySessionTimer || audioDiag) || !stateUi.menuOpen) return;
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});
	const net = $derived(stateBet.balanceAmount - stateBet.sessionStartBalanceAmount);
	const netText = $derived(`${net < 0 ? '-' : net > 0 ? '+' : ''}${numberToCurrencyString(Math.abs(net), { fixed: true })}`);
	const elapsedText = $derived.by(() => {
		const s = Math.max(0, Math.floor((now - (stateBet.sessionStartedAt || now)) / 1000));
		const two = (n: number) => String(n).padStart(2, '0');
		const hh = Math.floor(s / 3600);
		return hh > 0 ? `${hh}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}` : `${two(Math.floor(s / 60))}:${two(s % 60)}`;
	});

	// ---- the size class, the height and the place (ui/sign/signPanelLayout.ts) ----
	const coarse = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
	const cls = $derived(menuClass({ kind, vh, coarse }));
	const C = $derived(MENU_PANEL[cls]);
	const P = $derived(menuPanelPlace({ menu, u, vw, vh, safe, cls, session: showSession }));

	// THE NET FITS ITS LINE (as on the dock's panel, 2026-11-21): the amount is one word (game/currency.ts AMOUNT_SPACE),
	// so a long net ("-7,777,000,000.00 GC") shrinks its type to the line, measured from the string, never per frame
	const SESSION_PX = 10;
	const OVER = "'Overpass', sans-serif";
	const netFont = $derived.by(() => {
		const track = 0.1 * SESSION_PX;
		const others = (j.displayRTP ? measureFitText('RTP 00.00%', SESSION_PX, 900, track, OVER) + 10 : 0) + (j.displaySessionTimer ? measureFitText('TIME 00:00:00', SESSION_PX, 900, track, OVER) + 10 : 0);
		const label = measureFitText('NET', SESSION_PX, 900, track, OVER) + 5;
		const box = MENU_PANEL.w - 2 * (MENU_PANEL.band + C.pad) - others - label;
		const px = fitFont({ text: netText, nominal: SESSION_PX, box, weight: 900, letterSpacing: track, face: OVER }) ?? SESSION_PX;
		return px < SESSION_PX ? px : null;
	});

	let el: HTMLDivElement | undefined = $state();
	$effect(() => {
		if (!stateUi.menuOpen) return;
		const away = (e: PointerEvent) => {
			const t = e.target as Element | null;
			// (the sign bar's catch outline of Menu, ui/sign/SignHud.svelte, is the Menu key too: a press on Menu's very edge
			// goes down on it, and closing here first would let its click open the menu again)
			if (el && t && !el.contains(t) && !t.closest?.('[data-hud="menu-key"], [data-catch="menu"]')) stateUi.menuOpen = false;
		};
		// ESCAPE CLOSES IT, and does nothing else: taken on the window before anything else hears the key, and kept from
		// everything else (no round starts or stops on it: the game has no Escape action, and this one ends here)
		const key = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			e.preventDefault();
			e.stopPropagation();
			stateUi.menuOpen = false;
		};
		document.addEventListener('pointerdown', away, true);
		window.addEventListener('keydown', key, true);
		return () => {
			document.removeEventListener('pointerdown', away, true);
			window.removeEventListener('keydown', key, true);
		};
	});
	// THE FOCUS GOES BACK TO THE MENU KEY when the pop-out closes (Escape, a press elsewhere, a second press on the key:
	// a browser that does not focus a pressed button, Safari, leaves it nowhere). Not when it closed because GAME INFO
	// opened over it: then the page has the focus to give. A press elsewhere that lands on another control still
	// focuses that control after, as any press does.
	let wasOpen = false;
	$effect(() => {
		const open = stateUi.menuOpen;
		if (wasOpen && !open && untrack(() => stateModal.modal == null)) el?.parentElement?.querySelector<HTMLElement>('[data-hud="menu-key"]')?.focus({ preventScroll: true });
		wasOpen = open;
	});

	// DEV: the panel's place for the probes (never in a production build)
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		const hook = ((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {});
		hook.signMenu = () => JSON.parse(JSON.stringify({ ...P, cls, open: stateUi.menuOpen }));
	}
</script>

{#snippet volume(name: 'Music' | 'Effects', value: number, set: (v: number) => void, mute: () => void, icon: 'music' | 'musicOff' | 'sound' | 'soundOff', muteLabel: string, sliderLabel: string)}
	<div class="sm-vrow">
		<button type="button" class="sp-well sm-mute" class:muted={value === 0} onclick={mute} aria-pressed={value === 0} aria-label={muteLabel}><HudIcon name={icon} /></button>
		<div class="sm-vs">
			<span class="sp-lab">{name}</span>
			<SignSlider {value} onchange={set} label={sliderLabel} />
		</div>
		<span class="sm-vn">{value}</span>
	</div>
{/snippet}

<div
	bind:this={el}
	class="sgmp {cls}"
	class:is-open={stateUi.menuOpen}
	class:up={P.where === 'under'}
	data-sign-menu={P.where}
	style:left="{P.x / u}px"
	style:top="{P.y / u}px"
	style:width="{P.w / u}px"
	style:height="{P.h / u}px"
	role="dialog"
	aria-label="Menu"
	aria-hidden={!stateUi.menuOpen}
>
	<div class="sm-in" style:width="{MENU_PANEL.w}px" style:height="{P.H}px" style:transform="scale({P.k / u})">
		<div class="sp sp-plate sm-plate" style:--g="{C.gap}px" style:--pad="{C.pad}px" style:--pill="{C.pill}px" style:--row="{C.row}px" style:--mute="{C.mute}px" style:--sl="{C.slider}px">
			<button type="button" class="sp-well sm-info" onclick={controls.openGameInfo} aria-label="Game info">
				<HudIcon name="info" /><span class="sp-cap it">GAME INFO</span><HudIcon name="chev" cls="chv" />
			</button>
			<SceneSwitch sign />
			{@render volume('Music', stateSound.volumeValueMusic, (v) => (stateSound.volumeValueMusic = v), toggleMusic, stateSound.volumeValueMusic === 0 ? 'musicOff' : 'music', 'Mute music', 'Music volume')}
			{@render volume('Effects', stateSound.volumeValueSoundEffect, (v) => (stateSound.volumeValueSoundEffect = v), toggleSfx, stateSound.volumeValueSoundEffect === 0 ? 'soundOff' : 'sound', 'Mute sound effects', 'Sound effects volume')}
			{#if showSession}
				<div class="sm-session">
					{#if j.displayRTP}<span><span class="k">RTP</span>{(config.rtp * 100).toFixed(2)}%</span>{/if}
					{#if j.displayNetPosition}<span><span class="k">NET</span><span class:pos={net > 0} style:font-size={netFont ? `${netFont}px` : undefined} data-hud-net>{netText}</span></span>{/if}
					{#if j.displaySessionTimer}<span><span class="k">TIME</span>{elapsedText}</span>{/if}
					{#if audioDiag}<span><span class="k">AUDIO</span>{now ? sound.diag() : ''}</span>{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* The pop-out's own layout (the mock's mock.css, "the Menu pop-out"); the plate, the small plates, the pills and the
	   sliders are ui/sign/signPanel.css's shared pieces. THREE BOXES: .sgmp is the panel's place in the bar's plane (bar
	   px; its opacity is the open state); .sm-in is the panel at its own px, scaled as a whole (the bar's scale, never
	   under 1); .sm-plate is the sign itself, which rises a little as it opens.
	   SPECIFICITY, on purpose (ui/sign/sign.css, "kept names"): ui/Chrome.svelte fades the bar for a presentation with
	   four classes; the opacity rules here stay under that, so an open menu goes with the bar. */
	.sgmp {
		position: absolute;
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transition:
			opacity 0.14s ease,
			visibility 0s linear 0.14s;
	}
	.sgmp.is-open {
		opacity: 1;
		visibility: visible;
		pointer-events: auto;
		transition: opacity 0.18s ease;
	}
	.sm-in {
		position: absolute;
		left: 0;
		top: 0;
		transform-origin: 0 0;
	}
	.sgmp .sm-plate {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--g);
		padding: var(--pad);
		line-height: 1;
		transform: translateY(10px);
		transition: transform 0.14s ease-in;
	}
	.sgmp.up .sm-plate {
		transform: translateY(-10px);
	}
	.sgmp.is-open .sm-plate {
		transform: none;
		transition: transform 0.26s cubic-bezier(0.2, 0.9, 0.3, 1.25);
	}
	.sgmp .sm-plate > :global(*) {
		flex: none;
	}
	.sgmp .sm-info {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		height: 44px;
		padding: 0 10px 0 12px;
		text-align: left;
		font-size: 14px;
		line-height: 1;
		letter-spacing: 0.12em;
	}
	.sgmp .sm-info :global(.ic) {
		width: 22px;
		height: 22px;
	}
	.sgmp .sm-info .it {
		flex: 1;
	}
	.sgmp .sm-info :global(.chv) {
		width: 18px;
		height: 18px;
	}
	.sgmp :global(.sp-pill) {
		height: var(--pill);
	}
	.sgmp .sm-vrow {
		display: flex;
		align-items: center;
		gap: 10px;
		height: var(--row);
	}
	.sgmp .sm-mute {
		flex: none;
		display: grid;
		place-items: center;
		width: var(--mute);
		height: var(--mute);
	}
	.sgmp .sm-mute :global(.ic) {
		width: 21px;
		height: 21px;
	}
	.sgmp .sm-mute.muted {
		color: var(--sp-ink3);
	}
	.sgmp .sm-vs {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.sgmp .sm-vs :global(.sp-sl) {
		height: var(--sl);
	}
	/* (touch: the slider's row is 44 px tall, so its word sits 6 px into that row's clear top) */
	.sgmp.touch .sm-vs {
		gap: 0;
	}
	.sgmp.touch .sm-vs :global(.sp-lab) {
		margin-bottom: -6px;
	}
	.sgmp .sm-vn {
		flex: none;
		width: 27px;
		text-align: right;
		font-size: 14px;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	/* operator readouts (RTP, NET, TIME): one line under the sliders */
	.sgmp .sm-session {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		height: 16px;
		overflow: hidden;
		white-space: nowrap;
		font-size: 10px;
		line-height: 1;
		letter-spacing: 0.1em;
	}
	.sgmp .sm-session .k {
		color: var(--sp-ink2);
		margin-right: 5px;
	}
	.sgmp .sm-session .pos {
		color: var(--sp-acc);
	}
	@media (prefers-reduced-motion: reduce) {
		.sgmp .sm-plate,
		.sgmp.up .sm-plate {
			transform: none;
			transition: none;
		}
	}
</style>
