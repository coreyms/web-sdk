import { SECOND } from 'constants-shared/time';
import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import type { BonusMode } from './types';

export const winLevelMap = {
	1: { level: 1, alias: 'zero', type: 'small', text: null, presentDuration: 0, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	2: { level: 2, alias: 'standard', type: 'small', text: null, presentDuration: 0, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	3: { level: 3, alias: 'small', type: 'small', text: null, presentDuration: 0, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	// LEVELS 4 AND 5 (4x to 15x) HAVE NO WIN SCREEN AND NO WORD (Corey 2026-10-09: "no Nice win level"): the board's
	// own run up (cluster labels, the SPIN readout, the HUD win) is all a win under Big gets. Level 5 read
	// 'BIG WIN' on a plain screen with no plaque until then, which is what "Big wins are not showing the
	// stinger" was. Their presentDuration is still what the WRAP UP counts over when a feature ends at
	// that level (components/FreeSpinOutro.svelte); nothing else reads it.
	4: { level: 4, alias: 'nice', type: 'medium', text: null, presentDuration: 1.2 * SECOND, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	5: { level: 5, alias: 'substantial', type: 'medium', text: null, presentDuration: 1.8 * SECOND, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	6: { level: 6, alias: 'big', type: 'big', text: 'BIG WIN', presentDuration: 3 * SECOND, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	7: { level: 7, alias: 'superwin', type: 'big', text: 'SUPER WIN', presentDuration: 4 * SECOND, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	8: { level: 8, alias: 'mega', type: 'big', text: 'MEGA WIN', presentDuration: 5 * SECOND, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	9: { level: 9, alias: 'epic', type: 'big', text: 'EPIC WIN', presentDuration: 6 * SECOND, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	10: { level: 10, alias: 'max', type: 'big', text: 'MAX WIN', presentDuration: 7 * SECOND, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
} as const;

// LEVELS 6 TO 10 (Corey 2026-10-08, the house count-up pacing, as Angry Mantis ships it): the count runs
// 3 / 4 / 5 / 6 / 7 s by FINAL tier (game/stinger/count.ts splits it over the bars crossed), and the tier
// clips are not played from here any more: each tier's sfx_win_* plays as that tier lands on the plaque
// (WIN_TIER_SOUND, components/StingerPlaque.svelte), the way Angry Mantis plays its plate clinks.
export const WIN_TIER_SOUND = ['sfx_win_big', 'sfx_win_super', 'sfx_win_mega', 'sfx_win_epic', 'sfx_win_max'] as const;

export type WinLevelMap = typeof winLevelMap;
export type WinLevel = keyof WinLevelMap;
export type WinLevelData = WinLevelMap[WinLevel];
export type WinLevelAlias = WinLevelData['alias'];

// Staged count-up tiers, in BASE-BET multiples. Manticore's cap is 10,000x (spec B), so the ladder
// is half Angry Mantis's at the top; the lower bars are the same shape.
export const WIN_TIER_STAGES = [
	{ alias: 'big', title: 'BIG WIN', xBet: 15 },
	{ alias: 'superwin', title: 'SUPER WIN', xBet: 30 },
	{ alias: 'mega', title: 'MEGA WIN', xBet: 60 },
	{ alias: 'epic', title: 'EPIC WIN', xBet: 150 },
	{ alias: 'max', title: 'MAX WIN', xBet: 10000 },
] as const;

export const WIN_TIER_STAGES_END_FEATURE = [
	{ alias: 'big', title: 'BIG WIN', xBet: 50 },
	{ alias: 'superwin', title: 'SUPER WIN', xBet: 100 },
	{ alias: 'mega', title: 'MEGA WIN', xBet: 400 },
	{ alias: 'epic', title: 'EPIC WIN', xBet: 1500 },
	{ alias: 'max', title: 'MAX WIN', xBet: 10000 },
] as const;

export type WinTierStage = { alias: string; title: string; xBet: number };

// A FREE SPIN'S OWN WIN PLAQUE IS FEATURE RELATIVE (harsh review 2026-10-15, gameplay finding 6; Corey 2026-10-16:
// "Yes, this is a good idea for this game"). On the base ladder (Big at 15x) the plaque covered the board 1.3 times per
// Free Spins round, 2.3 per Super and 4.2 per Epic, in exactly the spins where the board was escalating. Inside a
// feature a spin's own win now gets a plaque only from the bar of the feature it is in (the book's bonusStart.bonus, a
// bought or a naturally triggered round alike, a BONUS buy that plays a Super or an Epic included); a smaller spin win
// counts up on the board's own readout only, as an under 15x win always did. Same words, same house pacing (3 to 7 s by
// final tier, no pause at the bars), same base ladder shape (x1, x2, x4, x10 of Big); Max stays the 10,000x cap.
// MEASURED on the shipped books (publish_files 2026-10-15, lookup table weighted; the capping spin of a capped round
// gets none), plaques per round, before (15x) -> after, and the share of rounds with 0 / 1 / 2 / 3+ after:
//   Free Spins, Big 25x (0.25 of the 100x price): 1.31 -> 0.83 (49 / 30 / 14 / 8 %)
//   Super,      Big 40x (0.16 of the 250x price): 2.30 -> 1.16 (38 / 30 / 18 / 14 %)
//   Epic,       Big 75x (0.15 of the 500x price): 4.19 -> 1.55 ( 6 / 53 / 28 / 13 %)
// RE-MEASURED on the 2026.10.16 books (feedback/math_reshape_r1/data/feature_tiers_new_books.txt), the same bars, the
// buy's own rounds: Free Spins 1.41 -> 0.83 (53 / 25 / 13 / 9 %), Super 2.75 -> 1.20 (41 / 27 / 16 / 17 %),
// Epic 5.04 -> 1.45 (14 / 50 / 23 / 14 %)
// HOW, to re-measure on new books: feedback/feature_tiers_r1/ (walk_books.py, then measure.py for candidate bars and
// final.py for these ladders) in the Manticore Mayhem working folder. PRESENTATION ONLY: the word is picked from the
// book's own amount and decides nothing.
export const WIN_TIER_STAGES_FEATURE_SPIN = {
	bonus: [
		{ alias: 'big', title: 'BIG WIN', xBet: 25 },
		{ alias: 'superwin', title: 'SUPER WIN', xBet: 50 },
		{ alias: 'mega', title: 'MEGA WIN', xBet: 100 },
		{ alias: 'epic', title: 'EPIC WIN', xBet: 250 },
		{ alias: 'max', title: 'MAX WIN', xBet: 10000 },
	],
	super: [
		{ alias: 'big', title: 'BIG WIN', xBet: 40 },
		{ alias: 'superwin', title: 'SUPER WIN', xBet: 80 },
		{ alias: 'mega', title: 'MEGA WIN', xBet: 160 },
		{ alias: 'epic', title: 'EPIC WIN', xBet: 400 },
		{ alias: 'max', title: 'MAX WIN', xBet: 10000 },
	],
	epic: [
		{ alias: 'big', title: 'BIG WIN', xBet: 75 },
		{ alias: 'superwin', title: 'SUPER WIN', xBet: 150 },
		{ alias: 'mega', title: 'MEGA WIN', xBet: 300 },
		{ alias: 'epic', title: 'EPIC WIN', xBet: 750 },
		{ alias: 'max', title: 'MAX WIN', xBet: 10000 },
	],
} as const satisfies Record<BonusMode, readonly WinTierStage[]>;

/** the per spin ladder for a free spin of this feature (the base ladder if the feature is somehow unknown) */
export const featureSpinStages = (mode: BonusMode | null): readonly WinTierStage[] => (mode ? WIN_TIER_STAGES_FEATURE_SPIN[mode] : WIN_TIER_STAGES);

/** a free spin's own win on its feature's ladder: Big (level 6) to Max (level 10), or undefined under Big (no plaque) */
export const getFeatureSpinWinLevelData = ({ bookEventAmount, mode }: { bookEventAmount: number; mode: BonusMode | null }): WinLevelData | undefined => {
	const xBet = bookEventAmount / BOOK_AMOUNT_MULTIPLIER;
	const tier = featureSpinStages(mode).filter((s) => xBet >= s.xBet).length - 1;
	return tier < 0 ? undefined : winLevelMap[(6 + tier) as WinLevel];
};

// PRESENTATION ONLY. Manticore's schema carries no `setWin` and therefore no per-spin winLevel, so
// the tier WORD over a base-game count-up is picked from the amount the book already sent. The
// number itself is always the book's — this decides nothing about the round.
const LEVEL_THRESHOLDS: [WinLevel, number][] = [
	[10, 10000],
	[9, 150],
	[8, 60],
	[7, 30],
	[6, 15],
	[5, 8],
	[4, 4],
	[3, 1],
	[2, 0.01],
	[1, 0],
];

export const getWinLevelDataByBookEventAmount = ({ bookEventAmount }: { bookEventAmount: number }): WinLevelData | undefined => {
	const xBet = bookEventAmount / BOOK_AMOUNT_MULTIPLIER;
	const hit = LEVEL_THRESHOLDS.find(([, threshold]) => xBet >= threshold);
	return hit ? winLevelMap[hit[0]] : undefined;
};
