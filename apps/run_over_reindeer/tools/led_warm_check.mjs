// @ts-nocheck: a node check script, not app code (svelte-check picks up .mjs files)
// THE CARDS MADE AHEAD, NODE ONLY (2026-11-22, wip/ledhitch; constants LED_BOARD.warm, game/scoreboard/warmGate.ts,
// scoreboard.ts prepare / warmStep, scoreboardDraw.ts advOf, ledSigns.ts signAdv). No browser: the game's own scoreboard
// (game/scoreboard/scoreboard.ts, the real class, its real programs) runs on a small software canvas made here (below), with
// pixi.js, the device tier and the staging flags stood in (the scoreboard's GPU side is not what is judged). It checks:
//   1. THE ADVANCES: a currency sign's advance alone (signAdv) is its dot count's (signDots adv) for every sign at every cap
//      from 1 to 200, so the size searches pick the caps they always did
//   2. DOT FOR DOT: the Free Spins entry, the Super entry, a Total Win in dollars and a capped Total Win (MAX WIN, its line,
//      the explanation page) on the upright phone's faces (259 x 189 dots, 1.5 LEDs per dot: 390 x 844 at device scale 3),
//      drawn step by step the old way (nothing made ahead, every picture made as the card comes up) and after the card was
//      made ahead (prepare, then frames of warmStep at a budget that stops it mid draw again and again): both faces' LEDs
//      hashed at every LED step from the card's start to past its press line are the same, step for step
//   3. NOTHING MADE AS IT COMES UP: after the card was made ahead its first 25 steps make no new canvas at all (the old way
//      made dozens on the first step: the Total Win's ~400 ms frame); the warm finished ('done') and let its scratch faces go
//   4. THE SMALL WIN (2026-11-22, wip/winlights; LED_BOARD.warm.small, scoreboard.ts prepareSmall): a line win's strip total
//      ($1,234.56 and $0.40, counted over LINE_WIN.slam stripCountMs) drawn the old way and after it was made ahead: the strip
//      dot for dot the same at every step from 450 ms to its end, and made ahead it makes no new canvas at any step it is up
// Each card in each way runs in its own node process (fresh caches, as a fresh page).
//   node --experimental-strip-types --no-warnings tools/led_warm_check.mjs      (from apps/run_over_reindeer)
// Pass: every line PASS, "0 fail" and exit 0.
import { register } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
const CARDS = {
	fs: { kind: 'fs', spins: 10, amount: 0, presents: 3 },
	sfs: { kind: 'sfs', spins: 10, amount: 0, presents: 4 },
	total: { kind: 'total', spins: 0, amount: 1234.56, x: 123.456 },
	cap: { kind: 'total', spins: 0, amount: 77770, x: 7777, capped: true, title: 'MAX WIN', line: '7,777x the play amount, the most a round can award.' },
};
// the strip's small wins (a line win's total, counted at LINE_WIN.slam stripCountMs at turbo 0)
const SMALLS = {
	small: { amount: 1234.56, x: 12.3456 },
	smallCents: { amount: 0.4, x: 0.4 },
};

