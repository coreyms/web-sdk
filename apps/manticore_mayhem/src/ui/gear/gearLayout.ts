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
// 2026-11-23: the scene over the train (board, Manticore, logo) is placed for the train on every upright phone
// (ui/gear/uprightScene.ts), so the real frames of a phone browser draw it at near full size.
//
// SIDEWAYS PHONES AND POPOUTS. `sideways` is empty until Corey sets it; barKind() is the one switch. Until a table is
// filled its screens keep today's glass dock exactly as it is (ui/hud/hudLayout.ts).
//
// Pure: no DOM, no runes. tools/gear_layout_test.mjs sweeps it in node.
import { FRAME, MASTER, frameFor, midOn, midView, registrationOf, type LayoutKind, type PortraitScene } from '../../game/layoutSpec';
import { PORTRAIT, portraitBoardBottoms } from '../hud/hudLayout';
import { BOARD_ART } from '../../game/boardArtSpec';
import { LOGO, LOGO_KEY } from '../../game/constants';
import { FRAME_WHEEL } from '../../game/frameGears';
import { uprightScene } from './uprightScene';

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
	/** on a short window the small gears may stand larger against the Play than his 60 of 138.5, up to this share */
	smallShare: number;
	/** where the readouts find no free place in the band the train alone is tried a step smaller, down to shrinkMin of
	 *  the band's scale */
	shrink: number;
	shrinkMin: number;
	/** a readout's box stands this far inside the window: its number's ink (a 1.6 px line under the glyphs) is then 4 px
	 *  inside the bottom edge (2026-11-23: Balance's number sat on the frame's last row at 413 x 586 and read as cut) */
	readEdge: { side: number; bottom: number };
	/** THE LONGEST LABELS (2026-11-23: at 375 x 504, in a feature, "FREE SPINS WIN" was longer than its room and its
	 *  left end ran under Turbo). Win's "FREE SPINS WIN" while a feature plays (ui/hud/hudState.ts winPre: the same
	 *  words in every mode and on the social site) and Balance's "BASE AMOUNT" in a replay. `em`: the words' own width in
	 *  ems of the 9 px word (Outfit 900, the half em between FREE SPINS and WIN included), `n`: its tracked letters.
	 *  The readouts' words are tracked `track` em; a long label is tracked tighter, down to `trackMin`, to fit the room
	 *  its row has (`pad` px each side), and a place where it would not fit even then is not taken. */
	label: { track: number; trackMin: number; pad: number; win: { em: number; n: number }; bal: { em: number; n: number } };
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
	smallShare: 0.5,
	shrink: 0.02,
	shrinkMin: 0.8,
	readEdge: { side: 4, bottom: 6 },
	label: { track: 0.2, trackMin: 0.04, pad: 2, win: { em: 8.54, n: 12 }, bal: { em: 7.65, n: 10 } },
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
	/** THE HOME INDICATOR STRIP (2026-11-23): on a touch phone held sideways the game runs to the bottom edge and the
	 *  phone's home indicator line lies over about the bottom 20 px (measured on Corey's iPhone in Safari, Stake full
	 *  screen 832 x 376; inside the iframe the safe area reads 0). Nothing pressed or read stands in it: the bottom row
	 *  (Win over Balance, the amount with < and >) is drawn this far up, as if it were a bottom safe area. */
	homeStrip: number;
	/** the clear gap between Win's box and Balance's under it, CSS px */
	readGap: number;
	/** how much of the Play's size (share of his proportion) the chain may give to keep Turbo under Auto */
	orderCost: number;
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
	homeStrip: 20,
	readGap: 6,
	orderCost: 0.06,
};
/** a sideways phone smaller than this keeps the dock (Stake's 568 x 320 and smaller, its Popout S 400 x 225). Its
 *  Popout L, 800 x 450, has a short side under 480 px, so the game lays it out as a phone held sideways (the phone
 *  master): this rule places it and the chain fits.
 *  2026-11-23: the height was 340, which left the real frames of a phone browser with the dock (an iPhone 17 Pro in
 *  Safari sideways under a host bar, 874 x 338; an iPhone SE, 667 x 325 and 667 x 331). The rule itself fits them, home
 *  indicator strip and all (tools/gear_layout_test.mjs sweeps the survey's frames), so the floor is now 320; under it
 *  (667 x 311, 859 x 308, the 256 px tall frames) the dock stays: not judged on a device at that height.
 *  2026-11-26 (THE NO DOCK RULE, barKind): no floor of its own while the middle windows' rule is on (game/layoutSpec.ts
 *  MID.on; this floor is its rollback). The rule itself decides, by the same checks as every other sideways window
 *  (44 px press boxes, the 9 px text floor, the home indicator strip): it fits 667 x 311, 859 x 308, 748 x 256,
 *  808 x 256 and 568 x 320; where it does not (Popout S, 400 x 225: no chain fits right of the board) the dock is all
 *  that is left (tools/gear_layout_test.mjs lists them). */
export const SIDEWAYS_MIN = { vw: 640, vh: 320 } as const;
/** every text of the bar a player must read is at least this many CSS px (2026-11-23) */
export const TEXT_FLOOR = 9;
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

/** UNTIL 2026-11-26 a desktop window smaller than this kept the dock (its Laptop size, 1024 x 576, is the smallest window
 *  the desktop table was checked at), and so did one where the rule would have to draw the gears under `gears` of their
 *  1920 x 1080 size to fit them beside the frame's wheel (0.565 at 1024 x 576; an iPad held sideways, 1024 x 768). THE
 *  NO DOCK RULE (barKind) draws the gears there too, smaller; this is kept for the node test's record only. */
export const DESKTOP_MIN = { vw: 900, vh: 500, gears: 0.55 } as const;

/** THE SWITCH: which bar a screen draws. kind is the chrome's (game/layoutSpec.ts layoutKind): 'landscape' is every
 *  desktop window, 'phone' a phone held sideways, 'portrait' a phone or tablet held upright. */
export type Safe = { t: number; r: number; b: number; l: number };
/** touch: the page is on a touch device (a coarse pointer: ui/gear/barMode.ts TOUCH). A phone held sideways then keeps
 *  the home indicator strip clear (SIDEWAYS.homeStrip); a desktop popout laid out as a sideways phone does not. */
export type BarView = { kind: LayoutKind; vw: number; vh: number; phone?: boolean; safeBottom?: number; safe?: Safe; touch?: boolean; present?: Present };
/** the safe areas a sideways phone's bar is laid out in: the page's own, the bottom never under the home indicator strip on a touch phone */
export const sidewaysSafe = (v: Pick<BarView, 'safe' | 'touch'>): Safe => {
	const s = v.safe ?? { t: 0, r: 0, b: 0, l: 0 };
	return v.touch ? { ...s, b: Math.max(s.b, SIDEWAYS.homeStrip) } : s;
};
// THE NO DOCK RULE (2026-11-26, Corey: "We should always use the Gear layout since this older UI Bar was rejected by
// Stake before. So if there is a resolution that doesn't support the gear. We should put the gear elements in the same
// places."). Every desktop window draws the gear bar: at ratio 1.3 and over the desktop rule at every size (it was
// held to 900 x 500 and to gears over 0.55 of their size, DESKTOP_MIN, and a smaller window or one near 4:3, an iPad
// held sideways, kept the dock: there the gears are simply drawn smaller, never a press box under 44 px), and every
// window under 1.3 whose short side is over 480 is a desktop window now (game/layoutSpec.ts MID): the desktop rule in
// the wide style, the row under the board below MID.rowUnder (midRowLayout). Phones keep their own rules; the
// sideways rule has no size gate of its own any more (SIDEWAYS_MIN), and where a phone's rule finds no layout at all
// (barWhy) the dock is all that is left: tools/gear_layout_test.mjs lists every such frame and why.
export const barKind = (v: BarView, mode: 'gear' | 'dock' = GAME_BAR): 'gear' | 'dock' => {
	if (mode === 'dock') return 'dock';
	// (MID.on false, the rollback: the old floor, DESKTOP_MIN)
	if (v.kind === 'landscape') return TABLES.desktop && (midOn() || (v.vw >= DESKTOP_MIN.vw && v.vh >= DESKTOP_MIN.vh && desktopLayout(v.vw, v.vh).scale.gears >= DESKTOP_MIN.gears)) ? 'gear' : 'dock';
	if (v.kind === 'phone') return TABLES.sideways && sidewaysLayout(v.vw, v.vh, sidewaysSafe(v)) ? 'gear' : 'dock';
	// upright: phones from UPRIGHT_MIN_VW wide where the train fits (every portrait window is a phone since the middle
	// windows' rule, a short side over 480 being the desktop; with MID.on false a tablet held upright keeps the dock)
	return TABLES.upright && v.phone && v.vw >= UPRIGHT_MIN_VW && uprightLayout(v.vw, v.vh, v.safeBottom ?? 0) ? 'gear' : 'dock';
};
/** which gear bar a desktop window draws: the desktop rule, or the row under the board (game/layoutSpec.ts MID) */
export const deskBar = (vw: number, vh: number): 'desktop' | 'row' => (midView(vw, vh).band === 'row' ? 'row' : 'desktop');

