// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// WHAT A REPLAYED ROUND DRAWS, A PURE TEST (no browser): src/game/replayNeeds.ts, which game/replayLoad.svelte.ts reads to
// fetch a replay's own files first and which START REPLAY waits on (constants REPLAY_LOAD).
//   node --experimental-strip-types --no-warnings tools/replay_needs_test.mjs
// Checked:
//   - built books: the symbols that land (the reveal's board, every fill, a sting's symbol), the symbols that win (every
//     cluster, the scatter on a feature's trigger), the plaque (a base win at Big 25x and not under it, a wincap, a
//     feature's intro and wrap up), the feature
//   - THE REPLAY'S GATE: every key of the gate in exactly one group, START's groups first in their order (drop, win,
//     plaque), the plaque's group under its own name and only when the round shows one, the landing symbols' idle loops
//     straight after, the rest of the gate in its own order, no empty group
//   - REAL books of the published math (_math_upload/manticore_mayhem-math-*/publish_files, read with zstd when both are
//     there), every mode: the reading agrees with an independent count of the same books, and reading changes nothing
//   - the two books Decimus timed on staging 7a2523c (base 25094 and the Epic 175779 of the base mode), when found
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

const { replayNeedsOf, replayGateOrder } = await import('../src/game/replayNeeds.ts');
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
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

// ---- built books ---------------------------------------------------------------------------------------------------------
const board = (symbols) => Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => symbols[(r * 8 + c) % symbols.length]));
const base = [
	{ index: 0, type: 'reveal', board: board(['L1', 'L2', 'M1']), gameType: 'basegame' },
	{ index: 1, type: 'cascade', wins: [{ s: 'L1', n: 8, c: [], p: 10, m: 0, w: 10 }], removed: [], tiles: [], fill: [['H1'], [], ['L2']], spinWin: 10 },
	{ index: 2, type: 'sting', kind: 'normal', center: 3, cells: [3], symbol: 'W' },
	{ index: 3, type: 'roar', removed: [], fill: [['M3']] },
	{ index: 4, type: 'setTotalWin', amount: 2499 },
	{ index: 5, type: 'finalWin', amount: 2499 },
];
const n = replayNeedsOf(base);
check(same(n.lands, ['L1', 'L2', 'M1', 'H1', 'W', 'M3']), 'lands: the reveal board, every fill and a sting', n.lands);
check(n.lands[0] === 'L1' && n.lands[3] === 'H1', 'lands are in the order they first land', n.lands);
check(same(n.wins, ['L1']) && same(n.winsFirst, ['L1']), 'wins: the cascade clusters only (all in the first spin without a feature)', n);
check(!n.plaque && n.feature === null, 'a base win under Big (24.99x) shows no plaque, no feature', n);
check(replayNeedsOf(base.map((e) => (e.type === 'setTotalWin' ? { ...e, amount: 2500 } : e))).plaque, 'a base win at Big (25x) shows the plaque');
check(replayNeedsOf([...base.slice(0, 2), { index: 2, type: 'wincap', amount: 1_000_000 }]).plaque, 'a wincap shows the plaque');
const feature = [
	{ index: 0, type: 'reveal', board: board(['S', 'L4']), gameType: 'basegame' },
	{ index: 1, type: 'bonusStart', bonus: 'super', totalFs: 10, tileCap: 128, scatters: [0, 2, 4, 6] },
	{ index: 2, type: 'reveal', board: board(['L3']), gameType: 'freegame', fs: 1, totalFs: 10 },
	{ index: 3, type: 'cascade', wins: [{ s: 'L3', n: 64, c: [], p: 1, m: 0, w: 1 }], removed: [], tiles: [], fill: [['M2']], spinWin: 1 },
	{ index: 4, type: 'setTotalWin', amount: 1 },
	{ index: 5, type: 'bonusEnd', bonus: 'super', totalSessionWin: 1, spinsPlayed: 10 },
	{ index: 6, type: 'freeSpinEnd', amount: 1, winLevel: 2 },
	{ index: 7, type: 'finalWin', amount: 1 },
];
const f = replayNeedsOf(feature);
check(f.feature === 'super' && f.plaque, 'a feature: its mode, and the plaque (its intro and wrap up)', f);
check(same(f.wins, ['S', 'L3']), "a feature's trigger: the scatter's win sheet (its trigger clip) and the free spins' winners", f.wins);
check(same(f.winsFirst, ['S']), "START waits for the first spin's winners only: the scatter's trigger clip, not the free spins' L3", f.winsFirst);
check(same(f.lands, ['S', 'L4', 'L3', 'M2']), "a feature's free spins land too", f.lands);
check(replayNeedsOf([]).lands.length === 0 && !replayNeedsOf([]).plaque, 'an empty book needs nothing');
check(replayNeedsOf([{ index: 0, type: 'mystery', outcome: 'super' }, ...base]).lands.length === 6, 'an old Mystery marker is ignored');

