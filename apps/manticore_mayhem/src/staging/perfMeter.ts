// THE STAGING PERFORMANCE METER (`?perf=1` in a PUBLIC_STAGING=1 build or on the dev server; never in a
// production bundle: game/staging.ts). MM_STAGING_PERF_METER
//
// What it measures, the cheap way: ONE requestAnimationFrame listener that, per frame, takes one timestamp,
// bumps one histogram bin and compares one maximum. No allocation, no DOM or layout read, nothing else per
// frame. Everything derived (medians, long frame counts, the verdict) is worked out from the histograms
// once a second or once a minute by whoever reads it (PerfReadout.svelte's one second timer).
//
//   interval      the time between two frames. Its median over the last few seconds is the display's real
//                 rate as this page gets it (16.7 ms = 60 Hz, 8.3 = 120, 33.3 = 30).
//   long frame    a frame longer than LONG_FACTOR x the median of ITS OWN minute.
//   half rate     a minute whose median is about double the FIRST minute's. A phone that drops a hot or
//                 power saving page to 30 Hz paces every frame evenly, so it shows no long frames at all;
//                 it is caught here by comparing medians, and reported, not counted as smooth.
//   hidden time   a frame that spans a tab switch is not a frame: the first interval after the page comes
//                 back is thrown away.

/** a frame longer than this many medians of its minute is "long" */
export const LONG_FACTOR = 1.5;
/** minutes of history kept */
export const MINUTES_KEPT = 15;
/** the live interval is the median of the frames of about this many seconds */
export const RECENT_FRAMES = 300;
/** a minute's median at or over this many first-minute medians is "running at a reduced rate" */
export const HALF_RATE_FACTOR = 1.8;
/** verdict thresholds: the share of long frames in the last minute */
export const VERDICT = { someLongShare: 0.005, strugglingShare: 0.05 } as const;

const BIN_MS = 0.25;
const BINS = 801; // 0 .. 200 ms in quarter milliseconds; the last bin takes everything longer
const MINUTE_MS = 60_000;

export type MinuteRow = { minute: number; frames: number; medianMs: number; long: number; longestMs: number; hz: number };

const hist = new Uint32Array(BINS); // the minute in progress
const recent = new Float32Array(RECENT_FRAMES);
const scratch = new Float32Array(RECENT_FRAMES);
let recentAt = 0;
let recentCount = 0;

// the finished minutes, a ring of plain numbers (written once a minute)
const ring = { minute: new Int32Array(MINUTES_KEPT), frames: new Int32Array(MINUTES_KEPT), median: new Float32Array(MINUTES_KEPT), long: new Int32Array(MINUTES_KEPT), longest: new Float32Array(MINUTES_KEPT), n: 0, at: 0 };

export const meter = {
	running: false,
	startedAt: 0,
	frames: 0,
	/** the minute in progress */
	minuteIndex: 0,
	minuteFrames: 0,
	minuteLongest: 0,
	minuteEnd: 0,
	/** the first full minute's median (0 until it has finished): the rate this device started at */
	firstMinuteMedian: 0,
	contextLost: 0,
	contextRestored: 0,
	visibilityChanges: 0,
	hiddenNow: false,
};

let last = 0;
let skipNext = true;
let rafId = 0;

const medianOf = (h: Uint32Array, total: number): number => {
	if (total <= 0) return 0;
	let seen = 0;
	const half = total / 2;
	for (let i = 0; i < BINS; i += 1) {
		seen += h[i];
		if (seen >= half) return (i + 0.5) * BIN_MS;
	}
	return BINS * BIN_MS;
};
const countOver = (h: Uint32Array, ms: number): number => {
	let n = 0;
	for (let i = Math.min(BINS - 1, Math.ceil(ms / BIN_MS)); i < BINS; i += 1) n += h[i];
	return n;
};

const closeMinute = () => {
	const median = medianOf(hist, meter.minuteFrames);
	const k = ring.at;
	ring.minute[k] = meter.minuteIndex;
	ring.frames[k] = meter.minuteFrames;
	ring.median[k] = median;
	ring.long[k] = countOver(hist, median * LONG_FACTOR);
	ring.longest[k] = meter.minuteLongest;
	ring.at = (k + 1) % MINUTES_KEPT;
	if (ring.n < MINUTES_KEPT) ring.n += 1;
	if (!meter.firstMinuteMedian && meter.minuteFrames > 100) meter.firstMinuteMedian = median;
	hist.fill(0);
	meter.minuteIndex += 1;
	meter.minuteFrames = 0;
	meter.minuteLongest = 0;
};

