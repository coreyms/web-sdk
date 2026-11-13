// THE HUD'S GEOMETRY (HUD round 5, "Drop 6": Desktop/u1.js in images/hud_round5_2026-11-12, approved 2026-11-12).
//
// UNITS. The mockup was drawn in CSS px on five stills: portrait 390 x 844, landscape phone 844 x 390, tablet 1180 x
// 820, desktop 1440 x 810, wide 1920 x 810. Here those numbers are "mock px", kept verbatim, and the HUD is drawn in
// planes that span the WHOLE VIEWPORT in mock px (W x H), scaled by u = CSS px per mock px. u comes from the chrome's
// own fit scale, so at a mock's still u is exactly 1 (every number lands on the mock's pixel) and on any other screen
// the HUD scales with the board exactly as the old chrome did:
//   desktop   u = fit / 1.125    (the 1280 x 720 master shown at 1440 x 810); wide is the same rule (W = 1920)
//   tablet    u = fit / 0.921875 (the master at 1180 x 820) - the desktop layout on a screen that draws the master
//             smaller than 1:1 (fit < 1): bigger keys and a wider dock, so the controls keep their touch size
//   portrait  u = fit / 0.946602 (the 412 master at 390 px wide); on a portrait TABLET u is capped so the Spin stays
//             under the spin amount plaque and the readouts under the frame art (the board is bigger there)
//   landscape u = fit / 0.527027 (the 1480 x 740 phone master at 390 px high); anchored to the master like the board
// Bottom rows are anchored to the viewport's bottom edge, the desktop dock to its centre line (the WIN readout's
// centre IS the screen's centre), portrait keys to its side edges. Pure functions: the chromes, the SKIP button and
// the probes' own copies of these numbers all read the same rules.
import { MASTER, type LayoutKind, frameArtRect, frameFor, registrationOf, portraitShippedK } from '../../game/layoutSpec';
import { BOARD_PLAQUE_SPEC } from '../../game/boardPlaqueSpec';
import { BOARD_ART } from '../../game/boardArtSpec';

export type HudVariant = 'desktop' | 'tablet' | 'portrait' | 'landscape';
export type Insets = { t: number; r: number; b: number; l: number };
export type HudView = { kind: LayoutKind; phone: boolean; vw: number; vh: number; safe?: Insets };

/** mock px per master px at each mock's still (= the chrome's fit scale there) */
export const MOCK_K: Record<HudVariant, number> = { desktop: 1.125, tablet: 1180 / 1280, portrait: 390 / 412, landscape: 390 / 740 };

const r2 = (v: number) => Math.round(v * 100) / 100;

/** the chrome's fit (ui/Chrome.svelte): scale, the fit frame's left and top in CSS px */
export const chromeFit = (kind: LayoutKind, vw: number, vh: number) => {
	const M = MASTER[kind];
	const scale = Math.min(vw / M.width, vh / M.height);
	const fitWidth = kind === 'portrait' ? Math.max(M.width, vw / scale) : M.width;
	return { scale, fitWidth, fitLeft: (vw - fitWidth * scale) / 2, top: (vh - M.height * scale) / 2 };
};

export const hudVariant = (kind: LayoutKind, scale: number): HudVariant =>
	kind === 'portrait' ? 'portrait' : kind === 'phone' ? 'landscape' : scale < 1 ? 'tablet' : 'desktop';

// ---- the portrait stack, mock px above the Spin's bottom edge (u1 portrait: Spin bottom 808 on the 844 still) ----
export const PORTRAIT = {
	/** the gap under the Spin: the mock's (36 = its 34 px home-indicator band + 2) on a tall phone, less elsewhere */
	gapTall: 36,
	gapShort: 10,
	gapTablet: 14,
	/** a phone at least this tall for its width has a home indicator (every 19.5:9 phone) */
	tallRatio: 1.9,
	spinD: 92,
	/** the stack above the Spin's bottom: Spin top 92, WIN label top 118 */
	winTop: 118,
	balTop: 88,
	stepY: 75,
	keyY: 31,
	barTop: 56,
	barBottom: 6,
	spinCy: 46,
	/** portrait tablet: the Spin this far under the plaque, the readouts this far under the art (CSS px) */
	plaqueClear: 8,
	plaqueShadowCss: 3.5,
	artClear: 4,
	/** never smaller than this on a tablet, on a phone */
	uMin: 0.8,
	uMinPhone: 0.68,
	/** the readouts may sit this much under the mock's place (mock px; BALANCE then still clears the bar) */
	readDropMax: 4,
	/** a tall phone's band under the Spin gives up to this much (it keeps gapMin) */
	gapMin: 30,
};

