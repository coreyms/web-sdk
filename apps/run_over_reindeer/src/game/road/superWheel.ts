// THE SUPER WHEEL (Corey 2026-11-18; the approved mock super_wheel_2026-11-18 round 5, "Mc Under the number and P2";
// constants SUPER_WHEEL; the plan and its seed: game/superWheelPlan.ts; the art: tools/build_super_wheel.py).
//
// When a Super Free Spins round begins, the wheel pops out of the red present, grows to the middle of the board while
// the traffic drives out, rests until the Spin press (or 1.5 s with Autoplay Bonuses), the reindeer runs in and drives its
// rim, it slows onto the book's opening (who and the multiplier), an inner ring spins onto the book's column, and the
// wheel leaves into that column. Then the column grows on the empty road in the game's own way and the first free spin
// drives in. PRESENTATION ONLY: every stop is the book's own value (the plan carries it); nothing is rolled here.
//
// HOW IT IS DRAWN: plain sprites of one sheet, no filter, mask or shader. Every piece's own origin is the wheel's
// centre (the sheet's frames carry it), so the rim, the wedges, the highlight, the ring, the hub and the turn share ONE
// centre by construction (Corey: "The Wheel itself doesn't seem perfectly circle, or it's off centered"); the rim is a
// true circle drawn by rule. Bottom to top: the drop shadow, the disc (turning: its dark back, the wedges with their
// numbers, the winner's highlight, the string lights, the trim and candy cane, the studs), the column ring, the hub
// (the medal, the SPIN tag, the Autoplay Bonuses ring), the peg, the reindeer. The LED strip is drawn over it all
// (components/Board.svelte keeps this root just under the scoreboard's).
//
// THE REINDEER ON THE RIM: the shipped side run (view R). His pose comes from the rim's own travel (the planted hoof's
// sweep per pose, constants STRIKE), so his stride is locked to the rim's surface; in each pose his body is lowered by
// the amount measured offline on the exact circle (game/superWheelSpec.ts run.poses) so that his lowest hoof is on the
// rim's outer edge: never a gap, never sunk in.
import * as PIXI from 'pixi.js';

import { SUPER_WHEEL, WILD_MULT } from '../constants';
import { SUPER_WHEEL_ART as ART } from '../superWheelSpec';
import { ROAD_ART } from '../roadArtSpec';
import { stamp } from '../assets';
import { PHONE_TIER } from '../deviceTier';
import { STAGING_TOOLS, perfMark } from '../staging';
import { queuePresentUpload, rebatchBeforeUnload } from './columnClips';
import { awaitRunViews, runFrame } from './reindeerRun';
import { WildMult } from './wildMult';
import { flapGap, pegRest, stepPeg as stepPegOn, studAt, type PegGeom, type PegParams, type PegPath, type PegState } from './wheelPeg';
import { WHEEL_SLICES, WHEEL_STEP, curveAt, curveLength, ringAtPointer, ringCurve, slotAtPeg, spinCurve, type WheelCurve, type WheelPlan } from '../superWheelPlan';

const TIER = PHONE_TIER ? 'phone' : 'full';
const SHEET = ART.tiers[TIER];
const U = ART.units;
const RUN = ART.run;
const DEG = Math.PI / 180;
type FrameName = keyof typeof SHEET.frames;

// ---- THE SHEET: loaded when a book with a Super opening arrives, let go once its wheel has left ----------------------------
let textures: Map<string, PIXI.Texture> | null = null;
let loading: Promise<boolean> | null = null;
let sheetUrl = '';
let waiting = 0;
let users = 0;
let mipmapper: ((source: PIXI.TextureSource) => void) | null = null;
/** set by components/Board.svelte on the desktop tier: the sheet is drawn well under its size on a small window (house rule) */
export const setWheelMipmapper = (fn: typeof mipmapper) => {
	mipmapper = fn;
};
export const loadWheelArt = (): Promise<boolean> => {
	if (textures) return Promise.resolve(true);
	loading ??= (async () => {
		try {
			sheetUrl = stamp(`/assets/${SHEET.file}`);
			const base = (await PIXI.Assets.load(sheetUrl)) as PIXI.Texture;
			mipmapper?.(base.source);
			await queuePresentUpload('super-wheel', 1, base, () => waiting > 0);
			const map = new Map<string, PIXI.Texture>();
			for (const [name, f] of Object.entries(SHEET.frames)) map.set(name, new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(f.x, f.y, f.w, f.h) }));
			textures = map;
			if (STAGING_TOOLS) perfMark('load:super-wheel');
			return true;
		} catch (error) {
			// without it the round goes on with no wheel (the opening column grows as it always did): never a reason to stop
			console.warn('[reindeer] the wheel sheet failed to load', error);
			loading = null;
			return false;
		}
	})();
	return loading;
};
const awaitWheelArt = async (ms: number): Promise<boolean> => {
	if (textures) return true;
	waiting++;
	try {
		return await Promise.race([loadWheelArt(), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms))]);
	} finally {
		waiting--;
	}
};
/** let the sheet go (GPU and decoded copies) once no wheel draws it: every batch rebuilt and two frames rendered first */
export const releaseWheelArt = async (): Promise<void> => {
	if (loading) await loading;
	if (!textures || users > 0) return;
	const old = textures;
	const url = sheetUrl;
	textures = null;
	loading = null;
	for (const t of old.values()) t.destroy(false);
	await rebatchBeforeUnload();
	try {
		await PIXI.Assets.unload(url);
	} catch {
		/* already gone */
	}
	if (STAGING_TOOLS) perfMark('unload:super-wheel');
};
export const wheelMemory = () => ({ tier: TIER, loaded: textures !== null, sheet: `${SHEET.width}x${SHEET.height}`, mb: textures ? Math.round(((SHEET.width * SHEET.height * 4) / 1048576) * 10) / 10 : 0 });

// ---- geometry and easing -------------------------------------------------------------------------------------------------
/** a point at `deg` clockwise from the top, `r` out, y down */
const pol = (deg: number, r: number): [number, number] => [Math.sin(deg * DEG) * r, -Math.cos(deg * DEG) * r];
/** an angle (radians) brought into (-pi, pi] */
const wrapPi = (a: number) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
const ease = {
	out: (t: number) => 1 - Math.pow(1 - t, 3),
	inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
	back: (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2),
	in: (t: number) => t * t,
	sine: (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t),
};

