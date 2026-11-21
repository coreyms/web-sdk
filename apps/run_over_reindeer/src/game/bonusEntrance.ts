// THE BONUS ENTRANCE, ROUND 2 (Corey 2026-11-21 after staging: "I meant 10 for Free Spins, and S10 for Super", and "It would
// do the siren sounds to the crash and then change the music, like the preview"; constants REINDEER_SOUND.entrance has the
// shape, the numbers and why). Each entry is ONE sequence played once, as the listening page's demo strings it, and nothing
// loops while the card waits. The trigger's handler (game/bookEventHandlerMap.ts freeSpinTrigger) calls three beats:
//   entranceCut(kind)      with the scatter success: the base music ducks to near silence (and Free Spins' police whoop)
//   entranceCard(self)     as the entry card comes up: the hit timed to the card's landing, the build after it, the crash
//                          and the bonus music at the sequence's own time, the card still up
//   entranceDismiss()      the card was dismissed: before the crash, the crash now (the rest faded out); after it, nothing
// Exactly one crash per entry. Everything goes through the game's own sound events (components/Sound.svelte), so the
// effects and music volumes and mutes apply, and SKIP TO RESULT's drop of one-shots too (it is never on during an entry).
// No blob: or object URL: the pieces are in the effects sprite, the music is the music player's own track. Real ms timers,
// never the board's pace: a bonus always enters at regular speed. Nothing here waits: the card keeps the round.
import { eventEmitter } from './eventEmitter';
import { LED_BOARD, REINDEER_SOUND } from './constants';
import type { MusicName, SoundEffectName } from './sound';

const E = REINDEER_SOUND.entrance;
type Kind = 'bonus' | 'super';

/** DEV: a moment into the road's sound log (the sound probe sets the pieces against it) */
const devMark = (what: string, detail?: string) => {
	if (import.meta.env.DEV)
		(
			globalThis as unknown as {
				__reindeer?: { markMoment?: (what: string, detail?: string) => void };
			}
		).__reindeer?.markMoment?.(what, detail);
};

/** the sequence's own timers (the pieces and the crash): cleared by an early crash and by the next entry */
let timers: ReturnType<typeof setTimeout>[] = [];
const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, Math.max(0, ms)));
const clearTimers = () => {
	for (const t of timers) clearTimeout(t);
	timers = [];
};

/** this entry's kind (null: no entry running) */
let kind: Kind | null = null;
/** the base music is ducked (and not yet given its level back) */
let ducked = false;
/** the crash has played for this entry */
let crashed = false;
/** the pieces started and not yet over: name -> [performance.now() of its start, its length ms] */
const sounding = new Map<SoundEffectName, [number, number]>();

const fade = (name: SoundEffectName | MusicName, from: number, to: number, ms: number) =>
	eventEmitter.broadcast({
		type: 'soundFade',
		name,
		from,
		to,
		duration: Math.max(1, Math.round(ms)),
	});

/** a piece of the sequence, once (its own play: forcePlay, never held back by a play of the same name) */
const piece = (name: string, ms: number, what: string) => {
	const n = name as SoundEffectName;
	sounding.set(n, [performance.now(), ms]);
	eventEmitter.broadcast({ type: 'soundOnce', name: n, forcePlay: true });
	devMark('entrance', what);
};

/** THE CUT: with the trigger's success, the base music to near silence; Free Spins' police whoop with it */
export const entranceCut = (k: Kind) => {
	clearTimers();
	sounding.clear();
	kind = k;
	crashed = false;
	ducked = true;
	fade('bgm_base', 1, E.duck.to, E.duck.ms);
	devMark('entrance', `cut ${k} ${E.duck.to} ${E.duck.ms}ms`);
	const P = E[k];
	if (P.cut) piece(P.cut, P.cutMs, 'cut whoop');
};

