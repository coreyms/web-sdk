// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// THE STINGER LADDERS, A PURE TEST (no browser): which wins get the full-screen win plaque and on which tier it opens,
// read from the same files the game runs: src/game/winLevelMap.ts (the ladders, the tier word per amount) and
// src/game/stinger/count.ts (the count's pacing and the tier each moment of the count shows, as StingerPlaque's
// stepCount runs it).
//   node --experimental-strip-types --no-warnings tools/stinger_tiers_test.mjs
// Corey 2026-11-21: "Let's make the base games match the bonus round numbers, off the based spin amount. Let's drop Big
// win from Bonus games individual spins. Raise Super to 200x and make that the trigger for the stinger." and "Yes it
// should be also 200x." (then softened for the base game, below). Checked:
//   - BASE GAME spin: no Stinger under 25x; Big 25x, Super 100x, Mega 400x, Epic 1,500x, Max 10,000x (Corey, the same day,
//     on the proposal "Big at 25x and Super at 100x, with Mega 400x and Epic 1,500x as you set them": "take yours")
//   - FREE SPIN (every feature): no Stinger under 200x, NO Big tier; Super 200x, Mega 400x, Epic 1,500x, Max 10,000x
//   - boundaries 24.99 / 25 / 99.99 / 100 / 399.99 / 400 / 1499.99 / 1500 / 10000 (base) and 199.99 / 200 and up (free)
//   - the plaque opens on the ladder's FIRST tier (a free spin's on SUPER, never a BIG flash first), steps up once per
//     bar the count crosses, each step at or past its bar, and lands on the win's own tier; a skip lands it in one beat
//   - the tier clip played at the impact is the opening tier's (sfx_win_super on a free spin), never sfx_win_big there
//   - the end-of-feature TOTAL WIN ladder (paced bars only; its tier is the book's) is unchanged
import { registerHooks } from 'node:module';

// winLevelMap.ts imports 'constants-shared/time' and '/bet' without an extension (Vite resolves them; node does not)
registerHooks({
	resolve(specifier, context, next) {
		if (/^constants-shared\/[a-z]+$/i.test(specifier)) return next(`${specifier}.ts`, context);
		return next(specifier, context);
	},
});

const W = await import('../src/game/winLevelMap.ts');
const C = await import('../src/game/stinger/count.ts');
const { BOOK_AMOUNT_MULTIPLIER } = await import('constants-shared/bet');

