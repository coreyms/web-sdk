// THE CREATURE'S LOADER (game/creatureAssets.ts has the files, game/creature.ts draws them; constants CREATURE).
// DEFERRED, never a preload: the game is playable before he arrives. Only his STILL is in the first download (game/
// assets.ts creatureStill, game/creature.ts setStill): he stands there from the first frame and starts breathing when his
// idle sheet lands. game/deferredLoad.ts calls loadCreatureBoot first thing after the gate (first-minute plan D,
// constants CREATURE.restHeldAfter); from then on a change of mode loads the look that mode shows, on demand.
// THE IDLE SHEET FIRST, THEN HIS ATTACKS, HIS ALTERNATES LAST (plan D, 2026-10-16; since 2026-10-13 the attacks waited
// behind the symbols' sheets, which are now in the gate): loadCreatureBoot hands back two promises, `idle` (his idle group
// is in: he breathes) and `held` (the run has reached the group CREATURE.restHeldAfter names, his attacks: what follows
// is HELD until game/deferredLoad.ts calls releaseCreatureRest, after the scene's night set, the night frame, the flames
// and the labels). An action whose sheet is not in yet is simply not played (game/creature.ts canPlay: no wait, no
// throw, the board's timing untouched). DEV `?creaturehold=1`: the hold is after his idle group instead.
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
//
// WHEN A FEATURE'S LOOK IS FETCHED (2026-10-14, constants CREATURE.lookLoad; Corey: "The 12MB download, not okay [...]
// Not okay to wait til the feature and show the wrong manticore", then "I'd rather load the wrong manticore in the rare
// case a player gets a super or epic on first spin, not hide it completely"). Until then the first SUPER or EPIC of a
// session downloaded its look at the change of mode, and he stayed in his day look until it landed. Now:
//   THE PREFETCH   once every deferred group is in (creatureDeferredDone) AND the player's first round has settled
//                  (creatureRoundSettled), the files of SUPER then EPIC, this tier's only, are fetched into the HTTP
//                  cache: one file at a time, `fetch` at low priority, the body read and thrown away. Nothing is
//                  decoded, nothing goes to the GPU, Pixi's cache does not see them: one look stays resident. The
//                  sheet's picture is asked for by the very URL Pixi asks for it later (the json's folder + meta.image +
//                  the json's own query, as pixi.js's spritesheet loader builds it), so the change of look finds both
//                  files in the cache. A new file does not start while a round's play request is on the wire
//                  (creatureRoundRequest); one already on its way runs on at low priority (a fetch cannot be paused)
//   EARLY          creatureBookArrived: the round's book has a feature in it (its first bonusStart), or
//                  creatureBuyArmed: a Super or Epic buy is armed. That look starts loading at once (creature.prepare),
//                  its idle sheet decoded and uploaded during the trigger and the intro, and its attacks and alternates
//                  wait until the mode asks for it and the crossover to it is over (for every change of look): until
//                  the old look is let go only the new one's idle sheet is on the GPU beside it. A look no longer coming (the buy disarmed, the book played out) is let go as usual
//   NOT READY      if the look is still not in when the feature shows, he stays in the look on show, never hidden,
//                  and the two cross over when its idle sheet is up, exactly as before
import * as PIXI from 'pixi.js';

import { CREATURE } from './constants';
import { creature } from './creature';
import { CREATURE_FILES, CREATURE_SHARED, type CreatureClip, type CreatureLook } from './creatureAssets';
import { imageOfSheet, loadStripSheet, uploadStrips, type StripSheet } from './stripUpload';

type GroupLog = Record<string, { start: number; end: number; keys: number; failed: number }>;
type Sheet = { textures: Record<string, PIXI.Texture> };

