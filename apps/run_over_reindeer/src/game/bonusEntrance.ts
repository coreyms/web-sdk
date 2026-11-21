// THE BONUS ENTRANCE (Corey 2026-11-21, "I like S10 for both": the police whoop at the Free Spins entry and the Super
// entry; constants REINDEER_SOUND.entrance has the shape, the numbers and why). The trigger's handler
// (game/bookEventHandlerMap.ts freeSpinTrigger) calls the three beats in order:
//   entranceCut()      with the scatter success: the base music ducks to near silence
//   entranceCard()     as the entry card comes up: the hit is timed to the card's landing, the build after it
//   entranceDrop(m)    when the card is dismissed: the drop and the bonus music `m` from its start, the build out
// Everything goes through the game's own sound events (components/Sound.svelte), so the effects and music volumes and
// mutes apply, and SKIP TO RESULT's drop of one-shots too (it is never on during an entry). No blob: or object URL: the
// pieces are in the effects sprite, the music is the music player's own track. Real ms timers, never the board's pace:
// a bonus always enters at regular speed. Nothing here waits: the card keeps the round.
import { eventEmitter } from './eventEmitter';
import { LED_BOARD, REINDEER_SOUND } from './constants';
import type { MusicName, SoundEffectName } from './sound';

const E = REINDEER_SOUND.entrance;
const HIT = E.hit as SoundEffectName;
const BUILD = E.build as SoundEffectName;
const DROP = E.drop as SoundEffectName;

/** DEV: a moment into the road's sound log (the sound probe sets the pieces against it) */
const devMark = (what: string, detail?: string) => {
	if (import.meta.env.DEV)
		(
			globalThis as unknown as {
				__reindeer?: { markMoment?: (what: string, detail?: string) => void };
			}
		).__reindeer?.markMoment?.(what, detail);
};

let timers: ReturnType<typeof setTimeout>[] = [];
const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, Math.max(0, ms)));
const clearTimers = () => {
	for (const t of timers) clearTimeout(t);
	timers = [];
};

/** the base music is ducked (and not yet given its level back) */
let ducked = false;
/** performance.now() of the hit's start and of the build's start (-1: not playing) */
let hitAt = -1;
let buildAt = -1;

/** the build's level now, on its own schedule (fade in, a whole pass, the ease to the hold level) */
const buildLevel = (now: number): number => {
	if (buildAt < 0) return 0;
	const t = now - buildAt;
	if (t < E.buildInMs) return Math.max(0, t / E.buildInMs);
	if (t < E.holdAfterMs) return 1;
	const u = Math.min(1, (t - E.holdAfterMs) / E.holdFadeMs);
	return 1 + (E.holdLevel - 1) * u;
};

const fade = (name: SoundEffectName | MusicName, from: number, to: number, ms: number) =>
	eventEmitter.broadcast({
		type: 'soundFade',
		name,
		from,
		to,
		duration: Math.max(1, Math.round(ms)),
	});

/** a sprite play faded to silence over `ms`, then stopped (its own play only: the name's one play) */
const fadeStop = (name: SoundEffectName, from: number, ms: number) => {
	fade(name, from, 0, ms);
	later(ms + 10, () => eventEmitter.broadcast({ type: 'soundStop', name }));
};

/** THE CUT: with the trigger's success, the base music to near silence */
export const entranceCut = () => {
	clearTimers();
	ducked = true;
	fade('bgm_base', 1, E.duck.to, E.duck.ms);
	devMark('entrance', `cut ${E.duck.to} ${E.duck.ms}ms`);
};

/** THE CARD COMES UP: the hit lands with it, the build follows under it */
export const entranceCard = () => {
	// the card's landing (ms after it comes up): the LED back board seated, or the HTML card's pop at its end
	const board = LED_BOARD.on && LED_BOARD.cards === 'board';
	const landMs = board ? LED_BOARD.rise.backAtMs + LED_BOARD.rise.riseMs : E.cardPopMs;
	const hitDelay = Math.max(0, landMs - E.hitImpactMs);
	devMark('entrance', `card ${board ? 'board' : 'html'} lands ${landMs}ms, hit in ${hitDelay}ms`);
	later(hitDelay, () => {
		hitAt = performance.now();
		eventEmitter.broadcast({ type: 'soundOnce', name: HIT, forcePlay: true });
		devMark('entrance', 'hit');
		later(E.buildAfterMs, () => {
			buildAt = performance.now();
			eventEmitter.broadcast({ type: 'soundLoop', name: BUILD });
			fade(BUILD, 0, 1, E.buildInMs);
			devMark('entrance', 'build');
			// a card left waiting: after one whole pass the loop eases down and keeps looping there
			later(E.holdAfterMs, () => {
				fade(BUILD, 1, E.holdLevel, E.holdFadeMs);
				devMark('entrance', `hold ${E.holdLevel} ${E.holdFadeMs}ms`);
			});
		});
	});
};

/** THE DROP: the card is dismissed. The drop and the bonus music on the same moment, the build and a hit still
 *  sounding faded out under them, the base music's own level back (the swap has stopped it). */
export const entranceDrop = (music: MusicName) => {
	clearTimers();
	const now = performance.now();
	if (buildAt >= 0) fadeStop(BUILD, buildLevel(now), E.buildOutMs);
	const hitLeft = hitAt >= 0 ? E.hitMs - (now - hitAt) : 0;
	if (hitLeft > 0) fadeStop(HIT, 1, Math.min(E.hitOutMs, hitLeft));
	eventEmitter.broadcast({ type: 'soundOnce', name: DROP, forcePlay: true });
	eventEmitter.broadcast({ type: 'soundMusic', name: music });
	devMark(
		'entrance',
		`drop${buildAt >= 0 ? ` build out at ${buildLevel(now).toFixed(2)}` : ' (no build yet)'}${hitLeft > 0 ? ` hit out ${Math.round(Math.min(E.hitOutMs, hitLeft))}ms` : ''}`,
	);
	devMark('music', music);
	if (ducked) later(E.restoreMs, () => fade('bgm_base', E.duck.to, 1, E.restoreMs));
	ducked = false;
	hitAt = -1;
	buildAt = -1;
};
