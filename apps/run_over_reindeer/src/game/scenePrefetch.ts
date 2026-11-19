// THE OTHER SCENE SET IN THE BROWSER'S CACHE (2026-11-19, Corey: "Load both of them during the PolyMath Intro Screen?").
// The Scene setting's other set (game/sceneChoice.ts: the grass set on a Snow boot, the snow set on a Dark one) has only
// its base scene fetched here, its bytes into the browser's HTTP cache and nothing more: no decode kept, nothing on the
// GPU, no blob: or data: URL. A press on Snow or Dark on the press screen then loads it from the cache (game/scene/
// sceneSwap.ts asks the very same stamped addresses, game/assets.ts SCENE_LAZY_URLS), so its cross-fade starts at once.
//
// NEVER IN THE WAY OF THE PRESS (ui/LandingScreen.svelte starts it): only once everything the loading bar and the press
// gate wait for is in (the Pixi preload, and the audio or its stall time), each request at low priority where the browser
// has fetch priorities; the bar, the splash's minimum time and the press gate count exactly what they did. A press while
// a fetch is still in flight finds the swap's own load-then-fade path, as before. The phone asset tier asks for the phone
// tier's pieces only: the forest on the phone tier alone (an upright phone draws it), the painted tunnel ends not while the
// phone stands upright (only the sideways layouts draw them; a rotation loads them then, as it always did).
import { SCENE_LAZY_URLS } from './assets';
import { PHONE_TIER } from './deviceTier';
import { BOOT_SCENE_SET } from './sceneChoice';
import { SCENE_PRESETS, homePreset } from './scenePresets';

type Fetched = { url: string; ms: number | null; bytes: number | null; ok: boolean | null };
const state: { startedAt: number | null; why: string; set: string; files: Fetched[] } = { startedAt: null, why: '', set: '', files: [] };

/** the other set's base scene pieces for this device (asset keys) */
const keysNow = (): string[] => {
	const P = SCENE_PRESETS[homePreset(BOOT_SCENE_SET === 'snow' ? 'grass' : 'snow')];
	const upright = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
	const keys = [P.picture.road, P.picture.tunnelLeft, P.picture.tunnelRight, P.field];
	if (P.bands) keys.push(P.bands.top, P.bands.bottom);
	if (P.ends && !(PHONE_TIER && upright)) keys.push(P.ends.left, P.ends.right);
	if (P.forest && PHONE_TIER) keys.push(P.forest);
	return keys.filter((k) => !!SCENE_LAZY_URLS[k]);
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
