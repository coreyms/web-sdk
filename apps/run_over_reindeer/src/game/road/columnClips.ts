// THE COLUMN CHARACTERS' PICTURES, loaded only when a book calls for them (tools/build_columns.py made the sheets).
//
// Nine clips (entrance, idle, win for the reindeer, Santa and Grandma) are far too much to hold at once, so:
//   - a clip is fetched and decoded the first time something asks for it (the book's own events are scanned the
//     moment the book arrives, game/utils.ts, so the pictures are usually in before the strike reaches its target);
//   - the entrance is let go as soon as it has played;
//   - idle and win are let go when no column of that tier is left on the board.
// Each sheet is at most 2048 px on a side and is handed to the GPU one at a time before it is first drawn, so no
// frame of play pays for a big upload. Never a blob: URL and never a worker (the platform's policy has no blob:).
import * as PIXI from 'pixi.js';

import { COLUMN_CLIPS } from '../columnClipSpec';
import { stamp } from '../assets';
import { PHONE_TIER, forcedResolutionCap } from '../deviceTier';
import { STAGING_TOOLS, perfMark } from '../staging';
import type { ColumnTier } from '../typesBookEvent';

export type ClipName = 'reveal' | 'idle' | 'win';
export type Clip = {
	textures: PIXI.Texture[];
	fps: number;
	loop: boolean;
	/** where a frame sits, road px from the column's top left corner */
	x: number;
	y: number;
	width: number;
	height: number;
	/** entrance only: how many of its first frames still have the cloud in the box */
	cloudFrames: number;
};

// ---- WHICH SHEETS: THE DENSITY ---------------------------------------------------------------------------------------
// tools/build_columns.py builds every clip at four densities, sheet px per road px: phone 0.7, full 1.0, d150 1.5 and
// d215 2.15. A normal load takes the device tier's own (phone or full), as it always has. The staging switch
// `?rescap=<n>` (game/deviceTier.ts: DEV or a PUBLIC_STAGING=1 build, held to 1 .. 3, nothing in a production build)
// asks for the smallest density that gives at least n sheet px per CSS px at the road's on-screen scale, capped at
// the largest one built, and one step lower for each density whose pages are wider than the GPU's largest texture.
// The pick is made ONCE, the first time a column's picture is asked for (the board is laid out by then), and kept for
// the session, like the device tier: a reload after a rotation picks again (docs/COLUMN_DENSITY_TEST.md).
type Size = keyof typeof COLUMN_CLIPS.tierScale;
const DEFAULT_SIZE: Size = PHONE_TIER ? 'phone' : 'full';

/** set by components/Board.svelte: CSS px per road px now, and the GPU's largest texture side (0 = not known) */
type ClipView = { cssPerRoad: number; maxTextureSize: number };
let view: (() => ClipView) | null = null;
export const setClipView = (fn: typeof view) => {
	view = fn;
};

// (the field is `cap`, never the switch's own name: scripts/check-production-bundle.mjs looks for that word in a
// production bundle, and this pick is in every build)
type Pick = { size: Size; cap: number | null; cssPerRoad: number | null; maxTextureSize: number | null; note: string | null };
let picked: Pick | null = null;

/** the widest page side of a density (every clip's sheets and the cloud still) */
const largestPage = (size: Size): number => {
	let most = Math.max(COLUMN_CLIPS.backdrop.tiers[size].width, COLUMN_CLIPS.backdrop.tiers[size].height);
	for (const clips of Object.values(COLUMN_CLIPS.clips)) for (const clip of Object.values(clips)) for (const s of clip.tiers[size].sheets) most = Math.max(most, s.width, s.height);
	return most;
};

const pickSize = (): Pick => {
	if (picked) return picked;
	const cap = forcedResolutionCap();
	if (cap === null) return (picked = { size: DEFAULT_SIZE, cap: null, cssPerRoad: null, maxTextureSize: null, note: null });
	const v = view?.();
	if (!v || !(v.cssPerRoad > 0)) return (picked = { size: DEFAULT_SIZE, cap, cssPerRoad: null, maxTextureSize: null, note: 'the board was not laid out yet: the device default' });
	const sizes = (Object.keys(COLUMN_CLIPS.tierScale) as Size[]).sort((a, b) => COLUMN_CLIPS.tierScale[a] - COLUMN_CLIPS.tierScale[b]);
	// n sheet px per CSS px = density / cssPerRoad, so the density wanted is n x cssPerRoad
	let i = sizes.findIndex((s) => COLUMN_CLIPS.tierScale[s] >= cap * v.cssPerRoad);
	let note: string | null = i < 0 ? `wanted ${(cap * v.cssPerRoad).toFixed(2)} px per road px; the largest built is taken` : null;
	if (i < 0) i = sizes.length - 1;
	const limit = v.maxTextureSize;
	while (limit > 0 && i > 0 && largestPage(sizes[i]) > limit) {
		note = `${sizes[i]} has ${largestPage(sizes[i])} px pages, over this GPU's ${limit}: one step down`;
		i--;
	}
	return (picked = { size: sizes[i], cap, cssPerRoad: v.cssPerRoad, maxTextureSize: limit || null, note });
};

