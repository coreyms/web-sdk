// THE SCATTER PRESENT (Corey 2026-11-15): the approved 3D present's frames (tools/build_present.py made the sheets and
// game/presentSpec.ts), played on a present symbol of the road:
//   - closed and still: the symbol atlas's S (no sheet of its own, nothing moving);
//   - a present lands (its lane brings it to its stop point): THE PEEK, the open's squash and first lift, a small glint
//     of light, then the close's fall, squash and bounce (367 ms at the board's pace). Nothing waits for it;
//   - a trigger (the book's freeSpinTrigger / freeSpinRetrigger cells): THE FULL OPEN, the whole open with the light,
//     rays and stars, a hold, the whole close.
//
// The pictures: every frame is the delivered painted frame cut into pieces that give it back exactly (a back piece,
// the box's inside, under the light, and one or two front pieces over it; tools/build_present.py says how). Each piece's
// texture keeps the frame's whole canvas as its `orig`, so every piece of every frame is drawn by one anchor (the
// present's bottom centre) and one scale.
//
// The light is plain sprites and Graphics, no filter, no mask, no shader: the opening's fill (flat polygons of the
// delivered opening ring, in steps of the demo's gradient), the rays and the bloom with the additive blend the
// stoplights' glow already uses, and the four-point stars. It sits between the back and the front pieces, so it comes
// out of the box behind the lid, as on the demo page.
//
// THE RED PRESENT (the Super scatter, Corey 2026-11-17, design E): the 4th and 5th present to land in a base spin are
// red from the moment they appear (game/road/roadBoard.ts ranks them). Every sheet has a red twin (presentSpec redFile,
// same layout and alpha, tools/build_present.py); an actor draws its variant's pieces. The red sheets load only for a
// book whose base board holds 4 or more presents and are let go with the open's after its last trigger. A red present
// whose pictures are not in stays still (the peek) and its trigger pulses, as a teal one does.
//
// Loading (the column pictures' rules, game/road/columnClips.ts): the peek's sheet loads in the background once the
// board is up and stays for the session; the open's sheets load when a book with a trigger arrives and are let go when
// its last trigger has played, with every batch rebuilt and two frames rendered before the unload (the Pixi 8
// "reading 'addressModeU'" rule). Every sheet goes to the GPU through the one upload queue. Never a blob: URL.
import * as PIXI from 'pixi.js';

import { PRESENT_ART } from '../presentSpec';
import { PRESENT } from '../constants';
import { stamp } from '../assets';
import { PHONE_TIER } from '../deviceTier';
import { STAGING_TOOLS, perfMark } from '../staging';
import { queuePresentUpload, rebatchBeforeUnload } from './columnClips';

type Group = 'peek' | 'open';
export type PresentVariant = 'teal' | 'red';
/** a set of sheets: a group of one variant */
type Key = Group | 'peek-red' | 'open-red';
const keyOf = (group: Group, variant: PresentVariant): Key => (variant === 'red' ? (`${group}-red` as Key) : group);
type PieceSpec = { sheet: number; x: number; y: number; w: number; h: number; ox?: number; oy?: number };
type FrameSpec = { back: readonly string[]; front: readonly string[]; inside: boolean; ring: readonly (readonly number[])[]; opening: { cx: number; cy: number; hw: number; hh: number } };
type Slot = { src: string; show: string; lift: number; pitch: number; roll: number };

