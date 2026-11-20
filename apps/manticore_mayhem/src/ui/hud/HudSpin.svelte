<script lang="ts">
	// THE SPIN (Drop 6): the hero circle, one size in every state; every count lives inside it. What it does is
	// controls.svelte.ts's, unchanged (spin / stop / slam stop / start a loaded run / stop a run / the balance notice);
	// this is only its face. THE FACE is concept G2 "Lane Ring" (Corey's pick, spin symbols round 2, 2026-11-20;
	// ui/hud/spinRing.ts draws it and turns it):
	//   idle            the ring at rest: gold studs shrinking away round the ring from one gold chevron head; a slow
	//                   breath and a hop forward every 2.8 s; hover gives it a quarter turn
	//   spinning        the ring winds up at the press, turns while the board plays and brakes as the board comes to rest;
	//                   the stop square pops in at the center while the stop is available; after a slam stop the square
	//                   dims and shrinks (data-st "halt") and the ring brakes into the shortened round
	//   busy            (under disabledSlamstop) the ring turns, no square, the face dimmed
	//   autoplay run    the thinned ring at the key's edge turns with each round round the count: a small square (its
	//                   stop), the spins left (an infinity drawn in SVG for an open run), AUTO
	//   autoplay loaded the thinned ring at rest round a small play triangle, the loaded count, AUTO, a dotted gold ring
	//   free spins      the spin in play OF the total; the ring's own track fills in the accent to the same share and the
	//                   thinned ring turns over the fill in each spin
	//   armed buy       the thinned ring at rest round a small play triangle, the mode's name and the price of the press
	//   replay          the thinned ring, still, round REPLAY (pressable once the replayed round is done)
	//   win             a paying board lands: a spark ring, a small pop of the ring and the halo
	// Transform and opacity only (the ring by the Web Animations API on transform); reduced motion: nothing turns or
	// loops, the stop square cross-fades.
	import { onDestroy, untrack } from 'svelte';
	import type { Controls } from '../controls.svelte';
	import { replayState } from '../replayState.svelte';
	import { fitFont, UI_TEXT_FACE } from '../../game/textFit';
	import { boardPace } from '../../game/boardPace';
	import { FILL_C, laneRingSvg, ringMotion, RingDriver, sparksSvg, stopSquareSvg, type RingTheme } from './spinRing';

	type Props = { controls: Controls; x: number; y: number; d: number };
	const { controls, x, y, d }: Props = $props();

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
	/** the faces that share the full ring (the stop square pops in over it) */
	const flip = $derived(mode === 'idle' || mode === 'spinning' || mode === 'busy');
	/** the face's state: at rest (idle), stop available (run), stop pressed (halt: the stop already taken, the round still
	 *  playing) */
	const st = $derived(mode === 'spinning' ? (disabled ? 'halt' : 'run') : 'idle');
	const count = $derived(mode === 'auto' ? controls.autoCount() : mode === 'loaded' && loaded ? loaded.count : 0);
	const priceText = $derived(mode === 'armed' ? (controls.playCostText() ?? '') : '');
	const priceFont = $derived(priceText ? fitFont({ text: priceText, nominal: d * 0.13, box: d * 0.7, minScale: 0.55, weight: 900, face: UI_TEXT_FACE }) : null);
	const label = $derived(replay ? 'Replay' : showStop ? 'Stop' : autoActive ? 'Stop autoplay' : 'Spin');

	// ---- THE FACE (ui/hud/spinRing.ts): the full ring with its stop square, or the thinned ring round a count ----
	const TH: RingTheme = 'm';
	/** which face is drawn: the full ring (idle, spinning, busy) or a counted face; a change rebuilds it (with a pop) */
	const faceKind = $derived(flip ? 'flip' : mode);
	const ringHtml = $derived(laneRingSvg(TH, !flip));
	const stopHtml = stopSquareSvg(TH);
	const sparkHtml = sparksSvg(TH);
	/** the free-spins fill: the lit share of the ring's track (a change moves by the slider below) */
	const fillOn = $derived(mode === 'feature' && !!fs);

	let btn: HTMLButtonElement | undefined = $state();
	/** the ring is turning or braking (hud.css shows the trails at Turbo and Super Turbo only then) */
	let ringRun = $state(false);
	let reduced = $state(false);
	$effect(() => {
		if (typeof matchMedia === 'undefined') return;
		const q = matchMedia('(prefers-reduced-motion: reduce)');
		reduced = q.matches;
		const on = () => (reduced = q.matches);
		q.addEventListener('change', on);
		return () => q.removeEventListener('change', on);
	});
	const driver = new RingDriver(
		() => {
			const rw = btn?.querySelector<HTMLElement>('.rw');
			const rr = btn?.querySelector<HTMLElement>('.rr');
			return rw && rr ? { rw, rr } : null;
		},
		(p) => (ringRun = p !== 'rest'),
	);
	const turbo = () => controls.turboLevel() as 0 | 1 | 2;

	// a class on for a moment (restarted if already on): the press's face pop, a face change's pop, the win flourish
	let fx = $state({ goIn: false, pop: false, win: false });
	const fxTimers: Record<string, ReturnType<typeof setTimeout>> = {};
	const flash = (k: 'goIn' | 'pop' | 'win', ms: number) => {
		clearTimeout(fxTimers[k]);
		fx = { ...fx, [k]: false };
		requestAnimationFrame(() => {
			fx = { ...fx, [k]: true };
			fxTimers[k] = setTimeout(() => (fx = { ...fx, [k]: false }), ms);
		});
	};

	// the round as the ring sees it: whether the board's spin was seen live, the stop pressed, the win flourish still due
	let sawLive = false;
	let wasLive = false;
	let halted = false;
	let winDue = false;
	const startRing = () => {
		halted = false;
		sawLive = false;
		winDue = true;
		if (reduced) return;
		driver.start(turbo());
		flash('goIn', 520);
		kick();
	};
	/** a face that rests (no round of its own is playing on it) */
	const restingMode = (m: string) => m === 'idle' || m === 'loaded' || m === 'armed' || m === 'replay';
	/** each frame while a round can play: wind up on a new spin, brake as the board comes to rest */
	const tick = () => {
		if (reduced) {
			if (driver.phase !== 'rest') driver.stop();
			wasLive = boardPace.live();
			return;
		}
		const live = boardPace.live();
		const restIn = boardPace.restIn();
		const t = turbo();
		const M = ringMotion(t);
		if (driver.phase === 'brake' && driver.settled()) driver.rest();
		if (live && !wasLive && driver.phase !== 'spin') startRing();
		if (driver.phase === 'spin') {
			if (live) sawLive = true;
			const lead = M.brake + M.settle;
			if (restIn !== null && halted) driver.brake(Math.max(70, restIn * 0.62), Math.max(50, restIn * 0.38), t);
			else if (restIn !== null && restIn <= lead) {
				const k = Math.max(0.2, restIn / lead);
				driver.brake(M.brake * k, M.settle * k, t);
			} else if (!live && (sawLive || restingMode(mode))) driver.brake(M.brake, M.settle, t);
		}
		wasLive = live;
	};
	let raf = 0;
	const needLoop = () => !restingMode(mode) || driver.phase !== 'rest';
	const loop = () => {
		raf = 0;
		tick();
		if (needLoop()) raf = requestAnimationFrame(loop);
	};
	const kick = () => {
		if (!raf && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(loop);
	};
	$effect(() => {
		const m = mode;
		untrack(() => {
			if (!restingMode(m)) kick();
		});
	});
	// the press: Play turns into Stop (the ring winds up at once, before the board pulls away); a stop press
	let lastRingSt = 'idle';
	$effect(() => {
		const now = st;
		const was = lastRingSt;
		lastRingSt = now;
		untrack(() => {
			if (now === 'run' && was === 'idle' && driver.phase !== 'spin') startRing();
			if (now === 'halt') halted = true;
		});
	});
	// a face change rebuilds the ring's elements: a spin still live winds up again on the new face; the face pops
	let lastFace = '';
	$effect(() => {
		const k = faceKind;
		untrack(() => {
			const was = lastFace;
			lastFace = k;
			if (!was || was === k) return;
			if (driver.phase !== 'rest') driver.rest();
			wasLive = false;
			flash('pop', 420);
			kick();
		});
	});
	// THE WIN FLOURISH: once a spin, as its win first shows (the book's win lands with the board at rest)
	let lastWin = 0;
	$effect(() => {
		const w = controls.winAmount();
		untrack(() => {
			if (w > lastWin && winDue && !reduced) {
				winDue = false;
				flash('win', 760);
			}
			lastWin = w;
		});
	});
	onDestroy(() => {
		if (raf) cancelAnimationFrame(raf);
		for (const k of Object.keys(fxTimers)) clearTimeout(fxTimers[k]);
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
	bind:this={btn}
	type="button"
	class="slot-btn spin hg hit m-{mode}"
	class:tap
	class:go-in={fx.goIn}
	class:pop={fx.pop}
	class:win={fx.win}
	data-st={flip ? st : mode}
	data-face="lane-ring"
	data-run={ringRun ? '1' : '0'}
	data-tb={turbo()}
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
		{#if mode === 'loaded' || mode === 'armed'}
			<circle class="arc dash" cx="50" cy="50" r="46" />
		{/if}
	</svg>
	<span class="fxs" aria-hidden="true">
		{#key faceKind}
			<span class="fx" class:cnt-face={!flip}>
				{#if fillOn}
					<svg class="fill" viewBox="-50 -50 100 100" aria-hidden="true"><circle class="trk9" r="41.5" /><circle class="lit" r="41.5" stroke-dasharray="{arc.base * FILL_C} {FILL_C}" transform="rotate(-90)" /></svg>
					{#if arc.len > 0}
						<svg class="fill slide" class:go={arc.go} viewBox="-50 -50 100 100" aria-hidden="true" style:transform="rotate({arc.rot}deg)"><circle class="lit" r="41.5" stroke-dasharray="{arc.len * FILL_C} {FILL_C}" transform="rotate(-90)" /></svg>
					{/if}
				{/if}
				<span class="rb"><span class="rh"><span class="rw"><span class="rr">{@html ringHtml}</span></span></span></span>
				{#if flip}{@html stopHtml}{/if}
				{@html sparkHtml}
			</span>
		{/key}
	</span>
	<span class="in">
		{#if mode === 'feature' && fs}
			{@render counter()}<span class="sub">OF {fs.total}</span>
		{:else if mode === 'replay'}
			<span class="word">REPLAY</span>
		{:else if mode === 'auto' || mode === 'loaded'}
			{#if mode === 'auto'}<span class="sqs"></span>{:else}<svg class="pl sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.2v11.6L19 12z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>{/if}
			{#if count === Infinity}<span class="cnt"><svg class="inf" viewBox="0 0 34 16" aria-hidden="true"><path d="M17 8C14.2 4.4 11.9 2.6 9 2.6a5.4 5.4 0 0 0 0 10.8c2.9 0 5.2-1.8 8-5.4s5.1-5.4 8-5.4a5.4 5.4 0 0 1 0 10.8c-2.9 0-5.2-1.8-8-5.4z" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round" /></svg></span>{:else}{@render counter()}{/if}
			<span class="sub">AUTO</span>
		{:else if mode === 'armed'}
			<svg class="pl sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.2v11.6L19 12z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>
			<span class="word">{controls.armedLabel()}</span>
			{#if priceFont !== null}<span class="price" style:font-size="{priceFont}px">{priceText}</span>{/if}
		{/if}
	</span>
</button>

{#snippet counter()}
	<span class="cw">
		{#key cnt.k}
			{#if cnt.old}<span class="cnt old" class:long={cnt.old.length > 3} aria-hidden="true">{cnt.old}</span>{/if}
			<span class="cnt" class:slide={!!cnt.old} class:long={cnt.cur.length > 3}>{cnt.cur}</span>
		{/key}
	</span>
{/snippet}
