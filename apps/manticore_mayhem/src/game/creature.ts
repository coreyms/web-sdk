// THE MANTICORE (constants CREATURE has every number; game/creatureSpec.ts the rig's clip facts, generated;
// game/creatureAssets.ts the files; game/creatureLoad.ts fetches them; tools/build_creature_assets.py builds them).
// Raw Pixi, one instance (`creature`), drawn by the courtyard scene of the current layout (game/scene.ts).
//
// TWO NODES, ONE PLACE. `shadowNode` always lies on the floor: a child of SceneView.foreground, under the board.
// `bodyNode` (the colour sprite, a second one for a change of look, the additive charge glow) is ALWAYS a child of
// SceneView.frontForeground, the foreground's twin in a root of its own (2026-10-13: the logo is drawn in the canvas
// between the scene and him, so he cannot be inside the scene any more). CREATURE.place.<layout>.layer says which
// host on the stage that root is in: `behind` the board or in `front` of it (creatureFront below; both hosts are over
// the logo). Those two containers are laid by the same call from the same numbers
// (SceneView.layForeground: the cover fit, the oversize, the board's kick), and both nodes take their place from
// place() below, so body, shadow, floor and board move by the same offset on the same frame in either layer.
// Units inside a node: px of the rig's 1024 canvas, the feet point (col 512, feetRow) at the node's origin.
//
// STATES (CREATURE_SPEC.clips; frames are the rig's, counted from 1):
//   idle        the 54 frame loop in REAL time at every turbo level. At each loop restart one roll: snarl 1 in 20,
//               else growl 1 in 30 (plain Math.random, presentation only), and a breath sound, the two takes in turn
//   rush        an action asked for mid loop: the idle runs to its frame 1 the short way round inside rushMs (style
//               time), then the clip starts. From the loop's last / first few frames the clip starts at once
//   swipe       ANCHORED ON THE STRIKE: the wind-up is timed backwards from the moment the tears will appear (the
//               handler reads the book ahead and cues it, cueSwipe), so the hold frame lands on that moment; with
//               less lead than the wind-up needs the clip starts partway in. He holds the strike pose until the
//               board's own beat has come (+ holdMs), then returns
//   roar        one shot from the board's beat
//   sting       charge_in ONCE, then charge_loop (the crouch) for as long as stings keep coming; each strike is
//               sting_hit started strikeLead before the hit so its hold frame lands on it; between stings
//               sting_recrouch follows the hold frame and returns to charge_loop f1 (the rig's whip back, drop 4);
//               after the last sting_hit plays out to idle. THE GLOW (one additive sprite, the shared glow atlas):
//               over charge_loop it ramps 0 to 1 over a big / super charge, and a LIT strike (the big / super one)
//               keeps it at 1 from sting_hit f1 through the hold frame the hit lands on, then fades over the rig's
//               three glow frames after it (sting_hit f7..f9, or sting_recrouch f1..f3; CREATURE.glow). A normal or
//               scatter sting has no glow at all
//   snarl, growl   idle alternates in REAL time; the growl also answers a Mystery that awarded nothing
//   POKE      a tap or click on his body while he and the game are idle plays a random snarl or growl (never the
//             roar; the voice's own no repeat and rate rules), then a short cooldown; the idle roll stays quiet for a
//             while after it. His hit area (CREATURE.poke.area) is a tight polygon about his body that never covers
//             the board's opening (game/boardTap.ts boardOpening) and lies under every HTML control
// Action clips run in STYLE time (x the turbo scale), like the board effects they belong to. NOTHING WAITS FOR HIM:
// every method here returns at once, and a clip whose sheet is not in is simply not played.
//
// LOOKS: one per mode (CREATURE.looks), ONE resident. A change of mode asks for the new look (onWantLook); the old
// one keeps playing until the new one's idle sheet is uploaded, then the two cross over lookFadeMs (the outline is
// identical in every look, so nothing ghosts), then the old look is let go (onLookFree).
// A LOOK AHEAD OF ITS MODE (2026-10-14, constants CREATURE.lookLoad.early): `prepare` names the look of a feature that is
// coming (game/creatureLoad.ts: a book with one in it, or a buy armed). The loader starts it at once; he does NOT change
// to it (only the mode does that, as before), and `uses` keeps it from being let go until the mode asks for it (then
// it is simply the wanted look, its idle sheet in already) or nothing names it any more.
// WHO HOLDS WHAT (2026-10-13; a look that is let go is DESTROYED by the loader, and a sprite drawn with a destroyed
// texture throws inside Pixi's render, which stops Pixi's ticker): the lower colour sprite only ever holds a frame of
// `look`, the upper one a frame of `next`, and three things keep it so:
//   endFade   hands the upper sprite's texture to the lower one BEFORE it lets the old look go, whatever he is doing
//   fireable  an action is checked against the look(s) being drawn when it STARTS, not only when it was cued: a cue
//             made under the old look can come due during the crossfade or after it, when the look that has to draw
//             it has no sheet for it yet (its attacks land after its idle sheet). Then it is not played
//   forget    takes a look's textures off the sprites as well as out of the tables (counters.rescued: never needed
//             in any run, and the probe holds it to 0)
// House rules: no filters, shaders or masks; a frame is a swap between resident textures; a tick allocates nothing.
import * as PIXI from 'pixi.js';

import { CREATURE, CREATURE_LIFT, type CreatureSpot } from './constants';
import { CREATURE_SPEC } from './creatureSpec';
import { CREATURE_CLIPS, type CreatureClip, type CreatureLook } from './creatureAssets';

type Frames = PIXI.Texture[];
type CueKind = 'swipe' | 'roar' | 'charge' | 'growl';
type PokeClip = 'snarl' | 'growl';
type StingKind = 'normal' | 'big' | 'super' | 'scatter';
export type CreatureLayer = 'front' | 'behind';
/** shadow: false = no floor shadow in this spot (where his feet are behind the board, off the floor: constants CREATURE.place) */
export type CreaturePlace = { x: number; y: number; scale: number; layer: CreatureLayer; shadow?: boolean };

/** WHERE HE STANDS for a spot and the canvas's shape (width / height). Every spot is its CREATURE.place entry, but the
 *  desktop one: place.desktop at CREATURE.desktopWide.aspect (16:9) and wider, and below it the straight line through
 *  that and CREATURE.desktopTall (16:10), held at CREATURE.desktopMinAspect (4:3): the feet point and the scale; the
 *  layer is the spot's */
export const creaturePlaceFor = (spot: CreatureSpot, aspect: number): CreaturePlace => {
	const p: CreaturePlace = CREATURE.place[spot];
	if (spot !== 'desktop' || aspect >= CREATURE.desktopWide.aspect) return p;
	const T = CREATURE.desktopTall;
	const t = (Math.max(aspect, CREATURE.desktopMinAspect) - T.aspect) / (CREATURE.desktopWide.aspect - T.aspect);
	const lerp = (a: number, b: number) => a + (b - a) * t;
	return { ...p, x: lerp(T.x, p.x), y: lerp(T.y, p.y), scale: lerp(T.scale, p.scale) };
};
/** what the creature needs from the game (components/Background.svelte hands it over; this file imports no state) */
export type CreatureEnv = {
	ts: () => number;
	skipping: () => boolean;
	play: (name: string, rate?: number) => void;
	stop: (name: string) => void;
	/** the game is idle between rounds (a poke is taken only then, like Angry Mantis's) */
	idle: () => boolean;
	/** a canvas point is on the board's opening (a poke never takes a board tap) */
	board: (x: number, y: number) => boolean;
};

const SPEC = CREATURE_SPEC;
const FPS = SPEC.fps;
const FRAME_MS = 1000 / FPS;
const N = Object.fromEntries(CREATURE_CLIPS.map((c) => [c, SPEC.clips[c].frames])) as Record<CreatureClip, number>;
const HOLD: Partial<Record<CreatureClip, number>> = { swipe: SPEC.clips.swipe.holdFrame, sting_hit: SPEC.clips.sting_hit.holdFrame };
/** clip ms from a clip's first frame to the start of its hold frame */
const WINDUP = { swipe: (SPEC.clips.swipe.holdFrame - 1) * FRAME_MS, sting_hit: (SPEC.clips.sting_hit.holdFrame - 1) * FRAME_MS };
const CHARGE_IN_MS = N.charge_in * FRAME_MS;
const REAL_CLIPS: readonly CreatureClip[] = ['snarl', 'growl'];
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

