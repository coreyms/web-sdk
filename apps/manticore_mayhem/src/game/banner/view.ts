// THE WAR STANDARD BANNER's drawing (game/banner/spec.ts has the numbers; components/WarBanner.svelte the flow).
// Raw Pixi, built once, no filters, no masks, no shaders, nothing allocated per frame:
//
//   front (canvas px, on the stage over the board like the old plaque)
//     dim             one black sprite over the canvas (the scene light under the banner)
//     bannerFront     origin = the pole's centre, scale = canvas px per design px
//       roll          while it is over the rail (the swap below)
//       cloth         ONE MeshSimple on the tier's cloth texture: NC x NR vertices per frame from the bake
//       count, amount, line   the live text: glyph quads from the game's glyph atlas, their corners looked up in the
//                     cloth's own vertex grid every frame (bilinear), so they ride the folds and the unroll
//   back (master px, in the board frame's art container UNDER the frame plate: BoardFrame's bannerBackSlot)
//     bannerBack      the roll while it is behind the rail: z order, not a mask. It is swapped over the frame at the top
//                     of its arc (the first frame its centre is in front of the board's front plane, z > -25), when its
//                     lowest point is already over the rail's top edge, and back again on its way out.
//
// THE ROLL (not cloth): a core (the tier's dark cloth colour), a strip on the cloth texture whose rows scroll with the
// paid out length (the outer layer turning, as the chain haul scrolls its tile), and its shade and highlight (two
// canvas gradients made once). Its radius is the cloth still on it (the bake's per frame R).
//
// THE TIMELINE (60 fps sim frames, played on the banner's own clock in real ms, interpolated between frames):
//   entry 0 .. 300 ms (the roll over the rail), unroll + settle (the bake's `unroll`, 147 frames), then the hold
//   loop (180 frames, closed: bake_motion.py cross fades its end into its start); on hide the roll up (19 frames,
//   blended from the hold frame that was up), then the retreat (14 frames) and gone. cut(): straight to the hung
//   pose (skip, turbo).
import * as PIXI from 'pixi.js';

import { BANNER, type BannerClass, type BannerContent, type BannerTier } from './spec';
import type { BannerMotion } from './motion';
import { GlyphRun, type PlaqueFont } from '../stinger/text';

const FRAME_MS = 1000 / 60;
/** the hem's tongue tips (material px), left to right: the middle one (298, 653) is the lowest point at rest */
export const BANNER_TIPS: readonly (readonly [number, number])[] = [
	[26.67, 529.18], [94.85, 539.63], [157.72, 588.09], [226.46, 594.54], [298.0, 653.0], [369.54, 594.54], [438.28, 588.09], [501.15, 539.63], [569.33, 529.18],
];
const CORE_COLOR: Record<BannerTier, number> = { fs: 0x3a0a06, super: 0x0b0d2a, epic: 0x0d0c10 };

type Phase = 'hidden' | 'entry' | 'unroll' | 'hold' | 'rollup' | 'retreat';

