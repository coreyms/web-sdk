// Mirrors math-sdk/games/run_over_reindeer/ror_rules.py (the first rough simulation, 2026-11-09). Keep in sync.
// Nothing here is used to COMPUTE an outcome: the books do that. It feeds the paytable page, the rules copy,
// the payline pictures and the fallback mode prices (the RGS's authenticate values always win).
//
// FIRST PASS: the math is not final. The three and four of a kind pays are the sim's proposal, the mode keys
// for the three Ante levels are this frontend's guess (the math has base, bonus and super so far).
export default {
	mathVersion: 'first-sim-2026.11.09',
	providerName: 'polymath_games',
	gameName: 'Run Over Reindeer',
	gameID: 'run_over_reindeer',
	rtp: 0.967,
	numReels: 5,
	numRows: [4, 4, 4, 4, 4],
	maxWin: 7777,
	// name: the mode's key with the RGS, lower case here, upper case on the wire (BASE, BONUS, ...)
	betModes: {
		base: { cost: 1.0, feature: true, buyBonus: false, rtp: 0.967, max_win: 7777 },
		ante_2: { cost: 2.0, feature: true, buyBonus: false, rtp: 0.967, max_win: 7777 },
		ante_4: { cost: 4.0, feature: true, buyBonus: false, rtp: 0.967, max_win: 7777 },
		ante_10: { cost: 10.0, feature: true, buyBonus: false, rtp: 0.967, max_win: 7777 },
		bonus: { cost: 100.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 7777 },
		super: { cost: 300.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 7777 },
	},
	/** the Ante card's slider stops, lowest first (ui/FeatureMenu.svelte) */
	anteModes: ['ante_2', 'ante_4', 'ante_10'],
	// Pays in multiples of the TOTAL bet, per line: [3, 4, 5 of a kind]. The order of the three lower cars is
	// still open in the spec; this is the frontend's working order (wagon, van, police).
	symbols: {
		H1: { name: "Grandma's Car", tier: 'PREMIUM', paytable: [1.5, 5.0, 25.0] },
		H2: { name: 'Station Wagon', tier: 'HIGH', paytable: [1.0, 2.5, 10.0] },
		H3: { name: 'OH-KAY Van', tier: 'HIGH', paytable: [0.75, 2.0, 7.5] },
		H4: { name: 'Police Car', tier: 'HIGH', paytable: [0.5, 1.5, 5.0] },
		L1: { name: 'A', tier: 'LOW', paytable: [0.3, 0.75, 2.5] },
		L2: { name: 'K', tier: 'LOW', paytable: [0.25, 0.6, 2.0] },
		L3: { name: 'Q', tier: 'LOW', paytable: [0.2, 0.5, 1.5] },
		L4: { name: 'J', tier: 'LOW', paytable: [0.15, 0.4, 1.25] },
		L5: { name: '10', tier: 'LOW', paytable: [0.1, 0.3, 1.0] },
		W: { name: "Santa's Sleigh Wild", tier: 'WILD', paytable: [1.5, 5.0, 25.0] },
		S: { name: 'Present Scatter', tier: 'SCATTER', paytable: null },
		// feature symbols the books can put on a board (not presented in the first pass, drawn as the sleigh Wild)
		GW: { name: 'Grandma Wild', tier: 'WILD', paytable: null },
		CW: { name: 'Column Wild', tier: 'WILD', paytable: null },
	},
	payKinds: [3, 4, 5],
	// pay order, best first (the paytable page)
	payOrder: ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'L5'],
	carSymbols: ['H1', 'H2', 'H3', 'H4'],
	// 20 fixed paylines: the row on each reel, 0 = the top lane (ror_rules.py PAYLINES)
	paylines: [
		[0, 0, 0, 0, 0], [1, 1, 1, 1, 1], [2, 2, 2, 2, 2], [3, 3, 3, 3, 3],
		[0, 1, 2, 1, 0], [3, 2, 1, 2, 3], [1, 2, 3, 2, 1], [2, 1, 0, 1, 2],
		[0, 0, 1, 0, 0], [3, 3, 2, 3, 3], [1, 0, 0, 0, 1], [2, 3, 3, 3, 2],
		[0, 1, 1, 1, 0], [3, 2, 2, 2, 3], [1, 1, 0, 1, 1], [2, 2, 3, 2, 2],
		[1, 2, 2, 2, 1], [2, 1, 1, 1, 2], [0, 1, 0, 1, 0], [3, 2, 3, 2, 3],
	],
	freeSpins: 10,
	retriggerSpins: 3,
	// floors on a round's total, in base bet multiples (ror_rules.py FLOOR_*): the books meet them, the frontend only states them
	floors: { naturalFreeSpins: 30, naturalSuper: 150, boughtSuper: 20 },
	wildCap: 100,
	paddingReels: {
		basegame: '',
		freegame: '',
	},
} as const;
