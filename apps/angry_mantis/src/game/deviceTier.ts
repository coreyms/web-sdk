// PHONE ASSET TIER — decided ONCE, at module load, before a single texture is requested.
//
// 2026-09-17: a tester's phone tab crashed on the production build. Measured at 390x844 the eight
// insect pose sheets decode to ~178 MB of RGBA and the symbol atlas to ~11 MB, while a phone reel
// cell only ever draws at ~95-124 PHYSICAL px (the renderer caps DPR at 1.5) — the full 256 px
// cells are pure waste there. game/assets.ts swaps in the half-resolution twins built by
// tools/build_phone_sheets.py. Desktop draws cells up to ~260 px and keeps the full sheets.
//
// It must be a CONSTANT, not a reactive query: the loader reads one URL per asset and Pixi caches
// the decoded sheet, so a tier that changed mid-session (a rotation, a resized window) would leave
// half the board on one sheet and half on the other. Rotating a phone does not change
// screen.width/height, so a phone stays a phone in both orientations.

const query = (): string | null => {
	if (typeof window === 'undefined') return null;
	return new URLSearchParams(window.location.search).get('tier');
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

// DEV probe (house rules: extend __angryMantis, never a new global) — the Playwright tier checks
// read this instead of guessing from the network log.
if (import.meta.env.DEV && typeof window !== 'undefined') {
	((window as any).__angryMantis ??= {}).assetTier = PHONE_TIER ? 'phone' : 'full';
}
