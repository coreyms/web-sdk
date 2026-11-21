// THE SPIN KEY'S RING, ITS PATH (Corey 2026-11-20 on the ring coming to rest at a random angle: "Fix it"). The ring
// (ui/hud/spinRing.ts draws it, RingDriver there renders this) comes to rest in its HOME pose every round: rotation
// RING_HOME, the drawing's own angle, the pose it shows before the first press.
//
// WHY A PATH: the ring's angle is ONE function of time, a chain of segments (the wind-up, the cruise, the brake, the
// settle), each a closed form in the elapsed time. A plan is made once, from where the ring is and how fast it turns at
// that moment, and covers the rest of the round to its rest; the renderer turns it into one Web Animation whose start
// time is pinned to the plan's clock. Nothing is added up frame by frame, so the rest angle is the same whether the page
// draws every 8 ms or every 700 ms: a late frame only sees the plan later (tools/ring_home_test.mjs proves it).
//
// THE REST METHODS (RestMethod; the dev hook switches them, production always uses 'steer'):
//   steer  THE CRUISE STEER (the default). When the board's rest becomes known, the cruise speed is eased once (over
//          STEER_RAMP_MS) to the one speed, within STEER_CAP of the loop's, from which the standard brake, starting at
//          its standard moment, ends on home. Where the cruise is too short for that (Super Turbo, a rest learned late)
//          the brake's shape may change within the brake family (the speed only ever falls) and the brake may begin up
//          to HOME_EXTRA_MS early or end up to HOME_EXTRA_MS late, the two together never more than HOME_EXTRA_MS. A
//          stop press (a halt) and every brake that has to begin at once take the brake's shape and up to HOME_EXTRA_MS
//          more. Only when none of that reaches home: THE SNAP (below).
//   long   the old long brake: the cruise as it is, the brake stretched until it reaches the next home ahead (no cap).
//   fixed  the cruise as it is, today's brake length, its curve bent onto the home nearest today's landing (THE SNAP
//          with no extra time).
// THE SNAP (the halt rule): the ring's art has no rotational symmetry (one chevron head; the six dashes or studs shrink
// one after the other), so no other angle can stand in for home. A brake that cannot reach home with a falling speed
// takes one smooth Hermite curve from the ring's angle and speed to the home nearest where today's brake would have
// stopped (at most 180 degrees either way), over today's brake time plus HOME_EXTRA_MS, then the usual settle. It can
// carry the ring a little faster for a moment, or swing it back, and it is never longer than today's brake + 150 ms.
//
// Pure: no DOM and no clock of its own (every call takes `now`, performance.now() ms), so the node test runs it as is.
// Only erasable TypeScript here (node --experimental-strip-types runs the file).

export type Turbo = 0 | 1 | 2;
export type RingPhase = 'rest' | 'spin' | 'brake';
export type RestMethod = 'steer' | 'long' | 'fixed';
export const REST_METHODS: readonly RestMethod[] = ['steer', 'long', 'fixed'];

/** the road clock's rate per turbo level (game/constants.ts ROAD_MOTION base, turbo1, turbo2) */
export const RING_RATE = [1, 1.7, 2.6] as const;
/** seconds a turn at Regular */
export const RING_P = 0.84;
/** the ring's motion per turbo level, real ms (the cars': squat, launch, brakeMs, settleMs; the overshoot about half at
 *  Super Turbo, as overshootPx 13 and 6) */
export const ringMotion = (t: Turbo) => ({ antic: 120 / RING_RATE[t], up: 260 / RING_RATE[t], brake: 270 / RING_RATE[t], settle: (t === 2 ? 160 : 300) / RING_RATE[t], os: t === 2 ? 0.5 : 1 });

/** THE HOME POSE: the ring's rotation at rest (the drawing's own angle: the chevron head's base at 52 degrees, its tip
 *  at 82, pointing clockwise). The idle hop at rest steps on from it (nine holds of 40 degrees, one turn a cycle). */
export const RING_HOME = 0;
/** the most a brake may run past today's brake, ms (Corey's bound: "without making the stop feel slow") */
export const HOME_EXTRA_MS = 150;
/** the cruise speed stays within this share of the loop's */
export const STEER_CAP = 0.4;
/** the cruise speed is eased to its steered value over this long (a smoothstep in speed), or the whole cruise if shorter */
export const STEER_RAMP_MS = 240;
/** a cruise shorter than this keeps its speed (no ramp: the brake's shape and timing do the steering) */
const STEER_MIN_MS = 60;
/** the board's rest moved by more than this: the plan is made again from where the ring is */
export const REPLAN_MS = 40;
/** the brake family's shares (its whole way, overshoot included, over what the starting speed would cover in the brake
 *  time): the steered brake keeps within the inner pair, a stop press may use the outer pair */
