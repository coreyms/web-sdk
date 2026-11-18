// THE INTRO CARDS' TEXT (ui/LandingScreen.svelte). Since intro cards round 3 (header H1, approved Corey 2026-11-18:
// "This looks great, but the vertical alignment should be fixed and this will be good to put in the game") a card's slate
// is IMAGE LETTERING (game/introSlateSpec.ts, baked by tools/build_intro_slate.py from glyphs and pictures the game
// ships) and ONE plain line under it. The paragraph and the gold scene line that followed the clip's time (approved
// 2026-10-12, card_text_final.json) are gone: Corey 2026-11-17 on round 2, "Many of the games use image text and images,
// not a lot use plain formatted text ... Some plain text is okay."
//
// Every string of the cards lives here: the header words (the lettering's own words, for the dots' labels and the DEV
// hook), the plain line in both wordings (soc(): stake.com and stake.us; the same words today, none of them gambling
// vocabulary), and the numbers the lettering states, checked against config.ts (the mirror of the shipped math) below.
//
// Names (Corey 2026-10-12): the wild is "Wild", the scatter is "War Standard Scatter(s)", the tiles are "Multiplier Tiles".
// The third card's header is MANTICORE (round 3: "THE MANTICORE" would force all three headers smaller).

import config from './config';
import { soc } from './social';
import { INTRO_SLATE_PIECES } from './introSlateSpec';

export type IntroCardKey = 'clusters' | 'scatters' | 'features';

export type IntroCardText = {
	key: IntroCardKey;
	/** the clip's length, seconds (ffprobe of the shipped file) */
	clipSeconds: number;
	/** the header's words: the lettering in the atlas says exactly these (INTRO_SLATE_PIECES header_<key>.text) */
	title: string;
	/** the plain line under the lettering, in the card's body face */
	line: string;
};

const T = config.scatterTriggers as Record<number, string>;
const scatterAt = (mode: string) => Number(Object.keys(T).find((n) => T[Number(n)] === mode));

/** THE NUMBERS THE LETTERING STATES (baked into static/assets/ui/intro/intro-slate.webp). A change to the math that
 *  moves one of them needs the lettering rebaked: introSlateNumbersMatch() says whether they still agree */
export const INTRO_SLATE_NUMBERS = {
	/** "5+ TOUCHING SYMBOLS WIN" */
	minCluster: 5,
	/** "4+ WAR STANDARDS" */
	scatterBonus: 4,
	/** "8 FREE SPINS" */
	bonusSpins: 8,
	/** the tiles x2 .. x128, doubling */
	tiles: [2, 4, 8, 16, 32, 64, 128],
} as const;
export const introSlateNumbersMatch = () =>
	config.minCluster === INTRO_SLATE_NUMBERS.minCluster &&
	scatterAt('bonus') === INTRO_SLATE_NUMBERS.scatterBonus &&
	config.freeSpins.bonus === INTRO_SLATE_NUMBERS.bonusSpins &&
	INTRO_SLATE_NUMBERS.tiles[0] === config.tileSeed &&
	INTRO_SLATE_NUMBERS.tiles[INTRO_SLATE_NUMBERS.tiles.length - 1] === Math.max(...Object.values(config.tileCap));

const SUPER_AT = scatterAt('super');
const EPIC_AT = scatterAt('epic');

export const INTRO_CARD_TEXT: readonly IntroCardText[] = [
	{
		key: 'clusters',
		clipSeconds: 15.633,
		title: INTRO_SLATE_PIECES.header_clusters.text ?? 'CLUSTERS',
		line: soc('Every win lights tiles. Lit tiles keep doubling.', 'Every win lights tiles. Lit tiles keep doubling.'),
	},
	{
		key: 'scatters',
		clipSeconds: 13.467,
		title: INTRO_SLATE_PIECES.header_scatters.text ?? 'SCATTERS',
		line: soc(`${SUPER_AT} start Super Free Spins. ${EPIC_AT} or more start Epic.`, `${SUPER_AT} start Super Free Spins. ${EPIC_AT} or more start Epic.`),
	},
	{
		key: 'features',
		clipSeconds: 10.633,
		title: INTRO_SLATE_PIECES.header_features.text ?? 'MANTICORE',
		line: soc('He can step into any spin. Roar: Super and Epic only.', 'He can step into any spin. Roar: Super and Epic only.'),
	},
];

/** THE TILES LIFT WITH THE CLIP (the mock's chipTick, kept from round 1): from `from` seconds into the CLUSTERS clip (its
 *  scene "A cluster on Multiplier Tiles wins its value times their sum. Then the tiles double", 12.567 to its end) the
 *  tiles x2, x4 .. x128 lift one after another, `stepS` each; before it none is lifted */
export const INTRO_TILE_LIFT = { card: 'clusters' as IntroCardKey, from: 12.567, stepS: 0.4 } as const;
/** which tile (its order, 0 = x2) is lifted at clip time t, or -1 */
export const introTileLiftAt = (t: number): number => (t >= INTRO_TILE_LIFT.from ? Math.floor((t - INTRO_TILE_LIFT.from) / INTRO_TILE_LIFT.stepS) : -1);

/** the carousel's labels (one card at a time: the dots) */
export const INTRO_DOT_LABEL = (title: string) => `Show ${title}`;
