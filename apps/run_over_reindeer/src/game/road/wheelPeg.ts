// THE SUPER WHEEL'S PEG, its physics alone (Corey 2026-11-20, the layout page round 3: "the pin ... should be bouncing
// most of the spins"). Pure: no Pixi, no constants import, so game/road/superWheel.ts steps it every frame and the node
// check tools/wheel_peg_check.mjs steps it with random spins and frame lengths from 8 to 700 ms.
//
// Ported from the layout page's stepPegBody (~/Desktop/Run Over Reindeer/wheel_layout_r3_2026-11-20/src/app.js), the
// "whole flapper" contact with its "flick on release":
//   - the flapper is its DRAWN OUTLINE (2026-11-20, the deeper pin: it can rest against a stud's side, so the contact is
//     the outline, not a line): its half width `hw` at even steps from the bolt to the tip (tools/build_super_wheel.py
//     make_peg profile, scaled with the peg; flapGap); a stud's circle (its outer radius `studOut`) never overlaps it.
//     Without an outline it is the page's line from bolt to tip, `rc` thick;
//   - the disc's turn since the last step is walked in pieces of at most `subDeg` degrees (the spring stepped with each
//     piece's share of the time), so no stud ever jumps past the flapper between two frames, however long the frame;
//   - a stud that overlaps the flapper pushes it out on the side it was on (in quarter degree steps, then halved 20
//     times), and the flapper keeps `fling` of that push's speed (its "flick" when the stud lets go);
//   - a damped spring (stiffness, damping; degrees and seconds, stepped at most `springStepS` at a time) pulls it back
//     to straight; it never turns past maxSwing (free, it bounces off that stop; held by a stud, it stays there);
//   - a stud's first contact is its tick (one per stud: `contacts`);
//   - THE REST (2026-11-20, Corey: "Go deeper"): a stop can leave the flapper leaning on a stud's side, in contact, as a
//     real clicker does; one balanced on the stud's very top (the stud blocking less than edgeDeg of its swing) slips off
//     and comes back straight.
//   - THE STOP'S RELEASE (2026-11-21, Corey: "Give the pin spring in those cases, so it rolls back inward towards the
//     wedge"): a stop that would leave the flapper held on the stud that just passed the top is followed by a short roll
//     of the disc (pegReleaseDeg, pegReleaseTurn), so the stud slips out from under the tip and the spring swings the
//     flapper back inward, into the winning wedge, to hang straight.
// Everything is time based: the same turn of the disc over the same time gives the same swing whatever the frame rate.
// It never pushes the wheel while it spins (stepPeg only reads the disc's turn); the release is the one roll the pin
// causes, planned from geometry alone, after the spin's own stop.

const DEG = Math.PI / 180;

/** the flapper's place (wheel units, y down, the wheel's centre at 0, 0): its bolt at (0, by), its tip L below it when
 *  straight; the studs' ring radius and the angle between two studs (degrees); its outline `hw` (half widths, bolt to
 *  tip) against the studs' radius `studOut`, or without them the page's line, `rc` (stud radius plus half thickness) */
export type PegGeom = { L: number; by: number; rc: number; studR: number; step: number; studOut?: number; hw?: readonly number[] };
export type PegParams = { stiffness: number; damping: number; fling: number; maxSwing: number; subDeg: number; springStepS: number; flingMax: number; edgeDeg?: number };
/** phi the flapper's turn off straight (degrees; + is the way the studs push it while the wheel spins, its turn falling), v its speed
 *  (degrees a second); theta the disc's turn it last stepped at; onStud the stud touching it (an index along the rim
 *  through every turn, null: none); lastStud the stud that ticked last (one tick per stud) */
export type PegState = { phi: number; v: number; theta: number; onStud: number | null; lastStud: number | null };
export type PegStep = {
	/** the studs whose first contact came in this step, in order, with the step's share of the time it came at (0 to 1) */
	contacts: { stud: number; at: number }[];
	/** the stud on the flapper at the end of the step (null: none) */
	on: number | null;
	/** the largest |phi| reached inside the step (degrees) */
	maxAbs: number;
	/** steps in which a stud could not push the flapper out (held at its largest swing): never expected */
	jams: number;
	/** a stud let the flapper go at rest because it balanced on the stud's top (edgeDeg) */
	edgeRelease: number;
};

export const pegRest = (theta: number): PegState => ({ phi: 0, v: 0, theta, onStud: null, lastStud: null });

/** distance from (px, py) to the flapper (its bolt at (0, by), length L) turned phi degrees */
export const flapDist = (phi: number, px: number, py: number, L: number, by: number): number => {
	const ux = -L * Math.sin(phi * DEG);
	const uy = L * Math.cos(phi * DEG);
	const q = Math.max(0, Math.min(1, (px * ux + (py - by) * uy) / (ux * ux + uy * uy)));
	return Math.hypot(px - q * ux, py - (by + q * uy));
};

