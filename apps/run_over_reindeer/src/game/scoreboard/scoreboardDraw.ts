// THE LED SCOREBOARD'S PICTURES (Corey's approved mock bigwin_led_r3_2026-11-16 "r3b": its drawing code, ported). Everything
// here draws on a small 2D canvas at ONE PIXEL PER DOT; the scoreboard (game/scoreboard/scoreboard.ts) shows those canvases
// through the dot grille. Plain 2D canvas drawing (composite modes on small canvases), no filter.
//   the words    the 5 x 7 dot font of the press screen (game/landing/ledScreens.ts: textW, drawText; EPX at 2x, the game's
//                Overpass Heavy snapped to the dots from 3x up) and the amount's own row: a heavy face per glyph at the dot
//                size with tabular digit cells (the mock's vglyph / drawRow)
//   the pictures one small sheet of the game's own art (tools/build_scoreboard_art.py), stepped down to the dot size with
//                the LED punch, baked once per size (CPU canvases, never textures)
//   the programs the five tier looks, the win line (title and counting amount), the small win, the bonus round's counter,
//                the six idle cartoons, the race and its result card, the Grandma gag
import { SCOREBOARD_ART } from '../scoreboardArtSpec';
import { LED_FONT, drawText, mk, textW, type Cv } from '../landing/ledScreens';
import { LED_BOARD } from '../constants';
import { amountNow, tierNow, type Show } from './show';
import { newRace, raceProgress, type Race } from './race';

type Ctx = CanvasRenderingContext2D;

export type Face = {
	dotsW: number;
	dotsH: number;
	/** the picture drawn this step, the two scratch faces of a transition, the last step kept for a switch */
	out: Cv;
	a: Cv;
	b: Cv;
	prev: Cv;
	noise: Float32Array;
};
export const makeFaceCanvases = (dotsW: number, dotsH: number): Face => {
	const noise = new Float32Array(dotsW * dotsH);
	let h = 0x9e3779b9;
	for (let i = 0; i < noise.length; i++) {
		h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) ^ (i * 0xc2b2ae35);
		noise[i] = ((h >>> 0) % 10007) / 10007;
	}
	return { dotsW, dotsH, out: mk(dotsW, dotsH), a: mk(dotsW, dotsH), b: mk(dotsW, dotsH), prev: mk(dotsW, dotsH), noise };
};

// ---- small helpers -------------------------------------------------------------------------------------------------------
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const ease = (t: number) => {
	t = clamp(t, 0, 1);
	return t * t * (3 - 2 * t);
};
const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
export const hash = (n: number) => {
	const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};
const dot = (g: Ctx, x: number, y: number, col: string) => {
	g.fillStyle = col;
	g.fillRect(Math.round(x), Math.round(y), 1, 1);
};

// ---- THE PICTURES (one sheet; set by the board once it is loaded) ---------------------------------------------------------
let SHEET: CanvasImageSource | null = null;
const artCache = new Map<string, Cv>();
export const setScoreboardArt = (image: CanvasImageSource | null) => {
	SHEET = image;
	artCache.clear();
};
type ArtName = keyof typeof SCOREBOARD_ART.frames;
const frameOf = (name: ArtName) => SCOREBOARD_ART.frames[name];
const size = (name: ArtName, src: number[] | null): [number, number] => {
	if (src) return [src[2], src[3]];
	const f = frameOf(name);
	return f ? [f.w, f.h] : [1, 1];
};
/** one picture at one size in dots: a stepped downscale, then the LED punch (saturation and lift), baked once */
function art(name: ArtName, src: number[] | null, dw: number, dh: number): Cv {
	dw = Math.max(1, Math.round(dw));
	dh = Math.max(1, Math.round(dh));
	const key = name + '|' + (src ? src.join(',') : '') + '|' + dw + 'x' + dh;
	let c = artCache.get(key);
	if (c) return c;
	c = mk(dw, dh);
	const f = frameOf(name);
	if (!SHEET || !f) return c; // (not cached: drawn again once the sheet is in)
	let [sx, sy, sw, sh] = src || [0, 0, f.w, f.h];
	sx += f.x;
	sy += f.y;
	let cur: CanvasImageSource = SHEET;
	while (sw / 2 >= dw * 1.6 && sh / 2 >= dh * 1.6) {
		const t = mk(Math.round(sw / 2), Math.round(sh / 2));
		t.ctx.imageSmoothingQuality = 'high';
		t.ctx.drawImage(cur, sx, sy, sw, sh, 0, 0, t.width, t.height);
		cur = t;
		sx = 0;
		sy = 0;
		sw = t.width;
		sh = t.height;
	}
	c.ctx.imageSmoothingQuality = 'high';
	c.ctx.drawImage(cur, sx, sy, sw, sh, 0, 0, dw, dh);
	const id = c.ctx.getImageData(0, 0, dw, dh);
	const d = id.data;
	for (let i = 0; i < d.length; i += 4) {
		if (d[i + 3] < 70) {
			d[i + 3] = 0;
			continue;
		}
		const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
		for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, (l + (d[i + k] - l) * 1.3) * 1.12));
		d[i + 3] = Math.min(255, d[i + 3] * 1.25);
	}
	c.ctx.putImageData(id, 0, 0);
	// a size bake is small; the cache is bounded so a long session of resizes never grows it without end
	if (artCache.size > 400) artCache.clear();
	artCache.set(key, c);
	return c;
}
/** a picture `h` dots tall with its bottom at yBottom (flip: mirrored) */
function sprite(g: Ctx, name: ArtName, x: number, yBottom: number, h: number, flip = false, src: number[] | null = null): number {
	const [sw, sh] = size(name, src);
	const w = Math.max(1, Math.round((h * sw) / sh));
	const a = art(name, src, w, Math.round(h));
	if (flip) {
		g.save();
		g.translate(Math.round(x) + w, 0);
		g.scale(-1, 1);
		g.drawImage(a, 0, Math.round(yBottom - h));
		g.restore();
	} else g.drawImage(a, Math.round(x), Math.round(yBottom - h));
	return w;
}
const RUN_FRAMES = 8;
const RUN_FW = 125;
const RUN_FH = 108;
const runSrc = (i: number) => [i * RUN_FW, 0, RUN_FW, RUN_FH];
/** the reindeer's run, `h` dots tall (its eight run frames at 15 a second) */
function gallop(g: Ctx, x: number, yBottom: number, h: number, t: number): number {
	const w = Math.round((h * RUN_FW) / RUN_FH);
	const fi = Math.floor(t / 66) % RUN_FRAMES;
	const a = art('run_strip', runSrc(fi), w, h);
	g.drawImage(a, Math.round(x), Math.round(yBottom - h));
	return w;
}

