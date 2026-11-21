// THE LED BILLBOARD'S SCREENS (Corey 2026-11-16, led_billboard_r2_2026-11-16: "That looks amazing"; constants LED_SIGN,
// game/landing/ledSign.ts). Each screen is drawn on a small 2D canvas at ONE PIXEL PER DOT, exactly as Corey's mock page
// draws it (its functions, ported): the 5x7 dot font scaled by EPX and Scale3x for the small lines, a heavy face snapped
// to the dots for the big figure (the game's own Overpass Heavy, not the page's Arial Black, which phones do not have),
// the pictures stepped down to the dot size with the LED punch, the four screens (the reindeer's face since 2026-11-21, the
// max win, the sleigh strike, the Grandma car strike) and the ticker. The sign (game/landing/ledSign.ts) shows these canvases through the dot grille.
// Plain 2D canvas drawing (composite modes on small canvases), no filter.
// THE FINER GRID (2026-11-19, game/scoreboard/ledGrid.ts, constants LED_BOARD.density): on a face of k LEDs per dot the
// words are redrawn at the LED grid (fineMask: the 5 x 7 sizes in Overpass at density.smallWeight, each letter in its own
// 5 x 7 cell k times finer; the heavy face from 3 up at k times the cap, each letter on today's place), the pictures baked
// at k times the dots, and the decorations set in LEDs; every width and place is today's (textW, textInk, letterGap read
// today's masks), so every layout is today's. At k = 1 every path is exactly as before.

import { LED_BOARD, LED_SIGN } from '../constants';
import { LED_WILDS } from '../ledWildsSpec';
import { AMOUNT_OUTLINES, SENTENCE_SIGNS, ledSignCanvas } from '../scoreboard/ledSigns';
import { blit, blitP, clearP, dotAt, fillP, kOf, ledN, overpassReady, ringPts } from '../scoreboard/ledGrid';

export type Cv = HTMLCanvasElement & { ctx: CanvasRenderingContext2D };
type Ctx = CanvasRenderingContext2D;
type Grid = { w: number; h: number; d: Uint8Array };
type Rect = { x: number; y: number; w: number; h: number };

export const mk = (w: number, h: number): Cv => {
	const c = document.createElement('canvas') as Cv;
	c.width = Math.max(1, Math.round(w));
	c.height = Math.max(1, Math.round(h));
	c.ctx = c.getContext('2d', { willReadFrequently: true }) as Ctx;
	return c;
};

// ---- the LED palette (the page's) ----
export const C = { white: '#fff7ea', gold: '#ffd23a', amber: '#ffb21e', red: '#ff3a2e', green: '#36ff74', ice: '#8fe6ff', yellow: '#ffe95a', unlit: '#22262d', base: '#040507' };

// ---- the 5x7 font ----
const FONT: Record<string, string[]> = {
	A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
	B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
	C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
	D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
	E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
	F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
	G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
	H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
	I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
	J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
	K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
	L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
	M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
	N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
	O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
	P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
	Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
	R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
	S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
	T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
	U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
	V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
	W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
	X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
	Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
	Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
	0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
	1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
	2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
	3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
	4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
	5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
	6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
	7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
	8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
	9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
	',': ['..', '..', '..', '..', '..', '.#', '#.'],
	"'": ['#', '#', '.', '.', '.', '.', '.'],
	'.': ['.', '.', '.', '.', '.', '.', '#'],
	// (2026-11-17: the wrap-up's top-up line on the strip carries the amount as the card writes it)
	$: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
	' ': ['...', '...', '...', '...', '...', '...', '...'],
	// the LED scoreboard's own (game/scoreboard/, bigwin_led_r3): the question mark and a lower case set in the same 7 row
	// cell (x height 5 rows; the y's tail stays inside the cell, as on a 5 x 7 LED sign), for the Grandma line's mixed case
	'?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
	// (2026-11-17: the short Grandma line, GRANDMA GOT RUN OVER!)
	'!': ['#', '#', '#', '#', '#', '.', '#'],
	a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
	b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
	c: ['.....', '.....', '.###.', '#....', '#....', '#...#', '.###.'],
	d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
	e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
	f: ['..##.', '.#..#', '.#...', '###..', '.#...', '.#...', '.#...'],
	g: ['.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'],
	h: ['#....', '#....', '#.##.', '##..#', '#...#', '#...#', '#...#'],
	i: ['.#.', '...', '##.', '.#.', '.#.', '.#.', '###'],
	j: ['...#', '....', '..##', '...#', '...#', '#..#', '.##.'],
	k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
	l: ['##.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
	m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#...#', '#...#'],
	n: ['.....', '.....', '#.##.', '##..#', '#...#', '#...#', '#...#'],
	o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
	p: ['.....', '####.', '#...#', '#...#', '####.', '#....', '#....'],
	q: ['.....', '.####', '#...#', '#...#', '.####', '....#', '....#'],
	r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
	s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
	t: ['.#...', '.#...', '###..', '.#...', '.#...', '.#..#', '..##.'],
	u: ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#'],
	v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
	w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
	x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
	y: ['.....', '.....', '#...#', '#...#', '.####', '....#', '.###.'],
	z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
};

function grid1(str: string): Grid {
	const gl = [...str].map((ch) => FONT[ch] || SENTENCE_SIGNS[ch] || FONT[' ']);
	let w = 0;
	gl.forEach((g, i) => (w += g[0].length + (i ? 1 : 0)));
	const d = new Uint8Array(w * 7);
	let x = 0;
	gl.forEach((g, i) => {
		if (i) x++;
		const gw = g[0].length;
		for (let r = 0; r < 7; r++) for (let c = 0; c < gw; c++) if (g[r][c] === '#') d[r * w + x + c] = 1;
		x += gw;
	});
	return { w, h: 7, d };
}
function epx(g: Grid): Grid {
	const W = g.w;
	const H = g.h;
	const OW = W * 2;
	const o = new Uint8Array(W * H * 4);
	const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : g.d[y * W + x]);
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) {
			const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), Cc = at(x - 1, y), D = at(x, y + 1);
			let e0 = P, e1 = P, e2 = P, e3 = P;
			if (Cc === A && Cc !== D && A !== B) e0 = A;
			if (A === B && A !== Cc && B !== D) e1 = B;
			if (D === Cc && D !== B && Cc !== A) e2 = Cc;
			if (B === D && B !== A && D !== Cc) e3 = D;
			const i = y * 2 * OW + x * 2;
			o[i] = e0;
			o[i + 1] = e1;
			o[i + OW] = e2;
			o[i + OW + 1] = e3;
		}
	return { w: OW, h: H * 2, d: o };
}
function sc3(g: Grid): Grid {
	const W = g.w;
	const H = g.h;
	const OW = W * 3;
	const o = new Uint8Array(W * H * 9);
	const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : g.d[y * W + x]);
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) {
			const A = at(x - 1, y - 1), B = at(x, y - 1), Cc = at(x + 1, y - 1), D = at(x - 1, y), E = at(x, y), F = at(x + 1, y), G = at(x - 1, y + 1), Hh = at(x, y + 1), I = at(x + 1, y + 1);
			const e = [E, E, E, E, E, E, E, E, E];
			if (B !== Hh && D !== F) {
				e[0] = D === B ? D : E;
				e[1] = (D === B && E !== Cc) || (B === F && E !== A) ? B : E;
				e[2] = B === F ? F : E;
				e[3] = (D === B && E !== G) || (D === Hh && E !== A) ? D : E;
				e[5] = (B === F && E !== I) || (Hh === F && E !== Cc) ? F : E;
				e[6] = D === Hh ? D : E;
				e[7] = (D === Hh && E !== I) || (Hh === F && E !== G) ? Hh : E;
				e[8] = Hh === F ? F : E;
			}
			for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) o[(y * 3 + j) * OW + x * 3 + i] = e[j * 3 + i];
		}
	return { w: OW, h: H * 3, d: o };
}

/** THE FIGURE'S FACE: the game's display font (Overpass Heavy, loaded before the landing) */
export const LED_FONT = '"Overpass", "Arial Black", "Helvetica Neue", Arial, sans-serif';
let SCALES = [6, 5, 4, 3, 2, 1];
/** the press screen's big figure's largest dot scale: 6, raised on board size d's desktop and tablet face (the scoreboard's
 *  layout sets it; constants LED_BOARD.sizeD.pressScaleMax) so WIN UP TO 7,777X keeps today's share of the bigger face */
export const setScreenScaleMax = (n: number) => {
	if (SCALES[0] !== n) SCALES = Array.from({ length: n }, (_, i) => n - i);
};
const maskCache = new Map<string, Cv>();
// big figures (3 and up): a heavy sans drawn at the dot size and snapped, as an LED controller rasterizes a font
function vecMask(str: string, s: number): Cv {
	const capH = 7 * s;
	const px = Math.round(capH / 0.72);
	const sp = Math.max(1, Math.round(s * 0.45));
	const font = `900 ${px}px ${LED_FONT}`;
	const probe = mk(4, 4).ctx;
	probe.font = font;
	const ws = [...str].map((ch) => Math.ceil(probe.measureText(ch).width));
	const w = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1) + 2;
	const h = capH + Math.round(s * 1.4);
	const m = mk(w, h);
	const c = m.ctx;
	c.font = font;
	c.fillStyle = '#fff';
	c.textBaseline = 'alphabetic';
	let x = 1;
	[...str].forEach((ch, i) => {
		c.fillText(ch, x, capH);
		x += ws[i] + sp;
	});
	const id = c.getImageData(0, 0, w, h);
	const d = id.data;
	for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 80 ? 0 : Math.min(255, d[i] * 1.4);
	c.putImageData(id, 0, 0);
	return m;
}
/** an LED controller's snap of a soft mask: alpha under 80 off, the rest x1.4 (the face's own rule) */
function snapAlpha(c: Ctx, w: number, h: number) {
	const id = c.getImageData(0, 0, w, h);
	const d = id.data;
	for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 80 ? 0 : Math.min(255, d[i] * 1.4);
	c.putImageData(id, 0, 0);
}
// ---- THE WORDS ON THE FINER GRID (k LEDs per dot) ----------------------------------------------------------------------------
const fineCache = new Map<string, Cv>();
const capOf = new Map<number, number>();
/** Overpass's cap height per px of its size, at a weight */
const capShare = (wt: number) => {
	let m = capOf.get(wt);
	if (m === undefined) {
		const p = mk(4, 4).ctx;
		p.font = `${wt} 200px ${LED_FONT}`;
		m = p.measureText('H').actualBoundingBoxAscent / 200 || 0.7;
		capOf.set(wt, m);
	}
	return m;
};
/** the 5 x 7 sizes (1 and 2) redrawn: each letter in Overpass at `wt` in its own cell (today's width, 7 x s dots tall, k
 *  times finer), a capital filling the cell, a letter with a tail raised until the tail is in it (as the dot font sets
 *  g, p, y), one wider than its cell narrowed to it; a sign the font lacks drawn from its LED outline (ledSigns.ts) */
