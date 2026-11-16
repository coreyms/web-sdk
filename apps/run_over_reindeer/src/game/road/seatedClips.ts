// THE SEATED DRIVERS' ANIMATIONS (Corey 2026-11-16: "Not staying with the stills"; constants SEATED.clips,
// tools/build_seated_clips.py, game/seatedClipSpec.ts). Grandma's and Santa's idle (a 4.0 s loop) and win reaction (once),
// each its own small sheet per tier: the head as an animated patch over the still's body (the still with its head cut
// away), so the hands stay on the wheel and the door line covers them exactly as the still's.
//
// LOADED ONLY WHEN NEEDED, and let go after (the column characters' pattern, game/road/columnClips.ts): an idle while a
// vehicle of that character stands at rest on the board, kept SEATED.clips.idleKeepMs after the last one left (a spin's
// drive away and back does not reload it); a win when a win with that vehicle starts, let go winKeepMs after it ends. A
// sheet goes to the GPU through the renderer's prepare (Board.svelte setSeatUploader) as it loads, not on its first draw.
import * as PIXI from 'pixi.js';

import { SEATED } from '../constants';
import { SEATED_CLIPS } from '../seatedClipSpec';
import { seatedClipUrl } from '../assets';

export type SeatChar = 'grandma' | 'santa';
export type SeatClipName = 'idle' | 'win';
type Tier = 'full' | 'phone';
type ClipSpec = { fps: number; loop: boolean; tiers: Record<Tier, { sheet: string; size: number[]; mb: number; frames: number[][]; timeline: number[][]; body: number[] }> };

/** a loaded clip: its kept frames' textures with their rects (0..1 of the driver picture), the body, the timeline */
export type SeatClip = {
	character: SeatChar;
	clip: SeatClipName;
	fps: number;
	loop: boolean;
	frames: { tex: PIXI.Texture; rect: number[] }[];
	body: { tex: PIXI.Texture; rect: number[] };
	/** [kept frame, steps held] */
	timeline: number[][];
	/** the clip's length, ms */
	lengthMs: number;
	mb: number;
};

type Entry = { state: 'none' | 'loading' | 'ready'; clip: SeatClip | null; url: string; lastWanted: number; gen: number; unload: ReturnType<typeof setTimeout> | null };
const entries = new Map<string, Entry>();
let uploader: ((t: PIXI.Texture) => unknown) | null = null;
/** components/Board.svelte: the renderer's prepare, so a sheet goes to the GPU as it loads */
export const setSeatUploader = (fn: typeof uploader) => {
	uploader = fn;
};

const spec = (c: SeatChar, clip: SeatClipName): ClipSpec => (SEATED_CLIPS.characters as unknown as Record<string, { clips: Record<string, ClipSpec> }>)[c].clips[clip];

const entry = (c: SeatChar, clip: SeatClipName, tier: Tier): Entry => {
	const key = `${c}:${clip}:${tier}`;
	let e = entries.get(key);
	if (!e) {
		e = { state: 'none', clip: null, url: seatedClipUrl(c, clip, tier), lastWanted: -Infinity, gen: 0, unload: null };
		entries.set(key, e);
	}
	return e;
};

async function load(c: SeatChar, clip: SeatClipName, tier: Tier, e: Entry) {
	e.state = 'loading';
	const gen = ++e.gen;
	// wanted again before its unload ran: the sheet is still in the cache
	if (e.unload) {
		clearTimeout(e.unload);
		e.unload = null;
	}
	try {
		const sheet = await PIXI.Assets.load<PIXI.Spritesheet>(e.url);
		if (gen !== e.gen || e.state !== 'loading') return;
		const s = spec(c, clip);
		const t = s.tiers[tier];
		const frames = t.frames.map((rect, n) => ({ tex: sheet.textures[`${c}_${clip}_${n}`], rect }));
		const body = { tex: sheet.textures[`${c}_body`], rect: t.body };
		if (!body.tex || frames.some((f) => !f.tex)) throw new Error(`seated clip ${c} ${clip}: a frame is missing`);
		const steps = t.timeline.reduce((n, x) => n + x[1], 0);
		await uploader?.(body.tex);
		if (gen !== e.gen) return;
		e.clip = { character: c, clip, fps: s.fps, loop: s.loop, frames, body, timeline: t.timeline, lengthMs: (steps * 1000) / s.fps, mb: t.mb };
		e.state = 'ready';
	} catch {
		if (gen === e.gen) e.state = 'none';
	}
}

/** this frame: is the clip wanted (realNow: performance.now). Returns it when it is in. */
export const seatClip = (c: SeatChar, clip: SeatClipName, tier: Tier, wanted: boolean, realNow: number): SeatClip | null => {
	if (!SEATED.clips.on) return null;
	const e = entry(c, clip, tier);
	if (wanted) {
		e.lastWanted = realNow;
		if (e.state === 'none') void load(c, clip, tier, e);
		return e.state === 'ready' ? e.clip : null;
	}
	const keep = clip === 'idle' ? SEATED.clips.idleKeepMs : SEATED.clips.winKeepMs;
	if (e.state !== 'none' && realNow - e.lastWanted > keep) release(e);
	return e.state === 'ready' ? e.clip : null;
};

/** let a sheet go: at once nothing draws it any more (the road resets every driver showing it, the same frame), and the
 *  textures are destroyed a little later, never in a frame that may still have batched them */
const release = (e: Entry) => {
	e.gen += 1;
	e.state = 'none';
	e.clip = null;
	if (e.unload) clearTimeout(e.unload);
	e.unload = setTimeout(() => {
		e.unload = null;
		if (e.state === 'none') void PIXI.Assets.unload(e.url).catch(() => {});
	}, 300);
};

/** the kept frame to draw `ms` into the clip (a loop wraps; a clip played once holds its last frame, done = true) */
export const seatFrame = (clip: SeatClip, ms: number): { frame: number; done: boolean } => {
	const step = Math.floor((Math.max(0, ms) * clip.fps) / 1000);
	const total = clip.timeline.reduce((n, x) => n + x[1], 0);
	if (!clip.loop && step >= total) return { frame: clip.timeline[clip.timeline.length - 1][0], done: true };
	let s = clip.loop ? step % total : step;
	for (const [frame, hold] of clip.timeline) {
		if (s < hold) return { frame, done: false };
		s -= hold;
	}
	return { frame: clip.timeline[0][0], done: false };
};

/** DEV / probes: what is loaded now and its GPU weight (MB, the sheets as packed: 4 bytes a px, no mips) */
export const seatClipMemory = () => {
	const out: Record<string, { state: string; mb: number }> = {};
	let mb = 0;
	for (const [key, e] of entries) {
		out[key] = { state: e.state, mb: e.clip?.mb ?? 0 };
		if (e.state === 'ready') mb += e.clip?.mb ?? 0;
	}
	return { clips: out, mb: Math.round(mb * 1000) / 1000 };
};

/** the board goes: everything let go */
export const releaseAllSeatClips = () => {
	for (const e of entries.values()) if (e.state !== 'none') release(e);
};
