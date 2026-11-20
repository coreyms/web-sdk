// THE TUNING PANEL'S OPTIONAL LABELS (staging and dev server only; src/staging/tune/). The panel lists every value of
// TUNE (game/constants.ts) by reflection, so a new value appears with no change here. This table only makes the groups
// Corey is tuning now nicer: a label, a slider range, a unit, a fixed set of options, and WHEN a change shows.
//
// WHEN, as checked in the code on 2026-11-16 (where each group's numbers are read):
//   live    read every frame (game/road/shadows.ts, seated.ts, the stoplights' updateLights, the tunnel shade)
//   spin    read when a spin starts or a symbol is put on a car (motionFor at the drive out and the drive in)
//   win     read when a win starts (game/road/winLights.ts lightsSchedule, roadBoard showWin)
//   resize  read by the HUD beds' layout: shows on the next resize or rotation, or after a reload
//   reload  read once when the board or the scene is built: the panel remembers it (tuneStore.ts), so it applies after
//           a reload
//   unknown not checked value by value: try a spin; if it does not show, it is read at build time
import { scoreboardDev } from '../../game/scoreboard/scoreboard';
import { sceneDev } from '../../game/stateScene.svelte';

export type When = 'live' | 'spin' | 'win' | 'resize' | 'reload' | 'unknown';

export const WHEN_LABEL: Record<When, string> = {
	live: 'live',
	spin: 'applies on the next spin',
	win: 'applies on the next win',
	resize: 'applies on a resize or rotation',
	reload: 'applies after a reload (remembered)',
	unknown: 'not checked: spin to see it',
};

export type Meta = {
	label?: string;
	min?: number;
	max?: number;
	step?: number;
	unit?: string;
	/** a fixed set of values: a select */
	options?: (string | number)[];
	when?: When;
};

/** the groups first in the panel (the ones being tuned now), then the rest of TUNE in its own order */
export const GROUP_ORDER = ['signWin', 'roam', 'scene', 'ledBoard', 'logoSign', 'shadow', 'seated', 'lineWin', 'motion'];

export const GROUP_META: Record<string, { label: string; when: When }> = {
	// the roaming reindeer (2026-11-17, game/road/roam.ts): his speed, stops and walks are read as he goes; the area editor
	// (RoamEditor.svelte) is drawn in this group
	roam: { label: 'Reindeer area', when: 'live' },
	shadow: { label: 'Shadows', when: 'live' },
	// the sign wins (2026-11-19, game/road/signRig.ts): the motion, the glint and the timings are read every frame; the
	// layout, the glint color, the dot size and the 10's look (ten, tenStyles) when a sign is put on the road (the next spin)
	signWin: { label: 'Sign wins (the road signs: win, landing, idle; the 10 option is "ten")', when: 'spin' },
	seated: { label: 'Seated drivers', when: 'live' },
	lineWin: { label: 'Win lines', when: 'win' },
	motion: { label: 'Road motion (lane stagger)', when: 'spin' },
	road: { label: 'Road', when: 'unknown' },
	stoplight: { label: 'Stoplights', when: 'live' },
	hudBed: { label: 'HUD beds', when: 'resize' },
	// scene pass 9: the lamps are read every frame (game/scene/logoSign.ts); the places on the next layout pass
	logoSign: { label: 'Billboard logo', when: 'live' },
	// the Super wheel (game/road/superWheel.ts): its numbers are read as each wheel plays
	superWheel: { label: 'Super wheel', when: 'live' },
	// the Wilds' multipliers (game/road/wildMult.ts, 2026-11-19 "E Candy Cane"): the motion is read every frame; a place's
	// letter height and width when the number next changes
	wildMult: { label: 'Wild multipliers (candy lettering)', when: 'live' },
	// the scene swap (2026-11-17): the three presets by hand, the cross-fade's length (read when a swap starts)
	scene: { label: 'Scene (the snow and the dark grass sets: day, Free Spins and Super; forest, edge cover)', when: 'resize' },
	// the LED scoreboard (game/scoreboard/): the rise, the timings and the cartoon are read every frame or at a show's
	// start; the strip's place rules on the next layout pass
	ledBoard: { label: 'LED board', when: 'live' },
};

/** A GROUP'S BUTTONS (shown under its Reset group): things to play now, not values. The LED board's go through
 *  game/scoreboard/scoreboard.ts scoreboardDev, which a staging build has too (the window dev hook is the dev server's only). */
