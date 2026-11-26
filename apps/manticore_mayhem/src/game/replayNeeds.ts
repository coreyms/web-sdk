// WHAT A REPLAYED ROUND DRAWS, READ FROM ITS BOOK (2026-11-26; Stake's reviewers: "when opening a replay, it takes a long time
// to load"; Corey approved the fix the same day: a replay waits only for the files its own round uses, fetches those first,
// and shows a loading sign if there is still a wait). Pure: no Pixi, no DOM, no state (tools/replay_needs_test.mjs).
//
// Until then START REPLAY waited for the WHOLE deferred phase (game/assetGate.ts awaitDeferredAssets: every symbol sheet,
// the creature's three groups, the night, sunset and flame sets, the labels, the other layouts' art), or 30 s. On a
// phone on Fast 4G the round always reached that 30 s cap, with the card gone and the board standing still.
// A replay's round is known before the game mounts (the shared Authenticate puts it in stateBet.betToResume), so the
// game reads here what that round will draw and game/replayLoad.svelte.ts fetches it first.
//
// THE WAIT TABLE: each group a replay could draw, and what START REPLAY does about it.
//   group                                         replay              why
//   the drop sheets of the symbols that land      MUST WAIT           the first thing the round shows: without them the
//     (the reveal's board, every fill, a sting)                       board drops frozen static tiles, the first spin
//                                                                     Corey would not ship (constants LOAD_GATE)
//   the win sheets of the symbols that win in     MUST WAIT           the cluster win is the round's moment; without one
//     the round's first spin (its cascades; the                       the symbol wins on its frozen frame
//     scatter's too when it triggers a feature:
//     its trigger clip, constants WIN_SHEET.trigger)
//   the win sheets of the symbols that win only   MAY START WITHOUT   they come after the trigger beat and the intro's
//     in the free spins                                               press; fetched first thing after the must waits
//   the win plaque's set (five atlases and its    MUST WAIT when the  every plaque screen waits for it at its beat (game/
//     motion data)                                round shows one     assetGate.ts awaitPlaqueAssets, up to 30 s): waited
//                                                                     for at its beat it would freeze the board mid round
//                                                                     with no sign. Shown by: a win at or over its
//                                                                     ladder's first bar, a wincap, a feature (its intro
//                                                                     and its wrap up)
//   the audio (sfx sprite and the base loop)      MUST WAIT           the round's sounds from its first event; it is
//                                                                     ready on a decode error too, so it never strands
//   the idle loops of the symbols that land       MAY START WITHOUT   a cell at rest stands on its static tile and starts
//                                                                     breathing when its loop lands (components/BoardCells);
//                                                                     fetched straight after the above
//   the creature (idle, attacks, alternates,      MAY START WITHOUT   he stands as his still until his idle is up, and an
//     a feature's look, his win clips)                                action whose sheet is not in is not played (game/
//                                                                     creature.ts canPlay); a feature's look loads from the
//                                                                     book as in play (game/creatureLoad.ts)
//   the War Standard's motion (1.39 MB)           MUST WAIT in a      the banner is built from it (components/WarBanner.svelte):
//                                                 feature round       without it the intro takes the plaque, and built
//                                                                     mid round it would cost a frame; loaded as the game
//                                                 NOT NEEDED in a     mounts, as in play. A base round never draws it: it
//                                                 base round          goes after the must waits (game/replayLoad.svelte.ts
//                                                                     replayFilesFirst), never in front of them
//   the War Standard's cloths and glyphs          MAY START WITHOUT   the banner waits 4 s for its cloth, then the plaque
//     (a feature's intro and TOTAL WIN)                               stands in (WarBanner texFor); fetched into the cache
//                                                                     straight after the must waits
//   the Epic's files (cloth, his Epic look, its   MAY START WITHOUT   its own hold and fallbacks (game/epicLoad.ts: the
//     flames, its attacks)                                            intro takes the plaque, the look on show is kept);
//                                                                     fetched ahead, after the must waits
//   the night, frame night and sunset sets, the   MAY START WITHOUT   a feature plays over the day scene and crosses to its
//     Super flame clip                                                own when it lands, the frame keeps its day light
//                                                                     (components/Background.svelte, BoardFrame.svelte);
//                                                                     their usual place in the deferred phase
//   the drop, idle and win sheets of symbols the  NOT NEEDED          after the round's own, with the rest of the gate
//     round never shows; the plaque's set when it
//     shows none; the other label caps
//   the Armoury, the symbol popup's tiles, the    NOT NEEDED          never in front: the very end of the deferred phase,
//     turning medallion, the other layouts' art                       as in play (components/Game.svelte)
//   the Epic's background line                    NOT NEEDED          never starts in a replay (it needs the landing
//                                                                     press, game/epicLoad.ts epicLandingPassed)
//   the Super look's prefetch                     NOT NEEDED          only after the first round has played
//                                                                     (game/creatureLoad.ts creatureRoundSettled)
// Read for loading only: nothing here changes what the round shows, its timing or how it ends.
import { getFeatureSpinWinLevelData, getWinLevelDataByBookEventAmount } from './winLevelMap';
import type { BonusMode } from './types';

/** the parts of a book event this file reads (game/typesBookEvent.ts has the whole contract) */
export type ReplayBookLike = {
	type: string;
	board?: readonly (readonly string[])[];
	fill?: readonly (readonly string[])[];
	wins?: readonly { s: string }[];
	symbol?: string;
	bonus?: string;
	amount?: number;
	spinWin?: number;
};

