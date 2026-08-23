// Mirrors math-sdk/games/angry_mantis/game_config.py. Keep in sync.
export default {
	providerName: 'polymath_games',
	gameName: 'Angry Mantis',
	gameID: 'angry_mantis',
	rtp: 0.96,
	numReels: 5,
	numRows: [4, 4, 4, 4, 4],
	maxWin: 20000,
	betModes: {
		base: { cost: 1.0, feature: true, buyBonus: false, rtp: 0.96, max_win: 20000 },
		ante: { cost: 2.0, feature: true, buyBonus: false, rtp: 0.96, max_win: 20000 },
		bonus: { cost: 100.0, feature: false, buyBonus: true, rtp: 0.96, max_win: 20000 },
		super: { cost: 300.0, feature: false, buyBonus: true, rtp: 0.96, max_win: 20000 },
		feast: { cost: 2000.0, feature: false, buyBonus: true, rtp: 0.96, max_win: 20000 },
	},
	symbols: {
		H1: { paytable: [{ '5': 10 }, { '4': 2.5 }, { '3': 0.8 }] },
		M1: { paytable: [{ '5': 2.5 }, { '4': 1.0 }, { '3': 0.3 }] },
		M2: { paytable: [{ '5': 2.0 }, { '4': 0.8 }, { '3': 0.3 }] },
		M3: { paytable: [{ '5': 1.5 }, { '4': 0.6 }, { '3': 0.2 }] },
		L1: { paytable: [{ '5': 0.8 }, { '4': 0.3 }, { '3': 0.1 }] },
		L2: { paytable: [{ '5': 0.6 }, { '4': 0.2 }, { '3': 0.1 }] },
		L3: { paytable: [{ '5': 0.5 }, { '4': 0.2 }, { '3': 0.1 }] },
		L4: { paytable: [{ '5': 0.4 }, { '4': 0.1 }, { '3': 0.1 }] },
		W: { paytable: null, special_properties: ['wild'] },
		S: { paytable: null, special_properties: ['scatter'] },
		GL: { paytable: null, special_properties: ['strike'] },
	},
	// Eating order (lowest 5-of-a-kind payout first) — must match EAT_ORDER in game_config.py
	eatOrder: ['L4', 'L3', 'L2', 'L1', 'M3', 'M2', 'M1', 'H1'],
	freeSpins: { free: 8, super: 10, feast: 10, maxRetrigger: 3 },
	paddingReels: {
		basegame: '',
		freegame: '',
	},
} as const;
