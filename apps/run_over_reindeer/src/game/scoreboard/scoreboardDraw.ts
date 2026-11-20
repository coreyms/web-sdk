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
// THE FINER GRID (2026-11-19, game/scoreboard/ledGrid.ts, constants LED_BOARD.density): a face of k LEDs per dot. The
// programs lay out in today's dots; the words, the amounts' glyphs and the pictures are made at the LED grid (vglyph at k
// times the cap, each glyph on today's cell; art() baked at k times the dots) and the decorations (the chase borders,
// sparkles, bulbs, single dots, scan lines and edges, stripes, the honk meter) are set in whole LEDs (ledN). Every place,
// size and text box the probes read is in today's dots. At k = 1 every path is exactly as before.
import { SCOREBOARD_ART } from '../scoreboardArtSpec';
import { LED_FONT, drawText, letterGap, mk, textInk, textW, type Cv } from '../landing/ledScreens';
import { ledSignCanvas } from './ledSigns';
import { INTRO_LINE, LED_BOARD } from '../constants';
import { amountNow, tierNow, type Show } from './show';
import { newRace, raceProgress, type Race } from './race';
import { blit, blitP, clearP, copyFace, copyP, dotAt, fillP, kOf, ledN, lwOf, mkFace, overpassReady, ringPts } from './ledGrid';

/** the Max scene's races, one run after another, per show (decoration only: the race's own random source) */
const maxRaces = new WeakMap<Show, Map<number, Race>>();

type Ctx = CanvasRenderingContext2D;

export type Face = {
	/** the face in logical dots (every layout), its LEDs per dot `k` (constants LED_BOARD.density), its LEDs W x H */
	dotsW: number;
	dotsH: number;
	k: number;
	ledW: number;
	ledH: number;
	/** the picture drawn this step, the two scratch faces of a transition, the last step kept for a switch */
	out: Cv;
	a: Cv;
	b: Cv;
	prev: Cv;
	/** one value per LED (the dissolves and the power down go LED by LED) */
	noise: Float32Array;
};
export const makeFaceCanvases = (dotsW: number, dotsH: number, k = 1): Face => {
	const out = mkFace(dotsW, dotsH, k);
	const noise = new Float32Array(out.width * out.height);
	let h = 0x9e3779b9;
	for (let i = 0; i < noise.length; i++) {
		h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) ^ (i * 0xc2b2ae35);
		noise[i] = ((h >>> 0) % 10007) / 10007;
	}
	return { dotsW, dotsH, k, ledW: out.width, ledH: out.height, out, a: mkFace(dotsW, dotsH, k), b: mkFace(dotsW, dotsH, k), prev: mkFace(dotsW, dotsH, k), noise };
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
/** one dot of a decoration (ledGrid dotAt: ledN(k, 1) LEDs square on the finer grid) */
const dot = dotAt;

// ---- THE PICTURES (one sheet; set by the board once it is loaded) ---------------------------------------------------------
let SHEET: CanvasImageSource | null = null;
const artCache = new Map<string, Cv>();
export const setScoreboardArt = (image: CanvasImageSource | null) => {
	SHEET = image;
	artCache.clear();
};
/** the sheet is in (a bake made before it is blank and not kept) */
export const scoreboardArtReady = () => SHEET !== null;
type ArtName = keyof typeof SCOREBOARD_ART.frames;
const frameOf = (name: ArtName) => SCOREBOARD_ART.frames[name];
const size = (name: ArtName, src: number[] | null): [number, number] => {
	if (src) return [src[2], src[3]];
	const f = frameOf(name);
	return f ? [f.w, f.h] : [1, 1];
};
/** one picture at one size in dots: a stepped downscale, then the LED punch (saturation and lift), baked once; on the finer
 *  grid baked at k times the dots, from the sheet itself (never today's bake blown up) */
