// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/components/Board.svelte;
// WATCHES: ; __reindeer.atRest, __reindeer.clock, __reindeer.crosshairStrike, __reindeer.crosshairTrace, __reindeer.runMemory, __reindeer.step
// WATCHES: ; __reindeer.turbo, CROSSHAIR, STRIKE.loadWaitMs, .landing
// THE CROSSHAIR PROBE (the target crosshair prototype, Corey 2026-11-15; constants CROSSHAIR): per-frame numbers for the
// crosshair of a strike on a posed board, from the running game with its board clock frozen and stepped one 60 Hz
// frame at a time (__reindeer.clock(0), step). Three cases: one candidate; four candidates across four reels; two
// candidates in the target's reel. For each case it logs per frame the time, the crosshair's centre and width, its
// state (hop, glide, locked, morph), the cell it is on or heading to, the candidates left, the reindeer's feet x and
// the other symbols' brightness, and checks:
//   - it is only ever on or heading to a candidate, and never to one after it has dropped
//   - locked on the true target by the turn (the reindeer's first S pose) at the latest, and on it until the crash
//   - every move is a glide of several frames (no jump), one candidate never moves
//   - at the crash it closes onto the red box (its width ends at the box's width) and goes
//   - the other symbols are dimmed while it is up and back to full after the crash
//   - the same posed board gives the same hops (the seed)
// Also: the four candidate case at turbo 1 and 2 and on the phone layouts (trace only), and no page errors.
// With OUT=<dir> it writes the tables (case_<n>_<size>.md / .json) and, with FRAMES=1, a 30 fps frame sequence per case
// at 1440x900 and 390x844 (then turned into mp4 by the caller with ffmpeg).
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 OUT=<dir> [FRAMES=1] [ONLY=a,b] \
//     node tools/crosshair_probe.mjs
// Uses the dev server that is already running (it never starts one). One headless browser, closed at the end. Take the
// shared browser lock around it (mkdir /tmp/hud_mock_shot.lock ... rmdir).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3014';
const OUT = process.env.OUT || '';
const FRAMES = process.env.FRAMES === '1';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
if (OUT) mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FRAME = 1000 / 60;
const BOX_W = 250 - 2 * 4; // a cell less the red box's inset, road px

const CASES = [
	{ id: 1, name: 'one candidate', cells: [9], kinds: ['H1'], target: 9 },
	{ id: 2, name: 'four candidates across four reels', cells: [1, 6, 13, 18], kinds: ['H1', 'W', 'W', 'H1'], target: 13 },
	{ id: 3, name: "two candidates in the target's reel", cells: [16, 18], kinds: ['W', 'H1'], target: 18 },
];
const SIZES = [
	{ name: 'desk1440x900', vp: { width: 1440, height: 900 }, dpr: 1, phone: false, frames: true, cases: [1, 2, 3] },
	{ name: 'portrait390x844', vp: { width: 390, height: 844 }, dpr: 2, phone: true, frames: true, cases: [1, 2, 3] },
	{ name: 'landscape844x390', vp: { width: 844, height: 390 }, dpr: 2, phone: true, frames: false, cases: [2, 3] },
	{ name: 'short390x620', vp: { width: 390, height: 620 }, dpr: 2, phone: true, frames: false, cases: [2] },
];

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
	await p.goto(`${APP}/?lang=en&sessionID=xh${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 200; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer && window.__reindeer.atRest && window.__reindeer.atRest() && window.__reindeer.crosshairStrike && !document.querySelector('.landing'))).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height * 0.3).catch(() => {});
		await sleep(600);
	}
	// the run views in (a strike waits for them at most STRIKE.loadWaitMs otherwise)
	for (let i = 0; i < 60 && !(await p.evaluate(() => window.__reindeer.runMemory().loaded)); i++) await sleep(500);
	await sleep(800);
	return { ctx, p, errs };
}

/** one strike, frame by frame: returns the trace rows, the plan and the frame count */
async function runCase(p, C, { turbo = 0, frameDir = '', tailMs = 900 } = {}) {
	// pose the board with the clock running first, so the case before's Wild has left
	await p.evaluate((c) => window.__reindeer.crosshairStrike({ cells: c.cells, kinds: c.kinds, target: c.target, poseOnly: true }), C);
	await sleep(500);
	await p.evaluate((t) => {
		window.__reindeer.turbo(t);
		window.__reindeer.clock(0);
	}, turbo);
	await p.evaluate((c) => {
		window.__xhDone = false;
		window.__reindeer.crosshairStrike({ cells: c.cells, kinds: c.kinds, target: c.target, follow: true }).then(() => (window.__xhDone = true));
	}, C);
	// the strike's own start waits (real time) for the run views: let it begin
	for (let i = 0; i < 40 && !(await p.evaluate(() => window.__reindeer.crosshairTrace().plan)); i++) await sleep(50);
	let shots = 0;
	let after = null;
	for (let f = 0; f < 1200; f++) {
		await p.evaluate((ms) => {
			window.__reindeer.step(ms, 1);
		}, FRAME);
		if (frameDir && f % 2 === 0) {
			await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
			await p.screenshot({ path: join(frameDir, `f${String(shots).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 88 });
			shots += 1;
		}
		const st = await p.evaluate(() => ({ live: window.__reindeer.crosshairTrace().live, done: window.__xhDone }));
		if (after === null && st.live === 'off') after = f;
		if (after !== null && (f - after) * FRAME > tailMs) break;
	}
	const tr = await p.evaluate(() => window.__reindeer.crosshairTrace());
	// the Wild may still be on its way in (real time waits): let it finish, then hand the clock back
	await p.evaluate(() => window.__reindeer.clock(1));
	for (let i = 0; i < 100 && !(await p.evaluate(() => window.__xhDone)); i++) await sleep(100);
	await p.evaluate(() => window.__reindeer.turbo(0));
	await sleep(300);
	return { ...tr, shots };
}

