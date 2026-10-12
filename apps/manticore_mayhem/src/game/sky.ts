// THE AMBIENT SKY of the landscape courtyard scene (game/scene.ts owns it and its place in the layer order; constants
// SKY has every number; assets by tools/build_scene_assets.py --sky). Raw Pixi, in px of the scene's frame. Six layers
// that SceneView puts between the painted backdrop and the 3D foreground, back to front:
//   aurora   EPIC ONLY. Curtains of light behind the clouds and the peaks: each a row of additive column sprites of
//            one small gradient cell of the atlas, half a column apart, so they sum without a seam (writeAurora)
//   clouds   thin streaky wisps drifting one way. The Angry Mantis cloud model: each takes its size, speed and
//            opacity from a depth, with jitter; it wraps with fresh rolls. SKY.clouds.sets: 'two' = two separate
//            sets (cloud i is far when i is even, near when odd, for good: only the far values or only the near
//            ones), 'blended' = each rolls a depth anywhere between far and near
//   ridge    the mountains and citadel skyline CUT OUT of the same backdrop (day, night), only the band of the frame
//            the skyline crosses: over the clouds, so they pass behind the peaks. With no cloud under it, it is the
//            backdrop again
//   birds    DAY ONLY. The Angry Mantis bird system: flocks of min..max in a loose V every everyMs, from either
//            side, a depth per flock choosing size, speed and the small-bird row, a flap phase and a bob per bird
//   bats     NIGHT ONLY (SUPER, EPIC). The same flyer code with SKY.bats' numbers and the bats' own sheet (the
//            birds' rectangles, black already: only the scene's dim tints it), which lands with the scene's night
//            set: until then there are no bats (the pool is not built), never a bird's frame standing in.
//            Formation 'scattered': each bat at its own place along and across the
//            group and at its own speed, so the group drifts apart, with a flutter on top of the bob
//   fog      one or two soft mist bands drifting in the gorge, behind the courtyard
// The portrait scene has none of it. Everything is scenery: real time at every turbo level, never paused, nothing to
// do with spins, wins or features.
// House rules: no filters, no texture created or uploaded after the files land (a flap is a swap between resident
// frames), tints and dims are tints, and a tick allocates nothing: the clouds, the fog and the flyers' pools are built
// once, a flock takes sprites from the pool and gives them back. A flyer that is not flying is PARKED: transparent and
// off the frame, never hidden (a sprite's visibility is a change of the render group's structure, which Pixi answers
// by rebuilding its instructions; position, opacity and a texture of the same source are not). Positions and alphas
// are written at most every SKY.intervalMs (the birds every SKY.birds.intervalMs, the bats every SKY.bats.intervalMs).
import * as PIXI from 'pixi.js';

import { SKY } from './constants';
import { SCENE_SPEC } from './sceneSpec';

type Textures = Record<string, PIXI.Texture | undefined>;
type Cloud = { s: PIXI.Sprite; v: number; t: number; k: number; near: number; d: number };
type Bird = { s: PIXI.Sprite; live: boolean; dir: number; frames: PIXI.Texture[]; v: number; y0: number; ph: number; size: number; flock: number };
type Fog = { s: PIXI.Sprite; v: number; alpha: number; y: number };
/** DEV / probe: one flock as it was rolled */
export type FlockRoll = { id: number; dir: number; depth: number; row: number; n: number; size: number; v: number; y0: number; alpha: number; x0: number };
/** one kind of flyer's numbers: constants SKY.birds and SKY.bats */
type FlyerSpec = {
	readonly everyMs: number;
	readonly spread: number;
	readonly firstS: number;
	readonly flock: { readonly min: number; readonly max: number };
	readonly size: { readonly near: number; readonly far: number };
	readonly sizeJitter: readonly [number, number];
	readonly speed: number;
	readonly speedByDepth: readonly [number, number];
	readonly jitter: number;
	readonly alpha: readonly [number, number];
	readonly flapFps: number;
	readonly bob: number;
	readonly bobRate: number;
	readonly flutter: number;
	readonly band: { readonly y0: number; readonly y1: number };
	readonly farBelow: number;
	readonly formation: 'v' | 'scattered';
	readonly spacing: { readonly x: number; readonly y: number };
	readonly looseX: number;
	readonly looseY: number;
	readonly looseSpeed: number;
	readonly margin: number;
	readonly exit: number;
	readonly pool: number;
	readonly parkX: number;
	readonly parkY: number;
	readonly intervalMs: number;
};
export type FlyerKind = 'birds' | 'bats';

