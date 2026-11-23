// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,game/road/roadFeatures.ts};
// WATCHES: ; __reindeer.atRest, __reindeer.boardLayout, __reindeer.clock, __reindeer.planRun, __reindeer.road, __reindeer.runMemory
// WATCHES: ; __reindeer.step, __reindeer.strike, __reindeer.tune, ROUND, STRIKE
// THE STRIKE PROBE (the rig's run views, the middle path of 2026-11-12): per-frame numbers for the reindeer's strike.
//
// For each layout and each strike (both entry sides, reels 1, 3 and 5, the top and the bottom row) it freezes the
// board's clock and steps it one 60 Hz render frame at a time, logging per frame: the pose count, the view (R S Q M C),
// the stride pose, the feet x / y (road px), the draw scale and whether the picture is mirrored. Then it checks:
//   - poses shown in order, never one skipped (each frame the stride stays or goes +1 mod 16)
//   - S and M are exactly one pose each, the run down starts on pose 7, C never shows poses 3 to 6 (below 60 Hz the run
//     down may be absent only when the frame after M is the impact's: no frame was drawn that could show it)
//   - the first pose follows (7 - n) mod 16 with n counted in poses; the run ends on the target reel's centre
//   - ROUND 2 (2026-11-15, the run between the traffic): the run down (C) is on the gap at the edge of the target's
//     reel (the side he comes from, or the inner side for an outer reel), the last cut is Q poses running toward the
//     reel's centre (mirrored when that is against his way along the snow), and the time from the set off to the
//     impact is the straight path's (planStrike's keepMs; only an entry from the near side into an outer reel may run
//     longer, reported, not a fault: the game's own entry is 'far')
//   - the slide ratio on every grounded pose shown (body advance per pose against the rig's hoof sweep for that pose)
//   - BRAWL (2026-11-19, the Grandma Wild's brawl cloud, GRANDMA_BRAWL.strike): a Grandma car's strike (h.strike(cell,
//     true)) ends at the car's rear, (-160.5, -31.8) road px from its bottom centre, mirrored for a car facing left (rows
//     3 and 4), its last cut running the way the car faces from a run down `across` (125) road px behind it (kept on the
//     road); checked on the desktop for cars facing both ways, from both sides and at the board's two outer reels
// It also runs one strike at 120 Hz and at 30 Hz (no skipped pose, and how long it takes), checks the stage 2 rule
// (planRun from a fixed start pose: a unit-style scan of every distance), and reads the run views' GPU memory. With
// STRIP=<dir> it saves a 3x crop of every pose of one strike from each side on the desktop.
//
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [OUT=<file.json>] [STRIP=<dir>] \
//     node tools/strike_probe.mjs
// Uses the dev server that is already running (it never starts one). One headless browser, closed at the end. Take
// the shared browser lock around it (mkdir /tmp/hud_mock_shot.lock ... rmdir).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3014';
// (the report goes to the system's temporary folder unless OUT says where: never into the tracked tree, 2026-11-23)
const OUT = process.env.OUT || join(tmpdir(), 'strike_probe.json');
const STRIP = process.env.STRIP || '';
const K = 0.18465;
const BOARD_X = 142;
const LANE_TOP = 167;
const PITCH = 250;
/** the gap rule (game/road/roadFeatures.ts strikeGapX), written out again here */
const gapFor = (reel, side) => {
	let edge = side === 'left' ? reel : reel + 1;
	if (edge <= 0) edge = 1;
	if (edge >= 5) edge = 4;
	return BOARD_X + edge * PITCH;
};

// THE RIG'S HOOF SWEEP on the ground, frame px per pose, backward along each view's screen direction (measured from the
// export's frames: dark hoof blobs within 15 frame px of the view's ground line, tracked pose to pose, central difference)
const SWEEP = { R: { 1: 71.9 }, S: { 8: 135.1 }, Q: { 7: 17.8, 8: 118.1 }, M: { 7: 8.4, 8: 95.2 }, C: { 8: 70.2, 9: -8.2, 10: 3.2, 11: 18.0 } };

const LAYOUTS = [
	{ name: 'desktop 1920x1080', viewport: { width: 1920, height: 1080 }, dpr: 1, query: '', mobile: false },
	{ name: 'portrait phone 390x844', viewport: { width: 390, height: 844 }, dpr: 3, query: '&tier=phone', mobile: true },
	{ name: 'landscape phone 844x390', viewport: { width: 844, height: 390 }, dpr: 3, query: '&tier=phone', mobile: true },
];