const TIER = PHONE_TIER ? 'phone' : 'full';
const T = PRESENT_ART.tiers[TIER];
const PIECES = T.pieces as unknown as Record<string, PieceSpec>;
const FRAMES = PRESENT_ART.frames as unknown as Record<string, FrameSpec>;
const CLIPS = PRESENT_ART.clips as unknown as Record<'peek' | 'open' | 'close', readonly Slot[]>;
const FRAME_MS = 1000 / PRESENT_ART.fps;
const FULL_LIFT = PRESENT_ART.light.fullLift;
/** the pieces' anchor in their canvas (the present's bottom centre) and their road px per sheet px */
const ANCHOR_X = PRESENT_ART.anchor.x / (PRESENT_ART.canvasRoad.width * PRESENT_ART.sourceDensity);
const ANCHOR_Y = PRESENT_ART.anchor.y / (PRESENT_ART.canvasRoad.height * PRESENT_ART.sourceDensity);
const PIECE_SCALE = 1 / T.density;
/** the demo's longest ray: 0.62 of the 800 px frame, road px */
const RAY_ROAD = (800 * 0.62) / PRESENT_ART.sourceDensity;
/** the star sprite's point radius, road px (33 frame px) */
const STAR_ROAD = 33 / PRESENT_ART.sourceDensity;

/** THE STILL'S LOOK (game/road/roadBoard.ts): the anchor every piece and the still share, and road px per sheet px */
export const PRESENT_LOOK = { anchorX: ANCHOR_X, anchorY: ANCHOR_Y, scale: PIECE_SCALE };
/** the still picture as a texture on the pieces' canvas (its trim offset inside it), from the preloaded still sheet */
export const presentStillTexture = (sheet: PIXI.Texture | undefined): PIXI.Texture | null => {
	if (!sheet) return null;
	const s = T.still;
	return new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(0, 0, s.w, s.h), orig: new PIXI.Rectangle(0, 0, T.canvas.w, T.canvas.h), trim: new PIXI.Rectangle(s.ox, s.oy, s.w, s.h) });
};
/** a board's presents ranked 4th and later decide Super: a base board with this many presents shows the red ones */
export const RED_FROM = 4;
const countPresents = (board: readonly (readonly string[])[]) => board.reduce((n, reel) => n + reel.filter((s) => s === 'S').length, 0);

/** the clips' lengths, board clock ms */
export const PEEK_MS = CLIPS.peek.length * FRAME_MS;
const OPEN_MS = CLIPS.open.length * FRAME_MS;
const CLOSE_MS = CLIPS.close.length * FRAME_MS;
/** THE LID LEAVES THE BOX: the open's first frame with any lift (frames 0 to 2 are the squash); the presents' pop sound
 *  plays on it (game/road/roadBoard.ts, constants REINDEER_SOUND present) */
export const PRESENT_LID_FRAME = Math.max(0, CLIPS.open.findIndex((s) => s.lift > 0));
/** the whole trigger show for a present starting now: open, hold, close */
export const presentOpenMs = () => OPEN_MS + PRESENT.holdMs + CLOSE_MS;

// ---- LOADING -----------------------------------------------------------------------------------------------------------
type GroupState = { textures: Map<string, PIXI.Texture> | null; loading: Promise<boolean> | null; releasing: Promise<void> | null; sources: PIXI.TextureSource[]; urls: string[]; waiting: number };
const fresh = (): GroupState => ({ textures: null, loading: null, releasing: null, sources: [], urls: [], waiting: 0 });
const groups: Record<Key, GroupState> = { peek: fresh(), open: fresh(), 'peek-red': fresh(), 'open-red': fresh() };
let mipmapper: ((source: PIXI.TextureSource) => void) | null = null;
/** set by components/Board.svelte on the desktop tier: the sheets are drawn well under their size (house rule) */
export const setPresentMipmapper = (fn: typeof mipmapper) => {
	mipmapper = fn;
};

