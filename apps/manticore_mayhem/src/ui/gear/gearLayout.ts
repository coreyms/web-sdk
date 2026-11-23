// THE GEAR BAR'S LAYOUT: one typed table per screen kind and the one rule that places it (2026-11-22).
// Approved mock: Desktop "Manticore Mayhem/desktop_r6_2026-11-22" (Corey's export corey_desktop_r6_2026-11-22.json,
// his places at 1920 x 1080) and "desktop_r7_sizes_2026-11-22" (the rule for every other desktop window, build/sizes.js).
// Corey: "these gears look awesome", "The spin button is good in all states", "Let's go with it, we need to verify it
// works at other desktop resolutions".
//
// THE PIECES (the same ten names in every table): play, auto, turbo, amt, down, up, bal, win, menu, arm.
//
// UNITS. Every number in a table is a CSS px on that table's own reference window. gearBarLayout() answers in CSS px of
// the real window, so the HTML bar draws at true size (nothing in it is drawn under a scale it does not own).
//
// THE DESKTOP RULE (the game's own fit, ui/hud/hudLayout.ts and game/layoutSpec.ts, as the mock's sizes page applies it):
//   - the 1280 x 720 master is fitted to the window and centered; the board, the logo and the Manticore scale with it
//   - the HUD's scale is u = fit / 1.125, or fit / 0.921875 where the window draws the master under 1:1 (the game's
//     "tablet" rule: 22 percent larger against the board); h = u / (4 / 3) is that scale against the 1920 x 1080 table
//   - every group keeps its 1920 x 1080 size x h and its place against what it belongs to:
//       the gears      against the frame's top right wheel, their gap to its teeth kept (in the board's scale)
//       the standards  under the logo (its bottom center)
//       Win            on the window's center line, on the bottom edge
//       Balance        against the 16:9 game area's left edge, on the bottom edge
//       the amount     with its arrows against that area's right edge, on the bottom edge
//   - ultrawide: the 16:9 game area is the master's own, so the controls stay with the game
//   - NUDGES, by rule (the mock's per-size list falls out of these):
//       the gears shrink (the gap to the wheel kept) until they are 4 px inside the window and off the PolyMath line:
//         9 percent at 1440 x 900, 13 percent at 1200 x 675 and 1024 x 576, none at the 16:9 sizes from 1280 x 720 up
//       the small word under the hub's count (AUTO, OF 8) is drawn at 17 in place of 14 where 14 would be under 10 px
//       a group never shrinks its smallest press box under 44 px (the amount is 1 percent larger at 1024 x 576)
//       the standards shrink to stay 4 px inside the window's left edge (a window narrower than 16:10, where the
//         bigger board leaves the logo a narrow column; none of the sizes the mock checked)
//   - Corey's ruling: the amount lying about 11 px onto the Manticore's feet at 1200 x 675 and 1024 x 576 is accepted.
//
// THE UPRIGHT PHONE (2026-11-22, Corey's export corey_phone_upright_r3_2026-11-22.json, set on an iPhone 17 Pro, 402 x
// 874; mock Desktop "Manticore Mayhem/phone_upright_r3_2026-11-22", build/train3.js): a meshed gear train along the
// bottom, under the spin amount plaque. UPRIGHT below is his setup and uprightLayout() the rule; the notes are there.
//
// SIDEWAYS PHONES AND POPOUTS. `sideways` is empty until Corey sets it; barKind() is the one switch. Until a table is
// filled its screens keep today's glass dock exactly as it is (ui/hud/hudLayout.ts).
//
// Pure: no DOM, no runes. tools/gear_layout_test.mjs sweeps it in node.
import { FRAME, MASTER, frameFor, landscapeExtraY, landscapeTallFrame, registrationOf, type LayoutKind } from '../../game/layoutSpec';
import { PORTRAIT, portraitBoardBottoms } from '../hud/hudLayout';
import { BOARD_ART } from '../../game/boardArtSpec';
import { LOGO, LOGO_KEY } from '../../game/constants';
import { FRAME_WHEEL } from '../../game/frameGears';

export const PIECES = ['play', 'auto', 'turbo', 'amt', 'down', 'up', 'bal', 'win', 'menu', 'arm'] as const;
export type Piece = (typeof PIECES)[number];
export type Box = { x: number; y: number; w: number; h: number };

// ---- ROLLBACK: one constant ------------------------------------------------------------------------------------------
/** 'gear': the gear bar wherever a table is filled (the rule in barKind), today's glass dock everywhere else.
 *  'dock': today's glass dock on every screen (the bar as it shipped before 2026-11-22). */
export const GAME_BAR: 'gear' | 'dock' = 'gear';

// ---- THE GEARS (the frame wheel's own teeth: Desktop mock gears/wheel.json, measured in the game's art) --------------
/** the frame wheel at 1920 x 1080, CSS px: tooth pitch along the pitch circle and tooth height. The Play gear and the
 *  two small gears take exactly these, so the three could mesh with the frame's wheel and do mesh with each other. */
export const TOOTH = { pitch: 18.443, height: 10.311 } as const;
/** a gear about `across` px over its tips with the matched teeth: the count that fits, then its true radii */
export const matchedGear = (across: number, min: number) => matchedTo(across, TOOTH.pitch, TOOTH.height, min);
/** the same for any tooth (a phone's board-matched tooth is smaller: UPRIGHT.tooth) */
export function matchedTo(across: number, pitch: number, height: number, min: number) {
	const teeth = Math.max(min, Math.round((Math.PI * (across - height)) / pitch));
	const pitchR = (teeth * pitch) / (2 * Math.PI);
	return { teeth, pitchR, R: pitchR + height / 2 };
}

type GearRef = { cx: number; cy: number; R: number; pitchR: number; teeth: number };
export type DesktopTable = {
	window: { vw: number; vh: number };
	/** the Play gear: its center, its size over the tips before the teeth are matched, the hub's share of its radius */
	play: { cx: number; cy: number; across: number; hub: number };
	/** Auto and Turbo: their size, the play between meshed pitch circles, where each is snapped round the Play gear
	 *  (degrees clockwise from the top) */
	small: { across: number; clear: number; autoDeg: number; turboDeg: number };
	/** the other seven pieces' boxes */
	boxes: Record<Exclude<Piece, 'play' | 'auto' | 'turbo'>, Box>;
	/** the hub's text: the count, the small word under it at its two sizes, SPIN, the small gears' word */
	text: { count: number; sub: number; subBig: number; subMin: number; spin: number; word: number };
};
/** a phone table: the same ten pieces as boxes on its own reference window (the gears as their tip circles' boxes) */
export type PhoneTable = { window: { vw: number; vh: number }; boxes: Record<Piece, Box> };
export type TrainGear = 'play' | 'turbo' | 'auto' | 'menu' | 'arm';
/** the upright phone's table: a gear train (each small gear snapped on its parent at an angle, degrees clockwise from
 *  the top) and the readouts' places, on its own reference window */
export type UprightTable = {
	window: { vw: number; vh: number };
	/** the board-matched tooth on that window (pitch along the pitch circle, height), and the board's own scale there
	 *  (CSS px per px of the board art): another window's tooth is this x its board's scale over this one */
	tooth: { pitch: number; height: number; boardK: number };
	/** the band the train stands in on that window: the spin amount plaque's shadow box's bottom */
	bandTop: number;
	play: { cx: number; cy: number; across: number; hub: number };
	/** the four small gears: their size, the smallest they are ever asked to be, the play between meshed pitch circles */
	small: { across: number; min: number; clear: number };
	chain: Record<Exclude<TrainGear, 'play'>, { parent: TrainGear; deg: number }>;
	/** the readouts' and the arrows' centers as he placed them */
	centers: Record<'win' | 'amt' | 'down' | 'up' | 'bal', readonly [number, number]>;
	/** the arrows' drawn size; the clear gap their press boxes keep from the Play's press region */
	arrow: number;
	gapSpin: number;
	/** real text: the readouts' word and number, SPIN in the hub (and its ink line), the hub's count and small word */
	text: { label: number; number: number; spin: number; spinInk: number; count: number; sub: number };
	/** the readouts' boxes at that type: the longest US amounts at the number's size (Balance and Win 6.83 em, the
	 *  amount 4.77 em: ui/hud/hudLayout.ts VALUE_EM), one word line over one number line */
	box: Record<'win' | 'bal' | 'amt', { w: number; h: number }>;
};

