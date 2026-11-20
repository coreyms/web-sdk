// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/game/road/{brawlCloud.ts,roadFeatures.ts,roadBoard.ts,seated.ts}, src/game/brawlClipSpec.ts;
// WATCHES: ; __reindeer.brawl, __reindeer.brawlBook, __reindeer.brawlRoundEnd, __reindeer.crosshairStrike, __reindeer.grandmaWild,
// WATCHES: ; __reindeer.roamStrike, __reindeer.column, __reindeer.roadBoard, __reindeer.clock, __reindeer.step, GRANDMA_BRAWL
// WATCHES: apps/run_over_reindeer/src/game/{road/wildWord.ts,wildWordSpec.ts}; GRANDMA_BRAWL.word
// THE BRAWL PROBE (the Grandma Wild's animated cloud, Corey 2026-11-19; constants GRANDMA_BRAWL, game/road/brawlCloud.ts).
// From the running game with its board clock frozen and stepped one 60 Hz frame at a time (__reindeer.clock(0), step):
//   strike     a Grandma car's strike ends at the car's rear (the clip's frame 1 has his feet there), for a car facing
//              right and one facing left, from off the screen and by the roaming reindeer
//   landing    option C: the car takes the bump (moved forward) on the frames before the clip, the clip enters at its
//              entry frame with the car hidden, its frames never step back, WILD shows from the cover, the cut lands on
//              the loop's entry frame with the landing fading over it, and from the clip's entry on every frame draws a
//              clip (no gap); at turbo 2 too
//   loop       a standing Wild's loop advances at 12 fps on the board clock
//   four       four Wilds share ONE set of frames (one loop entry in memory, their sprites on its pages), every other one
//              mirrored, their phases apart
//   win        a line win through a Wild plays its beat once (a second line through it does not restart it), WILD fades
//              to 30% while the head is up, and the beat ends back in the loop on its frame 1
//   covered    a column growing over a Wild's reel: the Wild's cloud goes, nothing of it left
//   word       (2026-11-20, treatment B "Candy Cane", game/road/wildWord.ts) the candy WILD is the word drawn, its letters
//              drop in after the cover (one of them above its rest size), it is never mirrored (a mirrored cell too),
//              its box stays inside the cell, and its letters hop in the win
//   clear      a new spin (clearAll, as Skip to Result's boardHeld): every cloud goes, and with no book wanting a Grandma
//              Wild every frame set is let go
// Prints PASS / FAIL lines and a summary; with OUT=<dir> writes the per-frame tables (JSON).
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [OUT=<dir>] [PHONE=1] [ONLY=landing,win]
//     node tools/brawl_probe.mjs
// Uses the dev server that is already running (it never starts one). One headless browser (muted), closed at the end.
// Take the shared browser lock around it (tools/browser_lock.sh run game -- ...).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3014';
const OUT = process.env.OUT || '';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
if (OUT) mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FRAME = 1000 / 60;
const ROWS = 4;
const BOARD_X = 142;
const PITCH = 250;
const LINES = [167.0, 331.5, 510.0, 687.0, 851.0];
const SIT = 10;
const DIR = [1, 1, -1, -1];

let pass = 0;
let fail = 0;
const check = (ok, msg, detail) => {
	if (ok) pass += 1;
	else fail += 1;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
};

async function boot(browser, S) {
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.dpr, isMobile: S.phone, hasTouch: S.phone });
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=brawl${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 200; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer && window.__reindeer.atRest && window.__reindeer.atRest() && window.__reindeer.brawl && !document.querySelector('.landing'))).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height * 0.3).catch(() => {});
		await sleep(600);
	}
	for (let i = 0; i < 60 && !(await p.evaluate(() => window.__reindeer.runMemory().loaded)); i++) await sleep(500);
	// the frames a book with a Grandma Wild warms
	await p.evaluate(() => window.__reindeer.brawlBook(true));
	for (let i = 0; i < 80; i++) {
		const s = await p.evaluate(() => ({ ...window.__reindeer.brawl().sets, word: window.__reindeer.brawl().word.loaded }));
		if (s.loop && s.land && s.still && s.star && s.word) break;
		await sleep(250);
	}
	await sleep(500);
	return { ctx, p, errs };
}

/** the parked car in a cell as the road board draws it (DEV: the road board itself) */
const carIn = (p, cell) =>
	p.evaluate((cell) => {
		const r = window.__reindeer.roadBoard();
		const c = r.cars.find((x) => x.phase === 'rest' && x.col * 4 + x.lane === cell);
		return c ? { x: c.sprite.x, restX: c.restX, dir: c.dir, visible: c.sprite.visible, sx: c.sprite.scale.x / (c.baseScale || 1), kick: c.seated ? c.seated.kick : null } : null;
	}, cell);

