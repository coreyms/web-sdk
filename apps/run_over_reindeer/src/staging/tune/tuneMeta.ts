// THE TUNING PANEL'S OPTIONAL LABELS (staging and dev server only; src/staging/tune/). The panel lists every value of
// TUNE (game/constants.ts) by reflection, so a new value appears with no change here. This table only makes the groups
// Corey is tuning now nicer: a label, a slider range, a unit, a fixed set of options, and WHEN a change shows.
//
// WHEN, as checked in the code on 2026-11-16 (where each group's numbers are read):
//   live    read every frame (game/road/shadows.ts, seated.ts, the stoplights' updateLights, the tunnel shade)
//   spin    read when a spin starts or a symbol is put on a car (motionFor at the drive out and the drive in)
//   win     read when a win starts (game/road/winLights.ts lightsSchedule, roadBoard showWin)
//   resize  read by the HUD beds' layout: shows on the next resize or rotation, or after a reload
//   reload  read once when the board or the scene is built: a reload resets it, so it cannot be tried here
//   unknown not checked value by value: try a spin; if it does not show, it is read at build time
export type When = 'live' | 'spin' | 'win' | 'resize' | 'reload' | 'unknown';

export const WHEN_LABEL: Record<When, string> = {
	live: 'live',
	spin: 'applies on the next spin',
	win: 'applies on the next win',
	resize: 'applies on a resize or rotation',
	reload: 'needs a reload (cannot be tried here)',
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
export const GROUP_ORDER = ['shadow', 'seated', 'lineWin', 'motion'];

export const GROUP_META: Record<string, { label: string; when: When }> = {
	shadow: { label: 'Shadows', when: 'live' },
	seated: { label: 'Seated drivers', when: 'live' },
	lineWin: { label: 'Win lines', when: 'win' },
	motion: { label: 'Road motion (lane stagger)', when: 'spin' },
	road: { label: 'Road', when: 'unknown' },
	stoplight: { label: 'Stoplights', when: 'live' },
	hudBed: { label: 'HUD beds', when: 'resize' },
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
