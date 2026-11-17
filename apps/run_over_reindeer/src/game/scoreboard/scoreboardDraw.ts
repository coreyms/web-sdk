// THE LED SCOREBOARD'S PICTURES (Corey's approved mock bigwin_led_r3_2026-11-16 "r3b": its drawing code, ported). Everything
// here draws on a small 2D canvas at ONE PIXEL PER DOT; the scoreboard (game/scoreboard/scoreboard.ts) shows those canvases
// through the dot grille. Plain 2D canvas drawing (composite modes on small canvases), no filter.
//   the words    the 5 x 7 dot font of the press screen (game/landing/ledScreens.ts: textW, drawText; EPX at 2x, the game's
//                Overpass Heavy snapped to the dots from 3x up) and the amount's own row: a heavy face per glyph at the dot
//                size with tabular digit cells (the mock's vglyph / drawRow)
//   the pictures one small sheet of the game's own art (tools/build_scoreboard_art.py), stepped down to the dot size with
//                the LED punch, baked once per size (CPU canvases, never textures)
//   the programs the five tier looks, the win line (title and counting amount), the small win, the bonus round's counter,
//                the six idle cartoons, the race and its result card, the Grandma gag; part B (2026-11-17): the back board's
//                staged scenes (the Free Spins and Super entries, the Total Win, the Mega, Epic and Max bottom bands) and the
//                strip's line while a card is up, from the mock's r3b scene code
import { SCOREBOARD_ART } from '../scoreboardArtSpec';
import { LED_FONT, drawText, letterGap, mk, textInk, textW, type Cv } from '../landing/ledScreens';
import { INTRO_LINE, LED_BOARD } from '../constants';
import { amountNow, tierNow, type Show } from './show';
import { newRace, raceProgress, type Race } from './race';

/** the Max scene's races, one run after another, per show (decoration only: the race's own random source) */
const maxRaces = new WeakMap<Show, Map<number, Race>>();

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
// ---- THE BACK BOARD'S TITLES (2026-11-17): set by their drawn dots, the tune knobs per layout class -------------------------
// Measured on 2026-11-17 (column_border_fix NOTES): the bouncing and the marching letters are set one by one a whole dot
// scale apart (plus the 2 dot pad of each letter's mask from the 3x size up), but they were centered on the width of the
// word's own mask, which sets them only 0.45 of a scale apart: the drawn word was wider than the width it was centered on
// and ran 12 to 16 dots off to the right (MEGA WIN on an upright phone to the board's right edge, SUPER WIN past it). Each
// title is now centered on its lit dots as drawn; its letters keep their spacing where the title fits the face less its
// margins, and close up (down to the word's own gap, no further) only as far as it takes to fit.
export type BoardClass = 'desktop' | 'phone' | 'portrait';
let boardClass: BoardClass = 'desktop';
/** the layout class the back board is drawn for (game/scoreboard/scoreboard.ts layout; a tablet takes the desktop's) */
export const setBoardClass = (cls: string) => {
	boardClass = cls === 'phone' ? 'phone' : cls === 'portrait' ? 'portrait' : 'desktop';
};
const titleKnobs = () => LED_BOARD.titles[boardClass];
/** the dots added between a title and its amount, and the bounce's strength (LED_BOARD.titles, live) */
const titleGapKnob = () => Math.round(LED_BOARD.titles.gap);
const bounceK = () => Math.max(0, LED_BOARD.titles.bounce);
/** the dots kept clear between a title's lit dots and the face's left and right edges (the chase border and two dots) */
const TITLE_MARGIN = 4;
/** a line set letter by letter `gap` dots apart (each letter's mask at its own width): its letters' places from the first
 *  mask's start, and its lit dots' left edge, width, top and bottom from there */
const setLine = (str: string, s: number, gap: number) => {
	const xs: number[] = [];
	let x = 0;
	let l = Infinity;
	let r = -Infinity;
	let t = Infinity;
	let b = -Infinity;
	for (const ch of str) {
		xs.push(x);
		if (ch !== ' ') {
			const k = textInk(ch, s);
			if (k.r > k.l) {
				l = Math.min(l, x + k.l);
				r = Math.max(r, x + k.r);
				t = Math.min(t, k.t);
				b = Math.max(b, k.b);
			}
		}
		x += textW(ch, s) + gap;
	}
	return r > l ? { xs, l, w: r - l, t, b } : { xs, l: 0, w: 0, t: 0, b: 0 };
};
/** the title's letter gap on a face W dots wide: the look's own (a whole dot scale between the letters' masks) where it
 *  fits inside the margins, else closed up just enough, never closer than the word's own mask sets them (letterGap) */
const titleGap = (str: string, s: number, W: number) => {
	const tight = letterGap(s);
	for (let gap = s; gap > tight; gap--) if (setLine(str, s, gap).w <= W - 2 * TITLE_MARGIN) return gap;
	return tight;
};
/** the line's lit width (at its closest letter gap: what a size must fit) */
const lineInk = (str: string, s: number) => setLine(str, s, letterGap(s));
/** a title's dot scale with the size knob: the layout's pick x the knob, never wider than the face less its margins nor
 *  taller than `maxH` dots (the bounce's lift is above the title, inside the face: titleLift) */
function titleScale(str: string, base: number, W: number, maxH: number) {
	let ts = Math.max(1, Math.round(base * titleKnobs().size));
	while (ts > 1 && (lineInk(str, ts).w > W - 2 * TITLE_MARGIN || 7 * ts > maxH)) ts--;
	return ts;
}
/** how high a bouncing letter lifts (dots) */
const titleLift = (ts: number) => Math.round(ts * 1.6 * bounceK());
/** THE WORDS AND FIGURES AS DRAWN, per face canvas, this step (the probes: scoreboard faceStats): each title's and each
 *  amount's lit box at rest, the bounce's lift; `before`: where the lit middle would have been by the placement before
 *  2026-11-17 (the amounts: centred on their glyph cells, not their dots) */
