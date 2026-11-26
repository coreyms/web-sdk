// THE REPLAY'S WAIT, PURE (2026-11-26; constants REPLAY_LOAD has the why; game/replayLoad.svelte.ts runs it each poll).
// No imports but the numbers' type, so tools/replay_wait_test.mjs reads it in node.
//   replayStall   before the game is drawn: is the start-up art stuck? 'failed' a file the shared loader gave up after
//                 its own retries; 'held' no file landed for stallMs (since the press or the last one), or the art is not
//                 all in preGameMs after the press; '' otherwise
//   replayStep    one poll of START's wait: keep waiting before the game is drawn, then start once the audio is in or
//                 capMs after the game was drawn
//   replayPct     the loading sign's percent: the start-up art and the audio by bytes, or the cap's time once the game is
//                 drawn when that is further on; 99 at most (the sign is up only while something is still coming)
export type ReplayLoadNumbers = { capMs: number; stallMs: number; preGameMs: number };
export type ReplayStall = '' | 'failed' | 'held';

export const replayStall = (o: { now: number; pressedAt: number; lastMoveAt: number; failed: number }, n: ReplayLoadNumbers): ReplayStall => {
	if (o.failed > 0) return 'failed';
	if (o.now - o.lastMoveAt >= n.stallMs || o.now - o.pressedAt >= n.preGameMs) return 'held';
	return '';
};

export type ReplayStep = 'wait' | 'start' | 'capped';
export const replayStep = (o: { now: number; gameUp: boolean; drawnAt: number; audioIn: boolean }, n: ReplayLoadNumbers): ReplayStep => {
	if (!o.gameUp) return 'wait';
	if (o.audioIn) return 'start';
	return o.drawnAt > 0 && o.now - o.drawnAt >= n.capMs ? 'capped' : 'wait';
};

export const replayPct = (o: { preload: number; preloadBytes: number; audio: number; audioBytes: number; now: number; drawnAt: number }, n: ReplayLoadNumbers): number => {
	const clamp = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
	const total = Math.max(1, o.preloadBytes + o.audioBytes);
	const bytes = (100 * (clamp(o.preload) * o.preloadBytes + clamp(o.audio) * o.audioBytes)) / total;
	const time = o.drawnAt > 0 ? (100 * clamp((o.now - o.drawnAt) / n.capMs)) : 0;
	return Math.min(99, Math.round(Math.max(bytes, time)));
};
