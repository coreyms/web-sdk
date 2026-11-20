// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,game/road/seated.ts,game/road/seatedClips.ts,game/road/brawlCloud.ts}, apps/run_over_reindeer/tools/rider_probe_lib.mjs;
// WATCHES: ; __reindeer.pressReady, __reindeer.clock, __reindeer.riderMemory, __reindeer.road, __reindeer.roadSprites, __reindeer.seatClipMemory, __reindeer.seated
// WATCHES: ; __reindeer.setBoard, __reindeer.step, __reindeer.strayRiders, __reindeer.tune, SEATED.bob, SEATED.clips, SEATED
// THE SEATED DRIVERS PROBE (Corey 2026-11-16: Grandma at the wheel of every Grandma car, H1, and Santa in every sleigh,
// W; constants SEATED, game/road/seated.ts, tools/build_seated.py, tools/seated_split.json). Posed books handed to the
// fixtures through the dev hook (presentation only, no math), the board clock frozen and stepped one 60 Hz frame at a
// time. At 1440x900 and 390x844:
//   - a posed board: every H1 has Grandma and every W has Santa, both directions (the right facing frames in the lanes
//     driving right, the left in the lanes driving left), LAYERED: the vehicle sprite, then right after it the driver,
//     then the front layer (the near door, the sleigh's near wall); on the vehicle's transform and tint; shadow on
//   - a spin that lands them and the next that pulls them away: shown exactly while the vehicle shows on every frame; the
//     lean forward on the stop and back on the pull-away within LEAN_RANGE degrees
//   - a line win through two Grandma cars and a sleigh: the winning drivers bob with the win pulse (up to SEATED.bob.px),
//     the others never; nobody is lifted once the win is over
//   - a strike on a Grandma car (she becomes the crash cloud Wild) and a strike on a sleigh (its reel becomes the Santa
//     column): the struck vehicle's driver goes with it on the frame it is covered, and never shows while the cloud or
//     the column stands (no seated Santa doubling the column's Santa)
//   - nothing left: no driver or driver shadow drawn without its vehicle on any frame (strayRiders = 0), and after the round
//   - the cost on a full board: draw calls and road sprites with the drivers and without; the seated sheet's GPU weight
//     against the phone budget (4 MB for both characters together); no page errors, no console errors
//   - PASS 7, THE ANIMATIONS: the idle at rest (head layered between the body and the front layer, on the figure's
//     transform), the win reaction on the winning drivers only, the still in motion, every seated animation loaded at
//     once within 6 MB desktop and 3 MB phone, the win sheets let go after
// With OUT=<dir>: seated_table_<size>.md (one Grandma car's and one sleigh's lean across the stop and the pull-away).
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [OUT=<dir>] [ONLY=desktop,portrait] \
//     node tools/seated_probe.mjs
// Uses the dev server that is already running. One headless browser, muted, closed at the end. Take the shared browser
// lock around it (mkdir /tmp/hud_mock_shot.lock ... rmdir).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { R, SIZES_ALL, boot, chromium, drawCalls, sleep, stepRound, tally } from './rider_probe_lib.mjs';

const OUT = process.env.OUT || '';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
if (OUT) mkdirSync(OUT, { recursive: true });
const SIZES = SIZES_ALL.filter((s) => (ONLY.length ? ONLY.includes(s.name) : s.name !== 'short'));
/** the lean's peak, degrees: forward on the stop, back on the pull-away */
const LEAN_RANGE = [2, 6];
const PHONE_BUDGET_MB = 4;

// board[reel][row]: Grandma cars at cells 0, 5 (driving right), 10 (left), 16 (right); sleighs at 1, 8 (right), 6, 15 (left)
const LAND = [['H1', 'W', 'L1', 'L2'], ['L3', 'H1', 'W', 'L4'], ['W', 'L5', 'H1', 'L1'], ['L2', 'L3', 'L4', 'W'], ['H1', 'L4', 'L5', 'L1']];
const NEXT = [['L1', 'L2', 'L3', 'L4'], ['L5', 'L1', 'L2', 'L3'], ['L4', 'L5', 'L1', 'L2'], ['L3', 'L4', 'L5', 'L1'], ['L2', 'L3', 'L4', 'L5']];
const WIN_CELLS = [0, 5, 10, 15];
// a Grandma car struck in reel 2 (cell 4) and a sleigh struck in reel 3 (cell 8), each with another of its kind beside
const GRANDMA = [['L1', 'W', 'L3', 'L4'], ['H1', 'L1', 'H1', 'L3'], ['L4', 'L5', 'L1', 'L2'], ['L3', 'L4', 'L5', 'L1'], ['L2', 'L3', 'W', 'L5']];
const SLEIGH = [['L1', 'H1', 'L3', 'L4'], ['L5', 'L1', 'L2', 'L3'], ['W', 'H1', 'L1', 'W'], ['L3', 'L4', 'L5', 'L1'], ['L2', 'W', 'L4', 'L5']];
const book = (board, extra = []) => [{ index: 0, type: 'reveal', gameType: 'basegame', board }, ...extra.map((e, i) => ({ index: i + 1, ...e })), { index: extra.length + 1, type: 'finalWin', amount: extra.some((e) => e.type === 'winInfo') ? 100 : 0 }];
const READ = (h) => ({ seated: h.seated(), stray: h.strayRiders(), win: h.road().winShowing });

