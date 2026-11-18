// THE FEATURE MENU'S COPY AND ITS ODDS ROWS, in one file (ui/FeatureMenu.svelte draws it: THE FAST LANE, the
// redesign of 2026-11-17 on the Armoury's structure; FAST_LANE_TEXT below holds its new words).
//
// THE ODDS ROWS, read off the math build of 2026-11-15 (results/build_2026-11-15/BUILD_REPORT.md, "Final numbers per
// mode": the shaped lookup tables of the production books, P1 paytable), rounded to whole numbers: base game Free Spins
// 1 in 212.7 and Super 1 in 2,128; Ante 2x 1 in 76.4 / 1,000; Ante 4x 1 in 42.6 / 250; Ante 10x 1 in 51.4 / 40; the max
// win in the base game 1 in 2.97 million; the bought Super's 20x minimum. ODDS_ARE_PROVISIONAL stays true until Corey
// has looked at the build and the books are published (the menu carries a small line saying the figures come from the
// simulation while it is true). Rows a figure does not exist for yet (how often a bought round pays more than it cost)
// are simply not shown.
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
	/** the menu foot's line on what "~1 in N" means (Corey 2026-11-17; the rules carry the long form) */
	averageNote: '~ long-run average. Every spin is independent.',
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

// ---- THE FAST LANE's own words (the approved mock of 2026-11-17, fast_lane_menu_2026-11-17/mock/template.html) -------
// Written once for both sessions: none of them uses a word a social session forbids, so no soc() pair is needed.
// {name} {amount} are filled in by ui/FeatureMenu.svelte; ** marks a bold run.
export const FAST_LANE_TEXT = {
	balance: 'BALANCE',
	amount: 'PLAY AMOUNT',
	lower: 'Lower the play amount',
	raise: 'Raise the play amount',
	/** the tray's two groups: the Ante (per spin) and the two features */
	perSpinNote: 'stays on until switched off',
	features: 'FEATURES',
	featuresNote: 'one round, one amount',
	/** the plate's small line over the mode's name (the Ante's is FEATURE_MENU_TEXT.perSpin + this) */
	kickAnteTail: ' MODE',
	kickFeature: 'FEATURE',
	ante: 'ANTE',
	/** the three lines on the Ante's sign: ANTE / PLAY / the level's multiple */
	signTop: 'ANTE',
	signMid: 'PLAY',
	level: 'LEVEL',
	levelGroup: 'Ante level',
	/** the plate's line under the name, per mode (the Ante's per level: its top level says what it is for) */
	say: {
		BONUS: '**10 free spins**. Column Wilds stay on the road and **keep their multipliers**.',
		SUPER: '**10 free spins** that start with a **full column Wild** in place.',
		ANTE_2: 'Raise the play amount per spin for **more bonus rounds**.',
		ANTE_4: 'Raise the play amount per spin for **more bonus rounds**.',
		ANTE_10: 'Raise the play amount per spin for **far more Super Free Spins**.',
	} as Record<string, string>,
	/** the line that takes the say line's place once a mode is on, or right after it was switched off */
	anteOn: '**ON.** Active now. Every spin uses **{amount}** until you switch it off.',
	loaded: '**LOADED.** The next press of Spin uses **{amount}** and plays one round.',
	anteOff: '**{name}** is off. Every spin uses **{amount}** again.',
	unloaded: '**{name}** is unloaded. Nothing was used.',
	low: 'Balance too low at this play amount',
	/** the confirm card */
	confirmTitle: 'Confirm {name}',
	everySpin: 'EVERY SPIN',
	confirmAnte: 'Switches **{name}** on. Every spin uses **{amount}** until you switch it off here.',
	confirmFeature: 'Loads **{name}** onto the Spin button. Nothing happens until you press **Spin**, and that press plays **one feature round**.',
	cancel: 'Cancel',
	confirm: 'CONFIRM',
	/** a tile's spoken name: "FREE SPINS, feature, 100 times the play amount, loaded" */
	tileFeature: 'feature',
	tileAnte: 'per spin mode',
	timesAmount: 'times the play amount',
};

// ---- the odds rows (PROVISIONAL: see the top of the file) -----------------------------------------------------------
const MAX_WIN_ROW: OddsRow = { label: 'Max win 7,777x, base game', value: '~1 in 2.97 million' };

export const BUY_ODDS: Record<'BONUS' | 'SUPER', OddsRow[]> = {
	BONUS: [
		{ label: 'Free spins', value: '10' },
		{ label: 'In the base game', value: '~1 in 213' },
		{ label: 'Max win', value: '7,777x' },
	],
	SUPER: [
		{ label: 'Free spins', value: '10' },
		{ label: 'In the base game', value: '~1 in 2,128' },
		{ label: 'Guaranteed minimum', value: '20x' },
		{ label: 'Max win', value: '7,777x' },
	],
};

/** the Ante card's rows per slider stop, keyed by the mode key (game/betModeMeta.ts ANTE_KEYS) */
export const ANTE_ODDS: Record<string, OddsRow[]> = {
	ANTE_2: [
		{ label: 'Free Spins', value: '~1 in 76' },
		{ label: 'Super Free Spins', value: '~1 in 1,000' },
		{ label: 'Base game, no Ante', value: '~1 in 213 / 2,128' },
	],
	ANTE_4: [
		{ label: 'Free Spins', value: '~1 in 43' },
		{ label: 'Super Free Spins', value: '~1 in 250' },
		{ label: 'Base game, no Ante', value: '~1 in 213 / 2,128' },
	],
	ANTE_10: [
		{ label: 'Free Spins', value: '~1 in 51' },
		{ label: 'Super Free Spins', value: '~1 in 40' },
		{ label: 'Base game, no Ante', value: '~1 in 213 / 2,128' },
	],
};

/** stated once under the cards */
export const MAX_WIN_NOTE = MAX_WIN_ROW;
