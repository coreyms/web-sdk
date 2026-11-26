// START REPLAY'S WAIT (2026-11-26; constants REPLAY_LOAD has the why and Corey's words; game/replayWait.ts has the pure rules,
// tools/replay_wait_test.mjs tests them). Manticore Unleashed's replay load, ported to this game's simpler boot: every
// picture the base game draws is in the Pixi preload, and everything a feature loads later already has its own short
// wait and fallback (STRIKE, COLUMN, PRESENT, SUPER_WHEEL loadWaitMs; the scene swap never holds a round).
// The card opens before the preload is in (ui/ReplayModal.svelte); the preload itself starts as the game mounts and runs
// while the card is up, exactly as before. START waits for ONE thing: the game drawn (the preload in and the loading
// screen's fade at its darkest, components/Game.svelte onloaded), which is the moment the card itself used to open. NOT
// capped: the round's handlers (components/EnableGameActor.svelte, the board) mount with the preload, and a round sent
// before them would be lost. Meanwhile the card shows LOADING · N% in START's place, and CONNECTION PROBLEM / TAP TO
// RETRY when the art is stuck (replayStall). Never the audio: a replay never waited for it (2026-11-26, Decimus: a wait
// for it made the round start up to 20 s later than before). components/Game.svelte calls replayGameDrawn() at that moment,
// so the round goes on the next task instead of the next poll. Replay mode only: nothing here runs in play.
import { REPLAY_LOAD } from './constants';
import { replayStall, type ReplayStall } from './replayWait';
import { STAGING_TOOLS, perfMark } from './staging';

export const replayLoad = $state({
	/** START was pressed and the round is waiting for the game to be drawn (the card stays up with its loading sign) */
	waiting: false,
	/** the start-up art is stuck meanwhile (game/replayWait.ts replayStall) */
	stalled: '' as ReplayStall,
	/** performance.now() of the press */
	pressedAt: 0,
	/** how long the last press waited, ms (-1: none yet) */
	waitedMs: -1,
});

/** the start-up art as the shared loader publishes it (stateApp): its progress 0 to 100 and the keys it gave up */
export type StartUp = { loadingProgress: number; failedAssets: readonly string[] };

const POLL_MS = 100;
let lastMoveAt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let look: (() => void) | null = null;

/** TAP TO RETRY on a given-up file (ui/ReplayModal.svelte): the loader fetches it again, and the stall's clock restarts */
export const replayRetried = (): void => {
	lastMoveAt = performance.now();
	replayLoad.stalled = '';
};

/** components/Game.svelte, the moment the game is drawn: a waiting START looks again on the next task (after the Svelte
 *  flush that mounts components/ResumeBet.svelte), not on its next poll */
export const replayGameDrawn = (): void => {
	if (!look) return;
	clearTimeout(timer);
	timer = setTimeout(() => look?.(), 0);
};

/** START REPLAY's wait; resolves, never rejects. replayLoad.waiting is up only when there is a wait at all. */
export const awaitReplayNeeds = async (gameUp: () => boolean, startUp: () => StartUp): Promise<void> => {
	const t0 = performance.now();
	replayLoad.pressedAt = t0;
	replayLoad.stalled = '';
	lastMoveAt = t0;
	if (gameUp()) {
		replayLoad.waitedMs = 0;
		return;
	}
	replayLoad.waiting = true;
	let progress = -1;
	await new Promise<void>((resolve) => {
		look = () => {
			if (gameUp()) {
				look = null;
				return resolve();
			}
			const now = performance.now();
			const s = startUp();
			if (s.loadingProgress !== progress) {
				progress = s.loadingProgress;
				lastMoveAt = now;
			}
			replayLoad.stalled = replayStall({ now, pressedAt: t0, lastMoveAt, failed: s.failedAssets.length }, REPLAY_LOAD);
			timer = setTimeout(() => look?.(), POLL_MS);
		};
		look();
	});
	replayLoad.waiting = false;
	replayLoad.stalled = '';
	replayLoad.waitedMs = Math.round(performance.now() - t0);
	if (STAGING_TOOLS) perfMark('replay:start');
};

if (import.meta.env.DEV && typeof window !== 'undefined') {
	// house rule: extend __reindeer, never a new global
	((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {}).replayLoad = () => ({ ...replayLoad });
}
