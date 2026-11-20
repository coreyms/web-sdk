// THE WILD FRAMES' TINSEL GARLAND (Corey 2026-11-19: "I'd go for Garland (F), but I'd go Red for Santa because it doesn't
// clash with the Green number", "We should jsut go static colors for Reindeer Santa, Grandma for the multipliers and the
// garland", "just swap the garland on santa and grandma"). The frame of a full column Wild, of the single cell Grandma
// Wild and of the marked Grandma car, in the wild border mock's candidate F (Desktop/Run Over Reindeer/
// wild_borders_r1_2026-11-19, tools/page.html const Fc). Its numbers are constants WILD_FRAME; its pictures are the frame
// atlas (tools/build_garland.py, game/garlandSpec.ts).
//
// THE PIECES: each side is a run of tile sprites (one period of the band each, laid end to end from the corner before
// it; the last cropped by its texture's frame), each corner one sprite (the band swept round the inner corner, reaching
// on into the strip after it and fading back over the strip before it: no step in the lumpy outline wherever a strip
// ends), a glass bauble hung on each corner. Any thickness, any box: a cell, the box growing at every height, a column.
// THE LAYERS (game/road/roadFeatures.ts, the note at its top): a column's frame is split, its right band in `rightRoot`
// (under its character), its left band in `leftRoot` (over it), the top and bottom bands, the corners and the baubles in
// `root` (the rails, over every character) and its twinkles and halo in `fxRoot`; a cell's frame is one `root`.
// THE MOTION (the mock's, on the board clock: turbo and a slam stop run it faster):
//   land   traced round from the top left corner, clockwise (the red box's trace); once the box is whole the baubles drop in
//   win    the tinsel flashes itself twice (its own sprites again, additive), a soft halo round it, the baubles swing,
//          more twinkles
//   idle   twinkles take turns along the band, the baubles sway a little
// No filter, mask, shader or runtime blur: sprites, transforms, alpha, tint and additive blending. Every sprite is made
// with the frame (a side's tiles as its length first needs them); nothing is allocated per frame.
//
// THE ATLAS loads in the background from the board's mount (components/Board.svelte calls loadGarland) and goes to the
// GPU through the column pictures' upload queue, at once when a Wild is already waiting on it. Until it is in, a frame
// draws its plain box (the old red box's quads, in its tinsel's color: WILD_FRAME.plain), so the character's crop is
// always covered.
import * as PIXI from 'pixi.js';

import { RED_BOX, WILD_FRAME, type GarlandLook } from '../constants';
import { GARLAND_ART as ART } from '../garlandSpec';
import { PHONE_TIER } from '../deviceTier';
import { stamp } from '../assets';
import { STAGING_TOOLS, perfMark } from '../staging';
import { queuePresentUpload } from './columnClips';

// ---- the atlas ----------------------------------------------------------------------------------------------------------
const SIZE = PHONE_TIER ? 'phone' : 'full';
const SHEET = ART.sheets[SIZE];
type Row = readonly [number, number, number, number, number, number];
const FRAMES = SHEET.frames as unknown as Record<string, Row>;
const B = ART.band;

let textures: Map<string, PIXI.Texture> | null = null;
let source: PIXI.TextureSource | null = null;
let loading: Promise<boolean> | null = null;
/** frames on the board waiting for the atlas (its upload then jumps the queue) */
let waiting = 0;
let mipmapper: ((source: PIXI.TextureSource) => void) | null = null;
/** set by components/Board.svelte: the sheet is drawn under its size (a mip chain, house rule) */
export const setGarlandMipmapper = (fn: typeof mipmapper) => {
	mipmapper = fn;
};
const live = new Set<GarlandFrame>();

