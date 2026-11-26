// THE CHRISTMAS LIGHTS WIN LINES (constants LINE_WIN lights; Corey 2026-11-15, the win line mock's style 2).
//
// Each winning line is a hung wire of Christmas lights: a dark green wire with a dark outline from winning symbol to
// winning symbol, drooping between them, drawn in along the line; bulbs hang from it and light one after another as the
// wire reaches them, then twinkle in a chase while the line is held. The lines start one after another, faster and
// faster (lightsSchedule: staggerMs, then each gap gapRatio times the one before, each line's draw in step), and each
// line's own amount pops in on a winning symbol's top edge as its wire is complete. game/road/roadBoard.ts owns the win
// (its clock, the total, the hold, the fade) and calls set / update / hide.
//
// THE STRAND (constants LINE_WIN lights strand; Corey 2026-11-20, candidate B of the win line lights mock with the round
// 2 nails, win_line_lights_r2_2026-11-20): one round cord with an even outline and a highlight, hung in a parabola from
// nail to nail (game/road/winLightsPath.ts builds the path: the nails at the ends, at every bend and on long runs, the
// cord draped over the middle nails and wrapped at the ends), a C7 bulb on a short pigtail lead every spacing road px,
// silver nails. The old two layers of tinted quads, the old bulb and its one picture nail are no longer drawn (their
// constants and their frames on the sheet are kept).
//
// Made once per line slot and reused (nothing is allocated per frame): the cord is one textured triangle strip (a Pixi
// Mesh of the sheet's cord strip, its points refilled only while the line draws in or comes down, batched with the
// sprites), each bulb four sprites of the lights' sheet (the glow, added, under everything; the body, tinted per bulb;
// its socket, lead and highlight, never tinted; a hot core, added), each nail its shadow, its wrap ring (end nails) and
// its head. No filter, mask, shader or blur. Layers for every line together: the glows (added), the nails' shadows, the
// cords, the end rings, the nail heads, the bulbs, the hot cores (added), the amounts (treatment B: AheadText, Pixi's own text
// pictures drawn and sent to the GPU in the frames before each shows, game/road/winLabelText.ts; the old way: Text).
//
// THE NAILS are shared: one per key (an end nail: its symbol, its side and the line's first step, since the nail stands
// along the line's own direction; a middle nail: its symbol), up from the first of its lines to the last (a pool made at
// the first win that needs them).
import * as PIXI from 'pixi.js';

import { LINE_WIN } from '../constants';
import { WIN_LIGHTS_ART } from '../winLightsSpec';
import { NumberLabel } from './roadFeatures';
import { AheadText, aheadResolution, LABEL_SCREEN_DENSITY, labelDues, screenLabelResolution, slamTextStyle } from './winLabelText';
import { buildStrand, type StrandNail, type StrandOpts } from './winLightsPath';

const L = LINE_WIN.lights;
/** LINE WINS, TREATMENT B (constants LINE_WIN slam): the plain amount, its multiplier slamming in, the line's win */
const X = LINE_WIN.slam;
/** the most lines a win can have (config.paylines) */
const MAX_LINES = 12;
/** the most spans a line has (5 reels) */
const MAX_SPANS = 4;

export type LightLine = {
	/** road px of each winning symbol's centre, reel order */
	points: { x: number; y: number }[];
	/** the symbol the line pays (W: Wilds only) */
	symbol: string;
	/** this line's own amount (its win, the book's), or '' for none */
	amountText: string;
	/** TREATMENT B: its plain amount (the paytable win: the book's win / multiplier) and its multiplier (1: none, no slam) */
	plainText?: string;
	multiplier?: number;
	/** where its amount may go, best first: road px of a box's centre */
	slots: { x: number; y: number }[];
	/** per point: its cell and the half width its symbol is drawn at (road px; a Wild box's when it is wider), for the
	 *  nails (LINE_WIN lights tips) */
	cells?: number[];
	half?: number[];
	/** the board's top and bottom lane lines (road y): an end nail's ring stays between them (constants LINE_WIN lights
	 *  strand ends insideLanes); the reel pitch and the board's left edge (road px), for support nails between reels */
	lanes?: { top: number; bottom: number };
	pitch?: number;
	boardX?: number;
};

type Slot = {
	used: boolean;
	start: number;
	draw: number;
	/** the turbo level's share of every time (the bulbs' pop, the chase, the amount's pop scale by it, not by the draw) */
	pace: number;
	/** ms into the line it starts coming down (Infinity: stays up), and how long that takes */
	off: number;
	down: number;
	/** THE STRAND'S PATH (game/road/winLightsPath.ts): x, y and the length along it at each point */
	px: Float64Array;
	py: Float64Array;
	len: Float64Array;
	n: number;
	total: number;
	/** the cord: one triangle strip, its geometry, the tail and head it was last filled for */
	rope: PIXI.Mesh;
	ropeGeo: PIXI.MeshGeometry;
	ropeTail: number;
	ropeHead: number;
	/** per bulb: the body (tinted), its socket, lead and highlight (never tinted), the glow and the hot core (added) */
	bulbs: PIXI.Sprite[];
	overs: PIXI.Sprite[];
	glows: PIXI.Sprite[];
	hots: PIXI.Sprite[];
	/** per bulb: its place, its lit and dim tints, when the wire reaches it (ms into the line) */
	bx: Float32Array;
	by: Float32Array;
	bAt: Float32Array;
	/** per bulb: its place along the wire (road px), for the take-down */
	bArc: Float32Array;
	bLit: number[];
	bDim: number[];
	/** per bulb: its unlit tint and its hot core's tint */
	bUnlit: number[];
	bHot: number[];
	nb: number;
	amount: PIXI.Text | null;
	amountShown: boolean;
	rect: { x: number; y: number; w: number; h: number } | null;
	symbol: string;
	palette: number[];
	/** DEV readout: the bulbs drawn now and the draw fraction */
	lit: number;
	frac: number;
	/** TREATMENT B (LINE_WIN slam): the label's pieces, its beats' scale, its centre and widths, what it showed last frame */
	lab: SlamLabel | null;
	f: number;
	multi: boolean;
	cx: number;
	cy: number;
	wPlain: number;
	wProd: number;
	wBadge: number;
	state: 'none' | 'plain' | 'side' | 'squash' | 'win';
	/** THE NAILS: this line's two end nails (their centres, road px) and every nail of the line in path order, each with its
	 *  key and when it comes and goes (ms into the line) */
	ends: LineNail[];
	nails: LineNail[];
	/** where the cord leaves the start wrap and meets the end wrap (road px) */
	depart: { x: number; y: number }[];
	/** the winning symbols' centres (road px) */
	points: { x: number; y: number }[];
};

type LineNail = StrandNail & { in: number; out: number };

/** one nail of the pool: its head, shadow and wrap rings (deepest first), its key, kind and place, when it is up (ms into
 *  the win, merged over its lines) and how many turns of wrap it shows (an end nail) */
type Nail = { sprite: PIXI.Sprite; shadow: PIXI.Sprite; rings: PIXI.Sprite[]; key: string; kind: string; x: number; y: number; ups: { in: number; out: number }[]; lines: number[]; scale: number; turns: number };

/** one line's slam label: the plain amount and the line's win (each with its shadow), the multiplier and its two shadows */
type SlamLabel = { root: PIXI.Container; plain: AheadText; plainSh: AheadText; win: AheadText; winSh: AheadText; badge: NumberLabel; badgeSh: NumberLabel[] };

/** the slam's options for one win: the label scale (1, or the phone's), the phone rule, the road's inner edges and the top
 *  lane line (road px); `floor`: the lowest road y an amount may reach (the LED strip's snow cap or the HUD, whichever is
 *  higher: 2026-11-18) */
export type SlamOpts = { scale: number; phone: boolean; left: number; right: number; topLine: number; floor?: number };

const darken = (c: number, k: number) => (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);
const easeOut3 = (u: number) => 1 - (1 - u) * (1 - u) * (1 - u);
const clamp01 = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u);
/** the slam's eases (the mock's, Manticore's readout): a back-in (it pulls back first) and a back-out (past, then back) */
const backIn = (u: number) => u * u * (2.70158 * u - 1.70158);
const backOut = (u: number) => {
	const v = u - 1;
	return v * v * (2.70158 * v + 1.70158) + 1;
};
const mixColor = (a: number, b: number, u: number) => {
	const m = (sh: number) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * u);
	return (m(16) << 16) | (m(8) << 8) | m(0);
};

/** the area two circles of radii a and b, d apart, share */
const lens = (a: number, b: number, d: number) => {
	if (a <= 0 || b <= 0 || d >= a + b) return 0;
	if (d <= Math.abs(a - b)) return Math.PI * Math.min(a, b) ** 2;
	const x = (d * d + a * a - b * b) / (2 * d * a);
	const y = (d * d + b * b - a * a) / (2 * d * b);
	const k = (-d + a + b) * (d + a - b) * (d - a + b) * (d + a + b);
	return a * a * Math.acos(Math.max(-1, Math.min(1, x))) + b * b * Math.acos(Math.max(-1, Math.min(1, y))) - 0.5 * Math.sqrt(Math.max(0, k));
};
let wrapMemo: { key: string; v: { outer: number; inner: number; drop: number } } | null = null;
/** THE END WRAP (round 2, constants LINE_WIN lights strand ends; tools/build_win_lights.py wrap_geo, the same sum): its
 *  outer radius (wrapRadiusShare of the head's), its inner (the outer less the cord, or none) and how far it drops below
 *  the head's centre for the head (with its ink) to cover wrapCover of its area */
