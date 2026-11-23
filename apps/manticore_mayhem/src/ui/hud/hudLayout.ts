// THE HUD'S GEOMETRY (HUD round 5, "Drop 6": Desktop/u1.js in images/hud_round5_2026-11-12, approved 2026-11-12; the
// portrait phone row is HUD round 6, "Row of Seven": concepts/r6.js in images/hud_round6_2026-11-13, approved 2026-11-13).
//
// UNITS. The mockup was drawn in CSS px on five stills: portrait 390 x 844, landscape phone 844 x 390, tablet 1180 x
// 820, desktop 1440 x 810, wide 1920 x 810. Here those numbers are "mock px", kept verbatim, and the HUD is drawn in
// planes that span the WHOLE VIEWPORT in mock px (W x H), scaled by u = CSS px per mock px. u comes from the chrome's
// own fit scale, so at a mock's still u is exactly 1 (every number lands on the mock's pixel) and on any other screen
// the HUD scales with the board exactly as the old chrome did:
//   desktop   u = fit / 1.125    (the 1280 x 720 master shown at 1440 x 810); wide is the same rule (W = 1920)
//   tablet    u = fit / 0.921875 (the master at 1180 x 820) - the desktop layout on a screen that draws the master
//             smaller than 1:1 (fit < 1): bigger keys and a wider dock, so the controls keep their touch size
//   portrait  a phone: u = vw / 390 (round 6: the row is sized by the screen's width, see ROW6); a portrait TABLET keeps
//             u = fit / 0.946602 (the 412 master at 390 px wide), capped so the Spin stays under the spin amount plaque
//             and the readouts under the frame art (the board is bigger there)
//   landscape u = fit / 0.527027 (the 1480 x 740 phone master at 390 px high); anchored to the master like the board
// Bottom rows are anchored to the viewport's bottom edge, the desktop dock to its centre line (the WIN readout's
// centre IS the screen's centre), portrait keys to its side edges. Pure functions: the chromes, the SKIP button and
// the probes' own copies of these numbers all read the same rules.
import { MASTER, type LayoutKind, type FrameRect, artRectOf, frameFor, registrationOf, portraitShippedK } from '../../game/layoutSpec';
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

// ---- the portrait row (HUD round 6, "Row of Seven", approved 2026-11-13: images/hud_round6_2026-11-13/concepts/r6.js) ----
// One row inside the glass bar: the Armoury (a wide pill), Menu, Auto | Spin | Turbo, a gap, minus and plus. WIN over
// BALANCE at the left above the bar, the amount at the right above the bar. The mock draws it twice on a 390 px wide
// phone: SHORT (390 x 620, iPhone Safari with its bars, 66 px under the plaque) and TALL (390 x 844, full screen). Here
// both are re-measured up from the Spin's bottom edge (sb), x from the left edge (Armoury, Menu), from the center line
// (Auto, Turbo: cx -/+ autoDx) or from the right edge (minus, plus: W - x).
//
// THE RULE BETWEEN THEM (hudFrame): on a phone the HUD is sized by the screen's WIDTH (u = vw / 390, so the plane is
// always 390 mock px wide and both mock stills land on their own pixels), and t (0 = short, 1 = tall) is the largest
// value whose layout fits under the spin amount plaque: every number is interpolated linearly between the two mock
// tables, and "fits" means the Spin's top is not above the plaque's shadow box and neither readout column meets the
// plaque's box (its x extent too: on the short screen WIN and BALANCE sit BESIDE the plaque). t moves smoothly with
// the screen's height, so a height between the two mock heights gets an in-between row. A tall phone (19.5:9, a home
// indicator band under the Spin) gives part of its band before t moves and the rest only once t is 0. Only when even
// t = 0 does not fit (a phone shorter than the short mock for its width) does the whole row scale down, never under
// uMinPhone.
export const ROW6 = {
	short: { spinD: 64, R: 33.5, Rb: 32, f: 6, barTop: 40, barBottom: 3, keyUp: 21.5, armX: 10, armW: 68.5, armH: 34, menuX: 100.5, kM: 34, autoDx: 55.5, kA: 34, minusR: 73, plusR: 27, skD: 34, m: 9, lb: 7, num: 12.5, lg: 1, bg: 2, stackUp: 41.5, panelUp: 6, tail: 22 },
	tall: { spinD: 86, R: 45, Rb: 43, f: 8, barTop: 54, barBottom: 6, keyUp: 30, armX: 10, armW: 55, armH: 40, menuX: 87, kM: 34, autoDx: 68, kA: 36, minusR: 73, plusR: 27, skD: 34, m: 12, lb: 8, num: 17, lg: 1, bg: 3, stackUp: 57, panelUp: 10, tail: 26 },
};
export type Row6 = typeof ROW6.short;
/** the row at t (0 short .. 1 tall), every number interpolated */
export const row6 = (t: number): Row6 => {
	const a = ROW6.short as Record<string, number>;
	const b = ROW6.tall as Record<string, number>;
	const o: Record<string, number> = {};
	for (const k of Object.keys(a)) o[k] = r2(a[k] + (b[k] - a[k]) * t);
	return o as Row6;
};
/** the readouts' fixed widths: the longest amounts (BALANCE $9,999,999.99, WIN $1,250,000.00, the amount $1,000.00) at
 *  the number's type size, in ems of the HUD's number face (Outfit 900, tabular figures; measured in the game) */
