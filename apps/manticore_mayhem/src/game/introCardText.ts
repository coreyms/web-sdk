// THE INTRO CARDS' TEXT (ui/LandingScreen.svelte), approved 2026-10-12 ("intro_cards_r3",
// card_text_final.json: titles, slate copy with its highlighted words, and the scene lines with the
// clip time range each one is up for). Copied into this module by hand: nothing fetches the json at
// run time. The landing screen has no i18n catalog yet (src/i18n/messagesMap/en.ts is empty and the
// screen's other strings are literals), so every string of the cards lives here, in one place, ready
// to be moved into one.
//
// Names (Corey 2026-10-12): the wild is "Wild", the scatter is "War Standard Scatter(s)", the tiles
// are "Multiplier Tiles".
//
// NUMBERS UP FRONT (Corey 2026-10-21, "Yes, great idea"; docs/reviews/manticore-advisor-2026-10-21.md upgrade 1: every
// 3-star game in the calibration set states a number on its landing). The numbers are read from config.ts, the mirror
// of the shipped math (game_config.py), never typed in here: the max win line under the cards (WINCAP) and the
// Multiplier Tiles' top value on CLUSTERS (TILE_CAP_HIGH, the Super and Epic ladder; Free Spins and the base game
// stop at 64, hence "up to"). Social wording through soc(): "your bet" on stake.com, "your play amount" on stake.us.

import config from './config';
import { soc } from './social';

/** the multiplier tiles' top value in the shipped math (config.tileCap, the highest ladder: Super and Epic) */
export const INTRO_TILE_TOP = Math.max(...Object.values(config.tileCap));
const TILE_TOP_TEXT = `${INTRO_TILE_TOP}x`;

/** THE MAX WIN LINE on the landing (ui/LandingScreen.svelte .maxwin, over the gate): `num` is drawn in the highlight */
export const INTRO_MAX_WIN = {
	lead: 'WIN UP TO ',
	num: `${config.maxWin.toLocaleString('en-US')}x`,
	tail: soc(' YOUR BET', ' YOUR PLAY AMOUNT'),
} as const;

export type IntroCardKey = 'clusters' | 'scatters' | 'features';

export type IntroSceneLine = {
	/** seconds inside the looping clip: the line is up for from <= t < to */
	from: number;
	to: number;
	text: string;
};

export type IntroCardText = {
	key: IntroCardKey;
	/** the clip's length, seconds (ffprobe of the shipped file) */
	clipSeconds: number;
	title: string;
	/** the slate copy; every string of `highlights` inside it is drawn in the highlight colour */
	body: string;
	highlights: readonly string[];
	sceneLines: readonly IntroSceneLine[];
};

export const INTRO_CARD_TEXT: readonly IntroCardText[] = [
	{
		key: 'clusters',
		clipSeconds: 12.633,
		title: 'CLUSTERS',
		body: `5 or more matching symbols that touch form a cluster. Every win lights Multiplier Tiles under it, and lit tiles double up to ${TILE_TOP_TEXT}.`,
		highlights: ['Multiplier Tiles', TILE_TOP_TEXT],
		sceneLines: [
			{ from: 0, to: 1.9, text: '5 Persian Daggers in a row: a cluster' },
			{ from: 1.9, to: 4.1, text: 'Any shape counts: left, right, up or down. Not diagonals' },
			{ from: 4.1, to: 6.3, text: 'The Wild stands in for any symbol except the War Standard Scatter' },
			{ from: 6.3, to: 9.567, text: 'Every winning cluster lights the cells under it: 2x Multiplier Tiles' },
			{ from: 9.567, to: 12.633, text: 'A cluster on Multiplier Tiles wins its value times their sum. Then the tiles double' },
		],
	},
	{
		key: 'scatters',
		clipSeconds: 13.467,
		title: 'SCATTERS',
		body: '4 or more War Standard Scatters trigger Free Spins. Only one can sit in a column, and more of them open the bigger rounds.',
		highlights: ['War Standard Scatters'],
		sceneLines: [
			{ from: 0, to: 4.1, text: '4 War Standard Scatters: 8 Free Spins' },
			{ from: 4.1, to: 8.6, text: '5 War Standard Scatters: 10 Super Free Spins' },
			{ from: 8.6, to: 13.467, text: '6 or more: 12 Epic Free Spins' },
		],
	},
	{
		key: 'features',
		clipSeconds: 10.633,
		title: 'THE MANTICORE',
		body: 'The Manticore can step into a spin. A sting turns cells wild. A swipe lights or doubles up to 24 tiles, and in Free Spins they stay all round.',
		highlights: ['sting', 'swipe'],
		sceneLines: [
			{ from: 0, to: 4.5, text: 'STING: the tail turns cells wild, one cell or a whole cross' },
			{ from: 4.5, to: 6.833, text: 'SWIPE: his claws tear through three rows. Their tiles light up or double' },
			{ from: 6.833, to: 10.633, text: 'ROAR: in Super and Epic Free Spins, every low symbol is blown off and replaced' },
		],
	},
];

/** the carousel's labels (one card at a time: the dots) */
export const INTRO_DOT_LABEL = (title: string) => `Show ${title}`;

/** the slate copy cut into plain and highlighted runs, in order */
export const introBodyRuns = (card: IntroCardText): { text: string; hl: boolean }[] => {
	let runs: { text: string; hl: boolean }[] = [{ text: card.body, hl: false }];
	for (const word of card.highlights) {
		runs = runs.flatMap((run) => {
			if (run.hl || !run.text.includes(word)) return [run];
			const at = run.text.indexOf(word);
			return [
				{ text: run.text.slice(0, at), hl: false },
				{ text: word, hl: true },
				{ text: run.text.slice(at + word.length), hl: false },
			].filter((r) => r.text.length > 0);
		});
	}
	return runs;
};

/** which scene line is up at clip time t (seconds; wraps at the clip's length) */
export const introSceneIndexAt = (card: IntroCardText, t: number): number => {
	const s = ((t % card.clipSeconds) + card.clipSeconds) % card.clipSeconds;
	for (let i = card.sceneLines.length - 1; i >= 0; i -= 1) if (s >= card.sceneLines[i].from) return i;
	return 0;
};
