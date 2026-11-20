// THE WILDS' MULTIPLIERS (Corey 2026-11-19: "E Candy Cane"): the number on a Grandma Wild's cell and on a full column
// Wild, in the approved mock's candidate E "Candy Cane Lettering" letters (Desktop/Run Over Reindeer/
// wild_multipliers_r1_2026-11-19, tools/page.html const E). Its numbers are constants WILD_MULT; its pictures are the
// multiplier atlas (tools/build_wild_mult.py, game/wildMultSpec.ts).
//
// THE LOOK: chunky Sigmar letters with an ink outline and a baked drop shadow, no backing plate, in ONE COLOR PER
// CHARACTER at every value (Corey 2026-11-19: "static colors for Reindeer Santa, Grandma"; WILD_MULT.colors): red candy
// stripes, green candy stripes, gold tinsel. THE SIZE (2026-11-19, the refit to the real values): each kind's largest
// value (WILD_MULT.maxValue, from the math) fills the frame's inside width, every smaller value of that kind stands at
// least as tall (the letters grow a little with the value, up to their band's cap), and a long number shrinks to the
// frame's inside width (a value over its kind's top too); the number stands on the inside of the frame's bottom rail
// (WILD_MULT.place floor). Each letter
// is its own sprite (the number is composed here from the atlas's glyphs). Only the GOLD number (Grandma's) has effects,
// and they grow with the value (WILD_MULT.gold steps): a sheen sweeping its letters, sparkles, a shimmer and a soft
// pulsing glow behind, all pre-baked sprites drawn additive.
//
// THE MOTION (the mock's, on the board clock: turbo and a slam stop run it faster), every character's:
//   appear  each letter drops in from big, lands with a squash and a snow puff each side, one after the other
//   change  a Grandma Wild joining a column: the number counts up to the sum, trembling, then slams down with a star
//           burst and two puffs (the stamp sound is the owner's, at the slam: slamAt)
//   win     a line through the Wild: two beats, the letters hop as a wave, a glow swells, a ring of stars
//   rest    it breathes
// No filter, mask, shader or text is used: sprites, transforms, alpha, tint and additive blending. Every sprite is made
// when the number is made; nothing is allocated per frame.
//
// THE ATLAS loads in the background from the board's mount (components/Board.svelte calls loadWildMult), never in the
// preload, and goes to the GPU through the column pictures' upload queue (game/road/columnClips.ts), before any Wild
// needs it unless one is waiting on it. A number made before it is in draws nothing until it is (and then draws as
// it would have at that moment).
import * as PIXI from 'pixi.js';

import { WILD_MULT } from '../constants';
import config from '../config';
import { WILD_MULT_ART as ART } from '../wildMultSpec';
import { PHONE_TIER } from '../deviceTier';
import { stamp } from '../assets';
import { STAGING_TOOLS, perfMark } from '../staging';
import { queuePresentUpload } from './columnClips';

export type MultPlace = 'cell' | 'col' | 'sum';
type Mode = 'hidden' | 'appear' | 'change' | 'win' | 'rest';

// ---- the atlas ----------------------------------------------------------------------------------------------------------
const SIZE = PHONE_TIER ? 'phone' : 'full';
const SHEETS = ART.sheets[SIZE];
type Row = readonly [number, number, number, number, number, number, number, number, number];
const FRAMES = SHEETS.frames as unknown as Record<string, Row>;

let textures: Map<string, PIXI.Texture> | null = null;
let sources: PIXI.TextureSource[] = [];
let loading: Promise<boolean> | null = null;
/** how many numbers are on the board waiting for the atlas (its upload then jumps the queue) */
let waiting = 0;
let mipmapper: ((source: PIXI.TextureSource) => void) | null = null;
/** set by components/Board.svelte (both tiers): the sheet is drawn well under its size (house rule) */
export const setWildMultMipmapper = (fn: typeof mipmapper) => {
	mipmapper = fn;
};

