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
export const GROUP_ORDER = ['scene', 'ledBoard', 'logoSign', 'shadow', 'seated', 'lineWin', 'motion'];

export const GROUP_META: Record<string, { label: string; when: When }> = {
	shadow: { label: 'Shadows', when: 'live' },
	seated: { label: 'Seated drivers', when: 'live' },
	lineWin: { label: 'Win lines', when: 'win' },
	motion: { label: 'Road motion (lane stagger)', when: 'spin' },
	road: { label: 'Road', when: 'unknown' },
	stoplight: { label: 'Stoplights', when: 'live' },
	hudBed: { label: 'HUD beds', when: 'resize' },
	// scene pass 9: the lamps are read every frame (game/scene/logoSign.ts); the places on the next layout pass
	logoSign: { label: 'Billboard logo', when: 'live' },
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
const demoCard = (kind: 'fs' | 'sfs' | 'total') => (sb() ? void sb()!.card({ kind, spins: 10, amount: kind === 'total' ? round2(248.5 * scoreboardDev.bet()) : 0, fmt: scoreboardDev.fmt, rate: 1 }) : 'no scoreboard on this page');
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
	'scene.swap.tailShare': { label: 'then the outgoing scene fades out over (share of the cross-fade)', min: 0, max: 1, step: 0.05, when: 'live' },
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
	'ledBoard.cartoon': { label: 'idle cartoon (auto: all six in turn)', options: ['auto', 'trot', 'parade', 'plow', 'sleigh', 'peek', 'race'] },
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
	'brakeLights.halo.size': { label: 'halo size', min: 40, max: 260, step: 1, unit: 'road px' },
	'brakeLights.halo.brake': { label: 'halo alpha while braking', min: 0, max: 1, step: 0.01 },
	'brakeLights.halo.stopped': { label: 'halo alpha while stopped', min: 0, max: 1, step: 0.01 },
	'brakeLights.halo.strength': { label: 'halo brightness (x both alphas)', min: 0, max: 3, step: 0.05 },
	'brakeLights.halo.tint': { label: 'halo color' },
	'stoplight.follow.*': { options: ['board', 'pair'] },
	'stoplight.amberFrom': { options: ['afterGreen', 'beforeRed', 'brake'] },
	'strike.entry': { options: ['far', 'near', 'left', 'right'] },
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
