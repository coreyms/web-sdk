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

/** THE GAME BAR IN USE: 'sign' (this bar) or 'dock' (the glass dock, ui/hud/, kept whole for a rollback and an A/B).
 *  One constant; ui/hudTheme.ts documents it and passes it on. It lives here because this file loads anywhere (no
 *  page, no state): the canvas's layout files read it without loading the theme. */
export const HUD_BAR: 'sign' | 'dock' = 'sign';

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
type Four = [number, number, number, number];
/** a window of his: each piece's box. ROUND 3 (2026-11-23) adds, per window: the gap between a symbol's press box and the
 *  amount (bar px), the amount group as he left it (symbol to symbol, CSS px), SKIP's box, and the scene: how far he
 *  moved the board with its LED strip and the tree line (CSS px down), whether a tree line is drawn, the logo's box */
type Ref = { vw: number; vh: number; step: number; p: Record<PieceId, Four>; just: Record<'amt' | 'bal' | 'win', Just>; gap?: number; group?: Four; skip?: Four; scene?: { boardDy: number; treeDy: number; tree: boolean; logo: Four } };
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
// ---- HIS PHONE WINDOWS, ROUND 3 (corey_phone_r3_2026-11-23.json; Corey laid these out himself in a drag mock at the
// REAL sizes a phone browser gives the game, and a picked mock is his word to build): 440 x 742 (his phone upright,
// Stake full screen, measured), 413 x 586 (Stake's framed page, measured), 375 x 530 (a small iPhone upright), 626 x 816
// (a phablet upright, estimated); 832 x 376 (his phone sideways, measured) and 667 x 311 (a small iPhone sideways); and
// 890 x 552 (the phablet sideways, estimated), which the game lays out with the DESKTOP bar (LAND_R3 below).
// Every box is his own as exported, CSS px of that window: Balance and the amount are already the size he wants (no
// BOOST on these). `p.amt` is the amount's box written so that the bar's own arithmetic gives his numbers back: its
// center and height are his, its width is 124 / 21 of his number's size (READOUT_BASE over READOUT_TYPE), `step` his
// symbol's height and `gap` his gap (bar px), `group` the whole group symbol to symbol as he left it. ----
export const PHONE_R3: Record<'portrait' | 'phone', Ref[]> = {
	portrait: [
		{ vw: 440, vh: 742, step: 19.9, just: UP, p: { play: [142.4, 567.7, 170, 170], auto: [291, 575.2, 68.8, 68.8], turbo: [357.8, 572.9, 68.8, 68.8], menu: [310.8, 32.5, 105.3, 49.5], bonus: [305.6, 89.2, 115.4, 77.9], amt: [304.35, 690.8, 104.51, 39.7], bal: [19.8, 687.1, 206, 44.3], win: [24.7, 588.1, 140.9, 26.9] }, gap: 3.972, group: [273.1, 688.7, 166.9, 44], skip: [218.3, 32.5, 85.7, 49.5], scene: { boardDy: -14.5, treeDy: -23.7, tree: true, logo: [7.3, 47.1, 141.5, 148.6] } },
		{ vw: 413, vh: 586, step: 19.8, just: UP, p: { play: [142.9, 449.8, 136.2, 136.2], auto: [263.4, 453.3, 60, 60], turbo: [327.6, 452.5, 60, 60], menu: [298.9, 26.8, 100.8, 47.7], bonus: [300.7, 78.2, 96.7, 65.2], amt: [288.35, 542.6, 92.7, 33.1], bal: [23.1, 535.8, 183, 39.3], win: [23.5, 457.2, 108, 20.6] }, gap: 3.6056, group: [256.4, 537.1, 156.6, 44], skip: [211.2, 29.5, 71.8, 42.5], scene: { boardDy: 0, treeDy: 0, tree: true, logo: [10.6, 24.7, 132.8, 139.4] } },
		{ vw: 375, vh: 530, step: 22, just: UP, p: { play: [126.8, 403.7, 121.3, 121.3], auto: [246.7, 413.6, 55.7, 55.7], turbo: [299, 412.4, 57, 57], menu: [270.1, 19.8, 95, 45], bonus: [273.2, 67.3, 87.5, 59], amt: [263.07, 487.1, 77.35, 33.2], bal: [24, 483.9, 171.3, 36.8], win: [26, 415.8, 116, 22.2] }, gap: 4, group: [228.5, 481.7, 146.5, 44], skip: [195, 22.6, 65, 38.5], scene: { boardDy: 0, treeDy: 0, tree: true, logo: [9.6, 20.8, 120.6, 126.6] } },
		{ vw: 626, vh: 816, step: 21, just: UP, p: { play: [237.5, 646.7, 151, 151], auto: [438.9, 657.7, 67.5, 67.5], turbo: [510.1, 658.2, 63.9, 63.9], menu: [473.5, 38.4, 121.7, 57], bonus: [466.5, 102.8, 134.7, 90.8], amt: [432.12, 737.2, 151.16, 48.9], bal: [33.6, 738.2, 224, 48.2], win: [37.3, 661.4, 153.3, 29.3] }, gap: 5.2788, group: [405.4, 737.2, 204.6, 48.9], skip: [365.5, 38.4, 100, 57], scene: { boardDy: 0, treeDy: 0, tree: true, logo: [5.2, 23.1, 193.4, 203] } },
	],
	phone: [
		{ vw: 832, vh: 376, step: 26, just: SIDE, p: { play: [654.4, 155.7, 151.4, 151.4], auto: [712.5, 99.2, 57.9, 57.9], turbo: [749.3, 134.2, 57.9, 57.9], menu: [43.8, 154.3, 95, 45], bonus: [48.1, 203.9, 83, 56], amt: [692.96, 315.3, 87.98, 28.3], bal: [18.4, 267.3, 144.5, 31.1], win: [26.4, 311.8, 132, 25.2] }, gap: 4, group: [659.7, 307.5, 154.4, 44], skip: [703.4, 27.4, 94.5, 28.9], scene: { boardDy: 0, treeDy: 0, tree: false, logo: [31.9, 8.7, 123.4, 129.6] } },
		{ vw: 667, vh: 311, step: 32.4, just: SIDE, p: { play: [532.7, 116.6, 126.5, 126.5], auto: [575.4, 65, 48.3, 48.3], turbo: [604.1, 91.9, 48.3, 48.3], menu: [26.1, 127.2, 93, 44], bonus: [35.6, 175.8, 70.4, 47.5], amt: [556.61, 258.7, 62.59, 26.8], bal: [0, 232.4, 140.8, 30.3], win: [15.6, 273.2, 120, 22.9] }, gap: 4.992, group: [518, 250.1, 139.8, 44], skip: [565, 19.5, 92.8, 28.4], scene: { boardDy: 0, treeDy: 0, tree: false, logo: [22.5, 16, 102.1, 107.2] } },
	],
};
/** HIS PHABLET SIDEWAYS, 890 x 552 (round 3, estimated): the game's layout class there is the desktop's (the short side is
 *  over a phone's 480), so this window stands beside the desktop rule, not among the phone windows (landLayout below) */
export const LAND_R3: Ref = { vw: 890, vh: 552, step: 51.1, just: { amt: 'center', bal: 'left', win: 'center' }, p: { play: [741.7, 247.9, 148.3, 148.3], auto: [792.4, 182.2, 60.3, 60.3], turbo: [828.2, 214.2, 61.8, 61.8], menu: [4, 320.6, 98.9, 46.4], bonus: [6.5, 379, 100.7, 68], amt: [759.5, 477.2, 93.3, 37.6], bal: [14.3, 486.5, 155.2, 33.4], win: [383.8, 493.2, 122.4, 23.4] }, gap: 4.868, group: [728, 473.2, 156.4, 45.7], skip: [786, 26.7, 91.9, 36.8], scene: { boardDy: -12.1, treeDy: 0, tree: false, logo: [5.3, 20.9, 148.6, 156] } };
/** round 2's places with BOOST (what the bar was laid out from until round 3): his record, read by the node test */
export const PHONE_R2: Record<'portrait' | 'phone', Ref[]> = { portrait: PHONE_REFS.portrait.map((r) => boostRef('portrait', r)), phone: PHONE_REFS.phone.map((r) => boostRef('phone', r)) };
// ---- the scale (above the places: the lift below reads it as the file loads) ----
/** CSS px per bar px. Desktop: the game's own fit (the 1280 x 720 master) over DESKTOP.k. Upright: the window's width
 *  over 390, held by its height on a window squatter than his shortest (390 x 620). Sideways: the phone master's fit
 *  (1480 x 740) over 0.527027 (the master drawn 390 high), as the glass dock scaled. */
