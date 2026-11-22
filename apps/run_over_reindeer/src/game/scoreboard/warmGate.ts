// THE WARM GATE (2026-11-22, wip/ledhitch; constants LED_BOARD.warm). The LED boards' pictures (the amount's glyphs, the
// titles' masks, the art bakes, a currency sign's dots) are made the first time a program asks for them and kept. Made at the
// moment a bonus card comes up, they were one long main thread task: the Total Win card's first frame took 400 ms on a
// 390 x 844 phone at device scale 3 (1.8 s at 4x CPU slowdown), the entries' 117 to 150 ms. The scoreboard now draws a card
// it knows is coming (the book holds it) ahead of time on a scratch face, a little each frame (scoreboard.ts warmStep), so
// every picture it needs is already made when the card comes up and the card draws from the caches as it always did.
//
// THE GATE: every place a picture is made calls warmGate() first. Outside a warm draw it does nothing (one comparison). Inside
// one (warmRun) it counts the miss and, once the frame's share of time is spent, stops the draw at the next one with a private throw
// (nothing is made half: the gate is the first thing a maker does, before it touches a shared canvas or a cache). The warm
// draw is tried again on the next frame and goes on from the pictures already made. A real draw is never stopped.
// Plain arithmetic: no canvas, no DOM, nothing allocated.

/** the private throw that stops a warm draw (never escapes warmRun) */
const YIELD: { warmYield: true } = { warmYield: true };
/** performance.now() past which a warm draw stops at its next miss; Infinity outside a warm draw */
let deadline = Infinity;
/** the misses (pictures made, or about to be) of the warm draw running now */
let misses = 0;

/** the first thing every picture maker calls (see above) */
export function warmGate(): void {
	if (deadline === Infinity) return;
	misses += 1;
	// (the first picture of a try is always made: a slow device whose draw of what is already made takes the whole budget
	// still gets one picture further each frame, never none)
	if (misses > 1 && performance.now() > deadline) throw YIELD;
}

export type WarmResult = { done: boolean; misses: number; error: unknown };

/** run `draw` as a warm draw with `budgetMs` of real time: done (it ran to its end) or yielded at a miss once the time was
 *  spent; `misses` counts the pictures it made or stopped at; an error of the draw itself is caught and returned (the
 *  caller drops the warm: a real draw then makes everything as it always did) */
export function warmRun(budgetMs: number, draw: () => void): WarmResult {
	deadline = performance.now() + Math.max(0, budgetMs);
	misses = 0;
	try {
		draw();
		return { done: true, misses, error: null };
	} catch (e) {
		if (e === YIELD) return { done: false, misses, error: null };
		return { done: false, misses, error: e };
	} finally {
		deadline = Infinity;
	}
}