export type ReplayNeeds = {
	/** every symbol that lands in the round, in the order it first does (its drop sheet is waited for) */
	lands: string[];
	/** every symbol that wins, in the order it first does */
	wins: string[];
	/** the symbols that win in the round's first spin, up to and with its feature's trigger (their win sheets are waited
	 *  for; the free spins' winners come after the trigger beat and the intro's press) */
	winsFirst: string[];
	/** the round shows the win plaque (a big win, a wincap, a feature's intro or wrap up) */
	plaque: boolean;
	/** the feature the round opens, if any */
	feature: BonusMode | null;
};

const add = (list: string[], s: string | undefined) => {
	if (s && !list.includes(s)) list.push(s);
};

/** what a replayed round draws (see the table above). A book read from event 0, as the replay plays it */
export const replayNeedsOf = (events: readonly ReplayBookLike[]): ReplayNeeds => {
	const out: ReplayNeeds = { lands: [], wins: [], winsFirst: [], plaque: false, feature: null };
	// the plaque is asked as the game asks it (game/bookEventHandlerMap.ts setTotalWin): a base game spin by setTotalWin's
	// amount on the base ladder, a free spin by its own win (the cascade's spinWin before it) on the feature spin ladder
	let mode: BonusMode | null = null;
	let spinWin = 0;
	for (const e of events) {
		if (e.type === 'reveal') {
			spinWin = 0;
			for (const reel of e.board ?? []) for (const s of reel) add(out.lands, s);
		} else if (e.type === 'cascade' || e.type === 'swipe' || e.type === 'roar') {
			if (e.type === 'cascade') {
				spinWin = e.spinWin ?? 0;
				for (const w of e.wins ?? []) {
					add(out.wins, w.s);
					if (!out.feature) add(out.winsFirst, w.s);
				}
			}
			for (const reel of e.fill ?? []) for (const s of reel) add(out.lands, s);
		} else if (e.type === 'sting') add(out.lands, e.symbol);
		else if (e.type === 'bonusStart') {
			// its scatters play their trigger clip, in the first spin (before the feature is noted)
			if (!out.feature) add(out.winsFirst, 'S');
			add(out.wins, 'S');
			mode = (e.bonus ?? null) as BonusMode | null;
			out.feature ??= mode;
			// its intro is a plaque screen (components/ModePlaque.svelte)
			out.plaque = true;
		} else if (e.type === 'freeSpinEnd' || e.type === 'wincap') {
			// the wrap up (components/FreeSpinOutro.svelte) and the max win count are plaque screens
			out.plaque = true;
			if (e.type === 'freeSpinEnd') mode = null;
		} else if (e.type === 'setTotalWin') {
			const amount = mode ? spinWin : (e.amount ?? 0);
			spinWin = 0;
			if (amount <= 0 || out.plaque) continue;
			const data = mode ? getFeatureSpinWinLevelData({ bookEventAmount: amount, mode }) : getWinLevelDataByBookEventAmount({ bookEventAmount: amount });
			if (data?.type === 'big') out.plaque = true;
		}
	}
	return out;
};

export type ReplayGroup = { name: string; keys: string[] };

/** the asset keys of a symbol's sheets (game/assets.ts: mmDrop_h1, mmIdle_h1, mmWin_h1) */
const keysOf = (prefix: string, codes: readonly string[]) => codes.map((c) => `${prefix}${c.toLowerCase()}`);

/** THE REPLAY'S GATE: the gate's own groups (game/assets.ts GATE_ORDER) reordered for this round. First the groups START
 *  waits for (`needed`, in order: the landing symbols' drop sheets, the first spin's winners' win sheets, the plaque's set
 *  when it is shown), then the free spins' winners' win sheets, the landing symbols' idle loops, then whatever is left of
 *  the gate in its own order. Every key of the gate
 *  is in exactly one group; a group with no keys is left out. The plaque's group keeps its name: game/deferredLoad.ts
 *  publishes its atlases all or nothing under that name. */
export const replayGateOrder = (needs: ReplayNeeds, gate: readonly ReplayGroup[]): { order: ReplayGroup[]; needed: string[] } => {
	const all = new Set(gate.flatMap((g) => g.keys));
	const taken = new Set<string>();
	/** the keys of the gate not yet in an earlier group */
	const take = (keys: readonly string[]): string[] => {
		const out: string[] = [];
		for (const k of keys) {
			if (!all.has(k) || taken.has(k)) continue;
			taken.add(k);
			out.push(k);
		}
		return out;
	};
	const plaque = gate.find((g) => g.name === 'plaque');
	const first: ReplayGroup[] = [
		{ name: 'replayDrop', keys: take(keysOf('mmDrop_', needs.lands)) },
		{ name: 'replayWin', keys: take(keysOf('mmWin_', needs.winsFirst)) },
		...(needs.plaque && plaque ? [{ name: 'plaque', keys: take(plaque.keys) }] : []),
	].filter((g) => g.keys.length);
	const soon: ReplayGroup[] = [
		{ name: 'replayWinLater', keys: take(keysOf('mmWin_', needs.wins)) },
		{ name: 'replayIdle', keys: take(keysOf('mmIdle_', needs.lands)) },
	];
	const rest = gate.map((g) => ({ name: g.name, keys: take(g.keys) }));
	return { order: [...first, ...soon, ...rest].filter((g) => g.keys.length), needed: first.map((g) => g.name) };
};