export const signScale = (kind: SignKind, vw: number, vh: number) =>
	kind === 'portrait' ? Math.min(vw / 390, vh / 620) : kind === 'phone' ? Math.min(vw / 1480, vh / 740) / 0.527027 : Math.min(vw / 1280, vh / 720) / DESKTOP.k;

/** THE HOME INDICATOR'S STRIP on a sideways touch phone, CSS px up from the bottom edge: nothing a player presses or
 *  reads stands in it (measured on Corey's phone: the game runs to the bottom edge and the indicator lies over it) */
export const HOME_STRIP = 20;
/** "NUDGE THEM UP" (Corey 2026-11-24, on his own 667 x 311 placing: the bet symbols' 44 px press boxes reached 3.1 px
 *  into the strip and the Win box's glass 9.5 px). How far a sideways window's amount group (its symbols' press boxes
 *  with it) and its Win box rise, TOGETHER, so the lowest of them clears the strip: the least that does, CSS px, worked
 *  out AT EACH WINDOW from its own boxes (9.5 px at his 667 x 311; nothing at his 832 x 376, at 568 x 320 or at any
 *  window whose places already clear it). Their x, their sizes and their places against each other are his.
 *  BALANCE stands over the Win box and under the Fast Lane sign. It rises with the Win box by the same amount where
 *  that leaves it at least as far under the Fast Lane as it is over the Win box's glass; where it does not (667 x 311:
 *  his column there is full, 9.1 px under the Fast Lane and 6.1 px over the glass, and the same 9.5 px would put its
 *  box 0.4 px into the Fast Lane's) it rises to the middle of what room is left between the two (6.2 px: 2.9 px each
 *  way). `bal`: Balance's own rise. `box`: the pieces' boxes, CSS px; `keyH`: a symbol's press box, CSS px; `floor`:
 *  the strip's top edge. */
export const homeLifts = (box: Record<PieceId, Box>, u: number, keyH: number, vh: number, floor: number): { d: number; bal: number } => {
	const w = box.win;
	const pad = WIN_PAD * Math.min(2, w.w / u / READOUT_BASE.win.w) * u;
	// (a press box is kept inside the window, seatAmount)
	const keys = Math.min(box.amt.y + box.amt.h / 2 + keyH / 2, vh);
	const d = Math.max(0, Math.max(w.y + w.h + pad, keys) - floor);
	if (d <= 0.005) return { d: 0, bal: 0 };
	const b = box.bal;
	const f = box.bonus;
	const above = b.y - (f.y + f.h);
	const below = w.y - pad - (b.y + b.h);
	// (Balance in the Fast Lane's column and over the Win box: else it simply keeps its place against the Win box)
	const column = b.x < f.x + f.w && b.x + b.w > f.x && below >= 0;
	return { d, bal: !column || above - d >= below ? d : Math.max(0, Math.min(d, (above - below + d) / 2)) };
};
/** THE PLACES THE BAR IS LAID OUT FROM: ROUND 3's, as they are. Round 2's windows (PHONE_REFS above, with BOOST) are
 *  kept as his record only: in round 3 he put Auto and Turbo beside the Spin and the amount under it, where round 2 had
 *  the amount over Auto and Turbo, so a window between a round 2 place and a round 3 place would have drawn the two
 *  rows through each other (tried: 335 x 563 put < on the Spin and Auto's and Turbo's press pads on each other). The
 *  sizes round 2 was set at (390 x 844, 844 x 390, Stake's 425 x 812, 375 x 667, 320 x 568) now take round 3's
 *  arrangement, from his nearest round 3 windows. (A sideways window's amount group, Win box and Balance then rise
 *  clear of the home indicator's strip where his places are in it: homeLifts, in phoneLayout. Upright, Auto and Turbo
 *  are leveled: levelKeys below.) */
/** AUTO AND TURBO LEVEL, UPRIGHT (Corey 2026-11-24, on his own export: "I wanted the Turbo and Auto Modes to be at the
 *  same height on the page for portait modes, if they were off that's my fault"). His export has the two a little off
 *  (440 x 742: y 575.2 and 572.9; 375 x 530: 55.7 and 57 px; 626 x 816: 67.5 and 63.9 px). At every upright window of
 *  his the two keys stand with their centers on one line, the mean of his two, at one size, the larger of his two;
 *  each keeps its own center's x. Sideways they stay stacked as he placed them. */
export const levelKeys = (r: Ref): Ref => {
	const a = r.p.auto;
	const t = r.p.turbo;
	const d = Math.max(a[2], t[2]);
	const cy = (a[1] + a[3] / 2 + t[1] + t[3] / 2) / 2;
	const at = (q: Four): Four => [q[0] + q[2] / 2 - d / 2, cy - d / 2, d, d];
	return { ...r, p: { ...r.p, auto: at(a), turbo: at(t) } };
};
export const PHONE_PLACES: Record<'portrait' | 'phone', Ref[]> = { portrait: PHONE_R3.portrait.map(levelKeys), phone: PHONE_R3.phone };
/** the triangles his windows make in the (short side, long over short) plane, by index into PHONE_PLACES, and the
 *  lone edges (two windows only: sideways). Upright: 375x530, 413x586, 440x742 | 413x586, 626x816, 440x742. Sideways: the
 *  line from 832x376 to 667x311. A window outside them takes the nearest point of their outline. */
export const TRI: Record<'portrait' | 'phone', [number, number, number][]> = {
	portrait: [[2, 1, 0], [1, 3, 0]],
	phone: [],
};
export const SEG: Record<'portrait' | 'phone', [number, number][]> = { portrait: [], phone: [[0, 1]] };

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
 *   Auto, Turbo     their drawn diamond, grown by a 44 px round press pad that lies under every drawn control
 *                   (ui/sign/SignHud.svelte), as far as that circle stays clear of every other press region. The pad
 *                   stands on the key's center, or where `pads` says (padPlaces below: where the two keys stand
 *                   closer than 44 px the pads stand apart)
 *   Fast Lane       the circle inside its hexagon (the button is its box); Menu and the bet symbols: their boxes */
export const pressRegions = (boxes: Partial<Record<PressId, Box>>, pads: Partial<Record<'auto' | 'turbo', Pt>> = {}): Partial<Record<PressId, number>> => {
	const ids = (Object.keys(boxes) as PressId[]).filter((id) => boxes[id]);
	const sh = Object.fromEntries(ids.map((id) => [id, shapeOf(id, boxes[id] as Box)])) as Record<PressId, Pt[]>;
	const ctr = (id: PressId): Pt => [(boxes[id] as Box).x + (boxes[id] as Box).w / 2, (boxes[id] as Box).y + (boxes[id] as Box).h / 2];
	const pad = (id: PressId): Pt => (id === 'auto' || id === 'turbo' ? pads[id] : undefined) ?? ctr(id);
	const out: Partial<Record<PressId, number>> = {};
	for (const id of ids) {
		const b = boxes[id] as Box;
		if (id === 'play' || id === 'bonus') out[id] = inCircle(ctr(id), sh[id]);
		else if (id === 'auto' || id === 'turbo') {
			const ins = inCircle(ctr(id), sh[id]);
			let d = ins;
			if (ins < TOUCH_MIN) {
				d = TOUCH_MIN;
				const c = pad(id);
				for (const o of ids) {
					if (o === id) continue;
					// (the other key of the two: its pad, up to the middle line where the two share ground, and its drawn
					// diamond, which lies over this pad)
					const lim = o === 'auto' || o === 'turbo' ? Math.min(Math.hypot(c[0] - pad(o)[0], c[1] - pad(o)[1]), 2 * distToPoly(c, sh[o])) : 2 * distToPoly(c, sh[o]);
					d = Math.min(d, lim);
				}
				d = Math.max(d, ins);
			}
			out[id] = d;
		} else out[id] = Math.min(b.w, b.h);
	}
	return out;
};

