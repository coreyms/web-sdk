// THE COURTYARD SCENE: raw Pixi in one container, in px of the scene's own frame (game/sceneSpec.ts;
// components/Background.svelte cover-fits it to the canvas). There are TWO scenes, one SceneView each: 'landscape'
// (2560 x 1440, the landscape and phone sideways layouts) and 'portrait' (1440 x 2560: backdrop, the ambient sky,
// foreground and fire pass; no flames and no chains). Back to front, the scene agent's own order:
//   backdrop day, night     the painting, opaque
//   backdrop sunset         THE SUNSET (2026-10-23, Corey: "That one works perfectly, Bonus only. Base keeps the
//                           original."): the regular Bonus's painting, between the day one and the night one. It
//                           fades in over the day backdrop and covers it; nothing else of the day set changes (the
//                           ridge cut-out, the foreground, the fire pass and the creature keep their DAY files: no
//                           relight). Its file rides the deferred phase; until it is in, the Bonus is the day.
//   THE AMBIENT SKY         both scenes (game/sky.ts, constants SKY, SKY.portrait): aurora, clouds, the ridge cut-out
//                           day and night (the backdrop's own skyline again, over the clouds), birds, bats, canyon fog
//   foreground day, night   the 3D courtyard with alpha, no fire light, no moving chains
//   foreground sunset       THE SUNSET ON THE COURTYARD (2026-10-24, constants SUNSET_FORE; landscape only): between
//                           the day and the night foreground, one WHITE sprite with a baked soft mask in its alpha,
//                           tinted the sunset's light purple x the dim, its opacity SUNSET_FORE.alpha x the sunset's
//                           own crossfade value. The Bonus only; its file rides the sunset's deferred group.
//   fire                    the braziers' light alone, on black, ADDITIVE. One pass for every mode: its level, the
//                           flicker, the EPIC red and the dim are all its tint
//   THE BRAZIER FLAMES      landscape only (game/flames.ts, constants FLAMES): the flames, their embers, and the rim
//                           occluders (the bowls' rims cut from the foreground, with the fire pass's light on them)
//                           that hide each flame's base behind its bowl
//   chains day, night       per set: swag L R (MeshSimple strips), ring L R (sprites turning about the knocker's
//                           mouth), hanging chain L R (strips)
// THE FOREGROUND CONTAINER (constants FOREGROUND_KICK): everything from "foreground day" down this list is in ONE
// container, `SceneView.foreground`, over the sky. A board kick shoves that container and nothing else (the same
// offset as the board, the same frame: featureFx.shoveForeground), and it is drawn a little oversize about the
// frame's centre so the shove never shows an edge. The backdrops and the sky's layers are the root's own children
// and never move. THE CREATURE (game/creature.ts, constants CREATURE) is in it with his shadow; his body is always in
// `frontForeground`, the foreground's twin in a second root, laid by the same call from the same numbers (see `front`):
// that root goes on the stage over the canvas logo, behind the board or in front of it (2026-10-13).
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
//   a gust             (CHAIN_GUST) the air of a drop-in: featureFx.gustFx's half-sine pulses, sceneLagMs after the
//                      board's own chains lean, lagged like the kick and SIGNED per side (each chain leans away from
//                      the landing), added to the kick's drive on the hanging chains and the swags
// House rules: no filters, no texture is created or uploaded after the files land, dims and tints are sprite
// tints, and a tick allocates nothing: the strips rewrite the vertex arrays their meshes already own.
import * as PIXI from 'pixi.js';

import { CHAIN_GUST, FLAMES, PLAYGROUND_PX, SCENE, SKY, SUNSET_FORE } from './constants';
import { boardKick, gustFx, gustPulse, gustStart, type ChainGust } from './featureFx';
import { SCENE_SPEC, SCENE_SPEC_PORTRAIT } from './sceneSpec';
import { FLAME_CLIPS, FlameView } from './flames';
import { SkyView } from './sky';

export type SceneFamily = keyof typeof SCENE.modes;
export type SceneTier = keyof typeof SCENE_SPEC.tiers;
/** 'landscape' is the 16:9 scene of the landscape and phone sideways layouts, 'portrait' the 9:16 one */
export type SceneLayout = keyof typeof SCENE.fire;
type Textures = Record<string, PIXI.Texture | undefined>;
type Terms = readonly (readonly number[])[];

const SIDES = ['L', 'R'] as const;
const SETS = ['day', 'night'] as const;
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
// the ambient sky's (SKY.modes): the clouds' tint r g b and opacity, the fog's, the birds' share, the bats' share, the aurora's level
const CLOUD_TINT = 12;
const CLOUD_A = 15;
const FOG_TINT = 16;
const FOG_A = 19;
const BIRDS = 20;
const BATS = 21;
const AURORA = 22;
// the brazier flames' (FLAMES): the embers' strength and tint r g b, and each clip's weight (base, super, epic)
const EMBERS = 23;
const EMBER_TINT = 24;
const FLAME_W = 27;
// THE SUNSET backdrop's opacity over the day one (SCENE.modes[family].sunset; 0 while its file is on its way)
const SUNSET = 30;
// THE SUNSET ON THE COURTYARD's share (SUNSET_FORE): the sunset's own value, but 0 until its overlay is in too, so an
// overlay that lands after the backdrop fades in by itself over SCENE.crossfadeMs
const SUNSET_FORE_V = 31;
const VALUES = 32;
/** SUNSET_FORE.color, 0 .. 1 */
const SF_COLOR = SUNSET_FORE.color.map((v) => v / 255);

