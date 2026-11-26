// A REPLAY'S OWN FILES, FIRST (2026-11-26; constants REPLAY_LOAD has the why and Corey's approval; game/replayNeeds.ts has
// THE WAIT TABLE and the pure reading of the book).
//   1. components/Game.svelte starts the gate the moment the Pixi preload is in (the replay card comes up then) and hands it
//      replayGatePlan(): the gate's own files, in the order this round needs them (the landing symbols' drop sheets, the
//      first spin's winners' win sheets, the plaque's set when the round shows it, then the free spins' winners' win
//      sheets, the landing symbols' idle loops, then the rest of the gate), started at once beside the audio instead of
//      after it. The card's reading time is download time. A feature round's War Standard motion loads beside them, as
//      the game mounts, as in play.
//   2. Once the files START waits for are in: a base round's War Standard motion (components/WarBanner.svelte,
//      replayFilesFirst: in play it loads as the game mounts, which put 1.39 MB a base round never draws in front of its
//      own files), a feature round's cloths and glyphs into the HTTP cache, and, for a round that reaches the Epic, the
//      Epic's own files (game/epicLoad.ts epicReplayAhead, at low priority), all beside the rest of the gate. The deferred
//      phase follows the gate as in play (the creature, the scene sets, the labels; the Armoury and the other looks last).
//   3. START REPLAY (ui/ReplayModal.svelte) waits on awaitReplayNeeds: at once when those files, a feature round's banner
//      motion and the audio are in, else with the card's loading sign up, never longer than REPLAY_LOAD.capMs after the
//      press.
// Loading only: nothing here changes what the round shows, its timing once it plays, or how it ends.
import { stateBet, stateUrlDerived } from 'state-shared';

import { GATE_ORDER, STINGER_DATA_URLS, gateFileBytes } from './assets';
import { fileBytes } from './assetStamp';
import { loadBannerMotion } from './banner/motion';
import { BANNER_GLYPHS, BANNER_MOTION_URLS, BANNER_TEXTURES, bannerTierOf } from './banner/spec';
import { REPLAY_LOAD } from './constants';
import { epicBannerClass, epicReplayAhead } from './epicLoad';
import { warmFile, warmSheet, type WarmOptions } from './fileWarm';
import { gateSettled, loadGate as gateState } from './loadGate.svelte';
import { replayGateOrder, replayNeedsOf, type ReplayBookLike, type ReplayGroup, type ReplayNeeds } from './replayNeeds';
import { layoutLate } from './deferredLoad';
import { sound } from './sound';
import { STAGING_TOOLS, perfMark } from './staging';
import { replayRoundUsable } from '../ui/replayRound';

export const replayLoad = $state({
	/** bytes of the gate's files START waits for (their atlases, and the plaque's two data files when it is one of them) */
	needBytes: 0,
	/** a feature round's War Standard motion: its bytes (0: a base round, START does not wait for it) and whether it is in
	 *  (or failed: the intro then takes the plaque) */
	motionBytes: 0,
	motionIn: false,
	/** those files have landed or failed (or the whole gate has settled) */
	neededIn: false,
	/** performance.now() of that (0: not yet), of the START press, and how long the press waited (-1: not yet) */
	neededAt: 0,
	pressedAt: 0,
	waitedMs: -1,
	/** START was pressed and the round is waiting for its files: the card's loading sign */
	waiting: false,
	/** the last wait ended at REPLAY_LOAD.capMs, not with the files in */
	capped: false,
});

let plan: { needs: ReplayNeeds; order: ReplayGroup[]; needed: string[] } | null | undefined;
let events: readonly ReplayBookLike[] = [];

