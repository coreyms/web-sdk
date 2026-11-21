// THE GRANDMA WILD'S BRAWL CLOUD (Corey 2026-11-19; constants GRANDMA_BRAWL, tools/build_brawl.py, game/brawlClipSpec.ts).
// The approved animated cloud in her single cell, replacing the still crash cloud: three clips, all starting or ending on
// the same still (the shared picture A):
//   LOOP     for as long as the Wild is on the board ("Brawl draft 1 looks good")
//   LANDING  option C of landing_preview.html with his settings: the game's own car and seated Grandma take the bump
//            for two frames (game/road/roadBoard.ts applies `bumps`, game/road/seated.ts the lean), the contact star
//            pops, the clip enters already covering her, lined up with the sprites, eases to the cell's size and cuts
//            to the loop with a short fade. The strike's end is at the car's rear (strikeEnd), so the game's last pose
//            is the clip's first frame.
//   WIN      once per win through the Wild ("Win beat yes"), on the win clock, faded in from the loop, WILD fading to 30%
//            while the reindeer's head is up; back to the loop's frame 1 at its end.
// Every clip is cropped to the cell (his crop "a"), here by each frame's TEXTURE FRAME against the Wild's box (the
// column clips' own technique): no mask, filter, shader, runtime blur or blob: URL. ONE set of frames per clip is shared
// by every Grandma Wild on the board; each Wild owns two clip sprites (under: the loop or the still; over: the landing,
// or the win while it fades in) with one dynamic texture each, made once and moved every frame, plus the star and its
// WILD word. Nothing is allocated per frame. Every other Wild put up without a landing is mirrored (the word and the
// number never: they are not in the clip).
//
// THE WORD WILD is its own sprites over the clip: since 2026-11-20 treatment B "Candy Cane" of the WILD word mock
// (game/road/wildWord.ts, GRANDMA_BRAWL.word.candy); GRANDMA_BRAWL.word.look 'today' (or its atlas not in yet) shows the
// word of before (the symbols atlas frame GRANDMA_BRAWL.word.today, popping at the cover).
//
// LOADING (the column clips' way, game/road/columnClips.ts's upload queue): a book with a Grandma Wild starts the still,
// the landing and the loop when it arrives (brawlForBook: game/utils.ts), so they are on the GPU before the first strike
// reaches its car, and their upload keeps out of an impact's frames (the queue's gate). The win's frames load when a
// Grandma Wild lands. A Wild whose loop is not in yet shows the still (its frame 1), and the loop starts from that frame
// when it is in (no pop); with not even the still in, today's still cloud. The landing's frames go after the spin's last
// strike has landed; the loop, the still and the win go when no Grandma Wild is left and the book being played calls for
// none (brawlRoundEnd at the round's end, or the next book). Never the splash: nothing here loads before a book.
import * as PIXI from 'pixi.js';

import { BRAWL_CLIPS } from '../brawlClipSpec';
import { GPU_MEMORY, GRANDMA_BRAWL, ROAD, TUNE } from '../constants';
import { stamp } from '../assets';
import { PHONE_TIER } from '../deviceTier';
import { STAGING_TOOLS, perfMark } from '../staging';
import { logRoundEndRelease, queuePresentUpload, rebatchBeforeUnload } from './columnClips';
import { WildWord, loadWildWord, wildWordMemory } from './wildWord';

// the tune panel lists the block (staging and the dev server only; the panel is compiled out of production)
(TUNE as Record<string, unknown>).grandmaBrawl = GRANDMA_BRAWL;

const B = GRANDMA_BRAWL;
const SPEC = BRAWL_CLIPS;
const TIER: 'full' | 'phone' = PHONE_TIER ? 'phone' : 'full';
const U_W = SPEC.cell.width;
const U_H = SPEC.cell.height;

// ---- THE FRAME SETS ---------------------------------------------------------------------------------------------------
export type BrawlSetName = 'loop' | 'land' | 'win' | 'still' | 'star';
type FrameSet = { textures: PIXI.Texture[]; fps: number };
type Entry = { set: FrameSet | null; loading: Promise<FrameSet | null> | null; urls: string[]; mb: number; kb: number };
const entries = new Map<BrawlSetName, Entry>();
const letting = new Map<BrawlSetName, Promise<void>>();
/** the upload queue's order (columnClips PRIORITY: entrance 0, cloud still 1, idle 2, win 3, run views 4) */
const PRIO: Record<BrawlSetName, number> = { still: 1, star: 1, land: 1, loop: 2, win: 3 };

type Tier = { sheets: readonly { file: string; width: number; height: number; frames: number }[]; columns: number; gap: number; frameWidth: number; frameHeight: number };
const tierOf = (name: BrawlSetName): { tier: Tier; fps: number } => {
	if (name === 'still') return { tier: SPEC.still.tiers[TIER], fps: 1 };
	if (name === 'star') return { tier: SPEC.star.tiers[TIER], fps: 1 };
	const c = SPEC.clips[name];
	return { tier: c.tiers[TIER], fps: c.fps };
};

/** set by the Brawl of the road (one road per page): is anything waiting on this set right now? */
let needNow: (name: BrawlSetName) => boolean = () => false;

