// THE SIGN BAR'S LAYOUT (2026-11-22). The one typed layout file of the new game bar: Corey's own places, and the rule
// that carries them to every window. Pure functions and data, no DOM, no game state (tools/sign_layout_test.mjs runs it
// in node; tools/hud_probe.mjs section `signhud` reads the same numbers through __reindeer.sign).
//
// WHERE THE NUMBERS COME FROM (the mocks in ~/Desktop/Run Over Reindeer):
//   desktop   corey_layout_r4_2026-11-22.json (his 1920 x 1080 layout, a 1440 x 810 plane in bar px) with the buttons of
//             corey_hud_r8_2026-11-22.json, and the per-size rule and nudges of desktop_hud_r10_sizes_2026-11-22
//   phones    corey_phone_r2_2026-11-22.json: his places at nine windows, CSS px of each window
//
// UNITS. "bar px" are the mock's own px: u CSS px per bar px (signScale). Every box this file answers is CSS px of the
// window, top left origin.
//
// THE RULE BETWEEN HIS SIZES (phones).
//   1. A window is a point (its short side, its long side over its short side). His windows are the corners of a few
//      triangles in that plane (TRI). Inside a triangle a window takes the three corners' layouts in the share it is
//      near each (barycentric weights: exact at a corner, a straight line along an edge). Outside them all it takes the
//      nearest point of their outline (so a larger or longer phone keeps the nearest of his layouts, at its own scale).
//   2. What is blended is each piece's size and its distance from what it belongs to, in bar px:
//        upright   the Play from the screen's center line; Auto, Turbo and the amount from the right edge; Balance and
//                  Win from the left edge; all of those from the bottom edge. Menu and Fast Lane from the right edge and
//                  the top line (the clock and the names: it rides down with the game's picture on a taller phone,
//                  and Menu stands just under it at every one of his windows).
//        sideways  the Play, Auto, Turbo and the amount from the right edge; Menu, Fast Lane, Balance and Win from the
//                  left edge; all of them from the screen's middle line (the board is centered on it).
//   3. Then the guards, none of which moves anything at his own windows: a piece inside a safe area inset moves out of
//      it; upright, bottom pieces that would stand on the LED strip close up toward the bottom edge (sizes too), and
//      Menu and Fast Lane rise off the board; sideways, a side's pieces that would stand on the board, the strip or
//      the logo move away from it. A piece counts as on a zone when it is more than ZONE_TOL CSS px into it.
//   4. The bet symbols are seated either side of the amount by the widest amount rule (seatAmount), and if a press
//      box would then touch the Play's diamond the amount and its symbols move away from the Play.
// Desktop: every piece keeps its bar px size and its distance to the nearer side of the 16:9 game area and to the
// bottom edge (desktopLayout).

export type Box = { x: number; y: number; w: number; h: number };
export type Insets = { t: number; r: number; b: number; l: number };
export type SignKind = 'landscape' | 'portrait' | 'phone';
export type PieceId = 'play' | 'auto' | 'turbo' | 'menu' | 'bonus' | 'amt' | 'bal' | 'win';
export type Just = 'left' | 'center';
export type Pt = [number, number];
/** the scene's keep-outs, CSS px: the five columns, the LED strip (snow cap top to housing bottom), the logo sign */
export type Zones = { board: Box; strip: Box; logo: Box | null };
export type SignView = { kind: SignKind; vw: number; vh: number; safe?: Insets; zones?: Zones | null };

export const PIECES: PieceId[] = ['play', 'auto', 'turbo', 'menu', 'bonus', 'amt', 'bal', 'win'];
/** a piece is on a zone when it is more than this far into it, CSS px (the zones are known to about a pixel) */
export const ZONE_TOL = 1.5;
/** the smallest press region, CSS px (house rule L4) */
export const TOUCH_MIN = 44;
/** the smallest type the nudges allow, CSS px */
export const TEXT_MIN = 10;

// ---- the pieces' own proportions (the mock's boxOf) ----
/** a readout's box at scale 1, bar px */
export const READOUT_BASE = { amt: { w: 124, h: 40 }, bal: { w: 186, h: 40 }, win: { w: 220, h: 42 } } as const;
/** a readout's type at scale 1, bar px: its header plate's letters and its number */
export const READOUT_TYPE = { head: 10.5, amt: 21, bal: 21, win: 26 } as const;
/** the Play's drawn diamond: its half diagonal over half its box (113.6 of 120) */
export const PLAY_V = 113.6 / 120;
/** Auto and Turbo: the drawn diamond's half diagonal over half its box */
export const KEY_V = 1 - 4.4 / 97.6;
/** a key's size (the mock's s) from its box: the box is 1.22 s */
export const KEY_BOX = 1.22;
/** the Fast Lane hexagon: its point's depth over its width */
export const HEX_Q = 0.2;
/** the Win box's glass round its readout, bar px at scale 1 */
export const WIN_PAD = 8;

// ---- THE DESKTOP LAYOUT: his 1920 x 1080, a 1440 x 810 plane in bar px (boxes: x, y, w, h) ----
export const DESKTOP = {
	plane: { w: 1440, h: 810 },
	/** bar px per master px at his window (the 1280 x 720 master drawn at 1440 x 810) */
	k: 1.125,
	step: 42,
	gap: 4,
	p: {
		play: [1206.6, 490, 240, 240],
		auto: [1291.2, 383.9, 97.6, 97.6],
		turbo: [1340, 432.7, 100.04, 100.04],
		menu: [3, 532.7, 160, 75],
		bonus: [0, 620, 163, 110],
		amt: [1223.2, 736, 155, 50],
		bal: [15, 743.5, 251.1, 54],
		win: [608.1, 764.2, 198, 37.8],
	} as Record<PieceId, [number, number, number, number]>,
	just: { amt: 'center', bal: 'left', win: 'center' } as Record<'amt' | 'bal' | 'win', Just>,
	/** HIS LED STRIP at 16:9 (the same layout export, `led`): the game's strip at its own place and width, 101 CSS px tall
	 *  at 1920 x 1080 where the game's rule gave 75.3 (23 dot rows for 16). In master units; a window whose own rule
	 *  already gives a taller strip (16:10) keeps the game's. game/scoreboard/layout.ts reads it. */
	stripH: 101 / 1.5,
} as const;

