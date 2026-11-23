// @ts-nocheck: a node check script's kit, not app code (svelte-check picks up .mjs files)
// THE LED NODE KIT (2026-11-22, wip/ledpitch; moved here from tools/led_warm_check.mjs so tools/led_fit_check.mjs shares it):
// what a node only check needs to run the game's own LED scoreboard (game/scoreboard/, game/landing/ledScreens.ts) with no
// browser: a small software canvas, the stand-ins for pixi.js, the device tier, the staging flags and the road's red present
// rule, and the game's own board geometry for a window (game/scoreboard/layout.ts scoreboardGeometry, fed as
// components/Board.svelte feeds it). Import it first, call install(), then import the game's modules through src().
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
export const src = (p) => pathToFileURL(join(APP, 'src', 'game', ...p.split('/'))).href;

// THE SOFTWARE CANVAS: premultiplied float RGBA, the 2D context's state (transform, alpha, composite, fill), the shapes the
// LED programs use (rectangles, images, paths of lines and arcs, text as a fixed pattern per letter), sampled at pixel
// centres, nearest. Not a browser's raster: the same calls always give the same pixels, which is what both ways compare.
let canvasesMade = 0;
/** the canvases made so far (a check counts the ones a step makes) */
export const canvasCount = () => canvasesMade;
const parseColor = (s) => {
	if (typeof s !== 'string') return [0, 0, 0, 1];
	s = s.trim();
	if (s[0] === '#') {
		let h = s.slice(1);
		if (h.length === 3) h = [...h].map((c) => c + c).join('');
		const v = parseInt(h.slice(0, 6), 16);
		return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1];
	}
	const m = /rgba?\(([^)]*)\)/.exec(s);
	if (m) {
		const p = m[1].split(',').map((x) => parseFloat(x));
		return [p[0] / 255, p[1] / 255, p[2] / 255, p.length > 3 ? p[3] : 1];
	}
	return s === 'white' ? [1, 1, 1, 1] : [0, 0, 0, 1];
};
class Grad {
	constructor(kind, a) {
		this.kind = kind;
		this.a = a;
		this.stops = [];
	}
	addColorStop(o, c) {
		this.stops.push([o, parseColor(c)]);
		this.stops.sort((x, y) => x[0] - y[0]);
	}
	at(x, y) {
		const a = this.a;
		let u;
		if (this.kind === 'linear') {
			const dx = a[2] - a[0];
			const dy = a[3] - a[1];
			const L = dx * dx + dy * dy || 1;
			u = ((x - a[0]) * dx + (y - a[1]) * dy) / L;
		} else u = (Math.hypot(x - a[3], y - a[4]) - a[2]) / Math.max(1e-9, a[5] - a[2]);
		const S = this.stops;
		if (!S.length) return [0, 0, 0, 0];
		if (u <= S[0][0]) return S[0][1];
		for (let i = 1; i < S.length; i++)
			if (u <= S[i][0]) {
				const f = (u - S[i - 1][0]) / Math.max(1e-9, S[i][0] - S[i - 1][0]);
				return S[i - 1][1].map((v, k) => v + (S[i][1][k] - v) * f);
			}
		return S[S.length - 1][1];
	}
}
const fontPx = (f) => parseFloat(/([\d.]+)px/.exec(f || '10px')?.[1] ?? '10');
const glyphW = (ch) => 0.45 + ((ch.codePointAt(0) * 37) % 20) / 100;
class Ctx {
	constructor(canvas) {
		this.canvas = canvas;
		this.reset();
	}
	reset() {
		this.m = [1, 0, 0, 1, 0, 0];
		this.globalAlpha = 1;
		this.globalCompositeOperation = 'source-over';
		this.fillStyle = '#000';
		this.strokeStyle = '#000';
		this.font = '10px sans-serif';
		this.textBaseline = 'alphabetic';
		this.lineWidth = 1;
		this.imageSmoothingEnabled = true;
		this.imageSmoothingQuality = 'low';
		this.stack = [];
		this.path = [];
	}
	save() {
		this.stack.push({ m: [...this.m], globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation, fillStyle: this.fillStyle, font: this.font });
	}
	restore() {
		const s = this.stack.pop();
		if (s) Object.assign(this, s);
	}
	setTransform(a, b, c, d, e, f) {
		this.m = [a, b, c, d, e, f];
	}
	transform(a, b, c, d, e, f) {
		const [A, B, C, D, E, F] = this.m;
		this.m = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F];
	}
	translate(x, y) {
		this.transform(1, 0, 0, 1, x, y);
	}
	scale(x, y) {
		this.transform(x, 0, 0, y, 0, 0);
	}
	// the device pixels whose centres fall in a user space box (under the transform), with the user point of each
	cover(x, y, w, h, fn) {
		const [a, b, c, d, e, f] = this.m;
		const pts = [
			[x, y],
			[x + w, y],
			[x, y + h],
			[x + w, y + h],
		].map(([u, v]) => [a * u + c * v + e, b * u + d * v + f]);
		const W = this.canvas.width;
		const H = this.canvas.height;
		const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0]))));
		const x1 = Math.min(W, Math.ceil(Math.max(...pts.map((p) => p[0]))));
		const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1]))));
		const y1 = Math.min(H, Math.ceil(Math.max(...pts.map((p) => p[1]))));
		const det = a * d - b * c;
		if (!det) return;
		const xl = Math.min(x, x + w);
		const xr = Math.max(x, x + w);
		const yt = Math.min(y, y + h);
		const yb = Math.max(y, y + h);
		for (let py = y0; py < y1; py++)
			for (let px = x0; px < x1; px++) {
				const X = px + 0.5 - e;
				const Y = py + 0.5 - f;
				const u = (d * X - c * Y) / det;
				const v = (-b * X + a * Y) / det;
				if (u >= xl && u < xr && v >= yt && v < yb) fn(px, py, u, v);
			}
	}
	put(px, py, r, g, b, al) {
		const D = this.canvas.data;
		const i = (py * this.canvas.width + px) * 4;
		const sa = al * this.globalAlpha;
		const sr = r * sa;
		const sg = g * sa;
		const sb = b * sa;
		const da = D[i + 3];
		const op = this.globalCompositeOperation;
		let o;
		if (op === 'source-in') o = [sr * da, sg * da, sb * da, sa * da];
		else if (op === 'source-atop') o = [sr * da + D[i] * (1 - sa), sg * da + D[i + 1] * (1 - sa), sb * da + D[i + 2] * (1 - sa), da];
		else if (op === 'destination-out') o = [D[i] * (1 - sa), D[i + 1] * (1 - sa), D[i + 2] * (1 - sa), da * (1 - sa)];
		else if (op === 'lighter') o = [Math.min(1, sr + D[i]), Math.min(1, sg + D[i + 1]), Math.min(1, sb + D[i + 2]), Math.min(1, sa + da)];
		else o = [sr + D[i] * (1 - sa), sg + D[i + 1] * (1 - sa), sb + D[i + 2] * (1 - sa), sa + da * (1 - sa)];
		D[i] = o[0];
		D[i + 1] = o[1];
		D[i + 2] = o[2];
		D[i + 3] = o[3];
	}
	paintAt(u, v) {
		return this.fillStyle instanceof Grad ? this.fillStyle.at(u, v) : parseColor(this.fillStyle);
	}
	fillRect(x, y, w, h) {
		const solid = this.fillStyle instanceof Grad ? null : parseColor(this.fillStyle);
		this.cover(x, y, w, h, (px, py, u, v) => {
			const c = solid ?? this.fillStyle.at(u, v);
			this.put(px, py, c[0], c[1], c[2], c[3]);
		});
	}
	clearRect(x, y, w, h) {
		const D = this.canvas.data;
		this.cover(x, y, w, h, (px, py) => D.fill(0, (py * this.canvas.width + px) * 4, (py * this.canvas.width + px) * 4 + 4));
	}
	drawImage(img, ...a) {
		let sx = 0;
		let sy = 0;
		let sw = img.width;
		let sh = img.height;
		let dx, dy, dw, dh;
		if (a.length === 2) [dx, dy, dw, dh] = [a[0], a[1], img.width, img.height];
		else if (a.length === 4) [dx, dy, dw, dh] = a;
		else [sx, sy, sw, sh, dx, dy, dw, dh] = a;
		if (!img.data || !sw || !sh || !dw || !dh) return;
		const S = img.data;
		const IW = img.width;
		const IH = img.height;
		this.cover(dx, dy, dw, dh, (px, py, u, v) => {
			const qx = Math.floor(sx + ((u - dx) * sw) / dw);
			const qy = Math.floor(sy + ((v - dy) * sh) / dh);
			if (qx < 0 || qy < 0 || qx >= IW || qy >= IH) return;
			const j = (qy * IW + qx) * 4;
			const al = S[j + 3];
			if (al <= 0) {
				if (this.globalCompositeOperation === 'source-in') this.put(px, py, 0, 0, 0, 0);
				return;
			}
			this.put(px, py, S[j] / al, S[j + 1] / al, S[j + 2] / al, al);
		});
	}
	getImageData(x, y, w, h) {
		const out = new Uint8ClampedArray(w * h * 4);
		const D = this.canvas.data;
		const W = this.canvas.width;
		for (let j = 0; j < h; j++)
			for (let i = 0; i < w; i++) {
				const X = x + i;
				const Y = y + j;
				if (X < 0 || Y < 0 || X >= W || Y >= this.canvas.height) continue;
				const s = (Y * W + X) * 4;
				const t = (j * w + i) * 4;
				const al = D[s + 3];
				if (al > 0) {
					out[t] = Math.round((D[s] / al) * 255);
					out[t + 1] = Math.round((D[s + 1] / al) * 255);
					out[t + 2] = Math.round((D[s + 2] / al) * 255);
				}
				out[t + 3] = Math.round(al * 255);
			}
		return { data: out, width: w, height: h };
	}
	createImageData(w, h) {
		return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
	}
	putImageData(id, x, y) {
		const D = this.canvas.data;
		const W = this.canvas.width;
		for (let j = 0; j < id.height; j++)
			for (let i = 0; i < id.width; i++) {
				const X = x + i;
				const Y = y + j;
				if (X < 0 || Y < 0 || X >= W || Y >= this.canvas.height) continue;
				const s = (j * id.width + i) * 4;
				const t = (Y * W + X) * 4;
				const al = id.data[s + 3] / 255;
				D[t] = (id.data[s] / 255) * al;
				D[t + 1] = (id.data[s + 1] / 255) * al;
				D[t + 2] = (id.data[s + 2] / 255) * al;
				D[t + 3] = al;
			}
	}
	createLinearGradient(...a) {
		return new Grad('linear', a);
	}
	createRadialGradient(...a) {
		return new Grad('radial', a);
	}
	measureText(str) {
		const px = fontPx(this.font);
		const w = [...String(str)].reduce((s, ch) => s + px * glyphW(ch), 0);
		return { width: w, actualBoundingBoxAscent: px * 0.72, actualBoundingBoxDescent: /[gjpqy]/.test(str) ? px * 0.2 : 0 };
	}
	fillText(str, x, y) {
		const px = fontPx(this.font);
		let cx = x;
		for (const ch of String(str)) {
			const w = px * glyphW(ch);
			const code = ch.codePointAt(0);
			const top = y - px * 0.72;
			const c0 = this.paintAt(cx, top);
			const x0 = cx;
			this.cover(cx, top, w * 0.85, px * 0.72, (qx, qy, u, v) => {
				const gx = Math.floor((u - x0) / Math.max(1, px / 7));
				const gy = Math.floor((v - top) / Math.max(1, px / 7));
				if ((gx * 7 + gy * 3 + code) % 5 < 3) {
					const c = this.fillStyle instanceof Grad ? this.fillStyle.at(u, v) : c0;
					this.put(qx, qy, c[0], c[1], c[2], c[3]);
				}
			});
			cx += w;
		}
	}
	beginPath() {
		this.path = [];
	}
	moveTo(x, y) {
		this.path.push([[x, y]]);
	}
	lineTo(x, y) {
		if (!this.path.length) this.path.push([]);
		this.path[this.path.length - 1].push([x, y]);
	}
	closePath() {}
	arc(x, y, r, a0, a1) {
		const sub = [];
		for (let i = 0; i <= 32; i++) {
			const a = a0 + ((a1 - a0) * i) / 32;
			sub.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
		}
		this.path.push(sub);
	}
	rect(x, y, w, h) {
		this.path.push([
			[x, y],
			[x + w, y],
			[x + w, y + h],
			[x, y + h],
		]);
	}
	fill() {
		const polys = this.path.filter((p) => p.length > 2);
		if (!polys.length) return;
		const all = polys.flat();
		const xs = all.map((p) => p[0]);
		const ys = all.map((p) => p[1]);
		const bx = Math.min(...xs);
		const by = Math.min(...ys);
		const inside = (u, v) => {
			let c = false;
			for (const P of polys)
				for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
					const [xi, yi] = P[i];
					const [xj, yj] = P[j];
					if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) c = !c;
				}
			return c;
		};
		this.cover(bx, by, Math.max(...xs) - bx, Math.max(...ys) - by, (px, py, u, v) => {
			if (!inside(u, v)) return;
			const c = this.paintAt(u, v);
			this.put(px, py, c[0], c[1], c[2], c[3]);
		});
	}
	stroke() {}
	strokeRect() {}
}
export class Canvas {
	constructor() {
		canvasesMade += 1;
		this._w = 300;
		this._h = 150;
		this.data = new Float32Array(this._w * this._h * 4);
		this._ctx = null;
	}
	get width() {
		return this._w;
	}
	set width(v) {
		this._w = Math.max(0, Math.floor(v));
		this.data = new Float32Array(this._w * this._h * 4);
		this._ctx?.reset();
	}
	get height() {
		return this._h;
	}
	set height(v) {
		this._h = Math.max(0, Math.floor(v));
		this.data = new Float32Array(this._w * this._h * 4);
		this._ctx?.reset();
	}
	getContext() {
		return (this._ctx ??= new Ctx(this));
	}
	toDataURL() {
		return 'data:,';
	}
}

