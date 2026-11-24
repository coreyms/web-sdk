// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// THE EPIC ON DEMAND, A PURE TEST (no browser; constants EPIC_LOAD, src/game/epicPlan.ts, src/game/epicLoad.ts):
//   node --experimental-strip-types --no-warnings tools/epic_load_test.mjs
// Checked:
//   - THE SIGNAL over REAL books of the published math (_math_upload/manticore_mayhem-math-*/publish_files, read with
//     zstd when both are there; a few dozen books per mode, the first that hold an Epic and the first that do not): a
//     book that opens the Epic reads 'book' at its bonusStart; the same book resumed after its bonusStart (the game's
//     snapshot conversion) reads 'resume'; resumed before it, or replayed (event 0), 'book'; a book without one, null
//   - the Epic plaque (a win plaque that stops on EPIC): the base ladder by setTotalWin, a free spin by its own win on its
//     feature's ladder, nothing after a wincap; checked against an independent count of the same books
//   - reading the book changes nothing in it
//   - the load order: intro, creature, flames, attacks; no intro on a resume; the flames alone for a plaque; no flames
//     where the courtyard has none
//   - THE HOLD's state machine: files in at once (go, no hold), late files (hold, then go), a failed file (two retries,
//     then fallback), a file that never comes (capped at holdCapMs)
//   - THE BACKGROUND LINE (Corey "ej1"): the start event, one file at a time and never beside play, bounded retries, THE
//     DECODE RULE, the hold's forecast (no hold when the files cannot be up inside the cap: the proof's Fast 3G numbers),
//     and what of the wiring a node test can read in the sources
import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

