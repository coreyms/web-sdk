// Grid invariants for the reel board. Symbols must sit exactly on the lattice after every settle —
// poorly built games accumulate sub-pixel error over hundreds of spins (interrupted tweens, bounce
// overshoot, rounding). `checkBoardGrid` is run after each settle (Board.svelte) and exposed on
// `window.__angryMantis.boardDrift()` for tools/drift_test.js; in dev it snaps and logs any drift.
import { getSymbolY } from './utils';
import type { stateGame } from './stateGame.svelte';

export type DriftReport = { maxDrift: number; offenders: { reel: number; row: number; dx: number; dy: number }[] };

export const TOLERANCE = 0.01;

export const checkBoardGrid = (board: typeof stateGame.board, { snap = false } = {}): DriftReport => {
	let maxDrift = 0;
	const offenders: DriftReport['offenders'] = [];
	board.forEach((reel, reelIndex) => {
		reel.reelState.symbols.forEach((reelSymbol) => {
			// x is recomputed from reelIndex on every render (getSymbolX) so only y can drift
			const expectedY = getSymbolY(reelSymbol.symbolIndexOfBoard);
			const dy = reelSymbol.symbolY.current - expectedY;
			const drift = Math.abs(dy);
			if (drift > maxDrift) maxDrift = drift;
			if (drift > TOLERANCE) {
				offenders.push({ reel: reelIndex, row: reelSymbol.symbolIndexOfBoard, dx: 0, dy });
				if (snap) reelSymbol.symbolY.set(expectedY, { duration: 0 });
			}
		});
	});
	return { maxDrift, offenders };
};
