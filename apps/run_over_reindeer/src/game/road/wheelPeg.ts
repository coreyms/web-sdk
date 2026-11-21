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
// Everything is time based: the same turn of the disc over the same time gives the same swing whatever the frame rate.
// It never pushes the wheel.

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