const SHARE_STEER: [number, number] = [0.3, 0.75];
const SHARE_HALT: [number, number] = [0.15, 0.85];
/** the long brake's share (the WIP's) */
const SHARE_LONG = 0.85;
/** the renderer samples a curved piece so the page's straight lines between samples stay within this of the curve
 *  (deg; a chord's error is about the curve's acceleration x step^2 / 8), every 0.5 to 25 ms */
export const SAMPLE_TOL = 0.04;

const mod = (a: number, m: number) => ((a % m) + m) % m;
/** a turn's difference folded into -180..180 */
export const wrap180 = (a: number) => mod(a + 180, 360) - 180;

// ---- the curves ------------------------------------------------------------------------------------------------------
/** CSS cubic-bezier(x1, y1, x2, y2) at x (0..1): y, and dy/dx (the wind-up's legs carry these easings on the page) */
type Bez = [number, number, number, number];
const bezAt = (e: Bez, x: number): { y: number; dy: number } => {
	const [x1, y1, x2, y2] = e;
	const cx = (s: number) => 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s;
	const dcx = (s: number) => 3 * (1 - s) * (1 - s) * x1 + 6 * (1 - s) * s * (x2 - x1) + 3 * s * s * (1 - x2);
	const cy = (s: number) => 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s;
	const dcy = (s: number) => 3 * (1 - s) * (1 - s) * y1 + 6 * (1 - s) * s * (y2 - y1) + 3 * s * s * (1 - y2);
	if (x <= 0) return { y: 0, dy: dcx(0) > 1e-9 ? dcy(0) / dcx(0) : 0 };
	if (x >= 1) return { y: 1, dy: dcx(1) > 1e-9 ? dcy(1) / dcx(1) : 0 };
	// Newton from x, then bisection if it strays
	let s = x;
	for (let i = 0; i < 8; i++) {
		const d = dcx(s);
		if (Math.abs(d) < 1e-7) break;
		const n = s - (cx(s) - x) / d;
		if (n < 0 || n > 1) break;
		s = n;
	}
	if (Math.abs(cx(s) - x) > 1e-7) {
		let lo = 0;
		let hi = 1;
		s = x;
		for (let i = 0; i < 60; i++) {
			if (cx(s) < x) lo = s;
			else hi = s;
			s = (lo + hi) / 2;
		}
	}
	const d = dcx(s);
	return { y: cy(s), dy: Math.abs(d) > 1e-9 ? dcy(s) / d : 0 };
};
/** the wind-up's two legs (today's: back over the squat, then the launch that hands over at exactly the loop's speed) */
export const WIND_BACK: Bez = [0.3, 0.6, 0.4, 1];
export const WIND_LAUNCH: Bez = [0.55, 0, 0.75, 0.5];

/** the brake family, the share s(u) of its way covered at u (0..1) for a share f: the mock's Hermite (end speed 0) from
 *  1/3 to 2/3 (f 0.55 is today's brake), and past them the same family with only falling speed: (u - u^(k+1) / (k+1))
 *  / f above 2/3, 1 - (1 - u)^(k+1) below 1/3. Its speed at u = 0 is 1/f of the way per unit, so the brake starts at
 *  exactly the ring's speed. */
export const brakePos = (u: number, f: number) => {
	if (f > 2 / 3) {
		const k = f / (1 - f);
		return (u - Math.pow(u, k + 1) / (k + 1)) / f;
	}
	if (f < 1 / 3) {
		const k = 1 / f - 1;
		return 1 - Math.pow(1 - u, k + 1);
	}
	const m = 1 / f;
	return (u * u * u - 2 * u * u + u) * m + (-2 * u * u * u + 3 * u * u);
};
/** its speed (share of the way per unit of u) */
export const brakeSpeed = (u: number, f: number) => {
	if (f > 2 / 3) return (1 - Math.pow(u, f / (1 - f))) / f;
	if (f < 1 / 3) return (1 / f) * Math.pow(1 - u, 1 / f - 1);
	const m = 1 / f;
	return (3 * u * u - 4 * u + 1) * m + (-6 * u * u + 6 * u);
};

// ---- the segments ----------------------------------------------------------------------------------------------------
/** one piece of the ring's path: from t0 (angle a0) to t1, its shape over [t0, t1]; te (at most t1) is where the
 *  path moves on to the next piece (a plan made again cuts a piece short, its shape unchanged up to te) */