type Run = {
	clip: CreatureClip;
	/** clip ms since its first frame (30 fps), the hold not counted */
	t: number;
	/** the frame last drawn, from 1 */
	frame: number;
	/** the hold: 0 not reached, 1 holding, 2 done; style ms held so far */
	hold: 0 | 1 | 2;
	held: number;
	/** swipe only: the real time its frame 1 was due and the real time the hold frame must land on (the wind-up is
	 *  spread between the two), and when the board's own beat came (0: not yet) */
	startAt: number;
	strikeAt: number;
	beatAt: number;
	/** sting_hit only: back to the crouch after the strike (another sting follows) */
	toCrouch: boolean;
	/** sting_hit and sting_recrouch: the strike is a LIT one (a big / super sting) and its glow frames are in */
	lit: boolean;
	/** it was started early by a cue and the board's beat has not confirmed it yet */
	cued: boolean;
};

export class Creature {
	readonly shadowNode = new PIXI.Container();
	readonly bodyNode = new PIXI.Container();
	private readonly shadow = new PIXI.Sprite(PIXI.Texture.EMPTY);
	/** [0] the look on show, [1] the look fading in over it */
	private readonly colour = [new PIXI.Sprite(PIXI.Texture.EMPTY), new PIXI.Sprite(PIXI.Texture.EMPTY)];
	private readonly glow = new PIXI.Sprite(PIXI.Texture.EMPTY);
	/** THE NIGHT LIFT (constants CREATURE_LIFT, Corey 2026-10-16 "1. Yes", interim): an additive copy of each colour
	 *  sprite's frame, over it, in the night and fire looks only (syncLift). Same textures: nothing created or uploaded */
	private readonly lift = [new PIXI.Sprite(PIXI.Texture.EMPTY), new PIXI.Sprite(PIXI.Texture.EMPTY)];

	env: CreatureEnv = { ts: () => 1, skipping: () => false, play: () => {}, stop: () => {}, idle: () => false, board: () => false };
	/** the loader's two hooks: a look is wanted (load its idle sheet first), a look is no longer drawn (let it go) */
	onWantLook: ((look: CreatureLook) => void) | null = null;
	onLookFree: ((look: CreatureLook) => void) | null = null;
	/** ...and a look is the one on show (the first one, or the crossover to it is over) */
	onLookOn: ((look: CreatureLook) => void) | null = null;

	// ---- the textures (resident; arrays by frame, built once per sheet) ----
	private readonly looks: Partial<Record<CreatureLook, Partial<Record<CreatureClip, Frames>>>> = {};
	private readonly shadows: Partial<Record<CreatureClip, Frames>> = {};
	private glowFrames: Frames | null = null;
	/** the glow that stays on the tail through a lit strike: over sting_hit f1..f9 and sting_recrouch f1..f3 */
	private readonly glowOver: { sting_hit: Frames | null; sting_recrouch: Frames | null } = { sting_hit: null, sting_recrouch: null };

	// ---- the look ----
	/** the look on show (null: nothing yet), the one fading in, and the one the mode asks for */
	look: CreatureLook | null = null;
	private next: CreatureLook | null = null;
	private want: CreatureLook = CREATURE.looks.base;
	/** the look of a feature that is coming, by what said so (the round's book, an armed buy): loaded ahead, not shown */
	private readonly ahead: { book: CreatureLook | null; buy: CreatureLook | null } = { book: null, buy: null };
	private fadeAt = -1;
	private appearAt = -1;
	private shown = 0;
	/** the fade in after the landing screen: ms of it done (-1: none). Stepped, not read off the clock (constants) */
	private unveilMs = -1;
	/** DEV A / B and the layouts that hide him */
	enabled: boolean = CREATURE.on;
	private placed = false;
	/** the landing screen is up (veil): not drawn, no action, no sound; his sheets load all the same */
	private veiled = false;

	// ---- the state machine ----
	private state: 'hidden' | 'idle' | 'rush' | 'clip' | 'crouch' = 'hidden';
	private idleT0 = 0;
	private idleFrame = 1;
	private run: Run = { clip: 'idle', t: 0, frame: 1, hold: 0, held: 0, startAt: 0, strikeAt: 0, beatAt: 0, toCrouch: false, lit: false, cued: false };
	private rush = { from: 1, to: 1, t0: 0 };
	/** what starts when the rush ends, or at `at` (real ms: the clip's first frame). strikeAt: swipe only */
	private cue: { kind: CueKind; at: number; strikeAt: number; ahead?: boolean } | null = null;
	/** a swipe read ahead while a sting is still his to play: it becomes the cue once that strike has landed */
	private swipeNext: { at: number; strikeAt: number } | null = null;
	/** the crouch: its loop clock (clip ms), whether stings are still coming, the strike that is planned (the real time
	 *  sting_hit must START, and whether another sting follows it), when a beat last came, the glow's ramp */
	private crouchT = 0;
	/** the crouch loop's clock rate: 1, or a little off it before a lit strike (aimCrouch) */
	private crouchRate = 1;
	private stinging = false;
	private hit: { start: number; more: boolean; lit: boolean } | null = null;
	private lastBeat = 0;
	private glowT0 = 0;
	private glowT1 = 0;
	private glowA = 0;
	private last = -1;
	private breathTake = 0;
	/** the take the snarl and the growl last used (0 = none yet): the next play takes the other one */
	private voiceTake = { snarl: 0, growl: 0 };
	private breathOn: string | null = null;
	private drawnClip: CreatureClip = 'idle';
	private drawnFrame = 0;
	/** the glow's frame set and frame on show (DEV / probe) */
	private glowClip: CreatureClip | null = null;
	private glowFrame = 0;

	// ---- the poke (CREATURE.poke) ----
	/** his body's hit area, px of the rig's canvas about the feet point (the body node's own units) */
	private readonly pokePoly = new PIXI.Polygon(CREATURE.poke.area as unknown as number[]);
	private readonly pokePt = new PIXI.Point();
	/** real ms: no poke is taken before pokeReadyAt, and the idle roll is quiet until rollQuietUntil */
	private pokeReadyAt = 0;
	private rollQuietUntil = 0;
	private pokeOn = false;

	// ---- DEV / probe ----
	readonly log: { t: number; what: string; clip?: string; frame?: number; info?: unknown }[] = [];
	counters = { swaps: 0, ticks: 0, rolls: 0, snarls: 0, growls: 0, skipped: 0, rescued: 0, sounds: 0, pokes: 0, pokeRefused: 0 };
	/** DEV: the roll's two draws (null: Math.random) so a probe can force an alternate */
	forceRoll: 'snarl' | 'growl' | 'none' | null = null;
	/** the crouch phase before a lit strike (constants CREATURE.glowPhase; DEV A / B) */
	glowPhase: boolean = CREATURE.glowPhase;

	constructor() {
		this.shadowNode.label = 'creature-shadow';
		this.bodyNode.label = 'creature-body';
		for (const node of [this.shadowNode, this.bodyNode]) {
			node.visible = false;
			node.eventMode = 'none';
			node.interactiveChildren = false;
		}
		const ay = SPEC.feetRow / SPEC.canvas[1];
		const ax = SPEC.feetCol / SPEC.canvas[0];
		for (const s of [this.shadow, ...this.colour, ...this.lift, this.glow]) s.anchor.set(ax, ay);
		this.glow.blendMode = 'add';
		for (const s of this.lift) {
			s.blendMode = 'add';
			s.visible = false;
		}
		this.glow.visible = false;
		this.colour[1].visible = false;
		this.shadow.alpha = CREATURE.shadowAlpha;
		this.shadowNode.addChild(this.shadow);
		// each lift right over its own colour sprite, so the look crossfade covers the old look's lift with the new one
		this.bodyNode.addChild(this.colour[0], this.lift[0], this.colour[1], this.lift[1], this.glow);
		// THE POKE: the body node itself is the target (eventMode 'static' only while a poke can be taken, tick());
		// its sprites are never hit tested (interactiveChildren stays false), only this polygon, minus the board
		this.bodyNode.cursor = 'pointer';
		this.bodyNode.hitArea = {
			contains: (x: number, y: number) => {
				if (!this.pokePoly.contains(x, y)) return false;
				const g = this.bodyNode.toGlobal({ x, y }, this.pokePt);
				return !this.env.board(g.x, g.y);
			},
		};
		this.bodyNode.onpointertap = () => this.poke(performance.now());
	}

