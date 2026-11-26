// THE SECOND COPY LET GO (constants PIXEL_DROP; Corey 2026-11-26, memory fix 1). Pixi 8.8.1 keeps every loaded picture's
// decoded ImageBitmap as the source's `resource` after the picture is on the GPU, for good: two copies of the same pixels.
// Decimus measured 72 such sources holding 236.2 MB at rest on a phone (390 x 844 at density 3), beside their GPU copies.
// The creature's big sheets never had the second copy (game/stripUpload.ts drops its pixels after the last band); this
// does the same for every other picture the game's loaders bring in (start-up, the gate, the deferred phase, the Epic,
// the scenes, the symbols, the plaque, the bar's art): once a source is on the GPU its bitmap is closed and the source
// keeps only a stand-in of the same size.
//
// HOW (all of it here, no change to Pixi or the shared packages): the renderer's 'image' uploader is wrapped, so every
// upload of a picture, whenever Pixi makes it (a prepare.upload, or the first draw of a texture nobody uploaded ahead),
// queues that source. A frame after the upload (the mip chain Pixi builds right after the upload is built by then) the
// source is let go if all of this holds:
//   - its resource is an ImageBitmap (a canvas, a text, a typed array or a video is never touched: they are redrawn)
//   - it came from Pixi's loader (it has the file's address in `label`, so its pixels can be fetched again)
//   - its file is not in PIXEL_DROP.keep (pixels the game reads on the CPU: the logo frame, the plaque atlas)
//   - its GPU copy exists and is the source's full size
// Then: autoGarbageCollect off (Pixi's texture GC would free the GPU copy after a long idle and upload again from the
// resource, which is gone), the bitmap closed, the resource replaced by { width, height }, and its upload method set to
// 'mmDropped'. That uploader keeps the GPU copy as it is when Pixi asks it again for the same size (a source.update(), a
// mip chain added later by game/mipmaps.ts: Pixi then builds the chain from the copy on the GPU).
//
// WHEN THE GPU COPY IS GONE (a lost WebGL context, an explicit unload): Pixi asks the uploader for a NEW texture. It
// allocates it empty and the picture is fetched again (the same address: the HTTP cache answers), decoded as Pixi's loader
// decodes it, set back as the resource and uploaded; then let go again. After a restored context the pictures come back in
// THE ORDER below (contextRestored): what the stage draws first, then his sheets, then what is mounted but hidden. Until its
// picture is back a texture is blank: the readout's `blank` counts the drawn ones blank NOW, `blankEver` every time. A scene released at a turn of the device keeps its dropped sources on the GPU instead of
// unloading them (game/scene.ts release), so a turn never takes this path.
//
// THE READOUT (DEV and staging builds only, never Stake's: STAGING_TOOLS): `__manticore.memory()` (installed by
// components/Game.svelte) gives the GPU textures (MB and count), the decoded pictures still held (MB, count, names), what
// was dropped, the strip sheets' buffers still alive, and one row per source.
import * as PIXI from 'pixi.js';

import { PIXEL_DROP } from './constants';
import { STAGING_TOOLS } from './staging';
import { decodeSlotState } from './stripUpload';

type GlTex = { texture: WebGLTexture; target: number; internalFormat: number; format: number; type: number; width: number; height: number };
type Uploader = { id: string; upload: (source: PIXI.TextureSource, glTexture: GlTex, gl: WebGL2RenderingContext, webGLVersion: number) => void };
type TexSys = { _uploads: Record<string, Uploader>; _glTextures: Record<number, GlTex | null | undefined>; managedTextures: PIXI.TextureSource[] };
/** what a dropped source keeps in place of its picture: its size (Pixi reads resourceWidth / resourceHeight from it) */
type StandIn = { width: number; height: number; mmDropped: true };

const DROPPED = 'mmDropped';
const isStandIn = (r: unknown): r is StandIn => !!r && (r as StandIn).mmDropped === true;
const isBitmap = (r: unknown): r is ImageBitmap => typeof ImageBitmap !== 'undefined' && r instanceof ImageBitmap;
/** the file's address Pixi's loader gave the source (createTexture: label = _sourceOrigin = the URL it loaded) */
const addressOf = (s: PIXI.TextureSource): string => {
	const origin = (s as unknown as { _sourceOrigin?: unknown })._sourceOrigin;
	return typeof origin === 'string' ? origin : '';
};
const fileOf = (url: string): string => url.split('?')[0].split('#')[0].split('/').pop() ?? '';

