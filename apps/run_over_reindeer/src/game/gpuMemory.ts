// THE DECODED COPY (constants GPU_MEMORY.releaseDecoded, move 1 of Desktop/Run Over Reindeer/gpu_memory_research_2026-11-20).
//
// FACT (Pixi 8.8.1, assets/loader/parsers/textures/loadTextures.mjs): every picture the loader brings in is decoded into
// an ImageBitmap that stays in `source.resource` for the whole session, next to its GPU texture, so each picture is held
// twice (about 200 MB on a 2x desktop, 61 MB on an A15 class phone, research section 1d). Pixi keeps it only to upload
// again: after a texture GC unload, after a WebGL context loss, or when something calls `source.update()`.
//
// So, once a picture is on the GPU (its GL texture holds the full upload), its ImageBitmap is closed. The GPU texture is
// the same upload, mips are built on the GPU from level 0, so no drawn pixel changes and no frame does more work.
//
// EVERY WAY PIXI COULD READ THE CLOSED COPY AGAIN, and what happens:
//   - an upload of a released picture (Pixi's image uploader, wrapped here: the one place WebGL reads `resource`):
//       its GL texture already holds this very picture (a `source.update()`, a mip chain switched on late,
//       game/mipmaps.ts): the upload is skipped and the texture keeps its pixels (they are the same pixels);
//       its GL texture is new (after a context restore, or after `source.unload()`): it gets clear storage at its size
//       and the picture is fetched again by its own URL and sent up the moment it lands;
//   - a WebGL CONTEXT LOSS: every released picture starts its fetch at once (the HTTP cache: assets are `?v=` stamped
//       and immutable), and once the context is back the renderer draws nothing until each is decoded and on the GPU
//       again (at most GPU_MEMORY.restoreGateMaxMs). The screen is already blank through a loss; nothing is drawn blank;
//   - `source.unload()` (the first board's sheet at the first spin; the texture GC, which is turned off for a released
//       picture: autoGarbageCollect false): its decoded copy is fetched again at once, so a later draw has it;
//   - a game read of the picture's own pixels (`source.resource` drawn into a 2D canvas: the scoreboard art, the LED
//       art and Wild pictures, the logo's foot): those pictures are held (holdDecoded) and never released.
// Left alone: canvases (Text, the LED faces, every CanvasSource), video, compressed and generated (render) textures, and
// any picture that is not an ImageBitmap (the loader's HTMLImageElement path, which Pixi turns into a canvas anyway).
// Never a blob: or object URL: the fetch is the asset's normal URL, the Blob is decoded in memory (createImageBitmap).
import * as PIXI from 'pixi.js';

import { GPU_MEMORY } from './constants';

type GlTex = { width: number; height: number; target: number; internalFormat: number; format: number; type: number };
type Upload = { id: string; upload: (source: PIXI.TextureSource, glTexture: GlTex, gl: WebGL2RenderingContext, webGLVersion: number) => void };
/** the parts of Pixi 8.8.1's GlTextureSystem read here (rendering/renderers/gl/texture/GlTextureSystem.mjs) */
type GlTextureSystem = {
	_glTextures?: Record<number, GlTex | null>;
	_uploads?: Record<string, Upload>;
	managedTextures?: PIXI.TextureSource[];
	initSource: (source: PIXI.TextureSource) => void;
};
type Rec = {
	url: string;
	/** createImageBitmap option the loader used (premultiplyAlpha 'none' only for a 'premultiplied-alpha' asset) */
	premultNone: boolean;
	/** a fresh copy on its way (fetch and decode) */
	refetch: Promise<ImageBitmap | null> | null;
	/** the GL texture was given clear storage while the copy was away (sent up for real when it lands) */
	placeholder: boolean;
	/** let go for good (unloadForGood): an unload brings no copy back */
	final: boolean;
	off: () => void;
};

const released = new Map<PIXI.TextureSource, Rec>();
/** pictures whose decoded copy the game reads itself: never released (a count per source) */
const held = new Map<PIXI.TextureSource, number>();

