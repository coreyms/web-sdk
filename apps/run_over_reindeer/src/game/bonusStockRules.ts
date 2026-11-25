// THE STOCK RULES FOR TURBO AND AUTOPLAY AROUND A BONUS ROUND (2026-11-18), a standing rule in all of the owner's games.
// The owner (Corey), quoting the feedback he received:
//   "When playing on Turbo mode, or Super Turbo Mode, upon entering the bonus games, the speed needs to be set back to
//   regular speed. Player can adjust the speed if they want during bonus games, but it should be regular speed on every
//   entry even if they were in super turbo in the last bonus game. Regular game speed should be remembered for after the
//   bonus. Player should still be able to stop autospins, while in bonus games if they had them running. There should
//   also be a momentary pause after bonus games complete and the player clicks to clear the wrap up screen, if
//   auto-play was enabled, giving players a chance to stop auto-spins before they resume after the round, about a 1
//   second, regardless of speed."
// The four rules:
//   1. ENTRY AT REGULAR SPEED. Every bonus round (a trigger, a round started from the feature menu, a round resumed after
//      a reload) starts at turbo level 0 from its entry on, whatever the level was. bonusEntered().
//   2. THE BONUS'S OWN SPEED. A Turbo press during the round lasts that round only (ui/controls.svelte.ts turboPress
//      writes stateGame.baseTurboLevel only outside a bonus round); on leaving, the base game's level comes back, and
//      that level is the one saved on the device (components/Sound.svelte), so a reload mid round keeps it. bonusLeft().
//   3. AUTOPLAY STOPS IN A BONUS. A running run can be stopped at any time in the round with the Auto key (or Spin), as
//      in the base game; the round plays on to its end and no automatic spin follows it. Nothing here: the HUD kit's
//      own stop (controls.autoPress, controls.spin). Autoplay's Stop on Free Games ends the run at the trigger
//      (bonusEntered), as its setting says.
//   4. THE PAUSE AFTER THE WRAP-UP. With autoplay still running when the wrap-up is cleared, the next automatic spin
//      starts AUTOPLAY_RESUME_PAUSE_MS of real time after that clear (never scaled by turbo), with the run's stop live
//      all through it. autoSpinPause(), called by the autoplay machine between two rounds (game/actor.ts
//      onAutoSpinPause, packages/utils-xstate createIntermediateMachineAutoBet), just before it asks whether spins are
//      left: a stop pressed during the pause ends the run there.
//   5. THE SCENE SETTING DURING A RUN (2026-11-24, Corey: "Can we make it happen after the next spin and continue
//      auto-play?"). A change of the Scene setting (Snow, Dark, or the device's own with Auto) asked while autoplay runs
//      is taken up between two rounds: the run holds its next spin while the scene cross-fades (about a quarter of a
//      second with the set in the browser's cache), then plays on. Never during a bonus round. The run's stop is live
//      through the hold, and the hold has an end of its own (SCENE_GAP), so it can never strand a run: a change that
//      cannot be taken in this gap is tried again in the next one. sceneChangeGap(), in autoSpinPause.
// To carry it to another game on the same kit: copy this file, call bonusEntered() where the game enters a bonus round
// (its trigger and its resume rebuild), bonusLeft() once the wrap-up is cleared, roundStarting() at the press of a new
// round (actor onNewGameStart), and pass autoSpinPause as createPrimaryMachines' onAutoSpinPause. Presentation and
// pacing only: nothing here reads or changes what a round awards.
import { stateBet, stateUrlDerived } from 'state-shared';
import { waitForTimeout } from 'utils-shared/wait';

import { eventEmitter } from './eventEmitter';
import { stateGame, stateGameDerived } from './stateGame.svelte';
import { setFor } from './sceneChoice';
import { sceneGap, stateScene } from './stateScene.svelte';

/** rule 4: the pause between a cleared wrap-up and the next automatic spin, real ms at every turbo level */
export const AUTOPLAY_RESUME_PAUSE_MS = 1000;

/** performance.now() at which the next automatic spin may start; null: no pause owed */
let resumeAt: number | null = null;

/** DEV: the frames of the pause in progress */
let frames: number[] = [];
/** DEV: what the rules did, for the probes (window.__reindeer.stockRules) */
const log = {
	entries: [] as { at: number; from: number; base: number; stoppedRun: boolean }[],
	exits: [] as { at: number; from: number; to: number; auto: boolean }[],
	pauses: [] as { clearedAt: number; waitFrom: number; until: number; endedAt: number; counterAfter: number; frames: number[] }[],
	starts: [] as { at: number; owed: boolean }[],
	sceneGaps: [] as { at: number; ms: number; taken: boolean; settled: boolean; set: string; counterAfter: number }[],
};

/** rules 1 and 3: a bonus round is entered (its trigger, or a resumed round's rebuild) */
export const bonusEntered = () => {
	const from = stateGame.turboLevel;
	stateGameDerived.setTurboLevel(0);
	// autoplay's Stop on Free Games: the round still plays in full, the run ends with it
	const stoppedRun = stateGame.autoStopOnFreeGames && stateBet.autoSpinsCounter > 0;
	if (stoppedRun) stateBet.autoSpinsCounter = 0;
	if (import.meta.env.DEV) log.entries.push({ at: performance.now(), from, base: stateGame.baseTurboLevel, stoppedRun });
};

