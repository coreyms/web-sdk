// THE LED BILLBOARD'S SCREENS (Corey 2026-11-16, led_billboard_r2_2026-11-16: "That looks amazing"; constants LED_SIGN,
// game/landing/ledSign.ts). Each screen is drawn on a small 2D canvas at ONE PIXEL PER DOT, exactly as Corey's mock page
// draws it (its functions, ported): the 5x7 dot font scaled by EPX and Scale3x for the small lines, a heavy face snapped
// to the dots for the big figure (the game's own Overpass Heavy, not the page's Arial Black, which phones do not have),
// the pictures stepped down to the dot size with the LED punch, the three screens (the max win, the sleigh strike, the
// Grandma car strike) and the ticker. The sign (game/landing/ledSign.ts) shows these canvases through the dot grille.
// Plain 2D canvas drawing (composite modes on small canvases), no filter.
// THE FINER GRID (2026-11-19, game/scoreboard/ledGrid.ts, constants LED_BOARD.density): on a face of k LEDs per dot the
// words are redrawn at the LED grid (fineMask: the 5 x 7 sizes in Overpass at density.smallWeight, each letter in its own
// 5 x 7 cell k times finer; the heavy face from 3 up at k times the cap, each letter on today's place), the pictures baked
// at k times the dots, and the decorations set in LEDs; every width and place is today's (textW, textInk, letterGap read
// today's masks), so every layout is today's. At k = 1 every path is exactly as before.

import { LED_BOARD } from '../constants';
import { AMOUNT_OUTLINES, SENTENCE_SIGNS, ledSignCanvas } from '../scoreboard/ledSigns';
import { blit, dotAt, fillP, kOf, ledN, overpassReady, ringPts } from '../scoreboard/ledGrid';

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
const SCALES = [6, 5, 4, 3, 2, 1];
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
export type ArtSheet = { image: CanvasImageSource; frames: Record<string, { x: number; y: number; w: number; h: number }> };
let ART: ArtSheet | null = null;
export const setLedArt = (sheet: ArtSheet | null) => {
	ART = sheet;
	artCache.clear();
};
const artCache = new Map<string, Cv>();
const size = (name: string, src?: number[] | null): [number, number] => {
	if (src) return [src[2], src[3]];
	const f = ART?.frames[name];
	return f ? [f.w, f.h] : [1, 1];
};
// one picture at one size in dots: a stepped downscale, then an LED punch (saturation and lift), baked once; on the finer
// grid baked at k times the dots (from the sheet itself: the picture's own detail, never today's bake blown up)
function art(name: string, src: number[] | null, dw: number, dh: number, k = 1): Cv {
	dw = Math.max(1, Math.round(Math.max(1, Math.round(dw)) * k));
	dh = Math.max(1, Math.round(Math.max(1, Math.round(dh)) * k));
	const key = name + '|' + (src ? src.join(',') : '') + '|' + dw + 'x' + dh;
	let c = artCache.get(key);
	if (c) return c;
	c = mk(dw, dh);
	const f = ART?.frames[name];
	if (!ART || !f) return c;
	let [sx, sy, sw, sh] = src || [0, 0, f.w, f.h];
	sx += f.x;
	sy += f.y;
	let cur: CanvasImageSource = ART.image;
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
	artCache.set(key, c);
	return c;
}
function drawFit(g: Ctx, name: string, box: Rect, opts: { src?: number[] | null; dx?: number; dy?: number; top?: boolean; alpha?: number } = {}): Rect {
	const src = opts.src || null;
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
function redBox(g: Ctx, b: Rect, th: number, rows: number[] | null) {
	const k = kOf(g);
	const t = ledN(k, th);
	const x0 = Math.round(b.x * k);
	const x1 = Math.round((b.x + b.w) * k);
	const y0 = Math.round(b.y * k);
	const y1 = Math.round((b.y + b.h) * k);
	g.fillStyle = C.red;
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
		cloudCell(g, box);
		const rows = [1, 2, 3].map((r) => rowsTop + r * cellH);
		if (kind === 'sleigh') {
			const sp = span(t, HIT + 0.85, HIT + 1.2);
			if (sp > 0) {
				const inner = { x: box.x + 1, y: box.y + 1, w: box.w - 2, h: box.h - 2 };
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

export const SCREENS: ((g: Ctx, W: number, H: number, t: number, T: LedText) => void)[] = [
	(g, W, H, t, T) => screenWin(g, W, H, t, T),
	(g, W, H, t, T) => screenStrike(g, W, H, t, 'sleigh', T),
	(g, W, H, t, T) => screenStrike(g, W, H, t, 'car', T),
];

/** the three screens' DISSOLVE (the page's default): a noise threshold from screen a to screen b, a bright edge */
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