const loadOne = async (name: BrawlSetName, entry: Entry): Promise<FrameSet | null> => {
	await letting.get(name);
	const { tier, fps } = tierOf(name);
	const textures: PIXI.Texture[] = [];
	try {
		for (const [n, sheet] of tier.sheets.entries()) {
			const url = stamp(`/assets/${sheet.file}`);
			const base = (await PIXI.Assets.load(url)) as PIXI.Texture;
			entry.urls.push(url);
			entry.mb += (base.source.pixelWidth * base.source.pixelHeight * 4) / 1048576;
			await queuePresentUpload(`brawl:${name}:${n + 1}/${tier.sheets.length}`, PRIO[name], base, () => needNow(name));
			for (let i = 0; i < sheet.frames; i++) {
				const fx = (i % tier.columns) * (tier.frameWidth + tier.gap);
				const fy = Math.floor(i / tier.columns) * (tier.frameHeight + tier.gap);
				textures.push(new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(fx, fy, tier.frameWidth, tier.frameHeight) }));
			}
		}
	} catch (error) {
		// a set that will not load never wedges a round: the Wild then shows what it has (the still, today's cloud)
		console.warn('[reindeer] brawl frames failed to load', name, error);
		return null;
	}
	const cost = (SPEC.budget as Record<string, { kb: number }>)[`${name}:${TIER}`];
	entry.kb = cost?.kb ?? 0;
	if (STAGING_TOOLS) perfMark(`load:brawl:${name}`);
	return { textures, fps };
};

/** start loading a set (or join the load under way) */
export const loadBrawl = (name: BrawlSetName): Promise<FrameSet | null> => {
	let entry = entries.get(name);
	if (!entry) {
		entry = { set: null, loading: null, urls: [], mb: 0, kb: 0 };
		entries.set(name, entry);
	}
	if (entry.set) return Promise.resolve(entry.set);
	if (entry.loading) return entry.loading;
	const e = entry;
	e.loading = loadOne(name, e).then(async (set) => {
		// let go while it loaded: its pictures go again (releaseBrawl has put the wait in `letting`)
		if (entries.get(name) !== e) {
			e.set = set;
			await unload(e);
			return null;
		}
		e.set = set;
		e.loading = null;
		if (!set) entries.delete(name);
		return set;
	});
	return e.loading;
};

/** the set if it is in (never waits) */
export const getBrawl = (name: BrawlSetName): FrameSet | null => {
	const s = entries.get(name)?.set ?? null;
	return s && s.textures.length && !s.textures[0].destroyed ? s : null;
};

const unload = async (e: Entry) => {
	for (const t of e.set?.textures ?? []) t.destroy(false);
	// no batch may still list a sheet when it goes (columnClips release: a rebuild and two frames first)
	await rebatchBeforeUnload();
	for (const url of e.urls) {
		try {
			await PIXI.Assets.unload(url);
		} catch {
			/* already gone */
		}
	}
	e.set = null;
};

/** let a set go (GPU and decoded copies). Nothing may still draw it: the Brawl drops its sprites' textures first. */
export const releaseBrawl = (name: BrawlSetName) => {
	const entry = entries.get(name);
	if (!entry) return;
	entries.delete(name);
	const before = letting.get(name) ?? Promise.resolve();
	const p: Promise<void> = before
		.then(() => (entry.loading ? entry.loading.then(() => undefined) : unload(entry)))
		.catch(() => undefined)
		.finally(() => {
			if (letting.get(name) === p) letting.delete(name);
		});
	letting.set(name, p);
};

/** what is loaded and what it weighs (dev hook, the brawl probe): GPU MB measured from the sheets, download KB from the
 *  build tool's numbers */
export const brawlMemory = () => {
	const rows = [...entries].filter(([, e]) => e.set).map(([name, e]) => ({ set: name, mb: Math.round(e.mb * 100) / 100, kb: e.kb }));
	return { tier: TIER, density: SPEC.tierScale[TIER], sets: rows, totalMb: Math.round(rows.reduce((n, r) => n + r.mb, 0) * 100) / 100, budget: SPEC.budget };
};

// ---- THE BOOK (game/utils.ts) -------------------------------------------------------------------------------------------
/** the book being played has a Grandma Wild */
let wanted = false;
let road: Brawl | null = null;

/** a book arrives: one with a Grandma Wild starts its still, landing and loop now (the column clips' warm up); one
 *  without lets the sets go once no Grandma Wild stands */
export const brawlForBook = (events: readonly { type: string }[]) => {
	bookSerial += 1;
	if (!B.on) return;
	wanted = events.some((e) => e.type === 'grandmaWild');
	if (wanted) {
		if (B.word.look === 'candy') void loadWildWord();
		void loadBrawl('still');
		void loadBrawl('star');
		void loadBrawl('land');
		void loadBrawl('loop');
	} else road?.releaseIfIdle();
};

/** the round's presentation is over: nothing more is wanted for it (the Wilds left standing keep theirs) */
export const brawlRoundEnd = () => {
	wanted = false;
	road?.releaseIfIdle();
};