const SETS = ['day', 'night'] as const;
const TAU = Math.PI * 2;
const FW = SCENE_SPEC.frame[0];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const jit = (share: number) => 1 + (Math.random() * 2 - 1) * share;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const rgb = (r: number, g: number, b: number) => (Math.round(clamp01(r) * 255) << 16) | (Math.round(clamp01(g) * 255) << 8) | Math.round(clamp01(b) * 255);

/** one kind of flyer (the birds by day, the bats by night): its layer, its pool, its flock timer */
class Flyers {
	readonly layer = new PIXI.Container();
	ready = false;
	/** the kind's share of the scene's look: 1 in its own modes, 0 in the others, between through a crossfade */
	share = 0;
	live = 0;
	/** when it was last moved (the ticker's clock, ms) */
	lastAt = -1;
	// DEV / probe
	steps = 0;
	flocks = 0;
	refused = 0;
	readonly last: FlockRoll = { id: 0, dir: 0, depth: 0.5, row: 0, n: 0, size: 0.5, v: 0.5, y0: 0.5, alpha: 0.5, x0: 0 };

	private rows: PIXI.Texture[][] = [];
	private readonly pool: Bird[] = [];
	/** seconds: this kind's own clock, and until its next flock */
	private clock = 0;
	private nextFlock: number;

	constructor(readonly B: FlyerSpec) {
		this.nextFlock = B.firstS;
	}

	/** the pool, once, from the kind's own rows of resident frames (the birds' atlas, the bats' sheet) */
	build(rows: PIXI.Texture[][]): void {
		const B = this.B;
		this.rows = rows;
		for (let i = 0; i < B.pool; i += 1) {
			const s = new PIXI.Sprite(rows[0][0]);
			s.anchor.set(0.5);
			s.alpha = 0;
			s.position.set(B.parkX, B.parkY);
			this.layer.addChild(s);
			// the fractional fields start fractional: a whole number first would make the engine reshape the record the
			// first time a flock uses it
			this.pool.push({ s, live: false, dir: 1, frames: rows[0], v: 0.5, y0: 0.5, ph: 0.5, size: 0.5, flock: 0 });
		}
		this.ready = true;
	}

	/** one flock, the Angry Mantis roll. Returns false when the pool has no room for it (it is then not sent).
	 *  formation 'v': each flyer `spacing` x the size behind and beside the last, all at the flock's speed.
	 *  'scattered': each at a random place up to looseX behind the lead point and up to looseY above or below the
	 *  flock's height, and at the flock's speed x (1 +- looseSpeed), so the group drifts apart. */
	spawn(): boolean {
		const B = this.B;
		const rows = this.rows.length;
		const dir = Math.random() < 0.5 ? 1 : -1;
		const t = Math.random(); // depth of the whole flock
		const size = lerp(B.size.far, B.size.near, t);
		const bigRows = Math.max(1, rows - 1);
		const row = t < B.farBelow && rows > 1 ? rows - 1 : Math.floor(Math.random() * bigRows);
		const v = B.speed * lerp(B.speedByDepth[0], B.speedByDepth[1], t) * jit(B.jitter);
		const y0 = lerp(B.band.y0, B.band.y1, Math.random());
		const x0 = dir > 0 ? -B.margin : FW + B.margin;
		const n = Math.round(lerp(B.flock.min, B.flock.max, Math.random()));
		if (this.pool.length - this.live < n) {
			this.refused += 1;
			return false;
		}
		this.flocks += 1;
		const alpha = lerp(B.alpha[0], B.alpha[1], t);
		const scattered = B.formation === 'scattered';
		let i = 0;
		for (let p = 0; p < this.pool.length && i < n; p += 1) {
			const b = this.pool[p];
			if (b.live) continue;
			b.live = true;
			b.dir = dir;
			b.frames = this.rows[row];
			b.ph = Math.random() * 100;
			b.size = size * lerp(B.sizeJitter[0], B.sizeJitter[1], Math.random());
			b.flock = this.flocks;
			if (scattered) {
				b.v = v * (1 + (Math.random() * 2 - 1) * B.looseSpeed);
				b.y0 = y0 + (Math.random() * 2 - 1) * B.looseY;
				b.s.x = x0 - dir * Math.random() * B.looseX;
			} else {
				b.v = v;
				b.y0 = y0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * size * B.spacing.y;
				b.s.x = x0 - dir * i * size * B.spacing.x;
			}
			b.s.y = b.y0;
			b.s.alpha = alpha;
			i += 1;
		}
		this.live += n;
		const f = this.last;
		f.id = this.flocks;
		f.dir = dir;
		f.depth = t;
		f.row = row;
		f.n = n;
		f.size = size;
		f.v = v;
		f.y0 = y0;
		f.alpha = alpha;
		f.x0 = x0;
		return true;
	}

