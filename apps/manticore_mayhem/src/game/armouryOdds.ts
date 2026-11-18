// THE FEATURE ODDS, in one place (Corey 2026-11-17, "B Comparison"; the mock and its notes:
// ~/Desktop/Manticore Mayhem/feedback/armoury_odds_mock_2026-11-17/). THE ARMOURY's odds rows (ui/armoury/Armoury.svelte)
// and the rules' rate sentences (game/gameInfoText.ts) both read these numbers, so the two cannot disagree.
//
// SOURCE: tools/compute_odds.py (run it with math-sdk/env/bin/python -I) on the PUBLISHED math,
// math-sdk/games/manticore_mayhem/library/publish_files (books and lookup tables of 2026-11-02/03; index.json costs
// 1 / 3 / 10 / 100 / 250 / 500 / 250). A spin's feature is its book's bonusStart event (no retriggers, so at most one);
// the chance per spin is the lookup-table weight of the books that start it over the total weight. Cross-checked against
// library/forces/force_record_<mode>.json: 0 mismatches.
//
// WHY NOT THE CRITERIA (harsh review 2026-11-17 M5 computed Super Ante's Super at 65.8x the Base Game from the
// optimisation criteria): a book's criteria is the quota it was drawn for, not what it does. In the Base Game books drawn
// for the Free Spins quota whose trigger lands a fifth scatter start a Super (1 in 117,308 of spins), so the "supergame"
// criteria weighs 1 in 2,599.7 while the books that really start a Super weigh 1 in 2,544.9 (Super Ante: 39.5 either
// way). "How often the feature starts" is the event count: Super Ante's Super is 64.4x the Base Game's, which the rules
// state as "about 65" (aboutTimes below), and the menu rows show ~1 in 2,545 against ~1 in 40.
//
// `oneIn` is the exact value; the menu shows it rounded to a whole number with thousands commas ("~1 in 2,545"), the rule
// Run Over Reindeer's menu uses. A feature a mode never starts is null (Super Ante: 4 scatters award Super instead).

export type OddsFeature = 'bonus' | 'super' | 'epic';
export type OddsMode = 'BASE' | 'ANTE' | 'SUPER_ANTE';

export const ODDS_SOURCE = 'tools/compute_odds.py on math-sdk library/publish_files (books of 2026-11-03)';

/** one spin of the mode starts the feature about once in this many spins (exact); null = never */
export const FEATURE_ONE_IN: Record<OddsMode, Record<OddsFeature, number | null>> = {
	BASE: { bonus: 361.111276, super: 2544.912265, epic: 13891.860608 },
	ANTE: { bonus: 63.311, super: 388.197754, epic: 2383.035913 },
	SUPER_ANTE: { bonus: null, super: 39.529, epic: 260.606 },
};

/** the shown figure: the exact value rounded to a whole number */
export const shownOneIn = (x: number): number => Math.round(x);
/** "2,545" */
export const oneInText = (x: number): string => shownOneIn(x).toLocaleString('en-US');
/** how many times as often the mode starts the feature as the Base Game does (exact ratio) */
export const timesBase = (mode: Exclude<OddsMode, 'BASE'>, f: OddsFeature): number | null => {
	const m = FEATURE_ONE_IN[mode][f];
	const b = FEATURE_ONE_IN.BASE[f];
	return m && b ? b / m : null;
};
/** the rules' "about N times": the ratio to the nearest 5 (64.4 -> 65, 53.3 -> 55) */
export const aboutTimes = (ratio: number): number => Math.round(ratio / 5) * 5;
