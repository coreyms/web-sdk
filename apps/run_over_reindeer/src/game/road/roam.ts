// THE ROAMING REINDEER (2026-11-17; constants STRIKE.roam and ROAM, game/roamPaths.ts). Corey: "the reindeer is supposed
// to end up being on the screen. Then if more than one reindeer strikes in a turn the second one should come from off the
// screen. A new reindeer should walk in towards the next spin and stay on the screen doing it's idle stuff." And after
// the first build: "an allowed to walk area where it randomly chooses where to go in that area."
//
//   AT REST     one reindeer stands in the snow outside the tunnel, inside his layout's AREA (game/roamPaths.ts). He picks
//               a random spot in it, walks there (walk start, the walk loop, walk stop: the rig's own clips, the stride
//               matched to his speed so the hooves never slide), sniffs for a random while, and picks another. A spot is
//               never one where his body would cover a keep-out zone or leave the screen, nor one whose walk would pass
//               over one; a walk is never steeper than ROAM.maxSlopeDeg (his walk is drawn side on), other heights are
//               reached over several walks; with no such spot the slope rule, then the length rule, is relaxed.
//   THE STRIKE  the first strike of a spin is his (game/road/roadFeatures.ts strike): he stands alert facing the board
//               until his run sets off, then the runner takes over from his feet (the run views). He does not come
//               back. Every later strike of the spin comes from off the screen, as before. Since 2026-11-20 he winds up
//               for it (game/road/chargeWindup.ts, constants ROAM.charge): from the strike's first frame he lowers his
//               antlers and drags a front hoof (or only lowers his head, at Turbo 2 and in a slam stop's hurry), cut by
//               his run at the set off wherever it is. Caught mid walk he goes straight to the stand and winds up from
//               there, as before (no brace from the walk is built).
//   THE WALK IN after the spin's last strike, a new one walks in level from past his side's screen edge to a random spot
//               of the area. Nothing waits on him: a spin that starts before he is on the screen takes its first strike
//               from off the screen, as before.
//
// Everything runs on the board clock (turbo and a slam stop hurry it; the dev hook's frozen clock freezes it), and stops
// while the tab is hidden. His choices come from the game's seeded generator (ROAM.seed 0: a fresh seed each page; the
// probes set one). No allocation in the frame loop: the area's corners and the zones are re-read into reused slots when
// the screen, the layout or the area changes, and when he picks his next spot.
import * as PIXI from 'pixi.js';

import { ROAM, SHADOW, STRIKE } from '../constants';
import type { LayoutKind } from '../layoutSpec';
import { REINDEER_ROAM } from '../reindeerRoamSpec';
import { ROAM_AREAS, ROAM_EDIT, ROAM_REF_RECT, ROAM_TUNNELS, type RoadRect, type RoamArea } from '../roamPaths';
import { ROAD_ART } from '../roadArtSpec';
import { FOREST_LINE } from '../forestLineSpec';
import { ROAM_TREE_PAD, forestLow, roamShortArea, roamShortLimit, roamShortOn, roamShortTop } from '../roamGround';
import { seeded } from './crosshair';
import { chargeFramesReady, roamBox, roamFramesReady, roamTexture, type RoamBox, type RoamClip } from './roamFrames';
import { CHARGE_HIT, windupFirstFrame, windupFrame, type WindupPlan } from './chargeWindup';
import { runBox, runFrame, runViewsReady } from './reindeerRun';
import { castReach, castShadow, makeShadow, shadowStrength } from './shadows';

const K = REINDEER_ROAM.roadPxPerFramePx;
const C = REINDEER_ROAM.clips;
const CLIPS: RoamClip[] = ['walk', 'start', 'stop', 'sniff'];
const BOX: Record<RoamClip, RoamBox> = { walk: roamBox('walk'), start: roamBox('start'), stop: roamBox('stop'), sniff: roamBox('sniff'), charge: roamBox('charge'), chargeDown: roamBox('chargeDown') };
/** (2026-11-20) THE CHARGE WIND-UP's clips, counted in by their solid ink read from the art (tools/build_roam.py
 *  ink_reach: the lowered head raises the antlers; their boxes, 1160 frame px up, count the bulbs' soft glow, and on the
 *  desktop left him almost nowhere to stand), so the keep-outs hold while he winds up where he stands */
const CHARGE_REACH = (['charge', 'chargeDown'] as const).map((c) => C[c].reach);
/** his body's reach from his feet at the built size, road px, whichever clip and whichever way he faces */
export const ROAM_REACH = {
	side: Math.max(...CLIPS.map((c) => Math.max(BOX[c].anchorX, 1 - BOX[c].anchorX) * BOX[c].width), ...CHARGE_REACH.map((q) => Math.max(q.back, q.fwd) * K)),
	up: Math.max(...CLIPS.map((c) => BOX[c].anchorY * BOX[c].height), ...CHARGE_REACH.map((q) => q.up * K)),
	/** how far the charge clips' glow may lie past it, road px (the probes' allowance) */
	glowUp: Math.max(0, ...CHARGE_REACH.map((q) => q.glowUp * K)) - Math.max(...CLIPS.map((c) => BOX[c].anchorY * BOX[c].height), ...CHARGE_REACH.map((q) => q.up * K)),
};
/** the strip at his feet checked against the road (its share of his height) */
const FEET_SHARE = 0.06;
const sum = (a: readonly number[]) => a.reduce((n, v) => n + v, 0);
/** frame px the start and the stop carry the body, in all */
const START_PX = sum(C.start.advance);
const STOP_PX = sum(C.stop.advance);
/** how far past the screen's edge (beyond his widest reach) a walk in starts, road px */
const ENTER_PAD = 12;
/** the sniff loop's pace may be stretched or squeezed this far to fit a stop's length */
const SNIFF_RATE = { min: 0.67, max: 1.5 };
/** tries per pass when he picks a spot (the mock's 220), and the passes (all rules; no slope rule; no length rule) */
const TRIES = 220;
/** THE ROAD PICTURE'S WIDTH, and how far past its left and right edges the snow beyond the art starts (past the tunnels'
 *  stonework), road px */
const IMG_W = ROAD_ART.image.width;
const BEYOND_GAP = 44;
/** THE FLOOR (round 4): the area must hold at least FLOOR_SPOTS spots that far apart (a share of the screen's width), or
 *  it is widened to all the free snow on the screen; and on a pick the valid candidates looked at for the one farthest
 *  from where he has just been */
const FLOOR_SPOTS = 4;
const FLOOR_SEP = 0.12;
/** ...and the ground he can walk must span at least this share of the screen's width (a tall narrow strip by the tunnel
 *  holds spots far apart only up and down, which his side on walk reaches slowly: that is the corner Corey saw) */
const FLOOR_SPAN = 0.3;
/** the art's top snow rim, road px (above the asphalt, which starts at 120): the widened area's favored ground */
const RIM_TOP = -150;
const RIM_Y = 120;
const FLOOR_CELLS = 12000;
/** (2026-11-18: 10 left him re-walking the same stretch of the top rim at 16:9 and 21:9 windows; of 24 found spots the
 *  one farthest from his last stops is reliably new ground) */
const EXPLORE = 24;
/** the share of his level walks drawn along his heading */
const HEADING_ODDS = 0.8;
/** the safety net: gone this long (board clock ms, no strike running, no walk in due), a new one walks in */
const ROAM_RETURN_MS = 6000;
/** the stops he remembers (the newest last): his next spot is the farthest from them he finds */
const RECENT = 6;
/** THE SUPER WHEEL (2026-11-19, Corey: "the walker shouldn't stay for the wheel spin"): as the wheel comes out he stands
 *  startled facing his way out for EXIT_STAND_MS, then runs off the screen's edge in the strike's own side run (the R
 *  view at STRIKE.runSpeed, the stand to run change every strike of his makes). He runs to the side asked (the wheel's
 *  driver's, the left) when that run takes no more than EXIT_PREFER_MS from the stand, else to the nearest edge. He is
 *  gone EXIT_BUDGET_MS after the stand began at the latest: on the widest screens (21:9, from its middle) his run is
 *  sped up to make it (the wheel's shortest emergence, a round resumed at its opening with no present, is 1250 ms; the
 *  wheel's reindeer can run in no sooner). Without the run views (never loaded) he walks off, his legs as fast as it
 *  takes to be gone in EXIT_WALK_MS. Board clock ms. */
const EXIT_STAND_MS = 220;
const EXIT_PREFER_MS = 1100;
const EXIT_BUDGET_MS = 1150;
const EXIT_WALK_MS = 900;
/** a level run off that would cross a tunnel mouth or the forest's trees is tried this many road px lower, step by step */
const EXIT_DROP_STEP = 12;
const EXIT_DROPS = 12;

export type RoamState = 'none' | 'enter' | 'start' | 'walk' | 'stop' | 'idle' | 'alert' | 'exit';
type Pt = { x: number; y: number };
type Box = { name: string; x0: number; y0: number; x1: number; y1: number };

/** THE EDITOR'S BRIDGE (staging tune panel, src/staging/tune/RoamEditor.svelte; the dev hook): the board's view and the
 *  keep-out zones in CSS px (components/Board.svelte sets them), and the roamer. Nothing here draws. */
export type RoamZone = { name: string; x0: number; y0: number; x1: number; y1: number };
export const roamDev = {
	/** CSS px per road px, the picture's top left corner in CSS px, the screen in road px, the layout */
	view: null as null | (() => { kind: LayoutKind; k: number; ox: number; oy: number; rect: RoadRect } | null),
	zones: null as null | (() => RoamZone[]),
	/** (2026-11-18) a cheap key of the keep-outs that come and go without a layout change (the LED back board raised or
	 *  not): read every frame; when it changes the zones are read again and a spot they now cover is left */
	zonesKey: null as null | (() => string),
	roam: null as Roam | null,
};

/** a seed for a page that sets none: the page's own crypto (never Math.random) */
const freshSeed = () => {
	const u = new Uint32Array(1);
	try {
		globalThis.crypto?.getRandomValues?.(u);
	} catch {
		/* the clock below */
	}
	return (u[0] || Date.now()) >>> 0;
};

/** is (x, y) inside the polygon (its first n points) */
const inPoly = (x: number, y: number, P: Pt[], n: number) => {
	let c = false;
	for (let i = 0, j = n - 1; i < n; j = i++) {
		const a = P[i];
		const b = P[j];
		if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
	}
	return c;
};

// ---- THE TUNNEL MOUTHS (2026-11-18, Corey; game/roamPaths.ts ROAM_TUNNELS) ----------------------------------------------
// Each mouth's polygon is made convex (its hull: a little more ground kept out, never less), then grown by his body box
// with the shadow's lean (his feet's "configuration" obstacle): his feet outside it means his body, head and shadow are
// all clear of the mouth. A walk is clear of it when its straight line does not cut the grown polygon (exact). A walk that
// would cut it goes round it by the grown polygon's corners (a few corners, so the shortest way is found exactly).

/** the convex hull of points, counter-clockwise in the y-down screen sense not assumed: orientation is read from the area */
const hull = (pts: Pt[]): Pt[] => {
	const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
	if (p.length < 3) return p;
	const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
	const lower: Pt[] = [];
	for (const q of p) {
		while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
		lower.push(q);
	}
	const upper: Pt[] = [];
	for (let i = p.length - 1; i >= 0; i--) {
		const q = p[i];
		while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
		upper.push(q);
	}
	return lower.slice(0, -1).concat(upper.slice(0, -1));
};
/** which side of its edges a convex polygon's inside is on (1 or -1): the sign of the cross product of an edge with
 *  the polygon's centre (2026-11-18: the first version took the sign from a shoelace sum the other way round, so no
 *  point was ever inside and no walk ever cut a mouth: the probe host saw him stand on them) */
