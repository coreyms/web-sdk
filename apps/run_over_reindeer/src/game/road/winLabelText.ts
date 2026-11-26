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
// frame); a label that is due and not ready is made on its own frame, as the Text was (so the timing never moves). Until
// 2026-11-26 each label kept a canvas of its own (THE MEMORY below says how they are held now); nothing goes through
// Pixi's power of two pools. No filter, shader, mask or blob: URL; the render resolution is not touched.
//
// THE MEMORY (2026-11-26, wip/reindeer-memory; Corey approved "no visible change" on 2026-11-26). Measured by Decimus at
// 390 x 844, device scale 3: 48 of the page's 55 canvas textures were these labels (12 line slots, four pictures each),
// 106 MB on the GPU upright, and every one also kept its own canvas, a second copy of the same 106 MB on the CPU side; each
// grew to the widest amount its slot had shown and never shrank, not even after the phone turned. Now:
//   1. NO CANVAS PER LABEL. A label draws on one of SCRATCH_MAX shared scratch canvases and its picture is sent from there;
//      only the GPU copy is kept. Pixi 8.8.1 uploads a canvas source AT ONCE (TextureSource.update emits 'update', and
//      GlTextureSystem.onSourceUpdate calls texSubImage2D in that call; initSource does texImage2D in its call), so the
//      scratch can be drawn over by the next label as soon as the upload returns. Between uploads each label's source points
//      at a 1 x 1 blank canvas, never at the scratch: if the GPU copy is ever made again from the resource (a lost WebGL
//      context, an unload), it comes back blank for at most a frame, never as another slot's amount, and the label is
//      flagged to draw again (aheadContextChanged, the source's 'unload'). A drawn label whose scratch another label has
//      since drawn on needs its draw again before its upload (need()).
//   2. THE SIZE FOLLOWS THE STYLE. A new style (the phone turned, the road's scale changed the label scale) lets the old
//      texture go at once (setStyle), so the next draw makes it at the size the new style needs. Within one style a texture
//      grows as before (to the next GROW_PX step) and is made again smaller only when the amount needs half its width or
//      less (SHRINK_SHARE): one texture made and one let go, in the frames ahead of the label, at most once a win per label
//      (the amounts never count up: each label's words are set once a win).
// The pixels are the same: the GPU gets the same canvas size with the same drawing on it, cleared the same way.
//
// THE SCREEN DENSITY (2026-11-26, the default everywhere since Corey's "LR2" on 2026-11-26: "yes, turn it on. 90 MB less on
// upright phones, slightly softer number edges under zoom"; until then the staging switch `?labeldensity=screen`): the labels
// are drawn at LINE_WIN.slam.ahead.screenPxPerCss texture px per CSS px of their largest size on screen (the road's scale
// times the slam's peak swell, winLights labelRes), never more than the renderer's resolution, instead of the renderer's
// resolution per road px. Only the texture's density changes: the quad, the size and the place are the same. The way back,
// for a side by side only: `?labeldensity=full` (the renderer's resolution per road px, as before 2026-11-26), on the dev
// server or a PUBLIC_STAGING=1 build only, never in a production bundle (game/staging.ts, the bundle check's marker);
// `?labeldensity=screen` is still accepted and changes nothing.
import * as PIXI from 'pixi.js';

import { LINE_WIN } from '../constants';
import { perfMark, STAGING_TOOLS } from '../staging';

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

/** `?labeldensity=full`, the way back to the renderer's resolution: the dev server or a PUBLIC_STAGING=1 build only (false,
 *  and the word dropped, in production) */
const fullDensityAsked = (): boolean => {
	if (!STAGING_TOOLS) return false;
	if (typeof window === 'undefined') return false;
	return new URLSearchParams(window.location.search).get('labeldensity') === 'full';
};
/** THE SCREEN DENSITY (header): on unless a staging page asks `?labeldensity=full`; read once at load */
export const LABEL_SCREEN_DENSITY: boolean = !fullDensityAsked();
/** the screen density's resolution for the labels (texture px per road px): screenPxPerCss x the road's CSS px per road px x the
 *  slam's peak swell, held to two decimals (so a label is not drawn again for a float's last digit), never above `cap` (the
 *  renderer's resolution, today's density) and never under a quarter */
