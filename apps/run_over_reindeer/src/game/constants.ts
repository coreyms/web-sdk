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

// ---- THE REINDEER STRIKE (stage 1 of the rig's run, Corey 2026-11-12; game/road/roadFeatures.ts) -------------------
// Corey 2026-11-10: "the reindeer would enter from above the board running parallel in the snow then turn downward when
// it's going to strike something. This gives us some player anticipation." Stage 1 (2026-11-12) draws it with the rig's
// rendered run views (game/road/reindeerRun.ts): it comes in at one end of the snow bank above the road running side on
// (run_R), turns with ONE frame of run_S (20 degrees toward us), runs a short diagonal in run_Q (40 degrees), ONE frame
// of run_M (60 degrees), then runs straight down in run_C (80 degrees) into the target cell: the impact. No stop and
// no hold before the turn (Corey: "No stop"). The other side is the same views mirrored.
// SINCE 2026-11-15 (Corey: "the reindeer should probably run between the traffic and take another diagonal turn at the
// very end to get to the strike point"): the turn ends over the GAP beside the target's reel, the run down in C goes
// between the traffic, and a last diagonal cut in run_Q takes him into the target (STRIKE.cut), in the same time.
// THE MIDDLE PATH (Corey 2026-11-12, against the feet sliding): a slower snow run and a faster leg cycle. The run is
// counted in POSES of the 16 pose cycle, strideFps poses a second. TIME BASED (Corey 2026-11-12: "yes" to slow screens
// skipping poses so the strike always takes the same time): the pose and the body's place both come from the road
// clock, so at 60 Hz each frame shows the next pose, at 120 Hz each pose stays up for two frames, and a 30 Hz screen,
// a dropped frame, turbo or a slam stop skip poses and keep the strike's length (turbo 1.7 and the slam's 3x shorten
// it by their rate). Never skipped: the one S pose, the one M pose and the first C pose; a frame that would jump over
// one draws it a little late instead and the next frame catches up. The
// snow run starts on pose (7 - n) mod 16, n = the POSES before the run down, so the run down always starts on pose 7 and
// lands on the right foot (the rig's delivery note), and C never shows its lone-hoof poses 3 to 6. The book says only
// which cell; the path is the game's.
export type SnowRun = {
	/** where its feet run along the snow, road px from the picture's top (the lane lines are 167 to 851) */
	feetY: number;
	/** its size in the snow, on top of the built size (the side run's tallest outline is 190 road px) */
	scale: number;
	/** THE DIAGONAL (Corey: "Leave it tunable for the game"): how long it runs in run_Q, road px along its path on the
	 *  screen. It is rounded to whole poses (at least one): at runSpeed / strideFps one pose of Q is about 20 road px on
	 *  the screen, so 80 is 4 poses. The turn (S, the Q poses, M) drops the feet about 56 road px at the defaults. */
	diagonal: number;
};
export const STRIKE = {
	/** the pause after the lanes settle (or after the strike before) */
	leadInMs: 90,
	/** WHICH END IT ENTERS AT: 'far' = the end farther from the target's reel (it passes the most of the board, so
	 *  the player watches for where it turns; the middle reel counts as nearer the right, so it comes from the left),
	 *  'near' the nearer end, or always 'left' / 'right' */
	entry: 'far' as 'far' | 'near' | 'left' | 'right',
	/** THE RUN HEIGHT IN THE SNOW, per layout. How much snow each screen shows above the top lane (lane line 167):
	 *    landscape  since the desktop road was shrunk 11% for it (Corey 2026-11-10; game/layoutSpec.ts ROAD_LAYOUT):
	 *               from the top bar's lower edge (road y -25) to the lane, 192 road px, and the title sign covers the
	 *               middle three reels down to road y 28. Feet on the shoulder above the top lane at 0.72 of the built
	 *               size (137 road px, 88 master units tall; at the road's own 0.85 it would run into the sign), so only its
	 *               antler tips pass behind the sign. Only 17 road px of snow lie under its feet, so the turn ends
	 *               over the top lane: at the defaults its feet are about 56 road px down, 39 into the top lane (171
	 *               tall), when the run down starts.
	 *    phone      from the screen's top (road y -62) to the lane: 229 road px, nothing over it.
	 *    portrait   the whole snow field under the title: over 500 road px. */
	snow: {
		landscape: { feetY: 150, scale: 0.72, diagonal: 80 } as SnowRun,
		phone: { feetY: 100, scale: 0.8, diagonal: 80 } as SnowRun,
		portrait: { feetY: 70, scale: 0.85, diagonal: 80 } as SnowRun,
	},
	/** it starts this many road px outside the picture's edge, under the rock or off the screen */
	enterPad: 30,
	/** ALONG THE SNOW (the side run, the turn and the diagonal): road px per second on the ground, and the leg cycle's
	 *  poses per second. The middle path (2026-11-12, measured from the rig's frames: the side run's one grounded pose,
	 *  pose 1, sweeps its hoof back 71.9 frame px per pose): at 1400 and 60 the body moves 2.44x the hoof's sweep on the
	 *  desktop (snow scale 0.72), 2.20x on a phone held sideways, 2.07x in portrait, and the farthest reel's side run
	 *  takes 0.93 s (the nearest 0.57 s). The other two compromises: 1150 (2.01x, 1.13 s) and 1600 (2.79x, 0.82 s). Both
	 *  aims at once (2x and under 0.9 s) would need about 76 poses a second, more than a 60 Hz screen can show without
	 *  skipping poses. The side run's step is trimmed (under 2%) so the turn ends exactly over the target's reel. */
	runSpeed: 1400,
	strideFps: 60,
	/** THE CAMERA's angle above the ground, degrees (the spec: a three-quarter overhead camera, about 35 to 45). It sets
	 *  which way each turned view runs on the screen and how much shorter its step looks: S runs 13 degrees below the
	 *  horizontal, Q 28 and M 48, at 0.96, 0.87 and 0.75 of the side run's step. */
	cameraDeg: 40,
	/** DOWN THE SCREEN (run_C): road px per second, steady (no stop, no quickening), and its own poses per second. The
	 *  run down is a whole number of poses, at least 1 and at most the C poses packed from pose 7 on (12: poses 7 to 16,
	 *  1, 2; tools/build_assets.py RUN_STRIDES), its step trimmed to fit; at 2600 and 42 the longest run down (the
	 *  bottom lane in portrait) is just 12. C's grounded hooves hardly move on the screen (they plant toward the camera),
	 *  so no speed keeps them from sliding there. */
	downSpeed: 2600,
	downStrideFps: 42,
	/** THE GAP AND THE LAST CUT (Corey 2026-11-15: "the reindeer should probably run between the traffic and take another
	 *  diagonal turn at the very end to get to the strike point"; game/road/roadFeatures.ts planStrike, strikeGapX): the
	 *  turn ends over the gap at the edge of the target's reel on the side he comes from (an outer reel's outer edge is
	 *  the shoulder: its inner gap then), he runs straight down the gap in C, then cuts diagonally into the target in Q,
	 *  the rig's 40 degree view (M, the 60 degree one, has only one pose; nothing was rendered for this). The time from
	 *  the set off to the impact is what the straight path took (the sounds land where they did); the run down and the
	 *  cut share what is left after the snow run at one screen speed. The cut is at least minPoses poses (about one per
	 *  downSpeed / downStrideFps road px of it), and no pose of either is shorter than 1000 / maxPoseFps ms. */
	cut: { minPoses: 2, maxPoseFps: 48 },
	/** the impact: when its middle reaches this far down the target cell (0 top, 1 bottom) */
	impactAt: 0.5,
	/** its size on the road at the impact, on top of the built size; it grows to this from its snow size as it comes
	 *  down the screen (it is coming toward us) */
	roadScale: 0.85,
	/** the runner fades out over this long after the impact */
	fadeMs: 120,
	/** a strike waits this long at most for the run views to finish loading (they start when the board is up), then
	 *  runs with the placeholder picture */
	loadWaitMs: 1500,
	/** STAGE 2, NOT WIRED (null = off): the pose the snow run must start on (the rig's take-off clip ends on run_R pose
	 *  3, so the run goes on from pose 4). With a fixed start the run cannot pick its first pose, so the side run's speed
	 *  is scaled by up to startFactorMax (either way) until the poses before the run down fit the (7 - n) rule
	 *  (game/road/roadFeatures.ts planRun). A distance it cannot fit falls back to the free start. */
	startPose: null as number | null,
	startFactorMax: 0.12,
};