export type TitleRec = { kind: 'title' | 'amount'; str: string; x0: number; x1: number; y0: number; y1: number; lift: number; ts: number; before?: number };
const titleRec = new WeakMap<object, TitleRec[]>();
const noteRec = (canvas: object, r: TitleRec) => {
	let list = titleRec.get(canvas);
	if (!list) titleRec.set(canvas, (list = []));
	list.push(r);
};
/** the last title drawn on a face this step */
export const titleOf = (canvas: object): TitleRec | null => titleRec.get(canvas)?.filter((r) => r.kind === 'title').at(-1) ?? null;
/** every title and amount drawn on a face this step */
export const titlesOf = (canvas: object): TitleRec[] => titleRec.get(canvas) ?? [];
/** a face's records go at the start of its step (the title, the entry's wait: entryWaitOf) */
export const clearTitle = (canvas: object) => {
	titleRec.delete(canvas);
	entryWaitRec.delete(canvas);
	raceCardRec.delete(canvas);
};
/** THE BACK BOARD'S TITLE: centered on its lit dots about cx, set letter by letter; `bounce` (the show's clock, or null)
 *  bobs the letters in a wave (the mock's bounceTitle; LED_BOARD.titles.bounce its strength), `march` (the scene's clock,
 *  or null) drops them in one after another (marchAt) */
function boardTitle(g: Ctx, str: string, cx: number, y: number, ts: number, style: string, opts: { bounce?: number | null; march?: { t: number; dropH: number; stepMs: number; landMs: number } | null; word?: boolean } = {}) {
	// (`word`: a title always drawn as one word, FREE SPINS and TOTAL WIN, keeps the word's own letter gap)
	const ink = setLine(str, ts, opts.word ? letterGap(ts) : titleGap(str, ts, g.canvas.width));
	const x0 = Math.round(cx - ink.w / 2) - ink.l;
	const yy = Math.round(y);
	const lift = ts * 1.6 * bounceK();
	const op = g.globalCompositeOperation;
	if (style === 'cut') g.globalCompositeOperation = 'destination-out';
	[...str].forEach((ch, i) => {
		let dy = 0;
		let shown = true;
		if (opts.bounce !== undefined && opts.bounce !== null) dy = Math.round(Math.max(0, Math.sin(opts.bounce / 160 - i * 0.55)) * -lift);
		if (opts.march) {
			const M = opts.march;
			const lt = M.t - i * M.stepMs;
			shown = lt > 0;
			dy = lt < M.landMs ? -Math.round((1 - ease(lt / M.landMs)) * M.dropH) : lt < M.landMs + 120 ? Math.round(Math.sin(((lt - M.landMs) / 120) * Math.PI) * ts) : 0;
		}
		if (shown && ch !== ' ') drawText(g, ch, x0 + ink.xs[i], yy + dy, ts, style === 'cut' ? '#000' : style);
	});
	g.globalCompositeOperation = op;
	noteRec(g.canvas, { kind: 'title', str, x0: x0 + ink.l, x1: x0 + ink.l + ink.w, y0: yy + ink.t, y1: yy + ink.b, lift: opts.bounce !== undefined && opts.bounce !== null ? titleLift(ts) : 0, ts });
}

// ---- THE AMOUNTS BY THEIR DOTS (2026-11-17): a row's lit columns from its glyphs' own lit columns -----------------------------
const glyphInk = new Map<string, { l: number; r: number }>();
const inkOfGlyph = (ch: string, cap: number) => {
	const key = ch + '|' + cap;
	let k = glyphInk.get(key);
	if (k) return k;
	const c = vglyph(ch, cap).c;
	const d = c.ctx.getImageData(0, 0, c.width, c.height).data;
	let l = c.width;
	let r = 0;
	for (let y = 0; y < c.height; y++)
		for (let x = 0; x < c.width; x++)
			if (d[(y * c.width + x) * 4 + 3] > 40) {
				if (x < l) l = x;
				if (x + 1 > r) r = x + 1;
			}
	k = r > l ? { l, r } : { l: 0, r: 0 };
	glyphInk.set(key, k);
	return k;
};
/** a row's lit columns from where drawRow starts it (drawRow's own placing of each glyph) */
function rowInk(str: string, cap: number) {
	const ri = rowInfo(str, cap);
	let cx = 0;
	let l = Infinity;
	let r = -Infinity;
	[...str].forEach((ch, i) => {
		const gl = vglyph(ch, cap);
		const at = Math.round(cx + (ri.cells[i] - gl.adv) / 2) - 1;
		const k = inkOfGlyph(ch, cap);
		if (k.r > k.l) {
			l = Math.min(l, at + k.l);
			r = Math.max(r, at + k.r);
		}
		cx += ri.cells[i] + ri.sp;
	});
	return r > l ? { l, r } : { l: 0, r: ri.w };
}
/** the x to start a row at so its lit dots are centered on cx; with its record for the probes */
function centeredRow(g: Ctx, str: string, cx: number, y: number, cap: number, beforeX: number | null) {
	const k = rowInk(str, cap);
	const x = Math.round(cx - (k.l + k.r) / 2);
	noteRec(g.canvas, { kind: 'amount', str, x0: x + k.l, x1: x + k.r, y0: Math.round(y), y1: Math.round(y) + cap, lift: 0, ts: cap, before: beforeX === null ? undefined : Math.round(beforeX) + (k.l + k.r) / 2 });
	return x;
}

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
/** dots along a perimeter (the first `count`), each its color: with LED_BOARD.fastChase the dots next to each other in one
 *  row or column with the same color go as ONE rect (each dot is still drawn once, so the picture is the same; part B, the
 *  cost of a step), else dot by dot */
