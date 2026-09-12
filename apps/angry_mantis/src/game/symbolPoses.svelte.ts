// Per-insect symbol pose playback (SYMBOL_POSES in constants.ts, components/SymbolPose.svelte).
//
// A "pose" is one clip of an insect's own atlas (tools/make_placeholders.py packs Corey's BoneRutter
// export into static/assets/sprites/poses-<p>.webp). Everything here is TEXTURE SWAPPING between
// frames that already live in that atlas — no texture is ever created, and the whole board shares
// ONE rAF, which only runs while something is actually animating.
//
// Poses are optional at every level: no entry in SYMBOL_POSES, a null clip, a sheet still
// downloading (they are deferred assets) or a clip the sheet does not carry all resolve to `null`
// and the cell keeps drawing its baked tile. Nothing in the game ever waits on a pose.
import * as PIXI from 'pixi.js';

import { stateBetDerived } from 'state-shared';

import { SYMBOL_POSES, BOARD_DIMENSIONS, type PoseBeat } from './constants';
import { doorPaintState } from './doorPaint.svelte';
import { stateGame } from './stateGame.svelte';
import { stateApp } from './stateApp';

export type PoseSource = PoseBeat | 'dev';

export type PoseRun = {
	reel: number;
	row: number;
	symbol: string;
	anim: string;
	source: PoseSource;
	total: number; // frames in the clip
	fps: number;
	loops: number; // passes before the clip ends (ignored while `hold`)
	hold: boolean; // loop until the caller releases it (the win pose)
	freeze: boolean; // stop on freezeAt and sit there (the eat pose)
	freezeAt: number; // the frame a freezing clip holds (SYMBOL_POSES eatFreezeFrame, else the last)
	scaled: boolean; // playback divided by stateBetDerived.timeScale() (land / win)
	startedAt: number;
	frame: number;
	done: boolean; // frozen on the last frame, waiting to be released
};

/** the pose playing in each cell, keyed "<reel>:<row>" (symbolIndexOfBoard space) */
export const poseRuns = $state<Record<string, PoseRun>>({});

export const poseKey = (reel: number, row: number) => `${reel}:${row}`;

// eat outranks win outranks land outranks ambient: a strike must never be overridden by a twitch
const PRIORITY: Record<PoseSource, number> = { ambient: 0, land: 1, win: 2, eat: 3, dev: 4 };

// ---- frame lookup -----------------------------------------------------------------------------
// `type: 'sprites'` assets land in stateApp.loadedAssets flattened by FRAME NAME, so the builder's
// "<SYM>_<clip>_<nnnn>" names are the keys. Probing for the run of them needs no animations block
// and self-heals the moment the deferred sheet finishes loading.
const frameCache = new Map<string, PIXI.Texture[]>();

export const poseFrames = (symbol: string, anim: string): PIXI.Texture[] | null => {
	const key = `${symbol}_${anim}`;
	const cached = frameCache.get(key);
	if (cached) return cached;
	const assets = stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
	if (!assets) return null;
	const frames: PIXI.Texture[] = [];
	for (let i = 0; ; i += 1) {
		const texture = assets[`${key}_${String(i).padStart(4, '0')}`];
		if (!texture) break;
		frames.push(texture);
	}
	if (!frames.length) return null;
	frameCache.set(key, frames);
	return frames;
};

export const poseConfig = (symbol: string) => SYMBOL_POSES.symbols[symbol];

/** the clip name for a beat, or null when this insect does not do that beat */
export const poseAnim = (symbol: string, beat: PoseBeat): string | null =>
	poseConfig(symbol)?.poses[beat] ?? null;

/** the frame a symbol's eat clip freezes on: SYMBOL_POSES eatFreezeFrame, else the clip's last */
export const eatFreezeIndex = (symbol: string, total: number): number =>
	Math.min(total - 1, Math.max(0, poseConfig(symbol)?.eatFreezeFrame ?? total - 1));

// The served course at the board centre (Mantis.svelte's hero tray) plays the eat clip too, on a
// reserved key outside the board: it is the tile the player is actually watching when the claw
// comes in, so it must animate, not just wear the frozen frame.
export const HERO_REEL = -1;
export const playHeroEatPose = (symbol: string) => playPose(HERO_REEL, HERO_REEL, symbol, 'eat');
export const stopHeroPose = () => stopPose(HERO_REEL, HERO_REEL);
/** what the hero tray draws: the running eat clip's frame, else the frozen frame (no sheet / no run) */
export const heroPoseTexture = (symbol: string): PIXI.Texture | null => {
	const run = poseRuns[poseKey(HERO_REEL, HERO_REEL)];
	const frames = run && run.symbol === symbol ? poseFrames(run.symbol, run.anim) : null;
	return frames ? frames[Math.min(run!.frame, frames.length - 1)] : eatFreezeTexture(symbol);
};

