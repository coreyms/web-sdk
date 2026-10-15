// THE MAX WIN SCREEN'S CLOCK (Corey 2026-10-15; constants MAX_WIN, components/MaxWinCinematic.svelte).
//
// Everything on that screen is timed off ONE instant: the MAX tier landing on the plaque's count (the wrap up of a
// capped feature, or the base game's safety net win plaque; components/StingerPlaque.svelte calls maxWinTierLanded),
// which is also the instant bgm_maxwin starts. The press gate stays shut until the track has actually ENDED, or the
// fallback timer gives up on that signal (a muted or blocked audio context must never park the round).
//
// ARMED BY THE BOOK: game/bookEventHandlerMap.ts's `wincap` arms it with the book's own wincap.amount, so only a capped
// round's MAX landing starts it (a MAX tier read off an amount alone never does). Nothing here computes an outcome:
// `payout` is that book number, passed in.
//
// THE SCREEN'S OWN TYPE (tools/build_maxwin_assets.py, static/assets/ui/maxwin): 1.1 MB (full tier) / 0.4 MB (phone
// tier), 23 / 6 MB on the GPU, so it is NOT in any preload: maxWinPrefetch() asks for it as soon as a round whose book
// holds a wincap starts (its first reveal; the whole round plays before the screen), and maxWinRelease() lets it go
// once the screen is over. A plain stamped URL (never a blob:).
import * as PIXI from 'pixi.js';
import { stateBet } from 'state-shared';

import { eventEmitter } from './eventEmitter';
import { sound } from './sound';
import { MAX_WIN } from './constants';
import { stamp } from './assets';
import { PHONE_TIER } from './deviceTier';

export type MaxWinPhase = 'idle' | 'plate' | 'dim' | 'unleashed' | 'slam' | 'gate' | 'out';

export const maxWinState = $state({
	phase: 'idle' as MaxWinPhase,
	/** the book's wincap.amount once `wincap` has armed the screen this round; 0 = not armed */
	armed: 0,
	/** performance.now() of the MAX landing / track start; 0 while idle */
	startedAt: 0,
	/** the book's payout (wincap.amount): the only number the screen reads out */
	payout: 0,
	/** the track's own 'ended' arrived (as opposed to the fallback timer) */
	musicEnded: false,
	/** how the gate opened, for the probe: 'ended' | 'timeout' | '' */
	gateBy: '' as '' | 'ended' | 'timeout',
	/** how the clock started: 'tier' (the MAX landing on the plaque) or 'event' (the handler's safety net) */
	startedBy: '' as '' | 'tier' | 'event',
	/** live count of medallions on screen (MedallionRain reports it, the DEV probe reads it) */
	medallions: 0,
});

/** ms since the MAX tier landed; 0 before it has */
export const maxWinElapsed = () => (maxWinState.startedAt === 0 ? 0 : performance.now() - maxWinState.startedAt);

// ---- the type atlas ------------------------------------------------------------------------------------------
const ATLAS_URL = PHONE_TIER ? stamp(new URL('../../assets/ui/maxwin/maxwin-half.json', import.meta.url).href) : stamp(new URL('../../assets/ui/maxwin/maxwin.json', import.meta.url).href);
let atlasLoad: Promise<PIXI.Spritesheet | null> | null = null;
/** the loaded atlas (null until it is in) */
export const maxWinArt: { sheet: PIXI.Spritesheet | null; requestedAt: number; loadedAt: number } = { sheet: null, requestedAt: 0, loadedAt: 0 };

/** start fetching the screen's type, once (a no-op while it is in or on its way) */
export const maxWinPrefetch = (): Promise<PIXI.Spritesheet | null> => {
	if (typeof window === 'undefined') return Promise.resolve(null);
	if (atlasLoad) return atlasLoad;
	maxWinArt.requestedAt = performance.now();
	atlasLoad = (PIXI.Assets.load(ATLAS_URL) as Promise<PIXI.Spritesheet>)
		.then((sheet) => {
			maxWinArt.sheet = sheet;
			maxWinArt.loadedAt = performance.now();
			return sheet;
		})
		.catch((error) => {
			console.error('[manticore] the max win screen type failed to load', error);
			atlasLoad = null;
			return null;
		});
	return atlasLoad;
};

