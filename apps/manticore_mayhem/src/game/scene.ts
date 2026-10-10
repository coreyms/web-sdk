// THE COURTYARD SCENE: raw Pixi in one container, in px of the scene's own frame (game/sceneSpec.ts, 2560 x 1440;
// components/Background.svelte cover-fits it to the canvas). Back to front, the scene agent's own order:
//   backdrop day, night     the painting, opaque
//   foreground day, night   the 3D courtyard with alpha, no fire light, no moving chains
//   fire                    the braziers' light alone, on black, ADDITIVE. One pass for every mode: its level, the
//                           flicker, the EPIC red and the dim are all its tint
//   chains day, night       per set: swag L R (MeshSimple strips), ring L R (sprites turning about the knocker's
//                           mouth), hanging chain L R (strips)
// A night layer sits over its day twin and fades in over it (the two foregrounds share their outline); whichever
// of the two is fully covered or fully transparent is not drawn at all.
//
// WHAT RUNS WHEN (constants SCENE has every number and the chain model in words; real time):
//   a change of mode   every value (night, fire level, flicker band, tints, dim) runs from where it is to the new
//                      mode's over crossfadeMs
//   the flicker        the fire's level, at most every idleIntervalMs
//   the idle           wind on the chains' free ends, at most every idleIntervalMs, never paused
//   a board kick       read from featureFx.boardKick every tick (the scalar the board's own chains bow on); while a
//                      chain is still moving from one, the strips are rewritten every frame
// House rules: no filters, no texture is created or uploaded after the files land, dims and tints are sprite
// tints, and a tick allocates nothing: the strips rewrite the vertex arrays their meshes already own.
import * as PIXI from 'pixi.js';

import { PLAYGROUND_PX, SCENE } from './constants';
import { boardKick } from './featureFx';
import { SCENE_SPEC } from './sceneSpec';

export type SceneFamily = keyof typeof SCENE.modes;
export type SceneTier = keyof typeof SCENE_SPEC.tiers;
type Textures = Record<string, PIXI.Texture | undefined>;
type Terms = readonly (readonly number[])[];

const SIDES = ['L', 'R'] as const;
const SETS = ['day', 'night'] as const;
const FW = SCENE_SPEC.frame[0];
const TAU = Math.PI * 2;

// the values a mode sets, in one array so a change of mode is one loop
const NIGHT = 0;
const FIRE = 1;
const LO = 2;
const HI = 3;
const FIRE_TINT = 4; // r g b
const FORE_TINT = 7; // r g b
const DIM = 10;
const SHOW = 11;
const VALUES = 12;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const rgb = (r: number, g: number, b: number) => (Math.round(clamp01(r) * 255) << 16) | (Math.round(clamp01(g) * 255) << 8) | Math.round(clamp01(b) * 255);
/** sum of weight sin(2 pi t / period + phase) over [period ms, weight, phase] terms: -1 .. 1 */
const slow = (terms: Terms, ms: number): number => {
	let n = 0;
	for (let i = 0; i < terms.length; i += 1) n += terms[i][1] * Math.sin((TAU * ms) / terms[i][0] + terms[i][2]);
	return n;
};
/** the flicker's n(t), -1 .. 1 (SCENE.flicker.terms are [hz, weight, phase]) */
export const flickerAt = (ms: number): number => {
	const terms = SCENE.flicker.terms;
	let n = 0;
	for (let i = 0; i < terms.length; i += 1) n += terms[i][1] * Math.sin((TAU * terms[i][0] * ms) / 1000 + terms[i][2]);
	return n;
};
/** the idle wind at `ms`: the hanging chain's free end and the swag's middle, px */
export const idleAt = (piece: 'hang' | 'swag', side: 'L' | 'R', ms: number): number => {
	const spec = SCENE.chain.idle[piece][side];
	return spec.px * slow(spec.terms, ms);
};

