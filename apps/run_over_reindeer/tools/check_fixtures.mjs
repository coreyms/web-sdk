// Checks the hand-written fixture rounds (src/fixtures/fixtureRounds.ts) against the game's own tables
// (src/game/config.ts: the 20 paylines and the paytable), so a typo cannot leave a round whose picture and payout
// disagree. A DEV TOOL: it is not part of the game, and the game never works a win out for itself.
//
// Run from the app folder:   node --experimental-strip-types tools/check_fixtures.mjs
//
// For every round it works out the line wins of each revealed board (left to right from the first reel, the
// sleigh W standing in for any paying symbol, a line of only Wilds paying as the top symbol) and compares them
// with the round's winInfo, its setTotalWin, its finalWin and its payoutMultiplier.
import config from '../src/game/config.ts';
import { FIXTURE_ORDER, FIXTURE_ROUNDS } from '../src/fixtures/fixtureRounds.ts';

const ROWS = 4;
const WILDS = new Set(['W', 'GW', 'CW']);
const KIND_INDEX = { 3: 0, 4: 1, 5: 2 };

const lineWins = (board) => {
	const wins = [];
	config.paylines.forEach((rows, i) => {
		const symbols = rows.map((row, reel) => board[reel][row]);
		const first = symbols.find((s) => !WILDS.has(s));
		const target = first ?? 'W';
		if (target === 'S') return;
		let n = 0;
		while (n < symbols.length && (symbols[n] === target || WILDS.has(symbols[n]))) n += 1;
		if (n < 3) return;
		const pays = config.symbols[target]?.paytable;
		if (!pays) return;
		wins.push({ symbol: target, kind: n, line: i + 1, win: Math.round(pays[KIND_INDEX[n]] * 100), cells: rows.slice(0, n).map((row, reel) => reel * ROWS + row) });
	});
	return wins;
};

const key = (w) => `${w.line}:${w.symbol}x${w.kind}=${w.win}@${[...w.cells].sort((a, b) => a - b).join(',')}`;
let failed = 0;
const fail = (round, message) => {
	failed += 1;
	console.error(`FAIL ${round.name}: ${message}`);
};

for (const round of FIXTURE_ROUNDS) {
	let total = 0;
	let board = null;
	let shown = null;
	round.events.forEach((event, i) => {
		if (event.index !== i) fail(round, `event ${i} has index ${event.index}`);
		if (event.type === 'reveal') {
			if (board && !shown && lineWins(board).length) fail(round, 'a winning board has no winInfo');
			board = event.board;
			shown = null;
			if (board.length !== 5 || board.some((reel) => reel.length !== ROWS)) fail(round, 'the board is not 5 reels of 4');
			for (const reel of board) for (const s of reel) if (!(s in config.symbols)) fail(round, `unknown symbol ${s}`);
			for (const reel of board) if (reel.filter((s) => s === 'S').length > 1) fail(round, 'two scatters on one reel');
		} else if (event.type === 'winInfo') {
			shown = event;
			const want = lineWins(board).map(key).sort();
			const got = event.wins.map(key).sort();
			if (JSON.stringify(want) !== JSON.stringify(got)) fail(round, `winInfo does not match the board\n  board says ${want.join(' | ') || 'no win'}\n  book says  ${got.join(' | ')}`);
			// no multiplier Wild exists in these rounds (a plain sleigh adds nothing), so every line's multiplier is 1
			for (const w of event.wins) if (w.multiplier !== 1) fail(round, `line ${w.line} has multiplier ${w.multiplier}, expected 1`);
			const sum = event.wins.reduce((n, w) => n + w.win, 0);
			if (sum !== event.totalWin) fail(round, `winInfo totalWin ${event.totalWin} is not the sum of its wins ${sum}`);
			total += event.totalWin;
		} else if (event.type === 'setTotalWin') {
			if (event.amount !== total) fail(round, `setTotalWin ${event.amount}, running total ${total}`);
		} else if (event.type === 'finalWin') {
			if (i !== round.events.length - 1) fail(round, 'finalWin is not the last event');
			if (event.amount !== total) fail(round, `finalWin ${event.amount}, round total ${total}`);
		}
	});
	if (board && !shown && lineWins(board).length) fail(round, `the board wins (${lineWins(board).map(key).join(' | ')}) but the book has no winInfo`);
	if (Math.round(round.payoutMultiplier * 100) !== total) fail(round, `payoutMultiplier ${round.payoutMultiplier} but the events total ${total / 100}x`);
	if (round.events.at(-1)?.type !== 'finalWin') fail(round, 'the book does not end with finalWin');
}
for (const name of FIXTURE_ORDER) if (!FIXTURE_ROUNDS.some((r) => r.name === name)) (failed += 1), console.error(`FAIL order: no round named ${name}`);

if (failed) {
	console.error(`${failed} problem(s)`);
	process.exit(1);
}
console.log(`fixtures ok: ${FIXTURE_ROUNDS.length} rounds, ${FIXTURE_ROUNDS.filter((r) => r.payoutMultiplier > 0).length} with a win`);