	private note(what: string, info?: unknown): void {
		if (!import.meta.env.DEV) return;
		this.log.push({ t: performance.now(), what, clip: this.state === 'idle' || this.state === 'rush' ? 'idle' : this.state === 'crouch' ? 'charge_loop' : this.run.clip, frame: this.drawnFrame, info });
		if (this.log.length > 1500) this.log.splice(0, 500);
	}

	// ---- placement (components/Background.svelte: the layout's spot, or null where he is not drawn) ----
	/** ONE source of truth for where he stands: both nodes are written here and nowhere else */
	place(p: CreaturePlace | null): void {
		this.placed = !!p;
		if (!p) return;
		this.shadowNode.position.set(p.x, p.y);
		this.bodyNode.position.set(p.x, p.y);
		this.shadowNode.scale.set(p.scale);
		this.bodyNode.scale.set(p.scale);
		// the sprite, not the node: the node's visibility is the veil's and the layout's (tick)
		this.shadow.visible = p.shadow !== false;
	}

	/** THE LANDING SCREEN is up (true) or has gone (components/Background.svelte). While it is up he is not drawn and
	 *  silent, like a layout that hides him; when it goes he fades in over CREATURE.landingFadeMs from the first frame
	 *  of his idle loop. Nothing waits for it and his sheets load as ever */
	veil(on: boolean, now: number = performance.now()): void {
		if (on === this.veiled) return;
		this.veiled = on;
		if (on || !this.look) return;
		this.appearAt = -1;
		this.unveilMs = 0;
		this.shown = 0;
		this.idleT0 = now;
		this.idleFrame = 1;
		this.note('unveil');
	}

	// ---- the files (game/creatureLoad.ts) ----
	/** a sheet's frames by name, in order; null when one is missing */
	private static frames(tex: Record<string, PIXI.Texture>, prefix: string, n: number): Frames | null {
		const out: Frames = [];
		for (let i = 0; i < n; i += 1) {
			const t = tex[`${prefix}_${String(i).padStart(3, '0')}`];
			if (!t) return null;
			out.push(t);
		}
		return out;
	}
	/** the shadow atlas (every clip) or the glow atlas */
	setShared(kind: 'shadow' | 'glow', tex: Record<string, PIXI.Texture>): boolean {
		if (kind === 'glow') {
			this.glowFrames = Creature.frames(tex, SPEC.glow.charge_glow, SPEC.clips.charge_glow.frames);
			if (this.glowFrames) this.glow.scale.set(SPEC.canvas[0] / this.glowFrames[0].orig.width);
			// the lit strike's frames (the glow add-on; an atlas without them leaves the strike unlit, as before)
			this.glowOver.sting_hit = Creature.frames(tex, SPEC.glow.sting_hit_glow, SPEC.clips.sting_hit_glow.frames);
			this.glowOver.sting_recrouch = Creature.frames(tex, SPEC.glow.sting_recrouch_glow, SPEC.clips.sting_recrouch_glow.frames);
			return !!this.glowFrames;
		}
		for (const clip of CREATURE_CLIPS) {
			const f = Creature.frames(tex, `creature_shadow_${clip}`, N[clip]);
			if (!f) return false;
			this.shadows[clip] = f;
		}
		this.shadow.scale.set(SPEC.canvas[0] / this.shadows.idle![0].orig.width);
		return true;
	}
	/** one clip of one look is in (already uploaded) */
	setClip(look: CreatureLook, clip: CreatureClip, tex: Record<string, PIXI.Texture>): boolean {
		const f = Creature.frames(tex, `creature_${look}_${clip}`, N[clip]);
		if (!f) return false;
		(this.looks[look] ??= {})[clip] = f;
		this.note('sheet', { look, clip });
		return true;
	}
	/** a look's textures are about to be destroyed: forget them, and make sure no sprite is left holding one (the
	 *  callers have already seen to that: see WHO HOLDS WHAT in the header; `rescued` counts the times they had not) */
	forget(look: CreatureLook): void {
		const sheets = this.looks[look];
		if (!sheets) return;
		delete this.looks[look];
		for (const sprite of this.colour) {
			const source = sprite.texture === PIXI.Texture.EMPTY ? null : sprite.texture.source;
			if (!source) continue;
			for (const clip of CREATURE_CLIPS) {
				if (sheets[clip]?.[0].source !== source) continue;
				sprite.texture = PIXI.Texture.EMPTY;
				this.drawnFrame = 0; // whatever look is on show draws its frame again on the next tick
				this.counters.rescued += 1;
				this.note('rescued', { look, clip });
				break;
			}
		}
	}
	/** he draws this look now, is crossing over to it, or the mode asks for it: the loader must not let it go */
	uses(look: CreatureLook): boolean {
		return look === this.look || look === this.next || look === this.want || look === this.prepared;
	}
	has(look: CreatureLook, clip: CreatureClip): boolean {
		return !!this.looks[look]?.[clip];
	}
	/** every texture source he draws from now (probe: the GPU bytes) */
	sources(): { name: string; source: PIXI.TextureSource }[] {
		const out: { name: string; source: PIXI.TextureSource }[] = [];
		if (this.shadows.idle) out.push({ name: 'shared/shadow', source: this.shadows.idle[0].source });
		if (this.glowFrames) out.push({ name: 'shared/glow', source: this.glowFrames[0].source });
		for (const look of Object.keys(this.looks) as CreatureLook[]) for (const clip of CREATURE_CLIPS) if (this.looks[look]![clip]) out.push({ name: `${look}/${clip}`, source: this.looks[look]![clip]![0].source });
		return out;
	}

	// ---- the look ----
	/** the game's mode (the scene's family): the look it shows */
	mode(family: keyof typeof CREATURE.looks): void {
		const look = CREATURE.looks[family];
		if (look === this.want) return;
		this.want = look;
		this.note('want', look);
		// a look that was loaded ahead is now simply the wanted one
		if (this.ahead.book === look) this.ahead.book = null;
		if (this.ahead.buy === look) this.ahead.buy = null;
		if (look !== this.look || this.next) this.onWantLook?.(look);
	}
	get wanted(): CreatureLook {
		return this.want;
	}
	/** the look loaded ahead of its mode (null: none) */
	get prepared(): CreatureLook | null {
		return this.ahead.book ?? this.ahead.buy;
	}
	/** A LOOK AHEAD OF ITS MODE: `why` says a feature with this look is coming (null: it no longer is). The loader starts
	 *  it; nothing on show changes. A look no longer named by anything is let go, unless it is drawn or wanted */
	prepare(why: 'book' | 'buy', look: CreatureLook | null): void {
		const before = this.prepared;
		this.ahead[why] = look === this.want ? null : look;
		const now = this.prepared;
		if (now === before) return;
		this.note('prepare', { why, look: now });
		if (now && now !== this.look && now !== this.next) this.onWantLook?.(now);
		if (before && before !== now && !this.uses(before)) this.onLookFree?.(before);
	}
	/** the wanted look's idle sheet is uploaded (the loader calls this; also when more of a look lands) */
	lookReady(now: number): void {
		const want = this.want;
		if (!this.has(want, 'idle') || !this.shadows.idle) return;
		if (!this.look) {
			// the first look: he fades in
			this.look = want;
			this.state = 'idle';
			this.idleT0 = now;
			this.idleFrame = 1;
			this.appearAt = now;
			this.unveilMs = -1;
			this.shown = 0;
			this.drawnFrame = 0;
			this.note('appear', want);
			this.onLookOn?.(want);
			return;
		}
		if (want === this.look) {
			// back to the look on show before the other one took over: drop the fade
			if (this.next) this.endFade(false);
			return;
		}
		if (this.next === want) return;
		if (this.next) this.endFade(false);
		this.next = want;
		this.fadeAt = -1; // starts on the first tick he is in the idle loop (both looks have that clip)
	}
	private endFade(done: boolean): void {
		const from = this.look;
		const to = this.next;
		this.next = null;
		this.fadeAt = -1;
		// THE HAND-OVER: the lower sprite takes the texture the upper one is showing (a frame of the new look) HERE,
		// before the old look is let go. It used to be left to this tick's draw(), which changes nothing when the new
		// look has no sheet for the clip he is in: the lower sprite then kept a frame of the look being destroyed.
		if (done && to) this.colour[0].texture = this.colour[1].texture;
		this.colour[1].visible = false;
		this.colour[1].alpha = 0;
		this.colour[1].texture = PIXI.Texture.EMPTY;
		// the lifts let go of the old look's frames before it can be freed below
		this.syncLift();
		if (done && to) {
			this.look = to;
			this.syncLift();
			this.drawnFrame = 0; // and draws the new look's own frame this tick
			this.note('look', { from, to });
			if (from && from !== to) this.onLookFree?.(from);
			this.onLookOn?.(to);
		} else if (to && to !== this.look) this.onLookFree?.(to);
	}

