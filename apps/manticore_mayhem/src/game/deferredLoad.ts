// THE GATE AND THE DEFERRED PHASE, IN ORDER (2026-10-09, docs/device-quality-plan-v2-review.md finding S2; the gate since
// first-minute plan D, Corey 2026-10-16 17:21 "Yes D", constants LOAD_GATE).
//
// pixi-svelte's AssetsLoader (a shared package, left alone) loads every `preload: false` asset in ONE
// Promise.all and publishes the textures only when the last file is in. So the win plaque's 1.2 MB sat
// behind 4 to 14 MB of symbol sheets. Here the app runs the important groups ITSELF, each PUBLISHED into
// stateApp.loadedAssets the moment its own files are in, in two parts:
//
// THE GATE (loadGate; game/assets.ts GATE_ORDER), asked for by components/Game.svelte the moment the Pixi preload is in;
// it starts when the audio (game/sound.ts) is in (LOAD_GATE.besideAudioFiles: the plan's "beside the audio" measured
// worse), one group after another; PRESS ANYWHERE waits for it (ui/LandingScreen.svelte, up to LOAD_GATE.capMs after the
// audio is ready) and the loading bar counts its bytes with the audio's (game/loadGate.svelte.ts):
//   plaque  the five stinger atlases (all or nothing) + stinger.json + the motion tracks -> assetGate.markPlaqueAssetsReady()
//   drop    the symbols' drop sheets            -> BoardCells picks them up per symbol
//   idle    the symbols' idle loops             -> BoardCells adds them to the sheets it already has
// With LOAD_GATE.besideAudioFiles above 0 it starts at once instead, that many of its files on the wire while the audio
// is still loading; once the audio is in, all of a group's files at once.
//
// THE ORDER AFTER IT (loadDeferredInOrder, from the hook the shared loader offers: stateApp.beforeDeferred, which
// components/Game.svelte holds until the gate and the audio are in):
//   creatureIdle   THE CREATURE's idle sheet (game/creatureLoad.ts; not in game/assets.ts: one look is resident and the
//           shared loader would fetch all three): the look of the mode the game is in. He stands there from the first
//           frame as his STILL (game/creature.ts setStill) and starts breathing when this lands
//   creatureActs   his attacks (swipe, roar, the sting run) and the glow; BESIDE the scene groups below when
//           LOAD_GATE.sceneBesideAttacks (his sheets go one at a time, each decoded and uploaded before the next is asked
//           for, and the scene's files fill the pipe in those gaps), else strictly before them
//   scatter (the cheaper variant only), night, frameNight, flameSuper, flameEpic, logo (fallback), labels   game/assets.ts
//           DEFERRED_ORDER, one after another
//   creatureAlts   his snarl and growl, held until the above are in (constants CREATURE.restHeldAfter)
// The shared loader then runs its batch as before: Pixi's cache answers at once for everything loaded here,
// so it only downloads what is left (the other layouts' art) and sets stateApp.loaded. A file that fails
// here is simply left to that batch, which has the retries and the failure screen.
//   armoury   LAST, once stateApp.loaded is set (components/Game.svelte): THE ARMOURY's menu core, the feature menu's
//           small HTML pictures (game/armouryLoad.ts; logged here as deferredLog.groups.armoury). Not Pixi assets.
//           The symbol pay popup's ten tile pictures (components/SymbolPopup.svelte) are asked for at that same moment.
// The canvas logo (desktop tier) is not in either part: loadLogoEarly starts it when the preload ends, beside the audio.
import * as PIXI from 'pixi.js';

