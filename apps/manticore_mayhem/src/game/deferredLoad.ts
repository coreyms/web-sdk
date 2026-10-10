// THE DEFERRED PHASE, IN ORDER (2026-10-09; docs/device-quality-plan-v2-review.md finding S2).
//
// pixi-svelte's AssetsLoader (a shared package, left alone) loads every `preload: false` asset in ONE
// Promise.all and publishes the textures only when the last file is in. So the win plaque's 1.2 MB sat
// behind 4 to 14 MB of symbol sheets: at 200 KB/s a Big Win in the first 45 s (phone) or 105 s (desktop)
// showed the dim for up to 30 s and then the plain screen. This is a likely cause of "Big Wins on regular
// spins showed no plaque" on the owner's iPhone.
//
// Here the app runs the important groups ITSELF, before the shared loader's batch, from the hook the loader
// already offers (stateApp.beforeDeferred, components/Game.svelte): game/assets.ts DEFERRED_ORDER, one
// group after another (sequential: on a slow link the plaque gets the whole pipe; measured against starting
// them together by tools/manticore/defer_probe.js, numbers in tools/manticore/README.md), each PUBLISHED
// into stateApp.loadedAssets the moment its own files are in:
//   plaque  the five stinger atlases (all or nothing) + stinger.json + the motion tracks
//                                               -> assetGate.markPlaqueAssetsReady()
//   labels  the cluster label caps that were not preloaded -> ClusterLabels picks the nearest loaded cap
//   drop    the symbols' drop sheets            -> BoardCells picks them up per symbol
//   idle    the symbols' idle loops             -> BoardCells adds them to the sheets it already has
// The shared loader then runs its batch as before: Pixi's cache answers at once for everything loaded here,
// so it only downloads what is left (the other layouts' art) and sets stateApp.loaded. A file that fails
// here is simply left to that batch, which has the retries and the failure screen.
import * as PIXI from 'pixi.js';

import assets, { DEFERRED_ORDER, PLAQUE_ATLAS_KEYS, STINGER_DATA_URLS, UNREACHABLE_ASSETS } from './assets';
import { markPlaqueAssetsReady } from './assetGate';
import { loadStingerData } from './stinger/data';
import { STAGING_TOOLS, perfMark } from './staging';

type Entry = { type: string; src: unknown };
type Textures = Record<string, unknown>;
type AppState = { loadedAssets: Textures };

/** DEV / probe / staging readout: when each group began and was published (performance.now(), 0 = not yet) */
export const deferredLog = {
	mode: 'sequential' as 'sequential' | 'parallel' | 'legacy',
	start: 0,
	groups: {} as Record<string, { start: number; end: number; keys: number; failed: number }>,
	unreachable: Object.keys(UNREACHABLE_ASSETS),
	fetchedUnreachable: 0,
};

/** the default: one group at a time. `?defer=parallel|legacy` (DEV only) are the probe's comparisons:
 *  every group started together, and the old single batch. */
const modeFor = (): 'sequential' | 'parallel' | 'legacy' => {
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		const q = new URLSearchParams(window.location.search).get('defer');
		if (q === 'parallel' || q === 'legacy' || q === 'sequential') return q;
	}
	return 'sequential';
};

/** one asset, as the shared loader would hand it over (sprite: { key: texture }, sprites: the sheet's
 *  frames); undefined when the download failed or the type is not ours to process */
const loadOne = async (key: string, entry: Entry): Promise<Textures | undefined> => {
	if (typeof entry.src !== 'string' || (entry.type !== 'sprite' && entry.type !== 'sprites')) return undefined;
	try {
		const raw = await PIXI.Assets.load(entry.src);
		return entry.type === 'sprite' ? { [key]: raw } : ((raw as { textures: Textures }).textures ?? undefined);
	} catch {
		return undefined;
	}
};

