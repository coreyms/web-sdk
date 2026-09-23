// Deferred-asset gate. game/assets.ts splits the manifest into a landing-gated phase and a deferred
// phase (pixi-svelte AssetsLoader loads both, back to back). Anything that draws a deferred key —
// the steel door, bonus headers and headshots, the gold alphabet, the big-win titles, the super
// and feast backdrops — awaits this first, so a slow connection delays the beat by the remaining
// download instead of drawing an empty texture (pixi-svelte Sprite falls back to Texture.EMPTY
// and logs an error). Game.svelte resolves it from stateApp.loaded.
let resolveLoaded: () => void = () => {};
const loaded = new Promise<void>((resolve) => (resolveLoaded = resolve));
let isLoaded = false;

export const markAssetsLoaded = () => {
	isLoaded = true;
	resolveLoaded();
};

/** Resolves once every deferred asset is in (or after `timeoutMs`, so a dead download never wedges a round). */
export const awaitDeferredAssets = (timeoutMs = 30_000): Promise<void> =>
	isLoaded ? Promise.resolve() : Promise.race([loaded, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