function perimeterDots(g: Ctx, pts: number[][], count: number, colorOf: (i: number) => string) {
	if (!LED_BOARD.fastChase) {
		for (let i = 0; i < count; i++) {
			g.fillStyle = colorOf(i);
			g.fillRect(pts[i][0], pts[i][1], 1, 1);
		}
		return;
	}
	let i = 0;
	while (i < count) {
		const c = colorOf(i);
		const [x0, y0] = pts[i];
		let j = i + 1;
		if (j < count && colorOf(j) === c) {
			const dx = pts[j][0] - x0;
			const dy = pts[j][1] - y0;
			if (Math.abs(dx) + Math.abs(dy) === 1) while (j < count && colorOf(j) === c && pts[j][0] - pts[j - 1][0] === dx && pts[j][1] - pts[j - 1][1] === dy) j++;
			else j = i + 1;
		}
		const [x1, y1] = pts[j - 1];
		g.fillStyle = c;
		g.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) + 1, Math.abs(y1 - y0) + 1);
		i = j;
	}
}
function chaseBorder(g: Ctx, W: number, H: number, t: number, cols: string[], thick: number, seg: number) {
	const n = Math.floor(t / 60);
	for (let k = 0; k < thick; k++) {
		const pts = perimeter(W, H, k, 1);
		perimeterDots(g, pts, pts.length, (i) => cols[Math.floor((i + n) / seg) % cols.length]);
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
function winLayout(W: number, H: number, finalStr: string, titles: string[], size = 1, extraGap = 0, liftK = 0): WinLay {
	const key = W + 'x' + H + '|' + finalStr + '|' + titles.join(',') + '|' + size + '|' + extraGap + '|' + liftK;
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
		// the back board's size knob (LED_BOARD.titles; 1 = the pick above), the widest title kept inside the margins
		if (size !== 1) {
			ts = Math.max(1, Math.round(ts * size));
			while (ts > 1 && (Math.max(...titles.map((x) => lineInk(x, ts).w)) > W - 2 * TITLE_MARGIN || 7 * ts > H * 0.4)) ts--;
		}
		const tH = 7 * ts;
		const gap = Math.max(1, Math.max(2, Math.round(H * 0.06)) + extraGap);
		const cap = fitCap(finalStr, W - 2 * m - 8, Math.min(H - 2 * m - tH - gap - 3, H * 0.5));
		const bh = tH + gap + cap;
		// (the bouncing letters' lift stays inside the face's top: 2026-11-17)
		const yc = Math.round((H - bh) / 2);
		const y0 = liftK > 0 ? Math.max(yc, Math.round(ts * 1.6 * liftK) + 2) : yc;
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
/** the win's place: on the back board (part B) the number keeps above the scene's bottom band (the mock's winLay) */
const winLay = (W: number, H: number, s: Show, back: boolean) => winLayout(W, back ? H - Math.round(H * LED_BOARD.scenes.band) : H, s.finalStr, titles(), back ? titleKnobs().size : 1, back ? titleGapKnob() : 0, back ? bounceK() : 0);
/** ballpark block letters: each letter bobs in turn, a wave running along the word (the mock's bounceTitle); since
 *  2026-11-17 set by boardTitle (the word's own letter gap, centered on its drawn dots, the class's knobs) */
function bounceTitle(g: Ctx, str: string, cx: number, y: number, ts: number, style: string, t: number | null) {
	boardTitle(g, str, cx, y, ts, style, { bounce: t });
}
function drawWinScene(g: Ctx, W: number, H: number, s: Show, tier: number, str: string, slide: number, pulse: number, back = false) {
	const look = LOOK[tier];
	look.bg(g, W, H, s.t);
	const lay = winLay(W, H, s, back);
	const title = LED_BOARD.tiers[tier].title;
	// the strip: the plain title; the back board: the mock's bouncing block letters (LED_BOARD.scenes.bounceTitle), set by
	// their drawn dots with the class's knobs (LED_BOARD.titles)
	if (back && !lay.tag) bounceTitle(g, title, lay.stacked ? lay.cx! : lay.titleX!, lay.titleY, lay.ts, look.title, lay.stacked && LED_BOARD.scenes.bounceTitle ? s.t : null);
	else if (lay.stacked) drawTitle(g, title, lay.cx!, lay.titleY, lay.ts, look.title);
	else drawLayTitle(g, lay, title, look.title, W);
	if (tier === 4 && pulse > 0) {
		g.globalCompositeOperation = 'source-atop';
		g.fillStyle = `rgba(255,255,255,${0.5 * pulse})`;
		g.fillRect(0, 0, W, H);
		g.globalCompositeOperation = 'source-over';
	}
	// the back board's amount centered on its lit dots (2026-11-17; the strip keeps its placing)
	let nx = numX(lay, W, str, slide);
	if (back && lay.stacked) {
		const k = rowInk(str, lay.cap);
		nx = clamp(centeredRow(g, str, W / 2 + slide, lay.numY, lay.cap, nx), lay.m + 1 - k.l, W - lay.m - 1 - k.r);
	}
	drawRow(g, str, nx, lay.numY, lay.cap, look.num, pulse);
}
/** a win's face at its time: the tier's look, the title, the counting amount; at a tier change the new tier sweeps in
 *  from the left behind a bright edge. `back`: the back board's (the number above the scene's bottom band). */
export function showWin(F: Face, s: Show, back = false) {
	const W = F.dotsW;
	const H = F.dotsH;
	const o = F.out.ctx;
	const tier = Math.max(0, tierNow(s));
	const str = s.fmt(amountNow(s));
	const lay = winLay(W, H, s, back);
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
		drawWinScene(a, W, H, s, before, str, slide, 0, back);
		drawWinScene(b, W, H, s, tier, str, slide, pulse, back);
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
		drawWinScene(o, W, H, s, tier, str, slide, pulse, back);
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
/** THE RACE'S RESULT CARD AS LAID OUT (the probes): each picture's and the words' columns on the strip, in dots */
export type RaceCardRec = { outcome: string; pics: [number, number][]; text: [number, number] | null; words: string };
const raceCardRec = new WeakMap<object, RaceCardRec>();
export const raceCardOf = (canvas: object): RaceCardRec | null => raceCardRec.get(canvas) ?? null;
const spriteW = (name: ArtName, h: number) => {
	const [sw, sh] = size(name, null);
	return Math.max(1, Math.round((h * sw) / sh));
};
/** the result card (2026-11-17, Corey: the picture sat behind the words): the picture to one side and the words beside it,
 *  never over each other, laid out from the pictures' real widths; on a short or narrow strip the picture shrinks first,
 *  then the words shorten (REINDEER WINNER, POLICE CAR WINNER, then the name alone, then POLICE) */
function raceCard(g: Ctx, race: Race, W: number, H: number, ct: number) {
	g.clearRect(0, 0, W, H);
	chaseBorder(g, W, H, ct, race.outcome === 'tie' ? ['#ffffff', '#202020'] : ['#ffd23a', '#ff3a2e'], 1, 3);
	const s = H >= 22 ? 2 : 1;
	const M = 4;
	const GAP = 6;
	const inkOf = (str: string, z: number) => textInk(str, z);
	if (race.outcome === 'tie') {
		if (ct < 900) {
			if (Math.floor(ct / 120) % 2) {
				g.fillStyle = '#ffffff';
				g.globalAlpha = 0.5;
				g.fillRect(1, 1, W - 2, H - 2);
				g.globalAlpha = 1;
			}
			const k = inkOf('PHOTO FINISH', s);
			drawTitle(g, 'PHOTO FINISH', W / 2, Math.round((H - 7 * s) / 2), s, '#ffffff');
			const x0 = Math.round(W / 2 - textW('PHOTO FINISH', s) / 2);
			raceCardRec.set(g.canvas, { outcome: 'tie', pics: [], text: [x0 + k.l, x0 + k.r], words: 'PHOTO FINISH' });
			return;
		}
		// the reindeer, TIE, the police car: each its own column
		let ph = Math.round(H * 0.82);
		const tw = textW('TIE', s);
		const widths = () => [spriteW('reindeer_col', ph), spriteW('H4', ph * 0.8)];
		while (ph > 5 && widths()[0] + GAP + tw + GAP + widths()[1] > W - 2 * M) ph--;
		const [rw, cw] = widths();
		const x = Math.round((W - (rw + GAP + tw + GAP + cw)) / 2);
		sprite(g, 'reindeer_col', x, H - 2, ph);
		const tx = x + rw + GAP;
		drawText(g, 'TIE', tx, Math.round((H - 7 * s) / 2), s, '#ffd23a');
		sprite(g, 'H4', tx + tw + GAP, H - 2, ph * 0.8, true);
		const k = inkOf('TIE', s);
		raceCardRec.set(g.canvas, { outcome: 'tie', pics: [[x, x + rw], [tx + tw + GAP, tx + tw + GAP + cw]], text: [tx + k.l, tx + k.r], words: 'TIE' });
		return;
	}
	const reindeer = race.outcome === 'reindeer';
	const name = reindeer ? 'REINDEER' : 'POLICE CAR';
	const line = 'WINNER';
	const pic: ArtName = reindeer ? 'reindeer_col' : 'H4';
	const picH = (ph: number) => (reindeer ? ph : ph * 0.75);
	// the words: two rows (WINNER over the name) on a tall strip, one row on a short one, shortened until they fit
	const two = H >= 22;
	const rows = two ? [[line, s], [name, 1]] : [[`${name} ${line}`, 1]];
	const widthOf = (r: (string | number)[][]) => Math.max(...r.map(([w, z]) => textW(w as string, z as number)));
	let ph = Math.round(H * 0.82);
	const minPh = Math.max(6, Math.round(H * 0.45));
	let words = rows;
	const fits = (r: (string | number)[][], h: number) => spriteW(pic, picH(h)) + GAP + widthOf(r) <= W - 2 * M;
	while (ph > minPh && !fits(words, ph)) ph--;
	if (!fits(words, ph)) {
		const shorter: (string | number)[][][] = two ? [[[line, 1], [name, 1]], [[name, 1]], [[reindeer ? 'REINDEER' : 'POLICE', 1]]] : [[[name, 1]], [[reindeer ? 'REINDEER' : 'POLICE', 1]]];
		for (const r of shorter) {
			words = r;
			if (fits(words, ph)) break;
		}
	}
	while (ph > 5 && !fits(words, ph)) ph--;
	const pw = spriteW(pic, picH(ph));
	const tw = widthOf(words);
	const x = Math.round((W - (pw + GAP + tw)) / 2);
	const bob = Math.round(Math.abs(Math.sin(ct / 180)) * -2);
	sprite(g, pic, x, H - 2 + bob, picH(ph), !reindeer);
	const tx = x + pw + GAP;
	const blockH = words.reduce((a, [, z]) => a + 7 * (z as number), 0) + 3 * (words.length - 1);
	let y = Math.round((H - blockH) / 2);
	let l = Infinity;
	let r = -Infinity;
	words.forEach(([w, z], i) => {
		const str = w as string;
		const zz = z as number;
		const wx = Math.round(tx + (tw - textW(str, zz)) / 2);
		const blink = i === 0 && words.length > 1 && Math.floor(ct / 250) % 4 === 3;
		if (!blink) drawText(g, str, wx, y, zz, i === 0 ? '#ffd23a' : '#ffffff');
		const k = inkOf(str, zz);
		l = Math.min(l, wx + k.l);
		r = Math.max(r, wx + k.r);
		y += 7 * zz + 3;
	});
	raceCardRec.set(g.canvas, { outcome: race.outcome, pics: [[x, x + pw]], text: [l, r], words: words.map(([w]) => w).join(' / ') });
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

// ==============================================================================================================================
// PART B (2026-11-17): THE BACK BOARD'S STAGED SCENES, ported from the approved mock's r3b scene code (bigwin_led_r3_2026-11-16:
// showEntryScene, showTotalScene, winBand, showRibbon). Every scene draws across the board's full face and each beat is a pure
// function of the scene's own clock (ms since s.sceneAt). The words are the mock's; the numbers are the book's (the spins the
// entry awards, the Total Win's amount).
// ==============================================================================================================================
type Box = { x: number; y: number; w: number; h: number };
/** a picture fitted in a box, its foot on the box's foot (the mock's drawFit) */
function drawFit(g: Ctx, name: ArtName, box: Box, dx = 0) {
	const [sw, sh] = size(name, null);
	const k = Math.min(box.w / sw, box.h / sh);
	const dw = Math.max(1, Math.round(sw * k));
	const dh = Math.max(1, Math.round(sh * k));
	g.drawImage(art(name, null, dw, dh), Math.round(box.x + (box.w - dw) / 2 + dx), Math.round(box.y + box.h - dh));
}
function fitScale(str: string, maxW: number, maxH: number, list: number[]) {
	for (const z of list) if (textW(str, z) <= maxW && 7 * z <= maxH) return z;
	return 1;
}
/** block letters drop in one after another and bounce once (ballpark marching letters) */
function marchAt(g: Ctx, str: string, cx: number, y: number, s: number, t: number, col: string, dropH: number) {
	// (2026-11-17: by its drawn dots with the word's own letter gap and the class's offset, boardTitle; the record it leaves
	// is written over by the scene's title, drawn after it)
	boardTitle(g, str, cx, y, s, col, { march: { t, dropH, stepMs: 55, landMs: 170 } });
}
/** a number slams in: drawn larger and shrinking to its size in 160 ms, with a white flash on impact */
function slamRow(g: Ctx, str: string, cx: number, y: number, cap: number, t: number, style: string) {
	const k = t < 160 ? 1 + 0.6 * (1 - ease(t / 160)) : 1;
	const c = Math.round(cap * k);
	const w = rowInfo(str, c).w;
	// (centered on its lit dots since 2026-11-17)
	const x = centeredRow(g, str, cx, y - (c - cap) / 2, c, cx - w / 2);
	drawRow(g, str, x, y - (c - cap) / 2, c, style, t < 300 ? 1 - t / 300 : 0);
}
function flash(g: Ctx, W: number, H: number, t: number, len: number) {
	if (t < 0 || t >= len) return;
	g.globalAlpha = 0.7 * (1 - t / len);
	g.fillStyle = '#ffffff';
	g.fillRect(0, 0, W, H);
	g.globalAlpha = 1;
}
/** fireworks bursts (the mock's); `keep` leaves out the dots outside a region (instead of a clip) */
function fireworks(g: Ctx, W: number, H: number, t: number, cols: string[], n: number, keep: ((x: number, y: number) => boolean) | null = null) {
	const put = (x: number, y: number, c: string) => {
		const rx = Math.round(x);
		const ry = Math.round(y);
		if (keep && !keep(rx, ry)) return;
		g.fillStyle = c;
		g.fillRect(rx, ry, 1, 1);
	};
	for (let k = 0; k < n; k++) {
		const per = 1300;
		const off = k * (per / n);
		const cyc = Math.floor((t + off) / per);
		const p = ((t + off) % per) / per;
		const cx = W * (0.12 + 0.76 * hash(k * 5 + cyc));
		const cy = H * (0.18 + 0.4 * hash(k * 9 + cyc * 3));
		if (p < 0.25) {
			put(cx, cy + (1 - p / 0.25) * H * 0.5, '#ffffff');
			continue;
		}
		const q = (p - 0.25) / 0.75;
		const r = q * Math.min(W, H) * 0.28;
		g.globalAlpha = 1 - q;
		for (let i = 0; i < 16; i++) {
			const a = (i / 16) * Math.PI * 2;
			put(cx + Math.cos(a) * r, cy + Math.sin(a) * r + q * q * 4, cols[(i + k) % cols.length]);
		}
		g.globalAlpha = 1;
	}
}
/** fireworks kept to the two top corners, clear of the number */
function cornerFireworks(g: Ctx, W: number, H: number, t: number, cols: string[], yMax: number) {
	const keep = (x: number, y: number) => y + 0.5 < yMax && y >= 0 && (x + 0.5 < W * 0.24 || x + 0.5 > W * 0.76);
	fireworks(g, W, yMax * 1.6, t, cols, 4, keep);
}
/** a jam of the game's cars inching along the bottom band, honking (a white puff over one car at a time) */
function trafficBand(g: Ctx, W: number, yB: number, h: number, t: number) {
	const cars: ArtName[] = ['H2', 'H3', 'H4', 'car', 'H2', 'H3'];
	let x = W - ((t * 0.02) % (W + h * 12));
	cars.forEach((c, i) => {
		const w = sprite(g, c, x, yB - (Math.floor(t / 140 + i) % 3 === 0 ? 1 : 0), c === 'car' ? h * 0.9 : h);
		if (Math.floor(t / 400) % cars.length === i) {
			dot(g, x - 1, yB - h - 1, '#ffffff');
			dot(g, x - 2, yB - h - 2, '#ffffff');
		}
		x += w + h * 0.4;
	});
}

/** the entries' place: the count about half the face, the title under it; for Super, SUPER over it */
function entryNumberLayout(W: number, H: number, num: string, title: string, topWord: string | null) {
	const tts = titleScale(title, fitScale(title, W - 12, H * 0.14, [4, 3, 2, 1]), W, H * 0.3);
	const sts = topWord ? fitScale(topWord, W - 12, H * 0.16, [6, 5, 4, 3, 2]) : 0;
	const topH = topWord ? 7 * sts + Math.max(5, Math.round(H * 0.05)) : 0;
	const G = Math.max(-3, titleGapKnob());
	const cap = fitCap(num, W * 0.5, Math.min(H * 0.5, H - topH - 7 * tts - 14 - Math.max(0, G)));
	const blockH = topH + cap + 5 + G + 7 * tts;
	const y0 = Math.round((H - blockH) / 2);
	return { tts, sts, cap, topY: y0, numY: y0 + topH, titleY: y0 + topH + cap + 5 + G };
}
/** the scene's own clock (ms) */
const sceneT = (s: Show) => s.t - s.sceneAt;

/** THE FREE SPINS ENTRY (HERE WE GO, STAMPEDE, SLAM, READY) and THE SUPER ENTRY (NIGHT SKY, SLEIGH SWEEP, SUPER, SLAM,
 *  READY), as the mock's showEntryScene */
export function showEntryScene(F: Face, s: Show) {
	const g = F.out.ctx;
	const W = F.dotsW;
	const H = F.dotsH;
	const t = sceneT(s);
	const sup = s.kind === 'sfs';
	const num = String(s.spins);
	g.clearRect(0, 0, W, H);
	const lay = entryNumberLayout(W, H, num, 'FREE SPINS', sup ? 'SUPER' : null);
	if (!sup) {
		g.fillStyle = 'rgba(30,90,220,0.14)';
		g.fillRect(0, 0, W, H);
		chaseBorder(g, W, H, s.t, ['#36ff74', '#ffffff', '#ff3a2e', '#ffffff'], H >= 60 ? 2 : 1, 3);
		const cars: [ArtName, number][] = [
			['H2', 0.22],
			['H4', 0.5],
			['H3', 0.78],
		];
		const ch = Math.round(H * 0.2);
		const rh = Math.round(H * 0.36);
		const rw = Math.round((rh * RUN_FW) / RUN_FH);
		if (t < 1700) {
			// 1 HERE WE GO marching in; 2 the reindeer stampedes the whole width, the cars fly off as it reaches them
			const z = fitScale('HERE WE GO', W - 16, H * 0.3, [6, 5, 4, 3, 2]);
			g.globalAlpha = t < 800 ? 1 : clamp(1 - (t - 800) / 300, 0, 1);
			marchAt(g, 'HERE WE GO', W / 2, Math.round(H * 0.22), z, t, '#ffffff', H * 0.3);
			g.globalAlpha = 1;
			const rx = t < 800 ? -rw : -rw + ((t - 800) / 900) * (W + rw * 2);
			for (const [c, fx] of cars) {
				const cx = W * fx - ch;
				const hit = rx + rw * 0.8 >= cx;
				let dx = 0;
				let dy = 0;
				if (hit && t >= 800) {
					const tHit = 800 + ((cx - rw * 0.8 + rw) / (W + 2 * rw)) * 900;
					const u = Math.max(0, t - tHit) / 1000;
					dx = u * W * 0.35;
					dy = -u * H * 2.2 + u * u * H * 4;
				}
				if (H - 2 + dy > -ch) sprite(g, c, cx + dx, H - 2 + dy, ch);
			}
			if (t >= 800) gallop(g, rx, H - 2, rh, s.t);
		} else {
			// 3 SLAM: the number slams in with a flash, FREE SPINS under it; 4 READY: confetti, presents, the reindeer trots
			const lt = t - 1700;
			if (lt > 500) {
				const n = Math.round((W * H) / 70);
				for (let k = 0; k < n; k++) {
					const x = (hash(k * 5.3) * W + Math.sin(s.t / 500 + k) * 2 + W) % W;
					const y = (hash(k * 2.7) * H + s.t * (0.01 + hash(k) * 0.012)) % H;
					g.fillStyle = BULBS[k % 4];
					g.globalAlpha = 0.7;
					g.fillRect(Math.round(x), Math.round(y), 1, 1);
				}
				g.globalAlpha = 1;
				// presents bouncing either side of the number, clear of the words
				const nw = rowInfo(num, lay.cap).w;
				const room = (W - nw) / 2 - 10;
				const ph = Math.round(Math.min(lay.cap * 0.9, room));
				const bob = Math.round(Math.abs(Math.sin(s.t / 220)) * -3);
				if (ph >= 8) {
					const py = lay.numY + (lay.cap - ph) / 2;
					drawFit(g, 'present', { x: (W - nw) / 2 - ph - 6, y: py + bob, w: ph, h: ph });
					drawFit(g, 'present', { x: (W + nw) / 2 + 6, y: py - bob, w: ph, h: ph });
				}
			}
			slamRow(g, num, W / 2, lay.numY, lay.cap, lt, '#ffffff');
			if (lt > 120) boardTitle(g, 'FREE SPINS', W / 2, lay.titleY, lay.tts, '#7cc4ff', { word: true });
			flash(g, W, H, lt, 160);
			if (lt > 500) {
				const p = ((lt - 500) % 2600) / 2600;
				const h2 = Math.round(H * 0.16);
				gallop(g, -h2 * 1.3 + p * (W + h2 * 2.6), H - 1, h2, s.t);
			}
		}
		return;
	}
	// SUPER: night colors, a double chase border, the sleigh sweep, SUPER bouncing in, the gold slam
	g.fillStyle = 'rgba(8,16,60,0.85)';
	g.fillRect(0, 0, W, H);
	sparkles(g, W, H, s.t, Math.round((W * H) / 120), ['#ffffff', '#cfe8ff', '#ffd23a'], 41);
	chaseBorder(g, W, H, s.t, ['#ff3a2e', '#ffd23a'], 1, 3);
	if (H >= 40) {
		g.save();
		g.translate(3, 3);
		chaseBorder(g, W - 6, H - 6, s.t + 180, ['#ffd23a', '#ff3a2e'], 1, 3);
		g.restore();
	}
	const mr = Math.max(3, Math.round(H * 0.07));
	g.fillStyle = '#fff3c4';
	g.beginPath();
	g.arc(W * 0.86, H * 0.18, mr, 0, Math.PI * 2);
	g.fill();
	g.fillStyle = 'rgba(8,16,60,1)';
	g.beginPath();
	g.arc(W * 0.86 + mr * 0.45, H * 0.18 - mr * 0.2, mr, 0, Math.PI * 2);
	g.fill();
	if (t >= 500 && t < 1600) {
		// the sleigh sweeps the whole face on a rising arc, the reindeer in front, both facing their way
		const u = (t - 500) / 1100;
		const h = Math.round(H * 0.3);
		const rw = Math.round((h * RUN_FW) / RUN_FH);
		const sw = Math.round(h * 1.37);
		const x = -rw - sw + u * (W + (rw + sw) * 2);
		const yb = H - 4 - Math.sin(u * Math.PI) * H * 0.35 - u * H * 0.1;
		for (let i = 0; i < 22; i++) {
			g.globalAlpha = 1 - i / 22;
			dot(g, x - i * 4, yb - h * 0.3 + Math.sin(i + s.t / 90) * 2, i % 2 ? '#ffd23a' : '#ffffff');
		}
		g.globalAlpha = 1;
		const sx = sprite(g, 'sleigh', x, yb, h, true);
		gallop(g, x + sx + 1, yb, h * 0.95, s.t);
	}
	if (t >= 1500) marchAt(g, 'SUPER', W / 2, lay.topY, lay.sts, t - 1500, '#ffd23a', H * 0.3);
	if (t >= 1950) boardTitle(g, 'FREE SPINS', W / 2, lay.titleY, lay.tts, '#ff6a4a', { word: true });
	if (t >= 2300) {
		slamRow(g, num, W / 2, lay.numY, lay.cap, t - 2300, 'gold');
		flash(g, W, H, t - 2300, 160);
	}
	if (t >= 2800) {
		const p = ((t - 2800) % 2200) / 2200;
		const h2 = Math.round(H * 0.14);
		gallop(g, -h2 * 1.3 + p * (W + h2 * 2.6), H - 2 - Math.abs(Math.sin(p * Math.PI * 3)) * H * 0.08, h2, s.t);
	}
}

/** THE TOTAL WIN (SCOREBOARD ON, COUNT, FINAL, WAITS), as the mock's showTotalScene */
export function showTotalScene(F: Face, s: Show) {
	const g = F.out.ctx;
	const W = F.dotsW;
	const H = F.dotsH;
	const t = sceneT(s);
	g.clearRect(0, 0, W, H);
	const band = Math.round(H * LED_BOARD.scenes.band);
	const Hm = H - band;
	// the border runs round the face as the board comes on, then chases (fast while it counts)
	const pts = perimeter(W, H, 0, 1);
	const on = t < 400 ? Math.round((Math.max(0, t) / 400) * pts.length) : pts.length;
	const landAt = s.countEnd;
	const counting = s.t < landAt;
	const step = Math.floor(s.t / (counting ? 50 : 120));
	perimeterDots(g, pts, on, (i) => (Math.floor((i + step) / 3) % 2 ? '#ffd23a' : '#36ff74'));
	// (a capped round's wrap-up says MAX WIN, as the HTML card did)
	const title = s.title ?? 'TOTAL WIN';
	const tts = titleScale(title, fitScale(title, W - 16, Hm * 0.2, [5, 4, 3, 2, 1]), W, Hm * 0.4);
	const cap = fitCap(s.finalStr, W - 16, Math.min(Hm * 0.55, Hm - 7 * tts - 12));
	const G = Math.max(-3, titleGapKnob());
	const y0 = Math.round((Hm - (7 * tts + 6 + G + cap)) / 2) + 2;
	const dropT = clamp(t / 300, 0, 1);
	boardTitle(g, title, W / 2, Math.round(y0 - (1 - ease(dropT)) * H * 0.3), tts, '#ffffff', { word: true });
	const str = s.fmt(amountNow(s));
	const w = rowInfo(str, cap).w;
	const since = s.t - landAt;
	const landed = since >= 0;
	const blinkOff = landed && since < 900 && Math.floor(since / 150) % 2 === 1;
	// (centered on its lit dots since 2026-11-17)
	const ax = centeredRow(g, str, W / 2, y0 + 7 * tts + 6 + G, cap, (W - w) / 2);
	if (!blinkOff) drawRow(g, str, ax, y0 + 7 * tts + 6 + G, cap, 'gold', landed ? clamp(1 - since / 400, 0, 1) : 0);
	if (landed) cornerFireworks(g, W, H, since, ['#ffd23a', '#ffffff', '#36ff74', '#ff3a2e'], Hm);
	// the bottom band: Grandma's car bouncing, the police car with its lights going, the reindeer clapping
	const ch = Math.round(band * 0.85);
	const yb = H - 2;
	const jump = landed && since < 900 ? Math.round(Math.abs(Math.sin(since / 110)) * band * 0.35) : 0;
	const gx = W * 0.12;
	const px = W * 0.66;
	sprite(g, 'car', gx, yb - (Math.floor(s.t / 260) % 2) - jump, ch * 0.95);
	const pw = sprite(g, 'H4', px, yb - jump, ch);
	const lit = Math.floor(s.t / 140) % 2;
	g.fillStyle = lit ? '#ff3a2e' : '#4aa8ff';
	g.fillRect(Math.round(px + pw * 0.42), Math.round(yb - ch - jump - 1), 2, 2);
	g.fillStyle = lit ? '#4aa8ff' : '#ff3a2e';
	g.fillRect(Math.round(px + pw * 0.52), Math.round(yb - ch - jump - 1), 2, 2);
	sprite(g, 'reindeer_col', W * 0.44, yb - (Math.floor(s.t / 180) % 2) * 2 - jump, ch * 1.1);
}

/** THE WINS' BOTTOM BAND and the landing beat (the mock's winBand): Mega the fireworks in the top corners and a traffic
 *  jam, Epic the honk meter that fills with the count, Max the race, one run after another; fireworks as it lands */
export function winBand(F: Face, s: Show) {
	const g = F.out.ctx;
	const W = F.dotsW;
	const H = F.dotsH;
	const tier = Math.max(0, tierNow(s));
	const band = Math.round(H * LED_BOARD.scenes.band);
	const yb = H - 2;
	const lay = winLay(W, H, s, true);
	const since = s.t - s.countEnd;
	const landed = since >= 0;
	// a Max win's band is the race for the whole count (2026-11-17, below), not the jam or the honk meter on its way up
	const maxShow = s.finalTier === 4;
	if (tier === 2) {
		cornerFireworks(g, W, H, s.t, ['#ff3a2e', '#ffd23a', '#ffffff'], lay.numY);
		if (!maxShow) trafficBand(g, W, yb, Math.round(band * 0.75), s.t);
	}
	if (tier === 3) cornerFireworks(g, W, H, s.t, BULBS, lay.numY);
	if (tier === 3 && !maxShow) {
		const frac = clamp(amountNow(s) / s.amount, 0, 1);
		const y = H - band + 4;
		const x0 = 6;
		const w = W - 12;
		const mh = Math.max(4, Math.round(band * 0.35));
		drawText(g, 'HONK METER', x0, y, 1, '#ffffff');
		for (let i = 0; i < w; i += 2) {
			const on = i / w <= frac;
			g.fillStyle = on ? (i / w < 0.5 ? '#36ff74' : i / w < 0.8 ? '#ffd23a' : '#ff3a2e') : '#303030';
			g.fillRect(x0 + i, y + 10, 1, mh);
		}
		if (frac > 0.97 && Math.floor(s.t / 150) % 2) {
			const z = band >= 30 ? 2 : 1;
			drawText(g, 'HONK HONK', W - 6 - textW('HONK HONK', z), y, z, '#ff3a2e');
		}
	}
	if (maxShow && s.t >= s.countStart) {
		// THE RACE OVER THE WHOLE COUNT (2026-11-17, approved; it used to run only in the 1.2 s hold): one run (the race
		// routine, as on the strip, its own seeded source), started as the count starts, its time the count's share of the
		// run, so it crosses the finish line as the count lands (a skip lands the count: the race jumps to its finish);
		// after the landing its result line blinks
		const R = LED_BOARD.race;
		const h = Math.round(band * 0.7);
		const n = 0;
		const len = s.countEnd - s.countStart;
		const rt = s.t >= s.countEnd ? R.runMs + (s.t - s.countEnd) : len > 0 ? clamp((s.t - s.countStart) / len, 0, 1) * R.runMs : R.runMs;
		let runs = maxRaces.get(s);
		if (!runs) maxRaces.set(s, (runs = new Map()));
		let race = runs.get(n);
		if (!race) runs.set(n, (race = newRace()));
		raceAt.set(s, Math.min(1, rt / R.runMs));
		drawRace(g, race, rt, 2, W - 4, yb - Math.max(2, Math.round(H * 0.1)) + 2, h);
		if (rt > R.runMs && Math.floor(rt / 200) % 2) {
			const msg = race.outcome === 'tie' ? 'PHOTO FINISH  TIE' : (race.outcome === 'reindeer' ? 'REINDEER' : 'POLICE CAR') + ' WINS';
			drawTitle(g, msg, W / 2, H - band - 1, 1, '#000000');
		}
	}
	if (landed && tier >= 2) cornerFireworks(g, W, H, since, ['#ffffff', '#ffd23a'], H * 0.9);
}
/** the Max scene's race time now, a share of its run (1 = at the finish line; the probe) */
const raceAt = new WeakMap<Show, number>();
export const maxRaceAtOf = (s: Show): number | null => raceAt.get(s) ?? null;
/** the Max scene's race now (the probe and the dev hook read it) */
export const maxRaceOf = (s: Show): Race | null => {
	const runs = maxRaces.get(s);
	if (!runs || !runs.size) return null;
	return runs.get(Math.max(...runs.keys())) ?? null;
};

const PRESS_LINE = 'PRESS ANYWHERE TO CONTINUE';
/** THE ENTRY'S WAIT ON THE STRIP (2026-11-17, constants LED_BOARD.entryLine): the intro card's sentence (INTRO_LINE, its
 *  words exactly) scrolls along the top row and PRESS ANYWHERE TO CONTINUE pulses under it; a strip too short for two rows
 *  shows one pass of the sentence, then the press line for pressMs, and again. The sentence's copies follow each other a
 *  quarter of the strip apart. Returns what is on the strip (the probe). */
export type EntryWaitInfo = { mode: 'rows' | 'alternate'; size: number; sentence: string; sentenceX: number | null; press: boolean; pressX: number | null; sentenceY: number; pressY: number };
const entryWaitRec = new WeakMap<object, EntryWaitInfo>();
export const entryWaitOf = (canvas: object): EntryWaitInfo | null => entryWaitRec.get(canvas) ?? null;
function entryWait(g: Ctx, W: number, H: number, s: Show, sentence: string, col: string) {
	const E = LED_BOARD.entryLine;
	const dt = s.t - (s.pressLineAt ?? s.t);
	// TWO ROWS inside the one dot chase border: the press line at the size it has always had on this strip (2 when it fits
	// the width, else 1), the sentence over it as large as the height allows (never smaller than the press line), a gap of
	// one dot scale between them; a 15 or 16 dot strip lays both at 1 over the border
	const zp = textW(PRESS_LINE, 2) <= W - 6 && H >= 15 ? 2 : 1;
	const fits = (zs: number) => 7 * zs + zs + 7 * zp + 2 <= H;
	const zs = [2, 1].find((k) => k >= zp && fits(k)) ?? (H >= 15 ? 1 : 0);
	const pulse = 0.6 + 0.4 * Math.abs(Math.sin(s.t / 380));
	const pressAt = (k: number, y: number) => {
		const pw = textW(PRESS_LINE, k);
		const x = pw <= W - 4 ? (W - pw) / 2 : W - ((dt * 0.03 * k) % (pw + W));
		g.globalAlpha = pulse;
		drawText(g, PRESS_LINE, x, y, k, '#ffe7b0');
		g.globalAlpha = 1;
		return Math.round(x);
	};
	if (zs > 0) {
		const zq = zs === 1 && !fits(1) ? 1 : zp;
		const block = 7 * zs + zs + 7 * zq;
		const y1 = H >= block + 2 ? 1 + Math.floor((H - 2 - block) / 2) : Math.floor((H - block) / 2);
		const y2 = y1 + 8 * zs;
		const tw = textW(sentence, zs);
		const v = (E.charsPerSec * 6 * zs) / 1000;
		const gap = Math.max(24, Math.round(W / 4));
		const P = tw + gap;
		const x = Math.round(W - ((dt * v) % P));
		drawText(g, sentence, x, y1, zs, col);
		// the copy before it, still leaving at the left (none before the first pass)
		if (dt * v >= P && x - P + tw > 0) drawText(g, sentence, x - P, y1, zs, col);
		const px = pressAt(zq, y2);
		entryWaitRec.set(g.canvas, { mode: 'rows', size: zs, sentence, sentenceX: x, press: true, pressX: px, sentenceY: y1, pressY: y2 });
		return;
	}
	// one row: a pass of the sentence, then the press line
	const k = 1;
	const y = Math.round((H - 7) / 2);
	const tw = textW(sentence, k);
	// (no faster than the strip's own pace, but a pass never longer than 3 s, so the press line comes round in time)
	const v = Math.max((E.charsPerSec * 6) / 1000, (tw + W) / 3000);
	const pass = (tw + W) / v;
	const cyc = pass + E.pressMs;
	const u = dt % cyc;
	if (u < pass) {
		const x = Math.round(W - u * v);
		drawText(g, sentence, x, y, k, col);
		entryWaitRec.set(g.canvas, { mode: 'alternate', size: k, sentence, sentenceX: x, press: false, pressX: null, sentenceY: y, pressY: y });
	} else {
		const px = pressAt(k, y);
		entryWaitRec.set(g.canvas, { mode: 'alternate', size: k, sentence, sentenceX: null, press: true, pressX: px, sentenceY: y, pressY: y });
	}
}

/** THE STRIP'S LINE WHILE A CARD IS UP (the mock's showRibbon): the entries march the spins awarded along the ribbon, the
 *  Total Win counts, and once the card waits PRESS ANYWHERE TO CONTINUE pulses (it scrolls when it does not fit) */
export function showRibbon(F: Face, s: Show) {
	const g = F.out.ctx;
	const W = F.dotsW;
	const H = F.dotsH;
	g.clearRect(0, 0, W, H);
	if (s.t < s.contentAt) return;
	if (s.pressLineAt !== null && s.t >= s.pressLineAt && s.t < s.exitAt) {
		chaseBorder(g, W, H, s.t, ['#ffe7b0', '#202020'], 1, 3);
		if ((s.kind === 'fs' || s.kind === 'sfs') && LED_BOARD.entryLine.on) return entryWait(g, W, H, s, INTRO_LINE[s.kind === 'sfs' ? 'super' : 'bonus'], s.kind === 'sfs' ? '#ffd23a' : '#ffffff');
		// a wrap-up's own line (a top-up, the cap: the HTML card's words) the same way, once the Total Win waits
		if (s.kind === 'total' && s.line) return entryWait(g, W, H, s, s.line, '#ffd23a');
		const str = 'PRESS ANYWHERE TO CONTINUE';
		const sz = textW(str, 2) <= W - 6 && H >= 15 ? 2 : 1;
		g.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(s.t / 380));
		if (textW(str, sz) <= W - 4) drawText(g, str, (W - textW(str, sz)) / 2, Math.round((H - 7 * sz) / 2), sz, '#ffe7b0');
		else drawText(g, str, W - ((s.t * 0.03) % (textW(str, 1) + W)), Math.round((H - 7) / 2), 1, '#ffe7b0');
		g.globalAlpha = 1;
		return;
	}
	if (s.kind === 'total') {
		const tl = s.title ?? 'TOTAL WIN';
		const lay = winLayout(W, H, s.finalStr, [tl]);
		const str = s.fmt(amountNow(s));
		chaseBorder(g, W, H, s.t, ['#36ff74', '#ff3a2e'], 1, 3);
		drawLayTitle(g, lay, tl, '#ffffff', W);
		drawRow(g, str, numX(lay, W, str, 0), lay.numY, lay.cap, 'gold', 0);
		return;
	}
	const sup = s.kind === 'sfs';
	const line = `${s.spins} ${sup ? 'SUPER FREE SPINS' : 'FREE SPINS'}`;
	chaseBorder(g, W, H, s.t, sup ? ['#ff3a2e', '#ffd23a'] : ['#36ff74', '#ffffff', '#ff3a2e', '#ffffff'], 1, 3);
	const sz = textW(line, 2) <= W - 6 && H >= 15 ? 2 : 1;
	marchText(g, line, W, H, sz, (s.t - s.contentAt) % 2400, sup ? '#ffd23a' : '#ffffff');
}

/** THE BACK BOARD'S PROGRAM (part B): the staged scene of the show up now */
export function backScene(F: Face, s: Show) {
	if (s.kind === 'fs' || s.kind === 'sfs') return showEntryScene(F, s);
	if (s.kind === 'total') {
		showTotalScene(F, s);
		countBorder(F, s);
		return;
	}
	showWin(F, s, true);
	winBand(F, s);
	countBorder(F, s);
}