type SegBase = { t0: number; t1: number; te: number; a0: number };
export type Seg =
	| (SegBase & { k: 'hold' })
	| (SegBase & { k: 'lin'; v: number })
	| (SegBase & { k: 'ramp'; v0: number; v1: number })
	| (SegBase & { k: 'bez'; d: number; e: Bez })
	| (SegBase & { k: 'herm'; m0: number; d: number; m1: number })
	| (SegBase & { k: 'brk'; d: number; f: number })
	| (SegBase & { k: 'set'; o: number });

/** a piece as handed to RingPath.push (its a0 is the path's, its te its t1 unless given) */
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type SegIn = DistOmit<Seg, 'a0' | 'te'> & { te?: number };

const segPos = (s: Seg, t: number): number => {
	const dt = Math.max(0, Math.min(t, s.te) - s.t0);
	const L = s.t1 - s.t0;
	const u = L > 0 && Number.isFinite(L) ? dt / L : 0;
	switch (s.k) {
		case 'hold':
			return s.a0;
		case 'lin':
			return s.a0 + s.v * dt;
		case 'ramp':
			return s.a0 + s.v0 * dt + (s.v1 - s.v0) * L * (u * u * u - (u * u * u * u) / 2);
		case 'bez':
			return s.a0 + s.d * bezAt(s.e, u).y;
		case 'herm':
			return s.a0 + (u * u * u - 2 * u * u + u) * s.m0 + (-2 * u * u * u + 3 * u * u) * s.d + (u * u * u - u * u) * s.m1;
		case 'brk':
			return s.a0 + s.d * brakePos(u, s.f);
		case 'set':
			return s.a0 - s.o + s.o * Math.cos(1.5 * Math.PI * u) * (1 - u);
	}
};
const segVel = (s: Seg, t: number): number => {
	const dt = Math.max(0, Math.min(t, s.te) - s.t0);
	const L = s.t1 - s.t0;
	const u = L > 0 && Number.isFinite(L) ? dt / L : 0;
	switch (s.k) {
		case 'hold':
			return 0;
		case 'lin':
			return s.v;
		case 'ramp':
			return s.v0 + (s.v1 - s.v0) * (3 * u * u - 2 * u * u * u);
		case 'bez':
			return (s.d * bezAt(s.e, u).dy) / L;
		case 'herm':
			return ((3 * u * u - 4 * u + 1) * s.m0 + (-6 * u * u + 6 * u) * s.d + (3 * u * u - 2 * u) * s.m1) / L;
		case 'brk':
			return (s.d * brakeSpeed(u, s.f)) / L;
		case 'set':
			return (s.o * (-1.5 * Math.PI * Math.sin(1.5 * Math.PI * u) * (1 - u) - Math.cos(1.5 * Math.PI * u))) / L;
	}
};
const curved = (s: Seg) => s.k !== 'hold' && s.k !== 'lin';