/** COREY'S DESKTOP, 1920 x 1080 (corey_desktop_r6_2026-11-22.json; the readouts' boxes are the mock's base boxes x his
 *  sizes: Balance 186 x 40 x 1.28, the amount 124 x 40 x 1.25, Win 190 x 42 x 1.3, all x the mock's u 1.3333) */
export const DESKTOP: DesktopTable = {
	window: { vw: 1920, vh: 1080 },
	play: { cx: 1622, cy: 179, across: 278, hub: 0.66 },
	small: { across: 140, clear: 0.6, autoDeg: 120.3, turboDeg: 80.6 },
	boxes: {
		amt: { x: 1536.933, y: 998.133, w: 206.667, h: 66.667 },
		down: { x: 1466.933, y: 1002.533, w: 66.667, h: 66.667 },
		up: { x: 1767.6, y: 1002.267, w: 66.667, h: 66.667 },
		bal: { x: 10.667, y: 998.133, w: 317.44, h: 68.267 },
		win: { x: 795.333, y: 999.2, w: 329.333, h: 72.8 },
		menu: { x: 48.033, y: 222.232, w: 151.467, h: 168 },
		arm: { x: 207.5, y: 222.232, w: 151.467, h: 168 },
	},
	// the mock's hub text x its text scale (hub radius / 62.5 x 0.62 = 0.918): 44, 14 and 17; SPIN 36; the word 19
	text: { count: 40.4, sub: 12.85, subBig: 15.6, subMin: 10, spin: 36, word: 19 },
};

/** COREY'S UPRIGHT PHONE, 402 x 874 (corey_phone_upright_r3_2026-11-22.json: the Play gear 138.5 on the center line at
 *  y 788.3, 56 teeth; four small gears of 60, 23 teeth; Turbo on the Play at 98.9 degrees; the chain Auto on the Play
 *  at 260, Menu on Auto at 257.5, the Armoury on Menu at 352.4; no words on the small gears; SPIN 19.4. The readouts'
 *  centers are his boxes' (the mock's pictures at 0.38 and 0.4 of the desktop pieces).) */
export const UPRIGHT: UprightTable = {
	window: { vw: 402, vh: 874 },
	tooth: { pitch: 7.59, height: 4.243, boardK: 0.233811 },
	bandTop: 718.594,
	play: { cx: 201, cy: 788.3, across: 138.5, hub: 0.66 },
	small: { across: 60, min: 46, clear: 0.6 },
	chain: { turbo: { parent: 'play', deg: 98.9 }, auto: { parent: 'play', deg: 260 }, menu: { parent: 'auto', deg: 257.5 }, arm: { parent: 'menu', deg: 352.4 } },
	centers: { win: [103.55, 731.33], amt: [336.77, 739.17], down: [286.83, 740.83], up: [385.33, 739.83], bal: [341.8, 837.97] },
	arrow: 26.67,
	gapSpin: 8,
	text: { label: 9, number: 15, spin: 19.4, spinInk: 1.2, count: 20, sub: 9 },
	box: { win: { w: 108, h: 26 }, bal: { w: 108, h: 26 }, amt: { w: 78, h: 26 } },
};

/** the sideways phone's table: a chain from the board frame's top right wheel (Auto on the wheel, Turbo on Auto, the
 *  Play on Turbo, each at an angle clockwise from the top), on its own reference window */
export type SidewaysTable = {
	window: { vw: number; vh: number };
	tooth: { pitch: number; height: number; boardK: number };
	play: { across: number; hub: number };
	small: { across: number; clear: number };
	chain: { auto: number; turbo: number; play: number };
	/** how far the Play may reach under the top edge of the Manticore's shape (px of the board art; his own placing's) */
	cover: number;
	/** the arrows' drawn size and their centers' spacing in a row; the amount's box; the standards' and the readouts'
	 *  scales against the desktop pieces; SPIN and the small gears' word; the readouts' word */
	arrow: number;
	arrowGap: number;
	amt: { w: number; h: number; number: number };
	std: number;
	readout: number;
	text: { spin: number; spinInk: number; word: number; label: number };
};
/** COREY'S SIDEWAYS PHONE, 874 x 402 (corey_phone_sideways_r3_2026-11-22.json, his own placing on an iPhone 17 Pro: the
 *  frame's top right wheel, then Auto on it at 90.4 degrees, Turbo on Auto at 120.3, the Play on Turbo at 94.4; the
 *  Play 105.5 (106.7 across its tips, 40 teeth), Auto and Turbo 48 (17 teeth), their words 8.2 px, SPIN 13.6).
 *  Corey: "Ideally the play button is this large, and we connect a chain where Auto is connected to Turbo and Turbo is
 *  connected to Play, Play on the right, so it's not covering the tail". His Play reaches 11 px under the tip of the
 *  Manticore's tail in his tallest pose; Corey: "That's fine, if it covers the tail a little bit, it doesn't at rest,
 *  but most of the time it wont". */
export const SIDEWAYS: SidewaysTable = {
	window: { vw: 874, vh: 402 },
	tooth: { pitch: 8.0307, height: 4.4897, boardK: 0.24726 },
	play: { across: 105.5, hub: 0.66 },
	small: { across: 48, clear: 0.6 },
	chain: { auto: 90.4, turbo: 120.3, play: 94.4 },
	cover: 46.5,
	arrow: 29.33,
	arrowGap: 133.2,
	amt: { w: 99.2, h: 32, number: 16.8 },
	std: 0.48,
	readout: 0.553,
	text: { spin: 13.6, spinInk: 0.8, word: 8.2, label: 9 },
};
/** a sideways phone smaller than this keeps the dock (Stake's 568 x 320 and smaller, its Popout S 400 x 225). Its
 *  Popout L, 800 x 450, has a short side under 480 px, so the game lays it out as a phone held sideways (the phone
 *  master): this rule places it and the chain fits. */
export const SIDEWAYS_MIN = { vw: 640, vh: 340 } as const;
/** THE MANTICORE'S TOP EDGE on a sideways phone: [x, y] in px of the board art from the frame's top right wheel's center
 *  (x right, y down), the highest point of him in each 16 px column over his idle loops and his tallest pose (roar 13).
 *  From the mock's build/creature_dist.json (its "rest" shape at 874 x 402; he and the board scale together on every
 *  sideways phone, so one table serves them all). Everything under it is his. */
const SKYLINE: readonly (readonly [number, number])[] = [[-127,793],[-111,720],[-94,688],[-78,664],[-62,656],[-46,639],[-30,631],[-14,623],[3,615],[19,599],[35,591],[51,583],[67,583],[83,583],[100,583],[116,567],[132,567],[148,567],[164,567],[181,567],[197,567],[213,567],[229,292],[245,284],[261,275],[278,267],[294,259],[310,259],[326,251],[342,251],[358,243],[375,243],[391,243],[407,235],[423,251],[439,251],[456,251],[472,251],[488,251],[504,259],[520,259],[536,259],[553,275],[569,284],[585,292],[601,308],[617,332],[634,356],[650,397],[666,591],[682,591],[698,591],[714,591],[731,599],[747,607],[763,615],[779,615],[795,615],[811,623],[828,631],[844,647],[860,656],[876,664]];

