// THE LIGHT STRAND'S PATH (constants LINE_WIN lights strand; Corey 2026-11-20, candidate B of the win line lights mock
// win_line_lights_r1_2026-11-20 with the round 2 nails, win_line_lights_r2_2026-11-20; its buildCand ported).
//
// Pure geometry, no Pixi: game/road/winLights.ts calls buildStrand when a win is set and draws what it returns.
//
// THE NAILS: one at each end of the line (past the first and the last winning symbol's art, along the line's own
// direction, so a line that starts on a diagonal gets no extra bend), one at every bend of the line (hangPoints
// 'bends', or at every symbol: 'every'), and SUPPORT nails on long runs (a nail to nail run longer than minSpanReels
// reels gets one on the symbol nearest its middle, or one every everyReels reels). Between two nails the cord hangs in
// a parabola (the chord plus 4 sag u (1 - u)); the sag is the sag for a two reel span, in proportion to the span.
//
// WHERE THE CORD MEETS A NAIL:
//   - an END nail: the cord comes over the top of the shank (as at a middle nail), runs on endOver past its contact and
//     dives behind the head to the shank, its square end under the head (since 2026-11-20 round 2; the wrap, one turn of
//     the cord round the shank under the head, is a sprite the head is drawn over).
//   - a PEAK, a SHOULDER or a SUPPORT (both spans hang away below the nail): draped over the top of the shank, behind
//     the head, on a circle of the shank's radius plus half the cord (the head covers the cord's lower edge).
//   - a VALLEY (both spans rise away, a V's bottom): 'sit', a round bottomed V resting on the top of the shank; or
//     'drape', the cord passes over the top of the shank with a slight rise and a shallow dip either side, the rise
//     scaled down strongly as the bend gets sharper (a deep V never grows a loop). Both are the same construction: a
//     fillet circle of radius R either side, tangent to the drape circle at the arc's ends; 'sit' is a rise of 0.
// Never a full wrap at a middle nail.
//
// Every length is road px (the 1536 x 1024 board picture).

export type Pt = { x: number; y: number };
export type NailKind = 'end' | 'bend' | 'post' | 'support';
/** how the cord meets a nail: 'end' wrapped (the ring sprite), 'free' no nail (tips off), 'over' draped over the top,
 *  'drape' / 'sit' a valley */
export type Joint = 'end' | 'free' | 'over' | 'drape' | 'sit';

export type StrandNail = {
	x: number;
	y: number;
	kind: NailKind;
	joint: Joint;
	/** shared nails: one per key (an end: its cell, its side and the line's first step; a middle nail: its cell) */
	key: string;
	/** where along the path its joint is (its middle) and half the joint's length */
	s: number;
	half: number;
	/** PROBES: the cord's centerline at its highest over the joint (road y), the angle the path turns round the nail
	 *  inside the joint (rad), the valley's rise and the bend's turn (rad) */
	cordY: number;
	sweep: number;
	rise: number;
	turn: number;
};

export type StrandOpts = {
	/** the cord's core width and its ink outline (each side) */
	wire: number;
	ink: number;
	/** the sag for a two reel span (refRoadPx), in proportion to the span within [minShare, maxShare] */
	sag: number;
	sagRef: number;
	sagMin: number;
	sagMax: number;
	hang: 'bends' | 'every';
	bendRad: number;
	/** the radii: the drape (a middle nail: the shank plus half the cord), the circle the cord comes over at an end nail
	 *  (since the wrap of round 2, 2026-11-20: the drape's, the cord resting on the shank), the end nail's whole reach (its
	 *  head or its wrap, whichever reaches further: its place and the lanes) */
	drapeR: number;
	wrapR: number;
	ringOuter: number;
	/** at an end nail the cord runs on endOver rad over the top past its contact, then dives behind the head to the shank
	 *  (the wrap is a sprite under the head) */
	endOver: number;
	/** end nails on (false: the cord ends square on the symbols' centres), how far past the symbol's half width the nail's
	 *  centre goes (null: on the symbol's centre), the hook round the wrap's circle (rad), and the lanes the end nails'
	 *  rings stay inside (road y, or null) */
	ends: boolean;
	endGap: number | null;
	hookRad: number;
	lanes: { top: number; bottom: number } | null;
	support: 'off' | 'middle' | 'every';
	everyReels: number;
	minSpanReels: number;
	betweenSymbols: boolean;
	/** the reel pitch and the board's left edge (road px), for the gaps between reels */
	pitch: number;
	boardX: number;
	valley: 'drape' | 'sit';
	sitR: number;
	drapeRise: number;
	drapeFillet: number;
	riseGoneAtRad: number;
	risePower: number;
	spanStep: number;
	arcStep: number;
	/** bulbs every `spacing` from firstShare of a spacing, none where it would touch a nail (clearX the bulb's half width,
	 *  clearY its hang) */
	spacing: number;
	firstShare: number;
	clearX: number;
	clearY: number;
};

