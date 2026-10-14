// A TAP ON THE BOARD: THE ONE HANDLER (2026-10-13; components/BoardTap.svelte calls it for every tap or click that
// lands on the board's opening, with the point in canvas px).
//
// It asks the creature first. On desktop and tablet the manticore stands over part of the board, but THE POKE NEVER
// TAKES A BOARD TAP (Corey 2026-10-13 14:37: "a tight body hit area that never takes a HUD or board tap"): his own hit
// area (game/creature.ts, constants CREATURE.poke.area) leaves out every point of the opening below
// (boardOpening), so creatureHitTest stays FALSE and every board tap goes on to the board: `hurry`, which broadcasts
// `boardTap`, and ui/controls.svelte.ts
// then does what a Spin press does during a live spin (its slamStop, the same function, the same jurisdiction
// switches). Speed only: nothing here or behind it reads or changes an outcome, and nothing is awaited.
export type BoardTapTarget = 'creature' | 'board';

/** does this canvas point belong to the creature? Never on the opening (his poke area leaves it out) */
export const creatureHitTest = (_canvasX: number, _canvasY: number): boolean => false;

/** THE BOARD'S OPENING, the area components/BoardTap.svelte takes taps on: is this canvas point on it?
 *  (BoardTap.svelte sets it when it mounts; the creature's poke area asks it, so a poke never takes a board tap) */
export const boardOpening = { contains: (_canvasX: number, _canvasY: number): boolean => false };

/** DEV / probe: every tap this page routed, newest last (bounded) */
export const boardTapLog: { x: number; y: number; to: BoardTapTarget; at: number }[] = [];

export const routeBoardTap = (canvasX: number, canvasY: number, hurry: () => void): BoardTapTarget => {
	const to: BoardTapTarget = creatureHitTest(canvasX, canvasY) ? 'creature' : 'board';
	if (import.meta.env.DEV) {
		boardTapLog.push({ x: canvasX, y: canvasY, to, at: performance.now() });
		if (boardTapLog.length > 50) boardTapLog.splice(0, 25);
	}
	// 'creature': the poke feature's own handler goes here; a poke never hurries the spin
	if (to === 'board') hurry();
	return to;
};
