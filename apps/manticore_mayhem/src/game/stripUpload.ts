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

/** the pixels of one sheet until its last band is up (then null); `free` lets them go at once and gives back the
 *  sheet's decode slot (called when the last band is up, or when the sheet is destroyed first; once) */
type Strips = { px: Uint8Array | null; band: number; rows: number; free: () => void };

// ---- THE DECODE SLOTS (constants CREATURE.upload.decodeSlots; Corey 2026-11-26, memory fix 2) ----------------------------
// Decimus measured 111.5 MB of these pixel buffers alive at once right after an Epic's book: sheets of two looks and the
// round's win clips were each decoded the moment they were asked for and then waited, whole, for their turn to go up
// (and for the quiet of a win plaque), and a buffer whose last band was up still lived until the next garbage
// collection. Now a sheet is decoded only when a slot is free (decode it, upload it, free it, then the next), first come
// first served, and its buffer is let go the moment its last band is up. A sheet asked for with needNow() true (the
// idle sheet of the look the mode asks for) skips the line and takes no slot, as it skips the upload turn; one waiting
// in line is let through the moment it becomes needed. The slot is taken BEFORE the upload turn (game/creatureLoad.ts
// takeTurn) and only a sheet with its pixels in hand ever holds the turn, so the two never wait on each other.
let slotsBusy = 0;
const slotLine: (() => void)[] = [];
const nextInLine = () => {
	const go = slotLine.shift();
	if (go) go();
	else slotsBusy = Math.max(0, slotsBusy - 1);
};
/** a slot for one decode: resolves with the function that gives it back (a no-op for a sheet that skipped the line) */
const takeDecodeSlot = (needNow: () => boolean): Promise<() => void> =>
	new Promise((resolve) => {
		let back = false;
		const giveBack = () => {
			if (back) return;
			back = true;
			nextInLine();
		};
		if (needNow()) return resolve(() => {});
		if (slotsBusy < Math.max(1, CREATURE.upload.decodeSlots)) {
			slotsBusy += 1;
			return resolve(giveBack);
		}
		let poll: ReturnType<typeof setInterval> | null = null;
		const go = () => {
			if (poll) clearInterval(poll);
			resolve(giveBack);
		};
		slotLine.push(go);
		poll = setInterval(() => {
			if (!needNow()) return;
			clearInterval(poll!);
			const i = slotLine.indexOf(go);
			if (i >= 0) slotLine.splice(i, 1);
			resolve(() => {});
		}, CREATURE.upload.pollMs);
	});
/** a pixel buffer let go NOW, not at the next garbage collection (ArrayBuffer transfer to length 0 detaches it and frees
 *  its memory; a browser without it leaves the buffer to the collector, as before) */
const letGo = (px: Uint8Array | null): void => {
	if (!px) return;
	try {
		(px.buffer as ArrayBuffer & { transfer?: (length: number) => ArrayBuffer }).transfer?.(0);
	} catch {
		/* detached already, or not transferable: the collector has it */
	}
};
/** DEV / staging readout: the decode slots in use and the sheets waiting for one */
export const decodeSlotState = () => ({ busy: slotsBusy, waiting: slotLine.length });

