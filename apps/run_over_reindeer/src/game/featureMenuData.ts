// THE FEATURE MENU'S COPY AND ITS ODDS ROWS, in one file (ui/FeatureMenu.svelte draws it).
//
// PROVISIONAL NUMBERS. The odds rows are the simulation's figures for the settled rules (What-if 4 variant E, Corey
// 2026-11-09), not yet a published set of books: trigger rates per mode, the Super buy's 20x minimum, the max win
// odds. ODDS_ARE_PROVISIONAL stays true until real books exist and these rows have been read off them; while it is
// true the menu carries a small line saying the figures come from the simulation. Rows a figure does not exist for
// yet (how often a bought round pays more than it cost) are simply not shown.
//
// Prices are NOT here: they come from the RGS (game/betModeMeta.ts modeCost), never from this file.
import { soc } from './social';

export const ODDS_ARE_PROVISIONAL = true;

/** one short odds row: what it is, and the figure */
export type OddsRow = { label: string; value: string };

export const FEATURE_MENU_TEXT = {
	/** this game's name for the feature menu (Angry Mantis: The Chow Line, Manticore: The Armoury) */
	name: 'THE FAST LANE',
	provisionalNote: 'Figures from the simulation. They are confirmed when the final math is published.',
	close: 'Close',
	cards: {
		BONUS: {
			title: 'FREE SPINS',
			blurb: '10 free spins. Column Wilds stay on the road and keep their multipliers.',
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

// ---- the odds rows (PROVISIONAL: see the top of the file) -----------------------------------------------------------
const MAX_WIN_ROW: OddsRow = { label: 'Max win 7,777x, base game', value: '1 in 2.77 million' };

export const BUY_ODDS: Record<'BONUS' | 'SUPER', OddsRow[]> = {
	BONUS: [
		{ label: 'Free spins', value: '10' },
		{ label: 'In the base game', value: '1 in 211' },
		{ label: 'Max win', value: '7,777x' },
	],
	SUPER: [
		{ label: 'Free spins', value: '10' },
		{ label: 'In the base game', value: '1 in 2,110' },
		{ label: 'Guaranteed minimum', value: '20x' },
		{ label: 'Max win', value: '7,777x' },
	],
};

/** the Ante card's rows per slider stop, keyed by the mode key (game/betModeMeta.ts ANTE_KEYS) */
export const ANTE_ODDS: Record<string, OddsRow[]> = {
	ANTE_2: [
		{ label: 'Free Spins', value: '1 in 74' },
		{ label: 'Super Free Spins', value: '1 in 1,000' },
		{ label: 'Base game, no Ante', value: '1 in 211 / 2,110' },
	],
	ANTE_4: [
		{ label: 'Free Spins', value: '1 in 41' },
		{ label: 'Super Free Spins', value: '1 in 250' },
		{ label: 'Base game, no Ante', value: '1 in 211 / 2,110' },
	],
	ANTE_10: [
		{ label: 'Free Spins', value: '1 in 45' },
		{ label: 'Super Free Spins', value: '1 in 40' },
		{ label: 'Base game, no Ante', value: '1 in 211 / 2,110' },
	],
};

/** stated once under the cards */
export const MAX_WIN_NOTE = MAX_WIN_ROW;
