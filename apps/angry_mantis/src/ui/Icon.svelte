<script lang="ts">
	type Props = { name: 'play' | 'stop' | 'auto' | 'turbo' | 'instant' | 'menu' | 'close' | 'info' | 'music' | 'musicMute' | 'volume' | 'volumeMute' | 'coins' | 'chevronLeft' | 'chevronRight'; s?: number };
	const { name, s = 20 }: Props = $props();
</script>

{#if name === 'play'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.55.83l11.5-7.5a1 1 0 0 0 0-1.66l-11.5-7.5A1 1 0 0 0 7 4.5z" /></svg>
{:else if name === 'stop'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
{:else if name === 'auto'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3.5-7.1" /><path d="M21 4v5h-5" /></svg>
{:else if name === 'turbo'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" /></svg>
{:else if name === 'instant'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 2L1 13h4l-1 7 6-10h-4l1-8z" /><path d="M7 2L1 13h4l-1 7 6-10h-4l1-8z" transform="translate(12 0)" /></svg>
{:else if name === 'menu'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
{:else if name === 'close'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
{:else if name === 'info'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none" /></svg>
{:else if name === 'music'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 17.5a2.5 2.5 0 1 1-2.5-2.5c.55 0 1.06.18 1.5.5V5l11-2v11.5a2.5 2.5 0 1 1-2.5-2.5c.55 0 1.06.18 1.5.5V6.6L9 8.3v9.2z" /></svg>
{:else if name === 'musicMute'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 17.5a2.5 2.5 0 1 1-2.5-2.5c.55 0 1.06.18 1.5.5V5l11-2v11.5a2.5 2.5 0 1 1-2.5-2.5c.55 0 1.06.18 1.5.5V6.6L9 8.3v9.2z" opacity=".35" /><path d="M3 3l18 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none" /></svg>
{:else if name === 'volume'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 10v4h4l5 4V6L7 10H3z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><path d="M18.5 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
{:else if name === 'volumeMute'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 10v4h4l5 4V6L7 10H3z" opacity=".5" /><path d="M16 9l5 5M21 9l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" /></svg>
{:else if name === 'coins'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="2.4" opacity=".95" /><path d="M5 6.5v3.2c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4V6.5" /><path d="M5 11.5v3.2c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4v-3.2" opacity=".75" /><path d="M5 16.5v3.2c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4v-3.2" opacity=".55" /></svg>
{:else if name === 'chevronLeft'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
{:else if name === 'chevronRight'}
	<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
{/if}
