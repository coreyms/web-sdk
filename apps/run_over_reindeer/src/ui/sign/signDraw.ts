// THE SIGN BAR'S DRAWINGS (2026-11-22): the shapes and the static SVG of every key, as strings and numbers. A port of the
// approved mocks' drawing code (play_button_r6 play.js, desktop_hud_r8 hud8.js, the C road sign keys of
// auto_turbo_themes_r1), at Corey's exported settings only (ui/hudTheme.ts SIGN). Nothing here animates and nothing here
// is drawn per frame: the lights are ui/sign/ledBand.ts. No filter, no mask, no blend mode; the only clip is the
// engraved mark's (ui/hud/engrave.ts, as the glass dock's key had it) cut to the hexagon.
import { LINE_WIN } from '../../game/constants';
import { SIGN } from '../hudTheme';

const f = (v: number) => Math.round(v * 100) / 100;
type Pt = [number, number];
const hexA = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
export const mix = (a: string, b: string, k: number) => '#' + hexA(a).map((v, i) => Math.round(v + (hexA(b)[i] - v) * k).toString(16).padStart(2, '0')).join('');
/** the win line lights in order (game/constants.ts LINE_WIN.lights.palettes, H4 to L5): the LEDs' colors */
export const LIGHTS: string[] = Object.values(LINE_WIN.lights.palettes)
	.flat()
	.map((n) => '#' + n.toString(16).padStart(6, '0'));
let uid = 0;
export const nextId = (p: string) => `${p}${++uid}`;

