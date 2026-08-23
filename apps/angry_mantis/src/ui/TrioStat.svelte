<script lang="ts">
	// BALANCE / WIN / SPIN readout. Interactive only when `onclick` is given (SPIN opens the bet picker).
	type Props = {
		label: string;
		value: string;
		accent?: string;
		align?: 'left' | 'center' | 'right';
		size?: 'sm' | 'md' | 'lg';
		overhead?: string | null;
		onclick?: () => void;
		disabled?: boolean;
	};
	const { label, value, accent = '#ffdc4a', align = 'center', size = 'md', overhead = null, onclick, disabled = false }: Props = $props();
	const sz = $derived(size === 'lg' ? { lbl: 13, val: 26 } : size === 'sm' ? { lbl: 10, val: 16 } : { lbl: 11, val: 18 });
	const interactive = $derived(!!onclick && !disabled);
</script>

<button
	type="button"
	class="stat"
	class:slot-btn={interactive}
	disabled={!interactive}
	{onclick}
	style:align-items={align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'}
	style:text-align={align}
	style:pointer-events={interactive ? 'auto' : 'none'}
	style:cursor={interactive ? 'pointer' : 'default'}
>
	{#if overhead}
		<span class="overhead" style:font-size="{sz.lbl - 3}px">{overhead}</span>
	{/if}
	<span class="label" style:font-size="{sz.lbl}px" style:color={accent}>{label}</span>
	<span class="slot-num value" style:font-size="{sz.val}px">{value}</span>
</button>

<style>
	.stat {
		background: transparent;
		border: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		line-height: 1.05;
		font-family: var(--ui-font);
		opacity: 1 !important;
	}
	.overhead {
		font-weight: 900;
		letter-spacing: 2px;
		color: #e8b04a;
		background: rgba(232, 176, 74, 0.15);
		padding: 2px 6px;
		border-radius: 4px;
		text-shadow: 0 0 8px rgba(232, 176, 74, 0.55);
		margin-bottom: 3px;
	}
	.label {
		font-weight: 900;
		letter-spacing: 2.5px;
		text-transform: uppercase;
		text-shadow: 0 2px 0 rgba(0, 0, 0, 0.5);
	}
	.value {
		font-weight: 700;
		color: #fff;
		text-shadow: 0 2px 3px rgba(0, 0, 0, 0.7);
		margin-top: 2px;
		white-space: nowrap;
	}
</style>