// ---- the scene a desktop window draws (CSS px), from the game's own layout numbers -----------------------------------
/** COPY OF ui/ClockStrip.svelte: the POLYMATH GAMES line, master units (right 14, top 10, 12 px type; its width as
 *  measured in the running game at 1280 x 720) */
const POLYMATH_LINE = { right: 14, top: 10, w: 133.8, h: 15 };
const sceneOf = (vw: number, vh: number) => {
	const M = MASTER.landscape;
	const fit = Math.min(vw / M.width, vh / M.height);
	const left = (vw - M.width * fit) / 2;
	const top = (vh - M.height * fit) / 2;
	// the board and the top line's lift: today's at ratio 1.3 and over, the middle windows' under it (game/layoutSpec.ts MID)
	const V = midView(vw, vh);
	const extra = V.lift;
	const reg = registrationOf(V.frame);
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

/** SPIN's gold line on a phone (ui/gear/gearArt.ts spinWordSvg, open letters): his table's line, scaled with the hub as
 *  the word is, never under this many CSS px, so it stays a line on the smallest hubs (an upright 362 x 600 or a
 *  sideways 640 x 340 would scale it to about 0.5 and 0.6). The desktop word scales with its box and never needs it:
 *  2.2 px at 1920 x 1080, 1.22 px at the smallest desktop hub (radius 51.3, 980 x 540). */
export const SPIN_LINE_MIN = 0.75;
const spinLine = (line: number, k: number) => Math.max(SPIN_LINE_MIN, line * k);

/** the desktop bar's smallest words, CSS px: the hub's small word under its count and the small gears' word */
const DESK_WORD = { sub: 8.5, word: 9.5 } as const;
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
	// (2026-11-26, THE NO DOCK RULE: the windows that kept the dock until now draw the gears smaller, 0.32 of their size
	// at the least, and their words would be 6 to 7 px; the hub's small word is never drawn under 8.5 px nor the small
	// gears' under 9.5, the least any window that drew the gear bar before had, so those windows are unchanged)
	const text = { count: T.text.count * kGears, sub: Math.max(DESK_WORD.sub, (subBig ? T.text.subBig : T.text.sub) * kGears), subBig, spin: T.text.spin * kGears, word: Math.max(DESK_WORD.word, T.text.word * kGears) };
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
		/** the full train (every key drawn) and how the drawn keys are seated in it (seatBar) */
		train: gears as Record<string, GearCircle>,
		seat: { present: ALL_PRESENT, as: { auto: 'auto', turbo: 'turbo' }, mesh: { auto: ['play'], turbo: ['play'] }, hangers: ['menu', 'arm'] } as Seating,
		/** the Play gear against the frame's wheel: the centers' distance, and how far that is from a true mesh */
		mesh: { d: Math.hypot(gears.play.cx - S.wheel.cx, gears.play.cy - S.wheel.cy), off: Math.hypot(gears.play.cx - S.wheel.cx, gears.play.cy - S.wheel.cy) - (S.wheel.pitchR + gears.play.pitchR + T.small.clear * kGears) },
	};
};

/** the desktop gear bar for a screen, or null where barKind() says dock */
export const gearBarLayout = (v: BarView, mode: 'gear' | 'dock' = GAME_BAR): GearBarLayout | null =>
	barKind(v, mode) === 'gear' && v.kind === 'landscape' && deskBar(v.vw, v.vh) === 'desktop' ? seatBar(desktopLayout(v.vw, v.vh), v.present) : null;
/** the middle windows' row under the board for a screen (game/layoutSpec.ts MID), or null (another bar) */
export const midBarLayout = (v: BarView, mode: 'gear' | 'dock' = GAME_BAR): MidRowLayout | null =>
	barKind(v, mode) === 'gear' && v.kind === 'landscape' && deskBar(v.vw, v.vh) === 'row' ? seatBar(midRowLayout(v.vw, v.vh), v.present) : null;
/** the upright phone's gear bar for a screen, or null where barKind() says dock */
/** THE SCENE AN UPRIGHT PHONE DRAWS UNDER THE TRAIN (ui/gear/uprightScene.ts), in the canvas's master units, or null
 *  where barKind() says dock (the shipped scene). ui/gear/uprightSceneSource.ts hands it to game/layoutSpec.ts. */
export const uprightBarScene = (v: BarView, mode: 'gear' | 'dock' = GAME_BAR): PortraitScene | null =>
	v.kind === 'portrait' && barKind(v, mode) === 'gear' ? uprightScene(v.vw, v.vh, v.safeBottom ?? 0).master : null;
export const uprightBarLayout = (v: BarView, mode: 'gear' | 'dock' = GAME_BAR): UprightLayout | null =>
	v.kind === 'portrait' && barKind(v, mode) === 'gear' ? seatBar(uprightLayout(v.vw, v.vh, v.safeBottom ?? 0) as UprightLayout, v.present) : null;

/** the sideways phone's gear bar for a screen, or null where barKind() says dock */
export const sidewaysBarLayout = (v: BarView, mode: 'gear' | 'dock' = GAME_BAR): SidewaysLayout | null => {
	const L = v.kind === 'phone' && mode === 'gear' && TABLES.sideways ? sidewaysLayout(v.vw, v.vh, sidewaysSafe(v)) : null;
	return L ? seatBar(L, v.present) : null;
};

// ---- THE KEYS A PAGE DRAWS, AND THE TRAIN THAT STAYS MESHED (2026-11-24) ----------------------------------------------
// An operator's switches take keys away (disabledAutoplay: Auto; disabledTurbo: Turbo; disabledBuyFeature: the Armoury)
// and so does a replay (Auto and the Armoury). Until now the bars hid the key and left the rest where they stood, so on
// the upright train a hidden Auto left Menu and the Armoury apart from the Play gear, and sideways a hidden Turbo left
// Auto apart from it. Corey 2026-11-24, asked "when a gear is hidden, the remaining gears slide toward Play in the same
// order, so the train is always meshed. Order stays Armoury, Menu, Auto, Play, Turbo with whichever are present": "yes".
//
// ONE RULE, seatBar(): every layout is solved once, for all its keys (the tables and rules above), and that solution's
// small gears are SLOTS. The keys a page draws take the slots from the Play gear outward, in their order:
//   upright   left of the Play: Auto's slot, then Menu's, then the Armoury's (Menu always; Auto and the Armoury where
//             drawn). Turbo keeps its own slot at the right.
//   sideways  from the Play back toward the frame's wheel: Turbo's slot, then Auto's. One small gear alone stands in
//             Turbo's slot, meshed with the Play (the frame's wheel then turns beside the chain, not in it).
//   desktop   Auto and Turbo each mesh with the Play gear itself, so one alone is already where it belongs.
// A key in a slot is that slot's gear exactly: its place, its size, its teeth and its turning (all the small gears of
// a train are one size, so the mesh is the solved one, tooth in gap, and the haul drives it as before; the bars turn
// each drawn key as the slot it sits in, so a key that changes slot snaps to the new slot's phase). The Play gear, the
// amount, its arrows, Win and Balance never move: fewer gears only leave room. Sizes never change.
// THE STANDARDS (desktop, sideways) never meshed: they hang from the logo. With the Armoury gone Menu hangs alone,
// centered where the pair was centered (under the logo's middle on desktop), not left where it stood beside a gap.
export type Present = { auto: boolean; turbo: boolean; arm: boolean };
export const ALL_PRESENT: Present = { auto: true, turbo: true, arm: true };
/** the keys a page draws: the operator's switches (stateConfig.jurisdiction) and a replay */
export const presentKeys = (j: { disabledAutoplay?: boolean; disabledTurbo?: boolean; disabledBuyFeature?: boolean } | null | undefined, replay: boolean): Present => ({
	auto: !replay && !j?.disabledAutoplay,
	turbo: !j?.disabledTurbo,
	arm: !replay && !j?.disabledBuyFeature,
});
export type Seating = {
	present: Present;
	/** the slot (a gear of the full train) each drawn small gear sits in and turns as */
	as: Partial<Record<TrainGear, TrainGear>>;
	/** what each drawn small gear meshes with: other drawn gears, 'play', the frame's 'wheel' */
	mesh: Partial<Record<TrainGear, string[]>>;
	/** the drawn pieces that never mesh (the standards hang from the logo) */
	hangers: Piece[];
};
type Seatable = { table: 'desktop' | 'upright' | 'sideways' | 'mid'; gears: Record<string, GearCircle>; box: Record<Piece, Box>; press?: Record<Piece, Box>; seat: Seating; train: Record<string, GearCircle> };
/** THE BAR FOR THE KEYS A PAGE DRAWS: the solved layout with its absent keys gone and the rest seated (see above).
 *  All keys present: the layout itself. */