/** the spin amount plaque's bottom (its soft shadow's, the lowest thing it draws) and the frame art's bottom on a portrait
 *  screen, CSS px: the board's own numbers (game/layoutSpec.ts frameFor, the plaque spec components/BoardPlaque.svelte
 *  picks: the tablet numbers once the shipped growth is past 1) */
export const portraitBoardBottoms = (vw: number, vh: number) => {
	const f = chromeFit('portrait', vw, vh);
	const vwm = vw / f.scale;
	const art = frameArtRect('portrait', vwm);
	const reg = registrationOf(frameFor('portrait', vwm));
	const box = BOARD_PLAQUE_SPEC.layouts[portraitShippedK(vwm) > 1 ? 'portraitTablet' : 'portrait'].render.plaqueBox as readonly number[];
	const plaque = art.bottom + (box[1] + box[3] - BOARD_ART.art[3]) * reg.m;
	// the plaque's soft shadow as drawn reaches PORTRAIT.plaqueShadowCss under its plate (2.7 CSS px measured at 390 x 844;
	// the spec's shadowBox is the padded sprite, about 6 px)
	return { art: f.top + art.bottom * f.scale, plaque: f.top + plaque * f.scale + PORTRAIT.plaqueShadowCss };
};

/** what a chrome needs to draw its planes: the variant, u, the plane in mock px, the plane's transform inside .fit */
export const hudFrame = (v: HudView) => {
	const fit = chromeFit(v.kind, v.vw, v.vh);
	const variant = hudVariant(v.kind, fit.scale);
	let u = fit.scale / MOCK_K[variant];
	const safe = v.safe ?? { t: 0, r: 0, b: 0, l: 0 };
	let gap = 0;
	/** portrait: how far the readouts (WIN, BALANCE, the amount) sit under the mock's place, to clear the plaque */
	let drop = 0;
	if (variant === 'portrait') {
		const P = PORTRAIT;
		const B = portraitBoardBottoms(v.vw, v.vh);
		gap = v.phone ? (v.vh / v.vw >= P.tallRatio ? P.gapTall : P.gapShort) : P.gapTablet;
		gap = Math.max(gap, safe.b / u + 2);
		if (!v.phone) {
			const room = Math.min((v.vh - B.plaque - P.plaqueClear) / (gap + P.spinD), (v.vh - B.art - P.artClear) / (gap + P.winTop));
			u = Math.max(P.uMin, Math.min(u, room));
		} else {
			// THE PLAQUE (Drop 6 puts WIN's label on the plaque's lower edge, at 390 x 844): the readouts keep 1 CSS px under
			// the plaque's shadow. They drop up to readDropMax mock px first (the stack still clears the bar), then a tall
			// phone's home-indicator band gives up to gapGive, then the HUD scales down; the Spin always stays plaqueClear
			// under it
			const need = (B.plaque + 1 - (v.vh - (gap + P.winTop) * u)) / u;
			drop = Math.min(Math.max(0, need), P.readDropMax);
			const give = Math.min(Math.max(0, need - drop), Math.max(0, gap - P.gapMin));
			gap -= give;
			const roomRead = (v.vh - B.plaque - 1) / (gap + P.winTop - drop);
			const roomSpin = (v.vh - B.plaque - P.plaqueClear) / (gap + P.spinD);
			u = Math.max(P.uMinPhone, Math.min(u, roomRead, roomSpin));
		}
	}
	const W = v.vw / u;
	const H = v.vh / u;
	// the plane's top left is the viewport's; inside .fit (master px, origin at fitLeft / top) that is -fitLeft / scale
	const transform = `translate(${-fit.fitLeft / fit.scale}px, ${-fit.top / fit.scale}px) scale(${u / fit.scale})`;
	return { variant, u, W, H, gap, drop, fit, transform, safe };
};
export type HudFrame = ReturnType<typeof hudFrame>;