// ---- THE GRANDMA WILD: the crash cloud in one cell, for one spin (Corey 2026-11-04 and 2026-11-09) ---------------------
export const CLOUD_CELL = {
	/** the cloud pops in from this size over popMs, with a small overshoot */
	popFrom: 0.5,
	popMs: 170,
	popOver: 1.08,
	/** WILD sits this far down the cell (0 top, 1 bottom) and is this tall, road px */
	wordY: 0.3,
	wordHeight: 44,
	/** the multiplier under it: this far down the cell, this tall, in this color (the atlas digits are white: tinted) */
	numberY: 0.7,
	numberHeight: 64,
	numberTint: 0xffd400,
	/** the handler waits this long on the cloud before the next event */
	holdMs: 240,
};

// ---- THE RED BOX (drawn by the game: plain colored quads, no picture) ---------------------------------------------------
// The same box, in the same red, frames the Grandma Wild's cell, a column Wild, and the Grandma car standing in a struck
// Santa reel (Corey 2026-11-10: "we could draw a red box around the grandma when it happens though, that gets covered by
// the santa strike column wild"): it comes on as the reindeer starts down, and the column's cloud grows over it.
export const RED_BOX = {
	color: 0xd6162c,
	/** the frame's thickness and the dark line around it, road px */
	width: 9,
	edge: 3,
	edgeColor: 0x101216,
	/** the box stands this far inside the cell's own edges, road px */
	inset: 4,
};