// ---- THE REPLAY'S GATE -------------------------------------------------------------------------------------------------
const SYM = ['l1', 'l2', 'l3', 'l4', 'm1', 'm2', 'm3', 'h1', 'w', 's'];
const GATE = [
	{ name: 'plaque', keys: ['stingerPlaque', 'stingerFx', 'stingerGlint', 'stingerGlyphs', 'stingerTitles'] },
	{ name: 'drop', keys: SYM.map((s) => `mmDrop_${s}`) },
	{ name: 'idle', keys: SYM.map((s) => `mmIdle_${s}`) },
	{ name: 'win', keys: SYM.map((s) => `mmWin_${s}`) },
];
const gateCheck = (needs, label) => {
	const { order, needed } = replayGateOrder(needs, GATE);
	const keys = order.flatMap((g) => g.keys);
	check(keys.length === new Set(keys).size && same(keys, GATE.flatMap((g) => g.keys)), `${label}: every gate key in exactly one group`, order);
	check(order.every((g) => g.keys.length), `${label}: no empty group`, order);
	check(JSON.stringify(order.slice(0, needed.length).map((g) => g.name)) === JSON.stringify(needed), `${label}: START's groups come first`, { order: order.map((g) => g.name), needed });
	const want = ['replayDrop', 'replayWin', ...(needs.plaque ? ['plaque'] : [])].filter((name) => (name === 'replayDrop' ? needs.lands.length : name === 'replayWin' ? needs.wins.length : true));
	check(JSON.stringify(needed) === JSON.stringify(want), `${label}: START waits for drop, win, then the plaque when shown`, needed);
	const by = Object.fromEntries(order.map((g) => [g.name, g.keys]));
	check(same(by.replayDrop ?? [], needs.lands.map((s) => `mmDrop_${s.toLowerCase()}`)), `${label}: the landing symbols' drop sheets`, by.replayDrop);
	check(same(by.replayWin ?? [], needs.winsFirst.map((s) => `mmWin_${s.toLowerCase()}`)), `${label}: the first spin's winners' win sheets`, by.replayWin);
	const later = needs.wins.filter((s) => !needs.winsFirst.includes(s)).map((s) => `mmWin_${s.toLowerCase()}`);
	const soonNames = [...(later.length ? ['replayWinLater'] : []), ...(needs.lands.length ? ['replayIdle'] : [])];
	check(JSON.stringify(order.slice(needed.length, needed.length + soonNames.length).map((g) => g.name)) === JSON.stringify(soonNames), `${label}: then the free spins' winners and the landing symbols' idle loops`, order.map((g) => g.name));
	check(same(by.replayWinLater ?? [], later) && same(by.replayIdle ?? [], needs.lands.map((s) => `mmIdle_${s.toLowerCase()}`)), `${label}: those groups hold their sheets`, { later: by.replayWinLater, idle: by.replayIdle });
	check(order.filter((g) => g.name === 'plaque').length === 1 && by.plaque.length === 5, `${label}: the plaque's atlases stay one group under its own name`, by.plaque);
	const rest = order.slice(needed.length + soonNames.length).map((g) => g.name);
	check(JSON.stringify(rest) === JSON.stringify(['plaque', 'drop', 'idle', 'win'].filter((name) => rest.includes(name))), `${label}: the rest in the gate's own order`, rest);
};
gateCheck(n, 'a base round under Big');
gateCheck(f, 'a feature round');
gateCheck(replayNeedsOf(base.map((e) => (e.type === 'setTotalWin' ? { ...e, amount: 9000 } : e))), 'a base big win');
gateCheck({ lands: [], wins: [], winsFirst: [], plaque: false, feature: null }, 'a book with no board');
check(
	replayGateOrder({ lands: ['L1', 'Q9'], wins: [], winsFirst: [], plaque: false, feature: null }, GATE).order[0].keys.join() === 'mmDrop_l1',
	'a symbol the gate has no sheet for is left out (the cheaper variant keeps the scatter out of the gate)',
);