/** a texture whose upload writes one band of rows per update (glTexture.width marks the allocation) */
export class StripSource extends PIXI.TextureSource<Strips> {
	override uploadMethodId = 'creatureStrips';
	/** the sheet's picture (its address), to make the GPU copy again after a lost context (restripSheet) */
	image = '';
	/** its GPU copy was made again with no pixels left to fill it (a lost context): empty until restripSheet */
	lost = false;
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
			// (a GPU copy made again after a lost WebGL context finds its pixels gone: it is marked `lost` and stays empty
			// until game/creatureLoad.ts makes it again from its file, restripSheet below)
			if (s && !s.px) source.lost = true;
			if (s) s.band = 0;
		}
		if (!s?.px) return;
		const y = s.band * s.rows;
		const rows = Math.min(s.rows, h - y);
		if (rows > 0) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, w, rows, glTexture.format, glTexture.type, s.px.subarray(y * w * 4, (y + rows) * w * 4));
		s.band += 1;
		if (y + rows >= h) s.free();
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
const fetchPicture = async (url: string): Promise<Blob | null> => {
	if (!getWorker()) return null;
	const res = await fetch(url);
	return res.ok ? res.blob() : null;
};
/** ...and decoded (the compressed file is fetched before a decode slot is taken, so a slow download holds no slot) */
const decode = async (file: Blob): Promise<{ w: number; h: number; buf: ArrayBuffer } | null> => {
	const w = getWorker();
	if (!w) return null;
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
/** one sheet the strip way, not yet uploaded (null: load it the old way). `bands`: how many it goes up in (drop 8: the
 *  win clips' sheets take CREATURE.wins.bands, the rest CREATURE.upload.bands) */
export const loadStripSheet = async (url: string, renderer: PIXI.Renderer | undefined, bands: number = CREATURE.upload.bands, needNow: () => boolean = () => false): Promise<StripSheet | null> => {
	if (!wanted() || !canStrip(renderer)) return null;
	let giveBack: () => void = () => {};
	let strips: Strips | null = null;
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const data = (await res.json()) as PIXI.SpritesheetData & { meta: { related_multi_packs?: unknown } };
		// (a multi-pack sheet is the shared loader's to follow)
		if (!data.meta?.image || data.meta.related_multi_packs) return null;
		const file = await fetchPicture(imageOfSheet(url, data.meta.image));
		if (!file) return null;
		// THE DECODE SLOTS (above): the picture is decoded only once a slot is free; the slot goes back with its pixels
		giveBack = await takeDecodeSlot(needNow);
		const pic = await decode(file);
		if (!pic) {
			giveBack();
			return null;
		}
		const own: Strips = (strips = { px: new Uint8Array(pic.buf), band: 0, rows: Math.ceil(pic.h / Math.max(1, bands)), free: () => {} });
		const slot = giveBack;
		giveBack = () => {};
		own.free = () => {
			const px = own.px;
			own.px = null;
			letGo(px);
			slot();
		};
		const source = new StripSource({
			resource: strips,
			width: pic.w,
			height: pic.h,
			resolution: 1,
			alphaMode: 'premultiplied-alpha',
			autoGarbageCollect: false,
			label: url,
		});
		source.image = imageOfSheet(url, data.meta.image);
		// (a sheet destroyed before its last band is up, a look let go mid upload: its pixels and its slot go with it)
		(source as unknown as { once: (event: string, fn: () => void) => void }).once('destroy', () => own.free());
		const sheet = new PIXI.Spritesheet(new PIXI.Texture({ source }), data);
		await sheet.parse();
		return { sheet, source };
	} catch {
		if (strips) (strips as Strips).free();
		else giveBack();
		return null;
	}
};

/** its bands up, one per animation frame (resolves when the last is up, or at once without a renderer). `hold`: awaited
 *  before each band after the first (drop 8: THE QUIET, game/creatureLoad.ts, no band during a win plaque's impact) */
export const uploadStrips = async (renderer: PIXI.Renderer | undefined, source: StripSource, hold?: () => Promise<void>): Promise<void> => {
	// (WebGL only: the uploader writes through gl; a WebGPU renderer never gets here, see canStrip)
	const sys = renderer?.texture as unknown as { _uploads?: Record<string, unknown>; initSource: (s: PIXI.TextureSource) => void } | undefined;
	// (no WebGL uploader to write through: nothing can go up, so the pixels and the decode slot are not held for it)
	if (!sys?._uploads) {
		source.resource?.free();
		return;
	}
	sys._uploads.creatureStrips ??= stripUploader;
	// the first band with the GPU copy's allocation, then one band a frame
	sys.initSource(source);
	while (!source.done && !source.destroyed) {
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		if (hold) await hold();
		if (!source.destroyed) source.update();
	}
};

/** THE LOST CONTEXT (memory follow-up, 2026-11-26): a sheet whose GPU copy went with a lost WebGL context is made again
 *  the way it was made the first time: its picture fetched (the HTTP cache answers), decoded in the worker through THE
 *  DECODE SLOTS, and uploaded in strips, one band a frame (no hold: he is missing until it is up). False when it cannot be
 *  (destroyed meanwhile, no worker, the file or the decode failed, a picture of another size) */
export const restripSheet = async (renderer: PIXI.Renderer | undefined, source: StripSource, needNow: () => boolean): Promise<boolean> => {
	if (source.destroyed || !source.image || !canStrip(renderer)) return false;
	const old = source.resource;
	const file = await fetchPicture(source.image);
	if (!file || source.destroyed) return false;
	const giveBack = await takeDecodeSlot(needNow);
	const pic = await decode(file);
	if (!pic || source.destroyed || pic.w !== source.pixelWidth || pic.h !== source.pixelHeight) {
		if (pic) letGo(new Uint8Array(pic.buf));
		giveBack();
		return false;
	}
	const own: Strips = { px: new Uint8Array(pic.buf), band: 0, rows: old?.rows ?? Math.ceil(pic.h / Math.max(1, CREATURE.upload.bands)), free: () => {} };
	let freed = false;
	own.free = () => {
		if (freed) return;
		freed = true;
		const px = own.px;
		own.px = null;
		letGo(px);
		giveBack();
	};
	(source as unknown as { once: (event: string, fn: () => void) => void }).once('destroy', () => own.free());
	source.resource = own;
	source.lost = false;
	await uploadStrips(renderer, source);
	return source.done && !source.destroyed;
};