const waitReady = async (page) => {
	for (let i = 0; i < 120; i++) {
		const ok = await page.evaluate(() => {
			const h = window.__reindeer;
			return !!(h && h.atRest && h.atRest() && h.runMemory && h.runMemory().loaded);
		});
		if (ok) return true;
		if (i % 10 === 9) await page.mouse.click(page.viewportSize().width / 2, page.viewportSize().height / 2).catch(() => {});
		await page.waitForTimeout(500);
	}
	return false;
};

/** one strike, stepped render frame by render frame at `hz`; returns the per-frame rows */
const runStrike = async (page, { cell, side, hz = 60, grandma = false }) =>
	page.evaluate(
		async ({ cell, side, hz, grandma }) => {
			const h = window.__reindeer;
			h.tune.strike.entry = side;
			h.clock(0);
			let done = false;
			const p = h.strike(cell, grandma).then(() => (done = true));
			for (let i = 0; i < 20 && !h.road().features.runner; i++) await new Promise((r) => setTimeout(r, 10));
			const step = 1000 / hz;
			// to half a frame before the end of the lead in, then one render frame at a time (mid-pose samples)
			h.step(h.tune.strike.leadInMs - step / 2, 1);
			const rows = [];
			let frames = 0;
			let impactFrame = null;
			for (let i = 0; i < 2000; i++) {
				h.step(step, 1);
				frames++;
				await Promise.resolve();
				const r = h.road().features.runner;
				if (!r) break;
				if (r.phase === 'wait') continue;
				if (r.phase === 'impact') {
					if (impactFrame === null) {
						impactFrame = frames;
						// the impact frame's own pose (a protected pose may be drawn on it)
						rows.push({ f: frames, impact: true, pose: r.pose, index: r.index, late: r.late, view: r.view, stride: r.stride, x: r.x, y: r.y, scale: r.scale, mirrored: r.mirrored, toX: r.toX, gapX: r.gapX, cutDir: r.cutDir, impactMs: r.impactMs, keepMs: r.keepMs, kept: r.kept, poses: r.poses, impactFeetY: r.impactFeetY, grandma: r.grandma, endX: r.endX, endY: r.endY });
					}
					if (r.alpha <= 0) break;
					continue;
				}
				rows.push({ f: frames, pose: r.pose, index: r.index, late: r.late, view: r.view, stride: r.stride, x: r.x, y: r.y, scale: r.scale, mirrored: r.mirrored, toX: r.toX, gapX: r.gapX, cutDir: r.cutDir, impactMs: r.impactMs, keepMs: r.keepMs, kept: r.kept, poses: r.poses, impactFeetY: r.impactFeetY, grandma: r.grandma, endX: r.endX, endY: r.endY });
			}
			for (let i = 0; i < 10 && !done; i++) {
				h.step(50, 1);
				await new Promise((r) => setTimeout(r, 5));
			}
			h.clock(1);
			await p;
			// road ms from the strike's call to the impact frame
			const lead = h.tune.strike.leadInMs - step / 2;
			// the set off: the lead in (the crosshair's when it is on, as h.strike runs it)
			const setOff = Math.max(h.tune.strike.leadInMs, h.tune.crosshair.on ? h.tune.crosshair.leadMs : 0);
			return { rows, impactFrame, impactMs: impactFrame === null ? null : lead + impactFrame * step, setOff, layout: h.boardLayout() };
		},
		{ cell, side, hz, grandma },
	);

/** BRAWL: where a Grandma car's strike ends and runs down (GRANDMA_BRAWL.strike, the clip's feet from the car) */
const LINES = [167.0, 331.5, 510.0, 687.0, 851.0];
const grandmaEnd = (cell) => {
	const reel = Math.floor(cell / 4);
	const row = cell % 4;
	const facing = row < 2 ? 1 : -1;
	const x = BOARD_X + reel * PITCH + PITCH / 2 + facing * -160.51242049681986;
	const y = LINES[row + 1] - 10 - 31.82347836230621;
	return { x, y, facing, gapX: Math.max(60, Math.min(1476, x - facing * 125)) };
};