/** THE PRESS PADS OF AUTO AND TURBO (2026-11-23; house rule: a touch area is 44 CSS px at least). At Corey's own
 *  568 x 320 window the two keys' centers stand 37 px apart (43.4 at 667 x 375), so two 44 px pads on the keys' centers
 *  shared a strip and each key held a 37 px circle. The drawn keys stay where he put them; only the unseen pads move:
 *  each as little as it takes to stand `gap` clear of the other pad, of the other key's diamond, of the Play's diamond
 *  (Corey: nothing touches the Spin's press region), of the bet symbols' press boxes, of Menu and the Fast Lane, and
 *  inside the window. Where the pads on the keys' centers already stand that clear nothing moves (six of his nine phone
 *  windows; 568 x 320 moves them 4.5 and 5.7 px, 667 x 375 1.3 px, 320 x 568 0.8 px).
 *  Where no such places exist within `reach` of the keys (the 400 x 225 mini player, a mouse window) the pads stay on
 *  the keys' centers, and their shared ground is split down the middle line (padShapes below). Centers, CSS px.
 *  `gap` is 2 CSS px (2026-11-23, the probe host at 667 x 375: with the pads 0.5 px apart a point 21 px from Auto's
 *  pad's middle, 23.5 px from Turbo's, landed on Turbo's pad. A browser tests a press as the whole CSS px it falls in
 *  against an element's box snapped to whole px of its own plane, so a round HTML pad takes presses up to about 1.5 px
 *  past its edge. The pads are exact shapes now, ui/sign/SignHud.svelte, and stand 2 px from every other press region.) */
export const PAD = { gap: 2, reach: 11, rounds: 200, sides: 64 };
export const padPlaces = (boxes: Partial<Record<PressId, Box>>, vw: number, vh: number): Partial<Record<'auto' | 'turbo', Pt>> => {
	const R = TOUCH_MIN / 2;
	const keys = (['auto', 'turbo'] as const).filter((k) => boxes[k]);
	const ids = (Object.keys(boxes) as PressId[]).filter((id) => boxes[id]);
	const sh = Object.fromEntries(ids.map((id) => [id, shapeOf(id, boxes[id] as Box)])) as Record<PressId, Pt[]>;
	const home = Object.fromEntries(keys.map((k) => [k, [(boxes[k] as Box).x + (boxes[k] as Box).w / 2, (boxes[k] as Box).y + (boxes[k] as Box).h / 2] as Pt])) as Record<'auto' | 'turbo', Pt>;
	/** the nearest point of a shape's outline, and how far outside it p is (negative: inside) */
	const near = (p: Pt, poly: Pt[]) => {
		let q: Pt = poly[0];
		let m = Infinity;
		for (let i = 0; i < poly.length; i++) {
			const a = poly[i];
			const b = poly[(i + 1) % poly.length];
			const dx = b[0] - a[0];
			const dy = b[1] - a[1];
			const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
			const n: Pt = [a[0] + dx * t, a[1] + dy * t];
			const d = Math.hypot(p[0] - n[0], p[1] - n[1]);
			if (d < m) {
				m = d;
				q = n;
			}
		}
		return { q, d: inPoly(p, poly) ? -m : m };
	};
	/** the most any pad is short of standing `gap` clear of every other press region and inside the window (0 or less:
	 *  every pad holds its whole 44 px circle with the gap round it) */
	const short = (c: Record<'auto' | 'turbo', Pt>) => {
		let w = -Infinity;
		for (const k of keys) {
			for (const o of ids) if (o !== k) w = Math.max(w, R + PAD.gap - near(c[k], sh[o]).d);
			w = Math.max(w, R - c[k][0], R - c[k][1], c[k][0] - (vw - R), c[k][1] - (vh - R));
		}
		if (keys.length === 2) w = Math.max(w, R + PAD.gap / 2 - Math.hypot(c.auto[0] - c.turbo[0], c.auto[1] - c.turbo[1]) / 2);
		return w;
	};
	if (!keys.length || short(home) <= 0.001) return home;
	const c = Object.fromEntries(keys.map((k) => [k, [home[k][0], home[k][1]] as Pt])) as Record<'auto' | 'turbo', Pt>;
	for (let it = 0; it < PAD.rounds && short(c) > 0.001; it++) {
		for (const k of keys)
			for (const o of ids) {
				if (o === k) continue;
				const n = near(c[k], sh[o]);
				if (n.d >= R + PAD.gap) continue;
				// out along the line from the outline's nearest point (through it, from inside)
				const sx = (c[k][0] - n.q[0]) * (n.d < 0 ? -1 : 1);
				const sy = (c[k][1] - n.q[1]) * (n.d < 0 ? -1 : 1);
				const len = Math.hypot(sx, sy) || 1;
				c[k][0] += (sx / len) * (R + PAD.gap - n.d);
				c[k][1] += (sy / len) * (R + PAD.gap - n.d);
			}
		if (keys.length === 2) {
			const dx = c.turbo[0] - c.auto[0];
			const dy = c.turbo[1] - c.auto[1];
			const d = Math.hypot(dx, dy) || 1;
			if (d < 2 * R + PAD.gap) {
				const push = (2 * R + PAD.gap - d) / 2;
				c.auto[0] -= (dx / d) * push;
				c.auto[1] -= (dy / d) * push;
				c.turbo[0] += (dx / d) * push;
				c.turbo[1] += (dy / d) * push;
			}
		}
		for (const k of keys) {
			c[k][0] = Math.max(R, Math.min(vw - R, c[k][0]));
			c[k][1] = Math.max(R, Math.min(vh - R, c[k][1]));
		}
	}
	const moved = Math.max(...keys.map((k) => Math.hypot(c[k][0] - home[k][0], c[k][1] - home[k][1])));
	return short(c) <= 0.01 && moved <= PAD.reach ? c : home;
};

/** a 44 px press circle on `c` as a shape (PAD.sides corners on the circle), CSS px */
export const padCircle = (c: Pt): Pt[] => Array.from({ length: PAD.sides }, (_, i): Pt => [c[0] + (TOUCH_MIN / 2) * Math.cos((2 * Math.PI * i) / PAD.sides), c[1] + (TOUCH_MIN / 2) * Math.sin((2 * Math.PI * i) / PAD.sides)]);
/** THE PADS' REAL SHAPES (2026-11-23): what takes Auto's and Turbo's presses beside their drawn diamonds. Each is its
 *  44 px circle at padPlaces' center. Where the two circles would stand closer than `gap` (no clear places exist: the
 *  pads are on the keys' centers) the shared ground is SPLIT DOWN THE MIDDLE LINE between the two centers: each circle
 *  is cut `gap / 2` short of that line, so neither pad ever covers the other and a press on Auto's side is never
 *  Turbo's. `split` says so. The page draws these shapes as they are (exact outlines, not rounded boxes). */
export type PadShape = { c: Pt; poly: Pt[]; split: boolean };
export const padShapes = (boxes: Partial<Record<PressId, Box>>, vw: number, vh: number): Partial<Record<'auto' | 'turbo', PadShape>> => {
	const at = padPlaces(boxes, vw, vh);
	const out: Partial<Record<'auto' | 'turbo', PadShape>> = {};
	for (const k of ['auto', 'turbo'] as const) {
		const c = at[k];
		if (!c) continue;
		let poly = padCircle(c);
		let split = false;
		const o = at[k === 'auto' ? 'turbo' : 'auto'];
		if (o) {
			const d = Math.hypot(o[0] - c[0], o[1] - c[1]);
			if (d > 0 && d < TOUCH_MIN + PAD.gap - 0.01) {
				// keep the side of the middle line this pad's center is on, set back half the gap
				const nx = (o[0] - c[0]) / d;
				const ny = (o[1] - c[1]) / d;
				const lim = d / 2 - PAD.gap / 2;
				const h = (p: Pt) => (p[0] - c[0]) * nx + (p[1] - c[1]) * ny - lim;
				const cut: Pt[] = [];
				for (let i = 0; i < poly.length; i++) {
					const a = poly[i];
					const b = poly[(i + 1) % poly.length];
					const ha = h(a);
					const hb = h(b);
					if (ha <= 0) cut.push(a);
					if (ha <= 0 !== hb <= 0) cut.push([a[0] + ((b[0] - a[0]) * ha) / (ha - hb), a[1] + ((b[1] - a[1]) * ha) / (ha - hb)]);
				}
				poly = cut;
				split = true;
			}
		}
		out[k] = { c, poly, split };
	}
	return out;
};

