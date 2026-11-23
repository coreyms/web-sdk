// THE GEAR BAR'S DRAWINGS (2026-11-22): the Play gear, the Auto and Turbo gears, the hub's stud arrow and SPIN, the two
// war standards on their chains, the bare < and >. Vector art, drawn here as SVG strings once per size; nothing in this
// file runs per frame. Ported from the approved mock (Desktop "Manticore Mayhem/desktop_r6_2026-11-22" build/lab6.js
// gearOutline, gearBody, faceGear; build/play3core.js arrowSvg; build/app.js shapePath, bodySvg, rodSvg, chainSvg and the
// build.py border), shape for shape and tooth for tooth. Corey: "these gears look awesome", "Yes AV Gears as drawing,
// because it looks good in the Mock."
//
// WHAT TURNS AND WHAT DOES NOT. The mock redrew each gear every frame with the turn worked into every point, so its
// light never moved. Here a gear is a few layers, each drawn once and turned by a CSS transform:
//   the teeth and rim   look the same every tooth, so the layer is only ever turned within one tooth (gearLayout fold)
//   the seven spokes    the same every seventh of a turn
//   the six hub bolts   the same every sixth
// so every layer's light stays where the mock drew it (it swings at most half its own period), and the hub plate, its
// ring, the words and the icons are still. No filter, no mask, no clip that moves.
//
// COLORS THAT CHANGE BY STATE are CSS variables on the button (ui/gear/gear.css): a state change repaints a layer once.
// Every unit is a CSS px at 1920 x 1080 (the table's window); the SVGs scale to their boxes.
import { TOOTH } from './gearLayout';
import { engraving } from '../hud/engrave';
import { POLYMATH_MARK } from '../hud/polymathMark';

const f2 = (v: number) => Math.round(v * 100) / 100;
type Pt = [number, number];
/** a point r from the center, `a` degrees clockwise from the top */
const P = (r: number, a: number): Pt => [r * Math.sin((a * Math.PI) / 180), -r * Math.cos((a * Math.PI) / 180)];
const ps = (p: Pt) => `${f2(p[0])} ${f2(p[1])}`;
const qpts = (a: Pt, c: Pt, b: Pt, n = 5): Pt[] => {
	const o: Pt[] = [];
	for (let i = 1; i <= n; i++) {
		const t = i / n;
		o.push([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]);
	}
	return o;
};
let uid = 0;
/** the space round a gear's tips that its layers draw in (its shadow and its halo), px */
export const GEAR_PAD = 8;

/** THE TEETH (the mock's "slightly tapered" tooth: 0.5 of the pitch at the root, 0.26 at the tip, the tip corners eased;
 *  the widest that clear the frame wheel's own teeth on all 20 of its frames): one closed outline, a tooth at the top */