// ---- THE AMOUNT: a heavy face per glyph at the dot size, tabular digit cells (the mock's vglyph / drawRow) -------------------
const vgCache = new Map<string, { c: Cv; adv: number }>();
function vglyph(ch: string, cap: number) {
	const key = ch + '|' + cap;
	let g = vgCache.get(key);
	if (g) return g;
	const px = cap / 0.72;
	const font = `900 ${px}px ${LED_FONT}`;
	const pr = mk(4, 4).ctx;
	pr.font = font;
	const adv = Math.ceil(pr.measureText(ch).width);
	const h = Math.ceil(cap * 1.4) + 2;
	const c = mk(adv + 2, h);
	c.ctx.font = font;
	c.ctx.fillStyle = '#fff';
	c.ctx.textBaseline = 'alphabetic';
	c.ctx.fillText(ch, 1, cap + 1);
	const id = c.ctx.getImageData(0, 0, c.width, c.height);
	const d = id.data;
	for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 80 ? 0 : Math.min(255, d[i] * 1.4);
	c.ctx.putImageData(id, 0, 0);
	g = { c, adv };
	vgCache.set(key, g);
	return g;
}
const riCache = new Map<string, { dcell: number; sp: number; cells: number[]; w: number }>();
function rowInfo(str: string, cap: number) {
	const key = str + '|' + cap;
	let r = riCache.get(key);
	if (r) return r;
	const dcell = Math.max(...'0123456789'.split('').map((d) => vglyph(d, cap).adv));
	const sp = Math.max(1, Math.round(cap * 0.07));
	const cells = [...str].map((ch) => (/\d/.test(ch) ? dcell : vglyph(ch, cap).adv));
	const w = cells.reduce((a, b) => a + b, 0) + sp * (cells.length - 1);
	r = { dcell, sp, cells, w };
	if (riCache.size > 2000) riCache.clear();
	riCache.set(key, r);
	return r;
}
function fitCap(str: string, maxW: number, capMax: number) {
	let cap = Math.max(5, Math.floor(capMax));
	while (cap > 5 && rowInfo(str, cap).w > maxW) cap--;
	return cap;
}
let rowTmp: Cv | null = null;
/** style: a color, 'gold', or 'cut' (the glyphs punch unlit dots out of what is under them) */
function drawRow(g: Ctx, str: string, x: number, y: number, cap: number, style: string, pulse = 0): number {
	const ri = rowInfo(str, cap);
	const h = Math.ceil(cap * 1.4) + 2;
	rowTmp ??= mk(8, 8);
	if (rowTmp.width < ri.w + 4 || rowTmp.height < h) {
		rowTmp.width = Math.max(rowTmp.width, ri.w + 4);
		rowTmp.height = Math.max(rowTmp.height, h);
	}
	const t = rowTmp.ctx;
	t.globalCompositeOperation = 'source-over';
	t.clearRect(0, 0, rowTmp.width, rowTmp.height);
	let cx = 0;
	[...str].forEach((ch, i) => {
		const gl = vglyph(ch, cap);
		t.drawImage(gl.c, Math.round(cx + (ri.cells[i] - gl.adv) / 2) - 1, 0);
		cx += ri.cells[i] + ri.sp;
	});
	if (style !== 'cut') {
		t.globalCompositeOperation = 'source-in';
		if (style === 'gold') {
			const gr = t.createLinearGradient(0, 1, 0, cap + 1);
			gr.addColorStop(0, '#fff6b0');
			gr.addColorStop(0.45, '#ffd02a');
			gr.addColorStop(1, '#ff9010');
			t.fillStyle = gr;
		} else t.fillStyle = style;
		t.fillRect(0, 0, ri.w + 4, h);
		if (pulse > 0) {
			t.globalCompositeOperation = 'source-atop';
			t.fillStyle = `rgba(255,255,255,${0.75 * pulse})`;
			t.fillRect(0, 0, ri.w + 4, h);
		}
		t.globalCompositeOperation = 'source-over';
	}
	const op = g.globalCompositeOperation;
	if (style === 'cut') g.globalCompositeOperation = 'destination-out';
	g.drawImage(rowTmp, 0, 0, ri.w + 4, h, Math.round(x), Math.round(y) - 1, ri.w + 4, h);
	g.globalCompositeOperation = op;
	return ri.w;
}
function drawTitle(g: Ctx, str: string, cx: number, y: number, s: number, style: string) {
	const w = textW(str, s);
	const op = g.globalCompositeOperation;
	if (style === 'cut') {
		g.globalCompositeOperation = 'destination-out';
		drawText(g, str, cx - w / 2, y, s, '#000');
	} else drawText(g, str, cx - w / 2, y, s, style);
	g.globalCompositeOperation = op;
}

