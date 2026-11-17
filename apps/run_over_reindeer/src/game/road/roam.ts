// THE ROAMING REINDEER (2026-11-17; constants STRIKE.roam and ROAM, game/roamPaths.ts). Corey: "the reindeer is supposed
// to end up being on the screen. Then if more than one reindeer strikes in a turn the second one should come from off the
// screen. A new reindeer should walk in towards the next spin and stay on the screen doing it's idle stuff."
//
//   AT REST     one reindeer stands in the snow outside the tunnel on its path's side, sniffing (the rig's sniff loop),
//               and now and then walks along the path to another waypoint (walk start, the walk loop, walk stop: the
//               rig's own clips, its hooves gripping at the walk's rendered speed times ROAM.walkPace).
//   THE STRIKE  the first strike of a spin is his (game/road/roadFeatures.ts strike): he stands alert facing the board
//               (the stand pose) until his run sets off, then the runner takes over from his feet (the run views). He
//               does not come back. Every later strike of the spin comes from off the screen, as before.
//   THE WALK IN after the spin's last strike, a new one walks in from past the screen's edge (ROAM.walkInPace) to the
//               first waypoint. Nothing waits on him: a spin that starts before he is on the screen takes its first
//               strike from off the screen, as before.
//
// Everything runs on the board clock (turbo and a slam stop hurry it; the dev hook's frozen clock freezes it), and stops
// while the tab is hidden. Seeded choices only (ROAM.seed). No allocation in the frame loop: the path's points are
// re-read into preallocated slots when the screen, the layout or the path changes.
import * as PIXI from 'pixi.js';

import { ROAM, SHADOW, STRIKE } from '../constants';
import type { LayoutKind } from '../layoutSpec';
import { REINDEER_ROAM } from '../reindeerRoamSpec';
import { ROAM_EDIT, ROAM_PATHS, roamX, roamY, type RoadRect, type RoamPath } from '../roamPaths';
import { seeded } from './crosshair';
import { roamBox, roamFramesReady, roamTexture, type RoamBox, type RoamClip } from './roamFrames';
import { castShadow, makeShadow, shadowStrength } from './shadows';

const K = REINDEER_ROAM.roadPxPerFramePx;
const C = REINDEER_ROAM.clips;
const BOX: Record<RoamClip, RoamBox> = { walk: roamBox('walk'), start: roamBox('start'), stop: roamBox('stop'), sniff: roamBox('sniff') };
const sum = (a: readonly number[]) => a.reduce((n, v) => n + v, 0);
/** frame px the start and the stop carry the body, in all */
const START_PX = sum(C.start.advance);
const STOP_PX = sum(C.stop.advance);
/** how far past the screen's edge (beyond his widest reach) a walk in starts, road px */
const ENTER_PAD = 12;

export type RoamState = 'none' | 'enter' | 'start' | 'walk' | 'stop' | 'idle' | 'alert';
type Pt = { x: number; y: number };

/** THE EDITOR'S BRIDGE (staging tune panel, src/staging/tune/RoamEditor.svelte; the dev hook): the board's view and the
 *  forbidden zones in CSS px (components/Board.svelte sets them), and the roamer. Nothing here draws. */
export type RoamZone = { name: string; x0: number; y0: number; x1: number; y1: number };
export const roamDev = {
	/** CSS px per road px, the picture's top left corner in CSS px, the screen in road px, the layout */
	view: null as null | (() => { kind: LayoutKind; k: number; ox: number; oy: number; rect: RoadRect } | null),
	zones: null as null | (() => RoamZone[]),
	roam: null as Roam | null,
};

export class Roam {
	readonly sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
	readonly shadow = makeShadow();
	state: RoamState = 'none';
	/** its feet, road px, and which way it faces (1 = to the right, the rig's own; -1 mirrored) */
	x = 0;
	y = 0;
	facing: 1 | -1 = -1;
	clip: RoamClip = 'sniff';
	/** the rig frame shown (1 based, a float) */
	frame = 1;
	/** when the next walk in starts (board clock), or null */
	walkInAt: number | null = null;
	/** the waypoint it stands at (idle), and the route it walks: waypoint indices (-1 = the entry point) */
	at = 0;
	private route: number[] = [];
	private leg = 0;
	private u = 0;
	private moveScale = 1;
	private idleUntil = 0;
	private alertUntil = 0;
	private clock = NaN;
	private placed = false;
	private rnd = seeded(ROAM.seed);
	/** the path resolved for this screen: road px per waypoint (slots reused), the entry point */
	private pts: Pt[] = [];
	private n = 0;
	private enterPt: Pt = { x: 0, y: 0 };
	private kind: LayoutKind = 'landscape';
	private rect: RoadRect = { left: 0, top: 0, right: 0, bottom: 0 };
	private resolved = { kind: '', l: NaN, t: NaN, r: NaN, b: NaN, v: -1 };
	/** the probes' counters: walks begun, walk ins begun and ended, strikes taken */
	readonly counts = { walks: 0, walkIns: 0, arrived: 0, strikes: 0, placed: 0, cancelled: 0 };