/** start loading the multiplier atlas (or join the load running); true when it is on the GPU */
export const loadWildMult = (): Promise<boolean> => {
	if (textures) return Promise.resolve(true);
	loading ??= (async () => {
		try {
			const pages: PIXI.TextureSource[] = [];
			for (const [i, page] of SHEETS.pages.entries()) {
				const base = (await PIXI.Assets.load(stamp(`/assets/${page.file}`))) as PIXI.Texture;
				mipmapper?.(base.source);
				// the column pictures' queue, with the cloud still's priority (a Wild needs it with its first frame)
				await queuePresentUpload(`wildMult:${i + 1}/${SHEETS.pages.length}`, 1, base, () => waiting > 0);
				pages.push(base.source);
			}
			const map = new Map<string, PIXI.Texture>();
			for (const [name, r] of Object.entries(FRAMES)) {
				const [page, x, y, w, h, ox, oy, fw, fh] = r;
				map.set(name, new PIXI.Texture({ source: pages[page], frame: new PIXI.Rectangle(x, y, w, h), orig: new PIXI.Rectangle(0, 0, fw, fh), trim: new PIXI.Rectangle(ox, oy, w, h) }));
			}
			sources = pages;
			textures = map;
			if (STAGING_TOOLS) perfMark('load:wildMult');
			return true;
		} catch (error) {
			// without it a Wild still stands and pays; its number is simply not drawn
			console.warn('[reindeer] the multiplier atlas failed to load', error);
			loading = null;
			return false;
		}
	})();
	return loading;
};

/** DEV / probes: the atlas as loaded (pages, sheet px, GPU MB without and with a mip chain) */
export const wildMultMemory = () => {
	const pages = sources.map((s) => ({ w: s.pixelWidth, h: s.pixelHeight, mips: !!s.autoGenerateMipmaps }));
	const mb = pages.reduce((n, p) => n + (p.w * p.h * 4) / 1048576, 0);
	return { size: SIZE, loaded: !!textures, pages, mb: Math.round(mb * 100) / 100, mbWithMips: Math.round(mb * (pages.some((p) => p.mips) ? 4 / 3 : 1) * 100) / 100, files: SHEETS.pages.map((p) => ({ file: p.file, kb: p.kb })) };
};

const tex = (name: string): PIXI.Texture | null => textures?.get(name) ?? null;

// ---- maths (the mock's) --------------------------------------------------------------------------------------------------
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const eOut = (u: number) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const eIn = (u: number) => Math.pow(clamp(u, 0, 1), 2);
const bump = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u));
const rnd = (s: number) => {
	const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
	return x - Math.floor(x);
};
/** the value band the letters grow by: 0 under 10x, 1 from 10x, 2 from 50x, 3 from 100x (WILD_MULT.bandFrom) */
export const multBand = (v: number) => {
	const f = WILD_MULT.bandFrom;
	return v >= f[2] ? 3 : v >= f[1] ? 2 : v >= f[0] ? 1 : 0;
};
export type MultColor = 'red' | 'green' | 'gold';
type MultKind = keyof typeof WILD_MULT.maxValue;

/** the letters' width at design size (the layout's sum: advances less the tuck between letters) */
const inkOf = (text: string) => {
	let x = 0;
	for (let i = 0; i < text.length; i++) x += ((ART.adv as Record<string, number>)[text[i]] ?? 0) - ART.tuck;
	return x + ART.tuck;
};
/** the largest value a number in this place and color can show (WILD_MULT.maxValue): a cell is the Grandma Wild, a
 *  column the character whose color it wears (WILD_MULT.colors; the larger if two ever share one), a flying copy the
 *  largest of all */
const kindMax = (place: MultPlace, color: MultColor): number => {
	const M = WILD_MULT.maxValue;
	if (place === 'cell') return M.cell;
	const all = Math.max(...Object.values(M));
	if (place === 'sum') return all;
	const tiers = (Object.keys(WILD_MULT.colors) as (keyof typeof WILD_MULT.colors)[]).filter((t) => WILD_MULT.colors[t] === color);
	return tiers.length ? Math.max(...tiers.map((t) => M[t])) : all;
};
/** the letter height (road px) at which a kind's largest value fills its place's inside width, never over the place's
 *  largest cap: every value of that kind up to its top stands at least this tall */