/** `n` even cuts from `from` to `to`, with the box's own top and bottom edge added where they lie outside them */
const cuts = (box: readonly number[], from: number, to: number, n: number): number[] => {
	const a = Math.max(box[1], from);
	const b = Math.min(box[3], to);
	const ys: number[] = [];
	if (box[1] < a - 0.5) ys.push(box[1]);
	for (let i = 0; i <= n; i += 1) ys.push(a + ((b - a) * i) / n);
	if (box[3] > b + 0.5) ys.push(box[3]);
	return ys;
};

/** one strip per set (day, night) over the same rest positions; a / b are each row's two weights */
type Strip = { meshes: PIXI.MeshSimple[]; buffers: PIXI.Buffer[]; rest: Float32Array; a: Float32Array; b: Float32Array; rows: number };
type Chain = {
	ring: PIXI.Sprite[];
	hang: Strip;
	swag: Strip;
	/** the hanging chain: free end travel, its velocity, the lagged copy the lower links follow, the idle wind */
	x: number;
	v: number;
	xl: number;
	idle: number;
	w: number;
	zeta: number;
	gain: number;
	max: number;
	/** the top link: its place on the chain (0 .. 1), its share of the free end's travel, its distance under the mouth */
	sHook: number;
	aHook: number;
	hookLen: number;
	/** the swag's hook from the mouth pivot */
	hx: number;
	hy: number;
	/** the swag: its middle's travel, velocity, idle */
	b: number;
	bv: number;
	bIdle: number;
	bGain: number;
	bMax: number;
	/** what was last drawn: the ring's turn (radians) and the swag's top end travel */
	turn: number;
	topX: number;
	topY: number;
	lengthPx: number;
	periodMs: number;
};

/** a strip over a sprite's box, cut across at the given heights (frame px, top to bottom) */
const strip = (box: readonly number[], ys: number[]): Strip => {
	const [x0, y0, x1, y1] = box;
	const rows = ys.length;
	const rest = new Float32Array(rows * 4);
	const uvs = new Float32Array(rows * 4);
	const indices = new Uint32Array((rows - 1) * 6);
	for (let r = 0; r < rows; r += 1) {
		const t = (ys[r] - y0) / (y1 - y0);
		rest.set([x0, ys[r], x1, ys[r]], r * 4);
		uvs.set([0, t, 1, t], r * 4);
		if (r < rows - 1) indices.set([r * 2, r * 2 + 1, r * 2 + 2, r * 2 + 1, r * 2 + 3, r * 2 + 2], r * 6);
	}
	const meshes = SETS.map(() => {
		const mesh = new PIXI.MeshSimple({ texture: PIXI.Texture.EMPTY, vertices: rest.slice(), uvs: uvs.slice(), indices: indices.slice() });
		mesh.autoUpdate = false; // the tick rewrites the vertices and flags the buffer itself
		return mesh;
	});
	return { meshes, buffers: meshes.map((m) => m.geometry.getBuffer('aPosition')), rest, a: new Float32Array(rows), b: new Float32Array(rows), rows };
};

export class SceneView {
	readonly root = new PIXI.Container();
	readonly tier: SceneTier;
	dayReady = false;
	nightReady = false;

	private readonly backdrop = SETS.map(() => new PIXI.Sprite(PIXI.Texture.EMPTY));
	private readonly fore = SETS.map(() => new PIXI.Sprite(PIXI.Texture.EMPTY));
	private readonly fire = new PIXI.Sprite(PIXI.Texture.EMPTY);
	private readonly sets = SETS.map(() => new PIXI.Container());
	private readonly chains: Record<'L' | 'R', Chain>;

	private readonly cur = new Float64Array(VALUES);
	private readonly from = new Float64Array(VALUES);
	private readonly to = new Float64Array(VALUES);
	private readonly next = new Float64Array(VALUES);
	private fadeAt = -1;
	private family: SceneFamily = 'base';
	private wantNight = false;

	/** the kick's lagged size, the ms not yet integrated, and whether any chain is still moving from a kick */
	private e = 0;
	private acc = 0;
	private moving = false;
	private lastSlowAt = -1e9;
	private flick = 0;
	private clock = 0;
	private level = 0;

