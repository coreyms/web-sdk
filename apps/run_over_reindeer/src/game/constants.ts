// Every tunable number of the Run Over Reindeer first pass, in one place.
//
// THE TUNING OBJECT: `TUNE` at the bottom collects the road, the spin motion and the line win numbers. The dev hook
// hands out the live object (window.__reindeer.tune), so a number changed in the browser console applies from the
// next spin, and window.__reindeer.tuneJson() prints the whole set to paste back here.
//
// Units: "road px" are pixels of the 1536 x 1024 board background (game/roadArtSpec.ts). The whole board is drawn in
// road px and scaled as one piece per layout (game/layoutSpec.ts), so nothing here changes between phone and desktop.
// Times are milliseconds at normal speed; turbo and a slam stop run the same motion on a faster clock.
import type { SymbolName } from './types';

// ---- the road and what stands on it -------------------------------------------------------------------------------
export const ROAD = {
	/** which way each lane drives, top lane first: 1 = left to right, -1 = right to left (Corey 2026-11-04) */
	laneDirection: [1, 1, -1, -1] as (1 | -1)[],
	/** a symbol's lower edge sits this many road px above its lane's lower line */
	sitAboveLine: 10,
	/** size of each symbol on top of the size the art tool built it at (1 = as built; tools/build_assets.py) */
	symbolScale: { H1: 1, H2: 1, H3: 1, H4: 1, L1: 1, L2: 1, L3: 1, L4: 1, L5: 1, W: 1, S: 1, GW: 1, CW: 1 } as Record<SymbolName, number>,
	/** THE TUNNEL SHADOW ON TRAFFIC: a symbol is tinted darker the nearer its centre is to a tunnel mouth, so it
	 *  comes out of the dark like the road under it does. Brightness runs from `dark` at `from` road px inside the
	 *  mouth (negative = still under the portal) to full at `to`. A tint, not a filter. */
	tunnelShade: { from: -110, to: 200, dark: 0.08 },
	/** the scene's flat snow color around the background picture (sampled from its corners) */
	snow: 0xe9f0fd,
	/** THE ROCK THE TUNNELS RUN INTO: left and right of the picture the scene is this dark, flat color (the hillside
	 *  over the tunnels), not snow. Traffic that has driven past the picture's edge is under it, the stone portals have
	 *  something to stand in, and on a phone held sideways it is the dark ground the house HUD's two side columns need. */
	rock: 0x15171d,
};

