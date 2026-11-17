// THE LED BILLBOARD PRESS SCREEN (Corey 2026-11-16: "That looks amazing", led_billboard_r2_2026-11-16; constants LED_SIGN).
// Over the dimmed first board, a roadside LED billboard on two poles in a snow drift: three screens cycle on its round
// dot face (the max win; Santa's sleigh struck; Grandma's car struck), changing by a DISSOLVE, and the ticker under them
// says PRESS ANYWHERE TO CONTINUE once the game may be entered (the press gate's own rules: ui/LandingScreen.svelte).
// The press powers the sign down (a flicker, the dots go out, it sinks and fades) and the game is there.
//
// HOW IT IS DRAWN (plain Pixi, no filter, shader, mask, blur or blob: URL):
//   the screens   a 2D canvas at ONE PIXEL PER DOT (game/landing/ledScreens.ts), shown by a sprite stretched over the
//                 face with NEAREST sampling (a dot is a block), its pixels re-sent to the GPU at LED_SIGN.fps
//   the grille    one small tile of round soft holes in the housing's dark (a canvas made once, with a mip chain), laid
//                 as plain sprites over the face, one hole per dot: the blocks show through as round dots
//   the halo      the same picture at half size, linear, ADDED faintly over the face (the LED's soft glow)
//   the housing   one PIXI.Graphics: the poles, the snow drift edge to edge, the body, the recesses, the bolts, the
//                 icicles and the snow cap (vector: sharp at any size), and a full screen dim behind it all
// Everything is in canvas CSS px, laid out from the board's rectangle per layout (the face centred on the board).
import * as PIXI from 'pixi.js';

import { LED_SIGN, type LedLayout } from '../constants';
import { C, SCREENS, dissolve, ease, mk, powerOff, screenTicker, shimmer, span, type Cv, type LedText } from './ledScreens';

type Face = {
	dotsW: number;
	dotsH: number;
	rect: { x: number; y: number; w: number; h: number };
	a: Cv;
	b: Cv;
	out: Cv;
	halo: Cv;
	noise: Float32Array;
	tex: PIXI.Texture;
	haloTex: PIXI.Texture;
	root: PIXI.Container;
	unlit: PIXI.Sprite;
	content: PIXI.Sprite;
	glow: PIXI.Sprite;
	grille: PIXI.Container;
};

export type LedGeometry = {
	face: { x: number; y: number; w: number; h: number; dotsW: number; dotsH: number };
	ticker: { x: number; y: number; w: number; h: number; dotsW: number; dotsH: number };
	housing: { x: number; y: number; w: number; h: number };
	pitch: number;
	frame: number;
	ol: number;
	pole: number;
	drift: number;
	cap: number;
	W: number;
	H: number;
};

/** THE SIGN'S PLACE for a layout: the canvas (CSS px), the master's CSS px per unit, the board's rectangle (CSS px) */
export const ledGeometry = (kind: 'landscape' | 'portrait' | 'phone', W: number, H: number, unit: number, board: { x: number; y: number; w: number; h: number }): LedGeometry => {
	const L: LedLayout = LED_SIGN.layout[kind];
	const k = L.unit === 'master' ? unit : 1;
	let faceW = L.faceW * k;
	let faceH = L.faceH * k;
	let drift = L.drift * k;
	if (kind === 'portrait') {
		// an upright phone: the face is as wide as the screen less its margins (never wider than the board's share), and
		// its height follows the screen's height between Corey's two sizes (390x620 and 390x844)
		faceW = Math.min(W - 2 * L.margin, board.w * L.boardShare);
		const u = (H - 620) / (844 - 620);
		faceH = Math.max(L.faceH * 0.8, Math.min(L.faceHTall * 1.15, L.faceH + (L.faceHTall - L.faceH) * u));
		drift = L.drift + (L.driftTall - L.drift) * Math.max(0, Math.min(1, u));
	}
	const pitch = (L.pitch * k) / LED_SIGN.density;
	const dotsW = Math.max(40, Math.floor(faceW / pitch));
	const p = faceW / dotsW;
	const dotsH = Math.max(20, Math.floor(faceH / p));
	faceH = dotsH * p;
	const frame = L.frame * k;
	const gap = frame * 0.75;
	const cx = board.x + board.w / 2;
	const top = Math.round(board.y + board.h / 2 - faceH / 2);
	const face = { x: cx - faceW / 2, y: top, w: faceW, h: faceH, dotsW, dotsH };
	const tdots = LED_SIGN.tickerDots;
	const ticker = { x: face.x, y: face.y + faceH + gap, w: faceW, h: tdots * p, dotsW, dotsH: tdots };
	const housing = { x: face.x - frame, y: face.y - frame * 1.7, w: faceW + 2 * frame, h: faceH + gap + ticker.h + 2.7 * frame };
	return { face, ticker, housing, pitch: p, frame, ol: L.ol * k, pole: L.pole * k, drift, cap: L.cap * k, W, H };
};