/** DEV / staging: `?pixeldrop=0` keeps every bitmap (the measurement's A / B) */
const switchedOff = (): boolean => STAGING_TOOLS && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('pixeldrop') === '0';

const state = {
	sys: null as TexSys | null,
	renderer: null as PIXI.Renderer | null,
	queued: new Set<PIXI.TextureSource>(),
	flushing: false,
	dropped: 0,
	droppedBytes: 0,
	restores: 0,
	/** LIFETIME: times a GPU copy had to be made again while its picture was not there (each drawn blank until restored) */
	blankEver: 0,
	failed: 0,
	contextRestores: 0,
	/** the WebGL context's generation: 0 the first, +1 at every restore (a source's real upload is stamped with it) */
	ctx: 0,
	/** binding-cache entries cleared at the last restore (THE STALE UNITS) */
	staleCleared: 0,
	/** the restore line: the sources waiting, the ones on show first (see restore) */
	waiting: [] as PIXI.TextureSource[],
	restoring: new Set<PIXI.TextureSource>(),
	running: 0,
};
/** how many pictures are fetched and decoded again at one time after a lost context (each is let go a frame after its
 *  upload, so at most this many decoded copies are alive at once) */
const RESTORE_AT_ONCE = 4;

const kept = (s: PIXI.TextureSource): boolean => {
	const file = fileOf(addressOf(s));
	return PIXEL_DROP.keep.some((stem) => file.startsWith(stem));
};

/** the source can let its bitmap go now (see the header) */
const droppable = (s: PIXI.TextureSource): boolean => {
	const sys = state.sys;
	if (!sys || s.destroyed || s.uploadMethodId !== 'image' || !isBitmap(s.resource) || !addressOf(s) || kept(s)) return false;
	const gl = sys._glTextures[s.uid];
	// (its pixels went up on THIS context: the bitmap is closed only once the GPU copy it filled is the live one)
	return !!gl && gl.width === s.pixelWidth && gl.height === s.pixelHeight && (s as unknown as { mmCtx?: number }).mmCtx === state.ctx;
};

const drop = (s: PIXI.TextureSource): void => {
	const bmp = s.resource as ImageBitmap;
	const standIn: StandIn = { width: bmp.width, height: bmp.height, mmDropped: true };
	s.autoGarbageCollect = false;
	s.resource = standIn as unknown as typeof s.resource;
	s.uploadMethodId = DROPPED;
	bmp.close();
	state.dropped += 1;
	state.droppedBytes += standIn.width * standIn.height * 4;
};

const flush = (): void => {
	state.flushing = false;
	for (const s of state.queued) if (droppable(s)) drop(s);
	state.queued.clear();
};
/** one frame after the upload, then after the frame's own work (the render that made the upload is over by then) */
const queue = (s: PIXI.TextureSource): void => {
	state.queued.add(s);
	if (state.flushing) return;
	state.flushing = true;
	requestAnimationFrame(() => setTimeout(flush, 0));
};

/** the picture fetched again and set back as the source's resource, then uploaded (and let go again after).
 *  RESTORE_AT_ONCE at a time; `first`: a source on show now (its GPU copy was just made blank) goes to the head of the line,
 *  so what the player sees comes back before what is not drawn yet */