const kindTop = (place: MultPlace, max: number) => {
	const P = WILD_MULT.place[place];
	return Math.min(P.caps[P.caps.length - 1], (ART.cap * P.maxW) / inkOf(`${max}x`));
};
/** the tops the rules page gives (config.multipliers), per kind: what WILD_MULT.maxValue should say */
export const rulesMax = (): Record<MultKind, number> => {
	const M = config.multipliers;
	const C = M.column;
	const top = (k: 'reindeer' | 'santa' | 'grandma') => Math.max(C.base[k][1], C.freeSpins[k][1], C.super[k][1], (M.bonusRare as Record<string, number>)[k] ?? 0);
	return { cell: Math.max(M.grandmaWild.base[1], M.grandmaWild.freeSpins[1], M.grandmaWild.super[1]), reindeer: top('reindeer'), santa: top('santa'), grandma: top('grandma') };
};
if (import.meta.env.DEV) {
	const r = rulesMax();
	for (const k of Object.keys(r) as MultKind[]) if (r[k] !== WILD_MULT.maxValue[k]) console.warn(`[reindeer] WILD_MULT.maxValue.${k} is ${WILD_MULT.maxValue[k]}x, the rules page's top is ${r[k]}x (config.multipliers): the number's fit follows maxValue`);
}
type GoldStep = (typeof WILD_MULT.gold.steps)[number];
const GOLD_KEYS = ['sheenMs', 'sheenAlpha', 'sparkles', 'sparkleScale', 'shimmer', 'glow', 'glowPulse', 'pulseMs'] as const;

const MAX_GLYPHS = 5;
const MAX_STARS = 9;
const MAX_PUFFS = 2 * MAX_GLYPHS;
let warned = false;

/** ONE MULTIPLIER in one color set. Its root is placed by its owner on the inside of its frame's bottom rail (a cell or a
 *  column: WILD_MULT.place floor), or at its centre (a flying copy); the number stands on it */
export class WildMult {
	readonly root = new PIXI.Container();
	private readonly body = new PIXI.Container();
	private readonly glow: PIXI.Sprite;
	private readonly glyphs: PIXI.Sprite[] = [];
	private readonly sheens: PIXI.Sprite[] = [];
	private readonly stars: PIXI.Sprite[] = [];
	private readonly puffs: PIXI.Sprite[] = [];
	private mode: Mode = 'hidden';
	private t0 = 0;
	/** the value it shows when at rest, and (change) the value it counts up from */
	private value = 0;
	private from = 0;
	private seed: number;
	private still = false;
	private wantsAtlas = false;
	// the layout of the text drawn now (made when the value drawn changes, kept: never per frame)
	private text = '';
	private band = 0;
	/** the letter height the value is laid out for before the width's limit (its band's cap, or its kind's top) */
	private capFor = 0;
	/** the largest value its kind carries, and the letter height at which that value fills the frame's inside */
	private readonly max: number;
	private readonly top: number;
	private s = 1;
	private width = 0;
	private cap = 0;
	private n = 0;
	private readonly xs = new Float64Array(MAX_GLYPHS);
	private readonly glyphTex: (PIXI.Texture | null)[] = new Array(MAX_GLYPHS).fill(null);
	private readonly sheenTex: (PIXI.Texture | null)[] = new Array(MAX_GLYPHS).fill(null);
	private laidValue = -1;
	/** the gold's effects at the value laid out (blended from WILD_MULT.gold.steps when the value changes) */
	private readonly fx: Record<(typeof GOLD_KEYS)[number], number> = { sheenMs: 1, sheenAlpha: 0, sparkles: 0, sparkleScale: 0, shimmer: 0, glow: 0, glowPulse: 0, pulseMs: 1 };
	/** what the probes read: the value drawn last frame, the move, the group scale, the gold's effects */
	private drawn = { value: 0, mode: 'hidden' as Mode, scale: 1, text: '', sheen: 0, sparkles: 0, glow: 0 };
	private si = 0;
	private pi = 0;

