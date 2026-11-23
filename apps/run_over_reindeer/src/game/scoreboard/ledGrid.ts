// THE LED GRID'S DENSITY (Corey 2026-11-19, led_density_r1_2026-11-19: "1.5", with the words and pictures redrawn for the
// grid, Bold small lines and body sentence, today's dot size, the faint unlit grid, the halo and the soft dot; constants
// LED_BOARD.density). The board's programs keep laying out in the dots they always have (LOGICAL dots: the face is still
// 268 x 149 on a 1440 x 900 desktop, and every margin, size search, wrap and text box is today's). A face canvas holds K
// LEDs per logical dot each way (K = 1 is today, exactly); its 2D context carries a scale of K, so an area (a background,
// a flash, a clear) lands on the finer grid with its edges snapped to whole LEDs, while:
//   the words and the pictures are RASTERIZED AT THE LED GRID (masks, glyphs and picture bakes K times finer, drawn at their
//                own size with their corner on a whole LED: blit), never today's bitmaps blown up
//   the decorations (chase borders, rules, sparkles, single dots, scan lines, the sweep's edge) are DEFINED IN LEDS: every
//                size, gap and period is a whole number of LEDs (ledN: n dots -> round(n x K) LEDs, the same everywhere on
//                the face), set on the LED lattice (fillP), so a one dot border is the same width all round
// SINCE 2026-11-22 THE SMALLEST DOT RULE (constants LED_BOARD.pitch, layout.ts ledPitchGeo) places the grid: the dot count
// follows the window, and the finer grid stays only where the face still holds k times the layout's dots. densityFor below
// is the board's own density before that rule: what the rule starts from, and the grid of the mini player and of the rule
// switched off.
// THE RULE (densityFor): the finer grid only where an LED stays at least LED_BOARD.density.minDevicePx device pixels; else
// today's grid. Decided once per layout (the pitch) and renderer resolution (Board passes it), for both faces together.
// Plain 2D canvas (no filter, shader, mask, blur or blob: URL); nothing here allocates per step.
import { LED_BOARD } from '../constants';

export type LedCv = HTMLCanvasElement & {
	ctx: CanvasRenderingContext2D;
	/** LEDs per logical dot (absent: 1, a canvas at one pixel per dot) */
	ledK?: number;
	/** the face's size in logical dots */
	lw?: number;
	lh?: number;
};

/** THE DENSITY RULE: LEDs per logical dot for a board whose dot pitch is `pitchCss` CSS px, drawn by a renderer at
 *  `deviceRatio` device px per CSS px: LED_BOARD.density.k where one of its LEDs is at least minDevicePx device px, else 1 */
export function densityFor(pitchCss: number, deviceRatio: number): number {
	const R = LED_BOARD.density;
	const k = R.k;
	if (!R.on || !(k > 1) || !(pitchCss > 0) || !(deviceRatio > 0)) return 1;
	return (pitchCss * deviceRatio) / k >= R.minDevicePx ? k : 1;
}

/** THE WORDS AS DRAWN (the node check tools/led_fit_check.mjs; null in the game: one comparison per line drawn): every line
 *  of words a program draws, on which canvas, its string, its box in that canvas's dots (the top left corner as asked for,
 *  the mask's or the row's width, its height), its dot scale or cap, and which face drew it ('text': the 5 x 7 sizes and the
 *  heavy titles, landing/ledScreens.ts drawText; 'row': the amounts' rows, scoreboardDraw.ts drawRow) */
export type TextNote = { canvas: object; str: string; x: number; y: number; w: number; h: number; s: number; kind: 'text' | 'row'; dots: boolean };
let textAudit: ((n: TextNote) => void) | null = null;
export const setTextAudit = (fn: ((n: TextNote) => void) | null) => {
	textAudit = fn;
};
export const textAuditOn = () => textAudit !== null;
export const noteText = (n: TextNote) => textAudit?.(n);

/** whether Overpass at a weight is in (a mask or glyph made before it is would keep a fallback face: it is then made again
 *  on the next step, not kept); a weight not in yet is asked for once (game/boot.svelte.ts loads Bold and Heavy first) */
const faceIn = new Set<number>();
export function overpassReady(wt: number): boolean {
	if (faceIn.has(wt)) return true;
	if (typeof document === 'undefined' || !document.fonts) return true;
	const spec = `${wt} 20px 'Overpass'`;
	if (document.fonts.check(spec)) {
		faceIn.add(wt);
		return true;
	}
	void document.fonts.load(spec).catch(() => {});
	return false;
}

/** a canvas's density (1: one pixel per dot) */
export const kOf = (g: CanvasRenderingContext2D): number => (g.canvas as LedCv).ledK ?? 1;
/** a canvas's width and height in logical dots */
export const lwOf = (c: { width: number; lw?: number }): number => c.lw ?? c.width;
export const lhOf = (c: { height: number; lh?: number }): number => c.lh ?? c.height;
/** n logical dots as whole LEDs at density k (a decoration's size, gap or period; at least one LED) */
export const ledN = (k: number, n: number): number => Math.max(1, Math.round(n * k));

/** THE FACE CANVAS: W x H logical dots, round(W k) x round(H k) LEDs, its context scaled by k with its rectangles snapped
 *  to whole LEDs (k = 1: a plain canvas, exactly as before). The context's transform is never changed by the programs
 *  (helpers take offsets), so the snap is plain arithmetic. */