const restore = (s: PIXI.TextureSource, first = false): void => {
	if (state.restoring.has(s)) {
		if (first) {
			const i = state.waiting.indexOf(s);
			if (i > 0) {
				state.waiting.splice(i, 1);
				state.waiting.unshift(s);
			}
		}
		return;
	}
	state.restoring.add(s);
	if (first) state.waiting.unshift(s);
	else state.waiting.push(s);
	pump();
};
const pump = (): void => {
	while (state.running < RESTORE_AT_ONCE && state.waiting.length) {
		const s = state.waiting.shift()!;
		state.running += 1;
		void restoreOne(s).finally(() => {
			state.running -= 1;
			state.restoring.delete(s);
			pump();
		});
	}
};
const restoreOne = async (s: PIXI.TextureSource): Promise<void> => {
	try {
		if (s.destroyed || !isStandIn(s.resource)) return;
		const res = await fetch(addressOf(s));
		if (!res.ok) throw new Error(String(res.status));
		const blob = await res.blob();
		// (decoded exactly as Pixi's loader decodes it: pixi.js loadTextures loadImageBitmap)
		const bmp = s.alphaMode === 'premultiplied-alpha' ? await createImageBitmap(blob, { premultiplyAlpha: 'none' }) : await createImageBitmap(blob);
		if (s.destroyed || !isStandIn(s.resource)) {
			bmp.close();
			return;
		}
		s.resource = bmp as unknown as typeof s.resource;
		s.uploadMethodId = 'image';
		state.restores += 1;
		// a blank GPU copy made in its place (it is on show) is filled now; a source with no GPU copy at all (after a lost
		// context, one not drawn yet) goes up through the renderer's prepare queue, so its decoded copy does not wait for
		// its next draw. Either way the wrapped uploader then queues the drop again
		if (state.sys?._glTextures[s.uid]) s.update();
		else void (state.renderer as unknown as { prepare?: { upload: (x: unknown) => Promise<void> } } | null)?.prepare?.upload(s);
	} catch {
		state.failed += 1;
	}
};

// THE STALE UNITS (proven on Decimus's lost-context walk, 2026-11-26). Pixi 8.8.1 keeps a cache of which source each
// texture unit holds (GlTextureSystem._boundTextures) and binds a source only when the cache says the unit holds
// another one (GlTextureSystem.mjs line 73). Its contextChange resets that cache by binding Texture.EMPTY to units 0..15
// only (line 49), but the batcher uses up to MAX_TEXTURE_IMAGE_UNITS units (rendering/batcher/gl/utils/
// maxRecommendedTextures.mjs: 32 on many GPUs). A source that sat in unit 16 or above before the loss is still cached
// there: every frame its bind is skipped, nothing is bound to that unit on the new context, and its sprites sample an
// unbound unit, which reads opaque black (Decimus: five symbol idle sheets black over their wells for 4 to 10 s on both
// 43021f91 and e6c2ff16, bound every frame and never uploaded; the SUPER WIN title black on its panel 4.4 s after the
// restore) until the batch happens to give that unit another texture. Not a pixel problem, and older than this file.
// So right after Pixi's own pass (this runner item was added after its systems) every cached unit is forgotten (not set
// to EMPTY: EMPTY is not bound on units 16 and up either), and the active unit too: the next bind of each is real.
const clearStaleUnits = (sys: TexSys): void => {
	const t = sys as unknown as { _boundTextures?: (PIXI.TextureSource | null)[]; _activeTextureLocation?: number };
	const units = t._boundTextures;
	if (!units) return;
	let n = 0;
	for (let i = 0; i < units.length; i += 1) {
		if (units[i] && units[i] !== PIXI.Texture.EMPTY.source) n += 1;
		units[i] = null;
	}
	t._activeTextureLocation = -1;
	state.staleCleared = n;
};

/** the textures every display object on the stage holds, in draw order: the ones drawn now (visible all the way up,
 *  not transparent) and the ones mounted but hidden (a plaque waiting for its win, the night layers by day) */
const stageSources = (): { shown: PIXI.TextureSource[]; hidden: PIXI.TextureSource[] } => {
	const shown = new Set<PIXI.TextureSource>();
	const hidden = new Set<PIXI.TextureSource>();
	const stage = (state.renderer as unknown as { lastObjectRendered?: PIXI.Container } | null)?.lastObjectRendered;
	const walk = (node: PIXI.Container, on: boolean) => {
		const here = on && node.visible && node.alpha > 0 && node.renderable !== false;
		const t = (node as unknown as { texture?: PIXI.Texture }).texture;
		if (t instanceof PIXI.Texture && t.source && !t.source.destroyed) (here ? shown : hidden).add(t.source);
		for (const child of node.children ?? []) walk(child as PIXI.Container, here);
	};
	if (stage) walk(stage, true);
	for (const x of shown) hidden.delete(x);
	return { shown: [...shown], hidden: [...hidden] };
};
/** a source has no pixels on the GPU right now: a dropped picture whose GPU copy is gone or was made blank and not filled
 *  yet, or one of his strip sheets made again empty after a lost context (game/stripUpload.ts `lost`) */
