import type { BetModeMeta } from 'state-shared';
import config from './config';
import { soc } from './social';

// Feeds the shared bonus-buy modal / ante toggle. Keys must match the RGS mode names (math-sdk bet mode names).
const placeholderAssets = { icon: '', volatility: '', button: '', dialogImage: '', dialogVolatility: '' };

export const betModeMeta: BetModeMeta = {
	BASE: {
		mode: 'BASE',
		costMultiplier: config.betModes.base.cost,
		type: 'default',
		parent: '',
		children: '',
		maxWin: config.maxWin,
		assets: placeholderAssets,
		text: { title: '', dialog: '', button: '', betAmountLabel: '', tickerIdle: '', tickerSpin: '' },
	},
	ANTE: {
		mode: 'ANTE',
		costMultiplier: config.betModes.ante.cost,
		type: 'activate',
		parent: '',
		children: '',
		maxWin: config.maxWin,
		assets: placeholderAssets,
		text: {
			title: soc('ANTE BET', 'ANTE MODE'),
			description: 'Marky is locked onto reel 1 every spin. Only two more Marky symbols needed to trigger Free Spins.',
			dialog: soc(
				'Doubles the bet. A Marky scatter is locked on reel 1 for every spin, so every feature is easier to hit. Ante Bet stays active until you turn it off.',
				'Doubles the play amount. A Marky scatter is locked on reel 1 for every spin, so every feature is easier to hit. Ante Mode stays active until you turn it off.',
			),
			button: 'ACTIVATE',
			betAmountLabel: soc('ANTE BET', 'ANTE MODE'),
			tickerIdle: soc('ANTE BET IS ACTIVE', 'ANTE MODE IS ACTIVE'),
			tickerSpin: 'MARKY IS WATCHING',
		},
	},
	BONUS: {
		mode: 'BONUS',
		costMultiplier: config.betModes.bonus.cost,
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
		costMultiplier: config.betModes.super.cost,
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
	FEAST: {
		mode: 'FEAST',
		costMultiplier: config.betModes.feast.cost,
		type: 'buy',
		parent: '',
		children: '',
		maxWin: config.maxWin,
		assets: placeholderAssets,
		text: {
			title: 'MANTIS FEAST',
			description: `${config.freeSpins.feast} Free Spins with Marty AND Marky. Two opening bites, both mantises strike.`,
			dialog: soc(`Buy ${config.freeSpins.feast} Mantis Feast spins. Both mantises feed.`, `Play ${config.freeSpins.feast} Mantis Feast spins. Both mantises feed.`),
			button: soc('BUY', 'PLAY'),
			betAmountLabel: 'MANTIS FEAST',
			tickerIdle: '',
			tickerSpin: '',
		},
	},
};
