// THE SIGN PANELS' PLACES (2026-11-23; the mock menus_r1_2026-11-23's own rules, mock.js placeMenu and render). Pure
// numbers, no page: tools/sign_panel_test.mjs runs them over every window the game is checked at.
//
// THE MENU POP-OUT is drawn 296 px wide at its own scale: the bar's scale, never under 1 (so none of its words is
// under its CSS size: the old panel drew 10 px words at 8.3 px at 1200 x 675), and never so large that it would leave
// the window. It stands over the Menu key where there is room (the desktop), under it where the key is at the top
// (upright), beside it otherwise (a phone held sideways, the two mini players).
//   touch  a phone or a tablet layout, or a coarse pointer: every press box 44 px (the pills, the sliders, the mute keys)
//   tight  a window under 300 px tall (Stake's Popout S, 400 x 225): the mouse sizes with smaller gaps, so the panel
//          fits there at its full size
import type { Box } from './signLayout';

export type PanelInsets = { t: number; r: number; b: number; l: number };

/** the menu's own px (the mock's mock.css): its width, the band, and per size class the padding, the gap between
 *  rows, the pills' and the sliders' rows */
export const MENU_PANEL = {
	w: 296,
	band: 4,
	info: 44,
	label: 10,
	labelGap: 6,
	/** the operator's readouts (RTP, NET, TIME), where the jurisdiction asks for them: one line under the sliders */
	session: 16,
	mouse: { pad: 11, gap: 9, pill: 34, row: 40, mute: 40, slider: 22 },
	touch: { pad: 11, gap: 7, pill: 44, row: 48, mute: 44, slider: 44 },
	tight: { pad: 8, gap: 5, pill: 34, row: 40, mute: 40, slider: 22 },
	/** the least clear ground between the panel and the window's edge, and between the panel and the Menu key (x its scale) */
	edge: { x: 8, y: 6 },
	keyGap: 8,
	/** a window under this many CSS px tall is `tight` */
	tightUnder: 300,
} as const;

export type MenuClass = 'mouse' | 'touch' | 'tight';
export const menuClass = (o: { kind: 'landscape' | 'phone' | 'portrait'; vh: number; coarse: boolean }): MenuClass =>
	o.vh < MENU_PANEL.tightUnder ? 'tight' : o.kind !== 'landscape' || o.coarse ? 'touch' : 'mouse';

/** the panel's height in its own px: the band and the padding, GAME INFO, the Scene row (its word over the pills),
 *  MUSIC and EFFECTS, the operator's line where shown */
export const menuPanelHeight = (cls: MenuClass, session: boolean) => {
	const M = MENU_PANEL;
	const C = M[cls];
	const rows = [M.info, M.label + M.labelGap + C.pill, C.row, C.row, ...(session ? [M.session] : [])];
	return 2 * (M.band + C.pad) + rows.reduce((a, b) => a + b, 0) + (rows.length - 1) * C.gap;
};

export type MenuPlace = {
	/** the panel's top left corner and its drawn size, CSS px */
	x: number;
	y: number;
	w: number;
	h: number;
	/** CSS px per panel px */
	k: number;
	/** the panel's own height, panel px */
	H: number;
	where: 'over' | 'under' | 'beside';
};

