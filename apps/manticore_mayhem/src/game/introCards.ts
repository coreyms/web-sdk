// The opening primer (ui/LandingScreen.svelte): three poster cards — CLUSTERS, MULTIPLIER TILES,
// THE MANTICORE — over the backdrop while the assets land. Milestone 1 ships PLACEHOLDER cards
// from tools/make_placeholders.py; the composition is Angry Mantis's "Intro Card Layouts" readout
// (Corey 2026-09-10) in MASTER px of each LayoutKind, and the phone master is the desktop
// composition re-centred on its wider frame.
import { LOGO } from './constants';
import type { LayoutKind } from './layoutSpec';

export const INTRO_CARDS = ['card-1', 'card-2', 'card-3'] as const; // static/assets/ui/intro/<name>.webp, 800x1200
export const INTRO_CARD_ASPECT = 2 / 3;

export type IntroLayout =
	| { style: 'row'; cardH: number; gap: number; cy: number; tiltDeg: number }
	| { style: 'fan'; cardH: number; cy: number; tiltDeg: number; backOpacity: number; cycleMs: number };

export const INTRO_LAYOUT: Record<LayoutKind, IntroLayout> = {
	// three across under the windows band, the outer two tilted outward
	landscape: { style: 'row', cardH: 450, gap: 48, cy: 410, tiltDeg: 3.5 },
	phone: { style: 'row', cardH: 450, gap: 48, cy: 410, tiltDeg: 3.5 },
	// a dealt hand: the front card upright, the two behind tilted and dimmed. There is no tap to
	// cycle (a tap is PRESS ANYWHERE), so the front card rotates on its own every cycleMs.
	portrait: { style: 'fan', cardH: 390, cy: 435, tiltDeg: 3.5, backOpacity: 0.55, cycleMs: 2800 },
};

/** logo width + centre (master px): the stacked logo, centred above the cards in every layout (constants
 *  LOGO.landing; the cards' tops are at 176 in the row layouts and 222 in the portrait fan) */
export const INTRO_LOGO: Record<LayoutKind, { w: number; cx: number; cy: number }> = {
	landscape: { w: LOGO.landing.landscape.width, cx: LOGO.landing.landscape.cx, cy: LOGO.landing.landscape.cy },
	phone: { w: LOGO.landing.phone.width, cx: LOGO.landing.phone.cx, cy: LOGO.landing.phone.cy },
	portrait: { w: LOGO.landing.portrait.width, cx: LOGO.landing.portrait.cx, cy: LOGO.landing.portrait.cy },
};
export const INTRO_LOGO_SHINE_MS = 4500; // the sweep's idle period (Corey: shine, 4.5 s)