/** where the layout puts the wheel (components/Board.svelte works it out on every layout pass), canvas CSS px */
export type WheelGeo = {
	cx: number;
	cy: number;
	/** the rim's outer diameter */
	d: number;
	/** the peg's size against the wheel's (it keeps its round 3 size about its tip; SUPER_WHEEL.peg.size on top) */
	pegScale: number;
	/** a phone layout (layoutSpec isPhoneSizeType: the window's short side 480 CSS px or less): the numbers' thicker
	 *  even outline (WILD_MULT.place.wheel evenOutline) */
	phone: boolean;
	/** the top of the LED strip's snow cap: the reindeer's road line stays above it */
	capTop: number;
	/** the road picture's corner and CSS px per road px */
	road: { ox: number; oy: number; k: number };
};
export type WheelPhase = null | 'emerge' | 'rest' | 'runin' | 'leap' | 'drive' | 'slow' | 'slam' | 'land' | 'ringIn' | 'ring' | 'land2' | 'leave' | 'dev';
/** what the wheel asks of the game (components/Board.svelte) */
export type WheelEnv = {
	/** the red present opens again and the wheel rises out of it: its mouth in road px and a cell's height, null when the
	 *  board has none (a round resumed at the opening) */
	openPresent: () => { x: number; y: number; cell: number } | null;
	/** the trigger board drives out, with no traffic after it */
	driveAway: () => void;
	/** the LED strip's line (null: none) */
	led: (text: string | null, tone: 'gold' | 'white', blink: boolean) => void;
	sound: (name: string | null, detail: string, rate?: number) => void;
	runSound: (on: boolean) => void;
	/** the game's roaming reindeer: off the screen while the wheel is up (false), walking back in after it (true) */
	roamer: (on: boolean) => void;
	/** the wheel may start itself (Autoplay Bonuses running, or a replay) */
	auto: () => boolean;
	phase: (phase: WheelPhase) => void;
};

type Task = { at: number; dur: number; fn: (t: number) => void; done?: () => void };

export class SuperWheel {
	readonly root = new PIXI.Container();
	private wrap: PIXI.Container | null = null;
	private disc!: PIXI.Container;
	private wedgeLayer!: PIXI.Container;
	private wedges: PIXI.Container[] = [];
	/** each wedge's own picture (its colour, its bust; the number beside it in the same container) */
	private wedgeArt: PIXI.Sprite[] = [];
	private hiLayer!: PIXI.Container;
	private bulbs: { s: PIXI.Sprite; on: PIXI.Texture; off: PIXI.Texture }[] = [];
	private lights!: PIXI.Container;
	private ringWrap!: PIXI.Container;
	private ring!: PIXI.Container;
	private hub!: PIXI.Container;
	private medal!: PIXI.Sprite;
	private tag!: PIXI.Sprite;
	private autoRing!: PIXI.Graphics;
	private pegWrap!: PIXI.Container;
	private flap!: PIXI.Sprite;
	private shadow!: PIXI.Sprite;
	private readonly runner = new PIXI.Sprite();
	private parts: Record<string, PIXI.Container> = {};

	env: WheelEnv | null = null;
	private geo: WheelGeo | null = null;
	private plan: WheelPlan | null = null;
	phase: WheelPhase = null;
	private done: ((played: boolean) => void) | null = null;
	private destroyed = false;
	/** the wheel's clock (board ms: scaled by the board's rate), and real ms */
	private clock = 0;
	private real = 0;
	private tasks: Task[] = [];
	/** the disc's turn and the ring's, degrees */
	private theta = -WHEEL_STEP / 2;
	private ringPhi = 0;
	private drift = false;
	private seated = false;
	private curve: WheelCurve | null = null;
	private spinT0 = 0;
	private spinning = false;
	private ringGo: { c: WheelCurve; t0: number } | null = null;
	/** THE PEG'S STATE (game/road/wheelPeg.ts): its turn and speed, the disc's turn it last stepped at, the stud on it (its
	 *  index along the rim, counted through every turn; null: none), the stud that ticked last */
	private peg: PegState = pegRest(-WHEEL_STEP / 2);
	/** whether the disc's last turn was the spin's (a new contact then ticks) or a quiet one (the rest's drift, a pose) */
	private pegLoud = false;
	/** the disc's turn through this frame for the peg: the spin's own curve while it runs (a long frame follows the
	 *  curve's pace inside it), else null (an even pace from where the peg last stepped) */
	private pegPath: ((u: number) => number) | null = null;
	/** the numbers' outline class drawn now (WILD_MULT.place.wheel evenOutline) */
	private outlineClass: 'phone' | 'wide' = 'wide';
	/** DEV and the probe: the flapper frame by frame (wheelPegTrace): `met` the studs whose first contact came in the
	 *  frame, `tick` whether a tick sounded, `gap` the flapper's least clearance to a stud (wheel units, 0: touching) */
	private pegTrace: { real: number; clock: number; theta: number; phi: number; stud: number | null; met: number[]; gap: number; tick: boolean; maxAbs: number; dt: number }[] | null = null;
	/** the wedges' numbers: the Wild multipliers (game/road/wildMult.ts) in each wedge's character's color */
	private nums: WildMult[] = [];
	private mouth: { x: number; y: number; cell: number } | null = null;
	/** the reindeer: his pose (strides, a real number), whether he is shown and on the rim */
	private runPose = 0;
	private runOn = false;
	private onRim = false;
	private autoAt: number | null = null;
	/** when it came to rest (the page's clock): the Autoplay Bonuses wait counts from here */
	private restAt = 0;
	private ledKey = '';
	/** DEV and the probe: the moments of the last wheel (performance.now()), and its counts */
	marks: Record<string, number> = {};
	ticks = 0;
	private played = 0;

	constructor() {
		this.root.visible = false;
		this.runner.visible = false;
		this.root.on('pointertap', () => this.onTap?.());
	}
	/** a press on the wheel (components/Board.svelte: the board's own tap) */
	onTap: (() => void) | null = null;

	get active(): boolean {
		return this.phase !== null;
	}

	layout(geo: WheelGeo | null) {
		this.geo = geo;
		if (geo) this.root.hitArea = new PIXI.Circle(geo.cx, geo.cy, geo.d / 2);
		if (this.wrap && geo) {
			const s = this.pegScaleNow();
			this.pegWrap.scale.set(s);
			this.pegWrap.position.set(0, U.peg.boltY + U.peg.tip * (1 - s));
			this.setOutlineClass(geo.phone ? 'phone' : 'wide');
			this.lights.visible = geo.d >= SUPER_WHEEL.size.bulbsFromPx;
			if (this.seated) this.place(geo.cx, geo.cy, 1, 0);
		}
	}

	/** the peg's drawn scale about its tip: the layout's pegScale times SUPER_WHEEL.peg.size (his 1.11) */
	private pegScaleNow(): number {
		return (this.geo?.pegScale ?? 1) * SUPER_WHEEL.peg.size;
	}
	/** the flapper as the peg's physics sees it (wheel units): its bolt, its length, the contact distance, the studs */
	private pegGeom(): PegGeom {
		const s = this.pegScaleNow();
		return { L: ART.pegFit.flap.tipBelowBoltUnits * s, by: -(U.peg.tipR + U.peg.tip * s), rc: U.studOut + SUPER_WHEEL.peg.tipRadius, studR: U.stud, step: WHEEL_STEP, studOut: U.studOut, hw: ART.pegFit.flap.profile.map((v) => v * s) };
	}
	private pegParams(): PegParams {
		const P = SUPER_WHEEL.peg;
		return { stiffness: P.stiffness, damping: P.damping, fling: P.fling, maxSwing: P.maxSwing, subDeg: P.subDeg, springStepS: P.springStepMs / 1000, flingMax: P.flingMax, edgeDeg: P.edgeDeg };
	}
	/** THE NUMBERS' EVEN OUTLINE for a screen class: the wheel sheet's silhouettes mo_<class>_<color>_<letter> */
	private setOutlineClass(cls: 'phone' | 'wide') {
		this.outlineClass = cls;
		for (const n of this.nums) n.setOutlineArt((ch) => textures?.get(`mo_${cls}_${n.color}_${ch}`) ?? null, 1 / SHEET.density);
	}

