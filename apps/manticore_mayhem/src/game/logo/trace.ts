// THE GROOVE TRACE (Corey 2026-11-17; constants LOGO.trace, the mock images/logo_tablet_r1_2026-11-16/
// logo_groove_trace_open_me.html and its NOTES.md): light runs along the Citadel Tablet's carved grooves, never on its
// lettering. It lives in LogoStill.trace (game/logo/still.ts), in the art's own px, over the picture.
//   style 1  IDLE: one spark runs the border circuit (the top meander run, down the right panel's inner side, the bottom
//            runs back, up the left panel's side) with a dimmer chaser behind; between legs it passes under the stone
//   style 2  SPECIAL EVENTS: the grooves fill from the two lions inward. It GROWS through the scatter tease and holds where
//            it is (tease()), is filled complete on the feature entry (event()), holds, then drains the same way; a tease
//            that fails drains back (release()). Brighter (and a little faster, a longer hold) for Super and Epic
//   style 3  THE BIG WIN COUNT: every groove breathes at a low ember glow in a slow wave out from the lions, with runners;
//            each win tier steps it up (win())
// One style hands over to the next without a pop: the spark dims while it runs on, the fill drains, the breath fades out,
// and the idle spark's next lap starts from the circuit's start after the style's pause.
// HOW IT IS DRAWN (house rules: no filters, shaders, masks or blob: URLs; nothing allocated per frame). Every groove point
// (46 paths, 7960 points about 3 art px apart) has a brightness, summed over the styles each frame into one Float32Array.
// The points are cut into chunks (LOGO.trace.chunkPoints): one Mesh each, two vertices per point offset along the path's
// normal by the glow's half width in CSS px (rewritten only when the logo's size changes). One 64 x 32 texture, built once
// from bytes (8 KB): u is the brightness (square root scale), v the glow's cross-section, the mock's three strokes (the
// ember glow, the mid stroke and the whiter core) summed and premultiplied with alpha 0 (light only). Each frame only u
// is rewritten, only in chunks that have light; a chunk with none is not drawn (no draw call).
// THE LIGHT PASS: the glow is 6.5 CSS px wide, wider than a meander key (about 3 CSS px on the desktop), so the strips
// fold over themselves at every turn of the meander and an additive strip would pile up into white specks (seen in the
// first captures). So the lit chunks are drawn with the MAX blend into one small render texture the size of the logo in
// device px (a union, as the mock's canvas strokes are), and that texture is drawn once, additively, over the picture.
// Nothing lit: no pass and no draw. The render texture is remade only when the logo's size changes.
import * as PIXI from 'pixi.js';

import { LOGO } from '../constants';
import { stagingTraceEvent, stagingTraceGain, stagingTraceIdle, stagingTraceLevels, stagingTraceTiers, stagingTraceWin } from '../staging';

export type TraceLevel = 'bonus' | 'super' | 'epic';
export type GrooveJson = { width: number; height: number; groups: { name: string; paths: { id: string; points: number[][] }[] }[] };

type Style = { speed: number; trail: number; brightness: number; pause: number };
const T = LOGO.trace;

/** the trace's numbers: the constants, with a staging build's or the dev server's URL switches on top (game/staging.ts) */
export const traceConfig = () => {
	const style = (base: Style, knob: (number | null)[] | null): Style => ({
		speed: knob?.[0] ?? base.speed,
		trail: knob?.[1] ?? base.trail,
		brightness: knob?.[2] ?? base.brightness,
		pause: knob?.[3] ?? base.pause,
	});
	const L = T.event.levels;
	const level = (k: TraceLevel, i: number) => ({ ...L[k], gain: stagingTraceLevels?.[i] ?? L[k].gain });
	return {
		passGain: stagingTraceGain ?? (T.passGain as number),
		idle: { ...T.idle, ...style(T.idle, stagingTraceIdle) },
		event: { ...T.event, ...style(T.event, stagingTraceEvent), levels: { bonus: level('bonus', 0), super: level('super', 1), epic: level('epic', 2) } as Record<TraceLevel, { gain: number; holdS: number; lead: number; speed: number; shimmer: number }> },
		bigWin: { ...T.bigWin, ...style(T.bigWin, stagingTraceWin), tierBrightness: T.bigWin.tiers.brightness.map((v, i) => stagingTraceTiers?.[i] ?? v) },
	};
};
export type TraceConfig = ReturnType<typeof traceConfig>;

/** the lions' heads and ring centres, art px (the mock's LIONS): the fill and the breath start there */
const LIONS = [
	[176, 300],
	[1722, 300],
] as const;
/** the border circuit (the mock's CIRCUIT_SPEC): [path id, reversed] */
const CIRCUIT: readonly (readonly [string, boolean])[] = [
	['meander_00', false],
	['lion_panels_09', true],
	['meander_08', true],
	['meander_07', true],
	['lion_panels_01', true],
];
/** the lettering field, art px (the mock's check box): no groove point lies in it */
export const LETTER_BOX = { x0: 300, y0: 115, x1: 1430, y1: 490 } as const;
const TEX_W = 64;
const TEX_H = 32;
const EPS = 0.003;
const RUNNERS = 16;