/** THE TABLES: every screen kind's table is filled. */
export const TABLES: { desktop: DesktopTable; sideways: SidewaysTable | null; upright: UprightTable | null } = {
	desktop: DESKTOP,
	sideways: SIDEWAYS,
	upright: UPRIGHT,
};
/** an upright phone narrower than this keeps the dock (Stake's Mobile S, 320 x 568: the chain does not fit, the mock
 *  says so: the Armoury 31 px off the window) */
export const UPRIGHT_MIN_VW = 360;

/** a desktop window smaller than this keeps the dock (Stake's two popouts, 800 x 450 and 400 x 225; its Laptop size,
 *  1024 x 576, is the smallest window the desktop table was checked at), and so does one where the rule would have to
 *  draw the gears under `gears` of their 1920 x 1080 size to fit them beside the frame's wheel (0.565 at 1024 x 576; a
 *  small window near 4:3, where the board is at its largest against the window: an iPad held sideways, 1024 x 768) */
export const DESKTOP_MIN = { vw: 900, vh: 500, gears: 0.55 } as const;

/** THE SWITCH: which bar a screen draws. kind is the chrome's (game/layoutSpec.ts layoutKind): 'landscape' is every
 *  desktop window, 'phone' a phone held sideways, 'portrait' a phone or tablet held upright. */
export type Safe = { t: number; r: number; b: number; l: number };
export type BarView = { kind: LayoutKind; vw: number; vh: number; phone?: boolean; safeBottom?: number; safe?: Safe };
export const barKind = (v: BarView, mode: 'gear' | 'dock' = GAME_BAR): 'gear' | 'dock' => {
	if (mode === 'dock') return 'dock';
	if (v.kind === 'landscape') return TABLES.desktop && v.vw >= DESKTOP_MIN.vw && v.vh >= DESKTOP_MIN.vh && desktopLayout(v.vw, v.vh).scale.gears >= DESKTOP_MIN.gears ? 'gear' : 'dock';
	if (v.kind === 'phone') return TABLES.sideways && sidewaysLayout(v.vw, v.vh, v.safe) ? 'gear' : 'dock';
	// upright: phones from UPRIGHT_MIN_VW wide where the train fits; a tablet held upright keeps the dock
	return TABLES.upright && v.phone && v.vw >= UPRIGHT_MIN_VW && uprightLayout(v.vw, v.vh, v.safeBottom ?? 0) ? 'gear' : 'dock';
};

// ---- the scene a desktop window draws (CSS px), from the game's own layout numbers -----------------------------------
/** COPY OF ui/ClockStrip.svelte: the POLYMATH GAMES line, master units (right 14, top 10, 12 px type; its width as
 *  measured in the running game at 1280 x 720) */
const POLYMATH_LINE = { right: 14, top: 10, w: 133.8, h: 15 };
const sceneOf = (vw: number, vh: number) => {
	const M = MASTER.landscape;
	const fit = Math.min(vw / M.width, vh / M.height);
	const left = (vw - M.width * fit) / 2;
	const top = (vh - M.height * fit) / 2;
	const extra = landscapeExtraY(vh / fit);
	const reg = registrationOf(landscapeTallFrame(extra));
	const css = (p: { x: number; y: number }) => ({ x: left + p.x * fit, y: top + p.y * fit });
	const w = css(reg.map(FRAME_WHEEL.center.R[0], FRAME_WHEEL.center.R[1]));
	const boardK = reg.m * fit;
	const artLeft = css(reg.map(BOARD_ART.art[0], BOARD_ART.art[1])).x;
	// COPY OF game/logo/layout.ts logoArtRect('landscape'): the column between the screen's edge and the frame art
	const G = LOGO_KEY.grow.landscape;
	const aspect = LOGO.art.width / LOGO.art.height;
	const lw = G ? Math.max(reg.map(BOARD_ART.art[0], 0).x - 2 * G.gap, 1) : LOGO.landscape.width;
	const lm = G ? { x: G.gap, y: G.top - extra } : { x: LOGO.landscape.cx - lw / 2, y: LOGO.landscape.cy - lw / aspect / 2 };
	const lp = css(lm);
	const logo: Box = { x: lp.x, y: lp.y, w: lw * fit, h: (lw / aspect) * fit };
	const sp = css({ x: M.width - POLYMATH_LINE.right - POLYMATH_LINE.w, y: POLYMATH_LINE.top - extra });
	const strip: Box = { x: sp.x, y: sp.y, w: POLYMATH_LINE.w * fit, h: POLYMATH_LINE.h * fit };
	return { fit, left, top, extra, boardK, artLeft, logo, strip, wheel: { cx: w.x, cy: w.y, tipR: FRAME_WHEEL.tipR * boardK, pitchR: ((FRAME_WHEEL.tipR + FRAME_WHEEL.rootR) / 2) * boardK } };
};

const deg = (d: number) => (d * Math.PI) / 180;
/** the three gears on the table's own window */
const refGears = (T: DesktopTable) => {
	const p = matchedGear(T.play.across, 12);
	const s = matchedGear(T.small.across, 8);
	const play: GearRef = { cx: T.play.cx, cy: T.play.cy, R: p.R, pitchR: p.pitchR, teeth: p.teeth };
	const at = (a: number): GearRef => {
		const d = p.pitchR + s.pitchR + T.small.clear;
		return { cx: play.cx + d * Math.sin(deg(a)), cy: play.cy - d * Math.cos(deg(a)), R: s.R, pitchR: s.pitchR, teeth: s.teeth };
	};
	return { play, auto: at(T.small.autoDeg), turbo: at(T.small.turboDeg) };
};
export const DESKTOP_GEARS = refGears(DESKTOP);

/** how deep a circle reaches into a box (px; 0 = clear) */
const circleInBox = (c: { cx: number; cy: number; R: number }, r: Box) => {
	const nx = Math.max(r.x, Math.min(c.cx, r.x + r.w));
	const ny = Math.max(r.y, Math.min(c.cy, r.y + r.h));
	const d = Math.hypot(c.cx - nx, c.cy - ny);
	const inside = c.cx > r.x && c.cx < r.x + r.w && c.cy > r.y && c.cy < r.y + r.h;
	return inside ? c.R : Math.max(0, c.R - d);
};

/** the smallest side a press box may have, CSS px (house rule L4) */
export const MIN_PRESS = 44;
/** the gears stay this far inside the window */
const EDGE = 4;

export type GearCircle = { cx: number; cy: number; R: number; pitchR: number; teeth: number };
export type GearBarLayout = ReturnType<typeof desktopLayout>;

