// THE PLAQUE'S MOTES (Corey 2026-10-17 08:52: "have a bunch of dots on the little screen swirling around, then come
// together to form the sentence, and explode back into particles when existing"). Gold dust in lamplight inside the
// plaque's text box (game/plaqueTips.ts PLAQUE_TIPS.box), the same warm gold as the flames' embers. Pure arithmetic into
// preallocated typed arrays: components/BoardPlaque.svelte maps the outputs onto one ParticleContainer of sprites on
// one small texture made once. Nothing allocates in step().
//
// Every mote is in one of three states, in the box's own layout units (x from its centre, y down):
//   FREE    it drifts on a slow swirling flow: two rows of vortices (a stream function that is 0 on the box's top and
//           bottom, so the flow never leaves it there) moving along the box, a light drift, each mote's own wander,
//           plus whatever kick it was given (a burst), which dies away over burstTau. It wraps at the box's ends, where
//           it has faded out (edgeX), so nothing pops.
//   GATHER  it streams from where it was to its glyph point (which may be moving: the scroll) over its own duration,
//           eased, on a curve to one side (curl), brighter as it flies.
//   ON      it sits on its glyph point, dim (onAlpha): the crisp text is up over it.
// A release (the burst, or a scrolling letter leaving at the left edge) turns ON and GATHER motes FREE again with a
// kick and a brief flash.
export const PLAQUE_MOTES = {
	/** "a bunch of dots": the brief's 150 to 250. The phone tier draws fewer (measured cost, see the r2 report) */
	count: 220,
	countPhone: 170,
	/** the share of the motes that form a line (the rest keep drifting around it); a scrolling line has this many on
	 *  the part of it inside the box */
	formShare: 0.62,
	/** the mote texture: a soft round dot, this many px across, made once */
	texPx: 32,
	/** a mote's size on screen, the texture's full width (its bright core is about half), CSS px, smallest to largest
	 *  (sizePow skews them small: mostly fine dust, a few larger specks) */
	sizeCss: [2.6, 6.8] as readonly [number, number],
	sizePow: 2.2,
	/** "dust in lamplight": each mote's own brightness, and its slow twinkle (Hz range, depth) */
	alpha: [0.28, 0.9] as readonly [number, number],
	twinkleHz: [0.25, 1.1] as readonly [number, number],
	twinkleDepth: 0.5,
	/** the embers' warm gold (FLAMES.embers.tint 1, 0.72, 0.38 is the darker end), a mote picks a mix of the two */
	colours: [0xffe6b0, 0xffb862] as readonly [number, number],
	// ---- the drift (layout units, seconds) ----
	/** the vortices' width (one pair across this many units), their top speed, how fast the pattern moves along */
	cellUnits: 230,
	speed: 15,
	travelHz: 0.035,
	/** a second, finer row of vortices at this share of the speed (two rows up the box) */
	second: 0.55,
	secondCellUnits: 150,
	/** a light wind along the box (units a second) */
	drift: 4,
	/** each mote's own slow wander (units a second, Hz range) */
	wander: 5,
	wanderHz: [0.08, 0.3] as readonly [number, number],
	/** the fade at the box's ends and top and bottom (units): a mote wraps from one end to the other unseen */
	edgeX: 30,
	edgeY: 7,
	// ---- forming, the text, the burst ----
	/** the drifting motes dim to this while a line is up (so they never compete with it), over dimMs */
	textDim: 0.42,
	dimMs: 350,
	/** a mote on its letter: this bright (the text is up over it) */
	onAlpha: 0.28,
	/** a streaming mote is this much brighter than it drifts, and curves this far (units) to one side of its path */
	gatherBoost: 1.35,
	gatherCurl: [6, 34] as readonly [number, number],
	/** the burst: each mote's kick away from the line's centre (units a second), and how fast it dies (s); a flash of
	 *  brightness that dies over flashTau (s) */
	burstSpeed: [110, 330] as readonly [number, number],
	burstTau: 0.2,
	burstFlash: 0.9,
	flashTau: 0.32,
	/** a scrolling letter crumbling at the left edge: its mote's kick (units a second, mostly leftwards) */
	exitSpeed: [50, 150] as readonly [number, number],
	/** ...let go this far (units) inside the box's left end, so it is still seen as it flies off into the end's fade */
	exitInset: 18,
	/** at most this many glyph points per line (a long scrolling line's whole length) */
	maxPoints: 2048,
};

