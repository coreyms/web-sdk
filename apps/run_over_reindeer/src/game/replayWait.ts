// THE REPLAY'S WAIT, PURE (2026-11-26; constants REPLAY_LOAD has the why; game/replayLoad.svelte.ts runs it each poll).
// No imports but the numbers' type, so tools/replay_wait_test.mjs reads it in node.
//   replayStall   before the game is drawn: is the start-up art stuck? 'failed' a file the shared loader gave up after
//                 its own retries; 'held' no file landed for stallMs (since the press or the last one), or the art is not
//                 all in preGameMs after the press; '' otherwise
//   replayPct     the loading sign's percent: the start-up art (the Pixi preload's own progress, 0 to 1); 99 at most (the
//                 sign is up only while something is still coming)
export type ReplayLoadNumbers = { stallMs: number; preGameMs: number };
export type ReplayStall = '' | 'failed' | 'held';

export const replayStall = (o: { now: number; pressedAt: number; lastMoveAt: number; failed: number }, n: ReplayLoadNumbers): ReplayStall => {
	if (o.failed > 0) return 'failed';
	if (o.now - o.lastMoveAt >= n.stallMs || o.now - o.pressedAt >= n.preGameMs) return 'held';
	return '';
};

export const replayPct = (preload: number): number => {
	const p = Number.isFinite(preload) ? Math.min(1, Math.max(0, preload)) : 0;
	return Math.min(99, Math.round(100 * p));
};