/** where the Menu pop-out stands. `menu` is the Menu key's box (CSS px), `u` the bar's scale */
export const menuPanelPlace = (o: { menu: Box; u: number; vw: number; vh: number; safe?: PanelInsets; cls: MenuClass; session: boolean }): MenuPlace => {
	const M = MENU_PANEL;
	const s = o.safe ?? { t: 0, r: 0, b: 0, l: 0 };
	const H = menuPanelHeight(o.cls, o.session);
	const x0 = s.l + M.edge.x;
	const x1 = o.vw - s.r - M.edge.x;
	const y0 = s.t + M.edge.y;
	const y1 = o.vh - s.b - M.edge.y;
	// the bar's scale, never under 1; never larger than the window holds
	const k = Math.max(0.1, Math.min(Math.max(1, o.u), (y1 - y0) / H, (x1 - x0) / M.w));
	const w = M.w * k;
	const h = H * k;
	const gap = M.keyGap * k;
	const m = o.menu;
	const clampX = (x: number) => Math.max(x0, Math.min(x, x1 - w));
	const clampY = (y: number) => Math.max(y0, Math.min(y, y1 - h));
	if (m.y - gap - h >= y0) return { x: clampX(m.x), y: m.y - gap - h, w, h, k, H, where: 'over' };
	if (m.y + m.h + gap + h <= y1) return { x: clampX(m.x + m.w - w), y: m.y + m.h + gap, w, h, k, H, where: 'under' };
	return { x: clampX(m.x + m.w + gap), y: clampY(m.y + m.h / 2 - h / 2), w, h, k, H, where: 'beside' };
};

// THE AUTOPLAY CARD'S SIZE CLASS (the mock's render, and the windows it did not show): a sheet from the bottom upright;
// a wide two column card on a phone held sideways (the amount stepper rides in its head row); on a desktop window under
// 760 px tall (Stake's 1200 x 675) the `short` card: the two switches side by side and lower tiles, so the open STOP
// OPTIONS fit with no scroll. The short card with its stepper is 666 px tall with STOP OPTIONS open, so a desktop
// window under 670 (Stake's 1024 x 576) takes the wide card, which is 370.
//   coarse  a touch screen on a desktop layout: the 44 px press boxes make the open short card 34 px taller
//   drop    the line that says START unloads a loaded feature is showing: one more row (32 px)
export const AUTO = { deskFrom: 760, shortFrom: 670, coarse: 34, drop: 32 } as const;
export type AutoClass = 'desk' | 'short' | 'portrait' | 'wide';
export const autoClass = (o: { compact: boolean; portrait: boolean; vh: number; coarse?: boolean; drop?: boolean }): AutoClass => {
	if (o.compact) return o.portrait ? 'portrait' : 'wide';
	const more = (o.coarse ? AUTO.coarse : 0) + (o.drop ? AUTO.drop : 0);
	if (o.vh < AUTO.shortFrom + more) return 'wide';
	return o.vh < AUTO.deskFrom + (o.drop ? AUTO.drop : 0) ? 'short' : 'desk';
};