/** let the atlas go (the screen has handed every sprite back to Texture.EMPTY first) */
export const maxWinRelease = () => {
	if (!maxWinArt.sheet) return;
	maxWinArt.sheet = null;
	atlasLoad = null;
	void PIXI.Assets.unload(ATLAS_URL).catch(() => {});
};

// ---- the clock ------------------------------------------------------------------------------------------------
let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
let unsubscribe: (() => void) | undefined;
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

/** `wincap` arms the screen with the book's own amount (and makes sure its type is on its way) */
export const maxWinArm = (payout: number) => {
	maxWinState.armed = payout;
	void maxWinPrefetch();
};

/**
 * Start the track and the clock (idempotent). bgm_maxwin is authored as a loop in music.json, so it is started with an
 * explicit `loop: false`: a looping media element never fires 'ended', and the gate depends on that event.
 */
export const maxWinBegin = (payout: number, by: 'tier' | 'event') => {
	if (maxWinState.startedAt !== 0) return;
	maxWinState.startedAt = performance.now();
	maxWinState.payout = payout;
	maxWinState.phase = 'plate';
	maxWinState.musicEnded = false;
	maxWinState.gateBy = '';
	maxWinState.startedBy = by;
	// the big win duck (bookEventHandlerMap winLevelSoundsPlay) must not sit on the max track
	eventEmitter.broadcast({ type: 'soundDuck', level: 1 });
	eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_maxwin', loop: false });
	endPromise = new Promise<void>((resolve) => (endResolve = resolve));
	unsubscribe = sound.onMusicEnded((name) => {
		if (name === 'bgm_maxwin') settleEnd('ended');
	});
	fallbackTimer = setTimeout(() => settleEnd('timeout'), MAX_WIN.trackMs + MAX_WIN.gatePad);
};

/** the plaque's count has just landed on its top tier (components/StingerPlaque.svelte): an armed round starts here */
export const maxWinTierLanded = () => {
	if (maxWinState.armed > 0) maxWinBegin(maxWinState.armed, 'tier');
};

/** waits for the track to end (or for the fallback). Safe to await more than once. */
export const maxWinTrackEnded = async () => {
	if (maxWinState.gateBy) return;
	await endPromise;
};

/** the round is over: disarm and clear the clock */
export const maxWinReset = () => {
	if (fallbackTimer) clearTimeout(fallbackTimer);
	fallbackTimer = undefined;
	unsubscribe?.();
	unsubscribe = undefined;
	endResolve?.();
	endResolve = undefined;
	endPromise = undefined;
	maxWinState.phase = 'idle';
	maxWinState.armed = 0;
	maxWinState.startedAt = 0;
	maxWinState.payout = 0;
	maxWinState.musicEnded = false;
	maxWinState.gateBy = '';
	maxWinState.startedBy = '';
	maxWinState.medallions = 0;
};

/** DEV probe surface on the shared __manticore object (house rule: no new globals); `log` is the screen's own */
export const installMaxWinProbe = (extra: () => Record<string, unknown>) => {
	if (!import.meta.env.DEV || typeof window === 'undefined') return;
	const m = ((window as unknown as { __manticore?: Record<string, unknown> }).__manticore ??= {});
	m.maxWin = () => ({
		phase: maxWinState.phase,
		armed: maxWinState.armed,
		t: Math.round(maxWinElapsed()),
		medallions: maxWinState.medallions,
		gateOpen: maxWinState.phase === 'gate',
		musicEnded: maxWinState.musicEnded,
		gateBy: maxWinState.gateBy,
		startedBy: maxWinState.startedBy,
		payout: maxWinState.payout,
		hudWin: stateBet.winBookEventAmount,
		art: { requestedAt: Math.round(maxWinArt.requestedAt), loadedAt: Math.round(maxWinArt.loadedAt), loaded: !!maxWinArt.sheet, url: ATLAS_URL },
		...extra(),
	});
};
