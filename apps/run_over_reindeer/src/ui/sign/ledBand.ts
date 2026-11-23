// THE LED BORDERS' LIGHT (2026-11-22): the Play's 36 LEDs and the Fast Lane key's, each key's light on ONE small 2D
// canvas under the key's frosted band's keylines.
//
// WHY A CANVAS (the brief: frame rate first, an iPhone first). The mock drew every LED as two SVG gradients inside a
// clipped group and animated each one's opacity: about 150 animated SVG nodes under a clip path for the two keys. Here a
// key's whole light is one bitmap: each LED look (its halo and core for one color) is drawn ONCE to a small sprite, and a
// frame is a clear and at most N drawImage calls with a global alpha, cut to the band by the canvas's own clip (set
// once). So a frame costs no style recalculation, no layout and no repaint of the bar: only this canvas's texture
// changes. It is drawn at a capped rate (SIGN.led.fps: 30 a second for the chase, 20 for the twinkle), only while
// something is lit and changing, never while the tab is hidden, and one shared requestAnimationFrame serves every key.
// The canvas is the key's size at the screen's pixel ratio (capped: SIGN.led.maxDpr, maxPx).
import { SIGN } from '../hudTheme';
import { mix, type Band } from './signDraw';

export type LightMode = 'off' | 'idle' | 'chase' | 'run' | 'wait';
type Look = { light: number; halo: number; reach: number; core: number };
type Twinkle = { i: number; t0: number; dur: number };

const bands = new Set<LedBand>();
let raf = 0;
let hooked = false;
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
const hidden = () => typeof document !== 'undefined' && document.hidden;
/** HELD (DEV, through __reindeer.sign.lights; tools/wheel_probe.mjs): every key's light stands on the frame it shows.
 *  A probe that tells one thing from another by the pixels that differ between two captures needs everything else on
 *  the page to stand still, and the lights are the bar's one thing that moves at rest. */
let held = false;
export const holdLights = (hold: boolean) => {
	held = hold;
	if (!hold) kick();
	return held;
};
const loop = () => {
	raf = 0;
	if (hidden() || held) return;
	const t = now();
	let live = false;
	for (const b of bands) live = b.frame(t) || live;
	if (live) raf = requestAnimationFrame(loop);
};
const kick = () => {
	if (typeof requestAnimationFrame === 'undefined') return;
	if (!hooked && typeof document !== 'undefined') {
		hooked = true;
		// a hidden tab draws nothing; coming back, the lights pick up where the clock is
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) kick();
		});
	}
	if (!raf && !hidden() && !held) raf = requestAnimationFrame(loop);
};
/** CSS ease-in-out (cubic-bezier(0.42, 0, 0.58, 1)), as the mock's twinkle eased */
const easeInOut = (x: number) => {
	let t = x;
	for (let i = 0; i < 5; i++) {
		const bx = 3 * (1 - t) * (1 - t) * t * 0.42 + 3 * (1 - t) * t * t * 0.58 + t * t * t;
		const dx = 3 * (1 - t) * (1 - t) * 0.42 + 6 * (1 - t) * t * 0.16 + 3 * t * t * 0.42;
		t -= (bx - x) / (dx || 1);
	}
	return 3 * (1 - t) * t * t + t * t * t;
};
/** the two-runner chase (the mock's keyframes pb-two): an LED's light at phase p of a lap, over a floor */
const chaseAt = (p: number, floor: number) => {
	const q = p < 0.5 ? p : p - 0.5;
	if (q < 0.015) return floor + ((1 - floor) * q) / 0.015;
	if (q < 0.14) return 1 - ((1 - floor) * (q - 0.015)) / 0.125;
	return floor;
};

export class LedBand {
	private ctx: CanvasRenderingContext2D | null = null;
	private sprites = new Map<string, HTMLCanvasElement>();
	private mode: LightMode = 'off';
	private lap = SIGN.led.lapS * 1000;
	private floor: number = SIGN.led.floor;
	private twinkles: Twinkle[] = [];
	private last = -1e9;
	private lit = false;
	private dirty = true;
	private scale = 1;
	private reduced = false;
	/** frames drawn (the probes read it through __reindeer.sign) */
	frames = 0;