/** THE DESKTOP RULE: every piece of the gear bar for a desktop window, CSS px of that window */
export const desktopLayout = (vw: number, vh: number, T: DesktopTable = DESKTOP) => {
	const S = sceneOf(vw, vh);
	const S0 = sceneOf(T.window.vw, T.window.vh);
	const tablet = S.fit < 1;
	const u = S.fit / (tablet ? 0.921875 : 1.125);
	const u0 = S0.fit / 1.125;
	const h = u / u0;
	const kb = S.boardK / S0.boardK;
	const wide = vw / vh > 16 / 9 + 0.005;
	const areaW = wide ? (vh * 16) / 9 : vw;
	const areaX = (vw - areaW) / 2;
	const G0 = refGears(T);

	// ---- the gears: against the frame's wheel, their gap to its teeth kept in the board's scale ----
	const v = [G0.play.cx - S0.wheel.cx, G0.play.cy - S0.wheel.cy];
	const d0 = Math.hypot(v[0], v[1]);
	const n = [v[0] / d0, v[1] / d0];
	const gap = d0 - G0.play.R - S0.wheel.tipR;
	const gearsAt = (k: number) => {
		const dT = S.wheel.tipR + gap * kb + G0.play.R * k;
		const c = { cx: S.wheel.cx + n[0] * dT, cy: S.wheel.cy + n[1] * dT };
		const put = (g: GearRef): GearCircle => ({ cx: c.cx + (g.cx - G0.play.cx) * k, cy: c.cy + (g.cy - G0.play.cy) * k, R: g.R * k, pitchR: g.pitchR * k, teeth: g.teeth });
		return { play: put(G0.play), auto: put(G0.auto), turbo: put(G0.turbo) };
	};
	const fits = (g: ReturnType<typeof gearsAt>) => {
		const cs = [g.play, g.auto, g.turbo];
		const out = Math.max(...cs.map((c) => Math.max(EDGE - (c.cx - c.R), c.cx + c.R - (vw - EDGE), EDGE - (c.cy - c.R), c.cy + c.R - (vh - EDGE))));
		return out <= 0.5 && Math.max(...cs.map((c) => circleInBox(c, S.strip))) <= 0.75;
	};
	const kFloor = MIN_PRESS / (2 * G0.auto.R);
	let kGears = Math.max(h, kFloor);
	while (kGears - 0.002 >= kFloor && !fits(gearsAt(kGears))) kGears -= 0.002;
	const gears = gearsAt(kGears);

	// ---- the other groups: each about its own anchor (the table's window -> this window) ----
	const L0 = S0.logo;
	const L = S.logo;
	const groups = {
		standards: { a0: [L0.x + L0.w / 2, L0.y + L0.h], aT: [L.x + L.w / 2, L.y + L.h], k: Math.min(h, (L.x + L.w / 2 - EDGE) / (L0.x + L0.w / 2 - T.boxes.menu.x)), ids: ['menu', 'arm'] },
		bal: { a0: [0, T.window.vh], aT: [areaX, vh], k: h, ids: ['bal'] },
		win: { a0: [T.window.vw / 2, T.window.vh], aT: [vw / 2, vh], k: h, ids: ['win'] },
		bet: { a0: [T.window.vw, T.window.vh], aT: [areaX + areaW, vh], k: h, ids: ['amt', 'down', 'up'] },
	} as const;
	const scale = { gears: kGears, standards: h, bal: h, win: h, bet: h };
	const box = {} as Record<Piece, Box>;
	for (const [name, g] of Object.entries(groups) as [keyof typeof groups, (typeof groups)[keyof typeof groups]][]) {
		// a group never draws its smallest press box under MIN_PRESS
		const press = g.ids.filter((id) => id === 'down' || id === 'up' || id === 'menu' || id === 'arm').map((id) => Math.min(T.boxes[id].w, T.boxes[id].h));
		const k = Math.max(g.k, press.length ? MIN_PRESS / Math.min(...press) : 0);
		scale[name] = k;
		for (const id of g.ids) {
			const r = T.boxes[id];
			box[id] = { x: g.aT[0] + (r.x - g.a0[0]) * k, y: g.aT[1] + (r.y - g.a0[1]) * k, w: r.w * k, h: r.h * k };
		}
	}
	for (const id of ['play', 'auto', 'turbo'] as const) {
		const c = gears[id];
		box[id] = { x: c.cx - c.R, y: c.cy - c.R, w: 2 * c.R, h: 2 * c.R };
	}
	// the small word under the hub's count: the larger size where the first would be under subMin px
	const subBig = T.text.sub * kGears < T.text.subMin;
	const text = { count: T.text.count * kGears, sub: (subBig ? T.text.subBig : T.text.sub) * kGears, subBig, spin: T.text.spin * kGears, word: T.text.word * kGears };
	return {
		table: 'desktop' as const,
		vw, vh, fit: S.fit, u, h, tablet, wide, area: { x: areaX, w: areaW },
		/** each group's scale against the table (1 at 1920 x 1080) */
		scale,
		/** the three gears: centers, tip radius, pitch radius, teeth */
		gears,
		/** the Play gear's hub radius */
		hubR: gears.play.R * T.play.hub,
		/** every piece's box; a piece's press box is its own box (the gears': the square round the tips) */
		box,
		text,
		/** the frame's top right wheel, the logo, the frame art's left edge and the POLYMATH GAMES line here */
		scene: { wheel: S.wheel, logo: S.logo, artLeft: S.artLeft, strip: S.strip, boardK: S.boardK },
		/** where the standards' chains start: the logo plate's underside (the mock's plateBottom) */
		chainTop: L.y + L.h * 0.965,
		/** the Play gear against the frame's wheel: the centers' distance, and how far that is from a true mesh */
		mesh: { d: Math.hypot(gears.play.cx - S.wheel.cx, gears.play.cy - S.wheel.cy), off: Math.hypot(gears.play.cx - S.wheel.cx, gears.play.cy - S.wheel.cy) - (S.wheel.pitchR + gears.play.pitchR + T.small.clear * kGears) },
	};
};

/** the desktop gear bar for a screen, or null where barKind() says dock */
export const gearBarLayout = (v: BarView, mode: 'gear' | 'dock' = GAME_BAR): GearBarLayout | null =>
	barKind(v, mode) === 'gear' && v.kind === 'landscape' ? desktopLayout(v.vw, v.vh) : null;
/** the upright phone's gear bar for a screen, or null where barKind() says dock */
export const uprightBarLayout = (v: BarView, mode: 'gear' | 'dock' = GAME_BAR): UprightLayout | null =>
	v.kind === 'portrait' && barKind(v, mode) === 'gear' ? uprightLayout(v.vw, v.vh, v.safeBottom ?? 0) : null;

/** the sideways phone's gear bar for a screen, or null where barKind() says dock */
export const sidewaysBarLayout = (v: BarView, mode: 'gear' | 'dock' = GAME_BAR): SidewaysLayout | null =>
	v.kind === 'phone' && mode === 'gear' && TABLES.sideways ? sidewaysLayout(v.vw, v.vh, v.safe) : null;

// ---- THE SIDEWAYS PHONE'S RULE ----------------------------------------------------------------------------------------
// ONE RULE, his placing exactly at 874 x 402 with no safe area:
//   WHEEL  the chain starts on the board frame's own top right wheel (the game's registration for this window), so it
//          is meshed with the wheel the canvas draws, and it is phased to it (WHEEL_REST: the wheel's tooth at rest).
//   SIZES  everything scales with the board (s = this window's board scale over his): the Play his 105.5 x s (about
//          0.265 of the window's height), Auto and Turbo his 48 and never smaller (their press is 44 px or more).
//   CHAIN  his angles first (Auto 90.4 on the wheel, Turbo 120.3 on Auto, the Play 94.4 on Turbo: a row to the right,
//          so on every wide phone the chain is his, only scaled: no jump between 874 x 402, 852 x 393 and 844 x 390).
//          Where his chain does not fit at full size (a narrower window, a right safe area) the other bends are tried at
//          that size before the Play is made smaller (2 percent a step, down to 0.6 of his). A chain fits when:
//            every gear is 2 px inside the window and inside the right safe area; the Play is right of the board frame's
//            plate and of Turbo; no gear crosses a gear it does not mesh with, or the symbol cells;
//            Auto and Turbo are clear of the Manticore (his top edge, SKYLINE, 1.5 px kept);
//            the Play reaches under his top edge no further than his own placing does (SIDEWAYS.cover: 11 px at 874 x
//            402, the tail tip in his tallest pose; Corey: "That's fine, if it covers the tail a little bit").
//          No chain fits: null (the dock).
//   THE REST  Menu and the Armoury as standards under the logo (0.48 of the desktop pair, smaller where the column left
//          of the board is narrower); Win over Balance at the bottom left (as wide as that column); the amount with gold
//          < and > at the bottom right, over his feet (accepted), in a row where the room right of the board holds it,
//          else the amount over the two arrows side by side, else over the two arrows one above the other: the arrows'
//          44 px press boxes never overlap. Real text: 9 px words everywhere.
// THE MOVES FROM HIS EXPORT at 874 x 402: > 1.3 px left and < and > 3 px up (their 44 px press boxes were 1.3 px off
// the right edge and 3 px off the bottom), the amount with them (0.7 px left, 3 px up). The gears are his.
// THE TOP LINE: his Play covers the studio name at the top right (ui/ChromePhone.svelte moves that line under the
// clock line at the left while this bar is drawn; nothing is hidden).
/** the frame wheel's tooth angle at rest, degrees clockwise from the top, and its turn per link (the mock's
 *  gears/wheel.json frameDeg[0]; two of its 16 teeth a link, clockwise) */
