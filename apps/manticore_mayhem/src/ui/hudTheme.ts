// THE HUD THEME (HUD round 5, "Drop 6", Corey 2026-11-12: "1 drop 6 works"). ONE place for every colour, glass tint,
// edge gradient, glow, radius and alpha the HUD draws with, named by ROLE, plus the per-game words and glyph
// (HUD_CONFIG). Every HUD component and ui/hud/HudStyles.svelte read these through CSS custom properties only; no
// component hard-codes a theme colour. A new game (Run Over Reindeer) copies the HUD and changes THIS file (see
// ui/HUD_THEME.md). Colours that are used at many strengths are given as "r, g, b" triplets (the -rgb tokens) so a
// rule can say rgba(var(--hud-accent-rgb), 0.55); single-use colours are plain values.
// Injected once as a :root block (like ui/fontFaces.ts), so the HUD layer, the SKIP layer and the modals all see it.
export const HUD_THEME: Record<string, string> = {
	// ---- type ----
	/** the HUD face: Outfit's one static Black (900) face, ui/fontFaces.ts */
	font: "'Outfit', system-ui, sans-serif",
	/** the Autoplay menu's title face */
	'font-title': "'Cinzel', 'Outfit', serif",

	// ---- ink ----
	/** numbers, icons and button words */
	'ink-rgb': '255, 255, 255',
	/** the small spaced words over the numbers (BALANCE, SPIN) and under the keys */
	'label-rgb': '236, 230, 216',
	/** the warmer label (WIN, the portrait words) */
	'label-warm-rgb': '246, 225, 182',
	/** text shadows and drop shadows */
	'shadow-rgb': '0, 0, 0',

	// ---- the accent (the edge gradients' lower colour, gold) ----
	'accent-rgb': '232, 182, 74',
	'accent-hi-rgb': '246, 213, 138',
	/** the pale accent ink: a lit WIN, the Ante amount */
	'accent-ink-rgb': '255, 230, 168',
	/** the palest accent ink (a lit WIN's number, the Super Ante word) */
	'accent-cream-rgb': '255, 243, 210',
	/** the dark end of the accent (slider fill start, the Spin's lower rim) */
	'accent-deep-rgb': '184, 138, 56',

	// ---- painted glass ----
	/** dock fill, top / middle / bottom of its vertical gradient, and their alphas */
	'glass-top-rgb': '20, 27, 42',
	'glass-mid-rgb': '8, 11, 18',
	'glass-bottom-rgb': '4, 6, 11',
	/** (bet bar fix 2026-11-19, Corey: "Slightly darken the glass overall so the SPIN/WIN/BALANCE stand out better"):
	 *  0.64 / 0.58 / 0.66 before */
	'glass-top-a': '0.74',
	'glass-mid-a': '0.7',
	'glass-bottom-a': '0.76',
	/** the menu panels' fill alphas (the same three colours, near opaque) */
	'panel-top-a': '0.92',
	'panel-mid-a': '0.9',
	'panel-bottom-a': '0.93',
	/** a key's own glass (the round keys, the steppers, chips) */
	'key-rgb': '10, 13, 22',
	/** (bet bar fix 2026-11-19, the same tokens as Run Over Reindeer's hudTheme.ts) that glass's strength */
	'key-a': '0.38',
	/** a key's rim: one even 1 px line all round (the old rim was white on top and gold below, and stopped dead at each
	 *  corner), and its strength at rest; a hover lifts it by 0.26 */
	'key-rim-rgb': '255, 255, 255',
	'key-rim-a': '0.2',
	/** a key's bottom light (its gold, as the old bottom edge was) */
	'edge-key-rgb': '232, 182, 74',
	/** the feature button's bottom light (its gold, as the old bottom edge was) */
	'feature-edge-bottom-rgb': '232, 182, 74',
	/** (bet bar fix, Corey: "the menu button itself should have a much darker glass so it stands out") the Menu key's near
	 *  opaque black glass, top and bottom of its gradient, its strength, and its rim (gold) */
	'menu-key-1-rgb': '22, 22, 26',
	'menu-key-2-rgb': '3, 3, 5',
	'menu-key-a': '0.96',
	'menu-key-rim-rgb': '232, 182, 74',
	/** (bet bar fix, Corey: "make the Auto and Turbo Buttons change colors when active") a lit key's own fill.
	 *  ON (a run loaded on the Spin, Turbo, the open Menu): a deep bronze glass with a gold rim and gold ink.
	 *  HOT (a run playing, Turbo at its instant level): the Spin rim's bright gold with near black ink */
	'key-on-1-rgb': '104, 74, 22',
	'key-on-2-rgb': '52, 35, 8',
	'key-on-a': '0.95',
	'key-on-ink-rgb': '255, 230, 168',
	'key-hot-1-rgb': '250, 214, 130',
	'key-hot-2-rgb': '206, 154, 52',
	'key-hot-ink-rgb': '30, 20, 4',
	/** the edge gradient: top edge colour and its peak alpha, bottom edge colour and its peak alpha */
	'edge-top-rgb': '255, 255, 255',
	'edge-top-a': '0.62',
	'edge-bottom-rgb': '232, 182, 74',
	'edge-bottom-a': '0.85',
	/** the specular line just under a top edge */
	'spec-a': '0.32',

	// ---- the hero: Spin ----
	/** the Spin's dark core (centre, rim) */
	'spin-core-rgb': '52, 54, 66',
	'spin-deep-rgb': '12, 14, 22',
	/** the Spin's rim: top, side, bottom */
	'spin-rim-top': '#f8dc96',
	'spin-rim-side': '#b88a38',
	'spin-rim-bottom': '#e4b352',

	// ---- the second hero: the feature button (ARMOURY) ----
	'feature-rgb': '214, 69, 47',
	'feature-hi-rgb': '250, 104, 70',
	'feature-deep-1-rgb': '70, 22, 16',
	'feature-deep-2-rgb': '26, 8, 8',
	'feature-rim-rgb': '255, 186, 160',
	'feature-ink': '#ffd6c0',
	/** the feature button with a mode ON (Ante, Super Ante, an armed buy): gold */
	'feature-on-deep-1-rgb': '60, 42, 16',
	'feature-on-deep-2-rgb': '24, 15, 6',
	'feature-on-rim': '#ffe6ae',

	// ---- states ----
	/** a disabled key's opacity */
	'disabled-a': '0.32',
	/** a locked readout's opacity (the amount while a spin runs) */
	'locked-a': '0.5',
	/** the dimmed scene behind the Autoplay menu */
	'dim': 'rgba(0, 0, 0, 0.45)',

	// ---- shape ----
	'radius-panel': '18px',
	'radius-chip': '14px',
};

