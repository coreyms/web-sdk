// THE AMBIENT SKY of the landscape courtyard scene (game/scene.ts owns it and its place in the layer order; constants
// SKY has every number; assets by tools/build_scene_assets.py --sky). Raw Pixi, in px of the scene's frame. Four layers
// that SceneView puts between the painted backdrop and the 3D foreground, back to front:
//   clouds   thin streaky wisps drifting one way. The Angry Mantis cloud model: each rolls one depth and takes its
//            size, speed and opacity from it, with jitter; it wraps with fresh rolls
//   ridge    the mountains and citadel skyline CUT OUT of the same backdrop (day, night), only the band of the frame
//            the skyline crosses: over the clouds, so they pass behind the peaks. With no cloud under it, it is the
//            backdrop again
//   birds    DAY ONLY. The Angry Mantis bird system: flocks of min..max in a loose V every everyMs, from either
//            side, a depth per flock choosing size, speed and the small-bird row, a flap phase and a bob per bird
//   fog      one or two soft mist bands drifting in the gorge, behind the courtyard
// The portrait scene has none of it. Everything is scenery: real time at every turbo level, never paused, nothing to
// do with spins, wins or features.
// House rules: no filters, no texture created or uploaded after the files land (a flap is a swap between resident
// frames), tints and dims are tints, and a tick allocates nothing: the clouds, the fog and the birds' pool are built
// once, a flock takes sprites from the pool and gives them back. A bird that is not flying is PARKED: transparent and
// off the frame, never hidden (a sprite's visibility is a change of the render group's structure, which Pixi answers
// by rebuilding its instructions; position, opacity and a texture of the same source are not). Positions and alphas
// are written at most every SKY.intervalMs (the birds every SKY.birds.intervalMs).
import * as PIXI from 'pixi.js';

import { SKY } from './constants';
import { SCENE_SPEC } from './sceneSpec';

type Textures = Record<string, PIXI.Texture | undefined>;
type Cloud = { s: PIXI.Sprite; v: number; t: number; k: number };
type Bird = { s: PIXI.Sprite; live: boolean; dir: number; frames: PIXI.Texture[]; v: number; y0: number; ph: number; size: number; flock: number };
type Fog = { s: PIXI.Sprite; v: number; alpha: number; y: number };
/** DEV / probe: one flock as it was rolled */
export type FlockRoll = { id: number; dir: number; depth: number; row: number; n: number; size: number; v: number; y0: number; alpha: number; x0: number };

const SETS = ['day', 'night'] as const;
const TAU = Math.PI * 2;
const FW = SCENE_SPEC.frame[0];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const jit = (share: number) => 1 + (Math.random() * 2 - 1) * share;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const rgb = (r: number, g: number, b: number) => (Math.round(clamp01(r) * 255) << 16) | (Math.round(clamp01(g) * 255) << 8) | Math.round(clamp01(b) * 255);

export class SkyView {
	readonly clouds = new PIXI.Container();
	readonly ridge = SETS.map(() => new PIXI.Sprite(PIXI.Texture.EMPTY));
	readonly birds = new PIXI.Container();
	readonly fog = new PIXI.Container();
	/** every layer, in draw order */
	readonly layers: PIXI.Container[] = [this.clouds, this.ridge[0], this.ridge[1], this.birds, this.fog];

	private readonly ridgeReady = [false, false];
	private atlasReady = false;
	private birdsReady = false;
	private readonly wisps: PIXI.Texture[] = [];
	private readonly cloudList: Cloud[] = [];
	private readonly fogList: Fog[] = [];
	private readonly birdRows: PIXI.Texture[][] = [];
	private readonly pool: Bird[] = [];
	private liveBirds = 0;

	/** the look last given by the scene: night 0 .. 1, and the birds' share (1 in the day modes) */
	private night = 0;
	private birdShare = 0;
	/** seconds: the sky's own clock, and until the next flock */
	private clock = 0;
	private nextFlock: number = SKY.birds.firstS;
	private lastAt = -1;
	private lastBirdAt = -1;

