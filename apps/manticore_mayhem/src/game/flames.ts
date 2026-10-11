// THE BRAZIER FLAMES of the landscape courtyard scene (game/scene.ts owns it and its place in the layer order; constants
// FLAMES has every number; game/flameSpec.ts the geometry; assets by tools/build_flame_assets.py). Raw Pixi, in px of the
// scene's frame. LANDSCAPE and PHONE SIDEWAYS only: the portrait scene has none of it.
// One fire in each of the two bowls, three layers that SceneView draws over the foreground and the fire light pass and
// under the chains, back to front:
//   flames   per bowl, the clip of the mode (FLAMES.modes: base in the base game and the Bonus, super, epic), its anchor
//            on the bowl's centre on the rim line. Both bowls play the SAME clip from the same textures; the right one is
//            mirrored and FLAMES.twin.phase of a loop ahead. A change of mode crossfades the two clips with the scene's own
//            crossfade (the weights are three of the scene's mode values). EPIC's red is a treatment (FLAMES.epicTint):
//            A / B a multiply tint, C the flame untinted over a red ADDITIVE copy of the same frame
//   embers   SUPER and EPIC only: a small pool of additive dots rising from each bowl, drifting, twinkling, fading
//   rims     THE RIM OCCLUDERS: the bowl's rim and body from the rim line down, cut from the foreground itself (day and
//            night, following their foreground's visibility, opacity and tint), with the fire pass's light on that cut
//            added back over it. Drawn over the flames, they hide each flame's base behind the bowl: no mask, no filter
// Light and flame agree: the scene hands over its flicker signal (the one the fire light pass pulses on) and the flame's
// brightness (a tint) and a very small breathing of its scale follow it.
// House rules: no filters, no shaders, no texture created or uploaded after the files land (a frame is a swap between
// resident textures of one sheet), tints and dims are tints, and a step allocates nothing: every sprite and the embers'
// arrays are built once. An ember that is not burning is PARKED, transparent and off the frame, never hidden (game/sky.ts
// has the reason). Written at most every FLAMES.intervalMs, on the scene's own slow step.
import * as PIXI from 'pixi.js';

import { FLAMES } from './constants';
import { FLAME_SPEC } from './flameSpec';

type Textures = Record<string, PIXI.Texture | undefined>;
export type FlameClip = keyof typeof FLAMES.clips;
export type FlameTreatment = 'A' | 'B' | 'C';

export const FLAME_CLIPS = ['base', 'super', 'epic'] as const;
const SIDES = ['L', 'R'] as const;
const SETS = ['day', 'night'] as const;
const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const rgb = (r: number, g: number, b: number) => (Math.round(clamp01(r) * 255) << 16) | (Math.round(clamp01(g) * 255) << 8) | Math.round(clamp01(b) * 255);

// an ember's numbers, EMBER_FIELDS floats each in one array per bowl
const E_AGE = 0; // s, < 0 = parked
const E_LIFE = 1;
const E_X0 = 2;
const E_Y0 = 3;
const E_RISE = 4;
const E_DRIFT = 5;
const E_SWAY_HZ = 6;
const E_SWAY_PH = 7;
const E_SIZE = 8;
const E_TW_HZ = 9;
const E_TW_PH = 10;
const EMBER_FIELDS = 11;

type Bowl = {
	/** the flame's own container, on the anchor point (mirrored on the right) */
	node: PIXI.Container;
	/** one sprite per clip, and treatment C's red copy under the epic one */
	clips: PIXI.Sprite[];
	red: PIXI.Sprite;
	/** the frame each clip shows */
	frame: Int32Array;
	rim: PIXI.Sprite[];
	rimFire: PIXI.Sprite;
	embers: PIXI.Sprite[];
	e: Float32Array;
	live: number;
	/** embers owed (a fraction carries over) */
	owed: number;
	x: number;
	y: number;
};

export class FlameView {
	readonly flames = new PIXI.Container();
	readonly embers = new PIXI.Container();
	readonly rims = new PIXI.Container();
	/** every layer, in draw order */
	readonly layers: PIXI.Container[] = [this.flames, this.embers, this.rims];

	private readonly bowls: Bowl[] = [];
	private readonly frames: PIXI.Texture[][] = FLAME_CLIPS.map(() => []);
	private readonly clipReady = [false, false, false];
	private fxReady = false;
	private emberTexture: PIXI.Texture = PIXI.Texture.EMPTY;

