// THE TARGET CROSSHAIR (Corey 2026-11-15; constants CROSSHAIR): before and during the reindeer's run, a large crosshair
// in the red box's own red and thickness hops between the valid targets on the board (Grandma's car and Santa's
// sleigh) like a quick mouse cursor, drops each one the reindeer has run past, is locked on the book's target by the
// time he turns toward the board, and at the crash becomes the red box at the cell's edge.
//
// Two parts, both pure presentation (the book says which cell; nothing here changes what is struck):
//   planCrosshair  a pure function: the whole hop plan for one strike, worked out when the strike starts, on the road
//                  clock (so turbo and a slam stop scale it with the run, and a replay of the same book gives the same
//                  hops: the order is drawn from a seed made of the board and the strike's place in the spin)
//   CrosshairArt   the drawing: plain white quads tinted like the red box's (no picture, filter, mask or shader), four
//                  corner brackets and four tick marks, each with the box's dark line around it
import * as PIXI from 'pixi.js';

import { CROSSHAIR, RED_BOX } from '../constants';

export type Rect = { x: number; y: number; w: number; h: number };
export type CrosshairState = 'hop' | 'glide' | 'locked' | 'morph' | 'off';

/** one stretch of the plan: resting on a cell, or gliding from one cell to the next */
export type Leg =
	| { kind: 'dwell'; cell: number; t0: number; t1: number; final: boolean }
	| { kind: 'glide'; from: number; to: number; t0: number; t1: number; bow: number };

export type CrosshairPlan = {
	target: number;
	cells: number[];
	/** per cell: when it stops being a candidate (road clock); the target never drops */
	dropAt: Record<number, number>;
	legs: Leg[];
	/** when it is on the target for good (road clock) */
	lockAt: number;
	/** the turn's first pose: the latest the lock may come */
	turnAt: number;
};

/** a small seeded random source (mulberry32): the same seed gives the same hops */
export const seeded = (seed: number) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** a stable number from a string (FNV-1a): the round's seed from its board and the strike's place in the spin */
export const hashText = (text: string): number => {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
};

/** how long a glide takes between two cell centres: like a hand on a mouse, a fixed start plus a little per road px */
export const glideMs = (from: { x: number; y: number }, to: { x: number; y: number }) => {
	const d = Math.hypot(to.x - from.x, to.y - from.y);
	return Math.min(CROSSHAIR.glideMaxMs, CROSSHAIR.glideBaseMs + CROSSHAIR.glidePerPx * d);
};

/** THE HOP PLAN for one strike (pure). `centre(cell)`: a cell's centre, road px. `start`: the road clock when the
 *  crosshair shows; `turnAt`: when the reindeer's turn toward the board starts (its first S pose). `dropAt`: per
 *  candidate, when the reindeer has run past its reel (the turn for the ones it never passes). */
export const planCrosshair = (cells: number[], target: number, centre: (cell: number) => { x: number; y: number }, start: number, turnAt: number, dropAt: Record<number, number>, seed: number): CrosshairPlan => {
	const C = CROSSHAIR;
	const rnd = seeded(seed);
	const all = cells.includes(target) ? [...cells] : [...cells, target];
	const legs: Leg[] = [];
	const lockBy = Math.max(start, turnAt - C.lockLeadMs);
	const g = (a: number, b: number) => (a === b ? 0 : glideMs(centre(a), centre(b)));
	const drop = (cell: number) => (cell === target ? Infinity : (dropAt[cell] ?? turnAt));
	const done = (lockAt: number): CrosshairPlan => ({ target, cells: all, dropAt: Object.fromEntries(all.map((c) => [c, drop(c)])), legs, lockAt, turnAt });

	// one candidate: on it the whole time, no hopping
	if (all.length === 1) {
		legs.push({ kind: 'dwell', cell: target, t0: start, t1: Infinity, final: true });
		return done(start);
	}

	// a cell is worth a hop if the crosshair can get there, rest on it, still be alive there, and still reach the
	// target by the lock
	const canVisit = (from: number, at: number, cell: number) => {
		const arrive = at + g(from, cell);
		return arrive + C.dwellMinMs <= drop(cell) && arrive + C.dwellMinMs + g(cell, target) <= lockBy;
	};
	const pick = (list: number[]) => list[Math.floor(rnd() * list.length) % list.length];

	// where it first shows: any candidate that still leaves time to reach the target (else the target itself)
	const firsts = all.filter((c) => c === target || start + C.appearMs + C.dwellMinMs + g(c, target) <= Math.min(lockBy, drop(c)));
	let at = firsts.length ? pick(firsts) : target;
	let t = start;
	let before = -1;
	for (let guard = 0; guard < 200; guard++) {
		const first = guard === 0;
		const dwell = (first ? C.appearMs : 0) + C.dwellMinMs + rnd() * (C.dwellMaxMs - C.dwellMinMs);
		// the dwell is cut short when its cell drops, and never so long that the target is out of reach by the lock
		let end = Math.min(t + dwell, drop(at), lockBy - g(at, target));
		end = Math.max(end, t);
		// the next hop: never the cell it is on, and not straight back to the one before when there is any other
		let next = all.filter((c) => c !== at && canVisit(at, end, c));
		if (next.length > 1 && before >= 0) next = next.filter((c) => c !== before);
		if (!next.length) {
			if (at === target) {
				// nothing else fits: locked here
				legs.push({ kind: 'dwell', cell: target, t0: t, t1: Infinity, final: true });
				return done(t);
			}
			// straight to the target, and locked on arrival
			legs.push({ kind: 'dwell', cell: at, t0: t, t1: end, final: false });
			const arrive = end + g(at, target);
			legs.push({ kind: 'glide', from: at, to: target, t0: end, t1: arrive, bow: (rnd() * 2 - 1) * C.bow });
			legs.push({ kind: 'dwell', cell: target, t0: arrive, t1: Infinity, final: true });
			return done(arrive);
		}
		const to = pick(next);
		legs.push({ kind: 'dwell', cell: at, t0: t, t1: end, final: false });
		const arrive = end + g(at, to);
		legs.push({ kind: 'glide', from: at, to, t0: end, t1: arrive, bow: (rnd() * 2 - 1) * C.bow });
		before = at;
		at = to;
		t = arrive;
	}
	// (never reached: every hop moves the clock on toward the lock)
	legs.push({ kind: 'dwell', cell: target, t0: t, t1: Infinity, final: true });
	return done(t);
};