// ---- his glass ----
const lum = (h: string) => {
	const c = hexA(h)
		.map((v) => v / 255)
		.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
	return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const crt = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
/** ink on a glass key: white or black, whichever has the better worst contrast over snow and road, and its halo */
export const glassInk = (tint: string) => {
	const { a, t } = SIGN.glass;
	const face = (bg: number) => (1 - t) * (a * 0.02 + (1 - a) * bg) + t * lum(tint);
	const fs = [face(0.85), face(0.03)];
	const w = Math.min(...fs.map((l) => crt(1, l)));
	const k = Math.min(...fs.map((l) => crt(0, l)));
	return w >= k ? { ink: '#ffffff', halo: '#05080d' } : { ink: '#111111', halo: '#ffffff' };
};
/** the glass fills for a path: the dark gradient, the top shine, the tints (one per named state, cross faded by CSS),
 *  the hover, press and disabled layers */
const glassFace = (d: string, tints: Record<string, string>, id: string) => {
	const G = SIGN.glass;
	const defs =
		`<linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${G.top}" stop-opacity="${G.a}"/><stop offset="1" stop-color="${G.bottom}" stop-opacity="${G.a}"/></linearGradient>` +
		`<radialGradient id="${id}s" cx="50%" cy="0%" r="75%"><stop offset="0" stop-color="${G.shine}" stop-opacity="0.22"/><stop offset="0.75" stop-color="${G.shine}" stop-opacity="0"/></radialGradient>`;
	const body =
		`<path d="${d}" fill="url(#${id}f)"/><path d="${d}" fill="url(#${id}s)"/>` +
		Object.entries(tints)
			.map(([k, c]) => `<path class="tint t-${k}" d="${d}" fill="${c}" fill-opacity="${G.t}"/>`)
			.join('') +
		`<path class="hv" d="${d}" fill="${G.shine}" fill-opacity="0.14"/><path class="pr" d="${d}" fill="#000000" fill-opacity="0.26"/><path class="ds" d="${d}" fill="#8a94a3" fill-opacity="0.7"/>`;
	return { defs, body };
};

// ---- polygons with rounded corners, and their parallel outlines ----
const offsetPoly = (pts: Pt[], d: number): Pt[] => {
	const n = pts.length;
	const E = pts.map((p, i) => {
		const q = pts[(i + 1) % n];
		const tx = q[0] - p[0];
		const ty = q[1] - p[1];
		const l = Math.hypot(tx, ty) || 1;
		return { p: [p[0] + (ty / l) * d, p[1] - (tx / l) * d] as Pt, t: [tx / l, ty / l] as Pt };
	});
	return E.map((e, i) => {
		const a = E[(i - 1 + n) % n];
		const cr = a.t[0] * e.t[1] - a.t[1] * e.t[0];
		if (Math.abs(cr) < 1e-6) return e.p;
		const s = ((e.p[0] - a.p[0]) * e.t[1] - (e.p[1] - a.p[1]) * e.t[0]) / cr;
		return [a.p[0] + a.t[0] * s, a.p[1] + a.t[1] * s] as Pt;
	});
};
const offsetRadii = (pts: Pt[], rs: number[], d: number) => {
	const n = pts.length;
	return pts.map((p, i) => {
		const a = pts[(i - 1 + n) % n];
		const b = pts[(i + 1) % n];
		const u = [a[0] - p[0], a[1] - p[1]];
		const v = [b[0] - p[0], b[1] - p[1]];
		const cos = Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / ((Math.hypot(u[0], u[1]) || 1) * (Math.hypot(v[0], v[1]) || 1))));
		const half = Math.acos(cos) / 2;
		return Math.max(0.2, rs[i] + d / Math.tan(half));
	});
};
const cornerEnds = (pts: Pt[], rs: number[], i: number) => {
	const n = pts.length;
	const p = pts[i];
	const a = pts[(i - 1 + n) % n];
	const b = pts[(i + 1) % n];
	const ka = Math.min(rs[i] / Math.hypot(a[0] - p[0], a[1] - p[1]), 0.5);
	const kb = Math.min(rs[i] / Math.hypot(b[0] - p[0], b[1] - p[1]), 0.5);
	return { p, A: [p[0] + (a[0] - p[0]) * ka, p[1] + (a[1] - p[1]) * ka] as Pt, B: [p[0] + (b[0] - p[0]) * kb, p[1] + (b[1] - p[1]) * kb] as Pt };
};
const roundPath = (pts: Pt[], rs: number[]) => {
	let d = '';
	for (let i = 0; i < pts.length; i++) {
		const { p, A, B } = cornerEnds(pts, rs, i);
		d += `${i ? 'L' : 'M'}${f(A[0])} ${f(A[1])}Q${f(p[0])} ${f(p[1])} ${f(B[0])} ${f(B[1])}`;
	}
	return d + 'Z';
};
const outline = (pts: Pt[], rs: number[], d: number) => roundPath(offsetPoly(pts, d), offsetRadii(pts, rs, d));
/** a rounded outline as a closed line of points with its length, and where each corner's middle falls along it */
export type Trace = { P: Pt[]; cum: number[]; total: number; corner: number[] };
const trace = (pts: Pt[], rs: number[]): Trace => {
	const P: Pt[] = [];
	const corner: number[] = [];
	for (let i = 0; i < pts.length; i++) {
		const { p, A, B } = cornerEnds(pts, rs, i);
		for (let j = 0; j <= 8; j++) {
			const t = j / 8;
			if (j === 4) corner.push(P.length);
			P.push([(1 - t) * (1 - t) * A[0] + 2 * (1 - t) * t * p[0] + t * t * B[0], (1 - t) * (1 - t) * A[1] + 2 * (1 - t) * t * p[1] + t * t * B[1]]);
		}
	}
	const cum = [0];
	for (let i = 1; i <= P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i % P.length][0] - P[i - 1][0], P[i % P.length][1] - P[i - 1][1]));
	return { P, cum, total: cum[P.length], corner };
};
/** one LED's place: its point, the line's direction there (radians), its color */
export type Led = { x: number; y: number; dir: number; col: string };
const traceAt = (T: Trace, s: number) => {
	const t = ((s % T.total) + T.total) % T.total;
	let i = 0;
	while (i < T.P.length - 1 && T.cum[i + 1] < t) i++;
	const a = T.P[i];
	const b = T.P[(i + 1) % T.P.length];
	const k = (t - T.cum[i]) / Math.max(1e-9, T.cum[i + 1] - T.cum[i]);
	return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, dir: Math.atan2(b[1] - a[1], b[0] - a[0]) };
};

