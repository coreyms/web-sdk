// THE PLAQUE'S 2D OVERLAYS as functions of the plaque clock and the tier: veins, gold glint, barb glow,
// eyes (blink, glow pulse, flare). Each class holds a few numbers of state (phases, one shot start times)
// and writes its outputs into fields and preallocated arrays; nothing here touches Pixi or allocates per
// frame. The formulas are the approved recipes' (model/stinger_*_fx.json, quoted at each one); the tier
// tables, sprite names, tracks and anchors come from stinger.json. Times are seconds on the plaque clock.
import type { StingerJson } from './types';
import { FLARE_LAND, FLARE_NONE, FLARE_TIER } from './motion';

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
	const x = clamp01(v);
	return x * x * (3 - 2 * x);
};
/** rgb in 0..1 -> 0xRRGGBB */
export const rgbInt = (r: number, g: number, b: number) => (Math.round(clamp01(r) * 255) << 16) | (Math.round(clamp01(g) * 255) << 8) | Math.round(clamp01(b) * 255);

// ---- veins --------------------------------------------------------------------------------------------
// A_k(t) = base + (peak - base) (0.5 + 0.5 sin(2 pi t / period - k 2 pi / 3)) ^ 1.5 for veins a, b, c;
// A_glow(t) = glow (0.7 + 0.3 sin(2 pi t / period)); the tint is constant per tier and lerps on a step.
// The period differs per tier, so the phase is integrated (a step never jumps the pulse).
export class VeinFx {
	readonly alpha = new Float32Array(3);
	glowAlpha = 0;
	tint = 0xffffff;
	stepS = 0.4;
	private tiers: StingerJson['vein']['tiers'];
	private from = 0;
	private to = 0;
	private stepT0 = -1e9;
	private phase = 0;

	constructor(json: StingerJson) {
		this.tiers = json.vein.tiers;
	}

	reset(tier: number): void {
		this.from = this.to = tier;
		this.stepT0 = -1e9;
		this.phase = 0;
	}

	/** step to a tier at t: every tier value eases from where it is now */
	setTier(tier: number, t: number): void {
		// a step during a step starts from the nearer end (steps are at least a count segment apart)
		this.from = t - this.stepT0 < this.stepS / 2 ? this.from : this.to;
		this.to = tier;
		this.stepT0 = t;
	}

	update(t: number, dt: number): void {
		const A = this.tiers[this.from];
		const B = this.tiers[this.to];
		const m = smooth((t - this.stepT0) / this.stepS);
		const base = A.base + (B.base - A.base) * m;
		const peak = A.peak + (B.peak - A.peak) * m;
		const glow = A.glow + (B.glow - A.glow) * m;
		const period = A.period + (B.period - A.period) * m;
		this.phase = (this.phase + (TAU * dt) / period) % TAU;
		for (let k = 0; k < 3; k += 1) this.alpha[k] = base + (peak - base) * Math.pow(0.5 + 0.5 * Math.sin(this.phase - (k * TAU) / 3), 1.5);
		this.glowAlpha = glow * (0.7 + 0.3 * Math.sin(this.phase));
		this.tint = rgbInt(A.tint[0] + (B.tint[0] - A.tint[0]) * m, A.tint[1] + (B.tint[1] - A.tint[1]) * m, A.tint[2] + (B.tint[2] - A.tint[2]) * m);
	}
}

// ---- gold glint ---------------------------------------------------------------------------------------
// The band is never a sprite: 14 static slices along the sweep axis, alpha_i = peak cos^2(pi/2 (s_i - c) /
// halfWidth) while |s_i - c| < halfWidth, c running from -halfWidth to 1 + halfWidth over the sweep. A star
// fires when the band centre passes its ornament: t_fire = t_start + duration (site.s + hw) / (1 + 2 hw),
// lives starLife: alpha = min(p / 0.3, (1 - p) / 0.7), scale = max (0.35 + 0.65 sin(pi min(1, p / 0.7) / 2))
// (1 - 0.3 max(0, (p - 0.7) / 0.3)), rotation -10 + 30 p degrees. Idle: one sweep per tier interval with
// tier.stars stars, sites (sweep * 3 + j * 4) mod sites. Landing: one fast sweep at peak 1 with the four
// landingPick stars, each landingExtraDelay later than the one before; the idle cadence follows one interval
// later. A tier up holds the glint off (the flare uncovers gold the slices were not cut for).
const MAX_STARS = 4;
export class GlintFx {
	static readonly MAX_STARS = MAX_STARS;
	readonly sliceAlpha: Float32Array;
	/** per star slot: the site index (-1 = free), then outputs */
	readonly starSite = new Int8Array(MAX_STARS).fill(-1);
	readonly starAlpha = new Float32Array(MAX_STARS);
	readonly starScale = new Float32Array(MAX_STARS);
	readonly starRot = new Float32Array(MAX_STARS);
	/** how many idle sweeps have started (DEV state) */
	sweeps = 0;
	private g: StingerJson['glint'];
	private tier = 0;
	private starFire = new Float32Array(MAX_STARS);
	private running = false;
	private t0 = 0;
	private duration = 1;
	private peak = 0;
	/** when the next sweep starts, and whether it is the landing burst */
	private next = Infinity;
	private nextIsLanding = false;
	/** a count is running: no idle sweep starts (the landing burst still does) until sweepAt() */
	private held = false;