const T = tally();
const browser = await chromium.launch({ args: ['--mute-audio'] });
const result = {};
try {
	for (const S of SIZES) {
		const { ctx, p, errs } = await boot(browser, S, 'seated');
		console.log(`-- ${S.name} ${S.vp.width}x${S.vp.height}`);
		const tune = await R(p, () => JSON.parse(JSON.stringify(window.__reindeer.tune.seated)));

		// 1. THE POSED BOARD
		await R(p, (b) => {
			window.__reindeer.setBoard(b);
			window.__reindeer.step(1, 1);
		}, LAND);
		const posed = await R(p, () => window.__reindeer.seated());
		const want = LAND.flatMap((reel, r) => reel.map((s, row) => (s === 'H1' || s === 'W' ? { cell: r * 4 + row, s } : null))).filter(Boolean);
		T.check(posed.length === want.length && posed.every((d) => d.shown && d.layered && d.follows), `${S.name}: every one of the ${want.length} posed vehicles has its driver, layered vehicle, driver, front layer, on its transform and tint`, posed);
		T.check(posed.every((d) => d.frame === `${d.symbol}_${d.lane < 2 ? 'R' : 'L'}` && d.character === (d.symbol === 'H1' ? 'grandma' : 'santa')), `${S.name}: Grandma in every Grandma car, Santa in every sleigh, the right facing frames in the lanes driving right, the left in the lanes driving left`, posed.map((d) => [d.cell, d.frame, d.character]));
		const dirs = new Set(posed.map((d) => d.frame));
		T.check(['H1_R', 'H1_L', 'W_R', 'W_L'].every((f) => dirs.has(f)), `${S.name}: all four vehicle frames are on the board (${[...dirs].join(', ')})`);
		T.check(posed.every((d) => d.shadow), `${S.name}: each driver's shadow silhouette lies with the vehicle's`);

		// 2. THE STOP, THE PULL-AWAY
		const land = await stepRound(p, { book: book(LAND), read: READ });
		const pull = await stepRound(p, { book: book(NEXT), read: READ });
		const all = [...land, ...pull];
		T.check(all.every((r) => r.sample.seated.every((d) => d.shown === d.carVisible)), `${S.name}: on every frame of both spins (${all.length}) every driver shows exactly while the vehicle shows`, all.flatMap((r) => r.sample.seated.filter((d) => d.shown !== d.carVisible)).slice(0, 3));
		T.check(all.every((r) => r.sample.seated.every((d) => !d.shown || (d.layered && d.follows))), `${S.name}: every driver drawn is layered between the vehicle and its front layer and follows its transform and tint`);
		T.check(all.every((r) => r.sample.stray === 0), `${S.name}: no driver or driver shadow is ever drawn without its vehicle`, all.find((r) => r.sample.stray));
		const peak = (rows, phase, sign) => {
			const m = new Map();
			const live = new Set();
			for (const r of rows) for (const d of r.sample.seated) {
				if (d.phase === phase) live.add(d.slot);
				else if (d.phase !== 'rest') live.delete(d.slot);
				if (!live.has(d.slot)) continue;
				m.set(d.slot, { v: Math.max(m.get(d.slot)?.v ?? 0, sign * d.leanDeg), symbol: d.symbol, dir: d.dir });
			}
			return [...m.values()];
		};
		const fwd = peak(land, 'in', 1);
		const back = peak(pull, 'out', -1);
		T.check(fwd.length === want.length && fwd.every((e) => e.v >= LEAN_RANGE[0] && e.v <= LEAN_RANGE[1]), `${S.name}: on the stop every driver leans forward ${fwd.map((e) => e.v.toFixed(1)).join(', ')} deg (in ${LEAN_RANGE.join(' to ')})`, fwd);
		T.check(back.length === want.length && back.every((e) => e.v >= LEAN_RANGE[0] && e.v <= LEAN_RANGE[1]), `${S.name}: on the pull-away every driver leans back ${back.map((e) => e.v.toFixed(1)).join(', ')} deg (in ${LEAN_RANGE.join(' to ')})`, back);
		if (OUT) {
			const md = [`# The seated drivers' lean per frame (${S.vp.width}x${S.vp.height}, the board clock stepped at 60 Hz)`, '', 'lean: degrees, + = forward (the stop), - = back (the pull-away), about the hip. car x: road px.', ''];
			for (const cell of [0, 6]) {
				const slot = land[land.length - 1].sample.seated.find((d) => d.cell === cell)?.slot;
				for (const [title, rows] of [['the stop', land], ['the pull-away', pull]]) {
					md.push(`## ${cell === 0 ? 'Grandma, reel 1 row 1 (drives right)' : 'Santa, reel 2 row 3 (drives left)'}: ${title}`, '', '| frame | phase | car x | lean (deg) |', '|---:|---|---:|---:|');
					let started = false;
					let quiet = 0;
					for (const r of rows) {
						const d = r.sample.seated.find((x) => x.slot === slot);
						if (!d) continue;
						if (!started && Math.abs(d.leanDeg) < 0.01) continue;
						started = true;
						md.push(`| ${r.i} | ${d.phase} | ${d.carX} | ${d.leanDeg} |`);
						quiet = Math.abs(d.leanDeg) < 0.02 ? quiet + 1 : 0;
						if (quiet > 4) break;
					}
					md.push('');
				}
			}
			writeFileSync(join(OUT, `seated_table_${S.name}.md`), md.join('\n'));
		}

		// 3. THE WIN: the winning drivers bob with the pulse
		const win = await stepRound(p, { book: book(LAND, [{ type: 'winInfo', totalWin: 100, wins: [{ symbol: 'H1', kind: 4, line: 1, win: 100, multiplier: 1, cells: WIN_CELLS }] }, { type: 'setTotalWin', amount: 100 }]), read: READ });
		const during = win.filter((r) => r.sample.win);
		const bobIn = Math.max(0, ...during.flatMap((r) => r.sample.seated.filter((d) => WIN_CELLS.includes(d.cell)).map((d) => d.bob)));
		const bobOut = Math.max(0, ...win.flatMap((r) => r.sample.seated.filter((d) => !WIN_CELLS.includes(d.cell) || !r.sample.win).map((d) => d.bob)));
		T.check(during.length > 20 && bobIn > tune.bob.px * 0.8 && bobIn <= tune.bob.px + 1e-6, `${S.name}: the winning drivers bob up to ${bobIn.toFixed(2)} road px with the win pulse (${during.length} frames of win)`);
		T.check(bobOut === 0, `${S.name}: the drivers not in the win never bob, and nobody is lifted once the win is over`, { bobOut });

		// 4. THE STRIKES: a Grandma car becomes the crash cloud Wild (since 2026-11-19 the brawl cloud: the car and its
		// driver take the landing's bump for its first 33 board ms, then both hide together under the clip, so the struck
		// driver is never drawn without its car; game/road/brawlCloud.ts); a sleigh's reel becomes the Santa column. The
		// round before this one wins, so stepRound waits for the game to take the press (pressReady)
		const g = await stepRound(p, { book: book(GRANDMA, [{ type: 'strike', target: 'grandmaCar', cell: 4, reel: 1 }, { type: 'grandmaWild', cell: 4, multiplier: 10 }]), read: READ });
		const gHidden = g.filter((r) => r.sample.seated.some((d) => d.cell === 4 && !d.carVisible));
		T.check(gHidden.length > 10 && gHidden.every((r) => r.sample.seated.filter((d) => d.cell === 4).every((d) => !d.shown)), `${S.name}: the struck Grandma car's driver goes with it under the crash cloud (${gHidden.length} frames), the other Grandma beside it stays`, g.at(-1).sample.seated.filter((d) => d.cell === 4 || d.cell === 6));
		T.check(g.every((r) => r.sample.stray === 0 && r.sample.seated.every((d) => d.shown === d.carVisible)), `${S.name}: through the Grandma strike no driver shows without its vehicle`);
		const s = await stepRound(p, { book: book(SLEIGH, [{ type: 'strike', target: 'santaSleigh', cell: 8, reel: 2 }, { type: 'columnWild', reel: 2, tier: 'santa', multiplier: 5, sticky: false }]), read: (h) => ({ ...({ seated: h.seated(), stray: h.strayRiders(), win: h.road().winShowing }), column: !!h.road().features?.columns?.some?.((c) => c.reel === 2) }) });
		const reel2 = (r) => r.sample.seated.filter((d) => d.cell !== null && Math.floor(d.cell / 4) === 2);
		const covered = s.filter((r) => reel2(r).length && reel2(r).every((d) => !d.carVisible));
		T.check(covered.length > 10 && covered.every((r) => reel2(r).every((d) => !d.shown)), `${S.name}: under the Santa column every driver of its reel (the struck sleigh's Santa, its Grandma, the other sleigh) is gone (${covered.length} frames)`);
		const firstCovered = s.findIndex((r) => reel2(r).length && reel2(r).every((d) => !d.carVisible));
		T.check(firstCovered > 0 && s.slice(firstCovered).every((r) => reel2(r).every((d) => !d.shown)), `${S.name}: from the frame the column covers the reel, no seated Santa doubles the column's Santa`);
		T.check(s.every((r) => r.sample.stray === 0 && r.sample.seated.every((d) => d.shown === d.carVisible)), `${S.name}: through the sleigh strike no driver shows without its vehicle`);
		// the next spin clears the column: the next board's drivers come back with their vehicles
		const after = await stepRound(p, { book: book(LAND), read: READ });
		const end = after.at(-1).sample;
		T.check(end.stray === 0 && end.seated.length === want.length && end.seated.every((d) => d.shown && d.layered), `${S.name}: after the column's round the next board's drivers are all back, nothing left over`, end);

		// 5. THE COST on a full board, frozen, and the memory
		await R(p, (b) => {
			const h = window.__reindeer;
			h.clock(0);
			h.setBoard(b);
			h.step(1, 1);
		}, LAND);
		await sleep(300);
		const on = { calls: await drawCalls(p), sprites: await R(p, () => window.__reindeer.roadSprites()) };
		await R(p, () => {
			window.__reindeer.tune.seated.on = false;
			window.__reindeer.step(0.001, 1);
		});
		await sleep(200);
		const off = { calls: await drawCalls(p), sprites: await R(p, () => window.__reindeer.roadSprites()) };
		await R(p, () => {
			window.__reindeer.tune.seated.on = true;
			window.__reindeer.step(0.001, 1);
			window.__reindeer.clock(1);
		});
		const mem = await R(p, () => window.__reindeer.riderMemory());
		console.log(`  ${S.name} cost, a board with ${want.length} seated vehicles: ${on.calls} draw calls per frame with the drivers, ${off.calls} without; road sprites ${on.sprites.sprites} with, ${off.sprites.sprites} without; the seated sheet ${JSON.stringify(mem.seated)}`);
		T.check(on.calls - off.calls <= 2, `${S.name}: ${want.length} drivers add ${on.sprites.sprites - off.sprites.sprites} sprites and ${Math.round((on.calls - off.calls) * 100) / 100} draw calls per frame`);
		T.check(!!mem.seated && (!S.phone || mem.seated.mb <= PHONE_BUDGET_MB), `${S.name}: the seated sheet ${mem.seated?.w} x ${mem.seated?.h}, ${mem.seated?.mb} MB on the GPU${mem.seated?.mips ? ' with its mips' : ''}${S.phone ? ` (phone budget ${PHONE_BUDGET_MB} MB for both characters)` : ''}`);
		// 6. THE ANIMATIONS (pass 7, Corey: "Not staying with the stills"; game/road/seatedClips.ts, constants SEATED.clips):
		// the idle on every driver at rest, the head layered between the still's body and the front layer and on the
		// figure's transform; only the idles loaded at rest; a win through Grandma and Santa loads and plays the win
		// reaction on the winning drivers only; in motion the still; the GPU memory of every seated animation loaded at once
		// within the budget (desktop 6 MB, phone 3 MB); the win sheets let go after the win
		const BUDGET = S.phone ? 3 : 6;
		const tier = S.phone ? 'phone' : 'full';
		await R(p, (b) => {
			const h = window.__reindeer;
			h.clock(1);
			h.setBoard(b);
		}, LAND);
		let idle = [];
		for (let i = 0; i < 60; i++) {
			await sleep(250);
			idle = await R(p, () => window.__reindeer.seated());
			if (idle.length && idle.every((d) => d.anim.clip === 'idle')) break;
		}
		T.check(idle.length === want.length && idle.every((d) => d.anim.clip === 'idle' && d.headShown && d.headLayered && d.headFollows && d.layered), `${S.name}: at rest every one of the ${want.length} drivers plays its idle: the head between the still's body and the front layer, on the figure's transform`, idle.map((d) => [d.cell, d.anim, d.headShown, d.headLayered, d.headFollows]));
		const fA = idle.map((d) => d.anim.frame);
		await sleep(900);
		const fB = (await R(p, () => window.__reindeer.seated())).map((d) => d.anim.frame);
		T.check(fA.some((f, i) => f !== fB[i]), `${S.name}: the idle runs (frames ${fA.join(',')} then ${fB.join(',')})`);
		const memRest = await R(p, () => window.__reindeer.seatClipMemory());
		T.check(memRest.clips[`grandma:idle:${tier}`]?.state === 'ready' && memRest.clips[`santa:idle:${tier}`]?.state === 'ready' && !Object.entries(memRest.clips).some(([k, v]) => k.includes(':win:') && v.state !== 'none'), `${S.name}: at rest only the two idles are loaded (${memRest.mb} MB)`, memRest);
		let most = memRest.mb;
		const animRows = await stepRound(p, {
			book: book(LAND, [{ type: 'winInfo', totalWin: 100, wins: [{ symbol: 'H1', kind: 4, line: 1, win: 100, multiplier: 1, cells: WIN_CELLS }] }, { type: 'setTotalWin', amount: 100 }]),
			read: (h) => ({ seated: h.seated(), mem: h.seatClipMemory().mb, win: h.road().winShowing }),
		});
		most = Math.max(most, ...animRows.map((r) => r.sample.mem));
		const winning = animRows.filter((r) => r.sample.win);
		const winDrivers = winning.flatMap((r) => r.sample.seated.filter((d) => WIN_CELLS.includes(d.cell)));
		T.check(winDrivers.some((d) => d.anim.clip === 'win' && d.character === 'grandma') && winDrivers.some((d) => d.anim.clip === 'win' && d.character === 'santa'), `${S.name}: the win reaction plays on the winning Grandma and Santa (${winDrivers.filter((d) => d.anim.clip === 'win').length} driver frames)`);
		// (once started the reaction plays to its end while the vehicle stands, past a short win's hold)
		T.check(animRows.every((r) => r.sample.seated.every((d) => d.anim.clip !== 'win' || WIN_CELLS.includes(d.cell))), `${S.name}: never a win reaction on a driver not in the win`);
		const firstWin = animRows.findIndex((r) => r.sample.seated.some((d) => d.anim.clip === 'win'));
		T.check(firstWin < 0 || animRows[firstWin].sample.win, `${S.name}: the reaction starts during the win`);
		T.check(animRows.every((r) => r.sample.seated.every((d) => d.phase === 'rest' || d.anim.clip === 'still')), `${S.name}: a driver in motion shows the still (its lean in code)`);
		T.check(animRows.every((r) => r.sample.seated.every((d) => !d.headShown || (d.headLayered && d.headFollows && d.shown))), `${S.name}: on every frame the head is layered and follows, and never shows without its driver`);
		T.check(most <= BUDGET, `${S.name}: every seated animation loaded at once: ${most} MB on the GPU at most (budget ${BUDGET})`);
		// (the reaction plays to its 4.0 s end past a short win, then its sheet is let go winKeepMs later)
		let memAfter = null;
		for (let i = 0; i < 40; i++) {
			await sleep(250);
			memAfter = await R(p, () => window.__reindeer.seatClipMemory());
			if (!Object.entries(memAfter.clips).some(([k, v]) => k.includes(':win:') && v.state !== 'none')) break;
		}
		T.check(!Object.entries(memAfter.clips).some(([k, v]) => k.includes(':win:') && v.state !== 'none'), `${S.name}: the win sheets are let go after the win (${memAfter.mb} MB loaded after)`, memAfter);
		T.check(errs.length === 0, `${S.name}: no page errors, no console errors`, errs);
		result[S.name] = { tune, fwd, back, bobIn, cost: { on, off }, mem, anim: { rest: memRest, most, after: memAfter } };
		await ctx.close();
	}
} finally {
	await browser.close();
}
console.log(`\n${T.pass} passed, ${T.fail} failed${T.fails.length ? '\n  ' + T.fails.join('\n  ') : ''}`);
if (OUT) writeFileSync(join(OUT, 'seated_probe.json'), JSON.stringify({ pass: T.pass, fail: T.fail, fails: T.fails, ...result }, null, 1));
process.exit(T.fail ? 1 : 0);
