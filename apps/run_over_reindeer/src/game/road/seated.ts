// THE SEATED DRIVERS (Corey 2026-11-16; constants SEATED, game/seatedSpec.ts built by tools/build_seated.py from the
// locked stills and the hand set split, tools/seated_split.json).
//
// Grandma at the wheel of her car (H1) and Santa in his sleigh (W). One per vehicle slot (the road's car slot that draws
// one), made the first time it does and kept with it. Its root is a plain container in the vehicle's lane just after the
// vehicle sprite, given the sprite's own transform, tint and visibility every frame (game/road/roadBoard.ts syncRiders).
// The vehicle sprite is the BACK layer as it always was; in the root, in order: the DRIVER, then the FRONT layer (the near
// door or the sleigh's near wall: the vehicle's own pixels below the cut line, cut by the build script, drawn over the same
// pixels of the sprite). So the door covers the driver from the waist down with no mask.
//
// THE MOTION, code only: the driver turns about the hip (the still's pivot) with a damped spring on the vehicle's forward
// acceleration (forward on a stop, back on a pull-away; the wagon tree's idea), and rides up with the win pulse (the bob).
// The driver's kept part reaches far enough under the line that no lean shows its cut (the build checks 9 degrees both
// ways; the lean clamps at SEATED.lean.clampDeg plus the spring's overshoot).
import * as PIXI from 'pixi.js';

import { SEATED } from '../constants';
import { SEATED_ART } from '../seatedSpec';
import { RiderSpring, STEP_MS } from './riderSpring';

type Box = { x: number; y: number; w: number; h: number };
export type SeatFrame = 'H1_R' | 'H1_L' | 'W_R' | 'W_L';
type FrameArt = { character: 'grandma' | 'santa'; mirror: boolean; at: readonly number[]; height: number; tiers: Record<string, { front: Box; shadow: Box }> };
type CharArt = { height: number; tiers: Record<string, { anchor: readonly number[]; width: number; height: number }> };

export const SEAT_FRAMES: readonly string[] = Object.keys(SEATED_ART.frames);
const frameArt = (f: SeatFrame) => (SEATED_ART.frames as unknown as Record<string, FrameArt>)[f];
const charArt = (c: string) => (SEATED_ART.characters as unknown as Record<string, CharArt>)[c];

export type TextureLookup = (frame: string) => PIXI.Texture | undefined;

export class SeatedDriver {
	readonly root = new PIXI.Container();
	readonly figure = new PIXI.Sprite();
	readonly front = new PIXI.Sprite();
	readonly lean = new RiderSpring();
	frame: SeatFrame | null = null;
	private dir = 1;
	/** what it drew last (the probes): the lean (degrees, + = forward), the bob (road px up), the driver's pivot (road px
	 *  from the vehicle's anchor at its built size) */
	last = { leanDeg: 0, bob: 0, x: 0, y: 0, scale: 1, character: '' };

	constructor(
		private readonly tex: TextureLookup,
		private readonly tier: 'full' | 'phone',
	) {
		this.root.label = 'seated';
		this.figure.label = 'seatedDriver';
		this.front.label = 'seatedFront';
		this.root.addChild(this.figure, this.front);
	}

	setFrame(frame: SeatFrame): boolean {
		if (frame === this.frame) return true;
		const f = frameArt(frame);
		const fig = this.tex(`seat_${f.character}`);
		const front = this.tex(`${frame}_front`);
		if (!f || !fig || !front) return false;
		this.frame = frame;
		this.dir = frame.endsWith('_R') ? 1 : -1;
		const c = charArt(f.character).tiers[this.tier];
		this.figure.texture = fig;
		this.figure.anchor.set(c.anchor[0], c.anchor[1]);
		const b = f.tiers[this.tier].front;
		this.front.texture = front;
		this.front.position.set(b.x, b.y);
		this.front.width = b.w;
		this.front.height = b.h;
		this.last.character = f.character;
		return true;
	}

	reset() {
		this.lean.reset();
	}

	step(now: number, dtMs: number, accelAt: (t: number) => number) {
		const L = SEATED.lean;
		const tune = { freqHz: L.freqHz, damping: L.damping, gain: -L.gainDeg, clamp: L.clampDeg };
		const n = Math.max(1, Math.ceil(dtMs / STEP_MS));
		const h = dtMs / n;
		for (let i = 1; i <= n; i++) this.lean.step(accelAt(now - dtMs + i * h), h, tune);
	}

	/** the live placement of this frame: the built one plus Corey's nudge (constants SEATED.place) */
	private place() {
		const f = frameArt(this.frame!);
		const p = SEATED.place[this.frame!] ?? { dx: 0, dy: 0, scale: 1 };
		return { x: f.at[0] + p.dx, y: f.at[1] + p.dy, height: f.height * p.scale, f, p };
	}

	/** the driver at the spring's lean and `pulse` (0 to 1: the win pulse's swell) */
	draw(pulse: number) {
		if (!this.frame) return;
		const { x, y, height, f } = this.place();
		const c = charArt(f.character);
		const t = c.tiers[this.tier];
		const tex = this.figure.texture;
		const s = (height / c.height) * (t.width / Math.max(1, tex.width));
		const bob = SEATED.bob.px * Math.max(0, Math.min(1, pulse));
		this.figure.position.set(x, y - bob);
		this.figure.scale.set(f.mirror ? -s : s, s);
		const leanDeg = this.lean.b;
		this.figure.rotation = (this.dir * leanDeg * Math.PI) / 180;
		this.last = { leanDeg: Math.round(leanDeg * 1000) / 1000, bob: Math.round(bob * 1000) / 1000, x, y, scale: height / f.height, character: f.character };
	}

	/** the shadow's extra silhouette (the driver outside the vehicle) at the live placement: its box and texture */
	shadowArt(): { box: Box; texture: PIXI.Texture | undefined } | null {
		if (!this.frame) return null;
		const { p, f } = this.place();
		const b = f.tiers[this.tier].shadow;
		return { box: { x: b.x + p.dx, y: b.y + p.dy, w: b.w, h: b.h }, texture: this.tex(`${this.frame}_seatshadow`) };
	}

	destroy() {
		this.root.destroy({ children: true });
	}
}
