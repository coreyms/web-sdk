// THE LED BOARDS' CURRENCY SIGNS (2026-11-17, led_currency_2026-11-17). The two faces the boards write amounts in, and the
// signs each one draws by hand here (never a system font: Overpass Heavy carries the digits and the Latin letters, not ₹ ₽ ₩
// and the rest, and a font fallback would differ per device):
//   THE AMOUNT FACE   the counting amounts on the big board and the strip (scoreboardDraw.ts vglyph / drawRow): Overpass
//                     Heavy at the digit cap, `cap` dots tall, any size from 5 up. A sign here is my own outline in the font's
//                     own units (cap height 700, stem 150, bar 140, round overshoot 12, the advance in the same units),
//                     filled by the plain coverage count below at the font's own scale and snapped to the dots exactly as
//                     vglyph snaps a digit (alpha under 80 of 255 off, the rest x1.4). At the small caps, where a sum of
//                     coverage cannot hold a sign together, the dots are placed by hand (AMOUNT_HAND), cap by cap.
//   THE SENTENCE FACE the 5 x 7 dot font of the strip's sentences (landing/ledScreens.ts FONT; EPX at 2x): the signs placed
//                     by hand in its 7 row cell (SENTENCE_SIGNS), read by ledScreens' grid1 when its own table has no letter.
// Pure data and arithmetic: no DOM until a sign is asked for as a canvas (ledSignCanvas), no filter, shader, mask or blob URL.

import { warmGate } from './warmGate';

// ---- THE AMOUNT FACE: outlines in the font's units ------------------------------------------------------------------------
/** a rectangle, a polygon, an elliptical ring's arc (centre, outer radii, the stroke across x and y, from a0 to a1 degrees
 *  counter clockwise from +x), a straight stroke of width w with square ends, a filled ellipse */
type Shape =
	| ['R', number, number, number, number]
	| ['P', ...number[]]
	| ['A', number, number, number, number, number, number, number, number]
	| ['L', number, number, number, number, number]
	| ['E', number, number, number, number];
type Outline = { adv: number; fill: Shape[]; cut?: Shape[] };

// stems and bars of Overpass Heavy (its I and H: stem 152, bar 145 of the 700 cap)
const S = 150;
const B = 140;
/** a round letter's ring (C, O): the font's overshoot of 12 above and below the cap */
const ring = (cx: number, rx: number, a0: number, a1: number, t = S, tb = B): Shape => ['A', cx, 350, rx, 362, t, tb, a0, a1];