type Chunk = { mesh: PIXI.Mesh; map: Int32Array; pos: PIXI.Buffer; uv: PIXI.Buffer; lit: boolean };

let glowTex: PIXI.Texture | null = null;
/** the glow's u (brightness) x v (cross-section) texture, built once from bytes: premultiplied, alpha 0 (light only) */
const glowTexture = (): PIXI.Texture => {
	if (glowTex) return glowTex;
	const outer = Math.max(...T.layers.map((l) => l[1]));
	const half = outer / 2 + T.edgeCss;
	const aa = 0.6;
	const glow = [(T.color >> 16) & 255, (T.color >> 8) & 255, T.color & 255];
	const core = glow.map((c) => c + (255 - c) * T.coreMix);
	const data = new Uint8Array(TEX_W * TEX_H * 4);
	for (let j = 0; j < TEX_H; j += 1) {
		const d = Math.abs(((j + 0.5) / TEX_H) * 2 - 1) * half;
		for (let i = 0; i < TEX_W; i += 1) {
			const q = i / (TEX_W - 1);
			const I = T.maxBrightness * q * q;
			let r = 0;
			let g = 0;
			let b = 0;
			for (const [, w, al, isCore] of T.layers) {
				const cov = Math.min(1, Math.max(0, (w / 2 - d) / aa + 0.5));
				const a = Math.min(1, al * I) * cov;
				const c = isCore ? core : glow;
				r += c[0] * a;
				g += c[1] * a;
				b += c[2] * a;
			}
			const o = (j * TEX_W + i) * 4;
			data[o] = Math.min(255, Math.round(r));
			data[o + 1] = Math.min(255, Math.round(g));
			data[o + 2] = Math.min(255, Math.round(b));
			data[o + 3] = 0;
		}
	}
	const source = new PIXI.BufferImageSource({ resource: data, width: TEX_W, height: TEX_H, alphaMode: 'premultiplied-alpha', scaleMode: 'linear', addressMode: 'clamp-to-edge', label: 'logo-trace-glow' });
	glowTex = new PIXI.Texture({ source });
	return glowTex;
};
/** the glow's half width, CSS px (the widest layer's half and its soft edge) */
const HALF_CSS = Math.max(...T.layers.map((l) => l[1])) / 2 + T.edgeCss;

export class GrooveTrace {
	readonly root = new PIXI.Container();
	readonly cfg: TraceConfig;
	/** the lit chunks, drawn into `rt` (never on the stage itself) */
	private readonly light = new PIXI.Container();
	private rt: PIXI.RenderTexture | null = null;
	/** the light pass's result, drawn additively over the picture in art px */
	private readonly sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
	private readonly renderer: PIXI.Renderer | null;
	private readonly rtMatrix = new PIXI.Matrix();
	/** the light pass's render call, made once (nothing allocated per frame on our side) */
	private readonly passOptions: { container: PIXI.Container; target: PIXI.RenderTexture | null; clear: boolean; clearColor: number[]; transform: PIXI.Matrix } = { container: this.light, target: null, clear: true, clearColor: [0, 0, 0, 0], transform: this.rtMatrix };
	private rtScale = 0;
	private rtMargin = 0;
	/** the points, art px, every path one after the other */
	private readonly n: number;
	private readonly xs: Float32Array;
	private readonly ys: Float32Array;
	private readonly nx: Float32Array;
	private readonly ny: Float32Array;
	/** arc length along its own path */
	private readonly s: Float32Array;
	private readonly pathStart: Int32Array;
	private readonly pathN: Int32Array;
	private readonly pathLen: Float32Array;
	private readonly ids: string[] = [];
	/** this frame's brightness per point */
	private readonly I: Float32Array;
	private readonly chunks: Chunk[] = [];
	private halfArt = -1;

	// style 1: the circuit
	private readonly legPath: Int32Array;
	private readonly legRev: Uint8Array;
	private readonly legAt: Float32Array;
	private readonly routeLen: number;
	// style 2: the fill parts (long paths split at the tablet's middle), each filling from its end nearer a lion
	private readonly partOf: Int16Array;
	private readonly uPart: Float32Array;
	private readonly partSt: Float32Array;
	private readonly partLen: Float32Array;
	private readonly partD: Float32Array;
	private readonly partFilled: Float32Array;
	private readonly partDrained: Float32Array;
	private readonly tFull: number;
	// style 3: the breath's phase per point (its distance from the nearer lion), the runner paths and the runner pool
	private readonly breathPhase: Float32Array;
	private readonly runnerPaths: Int32Array;
	private readonly rPath = new Int32Array(RUNNERS).fill(-1);
	private readonly rRev = new Uint8Array(RUNNERS);
	private readonly rT0 = new Float32Array(RUNNERS);
	private readonly rSpeed = new Float32Array(RUNNERS);
	private readonly rFast = new Uint8Array(RUNNERS);

