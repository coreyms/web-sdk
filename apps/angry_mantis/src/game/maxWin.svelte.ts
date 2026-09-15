// The max-win screen's clock (Corey 2026-09-15).
//
// Everything on that screen is timed off ONE instant: the moment the MAX WIN stinger plate lands
// at the top of the spin's count-up ladder (components/WinStinger.svelte), which is also the
// moment bgm_maxwin starts. `begin()` stamps it; MaxWinCinematic.svelte reads `elapsed()` and runs
// its stages at the MAX_WIN offsets, and the press gate stays shut until the track has actually
// ENDED (or the fallback timer gives up on the signal — a muted or blocked audio context must
// never park the round).
//
// No outcome is computed here. `payout` is the book's own maxWinCinematic.payout, passed in.
import { stateBet } from 'state-shared';

import { eventEmitter } from './eventEmitter';
import { sound } from './sound';
import { MAX_WIN } from './constants';

export type MaxWinPhase = 'idle' | 'plate' | 'dim' | 'slam' | 'gate';

export const maxWinState = $state({
	phase: 'idle' as MaxWinPhase,
	/** performance.now() of the MAX plate landing / track start; 0 while idle */
	startedAt: 0,
	/** the book's payout (maxWinCinematic.payout) — the only number the screen reads out */
	payout: 0,
	/** the track's own 'ended' arrived (as opposed to the fallback timer) */
	musicEnded: false,
	/** how the gate opened, for the probe: 'ended' | 'timeout' | '' */
	gateBy: '' as '' | 'ended' | 'timeout',
	/** live count of tray sprites on screen (TrayRain reports it, DEV probe reads it) */
	trays: 0,
});

/** ms since the MAX plate landed; 0 before it has. */
export const maxWinElapsed = () =>
	maxWinState.startedAt === 0 ? 0 : performance.now() - maxWinState.startedAt;

let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
let unsubscribe: (() => void) | undefined;
/** resolves when the track ends (or the fallback fires) */
let endResolve: (() => void) | undefined;
let endPromise: Promise<void> | undefined;

const settleEnd = (by: 'ended' | 'timeout') => {
	if (maxWinState.gateBy) return;
	maxWinState.gateBy = by;
	if (by === 'ended') maxWinState.musicEnded = true;
	if (fallbackTimer) clearTimeout(fallbackTimer);
	fallbackTimer = undefined;
	unsubscribe?.();
	unsubscribe = undefined;
	endResolve?.();
};

/**
 * The MAX plate has landed: start the track and the clock.
 *
 * bgm_maxwin is authored as a loop in music.json, so it is started with an explicit
 * `loop: false` — a looping media element never fires 'ended', and the gate depends on that event
 * (utils-sound/createMusic.svelte.ts wires it for exactly this case).
 */
export const maxWinBegin = (payout: number) => {
	if (maxWinState.startedAt !== 0) return;
	maxWinState.startedAt = performance.now();
	maxWinState.payout = payout;
	maxWinState.phase = 'plate';
	maxWinState.musicEnded = false;
	maxWinState.gateBy = '';
	// the big-win duck (bookEventHandlerMap winLevelSoundsPlay) must not sit on the max track
	eventEmitter.broadcast({ type: 'soundDuck', level: 1 });
	eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_maxwin', loop: false });

	endPromise = new Promise<void>((resolve) => (endResolve = resolve));
	unsubscribe = sound.onMusicEnded((name) => {
		if (name === 'bgm_maxwin') settleEnd('ended');
	});
	// Fallback: headless/muted/autoplay-blocked contexts never deliver 'ended'. Anchored to the
	// track start so the wait is the same length either way.
	fallbackTimer = setTimeout(() => settleEnd('timeout'), MAX_WIN.trackMs + MAX_WIN.gatePad);
};

/** Waits for the track to end (or for the fallback). Safe to await more than once. */
export const maxWinTrackEnded = async () => {
	if (maxWinState.gateBy) return;
	await endPromise;
};

export const maxWinReset = () => {
	if (fallbackTimer) clearTimeout(fallbackTimer);
	fallbackTimer = undefined;
	unsubscribe?.();
	unsubscribe = undefined;
	endResolve?.();
	endResolve = undefined;
	endPromise = undefined;
	maxWinState.phase = 'idle';
	maxWinState.startedAt = 0;
	maxWinState.payout = 0;
	maxWinState.musicEnded = false;
	maxWinState.gateBy = '';
	maxWinState.trays = 0;
};

/** DEV probe surface, hung off the shared __angryMantis object (house rule: no new globals). */
export const installMaxWinProbe = () => {
	if (!import.meta.env.DEV || typeof window === 'undefined') return;
	const am = ((window as unknown as { __angryMantis?: Record<string, unknown> }).__angryMantis ??= {});
	am.maxWin = () => ({
		phase: maxWinState.phase,
		t: Math.round(maxWinElapsed()),
		trays: maxWinState.trays,
		gateOpen: maxWinState.phase === 'gate',
		musicEnded: maxWinState.musicEnded,
		gateBy: maxWinState.gateBy,
		payout: maxWinState.payout,
		hudWin: stateBet.winBookEventAmount,
	});
};