const analyse = (rows, { side, cell, strict = true }) => {
	const issues = [];
	// per frame: the pose index never goes back; at 60 Hz (strict) it also never skips (stays or goes +1)
	let skips = 0;
	let back = 0;
	for (let k = 1; k < rows.length; k++) {
		const a = rows[k - 1].index;
		const b = rows[k].index;
		if (b < a) back++;
		if (b > a + 1) skips++;
		if (rows[k].stride !== ((rows[0].poses.firstStride - 1 + b) % 16) + 1) issues.push(`stride ${rows[k].stride} does not follow pose ${b}`);
	}
	if (back) issues.push(`${back} poses out of order`);
	if (strict && skips) issues.push(`${skips} skipped poses`);
	// per pose (the first frame that shows each pose index)
	const poses = [];
	for (const r of rows) {
		const idx = r.index;
		if (!poses.length || poses[poses.length - 1].idx !== idx) poses.push({ ...r, idx });
	}
	const order = poses.map((p) => p.view).join('');
	// (scene pass 9 fix, 2026-11-17) below 60 Hz the run down may be missing on one case only: the M pose was drawn
	// late and the very next drawn frame is already the impact's (the game's rule, roadFeatures.ts updateRunner: the
	// impact is on time, at the target, in the cut's view; a missed run down is not drawn late on the impact frame). No
	// frame was drawn on which the run down could have shown, so nothing was skipped that a screen at that rate could draw.
	const lastM = rows.map((r) => r.view).lastIndexOf('M');
	const noRoomForC = !strict && !rows.some((r) => r.view === 'C') && lastM >= 0 && !!rows[lastM + 1]?.impact;
	if (!(strict ? /^R+SQ+MC+Q+$/ : noRoomForC ? /^R*SQ*MQ+$/ : /^R*SQ*MC+Q+$/).test(order)) issues.push(`view order ${order}`);
	const count = (v) => poses.filter((p) => p.view === v).length;
	if (count('S') !== 1) issues.push(`S poses ${count('S')}`);
	if (count('M') !== 1) issues.push(`M poses ${count('M')}`);
	if (strict) for (let k = 1; k < poses.length; k++) if (poses[k].idx !== poses[k - 1].idx + 1) issues.push(`pose index ${poses[k - 1].idx} -> ${poses[k].idx}`);
	const firstC = poses.find((p) => p.view === 'C');
	if (!noRoomForC && (!firstC || firstC.stride !== 7 || firstC.idx !== rows[0].poses.along)) issues.push(`run down starts on pose ${firstC?.stride}`);
	// the protected poses' lateness (ms of the road clock behind their own time; 0 when drawn on time)
	const lateOf = (idx) => Math.max(0, ...rows.filter((r) => r.index === idx).slice(0, 1).map((r) => r.late ?? 0));
	const prot = { S: lateOf(rows[0].poses.side), M: lateOf(rows[0].poses.side + 1 + rows[0].poses.diagonal), C: lateOf(rows[0].poses.along), cut: lateOf(rows[0].poses.along + rows[0].poses.down) };
	const end = rows[rows.length - 1];
	const G = rows[0].grandma ? grandmaEnd(cell) : null;
	if (G) {
		if (Math.abs(end.x - G.x) > 0.01) issues.push(`ends ${end.x - G.x} off the car's rear`);
		if (end.y < G.y - 0.01) issues.push(`ends ${end.y - G.y} above the car's rear`);
		if (end.y > G.y + 0.01) issues.push(`(the cut cannot reach the car's rear: ends ${(end.y - G.y).toFixed(1)} road px lower)`);
	} else if (Math.abs(end.x - end.toX) > 0.01) issues.push(`ends ${end.x - end.toX} off the reel centre`);
	const lone = poses.filter((p) => p.view === 'C' && p.stride >= 3 && p.stride <= 6).length;
	if (lone) issues.push(`${lone} C poses on 3-6`);
	const P = rows[0].poses;
	const expectStart = ((((7 - P.along - 1) % 16) + 16) % 16) + 1;
	if (strict && poses[0].stride !== expectStart) issues.push(`first pose ${poses[0].stride}, the rule says ${expectStart}`);
	// THE GAP AND THE CUT: C straight down the gap; the cut (every pose from along + down on) in Q, mirrored by its own
	// way; everything before it mirrored by the entry side
	const P0 = rows[0].poses;
	const cutAt = P0.along + P0.down;
	const reel = Math.floor(cell / 4);
	const gap = G ? G.gapX : gapFor(reel, side);
	if (Math.abs(rows[0].gapX - gap) > 0.01) issues.push(`gap ${rows[0].gapX}, the rule says ${gap}`);
	if (rows.filter((r) => r.view === 'C').some((r) => Math.abs(r.x - gap) > 0.01)) issues.push('C off the gap');
	const cutDir = G ? G.facing : rows[0].toX >= gap ? 1 : -1;
	if (rows[0].cutDir !== cutDir) issues.push(`cut runs ${rows[0].cutDir}, should run ${cutDir}`);
	if (!rows.every((r) => r.mirrored === (r.index >= cutAt ? cutDir === -1 : side === 'right'))) issues.push('mirror flag wrong');
	if (rows.filter((r) => r.index >= cutAt).some((r) => r.view !== 'Q')) issues.push('the cut is not all Q');
	// the cut moves toward the reel's centre and down, steadily
	const cutRows = rows.filter((r) => r.index >= cutAt);
	for (let k = 1; k < cutRows.length; k++) if ((cutRows[k].x - cutRows[k - 1].x) * cutDir < -0.01 || cutRows[k].y < cutRows[k - 1].y - 0.01) issues.push(`the cut goes back at frame ${cutRows[k].f}`);
	// (a 60 Hz screen or faster shows the cut on two frames or more; a 20 or 30 Hz one may show only its protected pose)
	if (cutRows.length < (strict ? 2 : 1)) issues.push(`the cut shows on ${cutRows.length} frame(s)`);
	// body advance per pose: the feet's travel from one pose's first frame to the next (road px)
	const adv = [];
	for (let k = 1; k < poses.length; k++) {
		const a = poses[k - 1];
		const b = poses[k];
		const d = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1e-9, b.pose - a.pose);
		adv.push({ view: a.view, stride: a.stride, perPose: d, scale: a.scale });
	}
	// the slide ratio on grounded poses: advance per pose / (rig hoof sweep x road px per frame px x draw scale)
	const slide = adv
		.filter((a) => SWEEP[a.view]?.[a.stride] !== undefined)
		.map((a) => {
			const sweep = SWEEP[a.view][a.stride];
			const hoof = sweep * K * a.scale;
			return { view: a.view, stride: a.stride, bodyPerPose: +a.perPose.toFixed(2), hoofPerPose: +hoof.toFixed(2), ratio: sweep > 5 ? +(a.perPose / hoof).toFixed(2) : null };
		});
	return {
		cell,
		reel: Math.floor(cell / 4) + 1,
		row: (cell % 4) + 1,
		side,
		poses: P,
		order,
		strideSeq: poses.map((p) => p.stride).join(' '),
		sideStep: adv.find((a) => a.view === 'R')?.perPose ?? null,
		downStep: adv.filter((a) => a.view === 'C').map((a) => a.perPose)[0] ?? null,
		slide,
		turnTopFeetY: firstC ? firstC.y : null,
		late: prot,
		gapX: rows[0].gapX,
		cutFrames: cutRows.length,
		downFrames: rows.filter((r) => r.view === 'C').length,
		plannedMs: rows[0].impactMs,
		keepMs: rows[0].keepMs,
		kept: rows[0].kept,
		skipped: skips,
		noRoomForC,
		renderFrames: rows.length,
		issues,
	};
};