export const MOTE_FREE = 0;
export const MOTE_GATHER = 1;
export const MOTE_ON = 2;

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

export class PlaqueMotes {
	readonly n: number;
	/** position (layout units, the box's own space; a mote on a letter is at its point plus the scroll) */
	readonly x: Float32Array;
	readonly y: Float32Array;
	/** the output: brightness 0..1 (before the layer's own fade) */
	readonly alpha: Float32Array;
	readonly size: Float32Array; // 0..1 along sizeCss
	readonly tint: Uint32Array;
	readonly state: Uint8Array;
	/** the glyph point a GATHER / ON mote is bound to */
	readonly target: Int32Array;
	private ex: Float32Array;
	private ey: Float32Array;
	private flash: Float32Array;
	private base: Float32Array;
	private twHz: Float32Array;
	private twPh: Float32Array;
	private wHzX: Float32Array;
	private wHzY: Float32Array;
	private wPh: Float32Array;
	private fx: Float32Array;
	private fy: Float32Array;
	private g0: Float32Array;
	private gMs: Float32Array;
	private curl: Float32Array;
	/** the free list (indices of FREE motes) */
	private free: Int32Array;
	freeCount = 0;
	/** the glyph points (layout units, the text's own space: the screen x is px + offset) */
	readonly px: Float32Array;
	readonly py: Float32Array;
	/** the mote on each point (-1 none) */
	readonly owner: Int32Array;
	points = 0;
	/** the text's scroll offset (layout units): a point is at (px + offset, py) */
	offset = 0;
	/** the box [halfWidth, top, bottom] */
	hw = 312;
	top = -42;
	bot = 38;
	/** the dim of the drifting motes (1: none), eased toward dimTo */
	dim = 1;
	dimTo = 1;
	/** the time (s) of the flow */
	private t = 0;

	constructor(n: number, rand: () => number = Math.random) {
		const P = PLAQUE_MOTES;
		this.n = n;
		const f = () => new Float32Array(n);
		this.x = f();
		this.y = f();
		this.alpha = f();
		this.size = f();
		this.ex = f();
		this.ey = f();
		this.flash = f();
		this.base = f();
		this.twHz = f();
		this.twPh = f();
		this.wHzX = f();
		this.wHzY = f();
		this.wPh = f();
		this.fx = f();
		this.fy = f();
		this.g0 = f();
		this.gMs = f();
		this.curl = f();
		this.tint = new Uint32Array(n);
		this.state = new Uint8Array(n);
		this.target = new Int32Array(n).fill(-1);
		this.free = new Int32Array(n);
		this.px = new Float32Array(P.maxPoints);
		this.py = new Float32Array(P.maxPoints);
		this.owner = new Int32Array(P.maxPoints).fill(-1);
		const [c0, c1] = P.colours;
		for (let i = 0; i < n; i += 1) {
			this.size[i] = Math.pow(rand(), P.sizePow);
			this.base[i] = lerp(P.alpha[0], P.alpha[1], rand());
			this.twHz[i] = lerp(P.twinkleHz[0], P.twinkleHz[1], rand());
			this.twPh[i] = rand() * TAU;
			this.wHzX[i] = lerp(P.wanderHz[0], P.wanderHz[1], rand()) * TAU;
			this.wHzY[i] = lerp(P.wanderHz[0], P.wanderHz[1], rand()) * TAU;
			this.wPh[i] = rand() * TAU;
			this.curl[i] = lerp(P.gatherCurl[0], P.gatherCurl[1], rand()) * (rand() < 0.5 ? -1 : 1);
			const m = rand();
			const ch = (sh: number) => Math.round(lerp((c0 >> sh) & 0xff, (c1 >> sh) & 0xff, m));
			this.tint[i] = (ch(16) << 16) | (ch(8) << 8) | ch(0);
		}
		this.scatter(rand);
	}

	/** the box (a new layout): every mote kept inside it */
	setBox(hw: number, top: number, bot: number): void {
		this.hw = hw;
		this.top = top;
		this.bot = bot;
		for (let i = 0; i < this.n; i += 1) {
			if (this.x[i] > hw) this.x[i] = hw;
			if (this.x[i] < -hw) this.x[i] = -hw;
			if (this.y[i] < top + 1) this.y[i] = top + 1;
			if (this.y[i] > bot - 1) this.y[i] = bot - 1;
		}
	}