/** start loading a group's sheets of a variant (or join the load running); true when every sheet is on the GPU */
export const loadPresent = (group: Group, variant: PresentVariant = 'teal'): Promise<boolean> => {
	const key = keyOf(group, variant);
	const st = groups[key];
	if (st.textures) return Promise.resolve(true);
	st.loading ??= (async () => {
		// a let-go of the same sheets still running finishes first (a load now would be handed the dying textures)
		if (st.releasing) await st.releasing;
		try {
			const pages = new Map<number, PIXI.TextureSource>();
			for (const [index, sheet] of T.sheets.entries()) {
				if (sheet.group !== group) continue;
				const url = stamp(`/assets/${variant === 'red' ? sheet.redFile : sheet.file}`);
				const base = (await PIXI.Assets.load(url)) as PIXI.Texture;
				st.urls.push(url);
				st.sources.push(base.source);
				mipmapper?.(base.source);
				await queuePresentUpload(`present:${key}:${index}`, variant === 'red' ? (group === 'peek' ? 0 : 1) : group === 'open' ? 1 : 5, base, () => st.waiting > 0);
				pages.set(index, base.source);
			}
			const map = new Map<string, PIXI.Texture>();
			for (const [name, p] of Object.entries(PIECES)) {
				const source = pages.get(p.sheet);
				if (!source) continue;
				const frame = new PIXI.Rectangle(p.x, p.y, p.w, p.h);
				map.set(
					name,
					p.ox === undefined || p.oy === undefined
						? new PIXI.Texture({ source, frame })
						: new PIXI.Texture({ source, frame, orig: new PIXI.Rectangle(0, 0, T.canvas.w, T.canvas.h), trim: new PIXI.Rectangle(p.ox, p.oy, p.w, p.h) }),
				);
			}
			st.textures = map;
			if (STAGING_TOOLS) perfMark(`load:present:${key}`);
			return true;
		} catch (error) {
			// without them the present stays still (the peek) or pulses as before (a trigger): never a reason to stop a round
			console.warn('[reindeer] present sheets failed to load', key, error);
			st.loading = null;
			return false;
		}
	})();
	return st.loading;
};

/** wait for a group of a variant at most `ms` (real time); true when it is in */
const awaitPresent = async (group: Group, variant: PresentVariant, ms: number): Promise<boolean> => {
	const st = groups[keyOf(group, variant)];
	if (st.textures) return true;
	st.waiting++;
	try {
		return await Promise.race([loadPresent(group, variant), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms))]);
	} finally {
		st.waiting--;
	}
};

/** the actors drawing a group's pieces now (a group is never let go under one) */
const users: Record<Key, Set<PresentActor>> = { peek: new Set(), open: new Set(), 'peek-red': new Set(), 'open-red': new Set() };

/** let a group's sheets go (GPU and decoded copies), once nothing draws them */
/** a let-go asked for while an actor still drew the group: it runs when the last one lets go */
const pendingRelease = new Set<Key>();
const releasePresent = async (group: Key): Promise<void> => {
	const st = groups[group];
	if (st.loading) await st.loading;
	if (!st.textures) return;
	if (users[group].size) {
		pendingRelease.add(group);
		return;
	}
	pendingRelease.delete(group);
	const textures = st.textures;
	const urls = st.urls;
	st.textures = null;
	st.loading = null;
	st.urls = [];
	st.sources = [];
	st.releasing = (async () => {
		for (const t of textures.values()) t.destroy(false);
		// NO BATCH MAY STILL LIST A SHEET WHEN IT IS UNLOADED (columnClips.ts release): rebuild every batch, let two frames
		// render with the new batches, then unload
		await rebatchBeforeUnload();
		for (const url of urls) {
			try {
				await PIXI.Assets.unload(url);
			} catch {
				/* already gone */
			}
		}
	})();
	await st.releasing;
	st.releasing = null;
	if (STAGING_TOOLS) perfMark(`unload:present:${group}`);
};

const piece = (name: string, variant: PresentVariant): PIXI.Texture | null => groups[keyOf('peek', variant)].textures?.get(name) ?? groups[keyOf('open', variant)].textures?.get(name) ?? null;
/** every piece of a frame is in */
const frameReady = (tag: string, variant: PresentVariant): boolean => {
	const f = FRAMES[tag];
	return !!f && [...f.back, ...f.front].every((n) => piece(n, variant));
};
const groupOf = (name: string): Group => (T.sheets[PIECES[name]?.sheet ?? 0]?.group === 'open' ? 'open' : 'peek');
const isOpen = (key: Key) => key === 'open' || key === 'open-red';

