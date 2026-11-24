// THE EPIC'S FILES, ITS PURE PARTS (constants EPIC_LOAD; game/epicLoad.ts runs them; node test tools/epic_load_test.mjs).
// No Pixi, no DOM, no constants import: what the book says, which groups load and in what order, the hold's state
// machine and its forecast, the background line's start event and pacing, and THE DECODE RULE. Presentation only: none of this decides anything the player is shown, only what is fetched and when the
// Epic intro's press may be offered.
import { getFeatureSpinWinLevelData, getWinLevelDataByBookEventAmount } from './winLevelMap';
import type { BonusMode } from './types';

export type EpicBookLike = { type: string; bonus?: string; amount?: number; spinWin?: number; bookEvents?: readonly EpicBookLike[] };
export type EpicGroup = 'intro' | 'creature' | 'flames' | 'attacks';

/** WHAT A BOOK SAYS ABOUT THE EPIC, read the moment the play request answers (game/utils.ts playBet):
 *   feature  'book'    the round opens Epic Free Spins: its bonusStart has bonus "epic" (every book has at most one
 *                      bonusStart, on the trigger spin; 6 or more scatters in the base game, Ante or Super Ante, or a bought
 *                      Free Spins or Super round whose trigger spin lands them). A replay is the whole book from event 0,
 *                      and a round resumed BEFORE its bonusStart still has it: both read as 'book'
 *            'resume'  a round resumed INSIDE an Epic: the bonusStart is in its createBonusSnapshot (game/utils.ts
 *                      convertTorResumableBet); no intro is played, the mode is the Epic from the first frame
 *            null      no Epic feature in this round
 *   at       the index in `events` of that bonusStart (or of the snapshot), -1 for none
 *   plaque   a win plaque of this round stops its count on EPIC (1,500x on its ladder): THE EPIC FIRE SET burns the Epic
 *            flame clip under it (components/StingerPlaque.svelte epicStep). Read the way game/creatureLoad.ts winsOfBook
 *            reads the plaques: a base game spin by setTotalWin's amount, a free spin by its own win (the cascade's spinWin
 *            before it) on its feature's ladder, nothing after the book's wincap */
export type EpicSignal = { feature: 'book' | 'resume' | null; at: number; plaque: boolean; plaqueAt: number };

/** STINGER_TIERS index of EPIC (big, super, mega, epic, max: game/stinger/types.ts) */
const EPIC_TIER = 3;

export const epicSignalOfBook = (events: readonly EpicBookLike[]): EpicSignal => {
	const out: EpicSignal = { feature: null, at: -1, plaque: false, plaqueAt: -1 };
	let mode: BonusMode | null = null;
	let spinWin = 0;
	let capped = false;
	events.forEach((e, i) => {
		if (e.type === 'createBonusSnapshot') {
			const start = (e.bookEvents ?? []).filter((x) => x.type === 'bonusStart').pop();
			if (start) {
				mode = (start.bonus ?? null) as BonusMode | null;
				if (start.bonus === 'epic' && !out.feature) {
					out.feature = 'resume';
					out.at = i;
				}
			}
		} else if (e.type === 'bonusStart') {
			mode = (e.bonus ?? null) as BonusMode | null;
			if (e.bonus === 'epic' && !out.feature) {
				out.feature = 'book';
				out.at = i;
			}
		} else if (e.type === 'cascade') spinWin = e.spinWin ?? 0;
		else if (e.type === 'reveal') spinWin = 0;
		else if (e.type === 'wincap') capped = true;
		else if (e.type === 'setTotalWin') {
			const amount = mode ? spinWin : (e.amount ?? 0);
			spinWin = 0;
			if (capped || amount <= 0 || out.plaque) return;
			const data = mode ? getFeatureSpinWinLevelData({ bookEventAmount: amount, mode }) : getWinLevelDataByBookEventAmount({ bookEventAmount: amount });
			if (data && data.type === 'big' && data.level - 6 === EPIC_TIER) {
				out.plaque = true;
				out.plaqueAt = i;
			}
		} else if (e.type === 'freeSpinEnd') mode = null;
	});
	return out;
};

