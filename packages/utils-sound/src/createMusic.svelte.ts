import { Howl } from 'howler';

/**
 * Streamed music player — one HTML5 <audio> stream per track, created lazily.
 *
 * WHY THIS EXISTS (2026-09-02). Music used to live inside the Howler audiosprite alongside the sfx.
 * A sprite is Web Audio: Howler calls decodeAudioData once and holds ONE AudioBuffer for the whole
 * file, so all five loops were resident, decoded, forever — 366 s x 44.1 kHz x 2ch x 4 bytes of
 * Float32 = ~130 MB of RAM on a phone that never plays more than one loop at a time. Streaming the
 * music through media elements instead costs essentially nothing: the browser holds a bounded,
 * *compressed* buffer it is free to evict, and there is no decodeAudioData at all.
 *
 * WHY IT DOES NOT USE HOWLER'S `loop: true`. Howler only loops Web Audio natively. For an html5
 * sound its `_ended()` does `stop(id, true).play(id)` on a setTimeout — a pause + seek-to-zero +
 * play round trip. MEASURED in Chrome on bgm_base: **21.3 ms of inserted silence at every loop
 * boundary** (ScriptProcessor peak trace, 5.33 ms blocks), on top of a JS timer that drifts.
 * Corey's loops are seamless, so that is not acceptable.
 *
 * Instead each Howl is built with `loop: false` and we set `element.loop = true` on the underlying
 * media element ourselves. The browser's own loop is sample-exact: the same probe measured **0 ms**
 * for both the .ogg and the .m4a. The `loop: false` also matters structurally — it makes Howler
 * take its `ended`-listener branch instead of its end-timer branch, and a looping element never
 * fires `ended`, so nothing in Howler ever tries to restart or stop the sound behind our back.
 *
 * Autoplay: media playback still needs a user gesture. Howler's autoUnlock primes a pool of html5
 * elements on the first touchend/click (the landing-screen press), which is what lets a lazily
 * created stream start later on iOS. Buffering, unlike playing, needs no gesture on desktop — but
 * iOS Safari does defer buffering until play(), which is why the readiness gate below has a
 * watchdog and never blocks the door on a track that has not buffered.
 *
 * Expect ONE benign console warning at boot: "HTML5 Audio pool exhausted, returning potentially
 * locked audio object". Howler only fills its unlocked-element pool inside the first-gesture unlock
 * handler, and the gate track is deliberately created before that (it has to start buffering while
 * the landing screen is still up), so it gets an un-unlocked element. The same unlock handler then
 * walks every existing html5 Howl and unlocks its assigned node in place, so the element is
 * repaired by the landing press — which is why the base loop starts there. The tracks created after
 * boot draw from the now-full pool and never hit this path. Do not "fix" it by deferring the gate
 * track's creation to the press; that would put its whole download after the door instead of
 * behind the loading bar.
 */

export type MusicTrack = {
	/** preference-ordered, document-relative and already ?v= stamped (see build_audiosprite.py) */
	src: string[];
	/** byte size of each src[] entry, parallel array — lets the loading bar weight honestly */
	bytes?: number[];
	loop: boolean;
	duration: number;
	volume?: number;
};

export type MusicManifest<TSoundName extends string> = {
	/** the one track the loading screen waits for; everything else buffers after boot */
	gate?: TSoundName;
	tracks: Partial<Record<TSoundName, MusicTrack>>;
};

export type MusicPlayerOptions = {
	/** told the gate track's buffered fraction (0..1) as it fills */
	onGateProgress?: (ratio: number) => void;
	/** told once the gate track can start — or gave up (see watchdog constants) */
	onGateSettled?: (result: 'loaded' | 'error' | 'timeout') => void;
};

/** Hard ceiling on how long the loading screen may wait for the gate track. iOS Safari refuses to
 *  buffer a media element until play() is called, so on iOS 'load' may simply never arrive before
 *  the first gesture — without this the landing screen would sit at PRESS-disabled forever. */
const GATE_TIMEOUT_MS = 8000;
/** Shorter escape hatch for the same case: if the element has not buffered a single byte this long
 *  after we asked it to, preloading is being suppressed and waiting is pointless. */
const GATE_NO_PROGRESS_MS = 2500;
/** Delay before the non-gate tracks start buffering, so they never compete with the gate track or
 *  the image preload for bandwidth. Kicked off the first time music actually plays (post-press). */
