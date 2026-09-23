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
	import { Circle, Container } from 'pixi-svelte';
	import { stateBetDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, STING, reelOf, rowOf } from '../game/constants';
	import type { StingKind } from '../game/typesBookEvent';

	const context = getContext();

	/** the most cells one sting can cover (a super's 3x3) — the ring pool never grows */
	const MAX_CELLS = 9;
	const RING = SYMBOL_SIZE; // drawn once at this size; the beat only scales it

	type Phase = 'charge' | 'wait' | 'strike';
	let kind = $state<StingKind>('normal');
	let phase = $state<Phase>('strike');
	let centre = $state(0);
	let cells = $state<number[]>([]);
	let t = $state(0); // 0..1 through the current phase
	let live = $state(false);

	const durationOf = (p: Phase, k: StingKind) => {
		if (p === 'wait') return STING.scatterHoldMs;
		if (p === 'charge') return k === 'super' ? STING.superChargeMs : STING.chargeMs;
		if (k === 'scatter') return STING.scatterHitMs;
		return k === 'normal' ? STING.normalMs : STING.bigHitMs;
	};

	let raf = 0;
	const start = () => {
		cancelAnimationFrame(raf);
		const ms = Math.max(1, durationOf(phase, kind) / Math.max(0.2, stateBetDerived.timeScale()));
		const t0 = performance.now();
		live = true;
		t = 0;
		const step = () => {
			t = Math.min(1, (performance.now() - t0) / ms);
			if (t < 1) raf = requestAnimationFrame(step);
			else live = phase !== 'strike'; // a strike ends on its own; a charge holds until the hit
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
	$effect(() => () => cancelAnimationFrame(raf));

	const colour = $derived(kind === 'scatter' ? STING.scatterColor : STING.wildColor);
	const x = (cell: number) => (reelOf(cell) + 0.5) * SYMBOL_SIZE;
	const y = (cell: number) => (rowOf(cell) + 0.5) * SYMBOL_SIZE;

	// the impact ring: snaps out of the cell and fades, one per struck cell, all at once for a
	// big / super (the shape turns together)
	const ringScale = $derived(0.45 + 1.15 * t);
	const ringAlpha = $derived(live && phase === 'strike' ? 1 - t : 0);
	// the telegraph at the centre: a pulse while the tail charges (big / super) or while the
	// disappointment beat runs (scatter)
	const pulse = $derived(Math.abs(Math.sin(Math.PI * (phase === 'wait' ? 2 : STING.chargeBeats) * t)));
	const telegraphAlpha = $derived(live && phase !== 'strike' ? 0.15 + 0.45 * pulse * (0.4 + 0.6 * t) : 0);
	const telegraphScale = $derived(phase === 'wait' ? 1.1 + 0.25 * pulse : 1.6 - 0.9 * t + 0.15 * pulse);
</script>

<!-- always mounted, always in the same place in the sorted board container: only alpha moves -->
<Container zIndex={15}>
	<Circle
		x={x(centre)}
		y={y(centre)}
		anchor={0.5}
		diameter={RING}
		backgroundAlpha={0}
		borderColor={colour}
		borderWidth={4}
		scale={telegraphScale}
		alpha={telegraphAlpha}
	/>
	{#each Array(MAX_CELLS) as _, i (i)}
		<Circle
			x={x(cells[i] ?? centre)}
			y={y(cells[i] ?? centre)}
			anchor={0.5}
			diameter={RING}
			backgroundAlpha={0}
			borderColor={colour}
			borderWidth={6}
			scale={ringScale}
			alpha={i < cells.length ? ringAlpha : 0}
		/>
	{/each}
</Container>
