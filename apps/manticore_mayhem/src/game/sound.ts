import { createSound, supportsAudioFormat, type MusicManifest } from 'utils-sound';

import assets from './assets';
import { fileBytes } from './assetStamp';
import { LOAD_GATE } from './constants';

// Names match tools/build_audiosprite.py. MusicName lives in music.json (one streamed file per
// track); every SoundEffectName lives in the sounds.json audiosprite.
export type MusicName = 'bgm_base' | 'bgm_bonus' | 'bgm_super' | 'bgm_epic' | 'bgm_maxwin';

// One key per Manticore event (tools/build_audiosprite.py MM_EVENTS): a key with no Manticore
// recording yet plays its borrowed Angry Mantis clip, or silence. Manticore's own since 2026-10-11: the five
// sfx_win_* tier landings, the sfx_money_counter loop and the sfx_tile_double tick; the two fire loops (game/
// fireSound.ts) and the chain sounds (game/chainSound.ts; sfx_chain_light_logo is the light rattle again, quieter:
// the same sprite region with its own volume). The scatter landings, the
// bonus-trigger fanfares and the ui clicks are the house set shared across games.
export type SoundEffectName =
	| 'sfx_scatter_land_1'
	| 'sfx_scatter_land_2'
	| 'sfx_scatter_land_3'
	| 'sfx_scatter_land_4'
	| 'sfx_scatter_land_5'
	| 'sfx_scatter_land_6'
	| 'sfx_ui_button'
	| 'sfx_ui_spin'
	| 'sfx_ui_bonus'
	| 'sfx_ui_minor'
	| 'sfx_ui_sub'
	| 'sfx_bonus_trigger_free'
	| 'sfx_bonus_trigger_super'
	| 'sfx_bonus_trigger_feast'
	| 'sfx_reel_spin'
	| 'sfx_reel_stop'
	| 'sfx_cluster_remove'
	// THE CLUSTER ACCENTS (1.0.04, Corey 2026-10-20): one per paying symbol, played in place of sfx_cluster_remove as that
	// symbol's cluster starts (game/bookEventHandlerMap.ts clusterSound)
	| 'sfx_clear_l1'
	| 'sfx_clear_l2'
	| 'sfx_clear_l3'
	| 'sfx_clear_l4'
	| 'sfx_clear_m1'
	| 'sfx_clear_m2'
	| 'sfx_clear_m3'
	| 'sfx_clear_h1'
	| 'sfx_tile_double'
	| 'sfx_cascade'
	| 'sfx_money_counter'
	| 'sfx_swipe'
	| 'sfx_roar'
	| 'sfx_roar_win'
	| 'sfx_sting_hit'
	| 'sfx_sting_big_charge'
	| 'sfx_sting_big_hit'
	| 'sfx_sting_super_charge'
	| 'sfx_sting_super_hit'
	| 'sfx_scatter_sting'
	| 'sfx_win_big'
	| 'sfx_win_super'
	| 'sfx_win_mega'
	| 'sfx_win_epic'
	| 'sfx_win_max'
	| 'sfx_mystery_tease'
	| 'sfx_mystery_decision'
	| 'sfx_chain_heavy'
	| 'sfx_chain_light'
	| 'sfx_chain_light_logo'
	| 'sfx_fire_super'
	| 'sfx_fire_epic'
	// the creature's own (game/creature.ts, 2026-10-13): one breath per idle loop, the snarl and the growl, two takes each
	| 'sfx_manticore_breath_1'
	| 'sfx_manticore_breath_2'
	| 'sfx_manticore_snarl_1'
	| 'sfx_manticore_snarl_2'
	| 'sfx_manticore_growl_1'
	| 'sfx_manticore_growl_2'
	// the win plaque's landing thump (components/StingerPlaque.svelte, 2026-10-15): every impact, under a tier's stab
	| 'sfx_plaque_land';

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
	// THE GAPLESS BASE LOOP ON iPHONE (2026-10-23, Corey: "I'd like to make an attempt at fixing the iPhone loop before
	// Monday, the other background music doesn't need to loop"). WebKit leaves a pause at every wrap of a looping media
	// element, so on Apple touch devices bgm_base, and only bgm_base, is handed from its stream to a decoded Web Audio
	// loop once it plays (utils-sound createMusic.svelte.ts, BUFFERED LOOPS). Every other track, and every track on
	// desktop and Android, streams as before. The iPhone file is the 60 s mono .m4a (tools/build_audiosprite.py): its
	// decoded copy is about 11.5 MB at 48 kHz.
	sound.loadMusic(holdSideTracks(manifest), { bufferedLoops: PREFERS_AAC ? ['bgm_base'] : [] });
};

// DEV only (compiled out of every build), for tools/manticore/music_loop_probe.js: musicDiag is the menu readout line
// (createSound diag), musicLoop the base loop's decoded copy (phase, position) while it has one, musicPlay asks for a
// track the way the game does (Sound.svelte soundMusic), so the probe can switch away from the base and back.
if (import.meta.env.DEV && typeof window !== 'undefined') {
	Object.assign(((window as unknown as { __manticore?: Record<string, unknown> }).__manticore ??= {}), {
		musicDiag: () => sound.diag(),
		musicLoop: () => (sound.players.music as unknown as { loopState?: unknown }).loopState ?? null,
		musicPlay: (name: MusicName) => sound.players.music.play({ name }),
	});
}

// ── the music's side tracks wait for THE GATE (first-minute plan D, constants LOAD_GATE.musicSideTracks) ──────────────
// The shared player (utils-sound createMusic, left alone) starts buffering every track it can list 3 s after the music
// first plays, i.e. 3 s after PRESS ANYWHERE. When the gate was capped its files are still on the wire then, and the four
// side tracks would take a share of the link from them. So until releaseMusicSideTracks() (components/Game.svelte, when
// the gate has settled) the manifest's track table LISTS only the gate track; every track is still there by name, so a
// side track that is played starts as ever. When the gate was not capped (the usual case) it has settled before the
// player lists the table and nothing changes. When it was, the side tracks are not buffered ahead: each one streams
// when it is first played, as it always has on iOS (whose media elements buffer nothing before play()). Measured
// 2026-10-16: warming them into the HTTP cache instead put their WHOLE files on the wire (3.2 MB) where the player's
// own buffering takes about 0.5 MB, in front of the creature's sheets.
let sideHeld = LOAD_GATE.musicSideTracks === 'afterGate';
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
