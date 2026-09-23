import { stateConfig, type BetModeMeta } from 'state-shared';
import config from './config';
import { soc } from './social';

// WHY: the RGS owns the betting parameters — Stake's submission checklist requires the game to use
// the cost multipliers from the authenticate response, not this build's copy of the math config, so
// a math re-publish that reprices a buy can never leave the UI quoting a price /wallet/play won't
// charge. config.betModes is the fallback only.
//
// KEYS ARE THE RGS MODE NAMES, UPPERCASED. The published index.json names the seven modes
// base / ante / super_ante / bonus / super / epic / mystery, and the mock RGS builds its betModes
// map straight from that file, so the keys here are BASE / ANTE / SUPER_ANTE / BONUS / SUPER /
// EPIC / MYSTERY. A key that does not match is a mode the player can never buy.
const LOCAL_COST: Record<string, number> = Object.fromEntries(
	Object.entries(config.betModes).map(([key, mode]) => [key.toUpperCase(), mode.cost]),
);

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

const placeholderAssets = { icon: '', volatility: '', button: '', dialogImage: '', dialogVolatility: '' };

const spins = config.freeSpins;

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
			description: 'Free Spins and Super Free Spins land about five times as often as in the base game.',
			dialog: soc(
				'Triples the bet. Free Spins and Super Free Spins land about five times as often. Ante Bet stays active until you turn it off.',
				'Triples the play amount. Free Spins and Super Free Spins land about five times as often. Ante Mode stays active until you turn it off.',
			),
			button: 'ACTIVATE',
			betAmountLabel: soc('ANTE BET', 'ANTE MODE'),
			tickerIdle: soc('ANTE BET IS ACTIVE', 'ANTE MODE IS ACTIVE'),
			tickerSpin: 'THE MANTICORE IS WATCHING',
		},
	},
	SUPER_ANTE: {
		mode: 'SUPER_ANTE',
		costMultiplier: modeCost('SUPER_ANTE'),
		type: 'activate',
		parent: '',
		children: '',
		maxWin: config.maxWin,
		assets: placeholderAssets,
		text: {
			title: soc('SUPER ANTE BET', 'SUPER ANTE MODE'),
			description: 'No regular Free Spins at all: only Super and Epic, at about the rate Ante reaches Free Spins and Super.',
			dialog: soc(
				'Ten times the bet. Regular Free Spins cannot trigger: only Super Free Spins and Epic Free Spins, and four standards upgrade to a Super. Stays active until you turn it off.',
				'Ten times the play amount. Regular Free Spins cannot trigger: only Super Free Spins and Epic Free Spins, and four standards upgrade to a Super. Stays active until you turn it off.',
			),
			button: 'ACTIVATE',
			betAmountLabel: soc('SUPER ANTE BET', 'SUPER ANTE MODE'),
			tickerIdle: soc('SUPER ANTE BET IS ACTIVE', 'SUPER ANTE MODE IS ACTIVE'),
			tickerSpin: 'SUPER OR EPIC ONLY',
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
			description: `${spins.bonus} free spins. Multiplier tiles persist for the whole round, doubling up to 64x.`,
			dialog: soc(`Buy ${spins.bonus} free spins with tiles that persist all round.`, `Play ${spins.bonus} free spins with tiles that persist all round.`),
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
			description: `${spins.super} free spins on the 128x tile ladder. The roar clears the low symbols and a Super Sting is possible.`,
			dialog: soc(`Buy ${spins.super} Super Free Spins.`, `Play ${spins.super} Super Free Spins.`),
			button: soc('BUY', 'PLAY'),
			betAmountLabel: 'SUPER FREE SPINS',
			tickerIdle: '',
			tickerSpin: '',
		},
	},
	EPIC: {
		mode: 'EPIC',
		costMultiplier: modeCost('EPIC'),
		type: 'buy',
		parent: '',
		children: '',
		maxWin: config.maxWin,
		assets: placeholderAssets,
		text: {
			title: 'EPIC FREE SPINS',
			description: soc(
				`${spins.epic} free spins on the 128x ladder, Super Stings are common, and every Epic returns at least ${config.epicMinWin}x the bet.`,
				`${spins.epic} free spins on the 128x ladder, Super Stings are common, and every Epic returns at least ${config.epicMinWin}x the play amount.`,
			),
			dialog: soc(`Buy ${spins.epic} Epic Free Spins.`, `Play ${spins.epic} Epic Free Spins.`),
			button: soc('BUY', 'PLAY'),
			betAmountLabel: 'EPIC FREE SPINS',
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
			title: 'MYSTERY',
			description: soc(
				`${config.mystery.nothing * 100}% nothing at all, ${config.mystery.super * 100}% Super Free Spins, ${config.mystery.epic * 100}% Epic Free Spins. A Mystery Epic always pays at least ${config.mysteryEpicMinWin}x the bet.`,
				`${config.mystery.nothing * 100}% nothing at all, ${config.mystery.super * 100}% Super Free Spins, ${config.mystery.epic * 100}% Epic Free Spins. A Mystery Epic always wins at least ${config.mysteryEpicMinWin}x the play amount.`,
			),
			dialog: soc(
				`Buy a Mystery: ${config.mystery.super * 100}% Super Free Spins, ${config.mystery.epic * 100}% Epic Free Spins, ${config.mystery.nothing * 100}% nothing. Never a regular Free Spins round.`,
				`Play a Mystery: ${config.mystery.super * 100}% Super Free Spins, ${config.mystery.epic * 100}% Epic Free Spins, ${config.mystery.nothing * 100}% nothing. Never a regular Free Spins round.`,
			),
			button: soc('BUY', 'PLAY'),
			betAmountLabel: 'MYSTERY',
			tickerIdle: '',
			tickerSpin: '',
		},
	},
};
