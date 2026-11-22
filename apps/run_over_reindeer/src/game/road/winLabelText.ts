// THE LINE AMOUNTS DRAWN AHEAD (2026-11-22, wip/winlights; constants LINE_WIN.slam.ahead; Corey: "Yes" to the fix).
//
// The cause it removes: each winning line's slam label was four PIXI.Text (its plain amount and its win, each with a wide
// dark shadow copy). A Text is drawn on a canvas and sent to the GPU on the first frame it shows with new words, so every
// line's amount cost two canvas text draws and two texture uploads ON the frame it popped in (four on a multiplier line,
// two at the pop and two at the punch), and a one line win's punch landed on the same frame as the strip's small win.
// On the upright phone each picture is large: the amount is set at 52 road px times the phone's label scale (about 1.85,
// so about 96 road px, the shadow's stroke about 48) at the renderer's 3 px per unit, so one label is a canvas about
// 1100 x 500 px, kept in a power of two canvas and texture (2048 x 512, 4 MB each) by Pixi's text system. Measured by
// Decimus on 2026-11-22 (390 x 844 at device scale 3): the worst frames of ordinary winning spins, 67 ms at 4x CPU slowdown
// and 100 to 117 ms at 6x, all with the small LED win and the win lights up.
//
// What this does instead: an AheadText is a Sprite showing a canvas of its own, drawn by Pixi's OWN text painter
// (CanvasTextSystem.renderTextToCanvas, the very code every PIXI.Text is drawn with, the same style object, the same
// resolution, the same canvas size before Pixi rounds it up to a power of two), so its pixels are the Text's pixels and its
// quad is the Text's quad (the same frame, the same anchor), and its bounds are the Text's (the measured size). The draw
// and the upload are separate pieces of work, and the lights do them in the frames BEFORE the label shows (the line's wire
// draws in for 500 ms at turbo 0, 175 ms at turbo 2), a budget a frame (LINE_WIN.slam.ahead.budgetMs, at least one piece a
// frame); a label that is due and not ready is made on its own frame, as the Text was (so the timing never moves). Each
// canvas is kept and reused (it only grows), so no texture is made or let go per win, and nothing goes through Pixi's
// power of two pools. No filter, shader, mask or blob: URL; the render resolution is not touched.
import * as PIXI from 'pixi.js';

import { LINE_WIN } from '../constants';
import { perfMark } from '../staging';

/** the renderer, given by components/Board.svelte: its resolution (what every PIXI.Text is drawn at) and the call that puts a
 *  texture source on the GPU now (GlTextureSystem.initSource: a no op for one already there) */
export type AheadHost = { resolution: () => number; upload: (source: PIXI.TextureSource) => void };
let host: AheadHost | null = null;
export const setAheadTextHost = (h: AheadHost | null) => {
	host = h;
};
/** the resolution a PIXI.Text would be drawn at now (the renderer's; 1 before there is one) */
export const aheadResolution = () => {
	const r = host?.resolution();
	return r && Number.isFinite(r) && r > 0 ? r : 1;
};

/** Pixi's own canvas text painter (the one every PIXI.Text is drawn with). renderTextToCanvas reads nothing of its instance but
 *  its own _drawLetterSpacing, so a bare instance of the class serves */
let painter: PIXI.CanvasTextSystem | null = null;
const paint = () => (painter ??= Object.create(PIXI.CanvasTextSystem.prototype) as PIXI.CanvasTextSystem);

/** THE TEXT'S CANVAS SIZE (CanvasTextSystem.createTextureAndCanvas, before getPo2TextureFromSource rounds it up): device px */
export function textPixelSize(text: string, style: PIXI.TextStyle, resolution: number) {
	const m = PIXI.CanvasTextMetrics.measureText(text || ' ', style);
	const w = Math.ceil(Math.ceil(Math.max(1, m.width) + style.padding * 2) * resolution);
	const h = Math.ceil(Math.ceil(Math.max(1, m.height) + style.padding * 2) * resolution);
	return { w, h };
}

/** the canvas width is rounded up to this many px when it has to grow, so a few more digits never make it again */
const GROW_PX = 64;
let made = 0;
/** DEV / probes: the AheadText canvases made since the page loaded (they are made once per label and kept) */
export const aheadCanvasesMade = () => made;

/** one piece of work an AheadText still needs: drawn (its canvas holds its words) and sent (the GPU has that canvas) */
export type AheadPiece = 'draw' | 'send' | null;

export class AheadText extends PIXI.Sprite {
	private style: PIXI.TextStyle;
	/** a new style object each time it is set (its own key: the style's words, size and edge) */
	private styleGen = 0;
	private words = '';
	/** the size a PIXI.Text of these words reports (CanvasTextMetrics: its bounds), at scale 1 */
	private mw = 0;
	private mh = 0;
	/** what the canvas holds now and what the GPU holds now: words, style and resolution ('' none) */
	private drawnKey = '';
	private sentKey = '';
	private cv: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private src: PIXI.CanvasSource | null = null;
	/** the canvas px drawn last (cleared before the next draw) */
	private usedW = 0;
	private usedH = 0;
	/** the label for the staging readout's marks */
	tag = 'amount';

