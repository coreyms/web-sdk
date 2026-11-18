// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,game/road/wagonTree.ts};
// WATCHES: ; __reindeer.brakes, __reindeer.clock, __reindeer.riderMemory, __reindeer.road, __reindeer.roadSprites, __reindeer.setBoard
// WATCHES: ; __reindeer.step, __reindeer.strayRiders, __reindeer.trees, __reindeer.tune, COLUMN, LANE_FLOW, WAGON_TREE
// THE WAGON TREE PROBE (Corey 2026-11-16: the Christmas tree tied to every station wagon, H2; constants WAGON_TREE,
// game/road/wagonTree.ts, tools/build_wagon_tree.py). Posed books handed to the fixtures through the dev hook
// (presentation only, no math), the board clock frozen and stepped one 60 Hz frame at a time. At 1440x900 and 390x844:
//   - a posed board: every wagon carries its tree, the right facing picture in the two lanes driving right and the left
//     facing one in the two driving left, its root right after the wagon in the lane, on the wagon's transform and tint,
//     the shadow silhouette on with the wagon's
//   - a spin that lands wagons (the stop) and the next spin that pulls them away, with through traffic forced to wagons:
//     every wagon on the road shows its tree on every frame it shows (through traffic too); on the stop the tip dips
//     (down) by about 11.3 road px and on the pull-away it lifts by about as much (within TIP_RANGE); the body between the
//     ropes never moves more than BODY_MAX; nothing under a rope ever moves
//   - a column standing over a reel with wagons in it: their trees hide with them, and come back when the column goes
//   - nothing left after a round: no tree or rider shadow drawn without its wagon on any frame (strayRiders = 0)
//   - the cost on a full board with three wagons: draw calls per frame and road sprites with the trees and without
//   - the riders' sheets as loaded, and no page errors, no console errors
// With OUT=<dir>: tree_table_<size>.md (the tip, the body, the car's x per frame across the stop and the pull-away of one
// wagon), and with VIDEO=1 the frames of that spin (tree_frames_<size>/) for a 60 fps clip (the caller makes the mp4).
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [OUT=<dir>] [VIDEO=1] \
//     [ONLY=desktop,portrait] node tools/wagon_tree_probe.mjs
// Uses the dev server that is already running. One headless browser, muted, closed at the end. Take the shared browser
// lock around it (mkdir /tmp/hud_mock_shot.lock ... rmdir).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { R, SIZES_ALL, boot, chromium, drawCalls, sleep, stepRound, tally } from './rider_probe_lib.mjs';

const OUT = process.env.OUT || '';
const VIDEO = process.env.VIDEO === '1';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
if (OUT) mkdirSync(OUT, { recursive: true });
const SIZES = SIZES_ALL.filter((s) => (ONLY.length ? ONLY.includes(s.name) : s.name !== 'short'));
/** the tip's peak travel on a stop (down, +) and a pull-away (up, -), road px: NOTES.md has 11.3 for both */
const TIP_RANGE = [8.5, 13.5];
const BODY_MAX = 1.5;

// board[reel][row]: wagons in all four lanes (rows 0, 1 drive right; 2, 3 left)
const LAND = [['H2', 'L1', 'H2', 'L2'], ['L3', 'H2', 'L4', 'H2'], ['L5', 'L1', 'H3', 'L4'], ['L2', 'H4', 'H2', 'L3'], ['H2', 'L4', 'L5', 'L1']];
const NEXT = [['L1', 'L2', 'L3', 'L4'], ['L5', 'L1', 'L2', 'L3'], ['L4', 'L5', 'L1', 'L2'], ['L3', 'L4', 'L5', 'L1'], ['L2', 'L3', 'L4', 'L5']];
// a Santa column over reel 2 with two wagons in it (cells 9 and 10)
const COLUMN = [['L1', 'L2', 'L3', 'L4'], ['L5', 'L1', 'L2', 'L3'], ['W', 'H2', 'H2', 'L2'], ['L3', 'L4', 'L5', 'L1'], ['L2', 'H2', 'L4', 'L5']];
const book = (board, extra = []) => [{ index: 0, type: 'reveal', gameType: 'basegame', board }, ...extra.map((e, i) => ({ index: i + 1, ...e })), { index: extra.length + 1, type: 'finalWin', amount: 0 }];
const READ = (h) => ({ trees: h.trees(), stray: h.strayRiders(), phases: h.road().phases, brakes: h.brakes().filter((b) => b.symbol === 'H2' && b.phase === 'rest').map((b) => ({ lane: b.lane, col: b.col, v: b.v, b: b.b })) });

