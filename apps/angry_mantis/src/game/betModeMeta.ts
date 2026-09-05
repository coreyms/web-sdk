import { stateConfig, type BetModeMeta } from 'state-shared';
import config from './config';
import { soc } from './social';

// WHY: the RGS owns the betting parameters — Stake's submission checklist requires the game to use
// the cost multipliers from the authenticate response, not this build's copy of the math config, so
// a math re-publish that reprices a buy can never leave the UI quoting a price /wallet/play won't
// charge. config.betModes is the fallback only (our mock RGS lists mode names with no cost).
const LOCAL_COST: Record<string, number> = Object.fromEntries(
	Object.entries(config.betModes).map(([key, mode]) => [key.toUpperCase(), mode.cost]),
);

/** Cost multiplier for a mode: the authenticate value when the RGS declared one, else the local math config. */
export const modeCost = (mode: string): number => {
	const key = mode.toUpperCase();
	return stateConfig.betModes[key]?.costMultiplier ?? LOCAL_COST[key] ?? 1;
};

/**
 * Re-reads the authenticate values into the shared table. This module is evaluated at boot — before
 * Authenticate resolves — so the literal below is seeded from the local config; Game.svelte (which
 * only mounts once authenticate has returned) calls this to overwrite it in place, keeping the one
 * table every consumer already holds a reference to as the single source of truth.
 */
export const applyRgsBetModes = () => {
	for (const [key, meta] of Object.entries(betModeMeta)) {
		meta.costMultiplier = modeCost(key);
		const maxWin = stateConfig.betModes[key]?.maxWin;
		if (maxWin !== undefined) meta.maxWin = maxWin;
	}
};

// Feeds the shared bonus-buy modal / ante toggle. Keys must match the RGS mode names (math-sdk bet mode names).
const placeholderAssets = { icon: '', volatility: '', button: '', dialogImage: '', dialogVolatility: '' };

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
	ANTE: {
		mode: 'ANTE',
		costMultiplier: modeCost('ANTE'),
		type: 'activate',
		parent: '',
		children: '',
		maxWin: config.maxWin,
		assets: placeholderAssets,
		text: {
			title: soc('ANTE BET', 'ANTE MODE'),
			description: 'Marky is locked onto reel 1 every spin. Only two more Marky symbols needed to trigger Free Spins.',
			dialog: soc(
				'Triples the bet. A Marky scatter is locked on reel 1 for every spin, so features land about four times as often. Ante Bet stays active until you turn it off.',
				'Triples the play amount. A Marky scatter is locked on reel 1 for every spin, so features land about four times as often. Ante Mode stays active until you turn it off.',
			),
			button: 'ACTIVATE',
			betAmountLabel: soc('ANTE BET', 'ANTE MODE'),
			tickerIdle: soc('ANTE BET IS ACTIVE', 'ANTE MODE IS ACTIVE'),
			tickerSpin: 'MARKY IS WATCHING',
		},
	},
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
			description: soc(
				`${config.freeSpins.free} Free Spins with Marty. Marty eats the lowest-paying symbol to start, and every Dinner Leaf is another bite.`,
				`${config.freeSpins.free} Free Spins with Marty. Marty eats the lowest-value symbol to start, and every Dinner Leaf is another bite.`,
			),
			dialog: soc(`Buy ${config.freeSpins.free} Free Spins hosted by Marty.`, `Play ${config.freeSpins.free} Free Spins hosted by Marty.`),
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
			description: `${config.freeSpins.super} Free Spins with Marky. More Dinner Leaves, more bites, faster escalation.`,
			dialog: soc(`Buy ${config.freeSpins.super} Super Free Spins hosted by Marky.`, `Play ${config.freeSpins.super} Super Free Spins hosted by Marky.`),
			button: soc('BUY', 'PLAY'),
			betAmountLabel: 'SUPER FREE SPINS',
			tickerIdle: '',
			tickerSpin: '',
		},
	},
	MYSTERY: {
		mode: 'MYSTERY',
		costMultiplier: modeCost('MYSTERY'),
		type: 'buy',
		parent: '',
		children: '',
		maxWin: config.maxWin,
		assets: placeholderAssets,
		text: {
			title: 'MYSTERY BUY',
			description: `One spin. ${config.mystery.super * 100}% Super Free Spins, ${config.mystery.feast * 100}% Mantis Feast, ${config.mystery.nothing * 100}% nothing at all. A Mystery Feast always pays at least ${config.feastMinWin}x the bet.`,
			dialog: soc('Buy a Mystery spin: 40% Super Free Spins, 10% Mantis Feast, 50% nothing.', 'Play a Mystery spin: 40% Super Free Spins, 10% Mantis Feast, 50% nothing.'),
			button: soc('BUY', 'PLAY'),
			betAmountLabel: 'MYSTERY BUY',
			tickerIdle: '',
			tickerSpin: '',
		},
	},
};
