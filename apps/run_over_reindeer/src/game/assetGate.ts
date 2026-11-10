// Deferred-asset gate (the house pattern). game/assets.ts may split the manifest into a preload phase that gates
// PRESS ANYWHERE and a deferred phase that keeps loading behind the game (pixi-svelte's AssetsLoader runs both, back
// to back). Anything that draws a deferred key awaits this first, so a slow connection delays that beat by the
// rest of the download instead of drawing an empty texture.
//
// In the first pass every asset is preloaded, so this resolves as soon as the preload is in. It stays because the
// feature art (the column Wild characters, the crash cloud) will be deferred, and the replay card already waits on it.
let resolveLoaded: () => void = () => {};
const loaded = new Promise<void>((resolve) => (resolveLoaded = resolve));
let isLoaded = false;

/** components/Game.svelte calls this when stateApp.loaded flips */
export const markAssetsLoaded = () => {
	isLoaded = true;
	resolveLoaded();
};

/** Resolves once every deferred asset is in (or after `timeoutMs`, so a dead download never wedges a round). */
export const awaitDeferredAssets = (timeoutMs = 30_000): Promise<void> =>
	isLoaded ? Promise.resolve() : Promise.race([loaded, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