// ---- THE PLAY: the rounded diamond and its parallel paths (a 240 unit box, the center at 0, 0) ----
const PL = SIGN.play;
const shapeAt = (d: number) => ({ V: PL.V - d * Math.SQRT2, R: Math.max(0, PL.R - d) });
type Seg = { arc: boolean; c?: Pt; a0?: number; a1?: number; p0?: Pt; p1?: Pt; len: number };
const pieces = ({ V, R }: { V: number; R: number }) => {
	const segs: Seg[] = [];
	const cen = (k: number): Pt => {
		const ax = [[0, -1], [1, 0], [0, 1], [-1, 0]][k];
		const D = V - R * Math.SQRT2;
		return [ax[0] * D, ax[1] * D];
	};
	const P = (c: Pt, a: number): Pt => [c[0] + R * Math.cos((a * Math.PI) / 180), c[1] + R * Math.sin((a * Math.PI) / 180)];
	segs.push({ arc: true, c: cen(0), a0: -90, a1: -45, len: 0 });
	for (let k = 0; k < 4; k++) {
		const c = cen(k);
		const n = cen((k + 1) % 4);
		const a = -45 + 90 * k;
		segs.push({ arc: false, p0: P(c, a), p1: P(n, a), len: 0 });
		if (k < 3) segs.push({ arc: true, c: n, a0: a, a1: a + 90, len: 0 });
	}
	segs.push({ arc: true, c: cen(0), a0: 225, a1: 270, len: 0 });
	for (const s of segs) s.len = s.arc ? (R * Math.PI * ((s.a1 as number) - (s.a0 as number))) / 180 : Math.hypot((s.p1 as Pt)[0] - (s.p0 as Pt)[0], (s.p1 as Pt)[1] - (s.p0 as Pt)[1]);
	return { segs, R, total: segs.reduce((a, s) => a + s.len, 0) };
};
const diaAt = (pc: ReturnType<typeof pieces>, s: number) => {
	let t = ((s % pc.total) + pc.total) % pc.total;
	for (const g of pc.segs) {
		if (t <= g.len || g === pc.segs[pc.segs.length - 1]) {
			const k = g.len ? Math.min(1, t / g.len) : 0;
			if (g.arc) {
				const a = (g.a0 as number) + ((g.a1 as number) - (g.a0 as number)) * k;
				const r = (a * Math.PI) / 180;
				return { x: (g.c as Pt)[0] + pc.R * Math.cos(r), y: (g.c as Pt)[1] + pc.R * Math.sin(r), dir: r + Math.PI / 2 };
			}
			const p0 = g.p0 as Pt;
			const p1 = g.p1 as Pt;
			return { x: p0[0] + (p1[0] - p0[0]) * k, y: p0[1] + (p1[1] - p0[1]) * k, dir: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) };
		}
		t -= g.len;
	}
	return { x: 0, y: 0, dir: 0 };
};
/** the diamond's outline moved in by d */
export const diaPath = (d: number) => {
	const sh = shapeAt(d);
	const pc = pieces(sh);
	let s = '';
	pc.segs.forEach((g, i) => {
		if (g.arc) {
			const a0 = ((g.a0 as number) * Math.PI) / 180;
			const a1 = ((g.a1 as number) * Math.PI) / 180;
			const c = g.c as Pt;
			const A = [c[0] + sh.R * Math.cos(a0), c[1] + sh.R * Math.sin(a0)];
			const B = [c[0] + sh.R * Math.cos(a1), c[1] + sh.R * Math.sin(a1)];
			s += (i ? `L${f(A[0])} ${f(A[1])}` : `M${f(A[0])} ${f(A[1])}`) + (sh.R > 0 ? `A${f(sh.R)} ${f(sh.R)} 0 0 1 ${f(B[0])} ${f(B[1])}` : '');
		} else s += `L${f((g.p1 as Pt)[0])} ${f((g.p1 as Pt)[1])}`;
	});
	return s + 'Z';
};
const CH_IN = PL.band;
const CH_MID = (PL.chOut + CH_IN) / 2;
const CH_W = CH_IN - PL.chOut;
/** the band a key's lights are drawn in: the LEDs' places (the view's units), the spacing, the channel's width, its
 *  two edges as one even-odd path, and the view box the canvas covers */
export type Band = { leds: Led[]; step: number; chW: number; clip: string; view: [number, number, number, number]; coreK: number };
/** the Play's band: 36 LEDs along the middle of the channel, one on each corner, the win line lights in order */
export const playBand = (): Band => {
	const pc = pieces(shapeAt(CH_MID));
	const N = SIGN.led.count;
	const leds = Array.from({ length: N }, (_, i) => ({ ...diaAt(pc, (i * pc.total) / N), col: LIGHTS[i % LIGHTS.length] }));
	return { leds, step: pc.total / N, chW: CH_W, clip: diaPath(PL.chOut) + diaPath(CH_IN), view: [-120, -120, 240, 240], coreK: 1 };
};
/** the Play's body: the glass face (green at rest, red while a round or a run plays; cross faded), the band. The
 *  keylines are drawn again over the lights (playTop) */