export const AMOUNT_OUTLINES: Record<string, Outline> = {
	// DOLLAR: two bowls with a shared spine, the bar standing out above and below only (a bar through the counters fills them
	// at the strip's sizes)
	$: {
		adv: 611,
		fill: [
			['A', 305, 494, 255, 218, S, B, 22, 270],
			['A', 305, 206, 255, 218, S, B, 202, 450],
			['R', 258, 640, 352, 790],
			['R', 258, -90, 352, 60],
		],
	},
	// EURO: the C open to the right, two bars standing out to its left
	'€': {
		adv: 660,
		fill: [ring(350, 300, 42, 318), ['R', 0, 395, 450, 480], ['R', 0, 225, 450, 310]],
	},
	// YEN: the Y and two bars under the fork
	'¥': {
		adv: 640,
		fill: [['L', 70, 760, 320, 330, 160], ['L', 570, 760, 320, 330, 160], ['R', 245, 0, 395, 360], ['R', 85, 262, 555, 342], ['R', 85, 112, 555, 192]],
		cut: [['R', -100, 700, 800, 900]],
	},
	// RUBLE: the P, a bar across its stem under the bowl
	'₽': {
		adv: 650,
		fill: [['R', 135, 0, 285, 700], ['A', 380, 495, 235, 205, S, B, -90, 90], ['R', 135, 560, 380, 700], ['R', 135, 290, 380, 430], ['R', 20, 110, 470, 195]],
	},
	// PESO: the P, two bars across the top of its bowl standing out both sides
	'₱': {
		adv: 700,
		fill: [['R', 150, 0, 300, 700], ['A', 400, 470, 235, 230, S, B, -90, 90], ['R', 150, 560, 400, 700], ['R', 150, 240, 400, 380], ['R', 20, 590, 690, 660], ['R', 20, 455, 690, 525]],
	},
	// RUPEE: the two top bars, the bowl hanging from them back to the left, the leg down to the right
	'₹': {
		adv: 620,
		fill: [['R', 40, 615, 580, 700], ['R', 40, 450, 580, 530], ['A', 230, 470, 250, 230, 130, 120, -90, 90], ['R', 40, 240, 235, 360], ['L', 150, 330, 520, -40, 165]],
		cut: [['R', -100, -200, 800, 0]],
	},
	// WON: the W and one bar across it (two bars and four strokes do not fit apart under 20 dots)
	'₩': {
		adv: 900,
		fill: [['L', 80, 740, 255, -20, 140], ['L', 450, 740, 255, -20, 140], ['L', 450, 740, 645, -20, 140], ['L', 820, 740, 645, -20, 140], ['R', 0, 330, 900, 420]],
		cut: [['R', -100, 700, 1000, 900], ['R', -100, -200, 1000, 0]],
	},
	// DONG: the d with its bar on the stem, the line under it on the baseline
	'₫': {
		adv: 640,
		fill: [['A', 265, 380, 205, 185, 135, 120, 0, 360], ['R', 390, 195, 525, 700], ['R', 300, 600, 620, 670], ['R', 50, 0, 570, 85]],
	},
	// LIRA: the stem, two bars rising to the right across it, the foot curving up to the right
	'₺': {
		adv: 620,
		fill: [['R', 160, 200, 300, 700], ['A', 330, 270, 270, 270, 135, 125, 180, 360], ['R', 465, 270, 600, 390], ['L', 40, 330, 440, 420, 80], ['L', 40, 490, 440, 580, 80]],
	},
	// the slash of S/ (Peru)
	'/': { adv: 540, fill: [['L', 70, -90, 470, 790, 150]] },
	// NAIRA: the N, two bars across it standing out both sides
	'₦': {
		adv: 780,
		fill: [['R', 85, 0, 230, 700], ['R', 550, 0, 695, 700], ['P', 85, 700, 250, 700, 695, 110, 695, 0, 530, 0, 85, 590], ['R', 0, 405, 780, 480], ['R', 0, 220, 780, 295]],
	},
	// COLON (Costa Rica): the C with two strokes through it, top and bottom
	'₡': {
		adv: 660,
		fill: [ring(360, 300, 42, 318), ['L', 245, -100, 305, 800, 66], ['L', 420, -100, 480, 800, 66]],
	},
	// CEDI: the C with one bar through it, top and bottom
	'₵': {
		adv: 660,
		fill: [ring(350, 300, 42, 318), ['R', 290, -95, 385, 795]],
	},
	// EGYPT'S POUND, its two Arabic letters (the symbol reads ج.م; drawn in their order on the page: meem, the point, jeem)
	// jeem: the flat top, the bowl opening to the right under it, the point inside
	ج: {
		adv: 620,
		fill: [['R', 160, 560, 560, 690], ['A', 330, 270, 290, 290, 140, 130, 62, 300], ['E', 380, 260, 70, 70]],
	},
	// meem: the round head and its tail straight down past the baseline
	م: {
		adv: 560,
		fill: [['A', 340, 340, 200, 200, 135, 135, 0, 360], ['R', 140, -170, 275, 345]],
	},
};