/** the frozen frame of a symbol's eat clip — what Mantis.svelte carries off to the mouth */
export const eatFreezeTexture = (symbol: string): PIXI.Texture | null => {
	const anim = poseAnim(symbol, 'eat');
	if (!anim) return null;
	const frames = poseFrames(symbol, anim);
	return frames ? frames[eatFreezeIndex(symbol, frames.length)] : null;
};

// ---- the driver -------------------------------------------------------------------------------
let raf = 0;

const advance = (run: PoseRun, now: number) => {
	const speed = run.scaled ? stateBetDerived.timeScale() : 1;
	const index = Math.floor(((now - run.startedAt) * speed * run.fps) / 1000);
	if (run.hold) {
		run.frame = index % run.total;
		return true;
	}
	// a freezing clip stops early at its freeze frame (the eyes-covered pose is mid-clip for the
	// fly); a looping one runs its passes to the end
	if (run.freeze ? index < run.freezeAt : index < run.total * run.loops) {
		run.frame = index % run.total;
		return true;
	}
	if (!run.freeze) return false;
	run.frame = run.freezeAt;
	run.done = true; // held until the caller releases it (SymbolPose watches the cell)
	return true;
};

const tick = () => {
	const now = performance.now();
	let alive = 0;
	for (const key of Object.keys(poseRuns)) {
		const run = poseRuns[key];
		if (run.done) {
			alive += 1; // frozen: no work, but the run is still on screen
			continue;
		}
		if (advance(run, now)) alive += 1;
		else delete poseRuns[key];
	}
	raf = alive ? requestAnimationFrame(tick) : 0;
};

