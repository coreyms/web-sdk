<script lang="ts">
	// THE SPIN (Drop 6): the hero circle, one size in every state; every count lives inside it. What it does is
	// controls.svelte.ts's, unchanged (spin / stop / slam stop / start a loaded run / stop a run / the balance notice);
	// this is only its face:
	//   idle            the play triangle
	//   spinning        a white square (STOP) and the comet running the ring; after a slam stop the square dims and
	//                   shrinks until the round ends (data-st "halt"); under disabledSlamstop the play face stays, dimmed
	//   autoplay run    a small square (its stop), the spins left (an infinity drawn in SVG for an open run), AUTO
	//   autoplay loaded a small play triangle, the loaded count, AUTO, a dotted gold ring (pressing starts the run)
	//   free spins      the spin in play OF the total, the gold arc filled to the same share
	//   armed buy       a small play triangle, the mode's name and the price of the press (fitted, never abbreviated)
	//   replay          REPLAY (pressable once the replayed round is done); a replayed feature shows its count
	// THE MOTION (HUD round 6, motion C "Flip", approved 2026-11-13; hud.css): Play folds shut to a line and Stop opens
	// out of it, and back when the round ends; the comet (three arcs, a fading tail) runs the ring while a round plays;
	// a count that changes slides (old up and out, new up from below); the free-spins arc moves smoothly. Transform and
	// opacity only: no stroke animation, nothing flashes or pops when the round ends.
	import { untrack } from 'svelte';
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
	const disabled = $derived(replay ? !replayAgain : controls.spinDisabled());

	const mode = $derived(
		fs && showFreeSpins ? 'feature' : replay ? 'replay' : showStop ? 'spinning' : autoActive ? 'auto' : !idle ? 'busy' : loaded ? 'loaded' : armed ? 'armed' : 'idle',
	);
	/** the faces that share one glyph (so Play and Stop can turn into each other) */
	const flip = $derived(mode === 'idle' || mode === 'spinning' || mode === 'busy');
	/** the glyph's state: play (idle), stop (run), stop pressed (halt: the stop already taken, the round still playing) */
	const st = $derived(mode === 'spinning' ? (disabled ? 'halt' : 'run') : 'idle');
	const count = $derived(mode === 'auto' ? controls.autoCount() : mode === 'loaded' && loaded ? loaded.count : 0);
	const priceText = $derived(mode === 'armed' ? (controls.playCostText() ?? '') : '');
	const priceFont = $derived(priceText ? fitFont({ text: priceText, nominal: d * 0.13, box: d * 0.7, minScale: 0.55, weight: 900, face: UI_TEXT_FACE }) : null);
	const rot = $derived(mode === 'spinning' || mode === 'auto' || mode === 'busy');
	// ONE reading for assistive technology (2026-11-18): in free spins the counter's own words ("9 of 10"), in autoplay
	// the spins left; the flip's outgoing face is aria-hidden and drawn from an attribute (never text), so neither a
	// screen reader nor text extraction reads two numbers
	const action = $derived(replay ? 'Replay' : showStop ? 'Stop' : autoActive ? 'Stop autoplay' : 'Spin');
	const label = $derived(
		mode === 'feature' && fs ? `${action}. Free spins: ${fs.current} of ${fs.total}` : mode === 'auto' && count !== Infinity && count > 0 ? `${action}: ${count} left` : action,
	);

	// ---- the comet keeps turning a moment past the round, while it fades out ----
	let turn = $state(false);
	$effect(() => {
		const on = rot;
		if (on) {
			turn = true;
			return;
		}
		const t = setTimeout(() => (turn = false), 260);
		return () => clearTimeout(t);
	});

	// ---- the press ring: once, when a press turns Play into Stop ----
	let tap = $state(false);
	let lastSt = 'idle';
	$effect(() => {
		const now = st;
		const was = lastSt;
		lastSt = now;
		if (!(now === 'run' && was === 'idle')) return;
		untrack(() => (tap = false));
		const r = requestAnimationFrame(() => (tap = true));
		const t = setTimeout(() => (tap = false), 380);
		return () => {
			cancelAnimationFrame(r);
			clearTimeout(t);
		};
	});

	// ---- the count (autoplay, free spins): a change slides ----
	const cntText = $derived(mode === 'feature' && fs ? String(fs.current) : (mode === 'auto' || mode === 'loaded') && count !== Infinity ? String(count) : '');
	let cnt = $state({ cur: '', old: '', k: 0 });
	$effect(() => {
		const t = cntText;
		untrack(() => {
			if (t === cnt.cur) return;
			// a count that appears (a mode change) just shows; one that changes slides
			cnt = t && cnt.cur ? { cur: t, old: cnt.cur, k: cnt.k + 1 } : { cur: t, old: '', k: cnt.k };
		});
	});

	// ---- the free-spins arc: a change turns a short slider arc out from under the arc's end (or back under it) ----
	const frac = $derived(mode === 'feature' && fs ? Math.min(fs.current, fs.total) / Math.max(1, fs.total) : -1);
	let arc = $state({ base: 0, len: 0, rot: 0, go: false });
	let shownFrac = -1;
	let run = 0;
	$effect(() => {
		const f = frac;
		untrack(() => {
			const was = shownFrac;
			shownFrac = f;
			run += 1;
			if (f < 0 || was < 0 || f === was) {
				arc = { base: Math.max(0, f), len: 0, rot: 0, go: false };
				return;
			}
			const lo = Math.min(was, f);
			const dd = Math.abs(f - was);
			// the slider must start (or end) hidden under the arc: it cannot when the arc is shorter than the step
			if (lo < dd - 1e-6) {
				arc = { base: f, len: 0, rot: 0, go: false };
				return;
			}
			const grow = f > was;
			const from = grow ? lo - dd : lo;
			const to = grow ? lo : lo - dd;
			arc = { base: lo, len: dd, rot: from * 360, go: false };
			const me = run;
			requestAnimationFrame(() =>
				requestAnimationFrame(() => {
					if (me === run) arc = { ...arc, rot: to * 360, go: true };
				}),
			);
		});
	});