/** THE BOOK'S TRIGGERS (scanned when the book arrives, game/utils.ts): the open's sheets start loading now when the book
 *  has one; a book with none lets them go */
let triggersLeft = 0;
/** this book shows red presents (a base board with RED_FROM or more): its trigger waits for the red open too */
let redBook = false;
/** THE SUPER WHEEL (game/road/superWheel.ts) rises out of the red present after the trigger's own show: a book with a
 *  Super opening keeps the red sheets past its last trigger, until the wheel has come out (presentWheelDone) */
let wheelHold = false;
type BookEventLike = { type: string; gameType?: string; board?: readonly (readonly string[])[]; start?: boolean };
export const presentsForBook = (events: readonly BookEventLike[]) => {
	triggersLeft = events.filter((e) => e.type === 'freeSpinTrigger' || e.type === 'freeSpinRetrigger').length;
	redBook = events.some((e) => e.type === 'reveal' && e.gameType === 'basegame' && !!e.board && countPresents(e.board) >= RED_FROM);
	wheelHold = redBook && events.some((e) => e.type === 'columnWild' && e.start === true);
	if (redBook) {
		// the red peek first: the red present lands well before the trigger's open
		pendingRelease.delete('peek-red');
		void loadPresent('peek', 'red');
	} else void releasePresent('peek-red');
	if (triggersLeft > 0) {
		pendingRelease.delete('open');
		void loadPresent('open');
		if (redBook) {
			pendingRelease.delete('open-red');
			void loadPresent('open', 'red');
		}
	} else void releasePresent('open');
	if (!(triggersLeft > 0 && redBook)) void releasePresent('open-red');
};
/** a trigger's show is over (game/road/roadBoard.ts, once per trigger): after the book's last one, the open's sheets go
 *  (and the red ones: the red presents are only on the trigger's own board) */
export const presentTriggerPlayed = () => {
	triggersLeft = Math.max(0, triggersLeft - 1);
	if (triggersLeft === 0) {
		void releasePresent('open');
		if (wheelHold) return;
		void releasePresent('open-red');
		void releasePresent('peek-red');
	}
};
/** the Super wheel has come out of the red present (components/Board.svelte: as it comes to rest, its present's car gone),
 *  or the round went on without it (game/bookEventHandlerMap.ts, at the opening column): the red sheets may go. A present
 *  still drawing them (never the case at these moments) keeps them until it stops (releasePresent). */
export const presentWheelDone = () => {
	if (!wheelHold) return;
	wheelHold = false;
	if (triggersLeft === 0) {
		void releasePresent('open-red');
		void releasePresent('peek-red');
	}
};

/** what is loaded and what it weighs on the GPU, MB (dev hook, the probe and NOTES.md) */
export const presentMemory = () => {
	const one = (group: Key) => {
		const st = groups[group];
		const mb = st.sources.reduce((n, s) => n + (s.pixelWidth * s.pixelHeight * 4) / 1048576, 0);
		const mips = st.sources.some((s) => s.autoGenerateMipmaps);
		return { loaded: st.textures !== null, sheets: st.sources.map((s) => `${s.pixelWidth}x${s.pixelHeight}`), mb: Math.round(mb * 100) / 100, mipmapped: mips, mbWithMips: Math.round(mb * (mips ? 4 / 3 : 1) * 100) / 100 };
	};
	const peek = one('peek');
	const open = one('open');
	const peekRed = one('peek-red');
	const openRed = one('open-red');
	const all = [peek, open, peekRed, openRed];
	const sum = (f: (g: (typeof all)[number]) => number) => Math.round(all.reduce((n, g) => n + f(g), 0) * 100) / 100;
	return { tier: TIER, density: T.density, peek, open, peekRed, openRed, totalMb: sum((g) => g.mb), totalWithMips: sum((g) => g.mbWithMips), users: { peek: users.peek.size, open: users.open.size, peekRed: users['peek-red'].size, openRed: users['open-red'].size }, triggersLeft, redBook };
};