	/** the trace's own clock, s (advanced by the ticker's frames: it stands still while the tab is hidden) */
	private clock = 0;
	// style 1
	private idleW = 0;
	private idleTravel = 0;
	private idlePause = 0;
	// style 2
	fillPhase: 'off' | 'build' | 'fill' | 'hold' | 'drain' | 'rest' = 'off';
	private tv = 0;
	private target = 0;
	private td = 0;
	private holdLeft = 0;
	private restLeft = 0;
	private fillGain = 1;
	private fillGainTo = 1;
	private level: TraceLevel | null = null;
	// style 3
	private winTier = -1;
	private winW = 0;
	private winGain = 0;
	private nextRunner = 0;
	// DEV / probe
	readonly stats = { frames: 0, writes: 0, litChunks: 0, litPoints: 0, maxI: 0, sumI: 0, events: 0, teases: 0, releases: 0, laps: 0, bursts: 0 };

	constructor(data: GrooveJson, renderer: PIXI.Renderer | null, cfg: TraceConfig = traceConfig()) {
		this.cfg = cfg;
		this.renderer = renderer;
		this.root.label = 'logo-trace-light';
		this.root.eventMode = 'none';
		this.root.interactiveChildren = false;
		this.light.label = 'logo-trace-pass';
		this.sprite.label = 'logo-trace-sprite';
		this.sprite.blendMode = 'add';
		this.sprite.visible = false;
		this.root.addChild(this.sprite);
		const paths = data.groups.flatMap((g) => g.paths);
		const P = paths.length;
		this.pathStart = new Int32Array(P);
		this.pathN = new Int32Array(P);
		this.pathLen = new Float32Array(P);
		let n = 0;
		paths.forEach((p, i) => {
			this.pathStart[i] = n;
			this.pathN[i] = p.points.length;
			this.ids.push(p.id);
			n += p.points.length;
		});
		this.n = n;
		this.xs = new Float32Array(n);
		this.ys = new Float32Array(n);
		this.nx = new Float32Array(n);
		this.ny = new Float32Array(n);
		this.s = new Float32Array(n);
		this.I = new Float32Array(n);
		paths.forEach((p, i) => {
			const g0 = this.pathStart[i];
			p.points.forEach(([x, y], j) => {
				this.xs[g0 + j] = x;
				this.ys[g0 + j] = y;
				if (j > 0) this.s[g0 + j] = this.s[g0 + j - 1] + Math.hypot(x - p.points[j - 1][0], y - p.points[j - 1][1]);
			});
			this.pathLen[i] = this.s[g0 + p.points.length - 1];
			// normals: the mean of the two segments' directions (one at the ends; the previous one where the path doubles back)
			const m = p.points.length;
			for (let j = 0; j < m; j += 1) {
				const k = g0 + j;
				let ax = 0;
				let ay = 0;
				let bx = 0;
				let by = 0;
				if (j > 0) {
					const l = Math.hypot(this.xs[k] - this.xs[k - 1], this.ys[k] - this.ys[k - 1]) || 1;
					ax = (this.xs[k] - this.xs[k - 1]) / l;
					ay = (this.ys[k] - this.ys[k - 1]) / l;
				}
				if (j < m - 1) {
					const l = Math.hypot(this.xs[k + 1] - this.xs[k], this.ys[k + 1] - this.ys[k]) || 1;
					bx = (this.xs[k + 1] - this.xs[k]) / l;
					by = (this.ys[k + 1] - this.ys[k]) / l;
				}
				let tx = ax + bx;
				let ty = ay + by;
				let tl = Math.hypot(tx, ty);
				if (tl < 0.2) {
					tx = j > 0 ? ax : bx;
					ty = j > 0 ? ay : by;
					tl = Math.hypot(tx, ty) || 1;
				}
				this.nx[k] = -ty / tl;
				this.ny[k] = tx / tl;
			}
		});
		const byId = (id: string) => this.ids.indexOf(id);

		// ---- the chunks: whole paths, a long one split with its boundary point in both ----
		const tex = glowTexture();
		const CH = T.chunkPoints;
		let map: number[] = [];
		let segs: number[] = [];
		const close = () => {
			if (map.length < 2) return;
			const nv = map.length * 2;
			const positions = new Float32Array(nv * 2);
			const uvs = new Float32Array(nv * 2);
			for (let i = 0; i < map.length; i += 1) {
				uvs[i * 4 + 1] = 0;
				uvs[i * 4 + 3] = 1;
			}
			const indices = new Uint32Array(segs.length * 6);
			segs.forEach((i, q) => indices.set([2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2], q * 6));
			const geometry = new PIXI.MeshGeometry({ positions, uvs, indices });
			const mesh = new PIXI.Mesh({ geometry, texture: tex });
			mesh.label = `logo-trace-${this.chunks.length}`;
			// MAX inside the light pass: overlapping folds of the strip are a union, never a pile up
			mesh.blendMode = 'max';
			mesh.visible = false;
			this.light.addChild(mesh);
			this.chunks.push({ mesh, map: Int32Array.from(map), pos: geometry.getBuffer('aPosition'), uv: geometry.getBuffer('aUV'), lit: false });
			map = [];
			segs = [];
		};
		// the circuit's paths first, in its order AND its direction (a reversed leg's points listed backwards), so the idle
		// spark (about 700 points with its chaser) spans at most two chunks; then every other path as the map lists them
		const circuit = CIRCUIT.map(([id, rev]) => [byId(id), rev] as const).filter(([p]) => p >= 0);
		const order: (readonly [number, boolean])[] = [...circuit, ...paths.map((_, i) => [i, false] as const).filter(([i]) => !circuit.some(([c]) => c === i))];
		for (const [p, rev] of order) {
			const g0 = this.pathStart[p];
			const m = this.pathN[p];
			for (let q = 0; q < m; q += 1) {
				const j = rev ? m - 1 - q : q;
				const prev = rev ? g0 + j + 1 : g0 + j - 1;
				if (map.length >= CH) {
					close();
					if (q > 0) map.push(prev);
				}
				if (q > 0 && map.length > 0 && map[map.length - 1] === prev) segs.push(map.length - 1);
				map.push(g0 + j);
			}
		}
		close();

		// ---- style 1: the circuit's legs, with the hops between them (unseen) ----
		const legs = CIRCUIT.map(([id, rev]) => [byId(id), rev] as const).filter(([p]) => p >= 0);
		this.legPath = new Int32Array(legs.length);
		this.legRev = new Uint8Array(legs.length);
		this.legAt = new Float32Array(legs.length);
		let at = 0;
		let px = NaN;
		let py = NaN;
		const ends = (p: number, rev: boolean) => {
			const a = this.pathStart[p];
			const b = a + this.pathN[p] - 1;
			return rev ? [b, a] : [a, b];
		};
		legs.forEach(([p, rev], i) => {
			const [k0, k1] = ends(p, rev);
			if (i > 0) at += Math.hypot(this.xs[k0] - px, this.ys[k0] - py);
			this.legPath[i] = p;
			this.legRev[i] = rev ? 1 : 0;
			this.legAt[i] = at;
			at += this.pathLen[p];
			px = this.xs[k1];
			py = this.ys[k1];
		});
		this.routeLen = at;

		// ---- style 2: the fill parts ----
		const mid = data.width / 2;
		const nearLion = (k: number) => Math.min(...LIONS.map(([lx, ly]) => Math.hypot(this.xs[k] - lx, this.ys[k] - ly)));
		const parts: { p: number; a: number; b: number; fromA: boolean; d: number }[] = [];
		this.partOf = new Int16Array(n);
		this.uPart = new Float32Array(n);
		for (let p = 0; p < P; p += 1) {
			const g0 = this.pathStart[p];
			const m = this.pathN[p];
			let lo = Infinity;
			let hi = -Infinity;
			for (let k = g0; k < g0 + m; k += 1) {
				lo = Math.min(lo, this.xs[k]);
				hi = Math.max(hi, this.xs[k]);
			}
			let cuts = [g0, g0 + m - 1];
			if (this.pathLen[p] > 500 && lo < mid - 100 && hi > mid + 100) {
				let c = g0 + (m >> 1);
				for (let k = g0; k < g0 + m; k += 1)
					if (this.xs[g0] < mid === this.xs[k] >= mid) {
						c = k;
						break;
					}
				cuts = [g0, c, g0 + m - 1];
			}
			for (let q = 0; q < cuts.length - 1; q += 1) {
				const ka = cuts[q];
				const kb = cuts[q + 1];
				const fromA = nearLion(ka) <= nearLion(kb);
				const index = parts.length;
				parts.push({ p, a: this.s[ka], b: this.s[kb], fromA, d: Math.min(nearLion(ka), nearLion(kb)) });
				for (let k = ka; k <= kb; k += 1) {
					if (q > 0 && k === ka) continue;
					this.partOf[k] = index;
					this.uPart[k] = fromA ? this.s[k] - this.s[ka] : this.s[kb] - this.s[k];
				}
			}
		}
		const E = cfg.event;
		this.partSt = Float32Array.from(parts, (f) => f.d / (E.speed * E.wave));
		this.partLen = Float32Array.from(parts, (f) => f.b - f.a);
		this.partD = Float32Array.from(parts, (f) => f.d);
		this.partFilled = new Float32Array(parts.length);
		this.partDrained = new Float32Array(parts.length);
		let tFull = 0;
		for (let i = 0; i < parts.length; i += 1) tFull = Math.max(tFull, this.partSt[i] + this.partLen[i] / E.speed);
		this.tFull = tFull;

		// ---- style 3 ----
		const W = cfg.bigWin;
		this.breathPhase = new Float32Array(n);
		for (let k = 0; k < n; k += 1) this.breathPhase[k] = (2 * Math.PI * nearLion(k)) / W.breathWave;
		this.runnerPaths = Int32Array.from(
			paths.map((_, i) => i).filter((i) => this.pathLen[i] > W.runnerMinLen),
		);
	}

