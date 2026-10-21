// THE BOARD PLAQUE CELEBRATES THE BIG WIN (1.0.04, constants PLAQUE_CELEBRATE): the Stinger's beats as the board plaque
// needs them, written by components/StingerPlaque.svelte on its own ticker, read by components/BoardPlaque.svelte every
// frame. Times are performance.now() ms. Only the win screen (Big Win and up, base game and free spins) celebrates; the
// feature intro and the TOTAL WIN wrap up leave the board plaque as it is.

/** one tier beat: the tier (0 BIG .. 4 MAX), its bar (the landing; the impact for BIG) and its title's punch */
export type CelebrateBeat = { tier: number; barAt: number; punchAt: number };

export const plaqueCelebrate = {
	/** counts the win screens (a new one starts the board plaque's celebration afresh) */
	seq: 0,
	/** a win screen's celebration is running (from the show to the board plaque's restore) */
	on: false,
	showAt: -1,
	impactAt: -1,
	beats: [] as CelebrateBeat[],
	endAt: -1,
	hideAt: -1,
};

/** a win screen shows (or another screen supersedes one) */
export const celebrateShow = (win: boolean, now: number) => {
	if (!win) {
		if (plaqueCelebrate.on && plaqueCelebrate.hideAt < 0) plaqueCelebrate.hideAt = now;
		return;
	}
	plaqueCelebrate.seq += 1;
	plaqueCelebrate.on = true;
	plaqueCelebrate.showAt = now;
	plaqueCelebrate.impactAt = -1;
	plaqueCelebrate.beats = [];
	plaqueCelebrate.endAt = -1;
	plaqueCelebrate.hideAt = -1;
};