const blankNow = (x: PIXI.TextureSource): boolean => {
	if (x.destroyed) return false;
	const onGpu = !!state.sys?._glTextures[x.uid];
	if (isStandIn(x.resource)) return !onGpu || !!(x as unknown as { mmBlank?: boolean }).mmBlank || (x as unknown as { mmCtx?: number }).mmCtx !== state.ctx;
	if ((x as unknown as { lost?: boolean }).lost) return true;
	const r = x.resource as unknown as { px?: Uint8Array | null } | null;
	return !!r && typeof r === 'object' && 'px' in r && !onGpu && !r.px;
};

/** THE LOST CONTEXT (WebGL context lost, then restored: Pixi has made every GPU copy anew, empty until uploaded). THE
 *  ORDER (Decimus on ca10c3d3: with every dropped picture and his sheets fetched at once, the board's symbol sheets came
 *  back behind them, the board a third black for up to 10 s on a throttled line, where the pictures drawn alone came back
 *  in 0.4 s): first every picture the stage DRAWS now (the board, the bar's canvas art, the frame, the scene, the logo),
 *  RESTORE_AT_ONCE at a time; when those are in (or after BOARD_CAP_MS) the listeners hear it (game/creatureLoad.ts makes
 *  his sheets again: shadow and idle first); then, HIDDEN_AFTER_MS later, the pictures mounted but hidden (a plaque waiting
 *  for its win, the night layers by day). A picture not on the stage at all comes back when it is first drawn, as any
 *  picture drawn blank does: it goes to the head of the line */
const BOARD_CAP_MS = 3000;
const HIDDEN_AFTER_MS = 1500;
const contextListeners: ((boardBack: Promise<void>) => void)[] = [];
/** `fn` hears a restored context, with a promise that resolves once the pictures drawn now are back (THE ORDER) */
export const whenContextRestored = (fn: (boardBack: Promise<void>) => void): void => {
	contextListeners.push(fn);
};
const later = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const contextRestored = (): void => {
	state.contextRestores += 1;
	const { shown, hidden } = stageSources();
	const drawn = shown.filter((x) => isStandIn(x.resource));
	// (in draw order; a picture drawn blank meanwhile still goes to the head)
	for (const x of drawn) restore(x);
	const t0 = performance.now();
	const boardBack = (async () => {
		while (drawn.some((x) => !x.destroyed && isStandIn(x.resource) && state.restoring.has(x)) && performance.now() - t0 < BOARD_CAP_MS) await later(50);
	})();
	for (const fn of contextListeners) {
		try {
			fn(boardBack);
		} catch {
			/* one system's failure does not stop the others */
		}
	}
	void boardBack
		.then(() => later(HIDDEN_AFTER_MS))
		.then(() => {
			for (const x of hidden) if (!x.destroyed && isStandIn(x.resource)) restore(x);
		});
};

/** the upload method of a dropped source: the GPU copy stays as it is; a new one (its old copy gone) is made empty and
 *  the picture is restored */
const droppedUploader: Uploader = {
	id: DROPPED,
	upload(source, glTexture, gl) {
		const w = source.pixelWidth;
		const h = source.pixelHeight;
		if (glTexture.width === w && glTexture.height === h) return;
		gl.texImage2D(gl.TEXTURE_2D, 0, glTexture.internalFormat, w, h, 0, glTexture.format, glTexture.type, null);
		glTexture.width = w;
		glTexture.height = h;
		state.blankEver += 1;
		(source as unknown as { mmBlank?: boolean }).mmBlank = true;
		restore(source, true);
	},
};

/** a dropped source let go of its GPU copy (nothing in the game does that today: a safety net): its picture comes back
 *  at once, so its next upload has it */
const onUnload = (s: PIXI.TextureSource): void => {
	if (isStandIn(s.resource)) restore(s);
};