	// ---- the glow's width: the vertices, rewritten only when the logo's size changes ----

	/** the art's CSS px per art px (the content container's scale) */
	place(cssPerArt: number): void {
		const half = HALF_CSS / Math.max(cssPerArt, 1e-4);
		// the light pass's texture: the art plus the glow's margin, one texel per device px (at most 2048 wide)
		const res = this.renderer?.resolution ?? 1;
		const margin = Math.ceil(half + 2);
		const k = Math.min(cssPerArt * res, 2048 / (LOGO.art.width + 2 * margin));
		if (this.renderer && (Math.abs(k - this.rtScale) > 1e-4 || margin !== this.rtMargin)) {
			this.rtScale = k;
			this.rtMargin = margin;
			const w = Math.max(1, Math.ceil((LOGO.art.width + 2 * margin) * k));
			const h = Math.max(1, Math.ceil((LOGO.art.height + 2 * margin) * k));
			const old = this.rt;
			this.rt = PIXI.RenderTexture.create({ width: w, height: h, resolution: 1, antialias: false, label: 'logo-trace-pass' });
			this.sprite.texture = this.rt;
			this.sprite.scale.set(1 / k);
			this.sprite.position.set(-margin, -margin);
			this.rtMatrix.set(k, 0, 0, k, margin * k, margin * k);
			old?.destroy(true);
		}
		if (Math.abs(half - this.halfArt) < 0.01) return;
		this.halfArt = half;
		for (const c of this.chunks) {
			const pos = c.pos.data as Float32Array;
			for (let i = 0; i < c.map.length; i += 1) {
				const k = c.map[i];
				pos[i * 4] = this.xs[k] + this.nx[k] * half;
				pos[i * 4 + 1] = this.ys[k] + this.ny[k] * half;
				pos[i * 4 + 2] = this.xs[k] - this.nx[k] * half;
				pos[i * 4 + 3] = this.ys[k] - this.ny[k] * half;
			}
			c.pos.update();
		}
	}

