// THE CHRISTMAS LIGHTS WIN LINES (constants LINE_WIN lights; Corey 2026-11-15, the win line mock's style 2).
//
// Each winning line is a hung wire of Christmas lights: a dark green wire with a dark outline from winning symbol to
// winning symbol, drooping between them, drawn in along the line; bulbs hang from it and light one after another as the
// wire reaches them, then twinkle in a chase while the line is held. The lines start one after another, faster and
// faster (lightsSchedule: staggerMs, then each gap gapRatio times the one before, each line's draw in step), and each
// line's own amount pops in on a winning symbol's top edge as its wire is complete. game/road/roadBoard.ts owns the win
// (its clock, the total, the hold, the fade) and calls set / update / hide.
//
// Plain sprites only, all made once per line slot and reused (nothing is allocated per frame): the wire is two layers
// of tinted quads of Pixi's own white texture (every outline under every core, so the joins are clean), the bulbs and
// their glows are one small sheet's two pictures (tools/build_win_lights.py), tinted; the glows are added. No filter,
// mask, shader or blur. Four layers for every line together: the wires, the nails, the glows, the bulbs (and the
// amounts, Text).
//
// THE WIRE'S ENDS (constants LINE_WIN lights tips; Corey 2026-11-18, "T2 Nail"): each end wraps once round a nail, the
// sheet's third picture (the wrap and the head together, never tinted, never turned: it is round). The wire's end point
// is the nail's centre (on the symbol's centre, or just past its outer edge); the wire itself ends where it meets the
// wrap tangentially on the wrap's lower side, so the wrap's edges carry on the wire's and its square end is under the
// wrap. One nail per symbol end, shared by every line that starts (or ends) there: up from the first of them to the
// last (a pool of sprites made at the first win that needs them). The quads and bulbs are as before: two more sprites
// a line at most.
import * as PIXI from 'pixi.js';

import { LINE_WIN } from '../constants';
import { WIN_LIGHTS_ART } from '../winLightsSpec';
import { NumberLabel } from './roadFeatures';

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
	/** sampled wire: x, y and the length along it at each point */
	px: Float32Array;
	py: Float32Array;
	len: Float32Array;
	n: number;
	total: number;
	outline: PIXI.Sprite[];
	core: PIXI.Sprite[];
	bulbs: PIXI.Sprite[];
	glows: PIXI.Sprite[];
	/** per bulb: its place, its lit and dim tints, when the wire reaches it (ms into the line) */
	bx: Float32Array;
	by: Float32Array;
	bAt: Float32Array;
	/** per bulb: its place along the wire (road px), for the take-down */
	bArc: Float32Array;
	bLit: number[];
	bDim: number[];
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
	/** THE NAILS: this line's two end points (the nails' centres, road px), its ends' keys (cell and side), when each nail
	 *  comes and goes (ms into the line) */
	ends: { x: number; y: number; key: string; in: number; out: number }[];
};

/** one nail of the pool: the sprite, the end it sits on and when it is up (ms into the win, merged over its lines) */
type Nail = { sprite: PIXI.Sprite; key: string; x: number; y: number; ups: { in: number; out: number }[]; lines: number[]; scale: number };