/** WHOSE PRESS IS IT (2026-11-23). The rule (Corey's, through the probe host): a press is the control's whose drawing
 *  or pad the place is in; where two drawn controls overlap, the one drawn on top at that place; anywhere else it is
 *  nobody's. A ROUND STARTS ONLY FROM A PRESS THAT WENT DOWN INSIDE THE PLAY'S OWN DIAMOND (an accidental play, Corey:
 *  "like stealing in my eyes").
 *  WHAT IS DRAWN: the Play, Auto and Turbo are diamonds (their box's width corner to corner, shapeOf), not their
 *  boxes. The BOXES overlap: at 844 x 390 Auto's and Turbo's by about 22 x 24 px, and the Play's 157 px box covers
 *  half of Turbo's ground and both arrows' corners. The diamonds do not, at any window swept.
 *  WHY THE PAGE DECIDES THIS ITSELF: a browser gives a TOUCH to a nearby button by the buttons' upright boxes and
 *  their paint order, not by what is drawn, and reports the click at a place inside the button it chose. The probe
 *  host at 844 x 390 and 667 x 375: a tap 2 px inside Turbo's edge nearest the Play started a round and left Turbo as it
 *  was (the Play is drawn after Turbo, and its box holds the whole touch); a tap in the bare ground between Auto's
 *  and Turbo's diamonds turned Turbo on. A mouse at the same places did the right thing. So the bar keeps the place
 *  the finger or the pointer went DOWN and asks this rule whose press it is (SignHud.svelte barPress).
 *  ORDER: the drawn shapes first, the one drawn last first (ui/sign/SignHud.svelte: the bet symbols and the amount,
 *  the Play, Turbo, Auto, Menu, the Fast Lane), then the pads (unseen, under every control).
 *  THE SHAPES ARE THE REAL ONES (pressShape below: the turned squares with their round corners, as the buttons are),
 *  and there is NO SLACK (2026-11-23, the probe host: with sharp diamonds and 1.5 px of slack this rule gave a key
 *  ground that no element covered: the Play's sharp top corner on the desktop, 7 px past its round one; Auto's bottom
 *  corner at 568 x 320; so a press there was named a key's and nothing took it). What this rule names a control's
 *  ground is drawn as that control's own catch outline under every control (SignHud.svelte), so wherever a place is a
 *  control's, something takes the press. Only boxes that are on the screen are passed in. */
export const PRESS_SLACK = 0;
export type OwnerId = PressId | 'amt';
export const OWNER_ORDER: OwnerId[] = ['up', 'amt', 'down', 'play', 'turbo', 'auto', 'menu', 'bonus'];
/** THE REAL PRESS SHAPES' NUMBERS: the Play's diamond in its 240 unit view (half its corner to corner width and its
 *  corner radius: ui/hudTheme.ts SIGN.play V and R); a key's frame in the 80 unit key its box is KEY_BOX of (SIGN.key
 *  bw, ko, margin, corner); Menu's corner as a share of its height (ui/sign/sign.css .sgm: 0.14 of --s, --s its
 *  height over 0.8). tools/sign_layout_test.mjs holds these to the theme's and the stylesheet's own numbers. */
export const PLAY_LINE = { V: 113.6, R: 20.45 };
export const KEY_LINE = { bw: 4.4, ko: 1.3, margin: 2.2, corner: 0.09 };
export const MENU_CORNER = 0.14 / 0.8;
/** the Play's press square: its side and corner radius for a box `d` wide (the button is this square, turned 45 degrees) */
export const playHit = (d: number) => ({ side: (PLAY_LINE.V * Math.SQRT2 * d) / 240, r: (PLAY_LINE.R * d) / 240 });
/** a key's press square (Auto, Turbo): the keyline's outer edge, its side and corner radius for a box `w` wide */
export const keyHit = (w: number) => {
	const k = w / KEY_BOX / 80;
	const out = (KEY_LINE.bw / 2 + KEY_LINE.ko) * k;
	const W = w - 2 * (KEY_LINE.margin * k + out);
	return { side: W / Math.SQRT2 + 2 * out, r: W * KEY_LINE.corner + out };
};
/** a convex shape with every corner rounded to radius r (each corner an arc of `n` steps) */
const roundCorners = (pts: Pt[], r: number, n = 6): Pt[] => {
	if (r <= 0) return pts;
	const out: Pt[] = [];
	for (let i = 0; i < pts.length; i++) {
		const v = pts[i];
		const p = pts[(i + pts.length - 1) % pts.length];
		const q = pts[(i + 1) % pts.length];
		const a: Pt = [p[0] - v[0], p[1] - v[1]];
		const b: Pt = [q[0] - v[0], q[1] - v[1]];
		const la = Math.hypot(a[0], a[1]);
		const lb = Math.hypot(b[0], b[1]);
		const ua: Pt = [a[0] / la, a[1] / la];
		const ub: Pt = [b[0] / lb, b[1] / lb];
		const half = Math.acos(Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1]))) / 2;
		const t = Math.min(r / Math.tan(half), la / 2, lb / 2);
		const rr = t * Math.tan(half);
		const bis: Pt = [ua[0] + ub[0], ua[1] + ub[1]];
		const lbis = Math.hypot(bis[0], bis[1]) || 1;
		const c: Pt = [v[0] + (bis[0] / lbis) * (rr / Math.sin(half)), v[1] + (bis[1] / lbis) * (rr / Math.sin(half))];
		const a0 = Math.atan2(v[1] + ua[1] * t - c[1], v[0] + ua[0] * t - c[0]);
		let a1 = Math.atan2(v[1] + ub[1] * t - c[1], v[0] + ub[0] * t - c[0]);
		// the short way round
		while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
		while (a1 - a0 < -Math.PI) a1 += 2 * Math.PI;
		for (let k = 0; k <= n; k++) out.push([c[0] + rr * Math.cos(a0 + ((a1 - a0) * k) / n), c[1] + rr * Math.sin(a0 + ((a1 - a0) * k) / n)]);
	}
	return out;
};
/** A CONTROL'S REAL PRESS SHAPE, CSS px: what its element takes presses as. The Play, Auto and Turbo: the turned
 *  square with its round corners (the drawn diamond ends at the round corner, not at the square's sharp one); Menu:
 *  its box with its round corners; the Fast Lane: its hexagon; a bet symbol and the amount: the box. */
const shapeMemo = new WeakMap<Box, Partial<Record<OwnerId, Pt[]>>>();
export const pressShape = (id: OwnerId, b: Box): Pt[] => {
	// (kept per box: a layout's boxes are the same objects from press to press)
	const memo = shapeMemo.get(b) ?? {};
	if (!shapeMemo.has(b)) shapeMemo.set(b, memo);
	if (memo[id]) return memo[id] as Pt[];
	const cx = b.x + b.w / 2;
	const cy = b.y + b.h / 2;
	let out: Pt[];
	if (id === 'play' || id === 'auto' || id === 'turbo') {
		const h = id === 'play' ? playHit(b.w) : keyHit(b.w);
		const v = h.side / Math.SQRT2;
		out = roundCorners([[cx, cy - v], [cx + v, cy], [cx, cy + v], [cx - v, cy]], h.r);
	} else if (id === 'menu') out = roundCorners(boxPts(b), MENU_CORNER * b.h);
	else out = shapeOf(id, b);
	memo[id] = out;
	return out;
};
export const pressOwner = (boxes: Partial<Record<OwnerId, Box>>, pads: Partial<Record<'auto' | 'turbo' | 'bonus', { poly: Pt[] }>>, p: Pt): OwnerId | null => {
	for (const k of OWNER_ORDER) if (boxes[k] && inPoly(p, pressShape(k, boxes[k] as Box))) return k;
	for (const k of ['turbo', 'auto', 'bonus'] as const) if (boxes[k] && pads[k] && inPoly(p, (pads[k] as { poly: Pt[] }).poly)) return k;
	return null;
};

/** WHAT A CONTROL DOES WITH A CLICK IT GOT, by whose press the place is (`who`, pressOwner at the place the pointer
 *  went down): 'own' it acts; 'pass' the press is another control's, which takes it; 'none' nothing happens. The Play
 *  is never passed a press: a round starts only from a click the Play itself got for a place in its own diamond. */