const cellOf = (snap, cell) => snap.cells.find((c) => c.cell === cell) ?? null;

/** a Grandma strike into `cell` on a posed board, frame by frame through its landing and `tailMs` of loop */
async function landing(p, cell, { turbo = 0, tailMs = 2200 } = {}) {
	await p.evaluate((c) => window.__reindeer.crosshairStrike({ cells: [c], kinds: ['H1'], target: c, poseOnly: true }), cell);
	await sleep(400);
	await p.evaluate((t) => {
		window.__reindeer.turbo(t);
		window.__reindeer.clock(0);
	}, turbo);
	await p.evaluate((c) => {
		window.__bDone = false;
		window.__reindeer.crosshairStrike({ cells: [c], kinds: ['H1'], target: c, follow: true }).then(() => (window.__bDone = true));
	}, cell);
	for (let i = 0; i < 40 && !(await p.evaluate(() => window.__reindeer.crosshairTrace().plan)); i++) await sleep(50);
	const rows = [];
	let impact = null;
	let t = 0;
	for (let f = 0; f < 1500; f++) {
		await p.evaluate((ms) => window.__reindeer.step(ms, 1) && null, FRAME);
		const st = await p.evaluate(() => ({ brawl: window.__reindeer.brawl(), runner: window.__reindeer.roadBoard().features.snapshot().runner }));
		const run = st.runner;
		if (!impact && run && run.phase === 'impact') impact = { ...run };
		const b = cellOf(st.brawl, cell);
		if (impact || b) {
			const car = await carIn(p, cell);
			rows.push({ f, b, car, runner: run ? { x: run.x, y: run.y, alpha: run.alpha, phase: run.phase } : null });
			if (b) t += 1;
		}
		if (b && b.mode === 'loop' && t * FRAME * (turbo === 2 ? 2.6 : turbo === 1 ? 1.7 : 1) > tailMs + 600) break;
	}
	await p.evaluate(() => window.__reindeer.clock(1));
	for (let i = 0; i < 60 && !(await p.evaluate(() => window.__bDone)); i++) await sleep(100);
	await p.evaluate(() => window.__reindeer.turbo(0));
	return { rows, impact };
}

