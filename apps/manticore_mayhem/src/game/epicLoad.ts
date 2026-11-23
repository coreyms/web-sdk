// THE EPIC, LOADED ON THE ROUND THAT REACHES IT (constants EPIC_LOAD has the why and Corey's words; the pure parts, what
// the book says, the order and the hold's decisions, are game/epicPlan.ts, tested by tools/epic_load_test.mjs).
//
// THE SIGNAL. The whole round is one book, in hand the moment the play request answers (game/utils.ts playBet, before its
// first event plays). epicSignalOfBook reads it: a bonusStart with bonus "epic" (the round opens the Epic: a normal play,
// a replay, a round resumed before its trigger), a createBonusSnapshot holding one (a round resumed inside the Epic), or a
// win plaque that stops on EPIC (the Epic flames only). Reading ahead changes nothing on screen and nothing in time: this
// file only fetches, and the one thing that can wait for it (THE HOLD below) waits only while a file is still missing.
//
// THE LINE. From the signal, the groups of EPIC_LOAD.order load one after another, each file into the HTTP cache
// (game/fileWarm.ts; every system then asks for it by the same URL, and one that asks while it is on its way waits for it):
//   intro     the War Standard's Epic intro cloth and the banner glyphs of the class on show. components/WarBanner.svelte
//             decodes and uploads them at the feature's start, exactly as before (its preload at bonusStart, the intro
//             waiting for the upload, and its fallback to the plaque intro when they cannot be had)
//   creature  his Epic idle sheet, then his look is named ahead (game/creatureLoad.ts creaturePrepareEpic: his loader
//             decodes it in its worker and uploads it in strips in his upload turn), then his roar sheet (THE ENTRY ROAR)
//   flames    the landscape scene's Epic flame clip (game/assets.ts EPIC_LATE): into the cache, decoded by Pixi's loader,
//             uploaded ONCE in his upload turn (constants CREATURE.upload: gapMs after the last upload, after THE QUIET),
//             and only then handed to the scene (stateApp.loadedAssets; components/Background.svelte setFlames): the scene
//             never draws a sheet that is not up. Pixi's own path, not the strips, on purpose: the scene lets a hidden
//             scene's GPU copies go and uploads them again when it shows (game/scene.ts release), which needs the decoded
//             picture a strip sheet gives up
//   attacks   his Epic attacks and alternates, into the cache only (his loader takes them when the mode asks for the look)
// A group starts when the one before it has its files in; decoding and uploading go on beside the next group. A group that
// fails is tried EPIC_LOAD.retries more times, EPIC_LOAD.retryMs apart, then left: what it was for falls back as a look
// that is not in always has (he keeps the look on show, the braziers burn the mode's clip, the intro is the plaque's).
//
// THE HOLD (components/ModePlaque.svelte): an Epic intro's press is offered once his Epic idle sheet is up and the Epic
// flames are in, or one of them failed for good, or EPIC_LOAD.holdCapMs have passed. The banner hangs meanwhile, he stays
// in the look on show (and crosses over the moment his Epic idle sheet is up, as always). When they are in already, the
// press comes exactly when it always did.
//
// ONCE A SESSION. A file is downloaded once: the second Epic of a session finds every file in the cache. The flames stay
// on the GPU for the session, as every flame clip always has. His Epic look is let go when the feature ends (ONE LOOK
// RESIDENT, game/creatureLoad.ts) and comes back from the cache, nothing on the wire.
//
// DEV (import.meta.env.DEV only): __manticore.epicLoad() is every round's record (the signal, each group's request start,
// files in, ready and failed times, when the entrance asked: the relight, the intro, the press, and the hold's decision);
// a console line sums it up at the round's end. __manticore.epicLoadStart('book' | 'resume' | 'plaque') starts a line by
// hand, as a book would (tools/manticore/flame_probe.js loads the Epic clip so).
import * as PIXI from 'pixi.js';

import { EPIC_LOAD } from './constants';
import { EPIC_LATE, SCENE_AT_BOOT } from './assets';
import { CREATURE_FILES, type CreatureClip, type CreatureLook } from './creatureAssets';
import { creatureLoader, creaturePrepareEpic, uploadInTurn } from './creatureLoad';
import { creature } from './creature';
import { stateApp } from './stateApp';
import { BANNER_GLYPHS, BANNER_TEXTURES, type BannerClass } from './banner/spec';
import { warmFile, warmSheet } from './fileWarm';
import { epicGroupsFor, epicSignalOfBook, holdDecision, markFiles, markReady, markStart, markTryFailed, newGroupState, retryDelay, type EpicBookLike, type EpicGroup, type EpicGroupState, type EpicSignal, type HoldDecision } from './epicPlan';

