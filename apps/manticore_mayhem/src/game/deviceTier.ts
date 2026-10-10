// PHONE ASSET TIER — decided ONCE, at module load, before a single texture is requested.
//
// 2026-09-17: a tester's phone tab crashed on the production build. Measured at 390x844 the eight
// insect pose sheets decode to ~178 MB of RGBA and the symbol atlas to ~11 MB, while a phone reel
// cell only ever draws at ~95-124 PHYSICAL px (the renderer caps DPR at 1.5 on a phone) — the full 256 px
// cells are pure waste there. game/assets.ts swaps in the half-resolution twins built by
// apps/manticore_mayhem/tools/make_placeholders.py. Desktop draws cells up to ~260 px and keeps the full sheets.
//
// It must be a CONSTANT, not a reactive query: the loader reads one URL per asset and Pixi caches
// the decoded sheet, so a tier that changed mid-session (a rotation, a resized window) would leave
// half the board on one sheet and half on the other. Rotating a phone does not change
// screen.width/height, so a phone stays a phone in both orientations.

import { RENDER_RESOLUTION_CAP } from './constants';
import { STAGING_TOOLS, RESCAP_RANGE } from './staging';

const query = (name = 'tier'): string | null => {
	if (typeof window === 'undefined') return null;
	return new URLSearchParams(window.location.search).get(name);
};

const detect = (): boolean => {
	// SSR renders the shell only; window/screen do not exist and no texture is fetched there.
	if (typeof window === 'undefined') return false;
	// DEV override so the phone tier can be driven from a desktop browser and a Playwright run can
	// prove both tiers (?tier=phone / ?tier=full). Never in production: the real device decides.
	if (import.meta.env.DEV) {
		const forced = query();
		if (forced === 'phone') return true;
		if (forced === 'full') return false;
	}
	// coarse pointer AND a small screen: a touch laptop keeps the full set, and so does a tablet —
	// its cells draw big enough to show the difference. screen.* is in CSS px and is
	// orientation-stable on phones, so the short side is the phone test.
	const coarse =
		(navigator.maxTouchPoints ?? 0) > 0 ||
		(typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
	const short = Math.min(window.screen?.width ?? Infinity, window.screen?.height ?? Infinity);
	return coarse && short <= 500;
};

export const PHONE_TIER: boolean = detect();

/** the renderer's resolution cap for this device (RENDER_RESOLUTION_CAP: 1.5 on the phone tier, 2 elsewhere).
 *  DEV: ?rescap=<n> overrides it, so a probe can A / B the old 1.5 against the new cap on the same build. */
export const renderResolutionCap = (): number => {
	// DEV, or a PUBLIC_STAGING=1 build (game/staging.ts: dropped from a production bundle), held to 1 .. 3
	if (STAGING_TOOLS) {
		const forced = Number(query('rescap'));
		if (forced >= RESCAP_RANGE.min) return Math.min(RESCAP_RANGE.max, forced);
	}
	return PHONE_TIER ? RENDER_RESOLUTION_CAP.phone : RENDER_RESOLUTION_CAP.desktop;
};

// DEV probe (house rules: extend __manticore, never a new global) — the Playwright tier checks
// read this instead of guessing from the network log.
if (import.meta.env.DEV && typeof window !== 'undefined') {
	((window as any).__manticore ??= {}).assetTier = PHONE_TIER ? 'phone' : 'full';
}