/** start loading the frame atlas (or join the load running); true when it is on the GPU */
export const loadGarland = (): Promise<boolean> => {
	if (textures) return Promise.resolve(true);
	loading ??= (async () => {
		try {
			const base = (await PIXI.Assets.load(stamp(`/assets/${SHEET.file}`))) as PIXI.Texture;
			mipmapper?.(base.source);
			await queuePresentUpload('garland', 1, base, () => waiting > 0);
			const map = new Map<string, PIXI.Texture>();
			for (const [name, r] of Object.entries(FRAMES)) map.set(name, new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(r[0], r[1], r[2], r[3]) }));
			// the halo's nine slices (its corners, edges; the middle is never drawn)
			const ring = FRAMES.ring;
			const k = ring[2] / ART.ring.size;
			const cut = [0, ART.ring.slice, ART.ring.size - ART.ring.slice, ART.ring.size].map((v) => Math.round(v * k));
			for (let i = 0; i < 3; i++)
				for (let j = 0; j < 3; j++) {
					if (i === 1 && j === 1) continue;
					map.set(`ring_${i}${j}`, new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(ring[0] + cut[i], ring[1] + cut[j], cut[i + 1] - cut[i], cut[j + 1] - cut[j]) }));
				}
			source = base.source;
			textures = map;
			if (STAGING_TOOLS) perfMark('load:garland');
			for (const f of live) f.refresh();
			return true;
		} catch (error) {
			// without it every frame keeps its plain box
			console.warn('[reindeer] the frame atlas failed to load', error);
			loading = null;
			return false;
		}
	})();
	return loading;
};

/** DEV / probes: the atlas as loaded (sheet px, GPU MB without and with a mip chain) */
export const garlandMemory = () => {
	const mb = source ? (source.pixelWidth * source.pixelHeight * 4) / 1048576 : 0;
	return { size: SIZE, loaded: !!textures, sheet: source ? { w: source.pixelWidth, h: source.pixelHeight, mips: !!source.autoGenerateMipmaps } : null, mb: Math.round(mb * 1000) / 1000, mbWithMips: Math.round(mb * (source?.autoGenerateMipmaps ? 4 / 3 : 1) * 1000) / 1000, file: SHEET.file, kb: SHEET.kb };
};

const tex = (name: string): PIXI.Texture => textures?.get(name) ?? PIXI.Texture.EMPTY;

// ---- maths (the mock's) --------------------------------------------------------------------------------------------------
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const eIn = (u: number) => Math.pow(clamp(u, 0, 1), 2);
const bump = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u));
const rnd = (s: number) => {
	const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
	return x - Math.floor(x);
};
const HALF_PI = Math.PI / 2;

/** what a frame falls back to before its atlas is in: the red box (game/road/roadFeatures.ts RedBox) in the tinsel's color */
export type PlainBox = {
	readonly root: PIXI.Container;
	readonly rightRoot: PIXI.Container | null;
	readonly leftRoot: PIXI.Container | null;
	set(x: number, y: number, w: number, h: number, drawn?: number, width?: number): void;
};

/** one side of the band: its tiles in a container turned to the side (u along it clockwise, v inward from the outer edge),
 *  and their additive twins (the win's flash) in a twin container with the same turn */
class Side {
	readonly base = new PIXI.Container();
	readonly add = new PIXI.Container();
	readonly tiles: PIXI.Sprite[] = [];
	readonly twins: PIXI.Sprite[] = [];
	/** the last (cropped) tile's texture: its frame shrinks to the length left */
	private crop: PIXI.Texture | null = null;
	shown = 0;
	constructor() {
		this.add.visible = false;
	}
	/** lay `shown` road px of the band (its full length is `len`), from (ax, ay) turned by `rot`, at scale s */
	lay(name: string, ax: number, ay: number, rot: number, shown: number, s: number) {
		this.shown = shown;
		for (const c of [this.base, this.add]) {
			c.position.set(ax, ay);
			c.rotation = rot;
		}
		const t = tex(name);
		const row = FRAMES[name];
		const L = B.L * s;
		const n = shown > 0.01 ? Math.ceil(shown / L - 1e-6) : 0;
		while (this.tiles.length < n) {
			const a = new PIXI.Sprite();
			const b = new PIXI.Sprite();
			b.blendMode = 'add';
			this.base.addChild(a);
			this.add.addChild(b);
			this.tiles.push(a);
			this.twins.push(b);
		}
		const h = row[5] * s;
		for (let i = 0; i < this.tiles.length; i++) {
			const a = this.tiles[i];
			const b = this.twins[i];
			const on = i < n;
			a.visible = on;
			b.visible = on;
			if (!on) continue;
			const left = shown - i * L;
			let texture = t;
			let w = L;
			if (left < L - 1e-3) {
				// the last tile: its texture's frame cut to the length left (a crop, not a mask)
				const crop = (this.crop ??= new PIXI.Texture({ source: t.source, frame: t.frame.clone(), dynamic: true }));
				if (crop.source !== t.source) crop.source = t.source;
				crop.frame.x = t.frame.x;
				crop.frame.y = t.frame.y;
				crop.frame.height = t.frame.height;
				crop.frame.width = Math.max(1, (row[2] * left) / L);
				crop.update();
				texture = crop;
				w = left;
			}
			for (const sp of [a, b]) {
				if (sp.texture !== texture) sp.texture = texture;
				sp.position.set(i * L, -B.pad * s);
				// (a hair over the period: the next tile starts exactly where this one ends, so no sliver of the road shows
				// between them at any float position; the overlap samples the same pixels, the sheet's wrapped margin)
				sp.width = w + (w === L ? 0.02 : 0);
				sp.height = h;
			}
		}
	}
	destroy() {
		this.crop?.destroy(false);
		this.crop = null;
	}
}