export function wrapGeometry(headR: number, ink: number, W: number, share: number, cover: number) {
	const key = `${headR}|${ink}|${W}|${share}|${cover}`;
	if (wrapMemo && wrapMemo.key === key) return wrapMemo.v;
	const ro = share * headR;
	const ri = Math.max(0, ro - W - 2 * ink);
	const hb = headR + ink;
	const area = Math.PI * (ro * ro - ri * ri);
	const covered = (d: number) => (lens(ro, hb, d) - lens(ri, hb, d)) / area;
	let drop = 0;
	if (covered(0) > cover) {
		let lo = 0;
		let hi = ro + hb;
		for (let i = 0; i < 60; i++) {
			const mid = (lo + hi) / 2;
			if (covered(mid) > cover) lo = mid;
			else hi = mid;
		}
		drop = (lo + hi) / 2;
	}
	const v = { outer: ro, inner: ri, drop };
	wrapMemo = { key, v };
	return v;
}
/** the share of the wrap the head covers at its drop (the probes) */
export const wrapCovered = (headR: number, ink: number, w: { outer: number; inner: number; drop: number }) => {
	const hb = headR + ink;
	return (lens(w.outer, hb, w.drop) - lens(w.inner, hb, w.drop)) / (Math.PI * (w.outer * w.outer - w.inner * w.inner));
};

/** THE STRAND'S RADII (road px, from the live numbers, constants LINE_WIN lights strand): the head and its ink, the
 *  shank, a middle nail's drape (the cord's centerline resting on the shank, also the circle the cord comes over at an
 *  end nail since round 2), the end wrap (outer, inner, drop) and the end nail's whole reach (`ringOuter`: its head or
 *  its wrap's lowest edge, whichever reaches further), the cord's full thickness now and as baked (the strip is drawn
 *  wider or narrower in proportion). wrapR: the first ring's centerline (not drawn since round 2). */
export function strandGeometry() {
	const S = L.strand;
	const W = S.cord.width;
	const ink = S.cord.ink;
	const headR = S.nail.headRoadPx * S.nail.size;
	const shank = S.nail.shankShare * headR;
	const wrapR = shank + W / 2 + ink * 0.6 + S.ends.wrapSize * W * 0.9;
	const wrap = wrapGeometry(headR, ink, W, S.ends.wrapRadiusShare, S.ends.wrapCover);
	const bk = WIN_LIGHTS_ART.strand.bakedFor;
	return { headR, headOuter: headR + ink, shank, drapeR: shank + W / 2 + ink, wrapR, wrap, ringOuter: Math.max(headR + ink, wrap.drop + wrap.outer), thickness: W + 2 * ink, bakedThickness: bk.wire + 2 * bk.ink };
}

export type LightsPlan = {
	/** per line, ms into the win: it starts stringing, how long it strings, fully strung, starts coming down, gone */
	starts: number[];
	draws: number[];
	full: number[];
	off: number[];
	end: number[];
	/** the last light is down (the total comes then) */
	linesEnd: number;
};
/** TREATMENT B's plan: the lights' plan with each line's beat scale (`f`, ms per nominal ms at a 1000 ms lit time, the
 *  turbo level's share in it), when the strip's total comes and when the win ends (ms into the win) */
export type SlamPlan = LightsPlan & { f: number[]; lits: number[]; totalAt: number; endAt: number; phone: boolean };

/** the moment the line's win shows, nominal ms at a 1000 ms lit time (treatment B: plain, side, both, squash) */
export const slamProductAt = () => X.beats.plain + X.beats.side + X.beats.both + X.beats.squash;

/** TREATMENT B'S SCHEDULE (constants LINE_WIN slam; the mock's buildPlan): `n` lines at `pace` (the turbo level's share);
 *  `phone` the upright phone's rule; `multi1` a one line win whose line has a multiplier (its strip total waits for the
 *  slam). Read from the tunables on every call (live tunable). */
export function slamSchedule(n: number, pace = 1, phone = false, multi1 = false): SlamPlan {
	const P = X.phone;
	const starts: number[] = [];
	const draws: number[] = [];
	const lits: number[] = [];
	let fOver: number | null = null;
	const usePhone = phone && P.on && n > 1;
	if (usePhone) {
		// THE PHONE RULE: at most maxUp amounts up at once (an amount is up from its line's full until downWindowMs into its
		// take down): the lines' fulls g = (lit + window) / maxUp apart; the lines still end at today's line time LE (the
		// first full at drawMs, the last line down by LE), so lit <= (LE - drawMs - (n - 1) window / maxUp) / (1 + (n - 1) /
		// maxUp), and never more than perLineLitMs; the beats shrink with it, keeping readMs to read the line's win
		const LE = lightsSchedule(n, 1, true).linesEnd;
		const litMax = (LE - L.drawMs - ((n - 1) * P.downWindowMs) / P.maxUp) / (1 + (n - 1) / P.maxUp);
		const lit = Math.max(1, Math.min(X.perLineLitMs, litMax));
		const g = (lit + P.downWindowMs) / P.maxUp;
		for (let i = 0; i < n; i++) {
			const d = i === 0 ? L.drawMs : L.drawFloorMs;
			starts.push(L.drawMs + i * g - d);
			draws.push(d);
			lits.push(lit);
		}
		fOver = Math.max(0.2, Math.min(X.perLineLitMs / 1000, (lit - P.readMs) / slamProductAt()));
	} else {
		let t = 0;
		for (let i = 0; i < n; i++) {
			starts.push(t);
			draws.push(Math.max(Math.min(L.drawFloorMs, L.drawMs), L.drawMs * Math.pow(L.gapRatio, i)));
			lits.push(X.perLineLitMs);
			t += Math.max(L.gapFloorMs, L.staggerMs * Math.pow(L.gapRatio, i));
		}
	}
	const plan: SlamPlan = { starts: [], draws: [], full: [], off: [], end: [], f: [], lits: [], linesEnd: 0, totalAt: 0, endAt: 0, phone: usePhone };
	for (let i = 0; i < n; i++) {
		const start = starts[i] * pace;
		const draw = Math.max(1, draws[i] * pace);
		const lit = lits[i] * pace;
		plan.starts.push(start);
		plan.draws.push(draw);
		plan.full.push(start + draw);
		plan.off.push(n === 1 ? Infinity : start + draw + lit);
		plan.end.push(n === 1 ? Infinity : start + draw + lit + L.takeDownMs * pace);
		plan.lits.push(lit);
		plan.f.push(n === 1 ? pace : (fOver ?? lits[i] / 1000) * pace);
	}
	if (n === 1) {
		// one line: it stays up, the strip's total comes as its slam lands (its amount's pop without one), the win ends when
		// today's does
		plan.totalAt = plan.full[0] + (multi1 ? slamProductAt() * plan.f[0] : L.amount.popMs * pace);
		plan.endAt = plan.full[0] + LINE_WIN.holdMs * pace;
		plan.linesEnd = plan.full[0];
	} else if (n > 1) {
		// the strip's total as the last line starts to come down, then the hold
		plan.totalAt = Math.max(...plan.off);
		plan.endAt = plan.totalAt + LINE_WIN.holdMs * pace;
		plan.linesEnd = Math.max(...plan.end);
	}
	return plan;
}

/** THE LINE SCHEDULE (constants LINE_WIN lights; Corey's timing page win_line_timing.html, its schedule()): every
 *  line's start, stringing, fully lit, coming down and gone, ms into the win at `pace` (the turbo level's share). Read
 *  from the tunables on every call (live tunable). `keepOne`: a one line win's line stays up until the win goes. */
export function lightsSchedule(n: number, pace = 1, keepOne = true): LightsPlan {
	const r = L.gapRatio;
	const starts: number[] = [];
	const draws: number[] = [];
	const full: number[] = [];
	let t = 0;
	for (let i = 0; i < n; i++) {
		starts.push(t);
		draws.push(Math.max(Math.min(L.drawFloorMs, L.drawMs), L.drawMs * Math.pow(r, i)));
		full.push(starts[i] + draws[i]);
		t += Math.max(L.gapFloorMs, L.staggerMs * Math.pow(r, i));
	}
	const last = n ? Math.max(...full) : 0;
	const off: number[] = [];
	const end: number[] = [];
	for (let i = 0; i < n; i++) {
		const o = n === 1 && keepOne ? Infinity : L.downMode === 'end' ? last + L.stayLitMs : L.downMode === 'next' && i < n - 1 ? Math.max(full[i], starts[i + 1]) : full[i] + L.stayLitMs;
		off.push(o);
		end.push(o + L.takeDownMs);
	}
	const sc = (a: number[]) => a.map((v) => v * pace);
	const ends = sc(end);
	return { starts: sc(starts), draws: sc(draws).map((v) => Math.max(1, v)), full: sc(full), off: sc(off), end: ends, linesEnd: n === 1 && keepOne ? full[0] * pace : n ? Math.max(...ends) : 0 };
}