// ---- LED PICTURE HELPERS -------------------------------------------------------------------------------------------------
const BULBS = ['#ff3a2e', '#36ff74', '#ffd23a', '#4aa8ff'];
function bulb(g: Ctx, x: number, y: number, col: string, on: boolean) {
	g.globalAlpha = on ? 1 : 0.22;
	g.fillStyle = col;
	g.fillRect(x, y - 1, 1, 3);
	g.fillRect(x - 1, y, 3, 1);
	if (on) {
		g.fillStyle = '#fff';
		g.fillRect(x, y, 1, 1);
	}
	g.globalAlpha = 1;
}
const perimCache = new Map<string, number[][]>();
function perimeter(W: number, H: number, inset: number, step: number): number[][] {
	const key = `${W}x${H}|${inset}|${step}`;
	let pts = perimCache.get(key);
	if (pts) return pts;
	pts = [];
	for (let x = inset; x < W - inset; x += step) pts.push([x, inset]);
	for (let y = inset + step; y < H - inset; y += step) pts.push([W - 1 - inset, y]);
	for (let x = W - 1 - inset - step; x >= inset; x -= step) pts.push([x, H - 1 - inset]);
	for (let y = H - 1 - inset - step; y > inset; y -= step) pts.push([inset, y]);
	perimCache.set(key, pts);
	return pts;
}
function chaseBorder(g: Ctx, W: number, H: number, t: number, cols: string[], thick: number, seg: number) {
	const n = Math.floor(t / 60);
	for (let k = 0; k < thick; k++) {
		const pts = perimeter(W, H, k, 1);
		for (let i = 0; i < pts.length; i++) {
			g.fillStyle = cols[Math.floor((i + n) / seg) % cols.length];
			g.fillRect(pts[i][0], pts[i][1], 1, 1);
		}
	}
}
function sparkles(g: Ctx, W: number, H: number, t: number, n: number, cols: string[], seed: number) {
	for (let k = 0; k < n; k++) {
		const per = 900 + hash(k + seed) * 700;
		const cyc = Math.floor((t + k * 137) / per);
		const p = (t + k * 137) / per - cyc;
		const x = Math.floor(hash(k * 13 + cyc * 7.3 + seed) * W);
		const y = Math.floor(hash(k * 29 + cyc * 3.1 + seed) * H);
		const a = Math.sin(Math.PI * p);
		g.globalAlpha = a;
		const col = cols[k % cols.length];
		dot(g, x, y, col);
		if (a > 0.7) {
			dot(g, x - 1, y, col);
			dot(g, x + 1, y, col);
			dot(g, x, y - 1, col);
			dot(g, x, y + 1, col);
		}
	}
	g.globalAlpha = 1;
}
function snowDots(g: Ctx, W: number, H: number, t: number, n: number, col = '#dff3ff') {
	g.globalAlpha = 0.55;
	g.fillStyle = col;
	for (let k = 0; k < n; k++) {
		const x = (hash(k * 7.7) * W + Math.sin(t / 900 + k) * 2 + W) % W;
		const y = (hash(k * 1.9) * H + t * (0.006 + hash(k) * 0.01)) % H;
		g.fillRect(Math.round(x), Math.round(y), 1, 1);
	}
	g.globalAlpha = 1;
}

/** THE FIVE TIER LOOKS (rounds 1 and 2, kept): the background (animated) and the inks */
type Look = { title: string; num: string; sweep: string; bg: (g: Ctx, W: number, H: number, t: number) => void };
const LOOK: Look[] = [
	{
		// BIG: green chevrons scrolling right
		title: '#36ff74',
		num: '#ffffff',
		sweep: '#36ff74',
		bg(g, W, H, t) {
			const h = Math.max(6, Math.round(H * 0.34));
			const sp = Math.round(h * 0.9);
			const off = (t * 0.045) % sp;
			g.strokeStyle = 'rgba(54,255,116,0.30)';
			g.lineWidth = Math.max(1.5, h * 0.16);
			g.beginPath();
			for (let row = 0; row < 3; row++) {
				const cy = (row + 0.5) * (H / 3);
				for (let x = -sp + off; x < W + sp; x += sp) {
					g.moveTo(x, cy - h * 0.42);
					g.lineTo(x + h * 0.42, cy);
					g.lineTo(x, cy + h * 0.42);
				}
			}
			g.stroke();
		},
	},
	{
		// SUPER: blue snowfall and a sparkle field
		title: '#7cc4ff',
		num: '#ffffff',
		sweep: '#4aa8ff',
		bg(g, W, H, t) {
			g.fillStyle = 'rgba(30,90,220,0.16)';
			g.fillRect(0, 0, W, H);
			const n = Math.round((W * H) / 90);
			for (let k = 0; k < n; k++) {
				const sp = 0.008 + hash(k * 3.3) * 0.02;
				const x = (hash(k * 7.7) * W + Math.sin(t / 700 + k) * 2 + W) % W;
				const y = (hash(k * 1.9) * H + t * sp) % H;
				g.globalAlpha = 0.35 + 0.65 * hash(k + Math.floor(t / 250));
				dot(g, x, y, k % 3 ? '#cfe8ff' : '#4aa8ff');
			}
			g.globalAlpha = 1;
		},
	},
	{
		// MEGA: red glow, a red and gold marquee chase border
		title: '#ff4a3a',
		num: 'gold',
		sweep: '#ff3a2e',
		bg(g, W, H, t) {
			const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55);
			gr.addColorStop(0, `rgba(255,40,30,${0.22 + 0.06 * Math.sin(t / 160)})`);
			gr.addColorStop(1, 'rgba(255,40,30,0)');
			g.fillStyle = gr;
			g.fillRect(0, 0, W, H);
			chaseBorder(g, W, H, t, ['#ff3a2e', '#ffd23a'], H >= 30 ? 2 : 1, 4);
			sparkles(g, W, H, t, Math.round(W / 14), ['#ffd23a'], 3);
		},
	},
	{
		// EPIC: Mega's red and gold, strings of twinkling bulbs
		title: '#ffd23a',
		num: 'gold',
		sweep: '#ffd23a',
		bg(g, W, H, t) {
			const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55);
			gr.addColorStop(0, 'rgba(255,40,30,0.2)');
			gr.addColorStop(1, 'rgba(255,40,30,0)');
			g.fillStyle = gr;
			g.fillRect(0, 0, W, H);
			const step = H >= 30 ? 6 : 4;
			const ins = H >= 30 ? 2 : 1;
			const pts = perimeter(W, H, ins, step);
			pts.forEach(([x, y], i) => bulb(g, x, y, BULBS[i % 4], hash(i * 5.1 + Math.floor(t / 180 + hash(i) * 3)) > 0.3));
			sparkles(g, W, H, t, Math.round(W / 10), ['#ffd23a', '#ffffff'], 9);
		},
	},
	{
		// MAX: the warning yellow face, hazard stripes chasing top and bottom (black words: 'cut' punches them out)
		title: 'cut',
		num: 'cut',
		sweep: '#ffe600',
		bg(g, W, H, t) {
			g.fillStyle = '#ffd60a';
			g.fillRect(0, 0, W, H);
			const bh = H >= 30 ? Math.max(4, Math.round(H * 0.1)) : 2;
			const sw = Math.max(3, bh);
			const off = Math.floor(t / 40);
			for (const y0 of [0, H - bh])
				for (let y = y0; y < y0 + bh; y++) {
					const m = (y + off) % (2 * sw);
					for (let x = -m; x < W; x += 2 * sw) g.clearRect(x, y, sw, 1);
				}
		},
	},
];