// ---- real books --------------------------------------------------------------------------------------------------------
// an independent count: the plaque from the event types and the base ladder's first bar, read off winLevelMap's table
const W = await import('../src/game/winLevelMap.ts');
const { BOOK_AMOUNT_MULTIPLIER } = await import('constants-shared/bet');
const bigBar = W.WIN_TIER_STAGES[0].xBet * BOOK_AMOUNT_MULTIPLIER;
const independent = (events) => {
	const lands = new Set();
	const wins = new Set();
	const winsFirst = new Set();
	let feature = null;
	let plaque = false;
	let inFeature = false;
	for (const e of events) {
		if (e.type === 'reveal') e.board.flat().forEach((s) => lands.add(s));
		if (e.fill) e.fill.flat().forEach((s) => lands.add(s));
		if (e.type === 'sting') lands.add(e.symbol);
		if (e.type === 'cascade') e.wins.forEach((w) => (wins.add(w.s), !inFeature && winsFirst.add(w.s)));
		if (e.type === 'bonusStart') {
			wins.add('S');
			if (!inFeature) winsFirst.add('S');
			feature ??= e.bonus;
			inFeature = true;
		}
		if (['bonusStart', 'freeSpinEnd', 'wincap'].includes(e.type)) plaque = true;
		if (e.type === 'setTotalWin' && !inFeature && e.amount >= bigBar) plaque = true;
	}
	return { lands, wins, winsFirst, feature, plaque };
};
const upload = join(here, '../../../../_math_upload');
const mathDir = existsSync(upload) ? readdirSync(upload).filter((d) => d.startsWith('manticore_mayhem-math-')).sort().pop() : null;
const zstdOut = (file, cmd) => {
	try {
		return execFileSync('sh', ['-c', `zstd -dc "${file}" 2>/dev/null | ${cmd}`], { maxBuffer: 64 * 1024 * 1024 }).toString();
	} catch (e) {
		return e.stdout?.toString() ?? '';
	}
};
if (mathDir) {
	const dir = join(upload, mathDir, 'publish_files');
	const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
	let count = 0;
	const tally = { plaque: 0, feature: 0 };
	for (const mode of index.modes) {
		// the first books of each mode, plus the first that open the Epic (zstd stops as soon as grep has its lines)
		const lines = [...zstdOut(join(dir, mode.events), 'head -n 60').split('\n'), ...zstdOut(join(dir, mode.events), `grep -m 6 '"bonus": *"epic"'`).split('\n')].filter(Boolean);
		for (const line of lines) {
			const book = JSON.parse(line);
			const before = JSON.stringify(book.events);
			const got = replayNeedsOf(book.events);
			const want = independent(book.events);
			count += 1;
			if (got.plaque) tally.plaque += 1;
			if (got.feature) tally.feature += 1;
			check(same(got.lands, want.lands) && same(got.wins, want.wins) && same(got.winsFirst, want.winsFirst), `${mode.name} book ${book.id}: lands, wins and first spin wins agree with the independent count`, { got, want: { lands: [...want.lands], wins: [...want.wins], winsFirst: [...want.winsFirst] } });
			check(got.plaque === want.plaque && got.feature === want.feature, `${mode.name} book ${book.id}: plaque and feature agree with the independent count`, { got, want });
			check(JSON.stringify(book.events) === before, `${mode.name} book ${book.id}: reading the book changes nothing in it`);
			const { order } = replayGateOrder(got, GATE);
			check(same(order.flatMap((g) => g.keys), GATE.flatMap((g) => g.keys)), `${mode.name} book ${book.id}: its gate holds every gate key`);
		}
	}
	console.log(`real books: ${count} from ${mathDir} (${tally.plaque} show the plaque, ${tally.feature} open a feature)`);
	// the two books Decimus timed (staging 7a2523c, the base mode's 25094 and 175779)
	const baseFile = join(dir, index.modes.find((m) => m.name === 'base').events);
	for (const id of [25094, 175779]) {
		const line = zstdOut(baseFile, `grep -m 1 '^{"id": *${id},'`).split('\n')[0];
		if (!line) {
			console.log(`book ${id}: not found in the base books (skipped)`);
			continue;
		}
		const got = replayNeedsOf(JSON.parse(line).events);
		console.log(`book ${id}: lands ${got.lands.length} symbols, wins ${got.wins.join(' ') || 'none'} (first spin ${got.winsFirst.join(' ') || 'none'}), plaque ${got.plaque}, feature ${got.feature}`);
		check(got.lands.length > 0, `book ${id}: lands symbols`);
		if (id === 175779) check(got.feature === 'epic' && got.plaque, 'book 175779 opens the Epic and shows the plaque', got);
	}
} else console.log('real books: none (no _math_upload folder or no zstd): the built books above only');

console.log(failed ? `\n${failed} FAILED, ${passed} passed` : `\nall ${passed} passed`);
process.exit(failed ? 1 : 0);