const kick = () => {
	if (!raf && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(tick);
};

const trace = (event: string, reel: number, row: number, pose: string) => {
	if (!import.meta.env.DEV || typeof window === 'undefined') return;
	const am = ((window as any).__angryMantis ??= {});
	(am.poseTrace ??= []).push({ t: Math.round(performance.now()), event, reel, row, pose });
};

const rand = ([lo, hi]: readonly number[]) => lo + Math.random() * (hi - lo);
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** Start a pose on a cell. Returns false (and changes nothing) when the insect has no such pose,
 * the sheet has not loaded, or a higher-priority pose already owns the cell. */
export const playPose = (
	reel: number,
	row: number,
	symbol: string,
	source: PoseSource,
	options: { anim?: string; loops?: number; freeze?: boolean } = {},
): boolean => {
	const anim = options.anim ?? (source === 'dev' ? null : poseAnim(symbol, source));
	if (!anim) return false;
	const frames = poseFrames(symbol, anim);
	if (!frames) return false;
	const key = poseKey(reel, row);
	const current = poseRuns[key];
	if (current && PRIORITY[current.source] > PRIORITY[source]) return false;
	poseRuns[key] = {
		reel,
		row,
		symbol,
		anim,
		source,
		total: frames.length,
		fps: poseConfig(symbol)?.fps ?? SYMBOL_POSES.fps,
		loops: options.loops ?? (source === 'land' ? (poseConfig(symbol)?.landLoops ?? SYMBOL_POSES.landLoops) : 1),
		hold: source === 'win',
		freeze: options.freeze ?? source === 'eat',
		freezeAt: eatFreezeIndex(symbol, frames.length),
		scaled: source === 'land' || source === 'win',
		startedAt: performance.now(),
		frame: 0,
		done: false,
	};
	trace(source, reel, row, anim);
	kick();
	return true;
};

/** Release a cell's pose. `only` limits it to a pose started by that beat (so a land burst's
 * teardown can never cancel the eat freeze that replaced it). */
export const stopPose = (reel: number, row: number, only?: PoseSource) => {
	const key = poseKey(reel, row);
	const run = poseRuns[key];
	if (!run || (only && run.source !== only)) return;
	delete poseRuns[key];
};

// ---- ambient scheduler ------------------------------------------------------------------------
// On a resting board each insect TYPE animates one random visible tile, then waits 8-15 s before
// that type goes again. Types are staggered on first arm so the board never moves all at once, and
// a type never has two tiles going. The countdown only runs while the board is at rest, so a spin
// (which starts with the pre-spin fall-out, before any book event) freezes every timer where it is.
const REST_POLL_MS = 200;
let ambientTimer = 0;
let lastPoll = 0;
const waits: Record<string, number> = {};

/** every gate that means "the player is looking at a still board" */
const boardAtRest = (): boolean =>
	stateGame.board.every((reel) => reel.reelState.motion === 'stopped') &&
	!stateGame.winShowing &&
	stateGame.winFocus === null &&
	stateGame.pressGates === 0 &&
	stateGame.pendingStrikePos === null &&
	stateGame.servingSymbol === null &&
	stateGame.scatterSet === null &&
	stateGame.scatterDrops.length === 0 &&
	stateGame.scatterGrowAt === 0 &&
	!stateGame.lightsDark &&
	doorPaintState.screen === null;

/** visible cells that could animate right now, grouped by symbol name */
const ambientCandidates = (): Record<string, { reel: number; row: number }[]> => {
	const out: Record<string, { reel: number; row: number }[]> = {};
	stateGame.board.forEach((reel, reelIndex) => {
		reel.reelState.symbols.forEach((reelSymbol) => {
			const row = reelSymbol.symbolIndexOfBoard;
			if (row < 0 || row >= BOARD_DIMENSIONS.y) return;
			if (reelSymbol.symbolState === 'eaten') return;
			const name = reelSymbol.rawSymbol.name as string;
			const anim = poseAnim(name, 'ambient');
			if (!anim || !poseFrames(name, anim)) return;
			(out[name] ??= []).push({ reel: reelIndex, row });
		});
	});
	return out;
};

const pollAmbient = () => {
	const now = performance.now();
	const dt = Math.min(now - lastPoll, REST_POLL_MS * 4); // a backgrounded tab must not fast-forward
	lastPoll = now;
	if (!boardAtRest()) return;
	const groups = ambientCandidates();
	const names = Object.keys(groups).sort();
	names.forEach((name, i) => {
		if (waits[name] === undefined) {
			// first arm: one stagger slot per type, plus a fraction of a gap so two types that arm
			// on the same board never fall into lockstep
			waits[name] = i * SYMBOL_POSES.ambientStaggerMs + rand(SYMBOL_POSES.ambientGapMs) * 0.5;
			return;
		}
		waits[name] -= dt;
		if (waits[name] > 0) return;
		// one animating tile per type, and never a cell that is already busy
		const busy = Object.values(poseRuns).some((run) => run.symbol === name);
		const free = groups[name].filter(({ reel, row }) => !poseRuns[poseKey(reel, row)]);
		if (busy || !free.length) return;
		const cell = pick(free);
		const loops = Math.round(rand(poseConfig(name)?.ambientLoops ?? SYMBOL_POSES.ambientLoops));
		if (playPose(cell.reel, cell.row, name, 'ambient', { loops })) {
			waits[name] = rand(SYMBOL_POSES.ambientGapMs);
		}
	});
	// a type that left the board forgets its timer, so it re-staggers when it comes back
	Object.keys(waits).forEach((name) => {
		if (!groups[name]) delete waits[name];
	});
};

/** idempotent: the first mounted pose layer arms the scheduler for the session */
export const startAmbientPoses = () => {
	if (ambientTimer || typeof window === 'undefined') return;
	lastPoll = performance.now();
	ambientTimer = window.setInterval(pollAmbient, REST_POLL_MS);
};

// DEV hooks (house rules: extend __angryMantis, never a new global). `pose(reel,row,name)` plays any
// clip on any cell; `poseTrace` is the append-only log every pose writes to.
if (import.meta.env.DEV && typeof window !== 'undefined') {
	const am = ((window as any).__angryMantis ??= {});
	am.poseTrace ??= [];
	Object.assign(am, {
		pose: (reel: number, row: number, name: string, loops = 1) => {
			const symbol = stateGame.board[reel]?.reelState.symbols.find((s) => s.symbolIndexOfBoard === row);
			if (!symbol) return false;
			const sym = symbol.rawSymbol.name as string;
			// a hand-played eat clip freezes on its last frame, exactly as the real strike does
			return playPose(reel, row, sym, 'dev', { anim: name, loops, freeze: name === poseAnim(sym, 'eat') });
		},
		poseClear: (reel: number, row: number) => stopPose(reel, row),
		poseRuns: () => $state.snapshot(poseRuns),
		// which visible cell holds which symbol, and whether that symbol can animate right now
		poseBoard: () =>
			stateGame.board.flatMap((reel, reelIndex) =>
				reel.reelState.symbols
					.filter((s) => s.symbolIndexOfBoard >= 0 && s.symbolIndexOfBoard < BOARD_DIMENSIONS.y)
					.map((s) => {
						const name = s.rawSymbol.name as string;
						const anim = poseAnim(name, 'ambient');
						return { reel: reelIndex, row: s.symbolIndexOfBoard, name, state: s.symbolState, ready: Boolean(anim && poseFrames(name, anim)) };
					}),
			),
		poseAtRest: () => boardAtRest(),
	});
}
