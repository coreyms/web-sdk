// Service Bell (symbol id GL — the math contract still calls it the strike symbol / glowingLeaf
// trigger; only the art and the copy changed on 2026-09-10). Free games only: every bell that
// lands rings for one more course. The ring plays IN PLACE on the board (ReelSymbol.svelte reads
// stateGame.pendingStrikePos) or on the hero bell of an opening bite (Mantis.svelte); the tray
// with the meal then drops in at the board centre and the strike/eat flight starts from there.
//
// Frames come from Corey's five-frame press strip (tools/make_placeholders.py appends them to the
// symbol sheet as GL_ring_2..5): frame 1 = resting bell, 2-4 = the plunger going down, 5 = the
// plunger coming back up. One forward pass is the whole press (Corey 2026-09-10: playing it
// back up again read as a double press); the bell then rests on frame 1 for the remaining slots.
export const BELL_FRAMES = ['GL.png', 'GL_ring_2.png', 'GL_ring_3.png', 'GL_ring_4.png', 'GL_ring_5.png'] as const;
const RING_SEQUENCE = [0, 1, 2, 3, 4, 0, 0, 0, 0];

// Extra motion picked from the review artifact (Corey 2026-09-10): a 2% squash that follows the
// plunger depth, and a half-degree wobble that decays over 130 ms once the press has started.
// Both pivot at the bell's base (sprites anchored bottom-centre), so the dome rocks on its foot.
export const BELL_MOTION = { squash: 0.02, wobbleRad: (0.5 * Math.PI) / 180, wobbleMs: 130 };

/** frame + pose for ring progress p in [0, 1) over a ring of ringMs; p = 0 is the resting bell */
export const bellPose = (p: number, ringMs: number) => {
	const slot = ringMs / RING_SEQUENCE.length;
	const i = Math.min(RING_SEQUENCE.length - 1, Math.max(0, Math.floor(p * RING_SEQUENCE.length)));
	const depth = RING_SEQUENCE[i] / (BELL_FRAMES.length - 1);
	const tw = p * ringMs - slot; // wobble starts as the plunger leaves frame 1
	const k = tw / BELL_MOTION.wobbleMs;
	const rotation = tw > 0 && k < 1 ? Math.sin(k * Math.PI * 4) * BELL_MOTION.wobbleRad * (1 - k) : 0;
	return {
		key: BELL_FRAMES[RING_SEQUENCE[i]],
		scaleX: 1 + BELL_MOTION.squash * depth,
		scaleY: 1 - BELL_MOTION.squash * depth,
		rotation,
	};
};