/** the groups this round loads, in order (constants EPIC_LOAD.order): an Epic feature takes all of them but the intro on a
 *  resume (no intro is played then); an Epic plaque alone takes the flames; the flames only where the scene draws them
 *  (`flames` false: a game booted upright, whose courtyard has no braziers, until it is turned) */
export const epicGroupsFor = (signal: EpicSignal, order: readonly EpicGroup[], flames: boolean): EpicGroup[] => {
	const want = new Set<EpicGroup>();
	if (signal.feature === 'book') for (const g of order) want.add(g);
	if (signal.feature === 'resume') for (const g of order) if (g !== 'intro') want.add(g);
	if (signal.plaque) want.add('flames');
	if (!flames) want.delete('flames');
	return order.filter((g) => want.has(g));
};

// ---- THE TRACK: each group's state through one round, and the hold's decision -------------------------------------
export type EpicGroupState = {
	state: 'waiting' | 'loading' | 'ready' | 'failed';
	/** tries so far (the first counts) */
	tries: number;
	/** performance.now(): the group's first request, its files in the cache, drawable (decoded and uploaded), failed for good */
	startAt: number;
	filesAt: number;
	readyAt: number;
	failedAt: number;
};
export const newGroupState = (): EpicGroupState => ({ state: 'waiting', tries: 0, startAt: 0, filesAt: 0, readyAt: 0, failedAt: 0 });

/** a group that failed for good is tried afresh (a later background pass, or a round that needs it): back to waiting */
export const resetFailed = (g: EpicGroupState): void => {
	if (g.state !== 'failed') return;
	g.state = 'waiting';
	g.tries = 0;
	g.failedAt = 0;
};
export const markStart = (g: EpicGroupState, now: number): void => {
	if (g.state === 'ready' || g.state === 'failed') return;
	g.state = 'loading';
	g.tries += 1;
	if (!g.startAt) g.startAt = now;
};
export const markFiles = (g: EpicGroupState, now: number): void => {
	if (!g.filesAt) g.filesAt = now;
};
export const markReady = (g: EpicGroupState, now: number): void => {
	if (g.state === 'ready') return;
	g.state = 'ready';
	g.readyAt = now;
	if (!g.filesAt) g.filesAt = now;
};
/** a try failed: 'retry' while tries are left (the group goes back to waiting, `retryMs[tries - 1]` later), else 'failed' */
export const markTryFailed = (g: EpicGroupState, now: number, retries: number): 'retry' | 'failed' => {
	if (g.state === 'ready') return 'failed';
	if (g.tries <= retries) {
		g.state = 'waiting';
		return 'retry';
	}
	g.state = 'failed';
	g.failedAt = now;
	return 'failed';
};
export const retryDelay = (tries: number, retryMs: readonly number[]): number => retryMs[Math.min(Math.max(0, tries - 1), retryMs.length - 1)] ?? 0;

/** THE HOLD (components/ModePlaque.svelte, an Epic intro's press). `needs`: the groups the press waits for, each with its
 *  state now; `askedAt`: when the press would have been offered; `etaMs`: the forecast of when the last need is up, from
 *  now (etaOf; 0: no forecast, the old rule).
 *    go        every need is ready: the press now (at once when they were in already: no change of timing)
 *    fallback  nothing more is coming (every need settled, one failed for good): the press now, the look on show stays
 *              and the game falls back as it does for any look that failed (he keeps his look, the base flames burn)
 *    capped    holdCapMs have passed: the press now, whatever is still on its way lands when it lands
 *    late      the forecast says the needs cannot be up before the cap: the press now, no use waiting (at the first ask:
 *              no hold at all)
 *    hold      not yet: look again in EPIC_LOAD.pollMs */
export type HoldDecision = 'go' | 'fallback' | 'capped' | 'late' | 'hold';
export const holdDecision = (needs: readonly EpicGroupState[], askedAt: number, now: number, capMs: number, etaMs = 0): HoldDecision => {
	if (needs.every((g) => g.state === 'ready')) return 'go';
	if (needs.every((g) => g.state === 'ready' || g.state === 'failed')) return 'fallback';
	if (now - askedAt >= capMs) return 'capped';
	if (etaMs > capMs - (now - askedAt)) return 'late';
	return 'hold';
};