// ---- THE STOPLIGHTS (Corey 2026-11-09; game/road/roadBoard.ts) -----------------------------------------------------------
// Two traffic signals seen from above, hanging from the underside of the tunnel arches: one at the top right mouth
// beside the two lanes that drive right (its lenses face left, toward the traffic coming at it), one at the bottom
// left mouth beside the two lanes that drive left. Each is tucked under the stone portal, which covers its arm and
// part of its housing; the rest of the box and its three lenses stick out over the road. They draw OVER the traffic
// (it passes under them) and over the tunnel's shadow, at full brightness, and UNDER the portal strips.
//
// THE SIGNAL IS COREY'S RULING (2026-11-09, three rounds, the last one wins where they differ):
//   "It should be red when the board is idle or stopped, green after pressing spin or while a spin is starting, and
//    yellow as symbols start to decelerate."
//   "make them turn Red as soon as the symbols stop."
//   "the red should land right before the cars stop. So I think we can do green less time after the spin, transition
//    to yellow faster, and to red faster."
// So the lights LEAD the traffic like a real signal. The road knows its stop times ahead, and the signal is scheduled
// from them, per light:
//   RED    while the board is idle or stopped (after it lands and through the win), and again from `lead.red` BEFORE
//          the light's own symbols reach their stop point, so the traffic is seen braking to a red light. Never fades.
//   GREEN  from the spin press, for `greenMs`.
//   AMBER  from the end of green until the red.
// Every time here is on the ROAD'S OWN CLOCK, which runs faster at turbo, so the leads shrink with the spin and the
// order green, amber, red always holds. A slam stop turns both lights red at once (`slamRed`).
export type StoplightPlace = {
	/** the housing's height, in lanes (a lane averages 171 road px) */
	height: number;
	/** how far the housing's lens edge stands out past the tunnel mouth's line, road px (the housing is 45 wide at 1 lane) */
	protrude: number;
	/** slide it along the mouth, road px: + is toward the double yellow in the middle of the road */
	along: number;
	/** lean it, degrees: + turns the lens edge toward the middle of the road */
	tilt: number;
};
export const STOPLIGHT = {
	/** draw the two lights at all */
	show: true,
	/** THE OFF SWITCH for the signal: false leaves every lens dark */
	lit: true,
	/** WHOSE LANES A LIGHT ANSWERS TO: 'pair' = the two lanes it stands beside, 'board' = all four.
	 *  red 'pair': each light times its red off ITS two lanes' stop, so the top light is red a moment before the bottom
	 *  one (the lanes stop top to bottom). 'board' times both off the last lane.
	 *  amber: only read when amberFrom is 'brake' (whose first braking symbol starts it). */
	follow: { amber: 'board' as 'board' | 'pair', red: 'pair' as 'board' | 'pair' },
	/** RED LEADS THE STOP by this long, ms on the road's clock (300 real ms at normal speed, 176 at turbo 1, 115 at turbo
	 *  2). Corey, fourth round: "the red light still needs to come in a little earlier ... cars slow for yellow, they
	 *  don't stop for it": the traffic slows through the amber and finishes its stop under the red. Was 150.
	 *  0 = red at the instant the symbols stop (the second cut). */
	lead: { red: 300 },
	/** WHEN AMBER STARTS:
	 *    'afterGreen'  greenMs after the press (Corey: "green less time after the spin, transition to yellow faster")
	 *    'beforeRed'   amberMs before the red, however long green then is
	 *    'brake'       when the first symbols start to brake (the first cut)
	 *  It never starts before the book's traffic is on its way in (a slow connection waits on green), and never later
	 *  than minShowMs before the red. */
	amberFrom: 'afterGreen' as 'afterGreen' | 'beforeRed' | 'brake',
	/** green's length after the press ('afterGreen'), ms on the road's clock. Never more than half the way to the red. */
	greenMs: 400,
	/** amber's length before the red ('beforeRed'), ms on the road's clock */
	amberMs: 450,
	/** the least time amber shows before a red, ms on the road's clock (keeps green, amber, red in order on the shortest spin) */
	minShowMs: 60,
	/** a slam stop (a Spin press or a board tap during a live spin) turns both lights red at once */
	slamRed: true,
	/** green and amber fade in and out over this long, real ms. RED never fades: it is on, and the others off, in one
	 *  frame. */
	fadeMs: 80,
	/** the soft glow over a lit lens: a pre-rendered white blob tinted to the lens color and ADDED over the picture
	 *  (a blend mode, no filter). alpha 0 switches it off; size is its width in road px on a 1.5 lane light, and it
	 *  shrinks with the light (87 on the 1 lane light). */
	glow: { alpha: 0.55, size: 130 },
	/** where each light hangs, per layout (the same for both lights, mirrored). One lane tall since Corey's "33%
	 *  smaller" (was 1.5 lanes, protrude 46): the housing, the lenses and the glow shrink together, and the same two
	 *  thirds of the box stands out past the arch. */
	layout: {
		landscape: { height: 1, protrude: 31, along: 0, tilt: 0 } as StoplightPlace,
		phone: { height: 1, protrude: 31, along: 0, tilt: 0 } as StoplightPlace,
		portrait: { height: 1, protrude: 31, along: 0, tilt: 0 } as StoplightPlace,
	},
};

