// THE GPU WARM-UP (components/Game.svelte): every texture on the stage goes to the GPU while the player is still on the
// press screen, so the first frame after the press draws nothing that is not already there.
//
// Until 2026-11-17 the warm-up ran at the press (the loading screen's dismissal) through Pixi's shared prepare queue:
//   - it started as the board powered down and the dim lifted, so on a slow phone its uploads (four a frame) landed in
//     the very frames that show the game for the first time (a stall at the hand over);
//   - Pixi's queue holds texture SOURCES until their turn and never looks at them again: a source destroyed meanwhile
//     (the old billboard's, destroyed two frames after it left; an LED face rebuilt by a rotation) was still uploaded
//     (Pixi 8.8.1 GlTextureSystem: a fresh GL texture for a dead source, its style already gone: the Pixi error the
//     upright phone threw in the roam build), and a source unloaded on purpose meanwhile (the first board's sheet at the
//     first spin, a column character let go) was sent to the GPU again and kept there;
//   - on WebGPU, prepare's initSource on a source already on the GPU makes a second GPU texture (an upload twice);
//   - the texture GC's idle limit (Pixi's default, 3600 frames: a minute) was raised only at the press, so a texture sent
//     up during a long wait on the press screen could be unloaded by the GC and sent up again after it.
// Now: a queue of its own, walked a few sources a frame after the frame's render; a source is skipped when it is
// already on the GPU, destroyed, or unloaded after it was queued (then it was let go on purpose and stays let go); the
// idle limit is raised when the renderer starts (components/Game.svelte). Never through prepare.upload(stage): that
// also queues Graphics contexts, and a context replaced meanwhile is iterated after it was destroyed.
import * as PIXI from 'pixi.js';

export const GPU_WARM = {
	/** real uploads per frame at most (a source already on the GPU costs nothing and is not counted) */
	perFrame: 1,
	/** the press screen's pass starts this long after its LED board has seated (counted from the press gate opening) */
	afterSeatMs: 200,
	/** the texture GC's idle limit, frames (about 30 min at 60 fps): set when the renderer starts */
	gcMaxIdle: 60 * 60 * 30,
} as const;

type Entry = { pass: string; uid: number; label: string; w: number; h: number; ms: number; at: number; result: 'uploaded' | 'resident' | 'destroyed' | 'let go' };
const log: Entry[] = [];
/** DEV / probes: what the warm-up did, source by source */
export const gpuWarmLog = () => log.map((e) => ({ ...e }));

/** the source is on the GPU now (the renderer's own table; WebGL's or WebGPU's), or null when it cannot tell */
const resident = (renderer: PIXI.Renderer, source: PIXI.TextureSource): boolean | null => {
	const sys = renderer.texture as unknown as { _glTextures?: Record<number, unknown>; _gpuSources?: Record<number, unknown> };
	const table = sys._glTextures ?? sys._gpuSources;
	return table ? !!table[source.uid] : null;
};

/** every texture source the stage's sprites, meshes and tiling sprites show now, visible or not */
export const stageSources = (stage: PIXI.Container): PIXI.TextureSource[] => {
	const out = new Set<PIXI.TextureSource>();
	const walk = (node: PIXI.Container) => {
		const t = (node as PIXI.Sprite).texture;
		if (t instanceof PIXI.Texture && !t.destroyed && t.source && !t.source.destroyed) out.add(t.source);
		for (const child of node.children) walk(child);
	};
	walk(stage);
	return [...out];
};

let pending: { source: PIXI.TextureSource; pass: string; gone: 'destroyed' | 'let go' | null; off: () => void }[] = [];
let ticking: { app: PIXI.Application; fn: () => void } | null = null;
/** DEV / probes: sources still waiting their turn */
export const gpuWarmPending = () => pending.length;
const waiters: (() => void)[] = [];

/** hand these sources to the GPU, a few a frame after each render; resolves when this pass's sources are done */
export const warmSources = (app: PIXI.Application, sources: PIXI.TextureSource[], pass: string): Promise<void> =>
	new Promise<void>((resolve) => {
		const queued = new Set(pending.map((p) => p.source));
		for (const source of sources) {
			if (queued.has(source) || source.destroyed) continue;
			const item = { source, pass, gone: null as 'destroyed' | 'let go' | null, off: () => {} };
			const onUnload = () => (item.gone = 'let go');
			const onDestroy = () => (item.gone = 'destroyed');
			source.on('unload', onUnload);
			source.on('destroy', onDestroy);
			item.off = () => {
				source.off('unload', onUnload);
				source.off('destroy', onDestroy);
			};
			pending.push(item);
		}
		waiters.push(resolve);
		if (!ticking) {
			const fn = () => step(app);
			ticking = { app, fn };
			// after the frame's render (Application renders at LOW; UTILITY comes after it)
			app.ticker.add(fn, undefined, PIXI.UPDATE_PRIORITY.UTILITY);
		}
	});

const step = (app: PIXI.Application) => {
	const renderer = app.renderer as PIXI.Renderer;
	let uploads = 0;
	while (pending.length && uploads < GPU_WARM.perFrame) {
		const item = pending.shift()!;
		item.off();
		const { source } = item;
		const base = { pass: item.pass, uid: source.uid, label: source.label ?? '', w: source.pixelWidth, h: source.pixelHeight, at: Math.round(performance.now()) };
		if (item.gone || source.destroyed) {
			log.push({ ...base, ms: 0, result: item.gone ?? 'destroyed' });
			continue;
		}
		if (resident(renderer, source) === true) {
			log.push({ ...base, ms: 0, result: 'resident' });
			continue;
		}
		const t0 = performance.now();
		try {
			renderer.texture.initSource(source);
		} catch {
			/* it uploads on its first draw instead */
		}
		log.push({ ...base, ms: +(performance.now() - t0).toFixed(1), result: 'uploaded' });
		uploads++;
	}
	if (!pending.length && ticking) {
		ticking.app.ticker.remove(ticking.fn);
		ticking = null;
		for (const w of waiters.splice(0)) w();
	}
};