	constructor(style: PIXI.TextStyleOptions) {
		super(PIXI.Texture.EMPTY);
		this.style = new PIXI.TextStyle(style);
		this.measure();
	}

	get text(): string {
		return this.words;
	}
	set text(v: string) {
		if (v === this.words) return;
		this.words = v;
		this.measure();
	}
	/** the style's font size (the labels read it to tell a phone size from another) */
	get fontSize(): number {
		return this.style.fontSize;
	}
	setStyle(o: PIXI.TextStyleOptions) {
		this.style = new PIXI.TextStyle(o);
		this.styleGen += 1;
		this.measure();
	}
	/** the width and height a PIXI.Text of the same words and style reports at this scale (its .width and .height) */
	textWidth(): number {
		return Math.abs(this.scale.x) * this.mw;
	}
	textHeight(): number {
		return Math.abs(this.scale.y) * this.mh;
	}

	private measure() {
		// (PIXI.Text's own bounds: CanvasTextMetrics.measureText of its words, Text._updateBounds)
		const m = PIXI.CanvasTextMetrics.measureText(this.words, this.style);
		this.mw = m.width;
		this.mh = m.height;
		this.onViewUpdate();
	}

	/** the bounds a PIXI.Text reports (the measured size about its anchor), not the texture's: getBounds, the probes' boxes */
	protected override updateBounds() {
		const a = this._anchor;
		const b = this._bounds;
		b.minX = -a._x * this.mw;
		b.maxX = b.minX + this.mw;
		b.minY = -a._y * this.mh;
		b.maxY = b.minY + this.mh;
	}

	private keyAt(res: number) {
		return `${this.words}\u0000${this.styleGen}\u0000${res}`;
	}
	/** drawn and sent at this resolution */
	ready(res = aheadResolution()): boolean {
		return this.sentKey === this.keyAt(res) && this.drawnKey === this.sentKey;
	}
	/** the next piece of work it needs at this resolution (null: ready) */
	need(res = aheadResolution()): AheadPiece {
		const k = this.keyAt(res);
		if (this.drawnKey !== k) return 'draw';
		if (this.sentKey !== k) return 'send';
		return null;
	}
	/** one piece of work (the draw, or the upload of what is drawn); returns which, or null when it was ready */
	step(res = aheadResolution()): AheadPiece {
		const p = this.need(res);
		if (p === 'draw') this.draw(res);
		else if (p === 'send') this.send();
		return p;
	}
	/** everything it needs now (a label due on this frame): drawn and sent */
	ensure(res = aheadResolution()) {
		if (this.need(res) === 'draw') this.draw(res);
		if (this.need(res) === 'send') this.send();
	}

	/** THE DRAW: Pixi's own text painter on this label's canvas at the Text's size (the canvas grows, never shrinks) */
	private draw(res: number) {
		const style = this.style;
		const text = this.words || ' ';
		const { w, h } = textPixelSize(text, style, res);
		let fresh = false;
		if (!this.cv || !this.ctx || !this.src || this.cv.width < w || this.cv.height < h || this.src.resolution !== res) {
			const cw = Math.max(this.cv?.width ?? 0, Math.ceil(w / GROW_PX) * GROW_PX);
			const ch = Math.max(this.cv?.height ?? 0, h);
			const old = this.src;
			const cv = PIXI.DOMAdapter.get().createCanvas(cw, ch) as HTMLCanvasElement;
			made += 1;
			this.cv = cv;
			this.ctx = cv.getContext('2d') as CanvasRenderingContext2D;
			// (the Text's texture settings: premultiplied as it uploads, the default sampler, no mipmaps)
			this.src = new PIXI.CanvasSource({ resource: cv as unknown as PIXI.ICanvas, resolution: res, alphaMode: 'premultiply-alpha-on-upload' });
			this.usedW = 0;
			this.usedH = 0;
			fresh = true;
			// (a label's canvas is made again only when it must grow or the resolution changed: the old one goes)
			if (old) old.destroy();
		}
		const ctx = this.ctx!;
		ctx.resetTransform();
		if (!fresh && this.usedW > 0) ctx.clearRect(0, 0, this.usedW, this.usedH);
		paint().renderTextToCanvas(text, style, res, { canvas: this.cv!, context: ctx } as unknown as Parameters<PIXI.CanvasTextSystem['renderTextToCanvas']>[3]);
		this.usedW = w;
		this.usedH = h;
		// the Text's quad: the canvas size over the resolution (getPo2TextureFromSource's frame), about the same anchor
		const old = this.texture;
		this.texture = new PIXI.Texture({ source: this.src!, frame: new PIXI.Rectangle(0, 0, w / res, h / res) });
		if (old && old !== PIXI.Texture.EMPTY) old.destroy(false);
		this.drawnKey = this.keyAt(res);
		this.sentKey = '';
		perfMark(`winText:draw:${this.tag}`);
	}

