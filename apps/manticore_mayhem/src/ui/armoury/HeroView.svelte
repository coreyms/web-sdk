<script lang="ts" module>
	/** the hero's numbers (constants.ts ARMOURY.hero, passed in: this component is reusable, no game imports) */
	export type HeroRules = {
		follow: number;
		lagMs: number;
		degPer500: number;
		maxDeg: number;
		yawSpanLeft: number;
		yawSpanRight: number;
		pitchSpanTop: number;
		pitchSpanBottom: number;
		pointerCentre: { x: number; y: number };
		frameFade: { ms: number; fromDeg: number; rampDeg: number; hold: number };
		parallax: { x: number; y: number; rays: number; shadow: number };
		breathe: { on: boolean; scale: number; y: number; periodMs: number };
		idleTurn: { deg: number; periodMs: number; easeMs: number };
		swapInMs: number;
	};
</script>

<script lang="ts">
	// THE ARMOURY'S HERO (spec feedback/armoury_build_r1 3.3 and 5.4). Reusable: no game names, colours or copy.
	//
	// What shows: the hero's FLAT ART (its grid's straight-on frame) until its angle grid is decoded, then the GRID: two
	// stacked boxes with the atlas as their background, a frame being a background-position. The grid arrives by fading
	// in ON TOP of the flat art (swapInMs), which stays fully opaque under it, and never during an entrance or a swap
	// (`calm`). With no grid (none listed, a 404, a failed decode) the flat art stays, with the 2D tilt.
	//
	// NO CROSS-BLEND BETWEEN FRAMES (owner, prototype v9): one opaque frame; a change is a hard swap, and only on a step of
	// frameFade.fromDeg degrees or more does the new frame fade in on top of the old one (heroGrid.ts FrameSwapper).
	//
	// MOTION. Pointer devices ((hover: hover) and (pointer: fine), read once): the hero follows the pointer with a soft lag
	// (lagMs): with a grid, the frame nearest the eased pointer; without, a 2D tilt (degPer500, maxDeg). A small slide stays
	// on the element (parallax.x / .y px per degree), the rays move the other way (parallax.rays), the shadow with it
	// (parallax.shadow). Touch: no follow; a slow idle turn (idleTurn). Breathing, both: a CSS keyframe on a wrapper
	// (compositor only, no script). Reduced motion: no follow, no idle turn, no breathing, every change of frame instant.
	//
	// THE LOOP (one requestAnimationFrame) runs only while the hero is `active` (the menu open, not in confirm, not
	// closing), the tab is visible and something still moves: the eased pointer has not settled, a frame is fading in, or
	// the idle turn is on. It writes a transform to three elements (the art, the rays, the shadow) and an opacity to at
	// most one (the frame fading in). Otherwise it stops.
	import { onMount, untrack } from 'svelte';
	import { FrameSwapper, easeToward, flatTilt, framePosition, gridReach, idleTurnYaw, pointerAngles, type GridView } from './heroGrid';

	type Props = {
		/** the hero's key: a change starts the frame choice again (the pointer's eased place is kept) */
		art: string;
		flatUrl: string;
		/** the flat art's width / height once decoded */
		flatAr: number | undefined;
		flatReady: boolean;
		/** share of the hero box the picture fills */
		heroH: number;
		/** this hero's decoded atlas, if it is held now */
		grid: { view: GridView; url: string } | null;
		/** the menu is open, not in confirm, not closing: the loop may run, the breathing plays */
		active: boolean;
		/** no entrance or swap is moving the hero now (the grid never arrives in the middle of one) */
		calm: () => boolean;
		/** the menu box on screen: its left, top (CSS px) and scale (CSS px per design px) */
		frame: { left: number; top: number; u: number };
		reduced: boolean;
		rules: HeroRules;
		/** the id of the rays <symbol> */
		raysId: string;
		/** the pointer centre in the menu's design px, where the hero sits in this layout (default rules.pointerCentre, the
		 *  desktop hero's) */
		centre?: { x: number; y: number } | null;
		/** the menu box, design px: no span reaches past its edges (a span is the smaller of its constant and the distance
		 *  from the pointer centre to that edge), so a real pointer at any edge of the box shows the full turn */
		bounds?: { w: number; h: number } | null;
	};
	const { art, flatUrl, flatAr, flatReady, heroH, grid, active, calm, frame, reduced, rules, raysId, centre = null, bounds = null }: Props = $props();
	/** the spans this layout uses (spec 5.4; owner 2026-10-14 16:51, the full turn both ways) */
	const spans = $derived.by(() => {
		const c = centre ?? rules.pointerCentre;
		if (!bounds) return rules;
		const m = (a: number, b: number) => Math.max(1, Math.min(a, b));
		return { yawSpanLeft: m(rules.yawSpanLeft, c.x), yawSpanRight: m(rules.yawSpanRight, bounds.w - c.x), pitchSpanTop: m(rules.pitchSpanTop, c.y), pitchSpanBottom: m(rules.pitchSpanBottom, bounds.h - c.y) };
	});

	const fine = (() => {
		try {
			return matchMedia('(hover: hover) and (pointer: fine)').matches;
		} catch {
			return true;
		}
	})();

	let raysEl = $state<SVGSVGElement>();
	let shadowEl = $state<HTMLDivElement>();
	let flatEl = $state<HTMLDivElement>();
	let gridEl = $state<HTMLDivElement>();
	let baseEl = $state<HTMLDivElement>();
	let incEl = $state<HTMLDivElement>();

	// ---- which picture: flat art, then the grid fading in over it -------------------------------------------------
	/** the grid on show for THIS art (a held atlas of another hero never shows here) */
	let gridOn = $state.raw<{ view: GridView; url: string } | null>(null);
	/** the grid layer is in (opacity 1) */
	let gridIn = $state(false);
	/** no transition on the grid layer (it arrives while the hero is hidden: an open or a swap) */
	let gridInstant = $state(false);
	/** the flat art is covered by the grid and stops painting */
	let flatGone = $state(false);
	let swapper: FrameSwapper | null = null;
	let calmTimer: ReturnType<typeof setTimeout> | undefined;
	let goneTimer: ReturnType<typeof setTimeout> | undefined;
	let shownArt = '';
	let mounted = false;

	const resetPicture = () => {
		clearTimeout(calmTimer);
		clearTimeout(goneTimer);
		gridOn = null;
		gridIn = false;
		gridInstant = false;
		flatGone = false;
		swapper = null;
		written = { base: -1, inc: -2, o: -1, art: '', grid: '' };
	};
	/** the grid takes over: at once while the hero is hidden (`instant`), else when calm, fading in over the flat art */
	const bringGrid = (g: { view: GridView; url: string }, instant: boolean) => {
		gridOn = g;
		swapper = new FrameSwapper(g.view, rules.frameFade);
		step(0, performance.now(), true);
		if (instant || reduced) {
			gridInstant = true;
			gridIn = true;
			flatGone = true;
			requestAnimationFrame(() => requestAnimationFrame(() => (gridInstant = false)));
			kick();
			return;
		}
		const tryIn = () => {
			if (!gridOn || gridOn !== g) return;
			if (!calm()) {
				calmTimer = setTimeout(tryIn, 100);
				return;
			}
			gridIn = true;
			goneTimer = setTimeout(() => {
				if (gridOn === g) flatGone = true;
			}, rules.swapInMs + 40);
			kick();
		};
		tryIn();
	};
	$effect(() => {
		const a = art;
		const g = grid;
		untrack(() => {
			if (a !== shownArt) {
				// a new hero: it is hidden right now (the open's first frames, or a swap's fade out), so a grid already held
				// is simply there
				shownArt = a;
				resetPicture();
				if (g) bringGrid(g, true);
				kick();
				return;
			}
			if (g && (!gridOn || gridOn.url !== g.url)) bringGrid(g, !mounted);
			else if (!g && gridOn) {
				resetPicture();
				kick();
			}
		});
	});

	// ---- the pointer -----------------------------------------------------------------------------------------------
	const ptr = { on: false, x: 0, y: 0 };
	let override: { x: number; y: number } | null = null;
	const cur = { x: 0, y: 0 };
	const turn = { yaw: 0 };
	let frozen = false;
	/** a swipe's turn (portrait phone, tablet: degrees, spec 5.2), added to the idle turn while a finger drags */
	let dragYaw = 0;
	/** the breathing held still (DEV freezeIdle) */
	let frozenBreath = $state(false);
	let t0 = 0;
	let raf = 0;
	let lastT = 0;
	let manual = false;
	let manualNow = 0;
	let loopOn = false;
	let ticks = 0;
	let last = { tx: 0, ty: 0, ax: 0, ay: 0, yaw: 0, pitch: 0, settled: true, busy: false };

	const idleOn = () => !fine && !reduced && !frozen;
	const breathing = $derived(active && !reduced && rules.breathe.on);

	/** what the loop last wrote, so nothing is written twice */
	let written = { base: -1, inc: -2, o: -1, art: '', grid: '' };
	const writeFrames = () => {
		if (!swapper || !gridOn || !baseEl || !incEl) return;
		const v = swapper.view();
		const g = gridOn.view;
		if (v.base !== written.base && v.base >= 0) {
			baseEl.style.backgroundPosition = framePosition(g.cols, g.rows, v.base).position;
			written.base = v.base;
		}
		if (v.incoming !== written.inc) {
			if (v.incoming >= 0) incEl.style.backgroundPosition = framePosition(g.cols, g.rows, v.incoming).position;
			written.inc = v.incoming;
		}
		const o = v.incoming >= 0 ? Math.round(v.incomingOpacity * 1000) / 1000 : 0;
		if (o !== written.o) {
			incEl.style.opacity = String(o);
			written.o = o;
		}
	};

	/** one step of the hero: ease the pointer, choose the frame, write the transforms. Returns whether to go on */
	const step = (dt: number, now: number, force = false): boolean => {
		const k = reduced ? 0 : rules.follow;
		const goal = override ?? (fine && ptr.on && !reduced ? ptr : { x: 0, y: 0 });
		cur.x = easeToward(cur.x, goal.x, dt, rules.lagMs);
		cur.y = easeToward(cur.y, goal.y, dt, rules.lagMs);
		const settled = Math.abs(goal.x - cur.x) < 0.3 && Math.abs(goal.y - cur.y) < 0.3;
		if (settled) {
			cur.x = goal.x;
			cur.y = goal.y;
		}
		let busy = !settled;
		let ax: number;
		let ay: number;
		if (!fine && !override) {
			const want = (idleOn() ? idleTurnYaw(now - t0, rules.idleTurn) : 0) + (reduced ? 0 : dragYaw);
			turn.yaw = easeToward(turn.yaw, want, dt, rules.idleTurn.easeMs);
			busy = busy || idleOn() || Math.abs(want - turn.yaw) > 0.02;
			ax = turn.yaw;
			ay = 0;
		} else {
			const t = flatTilt(cur, rules, k);
			ax = t.yaw;
			ay = t.pitch;
		}
		const tx = ax * rules.parallax.x;
		const ty = ay * rules.parallax.y;
		let yaw = 0;
		let pitch = 0;
		if (swapper && gridOn) {
			const g = gridOn.view;
			if (!fine && !override) {
				const r = gridReach(g);
				yaw = Math.max(-r.yaw, Math.min(r.yaw, ax));
			} else {
				const a = pointerAngles(cur, g, spans, k);
				yaw = a.yaw;
				pitch = a.pitch;
			}
			busy = swapper.update(yaw, pitch, dt, { ready: true, reduced }) || busy;
			writeFrames();
			if (gridEl) gridEl.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
		}
		// the flat art carries the 2D tilt while it shows (held where it is under a grid that is fading in over it)
		if (flatEl && (!gridIn || force) && !flatGone) {
			flatEl.style.transform = `perspective(900px) translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) rotateY(${ax.toFixed(3)}deg) rotateX(${(-ay).toFixed(3)}deg)`;
		}
		if (raysEl) raysEl.style.transform = `translate(${(tx * rules.parallax.rays).toFixed(2)}px, ${(ty * rules.parallax.rays).toFixed(2)}px)`;
		if (shadowEl) shadowEl.style.transform = `translate(${(tx * rules.parallax.shadow).toFixed(2)}px, 0px)`;
		last = { tx, ty, ax, ay, yaw, pitch, settled, busy };
		return busy;
	};

	const frameTick = (t: number) => {
		raf = 0;
		if (!active || document.hidden || manual) {
			loopOn = false;
			lastT = 0;
			return;
		}
		const now = performance.now();
		const dt = lastT ? Math.min(64, now - lastT) : 16;
		lastT = now;
		ticks += 1;
		void t;
		if (step(dt, now)) raf = requestAnimationFrame(frameTick);
		else {
			loopOn = false;
			lastT = 0;
		}
	};
	function kick() {
		if (!mounted || manual || raf || !active || document.hidden) return;
		loopOn = true;
		raf = requestAnimationFrame(frameTick);
	}
	const stopLoop = () => {
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
		lastT = 0;
		loopOn = false;
	};
	$effect(() => {
		if (active) untrack(kick);
		else untrack(stopLoop);
	});
	onMount(() => {
		mounted = true;
		t0 = performance.now();
		const onMove = (e: PointerEvent) => {
			if (!fine || e.pointerType === 'touch') return;
			const c = centre ?? rules.pointerCentre;
			ptr.x = (e.clientX - frame.left) / frame.u - c.x;
			ptr.y = (e.clientY - frame.top) / frame.u - c.y;
			ptr.on = true;
			kick();
		};
		const onLeave = () => {
			ptr.on = false;
			kick();
		};
		const onVis = () => {
			if (document.hidden) stopLoop();
			else kick();
		};
		addEventListener('pointermove', onMove, { passive: true });
		document.documentElement.addEventListener('pointerleave', onLeave);
		addEventListener('blur', onLeave);
		document.addEventListener('visibilitychange', onVis);
		step(0, t0, true);
		kick();
		return () => {
			mounted = false;
			stopLoop();
			clearTimeout(calmTimer);
			clearTimeout(goneTimer);
			removeEventListener('pointermove', onMove);
			document.documentElement.removeEventListener('pointerleave', onLeave);
			removeEventListener('blur', onLeave);
			document.removeEventListener('visibilitychange', onVis);
		};
	});

	// ---- for the DEV hook (Armoury.svelte puts these on window.__manticore.armoury) ---------------------------------
	export const debug = () => {
		const v = swapper?.view();
		return {
			mode: gridOn ? 'grid' : 'flat',
			gridIn,
			flatGone,
			fine,
			loop: loopOn,
			ticks,
			frame: v ? v.base : -1,
			incoming: v ? v.incoming : -1,
			incomingOpacity: v ? v.incomingOpacity : 0,
			fadeMs: swapper?.fadeMs ?? 0,
			cell: swapper?.cell ?? '',
			grid: gridOn ? { cols: gridOn.view.cols, rows: gridOn.view.rows, yaw: gridOn.view.yaw, pitch: gridOn.view.pitch, url: gridOn.url } : null,
			pointer: { on: ptr.on, x: +ptr.x.toFixed(2), y: +ptr.y.toFixed(2), override },
			eased: { x: +cur.x.toFixed(2), y: +cur.y.toFixed(2) },
			...last,
			idle: idleOn(),
			dragYaw,
			spans: { left: spans.yawSpanLeft, right: spans.yawSpanRight, top: spans.pitchSpanTop, bottom: spans.pitchSpanBottom },
			frozen,
			breathing,
		};
	};
	/** hold the pointer at design px from the hero's pointer centre (null: the real pointer again) */
	export const setPointer = (x: number | null, y?: number) => {
		override = x == null ? null : { x, y: y ?? 0 };
		if (manual) return;
		kick();
	};
	/** a swipe's turn in degrees (0 when the finger lets go: the turn eases back) */
	export const setDragYaw = (deg: number) => {
		if (deg === dragYaw) return;
		dragYaw = deg;
		kick();
	};
	/** hold the idle motion still (the touch turn and the breathing) */
	export const freezeIdle = (on: boolean) => {
		frozen = on;
		frozenBreath = on;
		kick();
	};
	/** a probe's own clock: the loop stops scheduling itself and moves only by tickBy (deterministic clips) */
	export const manualClock = (on: boolean) => {
		manual = on;
		if (on) {
			stopLoop();
			manualNow = performance.now();
		} else kick();
	};
	export const tickBy = (dtMs: number) => {
		manualNow += dtMs;
		ticks += 1;
		return step(dtMs, manualNow);
	};
