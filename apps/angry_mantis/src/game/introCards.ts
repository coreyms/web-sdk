// The opening primer (ui/LandingScreen.svelte): Corey's three poster cards — WANTED (scatters),
// ON THE MENU (bell + wild), THE FEAST (max win) — on the live cafeteria scene while the assets
// land, with the logo placed clear of the windows band and the exhaust fan (the ambient layers
// must stay in view: birds, clouds, fan, roaches). Values are the "Intro Card Layouts" artifact's
// readout (Corey 2026-09-10), in MASTER px of each LayoutKind; the phone master is the desktop
// composition re-centred on its wider frame.
import type { LayoutKind } from './layoutSpec';

export const INTRO_CARDS = ['card-1', 'card-2', 'card-3'] as const; // static/assets/ui/intro/<name>.webp, 800×1200
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

/** logo width + centre (master px); desktop x is measured from the 1280 master's left edge and
 *  re-centred for the phone master */
export const INTRO_LOGO: Record<LayoutKind, { w: number; cx: number; cy: number }> = {
	landscape: { w: 470, cx: 264, cy: 106 },
	phone: { w: 470, cx: 264 + (1480 - 1280) / 2, cy: 106 },
	portrait: { w: 330, cx: 206, cy: 656 },
};
export const INTRO_LOGO_SHINE_MS = 4500; // the sweep's idle period (Corey: shine, 4.5 s)