	// ---- building ---------------------------------------------------------------------------------------------------------
	private spr(name: string, at: PIXI.Container | null = null): PIXI.Sprite {
		const f = SHEET.frames[name as FrameName];
		const s = new PIXI.Sprite(textures?.get(name) ?? PIXI.Texture.EMPTY);
		if (f) s.anchor.set(f.ox / f.w, f.oy / f.h);
		s.scale.set(1 / SHEET.density);
		at?.addChild(s);
		return s;
	}
	/** the plain disc stretched to a radius (its sheet copy is a quarter of the sheet's density) */
	private discOf(radius: number, tint: number, at: PIXI.Container): PIXI.Sprite {
		const s = this.spr('base', at);
		s.scale.set((radius / U.baseRadius) * (1 / (SHEET.density * 0.25)));
		s.tint = tint;
		return s;
	}

	private build(plan: WheelPlan) {
		this.unbuild();
		const wrap = (this.wrap = new PIXI.Container());
		this.shadow = this.discOf(U.rim, 0x000000, wrap);
		this.shadow.alpha = 0.32;
		this.shadow.position.set(12, 22);
		const disc = (this.disc = new PIXI.Container());
		wrap.addChild(disc);
		const back = this.discOf(U.wedge + 1, 0x14161f, disc);
		const wedgeLayer = (this.wedgeLayer = new PIXI.Container());
		disc.addChild(wedgeLayer);
		this.wedgeArt = [];
		this.wedges = plan.slices.map((slice, i) => {
			const c = new PIXI.Container();
			c.rotation = (WHEEL_STEP / 2 + i * WHEEL_STEP) * DEG;
			this.wedgeArt.push(this.spr(`wedge_${slice.tier}`, c));
			// ITS NUMBER (Corey 2026-11-20: "put the new wild multipliers in the place of the yellow"): the Wild multiplier's
			// letters in the character's own color (WILD_MULT.colors), still, about round 5's number's middle grown with the
			// wedge (tools/build_super_wheel.py MULT_R)
			const num = new WildMult('wheel', WILD_MULT.colors[slice.tier] ?? 'gold', i * 0.37);
			num.root.position.set(0, -U.multR);
			// (the layout page round 3: the letters follow the wedge's arc, one height, the even outline from the sheet)
			if (WILD_MULT.place.wheel.arc) num.setArc(U.multR);
			num.show(slice.m, 'still', 0);
			num.update(0);
			c.addChild(num.root);
			this.nums.push(num);
			wedgeLayer.addChild(c);
			return c;
		});
		this.hiLayer = new PIXI.Container();
		disc.addChild(this.hiLayer);
		// the string lights: three to a wedge, hanging in from the trim, four colours in turn
		const lights = (this.lights = new PIXI.Container());
		disc.addChild(lights);
		this.bulbs = [];
		const colours = ['r', 'y', 'g', 'b'];
		for (let i = 0; i < WHEEL_SLICES * 3; i++) {
			const a = (Math.floor(i / 3) + ((i % 3) + 1) / 4) * WHEEL_STEP;
			const c = colours[i % 4];
			const s = this.spr(`bulb_${c}_on`, lights);
			const [x, y] = pol(a, U.trim.wire[0] - 3);
			s.position.set(x, y);
			s.rotation = a * DEG;
			this.bulbs.push({ s, on: textures?.get(`bulb_${c}_on`) ?? PIXI.Texture.EMPTY, off: textures?.get(`bulb_${c}_off`) ?? PIXI.Texture.EMPTY });
		}
		const rim = new PIXI.Container();
		disc.addChild(rim);
		for (let i = 0; i < WHEEL_SLICES; i++) this.spr('rim', rim).rotation = (WHEEL_STEP / 2 + i * WHEEL_STEP) * DEG;
		const studs = new PIXI.Container();
		disc.addChild(studs);
		for (let i = 0; i < WHEEL_SLICES; i++) {
			const s = this.spr('stud', studs);
			const [x, y] = pol(i * WHEEL_STEP, U.stud);
			s.position.set(x, y);
		}
		// the column ring (spin two), hidden until it rises
		const ringWrap = (this.ringWrap = new PIXI.Container());
		wrap.addChild(ringWrap);
		const ring = (this.ring = new PIXI.Container());
		ringWrap.addChild(ring);
		this.spr('ring', ring);
		for (let n = 0; n < 5; n++) {
			const c = new PIXI.Container();
			c.rotation = n * 72 * DEG;
			this.spr(`col_${n + 1}`, c).position.set(0, -(U.ring[0] + U.ring[1]) / 2 + 20);
			ring.addChild(c);
		}
		this.spr('ring_ptr', ringWrap);
		ringWrap.visible = false;
		// the hub: still, with the winner's medal (spin two) and the SPIN tag (the rest)
		const hub = (this.hub = new PIXI.Container());
		wrap.addChild(hub);
		const hubArt = this.spr('hub', hub);
		this.medal = this.spr(`medal_${plan.real.tier}`, hub);
		this.medal.alpha = 0;
		this.tag = this.spr('tag', hub);
		this.tag.visible = false;
		this.autoRing = new PIXI.Graphics();
		hub.addChild(this.autoRing);
		// the peg at the top: its bracket still, its flapper on the bolt
		const pegWrap = (this.pegWrap = new PIXI.Container());
		wrap.addChild(pegWrap);
		this.flap = this.spr('peg_flap', pegWrap);
		const bracket = this.spr('peg_bracket', pegWrap);
		this.root.addChild(wrap, this.runner);
		this.parts = { shadow: this.shadow, back, wedges: wedgeLayer, hi: this.hiLayer, lights, rim, studs, ring: ringWrap, hub: hubArt, medal: this.medal, tag: this.tag, peg: pegWrap, bracket, runner: this.runner };
		this.theta = -WHEEL_STEP / 2;
		this.ringPhi = 0;
		this.peg = pegRest(this.theta);
		this.pegPath = null;
		disc.rotation = this.theta * DEG;
		this.setOutlineClass(this.geo?.phone ? 'phone' : 'wide');
		this.layout(this.geo);
	}

	private unbuild() {
		if (!this.wrap) return;
		for (const n of this.nums) n.destroy();
		this.nums = [];
		this.wrap.destroy({ children: true });
		this.wrap = null;
		this.runner.removeFromParent();
		this.runner.visible = false;
		this.runner.texture = PIXI.Texture.EMPTY;
		this.wedges = [];
		this.wedgeArt = [];
		this.bulbs = [];
		this.parts = {};
	}

	private place(x: number, y: number, s: number, rotDeg: number) {
		const g = this.geo;
		if (!this.wrap || !g) return;
		this.wrap.position.set(x, y);
		this.wrap.scale.set((s * g.d) / (2 * U.rim));
		this.wrap.rotation = rotDeg * DEG;
	}