	private drop(b: Bird): void {
		b.live = false;
		b.s.alpha = 0;
		b.s.position.set(this.B.parkX, this.B.parkY);
		this.live -= 1;
	}

	/** every one in flight back to the pool (the other half of the day; the probe between forced flocks) */
	clear(): void {
		for (let i = 0; i < this.pool.length; i += 1) if (this.pool[i].live) this.drop(this.pool[i]);
	}

	/** the layer's look: drawn while the kind has a share, at that opacity; with no share whatever was in flight has
	 *  faded out with the crossfade and is gone */
	look(show: boolean, share: number, tint: number): void {
		this.share = share;
		this.layer.visible = show && this.ready && share > 0;
		this.layer.alpha = share;
		this.layer.tint = tint;
		if (share <= 0 && this.live > 0) this.clear();
	}

	/** the Angry Mantis bird tick: the flock timer (only at a full share), then every flyer's drift, bob and flap.
	 *  Each leaves by itself once it is `exit` px past the frame. */
	tickBirds(dt: number): void {
		const B = this.B;
		this.steps += 1;
		this.clock += dt;
		// none are sent until the kind's own half of the day is fully back
		if (this.share >= 1) {
			this.nextFlock -= dt;
			if (this.nextFlock <= 0) {
				this.spawn();
				this.nextFlock = (B.everyMs / 1000) * lerp(1 - B.spread, 1 + B.spread, Math.random());
			}
		}
		if (this.live <= 0) return;
		for (let i = 0; i < this.pool.length; i += 1) {
			const b = this.pool[i];
			if (!b.live) continue;
			b.s.x += b.dir * b.v * dt;
			if (b.dir > 0 ? b.s.x > FW + B.exit : b.s.x < -B.exit) {
				this.drop(b);
				continue;
			}
			if (B.flutter !== 0) b.s.y = b.y0 + Math.sin(this.clock * B.bobRate + b.ph) * B.bob + Math.sin(this.clock * B.bobRate * 3.1 + b.ph * 2.3) * Math.sin(this.clock * 1.7 + b.ph) * B.flutter;
			else b.s.y = b.y0 + Math.sin(this.clock * B.bobRate + b.ph) * B.bob;
			const tex = b.frames[Math.floor(this.clock * B.flapFps + b.ph) % b.frames.length];
			if (b.s.texture !== tex) b.s.texture = tex; // a swap between resident frames, never a new texture
			const sc = b.size / tex.height;
			b.s.scale.set(b.dir > 0 ? sc : -sc, sc);
		}
	}

	// ---- DEV / probe ---------------------------------------------------------------------------------------------
	/** `seconds` of this kind's own time at once in steps of `dt` (nothing is drawn in between), at a full share: the
	 *  most in flight at one time and the flocks the pool refused. The sky is left with none in flight. */
	run(seconds: number, dt: number): { seconds: number; flocks: number; refused: number; maxLive: number; pool: number } {
		const share = this.share;
		const flocks = this.flocks;
		const refused = this.refused;
		this.clear();
		this.share = 1;
		let maxLive = 0;
		for (let t = 0; t < seconds; t += dt) {
			this.tickBirds(dt);
			if (this.live > maxLive) maxLive = this.live;
		}
		this.clear();
		this.share = share;
		return { seconds, flocks: this.flocks - flocks, refused: this.refused - refused, maxLive, pool: this.pool.length };
	}

	/** which texture source this kind draws from: its label (the file's URL), the frame names' prefixes, and whether
	 *  any frame of its rows or any sprite of its pool is of another source */
	drawsFrom() {
		const source = this.rows.length ? this.rows[0][0].source : null;
		const names = new Set<string>();
		let mixed = false;
		for (const row of this.rows) {
			for (const t of row) {
				names.add(String(t.label ?? '').split('_')[0]);
				if (t.source !== source) mixed = true;
			}
		}
		for (const b of this.pool) if (b.s.texture.source !== source) mixed = true;
		return { file: source ? String(source.label ?? '') : null, uid: source ? source.uid : null, names: [...names], mixed, sprites: this.pool.length };
	}

