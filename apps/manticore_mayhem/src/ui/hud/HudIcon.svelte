<script lang="ts" module>
	// THE HUD'S ICON SET (the Drop 6 mockup's "Crown Line"): 24 box, 2 px line, squared caps, mitred joins, all in
	// currentColor. The feature button's glyph comes from ui/hudTheme.ts HUD_CONFIG (per game).
	import { HUD_CONFIG } from '../hudTheme';
	export type HudIconName =
		| 'arm' | 'menu' | 'auto' | 'turbo' | 'skip' | 'minus' | 'plus' | 'info' | 'chev' | 'music' | 'musicOff' | 'sound' | 'soundOff' | 'x';
	const LINE: Record<HudIconName, string> = {
		arm: `<path d="${HUD_CONFIG.featureIcon}"/>`,
		menu: '<path d="M5 7h14M5 12h14M5 17h14"/>',
		auto: '<path d="M18.6 13.4A6.8 6.8 0 1 1 16.8 7"/><path d="M17.4 3.6v4h-4"/>',
		turbo: '<path class="bolt" d="M13.4 3 6.2 13.2h5.2L10.4 21l7.4-10.4h-5.2z"/>',
		skip: '<path d="M5 7v10l5.6-5zM12 7v10l5.6-5zM20 7v10"/>',
		minus: '<path d="M7 12h10"/>',
		plus: '<path d="M7 12h10M12 7v10"/>',
		info: '<circle cx="12" cy="12" r="8.4"/><path d="M12 11v5.4M12 7.8v.4"/>',
		chev: '<path d="M9.8 6.5 15.2 12l-5.4 5.5"/>',
		music: '<path d="M9 17V5.6l10-1.8V15"/><circle cx="6.6" cy="17" r="2.4"/><circle cx="16.6" cy="15" r="2.4"/>',
		musicOff: '<path d="M9 17V5.6l10-1.8V15"/><circle cx="6.6" cy="17" r="2.4"/><circle cx="16.6" cy="15" r="2.4"/><path d="M4 4l16 16"/>',
		sound: '<path d="M4 9.4h3.6L12 5.8v12.4l-4.4-3.6H4z"/><path d="M15.4 9.6a3.4 3.4 0 0 1 0 4.8M17.8 7.2a6.8 6.8 0 0 1 0 9.6"/>',
		soundOff: '<path d="M4 9.4h3.6L12 5.8v12.4l-4.4-3.6H4z"/><path d="M15.6 9.6l4.8 4.8M20.4 9.6l-4.8 4.8"/>',
		x: '<path d="M7 7l10 10M17 7 7 17"/>',
	};
</script>

<script lang="ts">
	type Props = { name: HudIconName; cls?: string };
	const { name, cls = '' }: Props = $props();
</script>

<svg class="ic {cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" stroke-miterlimit="6" aria-hidden="true">{@html LINE[name]}</svg>