	private task(delay: number, dur: number, fn: (t: number) => void, done?: () => void) {
		this.tasks.push({ at: this.clock + delay, dur, fn, done });
	}
	private setPhase(phase: WheelPhase) {
		this.phase = phase;
		this.marks[String(phase)] = performance.now();
		this.env?.phase(phase);
	}
	private led(text: string | null, tone: 'gold' | 'white' = 'gold', blink = false) {
		const key = `${text}|${tone}|${blink}`;
		if (key === this.ledKey) return;
		this.ledKey = key;
		this.env?.led(text, tone, blink);
	}
	private nameOf(i: number): string {
		const s = this.plan!.slices[i];
		return `${SUPER_WHEEL.text.names[s.tier]} ${s.m}X`;
	}

	// ---- the sequence -----------------------------------------------------------------------------------------------------
	/** THE WHEEL of this plan, from the emergence to its leaving. Resolves true when it has left (the column grows next),
	 *  false when it could not play (its pictures did not come in time, a character it has no wedge for): the round then
	 *  goes on exactly as it did before the wheel existed. */
	async play(plan: WheelPlan): Promise<boolean> {
		if (this.active || this.destroyed) return false;
		if (plan.slices.some((s) => !SHEET.frames[`wedge_${s.tier}` as FrameName])) return false;
		users++;
		const ok = await awaitWheelArt(SUPER_WHEEL.loadWaitMs);
		void awaitRunViews(1);
		if (!ok || !this.geo || this.destroyed || this.active) {
			users--;
			return false;
		}
		this.plan = plan;
		this.marks = { start: performance.now() };
		this.ticks = 0;
		this.clock = 0;
		this.real = 0;
		this.tasks = [];
		this.curve = null;
		this.ringGo = null;
		this.spinning = false;
		this.drift = false;
		this.seated = false;
		this.runOn = false;
		this.onRim = false;
		this.autoAt = null;
		this.ledKey = '';
		this.build(plan);
		this.root.visible = true;
		this.root.eventMode = 'static';
		this.root.cursor = 'pointer';
		return new Promise<boolean>((resolve) => {
			this.done = resolve;
			this.beatEmerge();
		});
	}

	private finish(played: boolean) {
		const done = this.done;
		this.done = null;
		this.tasks = [];
		this.spinning = false;
		this.ringGo = null;
		this.drift = false;
		this.seated = false;
		if (this.runOn) this.env?.runSound(false);
		this.runOn = false;
		this.led(null);
		this.ledKey = '';
		this.root.visible = false;
		this.root.eventMode = 'none';
		this.unbuild();
		this.marks.done = performance.now();
		this.played += 1;
		this.phase = null;
		this.env?.phase(null);
		if (users > 0) users--;
		if (played) this.env?.roamer(true);
		// (two frames on, with every batch rebuilt, the sheet goes: the next Super round loads it again from the cache)
		void releaseWheelArt();
		done?.(played);
	}

	/** THE EMERGENCE: the red present's lid pops, the wheel rises out of it small and turning, then arcs and grows to its
	 *  place while the traffic drives out */
	private beatEmerge() {
		const E = SUPER_WHEEL.emerge;
		const g = this.geo!;
		this.setPhase('emerge');
		this.env?.roamer(false);
		this.led(SUPER_WHEEL.text.emerge, 'gold');
		this.mouth = this.env?.openPresent() ?? null;
		this.wrap!.alpha = 0;
		const t0 = this.mouth ? E.lidMs : 0;
		const from = () => {
			const G = this.geo ?? g;
			const m = this.mouth;
			// no present on the board (a round resumed at its opening): it grows where it will stand
			if (!m) return { x: G.cx, y: G.cy, cell: 0 };
			return { x: G.road.ox + m.x * G.road.k, y: G.road.oy + m.y * G.road.k, cell: m.cell * G.road.k };
		};
		this.task(t0, E.riseMs, (t) => {
			const e = ease.out(t);
			const m = from();
			this.wrap!.alpha = Math.min(1, t * 4);
			this.place(m.x, m.y - e * m.cell * E.riseCells, E.startScale + (E.riseScale - E.startScale) * e, -E.turnDeg + (E.turnDeg / 2) * e);
		});
		this.task(
			t0 + E.riseMs,
			E.growMs,
			(t) => {
				const G = this.geo ?? g;
				const e = ease.inOut(t);
				const m = from();
				const y0 = m.y - m.cell * E.riseCells;
				const arc = Math.sin(Math.PI * e) * G.d * E.arc * (this.mouth ? 1 : 0);
				this.wrap!.alpha = 1;
				this.place(m.x + (G.cx - m.x) * e, y0 + (G.cy - y0) * e - arc, E.riseScale + (1 - E.riseScale) * ease.back(t), (-E.turnDeg / 2) * (1 - ease.out(t)));
			},
			() => this.beatRest(),
		);
		this.task(t0 + E.riseMs * E.trafficAt, 0, () => this.env?.driveAway());
	}

	/** THE READ BEAT: it rests, drifting so every wedge passes upright under the peg, until the press (or, with Autoplay
	 *  Bonuses, autoWaitMs of real time) */
	private beatRest() {
		const g = this.geo!;
		this.seated = true;
		this.place(g.cx, g.cy, 1, 0);
		this.drift = true;
		this.tag.visible = true;
		this.autoAt = null;
		this.restAt = performance.now();
		this.setPhase('rest');
	}

	/** THE PRESS at rest (the Spin key, Space, a press on the wheel or the board): true when it took */
	press(): boolean {
		if (this.phase !== 'rest') return false;
		this.spinPressed();
		return true;
	}

	private runnerWidth(): number {
		return RUN.boxShare * this.geo!.d;
	}
	private placeRunner(x: number, y: number, rotDeg: number, dir: 1 | -1) {
		const f = runFrame('R', (((Math.floor(this.runPose) % 16) + 16) % 16) + 1);
		const r = this.runner;
		if (!f) {
			r.visible = false;
			return;
		}
		r.visible = this.runOn;
		r.texture = f.texture;
		r.anchor.set(RUN.anchorX / RUN.frameW, RUN.anchorY / RUN.frameH);
		const k = this.runnerWidth() / f.texture.width;
		r.scale.set(k * dir, k);
		r.position.set(x, y);
		r.rotation = rotDeg * DEG;
	}
	/** his feet point on the rim for a pose (canvas px): the body tangent to the rim at the shoulder, lowered by the
	 *  pose's own measured amount so its lowest hoof is on the rim's edge */
	private rimAnchor(pose: number): [number, number] {
		const g = this.geo!;
		const u = g.d / (2 * U.rim);
		const a = RUN.shoulderDeg * DEG;
		const T = [Math.cos(a), Math.sin(a)];
		const N = [Math.sin(a), -Math.cos(a)];
		const sBar = -RUN.contactBackFramePx * ((RUN.boxShare * 2 * U.rim) / RUN.frameW);
		const lower = RUN.poses[(((Math.floor(pose) % 16) + 16) % 16)].lower;
		const bx = Math.sin(a) * U.rim - sBar * T[0] - lower * N[0];
		const by = -Math.cos(a) * U.rim - sBar * T[1] - lower * N[1];
		return [g.cx + bx * u, g.cy + by * u];
	}
	private ground(): [number, number] {
		const g = this.geo!;
		const R = g.d / 2;
		return [Math.max(this.runnerWidth() * 0.35, g.cx - R * 1.05), Math.min(g.cy + R * SUPER_WHEEL.run.groundY, g.capTop - SUPER_WHEEL.run.groundClear)];
	}
	/** canvas px of rim the planted hoof sweeps per pose */
	private sweepPx(): number {
		return RUN.sweepFramePx * (this.runnerWidth() / RUN.frameW);
	}

