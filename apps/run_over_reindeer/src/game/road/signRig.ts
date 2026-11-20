// THE SIGN RIG (Corey 2026-11-19; constants SIGN_WIN, game/signRigSpec.ts cut by tools/sign_layers.py): one road sign (L1..L5:
// A K Q J 10) drawn as its layers, so its parts can move on their own in a win, a landing and the idle.
//
// One per road slot that shows a sign, made the first time it does and kept with it (the riders' rule). Its ROOT is a plain
// container in the sign's lane just after the sign's sprite (which stays, invisible: its texture is the flattened frame the
// cast shadow and the probes read), and the road gives it the sprite's place, scale (the built size with the win pulse),
// tint (the tunnel shade, the win dim) and visibility every frame. In the root, in road px from the sign's anchor at its
// built size: the post, then the PLATE (a container turning on the plate's pivot) holding the plate picture, the reflectors
// drawn in normal blend, the snow cap and the decorations (each turning on its own pivot), then the flakes. Its FX is a
// container in the road's added layer (over every lane, game/road/roadBoard.ts signFxLayer: one draw call for every sign's
// light) given the plate's own transform: the reflectors' glows, the 10's border light, the bolts' glints, the two star
// flashes and the Q's bulb flares, all added.
//
// THE MOTION is the mock's own (sign_wins_r1_2026-11-19 index.html poseOf, alivePose, glintAt, drawDots, drawSparkles,
// landPose), its numbers in SIGN_WIN; the times are the callers': a win on the win clock at the turbo level's pace, the
// landing on the board clock, the idle at real ms. Nothing is allocated per frame: the sprites are pooled per slot (grown
// once to the largest sign it has shown), the pose and the flakes live in fixed arrays.
import * as PIXI from 'pixi.js';

import { SIGN_WIN, type TenStyle } from '../constants';
import { SIGN_RIG } from '../signRigSpec';

export type SignCode = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
export const SIGN_CODES: readonly string[] = ['L1', 'L2', 'L3', 'L4', 'L5'];
export const isSign = (symbol: string | null): symbol is SignCode => symbol !== null && SIGN_CODES.includes(symbol);

type Pt = readonly [number, number];
type Box = readonly [number, number, number, number];
type Dots = { r: number; pts: readonly Pt[] };
type SignSpec = {
	name: string;
	size: readonly [number, number];
	layers: readonly string[];
	pivots: Record<string, Pt>;
	dots: Record<string, Dots>;
	deco: readonly string[];
	centres: Record<string, Pt>;
	decoColor: Record<string, readonly [number, number, number]>;
	bolts: readonly Pt[];
	face: readonly [number, number, number];
	snowEdge: readonly Pt[];
	frames: Record<'full' | 'phone', Record<string, Box>>;
};
const SPECS = SIGN_RIG.signs as unknown as Record<SignCode, SignSpec>;
export const signSpec = (code: SignCode): SignSpec => SPECS[code];

export type TextureLookup = (frame: string) => PIXI.Texture | undefined;