function judgeLanding(tag, cell, L, spec, rate = 1) {
	const { rows, impact } = L;
	const reel = Math.floor(cell / ROWS);
	const row = cell % ROWS;
	const cx = BOARD_X + reel * PITCH + PITCH / 2;
	const facing = DIR[row];
	const carBottom = LINES[row + 1] - SIT;
	check(!!impact, `${tag}: the strike hit`);
	if (impact) {
		const wantX = cx + facing * -160.51242049681986;
		const wantY = carBottom - 31.82347836230621;
		check(impact.grandma === true, `${tag}: run as a Grandma car's strike`);
		check(Math.abs(impact.endX - wantX) < 0.5 && Math.abs(impact.x - wantX) < 0.5, `${tag}: ends at the car's rear x ${impact.x} (want ${wantX.toFixed(1)})`);
		check(Math.abs(impact.endY - wantY) < 0.5 || impact.endY > wantY, `${tag}: ends at the car's rear y ${impact.endY} (want ${wantY.toFixed(1)}; lower only when the cut cannot reach it)`, { endY: impact.endY, wantY });
		check(impact.cutDir === facing && impact.mirrored === (facing === -1), `${tag}: the last cut runs the way the car faces (${impact.cutDir})`);
	}
	const withB = rows.filter((r) => r.b);
	check(withB.length > 10, `${tag}: the Wild was traced (${withB.length} frames)`);
	if (!withB.length) return;
	const first = withB[0];
	check(first.b.mode === 'land', `${tag}: it lands (mode ${first.b.mode})`);
	check(first.b.mirror === (facing === -1), `${tag}: mirrored with its car's facing (${first.b.mirror})`);
	const sprite = withB.filter((r) => r.b.mode === 'land' && r.b.over === '');
	const bumped = sprite.filter((r) => r.car && r.car.visible && (r.car.x - r.car.restX) * r.car.dir > 3);
	check(rate > 2 || bumped.length >= 1, `${tag}: the car takes the bump forward before the clip (${bumped.length} frames, moved ${bumped.map((r) => Math.round((r.car.x - r.car.restX) * r.car.dir)).join(',')})`);
	const clip = withB.filter((r) => r.b.over === 'land');
	check(clip.length >= 3, `${tag}: the landing clip plays (${clip.length} frames)`);
	check(clip.every((r) => !r.car || !r.car.visible), `${tag}: the car is hidden while the clip shows`);
	check(clip.every((r) => !r.car || Math.abs(r.car.x - r.car.restX) < 0.01), `${tag}: the car is back on its mark after the bump`);
	const steps = clip.map((r) => r.b.overFrame);
	check(steps.every((v, i) => i === 0 || v >= steps[i - 1]), `${tag}: the landing's frames never step back (${steps.join(' ')})`);
	const fromClip = withB.slice(withB.indexOf(clip[0] ?? withB[0]));
	const gaps = fromClip.filter((r) => !r.b.overVisible && !r.b.underVisible);
	check(gaps.length === 0, `${tag}: from the clip's entry every frame draws a clip (no gap)`, gaps.slice(0, 3).map((r) => r.f));
	const before = withB.filter((r) => r.b.mode === 'land' && r.b.over === '' );
	check(before.every((r) => r.b.wordAlpha === 0), `${tag}: WILD hidden before the car is covered`);
	// THE CANDY WORD (treatment B)
	const after = withB.filter((r) => r.b.wordVisible);
	check(after.length > 0 && after.every((r) => r.b.wordLook === 'candy'), `${tag}: the word drawn is the candy WILD (${[...new Set(after.map((r) => r.b.wordLook))].join(',')})`);
	check(withB.every((r) => !r.b.wordMirrored), `${tag}: the word is never mirrored (the cell ${first.b.mirror ? 'is' : 'is not'} mirrored)`);
	const dropping = after.filter((r) => r.b.candyWord?.letters?.some((q) => q.sx > 1.05));
	check(rate > 2 || dropping.length >= 2, `${tag}: its letters drop in after the cover (${dropping.length} frames with a letter above its rest size)`);
	const wb = after[after.length - 1]?.b;
	const bx = wb?.box;
	const cw = wb?.candyWord?.box;
	check(!!bx && !!cw && cw.x >= bx.x - 0.01 && cw.y >= bx.y - 0.01 && cw.x + cw.w <= bx.x + bx.w + 0.01 && cw.y + cw.h <= bx.y + bx.h + 0.01, `${tag}: the word's box inside the cell's (${JSON.stringify(cw)} in ${JSON.stringify(bx)})`);
	const cut = withB.find((r) => r.b.under === 'loop');
	const entry = spec.landing.loopEntry;
	const i0 = Math.floor((entry - 1) / 2);
	check(!!cut && (cut.b.underFrame === i0 || cut.b.underFrame === i0 + 1 || rate > 1), `${tag}: the cut lands on the loop's frame ${i0} (source ${entry}): ${cut?.b.underFrame}`);
	const fade = withB.filter((r) => r.b.under === 'loop' && r.b.over === 'land');
	check(rate > 2 || fade.length >= 1, `${tag}: the landing fades over the loop at the cut (${fade.length} frames, alpha ${fade.map((r) => r.b.overAlpha).join(',')})`);
	const loopRows = withB.filter((r) => r.b.mode === 'loop');
	check(loopRows.length > 20 && loopRows.every((r) => r.b.wordAlpha === 1 && !r.b.overVisible), `${tag}: then the loop alone, WILD shown`);
	// the loop advances at 12 fps of the board clock
	const lf = loopRows.map((r) => r.b.underFrame);
	let changes = 0;
	let bad = 0;
	for (let i = 1; i < lf.length; i++) {
		if (lf[i] !== lf[i - 1]) {
			changes += 1;
			if ((lf[i] - lf[i - 1] + 48) % 48 > Math.ceil(rate) + 1) bad += 1;
		}
	}
	const expect = (loopRows.length * FRAME * rate * 12) / 1000;
	check(Math.abs(changes - expect) <= 2 && bad === 0, `${tag}: the loop advances at 12 fps (${changes} steps in ${loopRows.length} frames, expected ${expect.toFixed(1)})`);
}