export class WinLights {
	readonly root = new PIXI.Container();
	private readonly glowLayer = new PIXI.Container();
	private readonly shadowLayer = new PIXI.Container();
	private readonly wireLayer = new PIXI.Container();
	private readonly ringLayer = new PIXI.Container();
	private readonly bulbLayer = new PIXI.Container();
	private readonly hotLayer = new PIXI.Container();
	/** the nail heads (over the cords and the rings, under the bulbs and the amounts) */
	private readonly nailLayer = new PIXI.Container();
	private readonly nails: Nail[] = [];
	private nailCount = 0;
	private readonly amountLayer = new PIXI.Container();
	private readonly slots: Slot[] = [];
	/** the sheet's pictures (winLightsSpec.ts): the glow, the C7 body and its socket, the nail head, the end ring, the nail
	 *  shadow, the cord strip */
	private readonly glowTex: PIXI.Texture | null;
	private readonly bodyTex: PIXI.Texture | null;
	private readonly overTex: PIXI.Texture | null;
	private readonly headTex: PIXI.Texture | null;
	/** the end wrap (round 2: under the head, dropped; the first ring's frame stays on the sheet, not drawn) */
	private readonly ringTex: PIXI.Texture | null;
	private readonly shadowTex: PIXI.Texture | null;
	private readonly cordTex: PIXI.Texture | null;
	/** the tier's sheet px per road px, the C7 frame's anchor, the cord strip's half width (road px, its margins included) */
	private readonly ppr: number;
	private readonly c7Anchor: readonly number[];
	private readonly cordHalf: number;
	/** the cord strip's points, and the scratch arrays it is filled from (made once) */
	private readonly stripN = L.strand.cord.stripPoints;
	private readonly sx = new Float64Array(L.strand.cord.stripPoints);
	private readonly sy = new Float64Array(L.strand.cord.stripPoints);
	private readonly ox = new Float64Array(L.strand.cord.stripPoints);
	private readonly oy = new Float64Array(L.strand.cord.stripPoints);
	private active = 0;
	private plan: LightsPlan = lightsSchedule(0);
	/** TREATMENT B: the win's slam plan (null: the old way, each line's gold amount), its options */
	private slam: SlamPlan | null = null;
	private slamOpts: SlamOpts | null = null;
	/** the atlas digits' lookup (the multiplier's NumberLabel) */
	private readonly numTex: (frame: string) => PIXI.Texture | undefined;
	/** THE LABELS' PICTURES STILL TO MAKE (constants LINE_WIN.slam.ahead, game/road/winLabelText.ts): every label picture of
	 *  this win with the win clock ms it first shows, soonest first; `fresh`: the win started on this frame (its own frame
	 *  makes none ahead); the readout: pieces made ahead, pictures made on the frame they showed, the longest frame's share */
	private ahead: { text: AheadText; due: number }[] = [];
	private aheadFresh = false;
	private aheadStats = { pieces: 0, dueNow: 0, maxMs: 0, frames: 0 };

