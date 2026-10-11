// THE CHAIN SOUNDS (constants CHAIN_SOUND; sprite entries sfx_chain_heavy, a 1.15 s clank, and sfx_chain_light, a 0.53 s
// rattle, with sfx_chain_light_logo the same clip quieter; tools/build_audiosprite.py MM_EVENTS has the levels).
// Corey's mapping (2026-10-11):
//   a BOARD KICK of a feature (the claw swipe's, the roar's)   the heavy clank, once per kick, when the kick first
//                                                              passes CHAIN_SOUND.kickThresholdPx (stateGame.svelte.ts)
//   the WIN PLAQUE dropping in                                 the light rattle
//   the LOGO landing                                           the light rattle, quieter
//   a win TIER landing                                         nothing: each tier has its own sound
// The two rattles ride the chain gust itself (featureFx.chainGust): one per gust pushed, when the board's chains
// start to lean (the gust's landing + its CHAIN_GUST delay, at the turbo's rate), so no gust, no rattle, and a caller
// that holds back the gust while SKIP TO RESULT runs holds back the sound with it. Everything goes out as a plain
// soundOnce, so components/Sound.svelte drops it while skipping and the effects volume and mute apply.
import { CHAIN_SOUND } from './constants';
import { eventEmitter } from './eventEmitter';

/** DEV / probe (window.__manticore.chainSound): every chain sound asked, oldest first, and the clanks refused by the gap */
export const chainSoundLog = { asked: [] as { t: number; name: string; why: string }[], refused: 0 };
const ask = (name: 'sfx_chain_heavy' | 'sfx_chain_light' | 'sfx_chain_light_logo', why: string) => {
	eventEmitter.broadcast({ type: 'soundOnce', name, forcePlay: true });
	if (!import.meta.env.DEV) return;
	chainSoundLog.asked.push({ t: performance.now(), name, why });
	if (chainSoundLog.asked.length > 200) chainSoundLog.asked.splice(0, 100);
};

let lastClankAt = -Infinity;
/** a feature's kick has reached the chains: the heavy clank, unless one sounded under kickMinGapMs ago (REAL ms: at
 *  turbo two swipes come one after the other). Returns whether it was asked. */
export const kickClank = (why: string): boolean => {
	const now = performance.now();
	if (now - lastClankAt < CHAIN_SOUND.kickMinGapMs) {
		chainSoundLog.refused += 1;
		return false;
	}
	lastClankAt = now;
	ask('sfx_chain_heavy', why);
	return true;
};

/** a gust has been pushed: its rattle when the board's chains start to lean, `startAt` (performance.now() ms) */
export const gustRattle = (kind: 'plaque' | 'logo' | 'tier', startAt: number): void => {
	const name = CHAIN_SOUND.gust[kind];
	if (!name) return;
	setTimeout(() => ask(name, kind), Math.max(0, startAt - performance.now()));
};