// ---- the coverage count (8 x 8 samples a dot) -----------------------------------------------------------------------------
const insideShape = (sh: Shape, x: number, y: number): boolean => {
	switch (sh[0]) {
		case 'R':
			return x >= sh[1] && x < sh[3] && y >= sh[2] && y < sh[4];
		case 'E': {
			const dx = (x - sh[1]) / sh[3];
			const dy = (y - sh[2]) / sh[4];
			return dx * dx + dy * dy <= 1;
		}
		case 'A': {
			const [, cx, cy, rx, ry, tx, ty, a0, a1] = sh;
			const ox = (x - cx) / rx;
			const oy = (y - cy) / ry;
			if (ox * ox + oy * oy > 1) return false;
			const ix = rx - tx;
			const iy = ry - ty;
			if (ix > 0 && iy > 0) {
				const qx = (x - cx) / ix;
				const qy = (y - cy) / iy;
				if (qx * qx + qy * qy < 1) return false;
			}
			let a = (Math.atan2(oy, ox) * 180) / Math.PI;
			while (a < a0) a += 360;
			while (a >= a0 + 360) a -= 360;
			return a <= a1;
		}
		case 'L': {
			const [, x0, y0, x1, y1, w] = sh;
			const dx = x1 - x0;
			const dy = y1 - y0;
			const len = Math.hypot(dx, dy);
			const u = ((x - x0) * dx + (y - y0) * dy) / len;
			const v = ((x - x0) * -dy + (y - y0) * dx) / len;
			return u >= 0 && u <= len && Math.abs(v) <= w / 2;
		}
		case 'P': {
			let c = false;
			const n = (sh.length - 1) / 2;
			for (let i = 0, j = n - 1; i < n; j = i++) {
				const xi = sh[1 + 2 * i] as number;
				const yi = sh[2 + 2 * i] as number;
				const xj = sh[1 + 2 * j] as number;
				const yj = sh[2 + 2 * j] as number;
				if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
			}
			return c;
		}
	}
	return false;
};
const inside = (o: Outline, x: number, y: number) => o.fill.some((s) => insideShape(s, x, y)) && !(o.cut ?? []).some((s) => insideShape(s, x, y));

/** a sign as dots: the canvas vglyph would make for a letter of the font at this cap (adv + 2 dots wide, the glyph from
 *  x 1, its baseline under row cap, ceil(cap x 1.4) + 2 rows), each dot's alpha 0 to 255 */
export type SignDots = { w: number; h: number; adv: number; a: Uint8ClampedArray; hand: boolean };