// ---- THE WIN'S PLACE ON A FACE (cached): stacked (title over amount), one row, or a two line tag (a short strip) ------------
type WinLay = { stacked: boolean; tag?: boolean; m: number; ts: number; titleX?: number; titleY: number; numX?: number; numW?: number; numY: number; cap: number; cx?: number };
const wlCache = new Map<string, WinLay>();
function winLayout(W: number, H: number, finalStr: string, titles: string[]): WinLay {
	const key = W + 'x' + H + '|' + finalStr + '|' + titles.join(',');
	let r = wlCache.get(key);
	if (r) return r;
	const m = H >= 30 ? 4 : 2;
	let stacked: WinLay | null = null;
	if (H >= 22) {
		let ts = 1;
		for (const s of [5, 4, 3, 2, 1])
			if (Math.max(...titles.map((x) => textW(x, s))) <= W - 2 * m - 6 && 7 * s <= H * 0.24) {
				ts = s;
				break;
			}
		const tH = 7 * ts;
		const gap = Math.max(2, Math.round(H * 0.06));
		const cap = fitCap(finalStr, W - 2 * m - 8, Math.min(H - 2 * m - tH - gap - 3, H * 0.5));
		const bh = tH + gap + cap;
		const y0 = Math.round((H - bh) / 2);
		stacked = { stacked: true, m, ts, titleY: y0, numY: y0 + tH + gap, cap, cx: W / 2 };
	}
	let row: WinLay | null = null;
	for (const ts of H >= 30 ? [2, 1] : [1]) {
		const tw = Math.max(...titles.map((x) => textW(x, ts)));
		let cap = Math.min(H - 2 * m - 1, Math.round(H * 0.8));
		while (cap > 5 && tw + 8 + rowInfo(finalStr, cap).w > W - 2 * m - 4) cap--;
		if (row && row.cap >= cap) continue;
		const total = tw + 8 + rowInfo(finalStr, cap).w;
		const x0 = Math.round((W - total) / 2);
		row = { stacked: false, m, ts, titleX: x0 + tw / 2, titleY: Math.round((H - 7 * ts) / 2), numX: x0 + tw + 8, numW: rowInfo(finalStr, cap).w, numY: Math.round((H - cap) / 2), cap };
	}
	// r3b: on a strip, the title as a two line tag (SUPER over WIN) beside the number, so the number takes the full height
	let tag: WinLay | null = null;
	if (H < 45 && W / H > 5 && H >= 16) {
		for (const ts of [2, 1]) {
			const words = titles.flatMap((x) => x.split(' '));
			const tw = Math.max(...words.map((x) => textW(x, ts)));
			const th = 14 * ts + Math.max(1, ts);
			if (th > H - 2 * m) continue;
			let cap = H - 2 * m - 1;
			while (cap > 5 && tw + 6 + rowInfo(finalStr, cap).w > W - 2 * m - 4) cap--;
			if (tag && tag.cap >= cap) continue;
			const total = tw + 6 + rowInfo(finalStr, cap).w;
			const x0 = Math.round((W - total) / 2);
			tag = { stacked: false, tag: true, m, ts, titleX: x0 + tw / 2, titleY: Math.round((H - th) / 2), numX: x0 + tw + 6, numW: rowInfo(finalStr, cap).w, numY: Math.round((H - cap) / 2), cap };
		}
	}
	r = stacked && row && stacked.cap >= row.cap * 0.85 ? stacked : (row ?? stacked!);
	if (tag && tag.cap > r.cap) r = tag;
	if (wlCache.size > 200) wlCache.clear();
	wlCache.set(key, r);
	return r;
}
function drawLayTitle(g: Ctx, lay: WinLay, str: string, style: string, W: number) {
	if (lay.tag) {
		const words = str.split(' ');
		const th = 7 * lay.ts;
		const gap = Math.max(1, lay.ts);
		const y0 = words.length > 1 ? lay.titleY : Math.round(lay.titleY + (th + gap) / 2);
		words.slice(0, 2).forEach((w, i) => drawTitle(g, w, lay.titleX!, y0 + i * (th + gap), lay.ts, style));
	} else drawTitle(g, str, lay.stacked ? lay.cx! : lay.titleX || W / 2, lay.titleY, lay.ts, style);
}
/** where the amount row starts: centred on its own width, with the house slide when the row widens */
function numX(lay: WinLay, W: number, str: string, slide: number) {
	const w = rowInfo(str, lay.cap).w;
	if (!lay.stacked) return lay.numX! + (lay.numW! - w) / 2 + slide;
	const x = (W - w) / 2 + slide;
	return clamp(x, lay.m + 1, W - lay.m - 1 - w);
}
const titles = () => LED_BOARD.tiers.map((x) => x.title);
function slideAt(s: Show, lay: WinLay) {
	let off = 0;
	for (const w of s.widen) {
		const dt = s.t - w.at;
		if (dt >= 0 && dt < 180) off = ((rowInfo(w.to, lay.cap).w - rowInfo(w.from, lay.cap).w) / 2) * (1 - ease(dt / 180));
	}
	return off;
}