// ---- THE TARGET CROSSHAIR (Corey 2026-11-15, a prototype; game/road/crosshair.ts, game/road/roadFeatures.ts) -------
// Corey: "a fast moving but large Crosshair before the Reindeer's run starts, it should bounce around over Grandma's and
// wilds only, but move like a mouse cursor quickly between them, like it's selecting randomly but quickly ... stay
// locked on it until the crash then, it should transform to be the red border ... if it already passed a column, we
// should no longer be selecting that ... locked in at the time of the turn towards the board ... slightly fade the
// other symbols ... if there is only one potential target, the crosshair should just stay locked there the entire time."
//   THE CANDIDATES  every Grandma's car (H1) and Santa's sleigh (W) parked on the board when the strike starts, less the
//                   cells already struck this spin (a Grandma Wild's cloud, a column Wild's reel). The book's target is
//                   always one of them.
//   THE HOPS        from the strike's start (leadMs before the reindeer sets off) it glides from candidate to candidate
//                   (an eased glide with a slight bow, never a jump), resting a moment on each, in an order drawn from
//                   a seed of the board and the strike's place in the spin: a replay of the same book shows the same hops.
//   THE NARROWING   once he is running, a candidate drops out when he has run past its reel (passAt), and every other
//                   one at the turn; the target never drops. It is on the target for good by lockLeadMs before the turn
//                   (his first S pose) at the latest, and stays until the crash. Two candidates in the target's reel:
//                   both stay in the running until the lock, which takes the true one.
//   THE CRASH       its frame closes onto the red box at the cell's edge and the tick marks pull in, over the time the
//                   box's own draw-on took (a column: COLUMN.boxDrawMs, the cloud then pops on its old beat; a Grandma
//                   Wild: CLOUD_CELL.popMs, while her cloud pops inside it). A Grandma car boxed in a struck Santa reel
//                   keeps her own box as before.
//   THE FADE        while it is up every symbol that is not a candidate kind is drawn at `fade` brightness (a tint),
//                   eased in and out; back to full at the crash. fade 1 switches it off.
// All times are road clock ms: turbo and a slam stop shorten them with the run. Several strikes in a spin: each runs its
// own. No sound yet: the named beats are hop, drop, lock and morph (RoadFeatures.onCrosshair).
// Sizes, road px (a cell is 250 x 164 to 178; its red box 242 x 156 to 170): while gliding the frame is moveScale of the
// red box (about 334 x 223), resting dwellScale (about 315 x 211), locked lockScale (about 276 x 185), then 1.
export const CROSSHAIR = {
	/** false = no crosshair at all (the strike and the red box exactly as before) */
	on: true,
	/** how long it hops before the reindeer sets off (in place of STRIKE.leadInMs, when it is longer) */
	leadMs: 420,
	/** it shows over appearMs, from appearScale times its size, fading in */
	appearMs: 90,
	appearScale: 1.25,
	/** a glide between two cells: glideBaseMs plus glidePerPx per road px of distance, at most glideMaxMs (one reel
	 *  across is about 90 ms, the whole board about 160 ms); smootherstep eased, bowed off the line by up to `bow` of
	 *  the distance */
	glideBaseMs: 68,
	glidePerPx: 0.09,
	glideMaxMs: 170,
	bow: 0.07,
	/** the rest on each cell, a seeded draw between these */
	dwellMinMs: 55,
	dwellMaxMs: 110,
	/** the frame's size on top of the red box's: gliding, resting (eased to over settleMs), locked (over lockMs) */
	moveScale: 1.38,
	dwellScale: 1.3,
	settleMs: 70,
	lockScale: 1.14,
	lockMs: 150,
	/** the corner brackets' arms, a share of the frame's shorter side; the tick marks, road px inward */
	armFrac: 0.26,
	tickPx: 30,
	/** locked at the latest this long before the turn starts */
	lockLeadMs: 40,
	/** a candidate drops when the reindeer's feet are this far across its reel (0.5 its centre, 1 its far edge) */
	passAt: 1,
	/** the morph when no Wild takes it over (the dev strike hook alone) */
	morphMs: 220,
	/** THE FADE: the brightness of every symbol that is not a candidate kind while it is up (1 = off), eased in over
	 *  fadeInMs and back over fadeOutMs from the crash */
	fade: 0.6,
	fadeInMs: 160,
	fadeOutMs: 200,
};

// ---- THE LANDING BOARD (Corey 2026-11-15: the landing mock V2, without its UP TO; game/landingBoard.ts) ----------------
// Behind the landing screen the board stands posed and still: reels 1 and 5 hold the eight ordinary symbols once each,
// reels 2, 3 and 4 the Reindeer, Santa and Grandma column Wilds on one picked idle frame with their top multipliers
// (read from game/config.ts, never typed). The road band outside the three columns is softly dimmed, as V2 had it:
// plain dark quads (no filter), over the side reels' symbols and under the characters, so their spill stays bright.
// The mock also took a quarter of the color out; a quad cannot desaturate, so only the brightness is kept.
export const LANDING_DIM = {
	/** the brightness kept on the dimmed road band (1 = no dim) */
	brightness: 0.66,
	/** the band: from this many lanes above the top lane line to this many lanes under the bottom one */
	above: 0.42,
	below: 0.12,
	/** its top and bottom edges fade out over this many road px, in `steps` strips */
	feather: 18,
	steps: 4,
};

// ---- THE SCATTER PRESENT (game/road/present.ts, tools/build_present.py; the 3D present Corey approved 2026-11-15) -------
// Corey: "Only when enough presents land to trigger free spins, maybe a minor open and hide each time one lands with a
// jiggle". Closed and still otherwise (the still is the symbol atlas's S).
export const PRESENT = {
	/** THE LANDING PEEK, from the moment a present's lane brings it to its stop point: the open's squash and first 8 road
	 *  px of lift, then the close's fall, squash and bounce (presentSpec clips.peek, 367 ms at the board's pace). It
	 *  never holds anything up: nothing waits for it. glint: the light's strength while the lid is up (of the full
	 *  light; it lingers three frames as the lid shuts), rayLength: its rays' length (of the full rays), stars: how many
	 *  of the full open's burst stars it shows. */
	peek: { on: true, glint: 0.8, rayLength: 0.6, stars: 3 },
	/** THE TRIGGER: every present of the trigger plays the whole open with the light, holds the open pose this long
	 *  (board clock ms), then plays the whole close, before the intro card (game/bookEventHandlerMap.ts) */
	holdMs: 450,
	/** the trigger waits at most this long (real ms) for the open's sheets; without them the presents pulse as before */
	loadWaitMs: 1500,
	/** the light, as the demo page draws it: 11 rays, a bloom, 18 four-point stars (8 burst with the pop, the rest
	 *  trickle up while it is open) */
	light: { rays: 11, stars: 18, bloom: 0.45 },
};

