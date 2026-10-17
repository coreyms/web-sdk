// THE PLAQUE'S MOTES (Corey 2026-10-17 08:52: "have a bunch of dots on the little screen swirling around, then come
// together to form the sentence, and explode back into particles when existing"; r3, 10:17: "can we increase the
// amount of particles and mark their movement more spiral galaxy like? When they form into words, have it as a lower
// transition, but keep it as an explosion on the way out. The particles also have specs that are too big, especially on
// mobile screens ... No particles while words are displayed except intro/outro"). Gold dust in lamplight inside the
// plaque's text box (game/plaqueTips.ts PLAQUE_TIPS.box), the flames' ember gold. Pure arithmetic into preallocated
// typed arrays: components/BoardPlaque.svelte maps the outputs onto one ParticleContainer of sprites on one small
// texture made once. Nothing allocates in step().
//
// THE GALAXY: every mote has a home that moves on its own, in the box's layout units (x from its centre, y down),
// squeezed into the box's long ellipse (rx, ry of its half width and height):
//   arms    most motes lie along `arms` trailing spiral arms (angle = the arm's + wind ln(r / rMin), spread about it),
//           the whole pattern turning once every turnS seconds; each mote slides slowly inward along its arm (inflow)
//           and starts again at the rim, faded out at both ends, so the arms wind inward without ever popping.
//   core    a bright knot in the middle turning faster (coreTurnS).
//   halo    a thin dust of the disk between the arms, turning with them.
// A mote is in one of three states:
//   FREE    at its home plus a displacement (the burst's kick, which dies over burstTau; the displacement itself dies
//           over returnTau, so a burst mote drifts back into the galaxy).
//   GATHER  it spirals into its glyph point over its own duration: the offset from the point (in the ellipse's own
//           measure) shrinks while it turns gatherSpin, slowly eased ("a lower transition").
//   ON      on its point, fading out over onFadeMs: while the words are up there are no motes ("No particles while
//           words are displayed except intro/outro").
// THE BURST puts every mote back on the glyph points of the part of the line on show, bright, and kicks them out from
// its centre ("keep it as an explosion on the way out").
export const PLAQUE_MOTES = {
	/** "increase the amount of particles" (10:17; r2 had 220 / 170): measured cost in the r3 report */
	count: 480,
	countPhone: 400,
	/** the mote texture: a soft round dot, this many px across, made once */
	texPx: 32,
	/** "specs that are too big, especially on mobile screens": a mote's size on screen, the texture's full width (its
	 *  bright core is about a third), CSS px, smallest to largest (sizePow skews them small), on a text box sizeRefCss
	 *  wide (the desktop's at 1440x900); a smaller box scales them down with it, to sizeMinScale at the least, a bigger one
	 *  (a large window) up, to sizeMaxScale, so they keep their size against the plaque */
	sizeCss: [1.3, 3.6] as readonly [number, number],
	sizePow: 2.4,
	sizeRefCss: 337,
	sizeMinScale: 0.55,
	sizeMaxScale: 2,
	/** "dust in lamplight": each mote's own brightness, and its slow twinkle (Hz range, depth) */
	alpha: [0.3, 0.95] as readonly [number, number],
	twinkleHz: [0.25, 1.1] as readonly [number, number],
	twinkleDepth: 0.45,
	/** the embers' warm gold (FLAMES.embers.tint 1, 0.72, 0.38 is the darker end), a mote picks a mix of the two */
	colours: [0xffe6b0, 0xffb862] as readonly [number, number],
	// ---- the galaxy ("more spiral galaxy like") ----
	/** the ellipse it fills: these shares of the box's half width and half height */
	rx: 0.8,
	ry: 0.96,
	/** two trailing arms; each winds `wind` radians per e-fold of radius from rMin out to the rim */
	arms: 2,
	wind: 1.9,
	rMin: 0.1,
	/** an arm mote's spread about its arm (radians at the rim, a third of it at rMin) and in radius */
	armSpread: 0.34,
	radialSpread: 0.05,
	/** the shares of the motes in the core and in the halo (the rest are on the arms), the core's radius */
	coreShare: 0.11,
	haloShare: 0.1,
	coreR: 0.13,
	/** the pattern turns once every turnS seconds, the core once every coreTurnS ("a slow rotation") */
	turnS: 34,
	coreTurnS: 12,
	/** an arm mote slides inward along its arm at this much radius a second (x its own 0.6 to 1.4) */
	inflow: 0.018,
	/** the fades at the rim and at rMin (shares of the arm's length), the brightness in the middle and at the rim */
	fadeOuter: 0.16,
	fadeInner: 0.06,
	coreBoost: 1.25,
	rimAlpha: 1,
	haloAlpha: 0.55,
	// ---- forming ("When they form into words, have it as a lower transition") ----
	/** a forming mote turns this far around its point as it closes in, brighter as it flies */
	gatherSpin: Math.PI * 1.1,
	gatherBoost: 1.2,
	/** on its point it fades out over this long: the text is up over it */
	onFadeMs: 450,
	// ---- the burst ("keep it as an explosion on the way out") ----
	/** each mote's kick away from the line's centre (units a second), how fast the kick dies (s), the flash of
	 *  brightness and how fast it dies (s), and how fast a mote drifts back home into the galaxy (s) */
	burstSpeed: [150, 440] as readonly [number, number],
	burstTau: 0.22,
	burstFlash: 1.0,
	flashTau: 0.35,
	returnTau: 1.1,
	/** at most this many glyph points per line (a long scrolling line's whole length) */
	maxPoints: 4096,
};

