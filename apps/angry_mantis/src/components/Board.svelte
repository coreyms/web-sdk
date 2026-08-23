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
	import { BOARD_SIZES } from '../game/constants';
	import { Rectangle } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';

	const context = getContext();

	let show = $state(true);
	const hasWinners = $derived(context.stateGame.board.some((reel) => reel.reelState.symbols.some((s) => s.symbolState === 'win')));

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
		(window as any).__angryMantis = {
			boardDrift: () => checkBoardGrid(context.stateGame.board),
			driftEvents: () => driftEvents,
			atRest: () => context.stateGame.board.every((reel) => reel.reelState.motion === 'stopped'),
			boardLayout: () => context.stateGameDerived.boardLayout(),
		};
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
					await waitForResolve((resolve) => (reelSymbol.oncomplete = resolve));
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
			<!-- dims the non-winning tiles while winners animate above it -->
			<FadeContainer show={hasWinners} duration={180}>
				<Rectangle width={BOARD_SIZES.width} height={BOARD_SIZES.height} backgroundColor={0x000000} alpha={0.5} />
			</FadeContainer>
			<BoardBase />
		</BoardContainer>
	</BoardContext>
{/if}
