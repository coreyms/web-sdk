// THE HOUSE WIN COUNT-UP PACING (Corey 2026-10-08, the Angry Mantis rule, decided once for every game), as
// pure functions so the plaque's ticker, components/StagedCountUpProvider.svelte and the node self check
// (tools/manticore/stinger_motion_check.mjs) all run the SAME pacer:
//   · every tier bar the amount crosses gets a segment of min(15 % of the total, 0.9 s) ending ON the bar
//   · the final tier gets the remainder, at least 40 % of the total
//   · every segment is linear and there is no pause at a bar
// Amounts are book amounts; `bars` are the upgrade bars (the ladder without its entry bar) as book amounts,
// ascending. Nothing here decides an outcome: the target is the book's amount, the bars are presentation.

export type CountSegment = { to: number; duration: number };

export const COUNT_PACING = { barShare: 0.15, barMaxMs: 900, finalMinShare: 0.4 } as const;

export const stagedSegments = (amount: number, duration: number, bars: readonly number[]): CountSegment[] => {
	const crossed = bars.filter((bar) => bar < amount);
	const pre = Math.min(duration * COUNT_PACING.barShare, COUNT_PACING.barMaxMs);
	return [...crossed.map((to) => ({ to, duration: pre })), { to: amount, duration: Math.max(duration - crossed.length * pre, duration * COUNT_PACING.finalMinShare) }];
};

/** the whole count's length, ms */
export const stagedTotal = (segments: readonly CountSegment[]): number => segments.reduce((sum, s) => sum + s.duration, 0);

/** the amount `ms` into the count (0 before it, the last segment's target from its end on) */
export const stagedAmountAt = (segments: readonly CountSegment[], ms: number): number => {
	if (ms <= 0) return 0;
	let from = 0;
	let t = ms;
	for (const seg of segments) {
		if (t < seg.duration) return from + ((seg.to - from) * t) / seg.duration;
		t -= seg.duration;
		from = seg.to;
	}
	return from;
};

/** how many of `bars` an amount has reached (the tier index above the entry tier), capped */
export const tierIndexAt = (amount: number, bars: readonly number[], cap: number): number => {
	let i = 0;
	while (i < cap && i < bars.length && amount >= bars[i]) i += 1;
	return i;
};
