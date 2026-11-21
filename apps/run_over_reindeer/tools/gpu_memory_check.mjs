// @ts-nocheck: a node check script, not app code (svelte-check picks up .mjs files)
// THE DECODED COPY, A PURE CHECK (2026-11-21; game/gpuMemory.ts, constants GPU_MEMORY.releaseDecoded). Node only, no
// browser: the game's own module is installed on a stand-in renderer that keeps Pixi 8.8.1's WebGL texture rules
// (GlTextureSystem: a GL texture per source uid, made on the first bind and uploaded through `_uploads.image`, sent up
// again on the source's 'update', deleted on 'unload', every one forgotten on a context restore) and stand-in
// ImageBitmaps (close() makes width and height 0, as the browser's do), and checks:
//   1. RELEASE: a picture on the GPU gives up its decoded copy at the next sweep (closed, autoGarbageCollect off); a held
//      picture, a canvas, one not yet uploaded and one with no URL keep theirs; the knob off releases nothing
//   2. NO READ OF A CLOSED COPY: source.update() on a released picture never hands the closed bitmap to the uploader
//      (the GL texture keeps its pixels: no upload)
//   3. UNLOAD: a released picture unloaded is fetched back (its own URL, never blob:), so the next draw uploads real
//      pixels; one unloaded for good is not fetched back
//   4. CONTEXT LOSS: every released picture is fetched again, the renderer draws nothing until each is back on the GPU,
//      the re-upload hands real bitmaps only, and the sweep releases them again after
//   5. A DRAW WITH THE COPY AWAY outside a loss: clear storage at its size (never the closed bitmap), then the real upload
//      when the copy lands
//   node --experimental-strip-types --no-warnings tools/gpu_memory_check.mjs      (from apps/run_over_reindeer)
// Pass: every line PASS, "0 fail" and exit 0.
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

register(
	'data:text/javascript,' +
		encodeURIComponent(`export async function resolve(s, c, n) {
	if (/^\\.\\.?\\//.test(s) && !/\\.[a-z]+$/.test(s)) return n(s + '.ts', c);
	return n(s, c);
}
export async function load(u, c, n) {
	const r = await n(u, c);
	if (u.endsWith('.ts') && r.source) return { ...r, source: String(r.source).replaceAll('import.meta.env', '({ DEV: true })') };
	return r;
}`),
);

// ---- stand-ins: ImageBitmap, createImageBitmap, fetch ---------------------------------------------------------------
class FakeBitmap {
	constructor(w, h, tag) {
		this.width = w;
		this.height = h;
		this.tag = tag;
		this.closed = false;
	}
	close() {
		this.closed = true;
		this.width = 0;
		this.height = 0;
	}
}
globalThis.ImageBitmap = FakeBitmap;
const SIZES = new Map();
const fetched = [];
let fetchFails = 0;
globalThis.fetch = async (url) => {
	fetched.push(String(url));
	if (fetchFails > 0) {
		fetchFails--;
		return { ok: false, status: 503, blob: async () => null };
	}
	return { ok: true, status: 200, blob: async () => ({ url: String(url) }) };
};
globalThis.createImageBitmap = async (blob) => {
	const [w, h] = SIZES.get(blob.url) ?? [8, 8];
	return new FakeBitmap(w, h, `refetch:${blob.url}`);
};
let rafs = [];
globalThis.requestAnimationFrame = (fn) => rafs.push(fn);

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = (p) => import(pathToFileURL(join(APP, 'src', 'game', p)).href);
const PIXI = await import('pixi.js');
const { GPU_MEMORY } = await mod('constants.ts');
const G = await mod('gpuMemory.ts');