	constructor(json: StingerJson) {
		this.g = json.glint;
		this.sliceAlpha = new Float32Array(this.g.slices.length);
	}

	reset(tier: number): void {
		this.tier = tier;
		this.running = false;
		this.next = Infinity;
		this.nextIsLanding = false;
		this.held = false;
		this.sweeps = 0;
		this.starSite.fill(-1);
		this.sliceAlpha.fill(0);
		this.starAlpha.fill(0);
	}

	/** the landing burst starts at t (impact + the glint delay) */
	land(t: number): void {
		this.next = t;
		this.nextIsLanding = true;
	}

	/** hold the idle sweeps back (while an amount counts) */
	holdIdle(): void {
		this.held = true;
	}

	/** one sweep at t (the count's end), and the idle cadence carries on from it */
	sweepAt(t: number): void {
		this.held = false;
		this.next = t;
		this.nextIsLanding = false;
	}

	/** a tier up at t: the running sweep is dropped and none starts before t + hold */
	tierUp(tier: number, t: number, hold: number): void {
		this.tier = tier;
		this.running = false;
		if (this.next < t + hold) this.next = t + hold;
	}

	private fire(slot: number, site: number, at: number): void {
		this.starSite[slot] = site;
		this.starFire[slot] = at;
	}

	update(t: number): void {
		const g = this.g;
		const hw = g.halfWidth;
		if (t >= this.next && (this.nextIsLanding || !this.held)) {
			const landing = this.nextIsLanding;
			const T = g.tiers[this.tier];
			this.running = true;
			this.t0 = this.next;
			this.duration = landing ? g.landingDuration : g.idleDuration;
			this.peak = landing ? g.landingPeak : T.peak;
			const count = Math.min(landing ? g.landingPick.length : T.stars, MAX_STARS);
			for (let j = 0; j < MAX_STARS; j += 1) {
				if (j >= count) continue; // a star still alive from the sweep before keeps its slot
				const site = landing ? g.landingPick[j] : (this.sweeps * 3 + j * 4) % g.sites.length;
				this.fire(j, site, this.t0 + (this.duration * (g.sites[site].s + hw)) / (1 + 2 * hw) + (landing ? j * g.landingExtraDelay : 0));
			}
			if (!landing) this.sweeps += 1;
			this.nextIsLanding = false;
			this.next = this.t0 + T.interval;
		}
		if (this.running) {
			const tau = (t - this.t0) / this.duration;
			if (tau > 1) {
				this.running = false;
				this.sliceAlpha.fill(0);
			} else {
				const c = -hw + (1 + 2 * hw) * tau;
				for (let i = 0; i < this.sliceAlpha.length; i += 1) {
					const u = (g.slices[i].s - c) / hw;
					const k = Math.cos((Math.PI / 2) * u);
					this.sliceAlpha[i] = u > -1 && u < 1 ? this.peak * k * k : 0;
				}
			}
		} else this.sliceAlpha.fill(0);
		for (let j = 0; j < MAX_STARS; j += 1) {
			const site = this.starSite[j];
			if (site < 0) continue;
			const p = (t - this.starFire[j]) / g.starLife;
			if (p > 1) {
				this.starSite[j] = -1;
				this.starAlpha[j] = 0;
				continue;
			}
			if (p < 0) {
				this.starAlpha[j] = 0;
				continue;
			}
			this.starAlpha[j] = Math.min(p / 0.3, (1 - p) / 0.7);
			this.starScale[j] = g.sites[site].scale * (0.35 + 0.65 * Math.sin((Math.PI * Math.min(1, p / 0.7)) / 2)) * (1 - 0.3 * Math.max(0, (p - 0.7) / 0.3));
			this.starRot[j] = ((-10 + 30 * p) * Math.PI) / 180;
		}
	}
}