export const playBody = () => {
	const id = nextId('sp');
	const D = diaPath(0);
	const g = SIGN.playGlass;
	const defs = `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${g.top}"/><stop offset="1" stop-color="${g.bottom}"/></linearGradient><radialGradient id="${id}s" cx="50%" cy="8%" r="60%"><stop offset="0" stop-color="${SIGN.glass.shine}" stop-opacity=".22"/><stop offset="1" stop-color="${SIGN.glass.shine}" stop-opacity="0"/></radialGradient>`;
	return (
		`<defs>${defs}</defs><path d="${D}" fill="url(#${id}g)" fill-opacity="${SIGN.glass.a}"/>` +
		`<path class="tint t-green" d="${D}" fill="${SIGN.green}" fill-opacity="${SIGN.glass.t}"/><path class="tint t-red" d="${D}" fill="${SIGN.red}" fill-opacity="${SIGN.glass.t}"/>` +
		`<path d="${D}" fill="url(#${id}s)"/><path class="hv" d="${D}" fill="${SIGN.glass.shine}" fill-opacity="0.1"/><path class="dis" d="${D}" fill="#1a1f27"/>` +
		`<path d="${D}" fill="none" stroke="${SIGN.navy}" stroke-width="${PL.keyline}" stroke-linejoin="round"/><path class="band" d="${diaPath(PL.band / 2)}" fill="none" stroke="${SIGN.band}" stroke-width="${PL.band}" stroke-linejoin="round"/>`
	);
};
/** the keylines, drawn over the lights so they stay crisp */
export const playKeylines = () =>
	`<path d="${diaPath(0)}" fill="none" stroke="${SIGN.navy}" stroke-width="${PL.keyline}" stroke-linejoin="round"/><path d="${diaPath(PL.band + 0.55)}" fill="none" stroke="${SIGN.black}" stroke-width="${PL.inner}" stroke-linejoin="round"/>`;
/** THE PRESS REGION: the drawn diamond is a square turned 45 degrees with rounded corners, and that is what the button
 *  itself is (a turned box takes presses as its own shape in every browser; nothing is cut and no child takes the
 *  press). Its side and its corner radius as shares of the key's box */
export const PLAY_HIT = { side: (PL.V * Math.SQRT2) / 240, r: PL.R / 240 };
/** |x| + |y| a text box in the Play may reach: inside the band's black line, less the limit */
export const PLAY_TEXT_LIMIT = shapeAt(PL.band + PL.inner).V - SIGN.text.limit;
/** the ink's outline in the Play: the glass's own dark */
export const PLAY_TEXT_DARK = SIGN.playGlass.bottom;

// ---- THE FREE SPINS RING ----
const RING_MAX = shapeAt(PL.band + PL.inner).V / Math.SQRT2 - 1.5;
/** the ring for a round of `total` spins: one ring at the locked size while it holds them, then smaller LEDs or a
 *  second ring just outside (the mock's ringPlan; the books hold 10, 13, 16 and 19, all one ring at the locked size) */
export const ringPlan = (total: number) => {
	const { R, r: rWant, gap, lip } = SIGN.ring;
	for (let r = rWant; r >= 1.6; r -= 0.2) {
		const rho = r + lip;
		const cap1 = Math.max(4, Math.floor((2 * Math.PI * R) / (2 * rho + gap)));
		if (total <= cap1) {
			if (R + rho <= RING_MAX) return { rings: [{ R, n: total }], r };
			continue;
		}
		const R2 = R + 2 * rho + gap;
		const cap2 = Math.floor((2 * Math.PI * R2) / (2 * rho + gap));
		if (total - cap1 <= cap2 && R2 + rho <= RING_MAX) return { rings: [{ R, n: cap1 }, { R: R2, n: total - cap1 }], r };
	}
	return { rings: [{ R, n: total }], r: 1.6 };
};
export const ringPoints = (rp: ReturnType<typeof ringPlan>): Pt[] =>
	rp.rings.flatMap(({ R, n }) =>
		Array.from({ length: n }, (_, j) => {
			const a = -Math.PI / 2 + (j * 2 * Math.PI) / n;
			return [f(R * Math.cos(a)), f(R * Math.sin(a))] as Pt;
		}),
	);
