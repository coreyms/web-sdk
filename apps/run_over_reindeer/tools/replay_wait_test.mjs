// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/game/{replayWait.ts,replayLoad.svelte.ts}; replayStall, replayPct, REPLAY_LOAD
// THE REPLAY WAIT TEST (2026-11-26): node only, no browser. The pure rules START REPLAY's wait runs each poll
// (src/game/replayWait.ts) with the game's own numbers (src/game/constants.ts REPLAY_LOAD):
//   node --experimental-strip-types --no-warnings tools/replay_wait_test.mjs            (from apps/run_over_reindeer)
//   - the stall: a given-up file at once; no file landing for stallMs; preGameMs after the press; never earlier
//   - the percent: the preload's own progress, never past 99, never NaN
//   - the card's START waits on the game drawn only: no audio, no cap (read from the sources)
// Pass: every line PASS, "0 fail" and exit 0.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const { replayStall, replayPct } = await import(pathToFileURL(join(APP, 'src', 'game', 'replayWait.ts')).href);

// the numbers, read from constants.ts (importing it pulls in the whole game)
const src = readFileSync(join(APP, 'src', 'game', 'constants.ts'), 'utf8');
const m = /export const REPLAY_LOAD = \{ stallMs: ([\d_]+), preGameMs: ([\d_]+) \}/.exec(src);
if (!m) {
	console.log('FAIL REPLAY_LOAD not found in constants.ts');
	process.exit(1);
}
const [stallMs, preGameMs] = m.slice(1).map((v) => Number(v.replace(/_/g, '')));
const N = { stallMs, preGameMs };

let pass = 0;
let fail = 0;
const check = (ok, what, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail) : ''}`);
};

check(stallMs === 30000 && preGameMs === 90000, 'REPLAY_LOAD is 30 s stall, 90 s before the game', N);

// stall
const st = (now, lastMoveAt, failed = 0, pressedAt = 0) => replayStall({ now, pressedAt, lastMoveAt, failed }, N);
check(st(100, 0, 1) === 'failed', 'a given-up file reads failed at once');
check(st(stallMs - 1, 0) === '', 'no stall one ms before stallMs');
check(st(stallMs, 0) === 'held', 'held at stallMs with no file landing');
check(st(stallMs + 5000, 6000) === '', 'a file landing restarts the stall clock');
check(st(preGameMs, preGameMs - 100) === 'held', 'held preGameMs after the press even while files land');
check(st(preGameMs - 1, preGameMs - 100) === '', 'not held one ms before preGameMs while files land');

// percent
check(replayPct(0) === 0, 'nothing in reads 0');
check(replayPct(0.5) === 50, 'half the preload reads 50');
check(replayPct(1) === 99, 'everything in reads 99 at most (the sign is gone then)');
check(replayPct(NaN) === 0, 'NaN progress reads 0');
check(replayPct(2) === 99 && replayPct(-1) === 0, 'out of range progress is clamped');

// START waits on the game drawn only (main never waited for the audio before a replay round)
const load = readFileSync(join(APP, 'src', 'game', 'replayLoad.svelte.ts'), 'utf8');
const card = readFileSync(join(APP, 'src', 'ui', 'ReplayModal.svelte'), 'utf8');
const game = readFileSync(join(APP, 'src', 'components', 'Game.svelte'), 'utf8');
check(!/sound|isReady|capMs/.test(load.replace(/\/\/.*$/gm, '')), 'the wait reads no audio and no cap');
check(/awaitReplayNeeds\(\s*\(\) => !context\.stateLayout\.showLoadingScreen,\s*\(\) => context\.stateApp,\s*\)/.test(card), 'START waits on the loading screen gone and the start-up art only');
check(/replayGameDrawn\(\)/.test(game), 'the game drawn wakes a waiting START at once (components/Game.svelte)');

console.log(`${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