const T = tally();
const browser = await chromium.launch({ args: ['--mute-audio'] });
const result = {};
try {
	for (const S of SIZES) {
		const { ctx, p, errs } = await boot(browser, S, 'tree');
		console.log(`-- ${S.name} ${S.vp.width}x${S.vp.height}`);
		const tune = await R(p, () => JSON.parse(JSON.stringify(window.__reindeer.tune.wagonTree)));
		const motion = await R(p, () => JSON.parse(JSON.stringify(window.__reindeer.tune.motion.base)));

		// 1. THE POSED BOARD
		await R(p, (b) => window.__reindeer.setBoard(b), LAND);
		await R(p, () => window.__reindeer.step(1, 1));
		const posed = await R(p, () => window.__reindeer.trees());
		const wagons = LAND.flatMap((reel, r) => reel.map((s, row) => (s === 'H2' ? r * 4 + row : null))).filter((c) => c !== null);
		T.check(posed.length === wagons.length && posed.every((t) => t.shown && t.afterSprite && t.follows), `${S.name}: every one of the ${wagons.length} posed wagons carries its tree, right after it in its lane, on its transform and tint`, posed);
		T.check(posed.every((t) => t.frame === (t.lane < 2 ? 'H2_R' : 'H2_L')), `${S.name}: the right facing tree in the lanes driving right, the left facing one in the lanes driving left`, posed.map((t) => [t.cell, t.frame]));
		T.check(posed.every((t) => t.shadow && t.carShadow), `${S.name}: each tree's shadow silhouette lies with its wagon's shadow`, posed.map((t) => [t.cell, t.shadow, t.carShadow]));
		T.check(posed.every((t) => t.strips > 20 && t.ropeDy === 0), `${S.name}: the tree is ${posed[0]?.strips} strips, nothing under the ropes moved`);

		// 2. THE STOP: the board lands with its wagons
		const frameDir = OUT && VIDEO ? join(OUT, `tree_frames_${S.name}`) : null;
		if (frameDir) mkdirSync(frameDir, { recursive: true });
		const land = await stepRound(p, { book: book(LAND), read: READ, frames: frameDir });
		// 3. THE PULL AWAY, with through traffic forced to wagons (two per lane)
		const pull = await stepRound(p, {
			book: book(NEXT),
			read: READ,
			setup: () =>
				R(p, () => {
					const h = window.__reindeer;
					h.__through = h.tune.motion.base.through.perLane;
					h.tune.motion.base.through.perLane = 2;
					h.__random = Math.random;
					Math.random = () => 0.01; // the through traffic's pick: the first of its pool, the wagon
				}),
		});
		await R(p, () => {
			const h = window.__reindeer;
			h.tune.motion.base.through.perLane = h.__through;
			Math.random = h.__random;
		});
		const all = [...land, ...pull];
		const shownWhenCar = all.every((r) => r.sample.trees.every((t) => t.shown === t.carVisible));
		T.check(shownWhenCar, `${S.name}: on every frame of both spins (${all.length}) every wagon shows its tree exactly while it shows itself`, all.flatMap((r) => r.sample.trees.filter((t) => t.shown !== t.carVisible)).slice(0, 3));
		T.check(all.every((r) => r.sample.trees.every((t) => !t.shown || (t.afterSprite && t.follows))), `${S.name}: every tree drawn sits right after its wagon and follows its transform and tint (the dive, the squat, the tunnel shade)`);
		const through = pull.flatMap((r) => r.sample.trees.filter((t) => t.phase === 'through' && t.carVisible));
		T.check(through.length > 0 && through.every((t) => t.shown), `${S.name}: through traffic wagons carry the tree too (${new Set(through.map((t) => t.slot)).size} through wagons, ${through.length} frames)`);
		T.check(all.every((r) => r.sample.stray === 0), `${S.name}: no tree or tree shadow is ever drawn without its wagon (stray riders 0 on every frame)`, all.find((r) => r.sample.stray));
		const per = (rows, phase) => {
			const m = new Map();
			// a stop: from the frame the wagon drives in (a wagon parked before the press is not one); a pull-away: while out
			const live = new Set();
			for (const r of rows) for (const t of r.sample.trees) {
				if (t.phase === phase) live.add(t.slot);
				else if (t.phase !== 'rest') live.delete(t.slot);
				if (!live.has(t.slot)) continue;
				const e = m.get(t.slot) ?? { min: 0, max: 0, body: 0, rope: 0, dir: t.dir, cell: null };
				if (t.cell !== null) e.cell = t.cell;
				e.min = Math.min(e.min, t.tipDy);
				e.max = Math.max(e.max, t.tipDy);
				e.body = Math.max(e.body, Math.abs(t.bodyDy));
				e.rope = Math.max(e.rope, t.ropeDy);
				m.set(t.slot, e);
			}
			return [...m.values()];
		};
		const stops = per(land, 'in');
		const pulls = per(pull, 'out');
		// THE STOP'S DIP FOLLOWS THE CAR'S BRAKE (pass 8): with lane by lane traffic (constants LANE_FLOW) each car brakes
		// from its own cruise speed v over its own b ms, a constant deceleration v x 1000 / b (road px/s^2), so a car with
		// less far to go brakes more gently and its tree dips less. The tip's spring is linear up to its clamp (target =
		// min(decel x gain, clamp)) and every brake pulse here is the same length (b = brakeMs), so its peak scales with
		// that target. The old floor (TIP_RANGE[0]) was set on the convoy, every car braking at cruise x 1000 / brakeMs; each
		// wagon's floor is that floor scaled by its own target against the convoy's. The upper bound stays.
		const atRest = land.at(-1).sample.brakes;
		const target = (decel) => Math.min(decel * tune.tip.gain, tune.tip.clamp);
		const convoy = target((motion.cruise * 1000) / motion.in.brakeMs);
		for (const e of stops) {
			const car = atRest.find((b) => b.lane * 1 + b.col * 4 === e.cell);
			e.decel = car ? Math.round((car.v * 1000) / car.b) : null;
			e.floor = car ? Math.round(TIP_RANGE[0] * (target(e.decel) / convoy) * 100) / 100 : TIP_RANGE[0];
			e.perTarget = car ? Math.round((e.max / target(e.decel)) * 100) / 100 : null;
		}
		T.check(stops.length === wagons.length && stops.every((e) => e.max >= e.floor && e.max <= TIP_RANGE[1]), `${S.name}: on the stop every wagon's tip dips ${stops.map((e) => `${e.max.toFixed(1)} (floor ${e.floor})`).join(', ')} road px (its floor from its own brake, at most ${TIP_RANGE[1]})`, stops);
		const ratios = stops.map((e) => e.perTarget).filter((x) => x !== null);
		T.check(ratios.length === stops.length && Math.max(...ratios) / Math.min(...ratios) <= 1.25, `${S.name}: each dip follows its car's deceleration (dip per spring target ${ratios.join(', ')}: within 25 percent of each other)`, stops.map((e) => ({ cell: e.cell, dip: e.max, decel: e.decel })));
		T.check(pulls.length >= wagons.length && pulls.every((e) => -e.min >= TIP_RANGE[0] && -e.min <= TIP_RANGE[1]), `${S.name}: on the pull-away every wagon's tip lifts ${pulls.map((e) => (-e.min).toFixed(1)).join(', ')} road px (in ${TIP_RANGE.join(' to ')})`, pulls);
		const bodyMax = Math.max(...stops.map((e) => e.body), ...pulls.map((e) => e.body));
		const ropeMax = Math.max(...stops.map((e) => e.rope), ...pulls.map((e) => e.rope));
		T.check(bodyMax > 0.3 && bodyMax <= BODY_MAX, `${S.name}: the body between the ropes moves at most ${bodyMax.toFixed(2)} road px (limit ${BODY_MAX})`);
		T.check(ropeMax === 0, `${S.name}: nothing under a rope ever moves (largest move ${ropeMax})`);
		const end = all[all.length - 1].sample;
		T.check(end.trees.every((t) => t.shown === t.carVisible) && end.stray === 0, `${S.name}: after the round only parked wagons carry a tree`);
		if (OUT) {
			// one wagon's stop and pull-away: the first parked wagon in the top lane (cell 0)
			const slot = land[land.length - 1].sample.trees.find((t) => t.cell === 0)?.slot;
			const md = [`# The wagon tree per frame (${S.vp.width}x${S.vp.height}, the board clock stepped at 60 Hz), the wagon parking in reel 1, row 1 (drives right)`, '', 'tip and body: the springs (road px; + = lag back, tip up). tip dy, body dy: the travel drawn at the tip and the largest between the ropes (road px, + = down). rope: the largest move under a rope.', ''];
			for (const [title, rows] of [['The stop (the board lands)', land], ['The pull-away (the next press)', pull]]) {
				md.push(`## ${title}`, '', '| frame | phase | car x | tip | tip dy | body | body dy | rope |', '|---:|---|---:|---:|---:|---:|---:|---:|');
				let started = false;
				for (const r of rows) {
					const t = r.sample.trees.find((x) => x.slot === slot);
					if (!t) continue;
					if (!started && Math.abs(t.tip) < 0.005 && Math.abs(t.body) < 0.005 && t.phase !== 'out') continue;
					started = true;
					md.push(`| ${r.i} | ${t.phase} | ${t.x} | ${t.tip} | ${t.tipDy} | ${t.body} | ${t.bodyDy} | ${t.ropeDy} |`);
					if (Math.abs(t.tip) < 0.01 && t.phase === 'rest' && md.length > 40) break;
				}
				md.push('');
			}
			writeFileSync(join(OUT, `tree_table_${S.name}.md`), md.join('\n'));
		}

		// 4. A COLUMN OVER WAGONS: they hide with their reel, trees and all
		const col = await stepRound(p, { book: book(COLUMN, [{ type: 'strike', target: 'santaSleigh', cell: 8, reel: 2 }, { type: 'columnWild', reel: 2, tier: 'santa', multiplier: 5, sticky: false }]), read: READ });
		const under = col.filter((r) => r.sample.trees.some((t) => (t.cell === 9 || t.cell === 10) && !t.carVisible));
		T.check(under.length > 10 && under.every((r) => r.sample.trees.filter((t) => t.cell === 9 || t.cell === 10).every((t) => t.shown === t.carVisible)), `${S.name}: under the column the two wagons' trees hide with them (${under.length} frames)`);
		T.check(col.every((r) => r.sample.stray === 0), `${S.name}: through the strike and the column no tree is left without its wagon`);
		await R(p, (b) => {
			window.__reindeer.setBoard(b);
			window.__reindeer.step(1, 1);
		}, LAND);
		await sleep(200);

		// 5. THE COST on a full board with three wagons, frozen
		const THREE = [['H2', 'L1', 'L3', 'H3'], ['L3', 'H4', 'H2', 'L5'], ['H1', 'L5', 'L4', 'L1'], ['L2', 'W', 'L3', 'H2'], ['L4', 'L1', 'L5', 'L2']];
		await R(p, (b) => {
			const h = window.__reindeer;
			h.clock(0);
			h.setBoard(b);
			h.step(1, 1);
		}, THREE);
		await sleep(300);
		const on = { calls: await drawCalls(p), sprites: await R(p, () => window.__reindeer.roadSprites()) };
		await R(p, () => {
			window.__reindeer.tune.wagonTree.on = false;
			window.__reindeer.step(0.001, 1);
		});
		await sleep(200);
		const off = { calls: await drawCalls(p), sprites: await R(p, () => window.__reindeer.roadSprites()) };
		await R(p, () => {
			window.__reindeer.tune.wagonTree.on = true;
			window.__reindeer.step(0.001, 1);
			window.__reindeer.clock(1);
		});
		const mem = await R(p, () => window.__reindeer.riderMemory());
		console.log(`  ${S.name} cost, a full board with three wagons: ${on.calls} draw calls per frame with the trees, ${off.calls} without; road sprites ${on.sprites.sprites} with, ${off.sprites.sprites} without (${on.sprites.shadows - off.sprites.shadows} more shadows); the tree sheet ${JSON.stringify(mem.wagonTree)}`);
		T.check(on.sprites.sprites - off.sprites.sprites > 0 && on.calls - off.calls <= 2, `${S.name}: three trees add ${on.sprites.sprites - off.sprites.sprites} sprites and ${Math.round((on.calls - off.calls) * 100) / 100} draw calls per frame`);
		T.check(!!mem.wagonTree && mem.wagonTree.mb < (S.phone ? 0.5 : 2.5), `${S.name}: the tree sheet ${mem.wagonTree?.w} x ${mem.wagonTree?.h}, ${mem.wagonTree?.mb} MB on the GPU${mem.wagonTree?.mips ? ' with its mips' : ''}`);
		T.check(errs.length === 0, `${S.name}: no page errors, no console errors`, errs);
		result[S.name] = { tune, stops, pulls, bodyMax, ropeMax, cost: { on, off }, mem, frames: all.length };
		await ctx.close();
	}
} finally {
	await browser.close();
}
console.log(`\n${T.pass} passed, ${T.fail} failed${T.fails.length ? '\n  ' + T.fails.join('\n  ') : ''}`);
if (OUT) writeFileSync(join(OUT, 'wagon_tree_probe.json'), JSON.stringify({ pass: T.pass, fail: T.fail, fails: T.fails, ...result }, null, 1));
process.exit(T.fail ? 1 : 0);
