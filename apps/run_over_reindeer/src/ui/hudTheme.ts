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
	 *  ON (a run loaded on the Spin, Turbo, the open Menu, the picked scene): a deep red glass with a red rim.
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
	 *  the hub's accent (BonusButton's --pm-core) */
	'mark-g1-rgb': '252, 228, 146',
	'mark-g2-rgb': '238, 196, 88',
	'mark-g3-rgb': '200, 144, 40',
	'mark-g4-rgb': '128, 84, 18',
	'mark-accent-rgb': '25, 211, 218',
	/** NEW (the engraved mark): the dark under the mode's word on the gold inlay (.scr), at its middle */
	'mark-scrim-a': '0.72',

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
		/** the sideways phone's 34 px circle: the same three struts meeting at the hub, the hub whole and clear of the
		 *  round rim (at the pill's 230 % and +14 % the hub's dome met the circle's curve in two slivers) */
		round: { size: 200, x: 0, y: -10 },
	} as FeatureMark | null,
};
/** the engraved mark's settings: rest, on, and the sideways circle's place and size (null: the same as the pill's) */
export type FeatureMark = { rest: EngraveSettings; on: EngraveSettings; round: Pick<EngraveSettings, 'size' | 'x' | 'y'> | null };

/** the theme as one :root block, with a scene's tokens laid over it (applyHudScene) */
let sceneTokens: Record<string, string> = {};
export const hudThemeCss = () => `:root{${Object.entries({ ...HUD_THEME, ...sceneTokens })
	.map(([k, v]) => `--hud-${k}:${v};`)
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