export const seatBar = <L extends Seatable>(L: L, present: Present = ALL_PRESENT): L => {
	if (present.auto && present.turbo && present.arm) return L;
	const F = L.train;
	const gears: Record<string, GearCircle> = { play: F.play };
	const box = { ...L.box } as Record<string, Box>;
	const press = L.press ? ({ ...L.press } as Record<string, Box>) : null;
	const as: Seating['as'] = {};
	const mesh: Seating['mesh'] = {};
	// every slot's box goes; the keys drawn get theirs back as they are seated
	for (const id of ['auto', 'turbo', 'menu', 'arm'] as const) {
		if (!(id in F)) continue;
		delete box[id];
		if (press) delete press[id];
	}
	/** key `id` takes slot `slot`: the slot's gear and boxes */
	const sit = (id: TrainGear, slot: TrainGear, parent: string, neighbors: string[]) => {
		gears[id] = { ...F[slot], ...(L.table === 'upright' || L.table === 'mid' ? { parent } : {}) } as GearCircle;
		box[id] = L.box[slot];
		if (press && L.press) press[id] = L.press[slot];
		as[id] = slot;
		mesh[id] = neighbors;
	};
	if (L.table === 'upright' || L.table === 'mid') {
		const ids = (['auto', 'menu', 'arm'] as const).filter((id) => id === 'menu' || present[id]);
		const slots = ['auto', 'menu', 'arm'] as const;
		ids.forEach((id, i) => sit(id, slots[i], i ? ids[i - 1] : 'play', [i ? ids[i - 1] : 'play', ...(ids[i + 1] ? [ids[i + 1]] : [])]));
		if (present.turbo) sit('turbo', 'turbo', 'play', ['play']);
	} else if (L.table === 'sideways') {
		const ids = (['turbo', 'auto'] as const).filter((id) => present[id]);
		const slots = ['turbo', 'auto'] as const;
		ids.forEach((id, i) => sit(id, slots[i], i ? ids[i - 1] : 'play', i ? [ids[i - 1], 'wheel'] : ['play', ...(ids[1] ? [ids[1]] : [])]));
	} else {
		for (const id of ['auto', 'turbo'] as const) if (present[id]) sit(id, id, 'play', ['play']);
	}
	// the standards (desktop, sideways): Menu alone hangs where the pair was centered
	let hangers = L.seat.hangers;
	if (!('menu' in F) && !present.arm) {
		const mid = (L.box.menu.x + L.box.arm.x + L.box.arm.w) / 2;
		box.menu = { ...L.box.menu, x: mid - L.box.menu.w / 2 };
		delete box.arm;
		if (press) {
			press.menu = box.menu;
			delete press.arm;
		}
		hangers = ['menu'];
	}
	return { ...L, gears, box, ...(press ? { press } : {}), seat: { present: { ...present }, as, mesh, hangers } } as L;
};

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

/** why the last sidewaysLayout() call gave no chain (the dock) */
export const sidewaysWhy = { last: '' };
const noSide = (why: string): null => {
	sidewaysWhy.last = why;
	return null;
};
export const sidewaysLayout = (vw: number, vh: number, safe: Safe = { t: 0, r: 0, b: 0, l: 0 }, T: SidewaysTable = SIDEWAYS) => {
	sidewaysWhy.last = '';
	if (!midOn() && (vw < SIDEWAYS_MIN.vw || vh < SIDEWAYS_MIN.vh)) return noSide(`the window is under ${SIDEWAYS_MIN.vw} x ${SIDEWAYS_MIN.vh}`);
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
	type Found = { auto: C; turbo: C; play: C; a: [number, number, number]; f: number; cover: number };
	/** the first chain that fits, the largest Play first. `ordered`: Turbo never above Auto (see below) */
	const find = (ordered: boolean): Found | null => {
	for (let f = 1; f >= 0.6 - 1e-9; f -= 0.02) {
		const P = gearOf(T.play.across * s * f);
		for (const b1 of A1) {
			const a1 = b1 || T.chain.auto;
			const auto = on(wheel, S, a1);
			if (!smallOk(auto)) continue;
			for (const b2 of A2) {
				const a2 = b2 || T.chain.turbo;
				const turbo = on(auto, S, a2);
				if (!smallOk(turbo) || !apart(turbo, wheel)) continue;
				// AUTO LEFT OF TURBO on every window, and Turbo never above Auto where that costs little (2026-11-23: Corey's
				// chain is Auto to Turbo to Play, his Turbo 22 px lower and 38 px right of Auto; a thumb should find the
				// same key in the same place)
				if (turbo.cx < auto.cx - 0.5 || (ordered && turbo.cy < auto.cy - 0.5)) continue;
				for (const b3 of A3) {
					const a3 = b3 || T.chain.play;
					const play = on(turbo, P, a3);
					if (!inWin(play) || play.cx - play.R < plate.x1 + 2 || play.cx <= turbo.cx || !apart(play, wheel) || !apart(play, auto) || circleToBox(play, cells) < 1) continue;
					const cover = under(play);
					if (cover > T.cover + 0.5) continue;
					return { auto, turbo, play, a: [a1, a2, a3], f, cover };
				}
			}
		}
	}
	return null;
	};
	// Turbo under Auto wherever the Play then keeps its size within T.orderCost of the best chain; a window where the
	// room right of the board is too narrow for that (667 wide: 131 px, the ordered chain leaves a 52 px Play against
	// 82) folds the chain with Turbo up and to the right of Auto instead: still left to right Auto, Turbo, Play
	const inOrder = find(true);
	const anyOrder = inOrder && inOrder.f >= 1 - 1e-9 ? inOrder : find(false);
	const found = inOrder && anyOrder && inOrder.f >= anyOrder.f - T.orderCost ? inOrder : anyOrder;
	if (!found) return noSide('no chain Auto, Turbo, Play fits from the frame wheel to the right edge');
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
	if (D.menu.w * kStd < MIN_PRESS) return noSide('the column left of the board is too narrow for 44 px standards');
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
	// (2026-11-23: at 667 x 331 Win's number sat on Balance's word: there the box is no taller than its two lines. The
	// number's foot now keeps T.readGap to Balance's box; his own 874 x 402, where the box has 5 px of air under the
	// number, keeps his 2 px between the boxes)
	const winAir = winH - (T.text.label + 1 + num.win + 2);
	const readGap = Math.max(2, T.readGap - winAir);
	box.win = { x: edge, y: floor - balH - readGap - winH, w: D.win.w * kRo, h: winH };
	if (box.win.y < box.menu.y + box.menu.h + 2) return noSide('Win and Balance do not fit under the standards');
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
	// (2026-11-23: a row wherever the two press boxes and the number at the text floor fit, the arrows closer together
	// than his where the room is short. At 667 wide the amount stood over its two arrows, 78 px tall over the home
	// indicator strip: on the Manticore's chest and forelegs, and Corey accepted his feet only)
	const rowGap = Math.min(T.arrowGap * Math.min(1, s), room - MIN_PRESS);
	if (rowGap >= 4.77 * TEXT_FLOOR + 0.32 * T.arrow + 2 + 4) {
		how = 'row';
		up = { x: x1 - h2, y: yb - h2 };
		dn = { x: up.x - rowGap, y: up.y };
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
	} else return noSide('the amount with its two 44 px arrows does not fit right of the board');
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
	// (his 8.2 px word on the small gears is drawn at the text floor, 9 px, and larger with a larger gear)
	const word = Math.max(TEXT_FLOOR, (T.text.word * S.R) / matchedTo(T.small.across, T.tooth.pitch, T.tooth.height, 8).R);
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
		/** the clear px from the foot of Win's number down to Balance's box */
		winToBal: readGap + winAir,
		fitW: { win: box.win.w - 6, bal: box.bal.w - 6, amt: how === 'row' ? Math.min(amt.w - 4, up.x - dn.x - 0.32 * T.arrow - 2) : amt.w - 4 },
		text: { label: T.text.label, number: T.amt.number, bal: num.bal, win: num.win, word, spin: Math.max(TEXT_FLOOR, (T.text.spin * hubR) / hub0), spinInk: spinLine(T.text.spinInk, hubR / hub0), count: Math.max(13, (14.4 * hubR) / hub0), sub: Math.max(TEXT_FLOOR, (6.5 * hubR) / hub0), hub0 },
		scene: { boardK, plate, logo, cells },
		/** the top line's studio name (ui/ClockStrip.svelte, right side) as the dock draws it, and whether the Play covers it */
		chainTop: logo.y + logo.h * 0.965,
		/** the full chain (every key drawn) and how the drawn keys are seated in it (seatBar) */
		train: gears as Record<string, GearCircle>,
		seat: { present: ALL_PRESENT, as: { auto: 'auto', turbo: 'turbo' }, mesh: { turbo: ['play', 'auto'], auto: ['turbo', 'wheel'] }, hangers: ['menu', 'arm'] } as Seating,
	};
};

