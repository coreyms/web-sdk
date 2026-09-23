import { SECOND } from 'constants-shared/time';
import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';

export const winLevelMap = {
	1: { level: 1, alias: 'zero', type: 'small', text: null, presentDuration: 0, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	2: { level: 2, alias: 'standard', type: 'small', text: null, presentDuration: 0, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	3: { level: 3, alias: 'small', type: 'small', text: null, presentDuration: 0, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	4: { level: 4, alias: 'nice', type: 'medium', text: 'NICE WIN', presentDuration: 1.2 * SECOND, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	5: { level: 5, alias: 'substantial', type: 'medium', text: 'BIG WIN', presentDuration: 1.8 * SECOND, sound: { sfx: undefined, bgm: undefined }, animation: undefined },
	6: { level: 6, alias: 'big', type: 'big', text: 'BIG WIN', presentDuration: 2.6 * SECOND, sound: { sfx: 'sfx_win_big', bgm: undefined }, animation: undefined },
	7: { level: 7, alias: 'superwin', type: 'big', text: 'SUPER WIN', presentDuration: 3.4 * SECOND, sound: { sfx: 'sfx_win_super', bgm: undefined }, animation: undefined },
	8: { level: 8, alias: 'mega', type: 'big', text: 'MEGA WIN', presentDuration: 4.2 * SECOND, sound: { sfx: 'sfx_win_mega', bgm: undefined }, animation: undefined },
	9: { level: 9, alias: 'epic', type: 'big', text: 'EPIC WIN', presentDuration: 5 * SECOND, sound: { sfx: 'sfx_win_epic', bgm: undefined }, animation: undefined },
	10: { level: 10, alias: 'max', type: 'big', text: 'MAX WIN', presentDuration: 6 * SECOND, sound: { sfx: 'sfx_win_max', bgm: undefined }, animation: undefined },
} as const;

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
