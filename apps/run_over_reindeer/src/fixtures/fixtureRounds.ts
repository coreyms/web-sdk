// THE LOCAL FIXTURE ROUNDS (dev only): a small set of HAND-WRITTEN books in the shape of the event contract
// (math-sdk/games/run_over_reindeer/EVENT_SCHEMA.md, the 2026-11-09 draft): reveal, winInfo, setTotalWin,
// finalWin. Plain spins, line wins from the spec's paytable, and no-win spins.
//
// These are NOT simulated: every board, win and amount below was written by hand, and tools/check_fixtures.mjs
// re-reads each one against game/config.ts (paylines and paytable) so a typo cannot ship a round whose picture
// and payout disagree. No feature events here: the reindeer strikes, the Wilds' multipliers and the bonus
// rounds wait for the event contract.
//
// Amounts are integer cents of the bet (100 = 1.0x). Cells are reel * 4 + row, row 0 = the top lane. A win's
// `multiplier` is the sum of the Wild multipliers on its cells and at least 1 (a plain sleigh adds nothing).
import type { SymbolName } from '../game/types';
import type { BookEvent } from '../game/typesBookEvent';

export type FixtureRound = {
	name: string;
	note: string;
	/** the round's payout in bet multiples (what a real RGS sends as round.payoutMultiplier) */
	payoutMultiplier: number;
	events: BookEvent[];
};

/** a board written the way it is seen: four lanes top to bottom, five symbols left to right. Returns board[reel][row]. */
const lanes = (...rows: [string, string, string, string]): SymbolName[][] => {
	const grid = rows.map((row) => row.trim().split(/\s+/) as SymbolName[]);
	return Array.from({ length: 5 }, (_, reel) => grid.map((row) => row[reel]));
};