	/** the look last given by the scene: each clip's weight, the embers' strength, the dim */
	private readonly w = new Float64Array(3);
	private emberStrength = 0;
	private dim = 1;
	private flick = 0;
	private lastAt = -1;
	/** what the embers rise from, by the clips' weights: the flame's height and half width, frame px */
	private reachUp = 0;
	private reachSide = 0;

	treatment: FlameTreatment = FLAMES.epicTint.default;
	// DEV / probe
	hidden = false;
	embersOff = false;
	/** the embers' strength whatever the mode says (null: the mode's) */
	emberForced: number | null = null;
	forced: FlameClip | null = null;
	frozen: number | null = null;
	steps = 0;
	swaps = 0;
	spawned = 0;

	constructor(private readonly tier: 'full' | 'phone') {
		const names = ['flames', 'flame-embers', 'flame-rims'];
		this.layers.forEach((layer, i) => {
			layer.label = names[i];
			layer.visible = false;
		});
		const E = FLAMES.embers;
		SIDES.forEach((side, n) => {
			const [x, y] = FLAMES.bowls[side];
			const node = new PIXI.Container();
			node.position.set(x, y);
			if (n === 1 && FLAMES.twin.mirror) node.scale.x = -1;
			const red = new PIXI.Sprite(PIXI.Texture.EMPTY);
			red.blendMode = 'add';
			red.alpha = 0;
			node.addChild(red);
			const clips = FLAME_CLIPS.map((clip) => {
				const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
				const c = FLAMES.clips[clip];
				s.anchor.set(c.anchor[0] / c.canvas[0], c.anchor[1] / c.canvas[1]);
				s.alpha = 0;
				node.addChild(s);
				return s;
			});
			red.anchor.copyFrom(clips[2].anchor);
			this.flames.addChild(node);
			const rim = SETS.map(() => new PIXI.Sprite(PIXI.Texture.EMPTY));
			const rimFire = new PIXI.Sprite(PIXI.Texture.EMPTY);
			rimFire.blendMode = 'add';
			this.rims.addChild(rim[0], rim[1], rimFire);
			const embers: PIXI.Sprite[] = [];
			for (let i = 0; i < E.count; i += 1) {
				const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
				s.anchor.set(0.5);
				s.blendMode = 'add';
				s.alpha = 0;
				s.position.set(E.parkX, E.parkY);
				this.embers.addChild(s);
				embers.push(s);
			}
			// an age under 0 is a parked ember
			const e = new Float32Array(E.count * EMBER_FIELDS).fill(-1);
			this.bowls.push({ node, clips, red, frame: new Int32Array(3).fill(-1), rim, rimFire, embers, e, live: 0, owed: 0, x, y });
		});
	}

	/** whatever of the flames' files is in `tex` and not built yet: a clip's frames, the cuts and the ember dot. Each
	 *  builds by itself. Returns true when something new was built. */
	setTextures(tex: Textures): boolean {
		let changed = false;
		FLAME_CLIPS.forEach((clip, k) => {
			if (this.clipReady[k] || !tex[`flame_${clip}_000`]) return;
			const n = FLAMES.clips[clip].frames;
			const list: PIXI.Texture[] = [];
			for (let i = 0; i < n; i += 1) {
				const t = tex[`flame_${clip}_${String(i).padStart(3, '0')}`];
				if (t) list.push(t);
			}
			if (list.length !== n) return;
			this.frames[k] = list;
			// the canvas at this tier against the clip's own: the sheet is smaller on the phone tier
			const fit = FLAMES.clips[clip].canvas[0] / list[0].orig.width;
			for (const b of this.bowls) {
				b.clips[k].texture = list[0];
				b.clips[k].scale.set(FLAMES.clips[clip].drawScale * fit);
				if (k === 2) b.red.texture = list[0];
			}
			this.clipReady[k] = true;
			changed = true;
		});
		if (!this.fxReady && tex.flame_ember && tex.flame_rim_L_day && tex.flame_rim_R_day && tex.flame_rim_L_night && tex.flame_rim_R_night && tex.flame_rimfire_L && tex.flame_rimfire_R) {
			const spec = FLAME_SPEC.tiers[this.tier];
			SIDES.forEach((side, n) => {
				const b = this.bowls[n];
				const place = (s: PIXI.Sprite, t: PIXI.Texture, box: readonly number[]) => {
					s.texture = t;
					s.position.set(box[0], box[1]);
					s.scale.set((box[2] - box[0]) / t.width, (box[3] - box[1]) / t.height);
				};
				SETS.forEach((set, i) => place(b.rim[i], tex[`flame_rim_${side}_${set}`]!, spec.boxes[side]));
				// the light on the cut is on the fire pass's own texels (coarser, so its own box)
				place(b.rimFire, tex[`flame_rimfire_${side}`]!, spec.fireBoxes[side]);
				for (const s of b.embers) s.texture = tex.flame_ember!;
			});
			this.emberTexture = tex.flame_ember;
			this.fxReady = true;
			changed = true;
		}
		return changed;
	}

