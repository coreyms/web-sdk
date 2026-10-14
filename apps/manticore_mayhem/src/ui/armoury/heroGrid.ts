// THE HERO'S ANGLE GRIDS (spec 3.3 and 5.4). Reusable: no game names, no imports, node runs it as it is
// (tools/manticore/armoury_parts_check.mjs). The numbers come in as arguments (constants.ts ARMOURY.hero).
//
// A HERO GRID is a set of pre-rendered frames of one hero, cols x rows, yaw per column (left to right, rising) and
// pitch per row (top to bottom, rising), packed into ONE atlas per hero in manifest order, row by row, every frame on
// the same canvas (tools/build_armoury_assets.py). ANY cols x rows: 5 x 3 at 5 degree steps (the crests, the
// standard, the seal), 9 x 3 at 2.5 degrees (the dagger), 21 x 1 at 1 degree of yaw only (the crown). Nothing here
// assumes 5 x 3. heroes.json lists the heroes that have one; a hero with no entry, a missing file or a failed fetch
// shows its flat art (the grid's straight-on frame) with the 2D tilt, and the menu works with none, some or all.
//
// The phone tier (PHONE_TIER) loads the `turn` atlas instead: only the pitch 0 row, half size.
//
// NO CROSS-BLEND BETWEEN FRAMES, EVER (owner, prototype v9). One opaque frame shows. A change of frame is a hard swap;
// only on a step of `fromDeg` degrees or more may the NEW frame fade in ON TOP of the old one, which stays fully opaque
// underneath until the new one is complete (so the hero is never see-through and two frames are never mixed at part
// opacity each). The fade is ramped as the approved prototype's fadeFor: 0 ms at fromDeg, `ms` at fromDeg + rampDeg.
// With the shipped sets: the crown's 1 degree and the dagger's 2.5 degree yaw steps swap hard (or within one frame),
// the 5 degree sets get the 45 ms fade-in.

// ---- heroes.json -----------------------------------------------------------------------------------------------

export type HeroGridEntry = {
	cols: number;
	rows: number;
	/** degrees per column, rising left to right (negative: turned to the viewer's left) */
	yaw: number[];
	/** degrees per row, rising top to bottom (negative: the pointer above the hero) */
	pitch: number[];
	/** a frame's width / height */
	ar: number;
	/** one cell of the full atlas, px [w, h] */
	cell: [number, number];
	/** the full atlas (cols x rows cells), a file name in the heroes.json folder */
	grid: string;
	/** the phone tier's atlas: the pitch 0 row only (cols x 1), half size; absent: the phone shows flat art */
	turn?: string;
	turnCell?: [number, number];
	/** the body's visual centre as fractions of the canvas (optional) */
	anchor?: [number, number];
};
export type HeroGrids = Record<string, HeroGridEntry>;

const rising = (list: unknown): list is number[] => Array.isArray(list) && list.every((v, i) => typeof v === 'number' && Number.isFinite(v) && (i === 0 || v > (list[i - 1] as number)));
const size2 = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number' && x > 0);
const file = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9][a-z0-9._-]*\.webp$/i.test(v);

/** heroes.json to the entries that are whole; anything malformed is dropped (that hero shows flat art) */
export const parseHeroes = (json: unknown): HeroGrids => {
	const out: HeroGrids = {};
	if (!json || typeof json !== 'object' || Array.isArray(json)) return out;
	for (const [key, raw] of Object.entries(json as Record<string, unknown>)) {
		const e = raw as Partial<HeroGridEntry> | null;
		if (!e || typeof e !== 'object') continue;
		const cols = e.cols;
		const rows = e.rows;
		if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols! < 1 || rows! < 1) continue;
		if (!rising(e.yaw) || e.yaw.length !== cols || !rising(e.pitch) || e.pitch.length !== rows) continue;
		if (!(typeof e.ar === 'number' && e.ar > 0) || !size2(e.cell) || !file(e.grid)) continue;
		const entry: HeroGridEntry = { cols: cols!, rows: rows!, yaw: [...e.yaw], pitch: [...e.pitch], ar: e.ar, cell: [e.cell[0], e.cell[1]], grid: e.grid };
		if (file(e.turn) && size2(e.turnCell) && e.pitch.includes(0)) {
			entry.turn = e.turn;
			entry.turnCell = [e.turnCell[0], e.turnCell[1]];
		}
		if (Array.isArray(e.anchor) && e.anchor.length === 2 && e.anchor.every((x) => typeof x === 'number' && x >= 0 && x <= 1)) entry.anchor = [e.anchor[0], e.anchor[1]];
		out[key] = entry;
	}
	return out;
};

