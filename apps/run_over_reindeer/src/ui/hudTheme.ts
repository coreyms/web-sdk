// THE HUD THEME: Run Over Reindeer's "Frost" (Corey's pick from the Frost mock, concept "Frost, Red Ring": a green
// feature button that turns red with a mode on, a red ring around the Spin and a green spinner inside it). The HUD itself
// is Manticore's (HUD round 5 "Drop 6" and round 6, copied from apps/manticore_mayhem/src/ui/hud); this file is the one
// place for every color, glass tint, edge gradient, glow, radius and alpha it draws with, named by ROLE, plus the
// per-game words and glyph (HUD_CONFIG). Every HUD component and ui/hud/HudStyles.svelte read these through CSS custom
// properties only; no component hard-codes a theme color (ui/HUD_THEME.md). Colors that are used at many strengths
// are given as "r, g, b" triplets (the -rgb tokens) so a rule can say rgba(var(--hud-accent-rgb), 0.55); single-use
// colors are plain values.
// The tokens marked NEW are not in Manticore's hudTheme.ts yet: Manticore draws those roles with its accent (gold) or
// its glass colors, so each NEW token's Manticore value is given beside it (copy them there and Manticore looks the
// same as now, and the two hud.css files are the same again).
// Injected once as a :root block (like ui/fontFaces.ts), so the HUD layer and the modals all see it.
import type { EngraveSettings } from './hud/engrave';