// ---- THE AMOUNT FACE BY HAND (the small caps) ----------------------------------------------------------------------------
// Each entry: the rows from the top of the digit box (row 1 of the canvas) down; `up` rows above it first (a $'s bar), the
// rows past the cap below the baseline. '#' a lit dot, '+' a half lit dot (the font's own edge dots are part lit too), '.'
// unlit. The advance is the outline's at that cap unless `adv` says otherwise. Set at caps 5 to 9, where the coverage count
// smears these signs; from cap 10 up the outlines hold (checked dot by dot on the sheet, 2026-11-17).
type Hand = { up?: number; adv?: number; rows: string[] };
export const AMOUNT_HAND: Record<string, Record<number, Hand>> = {
	$: {
		5: { up: 1, rows: ['.#.', '###', '#..', '.#.', '..#', '###', '.#.'] },
		6: { up: 1, rows: ['..#.', '.###', '#...', '.##.', '...#', '...#', '###.', '..#.'] },
		7: { up: 1, rows: ['..#..', '.####', '##...', '##...', '.###.', '...##', '...##', '####.', '..#..'] },
		8: { up: 1, rows: ['..#..', '.####', '##..+', '##...', '.###.', '..+##', '...##', '+..##', '####.', '..#..'] },
		9: { up: 1, rows: ['..##..', '.#####', '##...+', '##....', '.####.', '...+##', '....##', '+...##', '#####.', '..##..'] },
	},
	'€': {
		5: { rows: ['.##', '#..', '##.', '#..', '.##'] },
		6: { rows: ['..##', '.#..', '###.', '###.', '.#..', '..##'] },
		7: { rows: ['..###', '.##..', '####.', '.##..', '####.', '.##..', '..###'] },
		8: { rows: ['..###', '.##..', '####.', '.##..', '.##..', '####.', '.##..', '..###'] },
		9: { rows: ['..####', '.##...', '#####.', '.##...', '.##...', '#####.', '.##...', '.##...', '..####'] },
	},
	'¥': {
		5: { rows: ['#.#', '#.#', '###', '.#.', '.#.'] },
		6: { rows: ['#..#', '.##.', '####', '.##.', '####', '.##.'] },
		7: { rows: ['##..##', '.#..#.', '..##..', '######', '..##..', '######', '..##..'] },
		8: { rows: ['##..##', '##..##', '.####.', '..##..', '######', '..##..', '######', '..##..'] },
		9: { rows: ['##...##', '.##.##.', '.##.##.', '..###..', '#######', '...#...', '#######', '...#...', '...#...'] },
	},
	'₽': {
		5: { rows: ['###.', '.#.#', '###.', '###.', '.#..'] },
		6: { rows: ['.###.', '.#..#', '.###.', '.#...', '####.', '.#...'] },
		7: { rows: ['.####.', '.##.##', '.##.##', '.####.', '.##...', '#####.', '.##...'] },
		8: { rows: ['.####.', '.##.##', '.##.##', '.####.', '.##...', '#####.', '.##...', '.##...'] },
		9: { rows: ['.#####.', '.##..##', '.##..##', '.##..##', '.#####.', '.##....', '######.', '.##....', '.##....'] },
	},
	'₱': {
		5: { rows: ['###.', '####', '####', '.#..', '.#..'] },
		6: { rows: ['.###.', '#####', '.#..#', '#####', '.#...', '.#...'] },
		7: { rows: ['.####.', '######', '.##.##', '######', '.####.', '.##...', '.##...'] },
		8: { rows: ['.####.', '#######', '.##..##', '#######', '.#####.', '.##....', '.##....', '.##....'] },
		9: { rows: ['.#####.', '########', '.##...##', '########', '.##..##.', '.#####..', '.##.....', '.##.....', '.##.....'] },
	},
	'₹': {
		5: { rows: ['####', '####', '##..', '.#..', '..##'] },
		6: { rows: ['#####', '...#.', '#####', '###..', '..#..', '...##'] },
		7: { rows: ['######', '....#.', '######', '...##.', '####..', '..##..', '...###'] },
		8: { rows: ['######', '....##', '######', '....##', '#####.', '.##...', '..##..', '...###'] },
		9: { rows: ['#######', '.....##', '#######', '.....##', '.....##', '######.', '.###...', '...###.', '....###'] },
	},
	'₩': {
		5: { rows: ['#.#.#', '#.#.#', '#####', '#####', '.#.#.'] },
		6: { rows: ['#.#.#', '#.#.#', '#####', '#.#.#', '##.##', '.#.#.'] },
		7: { rows: ['#..#..#', '#..#..#', '#######', '##.#.##', '.#####.', '.##.##.', '.#..#..'] },
		8: { rows: ['##.##.##', '##.##.##', '##.##.##', '########', '.######.', '.##..##.', '.##..##.', '.#...#..'] },
		9: { rows: ['##..#..##', '##..#..##', '##.###.##', '#########', '.#######.', '.###.###.', '.##...##.', '.##...##.', '..#....#.'] },
	},
	'₫': {
		5: { rows: ['..##', '.###', '#.#.', '###.', '####'] },
		6: { rows: ['...#.', '..###', '.####', '#..#.', '.###.', '#####'] },
		7: { rows: ['....#.', '...###', '.#####', '##..#.', '.####.', '......', '######'] },
		8: { rows: ['....##.', '...####', '.######', '##...#.', '##...#.', '.#####.', '.......', '######.'] },
		9: { rows: ['....##.', '...####', '.######', '##...##', '##...##', '##...##', '.######', '.......', '#######'] },
	},
	'₺': {
		5: { rows: ['.#..', '###.', '.#.#', '###.', '.##.'] },
		6: { rows: ['.#...', '.#.##', '###..', '.##.#', '.#..#', '..##.'] },
		7: { rows: ['.##...', '.##..#', '.####.', '###..#', '.####.', '.##..#', '..####'] },
		8: { rows: ['.##....', '.##...#', '.##.##.', '####..#', '.##.##.', '###...#', '.##..##', '..####.'] },
		9: { rows: ['.##....', '.##....', '.##..##', '.####..', '###..##', '.####..', '###...#', '.##..##', '..####.'] },
	},
	'/': {
		5: { rows: ['..#', '.#.', '.#.', '.#.', '#..'] },
		6: { rows: ['...#', '..#.', '..#.', '.#..', '.#..', '#...'] },
		7: { rows: ['...##', '...#.', '..##.', '..#..', '.##..', '.#...', '##...'] },
		8: { rows: ['...##', '...##', '..##.', '..##.', '.##..', '.##..', '##...', '##...'] },
		9: { rows: ['....##', '...##.', '...##.', '..##..', '..##..', '.##...', '.##...', '##....', '##....'] },
	},
	'₦': {
		5: { rows: ['#..#', '####', '####', '####', '#..#'] },
		6: { rows: ['##..#', '#####', '#.#.#', '#####', '#..##', '#...#'] },
		7: { rows: ['##...#', '###..#', '######', '#.##.#', '######', '#..###', '#...##'] },
		8: { rows: ['##....##', '###...##', '########', '##.##.##', '########', '##...###', '##....##', '##....##'] },
		9: { rows: ['##....##', '###...##', '####..##', '########', '##.##.##', '########', '##..####', '##...###', '##....##'] },
	},
	'₡': {
		5: { rows: ['.###', '##.#', '##..', '##.#', '.###'] },
		6: { rows: ['.#.#.', '#####', '##.#.', '##.#.', '#####', '.#.#.'] },
		7: { rows: ['..#.#.', '.#####', '##.#.#', '##.#..', '##.#.#', '.#####', '..#.#.'] },
		8: { rows: ['..#.#..', '.######', '##.#.#.', '##.#.#.', '##.#.#.', '##.#.#.', '.######', '..#.#..'] },
		9: { rows: ['..#..#.', '.######', '##.#..#', '##.#.#.', '##.#.#.', '##.#.#.', '##.#..#', '.######', '..#..#.'] },
	},
	'₵': {
		5: { up: 1, rows: ['..#.', '.###', '#.#.', '#.#.', '#.#.', '.###', '..#.'] },
		6: { up: 1, rows: ['..#..', '.####', '##.#.', '##.#.', '##.#.', '##.#.', '.####', '..#..'] },
		7: { up: 1, rows: ['...#..', '.#####', '##.#.#', '##.#..', '##.#..', '##.#..', '##.#.#', '.#####', '...#..'] },
		8: { up: 1, rows: ['...#..', '.######', '##.#..#', '##.#...', '##.#...', '##.#...', '##.#...', '##.#..#', '.######', '...#...'] },
		9: { up: 1, rows: ['...##..', '.######', '##.##.#', '##.##..', '##.##..', '##.##..', '##.##..', '##.##..', '##.##.#', '.######', '...##..'] },
	},
	ج: {
		5: { rows: ['###.', '..#.', '.#..', '#.#.', '.##.'] },
		6: { rows: ['.####', '...#.', '.##..', '#..#.', '#....', '.###.'] },
		7: { rows: ['.#####', '....#.', '..##..', '.#....', '##.##.', '##....', '.####.'] },
		8: { rows: ['..#####', '.....#.', '...##..', '.##....', '##..##.', '##..##.', '##.....', '.#####.'] },
		9: { rows: ['..######', '......##', '....##..', '..##....', '.##.....', '##..##..', '##..##..', '##......', '.######.'] },
	},
	م: {
		5: { rows: ['....', '.##.', '####', '##..', '#...', '#...'] },
		6: { rows: ['.....', '..##.', '.#..#', '#####', '##...', '#....', '#....'] },
		7: { rows: ['......', '..###.', '.##.##', '.##.##', '#####.', '##....', '##....', '##....'] },
		8: { rows: ['.......', '...###.', '..##.##', '..##.##', '.#####.', '##.....', '##.....', '##.....', '##.....'] },
		9: { rows: ['........', '...####.', '..##..##', '..##..##', '..######', '.##.....', '##......', '##......', '##......', '##......'] },
	},
};