	// DEV / probe counters
	vertexWrites = 0;
	slowSteps = 0;
	fades = 0;

	constructor(tier: SceneTier) {
		this.tier = tier;
		const root = this.root;
		root.label = 'scene';
		root.visible = false;
		root.eventMode = 'none';
		root.interactiveChildren = false;
		this.fire.blendMode = 'add';
		root.addChild(this.backdrop[0], this.backdrop[1], this.fore[0], this.fore[1], this.fire, this.sets[0], this.sets[1]);
		for (const s of [...this.backdrop, ...this.fore, this.fire, ...this.sets]) s.visible = false;

		const boxes = SCENE_SPEC.tiers[tier].boxes;
		const H = SCENE.chain.hang;
		const S = SCENE.chain.swag;
		const chains = {} as Record<'L' | 'R', Chain>;
		for (const side of SIDES) {
			const p = SCENE_SPEC.points[side];
			const lengthPx = p.hangEnd[1] - p.pivot[1];
			const periodMs = H.periodMsPerRootPx * Math.sqrt(lengthPx) * H[side].period;
			const hang = strip(boxes[`hang_${side}`], cuts(boxes[`hang_${side}`], p.hangHook[1], p.hangEnd[1], H.segments));
			for (let r = 0; r < hang.rows; r += 1) {
				// s: 0 at the knocker's mouth, 1 at the free end. a: the row's share of the free end's travel
				// (growing down the chain, less the hold over its last part). b: how far it trails
				const s = clamp01((hang.rest[r * 4 + 1] - p.pivot[1]) / lengthPx);
				const h = clamp01((s - H.holdFrom) / (1 - H.holdFrom));
				hang.a[r] = Math.pow(s, H.shape) * (1 - H[side].hold * h * h * (3 - 2 * h));
				hang.b[r] = s;
			}
			// cut exactly at the hook and at the pin, so the pinned end and anything showing under it never move
			const swag = strip(boxes[`swag_${side}`], cuts(boxes[`swag_${side}`], p.swagHook[1], p.swagPin[1], S.segments));
			for (let r = 0; r < swag.rows; r += 1) {
				// s: 0 at the ring's hook, 1 at the pin on the bowl rim. a: the row's share of the hook's own
				// travel (all of it at the hook, none at the pin or under it). b: the bow
				const s = clamp01((swag.rest[r * 4 + 1] - p.swagHook[1]) / (p.swagPin[1] - p.swagHook[1]));
				swag.a[r] = 1 - s;
				swag.b[r] = Math.sin(Math.PI * s);
			}
			const box = boxes[`ring_${side}`];
			const ring = SETS.map(() => {
				const sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
				sprite.anchor.set((p.pivot[0] - box[0]) / (box[2] - box[0]), (p.pivot[1] - box[1]) / (box[3] - box[1]));
				sprite.position.set(p.pivot[0], p.pivot[1]);
				return sprite;
			});
			const sHook = clamp01((p.hangHook[1] - p.pivot[1]) / lengthPx);
			chains[side] = {
				ring,
				hang,
				swag,
				x: 0,
				v: 0,
				xl: 0,
				idle: 0,
				w: TAU / (periodMs / 1000),
				zeta: H[side].damping,
				gain: H[side].gain,
				max: H[side].max,
				sHook,
				aHook: Math.pow(sHook, H.shape),
				hookLen: p.hangHook[1] - p.pivot[1],
				hx: p.swagHook[0] - p.pivot[0],
				hy: p.swagHook[1] - p.pivot[1],
				b: 0,
				bv: 0,
				bIdle: 0,
				bGain: S[side].gain,
				bMax: S[side].max,
				turn: 0,
				topX: 0,
				topY: 0,
				lengthPx,
				periodMs,
			};
		}
		this.chains = chains;
		// each set's pieces in the scene agent's order (swag, ring, hanging chain), left then right
		SETS.forEach((_, i) => {
			for (const piece of SCENE_SPEC.order) {
				for (const side of SIDES) this.sets[i].addChild(piece === 'ring' ? chains[side].ring[i] : chains[side][piece].meshes[i]);
			}
		});
		this.setValues(this.cur, 'base', SCENE.dim.base, false);
	}

