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
	/** (NOT DRAWN since scene pass 9, 2026-11-16: the snow runs on past the picture, game/scene/sceneLayers.ts; kept for a
	 *  scene preset that wants it.) THE ROCK THE TUNNELS RUN INTO: left and right of the picture the scene is this dark,
	 *  flat color (the hillside over the tunnels), not snow. Traffic that has driven past the picture's edge is under it, the stone portals have
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
	/** THE TEASE (constants LANE_FLOW; Corey 2026-11-16, two lights, "the narrow gap between lanes allow us to use one
	 *  stoplight per direction without really having to change the stop light logic"). While a light's lanes still
	 *  have cars in the tunnel: two seen, its amber FLASHES (on and off every flashMs); three seen, it ALTERNATES red
	 *  and amber, faster (every alternateMs); each release from its lanes shows green for greenMs. Once its lanes have
	 *  let every car out, the stop behavior above as always (amber, the red leading the stop). Road clock ms. The
	 *  tease's flashing is silent (it has its own sound); releaseSound: the light's change sound on each green. */
	tease: { flashMs: 260, alternateMs: 150, greenMs: 160, releaseSound: false },
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
	/** it starts this many road px outside the picture's edge, or (scene pass 9: the rock is gone, the snow runs on) just
	 *  outside the screen's edge where the screen shows more than that, so it never pops up on the open snow */
	enterPad: 30,
	/** scene pass 9: start past the SCREEN's edge where the screen shows snow beyond the picture (the run is then longer:
	 *  about 0.17 s on a 16:9 or 16:10 desktop, 0.35 s held sideways on a phone, 0.4 s at 21:9); false = the old start,
	 *  30 road px outside the picture, where he now appears on the open snow */
	enterFromScreen: true,
	/** THE ROAMING REINDEER (2026-11-17; game/road/roam.ts, ROAM below, game/roamPaths.ts): one reindeer stays on the
	 *  screen between spins, wandering its path and sniffing; the first strike of a spin is his, from where he stands
	 *  (its impact never later than the strike from off the screen would land); every later strike of the spin comes
	 *  from off the screen; after the spin a new one walks in. false = no roaming reindeer: every strike exactly as
	 *  before. */
	roam: true,
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

// ---- THE ROAMING REINDEER's pace and timing (STRIKE.roam; game/road/roam.ts; the paths are game/roamPaths.ts) ----------
// The tune panel's "Reindeer path" group (staging) edits these and the paths themselves. Board clock ms (turbo and a slam
// stop hurry them).
export const ROAM = {
	/** THE WALK (Corey's mock, 2026-11-17): his speed as a share of the screen's width per second. His legs run at the rig's
	 *  stride for that speed (the hooves never slide), so the speed is held back where the stride would be faster than
	 *  maxPace times the rig's own walk (at 3.2 % that is the desktop and the phone held sideways: about 2.4 % and 2.1 %) */
	walkSpeedPct: 3.2,
	maxPace: 2.5,
	/** the walk in after a spin's strikes: this many times the walk's speed, its stride held at maxInPace */
	walkInMul: 2.5,
	maxInPace: 4,
	/** how long he stops at a spot (sniffing): a random draw between these. The sniff loop (3.3 s) is played whole, 1 to n
	 *  times, at 0.67 to 1.5 times its pace to fit: a stop shorter than 2.2 s comes out at 2.2 s */
	idleMinMs: 1500,
	idleMaxMs: 5000,
	/** how far one walk goes, shares of the screen's width (the mock's 4 % to 18 %) */
	hopMinPct: 4,
	hopMaxPct: 18,
	/** THE STEEPEST WALK, degrees from level: his walk is drawn side on, so a steep one slides; a pick is turned down when
	 *  it climbs or drops more than this (other heights are reached over several walks). With no spot found that way the
	 *  rule is relaxed, then the walk's length: he never freezes */
	maxSlopeDeg: 14,
	/** ROUND 4: when every level walk only takes him back near his last stops (a narrow strip of snow, a short window),
	 *  one up to this steep may take him to new ground instead (he must not shuffle in a corner) */
	exploreSlopeDeg: 24,
	/** the new one starts walking in this long after the spin's last strike's impact */
	walkInDelayMs: 900,
	/** a strike from where he stands that would land later than the strike from off the screen: his side run is sped up
	 *  to at most 1 / minRunShare, and only then is its start cut (the impact is never later) */
	minRunShare: 0.6,
	/** his random choices' seed: 0 = a new one every page (the game); a number repeats them (the probes) */
	seed: 0,
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
	/** THE SMOKE EDGE TO EDGE (2026-11-17): the picture's opaque core, as a share of its width (x) and height (y) cut off
	 *  each side (measured on both atlas tiers: 99.9% opaque inside); the box shows that core, cropped to its shape */
	core: { x: 0.105, y: 0.112 },
};

