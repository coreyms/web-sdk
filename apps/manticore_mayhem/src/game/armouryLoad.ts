// THE ARMOURY'S MENU CORE, THE DEFERRED PHASE'S LAST GROUP (spec feedback/armoury_build_r1 3.3 "When things load").
//
//   armoury   the plaque, the crest, the thumbs sheet and the six flat heroes (full tier 0.61 MB; the phone tier's half
//             size heroes 0.29 MB): HTML pictures, not Pixi textures, so they never touch the canvas budget
//
// NOTHING OF THE ARMOURY IS IN THE PRELOAD: the landing screen and the time to PRESS ANYWHERE do not change. The group
// starts when the whole deferred phase is through (stateApp.loaded: the ordered groups, the creature's alternates and
// the shared loader's batch, components/Game.svelte), so it is never in front of anything that loaded before it, in any
// `?defer=` mode (tools/manticore/defer_probe.js compares like with like). If the player opens the menu before it is
// in, the menu asks for it then (`loadArmouryCore` is the same promise); the menu never waits for it: a picture that is
// not decoded yet fades in when it is.
//
// Each picture is fetched by a normal URL (assets.ts stamp(): ?v=<content hash>) and decoded with Image.decode(), as the
// landing screen's cards are. NEVER a blob: URL (Stake's content policy has none). The Image objects are kept, so the
// decoded pictures stay warm for the first open. No grid is asked for here: the grids come after the first open
// (ui/armoury/heroGrid.ts HeroLoadQueue).
import { stamp } from './assets';
import { PHONE_TIER } from './deviceTier';
import { deferredLog } from './deferredLoad';
import { ARMOURY_ART_ORDER, ARMOURY_ASSETS } from './armouryData';
import { ARMOURY } from './constants';
import { HeroLoadQueue, gridView, parseHeroes, type GridView, type HeroGrids, type LoadState } from '../ui/armoury/heroGrid';

/** the menu core's URLs (stamped), in the order they are fetched: what the first frame of the menu shows first */
export const armouryCoreUrls = (phone = PHONE_TIER): string[] => [
	stamp(ARMOURY_ASSETS.thumbs),
	stamp(ARMOURY_ASSETS.plaque),
	stamp(ARMOURY_ASSETS.crest),
	...ARMOURY_ART_ORDER.map((art) => stamp(ARMOURY_ASSETS.hero(art, phone))),
];

/** which core pictures are decoded (url -> its Image); the menu reads this to fade a picture in */
export const armouryDecoded = new Map<string, HTMLImageElement>();

let core: Promise<void> | null = null;
let coreDone: () => void = () => {};
const coreLanded = new Promise<void>((r) => (coreDone = r));
/** resolves when the menu core is in, WITHOUT asking for it (the warm pass waits on this: it must never pull the core
 *  forward into the loading screen) */
export const whenArmouryCore = (): Promise<void> => coreLanded;

/** fetch and decode the menu core, once. One picture at a time (sequential, like the groups before it); resolves when
 *  the last is in; never rejects (a picture that fails is simply not shown: the tile and the hero box stay empty) */
export const loadArmouryCore = (): Promise<void> => {
	if (typeof window === 'undefined') return Promise.resolve();
	core ??= (async () => {
		const urls = armouryCoreUrls();
		const log = (deferredLog.groups.armoury = { start: performance.now(), end: 0, keys: urls.length, failed: 0 });
		for (const url of urls) {
			try {
				const img = new Image();
				img.decoding = 'async';
				img.src = url;
				await img.decode();
				armouryDecoded.set(url, img);
			} catch {
				log.failed += 1;
			}
		}
		log.end = performance.now();
		coreDone();
	})();
	return core;
};

// ---- THE HERO ANGLE GRIDS (spec 3.3 "When things load", points 4 and 5; ui/armoury/heroGrid.ts) --------------------
// NOTHING IS ASKED FOR BEFORE THE FIRST OPEN. On the first open, once the entrance is over (ARMOURY.hero.gridAfterOpenMs),
// the menu calls startHeroGrids: heroes.json, then the shown hero's atlas, then the others ONE AT A TIME in tray order.
// Every atlas is fetched once (so it sits in the HTTP cache) but only ARMOURY.hero.keepDecoded are held decoded (the one
// on show and the one before it); a hero let go is decoded again from the cache when it is shown. The phone tier
// (PHONE_TIER) takes the half size pitch 0 strip (`turn`) instead of the whole grid. No entry, a 404, a failed decode or
// an atlas of the wrong size all leave that hero on its flat art. The queue pauses while a round is in flight.
// Each atlas is a normal stamped URL decoded with Image.decode(); NEVER a blob: URL.

export type HeroGridHandle = { img: HTMLImageElement; url: string; view: GridView; bytes: number };

let gridEntries: HeroGrids | null = null;
let gridQueue: HeroLoadQueue<HeroGridHandle> | null = null;
let gridStart: Promise<void> | null = null;
let gridLog: { url: string; at: number; done: number; ok: boolean }[] = [];
const gridListeners = new Set<() => void>();
const gridChanged = () => {
	for (const f of gridListeners) f();
};