function cellMask(str: string, s: number, k: number, wt: number): Cv {
	const gl = [...str].map((ch) => FONT[ch] || SENTENCE_SIGNS[ch] || FONT[' ']);
	let w1 = 0;
	gl.forEach((g, i) => (w1 += g[0].length + (i ? 1 : 0)));
	const Hc = Math.round(7 * s * k);
	const px = Hc / capShare(wt);
	const m = mk(Math.max(1, Math.round(w1 * s * k)), Hc);
	const c = m.ctx;
	c.font = `${wt} ${px}px ${LED_FONT}`;
	c.fillStyle = '#fff';
	c.textBaseline = 'alphabetic';
	let x = 0;
	[...str].forEach((ch, i) => {
		if (i) x += 1;
		const gw = gl[i][0].length;
		if (ch !== ' ' && ch !== ' ') {
			const cx = (x + gw / 2) * s * k;
			const room = (gw + 0.6) * s * k;
			const sign = !FONT[ch] && ch in AMOUNT_OUTLINES ? ledSignCanvas(ch, Hc) : null;
			if (sign) {
				const kx = Math.min(1, room / Math.max(1, sign.adv));
				c.drawImage(sign.c, 0, 0, sign.c.width, sign.c.height, cx - ((sign.adv + 2) * kx) / 2, -1, sign.c.width * kx, sign.c.height);
			} else if (!FONT[ch] && SENTENCE_SIGNS[ch]) {
				// (a hand set sign with no outline: its own 5 x 7 dots on the cell, as a block each)
				const rows = SENTENCE_SIGNS[ch];
				const cw = (gw * s * k) / rows[0].length;
				const chh = Hc / 7;
				rows.forEach((r, j) => [...r].forEach((d, q) => d === '#' && c.fillRect(Math.round(x * s * k + q * cw), Math.round(j * chh), Math.max(1, Math.round(cw)), Math.max(1, Math.round(chh)))));
			} else {
				const mt = c.measureText(ch);
				const asc = mt.actualBoundingBoxAscent;
				const desc = Math.max(0, mt.actualBoundingBoxDescent);
				// a glyph taller than the cell ($): shrunk into it; a tail: the letter raised until the tail is in the cell
				const fit = asc + desc > Hc * 1.04 ? Hc / (asc + desc) : 1;
				const base = fit < 1 ? asc * fit : desc > Hc * 0.04 ? Hc - desc : Hc;
				const kx = Math.min(1, room / Math.max(1, mt.width * fit));
				c.save();
				c.translate(cx, Math.round(base));
				c.scale(kx * fit, fit);
				c.fillText(ch, -mt.width / 2, 0);
				c.restore();
			}
		}
		x += gw;
	});
	snapAlpha(c, m.width, m.height);
	return m;
}
/** the heavy face (3 and up) redrawn: each letter at k times today's cap, centred on its place in today's mask (vecMask's
 *  own arithmetic at the dot size), so the mask is today's k times over */
function vecMaskK(str: string, s: number, k: number): Cv {
	const capH1 = 7 * s;
	const px1 = Math.round(capH1 / 0.72);
	const sp1 = Math.max(1, Math.round(s * 0.45));
	const p1 = mk(4, 4).ctx;
	p1.font = `900 ${px1}px ${LED_FONT}`;
	const ws1 = [...str].map((ch) => Math.ceil(p1.measureText(ch).width));
	const w1 = ws1.reduce((a, b) => a + b, 0) + sp1 * (ws1.length - 1) + 2;
	const h1 = capH1 + Math.round(s * 1.4);
	const capH = Math.round(capH1 * k);
	const m = mk(Math.round(w1 * k), Math.round(h1 * k));
	const c = m.ctx;
	c.font = `900 ${Math.round(capH / 0.72)}px ${LED_FONT}`;
	c.fillStyle = '#fff';
	c.textBaseline = 'alphabetic';
	let x = 1;
	[...str].forEach((ch, i) => {
		const mw = c.measureText(ch).width;
		c.fillText(ch, Math.round((x + ws1[i] / 2) * k - mw / 2), capH);
		x += ws1[i] + sp1;
	});
	snapAlpha(c, m.width, m.height);
	return m;
}
/** a line's mask at k LEDs per dot (k = 1: today's) */
function maskAt(str: string, s: number, k: number): Cv {
	if (k === 1) return textMask(str, s);
	const wt = s >= 3 ? 900 : LED_BOARD.density.smallWeight;
	const key = `${str}|${s}|${k}|${wt}`;
	let m = fineCache.get(key);
	if (m) return m;
	m = s >= 3 ? vecMaskK(str, s, k) : cellMask(str, s, k, wt);
	// (kept only once its face is in: never a fallback font for good)
	if (!overpassReady(wt)) return m;
	if (fineCache.size > 1500) fineCache.clear();
	fineCache.set(key, m);
	return m;
}
function textMask(str: string, s: number): Cv {
	const key = str + '|' + s;
	let m = maskCache.get(key);
	if (m) return m;
	if (s >= 3) {
		m = vecMask(str, s);
		maskCache.set(key, m);
		return m;
	}
	let g = grid1(str);
	if (s === 2) g = epx(g);
	m = mk(g.w, g.h);
	const id = m.ctx.createImageData(g.w, g.h);
	for (let i = 0; i < g.d.length; i++) if (g.d[i]) id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = id.data[i * 4 + 3] = 255;
	m.ctx.putImageData(id, 0, 0);
	maskCache.set(key, m);
	return m;
}
const twCache = new Map<string, number>();
export const textW = (str: string, s: number): number => {
	const key = str + '|' + s;
	let w = twCache.get(key);
	if (w === undefined) {
		w = s >= 3 ? textMask(str, s).width : grid1(str).w * s;
		twCache.set(key, w);
	}
	return w;
};
/** the gap between two letters as the whole word's mask sets them (a dot scale's), and where a letter's own mask (drawn
 *  alone) starts in it: the 5 x 7 font (1 and 2) puts one dot scale between cells; the heavy face (3 and up) a gap of
 *  0.45 of the scale between glyph advances, each mask padded 1 dot either side */
export const letterGap = (s: number): number => (s >= 3 ? Math.max(1, Math.round(s * 0.45)) - 2 : s);
const inkCache = new Map<string, { l: number; r: number; t: number; b: number }>();
/** the lit part of a line's mask: its first and last lit column (r exclusive) and row (b exclusive); all 0 when unlit */
export const textInk = (str: string, s: number): { l: number; r: number; t: number; b: number } => {
	const key = str + '|' + s;
	let k = inkCache.get(key);
	if (k) return k;
	const m = textMask(str, s);
	const d = m.ctx.getImageData(0, 0, m.width, m.height).data;
	let l = m.width;
	let r = 0;
	let t = m.height;
	let b = 0;
	for (let y = 0; y < m.height; y++)
		for (let x = 0; x < m.width; x++)
			if (d[(y * m.width + x) * 4 + 3] > 40) {
				if (x < l) l = x;
				if (x + 1 > r) r = x + 1;
				if (y < t) t = y;
				if (y + 1 > b) b = y + 1;
			}
	k = r > l ? { l, r, t, b } : { l: 0, r: 0, t: 0, b: 0 };
	inkCache.set(key, k);
	return k;
};
// a solid colour line is drawn once and kept (only the gold figure is recoloured every step: its shine moves)
const solidCache = new Map<string, Cv>();
let tmp: Cv | null = null;
export type Fill = string | ((t: Ctx, w: number, h: number) => CanvasGradient | string);
export function drawText(g: Ctx, str: string, x: number, y: number, s: number, fill: Fill, post?: ((t: Ctx, w: number, h: number) => void) | null) {
	// (the finer grid: the line's mask made for the face's own density, drawn at its own size, its corner on a whole LED)
	const k = kOf(g);
	const m = maskAt(str, s, k);
	if (typeof fill === 'string' && !post) {
		const key = `${str}|${s}|${fill}|${k}`;
		let c = solidCache.get(key);
		if (!c) {
			c = mk(m.width, m.height);
			c.ctx.drawImage(m, 0, 0);
			c.ctx.globalCompositeOperation = 'source-in';
			c.ctx.fillStyle = fill;
			c.ctx.fillRect(0, 0, m.width, m.height);
			c.ctx.globalCompositeOperation = 'source-over';
			if (k === 1 || overpassReady(s >= 3 ? 900 : LED_BOARD.density.smallWeight)) solidCache.set(key, c);
		}
		blit(g, c, x, y);
		return;
	}
	tmp ??= mk(8, 8);
	if (tmp.width < m.width || tmp.height < m.height) {
		tmp.width = Math.max(tmp.width, m.width);
		tmp.height = Math.max(tmp.height, m.height);
	}
	const t = tmp.ctx;
	t.clearRect(0, 0, tmp.width, tmp.height);
	t.globalCompositeOperation = 'source-over';
	t.drawImage(m, 0, 0);
	t.globalCompositeOperation = 'source-in';
	t.fillStyle = typeof fill === 'function' ? fill(t, m.width, m.height) : fill;
	t.fillRect(0, 0, m.width, m.height);
	if (post) {
		t.globalCompositeOperation = 'source-atop';
		post(t, m.width, m.height);
	}
	t.globalCompositeOperation = 'source-over';
	blit(g, tmp, x, y, 0, 0, m.width, m.height);
}
function wrap(text: string, s: number, maxW: number): string[] | null {
	const words = text.split(' ');
	const lines: string[] = [];
	let cur = '';
	for (const w of words) {
		const t = cur ? cur + ' ' + w : w;
		if (textW(t, s) <= maxW) cur = t;
		else {
			if (!cur) return null;
			lines.push(cur);
			cur = w;
			if (textW(cur, s) > maxW) return null;
		}
	}
	if (cur) lines.push(cur);
	return lines;
}
function wrapEven(text: string, s: number, maxW: number): string[] | null {
	const g = wrap(text, s, maxW);
	if (!g || g.length < 2) return g;
	let best = g;
	for (let w = maxW - s; w > 0; w -= s) {
		const t = wrap(text, s, w);
		if (!t || t.length > g.length) break;
		best = t;
	}
	return best;
}
type Block = { text: string; scales: number[]; color: string; gap?: number };
type Laid = { lines: { text: string; s: number; color: string; y: number; w: number; h: number }[]; h: number };
const layCache = new Map<string, Laid>();
const lineGap = (s: number) => (s === 1 ? 3 : s * 2);
function layoutText(blocks: Block[], maxW: number, maxH: number): Laid {
	const key = JSON.stringify(blocks) + maxW + '|' + maxH;
	let r = layCache.get(key);
	if (!r) {
		r = layoutText0(blocks, maxW, maxH);
		layCache.set(key, r);
	}
	return r;
}
function layoutText0(blocks: Block[], maxW: number, maxH: number): Laid {
	let best: Laid | null = null;
	for (let level = 0; level < 4; level++) {
		const out: Laid['lines'] = [];
		let y = 0;
		let ok = true;
		blocks.forEach((b, bi) => {
			if (!ok) return;
			const s = b.scales[Math.min(level, b.scales.length - 1)];
			const lines = wrapEven(b.text, s, maxW);
			if (!lines) {
				ok = false;
				return;
			}
			if (bi) y += b.gap ?? 5;
			lines.forEach((ln, li) => {
				if (li) y += lineGap(s);
				out.push({ text: ln, s, color: b.color, y, w: textW(ln, s), h: 7 * s });
				y += 7 * s;
			});
		});
		if (!ok) continue;
		best = { lines: out, h: y };
		if (y <= maxH) return best;
	}
	return best || { lines: [], h: 0 };
}
function drawLayout(g: Ctx, lay: Laid, x: number, y: number, w: number, align: 'left' | 'center') {
	for (const ln of lay.lines) drawText(g, ln.text, align === 'left' ? x : x + (w - ln.w) / 2, y + ln.y, ln.s, ln.color);
}