/** books seen (a round end's let-go stops when the next book has arrived: its own scan decides) */
let bookSerial = 0;
/** THE ROUND'S END LETS GO OF THE WIN SHEET (constants GPU_MEMORY.releaseBonusSheets, move 2; OFF by default): a Grandma
 *  Wild left standing on the final board keeps her loop and still (drawn at rest) until the next press, but her win's
 *  frames are drawn by nothing before the next round: once no Wild is in its win beat (at most GPU_MEMORY.restWaitMs),
 *  they go. The next Grandma Wild to land loads them again (BrawlCell made: loadBrawl('win')), as the first one did. */
export const brawlRoundEndRelease = async (): Promise<void> => {
	if (!GPU_MEMORY.releaseBonusSheets || !B.on || !road || !entries.has('win')) return;
	const serial = bookSerial;
	const t0 = performance.now();
	while (road && road.winBusy() && performance.now() - t0 < GPU_MEMORY.restWaitMs && typeof requestAnimationFrame !== 'undefined') {
		await new Promise<void>((r) => requestAnimationFrame(() => r()));
		if (serial !== bookSerial) return;
	}
	if (serial !== bookSerial || !road || !entries.has('win')) return;
	// (a Wild's over sprite shows only the landing or the win, and is hidden every frame otherwise: BrawlCell update; the
	// let-go's rebuild of every batch and its two frames come first, rebatchBeforeUnload)
	const cut = road.winBusy();
	if (!cut) releaseBrawl('win');
	logRoundEndRelease({ at: Math.round(performance.now()), released: cut ? [] : ['brawl:win'], kept: cut ? ['brawl:win'] : [], waitedMs: Math.round(performance.now() - t0), cut });
};

// ---- THE MATH OF THE LANDING (landing_preview.html, option C) ---------------------------------------------------------
const L = B.landing;
const LAND = SPEC.land;
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** the bump: a damped spring's response to a kick (zeta 0.4: one overshoot back of a quarter), peak 1 */
const bumpN = (t: number) => {
	if (t < 0) return 0;
	const wd = (2 * Math.PI) / L.bumpMs;
	const z = 0.4;
	const w = wd / Math.sqrt(1 - z * z);
	return (Math.exp(-z * w * t) * Math.sin(wd * t)) / 0.6;
};
/** board ms from the impact the clip enters, and the clip's frame (a float, 1-based source frame) at `t` */
const clipT0 = () => L.spriteMs;
const coverAt = () => clipT0() + (Math.max(0, L.coverFrame - L.entry) / (24 * L.openSpeed)) * 1000;
const frameAt = (t: number): number | null => {
	const t0 = clipT0();
	if (t < t0) return null;
	const tc = coverAt();
	if (t <= tc) return L.entry + ((t - t0) / 1000) * 24 * L.openSpeed;
	return Math.max(L.entry, L.coverFrame) + ((t - tc) / 1000) * 24 * L.afterSpeed;
};
export const timeAtFrame = (f: number): number => {
	const t0 = clipT0();
	if (f <= L.entry) return t0;
	if (f <= L.coverFrame) return t0 + ((f - L.entry) / (24 * L.openSpeed)) * 1000;
	return coverAt() + ((f - Math.max(L.entry, L.coverFrame)) / (24 * L.afterSpeed)) * 1000;
};
/** the loop frame (source, 1-based) the cut lands on */
const loopEntry = () => L.loopEntry || LAND.cut[Math.min(LAND.cut.length, L.cutFrame) - 1] || 1;
/** the kept landing frame (index) for clip frame `c` */
const landIndex = (c: number) => {
	const kept = SPEC.clips.land.frames as readonly number[];
	let j = 0;
	for (let i = 0; i < kept.length; i++) if (kept[i] <= Math.floor(c + 1e-6)) j = i;
	return j;
};
/** the CLOUD_CELL pop the preview gives WILD (0.5 to 1.08 over 70%, then 1) */
const popK = (u: number) => (u <= 0 ? 0.5 : u < 0.7 ? 0.5 + (1.08 - 0.5) * (u / 0.7) : u < 1 ? 1.08 - 0.08 * ((u - 0.7) / 0.3) : 1);

/** the end of a Grandma strike: the reindeer's feet at the car's rear (road px), the way his cut runs, the x he runs
 *  down at (roadFeatures planStrike) */
export type StrikeEnd = { x: number; y: number; dir: 1 | -1; gapX: number };

/** a car's bump this frame for the road board (game/road/roadBoard.ts applies it to the parked car in `cell`; a row with
 *  no `on` puts the car back at rest once) */
export type CellBump = { cell: number; dx: number; sx: number; sy: number; lean: number; on: boolean };

type Rect = { x: number; y: number; w: number; h: number };

