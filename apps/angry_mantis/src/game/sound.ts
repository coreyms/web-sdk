import { createSound, supportsAudioFormat } from 'utils-sound';

import assets from './assets';

// Names match tools/build_audiosprite.py (static/assets/audio/sounds.json).
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
	| 'sfx_door_close'
	| 'sfx_door_open'
	| 'sfx_marty_strike'
	| 'sfx_marty_eat'
	| 'sfx_marty_angry'
	| 'sfx_marty_happy'
	| 'sfx_marty_poke'
	| 'sfx_win_big'
	| 'sfx_money_counter'
	| 'sfx_ui_button'
	| 'sfx_ui_spin'
	| 'sfx_ui_bonus';

export type SoundName = MusicName | SoundEffectName;

const sound = createSound<SoundName>();

// ── audiosprite preload ────────────────────────────────────────────────────────────────────────
// The sprite is the single biggest file the game ships. It used to be constructed by EnableSound,
// a child of pixi-svelte's AssetsLoader, so the download only STARTED once every image had already
// finished — and nothing gated on it, so the landing screen said PRESS ANYWHERE while megabytes of
// audio were still in flight (minutes of silent gameplay on a slow link).
//
// So we own the fetch: kicked at app start (see routes/+layout.svelte) in parallel with the image
// preload, streamed so we get real byte progress for the loading bar, then handed to Howler as an
// object URL. Constructing/decoding a Howl before a user gesture is fine — only playback needs the
// gesture, and Howler's own unlock handler covers that.
type SoundManifest = {
	src: string[];
	sprite: Record<string, [number, number] | [number, number, boolean]>;
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

const fetchWithProgress = async (url: string) => {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`audiosprite ${response.status} ${response.statusText}`);
	// no streaming body (very old browsers): fall back to letting Howler fetch the URL itself
	if (!response.body) return url;

	const total = Number(response.headers.get('content-length')) || 0;
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let received = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		received += value.length;
		if (total) sound.reportDownloadProgress(received / total);
	}
	sound.reportDownloadProgress(1);
	const type = response.headers.get('content-type') ?? 'application/octet-stream';
	return URL.createObjectURL(new Blob(chunks as BlobPart[], { type }));
};

/** Idempotent — call it as early as possible; extra calls are free. */
export const startSoundPreload = () => {
	if (preloadStarted || typeof window === 'undefined') return;
	preloadStarted = true;

	void (async () => {
		let lastError: unknown;
		for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
			try {
				const manifestResponse = await fetch(assets.sound.src);
				if (!manifestResponse.ok) throw new Error(`sounds.json ${manifestResponse.status}`);
				const manifest = (await manifestResponse.json()) as SoundManifest;
				const picked = pickSource(manifest.src);
				if (!picked) throw new Error('no supported audio format in sounds.json src[]');
				const src = await fetchWithProgress(picked.url);
				sound.load(
					{ src: [src], sprite: manifest.sprite, config: manifest.config },
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