// ---- THE COLUMN WILD (the three characters; game/road/roadFeatures.ts, tools/build_columns.py) --------------------------
export const COLUMN = {
	/** THE STRUCK CELL FIRST (Corey 2026-11-13: "draw the square box slower, put the crash cloud in the square box,
	 *  then let it grow from there. SO the player can see exactly what cell started the transition"): the box is traced
	 *  around the struck cell over boxDrawMs (from its top left corner, clockwise) with the symbol still showing, then
	 *  the crash cloud pops inside it over cloudPopMs. impactMs is the whole time on the struck cell (trace, pop, hold). */
	boxDrawMs: 260,
	cloudPopMs: 170,
	cloudPopFrom: 0.5,
	cloudPopOver: 1.04,
	impactMs: 610,
	/** then the box grows from that cell to the four rows over this long */
	growMs: 420,
	/** a column with no struck cell (Super's opening column) keeps the short times: there is no cell to point at */
	wholeImpactMs: 110,
	wholeGrowMs: 210,
	/** THE STILL CLOUD behind a standing column (Corey 2026-11-10): the color it is multiplied by. 0xffffff is the
	 *  cloud as drawn (white). The entrance clips' own cloud turns a dusky blue gray as it thins (measured on its last
	 *  cloud frames: reindeer 152,168,172, Santa 180,194,195, Grandma 130,160,175), so the still takes that tone and the
	 *  moving cloud hands over to it with no change of color. With 0xffffff the box dips to gray and comes back white.
	 *  Corey 2026-11-10 on the dusky 0xa3b6bd: "Can we go with an inbetween of the blue gray and white? The blue gray
	 *  is too dark to me." 0xd1dbde is the midpoint of the two. */
	backdropTint: 0xd1dbde,
	/** THE FULL COLUMN'S FRAME (Corey 2026-11-15: "on the full column wilds, the animation bleeds outside the column
	 *  boxes, widening the border should be enough to solve this. Also on the bottom of the full column wilds, I'd like
	 *  their feet to be behind the borders. We should do the same for the top border as well"). The characters now draw
	 *  UNDER the red frame on all four sides, each cropped to the box's outer edge (game/road/roadFeatures.ts placeBody),
	 *  and the full column's red band is this thick, road px (the cell box and the Grandma Wild's stay RED_BOX.width, 9;
	 *  the band thickens from 9 as the box grows). The dark line either side is RED_BOX.edge as before, and the outer edge
	 *  does not move: it widens inward. Measured over every packed frame (tools: the round 2 notes), the art reaches up to
	 *  69 road px past the box's sides (Santa's elbows and hat, Grandma's cane, the reindeer's lights and win kick) and 1
	 *  px past the top and bottom, so no frame width could hide it alone: the crop does, and the frame covers the cut. */
	frameWidth: 13,
	/** each character's size on top of the built size (1 = four lanes tall as drawn), about the column's foot */
	tierScale: { reindeer: 1, santa: 1, grandma: 1 } as Record<'reindeer' | 'santa' | 'grandma', number>,
	/** the multiplier on the column: its centre this far up from the column's foot, this tall, this color */
	numberUp: 58,
	numberHeight: 74,
	numberTint: 0xffd400,
	/** it pops in when the entrance is this far along (0 to 1) */
	numberAt: 0.55,
	/** a Grandma Wild already standing in the reel adds her multiplier (EVENT_SCHEMA 2026-11-10a; never under variant
	 *  F): the column's own number pops in first, and the sum takes its place this long after, with a second pop */
	joinMs: 420,
	/** a column not held leaves (the press, the end of a round) over this long */
	leaveMs: 160,
	/** how long the handler waits for a tier's pictures before it goes on without them (real ms) */
	loadWaitMs: 4000,
	/** THE UPLOAD QUEUE for the characters' sheets (game/road/columnClips.ts; Corey's iPhone runs 2026-11-10 showed a
	 *  tier's three clips going to the GPU in the same frames): one sheet at a time, at least gapMs apart (real ms), and
	 *  kept out of an impact's frames for at most quietMaxMs, unless a column is waiting on that very picture */
	upload: { gapMs: 120, quietMaxMs: 1200 },
};

