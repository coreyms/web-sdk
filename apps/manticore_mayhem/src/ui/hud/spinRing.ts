// THE SPIN KEY'S FACE: concept G2 "Lane Ring" (Corey's pick from the spin symbols round 2 mock, 2026-11-19:
// spin_symbols_r2_2026-11-19, build/concepts2.js laneRing and build/app2.js; NOTES.md there). It takes the place of the
// play triangle and the stop square's flip. In Manticore the ring is gold studs that shrink away round it from one gold
// chevron head (Run Over Reindeer draws the same ring as road lane dashes; this file is that game's ui/hud/spinRing.ts,
// copied: the HUD is copied per app). Every shape is drawn here from our own numbers (NOTES "Why the geometry is ours"):
// nothing is an icon or traced.
//
// The drawing: one inline SVG in a viewBox of -50 -50 100 100 that covers the key's inside (100 = the key's inner
// diameter), angles clockwise from 12 o'clock. The ring is ONE turning layer: the SVG under three transform-only wrappers
// (HudSpin .rh the hover quarter turn and the breath, .rw the idle hop and the wind-up, .rr the loop and the brake), so
// it paints once and the compositor turns it. The stop square, the free-spins fill and the win sparks are still SVGs
// beside it. Every gradient on the ring is radial about the key's center, so its light never turns with it. Transform
// and opacity only: no filter, mask, blend mode, clip or stroke animation.
//
// The motion (the mock's numbers, from Run Over Reindeer's cars: its game/constants.ts ROAD_MOTION): at the press the ring winds back
// 16 degrees in 120 ms (the cars' squat) and spins up over 260 ms (their launch) on a curve that hands over at exactly
// the loop's speed; it turns once in 0.84 s at Regular, 1.7x at Turbo, 2.6x at Super Turbo; 570 ms before the board is at
// rest (270 brake + 300 settle on the road clock; 160 settle at Super Turbo) it brakes on a Hermite curve from its speed
// to rest, overshoots 6 degrees and swings back over the settle. A stop press: it brakes into the shortened rest of the
// round (0.62 brake, 0.38 settle). One head, so it rests wherever its brake takes it.

export type RingTheme = 'r' | 'm';

const f2 = (n: number) => Math.round(n * 100) / 100;
const PT = (r: number, a: number): [number, number] => {
	const t = (a * Math.PI) / 180;
	return [f2(r * Math.sin(t)), f2(-r * Math.cos(t))];
};
const S = (r: number, a: number) => PT(r, a).join(' ');

type Arrow = { R: number; w: number; a0: number; a1: number; hw: number; L: number; head: 'chevron' | 'wedge'; sw?: number; taper?: number };
/** one band riding the circle clockwise: tail at a0, the head's base at a1, its tip L degrees past a1 (concepts2.js
 *  arrowPath: the chevron head for the lane head, the flat wedge with no length for a dash's square end) */
function arrowPath(p: Arrow): string {
	const { R, w, a0, a1, hw, L } = p;
	const taper = p.taper ?? 1;
	const sw = p.sw ?? 5;
	const n = Math.max(3, Math.ceil((a1 - a0) / 3));
	const outer: [number, number][] = [];
	const inner: [number, number][] = [];
	for (let i = 0; i <= n; i++) {
		const u = i / n;
		const a = a0 + (a1 - a0) * u;
		const ww = w * (taper + (1 - taper) * Math.pow(u, 0.75));
		outer.push(PT(R + ww / 2, a));
		inner.push(PT(R - ww / 2, a));
	}
	let d = `M${outer[0].join(' ')}`;
	for (let i = 1; i < outer.length; i++) d += ` L${outer[i].join(' ')}`;
	if (p.head === 'wedge') d += ` L${S(R + hw / 2, a1)} L${S(R + 1.6, a1 + L)} L${S(R - 1.6, a1 + L)} L${S(R - hw / 2, a1)}`;
	else d += ` L${S(R + hw / 2, a1 - sw)} L${S(R, a1 + L)} L${S(R - hw / 2, a1 - sw)}`;
	for (let i = inner.length - 1; i >= 0; i--) d += ` L${inner[i].join(' ')}`;
	return d + ' Z';
}