	ready(clip: FlameClip): boolean {
		return this.fxReady && this.clipReady[FLAME_CLIPS.indexOf(clip)];
	}
	get allReady(): boolean {
		return this.fxReady && this.clipReady[0] && this.clipReady[1] && this.clipReady[2];
	}

	/** every texture source the flames draw from (the scene's one upload per landing, and its release) */
	sources(out: Set<PIXI.TextureSource>): void {
		for (let k = 0; k < 3; k += 1) if (this.clipReady[k]) out.add(this.frames[k][0].source);
		if (this.fxReady) out.add(this.emberTexture.source);
	}

	/** the scene's look, on a change of mode and through its crossfade: each clip's weight (they sum to 1), which
	 *  foreground sets are drawn and the night's opacity, the dim, the foreground's tint as drawn, the embers' strength
	 *  and tint */
	look(wBase: number, wSuper: number, wEpic: number, night: number, dayOn: boolean, nightOn: boolean, dim: number, foreTint: number, emberStrength: number, er: number, eg: number, eb: number): void {
		const w = this.w;
		w[0] = wBase;
		w[1] = wSuper;
		w[2] = wEpic;
		if (this.forced) {
			const k = FLAME_CLIPS.indexOf(this.forced);
			if (this.clipReady[k]) w[0] = w[1] = w[2] = 0;
			if (this.clipReady[k]) w[k] = 1;
		}
		// never a missing flame: a clip whose sheet is not in gives its share to the base clip
		for (let k = 1; k < 3; k += 1) {
			if (this.clipReady[k]) continue;
			w[0] += w[k];
			w[k] = 0;
		}
		this.dim = dim;
		this.emberStrength = this.embersOff ? 0 : (this.emberForced ?? emberStrength);
		const on = !this.hidden && this.fxReady && this.clipReady[0];
		this.flames.visible = on;
		this.rims.visible = on;
		this.embers.visible = on && FLAMES.embers.count > 0;
		let up = 0;
		let side = 0;
		for (let k = 0; k < 3; k += 1) {
			const c = FLAMES.clips[FLAME_CLIPS[k]];
			const reach = FLAME_SPEC.clips[FLAME_CLIPS[k]].reach;
			up += w[k] * reach.upSolid * c.drawScale;
			side += (w[k] * (reach.left + reach.right) * c.drawScale) / 2;
		}
		this.reachUp = up;
		this.reachSide = side;
		const C = FLAMES.epicTint.C;
		// indexed loops throughout what runs through a crossfade or on a step: a for-of makes an iterator each time
		for (let n = 0; n < this.bowls.length; n += 1) {
			const b = this.bowls[n];
			for (let k = 0; k < 3; k += 1) b.clips[k].alpha = w[k];
			b.red.alpha = this.treatment === 'C' ? w[2] * C.alpha : 0;
			b.rim[0].visible = dayOn;
			b.rim[1].visible = nightOn;
			b.rim[1].alpha = night;
			b.rim[0].tint = b.rim[1].tint = foreTint;
		}
		const k = lerp(1, dim, FLAMES.embers.dim);
		this.embers.tint = rgb(k * er, k * eg, k * eb);
		this.paint();
	}

	/** the fire light pass's tint as the scene has just drawn it: the light on the rim cuts is the same light */
	fire(tint: number): void {
		for (let n = 0; n < this.bowls.length; n += 1) this.bowls[n].rimFire.tint = tint;
	}