	constructor(
		private readonly place: MultPlace,
		readonly color: MultColor,
		seed = 0,
	) {
		this.seed = seed;
		this.max = kindMax(place, color);
		this.top = kindTop(place, this.max);
		this.root.addChild(this.body);
		const sprite = (add: boolean, list: PIXI.Sprite[] | null) => {
			const sp = new PIXI.Sprite();
			sp.anchor.set(0.5);
			if (add) sp.blendMode = 'add';
			sp.visible = false;
			list?.push(sp);
			this.body.addChild(sp);
			return sp;
		};
		this.glow = sprite(true, null);
		for (let i = 0; i < MAX_GLYPHS; i++) {
			sprite(false, this.glyphs);
			sprite(true, this.sheens);
		}
		for (let i = 0; i < MAX_STARS; i++) sprite(true, this.stars);
		for (let i = 0; i < MAX_PUFFS; i++) sprite(false, this.puffs);
		this.root.visible = false;
	}

	/** the value it stands at (what it counts to) */
	get target() {
		return this.value;
	}

	/** the number's centre below its root (road px; negative: above), for a copy flying from it */
	get centreY() {
		return this.body.y;
	}

	/** SHOW `value`: `appear` drops its letters in from `at` (board ms; before then nothing shows), `rest` stands it at
	 *  once (a held column, a resumed round, Skip to Result, the first board), `still` at rest with no idle and no effects
	 *  (a copy flying to a line's multiplier) */
	show(value: number, how: 'appear' | 'rest' | 'still', at: number) {
		this.value = value;
		this.from = value;
		this.still = how === 'still';
		this.mode = how === 'still' ? 'rest' : how;
		this.t0 = at;
		this.root.visible = true;
	}

	/** CHANGE to `value` (a Grandma Wild joining the column): it counts up from what it shows and slams at slamAt() */
	change(value: number, at: number) {
		this.from = this.value;
		this.value = value;
		this.mode = 'change';
		this.t0 = at;
		this.root.visible = true;
	}

	/** the board ms its change slams down (the stamp's moment) */
	slamAt() {
		return this.t0 + WILD_MULT.change.countMs;
	}

	/** WIN: a winning line runs through it, from `at` (board ms) */
	win(at: number) {
		if (this.mode === 'hidden') return;
		this.from = this.value;
		this.mode = 'win';
		this.t0 = at;
	}

	/** at rest now (the end of its move, the round cut short) */
	settle() {
		if (this.mode === 'hidden') return;
		this.from = this.value;
		this.mode = 'rest';
	}

	/** what it draws now (probes) */
	state() {
		return { ...this.drawn, target: this.value, place: this.place, color: this.color, band: this.band, cap: this.cap, width: this.width, max: this.max, top: this.top, maxW: WILD_MULT.place[this.place].maxW, rulesMax: rulesMax(), loaded: !!textures };
	}

	/** the letters' bounds as drawn, CSS px on the stage (probes: the number fits its cell or column) */
	glyphBounds() {
		const out: { ch: string; x: number; y: number; w: number; h: number }[] = [];
		for (let i = 0; i < this.n; i++) {
			const g = this.glyphs[i];
			if (!g.visible || !this.root.visible || !this.body.visible) continue;
			const b = g.getBounds();
			out.push({ ch: this.text[i], x: b.x, y: b.y, w: b.width, h: b.height });
		}
		return out;
	}

