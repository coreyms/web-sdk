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
//               sting_hit started strikeLead before the hit so its hold frame lands on it; between stings sting_hit is
//               cut back to the crouch after CREATURE.stingCut.afterFrame; after the last it plays out to idle. The
//               additive glow follows charge_loop and ramps 0 to 1 over a big / super charge
//   snarl, growl   idle alternates in REAL time; the growl also answers a Mystery that awarded nothing
// Action clips run in STYLE time (x the turbo scale), like the board effects they belong to. NOTHING WAITS FOR HIM:
// every method here returns at once, and a clip whose sheet is not in is simply not played.
//
// LOOKS: one per mode (CREATURE.looks), ONE resident. A change of mode asks for the new look (onWantLook); the old
// one keeps playing until the new one's idle sheet is uploaded, then the two cross over lookFadeMs (the outline is
// identical in every look, so nothing ghosts), then the old look is let go (onLookFree).
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

import { CREATURE } from './constants';
import { CREATURE_SPEC } from './creatureSpec';
import { CREATURE_CLIPS, type CreatureClip, type CreatureLook } from './creatureAssets';

type Frames = PIXI.Texture[];
type CueKind = 'swipe' | 'roar' | 'charge' | 'growl';
type StingKind = 'normal' | 'big' | 'super' | 'scatter';
export type CreatureLayer = 'front' | 'behind';
export type CreaturePlace = { x: number; y: number; scale: number; layer: CreatureLayer };
/** what the creature needs from the game (components/Background.svelte hands it over; this file imports no state) */
export type CreatureEnv = { ts: () => number; skipping: () => boolean; play: (name: string, rate?: number) => void; stop: (name: string) => void };

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

	env: CreatureEnv = { ts: () => 1, skipping: () => false, play: () => {}, stop: () => {} };
	/** the loader's two hooks: a look is wanted (load its idle sheet first), a look is no longer drawn (let it go) */
	onWantLook: ((look: CreatureLook) => void) | null = null;
	onLookFree: ((look: CreatureLook) => void) | null = null;

	// ---- the textures (resident; arrays by frame, built once per sheet) ----
	private readonly looks: Partial<Record<CreatureLook, Partial<Record<CreatureClip, Frames>>>> = {};
	private readonly shadows: Partial<Record<CreatureClip, Frames>> = {};
	private glowFrames: Frames | null = null;

	// ---- the look ----
	/** the look on show (null: nothing yet), the one fading in, and the one the mode asks for */
	look: CreatureLook | null = null;
	private next: CreatureLook | null = null;
	private want: CreatureLook = CREATURE.looks.base;
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
	private run: Run = { clip: 'idle', t: 0, frame: 1, hold: 0, held: 0, startAt: 0, strikeAt: 0, beatAt: 0, toCrouch: false, cued: false };
	private rush = { from: 1, to: 1, t0: 0 };
	/** what starts when the rush ends, or at `at` (real ms: the clip's first frame). strikeAt: swipe only */
	private cue: { kind: CueKind; at: number; strikeAt: number; ahead?: boolean } | null = null;
	/** a swipe read ahead while a sting is still his to play: it becomes the cue once that strike has landed */
	private swipeNext: { at: number; strikeAt: number } | null = null;
	/** the crouch: its loop clock (clip ms), whether stings are still coming, the strike that is planned (the real time
	 *  sting_hit must START, and whether another sting follows it), when a beat last came, the glow's ramp */
	private crouchT = 0;
	private stinging = false;
	private hit: { start: number; more: boolean } | null = null;
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

	// ---- DEV / probe ----
	readonly log: { t: number; what: string; clip?: string; frame?: number; info?: unknown }[] = [];
	counters = { swaps: 0, ticks: 0, rolls: 0, snarls: 0, growls: 0, skipped: 0, rescued: 0, sounds: 0 };
	/** DEV: the roll's two draws (null: Math.random) so a probe can force an alternate */
	forceRoll: 'snarl' | 'growl' | 'none' | null = null;

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
		for (const s of [this.shadow, ...this.colour, this.glow]) s.anchor.set(ax, ay);
		this.glow.blendMode = 'add';
		this.glow.visible = false;
		this.colour[1].visible = false;
		this.shadow.alpha = CREATURE.shadowAlpha;
		this.shadowNode.addChild(this.shadow);
		this.bodyNode.addChild(this.colour[0], this.colour[1], this.glow);
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
			this.glowFrames = Creature.frames(tex, 'creature_glow', SPEC.clips.charge_glow.frames);
			if (this.glowFrames) this.glow.scale.set(SPEC.canvas[0] / this.glowFrames[0].orig.width);
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
		return look === this.look || look === this.next || look === this.want;
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
		if (look !== this.look || this.next) this.onWantLook?.(look);
	}
	get wanted(): CreatureLook {
		return this.want;
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
		if (done && to) {
			this.look = to;
			this.drawnFrame = 0; // and draws the new look's own frame this tick
			this.note('look', { from, to });
			if (from && from !== to) this.onLookFree?.(from);
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
		return kind === 'charge' ? this.drawable('charge_in') && this.drawable('charge_loop') && this.drawable('sting_hit') : this.drawable(kind);
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
		} else if (this.canPlay('charge_in') && this.canPlay('charge_loop') && this.canPlay('sting_hit') && this.state !== 'crouch') {
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
		if (!this.canPlay('charge_in') || !this.canPlay('charge_loop') || !this.canPlay('sting_hit')) return this.miss('sting');
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
			this.hit = { start: end - lead, more };
			this.glowT1 = end - lead;
			this.glowT0 = this.state === 'crouch' ? now : -1; // -1: from the first frame of the loop
			if (!this.down() && this.cue?.kind !== 'charge') this.cue = { kind: 'charge', at: now, strikeAt: 0 };
			this.note('sting', { phase, kind, more });
			return;
		}
		// strike: a normal or scatter hit lands partway into its beat; a big / super strike is NOW
		if (kind === 'big' || kind === 'super') {
			if (!(this.state === 'clip' && this.run.clip === 'sting_hit')) this.hit = { start: now - lead, more };
			else this.run.toCrouch = more;
		} else {
			const hitStart = now + (kind === 'scatter' ? S.scatterHitMs : S.normalHitMs) / ts - lead;
			this.hit = { start: hitStart, more };
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
		return this.state === 'crouch' || (this.state === 'clip' && (this.run.clip === 'charge_in' || (this.run.clip === 'sting_hit' && (this.run.toCrouch || this.run.hold < 2))));
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
			return;
		}
		// a swipe read ahead becomes the cue once no sting is left for him to play before it
		if (this.swipeNext && !this.hit && !(this.cue && this.cue.kind === 'charge') && !(this.state === 'clip' && (this.run.clip === 'charge_in' || (this.run.clip === 'sting_hit' && this.run.hold < 2)))) {
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
			if (this.cue && now >= this.cue.at && !striking && r.clip !== 'charge_in' && !this.hit) this.fire(now, now - this.cue.at);
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
			else if (clip === 'sting_hit' && r.toCrouch && r.hold === 2 && frame > CREATURE.stingCut.afterFrame) this.toCrouch(CREATURE.stingCut.toLoopFrame);
			else if (frame > N[clip]) {
				if (clip === 'charge_in') {
					this.toCrouch(1);
					this.crouchT += r.t - CHARGE_IN_MS;
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
			this.crouchT += this.drawnClip === 'charge_loop' ? dt * ts : 0;
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
				this.start('sting_hit', now, CREATURE.stingCut.afterFrame * FRAME_MS);
				this.run.hold = 2;
				clip = 'sting_hit';
				frame = CREATURE.stingCut.afterFrame + 1;
			}
			// the glow: charge_loop's own frame, ramping over a big / super charge; none in a normal run's crouch
			this.glowA = this.state === 'crouch' && this.glowT1 > this.glowT0 && this.glowT0 >= 0 && now <= this.glowT1 + 50 ? clamp01((now - this.glowT0) / (this.glowT1 - this.glowT0)) : 0;
		} else this.glowA = 0;
		this.draw(clip, frame);
	}

	/** the planned strike starts (from the crouch, from what is left of charge_in, or straight after the last one) */
	private strike(now: number): void {
		const h = this.hit!;
		this.hit = null;
		const ts = Math.max(0.2, this.env.ts());
		this.start('sting_hit', now, Math.min((now - h.start) * ts, WINDUP.sting_hit));
		this.run.toCrouch = h.more;
		this.stinging = h.more;
		this.glowT0 = this.glowT1 = 0;
	}

	private rollAlt(now: number): boolean {
		if (this.cue || this.stinging || this.next) return false;
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
		const g = clip === 'charge_loop' && this.glowFrames && this.glowA > 0;
		if (this.glow.visible !== !!g) this.glow.visible = !!g;
		if (g && this.glow.alpha !== this.glowA) this.glow.alpha = this.glowA;
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
		if (g) this.glow.texture = this.glowFrames![frame - 1];
		this.counters.swaps += 1;
	}

	// ---- DEV / probe (window.__manticore.creature, components/Background.svelte) ----
	/** how many of his four sprites hold a texture that has been DESTROYED (its sheet was unloaded). Always 0: a sprite
	 *  drawn with one throws inside Pixi's render and stops the ticker (tools/manticore/creature_probe.js HANDOVER) */
	private dead(): number {
		let n = 0;
		for (const s of [this.shadow, this.colour[0], this.colour[1], this.glow]) {
			const t = s.texture;
			if (t !== PIXI.Texture.EMPTY && (t.destroyed || !t.source || t.source.destroyed)) n += 1;
		}
		return n;
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
			loaded: Object.fromEntries((Object.keys(this.looks) as CreatureLook[]).map((l) => [l, Object.keys(this.looks[l]!)])),
			shared: { shadow: !!this.shadows.idle, glow: !!this.glowFrames },
			counters: { ...this.counters },
			layer: this.bodyNode.parent?.label ?? null,
			shadowLayer: this.shadowNode.parent?.label ?? null,
			node: { x: this.bodyNode.x, y: this.bodyNode.y, scale: this.bodyNode.scale.x, shadowX: this.shadowNode.x, shadowY: this.shadowNode.y, shadowScale: this.shadowNode.scale.x },
			sprite: { scale: this.colour[0].scale.x, anchor: [this.colour[0].anchor.x, this.colour[0].anchor.y], shadowScale: this.shadow.scale.x, shadowAlpha: this.shadow.alpha, glowBlend: this.glow.blendMode, tex: [this.colour[0].texture.orig.width, this.colour[0].texture.orig.height] },
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
	sync(): void {
		const host = this.hosts[this.layer];
		if (!host) return;
		for (const root of this.roots) if (root.parent !== host) host.addChild(root);
	},
};