	/** THE DRIVE: the reindeer runs in on the road, leaps onto the wheel's left shoulder and runs on the rim */
	private spinPressed() {
		const Rn = SUPER_WHEEL.run;
		this.marks.press = performance.now();
		this.autoAt = null;
		this.autoRing.clear();
		this.tag.visible = false;
		this.led(SUPER_WHEEL.text.go, 'gold');
		this.runOn = true;
		this.runPose = 0;
		this.setPhase('runin');
		this.env?.runSound(true);
		const startX = -this.runnerWidth() * 0.7;
		if (Rn.runInMs > 0)
			this.task(0, Rn.runInMs, (t) => {
				const [gx, gy] = this.ground();
				this.runPose = ((gx - startX) * t) / this.sweepPx();
				this.placeRunner(startX + (gx - startX) * t, gy, 0, 1);
			});
		let pose0 = 0;
		this.task(
			Rn.runInMs,
			Rn.leapMs,
			(t) => {
				if (this.phase === 'runin') {
					this.setPhase('leap');
					pose0 = this.runPose;
				}
				const g = this.geo!;
				const [gx, gy] = this.ground();
				// he lands in the pose he will have, on the place that pose stands on the rim
				const land = pose0 + (Rn.leapPose * 60 * Rn.leapMs) / 1000;
				const [fx, fy] = this.rimAnchor(land);
				const e = ease.sine(t);
				this.runPose = pose0 + (land - pose0) * t;
				this.placeRunner(gx + (fx - gx) * e, gy + (fy - gy) * e - Math.sin(Math.PI * t) * (g.d / 2) * Rn.leapArc, RUN.shoulderDeg * e, 1);
			},
			() => this.beatDrive(),
		);
	}

	private beatDrive() {
		const S = SUPER_WHEEL.spin;
		const Rn = SUPER_WHEEL.run;
		this.setPhase('drive');
		this.env?.sound(SUPER_WHEEL.sound.leapOn, 'the reindeer lands on the rim');
		this.drift = false;
		this.curve = spinCurve(this.theta, this.plan!, { driveMs: Rn.driveMs, decelMs: S.decelMs, power: S.power, minDeg: S.minDeg, crawlDeg: S.crawlDeg, extraTurns: S.extraTurns });
		this.spinT0 = this.clock;
		this.spinning = true;
		this.onRim = true;
		// at the hand over he leaps off backward onto the road and trots out to the left
		let from: [number, number] | null = null;
		let pose0 = 0;
		this.task(
			Rn.driveMs,
			Rn.leapOffMs,
			(t) => {
				const g = this.geo!;
				if (this.onRim) {
					this.onRim = false;
					from = [this.runner.x - g.cx, this.runner.y - g.cy];
					pose0 = this.runPose;
					if (this.phase === 'drive') this.setPhase('slow');
				}
				const R = g.d / 2;
				const x0 = g.cx + from![0];
				const y0 = g.cy + from![1];
				const x1 = g.cx - R * 1.25;
				const y1 = this.ground()[1];
				const secs = (t * Rn.leapOffMs) / 1000;
				if (t < 0.6) {
					const u = t / 0.6;
					this.runPose = pose0 + Rn.leapOffPose * 60 * secs;
					this.placeRunner(x0 + (x1 - x0) * u, y0 + (y1 - y0) * ease.in(u) - Math.sin(Math.PI * u) * R * Rn.leapOffArc, RUN.shoulderDeg * (1 - u), -1);
				} else {
					const u = (t - 0.6) / 0.4;
					this.runPose = pose0 + Rn.leapOffPose * 60 * 0.6 * (Rn.leapOffMs / 1000) + Rn.trotPose * 60 * (secs - 0.6 * (Rn.leapOffMs / 1000));
					this.placeRunner(x1 - (x1 + this.runnerWidth()) * u, y1, 0, -1);
				}
			},
			() => {
				this.runOn = false;
				this.runner.visible = false;
				this.env?.runSound(false);
			},
		);
	}

	private setTheta(theta: number, quiet = false) {
		const prev = this.theta;
		this.theta = theta;
		if (this.disc) this.disc.rotation = theta * DEG;
		// (a stud's tick is its contact with the flapper's tip: stepPeg)
		if (theta !== prev) this.pegLoud = !quiet;
	}

	/** A TICK'S SOUND, never closer to the one before than SUPER_WHEEL.sound.tickMinMs of real time (the page's clock): a
	 *  fast wheel, a slam or a slow frame can pass several studs at once, and a tick every frame is a buzz, not a ratchet.
	 *  A tick due sooner is simply not played. */
	private lastTickAt = -Infinity;
	private tick(name: string | null, detail: string): boolean {
		const now = performance.now();
		if (now - this.lastTickAt < SUPER_WHEEL.sound.tickMinMs) return false;
		this.lastTickAt = now;
		this.env?.sound(name, detail);
		return true;
	}

	/** THE PEG (Corey 2026-11-20: "the pin moves way too early"; the layout page round 3: "the pin ... should be bouncing
	 *  most of the spins"): game/road/wheelPeg.ts steps it (the whole flapper meets the studs, it flicks when a stud lets go,
	 *  a damped spring brings it back straight; constants SUPER_WHEEL.peg). Every stud's first contact is a tick (a spin's,
	 *  not the rest's drift), each through tick()'s tickMinMs. It never pushes the wheel.
	 *  Until 2026-11-20 the push was a ramp by angle alone, from contactDeg (9 degrees, about 60 units of rim) before a
	 *  stud's middle reached the top, while the tip hung at radius 404, outside the studs' outer edge (402.9); then (the
	 *  rework) the tip alone met the studs, posed where a stud crossing between frames would leave it, with no flick. */
	private stepPeg(dt: number, path: PegPath = this.theta) {
		const G = this.pegGeom();
		const r = stepPegOn(this.peg, path, dt, G, this.pegParams());
		let ticked = false;
		for (const c of r.contacts) {
			if (!this.pegLoud) continue;
			this.ticks += 1;
			ticked = this.tick(SUPER_WHEEL.sound.tick, `stud ${this.ticks}`) || ticked;
		}
		if (import.meta.env.DEV && this.pegTrace && this.pegTrace.length < 20000) {
			let gap = Infinity;
			const k0 = Math.round(-this.theta / WHEEL_STEP);
			for (let k = k0 - 1; k <= k0 + 1; k++) {
				const [sx, sy] = studAt(k, this.theta, G);
				gap = Math.min(gap, flapGap(this.peg.phi, sx, sy, G));
			}
			this.pegTrace.push({ real: performance.now(), clock: this.clock, theta: this.theta, phi: this.peg.phi, stud: r.on, met: r.contacts.map((c) => c.stud), gap, tick: ticked, maxAbs: r.maxAbs, dt });
		}
		// (its art's tip hangs a little off its bolt's upright line: turned back onto it)
		const rest = (Math.atan2(ART.pegFit.flap.tipOffsetUnits, ART.pegFit.flap.tipBelowBoltUnits) * 180) / Math.PI;
		this.flap.rotation = (this.peg.phi + rest) * DEG;
	}