// ---- THE BONUS ROUND'S CARDS AND BEATS (ui/RoundCard.svelte, game/bookEventHandlerMap.ts) -----------------------------
export const ROUND = {
	/** the scatters pulse this long before the intro card */
	triggerPulseMs: 900,
	/** a card continues by itself after this long (a press continues at once); shorter when autoplay runs the bonuses */
	introAutoMs: 4000,
	outroAutoMs: 6000,
	autoplayMs: 1400,
	/** a card takes no press for its first moment (a spin press must not skip it) */
	armMs: 450,
	/** the +3 line of a retrigger shows this long */
	retriggerMs: 1100,
	/** the pause between two free spins */
	betweenSpinsMs: 160,
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
	/** the glass HUD (ui/hud): the bottom bed's top edge stays at least this far (CSS px) over the HUD's own top, rising
	 *  above `bottom` where the HUD stands higher (components/HudBeds.svelte; never above the board's bottom edge) */
	hudPad: 8,
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
	/** a win through multiplier Wilds shows the multiplier over the amount ("x35": the highest of the winning lines),
	 *  atlas digits this tall and this color, this far above the amount's centre */
	multHeight: 58,
	multTint: 0xffd400,
	multUp: 78,
	/** the amount pops in from this size over popMs */
	popFrom: 0.6,
	popMs: 180,
	/** THE CHRISTMAS LIGHTS (Corey 2026-11-15: "2. Christmas Lights, this looks great", the win line mock's style 2;
	 *  game/road/winLights.ts, tools/build_win_lights.py). Each winning line is a dark green wire with a dark outline,
	 *  strung from winning symbol to winning symbol and sagging between them like a hung wire, drawn in along the line
	 *  over drawMs; bulbs hang from it every `bulb.spacing` road px and light one after another as the wire reaches them,
	 *  then twinkle in a chase while the line is held. THE STAGGER ("I like the staggering on the win lines, with the
	 *  amounts showing up with the win lines"): the lines start staggerMs apart in the book's order, each line's own
	 *  amount pops in as its wire is complete, then the total shows as before (its pop, the x multiplier, the hold). A
	 *  one line win's own amount IS the total, so it shows once, as the total. Angry Mantis lights its combos 220 ms
	 *  apart and keeps every amount floating over its own cluster (no total over the board); Manticore's fast wave
	 *  starts its clusters 135 ms apart; these lines go slower, 420 ms ("420 is fine"), because each one draws for
	 *  620 ms and is read on its own. Every time here is real ms at normal speed and is multiplied by holdShare for
	 *  the turbo level (and run 3x by a slam stop's hurry, the win clock). Plain sprites only: tinted quads of Pixi's
	 *  white texture for the wire, one bulb and one glow picture for the lights; no filter, mask, shader or blur. */
	lights: {
		/** false: the old straight lines, all at once */
		on: true,
		staggerMs: 420,
		drawMs: 620,
		/** each span between two winning symbols droops this many road px at its middle */
		sag: 38,
		/** the wire, road px: its outline's full width, its core's, and how finely a span is cut into straight quads */
		wire: { outline: 14, core: 6, outlineColor: 0x0b0c0f, coreColor: 0x1f5c36, segmentsPerSpan: 14 },
		/** a bulb every `spacing` road px along the wire from `first`; it pops up from popFrom over popMs as the wire
		 *  reaches it; a bulb not lit in the chase is its color times `dim`. `scale`: its drawn size, a share of the
		 *  sheet's largest draw (winLightsSpec.ts pop) */
		bulb: { spacing: 74, first: 36, popFrom: 0.5, popMs: 110, dim: 0.68, scale: 1 / 1.18 },
		/** the glow under a lit bulb, added (its alpha lit and in the chase's off beat) */
		glow: { alpha: 0.7, dimAlpha: 0.16, scale: 1 / 1.18 },
		/** after the wire is drawn: one bulb in `cycle` is lit, the light steps along every stepMs */
		chase: { stepMs: 140, cycle: 3 },
		/** a line's own amount: Overpass Heavy, gold with the dark edge, this cap size in road px; it pops in when its line
		 *  is complete, swelling by `swell` over popMs, on a winning symbol's top edge (the middle one first; another if
		 *  it would touch an amount already up). When the total comes they fade over fadeMs. The total comes holdMs after
		 *  the last line's amount. */
		amount: { size: 52, fill: 0xffd400, stroke: 0x101216, strokeWidth: 10, popMs: 160, swell: 0.35, pad: 6, holdMs: 320, fadeMs: 160 },
		/** THE BULB COLORS, by the symbol the line pays (Corey: "different color lights, maybe that align with the types of
		 *  symbols they are clearing"), cycled along the wire. Sampled from the art where it has the color (the van's
		 *  light blue, Grandma's purple and gold, the sleigh's red and gold, the signs'): the wagon's tree green is its
		 *  needles' hue (#2b6800 in the art) at a lit bulb's brightness, its lighter green the wagon's own body (#98a862) */
		palettes: {
			H4: [0xf21c1c, 0xffffff, 0x2a5cff],
			H3: [0x91d1f8, 0xffffff, 0xffd400],
			H2: [0x5ad800, 0x98a862, 0xffffff],
			H1: [0xb12bd3, 0xffffff, 0xfcc920],
			W: [0xef2e2c, 0xfab717, 0xffffff],
			L1: [0xc5f803, 0xffffff],
			L2: [0xfb5601, 0xffffff],
			L3: [0xfccd02, 0xffffff],
			L4: [0xf80290, 0xffffff],
			L5: [0xffffff, 0xb8c2cc],
		} as Record<string, number[]>,
	},
};