// ---- the desktop / tablet dock (Side Stepper, WIN on the centre line) ----
const BAR = {
	desktop: { k: 52, armW: 132, winW: 190, g: 38, balW: 178, amtW: 106, sk: 32, y0: 73, y1: 15, n: { cy: 55, r: 44, R: 49, f: 7 }, skip: { dx: 222, y: 111, w: 80, h: 32 }, panel: { w: 272, h: 176, nar: false } },
	tablet: { k: 50, armW: 108, winW: 180, g: 24, balW: 212, amtW: 100, sk: 32, y0: 74, y1: 20, n: { cy: 63, r: 39, R: 44, f: 7 }, skip: { dx: 213, y: 116, w: 80, h: 32 }, panel: { w: 178, h: 158, nar: true } },
};
export type Circle = { cx: number; cy: number; r: number; R: number; f: number; Rb?: number };

const notchHalf = (y0: number, n: Circle) => {
	const Fy = y0 - n.f;
	const dy = n.cy - Fy;
	const D = n.R + n.f;
	return dy < D ? Math.sqrt(D * D - dy * dy) : n.R;
};

/** the dock, placed outward from the screen's centre line (u1 barGeo) */
export const desktopGeo = (f: HudFrame, artLeftMock: number) => {
	const L = BAR[f.variant === 'tablet' ? 'tablet' : 'desktop'];
	const c = f.W / 2;
	const y0 = f.H - L.y0;
	const y1 = f.H - L.y1;
	const cy = (y0 + y1) / 2;
	const g = L.g;
	const k = L.k;
	const S = 2 * L.sk + 8 + L.amtW;
	const winL = c - L.winW / 2;
	const winR = c + L.winW / 2;
	const hl1 = winL - g - 1;
	const hl2 = winR + g;
	const balR = hl1 - g;
	const balL = balR - L.balW;
	const hl0 = balL - g - 1;
	const menuL = hl0 - g - k;
	const armL = menuL - 8 - L.armW;
	const x0 = armL - 7;
	const stL = hl2 + 1 + g;
	const stR = stL + S;
	const hl3 = stR + g;
	const autoL = hl3 + 1 + g;
	const turboL = autoL + k + 8;
	const cr = turboL + k;
	const n0: Circle = { cx: 0, cy: f.H - L.n.cy, r: L.n.r, R: L.n.R, f: L.n.f };
	const cx = r2(cr + 8 + notchHalf(y0, n0));
	const n: Circle = { ...n0, cx };
	const kt = cy - k / 2;
	const mcx = menuL + k / 2;
	const P = L.panel;
	const pr = Math.min(artLeftMock - 8, mcx + 24);
	const pl = Math.max(8, pr - P.w);
	const panelH = P.h;
	return {
		L, c, y0, y1, cy, k, kt, x0, xr: cx + n.R, n,
		arm: { x: armL, y: kt, w: L.armW, h: k },
		menu: { x: menuL, y: kt, d: k },
		// (the mock's boxes are 42 tall; 40 keeps them off the plaque's soft shadow on the 16:9 screens)
		bal: { x: balL, y: cy - 20, w: L.balW, h: 40 },
		win: { x: winL, y: cy - 20, w: L.winW, h: 40 },
		minus: { x: stL, y: cy - L.sk / 2, d: L.sk },
		amt: { x: stL + L.sk + 4, y: cy - 20, w: L.amtW, h: 40 },
		plus: { x: stR - L.sk, y: cy - L.sk / 2, d: L.sk },
		auto: { x: autoL, y: kt, d: k },
		turbo: { x: turboL, y: kt, d: k },
		hl: [
			{ x: hl0, y: cy - 14, h: 28, wn: false },
			{ x: hl1, y: cy - 17, h: 34, wn: true },
			{ x: hl2, y: cy - 17, h: 34, wn: true },
			{ x: hl3, y: cy - 14, h: 28, wn: false },
		],
		spin: { x: cx - n.r, y: n.cy - n.r, d: n.r * 2 },
		skip: { x: c + L.skip.dx, y: f.H - L.skip.y, w: L.skip.w, h: L.skip.h },
		panel: { x: pl, w: pr - pl, h: panelH, bottom: kt - 6, tip: mcx - pl, nar: P.nar },
	};
};