	/** the day files are in (called once): backdrop, foreground, fire pass and the atlas's day frames */
	setDay(tex: Textures): boolean {
		if (this.dayReady) return true;
		if (!this.setLayers(0, tex) || !tex.scene_fire) return false;
		this.fire.texture = tex.scene_fire;
		this.fire.scale.set(FW / tex.scene_fire.width);
		this.dayReady = true;
		this.fire.visible = true;
		this.apply();
		return true;
	}

	/** the night files are in (called once); a mode that was waiting for them crossfades now */
	setNight(tex: Textures, now: number): boolean {
		if (this.nightReady) return true;
		if (!this.setLayers(1, tex)) return false;
		this.nightReady = true;
		if (this.wantNight) this.mode(this.family, this.to[DIM], now);
		return true;
	}

	private setLayers(i: number, tex: Textures): boolean {
		const set = SETS[i];
		const backdrop = tex[`scene_backdrop_${set}`];
		const fore = tex[`scene_fore_${set}`];
		if (!backdrop || !fore || !tex[`scene_ring_L_${set}`]) return false;
		this.backdrop[i].texture = backdrop;
		this.backdrop[i].scale.set(FW / backdrop.width);
		this.fore[i].texture = fore;
		this.fore[i].scale.set(FW / fore.width);
		const boxes = SCENE_SPEC.tiers[this.tier].boxes;
		for (const side of SIDES) {
			const c = this.chains[side];
			const ring = tex[`scene_ring_${side}_${set}`] ?? PIXI.Texture.EMPTY;
			c.ring[i].texture = ring;
			c.ring[i].scale.set((boxes[`ring_${side}`][2] - boxes[`ring_${side}`][0]) / Math.max(ring.width, 1));
			c.hang.meshes[i].texture = tex[`scene_hang_${side}_${set}`] ?? PIXI.Texture.EMPTY;
			c.swag.meshes[i].texture = tex[`scene_swag_${side}_${set}`] ?? PIXI.Texture.EMPTY;
		}
		return true;
	}

	/** every texture source the scene draws from, for the one upload when its files land */
	sources(): PIXI.TextureSource[] {
		const out = new Set<PIXI.TextureSource>();
		for (const s of [...this.backdrop, ...this.fore, this.fire, ...this.chains.L.ring]) if (s.texture !== PIXI.Texture.EMPTY) out.add(s.texture.source);
		return [...out];
	}

	/** cover fit: the frame's top-left corner on the canvas and canvas px per frame px */
	place(x: number, y: number, scale: number): void {
		this.root.position.set(x, y);
		this.root.scale.set(scale);
	}

	private setValues(out: Float64Array, family: SceneFamily, dim: number, show: boolean): void {
		const m = SCENE.modes[family];
		out[NIGHT] = m.night;
		out[FIRE] = m.fire;
		out[LO] = m.flicker[0];
		out[HI] = m.flicker[1];
		for (let i = 0; i < 3; i += 1) {
			out[FIRE_TINT + i] = m.fireTint[i];
			out[FORE_TINT + i] = m.foreTint[i];
		}
		out[DIM] = dim;
		out[SHOW] = show ? 1 : 0;
	}

	/** the game's mode and dim. A night mode whose files are not in yet shows the day scene (the regular Bonus's
	 *  values) until setNight. `now` < 0 sets everything at once (the first show behind the loading screen). A scene
	 *  that was not showing takes the mode at once and only fades IN (over the placeholder it replaces). */
	mode(family: SceneFamily, dim: number, now: number): void {
		this.family = family;
		this.wantNight = SCENE.modes[family].night > 0;
		const next = this.next;
		this.setValues(next, this.wantNight && !this.nightReady ? 'bonus' : family, dim, true);
		if (now < 0) {
			this.cur.set(next);
			this.to.set(next);
			this.fadeAt = -1;
			this.apply();
			return;
		}
		let same = true;
		for (let i = 0; i < VALUES; i += 1) if (next[i] !== this.to[i]) same = false;
		if (same) return;
		if (this.cur[SHOW] <= 0 && this.fadeAt < 0) {
			this.cur.set(next);
			this.cur[SHOW] = 0;
		}
		this.to.set(next);
		this.from.set(this.cur);
		this.fadeAt = now;
		this.fades += 1;
	}