// ---- the parent: run every card both ways in child processes and compare -------------------------------------------------
if (process.argv[2] !== 'child') {
	let pass = 0;
	let fail = 0;
	const check = (ok, msg, detail) => {
		if (ok) pass++;
		else fail++;
		console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail).slice(0, 900) : ''}`);
	};
	const run = (mode, card) => {
		const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', SELF, 'child', mode, card], { cwd: APP, encoding: 'utf8', maxBuffer: 64 * 1048576 });
		const line = (r.stdout || '').split('\n').find((l) => l.startsWith('RESULT '));
		if (!line) return { error: (r.stderr || r.stdout || '').slice(-1500) };
		return JSON.parse(line.slice(7));
	};
	const adv = run('adv', 'none');
	check(!adv.error && adv.bad.length === 0 && adv.n > 0, `1. a sign's advance alone is its dot count's at every cap 1 to 200 (${adv.n} signs x caps checked)`, adv.error ?? adv.bad?.slice(0, 8));
	for (const card of Object.keys(SMALLS)) {
		const cold = run('cold', card);
		const warm = run('warm', card);
		if (cold.error || warm.error) {
			check(false, `${card}: both ways ran`, cold.error ?? warm.error);
			continue;
		}
		const n = Math.min(cold.strip.length, warm.strip.length);
		const bad = [];
		for (let i = 0; i < n; i++) if (cold.strip[i] !== warm.strip[i]) bad.push(i);
		check(n === cold.strip.length && n === warm.strip.length && n > 40, `4. ${card} (${SMALLS[card].amount}): ${n} steps both ways`, { cold: cold.strip.length, warm: warm.strip.length });
		check(bad.length === 0, `4. ${card}: the strip dot for dot the same at every step, made ahead or not`, bad.slice(0, 10));
		check(warm.warm?.state === 'done' && warm.warm.samples === warm.warm.of && warm.warm.made > 0, `4. ${card}: the small win made ahead ran to its end (${warm.warm?.state}, ${warm.warm?.samples} of ${warm.warm?.of} samples, ${warm.warm?.made} pictures over ${warm.frames} frames)`, warm.warm);
		check(cold.madeAll >= 3, `4. ${card}: the old way made ${cold.madeAll} canvases while it showed`, cold.madeAll);
		check(warm.madeAll === 0, `4. ${card}: made ahead, it makes no new canvas at any step (${warm.madeAll})`, warm.madeAll);
	}
	for (const card of Object.keys(CARDS)) {
		const cold = run('cold', card);
		const warm = run('warm', card);
		if (cold.error || warm.error) {
			check(false, `${card}: both ways ran`, cold.error ?? warm.error);
			continue;
		}
		const n = Math.min(cold.back.length, warm.back.length);
		const backBad = [];
		const stripBad = [];
		for (let i = 0; i < n; i++) {
			if (cold.back[i] !== warm.back[i]) backBad.push(i);
			if (cold.strip[i] !== warm.strip[i]) stripBad.push(i);
		}
		const lit = cold.lit.filter((v) => v > 0).length;
		check(n === cold.back.length && n === warm.back.length && n > 60 && lit > 20, `${card}: ${n} steps both ways (${lit} with the back board lit)`, { cold: cold.back.length, warm: warm.back.length, lit });
		check(backBad.length === 0, `2. ${card}: the back board dot for dot the same at every step, made ahead or not`, backBad.slice(0, 10));
		check(stripBad.length === 0, `2. ${card}: the strip dot for dot the same at every step, made ahead or not`, stripBad.slice(0, 10));
		check(warm.warm?.state === 'done' && warm.warm.samples > 20 && warm.yields > 0, `3. ${card}: the warm ran to its end (${warm.warm?.state}, ${warm.warm?.samples} samples, ${warm.warm?.made} pictures, stopped mid draw ${warm.yields} times over ${warm.frames} frames) and let its scratch faces go`, warm.warm);
		check(cold.madeFirst >= 10, `3. ${card}: the old way made ${cold.madeFirst} canvases on the card's first steps`, cold.madeFirst);
		check(warm.madeFirst === 0, `3. ${card}: made ahead, its first 25 steps make no new canvas (${warm.madeFirst})`, warm.madeFirst);
	}
	console.log(`\nled_warm_check: ${pass} pass, ${fail} fail`);
	process.exit(fail ? 1 : 0);
}

// ---- the child: one card, one way --------------------------------------------------------------------------------------
const [, , , MODE, CARD] = process.argv;