const arcD = (r: number, a0: number, a1: number) => {
	const p = (a: number) => [r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180)];
	const A = p(a0);
	const B = p(a1);
	return `M${f(A[0])} ${f(A[1])}A${f(r)} ${f(r)} 0 0 1 ${f(B[0])} ${f(B[1])}`;
};
/** one LED of the ring at 0, 0: its recess, the unlit LED, and (class on) the lit LED with its glow */
export const ringLed = (r: number, col: string) => {
	const R = r + SIGN.ring.lip;
	const dot = `<circle r="${f(r * 2)}" fill="${col}" opacity=".12"/><circle r="${f(r * 1.6)}" fill="${col}" opacity=".18"/><circle r="${f(r * 1.25)}" fill="${col}" opacity=".32"/><circle r="${f(r)}" fill="${col}"/><circle r="${f(r * 0.55)}" fill="${mix(col, '#ffffff', 0.55)}"/><circle cx="${f(-r * 0.3)}" cy="${f(-r * 0.35)}" r="${f(r * 0.26)}" fill="#fff" opacity=".85"/>`;
	return `<circle r="${f(R)}" fill="#04070c" fill-opacity=".86"/><path d="${arcD(R - 0.45, 25, 155)}" fill="none" stroke="#ffffff" stroke-opacity=".34" stroke-width=".9" stroke-linecap="round"/><circle r="${f(r)}" fill="${mix(col, '#000000', 0.74)}"/><path d="${arcD(r - 0.5, 200, 340)}" fill="none" stroke="#000000" stroke-opacity=".55" stroke-width="1"/><g class="on">${dot}</g>`;
};

// ---- AUTO AND TURBO: the road sign diamond (candidate C) in a w x w box, bar px ----
export const AUTO_ARROW = '<path d="M18.6 13.4A6.8 6.8 0 1 1 16.8 7"/><path d="M17.4 3.6v4h-4"/>';
export const BOLT = 'M13.4 3 6.2 13.2h5.2L10.4 21l7.4-10.4h-5.2z';
/** the key's frame: its glass (a tint per state), the white band with its navy keyline and black inner line, and the
 *  press diamond's size (only the drawn diamond takes the press, so one key's box corner never takes its neighbour's) */
export const keyFrame = (w: number, tints: Record<string, string>, glow: Record<string, [string, number]> = {}) => {
	const K = SIGN.key;
	const s = w / 1.22;
	const u = s / 80;
	const bw = K.bw * u;
	const ko = K.ko * u;
	const ki = K.ki * u;
	const m = K.margin * u + bw / 2 + ko;
	const W = w - 2 * m;
	const pts: Pt[] = [[m + W / 2, m], [m + W, m + W / 2], [m + W / 2, m + W], [m, m + W / 2]];
	const rs = pts.map(() => W * K.corner);
	const d = roundPath(pts, rs);
	const id = nextId('sk');
	const g = glassFace(d, tints, id);
	const glows = Object.entries(glow)
		.map(([k, [c, a]]) => `<g class="glow g-${k}" fill="none" stroke="${c}" stroke-linejoin="round">${[1, 0.88, 0.76, 0.65, 0.54, 0.44, 0.34, 0.25].map((q) => `<path d="${d}" stroke-width="${f((bw + 2 * ko + 16 * u) * q)}" stroke-opacity="${f(0.125 * a)}"/>`).join('')}</g>`)
		.join('');
	const defs = `${g.defs}<linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d5e1ee"/></linearGradient>`;
	const body =
		`${glows}${g.body}<path d="${outline(pts, rs, bw / 2 + ko / 2 - 0.05)}" fill="none" stroke="${SIGN.navy}" stroke-width="${f(ko + 0.1)}" stroke-linejoin="round"/>` +
		`<path d="${d}" fill="none" stroke="url(#${id}w)" stroke-width="${f(bw)}" stroke-linejoin="round"/>` +
		`<path d="${outline(pts, rs, -(bw / 2 + ki / 2 - 0.05))}" fill="none" stroke="${SIGN.black}" stroke-width="${f(ki + 0.1)}" stroke-linejoin="round"/>`;
	// the press region: the keyline's outer edge, a square turned 45 degrees (its side and corner radius, bar px)
	const hit = { side: W / Math.SQRT2 + 2 * (bw / 2 + ko), r: W * K.corner + bw / 2 + ko };
	return { defs, body, s, K: s * K.content, hit };
};
/** an icon in a 24 unit view: a dark (or light) halo under the ink, as the mock's keys draw it */
export const keyIcon = (paths: string, ink: string, halo: string, fill = false) =>
	`<g fill="none" stroke-linecap="square" stroke-linejoin="miter" stroke-miterlimit="6"><g stroke="${halo}" stroke-opacity=".55" stroke-width="4.4">${paths}</g><g stroke="${ink}" stroke-width="2" ${fill ? `fill="${ink}"` : ''}>${paths}</g></g>`;