/** THE LIGHT THE BOARD FRAME TAKES (components/BoardFrame.svelte, constants FRAME_RELIGHT): what the scene on screen
 *  draws this frame. `night` 0 .. 1 is the night layers' opacity (0 while the night files are on their way), `fire`
 *  the fire pass's level after the flicker and before the dim, `fireR/G/B` and `foreR/G/B` the mode's two tints, all
 *  mid crossfade when the scene is. components/Background.svelte writes it from the scene it ticks and clears it when
 *  no scene is drawn, so the frame stays in its day light then. */
export const sceneLight = { night: 0, fire: 0, fireR: 1, fireG: 1, fireB: 1, foreR: 1, foreG: 1, foreB: 1 };
export const clearSceneLight = (): void => {
	sceneLight.night = sceneLight.fire = 0;
	sceneLight.fireR = sceneLight.fireG = sceneLight.fireB = sceneLight.foreR = sceneLight.foreG = sceneLight.foreB = 1;
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** the creature's nodes (game/creature.ts) are guests in the foreground: the scene's own readouts leave them out */
export const isCreature = (node: PIXI.Container) => typeof node.label === 'string' && node.label.startsWith('creature-');
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
	readonly layout: SceneLayout;
	/** the frame's width, and the asset keys' prefix (scene_* / scenep_*) */
	private readonly fw: number;
	private readonly prefix: string;
	dayReady = false;
	nightReady = false;
	/** THE SUNSET backdrop is in (the regular Bonus's painting, game/assets.ts *_backdrop_sunset) */
	sunsetReady = false;
	/** THE SUNSET ON THE COURTYARD's overlay is in (game/assets.ts scene_fore_sunset; never, in portrait or when off) */
	sunsetForeReady = false;

	private readonly backdrop = SETS.map(() => new PIXI.Sprite(PIXI.Texture.EMPTY));
	/** THE SUNSET backdrop (the Bonus), drawn over the day backdrop and under the night one */
	private readonly sunset = new PIXI.Sprite(PIXI.Texture.EMPTY);
	private readonly fore = SETS.map(() => new PIXI.Sprite(PIXI.Texture.EMPTY));
	/** THE SUNSET ON THE COURTYARD (constants SUNSET_FORE): over the day foreground, under the night one. null in the
	 *  portrait scene and when SUNSET_FORE.on is false: nothing is made, loaded or drawn for it */
	private readonly sunsetFore: PIXI.Sprite | null;
	private readonly fire = new PIXI.Sprite(PIXI.Texture.EMPTY);
	private readonly sets = SETS.map(() => new PIXI.Container());
	/** THE FOREGROUND (constants FOREGROUND_KICK): the foregrounds, the fire pass, the flames' layers and the chain
	 *  sets, in frame px. The ONE thing a board kick moves in the scene; a foreground creature is added to it. */
	readonly foreground = new PIXI.Container();
	/** THE FOREGROUND AGAIN, OUTSIDE THE SCENE'S ROOT (the creature's body: constants CREATURE). `front` is this scene's
	 *  second root (components/CreatureFront.svelte puts it on the stage over the canvas logo, under the board or above
	 *  it by his layer) and takes the
	 *  root's place, scale, opacity and visibility; `frontForeground` in it takes the foreground's oversize and kick.
	 *  Both pairs are written by the same two methods from the same numbers (place, layForeground), so anything in
	 *  `frontForeground` is where it would be in `foreground`, on every frame. */
	readonly front = new PIXI.Container();
	readonly frontForeground = new PIXI.Container();
	/** the frame's height; the foreground's oversize (1 = none) and the kick it holds, canvas px */
	private readonly fh: number;
	private over = 1;
	private kickX = 0;
	private kickY = 0;
	/** the ambient sky, between the backdrops and the foregrounds (each scene its own, the atlas, birds and bats shared) */
	readonly sky: SkyView;
	/** the brazier flames (landscape only), over the fire pass and under the chains */
	readonly flames: FlameView | null;
	/** the moving pieces (landscape only): every use is behind `hasChains` */
	private readonly hasChains: boolean;
	private readonly chains: Record<'L' | 'R', Chain>;
	/** the GPU copies were let go while the other layout is showing (release); they upload again when drawn */
	released = false;

	private readonly cur = new Float64Array(VALUES);
	private readonly from = new Float64Array(VALUES);
	private readonly to = new Float64Array(VALUES);
	private readonly next = new Float64Array(VALUES);
	private fadeAt = -1;
	private family: SceneFamily = 'base';
	private wantNight = false;
	private wantSunset = false;

	/** the kick's lagged size, the ms not yet integrated, and whether any chain is still moving from a kick */
	private e = 0;
	private acc = 0;
	private moving = false;
	/** THE GUSTS (CHAIN_GUST): the pulses' sum this frame (playground px) and its lagged copy; each side's lean (-1
	 *  left, +1 right), taken when a gust starts; the bus cursor and the gusts held (running or still to start); the
	 *  clock the pulses were last read at, when the latest gust started here and that gust's own start */
	private gustRaw = 0;
	private g = 0;
	private dirL = -1;
	private dirR = 1;
	private gustSeen = 0;
	private readonly gustLive: ChainGust[] = [];
	private gustAt = 0;
	private gustStartAt = -1;
	private gustUpTo = -Infinity;
	private readonly pivotPts = { L: new PIXI.Point(), R: new PIXI.Point() };
	private readonly gp = new PIXI.Point();
	private lastSlowAt = -1e9;
	private flick = 0;
	private clock = 0;
	private level = 0;

	/** DEV / probe: the flicker signal held at this value (-1 .. 1) so two screenshots can be compared; null = running */
	holdFlicker: number | null = null;
	// DEV / probe counters
	vertexWrites = 0;
	slowSteps = 0;
	fades = 0;
	/** clips that landed into a running crossfade and joined it (setFlames) */
	joins = 0;

	constructor(layout: SceneLayout, tier: SceneTier) {
		this.layout = layout;
		this.tier = tier;
		this.hasChains = layout === 'landscape';
		this.fw = (layout === 'landscape' ? SCENE_SPEC : SCENE_SPEC_PORTRAIT).frame[0];
		this.fh = (layout === 'landscape' ? SCENE_SPEC : SCENE_SPEC_PORTRAIT).frame[1];
		this.prefix = layout === 'landscape' ? 'scene' : 'scenep';
		this.sunsetFore = layout === 'landscape' && SUNSET_FORE.on ? new PIXI.Sprite(PIXI.Texture.EMPTY) : null;
		const root = this.root;
		root.label = layout === 'landscape' ? 'scene' : 'scene-portrait';
		root.visible = false;
		root.eventMode = 'none';
		root.interactiveChildren = false;
		this.fire.blendMode = 'add';
		this.sky = new SkyView(layout);
		this.flames = layout === 'landscape' ? new FlameView(tier) : null;
		root.addChild(this.backdrop[0], this.sunset, this.backdrop[1]);
		root.addChild(...this.sky.layers);
		// the foreground container: foregrounds, fire pass, flames, then (below) the chain sets.
		// THE CREATURE JOINS HERE (components/Background.svelte attaches game/creature.ts's two nodes to the scene of the
		// current layout, over the chains): frame px like everything in it, and the board's kick moves him with the floor.
		const fg = this.foreground;
		fg.label = 'scene-foreground';
		root.addChild(fg);
		this.front.label = layout === 'landscape' ? 'scene-front' : 'scene-portrait-front';
		this.frontForeground.label = 'scene-front-foreground';
		this.front.visible = false;
		// (passive: the twin root and its foreground take no pointer themselves; the creature's body node in it can, the
		// poke, game/creature.ts: it is 'static' only while a poke can be taken, and its sprites are never hit tested)
		this.front.eventMode = 'passive';
		this.front.interactiveChildren = true;
		this.frontForeground.eventMode = 'passive';
		this.front.addChild(this.frontForeground);
		fg.addChild(this.fore[0]);
		if (this.sunsetFore) fg.addChild(this.sunsetFore);
		fg.addChild(this.fore[1], this.fire);
		if (this.flames) fg.addChild(...this.flames.layers);
		for (const s of [...this.backdrop, this.sunset, ...this.fore, this.fire, ...this.sets]) s.visible = false;
		if (this.sunsetFore) this.sunsetFore.visible = false;
		this.setValues(this.cur, 'base', SCENE.dim.base, false);
		// portrait: no knockers, no chains
		this.chains = this.hasChains ? this.buildChains(tier) : (null as unknown as Record<'L' | 'R', Chain>);
		if (this.hasChains) for (const side of SIDES) this.pivotPts[side].set(SCENE_SPEC.points[side].pivot[0], SCENE_SPEC.points[side].pivot[1]);
		if (this.hasChains) fg.addChild(this.sets[0], this.sets[1]);
	}

	private buildChains(tier: SceneTier): Record<'L' | 'R', Chain> {
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
		// each set's pieces in the scene agent's order (swag, ring, hanging chain), left then right
		SETS.forEach((_, i) => {
			for (const piece of SCENE_SPEC.order) {
				for (const side of SIDES) this.sets[i].addChild(piece === 'ring' ? chains[side].ring[i] : chains[side][piece].meshes[i]);
			}
		});
		return chains;
	}

	/** the day files are in (called once): backdrop, foreground, fire pass and the atlas's day frames */
	setDay(tex: Textures): boolean {
		if (this.dayReady) return true;
		const fire = tex[`${this.prefix}_fire`];
		if (!this.setLayers(0, tex) || !fire) return false;
		this.fire.texture = fire;
		this.fire.scale.set(this.fw / fire.width);
		this.sky.setDay(tex);
		this.flames?.setTextures(tex);
		this.dayReady = true;
		this.fire.visible = true;
		this.apply();
		return true;
	}

	/** the night files are in (called once); a mode that was waiting for them crossfades now */
	setNight(tex: Textures, now: number): boolean {
		if (this.nightReady) return true;
		if (!this.setLayers(1, tex)) return false;
		this.sky.setNight(tex);
		this.nightReady = true;
		if (this.wantNight) this.mode(this.family, this.to[DIM], now);
		return true;
	}

	/** THE SUNSET backdrop is in (after the day set): a Bonus that was waiting for it (the day scene stands in, as
	 *  for a night mode before the night files) crossfades to it now, over SCENE.crossfadeMs. With it, in the landscape
	 *  scene, THE SUNSET ON THE COURTYARD's overlay (SUNSET_FORE): the two ride one group, so they normally land
	 *  together and the overlay comes in with the backdrop's crossfade; one that lands later fades in by itself.
	 *  Returns true once nothing is left to come. */
	setSunset(tex: Textures, now: number): boolean {
		const want = this.sunsetFore !== null;
		if (this.sunsetReady && (!want || this.sunsetForeReady)) return true;
		let changed = false;
		const backdrop = tex[`${this.prefix}_backdrop_sunset`];
		if (!this.sunsetReady && backdrop) {
			this.sunset.texture = backdrop;
			this.sunset.scale.set(this.fw / backdrop.width);
			this.sunsetReady = changed = true;
		}
		const overlay = want ? tex.scene_fore_sunset : undefined;
		if (this.sunsetFore && !this.sunsetForeReady && overlay) {
			this.sunsetFore.texture = overlay;
			this.sunsetFore.scale.set(this.fw / overlay.width);
			this.sunsetForeReady = changed = true;
		}
		if (changed) {
			if (this.wantSunset) this.mode(this.family, this.to[DIM], now);
			else this.apply();
		}
		return this.sunsetReady && (!want || this.sunsetForeReady);
	}

	/** THE SKY's files that landed after their set did (the atlas, the birds and the bats are one copy for both scenes
	 *  and load with the scene the game booted in: a scene fetched at a turn can have its own day or night set before
	 *  the bats' sheet is in). Whatever is in `tex` now is built. Returns true once the sky has everything. */
	setSky(tex: Textures): boolean {
		const sky = this.sky;
		if (sky.complete) return true;
		if (!this.dayReady) return false;
		sky.setDay(tex);
		if (this.nightReady) sky.setNight(tex);
		this.apply();
		return sky.complete;
	}

	/** the flames' files: whatever of them is in `tex` is built (the base clip and the rim cuts come with the day set,
	 *  the super and epic clips in the deferred phase); a mode that was waiting for its clip crossfades to it now.
	 *  A clip that lands while a crossfade is running (the night one, typically) JOINS it: same start, same clock,
	 *  so the fade still ends crossfadeMs after it began and the new clip comes in at that fade's progress.
	 *  Returns true once nothing is left to come (always, for a scene with no flames). */
	setFlames(tex: Textures, now: number): boolean {
		const F = this.flames;
		if (!F) return true;
		if (!F.allReady && this.dayReady && F.setTextures(tex)) {
			if (FLAMES.modes[this.family] !== 'base' && this.to[SHOW] > 0) this.mode(this.family, this.to[DIM], now, true);
			this.apply();
		}
		return F.allReady;
	}

	private setLayers(i: number, tex: Textures): boolean {
		const set = SETS[i];
		const backdrop = tex[`${this.prefix}_backdrop_${set}`];
		const fore = tex[`${this.prefix}_fore_${set}`];
		if (!backdrop || !fore || (this.hasChains && !tex[`scene_ring_L_${set}`])) return false;
		this.backdrop[i].texture = backdrop;
		this.backdrop[i].scale.set(this.fw / backdrop.width);
		this.fore[i].texture = fore;
		this.fore[i].scale.set(this.fw / fore.width);
		if (!this.hasChains) return true;
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
		for (const s of [...this.backdrop, this.sunset, ...this.fore, this.fire, ...(this.hasChains ? this.chains.L.ring : [])]) if (s.texture !== PIXI.Texture.EMPTY) out.add(s.texture.source);
		if (this.sunsetFore && this.sunsetFore.texture !== PIXI.Texture.EMPTY) out.add(this.sunsetFore.texture.source);
		this.sky.sources(out);
		this.flames?.sources(out);
		return [...out];
	}

	/** let the GPU copies go while the other layout's scene is showing (the decoded images stay, so nothing is
	 *  downloaded or decoded again): Pixi uploads a source again the next time it is drawn. `keep`: the sources of the
	 *  scene that IS showing; what this one shares with it (the sky's atlas, the birds, the bats) stays on the GPU, it
	 *  is being drawn. Returns how many of its sources it had. */
	release(keep: readonly PIXI.TextureSource[] = []): number {
		if (this.released) return 0;
		const list = this.sources();
		for (const source of list) if (!keep.includes(source)) source.unload();
		this.released = list.length > 0;
		return list.length;
	}

	/** cover fit: the frame's top-left corner on the canvas and canvas px per frame px. `over`: the foreground's
	 *  oversize about the frame's centre (FOREGROUND_KICK; 1 = drawn at the frame's own size) */
	place(x: number, y: number, scale: number, over = 1): void {
		this.root.position.set(x, y);
		this.root.scale.set(scale);
		this.front.position.set(x, y);
		this.front.scale.set(scale);
		this.over = over;
		this.layForeground();
	}

	/** THE FOREGROUND KICK: the board's kick this frame, in CANVAS px (featureFx.shoveForeground) */
	kick(x: number, y: number): void {
		if (x === this.kickX && y === this.kickY) return;
		this.kickX = x;
		this.kickY = y;
		this.layForeground();
	}

	/** the foreground container: oversize about the frame's centre, plus the kick (canvas px to frame px) */
	private layForeground(): void {
		const k = this.root.scale.x || 1;
		const x = (this.fw * (1 - this.over)) / 2 + this.kickX / k;
		const y = (this.fh * (1 - this.over)) / 2 + this.kickY / k;
		this.foreground.scale.set(this.over);
		this.foreground.position.set(x, y);
		// the same numbers, the same call: what stands in front of the board is shoved with the floor
		this.frontForeground.scale.set(this.over);
		this.frontForeground.position.set(x, y);
	}

	/** drawn or not: the root and its twin in front of the board */
	show(on: boolean): void {
		this.root.visible = on;
		this.front.visible = on;
	}

	/** DEV / probe: where the foreground is (frame px in the root), its oversize, and the kick it holds (canvas px) */
	foregroundState() {
		const f = this.foreground;
		const k = this.root.scale.x || 1;
		const rx = (this.fw * (1 - this.over)) / 2;
		const ry = (this.fh * (1 - this.over)) / 2;
		// (the creature's two nodes are his own, game/creature.ts: not counted among the scene's layers)
		return { over: this.over, x: f.x, y: f.y, rest: { x: rx, y: ry }, kick: { x: this.kickX, y: this.kickY }, drawn: { x: (f.x - rx) * k, y: (f.y - ry) * k }, children: f.children.filter((ch) => !isCreature(ch)).length, front: { x: this.frontForeground.x, y: this.frontForeground.y, scale: this.frontForeground.scale.x, rootX: this.front.x, rootY: this.front.y, rootScale: this.front.scale.x, alpha: this.front.alpha, visible: this.front.visible } };
	}

	/** DEV / probe: the place (frame px in the root) of everything that must stay still under a kick: the root's own
	 *  children but the foreground, i.e. the backdrops and every sky layer, the fog included */
	stillLayers(): { name: string; x: number; y: number }[] {
		return this.root.children.filter((ch) => ch !== this.foreground).map((ch) => ({ name: ch.label || (ch === this.sunset ? 'backdrop-sunset' : this.backdrop.includes(ch as PIXI.Sprite) ? `backdrop-${SETS[this.backdrop.indexOf(ch as PIXI.Sprite)]}` : 'layer'), x: ch.x, y: ch.y }));
	}

	private setValues(out: Float64Array, family: SceneFamily, dim: number, show: boolean): void {
		const m = SCENE.modes[family];
		out[NIGHT] = m.night;
		out[FIRE] = SCENE.fire[this.layout][family];
		out[LO] = m.flicker[0];
		out[HI] = m.flicker[1];
		for (let i = 0; i < 3; i += 1) {
			out[FIRE_TINT + i] = m.fireTint[i];
			out[FORE_TINT + i] = m.foreTint[i];
		}
		out[DIM] = dim;
		out[SHOW] = show ? 1 : 0;
		const sky = SKY.modes[family];
		for (let i = 0; i < 3; i += 1) {
			out[CLOUD_TINT + i] = sky.clouds[i];
			out[FOG_TINT + i] = sky.fog[i];
		}
		out[CLOUD_A] = sky.cloudAlpha;
		out[FOG_A] = sky.fogAlpha;
		out[BIRDS] = sky.birds;
		out[BATS] = sky.bats;
		out[AURORA] = sky.aurora;
		// the flames: the mode's clip, or the base clip while that clip's sheet is still on its way
		const clip = this.flames?.ready(FLAMES.modes[family]) ? FLAMES.modes[family] : 'base';
		for (let i = 0; i < 3; i += 1) {
			out[FLAME_W + i] = FLAME_CLIPS[i] === clip ? 1 : 0;
			out[EMBER_TINT + i] = FLAMES.embers.tint[family][i];
		}
		out[EMBERS] = FLAMES.embers.strength[family];
		out[SUNSET] = m.sunset;
		out[SUNSET_FORE_V] = m.sunset;
	}

	/** the game's mode and dim. A night mode whose files are not in yet shows the day scene (the regular Bonus's
	 *  values, on the DAY backdrop) until setNight; the Bonus before its sunset file is in shows the day backdrop
	 *  until setSunset. `now` < 0 sets everything at once (the first show behind the loading screen). A scene
	 *  that was not showing takes the mode at once and only fades IN (over the placeholder it replaces). `join`: a
	 *  crossfade already running keeps its start and its clock and only takes the new targets (setFlames). */
	mode(family: SceneFamily, dim: number, now: number, join = false): void {
		this.family = family;
		this.wantNight = SCENE.modes[family].night > 0;
		this.wantSunset = SCENE.modes[family].sunset > 0;
		const next = this.next;
		const waiting = this.wantNight && !this.nightReady;
		this.setValues(next, waiting ? 'bonus' : family, dim, true);
		// the stand-ins are the DAY: a night mode waiting for its files keeps the day backdrop (the Bonus's warm values
		// only), and so does the Bonus until its sunset is in
		if (waiting || !this.sunsetReady) next[SUNSET] = 0;
		// THE SUNSET ON THE COURTYARD: with the sunset, and not before its own file is in either
		if (waiting || !this.sunsetReady || !this.sunsetForeReady) next[SUNSET_FORE_V] = 0;
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
		if (join && this.fadeAt >= 0) {
			// `from` and `fadeAt` stay: every value runs on from the same start, the new ones (the clip that landed)
			// from where that start had them, so it comes in at the fade's progress and ends with it
			this.to.set(next);
			this.joins += 1;
			return;
		}
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
		this.front.alpha = 0;
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
		const sunset = this.sunsetReady ? c[SUNSET] : 0;
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
		// THE SUNSET: over the day backdrop once it has started to fade in, and the day backdrop not drawn once it is
		// covered (the day foreground, fire and chains stay: they are the Bonus's too)
		this.sunset.visible = this.backdrop[0].visible && sunset > 0;
		this.sunset.alpha = sunset;
		this.sunset.tint = grey;
		if (sunset >= 1) this.backdrop[0].visible = false;
		// THE SUNSET ON THE COURTYARD: on the day foreground while the sunset is in, its opacity riding the sunset's crossfade
		const sf = this.sunsetFore;
		if (sf) {
			const k = this.sunsetForeReady ? c[SUNSET_FORE_V] : 0;
			sf.visible = this.fore[0].visible && k > 0;
			sf.alpha = k * SUNSET_FORE.alpha;
			sf.tint = rgb(dim * SF_COLOR[0], dim * SF_COLOR[1], dim * SF_COLOR[2]);
		}
		this.root.alpha = c[SHOW];
		this.front.alpha = c[SHOW];
		// the day cut-out (the ridge) goes with the day set's painting, sunrise or sunset alike
		this.sky.look(night, this.backdrop[0].visible || this.sunset.visible, this.backdrop[1].visible, dim, c[CLOUD_TINT], c[CLOUD_TINT + 1], c[CLOUD_TINT + 2], c[CLOUD_A], c[FOG_TINT], c[FOG_TINT + 1], c[FOG_TINT + 2], c[FOG_A], c[BIRDS], c[BATS], c[AURORA]);
		this.flames?.look(c[FLAME_W], c[FLAME_W + 1], c[FLAME_W + 2], night, this.fore[0].visible, this.fore[1].visible, dim, fore, c[EMBERS], c[EMBER_TINT], c[EMBER_TINT + 1], c[EMBER_TINT + 2]);
		this.applyFire();
	}

	private applyFire(): void {
		const c = this.cur;
		// never over the full pass: EPIC's band ends at 1, and the clamp holds whatever the constants say
		const level = Math.min(1, c[FIRE] * (c[LO] + ((c[HI] - c[LO]) * (1 + this.flick)) / 2));
		this.level = level;
		const k = level * c[DIM];
		this.fire.tint = rgb(k * c[FIRE_TINT], k * c[FIRE_TINT + 1], k * c[FIRE_TINT + 2]);
		// the same light on the rim cuts drawn over the flames
		this.flames?.fire(this.fire.tint);
	}

	/** this scene's light for the board frame (sceneLight), as drawn now: the scene's own night (times its fade in
	 *  over the placeholder), fire level, and tints. Nothing allocated. */
	writeLight(): void {
		const c = this.cur;
		const L = sceneLight;
		L.night = (this.nightReady ? c[NIGHT] : 0) * clamp01(c[SHOW]);
		L.fire = this.level;
		L.fireR = c[FIRE_TINT];
		L.fireG = c[FIRE_TINT + 1];
		L.fireB = c[FIRE_TINT + 2];
		L.foreR = c[FORE_TINT];
		L.foreG = c[FORE_TINT + 1];
		L.foreB = c[FORE_TINT + 2];
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
		const k = this.hasChains ? Math.abs(Math.abs(ky) >= Math.abs(kx) ? ky : kx) : 0;
		// the gusts: pending ones wait (nothing moves until one starts), a running one drives
		const gk = this.hasChains && (this.gustLive.length || gustFx.count !== this.gustSeen) ? this.tickGust(now) : 0;
		let chainsDirty = false;
		if (k > 0 || gk > 0 || this.moving) {
			this.acc += Math.min(dtMs, 100);
			const h = C.stepMs / 1000;
			const aKick = 1 - Math.exp(-C.stepMs / Math.max(C.kickLagMs, 1));
			const aLag = 1 - Math.exp(-C.stepMs / Math.max(C.hang.lagMs, 1));
			const ws = TAU / (C.swag.periodMs / 1000);
			while (this.acc >= C.stepMs) {
				this.acc -= C.stepMs;
				this.e += (k - this.e) * aKick;
				this.g += (gk - this.g) * aKick;
				for (let i = 0; i < 2; i += 1) {
					const c = this.chains[SIDES[i]];
					// the kick shoves both chains the same way; the gust leans each away from the landing
					const drive = this.e + (i === 0 ? this.dirL : this.dirR) * this.g;
					c.v += (-c.w * c.w * c.x - 2 * c.zeta * c.w * c.v + c.gain * c.w * drive * Math.max(0, 1 - Math.abs(c.x) / c.max)) * h;
					c.x += c.v * h;
					c.xl += (c.x - c.xl) * aLag;
					c.bv += (-ws * ws * c.b - 2 * C.swag.damping * ws * c.bv + c.bGain * ws * drive * Math.max(0, 1 - Math.abs(c.b) / c.bMax)) * h;
					c.b += c.bv * h;
				}
			}
			let live = k > 0 || gk > 0 || this.e > 0.01 || Math.abs(this.g) > 0.01;
			for (let i = 0; i < 2 && !live; i += 1) {
				const c = this.chains[SIDES[i]];
				live = Math.hypot(c.x, c.v / c.w) > C.restPx || Math.abs(c.xl - c.x) > C.restPx || Math.hypot(c.b, c.bv / ws) > C.restPx;
			}
			if (!live) {
				this.e = this.g = this.acc = 0;
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
			this.flick = this.holdFlicker ?? flickerAt(now);
			for (let i = 0; i < 2 && this.hasChains; i += 1) {
				const c = this.chains[SIDES[i]];
				c.idle = idleAt('hang', SIDES[i], now);
				c.bIdle = idleAt('swag', SIDES[i], now);
			}
			chainsDirty = this.hasChains;
			// the flames: their frame, and the same flicker on their brightness
			this.flames?.step(now, this.flick);
			if (!look) this.applyFire();
		}
		if (look) this.apply();
		if (chainsDirty) this.writeChains();
		this.sky.tick(now);
	}

	/** DEV / probe: the ambient sky's layers hidden or back (the look is applied again at once) */
	hideSky(on: boolean): void {
		this.sky.hide(on);
		this.apply();
	}

	/** DEV / probe: the flames' look applied again after a hook changed it (hidden, forced clip, treatment, embers) */
	refreshFlames(): void {
		if (this.flames && this.dayReady) this.apply();
	}

	/** the gusts at `now` (the ticker's clock): new ones from the bus, finished ones dropped, the direction taken when
	 *  one starts. Returns the pulses' sum, playground px. Nothing allocated (the held list only grows to its peak). */
	private tickGust(now: number): number {
		const list = gustFx.gusts;
		const fresh = Math.min(gustFx.count - this.gustSeen, list.length);
		for (let i = list.length - fresh; i < list.length; i += 1) this.gustLive.push(list[i]);
		this.gustSeen = gustFx.count;
		const lag = CHAIN_GUST.sceneLagMs;
		const live = this.gustLive;
		let p = 0;
		for (let i = live.length - 1; i >= 0; i -= 1) {
			const g = live[i];
			const start = gustStart(g, lag);
			if (now < start) continue;
			if (now >= start + CHAIN_GUST.ms) {
				live[i] = live[live.length - 1];
				live.length -= 1;
				continue;
			}
			if (start > this.gustUpTo) {
				this.gustUpTo = start;
				this.gustStartAt = now;
				this.aim(g.sourceX);
			}
			p += gustPulse(g, lag, CHAIN_GUST.unitPx.scene, now);
		}
		this.gustRaw = p;
		this.gustAt = now;
		return p;
	}

	/** each chain leans away from the landing: from the screen's centre line (null: left left, right right), or from
	 *  a canvas x (the logo), by where its knocker's mouth is on the canvas now */
	private aim(sourceX: number | null): void {
		if (sourceX === null) {
			this.dirL = -1;
			this.dirR = 1;
			return;
		}
		this.dirL = this.foreground.toGlobal(this.pivotPts.L, this.gp).x >= sourceX ? 1 : -1;
		this.dirR = this.foreground.toGlobal(this.pivotPts.R, this.gp).x >= sourceX ? 1 : -1;
	}

	/** DEV / probe: the per-frame read of tools/manticore/chain_gust_probe.js (state() is too much for every frame) */
	gustSample() {
		const side = (s: 'L' | 'R') => (this.hasChains ? { x: this.chains[s].x, b: this.chains[s].b } : { x: 0, b: 0 });
		return { at: this.gustAt, pulse: this.gustRaw, g: this.g, dirL: this.dirL, dirR: this.dirR, startAt: this.gustStartAt, live: this.gustLive.length, e: this.e, moving: this.moving, L: side('L'), R: side('R') };
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
		const sunset = this.sunsetReady ? c[SUNSET] : 0;
		const set = night >= 0.5 ? 1 : 0;
		const nameOf = (ch: PIXI.Container): string => (ch === this.fire ? 'fire' : ch === this.sunset ? 'backdrop-sunset' : ch === this.sunsetFore ? 'fore-sunset' : this.backdrop.includes(ch as PIXI.Sprite) ? `backdrop-${SETS[this.backdrop.indexOf(ch as PIXI.Sprite)]}` : this.fore.includes(ch as PIXI.Sprite) ? `fore-${SETS[this.fore.indexOf(ch as PIXI.Sprite)]}` : `chains-${SETS[this.sets.indexOf(ch as PIXI.Container)]}`);
		/** the layers bottom to top as they are drawn: the root's children, the foreground container opened out */
		const layers = this.root.children.flatMap((ch) => (ch === this.foreground ? this.foreground.children.filter((x) => !isCreature(x)) : [ch]));
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
			source: (this.layout === 'landscape' ? SCENE_SPEC : SCENE_SPEC_PORTRAIT).source,
			ready: { day: this.dayReady, night: this.nightReady, sunset: this.sunsetReady },
			family: this.family,
			/** what is drawn: 'day' / 'night', or 'fade' while one covers the other */
			scene: night <= 0 ? 'day' : night >= 1 ? 'night' : 'fade',
			night,
			waitingForNight: this.wantNight && !this.nightReady,
			/** THE SUNSET backdrop's opacity over the day one as drawn (0 while its file is on its way), and which
			 *  painting covers the screen: 'sunrise' (the day), 'sunset', 'night', or 'fade' while one covers another */
			sunset,
			waitingForSunset: this.wantSunset && !this.sunsetReady,
			/** THE SUNSET ON THE COURTYARD (SUNSET_FORE): null where the scene has none (portrait, or off). value: its share
			 *  of the sunset as drawn (0 while its file is on its way), alpha / tint as drawn, the texture's size */
			sunsetFore: this.sunsetFore
				? { on: true, ready: this.sunsetForeReady, value: this.sunsetForeReady ? c[SUNSET_FORE_V] : 0, visible: this.sunsetFore.visible, alpha: this.sunsetFore.alpha, tint: this.sunsetFore.tint, strength: SUNSET_FORE.alpha, color: [...SUNSET_FORE.color], blend: this.sunsetFore.blendMode, texture: [this.sunsetFore.texture.width, this.sunsetFore.texture.height] }
				: null,
			backdrop: night >= 1 ? 'night' : night > 0 || (sunset > 0 && sunset < 1) ? 'fade' : sunset >= 1 ? 'sunset' : 'sunrise',
			fading: this.fadeAt >= 0,
			show: c[SHOW],
			/** the fire pass: the mode's level, the band, the level drawn now (after the flicker), its tint as drawn */
			fire: { mode: c[FIRE], band: [c[FIRE] * c[LO], Math.min(1, c[FIRE] * c[HI])], level: this.level, flicker: this.flick, tint: this.fire.tint, modeTint: [c[FIRE_TINT], c[FIRE_TINT + 1], c[FIRE_TINT + 2]], blend: this.fire.blendMode },
			dim: c[DIM],
			tints: { backdrop: this.backdrop[set].tint, fore: this.fore[set].tint, chains: this.sets[set].tint, foreTint: [c[FORE_TINT], c[FORE_TINT + 1], c[FORE_TINT + 2]] },
			clock: this.clock,
			kick: { e: this.e, moving: this.moving },
			/** THE GUSTS: the lagged pulse (playground px), each side's lean, the gusts held that have not started yet */
			gust: { g: this.g, pulse: this.gustRaw, dirL: this.dirL, dirR: this.dirR, pending: this.gustLive.filter((x) => this.gustAt < gustStart(x, CHAIN_GUST.sceneLagMs)).length, live: this.gustLive.length, startAt: this.gustStartAt, at: this.gustAt },
			layout: this.layout,
			/** THE FOREGROUND KICK: the container's place, oversize and kick; what the root itself holds, bottom to top */
			foreground: this.foregroundState(),
			rootOrder: this.root.children.map((ch) => ch.label || 'sprite'),
			released: this.released,
			chains: this.hasChains ? { L: chain('L'), R: chain('R') } : null,
			/** the root's children, bottom to top, with what each draws */
			order: layers.filter((ch) => !this.sky.layers.includes(ch as PIXI.Container) && !this.flames?.layers.includes(ch as PIXI.Container)).map((ch) => `${nameOf(ch)}${ch.visible ? '' : ' (off)'}`),
			/** every child of the root, the ambient sky's and the flames' layers included, bottom to top */
			allOrder: layers.map((ch) => `${this.sky.layers.includes(ch as PIXI.Container) || this.flames?.layers.includes(ch as PIXI.Container) ? ch.label : nameOf(ch)}${ch.visible ? '' : ' (off)'}`),
			chainOrder: !this.hasChains ? [] : this.sets[0].children.map((ch) => (ch instanceof PIXI.MeshSimple ? (SIDES.some((s) => this.chains[s].hang.meshes.includes(ch)) ? 'hang' : 'swag') : 'ring')),
			counters: { vertexWrites: this.vertexWrites, slowSteps: this.slowSteps, fades: this.fades, joins: this.joins },
			textures: { backdrop: [this.backdrop[0].texture.width, this.backdrop[0].texture.height], sunset: [this.sunset.texture.width, this.sunset.texture.height], fire: [this.fire.texture.width, this.fire.texture.height], atlas: this.hasChains ? [this.chains.L.ring[0].texture.source.pixelWidth, this.chains.L.ring[0].texture.source.pixelHeight] : null },
		};
	}
}