/** ONE WILD FRAME. `split`: a full column's (its parts in four roots, placed by its owner in their layers); otherwise all
 *  in `root` (a Grandma Wild's cell, the marked car). `place` picks the bauble size and the band's own thickness. */
export class GarlandFrame {
	readonly root = new PIXI.Container();
	readonly rightRoot: PIXI.Container | null;
	readonly leftRoot: PIXI.Container | null;
	/** the twinkles and the win's halo: over the rails (a column's own layer, or the end of a cell's root) */
	readonly fxRoot = new PIXI.Container();
	/** the frame's own pieces in each root (their alpha is `opacity`; the roots' own alpha is the owner's fade) */
	private readonly rails = new PIXI.Container();
	private readonly right: PIXI.Container | null;
	private readonly left: PIXI.Container | null;
	private readonly sides: Side[] = [];
	private readonly corners: PIXI.Sprite[] = [];
	private readonly cornerTwins: PIXI.Sprite[] = [];
	private readonly railAdd = new PIXI.Container();
	private readonly baubles: PIXI.Sprite[] = [];
	private readonly ring: PIXI.Sprite[] = [];
	private readonly stars: PIXI.Sprite[] = [];
	/** the box as laid: its outer edge (road px), the band drawn, how much is traced, which corners show */
	private O = { x: 0, y: 0, w: 0, h: 0 };
	private T = 0;
	private drawn = 1;
	private shownCorner = [false, false, false, false];
	/** board ms the baubles start to drop (null: not yet; -Infinity: hanging since before), the win's start (null: none) */
	private landAt: number | null = null;
	private winAt: number | null = null;
	private clock = 0;
	private alpha = 1;
	private laid = '';
	private readonly seed: number;
	constructor(
		split: boolean,
		readonly look: GarlandLook,
		readonly place: 'col' | 'cell',
		private readonly plain: PlainBox,
		seed = 0,
	) {
		this.seed = seed;
		this.rightRoot = split ? new PIXI.Container() : null;
		this.leftRoot = split ? new PIXI.Container() : null;
		this.right = split ? new PIXI.Container() : null;
		this.left = split ? new PIXI.Container() : null;
		for (let i = 0; i < 4; i++) this.sides.push(new Side());
		const [top, rightSide, bottom, leftSide] = this.sides;
		// the rails: the top and bottom bands and the corners, their twins, then the baubles over them
		this.rails.addChild(top.base, bottom.base);
		for (let i = 0; i < 4; i++) {
			const c = new PIXI.Sprite();
			const d = new PIXI.Sprite();
			d.blendMode = 'add';
			c.visible = d.visible = false;
			this.corners.push(c);
			this.cornerTwins.push(d);
		}
		this.rails.addChild(...this.corners);
		this.railAdd.visible = false;
		this.railAdd.addChild(top.add, bottom.add, ...this.cornerTwins);
		this.rails.addChild(this.railAdd);
		for (let i = 0; i < 4; i++) {
			const b = new PIXI.Sprite();
			b.visible = false;
			this.baubles.push(b);
		}
		this.rails.addChild(...this.baubles);
		this.root.addChild(plain.root, this.rails);
		if (split) {
			this.right!.addChild(rightSide.base, rightSide.add);
			this.left!.addChild(leftSide.base, leftSide.add);
			this.rightRoot!.addChild(plain.rightRoot ?? new PIXI.Container(), this.right!);
			this.leftRoot!.addChild(plain.leftRoot ?? new PIXI.Container(), this.left!);
		} else {
			// a cell: its sides under the rails (all one picture), their twins with them
			this.rails.addChildAt(rightSide.base, 0);
			this.rails.addChildAt(leftSide.base, 0);
			this.railAdd.addChildAt(rightSide.add, 0);
			this.railAdd.addChildAt(leftSide.add, 0);
		}
		for (let i = 0; i < 8; i++) {
			const r = new PIXI.Sprite();
			r.blendMode = 'add';
			r.visible = false;
			this.ring.push(r);
		}
		const W = WILD_FRAME;
		for (let i = 0; i < W.idle.stars + W.win.stars; i++) {
			const s = new PIXI.Sprite();
			s.blendMode = 'add';
			s.anchor.set(0.5);
			s.visible = false;
			this.stars.push(s);
		}
		this.fxRoot.addChild(...this.ring, ...this.stars);
		if (!split) this.root.addChild(this.fxRoot);
		live.add(this);
		if (!textures) {
			waiting += 1;
			void loadGarland();
		}
		this.refresh();
	}

