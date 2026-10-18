// HIS SHEETS DECODED OFF THE MAIN THREAD AND UPLOADED IN STRIPS (constants CREATURE.upload; Corey 2026-10-18 "1. Yes").
// Measured in Safari 26.3 and Chrome 149 on one ~3,900 x 3,700 creature sheet (scratchpad upload_test, 2026-10-18):
//   Pixi's own path (an ImageBitmap uploaded in one call)     Safari 105-125 ms frame, Chrome 32 / 50 / 67 ms (CPU 1x/4x/6x)
//   decoded in a worker to raw pixels, 8 strips, one a frame  Safari 42-44 ms worst frame, Chrome 18 ms at every CPU speed
// So a sheet is: its json fetched, its picture decoded by game/creatureDecode.worker.ts into premultiplied RGBA, a
// TextureSource whose upload method writes the next band of rows each time it is updated, one band per animation frame,
// then the pixel copy is let go (the GPU copy is the only one: Pixi's path kept the decoded picture as well).
// Anything that fails (no Worker, no OffscreenCanvas, the CSP refusing the worker, a decode error) answers null, and the
// caller loads that sheet the old way; a worker that fails to start is not tried again.
import * as PIXI from 'pixi.js';

import { CREATURE } from './constants';

/** the pixels of one sheet until its last band is up (then null) */
type Strips = { px: Uint8Array | null; band: number; rows: number };

/** a texture whose upload writes one band of rows per update (glTexture.width marks the allocation) */
export class StripSource extends PIXI.TextureSource<Strips> {
	override uploadMethodId = 'creatureStrips';
	get done(): boolean {
		return !this.resource?.px;
	}
}

type GlTex = { texture: WebGLTexture; target: number; internalFormat: number; format: number; type: number; width: number; height: number };
const stripUploader = {
	id: 'creatureStrips',
	upload(source: StripSource, glTexture: GlTex, gl: WebGL2RenderingContext) {
		const s = source.resource;
		const w = source.pixelWidth;
		const h = source.pixelHeight;
		if (glTexture.width !== w || glTexture.height !== h) {
			gl.texImage2D(gl.TEXTURE_2D, 0, glTexture.internalFormat, w, h, 0, glTexture.format, glTexture.type, null);
			glTexture.width = w;
			glTexture.height = h;
			// (a GPU copy made again after a lost WebGL context finds its pixels gone and stays empty: rare, and marked
			// `lost` for the DEV readout)
			if (s && !s.px) (source as StripSource & { lost?: boolean }).lost = true;
			if (s) s.band = 0;
		}
		if (!s?.px) return;
		const y = s.band * s.rows;
		const rows = Math.min(s.rows, h - y);
		if (rows > 0) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, w, rows, glTexture.format, glTexture.type, s.px.subarray(y * w * 4, (y + rows) * w * 4));
		s.band += 1;
		if (y + rows >= h) s.px = null;
	},
};

/** the strip path for this browser (constants CREATURE.upload.strips: 'all', 'webkit' or 'off'; DEV ?creaturestrips=) */
const wanted = (): boolean => {
	let mode: string = CREATURE.upload.strips;
	if (import.meta.env.DEV && typeof window !== 'undefined') mode = new URLSearchParams(window.location.search).get('creaturestrips') ?? mode;
	if (mode === 'off' || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return false;
	if (mode === 'webkit') return /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg\//.test(navigator.userAgent);
	return true;
};

let worker: Worker | null = null;
let broken = false;
let serial = 0;
const asks = new Map<number, (r: { w: number; h: number; buf: ArrayBuffer } | null) => void>();
const getWorker = (): Worker | null => {
	if (broken) return null;
	if (worker) return worker;
	try {
		worker = new Worker(new URL('./creatureDecode.worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = (e: MessageEvent<{ id: number; w?: number; h?: number; buf?: ArrayBuffer; error?: string }>) => {
			const d = e.data;
			asks.get(d.id)?.(d.buf ? { w: d.w!, h: d.h!, buf: d.buf } : null);
			asks.delete(d.id);
		};
		// (refused by the CSP, or a script error: every waiting ask falls back, and no worker is tried again)
		worker.onerror = () => {
			broken = true;
			for (const answer of asks.values()) answer(null);
			asks.clear();
			worker?.terminate();
			worker = null;
		};
		return worker;
	} catch {
		broken = true;
		return null;
	}
};
/** a sheet's picture decoded by the worker: the file fetched HERE (the same request Pixi's loader made, answered by the
 *  same cache), only the decode is the worker's */
const decode = async (url: string): Promise<{ w: number; h: number; buf: ArrayBuffer } | null> => {
	const w = getWorker();
	if (!w) return null;
	const res = await fetch(url);
	if (!res.ok) return null;
	const file = await res.blob();
	const id = ++serial;
	return new Promise((resolve) => {
		asks.set(id, resolve);
		w.postMessage({ id, file });
	});
};

/** the picture of a sheet by the URL pixi.js's spritesheet loader asks for: the json's folder + meta.image + the json's
 *  own query (its copySearchParams) */
export const imageOfSheet = (jsonUrl: string, image: string): string => {
	const json = new URL(jsonUrl, location.href);
	const img = new URL(image, json);
	img.search = json.search;
	return img.href;
};

export type StripSheet = { sheet: PIXI.Spritesheet; source: StripSource };
/** the renderer takes strip uploads: WebGL 2 (its texSubImage2D of a band from a typed array) */
export const canStrip = (renderer: PIXI.Renderer | undefined): boolean => (renderer as unknown as { gl?: unknown } | undefined)?.gl instanceof WebGL2RenderingContext;
/** one sheet the strip way, not yet uploaded (null: load it the old way) */
export const loadStripSheet = async (url: string, renderer: PIXI.Renderer | undefined): Promise<StripSheet | null> => {
	if (!wanted() || !canStrip(renderer)) return null;
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const data = (await res.json()) as PIXI.SpritesheetData & { meta: { related_multi_packs?: unknown } };
		// (a multi-pack sheet is the shared loader's to follow)
		if (!data.meta?.image || data.meta.related_multi_packs) return null;
		const pic = await decode(imageOfSheet(url, data.meta.image));
		if (!pic) return null;
		const source = new StripSource({
			resource: { px: new Uint8Array(pic.buf), band: 0, rows: Math.ceil(pic.h / CREATURE.upload.bands) },
			width: pic.w,
			height: pic.h,
			resolution: 1,
			alphaMode: 'premultiplied-alpha',
			autoGarbageCollect: false,
			label: url,
		});
		const sheet = new PIXI.Spritesheet(new PIXI.Texture({ source }), data);
		await sheet.parse();
		return { sheet, source };
	} catch {
		return null;
	}
};

/** its bands up, one per animation frame (resolves when the last is up, or at once without a renderer) */
export const uploadStrips = async (renderer: PIXI.Renderer | undefined, source: StripSource): Promise<void> => {
	// (WebGL only: the uploader writes through gl; a WebGPU renderer never gets here, see canStrip)
	const sys = renderer?.texture as unknown as { _uploads?: Record<string, unknown>; initSource: (s: PIXI.TextureSource) => void } | undefined;
	if (!sys?._uploads) return;
	sys._uploads.creatureStrips ??= stripUploader;
	// the first band with the GPU copy's allocation, then one band a frame
	sys.initSource(source);
	while (!source.done && !source.destroyed) {
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		if (!source.destroyed) source.update();
	}
};