	state() {
		return {
			share: this.share,
			live: this.live,
			pool: this.pool.length,
			nextFlockS: this.nextFlock,
			flocks: this.flocks,
			refused: this.refused,
			last: { ...this.last },
			/** slot: its place in the pool (a flyer keeps it from take-off to landing) */
			list: this.pool
				.map((b, slot) => ({ x: b.s.x, y: b.s.y, w: Math.abs(b.s.width), h: Math.abs(b.s.height), alpha: b.s.alpha, visible: b.s.visible, live: b.live, slot, dir: b.dir, v: b.v, y0: b.y0, size: b.size, flock: b.flock, row: this.rows.indexOf(b.frames), frame: b.frames.indexOf(b.s.texture), flipped: b.s.scale.x < 0 }))
				.filter((b) => b.live),
			parked: this.pool.filter((b) => !b.live).map((b) => ({ x: b.s.x, y: b.s.y, alpha: b.s.alpha, visible: b.s.visible })),
		};
	}
}

export class SkyView {
	readonly aurora = new PIXI.Container();
	readonly clouds = new PIXI.Container();
	readonly ridge = SETS.map(() => new PIXI.Sprite(PIXI.Texture.EMPTY));
	private readonly birdFlyers = new Flyers(SKY.birds);
	private readonly batFlyers = new Flyers(SKY.bats);
	readonly birds = this.birdFlyers.layer;
	readonly bats = this.batFlyers.layer;
	readonly fog = new PIXI.Container();
	/** every layer, in draw order */
	readonly layers: PIXI.Container[] = [this.aurora, this.clouds, this.ridge[0], this.ridge[1], this.birds, this.bats, this.fog];

	private readonly ridgeReady = [false, false];
	private atlasReady = false;
	private readonly wisps: PIXI.Texture[] = [];
	private readonly cloudList: Cloud[] = [];
	private readonly fogList: Fog[] = [];
	private readonly birdRows: PIXI.Texture[][] = [];
	private readonly batRows: PIXI.Texture[][] = [];
	/** the aurora's columns, curtain by curtain, left to right (SKY.aurora.columns + 1 each) */
	private readonly auroraCols: PIXI.Sprite[] = [];
	private auroraReady = false;
	private auroraCellH = 1.5;

	/** the look last given by the scene: night 0 .. 1, and the aurora's level (1 in EPIC) */
	private night = 0;
	private auroraLevel = 0;
	/** DEV / probe: the aurora's columns are left as the probe put them */
	private auroraHeld = false;
	private lastAt = -1;

	// DEV / probe
	hidden = false;
	frozen = false;
	steps = 0;

	constructor() {
		const names = ['sky-aurora', 'sky-clouds', 'sky-ridge-day', 'sky-ridge-night', 'sky-birds', 'sky-bats', 'sky-fog'];
		this.layers.forEach((layer, i) => {
			layer.label = names[i];
			layer.visible = false;
		});
		this.clouds.sortableChildren = true; // nearer clouds draw over farther ones
		const [x0, y0] = SCENE_SPEC.sky.ridge;
		for (const sprite of this.ridge) sprite.position.set(x0, y0);
	}

	/** the day files are in: the day cut-out, the wisp and fog atlas, the birds. Each part builds by itself; a part
	 *  whose file is missing is simply not drawn (the clouds never without the cut-out that hides them). */
	setDay(tex: Textures): void {
		this.setRidge(0, tex);
		if (!this.atlasReady && tex.sky_wisp_0 && tex.sky_fog_0) this.buildAtlas(tex);
		if (!this.auroraReady && tex.sky_aurora) this.buildAurora(tex.sky_aurora);
		if (!this.birdFlyers.ready && tex['bird_0_0.png']) this.buildFlyers(this.birdFlyers, this.birdRows, 'bird', tex);
	}

	/** the night files are in: the night cut-out and the bats' sheet. A sheet that is missing leaves the night without
	 *  bats (their pool is never built from the birds' frames). */
	setNight(tex: Textures): void {
		this.setRidge(1, tex);
		if (!this.batFlyers.ready && tex[`${SKY.bats.frames}_0_0.png`]) this.buildFlyers(this.batFlyers, this.batRows, SKY.bats.frames, tex);
	}

	private setRidge(i: number, tex: Textures): void {
		const texture = tex[`scene_ridge_${SETS[i]}`];
		if (!texture || this.ridgeReady[i]) return;
		this.ridge[i].texture = texture;
		this.ridge[i].scale.set((SCENE_SPEC.sky.ridge[2] - SCENE_SPEC.sky.ridge[0]) / texture.width);
		this.ridgeReady[i] = true;
	}