// ---- THE WIN (one face: the strip's line or the back board) -------------------------------------------------------------------
function drawWinScene(g: Ctx, W: number, H: number, s: Show, tier: number, str: string, slide: number, pulse: number) {
	const look = LOOK[tier];
	look.bg(g, W, H, s.t);
	const lay = winLayout(W, H, s.finalStr, titles());
	const title = LED_BOARD.tiers[tier].title;
	// part A: a plain title (part B: the bouncing block letters and the staged scenes)
	if (lay.stacked) drawTitle(g, title, lay.cx!, lay.titleY, lay.ts, look.title);
	else drawLayTitle(g, lay, title, look.title, W);
	if (tier === 4 && pulse > 0) {
		g.globalCompositeOperation = 'source-atop';
		g.fillStyle = `rgba(255,255,255,${0.5 * pulse})`;
		g.fillRect(0, 0, W, H);
		g.globalCompositeOperation = 'source-over';
	}
	drawRow(g, str, numX(lay, W, str, slide), lay.numY, lay.cap, look.num, pulse);
}
/** a win's face at its time: the tier's look, the title, the counting amount; at a tier change the new tier sweeps in
 *  from the left behind a bright edge */
export function showWin(F: Face, s: Show) {
	const W = F.dotsW;
	const H = F.dotsH;
	const o = F.out.ctx;
	const tier = Math.max(0, tierNow(s));
	const str = s.fmt(amountNow(s));
	const lay = winLayout(W, H, s.finalStr, titles());
	const slide = slideAt(s, lay);
	const ev = s.events.find((e) => e.tier === tier);
	const since = ev ? s.t - ev.at : 1e9;
	const pulse = tier > 0 ? 1 - clamp(since / LED_BOARD.pulseMs, 0, 1) : 0;
	if (tier > 0 && since < LED_BOARD.sweepMs) {
		const a = F.a.ctx;
		const b = F.b.ctx;
		a.clearRect(0, 0, W, H);
		b.clearRect(0, 0, W, H);
		const before = [...s.events].reverse().find((e) => e.tier < tier && e.at <= s.t)?.tier ?? 0;
		drawWinScene(a, W, H, s, before, str, slide, 0);
		drawWinScene(b, W, H, s, tier, str, slide, pulse);
		const sx = Math.round(ease(since / LED_BOARD.sweepMs) * (W + 6)) - 3;
		o.clearRect(0, 0, W, H);
		o.drawImage(F.a, 0, 0);
		if (sx > 0) {
			o.clearRect(0, 0, sx, H);
			o.drawImage(F.b, 0, 0, sx, H, 0, 0, sx, H);
		}
		o.fillStyle = LOOK[tier].sweep;
		o.globalAlpha = 0.9;
		o.fillRect(sx, 0, 2, H);
		o.fillStyle = '#ffffff';
		o.globalAlpha = 0.95;
		o.fillRect(sx + 2, 0, 1, H);
		o.globalAlpha = 1;
	} else {
		o.clearRect(0, 0, W, H);
		drawWinScene(o, W, H, s, tier, str, slide, pulse);
	}
}
/** the back board's flashing border while a big count runs */
export function countBorder(F: Face, s: Show) {
	if (s.t >= s.countEnd || Math.floor(s.t / 120) % 2 === 0) return;
	const g = F.out.ctx;
	const W = F.dotsW;
	const H = F.dotsH;
	g.fillStyle = '#ffffff';
	g.globalAlpha = 0.5;
	g.fillRect(0, 0, W, 1);
	g.fillRect(0, H - 1, W, 1);
	g.fillRect(0, 0, 1, H);
	g.fillRect(W - 1, 0, 1, H);
	g.globalAlpha = 1;
}
/** a tier change on the strip (Big, Super): confetti in the tier's colors bursts from the amount */
export function stripFlourish(F: Face, s: Show) {
	const g = F.out.ctx;
	const W = F.dotsW;
	const H = F.dotsH;
	for (const e of s.events) {
		const dt = s.t - e.at;
		if (dt < 0 || dt > 700) continue;
		const col = e.tier === 0 ? ['#36ff74', '#ffffff'] : e.tier === 1 ? ['#4aa8ff', '#ffffff'] : ['#ffd23a', '#ff3a2e'];
		for (let k = 0; k < 40; k++) {
			const a = hash(k * 3.3 + e.tier) * Math.PI * 2;
			const r = (dt / 700) * W * 0.25 * (0.4 + hash(k * 1.7) * 0.6);
			g.globalAlpha = 1 - dt / 700;
			dot(g, W * 0.6 + Math.cos(a) * r, H / 2 + Math.sin(a) * r * 0.5, col[k % 2]);
		}
		g.globalAlpha = 1;
	}
}

/** THE SMALL WIN (under the Big bar): WIN and the amount, then the reindeer hops across and the dots clap */
export function showSmall(F: Face, s: Show) {
	const g = F.out.ctx;
	const W = F.dotsW;
	const H = F.dotsH;
	g.clearRect(0, 0, W, H);
	const lay = winLayout(W, H, s.finalStr, ['WIN']);
	const str = s.fmt(amountNow(s));
	drawLayTitle(g, lay, 'WIN', '#7cc4ff', W);
	drawRow(g, str, numX(lay, W, str, 0), lay.numY, lay.cap, '#ffffff', s.t >= s.countEnd ? 1 - clamp((s.t - s.countEnd) / 300, 0, 1) : 0);
	if (s.t > s.countEnd) {
		const p = clamp((s.t - s.countEnd) / 1300, 0, 1);
		const h = Math.round(H * 0.7);
		gallop(g, -h * 1.3 + p * (W + h * 2.6), H - 1 - Math.abs(Math.sin(p * Math.PI * 4)) * H * 0.25, h, s.t);
		sparkles(g, W, H, s.t, Math.round(W / 10), ['#ffd23a', '#ffffff'], 31);
	}
}

