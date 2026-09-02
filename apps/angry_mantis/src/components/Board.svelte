<script lang="ts" module>
	import type { RawSymbol, Position } from '../game/types';

	export type EmitterEventBoard =
		| { type: 'boardSettle'; board: RawSymbol[][] }
		| { type: 'boardShow' }
		| { type: 'boardHide' }
		| {
				type: 'boardWithAnimateSymbols';
				symbolPositions: Position[];
		  }
		| { type: 'boardMarkEaten'; symbol: string }
		| { type: 'boardCheckGrid' };
</script>

<script lang="ts">
	import { waitForResolve } from 'utils-shared/wait';
	import { BoardContext } from 'components-shared';
	import { OnPressFullScreen } from 'components-layout';

	import { getContext } from '../game/context';
	import BoardContainer from './BoardContainer.svelte';
	import BoardMask from './BoardMask.svelte';
	import BoardBase from './BoardBase.svelte';
	import { checkBoardGrid } from '../game/boardGrid';

	const context = getContext();

	let show = $state(true);

	// Drift guard: after every settle the lattice must be exact; snap + report otherwise.
	const guardGrid = () => {
		const report = checkBoardGrid(context.stateGame.board, { snap: true });
		if (report.offenders.length) {
			driftEvents += 1;
			console.error('[angry_mantis] symbol drift corrected', report);
		}
	};
	let driftEvents = 0;
	if (typeof window !== 'undefined') {
		// merged, not assigned: other components (Mantis.svelte's rigClips) extend the same object
		// and mount order is not guaranteed
		Object.assign(((window as any).__angryMantis ??= {}), {
			boardDrift: () => checkBoardGrid(context.stateGame.board),
			driftEvents: () => driftEvents,
			atRest: () => context.stateGame.board.every((reel) => reel.reelState.motion === 'stopped'),
			boardLayout: () => context.stateGameDerived.boardLayout(),
			gameType: () => context.stateGame.gameType,
			// test harnesses / manual QA: fire any emitter event (e.g. winShow + winUpdate to
			// preview the staged big-win count-up without replaying a whole book)
			emit: (event: any) => context.eventEmitter.broadcast(event),
			// stage the wrap-up recap (normally stashed by bonusEnd) so FreeSpinOutro can be
			// previewed via emit(freeSpinOutroShow / freeSpinOutroCountUp) without a whole bonus
			setRecap: (recap: any) => (context.stateGame.sessionRecap = recap),
		});
	}

	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => {
			context.stateGameDerived.enhancedBoard.stop();
			context.stateGameDerived.enhancedBoard.rush();
		},
		boardSettle: ({ board }) => {
			context.stateGameDerived.enhancedBoard.settle(board);
			guardGrid();
		},
		boardCheckGrid: () => guardGrid(),
		boardShow: () => (show = true),
		boardHide: () => (show = false),
		boardWithAnimateSymbols: async ({ symbolPositions }) => {
			const getPromises = () =>
				symbolPositions.map(async (position) => {
					const reelSymbol = context.stateGame.board[position.reel].reelState.symbols[position.row];
					reelSymbol.symbolState = 'win';
					// CHAIN the resolver, never clobber it: winInfo pulses per combo un-awaited, and
					// ways combos share symbols — a plain `oncomplete = resolve` dropped the earlier
					// combo's resolver, leaving its waitForResolve/broadcastAsync chain pending
					// forever (per-combo keepalive leak). One pulse completion settles every waiter;
					// the chain resets itself so it can't regrow spin over spin.
					await waitForResolve((resolve) => {
						const prev = reelSymbol.oncomplete;
						reelSymbol.oncomplete = () => {
							reelSymbol.oncomplete = () => {};
							prev();
							resolve();
						};
					});
					reelSymbol.symbolState = 'postWinStatic';
				});

			await Promise.all(getPromises());
		},
	});

	context.eventEmitter.subscribeOnMount({
		boardMarkEaten: ({ symbol }) => {
			context.stateGame.board.forEach((reel) =>
				reel.reelState.symbols.forEach((reelSymbol) => {
					if (reelSymbol.rawSymbol.name === symbol) reelSymbol.symbolState = 'eaten';
				}),
			);
		},
	});

	context.stateGameDerived.enhancedBoard.readyToSpinEffect();
</script>

{#if show}
	{#if !context.stateXstateDerived.isIdle() && !context.stateGame.board.every((reel) => reel.reelState.motion === 'stopped')}
		<!-- tap/click anywhere while the reels are moving = same as the stop button -->
		<OnPressFullScreen onpress={() => context.eventEmitter.broadcast({ type: 'stopButtonClick' })} />
	{/if}
	<BoardContext animate={false}>
		<BoardContainer>
			<BoardMask />
			<BoardBase />
		</BoardContainer>
	</BoardContext>

	<BoardContext animate={true}>
		<BoardContainer>
			<!-- non-winner dimming happens per-symbol (SymbolWrap dim via stateGame.winFocus): a
			     board-sized dim rect here put a hard lighting seam across winners that grow past
			     the frame edge (Corey 2026-08-29) -->
			<BoardBase />
		</BoardContainer>
	</BoardContext>
{/if}
