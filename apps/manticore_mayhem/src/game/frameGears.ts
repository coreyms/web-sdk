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

type Listener = (links: number) => void;
const listeners = new Set<Listener>();

/** the haul's travel in links since the page loaded (never wrapped), and the wrapped value it was built from */
export const frameGears = { links: 0, last: NaN };

/** BoardFrame: the haul's offset as drawn this tick (links, modulo 2). The step between two ticks is under a link at
 *  every turbo level, so the shorter way round the modulus is the way it went. */
export const frameGearsAt = (offset: number) => {
	if (offset === frameGears.last) return;
	if (!Number.isNaN(frameGears.last)) {
		let d = offset - frameGears.last;
		if (d > 1) d -= 2;
		else if (d < -1) d += 2;
		frameGears.links += d;
	}
	frameGears.last = offset;
	for (const fn of listeners) fn(frameGears.links);
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
