// RISING EMBERS (stinger_embers_fx.json v4): one deterministic table of looping slots plus a one shot burst
// table per tier. Pure arithmetic into preallocated arrays, sized for the Max tier; the component maps the
// outputs onto pooled sprites.
//
//   cycle     slot i: tt = t + offset period, n = floor(tt / period), tl = tt - n period. The ember exists
//             while i < T.slots and tl <= life, where T is the tier that was current WHEN IT SPAWNED: a tier
//             change only affects embers that spawn after it (old ones live out, nothing jumps). Slots whose
//             cycle was already running when the clock started stay dark until their next spawn.
//   sprite    kind < T.streak -> streak; else kind < T.streak + T.spark -> spark; else heat > 1 - T.hot ->
//             hot; else the slot's base sprite (dot / flake).
//   position  panel slots cycle through their vein points; others x0 = rect.x0 + frac(fx + n 0.61803) width,
//             y0 = rect.y0 + fy height. x = x0 + swayAmp sin(2 pi swayHz tl + swayPhase), y = y0 - speed
//             T.speed tl (streaks 1.4 times faster).
//   alpha     u = tl / life: min(1, tl / 0.10) min(1, 3.3 (1 - u)) (1 - T.twinkle + T.twinkle sin(2 pi
//             twinkleHz tl + i)) T.alpha kill excl text (streaks: no twinkle, alpha 1). kill = clamp((y -
//             killY) / 24), excl = product of clamp(d / 8) over the exclusion rects, text = factor + (1 -
//             factor) clamp(d / 14) for the text zone (d = distance to the rect, 0 inside).
//   scale     size (1 - 0.20 u), never above 1; sparks and streaks lean 6 deg cos(2 pi swayHz tl + swayPhase).
//   tint      lerp(T.cool, T.warm, heat), a multiplier on the sprite's baked colour.
//   burst     on entering tier T at t0 (the landing: the tier it lands on): every row of T's burst table is
//             one ember with tl = t - t0 - delay, n = 0, speed x 1.6, life x 0.7.
import type { EmberTableJson, StingerJson } from './types';
import { rgbInt } from './overlays';

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
// table columns (tools/build_stinger_assets.py ember_row)
const REGION = 0;
const FX = 1;
const FY = 2;
const SPEED = 3;
const SWAY_AMP = 4;
const SWAY_HZ = 5;
const SWAY_PHASE = 6;
const LIFE = 7;
const PERIOD = 8; // delay in a burst table
const OFFSET = 9;
const SIZE = 10;
const KIND = 11;
const BASE = 12;
const HEAT = 13;
const TWINKLE_HZ = 14;
const COLS = 15;
export const EMBER_HOT = 2;
export const EMBER_SPARK = 3;
export const EMBER_STREAK = 4;

type Table = { rows: Float32Array; points: (Float32Array | null)[]; count: number };
const pack = (t: EmberTableJson): Table => ({
	rows: new Float32Array(t.rows.flat()),
	points: t.points.map((p) => (p ? new Float32Array(p) : null)),
	count: t.rows.length,
});

export class EmberFx {
	/** loop slots first, then every tier's burst rows: one output row per particle */
	readonly capacity: number;
	readonly loopCount: number;
	readonly x: Float32Array;
	readonly y: Float32Array;
	readonly alpha: Float32Array;
	readonly scale: Float32Array;
	readonly rot: Float32Array;
	/** index into json.embers.sprites */
	readonly sprite: Uint8Array;
	readonly tint: Uint32Array;
	/** does particle p draw in the panel layer (under the barbs and the glint)? fixed per particle */
	readonly panel: Uint8Array;
	/** embers with alpha > 0 after the last update */
	alive = 0;
	private e: StingerJson['embers'];
	private loop: Table;
	private bursts: Table[];
	private burstBase: number[] = [];
	private burstT0: Float32Array;
	private lastN: Int32Array;
	private spawnTier: Int8Array;
	private tier = 0;
	private primed = false;
	private startT = 0;

	constructor(json: StingerJson) {
		this.e = json.embers;
		this.loop = pack(this.e.loop);
		this.bursts = this.e.bursts.map(pack);
		this.loopCount = this.loop.count;
		let n = this.loopCount;
		for (const b of this.bursts) {
			this.burstBase.push(n);
			n += b.count;
		}
		this.capacity = n;
		this.x = new Float32Array(n);
		this.y = new Float32Array(n);
		this.alpha = new Float32Array(n);
		this.scale = new Float32Array(n);
		this.rot = new Float32Array(n);
		this.sprite = new Uint8Array(n);
		this.tint = new Uint32Array(n);
		this.panel = new Uint8Array(n);
		this.burstT0 = new Float32Array(this.bursts.length).fill(-1e9);
		this.lastN = new Int32Array(this.loopCount);
		this.spawnTier = new Int8Array(this.loopCount).fill(-1);
		const mark = (t: Table, base: number) => {
			for (let i = 0; i < t.count; i += 1) this.panel[base + i] = this.e.regions[t.rows[i * COLS + REGION]].panel ? 1 : 0;
		};
		mark(this.loop, 0);
		this.bursts.forEach((b, k) => mark(b, this.burstBase[k]));
	}

	/** dark: no ember exists until start() */
	reset(): void {
		this.primed = false;
		this.burstT0.fill(-1e9);
		this.spawnTier.fill(-1);
		this.alpha.fill(0);
		this.alive = 0;
	}

