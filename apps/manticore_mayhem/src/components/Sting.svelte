<script lang="ts">
	// THE STING RIG SLOT (RULE_PASS_2 section F).
	//
	// One component, kind-driven: everything the player sees of a sting that is not the board cells
	// themselves is drawn here, from the `stingBeat` event the handler broadcasts. The art is a
	// PLACEHOLDER — a telegraph pulse at the centre while the tail charges and an impact ring on
	// every struck cell — so that dropping a Spine rig in later is a change to THIS FILE ONLY: the
	// handler, the constants and the board engine already speak in kinds and phases.
	//
	// House rules it obeys: always mounted (never an {#if} inside the sorted board container — the
	// conditional-mount z-order trap), no filters, no per-frame geometry (every node is drawn once
	// at a fixed size and only its transform and alpha change per frame), and every duration comes
	// from STING in constants.ts divided by the turbo time scale.
	//
	// PHONE PASS (2026-09-23): the rings are raw Pixi Graphics, each built ONCE (white stroke, the
	// kind's colour applied as a tint) and moved by the beat's own rAF step. The pixi-svelte <Circle>
	// version pushed every frame of `t` through Svelte state into ten props-sync effects.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
	import { stateBetDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, STING, reelOf, rowOf } from '../game/constants';
	import type { StingKind } from '../game/typesBookEvent';

	const context = getContext();

	/** the most cells one sting can cover (a super's 3x3) — the ring pool never grows */
	const MAX_CELLS = 9;
	const RING = SYMBOL_SIZE; // drawn once at this size; the beat only scales it

	type Phase = 'charge' | 'wait' | 'strike';
	let kind: StingKind = 'normal';
	let phase: Phase = 'strike';
	let centre = 0;
	let cells: number[] = [];
	let t = 0; // 0..1 through the current phase
	let live = false;

	// always in the tree, always at the same z in the sorted board container: only alpha moves
	const root = new PIXI.Container({ zIndex: 15 });
	getContextParent().addToParent(root);
	const ring = (width: number) => {
		const g = new PIXI.Graphics().circle(0, 0, RING * 0.5).stroke({ color: 0xffffff, width });
		g.alpha = 0;
		root.addChild(g);
		return g;
	};
	const telegraph = ring(4);
	const rings = Array.from({ length: MAX_CELLS }, () => ring(6));

	const durationOf = (p: Phase, k: StingKind) => {
		if (p === 'wait') return STING.scatterHoldMs;
		if (p === 'charge') return k === 'super' ? STING.superChargeMs : STING.chargeMs;
		if (k === 'scatter') return STING.scatterHitMs;
		return k === 'normal' ? STING.normalMs : STING.bigHitMs;
	};

	const x = (cell: number) => (reelOf(cell) + 0.5) * SYMBOL_SIZE;
	const y = (cell: number) => (rowOf(cell) + 0.5) * SYMBOL_SIZE;

	/** one frame of the beat: the same curves the <Circle> props used to carry */
	const draw = () => {
		const colour = kind === 'scatter' ? STING.scatterColor : STING.wildColor;
		// the impact ring: snaps out of the cell and fades, one per struck cell, all at once for a
		// big / super (the shape turns together)
		const ringScale = 0.45 + 1.15 * t;
		const ringAlpha = live && phase === 'strike' ? 1 - t : 0;
		// the telegraph at the centre: a pulse while the tail charges (big / super) or while the
		// disappointment beat runs (scatter)
		const pulse = Math.abs(Math.sin(Math.PI * (phase === 'wait' ? 2 : STING.chargeBeats) * t));
		telegraph.alpha = live && phase !== 'strike' ? 0.15 + 0.45 * pulse * (0.4 + 0.6 * t) : 0;
		telegraph.scale.set(phase === 'wait' ? 1.1 + 0.25 * pulse : 1.6 - 0.9 * t + 0.15 * pulse);
		telegraph.position.set(x(centre), y(centre));
		telegraph.tint = colour;
		for (let i = 0; i < MAX_CELLS; i += 1) {
			const g = rings[i];
			const cell = cells[i] ?? centre;
			g.position.set(x(cell), y(cell));
			g.scale.set(ringScale);
			g.alpha = i < cells.length ? ringAlpha : 0;
			g.tint = colour;
		}
	};

	let raf = 0;
	const start = () => {
		cancelAnimationFrame(raf);
		// SKIP TO RESULT: the board engine applies the symbol change; the strike art has nothing to show
		if (context.stateGame.skipping) {
			live = false;
			t = 1;
			draw();
			return;
		}
		const ms = Math.max(1, durationOf(phase, kind) / Math.max(0.2, stateBetDerived.timeScale()));
		const t0 = performance.now();
		live = true;
		t = 0;
		draw();
		const step = () => {
			t = Math.min(1, (performance.now() - t0) / ms);
			if (t < 1) raf = requestAnimationFrame(step);
			else live = phase !== 'strike'; // a strike ends on its own; a charge holds until the hit
			draw();
		};
		raf = requestAnimationFrame(step);
	};

	context.eventEmitter.subscribeOnMount({
		stingBeat: (event) => {
			kind = event.kind;
			phase = event.phase;
			centre = event.center;
			cells = event.cells;
			start();
		},
	});
	onMount(() => () => {
		cancelAnimationFrame(raf);
		// the parent's unmount destroys root without its children
		telegraph.destroy();
		for (const g of rings) g.destroy();
	});
</script>