// ---- THE LIGHT'S SHAPES --------------------------------------------------------------------------------------------------
const rnd = (i: number) => {
	const x = Math.sin(i * 127.1 + 3.7) * 43758.5453;
	return x - Math.floor(x);
};
/** the demo's stars (frame px converted to road px): the first eight burst with the pop, the rest trickle up */
const STARS = Array.from({ length: PRESENT.light.stars }, (_, i) => ({
	ang: -Math.PI / 2 + (rnd(i) - 0.5) * (i < 8 ? 2.4 : 1.6),
	speed: ((i < 8 ? 230 : 140) + rnd(i + 20) * 200) / PRESENT_ART.sourceDensity,
	size: (13 + rnd(i + 40) * 20) / PRESENT_ART.sourceDensity,
	spin: (rnd(i + 60) - 0.5) * 3,
	delay: i < 8 ? 120 + rnd(i + 80) * 140 : 450 + rnd(i + 80) * 1300,
	life: 600 + rnd(i + 90) * 450,
	x0: rnd(i + 99) - 0.5,
}));

/** the opening's fill for a frame: flat steps of the demo's gradient (orange rim, gold, a pale heart) on the delivered
 *  ring; with no inside piece, edged by a band of the inside's colour (the inside's few pixels just past the ring) */
const fills = new Map<string, PIXI.GraphicsContext>();
const fillFor = (tag: string, variant: PresentVariant): PIXI.GraphicsContext => {
	let ctx = fills.get(`${variant}:${tag}`);
	if (ctx) return ctx;
	const f = FRAMES[tag];
	const o = f.opening;
	const pts = (sx: number, sy: number, cy: number) => f.ring.flatMap(([x, y]) => [o.cx + (x - o.cx) * sx, cy + (y - o.cy) * sy]);
	ctx = new PIXI.GraphicsContext();
	if (!f.back.length) {
		ctx.poly(pts(1, 1, o.cy), true).stroke({ width: 2 * PRESENT_ART.light.rimPad, color: variant === 'red' ? PRESENT_ART.light.rimColourRed : PRESENT_ART.light.rimColour, join: 'round' });
	}
	ctx.poly(pts(1, 1, o.cy), true).fill({ color: 0xec8c14 });
	ctx.poly(pts(0.66, 0.8, o.cy + o.hh * 0.1), true).fill({ color: 0xf8b43c });
	ctx.poly(pts(0.4, 0.62, o.cy + o.hh * 0.2), true).fill({ color: 0xffd65a });
	ctx.poly(pts(0.16, 0.42, o.cy + o.hh * 0.3), true).fill({ color: 0xfff3c0 });
	fills.set(`${variant}:${tag}`, ctx);
	return ctx;
};

// ---- THE ACTOR: one present's pieces and light, following its symbol's sprite ------------------------------------------
type Anim = { kind: 'peek' | 'open'; t0: number; then: boolean; done: (() => void) | null };

export type PresentTraceRow = { t: number; cell: number; variant: PresentVariant; kind: 'peek' | 'open'; part: 'peek' | 'open' | 'hold' | 'close'; slot: number; src: string; show: string; lift: number; pitch: number; glow: number };
/** DEV: per frame of every present animation (the probe's tables), oldest first, bounded */
const trace: PresentTraceRow[] = [];
export const presentTrace = (clear = false) => {
	const out = trace.slice();
	if (clear) trace.length = 0;
	return out;
};