/** one line's slam label: the plain amount and the line's win (each with its shadow), the multiplier and its two shadows */
type SlamLabel = { root: PIXI.Container; plain: PIXI.Text; plainSh: PIXI.Text; win: PIXI.Text; winSh: PIXI.Text; badge: NumberLabel; badgeSh: NumberLabel[] };

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
	private readonly wireLayer = new PIXI.Container();
	private readonly glowLayer = new PIXI.Container();
	private readonly bulbLayer = new PIXI.Container();
	private readonly nailLayer = new PIXI.Container();
	private readonly nails: Nail[] = [];
	private nailCount = 0;
	private readonly nailTex: PIXI.Texture | null;
	private readonly amountLayer = new PIXI.Container();
	private readonly slots: Slot[] = [];
	private readonly bulbTex: PIXI.Texture | null;
	private readonly glowTex: PIXI.Texture | null;
	private active = 0;
	private plan: LightsPlan = lightsSchedule(0);
	/** TREATMENT B: the win's slam plan (null: the old way, each line's gold amount), its options */
	private slam: SlamPlan | null = null;
	private slamOpts: SlamOpts | null = null;
	/** the atlas digits' lookup (the multiplier's NumberLabel) */
	private readonly numTex: (frame: string) => PIXI.Texture | undefined;

	constructor(sheet: PIXI.Texture | undefined, tier: 'full' | 'phone', numTex: (frame: string) => PIXI.Texture | undefined = () => undefined) {
		this.numTex = numTex;
		this.root.label = 'winLights';
		this.glowLayer.blendMode = 'add';
		this.root.addChild(this.wireLayer, this.nailLayer, this.glowLayer, this.bulbLayer, this.amountLayer);
		const t = WIN_LIGHTS_ART.tiers[tier];
		const cut = (f: { x: number; y: number; width: number; height: number }) => (sheet ? new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(f.x, f.y, f.width, f.height) }) : null);
		this.bulbTex = cut(t.frames.bulb);
		this.glowTex = cut(t.frames.glow);
		this.nailTex = cut(t.frames.nail);
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
			this.sample(s, this.endPoints(s, line, k));
			this.hangBulbs(s);
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
				s.wPlain = lab.plain.width;
				s.wProd = lab.win.width;
				s.wBadge = s.multi ? lab.badge.root.width : 0;
				const gap = X.gap * o.scale;
				const w = s.multi ? Math.max(s.wProd, s.wPlain + gap + s.wBadge) : s.wProd;
				const h = Math.max(lab.plain.height, lab.win.height);
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
		this.root.visible = this.active > 0;
	}

	/** THE WIRE'S END POINTS (constants LINE_WIN lights tips): the line's points with its first and last moved to the nails'
	 *  centres (on the symbol's centre, or just past its outer edge), then to where the wire meets each wrap: the point
	 *  on the wrap's circle whose tangent is the wire's own there (its sagged span's), on the wrap's lower side */
	private endPoints(s: Slot, line: LightLine, k: number): { x: number; y: number }[] {
		const T = L.tips;
		const P = line.points.map((p) => ({ x: p.x, y: p.y }));
		s.ends = [];
		if (!T.on || P.length < 2 || !this.nailTex) return P;
		const m = P.length - 1;
		const cells = line.cells ?? [];
		if (T.end === 'edge' && line.half) {
			P[0].x -= (line.half[0] ?? 0) + T.edgeGap;
			P[m].x += (line.half[m] ?? 0) + T.edgeGap;
		}
		const A = { x: P[0].x, y: P[0].y };
		const B = { x: P[m].x, y: P[m].y };
		s.ends = [
			{ x: A.x, y: A.y, key: `${cells[0] ?? 'k' + k}:a`, in: 0, out: Infinity },
			{ x: B.x, y: B.y, key: `${cells[m] ?? 'k' + k}:b`, in: 0, out: Infinity },
		];
		const r = WIN_LIGHTS_ART.nail.ring;
		// the sagged span's tangent at its start (u 0) or its end (u 1)
		const dir = (a: { x: number; y: number }, b: { x: number; y: number }, u: number) => {
			const dx = b.x - a.x;
			const dy = b.y - a.y + Math.PI * L.sag * Math.cos(u * Math.PI);
			const l = Math.hypot(dx, dy) || 1;
			return { x: dx / l, y: dy / l };
		};
		for (let it = 0; it < 3; it++) {
			const d0 = dir(P[0], P[1], 0);
			P[0] = { x: A.x - d0.y * r, y: A.y + d0.x * r };
			const d1 = dir(P[m - 1], P[m], 1);
			P[m] = { x: B.x - d1.y * r, y: B.y + d1.x * r };
		}
		return P;
	}

	/** when each nail of a line comes and goes, ms into the line: the start nail as the line starts (before its wire) until
	 *  it starts coming down (the tail leaves it first); the end nail as the wire's head is about to reach it until the
	 *  line's last wire goes */
	private nailTimes(s: Slot) {
		if (!s.ends.length) return;
		// head = easeOut3(u) * total reaches `at` when u = 1 - cbrt(1 - at / total)
		const reach = (at: number) => (1 - Math.cbrt(1 - clamp01(at / Math.max(1, s.total)))) * s.draw;
		s.ends[0].in = 0;
		s.ends[0].out = s.off;
		s.ends[1].in = reach(s.total - WIN_LIGHTS_ART.nail.ringOuter);
		s.ends[1].out = Number.isFinite(s.off) ? s.off + s.down - L.tips.outMs * s.pace : Infinity;
	}

	/** one nail per symbol end, shared by every line that starts (or ends) there: up from the first of them to the last */
	private placeNails() {
		this.nailCount = 0;
		const byKey = new Map<string, Nail>();
		for (let k = 0; k < this.active; k++) {
			const s = this.slots[k];
			for (const e of s.ends) {
				let n = byKey.get(e.key);
				if (!n) {
					n = this.nail(this.nailCount++);
					n.key = e.key;
					n.x = e.x;
					n.y = e.y;
					n.ups = [];
					n.lines = [];
					n.sprite.position.set(e.x, e.y);
					n.sprite.visible = false;
					byKey.set(e.key, n);
				}
				n.ups.push({ in: s.start + e.in, out: s.start + e.out });
				n.lines.push(k);
			}
		}
		// it comes with the first of its lines and goes with the last (it stays between them, never pops twice)
		for (const n of byKey.values()) n.ups = [{ in: Math.min(...n.ups.map((u) => u.in)), out: Math.max(...n.ups.map((u) => u.out)) }];
		for (let i = this.nailCount; i < this.nails.length; i++) this.nails[i].sprite.visible = false;
	}

	private nail(i: number): Nail {
		while (this.nails.length <= i) {
			const sp = new PIXI.Sprite(this.nailTex ?? PIXI.Texture.EMPTY);
			sp.anchor.set(WIN_LIGHTS_ART.nail.anchor[0], WIN_LIGHTS_ART.nail.anchor[1]);
			sp.visible = false;
			this.nailLayer.addChild(sp);
			this.nails.push({ sprite: sp, key: '', x: 0, y: 0, ups: [], lines: [], scale: 0 });
		}
		return this.nails[i];
	}

	/** the nail's sprite scale at its rest size (the sheet holds it at its pop's size) */
	private get nailScale() {
		const t = this.nailTex;
		return t ? WIN_LIGHTS_ART.nail.width / WIN_LIGHTS_ART.nail.pop / t.frame.width : 1;
	}

	/** the nails at win clock `t`: each pops in (the bulbs' back-out, from popFrom) and shrinks away (an ease in) */
	private updateNails(t: number, pace: number) {
		const T = L.tips;
		const pop = Math.max(1, T.popMs * pace);
		const out = Math.max(1, T.outMs * pace);
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
			n.sprite.visible = k > 0.001;
			if (n.sprite.visible) n.sprite.scale.set(this.nailScale * k);
		}
	}

	/** DEV / probes: the nails as set for this win (road px): their end, place, scale now, the lines sharing them, when up */
	nailSnapshot() {
		const r = (v: number) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
		return {
			on: L.tips.on,
			end: L.tips.end,
			ring: WIN_LIGHTS_ART.nail.ring,
			ringOuter: WIN_LIGHTS_ART.nail.ringOuter,
			drawn: Math.round((WIN_LIGHTS_ART.nail.width / WIN_LIGHTS_ART.nail.pop) * 100) / 100,
			layerBelowAmounts: this.root.getChildIndex(this.nailLayer) < this.root.getChildIndex(this.amountLayer),
			nails: this.nails.slice(0, this.nailCount).map((n) => ({ key: n.key, x: r(n.x), y: r(n.y), scale: Math.round(n.scale * 1000) / 1000, visible: n.sprite.visible, lines: [...n.lines], ups: n.ups.map((u) => ({ in: r(u.in), out: r(u.out) })) })),
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

	/** is line `k` up (stringing, lit or coming down) at win clock `t` */
	lineUp(k: number, t: number): boolean {
		const p = this.plan;
		return k < this.active && t >= p.starts[k] && t < p.end[k];
	}

	/** the win's clock: `t` ms into the win */
	update(t: number) {
		if (this.nailCount) this.updateNails(t, this.slots[0]?.pace ?? 1);
		const B = L.bulb;
		const G = L.glow;
		const C = L.chase;
		const A = L.amount;
		for (let k = 0; k < this.active; k++) {
			const s = this.slots[k];
			const local = t - s.start;
			const u = clamp01(local / s.draw);
			// COMING DOWN: the wire retracts from its start toward its end (the tail), the bulbs behind it go out, its
			// amount fades with it; gone once the tail is at the end
			const downU = local >= s.off ? clamp01((local - s.off) / s.down) : 0;
			const gone = local >= s.off + s.down;
			const tail = easeOut3(downU) * s.total;
			const head = local < 0 || gone ? -1 : easeOut3(u) * s.total;
			const fade = 1 - easeOut3(downU);
			s.frac = local < 0 ? 0 : Math.round(u * 1000) / 1000;
			// THE WIRE: every quad between the tail and the head, the ones they are in cut at them
			const segs = s.n - 1;
			for (let j = 0; j < segs; j++) {
				const o = s.outline[j];
				const c = s.core[j];
				const a0 = s.len[j];
				const a1 = s.len[j + 1];
				if (head <= a0 || tail >= a1) {
					o.visible = false;
					c.visible = false;
					continue;
				}
				const span = Math.max(1e-6, a1 - a0);
				const f0 = tail <= a0 ? 0 : (tail - a0) / span;
				const f1 = head >= a1 ? 1 : (head - a0) / span;
				const x0 = s.px[j] + (s.px[j + 1] - s.px[j]) * f0;
				const y0 = s.py[j] + (s.py[j + 1] - s.py[j]) * f0;
				const dx = (s.px[j + 1] - s.px[j]) * (f1 - f0);
				const dy = (s.py[j + 1] - s.py[j]) * (f1 - f0);
				const seg = Math.hypot(dx, dy);
				const rot = Math.atan2(dy, dx);
				// each quad runs on past its end by half the wire's width, so a bend has no notch
				this.quad(o, x0, y0, rot, seg, L.wire.outline);
				this.quad(c, x0, y0, rot, seg, L.wire.core);
			}
			// THE BULBS: each lights (pops up) the moment the wire reaches it; in the chase one in `cycle` is lit
			const drawn = local >= s.draw;
			const step = drawn ? Math.floor((local - s.draw) / Math.max(1, C.stepMs * s.pace)) : 0;
			let lit = 0;
			for (let b = 0; b < s.nb; b++) {
				const bulb = s.bulbs[b];
				const glow = s.glows[b];
				const since = local - s.bAt[b];
				if (local < 0 || since < 0 || head < 0 || s.bArc[b] < tail) {
					bulb.visible = false;
					glow.visible = false;
					continue;
				}
				lit += 1;
				const p = clamp01(since / Math.max(1, B.popMs * s.pace));
				// out past its size and back (a back-out ease), from popFrom
				const back = 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
				const k2 = B.popFrom + (1 - B.popFrom) * back;
				const on = !drawn || (b + step) % C.cycle === 0;
				bulb.visible = true;
				bulb.scale.set(this.bulbScale * k2);
				bulb.tint = on ? s.bLit[b] : s.bDim[b];
				glow.visible = true;
				glow.scale.set(this.glowScale * k2);
				glow.tint = s.bLit[b];
				glow.alpha = on ? G.alpha : G.dimAlpha;
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
			for (const o of s.outline) o.visible = false;
			for (const c of s.core) c.visible = false;
			for (const b of s.bulbs) b.visible = false;
			for (const g of s.glows) g.visible = false;
			if (s.amount) s.amount.visible = false;
			if (s.lab) s.lab.root.visible = false;
			s.amountShown = false;
			s.state = 'none';
			s.lit = 0;
			s.frac = 0;
		}
		for (const n of this.nails) n.sprite.visible = false;
		this.nailCount = 0;
		this.active = 0;
		this.slam = null;
		this.slamOpts = null;
		this.root.visible = false;
	}

	/** TREATMENT B's plan as set (null: the old way) */
	slamPlan(): SlamPlan | null {
		return this.slam;
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
				t.scale.set(sx, sy);
				t.alpha = t === lab.plain ? alpha : alpha * X.shadow.alpha;
			}
			lab.plain.position.set(x, cy);
			lab.plainSh.position.set(x, cy + X.shadow.dy * sc);
		};
		const win = (x: number, sx: number, sy: number, alpha: number, flash: number) => {
			for (const t of [lab.winSh, lab.win]) {
				t.visible = alpha > 0.001;
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

	private setText(t: PIXI.Text, text: string) {
		if (t.text !== text) t.text = text;
	}

	/** a line's slam label, made the first time its slot is used, its sizes set for `scale` */
	private labelOf(s: Slot, scale: number): SlamLabel {
		const A = L.amount;
		const size = A.size * scale;
		const edge = A.strokeWidth * scale;
		const style = (fill: number, stroke: number, width: number) => ({ fontFamily: 'Overpass, sans-serif', fontWeight: '900' as const, fontSize: size, fill, stroke: { color: stroke, width, join: 'round' as const }, align: 'center' as const });
		if (!s.lab) {
			const text = (fill: number, stroke: number, width: number) => {
				const t = new PIXI.Text({ text: '', style: style(fill, stroke, width) });
				t.anchor.set(0.5);
				return t;
			};
			const h = this.badgeH(scale);
			const lab: SlamLabel = {
				root: new PIXI.Container(),
				plain: text(X.amountFill, A.stroke, edge),
				plainSh: text(0x000000, 0x000000, edge + X.shadow.extra * scale),
				win: text(X.amountFill, A.stroke, edge),
				winSh: text(0x000000, 0x000000, edge + X.shadow.extra * scale),
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
		// (a resize to or from the phone's size: the sizes again)
		if (lab.plain.style.fontSize !== size) {
			for (const t of [lab.plain, lab.win]) t.style = style(X.amountFill, A.stroke, edge);
			for (const t of [lab.plainSh, lab.winSh]) t.style = style(0x000000, 0x000000, edge + X.shadow.extra * scale);
		}
		return lab;
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
			up: s.lit > 0 || s.outline.some((o) => o.visible),
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
							fontSize: s.lab.win.style.fontSize,
							/** the label as drawn now (the amount, the multiplier and their shadows), canvas CSS px */
							box: s.lab.root.visible ? (() => { const b = s.lab!.root.getBounds(); return { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 }; })() : null,
						}
					: s.amount && s.rect
						? { text: s.amount.text, shown: s.amountShown, alpha: Math.round(s.amount.alpha * 100) / 100, rect: { x: Math.round(s.rect.x), y: Math.round(s.rect.y), w: Math.round(s.rect.w), h: Math.round(s.rect.h) } }
						: null,
			/** its wire's end points (the nails' centres, road px) and when each nail comes and goes, ms into the line */
			ends: s.ends.map((e) => ({ x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, key: e.key, in: Math.round(e.in * 10) / 10, out: Number.isFinite(e.out) ? Math.round(e.out * 10) / 10 : null })),
			/** the wire's own two ends as sampled (road px): where it meets the wraps */
			wire: s.n > 1 ? [{ x: Math.round(s.px[0] * 10) / 10, y: Math.round(s.py[0] * 10) / 10 }, { x: Math.round(s.px[s.n - 1] * 10) / 10, y: Math.round(s.py[s.n - 1] * 10) / 10 }] : [],
			sprites: (s.outline.filter((o) => o.visible).length + s.core.filter((c) => c.visible).length + s.bulbs.filter((b) => b.visible).length + s.glows.filter((g) => g.visible).length),
		}));
	}

	/** DEV: every sprite of the lights that draws now */
	spriteCount(): number {
		let n = 0;
		const walk = (c: PIXI.Container) => {
			if (!c.visible) return;
			for (const ch of c.children) {
				if (!ch.visible) continue;
				if (ch instanceof PIXI.Sprite) n += 1;
				else walk(ch as PIXI.Container);
			}
		};
		if (this.root.visible) walk(this.root);
		return n;
	}

	private get bulbScale() {
		const t = this.bulbTex;
		return t ? (WIN_LIGHTS_ART.bulb.width / t.frame.width) * L.bulb.scale : 1;
	}

	private get glowScale() {
		const t = this.glowTex;
		return t ? (WIN_LIGHTS_ART.glow.width / t.frame.width) * L.glow.scale : 1;
	}

	private quad(s: PIXI.Sprite, x: number, y: number, rot: number, len: number, width: number) {
		const pad = width / 2;
		const f = s.texture.frame;
		s.visible = true;
		s.position.set(x, y);
		s.rotation = rot;
		// the white texture scaled to (len + pad) by width, its anchor at the left middle, pulled back by pad / 2
		s.scale.set((len + pad) / f.width, width / f.height);
		s.pivot.set((pad / 2) * (f.width / (len + pad)), 0);
	}

	/** a line slot, its sprites made the first time it is used */
	private slot(k: number): Slot {
		while (this.slots.length <= k) {
			const segs = MAX_SPANS * L.wire.segmentsPerSpan;
			const make = (tex: PIXI.Texture, tint: number, anchor: [number, number]) => {
				const sp = new PIXI.Sprite(tex);
				sp.anchor.set(anchor[0], anchor[1]);
				sp.tint = tint;
				sp.visible = false;
				return sp;
			};
			const outline: PIXI.Sprite[] = [];
			const core: PIXI.Sprite[] = [];
			for (let j = 0; j < segs; j++) outline.push(make(PIXI.Texture.WHITE, L.wire.outlineColor, [0, 0.5]));
			for (let j = 0; j < segs; j++) core.push(make(PIXI.Texture.WHITE, L.wire.coreColor, [0, 0.5]));
			// every core over every outline, whichever line they belong to: a slot's outlines go in at the bottom of the
			// layer, its cores at the top
			for (let j = outline.length - 1; j >= 0; j--) this.wireLayer.addChildAt(outline[j], 0);
			this.wireLayer.addChild(...core);
			// bulbs: enough for the longest line (5 reels, every span a diagonal, and its droop; the nails at the outer
			// edges lengthen its first and last span by up to a symbol's half width each)
			const most = Math.ceil((MAX_SPANS * 340 + 2 * 180) / L.bulb.spacing) + 2;
			const bulbs: PIXI.Sprite[] = [];
			const glows: PIXI.Sprite[] = [];
			for (let b = 0; b < most; b++) {
				glows.push(make(this.glowTex ?? PIXI.Texture.EMPTY, 0xffffff, [0.5, 0.5]));
				bulbs.push(make(this.bulbTex ?? PIXI.Texture.EMPTY, 0xffffff, [WIN_LIGHTS_ART.bulb.anchor[0], WIN_LIGHTS_ART.bulb.anchor[1]]));
			}
			this.glowLayer.addChild(...glows);
			this.bulbLayer.addChild(...bulbs);
			const n = segs + 1;
			this.slots.push({
				used: false, start: 0, draw: 1, pace: 1, off: Infinity, down: 1, px: new Float32Array(n), py: new Float32Array(n), len: new Float32Array(n), n: 0, total: 0,
				outline, core, bulbs, glows, bx: new Float32Array(most), by: new Float32Array(most), bAt: new Float32Array(most), bArc: new Float32Array(most),
				bLit: new Array(most).fill(0xffffff), bDim: new Array(most).fill(0x666666), nb: 0, amount: null, amountShown: false, rect: null, symbol: '', palette: [], lit: 0, frac: 0,
				lab: null, f: 1, multi: false, cx: 0, cy: 0, wPlain: 0, wProd: 0, wBadge: 0, state: 'none', ends: [],
			});
		}
		return this.slots[k];
	}

	/** the wire's path: every span cut into straight pieces, drooping by `sag` at its middle (a hung wire) */
	private sample(s: Slot, points: { x: number; y: number }[]) {
		const per = L.wire.segmentsPerSpan;
		let i = 0;
		const spans = Math.min(points.length - 1, MAX_SPANS);
		for (let k = 0; k < spans; k++) {
			const a = points[k];
			const b = points[k + 1];
			for (let j = k === 0 ? 0 : 1; j <= per; j++) {
				const u = j / per;
				s.px[i] = a.x + (b.x - a.x) * u;
				s.py[i] = a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * L.sag;
				i += 1;
			}
		}
		s.n = Math.max(1, i);
		s.len[0] = 0;
		for (let j = 1; j < s.n; j++) s.len[j] = s.len[j - 1] + Math.hypot(s.px[j] - s.px[j - 1], s.py[j] - s.py[j - 1]);
		s.total = s.len[s.n - 1];
		// the quads past this line's end stay hidden
		for (let j = s.n - 1; j < s.outline.length; j++) {
			s.outline[j].visible = false;
			s.core[j].visible = false;
		}
	}

	/** a bulb every `spacing` along the wire, its colors cycling through the line's palette, and the moment the wire's
	 *  head (easing out) reaches it */
	private hangBulbs(s: Slot) {
		const B = L.bulb;
		let nb = 0;
		let seg = 0;
		for (let at = B.first; at < s.total - 4 && nb < s.bulbs.length; at += B.spacing) {
			while (seg < s.n - 2 && s.len[seg + 1] < at) seg += 1;
			const a0 = s.len[seg];
			const a1 = s.len[seg + 1];
			const f = (at - a0) / Math.max(1e-6, a1 - a0);
			s.bx[nb] = s.px[seg] + (s.px[seg + 1] - s.px[seg]) * f;
			s.by[nb] = s.py[seg] + (s.py[seg + 1] - s.py[seg]) * f;
			// head = easeOut3(u) * total reaches `at` when u = 1 - cbrt(1 - at / total)
			s.bAt[nb] = (1 - Math.cbrt(1 - at / s.total)) * s.draw;
			s.bArc[nb] = at;
			const color = s.palette[nb % s.palette.length];
			s.bLit[nb] = color;
			s.bDim[nb] = darken(color, B.dim);
			const bulb = s.bulbs[nb];
			const glow = s.glows[nb];
			// it hangs from the wire (the bulb's socket on it), its glow round the bulb's body
			bulb.position.set(s.bx[nb], s.by[nb] - 2);
			glow.position.set(s.bx[nb], s.by[nb] + WIN_LIGHTS_ART.bulb.height * L.bulb.scale * 0.58);
			nb += 1;
		}
		s.nb = nb;
		for (let b = nb; b < s.bulbs.length; b++) {
			s.bulbs[b].visible = false;
			s.glows[b].visible = false;
		}
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
