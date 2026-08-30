import { SECOND } from 'constants-shared/time';

export const winLevelMap = {
	1: {
		level: 1,
		alias: 'zero',
		type: 'small',
		text: null,
		presentDuration: 0,
		sound: { sfx: undefined, bgm: undefined },
		animation: undefined,
	},
	2: {
		level: 2,
		alias: 'standard',
		type: 'small',
		text: null,
		presentDuration: 0.6 * SECOND,
		sound: { sfx: undefined, bgm: undefined },
		animation: undefined,
	},
	3: {
		level: 3,
		alias: 'small',
		type: 'small',
		text: null,
		presentDuration: 1 * SECOND,
		sound: { sfx: undefined, bgm: undefined },
		animation: undefined,
	},
	4: {
		level: 4,
		alias: 'nice',
		type: 'medium',
		text: null,
		presentDuration: 1.5 * SECOND,
		sound: { sfx: undefined, bgm: undefined },
		animation: undefined,
	},
	5: {
		level: 5,
		alias: 'substantial',
		type: 'medium',
		text: null,
		presentDuration: 2.0 * SECOND,
		sound: { sfx: undefined, bgm: undefined },
		animation: undefined,
	},
	6: {
		level: 6,
		alias: 'big',
		type: 'big',
		text: 'BIG WIN',
		presentDuration: 3 * SECOND,
		sound: { sfx: undefined, bgm: undefined },
		animation: { intro: 'big_win_intro', idle: 'big_win_idle', outro: 'big_win_exit' },
	},
	7: {
		level: 7,
		alias: 'superwin',
		type: 'big',
		text: 'SUPER WIN',
		presentDuration: 4 * SECOND,
		sound: { sfx: undefined, bgm: undefined },
		animation: { intro: 'super_win_intro', idle: 'super_win_idle', outro: 'super_win_exit' },
	},
	8: {
		level: 8,
		alias: 'mega',
		type: 'big',
		text: 'MEGA WIN',
		presentDuration: 5 * SECOND,
		sound: { sfx: undefined, bgm: undefined },
		animation: { intro: 'mega_win_intro', idle: 'mega_win_idle', outro: 'mega_win_exit' },
	},
	9: {
		level: 9,
		alias: 'epic',
		type: 'big',
		text: 'EPIC WIN!',
		presentDuration: 6 * SECOND,
		sound: { sfx: undefined, bgm: undefined },
		animation: { intro: 'epic_win_intro', idle: 'epic_win_idle', outro: 'epic_win_exit' },
	},
	10: {
		level: 10,
		alias: 'max',
		type: 'big',
		text: 'MAX WIN',
		presentDuration: 7 * SECOND,
		sound: { sfx: undefined, bgm: undefined },
		animation: { intro: 'max_win_intro', idle: 'max_win_idle', outro: 'max_win_exit' },
	},
} as const;

// Staged count-up tiers (Corey 2026-08-29): mirrors the "standard" table in math-sdk
// src/config/config.py get_win_level, in bet multiples. The count-up starts at BIG WIN and
// upgrades the title live as the climbing amount crosses each bar, capped at the book's final
// winLevel so the top tier is never revealed early. Titles match TextWarmup exactly (cache hits).
export const WIN_TIER_STAGES = [
	{ alias: 'big', title: 'BIG WIN', assetKey: 'textBigWin', xBet: 15 },
	{ alias: 'superwin', title: 'SUPER WIN', assetKey: 'textSuperWin', xBet: 30 },
	{ alias: 'mega', title: 'MEGA WIN', assetKey: 'textMegaWin', xBet: 50 },
	{ alias: 'epic', title: 'EPIC WIN', assetKey: 'textEpicWin', xBet: 100 },
	{ alias: 'max', title: 'MAX WIN', assetKey: 'textMaxWin', xBet: 20000 },
] as const;

// Same idea for end-of-feature totals: mirrors the math "endFeature" table (freeSpinEnd winLevel).
export const WIN_TIER_STAGES_END_FEATURE = [
	{ alias: 'big', title: 'BIG WIN', assetKey: 'textBigWin', xBet: 50 },
	{ alias: 'superwin', title: 'SUPER WIN', assetKey: 'textSuperWin', xBet: 100 },
	{ alias: 'mega', title: 'MEGA WIN', assetKey: 'textMegaWin', xBet: 500 },
	{ alias: 'epic', title: 'EPIC WIN', assetKey: 'textEpicWin', xBet: 2000 },
	{ alias: 'max', title: 'MAX WIN', assetKey: 'textMaxWin', xBet: 20000 },
] as const;

export type WinTierStage = { alias: string; title: string; assetKey: string; xBet: number };

export type WinLevelMap = typeof winLevelMap;
export type WinLevel = keyof typeof winLevelMap;
export type WinLevelData = WinLevelMap[WinLevel];
export type WinLevelAlias = WinLevelData['alias'];
