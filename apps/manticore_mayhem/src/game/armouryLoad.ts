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
	})();
	return core;
};

if (import.meta.env.DEV && typeof window !== 'undefined') {
	// house rule: extend __manticore, never a new global
	((window as any).__manticore ??= {}).armouryCore = () => ({ urls: armouryCoreUrls(), decoded: [...armouryDecoded.keys()], log: deferredLog.groups.armoury ?? null });
}