/** an outline in dots at a cap (x from the canvas's left edge, y up from the baseline), fitted to the grid the way a hinted
 *  font is: a rectangle's edges on whole dots, a stroke's width a whole number of dots (one at least), a ring's centre on a
 *  dot's corner, its radii on half dots and its strokes whole dots, so bars and stems come out crisp and even rather than half lit */
function gridFit(o: Outline, cap: number): Outline {
	const k = cap / 0.72 / 1000;
	const X = (v: number) => 1 + v * k;
	const Y = (v: number) => v * k;
	const half = (v: number) => Math.round(v * 2) / 2;
	const whole = (v: number) => Math.max(1, Math.round(v * k));
	const one = (sh: Shape): Shape => {
		switch (sh[0]) {
			case 'R': {
				const x0 = Math.round(X(sh[1]));
				const y0 = Math.round(Y(sh[2]));
				return ['R', x0, y0, Math.max(x0 + 1, Math.round(X(sh[3]))), Math.max(y0 + 1, Math.round(Y(sh[4])))];
			}
			case 'E':
				return ['E', X(sh[1]), Y(sh[2]), Math.max(0.6, sh[3] * k), Math.max(0.6, sh[4] * k)];
			case 'A': {
				const tx = whole(sh[5]);
				const ty = whole(sh[6]);
				return ['A', Math.round(X(sh[1])), Math.round(Y(sh[2])), Math.max(tx, half(sh[3] * k)), Math.max(ty, half(sh[4] * k)), tx, ty, sh[7], sh[8]];
			}
			case 'L':
				return ['L', X(sh[1]), Y(sh[2]), X(sh[3]), Y(sh[4]), whole(sh[5])];
			case 'P': {
				const p: number[] = [];
				for (let i = 1; i < sh.length; i += 2) p.push(X(sh[i] as number), Y(sh[i + 1] as number));
				return ['P', ...p];
			}
		}
		return sh;
	};
	return { adv: o.adv, fill: o.fill.map(one), cut: o.cut?.map(one) };
}