export const HUD_THEME: Record<string, string> = {
	// ---- type ----
	/** the HUD face: Outfit's one static Black (900) face, ui/fontFaces.ts */
	font: "'Outfit', system-ui, sans-serif",
	/** the Autoplay menu's title face (this game's display face) */
	'font-title': "'Overpass', 'Outfit', sans-serif",

	// ---- ink ----
	/** numbers, icons and button words */
	'ink-rgb': '255, 255, 255',
	/** the small spaced words over the numbers (BALANCE, SPIN) and under the keys: icy blue */
	'label-rgb': '166, 216, 255',
	/** NEW (Manticore 0.74, written in its hud.css): the small words' strength (BALANCE, WIN, SPIN, MENU, AUTO, TURBO).
	 *  A scene's glass sets it (HUD_GLASS below) */
	'label-a': '0.74',
	/** the second label (WIN, the portrait and sideways words): a paler ice */
	'label-warm-rgb': '200, 232, 255',
	/** text shadows and drop shadows: a cold near black */
	'shadow-rgb': '2, 8, 18',

	// ---- the accent: Rudolph-nose red (Menu or Auto open, Turbo pips, the Ante rim and amount, the Spin's glow) ----
	'accent-rgb': '232, 51, 61',
	'accent-hi-rgb': '255, 106, 106',
	/** the pale accent ink: the Ante amount, the open Menu key's rim */
	'accent-ink-rgb': '255, 214, 214',
	/** the palest accent ink (the Spin's top light, the feature button's words with a mode on) */
	'accent-cream-rgb': '255, 242, 242',
	/** the dark end of the accent (slider fill start) */
	'accent-deep-rgb': '156, 20, 32',

	// ---- the win: gold white, so a win reads warm on the cold glass (NEW; Manticore: its accent set) ----
	/** NEW (Manticore '232, 182, 74', its accent-rgb): a lit WIN's glow */
	'win-rgb': '255, 231, 166',
	/** NEW (Manticore '246, 213, 138', its accent-hi-rgb): a lit WIN's word and the big win's rim */
	'win-hi-rgb': '255, 231, 166',
	/** NEW (Manticore '255, 230, 168', its accent-ink-rgb): a lit WIN's number in portrait and sideways */
	'win-ink-rgb': '255, 244, 214',
	/** NEW (Manticore '255, 243, 210', its accent-cream-rgb): a lit WIN's number on the desktop dock */
	'win-cream-rgb': '255, 246, 222',
	/** NEW (Manticore 0.7, written in its hud.css): the dark under-glow of that number. A scene's glass sets it (HUD_GLASS) */
	'win-shadow-a': '0.7',
	/** NEW (the win's sunburst, 2026-11-20, the mock win_readout_r1's gold): the rays' light, their pale core, the lit
	 *  number's ink, the hottest face (ui/hud/HudReadout.svelte, hud.css .wburst) */
	'burst-rgb': '255, 204, 96',
	'burst-hi-rgb': '255, 232, 166',
	'burst-ink-rgb': '255, 246, 222',
	'burst-face-rgb': '255, 252, 236',

	// ---- the upright phone's plain-text readouts (WIN, BALANCE, the amount: hud.css .stat.pt), NEW (Manticore: its ink,
	// its label-warm and its shadow, as the rules had them). These defaults are the 'light' set of HUD_READOUT_INK below:
	// a scene preset swaps them (game/scenePresets.ts readoutInk) ----
	'pt-ink-rgb': '255, 255, 255',
	'pt-label-rgb': '200, 232, 255',
	'pt-shadow': '0 1px 2px rgba(2, 8, 18, 0.95), 0 0 7px rgba(2, 8, 18, 0.75), 0 0 2px rgba(2, 8, 18, 0.9)',
	/** a lit WIN's number and its glow */
	'pt-win-ink-rgb': '255, 244, 214',
	'pt-win-shadow': '0 0 9px rgba(255, 231, 166, 0.95), 0 0 18px rgba(255, 231, 166, 0.5), 0 1px 2px rgba(2, 8, 18, 0.95), 0 0 2px rgba(2, 8, 18, 0.9)',
	/** a lit WIN's word (Manticore: its win-hi) */
	'pt-win-label-rgb': '255, 231, 166',
	/** an Ante amount, and its word (Manticore: its accent-ink and accent-hi) */
	'pt-ante-ink-rgb': '255, 214, 214',
	'pt-ante-label-rgb': '255, 106, 106',
	'pt-ante-shadow': '0 0 8px rgba(232, 51, 61, 0.6), 0 1px 2px rgba(2, 8, 18, 0.95), 0 0 2px rgba(2, 8, 18, 0.9)',
	/** NEW (the win's sunburst, 2026-11-20): the upright readout's rays, their core, the lit number's ink and glow (the
	 *  snow ink set warms the gold to amber and keeps its own dark ink, as the mock draws it on snow) */
	'pt-burst-rgb': '255, 204, 96',
	'pt-burst-hi-rgb': '255, 232, 166',
	'pt-burst-ink-rgb': '255, 246, 222',
	'pt-burst-shadow': '0 0 7px rgba(255, 204, 96, 0.62), 0 1px 2px rgba(2, 8, 18, var(--hud-win-shadow-a, 0.7))',

	// ---- painted glass: pale cold blue-white at low strength, so the dark bed shows through like ice over it ----
	/** dock fill, top / middle / bottom of its vertical gradient, and their alphas */
	'glass-top-rgb': '206, 232, 255',
	'glass-mid-rgb': '163, 201, 238',
	'glass-bottom-rgb': '120, 170, 220',
	'glass-top-a': '0.13',
	'glass-mid-a': '0.1',
	'glass-bottom-a': '0.08',
	/** NEW (Manticore: its glass-top / mid / bottom-rgb): the menu panels' fill, a deeper ice blue, nearly solid */
	'panel-top-rgb': '38, 60, 88',
	'panel-mid-rgb': '30, 48, 72',
	'panel-bottom-rgb': '20, 33, 52',
	/** the menu panels' fill alphas */
	'panel-top-a': '0.96',
	'panel-mid-a': '0.96',
	'panel-bottom-a': '0.97',
	/** a key's own glass (the round keys, the steppers, chips) */
	'key-rgb': '70, 98, 128',
	/** NEW (bet bar fix 2026-11-19; Manticore its own): that glass's strength */
	'key-a': '0.38',
	/** NEW (bet bar fix): a key's rim, one even 1 px line all round (the old rim was white on top, gold or ice below, and
	 *  stopped dead at each corner), and its strength at rest; a hover lifts it by 0.26 */
	'key-rim-rgb': '206, 232, 255',
	'key-rim-a': '0.24',
	/** NEW (bet bar fix, Corey: "the menu button itself should have a much darker glass so it stands out"): the Menu key's
	 *  near opaque night blue glass, top and bottom of its gradient, its strength, and its rim */
	'menu-key-1-rgb': '20, 34, 54',
	'menu-key-2-rgb': '7, 13, 22',
	'menu-key-a': '0.95',
	'menu-key-rim-rgb': '166, 216, 255',
	/** NEW (bet bar fix, Corey: "make the Auto and Turbo Buttons change colors when active"): a lit key's own fill.
	 *  ON (Auto with a run on, Turbo, the open Menu, the picked scene): a deep red glass with a red rim.
	 *  HOT (a run playing, Turbo at its instant level): the bright red of the Spin's ring, a cream rim and a glow */
	'key-on-1-rgb': '150, 26, 38',
	'key-on-2-rgb': '92, 13, 21',
	'key-on-a': '0.94',
	'key-on-ink-rgb': '255, 226, 226',
	'key-hot-1-rgb': '240, 66, 76',
	'key-hot-2-rgb': '176, 24, 36',
	'key-hot-ink-rgb': '255, 255, 255',
	/** the edge gradient: a bright frosted top edge and a soft icy blue bottom edge, and their peak alphas */
	'edge-top-rgb': '240, 250, 255',
	'edge-top-a': '0.95',
	'edge-bottom-rgb': '150, 212, 255',
	'edge-bottom-a': '0.6',
	/** NEW (Manticore '232, 182, 74', its accent-rgb): a key's bottom edge (round keys, steppers, chips) */
	'edge-key-rgb': '150, 212, 255',
	/** the specular line just under a top edge */
	'spec-a': '0.7',

	// ---- the hero: Spin (a red ring, a cold slate face, a green track and spinner inside) ----
	/** the Spin's core (center, rim) */
	'spin-core-rgb': '30, 44, 64',
	'spin-deep-rgb': '14, 20, 29',
	/** the Spin's rim: top, side, bottom */
	'spin-rim-top': '#ff6a6a',
	'spin-rim-side': '#d0242f',
	'spin-rim-bottom': '#c4202c',
	/** NEW (Manticore '1px'): the rim's width */
	'spin-rim-w': '2px',
	/** NEW (Manticore '255, 255, 255' and '0.1', its ink at 0.1): the thin circle inside the ring */
	'spin-track-rgb': '47, 191, 107',
	'spin-track-a': '0.5',
	/** NEW (Manticore '246, 213, 138', its accent-hi-rgb): the spinner that runs on it, the free-spins arc */
	'spin-arc-rgb': '79, 224, 140',

	// ---- the second hero: the feature button (FAST LANE), holly green with a white edge ----
	'feature-rgb': '18, 138, 69',
	'feature-hi-rgb': '74, 200, 122',
	'feature-deep-1-rgb': '18, 138, 69',
	'feature-deep-2-rgb': '10, 84, 42',
	'feature-rim-rgb': '255, 255, 255',
	'feature-ink': '#ffffff',
	/** NEW (Manticore '232, 182, 74', its accent-rgb): the feature button's bottom edge */
	'feature-edge-bottom-rgb': '255, 255, 255',
	/** the feature button with a mode ON (an Ante level, an armed buy): red, a bright red rim and glow */
	'feature-on-deep-1-rgb': '196, 32, 44',
	'feature-on-deep-2-rgb': '118, 19, 26',
	'feature-on-rim': '#ff8a8a',
	/** NEW (the engraved mark, 2026-11-19): the inlay's gold, light to dark (the mock's warm gold on the holly green), and
	 *  the hub's accent (the --pm-core of the old BonusButton, archived 2026-11-23) */
	'mark-g1-rgb': '252, 228, 146',
	'mark-g2-rgb': '238, 196, 88',
	'mark-g3-rgb': '200, 144, 40',
	'mark-g4-rgb': '128, 84, 18',
	'mark-accent-rgb': '25, 211, 218',
	/** NEW (the engraved mark): the dark under the mode's word on the gold inlay (.scr), at its middle */
	'mark-scrim-a': '0.72',
	/** NEW (the disabled key, "Cold Inlay", 2026-11-20): the steel the mark is inlaid in while the key cannot be pressed,
	 *  light to dark (the mock feature_key_disabled_r1's Reindeer steel) */
	'mark-steel-1-rgb': '186, 198, 212',
	'mark-steel-2-rgb': '146, 162, 182',
	'mark-steel-3-rgb': '102, 118, 140',
	'mark-steel-4-rgb': '58, 70, 88',

	// ---- states ----
	/** a disabled key's opacity */
	'disabled-a': '0.34',
	/** a locked readout's opacity (the amount while a spin runs) */
	'locked-a': '0.5',
	/** the dimmed scene behind the Autoplay menu */
	'dim': 'rgba(4, 12, 24, 0.5)',

	// ---- shape ----
	'radius-panel': '18px',
	'radius-chip': '14px',
};

