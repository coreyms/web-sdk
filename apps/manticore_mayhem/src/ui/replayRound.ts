// A REPLAY ANSWER THE GAME CAN PLAY (2026-11-24).
// The shared Authenticate (packages/components-shared) fetches /bet/replay/<game>/<version>/<mode>/<event> before the
// game mounts and hands whatever JSON came back to stateBet.betToResume. The shared fetcher (packages/rgs-fetcher) does
// not reject an error status: it logs it and returns the body. So a refused replay (400 {"error":"ERR_VAL","message":
// "invalid bet mode"}: an old link to a mode the RGS no longer serves, a made-up mode, a book the RGS does not have)
// arrived as a "round" with no events. The replay card opened on it with zeros, START REPLAY started nothing, and the
// game sat on SKIP with WIN $0.00. Only a thrown fetch (no connection, a reply that is not JSON) reached the error card.
// The game cannot change the shared fetch, so it judges the answer itself (ui/ReplayModal.svelte): anything that is
// not a round with book events is the replay not loading, and the game's own REPLAY NOT AVAILABLE card says so.
// Pure: tools/replay_round_test.mjs.

/** a replay answer is a round the game can play: an object that is not an error and carries its book events */
export const replayRoundUsable = (body: unknown): boolean => {
	if (!body || typeof body !== 'object') return false;
	const b = body as { error?: unknown; state?: unknown };
	if (b.error) return false;
	return Array.isArray(b.state) && b.state.length > 0 && b.state.every((e) => !!e && typeof e === 'object' && typeof (e as { type?: unknown }).type === 'string');
};