/** THE PATH: the segments end to end (each te is the next one's t0), the last one open (te Infinity) or not */
export class RingPath {
	segs: Seg[] = [];
	private find(t: number): Seg | null {
		const S = this.segs;
		if (!S.length) return null;
		for (let i = S.length - 1; i >= 0; i--) if (S[i].t0 <= t) return S[i];
		return S[0];
	}
	pos(t: number): number {
		const s = this.find(t);
		return s ? segPos(s, Math.max(t, s.t0)) : 0;
	}
	vel(t: number): number {
		const s = this.find(t);
		if (!s || t < s.t0) return 0;
		return t >= s.te ? 0 : segVel(s, t);
	}
	/** where the path ends (the rest), Infinity while it is open */
	get end(): number {
		const s = this.segs[this.segs.length - 1];
		return s ? s.te : -Infinity;
	}
	/** the path from t on is dropped (the piece under way keeps its shape up to t; a piece that starts at t stays, of no
	 *  length, so the next piece starts from its angle) */
	cut(t: number) {
		this.segs = this.segs.filter((s) => s.t0 <= t);
		const s = this.segs[this.segs.length - 1];
		if (s && s.te > t) s.te = t;
	}
	/** add a piece from where the path is now: its a0 is the path's angle at t0 (so the path never jumps) */
	push(seg: SegIn) {
		if (!(seg.t1 > seg.t0)) return;
		const prev = this.segs[this.segs.length - 1];
		const a0 = prev ? segPos(prev, seg.t0) : 0;
		this.segs.push({ ...seg, a0, te: seg.te ?? seg.t1 } as Seg);
	}
	reset(a: number, t: number) {
		this.segs = [{ k: 'hold', t0: t, t1: Infinity, te: Infinity, a0: a }];
	}
	/** THE RENDER: keyframes of (angle - base) from t0 to the path's end, the curved pieces every SAMPLE_MS, the
	 *  straight ones at their ends (the page interpolates linearly between keyframes) */
	keyframes(t0: number, base: number): { offset: number; deg: number }[] {
		return this.sample(t0, this.end, base);
	}
	/** the same samples over any span [t0, t1] (the wind-up of a spin that starts while the ring still turns) */
	sample(t0: number, t1: number, base: number): { offset: number; deg: number }[] {
		if (!(t1 > t0) || !Number.isFinite(t1)) return [{ offset: 0, deg: this.pos(t0) - base }];
		const ts: number[] = [t0];
		for (const s of this.segs) {
			const a = Math.max(s.t0, t0);
			const b = Math.min(s.te, t1);
			if (!(b > a)) continue;
			if (curved(s)) {
				// the piece's largest acceleration, from its speed at 32 points
				let acc = 0;
				let pv = segVel(s, a);
				for (let i = 1; i <= 32; i++) {
					const t = a + ((b - a) * i) / 32;
					const v = segVel(s, t);
					acc = Math.max(acc, Math.abs(v - pv) / ((b - a) / 32));
					pv = v;
				}
				const h = Math.max(0.5, Math.min(25, acc > 0 ? Math.sqrt((8 * SAMPLE_TOL) / acc) : 25));
				const n = Math.min(400, Math.max(2, Math.ceil((b - a) / h)));
				for (let i = 1; i < n; i++) ts.push(a + ((b - a) * i) / n);
			}
			ts.push(b);
		}
		ts.sort((x, y) => x - y);
		const out: { offset: number; deg: number }[] = [];
		let last = -1;
		for (const t of ts) {
			if (t - last < 0.05) continue;
			last = t;
			out.push({ offset: (t - t0) / (t1 - t0), deg: this.pos(t) - base });
		}
		out[0].offset = 0;
		out[out.length - 1].offset = 1;
		return out;
	}
}

// ---- the solves ------------------------------------------------------------------------------------------------------
type BrakeSol = { T: number; shape: 'brake' | 'snap'; d: number; f: number; m0: number };

/** a brake from speed s over T ms whose rest (before the overshoot o) is D ahead: the brake family when its share
 *  falls in `share`, else null */
const familyBrake = (s: number, T: number, D: number, o: number, share: [number, number]): BrakeSol | null => {
	if (!(s > 0) || !(T > 0)) return null;
	const f = (D + o) / (s * T);
	if (f < share[0] || f > share[1]) return null;
	return { T, shape: 'brake', d: D + o, f, m0: s * T };
};
/** THE SNAP: one Hermite from angle a at speed s to the home nearest the natural landing (a + s T / 2), over T */
const snapBrake = (a: number, s: number, T: number, o: number, home: number): BrakeSol => {
	const nat = Math.max(0, s) * (T / 2);
	const D = nat + wrap180(home - (a + nat));
	return { T, shape: 'snap', d: D + o, f: 0, m0: s * T };
};
/** the brake that starts at once (a stop press, a rest learned too late, the board home before the ring knew): from
 *  angle a, speed s, today's brake T; the shortest extra time (0 to HOME_EXTRA_MS) and the share nearest today's that
 *  land on home with a falling speed, else THE SNAP over T + HOME_EXTRA_MS */
export const solveBrakeNow = (a: number, s: number, T: number, o: number, home = RING_HOME): BrakeSol => {
	let best: BrakeSol | null = null;
	let cost = Infinity;
	const D0 = mod(home - a, 360);
	for (let post = 0; post <= HOME_EXTRA_MS + 1e-9; post += 5) {
		const TT = T + post;
		const fNat = 0.5 + o / Math.max(1e-6, s * TT);
		for (let j = 0; j < 4; j++) {
			const b = familyBrake(s, TT, D0 + 360 * j, o, SHARE_HALT);
			if (!b) continue;
			const c = post / HOME_EXTRA_MS + 1.5 * Math.abs(b.f - fNat);
			if (c < cost) {
				cost = c;
				best = b;
			}
		}
	}
	return best ?? snapBrake(a, s, T + HOME_EXTRA_MS, o, home);
};
/** the long brake: the next home ahead at the long share, stretched as long as it takes */
const longBrake = (a: number, s: number, T: number, o: number, vLoop: number, home = RING_HOME): BrakeSol => {
	const se = Math.max(s, 0.25 * vLoop);
	let D = mod(home - a, 360);
	while (D + o < SHARE_HALT[0] * se * T) D += 360;
	let f = (D + o) / (se * T);
	let TT = T;
	if (f > SHARE_LONG) {
		TT = (D + o) / (SHARE_LONG * se);
		f = SHARE_LONG;
	}
	// (the family starts at the speed it was solved with; a slower ring, a stop in the wind-up, takes the Hermite there)
	if (s < se) return { T: TT, shape: 'snap', d: D + o, f: 0, m0: s * TT };
	return { T: TT, shape: 'brake', d: D + o, f, m0: s * TT };
};