const stats = {
	/** decoded copies closed in all, and their pixels (w x h x 4, MB) */
	released: 0,
	releasedMb: 0,
	/** copies fetched and decoded again (context restore, unload, a draw that found it away) */
	revived: 0,
	/** uploads skipped because the GL texture already held that very picture */
	keptUploads: 0,
	/** GL textures given clear storage while their copy was away; of those, while the drawing was not held (a frame may
	 *  have drawn it clear: a failure outside a context loss) */
	placeholders: 0,
	placeholdersShown: 0,
	refetchFailed: 0,
	contextLost: 0,
	contextRestored: 0,
	/** frames the renderer did not draw while a restore was under way */
	framesHeld: 0,
	lastRestore: null as null | { sources: number; ms: number; failed: number; timedOut: boolean },
	/** stencil asked for while the context has none (a mask: GPU_MEMORY.noDepthStencil must then be off) */
	stencilAsks: 0,
};

let renderer: PIXI.Renderer | null = null;
let installed = false;
/** the drawing is held (a context loss with released pictures, until they are back) */
let gate = { on: false, since: 0 };

const sys = (): GlTextureSystem | null => (renderer ? (renderer.texture as unknown as GlTextureSystem) : null);
const lost = (): boolean => {
	const gl = (renderer as unknown as { gl?: WebGLRenderingContext } | null)?.gl;
	return !gl || gl.isContextLost();
};
const mb = (s: PIXI.TextureSource) => (s.pixelWidth * s.pixelHeight * 4) / 1048576;
const urlOf = (s: PIXI.TextureSource): string | null => {
	const u = (s as unknown as { _sourceOrigin?: string })._sourceOrigin ?? s.label;
	if (typeof u !== 'string' || !u || u.startsWith('blob:') || u.startsWith('data:')) return null;
	return u;
};
const isBitmap = (r: unknown): r is ImageBitmap => typeof ImageBitmap !== 'undefined' && r instanceof ImageBitmap;

/** a picture whose decoded copy the game reads itself stays decoded while held; returns the let-go (call it once the
 *  read is done, or never) */
export const holdDecoded = (source: PIXI.TextureSource | null | undefined): (() => void) => {
	if (!source || source.destroyed) return () => {};
	if (!held.has(source)) source.once('destroy', () => held.delete(source));
	held.set(source, (held.get(source) ?? 0) + 1);
	// (held after it was released: its copy comes back now)
	const rec = released.get(source);
	if (rec) void revive(source, rec, false);
	let done = false;
	return () => {
		if (done) return;
		done = true;
		const n = (held.get(source) ?? 1) - 1;
		if (n <= 0) held.delete(source);
		else held.set(source, n);
	};
};

const fetchBitmap = async (rec: Rec): Promise<ImageBitmap | null> => {
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const response = await fetch(rec.url);
			if (!response.ok) throw new Error(`${response.status}`);
			const blob = await response.blob();
			return await (rec.premultNone ? createImageBitmap(blob, { premultiplyAlpha: 'none' }) : createImageBitmap(blob));
		} catch {
			await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
		}
	}
	stats.refetchFailed += 1;
	return null;
};

/** the decoded copy comes back: `source.resource` is a fresh bitmap again and the source is an ordinary one (the sweep
 *  releases it again once it is on the GPU). `upload`: send it up now (a context restore); otherwise only a texture
 *  given clear storage meanwhile is sent up. */
const revive = async (source: PIXI.TextureSource, rec: Rec, upload: boolean): Promise<boolean> => {
	rec.refetch ??= fetchBitmap(rec);
	const bitmap = await rec.refetch;
	rec.refetch = null;
	if (released.get(source) !== rec) {
		// (revived by someone else meanwhile, or destroyed)
		if (bitmap && source.resource !== bitmap) bitmap.close();
		return !!bitmap;
	}
	if (!bitmap) return false;
	if (source.destroyed) {
		bitmap.close();
		return false;
	}
	released.delete(source);
	rec.off();
	source.resource = bitmap;
	stats.revived += 1;
	const s = sys();
	if (!s || lost()) return true;
	try {
		if (rec.placeholder || (upload && s._glTextures?.[source.uid])) source.update();
		else if (upload) s.initSource(source);
	} catch {
		/* it uploads on its first draw instead */
	}
	return true;
};