</script>

<svg class="hv-rays" viewBox="0 0 100 100" aria-hidden="true" bind:this={raysEl}><use href="#{raysId}" width="100" height="100" /></svg>
<div class="hv-shadow" bind:this={shadowEl}></div>
<div class="hv-art" style:height="{heroH * 100}%" style:aspect-ratio={flatAr ?? (gridOn ? gridOn.view.cell[0] / gridOn.view.cell[1] : 1)}>
	<div
		class="hero-breathe"
		class:on={breathing}
		class:held={frozenBreath}
		style:--b-s={rules.breathe.scale}
		style:--b-y="{rules.breathe.y}px"
		style:--b-ms="{rules.breathe.periodMs}ms"
	>
		<div class="hv-flat" class:ready={flatReady} class:gone={flatGone} style:background-image={`url("${flatUrl}")`} bind:this={flatEl}></div>
		{#if gridOn}
			{@const fp = framePosition(gridOn.view.cols, gridOn.view.rows, 0)}
			<div class="hv-grid" class:in={gridIn} class:instant={gridInstant} style:--in-ms="{reduced ? 0 : rules.swapInMs}ms" bind:this={gridEl}>
				<div class="gf base" style:background-image={`url("${gridOn.url}")`} style:background-size={fp.size} bind:this={baseEl}></div>
				<div class="gf inc" style:background-image={`url("${gridOn.url}")`} style:background-size={fp.size} bind:this={incEl}></div>
			</div>
		{/if}
	</div>
</div>

<style>
	.hv-rays {
		position: absolute;
		left: 50%;
		top: 50%;
		width: var(--bs, 400px);
		height: var(--bs, 400px);
		margin: calc(var(--bs, 400px) / -2) 0 0 calc(var(--bs, 400px) / -2);
		color: var(--acc);
		opacity: 0.5;
		will-change: transform;
	}
	.hv-shadow {
		position: absolute;
		left: 22%;
		right: 22%;
		bottom: 1%;
		height: 7%;
		border-radius: 50%;
		background: radial-gradient(closest-side, rgba(0, 0, 0, 0.55), transparent);
		will-change: transform;
	}
	.hv-art {
		position: relative;
		display: block;
		flex: none;
	}
	.hero-breathe {
		position: absolute;
		inset: 0;
	}
	/* breathing: scale 1 +- --b-s and --b-y up and down, one sine every --b-ms. The keyframes run peak to trough to
	   peak on a sine shaped ease; the negative delay starts it at the rising zero crossing (rest), like sin(t) */
	.hero-breathe.on {
		animation: hv-breathe var(--b-ms) cubic-bezier(0.37, 0, 0.63, 1) calc(var(--b-ms) * -0.75) infinite;
	}
	.hero-breathe.on.held {
		animation-play-state: paused;
	}
	@keyframes hv-breathe {
		0%,
		100% {
			transform: translateY(calc(var(--b-y) * -1)) scale(calc(1 + var(--b-s)));
		}
		50% {
			transform: translateY(var(--b-y)) scale(calc(1 - var(--b-s)));
		}
	}
	.hv-flat,
	.hv-grid,
	.gf {
		position: absolute;
		inset: 0;
	}
	.hv-flat {
		background: center / contain no-repeat;
		opacity: 0;
		transition: opacity 150ms linear;
		will-change: transform;
	}
	.hv-flat.ready {
		opacity: 1;
	}
	.hv-flat.gone {
		visibility: hidden;
	}
	/* the grid arrives ON TOP of the flat art, which stays fully opaque under it until it is covered */
	.hv-grid {
		opacity: 0;
		will-change: transform;
	}
	.hv-grid.in {
		opacity: 1;
		transition: opacity var(--in-ms) linear;
	}
	.hv-grid.instant {
		transition: none;
	}
	.gf {
		background-repeat: no-repeat;
	}
	/* the frame fading in sits on top of the frame on show, which is always fully opaque */
	.gf.inc {
		z-index: 1;
		opacity: 0;
	}
</style>