	private buildAtlas(tex: Textures): void {
		const spec = SCENE_SPEC.sky;
		for (let k = 0; k < spec.wisps; k += 1) {
			const t = tex[`sky_wisp_${k}`];
			if (t) this.wisps.push(t);
		}
		for (let n = 0; n < SKY.clouds.count; n += 1) {
			const s = new PIXI.Sprite(this.wisps[n % this.wisps.length]);
			s.anchor.set(0.5);
			// two sets: the even ones are the far set, the odd ones the near set, for good (23 clouds: 12 far, 11 near)
			const cloud = { s, v: 0, t: 0, k: n % this.wisps.length, near: n % 2, d: 0.5 };
			this.roll(cloud, false);
			this.clouds.addChild(s);
			this.cloudList.push(cloud);
		}
		for (const band of SKY.fog.bands) {
			const t = tex[`sky_fog_${band.cell}`];
			if (!t) continue;
			const s = new PIXI.Sprite(t);
			s.anchor.set(0.5);
			s.scale.set((spec.fog[0] / t.width) * band.scale);
			s.position.set(band.x, band.y);
			s.alpha = band.alpha;
			this.fog.addChild(s);
			this.fogList.push({ s, v: band.speed, alpha: band.alpha, y: band.y });
		}
		this.atlasReady = true;
	}

	/** the aurora's curtains, once: SKY.aurora.ribbons rows of columns + 1 sprites of the one cell, FW / columns apart
	 *  and twice that wide (the cell's alpha is a triangle across: neighbours overlap by half and sum to 1), additive,
	 *  standing on their lower edge. Their x and width never change; a write sets lower edge, height and opacity. */
	private buildAurora(cell: PIXI.Texture): void {
		const A = SKY.aurora;
		const step = FW / A.columns;
		this.auroraCellH = cell.height;
		for (let r = 0; r < A.ribbons; r += 1) {
			for (let c = 0; c <= A.columns; c += 1) {
				const s = new PIXI.Sprite(cell);
				s.anchor.set(0.5, 1);
				s.blendMode = 'add';
				s.scale.set((2 * step) / cell.width, 1.5);
				s.position.set(c * step, 0.5);
				s.alpha = 0;
				this.aurora.addChild(s);
				this.auroraCols.push(s);
			}
		}
		this.auroraReady = true;
	}

	/** every column of every curtain at `t` seconds: the playground's reference formulas (sky-playground_reference.html,
	 *  "P.aurora"). u runs 0 .. 2 pi along the frame; the numbers that multiply u and the clocks are the curtain's
	 *  shape (how many folds, streaks and swells there are along the frame and which way each drifts). */
	private writeAurora(t: number): void {
		const A = SKY.aurora;
		const n = A.columns;
		const tw = t * A.waveSpeed;
		const ts = t * A.shimmerSpeed;
		const bottom = SCENE_SPEC.sky.ridge[3];
		const cellH = this.auroraCellH;
		let i = 0;
		for (let r = 0; r < A.ribbons; r += 1) {
			const ph = r * A.ribbonPhase;
			const k = A.strength * (r ? A.further : 1);
			const y0 = A.base - r * A.spread;
			for (let c = 0; c <= n; c += 1) {
				const u = (c / n) * TAU;
				const s = this.auroraCols[i];
				i += 1;
				const yb = y0 + A.wave * (Math.sin(u * 1.3 + tw + ph) + 0.5 * Math.sin(u * 2.9 - tw * 1.7 + ph * 1.3));
				const h = A.height * (0.65 + 0.35 * Math.sin(u * 2.1 + tw * 0.6 + ph * 0.7));
				const rays = 0.5 + 0.25 * Math.sin(u * 9 + ts + ph) + 0.25 * Math.sin(u * 23 - ts * 1.6 + ph * 3);
				const swell = 0.55 + 0.45 * Math.sin(u * 0.7 + tw * 0.4 + ph * 2);
				// held clear of the cut-out's lower edge: under it nothing would hide the light from the land
				s.y = yb < bottom ? yb : bottom;
				s.scale.y = h / cellH;
				s.alpha = clamp01(k * (1 - A.shimmer + A.shimmer * rays) * swell);
			}
		}
	}

	/** one kind's rows of frames (<prefix>_<row>_<frame>.png: the bats' sheet has the birds' rows) and its pool */
	private buildFlyers(flyers: Flyers, rows: PIXI.Texture[][], prefix: string, tex: Textures): void {
		const spec = SCENE_SPEC.sky.birds;
		for (let r = 0; r < spec.rows; r += 1) {
			const row: PIXI.Texture[] = [];
			for (let k = 0; k < spec.framesPerRow; k += 1) {
				const t = tex[`${prefix}_${r}_${k}.png`];
				if (t) row.push(t);
			}
			if (row.length) rows.push(row);
		}
		if (!rows.length) return;
		flyers.build(rows);
	}