	// ---- what the board tells him (all presentation; every call returns at once) ----
	private canPlay(clip: CreatureClip): boolean {
		return this.enabled && this.placed && !this.veiled && this.state !== 'hidden' && this.drawable(clip) && !this.env.skipping();
	}
	/** every look being drawn NOW has this clip's sheet: the look on show, and the one crossing over it */
	private drawable(clip: CreatureClip): boolean {
		return !!this.look && this.has(this.look, clip) && !!this.shadows[clip] && (!this.next || this.fadeAt < 0 || this.has(this.next, clip));
	}
	/** a cue's action can be drawn NOW. Asked when it starts: the look may have changed since the cue was made */
	private fireable(kind: CueKind): boolean {
		return kind === 'charge' ? this.drawable('charge_in') && this.drawable('charge_loop') && this.drawable('sting_hit') && this.drawable('sting_recrouch') : this.drawable(kind);
	}
	/** a cue whose action cannot be drawn is not played (and with a charge goes the strike planned on it) */
	private refuse(kind: CueKind, now: number): void {
		this.cue = null;
		if (kind === 'charge') {
			this.hit = null;
			this.stinging = false;
		}
		if (this.state === 'rush') this.toIdle(now);
		this.miss(kind === 'charge' ? 'sting' : kind);
	}
	/** THE SWIPE, READ AHEAD: the tears will appear in `etaStyleMs` of style time from now */
	cueSwipe(etaStyleMs: number): void {
		if (!this.canPlay('swipe')) return;
		const now = performance.now();
		const ts = Math.max(0.2, this.env.ts());
		// THE ESTIMATE IS PUT LATE ON PURPOSE (cueBiasMs): the wind-up starts on time for a beat that comes when the
		// arithmetic says and is spread to the late anchor; the board's own beat then lands the strike. So he is never
		// seen striking before the tears, and a beat that comes early costs a wind-up frame, not a late claw.
		const at = now + etaStyleMs / ts - WINDUP.swipe / ts;
		const strikeAt = now + etaStyleMs / ts + CREATURE.cueBiasMs;
		if (this.state === 'clip' && this.run.clip === 'swipe' && this.run.hold === 0) {
			// a closer estimate for the swipe already winding up: move the anchor
			this.run.strikeAt = strikeAt;
			return;
		}
		this.swipeNext = { at, strikeAt };
		this.note('cue', { kind: 'swipe', inMs: strikeAt - now });
	}
	/** a roar, or the first sting of a run, read ahead: its beat comes in `etaStyleMs`. He is back on idle frame 1
	 *  (and in his charge_in, for a sting) by then. `kind`: the sting's, null for a roar */
	cueBeat(what: 'roar' | 'sting', etaStyleMs: number, kind: StingKind | null = null): void {
		const now = performance.now();
		const ts = Math.max(0.2, this.env.ts());
		const beat = now + etaStyleMs / ts + CREATURE.cueBeatBiasMs;
		if (what === 'roar') {
			if (this.canPlay('roar')) this.cue = { kind: 'roar', at: beat, strikeAt: 0, ahead: true };
		} else if (this.canPlay('charge_in') && this.canPlay('charge_loop') && this.canPlay('sting_hit') && this.canPlay('sting_recrouch') && this.state !== 'crouch') {
			// a normal sting's charge_in is timed back from its hit; a big / super charge starts on its beat; a scatter
			// run starts with its own long hold (the wait beat places the charge_in)
			if (kind === 'scatter') return;
			const lead = kind === 'normal' ? (CREATURE.sting.normalHitMs - this.strikeLead() - CHARGE_IN_MS) / ts : 0;
			this.cue = { kind: 'charge', at: beat + lead, strikeAt: 0 };
		}
		if (this.cue) this.note('cue', { kind: this.cue.kind, inMs: this.cue.at - now });
	}
	private strikeLead(): number {
		return CREATURE.strikeLead ? WINDUP.sting_hit : 0;
	}
	/** the board's own beat (the featureBeat broadcast) */
	beat(what: 'swipe' | 'roar'): void {
		const now = performance.now();
		if (what === 'swipe') {
			if (!this.canPlay('swipe')) return this.miss('swipe');
			if (this.state === 'clip' && this.run.clip === 'swipe') {
				// the tears are here. Still winding up: the strike lands now. Already holding: the hold counts from here
				if (this.run.hold === 0) this.run.strikeAt = now;
				this.run.beatAt = now;
				this.swipeNext = null;
				this.run.cued = false;
				this.note('beat', { what, frame: this.run.frame });
				return;
			}
			// no lead at all (nothing cued it, or a sting was still striking): the strike pose at once
			this.cue = null;
			this.swipeNext = null;
			this.start('swipe', now, WINDUP.swipe, now);
			this.run.startAt = now - 1;
			this.run.beatAt = now;
			this.note('beat', { what, late: true });
			return;
		}
		if (!this.canPlay('roar')) return this.miss('roar');
		if (this.state === 'clip' && this.run.clip === 'roar' && this.run.cued) {
			this.run.cued = false;
			this.note('beat', { what, frame: this.run.frame });
			return;
		}
		// read ahead and already rushing to it: it starts when the rush ends
		if (this.cue?.kind === 'roar' && this.cue.ahead) this.cue.ahead = false;
		else this.cue = { kind: 'roar', at: now, strikeAt: 0 };
		this.note('beat', { what });
	}
	/** a sting's beat (the stingBeat broadcast). `more`: another sting of this run follows this one */
	stingBeat(phase: 'charge' | 'wait' | 'strike', kind: StingKind, more: boolean): void {
		const now = performance.now();
		if (!this.canPlay('charge_in') || !this.canPlay('charge_loop') || !this.canPlay('sting_hit') || !this.canPlay('sting_recrouch')) return this.miss('sting');
		const ts = Math.max(0.2, this.env.ts());
		const S = CREATURE.sting;
		const lead = this.strikeLead() / ts;
		this.stinging = true;
		this.lastBeat = now;
		if (phase === 'wait') {
			// the scatter run's hold: he goes down for its last charge_in's worth, the strike beat plans the hit
			const hitStart = now + (S.scatterHoldMs + S.scatterHitMs) / ts - lead;
			if (!this.down()) this.cue = { kind: 'charge', at: hitStart - CHARGE_IN_MS / ts, strikeAt: 0 };
			this.note('sting', { phase, kind });
			return;
		}
		if (phase === 'charge') {
			// big / super: the crouch for the whole charge, the glow over it, the strike on the charge's end
			const end = now + (kind === 'super' ? S.superChargeMs : S.chargeMs) / ts;
			this.hit = { start: end - lead, more, lit: true };
			this.glowT1 = end - lead;
			this.glowT0 = this.state === 'crouch' ? now : -1; // -1: from the first frame of the loop
			if (!this.down() && this.cue?.kind !== 'charge') this.cue = { kind: 'charge', at: now, strikeAt: 0 };
			if (this.state === 'crouch') this.aimCrouch(now);
			this.note('sting', { phase, kind, more });
			return;
		}
		// strike: a normal or scatter hit lands partway into its beat; a big / super strike is NOW
		if (kind === 'big' || kind === 'super') {
			if (!(this.state === 'clip' && this.run.clip === 'sting_hit')) this.hit = { start: now - lead, more, lit: true };
			else this.run.toCrouch = more;
		} else {
			const hitStart = now + (kind === 'scatter' ? S.scatterHitMs : S.normalHitMs) / ts - lead;
			this.hit = { start: hitStart, more, lit: false };
			// not down yet (no cue came): whatever is left of charge_in before the strike must start
			if (!this.down() && this.cue?.kind !== 'charge') this.cue = { kind: 'charge', at: Math.max(now, hitStart - CHARGE_IN_MS / ts), strikeAt: 0 };
		}
		this.note('sting', { phase, kind, more });
	}
	/** the growl that answers a Mystery which awarded nothing */
	growl(): void {
		if (!this.canPlay('growl') || this.state !== 'idle' || this.cue) return;
		this.cue = { kind: 'growl', at: performance.now(), strikeAt: 0 };
	}
	private miss(what: string): void {
		this.counters.skipped += 1;
		this.note('skipped', what);
	}