export function screenLabelResolution(cssPerRoad: number, peak: number, cap: number): number {
	if (!(cssPerRoad > 0) || !(peak > 0)) return cap;
	const r = Math.round(LINE_WIN.slam.ahead.screenPxPerCss * cssPerRoad * peak * 100) / 100;
	return Math.min(cap, Math.max(0.25, r));
}

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

/** a texture's width is rounded up to this many px when it is made, so a few more digits never make it again */
const GROW_PX = 64;
/** within one style a texture is made again smaller only when the amount needs this share of its width or less */
export const SHRINK_SHARE = 0.5;
let made = 0;
/** DEV / probes: the canvases made since the page loaded (the shared scratch canvases and the blank stand in) */
export const aheadCanvasesMade = () => made;

// ---- THE SHARED SCRATCH CANVASES (header, 1) ------------------------------------------------------------------------------
// Two, so a line's amount and its shadow (two sizes) do not resize one canvas back and forth: a label takes the one already
// at its size, else the one used longest ago, resized (which clears it). Each holds at most the largest label's picture.
type Scratch = { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D; owner: AheadText | null; usedW: number; usedH: number; used: number };
const SCRATCH_MAX = 2;
const scratches: Scratch[] = [];
let scratchTick = 0;
const counts = { made: 0, grown: 0, shrunk: 0, resolution: 0, styleReleased: 0, lost: 0, scratchResized: 0 };
/** a scratch canvas of exactly w x h device px (Pixi uploads the whole resource, so it must be the texture's size), cleared
 *  where it was drawn last, now `who`'s */
function takeScratch(w: number, h: number, who: AheadText): Scratch {
	let s = scratches.find((x) => x.cv.width === w && x.cv.height === h);
	if (!s && scratches.length < SCRATCH_MAX) {
		const cv = PIXI.DOMAdapter.get().createCanvas(w, h) as HTMLCanvasElement;
		made += 1;
		s = { cv, ctx: cv.getContext('2d') as CanvasRenderingContext2D, owner: null, usedW: 0, usedH: 0, used: 0 };
		scratches.push(s);
	} else if (!s) {
		s = scratches.reduce((a, b) => (b.used < a.used ? b : a));
		// (a new size clears the canvas: nothing left to clear)
		s.cv.width = w;
		s.cv.height = h;
		s.usedW = 0;
		s.usedH = 0;
		counts.scratchResized += 1;
	}
	if (s.usedW > 0) {
		s.ctx.resetTransform();
		s.ctx.clearRect(0, 0, s.usedW, s.usedH);
	}
	s.owner = who;
	s.used = ++scratchTick;
	return s;
}
/** the 1 x 1 blank every label's source points at between uploads (header, 1) */
let standIn: HTMLCanvasElement | null = null;
const blank = () => {
	if (!standIn) {
		standIn = PIXI.DOMAdapter.get().createCanvas(1, 1) as HTMLCanvasElement;
		made += 1;
	}
	return standIn;
};

/** every label alive (the readout and the lost context walk them) */
const live = new Set<AheadText>();

/** one piece of work an AheadText still needs: drawn (a scratch holds its words) and sent (the GPU has that picture) */
export type AheadPiece = 'draw' | 'send' | null;

export class AheadText extends PIXI.Sprite {
	private style: PIXI.TextStyle;
	/** a new style object each time it is set (its own key: the style's words, size and edge) */
	private styleGen = 0;
	private words = '';
	/** the size a PIXI.Text of these words reports (CanvasTextMetrics: its bounds), at scale 1 */
	private mw = 0;
	private mh = 0;
	/** what was drawn last and what the GPU holds now: words, style and resolution ('' none) */
	private drawnKey = '';
	private sentKey = '';
	/** the resolution it was drawn at last (a lost context draws it again at that) */
	private drawnRes = 1;
	/** its texture's source: on the GPU once sent; its resource the blank stand in except inside send() */
	private src: PIXI.CanvasSource | null = null;
	/** the scratch it drew on last (still its picture while the scratch's owner is this label) */
	private scratch: Scratch | null = null;
	/** the canvas px drawn last */
	private usedW = 0;
	private usedH = 0;
	/** the label for the staging readout's marks */
	tag = 'amount';