// ---- THE HUD'S DARK BEDS (components/HudBeds.svelte) -------------------------------------------------------------------
// The house HUD is white and gold ink made for a dark scene; on snow it cannot be read. Until the scene art gives
// it dark ground of its own, the canvas lays a flat dark bed under each HUD zone that would otherwise sit on snow:
//   landscape  a bar across the top (the clock strip) and one across the bottom (the readout row and the buttons)
//   portrait   the same two, the bottom one from just over the BALANCE row down
//   phone      none: the HUD's two side columns stand on the rock beside the tunnels (ROAD.rock)
// Master units; each bar runs out to the canvas edge on its open side.
export const HUD_BED = {
	color: 0x15171d,
	/** a hairline along each bed's inner edge */
	edge: 0x3b3f4a,
	edgeWidth: 2,
	/** the top bar's lower edge, under the clock strip */
	top: { landscape: 36, portrait: 34 },
	/** the bottom bar's upper edge, with no letterbox (it rides down with the HUD on a taller screen) */
	bottom: { landscape: 604, portrait: 606 },
};

// ---- the spin: traffic ----------------------------------------------------------------------------------------------
// One spin, lane by lane:
//   OUT  on the press the cars of each lane pull away toward their lane's far tunnel, front car first, and are gone.
//   IN   when the book's board is in, each lane's five symbols drive in from its near tunnel as a spread out convoy
//        at cruise speed, brake one after the other (the front car first), stop a little past their mark with the
//        nose down, and rock back onto it.
// The reels of the math are the COLUMNS; the lanes are only how the picture moves.
export type RoadMotion = {
	/** traffic speed through the board, road px per second */
	cruise: number;
	/** the order the lanes go in (lane 0 = top) */
	laneOrder: number[];
	out: {
		/** between one lane pulling away and the next */
		laneStaggerMs: number;
		/** between the cars of one lane, front car first */
		carStaggerMs: number;
		/** how hard they pull away, road px per second squared */
		accel: number;
		/** top speed on the way out, road px per second */
		maxSpeed: number;
		/** the tail dips this many degrees as a car pulls away, over squatMs */
		squatDeg: number;
		squatMs: number;
	};
	in: {
		/** the soonest the first lane's convoy starts after the press (the old traffic gets this head start) */
		delayMs: number;
		/** between one lane's convoy and the next */
		laneStaggerMs: number;
		/** between the stops of the cars of one lane, front car first (also spreads the convoy out at speed) */
		carStaggerMs: number;
		/** from cruise speed to stopped */
		brakeMs: number;
		/** a car stops this many road px past its mark, then rocks back */
		overshootPx: number;
		/** how long the rock back takes */
		settleMs: number;
		/** how many times it swings while it settles (0.75 = back past the mark once, then home) */
		settleSwings: number;
		/** nose down at the stop, degrees */
		diveDeg: number;
		/** signs, the sleigh and the present have no suspension: they take this share of the overshoot and the dive */
		stiffShare: number;
	};
	/** traffic that drives straight through a lane between the old board and the new one. perLane cars always;
	 *  with whileWaiting, more keep coming for as long as the book has not arrived (a slow connection). */
	through: { perLane: number; gapMs: number; whileWaiting: boolean };
};

const BASE_MOTION: RoadMotion = {
	cruise: 2500,
	laneOrder: [0, 1, 2, 3],
	out: { laneStaggerMs: 45, carStaggerMs: 38, accel: 13000, maxSpeed: 3400, squatDeg: 1.6, squatMs: 240 },
	in: { delayMs: 220, laneStaggerMs: 130, carStaggerMs: 72, brakeMs: 270, overshootPx: 13, settleMs: 300, settleSwings: 0.75, diveDeg: 2.6, stiffShare: 0.55 },
	through: { perLane: 0, gapMs: 170, whileWaiting: true },
};

export const ROAD_MOTION = {
	/** normal speed */
	base: BASE_MOTION,
	/** turbo level 1: the same picture on a faster clock, lanes closer together */
	turbo1: {
		rate: 1.7,
		in: { laneStaggerMs: 90, carStaggerMs: 55 },
	},
	/** turbo level 2: all four lanes at once, one short brake, hardly any rock back */
	turbo2: {
		rate: 2.6,
		out: { laneStaggerMs: 0, carStaggerMs: 15 },
		in: { delayMs: 120, laneStaggerMs: 0, carStaggerMs: 26, overshootPx: 6, settleMs: 160, diveDeg: 1.2 },
	},
	/** a slam stop (a Spin press or a board tap during a live spin) runs the rest of the spin this many times faster */
	hurryRate: 3,
	/** the fastest the board's clock ever runs, whatever is stacked */
	maxRate: 6,
};