/** THE GLASS, per scene (game/scenePresets.ts hudGlass): the dock's, the capsules' and the key bar's fill. 'ice' is the
 *  theme as drawn for a dark scene (the values above); 'deep' (scene pass 9, Corey's pick on the wider scene r2 mock:
 *  "deeper glass") takes the theme's own menu-panel blues at about 0.8, so the HUD reads on white snow. No backdrop.
 *  The scene swap (2026-11-17): the deeper glass's small words at 0.9 (was the theme's 0.74), so AUTO and TURBO on their
 *  keys read 3:1 or more over every scene (they measured 2.97:1 on the day snow at 0.74), and a lit WIN's dark
 *  under-glow at 0.95 (was 0.7), so its number reads 4.5:1 over its own gold glow (4.44:1 at 0.7 on the Free Spins night). */
/*  The bet bar fix (2026-11-19, Corey: "Slightly darken the glass overall so the SPIN/WIN/BALANCE stand out better"): the
 *  deeper glass a step stronger, so less of the snow shows through (0.8 / 0.78 / 0.76 before), the ice glass
 *  a step fainter so more of the dark bed shows (0.17 / 0.13 / 0.11 before). */
export const HUD_GLASS = {
	ice: { 'glass-top-rgb': '206, 232, 255', 'glass-mid-rgb': '163, 201, 238', 'glass-bottom-rgb': '120, 170, 220', 'glass-top-a': '0.13', 'glass-mid-a': '0.1', 'glass-bottom-a': '0.08', 'label-a': '0.74', 'win-shadow-a': '0.7' },
	deep: { 'glass-top-rgb': '38, 60, 88', 'glass-mid-rgb': '30, 48, 72', 'glass-bottom-rgb': '20, 33, 52', 'glass-top-a': '0.88', 'glass-mid-a': '0.87', 'glass-bottom-a': '0.86', 'label-a': '0.9', 'win-shadow-a': '0.95' },
} as const satisfies Record<string, Record<string, string>>;