/** the frames as one tier sees them: the full grid, or (phone tier) the pitch 0 row of the turn atlas */
export type GridView = { cols: number; rows: number; yaw: number[]; pitch: number[]; atlas: string; cell: [number, number] };
export const gridView = (e: HeroGridEntry, phoneTier: boolean): GridView | null => {
	if (!phoneTier) return { cols: e.cols, rows: e.rows, yaw: e.yaw, pitch: e.pitch, atlas: e.grid, cell: e.cell };
	if (!e.turn || !e.turnCell) return null;
	return { cols: e.cols, rows: 1, yaw: e.yaw, pitch: [0], atlas: e.turn, cell: e.turnCell };
};

// ---- frames ----------------------------------------------------------------------------------------------------

const nearestIndex = (list: number[], v: number) => list.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(list[best] - v) ? i : best), 0);

/** the straight-on frame (nearest to yaw 0, pitch 0): the flat art's twin and the stand-in until a set is decoded */
export const centreFrame = (g: { cols: number; yaw: number[]; pitch: number[] }): number => nearestIndex(g.pitch, 0) * g.cols + nearestIndex(g.yaw, 0);

/** an angle as a fractional index into a rising list (clamped to its ends) */
export const fractionalIndex = (list: number[], v: number): number => {
	const n = list.length - 1;
	if (n < 1 || v <= list[0]) return 0;
	if (v >= list[n]) return n;
	for (let i = 0; i < n; i++) if (v <= list[i + 1]) return i + (v - list[i]) / (list[i + 1] - list[i]);
	return n;
};

/** CSS background-size and background-position of frame `index` in a cols x rows atlas (percent units) */
export const framePosition = (cols: number, rows: number, index: number): { size: string; position: string } => {
	const c = index % cols;
	const r = Math.floor(index / cols);
	const px = cols > 1 ? (c / (cols - 1)) * 100 : 0;
	const py = rows > 1 ? (r / (rows - 1)) * 100 : 0;
	return { size: `${cols * 100}% ${rows * 100}%`, position: `${+px.toFixed(4)}% ${+py.toFixed(4)}%` };
};

export type FrameFadeRules = { ms: number; fromDeg: number; rampDeg: number; hold: number };

/** how long the new frame fades in on top of the old one, by the angle between them: 0 (a hard swap) under fromDeg */
export const fadeFor = (stepDeg: number, rules: FrameFadeRules): number =>
	stepDeg < rules.fromDeg ? 0 : Math.min(rules.ms, (rules.ms * (stepDeg - rules.fromDeg)) / Math.max(1e-6, rules.rampDeg));

/** what to draw: `base` fully opaque; `incoming` (or -1) on top of it at `incomingOpacity` */
export type FrameView = { base: number; incoming: number; incomingOpacity: number };

/**
 * The flipbook. Each tick it is handed the eased angle and the time since the last tick; it says which frame shows
 * and whether a fade-in is running. Until the set is decoded (`ready` false) the straight-on frame stands.
 */
export class FrameSwapper {
	base = -1;
	incoming = -1;
	o = 0;
	fadeMs = 0;
	/** the last fractional position, for the DEV hook */
	cell = '';
	readonly g: { cols: number; rows: number; yaw: number[]; pitch: number[] };
	readonly rules: FrameFadeRules;
	constructor(g: { cols: number; rows: number; yaw: number[]; pitch: number[] }, rules: FrameFadeRules) {
		this.g = g;
		this.rules = rules;
	}

	/** the frame nearest the angle, with the hold at the half way line against the frame on show */
	want(yawDeg: number, pitchDeg: number, ready: boolean): number {
		const g = this.g;
		if (!ready) return centreFrame(g);
		const fx = fractionalIndex(g.yaw, yawDeg);
		const fy = fractionalIndex(g.pitch, pitchDeg);
		this.cell = `${fx.toFixed(3)},${fy.toFixed(3)}`;
		const w = Math.round(fy) * g.cols + Math.round(fx);
		const target = this.incoming >= 0 ? this.incoming : this.base;
		if (target >= 0 && w !== target && Math.abs(fx - (target % g.cols)) <= this.rules.hold && Math.abs(fy - Math.floor(target / g.cols)) <= this.rules.hold) return target;
		return w;
	}

