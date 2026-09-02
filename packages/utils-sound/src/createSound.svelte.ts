import { Howler, type Howl } from 'howler';

import { type LoadedAudio } from 'pixi-svelte';
import { stateSoundDerived } from 'state-shared';

import { createPlayer, type Player } from './createPlayer.svelte';
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
	const reportDownloadProgress = (ratio: number) => {
		if (loadStatus === 'loaded' || loadStatus === 'error') return;
		if (loadStatus === 'idle') loadStatus = 'loading';
		downloadRatio = Math.max(0, Math.min(1, ratio));
	};

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
		if (players) {
			players.music.stop(stopOptions);
			players.loop.stop(stopOptions);
			players.once.stop(stopOptions);
		}
	};

	const fade = async (fadeOptions: FadeOptions<TSoundName>) => {
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
		stop,
		fade,
		rate,
		volumeEffect,
		enableEffect,
		reportDownloadProgress,
		markLoadFailed,
		destroy,
		get players() {
			return players ?? silentPlayers;
		},
		get loadStatus() {
			return loadStatus;
		},
		/** Safe to let the player in: the sprite is decoded, or it failed and we run silent. */
		get isReady() {
			return loadStatus === 'loaded' || loadStatus === 'error';
		},
		/** 0..1 for a loading bar. Sits at 1 while Howler decodes the downloaded bytes. */
		get progress() {
			return loadStatus === 'loaded' || loadStatus === 'error' ? 1 : downloadRatio;
		},
	};
}

export { createSound };