// ---- THE REINDEER'S OWN SOUNDS (Corey's picks 2026-11-15; game/road/roadSounds.ts plays them) -------------------------
// Each sound is cued by the frame of the animation it belongs to, on the road clock, so turbo and a slam stop move it
// with the picture (the sounds themselves always play at their own speed). The sprite keys are in
// tools/build_audiosprite.py ROR_EVENTS, their levels in ROR_SOURCE_GAIN_DB there. Every other effect the game plays
// is still a borrowed Manticore one (since round 2: the bonus trigger stings and Super's opening column box), or a
// house standard (the UI keys).
//   alert      sfx_reindeer_alert, on the strike's first frame: the crosshair's first frame (it starts hunting)
//   run        sfx_reindeer_run, a 1.2 s loop: from the frame he sets off along the snow to the frame of his turn toward
//              the board (the S pose), where it stops (or the impact, if that came first); never left on otherwise
//   turn       sfx_reindeer_turn, on the turn's frame, as the run loop stops (the run does not resume: ASSET_LIST.md)
//   crash      sfx_crash, on the crash cloud's first frame: a Grandma Wild's cloud (the frame after the impact), or a
//              struck Santa reel's cell cloud (it pops COLUMN.boxDrawMs after the impact, once the box is traced)
//   cloud      sfx_crash_cloud, a 4.0 s loop while a crash cloud shows (a Grandma Wild's cloud cell until it has left, a
//              struck column's cloud until its entrance's cloud frames are over); it stops on the frame the last one
//              clears, and at the latest when the round ends (a base game Grandma cloud stands until the next press)
//   grandmaWild  sfx_grandma_wild, when her cloud's pop has settled and her red box shows (CLOUD_CELL.popMs)
//   columnIn   sfx_column_reindeer_in, the reindeer column's entrance: its first footstep (at 0 ms in the file) on the
//              entrance frame where his first hoof plants (frame `frame`, 0-based, of the 16 kept; frame 7 is the second)
//   snort      sfx_reindeer_idle_snort, now and then while a reindeer column stands in its idle: rolled at each restart
//              of the idle loop, never during a strike or a column's arrival, at least minGapMs apart
// A stop is a stopFadeMs fade to silence then the stop, so a loop cut mid waveform does not click.
export const REINDEER_SOUND = {
	names: {
		alert: 'sfx_reindeer_alert',
		run: 'sfx_reindeer_run',
		turn: 'sfx_reindeer_turn',
		crash: 'sfx_crash',
		cloud: 'sfx_crash_cloud',
		grandmaWild: 'sfx_grandma_wild',
		columnIn: 'sfx_column_reindeer_in',
		snort: 'sfx_reindeer_idle_snort',
		// round 2 (Corey's picks 2026-11-15, the audition page): the spin, the target and the multiplier stamp
		traffic: 'sfx_traffic_roll',
		stoplight: 'sfx_stoplight_change',
		hop: 'sfx_target_hop',
		drop: 'sfx_target_drop',
		lock: 'sfx_target_lock',
		dart: 'sfx_reindeer_dart',
		redbox: 'sfx_redbox',
		present: 'sfx_present_pop',
		// round 3 (Corey's finals 2026-11-15, wired 2026-11-16): the column's growth and its other two characters, a free
		// spins column settling in to stay
		grow: 'sfx_column_grow',
		santaIn: 'sfx_column_santa_in',
		grandmaIn: 'sfx_column_grandma_in',
		sticky: 'sfx_sticky_set',
	},
	// ---- ROUND 2 (2026-11-15). The same rule: each one cued from the frame its picture reaches the moment.
	//   traffic    sfx_traffic_roll, a 2.0 s loop: from the press (the board pulls away) through the wait for the book and
	//              the drive in; it fades from the frame the first reel's cars stop, over the time left to the last
	//              reel's stop, and is stopped there. Never left on: a board put up as it is (a resume, a failed play)
	//              and the board going stop it too.
	//   reel stop  sfx_lane_stop_1..5, one per REEL, reel 1 to reel 5 (rising a semitone each), on the frame that reel's
	//              last car reaches its stop point (the start of its rock back, the moment the red light answers to). The
	//              road has four lanes and five reels; at normal speed and turbo 1 the reels finish left to right, at
	//              turbo 2 (all lanes at once) the middle reel finishes first and the outer pairs together. A reel a
	//              column Wild holds has no cars, so no stop. Replaces the borrowed sfx_reel_stop (once per lane).
	//   stoplight  sfx_stoplight_change, on the frame a light changes color (green at the press, amber, red), once per
	//              frame however many lights change in it (the two go green together; red comes to the top light a
	//              moment before the bottom one)
	//   hop        sfx_target_hop, each crosshair hop (it lands on the next candidate), at a playback rate that steps
	//              through `hopSemitones` by the hop's number in the strike (deterministic: the probe checks it)
	//   drop       sfx_target_drop, a candidate drops out; once per frame however many drop in it, and not on the lock's
	//              frame (the candidates left all drop as it locks: the lock voices them)
	//   lock       sfx_target_lock, the crosshair locks on the target
	//   dart       sfx_reindeer_dart, his dash into the target: started `dart.peakMs` (real ms) before the impact frame, so
	//              the whoosh's loudest moment lands on the impact (the file builds for 330 ms first), never before he sets
	//              off; a frame late at most (it is cued on the first frame within peakMs of the impact)
	//   redbox     sfx_redbox, the crash: the frame the crosshair starts closing onto the red box (the impact frame);
	//              kept under the crash in the sprite (-6 dB on Corey's file)
	//   stamp      sfx_multiplier_land_small / _mid / _high, a column Wild's number stamping on (its pop, COLUMN.numberAt
	//              of the entrance), by its value: small under `stamp.mid`, mid under `stamp.high`, high from it. A
	//              Grandma Wild's number has no stamp of its own (it comes in with her cloud, voiced by the crash and
	//              sfx_grandma_wild), so it plays none.
	//   present    sfx_present_pop, a trigger's presents: ONE play, on the frame the first present's lid leaves the box
	//              (the open's first frame with any lift, game/road/present.ts PRESENT_LID_FRAME: frame 3, 100 ms into
	//              the open at normal speed). Corey's file builds for 170 ms before its pop, so the pop itself is heard
	//              170 ms after that frame (the round 2 notes have the numbers). ROUND 3: on the open's FIRST frame instead
	//              (`presentPopFrame`, Corey: yes), so the pop itself lands about 170 ms into the open (the lid lifts at
	//              100 ms, the stars burst from 120 ms).
	// ---- ROUND 3 (2026-11-16). The same rule again; game/road/roadSounds.ts and game/road/roadFeatures.ts cue them.
	//   grow       sfx_column_grow, the red box starts growing up the reel (the frame its 'grow' begins; Super's opening
	//              column too, whose box grows from the middle). In the sprite from its right channel only (the
	//              builder's ROR_SOURCE_CHANNEL: its two channels partly cancel in a downmix).
	//   column in  each character's entrance on frame `columnIn.frame[tier]` of its 16: the first frame it stands in full
	//              color out of the cloud's silhouette. The reindeer's first hoof (round 1), Santa's heavy steps (his
	//              hmph, 800 ms into the file, then lands on his hands-on-hips pose, frames 13 to 15), Grandma's cane
	//              taps (her cackle, 610 ms in, while she walks out, frames 12 to 15).
	//   column win sfx_column_win_<tier>, a column character's win clip: on its first frame (a line win runs through the
	//              reel and the clip is in; no clip, no win pose, no sound)
	//   sticky     sfx_sticky_set, a STICKY column (free spins and Super) has finished its entrance and stands: the frame
	//              its idle begins. A base game column (it leaves at the next press) plays none.
	//   cards      sfx_card_in on the frame a bonus round card comes up (its pop starts), sfx_card_out on the frame it
	//              goes (it has no exit animation); sfx_topup with the wrap-up card when it says the round was topped up
	//              to its minimum (ui/RoundCard.svelte)
	//   lines      sfx_line_show ONCE PER LINE, on the frame that line starts to light (the lines light one after another,
	//              constants LINE_WIN lights); the symbol's own sound stays one per win, with the first line
	//   ambience   amb_road, a 10.000 s loop in the sprite (the house pattern for an effects loop: the traffic, the cloud,
	//              Manticore's fire loops), on under the base game from the moment the sprite is in, faded out when a
	//              feature's music takes over (the base music does the same) and back with the base music
	//              (components/Sound.svelte)
	/** the hop's pitch, semitones, by its number in the strike (1st hop the first entry; it cycles) */
	hopSemitones: [0, 1.5, -1, 2, -2, 0.5, -1.5, 1],
	dart: { peakMs: 330 },
	/** THE LAST CUT (STRIKE.cut, round 2 of the shadows): true plays the turn sound again on the cut's first frame (his
	 *  second turn, into the target). Off: the cut comes 90 to 400 ms before the impact, inside the dart's whoosh (it
	 *  starts 330 ms before the impact and peaks on it), and on a top row strike it would start while the first turn's
	 *  250 ms sound is still playing (the same sound twice at once) */
	cutTurn: false,
	/** THE MULTIPLIER BANDS (the game's config multipliers): every base game column tier falls in its own band (reindeer
	 *  3-8 small, Santa 10-20 mid, Grandma 40-75 high); bonus columns 2-30 and the rare 30 and 50 starts spread over
	 *  the three */
	stamp: { mid: 10, high: 30, names: { small: 'sfx_multiplier_land_small', mid: 'sfx_multiplier_land_mid', high: 'sfx_multiplier_land_high' } },
	/** one per reel, reel 1 first */
	reelStops: ['sfx_lane_stop_1', 'sfx_lane_stop_2', 'sfx_lane_stop_3', 'sfx_lane_stop_4', 'sfx_lane_stop_5'],
	/** THE LINE WIN (game/bookEventHandlerMap.ts winInfo): one symbol's own sound for the whole win, as the one borrowed
	 *  sfx_cluster_remove was before it: the best paying symbol among the winning lines (W, a line of Wilds only, pays
	 *  as Grandma's car), with sfx_line_show under it, on the frame the lines show. The road signs go lowest to
	 *  highest: 10 (L5) is sfx_win_low_1, A (L1) is sfx_win_low_5. */
	lineShow: 'sfx_line_show',
	winBySymbol: {
		H1: 'sfx_win_h1_grandma',
		W: 'sfx_win_h1_grandma',
		H2: 'sfx_win_h2_wagon',
		H3: 'sfx_win_h3_van',
		H4: 'sfx_win_h4_police',
		L1: 'sfx_win_low_5',
		L2: 'sfx_win_low_4',
		L3: 'sfx_win_low_3',
		L4: 'sfx_win_low_2',
		L5: 'sfx_win_low_1',
	} as Record<string, string>,
	/** a loop or a cut one-shot fades to silence over this long, real ms, then stops */
	stopFadeMs: 8,
	/** the cloud loop at the end of a round, real ms */
	roundEndFadeMs: 300,
	columnIn: { frame: { reindeer: 5, santa: 5, grandma: 5 } as Record<'reindeer' | 'santa' | 'grandma', number> },
	/** the present's pop starts on this frame of the open (0 = its first; round 2 started it on PRESENT_LID_FRAME, 3) */
	presentPopFrame: 0,
	/** a column character's win clip, by tier */
	columnWin: { reindeer: 'sfx_column_win_reindeer', santa: 'sfx_column_win_santa', grandma: 'sfx_column_win_grandma' } as Record<'reindeer' | 'santa' | 'grandma', string>,
	/** the bonus round cards (ui/RoundCard.svelte) */
	cards: { in: 'sfx_card_in', out: 'sfx_card_out', topUp: 'sfx_topup' },
	/** the road's ambience under the base game: faded in over inMs when it starts, out over outMs when a feature starts */
	ambience: { name: 'amb_road', inMs: 1200, outMs: 600 },
	snort: {
		/** the chance at each restart of the reindeer's idle loop (4 s at normal speed): about once every 24 s per column */
		odds: 1 / 6,
		/** real ms between two snorts at least, and after a strike or a column's arrival */
		minGapMs: 10000,
		quietMs: 1200,
	},
};

