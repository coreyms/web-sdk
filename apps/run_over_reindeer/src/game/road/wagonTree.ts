// THE CHRISTMAS TREE ON THE STATION WAGON (Corey 2026-11-16; constants WAGON_TREE, game/wagonTreeSpec.ts measured by
// tools/build_wagon_tree.py from the approved round 4 layers).
//
// One per wagon slot (the road's car slot that draws an H2), made the first time it does and kept with it. Its root is a
// plain container in the wagon's lane, just after the wagon sprite, that the road gives the sprite's own transform, tint
// and visibility every frame (game/road/roadBoard.ts syncRiders): so it dives and squats with the car, swells with its win
// pulse, darkens in the tunnel's shade and with the win dim, hides under a cloud or a column and goes when the car goes.
// In it, in order: the tree (as STRIPS), the front rail, the ropes, in road px from the wagon's anchor at its built size.
//
// THE BEND: no mesh exists in the game, so the tree is cut into vertical strips (the spec's edges: exactly on each rope's
// margin, narrow past the first rope). Each EDGE moves by the two springs times its weights (tip, body); each strip is a
// sprite whose matrix is the shear between its own two edges (a skew and a width, no rotation), so neighbouring strips
// share their edges exactly: no seam, no step. Under a rope both weights are 0, so nothing there ever moves. The ropes
// and the rail are separate sprites and never move. No filter, shader or mask; no texture made per frame (the strips'
// frames are cut once per wagon direction and cached).
import * as PIXI from 'pixi.js';

import { WAGON_TREE } from '../constants';
import { WAGON_TREE_ART } from '../wagonTreeSpec';
import { RiderSpring, STEP_MS } from './riderSpring';

type Box = { x: number; y: number; w: number; h: number };
type Edge = { px: number; x: number; tip: number; body: number; rope?: boolean };
type TierArt = { tree: Box; rail: Box; ropes: Box; strips: Edge[]; ropesX: number[]; shadow: Box };
export type TreeFrame = 'H2_R' | 'H2_L';

const art = (frame: TreeFrame, tier: 'full' | 'phone'): TierArt => (WAGON_TREE_ART.frames as unknown as Record<string, { tiers: Record<string, TierArt> }>)[frame].tiers[tier];

export type TextureLookup = (frame: string) => PIXI.Texture | undefined;

/** each direction's strip frames, cut once from the tree picture */
const stripCache = new Map<string, PIXI.Texture[]>();
const stripsOf = (base: PIXI.Texture, frame: TreeFrame, edges: Edge[]): PIXI.Texture[] => {
	const key = `${frame}:${base.uid}`;
	let list = stripCache.get(key);
	if (!list) {
		list = [];
		const f = base.frame;
		for (let i = 0; i + 1 < edges.length; i++) {
			const x0 = edges[i].px;
			const x1 = edges[i + 1].px;
			list.push(new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(f.x + x0, f.y, x1 - x0, f.height) }));
		}
		stripCache.set(key, list);
	}
	return list;
};

/** the edges' displacement for tip and body values (road px; + y is down): the probes and the game use the same rule */
export const treeEdgeOffsets = (edges: readonly Edge[], tip: number, body: number, dir: number, shift = WAGON_TREE.body.shift) =>
	edges.map((e) => ({ dy: -(tip * e.tip + body * e.body), dx: -dir * shift * body * e.body }));

export class WagonTree {
	readonly root = new PIXI.Container();
	private readonly strips: PIXI.Sprite[] = [];
	private readonly rail = new PIXI.Sprite();
	private readonly ropes = new PIXI.Sprite();
	readonly tip = new RiderSpring();
	readonly body = new RiderSpring();
	frame: TreeFrame | null = null;
	private edges: Edge[] = [];
	private dir = 1;
	private drawnTip = NaN;
	private drawnBody = NaN;
	/** what it drew last (the probes): the tip's and the body's travel, road px (+ = down), and the largest move of an edge
	 *  under a rope (always 0) */
	last = { tipDy: 0, bodyDy: 0, ropeDy: 0, strips: 0 };

	constructor(
		private readonly tex: TextureLookup,
		private readonly tier: 'full' | 'phone',
	) {
		this.root.label = 'wagonTree';
		this.rail.label = 'treeRail';
		this.ropes.label = 'treeRopes';
		this.root.addChild(this.rail, this.ropes);
	}