/** THE UPRIGHT PHONE'S READOUT INK, per scene (game/scenePresets.ts readoutInk): 'light' over a dark scene (the values
 *  above), 'dark' over snow (scene pass 9, from the snow portrait r1 mock: the numbers in the picture's near black ink,
 *  the small words in a dark slate blue, a 1 px white under-glow instead of the dark shadow; a lit WIN keeps the ink and
 *  gets a warm gold glow, an Ante amount a deep red) */
export const HUD_READOUT_INK = {
	light: {
		'pt-ink-rgb': HUD_THEME['pt-ink-rgb'],
		'pt-label-rgb': HUD_THEME['pt-label-rgb'],
		'pt-shadow': HUD_THEME['pt-shadow'],
		'pt-win-ink-rgb': HUD_THEME['pt-win-ink-rgb'],
		'pt-win-shadow': HUD_THEME['pt-win-shadow'],
		'pt-win-label-rgb': HUD_THEME['pt-win-label-rgb'],
		'pt-ante-ink-rgb': HUD_THEME['pt-ante-ink-rgb'],
		'pt-ante-label-rgb': HUD_THEME['pt-ante-label-rgb'],
		'pt-ante-shadow': HUD_THEME['pt-ante-shadow'],
		'pt-burst-rgb': HUD_THEME['pt-burst-rgb'],
		'pt-burst-hi-rgb': HUD_THEME['pt-burst-hi-rgb'],
		'pt-burst-ink-rgb': HUD_THEME['pt-burst-ink-rgb'],
		'pt-burst-shadow': HUD_THEME['pt-burst-shadow'],
	},
	/** the night scenes (the scene swap, 2026-11-17): the light set, with a lit WIN's number held a step darker round its
	 *  strokes (its gold glow a little softer, a 1 px dark rim added), so it reads 4.5:1 on the blue snow (4.49:1 with the
	 *  light set's own glow on the Free Spins night) */
	night: {
		'pt-ink-rgb': HUD_THEME['pt-ink-rgb'],
		'pt-label-rgb': HUD_THEME['pt-label-rgb'],
		'pt-shadow': HUD_THEME['pt-shadow'],
		'pt-win-ink-rgb': HUD_THEME['pt-win-ink-rgb'],
		'pt-win-shadow': '0 0 9px rgba(255, 231, 166, 0.85), 0 0 18px rgba(255, 231, 166, 0.5), 0 1px 2px rgba(2, 8, 18, 0.95), 0 0 2px rgba(2, 8, 18, 0.95), 0 0 1px rgba(2, 8, 18, 0.95)',
		'pt-win-label-rgb': HUD_THEME['pt-win-label-rgb'],
		'pt-ante-ink-rgb': HUD_THEME['pt-ante-ink-rgb'],
		'pt-ante-label-rgb': HUD_THEME['pt-ante-label-rgb'],
		'pt-ante-shadow': HUD_THEME['pt-ante-shadow'],
		'pt-burst-rgb': HUD_THEME['pt-burst-rgb'],
		'pt-burst-hi-rgb': HUD_THEME['pt-burst-hi-rgb'],
		'pt-burst-ink-rgb': HUD_THEME['pt-burst-ink-rgb'],
		'pt-burst-shadow': HUD_THEME['pt-burst-shadow'],
	},
	dark: {
		'pt-ink-rgb': '24, 26, 33',
		'pt-label-rgb': '44, 62, 92',
		'pt-shadow': '0 1px 0 rgba(255, 255, 255, 0.6)',
		'pt-win-ink-rgb': '24, 26, 33',
		'pt-win-shadow': '0 0 7px rgba(255, 196, 64, 0.95), 0 0 14px rgba(255, 196, 64, 0.6), 0 1px 0 rgba(255, 255, 255, 0.6)',
		'pt-win-label-rgb': '122, 78, 8',
		'pt-ante-ink-rgb': '156, 20, 32',
		'pt-ante-label-rgb': '156, 20, 32',
		'pt-ante-shadow': '0 1px 0 rgba(255, 255, 255, 0.6)',
		'pt-burst-rgb': '241, 163, 49',
		'pt-burst-hi-rgb': '248, 196, 103',
		'pt-burst-ink-rgb': '24, 26, 33',
		'pt-burst-shadow': '0 0 6px rgba(241, 163, 49, 0.9), 0 0 13px rgba(241, 163, 49, 0.5), 0 1px 0 rgba(255, 255, 255, 0.6)',
	},
} as const satisfies Record<string, Record<string, string>>;