// ---- portrait (Win over Balance, Drop 6) ----
export const portraitGeo = (f: HudFrame, stripBottomMock: number) => {
	const P = PORTRAIT;
	const W = f.W;
	const sb = f.H - f.gap;
	const cx = W / 2;
	const n: Circle = { cx, cy: sb - P.spinCy, r: P.spinD / 2, R: 48, Rb: 46, f: 8 };
	const keyY = sb - P.keyY;
	// the outer keys on the edges as on the mock (44 in), the inner ones the mock's share of the way to the Spin's edge
	const armX = 44;
	const menuX = armX + 0.5905 * (cx - n.r - armX);
	const bar = { x0: 8, x1: W - 8, y0: sb - P.barTop, y1: sb - P.barBottom };
	const m = 12;
	const panelBottom = n.cy - n.r - 8;
	const pw = 300;
	const pl = Math.max(8, Math.min(W - 8 - pw, menuX - 54));
	return {
		W, sb, n, bar, keyY, m,
		arm: { cx: armX, cy: keyY, d: 48 },
		menu: { cx: menuX, cy: keyY, d: 44 },
		auto: { cx: W - menuX, cy: keyY, d: 44 },
		turbo: { cx: W - armX, cy: keyY, d: 44 },
		spin: { x: cx - n.r, y: n.cy - n.r, d: P.spinD },
		win: { x: m, y: sb - P.winTop + f.drop, w: 170 },
		bal: { x: m, y: sb - P.balTop + f.drop, w: 170 },
		amt: { right: m, y: sb - P.winTop + f.drop, w: 130 },
		minus: { cx: W - 70, cy: sb - P.stepY + f.drop, d: 28 },
		plus: { cx: W - 26, cy: sb - P.stepY + f.drop, d: 28 },
		skip: { x: W - 8 - 76, y: stripBottomMock + 7, w: 76, h: 30 },
		panel: { x: pl, w: pw, h: 176, tail: 26, bottom: panelBottom, tip: menuX - pl },
	};
};

// ---- landscape phone (Win Crown, Skip squared under the Auto / Turbo capsule) ----
export const landscapeGeo = (f: HudFrame) => {
	// the mock's numbers are on the 844 x 390 still, where the master starts 32 px in; here they follow the master
	const ox = (f.fit.fitLeft) / f.u - 32;
	const oy = f.fit.top / f.u;
	const X = (x: number) => x + ox;
	const Y = (y: number) => y + oy;
	const cap = { x0: X(47), x1: X(185), y0: Y(259), y1: Y(369), rr: 18 };
	const kc = { x0: X(697), x1: X(795), y0: Y(34), y1: Y(74), rr: 20 };
	const n: Circle = { cx: X(752), cy: Y(330), r: 39, R: 39, f: 7 };
	// the capsule's inside (u1 .lcap: inset 5, 8 at the bottom): BALANCE, WIN, a hairline, the stepper row
	const ix = cap.x0 + 5;
	const iw = cap.x1 - cap.x0 - 10;
	const iy = cap.y0 + 5;
	const ib = cap.y1 - 3;
	return {
		cap, kc, n, ox, oy,
		arm: { cx: X(94), cy: Y(234), d: 34 },
		menu: { cx: X(138), cy: Y(234), d: 34 },
		auto: { cx: X(724), cy: Y(54), d: 32 },
		turbo: { cx: X(768), cy: Y(54), d: 32 },
		spin: { x: n.cx - n.r, y: n.cy - n.r, d: n.r * 2 },
		bal: { x: ix, y: iy + 2, w: iw, h: 26 },
		win: { x: ix, y: iy + 33, w: iw, h: 26 },
		hz: { x: ix + 6, y: ib - 40, w: iw - 12 },
		minus: { cx: ix + 12, cy: ib - 18, d: 24 },
		amt: { x: ix + iw / 2 - 40, y: ib - 36, w: 80, h: 36 },
		plus: { cx: ix + iw - 12, cy: ib - 18, d: 24 },
		skip: { x: kc.x0, y: Y(82), w: kc.x1 - kc.x0, h: 30 },
		panel: { x: X(47), w: 138, h: 107, top: Y(262) - 9, tip: X(94) - X(47) },
	};
};

/** THE SKIP BUTTON's box, CSS px in the viewport (components/SkipButton.svelte), by the same rules */
export const hudSkipRect = (v: HudView) => {
	const f = hudFrame(v);
	let s: { x: number; y: number; w: number; h: number };
	if (f.variant === 'portrait') {
		const strip = (f.fit.top + 28 * f.fit.scale) / f.u; // the clock strip's lower edge (layoutSpec SKIP.clockBottom)
		s = portraitGeo(f, Math.max(strip, f.safe.t / f.u)).skip;
	} else if (f.variant === 'landscape') s = landscapeGeo(f).skip;
	else s = desktopGeo(f, 0).skip;
	return { x: s.x * f.u, y: s.y * f.u, width: s.w * f.u, height: s.h * f.u, u: f.u, variant: f.variant };
};