/** the motion numbers for a turbo level: the base set with that level's overrides laid over it */
export const motionFor = (level: 0 | 1 | 2): RoadMotion & { rate: number } => {
	const b = ROAD_MOTION.base;
	const t = level === 2 ? ROAD_MOTION.turbo2 : level === 1 ? ROAD_MOTION.turbo1 : null;
	const over = (t ?? {}) as { rate?: number; out?: Partial<RoadMotion['out']>; in?: Partial<RoadMotion['in']> };
	return { ...b, out: { ...b.out, ...(over.out ?? {}) }, in: { ...b.in, ...(over.in ?? {}) }, through: { ...b.through }, rate: over.rate ?? 1 };
};

// ---- the line win -----------------------------------------------------------------------------------------------------
export const LINE_WIN = {
	/** the pause after the board settles before the win shows */
	leadInMs: 120,
	/** every winning line is shown together for this long */
	holdMs: 1300,
	/** per turbo level: the hold is this share of holdMs */
	holdShare: [1, 0.6, 0.35],
	/** winning symbols pulse up to this size and back, `pulses` times over the hold */
	pulseScale: 1.12,
	pulses: 2,
	/** the other symbols dim to this brightness while a win shows */
	dim: 0.38,
	/** the line through the winning cells: road px wide, with a dark edge this much wider each side */
	lineWidth: 9,
	lineEdge: 4,
	lineAlpha: 0.92,
	/** one color per payline, cycled (bright sign colors; the dark edge keeps them readable on the road) */
	lineColors: [0xffd400, 0x19d3da, 0xff3db1, 0xb6ff1a, 0xff8a00, 0xffffff],
	/** the amount over the board: Overpass Heavy, this cap height in road px, on the middle cell of the first winning line */
	amountSize: 86,
	amountFill: 0xffffff,
	amountStroke: 0x101216,
	amountStrokeWidth: 12,
	/** the amount pops in from this size over popMs */
	popFrom: 0.6,
	popMs: 180,
};

/** everything tunable, as one object (window.__reindeer.tune) */
export const TUNE = { road: ROAD, motion: ROAD_MOTION, lineWin: LINE_WIN, stoplight: STOPLIGHT, hudBed: HUD_BED };

// ---- the house HUD's own constants (unchanged from Manticore Mayhem) ---------------------------------------------------
/** a slam stop speeds the rest of the spin up (ui/controls.svelte.ts) */
export const SLAM_HURRY = true;

/** the autoplay button's two faces */
export const AUTOPLAY_COLOURS = { on: '#5f9149', stop: '#e32400' } as const;

/** the price line on the Spin button's face (ui/SquareSpin.svelte) */
export const SPIN_PRICE_FIT = {
	boxFrac: 0.86,
	nominal: 0.23,
	nominalLoaded: 0.19,
	nominalLoadedArmed: 0.17,
	minScale: 0.7,
	weight: 800,
	letterSpacing: -0.5,
} as const;

// ---- render resolution (game/deviceTier.ts; the house device plan, as Manticore ships it) -----------------------------
export const RENDER_RESOLUTION_CAP = { phone: 3, desktop: 2, phone3x: 3 } as const;
/** OFF (every phone at RENDER_RESOLUTION_CAP.phone); kept for the rollback, as in Manticore */
export const PHONE_2X_ALLOW = { on: false, density: 3, minShort: 390, notShort: [414] } as const;
export const PHONE_3X_ALLOW = { on: false, minShort: 420 } as const;
export const RENDER_MAX_PIXELS = 8_300_000;
export const RENDER_RESIZE = { settleMs: 250, band: 0.04 } as const;

// ---- loading ------------------------------------------------------------------------------------------------------------
/** PRESS ANYWHERE waits for the audio; if the sprite never lands it shows anyway after this long (a hung request) */
export const LOAD_GATE = { stallMs: 30_000 } as const;