export const MOTE_FREE = 0;
export const MOTE_GATHER = 1;
export const MOTE_ON = 2;
const KIND_CORE = -1;
const KIND_HALO = -2;

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOutSine = (u: number) => -(Math.cos(Math.PI * u) - 1) / 2;

export class PlaqueMotes {
	readonly n: number;
	/** position (layout units, the box's own space) */
	readonly x: Float32Array;
	readonly y: Float32Array;
	/** the output: brightness 0..1 (before the layer's own fade) */
	readonly alpha: Float32Array;
	readonly size: Float32Array; // 0..1 along sizeCss
	readonly tint: Uint32Array;
	readonly state: Uint8Array;
	/** the glyph point a GATHER / ON mote is on */
	readonly target: Int32Array;
	/** motes drawn (alpha over 0.003) after the last step */
	lit = 0;
	// the galaxy
	private kind: Int8Array;
	private r0: Float32Array;
	private jit: Float32Array;
	private rj: Float32Array;
	private sp: Float32Array;
	private th0: Float32Array;
	// FREE: the displacement from home and its velocity, the flash
	private dx: Float32Array;
	private dy: Float32Array;
	private vx: Float32Array;
	private vy: Float32Array;
	private flash: Float32Array;
	// looks
	private base: Float32Array;
	private twHz: Float32Array;
	private twPh: Float32Array;
	// GATHER: the polar offset from the point at the start (ellipse measure), start, duration, the turn's sign; ON: landed at
	private gr: Float32Array;
	private ga: Float32Array;
	private g0: Float32Array;
	private gMs: Float32Array;
	private on0: Float32Array;
	/** a shuffle of the motes (which mote goes to which point) */
	private order: Int32Array;
	/** the glyph points (layout units, the text's own space: the screen x is px + offset) */
	readonly px: Float32Array;
	readonly py: Float32Array;
	points = 0;
	/** the text's scroll offset (layout units): a point is at (px + offset, py) */
	offset = 0;
	/** the box [halfWidth, top, bottom] */
	hw = 312;
	top = -42;
	bot = 38;
	/** home, written by home() */
	private hx = 0;
	private hy = 0;
	private hf = 1;

