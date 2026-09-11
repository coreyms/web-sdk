import { createSound, supportsAudioFormat, type MusicManifest } from 'utils-sound';

import assets from './assets';

// Names match tools/build_audiosprite.py. MusicName lives in music.json (one streamed file per
// track); every SoundEffectName lives in the sounds.json audiosprite.
export type MusicName = 'bgm_base' | 'bgm_free' | 'bgm_super' | 'bgm_feast' | 'bgm_maxwin';

export type SoundEffectName =
	| 'sfx_reel_spin'
	| 'sfx_reel_stop'
	| 'sfx_scatter_land_1'
	| 'sfx_scatter_land_2'
	| 'sfx_scatter_land_3'
	| 'sfx_scatter_land_4'
	| 'sfx_scatter_land_5'
	| 'sfx_leaf_land'
	| 'sfx_service_bell'
	| 'sfx_door_close'
	| 'sfx_door_open'
	| 'sfx_marty_strike'
	| 'sfx_marty_eat'
	| 'sfx_marty_angry'
	| 'sfx_marty_happy'
	| 'sfx_marty_poke'
	| 'sfx_win_big'
	| 'sfx_win_super'
	| 'sfx_win_mega'
	| 'sfx_win_epic'
	| 'sfx_win_max'
	| 'sfx_money_counter'
	| 'sfx_ui_button'
	| 'sfx_ui_spin'
	| 'sfx_ui_bonus'
	| 'sfx_wild_land'
	| 'sfx_ui_minor'
	| 'sfx_ui_sub'
	| 'sfx_marty_strike_2'
	| 'sfx_marty_strike_3'
	| 'sfx_marky_strike'
	| 'sfx_marty_eat_2'
	| 'sfx_marty_eat_3'
	| 'sfx_marky_eat'
	| 'sfx_marty_angry_2'
	| 'sfx_marty_angry_3'
	| 'sfx_marty_happy_2'
	| 'sfx_marty_happy_3'
	| 'sfx_marty_poke_2'
	| 'sfx_marty_poke_3'
	| 'sfx_marty_astonished'
	| 'sfx_marty_astonished_2'
	| 'sfx_marty_astonished_3'
	| 'sfx_bonus_trigger_free'
	| 'sfx_bonus_trigger_super'
	| 'sfx_bonus_trigger_feast';

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
const pickSource = (srcList: string[]) => {
	for (const ref of srcList) {
		const ext = (ref.split('?')[0].split('.').pop() ?? '').toLowerCase();
		if (ext && supportsAudioFormat(ext)) return { url: new URL(ref, document.baseURI).href, ext };
	}
	return undefined;
};

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
	sound.loadMusic((await response.json()) as MusicManifest<MusicName>);
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
				const picked = pickSource(manifest.src);
				if (!picked) throw new Error('no supported audio format in sounds.json src[]');
				await prefetchWithProgress(picked.url);
				sound.load(
					{ src: [picked.url], sprite: manifest.sprite, config: manifest.config },
					{ format: [picked.ext] },
				);
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