const DEG = Math.PI / 180;
const decay = (u: number, tau: number) => Math.exp(-Math.max(0, u) / tau);
const osc = (u: number, hz: number, ph = 0) => Math.sin((2 * Math.PI * hz * u) / 1000 + ph);
const bump = (x: number) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));
const rock = (u: number, amp: number, hz: number, tau: number) => (u < 0 ? 0 : amp * decay(u, tau) * osc(u, hz));
const rgb = (c: readonly number[]) => (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2]);
const mix = (a: readonly number[], b: readonly number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
/** the mock's seeded random (its rnd): the same stream for the same sign in the same column */
const seeded = (seed: number) => {
	let s = seed * 9301 + 49297;
	return () => (s = (s * 9301 + 49297) % 233280) / 233280;
};

/** the reflectors' look for one sign (SIGN_WIN.glint and, for the 10, SIGN_WIN.ten) */
type Look = { dots: Dots; restBaked: boolean; style: TenStyle };

/** what the road gives the rig each frame: its sprite and what the car is doing */
export type SignInput = {
	sprite: PIXI.Sprite;
	/** road px per built road px (the symbol scale and the win pulse) */
	k: number;
	phase: 'free' | 'rest' | 'out' | 'in' | 'through';
	dir: 1 | -1;
	shown: boolean;
};

const MAX_GLINTS = 4;
const MAX_FLAKES = SIGN_WIN.flakes.max;
const MAX_DECO = 4;

export class SignRig {
	readonly root = new PIXI.Container();
	/** the added light (game/road/roadBoard.ts signFxLayer) */
	readonly fx = new PIXI.Container();
	code: SignCode | null = null;
	private spec: SignSpec | null = null;
	private look: Look | null = null;
	private readonly post = new PIXI.Sprite();
	private readonly plateC = new PIXI.Container();
	private readonly plate = new PIXI.Sprite();
	private readonly dotsC = new PIXI.Container();
	private readonly snowC = new PIXI.Container();
	private readonly snow = new PIXI.Sprite();
	private readonly decoC: PIXI.Container[] = [];
	private readonly decoS: PIXI.Sprite[] = [];
	private readonly flakesC = new PIXI.Container();
	// the reflectors (normal blend, in the plate): at rest (the 10 only), the shadow, the halo, the lens
	private readonly rests: PIXI.Sprite[] = [];
	private readonly shadows: PIXI.Sprite[] = [];
	private readonly halos: PIXI.Sprite[] = [];
	private readonly lenses: PIXI.Sprite[] = [];
	// the added light (in fx): each reflector's glow, the 10's border points, the bolts, the stars, the bulbs
	private readonly glows: PIXI.Sprite[] = [];
	private readonly bands: PIXI.Sprite[] = [];
	private readonly boltGlows: PIXI.Sprite[] = [];
	private readonly boltStars: PIXI.Sprite[] = [];
	private readonly stars: PIXI.Sprite[] = [];
	private readonly bulbC: PIXI.Container[] = [];
	private readonly bulbFlares: PIXI.Sprite[] = [];
	private readonly bulbGlows: PIXI.Sprite[] = [];
	private readonly flakeS: PIXI.Sprite[] = [];
	private built = false;
	/** a picture is missing (the rig cannot draw this sign): the road draws the flattened sprite */
	ok = false;

	// ---- the shows' state ----
	/** THE WIN: started on the win clock at t0 (ms), at `pace` (the turbo level's share) */
	private winT0 = 0;
	private winPace = 1;
	private winOn = false;
	private winShed = false;
	/** THE IDLE: started at real ms */
	private idleT0 = 0;
	private idleOn = false;
	/** THE LANDING: the board clock when the sign stopped */
	private landAt = 0;
	private landOn = false;
	private landShed = false;
	private landDir: 1 | -1 = 1;

	// ---- per sign, set with its symbol and column ----
	private jitter = 1;
	private rr: () => number = Math.random;
	private dotRand = new Float32Array(64);
	private bandRand = new Float32Array(64);
	private sparkPick = [0, 0];
	private sparkCount = 0;
	private bandLo = 0;
	private bandHi = 0;
	private lensSize = 0;
	private dotR = 0;
	private colLit = 0xffffff;
	private colGlow = 0xffffff;
	private decoKind: ('holly' | 'cane' | 'bell' | 'mistletoe' | 'bulb')[] = [];

	// ---- the pose (reused every frame) ----
	private rootRot = 0;
	private plateRot = 0;
	private plateDx = 0;
	private snowRot = 0;
	private snowSy = 1;
	private readonly decoRot = new Float64Array(MAX_DECO);
	private readonly bulbLit = new Float64Array(MAX_DECO);
	private readonly gPos = new Float64Array(MAX_GLINTS);
	private readonly gW = new Float64Array(MAX_GLINTS);
	private readonly gAmp = new Float64Array(MAX_GLINTS);
	private nG = 0;

	// ---- the flakes (in the sign's own frame) ----
	private readonly fx0 = new Float64Array(MAX_FLAKES);
	private readonly fy = new Float64Array(MAX_FLAKES);
	private readonly fvx = new Float64Array(MAX_FLAKES);
	private readonly fvy = new Float64Array(MAX_FLAKES);
	private readonly fr = new Float64Array(MAX_FLAKES);
	private readonly frot = new Float64Array(MAX_FLAKES);
	private readonly fvr = new Float64Array(MAX_FLAKES);
	private readonly ft = new Float64Array(MAX_FLAKES);
	private readonly flife = new Float64Array(MAX_FLAKES);
	private nFlakes = 0;

	constructor(
		private readonly tex: TextureLookup,
		private readonly tier: 'full' | 'phone',
	) {
		this.root.label = 'signRig';
		this.fx.label = 'signFx';
		this.plateC.addChild(this.plate, this.dotsC, this.snowC);
		this.snowC.addChild(this.snow);
		this.root.addChild(this.post, this.plateC, this.flakesC);
		this.root.visible = false;
		this.fx.visible = false;
	}

	/** the slot shows this sign now (its pictures, pivots and reflectors; every show stops) */
	setSymbol(code: SignCode): boolean {
		this.stop();
		if (this.code === code && this.built) return this.ok;
		this.code = code;
		const spec = (this.spec = SPECS[code]);
		const boxes = spec.frames[this.tier];
		const place = (s: PIXI.Sprite, layer: string): boolean => {
			const t = this.tex(`${code}_${layer}`);
			const b = boxes[layer];
			if (!t || !b) return false;
			s.texture = t;
			s.position.set(b[0], b[1]);
			s.width = b[2];
			s.height = b[3];
			return true;
		};
		let ok = place(this.post, 'post') && place(this.plate, 'plate') && place(this.snow, 'snow');
		const pp = spec.pivots.plate;
		this.plateC.pivot.set(pp[0], pp[1]);
		const sp = spec.pivots.snow;
		this.snowC.pivot.set(sp[0], sp[1]);
		this.snowC.position.set(sp[0], sp[1]);
		// the decorations, each in its container on its own pivot (the bulbs' flares likewise in fx)
		this.decoKind = [];
		spec.deco.forEach((name, i) => {
			let c = this.decoC[i];
			if (!c) {
				c = this.decoC[i] = new PIXI.Container();
				const s = (this.decoS[i] = new PIXI.Sprite());
				c.addChild(s);
				this.plateC.addChild(c);
			}
			c.visible = true;
			const pv = spec.pivots[name];
			c.pivot.set(pv[0], pv[1]);
			c.position.set(pv[0], pv[1]);
			ok = place(this.decoS[i], name) && ok;
			this.decoKind.push(name.startsWith('bulb') ? 'bulb' : (name as 'holly' | 'cane' | 'bell' | 'mistletoe'));
		});
		for (let i = spec.deco.length; i < this.decoC.length; i++) this.decoC[i].visible = false;
		this.ok = ok;
		this.built = true;
		this.setLook();
		return ok;
	}

	/** the reflectors' look: the layout's points and the colors (SIGN_WIN.glint; the 10 its own, SIGN_WIN.ten) */
	private setLook() {
		const spec = this.spec!;
		const G = SIGN_WIN.glint;
		const white = this.code === 'L5';
		let style: TenStyle;
		let dots: Dots;
		if (white && SIGN_WIN.ten !== 'off') {
			style = SIGN_WIN.tenStyles[SIGN_WIN.ten];
			dots = spec.dots[style.layout] ?? spec.dots.field;
		} else {
			dots = spec.dots[G.layout] ?? spec.dots.field;
			const f = spec.face;
			// the mock's dotColors: the face's own tints, or white, or ice blue (the 10 always ice in its tuned look)
			let lit: number[], glow: number[], rest: number[];
			if (G.color === 'white') {
				lit = WHITE;
				glow = [255, 252, 238];
				rest = white ? [196, 204, 214] : mix(f, BLACK, G.restDarken);
			} else if (G.color === 'ice' || white) {
				lit = white ? [128, 196, 255] : [196, 232, 255];
				glow = [150, 210, 255];
				rest = white ? [196, 206, 220] : mix(f, BLACK, G.restDarken);
			} else {
				lit = mix(f, WHITE, G.litMix);
				glow = mix(f, WHITE, G.glowMix);
				rest = mix(f, BLACK, G.restDarken);
			}
			style = { layout: 'field', rest: { tex: 'lens', tint: rgb(rest), alpha: -1 }, lit: rgb(lit), halo: null, shadow: null, glow: rgb(glow), band: null };
		}
		// the four colored signs' rest reflectors are baked into their plates (tools/sign_layers.py REST_BAKE)
		this.look = { dots, restBaked: !white, style };
		this.colLit = style.lit;
		this.colGlow = style.glow ?? 0xffffff;
		this.dotR = dots.r * G.size;
		this.lensSize = (2 * this.dotR) / 0.62;
		// the band's run along the sweep: from the reflectors' and the bolts' own extent
		let lo = Infinity;
		let hi = -Infinity;
		const [sx, sy] = G.sweepDir;
		for (const [x, y] of dots.pts) {
			const p = x * sx + y * sy;
			lo = Math.min(lo, p);
			hi = Math.max(hi, p);
		}
		for (const [x, y] of spec.bolts) {
			const p = x * sx + y * sy;
			lo = Math.min(lo, p);
			hi = Math.max(hi, p);
		}
		this.bandLo = lo;
		this.bandHi = hi;
		// the two star flashes: the reflectors farthest down right and up left (the mock's sparklePicks)
		const pts = dots.pts;
		let a = 0;
		let b = 0;
		pts.forEach(([x, y], i) => {
			if (x - y > pts[a][0] - pts[a][1]) a = i;
			if (-x + 0.3 * y > -pts[b][0] + 0.3 * pts[b][1]) b = i;
		});
		this.sparkPick[0] = a;
		this.sparkPick[1] = b;
		this.sparkCount = pts.length ? (a === b ? 1 : 2) : 0;
		this.buildDots();
	}

	/** the reflector sprites for this look: pooled, placed once (their alpha and size move per frame) */
	private buildDots() {
		const look = this.look!;
		const st = look.style;
		const n = look.dots.pts.length;
		const lensTex = this.tex('sign_lens') ?? PIXI.Texture.EMPTY;
		const glowTex = this.tex('sign_glow') ?? PIXI.Texture.EMPTY;
		const grow = (list: PIXI.Sprite[], count: number, parent: PIXI.Container, texture: PIXI.Texture, add: boolean) => {
			while (list.length < count) {
				const s = new PIXI.Sprite(texture);
				s.anchor.set(0.5);
				if (add) s.blendMode = 'add';
				parent.addChild(s);
				list.push(s);
			}
			list.forEach((s, i) => {
				s.texture = texture;
				s.visible = false;
				if (i >= count) s.alpha = 0;
			});
		};
		// the order in the plate (all normal blend): at rest, shadow, halo, lens; the reflectors under the snow and decorations
		const restTex = st.rest?.tex === 'ring' ? (this.tex('sign_ring') ?? lensTex) : lensTex;
		const restOn = !look.restBaked && !!st.rest;
		grow(this.rests, restOn ? n : 0, this.dotsC, restTex, false);
		grow(this.shadows, st.shadow ? n : 0, this.dotsC, lensTex, false);
		grow(this.halos, st.halo ? n : 0, this.dotsC, glowTex, false);
		grow(this.lenses, n, this.dotsC, lensTex, false);
		grow(this.glows, st.glow !== null ? n : 0, this.fx, glowTex, true);
		const band = st.band ? (this.spec!.dots.band?.pts ?? []) : [];
		grow(this.bands, band.length, this.fx, glowTex, true);
		// keep the plate's children in their order (a pool grown later lands at the end)
		for (const list of [this.rests, this.shadows, this.halos, this.lenses]) for (const s of list) this.dotsC.addChild(s);
		const ls = this.lensSize;
		look.dots.pts.forEach(([x, y], i) => {
			for (const list of [this.rests, this.shadows, this.lenses]) {
				const s = list[i];
				if (!s) continue;
				s.position.set(x, y);
				s.width = ls;
				s.height = ls;
			}
			if (this.halos[i]) this.halos[i].position.set(x, y);
			if (this.glows[i]) this.glows[i].position.set(x, y);
		});
		if (restOn && st.rest) {
			const alpha = st.rest.alpha < 0 ? SIGN_WIN.glint.rest : st.rest.alpha;
			for (let i = 0; i < n; i++) {
				const s = this.rests[i];
				s.tint = st.rest.tint;
				s.alpha = alpha;
				s.visible = alpha > 0;
			}
		}
		for (let i = 0; i < n; i++) this.lenses[i].tint = this.colLit;
		for (let i = 0; i < this.shadows.length && st.shadow; i++) this.shadows[i].tint = st.shadow.tint;
		for (let i = 0; i < this.halos.length && st.halo; i++) this.halos[i].tint = st.halo.tint;
		for (let i = 0; i < this.glows.length; i++) this.glows[i].tint = this.colGlow;
		band.forEach(([x, y], i) => {
			const s = this.bands[i];
			s.position.set(x, y);
			s.tint = st.band!.tint;
		});
		// the bolts' glow and star, the two star flashes
		const sparkTex = this.tex('sign_sparkle') ?? PIXI.Texture.EMPTY;
		grow(this.boltGlows, this.spec!.bolts.length, this.fx, glowTex, true);
		grow(this.boltStars, this.spec!.bolts.length, this.fx, sparkTex, true);
		this.spec!.bolts.forEach(([x, y], i) => {
			this.boltGlows[i].position.set(x, y);
			this.boltGlows[i].tint = SIGN_WIN.glint.boltTint;
			this.boltStars[i].position.set(x, y);
		});
		grow(this.stars, 2, this.fx, sparkTex, true);
		// the Q's bulbs: each flare (the bulb picture added over itself) and its glow, on the bulb's pivot
		const spec = this.spec!;
		const bulbs = spec.deco.filter((d) => d.startsWith('bulb'));
		while (this.bulbC.length < bulbs.length) {
			const c = new PIXI.Container();
			const f = new PIXI.Sprite();
			f.blendMode = 'add';
			const g = new PIXI.Sprite(glowTex);
			g.anchor.set(0.5);
			g.blendMode = 'add';
			c.addChild(f, g);
			this.fx.addChild(c);
			this.bulbC.push(c);
			this.bulbFlares.push(f);
			this.bulbGlows.push(g);
		}
		this.bulbC.forEach((c, i) => (c.visible = i < bulbs.length && false));
		bulbs.forEach((name, i) => {
			const pv = spec.pivots[name];
			this.bulbC[i].pivot.set(pv[0], pv[1]);
			this.bulbC[i].position.set(pv[0], pv[1]);
			const b = spec.frames[this.tier][name];
			const f = this.bulbFlares[i];
			f.texture = this.tex(`${this.code}_${name}`) ?? PIXI.Texture.EMPTY;
			f.position.set(b[0], b[1]);
			f.width = b[2];
			f.height = b[3];
			const g = this.bulbGlows[i];
			const c = spec.centres[name];
			g.position.set(c[0], c[1]);
			g.tint = rgb(mix(spec.decoColor[name], WHITE, SIGN_WIN.deco.bulb.glowMix));
		});
		// the flakes' sprites
		const flakeTex = [0, 1, 2].map((i) => this.tex(`sign_flake${i}`) ?? PIXI.Texture.EMPTY);
		while (this.flakeS.length < MAX_FLAKES) {
			const s = new PIXI.Sprite(flakeTex[this.flakeS.length % 3]);
			s.anchor.set(0.5);
			s.visible = false;
			this.flakesC.addChild(s);
			this.flakeS.push(s);
		}
	}

	/** its column: the mock's randoms for this sign there (each reflector's own strength, the swing's jitter, the flakes) */
	seed(col: number) {
		const code = this.code;
		const spec = this.spec;
		if (!code || !spec) return;
		const r = seeded(col * 7 + code.charCodeAt(1));
		// the mock draws the three layouts' randoms in this order, then the jitter, then the flakes' from the same stream
		let field: number[] = [];
		for (const k of ['ring', 'field', 'sparse']) {
			const v = spec.dots[k].pts.map(() => 0.8 + 0.4 * r());
			if (k === SIGN_WIN.glint.layout) field = v;
		}
		this.jitter = SIGN_WIN.alive.jitter[0] + SIGN_WIN.alive.jitter[1] * r();
		this.rr = r;
		const r10 = seeded(col * 7 + 1000);
		const ten: Record<string, number[]> = {};
		for (const k of ['dense', 'denseBig', 'band']) ten[k] = (spec.dots[k]?.pts ?? []).map(() => 0.8 + 0.4 * r10());
		const lay = this.look?.style.layout;
		const own = code === 'L5' && SIGN_WIN.ten !== 'off' && lay ? ten[lay] : field;
		if (this.dotRand.length < own.length) this.dotRand = new Float32Array(own.length);
		own.forEach((v, i) => (this.dotRand[i] = v));
		const band = ten.band;
		if (this.bandRand.length < band.length) this.bandRand = new Float32Array(band.length);
		band.forEach((v, i) => (this.bandRand[i] = v));
	}

	/** every show stops at once, every flake goes (a new board, the pull away, the slot freed) */
	stop() {
		this.winOn = false;
		this.idleOn = false;
		this.landOn = false;
		this.nFlakes = 0;
		for (const s of this.flakeS) s.visible = false;
	}

	/** THE WIN: starts at win clock `t0` at `pace`; false when it is still playing one (no replay over a running show) */
	win(t0: number, pace: number, now: number): boolean {
		if (this.winOn && (now - this.winT0) / this.winPace <= SIGN_WIN.showMs) return false;
		this.winOn = true;
		this.winT0 = t0;
		this.winPace = Math.max(0.05, pace);
		this.winShed = false;
		this.idleOn = false;
		return true;
	}

	/** THE LANDING: it stopped at board clock `at`, driving `dir` */
	land(at: number, dir: 1 | -1) {
		this.landOn = true;
		this.landAt = at;
		this.landShed = false;
		this.landDir = dir;
	}

	/** THE IDLE: from real ms `now` */
	idle(now: number) {
		this.idleOn = true;
		this.idleT0 = now;
	}

	/** a show is playing (or flakes are in the air) */
	get busy(): boolean {
		return this.winOn || this.idleOn || this.landOn || this.nFlakes > 0;
	}

	get winning(): boolean {
		return this.winOn;
	}

	// ---- the pose --------------------------------------------------------------------------------------------------------
	private resetPose() {
		this.rootRot = 0;
		this.plateRot = 0;
		this.plateDx = 0;
		this.snowRot = 0;
		this.snowSy = 1;
		this.decoRot.fill(0);
		this.bulbLit.fill(0);
		this.nG = 0;
	}

	/** the mock's alivePose: the swing of every part at `u` ms, `amt` of a win's (rockDeg: the spring's first swing);
	 *  `mirror` the side the decorations kick to (a landing: the direction of travel) */
	private alive(u: number, amt: number, rockDeg: number, bulbs: number, mirror: number): number {
		const A = SIGN_WIN.alive;
		const D = SIGN_WIN.deco;
		const plate = rock(u, rockDeg * amt * this.jitter, A.freq, A.damp) * DEG;
		if (A.pivot === 'ground') this.rootRot += plate;
		else this.plateRot += plate;
		const lagged = rock(u - A.snowLagMs, rockDeg * amt * this.jitter, A.freq, A.damp) * DEG;
		this.snowRot += -A.snowLag * A.snow * lagged * mirror;
		this.snowSy *= 1 - A.snowSquash * A.snow * amt * decay(u, A.snowSquashMs) * Math.abs(osc(u, A.freq * 1.2));
		this.plateDx += A.shudder * amt * (this.code === 'L2' ? A.shudderBell : A.shudderPx) * decay(u, A.shudderMs) * osc(u, A.shudderHz);
		const d = A.deco * amt;
		let bulb = 0;
		for (let i = 0; i < this.decoKind.length; i++) {
			const kind = this.decoKind[i];
			if (kind === 'bulb') {
				const B = D.bulb;
				bulb += 1;
				this.decoRot[i] += (B.deg * d * decay(u, B.ms) * osc(u, B.hz, bulb * B.phaseStep) * mirror) * DEG - B.counter * plate;
				// the chase: each bulb flares in turn, twice
				const s = (bulb - 1) * B.chaseMs;
				this.bulbLit[i] += Math.min(1.2, d) * (bump((u - s) / B.flareMs) + B.again * bump((u - s - B.againMs) / B.flareMs)) * bulbs;
			} else if (kind === 'cane') {
				this.decoRot[i] += -(D.cane.deg * d * decay(u, D.cane.ms) * Math.abs(osc(u, D.cane.hz))) * DEG * mirror;
			} else {
				const P = D[kind];
				this.decoRot[i] += (P.deg * d * decay(u, P.ms) * osc(u, P.hz, P.phase) * mirror) * DEG - P.counter * plate;
			}
		}
		return plate;
	}

	/** the mock's glintAt: a band from `start` (ms) for `ms`, at `amp` */
	private glint(u: number, start: number, ms: number, amp: number) {
		const k = (u - start) / ms;
		if (k < 0 || k > 1 || this.nG >= MAX_GLINTS) return;
		const w = SIGN_WIN.glint.width;
		const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
		this.gPos[this.nG] = this.bandLo - 1.5 * w + (this.bandHi - this.bandLo + 3 * w) * e;
		this.gW[this.nG] = w;
		this.gAmp[this.nG] = amp;
		this.nG += 1;
	}

	private bandAt(x: number, y: number): number {
		const [sx, sy] = SIGN_WIN.glint.sweepDir;
		const p = x * sx + y * sy;
		let I = 0;
		for (let g = 0; g < this.nG; g++) {
			const q = (p - this.gPos[g]) / this.gW[g];
			const v = this.gAmp[g] * Math.exp(-q * q);
			if (v > I) I = v;
		}
		return I;
	}

	private shadowAt(x: number, y: number, lead: number): number {
		const [sx, sy] = SIGN_WIN.glint.sweepDir;
		const p = x * sx + y * sy;
		let I = 0;
		for (let g = 0; g < this.nG; g++) {
			const q = (p - (this.gPos[g] + lead * this.gW[g])) / this.gW[g];
			const v = this.gAmp[g] * Math.exp(-q * q);
			if (v > I) I = v;
		}
		return I;
	}

	/** the shows' pose now: the win (win clock ms), the idle (real ms), the landing (board clock ms) */
	private pose(winNow: number, realNow: number, boardNow: number) {
		this.resetPose();
		const W = SIGN_WIN;
		const A = W.alive;
		const G = W.glint;
		if (this.winOn) {
			const u = (winNow - this.winT0) / this.winPace;
			if (u >= 0) {
				const c = W.cand;
				if (c === 1) {
					this.glint(u, 0, G.ms, 1);
					if (G.sweeps > 1) this.glint(u, G.ms + G.secondGapMs, G.ms, G.secondAmp);
				}
				if (c === 2 || c === 3) {
					const f = A.freq;
					const beat = c === 3 ? (A.beat === 'lean' ? 250 : A.beat === 'back' ? 750 : 1250) / f : 0;
					const motionDelay = c === 3 ? Math.max(0, G.ms / 2 - beat) : 0;
					const mu = u - motionDelay;
					if (mu >= 0) this.alive(mu, 1, A.rock, 1, 1);
					if (!this.winShed && mu >= 1000 / (4 * f) && A.flakes > 0) {
						this.winShed = true;
						this.spawnFlakes(A.flakes, 1);
					}
					if (c === 3) {
						const gs = Math.max(0, beat + motionDelay - G.ms / 2);
						this.glint(u, gs, G.ms, 1);
						if (G.sweeps > 1) this.glint(u, gs + G.ms + G.secondGapMs, G.ms, G.secondAmp);
					}
				}
				if (u > W.showMs) this.winOn = false;
			}
		}
		if (this.idleOn) {
			const I = W.idleShow;
			const u = realNow - this.idleT0;
			if (W.idle !== 'twitch') this.glint(u, 0, I.glintMs, I.glintAmp);
			if (W.idle !== 'glint') this.alive(u, I.amount, Math.min(A.rock, I.rockMax) * I.rockShare, I.bulbs, 1);
			if (u > I.ms) this.idleOn = false;
		}
		if (this.landOn) {
			const L = W.landing;
			const um = boardNow - this.landAt;
			if (W.land === 'hinged' && um >= 0) {
				// the decorations and the snow keep going after the plate stops: a kick in the direction of travel
				this.alive(um, L.amount, 0, L.bulbs, this.landDir);
				if (!this.landShed && L.flakes > 0) {
					this.landShed = true;
					this.spawnFlakes(L.flakes, this.landDir);
				}
			}
			if (um > L.ms || W.land !== 'hinged') this.landOn = false;
		}
	}

	private spawnFlakes(n: number, side: number) {
		const edge = this.spec!.snowEdge;
		const F = SIGN_WIN.flakes;
		const r = this.rr;
		for (let i = 0; i < n; i++) {
			const p = edge[Math.floor(r() * edge.length)];
			const j = this.nFlakes < MAX_FLAKES ? this.nFlakes++ : -1;
			// (the mock's draws, in its order, whether or not there is room)
			const vx = side * F.vx + (r() - 0.5) * F.vxRand;
			const vy = F.vy + r() * F.vyRand;
			const rad = F.r + r() * F.rRand;
			const rot = r() * 6;
			const vr = (r() - 0.5) * 8;
			const life = F.lifeMs + r() * F.lifeRandMs;
			const kind = Math.floor(r() * 3);
			if (j < 0 || !p) continue;
			this.fx0[j] = p[0];
			this.fy[j] = p[1] - 1;
			this.fvx[j] = vx;
			this.fvy[j] = vy;
			this.fr[j] = rad;
			this.frot[j] = rot;
			this.fvr[j] = vr;
			this.ft[j] = 0;
			this.flife[j] = life;
			const s = this.flakeS[j];
			s.texture = this.tex(`sign_flake${kind}`) ?? s.texture;
		}
	}

	/** the flakes fall (`dt` ms of the win clock) */
	private stepFlakes(dt: number) {
		if (!this.nFlakes) return;
		const g = SIGN_WIN.flakes.gravity;
		let n = 0;
		for (let i = 0; i < this.nFlakes; i++) {
			this.ft[i] += dt;
			this.fvy[i] += (g * dt) / 1000;
			this.fx0[i] += (this.fvx[i] * dt) / 1000;
			this.fy[i] += (this.fvy[i] * dt) / 1000;
			this.frot[i] += (this.fvr[i] * dt) / 1000;
			if (this.ft[i] < this.flife[i]) {
				if (n !== i) {
					this.fx0[n] = this.fx0[i];
					this.fy[n] = this.fy[i];
					this.fvx[n] = this.fvx[i];
					this.fvy[n] = this.fvy[i];
					this.fr[n] = this.fr[i];
					this.frot[n] = this.frot[i];
					this.fvr[n] = this.fvr[i];
					this.ft[n] = this.ft[i];
					this.flife[n] = this.flife[i];
					const t = this.flakeS[n].texture;
					this.flakeS[n].texture = this.flakeS[i].texture;
					this.flakeS[i].texture = t;
				}
				n += 1;
			}
		}
		this.nFlakes = n;
	}

	// ---- the frame -------------------------------------------------------------------------------------------------------
	/** draw this frame: the sprite's place and look, the shows at the clocks given; `dtFx` ms of the win clock since the last
	 *  frame (the flakes) */
	update(inp: SignInput, winNow: number, realNow: number, boardNow: number, dtFx: number) {
		const s = inp.sprite;
		if (!this.ok || !inp.shown) {
			if (this.root.visible) this.root.visible = false;
			if (this.fx.visible) this.fx.visible = false;
			return;
		}
		this.stepFlakes(dtFx);
		this.pose(winNow, realNow, boardNow);
		// THE DRIVE: a hinged landing tips the plate on its post (the drive's own dive, times hinge) and the snow back against
		// it; otherwise the whole sign tips as the sprite does (the pull away's squat, today's landing)
		let base = s.rotation;
		if (inp.phase === 'in' && SIGN_WIN.land === 'hinged') {
			const tip = s.rotation * SIGN_WIN.landing.hinge;
			this.plateRot += tip;
			this.snowRot += -SIGN_WIN.landing.snow * SIGN_WIN.alive.snow * tip;
			base = 0;
		}
		const root = this.root;
		root.position.set(s.x, s.y);
		root.rotation = base + this.rootRot;
		root.scale.set(inp.k);
		if (root.tint !== s.tint) root.tint = s.tint;
		root.alpha = s.alpha;
		root.visible = true;
		const pp = this.spec!.pivots.plate;
		this.plateC.position.set(pp[0] + this.plateDx, pp[1]);
		this.plateC.rotation = this.plateRot;
		this.snowC.rotation = this.snowRot;
		this.snowC.scale.y = this.snowSy;
		for (let i = 0; i < this.decoKind.length; i++) this.decoC[i].rotation = this.decoRot[i];
		// the flakes, in the sign's own frame
		for (let i = 0; i < MAX_FLAKES; i++) {
			const f = this.flakeS[i];
			if (i >= this.nFlakes) {
				if (f.visible) f.visible = false;
				continue;
			}
			const life = this.flife[i];
			const a = 1 - Math.max(0, (this.ft[i] - life * SIGN_WIN.flakes.fadeFrom) / (life * (1 - SIGN_WIN.flakes.fadeFrom)));
			f.visible = a > 0;
			f.alpha = Math.max(0, a);
			f.position.set(this.fx0[i], this.fy[i]);
			f.rotation = this.frot[i];
			f.width = f.height = 2 * this.fr[i];
		}
		this.drawLight(root);
	}

	/** the reflectors, the 10's border light, the bolts, the stars and the bulbs for this frame's pose */
	private drawLight(root: PIXI.Container) {
		const look = this.look!;
		const st = look.style;
		const G = SIGN_WIN.glint;
		const pts = look.dots.pts;
		const any = this.nG > 0;
		let lit = false;
		const r = this.dotR;
		for (let i = 0; i < pts.length; i++) {
			const [x, y] = pts[i];
			const I = any ? Math.min(1, this.bandAt(x, y) * this.dotRand[i]) : 0;
			const on = I > 0.01;
			const lens = this.lenses[i];
			lens.visible = on;
			if (on) lens.alpha = Math.min(1, I * Math.min(1, G.intensity * 1.1));
			const glow = this.glows[i];
			if (glow) {
				glow.visible = on;
				if (on) {
					const gs = r * G.bloom * (0.85 + 0.3 * I);
					glow.width = glow.height = gs;
					glow.alpha = Math.min(1, I * G.intensity * 0.9);
					lit = true;
				}
			}
			const halo = this.halos[i];
			if (halo && st.halo) {
				halo.visible = on;
				if (on) {
					const gs = r * st.halo.bloom * (0.85 + 0.3 * I);
					halo.width = halo.height = gs;
					halo.alpha = Math.min(1, I * G.intensity * 0.9) * st.halo.alpha;
				}
			}
			const sh = this.shadows[i];
			if (sh && st.shadow) {
				const Is = any ? Math.min(1, this.shadowAt(x, y, st.shadow.lead) * this.dotRand[i]) : 0;
				sh.visible = Is > 0.01;
				if (sh.visible) sh.alpha = Math.min(1, Is * st.shadow.alpha);
			}
		}
		// the 10's border light (option b), added: it shows on the black ring only
		if (st.band) {
			const band = this.spec!.dots.band?.pts ?? [];
			for (let i = 0; i < band.length; i++) {
				const b = this.bands[i];
				const I = any ? Math.min(1, this.bandAt(band[i][0], band[i][1]) * this.bandRand[i]) : 0;
				b.visible = I > 0.01;
				if (b.visible) {
					const gs = st.band.size * (0.85 + 0.3 * I);
					b.width = b.height = gs;
					b.alpha = Math.min(1, I * G.intensity * 0.9) * st.band.alpha;
					lit = true;
				}
			}
		}
		// the bolt heads catch the band
		const bolts = this.spec!.bolts;
		for (let i = 0; i < bolts.length; i++) {
			const I = any && G.bolts > 0 ? this.bandAt(bolts[i][0], bolts[i][1]) : 0;
			const g = this.boltGlows[i];
			const s = this.boltStars[i];
			const on = I >= 0.02;
			g.visible = on;
			s.visible = on;
			if (on) {
				const gs = G.boltGlow * (0.7 + 0.4 * I);
				g.width = g.height = gs;
				g.alpha = Math.min(1, I * 0.8 * G.bolts);
				const ss = G.boltSparkle * G.bolts * I;
				s.width = s.height = ss;
				s.alpha = Math.min(1, I * I * G.bolts);
				lit = true;
			}
		}
		// two reflectors flash a star as the band crosses them
		for (let j = 0; j < 2; j++) {
			const s = this.stars[j];
			const idx = this.sparkPick[j];
			const I = any && G.sparkle > 0 && j < this.sparkCount ? this.bandAt(pts[idx][0], pts[idx][1]) : 0;
			s.visible = I >= G.sparkleFrom;
			if (s.visible) {
				const ss = G.sparkleSize * G.sparkle * (0.5 + 0.6 * I);
				s.position.set(pts[idx][0], pts[idx][1]);
				s.width = s.height = ss;
				s.rotation = 0.2 + I * 0.25;
				s.alpha = Math.min(1, I * I * I * G.sparkle);
				lit = true;
			}
		}
		// the Q's bulbs: the flare added over the bulb, and its glow
		const B = SIGN_WIN.deco.bulb;
		let bulb = 0;
		for (let i = 0; i < this.decoKind.length; i++) {
			if (this.decoKind[i] !== 'bulb') continue;
			const c = this.bulbC[bulb];
			const L = this.bulbLit[i];
			const on = L > 0.01;
			c.visible = on;
			if (on) {
				c.rotation = this.decoRot[i];
				this.bulbFlares[bulb].alpha = Math.min(1, L * B.flareAlpha);
				const g = this.bulbGlows[bulb];
				const gs = B.glowSize * (0.8 + 0.3 * L);
				g.width = g.height = gs;
				g.alpha = Math.min(1, L * B.glowAlpha);
				lit = true;
			}
			bulb += 1;
		}
		const fx = this.fx;
		fx.visible = lit;
		if (!lit) return;
		// THE FX FOLLOWS THE PLATE: root (place, turn a, scale k) then the plate (its pivot p, side shake d, turn b): a
		// point q of the plate lands at X + k R(a) (R(b) (q - p) + p + d) = k R(a + b) (q - p) + X + k R(a) (p + d)
		const p = this.spec!.pivots.plate;
		const a = root.rotation;
		const k = root.scale.x;
		const ca = Math.cos(a);
		const sa = Math.sin(a);
		const qx = p[0] + this.plateDx;
		const qy = p[1];
		fx.pivot.set(p[0], p[1]);
		fx.rotation = a + this.plateRot;
		fx.scale.set(k);
		fx.position.set(root.x + k * (ca * qx - sa * qy), root.y + k * (sa * qx + ca * qy));
		if (fx.tint !== root.tint) fx.tint = root.tint;
		fx.alpha = root.alpha;
	}

	/** DEV / probes: what it draws now */
	snapshot() {
		const look = this.look;
		const lit = this.lenses.filter((s) => s.visible).length;
		return {
			code: this.code,
			ok: this.ok,
			shown: this.root.visible,
			win: this.winOn,
			idle: this.idleOn,
			land: this.landOn,
			rootRot: this.root.rotation,
			plateRot: this.plateC.rotation,
			plateDx: this.plateC.x - (this.spec?.pivots.plate[0] ?? 0),
			snowRot: this.snowC.rotation,
			snowSy: this.snowC.scale.y,
			decoRot: this.decoKind.map((_, i) => this.decoC[i].rotation),
			glints: this.nG,
			dots: look?.dots.pts.length ?? 0,
			dotsLit: lit,
			dotsAtRest: this.rests.filter((s) => s.visible).length,
			restBaked: !!look?.restBaked,
			fxShown: this.fx.visible,
			fxLit: this.fx.visible ? this.fx.children.filter((c) => c.visible).length : 0,
			flakes: this.nFlakes,
			flakesShown: this.flakeS.filter((s) => s.visible).length,
			ten: this.code === 'L5' ? SIGN_WIN.ten : null,
			layout: look?.style.layout ?? null,
			sprites: this.root.children.length + this.plateC.children.length + this.dotsC.children.length + this.fx.children.length + this.flakesC.children.length,
		};
	}
}