	// ---- what the game asks for ----

	/** THE FEATURE ENTRY (and the one line any later moment calls): the fill completes from wherever it is, holds the level's
	 *  holdS, drains, and the idle spark comes back after the style's pause */
	event(level: TraceLevel = 'bonus'): void {
		this.level = level;
		const L = this.cfg.event.levels[level];
		this.fillGainTo = L.gain;
		if (this.fillPhase === 'off' || this.fillPhase === 'rest') this.tv = 0;
		this.td = 0;
		this.fillPhase = 'fill';
		this.target = this.tFull;
		this.stats.events += 1;
	}

	/** THE ANTICIPATION: the fill grows to this share of the full fill and holds there (it never goes back) */
	tease(share: number): void {
		if (this.fillPhase === 'fill' || this.fillPhase === 'hold' || this.fillPhase === 'drain') return;
		if (this.fillPhase !== 'build') {
			this.fillPhase = 'build';
			this.tv = 0;
			this.target = 0;
			this.level = null;
			this.fillGain = this.fillGainTo = 1;
			this.stats.teases += 1;
		}
		this.target = Math.max(this.target, Math.min(1, share) * this.tFull);
	}

	/** the anticipation failed: a partial fill drains back (a feature entry's fill is never cut short) */
	release(): void {
		if (this.fillPhase !== 'build') return;
		this.fillPhase = 'drain';
		this.td = 0;
		this.stats.releases += 1;
	}

	/** THE BIG WIN COUNT: the win screen's tier (0 BIG .. 4 MAX) while it counts, -1 when there is none */
	win(tier: number): void {
		const W = this.cfg.bigWin;
		if (tier > this.winTier && tier >= 0) {
			// each tier's landing bursts that tier's runners (the first tier opens with none)
			const burst = W.tiers.burst[Math.min(tier, W.tiers.burst.length - 1)] ?? 0;
			for (let i = 0; i < burst; i += 1) this.spawn(true, tier);
			if (burst) this.stats.bursts += 1;
			if (this.winTier < 0) this.nextRunner = this.clock + 0.4;
		}
		this.winTier = tier;
	}

	/** drop everything to a fresh idle (the logo was hidden: nothing that happened meanwhile is replayed) */
	reset(): void {
		this.fillPhase = 'off';
		this.tv = this.td = this.target = 0;
		this.level = null;
		this.winTier = -1;
		this.winW = 0;
		this.winGain = 0;
		this.idleW = 0;
		this.idleTravel = 0;
		this.idlePause = 0;
		this.rPath.fill(-1);
		this.I.fill(0);
		for (let ci = 0; ci < this.chunks.length; ci += 1) {
			this.chunks[ci].lit = false;
			this.chunks[ci].mesh.visible = false;
		}
		this.sprite.visible = false;
	}

	// ---- the frame ----

	tick(dtMs: number): void {
		const dt = Math.min(dtMs, 100) / 1000;
		this.clock += dt;
		const I = this.I;
		I.fill(0);
		const fade = dt / (T.fadeMs / 1000);
		const fillOn = this.fillPhase !== 'off' && this.fillPhase !== 'rest';
		const winOn = this.winTier >= 0;
		// style 1 wants the stage to itself: after a fill's drain and its pause, after the breath has faded out
		const idleWant = this.fillPhase === 'off' && !winOn && this.winW === 0;
		this.idleW = idleWant ? Math.min(1, this.idleW + fade) : Math.max(0, this.idleW - fade);
		if (this.idleW > 0 || idleWant) this.stepIdle(dt);
		else {
			// faded out: the next lap starts from the circuit's start
			this.idleTravel = 0;
			this.idlePause = 0;
		}
		if (fillOn || this.fillPhase === 'rest') this.stepFill(dt);
		const W = this.cfg.bigWin;
		this.winW = winOn ? Math.min(1, this.winW + fade) : Math.max(0, this.winW - dt / (W.outMs / 1000));
		if (this.winW > 0) this.stepWin(dt);
		else this.rPath.fill(-1);
		this.write();
	}

