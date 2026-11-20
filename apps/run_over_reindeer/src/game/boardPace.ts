// THE BOARD'S PACE FOR THE SPIN KEY'S RING (ui/hud/spinRing.ts, concept G2 "Lane Ring", approved 2026-11-20). The ring
// winds up at the press, turns while a spin plays and brakes so it comes to rest as the board does; the one thing it
// needs from the road is when that is. components/Board.svelte fills these in once its RoadBoard is up; until then (and
// in a test without a board) they say "no spin live" and the ring stays at rest.
export const boardPace = {
	/** a spin is live on the road: from the pull away (the press, or a later free spin) until the board driving in is at
	 *  rest on its marks */
	live: (): boolean => false,
	/** real ms until the board driving in is at rest (its last lane's settle done); null until the book's board has been
	 *  planned, and once it is home */
	restIn: (): number | null => null,
};