const smootherstep = (u: number) => {
	const x = Math.max(0, Math.min(1, u));
	return x * x * x * (x * (x * 6 - 15) + 10);
};
export const easeOut = (u: number) => {
	const x = Math.max(0, Math.min(1, u));
	return 1 - (1 - x) * (1 - x) * (1 - x);
};

/** where the plan puts the crosshair at road clock `now`: its centre and size (cells' red box rects, blended), its
 *  state and the cell it is on or heading to */
export const sample = (plan: CrosshairPlan, now: number, rect: (cell: number) => Rect) => {
	const leg = plan.legs.find((l) => now < l.t1) ?? plan.legs[plan.legs.length - 1];
	if (leg.kind === 'dwell') {
		const r = rect(leg.cell);
		const locked = leg.final && now >= plan.lockAt;
		return { state: (locked ? 'locked' : 'hop') as CrosshairState, cell: leg.cell, rect: r, sinceArrive: now - leg.t0, leg };
	}
	const a = rect(leg.from);
	const b = rect(leg.to);
	const u = smootherstep((now - leg.t0) / Math.max(1, leg.t1 - leg.t0));
	// a slight bow off the straight line, as a hand moves a mouse
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const off = leg.bow * Math.sin(Math.PI * u);
	const r = { x: a.x + dx * u - dy * off, y: a.y + dy * u + dx * off, w: a.w + (b.w - a.w) * u, h: a.h + (b.h - a.h) * u };
	return { state: 'glide' as CrosshairState, cell: leg.to, rect: r, sinceArrive: -1, leg };
};

/** the crosshair's drawing: four corner brackets and four tick marks, the red box's red with its dark line around */
export class CrosshairArt {
	readonly root = new PIXI.Container();
	/** 8 bracket arms then 4 ticks; every dark line is drawn under every red quad, so the outline is one piece */
	private readonly dark: PIXI.Sprite[] = [];
	private readonly red: PIXI.Sprite[] = [];
	constructor() {
		const quad = (tint: number) => {
			const s = new PIXI.Sprite(PIXI.Texture.WHITE);
			s.tint = tint;
			this.root.addChild(s);
			return s;
		};
		for (let i = 0; i < 12; i++) this.dark.push(quad(RED_BOX.edgeColor));
		for (let i = 0; i < 12; i++) this.red.push(quad(RED_BOX.color));
	}

	/** lay it on a rectangle (road px): `armW` / `armH` the brackets' arm lengths along the top and the sides (half the
	 *  side = the side is whole), `tick` the tick marks' length inward from the frame line (0 = gone) */
	set(r: Rect, armW: number, armH: number, tick: number) {
		const t = RED_BOX.width;
		const e = RED_BOX.edge;
		const x0 = r.x;
		const y0 = r.y;
		const x1 = r.x + r.w;
		const y1 = r.y + r.h;
		const aw = Math.max(t, Math.min(r.w / 2, armW));
		const ah = Math.max(t, Math.min(r.h / 2, armH));
		// x, y, w, h of each red quad
		const quads: [number, number, number, number][] = [
			[x0, y0, aw, t], // top left, along the top
			[x0, y0, t, ah], // top left, down the side
			[x1 - aw, y0, aw, t], // top right
			[x1 - t, y0, t, ah],
			[x0, y1 - t, aw, t], // bottom left
			[x0, y1 - ah, t, ah],
			[x1 - aw, y1 - t, aw, t], // bottom right
			[x1 - t, y1 - ah, t, ah],
		];
		const cx = x0 + r.w / 2;
		const cy = y0 + r.h / 2;
		const L = Math.max(0, tick);
		quads.push([cx - t / 2, y0, t, L], [cx - t / 2, y1 - L, t, L], [x0, cy - t / 2, L, t], [x1 - L, cy - t / 2, L, t]);
		quads.forEach(([x, y, w, h], i) => {
			const on = w > 0.01 && h > 0.01;
			const red = this.red[i];
			const dark = this.dark[i];
			red.visible = on;
			dark.visible = on;
			if (!on) return;
			red.position.set(x, y);
			red.width = w;
			red.height = h;
			dark.position.set(x - e, y - e);
			dark.width = w + 2 * e;
			dark.height = h + 2 * e;
		});
	}
}