export const WHEEL_REST = { deg: 20.578, perLink: 45 } as const;
export const wheelAngle = (links: number) => WHEEL_REST.deg + links * WHEEL_REST.perLink;
export type SidewaysLayout = NonNullable<ReturnType<typeof sidewaysLayout>>;
const A1 = [0, 110, 125, 144, 160, 176];
const A2 = [0, 36, 52, 64, 76, 88, 100, 112, 136, 152];
const A3 = [0, 30, 48, 60, 76, 88, 100, 114, 130];

export const sidewaysLayout = (vw: number, vh: number, safe: Safe = { t: 0, r: 0, b: 0, l: 0 }, T: SidewaysTable = SIDEWAYS) => {
	if (vw < SIDEWAYS_MIN.vw || vh < SIDEWAYS_MIN.vh) return null;
	const M = MASTER.phone;
	const fit = Math.min(vw / M.width, vh / M.height);
	const left = (vw - M.width * fit) / 2;
	const top0 = (vh - M.height * fit) / 2;
	const css = (p: { x: number; y: number }) => ({ x: left + p.x * fit, y: top0 + p.y * fit });
	const reg = registrationOf(frameFor('phone'));
	const boardK = reg.m * fit;
	const s = boardK / T.tooth.boardK;
	const tooth = { pitch: T.tooth.pitch * s, height: T.tooth.height * s };
	const wc = css(reg.map(FRAME_WHEEL.center.R[0], FRAME_WHEEL.center.R[1]));
	const wheel = { cx: wc.x, cy: wc.y, R: FRAME_WHEEL.tipR * boardK, pitchR: ((FRAME_WHEEL.tipR + FRAME_WHEEL.rootR) / 2) * boardK, teeth: FRAME_WHEEL.teeth };
	const fs = BOARD_ART.frame.phone;
	const p0 = css(reg.map(fs.crop[0], fs.crop[1]));
	const p1 = css(reg.map(fs.crop[0] + fs.size[0], fs.crop[1] + fs.size[1]));
	const plate = { x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y };
	const F = FRAME.phone;
	const c0 = css({ x: F.x + F.inset, y: F.y + F.inset });
	const cells: Box = { x: c0.x, y: c0.y, w: (F.width - 2 * F.inset) * fit, h: (F.width - 2 * F.inset) * fit };
	const right = vw - Math.max(0, safe.r) - 2;
	const gearOf = (across: number) => {
		let g = matchedTo(across, tooth.pitch, tooth.height, 8);
		while (2 * g.R < MIN_PRESS) g = matchedTo(2 * g.R + tooth.pitch / 2, tooth.pitch, tooth.height, g.teeth + 1);
		return g;
	};
	const S = gearOf(Math.max(T.small.across, T.small.across * s));
	type C = { cx: number; cy: number; R: number; pitchR: number; teeth: number };
	const on = (p: C, g: { R: number; pitchR: number; teeth: number }, a: number): C => {
		const d = p.pitchR + g.pitchR + T.small.clear;
		return { cx: p.cx + d * Math.sin(deg(a)), cy: p.cy - d * Math.cos(deg(a)), R: g.R, pitchR: g.pitchR, teeth: g.teeth };
	};
	/** how far a gear reaches under the Manticore's top edge, px of the board art (negative: clear by that much) */
	const under = (c: C) => {
		const x = (c.cx - wheel.cx) / boardK;
		const y = (c.cy - wheel.cy) / boardK;
		let best = Infinity;
		for (let i = 0; i < SKYLINE.length; i += 1) {
			const dx = Math.abs(x - SKYLINE[i][0]);
			const d = y >= SKYLINE[i][1] ? dx : Math.hypot(dx, y - SKYLINE[i][1]);
			if (d < best) best = d;
		}
		return c.R / boardK - best;
	};
	const inWin = (c: C) => c.cx - c.R >= 2 && c.cx + c.R <= right && c.cy - c.R >= 2 && c.cy + c.R <= vh - 2;
	const apart = (a: C, b: C) => Math.hypot(a.cx - b.cx, a.cy - b.cy) >= a.R + b.R + 1;
	const smallOk = (c: C) => inWin(c) && circleToBox(c, cells) >= 1 && under(c) <= -1.5 / boardK;
	let found: { auto: C; turbo: C; play: C; a: [number, number, number]; f: number; cover: number } | null = null;
	search: for (let f = 1; f >= 0.6 - 1e-9; f -= 0.02) {
		const P = gearOf(T.play.across * s * f);
		for (const b1 of A1) {
			const a1 = b1 || T.chain.auto;
			const auto = on(wheel, S, a1);
			if (!smallOk(auto)) continue;
			for (const b2 of A2) {
				const a2 = b2 || T.chain.turbo;
				const turbo = on(auto, S, a2);
				if (!smallOk(turbo) || !apart(turbo, wheel)) continue;
				for (const b3 of A3) {
					const a3 = b3 || T.chain.play;
					const play = on(turbo, P, a3);
					if (!inWin(play) || play.cx - play.R < plate.x1 + 2 || play.cx <= turbo.cx || !apart(play, wheel) || !apart(play, auto) || circleToBox(play, cells) < 1) continue;
					const cover = under(play);
					if (cover > T.cover + 0.5) continue;
					found = { auto, turbo, play, a: [a1, a2, a3], f, cover };
					break search;
				}
			}
		}
	}
	if (!found) return null;
	const gears = {
		play: { ...found.play, parent: 'turbo' as const, deg: found.a[2] },
		auto: { ...found.auto, parent: 'wheel' as const, deg: found.a[0] },
		turbo: { ...found.turbo, parent: 'auto' as const, deg: found.a[1] },
	};
	// ---- the standards under the logo. COPY OF game/logo/layout.ts logoArtRect('phone'): LOGO.phone, the tablet in its box ----
	const lw = LOGO.phone.width * fit;
	const lh = lw / (LOGO.art.width / LOGO.art.height);
	const logo: Box = { x: left + LOGO.phone.left * fit, y: top0 + LOGO.phone.top * fit + (lw / LOGO.boxAspect - lh) / 2, w: lw, h: lh };
	const edge = Math.max(0, safe.l) + 6;
	const D = DESKTOP.boxes;
	// the pair is 155.4 px wide at 0.48 (the mock's short rod): as large as the column left of the board holds
	const kStd = Math.min(T.std, (T.std * (plate.x0 - 6 - edge)) / 155.4);
	if (D.menu.w * kStd < MIN_PRESS) return null;
	const q = kStd / T.std;
	const menuX = Math.max(edge, Math.min(logo.x + logo.w / 2 - 98.75 * q, plate.x0 - 6 - 155.4 * q));
	const stdY = logo.y + logo.h + 13.6 * q;
	const box = {} as Record<Piece, Box>;
	const press = {} as Record<Piece, Box>;
	box.menu = { x: menuX, y: stdY, w: D.menu.w * kStd, h: D.menu.h * kStd };
	box.arm = { x: menuX + 82.7 * q, y: stdY, w: D.arm.w * kStd, h: D.arm.h * kStd };
	// ---- Win over Balance, bottom left: as wide as the column left of the board ----
	const kRo = Math.min(T.readout, (plate.x0 - 6 - edge) / D.win.w);
	const num = { bal: Math.max(13, Math.min(20, 35.8 * kRo)), win: Math.max(14, Math.min(23, 41.6 * kRo)) };
	const floor = vh - Math.max(3, safe.b + 1);
	const balH = Math.max(D.bal.h * kRo, T.text.label + 1 + num.bal + 2);
	const winH = Math.max(D.win.h * kRo, T.text.label + 1 + num.win + 2);
	box.bal = { x: edge, y: floor - balH, w: D.bal.w * kRo, h: balH };
	box.win = { x: edge, y: floor - balH - 2 - winH, w: D.win.w * kRo, h: winH };
	if (box.win.y < box.menu.y + box.menu.h + 2) return null;
	// ---- the amount with < and >, bottom right: a row, else the amount over the arrows side by side, else over the
	// arrows one above the other; the arrows' press boxes whole, inside the window and the safe areas, never overlapping ----
	const x1 = vw - Math.max(0, safe.r);
	const room = x1 - (plate.x1 + 4);
	const yb = vh - Math.max(0, safe.b);
	const h2 = MIN_PRESS / 2;
	let how: 'row' | 'side by side' | 'stacked';
	let dn: { x: number; y: number };
	let up: { x: number; y: number };
	let amt: Box;
	if (room >= T.arrowGap * Math.min(1, s) + MIN_PRESS) {
		how = 'row';
		up = { x: x1 - h2, y: yb - h2 };
		dn = { x: up.x - T.arrowGap * Math.min(1, s), y: up.y };
		amt = { x: (dn.x + up.x) / 2 - T.amt.w / 2, y: up.y - T.amt.h / 2, w: T.amt.w, h: T.amt.h };
	} else if (room >= 2 * MIN_PRESS + 4) {
		how = 'side by side';
		const m = Math.min(6, (room - 2 * MIN_PRESS) / 2);
		up = { x: x1 - m - h2, y: yb - h2 };
		dn = { x: up.x - MIN_PRESS - Math.min(2, m), y: up.y };
		const w = Math.min(T.amt.w, room);
		amt = { x: Math.max(plate.x1 + 4, Math.min((dn.x + up.x) / 2 - w / 2, x1 - w)), y: up.y - h2 - 2 - T.amt.h, w, h: T.amt.h };
	} else if (room >= MIN_PRESS + 2) {
		how = 'stacked';
		dn = { x: x1 - 1 - h2, y: yb - h2 };
		up = { x: dn.x, y: dn.y - MIN_PRESS };
		const w = Math.min(T.amt.w, room);
		amt = { x: x1 - w, y: up.y - h2 - 2 - T.amt.h, w, h: T.amt.h };
	} else return null;
	box.amt = amt;
	for (const [id, c] of [['down', dn], ['up', up]] as const) {
		press[id] = { x: c.x - h2, y: c.y - h2, w: MIN_PRESS, h: MIN_PRESS };
		box[id] = { x: c.x - T.arrow / 2, y: c.y - T.arrow / 2, w: T.arrow, h: T.arrow };
	}
	for (const id of ['play', 'auto', 'turbo'] as const) {
		const c = gears[id];
		box[id] = press[id] = { x: c.cx - c.R, y: c.cy - c.R, w: 2 * c.R, h: 2 * c.R };
	}
	for (const id of ['win', 'bal', 'amt', 'menu', 'arm'] as const) press[id] = box[id];
	const hubR = gears.play.R * T.play.hub;
	const hub0 = matchedTo(T.play.across, T.tooth.pitch, T.tooth.height, 8).R * T.play.hub;
	const word = Math.max(T.text.word, (T.text.word * S.R) / matchedTo(T.small.across, T.tooth.pitch, T.tooth.height, 8).R);
	return {
		table: 'sideways' as const,
		vw, vh, fit, s, safe,
		tooth,
		wheel,
		gears,
		/** the Play against his own size (1 = his proportion), and how far it reaches under the Manticore's top edge (CSS px) */
		playScale: found.f,
		coverPx: Math.max(0, found.cover) * boardK,
		hubR,
		box,
		press,
		how,
		scale: { std: kStd, readout: kRo },
		fitW: { win: box.win.w - 6, bal: box.bal.w - 6, amt: how === 'row' ? Math.min(amt.w - 4, up.x - dn.x - 0.32 * T.arrow - 2) : amt.w - 4 },
		text: { label: T.text.label, number: T.amt.number, bal: num.bal, win: num.win, word, spin: (T.text.spin * hubR) / hub0, spinInk: T.text.spinInk, count: Math.max(13, (14.4 * hubR) / hub0), sub: Math.max(8, (6.5 * hubR) / hub0), hub0 },
		scene: { boardK, plate, logo, cells },
		/** the top line's studio name (ui/ClockStrip.svelte, right side) as the dock draws it, and whether the Play covers it */
		chainTop: logo.y + logo.h * 0.965,
	};
};