export const FIXTURE_ROUNDS: FixtureRound[] = [
	{
		name: 'noWin',
		note: 'a plain spin, nothing lines up',
		payoutMultiplier: 0,
		events: [
			{ index: 0, type: 'reveal', gameType: 'basegame', board: lanes('L5 H4 L2 H3 L1', 'H2 L3 L4 L1 H4', 'L4 H1 L5 H2 L3', 'H3 L1 S  L3 L2') },
			{ index: 1, type: 'finalWin', amount: 0 },
		],
	},
	{
		name: 'threeTens',
		note: 'three 10 signs along the top lane (line 1): 0.1x',
		payoutMultiplier: 0.1,
		events: [
			{ index: 0, type: 'reveal', gameType: 'basegame', board: lanes('L5 L5 L5 H3 L1', 'H2 L3 L4 L1 H4', 'L4 H1 H2 L2 L3', 'H3 L1 S  L3 L2') },
			{ index: 1, type: 'winInfo', totalWin: 10, wins: [{ symbol: 'L5', kind: 3, line: 1, win: 10, multiplier: 1, cells: [0, 4, 8] }] },
			{ index: 2, type: 'setTotalWin', amount: 10 },
			{ index: 3, type: 'finalWin', amount: 10 },
		],
	},
	{
		name: 'noWinScatters',
		note: 'a plain spin with two presents and a sleigh in view, nothing lines up',
		payoutMultiplier: 0,
		events: [
			{ index: 0, type: 'reveal', gameType: 'basegame', board: lanes('H1 L2 S  L4 H3', 'L3 H4 L1 H2 L5', 'L5 L1 H3 W  L2', 'H2 L4 L3 S  H4') },
			{ index: 1, type: 'finalWin', amount: 0 },
		],
	},
	{
		name: 'fourWagons',
		note: 'four station wagons along the second lane (line 2): 2.5x',
		payoutMultiplier: 2.5,
		events: [
			{ index: 0, type: 'reveal', gameType: 'basegame', board: lanes('L5 H4 L2 H3 L1', 'H2 H2 H2 H2 L4', 'L4 H1 L5 L1 L3', 'H3 L1 S  L3 L2') },
			{ index: 1, type: 'winInfo', totalWin: 250, wins: [{ symbol: 'H2', kind: 4, line: 2, win: 250, multiplier: 1, cells: [1, 5, 9, 13] }] },
			{ index: 2, type: 'setTotalWin', amount: 250 },
			{ index: 3, type: 'finalWin', amount: 250 },
		],
	},
	{
		name: 'twoLines',
		note: 'two lines at once: three A signs on the V (line 5, 0.3x) and three police cars along the bottom lane (line 4, 0.5x)',
		payoutMultiplier: 0.8,
		events: [
			{ index: 0, type: 'reveal', gameType: 'basegame', board: lanes('L1 H3 L2 H2 L5', 'H2 L1 L4 L3 H3', 'L4 H1 L1 H2 L3', 'H4 H4 H4 L3 L2') },
			{
				index: 1,
				type: 'winInfo',
				totalWin: 80,
				wins: [
					{ symbol: 'H4', kind: 3, line: 4, win: 50, multiplier: 1, cells: [3, 7, 11] },
					{ symbol: 'L1', kind: 3, line: 5, win: 30, multiplier: 1, cells: [0, 5, 10] },
				],
			},
			{ index: 2, type: 'setTotalWin', amount: 80 },
			{ index: 3, type: 'finalWin', amount: 80 },
		],
	},
	{
		name: 'wildLine',
		note: "Santa's sleigh (a plain Wild, no multiplier) completes four OH-KAY vans along the third lane (line 3): 2x",
		payoutMultiplier: 2,
		events: [
			{ index: 0, type: 'reveal', gameType: 'basegame', board: lanes('L5 H4 L2 H2 L1', 'H2 L3 H1 L1 H4', 'H3 W  H3 H3 L3', 'L4 L1 S  L5 L2') },
			{ index: 1, type: 'winInfo', totalWin: 200, wins: [{ symbol: 'H3', kind: 4, line: 3, win: 200, multiplier: 1, cells: [2, 6, 10, 14] }] },
			{ index: 2, type: 'setTotalWin', amount: 200 },
			{ index: 3, type: 'finalWin', amount: 200 },
		],
	},
	{
		name: 'zigzagQueens',
		note: 'five Q signs on the zigzag (line 19): 1.5x',
		payoutMultiplier: 1.5,
		events: [
			{ index: 0, type: 'reveal', gameType: 'basegame', board: lanes('L3 H4 L3 H2 L3', 'H2 L3 L4 L3 H4', 'L4 H1 L5 L1 L2', 'H3 L1 S  L5 L2') },
			{ index: 1, type: 'winInfo', totalWin: 150, wins: [{ symbol: 'L3', kind: 5, line: 19, win: 150, multiplier: 1, cells: [0, 5, 8, 13, 16] }] },
			{ index: 2, type: 'setTotalWin', amount: 150 },
			{ index: 3, type: 'finalWin', amount: 150 },
		],
	},
	{
		name: 'fiveGrandmas',
		note: "five of Grandma's car along the bottom lane (line 4): 25x, the top line pay",
		payoutMultiplier: 25,
		events: [
			{ index: 0, type: 'reveal', gameType: 'basegame', board: lanes('L5 H4 L2 H3 L1', 'H2 L3 L4 L1 H4', 'L4 L2 L5 H2 L3', 'H1 H1 H1 H1 H1') },
			{ index: 1, type: 'winInfo', totalWin: 2500, wins: [{ symbol: 'H1', kind: 5, line: 4, win: 2500, multiplier: 1, cells: [3, 7, 11, 15, 19] }] },
			{ index: 2, type: 'setTotalWin', amount: 2500 },
			{ index: 3, type: 'finalWin', amount: 2500 },
		],
	},
];

/** the order the rounds come in when nothing is forced: mostly plain spins and small wins, the 25x last */
export const FIXTURE_ORDER = ['noWin', 'threeTens', 'noWinScatters', 'fourWagons', 'noWin', 'twoLines', 'wildLine', 'noWinScatters', 'zigzagQueens', 'fiveGrandmas'];