	constructor() {
		this.sprite.visible = false;
		this.sprite.label = 'roam';
		this.shadow.label = 'roamShadow';
	}

	/** the path for the layout it is in */
	path(): RoamPath {
		return ROAM_PATHS[this.kind] ?? ROAM_PATHS.landscape;
	}

	/** its size on top of the built size: the strike's snow size for the layout (the runner takes over at it) */
	scale(): number {
		return (STRIKE.snow[this.kind] ?? STRIKE.snow.landscape).scale;
	}

	/** the walk's ground speed, road px per rig frame */
	private ground(): number {
		return C.walk.groundSpeed * K * this.scale();
	}

	reseed(seed: number) {
		this.rnd = seeded(seed);
	}

	/** the screen (road px) and the layout; re-reads the path's points when either changed (or the path was edited) */
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
		const P = this.path();
		while (this.pts.length < P.points.length) this.pts.push({ x: 0, y: 0 });
		const before = this.n;
		this.n = P.points.length;
		for (let i = 0; i < this.n; i++) {
			this.pts[i].x = roamX(P.points[i].ax, P.points[i].x, rect);
			this.pts[i].y = roamY(P.points[i].ay, P.points[i].y, rect);
		}
		// just past the edge: the widest his walk reaches beyond his feet, and a little more
		const reach = Math.max(BOX.walk.anchorX, 1 - BOX.walk.anchorX) * BOX.walk.width * this.scale() + ENTER_PAD;
		this.enterPt.x = P.side === 'left' ? rect.left - reach : rect.right + reach;
		this.enterPt.y = roamY(P.enter.ay, P.enter.y, rect);
		// a waypoint removed under it, or a different path: stand at the nearest one that is still there
		if (this.n !== before || this.at >= this.n) this.at = Math.max(0, Math.min(this.at, this.n - 1));
		for (const i of this.route) if (i >= this.n) this.route.length = 0;
		if (this.state !== 'none' && this.state !== 'alert' && this.route.length < 2 && this.state !== 'idle') this.idleAt(this.at, this.clock);
		this.place();
	}

	private pt(i: number): Pt {
		return i < 0 ? this.enterPt : this.pts[i];
	}

	/** the feet's place along the route now */
	private place() {
		if (this.state === 'idle' || this.route.length < 2) {
			if (this.state === 'alert' || this.state === 'none' || this.n === 0) return;
			const p = this.pts[this.at];
			this.x = p.x;
			this.y = p.y;
			return;
		}
		const a = this.pt(this.route[this.leg]);
		const b = this.pt(this.route[this.leg + 1]);
		const len = Math.hypot(b.x - a.x, b.y - a.y);
		const t = len > 1e-6 ? Math.min(1, this.u / len) : 1;
		this.x = a.x + (b.x - a.x) * t;
		this.y = a.y + (b.y - a.y) * t;
		if (Math.abs(b.x - a.x) > 0.5) this.facing = b.x > a.x ? 1 : -1;
	}

	/** road px left to the route's end */
	private remaining(): number {
		let d = 0;
		for (let i = this.leg; i < this.route.length - 1; i++) {
			const a = this.pt(this.route[i]);
			const b = this.pt(this.route[i + 1]);
			d += Math.hypot(b.x - a.x, b.y - a.y);
		}
		return Math.max(0, d - this.u);
	}

	private advance(d: number) {
		this.u += d;
		for (;;) {
			const a = this.pt(this.route[this.leg]);
			const b = this.pt(this.route[this.leg + 1]);
			const len = Math.hypot(b.x - a.x, b.y - a.y);
			if (this.u < len || this.leg >= this.route.length - 2) {
				if (this.u > len) this.u = len;
				break;
			}
			this.u -= len;
			this.leg++;
		}
		this.place();
	}

	private idleAt(i: number, clock: number) {
		this.state = 'idle';
		this.at = i;
		this.route.length = 0;
		this.leg = 0;
		this.u = 0;
		this.clip = 'sniff';
		this.frame = 1;
		const lo = Math.max(0, Math.min(ROAM.idleMinMs, ROAM.idleMaxMs));
		const hi = Math.max(ROAM.idleMinMs, ROAM.idleMaxMs);
		this.idleUntil = clock + lo + (hi - lo) * this.rnd();
		this.place();
	}

	/** stand it at a waypoint now (the first board, or STRIKE.roam switched back on) */
	placeNow(clock: number = this.clock) {
		if (!this.n) return;
		this.placed = true;
		this.counts.placed++;
		this.idleAt(Math.floor(this.rnd() * this.n) % this.n, clock);
	}

	/** DEV / probes: stand it at waypoint `i` now, sniffing */
	standAt(i: number) {
		if (!this.n) return;
		this.placed = true;
		this.walkInAt = null;
		this.idleAt(Math.max(0, Math.min(this.n - 1, i)), this.clock);
		this.draw();
	}

	/** is it on the screen and free to strike (standing, walking or walking in with its feet inside the screen) */
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
		this.route.length = 0;
		this.counts.strikes++;
		this.draw();
	}

	/** gone now (a strike from off the screen took the place of one still walking in) */
	leave() {
		if (this.state === 'none') return;
		this.state = 'none';
		this.route.length = 0;
		this.counts.cancelled++;
		this.hide();
	}

	/** DEV / probes: the one on screen (if any) goes, and a new one walks in `delayMs` from now */
	walkInSoon(delayMs = 0) {
		if (this.state !== 'none') {
			this.state = 'none';
			this.route.length = 0;
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
		if (!this.n) return;
		this.counts.walkIns++;
		this.state = 'enter';
		this.route.length = 0;
		this.route.push(-1, 0);
		this.leg = 0;
		this.u = 0;
		this.clip = 'walk';
		this.frame = 1;
		this.moveScale = 1;
		this.clock = clock;
		this.place();
	}

	private beginWalk(to: number) {
		this.route.length = 0;
		const step = to > this.at ? 1 : -1;
		for (let i = this.at; i !== to + step; i += step) this.route.push(i);
		this.leg = 0;
		this.u = 0;
		this.state = 'start';
		this.clip = 'start';
		this.frame = 1;
		const total = this.remaining();
		const both = (START_PX + STOP_PX) * K * this.scale();
		this.moveScale = total < both ? total / both : 1;
		this.counts.walks++;
		this.place();
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
		if (!roamFramesReady() || !this.n) return;
		if (this.state === 'none') {
			if (!this.placed) this.placeNow(clock);
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
				// the sniff loop at the rig's own pace; it leaves for another waypoint once its time is up and the loop is back
				// on the stand (frame 1, the walk start's first frame)
				const f = this.frame + df;
				if (f >= C.sniff.rigFrames + 1) {
					if (clock >= this.idleUntil && this.n > 1) {
						let to = Math.floor(this.rnd() * (this.n - 1));
						if (to >= this.at) to++;
						this.beginWalk(to);
						break;
					}
					this.frame = ((f - 1) % C.sniff.rigFrames) + 1;
				} else this.frame = f;
				break;
			}
			case 'start': {
				const d = df * ROAM.walkPace;
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
				const d = df * (this.state === 'enter' ? ROAM.walkInPace : ROAM.walkPace);
				this.advance(this.ground() * d);
				this.frame = ((this.frame - 1 + d) % C.walk.rigFrames) + 1;
				this.maybeStop();
				break;
			}
			case 'stop': {
				const d = df * ROAM.walkPace;
				const i = Math.max(0, Math.min(C.stop.advance.length - 1, Math.floor(this.frame - 1)));
				this.advance(C.stop.advance[i] * sc * d * this.moveScale);
				this.frame += d;
				if (this.frame >= C.stop.rigFrames) {
					if (this.route[0] === -1) this.counts.arrived++;
					this.idleAt(this.route[this.route.length - 1], clock);
				}
				break;
			}
		}
		this.draw();
	}

	/** the walk stop begins when the road left is what the stop carries (scaled to land exactly on the waypoint) */
	private maybeStop() {
		if (this.state === 'stop' || this.route.length < 2) return;
		const left = this.remaining();
		const stopD = STOP_PX * K * this.scale();
		if (left <= stopD * (this.state === 'start' ? this.moveScale : 1) + 1e-6) {
			// (a walk in or a walk that is all start: the stop takes the rest)
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

	/** the dev hook and the probes: what it is doing and where, the path as resolved for this screen */
	snapshot() {
		const r = (v: number) => Math.round(v * 100) / 100;
		const P = this.path();
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
			at: this.at,
			route: [...this.route],
			walkInAt: this.walkInAt === null ? null : r(this.walkInAt - this.clock),
			onScreen: this.standing() !== null,
			kind: this.kind,
			scale: this.scale(),
			side: P.side,
			points: this.pts.slice(0, this.n).map((p) => ({ x: r(p.x), y: r(p.y) })),
			enter: { x: r(this.enterPt.x), y: r(this.enterPt.y) },
			box: { walk: BOX.walk, sniff: BOX.sniff, start: BOX.start, stop: BOX.stop },
			counts: { ...this.counts },
		};
	}
}