	// ---- the clips ----
	/** every sound of his is asked for here (counted, so a probe can hold him to silence while he is hidden) */
	private say(name: string, rate?: number): void {
		this.counters.sounds += 1;
		this.env.play(name, rate);
	}
	/** THE VOICE (CREATURE.voice): which take of the snarl or the growl plays next and how fast. Never the take that
	 *  played last (the first is a coin toss), at a random rate inside the range. Presentation only, plain Math.random. */
	pickVoice(clip: 'snarl' | 'growl'): { name: string; take: number; rate: number } {
		const last = this.voiceTake[clip];
		const take = last ? 3 - last : Math.random() < 0.5 ? 1 : 2;
		this.voiceTake[clip] = take;
		const { rateMin, rateMax } = CREATURE.voice;
		return { name: `sfx_manticore_${clip}_${take}`, take, rate: rateMin + Math.random() * (rateMax - rateMin) };
	}
	private quiet(): void {
		if (!this.breathOn) return;
		this.env.stop(this.breathOn);
		this.breathOn = null;
	}
	/** start a clip `offset` clip ms in (a clip that had less lead than it needs starts partway) */
	private start(clip: CreatureClip, now: number, offset = 0, strikeAt = 0): void {
		this.quiet();
		const r = this.run;
		r.clip = clip;
		r.t = Math.max(0, offset);
		r.frame = 0;
		r.hold = 0;
		r.held = 0;
		r.strikeAt = strikeAt;
		r.startAt = now;
		r.beatAt = 0;
		r.toCrouch = false;
		r.lit = false;
		r.cued = false;
		this.state = 'clip';
		this.glowA = 0;
		this.note('start', { clip, offset: Math.round(offset) });
		if (clip === 'snarl' || clip === 'growl') {
			const voice = this.pickVoice(clip);
			this.note('voice', voice);
			this.say(voice.name, voice.rate);
		}
	}
	private toIdle(now: number): void {
		this.state = 'idle';
		this.idleT0 = now;
		this.idleFrame = 0; // the loop's first frame is a restart
		this.cue = this.cue && this.cue.at > now ? this.cue : null;
		this.hit = null;
		this.stinging = false;
		this.glowA = 0;
	}
	private toCrouch(frame: number): void {
		this.state = 'crouch';
		this.crouchT = (frame - 1) * FRAME_MS;
		this.crouchRate = 1;
		if (this.glowT0 < 0) this.glowT0 = performance.now();
	}
	/** the cue's clip starts now, `late` real ms after it should have. False: nothing started (he was already down
	 *  for a charge, or the action cannot be drawn by the look(s) on show now and is not played) */
	private fire(now: number, late: number): boolean {
		const c = this.cue!;
		this.cue = null;
		if (c.kind === 'charge' && this.down()) return false;
		if (!this.fireable(c.kind)) {
			this.refuse(c.kind, now);
			return false;
		}
		const ts = Math.max(0.2, this.env.ts());
		if (c.kind === 'swipe') {
			this.start('swipe', now, WINDUP.swipe * clamp01((now - c.at) / Math.max(c.strikeAt - c.at, 1)), c.strikeAt);
			this.run.startAt = c.at;
			this.run.cued = true;
		} else if (c.kind === 'roar') {
			this.start('roar', now, c.ahead ? late * ts : 0);
			this.run.cued = !!c.ahead;
		} else if (c.kind === 'growl') this.start('growl', now, 0);
		else if (this.hit && this.hit.start - now < CHARGE_IN_MS / ts) {
			this.lastBeat = now;
			// less time than charge_in is long before the strike must start: its last frames only
			this.start('charge_in', now, CHARGE_IN_MS - Math.max(0, this.hit.start - now) * ts);
		} else {
			this.lastBeat = now;
			this.start('charge_in', now, late * ts);
		}
		return true;
	}
	/** in the crouch, on his way into it, or striking from it */
	private down(): boolean {
		return this.state === 'crouch' || (this.state === 'clip' && (this.run.clip === 'charge_in' || this.run.clip === 'sting_recrouch' || (this.run.clip === 'sting_hit' && (this.run.toCrouch || this.run.hold < 2))));
	}