/** one row of live text: glyph quads on one atlas source, corners in material px, drawn through the cloth grid */
class GlyphMesh {
	readonly mesh: PIXI.MeshSimple;
	readonly run: GlyphRun;
	/** material corners per glyph: u0, v0, u1, v1 */
	readonly box: Float32Array;
	count = 0;
	text = '';
	width = 0;
	constructor(
		private font: PlaqueFont,
		private frames: PIXI.Texture[],
		texture: PIXI.Texture,
		private capacity: number,
	) {
		this.run = new GlyphRun(capacity);
		this.box = new Float32Array(capacity * 4);
		const indices = new Uint32Array(capacity * 6);
		for (let g = 0; g < capacity; g += 1) indices.set([g * 4, g * 4 + 1, g * 4 + 2, g * 4, g * 4 + 2, g * 4 + 3], g * 6);
		this.mesh = new PIXI.MeshSimple({ texture, vertices: new Float32Array(capacity * 8), uvs: new Float32Array(capacity * 8), indices });
		this.mesh.autoUpdate = false;
		this.mesh.visible = false;
	}
	/** lay `text` out centred on material (cx, cy) at cap height `cap` (material px), fitted to maxWidth */
	set(text: string, cx: number, cy: number, cap: number, opts: { maxWidth: number; tabular?: boolean; reserve?: string; fit?: string }): void {
		this.text = text;
		const em = (cap * this.font.em) / this.font.cap;
		const run = this.font.layout(text, em, this.run, opts);
		this.count = run.count;
		this.width = run.width;
		const uvs = this.mesh.geometry.getBuffer('aUV').data as Float32Array;
		for (let g = 0; g < this.capacity; g += 1) {
			const o = g * 4;
			if (g >= run.count) {
				this.box[o] = this.box[o + 1] = this.box[o + 2] = this.box[o + 3] = 0;
				uvs.fill(0, g * 8, g * 8 + 8);
				continue;
			}
			this.box[o] = cx + run.x[g];
			this.box[o + 1] = cy + run.y[g];
			this.box[o + 2] = cx + run.x[g] + run.w[g];
			this.box[o + 3] = cy + run.y[g] + run.h[g];
			const t = this.frames[run.frame[g]];
			const src = t.source;
			const f = t.frame;
			const u0 = f.x / src.width;
			const v0 = f.y / src.height;
			const u1 = (f.x + f.width) / src.width;
			const v1 = (f.y + f.height) / src.height;
			uvs.set([u0, v0, u1, v0, u1, v1, u0, v1], g * 8);
		}
		this.mesh.geometry.getBuffer('aUV').update();
	}
}

export class BannerView {
	readonly front = new PIXI.Container({ label: 'war-banner' });
	readonly back = new PIXI.Container({ label: 'war-banner-back' });
	private dim = new PIXI.Sprite(PIXI.Texture.WHITE);
	private bannerFront = new PIXI.Container();
	private bannerBack = new PIXI.Container();
	private roll = new PIXI.Container();
	private rollCore = new PIXI.Sprite(PIXI.Texture.WHITE);
	private rollStrip: PIXI.MeshSimple;
	private rollShade = new PIXI.Sprite(PIXI.Texture.EMPTY);
	private rollHi = new PIXI.Sprite(PIXI.Texture.EMPTY);
	private cloth: PIXI.MeshSimple | null = null;
	private texts: { count: GlyphMesh; amount: GlyphMesh; line: GlyphMesh } | null = null;
	private m: BannerMotion | null = null;
	/** this frame's vertex positions (design px) and the hold frame the exit blends from */
	private cur = new Float32Array(0);
	private exitFrom = new Float32Array(0);
	private exitDelta = new Float32Array(0);
	private rowV = new Float32Array(0);
	private dv = 1;
	private du = 1;
	/** the roll's ends, design px: the hanging cloth's own top corners at rest (the 2.5 % gather pulls them in) */
	private rollX0 = -BANNER.width / 2;
	private rollX1 = BANNER.width / 2;

	phase: Phase = 'hidden';
	/** ms since show (the entry, the unroll, the hold) and since hide (the roll up, the retreat) */
	t = 0;
	exitT = 0;
	/** the clock's time at which the hold loop starts */
	holdAt = 0;
	/** this frame: the departure v, the roll's centre y and z and radius (design px), and whether it is over the rail */
	vdep = 0;
	rollCy = 0;
	rollCz = 0;
	rollR = 0;
	rollFront = false;
	cutAt = -1;
	/** the frame the clock is on: 'entry' / 'unroll' / 'loop' / 'rollup' / 'retreat' and its (fractional) index */
	seqName = '';
	seqIndex = 0;
	tier: BannerTier = 'fs';
	content: BannerContent = 'intro';
	cls: BannerClass = 'D';
	private dimAt = 0;
	private dimOutAt = -1;
	lineAlpha = 0;
	/** the canvas px per design px and the pole's centre on the canvas (the probe reads them) */
	frontScale = 1;
	frontX = 0;
	frontY = 0;