const orient = (P: Pt[]) => {
	let cx = 0;
	let cy = 0;
	for (const p of P) {
		cx += p.x / P.length;
		cy += p.y / P.length;
	}
	const a = P[P.length - 1];
	const b = P[0];
	return (b.x - a.x) * (cy - a.y) - (b.y - a.y) * (cx - a.x) > 0 ? 1 : -1;
};
/** is (x, y) strictly inside the convex polygon P (orientation o: inside is where o x cross > 0 on every edge) */
const inConvex = (x: number, y: number, P: Pt[], o: number) => {
	for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
		const a = P[j];
		const b = P[i];
		if (o * ((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)) <= 1e-9) return false;
	}
	return true;
};
/** does the segment a to b cut the inside of the convex polygon P (orientation o): the part of the segment inside every
 *  edge's half plane, solved (Cyrus-Beck) */
const cutsConvex = (ax: number, ay: number, bx: number, by: number, P: Pt[], o: number) => {
	let lo = 0;
	let hi = 1;
	const dx = bx - ax;
	const dy = by - ay;
	for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
		const a = P[j];
		const b = P[i];
		// inside this edge's half plane: c0 + c1 t > 0
		const c0 = o * ((b.x - a.x) * (ay - a.y) - (b.y - a.y) * (ax - a.x));
		const c1 = o * ((b.x - a.x) * dy - (b.y - a.y) * dx);
		if (Math.abs(c1) < 1e-12) {
			if (c0 <= 1e-9) return false;
			continue;
		}
		const t = -c0 / c1;
		if (c1 > 0) lo = Math.max(lo, t);
		else hi = Math.min(hi, t);
		if (hi - lo <= 1e-9) return false;
	}
	return hi - lo > 1e-9;
};
const TUNNEL_HULLS: Pt[][] = ROAM_TUNNELS.map((P) => hull(P.map((p) => ({ x: p.x, y: p.y }))));
/** a corner of the way round a mouth stands this far off the grown polygon, road px */
const ROUND_PAD = 3;
/** a walk through the TOP CORRIDOR (Corey 2026-11-18: "better for it to go off the screen partially at the top, than it
 *  would be for it to walk over the hill ... kept to a minimum ... it shouldn't stop in the off screen area"): a corner
 *  of the way round a mouth may have him partly above the screen's top (his feet and this share of his height still
 *  on it), never a spot he stops at; such a way costs this many times its length, and a spot reached only that way
 *  scores lower */
const CORRIDOR_SHOWN = 0.4;
const CORRIDOR_COST = 3;
/** THE FOREST (2026-11-19, Corey: "on portrait view the reindeer is walking on the trees"): his feet stay this many road
 *  px below the tree line of the forest drawn behind the upright phone's snow (game/forestLineSpec.ts, per kit) */
const TREE_PAD = ROAM_TREE_PAD;
/** the forest as drawn now (road px) and its kit's tree line, or null where no forest is drawn */
export type RoamForest = { x: number; y: number; width: number; height: number; kit: keyof typeof FOREST_LINE } | null;
/** a walk in routes at most this many candidates round a mouth (each its own tree) */
const WALK_IN_ROUTED = 6;
/** THE SHORT UPRIGHT GROUND (game/roamGround.ts ROAM_SHORT, Corey 2026-11-25: "Look at my shape"): his top edge is
 *  read in columns this many to each of the forest line's; a walk in looks for its way down from above the mouth's arch
 *  for at most this many candidates, turning down at one of this many plus one places (from the screen's edge to the
 *  steepest turn maxSlopeDeg allows) */
const SHORT_COLS = 4;
const SHORT_WAYS = 24;
const SHORT_TURNS = 5;

export class Roam {
	readonly sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
	readonly shadow = makeShadow();
	state: RoamState = 'none';
	/** his feet, road px, and which way he faces (1 = to the right, the rig's own; -1 mirrored) */
	x = 0;
	y = 0;
	facing: 1 | -1 = -1;
	clip: RoamClip = 'sniff';
	/** the rig frame shown (1 based, a float) */
	frame = 1;
	/** when the next walk in starts (board clock), or null */
	walkInAt: number | null = null;
	/** (2026-11-18) when he went with no walk in due (board clock): the safety net brings a new one ROAM_RETURN_MS later
	 *  (a strike that never reached its impact, a spin whose last strike was not marked); null while one is due or on */
	goneAt: number | null = null;
	/** the walk now: from, to, how far along (road px), and its length */
	private from: Pt = { x: 0, y: 0 };
	private to: Pt = { x: 0, y: 0 };
	private u = 0;
	private len = 0;
	/** the walk's way: from, the corners round a tunnel mouth (if any), to; and each leg's length */
	private route: Pt[] = [];
	private legs: number[] = [];
	/** the tunnel mouths grown by his body box (feet space) and their orientation, for this scale */
	private mouths: Pt[][] = [];
	private mouthO: number[] = [];
	private mouthScale = NaN;
	/** the way round the mouths from his spot (a pick's tree): the corners, their cost from him, the corner before, and
	 *  whether the way to them passes the top corridor */
	private nodes: Pt[] = [];
	private nodeCost: number[] = [];
	private nodePrev: number[] = [];
	private nodeTop: boolean[] = [];
	/** the last pick's way uses the top corridor */
	private pickTop = false;
	private moveScale = 1;
	/** the stop now: sniff loops left and their pace */
	private loopsLeft = 1;
	private sniffRate = 1;
	private alertUntil = 0;
	/** THE CHARGE WIND-UP of his strike now (game/road/chargeWindup.ts), or null (the stand, as before) */
	windup: WindupPlan | null = null;
	/** the slow drag's hit (frame 9) has been drawn: never skipped (a slam stop's hurry steps the board clock 50 ms a
	 *  frame, longer than a rig frame), drawn on the first frame its time has come, the next frame catching up */
	private hitShown = false;
	private clock = NaN;
	private placed = false;
	/** a first stand that found no spot (the HUD still settling): tried again from this board clock */
	private placeRetryAt = -Infinity;
	private rnd = seeded(ROAM.seed || freshSeed());
	/** the area resolved for this screen (road px, slots reused) and its bounds; the keep-out zones in road px */
	private poly: Pt[] = [];
	private n = 0;
	private bounds = { x0: 0, y0: 0, x1: 0, y1: 0 };
	/** the snow beyond the art's sides counts (the area's `beyond`); the floor's widening to all free snow (`relaxed`)
	 *  and the spots that far apart the area holds now (`capacity`) */
	private beyond = false;
	/** the floor's widening: 0 none, 1 the art's whole top snow rim joins the area, 2 all the free snow on the screen */
	widen: 0 | 1 | 2 = 0;
	relaxed = false;
	capacity = 0;
	private floorOwn = { spots: 0, span: 0 };
	span = 0;
	/** where he stopped last (the spot before the one he stands on), and the stops before: he does not walk straight back */
	private recent: Pt[] = [];
	/** which way he is sweeping the area (1 = right): a walk in sets it toward the far side, an end of the area turns it */
	private heading: 1 | -1 = -1;
	private zones: Box[] = [];
	private kind: LayoutKind = 'landscape';
	private rect: RoadRect = { left: 0, top: 0, right: 0, bottom: 0 };
	private resolved = { kind: '', l: NaN, t: NaN, r: NaN, b: NaN, v: -1 };
	/** the last pick's pass (0 all rules, 1 no slope rule, 2 no length rule, -1 none found) */
	lastPass = 0;
	/** a walk in is being looked for behind the Fast Lane and Menu signs (pick: only when no way in clears every key), and
	 *  whether the last pick took such a way */
	private passSigns = false;
	underSign = false;
	/** the probes' counters */
	readonly counts = { walks: 0, walkIns: 0, arrived: 0, strikes: 0, placed: 0, cancelled: 0, picks: 0, relaxed: 0, none: 0, safetyNet: 0, left: 0, rounds: 0, corridor: 0, underSign: 0, away: 0, exits: 0, exited: 0, back: 0 };
	/** AWAY (the Super wheel is up, components/Board.svelte): no walk in, no first appearance, no safety net until `back` */
	held = false;
	/** his run off the screen: from, to (road px), how far along, its length, its speed (road px a second), the stand's
	 *  end (board clock), the side run's pose, the run views or the walk; and the last one's plan for the probes */
	private exitFrom: Pt = { x: 0, y: 0 };
	private exitTo: Pt = { x: 0, y: 0 };
	private exitU = 0;
	private exitLen = 0;
	private exitSpeed = 0;
	private exitStandUntil = 0;
	private exitPose = 0;
	private exitRun = true;
	lastExit: { side: 1 | -1; nearest: 1 | -1; fromX: number; fromY: number; toX: number; toY: number; ms: number; run: boolean; preferred: boolean; startedAt: number; doneAt: number | null; screen: [number, number]; worstMs: number } | null = null;
	/** is a strike running on the board (game/road/roadFeatures.ts sets it): the safety net waits for it */
	busy: () => boolean = () => false;
	/** the forest as drawn now (components/Board.svelte sets it: the scene's own placement and the preset's kit) */
	forest: () => RoamForest = () => null;
	/** the tree line in road px: column edges x and the lowest tree row y + TREE_PAD per column (read with the zones) */
	private treeX: number[] = [];
	private treeY: number[] = [];
	private treeKey = '';
	/** THE SHORT UPRIGHT GROUND applies now (game/roamGround.ts ROAM_SHORT: a short upright page whose tree line stands
	 *  under the tunnel mouth's top): his area is Corey's band, the highest his feet may stand is its top edge, his shadow
	 *  may lie behind the logo (the logo is drawn over it), the floor is not widened, and a walk in comes down from above
	 *  the mouth's arch */
	short = false;
	private shortArea: RoamArea | null = null;

	constructor() {
		this.sprite.visible = false;
		this.sprite.label = 'roam';
		this.shadow.label = 'roamShadow';
	}

	/** the area for the layout he is in */
	area(): RoamArea {
		if (this.short && this.shortArea) return this.shortArea;
		return ROAM_AREAS[this.kind] ?? ROAM_AREAS.landscape;
	}

	/** his size on top of the built size: the strike's snow size for the layout (the runner takes over at it) */
	scale(): number {
		return (STRIKE.snow[this.kind] ?? STRIKE.snow.landscape).scale;
	}

	/** the screen's width in road px */
	private screenW(): number {
		return Math.max(1, this.rect.right - this.rect.left);
	}

	/** his pace against the rig's own walk (his legs' stride matches it: no slide), and the walk in's */
	pace(walkIn = false): number {
		const natural = C.walk.groundSpeed * K * this.scale() * REINDEER_ROAM.fps;
		const want = ((ROAM.walkSpeedPct / 100) * this.screenW() * (walkIn ? ROAM.walkInMul : 1)) / natural;
		return Math.max(0.05, Math.min(walkIn ? ROAM.maxInPace : ROAM.maxPace, want));
	}

	reseed(seed: number) {
		this.rnd = seeded(seed >>> 0);
	}