	constructor(
		private canvas: HTMLCanvasElement,
		private band: Band,
	) {
		bands.add(this);
		this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/** the key's size on screen, CSS px: the canvas takes that size at the screen's pixel ratio (capped) */
	resize(cssW: number, cssH: number, band: Band = this.band) {
		this.band = band;
		const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, SIGN.led.maxDpr);
		const k = Math.min(dpr, SIGN.led.maxPx / Math.max(cssW, cssH, 1));
		const w = Math.max(1, Math.round(cssW * k));
		const h = Math.max(1, Math.round(cssH * k));
		if (this.canvas.width === w && this.canvas.height === h && this.ctx) return;
		this.canvas.width = w;
		this.canvas.height = h;
		this.ctx = this.canvas.getContext('2d');
		this.scale = w / band.view[2];
		this.sprites.clear();
		if (this.ctx) {
			// the light is cut to the band's channel: the canvas's own clip, set once (a resized canvas starts clean)
			this.ctx.setTransform(this.scale, 0, 0, h / band.view[3], -band.view[0] * this.scale, (-band.view[1] * h) / band.view[3]);
			this.ctx.clip(new Path2D(band.clip), 'evenodd');
		}
		this.dirty = true;
		kick();
	}

	/** off: dark. idle: the soft twinkle. chase: two opposite runners (a round playing; `lapMs` by the turbo level).
	 *  run: the runners over a steady glow of every LED (a mode on). wait: every LED breathing together. */
	set(mode: LightMode, o: { lapMs?: number; floor?: number } = {}) {
		const lap = o.lapMs ?? SIGN.led.lapS * 1000;
		const floor = o.floor ?? SIGN.led.floor;
		if (mode === this.mode && lap === this.lap && floor === this.floor) return;
		this.mode = mode;
		this.lap = lap;
		this.floor = floor;
		this.twinkles = [];
		this.dirty = true;
		kick();
	}

	destroy() {
		bands.delete(this);
		this.sprites.clear();
	}

	private look(): Look {
		const L = SIGN.led;
		if (this.mode === 'idle') return { light: L.idle.light, halo: L.idle.halo, reach: L.idle.reach, core: L.idle.core };
		if (this.mode === 'run') return { light: SIGN.bonus.light, halo: L.spin.halo, reach: L.spin.reach, core: L.spin.core };
		return L.spin;
	}

