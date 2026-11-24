// THE EPIC'S FILES: IN THE BACKGROUND ONCE THE GAME IS IDLE, ON DEMAND AS THE FALLBACK (constants EPIC_LOAD has the why and
// Corey's words; the pure parts, what the book says, the order, the hold, the start event and the decode rule, are
// game/epicPlan.ts, tested by tools/epic_load_test.mjs).
//
// THE GROUPS, in EPIC_LOAD.order, one file at a time, each file into the HTTP cache (game/fileWarm.ts; every system then
// asks for it by the same URL, and one that asks while it is on its way waits for it, so no file is downloaded twice):
//   intro     the War Standard's Epic intro cloth and the banner glyphs of the class on show. components/WarBanner.svelte
//             decodes and uploads them at the feature's start, exactly as before
//   creature  his Epic idle sheet, then his roar sheet (THE ENTRY ROAR). Into the cache only: his own loader decodes them
//             (its worker, its strips, his upload turn) once a round's book names his Epic look (creaturePrepareEpic)
//   flames    the landscape scene's Epic flame clip (game/assets.ts EPIC_LATE; a courtyard with no braziers has none):
//             into the cache, then decoded by Pixi's loader and uploaded ONCE in his upload turn, under THE DECODE RULE,
//             and only then handed to the scene (stateApp.loadedAssets): the scene never draws a sheet that is not up.
//             Resident for the session, as every flame clip is (game/scene.ts release lets a hidden scene's copies go)
//   attacks   his Epic attacks and alternates, into the cache only
// A group whose file fails is tried EPIC_LOAD.retries more times, EPIC_LOAD.retryMs apart, then marked failed.
//
// THE BACKGROUND LINE (Corey "ej1"). THE START EVENT: start-up loading is over (epicStartupDone: the deferred phase, the
// armoury's menu core and the turning medallion, components/Game.svelte), the landing press is passed (epicLandingPassed:
// PRESS ANYWHERE or the resume card), no round is in flight (no play request on the wire, no book playing), and that has
// held for EPIC_LOAD.background.restMs, or a round has just played out (an Autoplay run's gaps are shorter). Before it this file requests nothing, so start-up is the build's own to the byte.
// Then every group, in order, at fetch priority low; no NEW file starts while a play request is on the wire, a round
// plays, or the creature's Super prefetch runs (a file already on its way runs on: a download does not hitch a frame). A
// pass with a failed group runs again after EPIC_LOAD.background.retryMs[n], then is left (bounded): a round that needs
// it tries again on demand.
//
// THE DECODE RULE (epicPlan decodeAllowed): the only Epic files decoded and uploaded ahead are the flames, and only AT
// REST (no round in flight) or on a round whose book names the Epic, before its feature starts (the trigger and the
// intro: his upload turn and THE QUIET, the path a look named by a book always takes; a round with an Epic plaque alone,
// or a resumed Epic, the whole round, as on demand always did). Checked before the decode and again inside his upload
// turn; a sheet that lands later waits for rest.
//
// THE FALLBACK (a round whose book names the Epic, game/utils.ts playBet): its groups at normal priority, now, from wherever
// the background line got to (a file on its way is waited for, not fetched again; a group in already is skipped). A
// reload into an Epic round and an Epic replay take this path at once: no idle time comes first.
//
// THE HOLD (components/ModePlaque.svelte): an Epic intro's press waits for his Epic idle sheet (up: creature.lookIn) and
// the Epic flames (handed to the scene) only while the forecast says they can be up within EPIC_LOAD.holdCapMs (the
// bytes the line has left up to them at the measured rate, plus EPIC_LOAD.hold.decodeMs a sheet): epicPlan holdDecision.
// With them in, nothing is awaited. When the forecast says no, no hold at all.
// THE INTRO'S CHOICE (epicIntroLate, asked once as the intro shows): when the forecast already says 'late' and the War
// Standard's Epic cloth is not in, the intro takes the plaque at once (no 4 s wait for the cloth) and the press is not held.
//
// NO MID ROUND SWAP (epicFeatureStart, at the intro's press after the hold): if his Epic look is not up then, the round
// keeps the look on show to its end (creature.keepOut: the mode's ask is dropped and the Epic look is let go); the next
// Epic of the session shows it. (ef545de0 crossed over to it whenever its idle sheet landed, mid round.)
//
// DEV (import.meta.env.DEV only): __manticore.epicLoad() holds the background line (its conditions, its start, each
// group's start, files in, ready and failed times, its bytes, the files with their priority) and every Epic round (the
// signal, whether it used the fallback, each group relative to the signal, the hold and its length, the look kept out,
// the bytes it fetched); a console line sums up each round. __manticore.epicLoadStart(what) starts a round's line by hand;
// `?epicbg=0` turns the background line off, `?epicbg=hold` holds its start for __manticore.epicBackgroundRelease().
import * as PIXI from 'pixi.js';