export class PresentActor {
	readonly root = new PIXI.Container();
	private readonly back = new PIXI.Sprite();
	private readonly fill = new PIXI.Graphics();
	private readonly glow = new PIXI.Container();
	private readonly bloom = new PIXI.Sprite();
	private readonly rays: PIXI.Sprite[] = [];
	private readonly starLayer = new PIXI.Container();
	private readonly stars: PIXI.Sprite[] = [];
	private readonly front: PIXI.Sprite[] = [new PIXI.Sprite(), new PIXI.Sprite()];
	private anim: Anim | null = null;
	private shownTag = '';
	private holds = new Set<Key>();
	/** the cell it was started in (the trace) */
	cell = -1;
	/** teal, or red (the 4th and 5th present of a base spin): set by its car before it animates (roadBoard.presentOf) */
	variant: PresentVariant = 'teal';
	/** the full open's frame drawn on the last update (its hold and close count as past the open's last), -1 when no
	 *  full open is showing (the pop sound reads it) */
	openSlot = -1;
	private tracedAt = NaN;

	constructor() {
		for (const s of [this.back, ...this.front]) {
			s.anchor.set(ANCHOR_X, ANCHOR_Y);
			s.scale.set(PIECE_SCALE);
		}
		this.glow.addChild(this.bloom);
		this.bloom.anchor.set(0.5);
		this.bloom.blendMode = 'add';
		this.bloom.tint = 0xffe68c;
		for (let i = 0; i < PRESENT.light.rays; i++) {
			const r = new PIXI.Sprite();
			r.anchor.set(0.5, 1);
			r.blendMode = 'add';
			this.rays.push(r);
			this.glow.addChild(r);
		}
		for (let i = 0; i < STARS.length; i++) {
			const s = new PIXI.Sprite();
			s.anchor.set(0.5);
			this.stars.push(s);
			this.starLayer.addChild(s);
		}
		this.root.addChild(this.back, this.fill, this.glow, this.starLayer, ...this.front);
		this.root.visible = false;
	}

	/** animating now (its symbol's own sprite is hidden while it is) */
	get busy(): boolean {
		return this.anim !== null;
	}

	/** the open's show is running, or waiting to run after a peek */
	get opening(): boolean {
		return this.anim?.kind === 'open' || !!this.anim?.then;
	}

	/** THE PEEK from board clock time t0 (the stop point); false when its pictures are not in (it then stays still) */
	peek(t0: number): boolean {
		if (!PRESENT.peek.on || !groups[keyOf('peek', this.variant)].textures) return false;
		if (this.anim) return false;
		this.anim = { kind: 'peek', t0, then: false, done: null };
		this.hold(keyOf('peek', this.variant));
		return true;
	}

	/** THE FULL OPEN from `now`; resolves when the present is closed and still again. A peek in its lift (the open's
	 *  own first four frames) runs straight on into it; a peek past its lift finishes first. */
	open(now: number): Promise<void> {
		return new Promise<void>((resolve) => {
			const a = this.anim;
			this.hold(keyOf('peek', this.variant));
			this.hold(keyOf('open', this.variant));
			if (a && a.kind === 'peek') {
				const slot = Math.floor((now - a.t0) / FRAME_MS);
				if (slot <= 3) this.anim = { kind: 'open', t0: a.t0, then: false, done: resolve };
				else {
					a.then = true;
					a.done = resolve;
				}
				return;
			}
			a?.done?.();
			this.anim = { kind: 'open', t0: now, then: false, done: resolve };
		});
	}

	private hold(group: Key) {
		this.holds.add(group);
		users[group].add(this);
	}

	/** back to the still picture: its symbol's sprite draws again */
	reset() {
		const a = this.anim;
		this.anim = null;
		this.openSlot = -1;
		this.root.visible = false;
		this.shownTag = '';
		for (const s of [this.back, ...this.front]) s.texture = PIXI.Texture.EMPTY;
		for (const g of this.holds) {
			users[g].delete(this);
			if (!users[g].size && pendingRelease.has(g) && !(isOpen(g) && triggersLeft > 0)) void releasePresent(g);
		}
		this.holds.clear();
		a?.done?.();
	}