	/** DEV and the probe: record the flapper frame by frame from now (true), or read and stop (false) */
	devPegTrace(on: boolean) {
		const out = this.pegTrace;
		this.pegTrace = on ? [] : null;
		return out;
	}

	/** A PRESS DURING THE SPIN (the slam stop's press; components/Board.svelte passes stopButtonClick here): straight to the
	 *  book's wedge, or the ring straight to the book's column. Speed only: where it stops was fixed before the spin. */
	skip(): boolean {
		const S = SUPER_WHEEL;
		if (this.phase === 'runin' || this.phase === 'leap' || this.phase === 'drive' || this.phase === 'slow') {
			this.tasks = [];
			this.runOn = false;
			this.onRim = false;
			this.runner.visible = false;
			this.env?.runSound(false);
			this.spinning = false;
			this.drift = false;
			const c = this.curve ?? spinCurve(this.theta, this.plan!, { driveMs: S.run.driveMs, decelMs: S.spin.decelMs, power: S.spin.power, minDeg: 0, crawlDeg: 0, extraTurns: 0 });
			const end = c.from - c.dTot;
			const from = this.theta;
			const left = (((from - end) % 360) + 360) % 360;
			this.setPhase('slam');
			this.task(
				0,
				S.slamMs,
				(t) => this.setTheta(from - left * ease.out(t)),
				() => this.beatLand(),
			);
			return true;
		}
		if (this.phase === 'ring' && this.ringGo) {
			const target = -(this.plan!.real.reel * 72 + this.plan!.ringOff * 72);
			const left = (((this.ringPhi - target) % 360) + 360) % 360;
			const tb = S.slamMs / 1000;
			this.ringGo = { c: { from: this.ringPhi, dTot: left, ta: 0.001, tb, p: S.ring.power, vMax: left / (0.0005 + tb / (S.ring.power + 1)) }, t0: this.clock };
			return true;
		}
		return false;
	}

	/** SPIN ONE STOPS: the wedge lifts a little, its full shape lights under the string lights, the LED names who and the
	 *  multiplier; then the second pick */
	private beatLand() {
		const L = SUPER_WHEEL.land;
		const plan = this.plan!;
		this.setPhase('land');
		this.spinning = false;
		const s = plan.slices[plan.at];
		this.env?.sound(SUPER_WHEEL.sound.land, `the wheel stops on ${s.tier} ${s.m}x`);
		if (s.tier === 'santa' && s.m >= SUPER_WHEEL.sound.landHighFrom) this.env?.sound(SUPER_WHEEL.sound.landHigh, 'a high Santa');
		this.led(this.nameOf(plan.at), 'gold', true);
		const deg = WHEEL_STEP / 2 + plan.at * WHEEL_STEP;
		const hi = this.spr('hi', this.hiLayer);
		hi.rotation = deg * DEG;
		hi.alpha = 0;
		const w = this.wedges[plan.at];
		this.wedgeLayer.addChild(w); // over its neighbours, still under the highlight and the lights
		const [px, py] = pol(deg, L.liftAt);
		w.pivot.set(0, -L.liftAt);
		w.position.set(px, py);
		this.task(
			0,
			L.ms,
			(t) => {
				const up = Math.sin(Math.PI * Math.min(1, t * 1.6)) * 0.12 + (t > 0.62 ? 0.04 : 0.12 * Math.min(1, t * 1.6));
				w.scale.set(1 + up * L.liftScale);
				hi.alpha = Math.min(1, t * 4);
			},
			() => this.beatRing(hi),
		);
	}

	/** SPIN TWO: the ring of the five columns rises round the hub, the hub winds it and lets go, it slows under its own
	 *  pointer onto the book's column */
	private beatRing(hi: PIXI.Sprite) {
		const Rg = SUPER_WHEEL.ring;
		const plan = this.plan!;
		this.setPhase('ringIn');
		this.env?.sound(SUPER_WHEEL.sound.ringIn, 'the column ring rises');
		this.ringWrap.visible = true;
		this.ringPhi = -72 * plan.ringStart;
		this.ring.rotation = this.ringPhi * DEG;
		this.task(0, Rg.inMs, (t) => {
			hi.alpha = 1 - 0.5 * t;
			this.ringWrap.scale.set(0.01 + 0.99 * ease.back(t));
			this.medal.alpha = t;
		});
		this.task(
			Rg.inMs,
			Rg.windMs,
			(t) => (this.hub.rotation = -Rg.windDeg * Math.sin(Math.PI * t) * DEG),
			() => {
				this.hub.rotation = 0;
				this.setPhase('ring');
				this.ringGo = { c: ringCurve(this.ringPhi, plan, { driveMs: Rg.driveMs, decelMs: Rg.decelMs, power: Rg.power, minDeg: Rg.minDeg }), t0: this.clock };
			},
		);
	}

	private setRing(phi: number) {
		const prev = this.ringPhi;
		this.ringPhi = phi;
		this.ring.rotation = phi * DEG;
		if (Math.floor((-prev + 36) / 72) !== Math.floor((-phi + 36) / 72)) this.tick(SUPER_WHEEL.sound.ringTick, 'the ring ticks');
	}

	private beatLand2() {
		const plan = this.plan!;
		this.ringGo = null;
		this.setPhase('land2');
		this.env?.sound(SUPER_WHEEL.sound.land2, `the ring stops on column ${plan.real.reel + 1}`);
		this.led(`${SUPER_WHEEL.text.column} ${plan.real.reel + 1}`, 'gold', true);
		const hi = this.spr('ring_hi', this.ring);
		hi.rotation = plan.real.reel * 72 * DEG;
		hi.alpha = 0;
		this.task(0, 200, (t) => (hi.alpha = t));
		this.task(SUPER_WHEEL.ring.land2Ms, 0, () => this.beatLeave());
	}

	/** it shrinks into the result's column and is gone: the column grows there next (the game's own entrance) */
	private beatLeave() {
		const g = this.geo!;
		this.setPhase('leave');
		this.seated = false;
		this.env?.sound(SUPER_WHEEL.sound.leave, 'the wheel leaves');
		const reel = this.plan!.real.reel;
		this.task(
			0,
			SUPER_WHEEL.leaveMs,
			(t) => {
				const G = this.geo ?? g;
				const tx = G.road.ox + (ROAD_ART.board.x + (reel + 0.5) * ROAD_ART.board.pitch) * G.road.k;
				const ty = G.road.oy + ((ROAD_ART.laneLines[0] + ROAD_ART.laneLines[ROAD_ART.board.rows]) / 2) * G.road.k;
				const e = ease.in(t);
				this.place(G.cx + (tx - G.cx) * e, G.cy + (ty - G.cy) * e, 1 - (1 - SUPER_WHEEL.leaveScale) * e, 0);
				this.wrap!.alpha = 1 - e * e;
			},
			() => this.finish(true),
		);
	}

