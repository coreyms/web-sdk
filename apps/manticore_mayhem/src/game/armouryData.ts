// THE ARMOURY'S SIX MODES (the feature menu; spec ~/Desktop/Manticore Mayhem/feedback/armoury_build_r1/SPEC.md 2.6).
// Game specific: what a future game changes (spec 10). The copy is game/armouryText.ts, the tuned numbers are
// constants.ts ARMOURY, the pictures static/assets/ui/armoury/ (tools/build_armoury_assets.py).
//
// Prices are never here: a mode's cost is the RGS's (betModeMeta.ts modeCost), so the menu cannot quote a price the
// wallet will not charge. Spin counts, tile caps and the Mystery's shares come from config.ts.
//
// Order is the tray's order (and the order of the cells in thumbs.webp): the two per spin modes, then the four buys.
import config from './config';

export type ArmouryModeId = 'ANTE' | 'SUPER_ANTE' | 'BONUS' | 'SUPER' | 'EPIC' | 'MYSTERY';
/** `spin`: stays on until switched off (activateMode). `buy`: one round loaded onto Spin (buyMode) */
export type ArmouryGroup = 'spin' | 'buy';
/** the hero picture's key: hero-<art>.webp, its thumbs cell, its heroes.json entry */
export type ArmouryArt = 'crest-day' | 'crest-fire' | 'standard' | 'dagger' | 'crown' | 'seal';

export type ArmouryOddsRow = {
	/** the share, 0..1, from config.mystery */
	share: number;
	/** armouryText.ts ARMOURY_TEXT.odds key */
	text: 'nothing' | 'super' | 'epic';
	color: string;
};

export type ArmouryMode = {
	id: ArmouryModeId;
	group: ArmouryGroup;
	/** the mode colour: the tile mark, the plate's top rule, the rays, the diamond */
	accent: string;
	/** the tint's colour while this mode is chosen */
	tint: string;
	art: ArmouryArt;
	/** share of the hero box the picture fills (the prototype's heroH) */
	heroH: number;
	volatility: 1 | 2 | 3 | 4;
	odds?: readonly ArmouryOddsRow[];
};

// accents are the old menu's (ui/bonusCards.ts, removed at the switch-over), tints and hero heights the prototype's (feature_menu_r2/src/page.js;
// SUPER and EPIC: the dagger and the crown at the prototype's default 0.9 since the manticore was scrapped as a hero)
export const ARMOURY_MODES: readonly ArmouryMode[] = [
	{ id: 'ANTE', group: 'spin', accent: '#e0b64a', tint: '#2a1a05', art: 'crest-day', heroH: 0.78, volatility: 2 },
	{ id: 'SUPER_ANTE', group: 'spin', accent: '#e08a3c', tint: '#301405', art: 'crest-fire', heroH: 0.78, volatility: 3 },
	{ id: 'BONUS', group: 'buy', accent: '#2eb0a8', tint: '#04282a', art: 'standard', heroH: 0.92, volatility: 2 },
	{ id: 'SUPER', group: 'buy', accent: '#7fb6ff', tint: '#071a3a', art: 'dagger', heroH: 0.9, volatility: 3 },
	{ id: 'EPIC', group: 'buy', accent: '#ff6a4a', tint: '#3a0805', art: 'crown', heroH: 0.9, volatility: 4 },
	{
		id: 'MYSTERY',
		group: 'buy',
		accent: '#b07fe0',
		tint: '#1e0d36',
		art: 'seal',
		heroH: 0.8,
		volatility: 4,
		odds: [
			{ share: config.mystery.nothing, text: 'nothing', color: '#8d7b5a' },
			{ share: config.mystery.super, text: 'super', color: '#7fb6ff' },
			{ share: config.mystery.epic, text: 'epic', color: '#ff6a4a' },
		],
	},
];

export const armouryMode = (id: string): ArmouryMode | undefined => ARMOURY_MODES.find((m) => m.id === id);

/** the six pictures in tray order: the cells of thumbs.webp, left to right */
export const ARMOURY_ART_ORDER: readonly ArmouryArt[] = ARMOURY_MODES.map((m) => m.art);

/** where the pictures are (paths for assets.ts stamp(); tools/build_armoury_assets.py writes them) */
export const ARMOURY_ASSETS = {
	dir: '/assets/ui/armoury/',
	plaque: '/assets/ui/armoury/plaque.webp',
	crest: '/assets/ui/armoury/crest.webp',
	thumbs: '/assets/ui/armoury/thumbs.webp',
	/** the flat hero: its grid's straight-on frame, full tier 640 px high, phone tier (PHONE_TIER) 320 */
	hero: (art: ArmouryArt, half: boolean) => `/assets/ui/armoury/hero-${art}${half ? '-half' : ''}.webp`,
	/** the confirm card's frame for the DESKTOP layout (the approved 1024 x 1536 original; the other layouts and the
	 *  moment before it is decoded use the intro cards' 768 px frame). Fetched when the menu opens, never at boot */
	cardLg: '/assets/ui/armoury/card-frame-lg.webp',
	/** the angle grids, if any: { <art>: { cols, rows, yaw, pitch, ar, cell, grid, turn } } (ui/armoury/heroGrid.ts parseHeroes) */
	heroes: '/assets/ui/armoury/heroes.json',
} as const;