	/** not drawn in this layout (portrait): the next mode() starts from nothing again */
	hide(): void {
		this.cur[SHOW] = 0;
		this.to[SHOW] = 0;
		this.fadeAt = -1;
		this.root.alpha = 0;
	}

	get shown(): boolean {
		return this.cur[SHOW] >= 1;
	}
	get fading(): boolean {
		return this.fadeAt >= 0;
	}

	/** the layers' visibility, alpha and tints from the current values (a change of mode only, and the fire's level) */
	private apply(): void {
		const c = this.cur;
		const night = this.nightReady ? c[NIGHT] : 0;
		const dim = c[DIM];
		const grey = rgb(dim, dim, dim);
		const fore = rgb(dim * c[FORE_TINT], dim * c[FORE_TINT + 1], dim * c[FORE_TINT + 2]);
		for (let i = 0; i < 2; i += 1) {
			// day is drawn until night covers it; night only once it has started to
			const on = this.dayReady && (i === 0 ? night < 1 : night > 0);
			this.backdrop[i].visible = this.fore[i].visible = this.sets[i].visible = on;
			this.backdrop[i].tint = grey;
			this.fore[i].tint = fore;
			this.sets[i].tint = fore;
			if (i === 1) this.backdrop[i].alpha = this.fore[i].alpha = this.sets[i].alpha = night;
		}
		this.root.alpha = c[SHOW];
		this.applyFire();
	}

	private applyFire(): void {
		const c = this.cur;
		// never over the full pass: EPIC's band ends at 1, and the clamp holds whatever the constants say
		const level = Math.min(1, c[FIRE] * (c[LO] + ((c[HI] - c[LO]) * (1 + this.flick)) / 2));
		this.level = level;
		const k = level * c[DIM];
		this.fire.tint = rgb(k * c[FIRE_TINT], k * c[FIRE_TINT + 1], k * c[FIRE_TINT + 2]);
	}