const VALUE_EM = { long: 6.83, amt: 4.77 };
export const row6Widths = (num: number) => ({ col: Math.ceil(VALUE_EM.long * num), amt: Math.ceil(VALUE_EM.amt * num) });

// ---- the portrait band (gap = mock px under the Spin's bottom edge) ----
export const PORTRAIT = {
	/** the band under the Spin: the tall mock's (36 = its 34 px home-indicator band + 2) on a tall phone, the short
	 *  mock's 4 on a shorter one, more on a tablet */
	gapTall: 36,
	gapShort: 4,
	gapTablet: 14,
	/** a phone at least this tall for its width has a home indicator (every 19.5:9 phone) */
	tallRatio: 1.9,
	/** a tall phone's band first gives down to gapMin (the tall row kept), then the row steps toward the short one,
	 *  then (the short row still too tall) the band gives the rest of the way to gapShort */
	gapMin: 30,
	/** CSS px: the Spin's top may meet the plaque's shadow box (the short mock puts it there); the readouts keep this */
	spinClear: 0,
	readClear: 0.5,
	/** portrait tablet: the Spin this far under the plaque, the readouts this far under the art (CSS px) */
	plaqueClear: 8,
	plaqueShadowCss: 3.5,
	artClear: 4,
	/** never smaller than this on a tablet, on a phone */
	uMin: 0.8,
	uMinPhone: 0.68,
	/** the mock's phone width */
	mockW: 390,
};

/** the spin amount plaque's box (its soft shadow's, the lowest thing it draws) and the frame art's bottom on a portrait
 *  screen, CSS px: the board's own numbers (game/layoutSpec.ts frameFor, the plaque spec components/BoardPlaque.svelte
 *  picks: the tablet numbers once the shipped growth is past 1). The plaque is centered on the screen.
 *  `frame`: a portrait frame rect to read instead of the one the screen draws now (ui/gear/uprightScene.ts works the
 *  gear bar's scene out from the shipped frame and from the frame it places). */
export const portraitBoardBottoms = (vw: number, vh: number, frame?: FrameRect) => {
	const f = chromeFit('portrait', vw, vh);
	const vwm = vw / f.scale;
	const fr = frame ?? frameFor('portrait', vwm);
	const art = artRectOf(fr);
	const reg = registrationOf(fr);
	const spec = BOARD_PLAQUE_SPEC.layouts[portraitShippedK(vwm) > 1 ? 'portraitTablet' : 'portrait'].render;
	const box = spec.plaqueBox as readonly number[];
	const shadow = spec.shadowBox as readonly number[];
	const plaque = art.bottom + (box[1] + box[3] - BOARD_ART.art[3]) * reg.m;
	const shadowBottom = art.bottom + (shadow[1] + shadow[3] - BOARD_ART.art[3]) * reg.m;
	const half = (shadow[2] / 2) * reg.m * f.scale;
	// plaque: the plate's bottom + PORTRAIT.plaqueShadowCss (the tablet rule, measured at 390 x 844); shadow: the shadow
	// sprite's own box (what the board draws lowest and widest, and what the probes hold the HUD off), for the phone row
	return {
		art: f.top + art.bottom * f.scale,
		plaque: f.top + plaque * f.scale + PORTRAIT.plaqueShadowCss,
		shadow: { x0: vw / 2 - half, x1: vw / 2 + half, y1: f.top + shadowBottom * f.scale },
	};
};

/** does the round 6 row at t fit under the plaque? (mock px; pl = the plaque's box in mock px) */
const row6Fits = (t: number, W: number, H: number, gap: number, pl: { x0: number; x1: number; y1: number }, clearSpin: number, clearRead: number) => {
	const S = row6(t);
	const sb = H - gap;
	if (sb - S.spinD < pl.y1 + clearSpin) return false;
	const bh = S.lb + S.lg + S.num;
	const stackBottom = sb - S.stackUp;
	const w = row6Widths(S.num);
	const colTop = stackBottom - 2 * bh - S.bg;
	const meets = (x0: number, x1: number, y0: number) => y0 < pl.y1 + clearRead && x1 > pl.x0 - clearRead && x0 < pl.x1 + clearRead;
	return !meets(S.m, S.m + w.col, colTop) && !meets(W - S.m - w.amt, W - S.m, stackBottom - bh);
};