	/** one frame; `now` is performance.now() */
	tick(now: number): void {
		if (this.state === 'hidden' || !this.look) return;
		const dt = this.last < 0 ? 0 : Math.max(0, now - this.last);
		this.last = now;
		this.counters.ticks += 1;
		const ts = Math.max(0.2, this.env.ts());
		const on = this.enabled && this.placed && !this.veiled;
		if (this.env.skipping() || !on) {
			// SKIP TO RESULT (and a layout that hides him, and the landing screen): no action, no sound; whatever ran is
			// cut to idle
			if (this.state !== 'idle') this.toIdle(now);
			this.cue = null;
			this.swipeNext = null;
			this.quiet();
		}
		this.tickLook(now, on, dt);
		if (!on) {
			this.swipeNext = null;
			this.syncLift();
			return;
		}
		// a swipe read ahead becomes the cue once no sting is left for him to play before it
		if (this.swipeNext && !this.hit && !(this.cue && this.cue.kind === 'charge') && !(this.state === 'clip' && (this.run.clip === 'charge_in' || this.run.clip === 'sting_recrouch' || (this.run.clip === 'sting_hit' && this.run.hold < 2)))) {
			this.cue = { kind: 'swipe', at: this.swipeNext.at, strikeAt: this.swipeNext.strikeAt };
			this.swipeNext = null;
		}

		let clip: CreatureClip = 'idle';
		let frame = 1;
		if (this.state === 'idle') {
			const f = Math.floor(((now - this.idleT0) * FPS) / 1000);
			frame = (f % N.idle) + 1;
			if (frame < this.idleFrame || this.idleFrame === 0) {
				// the loop restarts: one roll, else a breath
				this.idleT0 = now - ((now - this.idleT0) % FRAME_MS);
				if (!this.rollAlt(now)) this.breathe();
			}
			this.idleFrame = frame;
			if (this.state === 'idle' && this.cue) {
				const c = this.cue;
				const free = frame <= CREATURE.rushFreeFrames + 1 || frame > N.idle - CREATURE.rushFreeFrames;
				const rushMs = free ? 0 : CREATURE.rushMs / ts;
				if (now >= c.at - rushMs && !this.fireable(c.kind)) {
					// (no rush towards an action that will not be played)
					this.refuse(c.kind, now);
				} else if (now >= c.at - rushMs) {
					// THE RUSH: the idle runs to its frame 1 first, inside rushMs. It never makes a strike late: a swipe or a
					// sting with less lead than its own wind-up gets less rush, or none
					const room = c.kind === 'swipe' ? c.at - now : c.kind === 'charge' && this.hit ? this.hit.start - now - 2 * FRAME_MS / ts : rushMs;
					const endAt = Math.max(c.at, now + Math.min(rushMs, Math.max(0, room)));
					if (free || endAt - now < 4) this.fire(now, now - c.at);
					else {
						this.quiet();
						c.at = endAt;
						this.state = 'rush';
						this.rush.from = frame;
						this.rush.to = frame >= N.idle / 2 + 1 ? N.idle + 1 : 1;
						this.rush.t0 = now;
						this.note('rush', { from: frame, ms: Math.round(endAt - now) });
					}
				}
			}
		}
		if (this.state === 'rush') {
			const R = this.rush;
			if (!this.cue) this.toIdle(now);
			else if (now >= this.cue.at) this.fire(now, now - this.cue.at);
			else {
				const u = (now - R.t0) / Math.max(this.cue.at - R.t0, 1);
				const f = Math.round(R.from + (R.to - R.from) * u);
				frame = f > N.idle ? 1 : Math.max(1, f);
			}
		}
		if (this.state === 'clip') {
			const r = this.run;
			// another action's first frame is due: cut to it (never before a strike of this one has landed)
			const striking = (r.clip === 'swipe' || r.clip === 'sting_hit') && r.hold < 2;
			if (this.cue && now >= this.cue.at && !striking && r.clip !== 'charge_in' && r.clip !== 'sting_recrouch' && !this.hit) this.fire(now, now - this.cue.at);
			if (r.clip === 'swipe' && r.hold < 2) {
				// ANCHORED: the wind-up is read backwards from the strike; then the strike pose is held until the board's
				// beat (+ holdMs), or beatWaitMs if no beat comes
				if (r.hold === 0) {
					r.t = WINDUP.swipe * clamp01((now - r.startAt) / Math.max(r.strikeAt - r.startAt, 1));
					if (now >= r.strikeAt) {
						r.hold = 1;
						r.t = WINDUP.swipe;
						this.note('strike', { clip: 'swipe' });
					}
				}
				if (r.hold === 1) {
					const from = r.beatAt || (now - r.strikeAt > CREATURE.beatWaitMs ? r.strikeAt : 0);
					if (from && now - Math.max(from, r.strikeAt) >= CREATURE.holdMs / ts) r.hold = 2;
				}
			} else {
				const rate = REAL_CLIPS.includes(r.clip) ? 1 : ts;
				const hold = HOLD[r.clip] ?? 0;
				if (r.hold === 1) {
					r.held += dt * rate;
					if (r.held >= CREATURE.holdMs) {
						r.hold = 2;
						r.t += r.held - CREATURE.holdMs;
					}
				} else {
					r.t += r.frame === 0 ? 0 : dt * rate;
					if (hold && r.hold === 0 && r.t >= (hold - 1) * FRAME_MS) {
						r.held = r.t - (hold - 1) * FRAME_MS;
						r.t = (hold - 1) * FRAME_MS;
						r.hold = 1;
						this.note('strike', { clip: r.clip });
					}
				}
			}
			clip = r.clip;
			frame = Math.floor(r.t / FRAME_MS) + 1;
			if (clip === 'charge_in' && this.hit && now >= this.hit.start) this.strike(now);
			else if (clip === 'sting_hit' && r.hold === 2 && this.hit && now >= this.hit.start) this.strike(now);
			else if (clip === 'sting_hit' && r.toCrouch && r.hold === 2) this.recrouch(now);
			else if (clip === 'sting_recrouch' && this.hit && now >= this.hit.start && frame >= CREATURE.recrouch.strikeFromFrame) this.strike(now);
			else if (frame > N[clip]) {
				if (clip === 'charge_in') {
					this.toCrouch(this.crouchPhase(now));
					this.crouchT += r.t - CHARGE_IN_MS;
					this.aimCrouch(now);
				} else if (clip === 'sting_recrouch') {
					this.toCrouch(SPEC.clips.sting_recrouch.returnsToFrame);
					this.crouchT += r.t - N.sting_recrouch * FRAME_MS;
					this.aimCrouch(now);
				} else {
					const over = r.t - N[clip] * FRAME_MS;
					this.toIdle(now);
					this.idleT0 = now - over / (REAL_CLIPS.includes(clip) ? 1 : ts);
				}
			}
			if (this.state === 'clip') {
				clip = this.run.clip;
				frame = Math.min(N[clip], Math.floor(this.run.t / FRAME_MS) + 1);
				this.run.frame = frame;
			} else if (this.state === 'idle') {
				clip = 'idle';
				frame = 1;
			}
		}
		if (this.state === 'crouch') {
			this.crouchT += this.drawnClip === 'charge_loop' ? dt * ts * this.crouchRate : 0;
			clip = 'charge_loop';
			frame = (Math.floor(this.crouchT / FRAME_MS) % N.charge_loop) + 1;
			if (this.hit && now >= this.hit.start) {
				this.strike(now);
				clip = 'sting_hit';
				frame = Math.min(N.sting_hit, Math.floor(this.run.t / FRAME_MS) + 1);
				this.run.frame = frame;
			} else if (this.cue && this.cue.kind === 'charge') {
				this.cue = null;
			} else if (this.cue && now >= this.cue.at) {
				// (a cue that is refused leaves him in the crouch)
				if (this.fire(now, now - this.cue.at)) {
					clip = this.run.clip;
					frame = 1;
				}
			} else if (!this.hit && now - this.lastBeat > CREATURE.crouchTimeoutMs) {
				// no sting came after all: he gets up (the end of sting_hit is the only way up there is)
				this.start('sting_hit', now, CREATURE.crouchUpFrame * FRAME_MS);
				this.run.hold = 2;
				clip = 'sting_hit';
				frame = CREATURE.crouchUpFrame + 1;
			}
		}
		// THE GLOW, worked out once a tick after every change of state above (a strike that starts in the crouch is state
		// `clip` on that same tick): over charge_loop the ramp of a big / super charge, none in a normal run's crouch; over
		// a lit strike litAlpha. The ramp ends at glowT1, the tick sting_hit starts, so it is 1 on both sides of the cut
		this.glowA =
			this.state === 'crouch'
				? this.glowT1 > this.glowT0 && this.glowT0 >= 0 && now <= this.glowT1 + 50
					? clamp01((now - this.glowT0) / (this.glowT1 - this.glowT0))
					: 0
				: this.state === 'clip'
					? this.litAlpha()
					: 0;
		this.draw(clip, frame);
		this.syncLift();
		this.tickPoke(now, on);
	}

	/** THE NIGHT LIFT (constants CREATURE_LIFT): each lift sprite shows its colour sprite's frame, at that look's `add` x
	 *  the colour sprite's own alpha (the look crossfade), tinted the look's `tint`; off in the day look. A few compares
	 *  a tick, writes only on a change */
	private syncLift(): void {
		for (let i = 0; i < 2; i += 1) {
			const c = this.colour[i];
			const s = this.lift[i];
			const look = i === 0 ? this.look : this.next;
			const L = look === 'super' || look === 'epic' ? CREATURE_LIFT[look] : null;
			const a = L && c.visible && c.texture !== PIXI.Texture.EMPTY ? L.add * c.alpha : 0;
			if (a <= 0) {
				if (s.visible) {
					s.visible = false;
					s.texture = PIXI.Texture.EMPTY;
				}
				continue;
			}
			if (s.texture !== c.texture) s.texture = c.texture;
			if (s.scale.x !== c.scale.x) s.scale.set(c.scale.x);
			if (s.alpha !== a) s.alpha = a;
			if (s.tint !== L!.tint) s.tint = L!.tint;
			if (!s.visible) s.visible = true;
		}
	}