	constructor(n: number, rand: () => number = Math.random) {
		const P = PLAQUE_MOTES;
		this.n = n;
		const f = () => new Float32Array(n);
		this.x = f();
		this.y = f();
		this.alpha = f();
		this.size = f();
		this.r0 = f();
		this.jit = f();
		this.rj = f();
		this.sp = f();
		this.th0 = f();
		this.dx = f();
		this.dy = f();
		this.vx = f();
		this.vy = f();
		this.flash = f();
		this.base = f();
		this.twHz = f();
		this.twPh = f();
		this.gr = f();
		this.ga = f();
		this.g0 = f();
		this.gMs = f();
		this.on0 = f();
		this.kind = new Int8Array(n);
		this.tint = new Uint32Array(n);
		this.state = new Uint8Array(n);
		this.target = new Int32Array(n).fill(-1);
		this.order = new Int32Array(n);
		this.px = new Float32Array(P.maxPoints);
		this.py = new Float32Array(P.maxPoints);
		const [c0, c1] = P.colours;
		const nCore = Math.round(n * P.coreShare);
		const nHalo = Math.round(n * P.haloShare);
		for (let i = 0; i < n; i += 1) {
			this.order[i] = i;
			this.size[i] = Math.pow(rand(), P.sizePow);
			this.base[i] = lerp(P.alpha[0], P.alpha[1], rand());
			this.twHz[i] = lerp(P.twinkleHz[0], P.twinkleHz[1], rand());
			this.twPh[i] = rand() * TAU;
			this.sp[i] = lerp(0.6, 1.4, rand());
			this.th0[i] = rand() * TAU;
			if (i < nCore) {
				this.kind[i] = KIND_CORE;
				// denser toward the middle
				this.r0[i] = P.coreR * Math.pow(rand(), 0.7);
			} else if (i < nCore + nHalo) {
				this.kind[i] = KIND_HALO;
				this.r0[i] = lerp(0.18, 0.98, Math.sqrt(rand()));
			} else {
				this.kind[i] = i % P.arms;
				this.r0[i] = lerp(P.rMin, 1, rand());
				// spread about the arm: most close to it
				this.jit[i] = (rand() + rand() + rand() - 1.5) / 1.5;
				this.rj[i] = (rand() - 0.5) * 2 * P.radialSpread;
			}
			const m = rand();
			const ch = (sh: number) => Math.round(lerp((c0 >> sh) & 0xff, (c1 >> sh) & 0xff, m));
			this.tint[i] = (ch(16) << 16) | (ch(8) << 8) | ch(0);
		}
	}

	/** the box (a new layout) */
	setBox(hw: number, top: number, bot: number): void {
		this.hw = hw;
		this.top = top;
		this.bot = bot;
	}

	/** mote i's home in the galaxy at t seconds into hx, hy, and its brightness there into hf */
	private home(i: number, t: number): void {
		const P = PLAQUE_MOTES;
		const k = this.kind[i];
		let r: number;
		let th: number;
		let f: number;
		if (k >= 0) {
			const span = 1 - P.rMin;
			let u = (this.r0[i] - P.rMin) / span - (P.inflow * this.sp[i] * t) / span;
			u -= Math.floor(u);
			r = P.rMin + u * span;
			// trailing arms: the angle falls with the radius as the pattern turns forward
			th = (k * TAU) / P.arms - P.wind * Math.log(r / P.rMin) + (TAU * t) / P.turnS + this.jit[i] * P.armSpread * (0.33 + 0.67 * r);
			r += this.rj[i];
			f = clamp01((1 - u) / P.fadeOuter) * clamp01(u / P.fadeInner) * lerp(P.coreBoost, P.rimAlpha, u);
		} else if (k === KIND_CORE) {
			r = this.r0[i];
			th = this.th0[i] + (TAU * t * this.sp[i]) / P.coreTurnS;
			f = P.coreBoost;
		} else {
			r = this.r0[i];
			th = this.th0[i] + (TAU * t * 0.85) / P.turnS;
			f = P.haloAlpha * clamp01((1 - r) / P.fadeOuter);
		}
		const mid = (this.top + this.bot) / 2;
		this.hx = Math.cos(th) * r * this.hw * P.rx;
		this.hy = mid + Math.sin(th) * r * ((this.bot - this.top) / 2) * P.ry;
		this.hf = f;
	}