/** the advance of a sign at a cap: the outline's in the font's scale (cap / 0.72 px to the em, as vglyph sets the font) */
const advAt = (o: Outline, cap: number) => Math.ceil((o.adv * cap) / 0.72 / 1000);

/** a hand set sign's advance at a cap (its own, else its widest row) */
const handAdv = (hand: Hand) => hand.adv ?? Math.max(...hand.rows.map((r) => r.length));
/** A SIGN'S ADVANCE ALONE at a cap (null: not one of the signs here), exactly signDots' `adv`, without counting a dot: the
 *  amount's size searches (scoreboardDraw.ts rowInfo, fitCap) ask a width at every cap they try, and counting a sign's dots
 *  at each of 40 caps was most of the Total Win card's 400 ms first frame (2026-11-22, wip/ledhitch) */
export function signAdv(ch: string, cap: number): number | null {
	const o = AMOUNT_OUTLINES[ch];
	if (!o) return null;
	cap = Math.max(1, Math.round(cap));
	const hand = AMOUNT_HAND[ch]?.[cap];
	return hand ? handAdv(hand) : advAt(o, cap);
}

const dotsCache = new Map<string, SignDots>();
/** a sign's dots at a cap (null: not one of the signs here) */
export function signDots(ch: string, cap: number): SignDots | null {
	const o = AMOUNT_OUTLINES[ch];
	if (!o) return null;
	cap = Math.max(1, Math.round(cap));
	const key = ch + '|' + cap;
	const got = dotsCache.get(key);
	if (got) return got;
	// (a dot count is the costly part: a card being made ahead of time yields here when its frame's time is up, warmGate.ts)
	warmGate();
	const hand = AMOUNT_HAND[ch]?.[cap];
	const adv = hand ? handAdv(hand) : advAt(o, cap);
	const w = adv + 2;
	const h = Math.ceil(cap * 1.4) + 2;
	const a = new Uint8ClampedArray(w * h);
	if (hand) {
		const top = 1 - (hand.up ?? 0);
		hand.rows.forEach((row, j) => {
			const y = top + j;
			if (y < 0 || y >= h) return;
			for (let i = 0; i < row.length && i + 1 < w; i++) a[y * w + i + 1] = row[i] === '#' ? 255 : row[i] === '+' ? 150 : 0;
		});
	} else {
		// the outline in dots, fitted to the grid (bars and stems on whole dots, never thinner than one), then counted
		const fit = gridFit(o, cap);
		const N = 8;
		for (let j = 0; j < h; j++)
			for (let i = 0; i < w; i++) {
				let n = 0;
				for (let sy = 0; sy < N; sy++)
					for (let sx = 0; sx < N; sx++) if (inside(fit, i + (sx + 0.5) / N, cap + 1 - (j + (sy + 0.5) / N))) n++;
				const al = (n / (N * N)) * 255;
				a[j * w + i] = al < 80 ? 0 : Math.min(255, al * 1.4);
			}
	}
	const r = { w, h, adv, a, hand: !!hand };
	if (dotsCache.size > 1200) dotsCache.clear();
	dotsCache.set(key, r);
	return r;
}