/** THE GAP between a stud (its centre at px, py) and the flapper turned phi degrees, wheel units (negative: they
 *  overlap). With an outline (G.hw, G.studOut): the stud's circle against the flapper's drawn half width along its length
 *  (sampled at the profile's steps and at the point of the centre line nearest the stud, between steps linear); without:
 *  the centre line, rc thick. */
export const flapGap = (phi: number, px: number, py: number, G: PegGeom): number => {
	const hw = G.hw;
	if (!hw || G.studOut === undefined) return flapDist(phi, px, py, G.L, G.by) - G.rc;
	const ux = -Math.sin(phi * DEG);
	const uy = Math.cos(phi * DEG);
	const rx = px;
	const ry = py - G.by;
	const t = rx * ux + ry * uy; // along the flapper from its bolt
	const d = Math.abs(rx * uy - ry * ux); // off its centre line
	const n = hw.length - 1;
	const width = (q: number) => {
		const f = Math.max(0, Math.min(n, q * n));
		const i = Math.min(n - 1, Math.floor(f));
		return hw[i] + (hw[i + 1] - hw[i]) * (f - i);
	};
	let best = Infinity;
	for (let i = 0; i <= n; i++) best = Math.min(best, Math.hypot(d, t - (G.L * i) / n) - hw[i]);
	const q = Math.max(0, Math.min(1, t / G.L));
	best = Math.min(best, Math.hypot(d, t - G.L * q) - width(q));
	return best - G.studOut;
};

/** stud k's centre at disc turn theta (degrees): the studs stand at k * step from the top, turned with the disc */
export const studAt = (k: number, theta: number, G: PegGeom): [number, number] => {
	const a = (k * G.step + theta) * DEG;
	return [Math.sin(a) * G.studR, -Math.cos(a) * G.studR];
};

const spring = (F: PegState, dt: number, P: PegParams) => {
	if (dt <= 0) return;
	const steps = Math.max(1, Math.ceil(dt / P.springStepS));
	const h = dt / steps;
	for (let i = 0; i < steps; i++) {
		F.v += (-P.stiffness * F.phi - P.damping * F.v) * h;
		F.phi += F.v * h;
	}
};

/** the disc's turn through a step: a number (the turn at its end, reached at an even pace from where the peg last
 *  stepped), or the turn at each share u (0 to 1) of the step's time (the spin's own curve: a long frame then follows the
 *  curve's speed inside it, not its average) */
export type PegPath = number | ((u: number) => number);

/** STEP the peg along `path` over `dt` seconds; `onSub` (probes, the node check) sees every piece: the disc's turn and
 *  the flapper's */