const TH = {
	r: { ink: '#17141c', fill: ['#dfe6f1', '#ffffff', '#e8edf6'], hi: '#ff6a6a' },
	m: { ink: '#0d0903', fill: ['#8a6420', '#ffeab0', '#9a6f22'], hi: '#f6d58a' },
};

/** the gold's radial fill (Manticore): its bright line on the ring's radius R, so the studs read rounded */
function radialGold(id: string, R: number, w: number): string {
	const cols = TH.m.fill;
	const Rg = R + w;
	const s = (r: number) => f2(Math.max(0, Math.min(1, r / Rg)));
	return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${f2(Rg)}"><stop offset="${s(R - w * 0.62)}" stop-color="${cols[0]}"/><stop offset="${s(R - w * 0.12)}" stop-color="${cols[1]}"/><stop offset="${s(R + w * 0.05)}" stop-color="#fff6dc"/><stop offset="${s(R + w * 0.22)}" stop-color="#d9a441"/><stop offset="${s(R + w * 0.62)}" stop-color="${cols[2]}"/></radialGradient>`;
}

let UID = 0;

/** THE RING: the full face (mini false: R 30) or the thinned ring round a count (mini: R 41.5, 0.45 the weight). Its two
 *  motion trails (`<use>` copies under it, hud.css shows them only while a round plays at Turbo and Super Turbo) */
export function laneRingSvg(th: RingTheme, mini = false): string {
	const uid = ++UID;
	const t = TH[th];
	const R = mini ? 41.5 : 30;
	const k = mini ? 0.45 : 1;
	const a1 = 52;
	// the head: a short band and a wide chevron head, upper right, pointing clockwise
	const head = arrowPath({ R, w: 10 * k, a0: a1 - 16, a1, hw: 25 * k, L: 30 * (mini ? 0.7 : 1), head: 'chevron', sw: 9, taper: 1 });
	let parts = '';
	for (let i = 0; i < 6; i++) {
		const end = a1 - 30 - i * 41;
		const len = 25 - i * 2.2;
		const w = (8.2 - i * 0.75) * k;
		if (th === 'r') parts += `<path d="${arrowPath({ R, w, a0: end - len, a1: end, hw: w, L: 0.01, head: 'wedge', taper: 1 })}"/>`;
		else {
			const [x, y] = PT(R, end - len / 2);
			parts += `<circle cx="${x}" cy="${y}" r="${f2(w * 0.62)}"/>`;
		}
	}
	const trails = `<use class="t2" href="#sr${uid}" transform="rotate(-26)" opacity=".18"/><use class="t1" href="#sr${uid}" transform="rotate(-13)" opacity=".38"/>`;
	const open = '<svg class="rs" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">';
	if (th === 'r') return `${open}${trails}<g id="sr${uid}" fill="#fffdf2" stroke="${t.ink}" stroke-width="${mini ? 3 : 4.4}" stroke-linejoin="round" paint-order="stroke">${parts}<path d="${head}"/></g></svg>`;
	const gid = `srg${uid}`;
	return `${open}<defs>${radialGold(gid, R, 10 * k)}</defs>${trails}<g id="sr${uid}" fill="url(#${gid})" stroke="${t.ink}" stroke-width="${mini ? 2.2 : 3.2}" paint-order="stroke" stroke-linejoin="round">${parts}<path d="${head}"/></g></svg>`;
}

/** a rounded square, half side s, corner r */
const rsq = (s: number, r: number) => `M${-s + r} ${-s}H${s - r}Q${s} ${-s} ${s} ${-s + r}V${s - r}Q${s} ${s} ${s - r} ${s}H${-s + r}Q${-s} ${s} ${-s} ${s - r}V${-s + r}Q${-s} ${-s} ${-s + r} ${-s}Z`;