type SignCv = HTMLCanvasElement & { ctx: CanvasRenderingContext2D };
const cvCache = new Map<string, { c: SignCv; adv: number }>();
/** a sign as the canvas vglyph would make for a letter (null: not one of the signs here); white, its dots' alpha */
export function ledSignCanvas(ch: string, cap: number): { c: SignCv; adv: number } | null {
	const key = ch + '|' + cap;
	const got = cvCache.get(key);
	if (got) return got;
	if (!(ch in AMOUNT_OUTLINES)) return null;
	warmGate();
	const d = signDots(ch, cap);
	if (!d) return null;
	const c = document.createElement('canvas') as SignCv;
	c.width = d.w;
	c.height = d.h;
	c.ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
	const id = c.ctx.createImageData(d.w, d.h);
	for (let i = 0; i < d.a.length; i++) {
		id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255;
		id.data[i * 4 + 3] = d.a[i];
	}
	c.ctx.putImageData(id, 0, 0);
	const r = { c, adv: d.adv };
	if (cvCache.size > 1200) cvCache.clear();
	cvCache.set(key, r);
	return r;
}

// ---- THE SENTENCE FACE: the 5 x 7 cell, by hand ---------------------------------------------------------------------------
// (the font's own table already has $ and every Latin letter; these are the signs it lacks)
export const SENTENCE_SIGNS: Record<string, string[]> = {
	'€': ['..###', '.#...', '####.', '.#...', '####.', '.#...', '..###'],
	'¥': ['#...#', '.#.#.', '..#..', '#####', '..#..', '#####', '..#..'],
	'₽': ['.###.', '.#..#', '.#..#', '.###.', '.#...', '####.', '.#...'],
	'₱': ['.###.', '#####', '.#..#', '#####', '.#...', '.#...', '.#...'],
	'₹': ['#####', '....#', '#####', '...#.', '###..', '..#..', '...##'],
	'₩': ['#...#', '#...#', '#####', '#.#.#', '#####', '#.#.#', '.#.#.'],
	'₫': ['...#.', '..###', '.####', '#..#.', '.####', '.....', '#####'],
	'₺': ['.#...', '.#...', '.##.#', '##..#', '.##.#', '.#..#', '..##.'],
	'/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
	'₦': ['#...#', '##..#', '#####', '#.#.#', '#####', '#..##', '#...#'],
	'₡': ['..#.#', '.####', '#.#.#', '#.#..', '#.#.#', '.####', '..#.#'],
	'₵': ['..#..', '.####', '#.#..', '#.#..', '#.#..', '.####', '..#..'],
	ł: ['##.', '.#.', '.##', '##.', '.#.', '.#.', '###'],
	ج: ['####.', '..#..', '.#...', '#....', '#.#..', '#....', '.###.'],
	م: ['.....', '..##.', '.#..#', '.####', '##...', '#....', '#....'],
};

// ---- WHAT EACH FACE CAN DRAW ---------------------------------------------------------------------------------------------
/** the amount face's own characters (Overpass Heavy: the digits, the separators, the Latin letters and ł) */
const AMOUNT_FONT_CHARS = new Set([...'0123456789., \u00a0', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzł']);
/** the sentence face's own characters (ledScreens FONT) */
const SENTENCE_FONT_CHARS = new Set([...'0123456789.,\' ?!$', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz']);
/** every character the amount face draws: its font's, and the signs here */
export const amountFaceHas = (ch: string) => AMOUNT_FONT_CHARS.has(ch) || ch in AMOUNT_OUTLINES;
/** every character the sentence face draws: its font's, and the signs here (a non breaking space draws as its space) */
export const sentenceFaceHas = (ch: string) => SENTENCE_FONT_CHARS.has(ch) || ch === ' ' || ch in SENTENCE_SIGNS;