	/** one frame. `now` is the ticker's clock (ms), `dtMs` the frame's length. */
	tick(now: number, dtMs: number): void {
		if (!this.dayReady) return;
		let look = false;
		if (this.fadeAt >= 0) {
			const u = clamp01((now - this.fadeAt) / Math.max(SCENE.crossfadeMs, 1));
			for (let i = 0; i < VALUES; i += 1) this.cur[i] = this.from[i] + (this.to[i] - this.from[i]) * u;
			if (u >= 1) this.fadeAt = -1;
			look = true;
		}

		// the kick: the scalar the board's chains use (boardKick is (0.6 k, k), playground px), its size only: these
		// chains are far too slow to follow its rattle, so it shoves them one way, the kick's own first way
		const C = SCENE.chain;
		const ky = boardKick.y / PLAYGROUND_PX;
		const kx = boardKick.x / PLAYGROUND_PX / 0.6;
		const k = Math.abs(Math.abs(ky) >= Math.abs(kx) ? ky : kx);
		let chainsDirty = false;
		if (k > 0 || this.moving) {
			this.acc += Math.min(dtMs, 100);
			const h = C.stepMs / 1000;
			const aKick = 1 - Math.exp(-C.stepMs / Math.max(C.kickLagMs, 1));
			const aLag = 1 - Math.exp(-C.stepMs / Math.max(C.hang.lagMs, 1));
			const ws = TAU / (C.swag.periodMs / 1000);
			while (this.acc >= C.stepMs) {
				this.acc -= C.stepMs;
				this.e += (k - this.e) * aKick;
				for (let i = 0; i < 2; i += 1) {
					const c = this.chains[SIDES[i]];
					c.v += (-c.w * c.w * c.x - 2 * c.zeta * c.w * c.v + c.gain * c.w * this.e * Math.max(0, 1 - Math.abs(c.x) / c.max)) * h;
					c.x += c.v * h;
					c.xl += (c.x - c.xl) * aLag;
					c.bv += (-ws * ws * c.b - 2 * C.swag.damping * ws * c.bv + c.bGain * ws * this.e * Math.max(0, 1 - Math.abs(c.b) / c.bMax)) * h;
					c.b += c.bv * h;
				}
			}
			let live = k > 0 || this.e > 0.01;
			for (let i = 0; i < 2 && !live; i += 1) {
				const c = this.chains[SIDES[i]];
				live = Math.hypot(c.x, c.v / c.w) > C.restPx || Math.abs(c.xl - c.x) > C.restPx || Math.hypot(c.b, c.bv / ws) > C.restPx;
			}
			if (!live) {
				this.e = this.acc = 0;
				for (let i = 0; i < 2; i += 1) {
					const c = this.chains[SIDES[i]];
					c.x = c.v = c.xl = c.b = c.bv = 0;
				}
			}
			this.moving = live;
			chainsDirty = true;
		}

		// the slow step: the flicker and the wind
		if (now - this.lastSlowAt >= SCENE.idleIntervalMs - 3) {
			this.lastSlowAt = now;
			this.clock = now;
			this.slowSteps += 1;
			this.flick = flickerAt(now);
			for (let i = 0; i < 2; i += 1) {
				const c = this.chains[SIDES[i]];
				c.idle = idleAt('hang', SIDES[i], now);
				c.bIdle = idleAt('swag', SIDES[i], now);
			}
			chainsDirty = true;
			if (!look) this.applyFire();
		}
		if (look) this.apply();
		if (chainsDirty) this.writeChains();
	}

	/** turn the rings and rewrite the strips of whichever set is drawn */
	private writeChains(): void {
		const dir = SCENE.chain.swag.dir;
		for (let n = 0; n < 2; n += 1) {
			const c = this.chains[SIDES[n]];
			// the ring turns about the mouth so its bottom stays on the chain's top link
			const hook = c.aHook * (c.x + (c.xl - c.x) * c.sHook + c.idle);
			const turn = -Math.asin(Math.max(-1, Math.min(1, hook / c.hookLen)));
			const sin = Math.sin(turn);
			const cos = Math.cos(turn);
			// where the turn takes the swag's hook
			const tx = c.hx * cos - c.hy * sin - c.hx;
			const ty = c.hx * sin + c.hy * cos - c.hy;
			const bow = c.b + c.bIdle;
			c.turn = turn;
			c.topX = tx;
			c.topY = ty;
			for (let i = 0; i < 2; i += 1) {
				if (!this.sets[i].visible) continue;
				c.ring[i].rotation = turn;
				const hang = c.hang;
				const hv = hang.meshes[i].vertices as Float32Array;
				for (let r = 0; r < hang.rows; r += 1) {
					const dx = hang.a[r] * (c.x + (c.xl - c.x) * hang.b[r] + c.idle);
					hv[r * 4] = hang.rest[r * 4] + dx;
					hv[r * 4 + 2] = hang.rest[r * 4 + 2] + dx;
				}
				hang.buffers[i].update();
				const swag = c.swag;
				const sv = swag.meshes[i].vertices as Float32Array;
				for (let r = 0; r < swag.rows; r += 1) {
					const dx = tx * swag.a[r] + bow * dir[0] * swag.b[r];
					const dy = ty * swag.a[r] + bow * dir[1] * swag.b[r];
					const o = r * 4;
					sv[o] = swag.rest[o] + dx;
					sv[o + 1] = swag.rest[o + 1] + dy;
					sv[o + 2] = swag.rest[o + 2] + dx;
					sv[o + 3] = swag.rest[o + 3] + dy;
				}
				swag.buffers[i].update();
				this.vertexWrites += 2;
			}
		}
	}