// ---- the pictures (one small sheet, game/ledArtSpec.ts frames) ----
// (vehicle: Grandma's car and Santa's sleigh carry their riders since 2026-11-19, tools/led_seated.py; the vehicle's box in
// the picture, px, which drawFit fits, the rider rising above it)
export type ArtSheet = { image: CanvasImageSource; frames: Record<string, { x: number; y: number; w: number; h: number; vehicle?: { x: number; y: number; w: number; h: number } }> };
let ART: ArtSheet | null = null;
export const setLedArt = (sheet: ArtSheet | null) => {
	ART = sheet;
	artCache.clear();
};
// THE WILD PICTURES (constants LED_SIGN.wilds, tools/build_led_wilds.py): their own small sheet per device tier, drawn the
// same way as the pictures above (art: the stepped downscale and the LED punch)
let WILDS: ArtSheet | null = null;
/** the Wild sheet's device tier (the face screen's patch places are per tier, LED_WILDS.tiers[tier].facePlaces) */
let WILDS_TIER: 'full' | 'phone' = 'full';
export const setLedWildArt = (sheet: ArtSheet | null, tier: 'full' | 'phone' = 'full') => {
	WILDS = sheet;
	WILDS_TIER = tier;
	artCache.clear();
	faceReset();
};
const artCache = new Map<string, Cv>();
const size = (name: string, src?: number[] | null): [number, number] => {
	if (src) return [src[2], src[3]];
	const f = ART?.frames[name];
	return f ? [f.w, f.h] : [1, 1];
};
// one picture at one size in dots: a stepped downscale, then an LED punch (saturation and lift), baked once; on the finer
// grid baked at k times the dots (from the sheet itself: the picture's own detail, never today's bake blown up). `keep`
// false: baked and handed back, not kept (the face screen's whole face bakes a patch is cut from)
function art(name: string, src: number[] | null, dw: number, dh: number, k = 1, sheet: ArtSheet | null = ART, keep = true): Cv {
	dw = Math.max(1, Math.round(Math.max(1, Math.round(dw)) * k));
	dh = Math.max(1, Math.round(Math.max(1, Math.round(dh)) * k));
	const key = (sheet && sheet === WILDS ? 'wilds:' : '') + name + '|' + (src ? src.join(',') : '') + '|' + dw + 'x' + dh;
	let c = artCache.get(key);
	if (c) return c;
	c = mk(dw, dh);
	const f = sheet?.frames[name];
	if (!sheet || !f) return c;
	let [sx, sy, sw, sh] = src || [0, 0, f.w, f.h];
	sx += f.x;
	sy += f.y;
	let cur: CanvasImageSource = sheet.image;
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
	if (keep) artCache.set(key, c);
	return c;
}
function drawFit(g: Ctx, name: string, box: Rect, opts: { src?: number[] | null; dx?: number; dy?: number; top?: boolean; alpha?: number } = {}): Rect {
	const src = opts.src || null;
	const v = src ? null : ART?.frames[name]?.vehicle;
	if (v) {
		// THE RIDERS (Corey 2026-11-19): the VEHICLE fits the box as the empty one did; its rider rises above the box
		const [pw, ph] = size(name, null);
		const k = Math.min(box.w / v.w, box.h / v.h);
		const vw = Math.round(v.w * k);
		const vh = Math.round(v.h * k);
		const dw = Math.round(pw * k);
		const dh = Math.round(ph * k);
		const x = Math.round(box.x + (box.w - vw) / 2 - v.x * k + (opts.dx || 0));
		const y = Math.round(opts.top ? box.y - (dh - vh) : box.y + box.h - dh) + (opts.dy || 0);
		const a = art(name, null, dw, dh, kOf(g));
		if (opts.alpha !== undefined) g.globalAlpha = opts.alpha;
		blit(g, a, x, y);
		g.globalAlpha = 1;
		return { x: Math.round(x + v.x * k), y: y + dh - vh, w: vw, h: vh };
	}
	const [sw, sh] = size(name, src);
	const k = Math.min(box.w / sw, box.h / sh);
	const dw = Math.round(sw * k);
	const dh = Math.round(sh * k);
	const x = Math.round(box.x + (box.w - dw) / 2 + (opts.dx || 0));
	const y = Math.round(opts.top ? box.y : box.y + box.h - dh) + (opts.dy || 0);
	const a = art(name, src, dw, dh, kOf(g));
	if (opts.alpha !== undefined) g.globalAlpha = opts.alpha;
	blit(g, a, x, y);
	g.globalAlpha = 1;
	return { x, y, w: dw, h: dh };
}
const RUN_FRAMES = 8;
const RUN_FW = 125;
const RUN_FH = 108;
const runSrc = (i: number) => [i * RUN_FW, 0, RUN_FW, RUN_FH];

// ---- small helpers ----
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const ease = (t: number) => {
	t = clamp(t, 0, 1);
	return t * t * (3 - 2 * t);
};
export const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
function hash(n: number) {
	const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
}
/** one dot of a decoration (ledGrid dotAt: ledN(k, 1) LEDs square on the finer grid) */
const dot = dotAt;

// ---- the words (constants LED_SIGN.text; the max win from config) ----
export type LedText = {
	win: { top: string; num: string };
	sleigh: { head: string; body: string; mult: string; bodyScales?: number[] };
	car: { head: string; body: string; mult: string; bodyScales?: number[] };
	/** the face screen's line (LED_SIGN.text faceHead, faceBody) */
	face: { head: string; body: string };
	ticker: string;
};

// ---- SCREEN 1: WIN UP TO / the max win ----
// (in LEDs since 2026-11-19: the ring one dot in, its bulbs one dot square, one every three dots, running nine dots a second,
// each a whole number of LEDs on the face's grid, the same all round; at k = 1 the dots as before)
function border(g: Ctx, W: number, H: number, t: number) {
	const k = kOf(g);
	const u = ledN(k, 1);
	const pts = ringPts(Math.round(W * k), Math.round(H * k), Math.round(k), 1, u);
	const per = ledN(k, 3);
	const cols = [C.red, C.green, C.gold, C.ice];
	const step = Math.floor(t * 9 * k);
	for (let i = 0; i < pts.length; i++) {
		if ((i + step) % per !== 0) continue;
		g.fillStyle = cols[Math.floor((i + step) / per) % 4];
		fillP(g, pts[i][0], pts[i][1], u, u);
	}
}
const goldFill = (t: Ctx, _w: number, h: number) => {
	const gr = t.createLinearGradient(0, 0, 0, h);
	gr.addColorStop(0, '#fff6b0');
	gr.addColorStop(0.45, '#ffd02a');
	gr.addColorStop(1, '#ff8a10');
	return gr;
};
function shine(phase: number) {
	return (t: Ctx, w: number, h: number) => {
		const x = -h + phase * (w + 2 * h);
		const gr = t.createLinearGradient(x - h * 0.6, 0, x + h * 0.6, h);
		gr.addColorStop(0, 'rgba(255,255,255,0)');
		gr.addColorStop(0.5, 'rgba(255,255,255,0.85)');
		gr.addColorStop(1, 'rgba(255,255,255,0)');
		t.fillStyle = gr;
		t.fillRect(0, 0, w, h);
	};
}
function twinkles(g: Ctx, box: Rect, t: number, n: number) {
	for (let k = 0; k < n; k++) {
		const per = 1.1;
		const off = k * (per / n);
		const cyc = Math.floor((t + off) / per);
		const p = (t + off) / per - cyc;
		const x = box.x + hash(k * 13 + cyc * 7.3) * box.w;
		const y = box.y + hash(k * 29 + cyc * 3.1) * box.h;
		const a = Math.sin(Math.PI * p);
		const r = a > 0.75 ? 2 : a > 0.35 ? 1 : 0;
		const col = k % 2 ? C.white : C.yellow;
		g.globalAlpha = 0.35 + 0.65 * a;
		// (in LEDs: the middle one dot square, each arm step one dot, on the face's grid)
		const q = kOf(g);
		const u = ledN(q, 1);
		const px = Math.round(x * q);
		const py = Math.round(y * q);
		g.fillStyle = col;
		fillP(g, px, py, u, u);
		for (let i = 1; i <= r; i++) {
			fillP(g, px - i * u, py, u, u);
			fillP(g, px + i * u, py, u, u);
			fillP(g, px, py - i * u, u, u);
			fillP(g, px, py + i * u, u, u);
		}
		g.globalAlpha = 1;
	}
}
function screenWin(g: Ctx, W: number, H: number, t: number, T: LedText) {
	border(g, W, H, t);
	const ins = 4;
	const tall = W / H < 1.7;
	const num = T.win.num;
	const top = T.win.top;
	const ph = (t * 0.62) % 1;
	if (!tall) {
		let s = 1;
		for (const c of SCALES)
			if (textW(num, c) + 2 * 34 + 16 <= W - 2 * ins && 7 * c + 14 + 6 <= H - 2 * ins - 6) {
				s = c;
				break;
			}
		const ts = textW(top, 2) <= textW(num, s) + 30 ? 2 : 1;
		const nw = textW(num, s);
		const blockH = 7 * ts + Math.max(5, s) + 7 * s;
		const by = Math.round((H - blockH) / 2);
		drawText(g, top, (W - textW(top, ts)) / 2, by, ts, C.white);
		const nx = (W - nw) / 2;
		const ny = by + 7 * ts + Math.max(5, s);
		drawText(g, num, nx, ny, s, goldFill, ph < 0.55 ? shine(ph / 0.55) : null);
		twinkles(g, { x: nx - 6, y: by - 4, w: nw + 12, h: blockH + 8 }, t, 6);
		const side = Math.floor((W - nw) / 2) - ins - 8;
		const ch = H - 2 * ins - 2;
		drawFit(g, 'reindeer_col', { x: ins + 2, y: ins + 1, w: side, h: ch });
		drawFit(g, 'grandma_col', { x: W - ins - 2 - side, y: ins + 1, w: side, h: ch });
	} else {
		let s = 1;
		for (const c of SCALES)
			if (textW(num, c) <= W - 2 * ins - 4) {
				s = c;
				break;
			}
		const ts = textW(top, 2) <= W - 2 * ins - 4 ? 2 : 1;
		const nw = textW(num, s);
		const by = ins + 4;
		drawText(g, top, (W - textW(top, ts)) / 2, by, ts, C.white);
		const ny = by + 7 * ts + Math.max(4, s);
		drawText(g, num, (W - nw) / 2, ny, s, goldFill, ph < 0.55 ? shine(ph / 0.55) : null);
		twinkles(g, { x: (W - nw) / 2 - 4, y: by - 2, w: nw + 8, h: ny + 7 * s - by + 4 }, t, 6);
		const rowY = ny + 7 * s + 5;
		const rowH = H - ins - 2 - rowY;
		if (rowH > 12) {
			const names = ['reindeer_col', 'santa_col', 'grandma_col'];
			const ws = names.map((n) => {
				const [w, h] = size(n);
				return (w / h) * rowH;
			});
			const total = ws.reduce((a, b) => a + b, 0);
			const avail = W - 2 * ins - 8;
			const k = Math.min(1, avail / (total + 8));
			let x = (W - (total * k + 8)) / 2;
			names.forEach((n, i) => {
				drawFit(g, n, { x, y: rowY + rowH * (1 - k), w: ws[i] * k, h: rowH * k });
				x += ws[i] * k + 4;
			});
		}
	}
}

