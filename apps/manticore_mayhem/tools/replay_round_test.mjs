// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// A REPLAY ANSWER THE GAME CAN PLAY, A PURE TEST (no browser): src/ui/replayRound.ts, which ui/ReplayModal.svelte asks
// before it opens the replay card.
//   node --experimental-strip-types --no-warnings tools/replay_round_test.mjs
// The shared fetch hands an RGS error's JSON body on as if it were the round (2026-11-24: an old link to a mode the RGS
// no longer serves got 400 {"error":"ERR_VAL","message":"invalid bet mode"}; the card opened on zeros and START REPLAY
// started nothing). Checked: every answer that is not a round with book events is refused, a real round is taken.
const { replayRoundUsable } = await import('../src/ui/replayRound.ts');

let failed = 0;
const check = (name, ok) => {
	if (!ok) failed += 1;
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
};
const round = { payoutMultiplier: 12.5, state: [{ index: 0, type: 'reveal' }, { index: 1, type: 'finalWin' }], mode: 'BASE', amount: 1000000 };
check('a round with its book events is taken', replayRoundUsable(round) && replayRoundUsable({ ...round, event: '0', active: true }));
check('the RGS\'s refusal of a mode (400 ERR_VAL, "invalid bet mode") is not a round', !replayRoundUsable({ error: 'ERR_VAL', message: 'invalid bet mode' }));
check('the same body as the shared Authenticate hands it on (event, active and mode added) is not a round', !replayRoundUsable({ error: 'ERR_VAL', message: 'invalid bet mode', event: '0', active: true, mode: 'EPIC' }));
check('an error object in place of a code, and an error beside a state, are not a round', !replayRoundUsable({ error: { statusCode: 'ERR_BNF' } }) && !replayRoundUsable({ ...round, error: 'ERR_GEN' }));
check('an answer with no state, an empty state or a state that is not a list is not a round', !replayRoundUsable({ payoutMultiplier: 0, mode: 'BASE' }) && !replayRoundUsable({ ...round, state: [] }) && !replayRoundUsable({ ...round, state: 'x' }) && !replayRoundUsable({ ...round, state: { 0: {} } }));
check('a state whose entries are not book events is not a round', !replayRoundUsable({ ...round, state: [null] }) && !replayRoundUsable({ ...round, state: [{ index: 0 }] }) && !replayRoundUsable({ ...round, state: ['reveal'] }));
check('nothing at all (no answer, a text, a number, a list) is not a round', !replayRoundUsable(null) && !replayRoundUsable(undefined) && !replayRoundUsable('') && !replayRoundUsable('ERR_VAL') && !replayRoundUsable(0) && !replayRoundUsable([]));
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