/** the globals and the stand-ins, once, before any game module is imported. `phoneTier` and `ratio`: what the device tier's
 *  stand-in answers (the scoreboard's own deviceRatio is set by each check) */
export function install({ phoneTier = true, ratio = 3, width = 390, height = 844 } = {}) {
	globalThis.document = { createElement: (t) => (t === 'canvas' ? new Canvas() : {}), fonts: undefined };
	globalThis.window = { innerWidth: width, innerHeight: height, devicePixelRatio: ratio, location: { search: '' } };

	// THE STAND INS: pixi.js (any member, any call, any construction: the scoreboard's sprites and textures are not judged here),
	// the device tier (an upright phone at device scale 3) and the staging flags (off)
	const PIXI_STUB = `const make = () => { const f = function () {}; f.__s = {}; const p = new Proxy(f, { get(t, k) { if (k === Symbol.toPrimitive) return () => 0; if (k === 'then') return undefined; if (!(k in t.__s)) t.__s[k] = make(); return t.__s[k]; }, set(t, k, v) { t.__s[k] = v; return true; }, apply() { return p; }, construct() { return make(); } }); return p; };
	export const Container = make(); export const Sprite = make(); export const Graphics = make(); export const Texture = make(); export const CanvasSource = make(); export const Rectangle = make(); export const Assets = make(); export const TextureSource = make();
	export default {};`;
	const TIER_STUB = `export const PHONE_TIER = ${phoneTier ? 'true' : 'false'}; export const renderResolutionFor = () => ${ratio}; export const deviceSignals = () => ({}); export const RENDER_TIER = 'phone';`;
	// (the strip's scatter count reads the road's red present rule, game/road/present.ts RED_FROM; the road itself is not loaded)
	const PRESENT_STUB = `export const RED_FROM = ${/export const RED_FROM = (\d+)/.exec(readFileSync(join(APP, 'src', 'game', 'road', 'present.ts'), 'utf8'))[1]};`;
	const STAGING_STUB = `export const STAGING = false; export const STAGING_TOOLS = false; export const RESCAP_RANGE = { min: 1, max: 3 }; export const perfMarks = null; export const perfMark = () => {};`;
	const url = (src) => 'data:text/javascript,' + encodeURIComponent(src);
	register(
		url(`export async function resolve(s, c, n) {
		if (s === 'pixi.js') return { url: ${JSON.stringify(url(PIXI_STUB))}, shortCircuit: true };
		if (/(^|\\/)deviceTier(\\.ts)?$/.test(s)) return { url: ${JSON.stringify(url(TIER_STUB))}, shortCircuit: true };
		if (/\\/road\\/present(\\.ts)?$/.test(s)) return { url: ${JSON.stringify(url(PRESENT_STUB))}, shortCircuit: true };
		if (/(^|\\/)staging(\\.ts)?$/.test(s)) return { url: ${JSON.stringify(url(STAGING_STUB))}, shortCircuit: true };
		if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return n(s + '.ts', c);
		return n(s, c);
	}`),
	);
}