// THE AUTOPLAY CARD'S WIDTHS (ui/AutoplayModal.svelte's style block, mirrored): the card, its side padding, its
// columns and a count tile's text box, CSS px. The card's fits measure against these (a tile's price line, the total,
// START's words), and tools/sign_panel_test.mjs holds every tile's price line against them at the windows
// fast_lane_probe's small sizes section opens.
//   low     the sideways card at Popout S height (400 x 225: `wide` and `tiny` together; the small sizes fix of
//           2026-11-22): the card as wide as the window less 8, columns 1.25 : 1 with a 10 px gap
//   narrow  a wide card under 642 px (the small sideways phones: 568 x 320, 667 x 375), where six limit chips to a row
//           would be under 44 px wide: LOW's own column split (1.25 : 1, so every tile keeps its price line), the limit
//           chips three to a row, START's words over its amount
//   stack   START's words stand over its amount (LOW and narrow): the right column is too narrow for one line
//   tgRow   the two switches side by side: the short desktop card, and the wide card where its right column has the
//           room for their words (the mock's 760 px card: "Stop on Free Games" is 109 px at 11.5 px)
export const autoGeometry = (o: { cls: AutoClass; vw: number; tiny: boolean }) => {
	const wide = o.cls === 'wide';
	const low = wide && o.tiny;
	const wideW = Math.min(760, (o.vw - 10) * 0.94);
	const narrow = wide && !low && wideW < 642;
	const panelW = low ? o.vw - 8 : o.cls === 'portrait' ? Math.min(412, o.vw) : wide ? (narrow ? Math.min(760, (o.vw - 10) * 0.96) : wideW) : Math.min(480, (o.vw - 12) * 0.94);
	const padX = o.tiny ? 10 : o.cls === 'portrait' || wide ? 14 : 18;
	/** inside the card's 4 px band and its side padding */
	const innerW = panelW - 2 * padX - 8;
	/** LOW's two columns together: the inside less the 10 px column gap */
	const lowInner = innerW - 10;
	const c1W = low ? (lowInner * 1.25) / 2.25 : wide ? (innerW - 18) * (narrow ? 1.25 / 2.25 : 0.5) : innerW;
	const c2W = low ? lowInner / 2.25 : wide ? innerW - 18 - c1W : innerW;
	const tileGap = low ? 5 : o.cls === 'portrait' ? 7 : wide ? 6 : 8;
	/** a tile's text box: the column less three gaps, over four tiles, less the tile's side padding (3 px, 2 in LOW) and line */
	const chipW = (c1W - 3 * tileGap) / 4 - (low ? 4 : 6) - 3.2;
	const tgRow = o.cls === 'short' || (wide && !low && c2W >= 349);
	return { wide, low, narrow, stack: low || narrow, panelW, padX, innerW, lowInner, c1W, c2W, tileGap, chipW, tgRow, subNominal: low ? 8 : 10 };
};
/** a tile's price line never draws under this share of its nominal size: it goes (or "until stopped" takes two lines) */
export const AUTO_SUB_MIN = 0.9;

// THE PRESS SCREEN'S SCENE PANEL (ui/LandingScreen.svelte): a small sign panel at the window's bottom left corner, in
// the dock frame's own px (ui/hud/hudLayout.ts hudFrame gives the variant and the scale `u`). Its box per variant, its
// distance from the window's edges, and its place.
// CLEAR OF THE LED STRIP (2026-11-23, the probe host at 568 x 320: the panel's right edge lay a few px over the strip's
// left end, where its words start). Where the strip stands in the panel's rows and the panel would reach it, the panel
// is drawn narrower (its pills with it; its scale and its height stay), so `clear` CSS px of ground stay between them.
export const SCENE_PICK = {
	desktop: { w: 236, h: 70, cls: '' },
	tablet: { w: 200, h: 64, cls: 'nar' },
	portrait: { w: 236, h: 70, cls: '' },
	landscape: { w: 196, h: 64, cls: 'nar' },
	/** from the window's left and bottom edges: this many panel px, never under `edge` CSS px past a safe inset */
	gap: 10,
	edge: 6,
	/** the least clear ground between the panel and the LED strip, CSS px */
	clear: 4,
	/** the panel is never narrower than this, in its own px (three pills that still hold their words) */
	minW: 150,
} as const;
export type ScenePickVariant = 'desktop' | 'tablet' | 'portrait' | 'landscape';
export const scenePickPlace = (o: { variant: ScenePickVariant; u: number; vw: number; vh: number; safe?: PanelInsets; strip?: Box | null }) => {
	const P = SCENE_PICK;
	const pick = P[o.variant];
	const s = o.safe ?? { t: 0, r: 0, b: 0, l: 0 };
	const x = Math.max(P.gap * o.u, s.l + P.edge);
	const y = o.vh - pick.h * o.u - Math.max(P.gap * o.u, s.b + P.edge);
	let w: number = pick.w;
	const st = o.strip;
	// the strip in the panel's rows, to its right, and nearer than the clear ground: the panel gives way
	if (st && st.x > x && y < st.y + st.h && y + pick.h * o.u > st.y && x + w * o.u > st.x - P.clear) w = Math.max(P.minW, (st.x - P.clear - x) / o.u);
	return { x, y, u: o.u, w, h: pick.h, cls: pick.cls };
};