	/** the atlas came in (or the frame was made): pictures on, the plain box off */
	refresh() {
		const on = !!textures;
		this.plain.root.visible = !on;
		if (this.plain.rightRoot) this.plain.rightRoot.visible = !on;
		if (this.plain.leftRoot) this.plain.leftRoot.visible = !on;
		this.rails.visible = on;
		if (this.right) this.right.visible = on;
		if (this.left) this.left.visible = on;
		this.fxRoot.visible = on;
		if (!on) return;
		const t = this.look.tinsel;
		for (let i = 0; i < 4; i++) {
			this.corners[i].texture = this.cornerTwins[i].texture = tex(`corner_${t}`);
			const row = FRAMES[`corner_${t}`];
			// the outer corner is PAD in from the picture's top left
			this.corners[i].anchor.set(B.pad / row[4], B.pad / row[5]);
			this.cornerTwins[i].anchor.copyFrom(this.corners[i].anchor);
			this.baubles[i].texture = tex(`bauble_${this.look.bauble}`);
			const br = FRAMES[`bauble_${this.look.bauble}`];
			// hung from its cap's loop
			this.baubles[i].anchor.set(ART.bauble.ballX / br[4], ART.bauble.hookY / br[5]);
		}
		for (let i = 0, k = 0; i < 3; i++)
			for (let j = 0; j < 3; j++) {
				if (i === 1 && j === 1) continue;
				this.ring[k++].texture = tex(`ring_${i}${j}`);
			}
		for (const s of this.stars) s.texture = tex('star');
		this.laid = '';
		this.layout();
		this.animate();
	}

	/** what shows: 1 the frame, 0 nothing (the crosshair's hand-over) */
	set opacity(a: number) {
		this.alpha = a;
		this.plain.root.alpha = a;
		if (this.plain.rightRoot) this.plain.rightRoot.alpha = a;
		if (this.plain.leftRoot) this.plain.leftRoot.alpha = a;
		this.rails.alpha = a;
		if (this.right) this.right.alpha = a;
		if (this.left) this.left.alpha = a;
		this.fxRoot.alpha = a;
	}
	get opacity() {
		return this.alpha;
	}

	/** lay the frame round a rectangle (road px; the red box's rectangle: its outer edge RED_BOX.edge outside it). `drawn`
	 *  (0 to 1) how much is traced from the top left corner clockwise; `band` its thickness from the outer edge in. */
	set(x: number, y: number, w: number, h: number, drawn = 1, band: number = WILD_FRAME.band[this.place]) {
		// (a column lays its frame every frame: nothing to do when nothing moved)
		const key = `${x},${y},${w},${h},${drawn},${band},${!!textures}`;
		if (key === this.laid) return;
		this.laid = key;
		const e = RED_BOX.edge;
		this.O = { x: x - e, y: y - e, w: w + 2 * e, h: h + 2 * e };
		// a box thinner than two bands (Super's opening column starts 8 px tall) draws a thinner band
		this.T = Math.max(0, Math.min(band, this.O.w / 2, this.O.h / 2));
		this.drawn = clamp(drawn, 0, 1);
		this.plain.set(x, y, w, h, drawn, Math.max(1, band - 2 * e));
		if (textures) this.layout();
	}

	/** the baubles drop in from `at` (board ms); -Infinity: they hang already (a held column, the first board) */
	land(at: number) {
		this.landAt = at;
	}
	/** a winning line through it: its win from `at` (board ms) */
	win(at: number) {
		this.winAt = at;
	}
	/** a new spin: a win's move is not carried over */
	settle() {
		this.winAt = null;
	}

