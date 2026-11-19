import { createSound, supportsAudioFormat, type MusicManifest } from 'utils-sound';

import assets from './assets';
import { fileBytes } from './assetStamp';

// THE EFFECTS SPRITE AND THE MUSIC (tools/build_audiosprite.py --game run_over_reindeer). The game was forked from
// Manticore Mayhem and started on its sprite and music; since 2026-11-19 (Corey: "Yes" to removing Manticore's sounds
// and the two music tracks) neither carries anything this game never plays. What the sprite still takes from the house
// and Manticore tables: the UI clicks (components/Sound.svelte), the marimba scatter family and its success
// (constants REINDEER_SOUND.scatterLand, game/bookEventHandlerMap.ts) and the five tier keys, whose clips are this game's
// own (constants LED_BOARD.tierSounds); every other name below is this game's own (game/road/roadSounds.ts and the
// constants tables). MusicName lives in music.json (one streamed file per track); every SoundEffectName lives in the
// sounds.json audiosprite.
export type MusicName = 'bgm_base' | 'bgm_bonus' | 'bgm_super';

export type SoundEffectName =
	| 'sfx_scatter_land_1'
	| 'sfx_scatter_land_2'
	| 'sfx_scatter_land_3'
	| 'sfx_scatter_land_4'
	| 'sfx_scatter_land_5'
	| 'sfx_scatter_land_6'
	// the marimba family (2026-11-17): eight landings and the trigger's success, in place of the three tier fanfares
	| 'sfx_scatter_land_7'
	| 'sfx_scatter_land_8'
	| 'sfx_scatter_success'
	| 'sfx_ui_button'
	| 'sfx_ui_spin'
	| 'sfx_ui_bonus'
	| 'sfx_ui_minor'
	| 'sfx_ui_sub'
	// the intro screen's press to continue (ui/LandingScreen.svelte, 2026-11-17), in place of its minor click
	| 'sfx_intro_jingle_short'
	// the tier family (Manticore's five key names, this game's own clips; constants LED_BOARD.tierSounds)
	| 'sfx_win_big'
	| 'sfx_win_super'
	| 'sfx_win_mega'
	| 'sfx_win_epic'
	| 'sfx_win_max'
	// RUN OVER REINDEER'S OWN (Corey's picks 2026-11-15; constants REINDEER_SOUND, game/road/roadSounds.ts)
	| 'sfx_reindeer_idle_snort'
	| 'sfx_reindeer_alert'
	| 'sfx_reindeer_run'
	| 'sfx_crash'
	| 'sfx_reindeer_turn'
	| 'sfx_crash_cloud'
	| 'sfx_grandma_wild'
	| 'sfx_column_reindeer_in'
	// round 2 (Corey's picks 2026-11-15): the spin, the target crosshair, the dart, the line wins, the stamps, the present
	| 'sfx_traffic_roll'
	| 'sfx_lane_stop_1'
	| 'sfx_lane_stop_2'
	| 'sfx_lane_stop_3'
	| 'sfx_lane_stop_4'
	| 'sfx_lane_stop_5'
	| 'sfx_stoplight_change'
	| 'sfx_target_hop'
	| 'sfx_target_drop'
	| 'sfx_target_lock'
	| 'sfx_reindeer_dart'
	| 'sfx_redbox'
	| 'sfx_win_h1_grandma'
	| 'sfx_win_h2_wagon'
	| 'sfx_win_h3_van'
	| 'sfx_win_h4_police'
	| 'sfx_win_low_1'
	| 'sfx_win_low_2'
	| 'sfx_win_low_3'
	| 'sfx_win_low_4'
	| 'sfx_win_low_5'
	| 'sfx_line_show'
	| 'sfx_multiplier_land_small'
	| 'sfx_multiplier_land_mid'
	| 'sfx_multiplier_land_high'
	| 'sfx_present_pop'
	// round 3 (Corey's finals 2026-11-15): the column's growth, entrances and win clips, the bonus round's cards and top-up,
	// the road's ambience (constants REINDEER_SOUND). sfx_scatter_tease plays the scatter tease since pass 7 (constants
	// LANE_FLOW); sfx_wild_double is left out of the sprite (pass 7, Corey: no doubling moment; its source stays on disk);
	// the tier family (sfx_win_big ... _max, above) replaced Manticore's clips in place (constants LED_BOARD.tierSounds).
	| 'sfx_column_grow'
	| 'sfx_column_santa_in'
	| 'sfx_column_grandma_in'
	| 'sfx_column_win_reindeer'
	| 'sfx_column_win_santa'
	| 'sfx_column_win_grandma'
	| 'sfx_scatter_tease'
	| 'sfx_sticky_set'
	| 'sfx_topup'
	| 'sfx_card_in'
	| 'sfx_card_out'
	| 'amb_road';

