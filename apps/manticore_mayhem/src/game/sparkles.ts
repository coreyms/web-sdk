// THE SPARKLE BUS. The board engine (stateGame.presentWinSet) asks for a burst on a cell the moment
// that cell starts to leave; components/BoardCells.svelte drains the queue on the app ticker and
// drives its pooled particles from it. Plain JS on purpose: a burst is presentation only, it is
// never part of the board state, never awaited (the refill does not wait for it), and nothing here
// is reactive, so spawning one costs no Svelte flush.
//
// Times are REAL ms (performance.now()): the engine already divided the style life by timeScale,
// so turbo bursts live shorter exactly like every other beat. While SKIP TO RESULT runs nothing is
// spawned at all (the engine checks `skipping` before calling spawn).

export type Burst = {
	/** board cell the burst sits on */
	reel: number;
	row: number;
	/** multiply tint for the dots (the cleared symbol's colour) */
	tint: number;
	/** seed for the burst's own random pattern: a fresh one per burst */
	seed: number;
	/** performance.now() at the burst's start */
	t0: number;
	/** real ms the burst lives */
	life: number;
};

let seedCounter = 1;
const queue: Burst[] = [];

/** live counters for the DEV probe (__manticore.motion) */
export const sparkleStats = {
	/** bursts requested since boot */
	bursts: 0,
	/** dots alive right now (BoardCells writes it every tick) */
	inUse: 0,
	/** the pool's size (BoardCells writes it once at mount) */
	poolSize: 0,
	/** the most dots ever alive at once */
	peak: 0,
	/** dots a burst wanted that the pool could not give (the bound held; the burst was thinner) */
	dropped: 0,
};

/** frame-time counters (BoardCells ticks them) and the last cascade's removal bookkeeping, for the
 *  DEV probe (__manticore.motion). Plain JS, never rendered. */
export const motionLog = {
	frames: 0,
	/** frames longer than 50 ms since boot (the house phone budget is zero through a feature) */
	framesOver50: 0,
	framesOver33: 0,
	worstMs: 0,
	lastCascade: null as null | { ours: number; book: number; rest: number; extra: number[] },
	/** cascades settled since boot (the handler bumps it after settleBoard) */
	cascadeIndex: 0,
	/** every running spin-total step broadcast since boot, newest last (bounded) */
	steps: [] as { amount: number; at: number; cascade: number }[],
	/** the glow sprites in use right now / the most ever */
	glowInUse: 0,
	glowPeak: 0,
};

/** ask for a burst; a new random pattern every time (the seed is a counter, never a cell hash) */
export const spawnSparkles = (reel: number, row: number, tint: number, lifeMs: number) => {
	seedCounter = (seedCounter + 1) | 0;
	queue.push({ reel, row, tint, seed: seedCounter * 7919 + 13, t0: performance.now(), life: Math.max(1, lifeMs) });
	sparkleStats.bursts += 1;
};

/** drain every queued burst (BoardCells, once per tick) */
export const takeSparkles = (): Burst[] => (queue.length ? queue.splice(0, queue.length) : queue);

/** a tiny LCG, the same one the playground uses, so the two draw the same spread for a seed */
export const seeded = (seed: number) => {
	let x = (seed * 9301 + 49297) % 233280;
	return () => {
		x = (x * 9301 + 49297) % 233280;
		return x / 233280;
	};
};