export const stepPeg = (F: PegState, path: PegPath, dt: number, G: PegGeom, P: PegParams, onSub?: (theta: number, phi: number, on: number | null) => void): PegStep => {
	const out: PegStep = { contacts: [], on: null, maxAbs: Math.abs(F.phi), jams: 0, edgeRelease: 0 };
	let thPrev = F.theta;
	const th0 = F.theta;
	const end = typeof path === 'number' ? path : path(1);
	const at = typeof path === 'number' ? (u: number) => th0 + (end - th0) * u : path;
	// pieces of at most subDeg at the step's average pace (a curve's own pace may be up to twice its average inside one
	// frame, the speed-up from rest, so a curve gets twice as many) and at most springStepS of time: a free flapper's
	// swing is checked against the studs as often as its spring is stepped, whatever the frame's length
	const n = Math.max(1, Math.ceil(((typeof path === 'number' ? 1 : 2) * Math.abs(end - th0)) / P.subDeg), Math.ceil(dt / P.springStepS));
	const h = dt / n;
	for (let j = 1; j <= n; j++) {
		const th = j === n ? end : at(j / n);
		const prev = F.phi;
		spring(F, h, P);
		let on: number | null = null;
		const k0 = Math.round(-th / G.step);
		for (let k = k0 - 1; k <= k0 + 1; k++) {
			const [sx, sy] = studAt(k, th, G);
			if (flapGap(F.phi, sx, sy, G) >= 0) continue;
			// the stud's own angle seen from the bolt: the flapper goes out on the side it was on
			const phiC = Math.atan2(-sx, sy - G.by) / DEG;
			const side = prev - phiC >= 0 ? 1 : -1;
			let a0 = F.phi;
			let a1 = F.phi;
			let free = false;
			for (let i = 0; i < 720; i++) {
				a1 += side * 0.25;
				if (flapGap(a1, sx, sy, G) >= 0) {
					free = true;
					break;
				}
				a0 = a1;
			}
			if (free)
				for (let i = 0; i < 20; i++) {
					const mid = (a0 + a1) / 2;
					if (flapGap(mid, sx, sy, G) >= 0) a1 = mid;
					else a0 = mid;
				}
			// carried by the stud: with a flick it keeps that speed when the stud lets go
			F.v = h > 0 && P.fling > 0 ? Math.max(-P.flingMax, Math.min(P.flingMax, (P.fling * (a1 - prev)) / h)) : 0;
			F.phi = a1;
			on = k;
			if (!free) out.jams += 1;
			// BALANCED ON THE STUD'S TOP (the disc still, the stud holding the flapper only over a sliver of its swing: the
			// angles it blocks, from where the flapper leans back toward straight, span less than edgeDeg): it slips off,
			// to the near edge of that sliver, and the spring brings it back from there. A lean stays a lean only where the
			// stud really holds it.
			if (free && P.edgeDeg && th === thPrev) {
				let b = a1 - side * 0.05;
				let span = 0;
				while (span < P.edgeDeg && flapGap(b, sx, sy, G) < 0) {
					b -= side * 0.05;
					span += 0.05;
				}
				if (span < P.edgeDeg) {
					F.phi = b;
					F.v = 0;
					on = null;
					out.edgeRelease += 1;
				}
			}
		}
		// the largest swing: a free flapper bounces off it, one held by a stud stays there
		if (Math.abs(F.phi) > P.maxSwing) {
			F.phi = Math.sign(F.phi) * P.maxSwing;
			F.v = on === null ? (Math.sign(F.v) === Math.sign(F.phi) ? -0.3 * F.v : F.v) : 0;
			if (on !== null) out.jams += 1;
		}
		if (on !== null && on !== F.lastStud) {
			out.contacts.push({ stud: on, at: j / n });
			F.lastStud = on;
		}
		F.onStud = on;
		out.maxAbs = Math.max(out.maxAbs, Math.abs(F.phi));
		onSub?.(th, F.phi, on);
		thPrev = th;
	}
	F.theta = end;
	out.on = F.onStud;
	return out;
};

// ---- THE STOP'S RELEASE (2026-11-21, Corey: "Give the pin spring in those cases, so it rolls back inward towards the
// wedge") -------------------------------------------------------------------------------------------------------------------
// WHY THE DISC ROLLS ON, NOT BACK: the studs stand on the dividers and the wheel turns its studs from right to left over
// the top (theta falling). A lean is always the stud that has JUST PASSED the top (the winning wedge's first divider,
// 9 to 11.5 degrees left of the top at the layouts' pegs) still holding the flapper's tip out to the left, about 28
// degrees. The flapper reaches the stud's circle for every turn of the stud closer to the top than pegReleaseAngle, so
// turning the disc back would only carry the stud up under the tip, and the flapper could come free only once the stud
// had crossed back past the top: the previous wedge under the peg, another result. The one way to free it inside the
// winning wedge is the stud moving on out of the flapper's reach: the disc rolls on a little (1 to 3.5 degrees), the
// stud slips out from under the tip, and the spring swings the flapper back inward into the wedge, straight. The pointer
// moves that much deeper inside the winning wedge, away from the divider it was resting by; it never nears the other
// one (the stop is at most 30% of a wedge off the middle). A stop that ends free has no release and is exactly as before.

/** the release's pace: held still for holdMs (the lean is seen), then the roll over rollMs (eased in from rest and out
 *  to rest), to marginDeg past the turn where the stud can no longer reach the flapper */
export type PegRelease = { holdMs: number; rollMs: number; marginDeg: number };

/** the least gap (wheel units) between the stud at (sx, sy) and the flapper over every turn it can take on the side the
 *  studs push it (0 to maxSwing degrees): negative, the stud can hold it there. Sampled each half degree, then the best
 *  sample refined (golden section) to a thousandth of a degree. */
const reachGap = (sx: number, sy: number, G: PegGeom, maxSwing: number): number => {
	let best = Infinity;
	let at = 0;
	for (let phi = 0; phi <= maxSwing + 1e-9; phi += 0.5) {
		const g = flapGap(phi, sx, sy, G);
		if (g < best) {
			best = g;
			at = phi;
		}
	}
	let lo = Math.max(0, at - 0.5);
	let hi = Math.min(maxSwing, at + 0.5);
	const r = (Math.sqrt(5) - 1) / 2;
	for (let i = 0; i < 40 && hi - lo > 1e-3; i++) {
		const a = hi - r * (hi - lo);
		const b = lo + r * (hi - lo);
		if (flapGap(a, sx, sy, G) < flapGap(b, sx, sy, G)) hi = b;
		else lo = a;
	}
	return Math.min(best, flapGap((lo + hi) / 2, sx, sy, G));
};

