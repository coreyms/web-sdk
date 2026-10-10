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
//   night   the courtyard scene's night backdrop and foreground
//                                               -> components/Background.svelte crossfades a waiting Super / Epic
//   logo    the canvas logo's atlas + its tracks (desktop tier only; no keys on the phone tier)
//                                               -> components/Logo.svelte takes over from the still
//           NORMALLY ALREADY IN: loadLogoEarly() below starts it when the preload ends, beside the audio
//   labels  the cluster label caps that were not preloaded -> ClusterLabels picks the nearest loaded cap
//   drop    the symbols' drop sheets            -> BoardCells picks them up per symbol
//   idle    the symbols' idle loops             -> BoardCells adds them to the sheets it already has
// The shared loader then runs its batch as before: Pixi's cache answers at once for everything loaded here,
// so it only downloads what is left (the other layouts' art) and sets stateApp.loaded. A file that fails
// here is simply left to that batch, which has the retries and the failure screen.
import * as PIXI from 'pixi.js';

import assets, { DEFERRED_ORDER, LOGO_DATA_URLS, PLACEHOLDER_LATE, PLAQUE_ATLAS_KEYS, SCENE_AT_BOOT, SCENE_KEYS, SCENE_LATE, STINGER_DATA_URLS, UNREACHABLE_ASSETS } from './assets';
import { markPlaqueAssetsReady } from './assetGate';
import { loadLogoData } from './logo/data';
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
	if (!keys.length) return; // the logo group on the phone tier
	const log = (deferredLog.groups[name] = { start: performance.now(), end: 0, keys: keys.length, failed: 0 });
	const data = name === 'plaque' ? loadStingerData(STINGER_DATA_URLS) : name === 'logo' ? loadLogoData(LOGO_DATA_URLS) : null;
	const extra = data ? data.then(() => true, () => false) : Promise.resolve(true);
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

// THE LOGO DOES NOT WAIT FOR THE DEFERRED PHASE (desktop tier). Its entrance plays when the game first shows,
// and the deferred phase only starts once the audio is in, which is also the moment the landing screen can be
// pressed: a quick press beat the logo every time, even on a local server. So its one atlas and two data files
// (0.35 MB) start when the Pixi preload ends (components/Game.svelte), beside the audio's 1.1 MB. It gates
// nothing: if the press still comes first the chrome's still stands in and the canvas logo takes over without
// an entrance (components/Logo.svelte). The ordered phase below then finds the group done.
let logoEarly: Promise<void> | null = null;
export const loadLogoEarly = (app: AppState): Promise<void> => {
	const keys = DEFERRED_ORDER.find((g) => g.name === 'logo')?.keys ?? [];
	logoEarly ??= loadGroup(app, 'logo', keys).catch(() => {});
	return logoEarly;
};
const runGroup = (app: AppState, g: (typeof DEFERRED_ORDER)[number]) => (g.name === 'logo' && logoEarly ? logoEarly : loadGroup(app, g.name, g.keys));

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
		if (mode === 'parallel') await Promise.all(DEFERRED_ORDER.map((g) => runGroup(app, g)));
		else for (const g of DEFERRED_ORDER) await runGroup(app, g);
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

// ---- the OTHER layout's courtyard scene (game/assets.ts SCENE_LATE) ------------------------------------------
// The game registers only the scene of the layout it booted in (16:9 for landscape and phone sideways, 9:16 for
// portrait) and requests none of the other's files. The first time the layout becomes one of the other scene's,
// components/Background.svelte calls this: the day set (published together: the scene builds from all of it),
// then the night set. Once; a file that fails leaves the placeholder crop standing.
let sceneLate: Promise<void> | null = null;
export const loadSceneLate = (app: AppState): Promise<void> => {
	const group = async (name: string, keys: readonly string[]) => {
		const log = (deferredLog.groups[name] = { start: performance.now(), end: 0, keys: keys.length, failed: 0 });
		const done = await Promise.all(keys.map((key) => loadOne(key, SCENE_LATE[key])));
		log.failed = done.filter((textures) => !textures).length;
		if (!log.failed) app.loadedAssets = Object.assign({ ...app.loadedAssets }, ...(done as Textures[]));
		log.end = performance.now();
	};
	const late = SCENE_KEYS[SCENE_AT_BOOT === 'landscape' ? 'portrait' : 'landscape'];
	sceneLate ??= group('sceneDay', late.day).then(() => group('sceneNight', late.night)).catch(() => {});
	return sceneLate;
};

/** the placeholder crop of a layout the game did not boot in (game/assets.ts PLACEHOLDER_LATE): the fallback that
 *  stands in while that layout's scene is on its way. Once per layout; a failure leaves the flat sky colour. */
const placeholderLate: Record<string, Promise<void>> = {};
export const loadPlaceholderLate = (app: AppState, kind: string): Promise<void> => {
	const key = `bg_base_${kind}`;
	if (!PLACEHOLDER_LATE[key]) return Promise.resolve();
	placeholderLate[key] ??= loadOne(key, PLACEHOLDER_LATE[key]).then((textures) => {
		if (textures) app.loadedAssets = { ...app.loadedAssets, ...textures };
	});
	return placeholderLate[key];
};

if (import.meta.env.DEV && typeof window !== 'undefined') {
	// house rule: extend __manticore, never a new global (tools/manticore/defer_probe.js reads it)
	((window as any).__manticore ??= {}).deferred = () => JSON.parse(JSON.stringify(deferredLog));
}