/** THE CRASH, once per entry: the crash piece and the bonus music from its start on the same call. `early`: a press (or
 *  Autoplay Bonuses' own continue) before the sequence reached it, so every piece still sounding fades out under it and
 *  no later piece plays. */
const crash = (early: boolean) => {
	if (!kind || crashed) return;
	crashed = true;
	clearTimers();
	const P = E[kind];
	const music: MusicName = kind === 'super' ? 'bgm_super' : 'bgm_bonus';
	const now = performance.now();
	const cut: string[] = [];
	for (const [name, [at, ms]] of sounding) {
		const left = ms - (now - at);
		// (at the sequence's own crash every piece has ended: the build's own 30 ms fade out is in its file, and a timer a
		// few ms late leaves only that; only an early crash cuts a piece)
		if (left <= 0 || (!early && left <= 30)) continue;
		const out = Math.min(E.pressOutMs, left);
		fade(name, 1, 0, out);
		// (its own timer, never cleared: the stop after the fade is due whatever comes next)
		setTimeout(() => eventEmitter.broadcast({ type: 'soundStop', name }), out + 10);
		cut.push(`${name} out ${Math.round(out)}ms`);
	}
	sounding.clear();
	// a crash at its own level (Super's, see constants): a play at a level of its own, the effects mixer and mute applied
	if (P.crashVolume !== 1) eventEmitter.broadcast({ type: 'soundOnce', name: P.crash as SoundEffectName, volume: P.crashVolume });
	else eventEmitter.broadcast({ type: 'soundOnce', name: P.crash as SoundEffectName, forcePlay: true });
	eventEmitter.broadcast({ type: 'soundMusic', name: music });
	devMark('entrance', `crash ${kind} ${early ? 'early' : 'at its time'} vol ${P.crashVolume}${cut.length ? ` ${cut.join(', ')}` : ''}`);
	devMark('music', music);
	// the base music's own level back once the swap has stopped it (its own timer: the card's dismissal never clears it)
	if (ducked) setTimeout(() => fade('bgm_base', E.duck.to, 1, E.restoreMs), E.restoreMs);
	ducked = false;
};

/** THE CARD COMES UP: the hit lands with it, the build follows, then the crash and the music at the sequence's own time
 *  (the card still up). `selfDismiss`: the card leaves by itself (Autoplay Bonuses in a live run) about 1.4 s after it
 *  comes up, so the build is not started at all (it would be due about then); that dismissal is the early crash. */
export const entranceCard = (selfDismiss = false) => {
	if (!kind) return;
	const P = E[kind];
	// the card's landing (ms after it comes up): the LED back board seated, or the HTML card's pop at its end
	const board = LED_BOARD.on && LED_BOARD.cards === 'board';
	const landMs = board ? LED_BOARD.rise.backAtMs + LED_BOARD.rise.riseMs : E.cardPopMs;
	const hitDelay = Math.max(0, landMs - P.hitImpactMs);
	devMark('entrance', `card ${kind} ${board ? 'board' : 'html'} lands ${landMs}ms, hit in ${hitDelay}ms${selfDismiss ? ', self dismiss' : ''}`);
	later(hitDelay, () => {
		piece(P.hit, P.hitMs, 'hit');
		if (selfDismiss) {
			devMark('entrance', 'no build (the card leaves by itself)');
			// (a backstop only: the card's own continue at ROUND.autoplayMs brings the crash first)
			later(E.crashAfterMs, () => crash(false));
			return;
		}
		later(E.buildAfterMs, () => {
			piece(P.build, E.buildMs, 'build');
			// the sequence's crash on the build's end (crashAfterMs after the hit), as the demo's drop
			later(E.buildMs, () => crash(false));
		});
	});
};

/** THE CARD WAS DISMISSED: before the crash, the crash now; after it, the card just goes (the music carries on) */
export const entranceDismiss = () => {
	if (!kind) return;
	if (!crashed) crash(true);
	else devMark('entrance', 'dismiss after the crash');
	kind = null;
};