	/** degrees between two frames: the larger of the yaw and the pitch step */
	stepDeg(a: number, b: number): number {
		const g = this.g;
		return Math.max(Math.abs(g.yaw[a % g.cols] - g.yaw[b % g.cols]), Math.abs(g.pitch[Math.floor(a / g.cols)] - g.pitch[Math.floor(b / g.cols)]));
	}

	/** one tick. Returns true while a fade-in runs (the caller keeps its frame loop going) */
	update(yawDeg: number, pitchDeg: number, dtMs: number, opts: { ready: boolean; reduced: boolean }): boolean {
		const want = this.want(yawDeg, pitchDeg, opts.ready);
		if (this.base < 0) {
			this.base = want;
			this.incoming = -1;
			this.o = 0;
		}
		const target = this.incoming >= 0 ? this.incoming : this.base;
		if (want !== target) {
			// the frame on its way in is mostly there: it becomes the ground
			if (this.incoming >= 0 && this.o > 0.5) this.base = this.incoming;
			this.fadeMs = opts.reduced ? 0 : fadeFor(this.stepDeg(want, this.base), this.rules);
			if (want === this.base || this.fadeMs <= 0) {
				this.base = want;
				this.incoming = -1;
				this.o = 0;
			} else {
				this.incoming = want;
				this.o = 0;
			}
		}
		if (this.incoming >= 0) {
			this.o = Math.min(1, this.o + Math.max(0, dtMs) / Math.max(1e-6, this.fadeMs));
			if (this.o >= 1) {
				this.base = this.incoming;
				this.incoming = -1;
				this.o = 0;
			}
		}
		return this.incoming >= 0;
	}

	view(): FrameView {
		return { base: this.base, incoming: this.incoming, incomingOpacity: this.incoming >= 0 ? this.o : 0 };
	}

	/** a new set or a layout change: start again from the frame the next tick asks for */
	reset(): void {
		this.base = -1;
		this.incoming = -1;
		this.o = 0;
	}
}

// ---- angles ----------------------------------------------------------------------------------------------------

/** the grid's outermost yaw and pitch, degrees */
export const gridReach = (g: { yaw: number[]; pitch: number[] }) => ({
	yaw: Math.max(Math.abs(g.yaw[0]), Math.abs(g.yaw[g.yaw.length - 1])),
	pitch: Math.max(Math.abs(g.pitch[0]), Math.abs(g.pitch[g.pitch.length - 1])),
});

const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

/** pointer devices: the eased pointer (design px from the hero's centre) to the grid's angles. At follow 1 the stage
 *  edges (yawSpan, pitchSpan away) reach the grid's outermost angles */
export const pointerAngles = (
	cur: { x: number; y: number },
	g: { yaw: number[]; pitch: number[] },
	rules: { yawSpan: number; pitchSpan: number },
	follow: number,
): { yaw: number; pitch: number } => {
	const r = gridReach(g);
	return { yaw: clamp((cur.x / rules.yawSpan) * r.yaw * follow, r.yaw), pitch: clamp((cur.y / rules.pitchSpan) * r.pitch * follow, r.pitch) };
};

/** with no grid: the 2D tilt, `degPer500` degrees per 500 design px, `maxDeg` at most */
export const flatTilt = (cur: { x: number; y: number }, rules: { degPer500: number; maxDeg: number }, follow: number) => ({
	yaw: clamp((cur.x / 500) * rules.degPer500 * follow, rules.maxDeg),
	pitch: clamp((cur.y / 500) * rules.degPer500 * follow, rules.maxDeg),
});

/** touch: the slow idle turn, `deg` each way, one swing every `periodMs` */
export const idleTurnYaw = (tMs: number, rules: { deg: number; periodMs: number }): number => rules.deg * Math.sin((tMs / rules.periodMs) * Math.PI * 2);

/** an eased value one tick on: the soft lag (time constant `tauMs`) */
export const easeToward = (value: number, target: number, dtMs: number, tauMs: number): number => value + (target - value) * (dtMs > 0 ? 1 - Math.exp(-dtMs / tauMs) : 1);

