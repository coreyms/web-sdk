// THE ROAMING REINDEER'S FRAMES (2026-11-17; game/road/roam.ts): the rig's walk, walk start, walk stop and sniff (idle)
// clips of the same export as the strike's run views (tools/build_roam.py made the sheets and game/reindeerRoamSpec.ts).
// Every frame's texture keeps its clip's whole box as its `orig` (the sheets hold only the trimmed ink), so a sprite
// anchored at the clip's feet point stands on its feet in every frame, and a negative x scale mirrors it about them.
//
// Loading: after the run views (components/Board.svelte), in the background, through the same upload queue at the
// lowest priority. Until they are in there is no roaming reindeer, and the first strike of a spin comes from off the
// screen as before (STRIKE.roam's fallback).
import * as PIXI from 'pixi.js';

import { REINDEER_ROAM } from '../reindeerRoamSpec';
import { stamp } from '../assets';
import { PHONE_TIER } from '../deviceTier';
import { STAGING_TOOLS, perfMark } from '../staging';
import { queueRunUpload } from './columnClips';

export type RoamClip = 'walk' | 'start' | 'stop' | 'sniff';
export const ROAM_CLIPS: readonly RoamClip[] = ['walk', 'start', 'stop', 'sniff'];

const TIER = PHONE_TIER ? 'phone' : 'full';
const spec = REINDEER_ROAM.tiers[TIER];

/** one clip's box in road px at the built size, its anchor as a share of the box, and its rig frames */
export type RoamBox = { width: number; height: number; anchorX: number; anchorY: number };
export const roamBox = (clip: RoamClip): RoamBox => {
	const c = REINDEER_ROAM.clips[clip];
	const k = REINDEER_ROAM.roadPxPerFramePx;
	return { width: c.frameW * k, height: c.frameH * k, anchorX: c.anchorX / c.frameW, anchorY: c.anchorY / c.frameH };
};

/** per clip: the packed rig frames in order, and their textures (index = position in that list) */
let textures: Record<RoamClip, PIXI.Texture[]> | null = null;
let loading: Promise<boolean> | null = null;
let sources: PIXI.TextureSource[] = [];
let mipmapper: ((source: PIXI.TextureSource) => void) | null = null;

/** the packed rig frame numbers of a clip (1 based, ascending) */
export const roamFramesOf = (clip: RoamClip): readonly number[] => REINDEER_ROAM.clips[clip].frames;

/** set by components/Board.svelte on the desktop tier: give a sheet its mip chain before it goes to the GPU */
export const setRoamMipmapper = (fn: typeof mipmapper) => {
	mipmapper = fn;
};

/** start loading the roam sheets (or join the load running); resolves true when every page is on the GPU */
export const loadRoamFrames = (): Promise<boolean> => {
	if (textures) return Promise.resolve(true);
	loading ??= (async () => {
		try {
			const pages: PIXI.TextureSource[] = [];
			for (const [n, sheet] of spec.sheets.entries()) {
				const base = (await PIXI.Assets.load(stamp(`/assets/${sheet.file}`))) as PIXI.Texture;
				mipmapper?.(base.source);
				await queueRunUpload(`reindeer-roam:${n + 1}/${spec.sheets.length}`, base, () => false);
				pages.push(base.source);
			}
			const out = {} as Record<RoamClip, PIXI.Texture[]>;
			for (const clip of ROAM_CLIPS) {
				const box = spec.boxes[clip];
				const frames = spec.frames[clip] as Record<string, { sheet: number; x: number; y: number; w: number; h: number; ox: number; oy: number }>;
				out[clip] = roamFramesOf(clip).map((f) => {
					const p = frames[String(f)];
					return new PIXI.Texture({ source: pages[p.sheet], frame: new PIXI.Rectangle(p.x, p.y, p.w, p.h), orig: new PIXI.Rectangle(0, 0, box.w, box.h), trim: new PIXI.Rectangle(p.ox, p.oy, p.w, p.h) });
				});
			}
			sources = pages;
			textures = out;
			if (STAGING_TOOLS) perfMark('load:reindeer-roam');
			return true;
		} catch (error) {
			// without them there is no roaming reindeer: the strikes run as before
			console.warn('[reindeer] roam frames failed to load', error);
			loading = null;
			return false;
		}
	})();
	return loading;
};

export const roamFramesReady = (): boolean => textures !== null;

/** the texture of a clip at a rig frame (1 based, a float): the packed frame NEAREST the rig frame due (the sheets
 *  carry every 4th or 6th rig frame; the rig's clock is the clip's own). A loop counts round its end (rig frame 39 of the
 *  40 frame walk is as near its frame 1 as its 37), and a tie goes to the earlier frame. So the joins land on the
 *  nearest packed frame: the start hands over to the walk at walk 39 (its packed 37), the stop ends on the stand. */
export const roamTexture = (clip: RoamClip, rigFrame: number): PIXI.Texture | null => {
	const list = textures?.[clip];
	if (!list) return null;
	const c = REINDEER_ROAM.clips[clip];
	const frames = c.frames as readonly number[];
	const span = c.rigFrames;
	let best = 0;
	let bestD = Infinity;
	for (let i = 0; i < frames.length; i++) {
		let d = Math.abs(frames[i] - rigFrame);
		if (c.loop) d = Math.min(d, span - d);
		if (d < bestD - 1e-6) {
			best = i;
			bestD = d;
		}
	}
	return list[best];
};

/** what the roam sheets weigh on the GPU, MB (dev hook and the notes) */
export const roamMemory = () => {
	const base = sources.reduce((n, s) => n + (s.pixelWidth * s.pixelHeight * 4) / 1048576, 0);
	const mips = sources.some((s) => s.autoGenerateMipmaps);
	return { tier: TIER, loaded: textures !== null, sheets: sources.map((s) => `${s.pixelWidth}x${s.pixelHeight}`), mb: Math.round(base * 10) / 10, mipmapped: mips, mbWithMips: Math.round(base * (mips ? 4 / 3 : 1) * 10) / 10 };
};
