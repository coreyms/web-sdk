// Deferred-asset gate. game/assets.ts splits the manifest into a landing-gated phase and a deferred
// phase (pixi-svelte AssetsLoader loads both, back to back). Anything that draws a deferred key —
// the steel door, bonus headers and headshots, the gold alphabet, the big-win titles, the super
// and feast backdrops — awaits this first, so a slow connection delays the beat by the remaining
// download instead of drawing an empty texture (pixi-svelte Sprite falls back to Texture.EMPTY
// and logs an error). Game.svelte resolves it from stateApp.loaded.
/** how long a plaque screen waits for its atlases before it falls back to the plain screen */
export const PLAQUE_WAIT_MS = 30_000;

let resolveLoaded: () => void = () => {};
const loaded = new Promise<void>((resolve) => (resolveLoaded = resolve));
let isLoaded = false;

export const markAssetsLoaded = () => {
	isLoaded = true;
	resolveLoaded();
	// everything is in, so the plaque's own set is too (the path a failed early group takes)
	markPlaqueAssetsReady();
};

// THE WIN PLAQUE'S OWN GATE (2026-10-09). The deferred phase used to be one batch that published only when
// every file was in, so a Big Win or a feature intro waited behind the symbol sheets (about 45 s on a
// phone and 105 s on a desktop at 200 KB/s) and gave up after 30 s. game/deferredLoad.ts now loads the
// plaque's atlases FIRST and publishes them on their own; this resolves at that moment. The plaque's
// callers (Win, ModePlaque, FreeSpinOutro) wait on this, never on the whole phase.
let resolvePlaque: () => void = () => {};
const plaqueReady = new Promise<void>((resolve) => (resolvePlaque = resolve));
let isPlaqueReady = false;
/** performance.now() the plaque's atlases were published (0 = not yet): DEV / staging readout only */
export const plaqueGate = { readyAt: 0 };

export const markPlaqueAssetsReady = () => {
	if (isPlaqueReady) return;
	isPlaqueReady = true;
	plaqueGate.readyAt = typeof performance !== 'undefined' ? performance.now() : 1;
	resolvePlaque();
};

/** HOW LONG A PLAQUE SCREEN AT ITS BEAT WAITS (a win, a feature's intro, its wrap up; 2026-11-26). Corey, a replay on Slow
 *  4G: "waiting a long time for the stinger to load but eventually got the fallback": the board sat dimmed with nothing
 *  on it for up to PLAQUE_WAIT_MS. The 30 s wait dates from before THE GATE (2026-10-09, when the plaque's set rode behind
 *  the symbol sheets); since first-minute plan D a normal session's first round waits for the gate, the plaque's set
 *  first (PRESS ANYWHERE has no cap, constants LOAD_GATE), and a resumed round waits for the set itself before it starts
 *  (components/ResumeBet.svelte keeps PLAQUE_WAIT_MS). So a beat finds the set missing only where the round started
 *  without it: a replay whose START cap ran out on a slow link (constants REPLAY_LOAD), or a gate past its 90 s stall.
 *  There the plain screen is the honest answer, at once, not after a dimmed half minute. The plaque screens are its
 *  only users; nothing is fetched differently. */
export const PLAQUE_BEAT_WAIT_MS = 1_000;

/** Resolves once the plaque's atlases are in (or after `timeoutMs`: the caller then shows its plain screen). */
export const awaitPlaqueAssets = (timeoutMs = PLAQUE_WAIT_MS): Promise<void> =>
	isPlaqueReady ? Promise.resolve() : Promise.race([plaqueReady, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);

/** Resolves once every deferred asset is in (or after `timeoutMs`, so a dead download never wedges a round). */
export const awaitDeferredAssets = (timeoutMs = 30_000): Promise<void> =>
	isLoaded ? Promise.resolve() : Promise.race([loaded, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
