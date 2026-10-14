// THE CREATURE'S LOADER (game/creatureAssets.ts has the files, game/creature.ts draws them; constants CREATURE).
// DEFERRED, never a preload: the game is playable before he arrives and he fades in when his idle sheet lands.
// game/deferredLoad.ts calls loadCreatureBoot at its place in the deferred order (after the flames' clips); from
// then on a change of mode loads the look that mode shows, on demand.
// THE IDLE SHEET FIRST, THE REST BEHIND THE SYMBOLS (2026-10-13): loadCreatureBoot resolves when the IDLE group is in,
// and the attacks and the alternates of whatever look is loading are HELD until game/deferredLoad.ts calls
// releaseCreatureRest, after the labels and the symbols' drop and idle sheets. On a slow link his 15 MB no longer sit
// in front of the symbols' own sheets; he stands there breathing meanwhile, and an action whose sheet is not in yet is
// simply not played (game/creature.ts canPlay: no wait, no throw, the board's timing untouched).
//
// ONE LOOK RESIDENT. A look is three groups, fetched one after another and each uploaded once, when it lands
// (renderer.prepare.upload, so no upload happens in the frame an action starts; the sources are kept out of Pixi's
// idle texture collection, so none is uploaded again mid play):
//   creatureIdle   the idle sheet and, once, the shadows of every clip      -> he shows (or the change of look starts)
//   creatureActs   swipe, roar, charge_in, charge_loop, sting_hit, sting_recrouch (last: only ever played inside a
//                  sting run, and no sting is played until it is in) and, once, the glow atlas
//   creatureAlts   snarl, growl
// Until an action's sheet is in, that action is simply not played. On a change of mode the old look keeps playing
// until the new one's idle sheet is uploaded, the two cross over (game/creature.ts), and the old look is then
// UNLOADED (PIXI.Assets.unload: its GPU copies and its decoded pictures both go; the files stay in the HTTP cache,
// so coming back to it downloads nothing). For the length of the crossfade two looks' sheets are on the GPU.
//
// WHO OWNS A LOOK'S FILES (2026-10-13). Unloading DESTROYS textures, and a destroyed texture that is still drawn, or
// still waiting for its upload, throws inside Pixi. So a file is destroyed only when all of this holds:
//   - he does not draw the look, is not crossing over to it, and the mode does not ask for it (creature.uses; the
//     look waiting to fade in counts, which the first version missed when a third look was asked for meanwhile)
//   - every run that fetched files of that look has ENDED (nothing of it is on the wire or waiting for its upload),
//     and the renderer's upload queue is empty (the game's warm-up at the landing screen's end queues every texture
//     on the stage, the frame he is showing among them)
//   - no NEW run for that look has started meanwhile. A look can be let go and asked for again before its files
//     have gone (two quick changes of mode while a sheet is on the wire). Then the files are not destroyed at all:
//     they are handed to the new run (`sweep`: "kept"), which finds them in Pixi's cache.
// The files of a look that was let go wait in `trash[look]` until then; one sweeper per look works through it.
import * as PIXI from 'pixi.js';

import { creature } from './creature';
import { CREATURE_FILES, CREATURE_SHARED, type CreatureClip, type CreatureLook } from './creatureAssets';

type GroupLog = Record<string, { start: number; end: number; keys: number; failed: number }>;
type Sheet = { textures: Record<string, PIXI.Texture> };

const GROUPS: { name: string; clips: CreatureClip[]; shared: (keyof typeof CREATURE_SHARED)[] }[] = [
	{ name: 'creatureIdle', clips: ['idle'], shared: ['shadow'] },
	{ name: 'creatureActs', clips: ['swipe', 'roar', 'charge_in', 'charge_loop', 'sting_hit', 'sting_recrouch'], shared: ['glow'] },
	{ name: 'creatureAlts', clips: ['snarl', 'growl'], shared: [] },
];