/** THE STOP (the mock's J1): a square at the center, half side 9.5, popped in while the stop is available */
export function stopSquareSvg(th: RingTheme): string {
	const gid = `ssg${++UID}`;
	const grad =
		th === 'm'
			? `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c4"/><stop offset=".5" stop-color="#f0c766"/><stop offset="1" stop-color="#a87a25"/></linearGradient>`
			: `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dde5f0"/></linearGradient>`;
	return `<svg class="cg" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false"><defs>${grad}</defs><path d="${rsq(9.5, 9.5 * 0.24)}" fill="url(#${gid})" stroke="${TH[th].ink}" stroke-width="${th === 'm' ? 2.6 : 3.4}" stroke-linejoin="round" paint-order="stroke"/></svg>`;
}

/** THE WIN FLOURISH: a ring of ten sparks and a thin lit circle, shown (opacity, scale) as a paying board lands */
export function sparksSvg(th: RingTheme): string {
	let s = '';
	for (let k = 0; k < 10; k++) {
		const a = k * 36 + 18;
		s += `<path d="M${PT(40, a).join(' ')} L${PT(48, a).join(' ')}"/>`;
	}
	return `<svg class="spk" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false"><g stroke="${th === 'm' ? '#fff3d2' : '#ffffff'}" stroke-width="2.4" stroke-linecap="round">${s}</g><circle r="44" fill="none" stroke="${TH[th].hi}" stroke-width="1.6"/></svg>`;
}

/** the free-spins fill under the thinned ring: R 41.5, 9 wide (its circumference) */
export const FILL_R = 41.5;
export const FILL_C = 2 * Math.PI * FILL_R;

// ---- the motion ----------------------------------------------------------------------------------------------------------
/** the ring's rate per turbo level: the approved mock's numbers (Run Over Reindeer's road clock, ROAD_MOTION base,
 *  turbo1, turbo2), kept as approved; this game's board runs TURBO_SCALE (1, 2.2, 4), and the brake is timed from the
 *  board's own drop whatever the rate (game/boardPace.ts) */
export const RING_RATE = [1, 1.7, 2.6] as const;
/** seconds a turn at Regular */
export const RING_P = 0.84;
/** the ring's motion per turbo level, real ms (the cars': squat, launch, brakeMs, settleMs; the overshoot about half at
 *  Super Turbo, as overshootPx 13 and 6) */
export const ringMotion = (t: 0 | 1 | 2) => ({ antic: 120 / RING_RATE[t], up: 260 / RING_RATE[t], brake: 270 / RING_RATE[t], settle: (t === 2 ? 160 : 300) / RING_RATE[t], os: t === 2 ? 0.5 : 1 });

type Tracked = HTMLElement & { __an?: Animation[] };
/** the element's computed rotation, degrees 0..360 */
const ang = (el: Element): number => {
	const m = getComputedStyle(el).transform;
	const v = m && m.match(/matrix\(([^)]+)\)/);
	if (!v) return 0;
	const p = v[1].split(',').map(parseFloat);
	const a = (Math.atan2(p[1], p[0]) * 180) / Math.PI;
	return ((a % 360) + 360) % 360;
};
/** only the animations this driver started (the CSS idle hop on the same element is the stylesheet's and stays) */
const cancelOwn = (el: Tracked) => {
	(el.__an ?? []).forEach((a) => a.cancel());
	el.__an = [];
};
const anim = (el: Tracked, kf: Keyframe[], opt: KeyframeAnimationOptions) => {
	const a = el.animate(kf, opt);
	(el.__an ??= []).push(a);
	return a;
};

export type RingPhase = 'rest' | 'spin' | 'brake';

/** THE RING'S DRIVER: the wind-up, the loop and the brake by the Web Animations API on .rw and .rr (transform only).
 *  `layer()` finds the face's wrappers now (the face is rebuilt when the key changes between its faces). */
export class RingDriver {
	phase: RingPhase = 'rest';
	private v = 0;
	private up0 = 0;
	private upEnd = 0;
	private brakeEnd = 0;
	constructor(
		private layer: () => { rw: Tracked; rr: Tracked } | null,
		private onPhase: (p: RingPhase) => void,
	) {}

