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
	import { ang, FILL_C, laneRingSvg, REST_METHODS, RingDriver, sparksSvg, stopSquareSvg, type RestMethod, type RingTheme } from './spinRing';

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

	// the round as the ring sees it: the stop pressed, the win flourish still due (whether the board's spin was seen live,
	// and THE ROUND'S OWN START, game/boardPace.ts serial, are the driver's: ui/hud/ringPlan.ts RingCore.frame)
	let halted = false;
	driver.core.lastSerial = boardPace.serial();
	let winDue = false;
	const startRing = () => {
		halted = false;
		winDue = true;
		if (reduced) return;
		driver.start(turbo());
		flash('goIn', 520);
		kick();
	};
	/** a face that rests (no round of its own is playing on it) */
	const restingMode = (m: string) => m === 'idle' || m === 'loaded' || m === 'armed' || m === 'replay';
	/** each frame while a round can play: wind up on a new spin, brake as the board comes to rest (onto the home pose:
	 *  the driver plans the ring's whole way to rest from what the board says, ui/hud/ringPlan.ts) */
	const tick = () => {
		driver.frame({ live: boardPace.live(), restIn: boardPace.restIn(), serial: boardPace.serial(), halted, reduced, turbo: turbo(), resting: restingMode(mode) }, startRing);
	};
	let raf = 0;
	const needLoop = () => !restingMode(mode) || driver.phase !== 'rest' || driver.turning();
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
			// THE RING THAT NEVER STOPPED (2026-11-21, the probe host, on both live games): an autoplay run's last round, or
			// a free spins round, hands the key back by changing its face in the same update that turns it to Stop. That is
			// not a press (a press turns Play into Stop on the same face), and this effect runs before the face's own (below),
			// so a start here landed on the new face and the face change then set the driver at rest over a turning loop. A
			// start here only for a press on the face it began on; the round's own start (the board's count) turned the ring
			const faceChanging = lastFace !== '' && faceKind !== lastFace;
			if (now === 'run' && was === 'idle' && driver.phase !== 'spin' && !faceChanging) startRing();
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
			// a spin still live winds up again on the new face's ring
			if (boardPace.live()) driver.core.forgetSerial();
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
	// THE HOVER (Corey 2026-11-20: "hover over and progress it"): a desktop pointer over the key turns the ring a quarter
	// forward; when it leaves (or the key is disabled under it) with no press, the ring turns back the way it came to
	// home and settles (Corey 2026-11-21: "I would prefer it goes backwards in that one scenario"); a press during it
	// simply starts the spin forward from where the ring is. Never on touch, never under reduced motion (ui/hud/ringPlan.ts
	// RingCore.hover; it took the place of the CSS quarter turn on .rh, which came back the other way)
	const finePointer = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;
	const hoverOn = (e: PointerEvent) => {
		if (e.pointerType !== 'mouse' || reduced || disabled || !finePointer()) return;
		driver.hover(true);
	};
	const hoverOff = (e: PointerEvent) => {
		if (e.pointerType !== 'mouse') return;
		driver.hover(false);
	};
	$effect(() => {
		if (disabled) untrack(() => driver.hover(false));
	});
	// reduced motion switched on: nothing turns, the ring simply at home (the driver's animations cancelled)
	$effect(() => {
		if (reduced) untrack(() => driver.stop());
	});
	// DEV: THE REST METHOD by hand and the ring's rounds as planned (the main repo's tools/manticore/hud_probe.js section
	// `home`; the method stays through a rebuilt HUD). Not in a production build.
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		const hook = ((window as unknown as { __manticore?: Record<string, unknown> }).__manticore ??= {});
		driver.core.record = true;
		driver.core.method = (hook.ringMethodSet as RestMethod | undefined) ?? 'steer';
		Object.assign(hook, {
			/** the ring's rest method: 'steer' (the cruise steer, the game's), 'long' (the long brake) or 'fixed' (today's
			 *  brake bent onto home); no argument: the one in use */
			ringMethod: (m?: RestMethod) => {
				if (m && REST_METHODS.includes(m)) hook.ringMethodSet = driver.core.method = m;
				return driver.core.method;
			},
			/** the ring's last rounds as planned: kind, shape, brake ms and today's, the cruise's largest speed change, the
			 *  planned rest angle and its distance from home (ui/hud/ringPlan.ts RingRound) */
			ringRounds: () => driver.core.rounds.map((r) => ({ ...r })),
			/** the ring now: its phase, its angle on the page (the two driven wrappers, 0..360), the backstop's count */
			ringNow: () => {
				const rw = btn?.querySelector<HTMLElement>('.rw');
				const rr = btn?.querySelector<HTMLElement>('.rr');
				return { phase: driver.phase, angle: rw && rr ? (ang(rw) + ang(rr)) % 360 : null, t: performance.now(), watchdogs: driver.core.watchdogs };
			},
		});
	}
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
	onpointerenter={hoverOn}
	onpointerleave={hoverOff}
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