// THE SOFTWARE CANVAS: premultiplied float RGBA, the 2D context's state (transform, alpha, composite, fill), the shapes the
// LED programs use (rectangles, images, paths of lines and arcs, text as a fixed pattern per letter), sampled at pixel
// centres, nearest. Not a browser's raster: the same calls always give the same pixels, which is what both ways compare.
let canvasesMade = 0;
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
class Canvas {
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
globalThis.document = { createElement: (t) => (t === 'canvas' ? new Canvas() : {}), fonts: undefined };
globalThis.window = { innerWidth: 390, innerHeight: 844, devicePixelRatio: 3, location: { search: '' } };

// THE STAND INS: pixi.js (any member, any call, any construction: the scoreboard's sprites and textures are not judged here),
// the device tier (an upright phone at device scale 3) and the staging flags (off)
const PIXI_STUB = `const make = () => { const f = function () {}; f.__s = {}; const p = new Proxy(f, { get(t, k) { if (k === Symbol.toPrimitive) return () => 0; if (k === 'then') return undefined; if (!(k in t.__s)) t.__s[k] = make(); return t.__s[k]; }, set(t, k, v) { t.__s[k] = v; return true; }, apply() { return p; }, construct() { return make(); } }); return p; };
export const Container = make(); export const Sprite = make(); export const Graphics = make(); export const Texture = make(); export const CanvasSource = make(); export const Rectangle = make(); export const Assets = make(); export const TextureSource = make();
export default {};`;
const TIER_STUB = `export const PHONE_TIER = true; export const renderResolutionFor = () => 3; export const deviceSignals = () => ({}); export const RENDER_TIER = 'phone';`;
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

const src = (p) => pathToFileURL(join(APP, 'src', 'game', ...p.split('/'))).href;
if (MODE === 'adv') {
	const signs = await import(src('scoreboard/ledSigns.ts'));
	const bad = [];
	let n = 0;
	for (const ch of Object.keys(signs.AMOUNT_OUTLINES))
		for (let cap = 1; cap <= 200; cap++) {
			n += 1;
			const a = signs.signAdv(ch, cap);
			const d = signs.signDots(ch, cap);
			if (!d || a !== d.adv) bad.push({ ch, cap, adv: a, dots: d?.adv });
		}
	console.log('RESULT ' + JSON.stringify({ n, bad }));
	process.exit(0);
}

const { LED_BOARD } = await import(src('constants.ts'));
const draw = await import(src('scoreboard/scoreboardDraw.ts'));
const { Scoreboard } = await import(src('scoreboard/scoreboard.ts'));

// the art sheet: a fixed pattern at the sheet's size (scoreboardArtSpec.ts), so every picture bake runs
const { SCOREBOARD_ART } = await import(src('scoreboardArtSpec.ts'));
const sheet = new Canvas();
sheet.width = SCOREBOARD_ART.width;
sheet.height = SCOREBOARD_ART.height;
for (let i = 0; i < sheet.width * sheet.height; i++) {
	const x = i % sheet.width;
	const y = Math.floor(i / sheet.width);
	const a = (x * 13 + y * 7) % 11 < 8 ? 1 : 0;
	sheet.data.set([((x * 3) % 256) / 255 * a, ((y * 5) % 256) / 255 * a, (((x + y) * 7) % 256) / 255 * a, a], i * 4);
}
draw.setScoreboardArt(sheet);

// THE UPRIGHT PHONE'S FACES (390 x 844 at device scale 3: the strip 259 x 36 dots, the back board 259 x 189, 1.5 LEDs a dot)
const face = (x, y, dotsW, dotsH, p) => ({ x, y, w: dotsW * p, h: dotsH * p, dotsW, dotsH });
const P = 1.3;
const geo = {
	cls: 'portrait',
	W: 390,
	H: 844,
	pitch: P,
	f: 7,
	ol: 7 / 3,
	strip: { box: { x: 19.5, y: 600, w: 351, h: 71 }, face: face(26.5, 612, 259, 36, P), housing: { x: 19.5, y: 600, w: 351, h: 66 }, cap: 9.3 },
	back: { face: face(26.5, 330, 259, 189, P), housing: { x: 19.5, y: 318, w: 351, h: 265 }, cap: 14, backH: 280, sc: 280 / 420 },
	dim: { x: -4, y: -4, w: 398, h: 852 },
	hudTop: 700,
	road: { ox: 0, oy: 0, k: 0.25 },
};
const sb = new Scoreboard();
sb.deviceRatio = () => 3;
sb.layout(geo, []);
const env = { free: true, left: 10, idle: false, scatter: null };
const fmt = (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
if (SMALLS[CARD]) {
	// THE SMALL WIN, one way (4 above): its request as components/Board.svelte makes it for a line win's strip total
	const Q = SMALLS[CARD];
	const { LINE_WIN } = await import(src('constants.ts'));
	const wreq = { x: Q.x, amount: Q.amount, bet: 100, fmt, rate: 1, auto: false, small: true, countMs: LINE_WIN.slam.stripCountMs };
	let warmS = null;
	let framesS = 0;
	if (MODE === 'warm') {
		LED_BOARD.warm.budgetMs = 25;
		sb.prepareSmall(wreq);
		for (let i = 0; i < 20000; i++) {
			sb.update(1000 / 60, env);
			framesS += 1;
			const w = sb.smallWarmInfo();
			if (!w || w.state !== 'running') {
				warmS = w;
				break;
			}
		}
	}
	sb.manual = true;
	sb.clock = 0;
	void sb.win(wreq);
	const shown = sb.snapshot().show;
	const step = 1000 / LED_BOARD.fps;
	const outS = { strip: [], madeAll: 0, warm: warmS, frames: framesS };
	const before = canvasesMade;
	// (the small win's own steps: the one after its end draws the strip's resting state, the bonus round's counter)
	for (let t = 0; t + step < shown.end; t += step) {
		sb.step(step);
		const s = sb.faceStats('strip');
		outS.strip.push(t >= 450 ? s.hash : '-');
	}
	outS.madeAll = canvasesMade - before;
	console.log('RESULT ' + JSON.stringify(outS));
	process.exit(0);
}
const C = CARDS[CARD];
const req = { kind: C.kind, spins: C.spins, amount: C.amount, fmt, rate: 1, title: C.title ?? null, line: C.line ?? null, x: C.x ?? 0, capped: !!C.capped, auto: false, presents: C.presents ?? 0 };

let warm = null;
let yields = 0;
let frames = 0;
if (MODE === 'warm') {
	// a budget that still stops the warm mid draw (this software canvas is far slower than a browser's)
	LED_BOARD.warm.budgetMs = 25;
	sb.prepare([req]);
	for (let i = 0; i < 20000; i++) {
		sb.update(1000 / 60, env);
		frames += 1;
		const w = sb.warmInfo().find((j) => j.kind === req.kind);
		if (w && w.samples < w.of && w.frames > 0) yields = Math.max(yields, w.frames - w.samples);
		if (!w || (w.state !== 'queued' && w.state !== 'running')) {
			warm = w;
			break;
		}
	}
}
// THE CARD, step by step at the LED rate on the board's own clock from 0 (both ways the same clock, the same steps)
sb.manual = true;
sb.clock = 0;
sb.card(req);
const show = sb.snapshot().show;
const end = (show.pressLineAt ?? show.countEnd) + 1500;
const step = 1000 / LED_BOARD.fps;
const out = { back: [], strip: [], lit: [], madeFirst: 0, warm, yields, frames };
const before = canvasesMade;
for (let t = 0, i = 0; t <= end; t += step, i++) {
	sb.step(step);
	if (i === 25) out.madeFirst = canvasesMade - before;
	const b = sb.faceStats('back');
	const s = sb.faceStats('strip');
	out.back.push(b.hash);
	// (the strip's own switch from the cartoon before the card is a dissolve of the picture before: compared from 450 ms on)
	out.strip.push(t >= 450 ? s.hash : '-');
	out.lit.push(b.lit);
}
console.log('RESULT ' + JSON.stringify(out));
