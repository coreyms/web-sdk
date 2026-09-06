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
	// and NO colour on the buttons at rest or active — only the bonus button is green.
	// glass  → a near-black translucent square with a thin light outline and a white glyph (menu,
	//          autoplay, turbo, −, +). An ACTIVE state colours the GLYPH in the accent; the fill and
	//          outline never change (Corey 2026-09-06: the tinted fills and rings were too loud).
	// solid  → a flat fill in the accent with a faint lighter outline (the bonus button).
	// Outline weight and corner radius scale with the button: ~1.7px / r≈9 on the 42s.
	const ring = $derived(glass ? Math.max(1.5, size * 0.04) : Math.max(1.5, size * 0.02));
	const radius = $derived(Math.round(Math.min(size * 0.22, 8 + size * 0.07)));
	const background = $derived(glass ? 'rgba(14, 13, 12, 0.72)' : color);
	const outline = $derived(glass ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)');
	const shadow = $derived(`inset 0 0 0 ${ring}px ${outline}, 0 3px 8px rgba(0,0,0,0.4)`);
	const fg = $derived(glass ? (active ? color : '#fff') : '#0e0717');
</script>

<button
	class="slot-btn chunky"
	class:glass
	{disabled}
	{onclick}
	aria-label={ariaLabel}
	style:width="{size}px"
	style:height="{size}px"
	style:border-radius="{radius}px"
	style:background
	style:box-shadow={shadow}
	style:color={fg}
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
		transition: transform 0.08s ease;
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
