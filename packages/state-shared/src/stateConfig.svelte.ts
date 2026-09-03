export const stateConfig = $state({
	jurisdiction: {
		socialCasino: false,
		disabledFullscreen: false,
		disabledTurbo: false,
		disabledSuperTurbo: false,
		disabledAutoplay: false,
		disabledSlamstop: false,
		disabledSpacebar: false,
		disabledBuyFeature: false,
		displayNetPosition: false,
		displayRTP: false,
		displaySessionTimer: false,
		minimumRoundDuration: 0,
	},
	betAmountOptions: [1, 5, 25, 50, 75, 100, 200, 500, 800, 1000],
	betMenuOptions: [1, 5, 25, 50, 75, 100, 200, 500, 800, 1000],
	/**
	 * Per-mode betting parameters exactly as the authenticate response declared them, keyed by the
	 * upper-case RGS mode name. Empty until Authenticate.svelte fills it, and a mode the response
	 * did not describe simply has no entry — games fall back to their local math config for it.
	 */
	betModes: {} as Record<string, { costMultiplier?: number; maxWin?: number }>,
});