	constructor(style: PIXI.TextStyleOptions) {
		super(PIXI.Texture.EMPTY);
		this.style = new PIXI.TextStyle(style);
		this.measure();
		live.add(this);
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
	/** a new style: its old texture goes now (header, 2), so the next draw makes one at the new style's size. Only called while
	 *  the label is hidden (winLights labelOf, after hide); one shown would be drawn again on its next frame (showNow) */
	setStyle(o: PIXI.TextStyleOptions) {
		this.style = new PIXI.TextStyle(o);
		this.styleGen += 1;
		if (this.src) counts.styleReleased += 1;
		this.release();
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
	/** the next piece of work it needs at this resolution (null: ready). A drawing another label has since drawn over on the
	 *  shared scratch is gone: it needs the draw again */
	need(res = aheadResolution()): AheadPiece {
		const k = this.keyAt(res);
		if (this.drawnKey !== k) return 'draw';
		if (this.sentKey !== k) return this.scratch && this.scratch.owner === this ? 'send' : 'draw';
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

	/** THE DRAW: Pixi's own text painter on a shared scratch canvas at the Text's size; the texture is made when there is none,
	 *  the resolution changed, the words outgrow it, or they need SHRINK_SHARE of its width or less (header, 2) */
	private draw(res: number) {
		const style = this.style;
		const text = this.words || ' ';
		const { w, h } = textPixelSize(text, style, res);
		const fitW = Math.ceil(w / GROW_PX) * GROW_PX;
		const held = this.src;
		const why = !held ? 'made' : held.resolution !== res ? 'resolution' : held.pixelWidth < w || held.pixelHeight < h ? 'grown' : fitW <= held.pixelWidth * SHRINK_SHARE ? 'shrunk' : null;
		let sc: Scratch;
		if (why) {
			counts[why] += 1;
			sc = takeScratch(fitW, h, this);
			// (the Text's texture settings: premultiplied as it uploads, the default sampler, no mipmaps)
			const src = new PIXI.CanvasSource({ resource: sc.cv as unknown as PIXI.ICanvas, resolution: res, alphaMode: 'premultiply-alpha-on-upload' });
			// (whole px: a resolution such as the screen density's 1.03 must not leave the texture a fraction of a px off the canvas)
			src.resize(fitW / res, h / res, res);
			src.resource = blank() as unknown as PIXI.ICanvas;
			src.on('unload', this.onUnload, this);
			this.src = src;
			// (the old texture goes: it was the wrong size or resolution)
			if (held) {
				held.off('unload', this.onUnload, this);
				held.destroy();
			}
		} else sc = takeScratch(held!.pixelWidth, held!.pixelHeight, this);
		paint().renderTextToCanvas(text, style, res, { canvas: sc.cv, context: sc.ctx } as unknown as Parameters<PIXI.CanvasTextSystem['renderTextToCanvas']>[3]);
		sc.usedW = w;
		sc.usedH = h;
		this.scratch = sc;
		this.usedW = w;
		this.usedH = h;
		this.drawnRes = res;
		// the Text's quad: the canvas size over the resolution (getPo2TextureFromSource's frame), about the same anchor
		const old = this.texture;
		this.texture = new PIXI.Texture({ source: this.src!, frame: new PIXI.Rectangle(0, 0, w / res, h / res) });
		if (old && old !== PIXI.Texture.EMPTY) old.destroy(false);
		this.drawnKey = this.keyAt(res);
		this.sentKey = '';
		perfMark(`winText:draw:${this.tag}`);
	}

	/** THE UPLOAD: the scratch goes to the GPU now (a source already there uploads in its update; a new one in initSource),
	 *  then the source points at the blank stand in again (header, 1) */
	private send() {
		const src = this.src;
		const sc = this.scratch;
		if (!src || !sc || sc.owner !== this) return;
		src.resource = sc.cv as unknown as PIXI.ICanvas;
		src.update();
		host?.upload(src);
		src.resource = blank() as unknown as PIXI.ICanvas;
		this.sentKey = this.drawnKey;
		perfMark(`winText:send:${this.tag}`);
	}

	/** its GPU copy is gone (the source was unloaded): drawn again when next shown (showNow). Nothing is drawn inside the
	 *  event: Pixi's own unload listener runs after this one and deletes the GPU texture */
	private onUnload() {
		this.forget();
	}
	private forget() {
		if (!this.drawnKey && !this.sentKey) return;
		this.drawnKey = '';
		this.sentKey = '';
		counts.lost += 1;
	}
	/** shown now: it and every parent visible and not faded out */
	private shown(): boolean {
		for (let c: PIXI.Container | null = this; c; c = c.parent) if (!c.visible || c.alpha <= 0) return false;
		return true;
	}
	/** a lost WebGL context came back (aheadContextChanged): every GPU copy is gone; one on screen now is drawn and sent at
	 *  once, the others when they next show */
	contextLost() {
		if (!this.src) return;
		this.forget();
		if (this.shown()) this.ensure(this.drawnRes);
	}

	/** its texture and source go (a new style); the scratch is no longer its picture */
	private release() {
		const old = this.texture;
		this.texture = PIXI.Texture.EMPTY;
		if (old && old !== PIXI.Texture.EMPTY) old.destroy(false);
		if (this.src) {
			this.src.off('unload', this.onUnload, this);
			this.src.destroy();
			this.src = null;
		}
		if (this.scratch?.owner === this) this.scratch.owner = null;
		this.scratch = null;
		this.drawnKey = '';
		this.sentKey = '';
	}

	override destroy(options?: PIXI.DestroyOptions) {
		live.delete(this);
		if (this.scratch?.owner === this) this.scratch.owner = null;
		this.scratch = null;
		this.src?.off('unload', this.onUnload, this);
		super.destroy(options);
	}

	/** DEV / checks: the scratch it drew on last, while that still holds its picture, and the px drawn there (compareWithText,
	 *  tools/win_text_check.mjs). null once another label has drawn on it */
	canvasForCheck() {
		const sc = this.scratch;
		return sc && sc.owner === this ? { canvas: sc.cv, ctx: sc.ctx, w: this.usedW, h: this.usedH } : null;
	}

	/** DEV / probes: its words, its texture's px (null: none held) and the px drawn, and whether it is drawn and sent */
	info(res = aheadResolution()) {
		const s = this.src;
		return { text: this.words, canvas: s ? [s.pixelWidth, s.pixelHeight] : null, px: [this.usedW, this.usedH], ready: this.ready(res) };
	}
	/** the readout: its texture's px and resolution (null: none held) */
	held(): { w: number; h: number; res: number } | null {
		const s = this.src;
		return s ? { w: s.pixelWidth, h: s.pixelHeight, res: s.resolution } : null;
	}
}

/** a WebGL context came back (Board.svelte adds this to the renderer's contextChange runner, after Pixi's own systems): every
 *  label's GPU copy is gone with the old context (header, 1) */
export function aheadContextChanged() {
	for (const t of live) t.contextLost();
}

/** THE READOUT (DEV: __reindeer.winLabelMemory; staging: the `?perf=1` box and __rorLabelMemory): the labels alive, the
 *  textures they hold by size, their MB (4 bytes a px), the canvases held and the counts since the page loaded */
export function aheadMemory() {
	const sizes: Record<string, number> = {};
	let textures = 0;
	let px = 0;
	for (const t of live) {
		const h = t.held();
		if (!h) continue;
		textures += 1;
		px += h.w * h.h;
		const k = `${h.w}x${h.h}@${Math.round(h.res * 100) / 100}`;
		sizes[k] = (sizes[k] ?? 0) + 1;
	}
	const canvases = scratches.map((s) => [s.cv.width, s.cv.height]);
	const canvasPx = scratches.reduce((n, s) => n + s.cv.width * s.cv.height, 0) + (standIn ? 1 : 0);
	const mb = (n: number) => Math.round((n * 4 * 10) / 1048576) / 10;
	return {
		density: LABEL_SCREEN_DENSITY ? 'screen' : 'road',
		labels: live.size,
		textures,
		gpuMB: mb(px),
		sizes,
		canvasesHeld: scratches.length + (standIn ? 1 : 0),
		canvases,
		canvasMB: mb(canvasPx),
		canvasesMade: made,
		...counts,
	};
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