// ---- THE UPRIGHT PHONE'S RULE -----------------------------------------------------------------------------------------
// ONE RULE, exact at 402 x 874 with no safe area:
//   BAND   the train stands between the spin amount plaque's shadow (its bottom edge, the game's own:
//          ui/hud/hudLayout.ts portraitBoardBottoms) and the window's bottom edge less the bottom safe area.
//   SCALE  k = the smallest of: the window's width over 402; the band's height over his band's; and what keeps the
//          Play gear's press region 1 px above the bottom safe area. k is 1 on his phone with no safe area.
//   GEARS  the Play gear is his 138.5 x k on the center line, its center his 69.7 x k under the band's top; the small
//          gears his 60 x k, never asked under 46 and never under 44 px over the tips. Every gear takes the board's own
//          tooth for this window (his 7.59 px pitch x this board's scale over his), so the teeth counts follow the sizes.
//   CHAIN  Turbo on the Play at his 98.9 degrees; Auto on the Play at 260, Menu on Auto at 257.5, the Armoury on Menu
//          at 352.4. Where a gear would leave the band or the window, or cross a gear it does not mesh with, its angle
//          turns toward a straight row (Auto and Menu toward 270, the Armoury down from 352.4 toward 270, Turbo toward
//          90) by the least that fits; the Armoury's angle gives first, then Menu's, then Auto's. No fit: null (the dock).
//   READOUTS  real text (a 9 px word over a 15 px number). His arrangement where it fits, each checked against the gears'
//          circles, not boxes:
//            Win      between the Armoury and the Play gear at his height, centered in the free span the two circles
//                     leave along its number's line (the number is fitted to that span, never abbreviated)
//            amount   upper right with < and >: each arrow's 44 px press box clear of every gear, at least 8 px from
//                     the Play's press region (Corey: accidental changes there are "like stealing in my eyes"), wholly
//                     inside the window; the number centered between them
//            Balance  lower right, 2 px under Turbo (the mock solver's own place)
//          and where one does not fit, where the mock's solver puts it: the amount right of Turbo over its two arrows,
//          else all of it under the logo; Win and Balance under the logo, at the left.
// THE MOVES FROM HIS PLACES at 402 x 874 (the problems his export listed, solved with the smallest moves):
//   <        9.7 px right: its press box was 1.1 px into the Play's press region, now 8 px clear
//   >        5.3 px left: its 44 px press box was 5.3 px off the window's right edge
//   amount   1.5 px right: centered between the two arrows
//   Win      4.2 px right: his box's corner was 14.3 px into the Play gear and 13.6 into the Armoury; the text now
//            stands in the middle of the 80 px the two circles leave (a number wider than that span is fitted to it)
//   Balance  10.1 px down: its word met Turbo's teeth; it now starts 2 px under Turbo
//   the train itself is where he put it while the bottom safe area is 0. With one (a full screen web view on an iPhone
//   17 Pro: 34 px) k comes down to 0.87 and the train stands on the safe area's edge; lifting it without shrinking
//   would put the Play gear 15 px onto the plaque.
export type TrainCircle = GearCircle & { parent: TrainGear | null; deg: number };
export type UprightLayout = NonNullable<ReturnType<typeof uprightLayout>>;
/** a circle against a box: the clear distance (negative: how deep it reaches in) */
const circleToBox = (c: { cx: number; cy: number; R: number }, b: Box) => {
	const nx = Math.max(b.x, Math.min(c.cx, b.x + b.w));
	const ny = Math.max(b.y, Math.min(c.cy, b.y + b.h));
	const inside = c.cx > b.x && c.cx < b.x + b.w && c.cy > b.y && c.cy < b.y + b.h;
	return inside ? -c.R : Math.hypot(c.cx - nx, c.cy - ny) - c.R;
};
const boxesMeet = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** angles from `from` toward `to` in steps, `from` first */
const toward = (from: number, to: number, step: number) => {
	const out = [from];
	const n = Math.ceil(Math.abs(to - from) / step);
	for (let i = 1; i <= n; i++) out.push(from + Math.sign(to - from) * Math.min(i * step, Math.abs(to - from)));
	return out;
};