// ---- barb glow ----------------------------------------------------------------------------------------
// The barbs ride the tails: per side a track row (centre x, y, rotation deg clockwise, scale, visibility) for
// every idle frame, and the two flares as DELTAS on it (tier[g] - idle[0], land[g] - idle[75 + g]), the
// same additive model and the same overlap rule as the tail meshes. alpha = visibility max(pulse, charge),
// pulse = base + (peak - base) (0.5 + 0.5 sin(2 pi t / period + phase_side)) ^ 2, charge = min(1, peak +
// lift) (1 - smoothstep((t - t0) / chargeS)); halo alpha = tier.halo A / tier.peak. A tier up uses the new
// tier's row (and tint) at once.
const SIDES = ['L', 'R'] as const;
export class BarbFx {
	/** per side (L, R) */
	readonly x = new Float32Array(2);
	readonly y = new Float32Array(2);
	readonly rot = new Float32Array(2);
	readonly scale = new Float32Array(2);
	readonly highlight = new Float32Array(2);
	readonly halo = new Float32Array(2);
	tint = 0xffffff;
	chargeS = 0.5;
	chargeLift = 0.25;
	blendS = 0.1;
	private b: StingerJson['barb'];
	private idleFrames: number;
	private landIdleStart: number;
	private tier = 0;
	private phase = 0;
	private chargeT0 = -1e9;
	/** the delta of the last update (x, y, rot, scale per side) and the frozen one that is blending out */
	private last = new Float32Array(8);
	private frozen = new Float32Array(8);
	private frozenT0 = -1e9;

	constructor(json: StingerJson) {
		this.b = json.barb;
		this.idleFrames = json.motion.idleFrames;
		this.landIdleStart = json.motion.landIdleStart;
	}

	reset(tier: number): void {
		this.tier = tier;
		this.phase = 0;
		this.chargeT0 = -1e9;
		this.frozenT0 = -1e9;
		this.last.fill(0);
		this.frozen.fill(0);
	}

	setTier(tier: number): void {
		this.tier = tier;
	}

	/** the charge one shot (the impact, or a tier up) */
	charge(t: number): void {
		this.chargeT0 = t;
	}

	/** a flare is about to start at t: what the delta is worth now blends out from here */
	flareStarting(t: number): void {
		this.frozen.set(this.last);
		this.frozenT0 = t;
	}

	/** idleFrame / flareKind / flareFrame: the motion's (StingerMotion.idleFrame, .flareKind, .flareFrame) */
	update(t: number, dt: number, idleFrame: number, flareKind: number, flareFrame: number): void {
		const T = this.b.tiers[this.tier];
		this.phase = (this.phase + (TAU * dt) / T.period) % TAU;
		this.tint = rgbInt(T.tint[0], T.tint[1], T.tint[2]);
		const charge = t < this.chargeT0 ? 0 : Math.min(1, T.peak + this.chargeLift) * (1 - smooth((t - this.chargeT0) / this.chargeS));
		const a = Math.floor(idleFrame);
		const k = idleFrame - a;
		const b = (a + 1) % this.idleFrames;
		const w = 1 - (t - this.frozenT0) / this.blendS;
		for (let s = 0; s < 2; s += 1) {
			const S = this.b.sides[SIDES[s]];
			const o = s * 4;
			let vis = S.idle[a * 5 + 4] + (S.idle[b * 5 + 4] - S.idle[a * 5 + 4]) * k;
			for (let c = 0; c < 4; c += 1) this.last[o + c] = 0;
			if (flareKind !== FLARE_NONE && flareFrame >= 0) {
				const track = flareKind === FLARE_TIER ? S.tier : S.land;
				const ga = Math.floor(flareFrame);
				const gk = flareFrame - ga;
				for (let c = 0; c < 4; c += 1) this.last[o + c] = track[ga * 4 + c] + (track[ga * 4 + 4 + c] - track[ga * 4 + c]) * gk;
				// land_flare has its own occlusion (the flared front wing): the lower of the two
				if (flareKind === FLARE_LAND) vis = Math.min(vis, S.landVisibility[ga] + (S.landVisibility[ga + 1] - S.landVisibility[ga]) * gk);
			}
			if (w > 0) for (let c = 0; c < 4; c += 1) this.last[o + c] += this.frozen[o + c] * w;
			this.x[s] = S.idle[a * 5] + (S.idle[b * 5] - S.idle[a * 5]) * k + this.last[o];
			this.y[s] = S.idle[a * 5 + 1] + (S.idle[b * 5 + 1] - S.idle[a * 5 + 1]) * k + this.last[o + 1];
			this.rot[s] = ((S.idle[a * 5 + 2] + (S.idle[b * 5 + 2] - S.idle[a * 5 + 2]) * k + this.last[o + 2]) * Math.PI) / 180;
			this.scale[s] = S.idle[a * 5 + 3] + (S.idle[b * 5 + 3] - S.idle[a * 5 + 3]) * k + this.last[o + 3];
			const sin = 0.5 + 0.5 * Math.sin(this.phase + S.phase);
			const A = clamp01(vis) * Math.max(T.base + (T.peak - T.base) * sin * sin, charge);
			this.highlight[s] = A;
			this.halo[s] = (T.halo * A) / T.peak;
		}
	}
}