const main = async () => {
	const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const report = { at: new Date().toISOString(), sweep: SWEEP, layouts: [] };
	try {
		for (const L of LAYOUTS) {
			const ctx = await browser.newContext({ viewport: L.viewport, deviceScaleFactor: L.dpr, isMobile: L.mobile, hasTouch: L.mobile });
			const page = await ctx.newPage();
			const logs = [];
			page.on('console', (m) => {
				if (m.type() === 'warning' || m.type() === 'error') logs.push(m.text().slice(0, 200));
			});
			await page.goto(`${APP}/?lang=en&sessionID=strikeprobe${L.query}`, { waitUntil: 'domcontentloaded' });
			const ready = await waitReady(page);
			const memory = await page.evaluate(() => window.__reindeer?.runMemory?.());
			const out = { name: L.name, ready, memory, strikes: [], logs };
			if (ready) {
				out.kind = (await page.evaluate(() => window.__reindeer.boardLayout())).kind;
				for (const side of ['left', 'right'])
					for (const reel of [0, 2, 4])
						for (const row of [0, 3]) {
							const cell = reel * 4 + row;
							const r = await runStrike(page, { cell, side });
							const a = analyse(r.rows, { side, cell });
							a.impactMs = r.impactMs;
							// THE TIME KEPT: the impact frame is the first 60 Hz frame at or after the set off plus the plan's time,
							// and the plan's time is the straight path's (the old one) whenever the gap is on his side
							const due = r.setOff + a.plannedMs;
							if (!(r.impactMs >= due - 1e-6 && r.impactMs < due + 1000 / 60 + 1e-6)) a.issues.push(`impact at ${r.impactMs.toFixed(1)} ms, due ${due.toFixed(1)}`);
							const ownSide = gapFor(reel, side) === BOARD_X + (side === 'left' ? reel : reel + 1) * PITCH;
							if (ownSide && (!a.kept || Math.abs(a.plannedMs - a.keepMs) > 0.01)) a.issues.push(`time not kept: ${a.plannedMs} ms against the straight path's ${a.keepMs}`);
							a.ownSide = ownSide;
							a.rows = r.rows.map(({ f, pose, index, view, stride, x, y, scale, mirrored, late, impact }) => ({ f, pose, index, view, stride, x, y, scale, mirrored, late, impact }));
							out.strikes.push(a);
							// THE SAME STRIKE AT 30, 20 AND 120 Hz (the board's update stepped at that frame interval: the very
							// call the ticker makes each frame, with that frame's dt)
							a.rates = {};
							for (const hz of [30, 20, 120]) {
								const q = await runStrike(page, { cell, side, hz });
								const b = analyse(q.rows, { side, cell, strict: hz >= 60 });
								const frame = 1000 / hz;
								const dd = q.impactMs - r.impactMs;
								if (Math.abs(dd) > Math.max(frame, 1000 / 60) + 1e-6) b.issues.push(`duration ${q.impactMs.toFixed(1)} against ${r.impactMs.toFixed(1)} at 60 Hz`);
								for (const [k, v] of Object.entries(b.late)) if (v > 2 * frame) b.issues.push(`${k} drawn ${v.toFixed(1)} ms late`);
								a.rates[hz] = { impactMs: +q.impactMs.toFixed(2), diffMs: +dd.toFixed(2), frameMs: +frame.toFixed(2), late: b.late, skipped: b.skipped, order: b.order, noRoomForC: b.noRoomForC, issues: b.issues };
							}
						}
				// BRAWL: Grandma cars (their strike ends at the car's rear), on the desktop: facing right (row 2) and left (row 3)
				// in the middle reels, and the outer reels' rear sides (reel 1 facing right, reel 5 facing left), from both sides
				if (L.name.startsWith('desktop'))
					for (const side of ['left', 'right'])
						for (const cell of [5, 10, 1, 18]) {
							const r = await runStrike(page, { cell, side, grandma: true });
							const a = analyse(r.rows, { side, cell });
							a.grandma = true;
							a.impactMs = r.impactMs;
							const due = r.setOff + a.plannedMs;
							if (!(r.impactMs >= due - 1e-6 && r.impactMs < due + 1000 / 60 + 1e-6)) a.issues.push(`impact at ${r.impactMs.toFixed(1)} ms, due ${due.toFixed(1)}`);
							a.ownSide = false;
							a.rows = r.rows.map(({ f, pose, index, view, stride, x, y, scale, mirrored, late, impact }) => ({ f, pose, index, view, stride, x, y, scale, mirrored, late, impact }));
							out.strikes.push(a);
						}
				// the far side strike into the top row at the default entry ('far'): reel 5 comes from the left
				// one strike at 120 Hz and at 30 Hz: never a skipped pose; at 30 Hz the strike plays slower
				// THE STAGE 2 RULE: a fixed start pose (4), every distance 0 .. 1500 road px, this layout's diagonal
				out.stage2 = await page.evaluate(() => {
					const h = window.__reindeer;
					h.tune.strike.entry = 'far';
					const kind = h.boardLayout().kind;
					const diag = h.tune.strike.snow[kind].diagonal;
					const maxF = h.tune.strike.startFactorMax;
					const scan = (start, maxFactor = maxF) => {
						const bands = [];
						let worst = 0;
						let cur = null;
						let broken = 0;
						for (let d = 0; d <= 1500; d++) {
							const p = h.planRun(d, diag, start, maxFactor);
							if (p) {
								if (p.s0 !== start) broken++;
								worst = Math.max(worst, Math.abs(p.factor - 1));
							}
							const ok = !!p;
							if (!cur || cur.ok !== ok) {
								cur = { ok, from: d, to: d };
								bands.push(cur);
							} else cur.to = d;
						}
						return { start, maxFactor, worstFactor: +worst.toFixed(4), broken, unsolvable: bands.filter((b) => !b.ok).map((b) => [b.from, b.to]) };
					};
					// the smallest factor that solves every distance from `from` up, for a set of start poses
					const needed = (starts, from) => {
						let worst = 0;
						for (let d = from; d <= 1500; d++) {
							let best = Infinity;
							for (const s of starts) {
								const p = h.planRun(d, diag, s, 10);
								if (p) best = Math.min(best, Math.abs(p.factor - 1));
							}
							worst = Math.max(worst, best);
						}
						return +worst.toFixed(4);
					};
					const free = h.planRun(800, diag, null);
					// the second take-off pose that leaves the fewest unsolvable distances with pose 4
					let bestPair = null;
					for (let s2 = 1; s2 <= 16; s2++) {
						if (s2 === 4) continue;
						let bad = 0;
						for (let d = 0; d <= 1500; d++) if (!h.planRun(d, diag, 4) && !h.planRun(d, diag, s2)) bad++;
						if (!bestPair || bad < bestPair.bad) bestPair = { s2, bad };
					}
					const pairScan = (() => {
						const un = [];
						let cur = null;
						for (let d = 0; d <= 1500; d++) {
							const ok = !!h.planRun(d, diag, 4) || !!h.planRun(d, diag, bestPair.s2);
							if (!ok) {
								if (cur && cur[1] === d - 1) cur[1] = d;
								else un.push((cur = [d, d]));
							}
						}
						return un;
					})();
					return {
						kind,
						diagonal: diag,
						stepFree: free,
						pose4: scan(4),
						neededFactorPose4From400: needed([4], 400),
						neededFactorPose4From800: needed([4], 800),
						bestSecondPose: bestPair,
						pairUnsolvable: pairScan,
					};
				});
			}
			report.layouts.push(out);
			await ctx.close();
		}

		// THE REAL TICKER AT A LOW FRAME RATE: the page's requestAnimationFrame is replaced (before the game loads) by a
		// timer firing every 1000 / hz ms with real performance.now() stamps, so Pixi's ticker, and the board through it,
		// see genuinely slow frames (real wall time, real dt, rendering included). Desktop 1920x1080, six strikes a rate.
		report.real = [];
		for (const hz of [60, 30, 20, 120]) {
			const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
			await ctx.addInitScript((hz) => {
				const queue = new Map();
				let id = 0;
				window.requestAnimationFrame = (cb) => {
					queue.set(++id, cb);
					return id;
				};
				window.cancelAnimationFrame = (n) => queue.delete(n);
				window.__frames = 0;
				setInterval(() => {
					const t = performance.now();
					const due = [...queue.values()];
					queue.clear();
					for (const cb of due) {
						try {
							cb(t);
						} catch (e) {
							console.error(e);
						}
					}
					window.__frames++;
					window.__afterFrame?.(t);
				}, 1000 / hz);
			}, hz);
			const page = await ctx.newPage();
			await page.goto(`${APP}/?lang=en&sessionID=strikereal`, { waitUntil: 'domcontentloaded' });
			const ready = await waitReady(page);
			const runs = [];
			if (ready)
				for (const side of ['left', 'right'])
					for (const reel of [0, 2, 4]) {
						const cell = reel * 4;
						const run = await page.evaluate(
							async ({ cell, side }) => {
								const h = window.__reindeer;
								h.tune.strike.entry = side;
								h.clock(1);
								const rows = [];
								const t0 = performance.now();
								let impactAt = null;
								window.__afterFrame = (t) => {
									const r = h.road().features.runner;
									if (!r || r.phase === 'wait') return;
									if (r.phase === 'impact') {
										if (impactAt === null) {
											impactAt = t;
											rows.push({ t: t - t0, impact: true, pose: r.pose, index: r.index, late: r.late, view: r.view, stride: r.stride, x: r.x, y: r.y, toX: r.toX, gapX: r.gapX, cutDir: r.cutDir, impactMs: r.impactMs, keepMs: r.keepMs, kept: r.kept, mirrored: r.mirrored, poses: r.poses });
										}
										return;
									}
									rows.push({ t: t - t0, pose: r.pose, index: r.index, late: r.late, view: r.view, stride: r.stride, x: r.x, y: r.y, toX: r.toX, gapX: r.gapX, cutDir: r.cutDir, impactMs: r.impactMs, keepMs: r.keepMs, kept: r.kept, mirrored: r.mirrored, poses: r.poses });
								};
								await h.strike(cell);
								await new Promise((r) => setTimeout(r, 300));
								window.__afterFrame = null;
								const gaps = rows.slice(1).map((r, i) => r.t - rows[i].t);
								const setOff = Math.max(h.tune.strike.leadInMs, h.tune.crosshair.on ? h.tune.crosshair.leadMs : 0);
								return { rows, setOff, impactMs: impactAt === null ? null : impactAt - t0, worstGap: Math.max(...gaps), meanGap: gaps.reduce((a, b) => a + b, 0) / gaps.length };
							},
							{ cell, side },
						);
						const a = analyse(run.rows, { side, cell, strict: false });
						const P = run.rows[0].poses;
						// the time it should take: the lead in, the poses along the snow, the run down
						const want = run.setOff + run.rows[0].impactMs;
						runs.push({ side, reel: reel + 1, impactMs: +run.impactMs.toFixed(1), wantMs: +want.toFixed(1), diffMs: +(run.impactMs - want).toFixed(1), meanGap: +run.meanGap.toFixed(1), worstGap: +run.worstGap.toFixed(1), late: a.late, skipped: a.skipped, order: a.order, issues: a.issues });
					}
			report.real.push({ hz, ready, runs });
			await ctx.close();
		}

		if (STRIP) {
			// 3x crops of every pose of one strike from each side, desktop (rescap=3 so the canvas is really 3x)
			mkdirSync(STRIP, { recursive: true });
			const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 3 });
			const page = await ctx.newPage();
			await page.goto(`${APP}/?lang=en&sessionID=strikestrip&rescap=3`, { waitUntil: 'domcontentloaded' });
			report.strip = { ready: await waitReady(page), strikes: [] };
			for (const [side, cell] of [
				['left', 8],
				['right', 9],
			]) {
				await page.evaluate(
					async ({ side, cell }) => {
						const h = window.__reindeer;
						h.tune.strike.entry = side;
						h.clock(0);
						window.__stripPromise = h.strike(cell);
						for (let i = 0; i < 20 && !h.road().features.runner; i++) await new Promise((r) => setTimeout(r, 10));
						h.step(h.tune.strike.leadInMs, 1);
					},
					{ side, cell },
				);
				const shots = [];
				let lastIdx = -1;
				for (let i = 0; i < 400; i++) {
					const r = await page.evaluate(() => {
						window.__reindeer.step(1000 / 60, 1);
						return window.__reindeer.road().features.runner;
					});
					if (!r || r.phase === 'impact') break;
					const idx = r.index;
					if (idx === lastIdx) continue;
					lastIdx = idx;
					const lay = await page.evaluate(() => window.__reindeer.boardLayout());
					const cssPerRoad = lay.css.pitch / 250;
					const ox = lay.css.x - BOARD_X * cssPerRoad;
					const oy = lay.css.y - LANE_TOP * cssPerRoad;
					const fx = ox + r.x * cssPerRoad;
					const fy = oy + r.y * cssPerRoad;
					const W = 230;
					const H = 230;
					const clip = { x: Math.round(fx - W / 2), y: Math.round(fy - H + 30), width: W, height: H };
					if (clip.x < 0 || clip.x + W > 1920 || clip.y < 0) continue;
					await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
					const file = join(STRIP, `${side}_${String(idx).padStart(3, '0')}_${r.view}${r.stride}.png`);
					await page.screenshot({ path: file, clip });
					shots.push({ idx, view: r.view, stride: r.stride, x: r.x, y: r.y, scale: r.scale, mirrored: r.mirrored, file });
				}
				await page.evaluate(async () => {
					const h = window.__reindeer;
					for (let i = 0; i < 20; i++) h.step(50, 1);
					h.clock(1);
					await window.__stripPromise;
				});
				report.strip.strikes.push({ side, cell, shots });
			}
			await ctx.close();
		}
	} finally {
		await browser.close();
	}
	writeFileSync(OUT, JSON.stringify(report, null, 1));
	console.log(`report: ${OUT}`);
	for (const L of report.layouts) {
		console.log(`${L.name} (${L.kind}): ready ${L.ready}; run views ${JSON.stringify(L.memory)}`);
		for (const s of L.strikes) {
			const worst = Math.max(...s.slide.filter((x) => x.ratio !== null && x.view !== 'C').map((x) => x.ratio), 0);
			console.log(`  ${s.grandma ? "grandma " : ""}${s.side.padEnd(5)} reel ${s.reel} row ${s.row}: ${s.order} poses ${s.strideSeq} | side ${s.sideStep?.toFixed(2)}/pose, down ${s.downStep?.toFixed(2)}/pose | gap ${s.gapX} (${s.ownSide ? 'his side' : 'inner'}), down ${s.downFrames} frames, cut ${s.cutFrames} frames | worst grounded slide R/S/Q/M ${worst} | run ${s.plannedMs} ms, straight path ${s.keepMs} ms${s.kept ? ' (kept)' : ' (NOT kept)'} | impact ${Math.round(s.impactMs)} ms | ${s.issues.length ? 'ISSUES ' + s.issues.join('; ') : 'ok'}`);
		}
		console.log('  refresh:', JSON.stringify(L.refresh));
		console.log('  stage2:', JSON.stringify(L.stage2));
		if (L.logs.length) console.log('  console:', L.logs.slice(0, 5));
	}
	for (const L of report.layouts)
		for (const hz of [30, 20, 120]) {
			// (the Grandma strikes, BRAWL, are stepped at 60 Hz only: the rates' machinery is the same path, checked on the
			// centre strikes; they have no `rates` record)
			const xs = L.strikes.filter((st) => st.rates).map((st) => st.rates[hz]);
			if (!xs.length) continue;
			const bad = xs.filter((x) => x.issues.length);
			const lateMax = (k) => Math.max(...xs.map((x) => x.late[k])).toFixed(1);
			console.log(`${L.name} ${hz} Hz: ${xs.length} strikes, ${bad.length} with issues${bad.length ? ' ' + JSON.stringify(bad[0].issues) : ''}; duration diff ${Math.min(...xs.map((x) => x.diffMs)).toFixed(1)} .. ${Math.max(...xs.map((x) => x.diffMs)).toFixed(1)} ms; late S ${lateMax('S')} M ${lateMax('M')} C ${lateMax('C')} cut ${lateMax('cut')} ms; skipped up to ${Math.max(...xs.map((x) => x.skipped))}; no frame for the run down (M, then the impact's frame) ${xs.filter((x) => x.noRoomForC).length}`);
		}
	const all = report.layouts.flatMap((L) => L.strikes.flatMap((s) => [s.issues, ...Object.values(s.rates || {}).map((x) => x.issues)]));
	const realAll = (report.real || []).flatMap((R) => R.runs.map((x) => x.issues));
	const bad = [...all, ...realAll].filter((x) => x.length).length;
	console.log(`\nSTRIKES: ${all.length + realAll.length - bad} without issues, ${bad} with issues (stepped at 60, 30, 20 and 120 Hz, and the real ticker)`);
	// THE RESULT, legible (2026-11-20, the probe host: the probe printed timing rows only and exited 0 whatever it found):
	// one PASS / FAIL line per strike and rate with issues, a summary line, and exit 1 on any issue or a layout not ready
	for (const L of report.layouts) {
		if (!L.ready) console.log(`FAIL ${L.name}: the game was not ready`);
		for (const s of L.strikes) {
			const tag = `${L.name} ${s.grandma ? 'grandma ' : ''}${s.side} reel ${s.reel} row ${s.row}`;
			console.log(`${s.issues.length ? 'FAIL' : 'PASS'} ${tag} at 60 Hz${s.issues.length ? ': ' + s.issues.join('; ') : ''}`);
			for (const [hz, x] of Object.entries(s.rates || {})) if (x.issues.length) console.log(`FAIL ${tag} at ${hz} Hz: ${x.issues.join('; ')}`);
		}
	}
	for (const R of report.real || []) for (const x of R.runs) if (x.issues.length) console.log(`FAIL real ${R.hz} Hz ${x.side} reel ${x.reel}: ${x.issues.join('; ')}`);
	const notReady = report.layouts.filter((L) => !L.ready).length;
	console.log(`strike_probe: ${all.length + realAll.length - bad} pass, ${bad + notReady} fail`);
	if (bad + notReady) process.exitCode = 1;
	for (const R of report.real || []) console.log(`REAL ${R.hz} Hz ready ${R.ready}: ` + R.runs.map((x) => `${x.side[0]}${x.reel} ${x.impactMs}/${x.wantMs} (gap ${x.meanGap}/${x.worstGap}) late ${x.late.S.toFixed(0)}/${x.late.M.toFixed(0)}/${x.late.C.toFixed(0)}${x.issues.length ? ' ISSUES ' + x.issues.join(';') : ''}`).join(' | '));
	if (report.strip) console.log('strip:', report.strip.strikes.map((s) => `${s.side} ${s.shots.length} poses`).join(', '));
};

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
