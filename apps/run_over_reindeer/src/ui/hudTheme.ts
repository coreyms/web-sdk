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

	// ---- painted glass: pale cold blue-white at low strength, so the dark bed shows through like ice over it ----
	/** dock fill, top / middle / bottom of its vertical gradient, and their alphas */
	'glass-top-rgb': '206, 232, 255',
	'glass-mid-rgb': '163, 201, 238',
	'glass-bottom-rgb': '120, 170, 220',
	'glass-top-a': '0.17',
	'glass-mid-a': '0.13',
	'glass-bottom-a': '0.11',
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

/** THE PER-GAME WORDS AND GLYPH: the feature button's name and its icon (24 x 24, 2 px line, squared caps, drawn in
 *  currentColor). */
export const HUD_CONFIG = {
	/** the button's word (the menu itself is game/featureMenuData.ts FEATURE_MENU_TEXT.name, THE FAST LANE) */
	featureName: 'FAST LANE',
	/** a road in perspective: its two edges and the lane dashes (the Frost mock's glyph) */
	featureIcon: 'M9 3 4.5 21M15 3l4.5 18M12 4.5v2M12 10v3M12 16.5V20',
	/** the mode key that draws the hotter "on" state (the double rim): the top Ante level (Manticore: SUPER_ANTE) */
	topAnteKey: 'ANTE_10',
};

export const hudThemeCss = () => `:root{${Object.entries(HUD_THEME)
	.map(([k, v]) => `--hud-${k}:${v};`)
	.join('')}}`;

if (typeof document !== 'undefined' && !document.getElementById('hud-theme')) {
	const el = document.createElement('style');
	el.id = 'hud-theme';
	el.textContent = hudThemeCss();
	document.head.appendChild(el);
}