	/** DEV / probe: on the canvas, the swag's hook on the ring through the ring sprite's own transform, and the swag
	 *  strip at that height through its own vertices and transform (the two must stay together through a swing) */
	hookOnScreen(side: 'L' | 'R') {
		const ch = this.chains[side];
		const set = this.sets[1].visible && !this.sets[0].visible ? 1 : 0;
		const p = SCENE_SPEC.points[side];
		const ring = ch.ring[set];
		// the hook in the ring sprite's local px: texture px from its anchor
		const k = ring.scale.x || 1;
		const a = ring.toGlobal({ x: (p.swagHook[0] - p.pivot[0]) / k, y: (p.swagHook[1] - p.pivot[1]) / k });
		const sv = ch.swag.meshes[set].vertices as Float32Array;
		const box = SCENE_SPEC.tiers[this.tier].boxes[`swag_${side}`];
		let x = p.swagHook[0];
		let y = p.swagHook[1];
		for (let r = 0; r < ch.swag.rows - 1; r += 1) {
			const y0 = ch.swag.rest[r * 4 + 1];
			const y1 = ch.swag.rest[r * 4 + 5];
			if (p.swagHook[1] < y0 || p.swagHook[1] > y1) continue;
			const t = (p.swagHook[1] - y0) / (y1 - y0);
			const u = (p.swagHook[0] - box[0]) / (box[2] - box[0]);
			const at = (o: number) => sv[r * 4 + o] + (sv[r * 4 + 2 + o] - sv[r * 4 + o]) * u;
			const below = (o: number) => sv[r * 4 + 4 + o] + (sv[r * 4 + 6 + o] - sv[r * 4 + 4 + o]) * u;
			x = at(0) + (below(0) - at(0)) * t;
			y = at(1) + (below(1) - at(1)) * t;
			break;
		}
		const b = ch.swag.meshes[set].toGlobal({ x, y });
		return { ring: { x: Number(a.x.toFixed(3)), y: Number(a.y.toFixed(3)) }, swag: { x: Number(b.x.toFixed(3)), y: Number(b.y.toFixed(3)) } };
	}