(async () => {
	const browser = await chromium.launch({ args: ['--mute-audio'] });
	const sizes = [{ name: 'desk1440x900', vp: { width: 1440, height: 900 }, dpr: 1, phone: false }];
	if (process.env.PHONE === '1') sizes.push({ name: 'portrait390x844', vp: { width: 390, height: 844 }, dpr: 2, phone: true });
	const tables = {};
	try {
		for (const S of sizes) {
			const { ctx, p, errs } = await boot(browser, S);
			try {
				const spec = await p.evaluate(() => window.__reindeer.brawl());
				check(spec.on && spec.sets.loop && spec.sets.land && spec.sets.still, `${S.name}: the warmed sets are in (${JSON.stringify(spec.sets)})`);
				if (want('landing')) {
					// a car facing right (row 1) and one facing left (row 2)
					for (const cell of [9, 10]) {
						const L = await landing(p, cell);
						judgeLanding(`${S.name} landing cell ${cell}`, cell, L, spec);
						tables[`landing_${S.name}_${cell}`] = L.rows.map((r) => ({ f: r.f, ...(r.b ?? {}), car: r.car, runner: r.runner }));
					}
					const T = await landing(p, 9, { turbo: 2, tailMs: 1200 });
					judgeLanding(`${S.name} landing cell 9 turbo 2`, 9, T, spec, 2.6);
				}
				if (want('roam')) {
					await p.evaluate(() => window.__reindeer.crosshairStrike({ cells: [5], kinds: ['H1'], target: 5, poseOnly: true }));
					await sleep(300);
					const r = await p.evaluate(async () => {
						let got = null;
						const done = window.__reindeer.roamStrike(5, { grandma: true }).then(() => (got = window.__reindeer.roadBoard().features.snapshot().runner));
						for (let i = 0; i < 300 && !got; i++) await new Promise((res) => setTimeout(res, 50));
						await done;
						return got;
					});
					const want = BOARD_X + 1 * PITCH + PITCH / 2 - 160.51242049681986;
					check(!!r && Math.abs(r.endX - want) < 0.5 && Math.abs(r.x - want) < 0.5 && r.grandma, `${S.name}: the roaming reindeer's Grandma strike ends at the car's rear too (x ${r?.x}, want ${want.toFixed(1)}; his own run ${r?.roam})`, r);
				}
				if (want('four')) {
					await p.evaluate(() => window.__reindeer.crosshairStrike({ cells: [1, 6, 13, 18], kinds: ['H1', 'H1', 'H1', 'H1'], target: 1, poseOnly: true }));
					await sleep(300);
					await p.evaluate(() => Promise.all([1, 6, 13, 18].map((c, i) => window.__reindeer.grandmaWild(c, [2, 10, 25, 100][i]))));
					await sleep(400);
					const s = await p.evaluate(() => window.__reindeer.brawl());
					const cells = [1, 6, 13, 18].map((c) => cellOf(s, c));
					check(cells.every((c) => c && c.mode === 'loop' && c.underVisible), `four: four Wilds stand in their loop`, cells.map((c) => c?.mode));
					check(JSON.stringify(cells.map((c) => c?.mirror)) === JSON.stringify([false, true, false, true]), `four: every other one mirrored (${cells.map((c) => c?.mirror)})`);
					const frames = cells.map((c) => c?.underFrame);
					check(new Set(frames).size === 4, `four: their phases apart (frames ${frames.join(' ')})`);
					const loops = s.memory.sets.filter((x) => x.set === 'loop');
					const sources = new Set(cells.map((c) => c?.underSource));
					check(loops.length === 1 && sources.size <= 2, `four: one shared set of loop frames (${loops.length} loop set, ${sources.size} sheet(s) drawn from)`);
					// (8 since 2026-11-20: the candy word's own container, beside today's word kept as its stand-in)
					check(cells.every((c) => c && c.sprites <= 8), `four: sprites per Wild (root children) ${cells.map((c) => c?.sprites).join(' ')}`);
					tables.four = s;
				}
				if (want('win')) {
					await p.evaluate(() => window.__reindeer.crosshairStrike({ cells: [9], kinds: ['H1'], target: 9, poseOnly: true }));
					await sleep(300);
					await p.evaluate(() => window.__reindeer.grandmaWild(9, 25));
					await sleep(300);
					await p.evaluate(() => window.__reindeer.clock(0));
					// two lines through the Wild, the second starting 470 ms after the first
					await p.evaluate(() => {
						window.__wDone = false;
						window.__reindeer
							.roadBoard()
							.showWin(
								[
									{ cells: [1, 5, 9, 13, 17], line: 1, symbol: 'H2', amountText: '$1.00', plainText: '$0.04', multiplier: 25 },
									{ cells: [0, 5, 9, 14, 19], line: 2, symbol: 'H2', amountText: '$1.00', plainText: '$0.04', multiplier: 25 },
								],
								'$2.00',
								1300,
								25,
								{ pace: 1 },
							)
							.then(() => (window.__wDone = true));
					});
					const rows = [];
					for (let f = 0; f < 420; f++) {
						await p.evaluate((ms) => window.__reindeer.step(ms, 1) && null, FRAME);
						const b = cellOf(await p.evaluate(() => window.__reindeer.brawl()), 9);
						rows.push({ f, ...b });
						if (f > 60 && b && b.mode === 'loop' && rows.some((r) => r.mode === 'win') && f > rows.findLastIndex((r) => r.mode === 'win') + 30) break;
					}
					await p.evaluate(() => window.__reindeer.clock(1));
					const win = rows.filter((r) => r.mode === 'win');
					check(win.length > 10, `win: the beat plays (${win.length} frames, ${(win.length * FRAME / 1000).toFixed(2)} s)`);
					const last = rows[rows.length - 1];
					check(last && last.beats === 1, `win: once for two lines through it (beats ${last?.beats})`);
					const wf = win.map((r) => r.overFrame);
					check(wf.every((v, i) => i === 0 || v >= wf[i - 1]), `win: its frames never step back (never restarted)`);
					const minA = Math.min(...win.map((r) => r.wordAlpha));
					check(Math.abs(minA - 0.3) < 0.02, `win: WILD fades to 30% while the head is up (lowest ${minA})`);
					const end = rows.findIndex((r, i) => i > 0 && rows[i - 1].mode === 'win' && r.mode === 'loop');
					check(end > 0 && rows[end].underFrame === 0 && rows[end].underVisible, `win: back to the loop on its frame 1 (frame ${rows[end]?.underFrame})`);
					check(win.length && win[0].overAlpha < 1 && win[0].underVisible, `win: it fades in over the loop (first alpha ${win[0]?.overAlpha})`);
					const hop = Math.min(...rows.map((r) => Math.min(...(r.candyWord?.letters ?? []).map((q) => q.y), 0)));
					check(hop < -6 && rows.every((r) => !r.wordMirrored), `win: the candy letters hop on the number's beats (highest ${hop} road px), never mirrored`);
					tables.win = rows;
					for (let i = 0; i < 40 && !(await p.evaluate(() => window.__wDone)); i++) await sleep(100);
					await p.evaluate(() => window.__reindeer.roadBoard().clearWin());
				}
				if (want('covered')) {
					await p.evaluate(() => window.__reindeer.crosshairStrike({ cells: [9], kinds: ['H1'], target: 9, poseOnly: true }));
					await sleep(300);
					await p.evaluate(() => window.__reindeer.grandmaWild(9, 25));
					await sleep(300);
					const kids0 = await p.evaluate(() => window.__reindeer.roadBoard().features.layer.children.map((c) => c.children.length));
					await p.evaluate(() => window.__reindeer.column(2, 'santa', 20, 8));
					await sleep(3500);
					const s = await p.evaluate(() => window.__reindeer.brawl());
					check(!cellOf(s, 9), `covered: the Wild's cloud has gone under the column (${s.cells.map((c) => c.cell)})`);
					const kids = await p.evaluate(() => window.__reindeer.roadBoard().features.layer.children.map((c) => c.children.length));
					check(kids[4] === 0, `covered: nothing left in the cells layer (${kids[4]}, before ${kids0[4]})`);
				}
				if (want('clear')) {
					await p.evaluate(() => window.__reindeer.crosshairStrike({ cells: [9], kinds: ['H1'], target: 9, poseOnly: true }));
					await sleep(300);
					await p.evaluate(() => window.__reindeer.grandmaWild(9, 25));
					await sleep(200);
					await p.evaluate(() => window.__reindeer.brawlRoundEnd());
					await p.evaluate(() => window.__reindeer.crosshairStrike({ cells: [9], kinds: ['H1'], target: 9, poseOnly: true }));
					await sleep(1500);
					const s = await p.evaluate(() => window.__reindeer.brawl());
					check(s.cells.length === 0, `clear: every cloud has gone (${s.cells.length})`);
					check(!s.sets.loop && !s.sets.win && !s.sets.still && !s.sets.land && s.memory.sets.length === 0, `clear: every frame set let go (${JSON.stringify(s.sets)}, ${s.memory.totalMb} MB)`);
				}
			} finally {
				const e = errs.filter((x) => !/favicon/.test(x));
				check(e.length === 0, `${S.name}: no page errors`, e.slice(0, 4));
				await ctx.close();
			}
		}
	} finally {
		await browser.close();
	}
	if (OUT) writeFileSync(join(OUT, 'brawl_probe.json'), JSON.stringify(tables, null, 1));
	console.log(`\nbrawl_probe: ${pass} pass, ${fail} fail`);
	process.exit(fail ? 1 : 0);
})();