	private stepIdle(dt: number): void {
		const S = this.cfg.idle;
		if (this.idlePause > 0) {
			this.idlePause -= dt;
			if (this.idlePause > 0) return;
			this.idleTravel = 0;
		}
		this.idleTravel += S.speed * dt;
		const lag = Math.max(S.chaserMinLag, S.trail * S.chaserLag);
		const chTrail = S.trail * S.chaserTrail;
		if (this.idleTravel > Math.max(this.routeLen + S.trail, this.routeLen + lag + chTrail)) {
			this.idlePause = S.pause;
			this.stats.laps += 1;
			return;
		}
		const g = S.brightness * this.idleW;
		this.spark(this.idleTravel, S.trail, g);
		this.spark(this.idleTravel - lag, chTrail, g * S.chaserGain);
	}

	/** one spark: its head at route position h, lit back over `trail`; past the circuit's end it slides out */
	private spark(h: number, trail: number, gain: number): void {
		if (h <= 0 || gain <= EPS) return;
		const S = this.cfg.idle;
		const pw = +S.trailPow;
		const headPx = +S.headPx;
		const boost = +S.headBoost;
		const sArr = this.s;
		const I = this.I;
		const lo = h - trail;
		for (let l = 0; l < this.legPath.length; l += 1) {
			const p = this.legPath[l];
			const at = this.legAt[l];
			const len = this.pathLen[p];
			if (h < at || lo > at + len) continue;
			const rev = this.legRev[l] === 1;
			// the path's own arc range lit
			const sa = rev ? len - (h - at) : lo - at;
			const sb = rev ? len - (lo - at) : h - at;
			const g0 = this.pathStart[p];
			const k0 = this.indexAt(p, sa);
			const k1 = Math.min(g0 + this.pathN[p] - 1, this.indexAt(p, sb) + 1);
			// (locals only in this loop: it is the idle's hot loop)
			const base = rev ? at + len : at;
			const sign = rev ? -1 : 1;
			for (let k = k0; k <= k1; k += 1) {
				const back = h - (base + sign * sArr[k]);
				if (back < 0 || back > trail) continue;
				const q = 1 - back / trail;
				I[k] += Math.pow(q, pw) * (back < headPx ? boost : 1) * gain;
			}
		}
	}

	/** the index of the point at or before arc length s on path p */
	private indexAt(p: number, s: number): number {
		const g0 = this.pathStart[p];
		let lo = 0;
		let hi = this.pathN[p] - 1;
		if (s <= 0) return g0;
		while (hi - lo > 1) {
			const m = (lo + hi) >> 1;
			if (this.s[g0 + m] <= s) lo = m;
			else hi = m;
		}
		return g0 + lo;
	}

	private stepFill(dt: number): void {
		const E = this.cfg.event;
		const L = this.level ? E.levels[this.level] : E.levels.bonus;
		const k = L.speed;
		// the level's brightness is reached over the hand-over time (a tease that becomes a Super entry brightens, no pop)
		const gs = dt / (T.fadeMs / 1000);
		this.fillGain = this.fillGain < this.fillGainTo ? Math.min(this.fillGainTo, this.fillGain + gs) : Math.max(this.fillGainTo, this.fillGain - gs);
		let holding = false;
		switch (this.fillPhase) {
			case 'build':
				this.tv = Math.min(this.target, this.tv + dt * k);
				holding = this.tv >= this.target;
				break;
			case 'fill':
				this.tv = Math.min(this.tFull, this.tv + dt * k);
				if (this.tv >= this.tFull) {
					this.fillPhase = 'hold';
					this.holdLeft = L.holdS;
				}
				break;
			case 'hold':
				holding = true;
				this.holdLeft -= dt;
				if (this.holdLeft <= 0) {
					this.fillPhase = 'drain';
					this.td = 0;
				}
				break;
			case 'drain':
				this.td += dt * k;
				break;
			case 'rest':
				this.restLeft -= dt;
				if (this.restLeft <= 0) this.fillPhase = 'off';
				return;
		}
		const sp = E.speed;
		const front = Math.max(E.trail, 1);
		const draining = this.fillPhase === 'drain';
		let any = false;
		for (let i = 0; i < this.partSt.length; i += 1) {
			const st = this.partSt[i];
			const len = this.partLen[i];
			this.partFilled[i] = Math.max(0, Math.min(len, (this.tv - st) * sp));
			this.partDrained[i] = draining ? Math.max(0, Math.min(len, (this.td - st) * sp)) : 0;
			if (this.partFilled[i] > this.partDrained[i]) any = true;
		}
		if (draining && !any) {
			this.fillPhase = 'rest';
			this.restLeft = E.pause;
			this.tv = this.td = this.target = 0;
			this.level = null;
			this.fillGainTo = 1;
			return;
		}
		const gain = E.brightness * this.fillGain;
		const lead = this.level ? L.lead : E.lead;
		const shAmp = this.level ? L.shimmer : E.shimmer;
		for (let p = 0; p < this.n; p += 1) {
			const i = this.partOf[p];
			const u = this.uPart[p];
			const filled = this.partFilled[i];
			const drained = this.partDrained[i];
			if (u > filled || u < drained || filled <= drained) continue;
			const ld = filled < this.partLen[i] ? Math.max(0, 1 - (filled - u) / front) : 0;
			const tail = drained > 0 ? Math.min(1, (u - drained) / front) : 1;
			const sh = holding ? 1 - shAmp + shAmp * Math.sin(this.clock * 5 + this.partD[i] * 0.05) : 1;
			this.I[p] += (E.base + lead * ld) * tail * sh * gain;
		}
	}