/** the renderer exists (components/Game.svelte, the boot's clamp): wrap its image uploader and queue what is already up */
export const installPixelDrop = (renderer: PIXI.Renderer | undefined): void => {
	if (state.sys || !renderer) return;
	const sys = (renderer as unknown as { texture?: TexSys }).texture;
	// (WebGL only: a WebGPU renderer has no _uploads; the house renderer is 'webgl', rule R4)
	if (!sys?._uploads?.image) return;
	state.sys = sys;
	state.renderer = renderer;
	if (STAGING_TOOLS) installReadout(renderer, sys);
	// THE LOST CONTEXT: Pixi's own systems hear a restored context on this runner first (they were added before), then this
	// (a task later: every system has its new context by then)
	(renderer as unknown as { runners: { contextChange: { add: (item: unknown) => void } } }).runners.contextChange.add({
		contextChange: () => {
			state.ctx += 1;
			clearStaleUnits(sys);
			setTimeout(contextRestored, 0);
		},
	});
	if (!PIXEL_DROP.on || switchedOff()) return;
	const image = sys._uploads.image;
	sys._uploads.image = {
		id: 'image',
		upload(source, glTexture, gl, webGLVersion) {
			image.upload(source, glTexture, gl, webGLVersion);
			// (an upload into a lost context does nothing: the source keeps its picture and is not stamped)
			if (gl.isContextLost()) return;
			(source as unknown as { mmBlank?: boolean }).mmBlank = false;
			if (isBitmap(source.resource)) {
				(source as unknown as { mmCtx?: number }).mmCtx = state.ctx;
				if (!(source as unknown as { mmUnloadHooked?: boolean }).mmUnloadHooked) {
					(source as unknown as { mmUnloadHooked?: boolean }).mmUnloadHooked = true;
					(source as unknown as { on: (event: string, fn: (s: PIXI.TextureSource) => void) => void }).on('unload', onUnload);
				}
				queue(source);
			}
		},
	};
	sys._uploads[DROPPED] = droppedUploader;
	// (what went up before this was installed went up on this first context: stamped so it can be let go too)
	for (const s of sys.managedTextures)
		if (isBitmap(s.resource)) {
			if (sys._glTextures[s.uid]) (s as unknown as { mmCtx?: number }).mmCtx = state.ctx;
			queue(s);
		}
};

/** the source's pixels were let go (game/scene.ts release keeps such a source on the GPU) */
export const pixelsDropped = (s: PIXI.TextureSource): boolean => isStandIn(s.resource);