/** THE FEATURE BUTTON'S GLYPH CANDIDATES (bet bar fix 2026-11-19; Stake forbids stock icons and clipart, and the old
 *  road in perspective read as one): drawn here in SVG from the game's own world, in its art style (the thick near black
 *  ink outline of the signs and the cars), 24 x 24, painted in their own colors (not currentColor). No generated art.
 *    sign     the reels' diamond road sign (the yellow Q sign's shape and ink) with its snow cap, a lane arrow on its face
 *    antlers  Rudolph's head from the front: antlers, ears, eyes and the red nose */
export const FEATURE_GLYPHS = {
	sign: '<path d="M12 2.4 21.6 12 12 21.6 2.4 12Z" fill="#ffd427" stroke="#16171c" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 8.6 15.4 12.3H13.2V16.9H10.8V12.3H8.6Z" fill="#16171c"/><path d="M8.1 6.3 12 2.4l3.9 3.9c-.8.8-1.8.7-2.4 0-.7.8-1.9.8-2.6 0-.7.8-1.9.8-2.8 0Z" fill="#fff" stroke="#16171c" stroke-width="1.1" stroke-linejoin="round"/>',
	antlers:
		'<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10 9.4C8.6 7.8 7.5 6.1 7.3 3.4M7.6 5.8 4.9 4.8M8.7 7.8 10 5.3M14 9.4C15.4 7.8 16.5 6.1 16.7 3.4M16.4 5.8 19.1 4.8M15.3 7.8 14 5.3" stroke="#16171c" stroke-width="3.6"/><path d="M10 9.4C8.6 7.8 7.5 6.1 7.3 3.4M7.6 5.8 4.9 4.8M8.7 7.8 10 5.3M14 9.4C15.4 7.8 16.5 6.1 16.7 3.4M16.4 5.8 19.1 4.8M15.3 7.8 14 5.3" stroke="#ecc983" stroke-width="1.5"/></g><path d="M9 10.9 5.5 9.9c.4 1.7 1.7 2.5 3.6 2.3ZM15 10.9l3.5-1c-.4 1.7-1.7 2.5-3.6 2.3Z" fill="#a8622e" stroke="#16171c" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 8.7c2.1 0 3.5 1.2 3.5 3 0 2.7-1.4 6.6-3.5 6.6s-3.5-3.9-3.5-6.6c0-1.8 1.4-3 3.5-3Z" fill="#a8622e" stroke="#16171c" stroke-width="1.6"/><circle cx="10.6" cy="12.1" r=".75" fill="#16171c"/><circle cx="13.4" cy="12.1" r=".75" fill="#16171c"/><circle cx="12" cy="17.7" r="2" fill="#ee2f3b" stroke="#16171c" stroke-width="1.2"/><circle cx="11.4" cy="17.1" r=".55" fill="#fff"/>',
} as const;
export type FeatureGlyph = 'none' | keyof typeof FEATURE_GLYPHS;

