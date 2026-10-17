// Mirrors math-sdk/games/manticore_mayhem/game_config.py. Keep in sync.
// Nothing here is used to COMPUTE an outcome — the books do that. It feeds the paytable, the
// rules copy and the fallback cost multipliers (the RGS's authenticate values always win).
export default {
	// the published math set this build is approved against (library/publish_files)
	// 2026.10.13 (game_config.py MATH_VERSION, rule pass 3): no feature triggers on 7 scatters; 8 are only ever the
	// forced first board of an Epic. RTP and every rate as 2026.10.06 (swipe band roams, math-sdk 82d7496)
	// 2026.10.15 (diversity pass): the Super and Epic buys re-dealt for outcome diversity (77k / 138k effective
	// books); rules, RTP, max win odds and every disclosed rate unchanged; the other modes byte-identical
	// 2026.10.16 (math reshape, Corey 2026-10-16 16:16): 44% base hit rate, swipes and sting runs that always complete a
	// winning cluster, the free-spins rescue swipe, Free Spins 10x / Super 25x floors (freeSpinsMinWin / superMinWin)
	mathVersion: '2026.10.16',
	providerName: 'polymath_games',
	gameName: 'Manticore Mayhem',
	gameID: 'manticore_mayhem',
	rtp: 0.967,
	numReels: 8,
	numRows: [8, 8, 8, 8, 8, 8, 8, 8],
	maxWin: 10000,
	minCluster: 5,
	betModes: {
		base: { cost: 1.0, feature: true, buyBonus: false, rtp: 0.967, max_win: 10000 },
		ante: { cost: 3.0, feature: true, buyBonus: false, rtp: 0.967, max_win: 10000 },
		super_ante: { cost: 10.0, feature: true, buyBonus: false, rtp: 0.967, max_win: 10000 },
		bonus: { cost: 100.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 10000 },
		super: { cost: 250.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 10000 },
		epic: { cost: 500.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 10000 },
		mystery: { cost: 250.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 10000 },
	},
	// Cluster-size bands, in base-bet multiples (game_config.py `bands`). A cluster's pay is the
	// band value for its size, multiplied by the SUM of the multiplier tiles under it (x1 with none).
	paytableBands: [
		{ label: '5', min: 5, max: 5 },
		{ label: '6-7', min: 6, max: 7 },
		{ label: '8-9', min: 8, max: 9 },
		{ label: '10-14', min: 10, max: 14 },
		{ label: '15+', min: 15, max: 64 },
	],
	symbols: {
		H1: { name: 'Ancient Crown', tier: 'PREMIUM', paytable: [2.0, 4.0, 10.0, 25.0, 100.0] },
		M3: { name: 'Royal Chalice', tier: 'HIGH', paytable: [1.0, 2.0, 5.0, 12.0, 50.0] },
		M2: { name: 'Persian Dagger', tier: 'HIGH', paytable: [0.8, 1.6, 3.5, 8.0, 35.0] },
		M1: { name: 'Persian Helmet', tier: 'HIGH', paytable: [0.6, 1.2, 2.5, 6.0, 25.0] },
		L4: { name: 'Royal Seal', tier: 'LOW', paytable: [0.5, 0.8, 1.6, 4.0, 15.0] },
		L3: { name: 'Ancient Key', tier: 'LOW', paytable: [0.4, 0.6, 1.2, 3.0, 12.0] },
		L2: { name: 'Bull Skull', tier: 'LOW', paytable: [0.3, 0.5, 1.0, 2.5, 10.0] },
		L1: { name: 'Iron Shackle', tier: 'LOW', paytable: [0.2, 0.4, 0.8, 2.0, 8.0] },
		W: { name: 'Wild', tier: 'WILD', paytable: null },
		S: { name: 'War Standard Scatter', tier: 'SCATTER', paytable: null },
	},
	// pay order, best first (used by the paytable table and nothing else)
	payOrder: ['H1', 'M3', 'M2', 'M1', 'L4', 'L3', 'L2', 'L1'],
	lowSymbols: ['L1', 'L2', 'L3', 'L4'],
	// spins per feature tier — no retriggers (FS_SPINS)
	freeSpins: { bonus: 8, super: 10, epic: 12 },
	// multiplier-tile ladder caps per feature (TILE_CAP); base/ante/super_ante run the standard cap
	tileCap: { base: 64, bonus: 64, super: 128, epic: 128 },
	tileSeed: 2,
	// scatter counts that open each tier in the base game (6 or more is an Epic; read by nothing, a mirror)
	scatterTriggers: { 4: 'bonus', 5: 'super', 6: 'epic' },
	// SWIPE band (SWIPE_BAND_ROWS / SWIPE_BAND_STARTS, 2026-10-06): each swipe clears 3 contiguous
	// rows whose top row (0-based) is drawn uniformly from these starts, in every mode. The
	// actual rows ride on the `swipe` event; nothing here fixes them.
	swipeBandRows: 3,
	swipeBandStarts: [0, 1, 2, 3, 4, 5],
	// Mystery split, Corey's 50 / 40 / 10 (MYSTERY_SPLIT)
	mystery: { nothing: 0.5, super: 0.4, epic: 0.1 },
	// FEATURE FLOORS on the FREE SPINS total, in base-bet multiples (game_config.py BONUS_MIN_WIN, SUPER_MIN_WIN,
	// EPIC_MIN_WIN; FEATURE_MIN_WIN). The books are re-drawn to meet them (natural, bought and Mystery rounds alike);
	// the frontend only states them. The Mystery Epic's own floor (mysteryEpicMinWin) is stated nowhere
	freeSpinsMinWin: 10,
	superMinWin: 25,
	epicMinWin: 200,
	mysteryEpicMinWin: 500,
	paddingReels: {
		basegame: '',
		freegame: '',
	},
} as const;