/** the picture is on the GPU with its full upload, and nothing reads its decoded copy: close it */
const release = (source: PIXI.TextureSource): boolean => {
	const url = urlOf(source);
	const bitmap = source.resource;
	if (!url || !isBitmap(bitmap)) return false;
	const rec: Rec = { url, premultNone: source.alphaMode === 'premultiplied-alpha', refetch: null, placeholder: false, final: false, off: () => {} };
	const onUnload = () => {
		// its GL texture is gone: the copy comes back now, so a later draw has it
		if (released.get(source) === rec && !rec.final) void revive(source, rec, false);
	};
	const onDestroy = () => {
		released.delete(source);
		rec.off();
	};
	source.on('unload', onUnload);
	source.once('destroy', onDestroy);
	rec.off = () => {
		source.off('unload', onUnload);
		source.off('destroy', onDestroy);
	};
	// the texture GC would unload it after its idle limit (components/Game.svelte, about 30 min) and send it up again on
	// its next draw: a released picture stays on the GPU instead (in a normal session the GC frees nothing anyway)
	source.autoGarbageCollect = false;
	bitmap.close();
	released.set(source, rec);
	stats.released += 1;
	stats.releasedMb += mb(source);
	return true;
};

/** a picture the game lets go of for good with `source.unload()` (its frames destroyed, never drawn again: the first
 *  board's sheet at the first spin): unloaded at once as before, and its copy is not fetched back (a draw after it would
 *  still get it back, through the uploader's guard) */
export const unloadForGood = (source: PIXI.TextureSource | null | undefined) => {
	if (!source) return;
	const rec = released.get(source);
	if (rec) rec.final = true;
	source.unload();
};

/** once in a while after a frame's render: every picture now on the GPU with its full upload gives up its copy (a few
 *  a pass at most: a close is cheap, and the first passes after the preload find dozens) */
let frames = 0;
const SWEEP_EVERY = 10;
const PER_SWEEP = 4;
const sweep = () => {
	if (!GPU_MEMORY.releaseDecoded || gate.on || ++frames % SWEEP_EVERY !== 0) return;
	const s = sys();
	if (!s?.managedTextures || !s._glTextures || lost()) return;
	let n = 0;
	for (const source of s.managedTextures) {
		if (source.destroyed || source.uploadMethodId !== 'image' || released.has(source) || held.has(source) || !isBitmap(source.resource)) continue;
		const gt = s._glTextures[source.uid];
		if (!gt || gt.width !== source.pixelWidth || gt.height !== source.pixelHeight) continue;
		if (release(source) && ++n >= PER_SWEEP) return;
	}
};

/** Pixi's image uploader, guarded: a released picture is never read (see the top of this file) */
const guard = (base: Upload): Upload => ({
	id: base.id,
	upload(source, glTexture, gl, webGLVersion) {
		const rec = released.get(source);
		const r = source.resource as unknown;
		if (!rec || !isBitmap(r) || !isClosed(r)) return base.upload(source, glTexture, gl, webGLVersion);
		if (glTexture.width === source.pixelWidth && glTexture.height === source.pixelHeight) {
			// the GL texture already holds this very picture: it keeps it
			stats.keptUploads += 1;
			return;
		}
		// a new GL texture with the copy away: clear storage at its size until the copy lands (never a black or wrong size
		// texture), and the copy is on its way
		gl.texImage2D(glTexture.target, 0, glTexture.internalFormat, source.pixelWidth, source.pixelHeight, 0, glTexture.format, glTexture.type, null);
		glTexture.width = source.pixelWidth;
		glTexture.height = source.pixelHeight;
		rec.placeholder = true;
		stats.placeholders += 1;
		if (!gate.on) stats.placeholdersShown += 1;
		void revive(source, rec, false);
	},
});
/** a closed ImageBitmap has width and height 0 (an open one never does) */
const isClosed = (b: ImageBitmap) => b.width === 0 && b.height === 0;

const onLost = () => {
	stats.contextLost += 1;
	const live = [...released.values()].filter((r) => !r.final);
	if (!live.length) return;
	// the drawing waits for the pictures from now; their fetches start now, through the loss (one let go for good was not
	// on the GPU before the loss either: it stays as it is)
	gate = { on: true, since: performance.now() };
	for (const rec of live) rec.refetch ??= fetchBitmap(rec);
};

const onRestored = async () => {
	stats.contextRestored += 1;
	const t0 = performance.now();
	const list = [...released.entries()].filter(([, r]) => !r.final);
	if (!list.length) {
		gate.on = false;
		return;
	}
	gate = { on: true, since: gate.on ? gate.since : t0 };
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		gate.on = false;
	}, GPU_MEMORY.restoreGateMaxMs);
	// (Pixi's own restore listener was added first: its texture system has already forgotten every GL texture)
	const done = await Promise.all(list.map(([source, rec]) => revive(source, rec, true).catch(() => false)));
	clearTimeout(timer);
	gate.on = false;
	stats.lastRestore = { sources: list.length, ms: Math.round(performance.now() - t0), failed: done.filter((d) => !d).length, timedOut };
};

