import { Howler, Howl } from 'howler';

import { type LoadedAudio } from 'pixi-svelte';
import { stateSoundDerived } from 'state-shared';

import { createPlayer, type Player } from './createPlayer.svelte';
import { createMusicPlayer, type MusicManifest, type MusicPlayer } from './createMusic.svelte';
import { createPlayMusic } from './createPlayMusic.svelte';
import { createPlayLoop } from './createPlayLoop.svelte';
import { createPlayOnce } from './createPlayOnce.svelte';
import type { FadeOptions, RateOptions, StopOptions } from './types';

// 'loading' covers both the network fetch and Howler's decode; 'error' means we gave up and the
// game runs silently (see loadStatus/isReady below — the caller must NOT gate its UI forever).
export type AudioLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** Can this browser decode `<ext>`? Re-exported so a game can prefetch the right file of an
 *  audiosprite's src[] itself (for byte progress) without taking a direct howler dependency. */
export const supportsAudioFormat = (ext: string) => Boolean(Howler.codecs(ext));

function createSound<TSoundName extends string>() {
	type PlayMusic = ReturnType<typeof createPlayMusic<TSoundName>>['play'];
	type PlayLoop = ReturnType<typeof createPlayLoop<TSoundName>>['play'];
	type PlayOnce = ReturnType<typeof createPlayOnce<TSoundName>>['play'];

	let loadedAudio: LoadedAudio<TSoundName>;
	let audioContextState = $state<AudioContext['state']>('running');
	let visibilityState = $state<DocumentVisibilityState>('visible');
	let players: {
		music: Player<TSoundName, PlayMusic>;
		loop: Player<TSoundName, PlayLoop>;
		once: Player<TSoundName, PlayOnce>;
	};

	// Reactive load surface so a loading screen can gate on the audiosprite (an 11 MB file that used
	// to download invisibly behind a playable game — minutes of silence on a slow link, then every
	// queued play() firing at once when it finally landed).
	let loadStatus = $state<AudioLoadStatus>('idle');
	let downloadRatio = $state(0);
	let playersReady = $state(false);
	let destroySound: (() => void) | undefined;

	// ── streamed music (see createMusic.svelte.ts) ────────────────────────────────────────────
	// Music is NOT part of the sprite any more: the sprite is decoded whole into an AudioBuffer, so
	// keeping five loops in it cost ~130 MB of resident RAM to play one of them. loadMusic() hands
	// the music bus to a player that streams one media element per track; when it is used, it
	// REPLACES players.music, and stop/fade/rate/volume below route to it by name.
	let musicPlayer: MusicPlayer<TSoundName> | undefined;
	let musicPlayerReady = $state(false);
	// the loading screen may not open the door until the gate track can start (or we gave up on it)
	let musicGateActive = $state(false);
	let musicGateSettled = $state(false);
	let musicGateRatio = $state(0);
	let musicGateBytes = $state(0);
	let spriteBytes = $state(0);
	// Music requested before the player exists. The sfx players deliberately DROP early plays (a
	// one-shot that missed its moment is gone), but music has no moment to miss — it is just "what
	// should be playing now" — so we remember the last request and start it when the player lands.
	// This is the same contract createPlayMusic had while the sprite was still decoding.
	let pendingMusicName: TSoundName | undefined;

	/** Called synchronously by the app before it fetches music.json, so the readiness gate below
	 *  knows to wait for music that has not been declared yet. Without it there is a live race: the
	 *  sfx sprite is small and can finish first, isReady would go true with no music player built,
	 *  and the boot-time musicPlay would land on the silent stand-in and never be heard. */
	const expectMusic = () => (musicGateActive = true);

	/** The manifest could not be fetched — open the door and run without music. */
	const markMusicUnavailable = (error?: unknown) => {
		console.error('[sound] music manifest unavailable; continuing without music', error);
		musicGateSettled = true;
	};

	const loadMusic = (manifest: MusicManifest<TSoundName>) => {
		if (musicPlayer) return;
		musicGateActive = true;
		// Howler suspends the AudioContext after 30 s with no WEB AUDIO sound playing. That used to
		// be a fine proxy for "nothing is playing" because the music lived in the sprite; now that
		// music streams through media elements, html5 playback does not count and the context gets
		// suspended under a perfectly audible loop. enableEffect() below watches ctx.state and would
		// then mute EVERYTHING — caught live: idle on the base game for 30 s and the music died.
		Howler.autoSuspend = false;
		musicPlayer = createMusicPlayer<TSoundName>(manifest, {
			onGateProgress: (ratio) => (musicGateRatio = ratio),
			onGateSettled: (result) => {
				if (result !== 'loaded') {
					// never hang the door on music — the track starts when it starts
					console.warn(`[sound] music gate settled as "${result}"; opening without it`);
				}
				musicGateRatio = 1;
				musicGateSettled = true;
			},
		});
		musicGateBytes = musicPlayer.gateBytes;
		musicPlayerReady = true;
		musicPlayer.volume(stateSoundDerived.volumeMusic());
		if (pendingMusicName) {
			musicPlayer.play({ name: pendingMusicName });
			pendingMusicName = undefined;
		}
		return musicPlayer;
	};

	const load = (
		loadedAudioValue: LoadedAudio<TSoundName>,
		loadOptions?: { format?: string[] },
	) => {
		// loadedAudio
		loadedAudio = loadedAudioValue;
		loadStatus = 'loading';

		const howl = new Howl({
			src: loadedAudio.src,
			sprite: loadedAudio.sprite,
			volume: 1,
			// the caller may hand us an object URL it fetched itself (for byte progress), which has
			// no extension for Howler to sniff — it needs the format spelled out then
			...(loadOptions?.format ? { format: loadOptions.format } : {}),
		});

		howl.once('load', () => {
			downloadRatio = 1;
			loadStatus = 'loaded';
		});
		howl.once('loaderror', (_id: number, error: unknown) => {
			// never hang the gate on a broken sprite — let the player in silently
			console.error('[sound] audiosprite failed to load; continuing without audio', error);
			loadStatus = 'error';
		});

		// players
		players = {
			music: createPlayer<TSoundName, PlayMusic>({ loadedAudio, loop: true, howl, createPlay: createPlayMusic<TSoundName> }), // prettier-ignore
			loop: createPlayer<TSoundName, PlayLoop>({ loadedAudio, loop: true, howl, createPlay: createPlayLoop<TSoundName> }), // prettier-ignore
			once: createPlayer<TSoundName, PlayOnce>({ loadedAudio, loop: false, howl, createPlay: createPlayOnce<TSoundName> }), //  prettier-ignore
		};
		playersReady = true;

		// audioContextState and visibilityState
		const onAudioContextChange = () => (audioContextState = Howler.ctx.state);
		const onVisibilityStateChange = () => (visibilityState = document.visibilityState);

		Howler.ctx.addEventListener('statechange', onAudioContextChange);
		document.addEventListener('visibilitychange', onVisibilityStateChange);

		const destroy = () => {
			musicPlayer?.unload();
			Howler.ctx.removeEventListener('statechange', onAudioContextChange);
			document.removeEventListener('visibilitychange', onVisibilityStateChange);

			if (players) {
				players.music.howl.unload();
				players.loop.howl.unload();
				players.once.howl.unload();
			}
		};

		destroySound = destroy;

		return {
			destroy,
		};
	};

	// Progress of the caller's own fetch of the sprite (0..1). Howler exposes no download progress,
	// so whoever fetches the bytes reports them here and the loading screen can show a moving bar.
	// `totalBytes` (Content-Length) lets progress below weight the sprite against the music gate
	// track by their real sizes instead of a guessed split.
	const reportDownloadProgress = (ratio: number, totalBytes?: number) => {
		if (totalBytes) spriteBytes = totalBytes;
		if (loadStatus === 'loaded' || loadStatus === 'error') return;
		if (loadStatus === 'idle') loadStatus = 'loading';
		downloadRatio = Math.max(0, Math.min(1, ratio));
	};

	// The two things the door waits on. The sprite must be fully decoded (it is Web Audio, it is
	// all-or-nothing); the music gate track only has to be startable, and is allowed to give up.
	const spriteDone = () => loadStatus === 'loaded' || loadStatus === 'error';
	const musicDone = () => !musicGateActive || musicGateSettled;

	// Called when the caller's fetch/retries are exhausted — the Howl was never constructed.
	const markLoadFailed = (error?: unknown) => {
		if (loadStatus === 'loaded') return;
		console.error('[sound] audiosprite unavailable; continuing without audio', error);
		loadStatus = 'error';
	};

	const destroy = () => destroySound?.();

	// If the sprite never loads, `players` is never assigned — but the game deliberately still opens
	// (silently), and its emitter handlers reach straight into sound.players.once.play(...). Hand
	// them a no-op stand-in so a failed download costs the player audio, not the first button press.
	const silentPlayer = <TPlay extends Function>(): Player<TSoundName, TPlay> =>
		({
			play: () => {},
			stop: () => {},
			fade: async () => {},
			rate: () => {},
			volume: () => {},
			debug: () => {},
			howl: undefined as unknown as Howl,
		}) as unknown as Player<TSoundName, TPlay>;

	const silentPlayers = {
		music: silentPlayer<PlayMusic>(),
		loop: silentPlayer<PlayLoop>(),
		once: silentPlayer<PlayOnce>(),
	};

	const stop = (stopOptions: StopOptions<TSoundName>) => {
		musicPlayer?.stop(stopOptions);
		if (players) {
			players.music.stop(stopOptions);
			players.loop.stop(stopOptions);
			players.once.stop(stopOptions);
		}
	};

	const fade = async (fadeOptions: FadeOptions<TSoundName>) => {
		await musicPlayer?.fade(fadeOptions);
		if (players) {
			const getPromises = () => [
				players.music.fade(fadeOptions),
				players.loop.fade(fadeOptions),
				players.once.fade(fadeOptions),
			];

			await Promise.all(getPromises());
		}
	};

	const rate = (rateOptions: RateOptions<TSoundName>) => {
		musicPlayer?.rate(rateOptions);
		if (players) {
			players.music.rate(rateOptions);
			players.loop.rate(rateOptions);
			players.once.rate(rateOptions);
		}
	};

	const disable = () => {
		Howler.volume(0);
		Howler.mute(true);
	};

	const enable = () => {
		Howler.volume(1);
		Howler.mute(false);
	};

	const enableEffect = () => {
		$effect(() => {
			if (audioContextState === 'running' && visibilityState === 'visible') {
				enable();
			} else {
				disable();
			}
		});
	};


	// `players` is a plain let, so these effects would NOT re-run when it finally gets assigned —
	// and it IS assigned asynchronously now that the sprite loads in the background, whereas it used
	// to be assigned inside onMount before any effect ran. playersReady ($state, flipped right after
	// the assignment) subscribes them to it, so the mixer levels land on the players the moment they
	// exist. Without this, playerVolume silently stayed at its 1 default.
	const volumeMusicEffect = () => {
		if (musicPlayerReady && musicPlayer) {
			musicPlayer.volume(stateSoundDerived.volumeMusic());
			return;
		}
		if (playersReady && players) {
			players.music.volume(stateSoundDerived.volumeMusic());
		}
	};

	const volumeLoopEffect = () => {
		if (playersReady && players) {
			players.loop.volume(stateSoundDerived.volumeSoundEffect());
		}
	};

	const volumeOnceEffect = () => {
		if (playersReady && players) {
			players.once.volume(stateSoundDerived.volumeSoundEffect());
		}
	};

	const volumeEffect = () => {
		$effect(() => {
			volumeMusicEffect();
		});

		$effect(() => {
			volumeLoopEffect();
		});

		$effect(() => {
			volumeOnceEffect();
		});
	};

	return {
		load,
		loadMusic,
		expectMusic,
		markMusicUnavailable,
		stop,
		fade,
		rate,
		volumeEffect,
		enableEffect,
		reportDownloadProgress,
		markLoadFailed,
		destroy,
		get players() {
			const base = players ?? silentPlayers;
			// music was declared but its player has not been built yet — bank the request
			if (musicGateActive && !musicPlayerReady) {
				return {
					...base,
					music: {
						...silentPlayers.music,
						play: (playOptions: { name: TSoundName }) =>
							(pendingMusicName = playOptions.name),
					} as unknown as Player<TSoundName, PlayMusic>,
				};
			}
			// musicPlayerReady is read (not just musicPlayer) so $derived/$effect consumers
			// re-run when the music player lands asynchronously
			return musicPlayerReady && musicPlayer
				? { ...base, music: musicPlayer as unknown as Player<TSoundName, PlayMusic> }
				: base;
		},
		get loadStatus() {
			return loadStatus;
		},
		/** Safe to let the player in: the sfx sprite is decoded (or failed and we run silent) AND
		 *  the base music track has buffered enough to start (or we gave up waiting for it). */
		get isReady() {
			return spriteDone() && musicDone();
		},
		/** 0..1 for a loading bar, weighted by the real byte sizes of the two downloads: the sfx
		 *  sprite (Content-Length of our own fetch) and the gate music track (its size from
		 *  music.json, filled by the element's buffered ranges). Sits at 1 while Howler decodes. */
		get progress() {
			const sprite = spriteDone() ? 1 : downloadRatio;
			const music = musicDone() ? 1 : musicGateRatio;
			if (!musicGateActive) return sprite;
			const total = spriteBytes + musicGateBytes;
			if (!total) return (sprite + music) / 2;
			return (sprite * spriteBytes + music * musicGateBytes) / total;
		},
	};
}

export { createSound };