	/** every mote free, still, somewhere new in the box (the start, or back after a hide) */
	scatter(rand: () => number = Math.random): void {
		this.freeCount = 0;
		for (let i = 0; i < this.n; i += 1) {
			this.x[i] = lerp(-this.hw, this.hw, rand());
			this.y[i] = lerp(this.top + 2, this.bot - 2, rand());
			this.ex[i] = this.ey[i] = this.flash[i] = 0;
			this.state[i] = MOTE_FREE;
			this.target[i] = -1;
			this.free[this.freeCount++] = i;
		}
		for (let k = 0; k < this.points; k += 1) this.owner[k] = -1;
		this.dim = this.dimTo = 1;
	}

	/** a new line's glyph points (the old ones are dropped: call release first) */
	setPoints(xs: ArrayLike<number>, ys: ArrayLike<number>, count: number): void {
		const c = Math.min(count, this.px.length);
		for (let k = 0; k < c; k += 1) {
			this.px[k] = xs[k];
			this.py[k] = ys[k];
			this.owner[k] = -1;
		}
		this.points = c;
	}

	/** send a free mote to point k, landing in `ms`: `nearest` takes the free mote nearest the point, else any */
	bind(k: number, nowMs: number, ms: number, nearest: boolean, rand: () => number = Math.random): boolean {
		if (k < 0 || k >= this.points || this.owner[k] >= 0 || this.freeCount === 0) return false;
		let slot = this.freeCount - 1;
		if (nearest) {
			const tx = this.px[k] + this.offset;
			const ty = this.py[k];
			let best = Infinity;
			for (let s = 0; s < this.freeCount; s += 1) {
				const i = this.free[s];
				const d = (this.x[i] - tx) * (this.x[i] - tx) + 4 * (this.y[i] - ty) * (this.y[i] - ty);
				if (d < best) {
					best = d;
					slot = s;
				}
			}
		} else slot = Math.floor(rand() * this.freeCount);
		const i = this.free[slot];
		this.free[slot] = this.free[--this.freeCount];
		this.state[i] = MOTE_GATHER;
		this.target[i] = k;
		this.owner[k] = i;
		this.fx[i] = this.x[i];
		this.fy[i] = this.y[i];
		this.g0[i] = nowMs;
		this.gMs[i] = Math.max(1, ms);
		return true;
	}

	/** mote i free again with a kick (units a second) and a flash */
	private loose(i: number, kx: number, ky: number, flash: number): void {
		const k = this.target[i];
		if (k >= 0 && k < this.points && this.owner[k] === i) this.owner[k] = -1;
		this.state[i] = MOTE_FREE;
		this.target[i] = -1;
		this.ex[i] = kx;
		this.ey[i] = ky;
		this.flash[i] = flash;
		this.free[this.freeCount++] = i;
	}

	/** THE BURST: every mote on or flying to the line flies out from (cx, cy) and drifts off */
	burst(cx: number, cy: number, rand: () => number = Math.random): void {
		const P = PLAQUE_MOTES;
		for (let i = 0; i < this.n; i += 1) {
			if (this.state[i] === MOTE_FREE) continue;
			let dx = this.x[i] - cx;
			let dy = (this.y[i] - cy) * 2.5;
			const d = Math.hypot(dx, dy) || 1;
			const a = Math.atan2(dy / d, dx / d) + (rand() - 0.5) * 1.4;
			const sp = lerp(P.burstSpeed[0], P.burstSpeed[1], rand());
			dx = Math.cos(a) * sp;
			dy = Math.sin(a) * sp * 0.6;
			this.loose(i, dx, dy, P.burstFlash);
		}
	}

	/** every mote let go at once with no kick (a hide) */
	releaseAll(): void {
		for (let i = 0; i < this.n; i += 1) if (this.state[i] !== MOTE_FREE) this.loose(i, 0, 0, 0);
	}

	/** how many motes are on or flying to the line */
	bound(): number {
		return this.n - this.freeCount;
	}