	/** one frame: follow the symbol's sprite, show the slot's pieces and light. Returns whether it still animates. */
	update(now: number, sprite: PIXI.Sprite, baseScale: number): boolean {
		const a = this.anim;
		if (!a) return false;
		const el = now - a.t0;
		let slot: Slot;
		let part: PresentTraceRow['part'];
		let index: number;
		let glow: number;
		let fxMs = el;
		if (a.kind === 'peek') {
			index = Math.floor(el / FRAME_MS);
			if (index >= CLIPS.peek.length) {
				if (a.then) {
					// the trigger came while the peek was past its lift: the open starts now
					this.anim = { kind: 'open', t0: now, then: false, done: a.done };
					return this.update(now, sprite, baseScale);
				}
				this.reset();
				return false;
			}
			slot = CLIPS.peek[Math.max(0, index)];
			part = 'peek';
			// the glint: the light follows the lid (up for two frames) and lingers a few frames as it shuts
			const raw = (i: number) => (i >= 0 ? Math.min(1, CLIPS.peek[i].lift / FULL_LIFT) : 0);
			glow = PRESENT.peek.glint * Math.max(raw(index), 0.75 * raw(index - 1), 0.5 * raw(index - 2), 0.25 * raw(index - 3));
		} else {
			if (el < OPEN_MS) {
				index = Math.max(0, Math.floor(el / FRAME_MS));
				slot = CLIPS.open[index];
				part = 'open';
			} else if (el < OPEN_MS + PRESENT.holdMs) {
				index = CLIPS.open.length - 1;
				slot = CLIPS.open[index];
				part = 'hold';
			} else if (el < OPEN_MS + PRESENT.holdMs + CLOSE_MS) {
				index = Math.floor((el - OPEN_MS - PRESENT.holdMs) / FRAME_MS);
				slot = CLIPS.close[index];
				part = 'close';
			} else {
				this.reset();
				return false;
			}
			glow = Math.min(1, slot.lift / FULL_LIFT);
		}
		this.openSlot = a.kind !== 'open' ? -1 : part === 'open' ? index : CLIPS.open.length;
		if (!frameReady(slot.show, this.variant)) {
			// its pictures went missing (never expected): the still picture, nothing held up
			this.reset();
			return false;
		}
		// follow the symbol (the road's motion, the win pulse's scale, the dim, a hidden cell)
		const r = this.root;
		r.visible = sprite.visible;
		r.position.copyFrom(sprite.position);
		r.rotation = sprite.rotation;
		r.scale.set(baseScale > 0 ? sprite.scale.x / baseScale : 1);
		r.tint = sprite.tint;
		sprite.renderable = false;
		if (slot.show !== this.shownTag) this.showFrame(slot.show);
		this.drawLight(FRAMES[slot.show], glow, fxMs, a.kind === 'peek');
		if (STAGING_TOOLS && now !== this.tracedAt) {
			// one row per board clock step (the ticker also calls with the clock frozen)
			this.tracedAt = now;
			trace.push({ t: Math.round(now * 10) / 10, cell: this.cell, variant: this.variant, kind: a.kind, part, slot: index, src: slot.src, show: slot.show, lift: slot.lift, pitch: slot.pitch, glow: Math.round(glow * 1000) / 1000 });
			if (trace.length > 4000) trace.splice(0, trace.length - 4000);
		}
		return true;
	}

	private showFrame(tag: string) {
		const f = FRAMES[tag];
		this.shownTag = tag;
		const v = this.variant;
		this.back.texture = f.back[0] ? (piece(f.back[0], v) ?? PIXI.Texture.EMPTY) : PIXI.Texture.EMPTY;
		this.back.visible = !!f.back[0];
		this.front.forEach((s, i) => {
			const name = f.front[i];
			s.texture = name ? (piece(name, v) ?? PIXI.Texture.EMPTY) : PIXI.Texture.EMPTY;
			s.visible = !!name;
		});
		for (const n of [...f.back, ...f.front]) this.hold(keyOf(groupOf(n), v));
		this.fill.visible = f.inside;
		if (f.inside) this.fill.context = fillFor(tag, v);
	}

