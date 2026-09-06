// Loads the BoneRutter mantis rig and builds per-component Rig instances. The atlas is the same
// stamped URL assets.ts preloads, so Pixi's Assets cache dedupes — the Spritesheet and its GPU
// texture exist once no matter how many rigs are alive (base-game Marty, bonus Marty, bonus Marky).
import { Assets, type Spritesheet } from 'pixi.js';

import { Rig, type RigFile } from '../bonerutter';
import { stamp } from './assets';
import { RIG } from './constants';

const RIG_URL = stamp(new URL('../../assets/rig/mantis-set.bonerig.json', import.meta.url).href);
const ATLAS_URL = stamp(new URL('../../assets/rig/mantis-set.atlas.json', import.meta.url).href);

let filesPromise: Promise<[RigFile, Spritesheet]> | null = null;
const loadFiles = () =>
	(filesPromise ??= Promise.all([Assets.load<RigFile>(RIG_URL), Assets.load<Spritesheet>(ATLAS_URL)]));

/** A fresh Rig (30 sprites, cheap) sharing the cached rig file + spritesheet. */
export const createMantisRig = async (): Promise<Rig> => {
	const [file, sheet] = await loadFiles();
	return Rig.fromData(file, [sheet]);
};

/** Idle-frame-0 local bounds — measured once per rig; BoneRig.svelte centres its pivot on this
 *  box and scales it to the layout slot, the footprint the placeholder Sprite occupied. */
export const measureIdlePose = (rig: Rig) => {
	rig.setFrame('idle', 0);
	const b = rig.view.getLocalBounds();
	return { x: b.x, y: b.y, width: b.width, height: b.height };
};

/** A rig part's bone-origin position in the coordinate space of the Container that hosts the
 *  BoneRig (the mantis's anchor-0.5 frame) — used to aim the eaten insect's flight at the mouth.
 *  Pure arithmetic on the wrapper transform rather than toGlobal/toLocal, so it needs no scene
 *  traversal and is exact regardless of when in the frame it's read. */
export const rigPointInHost = (rig: Rig, part: string, mirror: boolean) => {
	const n = rig.part(part);
	if (!n) return null;
	const v = rig.view;
	const x = (n.position.x - v.pivot.x) * v.scale.x;
	const y = (n.position.y - v.pivot.y) * v.scale.y;
	return { x: mirror ? -x : x, y };
};

// ── clip bookkeeping ────────────────────────────────────────────────────────────────────────────
// The Rig keeps its current clip private, but idle rotation and anticipation need to know what a
// rig is doing (an idle may be swapped for variety; a strike must never be). Route every play in
// game code through playClip so the last-known clip is queryable.
const lastClip = new WeakMap<Rig, string>();

export const playClip = (rig: Rig, name: string, opts?: Parameters<Rig['play']>[1]) => {
	lastClip.set(rig, name);
	rig.play(name, opts);
};

export const currentClip = (rig: Rig) => lastClip.get(rig);

const IDLE_NAMES: readonly string[] = [...RIG.idles.map((i) => i.name), RIG.bored];
// consecutive primary-idle picks since this rig's last variant (a fresh rig counts as "settled")
const primaryRun = new WeakMap<Rig, number>();

/**
 * Weighted pick from the idle pool, random start frame so multiple rigs never sync up. One pick in
 * RIG.boredChance plays the bored clip once instead, then rolls the pool again on completion.
 * Variants (Idle 2 / idle 3 / bored) are only eligible once the primary idle has played
 * RIG.idlesBetweenVariants times in a row, so no two variants ever meet.
 */
export const playIdle = (rig: Rig) => {
	const run = primaryRun.get(rig) ?? RIG.idlesBetweenVariants;
	const primary = RIG.idles[0].name;
	let name: (typeof RIG.idles)[number]['name'] = primary;
	if (run >= RIG.idlesBetweenVariants) {
		if (Math.random() < RIG.boredChance) {
			primaryRun.set(rig, 0);
			playClip(rig, RIG.bored, { loop: false, onComplete: () => playIdle(rig) });
			return;
		}
		let roll = Math.random() * RIG.idles.reduce((acc, i) => acc + i.weight, 0);
		for (const idle of RIG.idles) {
			roll -= idle.weight;
			name = idle.name;
			if (roll <= 0) break;
		}
	}
	primaryRun.set(rig, name === primary ? run + 1 : 0);
	playClip(rig, name, { loop: true, startFrame: Math.floor(Math.random() * 48) });
};

/**
 * Play the bored clip once, `loops` idle loops (~2 s each) from now: the beat Corey wants a few
 * loops after the landing screen's press, every time the game is loaded. Waits for the rig to
 * actually be idling (a strike/reaction/walk is never cut; the loading screen may still be up),
 * gives up after 30 s of never idling, and counts as a variant for the two-primary-idles rule.
 */
const boredTimers = new WeakMap<Rig, ReturnType<typeof setTimeout>>();
export const scheduleBored = (rig: Rig, loops = 3) => {
	const prev = boredTimers.get(rig);
	if (prev) clearTimeout(prev);
	const deadline = performance.now() + loops * 2000 + 30000;
	const attempt = () => {
		if (!isIdling(rig) || currentClip(rig) === RIG.bored) {
			if (performance.now() < deadline) boredTimers.set(rig, setTimeout(attempt, 500));
			return;
		}
		primaryRun.set(rig, 0);
		playClip(rig, RIG.bored, { loop: false, onComplete: () => playIdle(rig) });
	};
	boredTimers.set(rig, setTimeout(attempt, loops * 2000 + Math.random() * 1000));
};

/** True while the rig is in an idle clip, bored included (safe to swap or overlay). */
export const isIdling = (rig: Rig) => rig.isPlaying && IDLE_NAMES.includes(currentClip(rig) ?? '');