function art(name: ArtName, src: number[] | null, dw: number, dh: number, k = 1): Cv {
	dw = Math.max(1, Math.round(Math.max(1, Math.round(dw)) * k));
	dh = Math.max(1, Math.round(Math.max(1, Math.round(dh)) * k));
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
/** THE RIDERS (Corey 2026-11-19: "can we put Grandma in the cars, santa in the sleighs in the existing animations?"):
 *  Grandma's car and Santa's sleigh are pictures of the vehicle WITH its rider seated as the road board seats them
 *  (tools/led_seated.py), their frame's `vehicle` the vehicle's box in the picture (px). Every program sizes and places
 *  them by the vehicle as before; the rider rises above it. */
type Box4 = { x: number; y: number; w: number; h: number };
/** THE RIDERS AS DRAWN this step (the probes): per vehicle with its rider, its picture and its vehicle's box in LEDs [x, y, w, h] */
export type RiderRec = { name: string; pic: [number, number, number, number]; vehicle: [number, number, number, number] };
const riderRec = new WeakMap<object, RiderRec[]>();
export const ridersOf = (canvas: object): RiderRec[] => riderRec.get(canvas) ?? [];
const vehicleOf = (name: ArtName): Box4 | null => (frameOf(name) as { vehicle?: Box4 } | undefined)?.vehicle ?? null;
/** a rider's vehicle `h` dots tall, made smaller where needed so the whole picture (the rider's head) fits in `room` dots */
const fitVehicle = (name: ArtName, h: number, room: number) => {
	const v = vehicleOf(name);
	return v ? Math.min(h, (room * v.h) / size(name, null)[1]) : h;
};
/** a picture `h` dots tall with its bottom at yBottom (flip: mirrored); for a vehicle with its rider, `h` is the vehicle's
 *  height and the vehicle's box lands where the empty vehicle did. Returns its width in dots (the vehicle's), the bake and
 *  its corner in LEDs */
function spriteAt(g: Ctx, name: ArtName, x: number, yBottom: number, h: number, flip = false, src: number[] | null = null) {
	const [sw, sh] = size(name, src);
	const k = kOf(g);
	const v = src ? null : vehicleOf(name);
	if (v) {
		const s = h / v.h;
		const pw = Math.max(1, Math.round(sw * s));
		const ph = Math.max(1, Math.round(sh * s));
		const a = art(name, null, pw, ph, k);
		// (mirrored in its own box: the vehicle's left edge is then the mirror of its right)
		const vx = flip ? sw - v.x - v.w : v.x;
		const lx = Math.round((x - vx * s) * k);
		const ly = Math.round((yBottom - ph) * k);
		blitP(g, a, lx, ly, flip);
		const w = Math.max(1, Math.round(v.w * s));
		// (the probes: where the rider's picture and its vehicle landed on this face, in LEDs)
		// (a face's records go at the start of its step, clearTitle; a scratch face of a switch is never cleared, so its list
		// is kept short)
		const rec = riderRec.get(g.canvas) ?? [];
		if (rec.length >= 8) rec.length = 0;
		rec.push({ name, pic: [lx, ly, a.width, a.height], vehicle: [Math.round(x * k), Math.round((yBottom - h) * k), Math.round(w * k), Math.round(h * k)] });
		riderRec.set(g.canvas, rec);
		return { w, a, lx, ly };
	}
	const w = Math.max(1, Math.round((h * sw) / sh));
	const a = art(name, src, w, Math.round(h), k);
	// (on the LED grid: its corner on the LED nearest, so a moving picture steps one LED at a time; mirrored in its own box)
	const lx = Math.round(x * k);
	const ly = Math.round((yBottom - h) * k);
	blitP(g, a, lx, ly, flip);
	return { w, a, lx, ly };
}
function sprite(g: Ctx, name: ArtName, x: number, yBottom: number, h: number, flip = false, src: number[] | null = null): number {
	return spriteAt(g, name, x, yBottom, h, flip, src).w;
}
/** THE REAR WHEEL'S TRAILING EDGE of a vehicle picture facing left (its rear on the right; the plow's van), measured on the
 *  bake itself in its own LEDs: the body's lowest lit row at the picture's middle, then the rightmost lit LED below that row
 *  on the rear half (the rear tire), plus one: the first clear column behind the tire. Once per bake. */
const rearEdges = new WeakMap<object, number>();
function rearWheelEdge(a: Cv): number {
	const got = rearEdges.get(a);
	if (got !== undefined) return got;
	const w = a.width;
	const h = a.height;
	const d = a.ctx.getImageData(0, 0, w, h).data;
	const mid = Math.floor(w / 2);
	let body = -1;
	for (let y = h - 1; y >= 0; y--)
		if (d[(y * w + mid) * 4 + 3] > 0) {
			body = y;
			break;
		}
	let e = mid;
	for (let y = body + 1; y < h; y++)
		for (let x = w - 1; x >= mid; x--)
			if (d[(y * w + x) * 4 + 3] > 0) {
				e = Math.max(e, x + 1);
				break;
			}
	rearEdges.set(a, e);
	return e;
}
const RUN_FRAMES = 8;
const RUN_FW = 125;
const RUN_FH = 108;
const runSrc = (i: number) => [i * RUN_FW, 0, RUN_FW, RUN_FH];
/** the reindeer's run, `h` dots tall (its eight run frames at 15 a second) */
function gallop(g: Ctx, x: number, yBottom: number, h: number, t: number): number {
	const w = Math.round((h * RUN_FW) / RUN_FH);
	const fi = Math.floor(t / 66) % RUN_FRAMES;
	const k = kOf(g);
	const a = art('run_strip', runSrc(fi), w, h, k);
	blitP(g, a, Math.round(x * k), Math.round((yBottom - h) * k));
	return w;
}

// ---- THE AMOUNT: a heavy face per glyph at the dot size, tabular digit cells (the mock's vglyph / drawRow) -------------------
const vgCache = new Map<string, { c: Cv; adv: number }>();
function vglyph(ch: string, cap: number) {
	const key = ch + '|' + cap;
	let g = vgCache.get(key);
	if (g) return g;
	// a currency sign: its LED glyph (ledSigns.ts), never the font's or a fallback font's
	const sign = ledSignCanvas(ch, cap);
	if (sign) {
		vgCache.set(key, sign);
		return sign;
	}
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
/** THE GLYPH ON THE FINER GRID: snapped at k times the cap (LEDs) in weight `wt` (the amounts Heavy, the big board's body
 *  sentence LED_BOARD.density.bodyWeight), its advance in LEDs; drawn on today's cell (drawRow), never today's blown up */
const vgkCache = new Map<string, { c: Cv; advP: number }>();
function vglyphK(ch: string, cap: number, k: number, wt: number) {
	const key = ch + '|' + cap + '|' + k + '|' + wt;
	let g = vgkCache.get(key);
	if (g) return g;
	const capP = Math.round(cap * k);
	const sign = ledSignCanvas(ch, capP);
	if (sign) g = { c: sign.c as unknown as Cv, advP: sign.adv };
	else {
		const font = `${wt} ${capP / 0.72}px ${LED_FONT}`;
		const pr = mk(4, 4).ctx;
		pr.font = font;
		const advP = Math.ceil(pr.measureText(ch).width);
		const c = mk(advP + 2, Math.ceil(capP * 1.4) + 2);
		c.ctx.font = font;
		c.ctx.fillStyle = '#fff';
		c.ctx.textBaseline = 'alphabetic';
		c.ctx.fillText(ch, 1, capP + 1);
		const id = c.ctx.getImageData(0, 0, c.width, c.height);
		const d = id.data;
		for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 80 ? 0 : Math.min(255, d[i] * 1.4);
		c.ctx.putImageData(id, 0, 0);
		g = { c, advP };
		// (kept only once its face is in: never a fallback font for good)
		if (!overpassReady(wt)) return g;
	}
	if (vgkCache.size > 3000) vgkCache.clear();
	vgkCache.set(key, g);
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
/** style: a color, 'gold', or 'cut' (the glyphs punch unlit dots out of what is under them); `wt`: the weight on the finer
 *  grid (today's grid draws Heavy) */
function drawRow(g: Ctx, str: string, x: number, y: number, cap: number, style: string, pulse = 0, wt = 900): number {
	const k = kOf(g);
	if (k !== 1) return drawRowK(g, str, x, y, cap, style, pulse, k, wt);
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
/** drawRow on the finer grid: today's cells and gaps (rowInfo), each glyph made at k times the cap and centred on its cell
 *  in LEDs; the row's top pad is one LED (the glyph's own), as today's is one dot */
let rowTmpK: Cv | null = null;
/** A ROW DRAWN AGAIN (the sentence's lines, a held amount, a title row) is kept made: a row's picture is cached the second
 *  time the same row is asked for in a steady colour (never on its first: a counting amount, new every step, makes no
 *  canvas), up to rowKeepBytes of them */
const rowKept = new Map<string, Cv>();
const rowSeen = new Set<string>();
let rowKeptBytes = 0;
const ROW_KEEP_BYTES = 3 * 1048576;
function drawRowK(g: Ctx, str: string, x: number, y: number, cap: number, style: string, pulse: number, k: number, wt: number): number {
	const ri = rowInfo(str, cap);
	const capP = Math.round(cap * k);
	const h = Math.ceil(capP * 1.4) + 2;
	const w = Math.ceil((ri.w + 4) * k);
	const key = pulse > 0 ? null : str + '|' + cap + '|' + k + '|' + wt + '|' + style;
	let kept = key === null ? undefined : rowKept.get(key);
	if (!kept && key !== null && rowSeen.has(key) && overpassReady(wt)) {
		if (rowKeptBytes + w * h * 4 > ROW_KEEP_BYTES) {
			rowKept.clear();
			rowKeptBytes = 0;
		}
		kept = mk(w, h);
		rowRaster(kept.ctx, str, ri, cap, capP, w, h, k, wt, style, 0);
		rowKept.set(key, kept);
		rowKeptBytes += w * h * 4;
	} else if (key !== null && !kept) {
		if (rowSeen.size > 600) rowSeen.clear();
		rowSeen.add(key);
	}
	let src: Cv;
	if (kept) src = kept;
	else {
		rowTmpK ??= mk(8, 8);
		if (rowTmpK.width < w || rowTmpK.height < h) {
			rowTmpK.width = Math.max(rowTmpK.width, w);
			rowTmpK.height = Math.max(rowTmpK.height, h);
		}
		rowTmpK.ctx.clearRect(0, 0, rowTmpK.width, rowTmpK.height);
		rowRaster(rowTmpK.ctx, str, ri, cap, capP, w, h, k, wt, style, pulse);
		src = rowTmpK;
	}
	const op = g.globalCompositeOperation;
	if (style === 'cut') g.globalCompositeOperation = 'destination-out';
	g.drawImage(src, 0, 0, w, h, Math.round(x * k) / k, (Math.round(y * k) - 1) / k, w / k, h / k);
	g.globalCompositeOperation = op;
	return ri.w;
}
/** a row's glyphs at the LED grid on `t` (cleared), coloured */
function rowRaster(t: Ctx, str: string, ri: { cells: number[]; sp: number }, cap: number, capP: number, w: number, h: number, k: number, wt: number, style: string, pulse: number) {
	t.globalCompositeOperation = 'source-over';
	let cx = 0;
	[...str].forEach((ch, i) => {
		const gl = vglyphK(ch, cap, k, wt);
		t.drawImage(gl.c, Math.round((cx + ri.cells[i] / 2) * k - gl.advP / 2) - 1, 0);
		cx += ri.cells[i] + ri.sp;
	});
	if (style !== 'cut') {
		t.globalCompositeOperation = 'source-in';
		if (style === 'gold') {
			const gr = t.createLinearGradient(0, 1, 0, capP + 1);
			gr.addColorStop(0, '#fff6b0');
			gr.addColorStop(0.45, '#ffd02a');
			gr.addColorStop(1, '#ff9010');
			t.fillStyle = gr;
		} else t.fillStyle = style;
		t.fillRect(0, 0, w, h);
		if (pulse > 0) {
			t.globalCompositeOperation = 'source-atop';
			t.fillStyle = `rgba(255,255,255,${0.75 * pulse})`;
			t.fillRect(0, 0, w, h);
		}
		t.globalCompositeOperation = 'source-over';
	}
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
	plowRec.delete(canvas);
	riderRec.delete(canvas);
};
/** THE BACK BOARD'S TITLE: centered on its lit dots about cx, set letter by letter; `bounce` (the show's clock, or null)
 *  bobs the letters in a wave (the mock's bounceTitle; LED_BOARD.titles.bounce its strength), `march` (the scene's clock,
 *  or null) drops them in one after another (marchAt) */
function boardTitle(g: Ctx, str: string, cx: number, y: number, ts: number, style: string, opts: { bounce?: number | null; march?: { t: number; dropH: number; stepMs: number; landMs: number } | null; word?: boolean } = {}) {
	// (`word`: a title always drawn as one word, FREE SPINS and TOTAL WIN, keeps the word's own letter gap)
	const ink = setLine(str, ts, opts.word ? letterGap(ts) : titleGap(str, ts, lwOf(g.canvas)));
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
/** a row's lit rows (ink), relative to the y drawRow is given: a currency sign's stems reach above and below the cap */
const inkVCache = new Map<string, { t: number; b: number }>();
/** (on the finer grid: drawn on a face of that density, its lit LED rows read back as the dots they are in) */
function rowInkV(str: string, cap: number, k = 1) {
	const key = str + '|' + cap + '|' + k;
	let v = inkVCache.get(key);
	if (v) return v;
	const ri = rowInfo(str, cap);
	const c = mkFace(ri.w + 8, Math.ceil(cap * 1.4) + 8, k);
	drawRow(c.ctx, str, 2, 2, cap, '#ffffff', 0);
	const d = c.ctx.getImageData(0, 0, c.width, c.height).data;
	let t = Infinity;
	let b = -Infinity;
	for (let y = 0; y < c.height; y++)
		for (let x = 0; x < c.width; x++)
			if (d[(y * c.width + x) * 4 + 3] > 0) {
				t = Math.min(t, Math.floor(y / k) - 2);
				b = Math.max(b, Math.floor(y / k) - 2);
				break;
			}
	v = Number.isFinite(t) ? { t, b } : { t: 0, b: cap - 1 };
	if (inkVCache.size > 400) inkVCache.clear();
	inkVCache.set(key, v);
	return v;
}
/** (2026-11-18) the y that keeps a row's lit rows inside a face H dots tall (the dollar sign's stems were cut at the
 *  1440 x 900 strip's bottom row): moved up only as far as it must, never above the face's top */
function rowYInside(str: string, y: number, cap: number, H: number, kd = 1) {
	const k = rowInkV(str, cap, kd);
	const over = y + k.b - (H - 1);
	if (over <= 0) return y;
	return Math.max(y - over, -k.t);
}
/** the x to start a row at so its lit dots are centered on cx; with its record for the probes */
function centeredRow(g: Ctx, str: string, cx: number, y: number, cap: number, beforeX: number | null) {
	const k = rowInk(str, cap);
	const x = Math.round(cx - (k.l + k.r) / 2);
	noteRec(g.canvas, { kind: 'amount', str, x0: x + k.l, x1: x + k.r, y0: Math.round(y), y1: Math.round(y) + cap, lift: 0, ts: cap, before: beforeX === null ? undefined : Math.round(beforeX) + (k.l + k.r) / 2 });
	return x;
}

const BULBS = ['#ff3a2e', '#36ff74', '#ffd23a', '#4aa8ff'];
/** a marquee bulb at (x, y) in LEDs: a plus one dot thick and three across (ledN LEDs on the finer grid), its middle white
 *  when lit */
function bulb(g: Ctx, x: number, y: number, col: string, on: boolean) {
	const u = ledN(kOf(g), 1);
	g.globalAlpha = on ? 1 : 0.22;
	g.fillStyle = col;
	fillP(g, x, y - u, u, 3 * u);
	fillP(g, x - u, y, 3 * u, u);
	if (on) {
		g.fillStyle = '#fff';
		fillP(g, x, y, u, u);
	}
	g.globalAlpha = 1;
}
/** the cells round a W x H box (ledGrid ringPts: in LEDs on a face of the finer grid) */
const perimeter = (W: number, H: number, inset: number, step: number): number[][] => ringPts(W, H, inset, step, 1);
/** LEDs along a perimeter (the first `count`), each its color, offset (ox, oy) LEDs: with LED_BOARD.fastChase the LEDs next
 *  to each other in one row or column with the same color go as ONE rect (each is still drawn once, so the picture is the
 *  same; part B, the cost of a step), else one by one */
function perimeterDots(g: Ctx, pts: number[][], count: number, colorOf: (i: number) => string, ox = 0, oy = 0, band: { rows: number; W: number; H: number } | null = null) {
	// (a BAND, the finer grid's border `rows` LEDs deep: each LED of the outer ring is drawn as a short bar going in, so the
	// colors line up across the band's rows and its corners stay square; band null: the ring alone, as before)
	const put = (x: number, y: number, len: number, vertical: boolean) => {
		if (!band || band.rows <= 1) return vertical ? fillP(g, x + ox, y + oy, 1, len) : fillP(g, x + ox, y + oy, len, 1);
		const r = band.rows;
		if (!vertical && y === 0) fillP(g, x + ox, oy, len, r);
		else if (!vertical && y === band.H - 1) fillP(g, x + ox, band.H - r + oy, len, r);
		else if (x === band.W - 1) fillP(g, band.W - r + ox, y + oy, r, len);
		else if (x === 0) fillP(g, ox, y + oy, r, len);
		else fillP(g, x + ox, y + oy, vertical ? 1 : len, vertical ? len : 1);
	};
	if (!LED_BOARD.fastChase) {
		for (let i = 0; i < count; i++) {
			g.fillStyle = colorOf(i);
			put(pts[i][0], pts[i][1], 1, pts[i][1] !== 0 && pts[i][1] !== (band?.H ?? 0) - 1);
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
		if (band && band.rows > 1) {
			const vertical = x0 === x1 && y0 !== y1 ? true : x0 === x1 && y0 !== 0 && y0 !== band.H - 1;
			if (vertical) put(x0, Math.min(y0, y1), Math.abs(y1 - y0) + 1, true);
			else put(Math.min(x0, x1), y0, Math.abs(x1 - x0) + 1, false);
		} else fillP(g, Math.min(x0, x1) + ox, Math.min(y0, y1) + oy, Math.abs(x1 - x0) + 1, Math.abs(y1 - y0) + 1);
		i = j;
	}
}
/** THE CHASE BORDER, in LEDs (2026-11-19): `thick` dots of rings (ledN LEDs, the same all round), each color `seg` dots
 *  long (ledN LEDs), running a dot every 60 ms (the same speed on the finer grid: an LED every 60 / k ms); `inset` dots in
 *  from the face's edge (the Super entry's inner border) */
function chaseBorder(g: Ctx, W: number, H: number, t: number, cols: string[], thick: number, seg: number, inset = 0) {
	const k = kOf(g);
	const o = Math.round(inset * k);
	const PW = Math.round((inset + W) * k) - o;
	const PH = Math.round((inset + H) * k) - o;
	const n = Math.floor((t * k) / 60);
	const sP = ledN(k, seg);
	const rows = ledN(k, thick);
	const colorOf = (i: number) => cols[Math.floor((i + n) / sP) % cols.length];
	// (the finer grid: one band `rows` LEDs deep, its colors in line across it; today's grid: ring by ring, as before)
	if (k !== 1) {
		const pts = perimeter(PW, PH, 0, 1);
		perimeterDots(g, pts, pts.length, colorOf, o, o, { rows, W: PW, H: PH });
		return;
	}
	for (let j = 0; j < rows; j++) {
		const pts = perimeter(PW, PH, j, 1);
		perimeterDots(g, pts, pts.length, colorOf, o, o);
	}
}
/** sparkles, in LEDs: each at an LED of the face, one dot square (ledN), its arms one dot long when it peaks */
function sparkles(g: Ctx, W: number, H: number, t: number, n: number, cols: string[], seed: number) {
	const q = kOf(g);
	const u = ledN(q, 1);
	const PW = Math.round(W * q);
	const PH = Math.round(H * q);
	for (let k = 0; k < n; k++) {
		const per = 900 + hash(k + seed) * 700;
		const cyc = Math.floor((t + k * 137) / per);
		const p = (t + k * 137) / per - cyc;
		const x = Math.floor(hash(k * 13 + cyc * 7.3 + seed) * PW);
		const y = Math.floor(hash(k * 29 + cyc * 3.1 + seed) * PH);
		const a = Math.sin(Math.PI * p);
		g.globalAlpha = a;
		g.fillStyle = cols[k % cols.length];
		fillP(g, x, y, u, u);
		if (a > 0.7) {
			fillP(g, x - u, y, u, u);
			fillP(g, x + u, y, u, u);
			fillP(g, x, y - u, u, u);
			fillP(g, x, y + u, u, u);
		}
	}
	g.globalAlpha = 1;
}
function snowDots(g: Ctx, W: number, H: number, t: number, n: number, col = '#dff3ff') {
	g.globalAlpha = 0.55;
	for (let k = 0; k < n; k++) {
		const x = (hash(k * 7.7) * W + Math.sin(t / 900 + k) * 2 + W) % W;
		const y = (hash(k * 1.9) * H + t * (0.006 + hash(k) * 0.01)) % H;
		dot(g, x, y, col);
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
			// (in LEDs: the bulbs `step` dots apart, `ins` dots in, each one dot thick, on the face's grid)
			const q = kOf(g);
			const pts = ringPts(Math.round(W * q), Math.round(H * q), Math.round(ins * q), ledN(q, step), ledN(q, 1));
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
			// (in LEDs: the bands, the stripes' width and their run a dot every 40 ms, whole LEDs on the face's grid)
			const q = kOf(g);
			const PW = Math.round(W * q);
			const PH = Math.round(H * q);
			const bh = ledN(q, H >= 30 ? Math.max(4, Math.round(H * 0.1)) : 2);
			const sw = ledN(q, Math.max(3, H >= 30 ? Math.max(4, Math.round(H * 0.1)) : 2));
			const off = Math.floor((t * q) / 40);
			for (const y0 of [0, PH - bh])
				for (let y = y0; y < y0 + bh; y++) {
					const m = (y + off) % (2 * sw);
					for (let x = -m; x < PW; x += 2 * sw) clearP(g, x, y, sw, 1);
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
	} else if (back) {
		// (2026-11-18) the row layout's amount is recorded too (the probes read every board's amount by its record)
		const k = rowInk(str, lay.cap);
		noteRec(g.canvas, { kind: 'amount', str, x0: nx + k.l, x1: nx + k.r, y0: lay.numY, y1: lay.numY + lay.cap, lift: 0, ts: lay.cap, before: nx });
	}
	drawRow(g, str, nx, back ? lay.numY : rowYInside(s.finalStr, lay.numY, lay.cap, H, kOf(g)), lay.cap, look.num, pulse);
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
		// (in LEDs: the edge runs LED by LED, two dots of the tier's color and one white, whole LEDs on the face's grid)
		const k = F.k;
		const PH = F.ledH;
		const sx = Math.round(ease(since / LED_BOARD.sweepMs) * (F.ledW + ledN(k, 6))) - ledN(k, 3);
		o.clearRect(0, 0, W, H);
		copyFace(o, F.a);
		if (sx > 0) {
			clearP(o, 0, 0, sx, PH);
			copyP(o, F.b, 0, 0, sx, PH);
		}
		o.fillStyle = LOOK[tier].sweep;
		o.globalAlpha = 0.9;
		fillP(o, sx, 0, ledN(k, 2), PH);
		o.fillStyle = '#ffffff';
		o.globalAlpha = 0.95;
		fillP(o, sx + ledN(k, 2), 0, ledN(k, 1), PH);
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
	// (in LEDs: one dot wide, the same all round)
	const W = F.ledW;
	const H = F.ledH;
	const u = ledN(F.k, 1);
	g.fillStyle = '#ffffff';
	g.globalAlpha = 0.5;
	fillP(g, 0, 0, W, u);
	fillP(g, 0, H - u, W, u);
	fillP(g, 0, 0, u, H);
	fillP(g, W - u, 0, u, H);
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
	drawRow(g, str, numX(lay, W, str, 0), rowYInside(s.finalStr, lay.numY, lay.cap, H, kOf(g)), lay.cap, '#ffffff', s.t >= s.countEnd ? 1 - clamp((s.t - s.countEnd) / 300, 0, 1) : 0);
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
	// the finish line: a checkered post (in LEDs: two columns of squares one dot each)
	{
		const k = kOf(g);
		const u = ledN(k, 1);
		const fx = Math.round(finishX * k);
		const y0 = Math.round(yB - h - 1);
		const yEnd = Math.round(yB * k);
		for (let y = Math.round(y0 * k), j = 0; y <= yEnd; y += u, j++) {
			const odd = (y0 + j) % 2;
			g.fillStyle = odd ? '#ffffff' : '#202020';
			fillP(g, fx, y, u, u);
			g.fillStyle = odd ? '#202020' : '#ffffff';
			fillP(g, fx + u, y, u, u);
		}
	}
	const { r, c } = raceProgress(race, t);
	// the nose of each racer runs from the start line to the finish line (the police car's RIGHT facing picture, H4_r: its
	// POLICE reads left to right; Corey 2026-11-19 "Mirrored wild on sleigh LED, yes fix it": never the left one mirrored)
	const len = finishX - startX;
	sprite(g, 'H4_r', startX - cw + c * len, yB, h);
	gallop(g, startX - rw + r * len, yB, h, t);
	return finishX;
}
/** the result card: WINNER with the winner's dot portrait and a flashing border; a tie is PHOTO FINISH, then TIE */
/** THE RACE'S RESULT CARD AS LAID OUT (the probes): each picture's and the words' columns on the strip, in dots */
export type RaceCardRec = { outcome: string; pics: [number, number][]; text: [number, number] | null; words: string };
const raceCardRec = new WeakMap<object, RaceCardRec>();
export const raceCardOf = (canvas: object): RaceCardRec | null => raceCardRec.get(canvas) ?? null;
/** THE PLOW AS DRAWN (the probes): the van's bake in LEDs [x, y, w, h], its rear wheel's trailing edge (LED column, from
 *  the bake: rearWheelEdge), the pile's end (the first LED column with no pile) and the pile's color; null before the van */
export type PlowRec = { van: [number, number, number, number] | null; wheel: number | null; edge: number; color: string };
const PLOW_SNOW = '#e8f4ff';
const plowRec = new WeakMap<object, PlowRec>();
export const plowOf = (canvas: object): PlowRec | null => plowRec.get(canvas) ?? null;
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
		sprite(g, 'H4_r', tx + tw + GAP, H - 2, ph * 0.8);
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
export type Cartoon = { key: 'trot' | 'parade' | 'plow' | 'sleigh' | 'peek' | 'race' | 'tree' | 'chew' | 'takeoff' | 'signroll' | 'stack'; name: string; ms: () => number; draw: (g: Ctx, W: number, H: number, t: number, st: CartoonState, at: number) => void };
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
			// the road's dashes (in LEDs: one dot square, six dots apart, a dot every 40 ms)
			const k = kOf(g);
			const u = ledN(k, 1);
			const PW = Math.round(W * k);
			const off = Math.floor((t * k) / 40);
			g.fillStyle = '#ffd23a';
			for (let i = 0; i < PW; i += ledN(k, 6)) fillP(g, (i + off) % PW, Math.round(H * k) - u, u, u);
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
			const k = kOf(g);
			const PH = Math.round(H * k);
			const n = Math.round(W * k);
			// THE SNOW GOES WITH THE BACK TIRE (Corey 2026-11-19: "so the snow line disappears with the back tire instead fo
			// behind it"): the pile ends at the rear tire's trailing edge, measured on the van's own bake in LEDs
			// (rearWheelEdge), so it holds at every size, grid and speed. (It used to end a fixed 1.4 x H dots right of the
			// van's left edge: a strip of snow about 0.37 x H dots long hung behind the van.) The van is baked first and
			// drawn after the pile, its corner on the LED as sprite() places it.
			const vh = Math.round(H * 0.85);
			let van: { a: Cv; lx: number; ly: number } | null = null;
			let edge = n;
			if (t >= 3800) {
				const [sw, sh] = size('H3', null);
				const a = art('H3', null, Math.max(1, Math.round((vh * sw) / sh)), vh, k);
				van = { a, lx: Math.round(vanX * k), ly: Math.round((H - 1 - vh) * k) };
				edge = clamp(van.lx + rearWheelEdge(a), 0, n);
			}
			g.fillStyle = PLOW_SNOW;
			// (the pile LED column by LED column on the finer grid)
			for (let xp = 0; xp < edge; xp++) {
				const x = xp / k;
				const ph = Math.round(pileMax * grow * (0.6 + 0.4 * Math.sin(x * 0.21) * Math.sin(x * 0.07 + 1)) * k);
				if (ph > 0) fillP(g, xp, PH - ph, 1, ph);
			}
			if (van) {
				blitP(g, van.a, van.lx, van.ly);
				for (let i = 0; i < 6; i++) dot(g, vanX - 2 - hash(i + Math.floor(t / 80)) * 6, H - 4 - hash(i * 3 + Math.floor(t / 80)) * H * 0.6, '#ffffff');
			}
			plowRec.set(g.canvas, { van: van ? [van.lx, van.ly, van.a.width, van.a.height] : null, wheel: van ? van.lx + rearWheelEdge(van.a) : null, edge, color: PLOW_SNOW });
		},
	},
	{
		key: 'sleigh',
		// r3b: the sleigh faces the way it travels (2026-11-19: its own right facing picture, sleigh_r, so WILD reads left to right), the reindeer in front pulling it
		name: "Santa's sleigh slides by, pulled by the reindeer, sparkles behind",
		ms: () => 4600,
		draw(g, W, H, t) {
			const h = Math.round(H * 0.9);
			const rw = Math.round((h * RUN_FW) / RUN_FH);
			// (Santa's hat inside the strip: the sleigh a little smaller than the reindeer where the strip is short for him)
			const slh = fitVehicle('sleigh_r', h, H - 1);
			const sw = Math.round(slh * 1.37);
			const x = -rw - sw + (t / 4600) * (W + rw * 2 + sw * 2);
			// (the sleigh's RIGHT facing picture, sleigh_r: its WILD reads left to right, never the left one mirrored)
			const sx = sprite(g, 'sleigh_r', x, H - 1, slh);
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
			// (Grandma's head inside the strip: the car a little smaller where the strip is short for her)
			if (t < 3200) sprite(g, 'car', x, H - 1, fitVehicle('car', h, H - 1));
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
				// the track's dots (in LEDs: one dot square, four dots apart)
				const k = kOf(g);
				const u = ledN(k, 1);
				const sp = ledN(k, 4);
				for (let x = 0, i = 0, n = Math.round(W * k); x < n; x += sp, i++) {
					g.fillStyle = i % 2 ? '#ffffff' : '#404040';
					fillP(g, x, Math.round(H * k) - u, u, u);
				}
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
		// (Grandma's head inside the strip at the top of the car's bounce, 3 dots up)
		sprite(g, 'car', W - (W - mid - 2) * meet + (u > 0.55 ? (u - 0.55) * 40 : 0), H - 1 - (u > 0.55 ? Math.sin((u - 0.55) * 7) * 3 : 0), fitVehicle('car', h * 0.9, H - 4));
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
	// (in LEDs: the line one dot tall, running LED row by LED row)
	const y = Math.round(u * F.ledH);
	const t = ledN(F.k, 1);
	clearP(o, 0, y + t, F.ledW, F.ledH - y - t + 1);
	o.fillStyle = 'rgba(255,255,255,0.9)';
	fillP(o, 0, y, F.ledW, t);
}
/** the press screen's dot noise ops, on a face: the power down (the dots go out at random), the dissolve between two lines
 *  (LED by LED: one noise value per LED) */
export function powerOffFace(F: Face, e: number) {
	if (e <= 0) return;
	const o = F.out.ctx;
	const A = o.getImageData(0, 0, F.ledW, F.ledH);
	const D = A.data;
	const n = F.noise;
	for (let i = 0; i < n.length; i++) if (n[i] < e) D[i * 4 + 3] = 0;
	o.putImageData(A, 0, 0);
}
export function dissolveFace(F: Face, e: number) {
	const W = F.ledW;
	const H = F.ledH;
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
	const z = Math.min(box.w / sw, box.h / sh);
	const dw = Math.max(1, Math.round(sw * z));
	const dh = Math.max(1, Math.round(sh * z));
	blit(g, art(name, null, dw, dh, kOf(g)), Math.round(box.x + (box.w - dw) / 2 + dx), Math.round(box.y + box.h - dh));
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
		if (keep && !keep(Math.round(x), Math.round(y))) return;
		dot(g, x, y, c);
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
					g.globalAlpha = 0.7;
					dot(g, x, y, BULBS[k % 4]);
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
	// (the inner border three dots in: an inset, never a moved context, so it lands on the face's LEDs)
	if (H >= 40) chaseBorder(g, W - 6, H - 6, s.t + 180, ['#ffd23a', '#ff3a2e'], 1, 3, 3);
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
		const sx = sprite(g, 'sleigh_r', x, yb, h);
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

/** the Total Win amount's brightness on the landing blink's dim beats (it stays readable) */
const TOTAL_BLINK_DIM = 0.4;
/** THE TOTAL WIN (SCOREBOARD ON, COUNT, FINAL, WAITS), as the mock's showTotalScene */
export function showTotalScene(F: Face, s: Show) {
	const g = F.out.ctx;
	const W = F.dotsW;
	const H = F.dotsH;
	const t = sceneT(s);
	g.clearRect(0, 0, W, H);
	const band = Math.round(H * LED_BOARD.scenes.band);
	const Hm = H - band;
	// the border runs round the face as the board comes on, then chases (fast while it counts); in LEDs: one dot of rings,
	// three dots a color, a dot every 50 (120) ms
	const q = F.k;
	const landAt = s.countEnd;
	const counting = s.t < landAt;
	const step = Math.floor((s.t * q) / (counting ? 50 : 120));
	const segP = ledN(q, 3);
	const pts = perimeter(F.ledW, F.ledH, 0, 1);
	const on = t < 400 ? Math.round((Math.max(0, t) / 400) * pts.length) : pts.length;
	perimeterDots(g, pts, on, (i) => (Math.floor((i + step) / segP) % 2 ? '#ffd23a' : '#36ff74'), 0, 0, { rows: ledN(q, 1), W: F.ledW, H: F.ledH });
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
	// THE LANDING BLINK: the amount dims every other 150 ms for 900 ms (M4, 2026-11-19: it dims, never goes out, so the title
	// is never up without its amount; it used to be off on those beats, after the press line had come on)
	const blinkDim = landed && since < 900 && Math.floor(since / 150) % 2 === 1;
	// (centered on its lit dots since 2026-11-17)
	const ax = centeredRow(g, str, W / 2, y0 + 7 * tts + 6 + G, cap, (W - w) / 2);
	if (blinkDim) g.globalAlpha = TOTAL_BLINK_DIM;
	drawRow(g, str, ax, y0 + 7 * tts + 6 + G, cap, 'gold', landed ? clamp(1 - since / 400, 0, 1) : 0);
	g.globalAlpha = 1;
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
	// (the lights two dots square, in LEDs)
	const lz = ledN(q, 2);
	const ly = Math.round((yb - ch - jump - 1) * q);
	g.fillStyle = lit ? '#ff3a2e' : '#4aa8ff';
	fillP(g, Math.round((px + pw * 0.42) * q), ly, lz, lz);
	g.fillStyle = lit ? '#4aa8ff' : '#ff3a2e';
	fillP(g, Math.round((px + pw * 0.52) * q), ly, lz, lz);
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
		// (in LEDs: bars one dot wide, one dot apart, `mh` dots tall)
		const q = F.k;
		const u = ledN(q, 1);
		const wP = Math.round((x0 + w) * q) - Math.round(x0 * q);
		const bx = Math.round(x0 * q);
		const by = Math.round((y + 10) * q);
		const bh = ledN(q, mh);
		for (let i = 0; i < wP; i += 2 * u) {
			const on = i / wP <= frac;
			g.fillStyle = on ? (i / wP < 0.5 ? '#36ff74' : i / wP < 0.8 ? '#ffd23a' : '#ff3a2e') : '#303030';
			fillP(g, bx + i, by, u, bh);
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
	entryWaitRec.delete(g.canvas);
	if (s.t < s.contentAt) return;
	if (s.pressLineAt !== null && s.t >= s.pressLineAt && s.t < s.exitAt) {
		chaseBorder(g, W, H, s.t, ['#ffe7b0', '#202020'], 1, 3);
		// (2026-11-18, LED_BOARD.explain: the sentence is on the big board; the strip carries the press line alone)
		if ((s.kind === 'fs' || s.kind === 'sfs') && LED_BOARD.entryLine.on && !LED_BOARD.explain.on) return entryWait(g, W, H, s, INTRO_LINE[s.kind === 'sfs' ? 'super' : 'bonus'], s.kind === 'sfs' ? '#ffd23a' : '#ffffff');
		// a wrap-up's own line (a top-up, the cap: the HTML card's words) the same way, once the Total Win waits
		if (s.kind === 'total' && s.line && !LED_BOARD.explain.on) return entryWait(g, W, H, s, s.line, '#ffd23a');
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
		// (2026-11-19, LED_BOARD.ideas.total 'ladder': the strip's border is the ladder's taillights; its amount is the same
		// paced count as the board's, amountNow)
		chaseBorder(g, W, H, s.t, LED_BOARD.ideas.total === 'ladder' ? ['#ff2a1e', '#5a1008'] : ['#36ff74', '#ff3a2e'], 1, 3);
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

// (2026-11-17) the helpers the strip's newer programs draw with (game/scoreboard/stripDraw.ts: the scatter count, the short
// Grandma line)
export { chaseBorder, drawRow, fireworks, fitCap, rowInfo, sprite, sparkles, burst, marchText };
// (2026-11-18, the entry explanation's layout C: game/scoreboard/explainDraw.ts)
export { boardTitle, drawFit, lineInk, BULBS };
// (2026-11-19, the round 1 LED ideas Corey picked: game/scoreboard/entryScenes.ts, totalLadder.ts, ambient.ts draw with the
// same helpers as the scenes here)
export { gallop, centeredRow, perimeter, perimeterDots, cornerFireworks, slamRow, marchAt, flash, entryNumberLayout, titleScale, fitScale, snowDots, RUN_FW, RUN_FH, size as artSize, art, sceneT, TOTAL_BLINK_DIM, titleGapKnob, fitVehicle, vehicleOf, noteRec };
export type { ArtName };