const bytesOfUrl = (url: string): number => {
	const m = /\/assets\/([^?#]+)/.exec(url);
	return m ? ((fileBytes as Record<string, number>)[m[1]] ?? 0) : 0;
};

/** the War Standard's files START does not wait for but the round draws: into the HTTP cache (game/fileWarm.ts; the banner
 *  reads them from there by the same URL), at normal priority beside the rest of the gate (they are small: its intro
 *  comes a few seconds into the round) */
const WARM: WarmOptions = { retries: 1, retryMs: [2000], priority: 'auto' };
const ahead = () => {
	const feature = plan?.needs.feature;
	if (feature) {
		const cls = epicBannerClass.current;
		const cloth = BANNER_TEXTURES[cls][bannerTierOf(feature)];
		void warmFile(cloth.intro, WARM).then(() => warmSheet(BANNER_GLYPHS[cls].url, WARM)).then(() => warmFile(cloth.total, WARM));
	}
	epicReplayAhead(events as Parameters<typeof epicReplayAhead>[0]);
};

let resolveNeeded: () => void = () => {};
const needed = new Promise<void>((resolve) => (resolveNeeded = resolve));
const markNeeded = () => {
	if (replayLoad.neededIn) return;
	replayLoad.neededIn = true;
	replayLoad.neededAt = performance.now();
	if (STAGING_TOOLS) perfMark('replay:needed');
	resolveNeeded();
	ahead();
};
// (a replay's gate that ends some other way, the probe's legacy mode or a throw, still lets START through)
void gateSettled.then(() => {
	if (plan) markNeeded();
});

/** a file the round may not need waits for this before it starts (components/WarBanner.svelte's motion): in a replay, until
 *  the files START waits for are in (or the gate has settled); anywhere else, and in a replay with no round to play, at once */
export const replayFilesFirst = (): Promise<void> => {
	if (!stateUrlDerived.replay()) return Promise.resolve();
	replayGatePlan();
	return plan && !plan.needs.feature ? needed : Promise.resolve();
};

/** the gate's order for this replay (game/deferredLoad.ts loadGate's `replay`), worked out once from the round's book;
 *  undefined outside a replay or when the replay answer is not a round (the card then shows REPLAY NOT AVAILABLE) */
let gatePlan: { order: ReplayGroup[]; onGroup: (name: string) => void } | undefined;
export const replayGatePlan = (): typeof gatePlan => {
	if (plan !== undefined) return gatePlan;
	plan = null;
	const bet = stateBet.betToResume as { state?: unknown } | null;
	if (!stateUrlDerived.replay() || !replayRoundUsable(bet)) return undefined;
	events = bet!.state as ReplayBookLike[];
	const needs = replayNeedsOf(events);
	const p = (plan = { needs, ...replayGateOrder(needs, GATE_ORDER) });
	const keys = p.order.filter((g) => p.needed.includes(g.name)).flatMap((g) => g.keys);
	const data = p.needed.includes('plaque') ? bytesOfUrl(STINGER_DATA_URLS.json) + bytesOfUrl(STINGER_DATA_URLS.bin) : 0;
	replayLoad.needBytes = keys.reduce((n, key) => n + gateFileBytes(key), 0) + data;
	// a feature round: its banner motion, START waits for it (the same request components/WarBanner.svelte makes as it mounts)
	if (needs.feature) {
		replayLoad.motionBytes = bytesOfUrl(BANNER_MOTION_URLS.json) + bytesOfUrl(BANNER_MOTION_URLS.bin);
		const done = () => (replayLoad.motionIn = true);
		void loadBannerMotion().then(done, done);
	}
	const left = new Set(p.needed);
	if (!left.size) markNeeded();
	gatePlan = {
		order: p.order,
		onGroup: (name) => {
			left.delete(name);
			if (!left.size) markNeeded();
		},
	};
	return gatePlan;
};

const POLL_MS = 100;
/** START REPLAY's wait, in two parts; resolves, never rejects. replayLoad.waiting is up meanwhile (only when there is a wait
 *  at all: no sign flashes when everything is in).
 *    1. `gameUp`: the game is drawn (the start-up art in, components/Game.svelte's loading screen gone). NOT capped: the
 *       round's handlers mount with the game (components/EnableGameActor.svelte, ResumeBet.svelte), and a round sent
 *       before them would be lost. Since 2026-11-26 the card opens before the game is drawn, so a press can come first.
 *    2. the files the round waits for (a feature round's banner motion with them), the audio (ready on a decode error
 *       too) and the board art of the layout on show, or REPLAY_LOAD.capMs after the later of the press and the game
 *       being drawn. */
export const awaitReplayNeeds = async (gameUp: () => boolean): Promise<void> => {
	const t0 = performance.now();
	replayLoad.pressedAt = t0;
	replayLoad.capped = false;
	// (no plan: the gate was started without one; its settling is the end of its files)
	// (layoutLate.pending: the board art of a layout the replay was turned to before START, game/deferredLoad.ts
	// loadLayoutLate: the round never starts on a board waiting for its frame, though BoardFrame draws another layout's)
	const filesIn = () => (replayLoad.neededIn || (!plan && gateState.settled)) && (replayLoad.motionIn || !replayLoad.motionBytes) && sound.isReady && layoutLate.pending === 0;
	if (!(gameUp() && filesIn())) {
		replayLoad.waiting = true;
		let capFrom = 0;
		await new Promise<void>((resolve) => {
			const look = () => {
				if (!gameUp()) return void setTimeout(look, POLL_MS);
				capFrom ||= performance.now();
				if (filesIn()) return resolve();
				if (performance.now() - capFrom >= REPLAY_LOAD.capMs) {
					replayLoad.capped = true;
					return resolve();
				}
				setTimeout(look, POLL_MS);
			};
			look();
		});
		replayLoad.waiting = false;
	}
	replayLoad.waitedMs = Math.round(performance.now() - t0);
	if (STAGING_TOOLS) perfMark(replayLoad.capped ? 'replay:capped' : 'replay:start');
};

if (import.meta.env.DEV && typeof window !== 'undefined') {
	// house rule: extend __manticore, never a new global
	((window as any).__manticore ??= {}).replayLoad = () => JSON.parse(JSON.stringify({ ...replayLoad, audioReady: sound.isReady, needs: plan?.needs ?? null, order: plan?.order ?? null, needed: plan?.needed ?? null }));
}