// ---- THE CAST SHADOWS (Corey 2026-11-15, round 2; game/road/shadows.ts) ---------------------------------------------
// Corey on round 1's soft ellipses: "These shadows should be the shape of the vehicles and signs probably going towards
// up back, but strong shift to the left so it's more visible." So every symbol, the through traffic, the three column
// characters and the running reindeer throw their own silhouette: a twin of the owner's own picture, near black,
// pinned where the owner touches the ground, flattened and leaned up and to the left. One light for the whole scene.
// Drawn under every lane (never over a symbol), so they show on the road in the gaps. Plain sprites: tint, alpha, skew
// and scale only. No filter, mask, shader or blur, and no texture of their own.
export const SHADOW = {
	/** draw them at all */
	on: true,
	/** THE LIGHT: the shadow leans this many degrees off straight up the screen, toward the left (0 = straight up, away
	 *  from the camera; 90 = flat along the road to the left) */
	angle: 64,
	/** how long it is: the owner's top lands this share of the owner's own height away from its ground point, along the
	 *  lean (so at 64 degrees and 1 a car's roof shadow lands 0.9 of its height to the left and 0.44 up) */
	length: 1,
	/** how dark: the twin's alpha. The asphalt is near black already (about rgb 50 56 64): 0.8 takes it to about 10 11 13,
	 *  which reads as a clear dark shape at phone size; round 1's 0.75 was the centre of a soft ellipse, and tiny */
	alpha: 0.8,
	/** their color: a cold near black (the HUD's shadow color), so on the snow they read blue grey, not dirty */
	tint: 0x020812,
	/** THE COLUMN CHARACTERS: the column's cloud stands in the reel like a wall behind them, so the same light throws
	 *  their twin onto it up and to the left by (dx, dy) road px, cropped to the inside of the red box. On the light
	 *  cloud it needs less alpha to read as strongly. */
	column: { dx: -30, dy: -16, alpha: 0.32 },
	/** the column characters get one */
	columns: true,
	/** the running reindeer gets one, on the road under the traffic, all the way to the impact */
	runner: true,
	/** a column's shadow comes in over this long once its character stands clear of the entrance's cloud, ms */
	columnInMs: 160,
};

