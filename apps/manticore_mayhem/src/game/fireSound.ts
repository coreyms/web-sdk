// THE FIRE LOOPS (constants FIRE_SOUND; sprite entries sfx_fire_super, a crackle, and sfx_fire_epic, a low roar, both
// 6.00 s seamless loops, tools/build_audiosprite.py MM_EVENTS). The loop of the mode plays quietly under the music for
// the whole SUPER or EPIC round and fades in and out with the scene's change of mode; the base game and the regular
// Bonus have no fire sound. components/Background.svelte says which mode it is (setFireSound), in every layout.
// It goes through the game's own sound events like every effect (components/Sound.svelte): soundLoop starts it,
// soundFade is the sound system's own fade of one playing sprite sound (Howler's, a linear ramp), soundStop ends it
// once it has faded out. So it follows the effects volume, the sound switch and mute like everything else. SKIP TO
// RESULT: Sound.svelte drops every start while it runs, so the caller asks for no loop then (the one playing fades out)
// and none again for the rest of that round.
// Nothing here runs per frame: one timer per fade out, on a change of mode.
import { FIRE_SOUND } from './constants';
import { eventEmitter } from './eventEmitter';

export type FireLoop = keyof typeof FIRE_SOUND.loops;
type State = { on: boolean; from: number; to: number; t0: number; ms: number; timer: ReturnType<typeof setTimeout> | null };

const LOOPS = Object.keys(FIRE_SOUND.loops) as FireLoop[];
const states = Object.fromEntries(LOOPS.map((k) => [k, { on: false, from: 0, to: 0, t0: 0, ms: 0, timer: null }])) as Record<FireLoop, State>;
let current: FireLoop | null = null;

/** DEV / probe (window.__manticore.fireSound): every start, fade and stop asked, oldest first */
export const fireSoundLog: { t: number; what: 'start' | 'fade' | 'stop'; loop: FireLoop; from?: number; to?: number; ms?: number }[] = [];
const log = (entry: (typeof fireSoundLog)[number]) => {
	if (!import.meta.env.DEV) return;
	fireSoundLog.push(entry);
	if (fireSoundLog.length > 200) fireSoundLog.splice(0, 100);
};

/** where a loop's own fade has got to (the sound system keeps only the fade's target) */
const levelNow = (s: State, now: number) => (s.ms <= 0 ? s.to : s.from + (s.to - s.from) * Math.min(1, Math.max(0, (now - s.t0) / s.ms)));

const fade = (loop: FireLoop, to: number, ms: number) => {
	const s = states[loop];
	const now = performance.now();
	const from = s.on ? levelNow(s, now) : 0;
	const name = FIRE_SOUND.loops[loop].name;
	if (s.timer) clearTimeout(s.timer);
	s.timer = null;
	if (!s.on && to > 0) {
		s.on = true;
		eventEmitter.broadcast({ type: 'soundLoop', name });
		log({ t: now, what: 'start', loop });
	}
	if (!s.on) return;
	s.from = from;
	s.to = to;
	s.t0 = now;
	s.ms = ms;
	eventEmitter.broadcast({ type: 'soundFade', name, from, to, duration: ms });
	log({ t: now, what: 'fade', loop, from, to, ms });
	if (to > 0) return;
	// faded out: stop it (a loop left running at 0 would still be mixed)
	s.timer = setTimeout(() => {
		s.timer = null;
		s.on = false;
		eventEmitter.broadcast({ type: 'soundStop', name });
		log({ t: performance.now(), what: 'stop', loop });
	}, ms + FIRE_SOUND.stopAfterMs);
};

/** the loop that should be heard now (null: none). A change fades the old one out and the new one in over
 *  FIRE_SOUND.fadeMs; asking for what is already playing does nothing. */
export const setFireSound = (want: FireLoop | null): void => {
	if (want === current) return;
	if (current) fade(current, 0, FIRE_SOUND.fadeMs);
	current = want;
	if (want) fade(want, FIRE_SOUND.loops[want].volume, FIRE_SOUND.fadeMs);
};

/** DEV / probe */
export const fireSoundState = () => ({ current, loops: Object.fromEntries(LOOPS.map((k) => [k, { on: states[k].on, level: states[k].on ? levelNow(states[k], performance.now()) : 0, to: states[k].to }])) });