	private spawn(fast: boolean, tier: number): void {
		const W = this.cfg.bigWin;
		let slot = -1;
		for (let i = 0; i < RUNNERS; i += 1)
			if (this.rPath[i] < 0) {
				slot = i;
				break;
			}
		if (slot < 0 || !this.runnerPaths.length) return;
		const t = Math.max(0, Math.min(W.tiers.speed.length - 1, tier));
		this.rPath[slot] = this.runnerPaths[Math.floor(Math.random() * this.runnerPaths.length)];
		this.rRev[slot] = Math.random() < 0.5 ? 1 : 0;
		this.rT0[slot] = this.clock;
		this.rFast[slot] = fast ? 1 : 0;
		this.rSpeed[slot] = W.speed * W.tiers.speed[t] * (fast ? W.burstSpeed : 1);
	}

	private stepWin(dt: number): void {
		const W = this.cfg.bigWin;
		const tier = Math.max(0, Math.min(W.tierBrightness.length - 1, this.winTier));
		const want = this.winTier >= 0 ? W.brightness * W.tierBrightness[tier] : this.winGain;
		const step = (dt / (W.stepMs / 1000)) * W.brightness;
		this.winGain = this.winGain < want ? Math.min(want, this.winGain + step) : Math.max(want, this.winGain - step);
		const g = this.winGain * this.winW;
		// the breath: every groove, a slow wave out from the lions
		const w = (2 * Math.PI * this.clock) / W.breathS;
		for (let k = 0; k < this.n; k += 1) {
			const b = 0.5 + 0.5 * Math.sin(w - this.breathPhase[k]);
			this.I[k] += (W.breathBase + W.breathAmp * b * b) * g;
		}
		// the runners: one every pause x the tier's gap (0.6 to 1.4 of it) while the win counts
		if (this.winTier >= 0 && this.clock >= this.nextRunner) {
			this.spawn(false, tier);
			this.nextRunner = this.clock + W.pause * W.tiers.gap[tier] * (0.6 + 0.8 * Math.random());
		}
		const tr = W.trail;
		for (let r = 0; r < RUNNERS; r += 1) {
			const p = this.rPath[r];
			if (p < 0) continue;
			const len = this.pathLen[p];
			const h = (this.clock - this.rT0[r]) * this.rSpeed[r];
			if (h > len + tr) {
				this.rPath[r] = -1;
				continue;
			}
			const rev = this.rRev[r] === 1;
			const gain = g * (this.rFast[r] ? W.burstGain : W.runnerGain);
			const sa = rev ? len - h : h - tr;
			const sb = rev ? len - h + tr : h;
			const g0 = this.pathStart[p];
			const k0 = this.indexAt(p, sa);
			const k1 = Math.min(g0 + this.pathN[p] - 1, this.indexAt(p, sb) + 1);
			for (let k = k0; k <= k1; k += 1) {
				const u = rev ? len - this.s[k] : this.s[k];
				const back = h - u;
				if (back < 0 || back > tr) continue;
				const q = 1 - back / tr;
				this.I[k] += Math.pow(q, 1.5) * (back < 10 ? 1.5 : 1) * gain;
			}
		}
	}

	/** u for every point of every chunk that has light; a chunk with none is hidden (no draw call) */
	private write(): void {
		const I = this.I;
		const inv = this.cfg.passGain / T.maxBrightness;
		let lit = 0;
		let litPoints = 0;
		let maxI = 0;
		let sumI = 0;
		const chunks = this.chunks;
		for (let ci = 0; ci < chunks.length; ci += 1) {
			const c = chunks[ci];
			const map = c.map;
			let m = 0;
			for (let i = 0; i < map.length; i += 1) if (I[map[i]] > m) m = I[map[i]];
			if (m <= EPS) {
				if (c.lit) {
					c.lit = false;
					c.mesh.visible = false;
				}
				continue;
			}
			const uv = c.uv.data as Float32Array;
			for (let i = 0; i < map.length; i += 1) {
				const v = I[map[i]];
				const q = v <= 0 ? 0 : Math.sqrt(Math.min(1, v * inv));
				const u = (0.5 + q * (TEX_W - 1)) / TEX_W;
				uv[i * 4] = u;
				uv[i * 4 + 2] = u;
				if (v > EPS) litPoints += 1;
				sumI += v;
			}
			c.uv.update();
			if (!c.lit) {
				c.lit = true;
				c.mesh.visible = true;
			}
			lit += 1;
			if (m > maxI) maxI = m;
			this.stats.writes += 1;
		}
		// the light pass: the lit chunks into the render texture (MAX), drawn once over the picture; nothing lit, nothing drawn
		if (lit > 0 && this.renderer && this.rt) {
			this.passOptions.target = this.rt;
			this.renderer.render(this.passOptions as PIXI.RenderOptions);
			this.sprite.visible = true;
		} else this.sprite.visible = false;
		const st = this.stats;
		st.frames += 1;
		st.litChunks = lit;
		st.litPoints = litPoints;
		st.maxI = maxI;
		st.sumI = sumI;
	}