const loadGroup = async (app: AppState, name: string, keys: string[]) => {
	const table = assets as unknown as Record<string, Entry>;
	const log = (deferredLog.groups[name] = { start: performance.now(), end: 0, keys: keys.length, failed: 0 });
	const extra = name === 'plaque' ? loadStingerData(STINGER_DATA_URLS).then(() => true, () => false) : Promise.resolve(true);
	const done = await Promise.all(keys.map(async (key) => [key, await loadOne(key, table[key])] as const));
	const dataIn = await extra;
	// the plaque's five atlases publish together or not at all: its scene builds from all of them
	const plaqueWhole = name !== 'plaque' || (dataIn && PLAQUE_ATLAS_KEYS.every((key) => done.some(([k, v]) => k === key && v)));
	const loaded: Textures = {};
	for (const [key, textures] of done) {
		if (!textures) {
			log.failed += 1;
			continue;
		}
		if (!plaqueWhole && PLAQUE_ATLAS_KEYS.includes(key)) continue;
		Object.assign(loaded, textures);
	}
	app.loadedAssets = { ...app.loadedAssets, ...loaded };
	log.end = performance.now();
	if (STAGING_TOOLS) perfMark(`load:${name}`);
	if (name === 'plaque' && plaqueWhole) {
		// one task later: StingerPlaque builds its scene in an effect on loadedAssets, and the screens that
		// wait on the gate ask `flow.ready()` the moment it resolves
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
		markPlaqueAssetsReady();
	}
};

/** the deferred phase's ordered part. Resolves when the last group is published; never rejects. */
export const loadDeferredInOrder = async (app: AppState): Promise<void> => {
	const mode = modeFor();
	deferredLog.mode = mode;
	// DEV, the probe only (`?deferhold=1`): the whole deferred phase, the shared loader's batch included,
	// waits for __manticore.deferredRelease(), so the probe can put the slow network profile on first
	if (import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('deferhold') === '1') {
		await new Promise<void>((resolve) => ((window as any).__manticore.deferredRelease = () => resolve()));
	}
	deferredLog.start = performance.now();
	if (mode === 'legacy') return;
	try {
		if (mode === 'parallel') await Promise.all(DEFERRED_ORDER.map((g) => loadGroup(app, g.name, g.keys)));
		else for (const g of DEFERRED_ORDER) await loadGroup(app, g.name, g.keys);
	} catch {
		/* whatever is missing is left to the shared loader's batch */
	}
	watchUnreachable(app);
};

// ---- the safety net for UNREACHABLE_ASSETS (game/assets.ts) -----------------------------------------
// A phone never opens the desktop landscape master, so its art is not registered there. If the window
// ever does become that master (a browser's "desktop site" mode reports a wide virtual viewport), fetch
// the art then, once. Until it lands the board shows its plain fallback, exactly as before any art loads.
const LANDSCAPE_RATIO = 1.3;
const LANDSCAPE_SHORT_SIDE = 480;
const watchUnreachable = (app: AppState) => {
	if (typeof window === 'undefined' || !Object.keys(UNREACHABLE_ASSETS).length) return;
	let fetched = false;
	const check = () => {
		const w = window.innerWidth || 1;
		const h = window.innerHeight || 1;
		if (fetched || w / h < LANDSCAPE_RATIO || Math.min(w, h) <= LANDSCAPE_SHORT_SIDE) return;
		fetched = true;
		window.removeEventListener('resize', check);
		void Promise.all(Object.entries(UNREACHABLE_ASSETS).map(async ([key, entry]) => loadOne(key, entry))).then((list) => {
			const loaded: Textures = {};
			for (const textures of list) if (textures) Object.assign(loaded, textures);
			app.loadedAssets = { ...app.loadedAssets, ...loaded };
			deferredLog.fetchedUnreachable = performance.now();
		});
	};
	window.addEventListener('resize', check);
	check();
};

if (import.meta.env.DEV && typeof window !== 'undefined') {
	// house rule: extend __manticore, never a new global (tools/manticore/defer_probe.js reads it)
	((window as any).__manticore ??= {}).deferred = () => JSON.parse(JSON.stringify(deferredLog));
}