// ---- THE UPRIGHT PHONE'S RULE -----------------------------------------------------------------------------------------
// ONE RULE, exact at 402 x 874 with no safe area:
//   SCENE  the board, the Manticore and the logo over the train are ui/gear/uprightScene.ts's (2026-11-23): the shipped
//          scene, moved up until his full band is free under the plaque, and where a window is too short for that the
//          board and the train drawn at the same share of their full-width sizes. A real phone browser frame (Stake full
//          screen 440 x 742, its framed page 413 x 586) is far shorter than the phone, and the train was half size there.
//   BAND   the train stands between the spin amount plaque's shadow (its bottom edge in that scene) and the window's
//          bottom edge less the bottom safe area.
//   SCALE  k = the smallest of: the window's width over 402; the band's height over his band's; and what keeps the
//          Play gear's press region 1 px above the bottom safe area. k is 1 on his phone with no safe area.
//   GEARS  the Play gear is his 138.5 x k on the center line, its center his 69.7 x k under the band's top. The small
//          gears are his 60 by the window's WIDTH where the band lets them stand (a short window draws the Play smaller
//          than its width alone would, and has the room beside it), never over `smallShare` of the Play, never asked
//          under 46 and never under 44 px over the tips. Every gear takes the board's own tooth for this window (his
//          7.59 px pitch x this board's scale over his), so the teeth counts follow the sizes.
//   CHAIN  Turbo on the Play at his 98.9 degrees; Auto on the Play at 260, Menu on Auto at 257.5, the Armoury on Menu
//          at 352.4. Where a gear would leave the band or the window, or cross a gear it does not mesh with, its angle
//          turns toward a straight row (Auto and Menu toward 270, the Armoury down from 352.4 toward 270, Turbo toward
//          90) by the least that fits; the Armoury's angle gives first, then Menu's, then Auto's.
//   READOUTS  real text (a 9 px word over a 15 px number), ALWAYS IN THE BAND (Corey 2026-11-23: "my intent yesterday
//          was to have the Win AMount and Balance on the bottom section of the screen"; until then a short window put
//          them under the logo). His arrangement first, each checked against the gears' circles, not boxes:
//            Win      between the Armoury and the Play gear at his height, centered in the free span the two circles
//                     leave along its number's line (the number is fitted to that span, never abbreviated); where the
//                     span is under the text floor, the same place higher (on the plaque's shadow, never its plate)
//                     or a little lower; else the lowest free row at the left, the top left corner, the right
//            amount   upper right with < and >: each arrow's 44 px press box clear of every gear, at least 8 px from
//                     the Play's press region (Corey: accidental changes there are "like stealing in my eyes"), wholly
//                     inside the window; the number centered between them (< as far right as the number's own width
//                     lets it go). Else right of Turbo, the amount over its two arrows
//            Balance  lower right, 2 px under Turbo (the mock solver's own place); else the lowest free row at the
//                     right; else at the left under the chain
//          Each readout's box is never narrower than its longest US amount at the 9 px text floor (READ_MIN).
//   SEARCH the train at the band's scale with the largest small gears first; where the readouts then find no place, the
//          train alone a step smaller (it keeps its place under the plaque, so rows open under it), down to shrinkMin.
//          Nothing fits: null (the dock), and uprightWhy.last says which piece had no place.
// THE MOVES FROM HIS PLACES at 402 x 874 (the problems his export listed, solved with the smallest moves):
//   <        9.7 px right: its press box was 1.1 px into the Play's press region, now 8 px clear
//   >        5.3 px left: its 44 px press box was 5.3 px off the window's right edge
//   amount   1.5 px right: centered between the two arrows
//   Win      4.2 px right: his box's corner was 14.3 px into the Play gear and 13.6 into the Armoury; the text now
//            stands in the middle of the 80 px the two circles leave (a number wider than that span is fitted to it)
//   Balance  10.1 px down: its word met Turbo's teeth; it now starts 2 px under Turbo
//   the train itself is where he put it while the bottom safe area is 0. With one (a full screen web view on an iPhone
//   17 Pro: 34 px) the scene moves up by it and the train keeps his size on the safe area's edge.
/** the least a readout's box is ever drawn: the longest US amount (Balance and Win 6.83 em, ui/hud/hudLayout.ts VALUE_EM)
 *  at the 9 px text floor, plus the box's 6 px of side room; the amount's own number between its arrows (4.77 em) */
const READ_MIN = 68;
const AMT_FIT_MIN = 43;
export type TrainCircle = GearCircle & { parent: TrainGear | null; deg: number };
export type UprightLayout = NonNullable<ReturnType<typeof uprightSolve>>;
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

/** why the last uprightLayout() call gave no train (the dock): plain words for the node test's table and the DEV hook */
export const uprightWhy = { last: '' };
const no = (why: string): null => {
	uprightWhy.last = why;
	return null;
};
/** THE UPRIGHT PHONE'S TRAIN for a window (CSS px), or null where it does not fit (uprightWhy.last says why). The answer
 *  for his own table is kept (the canvas asks on every frame rect it derives: game/layoutSpec.ts frameFor through
 *  ui/gear/uprightSceneSource.ts), a handful of windows deep. */
