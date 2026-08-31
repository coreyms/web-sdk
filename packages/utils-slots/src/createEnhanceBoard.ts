import { createEnhanceBoardPreSpin } from './createEnhanceBoardPreSpin';
import { createEnhanceBoardSpin } from './createEnhanceBoardSpin';
import { stateSlots } from './stateSlots.svelte';
import type { Reel, GetRawSymbolFromReel } from './types';

export function createEnhanceBoard() {
	function enhanceBoard<TReel extends Reel<any, any>>({ board }: { board: TReel[] }) {
		type TRawSymbol = GetRawSymbolFromReel<TReel>;

		const { preSpin } = createEnhanceBoardPreSpin({ board });
		const { spin } = createEnhanceBoardSpin({ board });
		const settle = (rawBoard?: TRawSymbol[][]) => {
			// A settle ends any pre-spin in progress (e.g. a bet that failed after preSpin).
			// Leaving isPreSpinning set would deadlock the next spin() on a preSpin-skipping
			// path, stuck awaiting readyToSpin resolvers that never fire.
			stateSlots.isPreSpinning = false;
			board.forEach((reel, reelIndex) => {
				// No board (e.g. a failed bet) = settle reel motion only, keeping the
				// current rawSymbols — never pass [] here: it would write undefined into
				// every reel symbol.
				reel.setSymbolsWithRawSymbols(rawBoard?.[reelIndex]);
			});
		};
		const stop = () => board.forEach((reel) => reel.stop());
		const rush = () => board.forEach((reel) => reel.rush());
		const readyToSpinEffect = () => {
			board.forEach((reel) => reel.readyToSpinEffect());
		};

		return {
			board,
			preSpin,
			spin,
			settle,
			stop,
			rush,
			readyToSpinEffect,
		};
	}

	return { enhanceBoard };
}