import { EPIC_LOAD } from './constants';
import { EPIC_LATE, SCENE_AT_BOOT } from './assets';
import { fileBytes } from './assetStamp';
import { CREATURE_FILES, type CreatureClip, type CreatureLook } from './creatureAssets';
import { creatureLoader, creaturePrefetchLog, creaturePrepareEpic, uploadInTurn } from './creatureLoad';
import { creature } from './creature';
import { stateApp } from './stateApp';
import { BANNER_GLYPHS, BANNER_TEXTURES, type BannerClass } from './banner/spec';
import { isWarm, warmFile, warmReceived, warmSamples, warmSheet, type WarmOptions } from './fileWarm';
import {
	backgroundMayFetch,
	backgroundMayStart,
	backgroundRetryAfter,
	bytesBeforeNeeds,
	decodeAllowed,
	epicGroupsFor,
	epicSignalOfBook,
	etaOf,
	holdDecision,
	markFiles,
	markReady,
	markStart,
	markTryFailed,
	newGroupState,
	rateOf,
	resetFailed,
	retryDelay,
	type EpicBookLike,
	type EpicGroup,
	type EpicGroupState,
	type EpicSignal,
	type HoldDecision,
	type LineFile,
} from './epicPlan';

const EPIC: CreatureLook = 'epic';
const ORDER = EPIC_LOAD.order as readonly EpicGroup[];
const now = () => performance.now();
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const query = (key: string): string | null => (import.meta.env.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get(key) : null);

/** the banner's texture class on show (components/WarBanner.svelte writes it on every placement) */
export const epicBannerClass: { current: BannerClass } = { current: 'D' };

// ---- the session's groups (a file is downloaded once a session) ------------------------------------------------------
type By = 'background' | 'round';
type Group = EpicGroupState & { job: Promise<boolean> | null; bytes: number; by: By | null; cls: BannerClass | null };
const groups = Object.fromEntries(ORDER.map((name) => [name, { ...newGroupState(), job: null, bytes: 0, by: null, cls: null }])) as unknown as Record<EpicGroup, Group>;

/** the Epic flames: decoding or uploading (the line goes on meanwhile), and in (on the GPU, handed to the scene) */
let flamesUp: Promise<boolean> | null = null;
let flamesIn = false;
/** the landscape courtyard (the one with braziers) is registered: the boot layout's, or fetched at a turn (epicSceneLate) */
let landscapeScene = SCENE_AT_BOOT === 'landscape';
/** this session has reached the Epic flames' need once (a turn to the landscape courtyard loads them then) */
let flamesAsked = false;
const flamesHere = () => landscapeScene && !!EPIC_LATE.sceneFlameEpic;

// ---- the state of play: what the line paces itself by ------------------------------------------------------------------
/** a round's line is running: every file at normal priority, no pauses (the fallback) */
let urgent = false;
/** a round's book plays (epicBookArrived to epicRoundDone), any round */
let playing = false;
const busy = () => creaturePrefetchLog.request || playing;
const prefetching = () => !!creaturePrefetchLog.startAt && !creaturePrefetchLog.doneAt;

// ---- the files -------------------------------------------------------------------------------------------------------
type FileRef = { url: string; sheet: boolean };
/** his Epic attacks, then his alternates, in the order his loader asks for them (game/creatureLoad.ts GROUPS creatureActs,
 *  creatureAlts; the roar comes with the creature group). Not the win clips: they load on demand, per book */