	/** the screen (road px) and the layout; re-reads the area's corners and the zones when either changed (or the area
	 *  was edited), and stands him somewhere valid again if his spot no longer is */
	setView(kind: LayoutKind, rect: RoadRect | null) {
		if (!rect) return;
		const R = this.resolved;
		if (R.kind === kind && R.l === rect.left && R.t === rect.top && R.r === rect.right && R.b === rect.bottom && R.v === ROAM_EDIT.version) return;
		this.kind = kind;
		this.rect.left = rect.left;
		this.rect.top = rect.top;
		this.rect.right = rect.right;
		this.rect.bottom = rect.bottom;
		R.kind = kind;
		R.l = rect.left;
		R.t = rect.top;
		R.r = rect.right;
		R.b = rect.bottom;
		R.v = ROAM_EDIT.version;
		// (the zones and the forest first: whether the short ground applies is read with the tree line)
		this.refreshZones();
		this.resolveArea();
		this.zonesMoved();
		this.measureFloor();
		this.leaveIfCovered();
	}

	/** the area's corners for this screen into the reused slots, and its bounds */
	private resolveArea() {
		const A = this.area();
		while (this.poly.length < A.corners.length) this.poly.push({ x: 0, y: 0 });
		this.n = A.corners.length;
		const B = this.bounds;
		B.x0 = B.y0 = Infinity;
		B.x1 = B.y1 = -Infinity;
		this.beyond = !!A.beyond;
		for (let i = 0; i < this.n; i++) {
			const c = A.corners[i];
			const p = this.poly[i];
			p.x = c.x;
			p.y = c.y;
			B.x0 = Math.min(B.x0, p.x);
			B.y0 = Math.min(B.y0, p.y);
			B.x1 = Math.max(B.x1, p.x);
			B.y1 = Math.max(B.y1, p.y);
		}
	}

	/** a spot that no longer holds (a resize, a rotation, an edited area, a keep-out that came up over him, as the LED back
	 *  board rising): he never pops to a new one; he goes, and a new one walks in from past the screen's edge */
	private leaveIfCovered() {
		// (on a walk round a tunnel mouth he may be outside the area or in the top corridor for a moment: then his spot is
		// judged as a corner of that way, and his target as a stop)
		const walking = this.state === 'start' || this.state === 'walk' || this.state === 'stop';
		const here = walking ? this.clear(this.x, this.y, false, true) : this.valid(this.x, this.y);
		if ((this.state === 'idle' || walking || this.state === 'enter') && !(this.state === 'enter' ? this.valid(this.to.x, this.to.y) : here && (!walking ? true : this.valid(this.to.x, this.to.y)))) {
			this.counts.left++;
			this.state = 'none';
			this.hide();
			this.placed = true;
			this.walkInAt = Number.isFinite(this.clock) ? this.clock : 0;
		}
	}

	/** (2026-11-18) the keep-outs that come and go (roamDev.zonesKey): read again on a change, and a spot now covered left */
	private zonesKeyNow = '';
	private watchZones() {
		const key = roamDev.zonesKey?.() ?? '';
		if (key === this.zonesKeyNow) return;
		this.zonesKeyNow = key;
		this.refreshZones();
		if (this.zonesMoved()) this.measureFloor();
		this.leaveIfCovered();
	}

	/** the keep-out zones in road px, from the board's CSS px ones (a few DOM reads: at a pick or a layout change only) */
	/** the forest's tree line for this frame's forest (a few numbers: re-read with the zones) */
	private refreshTrees() {
		const f = this.forest();
		const key = f ? `${f.kit}|${f.x}|${f.y}|${f.width}|${f.height}|${this.kind}|${this.rect.left}|${this.rect.right}` : '';
		if (key === this.treeKey) return;
		this.treeKey = key;
		this.treeX.length = 0;
		this.treeY.length = 0;
		const was = this.short;
		this.short = false;
		this.shortArea = null;
		const line = f ? (FOREST_LINE[f.kit]?.line as readonly number[] | undefined) : undefined;
		if (f && line) {
			// THE SHORT UPRIGHT GROUND (game/roamGround.ts ROAM_SHORT): under Corey's top edge where it reaches (finer
			// columns), under the tree line elsewhere
			this.short = this.kind === 'portrait' && roamShortOn(forestLow(f, this.rect));
			const top = this.short ? roamShortTop(f) : null;
			if (top) this.shortArea = roamShortArea(f);
			const n = top ? line.length * SHORT_COLS : line.length;
			for (let i = 0; i <= n; i++) this.treeX.push(f.x + (f.width * i) / n);
			for (let i = 0; i < n; i++) {
				const own = f.y + f.height * line[Math.floor((i * line.length) / n)] + TREE_PAD;
				const mound = top ? roamShortLimit(top, this.treeX[i], this.treeX[i + 1]) : NaN;
				this.treeY.push(Number.isFinite(mound) ? mound : own);
			}
		}
		if (this.short || was) this.resolveArea();
	}

	/** are his feet at (x, y) on the trees: above the tree line of the column they stand in */
	private onTrees(x: number, y: number): boolean {
		const X = this.treeX;
		if (!X.length || x < X[0] || x >= X[X.length - 1]) return false;
		let i = 0;
		while (i < this.treeY.length - 1 && x >= X[i + 1]) i++;
		return y < this.treeY[i];
	}

	/** does a straight walk put his feet on the trees anywhere: at its ends and at every column edge it crosses (the line
	 *  is flat in each column, the walk straight, so those are the only places to look) */
	private walkOnTrees(ax: number, ay: number, bx: number, by: number): boolean {
		if (!this.treeX.length) return false;
		if (this.onTrees(ax, ay) || this.onTrees(bx, by)) return true;
		const lo = Math.min(ax, bx);
		const hi = Math.max(ax, bx);
		for (let i = 0; i < this.treeX.length; i++) {
			const x = this.treeX[i];
			if (x <= lo || x >= hi) continue;
			const t = (x - ax) / (bx - ax);
			const y = ay + (by - ay) * t;
			// both columns that meet at this edge
			if ((i > 0 && y < this.treeY[i - 1]) || (i < this.treeY.length && y < this.treeY[i])) return true;
		}
		return false;
	}

	private refreshZones() {
		this.refreshTrees();
		const v = roamDev.view?.();
		const list = roamDev.zones?.() ?? [];
		this.zones.length = 0;
		if (!v) return;
		for (const z of list) this.zones.push({ name: z.name, x0: (z.x0 - v.ox) / v.k, y0: (z.y0 - v.oy) / v.k, x1: (z.x1 - v.ox) / v.k, y1: (z.y1 - v.oy) / v.k });
	}

	/** his body at (x, y) clear of every zone (his feet's strip of the road) and inside the screen (`offScreenOk`: a walk
	 *  in, which starts past the screen's edge) */
	private clear(x: number, y: number, offScreenOk = false, topOk = false): boolean {
		const s = this.scale();
		const x0 = x - ROAM_REACH.side * s;
		const x1 = x + ROAM_REACH.side * s;
		const y0 = y - ROAM_REACH.up * s;
		const r = this.rect;
		// (`topOk`: a corner of a way round a mouth, the top corridor: partly above the top edge, CORRIDOR_SHOWN of him on)
		const topLine = topOk ? y - ROAM_REACH.up * s * CORRIDOR_SHOWN : y0;
		if (!offScreenOk && (x0 < r.left || x1 > r.right || topLine < r.top || y > r.bottom)) return false;
		// the tunnel mouths: his feet outside each grown polygon
		this.growMouths();
		for (let i = 0; i < this.mouths.length; i++) if (inConvex(x, y, this.mouths[i], this.mouthO[i])) return false;
		// the forest: his feet below its tree line
		if (this.onTrees(x, y)) return false;
		const feet = y - ROAM_REACH.up * s * FEET_SHARE;
		// (2026-11-18) his cast shadow too: it leans from his feet by castReach per road px of his height, so against the
		// keep-outs his box is widened toward the lean (the road is checked at his feet only, as before)
		const lean = castReach();
		const h = ROAM_REACH.up * s;
		const sx0 = x0 - Math.max(0, -lean.x) * h;
		const sx1 = x1 + Math.max(0, lean.x) * h;
		const sy0 = Math.min(y0, y + Math.min(0, lean.y) * h);
		for (const z of this.zones) {
			// (the top corridor passes behind the top line's text: at desktop sizes the text over the tunnel's hill leaves
			// no other way in from his side; never a stop)
			if (topOk && z.name === 'top line') continue;
			if (z.name === 'road') {
				if (x0 < z.x1 && x1 > z.x0 && feet < z.y1 && y > z.y0) return false;
			} else if (z.name === 'stoplight' || (this.short && z.name === 'logo')) {
				// a stoplight stands at the tunnel mouth beside him: his body never covers it, his shadow may fall on its
				// foot as it falls on the stone (a sideways phone: keeping the shadow off it too halves the snow by the tunnel).
				// The logo on the short ground the same way: it is drawn over him and his shadow, and his shadow's lean (41
				// CSS px to the left at 413 x 586) kept him 41 px further from it than his body needs
				if (x0 < z.x1 && x1 > z.x0 && y0 < z.y1 && y > z.y0) return false;
			} else if (sx0 < z.x1 && sx1 > z.x0 && sy0 < z.y1 && y > z.y0) return false;
		}
		return true;
	}

	/** his feet in the area: the polygon, or the snow beyond the art's sides (`beyond`), or anywhere when the floor has
	 *  widened it (`relaxed`; the road under his feet stays a keep-out) */
	private inArea(x: number, y: number): boolean {
		if (this.widen === 2) return true;
		if (this.n >= 3 && inPoly(x, y, this.poly, this.n)) return true;
		if (this.widen === 1 && y <= RIM_Y) return true;
		// the snow beyond the art that this window shows past what the window the area was drawn at showed (there the
		// area is exactly as drawn); not once the floor has joined the top rim (2026-11-18: at 2560 x 1080 the tall strips
		// beyond the tunnels drew him down them, away from the rim's level ground the floor gave him)
		if (this.widen === 1) return false;
		const R = ROAM_REF_RECT[this.kind];
		return this.beyond && (x >= Math.max(IMG_W + BEYOND_GAP, R.right) || x <= Math.min(-BEYOND_GAP, R.left));
	}

	/** DEV / probes: his feet at (x, y) inside the area the game uses now (the drawn one, or as the floor widened it) */
	inAreaNow(x: number, y: number): boolean {
		return this.inArea(x, y);
	}

	/** a spot he may stand on: his feet in the area, his body clear */
	valid(x: number, y: number): boolean {
		return this.n >= 3 && this.inArea(x, y) && this.clear(x, y);
	}

	/** a random point to try: in the polygon's bounds, or (half the time, with `beyond`) the snow past the sides, or
	 *  anywhere on the screen once relaxed */
	private sample(rnd: () => number): Pt {
		const r = this.rect;
		const B = this.bounds;
		const P = this.tryPt;
		if (this.widen === 2) {
			P.x = r.left + rnd() * (r.right - r.left);
			P.y = r.top + rnd() * (r.bottom - r.top);
			return P;
		}
		if (this.widen === 1 && rnd() < 0.5) {
			// the art's top snow rim (road y up to 120, where the trench's snow ends): level ground the width of the screen
			P.x = r.left + rnd() * (r.right - r.left);
			P.y = Math.max(r.top, RIM_TOP) + rnd() * (RIM_Y - Math.max(r.top, RIM_TOP));
			return P;
		}
		const R = ROAM_REF_RECT[this.kind];
		const fromL = Math.min(-BEYOND_GAP, R.left);
		const fromR = Math.max(IMG_W + BEYOND_GAP, R.right);
		const sideL = Math.max(0, fromL - r.left);
		const sideR = Math.max(0, r.right - fromR);
		if (this.beyond && this.widen === 0 && sideL + sideR > 1 && rnd() < 0.5) {
			const u = rnd() * (sideL + sideR);
			P.x = u < sideR ? fromR + u : fromL - (u - sideR);
			P.y = r.top + rnd() * (r.bottom - r.top);
			return P;
		}
		P.x = B.x0 + rnd() * (B.x1 - B.x0);
		P.y = B.y0 + rnd() * (B.y1 - B.y0);
		return P;
	}
	private tryPt: Pt = { x: 0, y: 0 };