/** rules 2 and 4: the wrap-up was cleared (pressed, or its own time ran out) and the game is back in the base game */
export const bonusLeft = () => {
	const from = stateGame.turboLevel;
	stateGameDerived.setTurboLevel(stateGame.baseTurboLevel);
	const auto = stateBet.autoSpinsCounter > 0 && !stateUrlDerived.replay();
	resumeAt = auto ? performance.now() + AUTOPLAY_RESUME_PAUSE_MS : null;
	if (import.meta.env.DEV) {
		log.exits.push({ at: performance.now(), from, to: stateGame.turboLevel, auto });
		// the page's frames through the pause (a frame the main thread holds past the pause's end delays its timer too)
		frames = [];
		if (auto && resumeAt !== null && typeof requestAnimationFrame !== 'undefined') {
			const stopAt = resumeAt + 400;
			const tick = (t: number) => {
				frames.push(Math.round(t * 10) / 10);
				if (frames.length < 400 && t < stopAt) requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		}
	}
};

/** resolves at `at` (performance.now() time) or at the first moment after it the page can act: a timer, or the first
 *  frame drawn at or after it, whichever comes first (a busy page, the scene's return to day for one, runs its timers
 *  late; its next frame is often sooner). A hidden page draws no frames: the timer alone ends it there. */
const untilTime = (at: number) =>
	new Promise<void>((resolve) => {
		let done = false;
		let raf = 0;
		const end = () => {
			if (done) return;
			done = true;
			if (raf && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf);
			resolve();
		};
		void waitForTimeout(Math.max(0, at - performance.now())).then(end);
		if (typeof requestAnimationFrame === 'undefined') return;
		const tick = () => {
			if (done) return;
			if (performance.now() >= at) end();
			else raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
	});

/** a new round's press: whatever pause was owed is spent */
export const roundStarting = () => {
	if (import.meta.env.DEV) log.starts.push({ at: performance.now(), owed: resumeAt !== null });
	resumeAt = null;
};

/** rule 5: how long the run holds for a change of scene set, real ms. `takeMs`: for the board to take the set up (its next
 *  frame, when nothing of its own is in the way); `settleMs`: for the scene to be on screen whole (its pieces in, the fade
 *  done) */
export const SCENE_GAP = { takeMs: 1500, settleMs: 6000 };

/** the next frame drawn, or 50 ms on a page that draws none (hidden) */
const nextFrame = () =>
	new Promise<void>((resolve) => {
		let done = false;
		const end = () => {
			if (done) return;
			done = true;
			resolve();
		};
		void waitForTimeout(50).then(end);
		if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(end);
	});

/** rule 5: the Scene setting asks for the other set and a run is on: hold the next spin while the board takes it up */
const sceneChangeGap = async () => {
	const pending = () => setFor(stateScene.choice, stateScene.dark) !== stateScene.set;
	const running = () => stateBet.autoSpinsCounter > 0;
	if (!running() || !pending() || stateUrlDerived.replay()) return;
	const t0 = performance.now();
	let taken = false;
	sceneGap.open = true;
	try {
		while (running() && pending() && performance.now() - t0 < SCENE_GAP.takeMs) await nextFrame();
		taken = !pending();
		if (taken) {
			// (two frames: the scene wanted turns to the new set's with the board's own effect, then the swap sees it)
			await nextFrame();
			await nextFrame();
			const t1 = performance.now();
			while (running() && !sceneGap.settled() && performance.now() - t1 < SCENE_GAP.settleMs) await nextFrame();
		}
	} finally {
		sceneGap.open = false;
		if (import.meta.env.DEV) log.sceneGaps.push({ at: t0, ms: performance.now() - t0, taken, settled: sceneGap.settled(), set: stateScene.set, counterAfter: stateBet.autoSpinsCounter });
	}
};

/** rules 4 and 5: the autoplay machine's pause before its next round (game/actor.ts onAutoSpinPause) */
export const autoSpinPause = async () => {
	await resumePause();
	await sceneChangeGap();
};

const resumePause = async () => {
	const until = resumeAt;
	resumeAt = null;
	if (until === null) return;
	const waitFrom = performance.now();
	if (stateBet.autoSpinsCounter > 0 && until - waitFrom > 0) await untilTime(until);
	// a Spin press after the wrap-up (in the pause, or before it while the end-round settles) stops the run through the
	// slam stop's path (ui/controls.svelte.ts spin), which takes the stop and the hurry until a round ends; when no round
	// follows, they are given back here as a round's end does
	eventEmitter.broadcast({ type: 'stopButtonEnable' });
	if (import.meta.env.DEV) log.pauses.push({ clearedAt: until - AUTOPLAY_RESUME_PAUSE_MS, waitFrom, until, endedAt: performance.now(), counterAfter: stateBet.autoSpinsCounter, frames: [...frames] });
};

if (import.meta.env.DEV && typeof window !== 'undefined') {
	// house rule: extend __reindeer, never a new global
	Object.assign(((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {}), {
		stockRules: () => ({ pauseMs: AUTOPLAY_RESUME_PAUSE_MS, resumeAt, entries: [...log.entries], exits: [...log.exits], pauses: [...log.pauses], starts: [...log.starts], sceneGaps: [...log.sceneGaps], turbo: stateGame.turboLevel, base: stateGame.baseTurboLevel, hurry: stateGame.hurryLevel, counter: stateBet.autoSpinsCounter, stopFree: stateGame.autoStopOnFreeGames, gameType: stateGame.gameType }),
	});
}