const BACKGROUND_PRELOAD_DELAY_MS = 3000;

type Entry = {
	name: string;
	track: MusicTrack;
	howl: Howl;
	/** resolved once Howler has picked a source it can decode */
	bytes: number;
};

const absolute = (ref: string) =>
	typeof document === 'undefined' ? ref : new URL(ref, document.baseURI).href;

/** Howler picks the first src[] entry it has a codec for; `_src` is what it settled on. */
const chosenBytes = (howl: Howl, track: MusicTrack, urls: string[]) => {
	const picked = (howl as unknown as { _src: string })._src;
	const index = urls.indexOf(picked);
	return (index >= 0 && track.bytes?.[index]) || 0;
};

const nodeOf = (howl: Howl): HTMLAudioElement | undefined =>
	(howl as unknown as { _sounds?: { _node?: HTMLAudioElement }[] })._sounds?.[0]?._node;

export function createMusicPlayer<TSoundName extends string>(
	manifest: MusicManifest<TSoundName>,
	options: MusicPlayerOptions = {},
) {
	const entries = new Map<TSoundName, Entry>();
	/** mixer level for the music bus (stateSound music volume x the soundDuck multiplier) */
	let playerVolume = 1;
	/** per-track multiplier owned by fade() — mirrors createPlayer's soundVolume */
	const soundVolume = new Map<TSoundName, number>();
	/** the track that SHOULD be playing; guards a slow track from starting after a newer request */
	let requested: TSoundName | undefined;
	let backgroundPreloadStarted = false;
	let gateSettled = false;

	const trackOf = (name: TSoundName) => manifest.tracks[name];
	const isMusic = (name: TSoundName) => Boolean(trackOf(name));

	const levelFor = (name: TSoundName) =>
		playerVolume * (soundVolume.get(name) ?? 1) * (trackOf(name)?.volume ?? 1);

	const ensure = (name: TSoundName): Entry | undefined => {
		const existing = entries.get(name);
		if (existing) return existing;
		const track = trackOf(name);
		if (!track) return undefined;

		const urls = track.src.map(absolute);
		const howl = new Howl({
			src: urls,
			html5: true, // stream through a media element — no decodeAudioData, no AudioBuffer
			loop: false, // deliberate: we set element.loop ourselves, see the header comment
			preload: true,
			volume: levelFor(name),
		});
		const entry: Entry = { name, track, howl, bytes: chosenBytes(howl, track, urls) };
		entries.set(name, entry);
		return entry;
	};

	/** Hand the loop back to the browser rather than to Howler's stop()/play() re-trigger. */
	const applyElementLoop = (entry: Entry) => {
		const node = nodeOf(entry.howl);
		if (node) node.loop = entry.track.loop;
	};

	/**
	 * Start `entry`, whether or not it has buffered yet.
	 *
	 * A Howl that is not loaded queues the play internally and runs it on its own load event, so we
	 * must NOT also start it from a `load` listener of our own — that second play() would find the
	 * first sound already playing, take another element out of the pool and stream the same track
	 * twice. Everything that has to happen at the real start therefore hangs off `play` instead:
	 *   - element.loop, which is what makes the loop seamless (see the header comment), and which
	 *     has to be re-asserted here because a deferred start can be served by a different node;
	 *   - the volume, so a track that finally starts uses the CURRENT mixer level and not whatever
	 *     it was when the request was made;
	 *   - the still-wanted check, so a loop that finished downloading after the game moved on
	 *     (bonus already over) stops instead of barging in.
	 */
	const startNow = (entry: Entry) => {
		const name = entry.name as TSoundName;
		entry.howl.volume(levelFor(name));
		entry.howl.once('play', () => {
			if (requested !== name) {
				entry.howl.stop();
				return;
			}
			applyElementLoop(entry);
			entry.howl.volume(levelFor(name));
		});
		entry.howl.play();
		applyElementLoop(entry); // already-buffered case: the node exists and starts immediately
		scheduleBackgroundPreload();
	};

	/** Buffer the tracks the player has not asked for yet, so a bonus transition never stalls. */
	const scheduleBackgroundPreload = () => {
		if (backgroundPreloadStarted) return;
		backgroundPreloadStarted = true;
		setTimeout(() => {
			for (const name of Object.keys(manifest.tracks) as TSoundName[]) ensure(name);
		}, BACKGROUND_PRELOAD_DELAY_MS);
	};

	const play = (playOptions: { name: TSoundName }) => {
		const name = playOptions.name;
		if (!isMusic(name)) return;
		if (requested === name && entries.get(name)?.howl.playing()) return;

		// switching tracks stops the old one outright (music has no "resume where it was" contract)
		if (requested && requested !== name) entries.get(requested)?.howl.stop();
		requested = name;

		const entry = ensure(name);
		if (!entry) return;
		// Unconditional: a track that has not buffered yet must never block the caller (the door
		// transition asks for the bonus loop the moment the door shuts). Howler holds the request
		// until the stream is ready and startNow's `play` listener does the rest. This is also the
		// only path that works on iOS, where a media element refuses to buffer until play() is
		// called at all, so waiting for a load event first would deadlock.
		startNow(entry);
	};

	const stop = (stopOptions: { name: TSoundName }) => {
		if (!isMusic(stopOptions.name)) return;
		if (requested === stopOptions.name) requested = undefined;
		entries.get(stopOptions.name)?.howl.stop();
	};

	const fade = async (fadeOptions: {
		name: TSoundName;
		from: number;
		to: number;
		duration: number;
	}) => {
		const entry = entries.get(fadeOptions.name);
		if (!entry) return;
		soundVolume.set(fadeOptions.name, fadeOptions.to);
		const scale = playerVolume * (entry.track.volume ?? 1);
		entry.howl.fade(fadeOptions.from * scale, fadeOptions.to * scale, fadeOptions.duration);
	};

	const rate = (rateOptions: { name: TSoundName; rate: number }) => {
		entries.get(rateOptions.name)?.howl.rate(rateOptions.rate);
	};

	const volume = (value: number) => {
		playerVolume = value;
		for (const [name, entry] of entries) entry.howl.volume(levelFor(name));
	};

	const unload = () => {
		for (const entry of entries.values()) entry.howl.unload();
		entries.clear();
	};

	const debug = () =>
		console.log(
			[...entries.values()].map((e) => ({
				name: e.name,
				state: e.howl.state(),
				playing: e.howl.playing(),
				bytes: e.bytes,
			})),
		);

	// ── readiness gate ────────────────────────────────────────────────────────────────────────
	// The landing screen waits for the sfx sprite AND for this one track to be startable. Howler's
	// html5 'load' is the element's canplaythrough, which is exactly "buffered enough to start".
	const gateName = manifest.gate;
	const gateBytes = gateName ? (trackOf(gateName)?.bytes?.[0] ?? 0) : 0;

	const settle = (result: 'loaded' | 'error' | 'timeout') => {
		if (gateSettled) return;
		gateSettled = true;
		options.onGateSettled?.(result);
	};

	if (gateName) {
		const entry = ensure(gateName);
		if (!entry) {
			settle('error');
		} else {
			entry.howl.once('load', () => {
				options.onGateProgress?.(1);
				settle('loaded');
			});
			entry.howl.once('loaderror', () => settle('error'));

			// honest byte progress: how much of the track the element has actually buffered
			const node = nodeOf(entry.howl);
			if (node) {
				const report = () => {
					try {
						const end = node.buffered.length ? node.buffered.end(node.buffered.length - 1) : 0;
						const total = node.duration || entry.track.duration;
						if (total) options.onGateProgress?.(Math.max(0, Math.min(1, end / total)));
					} catch {
						/* buffered can throw on a not-yet-open element */
					}
				};
				node.addEventListener('progress', report);
				node.addEventListener('canplaythrough', report);
				setTimeout(() => {
					if (!node.buffered.length) settle('timeout'); // preload suppressed (iOS)
				}, GATE_NO_PROGRESS_MS);
			}
			setTimeout(() => settle('timeout'), GATE_TIMEOUT_MS);
		}
	}

	return {
		play,
		stop,
		fade,
		rate,
		volume,
		unload,
		debug,
		gateBytes,
		/** the Howl of the track currently requested, for probes/tests; undefined before first play */
		get howl(): Howl | undefined {
			return requested ? entries.get(requested)?.howl : undefined;
		},
	};
}

export type MusicPlayer<TSoundName extends string> = ReturnType<
	typeof createMusicPlayer<TSoundName>
>;