	/** THE FLOOR: how many spots FLOOR_SEP of the screen's width apart the area holds now (a fixed seeded sample, greedy);
	 *  under FLOOR_SPOTS the area is widened to all the free snow (logged on the dev server). Run when the screen, the
	 *  layout or the area changes, and before a pick (the HUD may have moved). */
	private measureFloor() {
		// the spots he can actually walk between: valid points (a fixed seeded sample), joined where one walk under the
		// rules (length, slope, a clear way) goes from one to the other; in the largest group, the spots FLOOR_SEP apart
		const count = () => {
			const W = this.screenW();
			const sep = FLOOR_SEP * W;
			// a grid over the screen (a thin band of snow is never missed): its valid points, joined to their right hand
			// neighbors level and one row up or down (a walk of 3 % of the width rising or falling one row is under the
			// explore slope), where the way between is clear too
			const r = this.rect;
			const gx = Math.max(8, W * 0.03);
			// (rows fine enough for a thin neck of snow: 1/200 of the screen's height, 6 road px at least)
			const gy = Math.max(6, Math.min(gx * Math.tan((Math.max(ROAM.maxSlopeDeg, ROAM.exploreSlopeDeg) * Math.PI) / 180), (r.bottom - r.top) / 200));
			const cols = Math.max(1, Math.floor((r.right - r.left) / gx));
			const rows = Math.max(1, Math.floor((r.bottom - r.top) / gy));
			if (cols * rows > FLOOR_CELLS) return { spots: 0, span: 0 };
			const id = new Int32Array(cols * rows).fill(-1);
			const pts: Pt[] = [];
			for (let j = 0; j < rows; j++)
				for (let i = 0; i < cols; i++) {
					const x = r.left + (i + 0.5) * gx;
					const y = r.top + (j + 0.5) * gy;
					if (this.valid(x, y)) {
						id[j * cols + i] = pts.length;
						pts.push({ x, y });
					}
				}
			const root = pts.map((_, k) => k);
			const find = (k: number): number => (root[k] === k ? k : (root[k] = find(root[k])));
			for (let j = 0; j < rows; j++)
				for (let i = 0; i + 1 < cols; i++) {
					const a = id[j * cols + i];
					if (a < 0) continue;
					for (const dj of [-1, 0, 1]) {
						if (j + dj < 0 || j + dj >= rows) continue;
						const b = id[(j + dj) * cols + i + 1];
						if (b < 0 || find(a) === find(b)) continue;
						if (!this.clear((pts[a].x + pts[b].x) / 2, (pts[a].y + pts[b].y) / 2)) continue;
						root[find(a)] = find(b);
					}
				}
			// the best group: the most spots FLOOR_SEP apart, then the widest
			const groups = new Map<number, { kept: Pt[]; x0: number; x1: number }>();
			for (let k = 0; k < pts.length; k++) {
				const g = groups.get(find(k)) ?? { kept: [], x0: Infinity, x1: -Infinity };
				groups.set(find(k), g);
				g.x0 = Math.min(g.x0, pts[k].x);
				g.x1 = Math.max(g.x1, pts[k].x);
				if (g.kept.every((q) => Math.hypot(q.x - pts[k].x, q.y - pts[k].y) >= sep)) g.kept.push(pts[k]);
			}
			let big = -1;
			let most = -1;
			let wid = -1;
			for (const [k, g] of groups)
				if (g.kept.length > most || (g.kept.length === most && g.x1 - g.x0 > wid)) {
					most = g.kept.length;
					wid = g.x1 - g.x0;
					big = k;
				}
			const kept: Pt[] = [];
			let x0 = Infinity;
			let x1 = -Infinity;
			for (let k = 0; k < pts.length; k++) {
				if (find(k) !== big) continue;
				x0 = Math.min(x0, pts[k].x);
				x1 = Math.max(x1, pts[k].x);
				if (kept.every((q) => Math.hypot(q.x - pts[k].x, q.y - pts[k].y) >= sep)) kept.push(pts[k]);
			}
			return { spots: kept.length, span: Number.isFinite(x0) ? (x1 - x0) / W : 0 };
		};
		const was = this.widen;
		const short = (c: { spots: number; span: number }) => c.spots < FLOOR_SPOTS || c.span < FLOOR_SPAN;
		this.widen = 0;
		let best = count();
		this.floorOwn.spots = best.spots;
		this.floorOwn.span = Math.round(best.span * 100) / 100;
		// too little room: the art's top snow rim joins the area; still too little: all the free snow (each kept only where
		// it gives him more room)
		// (the short upright ground is Corey's band as drawn: never widened, the snow cap and the board stay out)
		for (const w of [1, 2] as const) {
			if (!short(best) || this.short) break;
			const keep: 0 | 1 | 2 = this.widen;
			this.widen = w;
			const c = count();
			if (c.spots > best.spots || c.span > best.span + 0.05) best = c;
			else this.widen = keep;
		}
		this.capacity = best.spots;
		this.span = best.span;
		this.relaxed = this.widen > 0;
		if (this.widen !== was && this.widen > 0 && import.meta.env.DEV) console.info(`[reindeer] roam: the ${this.kind} area holds too few spots ${Math.round(FLOOR_SEP * 100)}% of the width apart that he can walk between at this window: widened to ${this.widen === 1 ? 'the top snow rim' : 'all the free snow'} (${this.capacity} spots, ${Math.round(this.span * 100)}% of the width)`);
	}

	/** the zones' fingerprint: the floor is measured again when they move (the HUD settles after the first frames) */
	private zoneSum = NaN;
	private zonesMoved(): boolean {
		let sum = this.zones.length;
		for (const z of this.zones) sum += z.x0 * 1.3 + z.y0 * 1.7 + z.x1 * 1.9 + z.y1 * 2.3;
		// (the forest's tree line too: a scene swap or a resize moves it)
		for (let i = 0; i < this.treeY.length; i++) sum += this.treeY[i] * (2.9 + i * 0.01);
		const moved = Math.abs(sum - this.zoneSum) > 0.5 || !Number.isFinite(this.zoneSum);
		this.zoneSum = sum;
		return moved;
	}

	/** his body clear all along a walk (every 6 road px) */
	/** (2026-11-18, the probe host's 7.7 px against the 8 px rule: a walk was checked every 6 road px, and his body
	 *  could graze a keep-out between two checks) EXACT now: his boxes (the body widened by his shadow's lean, the
	 *  stoplight's body only, the road's feet strip) move in a straight line from a to b, and for each zone the part of
	 *  the walk where both their x and y spans overlap is solved; any overlap is a hit. The screen's edge: both ends (the
	 *  boxes are convex, the screen too). */
	private clearWay(ax: number, ay: number, bx: number, by: number, offScreenOk = false, endTop = false, sweepTop = endTop, endFree = false): boolean {
		// (`endFree`: b is a turn of a walk, not a stop: the sweep below judges it as it judges every point of the walk, a
		// sign it passes included)
		if (!endFree && !this.clear(bx, by, offScreenOk, endTop)) return false;
		if (this.cutsMouth(ax, ay, bx, by)) return false;
		if (this.walkOnTrees(ax, ay, bx, by)) return false;
		const s = this.scale();
		const side = ROAM_REACH.side * s;
		const h = ROAM_REACH.up * s;
		const lean = castReach();
		const dx = bx - ax;
		const dy = by - ay;
		// one moving box [x0 + dx t, x1 + dx t] x [y0 + dy t, y1 + dy t] against a zone: the t where all four hold
		const hits = (x0: number, x1: number, y0: number, y1: number, z: Box) => {
			let lo = 0;
			let hi = 1;
			const keep = (a: number, b: number) => {
				// a + b t > 0 for t in (lo, hi)
				if (Math.abs(b) < 1e-12) {
					if (a <= 0) hi = -1;
					return;
				}
				const t = -a / b;
				if (b > 0) lo = Math.max(lo, t);
				else hi = Math.min(hi, t);
			};
			keep(z.x1 - x0, -dx);
			keep(x1 - z.x0, dx);
			keep(z.y1 - y0, -dy);
			keep(y1 - z.y0, dy);
			return hi - lo > 1e-9;
		};
		for (const z of this.zones) {
			if (z.name === 'road') {
				if (hits(ax - side, ax + side, ay - h * FEET_SHARE, ay, z)) return false;
			} else if (sweepTop && z.name === 'top line') {
				continue;
			} else if (z.name === 'sign' && this.passSigns) {
				// (a walk in with no other way: behind the Fast Lane or Menu sign, pick)
				continue;
			} else if (z.name === 'skip') {
				// SKIP TO RESULT's button (components/Board.svelte roamZones, only while it is up): a walk may pass under it (it
				// stands in the corner he walks in through on desktop and tablet); he never stops under it (the spot check)
				continue;
			} else if (z.name === 'stoplight' || (this.short && z.name === 'logo')) {
				if (hits(ax - side, ax + side, ay - h, ay, z)) return false;
			} else if (hits(ax - side - Math.max(0, -lean.x) * h, ax + side + Math.max(0, lean.x) * h, Math.min(ay - h, ay + Math.min(0, lean.y) * h), ay, z)) return false;
		}
		return true;
	}

	/** does the way just picked (this.route, or the level walk in from past his side's edge to this.to) take his body or
	 *  his shadow over a sign (a zone named 'sign'), swept as clearWay sweeps a key */
	private wayMeetsSign(): boolean {
		const signs = this.zones.filter((z) => z.name === 'sign');
		if (!signs.length) return false;
		const way = this.route.length >= 2 ? this.route : [{ x: this.enterX(), y: this.to.y }, { x: this.to.x, y: this.to.y }];
		const s = this.scale();
		const side = ROAM_REACH.side * s;
		const h = ROAM_REACH.up * s;
		const lean = castReach();
		for (let i = 0; i + 1 < way.length; i++) {
			const a = way[i];
			const dx = way[i + 1].x - a.x;
			const dy = way[i + 1].y - a.y;
			const x0 = a.x - side - Math.max(0, -lean.x) * h;
			const x1 = a.x + side + Math.max(0, lean.x) * h;
			const y0 = Math.min(a.y - h, a.y + Math.min(0, lean.y) * h);
			const y1 = a.y;
			for (const z of signs) {
				// (the moving box [x0 + dx t, x1 + dx t] x [y0 + dy t, y1 + dy t] against the zone, t in 0 to 1: clearWay's hits)
				let lo = 0;
				let hi = 1;
				const keep = (p: number, q: number) => {
					if (Math.abs(q) < 1e-12) {
						if (p <= 0) hi = -1;
						return;
					}
					const t = -p / q;
					if (q > 0) lo = Math.max(lo, t);
					else hi = Math.min(hi, t);
				};
				keep(z.x1 - x0, -dx);
				keep(x1 - z.x0, dx);
				keep(z.y1 - y0, -dy);
				keep(y1 - z.y0, dy);
				if (hi - lo > 1e-9) return true;
			}
		}
		return false;
	}