// ---- SCREENS 2 and 3: the strikes ----
const cloudCell = (g: Ctx, box: Rect) => {
	noteOld('cloud');
	const [cw, chh] = size('cloud');
	const sh = Math.min(chh, cw * (box.h / Math.max(1, box.w)));
	const a = art('cloud', [0, (chh - sh) / 2, cw, sh], box.w, box.h, kOf(g));
	blit(g, a, Math.round(box.x), Math.round(box.y));
};
// (in LEDs: each rule one dot tall, the dashes three dots on and two off, whole LEDs on the face's grid)
function lanes(g: Ctx, P: Rect, rowsTop: number, cellH: number, NR: number) {
	const k = kOf(g);
	const u = ledN(k, 1);
	const x0 = Math.round(P.x * k);
	const x1 = Math.round((P.x + P.w) * k);
	const dash = ledN(k, 3);
	const per = dash + ledN(k, 2);
	for (let r = 0; r <= NR; r++) {
		const y = Math.round((rowsTop + r * cellH) * k);
		if (r === 0 || r === NR) {
			g.fillStyle = 'rgba(200,215,235,0.30)';
			fillP(g, x0, y, x1 - x0, u);
		} else {
			g.fillStyle = r * 2 === NR ? 'rgba(255,205,40,0.55)' : 'rgba(230,235,245,0.30)';
			for (let x = x0; x < x1; x += per) fillP(g, x, y, dash, u);
		}
	}
}
function burst(g: Ctx, cx: number, cy: number, p: number, rMax: number) {
	if (p <= 0 || p >= 1) return;
	const r = rMax * ease(p * 1.4);
	const fade = 1 - span(p, 0.45, 1);
	for (let k = 0; k < 10; k++) {
		const a = (k / 10) * Math.PI * 2 + 0.3;
		for (let i = Math.max(1, Math.floor(r * 0.45)); i <= r; i++) {
			g.globalAlpha = fade * (1 - (i / (rMax + 1)) * 0.5);
			dot(g, cx + Math.cos(a) * i, cy + Math.sin(a) * i * 0.85, i > r * 0.75 ? C.white : C.yellow);
		}
	}
	g.globalAlpha = 1;
}
// (in LEDs: the frame `th` dots thick, the rows one dot, whole LEDs on the face's grid)
function redBox(g: Ctx, b: Rect, th: number, rows: number[] | null, color: string = C.red) {
	noteOld('box');
	const k = kOf(g);
	const t = ledN(k, th);
	const x0 = Math.round(b.x * k);
	const x1 = Math.round((b.x + b.w) * k);
	const y0 = Math.round(b.y * k);
	const y1 = Math.round((b.y + b.h) * k);
	g.fillStyle = color;
	fillP(g, x0 - t, y0 - t, x1 - x0 + 2 * t, t);
	fillP(g, x0 - t, y1, x1 - x0 + 2 * t, t);
	fillP(g, x0 - t, y0, t, y1 - y0);
	fillP(g, x1, y0, t, y1 - y0);
	if (rows) {
		g.fillStyle = 'rgba(255,58,46,0.6)';
		for (const y of rows) if (y > b.y + 1 && y < b.y + b.h - 1) fillP(g, x0, Math.round(y * k), x1 - x0, ledN(k, 1));
	}
}
function multLabel(g: Ctx, str: string, cx: number, bottom: number, maxW: number) {
	const s = textW(str, 2) + 2 <= maxW ? 2 : 1;
	const w = textW(str, s);
	const h = 7 * s;
	const x = Math.round(cx - w / 2);
	const y = Math.round(bottom - h - 2);
	g.clearRect(x - 1, y - 1, w + 2, h + 2);
	drawText(g, str, x, y, s, C.yellow);
}
// ---- THE WILD PICTURES (constants LED_SIGN.wilds; tools/build_led_wilds.py, game/ledWildsSpec.ts) ----
// The game's own Wilds as they stand on the road: the picture (its frame, backdrop and character) stretched over the old
// red box's outer edge, the WILD word and the number in their in-game places (shares of the picture), each baked at the
// dots by art (the stepped downscale and the LED punch)
type WildKind = keyof typeof LED_WILDS.pictures;
type WildPart = { cx: number; cy: number; w: number; h: number };
/** the letters' look in force: 'stripes' or 'solid', or null for the pictures of before (LED_SIGN.wilds.look 'today', or
 *  the sheet not in) */
export const wildLook = (): 'stripes' | 'solid' | null => {
	const L = LED_SIGN.wilds.look;
	return L === 'today' || !WILDS ? null : L;
};
/** the picture's outer edge for a box framed `th` dots thick (the old red box's outer edge) */
const wildOuter = (b: Rect, th: number): Rect => ({ x: b.x - th, y: b.y - th, w: b.w + 2 * th, h: b.h + 2 * th });
function wildPic(g: Ctx, kind: WildKind, box: Rect, alpha = 1) {
	const a = art(LED_WILDS.pictures[kind].frame, null, box.w, box.h, kOf(g), WILDS);
	g.globalAlpha = alpha;
	blit(g, a, box.x, box.y);
	g.globalAlpha = 1;
	noteWild(g, kind + ':picture');
}
/** THE COLUMN GROWING IN ITS OWN LOOK (LED_SIGN.wilds.grow, Corey 2026-11-21): the finished column's picture `full`, shown
 *  in the growing window `win` (both outer edges, dots): the garland's top rows and the baubles' corners ride the window's
 *  top edge, its bottom rows and corners the bottom edge, and the picture between them stands where it stands in the full
 *  column. Partial blits of the one baked picture (whole LEDs on the face's grid), no mask; grown, it is the whole picture. */
function wildGrow(g: Ctx, kind: WildKind, full: Rect, win: Rect) {
	const k = kOf(g);
	const a = art(LED_WILDS.pictures[kind].frame, null, full.w, full.h, k, WILDS);
	const W = a.width;
	const H = a.height;
	const Y0 = Math.round(full.y * k);
	// (each edge measured from its own end of the column: the grown window is exactly the picture)
	const top = clamp(Math.round((win.y - full.y) * k), 0, H);
	const bot = clamp(H - Math.round((full.y + full.h - win.y - win.h) * k), top, H);
	if (wildRec) wildRec.grow = Math.round(((bot - top) / H) * 1000) / 1000;
	if (top === 0 && bot === H) return wildPic(g, kind, full);
	const G = LED_SIGN.wilds.grow;
	const half = Math.floor((bot - top) / 2);
	const cap = Math.min(half, Math.round(G.cap * H));
	const ch = Math.min(half, Math.max(cap, Math.round(G.corner.h * H)));
	const cw = Math.min(Math.floor(W / 2), Math.round(G.corner.w * W));
	const at = (row: number) => (Y0 + row) / k;
	// the picture where it stands, between the two edges
	if (bot - top > 2 * cap) blit(g, a, full.x, at(top + cap), 0, top + cap, W, bot - top - 2 * cap);
	// the garland's top and bottom rows on the window's edges
	if (cap > 0) {
		blit(g, a, full.x, at(top), 0, 0, W, cap);
		blit(g, a, full.x, at(bot - cap), 0, H - cap, W, cap);
	}
	// the baubles' rows below and above the garland, at the corners
	if (ch > cap) {
		const n = ch - cap;
		for (const x of [0, W - cw]) {
			blit(g, a, full.x + x / k, at(top + cap), x, cap, cw, n);
			blit(g, a, full.x + x / k, at(bot - ch), x, H - ch, cw, n);
		}
	}
	noteWild(g, kind + ':picture');
}
/** the word or the number of a Wild over its picture `box`, in the look; false when the sheet has no such picture (the
 *  number's text not the one baked: the caller draws today's) */
function wildPart(g: Ctx, kind: WildKind, part: 'word' | 'mult', look: 'stripes' | 'solid', box: Rect, text: string, alpha = 1): boolean {
	const P = LED_WILDS.pictures[kind] as { mult: WildPart; word?: WildPart; text: string };
	const q = part === 'word' ? P.word : P.mult;
	const name = `${kind}_${part}_${look}`;
	if (!q || !WILDS?.frames[name]) return false;
	if (part === 'mult' && text.toLowerCase() !== P.text.toLowerCase()) return false;
	const w = q.w * box.w;
	const h = q.h * box.h;
	const a = art(name, null, w, h, kOf(g), WILDS);
	g.globalAlpha = alpha;
	blit(g, a, box.x + q.cx * box.w - a.width / kOf(g) / 2, box.y + q.cy * box.h - a.height / kOf(g) / 2);
	g.globalAlpha = 1;
	noteWild(g, `${name}`);
	return true;
}
/** what the last strike screen drew from the Wild sheet (the probes): its screen, the look and the sheet frames; `old` the
 *  elements of the pictures of before it drew (the cloud, the red or plain box, Santa's small picture: 'today' only),
 *  `grow` the share of the column's picture shown (the sleigh), `t` the screen's time of that frame in ms */