/** the renderer, for the one upload per sheet (components/Background.svelte sets it) */
export const creatureLoader = { renderer: null as null | (() => PIXI.Renderer | undefined) };
/** DEV / probe: every load, upload and unload, oldest first */
export const creatureLoadLog: { t: number; what: 'load' | 'upload' | 'unload' | 'failed' | 'dropped' | 'kept'; look: string; file: string; ms?: number }[] = [];
const note = (what: (typeof creatureLoadLog)[number]['what'], look: string, file: string, ms?: number) => {
	if (!import.meta.env.DEV) return;
	creatureLoadLog.push({ t: performance.now(), what, look, file, ms });
	if (creatureLoadLog.length > 400) creatureLoadLog.splice(0, 200);
};

let booted = false;
let groupLog: GroupLog | null = null;
const shared: Partial<Record<keyof typeof CREATURE_SHARED, boolean>> = {};
/** per look: the run that is loading it (a look let go mid load is dropped by its run), and the files it holds */
const runs: Partial<Record<CreatureLook, { id: number; done: Promise<void>; idle: Promise<void>; drop: () => void; urls: string[] }>> = {};
let serial = 0;
/** per look: the files of runs that were let go, waiting to be destroyed; the runs that must end first; the one
 *  destroy in flight; whether its sweeper is at work (see WHO OWNS A LOOK'S FILES) */
const trash: Partial<Record<CreatureLook, { urls: string[]; ends: Promise<void>[]; busy: Promise<void> | null; sweeping: boolean }>> = {};
/** the hold on everything after the idle group: set by the boot, let go by releaseCreatureRest (null: no hold) */
let rest: Promise<void> | null = null;
let letRestGo = () => {};

const fetchSheet = async (url: string, look: string): Promise<Sheet | null> => {
	const t0 = performance.now();
	try {
		const sheet = (await PIXI.Assets.load(url)) as Sheet;
		const first = Object.values(sheet.textures)[0];
		if (!first) return null;
		// resident for good: never collected when idle (a roar's sheet can go unused for a long time), no mipmaps
		first.source.autoGarbageCollect = false;
		note('load', look, url.split('/').pop()!.split('?')[0], performance.now() - t0);
		const t1 = performance.now();
		await creatureLoader.renderer?.()?.prepare?.upload(first.source);
		note('upload', look, url.split('/').pop()!.split('?')[0], performance.now() - t1);
		return sheet;
	} catch {
		note('failed', look, url.split('/').pop()!.split('?')[0]);
		return null;
	}
};

/** let a look go: its run ends, he forgets its textures, and its files go to the trash (destroyed by `sweep`) */
const unload = (look: CreatureLook): void => {
	const run = runs[look];
	if (!run) return;
	delete runs[look];
	creature.forget(look);
	// (a run held behind the symbols is let out of its hold: it sees it is no longer the look's run and ends)
	run.drop();
	const bin = (trash[look] ??= { urls: [], ends: [], busy: null, sweeping: false });
	for (const url of run.urls) if (!bin.urls.includes(url)) bin.urls.push(url);
	bin.ends.push(run.done);
	if (!bin.sweeping) void sweep(look);
};

/** destroy what is in a look's trash, one file at a time, each only when it is safe (WHO OWNS A LOOK'S FILES) */
const sweep = async (look: CreatureLook) => {
	const bin = trash[look]!;
	bin.sweeping = true;
	for (;;) {
		// nothing of it may be waiting in the renderer's upload queue (resolves at once when the queue is empty), and
		// whatever of the runs that held these files is still on its way lands first (more may be let go meanwhile)
		await creatureLoader.renderer?.()?.prepare?.upload();
		while (bin.ends.length) await bin.ends.shift()!.catch(() => {});
		const back = runs[look];
		if (back) {
			// THE LOOK CAME BACK before its files went: they are the new run's now, and nothing is destroyed
			for (const url of bin.urls) if (!back.urls.includes(url)) back.urls.push(url);
			note('kept', look, `${bin.urls.length} files`);
			bin.urls.length = 0;
			break;
		}
		const url = bin.urls.shift();
		if (!url) break;
		bin.busy = PIXI.Assets.unload(url).then(
			() => note('unload', look, url.split('/').pop()!.split('?')[0]),
			() => {
				/* never loaded */
			},
		);
		await bin.busy;
		bin.busy = null;
	}
	bin.sweeping = false;
};

