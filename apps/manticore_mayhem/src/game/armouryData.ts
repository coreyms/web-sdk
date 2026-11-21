// THE ARMOURY'S FOUR MODES (the feature menu; spec ~/Desktop/Manticore Mayhem/feedback/armoury_build_r1/SPEC.md 2.6).
// Six until 2026-11-21, when the Epic buy and the Mystery buy left the game (Corey: "I'd also consider removing Epic
// buy, and Mystery Buy from Manticore Mayhem. Leaving Epic Spins as spun into only.", then "yes"). Epic Free Spins
// stay as a feature reached only by scatters (or by a bought round that lands them), so the crown and seal pictures
// stay in the art folder and in thumbs.webp, unused by the menu.
// Game specific: what a future game changes (spec 10). The copy is game/armouryText.ts, the tuned numbers are
// constants.ts ARMOURY, the pictures static/assets/ui/armoury/ (tools/build_armoury_assets.py).
//
// Prices are never here: a mode's cost is the RGS's (betModeMeta.ts modeCost), so the menu cannot quote a price the
// wallet will not charge. Spin counts and tile caps come from config.ts.
//
// Order is the tray's order: the two per spin modes, then the two buys.
export type ArmouryModeId = 'ANTE' | 'SUPER_ANTE' | 'BONUS' | 'SUPER';
/** `spin`: stays on until switched off (activateMode). `buy`: one round loaded onto Spin (buyMode) */
export type ArmouryGroup = 'spin' | 'buy';
/** the hero picture's key: hero-<art>.webp, its thumbs cell, its heroes.json entry */
export type ArmouryArt = 'crest-day' | 'crest-fire' | 'standard' | 'dagger' | 'crown' | 'seal';

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
};

// accents are the old menu's (ui/bonusCards.ts, removed at the switch-over), tints and hero heights the prototype's (feature_menu_r2/src/page.js;
// SUPER and EPIC: the dagger and the crown at the prototype's default 0.9 since the manticore was scrapped as a hero)
// THE VOLATILITY PIPS (Corey 2026-10-21, after harsh review 2026-10-20 item 6 found the old pips against the mean
// wins): ranked by the play's risk against its price, not by the mean win. "these should be ranked by play risk amount
// vs the purchase amount. These are really marketing type numbers", "most players who play the free game buys are only
// doing 1-2 spins, Ante/Super Ante is typically 25-100"; his values: "Ante 3, Super Ante 4, Free Spins - Epic are 3
// and Mystery is 4" (was Ante 2, Super Ante 3, Free Spins 2, Super 3, Epic 4, Mystery 4)
export const ARMOURY_MODES: readonly ArmouryMode[] = [
	{ id: 'ANTE', group: 'spin', accent: '#e0b64a', tint: '#2a1a05', art: 'crest-day', heroH: 0.78, volatility: 3 },
	{ id: 'SUPER_ANTE', group: 'spin', accent: '#e08a3c', tint: '#301405', art: 'crest-fire', heroH: 0.78, volatility: 4 },
	{ id: 'BONUS', group: 'buy', accent: '#2eb0a8', tint: '#04282a', art: 'standard', heroH: 0.92, volatility: 3 },
	{ id: 'SUPER', group: 'buy', accent: '#7fb6ff', tint: '#071a3a', art: 'dagger', heroH: 0.9, volatility: 3 },
];

export const armouryMode = (id: string): ArmouryMode | undefined => ARMOURY_MODES.find((m) => m.id === id);

/** the menu's pictures in tray order: the heroes and grids game/armouryLoad.ts fetches (four since 2026-11-21) */
export const ARMOURY_ART_ORDER: readonly ArmouryArt[] = ARMOURY_MODES.map((m) => m.art);
/** the six cells of thumbs.webp, left to right (tools/build_armoury_assets.py): FIXED by the sprite, not by the tray, so
 *  each tile keeps its own cell now that crown (the Epic buy's) and seal (the Mystery's) are not drawn (2026-11-21) */
export const ARMOURY_THUMB_CELLS: readonly ArmouryArt[] = ['crest-day', 'crest-fire', 'standard', 'dagger', 'crown', 'seal'];

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