/** THE PER-GAME WORDS AND GLYPH: the feature button's name and its glyph. */
export const HUD_CONFIG = {
	/** the button's word (the menu itself is game/featureMenuData.ts FEATURE_MENU_TEXT.name, THE FAST LANE) */
	featureName: 'FAST LANE',
	/** THE PICK (bet bar fix 2026-11-19): 'none' is the word alone, centered (on the sideways phone's small circle the
	 *  word takes the glyph's place); 'sign' or 'antlers' draws that candidate (FEATURE_GLYPHS) beside the word, and on
	 *  the rules page's guide. One line to change. */
	featureGlyph: 'none' as FeatureGlyph,
	/** RETIRED 2026-11-19 (read as a stock road icon; no longer drawn): a road in perspective, the Frost mock's glyph */
	featureIcon: 'M9 3 4.5 21M15 3l4.5 18M12 4.5v2M12 10v3M12 16.5V20',
	/** the mode key that draws the hotter "on" state (the double rim): the top Ante level (Manticore: SUPER_ANTE) */
	topAnteKey: 'ANTE_10',
	/** THE ENGRAVED MARK (2026-11-19, the approved mock logo_button_r1; Corey: "No text. Only logo", then "when the Ante or
	 *  something is enabled we should go with the inlay style for the logo in the same spot. With the text over it for
	 *  the mode enabled, similar to today"). The feature key shows only the PolyMath mark sunk into its glass (ui/hud/
	 *  engrave.ts): `rest` with no mode on (Corey's settings, verbatim from the mock's "Copy my settings"), `on` with a
	 *  mode on (the same mark in the same place, inlaid in gold, the mode's word over it). `round` overrides the place
	 *  and size on the sideways phone's small circle. null: the word (and featureGlyph) as before. */
	featureMark: {
		rest: { look: 'etch', hub: false, size: 230, x: 0, y: 14, rot: 0, depth: 40, strength: 95, light: 0 },
		on: { look: 'inlay', hub: false, size: 230, x: 0, y: 14, rot: 0, depth: 40, strength: 95, light: 0 },
		/** DISABLED (2026-11-20, Corey's pick "Cold Inlay" from the mock feature_key_disabled_r1, its default mark strength
		 *  62): the same mark in the same place, inlaid in steel (mark-steel-*) on the dimmed key */
		off: { look: 'inlay', hub: false, size: 230, x: 0, y: 14, rot: 0, depth: 40, strength: 62, light: 0 },
		/** the sideways phone's 34 px circle: the same three struts meeting at the hub, the hub whole and clear of the
		 *  round rim (at the pill's 230 % and +14 % the hub's dome met the circle's curve in two slivers) */
		round: { size: 200, x: 0, y: -10 },
	} as FeatureMark | null,
};
// ---- THE GAME BAR IN USE (2026-11-22) -------------------------------------------------------------------------------
/** 'sign' is the road sign bar (ui/sign/, Corey's approved mocks desktop_hud_r8 to r10 and phone_layout_r2: the diamond
 *  Play with its LED border, the sign keys, the Fast Lane hexagon, bare bet symbols, plate headers); 'dock' is the glass
 *  dock it replaced (ui/hud/, kept whole for a rollback and for an A/B on the probe host). One constant: the three
 *  chromes, the canvas beds under the dock (components/HudBeds.svelte) and the desktop LED strip's height
 *  (game/scoreboard/layout.ts) read it.
 *  THE CONSTANT ITSELF is in ui/sign/signLayout.ts and is passed on here (2026-11-23): the canvas's layout files
 *  (game/scoreboard/layout.ts, ui/hud/hudLayout.ts) read it there, because this file sets the theme on the page as it
 *  loads and so cannot be loaded where there is no page (tools/led_warm_check.mjs failed on that from 791eba85). */
export { HUD_BAR } from './sign/signLayout';

/** THE SIGN BAR'S TOKENS: every color and every drawing number of ui/sign/ that is not a place (places and sizes are
 *  ui/sign/signLayout.ts). From Corey's exports: corey_play_r6 (the Play, locked), corey_hud_r8 (the rest), round 9
 *  (the etched mark stays etched with a mode on) and round 10 (SPIN). */