	// ---- DEV / probe ----

	/** where each style stands (tools/manticore/logo_probe.js) */
	state() {
		const S = this.cfg.idle;
		return {
			points: this.n,
			paths: this.pathN.length,
			chunks: this.chunks.length,
			routeLen: Math.round(this.routeLen),
			tFull: Number(this.tFull.toFixed(3)),
			halfArt: Number(this.halfArt.toFixed(2)),
			clock: Number(this.clock.toFixed(3)),
			idle: { w: Number(this.idleW.toFixed(3)), travel: Math.round(this.idleTravel), pause: Number(Math.max(0, this.idlePause).toFixed(2)), speed: S.speed, trail: S.trail, brightness: S.brightness, pausePerLap: S.pause },
			fill: {
				phase: this.fillPhase,
				level: this.level,
				share: Number((this.tv / this.tFull).toFixed(3)),
				target: Number((this.target / this.tFull).toFixed(3)),
				drain: Number((this.td / this.tFull).toFixed(3)),
				gain: Number((this.cfg.event.brightness * this.fillGain).toFixed(3)),
				speed: this.cfg.event.speed,
				trail: this.cfg.event.trail,
				brightness: this.cfg.event.brightness,
				pause: this.cfg.event.pause,
			},
			win: { tier: this.winTier, w: Number(this.winW.toFixed(3)), gain: Number(this.winGain.toFixed(3)), runners: Array.from(this.rPath).filter((p) => p >= 0).length, speed: this.cfg.bigWin.speed, trail: this.cfg.bigWin.trail, brightness: this.cfg.bigWin.brightness, pause: this.cfg.bigWin.pause, tierBrightness: this.cfg.bigWin.tierBrightness },
			stats: { ...this.stats, maxI: Number(this.stats.maxI.toFixed(3)), sumI: Math.round(this.stats.sumI) },
			/** groove points inside the lettering field (none by construction: the light is only where the points are) */
			lettering: (() => {
				let inBox = 0;
				for (let k = 0; k < this.n; k += 1) if (this.xs[k] > LETTER_BOX.x0 && this.xs[k] < LETTER_BOX.x1 && this.ys[k] > LETTER_BOX.y0 && this.ys[k] < LETTER_BOX.y1) inBox += 1;
				return inBox;
			})(),
			/** GPU: the glow texture's bytes, the light pass's render texture, and every chunk's vertex, uv and index buffers */
			gpuBytes: TEX_W * TEX_H * 4 + (this.rt ? this.rt.source.pixelWidth * this.rt.source.pixelHeight * 4 : 0) + this.chunks.reduce((a, c) => a + (c.pos.data as Float32Array).byteLength * 2 + (c.mesh.geometry.indices as Uint32Array).byteLength, 0),
			rt: this.rt ? [this.rt.source.pixelWidth, this.rt.source.pixelHeight] : null,
			drawn: this.sprite.visible,
		};
	}

	/** the brightness of every point of one path right now (probe: where the fill stands) */
	litAlong(id: string): number[] {
		const p = this.ids.indexOf(id);
		if (p < 0) return [];
		return Array.from(this.I.subarray(this.pathStart[p], this.pathStart[p] + this.pathN[p]));
	}

	destroy(): void {
		this.light.destroy({ children: true });
		this.rt?.destroy(true);
		this.rt = null;
		this.root.destroy({ children: true });
	}
}

// ---- THE ONE LINE HOOK ------------------------------------------------------------------------------------------------
// `logoTrace.event(level)` from anywhere in the game plays style 2 once: the fill completes, holds, drains, and the idle
// spark comes back. Today only the feature entry calls it (bookEventHandlerMap bonusStart); the tease's growth is read by
// the logo itself (components/Logo.svelte). Nothing happens when the logo is not drawn (hidden, reduced motion, `?trace=0`).
let sink: ((level: TraceLevel) => void) | null = null;
export const logoTrace = {
	event(level: TraceLevel = 'bonus'): void {
		sink?.(level);
	},
};
/** components/Logo.svelte: where logoTrace.event goes (null on unmount) */
export const attachLogoTrace = (fn: ((level: TraceLevel) => void) | null) => {
	sink = fn;
};
