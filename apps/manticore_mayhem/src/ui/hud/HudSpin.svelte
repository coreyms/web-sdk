<script lang="ts">
	// THE SPIN (Drop 6): the hero circle, one size in every state; every count lives inside it. What it does is
	// controls.svelte.ts's, unchanged (spin / stop / slam stop / start a loaded run / stop a run / the balance notice);
	// this is only its face:
	//   idle            the play triangle
	//   spinning        a white square (STOP) and a turning gold arc; after a slam stop (or under disabledSlamstop) the
	//                   arc still turns and the face dims (disabled)
	//   autoplay run    a small square (its stop), the spins left (an infinity drawn in SVG for an open run), AUTO
	//   autoplay loaded a small play triangle, the loaded count, AUTO, a dotted gold ring (pressing starts the run)
	//   free spins      the spin in play OF the total, the gold arc filled to the same share
	//   armed buy       a small play triangle, the mode's name and the price of the press (fitted, never abbreviated)
	//   replay          REPLAY (pressable once the replayed round is done); a replayed feature shows its count
	import type { Controls } from '../controls.svelte';
	import { replayState } from '../replayState.svelte';
	import { fitFont, UI_TEXT_FACE } from '../../game/textFit';

	type Props = { controls: Controls; x: number; y: number; d: number };
	const { controls, x, y, d }: Props = $props();

	const CIRC = 2 * Math.PI * 46;
	const replay = $derived(controls.isReplay());
	const replayAgain = $derived(replay && replayState.phase === 'done');
	const autoActive = $derived(controls.autoRunning());
	const showStop = $derived(controls.showStop());
	const fs = $derived(controls.freeSpin());
	const showFreeSpins = $derived(!replay || replayState.phase === 'playing');
	const loaded = $derived(controls.autoLoadout());
	const armed = $derived(controls.armedBuy() !== null);
	const idle = $derived(controls.isIdle());

	const mode = $derived(
		fs && showFreeSpins ? 'feature' : replay ? 'replay' : showStop ? 'spinning' : autoActive ? 'auto' : !idle ? 'busy' : loaded ? 'loaded' : armed ? 'armed' : 'idle',
	);
	const count = $derived(mode === 'auto' ? controls.autoCount() : mode === 'loaded' && loaded ? loaded.count : 0);
	const countText = $derived(count === Infinity ? '' : String(count));
	const priceText = $derived(mode === 'armed' ? (controls.playCostText() ?? '') : '');
	const priceFont = $derived(priceText ? fitFont({ text: priceText, nominal: d * 0.13, box: d * 0.7, minScale: 0.55, weight: 900, face: UI_TEXT_FACE }) : null);
	const rot = $derived(mode === 'spinning' || mode === 'auto' || mode === 'busy');
	const label = $derived(replay ? 'Replay' : showStop ? 'Stop' : autoActive ? 'Stop autoplay' : 'Spin');
</script>

<button
	type="button"
	class="slot-btn spin hg hit m-{mode}"
	style:left="{x}px"
	style:top="{y}px"
	style:width="{d}px"
	style:height="{d}px"
	style:--d="{d}px"
	disabled={replay ? !replayAgain : controls.spinDisabled()}
	onclick={replay ? () => replayState.start?.() : controls.spin}
	aria-label={label}
>
	<svg class="ring" class:rot viewBox="0 0 100 100" aria-hidden="true">
		<circle class="trk" cx="50" cy="50" r="46" />
		{#if mode === 'feature' && fs}
			<circle class="arc" cx="50" cy="50" r="46" stroke-dasharray="{(Math.min(fs.current, fs.total) / Math.max(1, fs.total)) * CIRC} {CIRC}" />
		{:else if rot}
			<circle class="arc" cx="50" cy="50" r="46" stroke-dasharray="58 {CIRC}" />
		{:else if mode === 'loaded' || mode === 'armed'}
			<circle class="arc dash" cx="50" cy="50" r="46" />
		{/if}
	</svg>
	<span class="in">
		{#if mode === 'feature' && fs}
			<span class="cnt">{fs.current}</span><span class="sub">OF {fs.total}</span>
		{:else if mode === 'replay'}
			<span class="word">REPLAY</span>
		{:else if mode === 'spinning'}
			<span class="sq"></span>
		{:else if mode === 'auto' || mode === 'loaded'}
			{#if mode === 'auto'}<span class="sqs"></span>{:else}<svg class="pl sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 5.9v12.2c0 .9 1 1.5 1.8 1l9.4-6.1c.7-.4.7-1.5 0-1.9l-9.4-6.1c-.8-.6-1.8 0-1.8.9z" fill="currentColor" /></svg>{/if}
			<span class="cnt" class:long={countText.length > 3}>
				{#if count === Infinity}<svg class="inf" viewBox="0 0 34 16" aria-hidden="true"><path d="M17 8C14.2 4.4 11.9 2.6 9 2.6a5.4 5.4 0 0 0 0 10.8c2.9 0 5.2-1.8 8-5.4s5.1-5.4 8-5.4a5.4 5.4 0 0 1 0 10.8c-2.9 0-5.2-1.8-8-5.4z" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round" /></svg>{:else}{countText}{/if}
			</span>
			<span class="sub">AUTO</span>
		{:else if mode === 'armed'}
			<svg class="pl sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 5.9v12.2c0 .9 1 1.5 1.8 1l9.4-6.1c.7-.4.7-1.5 0-1.9l-9.4-6.1c-.8-.6-1.8 0-1.8.9z" fill="currentColor" /></svg>
			<span class="word">{controls.armedLabel()}</span>
			{#if priceFont !== null}<span class="price" style:font-size="{priceFont}px">{priceText}</span>{/if}
		{:else}
			<svg class="pl" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 5.9v12.2c0 .9 1 1.5 1.8 1l9.4-6.1c.7-.4.7-1.5 0-1.9l-9.4-6.1c-.8-.6-1.8 0-1.8.9z" fill="currentColor" /></svg>
		{/if}
	</span>
</button>