	/** the clock starts at t (the landing impact; may be scheduled ahead) on `tier`, with that tier's burst */
	start(tier: number, t: number): void {
		this.tier = tier;
		this.primed = true;
		this.startT = t;
		const r = this.loop.rows;
		for (let i = 0; i < this.loopCount; i += 1) {
			const period = r[i * COLS + PERIOD];
			this.lastN[i] = Math.floor((t + r[i * COLS + OFFSET] * period) / period);
			this.spawnTier[i] = -1;
		}
		this.burstT0[tier] = t;
	}

	/** a tier up at t: new spawns use it, and its burst fires */
	setTier(tier: number, t: number): void {
		this.tier = tier;
		this.burstT0[tier] = t;
	}

	/** one particle into the output row p; tl < 0 or past its life = dark */
	private particle(p: number, tab: Table, i: number, tierIndex: number, tl: number, n: number, speedMul: number, lifeMul: number): void {
		const r = tab.rows;
		const o = i * COLS;
		const life = r[o + LIFE] * lifeMul;
		if (tl < 0 || tl > life) {
			this.alpha[p] = 0;
			return;
		}
		const E = this.e;
		const T = E.tiers[tierIndex];
		const kind = r[o + KIND];
		const heat = r[o + HEAT];
		const sprite = kind < T.streak ? EMBER_STREAK : kind < T.streak + T.spark ? EMBER_SPARK : heat > 1 - T.hot ? EMBER_HOT : r[o + BASE];
		const region = E.regions[r[o + REGION]];
		const pts = tab.points[i];
		let x0: number;
		let y0: number;
		if (pts) {
			const k = (((n % (pts.length / 2)) + pts.length / 2) % (pts.length / 2)) * 2;
			x0 = pts[k];
			y0 = pts[k + 1];
		} else {
			const f = r[o + FX] + n * 0.61803;
			x0 = region.rect[0] + (f - Math.floor(f)) * (region.rect[2] - region.rect[0]);
			y0 = region.rect[1] + r[o + FY] * (region.rect[3] - region.rect[1]);
		}
		const sway = TAU * r[o + SWAY_HZ] * tl + r[o + SWAY_PHASE];
		const x = x0 + r[o + SWAY_AMP] * Math.sin(sway);
		const y = y0 - r[o + SPEED] * T.speed * speedMul * (sprite === EMBER_STREAK ? 1.4 : 1) * tl;
		const u = tl / life;
		let a = Math.min(1, tl / 0.1) * Math.min(1, 3.3 * (1 - u));
		a *= sprite === EMBER_STREAK ? 1 : (1 - T.twinkle + T.twinkle * Math.sin(TAU * r[o + TWINKLE_HZ] * tl + i)) * T.alpha;
		a *= clamp01((y - region.killY) / 24);
		for (let k = 0; k < E.exclusions.length && a > 0; k += 1) {
			const q = E.exclusions[k];
			const dx = Math.max(q[0] - x, 0, x - q[2]);
			const dy = Math.max(q[1] - y, 0, y - q[3]);
			a *= clamp01(Math.sqrt(dx * dx + dy * dy) / 8);
		}
		const z = E.textZone.rect;
		const dx = Math.max(z[0] - x, 0, x - z[2]);
		const dy = Math.max(z[1] - y, 0, y - z[3]);
		a *= E.textZone.factor + (1 - E.textZone.factor) * clamp01(Math.sqrt(dx * dx + dy * dy) / 14);
		this.alpha[p] = clamp01(a);
		if (a <= 0) return;
		this.x[p] = x;
		this.y[p] = y;
		this.scale[p] = Math.min(1, r[o + SIZE] * (1 - 0.2 * u));
		this.rot[p] = sprite === EMBER_SPARK || sprite === EMBER_STREAK ? ((6 * Math.PI) / 180) * Math.cos(sway) : 0;
		this.sprite[p] = sprite;
		this.tint[p] = rgbInt(T.cool[0] + (T.warm[0] - T.cool[0]) * heat, T.cool[1] + (T.warm[1] - T.cool[1]) * heat, T.cool[2] + (T.warm[2] - T.cool[2]) * heat);
		this.alive += 1;
	}

	update(t: number): void {
		this.alive = 0;
		if (!this.primed || t < this.startT) return;
		const r = this.loop.rows;
		for (let i = 0; i < this.loopCount; i += 1) {
			const period = r[i * COLS + PERIOD];
			const tt = t + r[i * COLS + OFFSET] * period;
			const n = Math.floor(tt / period);
			if (n !== this.lastN[i]) {
				this.lastN[i] = n;
				this.spawnTier[i] = this.tier; // spawned since the last update: it keeps this tier for life
			}
			const st = this.spawnTier[i];
			if (st < 0 || i >= this.e.tiers[st].slots) this.alpha[i] = 0;
			else this.particle(i, this.loop, i, st, tt - n * period, n, 1, 1);
		}
		for (let k = 0; k < this.bursts.length; k += 1) {
			const b = this.bursts[k];
			const base = this.burstBase[k];
			const t0 = this.burstT0[k];
			for (let i = 0; i < b.count; i += 1) {
				if (t0 < -1e8) this.alpha[base + i] = 0;
				else this.particle(base + i, b, i, k, t - t0 - b.rows[i * COLS + PERIOD], 0, 1.6, 0.7);
			}
		}
	}
}
