// THE OTHER SCENE SET IN THE BROWSER'S CACHE (2026-11-19, Corey: "Load both of them during the PolyMath Intro Screen?").
// The Scene setting's other set (game/sceneChoice.ts: the grass set on a Snow boot, the snow set on a Dark one) has only
// its base scene fetched here, its bytes into the browser's HTTP cache and nothing more: no decode kept, nothing on the
// GPU, no blob: or data: URL. A press on Snow or Dark on the press screen then loads it from the cache (game/scene/
// sceneSwap.ts asks the very same stamped addresses, game/assets.ts SCENE_LAZY_URLS), so its cross-fade starts at once.
//
// NEVER IN THE WAY OF THE PRESS (ui/LandingScreen.svelte starts it): only once everything the loading bar and the press
// gate wait for is in (the Pixi preload, and the audio or its stall time), each request at low priority where the browser
// has fetch priorities; the bar, the splash's minimum time and the press gate count exactly what they did. A press while
// a fetch is still in flight finds the swap's own load-then-fade path, as before. EXACTLY THE SWAP'S FILES for the layout
// the page is in when it starts (game/scene/sceneLayers.ts keysFor, the view components/Board.svelte lays the scene out
// with): the forest only on an upright phone, the painted tunnel ends only where the layout draws them (desktop and the
// sideways phone). A rotation afterwards is the swap's own load's to cover, as it always was. (2026-11-19, the probe
// host: the first cut added the forest on every phone tier page, so the sideways phone fetched it for nothing.)
import { SCENE_LAZY_URLS } from './assets';
import { PHONE_TIER } from './deviceTier';
import { BOOT_SCENE_SET } from './sceneChoice';
import { SCENE_PRESETS, homePreset } from './scenePresets';
import { keysFor } from './scene/sceneLayers';
import type { LayoutKind } from './layoutSpec';

/** the view the board lays the scene out with (components/Board.svelte sets it), null before its first layout */
let viewNow: () => { kind: LayoutKind; uprightPhone: boolean } | null = () => null;
export const setScenePrefetchView = (fn: typeof viewNow) => {
	viewNow = fn;
};

type Fetched = { url: string; ms: number | null; bytes: number | null; ok: boolean | null };
const state: { startedAt: number | null; why: string; set: string; files: Fetched[] } = { startedAt: null, why: '', set: '', files: [] };

/** the other set's base scene pieces for this device (asset keys) */
const keysNow = (): string[] => {
	const P = SCENE_PRESETS[homePreset(BOOT_SCENE_SET === 'snow' ? 'grass' : 'snow')];
	// (before the board's first layout: the window's shape, as the layout would read it: upright on the phone tier is the
	// upright phone, anything else draws the ends; a tablet held upright draws neither)
	const upright = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
	const view = viewNow() ?? { kind: (upright ? 'portrait' : PHONE_TIER ? 'phone' : 'landscape') as LayoutKind, uprightPhone: upright && PHONE_TIER };
	return keysFor(P, view).filter((k) => !!SCENE_LAZY_URLS[k]);
};

/** start the fetches (once; `why`: what let it start, for the probes) */
export const prefetchOtherSceneSet = (why: string) => {
	if (state.startedAt !== null || typeof fetch !== 'function') return;
	// (DEV: ?noScenePrefetch=1 leaves it out, the probes' before)
	if (import.meta.env.DEV && typeof location !== 'undefined' && /[?&]noScenePrefetch=1/.test(location.search)) return;
	state.startedAt = performance.now();
	state.why = why;
	state.set = BOOT_SCENE_SET === 'snow' ? 'grass' : 'snow';
	for (const key of keysNow()) {
		const url = SCENE_LAZY_URLS[key];
		const f: Fetched = { url, ms: null, bytes: null, ok: null };
		state.files.push(f);
		const t0 = performance.now();
		// (the bytes are read to the end so the response is whole in the cache, then dropped)
		fetch(url, { priority: 'low' } as RequestInit)
			.then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
			.then((b) => {
				f.bytes = b.byteLength;
				f.ok = true;
			})
			.catch(() => (f.ok = false))
			.finally(() => (f.ms = Math.round(performance.now() - t0)));
	}
};

/** DEV / probes: when it started, why, and each file's time and size */
export const scenePrefetchState = () => ({ ...state, files: state.files.map((f) => ({ ...f })) });
