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
// mask, shader or blur. Three layers for every line together: the wires, the glows, the bulbs (and the amounts, Text).
import * as PIXI from 'pixi.js';

import { LINE_WIN } from '../constants';
import { WIN_LIGHTS_ART } from '../winLightsSpec';

const L = LINE_WIN.lights;
/** the most lines a win can have (config.paylines) */
const MAX_LINES = 12;
/** the most spans a line has (5 reels) */
const MAX_SPANS = 4;

export type LightLine = {
	/** road px of each winning symbol's centre, reel order */
	points: { x: number; y: number }[];
	/** the symbol the line pays (W: Wilds only) */
	symbol: string;
	/** this line's own amount, or '' for none */
	amountText: string;
	/** where its amount may go, best first: road px of a box's centre */
	slots: { x: number; y: number }[];
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
};

const darken = (c: number, k: number) => (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);
const easeOut3 = (u: number) => 1 - (1 - u) * (1 - u) * (1 - u);
const clamp01 = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u);

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
	private readonly amountLayer = new PIXI.Container();
	private readonly slots: Slot[] = [];
	private readonly bulbTex: PIXI.Texture | null;
	private readonly glowTex: PIXI.Texture | null;
	private active = 0;
	private plan: LightsPlan = lightsSchedule(0);

	constructor(sheet: PIXI.Texture | undefined, tier: 'full' | 'phone') {
		this.root.label = 'winLights';
		this.glowLayer.blendMode = 'add';
		this.root.addChild(this.wireLayer, this.glowLayer, this.bulbLayer, this.amountLayer);
		const t = WIN_LIGHTS_ART.tiers[tier];
		const cut = (f: { x: number; y: number; width: number; height: number }) => (sheet ? new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(f.x, f.y, f.width, f.height) }) : null);
		this.bulbTex = cut(t.frames.bulb);
		this.glowTex = cut(t.frames.glow);
	}

	/** the lines of a win, in the book's order; `pace` the turbo level's share of every time; `amounts` false shows no
	 *  line's own amount (a one line win, whose amount is the total; a capped spin, whose lines pay more than is
	 *  awarded) */
	set(lines: LightLine[], pace: number, amounts: boolean) {
		this.hide();
		this.active = Math.min(lines.length, MAX_LINES);
		const placed: { x: number; y: number; w: number; h: number }[] = [];
		const plan = (this.plan = lightsSchedule(this.active, pace));
		for (let k = 0; k < this.active; k++) {
			const line = lines[k];
			const s = this.slot(k);
			s.used = true;
			s.start = plan.starts[k];
			s.draw = plan.draws[k];
			s.off = plan.off[k] - plan.starts[k];
			s.down = Math.max(1, L.takeDownMs * pace);
			s.pace = pace;
			s.symbol = line.symbol;
			s.palette = L.palettes[line.symbol] ?? L.palettes.L5;
			this.sample(s, line.points);
			this.hangBulbs(s);
			s.amountShown = false;
			s.rect = null;
			if (amounts && line.amountText) {
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
		this.root.visible = this.active > 0;
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
			s.amountShown = false;
			s.lit = 0;
			s.frac = 0;
		}
		this.active = 0;
		this.root.visible = false;
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
			amount: s.amount && s.rect ? { text: s.amount.text, shown: s.amountShown, alpha: Math.round(s.amount.alpha * 100) / 100, rect: { x: Math.round(s.rect.x), y: Math.round(s.rect.y), w: Math.round(s.rect.w), h: Math.round(s.rect.h) } } : null,
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
			// bulbs: enough for the longest line (5 reels, every span a diagonal, and its droop)
			const most = Math.ceil((MAX_SPANS * 340) / L.bulb.spacing) + 2;
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
