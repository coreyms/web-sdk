<script lang="ts">
	// Square "graffiti grunge" button: 3px inset ring in the accent colour, optional frosted glass.
	import type { Snippet } from 'svelte';

	type Props = {
		size?: number;
		color?: string;
		active?: boolean;
		glass?: boolean;
		disabled?: boolean;
		label?: string;
		ariaLabel?: string;
		onclick?: () => void;
		children: Snippet;
	};
	const { size = 52, color = '#fff', active = false, glass = false, disabled = false, label, ariaLabel, onclick, children }: Props = $props();

	// Corey's 2026-09-06 button spec (Claude Design mocks): flat, no gradients, no inner highlight,
	// thin light outlines. At rest nothing but the bonus button is coloured.
	// glass  → the HUD's square (menu, autoplay, turbo, −, +). ACTIVE keeps the old coloured-glass
	//          look (Corey 16:20): the fill takes the accent (and, since 2026-10-15, the bezel its metal).
	// solid  → a flat fill in the accent with a faint lighter outline (unused since the bonus button
	//          became its own component).
	// THE BRONZE PLATE (2026-10-15): a glass button is the HUD's riveted plate (ui/ChromeStyles.svelte .am-plate).
	// Active, the bezel takes the accent's metal and the glass keeps the accent tint it always had.
	const METAL: Record<string, string> = { '#ffdc4a': 'gold', '#9cd92f': 'green', '#ff5a8a': 'pink' };
	const metal = $derived(glass && active ? (METAL[color.toLowerCase()] ?? '') : '');
	const ring = $derived(Math.max(1.5, size * 0.02));
	const radius = $derived(Math.round(Math.min(size * 0.22, 8 + size * 0.07)));
	const tint = $derived(glass && active ? [`${color}b3`, `${color}66`] : null);
</script>

<button
	class="slot-btn chunky {metal ? `plate-${metal}` : ''}"
	class:glass
	class:am-plate={glass}
	{disabled}
	{onclick}
	aria-label={ariaLabel}
	style:width="{size}px"
	style:height="{size}px"
	style:--plate-s="{size}px"
	style:--plate-g1={tint?.[0]}
	style:--plate-g2={tint?.[1]}
	style:border-radius={glass ? undefined : `${radius}px`}
	style:background={glass ? undefined : color}
	style:box-shadow={glass ? undefined : `inset 0 0 0 ${ring}px rgba(255,255,255,0.45), 0 3px 8px rgba(0,0,0,0.4)`}
	style:color={glass ? undefined : '#0e0717'}
>
	{@render children()}
	{#if label}
		<span class="label" style:font-size="{Math.max(8, size * 0.16)}px">{label}</span>
	{/if}
</button>

<style>
	.chunky {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		transition: transform 0.08s ease, filter var(--ui-hover-ms) ease;
	}
	.chunky:active:not(:disabled) {
		transform: translateY(1px);
	}
	.label {
		font-weight: 800;
		letter-spacing: 0.8px;
		margin-top: 1px;
		white-space: nowrap;
	}
</style>
