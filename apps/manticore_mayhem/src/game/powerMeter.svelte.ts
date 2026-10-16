// THE BOARD POWER METER, MOCKUP r1 (DEV only; feedback/power_meter_r1/README.md). One driver, four placements.
//
// THE NUMBER: the sum of the multiplier tile values the board shows right now (stateGame.tiles, which holds the book's
// cascade.tiles / swipe.tiles / reveal.tiles exactly as written, never re-derived). It is the sum a cluster would
// multiply by if it covered every lit tile ("A cluster on Multiplier Tiles wins its value times their sum"), so it is a
// ceiling and a measure, never a promise of a pay. It only moves when the board itself moves: a plate's value is
// written when that plate starts its count-over (stateGame plateReveal / startPlate), so the meter never runs ahead of
// what the player can see, and at rest it equals the book's grid.
//
// Where it shows: the free spins only (gameType 'freegame'). In the base game every spin's reveal clears the tiles, so
// the sum sits at 0 on 72% of spins and resets on the next press; a readout that mostly says 0 advertises the still
// board the review complains about. ?meterBase=1 shows it in the base game too, to compare.
//
// Placements (?meter=): A the bronze plaque under the board (components/BoardPlaque.svelte), B a tally plate on the top
// rail and D a gauge on the left post (components/PowerMeter.svelte), C a readout in the HTML HUD (ui/Chrome*.svelte).
// Nothing here runs without ?meter= in a DEV build: METER_VARIANT is null in a production build.
import { POWER_METER } from './constants';
import { stateGame, timeScale } from './stateGame.svelte';

export type MeterVariant = 'A' | 'B' | 'C' | 'D';

const param = (key: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(key));
const raw = import.meta.env.DEV ? (param('meter') ?? '').toUpperCase() : '';
/** the placement under test, or null (a production build, or no ?meter=) */
export const METER_VARIANT: MeterVariant | null = raw === 'A' || raw === 'B' || raw === 'C' || raw === 'D' ? raw : null;
/** DEV comparison: show the meter in the base game too */
export const METER_IN_BASE = import.meta.env.DEV && param('meterBase') === '1';

/** the Pixi renderers' plain copy (no reactive reads per frame): written by meterTick only */
export const meterLive = {
	on: false,
	/** the board's sum now, and how many cells are lit (a value above 0) */
	target: 0,
	lit: 0,
	/** the number drawn (an integer, counting from `from` to `target`) */
	shown: 0,
	from: 0,
	t0: -1,
	ms: 1,
	/** the readout's alpha (fades in and out with the feature) and its pop scale */
	alpha: 0,
	pop: 1,
	popT0: -1,
	popMs: 1,
	popAmp: 0,
	/** bumped on every rise: the HTML readout re-keys its pop animation on it */
	popSeq: 0,
	lastNow: 0,
};

/** the HTML HUD's reactive copy (placement C): written only when the shown integer, the pop or the on state changes */
export const meter = $state({ on: false, shown: 0, popSeq: 0, big: false });

/** the readout's text in the label face and in the plaque's Cinzel set */
export const meterNumber = (n: number) => `${POWER_METER.prefix}${n}`;
export const meterPlaqueText = (n: number) => `${POWER_METER.word} ${POWER_METER.plaquePrefix}${n}`;

const ease = (u: number) => 1 - Math.pow(1 - u, 3);

/** one frame of the driver: sum the board, count, pop, fade. Called by PowerMeter.svelte's ticker (always mounted
 *  when METER_VARIANT is set). Allocates nothing. */
export const meterTick = (now: number) => {
	const L = meterLive;
	const dt = L.lastNow ? Math.min(100, now - L.lastNow) : 16;
	L.lastNow = now;
	const tiles = stateGame.tiles;
	let sum = 0;
	let lit = 0;
	for (let i = 0; i < tiles.length; i += 1) {
		const v = tiles[i].value;
		if (v > 0) {
			sum += v;
			lit += 1;
		}
	}
	L.lit = lit;
	const on = METER_VARIANT !== null && (stateGame.gameType === 'freegame' || METER_IN_BASE);
	const rate = Math.max(0.2, timeScale());
	if (sum !== L.target) {
		if (sum > L.target && on && !stateGame.skipping) {
			// a rise: count up from what is drawn now, and pop
			L.from = L.shown;
			L.t0 = now;
			L.ms = Math.max(1, POWER_METER.countMs / rate);
			L.popT0 = now;
			L.popMs = Math.max(1, POWER_METER.popMs / rate);
			L.popAmp = sum - L.target >= POWER_METER.bigRise ? POWER_METER.bigPopScale : POWER_METER.popScale;
			L.popSeq += 1;
			meter.popSeq = L.popSeq;
			meter.big = L.popAmp === POWER_METER.bigPopScale;
		} else {
			// a fall (a new round, the base game's reset) or a skip: snap
			L.from = sum;
			L.shown = sum;
			L.t0 = -1;
		}
		L.target = sum;
	}
	if (L.t0 >= 0) {
		const u = Math.min(1, (now - L.t0) / L.ms);
		L.shown = Math.round(L.from + (L.target - L.from) * ease(u));
		if (u >= 1) L.t0 = -1;
	} else L.shown = L.target;
	L.pop = 1;
	if (L.popT0 >= 0) {
		const u = (now - L.popT0) / L.popMs;
		if (u >= 1) L.popT0 = -1;
		else L.pop = 1 + L.popAmp * Math.sin(Math.PI * Math.max(0, u));
	}
	const step = dt / Math.max(1, POWER_METER.fadeMs);
	L.alpha = on ? Math.min(1, L.alpha + step) : Math.max(0, L.alpha - step);
	L.on = on;
	if (meter.on !== on) meter.on = on;
	if (meter.shown !== L.shown) meter.shown = L.shown;
};

/** DEV hook body (window.__manticore.meter): what the meter shows and the board it read */
export const meterProbe = () => ({ variant: METER_VARIANT, base: METER_IN_BASE, on: meterLive.on, target: meterLive.target, shown: meterLive.shown, lit: meterLive.lit, alpha: Number(meterLive.alpha.toFixed(3)), pop: Number(meterLive.pop.toFixed(3)), popSeq: meterLive.popSeq, gameType: stateGame.gameType, bonusMode: stateGame.bonusMode });