const key = (tier: ColumnTier, clip: ClipName) => `${tier}:${clip}`;

type Entry = { clip: Clip | null; loading: Promise<Clip | null> | null; sources: PIXI.TextureSource[]; urls: string[] };
const entries = new Map<string, Entry>();

/** set by components/Board.svelte: hands a texture to the GPU now (renderer.prepare), so its first draw costs nothing */
let uploader: ((texture: PIXI.Texture) => Promise<unknown>) | null = null;
export const setClipUploader = (fn: typeof uploader) => {
	uploader = fn;
};

/** a clip being let go: a new load of the same clip waits for it (loading a sheet while it is being unloaded would
 *  hand back a picture that is destroyed a moment later) */
const letting = new Map<string, Promise<void>>();

const loadOne = async (tier: ColumnTier, name: ClipName, entry: Entry): Promise<Clip | null> => {
	await letting.get(key(tier, name));
	const spec = COLUMN_CLIPS.clips[tier][name];
	const tierSpec = spec.tiers[pickSize().size];
	const textures: PIXI.Texture[] = [];
	try {
		for (const sheet of tierSpec.sheets) {
			const url = stamp(`/assets/${sheet.file}`);
			const base = (await PIXI.Assets.load(url)) as PIXI.Texture;
			entry.urls.push(url);
			entry.sources.push(base.source);
			if (uploader) await uploader(base);
			for (let i = 0; i < sheet.frames; i++) {
				const fx = (i % tierSpec.columns) * (tierSpec.frameWidth + tierSpec.gap);
				const fy = Math.floor(i / tierSpec.columns) * (tierSpec.frameHeight + tierSpec.gap);
				textures.push(new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(fx, fy, tierSpec.frameWidth, tierSpec.frameHeight) }));
			}
		}
	} catch (error) {
		// a clip that will not load must never wedge a round: the column then stands as its box and its number
		console.warn('[reindeer] column clip failed to load', tier, name, error);
		return null;
	}
	// the staging readout's label (game/staging.ts): a long frame here is this clip's upload
	if (STAGING_TOOLS) perfMark(`load:${tier}:${name}`);
	return { textures, fps: spec.fps, loop: spec.loop, x: spec.x, y: spec.y, width: spec.width, height: spec.height, cloudFrames: 'cloudFrames' in spec ? spec.cloudFrames : 0 };
};

/** start loading a clip (or join the load already running); resolves with it, or null if it failed */
export const loadClip = (tier: ColumnTier, name: ClipName): Promise<Clip | null> => {
	const k = key(tier, name);
	let entry = entries.get(k);
	if (!entry) {
		entry = { clip: null, loading: null, sources: [], urls: [] };
		entries.set(k, entry);
	}
	if (entry.clip) return Promise.resolve(entry.clip);
	if (entry.loading) return entry.loading;
	const e = entry;
	const loading = loadOne(tier, name, e).then(async (clip) => {
		// let go while it was loading: its pictures go again, and whoever asks next loads it fresh
		if (entries.get(k) !== e) {
			e.clip = clip;
			await letGo(k, e);
			return null;
		}
		e.clip = clip;
		e.loading = null;
		if (!clip) entries.delete(k);
		return clip;
	});
	e.loading = loading;
	return loading;
};

/** the clip if it is in, else null (never waits) */
export const getClip = (tier: ColumnTier, name: ClipName): Clip | null => entries.get(key(tier, name))?.clip ?? null;

const release = async (entry: Entry) => {
	for (const t of entry.clip?.textures ?? []) t.destroy(false);
	for (const url of entry.urls) {
		try {
			await PIXI.Assets.unload(url);
		} catch {
			/* already gone */
		}
	}
	entry.clip = null;
};

const letGo = (k: string, entry: Entry): Promise<void> => {
	const before = letting.get(k) ?? Promise.resolve();
	const p = before.then(() => release(entry)).finally(() => {
		if (letting.get(k) === p) letting.delete(k);
	});
	letting.set(k, p);
	return p;
};

/** let a clip's pictures go (GPU and decoded copies both). Nothing may still be drawing them. */
export const releaseClip = (tier: ColumnTier, name: ClipName) => {
	const k = key(tier, name);
	const entry = entries.get(k);
	if (!entry) return;
	entries.delete(k);
	// one still loading lets itself go when its load lands (loadClip)
	if (!entry.loading) void letGo(k, entry);
};

