// THE REINDEER'S RUN VIEWS (the strike, stage 1; Corey 2026-11-12): the rig's rendered run cycle in five views, turned
// 0 / 20 / 40 / 60 / 80 degrees toward the camera: R (the side run in the snow), S, Q (the diagonal), M and C (straight
// down the reel). tools/build_assets.py (build_reindeer_run) made the sheets and game/reindeerRunSpec.ts.
//
// Every frame's texture keeps its view's whole box as its `orig` (the sheets hold only the trimmed ink), so a sprite
// anchored at the view's feet point (anchorX / frameW, anchorY / frameH) stands on its feet in every frame, and a
// sprite flipped by a negative x scale is mirrored about the feet point: the anchor's x mirrors with it
// (frame_w - x, as the delivery note asks).
//
// Loading: started once the board is up (components/Board.svelte), in the background, never holding up the preload.
// The pages go to the GPU one at a time through the column pictures' upload queue (game/road/columnClips.ts), at the
// lowest priority unless a strike is waiting on them. A strike waits for them at most STRIKE.loadWaitMs, then runs
// with the placeholder picture (it never holds up a round). Desktop sheets get a mip chain (house rule: a sheet drawn
// well under its size); the phone sheet is drawn near its own size and has none.
import * as PIXI from 'pixi.js';

import { REINDEER_RUN } from '../reindeerRunSpec';
import { stamp } from '../assets';
import { PHONE_TIER } from '../deviceTier';
import { STAGING_TOOLS, perfMark } from '../staging';
import { queueRunUpload } from './columnClips';

export type RunView = 'R' | 'S' | 'Q' | 'M' | 'C';
export const RUN_VIEWS: readonly RunView[] = ['R', 'S', 'Q', 'M', 'C'];

const TIER = PHONE_TIER ? 'phone' : 'full';
const spec = REINDEER_RUN.tiers[TIER];

/** one view's box in road px at the built size (scale 1), and its anchor as a share of the box */
export type RunBox = { width: number; height: number; anchorX: number; anchorY: number; turnDeg: number };
export const runBox = (view: RunView): RunBox => {
	const v = REINDEER_RUN.views[view];
	const k = REINDEER_RUN.roadPxPerFramePx;
	return { width: v.frameW * k, height: v.frameH * k, anchorX: v.anchorX / v.frameW, anchorY: v.anchorY / v.frameH, turnDeg: v.turnDeg };
};

let textures: Record<RunView, Map<number, PIXI.Texture>> | null = null;
let loading: Promise<boolean> | null = null;
let sources: PIXI.TextureSource[] = [];
let waiting = 0;
let mipmapper: ((source: PIXI.TextureSource) => void) | null = null;

/** set by components/Board.svelte on the desktop tier: give a sheet its mip chain before it goes to the GPU */
export const setRunMipmapper = (fn: typeof mipmapper) => {
	mipmapper = fn;
};

/** start loading the run views (or join the load already running); resolves true when every page is on the GPU */
export const loadRunViews = (): Promise<boolean> => {
	if (textures) return Promise.resolve(true);
	loading ??= (async () => {
		try {
			const pages: PIXI.TextureSource[] = [];
			for (const [n, sheet] of spec.sheets.entries()) {
				const base = (await PIXI.Assets.load(stamp(`/assets/${sheet.file}`))) as PIXI.Texture;
				mipmapper?.(base.source);
				await queueRunUpload(`reindeer-run:${n + 1}/${spec.sheets.length}`, base, () => waiting > 0);
				pages.push(base.source);
			}
			const out = {} as Record<RunView, Map<number, PIXI.Texture>>;
			for (const view of RUN_VIEWS) {
				const box = spec.boxes[view];
				const map = new Map<number, PIXI.Texture>();
				for (const [stride, f] of Object.entries(spec.frames[view]) as [string, { sheet: number; x: number; y: number; w: number; h: number; ox: number; oy: number }][]) {
					map.set(Number(stride), new PIXI.Texture({ source: pages[f.sheet], frame: new PIXI.Rectangle(f.x, f.y, f.w, f.h), orig: new PIXI.Rectangle(0, 0, box.w, box.h), trim: new PIXI.Rectangle(f.ox, f.oy, f.w, f.h) }));
				}
				out[view] = map;
			}
			sources = pages;
			textures = out;
			if (STAGING_TOOLS) perfMark('load:reindeer-run');
			return true;
		} catch (error) {
			// without them the strike runs with the placeholder picture: never a reason to stop a round
			console.warn('[reindeer] run views failed to load', error);
			loading = null;
			return false;
		}
	})();
	return loading;
};

/** are the run views in (never waits) */
export const runViewsReady = (): boolean => textures !== null;

/** wait for the run views at most `ms` (a strike about to start); true when they are in */
export const awaitRunViews = async (ms: number): Promise<boolean> => {
	if (textures) return true;
	waiting++;
	try {
		return await Promise.race([loadRunViews(), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms))]);
	} finally {
		waiting--;
	}
};

/** a view's frame for a stride (1 to 16). A stride the sheets do not carry (only possible if the strike's timing was
 *  tuned past what tools/build_assets.py packs, RUN_STRIDES) falls back to the nearest one packed before it. */
export const runFrame = (view: RunView, stride: number): { texture: PIXI.Texture; stride: number } | null => {
	const map = textures?.[view];
	if (!map) return null;
	for (let back = 0; back < 16; back++) {
		const s = ((stride - 1 - back + 32) % 16) + 1;
		const t = map.get(s);
		if (t) return { texture: t, stride: s };
	}
	return null;
};

/** what the run views weigh on the GPU, MB (dev hook and the notes): the pages, and with the mip chain if they have one */
export const runMemory = () => {
	const base = sources.reduce((n, s) => n + (s.pixelWidth * s.pixelHeight * 4) / 1048576, 0);
	const mips = sources.some((s) => s.autoGenerateMipmaps);
	return { tier: TIER, loaded: textures !== null, sheets: sources.map((s) => `${s.pixelWidth}x${s.pixelHeight}`), mb: Math.round(base * 10) / 10, mipmapped: mips, mbWithMips: Math.round(base * (mips ? 4 / 3 : 1) * 10) / 10 };
};
