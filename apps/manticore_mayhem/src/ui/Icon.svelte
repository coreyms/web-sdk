<script lang="ts">
	// THE MODALS' ICONS (the close keys, the Autoplay menu's chevron, the rules page's guide). Bet bar fix (2026-11-19,
	// Stake's "no stock icons" rule): every line glyph here is the HUD's own set (ui/hud/HudIcon.svelte HUD_LINE: 24 box,
	// 2 px line, squared caps, mitred joins, drawn in this repo), so a modal and the bar draw the same marks. The filled
	// ones are plain geometry drawn here (a triangle, a square, ellipses); the PolyMath mark is the studio's own.
	// The chevrons and the close cross used to match Feather's (MIT) path for path; the speaker and the note were
	// Material-like: all replaced.
	import { HUD_LINE } from './hud/HudIcon.svelte';
	type Props = { name: 'play' | 'skip' | 'stop' | 'auto' | 'turbo' | 'instant' | 'menu' | 'close' | 'info' | 'music' | 'musicMute' | 'volume' | 'volumeMute' | 'coins' | 'chevronLeft' | 'chevronRight' | 'polymath'; s?: number };
	const { name, s = 20 }: Props = $props();
	/** the line glyphs, by this file's names */
	const LINE: Partial<Record<Props['name'], string>> = {
		auto: HUD_LINE.auto,
		turbo: HUD_LINE.turbo,
		// two of the turbo bolt, narrowed, side by side
		instant: '<path d="M8.4 3 3.4 12.4h4.4L6.8 21l5.4-9.6H7.8z"/><path d="M17.4 3l-5 9.4h4.4L15.8 21l5.4-9.6h-4.4z"/>',
		menu: HUD_LINE.menu,
		close: HUD_LINE.x,
		info: HUD_LINE.info,
		music: HUD_LINE.music,
		musicMute: HUD_LINE.musicOff,
		volume: HUD_LINE.sound,
		volumeMute: HUD_LINE.soundOff,
		chevronRight: HUD_LINE.chev,
		chevronLeft: '<path d="M14.2 6.5 8.8 12l5.4 5.5"/>',
	};
</script>

{#if LINE[name]}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" stroke-miterlimit="6" aria-hidden="true">{@html LINE[name]}</svg>
{:else if name === 'play'}
	<svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6L19 12z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg>
{:else if name === 'skip'}
	<!-- fast forward: two of the play glyph's triangles, side by side -->
	<svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 6.2v11.6L11.6 12zM12.4 6.2v11.6L20.6 12z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg>
{:else if name === 'stop'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
{:else if name === 'coins'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="2.4" opacity=".95" /><path d="M5 6.5v3.2c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4V6.5" /><path d="M5 11.5v3.2c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4v-3.2" opacity=".75" /><path d="M5 16.5v3.2c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4v-3.2" opacity=".55" /></svg>
{:else if name === 'polymath'}
	<!-- the PolyMath Games mark, geometry from Corey's "Feature Button Final" design (viewBox -112 -126 224 200,
	     stroke 17): struts + ring nodes in currentColor, the node holes in --pm-hole (the tile behind), the
	     hub solid in --pm-core (brand green) -->
	<svg width={s} height={s * (200 / 224)} viewBox="-112 -126 224 200" aria-hidden="true" style="overflow:visible;display:block"><g fill="none" stroke="currentColor" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"><path d="M0 -100 L-85 47 L85 47 Z" /><path d="M0 -100 L0 -2 M-85 47 L0 -2 M85 47 L0 -2" /></g><g stroke-width="17"><circle cx="0" cy="-100" r="16" fill="var(--pm-hole, #15161c)" stroke="currentColor" /><circle cx="-85" cy="47" r="16" fill="var(--pm-hole, #15161c)" stroke="currentColor" /><circle cx="85" cy="47" r="16" fill="var(--pm-hole, #15161c)" stroke="currentColor" /><circle cx="0" cy="-2" r="16" fill="var(--pm-core, #9CD92F)" stroke="var(--pm-core, #9CD92F)" /></g></svg>
{/if}