	/** the wagon picture this tree rides on (its direction); false when the art is missing */
	setFrame(frame: TreeFrame): boolean {
		if (frame === this.frame) return true;
		const base = this.tex(`${frame}_tree`);
		const railT = this.tex(`${frame}_rail`);
		const ropesT = this.tex(`${frame}_ropes`);
		if (!base || !railT || !ropesT) return false;
		const a = art(frame, this.tier);
		this.frame = frame;
		this.edges = a.strips;
		this.dir = frame === 'H2_R' ? 1 : -1;
		const parts = stripsOf(base, frame, a.strips);
		while (this.strips.length < parts.length) {
			const s = new PIXI.Sprite();
			s.label = 'treeStrip';
			this.root.addChildAt(s, this.strips.length);
			this.strips.push(s);
		}
		this.strips.forEach((s, i) => {
			s.visible = i < parts.length;
			if (i < parts.length) s.texture = parts[i];
		});
		const put = (s: PIXI.Sprite, t: PIXI.Texture, b: Box) => {
			s.texture = t;
			s.position.set(b.x, b.y);
			s.width = b.w;
			s.height = b.h;
		};
		put(this.rail, railT, a.rail);
		put(this.ropes, ropesT, a.ropes);
		this.drawnTip = NaN;
		this.last.strips = parts.length;
		return true;
	}

	/** the box of the shadow's extra silhouette (tree and ropes outside the wagon), and its texture */
	shadowArt(): { box: Box; texture: PIXI.Texture | undefined } | null {
		if (!this.frame) return null;
		return { box: art(this.frame, this.tier).shadow, texture: this.tex(`${this.frame}_treeshadow`) };
	}

	/** a new car in this slot (or a jump): the tree hangs still */
	reset() {
		this.tip.reset();
		this.body.reset();
	}

	/** advance the springs by `dtMs` board ms; `accelAt(t)` is the car's forward acceleration (road px/s^2) at board time t */
	step(now: number, dtMs: number, accelAt: (t: number) => number) {
		if (!WAGON_TREE.bend) {
			this.reset();
			return;
		}
		const n = Math.max(1, Math.ceil(dtMs / STEP_MS));
		const h = dtMs / n;
		for (let i = 1; i <= n; i++) {
			const a = accelAt(now - dtMs + i * h);
			this.tip.step(a, h, WAGON_TREE.tip);
			this.body.step(a, h, WAGON_TREE.body);
		}
	}

	/** the strips at the springs' values now (only when they changed) */
	draw() {
		if (!this.frame) return;
		const tip = this.tip.b;
		const body = this.body.b;
		if (Math.abs(tip - this.drawnTip) < 0.004 && Math.abs(body - this.drawnBody) < 0.002) return;
		this.drawnTip = tip;
		this.drawnBody = body;
		const a = art(this.frame, this.tier);
		const off = treeEdgeOffsets(this.edges, tip, body, this.dir);
		const T = a.tree;
		const n = this.edges.length - 1;
		const sy = T.h / Math.max(1, this.strips[0]?.texture.height ?? 1);
		let tipDy = 0;
		let bodyDy = 0;
		let ropeDy = 0;
		for (let i = 0; i < n; i++) {
			const s = this.strips[i];
			const e0 = this.edges[i];
			const e1 = this.edges[i + 1];
			const wpx = Math.max(1, e1.px - e0.px);
			const ax = (e1.x - e0.x + off[i + 1].dx - off[i].dx) / wpx;
			const by = (off[i + 1].dy - off[i].dy) / wpx;
			s.position.set(e0.x + off[i].dx, T.y + off[i].dy);
			s.skew.set(0, Math.atan2(by, ax));
			s.scale.set(Math.hypot(ax, by), sy);
		}
		for (let i = 0; i <= n; i++) {
			const e = this.edges[i];
			const d = off[i].dy;
			if (e.tip >= 0.99) tipDy = Math.abs(d) > Math.abs(tipDy) ? d : tipDy;
			else if (e.rope) ropeDy = Math.max(ropeDy, Math.abs(d), Math.abs(off[i].dx));
			else if (e.tip === 0) bodyDy = Math.abs(d) > Math.abs(bodyDy) ? d : bodyDy;
		}
		this.last = { tipDy: Math.round(tipDy * 1000) / 1000, bodyDy: Math.round(bodyDy * 1000) / 1000, ropeDy, strips: n };
	}

	destroy() {
		this.root.destroy({ children: true });
	}
}