// ---- eyes ---------------------------------------------------------------------------------------------
// Four eyes on three heads (left corner lion, centre lion with two eyes, right corner lion).
//   blink   lid frames open / quarter / half / three_quarter / closed from the 60 fps sequence (close 70 ms,
//           hold 50, open 110). One head at a time, now and then a double (the second starts doubleGapS later).
//   glow    one additive glow sprite PER lid frame (already clipped to what is left of the opening), none when
//           closed: alpha = pulse (low..high, one cycle per period, a third apart per head) + 0.6 env gain.
//   flare   one shot at the landing and on every tier up, p = (t - t_start - eye.delay) / duration, env(p) =
//           p / a up to the peak (a = attack / duration), then (1 - (p - a) / (1 - a)) ^ 2. Bloom: alpha 0.55
//           env gain, scale = eye.size tier.size (0.45 + 0.55 min(1, p / a)) (1 + 0.25 max(0, p - a)). Streak:
//           q = p / 0.55, alpha 0.9 env(q) gain, scale x = size (0.3 + 0.7 min(1, q / 0.25)), y = size (1 - 0.4
//           q). Tint: the eye's yellow green to pale yellow white with env ^ 2. A flare cancels a blink in
//           progress and no blink starts until afterFlareS after its start.
export const LID_OPEN = 0;
export const LID_CLOSED = 4;
const FLARE_FROM = [0.88, 0.84, 0.42];
const FLARE_TO = [1.0, 1.0, 0.78];
export class EyeFx {
	readonly names: string[];
	/** per eye */
	readonly lid: Uint8Array;
	readonly glowAlpha: Float32Array;
	readonly bloomAlpha: Float32Array;
	readonly bloomScale: Float32Array;
	readonly streakAlpha: Float32Array;
	readonly streakScaleX: Float32Array;
	readonly streakScaleY: Float32Array;
	readonly flareTint: Uint32Array;
	pulse = { low: 0.1, high: 0.32, periodS: 3.5 };
	blink = { gapMinS: 2.4, gapMaxS: 6.2, doubleChance: 0.2, doubleGapS: 0.3, afterFlareS: 0.85 };
	/** blinks started since reset (DEV state) */
	blinks = 0;
	private e: StingerJson['eyes'];
	private eyes: StingerJson['eyes']['eyes'][string][];
	/** eye -> head index; per head: the running blink's start (or -1), a queued second blink, the next start */
	private head: Uint8Array;
	private heads: number;
	private blinkT0: Float32Array;
	private blinkAgain: Float32Array;
	private nextBlink: Float32Array;
	private tier = 0;
	private flareT0 = -1e9;
	private random: () => number;

	constructor(json: StingerJson, random: () => number = Math.random) {
		this.e = json.eyes;
		this.random = random;
		this.names = Object.keys(this.e.eyes);
		this.eyes = this.names.map((n) => this.e.eyes[n]);
		const n = this.names.length;
		const headNames: string[] = [];
		this.head = new Uint8Array(n);
		this.names.forEach((name, i) => {
			const h = name.startsWith('centre') ? 'centre' : name;
			if (!headNames.includes(h)) headNames.push(h);
			this.head[i] = headNames.indexOf(h);
		});
		this.heads = headNames.length;
		this.lid = new Uint8Array(n);
		this.glowAlpha = new Float32Array(n);
		this.bloomAlpha = new Float32Array(n);
		this.bloomScale = new Float32Array(n);
		this.streakAlpha = new Float32Array(n);
		this.streakScaleX = new Float32Array(n);
		this.streakScaleY = new Float32Array(n);
		this.flareTint = new Uint32Array(n);
		this.blinkT0 = new Float32Array(this.heads);
		this.blinkAgain = new Float32Array(this.heads);
		this.nextBlink = new Float32Array(this.heads);
	}