	/** every mote free, at home (the start, or back after a hide) */
	scatter(nowMs: number): void {
		const t = nowMs / 1000;
		for (let i = 0; i < this.n; i += 1) {
			this.home(i, t);
			this.x[i] = this.hx;
			this.y[i] = this.hy;
			this.dx[i] = this.dy[i] = this.vx[i] = this.vy[i] = this.flash[i] = 0;
			this.state[i] = MOTE_FREE;
			this.target[i] = -1;
		}
	}

	/** a new line's glyph points, sorted along x */
	setPoints(xs: ArrayLike<number>, ys: ArrayLike<number>, count: number): void {
		const c = Math.min(count, this.px.length);
		for (let k = 0; k < c; k += 1) {
			this.px[k] = xs[k];
			this.py[k] = ys[k];
		}
		this.points = c;
	}

	/** the points [k0, k1) whose screen x (px + offset) is inside the box */
	windowOf(out: { k0: number; k1: number }): void {
		let k0 = 0;
		while (k0 < this.points && this.px[k0] + this.offset < -this.hw) k0 += 1;
		let k1 = k0;
		while (k1 < this.points && this.px[k1] + this.offset <= this.hw) k1 += 1;
		out.k0 = k0;
		out.k1 = k1;
	}

	private shuffle(rand: () => number): void {
		const o = this.order;
		for (let i = this.n - 1; i > 0; i -= 1) {
			const j = Math.floor(rand() * (i + 1));
			const a = o[i];
			o[i] = o[j];
			o[j] = a;
		}
	}

	/** FORM: every mote spirals into a point of [k0, k1) (spread over them in a random order), landing after ms x
	 *  (1 - jitter .. 1) */
	gather(k0: number, k1: number, nowMs: number, ms: number, jitter: number, rand: () => number = Math.random): void {
		const m = k1 - k0;
		if (m <= 0) return;
		const P = PLAQUE_MOTES;
		const sx = this.hw * P.rx;
		const sy = ((this.bot - this.top) / 2) * P.ry;
		this.shuffle(rand);
		for (let s = 0; s < this.n; s += 1) {
			const i = this.order[s];
			const k = k0 + Math.floor((s * m) / this.n);
			const ox = (this.x[i] - (this.px[k] + this.offset)) / sx;
			const oy = (this.y[i] - this.py[k]) / sy;
			this.gr[i] = Math.hypot(ox, oy);
			this.ga[i] = Math.atan2(oy, ox);
			this.state[i] = MOTE_GATHER;
			this.target[i] = k;
			this.g0[i] = nowMs;
			this.gMs[i] = Math.max(1, ms * (1 - jitter * rand()));
		}
	}

	/** THE BURST: every mote on a point of [k0, k1), bright, kicked out from (cx, cy), then home */
	burst(k0: number, k1: number, cx: number, cy: number, nowMs: number, rand: () => number = Math.random): void {
		const m = k1 - k0;
		const P = PLAQUE_MOTES;
		const t = nowMs / 1000;
		this.shuffle(rand);
		for (let s = 0; s < this.n; s += 1) {
			const i = this.order[s];
			if (m > 0) {
				const k = k0 + Math.floor((s * m) / this.n);
				this.x[i] = this.px[k] + this.offset;
				this.y[i] = this.py[k];
			}
			let ex = this.x[i] - cx;
			let ey = (this.y[i] - cy) * 2.5;
			const d = Math.hypot(ex, ey) || 1;
			const a = Math.atan2(ey / d, ex / d) + (rand() - 0.5) * 1.4;
			const v = lerp(P.burstSpeed[0], P.burstSpeed[1], rand());
			ex = Math.cos(a) * v;
			ey = Math.sin(a) * v * 0.6;
			this.home(i, t);
			this.dx[i] = this.x[i] - this.hx;
			this.dy[i] = this.y[i] - this.hy;
			this.vx[i] = ex;
			this.vy[i] = ey;
			this.flash[i] = P.burstFlash;
			this.state[i] = MOTE_FREE;
			this.target[i] = -1;
		}
	}