/** THE BONUS ROUND'S COUNTER on the strip: FREE SPINS and the spins left (the number rolls when it changes), and after
 *  each spin a reindeer dashes across */
export function showCounter(F: Face, clock: number, left: number, changedAt: number) {
	const W = F.dotsW;
	const H = F.dotsH;
	const g = F.out.ctx;
	g.clearRect(0, 0, W, H);
	g.fillStyle = 'rgba(40,120,255,0.12)';
	g.fillRect(0, 0, W, H);
	chaseBorder(g, W, H, clock, ['#36ff74', '#ffffff', '#ff3a2e', '#ffffff'], 1, 3);
	const since = clock - changedAt;
	const roll = clamp(since / 220, 0, 1);
	const str = left + ' LEFT';
	const m = 2;
	let best: { ts: number; tw: number; cap: number } | null = null;
	for (const t of H >= 18 ? [1, 2] : [1]) {
		const w = textW('FREE SPINS', t);
		let c = H - 2 * m - 1;
		while (c > 5 && w + 8 + rowInfo('10 LEFT', c).w > W - 2 * m - 4) c--;
		if (!best || c > best.cap) best = { ts: t, tw: w, cap: c };
	}
	const { ts, tw, cap } = best!;
	const total = tw + 8 + rowInfo(str, cap).w;
	const x0 = Math.round((W - total) / 2);
	drawTitle(g, 'FREE SPINS', x0 + tw / 2, Math.round((H - 7 * ts) / 2), ts, '#7cc4ff');
	drawRow(g, str, x0 + tw + 8, Math.round((H - cap) / 2), cap, '#ffffff', roll < 1 && since >= 0 ? 1 - roll : 0);
	const dt = since;
	if (dt >= 0 && dt < LED_BOARD.dashMs) {
		const h = Math.round(H * 0.8);
		gallop(g, -h * 1.3 + (dt / LED_BOARD.dashMs) * (W + h * 2.6), H - 1, h, dt);
	}
}

// ---- THE RACE (decoration only; game/scoreboard/race.ts) ------------------------------------------------------------------------
/** the race in a box (x0..x0+W, bottom yB, sprite height h); returns the finish line's x */
function drawRace(g: Ctx, race: Race, t: number, x0: number, W: number, yB: number, h: number): number {
	const rw = Math.round((h * RUN_FW) / RUN_FH);
	const cw = Math.round(h * 1.6);
	const startX = x0 + 2;
	const finishX = x0 + W - 4;
	// the finish line: a checkered post
	for (let y = yB - h - 1; y <= yB; y++) {
		dot(g, finishX, y, y % 2 ? '#ffffff' : '#202020');
		dot(g, finishX + 1, y, y % 2 ? '#202020' : '#ffffff');
	}
	const { r, c } = raceProgress(race, t);
	// the nose of each racer runs from the start line to the finish line (the police car faces left in the art: mirrored)
	const len = finishX - startX;
	sprite(g, 'H4', startX - cw + c * len, yB, h, true);
	gallop(g, startX - rw + r * len, yB, h, t);
	return finishX;
}
/** the result card: WINNER with the winner's dot portrait and a flashing border; a tie is PHOTO FINISH, then TIE */
function raceCard(g: Ctx, race: Race, W: number, H: number, ct: number) {
	g.clearRect(0, 0, W, H);
	chaseBorder(g, W, H, ct, race.outcome === 'tie' ? ['#ffffff', '#202020'] : ['#ffd23a', '#ff3a2e'], 1, 3);
	const s = H >= 22 ? 2 : 1;
	const ph = Math.round(H * 0.82);
	if (race.outcome === 'tie') {
		if (ct < 900) {
			if (Math.floor(ct / 120) % 2) {
				g.fillStyle = '#ffffff';
				g.globalAlpha = 0.5;
				g.fillRect(1, 1, W - 2, H - 2);
				g.globalAlpha = 1;
			}
			drawTitle(g, 'PHOTO FINISH', W / 2, Math.round((H - 7 * s) / 2), s, '#ffffff');
		} else {
			const tw = textW('TIE', s);
			const tot = ph * 1.1 + 8 + tw + 8 + ph * 1.6;
			const x = Math.round((W - tot) / 2);
			sprite(g, 'reindeer_col', x, H - 2, ph);
			drawTitle(g, 'TIE', x + ph * 1.1 + 8 + tw / 2, Math.round((H - 7 * s) / 2), s, '#ffd23a');
			sprite(g, 'H4', x + ph * 1.1 + 16 + tw, H - 2, ph * 0.8, true);
		}
		return;
	}
	const name = race.outcome === 'reindeer' ? 'REINDEER' : 'POLICE CAR';
	const line = 'WINNER';
	const tw = Math.max(textW(name, 1), textW(line, s));
	const portW = race.outcome === 'reindeer' ? ph * 0.6 : ph * 1.6;
	const tot = portW + 10 + tw;
	const x = Math.round((W - tot) / 2);
	const bob = Math.round(Math.abs(Math.sin(ct / 180)) * -2);
	if (race.outcome === 'reindeer') sprite(g, 'reindeer_col', x, H - 2 + bob, ph);
	else sprite(g, 'H4', x, H - 2 + bob, ph * 0.75, true);
	const tx = x + portW + 10 + tw / 2;
	if (H >= 22) {
		const blockH = 7 * s + 3 + 7;
		const y0 = Math.round((H - blockH) / 2);
		if (Math.floor(ct / 250) % 4 !== 3) drawTitle(g, line, tx, y0, s, '#ffd23a');
		drawTitle(g, name, tx, y0 + 7 * s + 3, 1, '#ffffff');
	} else drawTitle(g, name + ' ' + line, W / 2 + portW / 2, Math.round((H - 7) / 2), 1, '#ffd23a');
}

