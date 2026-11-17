// THE LED SCOREBOARD (Corey 2026-11-16, bigwin_led_r3_2026-11-16 "r3b", approved from the live mock; part A 2026-11-17;
// constants LED_BOARD). Under the road a one-row LED STRIP, always on and always lit: the six idle cartoons, the bonus
// round's counter, the Grandma gag, the small win and the Big and Super wins. Behind it a separate LED BACK BOARD with the
// strip's width, frame, dot pitch and bezel: for Mega, Epic and Max it rises (style C: past its seat, back down with one
// bounce) and seats its bottom rail under the strip's snow cap, so the pair reads as one scoreboard, while the strip keeps
// its own line. Decoration only: it shows the book's amounts; its race draws from its own random source.
//
// HOW IT IS DRAWN (plain Pixi, no filter, shader, mask, backdrop-filter or blob: URL), back to front:
//   the dim          a flat dark quad over the scene while the back board is up (the HUD's own areas left out)
//   the back board   a Graphics housing (frame, recess, bolts, icicles, snow cap) and its face, moved up and down as one
//   the snow cover   THE FOREGROUND SNOW that hides the lowered back board (no mask): crops of the scene's OWN textures (the
//                    preset's field tile, the road picture, the bottom band, game/scenePresets.ts boardCover) laid exactly
//                    where the scene draws them, from the strip's top to the screen's bottom, the back board's width. It
//                    adds no texture memory and cannot be told from the scene behind it. Under the dim it is tinted as the
//                    dim darkens the scene.
//   the strip        its Graphics housing and its face
//   a face           a CPU canvas at ONE PIXEL PER DOT (game/scoreboard/scoreboardDraw.ts), shown by a sprite stretched over
//                    the face with NEAREST sampling (a dot is a block) and re-sent to the GPU at LED_BOARD.fps; one shared
//                    grille tile of round soft holes (mipmapped) laid over it, one hole per dot; the same picture at half
//                    size, linear, ADDED faintly over it (the LED glow); a static glass sheen
// Part B (the staged scenes, the beacons, the diamond, the entries and the Total Win, the tier sounds) hooks in at
// `backProgram` (what the back board's face draws), `onTier` and `onBeat` below, and the show kinds in show.ts.
import * as PIXI from 'pixi.js';

import { LED_BOARD } from '../constants';
import { C, mk, shimmer, type Cv } from '../landing/ledScreens';
import { type ScoreboardGeo, type Rect } from './layout';
import { CARTOONS, countBorder, dissolveFace, gagWordsAt, makeFaceCanvases, powerOffFace, scanReveal, showCartoon, showCounter, showGag, showSmall, showWin, stripFlourish, type CartoonState, type Face } from './scoreboardDraw';
import { amountNow, backOffset, brightOf, dimAlpha, endShow, newShow, phaseOf, seatedAt, skipShow, tierNow, type Show } from './show';
import { newRace, type RaceOutcome } from './race';

const col = (hex: string) => Number.parseInt(hex.slice(1), 16);
const GRILLE = { cells: 16, cellPx: 16 };

type GpuFace = {
	F: Face;
	halo: Cv;
	tex: PIXI.Texture;
	haloTex: PIXI.Texture;
	root: PIXI.Container;
	unlit: PIXI.Sprite;
	content: PIXI.Sprite;
	glow: PIXI.Sprite;
	grille: PIXI.Container;
	sheen: PIXI.Sprite;
	/** the content key of the last step (a change starts the strip's switch) */
	key: string;
	switchAt: number;
	switchKind: 'scan' | 'dissolve' | null;
};

/** a scene piece the snow cover is cut from: its texture and its place in road px; `tile` repeats it on its own period */
export type CoverPiece = { tex: PIXI.Texture; x: number; y: number; w: number; h: number; tile?: boolean };

/** what the scoreboard needs from the game each frame */
export type ScoreboardEnv = { free: boolean; left: number };

export type WinRequest = { x: number; amount: number; bet: number; fmt: (v: number) => string; rate: number; auto: boolean; small?: boolean };

/** THE TUNE PANEL'S AND THE DEV HOOK'S WAY IN (staging builds too: the panel cannot reach the DEV-only window hook) */
export const scoreboardDev: { board: Scoreboard | null; bet: () => number; fmt: (v: number) => string } = { board: null, bet: () => 1, fmt: (v) => v.toFixed(2) };