const EPIC: CreatureLook = 'epic';
const now = () => performance.now();
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** the banner's texture class on show (components/WarBanner.svelte writes it on every placement) */
export const epicBannerClass: { current: BannerClass } = { current: 'D' };

type Round = {
	n: number;
	via: 'book' | 'resume' | 'plaque' | 'hand';
	signal: EpicSignal;
	signalAt: number;
	plan: EpicGroup[];
	groups: Partial<Record<EpicGroup, EpicGroupState>>;
	/** when the entrance asked: relight (the trigger beat's), intro (the intro screen), press (the intro's press) */
	asked: Record<string, number>;
	hold: { at: number; end: number; decision: HoldDecision } | null;
	files: { url: string; ok: boolean; bytes: number; at: number }[];
	doneAt: number;
};
let serial = 0;
/** the round whose book named the Epic, while it plays (null: none) */
let round: Round | null = null;
const rounds: Round[] = [];

/** the Epic flames this session: on their way, in (on the GPU, handed to the scene), or not yet */
let flames: Promise<boolean> | null = null;
let flamesIn = false;
/** the landscape courtyard (the one with braziers) is registered: the boot layout's, or fetched at a turn (epicSceneLate) */
let landscapeScene = SCENE_AT_BOOT === 'landscape';
/** this session has reached the Epic flames' need once (a turn to the landscape courtyard loads them then) */
let flamesAsked = false;

const warmOpts = (r: Round) => ({
	retries: 0,
	retryMs: EPIC_LOAD.retryMs,
	onTry: (url: string, ok: boolean, bytes: number) => {
		if (import.meta.env.DEV) r.files.push({ url: url.split('/').pop()!.split('?')[0], ok, bytes, at: Math.round(now() - r.signalAt) });
	},
});

/** a group's files, tried EPIC_LOAD.retries more times; true when they are in */
const withRetries = async (g: EpicGroupState, attempt: () => Promise<boolean>): Promise<boolean> => {
	for (;;) {
		markStart(g, now());
		if (await attempt()) {
			markFiles(g, now());
			return true;
		}
		if (markTryFailed(g, now(), EPIC_LOAD.retries) === 'failed') return false;
		await wait(retryDelay(g.tries, EPIC_LOAD.retryMs));
	}
};

const sheetsIn = async (urls: readonly string[], r: Round): Promise<boolean> => {
	for (const url of urls) if (!(await warmSheet(url, warmOpts(r)))) return false;
	return true;
};

// ---- the groups ------------------------------------------------------------------------------------------------------
const introGroup = async (r: Round, g: EpicGroupState) => {
	const cls = epicBannerClass.current;
	const cloth = BANNER_TEXTURES[cls].epic.intro;
	const glyphs = BANNER_GLYPHS[cls].url;
	const ok = await withRetries(g, async () => (await Promise.all([warmFile(cloth, warmOpts(r)), warmSheet(glyphs, warmOpts(r))])).every(Boolean));
	// (the banner decodes and uploads them itself at the feature's start: in the cache is all this group is)
	if (ok) markReady(g, now());
};

/** his Epic idle sheet is up (or he is not drawn): looked at until the round has played out */
const watchCreature = (r: Round, g: EpicGroupState) => {
	void (async () => {
		while (!r.doneAt && g.state !== 'ready') {
			if (creature.lookIn(EPIC)) {
				markReady(g, now());
				return;
			}
			await wait(EPIC_LOAD.pollMs);
		}
	})();
};
const creatureGroup = async (r: Round, g: EpicGroupState) => {
	const idle = CREATURE_FILES[EPIC].idle;
	const roar = CREATURE_FILES[EPIC].roar;
	const idleIn = await withRetries(g, () => sheetsIn(idle, r));
	// his look named ahead now (his loader reads the idle sheet from the cache); a resumed Epic's mode asked for it already
	creaturePrepareEpic();
	if (!idleIn) return;
	watchCreature(r, g);
	// THE ENTRY ROAR's sheet: his loader asks for it straight after the idle sheet and waits for this fetch
	await sheetsIn(roar, r);
};