let wildRec: { kind: 'sleigh' | 'car'; look: string; names: string[]; old: string[]; grow: number | null; t: number } | null = null;
function noteWild(_g: Ctx, name: string) {
	if (wildRec && !wildRec.names.includes(name)) wildRec.names.push(name);
}
const noteOld = (name: string) => {
	if (wildRec && !wildRec.old.includes(name)) wildRec.old.push(name);
};
export const wildsDrawn = () => (wildRec ? { kind: wildRec.kind, look: wildRec.look, names: wildRec.names.slice(), old: wildRec.old.slice(), grow: wildRec.grow, t: wildRec.t } : null);
const blinkOn = (mt: number) => mt > 0 && !(mt > 0.2 && mt < 0.3) && !(mt > 0.4 && mt < 0.5);
function screenStrike(g: Ctx, W: number, H: number, t: number, kind: 'sleigh' | 'car', TX: LedText) {
	const T = TX[kind];
	const tall = W / H < 1.7;
	const blocks: Block[] = [
		{ text: T.head, scales: [2, 2, 1], color: C.gold },
		{ text: T.body, scales: T.bodyScales || [1], color: C.white, gap: 6 },
	];
	let P: Rect;
	let lay: Laid;
	let tx: number;
	let ty: number;
	let tw: number;
	if (!tall) {
		const pw = Math.round(clamp(W - 166, W * 0.36, W * 0.46));
		P = { x: 3, y: 3, w: pw, h: H - 6 };
		tx = P.x + P.w + 6;
		tw = W - tx - 4;
		lay = layoutText(blocks, tw, H - 8);
		ty = Math.round((H - lay.h) / 2);
	} else {
		tw = W - 8;
		lay = layoutText(blocks, tw, Math.round(H * 0.46));
		tx = 4;
		ty = H - 4 - lay.h;
		P = { x: 3, y: 3, w: W - 6, h: ty - 6 };
	}
	drawLayout(g, lay, tx, ty, tw, tall ? 'center' : 'left');
	const NR = kind === 'sleigh' ? 4 : tall ? 2 : 3;
	const cellH = Math.max(6, Math.floor(P.h / NR));
	const cellW = Math.round(cellH * 1.45);
	const rowsTop = P.y + Math.floor((P.h - NR * cellH) / 2);
	const colX = P.x + P.w - cellW - (tall ? Math.round(P.w * 0.2) : 3);
	lanes(g, P, rowsTop, cellH, NR);
	const row = kind === 'sleigh' ? 2 : 1;
	const cell = { x: colX, y: rowsTop + row * cellH, w: cellW, h: cellH };
	const RUN0 = 0.45;
	const HIT = 1.35;
	const th = cellH >= 22 ? 2 : 1;
	const rh = Math.round(cellH * 1.2);
	const rw = Math.round((rh * RUN_FW) / RUN_FH);
	const x0 = P.x - rw;
	const x1 = cell.x - Math.round(rw * 0.78);
	if (t >= RUN0 && t < HIT + 0.05) {
		const p = span(t, RUN0, HIT);
		const x = x0 + (x1 - x0) * (p * p * 0.35 + p * 0.65);
		const fi = Math.floor(t * 15) % RUN_FRAMES;
		const a = art('run_strip', runSrc(fi), rw, rh, kOf(g));
		const bob = fi % 4 < 2 ? 0 : -1;
		blit(g, a, x, cell.y + cell.h - rh + 1 + bob);
	}
	const shake = t > HIT && t < HIT + 0.22 ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0;
	const target = kind === 'sleigh' ? 'sleigh' : 'car';
	if (t < HIT + 0.12) drawFit(g, target, { x: cell.x + 1, y: cell.y + 1, w: cell.w - 2, h: cell.h - 2 }, { dx: shake });
	burst(g, cell.x + 1, cell.y + cell.h / 2, span(t, HIT, HIT + 0.42), Math.round(cellH * 0.7));
	if (t >= HIT + 0.1) {
		let box = { ...cell };
		if (kind === 'sleigh') {
			const gp = ease(span(t, HIT + 0.35, HIT + 0.8));
			const yTop = cell.y + (rowsTop - cell.y) * gp;
			const yBot = cell.y + cell.h + (rowsTop + 4 * cellH - cell.y - cell.h) * gp;
			box = { x: cell.x, y: Math.round(yTop), w: cell.w, h: Math.round(yBot) - Math.round(yTop) };
		}
		const look = wildLook();
		wildRec = { kind, look: look ?? 'today', names: [], old: [], grow: null, t: Math.round(t * 1000) };
		const rows = [1, 2, 3].map((r) => rowsTop + r * cellH);
		if (look && kind === 'sleigh') {
			// THE COLUMN AS IT STANDS ON THE ROAD (LED_SIGN.wilds): Santa's column in its garland grows from the struck
			// cell on the old box's beat, in its own look from the first frame (LED_SIGN.wilds.grow, Corey 2026-11-21),
			// the flash as it stands, and his green number blinks on at his feet
			const full = wildOuter({ x: cell.x, y: rowsTop, w: cell.w, h: 4 * cellH }, th);
			const outer = wildOuter(box, th);
			wildGrow(g, 'santa', full, outer);
			const flash = span(t, HIT + 0.8, HIT + 0.9) * (1 - span(t, HIT + 0.9, HIT + 1.0));
			if (flash > 0) {
				g.globalAlpha = flash * 0.8;
				g.fillStyle = '#fff';
				g.fillRect(box.x, box.y, box.w, box.h);
				g.globalAlpha = 1;
			}
			if (blinkOn(t - (HIT + 1.25)) && !wildPart(g, 'santa', 'mult', look, outer, T.mult)) multLabel(g, T.mult, box.x + box.w / 2, box.y + box.h, box.w + 2 * th + 6);
			return;
		}
		if (look) {
			// THE GRANDMA WILD AS SHE STANDS ON THE ROAD: her brawl cloud in the green garland covers the car, the candy
			// WILD fades in at its corner, her gold number blinks on
			const outer = wildOuter(box, th);
			wildPic(g, 'grandma', outer);
			const wt = span(t, HIT + 0.35, HIT + 0.5);
			if (wt > 0) wildPart(g, 'grandma', 'word', look, outer, 'WILD', wt);
			if (blinkOn(t - (HIT + 0.75)) && !wildPart(g, 'grandma', 'mult', look, outer, T.mult)) multLabel(g, T.mult, box.x + box.w / 2, box.y + box.h, box.w + 2 * th + 6);
			return;
		}
		cloudCell(g, box);
		if (kind === 'sleigh') {
			const sp = span(t, HIT + 0.85, HIT + 1.2);
			if (sp > 0) {
				const inner = { x: box.x + 1, y: box.y + 1, w: box.w - 2, h: box.h - 2 };
				noteOld('santa_col');
				drawFit(g, 'santa_col', inner, { dy: Math.round((1 - ease(sp)) * 5), alpha: ease(sp) });
			}
			redBox(g, box, th, rows);
			const flash = span(t, HIT + 0.8, HIT + 0.9) * (1 - span(t, HIT + 0.9, HIT + 1.0));
			if (flash > 0) {
				g.globalAlpha = flash * 0.8;
				g.fillStyle = '#fff';
				g.fillRect(box.x, box.y, box.w, box.h);
				g.globalAlpha = 1;
			}
			if (blinkOn(t - (HIT + 1.25))) multLabel(g, T.mult, box.x + box.w / 2, box.y + box.h, box.w + 2 * th + 6);
		} else {
			redBox(g, box, th, null);
			let s = 1;
			for (const c of [4, 3, 2]) {
				const room = c <= 2 ? box.h - 2 : box.h * 0.75;
				if (textW('WILD', c) + 6 <= box.w && 14 * c + 3 <= room) {
					s = c;
					break;
				}
			}
			const ms = s;
			const stackH = 7 * s + 3 + 7 * ms;
			const fitsInside = stackH + 2 <= box.h;
			const y0 = box.y + Math.round((box.h - (fitsInside ? stackH : 7 * s)) / 2);
			const wt = span(t, HIT + 0.35, HIT + 0.5);
			if (wt > 0) {
				g.globalAlpha = wt;
				drawText(g, 'WILD', box.x + (box.w - textW('WILD', s)) / 2, y0, s, C.red);
				g.globalAlpha = 1;
			}
			if (blinkOn(t - (HIT + 0.75))) {
				const w = textW(T.mult, ms);
				const mx = Math.round(box.x + (box.w - w) / 2);
				const my = fitsInside ? y0 + 7 * s + 3 : box.y + box.h + th + 2;
				g.clearRect(mx - 1, my - 1, w + 2, 7 * ms + 2);
				drawText(g, T.mult, mx, my, ms, C.yellow);
			}
		}
	}
}

/** THE TICKER: the line, pulsing; scrolled when it does not fit */
export function screenTicker(g: Ctx, W: number, H: number, t: number, text: string) {
	const s = 1;
	const w = textW(text, s);
	const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.cos(t * Math.PI * 2 * 0.75));
	g.globalAlpha = pulse;
	const y = Math.round((H - 7) / 2);
	if (w <= W - 4) drawText(g, text, (W - w) / 2, y, s, '#ffe7b0');
	else drawText(g, text, W - ((t * 26) % (w + W)), y, s, '#ffe7b0');
	g.globalAlpha = 1;
}

// ---- SCREEN 0: THE REINDEER'S FACE (constants LED_SIGN.face, Corey 2026-11-21: led_intro_face_screen_r2_2026-11-21) ---------
// The approved face across the board, ONE REINDEER. TWO GRUDGES. under it, Santa and Grandma small beside the line (the
// led-art pictures, cropped), and the face alive on a script: pre-drawn pictures swapped on a clock. Each eye and ear state
// is a PATCH, a rectangle cut from a whole face picture that differs from the face only inside it (tools/build_led_wilds.py
// packs them on the Wild sheet, game/ledWildsSpec.ts face). Its bake is the face's own bake with the patch put in (the same
// picture size, the same stepped downscale, so every LED outside the change is the face's LED exactly), cut to the patch's
// LEDs; drawn, the patch REPLACES those LEDs (cleared, then copied), so a turned ear leaves dark LEDs where it was. Both
// bakes come from the face frame copied alone onto its own canvas (baked straight from the packed sheet, the sheet's
// neighbours and size move the joins by up to 88 levels). The breath puffs are small pictures drawn over the face, the
// right nostril's mirrored about the nostrils' middle, faded by the draw's alpha. Plain 2D canvas: no filter, mask, shader
// or blob: URL.
type FaceSpec = {
	frame: string;
	nose: number;
	nostril: number[];
	profile: (number[] | null)[];
	puffBox: number[];
	patches: Record<string, number[]>;
	puffs: Record<'nostril' | 'mock', { frame: string; x: number; y: number; w: number; h: number }[]>;
	rim: number[][];
};
const FACE_SPEC = LED_WILDS.face as unknown as FaceSpec;
const facePlaces = (): Record<string, number[]> => LED_WILDS.tiers[WILDS_TIER].facePlaces as unknown as Record<string, number[]>;
/** the rows of the board's face the strip's snow cap covers at its highest bump (the scoreboard's layout sets it) */
let FACE_CLEAR = 4;
export const setFaceClear = (rows: number) => {
	const v = Math.max(0, rows);
	if (v === FACE_CLEAR) return;
	FACE_CLEAR = v;
	faceLayCache.clear();
};
function faceReset() {
	faceLayCache.clear();
	patchCache.clear();
	faceCv = null;
}