/** THE CRUISE STEER's solve: from tc (angle a, speed s) to a board at rest at restAt, the brake T and settle Ts
 *  (today's), the loop's speed v: the cruise speed v1, the brake's rest share g (0.5 is today's), how early the brake
 *  starts (pre) and how late it ends (post), the cheapest that lands on home exactly. null: none does. */
export type CruiseSol = { v1: number; R: number; tb: number; T: number; d: number; f: number; pre: number; post: number; cost: number };
export const solveCruise = (tc: number, a: number, s: number, restAt: number, T: number, Ts: number, o: number, v: number, home = RING_HOME, share: [number, number] = SHARE_STEER): CruiseSol | null => {
	let best: CruiseSol | null = null;
	for (let pre = 0; pre <= HOME_EXTRA_MS + 1e-9; pre += 10) {
		for (let post = 0; pre + post <= HOME_EXTRA_MS + 1e-9; post += 10) {
			const tb = restAt - Ts - T - pre;
			const C = tb - tc;
			if (C < 0) continue;
			const TT = T + pre + post;
			const timeCost = (pre + 1.5 * post) / HOME_EXTRA_MS;
			if (best && timeCost >= best.cost) continue;
			if (C < STEER_MIN_MS) {
				// no ramp: the speed stays s, the share is solved
				if (!(s > 0)) continue;
				for (let j = -1; j <= 2; j++) {
					const L0 = a + s * C;
					const D = mod(home - L0, 360) + 360 * j;
					const g = D / (s * TT);
					const f = g + o / (s * TT);
					if (f < share[0] || f > share[1]) continue;
					const c = Math.abs(s / v - 1) / STEER_CAP + 2 * Math.abs(g - 0.5) + timeCost;
					if (!best || c < best.cost) best = { v1: s, R: 0, tb, T: TT, d: D + o, f, pre, post, cost: c };
				}
				continue;
			}
			const R = Math.min(STEER_RAMP_MS, C);
			for (let gi = 0; gi <= 18; gi++) {
				const g = 0.3 + gi * 0.025;
				const B = C - R / 2 + g * TT;
				const A = a + (s * R) / 2;
				const Lnat = A + v * B;
				const H0 = Lnat + wrap180(home - Lnat);
				for (let j = -1; j <= 1; j++) {
					const v1 = (H0 + 360 * j - A) / B;
					const dev = Math.abs(v1 / v - 1);
					if (dev > STEER_CAP + 1e-9 || !(v1 > 0)) continue;
					const f = g + o / (v1 * TT);
					if (f < share[0] || f > share[1]) continue;
					const c = dev / STEER_CAP + 2 * Math.abs(g - 0.5) + timeCost;
					if (!best || c < best.cost) best = { v1, R, tb, T: TT, d: g * v1 * TT + o, f, pre, post, cost: c };
				}
			}
		}
	}
	return best;
};

// ---- the round's record (the probes' and the test's) ---------------------------------------------------------------
export type EndKind = 'cruise' | 'late' | 'halt' | 'now';
export type RingRound = {
	n: number;
	method: RestMethod;
	turbo: Turbo;
	/** the loop's speed, deg / ms, and when the wind-up hands over to it */
	v: number;
	startAt: number;
	upEnd: number;
	/** how the brake was planned (its last plan): the cruise steered to it, a rest learned late, a stop press, the board
	 *  home before any rest was known */
	kind: EndKind | null;
	shape: 'brake' | 'snap' | null;
	plans: number;
	brakeAt: number | null;
	restAt: number | null;
	/** the brake's length (its start to the ring at rest) and today's for the same end (the code before the home pose) */
	brakeMs: number | null;
	todayMs: number | null;
	/** the largest share the cruise speed moved off the loop's */
	steer: number;
	/** the planned rest angle (0..360) and its distance from home */
	rest: number | null;
	err: number | null;
	/** the brake's fastest and slowest speed as shares of the loop's (above 1: the snap carries it faster; below 0: it
	 *  swings back) */
	peak: number | null;
	low: number | null;
	/** how it ended: at rest, the next spin began first, nothing turns (reduced motion, a rebuilt face) */
	ended: 'rest' | 'next' | 'stop' | null;
};