// ---- THE READOUT (DEV and staging only) -------------------------------------------------------------------------------
const MB = 1024 * 1024;
const round1 = (n: number) => Math.round(n * 10) / 10;
type Row = { name: string; size: string; mb: number; onGpu: boolean; pixels: string; mip: boolean };
const installReadout = (renderer: PIXI.Renderer, sys: TexSys): void => {
	if (typeof window === 'undefined') return;
	const readout = () => {
		const seen = new Map<number, PIXI.TextureSource>();
		for (const s of sys.managedTextures) seen.set(s.uid, s);
		// (Pixi's cache too: a picture loaded but never drawn is decoded and not on the GPU)
		const cache = (PIXI.Cache as unknown as { _cache?: Map<string, unknown> })._cache;
		if (cache)
			for (const v of cache.values()) {
				const list: unknown[] = v instanceof PIXI.Texture ? [v] : v && typeof v === 'object' && 'textures' in (v as object) ? Object.values((v as { textures: Record<string, unknown> }).textures ?? {}) : [];
				for (const t of list) if (t instanceof PIXI.Texture && t.source && !t.source.destroyed) seen.set(t.source.uid, t.source);
			}
		const rows: Row[] = [];
		const gpu = { mb: 0, count: 0 };
		const decoded = { mb: 0, count: 0, names: [] as string[] };
		const dropped = { mb: 0, count: 0 };
		const strips = { mb: 0, count: 0, lost: 0, lostNames: [] as string[] };
		for (const s of seen.values()) {
			const r = s.resource as unknown;
			const onGpu = !!sys._glTextures[s.uid];
			const mip = s.autoGenerateMipmaps && s.mipLevelCount > 1;
			const bytes = s.pixelWidth * s.pixelHeight * 4;
			const gpuMb = (bytes * (mip ? 4 / 3 : 1)) / MB;
			const px = (r as { px?: Uint8Array | null } | null)?.px;
			const pixels = isStandIn(r) ? 'dropped' : isBitmap(r) ? 'ImageBitmap' : px ? 'stripBuffer' : r && typeof r === 'object' && 'px' in (r as object) ? 'stripsDone' : (r?.constructor?.name ?? 'none');
			if (onGpu) {
				gpu.mb += gpuMb;
				gpu.count += 1;
			}
			const name = s.label || addressOf(s) || `uid ${s.uid}`;
			// (a creature strip sheet whose GPU copy went with a lost context and is not made again yet: drawn empty)
			if ((s as unknown as { lost?: boolean }).lost && onGpu) {
				strips.lost += 1;
				strips.lostNames.push(fileOf(name));
			}
			if (pixels === 'ImageBitmap') {
				decoded.mb += bytes / MB;
				decoded.count += 1;
				decoded.names.push(`${fileOf(name) || name} ${round1(bytes / MB)}`);
			} else if (pixels === 'dropped') {
				dropped.mb += bytes / MB;
				dropped.count += 1;
			} else if (pixels === 'stripBuffer') {
				strips.mb += (px?.byteLength ?? 0) / MB;
				strips.count += 1;
			}
			rows.push({ name, size: `${s.pixelWidth}x${s.pixelHeight}`, mb: round1(gpuMb), onGpu, pixels, mip });
		}
		rows.sort((a, b) => b.mb - a.mb);
		return {
			kind: 'MM_MEMORY_READOUT',
			at: performance.now(),
			on: PIXEL_DROP.on && !switchedOff(),
			resolution: renderer.resolution,
			gpu: { mb: round1(gpu.mb), count: gpu.count },
			decoded: { mb: round1(decoded.mb), count: decoded.count, names: decoded.names },
			dropped: { mb: round1(dropped.mb), count: dropped.count, total: state.dropped, totalMb: round1(state.droppedBytes / MB) },
			// (the creature's strip sheets: buffers of sheets on the GPU with bands still to go, and the decode slots, which
			// also count a sheet decoded and not yet started on the GPU)
			strips: { mb: round1(strips.mb), count: strips.count, lost: strips.lost, lostNames: strips.lostNames, slots: decodeSlotState() },
			restores: state.restores,
			// NOW: sources with a GPU copy and no pixels in it, waiting for their picture (0 = nothing drawn blank); the
			// creature's strip sheets made again after a lost context are in `strips.lost`
			// NOW, true to the screen: the sources the stage draws (visible all the way up) with no pixels on the GPU right
			// now (a dropped picture not back yet, his strip sheets made again empty), atlases and mipmapped sheets alike;
			// `blankHidden` the same for what is mounted but hidden
			...(() => {
				const { shown, hidden } = stageSources();
				const b = shown.filter(blankNow);
				const h = hidden.filter(blankNow);
				return { blank: b.length, blankNames: b.map((x) => fileOf(x.label || addressOf(x)) || `uid ${x.uid}`), blankHidden: h.length, blankHiddenNames: h.map((x) => fileOf(x.label || addressOf(x)) || `uid ${x.uid}`) };
			})(),
			/** LIFETIME: how many times a GPU copy was made blank (each then restored) */
			blankEver: state.blankEver,
			restoring: state.restoring.size,
			contextRestores: state.contextRestores,
			context: state.ctx,
			/** THE STALE UNITS: units the binding cache said were holding a source at the last restore (all forgotten then),
			 *  and units it says hold a source with no GL texture now (should be 0: that unit draws black) */
			staleCleared: state.staleCleared,
			staleUnits: ((sys as unknown as { _boundTextures?: (PIXI.TextureSource | null)[] })._boundTextures ?? []).filter((x) => !!x && !x.destroyed && x !== PIXI.Texture.EMPTY.source && !sys._glTextures[x.uid]).length,
			restoreFailed: state.failed,
			rows,
		};
	};
	((window as unknown as { __manticore?: Record<string, unknown> }).__manticore ??= {}).memory = readout;
};
