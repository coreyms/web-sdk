<script lang="ts" module>
	export type EmitterEventAllWildTopUp = { type: 'allWildBoardPlay' };
</script>

<script lang="ts">
	// THE SOAP BOARD (Corey 2026-09-01, re-cut 2026-09-15): the beat that opens the max-win moment.
	//
	// WHAT THE MATH DOES: when the last paying species is eaten, check_pool_exhausted() tops the
	// round up to exactly config.wincap and ends the free-spin loop. The book's tail is
	//     maxWinCinematic -> wincap -> setTotalWin -> bonusEnd -> freeSpinEnd -> finalWin
	// with no further reveal. There is no all-wild board in any book.
	//
	// WHAT THIS IS: presentation only. A board of wild soap bars drops through the normal reel path
	// (so it inherits the turbo reel options), and the max-win count-up ladder then runs on top of
	// it (bookEventHandlerMap maxWinCinematic: winShow / winUpdate to the book's payout, MAX plate at
	// the top, the track and the screen from there). Nothing is read out here any more — the old
	// "19999.9x" top-up multiplier is gone (Corey 2026-09-15) — and nothing enters the win flow from
	// here: every number the player sees comes from the book's own maxWinCinematic.payout.
	// No Pixi nodes: the board IS the reels, so there is nothing to draw and no z-order to keep.
	import { waitForTimeout } from 'utils-shared/wait';
	import { stateBetDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { BOARD_DIMENSIONS, TIMINGS } from '../game/constants';
	import type { RawSymbol, GameType } from '../game/types';

	const context = getContext();

	/** A board of wilds in every cell, padded rows included (reveal boards carry one hidden row
	 *  top and bottom). Shaped exactly like a book reveal so it drops through the normal reel path. */
	const allWildRevealEvent = () => ({
		index: -1,
		type: 'reveal' as const,
		board: Array.from({ length: BOARD_DIMENSIONS.x }, () =>
			Array.from({ length: BOARD_DIMENSIONS.y + 2 }, () => ({ name: 'W' }) as RawSymbol),
		),
		paddingPositions: Array.from({ length: BOARD_DIMENSIONS.x }, () => 0),
		anticipation: Array.from({ length: BOARD_DIMENSIONS.x }, () => 0),
		gameType: 'freegame' as GameType,
	});

	context.eventEmitter.subscribeOnMount({
		allWildBoardPlay: async () => {
			// this board carries no glowing leaves — clear the strike bookkeeping so no stale
			// on-leaf insect preview survives onto it (ReelSymbol reads leafOrder/consumedLeaves)
			context.stateGame.pendingStrikePos = null;
			context.stateGame.consumedLeaves = [];
			context.stateGame.leafOrder = [];

			context.eventEmitter.broadcast({ type: 'soundLoop', name: 'sfx_reel_spin' });
			await context.stateGameDerived.enhancedBoard.spin({ revealEvent: allWildRevealEvent() });
			context.eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_reel_spin' });
			context.eventEmitter.broadcast({ type: 'boardCheckGrid' });
			// a beat on the full board of soap before the ladder drops in over it
			await waitForTimeout(TIMINGS.maxWinSoapHold / stateBetDerived.timeScale());
		},
	});
</script>