export type SoundName = MusicName | SoundEffectName;

const sound = createSound<SoundName>();

// ── audiosprite preload ────────────────────────────────────────────────────────────────────────
// The sprite is the single biggest file the game ships. It used to be constructed by EnableSound,
// a child of pixi-svelte's AssetsLoader, so the download only STARTED once every image had already
// finished — and nothing gated on it, so the landing screen said PRESS ANYWHERE while megabytes of
// audio were still in flight (minutes of silent gameplay on a slow link).
//
// So we own the fetch: kicked at app start (see routes/+layout.svelte) in parallel with the image
// preload, streamed so we get real byte progress for the loading bar, then handed to Howler by its
// real URL (the bytes are in the HTTP cache by then). Constructing/decoding a Howl before a user
// gesture is fine — only playback needs the gesture, and Howler's own unlock handler covers that.
type SoundManifest = {
	src: string[];
	sprite: Record<string, [number, number] | [number, number, boolean]>;
	// sounds.json only carries the sfx now (the music moved to music.json), but LoadedAudio is
	// keyed by the full SoundName union — the players already fall back to volume 1 for a name with
	// no config entry, so the missing bgm_* keys are harmless.
	config: Record<SoundName, { volume: number }>;
};

const RETRIES = 2; // 3 attempts total, then the player goes in silently

let preloadStarted = false;

/** First entry of the manifest's src[] this browser can actually decode (see build_audiosprite.py
 *  for the ordering — smallest supported format first). Resolved against the document like Howler
 *  would, since the manifest's paths are document-relative. */
const extOf = (ref: string) => (ref.split('?')[0].split('.').pop() ?? '').toLowerCase();

/** iPhone / iPad (every browser there is WebKit, Chrome included). Safari 17+ answers "maybe" to
 *  Vorbis, and its media elements do play the .ogg music, but the Web Audio decoder is CoreAudio
 *  only: decodeAudioData on the .ogg sprite fails, loaderror fires, and every effect is silent
 *  while the music plays — Corey's iPhone, Safari and Chrome, 2026-09-17. AAC is native there, so
 *  Apple touch devices take the .m4a of everything first; the retry below is the safety net. */
const PREFERS_AAC =
	typeof navigator !== 'undefined' &&
	(/iP(hone|ad|od)/.test(navigator.platform) ||
		/iP(hone|ad|od)/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const AAC_EXTS = ['m4a', 'mp4', 'aac'];
const orderSources = (srcList: string[]) =>
	PREFERS_AAC ? [...srcList].sort((a, b) => Number(AAC_EXTS.includes(extOf(b))) - Number(AAC_EXTS.includes(extOf(a)))) : srcList;

/** every playable source, best first */
const pickSources = (srcList: string[]) =>
	orderSources(srcList)
		.map((ref) => ({ ref, ext: extOf(ref) }))
		.filter(({ ext }) => ext && supportsAudioFormat(ext))
		.map(({ ref, ext }) => ({ url: new URL(ref, document.baseURI).href, ext }));

// Howler gets the sprite's REAL URL, never an object URL. engine.io serves the game under a
// Content Security Policy with no `blob:` source (2026-09-07): Howler's Web Audio XHR to a blob URL
// is refused (connect-src), Howler then silently retries the same blob through an HTML5 media
// element, which is refused too (media-src) and surfaces as MediaError code 4 — every effect
// silent while the music, streamed from real URLs, plays fine. The browser only logs the CSP
// refusals itself, so the game's console showed just "audiosprite failed to load 4". Same-origin
// URLs are allowed everywhere the game can be embedded; this fetch exists for the loading bar and
// to warm the HTTP cache so Howler's own request is (normally) served locally.
const prefetchWithProgress = async (url: string) => {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`audiosprite ${response.status} ${response.statusText}`);
	// no streaming body (very old browsers): the loading bar just waits for Howler
	if (!response.body) return;

	const total = Number(response.headers.get('content-length')) || 0;
	const reader = response.body.getReader();
	let received = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		received += value.length;
		if (total) sound.reportDownloadProgress(received / total, total);
	}
	sound.reportDownloadProgress(1);
};

