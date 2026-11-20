// THE BOARD'S PACE FOR THE SPIN KEY'S RING (ui/hud/spinRing.ts, concept G2 "Lane Ring", approved 2026-11-20). The ring
// winds up at the press, turns while a spin plays and brakes so it comes to rest as the board does; the one thing it
// needs from the board is when that is. game/stateGame.svelte.ts fills these in: a spin is live from the press (the
// board exit) until the reveal's drop has landed and settled, and the drop says how much of it is left.
export const boardPace = {
	/** a spin is live: from the press (or a free spin's reveal) until the revealed board's drop has landed */
	live: (): boolean => false,
	/** real ms until the revealed board's drop has landed and settled; null before the reveal starts to fall */
	restIn: (): number | null => null,
	/** THE ROUND'S OWN START (2026-11-20, the probe host: autoplay rounds that start back to back, with no gap, never let
	 *  `live` fall, so a ring started on its rising edge missed them): a count that goes up once at every spin's start (a
	 *  press's board exit, or a reveal no press led into: a free spin). The ring starts when it changes */
	serial: (): number => 0,
};
