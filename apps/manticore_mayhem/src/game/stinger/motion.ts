// THE PLAQUE'S MOTION: the port of the reference compositor's vertex math (model/scripts/L0_lib.py
// add_flare / Layered.layer_mesh), which is what was approved. Pure arithmetic on preallocated arrays.
//
//   idle      idle_all loops on the plaque's clock at `fps` (105 frames, 3.5 s), absolute vertex positions.
//             Between two frames the positions are interpolated (the source is 30 fps).
//   flares    tier_flare (22 frames) and land_flare (31) are ADDITIVE per vertex deltas on top of the idle,
//             which never stops. Tails add (dx, dy); wings rotate and stretch about their wrist ("polar":
//             v = pivot + (1 + gain (rho - 1)) R(gain theta) (idle - pivot), theta clockwise on screen).
//             tier_flare may start on any idle frame P, scaled by tier_gain[layer][P] (only the left corner
//             wing is below 1: the clamp that keeps its lift inside the approved land_flare peak).
//             land_flare runs over the idle from frame 75 with gain 1: reset() phases the idle for it.
//   overlap   NEVER TWO FLARE DELTAS. A new flare starts its own delta from zero; the value the old delta
//             had at that moment is frozen and blended out over `blendS` (100 ms).
import type { MotionLayer, StingerData } from './types';

export const FLARE_NONE = 0;
export const FLARE_TIER = 1;
export const FLARE_LAND = 2;
export type FlareKind = typeof FLARE_TIER | typeof FLARE_LAND;

export class StingerMotion {
	readonly movers: MotionLayer[];
	readonly fps: number;
	readonly idleFrames: number;
	readonly tierFrames: number;
	readonly landFrames: number;
	readonly landIdleStart: number;
	/** the frozen delta's blend out time, seconds */
	blendS = 0.1;

	/** the idle frame at t = 0 */
	private idleAtZero = 0;
	private kind: number = FLARE_NONE;
	private t0 = 0;
	/** tier_gain per mover for the running flare */
	private gains: Float32Array;
	/** per mover: the old flare's delta at the moment the running one started, and when that was */
	private frozen: Float32Array[];
	private frozenT0 = -1e9;
	private scratch: Float32Array[];

	constructor(data: StingerData) {
		const m = data.json.motion;
		this.movers = data.movers;
		this.fps = data.json.fps;
		this.idleFrames = m.idleFrames;
		this.tierFrames = m.tierFrames;
		this.landFrames = m.landFrames;
		this.landIdleStart = m.landIdleStart;
		this.gains = new Float32Array(this.movers.length).fill(1);
		this.frozen = this.movers.map((L) => new Float32Array(L.nv * 2));
		this.scratch = this.movers.map((L) => new Float32Array(L.nv * 2));
	}

	/** no flare, and the idle phased so that it is on `idleFrame` at time `at` */
	reset(idleFrame = 0, at = 0): void {
		this.idleAtZero = idleFrame - at * this.fps;
		this.kind = FLARE_NONE;
		this.frozenT0 = -1e9;
	}

	/** the idle frame at time t, 0 <= frame < idleFrames (fractional) */
	idleFrame(t: number): number {
		const f = (this.idleAtZero + t * this.fps) % this.idleFrames;
		return f < 0 ? f + this.idleFrames : f;
	}

	/** is a flare delta (running or blending out) still moving the vertices at t? */
	flaring(t: number): boolean {
		return this.flareFrame(t) >= 0 || t - this.frozenT0 < this.blendS;
	}

	/** FLARE_TIER / FLARE_LAND for the flare last started (see flareFrame for whether it still runs) */
	get flareKind(): number {
		return this.kind;
	}

	/** the running flare's frame at t (fractional), or -1 when none is running */
	flareFrame(t: number): number {
		if (this.kind === FLARE_NONE) return -1;
		const g = (t - this.t0) * this.fps;
		const last = (this.kind === FLARE_TIER ? this.tierFrames : this.landFrames) - 1;
		return g >= last ? -1 : Math.max(g, 0);
	}

	/**
	 * Start a flare at time t. What the previous delta is worth right now is frozen per vertex (and blended
	 * out from t); the new delta starts from its frame 0. A land flare needs the idle on `landIdleStart` at
	 * t: call reset(landIdleStart, t) first (the entrance does).
	 */
	startFlare(kind: FlareKind, t: number): void {
		for (let i = 0; i < this.movers.length; i += 1) {
			// the total delta now (running + what is left of an older frozen one) becomes the frozen one
			this.deltaInto(i, t, this.scratch[i]);
			this.frozen[i].set(this.scratch[i]);
		}
		this.frozenT0 = t;
		this.kind = kind;
		this.t0 = t;
		const P = this.idleFrame(t);
		const a = Math.floor(P);
		const b = (a + 1) % this.idleFrames;
		const k = P - a;
		for (let i = 0; i < this.movers.length; i += 1) {
			const g = this.movers[i].gain;
			this.gains[i] = kind === FLARE_TIER && g ? g[a] + (g[b] - g[a]) * k : 1;
		}
	}

	/** the total flare delta of mover i at t into out: (dx, dy) or (theta, rho - 1) per vertex */
	private deltaInto(i: number, t: number, out: Float32Array): void {
		const L = this.movers[i];
		const n = L.nv * 2;
		const g = this.flareFrame(t);
		if (g < 0) out.fill(0);
		else {
			const track = this.kind === FLARE_TIER ? L.tier : L.land;
			const a = Math.floor(g);
			const k = g - a;
			const oa = a * n;
			const ob = oa + n; // flareFrame stops short of the last frame, so a + 1 exists
			const gain = this.gains[i];
			for (let j = 0; j < n; j += 1) out[j] = (track[oa + j] + (track[ob + j] - track[oa + j]) * k) * gain;
		}
		const w = 1 - (t - this.frozenT0) / this.blendS;
		if (w > 0) {
			const fz = this.frozen[i];
			for (let j = 0; j < n; j += 1) out[j] += fz[j] * w;
		}
	}

	/** the vertex positions of mover i at t (ship px) into out (nv x 2) */
	evaluate(i: number, t: number, out: Float32Array): void {
		const L = this.movers[i];
		const n = L.nv * 2;
		const f = this.idleFrame(t);
		const a = Math.floor(f);
		const k = f - a;
		const oa = a * n;
		const ob = ((a + 1) % this.idleFrames) * n;
		const idle = L.idle;
		if (!this.flaring(t)) {
			for (let j = 0; j < n; j += 1) out[j] = idle[oa + j] + (idle[ob + j] - idle[oa + j]) * k;
			return;
		}
		const d = this.scratch[i];
		this.deltaInto(i, t, d);
		if (!L.polar) {
			for (let j = 0; j < n; j += 1) out[j] = idle[oa + j] + (idle[ob + j] - idle[oa + j]) * k + d[j];
			return;
		}
		const px = L.pivotX;
		const py = L.pivotY;
		for (let j = 0; j < n; j += 2) {
			const ax = idle[oa + j] + (idle[ob + j] - idle[oa + j]) * k - px;
			const ay = idle[oa + j + 1] + (idle[ob + j + 1] - idle[oa + j + 1]) * k - py;
			const c = Math.cos(d[j]);
			const s = Math.sin(d[j]);
			const rho = 1 + d[j + 1];
			out[j] = px + rho * (c * ax - s * ay);
			out[j + 1] = py + rho * (s * ax + c * ay);
		}
	}
}