const table = (rows) => {
	const head = '| t ms | centre x | centre y | width | state | on | left | reindeer x | phase | others |\n|---:|---:|---:|---:|---|---:|---:|---:|---|---:|';
	return head + '\n' + rows.map((r) => `| ${r.t} | ${r.x} | ${r.y} | ${r.w} | ${r.state} | ${r.on} | ${r.left} | ${r.rx ?? ''} | ${r.phase ?? ''} | ${r.fade} |`).join('\n');
};

function judge(tag, C, tr, rate = 1) {
	const rows = tr.rows;
	const plan = tr.plan;
	check(rows.length > 10 && plan, `${tag}: traced (${rows.length} frames)`);
	if (!plan) return;
	const cells = new Set(plan.cells);
	check(plan.target === C.target && C.cells.every((c) => cells.has(c)) && plan.cells.length === C.cells.length, `${tag}: the candidates are the posed targets (${plan.cells.join(',')}), target ${plan.target}`);
	check(rows.every((r) => cells.has(r.on)), `${tag}: only ever on or heading to a candidate`);
	const late = rows.filter((r) => r.on !== plan.target && plan.dropAt[r.on] !== null && r.t > plan.dropAt[r.on] + 0.01 && (r.state === 'hop' || r.state === 'glide'));
	check(late.length === 0, `${tag}: never on or heading to a candidate after it dropped`, late.slice(0, 3));
	const lockRow = rows.find((r) => r.state === 'locked');
	check(!!lockRow && lockRow.t <= plan.turnAt + 0.01, `${tag}: locked on the target by the turn (locked at ${lockRow?.t} ms, the turn at ${plan.turnAt} ms, the run from ${plan.runAt} ms)`);
	const afterLock = rows.filter((r) => lockRow && r.t >= lockRow.t);
	check(afterLock.every((r) => r.on === plan.target && (r.state === 'locked' || r.state === 'morph')), `${tag}: on the target from the lock to the crash`);
	const turnRow = rows.find((r) => r.phase === 'turn');
	check(!turnRow || turnRow.state === 'locked', `${tag}: locked on the reindeer's first turn frame (${turnRow?.state} at ${turnRow?.t} ms)`);
	if (C.cells.length === 1) check(rows.every((r) => r.state === 'locked' || r.state === 'morph'), `${tag}: one candidate: locked the whole time, no hop`);
	else {
		// every glide takes several frames, and no frame jumps more than a glide's share
		const glides = [];
		let run = 0;
		for (const r of rows) {
			if (r.state === 'glide') run += 1;
			else if (run) {
				glides.push(run);
				run = 0;
			}
		}
		const hops = rows.filter((r, i) => i > 0 && r.state !== 'glide' && rows[i - 1].state === 'glide').length;
		check(glides.length >= 2 && Math.min(...glides) >= Math.floor(3 / rate), `${tag}: ${glides.length} glides, the shortest ${Math.min(...glides)} frames (at least ${Math.floor(3 / rate)})`);
		let jump = 0;
		for (let i = 1; i < rows.length; i++) if (rows[i].state === 'glide' || rows[i - 1].state === 'glide') jump = Math.max(jump, Math.hypot(rows[i].x - rows[i - 1].x, rows[i].y - rows[i - 1].y));
		// a glide's frames are fewer at turbo (it runs on the board clock), so the allowance grows with the rate
		check(jump < 260 * rate, `${tag}: the largest step in one frame ${Math.round(jump)} road px (at most ${Math.round(260 * rate)}; a reel is 250)`);
		check(hops >= 1, `${tag}: ${hops} hops landed`);
	}
	const morph = rows.filter((r) => r.state === 'morph');
	const last = morph[morph.length - 1];
	check(morph.length > 0 && Math.abs(last.w - BOX_W) < 3, `${tag}: at the crash it closes onto the red box (last width ${last?.w}, the box ${BOX_W})`);
	const up = rows.filter((r) => r.state === 'hop' || r.state === 'glide' || r.state === 'locked');
	const mid = up.filter((r) => r.t > 200);
	check(mid.length > 0 && mid.every((r) => Math.abs(r.fade - 0.6) < 0.02), `${tag}: the other symbols at 0.6 while it is up (after its fade in)`);
	check(rows[0].fade > 0.6, `${tag}: the fade eases in (first frame ${rows[0].fade})`);
}