export class Scoreboard {
	readonly root = new PIXI.Container();
	private readonly dim = new PIXI.Sprite(PIXI.Texture.WHITE);
	private readonly backRoot = new PIXI.Container();
	private readonly backHousing = new PIXI.Graphics();
	private readonly coverA = new PIXI.Container();
	private readonly coverB = new PIXI.Container();
	private readonly stripRoot = new PIXI.Container();
	private readonly stripHousing = new PIXI.Graphics();
	/** the press catcher while a win counts or holds (a tap anywhere on the canvas skips; the HTML HUD stays on top) */
	private readonly catcher = new PIXI.Sprite(PIXI.Texture.WHITE);
	private readonly grilleTex: PIXI.Texture;
	private readonly sheenTex: PIXI.Texture;
	private readonly coverFrames: PIXI.Texture[] = [];
	private strip: GpuFace | null = null;
	private back: GpuFace | null = null;
	private geo: ScoreboardGeo | null = null;
	private faceKey = '';
	/** the scoreboard's own clock (real ms) and the last content step drawn */
	private clock = 0;
	private stepAt = -1;
	/** the show on the strip (and the back board when it arrives), and the one still lowering the back board */
	private show: Show | null = null;
	private lowering: Show | null = null;
	private waits = new Map<number, { resolve: () => void; timer: ReturnType<typeof setTimeout> }>();
	/** the Grandma gag's start (clock ms), null when none */
	private gagAt: number | null = null;
	/** the idle cartoons: which one, since when, and the race's own run */
	private cartoon = 0;
	private cartoonAt = 0;
	private readonly cartoonState: CartoonState = { race: null, raceFor: -1, raceNext: null };
	/** the bonus round's counter */
	private left = -1;
	private leftAt = -1e9;
	private free = false;
	/** DEV: driven by hand (frame by frame captures): the ticker's updates are ignored, step() drives it */
	manual = false;
	private env: ScoreboardEnv = { free: false, left: 0 };
	/** the cover's dim tint is set for this alpha */
	private coverTintFor = -1;
	/** readouts for the dev hook and the probe */
	cost = { drawMs: 0, steps: 0, uploadBytes: 0 };
	private log: { at: number; what: string; detail?: string }[] = [];
	/** PART B HOOKS: called on each tier the count reaches (tier, show), and on a show's beats ('rise', 'seated', 'land',
	 *  'exit', 'lowered') */
	onTier: ((tier: number, show: Show) => void) | null = null;
	onBeat: ((beat: string, show: Show) => void) | null = null;
	/** the back board's face program (part B replaces it with the staged scenes): draws face F for show s */
	backProgram: (F: Face, s: Show) => void = (F, s) => {
		showWin(F, s);
		countBorder(F, s);
	};
	/** the catcher's press (Board wires it to the skip) */
	onPress: (() => void) | null = null;

