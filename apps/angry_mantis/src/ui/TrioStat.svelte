<script lang="ts">
	// BALANCE / WIN / SPIN readout. Interactive only when `onclick` is given (SPIN opens the bet picker).
	type Props = {
		label: string;
		value: string;
		accent?: string;
		align?: 'left' | 'center' | 'right';
		size?: 'sm' | 'md' | 'lg' | 'xl';
		overhead?: string | null;
		maxWidth?: number;
		/** reserve a fixed slot (master px) so neighbours never move as the value changes */
		minWidth?: number;
		onclick?: () => void;
		disabled?: boolean;
	};
	import { fontPxForCap, measureUiText } from './uiMeasure';
	const { label, value, accent = '#ffdc4a', align = 'center', size = 'md', overhead = null, maxWidth, minWidth, onclick, disabled = false }: Props = $props();
	// `val` is the amount's digit (cap) height in master px, the same numbers the stencil glyphs
	// used; the amount is set in the chrome's number face (Sora, white — Corey 2026-09-08: the
	// stencil digits were hard to read, and the HUD's own face is what the play button and the
	// modals already use). maxWidth still shrinks trillion-coin GC balances to fit.
	// 'xl' is the phone-landscape SPIN readout (Corey's 2026-09-06 layout: the play amount reads
	// larger than BALANCE / WIN in that column)
	const sz = $derived(size === 'xl' ? { lbl: 13, val: 26 } : size === 'lg' ? { lbl: 13, val: 19 } : size === 'sm' ? { lbl: 10, val: 12 } : { lbl: 11, val: 14 });
	const interactive = $derived(!!onclick && !disabled);
	const fontPx = $derived.by(() => {
		const px = fontPxForCap(sz.val);
		if (!maxWidth) return px;
		const w = measureUiText(value, px) ?? value.length * px * 0.62;
		return w > maxWidth ? (px * maxWidth) / w : px;
	});
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
	style:min-width={minWidth ? `${minWidth}px` : null}
>
	{#if overhead}
		<span class="overhead" style:font-size="{sz.lbl - 3}px">{overhead}</span>
	{/if}
	<span class="label" style:font-size="{sz.lbl}px" style:color={accent}>{label}</span>
	<span class="value slot-num" style:font-size="{fontPx}px">{value}</span>
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
		display: block;
		width: 100%;
		margin-top: 3px;
		white-space: nowrap;
		font-weight: 700;
		color: #fff;
		line-height: 1;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.7);
	}
</style>