// Santa and Grandma (the press screen's own led-art pictures, cropped and scaled only). cutout: the standing figures
// (santa_col: the sleigh screen's Santa before the Wild column; grandma_col: the max win screen's Grandma), cropped to the
// bust (hat or hair to the shoulders) or the head, px of their frames. tile: the Santa Wild column's head (the Wild sheet,
// px of the full tier's 559 px wide frame). Grandma's car Wild shows no face, so her picture is always grandma_col.
const FACE_PIC_CROPS = {
	santa: { bust: [2, 0, 85, 76], head: [8, 0, 64, 58] },
	grandma: { bust: [0, 0, 111, 82], head: [12, 0, 80, 62] },
} as const;
const SANTA_TILE = [80, 70, 400, 440];
type Who = 'santa' | 'grandma';
type FacePic = { frame: string; src: number[]; sheet: 'art' | 'wild'; aspect: number };
function facePicOf(who: Who): FacePic {
	const P = LED_SIGN.face.pics;
	if (who === 'santa' && P.santa === 'tile' && WILDS?.frames.santa) {
		const s = WILDS.frames.santa.w / 559;
		const src = SANTA_TILE.map((v) => Math.round(v * s));
		return { frame: 'santa', src, sheet: 'wild', aspect: src[2] / src[3] };
	}
	const src = [...FACE_PIC_CROPS[who][P.crop]];
	return { frame: who === 'santa' ? 'santa_col' : 'grandma_col', src, sheet: 'art', aspect: src[2] / src[3] };
}

// ---- the layout (the line at the foot, the face over it, the pictures in the bottom corners) ----
type FaceRow = { text: string; s: number; color: string; x: number; y: number };
type FacePicBox = Rect & { who: Who; side: 'left' | 'right' };
type FaceLay = { area: Rect; face: Rect; clip: Rect; beats: FaceRow[][]; textScale: number; rows: number; pics: FacePicBox[]; puffRects: Rect[] };
const faceLayCache = new Map<string, FaceLay>();
const faceLineGap = (s: number) => (s === 1 ? 3 : s * 2);
const afterSpace = (a: string, s: number) => textW(a + ' ', s) + (s >= 3 ? letterGap(s) : s);
const faceFoot = () => Math.max(4, Math.ceil(FACE_CLEAR) + 2);
/** the light string's lowest lit row at the tug's deepest swing (scoreboard/ambient.ts pressScreensLit: 2 + sag x 1.6 + bulb 2) */
const stringFloor = (H: number) => Math.ceil(2 + Math.max(3, H * 0.05) * 1.6 + 1 + 2);
const puffSet = () => FACE_SPEC.puffs[LED_SIGN.face.art.puffs] ?? FACE_SPEC.puffs.nostril;

function faceLayout(W: number, H: number, T: LedText): FaceLay {
	const F = LED_SIGN.face;
	const Lo = F.layout;
	const P = F.pics;
	const key = `${W}x${H}|${Lo.scale}|${Lo.offsetDots}|${Lo.textScale}|${FACE_CLEAR}|${P.on}|${P.sizeCap}|${P.crop}|${P.santa}|${P.santaSide}|${F.puffSize}|${F.puffs}|${F.art.puffs}|${WILDS_TIER}|${T.face.head}|${T.face.body}`;
	let r = faceLayCache.get(key);
	if (r) return r;
	const fr = WILDS?.frames[FACE_SPEC.frame];
	const fw = fr?.w ?? 16;
	const fh = fr?.h ?? 9;
	const L1 = T.face.head;
	const L2 = T.face.body;
	const tw = W - 8;
	const oneW = (s: number) => afterSpace(L1, s) + textW(L2, s);
	const twoW = (s: number) => Math.max(textW(L1, s), textW(L2, s));
	const textH = (s: number, n: number) => n * 7 * s + (n - 1) * faceLineGap(s);
	const pick = (s: number): [number, number] | null => (oneW(s) <= tw ? [s, 1] : twoW(s) <= tw ? [s, 2] : null);
	let p: [number, number] | null;
	if (Lo.textScale === '3') p = pick(3) ?? pick(2) ?? pick(1);
	else if (Lo.textScale === '2') p = pick(2) ?? pick(1);
	else if (Lo.textScale === '1') p = pick(1);
	else {
		// auto: 2 on one row where it fits, 2 on two rows where the face keeps 60% of the board, else 1
		p = oneW(2) <= tw ? [2, 1] : null;
		if (!p && twoW(2) <= tw && H - faceFoot() - textH(2, 2) - 6 >= H * 0.6) p = [2, 2];
		if (!p) p = pick(1);
	}
	const [ts, rows] = p ?? [1, 2];
	const ty = H - faceFoot() - textH(ts, rows);
	let beats: FaceRow[][];
	if (rows === 1) {
		const x0 = Math.round((W - oneW(ts)) / 2);
		beats = [[{ text: L1, s: ts, color: C.gold, x: x0, y: ty }], [{ text: L2, s: ts, color: C.white, x: x0 + afterSpace(L1, ts), y: ty }]];
	} else {
		beats = [[{ text: L1, s: ts, color: C.gold, x: Math.round((W - textW(L1, ts)) / 2), y: ty }], [{ text: L2, s: ts, color: C.white, x: Math.round((W - textW(L2, ts)) / 2), y: ty + 7 * ts + faceLineGap(ts) }]];
	}
	const area = { x: 3, y: 3, w: W - 6, h: ty - 6 };
	const k0 = Math.min(area.w / fw, area.h / (fh * (1 - Lo.trimMax)));
	const k = k0 * Lo.scale;
	const dw = Math.round(fw * k);
	const dh = Math.round(fh * k);
	const x = Math.round(area.x + (area.w - dw) / 2);
	const y = Math.round(area.y + area.h - dh) + Lo.offsetDots;
	const face = { x, y, w: dw, h: dh };
	const clip = { x: Math.max(0, x), y: Math.max(area.y, y), w: 0, h: 0 };
	clip.w = Math.min(W, x + dw) - clip.x;
	clip.h = Math.min(area.y + area.h, y + dh) - clip.y;
	const puffRects = fr ? puffSet().flatMap((_, i) => (['l', 'r'] as const).map((s) => puffRect(face, i, s, area))) : [];
	r = { area, face, clip, beats, textScale: ts, rows, pics: [], puffRects };
	if (P.on && fr) placeFacePics(W, H, r);
	if (faceLayCache.size > 200) faceLayCache.clear();
	faceLayCache.set(key, r);
	return r;
}

/** a puff frame's box in dots: its place in the face scaled about the nostril by LED_SIGN.face.puffSize, the right
 *  nostril's mirrored about the nostrils' middle; never below the face's area (the line is under it) */
function puffRect(face: Rect, i: number, side: 'l' | 'r', area: Rect): Rect {
	const P = puffSet()[i];
	const size = LED_SIGN.face.puffSize;
	const [nx, ny] = FACE_SPEC.nostril;
	let cx = nx + (P.x + P.w / 2 - nx) * size;
	const cy = ny + (P.y + P.h / 2 - ny) * size;
	if (side === 'r') cx = 2 * FACE_SPEC.nose - cx;
	const w = Math.max(2, Math.round(P.w * size * face.w));
	const h = Math.max(2, Math.round(P.h * size * face.h));
	const y = Math.min(Math.round(face.y + cy * face.h - h / 2), area.y + area.h - h);
	return { x: Math.round(face.x + cx * face.w - w / 2), y, w, h };
}

/** THE PICTURES' PLACES: the biggest box of the picture's shape (up to sizeCap of the board's height) in each bottom corner
 *  that keeps clearDots clear of the line, of the face's drawn dots (every ear frame included) and of the puffs' reach,
 *  below the light string's deepest swing, edgeDots inside the board's edge and above the line's foot (the strip's snow).
 *  A box low beside the line scores over a bigger one higher up; both get the same height. */