	/** lay out `v`x (when the value drawn changes, never per frame): the letters' places, scale and textures, and the
	 *  gold's effects at this value */
	private layout(v: number) {
		this.laidValue = v;
		const text = `${v}x`;
		this.text = text;
		const b = multBand(v);
		const P = WILD_MULT.place[this.place];
		// its band's cap, or its kind's top when that is taller (the kind's largest value fills the frame's inside); a
		// value over its kind's top keeps its band's cap (and the width's limit below shrinks it to fit)
		this.capFor = v <= this.max ? Math.max(P.caps[b], this.top) : P.caps[b];
		let s = this.capFor / ART.cap;
		let x = 0;
		const n = Math.min(MAX_GLYPHS, text.length);
		for (let i = 0; i < n; i++) {
			const a = (ART.adv as Record<string, number>)[text[i]] ?? 0;
			this.xs[i] = x + a / 2;
			x += a - ART.tuck;
		}
		const ink = x + ART.tuck;
		if (ink * s > P.maxW) s = P.maxW / ink;
		this.band = b;
		this.s = s;
		this.n = n;
		this.width = ink * s;
		this.cap = ART.cap * s;
		for (let i = 0; i < n; i++) {
			this.xs[i] = this.xs[i] * s - this.width / 2;
			this.glyphTex[i] = tex(`${this.color}_${text[i]}`);
			this.sheenTex[i] = this.color === 'gold' ? tex(`sheen_${text[i]}`) : null;
			if (import.meta.env.DEV && !this.glyphTex[i] && !warned) {
				warned = true;
				console.info(`[reindeer] wild multiplier: no glyph ${text[i]} in ${this.color}`);
			}
		}
		if (import.meta.env.DEV && !warned && s > ART.drawMax * 1.02) {
			warned = true;
			console.info(`[reindeer] wild multiplier ${text} (${this.place}) draws at ${s.toFixed(3)} of its letters, over the ${ART.drawMax} the atlas is baked for (tools/build_wild_mult.py PLACE)`);
		}
		// the gold's effects: the steps blended on a log scale of the value (held at the ends)
		const steps = WILD_MULT.gold.steps as readonly GoldStep[];
		let i = 0;
		while (i < steps.length - 1 && v >= steps[i + 1].from) i++;
		const lo = steps[i];
		const hi = steps[Math.min(i + 1, steps.length - 1)];
		const u = hi.from > lo.from && v > lo.from ? clamp((Math.log(v) - Math.log(lo.from)) / (Math.log(hi.from) - Math.log(lo.from)), 0, 1) : 0;
		for (const k of GOLD_KEYS) this.fx[k] = lerp(lo[k], hi[k], u);
	}