	constructor(sheet: PIXI.Texture | undefined, tier: 'full' | 'phone', numTex: (frame: string) => PIXI.Texture | undefined = () => undefined) {
		this.numTex = numTex;
		this.root.label = 'winLights';
		this.glowLayer.blendMode = 'add';
		this.hotLayer.blendMode = 'add';
		this.root.addChild(this.glowLayer, this.shadowLayer, this.wireLayer, this.ringLayer, this.nailLayer, this.bulbLayer, this.hotLayer, this.amountLayer);
		const t = WIN_LIGHTS_ART.tiers[tier];
		const cut = (f: { x: number; y: number; width: number; height: number }) => (sheet ? new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(f.x, f.y, f.width, f.height) }) : null);
		this.glowTex = cut(t.frames.glow);
		this.bodyTex = cut(t.frames.c7Body);
		this.overTex = cut(t.frames.c7Over);
		this.headTex = cut(t.frames.head);
		this.ringTex = cut(t.frames.wrap);
		this.shadowTex = cut(t.frames.shadow);
		this.cordTex = cut(t.frames.cord);
		this.ppr = t.ppr;
		this.c7Anchor = t.c7Anchor;
		this.cordHalf = t.cordHalfWidth;
	}

	/** the strand's numbers as the path builder takes them (constants LINE_WIN lights strand, read when a win starts) */
	private strandOpts(line: LightLine): StrandOpts {
		const S = L.strand;
		const W = S.cord.width;
		const ink = S.cord.ink;
		const g = strandGeometry();
		return {
			wire: W,
			ink,
			sag: S.sag.roadPx,
			sagRef: S.sag.refRoadPx,
			sagMin: S.sag.minShare,
			sagMax: S.sag.maxShare,
			hang: S.hangPoints,
			bendRad: S.bendRad,
			drapeR: g.drapeR,
			wrapR: g.drapeR,
			ringOuter: g.ringOuter,
			endOver: S.ends.overRad,
			ends: L.tips.on && !!this.headTex,
			endGap: L.tips.end === 'edge' ? g.ringOuter - S.ends.ringOverlap : null,
			hookRad: S.ends.hookRad,
			lanes: S.ends.insideLanes ? (line.lanes ?? null) : null,
			support: S.support.mode,
			everyReels: S.support.everyReels,
			minSpanReels: S.support.minSpanReels,
			betweenSymbols: S.support.betweenSymbols,
			pitch: line.pitch ?? 250,
			boardX: line.boardX ?? 142,
			valley: S.valley.style,
			sitR: S.valley.sitRadius,
			drapeRise: S.valley.drapeRise,
			drapeFillet: S.valley.drapeFillet,
			riseGoneAtRad: (S.valley.riseGoneAtDeg * Math.PI) / 180,
			risePower: S.valley.risePower,
			spanStep: S.cord.spanStep,
			arcStep: S.cord.arcStepRad,
			spacing: S.bulbs.spacing,
			firstShare: S.bulbs.firstShare,
			clearX: S.bulbs.clearX * S.bulbs.size,
			clearY: S.bulbs.clearY * S.bulbs.size,
		};
	}

	/** THE LINE'S STRAND: its path (the cord's points), its nails and its bulbs, from its winning symbols' centres */
	private string(s: Slot, line: LightLine, k: number) {
		const cells = line.cells ?? line.points.map((_, i) => `k${k}p${i}`);
		const half = line.half ?? line.points.map(() => 0);
		const st = buildStrand(line.points, cells, half, this.strandOpts(line));
		const n = st.x.length;
		if (s.px.length < n) {
			s.px = new Float64Array(n);
			s.py = new Float64Array(n);
			s.len = new Float64Array(n);
		}
		for (let i = 0; i < n; i++) {
			s.px[i] = st.x[i];
			s.py[i] = st.y[i];
			s.len[i] = st.s[i];
		}
		s.n = n;
		s.total = st.total;
		s.ropeHead = -1;
		s.ropeTail = -1;
		s.rope.visible = false;
		s.depart = st.depart;
		s.points = line.points.map((p) => ({ x: p.x, y: p.y }));
		s.nails = st.nails.map((nl) => ({ ...nl, in: 0, out: Infinity }));
		s.ends = s.nails.filter((nl) => nl.kind === 'end');
		// THE BULBS: their places, colors and the moment the cord's head (easing out) reaches each
		const S = L.strand;
		const U = S.unlit;
		const sc = 1 / this.ppr;
		const nb = Math.min(st.bulbs.length, s.bulbs.length);
		for (let b = 0; b < nb; b++) {
			const q = st.bulbs[b];
			s.bx[b] = q.x;
			s.by[b] = q.y;
			s.bArc[b] = q.s;
			// head = easeOut3(u) * total reaches `at` when u = 1 - cbrt(1 - at / total)
			s.bAt[b] = (1 - Math.cbrt(1 - q.s / s.total)) * s.draw;
			const color = s.palette[b % s.palette.length];
			s.bLit[b] = color;
			s.bDim[b] = darken(color, L.bulb.dim);
			s.bUnlit[b] = mixColor(darken(color, U.darken), U.grey, U.greyShare);
			s.bHot[b] = mixColor(color, 0xffffff, S.glow.hotWhite);
			s.bulbs[b].position.set(q.x, q.y);
			s.overs[b].position.set(q.x, q.y);
			s.bulbs[b].scale.set(sc);
			s.overs[b].scale.set(sc);
		}
		s.nb = nb;
		for (let b = nb; b < s.bulbs.length; b++) {
			s.bulbs[b].visible = false;
			s.overs[b].visible = false;
			s.glows[b].visible = false;
			s.hots[b].visible = false;
		}
	}

	/** THE CORD between `tail` and `head` (road px along the path): the strip's points are the path's own points in that
	 *  range plus its two cut ends, the rest spread along it (each piece cut in proportion to its length), so the strip
	 *  always has its stripN points and never two at one place; refilled only when the tail or the head moved */
	private fillRope(s: Slot, tail: number, head: number) {
		const rope = s.rope;
		if (head - tail < 0.5 || s.n < 2) {
			rope.visible = false;
			return;
		}
		rope.visible = true;
		if (head === s.ropeHead && tail === s.ropeTail) return;
		s.ropeHead = head;
		s.ropeTail = tail;
		const N = this.stripN;
		const X = this.sx;
		const Y = this.sy;
		// the path's piece holding length `at` (its first point's index)
		const seg = (at: number) => {
			let lo = 0;
			let hi = s.n - 1;
			while (hi - lo > 1) {
				const m = (lo + hi) >> 1;
				if (s.len[m] <= at) lo = m;
				else hi = m;
			}
			return lo;
		};
		const point = (j: number, at: number, i: number) => {
			const f = clamp01((at - s.len[j]) / Math.max(1e-9, s.len[j + 1] - s.len[j]));
			X[i] = s.px[j] + (s.px[j + 1] - s.px[j]) * f;
			Y[i] = s.py[j] + (s.py[j + 1] - s.py[j]) * f;
		};
		let k = 0;
		const j0 = seg(tail);
		point(j0, tail, k++);
		const j1 = seg(head);
		for (let j = j0 + 1; j <= j1 && k < N - 1; j++) {
			if (s.len[j] <= tail || s.len[j] >= head) continue;
			X[k] = s.px[j];
			Y[k] = s.py[j];
			k += 1;
		}
		point(j1, head, k++);
		// spread the rest of the strip's points along the pieces, in proportion to their lengths
		let sum = 0;
		for (let i = 0; i < k - 1; i++) sum += Math.hypot(X[i + 1] - X[i], Y[i + 1] - Y[i]);
		const extra = N - k;
		let left = extra;
		let o = 0;
		for (let i = 0; i < k - 1; i++) {
			const l = Math.hypot(X[i + 1] - X[i], Y[i + 1] - Y[i]);
			let c = sum > 0 ? Math.floor((extra * l) / sum) : 0;
			if (i === k - 2) c = left;
			c = Math.min(c, left);
			left -= c;
			this.ox[o] = X[i];
			this.oy[o] = Y[i];
			o += 1;
			for (let q = 1; q <= c; q++) {
				const f = q / (c + 1);
				this.ox[o] = X[i] + (X[i + 1] - X[i]) * f;
				this.oy[o] = Y[i] + (Y[i + 1] - Y[i]) * f;
				o += 1;
			}
		}
		this.ox[o] = X[k - 1];
		this.oy[o] = Y[k - 1];
		// the strip: each point pushed either side along its normal (the upper side first: the strip's top row, the
		// cord's highlight, is the upper side of a cord running left to right)
		const g = strandGeometry();
		const h = this.cordHalf * g.thickness / g.bakedThickness;
		const pos = s.ropeGeo.positions;
		let nx = 0;
		let ny = -1;
		for (let i = 0; i < N; i++) {
			const a = i > 0 ? i - 1 : 0;
			const b = i < N - 1 ? i + 1 : N - 1;
			const tx = this.ox[b] - this.ox[a];
			const ty = this.oy[b] - this.oy[a];
			const l = Math.hypot(tx, ty);
			if (l > 1e-9) {
				nx = ty / l;
				ny = -tx / l;
			}
			pos[4 * i] = this.ox[i] + nx * h;
			pos[4 * i + 1] = this.oy[i] + ny * h;
			pos[4 * i + 2] = this.ox[i] - nx * h;
			pos[4 * i + 3] = this.oy[i] - ny * h;
		}
		s.ropeGeo.getBuffer('aPosition').update();
	}

	/** the lines of a win, in the book's order; `pace` the turbo level's share of every time; `amounts` false shows no
	 *  line's own amount (a one line win, whose amount is the total; a capped spin, whose lines pay more than is
	 *  awarded) */
	set(lines: LightLine[], pace: number, amounts: boolean, slam: SlamOpts | null = null) {
		this.hide();
		this.active = Math.min(lines.length, MAX_LINES);
		const placed: { x: number; y: number; w: number; h: number }[] = [];
		const timed: { r: { x: number; y: number; w: number; h: number }; from: number; to: number }[] = [];
		this.slamOpts = slam && amounts ? slam : null;
		// (a new label scale, the phone turned or the road's scale changed it: every slot's labels take it now, so the
		// textures of slots this win does not use go too instead of staying at the old size; winLabelText.ts header, 2)
		if (this.slamOpts) for (const s of this.slots) if (s.lab) this.restyle(s.lab, this.slamOpts.scale);
		this.slam = this.slamOpts ? slamSchedule(this.active, pace, this.slamOpts.phone, this.active === 1 && (lines[0]?.multiplier ?? 1) > 1) : null;
		const plan = (this.plan = this.slam ?? lightsSchedule(this.active, pace));
		for (let k = 0; k < this.active; k++) {
			const line = lines[k];
			const s = this.slot(k);
			s.used = true;
			s.start = plan.starts[k];
			s.draw = plan.draws[k];
			s.off = plan.off[k] - plan.starts[k];
			s.down = Math.max(1, L.takeDownMs * pace);
			s.f = this.slam ? this.slam.f[k] : pace;
			s.multi = (line.multiplier ?? 1) > 1;
			s.state = 'none';
			s.pace = pace;
			s.symbol = line.symbol;
			s.palette = L.palettes[line.symbol] ?? L.palettes.L5;
			this.string(s, line, k);
			this.nailTimes(s);
			s.amountShown = false;
			s.rect = null;
			if (this.slamOpts && line.amountText) {
				// TREATMENT B: the label's widest state is its box (the plain amount and the multiplier side by side, or the line's
				// win); only amounts up at the same time block a place (a line long gone does not push a later one off its symbol)
				const o = this.slamOpts;
				const lab = this.labelOf(s, o.scale);
				const plainText = s.multi ? (line.plainText ?? line.amountText) : line.amountText;
				this.setText(lab.plain, plainText);
				this.setText(lab.plainSh, plainText);
				this.setText(lab.win, line.amountText);
				this.setText(lab.winSh, line.amountText);
				const bh = this.badgeH(o.scale);
				const multText = `x${line.multiplier ?? 1}`;
				lab.badge.set(multText, bh, X.multTint);
				lab.badgeSh.forEach((b) => b.set(multText, bh, 0x000000));
				for (const t of [lab.plain, lab.win]) t.scale.set(1);
				lab.badge.root.scale.set(1);
				// (the sizes a PIXI.Text of the same words reports: AheadText measures as the Text did)
				s.wPlain = lab.plain.textWidth();
				s.wProd = lab.win.textWidth();
				s.wBadge = s.multi ? lab.badge.root.width : 0;
				const gap = X.gap * o.scale;
				const w = s.multi ? Math.max(s.wProd, s.wPlain + gap + s.wBadge) : s.wProd;
				const h = Math.max(lab.plain.textHeight(), lab.win.textHeight());
				// the label's pictures, each when it first shows (drawSlam): made ahead of then (aheadStep)
				const due = labelDues(plan.full[k], s.multi, s.f, slamProductAt());
				if (due.plain !== null) this.ahead.push({ text: lab.plain, due: due.plain }, { text: lab.plainSh, due: due.plain });
				this.ahead.push({ text: lab.win, due: due.win }, { text: lab.winSh, due: due.win });
				const full = plan.full[k];
				const until = plan.off[k] + (o.phone ? 0.3 : 1) * s.down;
				const alive = timed.filter((q) => q.from < plan.off[k] + s.down && full < q.to).map((q) => q.r);
				// THE LABEL'S DRAWN EXTENT (2026-11-18, round 3: the first floor counted the box at 1.2 of its height, but the
				// plain amount swells to 1 + amount.swell as it pops and its soft shadow is a wider stroke dropped below it, so on
				// the twelve line win the drawn label still reached under the strip): half its drawn height and width at the
				// largest the slam ever draws it, the shadow included
				const sh = X.shadow.extra * o.scale;
				const grow = 1 + Math.max(L.amount.swell, 0.3 * X.strength);
				const halfH = ((h + sh) / 2) * grow + X.shadow.dy * o.scale;
				const halfW = ((w + sh) / 2) * grow;
				const xMin = Math.max(o.left + 40 + w / 2, o.left + halfW + 2);
				const xMax = Math.min(o.right - 40 - w / 2, o.right - halfW - 2);
				const floor = o.floor !== undefined && Number.isFinite(o.floor) ? o.floor : Infinity;
				const fit = (c: { x: number; y: number }) => {
					const x = Math.min(xMax, Math.max(xMin, c.x));
					// THE PHONE: an amount on the top lane line comes down so its top stays under that line (the tunnel top)
					let y = o.phone ? Math.max(c.y, o.topLine + X.phone.topClearRoad + h / 2) : c.y;
					// (2026-11-18, Corey at about 2000 x 945: "the Win Amount is partially hidden behind the small LED screen
					// below the board") the label as drawn stays above the strip's snow cap and the HUD
					y = Math.min(y, floor - halfH);
					return { x, y };
				};
				const slots = line.slots.map(fit);
				// (when the floor or the sides fold places together, the next free places beside and above them)
				for (const c of line.slots.map(fit)) slots.push({ x: c.x - w * 0.6, y: c.y }, { x: c.x + w * 0.6, y: c.y }, { x: c.x, y: c.y - h * 1.1 });
				for (let i = line.slots.length; i < slots.length; i++) slots[i] = fit(slots[i]);
				s.rect = this.place(slots, w, h, alive);
				timed.push({ r: s.rect, from: full, to: until });
				s.cx = s.rect.x + w / 2;
				s.cy = s.rect.y + h / 2;
				lab.root.visible = false;
			} else if (amounts && line.amountText) {
				const a = this.amountOf(s);
				a.text = line.amountText;
				a.scale.set(1);
				const w = a.width;
				const h = a.height;
				s.rect = this.place(line.slots, w, h, placed);
				placed.push(s.rect);
				a.position.set(s.rect.x + w / 2, s.rect.y + h / 2);
				a.alpha = 1;
			}
			if (s.amount) s.amount.visible = false;
		}
		this.placeNails();
		this.ahead.sort((a, b) => a.due - b.due);
		this.aheadFresh = true;
		this.root.visible = this.active > 0;
	}

	/** THE LABELS MADE AHEAD (constants LINE_WIN.slam.ahead): in the frames before each label shows, its pictures are drawn
	 *  and sent to the GPU, soonest first, one piece (a draw or an upload) at a time while the frame's budget lasts and at
	 *  least one a frame; never on the win's first frame (its strands are built then). A label still not ready when it shows
	 *  is made on that frame (drawSlam), as the Text was, so no time of the win moves. */
	private aheadStep() {
		const A = X.ahead;
		if (this.aheadFresh) {
			this.aheadFresh = false;
			return;
		}
		if (!A.on || !this.ahead.length) return;
		const res = this.labelRes();
		const t0 = performance.now();
		let did = 0;
		// (each picture finished, drawn then sent, before the next is started)
		outer: for (const j of this.ahead)
			while (j.text.step(res)) {
				did += 1;
				if (performance.now() - t0 >= A.budgetMs) break outer;
			}
		if (!did) {
			this.ahead.length = 0;
			return;
		}
		this.aheadStats.pieces += did;
		this.aheadStats.frames += 1;
		this.aheadStats.maxMs = Math.max(this.aheadStats.maxMs, Math.round((performance.now() - t0) * 100) / 100);
	}
	/** a label picture that shows now: made now if it is not yet (counted: the readout's dueNow) */
	private showNow(t: AheadText) {
		const res = this.labelRes();
		if (t.ready(res)) return;
		this.aheadStats.dueNow += 1;
		t.ensure(res);
	}
	/** DEV / probes: the labels' pictures of this win (when each shows, ready or not) and the counts since the page loaded */
	aheadSnapshot() {
		const res = this.labelRes();
		return { on: X.ahead.on, budgetMs: X.ahead.budgetMs, res, density: LABEL_SCREEN_DENSITY ? 'screen' : 'road', left: this.ahead.filter((j) => !j.text.ready(res)).length, jobs: this.ahead.map((j) => ({ due: Math.round(j.due * 10) / 10, ...j.text.info(res) })), ...this.aheadStats };
	}
	/** THE LABELS' RESOLUTION (texture px per road px): the renderer's, as a PIXI.Text is drawn; with the staging switch
	 *  `?labeldensity=screen` (winLabelText.ts header) screenPxPerCss per CSS px at the label's largest size on screen: the
	 *  amount layer's scale on screen times the slam's peak swell, never above the renderer's */
	private labelRes(): number {
		const r = aheadResolution();
		if (!LABEL_SCREEN_DENSITY) return r;
		const wt = this.amountLayer.worldTransform;
		return screenLabelResolution(Math.hypot(wt.a, wt.b), this.labelPeak(), r);
	}
	/** the largest the slam ever draws a label (drawSlam): the pop's swell (1 + amount.swell, today 1.35), the punch
	 *  (1 + 0.3 x strength) and the squash's stretch (1 + 0.4 x (0.45 x strength x 0.5 + 0.2)) */
	private labelPeak(): number {
		const st = X.strength;
		return Math.max(1 + L.amount.swell, 1 + 0.3 * st, 1 + 0.4 * (0.45 * st * 0.5 + 0.2));
	}

	/** when each nail of a line comes and goes, ms into the line: the start nail as the line starts (before its cord) until
	 *  it starts coming down (the tail leaves it first); a middle nail as the cord's head is about to reach its joint
	 *  until the tail has passed it; the end nail as the head is about to reach it until the line's last cord goes */
	private nailTimes(s: Slot) {
		if (!s.nails.length) return;
		const total = Math.max(1, s.total);
		// head = easeOut3(u) * total reaches `at` when u = 1 - cbrt(1 - at / total); the tail likewise over the take down
		const share = (at: number) => 1 - Math.cbrt(1 - clamp01(at / total));
		const g = strandGeometry();
		const live = Number.isFinite(s.off);
		for (const nl of s.nails) {
			if (nl.kind === 'end' && nl.s <= 0) {
				nl.in = 0;
				nl.out = s.off;
			} else if (nl.kind === 'end') {
				nl.in = share(s.total - g.ringOuter) * s.draw;
				nl.out = live ? s.off + s.down - L.tips.outMs * s.pace : Infinity;
			} else {
				nl.in = share(nl.s - nl.half - g.drapeR) * s.draw;
				nl.out = live ? s.off + share(nl.s + nl.half) * s.down : Infinity;
			}
		}
	}

	/** one nail per key, shared by every line through it: up from the first of them to the last */
	private placeNails() {
		this.nailCount = 0;
		const byKey = new Map<string, Nail>();
		const turns = Math.max(0, Math.round(L.strand.ends.wrapTurns));
		for (let k = 0; k < this.active; k++) {
			const s = this.slots[k];
			for (const e of s.nails) {
				let n = byKey.get(e.key);
				if (!n) {
					n = this.nail(this.nailCount++, e.kind === 'end' ? turns : 0);
					n.key = e.key;
					n.kind = e.kind;
					n.x = e.x;
					n.y = e.y;
					n.ups = [];
					n.lines = [];
					n.turns = e.kind === 'end' ? turns : 0;
					byKey.set(e.key, n);
				}
				n.ups.push({ in: s.start + e.in, out: s.start + e.out });
				if (!n.lines.includes(k)) n.lines.push(k);
			}
		}
		// it comes with the first of its lines and goes with the last (it stays between them, never pops twice)
		for (const n of byKey.values()) n.ups = [{ in: Math.min(...n.ups.map((u) => u.in)), out: Math.max(...n.ups.map((u) => u.out)) }];
		for (let i = this.nailCount; i < this.nails.length; i++) this.showNail(this.nails[i], false);
	}

	/** nail i of the pool, with at least `turns` wrap rings (its sprites made the first time) */
	private nail(i: number, turns: number): Nail {
		const make = (tex: PIXI.Texture | null, layer: PIXI.Container) => {
			const sp = new PIXI.Sprite(tex ?? PIXI.Texture.EMPTY);
			sp.anchor.set(0.5);
			sp.visible = false;
			layer.addChild(sp);
			return sp;
		};
		while (this.nails.length <= i) this.nails.push({ sprite: make(this.headTex, this.nailLayer), shadow: make(this.shadowTex, this.shadowLayer), rings: [], key: '', kind: '', x: 0, y: 0, ups: [], lines: [], scale: 0, turns: 0 });
		const n = this.nails[i];
		// the deeper turns go under the shallower ones (each ring added at the bottom of its nail's own)
		while (n.rings.length < turns) {
			const r = new PIXI.Sprite(this.ringTex ?? PIXI.Texture.EMPTY);
			r.anchor.set(0.5);
			r.visible = false;
			const above = n.rings[n.rings.length - 1];
			this.ringLayer.addChildAt(r, above ? this.ringLayer.getChildIndex(above) : this.ringLayer.children.length);
			n.rings.push(r);
		}
		return n;
	}

	private showNail(n: Nail, on: boolean) {
		n.sprite.visible = on;
		n.shadow.visible = on;
		for (let j = 0; j < n.rings.length; j++) n.rings[j].visible = on && j < n.turns;
	}

	/** the nails at win clock `t`: each pops in (the bulbs' back-out, from popFrom) and shrinks away (an ease in), its
	 *  shadow and wrap rings with it */
	private updateNails(t: number, pace: number) {
		const T = L.tips;
		const E = L.strand.ends;
		const W = L.strand.cord.width;
		const pop = Math.max(1, T.popMs * pace);
		const out = Math.max(1, T.outMs * pace);
		const sc = 1 / this.ppr;
		const back = (p: number) => T.popFrom + (1 - T.popFrom) * (1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2));
		for (let i = 0; i < this.nailCount; i++) {
			const n = this.nails[i];
			let k = 0;
			for (const u of n.ups) {
				if (t < u.in) continue;
				const at = back(clamp01((Math.min(t, u.out) - u.in) / pop));
				let v = at;
				if (t >= u.out) {
					const q = clamp01((t - u.out) / out);
					v = q >= 1 ? 0 : (1 - q * q) * at;
				}
				k = Math.max(k, v);
			}
			n.scale = k;
			const on = k > 0.001;
			this.showNail(n, on);
			if (!on) continue;
			n.sprite.position.set(n.x, n.y);
			n.sprite.scale.set(sc * k);
			n.shadow.position.set(n.x, n.y);
			n.shadow.scale.set(sc * k);
			for (let j = 0; j < n.turns; j++) {
				const r = n.rings[j];
				r.position.set(n.x + j * W * E.turnStep[0] * k, n.y + j * W * E.turnStep[1] * k);
				r.scale.set(sc * k);
				r.tint = j ? darken(0xffffff, 1 - E.turnDarken * j) : 0xffffff;
			}
		}
	}

	/** DEV / probes: the nails as set for this win (road px): their radii, color and the numbers the sheet was baked for;
	 *  each nail's key, kind, place, scale now, the lines sharing it, when up, its wrap rings shown */
	nailSnapshot() {
		const r = (v: number) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
		const g = strandGeometry();
		const r3 = (v: number) => Math.round(v * 1000) / 1000;
		return {
			on: L.tips.on,
			end: L.tips.end,
			/** the circle the cord comes over at an end nail (the drape's), the wrap's outer radius, its drop below the head's
			 *  centre, the share of it the head covers, and the end nail's whole reach */
			over: r3(g.drapeR),
			ring: r3(g.wrap.outer),
			wrapInner: r3(g.wrap.inner),
			wrapDrop: r3(g.wrap.drop),
			wrapCovered: r3(wrapCovered(g.headR, L.strand.cord.ink, g.wrap)),
			wrapUnderHead: this.root.getChildIndex(this.ringLayer) < this.root.getChildIndex(this.nailLayer),
			ringOuter: r3(g.ringOuter),
			head: r3(g.headOuter),
			drape: r3(g.drapeR),
			shank: r3(g.shank),
			color: L.strand.nail.color,
			turns: L.strand.ends.wrapTurns,
			bakedFor: WIN_LIGHTS_ART.strand.bakedFor,
			drawn: r3(2 * g.headOuter),
			layerBelowAmounts: this.root.getChildIndex(this.nailLayer) < this.root.getChildIndex(this.amountLayer),
			nails: this.nails.slice(0, this.nailCount).map((n) => ({ key: n.key, kind: n.kind, x: r(n.x), y: r(n.y), scale: Math.round(n.scale * 1000) / 1000, visible: n.sprite.visible, rings: n.rings.filter((q) => q.visible).length, lines: [...n.lines], ups: n.ups.map((u) => ({ in: r(u.in), out: r(u.out) })) })),
		};
	}

	/** the last light is down (ms into the win; a one line win: its line strung): the total comes then */
	linesDoneMs(): number {
		return this.active ? this.plan.linesEnd : 0;
	}

	/** the win's schedule as set (the probes, the symbols' pulse) */
	schedule(): LightsPlan {
		return this.plan;
	}

	/** the lines' plan in use (ms into the win at its pace) */
	linePlan(): LightsPlan {
		return this.plan;
	}

	/** THE SIGN WINS (constants SIGN_WIN stagger): ms into the win when line `k`'s wire head reaches road x `x` (a winning
	 *  symbol's centre; the head runs left to right, easing out over the line's draw); Infinity for no such line */
	reachAt(k: number, x: number): number {
		if (k >= this.active) return Infinity;
		const s = this.slots[k];
		if (!s || s.n < 2 || s.total <= 0) return this.plan.starts[k] ?? Infinity;
		let at = s.total;
		if (x <= s.px[0]) at = 0;
		else {
			for (let j = 0; j < s.n - 1; j++) {
				if (s.px[j + 1] >= x) {
					const f = (x - s.px[j]) / Math.max(1e-6, s.px[j + 1] - s.px[j]);
					at = s.len[j] + (s.len[j + 1] - s.len[j]) * f;
					break;
				}
			}
		}
		// head = easeOut3(u) * total reaches `at` when u = 1 - cbrt(1 - at / total)
		return s.start + (1 - Math.cbrt(1 - clamp01(at / s.total))) * s.draw;
	}

	/** is line `k` up (stringing, lit or coming down) at win clock `t` */
	lineUp(k: number, t: number): boolean {
		const p = this.plan;
		return k < this.active && t >= p.starts[k] && t < p.end[k];
	}

	/** the win's clock: `t` ms into the win */
	update(t: number) {
		if (this.slam) this.aheadStep();
		if (this.nailCount) this.updateNails(t, this.slots[0]?.pace ?? 1);
		const B = L.bulb;
		const C = L.chase;
		const S = L.strand;
		const G = S.glow;
		const A = L.amount;
		const glowTex = this.glowTex;
		const glowSc = glowTex ? (G.diameterRoadPx * S.bulbs.size) / glowTex.frame.width : 1;
		const hotSc = glowTex ? (G.hotDiameterRoadPx * S.bulbs.size) / glowTex.frame.width : 1;
		const sc = 1 / this.ppr;
		const center = WIN_LIGHTS_ART.strand.c7.center;
		const steps = Math.max(1, S.unlit.steps);
		for (let k = 0; k < this.active; k++) {
			const s = this.slots[k];
			const local = t - s.start;
			const u = clamp01(local / s.draw);
			// COMING DOWN: the cord retracts from its start toward its end (the tail), the bulbs behind it go out, its
			// amount fades with it; gone once the tail is at the end
			const downU = local >= s.off ? clamp01((local - s.off) / s.down) : 0;
			const gone = local >= s.off + s.down;
			const tail = easeOut3(downU) * s.total;
			const head = local < 0 || gone ? -1 : easeOut3(u) * s.total;
			const fade = 1 - easeOut3(downU);
			s.frac = local < 0 ? 0 : Math.round(u * 1000) / 1000;
			// THE CORD: the strip between the tail and the head
			this.fillRope(s, Math.max(0, tail), head);
			// THE BULBS: each lights (pops up) the moment the cord reaches it, all lit while the cord draws; then the chase (a
			// wave of light along the line) or the old steps
			const drawn = local >= s.draw;
			const since0 = local - s.draw;
			const step = drawn ? Math.floor(since0 / Math.max(1, C.stepMs * s.pace)) : 0;
			const period = Math.max(1, S.chase.periodMs * s.pace);
			let lit = 0;
			for (let b = 0; b < s.nb; b++) {
				const bulb = s.bulbs[b];
				const over = s.overs[b];
				const glow = s.glows[b];
				const hot = s.hots[b];
				const since = local - s.bAt[b];
				if (local < 0 || since < 0 || head < 0 || s.bArc[b] < tail) {
					bulb.visible = false;
					over.visible = false;
					glow.visible = false;
					hot.visible = false;
					continue;
				}
				lit += 1;
				const p = clamp01(since / Math.max(1, B.popMs * s.pace));
				// out past its size and back (a back-out ease), from popFrom
				const back = 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
				const k2 = B.popFrom + (1 - B.popFrom) * back;
				let level = 1;
				if (drawn) {
					if (S.animation === 'steps') level = (b + step) % C.cycle === 0 ? 1 : 0;
					else {
						const v = 0.5 + 0.5 * Math.cos(Math.PI * 2 * (b / S.chase.waveBulbs - since0 / period));
						level = v * v;
					}
				}
				const lv = Math.round(level * steps) / steps;
				bulb.visible = true;
				bulb.scale.set(sc * k2);
				bulb.tint = lv >= 1 ? s.bLit[b] : mixColor(s.bUnlit[b], s.bLit[b], lv);
				over.visible = true;
				over.scale.set(sc * k2);
				const cy = s.by[b] + center * k2;
				glow.visible = true;
				glow.position.set(s.bx[b], cy);
				glow.scale.set(glowSc * k2);
				glow.tint = s.bLit[b];
				glow.alpha = fade * G.strength * (G.floor + (1 - G.floor) * level);
				// the lit bulb's hot core: its glass reads lit where the glow is lost on a light ground
				hot.visible = level > 0.05;
				if (hot.visible) {
					hot.position.set(s.bx[b], cy);
					hot.scale.set(hotSc * k2);
					hot.tint = s.bHot[b];
					hot.alpha = G.hotAlpha * level * fade;
				}
			}
			s.lit = lit;
			// TREATMENT B: the plain amount, its multiplier slamming in, the line's win (LINE_WIN slam)
			if (this.slam && s.lab && s.rect) {
				this.drawSlam(s, local, gone ? 0 : fade);
				continue;
			}
			// THE LINE'S OWN AMOUNT: pops in as its wire is complete, swelling once; fades as the total arrives
			const a = s.amount;
			if (a && s.rect) {
				const show = local >= s.draw && !gone && fade > 0;
				a.visible = show;
				s.amountShown = show;
				if (show) {
					const q = clamp01((local - s.draw) / Math.max(1, A.popMs * s.pace));
					a.scale.set(1 + A.swell * Math.sin(q * Math.PI));
					a.alpha = fade;
				}
			}
		}
	}

	/** everything off (the win is gone, or the next one starts) */
	hide() {
		for (const s of this.slots) {
			if (!s.used) continue;
			s.used = false;
			s.rope.visible = false;
			s.ropeHead = -1;
			s.ropeTail = -1;
			for (const b of s.bulbs) b.visible = false;
			for (const o of s.overs) o.visible = false;
			for (const g of s.glows) g.visible = false;
			for (const h of s.hots) h.visible = false;
			if (s.amount) s.amount.visible = false;
			if (s.lab) s.lab.root.visible = false;
			s.amountShown = false;
			s.state = 'none';
			s.lit = 0;
			s.frac = 0;
		}
		for (const n of this.nails) this.showNail(n, false);
		this.nailCount = 0;
		this.active = 0;
		this.ahead.length = 0;
		this.aheadFresh = false;
		this.slam = null;
		this.slamOpts = null;
		this.root.visible = false;
	}

	/** TREATMENT B's plan as set (null: the old way) */
	slamPlan(): SlamPlan | null {
		return this.slam;
	}

	/** WHERE AND WHEN LINE k's MULTIPLIER SHOWS (treatment B: it pops in beside the plain amount, drawSlam 'side'): road
	 *  px, ms into the win; null when the line shows none (no multiplier, no slam). The Wilds' copies fly to it when two
	 *  multipliers add on the line (game/road/wildMult.ts, constants WILD_MULT win fly). */
	badgeAt(k: number): { x: number; y: number; at: number } | null {
		const s = this.slots[k];
		if (!this.slam || !this.slamOpts || k >= this.active || !s || !s.multi || !s.lab) return null;
		const gw = s.wPlain + X.gap * this.slamOpts.scale + s.wBadge;
		return { x: s.cx + gw / 2 - s.wBadge / 2, y: s.cy, at: s.start + s.draw + X.beats.plain * s.f };
	}
	/** ONE LINE'S SLAM at `local` ms into its line (the mock's drawLabel, treatment B): alone first, its multiplier pops in
	 *  beside it, the two sit together, squash into each other (a back-in ease) and the line's win punches out, flashing
	 *  halfway to yellow; a line with no multiplier shows its amount alone, swelling once. `fade` its line's take-down. */
	private drawSlam(s: Slot, local: number, fade: number) {
		const lab = s.lab!;
		const a = local - s.draw;
		const show = a >= 0 && fade > 0.001;
		lab.root.visible = show;
		s.amountShown = show;
		if (!show) {
			s.state = 'none';
			return;
		}
		const st = X.strength;
		const q = clamp01(a / Math.max(1, L.amount.popMs * s.pace));
		const swell = 1 + L.amount.swell * Math.sin(q * Math.PI);
		const cx = s.cx;
		const cy = s.cy;
		const sc = this.slamOpts?.scale ?? 1;
		const plain = (x: number, sx: number, sy: number, alpha: number) => {
			for (const t of [lab.plainSh, lab.plain]) {
				t.visible = alpha > 0.001;
				if (t.visible) this.showNow(t);
				t.scale.set(sx, sy);
				t.alpha = t === lab.plain ? alpha : alpha * X.shadow.alpha;
			}
			lab.plain.position.set(x, cy);
			lab.plainSh.position.set(x, cy + X.shadow.dy * sc);
		};
		const win = (x: number, sx: number, sy: number, alpha: number, flash: number) => {
			for (const t of [lab.winSh, lab.win]) {
				t.visible = alpha > 0.001;
				if (t.visible) this.showNow(t);
				t.scale.set(sx, sy);
				t.alpha = t === lab.win ? alpha : alpha * X.shadow.alpha;
			}
			lab.win.position.set(x, cy);
			lab.winSh.position.set(x, cy + X.shadow.dy * sc);
			lab.win.tint = flash > 0 ? mixColor(X.amountFill, X.flashTint, flash) : X.amountFill;
		};
		const badge = (x: number, sx: number, sy: number, alpha: number) => {
			const on = alpha > 0.001;
			lab.badge.root.visible = on;
			lab.badge.root.position.set(x, cy);
			lab.badge.root.scale.set(sx, sy);
			lab.badge.root.alpha = alpha;
			lab.badgeSh.forEach((b, i) => {
				b.root.visible = on;
				b.root.position.set(x, cy + X.shadow.drops[i] * sc);
				b.root.scale.set(sx * X.shadow.grow[i], sy * X.shadow.grow[i]);
				b.root.alpha = alpha * X.shadow.alphas[i];
			});
		};
		if (!s.multi) {
			plain(cx, 1, 1, 0);
			badge(cx, 1, 1, 0);
			win(cx, swell, swell, fade, 0);
			s.state = 'win';
			return;
		}
		const B = X.beats;
		const f = s.f;
		const t1 = B.plain * f;
		const t2 = t1 + B.side * f;
		const t3 = t2 + B.both * f;
		const t4 = t3 + B.squash * f;
		const gap = X.gap * sc;
		const gw = s.wPlain + gap + s.wBadge;
		const ax = cx - gw / 2 + s.wPlain / 2;
		const bx = cx + gw / 2 - s.wBadge / 2;
		if (a < t1) {
			plain(cx, swell, swell, fade);
			badge(bx, 1, 1, 0);
			win(cx, 1, 1, 0, 0);
			s.state = 'plain';
		} else if (a < t3) {
			const v = clamp01((a - t1) / Math.max(1, t2 - t1));
			plain(cx + (ax - cx) * easeOut3(v), 1, 1, fade);
			const k = 0.4 + 0.6 * backOut(v);
			badge(bx, k, k, fade * clamp01(v * 3));
			win(cx, 1, 1, 0, 0);
			s.state = 'side';
		} else if (a < t4) {
			const v = clamp01((a - t3) / Math.max(1, t4 - t3));
			const m = backIn(v);
			const squ = 1 - (0.45 * st * 0.5 + 0.2) * clamp01(m);
			plain(ax + (cx - s.wPlain * 0.18 - ax) * m, squ, 1 + (1 - squ) * 0.4, fade);
			badge(bx + (cx + s.wBadge * 0.1 - bx) * m, 1 - 0.5 * clamp01(m), 1, fade * (1 - clamp01((v - 0.75) / 0.25)));
			win(cx, 1, 1, 0, 0);
			s.state = 'squash';
		} else {
			const v = clamp01((a - t4) / Math.max(1, B.pop * f));
			const amp = 0.3 * st;
			const e = Math.exp(-5 * v) * Math.cos(2.4 * Math.PI * v);
			plain(cx, 1, 1, 0);
			badge(cx, 1, 1, 0);
			win(cx, 1 + amp * e, 1 - amp * 0.5 * e, fade, clamp01(1 - v * 3.5));
			s.state = 'win';
		}
	}

	/** the multiplier's height: its digit cap the amount's (the digit face is faceShare of the atlas frame) */
	private badgeH(scale: number) {
		return (X.capRatio * L.amount.size * scale) / X.faceShare;
	}

	private setText(t: AheadText, text: string) {
		if (t.text !== text) t.text = text;
	}

	/** a line's slam label, made the first time its slot is used, its sizes set for `scale` */
	private labelOf(s: Slot, scale: number): SlamLabel {
		const A = L.amount;
		const size = A.size * scale;
		const edge = A.strokeWidth * scale;
		const style = (fill: number, stroke: number, width: number) => slamTextStyle(size, fill, stroke, width);
		if (!s.lab) {
			const text = (fill: number, stroke: number, width: number, tag: string) => {
				const t = new AheadText(style(fill, stroke, width));
				t.anchor.set(0.5);
				t.tag = tag;
				return t;
			};
			const h = this.badgeH(scale);
			const lab: SlamLabel = {
				root: new PIXI.Container(),
				plain: text(X.amountFill, A.stroke, edge, 'plain'),
				plainSh: text(0x000000, 0x000000, edge + X.shadow.extra * scale, 'plainShadow'),
				win: text(X.amountFill, A.stroke, edge, 'win'),
				winSh: text(0x000000, 0x000000, edge + X.shadow.extra * scale, 'winShadow'),
				badge: new NumberLabel(this.numTex, h, X.multTint),
				badgeSh: [new NumberLabel(this.numTex, h, 0x000000), new NumberLabel(this.numTex, h, 0x000000)],
			};
			// every shadow under every face
			lab.root.addChild(lab.plainSh, lab.winSh, ...lab.badgeSh.map((b) => b.root), lab.plain, lab.win, lab.badge.root);
			lab.root.visible = false;
			this.amountLayer.addChild(lab.root);
			s.lab = lab;
		}
		const lab = s.lab;
		this.restyle(lab, scale);
		return lab;
	}
	/** (a resize to or from the phone's size: the sizes again; an AheadText lets its old texture go as its style is set) */
	private restyle(lab: SlamLabel, scale: number) {
		const A = L.amount;
		const size = A.size * scale;
		if (lab.plain.fontSize === size) return;
		const edge = A.strokeWidth * scale;
		const style = (fill: number, stroke: number, width: number) => slamTextStyle(size, fill, stroke, width);
		for (const t of [lab.plain, lab.win]) t.setStyle(style(X.amountFill, A.stroke, edge));
		for (const t of [lab.plainSh, lab.winSh]) t.setStyle(style(0x000000, 0x000000, edge + X.shadow.extra * scale));
	}

	/** DEV / probes: each line as drawn now */
	snapshot() {
		return this.slots.slice(0, this.active).map((s, k) => ({
			line: k,
			symbol: s.symbol,
			start: Math.round(s.start * 10) / 10,
			drawMs: Math.round(s.draw * 10) / 10,
			offMs: Number.isFinite(s.off) ? Math.round((s.start + s.off) * 10) / 10 : null,
			endMs: Number.isFinite(s.off) ? Math.round((s.start + s.off + s.down) * 10) / 10 : null,
			up: s.lit > 0 || s.rope.visible,
			frac: s.frac,
			bulbs: s.nb,
			lit: s.lit,
			litTints: s.bLit.slice(0, Math.min(s.nb, 6)).map((c) => c.toString(16).padStart(6, '0')),
			palette: s.palette.map((c) => c.toString(16).padStart(6, '0')),
			amount:
				s.lab && s.rect && this.slam
					? {
							// TREATMENT B: what the label shows now ('plain', 'side' and 'squash' the plain amount, 'win' the line's win), the
							// text up now, the multiplier drawn or not, the plain and the line's win texts, its beats' scale and type size
							text: s.state === 'win' ? s.lab.win.text : s.lab.plain.text,
							shown: s.amountShown,
							alpha: Math.round((s.state === 'win' ? s.lab.win.alpha : s.lab.plain.alpha) * 100) / 100,
							rect: { x: Math.round(s.rect.x), y: Math.round(s.rect.y), w: Math.round(s.rect.w), h: Math.round(s.rect.h) },
							state: s.state,
							plain: s.lab.plain.text,
							win: s.lab.win.text,
							multiplier: s.multi && s.lab.badge.root.visible,
							multi: s.multi,
							f: Math.round(s.f * 1000) / 1000,
							fontSize: s.lab.win.fontSize,
							/** the label as drawn now (the amount, the multiplier and their shadows), canvas CSS px */
							box: s.lab.root.visible ? (() => { const b = s.lab!.root.getBounds(); return { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 }; })() : null,
						}
					: s.amount && s.rect
						? { text: s.amount.text, shown: s.amountShown, alpha: Math.round(s.amount.alpha * 100) / 100, rect: { x: Math.round(s.rect.x), y: Math.round(s.rect.y), w: Math.round(s.rect.w), h: Math.round(s.rect.h) } }
						: null,
			/** its end nails (their centres, road px) and when each comes and goes, ms into the line */
			ends: s.ends.map((e) => ({ x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, key: e.key, in: Math.round(e.in * 10) / 10, out: Number.isFinite(e.out) ? Math.round(e.out * 10) / 10 : null })),
			/** every nail of the line in path order: its key, kind ('end', 'bend', 'post', 'support'), joint ('end', 'over',
			 *  'drape', 'sit'), place, the cord's centerline at its highest over the joint (cordY), the angle the path turns
			 *  round it inside the joint (sweep, rad), a valley's rise and the bend's turn */
			nails: s.nails.map((e) => ({ key: e.key, kind: e.kind, joint: e.joint, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, s: Math.round(e.s * 10) / 10, half: Math.round(e.half * 10) / 10, cordY: Number.isFinite(e.cordY) ? Math.round(e.cordY * 10) / 10 : null, sweep: Math.round(e.sweep * 1000) / 1000, rise: Math.round(e.rise * 100) / 100, turn: Math.round(e.turn * 1000) / 1000 })),
			/** its winning symbols' centres (road px) */
			points: s.points.map((q) => ({ x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 })),
			/** where the cord leaves the start wrap and meets the end wrap (road px; with no nails, the cord's own ends) */
			wire: s.depart.map((q) => ({ x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 })),
			/** the cord's length, its points, the half width it is drawn at (road px) */
			cord: { total: Math.round(s.total * 10) / 10, points: s.n, half: Math.round(this.cordHalf * 1000) / 1000 },
			sprites: (s.rope.visible ? 1 : 0) + s.bulbs.filter((b) => b.visible).length + s.overs.filter((b) => b.visible).length + s.glows.filter((g) => g.visible).length + s.hots.filter((g) => g.visible).length,
		}));
	}

	/** DEV: every sprite of the lights that draws now */
	spriteCount(): number {
		let n = 0;
		const walk = (c: PIXI.Container) => {
			if (!c.visible) return;
			for (const ch of c.children) {
				if (!ch.visible) continue;
				// (the amounts are not counted: an AheadText is a Sprite now, the Text it replaced never was)
				if (ch instanceof AheadText) continue;
				if (ch instanceof PIXI.Sprite) n += 1;
				else walk(ch as PIXI.Container);
			}
		};
		if (this.root.visible) walk(this.root);
		return n;
	}

	/** a line slot, its cord strip and its bulbs' sprites made the first time it is used */
	private slot(k: number): Slot {
		while (this.slots.length <= k) {
			const make = (tex: PIXI.Texture | null, anchor: readonly number[], layer: PIXI.Container) => {
				const sp = new PIXI.Sprite(tex ?? PIXI.Texture.EMPTY);
				sp.anchor.set(anchor[0], anchor[1]);
				sp.visible = false;
				layer.addChild(sp);
				return sp;
			};
			// THE CORD: one strip of stripN points, its upper side the texture's top row (the cord strip's u is the same
			// everywhere: its columns are alike)
			const N = this.stripN;
			const uvs = new Float32Array(N * 4);
			for (let i = 0; i < N; i++) {
				uvs[4 * i] = 0.5;
				uvs[4 * i + 1] = 0;
				uvs[4 * i + 2] = 0.5;
				uvs[4 * i + 3] = 1;
			}
			const indices = new Uint32Array((N - 1) * 6);
			for (let i = 0; i < N - 1; i++) {
				const v = i * 2;
				indices.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i * 6);
			}
			const ropeGeo = new PIXI.MeshGeometry({ positions: new Float32Array(N * 4), uvs, indices });
			// batched with the sprites of the same sheet (no draw call of its own)
			ropeGeo.batchMode = 'batch';
			const rope = new PIXI.Mesh({ geometry: ropeGeo, texture: this.cordTex ?? PIXI.Texture.WHITE });
			rope.visible = false;
			this.wireLayer.addChild(rope);
			// bulbs: enough for the longest line (5 reels, every span a diagonal, and its sag; the nails past the outer
			// edges lengthen its first and last span by up to a symbol's half width each)
			const most = Math.ceil((MAX_SPANS * 340 + 2 * 180) / L.strand.bulbs.spacing) + 2;
			const bulbs: PIXI.Sprite[] = [];
			const overs: PIXI.Sprite[] = [];
			const glows: PIXI.Sprite[] = [];
			const hots: PIXI.Sprite[] = [];
			for (let b = 0; b < most; b++) {
				glows.push(make(this.glowTex, [0.5, 0.5], this.glowLayer));
				// the body and then its socket over it, bulb by bulb
				bulbs.push(make(this.bodyTex, this.c7Anchor, this.bulbLayer));
				overs.push(make(this.overTex, this.c7Anchor, this.bulbLayer));
				hots.push(make(this.glowTex, [0.5, 0.5], this.hotLayer));
			}
			this.slots.push({
				used: false, start: 0, draw: 1, pace: 1, off: Infinity, down: 1, px: new Float64Array(0), py: new Float64Array(0), len: new Float64Array(0), n: 0, total: 0,
				rope, ropeGeo, ropeTail: -1, ropeHead: -1, bulbs, overs, glows, hots, bx: new Float32Array(most), by: new Float32Array(most), bAt: new Float32Array(most), bArc: new Float32Array(most),
				bLit: new Array(most).fill(0xffffff), bDim: new Array(most).fill(0x666666), bUnlit: new Array(most).fill(0x666666), bHot: new Array(most).fill(0xffffff), nb: 0, amount: null, amountShown: false, rect: null, symbol: '', palette: [], lit: 0, frac: 0,
				lab: null, f: 1, multi: false, cx: 0, cy: 0, wPlain: 0, wProd: 0, wBadge: 0, state: 'none', ends: [], nails: [], depart: [], points: [],
			});
		}
		return this.slots[k];
	}

	private amountOf(s: Slot): PIXI.Text {
		if (!s.amount) {
			const A = L.amount;
			s.amount = new PIXI.Text({
				text: '',
				style: {
					fontFamily: 'Overpass, sans-serif',
					fontWeight: '900',
					fontSize: A.size,
					fill: A.fill,
					stroke: { color: A.stroke, width: A.strokeWidth, join: 'round' },
					align: 'center',
				},
			});
			s.amount.anchor.set(0.5);
			s.amount.visible = false;
			this.amountLayer.addChild(s.amount);
		}
		return s.amount;
	}

	/** the first slot whose box touches no amount already placed; if every one does, the one that overlaps least */
	private place(slots: { x: number; y: number }[], w: number, h: number, placed: { x: number; y: number; w: number; h: number }[]) {
		const pad = L.amount.pad;
		let best: { x: number; y: number; w: number; h: number } | null = null;
		let bestOverlap = Infinity;
		for (const c of slots) {
			const r = { x: c.x - w / 2, y: c.y - h / 2, w, h };
			let overlap = 0;
			for (const q of placed) {
				const ox = Math.min(r.x + r.w + pad, q.x + q.w + pad) - Math.max(r.x - pad, q.x - pad);
				const oy = Math.min(r.y + r.h + pad, q.y + q.h + pad) - Math.max(r.y - pad, q.y - pad);
				if (ox > 0 && oy > 0) overlap += ox * oy;
			}
			if (overlap === 0) return r;
			if (overlap < bestOverlap) {
				bestOverlap = overlap;
				best = r;
			}
		}
		return best ?? { x: slots[0].x - w / 2, y: slots[0].y - h / 2, w, h };
	}
}