// ---- THE GRANDMA WILD'S BRAWL CLOUD (Corey 2026-11-19; game/road/brawlCloud.ts, tools/build_brawl.py) -----------------
// The approved animated cloud in her cell, from the three clips of Desktop/Run Over Reindeer/animation/grandma_brawl:
//   LOOP     while the Wild stands ("Brawl draft 1 looks good"): every 2nd frame at 12 fps, cropped to the cell
//   LANDING  option C of landing_preview.html, his settings exactly: the game's own car and seated Grandma take the bump
//            for spriteMs (his words: "some movement of the car forward, slightly like a bump and grandma reacting to
//            it, being pushed forward as the cloud quickly covers her, so it's like 1-2 frames"), the contact star pops,
//            then the clip enters at frame entry already covering her, drawn k0 larger about the car's bottom centre so
//            its car is the game's car (its own shove on frame 2 cancelled), openSpeed x the clip's 24 fps to the cover
//            frame, afterSpeed x from there, easing to the cell's size by the cut frame, then a cut to the loop's frame
//            loopEntry (0: the page's best match, 80) with an xfadeMs fade of the landing over it. WILD and the number
//            pop when the car is covered (his "wild": "cover"). The strike's end moves to the car's rear (strike below).
//   WIN      once per win through this Wild ("Win beat yes"): the 2.0 s trim, every 2nd frame, on the win clock (x 1 /
//            LINE_WIN.holdShare), entered at the wind up frame most like the loop's frame and faded in over fadeInMs;
//            WILD fades to wordAlpha while the reindeer's head is up (his text "b"); no wobble, no stars. Back to the
//            loop's frame 1 (the still both share) at its end. Never restarted mid-beat; Wilds on one line start
//            staggerMs apart in the line's order.
// Crop "a" (the cell, inside the frame) for all three. Sprites, transforms, alpha and tint only: each clip frame is cut
// to the box by its texture's frame (no mask), one set of frames shared by every Grandma Wild on the board. Road px and
// board ms unless said. `on: false` brings back the still crash cloud of before (and the strike's end at the cell's
// centre). The tune panel lists this block (staging only; the TUNE entry is made in game/road/brawlCloud.ts).
export const GRANDMA_BRAWL = {
	on: true,
	/** THE WORD WILD, its own sprites over the clip and under the number (game/road/wildWord.ts). `look` 'candy': treatment
	 *  B "Candy Cane" of the WILD word mock (Corey 2026-11-20; Desktop/Run Over Reindeer/wild_word_r1_2026-11-19): the
	 *  multiplier's candy letters (tools/build_wild_word.py), `size` of a 56 road px capital, centred at (x, y) road px
	 *  from the cell's centre in the mock's 248 x 176.5 box (scaled to the cell's own), turned `rot` degrees; the letters
	 *  drop in at the cover from 1.8x over dropMs, letterMs apart; they hop on the number's win beats; a light sweeps
	 *  across every everyMs. 'today': the word of before (`today`: the symbols atlas frame, its height, its centre down
	 *  the cell, popping at the cover), which is also what a Wild shows until the candy atlas is in. */
	word: {
		look: 'candy' as 'candy' | 'today',
		today: { frame: 'word_wild', height: 44, y: 0.3 },
		candy: { size: 0.46, x: -54, y: -49, rot: -8, dropMs: 240, letterMs: 60, hop: { beats: [0, 700], px: 12, staggerMs: 70, ms: 300 }, sheen: { alpha: 0.4, everyMs: 3400 } },
	},
	/** the phase of each Wild put up without a landing (a resume, a dev hook), as shares of the loop, by its place
	 *  among the Wilds standing; every other one mirrored. A landed Wild's phase is its landing's cut, its mirror its
	 *  car's facing (the clip shows a hit from behind: a car facing left is the clip mirrored) */
	phases: [0, 0.25, 0.5, 0.75],
	/** THE LANDING (landing_preview.html option C, Corey's settings) */
	landing: {
		bumpPx: 24,
		bumpMs: 120,
		/** squash, percent */
		squash: 4,
		openSpeed: 10,
		afterSpeed: 1.5,
		coverFrame: 16,
		cutFrame: 26,
		/** the loop frame (source, 1 to 96) the cut lands on; 0 = the page's table (80 for frame 26) */
		loopEntry: 0,
		xfadeMs: 80,
		/** the game's car, its front layer and Grandma take the bump this long before the clip enters */
		spriteMs: 33,
		/** the clip frame C enters at */
		entry: 10,
		/** cancel the clip's own 24 road px jump on its frame 2 */
		cancelShove: true,
		/** Grandma's lean on the bump (degrees, forward) and its spring */
		leanDeg: 8,
		leanHz: 12,
		/** the contact star: on screen this long (it pops in over 50 ms, settles by 90, fades from 120) */
		starMs: 260,
	},
	/** THE STRIKE'S END for a Grandma car: the reindeer's feet at the car's rear, as the clip's frame 1 has them
	 *  (road px from the car's bottom centre, mirrored for a car facing left; tools/build_brawl.py reads them from the
	 *  approved page), so two reindeer never show at the hand-over. His last cut runs `across` road px to it (the
	 *  page's), from a run down at that x, kept on the road between `minX` and `maxX`. */
	strike: { across: 125, minX: 60, maxX: 1476 },
	/** THE WIN BEAT */
	win: { fadeInMs: 100, wordAlpha: 0.3, wordEaseMs: 150, staggerMs: 90 },
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

// ---- THE LED BILLBOARD PRESS SCREEN (Corey 2026-11-16, led_billboard_r2_2026-11-16: "That looks amazing"; position on
// round 2: "Yes position is correct"; "Dissolve."; game/landing/ledSign.ts, ledScreens.ts, tools/build_led_art.py) -------
// The screen after the studio splash: the first board stands dimmed behind a roadside LED billboard whose three screens
// cycle (the max win; Santa's sleigh struck; Grandma's car struck), and its ticker says PRESS ANYWHERE TO CONTINUE once
// the game may be entered (the press gate's rules are ui/LandingScreen.svelte's, unchanged). The press powers it down and
// the game is there. LANDING_DIM above is no longer used on this screen (the sign's own dim covers it).
//   layout  per layout, the page's numbers. 'master' units scale with the game (desktop and a phone held sideways: the
//           page's 1440x900 numbers / 1.125, its 844x390 ones / 0.527); 'css' are CSS px (an upright phone, where the page
//           ties the face to the screen's width: 28 px margins, never wider than boardShare of the board, its height
//           between faceH at 620 px tall and faceHTall at 844). The face is centred on the board. pitch: the page's base
//           dot pitch, divided by `density` (Corey's 1.25: desktop 362 x 143 dots, a 362 x 11 ticker, 2.49 CSS px).
//   phone   held sideways: the page's face (540 CSS px at 844x390: 1025 master units) overlapped the left HUD column by
//           about 20 px (its NOTES). Measured in the game at 844x390: the left column's inner edge at 185 CSS px, the
//           right one's at 697, the board's centre at 422. faceW 820 (432 CSS px, 277 dots) leaves the housing 8 px
//           clear of the left column (tools/landing_probe.mjs checks it after the press)
export type LedLayout = { unit: 'master' | 'css'; faceW: number; faceH: number; pitch: number; frame: number; ol: number; pole: number; drift: number; cap: number; margin: number; boardShare: number; faceHTall: number; driftTall: number };
export const LED_SIGN = {
	/** false = the old press screen (the HTML line over the posed board) */
	on: true,
	/** THE PRESS SCREEN ON THE GAME'S OWN LED BOARD (Corey 2026-11-17, approved): true plays the three screens below on the
	 *  scoreboard's expanded back board (the same board, rise, dim and drawing as a big win or a bonus entry: game/scoreboard/),
	 *  PRESS ANYWHERE TO CONTINUE on the strip under it (the strip's top item while the screen is up), the logo sign where it
	 *  sits in the game, and the press lowers the board with its own motion and lifts the dim. false: the separate roadside
	 *  billboard below (game/landing/ledSign.ts, kept). */
	onBoard: true,
	density: 1.25,
	tickerDots: 11,
	/** the dots' content is redrawn and sent to the GPU this many times a second (an LED controller's refresh) */
	fps: 30,
	/** each screen holds holdS, then dissolves into the next over transS (the page's 3.5 and 0.4 s) */
	holdS: 3.5,
	transS: 0.4,
	/** the halo's strength (the half size picture added over the face) */
	halo: 0.3,
	dim: { color: '#040811', alpha: 0.66 },
	/** the grille's tile: cells x cells holes, cellPx each (one canvas, mipmapped) */
	grille: { cells: 16, cellPx: 16 },
	/** THE PRESS (the page's power down): a flicker, the dots out by dotsOutMs, the game's chrome comes up at handOverMs,
	 *  and the sign sinks (sinkShare of the screen's height) and fades from signFromMs to signToMs, then it is unloaded */
	exit: { flickerMs: 160, dotsOutMs: 560, handOverMs: 640, signFromMs: 640, signToMs: 1240, sinkShare: 0.04 },
	text: {
		winTop: 'WIN UP TO',
		sleighHead: "REINDEER HITS SANTA'S SLEIGH",
		sleighBody: 'THE WHOLE COLUMN TURNS WILD WITH A MULTIPLIER',
		sleighMult: '10X',
		carHead: "REINDEER HITS GRANDMA'S CAR",
		carBody: 'HER CAR TURNS WILD WITH A MULTIPLIER',
		carMult: '5X',
		ticker: 'PRESS ANYWHERE TO CONTINUE',
	},
	layout: {
		landscape: { unit: 'master', faceW: 800, faceH: 316.44, pitch: 2.7556, frame: 19.56, ol: 4.44, pole: 26.67, drift: 48, cap: 30.2, margin: 0, boardShare: 1, faceHTall: 0, driftTall: 0 } as LedLayout,
		phone: { unit: 'master', faceW: 820, faceH: 387, pitch: 3.7, frame: 22.77, ol: 5.69, pole: 28.46, drift: 41.75, cap: 32.26, margin: 0, boardShare: 1, faceHTall: 0, driftTall: 0 } as LedLayout,
		portrait: { unit: 'css', faceW: 334, faceH: 218, pitch: 1.62, frame: 12, ol: 3, pole: 17, drift: 30, cap: 17, margin: 28, boardShare: 1.2, faceHTall: 288, driftTall: 34 } as LedLayout,
	},
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
	/** THE ENTRANCE PLAYS WHILE THE BOX GROWS (Corey 2026-11-19: "Is it possible to have the video alreday playing within
	 *  the border boundaries while it grows?"): the entrance clip starts with the grow, each frame cropped to the box as
	 *  it is, and carries on once the box is whole, so a column stands about growMs sooner. false: the entrance's first
	 *  frame stands still in the growing box and the clip starts once the box is whole (until 2026-11-19). */
	entranceWithGrow: true,
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
	/** THE IDLE'S PHASE per reel: each standing column's idle loop runs this much ahead of the one to its left, so two of a
	 *  kind never move as one (625 ms: the 5 frames at 8 fps it was until 2026-11-19; a time, so it holds at any frame
	 *  count: tools/build_columns.py IDLE_STEP) */
	idlePhaseMs: 625,
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

// ---- THE WILD FRAMES: TINSEL GARLAND (game/road/garland.ts, tools/build_garland.py) ------------------------------------
// Corey 2026-11-19, from the wild border mock's seven candidates (Desktop/Run Over Reindeer/wild_borders_r1_2026-11-19):
// "I'd go for Garland (F), but I'd go Red for Santa because it doesn't clash with the Green number", "We should jsut go
// static colors for Reindeer Santa, Grandma for the multipliers and the garland" and "just swap the garland on santa and
// grandma". The frame of a full column Wild, the single cell Grandma Wild and the marked Grandma car is a tinsel garland
// (baked tiles and corners, a glass bauble on each corner) in ONE LOOK PER CHARACTER at every multiplier value (the
// mock's value tiers are off). Its outer edge is where the red box's dark line was (RED_BOX.inset in from the cell, less
// RED_BOX.edge); the band is drawn inward from it. Road px and board ms. The tune panel lists this block (TUNE).
export type GarlandTinsel = 'silver' | 'red' | 'green';
export type GarlandLook = { tinsel: GarlandTinsel; bauble: 'red' | 'gold' };
export const WILD_FRAME = {
	/** each character's tinsel and baubles: one line to change one (Reindeer silver with red baubles against his red
	 *  number, Santa a dark red with gold baubles against his green number, Grandma green with gold against her gold) */
	look: {
		reindeer: { tinsel: 'silver', bauble: 'red' },
		santa: { tinsel: 'red', bauble: 'gold' },
		grandma: { tinsel: 'green', bauble: 'gold' },
	} as Record<'reindeer' | 'santa' | 'grandma', GarlandLook>,
	/** the single cell Grandma Wild's (her set), and the red box's old place on a Grandma car in a struck Santa reel */
	cell: { tinsel: 'green', bauble: 'gold' } as GarlandLook,
	mark: { tinsel: 'green', bauble: 'gold' } as GarlandLook,
	/** THE BAND, road px from the frame's outer edge in (the mock's F): a full column's, and a cell's (the struck cell's box,
	 *  the Grandma Wild, the marked car). A growing box thickens from the cell's to the column's. On a 390 x 844 phone a
	 *  road px is 0.254 CSS px: 6.6 and 5.1 CSS px. */
	band: { col: 26, cell: 20 },
	/** THE BAUBLES: their size against their picture (a column's, a cell's; times the band drawn over its own), set in
	 *  from the corner by half the band plus `inset` x size, hung from their cap */
	bauble: { col: 0.9, cell: 0.78, inset: 4 },
	/** LAND: once the box is whole (a column at the end of its grow, a Grandma Wild as her pop settles) the baubles drop
	 *  in from `dropPx` above, one after the other clockwise from the top left (`staggerMs`), each over `dropMs` */
	land: { dropMs: 200, dropPx: 26, staggerMs: 60, cellDelayMs: 170 },
	/** WIN (a winning line through the Wild): the tinsel flashes itself (its own picture added onto it, `flash` at each
	 *  beat's peak), a soft halo round the frame (`ring`), the baubles swing (`swing` radians, sin(t / swingMs), dying
	 *  over swingDecayMs), `stars` more twinkles for starsMs; two beats `beatMs` long at `beats` */
	win: { beats: [0, 700], beatMs: 600, flash: 0.55, ring: 0.5, swing: 0.3, swingMs: 120, swingDecayMs: 1200, stars: 8, starsMs: 1400, totalMs: 2500 },
	/** IDLE: `stars` twinkles take turns along the band (each `starMs`, `starScale` of the star picture), and the baubles
	 *  sway `sway` radians (sin(t / swayMs)) */
	idle: { stars: 3, starMs: 700, starScale: 0.45, sway: 0.05, swayMs: 700 },
	/** the win's halo: its tint per tinsel, how far it reaches past the frame */
	ring: { tint: { silver: 0xe8f0ff, red: 0xff7080, green: 0x80ffa0 } as Record<GarlandTinsel, number>, out: 28 },
	/** the target crosshair hands over to the frame over this last share of its morph (the crosshair fades, the frame
	 *  comes in under it) */
	crosshairBlend: 0.4,
	/** before the frame atlas is on the GPU: the plain box (the old red box's quads) in the tinsel's own color */
	plain: { silver: 0x9aa4ae, red: 0xb3192b, green: 0x238c3c } as Record<GarlandTinsel, number>,
};

// ---- THE BONUS ROUND'S CARDS AND BEATS (ui/RoundCard.svelte, game/bookEventHandlerMap.ts) -----------------------------
export const ROUND = {
	/** the scatters pulse this long before the intro card */
	triggerPulseMs: 900,
	/** a card continues by itself after this long (a press continues at once); shorter when autoplay runs the bonuses */
	introAutoMs: 4000,
	outroAutoMs: 6000,
	autoplayMs: 1400,
	/** THE BONUS COUNTER PLATES (the blue FREE SPINS 1 OF 10 and red SUPER SPINS signs, ui/TitleSign.svelte) per layout
	 *  class: off since 2026-11-17 (Corey: "Those signs in the upper right should be removed"; the LED strip shows the
	 *  spins left). true shows that class's plate again. Read when the chrome mounts. */
	counterPlate: { landscape: false, portrait: false, phone: false },
	/** the intro waits for the player's press when no autoplay is running (2026-11-17); false: it continues after
	 *  introAutoMs as before (the probes that play a bonus round through without pressing set it) */
	introWaitsForPress: true,
	/** a wrap-up that carries a line (a top-up, the cap) waits for the press too with no autoplay (its line scrolls on the
	 *  LED strip), as long as introWaitsForPress is on */
	lineOutroWaitsForPress: true,
	/** a wrap-up with Autoplay Bonuses running continues this long after its amount has landed (real ms; Manticore
	 *  Mayhem's STINGER_PLAQUE.wrapAutoHoldMs); without the option it waits for the press (2026-11-18) */
	wrapAutoHoldMs: 1000,
	/** a card takes no press for its first moment (a spin press must not skip it) */
	armMs: 450,
	/** the +3 line of a retrigger shows this long */
	retriggerMs: 1100,
	/** the pause between two free spins */
	betweenSpinsMs: 160,
};
/** SKIP TO RESULT'S BUTTON AND PROMPT (components/SkipButton.svelte, 2026-11-19): Manticore Mayhem's SKIP_HUD, its
 *  numbers as they are there (its place is the HUD's own, ui/hud/hudLayout.ts hudSkipRect) */
export const SKIP_HUD = {
	inMs: 220,
	outMs: 120,
	/** the prompt closes by itself after this long with no answer */
	promptMs: 4000,
	/** the glyph's height as a share of the button's height */
	glyphShare: 0.62,
	/** the touch target is grown (invisibly) to at least this, CSS px */
	minHitCss: 44,
	/** the prompt, as shares of the Spin's size on screen, each with a floor in CSS px; Yes and No are at least 52 x 40 */
	prompt: {
		gapCss: 6,
		button: { w: 0.6, h: 0.42, minW: 52, minH: 40 },
		font: { share: 0.15, min: 12 },
		pad: { share: 0.1, min: 8 },
		gap: { share: 0.08, min: 6 },
		/** the question's line box, in ems */
		line: 1.3,
	},
} as const;

/** THE INTRO CARD'S SENTENCE, per bonus round (ui/RoundCard.svelte's HTML card, and the LED strip under the back board while
 *  the entry waits for the press: game/scoreboard/scoreboardDraw.ts showRibbon). One place, so the two never differ. */
export const INTRO_LINE = {
	bonus: 'Every column Wild stays for the whole round and keeps its multiplier.',
	super: 'The wheel shows the column Wild this round starts with. Column Wilds stay and keep their multipliers.',
} as const;

// ---- THE SUPER WHEEL (game/road/superWheel.ts, game/superWheelPlan.ts) ------------------------------------------------
// Corey 2026-11-18 (the approved mock super_wheel_2026-11-18 round 5, his pick "Mc Under the number and P2"): when a Super
// Free Spins round begins, a wheel shows on screen what the book already holds: which character opens the round, its
// multiplier (spin one: the reindeer runs on the rim) and its column (spin two: an inner ring round the hub). One press
// starts both. PRESENTATION ONLY: the stop is the book's own opening column, every other wedge comes from the book's own
// events (game/superWheelPlan.ts), nothing is worked out. Times are ms on the board's clock (regular speed at the entry
// by the stock rule, game/bonusStockRules.ts; a Turbo press or a slam stop speeds them as it speeds the road) unless
// they say real.
/** Autoplay Bonuses on: the wheel starts itself after this long at rest, REAL ms at every speed (Corey: "The wheel should
 *  start it self with autoplay bonuses, but give a player 1-2 seconds to react") */
export const AUTO_BONUS_WAIT_MS = 1500;
export const SUPER_WHEEL = {
	on: true,
	autoWaitMs: AUTO_BONUS_WAIT_MS,
	/** a replay has no Spin key (it is the REPLAY banner): the wheel starts itself there too, after autoWaitMs */
	replayAuto: true,
	/** the wheel's pictures: waited for at most this long at the opening (real ms), then the round goes on without the wheel */
	loadWaitMs: 4000,
	/** ITS PLACE AND SIZE (mock rounds 3 and 4): the top where round 3 put it (sideways and desktop: 0.98 of the board's
	 *  height, its centre `lift` of its diameter above the board's middle; upright: 0.94 of the board's width, its foot
	 *  `lift` of its diameter under the board's bottom edge: the mock's own numbers), the bottom tucked
	 *  behind the LED strip (bottomInset CSS px above its housing's foot), never wider than the screen less screenPad a
	 *  side; the peg keeps its round 3 size about its tip. The string lights are left out under bulbsFromPx of diameter
	 *  (the popout's small wheel, the mock's fallback). */
	size: { boardHeightShare: 0.98, boardWidthShare: 0.94, lift: 0.03, bottomInset: 3, screenPad: 6, bulbsFromPx: 200 },
	/** THE EMERGENCE: the red present's lid pops (lidMs in, the wheel shows), it rises out of the box small and turning
	 *  (riseMs, riseCells of a cell up), then arcs and grows to its place with a small overshoot (growMs, arc of its
	 *  diameter); the traffic drives out trafficAt of the rise in */
	emerge: { lidMs: 850, riseMs: 350, growMs: 900, riseCells: 0.55, arc: 0.18, trafficAt: 0.6, startScale: 0.06, riseScale: 0.12, turnDeg: 240 },
	/** THE READ BEAT: at rest it drifts driftDps degrees a second so each wedge comes upright under the peg; the lights
	 *  chase (one in three dim, lightsStepMs a step); the hub's SPIN tag breathes */
	rest: { driftDps: 4, lightsStepMs: 220, tagPulse: 0.05, tagPulseMs: 1130 },
	/** THE REINDEER: his run in on the road, his leap onto the left shoulder (leapArc of the radius high), his run on the
	 *  rim while the wheel speeds up (driveMs), his leap off backward and his trot out to the left. Where he stands on the
	 *  rim and how his hooves meet it come from tools/build_super_wheel.py (game/superWheelSpec.ts run). */
	run: { runInMs: 550, leapMs: 300, driveMs: 900, leapOffMs: 650, leapArc: 0.35, leapOffArc: 0.25, leapPose: 0.35, leapOffPose: 0.3, trotPose: 0.9, groundY: 0.62, groundClear: 8 },
	/** SPIN ONE: after the drive only a slow-down (an ease out of `power`), decelMs by how far the book's wedge is, one
	 *  more whole turn (extraTurns, round 3) with the last crawlDeg degrees as slow as round 2's; at least minDeg + crawlDeg */
	spin: { decelMs: [2800, 4000] as [number, number], power: 1.9, minDeg: 270, crawlDeg: 135, extraTurns: 1 },
	/** THE STOP: the winner's wedge lifts (liftScale about liftAt wheel units up its middle) and its full shape lights
	 *  under the string lights, landMs; the LED strip names who and the multiplier */
	land: { ms: 800, liftScale: 0.35, liftAt: 240 },
	/** SPIN TWO (P2): the ring of the five columns rises round the hub (inMs), the hub winds back windDeg (windMs) and
	 *  lets go; the ring speeds up (driveMs) and slows (decelMs) onto the book's column, at least minDeg; then land2Ms */
	ring: { inMs: 300, windMs: 200, windDeg: 10, driveMs: 300, decelMs: [1600, 2000] as [number, number], power: 1.9, minDeg: 540, land2Ms: 500 },
	/** the wheel shrinks into the result's column and fades (leaveMs, to leaveScale of its size) */
	leaveMs: 400,
	leaveScale: 0.08,
	/** the game's roaming reindeer is off the screen while the wheel is up (one reindeer: he runs it; game/road/roam.ts
	 *  away, he runs off as it comes out); a new one walks in this long after the opening column has grown (board ms) */
	roamBackMs: 1500,
	/** A PRESS DURING THE SPIN (the slam stop's own press, ui/controls.svelte.ts): the wheel goes straight to the book's
	 *  wedge in slamMs, the ring to the book's column in slamMs; the rest runs at the slam's hurry */
	slamMs: 300,
	/** the top peg: a damped spring the rim's studs push (contact from contactDeg right of the top to releaseDeg left of
	 *  it, pushDeg at most); it never pushes the wheel */
	peg: { stiffness: 520, damping: 15, contactDeg: 9, releaseDeg: 3, pushDeg: 24 },
	/** THE LED STRIP'S WORDS (game/scoreboard/scoreboard.ts wheelLine): plain capitals, no symbol characters */
	text: { emerge: 'SUPER WHEEL', press: 'PRESS SPIN', auto: 'GET READY', go: 'GO REINDEER', column: 'COLUMN', names: { reindeer: 'REINDEER', santa: 'SANTA', grandma: 'GRANDMA' } },
	/** ITS SOUNDS: existing sounds only (none was made for the wheel; the moments still wanting their own are listed in
	 *  the build's notes). null plays nothing. */
	/** tickMinMs (2026-11-19): a tick is one stud passing the peg (8 a turn) or one place of the ring passing its pointer;
	 *  at Super Turbo, in a slam, or on a slow device several pass within a frame or two, and a tick a frame is a buzz. No
	 *  tick starts sooner than this many REAL ms after the one before (twice the hop's audible 30 ms); one due sooner is
	 *  not played. At regular speed the fastest ticks are about 107 ms apart, so every one plays. */
	sound: { lid: null as string | null, traffic: true, press: null as string | null, leapOn: 'sfx_reindeer_dart', tick: 'sfx_target_hop', tickMinMs: 60, land: 'sfx_target_lock', landHigh: 'sfx_multiplier_land_high', landHighFrom: 15, ringIn: 'sfx_present_pop', ringTick: 'sfx_target_hop', land2: 'sfx_target_lock', leave: 'sfx_card_out' },
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

// ---- LANE BY LANE TRAFFIC AND THE SCATTER TEASE (Corey 2026-11-16; game/road/laneFlow.ts, game/road/roadBoard.ts) ------
// Corey's page lane_stagger_mock_2026-11-16.html, whose schedule() this follows, and his numbers read back from it:
// "lane gap 100 ms, drive-in 680 ms, car gap 70 ms, car gap at two seen 360 ms, car gap at three seen 390 ms, clear gap
// 60 ms, 2 stoplights". His words: "we know when we have 2, 3, and 4 scatters before populating the board ... I would
// take this and do the anticipation based off of the reveals of the scatters to the player. Not stopping anticipation
// on 3, because we are still waiting on a possible Super. I also want it looking like actual traffic still."
//   NORMAL FLOW  the four lanes start laneGapMs apart, top lane first. In a lane the LEAD car (the one going farthest)
//                leaves the tunnel first and the others follow carGapMs apart. The lead takes driveInMs from the tunnel
//                to its spot; a car with less far to go takes driveInMs x (shortShare + (1 - shortShare) x its share
//                of the distance), its share (5 - k) / 5 for the k-th car of the lane (the page's 0.55 + 0.45 x share).
//                Each car cruises, then brakes over its last brakeMs (at most brakeShareMax of its drive) into its
//                spot, as the traffic always has (nose down, the rock back: ROAD_MOTION in).
//   SEEN         a scatter counts as seen seenMs after its car leaves the tunnel (clear of the mouth), not when it stops.
//   THE TEASE    from the moment two are seen, each next release (in the normal release order across the lanes) comes
//                at least twoGapMs after the one before; from three seen (Free Spins decided, Super still open) at
//                least threeGapMs. Once the deciding scatter is seen (the fourth in the base game: Super; the third in a
//                feature, where three is the most the math can show: the retrigger) the rest clear through clearGapMs
//                apart. A car already on the road never slows or waits: only the tunnels hold cars back. It runs
//                whenever two are showing and cars remain, whether or not the spin ends up paying.
//   THE CAP      the tease gaps are compressed in proportion when a spin would take longer than capMs from the press to
//                the board at rest (the book in on time: ROAD_MOTION in.delayMs, then the drive in and its settle).
// Every time is on the road's own clock (turbo runs it faster: ROAD_MOTION turbo1 / turbo2 rate). The turbo levels
// below scale the gaps as the old lane and car staggers were scaled (90 / 130 and 55 / 72 at turbo 1; 0 and 26 / 72 at
// turbo 2); at turbo 2 the tease gaps are halved again (turbo2Tease 'half'; 'drop' = no tease at turbo 2). A slam stop
// cuts a live drive in straight to the stopped board (no tease); a spin driving in already hurried has no tease.
export type LaneFlowLevel = { laneGapMs: number; carGapMs: number; clearGapMs: number };
export const LANE_FLOW = {
	/** false = the old convoys (ROAD_MOTION in.laneStaggerMs / carStaggerMs), no tease */
	on: true,
	driveInMs: 680,
	shortShare: 0.55,
	/** the brake at the end of each car's drive, ms (at most brakeShareMax of the drive) */
	brakeMs: 270,
	brakeShareMax: 0.8,
	seenMs: 110,
	normal: { laneGapMs: 100, carGapMs: 70, clearGapMs: 60 } as LaneFlowLevel,
	turbo1: { laneGapMs: 69, carGapMs: 53, clearGapMs: 46 } as LaneFlowLevel,
	turbo2: { laneGapMs: 0, carGapMs: 25, clearGapMs: 22 } as LaneFlowLevel,
	tease: {
		/** false = never a tease (the clear after the deciding scatter still runs) */
		on: true,
		twoGapMs: 360,
		threeGapMs: 390,
		/** at turbo 2: 'half' halves both tease gaps, 'drop' runs no tease */
		turbo2: 'half' as 'half' | 'drop',
		/** in Free Spins and Super: at most one tease per feature round */
		oncePerFeature: true,
	},
	/** the press to the board at rest, road clock ms, never more than this at normal speed: the tease gaps give way */
	capMs: 6500,
	/** what the cap keeps back for the frame the rest is seen on and the last settle's rounding (road clock ms) */
	capPadMs: 40,
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
		/** THE LINE SCHEDULE (Corey 2026-11-16: "I would add acceleration to these hits, progressively for each one", and
		 *  "we should also remove them, there is no need for them all to be up at once"; his timing page
		 *  win_line_timing.html, whose schedule() this follows: game/road/winLights.ts lightsSchedule). Each line has three
		 *  phases: STRINGING (its wire draws in, bulbs lighting as it reaches them), LIT (the chase), COMING DOWN (the
		 *  lights go out and the wire retracts from the line's start toward its end over takeDownMs, its amount fading
		 *  with it). Line i starts at the sum of the gaps before it: the first gap staggerMs, each next gap gapRatio times
		 *  the one before, never under gapFloorMs. Line i strings over drawMs x gapRatio^i, never under drawFloorMs.
		 *  WHEN A LINE COMES DOWN (downMode): 'next' as the next line starts, never before it is fully strung (the last
		 *  line stays lit stayLitMs); 'hold' (his pick) each after its own stayLitMs; 'end' all together stayLitMs after
		 *  the last is strung. The total follows when the last light is down. A one line win keeps its line up with the total (its
		 *  amount is the total) until the win goes. All real ms at normal speed, times holdShare for the turbo level (a
		 *  slam's hurry runs the win clock 3x). Every number here is live (TUNE.lineWin.lights): read when a win starts. */
		//   Corey's numbers (2026-11-16, read back from the page): "first gap 470 ms, acceleration 60%, shortest gap 220 ms,
		//   string 500 to 450 ms, stay lit 1000 ms, take down 650 ms, each holds": gaps 470, 282, then 220; strings 500,
		//   then 450
		staggerMs: 470,
		gapRatio: 0.6,
		gapFloorMs: 220,
		drawMs: 500,
		drawFloorMs: 450,
		stayLitMs: 1000,
		takeDownMs: 650,
		downMode: 'hold' as 'next' | 'hold' | 'end',
		/** a winning symbol pulses only while a line through it is up; true: they also pulse under the total after the
		 *  lines (the old way) */
		pulseWithTotal: false,
		/** THE LINE SHOW over the accelerating lines (constants REINDEER_SOUND lineShow): each line's play is rateStep
		 *  faster than the one before (a play's own rate, as the crosshair's hops; no filter), up to rateMax; and when a
		 *  line starts while the last line's show is still sounding (lengthMs of the clip, shortened by its rate: at turbo,
		 *  and in a slam's hurry) that one is stopped as this one starts, so one voice only */
		sound: { rateStep: 0.03, rateMax: 1.3, lengthMs: 197, oneVoice: true },
		/** each span between two winning symbols droops this many road px at its middle */
		sag: 38,
		/** the wire, road px: its outline's full width, its core's, and how finely a span is cut into straight quads (the
		 *  nail's baked wrap, tools/build_win_lights.py, is drawn for 14 and 6 and these colors) */
		wire: { outline: 14, core: 6, outlineColor: 0x0b0c0f, coreColor: 0x1f5c36, segmentsPerSpan: 14 },
		/** THE WIRE'S ENDS (Corey 2026-11-18, the tips mock win_line_tips_2026-11-18, his pick "T2 Nail"; a tester: "the ends
		 *  of them are just squared off, which looks weird especially over wild"): each end of a line's wire wraps once
		 *  round a nail (the sheet's nail frame: the wrap and the head in one picture, not tinted). The wire ends where it
		 *  meets the wrap tangentially on its lower side. `end`: 'edge' puts the nail just past the first and the last
		 *  winning symbol's outer edge (its drawn half width, or a Wild box's, plus edgeGap road px), 'center' on the
		 *  symbol's centre (where the wire ended before). One nail per symbol end, shared by every line that starts (or
		 *  ends) there: it pops in with the first of them (popMs, from popFrom, the bulbs' back-out) and leaves with the
		 *  last (outMs): a start nail as its line starts coming down, an end nail as its line's last wire goes. */
		tips: { on: true, end: 'edge' as 'center' | 'edge', edgeGap: 15, popMs: 110, popFrom: 0.3, outMs: 110 },
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
		 *  it would touch an amount already up). It fades as its line comes down (the line schedule above). */
		amount: { size: 52, fill: 0xffd400, stroke: 0x101216, strokeWidth: 10, popMs: 160, swell: 0.35, pad: 6 },
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
	/** LINE WINS, TREATMENT B (Corey 2026-11-17, approved from the live mock line_win_slam_mock_2026-11-17; game/road/winLights.ts).
	 *  The old display read like "35x $399.50" and misled. Now each winning line shows its PLAIN amount (the paytable win, the
	 *  book's win / multiplier) in white; then that line's own multiplier, in the column's yellow digits, pops in beside it, the
	 *  two sit together, squash into each other, and the amount punches out as the line's win (the book's). A line with
	 *  multiplier 1 shows its amount alone (no multiplier, no slam). No total over the board: the strip carries the spin's
	 *  total, counting up, with no multiplier on it (a big win counts on the strip and the back board after the lines, as
	 *  before). His settings, read back from the mock: {"treatment":"B","perLineLitMs":1250,"slamStrength":0.6,
	 *  "lines":"staggered","stripTotal":"count","beatsAtNormalMs":{"plain":140,"side":160,"both":120,"squash":190,"pop":260}}.
	 *    THE SCHEDULE  the lines start and string as the lights' schedule above; each stays lit perLineLitMs (not stayLitMs),
	 *                  then comes down over takeDownMs. The strip's total comes as the last line starts to come down (one
	 *                  line: as its slam lands, or its amount's pop without one) and holds holdMs; every time x holdShare at a
	 *                  turbo level, and on the win clock (a slam stop's hurry runs it 3x). The beats scale with the lit time
	 *                  (x perLineLitMs / 1000; a one line win at x1).
	 *    THE PHONE     (the upright phone; the mock's round 2 phone rule) the amounts are sized so their digit cap is
	 *                  phone.capPx CSS px, at most 3 are up at once (lines phone.capPx apart: (lit + 200) / 3), the lit time
	 *                  shrinks so the lines still end at today's line time (the win lasts as long as today's), the beats
	 *                  shrink with it keeping phone.readMs to read the line's win; an amount on the top lane line is nudged
	 *                  down so its top stays phone.topClearRoad road px under that line (the tunnel top no longer clips it).
	 *  Plain pictures only (Text, the atlas digits tinted, transforms and alpha): no filter, shader or mask. */
	slam: {
		/** false: the lines and the total over the board as before (the x multiplier over it) */
		on: true,
		treatment: 'B' as const,
		perLineLitMs: 1250,
		/** how hard the squash and the punch are (the mock's slider: 0 none, 1 full) */
		strength: 0.6,
		lines: 'staggered' as const,
		/** the strip's total: 'count' counts up over stripCountMs (x holdShare), 'appear' shows it at once */
		stripTotal: 'count' as 'count' | 'appear',
		stripCountMs: 600,
		/** the beats at a 1000 ms lit time, ms: the plain amount alone, the multiplier pops in beside it, the two together, the
		 *  squash into each other, the line's win punching out */
		beats: { plain: 140, side: 160, both: 120, squash: 190, pop: 260 },
		/** the amount white with the game's dark edge (the lights' amount size and edge), the multiplier the column's yellow
		 *  digits at the same cap height (the digit face is faceShare of the atlas frame), gap road px between them; at the
		 *  punch the amount flashes halfway to yellow (flashTint) and back */
		amountFill: 0xffffff,
		multTint: 0xffd400,
		flashTint: 0xffea80,
		capRatio: 0.7,
		faceShare: 228 / 286,
		gap: 14,
		/** the soft dark shadow under both (no blur): under the amount a wide dark stroke (extra road px wider than its edge)
		 *  at `alpha`, dropped dy road px; under the multiplier two black copies of its digits, `grow` larger, at `alphas`,
		 *  dropped `drops` road px */
		shadow: { alpha: 0.3, extra: 16, dy: 6.5, grow: [1.12, 1.05], alphas: [0.22, 0.32], drops: [4, 3] },
		/** maxUp amounts at once, an amount counting as up until downWindowMs into its take down (it is faint by then) */
		phone: { on: true, capPx: 18, readMs: 350, topClearRoad: 10, maxUp: 3, downWindowMs: 200 },
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
	//              PASS 5 (2026-11-16): at normal speed and turbo 1 a reel's stop SOUND never comes before the one of
	//              the reel to its left (at turbo 1 reels 1 and 2 are planned about 9 ms apart, and a wide or narrow
	//              front car could put reel 2 a few ms first): it waits those few ms, so the order is always left to
	//              right. At turbo 2 the five stops are one moment (all within about 20 ms): ONE sound for it, the
	//              first reel to stop (`reelStopTurbo2`), as the house thins its reel stop at turbo (Angry Mantis plays
	//              its reel stop once while it is still sounding at turbo; Manticore once per board).
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
	//   column in  each character's entrance on frame `columnIn.frame[tier]` of its 31 (source frame 57; 5 of 16 at 12 fps
	//              until 2026-11-19, the same moment): the first frame it stands in full
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
	/** PASS 7 (2026-11-16, LANE_FLOW): ONE STOP SOUND PER LANE, lane 1 (the top) to lane 4, on the frame that lane's last
	 *  car reaches its stop point, sfx_lane_stop_1..4 (rising a semitone each). With the lanes 100 ms apart a lane's five
	 *  cars stop within about 35 ms, and every reel's last car is in the bottom lane, so the five reels would stop within
	 *  about 35 ms of each other: five sounds in a flam. The turbo 2 rule below is kept (one sound per spin), and a slam
	 *  stop's cut (every lane at once) sounds once by the same rule. (sfx_lane_stop_5 stays in the sprite, unused.) */
	reelStops: ['sfx_lane_stop_1', 'sfx_lane_stop_2', 'sfx_lane_stop_3', 'sfx_lane_stop_4', 'sfx_lane_stop_5'],
	/** THE SCATTER TEASE (constants LANE_FLOW): sfx_scatter_tease, a 2.0 s loop, from the frame the tease begins (the
	 *  second scatter seen with cars still in the tunnels). At three seen (Free Spins decided, Super still open) the same
	 *  loop steps up: its rate goes to `rateAtThree` (+2 semitones, faster), no restart, no gap. It stops with a
	 *  fadeMs fade when the tease is over (the deciding scatter seen, or the last car seen), at once (8 ms) on a slam
	 *  stop's cut, under SKIP TO RESULT and when the board goes. */
	tease: { name: 'sfx_scatter_tease', rateAtThree: 1.122, fadeMs: 140 },
	/** THE HOUSE SCATTER LANDINGS (pass 8, Corey: "use the same sounds as Angry Mantis and Manticore Unleashed for Scatter
	 *  and Entry sounds"): the house family, the same files as Angry Mantis and Manticore (the sprite's house set), one per
	 *  scatter on the frame it is SEEN (LANE_FLOW seenMs after its car leaves the tunnel, the tease's own moment): the
	 *  spin's 1st scatter names[0], the 2nd names[1] and so on, rising (the base game shows at most 5, a free spin 3). A
	 *  slam stop's cut sounds the ones not yet played ONCE together: the rung of the spin's whole count, on the cut's
	 *  frame. Dropped under SKIP TO RESULT (components/Sound.svelte drops every one-shot then).
	 *  Since 2026-11-17 the MARIMBA FAMILY (Corey's cross-game standard, the same files as Manticore's): eight notes on a
	 *  rising scale, the spin's Nth present plays names[N - 1] for N = 1..8; the moments and the slam stop rule above are
	 *  unchanged. Its success, sfx_scatter_success, is the trigger's sound (game/bookEventHandlerMap.ts). */
	scatterLand: { names: ['sfx_scatter_land_1', 'sfx_scatter_land_2', 'sfx_scatter_land_3', 'sfx_scatter_land_4', 'sfx_scatter_land_5', 'sfx_scatter_land_6', 'sfx_scatter_land_7', 'sfx_scatter_land_8'] },
	/** TURBO 2's reel stop (pass 5): a reel's stop within gapMs (real ms) of the last reel stop sound is silent (the five
	 *  land within about 20 ms, so one sound per spin), and one still sounding from the spin before (Super's spins come
	 *  about 450 ms apart, the sound is 454 ms) is stopped as the next starts, so it never plays twice at once */
	reelStopTurbo2: { gapMs: 100 },
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
	columnIn: { frame: { reindeer: 10, santa: 10, grandma: 10 } as Record<'reindeer' | 'santa' | 'grandma', number> },
	/** the present's pop starts on this frame of the open (0 = its first; round 2 started it on PRESENT_LID_FRAME, 3): on
	 *  the first frame the open DRAWS, whichever of its slots that is on a slow frame. Pass 5: when the open's pictures
	 *  are not in time and the trigger pulses instead, the pop comes on the pulse's first frame */
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
	 *  from the camera; 90 = flat along the road to the left). PASS 6 (Corey 2026-11-16: "it should go higher up ... the
	 *  amount to the left seems appropriate"): the top of a thing used to land 0.90 of its height to the left and 0.44
	 *  up (64 degrees, length 1); it now lands at the same 0.90 to the left and 0.78 up: angle atan(0.90 / 0.78) = 49,
	 *  length hypot(0.90, 0.78) = 1.19 (re-derived, not scaled) */
	angle: 49,
	/** how long it is: the owner's top lands this share of the owner's own height away from its ground point, along the
	 *  lean (at 49 degrees and 1.19: 0.90 of its height to the left and 0.78 up) */
	length: 1.19,
	/** how dark: the twin's alpha. The asphalt is about rgb 50 56 64. PASS 6 ("now it's too dark"): 0.8 took it to
	 *  about 10 11 13; the candidates were 0.45, 0.55 and 0.65 (the sheet in pass6_2026-11-16/shadows/); 0.55, the
	 *  middle one, takes it to about 23 25 29 */
	alpha: 0.55,
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
// 2026-11-19 (Corey: "some things never got done, the flashlights on the Oh Kay Van, the backfire, on the win"): it
// always fired, but at its first numbers it was too small and too faint to notice at play size (a van is about 100 CSS
// px wide on a 1440 x 900 desktop and 33 on an upright phone, its windows a fifth of that, and the win line's wire and
// bulbs cross them). Same design, made readable: the puff 40 to 70 road px with a darker edge (tools/build_van_win.py)
// and three of them, the rocking and the lurch stronger, the beam wider and steadier, each glow drawn twice (layers).
// Before: lurch 2.4 deg / 5 px, puffs [20, 140] of 40 px to 1.2 over 620 ms, rock 2.2 deg / 0.018, light width 0.34,
// sweep 900 ms, flicker 0.35, ramp 140 ms, one layer.
export const VAN_WIN = {
	/** false = the van does nothing in a win */
	on: true,
	/** the lurch and the backfire, then the rocking and the flashlight */
	lurchMs: 300,
	/** THE LURCH: a damped spring. The nose lifts about the rear wheel by up to squatDeg (the rear squats), the body
	 *  jolts forward by up to joltPx; one bounce back (periodMs) and it settles (decayMs) */
	lurch: { squatDeg: 3.2, joltPx: 8, periodMs: 280, decayMs: 120 },
	/** THE BACKFIRE: one puff from the exhaust at each of these ms */
	puffs: [20, 120, 230],
	/** each puff: its width (road px) grows from `from` to `to` times `size` over lifeMs while it drifts `back` road px
	 *  backward (it starts `out` behind the bumper) and `rise` up; it comes in over inMs and fades out */
	puff: { size: 70, from: 0.5, to: 1.35, lifeMs: 820, back: 64, out: 8, rise: 52, inMs: 40, alpha: 1 },
	/** THE ROCKING: a lean (skew) up to leanDeg and a bounce of the body's height, about the wheel line, period
	 *  periodMs, coming in over rampMs */
	rock: { leanDeg: 3.2, bounce: 0.028, periodMs: 520, rampMs: 80 },
	/** THE FLASHLIGHT: warm, added; a beam `width` (a share of the slots) wide sweeps across the windows' slots and back
	 *  every sweepMs and flickers (down by up to `flicker`, a new draw every flickerMs). fill: each glow's width against
	 *  twice the glass's depth at its slot: the soft blob's outer quarter is all but clear, so 1.25 keeps its visible
	 *  light on the glass (the van probe checks it against the measured depth). layers: each glow drawn this many times
	 *  over itself (added: brighter, never wider) */
	light: { tint: 0xfff0c8, alpha: 1, width: 0.6, sweepMs: 1100, flicker: 0.18, flickerMs: 60, fill: 1.25, layers: 2 },
};

// ---- THE SIGN WINS (Corey 2026-11-19, the mock sign_wins_r1_2026-11-19 and his settings from its "Copy my settings":
// {"cand":3,"layout":"field","gColor":"face","pivot":"ground","beat":"back","pulse":"on","land":"hinged","idle":"both",
// "stagger":true,"g":{"bloom":4.5,"intensity":1.5,"size":1.25,"width":22,"ms":420,"sweeps":2,"rest":0.1,"sparkle":1,
// "bolts":1.1},"a":{"rock":3.5,"freq":2.4,"damp":420,"deco":1,"snow":1,"flakes":4,"shudder":1,"letter":0},
// "l_flakes":2}; then "the 10 needs sepearate settings because it's already white, so the honeycome doesn't show up well
// here"; game/road/signRig.ts, tools/sign_layers.py) -----------------------------------------------------------------------
// The five road signs (L1..L5: A K Q J 10) draw as a rig of layers cut from their flattened art: the post, the plate (the
// body, the letter and the bolts as one picture), the snow cap and the decorations (the 10's holly, the J's candy cane,
// the Q's four bulbs, the K's bell, the A's mistletoe). The flattened frames stay in the atlas (through traffic, the cast
// shadows, the rules page pictures).
//   THE WIN (candidate 3, both): the whole sign bends at the road on a damped spring, each decoration swings its own way,
//   the snow cap lags and sheds flakes, the plate shudders, and a band of light sweeps a honeycomb of round reflectors
//   (each a lens tinted from the face in normal blend with a glow added; never on the letter, the rim or the bolts) and
//   catches the bolts, timed to cross the face on the swing back. Each sign goes off as its line's wire reaches it.
//   Today's pulse (LINE_WIN.pulseScale) stays on top.
//   THE LANDING (hinged): the plate tips on its post as the sign brakes and rocks back; the decorations and the snow keep
//   going after it stops, and two flakes fall.
//   THE IDLE: one sign at a time, every 7 to 12 s while the board is idle (game/boardIdle.ts): a slow glint and a small
//   twitch of its decoration.
// Sprites, transforms, alpha, tint and additive blend only: no filter, mask, shader or blur (the glow, lens, ring, sparkle
// and flakes are baked pictures, tools/sign_layers.py). Every ms is at normal speed: a win's are times LINE_WIN.holdShare
// (the turbo level) on the win clock (a slam stop's hurry runs it 3x); the landing's run on the board clock (turbo and the
// hurry); the idle's are real ms. Angles in degrees, lengths in road px at the sign's built size. The mock's names are
// kept in the comments (g.*, a.*, l_flakes) so his copied settings read straight across.
export const SIGN_WIN = {
	/** false: the signs draw as their flattened frames, today's pulse only */
	on: true,
	/** the win's candidate (cand): 0 today's pulse only, 1 the glint, 2 the motion, 3 both (his pick) */
	cand: 3 as 0 | 1 | 2 | 3,
	/** (stagger) each sign goes off as its line's wire reaches it; false: every sign of a line as the line starts */
	stagger: true,
	/** a sign in two lines goes off again as the later line's wire reaches it, if its last show is over */
	replay: true,
	/** (pulse) today's swell while a line through the sign is up: 'on' LINE_WIN.pulseScale as today (his pick), 'soft'
	 *  pulseSoft, 'off' none */
	pulse: 'on' as 'off' | 'soft' | 'on',
	pulseSoft: 1.05,
	/** (land) 'hinged': the plate tips on its post and the decorations lag (his pick); 'today': the whole sign tips */
	land: 'hinged' as 'today' | 'hinged',
	/** (idle) 'both' (his pick), 'glint', 'twitch' or 'off' */
	idle: 'both' as 'glint' | 'twitch' | 'both' | 'off',
	/** a show is over this long after it starts (the motion has died away) */
	showMs: 2000,
	/** THE GLINT (g.*): the reflectors' layout ('field' the honeycomb, his pick; 'ring' the border ring; 'sparse' six big
	 *  ones), their color from the face ('face', his pick; 'white'; 'ice'). intensity: the light's strength (the lens
	 *  reaches full at 0.91, the glow at 1.11); size: the dot radius times the layout's own; bloom: the glow's width in
	 *  dot radii; width: the band's half width along the sweep (road px); ms: one sweep's length; sweeps: 1 or 2 (the
	 *  second secondGapMs after the first, at secondAmp); rest: the reflectors seen at rest (baked into the four colored
	 *  plates at 0.1 by tools/sign_layers.py REST_BAKE: this value only moves the 10's); sparkle: the two star flashes;
	 *  bolts: the bolt heads' glint. The band sweeps along sweepDir (down and to the right). Colors (face): the lens is the
	 *  face mixed litMix toward white, the glow glowMix toward white, the rest restDarken toward black. */
	glint: {
		layout: 'field' as 'ring' | 'field' | 'sparse',
		color: 'face' as 'face' | 'white' | 'ice',
		bloom: 4.5,
		intensity: 1.5,
		size: 1.25,
		width: 22,
		ms: 420,
		sweeps: 2,
		rest: 0.1,
		sparkle: 1,
		bolts: 1.1,
		sweepDir: [0.8, 0.6] as [number, number],
		secondGapMs: 160,
		secondAmp: 0.6,
		litMix: 0.62,
		glowMix: 0.45,
		restDarken: 0.14,
		/** the bolt heads: a warm glow this wide (road px, grows by 0.4 of it with the light) and a star this wide */
		boltGlow: 16,
		boltTint: 0xfffaeb,
		boltSparkle: 14,
		/** the two star flashes on the reflectors farthest down right and up left: this wide (grows with the light), from
		 *  this much light */
		sparkleSize: 22,
		sparkleFrom: 0.3,
	},
	/** THE MOTION (a.*): rock (degrees, the damped spring's first swing; each sign times jitter, 0.88 to 1.12), freq (its
	 *  Hz), damp (its decay ms); pivot 'ground' the whole sign bends at the road (his pick), 'post' the plate rocks on its
	 *  post; beat: the glint crosses the face on the 'lean', the swing 'back' (his pick) or the 'settle'; deco: the
	 *  decorations' swing (times the table below); snow: the cap's lag (snowLag of the plate's swing snowLagMs behind it)
	 *  and squash (snowSquash, over snowSquashMs); flakes: how many it sheds (on the first swing's peak); shudder: the
	 *  plate's side shake (shudderPx, the K's bell shakes it shudderBell, at shudderHz over shudderMs); letter: the letter's
	 *  pop (fixed at 0: the letter is baked into the plate) */
	alive: {
		rock: 3.5,
		freq: 2.4,
		damp: 420,
		deco: 1,
		snow: 1,
		flakes: 4,
		shudder: 1,
		letter: 0,
		pivot: 'ground' as 'ground' | 'post',
		beat: 'back' as 'lean' | 'back' | 'settle',
		jitter: [0.88, 0.24] as [number, number],
		snowLag: 0.45,
		snowLagMs: 70,
		snowSquash: 0.035,
		snowSquashMs: 260,
		shudderPx: 0.45,
		shudderBell: 1.3,
		shudderHz: 24,
		shudderMs: 120,
	},
	/** EACH DECORATION'S SWING (times alive.deco): degrees, decay ms, Hz, phase (radians), and how much of the plate's
	 *  swing it turns back against (it hangs). The cane taps (one side only); the bulbs also chase: each flares in turn
	 *  (chaseMs apart, flareMs long, again againMs later at again), drawn added over itself (flareAlpha) with a glow of
	 *  its color mixed glowMix toward white (glowSize road px, glowAlpha) */
	deco: {
		holly: { deg: 4, ms: 450, hz: 3.1, phase: 0.5, counter: 0.5 },
		cane: { deg: 6.5, ms: 330, hz: 2.8, phase: 0, counter: 0 },
		bell: { deg: 17, ms: 620, hz: 1.9, phase: 0, counter: 0.9 },
		mistletoe: { deg: 6, ms: 650, hz: 1.6, phase: 0, counter: 0.7 },
		bulb: { deg: 6, ms: 520, hz: 3.3, phaseStep: 0.9, counter: 0.6, chaseMs: 115, flareMs: 230, againMs: 560, again: 0.8, flareAlpha: 0.8, glowSize: 26, glowAlpha: 0.85, glowMix: 0.25 },
	},
	/** THE LANDING (land 'hinged'): the plate tips by hinge times the drive's own dive (constants ROAD_MOTION in), the snow
	 *  cap back against it (snow times alive.snow); the decorations keep going from the stop at `amount` of a win's swing
	 *  (no rock; the bulbs' flare at bulbs), for ms; flakes (l_flakes) fall as it stops */
	landing: { hinge: 2.2, snow: 0.4, amount: 0.55, bulbs: 0.35, flakes: 2, ms: 3500 },
	/** THE IDLE: one sign every everyMs plus up to everyRandMs (real ms) while the board is idle; its glint one sweep of
	 *  glintMs at glintAmp; its twitch at `amount` of a win's swing with the rock at rockShare of min(rock, rockMax), the
	 *  bulbs' flare at bulbs; over after ms */
	idleShow: { everyMs: 7000, everyRandMs: 5000, glintMs: 900, glintAmp: 0.5, amount: 0.4, rockShare: 0.25, rockMax: 3.5, bulbs: 0.6, ms: 3000 },
	/** THE FLAKES: each falls from a random point of the snow cap's lower edge, out to the side at vx (plus or minus
	 *  vxRand / 2) and up at vy (to vy + vyRand), under gravity (road px per s per s), radius r to r + rRand, life lifeMs to
	 *  lifeMs + lifeRandMs, fading from fadeFrom of its life; at most `max` in the air per sign */
	flakes: { gravity: 520, vx: 18, vxRand: 40, vy: -10, vyRand: -25, r: 1.6, rRand: 1.3, lifeMs: 650, lifeRandMs: 300, fadeFrom: 0.6, max: 12 },
	/** THE 10 (white SPEED LIMIT sign): the honeycomb does not read on white (additive light shows nothing on it, and the
	 *  four signs' honeycomb fits only 10 reflectors between its letters). Its own look, one of tenStyles (shown side by
	 *  side on the mock page's "10 options" switch): 'a' Ringed, 'b' Border, 'c' Dense, or 'off' (the ice look of his
	 *  tuned settings). The same band, sweep, bolts and sparkles as the other four; only its reflectors differ. THE PICK
	 *  IS THIS ONE LINE. */
	ten: 'a' as 'off' | 'a' | 'b' | 'c',
	/** each 10 look: its dot set (tools/sign_layers.py TEN_DOTS: 'dense' 31 smaller reflectors, 'denseBig' 28 slightly
	 *  larger, 'field' the four signs' 10), its reflectors at rest (the lens or the ring picture, tint, alpha), the lit
	 *  lens's tint, a halo (the glow in NORMAL blend: it shows on white; tint, alpha, width in dot radii), a shadow leading
	 *  the light (the lens darkened; tint, alpha, lead: how far ahead of the band in band widths), a glow added (tint;
	 *  shows on the black only), and the border band (option b: the glow added on the black border ring's points, tint,
	 *  alpha, size road px) */
	tenStyles: {
		off: { layout: 'field', rest: { tex: 'lens', tint: 0xc4cedc, alpha: -1 }, lit: 0x80c4ff, halo: null, shadow: null, glow: 0x96d2ff, band: null },
		a: { layout: 'dense', rest: { tex: 'ring', tint: 0x7088a8, alpha: 0.75 }, lit: 0xb2deff, halo: { tint: 0x78beff, alpha: 0.5, bloom: 4 }, shadow: null, glow: null, band: null },
		b: { layout: 'dense', rest: { tex: 'lens', tint: 0xced3dc, alpha: 0.55 }, lit: 0xa8d4ff, halo: null, shadow: null, glow: null, band: { tint: 0x96d7ff, alpha: 1, size: 12 } },
		c: { layout: 'denseBig', rest: { tex: 'lens', tint: 0xc4cedc, alpha: 0.1 }, lit: 0x96c8ff, halo: { tint: 0x96cdff, alpha: 0.6, bloom: 6 }, shadow: { tint: 0x5c6c86, alpha: 0.55, lead: 1.1 }, glow: null, band: null },
	} as Record<'off' | 'a' | 'b' | 'c', TenStyle>,
};

/** one look of the 10's reflectors (SIGN_WIN.tenStyles); rest alpha -1: glint.rest */
export type TenStyle = {
	layout: 'field' | 'dense' | 'denseBig';
	rest: { tex: 'lens' | 'ring'; tint: number; alpha: number } | null;
	lit: number;
	halo: { tint: number; alpha: number; bloom: number } | null;
	shadow: { tint: number; alpha: number; lead: number } | null;
	glow: number | null;
	band: { tint: number; alpha: number; size: number } | null;
};

// ---- THE CHRISTMAS TREE ON THE STATION WAGON (Corey 2026-11-16: "Yes this one looks good."; game/road/wagonTree.ts,
// tools/build_wagon_tree.py, the round 4 art and its NOTES.md) ---------------------------------------------------------
// Every wagon (H2) carries the tree tied to its roof rack, both directions, parked and in through traffic. Over the wagon:
// the tree, the front rail, the ropes. The tree is cut into vertical strips (no mesh in the game; no filter, shader or
// mask) and bent by TWO DAMPED SPRINGS driven by the wagon's own forward acceleration on the board's clock (so turbo and a
// slam stop run the same motion faster). Corey: "Only the tip of the tree that hangs over the windshield should have the
// aggressive dip, the rest of it should move a little, not a lot." So:
//   tip   past the first rope, weighted ((x - rope) / (tip - rope))^2.2: dips hard on a stop, lifts on a pull-away
//   body  between the ropes (a half sine, 0 under each rope), and a small seesaw behind the last rope
// Nothing moves under a rope; the ropes and the rail never move. Target = acceleration (road px/s^2) x gain, clamped; the
// travel is the spring's (peak about 11.3 road px at the tip, 1.2 for the body, with the game's own BASE_MOTION).
export const WAGON_TREE = {
	/** false = the wagons drive without the tree */
	on: true,
	/** false = the tree rides stiff (no bend) */
	bend: true,
	tip: { freqHz: 2.8, damping: 0.4, gain: 0.00105, clamp: 9 },
	body: { freqHz: 3.6, damping: 0.5, gain: 0.00012, clamp: 1, shift: 0.5 },
	/** the tree's and the ropes' silhouette above the roof joins the wagon's cast shadow */
	shadow: true,
};

// ---- THE SEATED DRIVERS (Corey 2026-11-16; game/road/seated.ts, tools/build_seated.py, tools/seated_split.json) -------
// Grandma at the wheel of every Grandma car (H1) and Santa in every sleigh (W), both directions, drawn between the
// vehicle (its own sprite, the back layer) and its near door or sleigh wall (the front layer, cut from the same sprite by
// script), so the door covers them from the waist down. The locked stills, resampled only; the left facing vehicles draw
// them mirrored. Code motion only: a LEAN about the hip (back on a pull-away, forward on a stop: a damped spring on the
// vehicle's forward acceleration, as the wagon's tree) and a BOB up with the win pulse. They go with their vehicle:
// hidden in a tunnel, under a cloud or a column, struck, retired. place: Corey's live nudges per vehicle frame, on top of
// the built placement (dx, dy road px; scale x the built height). After nudging, paste the numbers into
// tools/seated_split.json and run tools/build_seated.py so the front layer and the shadow silhouette are cut for them.
export const SEATED = {
	/** false = the vehicles drive empty, as before */
	on: true,
	/** the lean: + leans forward on a stop (deg at the target), back on a pull-away */
	lean: { freqHz: 2.4, damping: 0.45, gainDeg: 0.0004, clampDeg: 3.5 },
	/** the share of that lean each driver takes (pass 6, Corey 2026-11-16: Grandma's fists stay on the wheel): she turns
	 *  about her hip, and her fists are about 60 road px from it, so the full 4.2 degrees moved them 4.4 road px off the
	 *  rim; at 0.3 they move about 1.3 (the wheel's rim is about 4 road px thick). Santa has nothing to hold. */
	leanShare: { grandma: 0.3, santa: 1 } as Record<string, number>,
	/** the win bob: up this many road px at the top of each win pulse */
	bob: { px: 3.5 },
	/** the driver's silhouette above the vehicle joins its cast shadow */
	shadow: true,
	/** THE ANIMATIONS (pass 7, Corey: "Not staying with the stills"; tools/build_seated_clips.py, game/road/seatedClips.ts):
	 *  an idle (a 4.0 s loop at 6 fps) while the vehicle stands at rest, a win reaction (4.0 s at 8 fps, once) when a line
	 *  win runs through it, the head an animated patch over the still's body. Each sheet loads when needed: the idle while
	 *  a vehicle of its character is at rest (kept idleKeepMs after the last one left), the win when a win with it starts
	 *  (let go winKeepMs after). on: false = the stills only, as before. */
	clips: { on: true, idleKeepMs: 20000, winKeepMs: 600 },
	place: {
		// (pass 6: Grandma 12 road px higher and 6 percent larger, fists on the rim; Santa 16 back, centered in the
		// sleigh: baked into tools/seated_split.json, so these stay 0. Scene pass 9, 2026-11-16: Corey's live nudges from
		// staging, H1_R dx +2 dy -9.5 scale 0.98 and W_R dx +21 dy -18.5, with the left frames mirrored (dx sign flipped),
		// baked into tools/seated_split.json the same way)
		H1_R: { dx: 0, dy: 0, scale: 1 },
		H1_L: { dx: 0, dy: 0, scale: 1 },
		W_R: { dx: 0, dy: 0, scale: 1 },
		W_L: { dx: 0, dy: 0, scale: 1 },
	} as Record<string, { dx: number; dy: number; scale: number }>,
};

// ---- THE BRAKE LIGHTS (Corey 2026-11-16: "we need to give the different cars brake lights in code when they are slowing
// down and stopped"; game/road/brakeLights.ts, tools/build_brake_lights.py, game/brakeLightSpec.ts) --------------------
// Grandma's car, the wagon, the van and the police car (not the sleigh, not the signs) light their rear lamps: BRIGHT
// while braking into the spot, DIM while stopped (the rock back and at rest), OFF while cruising in and pulling away.
// Each lamp is the stoplights' soft blob, tinted and added (no filter), with a small hot core; both follow the car's
// place, dive, win pulse, brightness (the tunnel's shade, the win's dim) and hide with it. Sizes road px at the built
// size. The art shows one lamp per side (the near one); the second is the far lamp, peeking at the rear edge.
export const BRAKE_LIGHTS = {
	on: true,
	tint: 0xff2a1a,
	coreTint: 0xffc2b0,
	/** the glow's width per lamp (road px), its squash (height against width). Corey's tuned numbers (pass 8,
	 *  brake_light_halo_mock_2026-11-16.html read back): glow 46, squash 85%, core 15 */
	glow: { size: 46, squash: 0.85 },
	core: { size: 15 },
	/** THE HALO (pass 8, Corey: "if the bracklights had some halo glow effect, it would still work to look like brake
	 *  lights on grandma's car"): a soft red blob behind each lamp, the same glow texture tinted and added (no filter,
	 *  shader, mask or blur). size road px wide, squash its height against its width (the page's 0.8); brake / stopped
	 *  its alpha while braking and while stopped. The far lamp's halo is drawn UNDER the car (over its cast shadow), so the body covers its forward half.
	 *  2026-11-17 (Corey: "we may need to adjust the brightness on the halos"): `strength` multiplies both alphas (1 = the
	 *  pass 8 look; 1.7 since: braking 0.65, stopped 0.27), `tint` the halo's own color (the lamp's red by default). */
	halo: { size: 122, squash: 0.8, brake: 0.38, stopped: 0.16, strength: 1.7, tint: 0xff2a1a },
	/** the lamp's brightness while braking and while stopped (0..1; the same since pass 8: the halo carries the
	 *  difference), and how fast lamp and halo change (ms to full) */
	brake: 0.41,
	stopped: 0.41,
	attackMs: 40,
	releaseMs: 160,
	/** the far lamp (and its halo) at this share of the near lamp's strength */
	farShare: 0.76,
	/** the far lamp's move from game/brakeLightSpec.ts (Corey's, road px at the symbol's built size, x right and y down
	 *  for the RIGHT-facing frame; the left-facing frame takes x mirrored). Kept here, beside the generated spec, so a
	 *  rebuild of the spec keeps them. The near lamps stay where the spec has them. */
	farOffset: { H1: [-0.5, -27.5], H2: [-1.5, -32], H3: [1.5, -52.5], H4: [0.5, -18] } as Record<string, [number, number]>,
};

// ---- THE SCENE (scene pass 9, Corey 2026-11-16; game/scenePresets.ts, game/scene/sceneLayers.ts) -----------------------
// The snow runs edge to edge on every layout: the kit's field tile repeats under everything, its bands hide the road
// picture's straight top and bottom edges, the two painted ends sit on the tunnels (desktop, tablet, phone held sideways),
// and on an upright phone the evergreen forest stands behind and above the billboard. WHICH pieces is the scene preset's
// (game/scenePresets.ts, one preset now: snowDay); WHERE the layout-dependent ones go is here. Road px.
export const SCENE = {
	/** THE EDGE COVER: where the dark rock once hid the traffic that has driven past the picture's left or right edge, the
	 *  field's own pixels are laid over the traffic there (the same tile at the same phase, so it cannot be seen). It
	 *  starts this many road px under the reindeer's feet line of the layout (STRIKE.snow) so his shadow, which falls up
	 *  and to the left of his feet, stays on the snow. */
	edgeCoverBelowFeet: 6,
	/** THE FOREST on an upright phone: full width, running off the top of the screen. Its bottom edge (road px from the
	 *  picture's top, negative = above it) follows the snow there is above the picture (road px from the screen's top to
	 *  the picture's top): Corey's two placements, 390 x 620 (764 road px of snow, bottom 36 road px above the picture:
	 *  y 185 CSS) and 390 x 844 (1416 of snow, bottom 384 above: y 262 CSS), straight between them and beyond. Its top
	 *  always stays at least `topSpare` road px above the screen's top (the trees run off the top), and its bottom never
	 *  more than `maxBelow` into the picture's top margin. */
	forest: { anchors: [{ snow: 764, bottom: -36 }, { snow: 1416, bottom: -384 }], topSpare: 8, maxBelow: 60 },
	/** THE SCENE SWAP (2026-11-17, game/scene/sceneSwap.ts): the day snow in the base game, the night in Free Spins, the
	 *  deep night in Super Free Spins, and the change of set (Snow, Dark). `fadeMs`: the fade's length, one picture of the
	 *  outgoing screen fading out over the incoming scene as a unit (2026-11-19, game/scene/sceneSnapshot.ts: 200 ms, short
	 *  and even; it was 400 ms layer by layer with a 100 ms tail); the top line and the HUD's ink take the same time;
	 *  `unload`: the night pieces leave the GPU and memory after the swap back (they load again at the next bonus: the
	 *  second load comes from the browser's cache) */
	swap: { fadeMs: 200, unload: true },
};

// ---- THE BILLBOARD LOGO (scene pass 9: the LOCKED yellow billboard, tools/build_scene.py, game/scene/logoSign.ts) -------
// It replaces the green name plate. Its lamps start dark and come on one after the other, then blink at a calm rate: the
// sign's picture with both lamps dark is the base, and each lamp's lit glass (a patch cut from the locked art) fades in
// over it with a soft glow. Times are real ms (the sign keeps its own time, not the board's).
//   PLACE per layout class (game/layoutSpec.ts logoBox), pinned to the road picture's top left corner so it scales with
//   the scene: `cx` the sign's center line and `foot` its bottom edge (the snow mound's foot), road px from that corner,
//   and `width` road px. The desktop class (a landscape screen 3:2 and wider) instead takes its height from `topGap`
//   master units under the top line's top down to the foot (so a 16:10 screen, which shows more snow above the road,
//   gets a bigger sign, as Corey placed it); `minLeft` keeps it that many CSS px inside the screen's left edge.
export type LogoPlace = { cx: number; foot: number; width: number; topGap?: number };
export const LOGO_SIGN = {
	place: {
		/** 1280 x 720, 1440 x 900, 1920 x 1080, 2560 x 1080: Corey's first three (the 21:9 one he placed bigger, farther out) */
		desktop: { cx: -54, foot: 258.7, width: 290, topGap: 20 } as LogoPlace,
		/** 1024 x 768, 1366 x 1024 (a landscape screen narrower than 3:2) */
		tablet: { cx: -64, foot: 240, width: 305 } as LogoPlace,
		/** a phone held sideways (844 x 390): in the left HUD column, over the BALANCE capsule's keys */
		phone: { cx: -198.6, foot: 394.8, width: 379.5 } as LogoPlace,
		/** upright (390 x 844, 390 x 620): top left over the snow (and the forest), its foot just above the road picture */
		portrait: { cx: 286.4, foot: -86.7, width: 494 } as LogoPlace,
		minLeft: 4,
	},
	/** THE PRESS SCREEN ON AN UPRIGHT PHONE (2026-11-17, Corey approved): the sign is moved up or down from its place so its
	 *  lowest visible pixel over the LED billboard's snow cap sits this many CSS px into the cap's top (0 to 2: resting on
	 *  it, no gap); once the press screen has gone it moves back to its place over pressLiftBackMs (real ms). The in-game
	 *  place and the other layouts are the rule's above. */
	pressCapOverlap: 1,
	pressLiftBackMs: 350,
	/** THE SIGN'S FOOT ON OPEN GROUND (2026-11-19, Corey: "on portrait mode the logo bottom is never in the trees"): on an
	 *  upright phone (the forest behind the snow) the sign moves down from its place until its lowest visible pixel (the
	 *  foot of the post, its snow mound) is treeGapCss CSS px under the forest's tree line (game/scene/sceneLayers.ts
	 *  forestLineY); never so far that its box comes within boardGapCss CSS px of the board's top lane line */
	treeGapCss: 3,
	boardGapCss: 6,
	lamps: {
		/** both lamps dark from the sign's first frame for this long */
		darkMs: 700,
		/** then the left lamp comes on, and the right one this much later */
		stepMs: 380,
		/** both lit for this long before the blink starts */
		holdMs: 1600,
		/** THE BLINK: one lamp's whole cycle, and the share of it the lamp is lit */
		periodMs: 2400,
		litShare: 0.5,
		/** where the right lamp's cycle starts, as a share of the period: 0.5 alternate, 0.25 a chase, 0 together */
		rightPhase: 0.5,
		/** each change of a lamp fades over this long (smooth in and out) */
		fadeMs: 200,
		/** the soft glow over a lit lamp (added, tinted): its strength, its diameter in lens radii, its color */
		glowAlpha: 0.55,
		glowSize: 3.4,
		glowTint: 0xffb03c,
		/** a dark lamp keeps this much of its lit glass (0 = the dark picture's glass exactly) */
		darkFloor: 0,
	},
};

// ---- THE LED SCOREBOARD (Corey 2026-11-16, bigwin_led_r3_2026-11-16 "r3b": approved from the live mock; part A,
// 2026-11-17; game/scoreboard/) ------------------------------------------------------------------------------------------
// A one-row LED STRIP under the road, always on and always lit, and a separate LED BACK BOARD hidden behind it that rises
// and seats its bottom rail under the strip's snow cap, so the two read as one scoreboard (Mega, Epic, Max; part B adds the
// entries and the Total Win). Both faces are drawn live on small CPU canvases at ONE PIXEL PER DOT and shown through the dot
// grille like the press screen's billboard (no filter, shader, mask, backdrop-filter or blob: URL). Decoration only: it
// shows the book's amounts, and its race draws from its own random source.
//   STRIP PLACE, one centred rule per layout class (the mock's NOTES section 1), CSS px:
//     desktop / tablet  width = `width` x the road picture (roadW road px), centred on the window; top = the bottom lane
//                       line + `topShare` of the snow band from it down to the dock's top edge; height = the smaller of
//                       heightRoad road px and `heightShare` of that band
//     portrait (upright phone)  width = `width` x the screen, centred; top = the road's bottom edge (the picture's snow
//                       edge, road y `roadY`); height = `heightShare` of the band down to the HUD's top (its highest
//                       readout or key)
//     phone (held sideways)  width = `width` x the road between the tunnel walls (lanesW road px), centred on the road;
//                       top = the road's bottom edge (the asphalt's, road y `roadY`) + `pad`; height = `heightShare` of the
//                       band down to the screen's bottom
//   The road's bottom edges are the mock's by-eye reads put in road px (they land on its 390 x 844 and 844 x 390 numbers).
//   THE BACK BOARD: the strip's width, frame, dot pitch and bezel; its housing `backShare` of the room above the strip
//   (desktop, tablet, sideways: up to the board's top; upright: up to the top line's bottom edge).
export type StripRule = { width: number; topShare: number; heightRoad: number; heightShare: number; roadY: number; pad: number; lanesW: number; backShare: number };
export const LED_BOARD = {
	/** false: no scoreboard at all (no strip, no back board; wins show only on the road as before) */
	on: true,
	/** the dots' content is redrawn and sent to the GPU this many times a second (an LED controller's refresh) */
	fps: 30,
	/** the halo's strength (the half size picture added over the face) */
	halo: 0.3,
	strip: {
		desktop: { width: 0.62, topShare: 0.15, heightRoad: 125, heightShare: 0.85, roadY: 851, pad: 0, lanesW: 1535, backShare: 0.778 } as StripRule,
		portrait: { width: 0.9, topShare: 0, heightRoad: 0, heightShare: 0.75, roadY: 948, pad: 0, lanesW: 0, backShare: 0.52 } as StripRule,
		phone: { width: 0.86, topShare: 0, heightRoad: 0, heightShare: 0.72, roadY: 874, pad: 1, lanesW: 1349, backShare: 0.894 } as StripRule,
		/** the strip's own switch from one line to the next (a scan to a message, a dissolve back to the cartoons), ms */
		switchMs: 150,
		dissolveMs: 400,
		/** a strip-only win leaves over this long after its hold */
		dimOutMs: 320,
	},
	/** THE RISE, style C (Corey's r3b pick): rises past its seat (`overshoot`, the ease's back amount) and drops into place
	 *  with one small bounce (bouncePx x the board's size, bounceMs); lowering: a little hop up (hopPx), then it drops. The
	 *  back board starts backAtMs after the show; its face powers on (a scan line) as it seats, and powers down over
	 *  powerDownMs before it lowers over lowerMs. Real ms. */
	rise: { backAtMs: 60, riseMs: 560, overshoot: 2.2, bouncePx: 3, bounceMs: 220, hopPx: 8, powerDownMs: 250, lowerMs: 460, scanMs: 200 },
	/** the scene's dim while the back board is up (the mock's 0.42 x 0.8), in and out */
	dim: { alpha: 0.336, inMs: 260, outMs: 320, color: 0x040811 },
	/** THE LADDER, in multiples of the play amount; the back board comes up from tier `backFromTier` (2 = Mega) */
	tiers: [
		{ key: 'big', title: 'BIG WIN', bar: 15 },
		{ key: 'super', title: 'SUPER WIN', bar: 30 },
		{ key: 'mega', title: 'MEGA WIN', bar: 60 },
		{ key: 'epic', title: 'EPIC WIN', bar: 150 },
		{ key: 'max', title: 'MAX WIN', bar: 7777 },
	],
	backFromTier: 2,
	/** THE HOUSE PACER (the Angry Mantis rule): the count's length by the FINAL tier (normal speed; a turbo level divides
	 *  it by its rate), each bar crossed min(barShare of it, barMaxMs), the final tier at least finalMinShare; the hold after
	 *  it lands (holdAutoMs in autoplay) */
	pace: { countMs: [3000, 4000, 5000, 6000, 7000], barShare: 0.15, barMaxMs: 900, finalMinShare: 0.4, holdMs: 1200, holdAutoMs: 400 },
	/** a SMALL win (under the Big bar) on the strip: WIN and the amount count over countMs, then the reindeer hops across
	 *  for the rest of holdMs (never waited for) */
	small: { countMs: 1000, holdMs: 1500 },
	/** the tier change's left to right sweep and the number's flash, ms */
	sweepMs: 400,
	pulseMs: 350,
	/** THE IDLE CARTOONS on the strip: 'auto' plays them in turn (ideas.cartoons below); a name plays that one over and over
	 *  (the tune panel) */
	cartoon: 'auto' as 'auto' | 'trot' | 'parade' | 'plow' | 'sleigh' | 'peek' | 'race' | 'tree' | 'chew' | 'takeoff' | 'signroll' | 'stack',
	/** THE GRANDMA GAG (Corey's line, exactly): when the reindeer strikes a Grandma, for gagMs on the strip, cut short by a
	 *  new spin or a win message on the strip. Its beats: the first part pulses, the bump, then the rest marches in. */
	gag: { on: true, ms: 5000, first: 'Oooh..', second: 'Grandma Got', third: 'Run Over!?', firstMs: 900, bumpMs: 900, secondMs: 1600, short: { text: 'GRANDMA GOT RUN OVER!', ms: 1500 } },
	/** THE SHORT GRANDMA LINE (Corey 2026-11-17, approved): the full three screen line above plays only in manual base play; in
	 *  autoplay, in a bonus round and at turbo 1 or 2 the gag is ONE screen, gag.short.text, for gag.short.ms. WHEN it fires is
	 *  the book's rule as before (game/bookEventHandlerMap.ts strike); this only picks which line. */
	gagShortIn: { auto: true, free: true, turbo: true },
	/** THE RACE (decoration only, its own random source; game/scoreboard/race.ts): the odds of each result, the run and the
	 *  result card's length, the winner's lead at the line (a share of the track) */
	race: { odds: { reindeer: 0.45, police: 0.45, tie: 0.1 }, runMs: 3200, cardMs: 2600, finishGap: 0.035 },
	/** in a bonus round, a reindeer dashes across the strip's counter after each spin */
	dashMs: 1300,
	/** THE SPINS LEFT DURING A MESSAGE (2026-11-17): in a bonus round a strip message (a small win, the gag) shows the
	 *  counter for the last counterMs of every cycleMs it plays, so the spins left are never off the strip for long */
	counterBreak: { on: true, cycleMs: 3600, counterMs: 1200 },
	/** THE STRIP'S PRIORITY ORDER (Corey 2026-11-17, approved): ONE arbiter decides what the strip under the reels shows
	 *  (game/scoreboard/stripArbiter.ts). Highest first: a higher item cuts a lower one at once, nothing queues, and when the
	 *  higher one ends the strip shows whatever is highest and still true at that moment.
	 *    entry      a bonus entry or the Total Win: its press line and its sentences (never cut or shortened)
	 *    bigWin     the big win tiers (Big and Super on the strip; the strip's own line while Mega and up hold the back board)
	 *    scatter    the scatter anticipation count, and its fireworks on a trigger (scatterCount below)
	 *    winAmount  the spin's win amount (WIN and the amount, the line win's plain total)
	 *    spinsLeft  a bonus round's spins left: for spinsLeftMs after the count changes, and the last counterMs of every
	 *               cycleMs (counterBreak above) after that
	 *    gag        the Grandma line
	 *    cartoon    the idle cartoons (they also run in autoplay and in a bonus round)
	 *    race       the race, only at true idle (the base game, no autoplay, nothing playing): elsewhere the cartoons skip it */
	stripOrder: ['entry', 'wheel', 'bigWin', 'scatter', 'winAmount', 'spinsLeft', 'gag', 'cartoon', 'race'] as ('entry' | 'wheel' | 'bigWin' | 'scatter' | 'winAmount' | 'spinsLeft' | 'gag' | 'cartoon' | 'race')[],
	spinsLeftMs: 2000,
	/** A BONUS ROUND'S STRIP (Corey 2026-11-18: "take the idle animations on the small LED screen out of Bonus Games, it's
	 *  causing them to flash back and forth"): in Free Spins and Super Free Spins the strip never shows the cartoons or the
	 *  race; the spins left are its resting state, up whenever nothing higher is due (spinsLeftMs and counterBreak are then
	 *  unused). The Grandma line plays at most gagPerBonus times a round (the short line); after that a strike shows none.
	 *  No flashing: in a bonus round the strip goes down to a lower item only bonusHoldMs after its last change (a higher
	 *  item still cuts in at once). */
	bonusIdle: false,
	gagPerBonus: 2,
	bonusHoldMs: 1000,
	/** THE SCATTER ANTICIPATION COUNT (Corey 2026-11-17, approved: "Strip only, maybe show the scatter symbol animations, maybe
	 *  some fireworks on the LED board when it hits successfully"). While a spin is in anticipation (config.anticipationAt
	 *  presents seen, cars still to come, a trigger still possible: game/road/roadBoard.ts scatterCount) the strip shows the
	 *  presents seen so far against the number needed (the next of config.scatterTriggers) as a row of present pictures and
	 *  the count in words, "2 OF 3". Each new present pops in (popMs) with a ring of dots (tickMs). On a trigger: fireworks of
	 *  dots over the count for fireworksMs (then the bonus entry takes over by priority); on a miss it clears quietly. Strip
	 *  only: nothing on the back board. */
	scatterCount: { on: true, popMs: 260, tickMs: 520, fireworksMs: 1700, dimAlpha: 0.28 },
	// ---- PART B (2026-11-17): the staged back board scenes, the tier sounds, the shakes ----
	/** THE BONUS ROUND'S CARDS: 'board' plays the Free Spins entry, the Super entry and the Total Win on the back board (the
	 *  mock's scenes, the press line on the strip; the HTML card keeps its press, its timers and its sounds but draws nothing);
	 *  'card' keeps the HTML card as before. A wrap-up with a top-up or a cap always keeps the HTML card (its lines say so). */
	cards: 'board' as 'board' | 'card',
	/** THE STAGED SCENES (the mock's r3b scenes; their beats are its drawing code): the share of the back board's face kept
	 *  under the number for the win scenes' bottom band (Mega's jam, Epic's honk meter, Max's race); the title's bouncing block
	 *  letters on the back board (the mock's wave); the entries' press line and READY beat (ms of the scene), the Total Win's
	 *  count (a turbo level divides it, as the win count) and its press line after the landing */
	scenes: { band: 0.22, bounceTitle: true, fsPressMs: 2300, sfsPressMs: 2900, fsReadyMs: 2200, sfsReadyMs: 2800, totalCountMs: 3000, totalPressAfterMs: 300 },
	/** THE ENTRY'S SENTENCE ON THE STRIP (2026-11-17; the HTML intro card's line, INTRO_LINE, exactly): while a Free Spins or
	 *  Super entry waits for the press, the strip scrolls the sentence (charsPerSec, about 6 dots a letter at the font's size)
	 *  on its top row with PRESS ANYWHERE TO CONTINUE under it, so the press line is never off the strip. A strip too short
	 *  for two rows alternates: one pass of the sentence, then the press line for pressMs. */
	entryLine: { on: true, charsPerSec: 9, pressMs: 1600 },
	/** THE EXPLANATION ON THE BIG BOARD (Corey 2026-11-18: "This explanation should really be on the bigger LED board, not
	 *  cramped on the smaller one"; game/scoreboard/explainDraw.ts). From an entry's READY beat (a Free Spins or Super entry)
	 *  and from a wrap-up's landing when it carries a line (a top-up, the cap), the sentence is on the BACK BOARD, whole and
	 *  still, wrapped into centered lines of the board's 5 x 7 face at the largest size that fits (at most maxLines); the strip
	 *  carries PRESS ANYWHERE TO CONTINUE alone (entryLine above is then unused). layout 'A': one page, the count and the
	 *  title (or the wrap-up's title and amount) in the upper headShare of the board, the sentence under it, a wipe into it
	 *  over wipeMs. 'B': two pages, the scene's own big page and a page with the sentence alone, pageMs each, a wipe between.
	 *  In autoplay the cards continue as before (ROUND.autoplayMs, before the READY beat): today's rule. */
	// (round 2, Corey 2026-11-18: "I don't like either Layout A or B. There is so much room in B without actually having to
	//  switch screens to an alternate view") layout 'C1' (the default) and 'C2': ONE page with B's own look, the presents, the
	//  number and the words as a compact lockup and the sentence in the heavy face filling the rest (explainDraw.ts
	//  drawLayoutC); C1 the lockup on top, C2 the number and a present in the left third on a wide board (an upright board
	//  shows C1). maxLinesC the sentence's most lines, minCap its least size in dots, readShare its least size as a share of
	//  the number's, margin the one margin (a share of the board's shorter side). A and B stay selectable.
	explain: { on: true, layout: 'C1' as 'A' | 'B' | 'C1' | 'C2', headShare: 0.36, maxLines: 6, wipeMs: 350, pageMs: [3200, 4200], maxLinesC: 5, minCap: 9, readShare: 0.3, margin: 0.045 },
	/** THE BACK BOARD'S TITLES (BIG to MAX WIN, FREE SPINS, TOTAL WIN; 2026-11-17): matters of taste only (every title and
	 *  amount is centered on its drawn dots by the code): per layout class (desktop and tablet, a phone held sideways, an
	 *  upright phone) the title's size (x the dot scale the layout picks; never wider than the face less its margins);
	 *  `gap` dots added between a title and its amount (or number); `bounce` the bouncing letters' lift (x 1.6 dot scales).
	 *  1, 0 and 1 are the look before the knobs. All live. */
	titles: {
		desktop: { size: 1 },
		phone: { size: 1 },
		portrait: { size: 1 },
		gap: 0,
		bounce: 1,
	},
	/** THE SHAKES (the mock's shakeAt): at Mega, Epic and Max (amp per tier) the road, the logo and the back board shake (px x
	 *  the back board's size, a sine every periodMs dying over decayMs, for ms); at every tier change after Big a small jolt
	 *  (joltPx over joltMs); the Super entry shakes once as its scene starts (superEntryAmp). A strip win shakes the strip. */
	shake: { on: true, px: 7, amp: [0, 0, 1, 1.35, 1.7], ms: 480, periodMs: 75, decayMs: 120, joltPx: 3, joltMs: 190, superEntryAmp: 1.6 },
	/** THE TIER SOUNDS (the five sfx_win_* in the sprite): one as the count reaches each tier; a skip plays only the final
	 *  tier's (through the game's sound events: the effects volume, mute and SKIP TO RESULT apply). Since 2026-11-17 a tier's
	 *  sound fades the one before out over fadeMs as it starts (only one that started under lengthMs ago: each is 1.48 s) */
	tierSounds: { on: true, names: ['sfx_win_big', 'sfx_win_super', 'sfx_win_mega', 'sfx_win_epic', 'sfx_win_max'], fadeMs: 150, lengthMs: 1500 },
	/** the chase borders drawn as runs of one color (the same dots, fewer calls); off draws them dot by dot (the probe
	 *  compares the two pictures) */
	fastChase: true,
	/** THE LED GRID'S DENSITY (Corey 2026-11-19, led_density_r1_2026-11-19: "1.5"; game/scoreboard/ledGrid.ts): `k` LEDs per
	 *  dot each way on both faces (the strip, the back board: every card, the press screen, the gag), the words and pictures
	 *  redrawn for that grid, the layouts kept to today's dots. Only where one LED is at least `minDevicePx` device pixels
	 *  (the dot pitch x the renderer's resolution / k): an upright phone at 2x and a 1440 x 900 desktop at 1x keep today's
	 *  grid (k 1). `smallWeight`: the Overpass weight the 5 x 7 sizes (the strip's small lines, the press screen's words) are
	 *  redrawn in; `bodyWeight`: the entry sentence's (the big board's body text); 700 is Bold (both his pick). `softDot`: a
	 *  faint skirt baked round each hole of the grille on the finer grid (his pick: the light of today's dot size at the
	 *  finer pitch). Live: a change rebuilds both faces on the next frame. */
	density: { on: true, k: 1.5, minDevicePx: 2, smallWeight: 700, bodyWeight: 700, softDot: true },
	/** THE FACES' MOVING EFFECTS (Corey 2026-11-20, led_board_size_r1_2026-11-20 round 2, his settings; game/scoreboard/
	 *  scoreboard.ts drawBack and drawStrip, scoreboardDraw.ts borderGlint). Each keeps today's choice selectable:
	 *    band         the moving light band (landing/ledScreens.ts shimmer) on both faces: false (today: true)
	 *    powerOn      the back board's power on as it seats: 'dissolve', its LEDs come on in a random order (the power down's
	 *                 own noise run the other way) over dissolveOnMs; 'scan' is today's white line over rise.scanMs
	 *    stripSwitch  the strip's change to a message (a win, the gag, the scatter count): 'dissolve' (the dissolve it already
	 *                 uses back to its cartoons, over strip.dissolveMs); 'scan' is today's white line over strip.switchMs
	 *    glint        a short bright run of LEDs going round each face's outer dots on its lit LEDs: `len` dots long, `rows`
	 *                 dots deep, once round every `periodS` s at full `alpha` at its head, fading to its tail (the mock's) */
	effects: { band: false, powerOn: 'dissolve' as 'dissolve' | 'scan', dissolveOnMs: 280, stripSwitch: 'dissolve' as 'dissolve' | 'scan', glint: { on: true, len: 60, rows: 3, periodS: 3, alpha: 0.75 } },
	/** THE FULL BOARD FLASHES SOFTENED (Corey 2026-11-20: "It wasn't the boarder flash that bothered me as much as the full
	 *  screen strobing"; "Soft fade is fine"). The three one-shot flashes over the whole board, each 'soft' or 'today':
	 *    slamFlash    the white flash as a number slams in (the entries, the Super tease)
	 *    pulse        a number's white pulse at a slam, a tier change, a count's end, a tick; Max's board wash with it
	 *    ladderFlash  the Total Win ladder's full board wash of a rung's color as it lights
	 *  SOFT (the mock's): softStrength of the flash's strength, spread over softLength times as long, rising and falling (a
	 *  sine) instead of starting at full. The other flashes (the chase, the count border, the landing blink, the police
	 *  lights, the text blinks, the ladder's border and top rung) stay as they are. Each flash still starts at its moment
	 *  (the sounds tied to them are untouched). */
	strobe: { slamFlash: 'soft' as 'soft' | 'today', pulse: 'soft' as 'soft' | 'today', ladderFlash: 'soft' as 'soft' | 'today', softStrength: 0.3, softLength: 2.5 },
	/** THE LED ANIMATIONS COREY PICKED (2026-11-19, led_anim_ideas_r1_2026-11-19: fs-presents, sfs-tease, tw-ladder,
	 *  amb-tree, amb-chew, amb-takeoff, amb-signroll, amb-stack, press-lights; the mock's drawing code, ported:
	 *  game/scoreboard/entryScenes.ts, totalLadder.ts, ambient.ts). Each switch brings back today's picture.
	 *    fsEntry    'presents': the Free Spins entry's presents fly up, jiggle and pop, the count rises out of the middle
	 *               one (fsPresents of them); 'today': HERE WE GO and the stampede
	 *    sfsEntry   'tease': the Super entry's red present opens on a window spinning the three column characters (a fixed,
	 *               cosmetic order: never the wheel's result) and slams shut, the lockup above it; 'today': the sleigh sweep.
	 *               Every present on the Super entry and its explanation page is the red present (Corey: "on super free
	 *               spins the presents next tot he 10 Super free spins should also be red")
	 *    total      'ladder': the Total Win's taillight ladder (the five rungs are LED_BOARD.tiers' bars, the top one
	 *               config.maxWin), counted with the house pacer (each rung crossed min(pace.barShare, pace.barMaxMs) of
	 *               the count; the count's LENGTH is unchanged); 'today': the linear count over the band
	 *    cartoons   the strip's idle rotation, in order (the race only at true idle, as before)
	 *    pressLights the reindeer's light string along the top of the press screen, a tug at each change of screen
	 *  DECIDED 2026-11-19 (Corey: "yes on the total count wins and 1.5 second hold on max win"; off brings back today's):
	 *    totalBySize  the Total Win's count length by the round's size (small under the Big bar, big under the Epic bar,
	 *                 huge from it, max the cap; ms at regular speed, a turbo level divides it, a press lands it at once):
	 *                 off = scenes.totalCountMs (3 s) for every round
	 *    capPageHold  a capped round's line page waits ms after the landing (the MAX WIN landing is seen): off = it wipes in
	 *                 as the amount lands. Autoplay Bonuses' wrap-up still continues ROUND.wrapAutoHoldMs after the landing
	 *  (Autoplay Bonuses still cuts an entry at ROUND.autoplayMs, 1.4 s: unchanged) */
	ideas: {
		fsEntry: 'presents' as 'presents' | 'today',
		sfsEntry: 'tease' as 'tease' | 'today',
		fsPresents: 3, // (since 2026-11-20 the entry pops the round's own trigger count; this only for a card raised by hand)
		total: 'ladder' as 'ladder' | 'today',
		cartoons: ['trot', 'tree', 'parade', 'chew', 'plow', 'takeoff', 'sleigh', 'signroll', 'peek', 'stack', 'race'] as ('trot' | 'parade' | 'plow' | 'sleigh' | 'peek' | 'race' | 'tree' | 'chew' | 'takeoff' | 'signroll' | 'stack')[],
		pressLights: true,
		totalBySize: { on: true, ms: { small: 1500, big: 3000, huge: 4000, max: 5000 } },
		capPageHold: { on: true, ms: 1500 },
	},
};

/** everything tunable, as one object (window.__reindeer.tune) */
export const TUNE = { ledBoard: LED_BOARD, laneFlow: LANE_FLOW, brakeLights: BRAKE_LIGHTS, ledSign: LED_SIGN, road: ROAD, motion: ROAD_MOTION, lineWin: LINE_WIN, strike: STRIKE, roam: ROAM, cloudCell: CLOUD_CELL, redBox: RED_BOX, crosshair: CROSSHAIR, column: COLUMN, round: ROUND, stoplight: STOPLIGHT, hudBed: HUD_BED, present: PRESENT, sound: REINDEER_SOUND, shadow: SHADOW, policeLights: POLICE_LIGHTS, vanWin: VAN_WIN, signWin: SIGN_WIN, wagonTree: WAGON_TREE, seated: SEATED, scene: SCENE, logoSign: LOGO_SIGN, superWheel: SUPER_WHEEL };

// ---- THE WILDS' MULTIPLIERS (Corey 2026-11-19: "E Candy Cane"; game/road/wildMult.ts, tools/build_wild_mult.py) -------
// The number on a Grandma Wild's cell and on a full column Wild, in the approved mock's candidate E "Candy Cane
// Lettering" letters (Desktop/Run Over Reindeer/wild_multipliers_r1_2026-11-19, tools/page.html const E): chunky Sigmar
// letters with an ink outline, no backing plate. ONE COLOR PER CHARACTER at every value (Corey 2026-11-19: "We should jsut
// go static colors for Reindeer Santa, Grandma for the multipliers and the garland. Grandma is the exception, she has gold
// number that deserve effects as they get much larger"; the colors confirmed with the garland mock the same day): the
// Reindeer red candy stripes, Santa green candy stripes, Grandma gold tinsel (her column and her single cell Wild), and
// only Grandma's gold has effects that grow with the value (gold, below). Every letter is its own sprite from the
// multiplier atlas; the motion is transforms, alpha, tint and additive blending only, on the board clock (turbo and a slam
// stop run it faster). Road px and board ms. The tune panel lists this block (staging only; TUNE below).
export const WILD_MULT = {
	/** each character's color set (the atlas carries red, green and gold): one line to change one */
	colors: { reindeer: 'red', santa: 'green', grandma: 'gold' } as Record<'reindeer' | 'santa' | 'grandma', 'red' | 'green' | 'gold'>,
	/** the single cell Grandma Wild's */
	cellColor: 'gold' as 'red' | 'green' | 'gold',
	/** the value bands the letters grow by (from 10x, 50x, 100x): sizes only, never colors */
	bandFrom: [10, 50, 100],
	/** THE LARGEST VALUE EACH KIND OF WILD CAN CARRY (2026-11-19, Corey: "Do we actually have a 500x wild?"; no). From the
	 *  math (math-sdk/games/run_over_reindeer: ror_rules.py GRANDMA_MULT / GRANDMA_MULT_SUPER, variant_f.py C_final5 and
	 *  SUPER_TRIM_2026_11_15 over variant_e.py BASE, as variant_f.apply_working() installs them; a Grandma column is its
	 *  roll plus the Grandma Wilds it takes in, capped at 50x in a bonus round) and counted in every Wild event of the
	 *  production books (math build 2026-11-18, modes base, bonus, super; the Antes share the base books): the single cell
	 *  Grandma Wild 2x to 100x, the Reindeer column 2x to 8x, Santa's 6x to 30x, Grandma's 12x to 75x. A column shows its
	 *  event's multiplier (a joining Grandma Wild counts up to it, never past it). config.multipliers (Game Info) gives the
	 *  same tops; wildMult.ts says so in DEV when they part. THE FIT (wildMult.ts layout): a kind's largest value fills
	 *  the frame's inside (place maxW), and every smaller value of that kind stands at least as tall as it (growing up to
	 *  its band's cap, place caps); a value over its kind's top is never expected and simply shrinks to fit. `sum` (a
	 *  copy flying to a line's multiplier) takes the largest of all. */
	maxValue: { cell: 100, reindeer: 8, santa: 30, grandma: 75 } as Record<'cell' | 'reindeer' | 'santa' | 'grandma', number>,
	/** THE PLACES, inside the Wild's frame (2026-11-19: the number covered the frame's bottom rail from 25x; it now fits
	 *  the frame's inside and never overlaps the rail). `caps` the letter height per value band (road px), `maxW` the
	 *  widest the number's letters may be (a long number shrinks to it: their outline, baked shadow and the idle's 2%
	 *  swell then stay inside the frame's inside width: 196 road px in a column, 208 in a cell, with the garland's band,
	 *  WILD_FRAME.band, since 2026-11-19; 12 road px of slack, 18 before), with a kind's largest value (maxValue) filling
	 *  it: the Reindeer's 8x lifts every Reindeer number to its own height (75 road px; 2026-11-19, the refit to the real
	 *  values). Every other kind's largest value (Santa's 30x, Grandma's 75x, the cell's 100x) already filled it. The
	 *  cell's caps stay: a taller cell number meets the WILD word above it (tried at 60 to 66, 2026-11-19).
	 *  `floor` the inside of the frame's bottom rail
	 *  (road px above the column's foot or the cell's bottom edge: RED_BOX.inset - RED_BOX.edge + WILD_FRAME.band), `gap` the letters' outline above it (their baked shadow, down and right, then barely reaches the rail). The atlas is baked for these (tools/build_wild_mult.py PLACE
	 *  keeps the same numbers; DEV says so once when a number draws over its bake). `sum`: the copies that fly to a line's
	 *  multiplier when two Wilds add on it (drawn about their centre). */
	place: {
		cell: { caps: [56, 58, 60, 62], maxW: 196, floor: 21, gap: 6 },
		col: { caps: [70, 76, 82, 88], maxW: 184, floor: 27, gap: 6 },
		sum: { caps: [60, 64, 68, 72], maxW: 220, floor: 0, gap: 0 },
	},
	/** the glow behind the number (the atlas's soft blob, additive) in a win: its tint per color set, its size against
	 *  the number's width and letter height, its strength at the win's peak */
	glow: { tint: { red: 0xff6060, green: 0x70ff9a, gold: 0xffc040 } as Record<'red' | 'green' | 'gold', number>, width: 1.25, height: 1.6, alpha: 0.35 },
	/** GRANDMA'S GOLD: effects that grow with the value. The steps' numbers are blended between their `from` values (on
	 *  a log scale), the last held above 500x:
	 *    sheen      a light sweeps across the letters every sheenMs (sweepShare of it), sheenAlpha at its brightest
	 *    sparkles   that many star glints take turns on the letters at rest (sparkleMs each, sparkleScale of the star)
	 *    shimmer    the letters' faces flicker brighter by up to this (additive)
	 *    glow       a soft gold glow behind at this strength, pulsing by glowPulse every pulseMs */
	gold: {
		steps: [
			{ from: 2, sheenMs: 3600, sheenAlpha: 0.22, sparkles: 0, sparkleScale: 0.4, shimmer: 0, glow: 0, glowPulse: 0, pulseMs: 1600 },
			{ from: 25, sheenMs: 3000, sheenAlpha: 0.3, sparkles: 2, sparkleScale: 0.5, shimmer: 0, glow: 0, glowPulse: 0, pulseMs: 1600 },
			{ from: 100, sheenMs: 2200, sheenAlpha: 0.4, sparkles: 3, sparkleScale: 0.55, shimmer: 0.12, glow: 0.3, glowPulse: 0.35, pulseMs: 1400 },
			{ from: 500, sheenMs: 1600, sheenAlpha: 0.55, sparkles: 5, sparkleScale: 0.65, shimmer: 0.2, glow: 0.45, glowPulse: 0.4, pulseMs: 1100 },
		],
		/** the sheen's sweep: this share of its period, the lit band this share of the number's width; its tint */
		sweepShare: 0.45,
		band: 0.45,
		sheenTint: 0xfff2c8,
		/** the shimmer's flicker period per letter (ms) */
		shimmerMs: 180,
		sparkleMs: 650,
	},
	/** APPEAR: each letter drops in from `fromScale`, `staggerMs` after the one before, over `ms`; it lands at `land`
	 *  (share of ms), fading in over the first 1/`fadeRate` of it, then squashes `squash` and settles (decay, freq); a snow
	 *  puff leaves each side of each letter `puff.delayMs` after its start, over `puff.ms` */
	appear: {
		staggerMs: 60,
		ms: 240,
		land: 0.55,
		fromScale: 1.8,
		fadeRate: 4,
		squash: 0.2,
		decay: 4,
		freq: 9,
		/** a cell's number starts this long after her cloud's pop starts (CLOUD_CELL.popMs: she has turned Wild) */
		cellDelayMs: 170,
		/** the whole move, after which the number is at rest */
		totalMs: 1000,
		puff: { delayMs: 132, ms: 380, y: 0.45, spread: 0.35, spreadOut: 0.3, scale: [0.35, 0.45], per: 80, alpha: 0.9, rise: 10 },
	},
	/** CHANGE (a Grandma Wild joining a column: its sum): the number counts up from the old value over `countMs` (ease
	 *  out), trembling `shake` (|sin(t / shakeMs)|), then slams down from 1 + `slam` over `slamMs`, with a burst of `burst.n`
	 *  stars (white; gold for the gold number) and two snow puffs, over `burst.ms`. The stamp sound plays as it slams. */
	change: {
		countMs: 480,
		shake: 0.07,
		shakeMs: 32,
		slam: 0.45,
		slamMs: 160,
		totalMs: 1100,
		burst: { n: 7, ms: 420, from: 0.3, to: 0.75, scale: 0.7, tint: 0xffffff, goldTint: 0xffe28a, seed: 3 },
		puff: { spread: 0.4, per: 70 },
	},
	/** WIN (a winning line runs through the Wild): two beats `beats` ms apart; each beat every letter hops `hop` road px,
	 *  `staggerMs` after the one before, over `hopMs`; the glow swells over `haloMs`; a burst of `burst.n` stars */
	win: {
		beats: [0, 700],
		hop: 16,
		staggerMs: 70,
		hopMs: 300,
		haloMs: 600,
		totalMs: 2500,
		burst: { n: 6, ms: 600, from: 0.25, to: 0.7, scale: 0.55, tint: 0xffe9a0, seed: 9 },
		/** TWO ADDING ON A LINE (two or more multiplier Wilds on one winning line): a copy of each number flies to the
		 *  line's multiplier as it shows (ms of flight, eased in), shrinking to `toScale` and fading (`alpha` to alpha x
		 *  (1 - fade)). The line's multiplier keeps its own digits (game/road/winLights.ts). */
		fly: { ms: 330, toScale: 0.55, alpha: 0.85, fade: 0.6 },
	},
	/** IDLE (at rest: between spins, Free Spins' held columns, the first board's columns): it breathes `breathe` (one
	 *  sin(t / periodMs) swing); the gold's sparkles land within spreadX / spreadY of the letters */
	idle: { breathe: 0.02, periodMs: 520, spreadX: 0.5, spreadY: 0.8 },
	/** the star sprites' turn as they shine (radians over a twinkle) */
	star: { rot: 1.4 },
};
(TUNE as Record<string, unknown>).wildMult = WILD_MULT;
(TUNE as Record<string, unknown>).wildFrame = WILD_FRAME;

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