// ---- the load queue --------------------------------------------------------------------------------------------

export type LoadState = 'waiting' | 'loading' | 'ready' | 'released' | 'failed';

export type LoadQueueOptions<H> = {
	/** every hero with a grid, in tray order */
	keys: string[];
	/** at most this many held decoded (the one on show and the one before it) */
	keep: number;
	/** fetch and decode one atlas (a normal URL and Image.decode(); never a blob: URL) */
	load: (key: string) => Promise<H>;
	/** let a decoded atlas go (drop the reference); its file stays in the HTTP cache */
	release: (key: string, handle: H) => void;
	/** a hero's state changed */
	onChange?: (key: string, state: LoadState) => void;
};

/**
 * One atlas at a time: the hero on show first, then the others in tray order. Paused while a round is in flight.
 * Every atlas is fetched once (so it sits in the HTTP cache), but only `keep` are held decoded; the one on show is
 * never let go. A hero let go is fetched again (from the cache) when it is shown. A failed one stays on flat art.
 */
export class HeroLoadQueue<H> {
	private state = new Map<string, LoadState>();
	private handles = new Map<string, H>();
	/** most recently wanted last */
	private recent: string[] = [];
	private current: string | null = null;
	private busy = false;
	private paused = false;
	private started = false;
	private disposed = false;

	private readonly opt: LoadQueueOptions<H>;

	constructor(opt: LoadQueueOptions<H>) {
		this.opt = opt;
		for (const k of opt.keys) this.state.set(k, 'waiting');
	}

	/** begin (the first open, after the entrance): `selected` first */
	start(selected: string | null): void {
		this.started = true;
		this.select(selected);
	}

	/** the hero on show changed: it goes to the front, and is fetched again if it was let go */
	select(key: string | null): void {
		this.current = key;
		if (key && this.state.has(key)) {
			this.recent = this.recent.filter((k) => k !== key).concat(key);
			if (this.state.get(key) === 'released') this.set(key, 'waiting');
		}
		this.pump();
	}

	pause(): void {
		this.paused = true;
	}
	resume(): void {
		this.paused = false;
		this.pump();
	}
	dispose(): void {
		this.disposed = true;
		for (const [k, h] of this.handles) this.opt.release(k, h);
		this.handles.clear();
	}

	stateOf(key: string): LoadState | undefined {
		return this.state.get(key);
	}
	/** the decoded atlas, if it is held */
	ready(key: string): H | undefined {
		return this.handles.get(key);
	}
	/** how many atlases are held decoded now */
	held(): number {
		return this.handles.size;
	}
	snapshot(): Record<string, LoadState> {
		return Object.fromEntries(this.state);
	}

	private set(key: string, s: LoadState) {
		this.state.set(key, s);
		this.opt.onChange?.(key, s);
	}

	private next(): string | null {
		if (this.current && this.state.get(this.current) === 'waiting') return this.current;
		for (const k of this.opt.keys) if (this.state.get(k) === 'waiting') return k;
		return null;
	}

	private pump(): void {
		if (!this.started || this.paused || this.busy || this.disposed) return;
		const key = this.next();
		if (!key) return;
		this.busy = true;
		this.set(key, 'loading');
		this.opt.load(key).then(
			(h) => {
				this.busy = false;
				if (this.disposed) {
					this.opt.release(key, h);
					return;
				}
				this.handles.set(key, h);
				if (!this.recent.includes(key)) this.recent.unshift(key); // fetched ahead, never shown: the oldest
				this.set(key, 'ready');
				this.trim();
				this.pump();
			},
			() => {
				this.busy = false;
				if (!this.disposed) this.set(key, 'failed');
				this.pump();
			},
		);
	}

	/** keep at most `keep` decoded: let go of the least recently wanted that is not on show */
	private trim(): void {
		while (this.handles.size > Math.max(1, this.opt.keep)) {
			const victim = this.recent.find((k) => k !== this.current && this.handles.has(k));
			if (!victim) return;
			const h = this.handles.get(victim)!;
			this.handles.delete(victim);
			this.recent = this.recent.filter((k) => k !== victim);
			this.opt.release(victim, h);
			this.set(victim, 'released');
		}
	}
}