	/** every texture source the sky draws from (the scene's one upload, and its release) */
	sources(out: Set<PIXI.TextureSource>): void {
		for (const s of this.ridge) if (s.texture !== PIXI.Texture.EMPTY) out.add(s.texture.source);
		if (this.wisps.length) out.add(this.wisps[0].source);
		if (this.birdRows.length) out.add(this.birdRows[0][0].source);
		if (this.batRows.length) out.add(this.batRows[0][0].source);
	}

	/** (re)roll one cloud: its depth drives size, speed and opacity together (two sets: 0 for the far set, 1 for the
	 *  near one, the cloud's own for good; blended: the roll); y anywhere in the band, held clear of the cut-out's
	 *  lower edge (under it nothing would hide a cloud from the land) */
	private roll(c: Cloud, entering: boolean): void {
		const C = SKY.clouds;
		const spec = SCENE_SPEC.sky;
		const t = Math.random();
		const two = C.sets === 'two';
		const d = two ? c.near : t;
		c.t = t;
		c.d = d;
		c.k = Math.floor(Math.random() * this.wisps.length) % this.wisps.length;
		c.s.texture = this.wisps[c.k]; // a swap between resident frames
		const scale = (spec.wisp[0] / c.s.texture.width) * lerp(C.scale.far, C.scale.near, d) * jit(C.jitter);
		c.s.scale.set(Math.random() < 0.5 ? scale : -scale, scale);
		c.s.alpha = lerp(C.alpha.far, C.alpha.near, d);
		c.v = lerp(C.speed.far, C.speed.near, d) * jit(C.jitter);
		const halfH = (c.s.texture.height * scale) / 2;
		c.s.y = Math.min(lerp(C.band.y0, C.band.y1, Math.random()), spec.ridge[3] - halfH);
		const half = (c.s.texture.width * scale) / 2;
		// fresh clouds enter from the upwind edge; the first fill spreads them across the whole run
		c.s.x = entering ? (C.direction > 0 ? -half - Math.random() * C.lead : FW + half + Math.random() * C.lead) : -half + Math.random() * C.spread - C.lead;
		// near over far; inside a set the roll orders them
		c.s.zIndex = two ? d + t / 2 : t;
	}

	/** the scene's look, on a change of mode and through its crossfade: night 0 .. 1 and which sets are drawn, the dim,
	 *  and the mode's sky values (constants SKY.modes) already blended by the same crossfade */
	look(night: number, dayOn: boolean, nightOn: boolean, dim: number, cr: number, cg: number, cb: number, cloudAlpha: number, fr: number, fg: number, fb: number, fogAlpha: number, birds: number, bats: number, aurora: number): void {
		this.night = night;
		this.auroraLevel = aurora;
		const show = !this.hidden;
		const grey = rgb(dim, dim, dim);
		// the cut-outs follow their backdrops exactly: same visibility, same alpha, same tint
		this.ridge[0].visible = show && dayOn && this.ridgeReady[0];
		this.ridge[1].visible = show && nightOn && this.ridgeReady[1];
		this.ridge[0].tint = this.ridge[1].tint = grey;
		this.ridge[1].alpha = night;
		// clouds only where the cut-out of every backdrop being drawn is there to hide them behind the peaks
		const covered = (!dayOn || this.ridgeReady[0]) && (!nightOn || this.ridgeReady[1]);
		// the aurora the same: only behind the cut-outs, and only while it has a level (EPIC and its crossfades)
		this.aurora.visible = show && this.auroraReady && covered && aurora > 0;
		this.aurora.alpha = aurora;
		this.aurora.tint = grey;
		this.clouds.visible = show && this.atlasReady && covered && cloudAlpha > 0;
		this.clouds.alpha = cloudAlpha;
		this.clouds.tint = rgb(dim * cr, dim * cg, dim * cb);
		this.fog.visible = show && this.atlasReady && fogAlpha > 0;
		this.fog.alpha = fogAlpha;
		this.fog.tint = rgb(dim * fr, dim * fg, dim * fb);
		// night: whatever birds were in flight have faded out with the crossfade and are gone; day: the same for the bats
		this.birdFlyers.look(show, birds, grey);
		const bt = SKY.bats.tint;
		this.batFlyers.look(show, bats, rgb(dim * bt[0], dim * bt[1], dim * bt[2]));
	}