// ── music ──────────────────────────────────────────────────────────────────────────────────────
// The five music loops used to sit inside the audiosprite, which meant all 328 s of them were
// decoded into one resident AudioBuffer (~130 MB) so that one of them could play. They are now
// separate files streamed through media elements (utils-sound/createMusic.svelte.ts): no decode,
// no AudioBuffer, and only the track being played is even downloaded.
//
// The manifest is tiny, so it is fetched alongside the sprite at the same early point and handed
// straight to the player, which immediately starts buffering the gate track (bgm_base) — that is
// the second half of what the landing screen waits on. The other four buffer in the background a
// few seconds after music first plays.
const loadMusicManifest = async () => {
	const response = await fetch(assets.music.src);
	if (!response.ok) throw new Error(`music.json ${response.status}`);
	const manifest = (await response.json()) as MusicManifest<MusicName>;
	// Apple touch devices: AAC first for the streamed tracks too (see PREFERS_AAC); `bytes` rides
	// along with its source so the gate progress still weights the right file
	if (PREFERS_AAC) {
		for (const track of Object.values(manifest.tracks ?? manifest) as Array<{ src?: string[]; bytes?: number[] }>) {
			if (!Array.isArray(track?.src)) continue;
			const order = orderSources(track.src).map((ref) => track.src!.indexOf(ref));
			if (Array.isArray(track.bytes) && track.bytes.length === track.src.length) track.bytes = order.map((i) => track.bytes![i]);
			track.src = order.map((i) => track.src![i]);
		}
	}
	// THE GAPLESS LOOPS (Manticore's method, utils-sound createMusic.svelte.ts BUFFERED LOOPS: each named loop starts on
	// its stream, and once it plays and the context runs the same stamped file is fetched, decoded into one AudioBuffer
	// and handed over to a Web Audio loop with a 40 ms crossfade; never a blob: URL). Manticore names only its iPhone
	// base. Run Over Reindeer names ALL THREE of its loops, on EVERY platform (round 2, 2026-11-15): Corey approved each
	// as a clean join by ear, and streamed they were not clean anywhere but the iPhone base (measured in round 1: on the
	// iPhone path the Free Spins wrap repeated about 1.1 s, WebKit bug 230553; desktop Chromium left 14 to 69 ms of
	// silence at every wrap of all three). Only the track playing holds a decoded copy, and it goes when another starts:
	// iPhone (mono .m4a, 48 kHz) base 6.1 MB, Free Spins 4.6 MB, Super 3.1 MB; desktop and Android (stereo .ogg) about
	// 12.3, 9.2 and 6.1 MB at 48 kHz (11.3, 8.5, 5.6 at 44.1). A browser that cannot decode the file keeps streaming.
	sound.loadMusic(holdSideTracks(manifest), { bufferedLoops: ['bgm_base', 'bgm_bonus', 'bgm_super'] });
};