// ---- THE SIX IDLE CARTOONS (the mock's, each a pure function of its own time; the race keeps its run in `race`) ---------------
export type CartoonState = { race: Race | null; raceFor: number; raceNext: Race | null };
export type Cartoon = { key: 'trot' | 'parade' | 'plow' | 'sleigh' | 'peek' | 'race'; name: string; ms: () => number; draw: (g: Ctx, W: number, H: number, t: number, st: CartoonState, at: number) => void };
export const CARTOONS: Cartoon[] = [
	{
		key: 'trot',
		name: 'The reindeer trots in, stops to sniff the snow, trots off',
		ms: () => 5200,
		draw(g, W, H, t) {
			snowDots(g, W, H, t, Math.round((W * H) / 90));
			const h = H - 2;
			const cx = W * 0.42;
			const w = Math.round((h * RUN_FW) / RUN_FH);
			if (t < 1700) gallop(g, -w + (cx + w) * (t / 1700), H - 1, h, t);
			else if (t < 3400) {
				const sn = Math.floor((t - 1700) / 260) % 2;
				const sw = sprite(g, 'reindeer_col', cx + 6, H - 1 + sn, h + 2);
				if (sn) for (let i = 0; i < 3; i++) dot(g, cx + 6 + sw * 0.65 + i * 2, H - 3 - i, '#ffffff');
			} else gallop(g, cx + (W - cx + w) * ((t - 3400) / 1800), H - 1, h, t);
		},
	},
	{
		key: 'parade',
		name: 'Traffic parade: the wagon, the van, the police car and Grandma drive through',
		ms: () => 5600,
		draw(g, W, H, t) {
			const h = Math.round(H * 0.82);
			const cars: ArtName[] = ['H2', 'H3', 'H4', 'car'];
			let x = W - (t / 5600) * (W + cars.length * h * 2.3);
			for (const c of cars) {
				const w = sprite(g, c, x, H - 1, c === 'car' ? h * 0.9 : h);
				if (x + w < W && x > 0) dot(g, x + w + 1, H - 3, '#9aa6b3');
				x += w + h * 0.6;
			}
			for (let i = 0; i < W; i += 6) dot(g, (i + Math.floor(t / 40)) % W, H - 1, '#ffd23a');
		},
	},
	{
		key: 'plow',
		name: 'Snow falls and piles up, then the OH-KAY van plows it off',
		ms: () => 6000,
		draw(g, W, H, t) {
			snowDots(g, W, H, t, Math.round((W * H) / 40), '#ffffff');
			const pileMax = Math.round(H * 0.45);
			const grow = clamp(t / 3800, 0, 1);
			const vanX = t < 3800 ? W + 10 : W - ((t - 3800) / 2200) * (W + H * 3);
			g.fillStyle = '#e8f4ff';
			for (let x = 0; x < W; x++) {
				if (x > vanX + H * 1.4) continue;
				const ph = Math.round(pileMax * grow * (0.6 + 0.4 * Math.sin(x * 0.21) * Math.sin(x * 0.07 + 1)));
				if (ph > 0) g.fillRect(x, H - ph, 1, ph);
			}
			if (t >= 3800) {
				sprite(g, 'H3', vanX, H - 1, Math.round(H * 0.85));
				for (let i = 0; i < 6; i++) dot(g, vanX - 2 - hash(i + Math.floor(t / 80)) * 6, H - 4 - hash(i * 3 + Math.floor(t / 80)) * H * 0.6, '#ffffff');
			}
		},
	},
	{
		key: 'sleigh',
		// r3b: the sleigh art faces left, so it is mirrored to face the way it travels, the reindeer in front pulling it
		name: "Santa's sleigh slides by, pulled by the reindeer, sparkles behind",
		ms: () => 4600,
		draw(g, W, H, t) {
			const h = Math.round(H * 0.9);
			const rw = Math.round((h * RUN_FW) / RUN_FH);
			const sw = Math.round(h * 1.37);
			const x = -rw - sw + (t / 4600) * (W + rw * 2 + sw * 2);
			const sx = sprite(g, 'sleigh', x, H - 1, h, true);
			gallop(g, x + sx + 2, H - 1, h, t);
			for (let i = 0; i < 14; i++) {
				const px = x - i * 3 - hash(i) * 4;
				g.globalAlpha = 1 - i / 14;
				dot(g, px, H - 2 - hash(i * 3 + Math.floor(t / 90)) * h * 0.8, i % 2 ? '#ffd23a' : '#ffffff');
			}
			g.globalAlpha = 1;
		},
	},
	{
		key: 'peek',
		name: 'Grandma cruises through; the reindeer peeks out after her and ducks',
		ms: () => 5200,
		draw(g, W, H, t) {
			const h = Math.round(H * 0.85);
			const x = W - (t / 3000) * (W + h * 2);
			if (t < 3200) sprite(g, 'car', x, H - 1, h);
			const pk = t < 2000 ? 0 : t < 2500 ? (t - 2000) / 500 : t < 4000 ? 1 : t < 4400 ? 1 - (t - 4000) / 400 : 0;
			if (pk > 0) {
				const [sw, shh] = size('reindeer_col', null);
				const headSrc = [0, 0, sw, shh * 0.42];
				const hh = Math.round(H * 0.95);
				const y = H - 1 + hh * (1 - pk) * 0.95;
				sprite(g, 'reindeer_col', W * 0.72, y, hh, Math.floor(t / 400) % 2 === 1, headSrc);
			}
		},
	},
	{
		key: 'race',
		name: 'The great race: the reindeer against the police car, a random result each run',
		ms: () => LED_BOARD.race.runMs + LED_BOARD.race.cardMs,
		draw(g, W, H, t, st, at) {
			if (!st.race || st.raceFor !== at) {
				st.race = st.raceNext ?? newRace();
				st.raceNext = null;
				st.raceFor = at;
			}
			if (t < LED_BOARD.race.runMs + 150) {
				for (let x = 0; x < W; x += 4) dot(g, x, H - 1, Math.floor(x / 4) % 2 ? '#ffffff' : '#404040');
				drawRace(g, st.race, t, 0, W, H - 2, Math.round(H * 0.78));
			} else raceCard(g, st.race, W, H, t - LED_BOARD.race.runMs - 150);
		},
	},
];
export function showCartoon(F: Face, idx: number, t: number, st: CartoonState, at: number) {
	const g = F.out.ctx;
	g.clearRect(0, 0, F.dotsW, F.dotsH);
	CARTOONS[idx].draw(g, F.dotsW, F.dotsH, t, st, at);
}