export type Action = { label: string; run: () => string | void };
const sb = () => scoreboardDev.board;
const round2 = (v: number) => Math.round(v * 100) / 100;
const demoWin = (x: number) => (sb() ? void sb()!.win({ x, amount: round2(x * scoreboardDev.bet()), bet: scoreboardDev.bet(), fmt: scoreboardDev.fmt, rate: 1, auto: false }) : 'no scoreboard on this page');
const demoCard = (kind: 'fs' | 'sfs' | 'total') => (sb() ? void sb()!.card({ kind, spins: 10, amount: kind === 'total' ? round2(248.5 * scoreboardDev.bet()) : 0, fmt: scoreboardDev.fmt, rate: 1, x: kind === 'total' ? 248.5 : 0 }) : 'no scoreboard on this page');
export const GROUP_ACTIONS: Record<string, Action[]> = {
	// THE SCENE SWAP (game/scene/sceneSwap.ts): the scene cross-fades to the preset asked (its pieces load first if they are
	// not in); the next change of the round's mode (a bonus starting or ending) asks for its own scene again. The grass
	// presets are the Dark set's (dark mode): a button shows one by hand without changing the player's Scene setting (the
	// set in use stays loaded, as with the snow buttons: one bonus scene asked from another holds three for that one fade)
	scene: [
		{ label: 'Day snow (base game)', run: () => void sceneDev.show('snowDay') },
		{ label: 'Night snow (Free Spins)', run: () => void sceneDev.show('snowNight') },
		{ label: 'Deep night (Super Free Spins)', run: () => void sceneDev.show('snowSuper') },
		{ label: 'Dark grass (base game)', run: () => void sceneDev.show('grassDay') },
		{ label: 'Dark grass (Free Spins)', run: () => void sceneDev.show('grassNight') },
		{ label: 'Dark grass (Super Free Spins)', run: () => void sceneDev.show('grassSuper') },
	],
	ledBoard: [
		{ label: 'Raise the board', run: () => (sb() ? void sb()!.raise() : 'no scoreboard on this page') },
		{ label: 'Lower the board', run: () => (sb() ? void sb()!.lower() : 'no scoreboard on this page') },
		{ label: 'Play the Grandma gag', run: () => (sb() ? void sb()!.gag() : 'no scoreboard on this page') },
		{ label: 'Play the race', run: () => (sb() ? void sb()!.race(null) : 'no scoreboard on this page') },
		{ label: 'Race: reindeer wins', run: () => void sb()?.race('reindeer') },
		{ label: 'Race: police car wins', run: () => void sb()?.race('police') },
		{ label: 'Race: tie', run: () => void sb()?.race('tie') },
		{ label: 'Big win (21.85x)', run: () => void sb()?.win({ x: 21.85, amount: 21.85 * scoreboardDev.bet(), bet: scoreboardDev.bet(), fmt: scoreboardDev.fmt, rate: 1, auto: false }) },
		{ label: 'Small win (3.4x)', run: () => void sb()?.win({ x: 3.4, amount: 3.4 * scoreboardDev.bet(), bet: scoreboardDev.bet(), fmt: scoreboardDev.fmt, rate: 1, auto: false }) },
		// part B: the staged scenes (a win by hand lowers by itself; a card scene waits for Press the card or Lower the board)
		{ label: 'Mega scene (98.75x)', run: () => demoWin(98.75) },
		{ label: 'Epic scene (312.45x)', run: () => demoWin(312.45) },
		{ label: 'Max scene (7,777x)', run: () => demoWin(7777) },
		{ label: 'Free Spins entry', run: () => demoCard('fs') },
		{ label: 'Super entry', run: () => demoCard('sfs') },
		{ label: 'Total Win (248.50x)', run: () => demoCard('total') },
		{ label: 'Press the card (land, then continue)', run: () => (sb() ? void (sb()!.cardPress() || sb()!.endCard()) : 'no scoreboard on this page') },
	],
};

const ms = (max: number, label?: string): Meta => ({ min: 0, max, step: 10, unit: 'ms', label });