const load = (look: CreatureLook) => {
	const id = ++serial;
	const urls: string[] = [];
	const mine = () => runs[look]?.id === id;
	let idleIn = () => {};
	let drop = () => {};
	const dropped = new Promise<void>((resolve) => (drop = resolve));
	const entry = { id, done: Promise.resolve(), idle: new Promise<void>((resolve) => (idleIn = resolve)), drop, urls };
	// (listed BEFORE the first line of the run: with the shared sheets already in, it reaches mine() without a wait)
	runs[look] = entry;
	entry.done = (async () => {
		// (a file of this look is being destroyed this very moment: that one finishes first, the sweeper then sees this
		// run and stops. Only ever the length of one destroy, which waits for nothing)
		const busy = trash[look]?.busy;
		if (busy) await busy;
		for (const group of GROUPS) {
			const first = !groupLog?.[group.name];
			const log = first && groupLog ? (groupLog[group.name] = { start: performance.now(), end: 0, keys: group.clips.length + group.shared.length, failed: 0 }) : null;
			for (const kind of group.shared) {
				if (shared[kind]) continue;
				const sheet = await fetchSheet(CREATURE_SHARED[kind], 'shared');
				if (sheet && creature.setShared(kind, sheet.textures)) shared[kind] = true;
				else if (log) log.failed += 1;
			}
			for (const clip of group.clips) {
				if (!mine()) return;
				// a look that is not on show, not crossing over and not wanted any more is not worth another sheet
				if (!creature.uses(look)) {
					note('dropped', look, clip);
					unload(look);
					return;
				}
				const url = CREATURE_FILES[look][clip];
				if (!urls.includes(url)) urls.push(url);
				const sheet = await fetchSheet(url, look);
				if (!mine()) return;
				if (!sheet || !creature.setClip(look, clip, sheet.textures)) {
					if (log) log.failed += 1;
				}
			}
			if (log) log.end = performance.now();
			if (!mine()) return;
			if (group.name === 'creatureIdle') {
				creature.lookReady(performance.now());
				idleIn();
				// the attacks and the alternates wait behind the symbols' sheets (see the header)
				if (rest) await Promise.race([rest, dropped]);
				if (!mine()) return;
			}
		}
	})().finally(idleIn);
	return entry.done;
};

const ensure = (look: CreatureLook): Promise<void> => {
	if (runs[look]) {
		// already here (or on its way): the change of look can start as soon as its idle sheet is in
		creature.lookReady(performance.now());
		return runs[look]!.done;
	}
	return load(look);
};

creature.onWantLook = (look) => {
	if (booted) void ensure(look);
};
creature.onLookFree = (look) => unload(look);

/** the creature's place in the deferred phase: the look of the mode the game is in NOW (a round resumed in a SUPER
 *  loads the super look, not the day one first). Resolves when that look's IDLE group is in (he is on show); the
 *  other two groups are held until releaseCreatureRest. Never rejects. */
export const loadCreatureBoot = (log: GroupLog): Promise<void> => {
	groupLog = log;
	booted = true;
	rest = new Promise<void>((resolve) => (letRestGo = resolve));
	const look = creature.wanted;
	void ensure(look).catch(() => {});
	return (runs[look]?.idle ?? Promise.resolve()).catch(() => {});
};

/** the symbols' sheets are in: his attacks and alternates may load now. Resolves when the look on its way has all
 *  three groups (or at once when he was never booted); never rejects. Safe to call twice. */
export const releaseCreatureRest = (): Promise<void> => {
	rest = null;
	letRestGo();
	return (runs[creature.wanted]?.done ?? Promise.resolve()).catch(() => {});
};

/** DEV / probe: what is loaded, per look */
export const creatureLoadState = () => ({ booted, held: !!rest, shared: { ...shared }, looks: Object.fromEntries(Object.entries(runs).map(([look, run]) => [look, run!.urls.length])), trash: Object.fromEntries(Object.entries(trash).map(([look, bin]) => [look, bin!.urls.length])) });