registerHooks({
	resolve(specifier, context, next) {
		if (/^constants-shared\/[a-z]+$/i.test(specifier)) return next(`${specifier}.ts`, context);
		// the app's own extensionless imports (Vite resolves them; node does not)
		if (/^\.\.?\//.test(specifier) && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes('/src/')) return next(`${specifier}.ts`, context);
		return next(specifier, context);
	},
});

const P = await import('../src/game/epicPlan.ts');
const { BOOK_AMOUNT_MULTIPLIER } = await import('constants-shared/bet');
const here = dirname(fileURLToPath(import.meta.url));

let failed = 0;
let passed = 0;
const check = (ok, what, detail) => {
	if (ok) passed += 1;
	else {
		failed += 1;
		console.log(`FAIL ${what}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
	}
};

// COPY OF src/game/constants.ts:EPIC_LOAD (order, retries, retryMs, holdCapMs): read from the file so a change is seen
const constantsSrc = readFileSync(join(here, '../src/game/constants.ts'), 'utf8');
const block = constantsSrc.slice(constantsSrc.indexOf('export const EPIC_LOAD = {'));
const num = (key) => Number(new RegExp(`\\n\\t${key}: (\\d+)`).exec(block)[1]);
const ORDER = JSON.parse(/\n\torder: (\[[^\]]*\])/.exec(block)[1].replace(/'/g, '"'));
const RETRIES = num('retries');
const RETRY_MS = JSON.parse(/\n\tretryMs: (\[[^\]]*\])/.exec(block)[1]);
const CAP = num('holdCapMs');
check(ORDER.join() === 'intro,creature,flames,attacks', 'EPIC_LOAD.order is intro, creature, flames, attacks', ORDER);
check(/prefetchLooks: \['super'\]/.test(constantsSrc), "CREATURE.lookLoad.prefetchLooks is ['super']: the Epic look is never prefetched");

// COPY OF src/game/utils.ts:convertTorResumableBet (the snapshot keeps bonusStart and setTotalWin before the index)
const resumeAt = (events, index) => {
	const before = events.filter((_e, i) => i < index);
	const after = events.filter((_e, i) => i >= index);
	return [{ index: 0, type: 'createBonusSnapshot', bookEvents: before.filter((e) => ['bonusStart', 'setTotalWin'].includes(e.type)) }, ...after];
};

// ---- real books -------------------------------------------------------------------------------------------------------
const upload = join(here, '../../../../_math_upload');
const mathDir = existsSync(upload) ? readdirSync(upload).filter((d) => d.startsWith('manticore_mayhem-math-')).sort().pop() : null;
const books = [];
if (mathDir) {
	const dir = join(upload, mathDir, 'publish_files');
	const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
	for (const mode of index.modes) {
		for (const [want, pattern] of [
			[true, '"bonus": *"epic"'],
			[false, '.'],
		]) {
			let out = '';
			try {
				// (the first books of the file that match: zstd stops as soon as grep has its lines)
				out = execFileSync('sh', ['-c', `zstd -dc "${join(dir, mode.events)}" 2>/dev/null | grep -m ${want ? 12 : 40} '${pattern}'`], { maxBuffer: 64 * 1024 * 1024 }).toString();
			} catch (e) {
				out = e.stdout?.toString() ?? '';
			}
			for (const line of out.split('\n').filter(Boolean)) {
				const book = JSON.parse(line);
				if (!want && book.events.some((e) => e.type === 'bonusStart' && e.bonus === 'epic')) continue;
				books.push({ mode: mode.name, book });
			}
		}
	}
	console.log(`real books: ${books.length} from ${mathDir} (${[...new Set(books.map((b) => b.mode))].join(', ')})`);
} else console.log('real books: none (no _math_upload folder or no zstd): the signal is checked on the built books below only');

// an independent count of the plaques that stop on EPIC (the ladders' bars from winLevelMap's tables, not its helpers)
const W = await import('../src/game/winLevelMap.ts');
const baseBars = W.WIN_TIER_STAGES.map((s) => s.xBet);
const epicIndex = 3;
const tierOn = (xBet, bars) => {
	let t = -1;
	bars.forEach((b, i) => {
		if (xBet >= b) t = i;
	});
	return t;
};
const independentEpicPlaque = (events) => {
	let mode = null;
	let spinWin = 0;
	let capped = false;
	for (const e of events) {
		if (e.type === 'bonusStart') mode = e.bonus;
		else if (e.type === 'createBonusSnapshot') mode = e.bookEvents.filter((x) => x.type === 'bonusStart').pop()?.bonus ?? mode;
		else if (e.type === 'cascade') spinWin = e.spinWin;
		else if (e.type === 'reveal') spinWin = 0;
		else if (e.type === 'wincap') capped = true;
		else if (e.type === 'freeSpinEnd') mode = null;
		else if (e.type === 'setTotalWin') {
			const amount = mode ? spinWin : e.amount;
			spinWin = 0;
			if (capped || amount <= 0) continue;
			const x = amount / BOOK_AMOUNT_MULTIPLIER;
			// a base game spin: Big Super Mega Epic Max; a free spin: no Big (Super Mega Epic Max)
			const t = mode ? (() => { const bars = W.featureSpinStages(mode).map((s) => s.xBet); const i = tierOn(x, bars); return i < 0 ? -1 : i + (5 - bars.length); })() : tierOn(x, baseBars);
			if (t === epicIndex) return true;
		}
	}
	return false;
};

let epicBooks = 0;
let resumes = 0;
let plaques = 0;
for (const { mode, book } of books) {
	const ev = book.events;
	const frozen = JSON.stringify(ev);
	const s = P.epicSignalOfBook(ev);
	const at = ev.findIndex((e) => e.type === 'bonusStart' && e.bonus === 'epic');
	const tag = `${mode} book ${book.id}`;
	check(JSON.stringify(ev) === frozen, `${tag}: reading the book changes nothing in it`);
	if (at >= 0) {
		epicBooks += 1;
		check(s.feature === 'book' && s.at === at, `${tag}: opens the Epic: 'book' at its bonusStart (${at})`, s);
		check(ev.filter((e) => e.type === 'bonusStart').length === 1, `${tag}: one bonusStart in the book`);
		// a replay is the whole book from event 0
		check(P.epicSignalOfBook(resumeAt(ev, 0)).feature === 'book', `${tag}: replayed from event 0: 'book'`);
		// resumed before the trigger: the bonusStart is still ahead
		check(P.epicSignalOfBook(resumeAt(ev, at)).feature === 'book', `${tag}: resumed at its bonusStart: 'book'`);
		// resumed inside the feature: every free spin's reveal after the trigger
		for (const i of ev.map((e, k) => (k > at && e.type === 'reveal' ? k : -1)).filter((k) => k > 0).slice(0, 3)) {
			const r = P.epicSignalOfBook(resumeAt(ev, i));
			resumes += 1;
			check(r.feature === 'resume' && r.at === 0, `${tag}: resumed at event ${i} (inside the Epic): 'resume'`, r);
		}
	} else check(s.feature === null && s.at === -1, `${tag}: no Epic feature: null`, s);
	const ind = independentEpicPlaque(ev);
	if (ind) plaques += 1;
	check(s.plaque === ind, `${tag}: an Epic plaque ${ind ? 'is' : 'is not'} in the book`, { s, ind });
}
if (books.length) {
	check(epicBooks >= 20, `at least 20 real books open the Epic (${epicBooks}), every mode`, epicBooks);
	console.log(`  ${epicBooks} Epic books, ${resumes} resumed inside one, ${plaques} with a plaque that stops on EPIC`);
}

// ---- built books (the edges) ------------------------------------------------------------------------------------------
const M = BOOK_AMOUNT_MULTIPLIER;
const base = (amount) => [{ type: 'reveal' }, { type: 'cascade', spinWin: amount }, { type: 'setTotalWin', amount }, { type: 'finalWin', amount }];
check(P.epicSignalOfBook(base(1500 * M)).plaque, 'a base game win of 1,500x is an Epic plaque');
check(!P.epicSignalOfBook(base(1499.99 * M)).plaque, 'a base game win under 1,500x is not');
check(!P.epicSignalOfBook(base(10000 * M)).plaque, 'a Max win is not an Epic plaque (it has its own screen)');
check(!P.epicSignalOfBook([{ type: 'reveal' }, { type: 'wincap', amount: 1500 * M }, { type: 'setTotalWin', amount: 1500 * M }]).plaque, 'nothing after a wincap');
const fs = (bonus, spin) => [{ type: 'reveal' }, { type: 'bonusStart', bonus }, { type: 'reveal' }, { type: 'cascade', spinWin: spin }, { type: 'setTotalWin', amount: spin + 5 * M }, { type: 'bonusEnd' }, { type: 'freeSpinEnd', amount: spin, winLevel: 9 }, { type: 'finalWin' }];
check(P.epicSignalOfBook(fs('bonus', 1500 * M)).plaque && P.epicSignalOfBook(fs('bonus', 1500 * M)).feature === null, "a free spin's own 1,500x in a Bonus: an Epic plaque, no Epic feature");
check(!P.epicSignalOfBook(fs('bonus', 1400 * M)).plaque, 'a free spin under 1,500x is not');
check(P.epicSignalOfBook(fs('super', 2 * M)).feature === null, 'a Super is not the Epic');
check(P.epicSignalOfBook(fs('epic', 2 * M)).feature === 'book', 'an Epic is');
check(P.epicSignalOfBook([{ type: 'createBonusSnapshot', bookEvents: [{ type: 'bonusStart', bonus: 'super' }] }, { type: 'reveal' }]).feature === null, 'a resumed Super is not the Epic');

// ---- the plan ---------------------------------------------------------------------------------------------------------
const sig = (feature, plaque = false) => ({ feature, at: 0, plaque, plaqueAt: -1 });
check(P.epicGroupsFor(sig('book'), ORDER, true).join() === 'intro,creature,flames,attacks', 'an Epic round: intro, creature, flames, attacks, in that order');
check(P.epicGroupsFor(sig('resume'), ORDER, true).join() === 'creature,flames,attacks', 'a resumed Epic: no intro (none is played)');
check(P.epicGroupsFor(sig(null, true), ORDER, true).join() === 'flames', 'an Epic plaque alone: the flames');
check(P.epicGroupsFor(sig('book'), ORDER, false).join() === 'intro,creature,attacks', 'an upright courtyard (no braziers): no flames');
check(P.epicGroupsFor(sig(null), ORDER, true).length === 0, 'no Epic: nothing loads');

// ---- THE HOLD's state machine -----------------------------------------------------------------------------------------
// one group through a round, its files arriving at `inAt` (ms) or failing `fails` times; the hold asked at `askAt`
const simulate = ({ fails = 0, inAt = 0, never = false, askAt = 1000 }) => {
	const g = P.newGroupState();
	let t = 0;
	const timeline = [];
	// the line: a try, then a retry after retryDelay on each failure
	P.markStart(g, t);
	let next = never ? Infinity : fails > 0 ? 300 : inAt;
	let failsLeft = fails;
	const events = [];
	for (t = 0; t <= askAt + CAP + 1000; t += 10) {
		if (t >= next && g.state === 'loading') {
			if (failsLeft > 0) {
				failsLeft -= 1;
				const r = P.markTryFailed(g, t, RETRIES);
				events.push(`${t}:${r}`);
				if (r === 'retry') {
					const d = P.retryDelay(g.tries, RETRY_MS);
					next = t + d;
					// restart at the retry moment
					g.__restartAt = t + d;
				}
			} else P.markReady(g, t);
		}
		if (g.state === 'waiting' && g.__restartAt !== undefined && t >= g.__restartAt) {
			P.markStart(g, t);
			next = failsLeft > 0 ? t + 300 : t + 50;
		}
		if (t >= askAt) {
			const d = P.holdDecision([g], askAt, t, CAP);
			timeline.push(d);
			if (d !== 'hold') return { g, decision: d, at: t, waited: t - askAt, events, timeline };
		}
	}
	return { g, decision: 'none', events, timeline };
};
const ready = simulate({ inAt: 400 });
check(ready.decision === 'go' && ready.waited === 0, 'files in before the press: go at once, no hold (the press comes when it always did)', ready);
const late = simulate({ inAt: 3000 });
check(late.decision === 'go' && late.waited === 2000 && late.timeline.slice(0, -1).every((d) => d === 'hold'), 'late files: the press holds until they are up (2,000 ms here), then go', { waited: late.waited, decision: late.decision });
const retried = simulate({ fails: 1, askAt: 100 });
check(retried.decision === 'go' && retried.g.tries === 2 && retried.events.join() === '300:retry', 'one failed try: retried after the first retry delay, then in', retried);
// (asked 1.5 s into the line: the last of the three tries fails 3.5 s in, inside the 2.5 s cap from the ask)
const failedAll = simulate({ fails: RETRIES + 1, askAt: 1500 });
check(failedAll.decision === 'fallback' && failedAll.g.state === 'failed' && failedAll.g.tries === RETRIES + 1 && failedAll.events.filter((e) => e.endsWith('retry')).length === RETRIES, `a file that fails every try: ${RETRIES} retries, then fallback (the look on show stays; the press is offered)`, failedAll.events);
check(failedAll.waited < CAP, 'the fallback comes as soon as the last try failed, never after the cap', failedAll.waited);
const never = simulate({ never: true });
check(never.decision === 'capped' && never.waited === CAP, `a file that never comes: the press after holdCapMs (${CAP} ms), never later`, { waited: never.waited });
// two needs: one in, one late
{
	const a = P.newGroupState();
	const b = P.newGroupState();
	P.markStart(a, 0);
	P.markStart(b, 0);
	P.markReady(a, 100);
	check(P.holdDecision([a, b], 200, 200, CAP) === 'hold', 'two needs, one still loading: hold');
	P.markTryFailed(b, 300, 0);
	check(P.holdDecision([a, b], 200, 300, CAP) === 'fallback', 'two needs, one in and one failed for good: fallback');
	check(P.holdDecision([], 0, 0, CAP) === 'go', 'no needs (no Epic on this intro): go');
}
// a group that is ready stays ready
{
	const g = P.newGroupState();
	P.markStart(g, 0);
	P.markReady(g, 5);
	P.markStart(g, 10);
	check(g.state === 'ready' && g.tries === 1 && P.markTryFailed(g, 20, 2) === 'failed' && g.state === 'ready', 'a ready group stays ready: a later start or failure changes nothing (once in, in for the session)');
}
check(P.retryDelay(1, RETRY_MS) === RETRY_MS[0] && P.retryDelay(2, RETRY_MS) === RETRY_MS[1] && P.retryDelay(9, RETRY_MS) === RETRY_MS[RETRY_MS.length - 1], 'the retry delays are EPIC_LOAD.retryMs in turn');

// ---- THE BACKGROUND LINE and THE SAFETY NET (Corey "ej1"; constants EPIC_LOAD.background, EPIC_LOAD.hold) -------------
// COPY OF src/game/constants.ts:EPIC_LOAD.hold and EPIC_LOAD.background: read from the file so a change is seen
const HOLD = /\n\thold: \{ rateWindowMs: (\d+), decodeMs: (\d+) \}/.exec(block);
const BG = /\n\tbackground: \{ on: (true|false), restMs: (\d+), pollMs: (\d+), retryMs: (\[[^\]]*\]) \}/.exec(block);
check(!!HOLD && !!BG, 'EPIC_LOAD.hold and EPIC_LOAD.background are where this test reads them');
const DECODE_MS = Number(HOLD?.[2] ?? 1000);
const WINDOW_MS = Number(HOLD?.[1] ?? 3000);
const BG_RETRY = JSON.parse((BG?.[4] ?? '[]').replace(/_/g, ''));
check(BG?.[1] === 'true', 'the background line is on');
check(CAP >= 2000 && CAP <= 3000, `the hold is a short safety net: holdCapMs ${CAP} is 2 to 3 s (was 8,000 with on demand alone)`, CAP);
check(BG_RETRY.length > 0 && BG_RETRY.length <= 5 && BG_RETRY.every((ms, i) => ms > 0 && (i === 0 || ms >= BG_RETRY[i - 1])), 'the background retries are bounded and back off', BG_RETRY);

// the start event
{
	const at = { on: true, startupAt: 100, landingAt: 200, busy: false, restFrom: 300 };
	const R = Number(BG?.[2] ?? 2000);
	check(!P.backgroundMayStart(at, 300 + R - 1, R) && P.backgroundMayStart(at, 300 + R, R), `the start event: start-up over, landing passed, no round in flight, for restMs (${R} ms)`);
	check(!P.backgroundMayStart({ ...at, startupAt: 0 }, 1e9, R), 'never before start-up loading is over');
	check(!P.backgroundMayStart({ ...at, landingAt: 0 }, 1e9, R), 'never before the landing press (a replay has none: never)');
	check(!P.backgroundMayStart({ ...at, busy: true }, 1e9, R), 'never while a round is in flight');
	check(!P.backgroundMayStart({ ...at, restFrom: 0 }, 1e9, R), 'never without a rest that has begun');
	check(!P.backgroundMayStart({ ...at, on: false }, 1e9, R), 'off: never');
}
// one file at a time, never competing with play
check(P.backgroundMayFetch({ urgent: false, request: false, busy: false, prefetching: false }), 'at rest: the next background file starts');
check(!P.backgroundMayFetch({ urgent: false, request: true, busy: false, prefetching: false }), 'a play request on the wire: no new background file');
check(!P.backgroundMayFetch({ urgent: false, request: false, busy: true, prefetching: false }), 'a round playing: no new background file');
check(!P.backgroundMayFetch({ urgent: false, request: false, busy: false, prefetching: true }), "the creature's Super prefetch running: no new background file (one at a time)");
check(P.backgroundMayFetch({ urgent: true, request: true, busy: true, prefetching: true }), "a round that needs the Epic: its line never waits (the fallback, at normal priority)");
// bounded retries
check(BG_RETRY.every((ms, i) => P.backgroundRetryAfter(i, BG_RETRY) === ms) && P.backgroundRetryAfter(BG_RETRY.length, BG_RETRY) === null, 'a failed pass is run again retryMs[n] later, then left (bounded)');
{
	const g = P.newGroupState();
	P.markStart(g, 0);
	P.markTryFailed(g, 1, 0);
	P.resetFailed(g);
	check(g.state === 'waiting' && g.tries === 0 && g.failedAt === 0, 'a failed group is tried afresh by a later pass or a round');
	const r = P.newGroupState();
	P.markReady(r, 5);
	P.resetFailed(r);
	check(r.state === 'ready', 'a ready group is never reset');
}

// THE DECODE RULE
check(P.decodeAllowed({ epicRound: false, featureStarted: false, atRest: true }), 'no Epic round, at rest: the flames may be decoded and uploaded');
check(!P.decodeAllowed({ epicRound: false, featureStarted: false, atRest: false }), 'no Epic round, a spin or a win show in flight: never');
check(P.decodeAllowed({ epicRound: true, featureStarted: false, atRest: false }), "an Epic round before its feature starts (the trigger, the intro): his upload turn, as a look a book names always loads");
check(!P.decodeAllowed({ epicRound: true, featureStarted: true, atRest: false }), 'an Epic round once its feature started: never (at rest after it)');

// THE FORECAST and the hold's new rule
const f = (total, got, warm, need) => ({ total, got, warm, need });
check(JSON.stringify(P.bytesBeforeNeeds([f(100, 0, true, false), f(2000, 500, false, true), f(3000, 0, false, false)])) === JSON.stringify({ bytes: 1500, sheets: 1 }), 'the bytes left run to the last needed file, the files after it do not count');
check(JSON.stringify(P.bytesBeforeNeeds([f(300, 0, false, false), f(2000, 0, false, true), f(900, 0, false, false), f(1000, 0, false, true)])) === JSON.stringify({ bytes: 4200, sheets: 2 }), 'a file ahead of a need on the line counts (one file at a time)');
check(P.bytesBeforeNeeds([f(2000, 0, true, true), f(3000, 0, false, false)]).bytes === 0, 'every need in: no bytes left');
check(Math.abs(P.rateOf([{ t: 100, bytes: 1000 }, { t: 2900, bytes: 2000 }], 3000, 3000) - 1) < 1e-9, 'the rate: bytes in the window over the window (1 byte per ms)');
check(P.rateOf([{ t: 100, bytes: 1000 }], 5000, 3000) === 0, 'nothing in the window: no rate');
check(Math.abs(P.rateOf([{ t: 2900, bytes: 500 }], 3000, 3000, 2500) - 1) < 1e-9, 'a line that started inside the window counts from its start');
check(P.etaOf(0, 0, 2, DECODE_MS) === 2 * DECODE_MS && P.etaOf(100, 0, 1, DECODE_MS) === Infinity && P.etaOf(1000, 1, 1, DECODE_MS) === 1000 + DECODE_MS, 'the forecast: bytes over rate plus decodeMs a sheet; bytes and no rate: not to be expected');
{
	const loading = () => {
		const g = P.newGroupState();
		P.markStart(g, 0);
		return g;
	};
	// THE PROOF'S NUMBERS (the Linux host, ef545de0): Fast 3G is 1.44 Mbit/s, 180 bytes per ms; his Epic idle sheet is 2.15 MB
	const fast3g = 1.44e6 / 8 / 1000;
	const eta3g = P.etaOf(2.15e6, fast3g, 1, DECODE_MS);
	check(P.holdDecision([loading()], 0, 0, CAP, eta3g) === 'late', `Fast 3G, his idle sheet not started: ${Math.round(eta3g)} ms forecast, no hold at all (ef545de0 held 8 s and still missed)`, eta3g);
	check(P.holdDecision([loading()], 0, 0, CAP, P.etaOf(0, 0, 1, DECODE_MS)) === 'hold', "the sheet in, his decode and upload left: hold (they come inside the cap)");
	check(P.holdDecision([loading()], 0, 0, CAP, P.etaOf(100e3, fast3g, 1, DECODE_MS)) === 'hold', 'the last 100 kB on Fast 3G: hold');
	check(P.holdDecision([loading()], 0, 1500, CAP, 1200) === 'late', 'a hold whose forecast slips past the cap ends at once');
	check(P.holdDecision([loading()], 0, CAP, CAP, 0) === 'capped', 'never longer than the cap');
	const done = P.newGroupState();
	P.markReady(done, 1);
	check(P.holdDecision([done], 0, 0, CAP, Infinity) === 'go', 'everything up (the background line did it): go, no hold, whatever the forecast');
}
// the window used for the rate is a sane length
check(WINDOW_MS >= 1000 && WINDOW_MS <= 10000, 'the rate window is 1 to 10 s', WINDOW_MS);

// SOURCE CHECKS (what a node test can see of the wiring): the start event's two calls, the fetch priority, the decode rule
const epicSrc = readFileSync(join(here, '../src/game/epicLoad.ts'), 'utf8');
const gameSrc = readFileSync(join(here, '../src/components/Game.svelte'), 'utf8');
const plaqueSrc = readFileSync(join(here, '../src/components/ModePlaque.svelte'), 'utf8');
check(/loadCoinFlip\(renderer\)\)\s*\.then\(epicStartupDone\)/.test(gameSrc), 'start-up over is called after the turning medallion, the last start-up load');
check((gameSrc.match(/epicLandingPassed\(\)/g) ?? []).length === 2, 'the landing press and the resume card both pass the landing');
check(/priority: \(\) => \(urgent \? 'auto' : 'low'\)/.test(epicSrc), "background files at priority low, a round's at normal priority");
check(/epicFeatureStart\(mode\);\n\t\};/.test(plaqueSrc), "the feature's start is marked once the intro's gate is passed");
check((epicSrc.match(/await untilDecodeOk\(\)/g) ?? []).length === 2 && /if \(!decodeOk\(\)\) return;/.test(epicSrc), 'the flames are decoded and uploaded only under the decode rule (before the decode, before and inside the upload turn)');
check(!/creaturePrepareEpic\(\)/.test(epicSrc.slice(epicSrc.indexOf('const runBackground'), epicSrc.indexOf('const bgTick'))), 'the background line never names his Epic look (nothing of his goes to the GPU ahead)');
check(/import\.meta\.env\.DEV && typeof window !== 'undefined'\) \{\n\tconst hook/.test(epicSrc), 'the DEV record only under import.meta.env.DEV');

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
