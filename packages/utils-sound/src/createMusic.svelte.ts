import { Howl, Howler } from 'howler';
import { elementGain, gainOf, isAppleTouch } from './elementGain';

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
 *
 * BUFFERED LOOPS (options.bufferedLoops, 2026-10-23; EMPTY by default, so a game that does not name a
 * track, Angry Mantis among them, streams every track exactly as above). Corey: "I'd like to make an
 * attempt at fixing the iPhone loop before Monday". WebKit does not loop a media element gaplessly
 * (WebKit bug 230553), and behind the MediaElementSource every Apple touch device uses for its volume
 * (elementGain.ts) it is far worse: measured in WebKit on bgm_base.m4a 2026-10-09, each wrap gave about
 * 0.4 s of silence, about 1.1 s of the end of the track AGAIN, 0.25 s of silence, then the start; a
 * plain element lost about 65 ms. The file is not at fault: the same audio loops with no gap from an
 * AudioBufferSourceNode. So a NAMED looping track still STARTS on its stream (instant, and the only
 * path that works while the AudioContext is not running), and once it plays and the context runs, the
 * same file is fetched by its own stamped URL (never an object URL: the engine.io CSP has no blob:),
 * decoded into ONE AudioBuffer, started as a Web Audio loop at the stream's position with a short
 * crossfade, and the stream is stopped. The loop end is the manifest's duration, not the decoded
 * length (an AAC decode can run a few samples long). The buffer goes the moment the track stops or
 * another one starts, and on unload. Cost: duration x context rate x channels x 4 bytes, 11.5 MB for
 * Manticore's 60 s mono iPhone base at 48 kHz. Fade, volume, mute and rate act on the buffer's own
 * GainNode / playbackRate, which feeds Howler's master gain, so the global mute (tab hidden, context
 * suspended) silences it exactly as it silences the stream. A context that is suspended or interrupted
 * (a phone call, an app switch) pauses the buffer with it, and it carries on when the context runs
 * again (createSound's gesture watchdog resumes it); a stream behind elementGain is silent in that
 * state too, so nothing is lost against today. One difference: a rate other than 1 changes the
 * buffer's pitch, where a media element keeps it (no game sets a rate on music).
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
	/** a NON-LOOPING track's media element reached its end (see play({ loop: false })) */
	onTrackEnded?: (name: string) => void;
	/** the looping tracks handed from their stream to a decoded AudioBuffer once Web Audio runs (see
	 *  BUFFERED LOOPS in the header). Empty or absent: every track streams. */
	bufferedLoops?: readonly string[];
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
/** BUFFERED LOOPS: how long a named loop plays on its stream before its file is fetched and decoded, so the fetch
 *  and the decode never compete with the first moments after the landing press. The first wrap is a whole loop
 *  away. */
const BUFFER_DELAY_MS = 3000;
/** the buffer is started this far ahead of "now", so its first sample is never late */
const HANDOVER_LEAD_S = 0.05;
/** stream out, buffer in (the brief allowed about 30 to 60 ms): hides the few tens of ms an element's reported
 *  position can be off by on iPhone */
const CROSSFADE_S = 0.04;
/** the hand-over listens to the stream for this long (an AnalyserNode's window must fill: 4096 frames is 85 ms at
 *  48 kHz) ... */
const LISTEN_MS = 120;
const LISTEN_FRAMES = 4096;
/** ... matches its last 2048 samples (43 ms) ... */
const LISTEN_MATCH = 2048;
/** ... within this far of the element's currentTime (iOS 26.5 Simulator: the stream ran 96 and 133 ms ahead of it;
 *  desktop WebKit 15 ms) ... */
const LOCATE_RANGE_S = 0.3;
/** ... and trusts the match from this normalised correlation up (a clean match is 0.99 and more) */
const LOCATE_MIN_MATCH = 0.9;

/** a named loop's Web Audio copy (BUFFERED LOOPS) */
type LoopBuffer = {
	/** loading: fetch / decode in flight, the stream plays; fading: both play, crossfading; on: the buffer alone */
	phase: 'loading' | 'fading' | 'on';
	source?: AudioBufferSourceNode;
	gain?: GainNode;
	/** the stream's elementGain while it fades out, so a release can give it its level back */
	streamGain?: GainNode;
	/** context time at which the loop's position 0 played (rebased on a rate change), for the position */
	zeroAt: number;
	rate: number;
	loopEnd: number;
};

type Entry = {
	name: string;
	track: MusicTrack;
	howl: Howl;
	/** resolved once Howler has picked a source it can decode */
	bytes: number;
	/** per-start override of track.loop (play({ loop })); undefined = use the manifest's value */
	loopOverride?: boolean;
	/** guards one 'ended' listener per media node */
	endedNode?: HTMLAudioElement;
	/** BUFFERED LOOPS: the Web Audio copy while it loads or plays */
	loopBuf?: LoopBuffer;
	/** BUFFERED LOOPS: a statechange listener is waiting for the context to run */
	waitingForContext?: boolean;
	/** BUFFERED LOOPS: the fetch or decode failed once; this track streams for the rest of the session */
	bufferFailed?: boolean;
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
	const ELEMENT_GAIN = isAppleTouch();
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

	/** the mixer level onto the Howl. `volume()` alone is not enough on iOS: music streams through
	 *  html5 media elements and Safari (and Chrome, which is WebKit there) ignores
	 *  HTMLMediaElement.volume outright, so a level of 0 left the music playing at full volume —
	 *  the menu's music mute and slider were no-ops on iPhone (Corey, 2026-09-17). `muted` IS
	 *  honoured, so a zero level mutes the element and any other level unmutes it. */
	const setLevel = (entry: Entry, name: TSoundName) => {
		const level = levelFor(name);
		// BUFFERED LOOPS: once the buffer plays, the level is its own GainNode (plain Web Audio, honoured
		// everywhere). While the stream fades out under it the stream keeps its ramp, but a mute reaches it now.
		const loop = entry.loopBuf;
		if (loop?.gain) {
			setParam(loop.gain.gain, level);
			if (loop.phase === 'fading' && level === 0) entry.howl.mute(true);
			return;
		}
		// after the mute, never before: Howler's html5 volume() skips the element while the sound is muted and mute(false) does not put the element's volume back
		entry.howl.mute(level === 0);
		entry.howl.volume(level);
		// Apple touch devices: the level lives on a GainNode in front of the element, because the
		// element's volume is ignored there (elementGain.ts). Attaches on the first call that finds
		// a playing node and a running context; until then the mute above is all iOS honours.
		if (ELEMENT_GAIN) {
			const node = nodeOf(entry.howl);
			const gain = node ? elementGain(node) : undefined;
			if (gain) gain.gain.value = level;
		}
	};

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
			mute: levelFor(name) === 0, // iOS: see setLevel
		});
		const entry: Entry = { name, track, howl, bytes: chosenBytes(howl, track, urls) };
		entries.set(name, entry);
		return entry;
	};

	// ── BUFFERED LOOPS (see the header) ────────────────────────────────────────────────────────
	const bufferedNames = new Set<string>(options.bufferedLoops ?? []);
	/** the last hand-over's stream match (probes): how far the stream was from its currentTime, and how well it matched */
	let lastLocate: { offsetMs: number; match: number } | undefined;
	const contextRunning = () =>
		Boolean(Howler.usingWebAudio && Howler.ctx && Howler.ctx.state === 'running' && Howler.masterGain);

	/** decodeAudioData in both its forms: older WebKit has only the callbacks */
	const decode = (ctx: AudioContext, bytes: ArrayBuffer) =>
		new Promise<AudioBuffer>((resolve, reject) => {
			const promise = ctx.decodeAudioData(bytes, resolve, reject) as Promise<AudioBuffer> | undefined;
			if (promise && typeof promise.then === 'function') promise.then(resolve, reject);
		});

	/** Drop the Web Audio copy: silence it at once, stop it, and once it has ended disconnect its nodes and let go of
	 *  the decoded audio (this is what frees the memory). The disconnect waits for 'ended' because WebKit only
	 *  finishes a source it still pulls: one disconnected straight after stop() never ended in the probe, and a
	 *  source that never ends stays referenced by the context. A context that is not running renders nothing, so
	 *  a fallback finishes it after a second regardless. A stream caught mid-crossfade gets its level back. */
	const releaseBuffer = (entry: Entry | undefined) => {
		const loop = entry?.loopBuf;
		if (!entry || !loop) return;
		entry.loopBuf = undefined;
		const quietly = (step: () => void) => {
			try {
				step();
			} catch {
				/* never started, or (older WebKit) the buffer cannot be cleared: the node is unreachable either way */
			}
		};
		const { source, gain } = loop;
		if (gain) {
			gain.gain.cancelScheduledValues(0);
			gain.gain.value = 0;
		}
		let finished = false;
		const finish = () => {
			if (finished) return;
			finished = true;
			if (source) {
				quietly(() => source.disconnect());
				quietly(() => (source.buffer = null));
			}
			quietly(() => gain?.disconnect());
		};
		if (source) {
			source.addEventListener('ended', finish, { once: true });
			quietly(() => source.stop());
		}
		setTimeout(finish, source ? 1000 : 0);
		if (loop.streamGain) {
			loop.streamGain.gain.cancelScheduledValues(0);
			loop.streamGain.gain.value = levelFor(entry.name as TSoundName);
		}
	};

	/**
	 * Fetch and decode a named loop once its stream plays, then hand over (handOver). Called from the stream's
	 * 'play' and again when the context starts running; safe to call any number of times. A context that is not
	 * running leaves the track on its stream and arms one statechange listener for when it does.
	 */
	const upgradeToBuffer = (entry: Entry) => {
		const name = entry.name as TSoundName;
		if (!bufferedNames.has(entry.name) || entry.bufferFailed || entry.loopBuf || requested !== name) return;
		if (!(entry.loopOverride ?? entry.track.loop)) return;
		const ctx = Howler.ctx;
		if (!contextRunning()) {
			if (ctx && !entry.waitingForContext) {
				entry.waitingForContext = true;
				const onState = () => {
					if (ctx.state !== 'running') return;
					ctx.removeEventListener('statechange', onState);
					entry.waitingForContext = false;
					upgradeToBuffer(entry);
				};
				ctx.addEventListener('statechange', onState);
			}
			return;
		}
		const url = (entry.howl as unknown as { _src: string })._src; // the stamped file the stream plays
		const loop: LoopBuffer = { phase: 'loading', zeroAt: 0, rate: 1, loopEnd: entry.track.duration };
		entry.loopBuf = loop;
		const current = () => entry.loopBuf === loop && requested === name;
		setTimeout(async () => {
			if (!current()) return;
			try {
				const response = await fetch(url);
				if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
				const bytes = await response.arrayBuffer();
				if (!current()) return;
				const decoded = await decode(Howler.ctx, bytes);
				if (!current()) return;
				handOver(entry, loop, decoded);
			} catch (error) {
				if (entry.loopBuf === loop) entry.loopBuf = undefined;
				entry.bufferFailed = true;
				console.warn(`[sound] ${entry.name}: the gapless loop could not be built; it keeps streaming`, error);
			}
		}, BUFFER_DELAY_MS);
	};

	/** the stream's checks, before and after listening: still the track asked for, still playing, context running */
	const streamLive = (entry: Entry, loop: LoopBuffer) => {
		const node = nodeOf(entry.howl);
		return entry.loopBuf === loop && requested === (entry.name as TSoundName) && !!node && !node.paused && entry.howl.playing() && contextRunning();
	};

	/**
	 * Start the decoded loop where the stream REALLY is, crossfade, then stop the stream. The element's currentTime is
	 * not good enough for that: the stream's audio ran 15 ms ahead of it in desktop WebKit and 96 to 133 ms ahead in the
	 * iOS 26.5 Simulator (music_loop_probe, the Simulator harness), so a loop started from it repeated that much. So on Apple touch (the stream has its elementGain) the
	 * player first listens to the stream for a moment through an AnalyserNode and finds those samples in the decoded
	 * buffer (locateStream); without a gain, or when the stream cannot be found (muted, near silence), currentTime it is.
	 */
	const handOver = (entry: Entry, loop: LoopBuffer, decoded: AudioBuffer) => {
		if (!streamLive(entry, loop)) {
			// the stream is not playing (or the context stopped while decoding): try again on the next start or
			// when the context runs
			if (entry.loopBuf === loop) entry.loopBuf = undefined;
			if (!contextRunning()) upgradeToBuffer(entry);
			return;
		}
		const ctx = Howler.ctx;
		const streamGain = gainOf(nodeOf(entry.howl));
		if (!streamGain) {
			startLoop(entry, loop, decoded, nodeOf(entry.howl)!.currentTime, ctx.currentTime);
			return;
		}
		const analyser = ctx.createAnalyser();
		analyser.fftSize = LISTEN_FRAMES;
		streamGain.connect(analyser);
		setTimeout(() => {
			let heard: Float32Array | undefined;
			let at = 0;
			if (streamLive(entry, loop)) {
				const data = new Float32Array(analyser.fftSize);
				analyser.getFloatTimeDomainData(data);
				heard = data;
				at = ctx.currentTime;
			}
			try {
				streamGain.disconnect(analyser);
			} catch {
				/* already gone */
			}
			if (!heard) {
				if (entry.loopBuf === loop) entry.loopBuf = undefined;
				if (!contextRunning()) upgradeToBuffer(entry);
				return;
			}
			const guess = nodeOf(entry.howl)!.currentTime;
			const found = locateStream(heard, decoded, guess, Math.min(entry.track.duration, decoded.duration));
			startLoop(entry, loop, decoded, found ?? guess, at);
		}, LISTEN_MS);
	};

	/**
	 * Where the stream is, in s: the last LISTEN_MATCH samples it played, matched (normalised correlation) against the
	 * decoded buffer within LOCATE_RANGE_S of the element's own currentTime. A coarse pass on every 4th lag and sample,
	 * then a fine pass around the best: about 4 million multiply-adds, once per start. Returns the position of the
	 * LAST sample heard, or undefined when the match is weak (a muted or near silent stream).
	 */
	const locateStream = (heard: Float32Array, decoded: AudioBuffer, guessS: number, loopEnd: number) => {
		const sr = decoded.sampleRate;
		const L = Math.round(loopEnd * sr);
		const n = Math.min(LISTEN_MATCH, heard.length);
		const seg = heard.subarray(heard.length - n);
		let segE = 0;
		for (let i = 0; i < n; i++) segE += seg[i] * seg[i];
		if (Math.sqrt(segE / n) < 1e-4) return undefined;
		const channels = Array.from({ length: decoded.numberOfChannels }, (_, c) => decoded.getChannelData(c));
		const ref = (i: number) => {
			const j = ((i % L) + L) % L;
			let v = 0;
			for (const data of channels) v += data[j];
			return v / channels.length; // the analyser hears the stream down-mixed to mono
		};
		const base = Math.round(guessS * sr) - n; // where the segment starts if currentTime were right
		const R = Math.round(LOCATE_RANGE_S * sr);
		const score = (d: number, step: number) => {
			let dot = 0;
			let e = 0;
			let se = 0;
			for (let i = 0; i < n; i += step) {
				const r = ref(base + d + i);
				dot += seg[i] * r;
				e += r * r;
				se += seg[i] * seg[i];
			}
			return dot / Math.sqrt(se * e + 1e-20);
		};
		let best = { d: 0, c: -2 };
		for (let d = -R; d <= R; d += 4) {
			const c = score(d, 4);
			if (c > best.c) best = { d, c };
		}
		const coarse = best.d;
		best = { d: coarse, c: -2 };
		for (let d = coarse - 8; d <= coarse + 8; d++) {
			const c = score(d, 1);
			if (c > best.c) best = { d, c };
		}
		if (best.c < LOCATE_MIN_MATCH) return undefined;
		lastLocate = { offsetMs: (best.d / sr) * 1000, match: best.c };
		return ((((base + best.d + n) % L) + L) % L) / sr;
	};

	/** Start the loop so that it plays position `positionS` at context time `atS` (advanced to the start time),
	 *  crossfade the stream out under it, then stop the stream. */
	const startLoop = (entry: Entry, loop: LoopBuffer, decoded: AudioBuffer, positionS: number, atS: number) => {
		const name = entry.name as TSoundName;
		const ctx = Howler.ctx;
		const node = nodeOf(entry.howl)!;
		const rate = Number(entry.howl.rate()) || 1;
		const loopEnd = Math.min(entry.track.duration, decoded.duration);
		const startAt = Math.max(ctx.currentTime, atS) + HANDOVER_LEAD_S;
		const offset = (((positionS + (startAt - atS) * rate) % loopEnd) + loopEnd) % loopEnd;
		const level = levelFor(name);

		const source = ctx.createBufferSource();
		source.buffer = decoded;
		source.loop = true;
		source.loopStart = 0;
		source.loopEnd = loopEnd;
		source.playbackRate.value = rate;
		const gain = ctx.createGain();
		gain.gain.value = 0;
		gain.gain.setValueAtTime(0, startAt);
		gain.gain.linearRampToValueAtTime(level, startAt + CROSSFADE_S);
		source.connect(gain);
		gain.connect(Howler.masterGain);
		source.start(startAt, offset);

		// the stream's own level ramps out under it (Apple touch: its elementGain). Without one (element volume)
		// the stream is simply stopped half way through the fade.
		const streamGain = gainOf(node);
		if (streamGain) {
			const g = streamGain.gain;
			g.cancelScheduledValues(0);
			g.setValueAtTime(g.value, ctx.currentTime);
			g.setValueAtTime(level, startAt);
			g.linearRampToValueAtTime(0, startAt + CROSSFADE_S);
		}
		Object.assign(loop, { phase: 'fading', source, gain, streamGain, zeroAt: startAt - offset / rate, rate, loopEnd });

		const stopAfterMs = (startAt - ctx.currentTime + (streamGain ? CROSSFADE_S : CROSSFADE_S / 2)) * 1000 + 30;
		setTimeout(() => {
			if (entry.loopBuf !== loop) return;
			entry.howl.stop(); // the stream is done until this track starts again
			if (streamGain) {
				streamGain.gain.cancelScheduledValues(0);
				streamGain.gain.value = levelFor(name); // ready for the next start on the stream
			}
			loop.streamGain = undefined;
			loop.phase = 'on';
		}, stopAfterMs);
	};

	/** a GainNode / AudioParam level right now, overriding any ramp in progress */
	function setParam(param: AudioParam, value: number) {
		const now = Howler.ctx ? Howler.ctx.currentTime : 0;
		param.cancelScheduledValues(now);
		param.setValueAtTime(value, now);
	}

	/** probes and the staging readout: where a named loop is */
	const loopStateOf = (entry: Entry | undefined) => {
		const loop = entry?.loopBuf;
		if (!entry || !loop) return undefined;
		const ctx = Howler.ctx;
		const position = loop.source && ctx ? (((ctx.currentTime - loop.zeroAt) * loop.rate) % loop.loopEnd + loop.loopEnd) % loop.loopEnd : null;
		return {
			name: entry.name,
			phase: loop.phase,
			position,
			loopEnd: loop.loopEnd,
			channels: loop.source?.buffer?.numberOfChannels ?? null,
			sampleRate: loop.source?.buffer?.sampleRate ?? null,
			frames: loop.source?.buffer?.length ?? null,
			located: lastLocate ?? null,
		};
	};

	/** Hand the loop back to the browser rather than to Howler's stop()/play() re-trigger.
	 *  A `loop: false` start (play({ loop: false })) also wires the element's own `ended` event —
	 *  a looping element never fires it, so this is the only place it can be armed. The listener
	 *  is attached per NODE (a deferred start can be served by a different one) and guarded so a
	 *  re-assert never stacks two of them. */
	const applyElementLoop = (entry: Entry) => {
		const node = nodeOf(entry.howl);
		if (!node) return;
		node.loop = entry.loopOverride ?? entry.track.loop;
		if (node.loop || entry.endedNode === node) return;
		entry.endedNode = node;
		node.addEventListener('ended', () => {
			if (requested !== (entry.name as TSoundName)) return;
			options.onTrackEnded?.(entry.name);
		});
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
		setLevel(entry, name);
		entry.howl.once('play', () => {
			if (requested !== name) {
				entry.howl.stop();
				return;
			}
			applyElementLoop(entry);
			setLevel(entry, name);
			upgradeToBuffer(entry); // BUFFERED LOOPS: a no-op unless the game named this track
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

	const play = (playOptions: { name: TSoundName; loop?: boolean }) => {
		const name = playOptions.name;
		if (!isMusic(name)) return;
		const current = entries.get(name);
		// already playing, on its stream or (BUFFERED LOOPS) on its buffer, which also covers a buffer paused
		// with a suspended context: it carries on when the context runs
		if (requested === name && (current?.howl.playing() || current?.loopBuf?.source)) return;

		// switching tracks stops the old one outright (music has no "resume where it was" contract)
		if (requested && requested !== name) {
			const previous = entries.get(requested);
			previous?.howl.stop();
			releaseBuffer(previous);
		}
		requested = name;

		const entry = ensure(name);
		if (!entry) return;
		releaseBuffer(entry); // a start always begins on the stream
		entry.loopOverride = playOptions.loop;
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
		releaseBuffer(entries.get(stopOptions.name));
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
		// BUFFERED LOOPS: the same linear ramp, on the buffer's gain
		const loopGain = entry.loopBuf?.gain;
		if (loopGain) {
			const now = Howler.ctx.currentTime;
			loopGain.gain.cancelScheduledValues(now);
			loopGain.gain.setValueAtTime(fadeOptions.from * scale, now);
			if (fadeOptions.duration > 0) loopGain.gain.linearRampToValueAtTime(fadeOptions.to * scale, now + fadeOptions.duration / 1000);
			else loopGain.gain.setValueAtTime(fadeOptions.to * scale, now);
			return;
		}
		entry.howl.fade(fadeOptions.from * scale, fadeOptions.to * scale, fadeOptions.duration);
	};

	const rate = (rateOptions: { name: TSoundName; rate: number }) => {
		const entry = entries.get(rateOptions.name);
		entry?.howl.rate(rateOptions.rate);
		// BUFFERED LOOPS: the buffer's playbackRate, its position clock rebased so it stays true
		const loop = entry?.loopBuf;
		if (loop?.source) {
			const now = Howler.ctx.currentTime;
			const position = (now - loop.zeroAt) * loop.rate;
			loop.rate = rateOptions.rate || 1;
			loop.zeroAt = now - position / loop.rate;
			loop.source.playbackRate.setValueAtTime(loop.rate, now);
		}
	};

	const volume = (value: number) => {
		playerVolume = value;
		for (const [name, entry] of entries) setLevel(entry, name);
	};

	const unload = () => {
		for (const entry of entries.values()) {
			releaseBuffer(entry);
			entry.howl.unload();
		}
		entries.clear();
	};

	const debug = () =>
		console.log(
			[...entries.values()].map((e) => ({
				name: e.name,
				state: e.howl.state(),
				playing: e.howl.playing(),
				bytes: e.bytes,
				...(e.loopBuf ? { buffer: e.loopBuf.phase } : {}),
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
		/** the Howl of the track currently requested, for probes/tests; undefined before first play. For a
		 *  BUFFERED LOOP that has been handed over this is its stopped stream (loopState says where it is). */
		get howl(): Howl | undefined {
			return requested ? entries.get(requested)?.howl : undefined;
		},
		/** staging diagnostics (?audiodiag=1): how the playing track's level is applied; 'buffer' once a
		 *  BUFFERED LOOP plays from its decoded copy */
		get levelPath(): 'gain' | 'element' | 'buffer' | 'none' {
			const entry = requested ? entries.get(requested) : undefined;
			if (!entry) return 'none';
			if (entry.loopBuf?.source) return 'buffer';
			return gainOf(nodeOf(entry.howl)) ? 'gain' : 'element';
		},
		/** BUFFERED LOOPS, for probes: the requested track's Web Audio copy (phase, position in s, decoded
		 *  shape), or undefined when it streams */
		get loopState() {
			return loopStateOf(requested ? entries.get(requested) : undefined);
		},
	};
}

export type MusicPlayer<TSoundName extends string> = ReturnType<
	typeof createMusicPlayer<TSoundName>
>;