export const gearOutline = (R: number, N: number, dep: number = TOOTH.height): Pt[] => {
	const T = { root: 0.5, tip: 0.26, cap: 0.3 };
	const pa = 360 / N;
	const Rr = R - dep;
	const wr = (T.root / 2) * pa;
	const wt = (T.tip / 2) * pa;
	const cap = Math.min(dep * 0.9, dep * T.cap);
	const capA = Math.min(wt, ((cap / R) * 180) / Math.PI);
	const fil = Math.min((pa / 2 - wr) * 0.8, ((dep * 0.25) / Rr) * (180 / Math.PI));
	const pts: Pt[] = [];
	for (let i = 0; i < N; i++) {
		const a = i * pa;
		if (i === 0) pts.push(P(Rr, a - pa / 2));
		pts.push(...qpts(P(Rr, a - wr - fil), P(Rr, a - wr), P(Rr + dep * 0.12, a - wr + (wr - wt) * 0.12), 3));
		pts.push(P(R - cap, a - wt));
		pts.push(...qpts(P(R - cap, a - wt), P(R, a - wt), P(R, a - wt + capA), 5));
		pts.push(P(R, a + wt - capA));
		pts.push(...qpts(P(R, a + wt - capA), P(R, a + wt), P(R - cap, a + wt), 5));
		pts.push(P(Rr + dep * 0.12, a + wr - (wr - wt) * 0.12));
		pts.push(...qpts(P(Rr + dep * 0.12, a + wr - (wr - wt) * 0.12), P(Rr, a + wr), P(Rr, a + wr + fil), 3));
		pts.push(P(Rr, a + pa / 2));
	}
	return pts;
};
const outlineD = (R: number, N: number, dep: number = TOOTH.height) => 'M' + gearOutline(R, N, dep).map(ps).join('L') + 'Z';
const ring = (r: number) => `M${ps(P(r, 0))}A${f2(r)} ${f2(r)} 0 1 0 ${ps(P(r, 180))}A${f2(r)} ${f2(r)} 0 1 0 ${ps(P(r, 0))}Z`;
const svg = (B: number, body: string, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="${f2(-B)} ${f2(-B)} ${f2(2 * B)} ${f2(2 * B)}" aria-hidden="true" focusable="false">${body}</svg>`;
/** the iron and the brass, lit from the upper left across the whole gear (the mock's gradients; --gi* and --gb* turn
 *  them to steel on a disabled gear) */
const metals = (id: string, R: number) =>
	`<linearGradient id="${id}i" gradientUnits="userSpaceOnUse" x1="${f2(-R)}" y1="${f2(-R)}" x2="${f2(R * 0.6)}" y2="${f2(R)}"><stop offset="0" style="stop-color:var(--gi0)"/><stop offset=".5" style="stop-color:var(--gi1)"/><stop offset="1" style="stop-color:var(--gi2)"/></linearGradient>` +
	`<linearGradient id="${id}b" gradientUnits="userSpaceOnUse" x1="${f2(-R)}" y1="${f2(-R)}" x2="${f2(R)}" y2="${f2(R)}"><stop offset="0" style="stop-color:var(--gb0)"/><stop offset=".45" style="stop-color:var(--gb1)"/><stop offset="1" style="stop-color:var(--gb2)"/></linearGradient>`;

/** THE PLAY GEAR: R over the tips, N teeth, the hub Rh, the tooth's height (the desktop table's unless given: a phone's
 *  gears are drawn in that phone's own px). `teeth`, `spokes` and `bolts` turn (their periods beside them);
 *  `glow` (under everything), `hub` (between the spokes and the bolts) and `flash` (over the bolts) are still. */
export const playGearArt = (R: number, N: number, Rh: number, dep: number = TOOTH.height) => {
	const id = `gp${++uid}`;
	const B = R + GEAR_PAD;
	const Rr = R - dep;
	const rimW = R * 0.12;
	const Ri = Rr - rimW;
	const d = outlineD(R, N, dep);
	const open = ring(Ri);
	const ink = '#070505';
	// the halo: a feature's color while its free spins play, the theme's gold as a win lands and while autoplay runs
	const glow = svg(B, `<g fill="none" style="stroke:var(--ring)">${[1, 0.7, 0.45].map((q) => `<circle r="${f2(Rh + R * 0.02)}" stroke-width="${f2(R * 0.12 * q)}" stroke-opacity="0.18"/>`).join('')}</g>`);
	const teeth = svg(
		B,
		`<defs>${metals(id, R)}</defs>` +
			`<path d="${d}${open}" fill="rgba(4,4,6,0.45)" fill-rule="evenodd" transform="translate(${f2(R * 0.02)} ${f2(R * 0.05)})"/>` +
			`<path d="${d}${open}" fill="url(#${id}i)" fill-rule="evenodd" stroke="${ink}" stroke-width="${f2(Math.max(1, R * 0.008))}" stroke-linejoin="round"/>` +
			`<path d="${d}" fill="none" stroke="#8a7458" stroke-opacity="0.35" stroke-width="${f2(Math.max(0.8, R * 0.006))}" transform="translate(${f2(-R * 0.003)} ${f2(-R * 0.005)})"/>` +
			`<circle r="${f2(Rr - rimW * 0.45)}" fill="none" stroke="url(#${id}b)" stroke-width="${f2(Math.max(1.2, R * 0.02))}"/>`,
	);
	let sp = `<defs>${metals(`${id}s`, R)}</defs>`;
	const ns = 7;
	for (let i = 0; i < ns; i++) {
		const a = i * (360 / ns);
		const w0 = ((R * 0.055) / Rh) * (180 / Math.PI);
		const w1 = ((R * 0.042) / Ri) * (180 / Math.PI);
		const c1 = P((Rh + Ri) / 2, a + 2.5 - w0 * 0.75);
		const c2 = P((Rh + Ri) / 2, a + 2.5 + w0 * 0.75);
		sp += `<path d="M${ps(P(Rh * 0.94, a - w0))}Q${ps(c1)} ${ps(P(Ri + 1, a + 9 - w1))}L${ps(P(Ri + 1, a + 9 + w1))}Q${ps(c2)} ${ps(P(Rh * 0.94, a + w0))}Z" fill="url(#${id}si)" stroke="${ink}" stroke-width="${f2(R * 0.008)}" stroke-linejoin="round"/>`;
	}
	const ri = Rh - R * 0.04;
	const hub = svg(
		B,
		`<defs>${metals(`${id}h`, R)}</defs>` +
			`<circle r="${f2(Rh)}" fill="url(#${id}hi)" stroke="${ink}" stroke-width="${f2(R * 0.012)}"/>` +
			// the hub's ring: brass; a feature's color (--ring) in its free spins; lit on hover; dull while pressed
			`<circle class="hr" r="${f2(Rh - R * 0.022)}" fill="none" stroke="url(#${id}hb)" stroke-width="${f2(R * 0.026)}"/>` +
			`<circle class="hr-mode" r="${f2(Rh - R * 0.022)}" fill="none" style="stroke:var(--ring)" stroke-width="${f2(R * 0.026)}"/>` +
			`<circle class="hr-hot" r="${f2(Rh - R * 0.022)}" fill="none" stroke="rgb(var(--hud-accent-hi-rgb))" stroke-width="${f2(R * 0.032)}"/>` +
			`<circle class="hr-hot" r="${f2(Rh - R * 0.022)}" fill="none" stroke="rgb(var(--hud-accent-hi-rgb))" stroke-opacity="0.22" stroke-width="${f2(R * 0.07)}"/>` +
			`<circle class="hr-sunk" r="${f2(Rh - R * 0.022)}" fill="none" stroke="#8a6a2a" stroke-width="${f2(R * 0.026)}"/>` +
			`<circle r="${f2(ri)}" fill="rgba(0,0,0,0.25)"/>` +
			// pressed: the hub sinks (a darker face, a dark band inside its upper rim)
			`<g class="sunk"><circle r="${f2(ri)}" fill="rgba(0,0,0,0.28)"/><path d="M${ps(P(ri, -80))}A${f2(ri)} ${f2(ri)} 0 0 1 ${ps(P(ri, 80))}A${f2(ri * 1.12)} ${f2(ri * 1.02)} 0 0 0 ${ps(P(ri, -80))}Z" fill="rgba(0,0,0,0.55)" transform="translate(0 ${f2(R * 0.025)})"/></g>`,
	);
	let bo = `<defs>${metals(`${id}o`, R)}</defs>`;
	for (let i = 0; i < 6; i++) {
		const q = P(Rh - R * 0.022, 30 + i * 60);
		bo += `<circle cx="${f2(q[0])}" cy="${f2(q[1])}" r="${f2(R * 0.016)}" fill="url(#${id}ob)" stroke="${ink}" stroke-width="${f2(R * 0.005)}"/>`;
	}
	// the win: a pale ring over the hub's, fading as the halo does
	const flash = svg(B, `<circle r="${f2(Rh - R * 0.022)}" fill="none" stroke="#fff3d2" stroke-width="${f2(R * 0.04)}"/>`);
	return { glow, teeth, spokes: svg(B, sp), hub, bolts: svg(B, bo), flash, periods: { teeth: 360 / N, spokes: 360 / ns, bolts: 60 } };
};

/** THE HUB'S STUD ARROW (the game's six gold studs shrinking away from a chevron head, at the mock's size for the hub):
 *  drawn in the Spin face's own -50..50 box (ui/hud/spinRing.ts), which the hub's diameter fills, its head at the
 *  ring's home pose, so the game's ring driver turns it as it turns the dock's ring. --ga* turn it to steel. */
export const hubArrowSvg = (): string => {
	const id = `ga${++uid}`;
	// the mock's numbers for a hub of radius 92.52 px, in this box's units (x 50 / 92.52)
	const k = 0.525;
	const S = 38.44;
	const at = (s: number) => {
		const a = (s / S) * (180 / Math.PI);
		return { p: P(S, a), n: P(1, a) };
	};
	const A = { studs: 6, studR: 8.2 * k, shrink: 0.085, gap: 28 * k, band: 20 * k, w: 12 * k, hw: 27 * k, L: 24 * k, ink: 2.6 * k };
	const sH = (50.4 * Math.PI * S) / 180;
	const sw = A.L * 0.32;
	const outer: Pt[] = [];
	const inner: Pt[] = [];
	for (let i = 0; i <= 10; i++) {
		const q = at(sH - A.band - sw + (A.band * i) / 10);
		outer.push([q.p[0] + (q.n[0] * A.w) / 2, q.p[1] + (q.n[1] * A.w) / 2]);
		inner.push([q.p[0] - (q.n[0] * A.w) / 2, q.p[1] - (q.n[1] * A.w) / 2]);
	}
	const so: Pt[] = [];
	const si: Pt[] = [];
	for (let i = 0; i <= 6; i++) {
		const u = i / 6;
		const q = at(sH - sw + (A.L + sw) * u);
		const half = (A.hw / 2) * (1 - u);
		so.push([q.p[0] + q.n[0] * half, q.p[1] + q.n[1] * half]);
		si.push([q.p[0] - q.n[0] * half, q.p[1] - q.n[1] * half]);
	}
	const head = [...outer, ...so, ...si.slice().reverse().slice(1), ...inner.slice().reverse()];
	let studs = '';
	let s = sH - A.band - sw;
	for (let i = 0; i < A.studs; i++) {
		const r = Math.max(1.2 * k, A.studR * (1 - A.shrink * i));
		const rPrev = i === 0 ? r : Math.max(1.2 * k, A.studR * (1 - A.shrink * (i - 1)));
		s -= i === 0 ? Math.max(A.gap * 0.62, r + A.ink) : Math.max(A.gap, r + rPrev + A.ink * 1.2);
		const p = at(s).p;
		studs += `<circle cx="${f2(p[0])}" cy="${f2(p[1])}" r="${f2(r)}"/>`;
	}
	const stops = (a: string[], o: number[]) => a.map((c, i) => `<stop offset="${o[i]}" style="stop-color:var(${c})"/>`).join('');
	const defs = `<defs><linearGradient id="${id}g" x1="0.2" y1="0" x2="0.8" y2="1">${stops(['--ga0', '--ga1', '--ga2', '--ga3'], [0, 0.35, 0.7, 1])}</linearGradient><linearGradient id="${id}h" x1="0" y1="0" x2="0" y2="1">${stops(['--ga1', '--ga2', '--ga3'], [0, 0.5, 1])}</linearGradient></defs>`;
	// the trails the Spin's own rules show at Turbo and Super Turbo (hud.css .t1, .t2)
	const trails = `<use class="t2" href="#${id}" transform="rotate(-12)" opacity=".18"/><use class="t1" href="#${id}" transform="rotate(-6)" opacity=".38"/>`;
	return `<svg class="rs" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">${defs}${trails}<g id="${id}" fill="url(#${id}g)" stroke="#0d0903" stroke-width="${f2(A.ink)}" stroke-linejoin="round" paint-order="stroke">${studs}<path d="M${head.map(ps).join('L')}Z" fill="url(#${id}h)"/></g></svg>`;
};

/** SPIN in the game's gold lettering (the mock: 36 px on a hub of radius 92.52, spaced 0.12 em, a 2.2 px ink line), in
 *  the Spin face's -50..50 box. --gs0..2 turn it to steel. `size`, `ink`, `hubR`: another table's own (the upright
 *  phone: 19.4 px with a 1.2 px line on a hub of radius 46.05). */
export const spinWordSvg = (size = 36, ink = 2.2, hubR = 92.52): string => {
	const id = `gs${++uid}`;
	const k = 50 / hubR;
	return `<svg class="rdy" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--gs0)"/><stop offset=".5" style="stop-color:var(--gs1)"/><stop offset="1" style="stop-color:var(--gs2)"/></linearGradient></defs><text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-size="${f2(size * k)}" letter-spacing="${f2(size * 0.12 * k)}" fill="url(#${id})" stroke="#0b0703" stroke-width="${f2(ink * 2 * k)}" stroke-linejoin="round" paint-order="stroke">SPIN</text></svg>`;
};

/** A SMALL GEAR (Auto, Turbo): solid iron, no spokes; a face out to the tooth roots with the game's icon, the word and
 *  Turbo's level pips. `teeth` turns; `under` (the lit halo), `face` and `mark` are still. Colors by state: gear.css. */
export const smallGearArt = (kind: 'auto' | 'turbo' | 'menu' | 'arm', R: number, N: number, word: number, pips: number, dep: number = TOOTH.height) => {
	const id = `gk${++uid}`;
	const B = R + GEAR_PAD;
	const Rr = R - dep;
	const Rf = Rr - Math.max(1.5, R * 0.03);
	const d = outlineD(R, N, dep);
	const under = svg(B, `<circle r="${f2(R * 0.98)}" fill="none" stroke="rgb(var(--hud-accent-rgb))" stroke-opacity="0.22" stroke-width="${f2(R * 0.12)}"/>`);
	const teeth = svg(
		B,
		`<defs>${metals(id, R)}</defs><path d="${d}" fill="rgba(4,4,6,0.45)" transform="translate(${f2(R * 0.02)} ${f2(R * 0.05)})"/>` +
			`<path d="${d}" fill="url(#${id}i)" stroke="#070505" stroke-width="${f2(Math.max(1, R * 0.012))}" stroke-linejoin="round"/>` +
			`<path d="${d}" fill="none" stroke="#8a7458" stroke-opacity="0.35" stroke-width="0.8" transform="translate(-0.3 -0.5)"/>`,
	);
	const face = svg(
		B,
		`<defs>${metals(`${id}f`, R)}<linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--gf0)"/><stop offset=".5" style="stop-color:var(--gf1)"/><stop offset="1" style="stop-color:var(--gf2)"/></linearGradient></defs>` +
			`<circle r="${f2(Rf)}" fill="url(#${id}p)"/><circle r="${f2(Rf)}" fill="rgba(255,240,210,0.06)"/>` +
			`<circle class="kr" r="${f2(Rf)}" fill="none" stroke="url(#${id}fb)" stroke-width="${f2(Math.max(1.6, R * 0.03))}"/>` +
			`<circle class="kr-c" r="${f2(Rf)}" fill="none" style="stroke:var(--gkr)" stroke-width="${f2(Math.max(1.6, R * 0.03))}"/>` +
			`<circle class="kr-hot" r="${f2(Rf)}" fill="none" stroke="rgb(var(--hud-accent-hi-rgb))" stroke-width="${f2(Math.max(1.6, R * 0.04))}"/>` +
			`<circle class="sunk" r="${f2(Rf)}" fill="rgba(0,0,0,0.25)"/>`,
	);
	// the content, sized to the face: the icon, the word, Turbo's pips (the mock's stack, centered on the face). With no
	// word (the upright phone: `word` 0, icon only) the icon stands alone in the middle, Turbo's pips small under it; the
	// Armoury's icon is the game's own PolyMath mark (ui/hud/polymathMark.ts, untouched), half the face high.
	const turbo = kind === 'turbo';
	let m: string;
	if (kind === 'arm') {
		const [X0, Y0, X1, Y1] = POLYMATH_MARK.bbox;
		const mh = Rf * 1.02;
		m = `<path class="pm" d="${POLYMATH_MARK.d}" transform="scale(${f2(mh / (Y1 - Y0))}) translate(${-(X0 + X1) / 2} ${-(Y0 + Y1) / 2})" stroke="rgba(10,6,2,0.7)" stroke-width="1" stroke-linejoin="round" vector-effect="non-scaling-stroke" paint-order="stroke"/>`;
	} else {
		const iz = Rf * 2 * (word ? 0.41 : 0.5) * (turbo ? 0.88 : 1);
		const cap = word * 0.72;
		const pipH = turbo ? (word ? Math.max(3, word * 0.2) : Math.max(2, Rf * 0.09)) : 0;
		const gap1 = word * (turbo ? 0.36 : 0.22);
		const gap2 = turbo ? (word ? word * 0.3 : Rf * 0.14) : 0;
		let y = -(iz + gap1 + cap + gap2 + pipH) / 2;
		const art = ICON[kind];
		m = `<g transform="translate(${f2(-iz / 2)} ${f2(y)}) scale(${f2(iz / 24)})" fill="none" stroke-linecap="square" stroke-linejoin="miter" stroke-miterlimit="6"><g stroke="rgba(10,6,2,0.85)" stroke-width="3.4">${art}</g><g class="ki" stroke="currentColor" stroke-width="2">${art}</g></g>`;
		y += iz + gap1 + cap / 2;
		if (word) m += `<text class="kw" x="0" y="${f2(y)}" text-anchor="middle" dominant-baseline="central" font-size="${f2(word)}" letter-spacing="${f2(word * 0.06)}" fill="currentColor" stroke="#0b0703" stroke-linejoin="round" paint-order="stroke">${kind.toUpperCase()}</text>`;
		if (turbo) {
			const pw = word ? word * 0.52 : Rf * 0.24;
			const pg = word ? word * 0.18 : Rf * 0.08;
			const py = y + cap / 2 + gap2;
			for (let i = 0; i < pips; i++) m += `<rect class="pip" x="${f2(-(pw * pips + pg * (pips - 1)) / 2 + i * (pw + pg))}" y="${f2(py)}" width="${f2(pw)}" height="${f2(pipH)}" rx="${f2(pipH * 0.3)}" fill="currentColor" stroke="rgba(10,6,2,0.5)" stroke-width="0.6"/>`;
		}
	}
	m += `<circle class="off" r="${f2(Rf)}" fill="rgba(18,18,22,0.35)"/>`;
	return { under, teeth, face, mark: svg(B, m), period: 360 / N };
};

// ---- THE WAR STANDARDS (Menu in dark glass, the Armoury in red cloth): a swallowtail cloth under a brass rod, a dark
// gold border inside the cloth's edge with a thin dark inner line, two short chains up to the logo plate ----------------
/** a standard's own units: the mock's px for size 100 (113.6 x 126); the table's box is this x 1.3333 */
export const STD = { w: 113.6, h: 126, rod: 0.08, inset: 0.104, tuck: 0.55, border: 4.2, gap: 5 } as const;
const roundPoly = (pts: Pt[], r: number) => {
	let d = '';
	const n = pts.length;
	for (let i = 0; i < n; i++) {
		const p = pts[i];
		const a = pts[(i - 1 + n) % n];
		const b = pts[(i + 1) % n];
		const ka = Math.min(r / Math.hypot(a[0] - p[0], a[1] - p[1]), 0.5);
		const kb = Math.min(r / Math.hypot(b[0] - p[0], b[1] - p[1]), 0.5);
		d += `${i ? 'L' : 'M'}${f2(p[0] + (a[0] - p[0]) * ka)} ${f2(p[1] + (a[1] - p[1]) * ka)}Q${f2(p[0])} ${f2(p[1])} ${f2(p[0] + (b[0] - p[0]) * kb)} ${f2(p[1] + (b[1] - p[1]) * kb)}`;
	}
	return d + 'Z';
};
const insetPoly = (pts: Pt[], dd: number): Pt[] =>
	pts.map((v, i) => {
		const a = pts[(i - 1 + pts.length) % pts.length];
		const b = pts[(i + 1) % pts.length];
		const nrm = (x: number, y: number): Pt => {
			const l = Math.hypot(x, y) || 1;
			return [x / l, y / l];
		};
		const n1 = nrm(-(v[1] - a[1]), v[0] - a[0]);
		const n2 = nrm(-(b[1] - v[1]), b[0] - v[0]);
		const k = Math.max(0.15, 1 + n1[0] * n2[0] + n1[1] * n2[1]);
		return [v[0] + ((n1[0] + n2[0]) / k) * dd, v[1] + ((n1[1] + n2[1]) / k) * dd];
	});
const sharp = (pts: Pt[]) => 'M' + pts.map(ps).join('L') + 'Z';
const BRASS = ['#f3d68a', '#ecd092', '#c2a063', '#a8823c', '#5d4720'];
/** COPY OF ui/hud/HudIcon.svelte:HUD_LINE (menu, auto, turbo): the game's own icons, 24 box, 2 px line */
const ICON: Record<string, string> = {
	menu: '<path d="M5 7h14M5 12h14M5 17h14"/>',
	auto: '<path d="M18.6 13.4A6.8 6.8 0 1 1 16.8 7"/><path d="M17.4 3.6v4h-4"/>',
	turbo: '<path class="bolt" d="M13.4 3 6.2 13.2h5.2L10.4 21l7.4-10.4h-5.2z"/>',
};

/** one standard. `chain` is how far above the box's top its chains start (the logo plate's underside), in its units.
 *  The fills' two looks (rest, on) and the rim cross-fade by class (gear.css). */
export const standardSvg = (kind: 'menu' | 'arm', chain: number): string => {
	const id = `gd${++uid}`;
	const { w, h } = STD;
	const mn = Math.min(w, h);
	const m = Math.max(1.2, mn * 0.035);
	const x0 = w * STD.inset + m;
	const x1 = w * (1 - STD.inset) - m;
	const y0 = h * STD.rod * STD.tuck;
	const y1 = h - m;
	const cw = x1 - x0;
	const ch = y1 - y0;
	const pts: Pt[] = [[x0, y0], [x1, y0], [x1, y1], [x0 + cw / 2, y0 + 0.8 * ch], [x0, y1]];
	const d = roundPoly(pts, Math.min(cw, ch) * 0.06);
	const lg = (n: string, stops: [number, string][]) => `<linearGradient id="${id}${n}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" style="stop-color:${c}"/>`).join('')}</linearGradient>`;
	const rad = (n: string, cx: string, cy: string, r: string, c0: string, a: number, c1: string, at: number) =>
		`<radialGradient id="${id}${n}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" style="stop-color:rgb(var(${c0}));stop-opacity:${a}"/><stop offset="${at}" style="stop-color:rgb(var(${c1}));stop-opacity:0"/></radialGradient>`;
	const rgba = (v: string, a: number | string) => `rgba(var(${v}),${a})`;
	let defs = `<clipPath id="${id}k"><path d="${d}"/></clipPath>`;
	let fills: string;
	let inner = '';
	if (kind === 'arm') {
		defs += rad('r1', '22%', '50%', '70%', '--hud-feature-hi-rgb', 0.6, '--hud-feature-rgb', 0.72) + lg('r2', [[0, rgba('--hud-feature-deep-1-rgb', 0.84)], [1, rgba('--hud-feature-deep-2-rgb', 0.9)]]);
		defs += rad('o1', '22%', '50%', '70%', '--hud-accent-hi-rgb', 0.46, '--hud-accent-rgb', 0.74) + lg('o2', [[0, rgba('--hud-feature-on-deep-1-rgb', 0.88)], [1, rgba('--hud-feature-on-deep-2-rgb', 0.92)]]);
		defs += `<radialGradient id="${id}sc" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity="0.84"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
		fills = `<g class="f-rest"><path d="${d}" fill="url(#${id}r2)"/><path d="${d}" fill="url(#${id}r1)"/></g><g class="f-on"><path d="${d}" fill="url(#${id}o2)"/><path d="${d}" fill="url(#${id}o1)"/></g>`;
		// THE GAME'S OWN POLYMATH MARK (ui/hud/polymathMark.ts, untouched): flat gold at strength 65 at rest, 36 percent of
		// the standard's height, 8.5 percent above its middle; with a mode on, the game's gold inlay (ui/hud/engrave.ts)
		const [X0, Y0, X1, Y1] = POLYMATH_MARK.bbox;
		const mh = 0.36 * h;
		const T = `translate(${f2(w / 2)} ${f2(h / 2 - 0.085 * h)}) scale(${f2(mh / (Y1 - Y0))}) translate(${-(X0 + X1) / 2} ${-(Y0 + Y1) / 2})`;
		inner =
			`<g class="em-rest"><path d="${POLYMATH_MARK.d}" transform="${T}" fill="rgba(var(--hud-mark-g2-rgb),0.65)" stroke="rgba(20,10,4,0.39)" stroke-width="0.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></g>` +
			`<g class="em-on">${engraving(w, h, { look: 'inlay', hub: false, size: 36, x: 0, y: -8.5, rot: 0, depth: 40, strength: 95, light: 0 })}</g>` +
			`<rect class="scr" width="${f2(w)}" height="${f2(h)}" fill="url(#${id}sc)"/>`;
	} else {
		const ga = (n: string) => rgba(`--hud-glass-${n}-rgb`, `calc(var(--hud-glass-${n}-a) + 0.08)`);
		defs += lg('g', [[0, ga('top')], [0.5, ga('mid')], [1, ga('bottom')]]) + rad('s', '50%', '0%', '80%', '--hud-ink-rgb', 0.16, '--hud-ink-rgb', 0.75);
		defs += lg('o', [[0, 'rgb(var(--hud-key-on-1-rgb))'], [1, 'rgb(var(--hud-key-on-2-rgb))']]) + rad('os', '50%', '0%', '80%', '--hud-accent-cream-rgb', 0.14, '--hud-accent-cream-rgb', 0.75);
		fills = `<g class="f-rest"><path d="${d}" fill="url(#${id}g)"/><path d="${d}" fill="url(#${id}s)"/></g><g class="f-on"><path d="${d}" fill="url(#${id}o)" style="fill-opacity:var(--hud-key-on-a)"/><path d="${d}" fill="url(#${id}os)"/></g>`;
	}
	const shadow = `<path d="${d}" transform="translate(0 5)" fill="rgba(4,6,11,0.42)"/>`;
	const glow = `<g class="glow" fill="none" style="stroke:rgb(var(--hud-accent-rgb))" stroke-linejoin="round">${[1, 0.8, 0.6, 0.42, 0.26].map((k) => `<path d="${d}" stroke-width="${f2(mn * 0.16 * k)}" stroke-opacity="0.2"/>`).join('')}</g>`;
	const edge = `<path class="rimp" d="${d}" fill="none" stroke-width="${f2(Math.max(1.2, mn * 0.022))}" stroke-linejoin="round"/>`;
	// the border: dark gold, 4.2 wide, 5 inside the cloth's edge, every edge parallel to the cloth's; a thin dark inner line
	defs += `<linearGradient id="${id}sb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8902f"/><stop offset=".5" stop-color="#8a6a22"/><stop offset="1" stop-color="#4e3a10"/></linearGradient>`;
	const border =
		`<path d="${sharp(insetPoly(pts, STD.gap + STD.border / 2))}" fill="none" stroke="url(#${id}sb)" stroke-width="${STD.border}" stroke-linejoin="miter" stroke-miterlimit="10"/>` +
		`<path d="${sharp(insetPoly(pts, STD.gap + STD.border + 0.7))}" fill="none" stroke="rgba(10,6,2,0.8)" stroke-width="1.1" stroke-linejoin="miter" stroke-miterlimit="10"/>`;
	// the rod with a finial ball at each end, and the chains: links face on (an oval) and edge on (a bar) by turns
	const rodH = h * STD.rod;
	const cy = rodH / 2;
	const th = rodH * 0.55;
	const fr = rodH * 0.46;
	defs += `<linearGradient id="${id}rd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BRASS[0]}"/><stop offset=".35" stop-color="${BRASS[1]}"/><stop offset=".7" stop-color="${BRASS[3]}"/><stop offset="1" stop-color="${BRASS[4]}"/></linearGradient><radialGradient id="${id}rb" cx=".38" cy=".32" r=".7"><stop offset="0" stop-color="${BRASS[0]}"/><stop offset=".5" stop-color="${BRASS[2]}"/><stop offset="1" stop-color="${BRASS[4]}"/></radialGradient>`;
	const inkLine = 'stroke="#0b0805" stroke-width="1" paint-order="stroke"';
	const rod = `<rect x="${f2(fr * 0.8)}" y="${f2(cy - th / 2)}" width="${f2(w - fr * 1.6)}" height="${f2(th)}" rx="${f2(th / 2)}" fill="url(#${id}rd)" ${inkLine}/><circle cx="${f2(fr)}" cy="${f2(cy)}" r="${f2(fr)}" fill="url(#${id}rb)" ${inkLine}/><circle cx="${f2(w - fr)}" cy="${f2(cy)}" r="${f2(fr)}" fill="url(#${id}rb)" ${inkLine}/>`;
	let chains = '';
	const top = -Math.max(0, chain);
	const nl = Math.max(2, Math.round((cy - top) / 6));
	const st = (cy - top) / nl;
	for (const x of [w * 0.25, w * 0.75]) {
		for (let i = 0; i < nl; i++) {
			const ly = top + st * (i + 0.5);
			if (i % 2 === 0) chains += `<ellipse cx="${f2(x)}" cy="${f2(ly)}" rx="2.5" ry="${f2(st * 0.62)}" fill="none" stroke="#5d4720" stroke-width="2.8"/><ellipse cx="${f2(x)}" cy="${f2(ly)}" rx="2.5" ry="${f2(st * 0.62)}" fill="none" stroke="#a8823c" stroke-width="1.5"/>`;
			else chains += `<rect x="${f2(x - 0.9)}" y="${f2(ly - st * 0.66)}" width="1.8" height="${f2(st * 1.32)}" rx="0.9" fill="#a8823c" stroke="#5d4720" stroke-width="0.8"/><rect x="${f2(x - 0.3)}" y="${f2(ly - st * 0.5)}" width="0.6" height="${f2(st)}" fill="#ecd092" opacity=".7"/>`;
		}
	}
	return `<svg class="body" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"><defs>${defs}</defs>${chains}${shadow}${glow}${fills}${inner ? `<g clip-path="url(#${id}k)">${inner}</g>` : ''}${edge}${border}${rod}</svg>`;
};

/** the bare < and >: a gold line over a dark one (the mock's chevrons) */
export const chevronSvg = (dir: 1 | -1): string => {
	const d = dir < 0 ? 'M14.6 5.2 7.8 12l6.8 6.8' : 'M9.4 5.2 16.2 12l-6.8 6.8';
	return `<svg class="chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="ko" d="${d}"/><path class="ink" d="${d}"/></svg>`;
};