	// ---- the frame ----------------------------------------------------------------------------------------------------------
	/** `dtMs` real ms (the dev clock applied), `rate` the board's pace (turbo, a slam stop's hurry) */
	update(dtMs: number, rate: number) {
		// the wedges' numbers draw (still) as soon as the multiplier atlas is in, the dev pose included
		if (this.wrap) for (const n of this.nums) n.update(this.clock);
		if (!this.active || !this.wrap || this.phase === 'dev') return;
		if (!this.geo) return;
		const dt = Math.min(100, dtMs) * rate;
		const clock0 = this.clock;
		this.clock += dt;
		this.pegPath = null;
		this.real += Math.min(100, dtMs);
		for (const t of this.tasks.slice()) {
			if (this.clock < t.at) continue;
			if (!this.tasks.includes(t)) continue;
			const u = t.dur > 0 ? Math.min(1, (this.clock - t.at) / t.dur) : 1;
			t.fn(u);
			if (u >= 1) {
				const i = this.tasks.indexOf(t);
				if (i >= 0) this.tasks.splice(i, 1);
				t.done?.();
			}
			if (!this.wrap) return;
		}
		if (this.drift) this.setTheta(this.theta - (SUPER_WHEEL.rest.driftDps * dt) / 1000, true);
		if (this.spinning && this.curve) {
			const c = this.curve;
			const tS = (this.clock - this.spinT0) / 1000;
			const prev = this.theta;
			this.setTheta(c.from - curveAt(c, tS));
			// the peg follows the curve's own pace through this frame (from where it last stepped to here)
			const t0 = this.spinT0;
			const th0 = this.peg.theta;
			const a0 = (clock0 - t0) / 1000;
			this.pegPath = a0 > 0 ? (u: number) => c.from - curveAt(c, a0 + (u * dt) / 1000) : (u: number) => th0 + (this.theta - th0) * u;
			// on the rim his pose comes from the rim's own travel: his hooves move with its surface
			if (this.onRim) {
				const travel = Math.abs(this.theta - prev) * DEG * (this.geo.d / 2);
				this.runPose += travel / this.sweepPx();
				const [x, y] = this.rimAnchor(this.runPose);
				this.placeRunner(x, y, RUN.shoulderDeg, 1);
			}
			// during the slow-down the LED names the wedge under the peg
			if (this.phase === 'slow') this.led(this.nameOf(slotAtPeg(this.theta)), 'white');
			if (tS >= curveLength(c)) this.beatLand();
		}
		if (this.ringGo) {
			const { c, t0 } = this.ringGo;
			const tS = (this.clock - t0) / 1000;
			this.setRing(c.from - curveAt(c, tS));
			this.led(`${SUPER_WHEEL.text.column} ${ringAtPointer(this.ringPhi) + 1}`, 'white');
			if (tS >= curveLength(c)) this.beatLand2();
		}
		if (!this.wrap) return;
		this.stepPeg(dt / 1000, this.pegPath ?? this.theta);
		// the string lights chase: one in three dim, a step every lightsStepMs (real time)
		const k = Math.floor(this.real / SUPER_WHEEL.rest.lightsStepMs) % 3;
		for (let i = 0; i < this.bulbs.length; i++) {
			const b = this.bulbs[i];
			const want = i % 3 !== k ? b.on : b.off;
			if (b.s.texture !== want) b.s.texture = want;
		}
		if (this.phase === 'rest') {
			const R = SUPER_WHEEL.rest;
			this.tag.scale.set((1 + R.tagPulse * Math.sin((this.real / R.tagPulseMs) * Math.PI * 2)) / SHEET.density);
			// AUTOPLAY BONUSES (or a replay): it starts itself after autoWaitMs of real time, a ring round the hub filling;
			// a run stopped in that window leaves it waiting for the press
			const auto = this.env?.auto() ?? false;
			if (auto) {
				// (the page's own clock: real time whatever the frame rate, the turbo level or a slam stop's hurry)
				const now = performance.now();
				this.autoAt ??= this.restAt + SUPER_WHEEL.autoWaitMs;
				this.led(SUPER_WHEEL.text.auto, 'gold');
				const u = 1 - Math.max(0, this.autoAt - now) / SUPER_WHEEL.autoWaitMs;
				this.autoRing.clear();
				this.autoRing.arc(0, 0, 122, -Math.PI / 2, -Math.PI / 2 + Math.max(0.001, u) * Math.PI * 2).stroke({ width: 10, color: 0xffd21f, cap: 'round' });
				if (now >= this.autoAt) {
					this.marks.autoStart = now;
					this.spinPressed();
				}
			} else {
				if (this.autoAt !== null) this.autoRing.clear();
				this.autoAt = null;
				this.led(SUPER_WHEEL.text.press, 'gold', true);
			}
		}
	}

