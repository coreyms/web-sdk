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
import { ROAM_AREAS, ROAM_EDIT, roamX, roamY, type RoadRect, type RoamArea } from '../roamPaths';
import { seeded } from './crosshair';
import { roamBox, roamFramesReady, roamTexture, type RoamBox, type RoamClip } from './roamFrames';
import { castShadow, makeShadow, shadowStrength } from './shadows';

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
	private zones: Box[] = [];
	private kind: LayoutKind = 'landscape';
	private rect: RoadRect = { left: 0, top: 0, right: 0, bottom: 0 };
	private resolved = { kind: '', l: NaN, t: NaN, r: NaN, b: NaN, v: -1 };
	/** the last pick's pass (0 all rules, 1 no slope rule, 2 no length rule, -1 none found) */
	lastPass = 0;
	/** the probes' counters */
	readonly counts = { walks: 0, walkIns: 0, arrived: 0, strikes: 0, placed: 0, cancelled: 0, picks: 0, relaxed: 0, none: 0 };

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
		for (let i = 0; i < this.n; i++) {
			const c = A.corners[i];
			const p = this.poly[i];
			p.x = roamX(c.ax, c.x, rect);
			p.y = roamY(c.ay, c.y, rect);
			B.x0 = Math.min(B.x0, p.x);
			B.y0 = Math.min(B.y0, p.y);
			B.x1 = Math.max(B.x1, p.x);
			B.y1 = Math.max(B.y1, p.y);
		}
		this.refreshZones();
		// a spot that no longer holds (a resize, an edited area): a fresh one, at once
		if ((this.state === 'idle' || this.state === 'start' || this.state === 'walk' || this.state === 'stop') && !this.valid(this.x, this.y)) {
			if (this.pick(null)) this.idleAt(this.to.x, this.to.y, this.clock);
		}
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
		for (const z of this.zones) {
			const top = z.name === 'road' ? feet : y0;
			if (x0 < z.x1 && x1 > z.x0 && top < z.y1 && y > z.y0) return false;
		}
		return true;
	}

	/** a spot he may stand on: his feet in the area, his body clear */
	valid(x: number, y: number): boolean {
		return this.n >= 3 && inPoly(x, y, this.poly, this.n) && this.clear(x, y);
	}

	/** his body clear all along a walk (every 6 road px) */
	private clearWay(ax: number, ay: number, bx: number, by: number, offScreenOk = false): boolean {
		const d = Math.hypot(bx - ax, by - ay);
		const steps = Math.max(1, Math.ceil(d / 6));
		for (let i = 1; i < steps; i++) if (!this.clear(ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps, offScreenOk)) return false;
		return true;
	}

	/** where a walk in starts for a spot at height y: just past his side's screen edge */
	private enterX(): number {
		const reach = ROAM_REACH.side * this.scale() + ENTER_PAD;
		return this.area().side === 'left' ? this.rect.left - reach : this.rect.right + reach;
	}

	/** PICK A SPOT (the mock's rule): random spots of the area's bounds until one holds. From a spot (`from`): its walk's
	 *  length within hopMinPct to hopMaxPct of the screen's width and no steeper than maxSlopeDeg (pass 0), then without the
	 *  slope rule (pass 1), then without the length rule (pass 2); his body clear all the way. With no `from`: any spot
	 *  (`walkIn`: one whose level walk in from the screen's edge is clear). The spot goes into `this.to`. */
	pick(from: Pt | null, walkIn = false): boolean {
		this.refreshZones();
		this.counts.picks++;
		const B = this.bounds;
		const W = this.screenW();
		const lo = (ROAM.hopMinPct / 100) * W;
		const hi = (Math.max(ROAM.hopMaxPct, ROAM.hopMinPct) / 100) * W;
		const tan = Math.tan((Math.max(0, ROAM.maxSlopeDeg) * Math.PI) / 180);
		const ex = this.enterX();
		for (let pass = 0; pass < 3; pass++) {
			for (let i = 0; i < TRIES; i++) {
				const x = B.x0 + this.rnd() * (B.x1 - B.x0);
				const y = B.y0 + this.rnd() * (B.y1 - B.y0);
				if (!this.valid(x, y)) continue;
				if (from) {
					const dx = x - from.x;
					const dy = y - from.y;
					const d = Math.hypot(dx, dy);
					if (pass < 2 && (d < lo || d > hi)) continue;
					if (pass < 1 && Math.abs(dy) > Math.abs(dx) * tan + 1) continue;
					if (!this.clearWay(from.x, from.y, x, y)) continue;
				} else if (walkIn && !this.clearWay(ex, y, x, y, true)) continue;
				this.to.x = x;
				this.to.y = y;
				this.lastPass = pass;
				if (pass > 0) this.counts.relaxed++;
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
		this.idleAt(x, y, this.clock);
		this.draw();
	}

	/** DEV / probes: `count` picks in a row from his spot now (each from the one before, as he would walk them), and
	 *  `walkIns` walk in picks, with a seed; nothing moves. The probe checks every one against the area and the zones. */
	devPicks(count: number, walkIns: number, seed: number) {
		this.reseed(seed);
		const out: { x: number; y: number; pass: number; walkIn: boolean; fromX: number; fromY: number }[] = [];
		let at: Pt = { x: this.x, y: this.y };
		for (let i = 0; i < count; i++) {
			const ok = this.pick(at);
			out.push({ x: ok ? this.to.x : at.x, y: ok ? this.to.y : at.y, pass: this.lastPass, walkIn: false, fromX: at.x, fromY: at.y });
			if (ok) at = { x: this.to.x, y: this.to.y };
		}
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
		if (!roamFramesReady() || this.n < 3) return;
		if (this.state === 'none') {
			if (!this.placed && clock >= this.placeRetryAt) this.placeNow(clock);
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
			box: { walk: BOX.walk, sniff: BOX.sniff, start: BOX.start, stop: BOX.stop },
			lastPass: this.lastPass,
			counts: { ...this.counts },
		};
	}
}