	/** the mouths grown by his body box (with the shadow's lean) at his scale: feet space obstacles */
	private growMouths() {
		const s = this.scale();
		if (s === this.mouthScale && this.mouths.length) return;
		this.mouthScale = s;
		const side = ROAM_REACH.side * s;
		const h = ROAM_REACH.up * s;
		const lean = castReach();
		const left = side + Math.max(0, -lean.x) * h;
		const right = side + Math.max(0, lean.x) * h;
		const up = Math.max(h, -Math.min(0, lean.y) * h);
		// feet f blocked when the box [f.x - left, f.x + right] x [f.y - up, f.y] meets the mouth: f in mouth - box
		const offs = [
			{ x: left, y: 0 },
			{ x: -right, y: 0 },
			{ x: left, y: up },
			{ x: -right, y: up },
		];
		this.mouths = TUNNEL_HULLS.map((H) => hull(H.flatMap((p) => offs.map((o) => ({ x: p.x + o.x, y: p.y + o.y })))));
		this.mouthO = this.mouths.map(orient);
	}

	/** does the walk a to b cut a grown mouth */
	private cutsMouth(ax: number, ay: number, bx: number, by: number): boolean {
		this.growMouths();
		for (let i = 0; i < this.mouths.length; i++) if (cutsConvex(ax, ay, bx, by, this.mouths[i], this.mouthO[i])) return true;
		return false;
	}

	/** THE WAY ROUND THE MOUTHS from `from`: the grown polygons' corners (a few road px out), the cheapest way to each
	 *  over clear walks (Dijkstra over a dozen or two corners); a corner where he would be partly above the screen's top
	 *  is the top corridor (its walks cost CORRIDOR_COST times their length) */
	private roundTree(from: Pt, offScreenStart = false) {
		this.growMouths();
		const nodes = this.nodes;
		nodes.length = 0;
		const top: boolean[] = [];
		for (let i = 0; i < this.mouths.length; i++) {
			const M = this.mouths[i];
			let cx = 0;
			let cy = 0;
			for (const p of M) {
				cx += p.x / M.length;
				cy += p.y / M.length;
			}
			for (const p of M) {
				const d = Math.hypot(p.x - cx, p.y - cy) || 1;
				const v = { x: p.x + ((p.x - cx) / d) * ROUND_PAD, y: p.y + ((p.y - cy) / d) * ROUND_PAD };
				if (this.clear(v.x, v.y)) {
					nodes.push(v);
					top.push(false);
				} else if (this.clear(v.x, v.y, false, true)) {
					nodes.push(v);
					top.push(true);
				}
			}
		}
		const n = nodes.length;
		const cost = this.nodeCost;
		const prev = this.nodePrev;
		const viaTop = this.nodeTop;
		cost.length = prev.length = viaTop.length = n;
		const done: boolean[] = [];
		for (let i = 0; i < n; i++) {
			const v = nodes[i];
			const ok = this.clearWay(from.x, from.y, v.x, v.y, false, top[i], top[i] || offScreenStart);
			cost[i] = ok ? Math.hypot(v.x - from.x, v.y - from.y) * (top[i] ? CORRIDOR_COST : 1) : Infinity;
			prev[i] = -1;
			viaTop[i] = top[i];
			done.push(false);
		}
		for (;;) {
			let k = -1;
			for (let i = 0; i < n; i++) if (!done[i] && cost[i] < Infinity && (k < 0 || cost[i] < cost[k])) k = i;
			if (k < 0) break;
			done[k] = true;
			for (let i = 0; i < n; i++) {
				if (done[i]) continue;
				const c = cost[k] + Math.hypot(nodes[i].x - nodes[k].x, nodes[i].y - nodes[k].y) * (top[i] || top[k] ? CORRIDOR_COST : 1);
				if (c >= cost[i] || !this.clearWay(nodes[k].x, nodes[k].y, nodes[i].x, nodes[i].y, false, top[i], top[i] || top[k])) continue;
				cost[i] = c;
				prev[i] = k;
				viaTop[i] = top[i] || viaTop[k];
			}
		}
	}

	/** the cheapest way from `from` to (x, y): straight (-1), by a corner of the tree (its index), or none (-2); with
	 *  its cost and whether it passes the top corridor (this.pickTop) */
	private wayTo(from: Pt, x: number, y: number): { via: number; cost: number } {
		this.pickTop = false;
		if (this.clearWay(from.x, from.y, x, y)) return { via: -1, cost: Math.hypot(x - from.x, y - from.y) };
		// blocked: by a mouth only is worth a way round (a zone in the way stays a no)
		if (!this.cutsMouth(from.x, from.y, x, y)) return { via: -2, cost: Infinity };
		let best = -2;
		let bc = Infinity;
		for (let i = 0; i < this.nodes.length; i++) {
			if (this.nodeCost[i] === Infinity) continue;
			const c = this.nodeCost[i] + Math.hypot(x - this.nodes[i].x, y - this.nodes[i].y) * (this.nodeTop[i] ? CORRIDOR_COST : 1);
			if (c >= bc || !this.clearWay(this.nodes[i].x, this.nodes[i].y, x, y, false, false, this.nodeTop[i])) continue;
			best = i;
			bc = c;
		}
		if (best >= 0) this.pickTop = this.nodeTop[best];
		return { via: best, cost: bc };
	}

	/** the walk's way into this.route: from, the corners of the tree back from `via`, to */
	private setRoute(from: Pt, via: number, end: Pt = this.to) {
		this.route.length = 0;
		this.route.push({ x: from.x, y: from.y });
		const chain: number[] = [];
		for (let i = via; i >= 0; i = this.nodePrev[i]) chain.push(i);
		for (let k = chain.length - 1; k >= 0; k--) this.route.push({ x: this.nodes[chain[k]].x, y: this.nodes[chain[k]].y });
		this.route.push({ x: end.x, y: end.y });
	}

	/** where a walk in starts for a spot at height y: just past his side's screen edge */
	private enterX(): number {
		// his body's reach past his feet, and his cast shadow's lean toward the screen (it leans left: a walk in from the
		// right starts that much farther out), so nothing of him or his shadow shows on the first frame
		const s = this.scale();
		const lean = Math.max(0, -castReach().x) * ROAM_REACH.up * s;
		const reach = ROAM_REACH.side * s + (this.area().side === 'right' ? lean : 0) + ENTER_PAD;
		return this.area().side === 'left' ? this.rect.left - reach : this.rect.right + reach;
	}

	/** PICK A SPOT (the mock's rule): random spots of the area's bounds until one holds. From a spot (`from`): its walk's
	 *  length within hopMinPct to hopMaxPct of the screen's width and no steeper than maxSlopeDeg (pass 0), then without the
	 *  slope rule (pass 1), then without the length rule (pass 2); his body clear all the way. With no `from`: any spot
	 *  (`walkIn`: one whose level walk in from the screen's edge is clear). The spot goes into `this.to`. */
	pick(from: Pt | null, walkIn = false): boolean {
		this.passSigns = false;
		this.underSign = false;
		if (this.pickOnce(from, walkIn)) return true;
		// HE PASSES UNDER THE SIGN (Corey 2026-11-24, on the short upright pages where the Fast Lane sign closes his side:
		// "Let him pass under the sign"). Only a walk in, and only where no way in is clear of every key: then the Fast
		// Lane and Menu signs (zones named 'sign', components/Board.svelte roamZones) are not in the way of his WALK. He is
		// drawn on the canvas, behind the bar, so he crosses behind the sign; the spot he walks to is judged as ever (he
		// never stands under any key), and the board, the trees, the logo, the LED strip and every other key stay out.
		if (!walkIn || from || !this.zones.some((z) => z.name === 'sign')) return false;
		this.passSigns = true;
		const ok = this.pickOnce(null, true);
		this.passSigns = false;
		// (marked only where his way does cross behind a sign. The second try draws new random spots, and the way in it finds
		// may pass no sign at all: one the first try's spots missed. The probe host at 832 x 376 had 9 to 12 of 33 walk ins
		// marked; the game's roamer in node there, 368 of 1901 marked, none of them crossing a sign. The walk is the same
		// either way: only the mark follows what his way does.)
		this.underSign = ok && this.wayMeetsSign();
		if (this.underSign) this.counts.underSign++;
		return ok;
	}
	private pickOnce(from: Pt | null, walkIn = false): boolean {
		this.refreshZones();
		if (this.zonesMoved()) this.measureFloor();
		this.counts.picks++;
		const W = this.screenW();
		const lo = (ROAM.hopMinPct / 100) * W;
		const hi = (Math.max(ROAM.hopMaxPct, ROAM.hopMinPct) / 100) * W;
		const tan = Math.tan((Math.max(0, ROAM.maxSlopeDeg) * Math.PI) / 180);
		const ex = this.enterX();
		// NO SHUFFLING: the spot he stopped at before this one is not walked straight back to while another will do, and
		// of the valid spots found the one farthest from his last stops is taken (he roams the area, not two spots)
		const back = from && this.recent.length >= 2 ? this.recent[this.recent.length - 2] : null;
		if (from) this.roundTree(from);
		let routed = 0;
		let shortWays = 0;
		let bVia = -1;
		let bTop = false;
		// (a routed walk in's way, kept as found: each candidate has its own tree)
		let bRoute: Pt[] | null = null;
		let walkInRoute: Pt[] | null = null;
		let keepVia = -1;
		let keepTop = false;
		const sep = FLOOR_SEP * W;
		const tanX = Math.tan((Math.max(ROAM.maxSlopeDeg, ROAM.exploreSlopeDeg) * Math.PI) / 180);
		// pass 0: every rule; pass 1: up to exploreSlopeDeg, taken only when pass 0's best stays near his last stops (it
		// would keep him in one corner); pass 2: no slope rule; pass 3: no length rule
		let keepX = 0;
		let keepY = 0;
		let keepScore = -1;
		for (let pass = 0; pass < 4; pass++) {
			let best = -1;
			let bx = 0;
			let by = 0;
			let found = 0;
			for (let i = 0; i < TRIES && found < EXPLORE; i++) {
				// (2026-11-18) the level walks (passes 0 and 1) are drawn AROUND him: a length within the walk's range, a
				// direction within the slope, left or right; a random point of the area's bounds lands inside that narrow
				// wedge a few times in 220 tries only, and "the farthest of the found spots" then had few to choose from
				let x: number;
				let y: number;
				if (from && pass < 2) {
					const deg = pass === 0 ? ROAM.maxSlopeDeg : Math.max(ROAM.maxSlopeDeg, ROAM.exploreSlopeDeg);
					const a = ((this.rnd() * 2 - 1) * Math.max(0, deg) * Math.PI) / 180;
					const d = lo + this.rnd() * (hi - lo);
					// mostly on along his heading (he sweeps the area end to end, then turns: no dithering in the part he
					// has just walked)
					const sx = this.rnd() < HEADING_ODDS ? this.heading : -this.heading;
					x = from.x + sx * d * Math.cos(a);
					y = from.y + d * Math.sin(a);
				} else {
					const q = this.sample(this.rnd);
					x = q.x;
					y = q.y;
					// (a walk in: most tries in the third of the screen by his side, where its target is wanted)
					if (walkIn && !from && this.rnd() < 0.75) {
						const third = (this.rect.right - this.rect.left) / 3;
						x = this.area().side === 'right' ? this.rect.right - this.rnd() * third : this.rect.left + this.rnd() * third;
					}
				}
				if (!this.valid(x, y)) continue;
				if (from) {
					const dx = x - from.x;
					const dy = y - from.y;
					const d = Math.hypot(dx, dy);
					if (pass < 3 && (d < lo || d > hi)) continue;
					if (pass === 0 && Math.abs(dy) > Math.abs(dx) * tan + 1) continue;
					if (pass === 1 && Math.abs(dy) > Math.abs(dx) * tanX + 1) continue;
					if (pass < 3 && back && Math.hypot(x - back.x, y - back.y) < lo) continue;
				}
				// THE WALK IN: level from past his side's edge; where a mouth is in the way (2026-11-18: at desktop sizes the
				// hill and the top line close his side at every height), round it from that start, the top corridor too.
				// A few candidates only are routed (each its own tree): walk ins are once a spin.
				let inVia = -1;
				let inTop = false;
				if (walkIn && !from && !this.clearWay(ex, y, x, y, true)) {
					// (the short upright ground: down from above the mouth's arch, Corey's way in)
					const down = this.short && shortWays < SHORT_WAYS ? (shortWays++, this.shortWayIn(ex, x, y)) : null;
					if (down) walkInRoute = down;
					else {
						if (routed >= WALK_IN_ROUTED || !this.cutsMouth(ex, y, x, y)) continue;
						routed++;
						const E = { x: ex, y };
						this.roundTree(E, true);
						const w = this.wayTo(E, x, y);
						if (w.via < 0) continue;
						inVia = w.via;
						inTop = this.pickTop;
						this.setRoute(E, w.via, { x, y });
						walkInRoute = this.route.map((q) => ({ x: q.x, y: q.y }));
					}
				} else walkInRoute = null;
				// the way there: straight, or round a tunnel mouth (a way through the top corridor scores lower)
				const way = from ? this.wayTo(from, x, y) : { via: inVia, cost: 0 };
				if (way.via === -2 || (from && way.cost > 2.5 * hi)) continue;
				const viaTop = from ? this.pickTop : inTop;
				found++;
				// THE SCORE: new ground first. m = how far the spot is from every stop he remembers (and from where he
				// stands). A spot FLOOR_SEP or more from all of them is new ground, and of those the nearest to that line
				// wins (2026-11-18: a sweep of 17 % walks left a band 41 % wide with 3 stops; walks just past 12 % give 4);
				// otherwise the farthest. On along his heading breaks the ties.
				let m = Infinity;
				for (const r of this.recent) m = Math.min(m, Math.hypot(x - r.x, y - r.y));
				if (from) m = Math.min(m, Math.hypot(x - from.x, y - from.y));
				let score = m >= sep ? 4 * sep - Math.min(m - sep, sep) : m;
				if (from && (x - from.x) * this.heading > 0) score += sep * 0.25;
				// THE WALK IN goes to the end of the area by his side (2026-11-18: one that stopped mid area and swept away
				// left the other half for later): the found spot nearest his side's edge, on the top ground (the rim, road y
				// 120 and up) where there is some
				if (walkIn && !from) score = (this.area().side === 'right' ? x : -x) + (y <= RIM_Y ? 1e6 : 0);
				if (viaTop) score -= 2 * sep;
				if (score > best) {
					best = score;
					bx = x;
					by = y;
					bVia = way.via;
					bTop = viaTop;
					bRoute = walkIn && !from ? walkInRoute : null;
				}
			}
			if (found && pass === 0 && from && best < sep * 1.25) {
				// a level walk that only revisits: keep it, and look a little steeper for new ground first
				keepX = bx;
				keepY = by;
				keepScore = best;
				keepVia = bVia;
				keepTop = bTop;
				continue;
			}
			if (found && (pass !== 1 || best > keepScore)) {
				// (the walk taken sets his heading: turned at an end of the area)
				if (from && Math.abs(bx - from.x) > 1) this.heading = bx > from.x ? 1 : -1;
				this.to.x = bx;
				this.to.y = by;
				this.lastPass = pass;
				if (pass > 0) this.counts.relaxed++;
				this.takeWay(from, bVia, bTop);
				if (!from) {
					this.route.length = 0;
					if (bRoute) {
						this.route.push(...bRoute);
						this.counts.rounds++;
						if (bTop) this.counts.corridor++;
					}
					this.pickTop = bTop;
				}
				return true;
			}
			if (keepScore >= 0) {
				if (from && Math.abs(keepX - from.x) > 1) this.heading = keepX > from.x ? 1 : -1;
				this.to.x = keepX;
				this.to.y = keepY;
				this.lastPass = 0;
				this.takeWay(from, keepVia, keepTop);
				return true;
			}
			if (!from) break;
		}
		this.lastPass = -1;
		this.counts.none++;
		return false;
	}

