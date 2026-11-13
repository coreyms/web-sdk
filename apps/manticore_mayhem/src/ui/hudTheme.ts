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
	'glass-top-a': '0.64',
	'glass-mid-a': '0.58',
	'glass-bottom-a': '0.66',
	/** the menu panels' fill alphas (the same three colours, near opaque) */
	'panel-top-a': '0.92',
	'panel-mid-a': '0.9',
	'panel-bottom-a': '0.93',
	/** a key's own glass (the round keys, the steppers, chips) */
	'key-rgb': '10, 13, 22',
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

/** THE PER-GAME WORDS AND GLYPH: the feature button's name and its icon (24 x 24, 2 px line, squared caps, drawn in
 *  currentColor). Run Over Reindeer changes these two lines. */
export const HUD_CONFIG = {
	/** the button's word (the menu itself is constants FEATURE_MENU_NAME, THE ARMOURY) */
	featureName: 'ARMOURY',
	/** crossed blades */
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
