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

/** the highest multiplier a column of this tier can land with anywhere in the game (base game, free spins, Super and
 *  the bonus rounds' rare big starts), read from the math config so a math change cannot leave the landing wrong */
export const topMultiplier = (tier: ColumnTier): number => {
	const m = config.multipliers;
	const ranges = Object.values(m.column).map((game) => (game as Record<ColumnTier, readonly number[]>)[tier] ?? []);
	const rare = (m.bonusRare as Partial<Record<ColumnTier, number>>)[tier] ?? 0;
	return Math.max(rare, ...ranges.flat());
};

/** the three columns as posed, reels from 0 */
export const landingColumns = (): { reel: number; tier: ColumnTier; multiplier: number }[] =>
	(['reindeer', 'santa', 'grandma'] as ColumnTier[]).map((tier, i) => ({ reel: i + 1, tier, multiplier: topMultiplier(tier) }));