	/** THE WAY IN ON THE SHORT UPRIGHT GROUND (game/roamGround.ts ROAM_SHORT; Corey's band notches up over the right
	 *  tunnel mouth's arch at his side): level from past his side's edge at a height that clears the arch, then down to
	 *  the spot (x, y) no steeper than maxSlopeDeg; the lowest such height first, the gentlest turn down first (the
	 *  farthest along). Its three points, or null. Every leg clear as any walk (clearWay: the mouths, the top edge, every
	 *  zone; the signs only when the pick passes them), and on the screen his feet inside Corey's band all the way (over
	 *  the arch that is his notch, a little above the mouth's own keep-out) */
	private shortWayIn(ex: number, x: number, y: number): Pt[] | null {
		const step = Math.max(2, (ROAM_REACH.up * this.scale()) / 16);
		const dir = this.area().side === 'right' ? 1 : -1;
		const far = dir > 0 ? Math.min(ex, this.rect.right) : Math.max(ex, this.rect.left);
		const tan = Math.tan((Math.max(1, ROAM.maxSlopeDeg) * Math.PI) / 180);
		for (let k = 1; k <= 24; k++) {
			const yE = y - k * step;
			const near = x + (dir * (y - yE)) / tan;
			if ((far - near) * dir <= 0) break;
			for (let j = SHORT_TURNS; j >= 0; j--) {
				const wx = near + ((far - near) * j) / SHORT_TURNS;
				if (!this.clearWay(ex, yE, wx, yE, true, false, false, true) || !this.clearWay(wx, yE, x, y)) continue;
				if (!this.inBandOnScreen(ex, yE, wx, yE) || !this.inBandOnScreen(wx, yE, x, y)) continue;
				return [
					{ x: ex, y: yE },
					{ x: wx, y: yE },
					{ x, y },
				];
			}
		}
		return null;
	}