export type Strand = {
	x: number[];
	y: number[];
	s: number[];
	total: number;
	nails: StrandNail[];
	bulbs: { x: number; y: number; s: number }[];
	/** where the cord leaves the start wrap and meets the end wrap (the path's own ends with no nails) */
	depart: [Pt, Pt];
};

type Sup = { x: number; y: number; kind: NailKind | 'free'; key: string; idx: number };

const unit = (a: Pt, b: Pt) => {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const l = Math.hypot(dx, dy) || 1;
	return { x: dx / l, y: dy / l };
};
const above = (d: Pt) => ({ x: d.y, y: -d.x });
const add = (N: Pt, n: Pt, r: number) => ({ x: N.x + n.x * r, y: N.y + n.y * r });
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** the line's strand: `points` its winning symbols' centres (reel order), `cells` their cells, `half` the half width each
 *  symbol is drawn at (a Wild's box when wider) */
export function buildStrand(points: Pt[], cells: (number | string)[], half: number[], o: StrandOpts): Strand {
	const P = points.map((p) => ({ x: p.x, y: p.y }));
	const m = P.length - 1;
	const W = o.wire;
	const rd = o.drapeR;
	const re = o.wrapR;
	// THE NAILS: the ends, the bends, then the supports
	let sup: Sup[] = [];
	const u0 = unit(P[0], P[Math.min(1, m)]);
	const u1 = unit(P[Math.max(0, m - 1)], P[m]);
	const step = (d: Pt) => (d.y > 0.2 ? 'd' : d.y < -0.2 ? 'u' : '');
	const endAt = (c: Pt, u: Pt, sign: number, i: number) => {
		const e = o.endGap === null ? 0 : (half[i] ?? 0) + o.endGap;
		const q = { x: c.x + sign * u.x * e, y: c.y + sign * u.y * e };
		if (o.lanes && e > 0) q.y = clamp(q.y, o.lanes.top + o.ringOuter, o.lanes.bottom - o.ringOuter);
		return { q, e };
	};
	if (o.ends) {
		const { q, e } = endAt(P[0], u0, -1, 0);
		sup.push({ ...q, kind: 'end', key: `${cells[0]}:a${e > 0 ? step(u0) : ''}`, idx: -1 });
	} else sup.push({ ...P[0], kind: 'free', key: '', idx: 0 });
	for (let i = 1; i < m; i++) {
		const a1 = Math.atan2(P[i].y - P[i - 1].y, P[i].x - P[i - 1].x);
		const a2 = Math.atan2(P[i + 1].y - P[i].y, P[i + 1].x - P[i].x);
		const bend = Math.abs(a2 - a1) > o.bendRad;
		if (bend || o.hang === 'every') sup.push({ x: P[i].x, y: P[i].y, kind: bend ? 'bend' : 'post', key: `${cells[i]}:m`, idx: i });
	}
	if (o.ends) {
		const { q, e } = endAt(P[m], u1, 1, m);
		sup.push({ ...q, kind: 'end', key: `${cells[m]}:b${e > 0 ? step(u1) : ''}`, idx: m + 1 });
	} else sup.push({ ...P[m], kind: 'free', key: '', idx: m });
	// SUPPORT NAILS: a run longer than minSpanReels reels gets one nearest its middle, or one every everyReels reels; on the
	// symbol nearest (its own key, shared with any line that bends or is held there), or in the gap between two reels
	if (o.support !== 'off') {
		const out: Sup[] = [sup[0]];
		for (let j = 0; j < sup.length - 1; j++) {
			const a = sup[j];
			const b = sup[j + 1];
			const len = Math.hypot(b.x - a.x, b.y - a.y);
			if (len > o.minSpanReels * o.pitch) {
				const n = o.support === 'middle' ? 1 : Math.max(1, Math.ceil(len / (o.everyReels * o.pitch)) - 1);
				for (let i = 1; i <= n; i++) {
					let u = i / (n + 1);
					let q: Sup | null = null;
					if (o.betweenSymbols && Math.abs(b.x - a.x) > 1) {
						const x = a.x + (b.x - a.x) * u;
						const k = Math.min(4, Math.max(1, Math.round((x - o.boardX) / o.pitch)));
						u = (o.boardX + k * o.pitch - a.x) / (b.x - a.x);
						if (u <= 0.08 || u >= 0.92) continue;
						const y = a.y + (b.y - a.y) * u;
						q = { x: a.x + (b.x - a.x) * u, y, kind: 'support', key: `g${k}:${Math.round(y)}`, idx: -2 };
					} else {
						// the winning symbol nearest the spot, at least 100 road px from either nail
						const tx = a.x + (b.x - a.x) * u;
						let best = -1;
						for (let c = Math.max(0, a.idx + 1); c <= Math.min(m, b.idx - 1); c++) {
							if (Math.hypot(P[c].x - a.x, P[c].y - a.y) < 100 || Math.hypot(P[c].x - b.x, P[c].y - b.y) < 100) continue;
							if (best < 0 || Math.abs(P[c].x - tx) < Math.abs(P[best].x - tx)) best = c;
						}
						if (best >= 0) q = { x: P[best].x, y: P[best].y, kind: 'support', key: `${cells[best]}:m`, idx: best };
						else q = { x: tx, y: a.y + (b.y - a.y) * u, kind: 'support', key: `s${Math.round(tx)}:${Math.round(a.y + (b.y - a.y) * u)}`, idx: -2 };
					}
					if (q && !out.some((p) => Math.abs(p.x - q!.x) < 20 && Math.abs(p.y - q!.y) < 20)) out.push(q);
				}
			}
			out.push(b);
		}
		sup = out;
	}
	const ns = sup.length;
	const sagOf = (a: Pt, b: Pt) => o.sag * clamp(Math.hypot(b.x - a.x, b.y - a.y) / o.sagRef, o.sagMin, o.sagMax);
	// each nail's joint: a valley when the line turns upward there (the chords' cross product), else over the top
	const joint: Joint[] = sup.map((N, j) => {
		if (j === 0 || j === ns - 1) return N.kind === 'free' ? 'free' : 'end';
		const di = unit(sup[j - 1], N);
		const dd = unit(N, sup[j + 1]);
		return di.x * dd.y - di.y * dd.x < -0.05 ? o.valley : 'over';
	});
	const cOut: Pt[] = sup.map((p) => ({ x: p.x, y: p.y }));
	const cIn: Pt[] = sup.map((p) => ({ x: p.x, y: p.y }));
	const tan = (a: Pt, b: Pt, s: number, u: number) => unit({ x: 0, y: 0 }, { x: b.x - a.x, y: b.y - a.y + 4 * s * (1 - 2 * u) });
	const sags: number[] = [];
	for (let j = 0; j < ns - 1; j++) sags.push(sagOf(sup[j], sup[j + 1]));
	const dIn: Pt[] = [];
	const dOut: Pt[] = [];
	// a valley's fillets: the arc over the top (half angle a), the fillet circles' centres and where the spans meet them
	type Valley = { a: number; R: number; CL: Pt; CR: Pt; ta: number; tb: number; rise: number; turn: number };
	const val: (Valley | null)[] = sup.map(() => null);
	const valley = (j: number): Valley => {
		const N = sup[j];
		const dI = dIn[j];
		const dO = dOut[j];
		const turn = Math.acos(clamp(dI.x * dO.x + dI.y * dO.y, -1, 1));
		let rise = 0;
		let R = o.sitR;
		if (joint[j] === 'drape') {
			rise = o.drapeRise * Math.pow(Math.max(0, 1 - turn / o.riseGoneAtRad), o.risePower);
			R = o.drapeFillet;
		}
		const a = rise > 0 ? Math.acos(clamp(1 - rise / (rd + R), -1, 1)) : 0;
		const t0 = -Math.PI / 2 - a;
		const t1 = -Math.PI / 2 + a;
		const CL = add(N, { x: Math.cos(t0), y: Math.sin(t0) }, rd + R);
		const CR = add(N, { x: Math.cos(t1), y: Math.sin(t1) }, rd + R);
		// the fillet point whose tangent (the circle run with a falling angle) is the span's own
		const ta = Math.max(Math.atan2(dI.x, -dI.y), Math.PI / 2 - a);
		const tb = Math.min(Math.atan2(dO.x, -dO.y), Math.PI / 2 + a);
		return { a, R, CL, CR, ta, tb, rise, turn };
	};
	for (let it = 0; it < 6; it++) {
		for (let j = 0; j < ns - 1; j++) {
			dOut[j] = tan(cOut[j], cIn[j + 1], sags[j], 0);
			dIn[j + 1] = tan(cOut[j], cIn[j + 1], sags[j], 1);
		}
		for (let j = 0; j < ns; j++) {
			const N = sup[j];
			const J = joint[j];
			if (j === 0) {
				if (J === 'end') cOut[0] = add(N, above(dOut[0]), re);
				continue;
			}
			if (j === ns - 1) {
				if (J === 'end') cIn[j] = add(N, above(dIn[j]), re);
				continue;
			}
			if (J === 'over') {
				cIn[j] = add(N, above(dIn[j]), rd);
				cOut[j] = add(N, above(dOut[j]), rd);
			} else {
				const v = (val[j] = valley(j));
				cIn[j] = add(v.CL, { x: Math.cos(v.ta), y: Math.sin(v.ta) }, v.R);
				cOut[j] = add(v.CR, { x: Math.cos(v.tb), y: Math.sin(v.tb) }, v.R);
			}
		}
	}
	// THE PATH
	const X: number[] = [];
	const Y: number[] = [];
	const S: number[] = [];
	const push = (x: number, y: number) => {
		const n = X.length;
		if (n) {
			const d = Math.hypot(x - X[n - 1], y - Y[n - 1]);
			if (d < 1e-4) return;
			S.push(S[n - 1] + d);
		} else S.push(0);
		X.push(x);
		Y.push(y);
	};
	const arc = (C: Pt, r: number, a0: number, a1: number) => {
		const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / o.arcStep));
		for (let i = 1; i <= steps; i++) {
			const t = a0 + ((a1 - a0) * i) / steps;
			push(C.x + Math.cos(t) * r, C.y + Math.sin(t) * r);
		}
	};
	const nails: StrandNail[] = [];
	const nailAt = (j: number, s0: number, s1: number, extra: Partial<StrandNail> = {}) => {
		const N = sup[j];
		nails.push({ x: N.x, y: N.y, kind: N.kind as NailKind, joint: joint[j], key: N.key, s: (s0 + s1) / 2, half: (s1 - s0) / 2, cordY: NaN, sweep: 0, rise: 0, turn: 0, ...extra });
	};
	// a dive behind an end nail's head: a curve from the shank (the nail's centre) to the point at angle `a` on the circle
	// the cord comes over, meeting it along the circle's clockwise tangent (or the reverse, `out`)
	const dive = (N: Pt, a: number, out: boolean) => {
		const P = { x: N.x + Math.cos(a) * re, y: N.y + Math.sin(a) * re };
		const g = { x: -Math.sin(a), y: Math.cos(a) };
		const L = re * 0.7;
		const C = out ? { x: P.x + g.x * L, y: P.y + g.y * L } : { x: P.x - g.x * L, y: P.y - g.y * L };
		const [p0, p2] = out ? [P, N] : [N, P];
		for (let i = out ? 1 : 0; i <= 12; i++) {
			const u = i / 12;
			const v = 1 - u;
			push(v * v * p0.x + 2 * v * u * C.x + u * u * p2.x, v * v * p0.y + 2 * v * u * C.y + u * u * p2.y);
		}
	};
	// the start: the cord comes up from the shank behind the head and over the top of the nail
	if (joint[0] === 'end') {
		const N = sup[0];
		const a1 = Math.atan2(cOut[0].y - N.y, cOut[0].x - N.x);
		const a0 = a1 - o.endOver;
		dive(N, a0, false);
		arc(N, re, a0, a1);
		nailAt(0, 0, 0);
	}
	for (let j = 0; j < ns - 1; j++) {
		const a = cOut[j];
		const b = cIn[j + 1];
		const sg = sags[j];
		const n = Math.max(8, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / o.spanStep));
		for (let i = 0; i <= n; i++) {
			const u = i / n;
			push(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u + 4 * sg * u * (1 - u));
		}
		const k = j + 1;
		if (k >= ns - 1) continue;
		const N = sup[k];
		const J = joint[k];
		const s0 = S[S.length - 1];
		const i0 = X.length - 1;
		if (J === 'over') {
			const a0 = Math.atan2(cIn[k].y - N.y, cIn[k].x - N.x);
			let a1 = Math.atan2(cOut[k].y - N.y, cOut[k].x - N.x);
			while (a1 < a0) a1 += Math.PI * 2;
			if (a1 - a0 > Math.PI * 1.6) a1 = a0;
			arc(N, rd, a0, a1);
		} else {
			const v = val[k]!;
			arc(v.CL, v.R, v.ta, Math.PI / 2 - v.a);
			if (v.a > 1e-4) arc(N, rd, -Math.PI / 2 - v.a, -Math.PI / 2 + v.a);
			arc(v.CR, v.R, Math.PI / 2 + v.a, v.tb);
		}
		const s1 = S[S.length - 1];
		// the probes' readings: the cord's highest point over the joint, the angle the path turns round the nail
		let top = Infinity;
		let sweep = 0;
		for (let i = i0; i < X.length; i++) {
			top = Math.min(top, Y[i]);
			if (i > i0) {
				let d = Math.atan2(Y[i] - N.y, X[i] - N.x) - Math.atan2(Y[i - 1] - N.y, X[i - 1] - N.x);
				while (d > Math.PI) d -= Math.PI * 2;
				while (d < -Math.PI) d += Math.PI * 2;
				sweep += d;
			}
		}
		const v = val[k];
		nailAt(k, s0, s1, { cordY: top, sweep: Math.abs(sweep), rise: v?.rise ?? 0, turn: v?.turn ?? Math.acos(clamp(dIn[k].x * dOut[k].x + dIn[k].y * dOut[k].y, -1, 1)) });
	}
	// the end: over the top of the nail and down behind the head to the shank
	if (joint[ns - 1] === 'end') {
		const N = sup[ns - 1];
		const a0 = Math.atan2(cIn[ns - 1].y - N.y, cIn[ns - 1].x - N.x);
		arc(N, re, a0, a0 + o.endOver);
		dive(N, a0 + o.endOver, true);
	}
	const total = S[S.length - 1] ?? 0;
	if (joint[ns - 1] === 'end') nailAt(ns - 1, total, total);
	// THE BULBS: every spacing, none where it would touch a nail or its joint
	const bulbs: { x: number; y: number; s: number }[] = [];
	const at = (s: number) => {
		let lo = 0;
		let hi = X.length - 1;
		while (hi - lo > 1) {
			const mid = (lo + hi) >> 1;
			if (S[mid] < s) lo = mid;
			else hi = mid;
		}
		const f = clamp((s - S[lo]) / Math.max(1e-9, S[hi] - S[lo]), 0, 1);
		return { x: X[lo] + (X[hi] - X[lo]) * f, y: Y[lo] + (Y[hi] - Y[lo]) * f };
	};
	for (let s = o.spacing * o.firstShare; s < total - 6; s += o.spacing) {
		const p = at(s);
		let near = false;
		for (const nl of nails) {
			const rr = nl.joint === 'end' ? re : rd;
			if (Math.abs(p.x - nl.x) < rr + W / 2 + o.clearX + 2 && Math.abs(p.y - nl.y) < rr + o.clearY) near = true;
			if (Math.abs(s - nl.s) < nl.half + rr + o.clearX + W * 0.5 + 6) near = true;
		}
		if (!near) bulbs.push({ x: p.x, y: p.y, s });
	}
	const depart: [Pt, Pt] = [
		joint[0] === 'end' ? { ...cOut[0] } : { x: X[0], y: Y[0] },
		joint[ns - 1] === 'end' ? { ...cIn[ns - 1] } : { x: X[X.length - 1], y: Y[Y.length - 1] },
	];
	return { x: X, y: Y, s: S, total, nails, bulbs, depart };
}