/** the Epic flames, once a session: into the cache, decoded, uploaded in his turn, handed to the scene */
const loadFlames = (r: Round, g: EpicGroupState): Promise<boolean> => {
	if (flamesIn) return Promise.resolve(true);
	const entry = EPIC_LATE.sceneFlameEpic;
	if (!entry) return Promise.resolve(false);
	flames ??= (async () => {
		if (!(await withRetries(g, () => warmSheet(entry.src, warmOpts(r))))) return false;
		let textures: Record<string, PIXI.Texture>;
		try {
			// (from the cache: Pixi's loader decodes the picture off the main thread where the browser can)
			textures = ((await PIXI.Assets.load(entry.src)) as { textures: Record<string, PIXI.Texture> }).textures;
		} catch {
			return false;
		}
		const first = Object.values(textures ?? {})[0];
		if (!first) return false;
		// resident for the session, as every flame clip is: never collected while idle (it would go up again at a draw)
		first.source.autoGarbageCollect = false;
		await uploadInTurn(async () => {
			await creatureLoader.renderer?.()?.prepare?.upload(first.source);
		});
		stateApp.loadedAssets = { ...stateApp.loadedAssets, ...textures };
		flamesIn = true;
		return true;
	})().then((ok) => {
		if (!ok) flames = null; // a later round may try again
		return ok;
	});
	return flames;
};
const flamesGroup = async (r: Round, g: EpicGroupState) => {
	flamesAsked = true;
	const done = loadFlames(r, g);
	void done.then((ok) => {
		if (ok) markReady(g, now());
		else if (g.state !== 'failed') {
			g.state = 'failed';
			g.failedAt = now();
		}
	});
	// the line goes on once the files are in (the decode and the upload go on beside the next group)
	for (let settled = false; !settled && !g.filesAt && g.state !== 'failed'; ) settled = await Promise.race([done.then(() => true), wait(EPIC_LOAD.pollMs).then(() => false)]);
};

/** his Epic attacks, then his alternates, in the order his loader asks for them (game/creatureLoad.ts GROUPS creatureActs,
 *  creatureAlts; the roar came with the creature group), into the cache. Not the win clips: they load on demand, per book */
const ATTACK_CLIPS: readonly CreatureClip[] = ['swipe', 'charge_in', 'charge_loop', 'sting_hit', 'sting_recrouch', 'snarl', 'growl', 'idle_look'];
const attacksGroup = async (r: Round, g: EpicGroupState) => {
	const ok = await withRetries(g, () => sheetsIn(ATTACK_CLIPS.flatMap((c) => CREATURE_FILES[EPIC][c]), r));
	if (ok) markReady(g, now());
};

const RUN: Record<EpicGroup, (r: Round, g: EpicGroupState) => Promise<void>> = { intro: introGroup, creature: creatureGroup, flames: flamesGroup, attacks: attacksGroup };

const start = (signal: EpicSignal, via: Round['via']): Round => {
	const plan = epicGroupsFor(signal, EPIC_LOAD.order as readonly EpicGroup[], landscapeScene && !!EPIC_LATE.sceneFlameEpic);
	const r: Round = { n: ++serial, via, signal, signalAt: now(), plan, groups: {}, asked: {}, hold: null, files: [], doneAt: 0 };
	for (const name of plan) r.groups[name] = newGroupState();
	if (signal.feature || signal.plaque) flamesAsked = true;
	round = r;
	if (import.meta.env.DEV) {
		rounds.push(r);
		if (rounds.length > 12) rounds.shift();
	}
	void (async () => {
		for (const name of plan) {
			try {
				await RUN[name](r, r.groups[name]!);
			} catch {
				/* a group that throws is a group that failed: the next one starts */
			}
		}
	})();
	return r;
};

// ---- the game's calls -----------------------------------------------------------------------------------------------
/** what the round's book says (game/utils.ts playBet reads it first, so the creature's own early load can leave the Epic
 *  look to this file: epicDefersLook) */
export const epicSignal = (events: readonly EpicBookLike[]): EpicSignal => epicSignalOfBook(events);
/** the look game/creatureLoad.ts creatureBookArrived leaves to this file (named ahead once its files are in) */
export const epicDefersLook = (signal: EpicSignal): CreatureLook | null => (EPIC_LOAD.on && signal.feature === 'book' ? EPIC : null);
/** the round's book is in: its Epic, if it has one, starts loading now */
export const epicBookArrived = (signal: EpicSignal): void => {
	if (!EPIC_LOAD.on) return;
	if (!signal.feature && !signal.plaque) {
		round = null;
		return;
	}
	start(signal, signal.feature ?? 'plaque');
};
/** the round has played out (game/utils.ts playBet): its record is closed (DEV: the summary line) */
export const epicRoundDone = (): void => {
	const r = round;
	round = null;
	if (!r || r.doneAt) return;
	r.doneAt = now();
	if (import.meta.env.DEV) console.info(`[manticore] epic load ${summary(r)}`);
};
/** the entrance asks for its pieces (DEV record only: the margin each group had) */
export const epicAsked = (what: 'relight' | 'intro' | 'press'): void => {
	const r = round;
	if (r && !r.asked[what]) r.asked[what] = now();
};
/** the landscape courtyard was fetched at a turn (game/deferredLoad.ts loadSceneLate): the Epic flames now, when this
 *  session has needed them already (they were left out while the game showed the upright courtyard, which has none) */