// ---- THE FAST LANE KEY: a hexagon in a w x h box, bar px ----
export type BonusGeo = { w: number; h: number; bw: number; ko: number; ki: number; k: number; pts: Pt[]; rs: number[] };
export const bonusGeo = (w: number, h: number): BonusGeo => {
	const B = SIGN.bonus;
	const k = h / B.refH;
	const ko = Math.max(0.7, PL.chOut * k);
	const ki = Math.max(0.6, PL.inner * k);
	const bw = Math.max(2.2, B.band * k);
	const m = bw / 2 + ko + 0.4;
	const W = w - 2 * m;
	const H = h - 2 * m;
	const q = W * 0.2;
	const pts: Pt[] = [[m + q, m], [m + W - q, m], [m + W, m + H / 2], [m + W - q, m + H], [m + q, m + H], [m, m + H / 2]];
	return { w, h, bw, ko, ki, k, pts, rs: pts.map(() => H * B.corner) };
};
/** the hexagon's glass (green at rest, red with a mode on) */
export const bonusFace = (G: BonusGeo) => {
	const g = glassFace(roundPath(G.pts, G.rs), { green: SIGN.green, red: SIGN.red }, nextId('sb'));
	return `<defs>${g.defs}</defs>${g.body}`;
};
/** the frosted band with its keyline outside and (again, for over the lights) the keyline and the black line */
export const bonusBand = (G: BonusGeo) => {
	const navy = `<path d="${outline(G.pts, G.rs, G.bw / 2 + G.ko / 2 - 0.05)}" fill="none" stroke="${SIGN.navy}" stroke-width="${f(G.ko + 0.1)}" stroke-linejoin="round"/>`;
	const black = `<path d="${outline(G.pts, G.rs, -(G.bw / 2 + G.ki / 2 - 0.05))}" fill="none" stroke="${SIGN.black}" stroke-width="${f(G.ki + 0.1)}" stroke-linejoin="round"/>`;
	return { under: `${navy}<path class="band" d="${roundPath(G.pts, G.rs)}" fill="none" stroke="${SIGN.band}" stroke-width="${f(G.bw)}" stroke-linejoin="round"/>`, over: navy + black };
};
/** the Play's LED spacing along the middle of its channel (the Fast Lane key's LEDs keep it, at the key's scale) */
const playSpacing = () => pieces(shapeAt(CH_MID)).total / SIGN.led.count;
/** the key's lights: an LED on each corner, the rest shared out by the length of each side, at the Play's spacing */
export const bonusLights = (G: BonusGeo): Band => {
	const T = trace(G.pts, G.rs);
	const N = Math.max(T.corner.length, Math.round(T.total / (playSpacing() * G.k)));
	const cs = T.corner.map((i) => T.cum[i]);
	const C = cs.length;
	const sides = cs.map((s, i) => (cs[(i + 1) % C] - s + T.total) % T.total);
	const extra = Math.max(0, N - C);
	const raw = sides.map((e) => (extra * e) / T.total);
	const n = raw.map(Math.floor);
	let left = extra - n.reduce((a, b) => a + b, 0);
	const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
	for (let k = 0; left > 0; k++, left--) n[order[k % C][1]] += 1;
	const ss: number[] = [];
	for (let i = 0; i < C; i++) for (let j = 0; j <= n[i]; j++) ss.push(cs[i] + (sides[i] * j) / (n[i] + 1));
	const leds = ss.map((s, i) => ({ ...traceAt(T, s), col: LIGHTS[i % LIGHTS.length] }));
	return { leds, step: T.total / ss.length, chW: G.bw, clip: outline(G.pts, G.rs, G.bw / 2) + outline(G.pts, G.rs, -G.bw / 2), view: [0, 0, G.w, G.h], coreK: G.k };
};
/** the polygon the engraved mark is cut to (the band's inner edge), in the mark's own box (the key less a 1 px rim) */
export const bonusEtchClip = (G: BonusGeo) =>
	offsetPoly(G.pts, -G.bw / 2)
		.map((p) => `${f(p[0] - 1)}px ${f(p[1] - 1)}px`)
		.join(',');