export type RingInputs = { live: boolean; restIn: number | null; serial: number; halted: boolean; reduced: boolean; turbo: Turbo; resting: boolean };

/** THE RING'S BRAIN: the round as the ring sees it (HudSpin's tick feeds it every frame) and its path */
export class RingCore {
	phase: RingPhase = 'rest';
	method: RestMethod = 'steer';
	path = new RingPath();
	/** the path is open (the wind-up and the loop, no end planned yet): the renderer draws it as the wind-up and an
	 *  endless loop */
	open = false;
	/** bumped on every new path, for the renderer */
	version = 0;
	/** the round's own start count last seen (game/boardPace.ts serial) */
	lastSerial = 0;
	/** record the rounds (the dev hook turns it on; production never does) */
	record = false;
	rounds: RingRound[] = [];
	/** the open path's start (the wind-up's clock), its wind-up shape, the loop's speed */
	t0 = 0;
	windUp: { kind: 'wind'; a: number; back: number; W: number; antic: number; up: number } | { kind: 'again'; a: number; vNow: number; W: number; up: number } | null = null;
	v = 0;
	upEnd = 0;
	private turbo: Turbo = 0;
	private startedAt = -Infinity;
	/** a start the board's count has not matched yet (the press winds the ring up a moment before the count goes up) */
	private unmatched = false;
	private sawLive = false;
	private plan: { kind: EndKind; restAt: number; brakeAt: number; endAt: number } | null = null;
	private cur: RingRound | null = null;
	private n = 0;
	private onPhase: (p: RingPhase) => void;
	constructor(onPhase: (p: RingPhase) => void = () => {}) {
		this.onPhase = onPhase;
	}

	private set(p: RingPhase) {
		if (this.phase === p) return;
		this.phase = p;
		this.onPhase(p);
	}
	private close(how: 'rest' | 'next' | 'stop') {
		const r = this.cur;
		if (!r) return;
		r.ended = how;
		this.cur = null;
	}

	/** the angle (deg, unwrapped) and speed (deg / ms) of the ring's path at t */
	angle(t: number) {
		return this.path.pos(t);
	}
	speed(t: number) {
		return this.path.vel(t);
	}

	/** THE PRESS (or a later spin's pull away): wind back, spin up, loop. `a` is the ring's angle on the page now (the
	 *  idle hop may have moved it at rest); while the last round's path is still running its own angle is used. A spin
	 *  that begins while the ring still turns (back to back, no gap) does not wind back: it speeds up again from the
	 *  speed it has to the loop's over the spin-up's time, so there is no step and no reverse. */
	start(now: number, t: Turbo, a: number) {
		const M = ringMotion(t);
		// (a rest this frame has not seen yet: a press can come before the next tick)
		this.advance(now);
		const moving = this.phase !== 'rest' && this.path.segs.length > 0;
		const vNow = moving ? this.path.vel(now) : 0;
		if (moving) a = this.path.pos(now);
		if (this.cur) this.close(this.phase === 'rest' ? 'rest' : 'next');
		const Peff = (RING_P * 1000) / RING_RATE[t];
		const v = 360 / Peff;
		this.v = v;
		this.turbo = t;
		this.t0 = now;
		if (vNow > 0.05 * v) {
			const up = M.up;
			const W = ((vNow + v) / 2) * up;
			this.windUp = { kind: 'again', a, vNow, W, up };
			this.path.segs = [{ k: 'herm', t0: now, t1: now + up, te: now + up, a0: a, m0: vNow * up, d: W, m1: v * up }];
			this.upEnd = now + up;
		} else {
			const back = 13 * M.os + 3;
			// the second leg's easing ends with slope 2, so it hands over at exactly the loop's speed: W = v * up / 2 - back
			const W = (v * M.up) / 2 - back;
			this.windUp = { kind: 'wind', a, back, W, antic: M.antic, up: M.up };
			this.path.segs = [
				{ k: 'bez', t0: now, t1: now + M.antic, te: now + M.antic, a0: a, d: -back, e: WIND_BACK },
				{ k: 'bez', t0: now + M.antic, t1: now + M.antic + M.up, te: now + M.antic + M.up, a0: a - back, d: W + back, e: WIND_LAUNCH },
			];
			this.upEnd = now + M.antic + M.up;
		}
		this.path.push({ k: 'lin', t0: this.upEnd, t1: Infinity, te: Infinity, v });
		this.open = true;
		this.plan = null;
		this.sawLive = false;
		this.startedAt = now;
		this.unmatched = true;
		this.version++;
		if (this.record) {
			this.cur = { n: ++this.n, method: this.method, turbo: t, v, startAt: now, upEnd: this.upEnd, kind: null, shape: null, plans: 0, brakeAt: null, restAt: null, brakeMs: null, todayMs: null, steer: 0, rest: null, err: null, peak: null, low: null, ended: null };
			this.rounds.push(this.cur);
			if (this.rounds.length > 60) this.rounds.shift();
		}
		this.set('spin');
	}

