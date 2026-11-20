// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{game/road/wildMult.ts,game/road/roadFeatures.ts,game/road/roadBoard.ts,game/road/winLights.ts,game/wildMultSpec.ts,game/road/garland.ts};
// WATCHES: ; __reindeer.atRest, __reindeer.board, __reindeer.clock, __reindeer.hud, __reindeer.roadBoard, __reindeer.setBoard,
// WATCHES: ; __reindeer.tune, __reindeer.wildMult, __reindeer.wildMultMemory, __reindeer.road, WILD_MULT, WILD_FRAME.band, COLUMN.joinMs, COLUMN.loadWaitMs
// WATCHES: ; .landing
// THE WILDS' MULTIPLIERS PROBE (Corey 2026-11-19: "E Candy Cane"; game/road/wildMult.ts, constants WILD_MULT,
// tools/build_wild_mult.py). At 1440x900 and 390x844 (the phone tier), device scale 1 and 3:
//   - THE ATLAS: loaded from its stamped address(es), the device tier's sheets, its GPU weight said
//   - THE FIRST BOARD: the posed columns' numbers stand at their multipliers at rest before the press
//   - THE RIGHT VALUE, COLOR AND FIT: a Grandma Wild cell and the three column Wilds at 2x, 3x, 5x, 8x, 10x, 25x, 33x,
//     50x, 75x, 99x, 100x, 250x and 500x: each draws its own value in its character's color set (WILD_MULT.colors,
//     cellColor), every letter visible, inside its frame's inside (clear of the side bands and the bottom rail: the
//     letters' soft shadow tail may reach SLACK road px past it), the digits at least MIN_CSS CSS px tall on a phone (the
//     smallest per character printed), back to rest
//   - GRANDMA'S GOLD: at rest its effects grow with the value (WILD_MULT.gold steps, blended between them): a sheen and
//     nothing else at 2x, two sparkles and no glow at 25x, three and a glow at 100x, five at 500x, and never less at a
//     higher value; the red and green numbers have none
//   - APPEAR: a struck column's number drops in (mode appear) and is at rest after WILD_MULT.appear.totalMs
//   - A GRANDMA WILD JOINING: the column shows its own value first, counts up to the sum, and one stamp marks the slam
//   - A LINE WIN through a cell and a column: both play their win; two on one line send copies to the line's multiplier
//     (flies) and the copies are gone after; back to rest
//   - TURBO: at turbo 2 the appear is over in under its normal length
//   - NOTHING LEFT: after the press (clearAll) and the leave, no multiplier and no copy is on the board
//   - no page errors
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 node tools/wild_mult_probe.mjs
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const APP = process.env.APP || 'http://localhost:3014';
/** device scales per size: by default the desktop at 1 and the phone at 3 (one browser turn stays under the lock's 900 s); DPRS=1,3 runs both on each */
const DPRS = process.env.DPRS ? process.env.DPRS.split(',').map(Number) : null;
const SIZES = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, phone: false },
	{ name: 'phone', vp: { width: 390, height: 844 }, phone: true },
].filter((s) => !process.env.ONLY || process.env.ONLY.split(',').includes(s.name));
const VALUES = [2, 3, 5, 8, 10, 25, 33, 50, 75, 99, 100, 250, 500];
/** the smallest digit height a phone may draw (CSS px; today's was 13.1 in the cell): a 500x shrunk to a column's inside
 *  is about 10.5 */
const MIN_CSS = 10;
/** road px the letters' soft shadow tail may reach past the frame's inside */
const SLACK = 3;
/** the frame's band from its outer edge to its inside (road px): the garland's WILD_FRAME.band (2026-11-19; the red box's
 *  were 19 and 15), read from the game's tune when the page is up (these are its values) */