let pass = 0;
let fail = 0;
const check = (ok, msg, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail).slice(0, 700) : ''}`);
};
const settle = async () => {
	for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0));
};

// ---- the stand-in renderer (Pixi 8.8.1's GlTextureSystem rules) ------------------------------------------------------
let lostFlag = false;
const uploads = [];
const gl = {
	isContextLost: () => lostFlag,
	getContextAttributes: () => ({ depth: false, stencil: false, antialias: true, alpha: true }),
	texImage2D: (...a) => uploads.push({ kind: 'clear', w: a[3], h: a[4], pixels: a[8] }),
};
const texSys = {
	_glTextures: Object.create(null),
	managedTextures: [],
	_uploads: {
		image: {
			id: 'image',
			upload(source, glTexture) {
				const r = source.resource;
				// the browser throws on a closed ImageBitmap (InvalidStateError): recorded as a read of a closed copy
				uploads.push({ kind: 'image', uid: source.uid, closedRead: !!r?.closed, tag: r?.tag });
				if (r?.closed) throw new Error('InvalidStateError: the ImageBitmap is detached');
				glTexture.width = source.pixelWidth;
				glTexture.height = source.pixelHeight;
			},
		},
	},
	onSourceUpdate(source) {
		const gt = (this._glTextures[source.uid] ??= this._make(source));
		this._uploads[source.uploadMethodId]?.upload(source, gt, gl, 2);
	},
	onSourceUnload(source) {
		this._glTextures[source.uid] = null;
	},
	_make(source) {
		const gt = { width: -1, height: -1, target: 3553, internalFormat: 6408, format: 6408, type: 5121 };
		this._glTextures[source.uid] = gt;
		if (!this.managedTextures.includes(source)) {
			source.on('update', this.onSourceUpdate, this);
			source.on('unload', this.onSourceUnload, this);
			this.managedTextures.push(source);
		}
		return gt;
	},
	initSource(source) {
		if (this._glTextures[source.uid]) return;
		const gt = this._make(source);
		this._uploads[source.uploadMethodId]?.upload(source, gt, gl, 2);
	},
	contextChange() {
		this._glTextures = Object.create(null);
	},
};
let renders = 0;
const renderer = { texture: texSys, renderTarget: { ensureDepthStencil() {} }, gl, render() { renders++; } };
const canvas = new EventTarget();
let tickFn = null;
const app = { renderer, canvas, ticker: { add: (fn) => (tickFn = fn) } };
// Pixi's own restore listener is added first (GlContextSystem.initFromContext)
canvas.addEventListener('webglcontextrestored', () => texSys.contextChange());
const frames = (n) => {
	for (let i = 0; i < n; i++) {
		app.renderer.render();
		tickFn?.();
	}
};

G.installGpuMemory(app);
check(texSys._uploads.image.upload !== undefined && tickFn !== null, 'installed: the uploader is guarded and the sweep is on the ticker');

let n = 0;
const picture = (w, h, opts = {}) => {
	const url = opts.url === undefined ? `assets/pic${++n}.webp?v=abc` : opts.url;
	if (url) SIZES.set(url, [w, h]);
	const res = opts.canvas ? { width: w, height: h, getContext() {} } : new FakeBitmap(w, h, `load:${url}`);
	const s = new PIXI.TextureSource({ resource: res, width: w, height: h });
	s.uploadMethodId = 'image';
	if (url) s.label = url;
	s.autoGarbageCollect = true;
	return s;
};

// 1. RELEASE
const a = picture(64, 32);
const b = picture(16, 16);
const heldPic = picture(20, 20);
const canv = picture(10, 10, { canvas: true });
const noUrl = picture(12, 12, { url: '' });
const notUp = picture(30, 30);
G.holdDecoded(heldPic);
for (const s of [a, b, heldPic, canv, noUrl]) texSys.initSource(s);
frames(10);
check(a.resource.closed && b.resource.closed, '1: two pictures on the GPU give up their decoded copy at the sweep');
check(a.autoGarbageCollect === false, '1: a released picture is out of the texture GC');
check(!heldPic.resource.closed, '1: a held picture keeps its copy (the game reads its pixels)');
check(!noUrl.resource.closed && !notUp.resource.closed, '1: one with no URL, and one not on the GPU yet, keep theirs');
check(canv.resource.closed === undefined, '1: a canvas is left alone');
const r1 = G.decodedReport();
check(r1.decoded.releasedNow === 2 && r1.knobs.releaseDecoded === true && r1.context.stencil === false, '1: the report counts 2 released, the knobs and the context', r1);

// 2. NO READ OF A CLOSED COPY
uploads.length = 0;
a.update();
check(!uploads.some((u) => u.closedRead) && uploads.length === 0, '2: update() on a released picture never reads the closed copy (the GL texture keeps its pixels)', uploads);
check(G.decodedReport().decoded.keptUploads === 1, '2: counted as a kept upload');

// 3. UNLOAD
fetched.length = 0;
uploads.length = 0;
b.unload();
await settle();
check(fetched.includes(b.label) && fetched.every((u) => !u.startsWith('blob:')), '3: an unloaded released picture is fetched back by its own URL', fetched);
check(!b.resource.closed && b.resource.tag === `refetch:${b.label}`, '3: its decoded copy is back');
texSys.initSource(b);
check(uploads.some((u) => u.kind === 'image' && u.uid === b.uid && !u.closedRead), '3: its next draw uploads real pixels', uploads);
frames(10);
check(b.resource.closed, '3: and the sweep releases it again once it is up');
const land = picture(40, 40);
texSys.initSource(land);
frames(10);
fetched.length = 0;
G.unloadForGood(land);
await settle();
check(!fetched.includes(land.label) && land.resource.closed, '3: a picture unloaded for good is not fetched back');

// 4. CONTEXT LOSS
fetched.length = 0;
uploads.length = 0;
const live = [a, b];
lostFlag = true;
canvas.dispatchEvent(new Event('webglcontextlost'));
check(live.every((s) => fetched.includes(s.label)) && !fetched.includes(land.label), '4: at the loss every released picture starts its fetch (not the one let go for good)', fetched);
renders = 0;
const r0 = G.decodedReport().decoded.framesHeld;
frames(3);
check(G.decodedReport().decoded.framesHeld - r0 === 3, '4: the renderer draws nothing through the loss');
lostFlag = false;
canvas.dispatchEvent(new Event('webglcontextrestored'));
await settle();
check(live.every((s) => texSys._glTextures[s.uid] && texSys._glTextures[s.uid].width === s.pixelWidth), '4: after the restore each is back on the GPU before the drawing goes on', live.map((s) => texSys._glTextures[s.uid]));
check(!uploads.some((u) => u.closedRead), '4: the re-upload never read a closed copy', uploads);
const lr = G.decodedReport();
check(lr.restoring === false && lr.decoded.lastRestore?.sources === 2 && lr.decoded.lastRestore.failed === 0, '4: the restore is over (2 pictures, none failed)', lr.decoded.lastRestore);
const before = G.decodedReport().decoded.framesHeld;
frames(10);
check(G.decodedReport().decoded.framesHeld === before, '4: the drawing goes on after it');
check(live.every((s) => s.resource.closed), '4: the sweep releases them again');

// 5. A DRAW WITH THE COPY AWAY outside a loss
uploads.length = 0;
texSys.contextChange(); // (as if its GL texture had gone without an unload: the guard's own path)
const shownBefore = G.decodedReport().decoded.placeholdersShown;
texSys.initSource(a);
check(uploads[0]?.kind === 'clear' && uploads[0].pixels === null && uploads[0].w === a.pixelWidth, '5: clear storage at its size, never the closed copy', uploads);
check(G.decodedReport().decoded.placeholdersShown === shownBefore + 1, '5: counted as a placeholder shown (the failure the probe host looks for)');
await settle();
check(uploads.some((u) => u.kind === 'image' && u.uid === a.uid && !u.closedRead), '5: the real upload follows when the copy lands', uploads);

// 6. THE KNOB OFF
GPU_MEMORY.releaseDecoded = false;
const c = picture(50, 50);
texSys.initSource(c);
frames(30);
check(!c.resource.closed, '6: GPU_MEMORY.releaseDecoded false releases nothing');
GPU_MEMORY.releaseDecoded = true;

// 7. A FAILED FETCH never throws, and a later draw tries again
fetchFails = 3;
const d = picture(22, 22);
texSys.initSource(d);
frames(10);
d.unload();
await new Promise((r) => setTimeout(r, 2200));
check(d.resource.closed && G.decodedReport().decoded.refetchFailed >= 1, '7: three failed fetches leave it released and counted, nothing thrown');

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