const GROUPS: { name: string; clips: CreatureClip[]; shared: (keyof typeof CREATURE_SHARED)[] }[] = [
	// (the shade, the back-feet shade's atlas, only while its option B is on: constants CREATURE_SHADE, sharedWanted())
	{ name: 'creatureIdle', clips: ['idle'], shared: ['shadow', 'shade'] },
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
/** a shared sheet on its way or in (one fetch however many runs, or the DEV shade switch, ask; a failure may be asked again) */
const sharedLoads: Partial<Record<keyof typeof CREATURE_SHARED, Promise<boolean>>> = {};
/** the shared sheets a run fetches: the shade only while he draws option B (constants CREATURE_SHADE) */
const sharedWanted = (kind: keyof typeof CREATURE_SHARED): boolean => kind !== 'shade' || creature.shadeOption === 'B';
/** a shared sheet, once: fetched, uploaded and handed to him (resolves whether it is in; never rejects) */
export const loadCreatureShared = (kind: keyof typeof CREATURE_SHARED, needNow: () => boolean = () => false): Promise<boolean> =>
	(sharedLoads[kind] ??= (async () => {
		const sheet = await fetchSheet(CREATURE_SHARED[kind], 'shared', needNow);
		if (sheet && creature.setShared(kind, sheet.textures)) return (shared[kind] = true);
		delete sharedLoads[kind];
		return false;
	})());
/** per look: the run that is loading it (a look let go mid load is dropped by its run), and the files it holds */
const runs: Partial<Record<CreatureLook, { id: number; done: Promise<void>; idle: Promise<void>; held: Promise<void>; drop: () => void; urls: string[]; go: () => void; on: () => void }>> = {};
let serial = 0;
/** per look: the files of runs that were let go, waiting to be destroyed; the runs that must end first; the one
 *  destroy in flight; whether its sweeper is at work (see WHO OWNS A LOOK'S FILES) */
const trash: Partial<Record<CreatureLook, { urls: string[]; ends: Promise<void>[]; busy: Promise<void> | null; sweeping: boolean }>> = {};
/** the hold on everything after the group holdAfter() names: set by the boot, let go by releaseCreatureRest (null: no hold) */
let rest: Promise<void> | null = null;
/** the group after which a run waits for `rest` (constants CREATURE.restHeldAfter; DEV `?creaturehold=1`: his idle group) */
const holdAfter = (): string =>
	import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('creaturehold') === '1' ? 'creatureIdle' : CREATURE.restHeldAfter;
let letRestGo = () => {};

// ---- THE UPLOAD TURN (constants CREATURE.upload) ----------------------------------------------------------------------
// One upload at a time, at least gapMs after the last one ended. A sheet needed now skips the line, and the next turn
// counts its gap from it. (Destroys are not in it: the old look must go as soon as it is safe, ONE LOOK RESIDENT.)
let turn: Promise<void> = Promise.resolve();
let lastTurnEnd = 0;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** waits for this one's turn (`needNow` is asked again while it waits: the mode may start asking for the look); call the
 *  returned function when the upload is done */
const takeTurn = async (needNow: () => boolean): Promise<() => void> => {
	const U = CREATURE.upload;
	const done = () => {
		lastTurnEnd = performance.now();
	};
	if (!U.on || needNow()) return done;
	const before = turn;
	let free = () => {};
	turn = new Promise<void>((resolve) => (free = resolve));
	// (a sheet the mode starts asking for meanwhile does not wait behind the one ahead of it)
	let ahead = true;
	void before.then(() => (ahead = false));
	while (ahead && !needNow()) await wait(U.pollMs);
	const gap = lastTurnEnd + U.gapMs - performance.now();
	if (gap > 0 && !needNow()) await wait(gap);
	return () => {
		done();
		free();
	};
};

/** the sheets the strip path made (game/stripUpload.ts, constants CREATURE.upload.strips), by URL: Pixi's cache does not
 *  know them, so a look that comes back finds them here and a look let go is destroyed from here (`up`: its bands on
 *  their way, so a second ask waits for the same upload) */
const stripSheets = new Map<string, { sheet: Promise<StripSheet | null>; up: Promise<void> | null }>();
/** a sheet let go: destroyed whichever way it was loaded */
const unloadSheet = async (url: string): Promise<void> => {
	const own = stripSheets.get(url);
	if (!own) return PIXI.Assets.unload(url);
	stripSheets.delete(url);
	const made = await own.sheet;
	if (!made) return PIXI.Assets.unload(url);
	await own.up;
	made.sheet.destroy(true);
};

const fetchSheet = async (url: string, look: string, needNow: () => boolean = () => false): Promise<Sheet | null> => {
	const t0 = performance.now();
	let end: (() => void) | null = null;
	const file = url.split('/').pop()!.split('?')[0];
	try {
		// THE STRIP PATH first; null: this browser, this renderer or this sheet takes Pixi's path below
		let own = stripSheets.get(url);
		if (!own) stripSheets.set(url, (own = { sheet: loadStripSheet(url, creatureLoader.renderer?.()), up: null }));
		const made = await own.sheet;
		if (made && !made.source.destroyed) {
			note('load', look, `${file} (strips)`, performance.now() - t0);
			// (its turn and its bands in one promise, set at once: a second ask meanwhile waits for this same upload)
			own.up ??= made.source.done
				? Promise.resolve()
				: (async () => {
						const done = await takeTurn(needNow);
						const t1 = performance.now();
						try {
							await uploadStrips(creatureLoader.renderer?.(), made.source);
							note('upload', look, `${file} (strips)`, performance.now() - t1);
						} finally {
							done();
						}
					})();
			await own.up;
			return { textures: made.sheet.textures };
		}
		if (!made) stripSheets.delete(url);
		const sheet = (await PIXI.Assets.load(url)) as Sheet;
		const first = Object.values(sheet.textures)[0];
		if (!first) return null;
		// resident for good: never collected when idle (a roar's sheet can go unused for a long time), no mipmaps
		first.source.autoGarbageCollect = false;
		note('load', look, url.split('/').pop()!.split('?')[0], performance.now() - t0);
		end = await takeTurn(needNow);
		const t1 = performance.now();
		await creatureLoader.renderer?.()?.prepare?.upload(first.source);
		note('upload', look, url.split('/').pop()!.split('?')[0], performance.now() - t1);
		return sheet;
	} catch {
		note('failed', look, url.split('/').pop()!.split('?')[0]);
		return null;
	} finally {
		end?.();
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
		bin.busy = unloadSheet(url).then(
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
	let heldIn = () => {};
	let drop = () => {};
	let go = () => {};
	let on = () => {};
	const dropped = new Promise<void>((resolve) => (drop = resolve));
	/** the mode asks for this look (at once for the look of the mode; for a look loaded ahead, when its mode comes) */
	const wanted = new Promise<void>((resolve) => (go = resolve));
	/** he shows this look (the crossover to it is over, or it is his first) */
	const shown = new Promise<void>((resolve) => (on = resolve));
	const entry = { id, done: Promise.resolve(), idle: new Promise<void>((resolve) => (idleIn = resolve)), held: new Promise<void>((resolve) => (heldIn = resolve)), drop, urls, go, on };
	if (creature.wanted === look) go();
	if (creature.look === look) on();
	// (listed BEFORE the first line of the run: with the shared sheets already in, it reaches mine() without a wait)
	runs[look] = entry;
	entry.done = (async () => {
		// (a file of this look is being destroyed this very moment: that one finishes first, the sweeper then sees this
		// run and stops. Only ever the length of one destroy, which waits for nothing)
		const busy = trash[look]?.busy;
		if (busy) await busy;
		for (const group of GROUPS) {
			const first = !groupLog?.[group.name];
			const kinds = group.shared.filter(sharedWanted);
			const log = first && groupLog ? (groupLog[group.name] = { start: performance.now(), end: 0, keys: group.clips.length + kinds.length, failed: 0 }) : null;
			// NEEDED NOW (constants CREATURE.upload): the idle group of the look the mode asks for goes up at once; the rest
			// waits for a still moment
			const needNow = () => group.name === 'creatureIdle' && creature.wanted === look;
			for (const kind of kinds) {
				if (shared[kind]) continue;
				if (!(await loadCreatureShared(kind, needNow)) && log) log.failed += 1;
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
				const sheet = await fetchSheet(url, look, needNow);
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
			}
			if (group.name === holdAfter()) {
				heldIn();
				// what follows waits behind the scene's groups (see the header)
				if (rest) await Promise.race([rest, dropped]);
				if (!mine()) return;
			}
			if (group.name === 'creatureIdle') {
				// a look loaded AHEAD of its mode: the rest waits until the mode asks for it, and every new look's rest
				// waits until the crossover to it is over and the old look is let go (2026-10-14: so two looks' sheets
				// on the GPU are never more than the old look's and the new one's idle sheet; nothing of the new look but
				// its idle loop can be played before the crossover ends anyway)
				await Promise.race([wanted, dropped]);
				if (!mine()) return;
				if (creature.look !== look) await Promise.race([shown, dropped]);
				if (!mine()) return;
			}
		}
	})().finally(() => {
		idleIn();
		heldIn();
	});
	return entry.done;
};

const ensure = (look: CreatureLook): Promise<void> => {
	const run = runs[look];
	if (run) {
		// already here (or on its way, or loaded ahead): the change of look can start as soon as its idle sheet is in
		if (creature.wanted === look) run.go();
		creature.lookReady(performance.now());
		return run.done;
	}
	return load(look);
};

creature.onWantLook = (look) => {
	if (booted) void ensure(look);
};
creature.onLookFree = (look) => unload(look);
creature.onLookOn = (look) => runs[look]?.on();

/** the creature's place in the deferred phase: the look of the mode the game is in NOW (a round resumed in a SUPER
 *  loads the super look, not the day one first). `idle` resolves when that look's IDLE group is in (he breathes),
 *  `held` when the run has reached its hold (after CREATURE.restHeldAfter's group): the rest waits for
 *  releaseCreatureRest. Neither rejects. */
export const loadCreatureBoot = (log: GroupLog): { idle: Promise<void>; held: Promise<void> } => {
	groupLog = log;
	booted = true;
	rest = new Promise<void>((resolve) => (letRestGo = resolve));
	const look = creature.wanted;
	void ensure(look).catch(() => {});
	const idle = (runs[look]?.idle ?? Promise.resolve()).catch(() => {});
	const held = (runs[look]?.held ?? Promise.resolve()).catch(() => {});
	// a look named ahead before he was booted (a feature on the very first rounds) starts once his own is in
	void idle.then(() => {
		const ahead = creature.prepared;
		if (ahead && !runs[ahead]) void ensure(ahead).catch(() => {});
	});
	return { idle, held };
};

/** the symbols' sheets are in: his attacks and alternates may load now. Resolves when the look on its way has all
 *  three groups (or at once when he was never booted); never rejects. Safe to call twice. */
export const releaseCreatureRest = (): Promise<void> => {
	rest = null;
	letRestGo();
	return (runs[creature.wanted]?.done ?? Promise.resolve()).catch(() => {});
};

// ---- EARLY: the look of a feature that is coming (see the header) ---------------------------------------------------
/** the round's book is in (game/utils.ts playBet): the look of its feature, if it has one, loads now */
export const creatureBookArrived = (events: readonly { type: string; bonus?: string }[]): void => {
	creatureRoundRequest(false);
	if (!CREATURE.lookLoad.early) return;
	const start = events.find((e) => e.type === 'bonusStart');
	const look = start ? (CREATURE.looks as Record<string, CreatureLook>)[String(start.bonus)] : undefined;
	creature.prepare('book', look ?? null);
};
/** the round's book has played out (its feature with it): nothing is coming any more; the first settles the prefetch's
 *  second condition */
export const creatureBookDone = (): void => {
	creature.prepare('book', null);
	creatureRoundSettled();
};
/** the armed mode changed (components/Background.svelte): a Super or Epic buy's look loads now, a disarmed one is let go */
export const creatureBuyArmed = (modeKey: string | null | undefined): void => {
	if (!CREATURE.lookLoad.early) return;
	const look = (CREATURE.looks as Record<string, CreatureLook>)[String(modeKey ?? '').toLowerCase()];
	creature.prepare('buy', look && look !== CREATURE.looks.base ? look : null);
};

// ---- THE PREFETCH (see the header) -----------------------------------------------------------------------------------
/** DEV / probe: when its two conditions came and when it ran, and every file it fetched (performance.now(), bytes) */
export const creaturePrefetchLog = {
	deferredAt: 0,
	settledAt: 0,
	startAt: 0,
	doneAt: 0,
	/** a round's play request on the wire (no new file starts meanwhile) */
	request: false,
	waits: 0,
	files: [] as { url: string; look: string; start: number; end: number; bytes: number; ok: boolean; skipped?: boolean }[],
};
const P = creaturePrefetchLog;
/** every deferred group is in, the armoury's last (components/Game.svelte) */
export const creatureDeferredDone = (): void => {
	if (!P.deferredAt) P.deferredAt = performance.now();
	maybePrefetch();
};
/** a round has settled (its book played out) */
export const creatureRoundSettled = (): void => {
	if (!P.settledAt) P.settledAt = performance.now();
	maybePrefetch();
};
/** a round's play request goes out (true: the press, game/actor.ts) or has come back (false: its book, or its error) */
export const creatureRoundRequest = (on: boolean): void => {
	P.request = on;
};
const maybePrefetch = () => {
	if (!CREATURE.lookLoad.prefetch || P.startAt || !P.deferredAt || !P.settledAt || typeof fetch !== 'function') return;
	P.startAt = performance.now();
	void prefetchLooks();
};
const later = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** one file into the HTTP cache: fetched at low priority and read to its end, nothing kept (`text`: the body as text) */
const fetchToCache = async (url: string, look: string, text: boolean): Promise<string | null> => {
	while (P.request) {
		P.waits += 1;
		await later(CREATURE.lookLoad.waitMs);
	}
	const f = { url, look, start: performance.now(), end: 0, bytes: 0, ok: false };
	if (import.meta.env.DEV) P.files.push(f);
	try {
		const res = await fetch(url, { priority: 'low' } as RequestInit);
		let out: string | null = null;
		if (text) {
			out = await res.text();
			f.bytes = out.length;
		} else if (res.body) {
			const reader = res.body.getReader();
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				f.bytes += value.byteLength;
			}
		}
		f.ok = res.ok;
		return res.ok ? out ?? '' : null;
	} catch {
		return null;
	} finally {
		f.end = performance.now();
	}
};
const prefetchLooks = async () => {
	for (const look of CREATURE.lookLoad.prefetchLooks as readonly CreatureLook[]) {
		for (const group of GROUPS) {
			if (!(CREATURE.lookLoad.prefetchGroups as readonly string[]).includes(group.name)) continue;
			for (const clip of group.clips) {
				const url = CREATURE_FILES[look][clip];
				// a look loaded already (on show, or loading) has its files in: nothing to fetch
				if (runs[look]) {
					if (import.meta.env.DEV) P.files.push({ url, look, start: performance.now(), end: performance.now(), bytes: 0, ok: true, skipped: true });
					continue;
				}
				const body = await fetchToCache(url, look, true);
				if (body === null) continue;
				let image = '';
				try {
					image = String((JSON.parse(body) as { meta?: { image?: string } }).meta?.image ?? '');
				} catch {
					/* not a sheet: nothing more to fetch */
				}
				if (image) await fetchToCache(imageOfSheet(url, image), look, false);
			}
		}
	}
	P.doneAt = performance.now();
};

/** DEV / probe: what is loaded, per look */
export const creatureLoadState = () => ({ booted, held: !!rest, prepared: creature.prepared, shared: { ...shared }, looks: Object.fromEntries(Object.entries(runs).map(([look, run]) => [look, run!.urls.length])), trash: Object.fromEntries(Object.entries(trash).map(([look, bin]) => [look, bin!.urls.length])) });