/** what a chrome needs to draw its planes: the variant, u, the plane in mock px, the plane's transform inside .fit */
export const hudFrame = (v: HudView) => {
	const fit = chromeFit(v.kind, v.vw, v.vh);
	const variant = hudVariant(v.kind, fit.scale);
	let u = fit.scale / MOCK_K[variant];
	const safe = v.safe ?? { t: 0, r: 0, b: 0, l: 0 };
	let gap = 0;
	/** portrait: the row between the short (0) and the tall (1) mock layouts */
	let t = 1;
	if (variant === 'portrait') {
		const P = PORTRAIT;
		const B = portraitBoardBottoms(v.vw, v.vh);
		if (!v.phone) {
			// a portrait tablet: the tall row, scaled as before so the Spin stays under the plaque and the readouts
			// under the frame art
			const S = ROW6.tall;
			gap = Math.max(P.gapTablet, safe.b / u + 2);
			const winTop = S.stackUp + 2 * (S.lb + S.lg + S.num) + S.bg;
			const room = Math.min((v.vh - B.plaque - P.plaqueClear) / (gap + S.spinD), (v.vh - B.art - P.artClear) / (gap + winTop));
			u = Math.max(P.uMin, Math.min(u, room));
		} else {
			u = v.vw / P.mockW;
			const tall = v.vh / v.vw >= P.tallRatio;
			const gapAt = (uu: number, g: number) => Math.max(g, safe.b / uu + 2);
			const plAt = (uu: number) => ({ x0: B.shadow.x0 / uu, x1: B.shadow.x1 / uu, y1: B.shadow.y1 / uu });
			const fits = (tt: number, uu: number, g: number) => row6Fits(tt, v.vw / uu, v.vh / uu, g, plAt(uu), P.spinClear / uu, P.readClear / uu);
			/** the largest t that fits (0 if none does: the caller checks) */
			const solveT = (uu: number, g: number) => {
				if (fits(1, uu, g)) return 1;
				let lo = 0;
				let hi = 1;
				for (let i = 0; i < 14; i++) {
					const mid = (lo + hi) / 2;
					if (fits(mid, uu, g)) lo = mid;
					else hi = mid;
				}
				return lo;
			};
			gap = gapAt(u, tall ? P.gapTall : P.gapShort);
			// a tall phone's band gives first (it keeps gapMin)
			if (tall && !fits(1, u, gap)) {
				const gMin = gapAt(u, P.gapMin);
				let lo = gMin;
				let hi = gap;
				if (fits(1, u, gMin)) {
					for (let i = 0; i < 12; i++) {
						const mid = (lo + hi) / 2;
						if (fits(1, u, mid)) lo = mid;
						else hi = mid;
					}
					gap = lo;
				} else gap = gMin;
			}
			t = solveT(u, gap);
			// even the short row does not fit: a tall phone's band gives the rest of the way (down to the short mock's),
			// then the whole row scales down (never under uMinPhone). Each step starts where the one before ended, so the
			// row changes smoothly with the screen's height.
			if (t === 0 && !fits(0, u, gap)) {
				const gShort = gapAt(u, P.gapShort);
				if (tall && fits(0, u, gShort)) {
					let lo = gShort;
					let hi = gap;
					for (let i = 0; i < 12; i++) {
						const mid = (lo + hi) / 2;
						if (fits(0, u, mid)) lo = mid;
						else hi = mid;
					}
					gap = lo;
				} else {
					let uu = u;
					while (uu > P.uMinPhone && !fits(0, uu, gapAt(uu, P.gapShort))) uu = Math.max(P.uMinPhone, uu - 0.005);
					u = uu;
					gap = gapAt(u, P.gapShort);
				}
			}
		}
	}
	const W = v.vw / u;
	const H = v.vh / u;
	// the plane's top left is the viewport's; inside .fit (master px, origin at fitLeft / top) that is -fitLeft / scale
	const transform = `translate(${-fit.fitLeft / fit.scale}px, ${-fit.top / fit.scale}px) scale(${u / fit.scale})`;
	return { variant, u, W, H, gap, t, fit, transform, safe };
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
	// THE HELP MENU (bet bar fix 2026-11-19, Corey: "not look like a chat bubble"): no tail; its right edge on the Menu
	// key's right edge, its foot PANEL_GAP over the dock's top edge (it was 12 over it, a tail reaching down to the key)
	const pr = Math.min(artLeftMock - 8, mcx + k / 2);
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
		panel: { x: pl, w: pr - pl, h: panelH, bottom: y0 - PANEL_GAP, tip: mcx - pl, nar: P.nar },
	};
};