/** called once the renderer is up (components/Game.svelte): the uploader's guard, the sweep, the context loss path, and
 *  the drawing's hold. A WebGPU renderer (never chosen: pixi-svelte asks for WebGL) gets none of it and keeps every copy. */
export const installGpuMemory = (app: PIXI.Application) => {
	if (installed || !app?.renderer) return;
	const s = app.renderer.texture as unknown as GlTextureSystem;
	const image = s._uploads?.image;
	installed = true;
	renderer = app.renderer as PIXI.Renderer;
	// THE STENCIL CHECK (GPU_MEMORY.noDepthStencil): Pixi 8.8.1 asks for a stencil buffer only for a stencil mask
	// (rendering/mask/stencil/StencilMaskPipe.mjs calls renderTarget.ensureDepthStencil). The canvas has none now, so a
	// mask added one day would draw unmasked: counted, and said in the console of the dev server.
	const rt = renderer.renderTarget as unknown as { ensureDepthStencil?: () => void };
	const attrs = (renderer as unknown as { gl?: WebGLRenderingContext }).gl?.getContextAttributes?.();
	if (rt?.ensureDepthStencil && attrs && !attrs.stencil) {
		const ensure = rt.ensureDepthStencil.bind(rt);
		rt.ensureDepthStencil = () => {
			stats.stencilAsks += 1;
			if (import.meta.env.DEV && stats.stencilAsks === 1) console.error('[reindeer] a stencil mask was drawn, but the WebGL context has no stencil buffer (constants GPU_MEMORY.noDepthStencil): it draws unmasked');
			ensure();
		};
	}
	if (!image || !s._glTextures || !s.managedTextures) return;
	s._uploads!.image = guard(image);
	// the drawing's hold while a restore runs: the ticker goes on (the game's own time), only the draw waits
	const r = renderer as unknown as { render: (...args: unknown[]) => unknown };
	const draw = r.render;
	r.render = function (this: unknown, ...args: unknown[]) {
		if (gate.on) {
			if (performance.now() - gate.since > GPU_MEMORY.restoreGateMaxMs + 1000) gate.on = false;
			else {
				stats.framesHeld += 1;
				return;
			}
		}
		return draw.apply(this, args);
	};
	app.canvas.addEventListener('webglcontextlost', onLost, false);
	app.canvas.addEventListener('webglcontextrestored', () => void onRestored(), false);
	app.ticker?.add(sweep, undefined, PIXI.UPDATE_PRIORITY.UTILITY);
};

/** DEV / probes (__reindeer.gpuTextures): the decoded copies and the switches */
export const decodedReport = () => {
	const s = sys();
	let openMb = 0;
	let open = 0;
	for (const source of s?.managedTextures ?? []) {
		if (!source.destroyed && isBitmap(source.resource) && !isClosed(source.resource)) {
			open += 1;
			openMb += mb(source);
		}
	}
	let liveMb = 0;
	for (const source of released.keys()) liveMb += mb(source);
	const attrs = (renderer as unknown as { gl?: WebGLRenderingContext } | null)?.gl?.getContextAttributes?.() ?? null;
	return {
		knobs: { releaseDecoded: GPU_MEMORY.releaseDecoded, releaseBonusSheets: GPU_MEMORY.releaseBonusSheets, noDepthStencil: GPU_MEMORY.noDepthStencil },
		/** the context as the browser made it */
		context: attrs ? { depth: attrs.depth, stencil: attrs.stencil, antialias: attrs.antialias, alpha: attrs.alpha, lost: lost() } : null,
		decoded: {
			/** sources whose copy is closed now, and their pixels (MB, w x h x 4: the browser's own size is about this) */
			releasedNow: released.size,
			releasedNowMb: Math.round(liveMb * 10) / 10,
			/** copies still open on GPU pictures (held, not swept yet, or not ImageBitmaps) */
			openNow: open,
			openNowMb: Math.round(openMb * 10) / 10,
			held: held.size,
			pending: [...released.values()].filter((r) => r.refetch).length,
			...stats,
			releasedMb: Math.round(stats.releasedMb * 10) / 10,
		},
		restoring: gate.on,
	};
};