// ---- HIS PHONE WINDOWS (corey_phone_r2_2026-11-22.json): each piece's box, CSS px of that window ----
type Ref = { vw: number; vh: number; step: number; p: Record<PieceId, [number, number, number, number]>; just: Record<'amt' | 'bal' | 'win', Just> };
const UP: Record<'amt' | 'bal' | 'win', Just> = { amt: 'center', bal: 'left', win: 'center' };
const SIDE: Record<'amt' | 'bal' | 'win', Just> = { amt: 'center', bal: 'center', win: 'center' };
export const PHONE_REFS: Record<'portrait' | 'phone', Ref[]> = {
	portrait: [
		{ vw: 425, vh: 812, step: 22, just: UP, p: { play: [146.5, 625.7, 145.5, 145.5], auto: [290.6, 714.5, 56.7, 56.7], turbo: [349.8, 714.5, 56.7, 56.7], menu: [298, 50.7, 100.3, 46.9], bonus: [291.9, 103.4, 111.5, 75.2], amt: [299.2, 641.5, 97.3, 31.4], bal: [23.4, 742.9, 113.5, 24.4], win: [8.7, 641.5, 131.9, 25.2] } },
		{ vw: 375, vh: 667, step: 22, just: UP, p: { play: [125.6, 541.3, 125.5, 125.5], auto: [257.6, 604, 50, 50], turbo: [313.6, 604, 50, 50], menu: [268.4, 26.7, 95.2, 44.2], bonus: [270.4, 79.4, 91.2, 61.5], amt: [257.6, 548.4, 85.8, 27.7], bal: [15.5, 626.6, 100.2, 21.5], win: [15, 548.4, 122.7, 23.4] } },
		{ vw: 320, vh: 568, step: 16, just: UP, p: { play: [83.5, 455.5, 104.6, 104.6], auto: [217.7, 507.7, 44.4, 44.4], turbo: [262.1, 506.7, 44.4, 44.4], menu: [222.4, 28.1, 93.5, 44.3], bonus: [221.8, 74.3, 96.1, 64.8], amt: [222.4, 470.2, 53.9, 17.4], bal: [13, 536.9, 70.6, 15.2], win: [3, 460.4, 102.9, 19.6] } },
		{ vw: 390, vh: 844, step: 22, just: UP, p: { play: [131.3, 676.8, 127.5, 127.5], auto: [263.5, 754, 52, 52], turbo: [321, 754, 52, 52], menu: [282, 95, 95, 45], bonus: [278.4, 147.1, 102.3, 69], amt: [270.9, 684.4, 89.3, 28.8], bal: [24.4, 775.3, 104.2, 22.4], win: [28.9, 687.6, 95.2, 18.2] } },
		{ vw: 390, vh: 620, step: 22, just: UP, p: { play: [133.5, 491.3, 123.2, 123.2], auto: [263.5, 565, 52, 52], turbo: [321, 565, 52, 52], menu: [278, 24.1, 95, 45], bonus: [274.7, 76.8, 102.3, 69], amt: [270.9, 498.2, 89.3, 28.8], bal: [24.4, 586.1, 104.2, 22.4], win: [28.9, 501.5, 95.2, 18.2] } },
	],
	phone: [
		{ vw: 812, vh: 425, step: 26, just: SIDE, p: { play: [645.4, 193.8, 166.6, 166.6], auto: [709.5, 131.4, 62.5, 62.5], turbo: [749.5, 170.3, 62.5, 62.5], menu: [26, 185.9, 98.9, 46.8], bonus: [21.5, 240.7, 108, 72.9], amt: [662.9, 363.9, 116, 37.4], bal: [-1.9, 330.6, 154.9, 33.3], win: [6.4, 380.2, 142, 27.1] } },
		{ vw: 667, vh: 375, step: 26, just: SIDE, p: { play: [523.3, 164.8, 136.8, 136.8], auto: [581.9, 121.3, 51.3, 51.3], turbo: [611.8, 152.8, 51.3, 51.3], menu: [12.3, 185.3, 94.9, 44.5], bonus: [23, 233.2, 73.5, 49.6], amt: [555.8, 323, 71.8, 23.1], bal: [-3.8, 295.6, 127.2, 27.4], win: [6.8, 335, 116.6, 22.3] } },
		{ vw: 568, vh: 320, step: 26, just: SIDE, p: { play: [451.5, 148.3, 116.5, 116.5], auto: [492, 103.9, 44.4, 44.4], turbo: [517.8, 130.4, 44.4, 44.4], menu: [16, 134.1, 95.4, 45.1], bonus: [30.8, 184.3, 65.8, 44.3], amt: [485.3, 272.3, 41.6, 13.4], bal: [9.5, 246.7, 108.4, 23.3], win: [11.7, 279, 118.6, 22.6] } },
		{ vw: 844, vh: 390, step: 26, just: SIDE, p: { play: [637.4, 161.9, 157, 157], auto: [701.6, 114.9, 60, 60], turbo: [740, 151.4, 60, 60], menu: [77, 159.4, 95, 45], bonus: [81.5, 211.4, 86, 58], amt: [670.3, 329, 91.3, 29.4], bal: [54.2, 278.4, 148.8, 32], win: [56.3, 323.2, 136.4, 26] } },
	],
};
// ---- BALANCE AND THE AMOUNT, LARGER ON PHONES (Corey on the live bar, upright, 2026-11-22: "Also the Text size for
// Balance and Spin is very small, I think we should boost these up") ----
// Upright, at every one of his windows, the Balance readout and the amount readout (each one's number and header
// plate together) are BOOST.k of the size he set: Balance keeps its left edge and its bottom edge (so its number stays
// on its line at the bottom left), the amount keeps its center. Sideways the same only where his number is as small
// as upright's were (under BOOST.under CSS px tall: Balance centered, keeping its bottom edge, and the amount). The
// bar is laid out from these places (PHONE_PLACES); PHONE_REFS stays his own copy. What the growth meets is resolved
// by the amount's seat (seatAmount: the symbols stand as far apart as the row allows, the group moves the least it
// must), never by moving the Play, Auto or Turbo.
export const BOOST = { k: 1.35, under: 13 } as const;
const boostRef = (o: 'portrait' | 'phone', r: Ref): Ref => {
	const p = { ...r.p };
	const k = BOOST.k;
	const [bx, by, bw, bh] = r.p.bal;
	if (o === 'portrait') p.bal = [bx, by + bh - bh * k, bw * k, bh * k];
	else if ((READOUT_TYPE.bal * bw) / READOUT_BASE.bal.w < BOOST.under) p.bal = [bx + bw / 2 - (bw * k) / 2, by + bh - bh * k, bw * k, bh * k];
	const [ax, ay, aw, ah] = r.p.amt;
	if (o === 'portrait' || (READOUT_TYPE.amt * aw) / READOUT_BASE.amt.w < BOOST.under) p.amt = [ax + aw / 2 - (aw * k) / 2, ay + ah / 2 - (ah * k) / 2, aw * k, ah * k];
	return { ...r, p };
};
/** the places the bar is laid out from: his, with Balance and the amount enlarged (above) */
export const PHONE_PLACES: Record<'portrait' | 'phone', Ref[]> = {
	portrait: PHONE_REFS.portrait.map((r) => boostRef('portrait', r)),
	phone: PHONE_REFS.phone.map((r) => boostRef('phone', r)),
};
/** the triangles his windows make in the (short side, long over short) plane, by index into PHONE_REFS. Upright: the
 *  375 x 667 window is inside the other four, so they fan round it. Sideways: the four are the outline's corners. */