let BAND = { col: 26, cell: 20 };
const BOARD = [['L4', 'H3', 'L2', 'H2'], ['L3', 'L1', 'L4', 'L5'], ['L3', 'L5', 'L1', 'L4'], ['H4', 'L4', 'L2', 'L4'], ['H3', 'L1', 'L4', 'H1']];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
let passes = 0;
const check = (ok, msg, detail) => {
	if (ok) passes++;
	else fails++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ` ${JSON.stringify(detail).slice(0, 600)}` : ''}`);
};

const mults = (p) => p.evaluate(() => window.__reindeer.wildMult());
const waitFor = async (p, fn, arg, ms = 20000) => {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) {
		if (await p.evaluate(fn, arg).catch(() => false)) return true;
		await sleep(100);
	}
	return false;
};

/** each column's outer box and each cell's box, CSS px (the stage's space, as the glyph bounds) */
const boxes = (p) =>
	p.evaluate(() => {
		const F = window.__reindeer.roadBoard().features;
		const g = (o) => {
			const b = o.getBounds();
			return { x: b.x, y: b.y, w: b.width, h: b.height };
		};
		// (2026-11-19, the garland: its outer edge as laid, road px, through its own transform; its root's bounds take in
		// the baubles hung on its corners)
		const outer = (box) => {
			const o = box.parts().outer;
			const a = box.root.toGlobal({ x: o.x, y: o.y });
			const b = box.root.toGlobal({ x: o.x + o.w, y: o.y + o.h });
			return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
		};
		const cols = {};
		for (const c of F.columns) {
			if (c.phase === 'leave') continue;
			cols[c.reel] = outer(c.box);
		}
		const cells = {};
		for (const c of F.clouds) if (c.leaving === null) cells[c.cell] = outer(c.box);
		return { cols, cells, band: { ...window.__reindeer.tune.wildFrame.band } };
	});

const inside = (gl, box, slack = 1) => gl.every((q) => q.x >= box.x - slack && q.x + q.w <= box.x + box.w + slack && q.y >= box.y - slack && q.y + q.h <= box.y + box.h + slack);

async function run(browser, S, dpr) {
	const tag = `${S.name} x${dpr}`;
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: dpr, isMobile: S.phone, hasTouch: S.phone });
	const p = await ctx.newPage();
	const errors = [];
	p.on('pageerror', (e) => errors.push(e.message));
	const urls = [];
	p.on('request', (r) => {
		if (/wild-mult/.test(r.url())) urls.push(r.url());
	});
	await p.goto(`${APP}/?lang=en&sessionID=wildmult${S.name}${dpr}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });

	// THE FIRST BOARD: its posed columns' numbers, before the press
	const landed = await waitFor(p, () => {
		const m = window.__reindeer?.wildMult?.();
		return !!m && m.columns.length === 3 && m.columns.every((c) => c.loaded && c.value === c.multiplier && c.mode === 'rest' && c.glyphs.length === String(c.multiplier).length + 1);
	});
	const first = await mults(p).catch(() => null);
	check(landed, `${tag}: the first board's three columns show their multipliers at rest before the press (${first?.columns.map((c) => `${c.tier} ${c.text}`).join(', ')})`, first?.columns);

	for (let i = 0; i < 200; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && !document.querySelector('.landing'))).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(500);
	}
	const mem = await p.evaluate(() => window.__reindeer.wildMultMemory());
	check(mem.loaded && mem.size === (S.phone ? 'phone' : 'full') && urls.length === mem.pages.length && urls.every((u) => /\/assets\/wild\/wild-mult-(full|phone)(-\d)?\.webp\?v=[0-9a-f]{8}$/.test(u)), `${tag}: the atlas came from its stamped address(es), the ${mem.size} sheets (${mem.pages.map((q) => `${q.w}x${q.h}`).join(' + ')}, ${mem.mb} MB on the GPU, ${mem.mbWithMips} with mips)`, { mem, urls });
	await p.evaluate((b) => {
		const h = window.__reindeer;
		h.setBoard(h.board());
		h.clock(1);
		h.setBoard(b);
		h.tune.column.loadWaitMs = 60000;
	}, BOARD);

	// THE RIGHT VALUE, COLOR AND FIT, at every value
	const colors = await p.evaluate(() => ({ ...window.__reindeer.tune.wildMult.colors, cell: window.__reindeer.tune.wildMult.cellColor }));
	const smallest = {};
	const goldSeen = [];
	for (const v of VALUES) {
		await p.evaluate((v) => {
			const F = window.__reindeer.roadBoard().features;
			F.clearAll();
			window.__colsDone = false;
			Promise.all([F.columnWild(0, 'reindeer', v, true, null), F.columnWild(2, 'santa', v, true, null), F.columnWild(4, 'grandma', v, true, null)]).then(() => (window.__colsDone = true));
			F.grandmaWild(1 * 4 + 1, v);
		}, v);
		await waitFor(p, () => window.__colsDone, null, 30000);
		const rested = await waitFor(p, () => {
			const m = window.__reindeer.wildMult();
			return m.columns.length === 3 && m.cells.length === 1 && [...m.columns, ...m.cells].every((c) => c.mode === 'rest');
		});
		// the gold's effects over a while at rest (the sheen sweeps, the sparkles take turns, the glow pulses)
		const fx = await p.evaluate(async () => {
			const out = {};
			for (let f = 0; f < 60; f++) {
				const m = window.__reindeer.wildMult();
				for (const c of [...m.columns.map((x) => ({ ...x, key: x.tier })), ...m.cells.map((x) => ({ ...x, key: 'cell' }))]) {
					const o = (out[c.key] ??= { sheen: 0, sparkles: 0, glow: 0 });
					o.sheen = Math.max(o.sheen, c.sheen);
					o.sparkles = Math.max(o.sparkles, c.sparkles);
					o.glow = Math.max(o.glow, c.glow);
				}
				await new Promise((r) => setTimeout(r, 50));
			}
			return out;
		});
		const m = await mults(p);
		const b = await boxes(p);
		BAND = b.band;
		const all = [...m.columns.map((c) => ({ ...c, key: c.tier, box: b.cols[c.reel], band: BAND.col, where: `${c.tier} column` })), ...m.cells.map((c) => ({ ...c, key: 'cell', box: b.cells[c.cell], band: BAND.cell, where: 'cell' }))];
		check(rested, `${tag} ${v}x: every number is back at rest after its appear`, all.map((c) => c.mode));
		for (const c of all) {
			const text = `${v}x`;
			check(c.value === v && c.text === text && c.color === colors[c.key] && c.glyphs.length === text.length, `${tag} ${v}x ${c.where}: draws ${c.text} in ${c.color}, ${c.glyphs.length} letters`, { value: c.value, text: c.text, color: c.color, want: colors[c.key], glyphs: c.glyphs.length });
			const k = c.box ? c.box.w / 248 : 1;
			const inner = c.box ? { x: c.box.x + c.band * k, y: c.box.y, w: c.box.w - 2 * c.band * k, h: c.box.h - c.band * k } : null;
			check(!!inner && inside(c.glyphs, inner, SLACK * k), `${tag} ${v}x ${c.where}: every letter inside the frame's inside, clear of its bands and its bottom rail`, { inner, glyphs: c.glyphs });
			if (S.phone) {
				const css = c.cap * k;
				smallest[c.where] = Math.min(smallest[c.where] ?? Infinity, css);
				check(css >= MIN_CSS, `${tag} ${v}x ${c.where}: its digits are ${css.toFixed(1)} CSS px tall (at least ${MIN_CSS})`);
			}
			const e = fx[c.key];
			if (c.color !== 'gold') check(e.sheen === 0 && e.sparkles === 0 && e.glow === 0, `${tag} ${v}x ${c.where}: the ${c.color} number has no value effects at rest`, e);
			else if (c.key === 'grandma') goldSeen.push({ v, ...e });
		}
	}
	// the gold's effects by value (the column's): the fixed points, then never less at a higher value
	const at = (v) => goldSeen.find((g) => g.v === v);
	const g2 = at(2), g25 = at(25), g100 = at(100), g500 = at(500);
	check(!!g2 && g2.sheen > 0 && g2.sparkles === 0 && g2.glow === 0, `${tag}: gold 2x: a sheen only`, g2);
	check(!!g25 && g25.sparkles === 2 && g25.glow === 0, `${tag}: gold 25x: two sparkles, no glow`, g25);
	check(!!g100 && g100.sparkles === 3 && g100.glow > 0, `${tag}: gold 100x: three sparkles and a glow`, g100);
	check(!!g500 && g500.sparkles === 5 && g500.glow > g100.glow && g500.sheen > g100.sheen, `${tag}: gold 500x: five sparkles, the strongest glow and sheen`, g500);
	const order = [...goldSeen].sort((a, b) => a.v - b.v);
	check(order.every((g, i) => i === 0 || (g.sparkles >= order[i - 1].sparkles && g.glow >= order[i - 1].glow - 0.02)), `${tag}: the gold's sparkles and glow never fall as the value grows (${order.map((g) => `${g.v}x ${g.sparkles}/${g.glow.toFixed(2)}`).join(', ')})`, order);
	if (S.phone) console.log(`  INFO ${tag}: smallest digit height on the phone, CSS px: ${Object.entries(smallest).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}`);

	// APPEAR, and turbo 2's: the move is WILD_MULT.appear.totalMs of board time; the board clock runs at the turbo
	// level's rate (a headless page draws few frames, so real time is not measured)
	for (const turbo of [0, 2]) {
		await p.evaluate((turbo) => {
			const h = window.__reindeer;
			h.turbo(turbo);
			const F = h.roadBoard().features;
			F.clearAll();
			window.__colsDone = false;
			window.__appear = null;
			F.columnWild(2, 'santa', 25, false, 2 * 4 + 1).then(() => (window.__colsDone = true));
			const tick = () => {
				const R = h.roadBoard();
				const c = h.wildMult().columns[0];
				if (c && c.mode === 'appear' && !window.__appear) window.__appear = { from: R.features.clock, rate: R.features.rate };
				if (c && c.mode === 'rest' && window.__appear && !window.__appear.to) window.__appear.to = R.features.clock;
				if (!window.__appear?.to) requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		}, turbo);
		await waitFor(p, () => !!window.__appear?.to, null, 40000);
		const a = await p.evaluate(() => window.__appear);
		const ms = a?.to - a?.from;
		const total = 1000;
		check(!!a?.to && ms >= total - 1 && ms <= total + 250, `${tag} turbo ${turbo}: a struck Santa column's 25x drops in (appear) and stands at rest ${Math.round(ms)} board ms later (its ${total})`, a);
		if (turbo === 2) check(a?.rate > 2, `${tag} turbo 2: the board clock runs at ${a?.rate} (the appear takes ${Math.round(total / (a?.rate || 1))} real ms)`, a);
		await waitFor(p, () => window.__colsDone, null, 20000);
	}
	await p.evaluate(() => window.__reindeer.turbo(0));

	// A GRANDMA WILD JOINING: 25x and 8x make 33x
	await p.evaluate(() => {
		const F = window.__reindeer.roadBoard().features;
		F.clearAll();
		window.__stamps = [];
		const mark = F.sounds.mark.bind(F.sounds);
		F.sounds.mark = (what, detail) => {
			if (what === 'stamp') window.__stamps.push(detail);
			return mark(what, detail);
		};
		window.__colsDone = false;
		window.__seen = [];
		F.columnWild(2, 'santa', 33, true, 2 * 4 + 1, 8).then(() => (window.__colsDone = true));
		const tick = () => {
			const m = window.__reindeer.wildMult().columns[0];
			if (m && m.shown) window.__seen.push(m.value);
			if (!window.__colsDone) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
	await waitFor(p, () => window.__colsDone, null, 30000);
	await waitFor(p, () => window.__reindeer.wildMult().columns[0]?.mode === 'rest', null, 4000);
	const join = await p.evaluate(() => ({ seen: [...new Set(window.__seen)], stamps: window.__stamps, end: window.__reindeer.wildMult().columns[0] }));
	check(join.seen[0] === 25 && join.seen.at(-1) === 33 && join.seen.length > 2 && join.end.value === 33 && join.end.mode === 'rest', `${tag}: a Grandma Wild joining: 25x first, counts up (${join.seen.join(' ')}), stands at 33x`, join);
	check(join.stamps.length === 2 && /25x/.test(join.stamps[0]) && /33x/.test(join.stamps[1]), `${tag}: two stamps, the 25x as it drops in and the 33x as the sum slams (${join.stamps.join(' | ')})`, join.stamps);

	// A LINE WIN through the column and a Grandma Wild cell on one line: both win, copies fly to the line's multiplier
	await p.evaluate(() => {
		const R = window.__reindeer.roadBoard();
		R.features.grandmaWild(0 * 4 + 1, 8);
	});
	await sleep(1200);
	await p.evaluate(() => {
		const R = window.__reindeer.roadBoard();
		window.__flies = 0;
		window.__winModes = new Set();
		R.showWin([{ line: 1, cells: [1, 5, 9, 13, 17], symbol: 'L1', amountText: '$4.10', plainText: '$0.10', multiplier: 41 }], '$4.10', 1500, 41, { pace: 1 });
		const t0 = performance.now();
		const tick = () => {
			const m = window.__reindeer.wildMult();
			window.__flies = Math.max(window.__flies, m.flies);
			for (const c of [...m.columns, ...m.cells]) window.__winModes.add(`${c.place}:${c.mode}`);
			if (performance.now() - t0 < 30000 && !(m.flies === 0 && window.__flies > 0 && [...m.columns, ...m.cells].every((c) => c.mode === 'rest'))) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
	await waitFor(p, () => {
		const m = window.__reindeer.wildMult();
		return window.__winModes.has('col:win') && m.flies === 0 && [...m.columns, ...m.cells].every((c) => c.mode === 'rest');
	}, null, 30000);
	const win = await p.evaluate(() => ({ flies: window.__flies, modes: [...window.__winModes], now: window.__reindeer.wildMult() }));
	check(win.modes.includes('col:win') && win.modes.includes('cell:win'), `${tag}: the line win plays both numbers' win (${win.modes.join(', ')})`, win.modes);
	check(win.flies === 2 && win.now.flies === 0, `${tag}: two adding on the line: two copies flew to its multiplier and are gone (${win.flies} at most, ${win.now.flies} now)`, win);
	check([...win.now.columns, ...win.now.cells].every((c) => c.mode === 'rest'), `${tag}: back at rest after the win`);
	await p.evaluate(() => window.__reindeer.roadBoard().clearWin());

	// NOTHING LEFT: the press takes every column and cell, and their numbers, away
	await p.evaluate(() => window.__reindeer.roadBoard().features.clearAll());
	await sleep(700);
	const left = await p.evaluate(() => {
		const F = window.__reindeer.roadBoard().features;
		const m = window.__reindeer.wildMult();
		return { cols: m.columns.length, cells: m.cells.length, flies: m.flies, layer: F.numberLayer.children.length };
	});
	check(left.cols === 0 && left.cells === 0 && left.flies === 0 && left.layer === 0, `${tag}: after the press nothing of a multiplier is left (numbers layer ${left.layer} children)`, left);
	check(errors.length === 0, `${tag}: no page errors`, errors);
	await ctx.close();
}

const browser = await chromium.launch({ args: ['--mute-audio'] });
for (const S of SIZES) for (const dpr of DPRS ?? [S.phone ? 3 : 1]) await run(browser, S, dpr);
await browser.close();
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