// ---- portrait (round 6: one row of seven, WIN over BALANCE and the amount above the bar) ----
export const portraitGeo = (f: HudFrame, stripBottomMock: number) => {
	const S = row6(f.t);
	const W = f.W;
	const sb = f.H - f.gap;
	const cx = W / 2;
	const r = S.spinD / 2;
	const n: Circle = { cx, cy: sb - r, r, R: S.R, Rb: S.Rb, f: S.f };
	const keyY = sb - S.keyUp;
	const bar = { x0: 6, x1: W - 6, y0: sb - S.barTop, y1: sb - S.barBottom };
	// the readouts: a small word 1 px over its number; BALANCE ends just above the bar, WIN tight over it
	const bh = S.lb + S.lg + S.num;
	const stackBottom = sb - S.stackUp;
	const w = row6Widths(S.num);
	// the help panel's body ends just above the Spin's top; its tail reaches down toward Menu
	const pw = 300;
	const pl = Math.max(8, Math.min(W - 8 - pw, S.menuX - 84));
	return {
		W, sb, n, bar, keyY, S,
		type: { lb: S.lb, num: S.num, lg: S.lg },
		arm: { x: S.armX, y: keyY - S.armH / 2, w: S.armW, h: S.armH },
		menu: { cx: S.menuX, cy: keyY, d: S.kM },
		auto: { cx: cx - S.autoDx, cy: keyY, d: S.kA },
		turbo: { cx: cx + S.autoDx, cy: keyY, d: S.kA },
		minus: { cx: W - S.minusR, cy: keyY, d: S.skD },
		plus: { cx: W - S.plusR, cy: keyY, d: S.skD },
		spin: { x: cx - r, y: n.cy - r, d: S.spinD },
		win: { x: S.m, y: stackBottom - 2 * bh - S.bg, w: w.col, h: bh },
		bal: { x: S.m, y: stackBottom - bh, w: w.col, h: bh },
		amt: { right: S.m, y: stackBottom - bh, w: w.amt, h: bh },
		skip: { x: W - 8 - 76, y: stripBottomMock + 7, w: 76, h: 30 },
		panel: { x: pl, w: pw, h: 176, tail: S.tail, bottom: n.cy - r - S.panelUp, tip: S.menuX - pl },
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
/** specSegs (bet bar fix 2026-11-19): the specular line's straight pieces [x0, x1, y], each drawn fading out at both of its
 *  ends (ui/hud/HudGlass.svelte); spec is the same line as one path */
export type Outline = { top: string; bot: string; fill: string; spec: string; specSegs: [number, number, number][]; topStraight: [number, number, number] };

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
	return { top, bot, fill: `${top} ${bot.replace(/^M/, 'L')} Z`, spec: `M${x0 + rr} ${y0 + 1.6} L${r2(n.cx - d - 3)} ${y0 + 1.6}`, specSegs: [[x0 + rr, r2(n.cx - d - 3), y0 + 1.6]], topStraight: [x0 + rr, n.cx - d - 3, y0] };
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
	return { top, bot, fill: `${top} ${bot.replace(/^M/, 'L')} Z`, spec: `M${r2(x0 + rr)} ${y0 + 1.6} L${r2(x1 - rr)} ${y0 + 1.6}`, specSegs: [[r2(x0 + rr), r2(x1 - rr), y0 + 1.6]], topStraight: [x0 + rr, x1 - rr, y0] };
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
	const specSegs: [number, number, number][] = [
		[x0 + rr, r2(n.cx - d - 3), y0 + 1.6],
		[r2(n.cx + d + 3), r2(x1 - rr), y0 + 1.6],
	];
	return { top, bot, fill: `${top} ${bot.replace(/^M/, 'L')} Z`, spec, specSegs, topStraight: [x0 + rr, n.cx - d - 3, y0] };
};

/** the help menu's gap to the bar's edge, mock px (bet bar fix 2026-11-19) */
export const PANEL_GAP = 8;

/** THE HELP MENU'S OUTLINE (bet bar fix 2026-11-19, Corey: "Make this not look like a chat bubble"): a plain W x H panel,
 *  its corners the bar's (rr, 18), no tail. Drawn on the half pixel so its 1 px rim lands on whole device pixels. */
export const panelRect = (W: number, H: number) => {
	const rr = 18;
	const q = rr - 0.5;
	return `M${rr} .5 H${W - rr} A${q} ${q} 0 0 1 ${W - 0.5} ${rr} V${H - rr} A${q} ${q} 0 0 1 ${W - rr} ${H - 0.5} H${rr} A${q} ${q} 0 0 1 .5 ${H - rr} V${rr} A${q} ${q} 0 0 1 ${rr} .5 Z`;
};

/** RETIRED 2026-11-19 (the help menu has no tail now: panelRect): the menu panel's outline with a tail of length T whose
 *  tip is at x `tip`, rising from the top (up) or hanging from the bottom */
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