	/** one frame; `now` is the ticker's clock (ms). Writes at most every SKY.intervalMs. */
	tick(now: number): void {
		if (this.frozen) {
			this.lastAt = this.birdFlyers.lastAt = this.batFlyers.lastAt = now;
			return;
		}
		this.tickFlyers(this.birdFlyers, now);
		this.tickFlyers(this.batFlyers, now);
		if (now - this.lastAt < SKY.intervalMs - 3) return;
		const dt = this.lastAt < 0 ? 0 : Math.min(SKY.maxStepMs, now - this.lastAt) / 1000;
		this.lastAt = now;
		this.steps += 1;
		if (this.auroraReady && this.auroraLevel > 0 && !this.auroraHeld) this.writeAurora(now / 1000);
		if (!this.atlasReady) return;
		const dir = SKY.clouds.direction;
		for (let i = 0; i < this.cloudList.length; i += 1) {
			const c = this.cloudList[i];
			c.s.x += dir * c.v * dt;
			const half = Math.abs(c.s.width) / 2;
			if ((dir > 0 && c.s.x - half > FW) || (dir < 0 && c.s.x + half < 0)) this.roll(c, true);
		}
		const F = SKY.fog;
		for (let i = 0; i < this.fogList.length; i += 1) {
			const f = this.fogList[i];
			const half = Math.abs(f.s.width) / 2;
			f.s.x += f.v * dt;
			if (f.v > 0 && f.s.x - half > FW) f.s.x = -half;
			else if (f.v < 0 && f.s.x + half < 0) f.s.x = FW + half;
			const breath = Math.sin((TAU * now) / F.breathMs[i % F.breathMs.length] + i * F.breathPhase);
			f.s.alpha = f.alpha * (1 + F.breath * breath);
			f.s.y = f.y + F.bobPx * Math.sin((TAU * now) / F.bobMs + i * F.breathPhase);
		}
	}

	/** one kind of flyer, at most every `intervalMs` of its own */
	private tickFlyers(f: Flyers, now: number): void {
		if (!f.ready || now - f.lastAt < f.B.intervalMs - 3) return;
		const dt = f.lastAt < 0 ? 0 : Math.min(SKY.maxStepMs, now - f.lastAt) / 1000;
		f.lastAt = now;
		f.tickBirds(dt);
	}

	// ---- DEV / probe (window.__manticore.sky, components/Background.svelte) -------------------------------------
	/** hide every layer (the picture checks against the source composite compare like with like) */
	hide(on: boolean): void {
		this.hidden = on;
		if (on) for (const layer of this.layers) layer.visible = false;
	}

	private flyers(kind: FlyerKind): Flyers {
		return kind === 'bats' ? this.batFlyers : this.birdFlyers;
	}

	/** a flock now, whatever the timer says; `false` when the kind is not in, it is not its half of the day, or the
	 *  pool is full */
	forceFlock(kind: FlyerKind = 'birds'): FlockRoll | false {
		const f = this.flyers(kind);
		if (!f.ready || f.share < 1 || !f.spawn()) return false;
		return { ...f.last };
	}

	/** every bird (or bat) in flight back to the pool */
	clearBirds(kind: FlyerKind = 'birds'): void {
		this.flyers(kind).clear();
	}

	/** `seconds` of one kind's flock timer and flight run at once (see Flyers.run): is the pool big enough? */
	runFlyers(kind: FlyerKind, seconds: number, dt = 0.25) {
		return this.flyers(kind).run(seconds, dt);
	}

	/** the aurora held as the probe wants it (the seam test): every column of the first curtain with its lower edge at
	 *  `y`, `h` tall, at `alpha`, the other curtains dark; held until auroraFlat() with no height */
	auroraFlat(y = 0, h = 0, alpha = 1): void {
		this.auroraHeld = h > 0;
		if (!this.auroraHeld) return;
		const n = SKY.aurora.columns + 1;
		for (let i = 0; i < this.auroraCols.length; i += 1) {
			const s = this.auroraCols[i];
			s.y = y;
			s.scale.y = h / this.auroraCellH;
			s.alpha = i < n ? alpha : 0;
		}
	}

	/** one step of `dt` seconds of one kind, whatever the clock says (with the sky frozen: a flight stepped by hand) */
	stepFlyers(kind: FlyerKind, dt: number): void {
		this.flyers(kind).tickBirds(dt);
	}