/** ONE GRANDMA WILD'S CLOUD */
export class BrawlCell {
	readonly under = new PIXI.Sprite();
	readonly over = new PIXI.Sprite();
	readonly star = new PIXI.Sprite();
	private underTex: PIXI.Texture | null = null;
	private overTex: PIXI.Texture | null = null;
	/** the box the clips fill (the still cloud's box today: the cell inset by RED_BOX.inset), from the cell's centre */
	readonly box: Rect;
	/** u (loop road px) to the box: the clip's 248 road px across the box's width */
	readonly k: number;
	mirror: boolean;
	/** the board clock the loop's frame 0 showed at (its phase) */
	loopT0: number;
	/** 'land' while the landing plays, then 'loop'; 'win' while the win beat plays */
	mode: 'land' | 'loop' | 'win' = 'loop';
	/** it came in with a landing (no pop of the whole cell) */
	readonly landed: boolean;
	/** the landing: the impact's board clock, the car's facing and its bottom centre below the cell's centre */
	readonly t0: number;
	readonly facing: 1 | -1;
	readonly carY: number;
	private lean = { b: 0, v: 0, t: 0 };
	/** board ms the car is covered (WILD and the number pop), the cut and its end */
	readonly coverMs: number;
	readonly cutMs: number;
	/** the car's last bump went to the road board, and the cell's symbol has been hidden */
	bumped = false;
	hid = false;
	/** THE WIN BEAT: board clock it is due (null: none asked), the win clock and kept frame it started at, its alpha in */
	winDue: number | null = null;
	winW0 = 0;
	winK0 = 0;
	winFrom = 0;
	beats = 0;
	/** THE CANDY WORD (game/road/wildWord.ts), and the board clock its number's win began (its letters hop with it) */
	readonly ww: WildWord;
	numberWinAt: number | null = null;
	/** the word's fade (0 normal, 1 its win state), linear on the win clock, drawn eased; the win clock it was last
	 *  stepped at; the word's own scale at rest */
	textK = 0;
	wLast = 0;
	wordBase = { x: 1, y: 1 };
	/** what it drew last (probes) */
	shown = { under: '', underFrame: -1, over: '', overFrame: -1, overAlpha: 0, wordAlpha: 1, wordScale: 1 };
	constructor(
		readonly cell: number,
		readonly root: PIXI.Container,
		readonly word: PIXI.Sprite,
		readonly fallback: PIXI.Sprite,
		box: Rect,
		landing: boolean,
		clock: number,
		index: number,
		row: { carY: number },
	) {
		this.box = box;
		this.k = box.w / U_W;
		this.t0 = clock;
		this.facing = (ROAD.laneDirection[cell % ROAD.laneDirection.length] ?? 1) as 1 | -1;
		this.carY = row.carY;
		this.mode = landing ? 'land' : 'loop';
		this.landed = landing;
		this.mirror = landing ? this.facing === -1 : index % 2 === 1;
		this.coverMs = timeAtFrame(L.coverFrame);
		this.cutMs = timeAtFrame(L.cutFrame);
		const loopMs = (SPEC.clips.loop.count * 1000) / SPEC.clips.loop.fps;
		if (landing) {
			// the loop's frame at the cut is the entry frame (kept index), on the board clock from here on
			const i0 = Math.floor((loopEntry() - 1) / 2);
			this.loopT0 = clock + this.cutMs - (i0 * 1000) / SPEC.clips.loop.fps;
		} else {
			const ph = B.phases[index % B.phases.length] ?? 0;
			this.loopT0 = clock - ph * loopMs;
		}
		this.under.visible = this.over.visible = this.star.visible = false;
		this.star.anchor.set(0.5);
		this.ww = new WildWord(cell);
		this.lean.t = clock;
	}

	/** the landing (board ms since the impact), or -1 when it is not landing */
	landT(clock: number) {
		return this.mode === 'land' ? clock - this.t0 : -1;
	}

	/** cut a clip frame to the box: `src` drawn over the local rect (px, py, pw, ph) (unmirrored, from the cell's centre),
	 *  through `slot`'s own dynamic texture; mirrored about the cell's centre when the Wild is */
	place(sprite: PIXI.Sprite, slot: 'underTex' | 'overTex', src: PIXI.Texture, px: number, py: number, pw: number, ph: number, alpha: number) {
		const b = this.box;
		const x0 = Math.max(px, b.x);
		const x1 = Math.min(px + pw, b.x + b.w);
		const y0 = Math.max(py, b.y);
		const y1 = Math.min(py + ph, b.y + b.h);
		if (src.destroyed || x1 - x0 < 0.5 || y1 - y0 < 0.5 || alpha <= 0) {
			sprite.visible = false;
			return;
		}
		const f = src.frame;
		const perX = f.width / pw;
		const perY = f.height / ph;
		const tex = (this[slot] ??= new PIXI.Texture({ source: src.source, frame: f.clone(), dynamic: true }));
		if (tex.source !== src.source) tex.source = src.source;
		tex.frame.x = f.x + (x0 - px) * perX;
		tex.frame.y = f.y + (y0 - py) * perY;
		tex.frame.width = Math.max(1, (x1 - x0) * perX);
		tex.frame.height = Math.max(1, (y1 - y0) * perY);
		tex.update();
		if (sprite.texture !== tex) sprite.texture = tex;
		const sx = (x1 - x0) / tex.frame.width;
		const sy = (y1 - y0) / tex.frame.height;
		if (this.mirror) {
			sprite.position.set(-x0, y0);
			sprite.scale.set(-sx, sy);
		} else {
			sprite.position.set(x0, y0);
			sprite.scale.set(sx, sy);
		}
		sprite.alpha = alpha;
		sprite.visible = true;
	}

