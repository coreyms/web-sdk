// Loads the BoneRutter mantis rig and builds per-component Rig instances. The atlas is the same
// stamped URL assets.ts preloads, so Pixi's Assets cache dedupes — the Spritesheet and its GPU
// texture exist once no matter how many rigs are alive (base-game Marty, bonus Marty, bonus Marky).
import { Assets, type Spritesheet } from 'pixi.js';

import { Rig, type RigFile } from '../bonerutter';
import { stamp } from './assets';

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