	private drawLight(f: FrameSpec, glow: number, ms: number, peek: boolean) {
		const on = glow > 0.001;
		// the fill: at the light's level where the frame carries its inside; solid where it does not (the light there is
		// always full, presentSpec light.fullLift)
		this.fill.alpha = f.back.length ? glow : 1;
		this.glow.visible = on;
		this.starLayer.visible = on && (!peek || PRESENT.peek.stars > 0);
		if (!on) return;
		const o = f.opening;
		const rayTex = piece('ray', this.variant);
		const glowTex = piece('glow', this.variant);
		const starTex = piece('star', this.variant);
		// the bloom over the mouth of the box
		if (glowTex) {
			this.bloom.texture = glowTex;
			this.bloom.position.set(o.cx, o.cy - o.hh * 0.6);
			this.bloom.width = o.hw * 2.8;
			this.bloom.height = o.hh * 6.4;
			this.bloom.alpha = PRESENT.light.bloom * glow;
		}
		// the shine rays fanning up out of the opening
		const L = RAY_ROAD * (0.55 + 0.45 * glow) * (peek ? PRESENT.peek.rayLength : 1);
		const n = this.rays.length;
		const rayRoad = rayTex ? rayTex.height / T.rayDensity : RAY_ROAD;
		this.rays.forEach((s, i) => {
			if (!rayTex) return (s.visible = false);
			s.visible = true;
			s.texture = rayTex;
			const u = i / (n - 1) - 0.5;
			const ang = -Math.PI / 2 + u * 2.1 + Math.sin(ms / 700 + i * 1.7) * 0.035;
			const w = (i % 2 ? 0.05 : 0.085) * (1 + 0.25 * Math.sin(ms / 260 + i));
			const sy = (L / rayRoad) / T.rayDensity;
			s.scale.set((sy * Math.tan(w)) / Math.tan(0.085), sy);
			s.position.set(o.cx + u * o.hw * 1.1, o.cy + o.hh * 0.2);
			s.rotation = ang + Math.PI / 2;
			s.alpha = glow;
		});
		// the four-point stars bursting out of the opening and drifting up
		const count = peek ? PRESENT.peek.stars : this.stars.length;
		this.stars.forEach((s, i) => {
			const st = STARS[i];
			if (!starTex || i >= count || ms < st.delay) return (s.visible = false);
			const tt = (ms - st.delay) % 1500;
			if (tt > st.life) return (s.visible = false);
			const life = tt / st.life;
			const d = st.speed * (1 - Math.pow(1 - life, 2));
			const alpha = glow * Math.min(1, life * 6) * (1 - Math.pow(life, 2.5));
			if (alpha <= 0.003) return (s.visible = false);
			s.visible = true;
			s.texture = starTex;
			s.position.set(o.cx + st.x0 * o.hw * 1.2 + Math.cos(st.ang) * d, o.cy + Math.sin(st.ang) * d - (30 / PRESENT_ART.sourceDensity) * life);
			const radius = st.size * (0.6 + 0.4 * Math.sin(Math.PI * life));
			s.scale.set((radius / STAR_ROAD) / T.density);
			s.rotation = st.spin * life;
			s.alpha = alpha;
		});
	}
}

/** a trigger's presents: wait for the open's sheets (at most PRESENT.loadWaitMs); false when they did not come */
export const presentsReadyForOpen = async (): Promise<boolean> => {
	// a red book's trigger needs both opens: all its presents play the full open, teal and red alike (Corey's option 1)
	const want = [awaitPresent('open', 'teal', PRESENT.loadWaitMs), ...(redBook ? [awaitPresent('open', 'red', PRESENT.loadWaitMs), awaitPresent('peek', 'red', PRESENT.loadWaitMs)] : [])];
	return (await Promise.all(want)).every(Boolean);
};
