// PHONE ASSET TIER — decided ONCE, at module load, before a single texture is requested.
//
// 2026-09-17: a tester's phone tab crashed on the production build. Measured at 390x844 the eight
// insect pose sheets decode to ~178 MB of RGBA and the symbol atlas to ~11 MB, while a phone reel
// cell only ever draws at ~95-124 PHYSICAL px (the renderer caps DPR at 1.5 on a phone; 2 on an allowlisted
// iPhone since 2026-10-13, PHONE_2X below, where the half cells are drawn up to ~165 px; 3 on a large one since 2026-10-14) — the full 256 px
// cells are pure waste there. game/assets.ts swaps in the half-resolution twins built by
// apps/manticore_mayhem/tools/make_placeholders.py. Desktop draws cells up to ~260 px and keeps the full sheets.
//
// It must be a CONSTANT, not a reactive query: the loader reads one URL per asset and Pixi caches
// the decoded sheet, so a tier that changed mid-session (a rotation, a resized window) would leave
// half the board on one sheet and half on the other. Rotating a phone does not change
// screen.width/height, so a phone stays a phone in both orientations.

import { RENDER_MAX_PIXELS } from './constants';
import { deviceResolutionCap, phoneAllowed2x, phoneAllowed3x, type DeviceSignals } from './deviceCap';
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

/** THE PHONE ALLOWLISTS (constants PHONE_2X_ALLOW, PHONE_3X_ALLOW): pure functions in game/deviceCap.ts, so a node
 *  check and the probe can put any device through them (tools/manticore/rescap_check.mjs, res_probe.js). */
export { phoneAllowed2x, phoneAllowed3x, deviceResolutionCap, type DeviceSignals };
const signalsNone: DeviceSignals = { userAgent: '', touchPoints: 0, density: 1, screenWidth: 0, screenHeight: 0 };
const signals = (): DeviceSignals => ({
	userAgent: navigator.userAgent ?? '',
	touchPoints: navigator.maxTouchPoints ?? 0,
	density: window.devicePixelRatio || 1,
	screenWidth: window.screen?.width ?? 0,
	screenHeight: window.screen?.height ?? 0,
});
/** decided ONCE at module load, like the tier: a phone of the phone tier that is on the allowlist */
export const PHONE_2X: boolean = typeof window !== 'undefined' && PHONE_TIER && phoneAllowed2x(signals());
/** ...and a large one (short side 420 and up): cap 3 */
export const PHONE_3X: boolean = typeof window !== 'undefined' && PHONE_TIER && phoneAllowed3x(signals());
/** this device's cap, decided once (no `?rescap=`) */
const DEVICE_CAP: number = typeof window === 'undefined' ? deviceResolutionCap(false, signalsNone) : deviceResolutionCap(PHONE_TIER, signals());

/** `?rescap=<n>`: DEV, or a PUBLIC_STAGING=1 build (game/staging.ts: dropped from a production bundle), held to 1 .. 3 */
const forcedCap = (): number | null => {
	if (!STAGING_TOOLS) return null;
	const forced = Number(query('rescap'));
	return forced >= RESCAP_RANGE.min ? Math.min(RESCAP_RANGE.max, forced) : null;
};

/** the renderer's resolution cap for this device (RENDER_RESOLUTION_CAP: 1.5 on the phone tier, 2 on an allowlisted
 *  iPhone and everywhere else, 3 on a large allowlisted iPhone; game/deviceCap.ts). `?rescap=<n>` overrides it, so a
 *  probe or a tester can A / B caps on the same build. */
export const renderResolutionCap = (): number => forcedCap() ?? DEVICE_CAP;

/** THE RENDERER'S RESOLUTION for a window of this CSS size: the device's density under the cap, and off the phone
 *  tier also under the pixel ceiling (constants RENDER_MAX_PIXELS), never under 1. A forced `?rescap=` is taken as
 *  it is (no ceiling). components/Game.svelte applies it; the label atlas pick in game/assets.ts reads the same. */
export const renderResolutionFor = (cssWidth: number, cssHeight: number, density: number = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, phoneTier: boolean = PHONE_TIER, cap: number = renderResolutionCap(), ceiling: boolean = forcedCap() === null): number => {
	let r = Math.min(density, cap);
	if (!phoneTier && ceiling && cssWidth > 0 && cssHeight > 0) r = Math.min(r, Math.sqrt(RENDER_MAX_PIXELS / (cssWidth * cssHeight)));
	// never under 1 (a density under 1, a zoomed out desktop browser, is left as it is)
	return Math.max(Math.min(1, density), r);
};

// DEV probe (house rules: extend __manticore, never a new global) — the Playwright tier checks
// read this instead of guessing from the network log.
if (import.meta.env.DEV && typeof window !== 'undefined') {
	const hook = ((window as any).__manticore ??= {});
	hook.assetTier = PHONE_TIER ? 'phone' : 'full';
	/** tools/manticore/res_probe.js: the allowlist as a pure function, this device's answer, and the resolution rule */
	hook.renderRes = {
		phone2x: PHONE_2X,
		phone3x: PHONE_3X,
		cap: renderResolutionCap(),
		maxPixels: RENDER_MAX_PIXELS,
		signals,
		allowed: (d: DeviceSignals) => phoneAllowed2x(d),
		/** the cap rule for any device and tier (no `?rescap=`) */
		capFor: (d: DeviceSignals, phoneTier: boolean) => deviceResolutionCap(phoneTier, d),
		/** the rule for any window and tier (no `?rescap=`) */
		want: (w: number, h: number, density: number, phoneTier: boolean, cap: number) => renderResolutionFor(w, h, density, phoneTier, cap, true),
	};
}