import assets, { DEFERRED_ORDER, FRAME_NIGHT_LATE, GATE_ORDER, LOGO_DATA_URLS, PLACEHOLDER_LATE, PLAQUE_ATLAS_KEYS, SCENE_AT_BOOT, SCENE_KEYS, SCENE_LATE, STINGER_DATA_URLS, UNREACHABLE_ASSETS, gateFileBytes } from './assets';
import { fileBytes } from './assetStamp';
import { markPlaqueAssetsReady } from './assetGate';
import { loadCreatureBoot, releaseCreatureRest } from './creatureLoad';
import { loadGate as gateState, markGateSettled } from './loadGate.svelte';
import { loadLogoData } from './logo/data';
import { loadStingerData } from './stinger/data';
import { STAGING_TOOLS, perfMark } from './staging';
import { LOAD_GATE } from './constants';

type Entry = { type: string; src: unknown };
type Textures = Record<string, unknown>;
type AppState = { loadedAssets: Textures };
type Group = { name: string; keys: string[] };

/** DEV / probe / staging readout: when each group began and was published (performance.now(), 0 = not yet) */
export const deferredLog = {
	mode: 'sequential' as 'sequential' | 'parallel' | 'legacy',
	start: 0,
	/** performance.now() the gate started and settled (0: not yet; both stay 0 in the probe's `?defer=legacy`) */
	gate: { start: 0, end: 0 },
	groups: {} as Record<string, { start: number; end: number; keys: number; failed: number }>,
	unreachable: Object.keys(UNREACHABLE_ASSETS),
	fetchedUnreachable: 0,
};

/** the default: the gate once the audio is in, then the order above. `?defer=parallel|legacy` (DEV only) are the probe's
 *  comparisons: every group (the gate's too) started together once the audio is in, and the old single batch (no gate) */
const modeFor = (): 'sequential' | 'parallel' | 'legacy' => {
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		const q = new URLSearchParams(window.location.search).get('defer');
		if (q === 'parallel' || q === 'legacy' || q === 'sequential') return q;
	}
	return 'sequential';
};

/** DEV, the probe only (`?deferhold=1`): the gate AND the whole deferred phase, the shared loader's batch included, wait
 *  for __manticore.deferredRelease(), so the probe can put the slow network profile on first. (PRESS ANYWHERE then shows
 *  at the gate's cap.) */