	/** the loop's (or a still's) frame filling the box at the loop's scale */
	placeCell(sprite: PIXI.Sprite, slot: 'underTex' | 'overTex', src: PIXI.Texture, alpha = 1) {
		const k = this.k;
		this.place(sprite, slot, src, -k * (U_W / 2), -k * (U_H / 2), k * U_W, k * U_H, alpha);
	}

	/** the landing's frame `c` (float source frame) at its transform now: k0 larger about the car's bottom centre at the
	 *  hand-over (lined up with the bumped car, the clip's own shove cancelled), easing to the cell's size by the cut */
	placeLanding(src: PIXI.Texture, c: number, bx: number, sx: number, sy: number, alpha: number) {
		const w = smooth((c - L.coverFrame) / Math.max(1, L.cutFrame - L.coverFrame));
		const k0 = LAND.k0;
		const s = k0 + (this.k - k0) * w;
		const cancel = L.cancelShove && Math.floor(c) >= 2 ? -LAND.shoveU * s : 0;
		const [cux, cuy] = LAND.carU;
		const ox = (bx + cancel) * (1 - w) + this.k * cux * w;
		const oy = this.carY * (1 - w) + this.k * cuy * w;
		const SX = s * sx;
		const SY = s * sy;
		// the frame's u box (-124 .. 124, -88.25 .. 88.25) through p = o + S (u - carU)
		const px = ox + SX * (-U_W / 2 - cux);
		const py = oy + SY * (-U_H / 2 - cuy);
		this.place(this.over, 'overTex', src, px, py, SX * U_W, SY * U_H, alpha);
	}

	/** Grandma's lean on the bump: the page's RiderSpring stepped in 2 ms steps of the board clock on the car's
	 *  acceleration (degrees, forward) */
	stepLean(clock: number) {
		const h = 2;
		let n = 0;
		while (this.lean.t < clock && n++ < 400) {
			const t = this.lean.t - this.t0;
			const acc = (L.bumpPx * (bumpN(t + h) - 2 * bumpN(t) + bumpN(t - h))) / ((h / 1000) * (h / 1000));
			const peak = L.bumpPx * Math.pow(((2 * Math.PI) / L.bumpMs) * 1000, 2) || 1;
			const target = Math.max(-L.leanDeg, Math.min(L.leanDeg, (acc / peak) * L.leanDeg * 1.6));
			const w = 2 * Math.PI * L.leanHz;
			const a = w * w * (target - this.lean.b) - 2 * 0.45 * w * this.lean.v;
			this.lean.v += a * (h / 1000);
			this.lean.b += this.lean.v * (h / 1000);
			this.lean.t += h;
		}
		if (this.lean.t < clock) this.lean.t = clock;
		return this.lean.b;
	}

	destroy() {
		this.ww.destroy();
		this.under.texture = PIXI.Texture.EMPTY;
		this.over.texture = PIXI.Texture.EMPTY;
		this.star.texture = PIXI.Texture.EMPTY;
		this.underTex?.destroy(false);
		this.overTex?.destroy(false);
		this.underTex = this.overTex = null;
	}
}

/** THE ROAD'S BRAWL CLOUDS (one per road: game/road/roadFeatures.ts owns it) */
export class Brawl {
	readonly cells: BrawlCell[] = [];
	/** this frame's car bumps for the road board (game/road/roadBoard.ts applies and empties it) */
	bumps: CellBump[] = [];
	/** THE WIN CLOCK (game/road/roadBoard.ts sets both): real ms times a slam's hurry, and the turbo level's share of a
	 *  win's every time (LINE_WIN.holdShare): the beat runs at 1 / pace on it */
	winClock = 0;
	winPace = 1;
	/** the last Grandma strike's impact: its cell and board clock (a Wild made on that cell then lands) */
	private impact: { cell: number; at: number } | null = null;
	/** the spin's last strike has landed: the landing's frames go once no landing plays */
	private landingDone = false;
	/** the road's callbacks: hide the parked symbol of a cell, the atlas */
	constructor(
		private readonly tex: (frame: string) => PIXI.Texture | undefined,
		private readonly hideCell: (cell: number, hidden: boolean) => void,
	) {
		road = this;
		needNow = (name) => {
			if (name === 'still' || name === 'loop') return this.cells.some((c) => c.mode !== 'land' && !getBrawl('loop'));
			if (name === 'land' || name === 'star') return this.cells.some((c) => c.mode === 'land');
			return false;
		};
	}

	get on() {
		return B.on;
	}

	/** where a Grandma strike ends (the clip's frame 1 has his feet there): `cx` the cell's centre x, `carBottom` the
	 *  car's bottom centre y (road px), the car facing `facing`. Off: null (the cell's centre, as before) */
	strikeEnd(cx: number, carBottom: number, facing: 1 | -1): StrikeEnd | null {
		if (!B.on) return null;
		const [fx, fy] = LAND.deerFeetFromCar;
		const x = cx + facing * fx;
		const y = carBottom + fy;
		const gapX = Math.max(B.strike.minX, Math.min(B.strike.maxX, x - facing * B.strike.across));
		return { x, y, dir: facing, gapX };
	}