const kept = new Map<string, { L: UprightLayout | null; why: string }>();
export const uprightLayout = (vw: number, vh: number, safeBottom = 0, T: UprightTable = UPRIGHT): UprightLayout | null => {
	if (T !== UPRIGHT) return uprightSolve(vw, vh, safeBottom, T);
	const key = `${vw}|${vh}|${safeBottom}`;
	const hit = kept.get(key);
	if (hit) {
		uprightWhy.last = hit.why;
		return hit.L;
	}
	const L = uprightSolve(vw, vh, safeBottom, T);
	if (kept.size >= 32) kept.delete(kept.keys().next().value as string);
	kept.set(key, { L, why: uprightWhy.last });
	return L;
};
const uprightSolve = (vw: number, vh: number, safeBottom: number, T: UprightTable) => {
	// the scene this window draws under the train (ui/gear/uprightScene.ts: the shipped scene moved up, and drawn
	// smaller with the train where the window is short), never the frame the screen happens to draw now
	uprightWhy.last = '';
	const SC = uprightScene(vw, vh, safeBottom);
	const fit = SC.fit;
	const fitTop = SC.top0;
	const B = SC.bottoms;
	const boardK = SC.boardK;
	const top = B.shadow.y1;
	const plate = B.plaque - PORTRAIT.plaqueShadowCss;
	const floor = vh - Math.max(0, safeBottom) - 1;
	const R0 = matchedTo(T.play.across, T.tooth.pitch, T.tooth.height, 8).R;
	const k = Math.min(vw / T.window.vw, (vh - top) / (T.window.vh - T.bandTop), (floor - top) / (T.play.cy + R0 - T.bandTop));
	if (!(k > 0.2)) return no('the band under the plaque is too short for any train');
	const tooth = { pitch: (T.tooth.pitch * boardK) / T.tooth.boardK, height: (T.tooth.height * boardK) / T.tooth.boardK };
	const gearOf = (across: number, min: number) => {
		let g = matchedTo(across, tooth.pitch, tooth.height, 8);
		while (2 * g.R < min) g = matchedTo(2 * g.R + tooth.pitch / 2, tooth.pitch, tooth.height, g.teeth + 1);
		return g;
	};
	const clear = T.small.clear;
	const tb = (c: { x: number; y: number }): Box => ({ x: c.x - MIN_PRESS / 2, y: c.y - MIN_PRESS / 2, w: MIN_PRESS, h: MIN_PRESS });
	// the readouts: their boxes' floor (T.readEdge), their longest labels' widths, and so the least each box is drawn
	const readFloor = vh - Math.max(0, safeBottom) - T.readEdge.bottom;
	type Label = { em: number; n: number };
	/** a long label's width at a tracking, the tracking that fits it into `avail` px (null: not even the tightest) */
	const labelW = (l: Label, track: number) => (l.em + l.n * track) * T.text.label;
	const trackFor = (l: Label, avail: number): number | null => (labelW(l, T.label.trackMin) > avail + 1e-6 ? null : Math.min(T.label.track, (avail / T.text.label - l.em) / l.n));
	const winMin = Math.max(READ_MIN, labelW(T.label.win, T.label.trackMin) + 2 * T.label.pad);
	const balMin = Math.max(READ_MIN, labelW(T.label.bal, T.label.trackMin) + 2 * T.label.pad);
	const steps = (from: number, to: number, step = 1) => {
		const out: number[] = [];
		for (let v = from; step > 0 ? v <= to + 1e-9 : v >= to - 1e-9; v += step) out.push(v);
		return out;
	};
	type Row = { down: Box; up: Box; amt: Box; fit: number; where: string };
	type Placed = { k: number; gears: Record<TrainGear, TrainCircle>; row: Row; win: Box; bal: Box; winFit: number; balFit: number; winAt: string; balAt: string; winTrack: number; balTrack: number };
	/** how far an arrangement got before it failed (the furthest one's reason is the one reported) */
	const STAGE = ['the Play gear does not fit between the plaque and the bottom edge', 'Turbo does not fit beside the Play gear', 'the chain Auto, Menu, Armoury does not fit left of the Play gear', 'the amount with its two 44 px arrows does not fit right of the Play gear', 'Balance has no free place in the band', 'Win has no free place in the band'] as const;

	/** THE TRAIN AND ITS READOUTS at scale `kk`, with small gears of `across` px: the whole arrangement, or the stage
	 *  (STAGE) it failed at */
	const attempt = (kk: number, across: number): Placed | number => {
		const P = gearOf(T.play.across * kk, 0);
		// the Play gear: on the center line, his height under the band's top; never onto the plaque's shadow, never into
		// the bottom safe area
		let cy = top + (T.play.cy - T.bandTop) * kk;
		if (cy - P.R < top - 0.2) cy = top - 0.2 + P.R;
		if (cy + P.R > floor) cy = floor - P.R;
		if (cy - P.R < top - 0.2) return 0;
		const play: TrainCircle = { cx: vw / 2, cy, R: P.R, pitchR: P.pitchR, teeth: P.teeth, parent: null, deg: 0 };
		/** his place for a point, carried with the Play gear at this scale */
		const his = (pt: readonly [number, number]) => ({ x: play.cx + (pt[0] - T.play.cx) * kk, y: play.cy + (pt[1] - T.play.cy) * kk });
		const S = gearOf(across, MIN_PRESS);
		const on = (p: TrainCircle, parent: TrainGear, a: number): TrainCircle => {
			const d = p.pitchR + S.pitchR + clear;
			return { cx: p.cx + d * Math.sin(deg(a)), cy: p.cy - d * Math.cos(deg(a)), R: S.R, pitchR: S.pitchR, teeth: S.teeth, parent, deg: a };
		};
		const inBand = (c: TrainCircle) => c.cx - c.R >= 2 && c.cx + c.R <= vw - 2 && c.cy - c.R >= top - 0.2 && c.cy + c.R <= floor;
		const apart = (a: TrainCircle, b: TrainCircle) => Math.hypot(a.cx - b.cx, a.cy - b.cy) >= a.R + b.R + 1;
		const turbo = toward(T.chain.turbo.deg, 90, 0.5).map((a) => on(play, 'play', a)).find(inBand);
		if (!turbo) return 1;
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
		if (!chain) return 2;
		const gears: Record<TrainGear, TrainCircle> = { play, turbo, ...chain };
		const all = Object.values(gears);
		const clearOf = (b: Box, gap = 1) => all.every((c) => circleToBox(c, b) >= gap);
		/** THE FREE SPAN for a box `h` tall with its top at `y`, round the point x = `near`: the x range clear of every
		 *  gear (1 px) and of the boxes already placed (2 px), inside the window. null: `near` itself is not free there. */
		const span = (y: number, h: number, near: number, taken: Box[]): [number, number] | null => {
			let x0 = T.readEdge.side;
			let x1 = vw - T.readEdge.side;
			for (const g of all) {
				const dy = g.cy < y ? y - g.cy : g.cy > y + h ? g.cy - (y + h) : 0;
				const rr = g.R + 1;
				if (dy >= rr) continue;
				const half = Math.sqrt(rr * rr - dy * dy);
				if (near <= g.cx - half) x1 = Math.min(x1, g.cx - half);
				else if (near >= g.cx + half) x0 = Math.max(x0, g.cx + half);
				else return null;
			}
			for (const t of taken) {
				if (t.y >= y + h + 2 || t.y + t.h + 2 <= y) continue;
				if (near <= t.x) x1 = Math.min(x1, t.x - 2);
				else if (near >= t.x + t.w) x0 = Math.max(x0, t.x + t.w + 2);
				else return null;
			}
			return x1 - x0 > 0 ? [x0, x1] : null;
		};
		/** a readout's box `w` x `h` in the band: the first row of `ys` (tops) with a free span of at least `min` round
		 *  one of `nears`; as wide as the span lets it be (never over w), as near to x = `want` as it can stand
		 *  (`mid`: in the middle of the span) */
		const put = (w: number, h: number, min: number, ys: number[], nears: number[], want: number | 'mid', taken: Box[]): { box: Box; fit: number } | null => {
			for (const y of ys) {
				if (y < plate + 1 || y + h > readFloor + 0.01) continue;
				for (const near of nears) {
					const sp = span(y, h, near, taken);
					if (!sp || sp[1] - sp[0] < min) continue;
					const bw = Math.min(w, sp[1] - sp[0]);
					const x = want === 'mid' ? (sp[0] + sp[1] - bw) / 2 : Math.max(sp[0], Math.min(want - bw / 2, sp[1] - bw));
					return { box: { x, y, w: bw, h }, fit: bw - 6 };
				}
			}
			return null;
		};

		// ---- the amount with < and > ----
		let row: Row | null = null;
		{
			// upper right: >'s press box flush with the window's right edge (his is 5.3 px over it), < moved right until it
			// is gapSpin clear of the Play's press region
			const u = his(T.centers.up);
			const up = tb({ x: vw - MIN_PRESS / 2, y: Math.max(u.y, plate + 1 + MIN_PRESS / 2) });
			const d = his(T.centers.down);
			let down: Box | null = null;
			// (as far right as the number between the two arrows still has its width: the fit below says)
			for (let x = d.x; x <= up.x - MIN_PRESS / 2 + 0.001; x += 0.25) {
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
				const fitW = up.x - down.x - 0.32 * T.arrow - 2;
				if (fitW >= AMT_FIT_MIN) row = { down, up, amt: { x: cx - T.box.amt.w / 2, y: Math.max(a.y, plate + 1 + T.box.amt.h / 2) - T.box.amt.h / 2, w: T.box.amt.w, h: T.box.amt.h }, fit: Math.min(fitW, T.box.amt.w - 4), where: 'upper right' };
			}
		}
		if (!row) {
			// right of Turbo: the amount over its two arrows, their press boxes side by side on the band's floor
			const right = vw - 4;
			const left = turbo.cx + turbo.R + 2;
			if (right - left >= 2 * MIN_PRESS) {
				const w = Math.min(T.box.amt.w, right - left);
				const ty = floor - MIN_PRESS;
				const up = { x: right - MIN_PRESS, y: ty, w: MIN_PRESS, h: MIN_PRESS };
				const down = { x: right - 2 * MIN_PRESS, y: ty, w: MIN_PRESS, h: MIN_PRESS };
				const amt = { x: right - w, y: ty - 1 - T.box.amt.h, w, h: T.box.amt.h };
				if (amt.y >= plate + 1 && [up, down, amt].every((b) => clearOf(b)) && circleToBox(play, down) >= T.gapSpin) row = { down, up, amt, fit: w - 4, where: 'right of Turbo' };
			}
		}
		if (!row) return 3;
		const taken: Box[] = [row.down, row.up, row.amt];
		const bh = T.box.bal.h;
		const lowLeft = Math.max(chain.menu.cy + chain.menu.R, chain.auto.cy + chain.auto.R) + 2;
		// ---- Balance: lower right, 2 px under Turbo (his place); else the lowest free row at the right; else the lowest
		// at the left, under the chain. Always in the band (Corey 2026-11-23: "my intent yesterday was to have the Win
		// AMount and Balance on the bottom section of the screen"). ----
		const hb = his(T.centers.bal);
		let balAt = 'under Turbo';
		let balPut = put(T.box.bal.w, bh, balMin, [turbo.cy + turbo.R + 2], [Math.max(turbo.cx, Math.min(hb.x, vw - 8))], hb.x, taken);
		if (!balPut) {
			balAt = 'lower right';
			balPut = put(T.box.bal.w, bh, balMin, steps(readFloor - bh, plate + 1, -2), [vw - 8], vw, taken);
		}
		if (!balPut) {
			balAt = 'lower left';
			balPut = put(T.box.bal.w, bh, balMin, steps(readFloor - bh, lowLeft, -2), [8], 0, taken);
		}
		if (!balPut) return 4;
		taken.push(balPut.box);
		// ---- Win: between the Armoury and the Play gear at his height, in the middle of the span their circles leave;
		// else the same place higher (up to the plaque's plate, on its shadow) or lower; else the lowest free row at the
		// left, under the chain; else at the right ----
		const hw = his(T.centers.win);
		const wh = T.box.win.h;
		/** his Win, its center line at `y`: the box his size, centered in the span the gears' circles leave along the
		 *  number's rows (the number is fitted to that span, never abbreviated); null where the span is under the floor */
		const hisWin = (y: number): { box: Box; fit: number } | null => {
			if (y - wh / 2 < plate + 1 || y + wh / 2 > readFloor) return null;
			let x0 = T.readEdge.side;
			let x1 = vw - T.readEdge.side;
			for (const row of [y - wh / 2 + T.text.label + 1, y + 2, y + wh / 2 - 1]) {
				for (const g of all) {
					const dy = Math.abs(row - g.cy);
					if (dy >= g.R) continue;
					const half = Math.sqrt(g.R * g.R - dy * dy);
					if (g.cx < hw.x) x0 = Math.max(x0, g.cx + half);
					else x1 = Math.min(x1, g.cx - half);
				}
			}
			if (x1 - x0 - 2 < READ_MIN - 6) return null;
			const box = { x: (x0 + x1) / 2 - T.box.win.w / 2, y: y - wh / 2, w: T.box.win.w, h: wh };
			// its longest label ("FREE SPINS WIN") is centered on the box in the word's own row: the room that row has
			// round the box's middle, clear of every gear and of what is placed, must hold it (tracked tighter if need be)
			const cx = (x0 + x1) / 2;
			const row = span(box.y, T.text.label + 2, cx, taken);
			if (!row || trackFor(T.label.win, 2 * Math.min(cx - row[0], row[1] - cx) - 2 * T.label.pad) === null) return null;
			return taken.some((t) => boxesMeet(t, { x: x0, y: box.y, w: x1 - x0, h: wh })) ? null : { box, fit: Math.min(T.box.win.w - 6, x1 - x0 - 2) };
		};
		let winAt = 'between the Armoury and the Play gear';
		let winPut: { box: Box; fit: number } | null = null;
		for (const y of [hw.y, ...steps(hw.y - 1, plate + 1 + wh / 2, -1), ...steps(hw.y + 1, hw.y + 12, 1)]) {
			winPut = hisWin(y);
			if (winPut) break;
		}
		if (!winPut) {
			winAt = 'lower left';
			winPut = put(T.box.win.w, T.box.win.h, winMin, steps(readFloor - T.box.win.h, lowLeft, -2), [8], 0, taken);
		}
		if (!winPut) {
			winAt = 'upper left';
			winPut = put(T.box.win.w, T.box.win.h, winMin, steps(plate + 1, plate + 25, 2), [8], 0, taken);
		}
		if (!winPut) {
			winAt = 'lower right';
			winPut = put(T.box.win.w, T.box.win.h, winMin, steps(readFloor - T.box.win.h, plate + 1, -2), [vw - 8], vw, taken);
		}
		if (!winPut) return 5;
		// each long label's tracking: the room its row has round the box's middle (a box the free-row search placed is
		// clear of every gear all over; his own Win box is not, its word's row is)
		const roomOf = (b: Box) => {
			const cx = b.x + b.w / 2;
			const r = span(b.y, T.text.label + 2, cx, taken.filter((t) => t !== b));
			return r ? 2 * Math.min(cx - r[0], r[1] - cx) - 2 * T.label.pad : 0;
		};
		const winTrack = trackFor(T.label.win, winAt.startsWith('between') ? roomOf(winPut.box) : winPut.box.w - 2 * T.label.pad);
		const balTrack = trackFor(T.label.bal, balPut.box.w - 2 * T.label.pad);
		if (winTrack === null || balTrack === null) return 5;
		return { k: kk, gears, row, win: winPut.box, bal: balPut.box, winFit: winPut.fit, balFit: balPut.fit, winAt, balAt, winTrack, balTrack };
	};
	// THE SEARCH. The train at the band's own scale first; where the readouts then have no free place in the band, the
	// train alone a little smaller (`shrink` a step, down to `shrinkMin` of the band's scale: it keeps its place under the
	// plaque, so rows open under it). At each scale, THE SMALL GEARS: his 60 by the window's WIDTH where the band lets
	// them stand (a short window draws the Play smaller than its width alone would, and has the room beside it), never
	// over `smallShare` of the Play, never under his 60 at the train's own scale, never under small.min; the largest
	// size whose whole arrangement fits.
	let placed: Placed | null = null;
	let stage = -1;
	for (let f = 1; f >= T.shrinkMin - 1e-9 && !placed; f -= T.shrink) {
		const kk = k * f;
		const across = T.play.across * kk;
		const sMax = Math.max(T.small.min, T.small.across * kk, Math.min(T.small.across * (vw / T.window.vw), T.smallShare * across));
		const sMin = Math.max(T.small.min, Math.min(T.small.across * kk, sMax));
		const sizes = steps(sMax, sMin, -1.5);
		if (sizes[sizes.length - 1] > sMin + 1e-6) sizes.push(sMin);
		for (const a of sizes) {
			const r = attempt(kk, a);
			if (typeof r === 'number') stage = Math.max(stage, r);
			else {
				placed = r;
				break;
			}
		}
	}
	if (!placed) return no(STAGE[Math.max(0, stage)]);
	const play = placed.gears.play;
	const { gears, row, win, bal, winFit } = placed;
	const balPut = { fit: placed.balFit };
	const { winAt, balAt } = placed;
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
		vw, vh, fit,
		/** the train's scale against his (1 at 402 x 874), and the scale the band alone would give it (larger where the
		 *  train was drawn a step smaller to give the readouts their rows) */
		k: placed.k, kBand: k,
		safeBottom, band: { top, floor, plate },
		/** the top of the bar's band under the plaque: the highest piece that is not under the logo (THE ARMOURY's menu
		 *  ends just above it, as it ends above the dock's readouts: ui/armoury/Armoury.svelte measure) */
		hudTop: Math.min(...Object.values(box).filter((b) => b.y >= plate).map((b) => b.y), ...[press.down, press.up].filter((b) => b.y >= plate).map((b) => b.y)),
		tooth,
		gears,
		/** the full train (every key drawn) and how the drawn keys are seated in it (seatBar) */
		train: gears as Record<string, GearCircle>,
		seat: { present: ALL_PRESENT, as: { auto: 'auto', menu: 'menu', arm: 'arm', turbo: 'turbo' }, mesh: { auto: ['play', 'menu'], menu: ['auto', 'arm'], arm: ['menu'], turbo: ['play'] }, hangers: [] } as Seating,
		hubR,
		box,
		press,
		/** the fit width of each readout's number; where each readout went ('band' places are his arrangement) */
		fitW: { win: winFit, bal: balPut.fit, amt: row.fit },
		/** THE LONG LABELS: the tracking (em) "FREE SPINS WIN" and "BASE AMOUNT" are drawn at here, and the box each then
		 *  takes, centered on its readout in the word's row (clear of every gear: tools/gear_layout_test.mjs) */
		label: {
			win: { track: placed.winTrack, box: { x: win.x + win.w / 2 - labelW(T.label.win, placed.winTrack) / 2, y: win.y, w: labelW(T.label.win, placed.winTrack), h: T.text.label + 2 } },
			bal: { track: placed.balTrack, box: { x: bal.x + bal.w / 2 - labelW(T.label.bal, placed.balTrack) / 2, y: bal.y, w: labelW(T.label.bal, placed.balTrack), h: T.text.label + 2 } },
		},
		where: { win: winAt, bal: balAt, amt: row.where },
		gapSpin: Math.min(circleToBox(play, row.down), circleToBox(play, row.up)),
		text: { label: T.text.label, number: T.text.number, spin: (T.text.spin * hubR) / hub0, spinInk: spinLine(T.text.spinInk, hubR / hub0), count: Math.max(15, (T.text.count * hubR) / hub0), sub: T.text.sub, hub0 },
		/** the scene under the train (ui/gear/uprightScene.ts): the board's scale, the logo's bottom edge, the frame plate's
		 *  top, and what the rule did (the common share u, the board against the shipped one, the lift, the Manticore) */
		scene: { boardK, logoBottom: SC.logo.bottom, plateTop: fitTop + registrationOf(SC.frame).map(BOARD_ART.frame.portrait.crop[0], BOARD_ART.frame.portrait.crop[1]).y * fit, u: SC.u, board: SC.board, lift: SC.lift, artTop: SC.artTop, creature: { ...SC.creature }, logo: { ...SC.logo }, shippedBand: SC.shipped.band },
	};
};