	constructor() {
		this.dim.tint = 0x000000;
		this.dim.alpha = 0;
		this.front.addChild(this.dim, this.bannerFront);
		this.back.addChild(this.bannerBack);
		const NS = BANNER.roll.strip;
		const idx = new Uint32Array((NS - 1) * 6);
		for (let r = 0; r < NS - 1; r += 1) idx.set([r * 2, r * 2 + 1, r * 2 + 2, r * 2 + 1, r * 2 + 3, r * 2 + 2], r * 6);
		this.rollStrip = new PIXI.MeshSimple({ texture: PIXI.Texture.EMPTY, vertices: new Float32Array(NS * 4), uvs: new Float32Array(NS * 4), indices: idx });
		this.rollStrip.autoUpdate = false;
		this.rollHi.blendMode = 'add';
		this.roll.addChild(this.rollCore, this.rollStrip, this.rollShade, this.rollHi);
		this.front.visible = false;
		this.back.visible = false;
	}

	/** the roll's two gradients (canvas, made once; never a blob: URL) */
	private gradients(): void {
		if (this.rollShade.texture !== PIXI.Texture.EMPTY) return;
		const R = BANNER.roll;
		const make = (stops: [number, string][]) => {
			const c = document.createElement('canvas');
			c.width = 1;
			c.height = 64;
			const ctx = c.getContext('2d')!;
			const g = ctx.createLinearGradient(0, 0, 0, 64);
			for (const [at, col] of stops) g.addColorStop(at, col);
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, 1, 64);
			return PIXI.Texture.from(c);
		};
		this.rollShade.texture = make([
			[0, `rgba(0,0,0,${R.shadeTop})`],
			[0.3, 'rgba(0,0,0,0.05)'],
			[0.55, 'rgba(0,0,0,0.08)'],
			[1, `rgba(0,0,0,${R.shadeBottom})`],
		]);
		this.rollHi.texture = make([
			[0, 'rgba(255,240,220,0)'],
			[R.highlightAt, `rgba(255,240,220,${R.highlight})`],
			[R.highlightAt + 0.16, 'rgba(255,240,220,0)'],
			[1, 'rgba(255,240,220,0)'],
		]);
	}

	/** the motion, the glyph atlas and its font (once) */
	build(m: BannerMotion, font: PlaqueFont, atlas: Record<string, PIXI.Texture>): void {
		if (this.m) return;
		this.m = m;
		const J = m.json;
		const NC = J.cols;
		const NR = J.rows;
		this.cur = new Float32Array(m.nv * 2);
		this.exitFrom = new Float32Array(m.nv * 2);
		this.exitDelta = new Float32Array(m.nv * 2);
		this.rowV = Float32Array.from(J.v);
		this.dv = (J.v[NR - 1] - J.v[0]) / (NR - 1);
		this.du = J.width / (NC - 1);
		const r0 = J.seq.loop.start * m.nv * 2;
		this.rollX0 = m.pos[r0] / J.quant;
		this.rollX1 = m.pos[r0 + (NC - 1) * 2] / J.quant;
		const indices = new Uint32Array((NR - 1) * (NC - 1) * 6);
		let k = 0;
		for (let j = 0; j < NR - 1; j += 1) {
			for (let i = 0; i < NC - 1; i += 1) {
				const a = j * NC + i;
				indices.set([a, a + 1, a + NC, a + 1, a + NC + 1, a + NC], k);
				k += 6;
			}
		}
		const uvs = new Float32Array(m.nv * 2);
		for (let j = 0; j < NR; j += 1) for (let i = 0; i < NC; i += 1) uvs[(j * NC + i) * 2] = J.u[i] / J.width;
		this.cloth = new PIXI.MeshSimple({ texture: PIXI.Texture.EMPTY, vertices: new Float32Array(m.nv * 2), uvs, indices });
		this.cloth.autoUpdate = false;
		this.cloth.visible = false;
		// the glyph atlas: one source; a full-source texture for the meshes, the frames for their uvs
		const frames = font.frames.map((f) => atlas[f] ?? PIXI.Texture.EMPTY);
		const source = frames.find((t) => t !== PIXI.Texture.EMPTY)?.source;
		const tex = source ? new PIXI.Texture({ source }) : PIXI.Texture.EMPTY;
		this.texts = { count: new GlyphMesh(font, frames, tex, 6), amount: new GlyphMesh(font, frames, tex, 32), line: new GlyphMesh(font, frames, tex, 40) };
		// (the roll joins one of the two on the first frame drawn: render() puts it where its depth says)
		this.bannerFront.addChild(this.cloth, this.texts.count.mesh, this.texts.amount.mesh, this.texts.line.mesh);
		this.gradients();
	}

	get built(): boolean {
		return !!this.m;
	}

	/** where the pole's centre is (canvas px, and master px for the back slot) and the scales (per design px) */
	place(frontX: number, frontY: number, frontScale: number, canvasW: number, canvasH: number, backX: number, backY: number, backScale: number): void {
		this.frontX = frontX;
		this.frontY = frontY;
		this.frontScale = frontScale;
		this.bannerFront.position.set(frontX, frontY);
		this.bannerFront.scale.set(frontScale);
		this.bannerBack.position.set(backX, backY);
		this.bannerBack.scale.set(backScale);
		this.dim.setSize(canvasW, canvasH);
	}

	/** the slot under the frame plate (BoardFrame's bannerBackSlot), or null while it is not there */
	attachBack(slot: PIXI.Container | null): void {
		if (slot && this.back.parent !== slot) slot.addChild(this.back);
	}

	/** a new screen with its cloth texture (already loaded and on the GPU) */
	show(o: { tier: BannerTier; content: BannerContent; cls: BannerClass; texture: PIXI.Texture; glyphTint: number }): void {
		if (!this.m || !this.cloth || !this.texts) return;
		this.tier = o.tier;
		this.content = o.content;
		this.cls = o.cls;
		this.cloth.texture = o.texture;
		this.rollStrip.texture = o.texture;
		this.rollCore.tint = CORE_COLOR[o.tier];
		for (const g of Object.values(this.texts)) {
			g.mesh.tint = o.glyphTint;
			g.mesh.visible = false;
			g.count = 0;
		}
		this.lineAlpha = 0;
		this.texts.line.mesh.alpha = 0;
		this.t = 0;
		this.exitT = 0;
		this.cutAt = -1;
		this.holdAt = BANNER.timing.entryMs + this.m.json.seq.unroll.count * FRAME_MS;
		this.dimAt = Infinity;
		this.dimOutAt = -1;
		this.phase = 'entry';
		this.front.visible = true;
		this.back.visible = true;
		this.render();
	}

	/** straight to the hung pose (a skip during the entry, any turbo): the scene light already in */
	cut(): void {
		if (this.phase === 'hidden' || this.phase === 'rollup' || this.phase === 'retreat') return;
		if (this.t >= this.holdAt) return;
		this.cutAt = this.t;
		this.t = this.holdAt;
		this.dimAt = -BANNER.dimInMs;
		this.phase = 'hold';
		this.render();
	}

	/** the exit: the roll up (from the hold frame that is up), the retreat. `instant`: gone now (turbo) */
	hide(instant = false): void {
		if (this.phase === 'hidden' || this.phase === 'rollup' || this.phase === 'retreat') return;
		if (instant) {
			this.gone();
			return;
		}
		this.exitFrom.set(this.cur);
		this.phase = 'rollup';
		this.exitT = 0;
		// the roll up's first frame is the sim's own hold frame 368: the difference to the frame that is up fades out
		const m = this.m!;
		const r = m.json.seq.rollup.start * m.nv * 2;
		const q = 1 / m.json.quant;
		for (let i = 0; i < m.nv * 2; i += 1) this.exitDelta[i] = this.exitFrom[i] - m.pos[r + i] * q;
	}

	private gone(): void {
		this.phase = 'hidden';
		this.front.visible = false;
		this.back.visible = false;
		this.dim.alpha = 0;
		if (this.cloth) {
			this.cloth.visible = false;
			this.cloth.texture = PIXI.Texture.EMPTY;
		}
		this.rollStrip.texture = PIXI.Texture.EMPTY;
	}

	/** the roll up has ended (the hide's promise resolves here; the retreat and the light fade go on) */
	get rolledUp(): boolean {
		return this.phase === 'retreat' || this.phase === 'hidden';
	}

	/** advance the clock by dtMs (real ms) and draw. Returns false once hidden. */
	tick(dtMs: number): boolean {
		if (this.phase === 'hidden') return false;
		const dt = Math.min(dtMs, 100);
		if (this.phase === 'rollup' || this.phase === 'retreat') this.exitT += dt;
		else this.t += dt;
		this.render();
		// (render() may have ended it)
		return (this.phase as Phase) !== 'hidden';
	}

	setText(which: 'count' | 'amount' | 'line', text: string, opts: { tabular?: boolean; reserve?: string; fit?: string } = {}): void {
		if (!this.texts) return;
		const L = BANNER.live[this.cls][which];
		const g = this.texts[which];
		g.set(text, BANNER.width / 2, L.cy, L.cap, { maxWidth: L.maxWidth, ...opts });
		g.mesh.visible = g.count > 0;
		this.mapGlyphs(g);
	}

	setLineAlpha(a: number): void {
		this.lineAlpha = a;
		if (this.texts) this.texts.line.mesh.alpha = a;
	}

	/** the live text's drawn width, material px (the fit check) */
	textWidth(which: 'count' | 'amount' | 'line'): number {
		return this.texts?.[which].width ?? 0;
	}

	// ---- the frame ------------------------------------------------------------------------------------------
	private readFrame(global: number, frac: number, global2: number): void {
		const m = this.m!;
		const q = 1 / m.json.quant;
		const a = global * m.nv * 2;
		const b = global2 * m.nv * 2;
		const P = m.pos;
		const c = this.cur;
		for (let i = 0; i < m.nv * 2; i += 1) c[i] = (P[a + i] + (P[b + i] - P[a + i]) * frac) * q;
	}

	private render(): void {
		const m = this.m!;
		const J = m.json;
		const T = BANNER.timing;
		let clothOn = false;
		let path: { cy: number[]; cz: number[]; R: number[] } | null = null;
		let pathF = 0;
		if (this.phase === 'entry' || this.phase === 'unroll' || this.phase === 'hold') {
			const t = this.t;
			if (t < T.entryMs) {
				this.phase = 'entry';
				path = J.entry;
				pathF = (t / T.entryMs) * (J.entry.cy.length - 1);
				this.seqName = 'entry';
				this.seqIndex = pathF;
			} else if (t < this.holdAt) {
				this.phase = 'unroll';
				const s = J.seq.unroll;
				const f = Math.min(s.count - 1, (t - T.entryMs) / FRAME_MS);
				const f0 = Math.floor(f);
				// the unroll's last frame runs into the loop's first
				const next = f0 + 1 < s.count ? s.start + f0 + 1 : J.seq.loop.start;
				this.readFrame(s.start + f0, f - f0, next);
				this.lerpRoll(s, f0, f - f0);
				clothOn = true;
				this.seqName = 'unroll';
				this.seqIndex = f;
			} else {
				this.phase = 'hold';
				const s = J.seq.loop;
				const f = ((t - this.holdAt) / FRAME_MS) % s.count;
				const f0 = Math.floor(f);
				const f1 = (f0 + 1) % s.count;
				this.readFrame(s.start + f0, f - f0, s.start + f1);
				this.lerpRoll(s, f0, f - f0);
				clothOn = true;
				this.seqName = 'loop';
				this.seqIndex = f;
			}
		} else if (this.phase === 'rollup' || this.phase === 'retreat') {
			const s = J.seq.rollup;
			const f = this.exitT / FRAME_MS;
			if (f < s.count - 1) {
				this.phase = 'rollup';
				const f0 = Math.floor(f);
				this.readFrame(s.start + f0, f - f0, s.start + Math.min(s.count - 1, f0 + 1));
				// the hold frame that was up, its difference fading over the first 8 frames (vertices still hanging)
				const k = Math.max(0, 1 - f / 8);
				if (k > 0) for (let i = 0; i < this.cur.length; i += 1) this.cur[i] += this.exitDelta[i] * k;
				this.lerpRoll(s, f0, f - f0);
				clothOn = true;
				this.seqName = 'rollup';
				this.seqIndex = f;
			} else {
				const rf = f - (s.count - 1);
				if (rf >= J.retreat.cy.length - 1) {
					// gone, once the light has faded too
					const out = this.exitT - (s.count - 1) * FRAME_MS;
					if (out >= BANNER.dimOutMs) {
						this.gone();
						return;
					}
				}
				this.phase = 'retreat';
				path = J.retreat;
				pathF = Math.min(J.retreat.cy.length - 1, rf);
				this.seqName = 'retreat';
				this.seqIndex = pathF;
			}
		}
		if (path) {
			const p0 = Math.floor(pathF);
			const p1 = Math.min(path.cy.length - 1, p0 + 1);
			const w = pathF - p0;
			this.rollCy = path.cy[p0] + (path.cy[p1] - path.cy[p0]) * w;
			this.rollCz = path.cz[p0] + (path.cz[p1] - path.cz[p0]) * w;
			this.rollR = path.R[p0] + (path.R[p1] - path.R[p0]) * w;
			this.vdep = J.length + 5;
		}
		// over the rail (the board's front plane is z -25) or behind it
		const front = this.rollCz > -25;
		this.rollFront = front;
		const slot = front ? this.bannerFront : this.bannerBack;
		if (this.roll.parent !== slot) slot.addChildAt(this.roll, 0);
		// the light: in from the swap over the rail (or at once after a cut), out from the end of the roll up
		if (this.dimAt === Infinity && front) this.dimAt = this.t;
		let dim = this.dimAt === Infinity ? 0 : Math.min(1, (this.t - this.dimAt) / BANNER.dimInMs);
		if (this.phase === 'retreat') {
			const out = this.exitT - (J.seq.rollup.count - 1) * FRAME_MS;
			dim *= Math.max(0, 1 - out / BANNER.dimOutMs);
		}
		this.dim.alpha = BANNER.dim * dim;
		this.drawRoll();
		if (this.cloth) {
			this.cloth.visible = clothOn;
			if (clothOn) this.drawCloth();
		}
		if (this.texts) for (const g of Object.values(this.texts)) if (g.mesh.visible && clothOn) this.mapGlyphs(g);
		if (this.texts) for (const g of Object.values(this.texts)) g.mesh.renderable = clothOn;
	}

	private lerpRoll(s: { vdep: number[]; cy: number[]; R: number[] }, f0: number, w: number): void {
		const f1 = Math.min(s.vdep.length - 1, f0 + 1);
		this.vdep = s.vdep[f0] + (s.vdep[f1] - s.vdep[f0]) * w;
		this.rollCy = s.cy[f0] + (s.cy[f1] - s.cy[f0]) * w;
		this.rollR = s.R[f0] + (s.R[f1] - s.R[f0]) * w;
		this.rollCz = 0;
	}

	private drawCloth(): void {
		const m = this.m!;
		const J = m.json;
		const mesh = this.cloth!;
		const verts = mesh.geometry.getBuffer('aPosition').data as Float32Array;
		verts.set(this.cur);
		mesh.geometry.getBuffer('aPosition').update();
		// rows still on the roll sit on the departure line: their uv v is the departure's (the texture is not squeezed)
		const uv = mesh.geometry.getBuffer('aUV').data as Float32Array;
		const span = J.texV1 - J.texV0;
		const NC = J.cols;
		for (let j = 0; j < J.rows; j += 1) {
			const v = Math.max(this.rowV[j], this.vdep);
			const tv = Math.min(1, Math.max(0, (v - J.texV0) / span));
			for (let i = 0; i < NC; i += 1) uv[(j * NC + i) * 2 + 1] = tv;
		}
		mesh.geometry.getBuffer('aUV').update();
	}

	private drawRoll(): void {
		const W = this.rollX1 - this.rollX0;
		const R = Math.max(0.5, this.rollR);
		const cy = this.rollCy;
		const x0 = this.rollX0;
		this.rollCore.position.set(x0, cy - R);
		this.rollCore.setSize(W, 2 * R);
		this.rollShade.position.set(x0, cy - R);
		this.rollShade.setSize(W, 2 * R);
		this.rollHi.position.set(x0, cy - R);
		this.rollHi.setSize(W, 2 * R);
		// the outer layer from the top of the roll (theta +90 deg) to its bottom (-90): material v = v_dep - R theta
		const NS = BANNER.roll.strip;
		const vs = this.rollStrip.geometry.getBuffer('aPosition').data as Float32Array;
		const uv = this.rollStrip.geometry.getBuffer('aUV').data as Float32Array;
		const J = this.m!.json;
		const span = J.texV1 - J.texV0;
		for (let k = 0; k < NS; k += 1) {
			const th = Math.PI / 2 - (Math.PI * k) / (NS - 1);
			const y = cy - R * Math.sin(th);
			const v = this.vdep - R * th;
			const tv = Math.min(1, Math.max(0, (v - J.texV0) / span));
			vs.set([x0, y, x0 + W, y], k * 4);
			uv.set([0, tv, 1, tv], k * 4);
		}
		this.rollStrip.geometry.getBuffer('aPosition').update();
		this.rollStrip.geometry.getBuffer('aUV').update();
	}

	/** material (u, v) -> design px on this frame's cloth (rows on the roll sit on the departure line) */
	mapMaterial(u: number, v: number, out: { x: number; y: number }): void {
		const m = this.m!;
		const J = m.json;
		const NC = J.cols;
		const NR = J.rows;
		const c = this.cur;
		const fi = Math.min(NC - 1 - 1e-6, Math.max(0, u / this.du));
		const i0 = Math.floor(fi);
		const a = fi - i0;
		const v0 = this.rowV[0];
		let j0: number;
		let b: number;
		if (v <= this.vdep) {
			j0 = Math.min(NR - 2, Math.max(0, Math.floor((this.vdep - v0) / this.dv)));
			b = 0;
			// a collapsed row (it is on the departure line) or, when the departure is between rows, the row above it
			if (this.rowV[j0] > this.vdep) b = 0;
		} else {
			j0 = Math.min(NR - 2, Math.max(0, Math.floor((v - v0) / this.dv)));
			const lo = Math.max(this.rowV[j0], this.vdep);
			const hi = this.rowV[j0 + 1];
			b = hi > lo ? Math.min(1, Math.max(0, (v - lo) / (hi - lo))) : 0;
		}
		const p00 = (j0 * NC + i0) * 2;
		const p10 = p00 + 2;
		const p01 = p00 + NC * 2;
		const p11 = p01 + 2;
		out.x = (c[p00] * (1 - a) + c[p10] * a) * (1 - b) + (c[p01] * (1 - a) + c[p11] * a) * b;
		out.y = (c[p00 + 1] * (1 - a) + c[p10 + 1] * a) * (1 - b) + (c[p01 + 1] * (1 - a) + c[p11 + 1] * a) * b;
	}

	private pt = { x: 0, y: 0 };
	private mapGlyphs(g: GlyphMesh): void {
		if (!this.m) return;
		const verts = g.mesh.geometry.getBuffer('aPosition').data as Float32Array;
		const p = this.pt;
		for (let k = 0; k < g.count; k += 1) {
			const o = k * 4;
			const u0 = g.box[o];
			const v0 = g.box[o + 1];
			const u1 = g.box[o + 2];
			const v1 = g.box[o + 3];
			this.mapMaterial(u0, v0, p);
			verts[k * 8] = p.x;
			verts[k * 8 + 1] = p.y;
			this.mapMaterial(u1, v0, p);
			verts[k * 8 + 2] = p.x;
			verts[k * 8 + 3] = p.y;
			this.mapMaterial(u1, v1, p);
			verts[k * 8 + 4] = p.x;
			verts[k * 8 + 5] = p.y;
			this.mapMaterial(u0, v1, p);
			verts[k * 8 + 6] = p.x;
			verts[k * 8 + 7] = p.y;
		}
		for (let k = g.count * 8; k < verts.length; k += 1) verts[k] = 0;
		g.mesh.geometry.getBuffer('aPosition').update();
	}

	/** DEV: a per frame read (tools/manticore/banner_probe.js): design px and canvas px of the hem, the roll, the text */
	state(): Record<string, unknown> {
		const ok = !!this.m && this.phase !== 'hidden';
		const p = { x: 0, y: 0 };
		const toCanvas = (x: number, y: number) => ({ x: this.frontX + x * this.frontScale, y: this.frontY + y * this.frontScale });
		let hem: { x: number; y: number } | null = null;
		let tips: { x: number; y: number }[] = [];
		let lowest = -Infinity;
		let clothBox: { x0: number; x1: number; y0: number; y1: number } | null = null;
		const clothOn = ok && !!this.cloth?.visible;
		if (clothOn) {
			this.mapMaterial(298, 653, p);
			hem = { x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) };
			tips = BANNER_TIPS.map(([u, v]) => {
				this.mapMaterial(u, v, p);
				lowest = Math.max(lowest, p.y);
				return { x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)) };
			});
			let x0 = Infinity;
			let x1 = -Infinity;
			let y0 = Infinity;
			let y1 = -Infinity;
			for (let i = 0; i < this.cur.length; i += 2) {
				x0 = Math.min(x0, this.cur[i]);
				x1 = Math.max(x1, this.cur[i]);
				y0 = Math.min(y0, this.cur[i + 1]);
				y1 = Math.max(y1, this.cur[i + 1]);
			}
			clothBox = { x0, x1, y0, y1 };
		}
		const amountBox = (() => {
			const g = this.texts?.amount;
			if (!g || !g.count || !clothOn) return null;
			let x0 = Infinity;
			let x1 = -Infinity;
			const v = g.mesh.geometry.getBuffer('aPosition').data as Float32Array;
			for (let k = 0; k < g.count * 4; k += 1) {
				x0 = Math.min(x0, v[k * 2]);
				x1 = Math.max(x1, v[k * 2]);
			}
			// the row's own box (its advances, what the layout centres) and the cloth's centre line, both at the row's cap
			// centre through this frame's cloth, canvas px
			const cy = BANNER.live[this.cls].amount.cy;
			const q = { x: 0, y: 0 };
			this.mapMaterial(BANNER.width / 2 - g.width / 2, cy, q);
			const bl = q.x;
			this.mapMaterial(BANNER.width / 2 + g.width / 2, cy, q);
			const br = q.x;
			this.mapMaterial(BANNER.width / 2, cy, q);
			const cc = q.x;
			// the cloth's own edges at that row (their midpoint: the middle of the cloth as it hangs now)
			this.mapMaterial(0, cy, q);
			const el = q.x;
			this.mapMaterial(BANNER.width, cy, q);
			const er = q.x;
			const k = this.frontScale;
			return { x0, x1, materialWidth: g.width, text: g.text, boxCenterCanvas: this.frontX + ((bl + br) / 2) * k, clothCenterCanvas: this.frontX + cc * k, clothMidCanvas: this.frontX + ((el + er) / 2) * k, inkCenterCanvas: this.frontX + ((x0 + x1) / 2) * k };
		})();
		const c = (q: { x: number; y: number } | null) => (q ? toCanvas(q.x, q.y) : null);
		return {
			phase: this.phase,
			t: Number(this.t.toFixed(2)),
			exitT: Number(this.exitT.toFixed(2)),
			seq: this.seqName,
			index: Number(this.seqIndex.toFixed(3)),
			tier: this.tier,
			content: this.content,
			cls: this.cls,
			cutAt: this.cutAt,
			vdep: Number(this.vdep.toFixed(3)),
			roll: { cy: Number(this.rollCy.toFixed(3)), cz: Number(this.rollCz.toFixed(3)), R: Number(this.rollR.toFixed(3)), front: this.rollFront, parent: this.roll.parent === this.bannerFront ? 'front' : this.roll.parent === this.bannerBack ? 'back' : null },
			cloth: clothOn,
			hem,
			hemCanvas: c(hem),
			lowestDesign: clothOn ? Number(lowest.toFixed(3)) : null,
			lowestCanvas: clothOn ? Number((this.frontY + lowest * this.frontScale).toFixed(2)) : null,
			tips,
			clothBox,
			clothBoxCanvas: clothBox ? { x0: this.frontX + clothBox.x0 * this.frontScale, x1: this.frontX + clothBox.x1 * this.frontScale, y0: this.frontY + clothBox.y0 * this.frontScale, y1: this.frontY + clothBox.y1 * this.frontScale } : null,
			amount: amountBox,
			count: this.texts?.count.text ?? '',
			line: this.texts?.line.text ?? '',
			lineAlpha: this.lineAlpha,
			dim: Number(this.dim.alpha.toFixed(4)),
			place: { x: this.frontX, y: this.frontY, scale: this.frontScale },
		};
	}
}