	private layout() {
		const { x, y, w, h } = this.O;
		const T = this.T;
		const s = T / B.T;
		const name = `tile_${this.look.tinsel}`;
		// the trace, along the outer edge: top, right, bottom, left (the mock's traced())
		const d = this.drawn * 2 * (w + h);
		const top = clamp(d, 0, w);
		const right = clamp(d - w, 0, h);
		const bottom = clamp(d - w - h, 0, w);
		const left = clamp(d - 2 * w - h, 0, h);
		const run = (v: number, len: number) => clamp(v - T, 0, len - 2 * T);
		const [sTop, sRight, sBottom, sLeft] = this.sides;
		sTop.lay(name, x + T, y, 0, run(top, w), s);
		sRight.lay(name, x + w, y + T, HALF_PI, run(right, h), s);
		sBottom.lay(name, x + w - T, y + h, Math.PI, run(bottom, w), s);
		sLeft.lay(name, x, y + h - T, 3 * HALF_PI, run(left, h), s);
		this.shownCorner = [top > 0, top >= w - T || right > 0, right >= h - T || bottom > 0, bottom >= w - T || left > 0];
		const at = [
			[x, y],
			[x + w, y],
			[x + w, y + h],
			[x, y + h],
		];
		for (let i = 0; i < 4; i++) {
			for (const c of [this.corners[i], this.cornerTwins[i]]) {
				c.visible = this.shownCorner[i] && T > 0.5;
				c.position.set(at[i][0], at[i][1]);
				c.rotation = i * HALF_PI;
				c.scale.set((s * FRAMES[`corner_${this.look.tinsel}`][4]) / Math.max(1, c.texture.frame.width), (s * FRAMES[`corner_${this.look.tinsel}`][5]) / Math.max(1, c.texture.frame.height));
			}
		}
	}

	/** the frame's motion at board ms `clock` (every frame from its owner) */
	update(clock: number) {
		this.clock = clock;
		if (textures) this.animate();
	}

	private animate() {
		const W = WILD_FRAME;
		const { x, y, w, h } = this.O;
		const T = this.T;
		const now = this.clock;
		const whole = this.drawn >= 1;
		// THE WIN: two beats of the tinsel flashing itself, the halo, the baubles' swing, more twinkles
		const winT = this.winAt === null ? -1 : now - this.winAt;
		const winning = winT >= 0 && winT < W.win.totalMs;
		const wp = winning ? Math.max(...W.win.beats.map((b) => bump((winT - b) / W.win.beatMs))) : 0;
		const flash = W.win.flash * wp;
		this.railAdd.visible = flash > 0.003;
		this.railAdd.alpha = flash;
		for (const sd of this.sides) {
			sd.add.visible = flash > 0.003;
			sd.add.alpha = flash;
		}
		// the halo: a nine slice round the frame, `out` past its outer edge
		const ringA = W.win.ring * wp;
		const P = W.ring.out;
		const S = ART.ring.slice;
		const xs = [x - P, x - P + S, x + w + P - S, x + w + P];
		const ys = [y - P, y - P + S, y + h + P - S, y + h + P];
		for (let i = 0, k = 0; i < 3; i++)
			for (let j = 0; j < 3; j++) {
				if (i === 1 && j === 1) continue;
				const r = this.ring[k++];
				r.visible = ringA > 0.003 && whole;
				if (!r.visible) continue;
				r.alpha = Math.min(1, ringA);
				r.tint = W.ring.tint[this.look.tinsel];
				r.position.set(xs[i], ys[j]);
				r.width = Math.max(0, xs[i + 1] - xs[i]);
				r.height = Math.max(0, ys[j + 1] - ys[j]);
			}
		// THE BAUBLES: hidden until the box is whole and they drop (one after the other), then sway (idle) or swing (win)
		const sc = (this.place === 'cell' ? W.bauble.cell : W.bauble.col) * (T / W.band[this.place]);
		const inn = T / 2 + W.bauble.inset * sc;
		const hook = (ART.bauble.ballY - ART.bauble.hookY - 5) * sc;
		for (let i = 0; i < 4; i++) {
			const b = this.baubles[i];
			const drop = this.landAt === null ? -1 : now - this.landAt - i * W.land.staggerMs;
			b.visible = whole && this.landAt !== null && drop >= 0 && T > 0.5;
			if (!b.visible) continue;
			const cx = i === 1 || i === 2 ? x + w - inn : x + inn;
			const cy = i >= 2 ? y + h - inn : y + inn;
			const dy = drop < W.land.dropMs ? -W.land.dropPx * (1 - eIn(drop / W.land.dropMs)) : 0;
			const sw = winning ? Math.sin(winT / W.win.swingMs + i) * W.win.swing * Math.exp(-winT / W.win.swingDecayMs) : Math.sin(now / W.idle.swayMs + i * 1.3 + this.seed) * W.idle.sway;
			// (the mock hangs the ball so its centre is 5 below the corner point: the hook is that far above it)
			b.position.set(cx, cy - hook + dy);
			b.rotation = sw;
			b.scale.set((sc * FRAMES[`bauble_${this.look.bauble}`][4]) / Math.max(1, b.texture.frame.width));
		}
		// THE TWINKLES: seeded spots along the middle of the band, each shining in turn
		const n = whole ? W.idle.stars + (winning && winT < W.win.starsMs ? W.win.stars : 0) : 0;
		const period = W.idle.starMs;
		const per = 2 * (w + h);
		// (the star picture is ART.star.size road px; drawn at starScale of it at its brightest)
		const k = (W.idle.starScale * FRAMES.star[4]) / Math.max(1, this.stars[0]?.texture.frame.width ?? 1);
		for (let i = 0; i < this.stars.length; i++) {
			const st = this.stars[i];
			if (i >= n) {
				st.visible = false;
				continue;
			}
			const tt = now + i * (period / n) + this.seed * 400;
			const wave = Math.floor(tt / period);
			const u = (tt % period) / period;
			const b = bump(u);
			st.visible = b > 0.01;
			if (!st.visible) continue;
			let p = rnd(wave * 7.3 + i * 13.1 + this.seed) * per;
			let sx = x;
			let sy = y;
			if (p < w) {
				sx = x + p;
				sy = y + T / 2;
			} else if ((p -= w) < h) {
				sx = x + w - T / 2;
				sy = y + p;
			} else if ((p -= h) < w) {
				sx = x + w - p;
				sy = y + h - T / 2;
			} else {
				p -= w;
				sx = x + T / 2;
				sy = y + h - p;
			}
			st.position.set(sx, sy);
			st.rotation = u * 1.4;
			st.alpha = b;
			st.scale.set(k * (0.3 + 0.7 * b));
		}
	}