	/** a Grandma strike sets off: its landing's frames are wanted (they usually came with the book) */
	strikeStarts() {
		if (!B.on) return;
		this.landingDone = false;
		void loadBrawl('land');
		void loadBrawl('star');
	}

	/** a Grandma strike has hit its car (the board clock now); `last`: the spin's last strike */
	struck(cell: number, clock: number, grandma: boolean, last: boolean) {
		if (grandma) this.impact = { cell, at: clock };
		if (last) this.landingDone = true;
		this.releaseLanding();
	}

	/** the spin's last strike has landed and no landing plays (nor is about to: an impact whose Wild is not made yet) */
	private releaseLanding() {
		if (!this.landingDone || this.impact || this.cells.some((x) => x.mode === 'land')) return;
		this.landingDone = false;
		releaseBrawl('land');
		releaseBrawl('star');
	}

	/** A GRANDMA WILD'S CLOUD in `root` (its cell's centre), over today's still cloud sprite `fallback` (shown only while
	 *  no brawl picture is in) and under the frame; `word` is its WILD. Lands when a strike has just hit this cell. */
	make(cell: number, root: PIXI.Container, fallback: PIXI.Sprite, word: PIXI.Sprite, box: Rect, cellH: number, clock: number, carY: number): BrawlCell {
		// (the Wild's event follows its strike's impact at once; its landing's clock is the impact's)
		const hit = this.impact;
		const landing = !!hit && hit.cell === cell && clock - hit.at < timeAtFrame(L.coverFrame) && !!getBrawl('land');
		this.impact = null;
		const c = new BrawlCell(cell, root, word, fallback, box, landing, landing && hit ? hit.at : clock, this.cells.length, { carY });
		// the clips over the old still, under the frame (root: fallback, frame, word, number)
		root.addChildAt(c.under, root.getChildIndex(fallback) + 1);
		root.addChildAt(c.over, root.getChildIndex(c.under) + 1);
		root.addChildAt(c.star, root.getChildIndex(word));
		// the candy word over the star, under the number (it takes today's word's place in the order)
		root.addChildAt(c.ww.root, root.getChildIndex(word));
		if (B.word.look === 'candy') void loadWildWord();
		// today's word: its own picture and place (GRANDMA_BRAWL.word.today), shown when the look is 'today' or the candy
		// atlas is not in
		const T = B.word.today;
		const art = this.tex(T.frame);
		if (art) word.texture = art;
		word.anchor.set(0.5);
		const t = word.texture;
		word.height = T.height;
		word.width = t && t.height > 0 ? (t.width / t.height) * T.height : word.width;
		word.y = (T.y - 0.5) * cellH;
		c.wordBase = { x: word.scale.x, y: word.scale.y };
		c.wLast = this.winClock;
		// a landing's WILD waits for the cover (his "wild": "cover") FROM ITS FIRST FRAME: the Wild is made in the
		// handler's microtasks after the impact frame's update, so without this its first draw (and any read before its
		// first update) had WILD at full alpha (the probe host's "WILD hidden before the car is covered", 2026-11-20)
		if (landing) {
			word.alpha = 0;
			c.shown.wordAlpha = 0;
		}
		this.cells.push(c);
		void loadBrawl('win');
		if (!landing) {
			// it stands at once (a resume, a dev hook, a landing whose frames were not in): the symbol goes now
			this.hideCell(cell, true);
			c.hid = true;
		}
		return c;
	}