	/** DRAW at board ms `clock` (its owner's frame) */
	update(clock: number) {
		if (this.mode === 'hidden') {
			this.root.visible = false;
			return;
		}
		if (!textures) {
			// drawn as soon as the atlas is in
			if (!this.wantsAtlas) {
				this.wantsAtlas = true;
				waiting += 1;
				void loadWildMult();
			}
			this.body.visible = false;
			return;
		}
		if (this.wantsAtlas) {
			this.wantsAtlas = false;
			waiting = Math.max(0, waiting - 1);
		}
		this.body.visible = true;
		const W = WILD_MULT;
		const t = clock - this.t0;
		// the move ends: at rest
		const total = this.mode === 'appear' ? W.appear.totalMs : this.mode === 'change' ? W.change.totalMs : this.mode === 'win' ? W.win.totalMs : 0;
		if (this.mode !== 'rest' && t > total) {
			this.mode = 'rest';
			this.from = this.value;
		}
		const mode = this.mode;
		let v = this.value;
		let gs = 1;
		let halo = 0;
		let slamU = -1;
		if (mode === 'change') {
			const C = W.change;
			if (t < C.countMs) {
				v = Math.round(lerp(this.from, this.value, eOut(t / C.countMs)));
				gs = 1 + C.shake * Math.abs(Math.sin(t / C.shakeMs));
			} else {
				gs = 1 + C.slam * (1 - eOut((t - C.countMs) / C.slamMs));
				slamU = (t - C.countMs) / C.burst.ms;
			}
		} else if (mode === 'win') {
			const B = W.win.beats;
			for (let b = 0; b < B.length; b++) halo = Math.max(halo, bump((t - B[b]) / W.win.haloMs));
		}
		if (v !== this.laidValue) this.layout(v);
		// at rest it idles (a win still to come waits at rest too)
		const idle = !this.still && (mode === 'rest' || (mode === 'win' && t < 0));
		const gold = this.color === 'gold' && !this.still;
		const F = this.fx;
		if (idle) gs *= 1 + W.idle.breathe * Math.sin(clock / W.idle.periodMs + this.seed);
		const P = W.place[this.place];
		// standing on the rail's inside (its root), or about its centre (a flying copy)
		this.body.position.set(0, P.floor > 0 ? -(P.gap + (ART.h / 2) * this.s) : 0);
		this.body.scale.set(gs);
		// a glyph's frame is the set's density in sheet px per design unit; the layout is `s` road px per design unit
		const k = this.s / ART.sets[this.color][SIZE];
		const ks = this.s / ART.sets.sheen[SIZE];

		// the glow behind: a win swells it; the gold's own glow pulses at rest from 100x
		const G = W.glow;
		const pulse = gold ? F.glow * (1 + F.glowPulse * Math.sin((clock / F.pulseMs) * Math.PI * 2 + this.seed)) : 0;
		const ga = Math.max(G.alpha * halo, pulse);
		const glowTex = tex('fx_glow');
		if (glowTex && ga > 0.003) {
			this.glow.texture = glowTex;
			this.glow.visible = true;
			this.glow.tint = G.tint[this.color];
			this.glow.alpha = Math.min(1, ga);
			this.glow.scale.set((this.width * G.width) / glowTex.orig.width, (this.capFor * G.height) / glowTex.orig.height);
		} else this.glow.visible = false;

		// the gold's sheen: a light sweeping the letters once every sheenMs, and its shimmer
		const GD = W.gold;
		let sweepX = Infinity;
		if (gold && F.sheenAlpha > 0) {
			const ph = ((((clock + this.seed * 997) % F.sheenMs) + F.sheenMs) % F.sheenMs) / (F.sheenMs * GD.sweepShare);
			if (ph < 1) sweepX = -this.width / 2 - this.width * GD.band + ph * this.width * (1 + 2 * GD.band);
		}
		let sheenMax = 0;

		// the letters
		const A = W.appear;
		const beats = W.win.beats;
		for (let i = 0; i < MAX_GLYPHS; i++) {
			const g = this.glyphs[i];
			const sh = this.sheens[i];
			const gt = i < this.n ? this.glyphTex[i] : null;
			if (!gt) {
				g.visible = false;
				sh.visible = false;
				continue;
			}
			let sx = 1;
			let sy = 1;
			let dy = 0;
			let alpha = 1;
			let hide = false;
			if (mode === 'appear') {
				const u = (t - i * A.staggerMs) / A.ms;
				if (u < 0) hide = true;
				else if (u < A.land) {
					sx = sy = lerp(A.fromScale, 1, eIn(u / A.land));
					alpha = clamp(u * A.fadeRate, 0, 1);
				} else {
					const w = (u - A.land) / (1 - A.land);
					const q = Math.exp(-w * A.decay) * Math.cos(w * A.freq);
					sx = 1 + A.squash * q;
					sy = 1 - A.squash * q;
				}
			} else if (mode === 'win') {
				for (let b = 0; b < beats.length; b++) dy -= W.win.hop * bump((t - beats[b] - i * W.win.staggerMs) / W.win.hopMs);
			}
			g.visible = !hide;
			if (hide) {
				sh.visible = false;
				continue;
			}
			g.texture = gt;
			g.position.set(this.xs[i], dy);
			g.scale.set(k * sx, k * sy);
			g.alpha = alpha;
			// the sheen over it (gold only): the sweep's light where it passes, and the shimmer's flicker
			const st = this.sheenTex[i];
			let a = 0;
			if (gold && st) {
				if (sweepX !== Infinity) a = F.sheenAlpha * clamp(1 - Math.abs(this.xs[i] - sweepX) / Math.max(1, this.width * GD.band), 0, 1);
				if (F.shimmer > 0) a += F.shimmer * (0.5 + 0.5 * Math.sin(clock / GD.shimmerMs + i * 1.7 + this.seed));
			}
			a *= alpha;
			sheenMax = Math.max(sheenMax, a);
			if (st && a > 0.003) {
				sh.texture = st;
				sh.visible = true;
				sh.tint = GD.sheenTint;
				sh.position.set(this.xs[i], dy);
				sh.scale.set(ks * sx, ks * sy);
				sh.alpha = Math.min(1, a);
			} else sh.visible = false;
		}

		// the stars: a burst (a change's slam, a win's beats) and the gold's sparkles at rest
		this.si = 0;
		if (slamU >= 0) {
			const B = W.change.burst;
			this.burst(slamU, B.n, this.width * B.from, this.width * B.to, B.seed, this.color === 'gold' ? B.goldTint : B.tint, B.scale);
		}
		if (mode === 'win') {
			const B = W.win.burst;
			for (let b = 0; b < beats.length; b++) this.burst((t - beats[b]) / B.ms, B.n, this.width * B.from, this.width * B.to, B.seed + beats[b], B.tint, B.scale);
		}
		const sparkles = gold && idle ? Math.round(F.sparkles) : 0;
		if (sparkles > 0 && this.n > 0) {
			const I = W.idle;
			const ms = GD.sparkleMs;
			for (let q = 0; q < sparkles; q++) {
				const tt = clock + this.seed * 300 + (q * ms) / sparkles;
				const id = Math.floor(tt / ms) * 7 + q * 50;
				const u = (((tt % ms) + ms) % ms) / ms;
				const b = bump(u);
				if (b <= 0) continue;
				const x = this.xs[Math.floor(rnd(id) * this.n)] + (rnd(id + 3) - 0.5) * this.cap * I.spreadX;
				const y = (rnd(id + 7) - 0.5) * this.cap * I.spreadY;
				this.star(x, y, F.sparkleScale * (0.3 + 0.7 * b), u * W.star.rot, b, 0xffffff);
			}
		}
		for (let j = this.si; j < MAX_STARS; j++) this.stars[j].visible = false;

		// the snow puffs: each letter's two as it lands, the slam's two
		this.pi = 0;
		if (mode === 'appear') {
			const PF = A.puff;
			for (let i = 0; i < this.n; i++) this.puffPair(this.xs[i], this.cap * PF.y, (t - i * A.staggerMs - PF.delayMs) / PF.ms, this.cap * PF.spread, this.cap / PF.per);
		}
		if (slamU >= 0) this.puffPair(0, this.cap * A.puff.y, slamU, this.width * W.change.puff.spread, this.cap / W.change.puff.per);
		for (let j = this.pi; j < MAX_PUFFS; j++) this.puffs[j].visible = false;

		this.drawn.value = v;
		this.drawn.mode = mode;
		this.drawn.scale = gs;
		this.drawn.text = this.text;
		this.drawn.sheen = sheenMax;
		this.drawn.sparkles = sparkles;
		this.drawn.glow = this.glow.visible ? this.glow.alpha : 0;
	}