// ---- THE MIDDLE WINDOWS' ROW (2026-11-26; game/layoutSpec.ts MID) -------------------------------------------------------
// Corey's 783 x 783 and 640 x 783 (corey_placements_r2_2026-11-26.json): "controls in one row under the board: Armoury,
// Menu, Auto, Spin gear, Turbo; Win just above the left of the row; Balance bottom left, Spin amount bottom right".
// ONE RULE, for every desktop window under MID.rowUnder (1.12):
//   ORDER  the upright phone's train exactly (UPRIGHT.chain's topology, Corey 2026-11-26: "What I don't want to do is
//          move the order of the buttons"): the Play on the window's center line (the board's), Turbo meshed on its
//          right, and on its left a chain each meshed only with the next: Auto, Menu, the Armoury. Every gear takes the
//          board's own tooth for this window (UPRIGHT.tooth x this board's scale over his), as on the upright phone.
//   ANGLES his 640 x 783: Turbo on the Play at 82 degrees, Auto, Menu and the Armoury each at 275 on the one before (a
//          row rising a little to each side). Where Balance under the chain's left end or the amount's row under Turbo
//          would meet a gear, that side's angles turn up (to 300 at most) by the least that clears.
//   SIZES  the band's (layoutSpec MID.row: the Play 110 and the four small gears 64 at a 783 tall window, Corey: "should
//          be about the same size on each"), a step smaller (3 percent, down to 0.7) only where a piece has no place.
//   BAND   the Play's top 1 px under the spin amount plaque's sprite box, its bottom never under the window's edge less 4.
//   READOUTS real text, the upright phone's kind (a word over a number), sized with the band (10 and 19 px at 783 tall,
//          never under 9 and 15): Balance at the bottom left; the amount between < and > at the bottom right (their
//          44 px press boxes, never within gapSpin of the Play's press region); Win left of the plaque over the chain's
//          left end (his place), else over Balance.
// The scene over it (the board, the logo at the top left, the Manticore on the floor or perched) is layoutSpec MID's.
export const MID_ROW = {
	chain: { turbo: 82, auto: 275, menu: 275, arm: 275 },
	/** how far the chain's angles may turn up to clear a readout, degrees from the row's own */
	tiltMax: 25,
	clear: 0.6,
	/** gears and readouts stay this far inside the window (CSS px); a readout's box this far over the bottom edge */
	edge: 4,
	read: { side: 6, bottom: 6 },
	text: { label: 10, number: 19, labelMin: 9, numberMin: 15 },
	arrow: 26.67,
	gapSpin: 8,
	shrinkMin: 0.7,
} as const;
export type MidRowLayout = NonNullable<ReturnType<typeof midRowSolve>>;
export const midWhy = { last: '' };
const midKeptRow = new Map<string, MidRowLayout>();
/** THE ROW for a desktop window under MID.rowUnder (CSS px). Always an answer: where even the smallest step leaves a
 *  piece without its place, that step is drawn and midWhy.last says what is out of place (the node test fails on it). */
