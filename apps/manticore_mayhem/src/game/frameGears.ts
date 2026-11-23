// THE FRAME'S WHEELS AS A SIGNAL, AND THE RING THEY SHARE WITH THE PLAY GEAR (gear bar, 2026-11-22).
// Corey: "When this gets wired into the game, we'll need to make sure those gears spin whenever the board gear spins
// (like on refilling symbols or nudges)." and "put a light ring around the button with different colors for win,
// Bonus, Super, Epic ... match that up with the smaller gears on both sides of the board with their rings."
//
// TURNING. components/BoardFrame.svelte owns the haul (every press, every free spin's reveal, the War Standard's nudges
// and runs) and picks the wheels' frame from it. Each tick the haul moved it reports the travel here, unwrapped (the
// haul itself is kept modulo one tile), and the HTML gears (ui/gear/GearBar.svelte) are called in that same tick, so
// the drawn gears and the frame's loops turn in the same frame from the same number. Nothing here allocates.
//
// THE RING. ui/gear/GearPlay.svelte says what the Play hub's ring shows (a feature's color while its free spins play,
// a pulse as a win lands); BoardFrame draws the same color at the same strength on each wheel's own brass ring.
// Plain numbers, read once a tick: no store, no effect.

/** the frame's top wheel as measured in the art (Desktop mock desktop_r6_2026-11-22 gears/wheel.json, gearmeasure.py):
 *  render px of the board art (BOARD_ART; the full tier's loop texture is 1 px per render px). The loop turns
 *  `teethPerLink` teeth per haul link, clockwise. `ringR` is the brass ring inside its rim, `ringW` that ring's width. */
export const FRAME_WHEEL = {
	teeth: 16,
	teethPerLink: 2,
	/** the wheel's center, render px: the right wheel and its mirror */
	center: { R: [1907.5, 305], L: [141.5, 305] } as Record<'L' | 'R', readonly [number, number]>,
	tipR: 92.25,
	rootR: 74,
	ringR: 65,
	ringW: 4,
} as const;

/** THE FRAME'S PINION (2026-11-24): the small gear on the top rail just inside each wheel (the relight parts pinion_L,
 *  pinion_R: eight paddle teeth round a brass ring). Corey, of the rings on the two wheels: "The outer gears got the
 *  matching ring light ups, and that looks great. Was there a reason it didn't get applied to the smaller inner gears?"
 *  There was none: his first ask named "the smaller gears on both sides of the board with their rings", and it was read
 *  as the wheels alone. Measured in the shipped loops (board-gears-landscape, the mean of each loop's 20 frames): the
 *  pinion's own brass ring is `ringR` px from its center in a loop cell `cell` px wide and tall, the center at `at` in
 *  that cell (the left one is the right one's mirror). Each layout draws the cell in its own box (game/boardArtSpec.ts
 *  relight.layouts.<kind>.gears.pinion_<side>.box, render px), so the center and the radius are taken through that box.
 *  The pinion turns in place, so its ring stands still on it like the wheel's. `texR`: the small ring art's middle line
 *  (static/assets/ui/gear-ring-small.png, tools/build_gear_ring.py). */
export const FRAME_PINION = {
	cell: { R: [124, 142], L: [125, 142] } as Record<'L' | 'R', readonly [number, number]>,
	at: { R: [69.5, 70], L: [54, 70] } as Record<'L' | 'R', readonly [number, number]>,
	ringR: 27,
	ringW: 3,
	texR: 90,
} as const;
/** the pinion's ring in a layout: its center and radius in render px, from that layout's own box for the loop */
export const pinionRing = (side: 'L' | 'R', box: readonly number[]) => {
	const k = box[2] / FRAME_PINION.cell[side][0];
	return { x: box[0] + FRAME_PINION.at[side][0] * k, y: box[1] + (FRAME_PINION.at[side][1] * box[3]) / FRAME_PINION.cell[side][1], r: FRAME_PINION.ringR * k };
};
/** THE FIVE RINGS that light together: the Play hub's (HTML) and these four on the frame (canvas sprites) */
export const FRAME_RINGS = ['wheel-L', 'wheel-R', 'pinion-L', 'pinion-R'] as const;

type Listener = (links: number) => void;
const listeners = new Set<Listener>();

/** the haul's travel in links since the page loaded, never wrapped */
export const frameGears = { links: 0 };

/** BoardFrame: the chain's true travel as drawn this tick (links): its haul offset plus every whole tile it has folded
 *  off the haul's base. (2026-11-22, Decimus's first run: the travel was first rebuilt here from the offset alone, one
 *  tile at a time; a press is folded off two tiles at once, so the HTML gears turned back two links at the end of every
 *  press. BoardFrame now counts the tiles itself and nothing is guessed.)
 *
 *  THE TRAVEL CAN RUN BACK, and then the wheels really do: when the War Standard leaves (the first free spin of a
 *  feature starting, and the feature's return to the base game) components/WarBanner.svelte hide() runs the chain back
 *  2 links over 500 ms (game/banner/spec.ts BANNER.chains.backLinks, backMs: "the run back on its exit"). BoardFrame
 *  plays that run on the chain and picks the wheels' frames from it, so the frame's own wheels turn back those 2 links,
 *  and the HTML gears turn back with them: the same number, the same frames. It is not bookkeeping: when the run is
 *  done its 2 links are folded off the base like any other and the travel stays where the run left it
 *  (tools/gear_layout_test.mjs, the haul). */
export const frameGearsAt = (links: number) => {
	if (links === frameGears.links) return;
	frameGears.links = links;
	for (const fn of listeners) fn(links);
};

/** the HTML gears: called in BoardFrame's own tick whenever the wheels moved; returns the unsubscribe */
export const onFrameGears = (fn: Listener) => {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
};

/** THE RING'S COLORS (the mock's: game/constants.ts BIG_TITLE.intro.emblemGlow.color per feature; a win is the theme's
 *  gold, ui/hudTheme.ts accent) */
export const RING_COLOR = { win: 0xe8b64a, bonus: 0x46cec2, super: 0x88b6ff, epic: 0xff7c54 } as const;
export type RingKind = keyof typeof RING_COLOR;
export const RING = {
	/** a feature's ring while its free spins play: the hub ring in its color, a halo at this strength */
	steady: 0.5,
	/** a win: the halo from full to nothing over this long (the mock's end pulse) */
	pulseMs: 700,
} as const;

/** what the Play hub's ring shows now (GearPlay writes, BoardFrame reads) */
export const gearRing = { kind: null as RingKind | null, pulseAt: -1e9, pulseKind: 'win' as RingKind };

/** the ring at `now`: its color and strength 0..1 (0 = nothing drawn) */
export const ringAt = (now: number): { rgb: number; level: number; kind: RingKind | null } => {
	const u = (now - gearRing.pulseAt) / RING.pulseMs;
	const pulse = u >= 0 && u < 1 ? 1 - u : 0;
	const steady = gearRing.kind ? 1 : 0;
	if (pulse <= 0 && !steady) return { rgb: 0, level: 0, kind: null };
	const kind = gearRing.kind ?? gearRing.pulseKind;
	return { rgb: RING_COLOR[kind], level: Math.max(steady, pulse), kind };
};