	/** the crouch frame a charge_in hands over to (constants CREATURE.glowPhase): charge_loop f1, or, before a LIT strike,
	 *  the frame that makes the loop's last frame before sting_hit its f12, so the strike's glow follows on from the
	 *  frame the rig built it to follow (the glow add-on: from any other frame the light dips for a frame) */
	private crouchPhase(now: number): number {
		const h = this.hit;
		if (!this.glowPhase || !h || !h.lit) return 1;
		const ts = Math.max(0.2, this.env.ts());
		const frames = Math.round(((h.start - now) * ts) / FRAME_MS);
		if (frames < N.charge_loop) return 1;
		return 1 + ((N.charge_loop - (frames % N.charge_loop)) % N.charge_loop);
	}
	/** ALREADY DOWN when a lit strike is planned (a big / super after normal stings: the charge comes in the crouch, so
	 *  no phase can be picked): the loop runs a little fast or slow until the strike (at most CREATURE.glowAim.maxRate
	 *  off 1) so that the strike still leaves it on f1. A rate it would need beyond that is not used: the loop runs as
	 *  ever. Also fine tunes the phase picked at charge_in's end. Presentation only: the strike's time is the board's */
	private aimCrouch(now: number): void {
		this.crouchRate = 1;
		const h = this.hit;
		if (!this.glowPhase || !h || !h.lit || this.state !== 'crouch') return;
		const ts = Math.max(0.2, this.env.ts());
		const left = ((h.start - now) * ts) / FRAME_MS; // loop frames until sting_hit starts
		if (left < CREATURE.glowAim.minFrames) return;
		const at = this.crouchT / FRAME_MS + left; // where the loop would be then (frames from its f1)
		const L = N.charge_loop;
		// the strike starts as the loop reaches the END of an f1 (its last frame drawn is f1): the nearest such point
		const goal = Math.round((at - 1) / L) * L + 1;
		const rate = (goal - this.crouchT / FRAME_MS) / left;
		if (Math.abs(rate - 1) <= CREATURE.glowAim.maxRate) this.crouchRate = rate;
		this.note('aim', { left: Math.round(left), rate: Math.round(rate * 1000) / 1000, used: this.crouchRate !== 1 });
	}

	/** the planned strike starts (from the crouch, from what is left of charge_in, or straight after the last one) */
	private strike(now: number): void {
		const h = this.hit!;
		this.hit = null;
		const ts = Math.max(0.2, this.env.ts());
		this.start('sting_hit', now, Math.min((now - h.start) * ts, WINDUP.sting_hit));
		this.crouchRate = 1;
		this.run.toCrouch = h.more;
		this.run.lit = h.lit && !!this.glowOver.sting_hit;
		this.stinging = h.more;
		this.glowT0 = this.glowT1 = 0;
	}
	/** between two stings of a run: the rig's re-crouch follows the hold frame instead of the rest of sting_hit */
	private recrouch(now: number): void {
		const over = this.run.t - WINDUP.sting_hit;
		const lit = this.run.lit;
		this.start('sting_recrouch', now, Math.max(0, over));
		// (start() clears these; he is still down and the run is still on)
		this.run.lit = lit && !!this.glowOver.sting_recrouch;
		this.stinging = true;
	}
	/** a lit strike's glow: 1 from sting_hit f1 to the end of its hold frame (the hit lands on it), then the rig's gain
	 *  hint read as a line through its values and carried on to 0 at the end of the last glow frame. Clip ms, so turbo */
	private litAlpha(): number {
		const r = this.run;
		if (!r.lit) return 0;
		if (r.clip === 'sting_hit') {
			const from = HOLD.sting_hit! * FRAME_MS; // the start of f7
			if (r.hold < 2 || r.t < from || r.toCrouch) return CREATURE.glow.strength; // f1..f6, the hold included
			return Creature.fade(SPEC.clips.sting_hit_glow.gain, HOLD.sting_hit!, r.t - from);
		}
		if (r.clip === 'sting_recrouch') return Creature.fade(SPEC.clips.sting_recrouch_glow.gain, 0, r.t);
		return 0;
	}
	/** gain[first..] are the hint's values at each fading frame's START; between them a straight line, after the last
	 *  one a straight line to 0 over one more frame. `t`: clip ms since the fade began */
	private static fade(gain: readonly number[], first: number, t: number): number {
		const n = gain.length - first;
		const x = clamp01(t / CREATURE.glow.fadeMs) * n;
		if (x >= n) return 0;
		const k = Math.floor(x);
		const g0 = gain[first + k];
		const g1 = k + 1 < n ? gain[first + k + 1] : 0;
		return CREATURE.glow.strength * (g0 + (g1 - g0) * (x - k));
	}

	// ---- the poke ----
	/** a poke can be taken now: he stands in his idle loop with nothing cued, read ahead or crossing over, fully shown,
	 *  the game is idle, the cooldown is over, and one of the poke clips can be drawn */
	private pokeable(now: number, on: boolean): boolean {
		return (
			CREATURE.poke.on &&
			on &&
			this.state === 'idle' &&
			!this.cue &&
			!this.swipeNext &&
			!this.hit &&
			!this.stinging &&
			!this.next &&
			this.shown >= 1 &&
			now >= this.pokeReadyAt &&
			!this.env.skipping() &&
			this.env.idle() &&
			CREATURE.poke.clips.some((c) => this.canPlay(c))
		);
	}
	/** the hit area is live only while a poke can be taken (no pointer cursor over him otherwise) */
	private tickPoke(now: number, on: boolean): void {
		const want = this.pokeable(now, on);
		if (want === this.pokeOn) return;
		this.pokeOn = want;
		this.bodyNode.eventMode = want ? 'static' : 'none';
	}
	/** a tap or click on his body: a random snarl or growl, never the roar */
	poke(now: number): boolean {
		if (!this.pokeable(now, this.enabled && this.placed && !this.veiled)) {
			this.counters.pokeRefused += 1;
			this.note('poke', { refused: true });
			return false;
		}
		const can = CREATURE.poke.clips.filter((c) => this.canPlay(c)) as PokeClip[];
		const clip = can[Math.floor(Math.random() * can.length)];
		this.counters.pokes += 1;
		// the cooldown and the idle roll's quiet both count from the clip's end (snarl and growl run in real time)
		const end = now + N[clip] * FRAME_MS;
		this.pokeReadyAt = end + CREATURE.poke.cooldownMs;
		this.rollQuietUntil = end + CREATURE.poke.rollQuietMs;
		this.note('poke', { clip });
		this.start(clip, now, 0);
		this.tickPoke(now, true);
		return true;
	}
	/** DEV / probe: the hit area in canvas px (the polygon's corners) and the poke's clocks */
	pokeInfo() {
		const pts: { x: number; y: number }[] = [];
		const p = this.pokePoly.points;
		for (let i = 0; i < p.length; i += 2) {
			const g = this.bodyNode.toGlobal({ x: p[i], y: p[i + 1] });
			pts.push({ x: g.x, y: g.y });
		}
		const now = performance.now();
		return { on: this.pokeOn, eventMode: this.bodyNode.eventMode, area: pts, readyInMs: this.pokeReadyAt - now, quietInMs: this.rollQuietUntil - now, pokes: this.counters.pokes, refused: this.counters.pokeRefused };
	}
	/** DEV / probe: would this canvas point take a poke (the hit area minus the board) */
	pokeHits(x: number, y: number): boolean {
		const l = this.bodyNode.toLocal({ x, y });
		return (this.bodyNode.hitArea as PIXI.IHitArea).contains(l.x, l.y);
	}

	private rollAlt(now: number): boolean {
		if (this.cue || this.stinging || this.next || now < this.rollQuietUntil) return false;
		this.counters.rolls += 1;
		const forced = this.forceRoll;
		const pick = forced ? (forced === 'none' ? null : forced) : Math.random() < CREATURE.snarlOdds ? 'snarl' : Math.random() < CREATURE.growlOdds ? 'growl' : null;
		this.note('roll', { forced, pick });
		if (!pick || !this.canPlay(pick)) return false;
		if (forced) this.forceRoll = null;
		this.counters[pick === 'snarl' ? 'snarls' : 'growls'] += 1;
		this.start(pick, now, 0);
		return true;
	}
	private breathe(): void {
		if (!CREATURE.breath || this.shown < 1 || this.env.skipping()) return;
		this.quiet();
		this.breathTake = 1 - this.breathTake;
		this.breathOn = `sfx_manticore_breath_${this.breathTake + 1}`;
		this.say(this.breathOn);
	}