	/** every cloud at a known place: cloud i at the share (i / count + phase) of its run across the frame, its own
	 *  roll kept. Run = the frame plus the cloud's half width each side. */
	cloudPhase(phase: number): void {
		const n = this.cloudList.length;
		for (let i = 0; i < n; i += 1) {
			const c = this.cloudList[i];
			const half = Math.abs(c.s.width) / 2;
			const u = (((i / n + phase) % 1) + 1) % 1;
			c.s.x = -half + u * (FW + 2 * half);
		}
	}

	/** every cloud rolled afresh across the whole run, as at the start (after the probe has moved them about) */
	rerollClouds(): void {
		for (let i = 0; i < this.cloudList.length; i += 1) this.roll(this.cloudList[i], false);
	}

	/** one cloud put where the probe wants it (frame px), at a given size and opacity */
	placeCloud(i: number, x: number, y: number, scale: number, alpha: number): void {
		const c = this.cloudList[i];
		if (!c) return;
		c.s.position.set(x, y);
		c.s.scale.set((SCENE_SPEC.sky.wisp[0] / c.s.texture.width) * scale);
		c.s.alpha = alpha;
	}

	state() {
		const box = (s: PIXI.Sprite) => ({ x: s.x, y: s.y, w: Math.abs(s.width), h: Math.abs(s.height), alpha: s.alpha, visible: s.visible });
		return {
			ready: { ridgeDay: this.ridgeReady[0], ridgeNight: this.ridgeReady[1], atlas: this.atlasReady, aurora: this.auroraReady, birds: this.birdFlyers.ready, bats: this.batFlyers.ready },
			hidden: this.hidden,
			frozen: this.frozen,
			night: this.night,
			layers: this.layers.map((l) => ({ name: l.label, visible: l.visible, alpha: l.alpha, tint: l.tint, children: l.children.length })),
			ridge: { box: SCENE_SPEC.sky.ridge, textures: this.ridge.map((s) => [s.texture.width, s.texture.height]), drawn: this.ridge.map((s) => [s.x, s.y, s.width, s.height]) },
			/** depth: what drives size, speed and opacity (two sets: 0 far, 1 near); roll: the cloud's own random roll,
			 *  new at every wrap; set: 0 far, 1 near (by the cloud's place in the list); z: its draw order */
			clouds: this.cloudList.map((c) => ({ ...box(c.s), depth: c.d, roll: c.t, set: c.near, z: c.s.zIndex, v: c.v, cell: c.k, scale: Math.abs(c.s.scale.x) / (SCENE_SPEC.sky.wisp[0] / c.s.texture.width) })),
			fog: this.fogList.map((f) => ({ ...box(f.s), v: f.v, base: f.alpha })),
			/** cols: every column, curtain by curtain: x, its lower edge y, w, h, alpha; atlas: its cell is a frame of the
			 *  wisp and fog atlas (the same source); cell: the cell's texels */
			aurora: {
				level: this.auroraLevel,
				held: this.auroraHeld,
				atlas: this.auroraCols.length > 0 && this.wisps.length > 0 && this.auroraCols[0].texture.source === this.wisps[0].source,
				cell: this.auroraCols.length ? [this.auroraCols[0].texture.width, this.auroraCols[0].texture.height] : null,
				cols: this.auroraCols.map((s) => ({ x: s.x, y: s.y, w: Math.abs(s.width), h: Math.abs(s.height), alpha: s.alpha, visible: s.visible, blend: s.blendMode })),
			},
			birds: this.birdFlyers.state(),
			bats: this.batFlyers.state(),
			counters: { steps: this.steps, birdSteps: this.birdFlyers.steps, batSteps: this.batFlyers.steps },
			textures: {
				atlas: this.wisps.length ? [this.wisps[0].source.pixelWidth, this.wisps[0].source.pixelHeight] : null,
				birds: this.birdRows.length ? [this.birdRows[0][0].source.pixelWidth, this.birdRows[0][0].source.pixelHeight] : null,
				bats: this.batRows.length ? [this.batRows[0][0].source.pixelWidth, this.batRows[0][0].source.pixelHeight] : null,
				/** which file each kind draws from: every frame of its rows AND every sprite of its pool (flying or parked)
				 *  is of this one source, or `mixed`; and the two kinds' sources are not the same one */
				flyers: { birds: this.birdFlyers.drawsFrom(), bats: this.batFlyers.drawsFrom(), shared: this.birdRows.length > 0 && this.batRows.length > 0 && this.birdRows[0][0].source === this.batRows[0][0].source },
			},
		};
	}
}