	/** one star glint (the mock's stars/burst: white, tinted, additive), `s` its scale against the atlas star's 40 */
	private star(x: number, y: number, s: number, rot: number, alpha: number, tint: number) {
		const starTex = tex('fx_star');
		if (this.si >= MAX_STARS || !starTex || alpha <= 0.003) return;
		const st = this.stars[this.si++];
		st.texture = starTex;
		st.visible = true;
		st.position.set(x, y);
		st.scale.set((s * ART.fx.star.size) / starTex.orig.width);
		st.rotation = rot;
		st.alpha = Math.min(1, alpha);
		st.tint = tint;
	}

	/** a ring of `n` stars flying out from r0 to r1 (the mock's burst) */
	private burst(u: number, n: number, r0: number, r1: number, seed: number, tint: number, s: number) {
		if (u <= 0 || u >= 1) return;
		for (let j = 0; j < n; j++) {
			const a = (j / n) * Math.PI * 2 + rnd(seed + j) * 0.6;
			const r = lerp(r0, r1, eOut(u));
			this.star(Math.cos(a) * r, Math.sin(a) * r * 0.7, s * (1 - u * 0.6), u * 2, 1 - u, tint);
		}
	}

	/** two snow puffs leaving a point to each side (the mock's puffs) */
	private puffPair(x: number, y: number, u: number, spread: number, s: number) {
		const puffTex = tex('fx_puff');
		if (u <= 0 || u >= 1 || !puffTex) return;
		const PF = WILD_MULT.appear.puff;
		for (let side = -1; side <= 1; side += 2) {
			if (this.pi >= MAX_PUFFS) return;
			const p = this.puffs[this.pi++];
			p.texture = puffTex;
			p.visible = true;
			p.position.set(x + side * (spread * PF.spreadOut + spread * eOut(u)), y - PF.rise * u);
			p.scale.set((s * (PF.scale[0] + PF.scale[1] * u) * ART.fx.puff.size) / puffTex.orig.width);
			p.alpha = PF.alpha * (1 - u);
		}
	}

	destroy() {
		if (this.wantsAtlas) waiting = Math.max(0, waiting - 1);
		this.wantsAtlas = false;
		this.root.destroy({ children: true });
	}
}