	private set(p: RingPhase) {
		if (this.phase === p) return;
		this.phase = p;
		this.onPhase(p);
	}

	/** the press (or a later spin's pull away): wind back, spin up, loop */
	start(t: 0 | 1 | 2) {
		const L = this.layer();
		if (!L) return;
		const M = ringMotion(t);
		const now = performance.now();
		const a = ang(L.rw) + ang(L.rr);
		cancelOwn(L.rw);
		cancelOwn(L.rr);
		const Peff = (RING_P * 1000) / RING_RATE[t];
		const v = 360 / Peff;
		this.v = v;
		const back = 13 * M.os + 3;
		// the second leg's easing ends with slope 2, so it hands over at exactly the loop's speed: W = v * up / 2 - back
		const W = (v * M.up) / 2 - back;
		anim(
			L.rw,
			[
				{ transform: `rotate(${a}deg)`, easing: 'cubic-bezier(.3,.6,.4,1)' },
				{ offset: M.antic / (M.antic + M.up), transform: `rotate(${a - back}deg)`, easing: 'cubic-bezier(.55,0,.75,.5)' },
				{ transform: `rotate(${a + W}deg)` },
			],
			{ duration: M.antic + M.up, fill: 'forwards' },
		);
		anim(L.rr, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: Peff, iterations: Infinity, delay: M.antic + M.up });
		this.up0 = now + M.antic;
		this.upEnd = now + M.antic + M.up;
		this.set('spin');
	}

	/** brake from where it is to rest over T ms (Hermite: from its speed now to still), then the settle: an overshoot that
	 *  swings back over Ts ms (0.75 of a swing, as the cars) */
	brake(T: number, Ts: number, t: 0 | 1 | 2) {
		const L = this.layer();
		if (!L || this.phase !== 'spin') return;
		const now = performance.now();
		const M = ringMotion(t);
		const a = (ang(L.rw) + ang(L.rr)) % 360;
		let v = this.v;
		if (now < this.upEnd) v *= Math.max(0, Math.min(1, (now - this.up0) / Math.max(1, this.upEnd - this.up0)));
		cancelOwn(L.rw);
		cancelOwn(L.rr);
		// what the idle hop holds .rw at (paused while a round plays): the brake on .rr starts from the rest of the angle
		const base = ang(L.rw);
		const D = (v * T) / 2;
		const o = 6 * M.os;
		const m0 = v * T;
		const p1 = D + o;
		const tot = T + Ts;
		const fr: Keyframe[] = [];
		const N1 = 26;
		const N2 = 12;
		for (let i = 0; i <= N1; i++) {
			const u = i / N1;
			const h = (u * u * u - 2 * u * u + u) * m0 + (-2 * u * u * u + 3 * u * u) * p1;
			fr.push({ offset: (u * T) / tot, transform: `rotate(${(a - base + h).toFixed(3)}deg)` });
		}
		for (let i = 1; i <= N2; i++) {
			const u = i / N2;
			const h = D + o * Math.cos(1.5 * Math.PI * u) * (1 - u);
			fr.push({ offset: (T + u * Ts) / tot, transform: `rotate(${(a - base + h).toFixed(3)}deg)` });
		}
		fr[fr.length - 1].offset = 1;
		anim(L.rr, fr, { duration: tot, fill: 'forwards' });
		this.brakeEnd = now + tot;
		this.set('brake');
	}

	/** the brake has run out: the ring is at rest (where it stopped) */
	settled(): boolean {
		return this.phase === 'brake' && performance.now() >= this.brakeEnd;
	}

	rest() {
		this.set('rest');
	}

	/** nothing turns: every animation of this driver cancelled, the ring where the idle hop holds it (reduced motion, a
	 *  rebuilt face) */
	stop() {
		const L = this.layer();
		if (L) {
			cancelOwn(L.rw);
			cancelOwn(L.rr);
		}
		this.set('rest');
	}
}