/** by path below TUNE; a `*` stands for any one key */
export const META: Record<string, Meta> = {
	// the sign wins: the mock's own controls and ranges (sign_wins_r1_2026-11-19 index.html)
	'signWin.cand': { label: 'candidate (0 pulse, 1 glint, 2 motion, 3 both)', options: [0, 1, 2, 3] },
	'signWin.pulse': { label: "today's pulse", options: ['off', 'soft', 'on'] },
	'signWin.land': { label: 'landing', options: ['today', 'hinged'] },
	'signWin.idle': { label: 'idle', options: ['glint', 'twitch', 'both', 'off'] },
	'signWin.ten': { label: 'the 10 (white sign) look', options: ['off', 'a', 'b', 'c'] },
	'signWin.glint.layout': { label: 'reflector layout', options: ['ring', 'field', 'sparse'] },
	'signWin.glint.color': { label: 'glint color', options: ['face', 'white', 'ice'] },
	'signWin.glint.intensity': { min: 0, max: 2, step: 0.05 },
	'signWin.glint.size': { label: 'dot size', min: 0.5, max: 1.8, step: 0.05 },
	'signWin.glint.width': { label: 'light band', min: 6, max: 40, step: 1, unit: 'road px' },
	'signWin.glint.bloom': { min: 2, max: 8, step: 0.1 },
	'signWin.glint.ms': ms(900, 'sweep'),
	'signWin.glint.sweeps': { min: 1, max: 2, step: 1 },
	'signWin.glint.rest': { label: 'seen at rest (the 10 only; the others are baked)', min: 0, max: 0.6, step: 0.02 },
	'signWin.glint.sparkle': { label: 'sparkles', min: 0, max: 1.5, step: 0.05 },
	'signWin.glint.bolts': { label: 'bolt glint', min: 0, max: 1.5, step: 0.05 },
	'signWin.alive.rock': { label: 'rock', min: 0, max: 8, step: 0.1, unit: 'deg' },
	'signWin.alive.freq': { label: 'spring', min: 1.2, max: 4, step: 0.1, unit: 'Hz' },
	'signWin.alive.damp': ms(900, 'settle'),
	'signWin.alive.deco': { label: 'decorations', min: 0, max: 1.6, step: 0.05 },
	'signWin.alive.snow': { label: 'snow cap lag', min: 0, max: 2, step: 0.05 },
	'signWin.alive.flakes': { label: 'flakes shed', min: 0, max: 10, step: 1 },
	'signWin.alive.shudder': { min: 0, max: 2, step: 0.05 },
	'signWin.alive.pivot': { label: 'pivot', options: ['ground', 'post'] },
	'signWin.alive.beat': { label: 'the glint lands on', options: ['lean', 'back', 'settle'] },
	'signWin.landing.flakes': { label: 'landing flakes', min: 0, max: 6, step: 1 },
	'shadow.angle': { label: 'angle', min: 0, max: 90, step: 1, unit: 'deg' },
	'shadow.length': { label: 'length', min: 0, max: 2.5, step: 0.01, unit: 'x height' },
	'shadow.alpha': { label: 'alpha', min: 0, max: 1, step: 0.01 },
	'shadow.column.dx': { min: -80, max: 80, step: 1, unit: 'road px' },
	'shadow.column.dy': { min: -80, max: 80, step: 1, unit: 'road px' },
	'shadow.column.alpha': { min: 0, max: 1, step: 0.01 },
	'shadow.columnInMs': ms(600),

	'seated.place.H1_R': { label: 'Grandma, driving right' },
	'seated.place.H1_L': { label: 'Grandma, driving left' },
	'seated.place.W_R': { label: 'Santa, driving right' },
	'seated.place.W_L': { label: 'Santa, driving left' },
	'seated.place.*.dx': { min: -40, max: 40, step: 0.5, unit: 'road px' },
	'seated.place.*.dy': { min: -40, max: 40, step: 0.5, unit: 'road px' },
	'seated.place.*.scale': { min: 0.7, max: 1.3, step: 0.005, unit: 'x built' },
	'seated.leanShare.*': { min: 0, max: 1.5, step: 0.05 },
	'seated.bob.px': { min: 0, max: 12, step: 0.5, unit: 'road px' },

	'lineWin.lights.staggerMs': ms(1500, 'first gap'),
	'lineWin.lights.gapRatio': { label: 'gap ratio (acceleration)', min: 0.2, max: 1.5, step: 0.01 },
	'lineWin.lights.gapFloorMs': ms(1000, 'shortest gap'),
	'lineWin.lights.drawMs': ms(1500, 'string time'),
	'lineWin.lights.drawFloorMs': ms(1500, 'shortest string time'),
	'lineWin.lights.stayLitMs': ms(4000, 'stay lit'),
	'lineWin.lights.takeDownMs': ms(2000, 'take down'),
	'lineWin.lights.downMode': { label: 'when a line comes down', options: ['next', 'hold', 'end'] },
	'lineWin.holdShare.*': { min: 0, max: 1, step: 0.05 },
	// the wire's ends, the nails (2026-11-18, constants LINE_WIN lights tips; read when a win starts)
	'lineWin.lights.tips.on': { label: 'nails at the wire ends (off: square ends)' },
	'lineWin.lights.tips.end': { label: 'where the nails go', options: ['edge', 'center'] },
	'lineWin.lights.tips.edgeGap': { label: 'nail past the symbol edge', min: 0, max: 60, step: 1, unit: 'road px' },
	'lineWin.lights.tips.popMs': ms(600, 'nail pop in'),
	'lineWin.lights.tips.outMs': ms(600, 'nail pop out'),
	// LINE WINS, TREATMENT B (2026-11-17, constants LINE_WIN slam; read when a win starts, game/road/winLights.ts slamSchedule)
	'lineWin.slam': { label: 'Line win slam (treatment B)', when: 'win' },
	'lineWin.slam.on': { label: 'slam on (off: the old total over the board)' },
	'lineWin.slam.strength': { label: 'slam strength', min: 0, max: 1.5, step: 0.05 },
	'lineWin.slam.perLineLitMs': ms(2500, 'per line lit time'),
	'lineWin.slam.stripTotal': { label: 'strip total', options: ['count', 'appear'] },
	'lineWin.slam.stripCountMs': ms(2000, 'strip total count'),
	'lineWin.slam.beats.*': ms(600),

	'motion.base.out.laneStaggerMs': ms(300, 'drive out: lane stagger'),
	'motion.base.out.carStaggerMs': ms(300, 'drive out: car stagger'),
	'motion.base.in.laneStaggerMs': ms(400, 'drive in: lane stagger'),
	'motion.base.in.carStaggerMs': ms(300, 'drive in: car stagger'),
	'motion.base.in.delayMs': ms(800, 'drive in: delay'),

	'road.laneDirection': { when: 'reload' },
	'road.laneDirection.*': { options: [1, -1] },
	'road.rock': { when: 'reload' },
	'road.snow': { when: 'reload' },
	'road.tunnelShade': { when: 'live' },
	'road.symbolScale': { when: 'spin' },
	'road.symbolScale.*': { min: 0.5, max: 1.5, step: 0.01 },
	'road.sitAboveLine': { when: 'spin' },

	'scene.swap': { when: 'live' },
	'scene.swap.fadeMs': { ...ms(2000, 'cross-fade'), when: 'live' },
	'scene.swap.unload': { label: 'let the night pieces go after the swap back', when: 'live' },
	'logoSign.place': { when: 'resize' },
	'logoSign.pressCapOverlap': { label: 'press screen, upright phone: the sign into the LED cap', min: -10, max: 10, step: 0.5, unit: 'CSS px', when: 'resize' },
	'logoSign.pressLiftBackMs': ms(1500, 'press screen: the sign back to its place over'),
	'logoSign.place.*.cx': { min: -600, max: 600, step: 1, unit: 'road px' },
	'logoSign.place.*.foot': { min: -400, max: 600, step: 1, unit: 'road px' },
	'logoSign.place.*.width': { min: 120, max: 700, step: 1, unit: 'road px' },
	'logoSign.place.*.topGap': { min: 0, max: 80, step: 1, unit: 'master' },
	'logoSign.lamps.darkMs': ms(3000, 'dark at the start'),
	'logoSign.lamps.stepMs': ms(2000, 'second lamp on after'),
	'logoSign.lamps.holdMs': ms(5000, 'both lit before the blink'),
	'logoSign.lamps.periodMs': { label: 'blink period', min: 400, max: 6000, step: 50, unit: 'ms' },
	'logoSign.lamps.litShare': { label: 'lit share of the period', min: 0.1, max: 0.9, step: 0.01 },
	'logoSign.lamps.rightPhase': { label: 'right lamp phase (0.5 alternate, 0.25 chase, 0 together)', min: 0, max: 1, step: 0.05 },
	'logoSign.lamps.fadeMs': ms(800, 'fade'),
	'logoSign.lamps.glowAlpha': { label: 'glow strength', min: 0, max: 1, step: 0.01 },
	'logoSign.lamps.glowSize': { label: 'glow size (lens radii)', min: 1, max: 6, step: 0.1 },
	'logoSign.lamps.darkFloor': { label: 'dark lamp keeps', min: 0, max: 1, step: 0.01 },
	'ledBoard.on': { when: 'reload' },
	'ledBoard.cartoon': { label: 'idle cartoon (auto: all in turn, the order in LED ideas)', options: ['auto', 'trot', 'tree', 'parade', 'chew', 'plow', 'takeoff', 'sleigh', 'signroll', 'peek', 'stack', 'race'] },
	'ledBoard.ideas': { label: 'LED ideas (round 1 picks)', when: 'live' },
	'ledBoard.ideas.fsEntry': { label: 'Free Spins entry', options: ['presents', 'today'] },
	'ledBoard.ideas.sfsEntry': { label: 'Super entry', options: ['tease', 'today'] },
	'ledBoard.ideas.fsPresents': { label: 'Free Spins entry: presents for a card by hand (a real round pops its own trigger count)', min: 3, max: 5, step: 1 },
	'ledBoard.ideas.total': { label: 'Total Win', options: ['ladder', 'today'] },
	'ledBoard.ideas.totalBySize': { label: 'Total Win count by size (off: 3 s for all)' },
	'ledBoard.ideas.totalBySize.ms.*': ms(8000),
	'ledBoard.ideas.capPageHold': { label: "the cap's page after the landing (off: at once)" },
	'ledBoard.ideas.capPageHold.ms': ms(4000),
	'ledBoard.fps': { label: 'dot refresh', min: 10, max: 60, step: 1, unit: 'per s' },
	'ledBoard.strip': { when: 'resize' },
	'ledBoard.strip.desktop': { label: 'Strip: desktop and tablet' },
	'ledBoard.strip.portrait': { label: 'Strip: upright phone' },
	'ledBoard.strip.phone': { label: 'Strip: phone held sideways' },
	'ledBoard.strip.*.width': { label: 'width factor', min: 0.3, max: 1, step: 0.01 },
	'ledBoard.strip.*.topShare': { label: 'top (share of the band)', min: 0, max: 0.6, step: 0.01 },
	'ledBoard.strip.*.heightShare': { label: 'height (share of the band)', min: 0.3, max: 1, step: 0.01 },
	'ledBoard.strip.*.heightRoad': { label: 'height cap', min: 0, max: 250, step: 1, unit: 'road px' },
	'ledBoard.strip.*.roadY': { label: "the road's bottom edge", min: 800, max: 1024, step: 1, unit: 'road px' },
	'ledBoard.strip.*.lanesW': { label: 'width basis', min: 0, max: 1536, step: 1, unit: 'road px' },
	'ledBoard.strip.*.backShare': { label: 'back board height (share of the room)', min: 0.2, max: 1.5, step: 0.01 },
	'ledBoard.strip.*.pad': { min: -10, max: 10, step: 0.5, unit: 'CSS px' },
	'ledBoard.strip.switchMs': { when: 'live' },
	'ledBoard.strip.dissolveMs': { when: 'live' },
	'ledBoard.strip.dimOutMs': { when: 'win' },
	'ledBoard.rise': { label: 'Rise (style C)', when: 'win' },
	'ledBoard.rise.backAtMs': ms(400, 'starts after'),
	'ledBoard.rise.riseMs': ms(1500, 'rise'),
	'ledBoard.rise.overshoot': { label: 'overshoot (ease back amount)', min: 0, max: 5, step: 0.1 },
	'ledBoard.rise.bouncePx': { label: 'bounce', min: 0, max: 12, step: 0.5, unit: 'px at a 420 px board' },
	'ledBoard.rise.bounceMs': ms(600, 'bounce'),
	'ledBoard.rise.hopPx': { label: 'hop before lowering', min: 0, max: 20, step: 0.5, unit: 'px at a 420 px board' },
	'ledBoard.rise.powerDownMs': ms(800, 'power down'),
	'ledBoard.rise.lowerMs': ms(1500, 'lower'),
	'ledBoard.rise.scanMs': ms(800, 'power on scan'),
	'ledBoard.tiers': { when: 'win' },
	'ledBoard.pace': { label: 'The count (house pacer)', when: 'win' },
	'ledBoard.pace.countMs.*': ms(12000),
	'ledBoard.pace.holdMs': ms(4000, 'hold'),
	'ledBoard.pace.holdAutoMs': ms(4000, 'hold in autoplay'),
	'ledBoard.small': { label: 'Small win', when: 'win' },
	'ledBoard.gag': { label: 'Grandma gag', when: 'live' },
	// (2026-11-18) the explanation on the big board: one page (A) or two pages (B)
	'ledBoard.explain': { label: 'Entry explanation on the big board', when: 'live' },
	'ledBoard.explain.layout': { label: 'layout (C1, C2: one page with the board look; A: one page, small heading; B: two pages)', options: ['C1', 'C2', 'A', 'B'] },
	'ledBoard.explain.maxLinesC': { label: 'C: the sentence at most this many lines', min: 2, max: 6, step: 1 },
	'ledBoard.explain.minCap': { label: 'C: the sentence at least this tall', min: 5, max: 20, step: 1, unit: 'dots' },
	'ledBoard.explain.readShare': { label: "C: the sentence at least this share of the number's height", min: 0.15, max: 0.7, step: 0.01 },
	'ledBoard.explain.margin': { label: 'C: the margin (share of the board)', min: 0.02, max: 0.1, step: 0.005 },
	'ledBoard.explain.headShare': { label: 'A: the head share of the board', min: 0.25, max: 0.6, step: 0.01 },
	'ledBoard.explain.pageMs.*': ms(8000),
	'ledBoard.explain.wipeMs': ms(1000, 'wipe'),
	'ledBoard.gag.ms': ms(10000, 'length'),
	'ledBoard.race': { label: 'Race', when: 'live' },
	'ledBoard.race.odds.*': { min: 0, max: 1, step: 0.01 },
	// part B: the staged scenes, the cards, the shakes, the tier sounds
	'ledBoard.cards': { label: 'bonus round cards (board: the LED scenes, card: the HTML card)', options: ['board', 'card'], when: 'win' },
	'ledBoard.scenes': { label: 'Staged scenes', when: 'live' },
	'ledBoard.scenes.band': { label: 'win scenes: bottom band (share of the face)', min: 0.1, max: 0.4, step: 0.01 },
	'ledBoard.scenes.bounceTitle': { label: 'win scenes: bouncing title letters' },
	'ledBoard.scenes.fsPressMs': ms(6000, 'Free Spins entry: press line after'),
	'ledBoard.scenes.sfsPressMs': ms(6000, 'Super entry: press line after'),
	'ledBoard.scenes.fsReadyMs': ms(6000, 'Free Spins entry: a press jumps to'),
	'ledBoard.scenes.sfsReadyMs': ms(6000, 'Super entry: a press jumps to'),
	'ledBoard.scenes.totalCountMs': { ...ms(10000, 'Total Win: count'), when: 'win' },
	'ledBoard.scenes.totalPressAfterMs': { ...ms(2000, 'Total Win: press line after the landing'), when: 'win' },
	// 2026-11-17: the entry's sentence on the strip, the back board's titles per layout class
	'ledBoard.entryLine': { label: "Entry sentence on the strip (the intro card's line while the entry waits)", when: 'live' },
	'ledBoard.entryLine.charsPerSec': { label: 'scroll speed', min: 3, max: 30, step: 0.5, unit: 'letters per s' },
	'ledBoard.entryLine.pressMs': ms(4000, 'short strip only: press line between passes'),
	'ledBoard.titles': { label: 'Back board titles (BIG to MAX WIN, FREE SPINS, TOTAL WIN; always centered by the code)', when: 'live' },
	'ledBoard.titles.desktop': { label: 'Titles: desktop and tablet' },
	'ledBoard.titles.phone': { label: 'Titles: phone held sideways' },
	'ledBoard.titles.portrait': { label: 'Titles: upright phone' },
	'ledBoard.titles.*.size': { label: 'title size (x the size the layout picks; kept inside the board)', min: 0.3, max: 2, step: 0.05 },
	'ledBoard.titles.gap': { label: 'gap between a title and its amount', min: -6, max: 20, step: 1, unit: 'dots' },
	'ledBoard.titles.bounce': { label: 'bounce strength (x the bouncing letters\' lift)', min: 0, max: 2, step: 0.05 },
	'ledBoard.shake': { label: 'Shakes', when: 'live' },
	'ledBoard.shake.px': { label: 'size', min: 0, max: 20, step: 0.5, unit: 'px at a 420 px board' },
	'ledBoard.shake.amp.*': { min: 0, max: 3, step: 0.05 },
	'ledBoard.shake.ms': ms(1500, 'length'),
	'ledBoard.shake.periodMs': ms(300, 'period'),
	'ledBoard.shake.decayMs': ms(1000, 'dies over'),
	'ledBoard.shake.joltPx': { label: 'tier change jolt', min: 0, max: 12, step: 0.5, unit: 'px at a 420 px board' },
	'ledBoard.shake.joltMs': ms(600, 'jolt length'),
	'ledBoard.shake.superEntryAmp': { label: 'Super entry shake', min: 0, max: 3, step: 0.05 },
	'ledBoard.tierSounds': { label: 'Tier sounds', when: 'win' },
	'ledBoard.tierSounds.fadeMs': ms(600, "the tier before's sound fades out over"),
	'ledBoard.tierSounds.lengthMs': ms(3000, 'a tier sound is still playing for'),
	'ledBoard.fastChase': { label: 'chase borders as runs (same dots, cheaper)' },
	// THE FINER GRID (2026-11-19, game/scoreboard/ledGrid.ts): read every frame; a change rebuilds both faces at once
	// THE FACES' MOVING EFFECTS AND THE SOFT FLASHES (2026-11-20, led_board_size_r1 round 2): read every step; today's
	// choice of each kept for comparison
	'ledBoard.effects': { label: 'Moving effects (band, power on, strip switch, glint)', when: 'live' },
	'ledBoard.effects.band': { label: 'moving light band (today: on)' },
	'ledBoard.effects.powerOn': { label: 'back board power on (today: scan)', options: ['dissolve', 'scan'] },
	'ledBoard.effects.dissolveOnMs': ms(1000, 'power on dissolve'),
	'ledBoard.effects.stripSwitch': { label: 'strip switch to a message (today: scan)', options: ['dissolve', 'scan'] },
	'ledBoard.effects.glint': { label: 'border glint (today: none)' },
	'ledBoard.effects.glint.len': { label: 'length', min: 4, max: 200, step: 1, unit: 'dots' },
	'ledBoard.effects.glint.rows': { label: 'depth', min: 1, max: 6, step: 1, unit: 'dots' },
	'ledBoard.effects.glint.periodS': { label: 'once round every', min: 0.5, max: 12, step: 0.1, unit: 's' },
	'ledBoard.effects.glint.alpha': { label: 'brightness at its head', min: 0, max: 1, step: 0.05 },
	'ledBoard.strobe': { label: 'Full board flashes (soft fade or today)', when: 'live' },
	'ledBoard.strobe.slamFlash': { label: 'slam flash', options: ['soft', 'today'] },
	'ledBoard.strobe.pulse': { label: 'number and tier pulse (Max wash)', options: ['soft', 'today'] },
	'ledBoard.strobe.ladderFlash': { label: 'ladder rung wash', options: ['soft', 'today'] },
	'ledBoard.strobe.softStrength': { label: 'soft: strength', min: 0, max: 1, step: 0.05 },
	'ledBoard.strobe.softLength': { label: 'soft: length', min: 1, max: 5, step: 0.1, unit: 'x' },
	// THE BOARD'S SIZE ON DESKTOP AND TABLET (2026-11-20, option d): read by the layout, so it shows on a resize
	'ledBoard.size': { label: 'board size on desktop and tablet (d: the reel board\'s box; today: the old rule)', options: ['d', 'today'], when: 'resize' },
	'ledBoard.sizeD': { label: 'Board size d: title sizes', when: 'live' },
	'ledBoard.sizeD.winTitleMax': { label: 'win titles largest dot scale', min: 3, max: 9, step: 1 },
	'ledBoard.sizeD.pressScaleMax': { label: 'press screen figure largest dot scale', min: 4, max: 10, step: 1 },
	// THE DOT GRID (2026-11-20): his pick is today's grid; the others to compare (the tile is made again on a change)
	'ledBoard.grid': { label: 'Dot grid (today: round, 0.73, row 1, gaps 1, lit over 0, no snap, unlit grid)', when: 'live' },
	'ledBoard.grid.shape': { label: 'dot shape', options: ['round', 'square', 'soft'] },
	'ledBoard.grid.fill': { label: 'dot size (of the pitch)', min: 0.5, max: 1, step: 0.01 },
	'ledBoard.grid.rowScale': { label: 'row gap against column gap', min: 0.6, max: 1.4, step: 0.02 },
	'ledBoard.grid.gapDark': { label: 'gap darkness', min: 0, max: 1, step: 0.02 },
	'ledBoard.grid.litOver': { label: 'grid on lit areas (lit over)', min: 0, max: 1, step: 0.02 },
	'ledBoard.grid.snap': { label: 'whole device px per LED' },
	'ledBoard.grid.unlit': { label: 'unlit dots shown (faint grid)' },
	'ledBoard.density': { label: 'LED grid density (finer grid: 1.5 LEDs per dot where an LED stays 2 device px)', when: 'live' },
	'ledBoard.density.on': { label: 'finer grid on' },
	'ledBoard.density.k': { label: 'LEDs per dot', min: 1, max: 3, step: 0.5 },
	'ledBoard.density.minDevicePx': { label: 'least size of an LED (else today\'s grid)', min: 1, max: 4, step: 0.1, unit: 'device px' },
	'ledBoard.density.smallWeight': { label: 'small lines weight (700 Bold, 800 Extra Bold, 900 Heavy)', options: [700, 800, 900] },
	'ledBoard.density.bodyWeight': { label: 'body sentence weight (700 Bold, 800 Extra Bold, 900 Heavy)', options: [700, 800, 900] },
	'ledBoard.density.softDot': { label: 'soft dot in the grille (finer grid only)' },
	'brakeLights.halo.size': { label: 'halo size', min: 40, max: 260, step: 1, unit: 'road px' },
	'brakeLights.halo.brake': { label: 'halo alpha while braking', min: 0, max: 1, step: 0.01 },
	'brakeLights.halo.stopped': { label: 'halo alpha while stopped', min: 0, max: 1, step: 0.01 },
	'brakeLights.halo.strength': { label: 'halo brightness (x both alphas)', min: 0, max: 3, step: 0.05 },
	'brakeLights.halo.tint': { label: 'halo color' },
	'stoplight.follow.*': { options: ['board', 'pair'] },
	'stoplight.amberFrom': { options: ['afterGreen', 'beforeRed', 'brake'] },
	'strike.entry': { options: ['far', 'near', 'left', 'right'] },
	'strike.roam': { label: 'roaming reindeer (off: every strike from off the screen, as before)', when: 'live' },
	'roam.walkSpeedPct': { label: 'walk speed (share of the screen width per second)', min: 0.5, max: 12, step: 0.1, unit: '%' },
	'roam.maxPace': { label: 'walk: fastest stride (x the rig\'s own walk; the speed is held back to it)', min: 0.5, max: 5, step: 0.05 },
	'roam.walkInMul': { label: 'walk in speed (x the walk speed)', min: 1, max: 5, step: 0.1 },
	'roam.maxInPace': { label: 'walk in: fastest stride (x the rig\'s own walk)', min: 0.5, max: 6, step: 0.05 },
	'roam.idleMinMs': { ...ms(15000, 'stop at a spot: at least') },
	'roam.idleMaxMs': { ...ms(30000, 'stop at a spot: at most') },
	'roam.hopMinPct': { label: 'walk length: at least (share of the screen width)', min: 0, max: 50, step: 0.5, unit: '%' },
	'roam.hopMaxPct': { label: 'walk length: at most (share of the screen width)', min: 1, max: 100, step: 0.5, unit: '%' },
	'roam.maxSlopeDeg': { label: 'steepest walk (degrees from level)', min: 0, max: 60, step: 1, unit: 'deg' },
	'roam.exploreSlopeDeg': { label: 'steepest walk to new ground (when level walks only revisit)', min: 0, max: 60, step: 1, unit: 'deg' },
	'roam.walkInDelayMs': { ...ms(5000, 'walk in after the last strike by') },
	'roam.minRunShare': { label: 'a late run: sped up to at most 1 / this', min: 0.3, max: 1, step: 0.05 },
	'roam.seed': { label: 'wander seed (0: a new one each page)', min: 0, max: 99999999, step: 1, when: 'reload' },
};

