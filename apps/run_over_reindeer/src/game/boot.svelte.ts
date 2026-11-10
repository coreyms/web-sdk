// LANDING-FIRST BOOT ORDER (the house rule, from Angry Mantis and Manticore Mayhem).
//
// The app fetches ONLY what the landing screen needs to stand first: the two chrome faces and the game's own face
// (there is no logo picture or explainer card yet), reporting bytes to the bar in the shell splash (src/app.html),
// which has already been counting the JS bundle's bytes. Nothing else starts until those are in:
//   - the Pixi preload is gated by Game.svelte holding <App> unmounted,
//   - the audio starts once the Pixi preload is in (components/Game.svelte).
// The RGS Authenticate round trip runs in parallel: it is latency-bound, not bandwidth-bound.
//
// Then the handoff: LandingScreen mounts, calls releaseSplash(), the splash fades and the landing screen's bar
// carries on with the audio. ONE loading scale across both screens, so the bar never jumps backwards.
import { landingSizes, bootSizes } from './assetStamp';

declare global {
	interface Window {
		__amSplash?: {
			setBundle(loaded: number, total: number): void;
			setAssets(loaded: number, total: number): void;
			setPreload(loaded: number, total: number): void;
			setShare(share: number): void;
			getShare(): number;
			done(): void;
			hideNow(): void;
			isOut?(): boolean;
		};
	}
}

/** the splash's share of the one loading scale: the bundle, the landing files and the Pixi preload over everything
 *  (the audio is the landing screen's part) */
export const splashShare = (): number => {
	const b = (typeof window !== 'undefined' && (window as unknown as { __AM_BOOT?: { jsBytes?: number } }).__AM_BOOT) || undefined;
	const js = b?.jsBytes ?? 0;
	const everything = js + bootSizes.landing + bootSizes.preload + bootSizes.audio;
	return everything > 0 ? (js + bootSizes.landing + bootSizes.preload) / everything : 0;
};

/** the Pixi preload's progress (0 to 100), fed to the splash's bar by bytes */
export const reportPreload = (progress: number) => {
	window.__amSplash?.setPreload(Math.round((bootSizes.preload * Math.min(100, Math.max(0, progress))) / 100), bootSizes.preload);
};

const FONTS = [
	{ path: 'fonts/ui/Outfit-Variable.woff2', spec: '900 40px Outfit' },
	{ path: 'fonts/ui/Sora-Variable.woff2', spec: '700 40px Sora' },
	// the game's own face (the canvas amounts and every title): Overpass Heavy
	{ path: 'fonts/overpass/Overpass-heavy.woff2', spec: "900 40px 'Overpass'" },
] as const;

export const boot = $state({
	/** the landing screen's own files are in: Game.svelte may mount <App> (which starts the Pixi preload) */
	landingReady: false,
	/** ui/LandingScreen.svelte is mounted (it releases the splash) */
	landingMounted: false,
	/** the shell splash has faded out */
	splashOut: false,
});

if (typeof window !== 'undefined') {
	const splashOut = () => (boot.splashOut = true);
	if (!window.__amSplash || typeof window.__amSplash.isOut !== 'function' || window.__amSplash.isOut()) splashOut();
	else window.addEventListener('am-splash-out', splashOut, { once: true });
}

const sizeOf = (path: string) => (landingSizes as Record<string, number>)[path] ?? 0;

let started = false;

export const startLandingPreload = () => {
	if (started || typeof window === 'undefined') return;
	started = true;
	// a replay has no landing screen: nothing to wait for
	if (new URLSearchParams(window.location.search).get('replay') === 'true') {
		boot.landingReady = true;
		return;
	}

	window.__amSplash?.setShare(splashShare());
	window.__amSplash?.setPreload(0, bootSizes.preload);
	const total = FONTS.reduce((n, f) => n + sizeOf(f.path), 0);
	let loaded = 0;
	window.__amSplash?.setAssets(0, total);

	const loadFont = async (face: (typeof FONTS)[number]) => {
		try {
			await document.fonts.load(face.spec);
		} catch {
			/* fall through: the chrome has system fallbacks */
		}
		loaded += sizeOf(face.path);
		window.__amSplash?.setAssets(Math.min(loaded, total), total);
	};

	void (async () => {
		await Promise.all(FONTS.map(loadFont));
		boot.landingReady = true;
	})();
};

export const releaseSplash = () => window.__amSplash?.done();