	/** the flames' brightness and breathing from the flicker signal, and EPIC's treatment */
	private paint(): void {
		const F = FLAMES.flicker;
		// the flicker only ever takes light away (a tint cannot add any): full at the signal's top
		const level = lerp(1, this.dim, FLAMES.dim) * (1 - (F.dim * (1 - this.flick)) / 2);
		const plain = rgb(level, level, level);
		const T = FLAMES.epicTint;
		const t = this.treatment === 'A' ? T.A : this.treatment === 'B' ? T.B : T.C.flame;
		const epic = rgb(level * t[0], level * t[1], level * t[2]);
		const red = rgb(level * T.C.red[0], level * T.C.red[1], level * T.C.red[2]);
		const breath = 1 + F.breath * this.flick;
		for (let n = 0; n < this.bowls.length; n += 1) {
			const b = this.bowls[n];
			for (let k = 0; k < 3; k += 1) {
				if (!this.clipReady[k]) continue;
				const c = FLAMES.clips[FLAME_CLIPS[k]];
				b.clips[k].tint = k === 2 ? epic : plain;
				b.clips[k].scale.set((c.drawScale * c.canvas[0] * breath) / this.frames[k][0].orig.width);
			}
			if (this.clipReady[2]) {
				b.red.tint = red;
				b.red.scale.set(b.clips[2].scale.x * T.C.scale);
			}
		}
	}

	/** one step (the scene's slow step, at most every FLAMES.intervalMs); `now` is the ticker's clock (ms), `flick` the
	 *  scene's flicker signal, -1 .. 1 */
	step(now: number, flick: number): void {
		const dt = this.lastAt < 0 ? 0 : Math.min(FLAMES.maxStepMs, now - this.lastAt) / 1000;
		this.lastAt = now;
		// hidden (DEV / probe): nothing is drawn, so nothing is written
		if (!this.fxReady || !this.clipReady[0] || this.hidden) return;
		this.steps += 1;
		this.flick = flick;
		this.paint();
		const w = this.w;
		for (let n = 0; n < this.bowls.length; n += 1) {
			const b = this.bowls[n];
			for (let k = 0; k < 3; k += 1) {
				// a clip that is not drawn keeps its frame: nothing to write
				if (!this.clipReady[k] || w[k] <= 0) continue;
				const c = FLAMES.clips[FLAME_CLIPS[k]];
				const lead = n === 1 ? Math.round(FLAMES.twin.phase * c.frames) : 0;
				const f = ((this.frozen ?? Math.floor((now * c.fps) / 1000)) + lead) % c.frames;
				if (b.frame[k] === f) continue;
				b.frame[k] = f;
				const t = this.frames[k][f];
				b.clips[k].texture = t; // a swap between resident frames of one sheet
				if (k === 2) b.red.texture = t;
				this.swaps += 1;
			}
		}
		if (FLAMES.embers.count > 0) this.stepEmbers(dt);
	}

	private stepEmbers(dt: number): void {
		const E = FLAMES.embers;
		const strength = this.emberStrength;
		const texW = this.emberTexture.width || 1;
		for (let n = 0; n < this.bowls.length; n += 1) {
			const b = this.bowls[n];
			if (strength <= 0 && b.live <= 0) continue;
			const e = b.e;
			if (strength > 0 && this.frozen === null) {
				b.owed += (strength * dt * 1000) / E.everyMs;
				while (b.owed >= 1) {
					b.owed -= 1;
					for (let i = 0; i < E.count; i += 1) {
						const o = i * EMBER_FIELDS;
						if (e[o + E_AGE] >= 0) continue;
						e[o + E_AGE] = 0;
						e[o + E_LIFE] = lerp(E.lifeMs[0], E.lifeMs[1], Math.random()) / 1000;
						e[o + E_X0] = b.x + (Math.random() * 2 - 1) * E.spread * this.reachSide;
						e[o + E_Y0] = b.y - lerp(E.from[0], E.from[1], Math.random()) * this.reachUp;
						e[o + E_RISE] = lerp(E.rise[0], E.rise[1], Math.random());
						e[o + E_DRIFT] = (Math.random() * 2 - 1) * E.drift;
						e[o + E_SWAY_HZ] = lerp(E.sway.hz[0], E.sway.hz[1], Math.random());
						e[o + E_SWAY_PH] = Math.random() * TAU;
						e[o + E_SIZE] = lerp(E.size[0], E.size[1], Math.random());
						e[o + E_TW_HZ] = lerp(E.twinkle.hz[0], E.twinkle.hz[1], Math.random());
						e[o + E_TW_PH] = Math.random() * TAU;
						b.live += 1;
						this.spawned += 1;
						break;
					}
				}
			} else b.owed = 0;
			if (b.live <= 0) continue;
			for (let i = 0; i < E.count; i += 1) {
				const o = i * EMBER_FIELDS;
				if (e[o + E_AGE] < 0) continue;
				const s = b.embers[i];
				const age = e[o + E_AGE] + (this.frozen === null ? dt : 0);
				const u = age / e[o + E_LIFE];
				if (u >= 1) {
					e[o + E_AGE] = -1;
					s.alpha = 0;
					s.position.set(E.parkX, E.parkY);
					b.live -= 1;
					continue;
				}
				e[o + E_AGE] = age;
				// it slows as it cools: the rise eases off by `slow` over its life
				s.position.set(
					e[o + E_X0] + e[o + E_DRIFT] * age + E.sway.px * Math.sin(TAU * e[o + E_SWAY_HZ] * age + e[o + E_SWAY_PH]),
					e[o + E_Y0] - e[o + E_RISE] * age * (1 - (E.slow * u) / 2),
				);
				s.alpha = E.alpha * Math.min(1, u / E.fadeIn) * Math.pow(1 - u, E.fadePow) * (1 - E.twinkle.depth * (0.5 + 0.5 * Math.sin(TAU * e[o + E_TW_HZ] * age + e[o + E_TW_PH])));
				s.scale.set((e[o + E_SIZE] * (1 - E.shrink * u)) / texW);
			}
		}
	}