export const SIGN = {
	navy: '#0d1a2e',
	black: '#0a0d12',
	green: '#0b7a43',
	red: '#c8102e',
	yellow: '#fccd02',
	hot: '#ffa300',
	band: '#f4f8fc',
	/** his glass: a dark gradient at `a` under a flat tint of the state's color at `t` */
	glass: { top: '#26384f', bottom: '#0b111a', a: 0.6, t: 0.6, shine: '#e6f2ff' },
	/** the Play's own darker glass gradient (the mock's play.js) */
	playGlass: { top: '#1d2a3a', bottom: '#070b12' },
	/** THE PLAY (a 240 unit box, the diamond's point at 113.6, corner radius 20.45): its band, the navy keyline outside
	 *  it and the black line inside it, the LED channel between them */
	play: { V: 113.6, R: 20.45, band: 8.5, keyline: 2.6, inner: 1.1, chOut: 1.3 },
	/** THE LEDS: how many, the spin chase's light (intensity, halo, reach in LED spacings, core) and its lap in seconds
	 *  at Turbo 0, 1, 2; the idle twinkle (his round 6 values): intensity, halo, reach, core, how many at once, speed */
	led: {
		count: 36,
		spin: { light: 0.55, halo: 1, reach: 2, core: 8 },
		lapS: 1.7,
		rate: [1, 1.7, 2.6],
		idle: { light: 1, halo: 1, reach: 2, core: 8, count: 5, speed: 2.5 },
		/** the chase's floor: an LED between two runners */
		floor: 0.08,
		/** the frames a second the lights are drawn at: the chase, the twinkle (ui/sign/ledBand.ts) */
		fps: { chase: 30, idle: 20 },
		/** the light canvas is never drawn above this many physical px per CSS px, nor wider than this many px */
		maxDpr: 3,
		maxPx: 640,
	},
	/** the words in the Play (Overpass 900; sizes in the 240 unit box): SPIN (round 10), STOP (60 x 0.68, across -3), the
	 *  autoplay count (AUTO over the number), the free spins text (SPIN, the number, OF n); `ol` the outline's width */
	text: {
		spin: { size: 44.5, ol: 2.6, ls: 0.03, x: 0 },
		stop: { size: 40.8, ol: 2.6, ls: 0.03, x: -3 },
		auto: { label: 18, num: 48, ol: 2.9, ls: 0.1 },
		fs: { label: 18, num: 41, sub: 17.5, ol: 1.9, ls: 0.02 },
		/** a text box stays inside the band's black line, less 4 */
		limit: 4,
	},
	/** THE FREE SPINS RING: radius, LED radius, the gap between LEDs, the recess's lip; a round starts at 10 spins and a
	 *  retrigger adds 3 (the books hold 10, 13, 16, 19) */
	ring: { R: 56, r: 4.5, gap: 2, lip: 1.6 },
	/** AUTO AND TURBO (candidate C, the road sign): band, keyline and inner line for a key of size 80; the corner
	 *  rounding as a share of the diamond's width */
	key: { bw: 4.4, ko: 1.3, ki: 1.0, margin: 2.2, corner: 0.09, content: 0.8, glow: '#ffd23a', glowHot: '#ffb000' },
	/** THE FAST LANE KEY: its band on his 110 bar px key, the lights with a mode on (the runner's light, the steady glow
	 *  under it, the speed), the etching's strength */
	bonus: { band: 7, light: 1, base: 0.35, speed: 1, etch: 1, refH: 110, corner: 0.07 },
	/** the Win box: its short rise in and out (ms and CSS px at scale 1) */
	win: { inMs: 280, outMs: 200, rise: 12 },
} as const;

/** the engraved mark's settings: rest, on, and the sideways circle's place and size (null: the same as the pill's) */
export type FeatureMark = { rest: EngraveSettings; on: EngraveSettings; off: EngraveSettings | null; round: Pick<EngraveSettings, 'size' | 'x' | 'y'> | null };

// ---- THE SIGN PANELS (2026-11-23) -----------------------------------------------------------------------------------
/** THE POP-UP PANELS IN THE SIGN BAR'S STYLE: Corey's pick from the mock menus_r1_2026-11-23, style A "Guide sign" at
 *  its defaults ("I like the green menus, no need to keep the white confirmation for light mode. Just green
 *  everywhere."): the bar's green field, its white band with the navy line outside and the black line inside, the
 *  chosen tile a white plate, the main key the Turbo yellow. The five numbers he was shown are these; every other
 *  panel color is worked out from them and from SIGN exactly as the mock worked them out (signPanelTokens), and reaches
 *  the page as --sp-* custom properties (ui/sign/signPanel.css, the panels' own style blocks). */