	constructor() {
		this.root.eventMode = 'passive';
		this.dim.eventMode = 'none';
		this.dim.tint = LED_BOARD.dim.color;
		this.dim.alpha = 0;
		this.dim.visible = false;
		this.backRoot.eventMode = 'none';
		this.coverA.eventMode = 'none';
		this.coverB.eventMode = 'none';
		this.stripRoot.eventMode = 'none';
		this.catcher.alpha = 0;
		this.catcher.visible = false;
		this.catcher.eventMode = 'none';
		this.catcher.on('pointertap', () => this.onPress?.());
		this.backRoot.addChild(this.backHousing);
		this.stripRoot.addChild(this.stripHousing);
		this.root.addChild(this.dim, this.backRoot, this.coverA, this.coverB, this.stripRoot, this.catcher);
		this.backRoot.visible = false;
		// the grille's tile: CELLS x CELLS round soft holes in the housing's dark, one hole per dot (made once, mipmapped)
		const n = GRILLE.cells;
		const s = GRILLE.cellPx;
		const tile = mk(n * s, n * s);
		tile.ctx.fillStyle = C.base;
		tile.ctx.fillRect(0, 0, n * s, n * s);
		const stamp = mk(s, s);
		const rg = stamp.ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.47);
		rg.addColorStop(0, 'rgba(0,0,0,1)');
		rg.addColorStop(0.5, 'rgba(0,0,0,1)');
		rg.addColorStop(0.78, 'rgba(0,0,0,0.5)');
		rg.addColorStop(1, 'rgba(0,0,0,0)');
		stamp.ctx.fillStyle = rg;
		stamp.ctx.fillRect(0, 0, s, s);
		tile.ctx.globalCompositeOperation = 'destination-out';
		for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) tile.ctx.drawImage(stamp, i * s, j * s);
		tile.ctx.globalCompositeOperation = 'source-over';
		this.grilleTex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: tile as unknown as PIXI.ICanvas, autoGenerateMipmaps: true, scaleMode: 'linear' }) });
		const sh = mk(32, 32);
		const gr = sh.ctx.createLinearGradient(0, 0, 32 * 0.6, 32);
		gr.addColorStop(0, 'rgba(255,255,255,0.045)');
		gr.addColorStop(0.5, 'rgba(255,255,255,0)');
		sh.ctx.fillStyle = gr;
		sh.ctx.fillRect(0, 0, 32, 32);
		this.sheenTex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: sh as unknown as PIXI.ICanvas }) });
		scoreboardDev.board = this;
	}

	// ---- THE PLACE ------------------------------------------------------------------------------------------------------------
	/** the place for the screen as it is now; a change of the dots across rebuilds the faces. `pieces`: the scene's pieces the
	 *  snow cover is cut from (road px). */
	layout(g: ScoreboardGeo, pieces: CoverPiece[]) {
		this.geo = g;
		const key = `${g.strip.face.dotsW}x${g.strip.face.dotsH}|${g.back.face.dotsH}`;
		if (key !== this.faceKey) {
			this.faceKey = key;
			this.destroyFace(this.strip);
			this.destroyFace(this.back);
			this.strip = this.makeFace(g.strip.face.dotsW, g.strip.face.dotsH);
			this.back = this.makeFace(g.back.face.dotsW, g.back.face.dotsH);
			this.stripRoot.addChild(this.strip.root);
			this.backRoot.addChild(this.back.root);
			this.stepAt = -1;
		}
		this.placeFace(this.strip!, g.strip.face);
		this.placeFace(this.back!, g.back.face);
		this.drawHousing(this.stripHousing, g, g.strip.housing, g.strip.face, g.strip.cap);
		this.drawHousing(this.backHousing, g, g.back.housing, g.back.face, g.back.cap);
		this.dim.position.set(g.dim.x, g.dim.y);
		this.dim.width = g.dim.w;
		this.dim.height = g.dim.h;
		this.catcher.position.set(0, 0);
		this.catcher.width = g.W;
		this.catcher.height = g.H;
		this.buildCover(g, pieces);
		this.place();
	}

	/** the back board's sprite box (its housing with the cap and the padding above it), CSS px, seated */
	private backBox(): Rect {
		const g = this.geo!;
		const Hs = g.back.housing;
		const padX = g.f * 1.2;
		const padTop = g.back.cap * 1.4;
		return { x: Hs.x - padX, y: Hs.y - padTop, w: Hs.w + 2 * padX, h: Hs.h + padTop };
	}
	/** how far below its seat the fully lowered board sits: its top 4 px under the strip's top (the strip hides it) */
	private downD(): number {
		const g = this.geo!;
		return g.strip.housing.y + 4 - this.backBox().y;
	}

	/** THE SNOW COVER: the scene's own pieces cropped to the cover's rectangles (sub-frames of the loaded textures) */
	private buildCover(g: ScoreboardGeo, pieces: CoverPiece[]) {
		for (const c of [this.coverA, this.coverB]) c.removeChildren().forEach((s) => s.destroy());
		for (const t of this.coverFrames.splice(0)) t.destroy(false);
		const { ox, oy, k } = g.road;
		for (const c of [this.coverA, this.coverB]) {
			c.position.set(ox, oy);
			c.scale.set(k);
		}
		const bb = this.backBox();
		const x0 = bb.x - 2;
		const x1 = bb.x + bb.w + 2;
		const top = g.strip.housing.y;
		// coverA: from the strip's top to the dim's bottom edge (dimmed with the scene); coverB: from there to the screen's
		// bottom (under the HUD, never dimmed)
		const split = Math.max(top, Math.min(g.H + 4, g.dim.y + g.dim.h));
		const rects: [PIXI.Container, number, number][] = [
			[this.coverA, top, split],
			[this.coverB, split, g.H + 4],
		];
		for (const [cont, ya, yb] of rects) {
			if (yb - ya < 0.5) continue;
			// the rectangle in road px
			const r = { l: (x0 - ox) / k, t: (ya - oy) / k, r: (x1 - ox) / k, b: (yb - oy) / k };
			for (const P of pieces) {
				const src = P.tex.source;
				const sx = src.width / P.w;
				const sy = src.height / P.h;
				const cells: [number, number][] = [];
				if (P.tile) {
					for (let j = Math.floor((r.t - P.y) / P.h); P.y + j * P.h < r.b; j++) for (let i = Math.floor((r.l - P.x) / P.w); P.x + i * P.w < r.r; i++) cells.push([P.x + i * P.w, P.y + j * P.h]);
				} else cells.push([P.x, P.y]);
				for (const [px, py] of cells) {
					const il = Math.max(r.l, px);
					const it = Math.max(r.t, py);
					const ir = Math.min(r.r, px + P.w);
					const ib = Math.min(r.b, py + P.h);
					if (ir - il <= 0.01 || ib - it <= 0.01) continue;
					const frame = new PIXI.Rectangle((il - px) * sx, (it - py) * sy, (ir - il) * sx, (ib - it) * sy);
					const t = new PIXI.Texture({ source: src, frame });
					this.coverFrames.push(t);
					const s = new PIXI.Sprite(t);
					s.eventMode = 'none';
					s.position.set(il, it);
					s.width = ir - il;
					s.height = ib - it;
					cont.addChild(s);
				}
			}
		}
		this.coverTintFor = -1;
	}

	private makeFace(dotsW: number, dotsH: number): GpuFace {
		const F = makeFaceCanvases(dotsW, dotsH);
		const halo = mk(Math.ceil(dotsW / 2), Math.ceil(dotsH / 2));
		const tex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: F.out as unknown as PIXI.ICanvas, scaleMode: 'nearest' }) });
		const haloTex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: halo as unknown as PIXI.ICanvas, scaleMode: 'linear' }) });
		const root = new PIXI.Container();
		root.eventMode = 'none';
		const unlit = new PIXI.Sprite(PIXI.Texture.WHITE);
		unlit.tint = col(C.unlit);
		const content = new PIXI.Sprite(tex);
		const grille = new PIXI.Container();
		const glow = new PIXI.Sprite(haloTex);
		glow.blendMode = 'add';
		const sheen = new PIXI.Sprite(this.sheenTex);
		root.addChild(unlit, content, grille, glow, sheen);
		const n = GRILLE.cells;
		const s = GRILLE.cellPx;
		for (let j = 0; j < dotsH; j += n)
			for (let i = 0; i < dotsW; i += n) {
				const cw = Math.min(n, dotsW - i);
				const ch = Math.min(n, dotsH - j);
				const t = cw === n && ch === n ? this.grilleTex : new PIXI.Texture({ source: this.grilleTex.source, frame: new PIXI.Rectangle(0, 0, cw * s, ch * s) });
				const sp = new PIXI.Sprite(t);
				sp.label = `${i},${j},${cw},${ch}`;
				grille.addChild(sp);
			}
		return { F, halo, tex, haloTex, root, unlit, content, glow, grille, sheen, key: '', switchAt: -1e9, switchKind: null };
	}
	private placeFace(G: GpuFace, r: Rect) {
		for (const s of [G.unlit, G.content, G.glow, G.sheen]) {
			s.position.set(r.x, r.y);
			s.width = r.w;
			s.height = r.h;
		}
		const p = r.w / G.F.dotsW;
		for (const sp of G.grille.children as PIXI.Sprite[]) {
			const [i, j, cw, ch] = sp.label.split(',').map(Number);
			sp.position.set(r.x + i * p, r.y + j * p);
			sp.width = cw * p;
			sp.height = ch * p;
		}
	}
	private destroyFace(G: GpuFace | null) {
		if (!G) return;
		G.root.destroy({ children: true });
		G.tex.destroy(true);
		G.haloTex.destroy(true);
		for (const sp of G.grille.children as PIXI.Sprite[]) if (sp.texture !== this.grilleTex) sp.texture.destroy(false);
	}

	/** the housing (the mock's housingSprite, as Graphics: vector, sharp at any size): body, recess, bolts, icicles, cap */
	private drawHousing(g: PIXI.Graphics, G: ScoreboardGeo, Hs: Rect, face: Rect, capH: number) {
		g.clear();
		const f = G.f;
		const ol = G.ol;
		const rnd = (i: number) => {
			const x = Math.sin((i * 3.7 + 11) * 127.1 + 311.7) * 43758.5453;
			return x - Math.floor(x);
		};
		const OUT = 0x12161c;
		const line = { width: ol, color: OUT, join: 'round' as const, cap: 'round' as const };
		g.roundRect(Hs.x, Hs.y, Hs.w, Hs.h, f * 0.45).fill(0x2f3b4a).stroke(line);
		g.roundRect(Hs.x + f * 0.28, Hs.y + f * 0.28, Hs.w - f * 0.56, Hs.h - f * 0.56, f * 0.3).stroke({ width: Math.max(1.2, ol * 0.45), color: 0x4a5a6d });
		g.rect(face.x, face.y, face.w, face.h).fill(col(C.base));
		g.rect(face.x - 1, face.y - 1, face.w + 2, face.h + 2).stroke({ width: Math.max(1.5, ol * 0.7), color: 0x0a0d12 });
		const br = Math.max(1.5, f * 0.16);
		for (const [bx, by] of [
			[Hs.x + f * 0.5, Hs.y + Hs.h - f * 0.5],
			[Hs.x + Hs.w - f * 0.5, Hs.y + Hs.h - f * 0.5],
		])
			g.circle(bx, by, br).fill(0x8b99a9).stroke({ width: Math.max(1, ol * 0.5), color: OUT });
		const x0 = Hs.x - f * 0.5;
		const x1 = Hs.x + Hs.w + f * 0.5;
		const baseY = Hs.y + f * 0.2;
		const nI = Math.round((x1 - x0) / (f * 1.25));
		for (let i = 0; i < nI; i++) {
			const x = x0 + f * 0.9 + ((x1 - x0 - f * 1.8) * (i + rnd(i) * 0.6)) / nI;
			const yT = baseY + capH * 0.1;
			const len = Math.min(face.y - 3 - yT, f * (0.55 + rnd(i + 40) * 0.6));
			const wI = f * (0.26 + rnd(i + 80) * 0.14);
			if (len < 2) continue;
			g.poly([x - wI / 2, yT - 2, x + wI / 2, yT - 2, x + wI * 0.08, yT + len]).fill(0xdff3ff).stroke({ width: Math.max(1, ol * 0.6), color: OUT, join: 'round' });
		}
		const cap = (lift: number) => {
			g.moveTo(x0, baseY - lift);
			g.quadraticCurveTo(x0 - capH * 0.15, Hs.y - capH * 0.35, x0 + capH * 0.5, Hs.y - capH * 0.55);
			const n = Math.max(4, Math.round((x1 - x0 - capH) / (capH * 2.2)));
			const bw = (x1 - x0 - capH) / n;
			for (let i = 0; i < n; i++) {
				const xa = x0 + capH * 0.5 + bw * i;
				g.quadraticCurveTo(xa + bw / 2, Hs.y - capH * (0.95 + rnd(i + 7) * 0.35), xa + bw, Hs.y - capH * (0.5 + rnd(i + 21) * 0.15));
			}
			g.quadraticCurveTo(x1 + capH * 0.15, Hs.y - capH * 0.3, x1, baseY - lift);
			const m = Math.max(5, Math.round((x1 - x0) / (capH * 1.3)));
			const sw = (x1 - x0) / m;
			for (let i = m - 1; i >= 0; i--) {
				const xb = x0 + sw * i;
				g.quadraticCurveTo(xb + sw / 2, baseY - lift + capH * (0.08 + rnd(i + 60) * 0.22), xb, baseY - lift);
			}
			g.closePath();
		};
		cap(0);
		g.fill(0xc9def2);
		cap(capH * 0.3);
		g.fill(0xf7fbff);
		cap(0);
		g.stroke(line);
	}

	// ---- THE SHOWS --------------------------------------------------------------------------------------------------------------
	/** a win on the scoreboard. Resolves when the round may go on: at once for a small win (never waited for), else when the
	 *  hold is over (the board then powers down and lowers on its own) */
	win(o: WinRequest): Promise<void> {
		if (!LED_BOARD.on) return Promise.resolve();
		const s = newShow(o);
		this.start(s);
		if (s.kind === 'small') return Promise.resolve();
		return new Promise<void>((resolve) => {
			// a safety net: the round never waits on a stalled ticker (a hidden tab, a lost context) for longer than twice the
			// show plus 4 s of real time (a slow device's frames still play the whole show first)
			const timer = setTimeout(() => this.release(s.id), s.exitAt * 2 + 4000);
			this.waits.set(s.id, { resolve, timer });
		});
	}
	private start(s: Show) {
		const old = this.show;
		if (old) {
			endShow(old);
			this.release(old.id);
			if (old.arrive && old.t < old.end) this.lowering = old;
		}
		if (s.arrive) {
			// the back board is taken over from wherever it is
			const owner = this.lowering;
			const D = this.geo ? this.downD() : 0;
			s.fromD = owner ? Math.max(-D, Math.min(D, backOffset(owner, D, this.geo?.back.sc ?? 1))) : D;
			this.lowering = null;
		} else this.cutGag('a win on the strip'); // a win message on the strip cuts the Grandma gag short
		this.show = s;
		this.mark('show', `${s.kind} ${s.final} ${s.arrive ? 'back' : 'strip'}`);
		this.onBeat?.('start', s);
	}
	private release(id: number) {
		const w = this.waits.get(id);
		if (!w) return;
		clearTimeout(w.timer);
		this.waits.delete(id);
		w.resolve();
	}
	/** THE SKIP (a press while it counts, or holds): lands the count, or ends the hold */
	skip(): boolean {
		const s = this.show;
		if (!s || s.kind !== 'win') return false;
		const ok = skipShow(s);
		if (ok) this.mark('skip', phaseOf(s));
		return ok;
	}
	/** a win counts or holds now (the press catcher is up, the HUD's WIN is lit) */
	busy(): boolean {
		const s = this.show;
		return !!s && s.kind === 'win' && s.t < s.exitAt;
	}
	/** A NEW SPIN'S PRESS: the Grandma gag and a small win are cut short (a big win is never up at a press: it holds the round) */
	spinPress() {
		this.cutGag('a new spin');
		const s = this.show;
		if (s && s.kind === 'small') {
			endShow(s);
			this.mark('cut', 'small win: a new spin');
		}
	}

	// ---- THE GRANDMA GAG ----------------------------------------------------------------------------------------------------------
	gag() {
		if (!LED_BOARD.on || !LED_BOARD.gag.on) return;
		this.gagAt = this.clock;
		this.mark('gag', 'start');
	}
	private cutGag(why: string) {
		if (this.gagAt === null) return;
		if (this.clock - this.gagAt < LED_BOARD.gag.ms) this.mark('gag', `cut: ${why}`);
		this.gagAt = null;
	}
	private gagT(): number | null {
		if (this.gagAt === null) return null;
		const t = this.clock - this.gagAt;
		if (t >= LED_BOARD.gag.ms) {
			this.gagAt = null;
			this.mark('gag', 'end');
			return null;
		}
		return t;
	}

	// ---- THE TUNE PANEL AND THE DEV HOOK ----------------------------------------------------------------------------------------
	/** raise the back board with a demo win of `x` play multiples that holds until lower() (no round waits on it) */
	raise(x = 98.75) {
		const bet = scoreboardDev.bet();
		const s = newShow({ x: Math.max(x, LED_BOARD.tiers[LED_BOARD.backFromTier].bar), amount: Math.round(x * bet * 100) / 100, bet, fmt: scoreboardDev.fmt, rate: 1, auto: false });
		s.exitAt = 1e12;
		s.end = 1e12;
		this.start(s);
	}
	lower() {
		const s = this.show;
		if (s && s.arrive) endShow(s);
	}
	/** play the race now (null: its own draw; a result: that result) */
	race(force: RaceOutcome | null = null) {
		this.cartoonState.raceNext = newRace(force);
		this.cartoon = CARTOONS.findIndex((c) => c.key === 'race');
		this.cartoonAt = this.clock;
		this.cartoonState.race = null;
	}

	// ---- THE FRAME ----------------------------------------------------------------------------------------------------------------
	/** DEV: `ms` of the scoreboard's time by hand (manual mode), drawn at once */
	step(ms: number) {
		const m = this.manual;
		this.manual = false;
		this.stepAt = -1;
		this.update(ms, this.env);
		this.manual = m;
	}

	update(dtMs: number, env: ScoreboardEnv) {
		this.env = env;
		if (this.manual) return;
		if (!this.geo || !this.strip || !this.back) return;
		// real ms (a slow device keeps the show's length); a stall (a hidden tab) counts as at most a quarter second
		const dt = Math.min(250, Math.max(0, dtMs));
		this.clock += dt;
		if (this.show) this.show.t += dt;
		if (this.lowering) this.lowering.t += dt;
		// the bonus round's counter: its number, and when it changed (the reindeer dashes across)
		if (env.free !== this.free) {
			this.free = env.free;
			this.left = env.left;
		}
		if (env.free && env.left !== this.left) {
			this.left = env.left;
			this.leftAt = this.clock;
		}
		const s = this.show;
		if (s) {
			for (const e of s.events) if (e.at <= s.t && e.at > s.t - dt) this.onTier?.(e.tier, s);
			if (s.t >= s.exitAt) this.release(s.id);
			if (s.t >= s.end) {
				this.onBeat?.('gone', s);
				this.show = null;
			}
		}
		if (this.lowering && this.lowering.t >= this.lowering.end) this.lowering = null;
		this.place();
		// the dots' content: re-drawn and re-sent at LED_BOARD.fps (an LED controller's refresh), not every frame
		const step = Math.floor((this.clock * LED_BOARD.fps) / 1000);
		if (step === this.stepAt) return;
		this.stepAt = step;
		const t0 = performance.now();
		this.drawStrip();
		if (this.backRoot.visible) this.drawBack();
		this.cost.drawMs = Math.round((performance.now() - t0) * 100) / 100;
		this.cost.steps += 1;
	}

	/** the board's owner: the show up now if it uses the back board, else the one still lowering */
	private backShow(): Show | null {
		if (this.show?.arrive) return this.show;
		return this.lowering;
	}
	/** the back board's place, the dim, the catcher */
	private place() {
		const g = this.geo;
		if (!g) return;
		const D = this.downD();
		const bs = this.backShow();
		const y = bs ? backOffset(bs, D, g.back.sc) : D;
		this.backRoot.y = y;
		this.backRoot.visible = !!bs && y < D - 0.25;
		const da = dimAlpha(bs);
		this.dim.alpha = da;
		this.dim.visible = da > 0.002;
		if (Math.abs(da - this.coverTintFor) > 0.004) {
			this.coverTintFor = da;
			const v = Math.round(255 * (1 - da));
			const tint = (v << 16) | (v << 8) | v;
			for (const c of this.coverA.children as PIXI.Sprite[]) c.tint = tint;
		}
		const busy = this.busy();
		this.catcher.visible = busy;
		this.catcher.eventMode = busy ? 'static' : 'none';
	}

	private drawStrip() {
		const G = this.strip!;
		const F = G.F;
		const s = this.show;
		let key: string;
		const gt = this.gagT();
		const exited = s && s.t >= s.exitAt;
		if (gt !== null) {
			showGag(F, gt);
			key = `gag${this.gagAt}`;
		} else if (s && !exited) {
			// a strip win, or the strip's own line while the back board is up (the tier and the counting amount; blank while
			// the board rises, as the mock's ribbon)
			if (s.arrive && s.t < s.contentAt) F.out.ctx.clearRect(0, 0, F.dotsW, F.dotsH);
			else if (s.kind === 'small') showSmall(F, s);
			else {
				showWin(F, s);
				if (!s.arrive) stripFlourish(F, s);
			}
			key = `show${s.id}`;
		} else if (this.free) {
			showCounter(F, this.clock, Math.max(0, this.left), this.leftAt);
			key = 'counter';
		} else {
			const want = LED_BOARD.cartoon;
			const pinned = want === 'auto' ? -1 : CARTOONS.findIndex((c) => c.key === want);
			if (pinned >= 0 && pinned !== this.cartoon) {
				this.cartoon = pinned;
				this.cartoonAt = this.clock;
			}
			const idx = this.cartoon % CARTOONS.length;
			if (this.clock - this.cartoonAt > CARTOONS[idx].ms()) {
				this.cartoon = pinned >= 0 ? pinned : (idx + 1) % CARTOONS.length;
				this.cartoonAt = this.clock;
			}
			showCartoon(F, this.cartoon, this.clock - this.cartoonAt, this.cartoonState, this.cartoonAt);
			key = `cartoon${this.cartoon}@${pinned >= 0 ? this.cartoonAt : ''}`;
		}
		// THE STRIP'S OWN SWITCH: a scan line to a message, a dissolve back to the cartoons
		if (G.key !== key) {
			if (G.key) {
				G.switchAt = this.clock;
				G.switchKind = /^(show|gag)/.test(key) ? 'scan' : 'dissolve';
			}
			G.key = key;
		}
		const since = this.clock - G.switchAt;
		if (G.switchKind === 'scan' && since < LED_BOARD.strip.switchMs) {
			const o = F.out.ctx;
			const x = Math.round((since / LED_BOARD.strip.switchMs) * F.dotsW);
			o.drawImage(F.prev, x + 1, 0, F.dotsW - x - 1, F.dotsH, x + 1, 0, F.dotsW - x - 1, F.dotsH);
			o.clearRect(x, 0, 1, F.dotsH);
			o.fillStyle = '#fff';
			o.fillRect(x, 0, 1, F.dotsH);
		} else if (G.switchKind === 'dissolve' && since < LED_BOARD.strip.dissolveMs) {
			F.b.ctx.clearRect(0, 0, F.dotsW, F.dotsH);
			F.b.ctx.drawImage(F.out, 0, 0);
			F.a.ctx.clearRect(0, 0, F.dotsW, F.dotsH);
			F.a.ctx.drawImage(F.prev, 0, 0);
			dissolveFace(F, since / LED_BOARD.strip.dissolveMs);
		} else {
			// the last clean picture, kept for the next switch
			F.prev.ctx.clearRect(0, 0, F.dotsW, F.dotsH);
			F.prev.ctx.drawImage(F.out, 0, 0);
		}
		shimmer(F.out.ctx, F.dotsW, F.dotsH, this.clock / 1000);
		this.publish(G, 1);
	}

	private drawBack() {
		const G = this.back!;
		const F = G.F;
		const s = this.backShow();
		F.out.ctx.clearRect(0, 0, F.dotsW, F.dotsH);
		if (!s) return this.publish(G, 1);
		this.backProgram(F, s);
		// the face powers on as it seats (dark until just before, then a scan line), and powers down before it lowers
		const seated = LED_BOARD.rise.backAtMs + LED_BOARD.rise.riseMs;
		if (s.t < seated - 120) F.out.ctx.clearRect(0, 0, F.dotsW, F.dotsH);
		else scanReveal(F, (s.t - (seated - 120)) / LED_BOARD.rise.scanMs);
		if (s.t > s.exitAt) powerOffFace(F, Math.min(1, (s.t - s.exitAt) / LED_BOARD.rise.powerDownMs));
		shimmer(F.out.ctx, F.dotsW, F.dotsH, this.clock / 1000);
		this.publish(G, brightOf(s));
	}

	/** the dots to the GPU: the face's picture, and its half size halo */
	private publish(G: GpuFace, bright: number) {
		const h = G.halo.ctx;
		h.clearRect(0, 0, G.halo.width, G.halo.height);
		h.imageSmoothingEnabled = true;
		h.drawImage(G.F.out, 0, 0, G.halo.width, G.halo.height);
		G.tex.source.update();
		G.haloTex.source.update();
		G.content.alpha = bright;
		G.glow.alpha = LED_BOARD.halo * bright;
		this.cost.uploadBytes = (G.F.dotsW * G.F.dotsH + G.halo.width * G.halo.height) * 4;
	}

	private mark(what: string, detail?: string) {
		this.log.push({ at: Math.round(this.clock), what, detail });
		if (this.log.length > 200) this.log.splice(0, this.log.length - 200);
	}

	// ---- DEV / PROBES -----------------------------------------------------------------------------------------------------------
	/** the GPU bytes this system holds: both faces and their halos, the grille tile with its mips, the sheen (the cover adds
	 *  none: it is frames of textures the scene already holds) */
	gpuBytes(): number {
		const face = (G: GpuFace | null) => (G ? (G.F.dotsW * G.F.dotsH + G.halo.width * G.halo.height) * 4 : 0);
		const grille = Math.round(this.grilleTex.source.pixelWidth * this.grilleTex.source.pixelHeight * 4 * (4 / 3));
		return face(this.strip) + face(this.back) + grille + 32 * 32 * 4;
	}
	snapshot() {
		const g = this.geo;
		const r = (v: number) => Math.round(v * 100) / 100;
		const s = this.show;
		const bs = this.backShow();
		const D = g ? this.downD() : 0;
		const gt = this.gagAt === null ? null : this.clock - this.gagAt;
		return {
			on: LED_BOARD.on,
			cls: g?.cls ?? null,
			clock: Math.round(this.clock),
			pitch: g ? r(g.pitch) : null,
			strip: g ? { x: r(g.strip.box.x), y: r(g.strip.box.y), w: r(g.strip.box.w), h: r(g.strip.box.h), housingBottom: r(g.strip.housing.y + g.strip.housing.h), dotsW: g.strip.face.dotsW, dotsH: g.strip.face.dotsH, capTop: r(g.strip.housing.y - g.strip.cap * 1.3) } : null,
			back: g
				? {
						housing: { x: r(g.back.housing.x), y: r(g.back.housing.y), w: r(g.back.housing.w), h: r(g.back.housing.h) },
						dotsW: g.back.face.dotsW,
						dotsH: g.back.face.dotsH,
						offset: r(this.backRoot.y),
						down: r(D),
						visible: this.backRoot.visible,
						/** the housing's bottom edge where it is drawn now, and the strip's top: seated = bottom at strip top + f/2 */
						bottomNow: r(g.back.housing.y + g.back.housing.h + this.backRoot.y),
						topNow: r(this.backBox().y + this.backRoot.y),
						seatBottom: r(g.strip.housing.y + g.f * 0.5),
					}
				: null,
			dim: { alpha: r(this.dim.alpha), rect: g?.dim ?? null },
			hudTop: g ? r(g.hudTop) : null,
			show: s ? { id: s.id, kind: s.kind, final: s.final, finalTier: s.finalTier, arrive: s.arrive, t: Math.round(s.t), phase: phaseOf(s), tier: tierNow(s), amount: s.fmt(amountNow(s)), finalStr: s.finalStr, countStart: Math.round(s.countStart), countEnd: Math.round(s.countEnd), exitAt: Math.round(s.exitAt), end: Math.round(s.end), skipped: s.skipped, seatedAt: seatedAt(), events: s.events.map((e) => ({ ...e, at: Math.round(e.at) })) } : null,
			lowering: this.lowering ? { id: this.lowering.id, t: Math.round(this.lowering.t), phase: phaseOf(this.lowering) } : null,
			backOwner: bs?.id ?? null,
			busy: this.busy(),
			stripKey: this.strip?.key ?? null,
			gag: gt === null ? null : { t: Math.round(gt), words: gagWordsAt(gt) },
			cartoon: { index: this.cartoon, key: CARTOONS[this.cartoon % CARTOONS.length].key, t: Math.round(this.clock - this.cartoonAt), race: this.cartoonState.race ? { outcome: this.cartoonState.race.outcome, id: this.cartoonState.race.id } : null },
			free: this.free,
			left: this.left,
			cost: { ...this.cost },
			gpuBytes: this.gpuBytes(),
			cover: { a: this.coverA.children.length, b: this.coverB.children.length },
			log: this.log.slice(-40),
		};
	}

	destroy() {
		for (const w of this.waits.values()) {
			clearTimeout(w.timer);
			w.resolve();
		}
		this.waits.clear();
		this.destroyFace(this.strip);
		this.destroyFace(this.back);
		this.strip = null;
		this.back = null;
		for (const t of this.coverFrames.splice(0)) t.destroy(false);
		this.grilleTex.destroy(true);
		this.sheenTex.destroy(true);
		this.root.destroy({ children: true });
		if (scoreboardDev.board === this) scoreboardDev.board = null;
	}
}
