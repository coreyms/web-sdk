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
//               (the stand pose) until his run sets off, then the runner takes over from his feet (the run views). He
//               does not come back. Every later strike of the spin comes from off the screen, as before.
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
import { ROAM_AREAS, ROAM_EDIT, ROAM_REF_RECT, type RoadRect, type RoamArea } from '../roamPaths';
import { ROAD_ART } from '../roadArtSpec';
import { seeded } from './crosshair';
import { roamBox, roamFramesReady, roamTexture, type RoamBox, type RoamClip } from './roamFrames';
import { castReach, castShadow, makeShadow, shadowStrength } from './shadows';

const K = REINDEER_ROAM.roadPxPerFramePx;
const C = REINDEER_ROAM.clips;
const CLIPS: RoamClip[] = ['walk', 'start', 'stop', 'sniff'];
const BOX: Record<RoamClip, RoamBox> = { walk: roamBox('walk'), start: roamBox('start'), stop: roamBox('stop'), sniff: roamBox('sniff') };
/** his body's reach from his feet at the built size, road px, whichever clip and whichever way he faces */
export const ROAM_REACH = {
	side: Math.max(...CLIPS.map((c) => Math.max(BOX[c].anchorX, 1 - BOX[c].anchorX) * BOX[c].width)),
	up: Math.max(...CLIPS.map((c) => BOX[c].anchorY * BOX[c].height)),
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

export type RoamState = 'none' | 'enter' | 'start' | 'walk' | 'stop' | 'idle' | 'alert';
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
	private moveScale = 1;
	/** the stop now: sniff loops left and their pace */
	private loopsLeft = 1;
	private sniffRate = 1;
	private alertUntil = 0;
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
	/** the probes' counters */
	readonly counts = { walks: 0, walkIns: 0, arrived: 0, strikes: 0, placed: 0, cancelled: 0, picks: 0, relaxed: 0, none: 0, safetyNet: 0, left: 0 };
	/** is a strike running on the board (game/road/roadFeatures.ts sets it): the safety net waits for it */
	busy: () => boolean = () => false;

	constructor() {
		this.sprite.visible = false;
		this.sprite.label = 'roam';
		this.shadow.label = 'roamShadow';
	}

	/** the area for the layout he is in */
	area(): RoamArea {
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
		this.refreshZones();
		this.zonesMoved();
		this.measureFloor();
		this.leaveIfCovered();
	}

	/** a spot that no longer holds (a resize, a rotation, an edited area, a keep-out that came up over him, as the LED back
	 *  board rising): he never pops to a new one; he goes, and a new one walks in from past the screen's edge */
	private leaveIfCovered() {
		if ((this.state === 'idle' || this.state === 'start' || this.state === 'walk' || this.state === 'stop' || this.state === 'enter') && !(this.state === 'enter' ? this.valid(this.to.x, this.to.y) : this.valid(this.x, this.y) && (this.state !== 'start' && this.state !== 'walk' ? true : this.clear(this.to.x, this.to.y)))) {
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
	private refreshZones() {
		const v = roamDev.view?.();
		const list = roamDev.zones?.() ?? [];
		this.zones.length = 0;
		if (!v) return;
		for (const z of list) this.zones.push({ name: z.name, x0: (z.x0 - v.ox) / v.k, y0: (z.y0 - v.oy) / v.k, x1: (z.x1 - v.ox) / v.k, y1: (z.y1 - v.oy) / v.k });
	}

	/** his body at (x, y) clear of every zone (his feet's strip of the road) and inside the screen (`offScreenOk`: a walk
	 *  in, which starts past the screen's edge) */
	private clear(x: number, y: number, offScreenOk = false): boolean {
		const s = this.scale();
		const x0 = x - ROAM_REACH.side * s;
		const x1 = x + ROAM_REACH.side * s;
		const y0 = y - ROAM_REACH.up * s;
		const r = this.rect;
		if (!offScreenOk && (x0 < r.left || x1 > r.right || y0 < r.top || y > r.bottom)) return false;
		const feet = y - ROAM_REACH.up * s * FEET_SHARE;
		// (2026-11-18) his cast shadow too: it leans from his feet by castReach per road px of his height, so against the
		// keep-outs his box is widened toward the lean (the road is checked at his feet only, as before)
		const lean = castReach();
		const h = ROAM_REACH.up * s;
		const sx0 = x0 - Math.max(0, -lean.x) * h;
		const sx1 = x1 + Math.max(0, lean.x) * h;
		const sy0 = Math.min(y0, y + Math.min(0, lean.y) * h);
		for (const z of this.zones) {
			if (z.name === 'road') {
				if (x0 < z.x1 && x1 > z.x0 && feet < z.y1 && y > z.y0) return false;
			} else if (z.name === 'stoplight') {
				// a stoplight stands at the tunnel mouth beside him: his body never covers it, his shadow may fall on its
				// foot as it falls on the stone (a sideways phone: keeping the shadow off it too halves the snow by the tunnel)
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
		for (const w of [1, 2] as const) {
			if (!short(best)) break;
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
	private clearWay(ax: number, ay: number, bx: number, by: number, offScreenOk = false): boolean {
		if (!this.clear(bx, by, offScreenOk)) return false;
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
			} else if (z.name === 'stoplight') {
				if (hits(ax - side, ax + side, ay - h, ay, z)) return false;
			} else if (hits(ax - side - Math.max(0, -lean.x) * h, ax + side + Math.max(0, lean.x) * h, Math.min(ay - h, ay + Math.min(0, lean.y) * h), ay, z)) return false;
		}
		return true;
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
					if (!this.clearWay(from.x, from.y, x, y)) continue;
				} else if (walkIn && !this.clearWay(ex, y, x, y, true)) continue;
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
				if (score > best) {
					best = score;
					bx = x;
					by = y;
				}
			}
			if (found && pass === 0 && from && best < sep * 1.25) {
				// a level walk that only revisits: keep it, and look a little steeper for new ground first
				keepX = bx;
				keepY = by;
				keepScore = best;
				continue;
			}
			if (found && (pass !== 1 || best > keepScore)) {
				// (the walk taken sets his heading: turned at an end of the area)
				if (from && Math.abs(bx - from.x) > 1) this.heading = bx > from.x ? 1 : -1;
				this.to.x = bx;
				this.to.y = by;
				this.lastPass = pass;
				if (pass > 0) this.counts.relaxed++;
				return true;
			}
			if (keepScore >= 0) {
				if (from && Math.abs(keepX - from.x) > 1) this.heading = keepX > from.x ? 1 : -1;
				this.to.x = keepX;
				this.to.y = keepY;
				this.lastPass = 0;
				return true;
			}
			if (!from) break;
		}
		this.lastPass = -1;
		this.counts.none++;
		return false;
	}

	/** a stop: sniffing at (x, y) for a random while (the sniff loop played whole, fitted to the stop's length) */
	private idleAt(x: number, y: number, clock: number) {
		this.state = 'idle';
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
		const out: { x: number; y: number; pass: number; walkIn: boolean; fromX: number; fromY: number }[] = [];
		let at: Pt = { x: this.x, y: this.y };
		const keep = this.recent.slice();
		for (let i = 0; i < count; i++) {
			const ok = this.pick(at);
			out.push({ x: ok ? this.to.x : at.x, y: ok ? this.to.y : at.y, pass: this.lastPass, walkIn: false, fromX: at.x, fromY: at.y });
			if (ok) {
				if (this.recent.length >= RECENT) this.recent.shift();
				this.recent.push(at);
				at = { x: this.to.x, y: this.to.y };
			}
		}
		this.recent = keep;
		for (let i = 0; i < walkIns; i++) {
			const ok = this.pick(null, true);
			out.push({ x: this.to.x, y: this.to.y, pass: ok ? this.lastPass : -1, walkIn: true, fromX: this.enterX(), fromY: this.to.y });
		}
		return out;
	}

	/** is he on the screen and free to strike (standing, walking or walking in with his feet inside the screen) */
	standing(): Pt | null {
		if (this.state === 'none' || this.state === 'alert' || !roamFramesReady()) return null;
		if (this.x < this.rect.left || this.x > this.rect.right || this.y < this.rect.top || this.y > this.rect.bottom) return null;
		return { x: this.x, y: this.y };
	}

	/** THE STRIKE IS HIS: he stands alert facing `dir` (the stand pose) until `until` (board clock), then he is gone */
	alert(dir: 1 | -1, until: number) {
		this.state = 'alert';
		this.facing = dir;
		this.clip = 'sniff';
		this.frame = 1;
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
		this.from.x = this.enterX();
		this.from.y = this.to.y;
		this.x = this.from.x;
		this.y = this.from.y;
		this.u = 0;
		this.len = Math.abs(this.to.x - this.from.x);
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
		this.len = Math.hypot(this.to.x - this.x, this.to.y - this.y);
		if (Math.abs(this.to.x - this.x) > 0.5) this.facing = this.to.x > this.x ? 1 : -1;
		this.state = 'start';
		this.clip = 'start';
		this.frame = 1;
		const both = (START_PX + STOP_PX) * K * this.scale();
		this.moveScale = this.len < both ? this.len / both : 1;
		this.counts.walks++;
	}

	private advance(d: number) {
		this.u = Math.min(this.len, this.u + d);
		const t = this.len > 1e-6 ? this.u / this.len : 1;
		this.x = this.from.x + (this.to.x - this.from.x) * t;
		this.y = this.from.y + (this.to.y - this.from.y) * t;
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
		if (this.state === 'none' && this.placed && this.walkInAt === null) {
			if (this.busy()) this.goneAt = null;
			else if (this.goneAt === null) this.goneAt = clock;
			else if (clock - this.goneAt >= ROAM_RETURN_MS) {
				this.goneAt = null;
				this.counts.safetyNet++;
				this.walkInAt = clock;
			}
		} else this.goneAt = null;
		if (this.state === 'none') {
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
		switch (this.state) {
			case 'alert':
				if (clock >= this.alertUntil) {
					this.state = 'none';
					this.hide();
					return;
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
			case 'stop': {
				const d = df * this.pace();
				const i = Math.max(0, Math.min(C.stop.advance.length - 1, Math.floor(this.frame - 1)));
				this.advance(C.stop.advance[i] * sc * d * this.moveScale);
				this.frame += d;
				if (this.frame >= C.stop.rigFrames) {
					this.counts.arrived++;
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
			/** where his cast shadow's top lands per road px of his height (shadows.ts castReach): the probes' shadow box */
			lean: castReach(),
			box: { walk: BOX.walk, sniff: BOX.sniff, start: BOX.start, stop: BOX.stop },
			lastPass: this.lastPass,
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
