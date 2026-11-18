import { createIntermediateMachineBet } from './createIntermediateMachineBet';
import { createIntermediateMachineAutoBet } from './createIntermediateMachineAutoBet';
import { createIntermediateMachineResumeBet } from './createIntermediateMachineResumeBet';

import type { PrimaryMachines } from './types';

const createIntermediateMachines = ({
	resumeGame,
	newGame,
	playGame,
	endGame,
	autoSpinPause,
}: PrimaryMachines) => {
	const bet = createIntermediateMachineBet({ newGame, playGame, endGame });
	const autoBet = createIntermediateMachineAutoBet({ bet, autoSpinPause });
	const resumeBet = createIntermediateMachineResumeBet({ resumeGame, playGame, endGame });

	return {
		bet,
		autoBet,
		resumeBet,
	};
};

export { createIntermediateMachines };