	/** DEV / probe: what is drawn right now, in frame px (the component adds the screen's) */
	state() {
		const c = this.cur;
		const night = this.nightReady ? c[NIGHT] : 0;
		const set = night >= 0.5 ? 1 : 0;
		const chain = (side: 'L' | 'R') => {
			const ch = this.chains[side];
			const hv = ch.hang.meshes[set].vertices as Float32Array;
			const sv = ch.swag.meshes[set].vertices as Float32Array;
			const last = (ch.hang.rows - 1) * 4;
			const p = SCENE_SPEC.points[side];
			// the swag strip at the hook's own height, between the two rows round it
			const rowAt = (y: number) => {
				for (let r = 0; r < ch.swag.rows - 1; r += 1) {
					const y0 = ch.swag.rest[r * 4 + 1];
					const y1 = ch.swag.rest[r * 4 + 5];
					if (y >= y0 && y <= y1) {
						const t = (y - y0) / (y1 - y0);
						return { dx: sv[r * 4] - ch.swag.rest[r * 4] + (sv[r * 4 + 4] - ch.swag.rest[r * 4 + 4] - (sv[r * 4] - ch.swag.rest[r * 4])) * t, dy: sv[r * 4 + 1] - ch.swag.rest[r * 4 + 1] + (sv[r * 4 + 5] - ch.swag.rest[r * 4 + 5] - (sv[r * 4 + 1] - ch.swag.rest[r * 4 + 1])) * t };
					}
				}
				return { dx: 0, dy: 0 };
			};
			let bowMax = 0;
			for (let r = 0; r < ch.swag.rows; r += 1) bowMax = Math.max(bowMax, Math.hypot(sv[r * 4] - ch.swag.rest[r * 4], sv[r * 4 + 1] - ch.swag.rest[r * 4 + 1]));
			return {
				lengthPx: ch.lengthPx,
				periodMs: ch.periodMs,
				/** the hanging chain as drawn: sideways travel of its top row, of its free end, and the spring under it */
				hang: { top: hv[0] - ch.hang.rest[0], tip: hv[last] - ch.hang.rest[last], x: ch.x, v: ch.v, lag: ch.xl, idle: ch.idle, angleDeg: (Math.atan2(hv[last] - ch.hang.rest[last], ch.lengthPx) * 180) / Math.PI, atPivot: Math.pow(0, SCENE.chain.hang.shape) * (ch.x + ch.idle) },
				ring: { turnDeg: (ch.turn * 180) / Math.PI, rotation: ch.ring[set].rotation, pivot: p.pivot },
				/** the swag as drawn: its middle's travel, the largest travel of any row, its top end's travel at the hook
				 *  against the hook's own (the ring's turn), and its pinned end's travel */
				swag: { b: ch.b, idle: ch.bIdle, bowMax, atHook: rowAt(p.swagHook[1]), hook: { dx: ch.topX, dy: ch.topY }, atPin: rowAt(p.swagPin[1]), underPin: { dx: sv[(ch.swag.rows - 1) * 4] - ch.swag.rest[(ch.swag.rows - 1) * 4], dy: sv[(ch.swag.rows - 1) * 4 + 1] - ch.swag.rest[(ch.swag.rows - 1) * 4 + 1] } },
			};
		};
		return {
			tier: this.tier,
			source: SCENE_SPEC.source,
			ready: { day: this.dayReady, night: this.nightReady },
			family: this.family,
			/** what is drawn: 'day' / 'night', or 'fade' while one covers the other */
			scene: night <= 0 ? 'day' : night >= 1 ? 'night' : 'fade',
			night,
			waitingForNight: this.wantNight && !this.nightReady,
			fading: this.fadeAt >= 0,
			show: c[SHOW],
			/** the fire pass: the mode's level, the band, the level drawn now (after the flicker), its tint as drawn */
			fire: { mode: c[FIRE], band: [c[FIRE] * c[LO], Math.min(1, c[FIRE] * c[HI])], level: this.level, flicker: this.flick, tint: this.fire.tint, modeTint: [c[FIRE_TINT], c[FIRE_TINT + 1], c[FIRE_TINT + 2]], blend: this.fire.blendMode },
			dim: c[DIM],
			tints: { backdrop: this.backdrop[set].tint, fore: this.fore[set].tint, chains: this.sets[set].tint, foreTint: [c[FORE_TINT], c[FORE_TINT + 1], c[FORE_TINT + 2]] },
			clock: this.clock,
			kick: { e: this.e, moving: this.moving },
			chains: { L: chain('L'), R: chain('R') },
			/** the root's children, bottom to top, with what each draws */
			order: this.root.children.map((ch) => `${ch === this.fire ? 'fire' : this.backdrop.includes(ch as PIXI.Sprite) ? `backdrop-${SETS[this.backdrop.indexOf(ch as PIXI.Sprite)]}` : this.fore.includes(ch as PIXI.Sprite) ? `fore-${SETS[this.fore.indexOf(ch as PIXI.Sprite)]}` : `chains-${SETS[this.sets.indexOf(ch as PIXI.Container)]}`}${ch.visible ? '' : ' (off)'}`),
			chainOrder: this.sets[0].children.map((ch) => (ch instanceof PIXI.MeshSimple ? (SIDES.some((s) => this.chains[s].hang.meshes.includes(ch)) ? 'hang' : 'swag') : 'ring')),
			counters: { vertexWrites: this.vertexWrites, slowSteps: this.slowSteps, fades: this.fades },
			textures: { backdrop: [this.backdrop[0].texture.width, this.backdrop[0].texture.height], fire: [this.fire.texture.width, this.fire.texture.height], atlas: [this.chains.L.ring[0].texture.source.pixelWidth, this.chains.L.ring[0].texture.source.pixelHeight] },
		};
	}
}
