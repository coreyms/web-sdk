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
// PHONES AND POPOUTS. `sideways` and `upright` are empty until Corey sets them; barKind() is the one switch. Until a
// table is filled its screens keep today's glass dock exactly as it is (ui/hud/hudLayout.ts).
//
// Pure: no DOM, no runes. tools/gear_layout_test.mjs sweeps it in node.
import { MASTER, landscapeExtraY, landscapeTallFrame, registrationOf, type LayoutKind } from '../../game/layoutSpec';
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
export const matchedGear = (across: number, min: number) => {
	const teeth = Math.max(min, Math.round((Math.PI * (across - TOOTH.height)) / TOOTH.pitch));
	const pitchR = (teeth * TOOTH.pitch) / (2 * Math.PI);
	return { teeth, pitchR, R: pitchR + TOOTH.height / 2 };
};

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

/** THE TABLES. Fill `sideways` (a phone held sideways) and `upright` (a phone held upright) to give those screens the
 *  gear bar; barKind() then answers 'gear' for them and ui/gear/GearBar.svelte needs their placement added beside
 *  the desktop rule below. */
export const TABLES: { desktop: DesktopTable; sideways: PhoneTable | null; upright: PhoneTable | null } = {
	desktop: DESKTOP,
	sideways: null,
	upright: null,
};

/** a desktop window smaller than this keeps the dock (Stake's two popouts, 800 x 450 and 400 x 225; its Laptop size,
 *  1024 x 576, is the smallest window the desktop table was checked at), and so does one where the rule would have to
 *  draw the gears under `gears` of their 1920 x 1080 size to fit them beside the frame's wheel (0.565 at 1024 x 576; a
 *  small window near 4:3, where the board is at its largest against the window: an iPad held sideways, 1024 x 768) */
export const DESKTOP_MIN = { vw: 900, vh: 500, gears: 0.55 } as const;

/** THE SWITCH: which bar a screen draws. kind is the chrome's (game/layoutSpec.ts layoutKind): 'landscape' is every
 *  desktop window, 'phone' a phone held sideways, 'portrait' a phone or tablet held upright. */
export const barKind = (v: { kind: LayoutKind; vw: number; vh: number }, mode: 'gear' | 'dock' = GAME_BAR): 'gear' | 'dock' => {
	if (mode === 'dock') return 'dock';
	if (v.kind === 'landscape') return TABLES.desktop && v.vw >= DESKTOP_MIN.vw && v.vh >= DESKTOP_MIN.vh && desktopLayout(v.vw, v.vh).scale.gears >= DESKTOP_MIN.gears ? 'gear' : 'dock';
	if (v.kind === 'phone') return TABLES.sideways ? 'gear' : 'dock';
	return TABLES.upright ? 'gear' : 'dock';
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

/** the gear bar for a screen, or null where barKind() says dock */
export const gearBarLayout = (v: { kind: LayoutKind; vw: number; vh: number }, mode: 'gear' | 'dock' = GAME_BAR): GearBarLayout | null =>
	barKind(v, mode) === 'gear' && v.kind === 'landscape' ? desktopLayout(v.vw, v.vh) : null;

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