	/** the change of look and the first fade in (alphas only) */
	private tickLook(now: number, on: boolean, dt: number): void {
		if (this.unveilMs >= 0 && on) {
			// after the landing screen: by real time, but a long frame moves it no further than landingFadeStepMs
			this.unveilMs += Math.min(dt, CREATURE.landingFadeStepMs);
			this.shown = clamp01(this.unveilMs / Math.max(CREATURE.landingFadeMs, 1));
			if (this.shown >= 1) this.unveilMs = -1;
		} else if (this.appearAt >= 0) {
			this.shown = clamp01((now - this.appearAt) / Math.max(CREATURE.lookFadeMs, 1));
			if (this.shown >= 1) this.appearAt = -1;
		}
		const a = on ? this.shown : 0;
		const vis = a > 0;
		if (this.bodyNode.visible !== vis) this.bodyNode.visible = this.shadowNode.visible = vis;
		if (this.bodyNode.alpha !== a) this.bodyNode.alpha = this.shadowNode.alpha = a;
		if (!this.next) return;
		if (this.fadeAt < 0) {
			if (this.state !== 'idle') return;
			this.fadeAt = now;
			this.colour[1].visible = true;
			this.colour[1].alpha = 0;
			this.drawnFrame = 0;
			this.note('fade', { from: this.look, to: this.next });
		}
		const u = clamp01((now - this.fadeAt) / Math.max(CREATURE.lookFadeMs, 1));
		this.colour[1].alpha = u;
		if (u >= 1) this.endFade(true);
	}

	/** a swap between resident textures, only when the frame changed */
	private draw(clip: CreatureClip, frame: number): void {
		const look = this.looks[this.look!];
		// the glow: the frame set of the body clip, the body's frame (no glow frame under sting_hit f10+ or
		// sting_recrouch f4+: no glow). Set BEFORE the early return: a glow that comes on mid frame gets its own frame
		const over = clip === 'charge_loop' ? this.glowFrames : clip === 'sting_hit' ? this.glowOver.sting_hit : clip === 'sting_recrouch' ? this.glowOver.sting_recrouch : null;
		const gt = this.glowA > 0 ? over?.[frame - 1] : undefined;
		if (this.glow.visible !== !!gt) this.glow.visible = !!gt;
		if (gt && this.glow.alpha !== this.glowA) this.glow.alpha = this.glowA;
		if (gt && this.glow.texture !== gt) this.glow.texture = gt;
		this.glowClip = gt ? clip : null;
		this.glowFrame = gt ? frame : 0;
		if (clip === this.drawnClip && frame === this.drawnFrame) return;
		const tex = look?.[clip]?.[frame - 1];
		if (!tex) return;
		this.drawnClip = clip;
		this.drawnFrame = frame;
		const c0 = this.colour[0];
		if (c0.texture === PIXI.Texture.EMPTY || c0.scale.x !== SPEC.canvas[0] / tex.orig.width) for (const s of this.colour) s.scale.set(SPEC.canvas[0] / tex.orig.width);
		c0.texture = tex;
		const sh = this.shadows[clip]?.[frame - 1];
		if (sh) this.shadow.texture = sh;
		if (this.next) {
			const t1 = this.looks[this.next]?.[clip]?.[frame - 1];
			if (t1) this.colour[1].texture = t1;
		}
		this.counters.swaps += 1;
	}

	// ---- DEV / probe (window.__manticore.creature, components/Background.svelte) ----
	/** how many of his four sprites hold a texture that has been DESTROYED (its sheet was unloaded). Always 0: a sprite
	 *  drawn with one throws inside Pixi's render and stops the ticker (tools/manticore/creature_probe.js HANDOVER) */
	private dead(): number {
		let n = 0;
		for (const s of [this.shadow, this.colour[0], this.colour[1], ...this.lift, this.glow]) {
			const t = s.texture;
			if (t !== PIXI.Texture.EMPTY && (t.destroyed || !t.source || t.source.destroyed)) n += 1;
		}
		return n;
	}
	/** the shadow's frame on show as `clip:frame` (DEV / probe: the shadow follows him through every clip) */
	private shadowFrameOf(): string | null {
		const t = this.shadow.texture;
		for (const c of CREATURE_CLIPS) {
			const f = this.shadows[c];
			if (!f || f[0].source !== t.source) continue;
			const i = f.indexOf(t);
			if (i >= 0) return `${c}:${i + 1}`;
		}
		return null;
	}
	sample() {
		const r = this.run;
		return {
			t: performance.now(),
			state: this.state,
			clip: this.drawnClip,
			frame: this.drawnFrame,
			look: this.look,
			next: this.next,
			a0: this.colour[0].alpha,
			a1: this.colour[1].visible ? this.colour[1].alpha : 0,
			shown: this.bodyNode.visible ? this.bodyNode.alpha : 0,
			glow: this.glow.visible ? this.glow.alpha : 0,
			glowClip: this.glow.visible ? this.glowClip : null,
			glowFrame: this.glow.visible ? this.glowFrame : 0,
			shadowFrame: this.shadowFrameOf(),
			poke: this.pokeOn,
			hold: this.state === 'clip' ? r.hold : 0,
			cue: this.cue ? this.cue.kind : null,
			stinging: this.stinging,
			dead: this.dead(),
		};
	}
	info() {
		return {
			...this.sample(),
			enabled: this.enabled,
			placed: this.placed,
			veiled: this.veiled,
			drawn: { body: this.bodyNode.visible, shadow: this.shadowNode.visible, bodyAlpha: this.bodyNode.alpha, shadowAlpha: this.shadowNode.alpha },
			want: this.want,
			prepared: this.prepared,
			loaded: Object.fromEntries((Object.keys(this.looks) as CreatureLook[]).map((l) => [l, Object.keys(this.looks[l]!)])),
			shared: {
				shadow: !!this.shadows.idle,
				glow: !!this.glowFrames,
				shadowFrames: CREATURE_CLIPS.reduce((n, c) => n + (this.shadows[c]?.length ?? 0), 0),
				glowFrames: { charge_loop: this.glowFrames?.length ?? 0, sting_hit: this.glowOver.sting_hit?.length ?? 0, sting_recrouch: this.glowOver.sting_recrouch?.length ?? 0 },
			},
			counters: { ...this.counters },
			layer: this.bodyNode.parent?.label ?? null,
			shadowLayer: this.shadowNode.parent?.label ?? null,
			node: { x: this.bodyNode.x, y: this.bodyNode.y, scale: this.bodyNode.scale.x, shadowX: this.shadowNode.x, shadowY: this.shadowNode.y, shadowScale: this.shadowNode.scale.x },
			sprite: { scale: this.colour[0].scale.x, anchor: [this.colour[0].anchor.x, this.colour[0].anchor.y], shadowScale: this.shadow.scale.x, shadowAlpha: this.shadow.alpha, shadowShown: this.shadow.visible, glowBlend: this.glow.blendMode, tex: [this.colour[0].texture.orig.width, this.colour[0].texture.orig.height] },
		};
	}
}

export const creature = new Creature();
/** WHERE THE SCENES' TWIN ROOTS GO (SceneView.front; his body is always in one, 2026-10-13): components/Background.svelte
 *  lists them in `roots` and sets `layer` from the current spot; components/CreatureFront.svelte is mounted TWICE in
 *  components/Game.svelte and owns the two hosts: `behind` straight after the canvas logo and BEFORE the board, `front`
 *  straight after the board. Stage order: scene < logo < behind < board, its frame and chains < front < every canvas
 *  overlay that follows (spin total, plaques, win screens, transition) < the HTML HUD. So he is over the logo in
 *  either layer. sync() puts the roots in the layer's host, whichever came first. */
export const creatureFront = {
	/** the two hosts on the stage (components/CreatureFront.svelte, one per layer) and the layer of the current spot */
	hosts: { front: null as PIXI.Container | null, behind: null as PIXI.Container | null },
	layer: 'front' as CreatureLayer,
	roots: [] as PIXI.Container[],
	/** THE MAX WIN SCREEN'S LIFT (components/MaxWinCinematic.svelte): while it is set the roots sit in this host instead,
	 *  over the screen's dim and under its titles, in either layer. A stage level container like the two hosts, so he
	 *  stays on exactly the same pixels; cleared, he goes back to the layer's host. */
	lift: null as PIXI.Container | null,
	sync(): void {
		const host = this.lift ?? this.hosts[this.layer];
		if (!host) return;
		for (const root of this.roots) if (root.parent !== host) host.addChild(root);
	},
};