// ---- THE CLOUD BEHIND A STANDING COLUMN ---------------------------------------------------------------------------------
// One small still (250 x 684 on desktop, 175 x 479 on phones; the `?rescap=` densities 375 x 1026 and 538 x 1471)
// shared by all three tiers, at the density the clips use. It is fetched the first time
// a book calls for any column and then kept for the session: it is a fraction of a MB and a resumed round needs it at
// once.
let backdrop: PIXI.Texture | null = null;
let backdropLoading: Promise<PIXI.Texture | null> | null = null;
export const getBackdrop = (): PIXI.Texture | null => backdrop;
export const loadBackdrop = (): Promise<PIXI.Texture | null> => {
	if (backdrop) return Promise.resolve(backdrop);
	backdropLoading ??= (async () => {
		try {
			const texture = (await PIXI.Assets.load(stamp(`/assets/${COLUMN_CLIPS.backdrop.tiers[pickSize().size].file}`))) as PIXI.Texture;
			if (uploader) await uploader(texture);
			backdrop = texture;
			return texture;
		} catch (error) {
			// without it a column stands on the road as it did before: never a reason to stop a round
			console.warn('[reindeer] column cloud backdrop failed to load', error);
			backdropLoading = null;
			return null;
		}
	})();
	return backdropLoading;
};

/** the tiers the book being played calls for: their idle and win stay loaded for the whole book */
let wanted = new Set<ColumnTier>();
export const isWanted = (tier: ColumnTier) => wanted.has(tier);
/** set by the road's features: is a column of this tier standing now? */
let standing: (tier: ColumnTier) => boolean = () => false;
export const setStandingProbe = (fn: typeof standing) => {
	standing = fn;
};

/** what is loaded now and what it weighs on the GPU, MB (dev hook and the memory numbers in the docs) */
export const clipMemory = () => {
	const rows: { clip: string; mb: number }[] = [];
	let total = 0;
	for (const [k, entry] of entries) {
		if (!entry.clip) continue;
		const mb = entry.sources.reduce((n, s) => n + (s.pixelWidth * s.pixelHeight * 4) / 1048576, 0);
		rows.push({ clip: k, mb: Math.round(mb * 10) / 10 });
		total += mb;
	}
	if (backdrop) {
		const mb = (backdrop.source.pixelWidth * backdrop.source.pixelHeight * 4) / 1048576;
		rows.push({ clip: 'backdrop', mb: Math.round(mb * 100) / 100 });
		total += mb;
	}
	// before the first column the pick is not made yet: say what it would be, without fixing it
	const p = picked ?? { size: DEFAULT_SIZE, cap: forcedResolutionCap(), cssPerRoad: null, maxTextureSize: null, note: 'not picked yet (no column asked for its pictures)' };
	const cssPerRoad = p.cssPerRoad ?? view?.().cssPerRoad ?? null;
	const density = COLUMN_CLIPS.tierScale[p.size];
	return {
		size: p.size,
		/** `?rescap=` in force (null: none, the device tier's default). Only in a staging build or the dev server: the
		 *  bundle check fails a production build that carries the word. */
		...(STAGING_TOOLS ? { rescap: p.cap } : {}),
		/** sheet px per road px */
		density,
		/** sheet px per CSS px at the scale the pick was made for (or the board's scale now, before a pick) */
		sheetPxPerCss: cssPerRoad ? Math.round((density / cssPerRoad) * 100) / 100 : null,
		cssPerRoad: cssPerRoad === null ? null : Math.round(cssPerRoad * 1000) / 1000,
		maxTextureSize: p.maxTextureSize,
		note: p.note,
		clips: rows,
		totalMb: Math.round(total * 10) / 10,
	};
};

/** every tier a book's events call for (scanned when the book arrives): its pictures start loading now, and the
 *  tiers the book before wanted that this one does not, and that no column still stands in, are let go */
export const preloadForEvents = (events: readonly { type: string }[]) => {
	const tiers = new Set<ColumnTier>();
	for (const event of events as readonly { type: string; tier?: ColumnTier; held?: { tier: ColumnTier }[] }[]) {
		if (event.type === 'columnWild' && event.tier) tiers.add(event.tier);
		if (event.type === 'reveal') for (const h of event.held ?? []) tiers.add(h.tier);
	}
	wanted = tiers;
	for (const k of [...entries.keys()]) {
		const [tier, name] = k.split(':') as [ColumnTier, ClipName];
		if (!tiers.has(tier) && !standing(tier)) releaseClip(tier, name);
	}
	if (tiers.size) void loadBackdrop();
	for (const tier of tiers) {
		void loadClip(tier, 'reveal');
		void loadClip(tier, 'idle');
		void loadClip(tier, 'win');
	}
	return [...tiers];
};