(async () => {
	const browser = await chromium.launch();
	const summary = {};
	try {
		for (const S of SIZES) {
			if (ONLY.length && !ONLY.includes(S.name)) continue;
			const { ctx, p, errs } = await boot(browser, S);
			try {
				for (const id of S.cases) {
					const C = CASES.find((c) => c.id === id);
					const tag = `${S.name} case ${id} (${C.name})`;
					let frameDir = '';
					if (OUT && FRAMES && S.frames) {
						frameDir = join(OUT, `frames_case${id}_${S.name}`);
						mkdirSync(frameDir, { recursive: true });
					}
					const tr = await runCase(p, C, { frameDir });
					judge(tag, C, tr);
					summary[tag] = tr.plan;
					if (OUT) {
						writeFileSync(join(OUT, `case${id}_${S.name}.json`), JSON.stringify(tr, null, 1));
						writeFileSync(join(OUT, `case${id}_${S.name}.md`), `# Crosshair, case ${id}: ${C.name}, ${S.name}\n\nPosed cells ${C.cells.join(', ')} (${C.kinds.join(', ')}), target ${C.target}. One row per 60 Hz frame of the board clock (frozen and stepped). Road px. t from the crosshair's start; the reindeer sets off at ${tr.plan?.runAt} ms, turns at ${tr.plan?.turnAt} ms; locked at ${tr.plan?.lockAt} ms. Drops: ${JSON.stringify(tr.plan?.dropAt)}. Cells rested on, in order: ${tr.plan?.hops?.join(' ')}.\n\n${table(tr.rows)}\n`);
					}
				}
				if (S.name === 'desk1440x900') {
					// the seed: the same posed board gives the same hops
					const C = CASES[1];
					const a = await runCase(p, C, { tailMs: 100 });
					const b = await runCase(p, C, { tailMs: 100 });
					check(JSON.stringify(a.plan.hops) === JSON.stringify(b.plan.hops) && a.plan.hops.length > 2, `${S.name}: the same board, the same hops (${a.plan.hops.join(' ')})`);
					// turbo: the same plan on the road clock, so the lock still comes by the turn
					for (const level of [1, 2]) {
						const t = await runCase(p, C, { turbo: level, tailMs: 100 });
						const rate = level === 1 ? 1.7 : 2.6;
						judge(`${S.name} case 2 turbo ${level}`, C, t, rate);
						const frames = t.rows.filter((r) => r.state !== 'morph').length;
						const frames0 = a.rows.filter((r) => r.state !== 'morph').length;
						check(Math.abs(frames * rate - frames0) <= rate + 2, `${S.name} turbo ${level}: the crosshair's frames shorten with the run (${frames} frames against ${frames0} at turbo 0, rate ${rate})`);
						if (OUT) writeFileSync(join(OUT, `case2_${S.name}_turbo${level}.md`), `# Crosshair, case 2 at turbo ${level} (board clock rate ${rate}), ${S.name}\n\nEach row is one 60 Hz frame of real time (${(FRAME * rate).toFixed(2)} ms of the board clock). t in board clock ms.\n\n${table(t.rows)}\n`);
					}
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
	if (OUT) writeFileSync(join(OUT, 'plans.json'), JSON.stringify(summary, null, 1));
	console.log(`\ncrosshair_probe: ${pass} pass, ${fail} fail`);
	process.exit(fail ? 1 : 0);
})();