// ---- THE POLICE CAR'S LIGHT BAR (Corey 2026-11-15; game/road/policeLights.ts, tools/build_police_lights.py) -----------
// "We should do the Police car light ups for when there is a win with them in code." While a line win through a police
// car (H4) shows, its red and blue lenses flash in turn, in step with sfx_win_h4_police (680 ms: two siren whoops, each
// rising 600 to 1440 Hz, starting 50 and 410 ms in: one every 360 ms). So the lens changes every halfMs from onsetMs
// after the lines show (the sound's own frame): red with each whoop, blue between them, and on in that rhythm for the
// whole win hold. The stoplights' soft blob, tinted and added (no new texture, no filter). Times are the win clock's
// (real ms; a slam stop hurries it).
export const POLICE_LIGHTS = {
	/** false = the police cars stay dark in a win */
	on: true,
	/** the first lens lights this long after the lines show (the sound's first whoop) */
	onsetMs: 50,
	/** each lens's turn: half the whoop period (360 ms) */
	halfMs: 180,
	/** a lens comes up over attackMs and eases down by `fade` of its brightness by the end of its turn */
	attackMs: 25,
	fade: 0.45,
	/** the lens colors (the glow and the spill) */
	tint: { red: 0xff1a1a, blue: 0x2a62ff } as Record<'red' | 'blue', number>,
	/** the hot core on the lens: this many times the lens's measured size, this bright, nearly white with its color */
	core: { size: 1.7, alpha: 0.9, tint: { red: 0xffb8a8, blue: 0xb8d4ff } as Record<'red' | 'blue', number> },
	/** the colored glow around the lens, road px wide at the car's built size (squash: its height against its width) */
	glow: { size: 150, squash: 0.85, alpha: 1 },
	/** the faint wide spill on the roof and the road beside the car */
	spill: { size: 320, squash: 0.6, alpha: 0.4 },
};

// ---- THE VAN'S WIN (Corey 2026-11-15; game/road/vanWin.ts, tools/build_van_win.py) -------------------------------------
// While a line win through the van (H3) shows: first THE LURCH AND THE BACKFIRE for lurchMs (the length of
// sfx_win_h3_van's body: a steady 300 ms burst from its first frame, then a 300 ms tail 30 dB down), then THE ROCKING
// AND THE FLASHLIGHT for the rest of the win. Times on the win clock (real ms; a slam stop hurries it), from the frame
// the lines show (the sound's own frame). Sizes in road px at the van's built size.
export const VAN_WIN = {
	/** false = the van does nothing in a win */
	on: true,
	/** the lurch and the backfire, then the rocking and the flashlight */
	lurchMs: 300,
	/** THE LURCH: a damped spring. The nose lifts about the rear wheel by up to squatDeg (the rear squats), the body
	 *  jolts forward by up to joltPx; one bounce back (periodMs) and it settles (decayMs) */
	lurch: { squatDeg: 2.4, joltPx: 5, periodMs: 280, decayMs: 120 },
	/** THE BACKFIRE: one puff from the exhaust at each of these ms */
	puffs: [20, 140],
	/** each puff: its width (road px) grows from `from` to `to` times `size` over lifeMs while it drifts `back` road px
	 *  backward (it starts `out` behind the bumper) and `rise` up; it comes in over inMs and fades out */
	puff: { size: 40, from: 0.45, to: 1.2, lifeMs: 620, back: 46, out: 6, rise: 40, inMs: 50, alpha: 1 },
	/** THE ROCKING: a lean (skew) up to leanDeg and a bounce of the body's height, about the wheel line, period
	 *  periodMs, coming in over rampMs */
	rock: { leanDeg: 2.2, bounce: 0.018, periodMs: 520, rampMs: 140 },
	/** THE FLASHLIGHT: warm, added; a beam `width` (a share of the slots) wide sweeps across the windows' slots and back
	 *  every sweepMs and flickers (down by up to `flicker`, a new draw every flickerMs). fill: each glow's width against
	 *  twice the glass's depth at its slot: the soft blob's outer quarter is all but clear, so 1.25 keeps its visible
	 *  light on the glass (the van probe checks it against the measured depth) */
	light: { tint: 0xfff0c8, alpha: 1, width: 0.34, sweepMs: 900, flicker: 0.35, flickerMs: 60, fill: 1.25 },
};

/** everything tunable, as one object (window.__reindeer.tune) */
export const TUNE = { road: ROAD, motion: ROAD_MOTION, lineWin: LINE_WIN, strike: STRIKE, cloudCell: CLOUD_CELL, redBox: RED_BOX, crosshair: CROSSHAIR, column: COLUMN, round: ROUND, stoplight: STOPLIGHT, hudBed: HUD_BED, present: PRESENT, sound: REINDEER_SOUND, shadow: SHADOW, policeLights: POLICE_LIGHTS, vanWin: VAN_WIN };

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
