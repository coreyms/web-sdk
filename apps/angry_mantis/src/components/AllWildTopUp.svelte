<script lang="ts" module>
	export type EmitterEventAllWildTopUp = {
		type: 'allWildTopUpPlay';
		/** book amount of the wincap top-up = maxWinCinematic.payout - the running total */
		topUp: number;
		/** book amount of the final total (maxWinCinematic.payout) — the HUD lands on exactly this */
		total: number;
	};
</script>

<script lang="ts">
	// The all-wild top-up beat (Corey 2026-09-01).
	//
	// WHAT THE MATH ACTUALLY DOES: when the last paying species is eaten,
	// game_executables.check_pool_exhausted() tops the round's win up to exactly config.wincap
	// (`missing = wincap - running_bet_win`) and ENDS the free-spin loop — every promised-but-unplayed
	// spin is forfeited (typically 9 of 10). The book's tail is therefore always
	//     maxWinCinematic -> wincap -> setTotalWin -> bonusEnd -> freeSpinEnd -> finalWin
	// with no further reveal. There is no all-wild board and no extra spin anywhere in any book.
	//
	// WHAT THIS COMPONENT IS: presentation for that single top-up event, nothing more. One board of
	// wilds drops (the ways engine pays 0x for wild-only ways, so it can never carry a real win of its
	// own — see src/calculations/ways.py), the top-up is read out as a bet multiplier, and the running
	// total then climbs to the book's own final amount. Every number on screen is derived from the
	// maxWinCinematic event: `topUp = payout - runningTotal`, and the value written back to the HUD is
	// `payout` itself — the same number the book writes two events later via wincap/setTotalWin. No
	// per-spin win is fabricated, nothing enters the win-tier flow, and no counter is decremented
	// through rounds the math never played.
	import { Container } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';
	import { stateBet, stateBetDerived } from 'state-shared';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { bookEventAmountToBetAmountMultiplier } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { BOARD_DIMENSIONS, TIMINGS } from '../game/constants';
	import type { RawSymbol, GameType } from '../game/types';
	import ArtAmount from './ArtAmount.svelte';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();

	let show = $state(false);
	let topUp = $state(0);
	let oncomplete = $state(() => {});
	let skipped = $state(false);
	const pop = new Tween(0.6, { duration: 420, easing: backOut });

	const master = $derived(context.stateLayoutDerived.mainLayout());
	const textScale = $derived(Math.min(1, master.width / 800));

	// "19999x" — the top-up as a multiple of the bet (bookEventAmount / BOOK_AMOUNT_MULTIPLIER).
	// Drawn from the stencil glyph atlas (it carries digits, '.', and 'x'), so this costs a few
	// sprite transforms rather than a styled-text raster + GPU upload — and needs no TextWarmup
	// entry, since nothing here is a FIXED string.
	const multiplierText = $derived.by(() => {
		const x = Math.round(bookEventAmountToBetAmountMultiplier(topUp) * 100) / 100;
		return `${x}x`;
	});

	/** A board of wilds in every cell, padded rows included (reveal boards carry one hidden row
	 *  top and bottom). Shaped exactly like a book reveal so it drops through the normal reel
	 *  path — and therefore inherits turbo's SPIN_OPTIONS_FAST / _INSTANT for free. */
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

	/** A bounded hold that a press collapses. Never awaits a Tween (an aborted tween task's promise
	 *  never settles), and once skipped every later hold returns immediately — so a single press
	 *  runs the whole beat out instead of only shortening the current leg. */
	const hold = async (ms: number) => {
		if (skipped) return;
		await Promise.race([
			waitForResolve((resolve) => (oncomplete = resolve)),
			waitForTimeout(ms / stateBetDerived.timeScale()),
		]);
	};

	context.eventEmitter.subscribeOnMount({
		allWildTopUpPlay: async (emitterEvent) => {
			topUp = emitterEvent.topUp;
			skipped = false;

			// this board carries no glowing leaves — clear the strike bookkeeping so no stale
			// on-leaf insect preview survives onto it (ReelSymbol reads leafOrder/consumedLeaves)
			context.stateGame.pendingStrikePos = null;
			context.stateGame.consumedLeaves = [];
			context.stateGame.leafOrder = [];

			context.eventEmitter.broadcast({ type: 'soundLoop', name: 'sfx_reel_spin' });
			await context.stateGameDerived.enhancedBoard.spin({ revealEvent: allWildRevealEvent() });
			context.eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_reel_spin' });
			context.eventEmitter.broadcast({ type: 'boardCheckGrid' });

			pop.set(0.6, { duration: 0 });
			show = true;
			pop.set(1);
			await hold(TIMINGS.maxWinTopUpHold);

			// the book's own final amount — the HUD win tween (ui/controls.svelte.ts) chases it, so
			// the running total counts up and settles on exactly the number the book pays
			stateBet.winBookEventAmount = emitterEvent.total;
			await hold(TIMINGS.maxWinTopUpCount);
			await hold(TIMINGS.maxWinTopUpOutro);

			show = false;
		},
	});
</script>

<!-- persistent + always mounted: a lazy mount would join the stage LAST, above the max-win
     cinematic that follows it (the conditional-mount z-order trap) -->
<FadeContainer persistent {show}>
	<MainContainer>
		<Container x={master.width * 0.5} y={master.height * 0.45} scale={pop.current * textScale}>
			<ArtAmount text={multiplierText} height={96} maxWidth={720} />
		</Container>
	</MainContainer>
	<!-- no prompt text: the beat is ~2s and auto-advances; a press just collapses it -->
	<PressToContinue
		active={show}
		onpress={() => {
			skipped = true;
			oncomplete();
		}}
	/>
</FadeContainer>
