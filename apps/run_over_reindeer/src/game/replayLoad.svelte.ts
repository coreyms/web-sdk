// START REPLAY'S WAIT (2026-11-26; constants REPLAY_LOAD has the why and Corey's words; game/replayWait.ts has the pure rules,
// tools/replay_wait_test.mjs tests them). Manticore Unleashed's replay load, ported to this game's simpler boot: every
// picture the base game draws is in the Pixi preload, and everything a feature loads later already has its own short
// wait and fallback (STRIKE, COLUMN, PRESENT, SUPER_WHEEL loadWaitMs; the scene swap never holds a round). So the card's
// START waits for two things only:
//   1. the game drawn (the Pixi preload in and its fade through black over, components/Game.svelte's loading screen gone).
//      NOT capped: the round's handlers (components/EnableGameActor.svelte, the board) mount with the preload, and a round
//      sent before them would be lost. Since the card opens before the preload, a press can come first; the card then
//      shows LOADING · N% in START's place, and CONNECTION PROBLEM / TAP TO RETRY when the art is stuck (replayStall).
//   2. the audio (sound.isReady, which is also true when the sprite failed and the game runs silent), at most
//      REPLAY_LOAD.capMs after the game was drawn. The audio starts loading once the preload is in, as in play.
// When both are in at the press (the usual case on a fast link) the round starts at once, as before. Replay mode only:
// nothing here runs in play.
import { REPLAY_LOAD } from './constants';
import { replayStall, replayStep, type ReplayStall } from './replayWait';
import { STAGING_TOOLS, perfMark } from './staging';

export const replayLoad = $state({
	/** START was pressed and the round is waiting (the card stays up with its loading sign) */
	waiting: false,
	/** the start-up art is stuck while START waits for the game to be drawn (game/replayWait.ts replayStall) */
	stalled: '' as ReplayStall,
	/** performance.now() of the press, of the game drawn during a wait (0: not yet), and of the last poll */
	pressedAt: 0,
	drawnAt: 0,
	tick: 0,
	/** the last wait ended at REPLAY_LOAD.capMs with the audio still out */
	capped: false,
	/** how long the last press waited, ms (-1: none yet) */
	waitedMs: -1,
});

/** the start-up art as the shared loader publishes it (stateApp): its progress 0 to 100 and the keys it gave up */
export type StartUp = { loadingProgress: number; failedAssets: readonly string[] };

const POLL_MS = 100;
let lastMoveAt = 0;
/** TAP TO RETRY on a given-up file (ui/ReplayModal.svelte): the loader fetches it again, and the stall's clock restarts */
export const replayRetried = (): void => {
	lastMoveAt = performance.now();
	replayLoad.stalled = '';
};

/** START REPLAY's wait; resolves, never rejects. replayLoad.waiting is up only when there is a wait at all. */
export const awaitReplayNeeds = async (gameUp: () => boolean, startUp: () => StartUp, audioIn: () => boolean): Promise<void> => {
	const t0 = performance.now();
	replayLoad.pressedAt = t0;
	replayLoad.drawnAt = 0;
	replayLoad.capped = false;
	replayLoad.stalled = '';
	lastMoveAt = t0;
	if (gameUp() && audioIn()) {
		replayLoad.waitedMs = 0;
		return;
	}
	replayLoad.waiting = true;
	let progress = -1;
	await new Promise<void>((resolve) => {
		const look = () => {
			const now = (replayLoad.tick = performance.now());
			const up = gameUp();
			if (!up) {
				const s = startUp();
				if (s.loadingProgress !== progress) {
					progress = s.loadingProgress;
					lastMoveAt = now;
				}
				replayLoad.stalled = replayStall({ now, pressedAt: t0, lastMoveAt, failed: s.failedAssets.length }, REPLAY_LOAD);
				return void setTimeout(look, POLL_MS);
			}
			replayLoad.stalled = '';
			replayLoad.drawnAt ||= now;
			const step = replayStep({ now, gameUp: up, drawnAt: replayLoad.drawnAt, audioIn: audioIn() }, REPLAY_LOAD);
			if (step === 'wait') return void setTimeout(look, POLL_MS);
			replayLoad.capped = step === 'capped';
			resolve();
		};
		look();
	});
	replayLoad.waiting = false;
	replayLoad.stalled = '';
	replayLoad.waitedMs = Math.round(performance.now() - t0);
	if (STAGING_TOOLS) perfMark(replayLoad.capped ? 'replay:capped' : 'replay:start');
};

if (import.meta.env.DEV && typeof window !== 'undefined') {
	// house rule: extend __reindeer, never a new global
	((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {}).replayLoad = () => ({ ...replayLoad });
}