	/** one frame: dt seconds, `nowMs` the clock the binds used; `leftEdge` releases ON motes whose point has scrolled
	 *  past the box's left end (the scroll) */
	step(dt: number, nowMs: number, leftEdge: boolean, rand: () => number = Math.random): void {
		const P = PLAQUE_MOTES;
		this.t += dt;
		const t = this.t;
		const { hw, top, bot } = this;
		const H = Math.max(1, bot - top);
		const piH = Math.PI / H;
		const k1 = TAU / P.cellUnits;
		const k2 = TAU / P.secondCellUnits;
		const w1 = TAU * P.travelHz;
		const w2 = -w1 * 0.7;
		const S1 = P.speed;
		const S2 = P.speed * P.second;
		const vyK1 = (S1 * k1) / piH;
		const vyK2 = (S2 * k2) / (2 * piH);
		const decay = Math.exp(-dt / P.burstTau);
		const fdecay = Math.exp(-dt / P.flashTau);
		const dimK = 1 - Math.exp((-dt * 1000) / P.dimMs);
		this.dim += (this.dimTo - this.dim) * dimK;
		const dim = this.dim;
		const off = this.offset;
		const W2 = hw * 2;
		for (let i = 0; i < this.n; i += 1) {
			const st = this.state[i];
			let x = this.x[i];
			let y = this.y[i];
			let a = this.base[i] * (1 - P.twinkleDepth + P.twinkleDepth * (0.5 + 0.5 * Math.sin(TAU * this.twHz[i] * t + this.twPh[i])));
			if (st === MOTE_FREE) {
				const Y = (y - top) * piH;
				const sY = Math.sin(Y);
				const cY = Math.cos(Y);
				const p1 = k1 * x - w1 * t;
				const p2 = k2 * x - w2 * t + 1.7;
				const s2Y = 2 * sY * cY;
				const c2Y = cY * cY - sY * sY;
				const ph = this.wPh[i];
				const vx = S1 * cY * Math.sin(p1) + S2 * c2Y * Math.sin(p2) + P.drift + P.wander * Math.sin(this.wHzX[i] * t + ph);
				const vy = -vyK1 * sY * Math.cos(p1) - vyK2 * s2Y * Math.cos(p2) + P.wander * 0.5 * Math.cos(this.wHzY[i] * t + ph * 1.3);
				x += (vx + this.ex[i]) * dt;
				y += (vy + this.ey[i]) * dt;
				this.ex[i] *= decay;
				this.ey[i] *= decay;
				if (y < top + 1) {
					y = top + 1;
					if (this.ey[i] < 0) this.ey[i] = -this.ey[i] * 0.4;
				} else if (y > bot - 1) {
					y = bot - 1;
					if (this.ey[i] > 0) this.ey[i] = -this.ey[i] * 0.4;
				}
				if (x > hw) x -= W2;
				else if (x < -hw) x += W2;
				const fxE = clamp01((hw - Math.abs(x)) / P.edgeX);
				const fyE = clamp01(Math.min(y - top, bot - y) / P.edgeY);
				a *= fxE * fyE * dim * (1 + this.flash[i]);
				this.flash[i] *= fdecay;
			} else {
				const k = this.target[i];
				const tx = this.px[k] + off;
				const ty = this.py[k];
				if (st === MOTE_GATHER) {
					const u = clamp01((nowMs - this.g0[i]) / this.gMs[i]);
					const e = easeInOut(u);
					const fx = this.fx[i];
					const fy = this.fy[i];
					const dx = tx - fx;
					const dy = ty - fy;
					const len = Math.hypot(dx, dy) || 1;
					const bow = this.curl[i] * Math.sin(Math.PI * u) * Math.min(1, len / 60);
					x = fx + dx * e + (-dy / len) * bow;
					y = fy + dy * e + (dx / len) * bow;
					// the curve never takes it out of the box
					if (y < top + 1) y = top + 1;
					else if (y > bot - 1) y = bot - 1;
					if (x < -hw) x = -hw;
					else if (x > hw) x = hw;
					a *= lerp(P.gatherBoost, P.onAlpha, clamp01((u - 0.7) / 0.3));
					if (u >= 1) this.state[i] = MOTE_ON;
				} else {
					x = tx;
					y = ty;
					a *= P.onAlpha;
				}
				// a scrolling letter past the left end: it crumbles back into a drifting mote
				if (leftEdge && x < -hw + P.exitInset) {
					const sp = lerp(P.exitSpeed[0], P.exitSpeed[1], rand());
					const ang = Math.PI + (rand() - 0.5) * 1.6;
					this.x[i] = x;
					this.y[i] = y;
					this.loose(i, Math.cos(ang) * sp, Math.sin(ang) * sp * 0.7, P.burstFlash * 0.6);
				}
			}
			this.x[i] = x;
			this.y[i] = y;
			this.alpha[i] = a > 1 ? 1 : a;
		}
	}
}
