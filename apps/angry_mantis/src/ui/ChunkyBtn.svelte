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

	const background = $derived(
		glass
			? active
				? `linear-gradient(180deg, ${color}aa 0%, ${color}55 100%)`
				: 'rgba(10,14,10,0.55)'
			: active
				? `radial-gradient(circle at 30% 25%, ${color}, ${color}55 60%, #00000088 100%)`
				: 'transparent',
	);
	const shadow = $derived(
		glass
			? `inset 0 0 0 3px ${color}, inset 0 1px 0 rgba(255,255,255,.25), 0 4px 12px rgba(0,0,0,.45)`
			: `inset 0 0 0 3px ${color}, 0 4px 12px rgba(0,0,0,.6)`,
	);
	const fg = $derived(active ? (glass ? '#fff' : '#0e0717') : color);
</script>

<button
	class="slot-btn chunky"
	class:glass
	{disabled}
	{onclick}
	aria-label={ariaLabel}
	style:width="{size}px"
	style:height="{size}px"
	style:border-radius="{Math.round(size * 0.22)}px"
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
	.glass {
	}
	.label {
		font-weight: 800;
		letter-spacing: 0.8px;
		margin-top: 1px;
		white-space: nowrap;
	}
</style>
