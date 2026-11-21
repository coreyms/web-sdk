import { SECOND } from 'constants-shared/time';
import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import type { BonusMode } from './types';

export const winLevelMap = {
	1: { level: 1, alias: 'zero', type: 'small', text: null, presentDuration: 0, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	2: { level: 2, alias: 'standard', type: 'small', text: null, presentDuration: 0, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	3: { level: 3, alias: 'small', type: 'small', text: null, presentDuration: 0, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	// LEVELS 4 AND 5 (4x to Big, 50x since 2026-11-21, 15x before) HAVE NO WIN SCREEN AND NO WORD (Corey 2026-10-09: "no Nice win level"): the board's
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

// THE STINGER LADDERS: WHICH WINS GET THE FULL-SCREEN PLAQUE (components/StingerPlaque.svelte), ALL IN ONE PLACE.
// Corey 2026-11-21 (the Stinger "hurts the fluidity of the games"): "Let's make the base games match the bonus round
// numbers, off the based spin amount. Let's drop Big win from Bonus games individual spins. Raise Super to 200x and make
// that the trigger for the stinger." and, on the base game's Super: "Yes it should be also 200x."
// Every bar is a multiple of the BASE bet: a book amount / BOOK_AMOUNT_MULTIPLIER, and book amounts are base-bet
// multiples in every mode (Ante 3x, Super Ante 10x and the bought features debit more, but pay on the base bet; the
// 10,000x cap is the same in every mode). Nothing here divides by a mode's cost.
// To change a bar, change its number here: the tier word, the plaque's opening tier, its tier-up steps, the tier
// sounds (WIN_TIER_SOUND), the creature's win clips (game/creatureLoad.ts) and the count's bars all read these.
// PRESENTATION ONLY: the tier is picked from the book's own amount and decides nothing.
//
// BASE GAME SPIN (Ante and Super Ante included): Big opens the ladder. A win under Big gets no Stinger (the board's
// own run up only: cluster labels, the bar's WIN, the HUD win). Was 15 / 30 / 60 / 150 / 10,000x until 2026-11-21.
export const WIN_TIER_STAGES = [
	{ alias: 'big', title: 'BIG WIN', xBet: 50 },
	{ alias: 'superwin', title: 'SUPER WIN', xBet: 200 },
	{ alias: 'mega', title: 'MEGA WIN', xBet: 400 },
	{ alias: 'epic', title: 'EPIC WIN', xBet: 1500 },
	{ alias: 'max', title: 'MAX WIN', xBet: 10000 },
] as const;

// A FREE SPIN'S OWN WIN, in every feature (Free Spins, Super, Epic; bought, triggered or from Mystery alike): there is
// NO Big tier, the Stinger first appears at SUPER and opens on SUPER WIN. A spin under 200x gets no Stinger, as a base
// win under Big. Was per feature until 2026-11-21: Free Spins 25 / 50 / 100 / 250, Super 40 / 80 / 160 / 400, Epic
// 75 / 150 / 300 / 750 (harsh review 2026-10-15, gameplay finding 6).
export const WIN_TIER_STAGES_FEATURE_SPIN = [
	{ alias: 'superwin', title: 'SUPER WIN', xBet: 200 },
	{ alias: 'mega', title: 'MEGA WIN', xBet: 400 },
	{ alias: 'epic', title: 'EPIC WIN', xBet: 1500 },
	{ alias: 'max', title: 'MAX WIN', xBet: 10000 },
] as const;

// THE TOTAL WIN WRAP UP at the end of a feature (components/FreeSpinOutro.svelte, components/WarBanner.svelte): its tier
// is the BOOK's freeSpinEnd.winLevel; these bars only pace its count. Not changed on 2026-11-21.
export const WIN_TIER_STAGES_END_FEATURE = [
	{ alias: 'big', title: 'BIG WIN', xBet: 50 },
	{ alias: 'superwin', title: 'SUPER WIN', xBet: 100 },
	{ alias: 'mega', title: 'MEGA WIN', xBet: 400 },
	{ alias: 'epic', title: 'EPIC WIN', xBet: 1500 },
	{ alias: 'max', title: 'MAX WIN', xBet: 10000 },
] as const;

export type WinTierStage = { alias: string; title: string; xBet: number };

/** every tier in order: the index is the plaque's tier (game/stinger/types STINGER_TIERS), the WIN_TIER_SOUND index and
 *  winLevelMap level - 6, whichever ladder a win is on */
export const WIN_TIER_ALIASES = ['big', 'superwin', 'mega', 'epic', 'max'] as const;
/** the tier index (0 Big .. 4 Max) of a ladder stage or a win level's alias; 0 for anything else */
export const tierIndexOfAlias = (alias: string): number => Math.max(0, (WIN_TIER_ALIASES as readonly string[]).indexOf(alias));

/** the ladder a free spin's own win is on (the same for every feature since 2026-11-21; `mode` kept for the callers) */
export const featureSpinStages = (_mode?: BonusMode | null): readonly WinTierStage[] => WIN_TIER_STAGES_FEATURE_SPIN;

/** a win's tier on a ladder: the level (6 Big .. 10 Max) of the highest bar it reaches, or undefined under the
 *  ladder's first bar (no Stinger) */
export const levelOnStages = (xBet: number, stages: readonly WinTierStage[]): WinLevelData | undefined => {
	let hit: WinTierStage | undefined;
	for (const s of stages) if (xBet >= s.xBet) hit = s;
	return hit ? winLevelMap[(6 + tierIndexOfAlias(hit.alias)) as WinLevel] : undefined;
};

/** a free spin's own win on the feature spin ladder: Super (level 7) to Max (level 10), or undefined under 200x */
export const getFeatureSpinWinLevelData = ({ bookEventAmount, mode }: { bookEventAmount: number; mode: BonusMode | null }): WinLevelData | undefined =>
	levelOnStages(bookEventAmount / BOOK_AMOUNT_MULTIPLIER, featureSpinStages(mode));

// PRESENTATION ONLY. Manticore's schema carries no `setWin` and therefore no per-spin winLevel, so
// the tier WORD over a base-game count-up is picked from the amount the book already sent. The
// number itself is always the book's — this decides nothing about the round.
// Levels 6 to 10 are WIN_TIER_STAGES' bars (above); 4 and 5 have no Stinger.
const LEVEL_THRESHOLDS: [WinLevel, number][] = [
	...WIN_TIER_STAGES.map((s, i) => [(6 + i) as WinLevel, s.xBet] as [WinLevel, number]).reverse(),
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