/** the hero's grid as this tier shows it (null: none, flat art) */
export const heroGridView = (art: string): GridView | null => {
	const e = gridEntries?.[art];
	return e ? gridView(e, PHONE_TIER) : null;
};
const atlasUrl = (file: string) => stamp(ARMOURY_ASSETS.dir + file);

const loadAtlas = (art: string): Promise<HeroGridHandle> => {
	const view = heroGridView(art);
	if (!view) return Promise.reject(new Error('no grid'));
	const url = atlasUrl(view.atlas);
	const rec = { url, at: performance.now(), done: 0, ok: false };
	gridLog.push(rec);
	const img = new Image();
	img.decoding = 'async';
	img.src = url;
	return img.decode().then(
		() => {
			rec.done = performance.now();
			// the atlas must be the cells heroes.json says, or the frames would be cut wrong: flat art instead
			const w = view.cols * view.cell[0];
			const h = view.rows * view.cell[1];
			if (Math.abs(img.naturalWidth - w) > 1 || Math.abs(img.naturalHeight - h) > 1) throw new Error(`atlas ${img.naturalWidth}x${img.naturalHeight}, expected ${w}x${h}`);
			rec.ok = true;
			return { img, url, view, bytes: img.naturalWidth * img.naturalHeight * 4 };
		},
		(e) => {
			rec.done = performance.now();
			throw e;
		},
	);
};

/** begin the grids (the first open, after its entrance): heroes.json, then `selected` first. Once only; never rejects */
export const startHeroGrids = (selected: string | null): Promise<void> => {
	if (typeof window === 'undefined') return Promise.resolve();
	gridStart ??= (async () => {
		const url = stamp(ARMOURY_ASSETS.heroes);
		const rec = { url, at: performance.now(), done: 0, ok: false };
		gridLog.push(rec);
		try {
			const res = await fetch(url);
			gridEntries = res.ok ? parseHeroes(await res.json()) : {};
			rec.ok = res.ok;
		} catch {
			gridEntries = {};
		}
		rec.done = performance.now();
		const keys = ARMOURY_ART_ORDER.filter((a) => heroGridView(a) != null);
		gridQueue = new HeroLoadQueue<HeroGridHandle>({
			keys: [...keys],
			keep: ARMOURY.hero.keepDecoded,
			load: loadAtlas,
			// let go: drop the reference (the browser may free the decoded pixels; the file stays in the HTTP cache)
			release: () => {},
			onChange: gridChanged,
		});
		if (gridPaused) gridQueue.pause();
		gridQueue.start(selected && keys.includes(selected as never) ? selected : (wantSelected ?? null));
		gridChanged();
	})();
	return gridStart;
};

let gridPaused = false;
let wantSelected: string | null = null;
/** the hero on show changed: it goes to the front of the queue (and is decoded again if it was let go) */
export const selectHeroGrid = (art: string | null): void => {
	wantSelected = art;
	gridQueue?.select(art);
};
/** a round is in flight: the queue holds; idle again: it carries on */
export const pauseHeroGrids = (paused: boolean): void => {
	gridPaused = paused;
	if (paused) gridQueue?.pause();
	else gridQueue?.resume();
};
/** the decoded atlas of a hero, if it is held now */
export const heroGridReady = (art: string): HeroGridHandle | undefined => gridQueue?.ready(art);
export const heroGridState = (art: string): LoadState | 'none' | 'unasked' => (gridEntries == null ? 'unasked' : !heroGridView(art) ? 'none' : (gridQueue?.stateOf(art) ?? 'waiting'));
/** call `f` whenever a hero's grid state changes; returns the unsubscribe */
export const onHeroGrids = (f: () => void): (() => void) => {
	gridListeners.add(f);
	return () => gridListeners.delete(f);
};
/** for the DEV hook: what is held decoded, and its pixels (width x height x 4) */
export const heroGridsInfo = () => {
	const held: { art: string; url: string; w: number; h: number; mb: number }[] = [];
	for (const art of ARMOURY_ART_ORDER) {
		const h = gridQueue?.ready(art);
		if (h) held.push({ art, url: h.url, w: h.img.naturalWidth, h: h.img.naturalHeight, mb: +(h.bytes / 1048576).toFixed(2) });
	}
	return {
		started: gridStart != null,
		entries: gridEntries ? Object.keys(gridEntries) : null,
		states: Object.fromEntries(ARMOURY_ART_ORDER.map((a) => [a, heroGridState(a)])),
		held,
		heldMb: +held.reduce((n, h) => n + h.mb, 0).toFixed(2),
		paused: gridPaused,
		log: gridLog.map((r) => ({ ...r })),
	};
};

if (import.meta.env.DEV && typeof window !== 'undefined') {
	// house rule: extend __manticore, never a new global
	((window as any).__manticore ??= {}).armouryCore = () => ({ urls: armouryCoreUrls(), decoded: [...armouryDecoded.keys()], log: deferredLog.groups.armoury ?? null, grids: heroGridsInfo() });
}
