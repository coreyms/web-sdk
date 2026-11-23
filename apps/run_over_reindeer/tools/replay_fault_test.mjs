// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/game/{replayFault.ts,replayGuard.ts}; replayFault, guardReplay
// THE REPLAY FAULT TEST (2026-11-23): node only, no browser. The app's rule for what /bet/replay must hold before the
// replay card may open (src/game/replayFault.ts), over what a server can answer:
//   node --experimental-strip-types --no-warnings tools/replay_fault_test.mjs            (from apps/run_over_reindeer)
//   - the RGS's refusals as bodies (a 400's ERR_VAL "invalid bet mode", a missing round): 'error'
//   - nothing, an empty body, no state, an empty state, a state that is not book events: 'no round'
//   - a real book for a mode the game does not know: 'mode'
//   - every showcase book the game's fixtures hold (src/fixtures/showcaseBooks.ts), as a replay answer: playable (null)
// Pass: every line PASS, "0 fail" and exit 0.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const { replayFault } = await import(pathToFileURL(join(APP, 'src', 'game', 'replayFault.ts')).href);
const { SHOWCASE_ROUNDS } = await import(pathToFileURL(join(APP, 'src', 'fixtures', 'showcaseBooks.ts')).href);

let pass = 0;
let fail = 0;
const check = (ok, what, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail).slice(0, 300) : ''}`);
};
const book = SHOWCASE_ROUNDS[0];
const good = { payoutMultiplier: book.payoutMultiplier, costMultiplier: 1, state: book.events };
const CASES = [
	['the RGS refuses the mode (400, ERR_VAL, as stored by the shared Authenticate)', { error: 'ERR_VAL', message: 'invalid bet mode', event: '0', active: true, mode: 'NOPE' }, true, 'error'],
	['the RGS has no such round', { error: 'ERR_BNF', message: 'bet not found', event: '0', active: true, mode: 'BASE' }, true, 'error'],
	['an error beside a book', { ...good, error: 'ERR_GEN' }, true, 'error'],
	['nothing', null, true, 'no round'],
	['not an object', 'ok', true, 'no round'],
	['an empty body', { event: '0', active: true, mode: 'BASE' }, true, 'no round'],
	['an empty state', { state: [], payoutMultiplier: 0 }, true, 'no round'],
	['a state that is not a list', { state: 'none' }, true, 'no round'],
	['a state that is not book events', { state: [1, 2, 3] }, true, 'no round'],
	['a state with an event that has no type', { state: [...book.events.slice(0, 1), {}] }, true, 'no round'],
	['a real book for a mode the game does not know', good, false, 'mode'],
	['a real book, error: null beside it', { ...good, error: null }, true, null],
];
for (const [what, round, modeKnown, want] of CASES) {
	const got = replayFault(round, modeKnown);
	check(got === want, `${what}: ${want === null ? 'playable' : `'${want}'`}`, { got });
}
// (a showcase key that points at another key's book holds no events of its own)
const BOOKS = SHOWCASE_ROUNDS.filter((r) => r.events);
const bad = BOOKS.filter((r) => replayFault({ payoutMultiplier: r.payoutMultiplier, state: r.events, event: '0', active: true, mode: r.mode }, true) !== null).map((r) => r.name);
check(BOOKS.length > 0 && bad.length === 0, `every showcase book (${BOOKS.length}) is a playable replay answer`, bad);
console.log(`replay_fault_test: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
