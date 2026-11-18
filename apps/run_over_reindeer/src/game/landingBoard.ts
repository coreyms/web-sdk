// THE LANDING BOARD (Corey 2026-11-15, the landing mock V2 without its UP TO; constants LANDING_DIM): the posed, still
// board behind the landing screen. Presentation only: no book drew it and nothing on it is a result.
import config from './config';
import type { Board } from './types';
import type { ColumnTier } from './typesBookEvent';

/** reels 1 and 5: the eight ordinary symbols once each, cars and signs alternating (the mock's order); reels 2 to 4:
 *  the column Wilds (CW: no symbol parks there) */
export const LANDING_POSE: Board = [
	['H2', 'L1', 'H4', 'L3'],
	['CW', 'CW', 'CW', 'CW'],
	['CW', 'CW', 'CW', 'CW'],
	['CW', 'CW', 'CW', 'CW'],
	['L2', 'H3', 'L4', 'L5'],
];

/** the highest multiplier a column of this tier can land with in the BASE GAME, read from the math config so a math
 *  change cannot leave the landing wrong. The first board is the base game's board at rest before the first spin (a
 *  tap there opens the popup with the base game's range), so it shows only what a base spin can produce: Reindeer 8x,
 *  Santa 20x, Grandma 75x today. (Until 2026-11-17 it took the top of every round, which posed Santa at 30x: a bonus
 *  round's rare start that no base spin ever lands, next to a popup that says 10x to 20x. Corey: "We should go with the
 *  truth there.") */
export const topMultiplier = (tier: ColumnTier): number => config.multipliers.column.base[tier][1];

/** the three columns as posed, reels from 0 */
export const landingColumns = (): { reel: number; tier: ColumnTier; multiplier: number }[] =>
	(['reindeer', 'santa', 'grandma'] as ColumnTier[]).map((tier, i) => ({ reel: i + 1, tier, multiplier: topMultiplier(tier) }));