// ---- THE HOLD's forecast (constants EPIC_LOAD.hold) -------------------------------------------------------------------
/** one file on the line, in the line's order: its whole size (a sheet's json counts its picture: scripts/stamp-assets.mjs
 *  fileBytes), the bytes of it in so far, whether it is in, whether the press waits for it */
export type LineFile = { total: number; got: number; warm: boolean; need: boolean };
/** the bytes the line still has to fetch up to and including the last file the press waits for that is not in (the line
 *  is one file at a time, so the files ahead of it come first); `sheets`: how many of the needed files are not in */
export const bytesBeforeNeeds = (files: readonly LineFile[]): { bytes: number; sheets: number } => {
	let last = -1;
	files.forEach((f, i) => {
		if (f.need && !f.warm) last = i;
	});
	let bytes = 0;
	let sheets = 0;
	for (let i = 0; i <= last; i += 1) {
		const f = files[i];
		if (f.warm) continue;
		bytes += Math.max(0, f.total - f.got);
		if (f.need) sheets += 1;
	}
	return { bytes, sheets };
};
/** bytes per ms over the last `windowMs` (samples: each chunk read, its time and size), counted from `since` when the line
 *  started later than the window's start; 0 when nothing came in the window */
export const rateOf = (samples: readonly { t: number; bytes: number }[], now: number, windowMs: number, since = -Infinity): number => {
	const from = Math.max(now - windowMs, since);
	let bytes = 0;
	for (const s of samples) if (s.t > from && s.t <= now) bytes += s.bytes;
	if (!bytes) return 0;
	return bytes / Math.max(250, now - from);
};
/** the forecast, ms from now: the bytes left at the rate, plus decodeMs for each need not up yet (`pending`). Infinity
 *  when bytes are left and no rate is measured (it cannot be expected) */
export const etaOf = (bytesLeft: number, bytesPerMs: number, pending: number, decodeMs: number): number => {
	if (bytesLeft <= 0) return pending * decodeMs;
	if (!(bytesPerMs > 0)) return Infinity;
	return bytesLeft / bytesPerMs + pending * decodeMs;
};

// ---- THE BACKGROUND LINE (constants EPIC_LOAD.background) -----------------------------------------------------------
/** THE START EVENT: start-up loading is over, the landing press is passed, no round is in flight, and that has held for
 *  restMs (`restFrom`: when it last became true; 0 = not now) */
export type StartState = { on: boolean; startupAt: number; landingAt: number; busy: boolean; restFrom: number };
export const backgroundMayStart = (s: StartState, now: number, restMs: number): boolean => s.on && s.startupAt > 0 && s.landingAt > 0 && !s.busy && s.restFrom > 0 && now - s.restFrom >= restMs;
/** a pass whose group failed runs again after retryMs[pass] (pass 0 is the first retry); null: no more (bounded) */
export const backgroundRetryAfter = (pass: number, retryMs: readonly number[]): number | null => (pass >= 0 && pass < retryMs.length ? retryMs[pass] : null);
/** may the line start its next file now: always for a round's line (urgent), else not while a play request is on the
 *  wire, a round plays, or the creature's Super prefetch runs (one background file at a time across the game) */
export const backgroundMayFetch = (s: { urgent: boolean; request: boolean; busy: boolean; prefetching: boolean }): boolean => s.urgent || (!s.request && !s.busy && !s.prefetching);

/** THE DECODE RULE: an Epic file may be decoded and go to the GPU now.
 *    a round whose book names the Epic, before its feature starts (the trigger and the intro: his upload turn and THE
 *    QUIET, the path the game already uses for a look a book names ahead; a plaque alone, or a resumed Epic, the whole
 *    round, as on demand always did)                                                                  yes
 *    that round once its feature has started                                                          no (at rest after it)
 *    no Epic round: only at rest (the landing passed, no round in flight)                             atRest */
export const decodeAllowed = (s: { epicRound: boolean; featureStarted: boolean; atRest: boolean }): boolean => (s.epicRound ? !s.featureStarted : s.atRest);