// ---- THE GAME'S OWN GEOMETRY FOR A WINDOW -------------------------------------------------------------------------------
/** utils-layout's size and layout classes (packages/utils-layout/src/createLayout.svelte.ts), copied: a pure rule of the
 *  window's size */
// COPY OF packages/utils-layout/src/createLayout.svelte.ts:CANVAS_SIZE_TYPE_BREAK_POINTS, CANVAS_RATIO_TYPE_BREAK_POINTS
export const sizeType = (w, h) => {
	const d = Math.min(w, h);
	return d <= 375 ? 'smallMobile' : d <= 480 ? 'mobile' : d <= 820 ? 'tablet' : d <= 1024 ? 'largeTablet' : 'desktop';
};
export const layoutType = (w, h) => {
	const r = w / h;
	if (r < 1.3 && r > 0.8) return 'tablet';
	if (r <= 0.8) return 'portrait';
	const st = sizeType(w, h);
	return st === 'mobile' || st === 'smallMobile' ? 'landscape' : 'desktop';
};
/** the scoreboard's place for a window of vw x vh CSS px (before the smallest dot rule: layout.ts ledPitchGeo applies it) */
export async function geometryFor(vw, vh) {
	const LS = await import(src('layoutSpec.ts'));
	const { scoreboardGeometry } = await import(src('scoreboard/layout.ts'));
	const lt = layoutType(vw, vh);
	const kind = LS.layoutKind(lt);
	const M = LS.MASTER[kind];
	const scale = Math.min(vw / M.width, vh / M.height);
	const main = { x: vw / 2, y: vh / 2, width: M.width, height: M.height, scale };
	LS.setPortraitViewportSource(() => ({ masterWidth: vw / scale, masterHeight: vh / scale, vw, vh }));
	LS.setLandscapeViewportSource(() => (lt !== 'desktop' ? LS.MASTER.landscape.height : vh / scale));
	// (the HUD's safe area read wants a real document: none here, so no insets)
	const doc = globalThis.document;
	globalThis.document = undefined;
	try {
		return scoreboardGeometry(kind, vw, vh, main, LS.roadPlacement(kind), LS.isPhoneSizeType(sizeType(vw, vh)));
	} finally {
		globalThis.document = doc;
	}
}
/** the renderer's resolution for a window on a screen of `density` device px per CSS px (game/deviceTier.ts
 *  renderResolutionFor: the cap 3 on the phone tier, 2 off it and there under the pixel ceiling, never under 1) */
export async function resolutionFor(vw, vh, density, phoneTier) {
	const { RENDER_MAX_PIXELS, RENDER_RESOLUTION_CAP } = await import(src('constants.ts'));
	let r = Math.min(density, phoneTier ? RENDER_RESOLUTION_CAP.phone : RENDER_RESOLUTION_CAP.desktop);
	if (!phoneTier) r = Math.min(r, Math.sqrt(RENDER_MAX_PIXELS / (vw * vh)));
	return Math.max(Math.min(1, density), r);
}
/** a fixed pattern at the art sheet's size (scoreboardArtSpec.ts, ledArtSpec.ts), so every picture bake runs */
export function patternSheet(width, height) {
	const sheet = new Canvas();
	sheet.width = width;
	sheet.height = height;
	for (let i = 0; i < sheet.width * sheet.height; i++) {
		const x = i % sheet.width;
		const y = Math.floor(i / sheet.width);
		const a = (x * 13 + y * 7) % 11 < 8 ? 1 : 0;
		sheet.data.set([((x * 3) % 256) / 255 * a, ((y * 5) % 256) / 255 * a, (((x + y) * 7) % 256) / 255 * a, a], i * 4);
	}
	return sheet;
}