</script>

<button
	type="button"
	class="slot-btn spin hg hit m-{mode}"
	class:tap
	data-st={flip ? st : mode}
	style:left="{x}px"
	style:top="{y}px"
	style:width="{d}px"
	style:height="{d}px"
	style:--d="{d}px"
	{disabled}
	onclick={replay ? () => replayState.start?.() : controls.spin}
	aria-label={label}
>
	<i class="halo"></i>
	<svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
		<circle class="trk" cx="50" cy="50" r="46" />
		{#if mode === 'feature' && fs}
			<circle class="arc" cx="50" cy="50" r="46" stroke-dasharray="{arc.base * CIRC} {CIRC}" />
		{:else if mode === 'loaded' || mode === 'armed'}
			<circle class="arc dash" cx="50" cy="50" r="46" />
		{/if}
	</svg>
	{#if mode === 'feature' && arc.len > 0}
		<svg class="ring slide" class:go={arc.go} viewBox="0 0 100 100" aria-hidden="true" style:transform="rotate({arc.rot - 90}deg)">
			<circle class="arc" cx="50" cy="50" r="46" stroke-dasharray="{arc.len * CIRC} {CIRC}" />
		</svg>
	{/if}
	<svg class="comet" class:on={rot} class:turn viewBox="0 0 100 100" aria-hidden="true">
		<circle class="arc a3" cx="50" cy="50" r="46" transform="rotate(-66 50 50)" />
		<circle class="arc a2" cx="50" cy="50" r="46" transform="rotate(-34 50 50)" />
		<circle class="arc a1" cx="50" cy="50" r="46" />
	</svg>
	<span class="in">
		{#if mode === 'feature' && fs}
			{@render counter()}<span class="sub">OF {fs.total}</span>
		{:else if mode === 'replay'}
			<span class="word">REPLAY</span>
		{:else if mode === 'auto' || mode === 'loaded'}
			{#if mode === 'auto'}<span class="sqs"></span>{:else}<svg class="pl sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 5.9v12.2c0 .9 1 1.5 1.8 1l9.4-6.1c.7-.4.7-1.5 0-1.9l-9.4-6.1c-.8-.6-1.8 0-1.8.9z" fill="currentColor" /></svg>{/if}
			{#if count === Infinity}<span class="cnt"><svg class="inf" viewBox="0 0 34 16" aria-hidden="true"><path d="M17 8C14.2 4.4 11.9 2.6 9 2.6a5.4 5.4 0 0 0 0 10.8c2.9 0 5.2-1.8 8-5.4s5.1-5.4 8-5.4a5.4 5.4 0 0 1 0 10.8c-2.9 0-5.2-1.8-8-5.4z" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round" /></svg></span>{:else}{@render counter()}{/if}
			<span class="sub">AUTO</span>
		{:else if mode === 'armed'}
			<svg class="pl sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 5.9v12.2c0 .9 1 1.5 1.8 1l9.4-6.1c.7-.4.7-1.5 0-1.9l-9.4-6.1c-.8-.6-1.8 0-1.8.9z" fill="currentColor" /></svg>
			<span class="word">{controls.armedLabel()}</span>
			{#if priceFont !== null}<span class="price" style:font-size="{priceFont}px">{priceText}</span>{/if}
		{:else if flip}
			<span class="gy">
				<span class="f1"><svg class="pl" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 5.9v12.2c0 .9 1 1.5 1.8 1l9.4-6.1c.7-.4.7-1.5 0-1.9l-9.4-6.1c-.8-.6-1.8 0-1.8.9z" fill="currentColor" /></svg></span>
				<span class="f2"><i class="sq"></i></span>
			</span>
		{/if}
	</span>
</button>

{#snippet counter()}
	<span class="cw">
		{#key cnt.k}
			<!-- the outgoing face: its digits drawn from data-d by CSS (hud.css .cnt.old::before), not text -->
			{#if cnt.old}<span class="cnt old" class:long={cnt.old.length > 3} aria-hidden="true" data-d={cnt.old}></span>{/if}
			<span class="cnt" class:slide={!!cnt.old} class:long={cnt.cur.length > 3}>{cnt.cur}</span>
		{/key}
	</span>
{/snippet}