/** THE FEATURE BUTTON'S GLYPH CANDIDATES (bet bar fix 2026-11-19; Stake forbids stock icons and clipart, and crossed
 *  swords are a stock mark): drawn here in SVG from the game's own world, 24 x 24, painted in their own colors (not
 *  currentColor). No generated art.
 *    stinger  the manticore's tail: three gold segments curling up to the bulb and its barb, a near black ink outline */
export const FEATURE_GLYPHS = {
	stinger:
		'<g stroke="#1a1206" stroke-width="1.3" stroke-linejoin="round"><circle cx="6.6" cy="19.4" r="2.4" fill="#c8932f"/><circle cx="5.7" cy="14.5" r="2.3" fill="#d6a23c"/><circle cx="7.5" cy="10.1" r="2.2" fill="#e2b04a"/><circle cx="11.3" cy="7.3" r="2.1" fill="#ecbd58"/><path d="M18.4 9.1c2 1.6 2.5 4.2 1.4 6.6-.3-2-1.3-3.6-2.9-4.8Z" fill="#f6d58a"/><ellipse cx="16" cy="7.3" rx="3.5" ry="2.8" transform="rotate(-12 16 7.3)" fill="#f2c867"/></g><ellipse cx="15" cy="6.3" rx="1.3" ry=".7" transform="rotate(-12 15 6.3)" fill="#fff3d2" opacity=".75"/>',
} as const;
export type FeatureGlyph = 'none' | keyof typeof FEATURE_GLYPHS;

/** THE PER-GAME WORDS AND GLYPH: the feature button's name and its glyph. Run Over Reindeer changes these lines. */
export const HUD_CONFIG = {
	/** the button's word (the menu itself is constants FEATURE_MENU_NAME, THE ARMOURY) */
	featureName: 'ARMOURY',
	/** THE PICK (bet bar fix 2026-11-19): 'none' is the word alone, centered (on the sideways phone's small circle the
	 *  word takes the glyph's place); 'stinger' draws FEATURE_GLYPHS.stinger beside the word. One line to change. */
	featureGlyph: 'none' as FeatureGlyph,
	/** RETIRED 2026-11-19 (crossed blades, a stock mark; no longer drawn) */
	featureIcon: 'M5 5l9.6 9.6M19 5l-9.6 9.6M12.4 17.6l5.2-5.2M6.4 12.4l5.2 5.2M16.6 16.6l2.6 2.6M7.4 16.6l-2.6 2.6',
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