	private gap(): number {
		return this.blink.gapMinS + (this.blink.gapMaxS - this.blink.gapMinS) * this.random();
	}

	reset(tier: number, t = 0): void {
		this.tier = tier;
		this.flareT0 = -1e9;
		this.blinks = 0;
		for (let h = 0; h < this.heads; h += 1) {
			this.blinkT0[h] = -1;
			this.blinkAgain[h] = -1;
			// staggered, so the three heads never start their first blink together
			this.nextBlink[h] = t + this.gap() * (0.35 + (0.65 * (h + 1)) / this.heads);
		}
	}

	setTier(tier: number): void {
		this.tier = tier;
	}

	/** the flare starts at t (use the NEW tier on a tier up: setTier first) */
	flare(t: number): void {
		this.flareT0 = t;
		for (let h = 0; h < this.heads; h += 1) {
			this.blinkT0[h] = -1; // lids open at once
			this.blinkAgain[h] = -1;
			if (this.nextBlink[h] < t + this.blink.afterFlareS) this.nextBlink[h] = t + this.blink.afterFlareS + this.gap() * 0.3;
		}
	}

	private env(p: number, a: number): number {
		if (p < 0 || p > 1) return 0;
		if (p < a) return p / a;
		const d = 1 - (p - a) / (1 - a);
		return d * d;
	}

	update(t: number): void {
		const seq = this.e.blink.sequence60;
		const blinkS = seq.length / 60;
		// one head at a time
		let busy = false;
		for (let h = 0; h < this.heads; h += 1) {
			if (this.blinkT0[h] >= 0 && t - this.blinkT0[h] >= blinkS) this.blinkT0[h] = -1;
			if (this.blinkT0[h] >= 0 || this.blinkAgain[h] >= 0) busy = true;
		}
		for (let h = 0; h < this.heads; h += 1) {
			if (this.blinkT0[h] < 0 && this.blinkAgain[h] >= 0 && t >= this.blinkAgain[h]) {
				this.blinkT0[h] = this.blinkAgain[h];
				this.blinkAgain[h] = -1;
				this.blinks += 1;
			} else if (!busy && this.blinkT0[h] < 0 && t >= this.nextBlink[h]) {
				this.blinkT0[h] = t;
				this.blinks += 1;
				this.blinkAgain[h] = this.random() < this.blink.doubleChance ? t + this.blink.doubleGapS : -1;
				this.nextBlink[h] = t + this.gap();
				busy = true;
			} else if (busy && t >= this.nextBlink[h] && this.blinkT0[h] < 0) this.nextBlink[h] = t + 0.25; // wait for the other head
		}
		const F = this.e.flare;
		const T = F.tiers[this.tier];
		const a = F.attack / F.duration;
		for (let i = 0; i < this.eyes.length; i += 1) {
			const E = this.eyes[i];
			const h = this.head[i];
			const b0 = this.blinkT0[h];
			const frame = b0 >= 0 ? (seq[Math.min(Math.floor((t - b0) * 60), seq.length - 1)] ?? LID_OPEN) : LID_OPEN;
			this.lid[i] = frame;
			const p = (t - this.flareT0 - E.delay) / F.duration;
			const env = this.env(p, a);
			const pulse = this.pulse.low + (this.pulse.high - this.pulse.low) * (0.5 + 0.5 * Math.sin((TAU * t) / this.pulse.periodS + (h * TAU) / 3));
			this.glowAlpha[i] = frame === LID_CLOSED ? 0 : Math.min(1.2, pulse + 0.6 * env * T.gain);
			const size = E.size * T.size;
			this.bloomAlpha[i] = 0.55 * env * T.gain;
			this.bloomScale[i] = size * (0.45 + 0.55 * Math.min(1, Math.max(p, 0) / a)) * (1 + 0.25 * Math.max(0, p - a));
			const q = p / 0.55;
			this.streakAlpha[i] = 0.9 * this.env(q, a) * T.gain;
			this.streakScaleX[i] = size * (0.3 + 0.7 * Math.min(1, Math.max(q, 0) / 0.25));
			this.streakScaleY[i] = size * (1 - 0.4 * clamp01(q));
			const m = env * env;
			this.flareTint[i] = rgbInt(FLARE_FROM[0] + (FLARE_TO[0] - FLARE_FROM[0]) * m, FLARE_FROM[1] + (FLARE_TO[1] - FLARE_FROM[1]) * m, FLARE_FROM[2] + (FLARE_TO[2] - FLARE_FROM[2]) * m);
		}
	}
}
