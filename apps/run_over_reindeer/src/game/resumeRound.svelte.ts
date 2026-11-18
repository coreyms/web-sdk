// THE RESUME CARD, a stock rule for every game (2026-11-18, Corey: "Skip the landing screen, it should automatically give a
// card that gives players the option to resume Skip to Result, or Play Round. This should exist for both games.").
//
// A reload into a round the RGS still holds open (stateBet.betToResume.active) shows no landing screen: once the game is
// loaded, ui/ResumeCard.svelte asks Play Round (the default: the round plays on from the event the RGS has reached, as
// before) or Skip to Result (the round's final state at once, then its end-round). Replay mode never shows it (a replay
// has its own card, ui/ReplayModal.svelte). The choice is read once, when the round is handed to the game actor
// (game/actor.ts onResumeGameActive).
//
// SKIP TO RESULT, frontend only: the book is not changed and nothing is worked out here. The round's events are cut to
// what its end needs, in book order: the session state the snapshot rebuilds (the trigger, the last running total), one
// frontend event that puts the final board up at once (the last spin's board and every column standing at its end), then
// the book's own end events (floorTopUp, freeSpinEnd with its Total Win card, wincap, finalWin). The end-round is the
// resume machine's, exactly as for Play Round: once.
import { stateBet, stateUrlDerived } from 'state-shared';

import type { Bet, BookEvent, BookEventOfType } from './typesBookEvent';
import type { HeldColumn } from './typesBookEvent';

export type ResumeChoice = 'play' | 'skip';

/** the card's words (ui/ResumeCard.svelte), one set for both sessions: none of them is a word a social session forbids.
 *  The two choices are Manticore Mayhem's card's, word for word. */
export const RESUME_TEXT = {
	title: 'Unfinished Round',
	line: 'Your last round did not finish. Play it on from where it stopped, or skip straight to its result. Either way it ends exactly as it was decided.',
	mode: 'ROUND',
	play: 'Play Round',
	skip: 'Skip to Result',
};

export const resumeRound = $state({
	/** the player's answer on the card; null until pressed */
	choice: null as null | ResumeChoice,
});

/** NOTHING LEFT TO PRESENT (2026-11-18, the probe host on staging): an RGS may report a round that won nothing as still
 *  active until the next play (tools/mock_rgs.py does; the fixture RGS now does too), where another closes it at its play.
 *  A base game round (no freeSpinTrigger in its book: base and Ante spins) that pays 0 has nothing to show and needs no
 *  end-round: it is treated as finished, whichever the RGS does. A feature round is always resumed, even at 0x (its spins
 *  are still to play). */
export const roundHasNothingLeft = (bet: { active?: boolean; payoutMultiplier?: number; state?: { type: string }[] } | null | undefined): boolean => {
	if (!bet?.active) return false;
	const events = Array.isArray(bet.state) ? bet.state : [];
	if (events.some((e) => e.type === 'freeSpinTrigger')) return false;
	const pays = typeof bet.payoutMultiplier === 'number' ? bet.payoutMultiplier : Number((events as { type: string; amount?: number }[]).filter((e) => e.type === 'finalWin').pop()?.amount ?? 0);
	return !(pays > 0);
};

/** a round is open, has something left to present, and the card asks about it (never in replay mode) */
export const resumeCardWanted = (): boolean => !!stateBet.betToResume?.active && !roundHasNothingLeft(stateBet.betToResume) && !stateUrlDerived.replay();

/** the events kept after the final board, in the book's order (the round's own end) */
const END_EVENTS = ['floorTopUp', 'freeSpinEnd', 'wincap', 'finalWin'];

/** SKIP TO RESULT: the open round's book cut to its end (see the top of the file). */
export const toSkippedBet = (bet: Bet): Bet => {
	const events = bet.state as BookEvent[];
	let lastReveal = -1;
	for (let i = events.length - 1; i >= 0; i--) {
		if (events[i].type === 'reveal') {
			lastReveal = i;
			break;
		}
	}
	const reveal = lastReveal >= 0 ? (events[lastReveal] as BookEventOfType<'reveal'>) : null;
	// every column standing at the round's end: the last spin's held list, and the columns that spin made itself (a base
	// game round's columns are that spin's; a bonus round's are sticky)
	const columns: HeldColumn[] = [...(reveal?.held ?? [])];
	for (const e of events.slice(lastReveal + 1)) {
		if (e.type !== 'columnWild') continue;
		const at = columns.findIndex((c) => c.reel === e.reel);
		const col = { reel: e.reel, tier: e.tier, multiplier: e.multiplier };
		if (at >= 0) columns[at] = col;
		else columns.push(col);
	}
	const snapshot: BookEventOfType<'createBonusSnapshot'> = {
		index: 0,
		type: 'createBonusSnapshot',
		bookEvents: events.filter((e) => e.type === 'freeSpinTrigger' || e.type === 'setTotalWin'),
	};
	const skip: BookEventOfType<'skipToResult'> = {
		index: 0,
		type: 'skipToResult',
		board: reveal ? reveal.board.map((reel) => [...reel]) : [],
		columns,
		gameType: reveal?.gameType ?? 'basegame',
		fs: reveal?.fs,
		totalFs: reveal?.totalFs,
		// the round's own total so far: its last running total (setTotalWin), or a base game round's one spin (its winInfo)
		winSoFar: (() => {
			const trigger = events.some((e) => e.type === 'freeSpinTrigger');
			for (let i = events.length - 1; i >= 0; i--) {
				const e = events[i];
				if (e.type === 'setTotalWin') return e.amount;
				if (!trigger && e.type === 'winInfo') return e.totalWin;
			}
			return 0;
		})(),
	};
	const tail = events.filter((e) => END_EVENTS.includes(e.type));
	return { ...bet, state: [snapshot, skip, ...tail] as Bet['state'] };
};

if (import.meta.env.DEV && typeof window !== 'undefined') {
	// house rule: extend __reindeer, never a new global
	Object.assign(((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {}), {
		resumeRound: () => ({ wanted: resumeCardWanted(), choice: resumeRound.choice }),
	});
}