const rnd = (i: number) => {
	const x = Math.sin((i * 3.7 + 11) * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

/** THE SNOW CAP'S DRAWN TOP (2026-11-17; the press screen rests the billboard logo on it, components/Board.svelte): the
 *  top edge of the cap's outline as drawHousing draws it (its scalloped curve, less half its outline's width), one value
 *  per CSS px column from `x0` (the cap's left end) on. The same curves as drawHousing's cap(0). */
export const capTopProfile = (G: LedGeometry): { x0: number; ys: Float32Array } => {
	const Hs = G.housing;
	const f = G.frame;
	const capH = G.cap;
	const x0 = Hs.x - f * 0.5;
	const x1 = Hs.x + Hs.w + f * 0.5;
	const baseY = Hs.y + f * 0.2;
	const segs: number[][] = [];
	let px = x0;
	let py = baseY;
	const q = (cx: number, cy: number, ex: number, ey: number) => {
		segs.push([px, py, cx, cy, ex, ey]);
		px = ex;
		py = ey;
	};
	q(x0 - capH * 0.15, Hs.y - capH * 0.35, x0 + capH * 0.5, Hs.y - capH * 0.55);
	const n = Math.max(4, Math.round((x1 - x0 - capH) / (capH * 2.2)));
	const bw = (x1 - x0 - capH) / n;
	for (let i = 0; i < n; i++) {
		const xa = x0 + capH * 0.5 + bw * i;
		q(xa + bw / 2, Hs.y - capH * (0.95 + rnd(i + 7) * 0.35), xa + bw, Hs.y - capH * (0.5 + rnd(i + 21) * 0.15));
	}
	q(x1 + capH * 0.15, Hs.y - capH * 0.3, x1, baseY);
	const w = Math.ceil(x1 - x0) + 1;
	const ys = new Float32Array(w).fill(Infinity);
	for (const [ax, ay, cx, cy, ex, ey] of segs)
		for (let k = 0; k <= 64; k++) {
			const t = k / 64;
			const u = 1 - t;
			const x = u * u * ax + 2 * u * t * cx + t * t * ex;
			const y = u * u * ay + 2 * u * t * cy + t * t * ey;
			const i = Math.round(x - x0);
			if (i >= 0 && i < w && y < ys[i]) ys[i] = y;
		}
	// (a column no sample fell in takes its neighbor's)
	for (let i = 1; i < w; i++) if (!Number.isFinite(ys[i])) ys[i] = ys[i - 1];
	for (let i = 0; i < w; i++) ys[i] -= G.ol / 2;
	return { x0, ys };
};
const col = (hex: string) => Number.parseInt(hex.slice(1), 16);

export class LedSign {
	readonly root = new PIXI.Container();
	private readonly dim = new PIXI.Sprite(PIXI.Texture.WHITE);
	private readonly sign = new PIXI.Container();
	private readonly housing = new PIXI.Graphics();
	private readonly sheen: PIXI.Sprite;
	private readonly sheenTex: PIXI.Texture;
	private readonly grilleTex: PIXI.Texture;
	private face: Face | null = null;
	private tick: Face | null = null;
	private geo: LedGeometry | null = null;
	private key = '';
	/** screen time, s; the last content step drawn */
	private T = 0;
	private stepAt = -1;
	private mode: 'live' | 'exit' | 'gone' = 'live';
	private exitMs = 0;
	private handOver: (() => void) | null = null;
	/** DEV: the screens' time held here (the probe's captures of each screen), null = running */
	private frozenAt: number | null = null;
	/** the ticker's line is up (the press gate is open) */
	ready = false;
	/** DEV readouts: the cost of the last content step (ms of drawing and of the texture update), the steps drawn */
	cost = { drawMs: 0, steps: 0, lastScreen: 0, uploadBytes: 0 };
	onGone: (() => void) | null = null;

	constructor(private readonly text: LedText) {
		this.dim.tint = col(LED_SIGN.dim.color);
		this.dim.alpha = LED_SIGN.dim.alpha;
		this.root.addChild(this.dim, this.sign);
		this.sign.addChild(this.housing);
		// the grille's tile: CELLS x CELLS round soft holes in the housing's dark, one hole per dot (made once, mipmapped)
		const n = LED_SIGN.grille.cells;
		const s = LED_SIGN.grille.cellPx;
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
		// the glass sheen: one static diagonal gradient (the page's), a small picture stretched over the face
		const sh = mk(32, 32);
		const gr = sh.ctx.createLinearGradient(0, 0, 32 * 0.6, 32);
		gr.addColorStop(0, 'rgba(255,255,255,0.045)');
		gr.addColorStop(0.5, 'rgba(255,255,255,0)');
		sh.ctx.fillStyle = gr;
		sh.ctx.fillRect(0, 0, 32, 32);
		this.sheenTex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: sh as unknown as PIXI.ICanvas }) });
		this.sheen = new PIXI.Sprite(this.sheenTex);
	}

	/** the place for the screen as it is now; a change of the dots across rebuilds the faces */
	layout(g: LedGeometry) {
		this.geo = g;
		this.dim.position.set(-20, -20);
		this.dim.width = g.W + 40;
		this.dim.height = g.H + 40;
		const key = `${g.face.dotsW}x${g.face.dotsH}`;
		if (key !== this.key) {
			this.key = key;
			this.face?.root.destroy({ children: true });
			this.tick?.root.destroy({ children: true });
			this.destroyFace(this.face);
			this.destroyFace(this.tick);
			this.face = this.makeFace(g.face.dotsW, g.face.dotsH);
			this.tick = this.makeFace(g.ticker.dotsW, g.ticker.dotsH);
			this.sign.addChild(this.face.root, this.tick.root, this.sheen);
			this.stepAt = -1;
		}
		this.placeFace(this.face!, g.face);
		this.placeFace(this.tick!, g.ticker);
		this.sheen.position.set(g.face.x, g.face.y);
		this.sheen.width = g.face.w;
		this.sheen.height = g.face.h;
		this.drawHousing(g);
	}

	private makeFace(dotsW: number, dotsH: number): Face {
		const out = mk(dotsW, dotsH);
		const halo = mk(Math.ceil(dotsW / 2), Math.ceil(dotsH / 2));
		const noise = new Float32Array(dotsW * dotsH);
		for (let i = 0; i < noise.length; i++) noise[i] = Math.random();
		const tex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: out as unknown as PIXI.ICanvas, scaleMode: 'nearest' }) });
		const haloTex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: halo as unknown as PIXI.ICanvas, scaleMode: 'linear' }) });
		const root = new PIXI.Container();
		const unlit = new PIXI.Sprite(PIXI.Texture.WHITE);
		unlit.tint = col(C.unlit);
		const content = new PIXI.Sprite(tex);
		const grille = new PIXI.Container();
		const glow = new PIXI.Sprite(haloTex);
		glow.blendMode = 'add';
		root.addChild(unlit, content, grille, glow);
		// the grille's tiles: whole tiles, the last row and column cut to the dots left (sub frames of the one tile)
		const n = LED_SIGN.grille.cells;
		const s = LED_SIGN.grille.cellPx;
		for (let j = 0; j < dotsH; j += n)
			for (let i = 0; i < dotsW; i += n) {
				const cw = Math.min(n, dotsW - i);
				const ch = Math.min(n, dotsH - j);
				const t = cw === n && ch === n ? this.grilleTex : new PIXI.Texture({ source: this.grilleTex.source, frame: new PIXI.Rectangle(0, 0, cw * s, ch * s) });
				const sp = new PIXI.Sprite(t);
				sp.label = `${i},${j},${cw},${ch}`;
				grille.addChild(sp);
			}
		return { dotsW, dotsH, rect: { x: 0, y: 0, w: 1, h: 1 }, a: mk(dotsW, dotsH), b: mk(dotsW, dotsH), out, halo, noise, tex, haloTex, root, unlit, content, glow, grille };
	}

	private placeFace(F: Face, r: { x: number; y: number; w: number; h: number }) {
		F.rect = r;
		for (const s of [F.unlit, F.content, F.glow]) {
			s.position.set(r.x, r.y);
			s.width = r.w;
			s.height = r.h;
		}
		const p = r.w / F.dotsW;
		for (const sp of F.grille.children as PIXI.Sprite[]) {
			const [i, j, cw, ch] = sp.label.split(',').map(Number);
			sp.position.set(r.x + i * p, r.y + j * p);
			sp.width = cw * p;
			sp.height = ch * p;
		}
	}

	private destroyFace(F: Face | null) {
		if (!F) return;
		F.tex.destroy(true);
		F.haloTex.destroy(true);
	}

	// ---- the housing (the page's drawHousing, as Graphics) ----
	private drawHousing(G: LedGeometry) {
		const g = this.housing;
		g.clear();
		const { housing: Hs, face, ticker } = G;
		const f = G.frame;
		const ol = G.ol;
		const big = G.W >= 1000;
		const OUT = 0x12161c;
		const line = { width: ol, color: OUT, join: 'round' as const, cap: 'round' as const };
		// the poles: solid and smooth, two of them, into the drift
		const pw = G.pole;
		for (const cx of [Hs.x + Hs.w * 0.22, Hs.x + Hs.w * 0.78]) {
			const y0 = Hs.y + Hs.h - 4;
			const y1 = G.H + 10;
			g.rect(cx - pw / 2, y0, pw, y1 - y0).fill(0x9aa6b3);
			g.rect(cx + pw * 0.12, y0, pw * 0.38, y1 - y0).fill(0x7a8694);
			g.rect(cx - pw * 0.34, y0, pw * 0.12, y1 - y0).fill(0xc4cdd6);
			g.rect(cx - pw / 2, y0, pw, y1 - y0).stroke(line);
		}
		// the snow drift at the foot: edge to edge at every size, one path, its foot below the screen's edge
		const dh = G.drift;
		const dx0 = -16;
		const dx1 = G.W + 16;
		const drift = (dy: number) => {
			g.moveTo(dx0, G.H + 4 + dy);
			const n = Math.max(5, Math.round(G.W / (big ? 170 : 75)));
			for (let i = 0; i <= n; i++) {
				const x = dx0 + ((dx1 - dx0) * i) / n;
				const y = G.H - dh * (0.55 + 0.45 * Math.sin((i / n) * Math.PI)) - (i % 2 ? dh * 0.12 : 0) + dy;
				if (i === 0) g.lineTo(x, y);
				else g.quadraticCurveTo(x - (dx1 - dx0) / n / 2, y - dh * 0.25, x, y);
			}
			g.lineTo(dx1, G.H + 4 + dy);
			g.closePath();
		};
		drift(0);
		g.fill(0xcfe2f5);
		// its lit top: the same drift lowered (its foot is off the screen, so it stays inside the drift)
		drift(dh * 0.3);
		g.fill(0xf6fbff);
		drift(0);
		g.stroke(line);
		// the body
		g.roundRect(Hs.x, Hs.y, Hs.w, Hs.h, f * 0.45).fill(0x2f3b4a).stroke(line);
		g.roundRect(Hs.x + f * 0.28, Hs.y + f * 0.28, Hs.w - f * 0.56, Hs.h - f * 0.56, f * 0.3).stroke({ width: Math.max(1.5, ol * 0.45), color: 0x4a5a6d });
		// the recesses for the face and the ticker
		for (const r of [face, ticker]) {
			g.rect(r.x, r.y, r.w, r.h).fill(col(C.base));
			g.rect(r.x - 1, r.y - 1, r.w + 2, r.h + 2).stroke({ width: Math.max(2, ol * 0.7), color: 0x0a0d12 });
		}
		// the bolts
		const br = Math.max(2, f * 0.16);
		const midY = ticker.y - (ticker.y - face.y - face.h) / 2;
		for (const [bx, by] of [
			[Hs.x + f * 0.5, Hs.y + Hs.h - f * 0.5],
			[Hs.x + Hs.w - f * 0.5, Hs.y + Hs.h - f * 0.5],
			[Hs.x + f * 0.5, midY],
			[Hs.x + Hs.w - f * 0.5, midY],
		])
			g.circle(bx, by, br).fill(0x8b99a9).stroke({ width: Math.max(1, ol * 0.5), color: OUT });
		// the snow cap with its icicles (the icicles first: the cap covers their roots)
		const capH = G.cap;
		const x0 = Hs.x - f * 0.5;
		const x1 = Hs.x + Hs.w + f * 0.5;
		const baseY = Hs.y + f * 0.2;
		const nI = Math.round((x1 - x0) / (f * 1.25));
		for (let i = 0; i < nI; i++) {
			const x = x0 + f * 0.9 + ((x1 - x0 - f * 1.8) * (i + rnd(i) * 0.6)) / nI;
			const yT = baseY + capH * 0.1;
			const len = Math.min(face.y - 3 - yT, f * (0.55 + rnd(i + 40) * 0.6));
			const wI = f * (0.26 + rnd(i + 80) * 0.14);
			g.poly([x - wI / 2, yT - 2, x + wI / 2, yT - 2, x + wI * 0.08, yT + len]).fill(0xdff3ff).stroke({ width: Math.max(1.5, ol * 0.6), color: OUT, join: 'round' });
		}
		// the cap's outline; `lift` raises its scalloped underside (its lit top is the cap's own top with the underside
		// raised: the page's clip, without one)
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

	// ---- the frame ----
	/** DEV: driven by hand (the evidence's frame by frame captures): the ticker's updates are ignored, step() drives it */
	manual = false;

	/** DEV: `ms` of the sign's time by hand (manual mode) */
	step(ms: number, ready: boolean) {
		const m = this.manual;
		this.manual = false;
		this.update(ms, ready);
		this.manual = m;
	}

	/** `dtMs` real ms; `ready`: the press gate is open (the ticker's line shows) */
	update(dtMs: number, ready: boolean) {
		if (this.manual) return;
		if (this.mode === 'gone' || !this.face || !this.tick || !this.geo) return;
		const dt = Math.min(0.1, dtMs / 1000);
		this.ready = ready;
		if (this.mode === 'live') this.T = this.frozenAt ?? this.T + dt;
		let bright = this.T % 3.7 < 0.07 ? 0.9 : 1;
		let off = 0;
		if (this.mode === 'exit') {
			this.exitMs += dtMs;
			const ms = this.exitMs;
			const X = LED_SIGN.exit;
			if (ms < X.flickerMs) bright = [1, 0.2, 1, 0.3][Math.min(3, Math.floor(ms / (X.flickerMs / 4)))];
			off = span(ms, X.flickerMs, X.dotsOutMs);
			if (ms >= X.flickerMs) bright = 1 - 0.4 * off;
			const gfade = ease(span(ms, X.signFromMs, X.signToMs));
			this.sign.alpha = 1 - gfade;
			this.sign.y = gfade * this.geo.H * X.sinkShare;
			this.dim.alpha = LED_SIGN.dim.alpha * (1 - gfade);
			if (ms >= X.handOverMs && this.handOver) {
				const h = this.handOver;
				this.handOver = null;
				h();
			}
			if (ms >= X.signToMs) {
				this.mode = 'gone';
				this.root.visible = false;
				this.onGone?.();
				return;
			}
		}
		for (const F of [this.face, this.tick]) {
			F.content.alpha = bright;
			F.glow.alpha = LED_SIGN.halo * bright;
		}
		// the dots' content: re-drawn and re-sent at LED_SIGN.fps (an LED controller's refresh), not every frame
		const step = Math.floor(((this.T * 1000 + this.exitMs) * LED_SIGN.fps) / 1000);
		if (step === this.stepAt) return;
		this.stepAt = step;
		const t0 = performance.now();
		this.drawFace(this.face, this.T, off);
		this.drawTicker(this.tick, this.T, ready, off);
		this.cost.drawMs = Math.round((performance.now() - t0) * 100) / 100;
		this.cost.steps += 1;
		this.cost.uploadBytes = (this.face.dotsW * this.face.dotsH + this.face.halo.width * this.face.halo.height + this.tick.dotsW * this.tick.dotsH + this.tick.halo.width * this.tick.halo.height) * 4;
	}

	private drawFace(F: Face, T: number, off: number) {
		const W = F.dotsW;
		const H = F.dotsH;
		const X = LED_SIGN;
		const period = X.holdS + X.transS;
		const n = Math.floor(T / period);
		const tau = T - n * period;
		const i = n % 3;
		this.cost.lastScreen = i;
		const o = F.out.ctx;
		F.b.ctx.clearRect(0, 0, W, H);
		SCREENS[i](F.b.ctx, W, H, tau, this.text);
		if (tau < X.transS && n > 0) {
			F.a.ctx.clearRect(0, 0, W, H);
			SCREENS[(i + 2) % 3](F.a.ctx, W, H, period + tau, this.text);
			o.clearRect(0, 0, W, H);
			dissolve(o, F.a, F.b, F.noise, tau / X.transS, W, H);
		} else {
			o.clearRect(0, 0, W, H);
			o.drawImage(F.b, 0, 0);
		}
		shimmer(o, W, H, T);
		powerOff(o, W, H, F.noise, off);
		this.publish(F);
	}

	private drawTicker(F: Face, T: number, ready: boolean, off: number) {
		const o = F.out.ctx;
		o.clearRect(0, 0, F.dotsW, F.dotsH);
		if (ready) screenTicker(o, F.dotsW, F.dotsH, T, this.text.ticker);
		powerOff(o, F.dotsW, F.dotsH, F.noise, off);
		this.publish(F);
	}

	/** the dots to the GPU: the face's picture, and its half size halo */
	private publish(F: Face) {
		const h = F.halo.ctx;
		h.clearRect(0, 0, F.halo.width, F.halo.height);
		h.imageSmoothingEnabled = true;
		h.drawImage(F.out, 0, 0, F.halo.width, F.halo.height);
		F.tex.source.update();
		F.haloTex.source.update();
	}

	/** THE PRESS: the sign powers down. Resolves at the hand over (the game's chrome may come up); the sign goes on fading
	 *  and calls onGone when it has gone. */
	exit(): Promise<void> {
		if (this.mode !== 'live') return Promise.resolve();
		this.mode = 'exit';
		this.exitMs = 0;
		return new Promise<void>((resolve) => (this.handOver = resolve));
	}

	/** DEV / probes: the sign as drawn */
	snapshot() {
		const g = this.geo;
		const r = (v: number) => Math.round(v * 100) / 100;
		return {
			mode: this.mode,
			ready: this.ready,
			T: r(this.T),
			screen: this.cost.lastScreen,
			face: g ? { x: r(g.face.x), y: r(g.face.y), w: r(g.face.w), h: r(g.face.h), dotsW: g.face.dotsW, dotsH: g.face.dotsH } : null,
			ticker: g ? { x: r(g.ticker.x), y: r(g.ticker.y), w: r(g.ticker.w), h: r(g.ticker.h), dotsW: g.ticker.dotsW, dotsH: g.ticker.dotsH } : null,
			housing: g ? { x: r(g.housing.x), y: r(g.housing.y - g.cap), w: r(g.housing.w), h: r(g.housing.h + g.cap), bottom: r(g.housing.y + g.housing.h) } : null,
			/** the cap's drawn top per CSS px column from x0 (capTopProfile) */
			capTop: g ? (() => { const c = capTopProfile(g); return { x0: r(c.x0), ys: [...c.ys].map(r) }; })() : null,
			pitch: g ? r(g.pitch) : null,
			signAlpha: r(this.sign.alpha),
			dimAlpha: r(this.dim.alpha),
			cost: { ...this.cost },
			gpuBytes: this.face && this.tick ? (this.face.dotsW * this.face.dotsH + this.face.halo.width * this.face.halo.height + this.tick.dotsW * this.tick.dotsH + this.tick.halo.width * this.tick.halo.height) * 4 + Math.round(this.grilleTex.source.pixelWidth * this.grilleTex.source.pixelHeight * 4 * (4 / 3)) + 32 * 32 * 4 : 0,
		};
	}

	/** DEV: freeze the screens' time at `t` s (the probe's captures of each screen) */
	freeze(t: number | null) {
		this.frozenAt = t;
		if (t !== null) this.T = t;
		this.stepAt = -1;
	}

	destroy() {
		this.mode = 'gone';
		this.destroyFace(this.face);
		this.destroyFace(this.tick);
		this.face = null;
		this.tick = null;
		this.grilleTex.destroy(true);
		this.sheenTex.destroy(true);
		this.root.destroy({ children: true });
	}
}