// ---- glass outlines (u1: every path is painted, no filters) ----
export type Outline = { top: string; bot: string; fill: string; spec: string; topStraight: [number, number, number] };

/** Shelf's terminal dock: a capsule whose right end IS the Spin circle, the edge flowing into it through two fillets */
export const outlineTerm = (s: { x0: number; y0: number; y1: number }, n: Circle): Outline => {
	const { x0, y0, y1 } = s;
	const rr = (y1 - y0) / 2;
	const ym = (y0 + y1) / 2;
	const D = n.R + n.f;
	let top = `M${x0} ${ym} A${rr} ${rr} 0 0 1 ${x0 + rr} ${y0}`;
	const Fy = y0 - n.f;
	const dy = n.cy - Fy;
	const d = Math.sqrt(D * D - dy * dy);
	const tx = (n.R * d) / D;
	const ty = n.cy + (n.R * (Fy - n.cy)) / D;
	top += ` L${r2(n.cx - d)} ${y0} A${n.f} ${n.f} 0 0 0 ${r2(n.cx - tx)} ${r2(ty)} A${n.R} ${n.R} 0 0 1 ${r2(n.cx + n.R)} ${n.cy}`;
	const Fy2 = y1 + n.f;
	const dy2 = Fy2 - n.cy;
	const d2 = Math.sqrt(D * D - dy2 * dy2);
	const tx2 = (n.R * d2) / D;
	const ty2 = n.cy + (n.R * dy2) / D;
	const bot = `M${r2(n.cx + n.R)} ${n.cy} A${n.R} ${n.R} 0 0 1 ${r2(n.cx - tx2)} ${r2(ty2)} A${n.f} ${n.f} 0 0 0 ${r2(n.cx - d2)} ${y1} L${x0 + rr} ${y1} A${rr} ${rr} 0 0 1 ${x0} ${ym}`;
	return { top, bot, fill: `${top} ${bot.replace(/^M/, 'L')} Z`, spec: `M${x0 + rr} ${y0 + 1.6} L${r2(n.cx - d - 3)} ${y0 + 1.6}`, topStraight: [x0 + rr, n.cx - d - 3, y0] };
};

/** a capsule or rounded slab (flat top and bottom) */
export const outlineArch = (s: { x0: number; y0: number; x1: number; y1: number; rr?: number }): Outline => {
	const { x0, y0, x1, y1 } = s;
	const h = y1 - y0;
	const rr = s.rr != null ? s.rr : h / 2;
	const ym = (y0 + y1) / 2;
	let top = `M${x0} ${ym}${ym > y0 + rr ? ` L${x0} ${y0 + rr}` : ''} A${rr} ${rr} 0 0 1 ${x0 + rr} ${y0}`;
	top += ` L${x1 - rr} ${y0} A${rr} ${rr} 0 0 1 ${x1} ${y0 + rr}${ym > y0 + rr ? ` L${x1} ${ym}` : ''}`;
	const bot = `M${x1} ${ym}${y1 - rr > ym ? ` L${x1} ${y1 - rr}` : ''} A${rr} ${rr} 0 0 1 ${x1 - rr} ${y1} L${x0 + rr} ${y1} A${rr} ${rr} 0 0 1 ${x0} ${y1 - rr}${y1 - rr > ym ? ` L${x0} ${ym}` : ''}`;
	return { top, bot, fill: `${top} ${bot.replace(/^M/, 'L')} Z`, spec: `M${r2(x0 + rr)} ${y0 + 1.6} L${r2(x1 - rr)} ${y0 + 1.6}`, topStraight: [x0 + rr, x1 - rr, y0] };
};