/** the hexagon the words must stay inside, and its center */
export const bonusWordBox = (G: BonusGeo) => {
	const poly = offsetPoly(G.pts, -(G.bw / 2 + G.ki + G.h * 0.05));
	return { poly, cx: G.w / 2, cy: G.h / 2 };
};
const inPoly = (p: Pt, poly: Pt[]) => {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const a = poly[i];
		const b = poly[j];
		if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
	}
	return inside;
};
/** Overpass's cap height, em, and the words' letter spacing */
export const CAP = 0.7;
export const WORD_LS = 0.04;
/** the largest size at which the lines sit inside `poly` (every corner of every line's cap box), stacked about its
 *  middle; `em` measures a line's width in em */
export const fitWords = (lines: string[], poly: Pt[], cx: number, cy: number, max: number, em: (t: string) => number) => {
	const widths = lines.map(em);
	const pitch = 0.94;
	for (let fs = max; fs >= 6; fs -= 0.25) {
		const total = (lines.length - 1) * pitch * fs + CAP * fs;
		let ok = true;
		const rows = lines.map((t, i) => {
			const top = cy - total / 2 + i * pitch * fs;
			const half = (widths[i] * fs) / 2;
			for (const p of [[cx - half, top], [cx + half, top], [cx - half, top + CAP * fs], [cx + half, top + CAP * fs]] as Pt[]) if (!inPoly(p, poly)) ok = false;
			return { t, base: top + CAP * fs };
		});
		if (ok) return { fs, rows };
	}
	return { fs: 6, rows: lines.map((t, i) => ({ t, base: cy + (i - (lines.length - 1) / 2) * 6 + 2 })) };
};

// ---- THE BET SYMBOLS: a bare chevron, red < and green >, with a white and a dark outline ----
export const stepSvg = (dir: 1 | -1, D: { sw: number; white: number; dark: number; a: number; b: number }, w: number, h: number, cx = w / 2, cy = h / 2) => {
	const col = dir < 0 ? SIGN.red : SIGN.green;
	const d = `M${f(cx - dir * D.a)} ${f(cy - D.b)}L${f(cx + dir * D.a)} ${f(cy)}L${f(cx - dir * D.a)} ${f(cy + D.b)}`;
	const P = (cls: string, c: string, width: number) => `<path class="${cls}" d="${d}" stroke="${c}" stroke-width="${f(width)}"/>`;
	return `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${P('ko', '#0a0f16', D.sw + 2 * (D.white + D.dark))}${P('wo', '#ffffff', D.sw + 2 * D.white)}${P('sym', col, D.sw)}${P('hv', mix(col, '#ffffff', 0.22), D.sw)}</g>`;
};

// ---- THE HEADER PLATES (BALANCE, WIN, SPIN): the plate's own numbers for a letter size fs ----
export const HEAD_LS = 0.06;
export const headPlate = (fs: number) => {
	const bw = Math.max(1.3, 0.11 * fs);
	const ko = Math.max(0.7, 0.05 * fs);
	const ki = Math.max(0.5, 0.04 * fs);
	return { bw, ko, ki, padX: 0.42 * fs, padY: 0.2 * fs, r: 0.24 * fs, h: CAP * fs + 2 * (0.2 * fs + ki + bw + ko), edge: ki + bw + ko };
};
/** a plate's width for a word `em` wide (em of its letters, letter spacing in) */
export const headWidth = (em: number, fs: number) => em * fs + 2 * (0.42 * fs + headPlate(fs).edge);