export const pressVerdict = (got: OwnerId, who: OwnerId | null): 'own' | 'pass' | 'none' => (who === got ? 'own' : who === null || who === 'play' ? 'none' : 'pass');

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
	/** THE READOUTS' TYPE, bar px: each number's nominal size and each tag's letters (before the 10 CSS px floor). On
	 *  the desktop each follows its own box (READOUT_TYPE times rs). On his round 3 windows the three numbers are ONE
	 *  size and the three tags one size (Corey 2026-11-23: "The text sizes were different in the mock up for the
	 *  Balance, Spin amount, and WIN, Ideally those all stay about the same size"): commonType. */
	num: Record<'amt' | 'bal' | 'win', number>;
	head: Record<'amt' | 'bal' | 'win', number>;
	just: Record<'amt' | 'bal' | 'win', Just>;
	/** the bet symbol's height and the gap between a symbol's press box and the amount, bar px */
	step: number;
	gap: number;
	/** ROUND 3: half the amount group's width as he left it (symbol to symbol), bar px; 0 where no window of round 3
	 *  has a say. The seat never stands the group in less room than he gave it (seatAmount). */
	amtHalf: number;
	/** sideways: how far the amount group and the Win box (`d`) and Balance (`bal`) stand above his places so nothing of
	 *  them is in the home indicator's strip (homeLifts), CSS px; zeros where his places clear it */
	lift: { d: number; bal: number };
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

/** each readout's type by its own box (the desktop rule, and the mock's): the number and the tag, bar px */
const ownType = (rs: Record<'amt' | 'bal' | 'win', number>) => ({
	num: { amt: READOUT_TYPE.amt * rs.amt, bal: READOUT_TYPE.bal * rs.bal, win: READOUT_TYPE.win * rs.win },
	head: { amt: READOUT_TYPE.head * rs.amt, bal: READOUT_TYPE.head * rs.bal, win: READOUT_TYPE.head * rs.win },
});
/** the widest everyday amount between the symbols, em of the bar's face: "$100.00" (tools/sign_layout_test.mjs USD_EM
 *  4.198, from the face's own widths; a little air over it) */
export const AMOUNT_EM = 4.25;
/** ONE NUMBER SIZE AND ONE TAG SIZE FOR A ROUND 3 WINDOW (Corey 2026-11-23, above), CSS px at that window: the largest
 *  number all three of his boxes hold. A box holds the size its own rule gives it (READOUT_TYPE for a box READOUT_BASE
 *  wide: Balance 21 px in 186, Win 26 px in 220), and the amount also no more than the widest everyday amount takes
 *  between his two symbols (his group's width less the two press boxes and gaps, over AMOUNT_EM). The smallest of
 *  those is the size; the tags take the smallest tag the same way (on a phone every tag then stands at its 10 CSS px
 *  floor). His boxes and symbols stay where he put them. */
export const commonType = (kind: SignKind, r: Ref) => {
	const ru = signScale(kind, r.vw, r.vh);
	const key = stepBox(r.step, ru).w * ru;
	const between = r.group ? r.group[2] - 2 * (key + (r.gap ?? DESKTOP.gap) * ru) : Infinity;
	const own = { amt: (READOUT_TYPE.amt * r.p.amt[2]) / READOUT_BASE.amt.w, bal: (READOUT_TYPE.bal * r.p.bal[2]) / READOUT_BASE.bal.w, win: (READOUT_TYPE.win * r.p.win[2]) / READOUT_BASE.win.w };
	const num = Math.min(own.amt, between / AMOUNT_EM, own.bal, own.win);
	const head = READOUT_TYPE.head * Math.min(r.p.amt[2] / READOUT_BASE.amt.w, r.p.bal[2] / READOUT_BASE.bal.w, r.p.win[2] / READOUT_BASE.win.w);
	return { num, head, own, between };
};

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
		...ownType({ amt: D.p.amt[2] / READOUT_BASE.amt.w, bal: D.p.bal[2] / READOUT_BASE.bal.w, win: D.p.win[2] / READOUT_BASE.win.w }),
		just: { ...D.just },
		step: D.step,
		gap: D.gap,
		amtHalf: 0,
		lift: { d: 0, bal: 0 },
		winShape: 'pill',
		turboWord: turboWordOk(box.turbo),
		weights: [],
		moved: [],
		area: { x0, x1 },
	};
};

// ---- the blend between his phone windows ----
/** a window in the blend's plane. Inside his windows' triangles the weights do not depend on the two axes' units. Outside
 *  them the nearest point of the outline is taken, and there (round 3) the SHAPE counts first: the bar is laid out in bar
 *  px, which follow the window's size by themselves, so a narrow tall phone (320 x 568) belongs with his tall window
 *  (440 x 742), not with his small squat one (375 x 530), which is nearer in CSS px. One unit is 400 CSS px of the short
 *  side, or 0.5 of long over short. */
const param = (vw: number, vh: number): Pt => [Math.min(vw, vh) / 400, Math.max(vw, vh) / Math.min(vw, vh) / 0.5];
/** (the same plane in 100 CSS px of the short side: how far outside his windows a window is, for the scene's fall off) */
const paramOut = (vw: number, vh: number): Pt => [Math.min(vw, vh) / 100, Math.max(vw, vh) / Math.min(vw, vh) / 0.5];
/** the weights of his windows for a window: barycentric in the triangle that holds it, or at the nearest point of the
 *  triangles' outline */
export const blendWeights = (o: 'portrait' | 'phone', vw: number, vh: number): number[] => blendAt(o, vw, vh).w;
/** the weights, and how far outside the triangles the window is (1 = 100 CSS px of the short side, or 0.5 of long
 *  over short): 0 inside them */
export const blendAt = (o: 'portrait' | 'phone', vw: number, vh: number): { w: number[]; out: number } => {
	const refs = PHONE_PLACES[o];
	const P = refs.map((r) => param(r.vw, r.vh));
	const q = param(vw, vh);
	const best: { d: number; w: number[] } = { d: Infinity, w: refs.map((_, i) => (i === 0 ? 1 : 0)) };
	const edge = (m: number, n: number) => {
		const A = P[m];
		const B = P[n];
		const dx = B[0] - A[0];
		const dy = B[1] - A[1];
		const t = Math.max(0, Math.min(1, ((q[0] - A[0]) * dx + (q[1] - A[1]) * dy) / (dx * dx + dy * dy)));
		const d = Math.hypot(q[0] - A[0] - dx * t, q[1] - A[1] - dy * t);
		if (d < best.d - 1e-12) {
			const ww = refs.map(() => 0);
			ww[m] = 1 - t;
			ww[n] = t;
			best.d = d;
			best.w = ww;
		}
	};
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
			return { w, out: 0 };
		}
		for (const [m, n] of [[i, j], [j, k], [k, i]]) edge(m, n);
	}
	for (const [m, n] of SEG[o]) edge(m, n);
	const B = best;
	// how far outside, in 100 CSS px of the short side and 0.5 of long over short: from the window to the place it took
	const o0 = paramOut(vw, vh);
	let px = 0;
	let py = 0;
	refs.forEach((r, i) => {
		const a = paramOut(r.vw, r.vh);
		px += B.w[i] * a[0];
		py += B.w[i] * a[1];
	});
	return { w: B.w, out: Math.hypot(o0[0] - px, o0[1] - py) };
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
/** THE TOP LINE's lower edge SIDEWAYS, CSS px (2026-11-25, the probe host on 0d6ce2aa: at 667 x 375 POLYMATH GAMES lay
 *  across SKIP TO RESULT's top). The top line (ui/ClockStrip.svelte: 10 master units under the master's top, 12 px type)
 *  stands in the phone master (1480 x 740, game/layoutSpec.ts MASTER.phone), fitted and centered, so on a window taller
 *  for its width than 2:1 it comes down with the letterbox (y 25 at 667 x 375, 5 at 832 x 376). Its lower edge is 28
 *  master units under the master's top, as upright: SKIP TO RESULT keeps its distance under it (sceneFit). */