export const midRowLayout = (vw: number, vh: number): MidRowLayout => {
	const key = `${Math.round(vw * 100)}|${Math.round(vh * 100)}`;
	const hit = midKeptRow.get(key);
	if (hit) return hit;
	const L = midRowSolve(vw, vh);
	if (midKeptRow.size >= 32) midKeptRow.delete(midKeptRow.keys().next().value as string);
	midKeptRow.set(key, L);
	return L;
};
const midRowSolve = (vw: number, vh: number) => {
	midWhy.last = '';
	const V = midView(vw, vh);
	const T = MID_ROW;
	const U = UPRIGHT;
	const train = V.train ?? { play: 110, small: 64, band: 122, k: 1 };
	const boardK = registrationOf(V.frame).m * V.fit;
	const tooth = { pitch: (U.tooth.pitch * boardK) / U.tooth.boardK, height: (U.tooth.height * boardK) / U.tooth.boardK };
	const gearOf = (across: number, min: number) => {
		let g = matchedTo(across, tooth.pitch, tooth.height, 8);
		while (2 * g.R < min) g = matchedTo(2 * g.R + tooth.pitch / 2, tooth.pitch, tooth.height, g.teeth + 1);
		return g;
	};
	const top = V.plaque.y + V.plaque.h;
	const plate = V.plaque.y;
	const k = train.k;
	const text = { label: Math.max(T.text.labelMin, T.text.label * k), number: Math.max(T.text.numberMin, T.text.number * k) };
	const boxH = text.label + 1 + text.number + 4;
	const readW = Math.max(READ_MIN, 6.83 * text.number + 6);
	const amtW = 4.77 * text.number + 6;
	const tb = (c: { x: number; y: number }): Box => ({ x: c.x - MIN_PRESS / 2, y: c.y - MIN_PRESS / 2, w: MIN_PRESS, h: MIN_PRESS });
	type Try = { gears: Record<TrainGear, TrainCircle>; box: Record<'win' | 'bal' | 'amt', Box>; down: Box; up: Box; winAt: string; f: number; bad: string };
	const attempt = (f: number): Try => {
		const P = gearOf(train.play * f, 0);
		const S = gearOf(Math.max(U.small.min, train.small * f), MIN_PRESS);
		let cy = top + 1 + P.R;
		if (cy + P.R > vh - T.edge) cy = vh - T.edge - P.R;
		const play: TrainCircle = { cx: vw / 2, cy, R: P.R, pitchR: P.pitchR, teeth: P.teeth, parent: null, deg: 0 };
		const on = (p: TrainCircle, parent: TrainGear, a: number): TrainCircle => {
			const d = p.pitchR + S.pitchR + T.clear;
			return { cx: p.cx + d * Math.sin(deg(a)), cy: p.cy - d * Math.cos(deg(a)), R: S.R, pitchR: S.pitchR, teeth: S.teeth, parent, deg: a };
		};
		const inWin = (c: TrainCircle) => c.cx - c.R >= T.edge && c.cx + c.R <= vw - T.edge && c.cy + c.R <= vh - T.edge && c.cy - c.R >= plate;
		// the readouts at the bottom: Balance at the left, the amount between its arrows at the right
		const bal: Box = { x: T.read.side, y: vh - T.read.bottom - boxH, w: readW, h: boxH };
		const rowY = vh - T.read.bottom - MIN_PRESS / 2;
		const up = tb({ x: vw - T.read.side - MIN_PRESS / 2, y: rowY });
		const down = tb({ x: up.x - amtW - MIN_PRESS / 2, y: rowY });
		const amt: Box = { x: down.x + MIN_PRESS, y: vh - T.read.bottom - boxH, w: amtW, h: boxH };
		const clearOf = (c: TrainCircle, b: Box, gap = 1) => circleToBox(c, b) >= gap;
		// Turbo: his angle, turned up until the amount's row is clear of it
		let turbo: TrainCircle | null = null;
		for (const a of toward(T.chain.turbo, T.chain.turbo - T.tiltMax, 1)) {
			const c = on(play, 'play', a);
			if (inWin(c) && [down, up, amt].every((b) => clearOf(c, b))) {
				turbo = c;
				break;
			}
		}
		// the chain: his angles, turned up together until Balance is clear of it
		let chain: { auto: TrainCircle; menu: TrainCircle; arm: TrainCircle } | null = null;
		for (const a of toward(T.chain.auto, T.chain.auto + T.tiltMax, 1)) {
			const auto = on(play, 'play', a);
			const menu = on(auto, 'auto', a);
			const arm = on(menu, 'menu', a);
			const all = [auto, menu, arm];
			if (all.every(inWin) && all.every((c) => clearOf(c, bal)) && Math.hypot(menu.cx - play.cx, menu.cy - play.cy) >= menu.R + play.R + 1) {
				chain = { auto, menu, arm };
				break;
			}
		}
		const fallback = { auto: on(play, 'play', T.chain.auto), menu: on(on(play, 'play', T.chain.auto), 'auto', T.chain.menu), arm: on(on(on(play, 'play', T.chain.auto), 'auto', T.chain.menu), 'menu', T.chain.arm) };
		const gears: Record<TrainGear, TrainCircle> = { play, turbo: turbo ?? on(play, 'play', T.chain.turbo), ...(chain ?? fallback) };
		let bad = !turbo ? 'the amount\'s row meets Turbo' : !chain ? 'Balance meets the chain, or the chain leaves the window' : '';
		if (!bad && (circleToBox(play, down) < T.gapSpin || circleToBox(play, up) < T.gapSpin)) bad = 'an arrow within 8 px of the Play';
		if (!bad && (down.x < bal.x + bal.w + 2 || [down, up, amt].some((b) => !clearOf(play, b)))) bad = 'the amount\'s row meets Balance or the Play';
		// Win: left of the plaque, standing on the chain's left end (his place); else over Balance at the left
		const G = Object.values(gears);
		const winRight = Math.min(V.plaque.x - 4, play.cx - play.R - 2);
		let win: Box | null = null;
		let winAt = 'left of the plaque, over the chain';
		const w = Math.min(readW, winRight - T.read.side);
		if (w >= READ_MIN) {
			const x = Math.max(T.read.side, (T.read.side + winRight - w) / 2);
			const under = G.filter((c) => c.cx + c.R > x && c.cx - c.R < x + w).map((c) => c.cy - Math.sqrt(Math.max(0, c.R * c.R - Math.max(0, Math.max(x - c.cx, c.cx - (x + w))) ** 2)));
			const y = Math.max(plate + 1, Math.min(...under, bal.y) - 2 - boxH);
			const b = { x, y, w, h: boxH };
			if (G.every((c) => clearOf(c, b)) && !boxesMeet(b, bal)) win = b;
		}
		if (!win) {
			winAt = 'over Balance';
			const b = { x: T.read.side, y: bal.y - 2 - boxH, w: readW, h: boxH };
			if (b.y >= plate + 1 && G.every((c) => clearOf(c, b))) win = b;
		}
		if (!win) {
			win = { x: T.read.side, y: bal.y - 2 - boxH, w: readW, h: boxH };
			bad ||= 'Win has no place clear of the gears';
		}
		return { gears, box: { win, bal, amt }, down, up, winAt, f, bad };
	};
	let best: Try | null = null;
	for (let f = 1; f >= T.shrinkMin - 1e-9; f -= 0.03) {
		const t = attempt(f);
		if (!best) best = t;
		if (!t.bad) {
			best = t;
			break;
		}
		best = t;
	}
	const placed = best as Try;
	midWhy.last = placed.bad;
	const { gears } = placed;
	const play = gears.play;
	const box = { ...placed.box } as Record<Piece, Box>;
	const press = {} as Record<Piece, Box>;
	press.down = placed.down;
	press.up = placed.up;
	for (const id of ['down', 'up'] as const) {
		const t = press[id];
		box[id] = { x: t.x + (t.w - T.arrow) / 2, y: t.y + (t.h - T.arrow) / 2, w: T.arrow, h: T.arrow };
	}
	for (const id of ['play', 'auto', 'turbo', 'menu', 'arm'] as const) {
		const c = gears[id];
		box[id] = press[id] = { x: c.cx - c.R, y: c.cy - c.R, w: 2 * c.R, h: 2 * c.R };
	}
	for (const id of ['win', 'bal', 'amt'] as const) press[id] = box[id];
	const hubR = play.R * U.play.hub;
	const hub0 = matchedTo(U.play.across, U.tooth.pitch, U.tooth.height, 8).R * U.play.hub;
	// THE LONG LABELS (FREE SPINS WIN, BASE AMOUNT) tracked as tight as the box needs (the upright phone's rule)
	const labelW = (l: { em: number; n: number }, track: number) => (l.em + l.n * track) * text.label;
	const trackFor = (l: { em: number; n: number }, avail: number) => Math.max(U.label.trackMin, Math.min(U.label.track, (avail / text.label - l.em) / l.n));
	const winTrack = trackFor(U.label.win, box.win.w - 2 * U.label.pad);
	const balTrack = trackFor(U.label.bal, box.bal.w - 2 * U.label.pad);
	const fit = { win: box.win.w - 6, bal: box.bal.w - 6, amt: Math.min(box.amt.w - 4, press.up.x - press.down.x - 0.32 * T.arrow - 2) };
	return {
		table: 'mid' as const,
		vw, vh, fit: V.fit,
		/** the train's scale against the band's sizes (1: MID.row's sizes x k), and the band's own k */
		k: placed.f, kBand: k,
		safeBottom: 0,
		band: { top, floor: vh, plate },
		/** the top of the bar (THE ARMOURY's tablet and portrait layouts end above it: ui/armoury/Armoury.svelte measure) */
		hudTop: Math.min(box.win.y, ...Object.values(gears).map((c) => c.cy - c.R)),
		tooth,
		gears,
		train: gears as Record<string, GearCircle>,
		seat: { present: ALL_PRESENT, as: { auto: 'auto', menu: 'menu', arm: 'arm', turbo: 'turbo' }, mesh: { auto: ['play', 'menu'], menu: ['auto', 'arm'], arm: ['menu'], turbo: ['play'] }, hangers: [] } as Seating,
		hubR,
		box,
		press,
		fitW: fit,
		label: {
			win: { track: winTrack, box: { x: box.win.x + box.win.w / 2 - labelW(U.label.win, winTrack) / 2, y: box.win.y, w: labelW(U.label.win, winTrack), h: text.label + 2 } },
			bal: { track: balTrack, box: { x: box.bal.x + box.bal.w / 2 - labelW(U.label.bal, balTrack) / 2, y: box.bal.y, w: labelW(U.label.bal, balTrack), h: text.label + 2 } },
		},
		where: { win: placed.winAt, bal: 'bottom left', amt: 'bottom right' },
		gapSpin: Math.min(circleToBox(play, press.down), circleToBox(play, press.up)),
		text: { label: text.label, number: text.number, spin: (U.text.spin * hubR) / hub0, spinInk: spinLine(U.text.spinInk, hubR / hub0), count: Math.max(15, (U.text.count * hubR) / hub0), sub: Math.max(TEXT_FLOOR, (U.text.sub * hubR) / hub0), hub0 },
		/** the scene over the row (game/layoutSpec.ts MID): the board's scale, its art and plaque boxes, the band, perched or not */
		scene: { boardK, art: { ...V.art }, plaque: { ...V.plaque }, perch: V.perch, band: V.band, r: V.r, logo: V.logo ? { ...V.logo } : null },
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