const ATTACK_CLIPS: readonly CreatureClip[] = ['swipe', 'charge_in', 'charge_loop', 'sting_hit', 'sting_recrouch', 'snarl', 'growl', 'idle_look'];
const IDLE = CREATURE_FILES[EPIC].idle;
const sheets = (urls: readonly string[]): FileRef[] => urls.map((url) => ({ url, sheet: true }));
const filesOf = (name: EpicGroup): FileRef[] => {
	if (name === 'intro') {
		const cls = epicBannerClass.current;
		return [
			{ url: BANNER_TEXTURES[cls].epic.intro, sheet: false },
			{ url: BANNER_GLYPHS[cls].url, sheet: true },
		];
	}
	if (name === 'creature') return sheets([...IDLE, ...CREATURE_FILES[EPIC].roar]);
	if (name === 'flames') return EPIC_LATE.sceneFlameEpic ? sheets([EPIC_LATE.sceneFlameEpic.src]) : [];
	return sheets(ATTACK_CLIPS.flatMap((c) => CREATURE_FILES[EPIC][c]));
};
/** a file's whole size (a sheet's json counts its picture: scripts/stamp-assets.mjs fileBytes); 0 when not listed */
const bytesOf = (url: string): number => {
	const m = /\/assets\/([^?#]+)/.exec(url);
	return m ? ((fileBytes as Record<string, number>)[m[1]] ?? 0) : 0;
};

// ---- DEV record --------------------------------------------------------------------------------------------------------
type FileLog = { url: string; ok: boolean; bytes: number; at: number; by: By; priority: string };
const fileLog: FileLog[] = [];
const bg = {
	on: false,
	held: false,
	/** performance.now(): start-up loading over, the landing press passed, the rest that counts toward restMs began */
	startupAt: 0,
	landingAt: 0,
	restFrom: 0,
	/** THE START EVENT (0: not yet) and the moment every group's files were in */
	startAt: 0,
	doneAt: 0,
	/** retry passes run, and whether the line gave up (bounded) */
	passes: 0,
	gaveUp: false,
	/** how often a paused file looked again (a play request on the wire, a round playing, the Super prefetch) */
	waits: 0,
};
bg.on = EPIC_LOAD.on && EPIC_LOAD.background.on && query('epicbg') !== '0';
bg.held = query('epicbg') === 'hold';

const opts = (g: Group, by: By): WarmOptions => ({
	retries: 0,
	retryMs: EPIC_LOAD.retryMs,
	priority: () => (urgent ? 'auto' : 'low'),
	onTry: (url: string, ok: boolean, bytes: number, asked: string) => {
		g.bytes += bytes;
		if (!import.meta.env.DEV) return;
		// (by what it was ASKED at: a round's line that runs on after its round has ended asks at low, as the background does)
		fileLog.push({ url: url.split('/').pop()!.split('?')[0], ok, bytes, at: Math.round(now()), by: asked === 'auto' ? 'round' : 'background', priority: asked });
		if (fileLog.length > 200) fileLog.shift();
	},
});

/** a background file waits for its moment (a round's file never waits) */
const pace = async () => {
	while (!backgroundMayFetch({ urgent, request: creaturePrefetchLog.request, busy: playing, prefetching: prefetching() })) {
		bg.waits += 1;
		await wait(EPIC_LOAD.background.pollMs);
	}
};
const warmOne = async (f: FileRef, o: WarmOptions): Promise<boolean> => {
	await pace();
	return f.sheet ? warmSheet(f.url, o) : warmFile(f.url, o);
};
const allIn = async (files: readonly FileRef[], o: WarmOptions): Promise<boolean> => {
	for (const f of files) if (!(await warmOne(f, o))) return false;
	return true;
};

/** a group's files, tried EPIC_LOAD.retries more times; true when they are in */
const withRetries = async (g: Group, attempt: () => Promise<boolean>): Promise<boolean> => {
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

// ---- THE DECODE RULE ---------------------------------------------------------------------------------------------------
/** the round whose book names the Epic, while it plays (null: none) */
let round: Round | null = null;
const decodeOk = (): boolean => {
	const r = round;
	const epicRound = !!r && !r.doneAt && (!!r.signal.feature || r.signal.plaque);
	return decodeAllowed({ epicRound, featureStarted: !!r?.featureAt, atRest: bg.landingAt > 0 && !busy() });
};
const untilDecodeOk = async () => {
	while (!decodeOk()) await wait(EPIC_LOAD.background.pollMs);
};

// ---- the groups' jobs --------------------------------------------------------------------------------------------------
/** the Epic flames, once a session: decoded, uploaded in his turn, handed to the scene (all under THE DECODE RULE) */
const flamesDecode = (g: Group): Promise<boolean> => {
	const entry = EPIC_LATE.sceneFlameEpic;
	if (!entry) return Promise.resolve(false);
	return (async () => {
		await untilDecodeOk();
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
		for (let up = false; !up; ) {
			await untilDecodeOk();
			await uploadInTurn(async () => {
				// (a round may have started while this waited for its turn: then it waits again)
				if (!decodeOk()) return;
				await creatureLoader.renderer?.()?.prepare?.upload(first.source);
				up = true;
			});
		}
		stateApp.loadedAssets = { ...stateApp.loadedAssets, ...textures };
		return true;
	})().then((ok) => {
		flamesUp = null;
		if (ok) {
			flamesIn = true;
			markReady(g, now());
		} else {
			g.state = 'failed';
			g.failedAt = now();
		}
		return ok;
	});
};

/** his Epic idle sheet is in the cache: a round whose book names his Epic look has it named ahead now (his loader decodes
 *  and uploads it), unless that round has kept it out */
const idleWarm = () => IDLE.every((url) => isWarm(url));
const onCreatureIdle = () => {
	const r = round;
	if (!r || r.doneAt || !r.signal.feature || r.keptOut || r.prepared) return;
	r.prepared = now();
	creaturePrepareEpic();
};

const JOBS: Record<EpicGroup, (g: Group, by: By) => Promise<boolean>> = {
	intro: async (g, by) => {
		const cls = epicBannerClass.current;
		const ok = await withRetries(g, () => allIn(filesOf('intro'), opts(g, by)));
		if (ok) {
			g.cls = cls;
			markReady(g, now());
		}
		return ok;
	},
	creature: async (g, by) => {
		const o = opts(g, by);
		if (!(await withRetries(g, () => allIn(sheets(IDLE), o)))) return false;
		onCreatureIdle();
		// (the roar's own tries: the group's files are in when both sheets are)
		g.filesAt = 0;
		g.tries = 0;
		const ok = await withRetries(g, () => allIn(sheets(CREATURE_FILES[EPIC].roar), o));
		if (ok) markReady(g, now());
		return ok;
	},
	flames: async (g, by) => {
		flamesAsked = true;
		if (!(await withRetries(g, () => allIn(filesOf('flames'), opts(g, by))))) return false;
		// the line goes on once the file is in; the decode and the upload wait for their moment beside it
		flamesUp ??= flamesDecode(g);
		return true;
	},
	attacks: async (g, by) => {
		const ok = await withRetries(g, () => allIn(filesOf('attacks'), opts(g, by)));
		if (ok) markReady(g, now());
		return ok;
	},
};

/** the line has nothing more to fetch for this group (its files in; the flames may still be decoding) */
const groupDone = (name: EpicGroup): boolean => {
	const g = groups[name];
	if (name === 'intro' && g.state === 'ready' && g.cls !== epicBannerClass.current) return false;
	return g.state === 'ready' || (name === 'flames' && (flamesIn || !!flamesUp));
};
/** a group's job: started, or joined when it is on its way (from either line), or at once when it is done */
const runGroup = (name: EpicGroup, by: By): Promise<boolean> => {
	const g = groups[name];
	if (name === 'flames' && !flamesHere()) return Promise.resolve(false);
	if (groupDone(name)) return Promise.resolve(true);
	if (g.job) return g.job;
	if (g.state === 'failed') return Promise.resolve(false);
	// (another class's intro files: this class's are a new job)
	if (g.state === 'ready') Object.assign(g, newGroupState());
	g.by ??= by;
	const job = JOBS[name](g, by).catch(() => false);
	g.job = job;
	void job.finally(() => {
		if (g.job === job) g.job = null;
	});
	return job;
};

// ---- THE BACKGROUND LINE -----------------------------------------------------------------------------------------------
let bgRunning = false;
const bgPlan = (): EpicGroup[] => epicGroupsFor({ feature: 'book', at: -1, plaque: false, plaqueAt: -1 }, ORDER, flamesHere());
const runBackground = async () => {
	if (bgRunning || !bg.startAt) return;
	bgRunning = true;
	try {
		for (;;) {
			for (const name of bgPlan()) {
				// a round's line has it: the background waits for the round to play out
				while (urgent) await wait(EPIC_LOAD.background.pollMs);
				if (groupDone(name)) continue;
				await pace();
				await runGroup(name, 'background');
			}
			const plan = bgPlan();
			if (plan.every(groupDone)) {
				bg.doneAt ||= now();
				return;
			}
			const failed = plan.filter((name) => groups[name].state === 'failed');
			if (!failed.length) {
				// (a group was added meanwhile: the flames after a turn, another class's intro)
				await wait(EPIC_LOAD.background.pollMs);
				continue;
			}
			const after = backgroundRetryAfter(bg.passes, EPIC_LOAD.background.retryMs);
			if (after === null) {
				bg.gaveUp = true;
				return;
			}
			bg.passes += 1;
			await wait(after);
			for (const name of failed) resetFailed(groups[name]);
		}
	} finally {
		bgRunning = false;
	}
};
/** THE START EVENT, looked at on every change and every background.pollMs until it comes */
const bgTick = () => {
	if (!bg.on || bg.startAt || bg.held) return;
	if (!bg.startupAt || !bg.landingAt || busy()) {
		bg.restFrom = 0;
		return;
	}
	bg.restFrom ||= now();
	if (!backgroundMayStart({ on: bg.on, startupAt: bg.startupAt, landingAt: bg.landingAt, busy: busy(), restFrom: bg.restFrom }, now(), EPIC_LOAD.background.restMs)) return;
	bg.startAt = now();
	void runBackground();
};
let startPoll: ReturnType<typeof setTimeout> | null = null;
const armStart = () => {
	if (startPoll || bg.startAt || !bg.on || !bg.startupAt || !bg.landingAt) return;
	const tick = () => {
		startPoll = null;
		bgTick();
		if (!bg.startAt) startPoll = setTimeout(tick, EPIC_LOAD.background.pollMs);
	};
	tick();
};
/** start-up loading is over: the deferred phase, the armoury's menu core and the turning medallion (components/Game.svelte) */
export const epicStartupDone = (): void => {
	bg.startupAt ||= now();
	armStart();
};
/** PRESS ANYWHERE or the resume card was pressed (components/Game.svelte; never in a replay, which has neither) */
export const epicLandingPassed = (): void => {
	bg.landingAt ||= now();
	armStart();
};

// ---- an Epic round ---------------------------------------------------------------------------------------------------
type Round = {
	n: number;
	via: 'book' | 'resume' | 'plaque' | 'hand';
	signal: EpicSignal;
	signalAt: number;
	plan: EpicGroup[];
	/** a group of its plan was not in at the signal: the round's line had files to fetch (THE FALLBACK) */
	fallback: boolean;
	/** each planned group's state at the signal */
	atSignal: Partial<Record<EpicGroup, string>>;
	/** when the entrance asked: relight (the trigger beat's), intro (the intro screen), press (the intro's press) */
	asked: Record<string, number>;
	hold: { at: number; end: number; decision: HoldDecision } | null;
	/** THE INTRO'S CHOICE (epicIntroLate): the plaque at once, the cloth not waited for, because the forecast said 'late'
	 *  as the intro was asked (at: performance.now(); eta: the forecast's ms then, null when none could be made) */
	introLate: { at: number; eta: number | null; decision: HoldDecision } | null;
	/** his Epic look named ahead (performance.now(); 0: not), up (lookIn), the feature's start, kept out for the round */
	prepared: number;
	lookInAt: number;
	featureAt: number;
	keptOut: boolean;
	/** the line's bytes at the signal and at the round's end */
	bytesAt: number;
	bytes: number;
	doneAt: number;
};
let serial = 0;
const rounds: Round[] = [];
const lineBytes = () => ORDER.reduce((n, name) => n + groups[name].bytes, 0);

/** his Epic look up (or he is not drawn): looked at until the round has played out */
const watchCreature = (r: Round) => {
	void (async () => {
		while (!r.doneAt && !r.lookInAt) {
			if (creature.lookIn(EPIC)) r.lookInAt = now();
			else await wait(EPIC_LOAD.pollMs);
		}
	})();
};

const startRound = (signal: EpicSignal, via: Round['via']): Round => {
	const plan = epicGroupsFor(signal, ORDER, flamesHere());
	for (const name of plan) resetFailed(groups[name]);
	const r: Round = {
		n: ++serial,
		via,
		signal,
		signalAt: now(),
		plan,
		fallback: plan.some((name) => !groupDone(name)) || (plan.includes('flames') && !flamesIn),
		atSignal: Object.fromEntries(plan.map((name) => [name, groupDone(name) ? (name === 'flames' && !flamesIn ? 'decoding' : 'in') : groups[name].state])),
		asked: {},
		hold: null,
		introLate: null,
		prepared: 0,
		lookInAt: 0,
		featureAt: 0,
		keptOut: false,
		bytesAt: lineBytes(),
		bytes: 0,
		doneAt: 0,
	};
	if (signal.feature || signal.plaque) flamesAsked = true;
	round = r;
	urgent = true;
	if (import.meta.env.DEV) {
		rounds.push(r);
		if (rounds.length > 12) rounds.shift();
	}
	if (signal.feature) {
		if (idleWarm()) onCreatureIdle();
		watchCreature(r);
	}
	void (async () => {
		for (const name of plan) await runGroup(name, 'round');
		// (a line started by hand ends itself once its files are in and up)
		if (via === 'hand') {
			if (flamesUp) await flamesUp;
			if (round === r) closeRound(r);
		}
	})();
	return r;
};
const closeRound = (r: Round) => {
	if (round === r) round = null;
	urgent = false;
	if (r.doneAt) return;
	r.doneAt = now();
	r.bytes = lineBytes() - r.bytesAt;
	if (import.meta.env.DEV) console.info(`[manticore] epic load ${summary(r)}`);
};

// ---- the game's calls -----------------------------------------------------------------------------------------------
/** what the round's book says (game/utils.ts playBet reads it first, so the creature's own early load can leave the Epic
 *  look to this file: epicDefersLook) */
export const epicSignal = (events: readonly EpicBookLike[]): EpicSignal => epicSignalOfBook(events);
/** the look game/creatureLoad.ts creatureBookArrived leaves to this file (named ahead once its files are in) */
export const epicDefersLook = (signal: EpicSignal): CreatureLook | null => (EPIC_LOAD.on && signal.feature === 'book' ? EPIC : null);
/** the round's book is in: a round is in flight; its Epic, if it has one, takes the line now */
export const epicBookArrived = (signal: EpicSignal): void => {
	if (!EPIC_LOAD.on) return;
	playing = true;
	bgTick();
	if (round) closeRound(round);
	if (!signal.feature && !signal.plaque) return;
	startRound(signal, signal.feature ?? 'plaque');
};
/** the round has played out (game/utils.ts playBet): its record is closed (DEV: the summary line); the background line
 *  goes on (or starts, once the rest has lasted) */
export const epicRoundDone = (): void => {
	playing = false;
	const r = round;
	if (r) closeRound(r);
	urgent = false;
	// (the end of a round, start-up and the landing behind it, is a moment of rest as well: an Autoplay run's gaps are
	// shorter than restMs, and its line still only starts a file between rounds)
	if (!bg.startAt && bg.startupAt && bg.landingAt) bg.restFrom = now() - EPIC_LOAD.background.restMs;
	bgTick();
	if (bg.startAt) void runBackground();
};
/** the entrance asks for its pieces (DEV record only: the margin each group had) */
export const epicAsked = (what: 'relight' | 'intro' | 'press'): void => {
	const r = round;
	if (r && !r.asked[what]) r.asked[what] = now();
};
/** the landscape courtyard was fetched at a turn (game/deferredLoad.ts loadSceneLate): the Epic flames join the line now
 *  when the background line has started or this session has needed them already (a courtyard with no braziers had none) */
export const epicSceneLate = (hasFlames: boolean): void => {
	if (!hasFlames || !EPIC_LOAD.on) return;
	landscapeScene = true;
	if (flamesIn || flamesUp || groups.flames.job) return;
	const r = round;
	if (r && !r.doneAt && (r.signal.feature || r.signal.plaque)) {
		if (!r.plan.includes('flames')) r.plan.push('flames');
		void runGroup('flames', 'round');
	} else if (bg.startAt) void runBackground();
	else if (flamesAsked) void runGroup('flames', 'background');
};

// ---- THE HOLD -------------------------------------------------------------------------------------------------------
/** what the Epic intro's press waits for, each as it stands NOW (his: whether he can show the Epic look) */
const needs = (r: Round): EpicGroupState[] => {
	const out: EpicGroupState[] = [];
	const c = groups.creature;
	if (r.plan.includes('creature')) out.push(creature.lookIn(EPIC) ? { ...c, state: 'ready' } : c.state === 'failed' ? c : { ...c, state: 'loading' });
	const f = groups.flames;
	if (r.plan.includes('flames')) out.push(flamesIn ? { ...f, state: 'ready' } : f.state === 'failed' ? f : { ...f, state: 'loading' });
	return out;
};
/** THE FORECAST: ms from now until the press's needs are up (epicPlan etaOf; Infinity: it cannot be expected) */
const forecast = (r: Round): number => {
	const lookUp = !r.plan.includes('creature') || creature.lookIn(EPIC);
	const fireUp = !r.plan.includes('flames') || flamesIn;
	const files: LineFile[] = [];
	for (const name of r.plan)
		for (const f of filesOf(name)) {
			const need = (name === 'creature' && IDLE.includes(f.url) && !lookUp) || (name === 'flames' && !fireUp);
			files.push({ total: bytesOf(f.url), got: warmReceived(f.url), warm: isWarm(f.url), need });
		}
	const { bytes } = bytesBeforeNeeds(files);
	const pending = (lookUp ? 0 : 1) + (fireUp ? 0 : 1);
	return etaOf(bytes, rateOf(warmSamples, now(), EPIC_LOAD.hold.rateWindowMs, r.signalAt), pending, EPIC_LOAD.hold.decodeMs);
};
const holdRound = (mode: string): Round | null => {
	const r = round;
	return EPIC_LOAD.on && mode === 'epic' && r && r.signal.feature === 'book' && !r.doneAt ? r : null;
};
/** THE INTRO'S CHOICE (components/ModePlaque.svelte, as an Epic intro is asked, before the War Standard is tried): true
 *  when the War Standard's Epic cloth (or its glyphs) is not in yet AND the forecast already says his look and the flames
 *  cannot be up inside holdCapMs (THE HOLD's 'late'). The intro then takes the plaque at once instead of waiting up to 4 s
 *  for the cloth (WarBanner texFor), so the press comes as promptly as on a good line. The round keeps that 'late': its
 *  press is not held either (epicHoldNeeded), and the look on show stays (NO MID ROUND SWAP). Decided once a round.
 *  With the cloth in, or a forecast that says hold (or go), false: nothing changes. Nothing is fetched or reprioritized */
export const epicIntroLate = (mode: string): boolean => {
	const r = holdRound(mode);
	if (!r) return false;
	if (r.introLate) return true;
	if (filesOf('intro').every((f) => isWarm(f.url))) return false;
	const t = now();
	const eta = forecast(r);
	const decision = holdDecision(needs(r), t, t, EPIC_LOAD.holdCapMs, eta);
	if (decision !== 'late') return false;
	r.introLate = { at: t, eta: Number.isFinite(eta) ? Math.round(eta) : null, decision };
	return true;
};
/** an Epic intro's press must wait now (false: offer it at once, as always; nothing is awaited then) */
export const epicHoldNeeded = (mode: string): boolean => {
	const r = holdRound(mode);
	if (!r) return false;
	const t = now();
	// (the intro already went to the plaque on a 'late' forecast: the press is not held, the round's decision stands)
	if (r.introLate) {
		if (!r.hold) r.hold = { at: t, end: t, decision: 'late' };
		return false;
	}
	const decision = holdDecision(needs(r), t, t, EPIC_LOAD.holdCapMs, forecast(r));
	// (the forecast says it cannot make it: no hold at all, recorded as such)
	if (decision !== 'hold' && decision !== 'go' && !r.hold) r.hold = { at: t, end: t, decision };
	return decision === 'hold';
};
/** THE HOLD: resolves when the press may be offered (its decision; never rejects, never longer than holdCapMs) */
export const epicHold = async (mode: string): Promise<HoldDecision> => {
	const r = holdRound(mode);
	if (!r) return 'go';
	const at = now();
	for (;;) {
		const decision = holdDecision(needs(r), at, now(), EPIC_LOAD.holdCapMs, forecast(r));
		if (decision !== 'hold' || r.doneAt) {
			r.hold = { at, end: now(), decision: r.doneAt ? 'fallback' : decision };
			return r.hold.decision;
		}
		await wait(EPIC_LOAD.pollMs);
	}
};
/** NO MID ROUND SWAP: the Epic feature starts (components/ModePlaque.svelte, the intro's press after the hold). His Epic
 *  look not up now: this round keeps the look on show to its end, and nothing of the Epic is decoded until rest */
export const epicFeatureStart = (mode: string): void => {
	const r = holdRound(mode);
	if (!r || r.featureAt) return;
	r.featureAt = now();
	if (!creature.lookIn(EPIC)) r.keptOut = creature.keepOut(EPIC);
};

// ---- DEV ------------------------------------------------------------------------------------------------------------
const rel = (from: number, t: number) => (t && from ? Math.round(t - from) : null);
const groupRel = (name: EpicGroup, from: number) => {
	const g = groups[name];
	return { start: rel(from, g.startAt), files: rel(from, g.filesAt), ready: rel(from, g.readyAt), failed: rel(from, g.failedAt), tries: g.tries, state: g.state, bytes: g.bytes, by: g.by, at: { start: g.startAt, files: g.filesAt, ready: g.readyAt, failed: g.failedAt } };
};
const summary = (r: Round): string => {
	const parts = r.plan.map((name) => {
		const x = groupRel(name, r.signalAt);
		return `${name} ${r.atSignal[name]} at the signal, ready ${x.ready === null ? '-' : `${x.ready > 0 ? '+' : ''}${x.ready}`}${x.failed !== null ? ` FAILED +${x.failed}` : ''}`;
	});
	const asked = Object.entries(r.asked).map(([k, t]) => `${k} +${rel(r.signalAt, t)}`);
	const hold = r.hold ? `hold ${Math.round(r.hold.end - r.hold.at)} ms (${r.hold.decision})` : 'no hold';
	const intro = r.introLate ? ` | intro plaque at once +${rel(r.signalAt, r.introLate.at)} (late, cloth not in)` : '';
	return `round ${r.n} (${r.via}${r.fallback ? ', fallback' : ''}): ${parts.join('; ')} | asked ${asked.join(', ') || 'nothing'} | ${hold}${intro}${r.keptOut ? ' | Epic look kept out for the round' : ''} | ${(r.bytes / 1e6).toFixed(2)} MB in the round`;
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
					constants: EPIC_LOAD,
					/** every URL a line can fetch, by group (the class on show) */
					urls: Object.fromEntries(ORDER.map((name) => [name, filesOf(name).map((f) => f.url)])),
					background: {
						...bg,
						running: bgRunning,
						bytes: lineBytes(),
						/** each group, ms from THE START EVENT (negative: before it, by a round's line) */
						groups: Object.fromEntries(ORDER.map((name) => [name, groupRel(name, bg.startAt)])),
						allReadyAt: bg.startAt && bgPlan().every((name) => groups[name].state === 'ready') ? Math.max(...bgPlan().map((name) => groups[name].readyAt)) : 0,
						files: fileLog,
					},
					rounds: rounds.map((r) => ({
						...r,
						holdMs: r.hold ? Math.round(r.hold.end - r.hold.at) : 0,
						rel: Object.fromEntries(r.plan.map((name) => [name, groupRel(name, r.signalAt)])),
						askedRel: Object.fromEntries(Object.entries(r.asked).map(([k, t]) => [k, rel(r.signalAt, t)])),
						lookInRel: rel(r.signalAt, r.lookInAt),
						featureRel: rel(r.signalAt, r.featureAt),
						/** THE INTRO'S CHOICE: ms from the signal the plaque was taken at once on a 'late' forecast (null: not) */
						introLateRel: r.introLate ? rel(r.signalAt, r.introLate.at) : null,
						summary: summary(r),
					})),
				}),
			),
		/** start a round's line by hand, as a book would ('plaque': the Epic flames only) */
		epicLoadStart: (what: 'book' | 'resume' | 'plaque' = 'plaque') => {
			const signal: EpicSignal = { feature: what === 'plaque' ? null : what, at: -1, plaque: what === 'plaque', plaqueAt: -1 };
			return startRound(signal, 'hand').n;
		},
		/** `?epicbg=hold`: THE START EVENT may come from now on */
		epicBackgroundRelease: () => {
			bg.held = false;
			bgTick();
			armStart();
			return bg.startAt;
		},
	});
}