export const uprightLayout = (vw: number, vh: number, safeBottom = 0, T: UprightTable = UPRIGHT) => {
	const M = MASTER.portrait;
	const fit = Math.min(vw / M.width, vh / M.height);
	const fitTop = (vh - M.height * fit) / 2;
	const B = portraitBoardBottoms(vw, vh);
	const boardK = registrationOf(frameFor('portrait', vw / fit)).m * fit;
	const top = B.shadow.y1;
	const plate = B.plaque - PORTRAIT.plaqueShadowCss;
	const floor = vh - Math.max(0, safeBottom) - 1;
	const R0 = matchedTo(T.play.across, T.tooth.pitch, T.tooth.height, 8).R;
	const k = Math.min(vw / T.window.vw, (vh - top) / (T.window.vh - T.bandTop), (floor - top) / (T.play.cy + R0 - T.bandTop));
	if (!(k > 0.2)) return null;
	const tooth = { pitch: (T.tooth.pitch * boardK) / T.tooth.boardK, height: (T.tooth.height * boardK) / T.tooth.boardK };
	const gearOf = (across: number, min: number) => {
		let g = matchedTo(across, tooth.pitch, tooth.height, 8);
		while (2 * g.R < min) g = matchedTo(2 * g.R + tooth.pitch / 2, tooth.pitch, tooth.height, g.teeth + 1);
		return g;
	};
	const P = gearOf(T.play.across * k, 0);
	const S = gearOf(Math.max(T.small.across * k, T.small.min), MIN_PRESS);
	const clear = T.small.clear;
	// ---- the Play gear: on the center line, his height under the band's top; never onto the plaque's shadow, never
	// into the bottom safe area ----
	let cy = top + (T.play.cy - T.bandTop) * k;
	if (cy - P.R < top - 0.2) cy = top - 0.2 + P.R;
	if (cy + P.R > floor) cy = floor - P.R;
	if (cy - P.R < top - 0.2) return null;
	const play: TrainCircle = { cx: vw / 2, cy, R: P.R, pitchR: P.pitchR, teeth: P.teeth, parent: null, deg: 0 };
	const on = (p: TrainCircle, parent: TrainGear, a: number): TrainCircle => {
		const d = p.pitchR + S.pitchR + clear;
		return { cx: p.cx + d * Math.sin(deg(a)), cy: p.cy - d * Math.cos(deg(a)), R: S.R, pitchR: S.pitchR, teeth: S.teeth, parent, deg: a };
	};
	const inBand = (c: TrainCircle) => c.cx - c.R >= 2 && c.cx + c.R <= vw - 2 && c.cy - c.R >= top - 0.2 && c.cy + c.R <= floor;
	const apart = (a: TrainCircle, b: TrainCircle) => Math.hypot(a.cx - b.cx, a.cy - b.cy) >= a.R + b.R + 1;
	const turbo = toward(T.chain.turbo.deg, 90, 0.5).map((a) => on(play, 'play', a)).find(inBand);
	if (!turbo) return null;
	let chain: { auto: TrainCircle; menu: TrainCircle; arm: TrainCircle } | null = null;
	search: for (const a1 of toward(T.chain.auto.deg, 270, 1)) {
		const auto = on(play, 'play', a1);
		if (!inBand(auto)) continue;
		for (const a2 of toward(T.chain.menu.deg, 290, 1)) {
			const menu = on(auto, 'auto', a2);
			if (!inBand(menu) || !apart(menu, play)) continue;
			for (const a3 of toward(T.chain.arm.deg, 270, 1)) {
				const arm = on(menu, 'menu', a3);
				if (!inBand(arm) || !apart(arm, play) || !apart(arm, auto)) continue;
				chain = { auto, menu, arm };
				break search;
			}
		}
	}
	if (!chain) return null;
	const gears: Record<TrainGear, TrainCircle> = { play, turbo, ...chain };
	const all = Object.values(gears);
	const clearOf = (b: Box, gap = 1) => all.every((c) => circleToBox(c, b) >= gap);
	/** his place for a point, carried with the Play gear at this scale */
	const his = (pt: readonly [number, number]) => ({ x: play.cx + (pt[0] - T.play.cx) * k, y: play.cy + (pt[1] - T.play.cy) * k });
	const moved: string[] = [];
	// the pocket under the logo, at the left (the mock solver's: 6 px in, from 2 px under the logo's shadow down to the
	// board frame's art). COPY OF game/logo/layout.ts logoArtRect: the phone logo's bottom edge, LOGO_KEY.grow.portraitPhone
	const logoBottom = fitTop + (LOGO_KEY.grow.portraitPhone?.bottom ?? LOGO.portraitPhone.cy) * fit;
	const reg = registrationOf(frameFor('portrait', vw / fit));
	const plateTop = fitTop + reg.map(BOARD_ART.frame.portrait.crop[0], BOARD_ART.frame.portrait.crop[1]).y * fit;
	const pocket = { x: 6, y: logoBottom + 16.5 * fit, y1: plateTop - 2 };
	const pocketPut = (id: string, w: number, h: number): Box | null => {
		// (the Manticore stands right of it: the pocket ends at 0.45 of the window's width)
		if (pocket.y + h > pocket.y1 || pocket.x + w > 0.45 * vw) return null;
		const b = { x: pocket.x, y: pocket.y, w, h };
		pocket.y += h + 2;
		moved.push(id);
		return b;
	};
	const tb = (c: { x: number; y: number }): Box => ({ x: c.x - MIN_PRESS / 2, y: c.y - MIN_PRESS / 2, w: MIN_PRESS, h: MIN_PRESS });

	// ---- the amount with < and > ----
	let row: { down: Box; up: Box; amt: Box; fit: number; where: string } | null = null;
	{
		// upper right: >'s press box flush with the window's right edge (his is 5.3 px over it), < moved right until it is
		// gapSpin clear of the Play's press region
		const u = his(T.centers.up);
		const up = tb({ x: vw - MIN_PRESS / 2, y: Math.max(u.y, plate + 1 + MIN_PRESS / 2) });
		const d = his(T.centers.down);
		let down: Box | null = null;
		for (let x = d.x; x <= up.x - MIN_PRESS / 2 - 16 + 0.001; x += 0.25) {
			const t = tb({ x, y: Math.max(d.y, plate + 1 + MIN_PRESS / 2) });
			if (circleToBox(play, t) >= T.gapSpin && clearOf(t)) {
				down = t;
				break;
			}
		}
		if (down && clearOf(up) && circleToBox(play, up) >= T.gapSpin) {
			const cx = (down.x + up.x + MIN_PRESS) / 2;
			const a = his(T.centers.amt);
			// the number stands between the two arrows' ink (each chevron is the middle 0.32 of its drawn box)
			row = { down, up, amt: { x: cx - T.box.amt.w / 2, y: a.y - T.box.amt.h / 2, w: T.box.amt.w, h: T.box.amt.h }, fit: up.x - down.x - 0.32 * T.arrow - 2, where: 'upper right' };
		}
	}
	if (!row) {
		// right of Turbo: the amount over its two arrows, their press boxes side by side on the band's floor
		const right = vw - 4;
		const left = turbo.cx + turbo.R + 2;
		if (right - left >= 2 * MIN_PRESS) {
			const w = Math.min(T.box.amt.w, right - left);
			const amt = { x: right - w, y: top + 1, w, h: T.box.amt.h };
			const ty = Math.max(amt.y + amt.h + 1, floor - MIN_PRESS);
			const up = { x: right - MIN_PRESS, y: ty, w: MIN_PRESS, h: MIN_PRESS };
			const down = { x: right - 2 * MIN_PRESS, y: ty, w: MIN_PRESS, h: MIN_PRESS };
			if (ty + MIN_PRESS <= floor + 0.01 && [up, down, amt].every((b) => clearOf(b)) && circleToBox(play, down) >= T.gapSpin) row = { down, up, amt, fit: w - 4, where: 'right of Turbo' };
		}
	}
	// ---- Balance: lower right, 2 px under Turbo ----
	let bal: Box | null = null;
	if (row) {
		const c = his(T.centers.bal);
		const b = { x: Math.max(2, Math.min(c.x - T.box.bal.w / 2, vw - 2 - T.box.bal.w)), y: turbo.cy + turbo.R + 2, w: T.box.bal.w, h: T.box.bal.h };
		if (b.y + b.h <= floor && clearOf(b) && !boxesMeet(b, row.amt) && !boxesMeet(b, row.down) && !boxesMeet(b, row.up)) bal = b;
	}
	// ---- Win: between the Armoury and the Play gear, centered in the span their circles leave along its number ----
	let win: Box | null = null;
	let winFit = T.box.win.w - 6;
	{
		const c = his(T.centers.win);
		const h = T.box.win.h;
		let x0 = 2;
		let x1 = vw - 2;
		for (const y of [c.y - h / 2 + T.text.label + 1, c.y + 2, c.y + h / 2 - 1]) {
			for (const g of all) {
				const dy = Math.abs(y - g.cy);
				if (dy >= g.R) continue;
				const half = Math.sqrt(g.R * g.R - dy * dy);
				if (g.cx < c.x) x0 = Math.max(x0, g.cx + half);
				else x1 = Math.min(x1, g.cx - half);
			}
		}
		if (x1 - x0 - 2 >= 60 && c.y - h / 2 >= plate + 1 && c.y + h / 2 <= floor) {
			winFit = Math.min(T.box.win.w - 6, x1 - x0 - 2);
			win = { x: (x0 + x1) / 2 - T.box.win.w / 2, y: c.y - h / 2, w: T.box.win.w, h };
		}
	}
	if (!win) win = pocketPut('win', T.box.win.w, T.box.win.h);
	if (!bal) bal = pocketPut('bal', T.box.bal.w, T.box.bal.h);
	if (!win || !bal) return null;
	if (!row) {
		// under the logo too: < the amount > in one row, the arrows' press boxes whole
		const b = pocketPut('amount', 2 * MIN_PRESS + T.box.amt.w + 4, MIN_PRESS);
		if (!b) return null;
		row = { down: { x: b.x, y: b.y, w: MIN_PRESS, h: MIN_PRESS }, amt: { x: b.x + MIN_PRESS + 2, y: b.y + (MIN_PRESS - T.box.amt.h) / 2, w: T.box.amt.w, h: T.box.amt.h }, up: { x: b.x + MIN_PRESS + 4 + T.box.amt.w, y: b.y, w: MIN_PRESS, h: MIN_PRESS }, fit: T.box.amt.w - 4, where: 'under the logo' };
	}
	const box = { win, bal, amt: row.amt } as Record<Piece, Box>;
	/** each arrow: its press box, and the drawn arrow centered in it */
	const press = {} as Record<Piece, Box>;
	for (const id of ['down', 'up'] as const) {
		const t = row[id];
		press[id] = t;
		box[id] = { x: t.x + (t.w - T.arrow) / 2, y: t.y + (t.h - T.arrow) / 2, w: T.arrow, h: T.arrow };
	}
	for (const id of ['play', 'auto', 'turbo', 'menu', 'arm'] as const) {
		const c = gears[id];
		box[id] = press[id] = { x: c.cx - c.R, y: c.cy - c.R, w: 2 * c.R, h: 2 * c.R };
	}
	for (const id of ['win', 'bal', 'amt'] as const) press[id] = box[id];
	const hubR = play.R * T.play.hub;
	const hub0 = R0 * T.play.hub;
	return {
		table: 'upright' as const,
		vw, vh, fit, k, safeBottom, band: { top, floor, plate },
		/** the top of the bar's band under the plaque: the highest piece that is not under the logo (THE ARMOURY's menu
		 *  ends just above it, as it ends above the dock's readouts: ui/armoury/Armoury.svelte measure) */
		hudTop: Math.min(...Object.values(box).filter((b) => b.y >= plate).map((b) => b.y), ...[press.down, press.up].filter((b) => b.y >= plate).map((b) => b.y)),
		tooth,
		gears,
		hubR,
		box,
		press,
		/** the fit width of each readout's number; where each readout went ('band' places are his arrangement) */
		fitW: { win: winFit, bal: T.box.bal.w - 6, amt: row.fit },
		where: { win: moved.includes('win') ? 'under the logo' : 'between the Armoury and the Play gear', bal: moved.includes('bal') ? 'under the logo' : 'under Turbo', amt: row.where },
		gapSpin: Math.min(circleToBox(play, row.down), circleToBox(play, row.up)),
		text: { label: T.text.label, number: T.text.number, spin: (T.text.spin * hubR) / hub0, spinInk: T.text.spinInk, count: Math.max(15, (T.text.count * hubR) / hub0), sub: T.text.sub, hub0 },
		scene: { boardK, logoBottom, plateTop },
	};
};

// ---- how the gears turn (pure; ui/gear/GearBar.svelte applies it, the node test checks the mesh with it) ------------
/** THE PLAY GEAR'S ANGLE for the haul's travel, degrees clockwise: two teeth a link, the frame wheel's own tooth rate
 *  (it turns FRAME_WHEEL.teethPerLink of its 16 teeth a link, clockwise), the other way, as a gear meshed with it turns */
export const playAngle = (links: number, teeth: number) => -links * FRAME_WHEEL.teethPerLink * (360 / teeth);
/** A SMALL GEAR'S ANGLE, snapped at `at` degrees round the Play gear: a tooth of it sits in the Play gear's gap on the
 *  line of centers, and it turns the other way at the ratio of the tooth counts (the mock's snap rule, made continuous) */
export const smallAngle = (play: number, at: number, playTeeth: number, teeth: number) => at + 180 + (at - play) * (playTeeth / teeth) - 0.5 * (360 / teeth);
/** an angle folded into one period, centered on 0: a layer with `period` fold symmetry looks the same, and its
 *  drawn light never turns more than half a period */
export const fold = (a: number, period: number) => {
	const r = ((a % period) + period) % period;
	return r > period / 2 ? r - period : r;
};
