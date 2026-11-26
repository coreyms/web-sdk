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
// decodes it, set back as the resource and uploaded; then let go again. One file at a time, so a restored context does not
// decode every picture at once. Until its picture is back the texture is blank: Decimus watches for this (`restores` and
// `blank` in the readout). A scene released at a turn of the device keeps its dropped sources on the GPU instead of
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
	queued: new Set<PIXI.TextureSource>(),
	flushing: false,
	dropped: 0,
	droppedBytes: 0,
	restores: 0,
	/** times a GPU copy had to be made again while the picture was not there (drawn blank until it is restored) */
	blank: 0,
	failed: 0,
	restoring: new Set<PIXI.TextureSource>(),
	line: Promise.resolve() as Promise<void>,
};

const kept = (s: PIXI.TextureSource): boolean => {
	const file = fileOf(addressOf(s));
	return PIXEL_DROP.keep.some((stem) => file.startsWith(stem));
};

/** the source can let its bitmap go now (see the header) */
const droppable = (s: PIXI.TextureSource): boolean => {
	const sys = state.sys;
	if (!sys || s.destroyed || s.uploadMethodId !== 'image' || !isBitmap(s.resource) || !addressOf(s) || kept(s)) return false;
	const gl = sys._glTextures[s.uid];
	return !!gl && gl.width === s.pixelWidth && gl.height === s.pixelHeight;
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

/** the picture fetched again and set back as the source's resource, then uploaded (and let go again after). One at a time */
const restore = (s: PIXI.TextureSource): void => {
	if (state.restoring.has(s)) return;
	state.restoring.add(s);
	state.line = state.line.then(async () => {
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
			// (a blank GPU copy made in its place is filled now; with no GPU copy at all, an unload, Pixi uploads it at its next
			// draw, as it would have before. Either way the wrapped uploader then queues the drop again)
			if (state.sys?._glTextures[s.uid]) s.update();
		} catch {
			state.failed += 1;
		} finally {
			state.restoring.delete(s);
		}
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
		state.blank += 1;
		restore(source);
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
	if (STAGING_TOOLS) installReadout(renderer, sys);
	if (!PIXEL_DROP.on || switchedOff()) return;
	const image = sys._uploads.image;
	sys._uploads.image = {
		id: 'image',
		upload(source, glTexture, gl, webGLVersion) {
			image.upload(source, glTexture, gl, webGLVersion);
			if (isBitmap(source.resource)) {
				if (!(source as unknown as { mmUnloadHooked?: boolean }).mmUnloadHooked) {
					(source as unknown as { mmUnloadHooked?: boolean }).mmUnloadHooked = true;
					(source as unknown as { on: (event: string, fn: (s: PIXI.TextureSource) => void) => void }).on('unload', onUnload);
				}
				queue(source);
			}
		},
	};
	sys._uploads[DROPPED] = droppedUploader;
	for (const s of sys.managedTextures) if (isBitmap(s.resource)) queue(s);
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
		const strips = { mb: 0, count: 0 };
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
			strips: { mb: round1(strips.mb), count: strips.count, slots: decodeSlotState() },
			restores: state.restores,
			blank: state.blank,
			restoreFailed: state.failed,
			rows,
		};
	};
	((window as unknown as { __manticore?: Record<string, unknown> }).__manticore ??= {}).memory = readout;
};