	/** one LED look for one color, drawn once: the halo spread along the channel and the whiter core */
	private sprite(col: string, L: Look) {
		const key = `${col}|${L.light}|${L.halo}|${L.reach}|${L.core}`;
		let c = this.sprites.get(key);
		if (c) return c;
		const B = this.band;
		const rx = Math.max(B.chW, L.reach * B.step);
		const ry = Math.max(B.chW * 1.2, rx * 0.55);
		const core = Math.max(2, L.core * B.coreK);
		const cry = Math.min(core * 0.7, B.chW * 0.75);
		const s = this.scale;
		c = document.createElement('canvas');
		c.width = Math.max(2, Math.ceil(2 * rx * s));
		c.height = Math.max(2, Math.ceil(2 * ry * s));
		const g = c.getContext('2d');
		if (g) {
			const oval = (ax: number, ay: number, stops: [number, string, number][]) => {
				g.save();
				g.translate(c!.width / 2, c!.height / 2);
				g.scale(ax * s, ay * s);
				const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
				for (const [o, color, a] of stops) {
					const [r, gg, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
					gr.addColorStop(o, `rgba(${r},${gg},${b},${Math.max(0, Math.min(1, a))})`);
				}
				g.fillStyle = gr;
				g.beginPath();
				g.arc(0, 0, 1, 0, Math.PI * 2);
				g.fill();
				g.restore();
			};
			const hot = mix(col, '#ffffff', 0.72);
			oval(rx, ry, [[0, col, L.halo], [0.35, col, L.halo * 0.62], [0.7, col, L.halo * 0.2], [1, col, 0]]);
			oval(core, cry, [[0, '#ffffff', L.light], [0.3, hot, L.light * 0.9], [0.65, col, L.light * 0.55], [1, col, 0]]);
		}
		this.sprites.set(key, c);
		return c;
	}

	/** the idle twinkle (the mock's idleRun): a few LEDs at a time, each a slow rise and fall, then a new few */
	private twinkle(t: number) {
		const I = SIGN.led.idle;
		const N = this.band.leds.length;
		if (!this.twinkles.some((w) => t < w.t0 + w.dur)) {
			const ri = (n: number) => Math.floor(Math.random() * n);
			const want = Math.max(1, Math.round(I.count));
			const apart = Math.max(1, Math.min(3, Math.floor(N / (want * 2))));
			const got: number[] = [];
			for (let tries = 0; N && got.length < want && tries < 400; tries++) {
				const i = ri(N);
				if (got.every((j) => Math.min((i - j + N) % N, (j - i + N) % N) >= apart)) got.push(i);
			}
			const sp = 1 / I.speed;
			this.twinkles = got.map((i) => ({ i, t0: t + ri(1400) * sp, dur: (1500 + ri(700)) * sp }));
		}
		const out = new Map<number, number>();
		for (const w of this.twinkles) {
			const p = (t - w.t0) / w.dur;
			if (p <= 0 || p >= 1) continue;
			const e = easeInOut(p);
			out.set(w.i, e < 0.5 ? 2 * e : 2 * (1 - e));
		}
		return out;
	}

	/** draw if it is time to; answers whether this band still needs frames */
	frame(t: number): boolean {
		const ctx = this.ctx;
		if (!ctx || !this.canvas.isConnected) return false;
		const mode = this.mode;
		const moving = !this.reduced && (mode === 'idle' || mode === 'chase' || mode === 'run' || mode === 'wait');
		const fps = mode === 'idle' ? SIGN.led.fps.idle : SIGN.led.fps.chase;
		if (!this.dirty && (!moving || t - this.last < 1000 / fps - 1)) return moving;
		const B = this.band;
		const N = B.leds.length;
		let level: (i: number) => number;
		if (mode === 'off') level = () => 0;
		else if (this.reduced) level = () => (mode === 'idle' ? 0 : Math.max(this.floor, 0.3));
		else if (mode === 'idle') {
			const tw = this.twinkle(t);
			level = (i) => tw.get(i) ?? 0;
		} else if (mode === 'wait') {
			const v = 0.35 + 0.45 * (0.5 - 0.5 * Math.cos((t / 1400) * Math.PI * 2));
			level = () => v;
		} else {
			const ph = t / this.lap;
			level = (i) => chaseAt((((ph + 1 - i / N) % 1) + 1) % 1, this.floor);
		}
		const levels = B.leds.map((_, i) => level(i));
		const any = levels.some((v) => v > 0.004);
		// nothing lit now and nothing lit on the last frame: nothing to draw (the twinkle's waits between rounds)
		if (any || this.lit || this.dirty) {
			const L = this.look();
			ctx.clearRect(B.view[0], B.view[1], B.view[2], B.view[3]);
			const rx = Math.max(B.chW, L.reach * B.step);
			const ry = Math.max(B.chW * 1.2, rx * 0.55);
			for (let i = 0; i < N; i++) {
				const v = levels[i];
				if (v <= 0.004) continue;
				const led = B.leds[i];
				ctx.save();
				ctx.translate(led.x, led.y);
				ctx.rotate(led.dir);
				ctx.globalAlpha = Math.min(1, v);
				ctx.drawImage(this.sprite(led.col, L), -rx, -ry, 2 * rx, 2 * ry);
				ctx.restore();
			}
			this.frames++;
		}
		this.lit = any;
		this.dirty = false;
		this.last = t;
		return moving;
	}
}