export function mkFace(W: number, H: number, k = 1): LedCv {
	const c = document.createElement('canvas') as LedCv;
	const lw = Math.max(1, Math.round(W));
	const lh = Math.max(1, Math.round(H));
	c.width = Math.max(1, Math.round(lw * k));
	c.height = Math.max(1, Math.round(lh * k));
	const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
	c.ctx = ctx;
	c.lw = lw;
	c.lh = lh;
	if (k === 1) return c;
	c.ledK = k;
	ctx.setTransform(k, 0, 0, k, 0, 0);
	// every picture is drawn 1:1 on the LED grid (blit, copyP): nearest keeps those copies exact
	ctx.imageSmoothingEnabled = false;
	const fill0 = ctx.fillRect.bind(ctx);
	const clear0 = ctx.clearRect.bind(ctx);
	// an area's edges on whole LEDs (logical in, the same logical rectangle out, its edges moved to the nearest LED edge)
	const snap = (x: number, y: number, w: number, h: number, f: (x: number, y: number, w: number, h: number) => void) => {
		let x0 = Math.round(x * k);
		let x1 = Math.round((x + w) * k);
		let y0 = Math.round(y * k);
		let y1 = Math.round((y + h) * k);
		if (x1 < x0) [x0, x1] = [x1, x0];
		if (y1 < y0) [y0, y1] = [y1, y0];
		if (x1 > x0 && y1 > y0) f(x0 / k, y0 / k, (x1 - x0) / k, (y1 - y0) / k);
	};
	ctx.fillRect = (x: number, y: number, w: number, h: number) => snap(x, y, w, h, fill0);
	ctx.clearRect = (x: number, y: number, w: number, h: number) => snap(x, y, w, h, clear0);
	return c;
}

// ---- ON THE LED LATTICE (x, y, w, h in LEDs) -----------------------------------------------------------------------------
/** a rectangle of LEDs in the current fill */
export function fillP(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
	const k = kOf(g);
	if (k === 1) return g.fillRect(x, y, w, h);
	g.fillRect(x / k, y / k, w / k, h / k);
}
/** a rectangle of LEDs cleared */
export function clearP(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
	const k = kOf(g);
	if (k === 1) return g.clearRect(x, y, w, h);
	g.clearRect(x / k, y / k, w / k, h / k);
}
/** a rectangle of LEDs copied from another face at the same density, to the same place */
export function copyP(g: CanvasRenderingContext2D, src: CanvasImageSource, x: number, y: number, w: number, h: number) {
	if (w <= 0 || h <= 0) return;
	const k = kOf(g);
	g.drawImage(src, x, y, w, h, x / k, y / k, w / k, h / k);
}
/** a whole face copied onto another of the same size and density */
export function copyFace(g: CanvasRenderingContext2D, src: HTMLCanvasElement) {
	copyP(g, src, 0, 0, src.width, src.height);
}
/** one dot of a decoration (a sparkle's middle, a snowflake, a spark): ledN(k, 1) LEDs square, its corner on the LED
 *  nearest (x, y) logical; k = 1: the dot at the rounded place, as before */
export function dotAt(g: CanvasRenderingContext2D, x: number, y: number, col: string) {
	g.fillStyle = col;
	const k = kOf(g);
	if (k === 1) return g.fillRect(Math.round(x), Math.round(y), 1, 1);
	const u = ledN(k, 1);
	fillP(g, Math.round(x * k), Math.round(y * k), u, u);
}

/** a picture whose pixels are LEDs (a mask, a glyph row, a picture bake) drawn at its own size, its corner on the LED
 *  nearest logical (x, y); the part sx, sy, sw, sh of it (pixels) */
export function blit(g: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, sx = 0, sy = 0, sw = img.width, sh = img.height) {
	const k = kOf(g);
	if (k === 1) return g.drawImage(img, sx, sy, sw, sh, Math.round(x), Math.round(y), sw, sh);
	g.drawImage(img, sx, sy, sw, sh, Math.round(x * k) / k, Math.round(y * k) / k, sw / k, sh / k);
}
/** the same at a place in LEDs; `flip` mirrors it inside its own box */
export function blitP(g: CanvasRenderingContext2D, img: HTMLCanvasElement, xP: number, yP: number, flip = false) {
	const k = kOf(g);
	if (!flip) return g.drawImage(img, 0, 0, img.width, img.height, xP / k, yP / k, img.width / k, img.height / k);
	g.save();
	g.setTransform(-1, 0, 0, 1, xP + img.width, 0);
	g.drawImage(img, 0, yP);
	g.restore();
}

/** a ring of cells `u` LEDs square round a W x H LED box, `inset` LEDs in, one every `step` LEDs (the perimeter's order:
 *  the top left to right, the right down, the bottom right to left, the left up) */
const ringCache = new Map<string, number[][]>();
export function ringPts(W: number, H: number, inset: number, step: number, u = 1): number[][] {
	const key = `${W}x${H}|${inset}|${step}|${u}`;
	let pts = ringCache.get(key);
	if (pts) return pts;
	pts = [];
	const R = W - u - inset;
	const B = H - u - inset;
	for (let x = inset; x <= R; x += step) pts.push([x, inset]);
	for (let y = inset + step; y <= B; y += step) pts.push([R, y]);
	for (let x = R - step; x >= inset; x -= step) pts.push([x, B]);
	for (let y = B - step; y > inset; y -= step) pts.push([inset, y]);
	if (ringCache.size > 200) ringCache.clear();
	ringCache.set(key, pts);
	return pts;
}