let failed = 0;
let passed = 0;
const check = (ok, what, detail) => {
	if (ok) passed += 1;
	else {
		failed += 1;
		console.log(`FAIL ${what}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
	}
};

const book = (xBet) => Math.round(xBet * BOOK_AMOUNT_MULTIPLIER);
const TIERS = ['big', 'super', 'mega', 'epic', 'max'];
const baseTier = (xBet) => {
	const d = W.getWinLevelDataByBookEventAmount({ bookEventAmount: book(xBet) });
	return d && d.type === 'big' ? W.tierIndexOfAlias(d.alias) : -1;
};
const featureTier = (xBet, mode) => {
	const d = W.getFeatureSpinWinLevelData({ bookEventAmount: book(xBet), mode });
	return d && d.type === 'big' ? W.tierIndexOfAlias(d.alias) : -1;
};

// ---- the ladders themselves ----------------------------------------------------------------------------------------
check(JSON.stringify(W.WIN_TIER_STAGES.map((s) => [s.alias, s.xBet])) === JSON.stringify([['big', 25], ['superwin', 100], ['mega', 400], ['epic', 1500], ['max', 10000]]), 'base ladder 25 / 100 / 400 / 1500 / 10000', W.WIN_TIER_STAGES);
check(JSON.stringify(W.WIN_TIER_STAGES_FEATURE_SPIN.map((s) => [s.alias, s.xBet])) === JSON.stringify([['superwin', 200], ['mega', 400], ['epic', 1500], ['max', 10000]]), 'free spin ladder 200 / 400 / 1500 / 10000, no Big', W.WIN_TIER_STAGES_FEATURE_SPIN);
check(JSON.stringify(W.WIN_TIER_STAGES_END_FEATURE.map((s) => s.xBet)) === JSON.stringify([50, 100, 400, 1500, 10000]), 'end of feature TOTAL WIN ladder unchanged', W.WIN_TIER_STAGES_END_FEATURE);
for (const mode of ['bonus', 'super', 'epic', null]) check(W.featureSpinStages(mode) === W.WIN_TIER_STAGES_FEATURE_SPIN, `every feature's free spins use the one ladder (${mode})`);

// ---- boundaries --------------------------------------------------------------------------------------------------
// expected tier index: -1 = no Stinger, 0 Big .. 4 Max
const BASE = [[0.5, -1], [4, -1], [14.99, -1], [15, -1], [20, -1], [24.99, -1], [25, 0], [30, 0], [60, 0], [99.99, 0], [100, 1], [199.99, 1], [200, 1], [399.99, 1], [400, 2], [1499.99, 2], [1500, 3], [9999.99, 3], [10000, 4]];
const FEAT = [[0.5, -1], [25, -1], [49.99, -1], [50, -1], [80, -1], [99.99, -1], [100, -1], [199.99, -1], [200, 1], [250, 1], [399.99, 1], [400, 2], [1499.99, 2], [1500, 3], [9999.99, 3], [10000, 4]];
for (const [x, want] of BASE) check(baseTier(x) === want, `base ${x}x -> ${want < 0 ? 'no Stinger' : TIERS[want]}`, baseTier(x));
for (const mode of ['bonus', 'super', 'epic']) for (const [x, want] of FEAT) check(featureTier(x, mode) === want, `free spin (${mode}) ${x}x -> ${want < 0 ? 'no Stinger' : TIERS[want]}`, featureTier(x, mode));
// a base win under Big is level 4 or 5 (no word, no screen): the same treatment a 4x to 15x win had
for (const x of [15, 20, 24.99]) {
	const d = W.getWinLevelDataByBookEventAmount({ bookEventAmount: book(x) });
	check(d && d.level === 5 && d.type === 'medium' && d.text === null, `base ${x}x is level 5, no word`, d && d.level);
}
// the creature's clip tier (game/creatureLoad.ts: level - 6) is the plaque's tier
for (const [x, want] of FEAT.filter(([, t]) => t >= 0)) check(W.getFeatureSpinWinLevelData({ bookEventAmount: book(x), mode: 'super' }).level - 6 === want, `free spin ${x}x creature clip tier ${want}`);
// and on the BASE ladder (2026-11-21, after Decimus's texture fails on c12e9094): the clip a base book reads ahead
// (winsOfBook: getWinLevelDataByBookEventAmount level - 6) is the tier the plaque's count stops on and cheers at
// (Win.svelte tierIndexOfAlias -> StingerPlaque cap), so no sheet is loaded for a tier whose clip never plays; the
// stinger_flow probe's synthetic amounts included (250x Super, 600x Mega, 2000x Epic, 10000x Max: no clip)
for (const [x, want] of [...BASE.filter(([, t]) => t >= 0), [250, 1], [600, 2], [2000, 3]]) {
	const d = W.getWinLevelDataByBookEventAmount({ bookEventAmount: book(x) });
	check(d.level - 6 === want && W.tierIndexOfAlias(d.alias) === want, `base ${x}x creature clip tier ${want} is the plaque's tier`, { level: d.level, alias: d.alias });
}

// ---- the count, as StingerPlaque's flow.win and stepCount run it -----------------------------------------------------
// returns the tiers the plaque shows in order (the opening one first), the amount at each step and the impact's clip
const playCount = (xBet, stages, { skipAtMs } = {}) => {
	const amount = book(xBet);
	const d = W.levelOnStages(xBet, stages);
	const finalTier = W.tierIndexOfAlias(d.alias);
	const durationMs = d.presentDuration;
	const entry = Math.min(4, W.tierIndexOfAlias(stages[0].alias));
	const bars = stages.slice(1).map((s) => s.xBet * BOOK_AMOUNT_MULTIPLIER);
	const cap = Math.max(entry, Math.min(4, finalTier));
	const segs = C.stagedSegments(amount, durationMs, bars);
	const total = C.stagedTotal(segs);
	const shownSeq = [{ tier: entry, at: 0 }];
	let shown = entry;
	for (let ms = 0; ms <= total + 16; ms += 16) {
		const skipped = skipAtMs !== undefined && ms >= skipAtMs;
		const ended = skipped || ms >= total;
		const a = ended ? amount : C.stagedAmountAt(segs, ms);
		const index = C.ladderTierAt(a, bars, entry, cap);
		if (index > shown) {
			shown = index;
			shownSeq.push({ tier: index, at: a });
		}
		if (ended) break;
	}
	return { seq: shownSeq, impactSound: W.WIN_TIER_SOUND[entry], finalTier, total };
};

const tiersOf = (r) => r.seq.map((s) => TIERS[s.tier]).join(' > ');
const cases = [
	['base 30x', 30, W.WIN_TIER_STAGES, 'big', 'sfx_win_big'],
	['base 150x', 150, W.WIN_TIER_STAGES, 'big > super', 'sfx_win_big'],
	['base 450x', 450, W.WIN_TIER_STAGES, 'big > super > mega', 'sfx_win_big'],
	['base 2000x', 2000, W.WIN_TIER_STAGES, 'big > super > mega > epic', 'sfx_win_big'],
	['base 10000x', 10000, W.WIN_TIER_STAGES, 'big > super > mega > epic > max', 'sfx_win_big'],
	['free spin 250x', 250, W.WIN_TIER_STAGES_FEATURE_SPIN, 'super', 'sfx_win_super'],
	['free spin 450x (Super to Mega)', 450, W.WIN_TIER_STAGES_FEATURE_SPIN, 'super > mega', 'sfx_win_super'],
	['free spin 2000x', 2000, W.WIN_TIER_STAGES_FEATURE_SPIN, 'super > mega > epic', 'sfx_win_super'],
	['free spin 10000x', 10000, W.WIN_TIER_STAGES_FEATURE_SPIN, 'super > mega > epic > max', 'sfx_win_super'],
];
for (const [name, x, stages, want, sound] of cases) {
	const r = playCount(x, stages);
	check(tiersOf(r) === want, `${name}: the plaque shows ${want}`, tiersOf(r));
	check(r.impactSound === sound, `${name}: the impact's clip is ${sound}`, r.impactSound);
	check(r.seq[r.seq.length - 1].tier === r.finalTier, `${name}: lands on its own tier`);
	// each step lands at or past its bar
	for (const s of r.seq.slice(1)) {
		const bar = W.WIN_TIER_STAGES.find((st) => W.tierIndexOfAlias(st.alias) === s.tier).xBet * BOOK_AMOUNT_MULTIPLIER;
		check(s.at >= bar - 1e-6, `${name}: ${TIERS[s.tier]} lands at or past ${bar / BOOK_AMOUNT_MULTIPLIER}x`, s.at / BOOK_AMOUNT_MULTIPLIER);
	}
	check(!(stages === W.WIN_TIER_STAGES_FEATURE_SPIN && r.seq.some((s) => s.tier === 0)), `${name}: a free spin never shows BIG`);
	// a skip at the first frame lands on the final tier in one beat
	const k = playCount(x, stages, { skipAtMs: 0 });
	check(k.seq.length === (r.seq.length > 1 ? 2 : 1) && k.seq[k.seq.length - 1].tier === r.finalTier, `${name}: a skip lands ${TIERS[r.finalTier]} in one beat`, tiersOf(k));
}
// the count lengths are the house pacing by final tier (3 / 4 / 5 / 6 / 7 s), unchanged
for (const [x, ms] of [[30, 3000], [150, 4000], [450, 5000], [2000, 6000], [10000, 7000]]) check(Math.round(playCount(x, W.WIN_TIER_STAGES).total) === ms, `base ${x}x counts ${ms} ms`, playCount(x, W.WIN_TIER_STAGES).total);
for (const [x, ms] of [[250, 4000], [450, 5000], [2000, 6000]]) check(Math.round(playCount(x, W.WIN_TIER_STAGES_FEATURE_SPIN).total) === ms, `free spin ${x}x counts ${ms} ms`, playCount(x, W.WIN_TIER_STAGES_FEATURE_SPIN).total);

console.log(`${failed ? 'FAILED' : 'OK'}: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