let held: Promise<void> | null = null;
const deferHold = (): Promise<void> => {
	if (!(import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('deferhold') === '1')) return Promise.resolve();
	held ??= new Promise<void>((resolve) => ((window as any).__manticore.deferredRelease = () => resolve()));
	return held;
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

/** how often a group whose files are held by its limit looks again whether the limit has risen (ms) */
const LIMIT_POLL_MS = 100;
/** `work` for every key, at most limit() at a time (asked again on every finish and every LIMIT_POLL_MS: it may rise) */
const eachLimited = <T>(keys: string[], limit: () => number, work: (key: string) => Promise<T>): Promise<T[]> =>
	new Promise((resolve) => {
		const out: T[] = new Array(keys.length);
		let next = 0;
		let active = 0;
		let done = 0;
		let timer: ReturnType<typeof setTimeout> | null = null;
		const pump = () => {
			while (next < keys.length && active < limit()) {
				const i = next++;
				active += 1;
				void work(keys[i]).then((v) => {
					out[i] = v;
					active -= 1;
					done += 1;
					if (done === keys.length) resolve(out);
					else pump();
				});
			}
			if (next < keys.length && !timer) {
				timer = setTimeout(() => {
					timer = null;
					pump();
				}, LIMIT_POLL_MS);
			}
		};
		if (!keys.length) resolve(out);
		else pump();
	});

type GroupOptions = { limit?: () => number; onFile?: (bytes: number, ok: boolean) => void };
const bytesOfUrl = (url: string): number => {
	const m = /\/assets\/([^?#]+)/.exec(url);
	return m ? ((fileBytes as Record<string, number>)[m[1]] ?? 0) : 0;
};

const loadGroup = async (app: AppState, name: string, keys: string[], opts: GroupOptions = {}) => {
	const table = assets as unknown as Record<string, Entry>;
	if (!keys.length) return; // the logo group on the phone tier
	const log = (deferredLog.groups[name] = { start: performance.now(), end: 0, keys: keys.length, failed: 0 });
	const data = name === 'plaque' ? loadStingerData(STINGER_DATA_URLS) : name === 'logo' ? loadLogoData(LOGO_DATA_URLS) : null;
	const extra = data
		? data.then(
				() => {
					if (name === 'plaque') opts.onFile?.(bytesOfUrl(STINGER_DATA_URLS.json) + bytesOfUrl(STINGER_DATA_URLS.bin), true);
					return true;
				},
				() => {
					if (name === 'plaque') opts.onFile?.(bytesOfUrl(STINGER_DATA_URLS.json) + bytesOfUrl(STINGER_DATA_URLS.bin), false);
					return false;
				},
			)
		: Promise.resolve(true);
	const one = async (key: string) => {
		const textures = await loadOne(key, table[key]);
		opts.onFile?.(gateFileBytes(key), !!textures);
		return [key, textures] as const;
	};
	const done = opts.limit ? await eachLimited(keys, opts.limit, one) : await Promise.all(keys.map(one));
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

// ---- THE GATE ------------------------------------------------------------------------------------------------------
/** resolves once `ok()` is true (asked every LIMIT_POLL_MS) */
const until = (ok: () => boolean): Promise<void> =>
	new Promise((resolve) => {
		const look = () => (ok() ? resolve() : setTimeout(look, LIMIT_POLL_MS));
		look();
	});
let gate: Promise<void> | null = null;
/** the gate (see the header): started once, when the Pixi preload is in (components/Game.svelte). `audioReady`: the
 *  audio the landing screen waits on is in (game/sound.ts sound.isReady). Resolves when it has settled; never rejects. */
export const loadGate = (app: AppState, audioReady: () => boolean): Promise<void> => {
	gate ??= (async () => {
		const mode = modeFor();
		// the probe's old single batch has no gate: PRESS waits for the audio alone, as before plan D
		if (mode === 'legacy') return;
		await deferHold();
		// LOAD_GATE.besideAudioFiles 0: the gate starts only once the audio is in
		if (mode !== 'parallel' && LOAD_GATE.besideAudioFiles <= 0) await until(audioReady);
		deferredLog.gate.start = gateState.startedAt = performance.now();
		gateState.files = GATE_ORDER.reduce((n, g) => n + g.keys.length, 0) + 1; // + the plaque's data files
		const onFile = (bytes: number, ok: boolean) => {
			gateState.doneBytes += bytes;
			gateState.filesDone += 1;
			if (!ok) gateState.failed += 1;
		};
		const limit = () => (audioReady() ? Infinity : Math.max(1, LOAD_GATE.besideAudioFiles as number));
		try {
			if (mode === 'parallel') await Promise.all(GATE_ORDER.map((g: Group) => loadGroup(app, g.name, g.keys, { onFile })));
			else for (const g of GATE_ORDER) await loadGroup(app, g.name, g.keys, { limit, onFile });
		} catch {
			/* whatever is missing is left to the shared loader's batch */
		}
	})()
		.catch(() => {})
		.finally(() => {
			deferredLog.gate.end = performance.now();
			markGateSettled();
		});
	return gate;
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
const runGroup = (app: AppState, g: Group): Promise<void> => (g.name === 'logo' && logoEarly ? logoEarly : loadGroup(app, g.name, g.keys));
/** DEV, the probe only (`?creaturehold=1`): his attacks and alternates stay held until __manticore.creatureRestRelease(),
 *  so the probe can ask him for an attack while only his idle sheet is in (game/creatureLoad.ts holds after his idle
 *  group then, not after his attacks) */
const releaseCreature = async () => {
	if (import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('creaturehold') === '1') {
		await new Promise<void>((resolve) => ((window as any).__manticore.creatureRestRelease = () => resolve()));
	}
	await releaseCreatureRest();
};

/** the deferred phase's ordered part (see the header), once the gate and the audio are in. Resolves when the last group
 *  (his alternates) is published; never rejects. */
export const loadDeferredInOrder = async (app: AppState): Promise<void> => {
	const mode = modeFor();
	deferredLog.mode = mode;
	await deferHold();
	deferredLog.start = performance.now();
	if (mode === 'legacy') {
		// (the probe's old single batch has no place for him: he loads beside it)
		const boot = loadCreatureBoot(deferredLog.groups);
		void boot.held.then(releaseCreatureRest);
		return;
	}
	try {
		if (mode === 'parallel') {
			const boot = loadCreatureBoot(deferredLog.groups);
			await Promise.all([gate ?? Promise.resolve(), boot.held, ...DEFERRED_ORDER.map((g) => runGroup(app, g))]);
		} else {
			if (gate) await gate;
			const boot = loadCreatureBoot(deferredLog.groups);
			// his idle sheet alone first: he breathes as soon as the link allows
			await boot.idle;
			if (!LOAD_GATE.sceneBesideAttacks) await boot.held;
			const scene = (async () => {
				for (const g of DEFERRED_ORDER) await runGroup(app, g);
			})();
			await Promise.all([boot.held, scene]);
		}
	} catch {
		/* whatever is missing is left to the shared loader's batch */
	}
	await releaseCreature();
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
	const group = async (name: string, all: readonly string[]) => {
		// the keys both scenes list (the sky's atlas, the birds, the bats) are the boot scene's: already registered, never
		// fetched here (components/Background.svelte gives a sky whatever of them lands after its scene)
		const keys = all.filter((key) => SCENE_LATE[key]);
		const log = (deferredLog.groups[name] = { start: performance.now(), end: 0, keys: keys.length, failed: 0 });
		const done = await Promise.all(keys.map((key) => loadOne(key, SCENE_LATE[key])));
		log.failed = done.filter((textures) => !textures).length;
		if (!log.failed) app.loadedAssets = Object.assign({ ...app.loadedAssets }, ...(done as Textures[]));
		log.end = performance.now();
	};
	const late = SCENE_KEYS[SCENE_AT_BOOT === 'landscape' ? 'portrait' : 'landscape'];
	// the flames' deferred clips one at a time, like the boot's own order (none for the portrait scene)
	const flames = () => late.flames.reduce((chain, key) => chain.then(() => group(`sceneFlames_${key}`, [key])), Promise.resolve());
	sceneLate ??= group('sceneDay', late.day).then(() => group('sceneNight', late.night)).then(flames).catch(() => {});
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

/** the board frame's night set of a layout the game did not boot in (game/assets.ts FRAME_NIGHT_LATE): fetched the
 *  first time the game is turned to that layout, published together (the frame goes to night only with all three).
 *  Once per layout; a failure leaves that layout's frame in its day light. */
const frameNightLate: Record<string, Promise<void>> = {};
export const loadFrameNightLate = (app: AppState, kind: string): Promise<void> => {
	const entries = FRAME_NIGHT_LATE[kind];
	if (!entries) return Promise.resolve();
	frameNightLate[kind] ??= (async () => {
		const keys = Object.keys(entries);
		const log = (deferredLog.groups[`frameNight_${kind}`] = { start: performance.now(), end: 0, keys: keys.length, failed: 0 });
		const done = await Promise.all(keys.map((key) => loadOne(key, entries[key])));
		log.failed = done.filter((textures) => !textures).length;
		if (!log.failed) app.loadedAssets = Object.assign({ ...app.loadedAssets }, ...(done as Textures[]));
		log.end = performance.now();
	})().catch(() => {});
	return frameNightLate[kind];
};

if (import.meta.env.DEV && typeof window !== 'undefined') {
	// house rule: extend __manticore, never a new global (tools/manticore/defer_probe.js reads it)
	((window as any).__manticore ??= {}).deferred = () => JSON.parse(JSON.stringify(deferredLog));
}