// ---- THE GRANDMA GAG (Corey's line, exactly; constants LED_BOARD.gag) -------------------------------------------------------
function burst(g: Ctx, cx: number, cy: number, p: number, rMax: number) {
	if (p <= 0 || p >= 1) return;
	const r = rMax * ease(p * 1.4);
	const fade = 1 - span(p, 0.45, 1);
	for (let k = 0; k < 10; k++) {
		const a = (k / 10) * Math.PI * 2 + 0.3;
		for (let i = Math.max(1, Math.floor(r * 0.45)); i <= r; i++) {
			g.globalAlpha = fade;
			dot(g, cx + Math.cos(a) * i, cy + Math.sin(a) * i * 0.85, i > r * 0.75 ? '#ffffff' : '#ffe95a');
		}
	}
	g.globalAlpha = 1;
}
/** block letters drop in one after another and bounce once */
function marchText(g: Ctx, str: string, W: number, H: number, s: number, t: number, col: string) {
	const total = textW(str, s);
	const x0 = Math.round((W - total) / 2);
	const y0 = Math.round((H - 7 * s) / 2);
	let x = x0;
	[...str].forEach((ch, i) => {
		const w = textW(ch, s);
		const lt = t - i * 40;
		if (lt > 0) {
			const dy = lt < 160 ? -Math.round((1 - ease(lt / 160)) * H * 0.6) : lt < 260 ? Math.round(Math.sin(((lt - 160) / 100) * Math.PI) * 1.5) : 0;
			drawText(g, ch, x, y0 + dy, s, col);
		}
		x += w + s;
	});
}
/** the gag at its time t: the first words pulse (a crowd beat), the reindeer and Grandma's car meet with a burst of dots,
 *  then the line marches in, in two parts */
export function showGag(F: Face, t: number) {
	const g = F.out.ctx;
	const W = F.dotsW;
	const H = F.dotsH;
	const G = LED_BOARD.gag;
	g.clearRect(0, 0, W, H);
	const longest = [G.first, G.second, G.third].reduce((a, b) => (textW(b, 2) > textW(a, 2) ? b : a));
	const s = textW(longest, 2) <= W - 4 && H >= 15 ? 2 : 1;
	chaseBorder(g, W, H, t, ['#ffd23a', '#202020'], 1, 3);
	const t1 = G.firstMs;
	const t2 = t1 + G.bumpMs;
	const t3 = t2 + G.secondMs;
	if (t < t1) {
		g.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(t / 110));
		marchText(g, G.first, W, H, s, t, '#ffffff');
		g.globalAlpha = 1;
	} else if (t < t2) {
		// the bump: the reindeer and Grandma's car meet in the middle, a star of dots
		const u = (t - t1) / G.bumpMs;
		const h = Math.round(H * 0.85);
		const mid = W / 2;
		const meet = Math.min(1, u / 0.55);
		const rw = Math.round((h * RUN_FW) / RUN_FH);
		gallop(g, -rw + (mid - rw * 0.7 + rw) * meet - (u > 0.55 ? (u - 0.55) * 30 : 0), H - 1, h, t);
		sprite(g, 'car', W - (W - mid - 2) * meet + (u > 0.55 ? (u - 0.55) * 40 : 0), H - 1 - (u > 0.55 ? Math.sin((u - 0.55) * 7) * 3 : 0), h * 0.9);
		if (u > 0.5) burst(g, mid, H / 2, (u - 0.5) / 0.5, Math.round(H * 0.6));
	} else if (t < t3) marchText(g, G.second, W, H, s, t - t2, '#ffffff');
	else marchText(g, G.third, W, H, s, t - t3, '#ffd23a');
}
/** which words the gag shows at its time t (the probe reads it) */
export const gagWordsAt = (t: number): string => {
	const G = LED_BOARD.gag;
	if (t < G.firstMs) return G.first;
	if (t < G.firstMs + G.bumpMs) return '';
	if (t < G.firstMs + G.bumpMs + G.secondMs) return G.second;
	return G.third;
};

/** the dots' power on at the back board's seat: they light row by row behind a bright scan line */
export function scanReveal(F: Face, u: number) {
	if (u >= 1) return;
	const o = F.out.ctx;
	const y = Math.round(u * F.dotsH);
	o.clearRect(0, y + 1, F.dotsW, F.dotsH - y);
	o.fillStyle = 'rgba(255,255,255,0.9)';
	o.fillRect(0, y, F.dotsW, 1);
}
/** the press screen's dot noise ops, on a face: the power down (the dots go out at random), the dissolve between two lines */
export function powerOffFace(F: Face, e: number) {
	if (e <= 0) return;
	const o = F.out.ctx;
	const A = o.getImageData(0, 0, F.dotsW, F.dotsH);
	const D = A.data;
	const n = F.noise;
	for (let i = 0; i < n.length; i++) if (n[i] < e) D[i * 4 + 3] = 0;
	o.putImageData(A, 0, 0);
}
export function dissolveFace(F: Face, e: number) {
	const W = F.dotsW;
	const H = F.dotsH;
	e = clamp(e, 0, 1);
	const A = F.a.ctx.getImageData(0, 0, W, H);
	const B = F.b.ctx.getImageData(0, 0, W, H);
	const D = A.data;
	const E = B.data;
	const n = F.noise;
	for (let i = 0; i < n.length; i++) {
		const j = i * 4;
		if (n[i] < e - 0.05) {
			D[j] = E[j];
			D[j + 1] = E[j + 1];
			D[j + 2] = E[j + 2];
			D[j + 3] = E[j + 3];
		} else if (n[i] < e) {
			D[j] = 255;
			D[j + 1] = 250;
			D[j + 2] = 235;
			D[j + 3] = 230;
		}
	}
	F.out.ctx.putImageData(A, 0, 0);
}