export const TRI: Record<'portrait' | 'phone', [number, number, number][]> = {
	portrait: [[2, 4, 1], [4, 0, 1], [0, 3, 1], [3, 2, 1]],
	phone: [[2, 1, 3], [1, 0, 3]],
};

// ---- the scale ----
/** CSS px per bar px. Desktop: the game's own fit (the 1280 x 720 master) over DESKTOP.k. Upright: the window's width
 *  over 390, held by its height on a window squatter than his shortest (390 x 620). Sideways: the phone master's fit
 *  (1480 x 740) over 0.527027 (the master drawn 390 high), as the glass dock scaled. */
export const signScale = (kind: SignKind, vw: number, vh: number) =>
	kind === 'portrait' ? Math.min(vw / 390, vh / 620) : kind === 'phone' ? Math.min(vw / 1480, vh / 740) / 0.527027 : Math.min(vw / 1280, vh / 720) / DESKTOP.k;

// ---- shapes: what a piece really covers and what takes its press ----
/** a piece's real shape (CSS px): the drawn diamond of the Play, Auto and Turbo, the Fast Lane hexagon, a box otherwise */
export const shapeOf = (id: PieceId | 'down' | 'up', b: Box): Pt[] => {
	const cx = b.x + b.w / 2;
	const cy = b.y + b.h / 2;
	if (id === 'play' || id === 'auto' || id === 'turbo') {
		const v = (b.w / 2) * (id === 'play' ? PLAY_V : KEY_V);
		return [[cx, cy - v], [cx + v, cy], [cx, cy + v], [cx - v, cy]];
	}
	if (id === 'bonus') {
		const q = b.w * HEX_Q;
		return [[b.x + q, b.y], [b.x + b.w - q, b.y], [b.x + b.w, cy], [b.x + b.w - q, b.y + b.h], [b.x + q, b.y + b.h], [b.x, cy]];
	}
	return [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
};
const boxPts = (b: Box): Pt[] => [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
const inPoly = (p: Pt, poly: Pt[]) => {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const a = poly[i];
		const b = poly[j];
		if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
	}
	return inside;
};
const segDist = (p: Pt, a: Pt, b: Pt) => {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
	return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
};
const cross = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const segsCross = (a: Pt, b: Pt, c: Pt, d: Pt) => cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
/** the gap between two convex shapes, CSS px (0 when they meet or one is inside the other) */
export const shapeGap = (A: Pt[], B: Pt[]) => {
	if (A.some((p) => inPoly(p, B)) || B.some((p) => inPoly(p, A))) return 0;
	let m = Infinity;
	for (let i = 0; i < A.length; i++)
		for (let j = 0; j < B.length; j++) {
			const a2 = A[(i + 1) % A.length];
			const b2 = B[(j + 1) % B.length];
			if (segsCross(A[i], a2, B[j], b2)) return 0;
			m = Math.min(m, segDist(A[i], B[j], b2), segDist(B[j], A[i], a2));
		}
	return m;
};
/** is a piece's shape more than `tol` into a zone's box? */
export const onZone = (shape: Pt[], zone: Box, tol = ZONE_TOL) => {
	if (zone.w <= 2 * tol || zone.h <= 2 * tol) return false;
	return shapeGap(shape, boxPts({ x: zone.x + tol, y: zone.y + tol, w: zone.w - 2 * tol, h: zone.h - 2 * tol })) === 0;
};
const distToPoly = (p: Pt, poly: Pt[]) => (inPoly(p, poly) ? 0 : Math.min(...poly.map((a, i) => segDist(p, a, poly[(i + 1) % poly.length]))));
const inCircle = (c: Pt, poly: Pt[]) => 2 * Math.min(...poly.map((a, i) => segDist(c, a, poly[(i + 1) % poly.length])));
export type PressId = 'play' | 'auto' | 'turbo' | 'menu' | 'bonus' | 'down' | 'up';
/** THE PRESS REGIONS, the diameter of the largest circle each one holds, CSS px.
 *   Play            its drawn diamond (the button is a square turned 45 degrees, so it takes presses as that diamond):
 *                   the circle inside it, 0.669 of its box
 *   Auto, Turbo     their drawn diamond, grown to a 44 px circle on their center (a press pad that lies under every
 *                   drawn control, ui/sign/SignHud.svelte), as far as that circle stays clear of every other press
 *                   region
 *   Fast Lane       the circle inside its hexagon (the button is its box); Menu and the bet symbols: their boxes */
export const pressRegions = (boxes: Partial<Record<PressId, Box>>): Partial<Record<PressId, number>> => {
	const ids = (Object.keys(boxes) as PressId[]).filter((id) => boxes[id]);
	const sh = Object.fromEntries(ids.map((id) => [id, shapeOf(id, boxes[id] as Box)])) as Record<PressId, Pt[]>;
	const ctr = (id: PressId): Pt => [(boxes[id] as Box).x + (boxes[id] as Box).w / 2, (boxes[id] as Box).y + (boxes[id] as Box).h / 2];
	const out: Partial<Record<PressId, number>> = {};
	for (const id of ids) {
		const b = boxes[id] as Box;
		if (id === 'play' || id === 'bonus') out[id] = inCircle(ctr(id), sh[id]);
		else if (id === 'auto' || id === 'turbo') {
			const ins = inCircle(ctr(id), sh[id]);
			let d = ins;
			if (ins < TOUCH_MIN) {
				d = TOUCH_MIN;
				for (const o of ids) {
					if (o === id) continue;
					const lim = o === 'auto' || o === 'turbo' ? Math.hypot(ctr(id)[0] - ctr(o)[0], ctr(id)[1] - ctr(o)[1]) : 2 * distToPoly(ctr(id), sh[o]);
					d = Math.min(d, lim);
				}
				d = Math.max(d, ins);
			}
			out[id] = d;
		} else out[id] = Math.min(b.w, b.h);
	}
	return out;
};

// ---- the bet symbols (the mock's stepDraw and stepBox), bar px ----
/** the drawn chevron for a symbol `size` bar px tall: its line, its white and dark outlines, half its width (a) and
 *  half its height (b) on the center line, and the whole drawn width and height */
export const stepDraw = (size: number) => {
	const k = size / 13.6;
	const sw = 3.2 * k;
	const white = Math.max(1.5, 0.8 * k);
	const dark = Math.max(0.8, 0.36 * k);
	const a = 3.4 * k;
	const b = 6.8 * k;
	return { k, sw, white, dark, a, b, w: 2 * a + sw + 2 * (white + dark), h: 2 * b + sw + 2 * (white + dark) };
};
/** the symbol's press box, bar px: round the drawn symbol, never under 34 bar px nor under 44 CSS px */
export const stepBox = (size: number, u: number) => {
	const D = stepDraw(size);
	const lo = Math.max(34, TOUCH_MIN / u);
	return { w: Math.max(lo, Math.ceil(D.w + 2)), h: Math.max(lo, Math.ceil(D.h + 2)) };
};

// ---- the layout ----
export type SignGeo = {
	kind: SignKind;
	/** CSS px per bar px */
	u: number;
	vw: number;
	vh: number;
	/** each piece's box, CSS px */
	box: Record<PieceId, Box>;
	/** the readouts' scales (their type is READOUT_TYPE times these, bar px) and where their text stands in the box */
	rs: Record<'amt' | 'bal' | 'win', number>;
	just: Record<'amt' | 'bal' | 'win', Just>;
	/** the bet symbol's height and the gap between a symbol's press box and the amount, bar px */
	step: number;
	gap: number;
	/** the Win box: a pill on the desktop, a rectangle on a phone */
	winShape: 'pill' | 'rect';
	/** Turbo shows its word (false: bolt and pips only, where the word would be under about 10 CSS px) */
	turboWord: boolean;
	/** the rule's own working, for the probes: the blend's weights over his windows (phones), what the guards moved */
	weights: number[];
	moved: string[];
	/** desktop: the 16:9 game area's left and right edges, CSS px (the window's own edges up to 16:9) */
	area: { x0: number; x1: number };
};

const ZERO: Insets = { t: 0, r: 0, b: 0, l: 0 };
const toBox = (a: readonly number[], k = 1): Box => ({ x: a[0] * k, y: a[1] * k, w: a[2] * k, h: a[3] * k });
/** Turbo's word on screen (0.18 of the key's content, CSS px) is 9.5 px or more; `turbo` is its box in CSS px */
const turboWordOk = (turbo: Box) => 0.18 * 0.8 * (turbo.w / KEY_BOX) >= 9.5;

/** THE DESKTOP RULE: his bar px sizes; each piece the same distance from the nearer side of the 16:9 game area (the
 *  window up to 16:9, the centered 16:9 area on a wider one) and from the bottom edge (a taller window's bottom row
 *  rides down with the edge, as the game's own did) */
export const desktopLayout = (v: SignView): SignGeo => {
	const u = signScale('landscape', v.vw, v.vh);
	const D = DESKTOP;
	const areaW = Math.min(v.vw, (v.vh * 16) / 9);
	const x0 = (v.vw - areaW) / 2;
	const x1 = x0 + areaW;
	const box = {} as Record<PieceId, Box>;
	for (const id of PIECES) {
		const [x, y, w, h] = D.p[id];
		const left = x + w / 2 < D.plane.w / 2;
		box[id] = { x: left ? x0 + x * u : x1 - (D.plane.w - x) * u, y: v.vh - (D.plane.h - y) * u, w: w * u, h: h * u };
	}
	return {
		kind: 'landscape',
		u,
		vw: v.vw,
		vh: v.vh,
		box,
		rs: { amt: D.p.amt[2] / READOUT_BASE.amt.w, bal: D.p.bal[2] / READOUT_BASE.bal.w, win: D.p.win[2] / READOUT_BASE.win.w },
		just: { ...D.just },
		step: D.step,
		gap: D.gap,
		winShape: 'pill',
		turboWord: turboWordOk(box.turbo),
		weights: [],
		moved: [],
		area: { x0, x1 },
	};
};

// ---- the blend between his phone windows ----
const param = (vw: number, vh: number): Pt => [Math.min(vw, vh) / 100, Math.max(vw, vh) / Math.min(vw, vh) / 0.5];
/** the weights of his windows for a window: barycentric in the triangle that holds it, or at the nearest point of the
 *  triangles' outline */
export const blendWeights = (o: 'portrait' | 'phone', vw: number, vh: number): number[] => {
	const refs = PHONE_REFS[o];
	const P = refs.map((r) => param(r.vw, r.vh));
	const q = param(vw, vh);
	let best: { d: number; w: number[] } | null = null;
	for (const [i, j, k] of TRI[o]) {
		const a = P[i];
		const b = P[j];
		const c = P[k];
		const den = cross(a, b, c);
		const wa = cross(q, b, c) / den;
		const wb = cross(a, q, c) / den;
		const wc = 1 - wa - wb;
		const w = refs.map(() => 0);
		if (wa >= -1e-9 && wb >= -1e-9 && wc >= -1e-9) {
			w[i] = Math.max(0, wa);
			w[j] = Math.max(0, wb);
			w[k] = Math.max(0, wc);
			return w;
		}
		for (const [m, n] of [[i, j], [j, k], [k, i]]) {
			const A = P[m];
			const B = P[n];
			const dx = B[0] - A[0];
			const dy = B[1] - A[1];
			const t = Math.max(0, Math.min(1, ((q[0] - A[0]) * dx + (q[1] - A[1]) * dy) / (dx * dx + dy * dy)));
			const d = Math.hypot(q[0] - A[0] - dx * t, q[1] - A[1] - dy * t);
			if (!best || d < best.d - 1e-12) {
				const ww = refs.map(() => 0);
				ww[m] = 1 - t;
				ww[n] = t;
				best = { d, w: ww };
			}
		}
	}
	return (best as { d: number; w: number[] }).w;
};

type Anchor = { ax: 'L' | 'R' | 'C'; ay: 'T' | 'B' | 'M' };
/** what each piece belongs to (see the rule, 2) */
export const ANCHORS: Record<'portrait' | 'phone', Record<PieceId, Anchor>> = {
	portrait: {
		play: { ax: 'C', ay: 'B' },
		auto: { ax: 'R', ay: 'B' },
		turbo: { ax: 'R', ay: 'B' },
		amt: { ax: 'R', ay: 'B' },
		bal: { ax: 'L', ay: 'B' },
		win: { ax: 'L', ay: 'B' },
		menu: { ax: 'R', ay: 'T' },
		bonus: { ax: 'R', ay: 'T' },
	},
	phone: {
		play: { ax: 'R', ay: 'M' },
		auto: { ax: 'R', ay: 'M' },
		turbo: { ax: 'R', ay: 'M' },
		amt: { ax: 'R', ay: 'M' },
		menu: { ax: 'L', ay: 'M' },
		bonus: { ax: 'L', ay: 'M' },
		bal: { ax: 'L', ay: 'M' },
		win: { ax: 'L', ay: 'M' },
	},
};
const anchorX = (a: Anchor['ax'], W: number) => (a === 'L' ? 0 : a === 'R' ? W : W / 2);
/** THE TOP LINE's lower edge upright, CSS px: the clock strip stands 28 master units under the top of the game's upright
 *  master (412 x 760, fitted to the window and centered: game/layoutSpec.ts MASTER.portrait; the same number
 *  ui/hud/hudLayout.ts hudSkipRect reads). On a phone taller than his tallest the master is letterboxed further and the
 *  top line comes down with it: Menu, Fast Lane and SKIP TO RESULT keep their distance under it. */
export const PORTRAIT_MASTER = { w: 412, h: 760, topLine: 28 } as const;
export const topLine = (vw: number, vh: number) => {
	const fit = Math.min(vw / PORTRAIT_MASTER.w, vh / PORTRAIT_MASTER.h);
	return (vh - PORTRAIT_MASTER.h * fit) / 2 + PORTRAIT_MASTER.topLine * fit;
};
/** an anchor's line, bar px: `top` is the top line's lower edge (upright) */
export const anchorY = (a: Anchor['ay'], H: number, top: number) => (a === 'T' ? top : a === 'B' ? H : H / 2);

const shift = (box: Record<PieceId, Box>, ids: PieceId[], dx: number, dy: number) => {
	for (const id of ids) box[id] = { ...box[id], x: box[id].x + dx, y: box[id].y + dy };
};
const extent = (box: Record<PieceId, Box>, ids: PieceId[]) => {
	let x0 = Infinity;
	let y0 = Infinity;
	let x1 = -Infinity;
	let y1 = -Infinity;
	for (const id of ids)
		for (const p of shapeOf(id, box[id])) {
			x0 = Math.min(x0, p[0]);
			y0 = Math.min(y0, p[1]);
			x1 = Math.max(x1, p[0]);
			y1 = Math.max(y1, p[1]);
		}
	return { x0, y0, x1, y1 };
};
const r1 = (v: number) => Math.round(v * 10) / 10;

/** THE PHONE RULE (upright and sideways): the blend of his windows, then the guards */
export const phoneLayout = (v: SignView): SignGeo => {
	const o = v.kind === 'portrait' ? 'portrait' : 'phone';
	const refs = PHONE_PLACES[o];
	const A = ANCHORS[o];
	const u = signScale(o, v.vw, v.vh);
	const W = v.vw / u;
	const H = v.vh / u;
	const w = blendWeights(o, v.vw, v.vh);
	const box = {} as Record<PieceId, Box>;
	let step = 0;
	for (let i = 0; i < refs.length; i++) step += w[i] * refs[i].step;
	for (const id of PIECES) {
		let ox = 0;
		let oy = 0;
		let bw = 0;
		let bh = 0;
		for (let i = 0; i < refs.length; i++) {
			if (!w[i]) continue;
			const r = refs[i];
			const ru = signScale(o, r.vw, r.vh);
			const [x, y, pw, ph] = r.p[id];
			ox += w[i] * ((x + pw / 2) / ru - anchorX(A[id].ax, r.vw / ru));
			oy += w[i] * ((y + ph / 2) / ru - anchorY(A[id].ay, r.vh / ru, topLine(r.vw, r.vh) / ru));
			bw += (w[i] * pw) / ru;
			bh += (w[i] * ph) / ru;
		}
		box[id] = { x: (anchorX(A[id].ax, W) + ox - bw / 2) * u, y: (anchorY(A[id].ay, H, topLine(v.vw, v.vh) / u) + oy - bh / 2) * u, w: bw * u, h: bh * u };
	}
	const moved: string[] = [];
	const safe = v.safe ?? ZERO;
	const Z = v.zones ?? null;
	if (o === 'portrait') {
		const bottom: PieceId[] = ['play', 'auto', 'turbo', 'amt', 'bal', 'win'];
		const top: PieceId[] = ['menu', 'bonus'];
		// the home indicator: the bottom pieces stand above it
		let e = extent(box, bottom);
		const floor = v.vh - safe.b;
		if (safe.b > 0 && e.y1 > floor + 0.01) {
			shift(box, bottom, 0, floor - e.y1);
			moved.push(`bottom pieces ${r1(e.y1 - floor)} px up (safe area)`);
		}
		// the LED strip: the bottom pieces close up toward the bottom edge, sizes too, until the highest clears it
		if (Z) {
			e = extent(box, bottom);
			const sb = Z.strip.y + Z.strip.h;
			if (e.y0 < sb - ZONE_TOL && e.x1 > Z.strip.x && e.x0 < Z.strip.x + Z.strip.w) {
				const base = extent(box, bottom).y1;
				const f = Math.max(0.5, (base - sb) / (base - e.y0));
				for (const id of bottom) {
					const b = box[id];
					const cx = b.x + b.w / 2;
					const cy = base - (base - (b.y + b.h / 2)) * f;
					box[id] = { x: cx - (b.w * f) / 2, y: cy - (b.h * f) / 2, w: b.w * f, h: b.h * f };
				}
				step *= f;
				moved.push(`bottom pieces drawn in to ${Math.round(f * 100)} % (the LED strip)`);
			}
			// Menu and Fast Lane: off the board (up), never above the top line
			e = extent(box, top);
			if (e.y1 > Z.board.y + ZONE_TOL && onZone(shapeOf('bonus', box.bonus), Z.board)) {
				const dy = Math.max(Math.min(0, topLine(v.vw, v.vh) - e.y0), Z.board.y - e.y1);
				if (dy < 0) {
					shift(box, top, 0, dy);
					moved.push(`Menu and Fast Lane ${r1(-dy)} px up (the board)`);
				}
			}
		}
		// the side insets (a notch on an upright window is rare: the two side groups move in)
		for (const [ids, side] of [[['bal', 'win'], 'l'], [['auto', 'turbo', 'amt', 'menu', 'bonus'], 'r']] as [PieceId[], 'l' | 'r'][]) {
			const ee = extent(box, ids);
			const dx = side === 'l' ? (safe.l > 0 ? Math.max(0, safe.l - ee.x0) : 0) : safe.r > 0 ? Math.min(0, v.vw - safe.r - ee.x1) : 0;
			if (dx) shift(box, ids, dx, 0);
		}
	} else {
		const sides: [PieceId[], 1 | -1][] = [[['menu', 'bonus', 'bal', 'win'], -1], [['play', 'auto', 'turbo', 'amt'], 1]];
		for (const [ids, dir] of sides) {
			// the notch side and the home indicator
			let e = extent(box, ids);
			// (only a real inset moves anything: his own boxes may pass the window's edge by a pixel or two)
			const dx = dir < 0 ? (safe.l > 0 ? Math.max(0, safe.l - e.x0) : 0) : safe.r > 0 ? Math.min(0, v.vw - safe.r - e.x1) : 0;
			const dy = safe.b > 0 ? Math.min(0, v.vh - safe.b - e.y1) : 0;
			if (Math.abs(dx) > 0.01 || dy < -0.01) {
				shift(box, ids, dx, dy);
				moved.push(`${dir < 0 ? 'left' : 'right'} pieces ${r1(Math.abs(dx))} px in, ${r1(-dy)} px up (safe area)`);
			}
			if (!Z) continue;
			// the board, the strip and the logo: this side's pieces move away from the middle (as far as the screen's edge)
			let out = 0;
			for (const id of ids) {
				const s = shapeOf(id, box[id]);
				const xs = s.map((p) => p[0]);
				for (const z of [Z.board, Z.strip]) if (onZone(s, z)) out = Math.max(out, dir < 0 ? Math.max(...xs) - z.x : z.x + z.w - Math.min(...xs));
			}
			if (out > 0) {
				e = extent(box, ids);
				const room = dir < 0 ? Math.max(0, e.x0 - safe.l) : Math.max(0, v.vw - safe.r - e.x1);
				const d = Math.min(out, room);
				if (d > 0) {
					shift(box, ids, dir * d, 0);
					moved.push(`${dir < 0 ? 'left' : 'right'} pieces ${r1(d)} px out (the board or the strip)`);
				}
			}
			if (Z.logo && dir < 0) {
				const lg = Z.logo;
				const hit = ids.filter((id) => onZone(shapeOf(id, box[id]), lg));
				if (hit.length) {
					e = extent(box, ids);
					const d = Math.min(lg.y + lg.h - Math.min(...hit.map((id) => box[id].y)), Math.max(0, v.vh - safe.b - e.y1));
					if (d > 0) {
						shift(box, ids, 0, d);
						moved.push(`left pieces ${r1(d)} px down (the logo)`);
					}
				}
			}
		}
	}
	const just = refs[w.indexOf(Math.max(...w))].just;
	return {
		kind: v.kind,
		u,
		vw: v.vw,
		vh: v.vh,
		box,
		rs: { amt: box.amt.w / u / READOUT_BASE.amt.w, bal: box.bal.w / u / READOUT_BASE.bal.w, win: box.win.w / u / READOUT_BASE.win.w },
		just: { ...just },
		step,
		gap: DESKTOP.gap,
		winShape: 'rect',
		turboWord: turboWordOk(box.turbo),
		weights: w,
		moved,
		area: { x0: 0, x1: v.vw },
	};
};

/** the bar's layout for a window */
export const signLayout = (v: SignView): SignGeo => {
	return v.kind === 'landscape' ? desktopLayout(v) : phoneLayout(v);
};

// ---- THE WIDEST AMOUNT RULE (the mock's calcFit and place; the game's ui/betStep.ts betSlotWidth is its ancestor) ----
// The game knows the bet ladder and each mode's cost at load. The widest amount the current mode can show is measured
// once; that width is reserved for the amount and the two symbols stand either side of it, so they hold still for
// every step. Where the widest would not fit between whatever stands in the amount's row (a zone, a safe area, another
// piece, the window's edge), the amount's type shrinks in steps of 5 % to the floor (50 %); past the floor it keeps
// shrinking to fit (an amount is never clipped) and `under` says so.
export const AMOUNT_FIT = { floor: 50, margin: 4, minW: 44, playClear: 2 } as const;
/** THE FIT IN STEPS (the amount's rule, and since 2026-11-22 Balance's and Win's): a string `full` wide at its nominal
 *  size in `room`: the nominal size if it fits, else the largest of 95 %, 90 % ... down to the floor that does, else
 *  whatever fits (`under`: past the floor; a number is never clipped and never abbreviated) */
export const fitSteps = (full: number, room: number, floor: number = AMOUNT_FIT.floor) => {
	if (full <= room || full <= 0) return { k: 1, under: false };
	for (let s = 95; s >= floor - 0.001; s -= 5) if ((full * s) / 100 <= room) return { k: s / 100, under: false };
	return { k: Math.max(0.05, Math.floor((room / full) * 1000) / 1000), under: true };
};
export type Seat = {
	/** the amount's type, CSS px, and its share of the nominal size */
	px: number;
	k: number;
	under: boolean;
	/** the reserved width and its box (the amount's own center), CSS px */
	W: number;
	amt: Box;
	down: Box;
	up: Box;
	/** where each symbol is drawn, CSS px: its press box's middle, except where the box had to move in from the
	 *  window's edge (then the symbol stays and only the unseen box moves) */
	downC: Pt;
	upC: Pt;
	/** how far the group stands from his center, CSS px: the least the reserved width needed, and the guard against the
	 *  Play */
	nudge: number;
};
/** the room either side of the amount's center: the row's obstacles (the mock's limits), CSS px */
export const amountLimits = (g: SignGeo, zones: Zones | null, safe: Insets = ZERO): [number, number] => {
	const b = g.box.amt;
	const cx = b.x + b.w / 2;
	const cy = b.y + b.h / 2;
	const sb = stepBox(g.step, g.u);
	const h = sb.h * g.u;
	if (g.kind === 'landscape') return [Math.max(g.area.x0, zones ? zones.strip.x + zones.strip.w : g.area.x0) + AMOUNT_FIT.margin * g.u, g.area.x1 - AMOUNT_FIT.margin * g.u];
	let L = g.u;
	let R = g.vw - g.u;
	const rects: Box[] = [];
	if (zones) {
		rects.push(zones.board, zones.strip);
		if (zones.logo) rects.push(zones.logo);
	}
	if (safe.b) rects.push({ x: 0, y: g.vh - safe.b, w: g.vw, h: safe.b });
	if (safe.l) rects.push({ x: 0, y: 0, w: safe.l, h: g.vh });
	if (safe.r) rects.push({ x: g.vw - safe.r, y: 0, w: safe.r, h: g.vh });
	for (const id of ['menu', 'bonus', 'bal', 'win'] as PieceId[]) rects.push(g.box[id]);
	for (const r of rects) {
		if (Math.min(r.y + r.h, cy + h / 2) - Math.max(r.y, cy - h / 2) < 0.5 * g.u) continue;
		if (r.x + r.w <= cx) L = Math.max(L, r.x + r.w + g.u);
		else if (r.x >= cx) R = Math.min(R, r.x - g.u);
	}
	// THE DIAMONDS BY THEIR REAL SHAPE (2026-11-22, with the larger amount): the Play, Auto and Turbo stand in the row as
	// far as their diamond reaches into it, not as their square boxes (the mock's rule took the box, which left the
	// amount 44 px between its symbols beside the Play). A symbol's press box stays PLAY_CLEAR bar px off a diamond.
	for (const id of ['play', 'auto', 'turbo'] as PieceId[]) {
		const s = shapeOf(id, g.box[id]);
		const dcx = (s[1][0] + s[3][0]) / 2;
		const dcy = (s[0][1] + s[2][1]) / 2;
		const v = s[1][0] - dcx;
		const dy = Math.max(0, cy - h / 2 - dcy, dcy - (cy + h / 2));
		if (dy >= v) continue;
		const hw = v - dy;
		if (dcx + hw <= cx) L = Math.max(L, dcx + hw + AMOUNT_FIT.playClear * g.u);
		else if (dcx - hw >= cx) R = Math.min(R, dcx - hw - AMOUNT_FIT.playClear * g.u);
	}
	return [L, R];
};
/** seat the amount and its symbols. widestEm: the widest amount's width in em of the amount's face; headW: the
 *  amount's header plate, CSS px */
export const seatAmount = (g: SignGeo, widestEm: number, headW: number, limits: [number, number]): Seat => {
	const u = g.u;
	const b = g.box.amt;
	let cx = b.x + b.w / 2;
	const cy = b.y + b.h / 2;
	const sb = stepBox(g.step, u);
	const keyW = sb.w * u;
	const gap = g.gap * u;
	const nominal = READOUT_TYPE.amt * g.rs.amt * u;
	const full = widestEm * nominal;
	const minW = AMOUNT_FIT.minW * u;
	// THE ROOM. Desktop: twice the nearer side's, about his center (as the mock). Phones (2026-11-22, the larger amount):
	// all the row has between its two limits, shared evenly; the group then stands as near his center as that width
	// allows (the smallest move: none where his center already has the room on both sides).
	const phone = g.kind !== 'landscape';
	const room = Math.max(minW, phone ? limits[1] - limits[0] - 2 * (keyW + gap) : 2 * (Math.min(cx - limits[0], limits[1] - cx) - keyW - gap));
	const { k, under } = fitSteps(full, room);
	const W = Math.max(minW, Math.min(room, Math.max(full * k, headW)));
	const his = cx;
	if (phone) {
		const lo = limits[0] + keyW + gap + W / 2;
		const hi = limits[1] - keyW - gap - W / 2;
		cx = lo <= hi ? Math.max(lo, Math.min(cx, hi)) : (limits[0] + limits[1]) / 2;
	}
	// THE GUARD: a symbol's press box never touches the Play's diamond; the group moves away from the Play
	let nudge = 0;
	const play = shapeOf('play', g.box.play);
	// A PRESS BOX NEVER LEAVES THE WINDOW (2026-11-22, the probe host at 568 x 320: his amount there stands so near the
	// right edge that the 44 px box round > ended 1 px past it; a control past the edge makes the browser scroll the
	// whole fixed bar to it on a focus or a scripted press). The box moves in; the drawn symbol stays where his place
	// puts it, so nothing he placed moves.
	const keyH = sb.h * u;
	const boxes = (c: number) => {
		const y = Math.max(0, Math.min(cy - keyH / 2, g.vh - keyH));
		const dx = c - W / 2 - gap - keyW;
		const ux = c + W / 2 + gap;
		return {
			down: { x: Math.max(0, Math.min(dx, g.vw - keyW)), y, w: keyW, h: keyH },
			up: { x: Math.max(0, Math.min(ux, g.vw - keyW)), y, w: keyW, h: keyH },
			downC: [dx + keyW / 2, cy] as Pt,
			upC: [ux + keyW / 2, cy] as Pt,
		};
	};
	const touches = (c: number) => {
		const q = boxes(c);
		return shapeGap(boxPts(q.down), play) === 0 || shapeGap(boxPts(q.up), play) === 0;
	};
	if (touches(cx)) {
		const dir = cx >= g.box.play.x + g.box.play.w / 2 ? 1 : -1;
		const lim = dir > 0 ? g.vw - (cx + W / 2 + gap + keyW) : cx - W / 2 - gap - keyW;
		for (let d = 0.5; d <= Math.max(0, lim) + 0.01; d += 0.5)
			if (!touches(cx + dir * d)) {
				nudge = dir * (d + 0.5);
				break;
			}
		cx += nudge;
	}
	const q = boxes(cx);
	// (nudge: all the group moved from his center, CSS px)
	return { px: nominal * k, k, under, W, amt: { x: cx - W / 2, y: b.y, w: W, h: b.h }, down: q.down, up: q.up, downC: q.downC, upC: q.upC, nudge: cx - his };
};

// ---- A READOUT'S ROOM (Balance, Win): where its number may stand ----
// 2026-11-22, the probe host at 568 x 320 in BTC: the larger Balance ran past the window's left edge. A readout's box
// is his place, but its number may only use the part of that box that is inside the window (READOUT_FIT.edge bar px
// in) and clear of whatever stands in its row: the board, the strip, the logo, another piece's box, the Play's, Auto's
// and Turbo's diamonds. A left set readout keeps his left edge and gives way on its right; a centered one keeps his
// center and gives way evenly. The number is then fitted to that room by the amount's rule (fitSteps, the page
// measures the text: ui/sign/SignHud.svelte), so a long balance shrinks before it can leave the window or meet a
// neighbor.
export const READOUT_FIT = { edge: 2, pad: 2 } as const;
export const readoutRoom = (g: SignGeo, id: 'bal' | 'win', zones: Zones | null, safe: Insets = ZERO): { x: number; w: number } => {
	const b = g.box[id];
	const m = READOUT_FIT.edge * g.u;
	const left = g.just[id] === 'left';
	const cx = b.x + b.w / 2;
	let L = Math.max(m, safe.l);
	let R = g.vw - Math.max(m, safe.r);
	if (g.kind === 'landscape') {
		L = Math.max(L, g.area.x0 + m);
		R = Math.min(R, g.area.x1 - m);
	}
	/** a point of the readout that is its own whatever gives way: his left edge (inside the window), or his center */
	const at = left ? Math.max(b.x, L) + 1 : cx;
	const rects: Box[] = [];
	if (zones) {
		rects.push(zones.board, zones.strip);
		if (zones.logo) rects.push(zones.logo);
	}
	for (const o of ['menu', 'bonus', 'amt', 'bal', 'win'] as PieceId[]) if (o !== id) rects.push(g.box[o]);
	for (const r of rects) {
		if (Math.min(r.y + r.h, b.y + b.h) - Math.max(r.y, b.y) < 0.5 * g.u) continue;
		if (r.x + r.w <= at) L = Math.max(L, r.x + r.w + m);
		else if (r.x >= at) R = Math.min(R, r.x - m);
	}
	for (const o of ['play', 'auto', 'turbo'] as PieceId[]) {
		const s = shapeOf(o, g.box[o]);
		const dcx = (s[1][0] + s[3][0]) / 2;
		const dcy = (s[0][1] + s[2][1]) / 2;
		const v = s[1][0] - dcx;
		const dy = Math.max(0, b.y - dcy, dcy - (b.y + b.h));
		if (dy >= v) continue;
		const hw = v - dy;
		if (dcx + hw <= at) L = Math.max(L, dcx + hw + m);
		else if (dcx - hw >= at) R = Math.min(R, dcx - hw - m);
	}
	if (left) {
		const x0 = Math.max(b.x, L);
		return { x: x0, w: Math.max(0, Math.min(b.x + b.w, R) - x0) };
	}
	const half = Math.max(0, Math.min(b.w / 2, cx - L, R - cx));
	return { x: cx - half, w: 2 * half };
};

// ---- SKIP TO RESULT, upright (components/SkipButton.svelte through ui/hud/hudLayout.ts hudSkipRect) ----
// Corey on the live bar, 2026-11-22: "what doesn't work well is the Skip Buttom moved down, I'd move it to the left of
// the Menu Button on Portrait". So upright it stands on Menu's row, to Menu's left: Menu's own top and height, the
// button's own width (the dock's 76 bar px), SKIP_PLACE.gap bar px clear of Menu's box (Menu's press region is its
// box). Sideways and on the desktop the button keeps the dock's places, which are clear of the sign bar.
export const SKIP_PLACE = { gap: 6, w: 76 } as const;
/** the button's box, CSS px, for an upright layout */
export const skipBox = (g: SignGeo): Box => {
	const m = g.box.menu;
	const right = m.x - SKIP_PLACE.gap * g.u;
	const x = Math.max(0, right - SKIP_PLACE.w * g.u);
	return { x, y: m.y, w: right - x, h: m.h };
};

/** the Win box's glass round its readout, CSS px, and its corner radius (a pill on the desktop, 4 bar px on a phone) */
export const winGlass = (g: SignGeo): Box & { r: number } => {
	const b = g.box.win;
	const pad = WIN_PAD * Math.min(2, g.rs.win) * g.u;
	const box = { x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad };
	return { ...box, r: g.winShape === 'pill' ? box.h / 2 : 4 * g.u };
};

/** every problem a layout has, by real shape: a piece on the board, the strip or the logo, off the window, a symbol's
 *  press box on the Play, a press region under 44 CSS px (the probes and the node test read this). BALANCE and the
 *  amount are tested by what they draw, not by their layout boxes (a box is wider than its text): `drawn` gives their
 *  drawn rectangles (the page measures them: ui/sign/SignHud.svelte), and without it they are left out. */
export const signProblems = (g: SignGeo, zones: Zones | null, seat: Seat | null, opts: { win?: boolean; drawn?: Partial<Record<'amt' | 'bal', Box>> } = {}): string[] => {
	const out: string[] = [];
	const ids = PIECES.filter((id) => id !== 'win' || opts.win !== false);
	for (const id of ids) {
		const b = id === 'win' ? winGlass(g) : id === 'amt' || id === 'bal' ? opts.drawn?.[id] : g.box[id];
		if (!b) continue;
		const s = shapeOf(id, b);
		if (zones) {
			if (onZone(s, zones.board)) out.push(`${id} on the board`);
			if (onZone(s, zones.strip)) out.push(`${id} on the LED strip`);
			if (zones.logo && onZone(s, zones.logo)) out.push(`${id} on the logo`);
		}
		if (s.some((p) => p[0] < -2 || p[1] < -2 || p[0] > g.vw + 2 || p[1] > g.vh + 2)) out.push(`${id} off the window`);
	}
	const press: Partial<Record<PressId, Box>> = { play: g.box.play, auto: g.box.auto, turbo: g.box.turbo, menu: g.box.menu, bonus: g.box.bonus };
	if (seat) {
		press.down = seat.down;
		press.up = seat.up;
		const play = shapeOf('play', g.box.play);
		if (shapeGap(boxPts(seat.down), play) === 0) out.push('< press box on the Play');
		if (shapeGap(boxPts(seat.up), play) === 0) out.push('> press box on the Play');
		for (const [n, q] of [['<', seat.down], ['>', seat.up]] as const) if (q.x < -0.05 || q.y < -0.05 || q.x + q.w > g.vw + 0.05 || q.y + q.h > g.vh + 0.05) out.push(`${n} press box off the window`);
	}
	for (const [id, d] of Object.entries(pressRegions(press))) if ((d as number) < TOUCH_MIN - 0.05) out.push(`${id} press region ${r1(d as number)}`);
	return out;
};