	// DEV / probe
	hidden = false;
	frozen = false;
	steps = 0;
	birdSteps = 0;
	flocks = 0;
	refused = 0;
	readonly lastFlock: FlockRoll = { id: 0, dir: 0, depth: 0.5, row: 0, n: 0, size: 0.5, v: 0.5, y0: 0.5, alpha: 0.5, x0: 0 };

	constructor() {
		const names = ['sky-clouds', 'sky-ridge-day', 'sky-ridge-night', 'sky-birds', 'sky-fog'];
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
		if (!this.birdsReady && tex['bird_0_0.png']) this.buildBirds(tex);
	}

	setNight(tex: Textures): void {
		this.setRidge(1, tex);
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
			const cloud = { s, v: 0, t: 0, k: n % this.wisps.length };
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

	private buildBirds(tex: Textures): void {
		const spec = SCENE_SPEC.sky.birds;
		for (let r = 0; r < spec.rows; r += 1) {
			const row: PIXI.Texture[] = [];
			for (let k = 0; k < spec.framesPerRow; k += 1) {
				const t = tex[`bird_${r}_${k}.png`];
				if (t) row.push(t);
			}
			if (row.length) this.birdRows.push(row);
		}
		if (!this.birdRows.length) return;
		for (let i = 0; i < SKY.birds.pool; i += 1) {
			const s = new PIXI.Sprite(this.birdRows[0][0]);
			s.anchor.set(0.5);
			s.alpha = 0;
			s.position.set(SKY.birds.parkX, SKY.birds.parkY);
			this.birds.addChild(s);
			// the fractional fields start fractional: a whole number first would make the engine reshape the record the
			// first time a flock uses it
			this.pool.push({ s, live: false, dir: 1, frames: this.birdRows[0], v: 0.5, y0: 0.5, ph: 0.5, size: 0.5, flock: 0 });
		}
		this.birdsReady = true;
	}

	/** every texture source the sky draws from (the scene's one upload, and its release) */
	sources(out: Set<PIXI.TextureSource>): void {
		for (const s of this.ridge) if (s.texture !== PIXI.Texture.EMPTY) out.add(s.texture.source);
		if (this.wisps.length) out.add(this.wisps[0].source);
		if (this.birdRows.length) out.add(this.birdRows[0][0].source);
	}

	/** (re)roll one cloud: depth drives size, speed and opacity together; y anywhere in the band, held clear of the
	 *  cut-out's lower edge (under it nothing would hide a cloud from the land) */
	private roll(c: Cloud, entering: boolean): void {
		const C = SKY.clouds;
		const spec = SCENE_SPEC.sky;
		const t = Math.random();
		c.t = t;
		c.k = Math.floor(Math.random() * this.wisps.length) % this.wisps.length;
		c.s.texture = this.wisps[c.k]; // a swap between resident frames
		const scale = (spec.wisp[0] / c.s.texture.width) * lerp(C.scale.far, C.scale.near, t) * jit(C.jitter);
		c.s.scale.set(Math.random() < 0.5 ? scale : -scale, scale);
		c.s.alpha = lerp(C.alpha.far, C.alpha.near, t);
		c.v = lerp(C.speed.far, C.speed.near, t) * jit(C.jitter);
		const halfH = (c.s.texture.height * scale) / 2;
		c.s.y = Math.min(lerp(C.band.y0, C.band.y1, Math.random()), spec.ridge[3] - halfH);
		const half = (c.s.texture.width * scale) / 2;
		// fresh clouds enter from the upwind edge; the first fill spreads them across the whole run
		c.s.x = entering ? (C.direction > 0 ? -half - Math.random() * C.lead : FW + half + Math.random() * C.lead) : -half + Math.random() * C.spread - C.lead;
		c.s.zIndex = t;
	}

	/** one flock, the Angry Mantis roll. Returns false when the pool has no room for it (it is then not sent). */
	private spawnFlock(): boolean {
		const B = SKY.birds;
		const rows = this.birdRows.length;
		const dir = Math.random() < 0.5 ? 1 : -1;
		const t = Math.random(); // depth of the whole flock
		const size = lerp(B.size.far, B.size.near, t);
		const bigRows = Math.max(1, rows - 1);
		const row = t < B.farBelow && rows > 1 ? rows - 1 : Math.floor(Math.random() * bigRows);
		const v = B.speed * lerp(B.speedByDepth[0], B.speedByDepth[1], t) * jit(B.jitter);
		const y0 = lerp(B.band.y0, B.band.y1, Math.random());
		const x0 = dir > 0 ? -B.margin : FW + B.margin;
		const n = Math.round(lerp(B.flock.min, B.flock.max, Math.random()));
		if (this.pool.length - this.liveBirds < n) {
			this.refused += 1;
			return false;
		}
		this.flocks += 1;
		const alpha = lerp(B.alpha[0], B.alpha[1], t);
		let i = 0;
		for (let p = 0; p < this.pool.length && i < n; p += 1) {
			const b = this.pool[p];
			if (b.live) continue;
			b.live = true;
			b.dir = dir;
			b.frames = this.birdRows[row];
			b.v = v;
			b.y0 = y0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * size * B.spacing.y;
			b.ph = Math.random() * 100;
			b.size = size * lerp(B.sizeJitter[0], B.sizeJitter[1], Math.random());
			b.flock = this.flocks;
			b.s.x = x0 - dir * i * size * B.spacing.x;
			b.s.y = b.y0;
			b.s.alpha = alpha;
			i += 1;
		}
		this.liveBirds += n;
		const f = this.lastFlock;
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
		b.s.position.set(SKY.birds.parkX, SKY.birds.parkY);
		this.liveBirds -= 1;
	}

	/** every bird in flight back to the pool (night; the probe between forced flocks) */
	clearBirds(): void {
		for (let i = 0; i < this.pool.length; i += 1) if (this.pool[i].live) this.drop(this.pool[i]);
	}

	/** the scene's look, on a change of mode and through its crossfade: night 0 .. 1 and which sets are drawn, the dim,
	 *  and the mode's sky values (constants SKY.modes) already blended by the same crossfade */
	look(night: number, dayOn: boolean, nightOn: boolean, dim: number, cr: number, cg: number, cb: number, cloudAlpha: number, fr: number, fg: number, fb: number, fogAlpha: number, birds: number): void {
		this.night = night;
		this.birdShare = birds;
		const show = !this.hidden;
		const grey = rgb(dim, dim, dim);
		// the cut-outs follow their backdrops exactly: same visibility, same alpha, same tint
		this.ridge[0].visible = show && dayOn && this.ridgeReady[0];
		this.ridge[1].visible = show && nightOn && this.ridgeReady[1];
		this.ridge[0].tint = this.ridge[1].tint = grey;
		this.ridge[1].alpha = night;
		// clouds only where the cut-out of every backdrop being drawn is there to hide them behind the peaks
		const covered = (!dayOn || this.ridgeReady[0]) && (!nightOn || this.ridgeReady[1]);
		this.clouds.visible = show && this.atlasReady && covered && cloudAlpha > 0;
		this.clouds.alpha = cloudAlpha;
		this.clouds.tint = rgb(dim * cr, dim * cg, dim * cb);
		this.fog.visible = show && this.atlasReady && fogAlpha > 0;
		this.fog.alpha = fogAlpha;
		this.fog.tint = rgb(dim * fr, dim * fg, dim * fb);
		this.birds.visible = show && this.birdsReady && birds > 0;
		this.birds.alpha = birds;
		this.birds.tint = grey;
		// night: whatever was in flight has faded out with the crossfade and is gone
		if (birds <= 0 && this.liveBirds > 0) this.clearBirds();
	}

	/** one frame; `now` is the ticker's clock (ms). Writes at most every SKY.intervalMs. */
	tick(now: number): void {
		if (this.frozen) {
			this.lastAt = this.lastBirdAt = now;
			return;
		}
		if (this.birdsReady && now - this.lastBirdAt >= SKY.birds.intervalMs - 3) {
			const dt = this.lastBirdAt < 0 ? 0 : Math.min(SKY.maxStepMs, now - this.lastBirdAt) / 1000;
			this.lastBirdAt = now;
			this.tickBirds(dt);
		}
		if (now - this.lastAt < SKY.intervalMs - 3) return;
		const dt = this.lastAt < 0 ? 0 : Math.min(SKY.maxStepMs, now - this.lastAt) / 1000;
		this.lastAt = now;
		this.steps += 1;
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

	/** the Angry Mantis bird tick: the flock timer (day only), then every bird's drift, bob and flap */
	private tickBirds(dt: number): void {
		const B = SKY.birds;
		this.birdSteps += 1;
		this.clock += dt;
		// none are sent until day is fully back
		if (this.birdShare >= 1) {
			this.nextFlock -= dt;
			if (this.nextFlock <= 0) {
				this.spawnFlock();
				this.nextFlock = (B.everyMs / 1000) * lerp(1 - B.spread, 1 + B.spread, Math.random());
			}
		}
		if (this.liveBirds <= 0) return;
		for (let i = 0; i < this.pool.length; i += 1) {
			const b = this.pool[i];
			if (!b.live) continue;
			b.s.x += b.dir * b.v * dt;
			if (b.dir > 0 ? b.s.x > FW + B.exit : b.s.x < -B.exit) {
				this.drop(b);
				continue;
			}
			b.s.y = b.y0 + Math.sin(this.clock * B.bobRate + b.ph) * B.bob;
			const tex = b.frames[Math.floor(this.clock * B.flapFps + b.ph) % b.frames.length];
			if (b.s.texture !== tex) b.s.texture = tex; // a swap between resident frames, never a new texture
			const sc = b.size / tex.height;
			b.s.scale.set(b.dir > 0 ? sc : -sc, sc);
		}
	}

	// ---- DEV / probe (window.__manticore.sky, components/Background.svelte) -------------------------------------
	/** hide every layer (the picture checks against the source composite compare like with like) */
	hide(on: boolean): void {
		this.hidden = on;
		if (on) for (const layer of this.layers) layer.visible = false;
	}

	/** a flock now, whatever the timer says; `false` when the birds are not in, it is night, or the pool is full */
	forceFlock(): FlockRoll | false {
		if (!this.birdsReady || this.birdShare < 1 || !this.spawnFlock()) return false;
		return { ...this.lastFlock };
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
			ready: { ridgeDay: this.ridgeReady[0], ridgeNight: this.ridgeReady[1], atlas: this.atlasReady, birds: this.birdsReady },
			hidden: this.hidden,
			frozen: this.frozen,
			night: this.night,
			layers: this.layers.map((l) => ({ name: l.label, visible: l.visible, alpha: l.alpha, tint: l.tint, children: l.children.length })),
			ridge: { box: SCENE_SPEC.sky.ridge, textures: this.ridge.map((s) => [s.texture.width, s.texture.height]), drawn: this.ridge.map((s) => [s.x, s.y, s.width, s.height]) },
			clouds: this.cloudList.map((c) => ({ ...box(c.s), depth: c.t, v: c.v, cell: c.k, scale: Math.abs(c.s.scale.x) / (SCENE_SPEC.sky.wisp[0] / c.s.texture.width) })),
			fog: this.fogList.map((f) => ({ ...box(f.s), v: f.v, base: f.alpha })),
			birds: {
				share: this.birdShare,
				live: this.liveBirds,
				pool: this.pool.length,
				nextFlockS: this.nextFlock,
				flocks: this.flocks,
				refused: this.refused,
				last: { ...this.lastFlock },
				list: this.pool.filter((b) => b.live).map((b) => ({ ...box(b.s), dir: b.dir, v: b.v, y0: b.y0, size: b.size, flock: b.flock, row: this.birdRows.indexOf(b.frames), frame: b.frames.indexOf(b.s.texture), flipped: b.s.scale.x < 0 })),
			},
			counters: { steps: this.steps, birdSteps: this.birdSteps },
			textures: { atlas: this.wisps.length ? [this.wisps[0].source.pixelWidth, this.wisps[0].source.pixelHeight] : null, birds: this.birdRows.length ? [this.birdRows[0][0].source.pixelWidth, this.birdRows[0][0].source.pixelHeight] : null },
		};
	}
}