// DEV only (compiled out of every build): musicDiag is the menu readout line
// (createSound diag), musicLoop the base loop's decoded copy (phase, position) while it has one, musicPlay asks for a
// track the way the game does (Sound.svelte soundMusic), so the probe can switch away from the base and back.
if (import.meta.env.DEV && typeof window !== 'undefined') {
	Object.assign(((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {}), {
		musicDiag: () => sound.diag(),
		musicLoop: () => (sound.players.music as unknown as { loopState?: unknown }).loopState ?? null,
		musicPlay: (name: MusicName) => sound.players.music.play({ name }),
		/** THE EFFECTS TAP (the sound probe): from the first call, every play, stop, fade, rate and end on the effects sprite's
		 *  Howl, with performance.now() and the board's frame (__reindeer.frame), oldest first; clear = true empties it.
		 *  `playing` lists the sprite names sounding now. Null until the sprite has loaded. */
		soundTap: (clear = false) => {
			const howl = sound.players?.once?.howl as unknown as TappedHowl | undefined;
			if (!howl || howl.state() !== 'loaded') return null;
			if (!howl.__tap) {
				const log: TapEntry[] = [];
				const names = new Map<number, string>();
				const frame = () => Number((window as unknown as { __reindeer?: { frame?: () => number } }).__reindeer?.frame?.() ?? -1);
				const push = (what: TapEntry['what'], id: number, name?: string, detail?: string) => {
					log.push({ t: performance.now(), frame: frame(), what, id, name: name ?? names.get(id) ?? '?', detail });
					if (log.length > 6000) log.splice(0, 3000);
				};
				const play = howl.play.bind(howl);
				const stop = howl.stop.bind(howl);
				const fade = howl.fade.bind(howl);
				const rate = howl.rate.bind(howl);
				howl.play = (sprite?: string | number, internal?: boolean) => {
					const id = play(sprite, internal);
					if (typeof sprite === 'string' && typeof id === 'number') {
						names.set(id, sprite);
						push('play', id, sprite);
					}
					return id;
				};
				howl.stop = (id?: number, internal?: boolean) => {
					if (typeof id === 'number' && howl.playing(id)) push('stop', id);
					return stop(id, internal);
				};
				howl.fade = (from: number, to: number, len: number, id?: number) => {
					if (typeof id === 'number') push('fade', id, undefined, `${from.toFixed(2)}>${to.toFixed(2)} ${len}ms`);
					return fade(from, to, len, id);
				};
				// a play's own rate (the crosshair's hops): logged as `rate <value>` against its play id
				howl.rate = (...a: unknown[]) => {
					if (typeof a[0] === 'number' && typeof a[1] === 'number') push('rate', a[1], undefined, `${a[0]}`);
					return rate(...(a as []));
				};
				howl.on('end', (id: number) => push('end', id));
				// what was already sounding when the tap went in (the road's ambience starts as the sprite lands): named
				for (const sd of (howl as unknown as { _sounds?: { _id: number; _sprite: string; _paused: boolean }[] })._sounds ?? []) if (!sd._paused && sd._sprite) names.set(sd._id, sd._sprite);
				howl.__tap = { log, names };
			}
			const tap = howl.__tap;
			const out = tap.log.slice();
			if (clear) tap.log.length = 0;
			const playing = [...tap.names.entries()].filter(([id]) => howl.playing(id)).map(([id, name]) => ({ id, name }));
			return { log: out, playing };
		},
	});
}
type TapEntry = { t: number; frame: number; what: 'play' | 'stop' | 'fade' | 'end' | 'rate'; id: number; name: string; detail?: string };
type TappedHowl = {
	state: () => string;
	playing: (id?: number) => boolean;
	play: (sprite?: string | number, internal?: boolean) => number;
	stop: (id?: number, internal?: boolean) => unknown;
	fade: (from: number, to: number, len: number, id?: number) => unknown;
	rate: (...a: unknown[]) => unknown;
	on: (event: string, fn: (id: number) => void) => unknown;
	__tap?: { log: TapEntry[]; names: Map<number, string> };
};

// ── the music's side tracks wait until the audio the landing screen gates on is in (the house rule, from Manticore) ──
// The shared player (utils-sound createMusic, left alone) starts buffering every track it can list 3 s after the music
// first plays, i.e. 3 s after PRESS ANYWHERE. When the gate was capped its files are still on the wire then, and the four
// side tracks would take a share of the link from them. So until releaseMusicSideTracks() (components/Game.svelte, when
// the gate has settled) the manifest's track table LISTS only the gate track; every track is still there by name, so a
// side track that is played starts as ever. When the gate was not capped (the usual case) it has settled before the
// player lists the table and nothing changes. When it was, the side tracks are not buffered ahead: each one streams
// when it is first played, as it always has on iOS (whose media elements buffer nothing before play()). Measured
// 2026-10-16: warming them into the HTTP cache instead put their WHOLE files on the wire (3.2 MB) where the player's
// own buffering takes about 0.5 MB.
let sideHeld = true;
let gateTrack: string | undefined;
const holdSideTracks = (manifest: MusicManifest<MusicName>): MusicManifest<MusicName> => {
	if (!sideHeld) return manifest;
	gateTrack = manifest.gate;
	const tracks = new Proxy(manifest.tracks, {
		ownKeys: (target) => (sideHeld ? Reflect.ownKeys(target).filter((key) => key === gateTrack) : Reflect.ownKeys(target)),
	});
	return { ...manifest, tracks };
};
/** the gate has settled: the side tracks may be listed (see above). Idempotent. */
export const releaseMusicSideTracks = (): void => {
	sideHeld = false;
};

/** Idempotent — call it as early as possible; extra calls are free. */
export const startSoundPreload = () => {
	if (preloadStarted || typeof window === 'undefined') return;
	preloadStarted = true;

	// kicked in parallel with the sprite: two independent downloads, one gate. expectMusic() is
	// synchronous and must come first — the sfx sprite is small enough to finish before music.json
	// lands, and the gate would otherwise open on a game with no music player yet.
	sound.expectMusic();
	void (async () => {
		let lastError: unknown;
		for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
			try {
				await loadMusicManifest();
				return;
			} catch (error) {
				lastError = error;
				await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
			}
		}
		sound.markMusicUnavailable(lastError);
	})();

	void (async () => {
		let lastError: unknown;
		for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
			try {
				const manifestResponse = await fetch(assets.sound.src);
				if (!manifestResponse.ok) throw new Error(`sounds.json ${manifestResponse.status}`);
				const manifest = (await manifestResponse.json()) as SoundManifest;
				const candidates = pickSources(manifest.src);
				const picked = candidates[0];
				if (!picked) throw new Error('no supported audio format in sounds.json src[]');
				// weight the sprite by its real size from the first moment: before the first chunk the
				// progress blend had 0 bytes for it and read 100% off the music gate alone (2026-09-15)
				const rel = /\/assets\/([^?#]+)/.exec(picked.url)?.[1];
				const expected = rel ? (fileBytes as Record<string, number>)[rel] : undefined;
				if (expected) sound.reportDownloadProgress(0, expected);
				await prefetchWithProgress(picked.url);
				sound.load(
					{ src: [picked.url], sprite: manifest.sprite, config: manifest.config },
					{ format: [picked.ext] },
				);
				// a browser that CLAIMS a format and then cannot decode it (see PREFERS_AAC) fails the
				// sprite with loaderror; try the next playable source before giving up on effects
				void (async () => {
					for (const next of candidates.slice(1)) {
						while (sound.loadStatus === 'loading' || sound.loadStatus === 'idle') await new Promise((r) => setTimeout(r, 250));
						if (sound.loadStatus !== 'error') return;
						console.warn(`[sound] sprite .${extOf(next.url)} retry after a decode failure`);
						sound.load({ src: [next.url], sprite: manifest.sprite, config: manifest.config }, { format: [next.ext] });
					}
				})();
				return;
			} catch (error) {
				lastError = error;
				await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
			}
		}
		sound.markLoadFailed(lastError);
	})();
};

export { sound };