export const epicSceneLate = (hasFlames: boolean): void => {
	if (!hasFlames || !EPIC_LOAD.on) return;
	landscapeScene = true;
	if (!flamesAsked || flamesIn || flames) return;
	const r = round ?? start({ feature: null, at: -1, plaque: true, plaqueAt: -1 }, 'hand');
	if (!r.groups.flames) {
		r.groups.flames = newGroupState();
		r.plan.push('flames');
		void flamesGroup(r, r.groups.flames);
	}
};

// ---- THE HOLD -------------------------------------------------------------------------------------------------------
/** what the Epic intro's press waits for, each group's state as it stands NOW (his: whether he can show the Epic look) */
const needs = (r: Round): EpicGroupState[] => {
	const out: EpicGroupState[] = [];
	const c = r.groups.creature;
	if (c) out.push(creature.lookIn(EPIC) ? { ...c, state: 'ready' } : c);
	const f = r.groups.flames;
	if (f) out.push(flamesIn ? { ...f, state: 'ready' } : f);
	return out;
};
const holdRound = (mode: string): Round | null => {
	const r = round;
	return EPIC_LOAD.on && mode === 'epic' && r && r.signal.feature === 'book' && !r.doneAt ? r : null;
};
/** an Epic intro's press must wait now (false: offer it at once, as always; nothing is awaited then) */
export const epicHoldNeeded = (mode: string): boolean => {
	const r = holdRound(mode);
	if (!r) return false;
	return holdDecision(needs(r), now(), now(), EPIC_LOAD.holdCapMs) === 'hold';
};
/** THE HOLD: resolves when the press may be offered (its decision; never rejects, never longer than holdCapMs) */
export const epicHold = async (mode: string): Promise<HoldDecision> => {
	const r = holdRound(mode);
	if (!r) return 'go';
	const at = now();
	for (;;) {
		const decision = holdDecision(needs(r), at, now(), EPIC_LOAD.holdCapMs);
		if (decision !== 'hold' || r.doneAt) {
			r.hold = { at, end: now(), decision: r.doneAt ? 'fallback' : decision };
			return r.hold.decision;
		}
		await wait(EPIC_LOAD.pollMs);
	}
};

// ---- DEV ------------------------------------------------------------------------------------------------------------
const rel = (r: Round, t: number) => (t ? Math.round(t - r.signalAt) : null);
const summary = (r: Round): string => {
	const parts = r.plan.map((name) => {
		const g = r.groups[name]!;
		return `${name} start +${rel(r, g.startAt)} files +${rel(r, g.filesAt)} ready +${rel(r, g.readyAt)}${g.failedAt ? ` FAILED +${rel(r, g.failedAt)}` : ''} tries ${g.tries}`;
	});
	const asked = Object.entries(r.asked).map(([k, t]) => `${k} +${rel(r, t)}`);
	const hold = r.hold ? `hold ${Math.round(r.hold.end - r.hold.at)} ms (${r.hold.decision})` : 'no hold';
	return `round ${r.n} (${r.via}): ${parts.join('; ')} | asked ${asked.join(', ') || 'nothing'} | ${hold}`;
};
if (import.meta.env.DEV && typeof window !== 'undefined') {
	const hook = ((window as unknown as { __manticore?: Record<string, unknown> }).__manticore ??= {});
	Object.assign(hook, {
		epicLoad: () =>
			JSON.parse(
				JSON.stringify({
					on: EPIC_LOAD.on,
					flamesIn,
					landscapeScene,
					rounds: rounds.map((r) => ({
						...r,
						rel: Object.fromEntries(r.plan.map((name) => { const g = r.groups[name]!; return [name, { start: rel(r, g.startAt), files: rel(r, g.filesAt), ready: rel(r, g.readyAt), failed: rel(r, g.failedAt), tries: g.tries, state: g.state }]; })),
						askedRel: Object.fromEntries(Object.entries(r.asked).map(([k, t]) => [k, rel(r, t)])),
						summary: summary(r),
					})),
				}),
			),
		/** start a line by hand, as a book would ('plaque': the Epic flames only) */
		epicLoadStart: (what: 'book' | 'resume' | 'plaque' = 'plaque') => {
			const signal: EpicSignal = { feature: what === 'plaque' ? null : what, at: -1, plaque: what === 'plaque', plaqueAt: -1 };
			return start(signal, 'hand').n;
		},
	});
}