	// ---- DEV / probe (window.__manticore.flames, components/Background.svelte) ------------------------------------
	/** every ember back in the pool */
	clearEmbers(): void {
		for (const b of this.bowls) {
			for (let i = 0; i < b.embers.length; i += 1) {
				b.e[i * EMBER_FIELDS + E_AGE] = -1;
				b.embers[i].alpha = 0;
				b.embers[i].position.set(FLAMES.embers.parkX, FLAMES.embers.parkY);
			}
			b.live = 0;
			b.owed = 0;
		}
	}

	state() {
		const sprite = (s: PIXI.Sprite) => ({ alpha: s.alpha, tint: s.tint, scaleX: s.scale.x, scaleY: s.scale.y, visible: s.visible, blend: s.blendMode, w: s.texture.orig.width, h: s.texture.orig.height });
		return {
			ready: { fx: this.fxReady, base: this.clipReady[0], super: this.clipReady[1], epic: this.clipReady[2] },
			tier: this.tier,
			hidden: this.hidden,
			embersOff: this.embersOff,
			emberForced: this.emberForced,
			forced: this.forced,
			frozen: this.frozen,
			treatment: this.treatment,
			weights: { base: this.w[0], super: this.w[1], epic: this.w[2] },
			flick: this.flick,
			dim: this.dim,
			emberStrength: this.emberStrength,
			reach: { up: this.reachUp, side: this.reachSide },
			layers: this.layers.map((l) => ({ name: l.label, visible: l.visible, alpha: l.alpha, tint: l.tint, children: l.children.length })),
			bowls: SIDES.map((side, n) => {
				const b = this.bowls[n];
				return {
					side,
					x: b.node.x,
					y: b.node.y,
					mirror: b.node.scale.x < 0,
					clips: Object.fromEntries(FLAME_CLIPS.map((clip, k) => [clip, { ...sprite(b.clips[k]), frame: b.frame[k], anchor: [b.clips[k].anchor.x, b.clips[k].anchor.y] }])),
					red: sprite(b.red),
					rim: { day: { ...sprite(b.rim[0]), x: b.rim[0].x, y: b.rim[0].y, width: b.rim[0].width, height: b.rim[0].height }, night: sprite(b.rim[1]), fire: sprite(b.rimFire) },
					embers: {
						live: b.live,
						pool: b.embers.length,
						list: b.embers.map((s, i) => ({ x: s.x, y: s.y, alpha: s.alpha, size: Math.abs(s.width), age: b.e[i * EMBER_FIELDS + E_AGE], life: b.e[i * EMBER_FIELDS + E_LIFE], rise: b.e[i * EMBER_FIELDS + E_RISE], drift: b.e[i * EMBER_FIELDS + E_DRIFT], x0: b.e[i * EMBER_FIELDS + E_X0], y0: b.e[i * EMBER_FIELDS + E_Y0], blend: s.blendMode })).filter((x) => x.age >= 0),
					},
				};
			}),
			counters: { steps: this.steps, swaps: this.swaps, spawned: this.spawned },
			textures: Object.fromEntries(FLAME_CLIPS.map((clip, k) => [clip, this.clipReady[k] ? [this.frames[k][0].source.pixelWidth, this.frames[k][0].source.pixelHeight] : null])),
			fx: this.fxReady ? [this.emberTexture.source.pixelWidth, this.emberTexture.source.pixelHeight] : null,
		};
	}
}
