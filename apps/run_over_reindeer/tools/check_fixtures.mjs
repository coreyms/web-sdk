// @ts-nocheck (a plain node script; the app type check should not read it)
// Checks the fixture books (src/fixtures/showcaseBooks.ts, real books copied from the math) against what the
// FRONTEND believes: the 12 paylines and the paytable in src/game/config.ts, and the order of events the handlers
// expect. A DEV TOOL: it is not part of the game, and the game never works a win out for itself. It exists to catch
// the frontend's copy of the lines or the pays drifting from the contract.
//
// Run from the app folder:   node --experimental-strip-types tools/check_fixtures.mjs
import config from '../src/game/config.ts';
import { SHOWCASE_ROUNDS } from '../src/fixtures/showcaseBooks.ts';

const ROWS = 4;
const KIND_INDEX = { 3: 0, 4: 1, 5: 2 };
let failed = 0;
const fail = (round, message) => {
	failed += 1;
	console.error(`FAIL ${round.name}: ${message}`);
};

// contract 2026-11-10a: what the board relies on, and what is gone
const OLD_STRIKE_FIELDS = ['side', 'runRow', 'dart', 'passes'];
const OLD_COLUMN_FIELDS = ['grandmaCell', 'grandmaWalksOut', 'grandmaAdd'];
const KNOWN = ['reveal', 'strike', 'grandmaWild', 'columnWild', 'winInfo', 'setTotalWin', 'freeSpinTrigger', 'freeSpinRetrigger', 'floorTopUp', 'freeSpinEnd', 'wincap', 'finalWin'];

let books = 0;
let wins = 0;
const seen = {};
for (const round of SHOWCASE_ROUNDS) {
	if (!round.events) continue;
	books += 1;
	let total = 0;
	let free = 0;
	/** a held column's multiplier as it landed: it may never change in the round (no crossing) */
	const landed = new Map();
	/** this spin's strikes so far, for the order check (Grandma first, then Santa, each left to right) */
	let spinStrikes = [];
	round.events.forEach((event, i) => {
		seen[event.type] = (seen[event.type] ?? 0) + 1;
		if (event.index !== i) fail(round, `event ${i} has index ${event.index}`);
		if (!KNOWN.includes(event.type)) fail(round, `event ${i} is a ${event.type}, which the 2026-11-10a contract does not have`);
		if (event.type === 'reveal') spinStrikes = [];
		if (event.type === 'strike') {
			for (const f of OLD_STRIKE_FIELDS) if (f in event) fail(round, `strike ${i} still has ${f}`);
			if (event.reel !== Math.floor(event.cell / ROWS)) fail(round, `strike ${i}: reel ${event.reel} is not cell ${event.cell} // 4`);
			const key = (e) => (e.target === 'grandmaCar' ? 0 : 1) * 100 + e.cell;
			const last = spinStrikes[spinStrikes.length - 1];
			if (last && key(last) > key(event)) fail(round, `strike ${i} (${event.target} cell ${event.cell}) comes after ${last.target} cell ${last.cell}: not Grandma first, then Santa, left to right`);
			spinStrikes.push(event);
		}
		if (event.type === 'columnWild') {
			for (const f of OLD_COLUMN_FIELDS) if (f in event) fail(round, `columnWild ${i} still has ${f}`);
			if (event.grandma) {
				if (event.tier !== 'grandma') fail(round, `columnWild ${i}: a grandma object on a ${event.tier} column`);
				if (Math.floor(event.grandma.cell / ROWS) !== event.reel) fail(round, `columnWild ${i}: Grandma's cell ${event.grandma.cell} is not in reel ${event.reel}`);
				if (!event.grandma.wasWild && event.grandma.add !== 0) fail(round, `columnWild ${i}: a Grandma car adds ${event.grandma.add}`);
			}
			if (event.sticky) landed.set(event.reel, event.multiplier);
		}
		if (event.type === 'reveal') {
			for (const h of event.held ?? []) {
				if (landed.has(h.reel) && landed.get(h.reel) !== h.multiplier) fail(round, `reveal ${i}: held column ${h.reel} is ${h.multiplier}x, it landed with ${landed.get(h.reel)}x`);
				if (!landed.has(h.reel)) landed.set(h.reel, h.multiplier);
			}
		}
		if (event.type === 'reveal') {
			if (event.board.length !== 5 || event.board.some((reel) => reel.length !== ROWS)) fail(round, 'a board is not 5 reels of 4');
			for (const reel of event.board) for (const s of reel) if (!(s in config.symbols)) fail(round, `unknown symbol ${s}`);
			for (const h of event.held ?? []) if (event.board[h.reel].some((s) => s !== 'CW')) fail(round, `held column ${h.reel} is not four CW on the board`);
		} else if (event.type === 'winInfo') {
			let sum = 0;
			for (const w of event.wins) {
				wins += 1;
				const line = config.paylines[w.line - 1];
				if (!line) {
					fail(round, `line ${w.line} is not one of the ${config.paylines.length} lines`);
					continue;
				}
				const cells = line.slice(0, w.kind).map((row, reel) => reel * ROWS + row);
				if (JSON.stringify(cells) !== JSON.stringify(w.cells)) fail(round, `line ${w.line} x${w.kind}: the book's cells ${w.cells} are not the frontend's line ${cells}`);
				const pays = config.symbols[w.symbol]?.paytable;
				const want = pays ? Math.round(pays[KIND_INDEX[w.kind]] * 100 * w.multiplier) : null;
				if (want === null || Math.abs(want - w.win) > 1) fail(round, `line ${w.line}: ${w.symbol} x${w.kind} at x${w.multiplier} pays ${w.win}, the frontend's paytable says ${want}`);
				sum += w.win;
			}
			if (sum !== event.totalWin) fail(round, `winInfo totalWin ${event.totalWin} is not the sum of its wins ${sum}`);
			total += event.totalWin;
			if (round.events.slice(0, i).some((e) => e.type === 'freeSpinTrigger')) free += event.totalWin;
		} else if (event.type === 'floorTopUp') {
			if (event.featureWin + event.amount !== event.floor) fail(round, `top-up ${event.amount} does not bring ${event.featureWin} to the floor ${event.floor}`);
			total += event.amount;
			free += event.amount;
		} else if (event.type === 'setTotalWin') {
			if (event.amount !== Math.min(total, config.maxWin * 100)) fail(round, `setTotalWin ${event.amount}, running total ${total}`);
		} else if (event.type === 'freeSpinEnd') {
			if (event.amount !== Math.min(free, config.maxWin * 100)) fail(round, `freeSpinEnd ${event.amount}, the free spins' own total ${free}`);
		} else if (event.type === 'finalWin') {
			if (i !== round.events.length - 1) fail(round, 'finalWin is not the last event');
			if (event.amount !== Math.min(total, config.maxWin * 100)) fail(round, `finalWin ${event.amount}, round total ${total}`);
			if (Math.round(round.payoutMultiplier * 100) !== event.amount) fail(round, `payoutMultiplier ${round.payoutMultiplier} but finalWin is ${event.amount}`);
		} else if (event.type === 'columnWild' && !event.start) {
			const before = round.events[i - 1];
			if (before?.type !== 'strike' || before.target !== 'santaSleigh' || Math.floor(before.cell / ROWS) !== event.reel) fail(round, `columnWild at event ${i} does not follow a Santa strike in its own reel`);
		}
	});
}
if (failed) {
	console.error(`${failed} problem(s)`);
	process.exit(1);
}
console.log(`fixtures ok: ${books} real books, ${wins} line wins on the frontend's ${config.paylines.length} lines; events seen ${JSON.stringify(seen)}`);