function placeFacePics(W: number, H: number, L: FaceLay) {
	const P = LED_SIGN.face.pics;
	const cd = P.clearDots;
	const ed = P.edgeDots;
	const occ = new Uint8Array(W * H);
	const top = stringFloor(H) + 1;
	const bottom = H - faceFoot();
	const mark = (x0: number, y0: number, x1: number, y1: number) => {
		for (let yy = Math.max(0, y0); yy < Math.min(H, y1); yy++) for (let xx = Math.max(0, x0); xx < Math.min(W, x1); xx++) occ[yy * W + xx] = 1;
	};
	mark(0, 0, W, top);
	mark(0, bottom, W, H);
	mark(0, 0, ed, H);
	mark(W - ed, 0, W, H);
	// (each row from where it lands: dropDots above its place)
	for (const row of L.beats.flat()) mark(row.x - cd, row.y - cd - LED_SIGN.face.script.dropDots, row.x + textW(row.text, row.s) + cd, row.y + 7 * row.s + cd);
	const F = L.face;
	for (let yy = F.y; yy < F.y + F.h; yy++) {
		if (yy < L.clip.y || yy >= L.clip.y + L.clip.h) continue;
		const band = FACE_SPEC.profile[Math.min(99, Math.max(0, Math.floor(((yy + 0.5 - F.y) / F.h) * 100)))];
		if (!band) continue;
		mark(Math.floor(F.x + band[0] * F.w) - cd, yy - cd, Math.ceil(F.x + band[1] * F.w) + cd, yy + cd + 1);
	}
	if (LED_SIGN.face.puffs) for (const p of L.puffRects) mark(p.x - cd, p.y - cd, p.x + p.w + cd, p.y + p.h + cd);
	// (a summed area table: a box is free when it holds no marked dot)
	const S = new Int32Array((W + 1) * (H + 1));
	for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) S[(yy + 1) * (W + 1) + xx + 1] = occ[yy * W + xx] + S[yy * (W + 1) + xx + 1] + S[(yy + 1) * (W + 1) + xx] - S[yy * (W + 1) + xx];
	const free = (x: number, y: number, w: number, h: number) => x >= 0 && y >= 0 && x + w <= W && y + h <= H && S[(y + h) * (W + 1) + x + w] - S[y * (W + 1) + x + w] - S[(y + h) * (W + 1) + x] + S[y * (W + 1) + x] === 0;
	const who = (s: 'left' | 'right'): Who => (s === P.santaSide ? 'santa' : 'grandma');
	const cap = Math.max(P.minDots, Math.round(P.sizeCap * H));
	/** the lowest place for a box of height h on a side: its bottom row and its x (centred in the free run from the edge) */
	const fit = (side: 'left' | 'right', h: number): { x: number; yb: number } | null => {
		const w = Math.max(4, Math.round(h * facePicOf(who(side)).aspect));
		for (let yb = bottom; yb - h >= top; yb--) {
			const y = yb - h;
			const xs: number[] = [];
			if (side === 'left') {
				for (let x = ed; x + w <= W / 2; x++) {
					if (free(x, y, w, h)) xs.push(x);
					else if (xs.length) break;
				}
			} else {
				for (let x = W - ed - w; x >= W / 2; x--) {
					if (free(x, y, w, h)) xs.push(x);
					else if (xs.length) break;
				}
			}
			if (xs.length) return { x: Math.round((xs[0] + xs[xs.length - 1]) / 2), yb };
		}
		return null;
	};
	let best = { h: 0, score: -1e9 };
	for (let h = cap; h >= P.minDots; h--) {
		const a = fit('left', h);
		const b = fit('right', h);
		if (!a || !b) continue;
		const score = h - P.raisePenalty * (bottom - a.yb) - P.raisePenalty * (bottom - b.yb);
		if (score > best.score) best = { h, score };
	}
	if (!best.h) return;
	for (const side of ['left', 'right'] as const) {
		const f = fit(side, best.h)!;
		const w = Math.max(4, Math.round(best.h * facePicOf(who(side)).aspect));
		L.pics.push({ x: f.x, y: f.yb - best.h, w, h: best.h, who: who(side), side });
	}
}

// ---- the face's bakes ----
/** the face frame copied alone onto a canvas of its size (both the face's and the patches' bakes start from it) */
let faceCv: { key: string; cv: Cv } | null = null;
function faceFrameCanvas(): Cv {
	const ff = WILDS!.frames[FACE_SPEC.frame];
	const key = `${WILDS_TIER}|${ff.w}x${ff.h}`;
	if (faceCv && faceCv.key === key) return faceCv.cv;
	const cv = mk(ff.w, ff.h);
	cv.ctx.drawImage(WILDS!.image, ff.x, ff.y, ff.w, ff.h, 0, 0, ff.w, ff.h);
	faceCv = { key, cv };
	return cv;
}
function faceBake(g: Ctx, L: FaceLay): Cv {
	const cv = faceFrameCanvas();
	const name = `face~base~${WILDS_TIER}`;
	return art(name, null, L.face.w, L.face.h, kOf(g), { image: cv, frames: { [name]: { x: 0, y: 0, w: cv.width, h: cv.height } } });
}
type PatchBake = { img: Cv; lx: number; ly: number; seam: number };
const patchCache = new Map<string, PatchBake>();
const patchKey = (g: Ctx, L: FaceLay, name: string) => `${name}|${L.face.w}x${L.face.h}|${kOf(g)}|${WILDS_TIER}`;
/** a patch's bake: the face picture with the patch put in, baked whole at the face's size (not kept), cut to the patch's
 *  LEDs plus 2; `seam` the largest difference from the face's own bake on the cut's border LEDs (0: it joins exactly) */
function patchBake(g: Ctx, L: FaceLay, name: string): PatchBake | null {
	const k = kOf(g);
	const key = patchKey(g, L, name);
	let p = patchCache.get(key);
	if (p) return p;
	const ff = WILDS!.frames[FACE_SPEC.frame];
	const pf = WILDS!.frames[name];
	const at = facePlaces()[name];
	const r = FACE_SPEC.patches[name];
	if (!pf || !at || !r) return null;
	const [px, py] = at;
	const tmp = mk(ff.w, ff.h);
	tmp.ctx.drawImage(faceFrameCanvas(), 0, 0);
	// (only the patch's inside goes in: its outer margin is the face's own pixels again, so the separately compressed copies
	// of them can not move an LED outside the change)
	const m = Math.max(0, Math.floor((6 * ff.w) / 1518) - 1);
	tmp.ctx.clearRect(px + m, py + m, pf.w - 2 * m, pf.h - 2 * m);
	tmp.ctx.drawImage(WILDS!.image, pf.x + m, pf.y + m, pf.w - 2 * m, pf.h - 2 * m, px + m, py + m, pf.w - 2 * m, pf.h - 2 * m);
	const vname = `face~${name}~${WILDS_TIER}`;
	const a = art(vname, null, L.face.w, L.face.h, k, { image: tmp, frames: { [vname]: { x: 0, y: 0, w: ff.w, h: ff.h } } }, false);
	const base = faceBake(g, L);
	const lx = Math.max(0, Math.floor(r[0] * a.width) - 2);
	const ly = Math.max(0, Math.floor(r[1] * a.height) - 2);
	const lw = Math.min(a.width, Math.ceil(r[2] * a.width) + 2) - lx;
	const lh = Math.min(a.height, Math.ceil(r[3] * a.height) + 2) - ly;
	const img = mk(lw, lh);
	img.ctx.drawImage(a, lx, ly, lw, lh, 0, 0, lw, lh);
	// the join: the cut's border LEDs against the face's bake
	const A = img.ctx.getImageData(0, 0, lw, lh).data;
	const B = base.ctx.getImageData(lx, ly, lw, lh).data;
	let seam = 0;
	for (let yy = 0; yy < lh; yy++)
		for (let xx = 0; xx < lw; xx++) {
			if (yy > 0 && yy < lh - 1 && xx > 0 && xx < lw - 1) continue;
			const i = (yy * lw + xx) * 4;
			for (let c = 0; c < 4; c++) seam = Math.max(seam, Math.abs(A[i + c] - B[i + c]));
		}
	p = { img, lx, ly, seam };
	if (patchCache.size > 64) patchCache.clear();
	patchCache.set(key, p);
	return p;
}
/** the LED rectangle of the board a face bake's (bx, by, bw, bh) lands on, cut to the face's clip */
function onFace(g: Ctx, L: FaceLay, bx: number, by: number, bw: number, bh: number) {
	const k = kOf(g);
	const X0 = Math.round(L.face.x * k);
	const Y0 = Math.round(L.face.y * k);
	const cx0 = Math.round(L.clip.x * k);
	const cy0 = Math.round(L.clip.y * k);
	const cx1 = cx0 + Math.round(L.clip.w * k);
	const cy1 = cy0 + Math.round(L.clip.h * k);
	const x0 = Math.max(cx0, X0 + bx);
	const y0 = Math.max(cy0, Y0 + by);
	const x1 = Math.min(cx1, X0 + bx + bw);
	const y1 = Math.min(cy1, Y0 + by + bh);
	return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, sx: x0 - X0 - bx, sy: y0 - Y0 - by };
}
function drawFaceBase(g: Ctx, L: FaceLay) {
	const k = kOf(g);
	const a = faceBake(g, L);
	const sx = Math.round((L.clip.x - L.face.x) * k);
	const sy = Math.round((L.clip.y - L.face.y) * k);
	const sw = Math.min(a.width - sx, Math.round(L.clip.w * k));
	const sh = Math.min(a.height - sy, Math.round(L.clip.h * k));
	if (sw > 0 && sh > 0) blit(g, a, L.face.x + sx / k, L.face.y + sy / k, sx, sy, sw, sh);
}
/** a patch drawn: its LEDs cleared, then its bake copied over them */
function drawPatch(g: Ctx, L: FaceLay, name: string) {
	const k = kOf(g);
	const p = patchBake(g, L, name);
	if (!p) return;
	const r = onFace(g, L, p.lx, p.ly, p.img.width, p.img.height);
	if (r.w <= 0 || r.h <= 0) return;
	clearP(g, r.x, r.y, r.w, r.h);
	g.drawImage(p.img, r.sx, r.sy, r.w, r.h, r.x / k, r.y / k, r.w / k, r.h / k);
	faceRec?.patches.push({ name, x: r.x, y: r.y, w: r.w, h: r.h, seam: p.seam });
}
/** the nose's rim as LED rectangles on the board (shares of the face, rounded inward) */
function rimLeds(g: Ctx, L: FaceLay) {
	const k = kOf(g);
	return FACE_SPEC.rim.map(([a, b, c, d]) => {
		const x0 = Math.ceil((L.face.x + a * L.face.w) * k);
		const y0 = Math.ceil((L.face.y + b * L.face.h) * k);
		return { x: x0, y: y0, w: Math.floor((L.face.x + c * L.face.w) * k) - x0, h: Math.floor((L.face.y + d * L.face.h) * k) - y0 };
	});
}
function drawPuff(g: Ctx, L: FaceLay, i: number, side: 'l' | 'r', alpha: number) {
	const k = kOf(g);
	const P = puffSet()[i];
	const box = puffRect(L.face, i, side, L.area);
	const a = art(P.frame, null, box.w, box.h, k, WILDS);
	const xP = Math.round(box.x * k);
	const yP = Math.round(box.y * k);
	g.globalAlpha = alpha;
	blitP(g, a, xP, yP, side === 'r');
	g.globalAlpha = 1;
	if (!faceRec) return;
	// (the audit: the puff's lit LEDs, alpha at or over the LED punch's 70, inside the nose's rim)
	let onRim = 0;
	if (faceAudit) {
		const d = a.ctx.getImageData(0, 0, a.width, a.height).data;
		for (const r of rimLeds(g, L)) {
			const x0 = Math.max(r.x, xP);
			const y0 = Math.max(r.y, yP);
			const x1 = Math.min(r.x + r.w, xP + a.width);
			const y1 = Math.min(r.y + r.h, yP + a.height);
			for (let yy = y0; yy < y1; yy++)
				for (let xx = x0; xx < x1; xx++) {
					const sx = side === 'r' ? a.width - 1 - (xx - xP) : xx - xP;
					if (d[((yy - yP) * a.width + sx) * 4 + 3] >= 70) onRim++;
				}
		}
	}
	faceRec.puffs.push({ frame: P.frame, side, x: box.x, y: box.y, w: box.w, h: box.h, alpha: Math.round(alpha * 100) / 100, onRim });
}
function drawFacePic(g: Ctx, b: FacePicBox) {
	const P = facePicOf(b.who);
	const a = P.sheet === 'wild' ? art(P.frame, P.src, b.w, b.h, kOf(g), WILDS) : art(P.frame, P.src, b.w, b.h, kOf(g));
	blit(g, a, b.x, b.y);
}