	/** the phase by the clock: the planned brake has begun, the planned rest has come */
	advance(now: number) {
		const P = this.plan;
		if (this.phase === 'spin' && P && now >= P.brakeAt) this.set('brake');
		if (this.phase === 'brake' && P && now >= P.endAt) {
			this.close('rest');
			this.set('rest');
		}
	}

	/** THE FRAME (HudSpin's tick): a new spin starts the ring (onStart: HudSpin's own start, which calls start()), and
	 *  while it spins the brake is planned from what the board says: a stop press brakes into the shortened round, a rest
	 *  within the brake's lead brakes at once, a rest further off steers the cruise (planned again if it moves), the
	 *  board home with no rest seen brakes at once. Today's moments, so only the path changes. */
	frame(now: number, inp: RingInputs, onStart: () => void) {
		if (inp.reduced) {
			if (this.phase !== 'rest') this.stop();
			this.lastSerial = inp.serial;
			return;
		}
		this.advance(now);
		if (inp.serial !== this.lastSerial) {
			const one = inp.serial === this.lastSerial + 1;
			this.lastSerial = inp.serial;
			// (the press has already wound it up a moment ago: the same spin, once; a second count, or a count up by more
			// than one between two frames, is the next spin)
			if (this.phase === 'spin' && now - this.startedAt < 600 && this.unmatched && one) this.unmatched = false;
			else {
				onStart();
				this.unmatched = false;
			}
		}
		if (this.phase !== 'spin') return;
		if (inp.live) this.sawLive = true;
		const M = ringMotion(inp.turbo);
		const lead = M.brake + M.settle;
		const r = inp.restIn;
		if (r !== null && inp.halted) this.brakeNow(now, 'halt', Math.max(70, r * 0.62), Math.max(50, r * 0.38), inp.turbo);
		else if (r !== null) {
			const restAt = now + r;
			if (this.plan && Math.abs(restAt - this.plan.restAt) <= REPLAN_MS) return;
			if (r <= lead) {
				const k = Math.max(0.2, r / lead);
				this.brakeNow(now, 'late', M.brake * k, M.settle * k, inp.turbo, restAt);
			} else this.planCruise(now, restAt, inp.turbo);
		} else if (!inp.live && (this.sawLive || inp.resting)) this.brakeNow(now, 'now', M.brake, M.settle, inp.turbo);
	}

	private note(kind: EndKind, brakeAt: number, endAt: number, todayMs: number, shape: 'brake' | 'snap', steer: number) {
		const r = this.cur;
		if (!r) return;
		r.kind = kind;
		r.shape = shape;
		r.plans += 1;
		r.brakeAt = brakeAt;
		r.restAt = endAt;
		r.brakeMs = endAt - brakeAt;
		r.todayMs = todayMs;
		r.steer = Math.max(r.steer, steer);
		const rest = mod(this.path.pos(endAt), 360);
		r.rest = rest;
		r.err = Math.abs(wrap180(rest - RING_HOME));
		let hi = -Infinity;
		let lo = Infinity;
		for (let i = 0; i <= 60; i++) {
			const w = this.path.vel(brakeAt + ((endAt - brakeAt) * i) / 60) / this.v;
			hi = Math.max(hi, w);
			lo = Math.min(lo, w);
		}
		r.peak = hi;
		r.low = lo;
	}

	private pushBrake(tb: number, b: BrakeSol, Ts: number, o: number) {
		if (b.shape === 'snap') this.path.push({ k: 'herm', t0: tb, t1: tb + b.T, m0: b.m0, d: b.d, m1: 0 });
		else this.path.push({ k: 'brk', t0: tb, t1: tb + b.T, d: b.d, f: b.f });
		this.path.push({ k: 'set', t0: tb + b.T, t1: tb + b.T + Ts, o });
		// (past the settle's end the path holds its last angle: pos() clamps each piece at its te)
	}