// THE ONE PER FRAME LISTENER
const frame = (now: number) => {
	rafId = requestAnimationFrame(frame);
	if (skipNext) {
		// the first frame, or the first after the page was hidden: there is no interval to measure
		skipNext = false;
		last = now;
		return;
	}
	const dt = now - last;
	last = now;
	if (now >= meter.minuteEnd) {
		closeMinute();
		meter.minuteEnd += MINUTE_MS;
		if (now >= meter.minuteEnd) meter.minuteEnd = now + MINUTE_MS; // a long sleep: do not close empty minutes one by one
	}
	const bin = dt >= BINS * BIN_MS ? BINS - 1 : (dt / BIN_MS) | 0;
	hist[bin] += 1;
	recent[recentAt] = dt;
	recentAt = recentAt + 1 === RECENT_FRAMES ? 0 : recentAt + 1;
	if (recentCount < RECENT_FRAMES) recentCount += 1;
	if (dt > meter.minuteLongest) meter.minuteLongest = dt;
	meter.minuteFrames += 1;
	meter.frames += 1;
};

const onVisibility = () => {
	meter.visibilityChanges += 1;
	meter.hiddenNow = document.hidden;
	skipNext = true;
};
const onLost = () => (meter.contextLost += 1);
const onRestored = () => (meter.contextRestored += 1);
let watched: HTMLCanvasElement | null = null;

/** listen for the WebGL context being lost / restored on the game's canvas (call again if the canvas changes) */
export const watchCanvas = (canvas: HTMLCanvasElement | null | undefined) => {
	if (!canvas || canvas === watched) return;
	watched?.removeEventListener('webglcontextlost', onLost);
	watched?.removeEventListener('webglcontextrestored', onRestored);
	watched = canvas;
	canvas.addEventListener('webglcontextlost', onLost);
	canvas.addEventListener('webglcontextrestored', onRestored);
};

export const startMeter = () => {
	if (meter.running || typeof window === 'undefined') return;
	meter.running = true;
	meter.startedAt = performance.now();
	meter.minuteEnd = meter.startedAt + MINUTE_MS;
	meter.hiddenNow = document.hidden;
	document.addEventListener('visibilitychange', onVisibility);
	rafId = requestAnimationFrame(frame);
};

export const stopMeter = () => {
	if (!meter.running) return;
	meter.running = false;
	cancelAnimationFrame(rafId);
	document.removeEventListener('visibilitychange', onVisibility);
	watched?.removeEventListener('webglcontextlost', onLost);
	watched?.removeEventListener('webglcontextrestored', onRestored);
	watched = null;
};

// ---- the readings (called once a second, never per frame) ---------------------------------------------

/** the median interval of the last few seconds, ms (0 before there are frames) */
export const recentMedianMs = (): number => {
	const n = recentCount;
	if (!n) return 0;
	scratch.set(recent);
	const view = scratch.subarray(0, n);
	view.sort();
	return view[n >> 1];
};

/** the minute in progress, as a row (its long count uses its own median so far) */
export const currentMinute = (): MinuteRow => {
	const median = medianOf(hist, meter.minuteFrames);
	return { minute: meter.minuteIndex, frames: meter.minuteFrames, medianMs: median, long: countOver(hist, median * LONG_FACTOR), longestMs: meter.minuteLongest, hz: median ? 1000 / median : 0 };
};

/** the finished minutes, oldest first (at most MINUTES_KEPT) */
export const finishedMinutes = (): MinuteRow[] => {
	const out: MinuteRow[] = [];
	for (let i = 0; i < ring.n; i += 1) {
		const k = (ring.at - ring.n + i + MINUTES_KEPT * 2) % MINUTES_KEPT;
		out.push({ minute: ring.minute[k], frames: ring.frames[k], medianMs: ring.median[k], long: ring.long[k], longestMs: ring.longest[k], hz: ring.median[k] ? 1000 / ring.median[k] : 0 });
	}
	return out;
};

export type Verdict = { code: 'measuring' | 'smooth' | 'some' | 'struggling' | 'reduced'; text: string };

/** one plain line. `reduced` wins over everything: an evenly paced 30 Hz has no long frames and is not smooth. */
export const verdictOf = (rows: MinuteRow[], now: MinuteRow, liveMedian: number): Verdict => {
	const base = meter.firstMinuteMedian || (rows[0]?.medianMs ?? 0);
	// the latest evidence: the minute in progress once it has a few seconds of frames, else the last finished one
	const latest = now.frames >= 240 ? now : (rows[rows.length - 1] ?? now);
	if (latest.frames < 120) return { code: 'measuring', text: 'measuring (give it a minute)' };
	const median = now.frames >= 240 ? Math.max(now.medianMs, liveMedian) : latest.medianMs;
	if (base && median >= base * HALF_RATE_FACTOR) {
		const ratio = median / base;
		const what = ratio < 2.5 ? 'half rate' : ratio < 3.5 ? 'a third of the rate' : 'a fraction of the rate';
		return { code: 'reduced', text: `running at ${what} (the phone may be saving power or hot)` };
	}
	const share = latest.long / Math.max(1, latest.frames);
	if (share >= VERDICT.strugglingShare) return { code: 'struggling', text: 'struggling' };
	if (share >= VERDICT.someLongShare) return { code: 'some', text: 'some long frames' };
	return { code: 'smooth', text: 'smooth' };
};
