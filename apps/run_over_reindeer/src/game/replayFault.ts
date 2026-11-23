// A REPLAY LINK THE RGS DOES NOT SERVE (2026-11-23, found in the sister game: a 400 answer from /bet/replay with the
// body {"error":"ERR_VAL","message":"invalid bet mode"} opened the ROUND REPLAY card with zeros, and START REPLAY left
// the game on a round that never played). The shared fetcher hands any JSON body back whatever its status, and the
// shared Authenticate stores any body as the round to replay; only a failed fetch or a body that is not JSON reaches
// the error card there. This is the app's own rule for what a replay needs before the replay card may open. Pure
// (tools/replay_fault_test.mjs).
//   'error'     the body carries an error (the RGS's own code, shown on the card)
//   'no round'  no body, or no book in it: `state` is not a list of book events (each an object with a type)
//   'mode'      a book, but for a mode this game has no table entry for (nothing to name it or cost it by)
//   null        a round the replay card can show and play
export type ReplayFault = null | 'error' | 'no round' | 'mode';
export const replayFault = (round: unknown, modeKnown: boolean): ReplayFault => {
	if (!round || typeof round !== 'object') return 'no round';
	const r = round as Record<string, unknown>;
	if (r.error !== undefined && r.error !== null && r.error !== false) return 'error';
	const state = r.state;
	if (!Array.isArray(state) || state.length === 0) return 'no round';
	if (!state.every((e) => !!e && typeof e === 'object' && typeof (e as { type?: unknown }).type === 'string')) return 'no round';
	return modeKnown ? null : 'mode';
};