	/** one Wild's frame: the landing, the loop, the win beat */
	update(c: BrawlCell, clock: number, popMs: number) {
		const word = c.word;
		const loop = getBrawl('loop');
		const still = getBrawl('still');
		let showFallback = false;
		c.under.visible = c.over.visible = c.star.visible = false;
		c.shown.under = '';
		c.shown.underFrame = -1;
		c.shown.over = '';
		c.shown.overFrame = -1;
		c.shown.overAlpha = 0;
		let wordK = 1;
		let wordA = 1;
		if (c.mode === 'land') {
			const t = clock - c.t0;
			const land = getBrawl('land');
			const n = bumpN(t);
			const bx = L.bumpPx * n;
			const sq = (L.squash / 100) * Math.max(0, n);
			const sx = 1 - sq;
			const sy = 1 + sq * 0.5;
			const cf = frameAt(t);
			// THE SPRITE PHASE: the game's car, its front and Grandma take the bump (the road board, this frame)
			if (cf === null) {
				const lean = c.stepLean(clock);
				this.bumps.push({ cell: c.cell, dx: bx, sx, sy, lean, on: true });
				c.bumped = true;
			} else {
				if (c.bumped) {
					this.bumps.push({ cell: c.cell, dx: 0, sx: 1, sy: 1, lean: 0, on: false });
					c.bumped = false;
				}
				if (!c.hid) {
					this.hideCell(c.cell, true);
					c.hid = true;
				}
			}
			// THE CONTACT STAR (the page's: in over 50 ms to 1.15, back to 1 by 90, fading from 120)
			const starTex = getBrawl('star')?.textures[0];
			if (starTex && t >= 0 && t <= L.starMs) {
				const k = t < 50 ? 0.4 + 0.75 * (t / 50) : t < 90 ? 1.15 - 0.15 * ((t - 50) / 40) : 1;
				const a = t < 120 ? 1 : Math.max(0, 1 - (t - 120) / Math.max(1, L.starMs - 120));
				if (c.star.texture !== starTex) c.star.texture = starTex;
				const sp = SPEC.star;
				c.star.position.set(c.facing * (bx + sp.at[0]), c.carY + sp.at[1]);
				c.star.scale.set((c.facing * (sp.width * k)) / starTex.frame.width, (sp.height * k) / starTex.frame.height);
				c.star.alpha = a;
				c.star.visible = true;
			}
			const cutEnd = c.cutMs + L.xfadeMs;
			if (cf !== null && land && t < cutEnd) {
				// the landing over, the loop under it through the cut's fade
				if (t >= c.cutMs && loop) this.drawLoop(c, clock, loop);
				else if (t >= c.cutMs && still) this.drawStill(c, clock, still);
				const ce = Math.min(cf, L.cutFrame);
				const idx = landIndex(ce);
				const a = t >= c.cutMs ? 1 - (t - c.cutMs) / Math.max(1, L.xfadeMs) : 1;
				// (laid out for a car facing right; a car facing left is the same mirrored: a landed Wild's mirror)
				c.placeLanding(land.textures[idx], ce, bx, sx, sy, a);
				c.shown.over = 'land';
				c.shown.overFrame = idx;
				c.shown.overAlpha = Math.round(a * 1000) / 1000;
			} else if (cf !== null && (t >= cutEnd || !land)) {
				c.mode = 'loop';
			}
			// WILD and the number pop when the car is covered
			const u = (t - c.coverMs) / popMs;
			wordA = t >= c.coverMs ? 1 : 0;
			wordK = popK(u);
		}
		if (c.mode === 'loop' || c.mode === 'win') {
			// a win asked for while it landed starts now
			if (c.mode === 'loop' && c.winDue !== null && clock >= c.winDue) this.startBeat(c, clock);
			if (c.mode === 'win') {
				const win = getBrawl('win');
				const kept = SPEC.clips.win.count;
				const e = Math.max(0, (this.winClock - c.winW0) / Math.max(0.05, this.winPace));
				const k = c.winK0 + Math.floor((e / 1000) * SPEC.clips.win.fps);
				if (!win || k >= kept) {
					// back to the loop on its frame 1, the still both share
					c.mode = 'loop';
					c.loopT0 = clock;
					c.winDue = null;
				} else {
					const fade = Math.min(1, (this.winClock - c.winFrom) / Math.max(1, B.win.fadeInMs));
					if (fade < 1 && loop) this.drawLoop(c, clock, loop);
					else c.under.visible = false;
					c.placeCell(c.over, 'overTex', win.textures[k], fade);
					c.shown.over = 'win';
					c.shown.overFrame = k;
					c.shown.overAlpha = Math.round(fade * 1000) / 1000;
					// WILD to wordAlpha while the head is up, eased on the win clock
					const up = !!SPEC.win.headUp[k];
					const rate = Math.max(0, this.winClock - c.wLast) / Math.max(1, B.win.wordEaseMs);
					c.textK = up ? Math.min(1, c.textK + rate) : Math.max(0, c.textK - rate);
				}
			}
			if (c.mode === 'loop') {
				if (loop) this.drawLoop(c, clock, loop);
				else if (still) this.drawStill(c, clock, still);
				else showFallback = true;
				// the word comes back from the beat's fade
				c.textK = Math.max(0, c.textK - Math.max(0, this.winClock - c.wLast) / Math.max(1, B.win.wordEaseMs));
			}
		}
		c.wLast = this.winClock;
		c.fallback.visible = showFallback;
		if (showFallback) c.shown.under = 'fallback';
		const e = c.textK * c.textK * (3 - 2 * c.textK);
		const fade = 1 - (1 - B.win.wordAlpha) * e;
		wordA *= fade;
		// THE CANDY WORD: its letters drop in from the cover (a landed Wild; standing at once otherwise), hop with the
		// number's win, the light sweeps; the win's fade on the whole word
		let candy = false;
		if (B.word.look === 'candy') {
			const C = B.word.candy;
			const tc = clock - (c.t0 + c.coverMs);
			const landEnd = C.dropMs + 3 * C.letterMs;
			const tl = c.landed && tc < landEnd ? tc : null;
			const hopEnd = Math.max(...C.hop.beats) + C.hop.ms + 3 * C.hop.staggerMs;
			const tw = c.numberWinAt !== null && clock >= c.numberWinAt && clock - c.numberWinAt < hopEnd ? clock - c.numberWinAt : null;
			candy = c.ww.draw(c.box, clock, tl, tw, fade);
		} else c.ww.root.visible = false;
		word.visible = !candy;
		word.alpha = wordA;
		word.scale.set(c.wordBase.x * wordK, c.wordBase.y * wordK);
		c.shown.wordAlpha = Math.round((candy ? (c.ww.root.visible ? fade : 0) : wordA) * 1000) / 1000;
		c.shown.wordScale = wordK;
		this.releaseLanding();
	}

