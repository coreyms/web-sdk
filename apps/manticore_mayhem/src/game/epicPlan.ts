// THE EPIC ON DEMAND, ITS PURE PARTS (constants EPIC_LOAD; game/epicLoad.ts runs them; node test tools/epic_load_test.mjs).
// No Pixi, no DOM, no constants import: what the book says, which groups load and in what order, and the hold's state
// machine. Presentation only: none of this decides anything the player is shown, only what is fetched and when the
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
 *  state now; `askedAt`: when the press would have been offered.
 *    go        every need is ready: the press now (at once when they were in already: no change of timing)
 *    fallback  nothing more is coming (every need settled, one failed for good): the press now, the look on show stays
 *              and the game falls back as it does for any look that failed (he keeps his look, the base flames burn)
 *    capped    holdCapMs have passed: the press now, whatever is still on its way lands when it lands
 *    hold      not yet: look again in EPIC_LOAD.pollMs */
export type HoldDecision = 'go' | 'fallback' | 'capped' | 'hold';
export const holdDecision = (needs: readonly EpicGroupState[], askedAt: number, now: number, capMs: number): HoldDecision => {
	if (needs.every((g) => g.state === 'ready')) return 'go';
	if (needs.every((g) => g.state === 'ready' || g.state === 'failed')) return 'fallback';
	if (now - askedAt >= capMs) return 'capped';
	return 'hold';
};
