// THE FEATURE MENU'S COPY AND ITS ODDS ROWS, in one file (ui/FeatureMenu.svelte draws it).
//
// !!! DUMMY NUMBERS !!!
// Every odds row below is a PLACEHOLDER written by hand for the first pass so the cards have something to lay
// out. None of them comes from a simulation. The spec says every card states plain odds FROM THE SIM (bonus
// rates, how often a round pays more than it cost, max win odds); when the math publishes them, replace the
// rows here and set ODDS_ARE_DUMMY to false. While it is true the menu shows a visible "sample numbers" note,
// so a screenshot can never be mistaken for real odds.
//
// Prices are NOT here: they come from the RGS (game/betModeMeta.ts modeCost), never from this file.
import { soc } from './social';

export const ODDS_ARE_DUMMY = true;

/** one short odds row: what it is, and the figure */
export type OddsRow = { label: string; value: string };

export const FEATURE_MENU_TEXT = {
	/** this game's name for the feature menu (Angry Mantis: The Chow Line, Manticore: The Armoury) */
	name: 'THE FAST LANE',
	dummyNote: 'Sample numbers. The real odds come from the math.',
	close: 'Close',
	cards: {
		BONUS: {
			title: 'FREE SPINS',
			blurb: '10 free spins. Every Wild that lands stays on the road.',
			button: soc('BUY', 'PLAY'),
		},
		SUPER: {
			title: 'SUPER FREE SPINS',
			blurb: '10 free spins that start with a full column Wild in place.',
			button: soc('BUY', 'PLAY'),
		},
		ANTE: {
			title: soc('ANTE BET', 'ANTE MODE'),
			blurb: soc('Raise the bet per spin for more bonus rounds.', 'Raise the play amount per spin for more bonus rounds.'),
			button: 'ACTIVATE',
			on: 'ON',
			switchOff: 'SWITCH OFF',
			change: 'CHANGE',
			slider: soc('Ante bet level', 'Ante mode level'),
		},
	},
	armed: 'LOADED',
	unload: 'UNLOAD',
	perSpin: soc('PER SPIN', 'PER PLAY'),
	total: 'TOTAL',
};

// ---- DUMMY odds rows (see the top of the file) -------------------------------------------------------------------
export const BUY_ODDS: Record<'BONUS' | 'SUPER', OddsRow[]> = {
	BONUS: [
		{ label: 'Pays more than it cost', value: '1 in 3.1' },
		{ label: 'Pays 500x or more', value: '1 in 140' },
		{ label: 'Extra spins in a round', value: '1 in 9' },
		{ label: 'Max win 7,777x', value: '1 in 310,000' },
	],
	SUPER: [
		{ label: 'Pays more than it cost', value: '1 in 3.4' },
		{ label: 'Pays 1,000x or more', value: '1 in 52' },
		{ label: 'Guaranteed minimum', value: '20x' },
		{ label: 'Max win 7,777x', value: '1 in 61,000' },
	],
};

/** the Ante card's rows per slider stop, keyed by the mode key (game/betModeMeta.ts ANTE_KEYS) */
export const ANTE_ODDS: Record<string, OddsRow[]> = {
	ANTE_2: [
		{ label: 'Free Spins', value: '1 in 80' },
		{ label: 'Super Free Spins', value: '1 in 1,000' },
		{ label: 'Any bonus round', value: '1 in 74' },
		{ label: 'Max win 7,777x', value: '1 in 1,200,000' },
	],
	ANTE_4: [
		{ label: 'Free Spins', value: '1 in 43' },
		{ label: 'Super Free Spins', value: '1 in 250' },
		{ label: 'Any bonus round', value: '1 in 37' },
		{ label: 'Max win 7,777x', value: '1 in 480,000' },
	],
	ANTE_10: [
		{ label: 'Free Spins', value: '1 in 30' },
		{ label: 'Super Free Spins', value: '1 in 40' },
		{ label: 'Any bonus round', value: '1 in 17' },
		{ label: 'Max win 7,777x', value: '1 in 95,000' },
	],
};
