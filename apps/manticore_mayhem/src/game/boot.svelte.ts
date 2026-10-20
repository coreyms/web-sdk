// LANDING-FIRST BOOT ORDER (2026-09-15).
//
// The old order was: everything at once. routes/+layout.svelte kicked startSoundPreload() and
// pixi-svelte's AssetsLoader started the several-MB Pixi preload the moment the app ran, while the
// landing screen's own images (three 300–420 KB primer cards + the logo) were plain <img> tags
// nothing gated on. On Slow 4G that meant the landing screen faded in with its cards still arriving.
//
// Now: the app fetches ONLY what the landing screen needs to stand: the two chrome fonts and the stacked
// logo (the three placeholder cards too, until the animated cards replaced them on 2026-10-12: see IMAGES), reporting bytes to the bar in the shell splash (src/app.html), which has
// already been counting the JS bundle's bytes. Nothing else starts until those are in:
//   - the Pixi preload is gated by Game.svelte holding <App> unmounted,
//   - startSoundPreload() is gated by routes/+layout.svelte.
// The RGS Authenticate round-trip deliberately still runs in parallel: it is latency-bound, not
// bandwidth-bound, and it must be done before Game.svelte can mount anything at all.
//
// Then the handoff: LandingScreen mounts, calls releaseSplash(), the splash fades over 450 ms and
// the landing screen's RED bar (the splash's own red since 2026-10-20) carries on with the audio and THE GATE.
//
// THE EXPLAINER CARDS LOAD ON THE SPLASH (2026-10-20, Corey: "the explainer card videos need to load on the Polymath
// splash screen, so they are ready when the landing screen drops"): startCards() below, from the moment the logo and
// the two faces are in (so the Pixi preload still starts as early as before), beside the Pixi preload. Their bytes are
// in the splash bar (scripts/stamp-assets.mjs CARDS); the splash waits for them up to INTRO_CARD.splashCapMs
// (ui/LandingScreen.svelte), and boot.cards says how it went.
import { GATE_BYTES, stamp } from './assets';
import { landingSizes, bootSizes } from './assetStamp';
import { INTRO_CARD_ASSETS } from './introCards';
import { INTRO_CARD_TEXT } from './introCardText';

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
			/** the splash has started fading out (it takes no pointer from then on) or is gone */
			isOut?(): boolean;
		};
	}
}

/** paths relative to static/assets — the byte sizes come from scripts/stamp-assets.mjs */
// (the explainer cards are not in this phase: they are CARD_* below, loaded after it, during the splash)
const IMAGES = [
	'ui/logo-stacked.webp',
] as const;
/** the splash bar's share of ONE loading scale across both screens: bundle + landing assets +
 *  the Pixi preload, over everything the landing screen waits on (the audio and, since first-minute plan D, THE GATE:
 *  game/assets.ts GATE_BYTES). The Pixi scene (the room the
 *  landing sits in) only renders once its whole preload phase is in (pixi-svelte AssetsLoader), so
 *  the splash has to cover it — Corey 2026-09-15: no landing over a black canvas. Production knows
 *  the bundle size (window.__AM_BOOT); dev does not, so its share leaves the bundle out.
 *  ui/LandingScreen.svelte starts its bar from this and carries the audio to 100. */
export const splashShare = (): number => {
	const b = (typeof window !== 'undefined' && (window as unknown as { __AM_BOOT?: { jsBytes?: number } }).__AM_BOOT) || undefined;
	const js = b?.jsBytes ?? 0;
	// bootSizes.landing carries the cards' files (scripts/stamp-assets.mjs CARDS); the clips leave it where none is asked for
	const landing = bootSizes.landing - (clipsWanted() ? 0 : CARD_CLIPS.reduce((n, path) => n + sizeOf(path), 0));
	const everything = js + landing + bootSizes.preload + bootSizes.audio + GATE_BYTES;
	return everything > 0 ? (js + landing + bootSizes.preload) / everything : 0;
};