// ---- the clock: what shows at the screen's time t (s; the screen holds holdS, then dissolves over transS) ----
type Eye = 'centre' | 'gaze_l' | 'gaze_r' | 'half' | 'closed';
type FacePose = { eye: Eye; earL: 0 | 5 | 12; earR: 0 | 5 | 12; puff: { i: number; alpha: number } | null; show: [boolean, boolean]; drop: [number, number]; note: string };
/** a blink: half, closed, half */
const blinkAt = (u: number): Eye | null => {
	const B = LED_SIGN.face.blinkTiming;
	return u < 0 || u >= B.totalS ? null : u < B.halfS || u >= B.openS ? 'half' : 'closed';
};
/** an ear flick: 5, 12 degrees (tip up), 5 */
const flickAt = (u: number): 0 | 5 | 12 => {
	const E = LED_SIGN.face.flickTiming;
	return u < 0 || u >= E.totalS ? 0 : u < E.upS || u >= E.downS ? 5 : 12;
};
/** a snort's puff: frames 0 to 3, the last fading out */
const puffAt = (u: number): { i: number; alpha: number } | null => {
	const P = LED_SIGN.face.puffTiming;
	if (u < 0) return null;
	for (let i = 0; i < P.frames.length; i++) if (u < P.frames[i]) return { i, alpha: 1 };
	if (u < P.fadeToS) return { i: P.frames.length, alpha: 1 - ease(span(u, P.fadeFromS, P.fadeToS)) };
	return null;
};
/** THE SCRIPT (a pure function of the screen's time, like screenStrike's beats) */
export function facePoseAt(t: number): FacePose {
	const F = LED_SIGN.face;
	const S = F.script;
	const santaGaze: Eye = F.pics.santaSide === 'left' ? 'gaze_l' : 'gaze_r';
	const grandmaGaze: Eye = F.pics.santaSide === 'left' ? 'gaze_r' : 'gaze_l';
	const pose: FacePose = { eye: 'centre', earL: 0, earR: 0, puff: null, show: [true, true], drop: [0, 0], note: 'glare' };
	const hold = F.glanceHoldS;
	if (F.land) {
		pose.show = [t >= S.land1, t >= S.land2];
		pose.drop = [Math.round(S.dropDots * (1 - ease(span(t, S.land1, S.land1 + S.dropS)))), Math.round(S.dropDots * (1 - ease(span(t, S.land2, S.land2 + S.dropS))))];
	}
	if (F.puffs) pose.puff = puffAt(t - S.snort);
	if (F.earTwitch) {
		const f = flickAt(t - S.flick);
		pose.earL = f;
		pose.earR = f;
	}
	const g1 = S.glanceAt;
	const g2 = g1 + hold + S.between;
	const gEnd = g2 + hold;
	if (F.glance) {
		if (t >= g1 && t < g1 + hold) pose.eye = santaGaze;
		else if (t >= g2 && t < gEnd) pose.eye = grandmaGaze;
	}
	if (F.blink) {
		const b = blinkAt(t - ((F.glance ? gEnd : g1) + S.blinkAfter));
		if (b) pose.eye = b;
	}
	pose.note = pose.eye === santaGaze ? 'glance at Santa' : pose.eye === grandmaGaze ? 'glance at Grandma' : pose.eye !== 'centre' ? 'blink' : pose.puff ? 'snort' : pose.earL || pose.earR ? 'ear twitch' : 'glare';
	return pose;
}
const lidName = (side: 'l' | 'r', eye: Eye) => `eye_${side}_${eye}${(eye === 'half' || eye === 'closed') && LED_SIGN.face.art.lids === 'mock' ? '_mock' : ''}`;
/** the warm up's order: the patches in the order the script first needs them */
const warmOrder = (): string[] => ['ear_l_5', 'ear_r_5', 'ear_l_12', 'ear_r_12', ...(['gaze_l', 'gaze_r', 'half', 'closed'] as Eye[]).flatMap((e) => [lidName('l', e), lidName('r', e)])];

/** what the last face screen frame drew (the probes): its time, pose, the face and its clip, each patch drawn (LEDs, its
 *  join), each puff (dots, its lit LEDs on the nose's rim when audited), the pictures, the line's rows shown, the rim in
 *  LEDs and the patches baked so far. faceAudit: the puffs' rim count is worked out (dev hook) */
type FaceRec = { t: number; pose: FacePose; k: number; W: number; H: number; face: Rect; clip: Rect; patches: { name: string; x: number; y: number; w: number; h: number; seam: number }[]; puffs: { frame: string; side: string; x: number; y: number; w: number; h: number; alpha: number; onRim: number }[]; pics: FacePicBox[]; rows: FaceRow[]; rim: Rect[]; warmed: number };
let faceRec: FaceRec | null = null;
let faceLast: FaceRec | null = null;
let faceAudit = false;
export const setFaceAudit = (on: boolean) => (faceAudit = on);
export const faceDrawn = () => (faceLast ? JSON.parse(JSON.stringify(faceLast)) : null);

/** THE SCREEN: the face, its moving pieces, the pictures and the line at the screen's time `t` (s) */
function screenFace(g: Ctx, W: number, H: number, t: number, T: LedText) {
	if (!WILDS?.frames[FACE_SPEC.frame]) return;
	const L = faceLayout(W, H, T);
	const P = facePoseAt(t);
	const k = kOf(g);
	faceRec = { t: Math.round(t * 1000), pose: P, k, W, H, face: L.face, clip: L.clip, patches: [], puffs: [], pics: L.pics, rows: [], rim: faceAudit ? rimLeds(g, L) : [], warmed: 0 };
	drawFaceBase(g, L);
	if (P.earL) drawPatch(g, L, `ear_l_${P.earL}`);
	if (P.earR) drawPatch(g, L, `ear_r_${P.earR}`);
	if (P.eye !== 'centre') {
		drawPatch(g, L, lidName('l', P.eye));
		drawPatch(g, L, lidName('r', P.eye));
	}
	if (P.puff) for (const s of ['l', 'r'] as const) drawPuff(g, L, P.puff.i, s, P.puff.alpha);
	for (const b of L.pics) drawFacePic(g, b);
	for (let i = 0; i < 2; i++) {
		if (!P.show[i]) continue;
		for (const r of L.beats[i]) {
			drawText(g, r.text, r.x, r.y - P.drop[i], r.s, r.color);
			faceRec.rows.push({ ...r, y: r.y - P.drop[i] });
		}
	}
	// THE WARM UP: the next patch not baked yet, one a step (a whole face bake each: never all at once on one frame)
	const order = warmOrder();
	const next = order.find((n) => !patchCache.has(patchKey(g, L, n)));
	if (next) patchBake(g, L, next);
	faceRec.warmed = order.filter((n) => patchCache.has(patchKey(g, L, n))).length;
	faceLast = faceRec;
	faceRec = null;
}
/** the face screen's layout on a W x H board (the node check, tools/led_face_check.mjs; the probes) */
export const faceLayoutFor = (W: number, H: number, T: LedText) => faceLayout(W, H, T);
type ScreenFn = (g: Ctx, W: number, H: number, t: number, T: LedText) => void;
export type ScreenName = 'face' | 'win' | 'sleigh' | 'car';
const SCREEN_FNS: Record<ScreenName, ScreenFn> = {
	face: (g, W, H, t, T) => screenFace(g, W, H, t, T),
	win: (g, W, H, t, T) => screenWin(g, W, H, t, T),
	sleigh: (g, W, H, t, T) => screenStrike(g, W, H, t, 'sleigh', T),
	car: (g, W, H, t, T) => screenStrike(g, W, H, t, 'car', T),
};
/** THE CYCLE'S ORDER: the max win, the sleigh, the car, and the face at LED_SIGN.face.position (Corey 2026-11-21: first) */
export const SCREEN_NAMES: readonly ScreenName[] = ((): ScreenName[] => {
	const rest: ScreenName[] = ['win', 'sleigh', 'car'];
	const at = LED_SIGN.face.position;
	return at === 'first' ? ['face', ...rest] : at === 'beforeSanta' ? ['win', 'face', 'sleigh', 'car'] : [...rest, 'face'];
})();
export const SCREENS: ScreenFn[] = SCREEN_NAMES.map((n) => SCREEN_FNS[n]);

/** the screens' DISSOLVE (the page's default): a noise threshold from screen a to screen b, a bright edge */
export function dissolve(out: Ctx, a: Cv, b: Cv, noise: Float32Array, e: number, _W: number, _H: number) {
	e = clamp(e, 0, 1);
	// (per LED: the canvases' own pixels, one noise value each; a face on the finer grid has k x k per dot)
	const A = a.ctx.getImageData(0, 0, a.width, a.height);
	const B = b.ctx.getImageData(0, 0, b.width, b.height);
	const D = A.data;
	const E = B.data;
	for (let i = 0; i < noise.length; i++) {
		const j = i * 4;
		if (noise[i] < e - 0.05) {
			D[j] = E[j];
			D[j + 1] = E[j + 1];
			D[j + 2] = E[j + 2];
			D[j + 3] = E[j + 3];
		} else if (noise[i] < e) {
			D[j] = 255;
			D[j + 1] = 250;
			D[j + 2] = 235;
			D[j + 3] = 230;
		}
	}
	out.putImageData(A, 0, 0);
}
/** the slow bright band that runs down the face */
export function shimmer(o: Ctx, W: number, H: number, T: number) {
	const y = (((T * 0.3) % 1.3) - 0.15) * H;
	o.globalCompositeOperation = 'source-atop';
	const gr = o.createLinearGradient(0, y - 7, 0, y + 7);
	gr.addColorStop(0, 'rgba(255,255,255,0)');
	gr.addColorStop(0.5, 'rgba(255,255,255,0.16)');
	gr.addColorStop(1, 'rgba(255,255,255,0)');
	o.fillStyle = gr;
	o.fillRect(0, y - 7, W, 14);
	o.globalCompositeOperation = 'source-over';
}
/** the press: the dots go out in a random order (e from 0 to 1) */
export function powerOff(o: Ctx, _W: number, _H: number, noise: Float32Array, e: number) {
	if (e <= 0) return;
	const A = o.getImageData(0, 0, o.canvas.width, o.canvas.height);
	const D = A.data;
	for (let i = 0; i < noise.length; i++) if (noise[i] < e) D[i * 4 + 3] = 0;
	o.putImageData(A, 0, 0);
}