export const PHONE_MASTER = { w: 1480, h: 740, topLine: 28 } as const;
export const phoneTopLine = (vw: number, vh: number) => {
	const fit = Math.min(vw / PHONE_MASTER.w, vh / PHONE_MASTER.h);
	return (vh - PHONE_MASTER.h * fit) / 2 + PHONE_MASTER.topLine * fit;
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
	let gap = 0;
	let amtHalf = 0;
	let num = 0;
	let head = 0;
	for (let i = 0; i < refs.length; i++) {
		if (!w[i]) continue;
		const ru = signScale(o, refs[i].vw, refs[i].vh);
		step += w[i] * refs[i].step;
		gap += w[i] * (refs[i].gap ?? DESKTOP.gap);
		amtHalf += (w[i] * (refs[i].group?.[2] ?? 0)) / 2 / ru;
		const T = commonType(o, refs[i]);
		num += (w[i] * T.num) / ru;
		head += (w[i] * T.head) / ru;
	}
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
	// THE TOUCH FLOOR (round 3: outside his windows the bar's scale can take Menu's height or the Fast Lane's hexagon a
	// px under 44 CSS px; 390 x 844 gave Menu 43.9): each grows about its own middle, its shape kept, to hold 44
	for (const [id, held] of [['menu', Math.min(box.menu.w, box.menu.h)], ['bonus', inCircle([box.bonus.x + box.bonus.w / 2, box.bonus.y + box.bonus.h / 2], shapeOf('bonus', box.bonus))]] as [PieceId, number][]) {
		if (held >= TOUCH_MIN - 0.005 || held <= 0) continue;
		const f = (TOUCH_MIN + 0.01) / held;
		const b = box[id];
		box[id] = { x: b.x + b.w / 2 - (b.w * f) / 2, y: b.y + b.h / 2 - (b.h * f) / 2, w: b.w * f, h: b.h * f };
	}
	if (o === 'portrait') {
		const bottom: PieceId[] = ['play', 'auto', 'turbo', 'amt', 'bal', 'win'];
		const top: PieceId[] = ['menu', 'bonus'];
		// the home indicator: the bottom pieces stand above it (round 3: the bet symbols' 44 px press boxes too, which
		// reach a little under his amount's box)
		let e = extent(box, bottom);
		const keyLow = () => box.amt.y + box.amt.h / 2 + (stepBox(step, u).h * u) / 2;
		const floor = v.vh - safe.b;
		if (safe.b > 0 && Math.max(e.y1, keyLow()) > floor + 0.01) {
			const low = Math.max(e.y1, keyLow());
			shift(box, bottom, 0, floor - low);
			moved.push(`bottom pieces ${r1(low - floor)} px up (safe area)`);
		}
		// the LED strip: the bottom pieces close up toward the bottom edge, sizes too, until the highest clears it
		if (Z) {
			e = extent(box, bottom);
			const sb = Z.strip.y + Z.strip.h;
			if (e.y0 < sb - ZONE_TOL && e.x1 > Z.strip.x && e.x0 < Z.strip.x + Z.strip.w) {
				const base = Math.max(extent(box, bottom).y1, safe.b > 0 ? keyLow() : -Infinity);
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
			// (the symbols' press boxes keep their 44 px while the pieces are drawn in: the amount rises by what they
			// would then reach into the home indicator's strip)
			if (safe.b > 0 && keyLow() > floor + 0.01) box.amt = { ...box.amt, y: box.amt.y - (keyLow() - floor) };
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
	// THE PLAY GIVES WAY TO THE BET SYMBOLS (round 3; Corey: the arrows never touch the Spin's press region). On a window
	// narrower or flatter than his, a symbol's 44 CSS px press box is larger against the bar than at his windows, and the
	// amount group at its least (both boxes, the gaps, the least reserved width), as far from the Play as the window
	// lets it go (upright: against the right edge), could still stand on the Play's diamond. There the Play is drawn in
	// from its top point (which stays where it is, clear of the LED strip), 2 % at a time, until the group stands
	// clear: its lower edges rise off the symbols' boxes. Nothing at his own windows.
	{
		const sb = stepBox(step, u);
		const keyW = sb.w * u;
		const keyH = sb.h * u;
		const Wm = AMOUNT_FIT.minW * u;
		const half = Wm / 2 + gap * u + keyW;
		const acx = o === 'portrait' ? v.vw - half : Math.max(half, Math.min(box.amt.x + box.amt.w / 2, v.vw - half));
		const acy = box.amt.y + box.amt.h / 2;
		const clearOf = AMOUNT_FIT.playClear * u;
		const ky = Math.max(0, Math.min(acy - keyH / 2, v.vh - keyH));
		const keys = [boxPts({ x: acx - half - clearOf, y: ky, w: keyW + clearOf, h: keyH }), boxPts({ x: acx + half - keyW, y: ky, w: keyW + clearOf, h: keyH })];
		const p0 = box.play;
		let f = 1;
		const top = p0.y + (p0.h * (1 - PLAY_V)) / 2;
		const at = (k: number): Box => ({ x: p0.x + p0.w / 2 - (p0.w * k) / 2, y: top - (p0.h * k * (1 - PLAY_V)) / 2, w: p0.w * k, h: p0.h * k });
		while (f > 0.6 && keys.some((q) => shapeGap(q, shapeOf('play', at(f))) === 0)) f -= 0.02;
		if (f < 1) {
			box.play = at(f);
			moved.push(`the Play drawn in to ${Math.round(f * 100)} % (the bet symbols' press boxes)`);
		}
	}
	// THE HOME INDICATOR'S STRIP (sideways; Corey 2026-11-24: "Nudge them up"; homeLifts above): the amount group and
	// the Win box rise together by the least that takes the bet symbols' press boxes and the Win box's glass out of
	// the bottom HOME_STRIP px (or the safe area's inset, where the browser reports more), Balance with them by its
	// own rule. Reported in `lift`, not in `moved`: it is his ruling for his own window, not a guard for a fault.
	let lift = { d: 0, bal: 0 };
	if (o === 'phone') {
		lift = homeLifts(box, u, stepBox(step, u).h * u, v.vh, v.vh - Math.max(HOME_STRIP, safe.b));
		if (lift.d > 0) {
			box.amt = { ...box.amt, y: box.amt.y - lift.d };
			box.win = { ...box.win, y: box.win.y - lift.d };
			box.bal = { ...box.bal, y: box.bal.y - lift.bal };
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
		num: { amt: num, bal: num, win: num },
		head: { amt: head, bal: head, win: head },
		just: { ...just },
		step,
		gap,
		amtHalf,
		lift,
		winShape: 'rect',
		turboWord: turboWordOk(box.turbo),
		weights: w,
		moved,
		area: { x0: 0, x1: v.vw },
	};
};

// ---- HIS PHABLET SIDEWAYS BESIDE THE DESKTOP RULE (round 3, 890 x 552) ----
/** how much of his 890 x 552 window a desktop class window takes, BY ITS WIDTH: all of it up to his window's 890 CSS px
 *  (a phablet held sideways is that wide whatever its browser's bars leave of the height: 890 x 512, 890 x 626), none
 *  from LAND_FROM (1024: the narrowest desktop size the bar was set at, and every size Stake reviews on a desktop is
 *  wider), a straight line between. */
export const LAND_FROM = 1024;
/** his Win box's glass under the LED strip at 890 x 552, bar px (488.7 less 483.3 CSS px, at 0.618 CSS px a bar px) */
const LAND_WIN_CLEAR = 8.7;
export const landShare = (vw: number, vh: number) => Math.max(0, Math.min(1, (LAND_FROM - vw) / (LAND_FROM - LAND_R3.vw)));
/** his 890 x 552 places at a window: each piece its distance from the nearer side and from the bottom edge, at the
 *  window's bar scale */
const landR3Box = (id: PieceId, vw: number, vh: number, u: number): Box => {
	const R = LAND_R3;
	const ru = signScale('landscape', R.vw, R.vh);
	const [x, y, w, h] = R.p[id];
	const cx = x + w / 2;
	const k = u / ru;
	const ncx = cx < R.vw * 0.4 ? cx * k : cx > R.vw * 0.6 ? vw - (R.vw - cx) * k : vw / 2 + (cx - R.vw / 2) * k;
	const ncy = vh - (R.vh - (y + h / 2)) * k;
	return { x: ncx - (w * k) / 2, y: ncy - (h * k) / 2, w: w * k, h: h * k };
};
/** the desktop class: his desktop rule, drawn toward his 890 x 552 window by landShare */
export const landLayout = (v: SignView): SignGeo => {
	const D = desktopLayout(v);
	const t = landShare(v.vw, v.vh);
	if (t <= 0) return D;
	const mix = (a: number, b: number) => a + (b - a) * t;
	const box = {} as Record<PieceId, Box>;
	for (const id of PIECES) {
		const b = landR3Box(id, v.vw, v.vh, D.u);
		box[id] = { x: mix(D.box[id].x, b.x), y: mix(D.box[id].y, b.y), w: mix(D.box[id].w, b.w), h: mix(D.box[id].h, b.h) };
	}
	// (the touch floor, as on the phones: a smaller phablet's Menu holds 44 CSS px, grown from its left edge and its middle line)
	if (Math.min(box.menu.w, box.menu.h) < TOUCH_MIN) {
		const f = (TOUCH_MIN + 0.01) / Math.min(box.menu.w, box.menu.h);
		box.menu = { x: box.menu.x, y: box.menu.y + box.menu.h / 2 - (box.menu.h * f) / 2, w: box.menu.w * f, h: box.menu.h * f };
	}
	const rs = { amt: box.amt.w / D.u / READOUT_BASE.amt.w, bal: box.bal.w / D.u / READOUT_BASE.bal.w, win: box.win.w / D.u / READOUT_BASE.win.w };
	// THE WIN BOX STAYS UNDER THE LED STRIP. He stood it close under the strip (5.4 CSS px at his window); it is placed
	// from the bottom edge, and on a shorter window of his width (890 x 512: the browser's bars showing) the strip
	// stands lower against that edge, so his place would be on it. There the box keeps his distance under the strip,
	// never lower than the desktop rule's own place for it.
	const moved: string[] = [];
	if (v.zones) {
		const pad = WIN_PAD * Math.min(2, rs.win) * D.u;
		const need = v.zones.strip.y + v.zones.strip.h + LAND_WIN_CLEAR * D.u + pad;
		if (box.win.y < need - 0.01) {
			const y = Math.max(box.win.y, Math.min(need, D.box.win.y));
			if (y > box.win.y + 0.01) moved.push(`the Win box ${r1(y - box.win.y)} px down (the LED strip)`);
			box.win = { ...box.win, y };
		}
	}
	// (the type: his one size at his window, each box's own on the desktop, between by the share)
	const ru = signScale('landscape', LAND_R3.vw, LAND_R3.vh);
	const T = commonType('landscape', LAND_R3);
	const own = ownType(rs);
	const type = (a: Record<'amt' | 'bal' | 'win', number>, b: number) => ({ amt: mix(a.amt, b), bal: mix(a.bal, b), win: mix(a.win, b) });
	return {
		...D,
		box,
		rs,
		num: type(own.num, T.num / ru),
		head: type(own.head, T.head / ru),
		amtHalf: (t * (LAND_R3.group?.[2] ?? 0)) / 2 / ru,
		moved,
		just: t >= 0.5 ? { ...LAND_R3.just } : D.just,
		step: mix(D.step, LAND_R3.step),
		gap: mix(D.gap, LAND_R3.gap ?? D.gap),
		turboWord: turboWordOk(box.turbo),
		weights: [t],
	};
};

/** the bar's layout for a window */
export const signLayout = (v: SignView): SignGeo => {
	return v.kind === 'landscape' ? landLayout(v) : phoneLayout(v);
};

// ---- THE SCENE AT HIS ROUND 3 WINDOWS (the board with its LED strip, the tree line, the logo; SKIP) ----
// He moved the board with its LED strip (one piece) and the tree line up and down, and placed the logo and SKIP, per
// window. The scene's own rules (game/layoutSpec.ts roadPlacement, logoBox; game/scene/sceneLayers.ts forestBox;
// ui/hud/hudLayout.ts hudSkipRect) still give every window its place; these are his changes to them, blended over his
// windows as the pieces are.
//   boardDy, treeDy  CSS px down, a share of the window's height at his window, so of the height here
//   logo, skip       his box as shares of the window (logo) or from the top right corner at the bar's scale (SKIP), and
//                    `share`: how much of it stands in for the rule's own box here: 1 at and between his windows, falling
//                    to 0 at SCENE_REACH outside them (in the blend's own units: 100 CSS px of the short side, or 0.5 of
//                    long over short), so a tall phone and a tablet keep the scene's own rules; his moves of the board
//                    and the tree line fall off the same way
//   skipShare        how much of his SKIP box stands in for the rule's: `share` upright and on the desktop; SIDEWAYS
//                    ALWAYS 1 (2026-11-25, the probe host on 930a7748: at 812 x 425, 667 x 375 and 568 x 320 the button
//                    stood on Auto. Off his sideways line his share fell off and the rule's own box took over, the glass
//                    dock's place under its Auto and Turbo capsule, which is where the sign bar's Auto stands. Sideways the
//                    bar's pieces are his at every window, by the blend, so SKIP is too: his box from the top right corner
//                    at the bar's scale, from his nearest windows. Unchanged at his own windows, where the share was 1.
//                    Its y is his distance under the top line's lower edge, phoneTopLine, as upright: at 667 x 375 and
//                    568 x 320 the letterboxed top line came down across his box's top.)
//   forest           a tree line is drawn (upright): the game's own phones, and since round 3 up to his phablet's width
export const SCENE_REACH = 1;
export const FOREST_MAX_SHORT = 640;
export type SceneFit = { boardDy: number; treeDy: number; share: number; logo: Box | null; skip: Box | null; skipShare: number };
const NO_FIT: SceneFit = { boardDy: 0, treeDy: 0, share: 0, logo: null, skip: null, skipShare: 0 };
const fitMemo = new Map<string, SceneFit>();
export const sceneFit = (kind: SignKind, vw: number, vh: number): SceneFit => {
	if (!(vw > 0 && vh > 0)) return NO_FIT;
	const key = `${kind}|${vw}|${vh}`;
	const hit = fitMemo.get(key);
	if (hit) return hit;
	let out: SceneFit = NO_FIT;
	const u = signScale(kind, vw, vh);
	const skipAt = (r: Ref, top: number, rtop: number): Box => {
		const ru = signScale(kind, r.vw, r.vh);
		const [x, y, w, h] = r.skip as Four;
		const k = u / ru;
		return { x: vw - (r.vw - x) * k, y: top + (y - rtop) * k, w: w * k, h: h * k };
	};
	if (kind === 'landscape') {
		const t = landShare(vw, vh);
		const S = LAND_R3.scene;
		if (t > 0 && S) out = { boardDy: (t * S.boardDy * vh) / LAND_R3.vh, treeDy: 0, share: t, logo: { x: (S.logo[0] / LAND_R3.vw) * vw, y: (S.logo[1] / LAND_R3.vh) * vh, w: (S.logo[2] / LAND_R3.vw) * vw, h: (S.logo[3] / LAND_R3.vw) * vw }, skip: skipAt(LAND_R3, 0, 0), skipShare: t };
	} else {
		const refs = PHONE_PLACES[kind];
		const { w, out: far } = blendAt(kind, vw, vh);
		const s3 = 1;
		const share = Math.max(0, Math.min(1, 1 - far / SCENE_REACH));
		// (sideways his SKIP box holds at every window: skipShare above)
		const skipShare = kind === 'phone' ? 1 : share;
		if (share > 0 || skipShare > 0) {
			let boardDy = 0;
			let treeDy = 0;
			const logo = { x: 0, y: 0, w: 0, h: 0 };
			const skip = { x: 0, y: 0, w: 0, h: 0 };
			// (his distance under the top line's lower edge, scaled: upright and, since 2026-11-25, sideways too)
			const line = kind === 'portrait' ? topLine : phoneTopLine;
			const top = line(vw, vh);
			for (let i = 0; i < refs.length; i++) {
				const r = refs[i];
				const S = r.scene;
				if (!w[i] || !S) continue;
				const f = w[i] / s3;
				boardDy += (w[i] * S.boardDy * vh) / r.vh;
				treeDy += (w[i] * S.treeDy * vh) / r.vh;
				logo.x += (f * S.logo[0] * vw) / r.vw;
				logo.y += (f * S.logo[1] * vh) / r.vh;
				logo.w += (f * S.logo[2] * vw) / r.vw;
				logo.h += (f * S.logo[3] * vw) / r.vw;
				const k = skipAt(r, top, line(r.vw, r.vh));
				skip.x += f * k.x;
				skip.y += f * k.y;
				skip.w += f * k.w;
				skip.h += f * k.h;
			}
			const fade = share / s3;
			out = { boardDy: boardDy * fade, treeDy: treeDy * fade, share, logo: share > 0 ? logo : null, skip, skipShare };
		}
	}
	if (fitMemo.size > 400) fitMemo.clear();
	fitMemo.set(key, out);
	return out;
};
/** a box between the rule's own and his, by the share his has here */
export const fitBox = (rule: Box, his: Box | null, share: number): Box => (!his || share <= 0 ? rule : { x: rule.x + (his.x - rule.x) * share, y: rule.y + (his.y - rule.y) * share, w: rule.w + (his.w - rule.w) * share, h: rule.h + (his.h - rule.h) * share });
/** is a tree line drawn: upright, on the game's own phones (`phoneSize`: a short side of 480 CSS px or under) and, since
 *  round 3 (he placed one at 626 x 816, where the game drew none), up to FOREST_MAX_SHORT wide */
export const forestOn = (kind: SignKind, vw: number, vh: number, phoneSize: boolean) => kind === 'portrait' && (phoneSize || Math.min(vw, vh) <= FOREST_MAX_SHORT);

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
	const sb = stepBox(g.step, g.u);
	const h = sb.h * g.u;
	// (the rows the symbols' press boxes really take: a box is kept inside the window, seatAmount, so near the bottom
	// edge it stands higher than the amount's own middle; round 3, 320 x 568)
	const cy = Math.max(h / 2, Math.min(b.y + b.h / 2, g.vh - h / 2));
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
		if (dy >= v - 1e-6) continue;
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
	const nominal = g.num.amt * u;
	const full = widestEm * nominal;
	const minW = AMOUNT_FIT.minW * u;
	// THE ROOM. Desktop: twice the nearer side's, about his center (as the mock). Phones (2026-11-22, the larger amount):
	// all the row has between its two limits, shared evenly; the group then stands as near his center as that width
	// allows (the smallest move: none where his center already has the room on both sides).
	const phone = g.kind !== 'landscape';
	// ROUND 3: THE GROUP STANDS WHERE HE LEFT IT. His two symbols' press boxes end at cx -/+ amtHalf: the row's limits
	// reach at least that far each way where a box there is inside the window and clear of the Play's diamond (it is, at
	// each of his windows: he placed them with no warning showing), and the width kept between the symbols is never
	// less than his (`hisW`), so an everyday amount at the common number size leaves both symbols exactly where he put
	// them. A longer currency's amount takes more room where the row has it, and comes down a step where it does not.
	const keyH0 = sb.h * u;
	const ky0 = Math.max(0, Math.min(cy - keyH0 / 2, g.vh - keyH0));
	let hisW = 0;
	if (g.amtHalf > 0) {
		const playS = shapeOf('play', g.box.play);
		// (half a px of leave at the window's edge: his export is rounded to 0.1 px, and at 440 x 742 his > box ends on the edge)
		const free = (x: number) => x >= -0.5 && x + keyW <= g.vw + 0.5 && shapeGap(boxPts({ x, y: ky0, w: keyW, h: keyH0 }), playS) > 0;
		const lo = cx - g.amtHalf * u;
		const hi = cx + g.amtHalf * u;
		limits = [lo < limits[0] && free(lo) ? Math.max(0, lo) : limits[0], hi > limits[1] && free(hi - keyW) ? Math.min(g.vw, hi) : limits[1]];
		if (lo >= limits[0] - 0.5 && hi <= limits[1] + 0.5) hisW = Math.max(0, 2 * (g.amtHalf * u - keyW - gap));
	}
	const room = Math.max(minW, phone ? limits[1] - limits[0] - 2 * (keyW + gap) : 2 * (Math.min(cx - limits[0], limits[1] - cx) - keyW - gap));
	const { k, under } = fitSteps(full, room + 1e-6);
	const W = Math.max(minW, Math.min(room, Math.max(full * k, headW, hisW)));
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
		if (dy >= v - 1e-6) continue;
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

/** THE AMOUNT'S SIZE FOR THE MODE IN PLAY (Corey 2026-11-24, on his phone, "PLAY 100.00 SC" smaller than Balance: "I
 *  would prefer the Play gets bigger ... I should have said per game mode. Like if I'm not playing Ante the numbers have
 *  room to be bigger. The arrows should stay where they are at.").
 *  THE ARROWS DO NOT MOVE WITH THE MODE: the seat (seatAmount) is worked out for the base game's widest amount and the
 *  base label, as the bar shows it with no mode on, and stays there when an Ante level or a feature is loaded.
 *  THE NUMBER is as large as the widest amount of the mode in play allows (`modeEm`: over the whole bet menu at that
 *  mode's price, so it is steady while the player steps the amount and changes only with the mode or the currency),
 *  never larger than the window's common number size (Balance's and Win's, SignGeo.num), in the ROOM BETWEEN THE TWO
 *  DRAWN SYMBOLS less AMOUNT_TYPE.clear bar px each side. That room is wider than the slot between the symbols' 44 px
 *  press boxes (a drawn symbol is about 20 px in its 44 px box): the slot is what the number was held to before, and
 *  it is why the base game's amount came out smaller than Balance in a long currency with the room showing each
 *  side. The press boxes are unchanged: a number wider than the slot reaches into their empty margins, never to
 *  within `clear` of a drawn symbol, and a press there is still the symbol's. `under`: the widest amount needs less
 *  than AMOUNT_TYPE.floor CSS px to fit even so (a very long currency at a high mode): it is drawn at what fits,
 *  never clipped. CSS px. */
export const AMOUNT_TYPE = { clear: 4, floor: 9 } as const;
export const amountType = (g: SignGeo, seat: Seat, modeEm: number): { px: number; k: number; under: boolean; room: number; sym: number } => {
	const sym = stepDraw(g.step).w * g.u;
	const room = Math.max(1, seat.upC[0] - seat.downC[0] - sym - 2 * AMOUNT_TYPE.clear * g.u);
	const nominal = g.num.amt * g.u;
	const px = modeEm > 0 ? Math.min(nominal, room / modeEm) : nominal;
	return { px, k: px / nominal, under: px < AMOUNT_TYPE.floor - 1e-6, room, sym };
};

/** BALANCE AND WIN AT THE AMOUNT'S SIZE: A DEV LOOK ONLY (Corey 2026-11-24, on the windows outside his seven where the
 *  amount alone steps down, 390 x 844: 10.9 px beside 14.6: "Show me what they look like please"). The default is
 *  unchanged: one nominal size, the amount fitted down on its own. With the look on (ui/sign/SignHud.svelte: the dev
 *  hook's sign.matchNumbers, or ?numbers=match on a dev server; never in a production build) Balance's and Win's
 *  nominal size is the size the amount is drawn at, where that is smaller. Bar px. */
export const matchedType = (g: SignGeo, seat: { px: number }): SignGeo['num'] => {
	const a = seat.px / g.u;
	return { amt: g.num.amt, bal: Math.min(g.num.bal, a), win: Math.min(g.num.win, a) };
};

/** THE READOUT'S NUMBER. Its box is his place, always and exactly: the fit never moves or resizes the box. The number is
 *  drawn in the box (from its left edge, or about its center) at its nominal size while it is no wider than the box
 *  less the 8 bar px the box always kept round it (so a number that fitted before fits now, at the same size), and no
 *  wider than its room allows about that anchor; a longer one comes down by fitSteps. `textEm`: the number's width in
 *  em of its face, every digit a 0 wide. */
export const readoutFit = (g: SignGeo, id: 'bal' | 'win', zones: Zones | null, safe: Insets, textEm: number) => {
	const b = g.box[id];
	const nominal = g.num[id] * g.u;
	const room = readoutRoom(g, id, zones, safe);
	const span = g.just[id] === 'left' ? room.x + room.w - b.x : room.w;
	const limit = Math.max(1, Math.min(b.w - 8 * g.u, span - 2 * READOUT_FIT.pad * g.u));
	const f = fitSteps(textEm * nominal, limit);
	return { box: b, room, limit, px: nominal * f.k, k: f.k, under: f.under };
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
	for (const [id, d] of Object.entries(pressRegions(press, padPlaces(press, g.vw, g.vh)))) if ((d as number) < TOUCH_MIN - 0.05) out.push(`${id} press region ${r1(d as number)}`);
	return out;
};
