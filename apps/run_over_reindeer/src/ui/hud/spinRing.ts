// THE SPIN KEY'S FACE: concept G2 "Lane Ring" (Corey's pick from the spin symbols round 2 mock, 2026-11-19:
// spin_symbols_r2_2026-11-19, build/concepts2.js laneRing and build/app2.js; NOTES.md there). It takes the place of the
// play triangle and the stop square's flip. Road lane dashes shrink away round the ring from one painted chevron head
// (Reindeer); in Manticore the dashes are gold studs. Every shape is drawn here from our own numbers (NOTES "Why the
// geometry is ours"): nothing is an icon or traced.
//
// The drawing: one inline SVG in a viewBox of -50 -50 100 100 that covers the key's inside (100 = the key's inner
// diameter), angles clockwise from 12 o'clock. The ring is ONE turning layer: the SVG under three transform-only wrappers
// (HudSpin .rh the hover quarter turn and the breath, .rw the idle hop and the wind-up, .rr the loop and the brake), so
// it paints once and the compositor turns it. The stop square, the free-spins fill and the win sparks are still SVGs
// beside it. Every gradient on the ring is radial about the key's center, so its light never turns with it. Transform
// and opacity only: no filter, mask, blend mode, clip or stroke animation.
//
// The motion (the mock's numbers, from the cars' own: game/constants.ts ROAD_MOTION): at the press the ring winds back
// 16 degrees in 120 ms (the cars' squat) and spins up over 260 ms (their launch) on a curve that hands over at exactly
// the loop's speed; it turns once in 0.84 s at Regular, 1.7x at Turbo, 2.6x at Super Turbo; 570 ms before the board is at
// rest (270 brake + 300 settle on the road clock; 160 settle at Super Turbo) it brakes on a Hermite curve from its speed
// to rest, overshoots 6 degrees and swings back over the settle. A stop press: it brakes into the shortened rest of the
// round (0.62 brake, 0.38 settle). THE HOME POSE (Corey 2026-11-20, "Fix it"): one head, so every brake is planned to
// end on the drawing's own angle, the pose at rest before the first press (ui/hud/ringPlan.ts: the cruise steer, and its
// rule for a stop press).

import { RingCore, type RingInputs, type RingPhase, type Turbo } from './ringPlan';
export { RING_RATE, RING_P, ringMotion, RING_HOME, type RingPhase, type RestMethod, REST_METHODS } from './ringPlan';

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
// The ring's path (its angle as one function of time, the wind-up, the cruise, the brake and the settle, and the HOME
// POSE every brake lands on) is ui/hud/ringPlan.ts, pure and tested in node (tools/ring_home_test.mjs). This driver only
// draws it: by the Web Animations API on .rw and .rr (transform only), each animation's start time pinned to the
// path's own clock, so what the page shows at any frame is the path at that frame's time, whatever the frame rate.