	/** his feet inside the area all along a to b where they are on the screen (every 4 road px) */
	private inBandOnScreen(ax: number, ay: number, bx: number, by: number): boolean {
		const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4));
		for (let i = 0; i <= n; i++) {
			const x = ax + ((bx - ax) * i) / n;
			if (x < this.rect.left || x > this.rect.right) continue;
			if (!inPoly(x, ay + ((by - ay) * i) / n, this.poly, this.n)) return false;
		}
		return true;
	}

	/** the chosen walk's way (straight, or round a mouth) into this.route; the counters */
	private takeWay(from: Pt | null, via: number, top: boolean) {
		this.route.length = 0;
		if (!from) return;
		if (via >= 0) {
			this.setRoute(from, via);
			this.counts.rounds++;
			if (top) this.counts.corridor++;
		}
		this.pickTop = top;
	}

	/** a stop: sniffing at (x, y) for a random while (the sniff loop played whole, fitted to the stop's length) */
	private idleAt(x: number, y: number, clock: number) {
		this.state = 'idle';
		this.route.length = 0;
		this.x = x;
		this.y = y;
		// (his last stops, the newest last: a few only)
		if (!this.recent.length || Math.hypot(this.recent[this.recent.length - 1].x - x, this.recent[this.recent.length - 1].y - y) > 0.5) {
			if (this.recent.length >= RECENT) this.recent.shift();
			this.recent.push({ x, y });
		}
		this.u = 0;
		this.len = 0;
		this.clip = 'sniff';
		this.frame = 1;
		const lo = Math.max(0, Math.min(ROAM.idleMinMs, ROAM.idleMaxMs));
		const hi = Math.max(ROAM.idleMinMs, ROAM.idleMaxMs);
		const ms = lo + (hi - lo) * this.rnd();
		const loopMs = (C.sniff.rigFrames / REINDEER_ROAM.fps) * 1000;
		this.loopsLeft = Math.max(1, Math.round(ms / loopMs));
		this.sniffRate = Math.max(SNIFF_RATE.min, Math.min(SNIFF_RATE.max, (this.loopsLeft * loopMs) / Math.max(1, ms)));
		void clock;
	}

	/** stand him at a random spot of the area now (the first board, or STRIKE.roam switched back on) */
	placeNow(clock: number = this.clock) {
		if (this.n < 3) return;
		this.placed = true;
		this.counts.placed++;
		if (this.pick(null)) this.idleAt(this.to.x, this.to.y, clock);
		else {
			// none yet: again in half a second
			this.state = 'none';
			this.placed = false;
			this.placeRetryAt = clock + 500;
		}
		this.draw();
	}

	/** DEV / probes: stand him at (x, y) now, sniffing */
	standAt(x: number, y: number) {
		this.placed = true;
		this.walkInAt = null;
		// (his memory of his last stops goes too: the same seed from the same spot walks the same way)
		this.recent.length = 0;
		this.heading = this.area().side === 'right' ? -1 : 1;
		this.goneAt = null;
		this.idleAt(x, y, this.clock);
		this.draw();
	}

	/** DEV / probes: `count` picks in a row from his spot now (each from the one before, as he would walk them), and
	 *  `walkIns` walk in picks, with a seed; nothing moves. The probe checks every one against the area and the zones. */
	devPicks(count: number, walkIns: number, seed: number) {
		this.reseed(seed);
		const out: { x: number; y: number; pass: number; walkIn: boolean; fromX: number; fromY: number; route: Pt[] | null; top: boolean; underSign?: boolean }[] = [];
		let at: Pt = { x: this.x, y: this.y };
		const keep = this.recent.slice();
		for (let i = 0; i < count; i++) {
			const ok = this.pick(at);
			out.push({ x: ok ? this.to.x : at.x, y: ok ? this.to.y : at.y, pass: this.lastPass, walkIn: false, fromX: at.x, fromY: at.y, route: ok && this.route.length >= 2 ? this.route.map((q) => ({ x: q.x, y: q.y })) : null, top: ok && this.pickTop });
			if (ok) {
				if (this.recent.length >= RECENT) this.recent.shift();
				this.recent.push(at);
				at = { x: this.to.x, y: this.to.y };
			}
		}
		this.recent = keep;
		this.route.length = 0;
		for (let i = 0; i < walkIns; i++) {
			const ok = this.pick(null, true);
			out.push({ x: this.to.x, y: this.to.y, pass: ok ? this.lastPass : -1, walkIn: true, fromX: this.enterX(), fromY: this.to.y, route: ok && this.route.length >= 2 ? this.route.map((q) => ({ x: q.x, y: q.y })) : null, top: ok && this.pickTop, underSign: ok && this.underSign });
		}
		return out;
	}

	/** is he on the screen and free to strike (standing, walking or walking in with his feet inside the screen) */
	standing(): Pt | null {
		// (on his way off the screen for the Super wheel he is no one's to use)
		if (this.state === 'none' || this.state === 'alert' || this.state === 'exit' || !roamFramesReady()) return null;
		if (this.x < this.rect.left || this.x > this.rect.right || this.y < this.rect.top || this.y > this.rect.bottom) return null;
		return { x: this.x, y: this.y };
	}

	/** THE STRIKE IS HIS: he stands alert facing `dir` until `until` (board clock), then he is gone. `windup` (the charge
	 *  clips are in, ROAM.charge on): its frames from the strike's start; null: the stand pose, as before */
	alert(dir: 1 | -1, until: number, windup: WindupPlan | null = null) {
		this.state = 'alert';
		this.facing = dir;
		this.windup = windup && chargeFramesReady() ? windup : null;
		this.hitShown = false;
		this.clip = this.windup ? this.windup.clip : 'sniff';
		this.frame = 1;
		// (chargeWindup.ts THE ROOM: a stand of ROAM.charge.hitMarginMs or less has the hit at the strike's start, so the
		// hit is his first frame, drawn here)
		if (this.windup) {
			this.frame = windupFirstFrame(this.windup);
			if (this.windup.clip === 'charge' && this.frame >= CHARGE_HIT) this.hitShown = true;
		}
		this.alertUntil = until;
		this.walkInAt = null;
		this.counts.strikes++;
		this.draw();
	}

	/** gone now (a strike from off the screen took the place of one still walking in) */
	leave() {
		if (this.state === 'none') return;
		this.state = 'none';
		this.counts.cancelled++;
		this.hide();
	}

	/** DEV / probes: the one on screen (if any) goes, and a new one walks in `delayMs` from now */
	walkInSoon(delayMs = 0) {
		if (this.state !== 'none') {
			this.state = 'none';
			this.hide();
		}
		this.placed = true;
		this.walkInAt = (Number.isFinite(this.clock) ? this.clock : 0) + delayMs;
	}

	private hide() {
		this.sprite.visible = false;
		this.shadow.visible = false;
		this.windup = null;
	}

	/** THE SUPER WHEEL COMES OUT (components/Board.svelte, the wheel's emergence): he goes and stays gone. On the screen he
	 *  stands startled and runs off (beginExit); gone or not drawn, he only stays away. `prefer`: the side he would rather
	 *  leave by (-1 the left, the wheel's driver's; 0 none) */
	away(prefer: 1 | -1 | 0 = 0) {
		this.held = true;
		this.walkInAt = null;
		this.goneAt = null;
		this.counts.away++;
		// (a strike of his still running ends as it does: he is gone the frame his run sets off)
		if (this.state === 'none' || this.state === 'alert' || this.state === 'exit') return;
		if (!this.sprite.visible || !roamFramesReady()) {
			this.state = 'none';
			this.hide();
			return;
		}
		this.beginExit(prefer);
	}

	/** THE WHEEL HAS GONE (and the opening column stands): he walks in anew `delayMs` from now, the way he always does */
	back(delayMs = 0) {
		if (!this.held) return;
		this.held = false;
		this.counts.back++;
		if (this.state !== 'none' && this.state !== 'exit') return;
		this.placed = true;
		this.walkInAt = (Number.isFinite(this.clock) ? this.clock : 0) + delayMs;
	}

	/** past which x he is wholly off the screen on side `d` (his run's box or his walk's, and his shadow's lean) */
	private exitX(d: 1 | -1): number {
		const s = this.scale();
		const b = runBox('R');
		const run = Math.max(b.anchorX, 1 - b.anchorX) * b.width * s;
		const lean = Math.abs(castReach().x) * Math.max(b.anchorY * b.height, ROAM_REACH.up) * s;
		const reach = Math.max(run, ROAM_REACH.side * s) + lean + ENTER_PAD;
		return d < 0 ? this.rect.left - reach : this.rect.right + reach;
	}

	/** his way off the screen: the side, and a run that crosses no tunnel mouth and no trees (level, or a little lower) */
	private beginExit(prefer: 1 | -1 | 0) {
		const run = runViewsReady();
		const nearest: 1 | -1 = this.x - this.rect.left <= this.rect.right - this.x ? -1 : 1;
		const speedOf = (len: number) => (run ? Math.max(STRIKE.runSpeed, len / ((EXIT_BUDGET_MS - EXIT_STAND_MS) / 1000)) : Math.max(len / (EXIT_WALK_MS / 1000), (ROAM.walkSpeedPct / 100) * this.screenW() * ROAM.walkInMul));
		const msOf = (d: 1 | -1) => {
			const len = Math.abs(this.exitX(d) - this.x);
			return EXIT_STAND_MS + (len / speedOf(len)) * 1000;
		};
		const preferred = prefer !== 0 && prefer !== nearest && msOf(prefer) <= EXIT_PREFER_MS;
		const first: 1 | -1 = prefer !== 0 && (prefer === nearest || preferred) ? prefer : nearest;
		const order: (1 | -1)[] = [first, -first as 1 | -1];
		let side = first;
		let toY = this.y;
		let found = false;
		const tryRun = (y2: number, trees = true) => {
			for (const d of order) {
				const ex = this.exitX(d);
				if (this.cutsMouth(this.x, this.y, ex, y2) || (trees && this.walkOnTrees(this.x, this.y, ex, y2))) continue;
				side = d;
				toY = y2;
				found = true;
				return;
			}
		};
		for (let k = 0; k <= EXIT_DROPS && !found; k++) {
			const y2 = this.y + k * EXIT_DROP_STEP;
			if (k > 0 && y2 > this.rect.bottom) break;
			tryRun(y2);
			// (the short upright ground, game/roamGround.ts ROAM_SHORT: the mouths close both sides below him, so his run
			// may also rise, up over the right mouth's arch the way he came in)
			if (!found && this.short && k > 0) tryRun(this.y - k * EXIT_DROP_STEP);
		}
		// (and where no straight run keeps under his top edge all the way, the least rise that clears the mouth: a run of
		// under a second, his feet a few px up the snow mounds at the screen's edge rather than his body over the arch)
		for (let k = 1; k <= EXIT_DROPS && !found && this.short; k++) tryRun(this.y - k * EXIT_DROP_STEP, false);
		this.state = 'exit';
		this.counts.exits++;
		this.route.length = 0;
		this.exitFrom.x = this.x;
		this.exitFrom.y = this.y;
		this.exitTo.x = this.exitX(side);
		this.exitTo.y = toY;
		this.exitU = 0;
		this.exitLen = Math.hypot(this.exitTo.x - this.x, this.exitTo.y - this.y);
		this.exitSpeed = speedOf(this.exitLen);
		this.exitRun = run;
		this.exitPose = 0;
		const now = Number.isFinite(this.clock) ? this.clock : 0;
		this.exitStandUntil = now + EXIT_STAND_MS;
		this.facing = side;
		this.clip = 'sniff';
		this.frame = 1;
		const ms = EXIT_STAND_MS + (this.exitLen / Math.max(1e-9, this.exitSpeed)) * 1000;
		// (the probes' worst case at this screen: from its middle to either edge, or the driver's side at its limit)
		const half = this.screenW() / 2 + Math.abs(this.exitX(1) - this.rect.right);
		const worstMs = Math.round(Math.max(prefer !== 0 ? EXIT_PREFER_MS : 0, EXIT_STAND_MS + (half / speedOf(half)) * 1000));
		this.lastExit = { side, nearest, fromX: this.x, fromY: this.y, toX: this.exitTo.x, toY, ms: Math.round(ms), run, preferred: side === prefer && prefer !== nearest, startedAt: now, doneAt: null, screen: [this.rect.left, this.rect.right], worstMs };
		this.draw();
	}

	/** his side run off the screen (the strike runner's R view and size, mirrored about his feet for a run to the left) */
	private drawRun() {
		const stride = ((Math.floor(this.exitPose + 1e-9) % 16) + 16) % 16 + 1;
		const got = runFrame('R', stride);
		if (!got) {
			this.hide();
			return;
		}
		const s = this.sprite;
		const box = runBox('R');
		const k = this.scale();
		if (s.texture !== got.texture) s.texture = got.texture;
		if (s.anchor.x !== box.anchorX || s.anchor.y !== box.anchorY) s.anchor.set(box.anchorX, box.anchorY);
		s.position.set(this.x, this.y);
		s.scale.set((this.facing * box.width * k) / got.texture.orig.width, (box.height * k) / got.texture.orig.height);
		s.alpha = 1;
		s.visible = true;
		castShadow(this.shadow, got.texture, box.anchorX, box.anchorY, this.x, this.y, s.scale.x, s.scale.y, SHADOW.runner ? shadowStrength() : 0);
	}

	private beginWalkIn(clock: number) {
		this.walkInAt = null;
		if (this.n < 3) return;
		this.recent.length = 0;
		this.heading = this.area().side === 'right' ? -1 : 1;
		if (!this.pick(null, true)) {
			// no spot he can walk in to now: again in half a second
			this.walkInAt = clock + 500;
			return;
		}
		this.counts.walkIns++;
		this.state = 'enter';
		// a level leg from past his side's edge, or (round a mouth) the way pick found from there
		if (this.route.length < 2) {
			this.route.length = 0;
			this.route.push({ x: this.enterX(), y: this.to.y }, { x: this.to.x, y: this.to.y });
		}
		this.from.x = this.route[0].x;
		this.from.y = this.route[0].y;
		this.x = this.from.x;
		this.y = this.from.y;
		this.u = 0;
		this.legs.length = 0;
		this.len = 0;
		for (let i = 0; i + 1 < this.route.length; i++) {
			const d = Math.hypot(this.route[i + 1].x - this.route[i].x, this.route[i + 1].y - this.route[i].y);
			this.legs.push(d);
			this.len += d;
		}
		this.facing = this.to.x >= this.from.x ? 1 : -1;
		this.clip = 'walk';
		this.frame = 1;
		this.moveScale = 1;
		this.clock = clock;
	}

	private beginWalk() {
		this.from.x = this.x;
		this.from.y = this.y;
		this.u = 0;
		// the way: straight, or the corners round a mouth (pick's takeWay); each leg's length
		if (this.route.length < 2) {
			this.route.length = 0;
			this.route.push({ x: this.x, y: this.y }, { x: this.to.x, y: this.to.y });
		}
		this.legs.length = 0;
		this.len = 0;
		for (let i = 0; i + 1 < this.route.length; i++) {
			const d = Math.hypot(this.route[i + 1].x - this.route[i].x, this.route[i + 1].y - this.route[i].y);
			this.legs.push(d);
			this.len += d;
		}
		const first = this.route[1];
		if (Math.abs(first.x - this.x) > 0.5) this.facing = first.x > this.x ? 1 : -1;
		this.state = 'start';
		this.clip = 'start';
		this.frame = 1;
		const both = (START_PX + STOP_PX) * K * this.scale();
		this.moveScale = this.len < both ? this.len / both : 1;
		this.counts.walks++;
	}

	private advance(d: number) {
		this.u = Math.min(this.len, this.u + d);
		if (this.route.length < 2 || this.legs.length !== this.route.length - 1) {
			const t = this.len > 1e-6 ? this.u / this.len : 1;
			this.x = this.from.x + (this.to.x - this.from.x) * t;
			this.y = this.from.y + (this.to.y - this.from.y) * t;
			return;
		}
		// along the legs; he faces each leg's way (a turn at a corner is a flip: the rig has no turn)
		let u = this.u;
		let i = 0;
		while (i < this.legs.length - 1 && u > this.legs[i]) u -= this.legs[i++];
		const a = this.route[i];
		const b = this.route[i + 1];
		const t = this.legs[i] > 1e-6 ? Math.min(1, u / this.legs[i]) : 1;
		this.x = a.x + (b.x - a.x) * t;
		this.y = a.y + (b.y - a.y) * t;
		if (Math.abs(b.x - a.x) > 0.5) this.facing = b.x > a.x ? 1 : -1;
	}

	update(clock: number) {
		// (to the microsecond: the same frames give the same steps whatever the clock's size, so a seed replays exactly)
		const dt = Number.isFinite(this.clock) ? Math.max(0, Math.min(100, Math.round((clock - this.clock) * 1000) / 1000)) : 0;
		this.clock = clock;
		if (!STRIKE.roam) {
			if (this.state !== 'none' || this.sprite.visible) {
				this.state = 'none';
				this.hide();
			}
			this.placed = false;
			this.walkInAt = null;
			return;
		}
		// the tab is hidden: nothing moves (the ticker stops too; this is the belt to its braces)
		if (typeof document !== 'undefined' && document.hidden) return;
		this.watchZones();
		if (!roamFramesReady() || this.n < 3) return;
		// THE SAFETY NET (the game is named after him): whenever he is gone with no walk in due and no strike of his own
		// under way (`busy`: the board's strike runner), a new one walks in after ROAM_RETURN_MS
		if (this.state === 'none' && this.placed && this.walkInAt === null && !this.held) {
			if (this.busy()) this.goneAt = null;
			else if (this.goneAt === null) this.goneAt = clock;
			else if (clock - this.goneAt >= ROAM_RETURN_MS) {
				this.goneAt = null;
				this.counts.safetyNet++;
				this.walkInAt = clock;
			}
		} else this.goneAt = null;
		if (this.state === 'none') {
			// (away for the Super wheel: nothing walks in until `back`)
			if (this.held) return;
			// HIS FIRST APPEARANCE (round 4, Corey: "it should ... walk in from off the screen"): never a pop; he walks in
			if (!this.placed && clock >= this.placeRetryAt) {
				this.placed = true;
				this.walkInAt = clock;
			}
			else if (this.walkInAt !== null && clock >= this.walkInAt) this.beginWalkIn(clock);
			if (this.state === 'none') return;
		}
		const sc = K * this.scale();
		const df = (dt / 1000) * REINDEER_ROAM.fps;
		// (a wind-up belongs to his strike only: any other state lets it go)
		if (this.state !== 'alert') this.windup = null;
		switch (this.state) {
			case 'alert':
				if (clock >= this.alertUntil) {
					this.state = 'none';
					this.hide();
					return;
				}
				// the wind-up's frame due now (its plan is on the board clock; no frame of it at or after the set off)
				if (this.windup) {
					this.clip = this.windup.clip;
					let f = windupFrame(this.windup, clock);
					if (this.windup.clip === 'charge' && !this.hitShown && f >= CHARGE_HIT) {
						f = CHARGE_HIT;
						this.hitShown = true;
					}
					this.frame = f;
				}
				break;
			case 'idle': {
				// the sniff loop, fitted to the stop's length; at the end of its last loop (back on the stand, the walk
				// start's first frame) he picks his next spot (none found: another stop)
				const f = this.frame + df * this.sniffRate;
				if (f >= C.sniff.rigFrames + 1) {
					this.frame = ((f - 1) % C.sniff.rigFrames) + 1;
					if (--this.loopsLeft <= 0) {
						if (this.pick({ x: this.x, y: this.y }) && Math.hypot(this.to.x - this.x, this.to.y - this.y) > 2) {
							this.beginWalk();
							this.frame = 1;
						} else this.idleAt(this.x, this.y, clock);
					}
				} else this.frame = f;
				break;
			}
			case 'start': {
				const d = df * this.pace();
				const i = Math.max(0, Math.min(C.start.advance.length - 1, Math.floor(this.frame - 1)));
				this.advance(C.start.advance[i] * sc * d * this.moveScale);
				this.frame += d;
				// the start ends on walk frame 38: the walk goes on from 39
				if (this.frame >= C.start.rigFrames + 1) {
					this.state = 'walk';
					this.clip = 'walk';
					this.frame = 39 + (this.frame - C.start.rigFrames - 1);
				}
				this.maybeStop();
				break;
			}
			case 'enter':
			case 'walk': {
				const d = df * this.pace(this.state === 'enter');
				this.advance(C.walk.groundSpeed * sc * d);
				this.frame = ((this.frame - 1 + d) % C.walk.rigFrames) + 1;
				this.maybeStop();
				break;
			}
			case 'exit': {
				// the stand, then the run off (the line from his spot to past the edge, at the run's own speed)
				if (clock < this.exitStandUntil) break;
				const was = this.exitU;
				this.exitU = Math.min(this.exitLen, this.exitU + (this.exitSpeed * dt) / 1000);
				const t = this.exitLen > 1e-6 ? this.exitU / this.exitLen : 1;
				this.x = this.exitFrom.x + (this.exitTo.x - this.exitFrom.x) * t;
				this.y = this.exitFrom.y + (this.exitTo.y - this.exitFrom.y) * t;
				if (this.exitU >= this.exitLen) {
					this.state = 'none';
					this.hide();
					this.route.length = 0;
					this.counts.exited++;
					if (this.lastExit) this.lastExit.doneAt = clock;
					return;
				}
				if (this.exitRun && runFrame('R', 1)) {
					this.exitPose = this.exitU / (STRIKE.runSpeed / STRIKE.strideFps);
					this.drawRun();
					return;
				}
				// (the walk: its stride matched to the speed, however fast)
				const natural = C.walk.groundSpeed * sc;
				this.clip = 'walk';
				this.frame = ((this.frame - 1 + (natural > 1e-9 ? (this.exitU - was) / natural : 0)) % C.walk.rigFrames) + 1;
				break;
			}
			case 'stop': {
				const d = df * this.pace();
				const i = Math.max(0, Math.min(C.stop.advance.length - 1, Math.floor(this.frame - 1)));
				this.advance(C.stop.advance[i] * sc * d * this.moveScale);
				this.frame += d;
				if (this.frame >= C.stop.rigFrames) {
					this.counts.arrived++;
					this.route.length = 0;
					this.idleAt(this.to.x, this.to.y, clock);
				}
				break;
			}
		}
		this.draw();
	}

	/** the walk stop begins when the road left is what the stop carries (scaled to land exactly on the spot) */
	private maybeStop() {
		if (this.state === 'stop') return;
		const left = Math.max(0, this.len - this.u);
		const stopD = STOP_PX * K * this.scale();
		if (left <= stopD * (this.state === 'start' ? this.moveScale : 1) + 1e-6) {
			this.state = 'stop';
			this.clip = 'stop';
			this.frame = 1;
			this.moveScale = stopD > 1e-6 ? left / stopD : 0;
		}
	}

	draw() {
		if (this.state === 'none') return;
		const s = this.sprite;
		const tex = roamTexture(this.clip, this.frame);
		if (!tex) {
			this.hide();
			return;
		}
		const box = BOX[this.clip];
		const k = this.scale();
		if (s.texture !== tex) s.texture = tex;
		if (s.anchor.x !== box.anchorX || s.anchor.y !== box.anchorY) s.anchor.set(box.anchorX, box.anchorY);
		s.position.set(this.x, this.y);
		s.scale.set((this.facing * box.width * k) / tex.orig.width, (box.height * k) / tex.orig.height);
		s.alpha = 1;
		s.visible = true;
		castShadow(this.shadow, tex, box.anchorX, box.anchorY, this.x, this.y, s.scale.x, s.scale.y, SHADOW.runner ? shadowStrength() : 0);
	}

	private boundsOf(o: PIXI.Container) {
		const b = o.getBounds();
		const r = (v: number) => Math.round(v * 10) / 10;
		return [r(b.minX), r(b.minY), r(b.maxX), r(b.maxY)];
	}

	/** the dev hook and the probes: what he is doing and where, the area as resolved for this screen */
	snapshot() {
		const r = (v: number) => Math.round(v * 100) / 100;
		const A = this.area();
		return {
			on: STRIKE.roam,
			ready: roamFramesReady(),
			state: this.state,
			clip: this.clip,
			frame: r(this.frame),
			x: r(this.x),
			y: r(this.y),
			facing: this.facing,
			visible: this.sprite.visible,
			to: { x: r(this.to.x), y: r(this.to.y) },
			walkInAt: this.walkInAt === null ? null : r(this.walkInAt - this.clock),
			onScreen: this.standing() !== null,
			kind: this.kind,
			scale: this.scale(),
			side: A.side,
			pace: r(this.pace()),
			paceIn: r(this.pace(true)),
			corners: this.poly.slice(0, this.n).map((p) => ({ x: r(p.x), y: r(p.y) })),
			enterX: r(this.enterX()),
			reach: ROAM_REACH,
			/** the drawn area's own floor numbers at this window (why it was widened, or not) */
			floor: { ...this.floorOwn },
			goneAt: this.goneAt === null ? null : r(this.clock - this.goneAt),
			/** away for the Super wheel, and his last run off the screen (its plan: side, way, ms from the stand; when done) */
			held: this.held,
			exit: this.lastExit ? { ...this.lastExit, startedAt: r(this.lastExit.startedAt), doneAt: this.lastExit.doneAt === null ? null : r(this.lastExit.doneAt) } : null,
			/** where his cast shadow's top lands per road px of his height (shadows.ts castReach): the probes' shadow box */
			lean: castReach(),
			/** the tunnel mouths' keep-out polygons (road px, as traced) and his way now (the corners round one, if any) */
			tunnels: ROAM_TUNNELS,
			/** the forest's tree line (road px): its column edges (x) and, per column, the highest his feet may stand (y: the
			 *  lowest tree row plus TREE_PAD; on the short upright ground Corey's top edge where it reaches, in finer columns) */
			trees: this.treeX.length ? { x: [...this.treeX], y: [...this.treeY], forest: this.forest() } : null,
			route: this.route.map((p) => ({ x: r(p.x), y: r(p.y) })),
			box: { walk: BOX.walk, sniff: BOX.sniff, start: BOX.start, stop: BOX.stop, charge: BOX.charge, chargeDown: BOX.chargeDown },
			/** his strike's wind-up (null: the stand, or none) */
			windup: this.windup ? { clip: this.windup.clip, k: Math.round(this.windup.k * 10000) / 10000, start: r(this.windup.start), setOff: r(this.windup.setOff), hop: this.windup.hop === null ? null : r(this.windup.hop), hitAt: this.windup.hitAt === null ? null : r(this.windup.hitAt), early: r(this.windup.early), at: this.windup.at.map(r) } : null,
			lastPass: this.lastPass,
			underSign: this.underSign,
			/** the short upright ground applies (game/roamGround.ts ROAM_SHORT): `corners` are Corey's band, `trees.y` its top edge */
			short: this.short,
			relaxed: this.relaxed,
			widen: this.widen,
			capacity: this.capacity,
			span: Math.round(this.span * 100) / 100,
			beyond: this.beyond,
			shadowVisible: this.shadow.visible,
			/** what he and his shadow cover on the screen now, CSS px (null when not drawn) */
			drawn: this.sprite.visible ? { sprite: this.boundsOf(this.sprite), shadow: this.shadow.visible ? this.boundsOf(this.shadow) : null } : null,
			counts: { ...this.counts },
		};
	}
}
