// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/game/{replayWait.ts,replayLoad.svelte.ts}; replayStall, replayStep, replayPct, REPLAY_LOAD
// THE REPLAY WAIT TEST (2026-11-26): node only, no browser. The pure rules START REPLAY's wait runs each poll
// (src/game/replayWait.ts) with the game's own numbers (src/game/constants.ts REPLAY_LOAD):
//   node --experimental-strip-types --no-warnings tools/replay_wait_test.mjs            (from apps/run_over_reindeer)
//   - the stall: a given-up file at once; no file landing for stallMs; preGameMs after the press; never earlier
//   - the step: no start before the game is drawn, however long; at once with the audio in; capMs after the game drawn
//   - the percent: by bytes, the cap's time once drawn, never past 99, never NaN
// Pass: every line PASS, "0 fail" and exit 0.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const { replayStall, replayStep, replayPct } = await import(pathToFileURL(join(APP, 'src', 'game', 'replayWait.ts')).href);

// the numbers, read from constants.ts (importing it pulls in the whole game)
const src = readFileSync(join(APP, 'src', 'game', 'constants.ts'), 'utf8');
const m = /export const REPLAY_LOAD = \{ capMs: ([\d_]+), stallMs: ([\d_]+), preGameMs: ([\d_]+) \}/.exec(src);
if (!m) {
	console.log('FAIL REPLAY_LOAD not found in constants.ts');
	process.exit(1);
}
const [capMs, stallMs, preGameMs] = m.slice(1).map((v) => Number(v.replace(/_/g, '')));
const N = { capMs, stallMs, preGameMs };

let pass = 0;
let fail = 0;
const check = (ok, what, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail) : ''}`);
};

check(capMs === 20000 && stallMs === 30000 && preGameMs === 90000, 'REPLAY_LOAD is 20 s cap, 30 s stall, 90 s before the game', N);

// stall
const st = (now, lastMoveAt, failed = 0, pressedAt = 0) => replayStall({ now, pressedAt, lastMoveAt, failed }, N);
check(st(100, 0, 1) === 'failed', 'a given-up file reads failed at once');
check(st(stallMs - 1, 0) === '', 'no stall one ms before stallMs');
check(st(stallMs, 0) === 'held', 'held at stallMs with no file landing');
check(st(stallMs + 5000, 6000) === '', 'a file landing restarts the stall clock');
check(st(preGameMs, preGameMs - 100) === 'held', 'held preGameMs after the press even while files land');
check(st(preGameMs - 1, preGameMs - 100) === '', 'not held one ms before preGameMs while files land');

// step
const sp = (now, gameUp, drawnAt, audioIn) => replayStep({ now, gameUp, drawnAt, audioIn }, N);
check(sp(10 * preGameMs, false, 0, true) === 'wait', 'never starts before the game is drawn, audio in or not');
check(sp(5, true, 5, true) === 'start', 'starts at once with the game drawn and the audio in');
check(sp(5 + capMs - 1, true, 5, false) === 'wait', 'waits for the audio up to the cap');
check(sp(5 + capMs, true, 5, false) === 'capped', 'starts capped at capMs after the game was drawn');
check(sp(5 + capMs, true, 0, false) === 'wait', 'no cap without a drawn time');

// percent
const pc = (preload, audio, now = 0, drawnAt = 0) => replayPct({ preload, preloadBytes: 7_890_073, audio, audioBytes: 1_223_703, now, drawnAt }, N);
check(pc(0, 0) === 0, 'nothing in reads 0');
check(pc(1, 1) === 99, 'everything in reads 99 at most (the sign is gone then)');
check(pc(0.5, 0) === Math.round((100 * 0.5 * 7_890_073) / (7_890_073 + 1_223_703)), 'half the preload by bytes');
check(pc(1, 0, 1000 + capMs / 2, 1000) === Math.round((100 * 7_890_073) / (7_890_073 + 1_223_703)), 'once drawn: the larger of bytes and the cap time');
check(pc(1, 0, 1000 + capMs * 0.95, 1000) === 95, 'the cap time carries the bar on while the audio is out');
check(Number.isFinite(pc(NaN, NaN)) && pc(NaN, NaN) === 0, 'NaN progress reads 0');
check(pc(2, -1) <= 99 && pc(2, -1) >= 0, 'out of range progress is clamped');

console.log(`${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