	/** a brake that begins now, over today's T and Ts (the method picks its curve and length) */
	brakeNow(now: number, kind: EndKind, T: number, Ts: number, t: Turbo, restAt?: number) {
		const M = ringMotion(t);
		const o = 6 * M.os;
		const a = this.path.pos(now);
		const s = this.path.vel(now);
		const b = this.method === 'long' ? longBrake(a, s, T, o, this.v) : this.method === 'fixed' ? snapBrake(a, s, T, o, RING_HOME) : solveBrakeNow(a, s, T, o);
		this.path.cut(now);
		this.pushBrake(now, b, Ts, o);
		this.open = false;
		const endAt = now + b.T + Ts;
		this.plan = { kind, restAt: restAt ?? endAt, brakeAt: now, endAt };
		this.version++;
		this.note(kind, now, endAt, T + Ts, b.shape, this.cruiseSteer(now));
		this.set('brake');
	}

	/** the largest share the cruise's speed has been off the loop's up to t (the wind-up not counted) */
	private cruiseSteer(t: number): number {
		let m = 0;
		for (const s of this.path.segs) {
			if (s.t0 < this.upEnd - 1e-6 || s.t0 >= t) continue;
			if (s.k === 'lin') m = Math.max(m, Math.abs(s.v / this.v - 1));
			if (s.k === 'ramp') m = Math.max(m, Math.abs(s.v0 / this.v - 1), Math.abs(segVel(s, Math.min(t, s.te)) / this.v - 1));
		}
		return m;
	}

	/** a rest further off than the brake's lead: the cruise to the brake and the brake, planned to the rest */
	private planCruise(now: number, restAt: number, t: Turbo) {
		const M = ringMotion(t);
		const T = M.brake;
		const Ts = M.settle;
		const o = 6 * M.os;
		const tc = Math.max(now, this.upEnd);
		if (restAt - T - Ts - tc <= 0) {
			const k = Math.max(0.2, (restAt - now) / (T + Ts));
			this.brakeNow(now, 'late', T * k, Ts * k, t, restAt);
			return;
		}
		const a = this.path.pos(tc);
		const s = tc > now ? this.v : this.path.vel(tc);
		this.path.cut(tc);
		let tb = restAt - T - Ts;
		let b: BrakeSol;
		let shape: 'brake' | 'snap' = 'brake';
		// (the steered brake's own shares first; a short cruise may take the stop press's wider ones before a snap)
		const sol = this.method === 'steer' ? (solveCruise(tc, a, s, restAt, T, Ts, o, this.v) ?? solveCruise(tc, a, s, restAt, T, Ts, o, this.v, RING_HOME, SHARE_HALT)) : null;
		if (sol) {
			tb = sol.tb;
			if (sol.R > 0 && Math.abs(sol.v1 - s) > 1e-9) this.path.push({ k: 'ramp', t0: tc, t1: tc + sol.R, v0: s, v1: sol.v1 });
			else if (sol.R > 0) this.path.push({ k: 'lin', t0: tc, t1: tc + sol.R, v: s });
			this.path.push({ k: 'lin', t0: tc + sol.R, t1: tb, v: sol.v1 });
			b = { T: sol.T, shape: 'brake', d: sol.d, f: sol.f, m0: sol.v1 * sol.T };
		} else {
			// the cruise as it is to the standard brake (long, fixed, or a steer with nothing that lands)
			this.path.push({ k: 'lin', t0: tc, t1: tb, v: s });
			const ab = this.path.pos(tb);
			b = this.method === 'long' ? longBrake(ab, s, T, o, this.v) : this.method === 'fixed' ? snapBrake(ab, s, T, o, RING_HOME) : snapBrake(ab, s, T + HOME_EXTRA_MS, o, RING_HOME);
			shape = b.shape;
		}
		this.pushBrake(tb, b, Ts, o);
		this.open = false;
		const endAt = tb + b.T + Ts;
		this.plan = { kind: 'cruise', restAt, brakeAt: tb, endAt };
		this.version++;
		this.note('cruise', tb, endAt, T + Ts, shape, this.cruiseSteer(Infinity));
	}

	/** the brake has run out: the ring is at rest (on home) */
	settled(now: number): boolean {
		return this.phase === 'brake' && !!this.plan && now >= this.plan.endAt;
	}
	/** a face rebuilt mid round: nothing of this path is on the page any more */
	rest() {
		this.close('stop');
		this.plan = null;
		this.open = false;
		this.path.segs = [];
		this.set('rest');
	}
	/** nothing turns (reduced motion, a rebuilt face) */
	stop() {
		this.rest();
	}
	/** a spin still live starts again on the next frame (a rebuilt face) */
	forgetSerial() {
		this.lastSerial = -1;
	}
}