	/** every mote let go where it is, no kick (it drifts home) */
	releaseAll(nowMs: number): void {
		const t = nowMs / 1000;
		for (let i = 0; i < this.n; i += 1) {
			if (this.state[i] === MOTE_FREE) continue;
			this.home(i, t);
			this.dx[i] = this.x[i] - this.hx;
			this.dy[i] = this.y[i] - this.hy;
			this.vx[i] = this.vy[i] = this.flash[i] = 0;
			this.state[i] = MOTE_FREE;
			this.target[i] = -1;
		}
	}

	/** one frame: dt seconds, `nowMs` the clock the gathers used */
	step(dt: number, nowMs: number): void {
		const P = PLAQUE_MOTES;
		const t = nowMs / 1000;
		const { hw, top, bot } = this;
		const decay = Math.exp(-dt / P.burstTau);
		const fdecay = Math.exp(-dt / P.flashTau);
		const rdecay = Math.exp(-dt / P.returnTau);
		const sx = hw * P.rx;
		const sy = ((bot - top) / 2) * P.ry;
		const off = this.offset;
		let lit = 0;
		for (let i = 0; i < this.n; i += 1) {
			const st = this.state[i];
			let x: number;
			let y: number;
			let a = this.base[i] * (1 - P.twinkleDepth + P.twinkleDepth * (0.5 + 0.5 * Math.sin(TAU * this.twHz[i] * t + this.twPh[i])));
			if (st === MOTE_FREE) {
				this.home(i, t);
				this.dx[i] += this.vx[i] * dt;
				this.dy[i] += this.vy[i] * dt;
				this.vx[i] *= decay;
				this.vy[i] *= decay;
				this.dx[i] *= rdecay;
				this.dy[i] *= rdecay;
				x = this.hx + this.dx[i];
				y = this.hy + this.dy[i];
				// a burst mote far from home is lit by its flash, not its place in the galaxy
				const fl = this.flash[i];
				a *= Math.max(this.hf, Math.min(1, fl * 1.5)) * (1 + fl);
				this.flash[i] = fl * fdecay;
			} else {
				const k = this.target[i];
				const tx = this.px[k] + off;
				const ty = this.py[k];
				if (st === MOTE_GATHER) {
					const u = clamp01((nowMs - this.g0[i]) / this.gMs[i]);
					const e = easeInOutSine(u);
					const r = this.gr[i] * (1 - e);
					const ang = this.ga[i] + P.gatherSpin * e;
					x = tx + Math.cos(ang) * r * sx;
					y = ty + Math.sin(ang) * r * sy;
					a *= lerp(P.gatherBoost, 1, e);
					if (u >= 1) {
						this.state[i] = MOTE_ON;
						this.on0[i] = nowMs;
					}
				} else {
					x = tx;
					y = ty;
					a *= 1 - clamp01((nowMs - this.on0[i]) / P.onFadeMs);
				}
			}
			// never out of the box
			if (y < top + 1) y = top + 1;
			else if (y > bot - 1) y = bot - 1;
			if (x < -hw) x = -hw;
			else if (x > hw) x = hw;
			this.x[i] = x;
			this.y[i] = y;
			const o = a > 1 ? 1 : a;
			this.alpha[i] = o;
			if (o > 0.003) lit += 1;
		}
		this.lit = lit;
	}
}