	/** the still (the loop's frame 1) until the loop is in; the loop then starts on that very frame (no pop) */
	private drawStill(c: BrawlCell, clock: number, still: FrameSet) {
		c.placeCell(c.under, 'underTex', still.textures[0]);
		c.loopT0 = clock;
		c.shown.under = 'still';
		c.shown.underFrame = 0;
	}

	private drawLoop(c: BrawlCell, clock: number, loop: FrameSet) {
		const n = loop.textures.length;
		const i = ((Math.floor(((clock - c.loopT0) / 1000) * loop.fps) % n) + n) % n;
		c.placeCell(c.under, 'underTex', loop.textures[i]);
		c.shown.under = 'loop';
		c.shown.underFrame = i;
	}

	/** A WIN THROUGH THIS WILD, from board clock `at`: the beat plays once (a later line through it only moves its
	 *  number); one landing still under way starts it when the landing hands over */
	win(c: BrawlCell, at: number, numberAt: number = at) {
		if (!B.on || c.mode === 'win' || c.winDue !== null) return;
		// (its word's letters hop on its number's beats: the first of its lines, as the number's own win)
		c.numberWinAt = numberAt;
		c.winDue = at;
		void loadBrawl('win');
	}

	private startBeat(c: BrawlCell, clock: number) {
		const win = getBrawl('win');
		if (!win) {
			// its frames are not in: no beat this win (the number still plays its own)
			c.winDue = null;
			return;
		}
		const loop = getBrawl('loop');
		const n = loop?.textures.length ?? SPEC.clips.loop.count;
		const li = ((Math.floor(((clock - c.loopT0) / 1000) * SPEC.clips.loop.fps) % n) + n) % n;
		// entered at the wind up frame most like the loop's frame, fading in over the loop
		c.winK0 = SPEC.win.enterAt[li] ?? 0;
		c.winW0 = this.winClock;
		c.winFrom = this.winClock;
		c.mode = 'win';
		c.beats += 1;
	}

	/** the line win is over or cut: a beat under way plays on to its end; one not started yet is dropped */
	clearWin() {
		for (const c of this.cells) if (c.mode !== 'win') c.winDue = null;
	}

	/** a Wild's cloud has gone (its fade is over, a column covered it, a new spin) */
	drop(c: BrawlCell) {
		if (c.bumped) this.bumps.push({ cell: c.cell, dx: 0, sx: 1, sy: 1, lean: 0, on: false });
		c.destroy();
		const i = this.cells.indexOf(c);
		if (i >= 0) this.cells.splice(i, 1);
		this.releaseIfIdle();
	}

	/** a Wild is in its win beat, or has one due (the round end's let-go waits for it) */
	winBusy(): boolean {
		return this.cells.some((c) => c.mode === 'win' || c.winDue !== null);
	}

	/** no Grandma Wild stands and the book wants none: every set goes */
	releaseIfIdle() {
		if (this.cells.length || wanted) return;
		for (const name of ['loop', 'win', 'still', 'land', 'star'] as BrawlSetName[]) releaseBrawl(name);
	}

	/** is a landing in its frames (the impact's frames: no uploads then) */
	landing(): boolean {
		return this.cells.some((c) => c.mode === 'land');
	}

	/** what each Wild draws (dev hook, the brawl probe) */
	snapshot() {
		return {
			on: B.on,
			cells: this.cells.map((c) => ({
				cell: c.cell,
				mode: c.mode,
				mirror: c.mirror,
				facing: c.facing,
				...c.shown,
				// the word as it stands on the stage (not a cached value): the candy word's whole alpha while it shows, else
				// today's word's
				wordLook: c.ww.root.visible ? 'candy' : c.word.visible && c.word.alpha > 0 ? 'today' : 'none',
				wordAlpha: c.ww.root.visible ? Math.round(c.ww.root.alpha * 1000) / 1000 : c.word.visible ? Math.round(c.word.alpha * 1000) / 1000 : 0,
				wordVisible: c.ww.root.visible || (c.word.visible && c.word.alpha > 0),
				// never mirrored: the determinant of its world transform
				wordMirrored: (() => {
					const m = (c.ww.root.visible ? c.ww.root : c.word).worldTransform;
					return m.a * m.d - m.b * m.c < 0;
				})(),
				candyWord: c.ww.last,
				underSource: c.under.visible ? c.under.texture.source.uid : -1,
				overSource: c.over.visible ? c.over.texture.source.uid : -1,
				underVisible: c.under.visible,
				overVisible: c.over.visible,
				star: c.star.visible,
				fallback: c.fallback.visible,
				beats: c.beats,
				winDue: c.winDue,
				sprites: c.root.children.length,
				box: c.box,
			})),
			sets: { loop: !!getBrawl('loop'), land: !!getBrawl('land'), win: !!getBrawl('win'), still: !!getBrawl('still'), star: !!getBrawl('star') },
			wanted,
			landing: { coverMs: timeAtFrame(L.coverFrame), cutMs: timeAtFrame(L.cutFrame), loopEntry: loopEntry() },
			memory: brawlMemory(),
			word: wildWordMemory(),
		};
	}
}