const matches = (pattern: string, path: string[]) => {
	const p = pattern.split('.');
	return p.length === path.length && p.every((s, i) => s === '*' || s === path[i]);
};

/** the metadata for a path (an exact entry wins over a `*` one) */
export const metaFor = (path: string[]): Meta => {
	const exact = META[path.join('.')];
	if (exact) return exact;
	for (const [k, m] of Object.entries(META)) if (k.includes('*') && matches(k, path)) return m;
	return {};
};

/** when a change to this path shows: the nearest entry up the path, else its group's */
export const whenFor = (path: string[]): When => {
	for (let n = path.length; n > 1; n--) {
		const m = metaFor(path.slice(0, n));
		if (m.when) return m.when;
	}
	return GROUP_META[path[0]]?.when ?? 'unknown';
};

/** a color by its name: an integer above 255 under a key that names a color (tint, fill, stroke, palettes ...) */
const COLOR_KEY = /(colou?rs?|tints?|fill|stroke|snow|rock|palettes?|edge)$/i;
export const isColor = (path: string[], v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 255 && v <= 0xffffff && path.some((s) => COLOR_KEY.test(s));

/** a slider range around a default, where the table gives none */
export const rangeFor = (path: string[], d: number): { min: number; max: number; step: number } => {
	const m = metaFor(path);
	const key = path[path.length - 1];
	if (m.min !== undefined && m.max !== undefined) return { min: m.min, max: m.max, step: m.step ?? (Number.isInteger(d) ? 1 : 0.01) };
	if (/alpha|share|dim|fade|frac|from$|bloom|flicker|glint/i.test(key) && d >= 0 && d <= 1) return { min: 0, max: 1, step: 0.01 };
	if (/Ms$/.test(key)) return { min: 0, max: Math.max(100, Math.ceil((d * 3) / 10) * 10), step: d >= 100 ? 10 : 1 };
	if (/Deg$|deg$/.test(key)) return { min: Math.min(0, -Math.abs(d) * 3), max: Math.max(10, Math.abs(d) * 3), step: 0.1 };
	if (d === 0) return { min: -50, max: 50, step: 1 };
	const a = Math.abs(d);
	const span = a * 3;
	const step = Number.isInteger(d) && a >= 10 ? 1 : Math.pow(10, Math.floor(Math.log10(a)) - 2);
	return d > 0 ? { min: 0, max: span, step } : { min: -span, max: span, step };
};
