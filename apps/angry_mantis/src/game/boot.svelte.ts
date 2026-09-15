// LANDING-FIRST BOOT ORDER (2026-09-15).
//
// The old order was: everything at once. routes/+layout.svelte kicked startSoundPreload() and
// pixi-svelte's AssetsLoader started the several-MB Pixi preload the moment the app ran, while the
// landing screen's own images (three 300–420 KB primer cards + the logo) were plain <img> tags
// nothing gated on. On Slow 4G that meant the landing screen faded in with its cards still arriving.
//
// Now: the app fetches ONLY what the landing screen draws — the two chrome fonts, the wide logo and
// the three cards — reporting bytes to the GREEN bar in the shell splash (src/app.html), which has
// already been counting the JS bundle's bytes. Nothing else starts until those are in:
//   - the Pixi preload is gated by Game.svelte holding <App> unmounted,
//   - startSoundPreload() is gated by routes/+layout.svelte.
// The RGS Authenticate round-trip deliberately still runs in parallel: it is latency-bound, not
// bandwidth-bound, and it must be done before Game.svelte can mount anything at all.
//
// Then the handoff: LandingScreen mounts, calls releaseSplash(), the splash fades over 450 ms and
// the YELLOW bar takes over reporting the Pixi preload + audio exactly as before.
import { stamp } from './assets';
import { landingSizes } from './assetStamp';

declare global {
	interface Window {
		__amSplash?: {
			setBundle(loaded: number, total: number): void;
			setAssets(loaded: number, total: number): void;
			done(): void;
			hideNow(): void;
		};
	}
}

/** paths relative to static/assets — the byte sizes come from scripts/stamp-assets.mjs */
const IMAGES = [
	'ui/intro/card-1.webp',
	'ui/intro/card-2.webp',
	'ui/intro/card-3.webp',
	'ui/logo-wide.webp',
] as const;
// ui/logo-landscape.webp is deliberately NOT here: the landscape chrome carries it, and the chrome
// is behind a full-screen LandingScreen until the player presses — by then the deferred phase has it.
const FONTS = [
	{ path: 'fonts/ui/Outfit-Variable.woff2', spec: '900 40px Outfit' },
	{ path: 'fonts/ui/Sora-Variable.woff2', spec: '700 40px Sora' },
] as const;

export const boot = $state({
	/** the landing screen's own assets are in — everything else may start */
	landingReady: false,
	/** ui/LandingScreen.svelte is mounted, so the splash has something to fade to */
	landingMounted: false,
});

const sizeOf = (path: string) => (landingSizes as Record<string, number>)[path] ?? 0;

let started = false;

export const startLandingPreload = () => {
	if (started || typeof window === 'undefined') return;
	started = true;

	// a replay link is a recording: no landing screen, no primer cards, nothing to wait for
	if (new URLSearchParams(window.location.search).get('replay') === 'true') {
		boot.landingReady = true;
		return;
	}

	const total =
		IMAGES.reduce((n, path) => n + sizeOf(path), 0) + FONTS.reduce((n, f) => n + sizeOf(f.path), 0);
	const done = new Map<string, number>();
	const report = () => {
		let loaded = 0;
		for (const n of done.values()) loaded += n;
		window.__amSplash?.setAssets(Math.min(loaded, total), total);
	};
	report();

	// Images: streamed with fetch so the bar moves per chunk, then handed to an <img> for decode.
	// The second request is a cache hit by construction — /assets/* is served immutable in
	// production and every URL carries its ?v= content stamp (game/assets.ts) — so this costs no
	// extra bytes; the point of the <img> pass is that the browser has the bitmap DECODED before
	// LandingScreen paints it.
	const fetchImage = async (path: string) => {
		const url = stamp(`/assets/${path}`);
		const budget = sizeOf(path);
		for (let attempt = 0; attempt <= 2; attempt += 1) {
			try {
				const res = await fetch(url, { credentials: 'same-origin' });
				if (!res.ok) throw new Error(`${path} ${res.status}`);
				const declared = Number(res.headers.get('content-length') || 0) || budget;
				if (res.body) {
					const reader = res.body.getReader();
					let got = 0;
					for (;;) {
						const chunk = await reader.read();
						if (chunk.done) break;
						got += chunk.value.length;
						// never let a mis-declared length push this asset past its baked budget
						done.set(path, Math.min(budget, Math.round((got / declared) * budget)));
						report();
					}
				} else {
					await res.arrayBuffer();
				}
				break;
			} catch (error) {
				console.error('[boot] landing asset failed', path, error);
				if (attempt === 2) break;
				await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
			}
		}
		try {
			const img = new Image();
			img.src = url;
			await img.decode();
		} catch {
			/* a broken card is not worth holding the game on */
		}
		done.set(path, budget);
		report();
	};

	// Fonts: document.fonts.load() drives the @font-face fetch ui/fontFaces.ts injected. No byte
	// stream available, so each face scores its whole (small) size when it resolves — a fetch() here
	// would be a second, duplicate download of the same file.
	const loadFont = async (face: (typeof FONTS)[number]) => {
		try {
			await document.fonts.load(face.spec);
		} catch {
			/* fall through — the chrome has system fallbacks */
		}
		done.set(face.path, sizeOf(face.path));
		report();
	};

	void (async () => {
		await Promise.all([...IMAGES.map(fetchImage), ...FONTS.map(loadFont)]);
		window.__amSplash?.setAssets(total, total);
		boot.landingReady = true;
	})();
};

/** fade the shell splash out (450 ms) — LandingScreen is underneath it by now */
export const releaseSplash = () => window.__amSplash?.done();