/** the Pixi preload's progress (stateApp.loadingProgress, 0-100), forwarded to the splash bar as
 *  bytes of its baked total (components/Game.svelte) */
export const reportPreload = (progress: number) => {
	if (progress >= 100) preloadDone();
	window.__amSplash?.setPreload(Math.round((bootSizes.preload * Math.min(100, Math.max(0, progress))) / 100), bootSizes.preload);
};
/** the Pixi preload is in: the cards' title face waits for it (pixi-svelte awaits document.fonts.ready before Pixi starts,
 *  and a face in flight then would hold the whole preload, or all of it, on a hung request: found by the probe) */
let preloadDone: () => void = () => {};
const preloadIn = new Promise<void>((resolve) => (preloadDone = resolve));
// ui/logo-stacked.webp is the ONE static logo: the landing screen's, every chrome's <img> on the phone tier,
// and the desktop chrome's stand-in until the canvas logo is in (components/Logo.svelte).
const FONTS = [
	{ path: 'fonts/ui/Outfit-Variable.woff2', spec: '900 40px Outfit' },
	{ path: 'fonts/ui/Sora-Variable.woff2', spec: '700 40px Sora' },
] as const;

// ---- THE EXPLAINER CARDS' FILES (the same list as scripts/stamp-assets.mjs CARDS) ----
const rel = (url: string) => url.replace(/^\/assets\//, '');
const CARD_IMAGES = [rel(INTRO_CARD_ASSETS.frame), ...INTRO_CARD_TEXT.map((c) => rel(INTRO_CARD_ASSETS.poster(c.key)))];
const CARD_FONT = { path: 'fonts/ui/Cinzel-Bold.woff2', spec: "700 40px 'Cinzel'" } as const;
const CARD_CLIPS = INTRO_CARD_TEXT.map((c) => rel(INTRO_CARD_ASSETS.clip(c.key)));
/** posters only, and no clip asked for, where the player asked for less motion; and a replay link shows no landing screen */
const clipsWanted = () =>
	typeof window !== 'undefined' &&
	!(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) &&
	new URLSearchParams(window.location.search).get('replay') !== 'true';

/** a clip element that has stopped fetching before it has its frames is nudged (one muted play() and pause()) this long
 *  after, ms, if it is still stopped */
const CLIP_NUDGE_AFTER_MS = 400;
/** the three clip elements, made during the splash (muted, inline, preload auto, the stamped src) and handed to
 *  ui/LandingScreen.svelte when it shows the cards (cardClip). Until then they sit in a 1 px holder under the splash, IN
 *  the document: WebKit holds back what a detached or hidden video loads. */
const clipEls: (HTMLVideoElement | undefined)[] = [];
/** per clip, for the DEV hook (tools/manticore/landing_probe.js): when it was in, how, and whether it needed the nudge */
export const cardClipInfo: { key: string; state: 'idle' | 'loading' | 'in' | 'failed'; inAt: number; how: string; nudged: boolean }[] = INTRO_CARD_TEXT.map((c) => ({
	key: c.key, state: 'idle', inAt: 0, how: '', nudged: false,
}));
let holder: HTMLDivElement | undefined;
const makeClip = (i: number, src: string | null) => {
	const v = document.createElement('video');
	v.muted = true;
	v.defaultMuted = true;
	v.loop = true;
	v.playsInline = true;
	for (const a of ['muted', 'playsinline', 'disablepictureinpicture', 'disableremoteplayback']) v.setAttribute(a, '');
	v.setAttribute('tabindex', '-1');
	v.setAttribute('aria-hidden', 'true');
	v.poster = stamp(INTRO_CARD_ASSETS.poster(INTRO_CARD_TEXT[i].key));
	v.preload = src ? 'auto' : 'metadata';
	if (src) v.src = src;
	return v;
};
/** the clip element for card i: the one loaded during the splash, or (no clip was asked for then) a fresh one without a
 *  src, which ui/LandingScreen.svelte gives its src when the card first has to play, as before 2026-10-20 */
export const cardClip = (i: number): HTMLVideoElement => (clipEls[i] ??= makeClip(i, null));

export const boot = $state({
	/** the landing screen's own assets are in — everything else may start */
	landingReady: false,
	/** ui/LandingScreen.svelte is mounted, so the splash has something to fade to */
	landingMounted: false,
	/** THE EXPLAINER CARDS during the splash: 'idle' not started; 'loading'; 'in' (frame and posters decoded, the title
	 *  face and every wanted clip in, or failed) before the splash let go; 'late' the splash moved on at its cap
	 *  (INTRO_CARD.splashCapMs) without them, and the cards use their fallback rules; 'off' no cards (a replay link) */
	cards: 'idle' as 'idle' | 'loading' | 'in' | 'late' | 'off',
	/** THE SPLASH HAS CLEARED (it has started its fade, from which it takes no pointer, or there is none): until then it
	 *  covers the landing screen and takes every tap, so ui/LandingScreen.svelte shows and arms PRESS ANYWHERE only from
	 *  here. Before 2026-10-16 a fast phone had PRESS ready about 2.8 s before the splash cleared, and a tap in that
	 *  window was lost (firstminute_r1). */
	splashOut: false,
});

if (typeof window !== 'undefined') {
	const splashOut = () => (boot.splashOut = true);
	// (a shell without isOut is an older one that never says: it is taken as out, as before)
	if (!window.__amSplash || typeof window.__amSplash.isOut !== 'function' || window.__amSplash.isOut()) splashOut();
	else window.addEventListener('am-splash-out', splashOut, { once: true });
}

const sizeOf = (path: string) => (landingSizes as Record<string, number>)[path] ?? 0;

let started = false;

export const startLandingPreload = () => {
	if (started || typeof window === 'undefined') return;
	started = true;

	// a replay link is a recording: no landing screen, no primer cards, nothing to wait for
	if (new URLSearchParams(window.location.search).get('replay') === 'true') {
		boot.cards = 'off';
		boot.landingReady = true;
		return;
	}

	window.__amSplash?.setShare(splashShare());
	window.__amSplash?.setPreload(0, bootSizes.preload);
	const wantClips = clipsWanted();
	const cardsTotal =
		[...CARD_IMAGES, CARD_FONT.path, ...(wantClips ? CARD_CLIPS : [])].reduce((n, path) => n + sizeOf(path), 0);
	// the splash bar's denominator carries the cards from the first report (the share above does too)
	const total =
		IMAGES.reduce((n, path) => n + sizeOf(path), 0) + FONTS.reduce((n, f) => n + sizeOf(f.path), 0) + cardsTotal;
	const done = new Map<string, number>();
	const report = () => {
		// past the splash's cap the bar is the landing screen's (cardsLate)
		if (boot.cards === 'late') return;
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

	// A CLIP: buffered through its own <video> element (muted, inline, preload auto, the stamped plain URL), never fetched
	// into memory: the engine.io CSP has no blob:, and Safari asks for video in ranges and does not reliably reuse a copy
	// fetched by script. Its bytes move the bar as its buffered range grows. It is IN when the whole clip is buffered, or
	// when the browser has enough to play it through and has stopped fetching by itself (it keeps what it has); a clip
	// that fails is in too (its poster stays). THE NUDGE: a browser that stops at the metadata (iOS may ignore preload
	// until play()) gets one muted inline play() and pause(), only then.
	const loadClip = (i: number) =>
		new Promise<void>((resolve) => {
			const path = CARD_CLIPS[i];
			const info = cardClipInfo[i];
			const budget = sizeOf(path);
			const v = (clipEls[i] = makeClip(i, stamp(`/assets/${path}`)));
			holder?.appendChild(v);
			info.state = 'loading';
			let canPlayThrough = false;
			const buffered = () => {
				const d = v.duration;
				if (!(d > 0) || !Number.isFinite(d)) return 0;
				let end = 0;
				for (let k = 0; k < v.buffered.length; k += 1) if (v.buffered.start(k) <= 0.1) end = Math.max(end, v.buffered.end(k));
				return Math.min(1, end / d);
			};
			const finish = (state: 'in' | 'failed', how: string) => {
				if (info.state !== 'loading') return;
				info.state = state;
				info.how = how;
				info.inAt = performance.now();
				for (const [name, fn] of handlers) v.removeEventListener(name, fn);
				done.set(path, budget);
				report();
				resolve();
			};
			const check = (how: string) => {
				const f = buffered();
				done.set(path, Math.min(budget, Math.round(f * budget)));
				report();
				if (f >= 0.995 && v.readyState >= 3) finish('in', 'whole');
				// NETWORK_IDLE: the browser has stopped fetching by itself, with enough to play through
				else if (canPlayThrough && v.readyState >= 4 && v.networkState === HTMLMediaElement.NETWORK_IDLE) finish('in', `enough on ${how}`);
			};
			// (a suspend can come between the metadata and the rest while the browser is still deciding: the nudge waits
			// CLIP_NUDGE_AFTER_MS and is used only if the element is still idle without the frames)
			const nudge = () => {
				if (info.nudged || info.state !== 'loading' || v.readyState >= 3 || v.networkState !== HTMLMediaElement.NETWORK_IDLE) return;
				info.nudged = true;
				v.play()
					.then(() => {
						v.pause();
						v.currentTime = 0;
					})
					.catch(() => {});
			};
			const handlers: [string, () => void][] = [
				['progress', () => check('progress')],
				['loadeddata', () => check('loadeddata')],
				['canplaythrough', () => { canPlayThrough = true; check('canplaythrough'); }],
				['suspend', () => { check('suspend'); setTimeout(nudge, CLIP_NUDGE_AFTER_MS); }],
				['error', () => finish('failed', 'error')],
			];
			for (const [name, fn] of handlers) v.addEventListener(name, fn);
			v.load();
		});

	// THE CARDS, from the moment the logo and the two faces are in: the frame and the posters (fetched with the bar and
	// decoded, like the logo), the title face (once the Pixi preload is in: preloadIn), the clips. Each counts as in when it is in or has failed: nothing here can
	// hold anything but the splash, and the splash only up to INTRO_CARD.splashCapMs (ui/LandingScreen.svelte).
	const startCards = async () => {
		boot.cards = 'loading';
		holder = document.createElement('div');
		holder.setAttribute('aria-hidden', 'true');
		holder.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0.01;pointer-events:none;z-index:0';
		document.body.appendChild(holder);
		const loadCardFont = async () => {
			await preloadIn;
			try {
				await document.fonts.load(CARD_FONT.spec);
			} catch {
				/* the fallback serif draws the title */
			}
			done.set(CARD_FONT.path, sizeOf(CARD_FONT.path));
			report();
		};
		await Promise.all([...CARD_IMAGES.map((p) => fetchImage(p)), loadCardFont(), ...(wantClips ? CARD_CLIPS.map((_, i) => loadClip(i)) : [])]);
		if (boot.cards === 'loading') boot.cards = 'in';
	};

	void (async () => {
		await Promise.all([...IMAGES.map((p) => fetchImage(p)), ...FONTS.map(loadFont)]);
		boot.landingReady = true;
		void startCards();
	})();
};

/** the splash's cap (ui/LandingScreen.svelte, INTRO_CARD.splashCapMs): it moves on without the cards. The bar is put at
 *  its share (the landing bar starts there), and the cards' files keep coming in for the fallback. */
export const cardsLate = () => {
	if (boot.cards !== 'loading') return;
	boot.cards = 'late';
	window.__amSplash?.setAssets(1, 1);
};

/** the cards are done with (the continue press): the holder leaves the page with anything still in it */
export const dropCardHolder = () => {
	holder?.remove();
	holder = undefined;
};

/** fade the shell splash out (450 ms) — LandingScreen is underneath it by now */
export const releaseSplash = () => window.__amSplash?.done();