	/** THE UPLOAD: what is drawn goes to the GPU now (a source already there uploads on its update; a new one on initSource) */
	private send() {
		const src = this.src;
		if (!src) return;
		src.update();
		host?.upload(src);
		this.sentKey = this.drawnKey;
		perfMark(`winText:send:${this.tag}`);
	}

	/** DEV / checks: its canvas, its context and the px drawn last (compareWithText, tools/win_text_check.mjs) */
	canvasForCheck() {
		return this.cv && this.ctx ? { canvas: this.cv, ctx: this.ctx, w: this.usedW, h: this.usedH } : null;
	}

	/** DEV / probes: its words, its canvas and texture px and whether it is drawn and sent */
	info() {
		return { text: this.words, canvas: this.cv ? [this.cv.width, this.cv.height] : null, px: [this.usedW, this.usedH], ready: this.ready() };
	}
}

/** THE SLAM LABEL'S TEXT STYLE (treatment B): Overpass Heavy at `size` road px, its fill, its round edge `width` wide */
export const slamTextStyle = (size: number, fill: number, stroke: number, width: number) => ({ fontFamily: 'Overpass, sans-serif', fontWeight: '900' as const, fontSize: size, fill, stroke: { color: stroke, width, join: 'round' as const }, align: 'center' as const });
/** the slam label's two styles at label scale `scale` (1, or the upright phone's): the amount (white, the dark edge) and its
 *  shadow (black, the edge plus shadow.extra), as labelOf sets them (the probes' and the node check's pictures) */
export const slamLabelStyles = (scale: number) => {
	const A = LINE_WIN.lights.amount;
	const X = LINE_WIN.slam;
	const size = A.size * scale;
	const edge = A.strokeWidth * scale;
	return { face: slamTextStyle(size, X.amountFill, A.stroke, edge), shadow: slamTextStyle(size, 0x000000, 0x000000, edge + X.shadow.extra * scale) };
};

/** WHEN EACH LINE'S LABEL PICTURES ARE FIRST SHOWN (winLights.ts drawSlam), ms into the win: a line with no multiplier shows
 *  its win (and its shadow) as its wire is complete; a multiplier line shows its plain amount then, and its win at the punch
 *  (`productAt` the punch's nominal ms, slamProductAt, times the line's beat scale `f`) */
export function labelDues(full: number, multi: boolean, f: number, productAt: number): { plain: number | null; win: number } {
	return multi ? { plain: full, win: full + productAt * f } : { plain: null, win: full };
}

/** DEV / probes (led_board_probe.mjs section hitch): the same words drawn both ways on this renderer, the old way (a
 *  PIXI.Text's own picture: renderer.canvasText.createTextureAndCanvas, the power of two canvas it keeps) and as an
 *  AheadText: per words and style, the two quads, the two reported sizes and the pixels of the picture compared (the bytes
 *  that differ and the largest difference). Nothing is shown or sent to the GPU; both canvases are let go. */
export function compareWithText(renderer: PIXI.Renderer, texts: string[], styles: Record<string, PIXI.TextStyleOptions>) {
	const res = renderer.resolution;
	const out: { style: string; text: string; quadOld: number[]; quadNew: number[]; sizeOld: number[]; sizeNew: number[]; px: number[]; bytesDiffer: number; maxDiff: number }[] = [];
	for (const [name, o] of Object.entries(styles))
		for (const text of texts) {
			const style = new PIXI.TextStyle(o);
			const old = renderer.canvasText.createTextureAndCanvas({ text, style, resolution: res });
			const t = new PIXI.Text({ text, style: o });
			const a = new AheadText(o);
			a.text = text;
			a.step(res);
			const c = a.canvasForCheck();
			const w = Math.round(old.texture.frame.width * res);
			const h = Math.round(old.texture.frame.height * res);
			let bytesDiffer = 0;
			let maxDiff = 0;
			if (c && c.w === w && c.h === h) {
				const A = (old.canvasAndContext.context as CanvasRenderingContext2D).getImageData(0, 0, w, h).data;
				const B = c.ctx.getImageData(0, 0, w, h).data;
				for (let i = 0; i < A.length; i++) {
					const d = Math.abs(A[i] - B[i]);
					if (d) {
						bytesDiffer += 1;
						if (d > maxDiff) maxDiff = d;
					}
				}
			} else bytesDiffer = -1;
			out.push({ style: name, text, quadOld: [old.texture.frame.width, old.texture.frame.height], quadNew: [a.texture.frame.width, a.texture.frame.height], sizeOld: [t.width, t.height], sizeNew: [a.textWidth(), a.textHeight()], px: [w, h], bytesDiffer, maxDiff });
			PIXI.CanvasPool.returnCanvasAndContext(old.canvasAndContext);
			old.texture.destroy(true);
			t.destroy();
			a.destroy({ texture: true, textureSource: true });
		}
	return out;
}
