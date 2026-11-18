// THE FEATURE PACING (2026-11-18, the owner's decision after the probe host's regression on web-sdk 8eefb8c): the holds
// the HUD's own 0.35 s fade gave the feature's four transitions until 8ac2a13 kept the HUD on screen, disabled, under the
// banners (harsh review 2026-11-17 m8). That change was only ever about the HUD being visible; the pacing it removed was
// never asked for. The holds are restored here as holds of their own, the HUD untouched. Real ms, never scaled by turbo
// or skipped: Chrome's fade (ui/Chrome.svelte FADE, a CSS transition of 0.35 s) never was. Measured against c87ec43 (the
// commit before 8ac2a13) at turbo 0, 1 and 2 for Free Spins, Super, Epic and a Mystery's feature: each transition within
// one frame (~/Desktop/Manticore Mayhem/feedback/review_fixes_2026-11-17.md section 12).
export const FEATURE_PACING = {
	/** the trigger beat runs beside it: the feature intro starts no sooner than this after bonusStart (the HUD's fade out) */
	beforeIntroMs: 350,
	/** the intro's press to the first free spin (the HUD's fade back in) */
	afterIntroMs: 350,
	/** the last free spin to the TOTAL WIN wrap up (the HUD's fade out) */
	beforeWrapMs: 350,
	/** the wrap up's press to the base game (the HUD's fade back in) */
	afterWrapMs: 350,
	/** SAFETY NETS, free when the holds have covered them (each waits only while its screen is still up):
	 *  the board plaque's last free spin text still leaving (it leaves with its streak) before the wrap up shows */
	plaqueTextMaxMs: 1200,
	/** the TOTAL WIN banner still rolling up or retreating when the round would end (no control goes live under it) */
	bannerGoneMaxMs: 4000,
	/** AUTOPLAY'S PAUSE AFTER A FEATURE (2026-11-18, a standing rule for all of Corey's games: "There should also be a
	 *  momentary pause after bonus games complete and the player clicks to clear the wrap up screen, if auto-play was
	 *  enabled, giving players a chance to stop auto-spins before they resume after the round, about a 1 second, regardless
	 *  of speed."): with Autoplay still running when the TOTAL WIN has gone, the next automatic spin waits this long, REAL
	 *  ms at every turbo level, with the HUD live (Spin, or the red Autoplay key, stops the run). On top of afterWrapMs;
	 *  never when Autoplay is off; Autoplay's own stops (Stop on Free Games, the limits) win as before */
	autoplayAfterFeatureMs: 1000,
};

/** what is on screen, written by the components every frame, read by the feature's transitions */
export const featureScreens = {
	/** the war banner's ticker runs: a screen is up, from its show to its last retreat frame (components/WarBanner.svelte) */
	bannerUp: false,
	/** the board plaque draws a total or a row (components/BoardPlaque.svelte) */
	plaqueText: false,
};

/** resolves once `cond` is false, at most `maxMs` (polled every 30 ms; at once when it already is) */
export const whileUp = async (cond: () => boolean, maxMs: number): Promise<number> => {
	const t0 = performance.now();
	while (cond() && performance.now() - t0 < maxMs) await new Promise((r) => setTimeout(r, 30));
	return performance.now() - t0;
};