const releaseMemo = new Map<string, number>();
/** THE RELEASE ANGLE of a flapper (degrees, negative: left of the top): a stud that has passed the top further than this
 *  can no longer touch the flapper at any of its turns, so it holds nothing. Pure geometry (the flapper's outline and
 *  the studs'), the same for every round on one peg size; worked out once per geometry. */
export const pegReleaseAngle = (G: PegGeom, maxSwing: number): number => {
	const key = `${G.L}|${G.by}|${G.rc}|${G.studR}|${G.step}|${G.studOut}|${G.hw?.join(',')}|${maxSwing}`;
	const hit = releaseMemo.get(key);
	if (hit !== undefined) return hit;
	const reach = (a: number) => {
		const [sx, sy] = studAt(0, a, G);
		return reachGap(sx, sy, G, maxSwing) < 0;
	};
	// (in reach at the top; out of reach half a stud's step away, or the flapper reaches every stud: never in this wheel)
	let lo = -G.step / 2;
	let hi = 0;
	if (reach(lo)) {
		releaseMemo.set(key, lo);
		return lo;
	}
	for (let i = 0; i < 50; i++) {
		const mid = (lo + hi) / 2;
		if (reach(mid)) hi = mid;
		else lo = mid;
	}
	if (releaseMemo.size > 32) releaseMemo.clear();
	releaseMemo.set(key, lo);
	return lo;
};

/** WHETHER A STUD HOLDS THE FLAPPER AT REST, the stud at turn `a` (degrees from the top): the flapper pressed against
 *  it at the largest turn the stud blocks (where stepPeg leaves it), and stepPeg's own rest rule (edgeDeg) applied to
 *  it, step for step: a stud that blocks less than edgeDeg of the swing from there back toward straight lets it slip off
 *  (the stop already ended straight before the release existed, and is left alone). Without edgeDeg, any reach holds. */
export const pegHolds = (a: number, G: PegGeom, maxSwing: number, edgeDeg?: number): boolean => {
	const [sx, sy] = studAt(0, a, G);
	if (reachGap(sx, sy, G, maxSwing) >= 0) return false;
	if (!edgeDeg) return true;
	// the largest blocked turn: from the deepest overlap out to the free side (blocked up to maxSwing: it is held there)
	let lo = -1;
	for (let phi = 0; phi <= maxSwing + 1e-9; phi += 0.5) if (flapGap(phi, sx, sy, G) < 0) lo = phi;
	// (no half degree step blocked: it blocks less than half a degree, under any edgeDeg this wheel uses)
	if (lo < 0) return edgeDeg < 0.5;
	let hi = maxSwing;
	if (flapGap(hi, sx, sy, G) < 0) return true;
	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;
		if (flapGap(mid, sx, sy, G) >= 0) hi = mid;
		else lo = mid;
	}
	// (stepPeg's edge rule, as it walks it)
	let b = hi - 0.05;
	let span = 0;
	while (span < edgeDeg && flapGap(b, sx, sy, G) < 0) {
		b -= 0.05;
		span += 0.05;
	}
	return span >= edgeDeg;
};

/** THE RELEASE OF A STOP at disc turn `stop` (degrees): how far the disc rolls on past it (theta falling, the way it
 *  was turning) so the stud that last passed the top lets the flapper go, marginDeg past the release angle (the stud
 *  then cannot touch it at any turn: it slides off the stud's side, never snaps); 0 when that stud does not hold the
 *  flapper at rest (pegHolds: the stop ends free and is left exactly as it was) */
export const pegReleaseDeg = (stop: number, G: PegGeom, P: Pick<PegParams, 'maxSwing' | 'edgeDeg'>, R: PegRelease): number => {
	const k = Math.floor(-stop / G.step);
	const a = k * G.step + stop; // the stud just past the top: -step < a <= 0
	if (!pegHolds(a, G, P.maxSwing, P.edgeDeg)) return 0;
	return Math.max(0, a - pegReleaseAngle(G, P.maxSwing)) + R.marginDeg;
};

/** the release's turn `ms` after the stop (degrees, 0 up to deg): still through holdMs, then eased in and out over rollMs
 *  (a cubic: it leaves rest gently as the spring's push takes the disc, and comes to rest softly) */
export const pegReleaseTurn = (deg: number, ms: number, R: PegRelease): number => {
	if (deg <= 0 || ms <= R.holdMs) return 0;
	const u = Math.min(1, (ms - R.holdMs) / R.rollMs);
	return deg * (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
};

/** the release's whole length (ms): 0 for a stop that ends free */
export const pegReleaseMs = (deg: number, R: PegRelease): number => (deg > 0 ? R.holdMs + R.rollMs : 0);