/** the portrait bar: a capsule with the Spin set in its middle; the top edge rises over it and the bottom dips under */
export const outlineBead = (s: { x0: number; x1: number; y0: number; y1: number }, n: Circle): Outline => {
	const { x0, x1, y0, y1 } = s;
	const rr = (y1 - y0) / 2;
	const ym = (y0 + y1) / 2;
	const D = n.R + n.f;
	const Fy = y0 - n.f;
	const dy = n.cy - Fy;
	const d = Math.sqrt(D * D - dy * dy);
	const tx = (n.R * d) / D;
	const ty = n.cy + (n.R * (Fy - n.cy)) / D;
	const Rb = n.Rb || n.R;
	const Db = Rb + n.f;
	const Fb = y1 + n.f;
	const db = Fb - n.cy;
	const e = Math.sqrt(Math.max(0, Db * Db - db * db));
	const bx = (Rb * e) / Db;
	const by = n.cy + (Rb * db) / Db;
	const top =
		`M${x0} ${ym} A${rr} ${rr} 0 0 1 ${x0 + rr} ${y0} L${r2(n.cx - d)} ${y0} A${n.f} ${n.f} 0 0 0 ${r2(n.cx - tx)} ${r2(ty)}` +
		` A${n.R} ${n.R} 0 0 1 ${r2(n.cx + tx)} ${r2(ty)} A${n.f} ${n.f} 0 0 0 ${r2(n.cx + d)} ${y0} L${r2(x1 - rr)} ${y0} A${rr} ${rr} 0 0 1 ${x1} ${ym}`;
	const bot =
		`M${x1} ${ym} A${rr} ${rr} 0 0 1 ${r2(x1 - rr)} ${y1} L${r2(n.cx + e)} ${y1} A${n.f} ${n.f} 0 0 0 ${r2(n.cx + bx)} ${r2(by)}` +
		` A${Rb} ${Rb} 0 0 1 ${r2(n.cx - bx)} ${r2(by)} A${n.f} ${n.f} 0 0 0 ${r2(n.cx - e)} ${y1} L${x0 + rr} ${y1} A${rr} ${rr} 0 0 1 ${x0} ${ym}`;
	const spec = `M${x0 + rr} ${y0 + 1.6} L${r2(n.cx - d - 3)} ${y0 + 1.6} M${r2(n.cx + d + 3)} ${y0 + 1.6} L${r2(x1 - rr)} ${y0 + 1.6}`;
	return { top, bot, fill: `${top} ${bot.replace(/^M/, 'L')} Z`, spec, topStraight: [x0 + rr, n.cx - d - 3, y0] };
};

/** the menu panel's outline: W x H body, a tail of length T whose tip is at x `tip`, rising from the top (up) or
 *  hanging from the bottom */
export const panelPath = (W: number, H: number, tip: number, up: boolean, T: number) => {
	const rr = 18;
	const q = rr - 0.5;
	const hw = T > 12 ? 11 : 10;
	const base = Math.max(rr + hw + 1, Math.min(W - rr - hw - 1, tip));
	const y0 = up ? T : 0;
	const yT = y0 + 0.5;
	const yB = y0 + H - 0.5;
	if (up)
		return (
			`M${rr} ${yT} H${r2(base - hw)} L${r2(tip - 2.2)} 1.6 Q${r2(tip)} 0 ${r2(tip + 2.2)} 1.6 L${r2(base + hw)} ${yT}` +
			` H${W - rr} A${q} ${q} 0 0 1 ${W - 0.5} ${y0 + rr} V${y0 + H - rr} A${q} ${q} 0 0 1 ${W - rr} ${yB}` +
			` H${rr} A${q} ${q} 0 0 1 .5 ${y0 + H - rr} V${y0 + rr} A${q} ${q} 0 0 1 ${rr} ${yT} Z`
		);
	return (
		`M${rr} ${yT} H${W - rr} A${q} ${q} 0 0 1 ${W - 0.5} ${rr} V${H - rr} A${q} ${q} 0 0 1 ${W - rr} ${yB}` +
		` H${r2(base + hw)} L${r2(tip + 2.2)} ${r2(H + T - 1.6)} Q${r2(tip)} ${H + T} ${r2(tip - 2.2)} ${r2(H + T - 1.6)} L${r2(base - hw)} ${yB}` +
		` H${rr} A${q} ${q} 0 0 1 .5 ${H - rr} V${rr} A${q} ${q} 0 0 1 ${rr} ${yT} Z`
	);
};

/** env(safe-area-inset-*) in CSS px, read off a hidden element (never per frame: on a resize / rotation only) */
let safeEl: HTMLDivElement | null = null;
export const readSafeInsets = (): Insets => {
	if (typeof document === 'undefined') return { t: 0, r: 0, b: 0, l: 0 };
	if (!safeEl) {
		safeEl = document.createElement('div');
		safeEl.style.cssText =
			'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
		document.body.appendChild(safeEl);
	}
	const cs = getComputedStyle(safeEl);
	return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
};