type Tracked = HTMLElement & { __an?: Animation[] };
/** the element's computed rotation, degrees 0..360 */
export const ang = (el: Element): number => {
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
/** an animation on the path's clock: its start time is the path's moment t0 (document.timeline shares
 *  performance.now()'s origin), so it never waits for the next frame to begin and a late frame shows it further on.
 *  (The frame being drawn is a few ms older than t0: the animations hold their first keyframe until then, fill both.) */
const anim = (el: Tracked, kf: Keyframe[], opt: KeyframeAnimationOptions, t0: number) => {
	const a = el.animate(kf, opt);
	try {
		a.startTime = t0;
	} catch {
		// (a browser that will not take a start time plays it from its next frame, as before)
	}
	(el.__an ??= []).push(a);
	return a;
};
const rot = (deg: number) => `rotate(${deg.toFixed(3)}deg)`;

/** THE RING'S DRIVER: draws RingCore's path on the face's wrappers. `layer()` finds the face's wrappers now (the face is
 *  rebuilt when the key changes between its faces). */
export class RingDriver {
	/** the round as the ring sees it, and its path (ui/hud/ringPlan.ts) */
	core: RingCore;
	private drawn = -1;
	constructor(
		private layer: () => { rw: Tracked; rr: Tracked } | null,
		onPhase: (p: RingPhase) => void,
	) {
		this.core = new RingCore(onPhase);
	}

	get phase(): RingPhase {
		return this.core.phase;
	}

	/** the press (or a later spin's pull away): wind back, spin up, loop (RingCore.start) */
	start(t: Turbo) {
		const L = this.layer();
		if (!L) return;
		const now = performance.now();
		this.core.start(now, t, ang(L.rw) + ang(L.rr));
		this.draw(now);
	}

	/** HudSpin's tick: RingCore.frame (a new spin, the brake planned from the board), then the path drawn if it changed */
	frame(inp: RingInputs, onStart: () => void) {
		if (inp.reduced) {
			if (this.core.phase !== 'rest') this.stop();
			this.core.lastSerial = inp.serial;
			return;
		}
		const now = performance.now();
		this.core.frame(now, inp, onStart);
		this.draw(now);
	}

	/** THE HOVER (desktop pointers): on, the quarter turn forward; off, forward home and the bounce (RingCore.hover) */
	hover(on: boolean) {
		const L = this.layer();
		if (!L) return;
		const now = performance.now();
		this.core.hover(now, on, ang(L.rw) + ang(L.rr));
		this.draw(now);
	}

	/** a brake from now over T ms and a settle of Ts (onto home, RingCore.brakeNow) */
	brake(T: number, Ts: number, t: Turbo) {
		if (this.core.phase !== 'spin') return;
		const now = performance.now();
		this.core.brakeNow(now, 'now', T, Ts, t);
		this.draw(now);
	}

	/** the brake has run out: the ring is at rest (on home) */
	settled(): boolean {
		return this.core.settled(performance.now());
	}

	/** the face is being rebuilt: its elements and this path go together */
	rest() {
		this.core.rest();
	}

	/** nothing turns: every animation of this driver cancelled, the ring where the idle hop holds it (reduced motion) */
	stop() {
		const L = this.layer();
		if (L) {
			cancelOwn(L.rw);
			cancelOwn(L.rr);
		}
		this.core.stop();
		this.drawn = this.core.version;
	}

	/** THE DRAWING, once per new path. Open (no rest planned yet): the wind-up on .rw (today's two legs with their own
	 *  easings, or the speed-up of a spin that starts while the ring still turns) and the endless loop on .rr. Planned:
	 *  .rw left to the idle hop (paused through a round) and the whole path from now to its rest on .rr, less the hop's
	 *  angle, sampled finely enough to stay within 0.04 degrees of it; it holds the rest when done. */
	private draw(now: number) {
		const C = this.core;
		if (C.version === this.drawn) return;
		const L = this.layer();
		if (!L) return;
		this.drawn = C.version;
		cancelOwn(L.rw);
		cancelOwn(L.rr);
		const P = C.path;
		const w = C.windUp;
		if (C.open && w) {
			const t0 = C.t0;
			if (w.kind === 'wind') {
				anim(
					L.rw,
					[
						{ transform: rot(w.a), easing: 'cubic-bezier(.3,.6,.4,1)' },
						{ offset: w.antic / (w.antic + w.up), transform: rot(w.a - w.back), easing: 'cubic-bezier(.55,0,.75,.5)' },
						{ transform: rot(w.a + w.W) },
					],
					{ duration: w.antic + w.up, fill: 'both' },
					t0,
				);
			} else
				anim(
					L.rw,
					P.sample(t0, C.upEnd, 0).map((k) => ({ offset: k.offset, transform: rot(k.deg) })),
					{ duration: C.upEnd - t0, fill: 'both' },
					t0,
				);
			anim(L.rr, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 360 / C.v, iterations: Infinity, delay: C.upEnd - t0 }, t0);
			return;
		}
		if (!P.segs.length) return;
		// what the idle hop holds .rw at (paused while a round plays): .rr carries the rest of the angle
		const base = ang(L.rw);
		const end = P.end;
		if (end > now && Number.isFinite(end)) {
			anim(
				L.rr,
				P.keyframes(now, base).map((k) => ({ offset: k.offset, transform: rot(k.deg) })),
				{ duration: end - now, fill: 'both' },
				now,
			);
		} else {
			const d = rot(P.pos(now) - base);
			anim(L.rr, [{ transform: d }, { transform: d }], { duration: 1, fill: 'both' }, now);
		}
	}
}