export const SIGN_PANEL = { field: SIGN.green, band: SIGN.band, accent: SIGN.yellow, thickness: 4, radius: 14 } as const;
const hexMix = (a: string, b: string, k: number) =>
	'#' +
	[1, 3, 5]
		.map((i) => {
			const x = parseInt(a.slice(i, i + 2), 16);
			const y = parseInt(b.slice(i, i + 2), 16);
			return Math.round(x + (y - x) * k)
				.toString(16)
				.padStart(2, '0');
		})
		.join('');
export const signPanelTokens = (): Record<string, string> => {
	const P = SIGN_PANEL;
	const bw = P.thickness;
	const px = (v: number) => `${Math.round(v * 100) / 100}px`;
	return {
		/** the field: the bar's green, a little lighter at the top and darker at the foot; flat on the confirm card */
		field: P.field,
		'f-top': hexMix(P.field, '#ffffff', 0.13),
		'f-bot': hexMix(P.field, '#000000', 0.14),
		/** the words: white, and two softer strengths for the small lines; the hairlines between rows */
		ink: '#ffffff',
		ink2: 'rgba(255, 255, 255, 0.84)',
		ink3: 'rgba(255, 255, 255, 0.74)',
		rule: 'rgba(255, 255, 255, 0.26)',
		/** the frame: the white band, the navy line outside it, the black line inside it */
		band: P.band,
		bw: px(bw),
		ko: px(Math.max(1, bw * 0.3)),
		'ko-c': SIGN.navy,
		ki: px(Math.max(0.8, bw * 0.22)),
		'ki-c': SIGN.black,
		rad: px(P.radius),
		/** a small plate set into a panel (tiles, pills, rows, keys): its corner, its line, its dark fill, its hover */
		wrad: px(Math.min(P.radius * 0.7, 12)),
		wl: px(Math.min(3, Math.max(1.5, bw * 0.4))),
		well: 'rgba(0, 0, 0, 0.27)',
		hov: 'rgba(255, 255, 255, 0.12)',
		/** a slider's and a switch's track */
		trk: 'rgba(0, 0, 0, 0.42)',
		/** the chosen tile: a white plate, deep green words, a black line round it */
		'ch-bg': P.band,
		'ch-ink': hexMix(P.field, '#000000', 0.38),
		'ch-out': SIGN.black,
		/** the main key: the Turbo yellow, lit from the top, the dark drop it presses into, its near black words */
		acc: P.accent,
		'acc-top': hexMix(P.accent, '#ffffff', 0.14),
		'acc-bot': hexMix(P.accent, '#000000', 0.08),
		'acc-deep': hexMix(P.accent, '#000000', 0.5),
		'acc-ink': '#14161a',
		krad: px(Math.min(Math.max(P.radius * 0.8, 0), 14)),
		/** the confirm card: a step thicker and rounder than a panel */
		cbw: px(Math.max(3, bw + 1)),
		crad: px(P.radius + 2),
	};
};

/** the theme as one :root block, with a scene's tokens laid over it (applyHudScene); the sign panels' tokens with it */
let sceneTokens: Record<string, string> = {};
export const hudThemeCss = () => `:root{${Object.entries({ ...HUD_THEME, ...sceneTokens })
	.map(([k, v]) => `--hud-${k}:${v};`)
	.join('')}${Object.entries(signPanelTokens())
	.map(([k, v]) => `--sp-${k}:${v};`)
	.join('')}}`;

const themeElement = () => {
	if (typeof document === 'undefined') return null;
	let el = document.getElementById('hud-theme');
	if (!el) {
		el = document.createElement('style');
		el.id = 'hud-theme';
		el.textContent = hudThemeCss();
		document.head.appendChild(el);
	}
	return el;
};
themeElement();

/** THE SCENE'S HUD TOKENS (game/stateScene.svelte.ts setScenePreset): the glass and the upright readouts' ink for the
 *  scene now showing, written into the one theme block (theme values only: nothing about the HUD's shape changes) */
export const applyHudScene = (glass: keyof typeof HUD_GLASS, ink: keyof typeof HUD_READOUT_INK) => {
	sceneTokens = { ...HUD_GLASS[glass], ...HUD_READOUT_INK[ink] };
	const el = themeElement();
	if (el) el.textContent = hudThemeCss();
};