	// ---- DEV and the probe ----------------------------------------------------------------------------------------------------
	/** what the wheel is doing and where it is drawn (canvas CSS px) */
	snapshot() {
		const g = this.geo;
		const plan = this.plan;
		return {
			phase: this.phase,
			played: this.played,
			geo: g ? { cx: g.cx, cy: g.cy, d: g.d, pegScale: g.pegScale, capTop: g.capTop, phone: g.phone } : null,
			wrap: this.wrap ? { x: this.wrap.x, y: this.wrap.y, scale: this.wrap.scale.x, alpha: this.wrap.alpha, rotation: this.wrap.rotation / DEG } : null,
			theta: this.theta,
			ringPhi: this.ringPhi,
			atPeg: slotAtPeg(this.theta),
			ringAt: ringAtPointer(this.ringPhi),
			plan: plan ? { seed: plan.seed, slices: plan.slices.map((s) => `${s.tier} ${s.m}x`), at: plan.at, off: plan.off, real: { ...plan.real }, ringStart: plan.ringStart, ringOff: plan.ringOff } : null,
			runner: { shown: this.runner.visible, onRim: this.onRim, pose: this.runPose, stride: (((Math.floor(this.runPose) % 16) + 16) % 16) + 1, x: this.runner.x, y: this.runner.y, rotation: this.runner.rotation / DEG, scale: this.runner.scale.y, width: this.geo ? this.runnerWidth() : 0 },
			bulbs: this.lights?.visible ?? false,
			peg: this.peg.phi,
			onStud: this.peg.onStud,
			/** the peg as drawn and stepped: its scale, the flapper's length and bolt, the contact distance (wheel units) */
			pegGeo: this.wrap ? { scale: this.pegScaleNow(), ...this.pegGeom() } : null,
			/** the numbers' outline class (WILD_MULT.place.wheel evenOutline) */
			outlineClass: this.outlineClass,
			/** the disc's layers bottom to top (the string lights over the wedges' numbers) */
			discOrder: this.disc && this.wrap ? this.disc.children.map((c) => Object.entries(this.parts).find(([, v]) => v === c)?.[0] ?? '?') : [],
			/** the wedges' numbers, wedge by wedge: the Wild multiplier's color, value and place, how many letters drawn */
			nums: this.nums.map((n) => {
				const st = n.state();
				return { color: st.color, value: st.value, place: st.place, glyphs: n.glyphBounds().length, cap: st.cap, width: st.width, outline: st.outlineArt, arc: st.arc };
			}),
			auto: this.autoAt !== null,
			ticks: this.ticks,
			led: this.ledKey,
			marks: { ...this.marks },
			clock: this.clock,
			tasks: this.tasks.length,
			art: wheelMemory(),
		};
	}
	/** DEV: a wheel standing in its place with nothing running (the probe's stills and its measurements); false when the
	 *  pictures are not in */
	async devShow(plan: WheelPlan): Promise<boolean> {
		if (this.active) return false;
		users++;
		// (a long wait: a probe's fresh page at device pixel ratio 3 is still sending its first sheets to the GPU)
		const ok = (await awaitWheelArt(45000)) && (await awaitRunViews(45000));
		if (!ok || !this.geo) {
			users--;
			return false;
		}
		this.plan = plan;
		this.build(plan);
		this.root.visible = true;
		this.phase = 'dev';
		this.seated = true;
		this.wrap!.alpha = 1;
		this.place(this.geo.cx, this.geo.cy, 1, 0);
		this.peg = pegRest(this.theta);
		this.stepPeg(0);
		return true;
	}
	/** DEV: pose the standing wheel: the disc's and the ring's turn, which pieces draw, the highlights, the reindeer on
	 *  the rim in a stride (1 to 16) */
	devSet(o: { theta?: number; ringPhi?: number; ring?: boolean; hi?: number | null; ringHi?: number | null; only?: string[] | null; stride?: number | null; tag?: boolean; medal?: boolean; slices?: { tier: WheelPlan['slices'][number]['tier']; m: number }[]; numsOnly?: boolean; wedgeOnly?: number | null }) {
		if (this.phase !== 'dev' || !this.wrap) return null;
		// THE WEDGES BY HAND (the probe's and the build's stills: every value in every place): the plan's eight wedges
		// replaced, the wheel built again where it stands
		if (o.slices !== undefined && this.plan && this.geo) {
			this.plan = { ...this.plan, slices: o.slices.map((x) => ({ tier: x.tier, m: x.m })) };
			this.build(this.plan);
			this.wrap!.alpha = 1;
			this.place(this.geo.cx, this.geo.cy, 1, 0);
			this.peg = pegRest(this.theta);
			this.stepPeg(0);
		}
		// only the wedges' numbers drawn of the wedges (their pictures hidden): the probe's measure of the numbers' pixels
		if (o.numsOnly !== undefined) for (const a of this.wedgeArt) a.renderable = !o.numsOnly;
		// one wedge drawn alone (null: all): the probe's measure of a wedge's own picture against its own outline
		if (o.wedgeOnly !== undefined) this.wedges.forEach((w, i) => (w.renderable = o.wedgeOnly === null || i === o.wedgeOnly));
		if (o.theta !== undefined) {
			this.setTheta(o.theta, true);
			// the flapper meets the studs where they now are
			this.peg = pegRest(this.theta);
			this.stepPeg(0);
		}
		if (o.ringPhi !== undefined) {
			this.ringPhi = o.ringPhi;
			this.ring.rotation = o.ringPhi * DEG;
		}
		if (o.ring !== undefined) {
			this.ringWrap.visible = o.ring;
			this.ringWrap.scale.set(1);
		}
		if (o.tag !== undefined) this.tag.visible = o.tag;
		if (o.medal !== undefined) this.medal.alpha = o.medal ? 1 : 0;
		if (o.hi !== undefined) {
			this.hiLayer.removeChildren().forEach((c) => c.destroy());
			if (o.hi !== null) this.spr('hi', this.hiLayer).rotation = (WHEEL_STEP / 2 + o.hi * WHEEL_STEP) * DEG;
		}
		if (o.ringHi !== undefined) {
			this.ring.children.filter((c) => c.label === 'ringHi').forEach((c) => c.destroy());
			if (o.ringHi !== null) {
				const s = this.spr('ring_hi', this.ring);
				s.label = 'ringHi';
				s.rotation = o.ringHi * 72 * DEG;
			}
		}
		if (o.only !== undefined) for (const [name, part] of Object.entries(this.parts)) part.renderable = o.only === null || o.only.includes(name);
		if (o.stride !== undefined) {
			this.runOn = o.stride !== null;
			this.runner.visible = this.runOn;
			if (o.stride !== null) {
				this.runPose = o.stride - 1;
				const [x, y] = this.rimAnchor(this.runPose);
				this.placeRunner(x, y, RUN.shoulderDeg, 1);
			}
		}
		return this.snapshot();
	}
	/** DEV: the standing wheel spins its real spin one (this plan's curve from where it stands, as beatDrive makes it), stepped
	 *  by hand: devSpin() starts it, devSpinStep(ms) moves it ms of board time (the peg stepped with it); after the stop
	 *  the peg goes on settling. The build's frame by frame pictures of the peg (no round needed) */
	private devCurve: WheelCurve | null = null;
	private devT = 0;
	devSpin(off?: number) {
		if (this.phase !== 'dev' || !this.plan) return false;
		// (the stop inside its wedge by hand, -0.3 to 0.3 of a wedge: the build's pictures of a pin leaning on a stud)
		if (off !== undefined) this.plan = { ...this.plan, off: Math.max(-0.3, Math.min(0.3, off)) };
		const S = SUPER_WHEEL.spin;
		this.devCurve = spinCurve(this.theta, this.plan, { driveMs: SUPER_WHEEL.run.driveMs, decelMs: S.decelMs, power: S.power, minDeg: S.minDeg, crawlDeg: S.crawlDeg, extraTurns: S.extraTurns });
		this.devT = 0;
		this.ticks = 0;
		this.peg = pegRest(this.theta);
		this.stepPeg(0);
		return curveLength(this.devCurve);
	}
	devSpinStep(ms: number) {
		const c = this.devCurve;
		if (this.phase !== 'dev' || !c) return null;
		const a0 = this.devT / 1000;
		this.devT += ms;
		const len = curveLength(c);
		const tS = Math.min(this.devT / 1000, len);
		this.setTheta(c.from - curveAt(c, tS));
		// (the curve's own pace through the step, as update() steps it)
		this.stepPeg(ms / 1000, (u: number) => c.from - curveAt(c, Math.min(len, a0 + (u * ms) / 1000)));
		return { t: this.devT, theta: this.theta, phi: this.peg.phi, onStud: this.peg.onStud, ticks: this.ticks, done: this.devT / 1000 >= len };
	}
	devEnd() {
		if (this.phase !== 'dev') return;
		this.root.visible = false;
		this.unbuild();
		this.phase = null;
		this.seated = false;
		if (users > 0) users--;
	}

	destroy() {
		this.destroyed = true;
		const done = this.done;
		this.done = null;
		this.tasks = [];
		this.unbuild();
		this.phase = null;
		this.root.destroy({ children: true });
		done?.(false);
	}
}