	/** the band as laid (road px), as the red box's lines(): top, bottom, left, right, each its traced length along the
	 *  outer edge (0 = not yet traced), its y and its thickness */
	lines() {
		const { x, y, w, h } = this.O;
		const d = this.drawn * 2 * (w + h);
		const top = clamp(d, 0, w);
		const right = clamp(d - w, 0, h);
		const bottom = clamp(d - w - h, 0, w);
		const left = clamp(d - 2 * w - h, 0, h);
		return [
			{ y, width: top, height: this.T },
			{ y: y + h - this.T, width: bottom, height: this.T },
			{ y: y + h - left, width: this.T, height: left },
			{ y, width: this.T, height: right },
		].map((l) => ({ x, ...l }));
	}

	/** the probes: the frame as laid (road px), what is drawn of it and how */
	parts() {
		const vis = (o: PIXI.Container) => {
			for (let c: PIXI.Container | null = o; c; c = c.parent) if (!c.visible || c.alpha <= 0) return false;
			return true;
		};
		return {
			outer: { ...this.O },
			band: this.T,
			drawn: this.drawn,
			look: { ...this.look },
			atlas: !!textures,
			plain: this.plain.root.visible,
			opacity: this.alpha,
			sides: this.sides.map((s) => ({ shown: s.shown, tiles: s.tiles.filter((t) => t.visible).length })),
			corners: this.corners.map((c) => c.visible),
			baubles: this.baubles.map((b) => (b.visible ? { x: b.x, y: b.y, rot: b.rotation, scale: b.scale.x } : null)),
			stars: this.stars.filter((s) => s.visible).length,
			flash: this.railAdd.visible ? this.railAdd.alpha : 0,
			ring: this.ring[0].visible ? this.ring[0].alpha : 0,
			sprites: [...this.sides.flatMap((s) => [...s.tiles, ...s.twins]), ...this.corners, ...this.cornerTwins, ...this.baubles, ...this.ring, ...this.stars].filter((s) => vis(s) && s.alpha > 0).length,
		};
	}

	destroy() {
		live.delete(this);
		if (!textures) waiting = Math.max(0, waiting - 1);
		for (const s of this.sides) s.destroy();
		this.root.destroy({ children: true });
		this.rightRoot?.destroy({ children: true });
		this.leftRoot?.destroy({ children: true });
		this.fxRoot.destroy({ children: true });
	}
}
