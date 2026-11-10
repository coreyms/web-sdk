import { stateConfig, type BetModeMeta } from 'state-shared';
import config from './config';
import { soc } from './social';

// Six modes (Corey 2026-11-09): base, three Ante levels picked on ONE card with a slider, and two buys.
// The keys are what goes to the RGS as `mode` (upper case). The math so far has base, bonus and super; the three
// Ante keys below are this frontend's working names until the math publishes its own.
//
// WHY the costs are read at runtime: cost multipliers are a betting parameter the RGS owns, and the submission
// checklist requires the game to use the authenticate response's values rather than a build-time copy.
// components-shared Authenticate stores them in stateConfig.betModes; this table falls back to game/config.ts only
// for a mode the response did not price.
const LOCAL_COST: Record<string, number> = Object.fromEntries(Object.entries(config.betModes).map(([key, mode]) => [key.toUpperCase(), mode.cost]));

/** Cost multiplier for a mode: the authenticate value when the RGS declared one, else the local math config. */
export const modeCost = (mode: string): number => {
	const key = mode.toUpperCase();
	return stateConfig.betModes[key]?.costMultiplier ?? LOCAL_COST[key] ?? 1;
};

/** Re-reads the authenticate values into the shared table (called by Game.svelte once it mounts). */
export const applyRgsBetModes = () => {
	for (const [key, meta] of Object.entries(betModeMeta)) {
		meta.costMultiplier = modeCost(key);
		const maxWin = stateConfig.betModes[key]?.maxWin;
		if (maxWin !== undefined) meta.maxWin = maxWin;
	}
};

/** the Ante levels' keys, lowest price first (the feature menu's slider stops) */
export const ANTE_KEYS = config.anteModes.map((key) => key.toUpperCase());

/** THE MODE'S SHORT NAME, for a player: the HUD label over the price, the Spin button's face, the feature button,
 *  the autoplay card's chip. Never show a raw mode key. */
const MODE_SHORT: Record<string, string> = {
	BASE: 'BASE',
	ANTE_2: 'ANTE',
	ANTE_4: 'ANTE',
	ANTE_10: 'ANTE',
	BONUS: 'BONUS',
	SUPER: 'SUPER',
};
/** a mode's short player-facing name, whatever the case of the key it is asked with */
export const modeShortLabel = (mode: string): string => {
	const key = (mode ?? '').toUpperCase();
	return MODE_SHORT[key] ?? key.replace(/_/g, ' ');
};

// Assets are unused: the feature menu is ui/FeatureMenu.svelte and draws its own cards.
const placeholderAssets = { icon: '', volatility: '', button: '', dialogImage: '', dialogVolatility: '' };

const ante = (key: string) => ({
	mode: key,
	costMultiplier: modeCost(key),
	type: 'activate' as const,
	parent: '',
	children: '',
	maxWin: config.maxWin,
	assets: placeholderAssets,
	text: {
		title: soc('ANTE BET', 'ANTE MODE'),
		description: 'Free Spins and Super Free Spins trigger more often. Stays on until you switch it off.',
		dialog: soc('Raises the bet. Free Spins and Super Free Spins trigger more often. Stays on until you switch it off.', 'Raises the play amount. Free Spins and Super Free Spins trigger more often. Stays on until you switch it off.'),
		button: 'ACTIVATE',
		betAmountLabel: soc('ANTE BET', 'ANTE MODE'),
		tickerIdle: soc('ANTE BET IS ACTIVE', 'ANTE MODE IS ACTIVE'),
		tickerSpin: '',
	},
});

export const betModeMeta: BetModeMeta = {
	BASE: {
		mode: 'BASE',
		costMultiplier: modeCost('BASE'),
		type: 'default',
		parent: '',
		children: '',
		maxWin: config.maxWin,
		assets: placeholderAssets,
		text: { title: '', dialog: '', button: '', betAmountLabel: '', tickerIdle: '', tickerSpin: '' },
	},
	ANTE_2: ante('ANTE_2'),
	ANTE_4: ante('ANTE_4'),
	ANTE_10: ante('ANTE_10'),
	BONUS: {
		mode: 'BONUS',
		costMultiplier: modeCost('BONUS'),
		type: 'buy',
		parent: '',
		children: '',
		maxWin: config.maxWin,
		assets: placeholderAssets,
		text: {
			title: 'FREE SPINS',
			description: `${config.freeSpins} free spins. Wilds stay on the road for the whole round.`,
			dialog: soc(`Buy ${config.freeSpins} free spins.`, `Play ${config.freeSpins} free spins.`),
			button: soc('BUY', 'PLAY'),
			betAmountLabel: 'FREE SPINS',
			tickerIdle: '',
			tickerSpin: '',
		},
	},
	SUPER: {
		mode: 'SUPER',
		costMultiplier: modeCost('SUPER'),
		type: 'buy',
		parent: '',
		children: '',
		maxWin: config.maxWin,
		assets: placeholderAssets,
		text: {
			title: 'SUPER FREE SPINS',
			description: `${config.freeSpins} super free spins. The round starts with one full column Wild in place.`,
			dialog: soc(`Buy ${config.freeSpins} Super Free Spins.`, `Play ${config.freeSpins} Super Free Spins.`),
			button: soc('BUY', 'PLAY'),
			betAmountLabel: 'SUPER FREE SPINS',
			tickerIdle: '',
			tickerSpin: '',
		},
	},
};
