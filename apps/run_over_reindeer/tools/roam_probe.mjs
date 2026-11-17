// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// THE ROAM PROBE (the roaming reindeer, 2026-11-17; game/road/roam.ts, constants STRIKE.roam and ROAM, game/roamPaths.ts).
// Per size (1440x900 desktop, 844x390 phone held sideways, 390x844 upright phone) it checks the owner's rules:
//   1  at rest one reindeer is on the screen, sniffing at a waypoint and walking the path (seeded: the same seed walks the
//      same way), his feet always on the path's line
//   2  the first strike of a spin is his, from where he stands; he stands alert until his run sets off, then he is gone
//      (no frame shows both or neither); its impact never lands later than the strike from off the screen, at 60, 30 and
//      20 Hz and at both turbo levels (the table of both times is printed: STRIKE TIMING)
//   3  a later strike of the spin comes from off the screen, and he does not come back for it
//   4  after the spin's last strike a new one walks in from past the screen's edge to the first waypoint
//   5  the default path's every waypoint and every segment (and the walk in) keep his body off the HUD, the LED strip,
//      the logo, the bonus round's counter plate and the top line, and his feet off the road; in every scene preset he
//      is drawn
//   7  a strike while the new one is still past the edge comes from off the screen (he gives way); a strike while he is
//      walking in on the screen is his, from where he is; a real spin with a strike is never longer with him than without
//   8  every fixture book (base and bonus): each spin (reveal to reveal) with strikes has exactly one first and one last
//   the editor: the staging panel's Reindeer path group shows the path, a waypoint drags (mouse; touch on the phones),
//      one is added and removed, and the read back is the live path as JSON
//   STRIKE.roam false: no roaming reindeer, and a spin's first strike is frame for frame the strike from off the screen
//   a hidden tab: nothing moves; no page errors anywhere
//
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3015 [ONLY=desktop|sideways|upright]
//     [OUT=<file.json>] node tools/roam_probe.mjs
// Uses the dev server that is already running. One headless browser (muted). Wrap each run in tools/browser_lock.sh.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3015';
const OUT = process.env.OUT || '';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SIZES = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, dpr: 1, q: '', touch: false },
	{ name: 'sideways', vp: { width: 844, height: 390 }, dpr: 2, q: '&tier=phone', touch: true },
	{ name: 'upright', vp: { width: 390, height: 844 }, dpr: 2, q: '&tier=phone', touch: true },
];
const PRESETS = ['snowDay', 'snowNight', 'snowSuper', 'grassDay', 'grassNight', 'grassSuper'];

let pass = 0;
let fail = 0;
const fails = [];
const report = { at: new Date().toISOString(), sizes: {} };
const check = (ok, msg, detail) => {
	if (ok) pass += 1;
	else {
		fail += 1;
		fails.push(msg);
	}
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 600)) : ''}`);
};
const r1 = (v) => Math.round(v * 10) / 10;
const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

async function boot(browser, S, extra = '') {
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.dpr, isMobile: S.touch, hasTouch: S.touch });
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=roam${S.name}${Date.now()}${S.q}${extra}`, { waitUntil: 'domcontentloaded' });
	let ready = false;
	for (let i = 0; i < 160; i++) {
		ready = await p
			.evaluate(() => {
				const h = window.__reindeer;
				return !!(h && h.atRest && h.atRest() && h.hud && document.querySelector('.hudp') && !document.querySelector('.landing') && h.roam && h.roam().ready && h.runMemory().loaded);
			})
			.catch(() => false);
		if (ready) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	for (let i = 0; i < 40; i++) {
		const st = await p.evaluate(() => ({ g: window.__reindeer.hud.gates(), idle: window.__reindeer.hud.idle(), rest: window.__reindeer.atRest() })).catch(() => null);
		if (st && st.g > 0) {
			await p.mouse.click(S.vp.width / 2, S.vp.height * 0.4).catch(() => {});
			await sleep(400);
			continue;
		}
		if (st && st.idle && st.rest) break;
		await sleep(250);
	}
	await sleep(800);
	return { ctx, p, errs, ready };
}

/** the default path's every point and segment against the zones (CSS px): his body (the widest of his clips, either
 *  facing) off every zone but the road, his feet (the bottom strip of his body) off the road */
const zoneCheck = (geo, zones) => {
	const { k, ox, oy } = geo.view;
	const s = geo.roam.scale * k;
	const B = geo.roam.box;
	let left = 0;
	let right = 0;
	let height = 0;
	for (const c of ['walk', 'start', 'stop', 'sniff']) {
		const b = B[c];
		const side = Math.max(b.anchorX, 1 - b.anchorX) * b.width;
		left = Math.max(left, side);
		right = Math.max(right, side);
		height = Math.max(height, b.anchorY * b.height);
	}
	const body = (x, y) => ({ x0: ox + (x - left * geo.roam.scale) * k, x1: ox + (x + right * geo.roam.scale) * k, y0: oy + (y - height * geo.roam.scale) * k, y1: oy + y * k });
	const feet = (x, y) => {
		const b = body(x, y);
		return { x0: b.x0, x1: b.x1, y0: b.y1 - (b.y1 - b.y0) * 0.06, y1: b.y1 };
	};
	const hits = [];
	const test = (x, y, where) => {
		for (const z of zones) {
			const a = z.name === 'road' ? inter(feet(x, y), z) : inter(body(x, y), z);
			if (a > 0.5) hits.push(`${where}: ${z.name} ${r1(a)} px2 at road (${r1(x)}, ${r1(y)})`);
		}
	};
	const pts = geo.roam.points;
	pts.forEach((p, i) => test(p.x, p.y, `waypoint ${i + 1}`));
	const seg = (a, b, where) => {
		const len = Math.hypot(b.x - a.x, b.y - a.y) * k;
		const n = Math.max(1, Math.ceil(len));
		for (let i = 0; i <= n; i++) test(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, where);
	};
	seg(geo.roam.enter, pts[0], 'walk in');
	for (let i = 0; i + 1 < pts.length; i++) seg(pts[i], pts[i + 1], `segment ${i + 1}-${i + 2}`);
	// every waypoint's body wholly on the screen
	const off = [];
	pts.forEach((p, i) => {
		const b = body(p.x, p.y);
		if (b.x0 < -0.5 || b.y0 < -0.5 || b.x1 > geo.vp.width + 0.5 || b.y1 > geo.vp.height + 0.5) off.push(`waypoint ${i + 1} ${JSON.stringify([b.x0, b.y0, b.x1, b.y1].map(r1))}`);
	});
	const unique = [...new Set(hits.map((h) => h.replace(/ at road.*$/, '').replace(/ [0-9.]+ px2/, '')))];
	return { hits, unique, off, bodyCss: { w: r1((left + right) * s), h: r1(height * s) } };
};

/** step the board clock frame by frame (frozen clock): the per frame log of the roamer and the runner */
const STEP_STRIKE = async (p, { cell, first, last, hz = 60, turbo = 0, roamOff = false, plain = false }) =>
	p.evaluate(
		async ({ cell, first, last, hz, turbo, roamOff, plain }) => {
			const h = window.__reindeer;
			const R = h.roadBoard();
			const F = R.features;
			h.turbo(turbo);
			h.clock(0);
			h.tune.strike.roam = !roamOff;
			const step = 1000 / hz;
			const rate = [1, 1.7, 2.5][turbo] ?? 1;
			// (the rate the dev hook steps with is the game's own: boardRate(); read it back from the road's features after a step)
			R.update(0.0001, 1, 1);
			const before = { state: F.roam.state, x: F.roam.x, y: F.roam.y, visible: F.roam.sprite.visible };
			let done = false;
			const pr = (plain ? h.strike(cell) : h.roamStrike(cell, { first, last })).then(() => (done = true));
			for (let i = 0; i < 50 && !F.snapshot().runner; i++) await new Promise((r) => setTimeout(r, 10));
			const rows = [];
			let t = 0;
			let impactAt = null;
			let firstRunner = null;
			for (let i = 0; i < 4000; i++) {
				h.step(step, 1);
				t += step;
				await Promise.resolve();
				const snap = F.snapshot();
				const r = snap.runner;
				const ro = snap.roam;
				const runVis = !!(r && r.phase !== 'wait' && F['runner'] && F['runner'].sprite.visible);
				rows.push({ t, phase: r ? r.phase : null, view: r ? r.view : null, stride: r ? r.stride : null, index: r ? r.index : null, x: r ? r.x : null, y: r ? r.y : null, mirrored: r ? r.mirrored : null, roamState: ro.state, roamVis: ro.visible, runVis, rx: ro.x, ry: ro.y });
				if (r && firstRunner === null) firstRunner = { roam: r.roam, pre: r.pre, todayMs: r.todayMs, waitMs: r.waitMs, impactMs: r.impactMs, startX: r.startX, startY: r.startY, poses: r.poses, elapsedMs: r.elapsedMs };
				if (r && r.phase === 'impact' && impactAt === null) impactAt = t;
				if (impactAt !== null && (!r || r.alpha <= 0)) break;
			}
			for (let i = 0; i < 20 && !done; i++) {
				h.step(50, 1);
				await new Promise((r) => setTimeout(r, 5));
			}
			await pr;
			const after = F.snapshot().roam;
			const rateNow = F.rate;
			h.turbo(0);
			return { rows, impactAt, firstRunner, before, after: { state: after.state, walkInAt: after.walkInAt }, rate: rateNow, rect: h.roamView()?.rect ?? null };
		},
		{ cell, first, last, hz, turbo, roamOff, plain },
	);

async function runSize(browser, S) {
	const out = { name: S.name };
	report.sizes[S.name] = out;
	const name = `${S.name} ${S.vp.width}x${S.vp.height}`;
	const { ctx, p, errs, ready } = await boot(browser, S);
	check(ready, `${name}: the game and the roaming reindeer's frames are ready`);
	if (!ready) {
		await ctx.close();
		return;
	}
	const H = (fn, arg) => p.evaluate(fn, arg);

	// ---- 1: at rest -------------------------------------------------------------------------------------------------
	const rest = await H(() => window.__reindeer.roam());
	out.rest = { state: rest.state, at: rest.at, x: rest.x, y: rest.y, kind: rest.kind, points: rest.points, enter: rest.enter };
	check(rest.on && rest.visible && rest.onScreen && ['idle', 'start', 'walk', 'stop'].includes(rest.state), `${name}: at rest one reindeer stands on the screen (${rest.state} at waypoint ${rest.at + 1})`, rest);
	const mem = await H(() => window.__reindeer.roamMemory());
	out.memory = mem;
	console.log(`  INFO ${name}: roam sheets ${mem.sheets.join(', ')} = ${mem.mb} MB (${mem.mipmapped ? `${mem.mbWithMips} MB with mips` : 'no mips'})`);

	// ---- 5: the zones -----------------------------------------------------------------------------------------------
	// the real counter plate (a bonus round's) measured too
	const zones = await H(async () => {
		const h = window.__reindeer;
		h.roundSign(true);
		await new Promise((r) => setTimeout(r, 300));
		const z = h.roamZones();
		h.roundSign(false);
		await new Promise((r) => setTimeout(r, 100));
		return z;
	});
	const geo = await H(() => ({ view: window.__reindeer.roamView(), roam: window.__reindeer.roam(), vp: { width: innerWidth, height: innerHeight } }));
	const zc = zoneCheck(geo, zones);
	out.zones = zones.map((z) => ({ name: z.name, box: [z.x0, z.y0, z.x1, z.y1].map(r1) }));
	out.body = zc.bodyCss;
	const names = new Set(zones.map((z) => z.name));
	check(['road', 'hud', 'LED strip', 'logo', 'counter plate', 'top line'].every((n) => names.has(n)), `${name}: every forbidden zone measured (${[...names].join(', ')})`);
	check(zc.hits.length === 0, `${name}: the default path (${geo.roam.points.length} waypoints, the walk in and every segment, sampled every CSS px) keeps his body off the HUD, LED strip, logo, counter plate and top line and his feet off the road`, zc.unique);
	check(zc.off.length === 0, `${name}: every waypoint's body is wholly on the screen`, zc.off);
	console.log(`  INFO ${name}: his body ${zc.bodyCss.w} x ${zc.bodyCss.h} CSS px; path ${JSON.stringify(geo.roam.points.map((q) => [r1(q.x), r1(q.y)]))} road px, walk in from ${JSON.stringify([r1(geo.roam.enter.x), r1(geo.roam.enter.y)])}`);

	// ---- 5: every scene preset ----------------------------------------------------------------------------------------
	const presets = [];
	for (const preset of PRESETS) {
		const r = await H(async (preset) => {
			const h = window.__reindeer;
			h.sceneWant(preset);
			for (let i = 0; i < 80; i++) {
				const s = h.sceneSwap();
				if (s && s.shown === preset && (!s.fade || s.fade.t === undefined || s.fade.done !== false)) break;
				await new Promise((r) => setTimeout(r, 100));
			}
			await new Promise((r) => setTimeout(r, 1500));
			const ro = h.roam();
			return { preset, shown: h.scene().preset, state: ro.state, visible: ro.visible, onScreen: ro.onScreen };
		}, preset);
		presets.push(r);
	}
	await H(() => window.__reindeer.sceneWant('snowDay'));
	out.presets = presets;
	check(presets.every((q) => q.visible && q.onScreen && q.state !== 'none'), `${name}: he is drawn on the screen in all six scene presets`, presets);

	// ---- 1: the wander, seeded --------------------------------------------------------------------------------------
	const wander = async () =>
		H(async () => {
			const h = window.__reindeer;
			const R = h.roadBoard();
			const F = R.features;
			h.clock(0);
			h.tune.strike.roam = true;
			h.roamReseed(4242);
			h.roamAt(0);
			const pts = h.roam().points;
			const trace = [];
			const states = new Set();
			const visited = new Set([0]);
			let offPath = 0;
			let worst = 0;
			for (let i = 0; i < 60 * 45; i++) {
				R.update(1000 / 60, 1, 1);
				const ro = F.roam;
				states.add(ro.state);
				if (ro.state === 'idle') visited.add(ro.at);
				// distance from the path's polyline
				let d = Infinity;
				for (let j = 0; j + 1 < pts.length; j++) {
					const a = pts[j];
					const b = pts[j + 1];
					const vx = b.x - a.x;
					const vy = b.y - a.y;
					const L = vx * vx + vy * vy;
					const u = L ? Math.max(0, Math.min(1, ((ro.x - a.x) * vx + (ro.y - a.y) * vy) / L)) : 0;
					d = Math.min(d, Math.hypot(a.x + vx * u - ro.x, a.y + vy * u - ro.y));
				}
				if (pts.length === 1) d = Math.hypot(pts[0].x - ro.x, pts[0].y - ro.y);
				worst = Math.max(worst, d);
				if (d > 0.6) offPath++;
				if (i % 6 === 0) trace.push([ro.state, Math.round(ro.x * 100) / 100, Math.round(ro.y * 100) / 100, ro.clip, Math.round(ro.frame * 100) / 100]);
			}
			return { trace, states: [...states], visited: [...visited], offPath, worst };
		});
	const w1 = await wander();
	const w2 = await wander();
	out.wander = { states: w1.states, visited: w1.visited, worst: w1.worst };
	check(w1.states.includes('idle') && w1.states.includes('walk') && w1.states.includes('start') && w1.states.includes('stop'), `${name}: in 45 s he sniffs at a waypoint and walks (start, walk, stop) to another (${w1.states.join(', ')})`, w1.states);
	check(w1.visited.length >= 2, `${name}: he wanders to ${w1.visited.length} different waypoints`, w1.visited);
	check(w1.offPath === 0, `${name}: his feet stay on the path's line (worst ${r1(w1.worst * 100) / 100} road px off)`, { offPath: w1.offPath, worst: w1.worst });
	// (the same choices, the same moments; positions to 0.1 road px: the board clock's own float sums differ in the last
	// digits between two runs that start at different clock values)
	const same = w1.trace.length === w2.trace.length && w1.trace.every((t, i) => t[0] === w2.trace[i][0] && t[3] === w2.trace[i][3] && Math.abs(t[1] - w2.trace[i][1]) < 0.1 && Math.abs(t[2] - w2.trace[i][2]) < 0.1 && Math.abs(t[4] - w2.trace[i][4]) < 0.1);
	check(same, `${name}: the same seed walks the same way (seeded, no Math.random): ${w1.trace.length} samples match`);

	// ---- 2 and 7: his strike against the one from off the screen, per rate --------------------------------------------
	const cells = [0, 8, 19];
	const timing = [];
	const wp = geo.roam.points.length;
	for (const cell of cells) {
		for (const [hz, turbo, label] of [
			[60, 0, '60 Hz'],
			[30, 0, '30 Hz'],
			[20, 0, '20 Hz'],
			[60, 1, '60 Hz turbo 1'],
			[60, 2, '60 Hz turbo 2'],
		]) {
			const at = (cell / 4 + hz) % wp;
			await H((i) => window.__reindeer.roamAt(i), Math.floor(at));
			const today = await STEP_STRIKE(p, { cell, hz, turbo, plain: true });
			await H((i) => window.__reindeer.roamAt(i), Math.floor(at));
			const mine = await STEP_STRIKE(p, { cell, first: true, last: false, hz, turbo });
			const fr = mine.firstRunner;
			timing.push({ cell, rate: label, waypoint: Math.floor(at) + 1, todayMs: today.impactAt, roamMs: mine.impactAt, waitMs: fr?.waitMs, pre: fr?.pre, roam: fr?.roam });
			const tag = `${name}: cell ${cell} (reel ${Math.floor(cell / 4) + 1}) at ${label}, from waypoint ${Math.floor(at) + 1}`;
			if (!fr?.roam) {
				check(false, `${tag}: the first strike is his`, fr);
				continue;
			}
			check(mine.impactAt !== null && today.impactAt !== null && mine.impactAt <= today.impactAt + 1e-6, `${tag}: his impact (${r1(mine.impactAt)} ms) is not later than the strike from off the screen (${r1(today.impactAt)} ms)`, { mine: mine.impactAt, today: today.impactAt, waitMs: fr.waitMs });
			if (hz === 60 && turbo === 0) {
				// he starts where he stood; alert until the set off; never both or neither once the run is on
				check(Math.abs(fr.startX - mine.before.x) < 0.02 && Math.abs(fr.startY - mine.before.y) < 0.02, `${tag}: his run starts from where he stood`, { start: [fr.startX, fr.startY], stood: [mine.before.x, mine.before.y] });
				const runRows = mine.rows.filter((r) => r.phase && r.phase !== 'wait');
				const waitRows = mine.rows.filter((r) => r.phase === 'wait');
				check(waitRows.every((r) => r.roamVis && r.roamState === 'alert'), `${tag}: he stands alert on the screen until his run sets off (${waitRows.length} frames)`);
				check(runRows.every((r) => !r.roamVis && r.roamState === 'none'), `${tag}: from the set off he is gone (the runner is him) and he does not come back`, runRows.filter((r) => r.roamVis).slice(0, 2));
				const order = [];
				for (const r of runRows) if (r.view && r.view !== order[order.length - 1]) order.push(r.view);
				check(/^R+SQ*MC*Q+$/.test(order.join('')) || /^RSQMCQ$/.test(order.join('')), `${tag}: his run is the strike's (views ${order.join('')})`);
				const firstC = runRows.find((r) => r.view === 'C');
				check(!firstC || firstC.stride === 7, `${tag}: the run down starts on pose 7 (${firstC?.stride})`);
			}
		}
	}
	out.timing = timing;
	console.log(`  STRIKE TIMING ${name} (ms from the strike's start to the impact frame; off screen = today):`);
	for (const t of timing) console.log(`    cell ${String(t.cell).padStart(2)} ${t.rate.padEnd(14)} wp ${t.waypoint}  today ${r1(t.todayMs)}  roam ${r1(t.roamMs)}  diff ${r1(t.roamMs - t.todayMs)}  wait ${r1(t.waitMs)}${t.pre ? `  run back out ${t.pre} poses` : ''}`);

	// ---- 3 and 4: a second strike from off the screen; the walk in after the last ------------------------------------
	await H(() => window.__reindeer.roamAt(0));
	const s1 = await STEP_STRIKE(p, { cell: 9, first: true, last: false });
	const s2 = await STEP_STRIKE(p, { cell: 14, first: false, last: true });
	const fr2 = s2.firstRunner;
	const rect = s2.rect;
	const offStart = fr2 && rect ? fr2.startX < rect.left || fr2.startX > rect.right : false;
	check(s1.firstRunner?.roam === true && fr2 && fr2.roam === false && offStart, `${name}: the spin's second strike comes from off the screen (starts at road x ${fr2 ? r1(fr2.startX) : '-'}, the screen is ${rect ? `${r1(rect.left)} to ${r1(rect.right)}` : '-'})`, fr2);
	check(s2.rows.every((r) => r.roamState === 'none' && !r.roamVis), `${name}: he does not come back during the second strike`);
	check(s2.after.walkInAt !== null, `${name}: after the spin's last strike a new one is due to walk in (in ${s2.after.walkInAt} ms)`, s2.after);
	const walkIn = await H(async () => {
		const h = window.__reindeer;
		const R = h.roadBoard();
		const F = R.features;
		const rect = h.roamView().rect;
		const log = [];
		let t = 0;
		let entered = null;
		let onAt = null;
		let arrived = null;
		const n0 = F.roam.counts.arrived;
		for (let i = 0; i < 60 * 40; i++) {
			R.update(1000 / 60, 1, 1);
			t += 1000 / 60;
			const ro = F.roam;
			if (ro.state === 'enter' && entered === null) entered = { t, x: ro.x, y: ro.y };
			if (ro.state === 'enter' && onAt === null && ro.standing()) onAt = t;
			if (ro.counts.arrived > n0) {
				arrived = { t, x: ro.x, y: ro.y, at: ro.at, state: ro.state };
				break;
			}
			if (i % 30 === 0) log.push([Math.round(t), ro.state, Math.round(ro.x), Math.round(ro.y)]);
		}
		return { entered, onAt, arrived, rect, wp0: h.roam().points[0], log: log.slice(0, 8) };
	});
	out.walkIn = walkIn;
	const enteredOff = walkIn.entered && (walkIn.entered.x < walkIn.rect.left || walkIn.entered.x > walkIn.rect.right);
	check(!!walkIn.entered && enteredOff, `${name}: the new one starts walking in from past the screen's edge (road x ${walkIn.entered ? r1(walkIn.entered.x) : '-'})`, walkIn);
	check(!!walkIn.arrived && walkIn.arrived.at === 0 && walkIn.arrived.state === 'idle' && Math.hypot(walkIn.arrived.x - walkIn.wp0.x, walkIn.arrived.y - walkIn.wp0.y) < 0.05, `${name}: he arrives at the first waypoint and sniffs (on the screen after ${walkIn.onAt ? r1(walkIn.onAt / 1000) : '-'} s, arrived after ${walkIn.arrived ? r1(walkIn.arrived.t / 1000) : '-'} s at the 1x board clock)`, walkIn);

	// ---- 7: a strike before he is on the screen, and one while he walks in on it ---------------------------------------
	const early = await H(async () => {
		const h = window.__reindeer;
		const R = h.roadBoard();
		const F = R.features;
		h.roamWalkIn(0);
		R.update(1000 / 60, 1, 1);
		R.update(1000 / 60, 1, 1);
		return { state: F.roam.state, standing: !!F.roam.standing(), x: F.roam.x };
	});
	const e1 = await STEP_STRIKE(p, { cell: 4, first: true, last: false });
	check(early.state === 'enter' && !early.standing && e1.firstRunner && e1.firstRunner.roam === false && e1.rows.every((r) => r.roamState === 'none'), `${name}: a spin's first strike while the new one is still past the edge comes from off the screen, and he gives way`, { early, runner: e1.firstRunner });
	const mid = await H(async () => {
		const h = window.__reindeer;
		const R = h.roadBoard();
		const F = R.features;
		h.roamWalkIn(0);
		for (let i = 0; i < 60 * 30 && !F.roam.standing(); i++) R.update(1000 / 60, 1, 1);
		for (let i = 0; i < 20; i++) R.update(1000 / 60, 1, 1);
		return { state: F.roam.state, standing: !!F.roam.standing(), x: F.roam.x, y: F.roam.y };
	});
	const e2 = await STEP_STRIKE(p, { cell: 4, first: true, last: false });
	check(mid.state === 'enter' && e2.firstRunner && e2.firstRunner.roam === true && Math.abs(e2.firstRunner.startX - mid.x) < 0.02, `${name}: a spin's first strike while he walks in on the screen is his, from where he is (road x ${r1(mid.x)})`, { mid, runner: e2.firstRunner });

	// ---- STRIKE.roam false: as before -------------------------------------------------------------------------------
	const off = await H(() => {
		const h = window.__reindeer;
		h.tune.strike.roam = false;
		h.roadBoard().update(1000 / 60, 1, 1);
		return h.roam();
	});
	check(off.state === 'none' && !off.visible, `${name}: STRIKE.roam false: no roaming reindeer on the screen`, off);
	const a = await STEP_STRIKE(p, { cell: 10, first: true, last: true, roamOff: true });
	const b = await STEP_STRIKE(p, { cell: 10, plain: true, roamOff: true });
	const strip = (rows) => rows.map((r) => [r.phase, r.view, r.stride, r.index, r.x, r.y, r.mirrored].join(','));
	check(JSON.stringify(strip(a.rows)) === JSON.stringify(strip(b.rows)) && a.impactAt === b.impactAt && a.firstRunner.roam === false, `${name}: STRIKE.roam false: a spin's first strike is frame for frame the strike from off the screen (${a.rows.length} frames, impact ${r1(a.impactAt)} ms)`);
	const stays = await H(() => {
		const h = window.__reindeer;
		const R = h.roadBoard();
		for (let i = 0; i < 60 * 5; i++) R.update(1000 / 60, 1, 1);
		const r = h.roam();
		h.tune.strike.roam = true;
		R.update(1000 / 60, 1, 1);
		const back = h.roam();
		return { off: [r.state, r.visible], back: [back.state, back.visible] };
	});
	check(stays.off[0] === 'none' && !stays.off[1], `${name}: STRIKE.roam false: no walk in after the last strike`, stays);
	check(stays.back[0] !== 'none' && stays.back[1], `${name}: STRIKE.roam back on: he stands on the screen again`, stays);

	// ---- a hidden tab: nothing moves ---------------------------------------------------------------------------------
	const hidden = await H(() => {
		const h = window.__reindeer;
		const R = h.roadBoard();
		const F = R.features;
		h.roamAt(0);
		for (let i = 0; i < 30; i++) R.update(1000 / 60, 1, 1);
		const a = [F.roam.x, F.roam.y, F.roam.frame, F.roam.state];
		Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
		for (let i = 0; i < 120; i++) R.update(1000 / 60, 1, 1);
		const b = [F.roam.x, F.roam.y, F.roam.frame, F.roam.state];
		delete document.hidden;
		return { a, b };
	});
	check(JSON.stringify(hidden.a) === JSON.stringify(hidden.b), `${name}: with the tab hidden he does not move (pauses)`, hidden);
	await H(() => window.__reindeer.clock(1));

	// ---- 7, 2, 3, 4 end to end: real spins (the fixture rounds), with him and without -----------------------------------
	const spin = async (book, roamOn) =>
		H(
			async ({ book, roamOn }) => {
				const h = window.__reindeer;
				h.tune.strike.roam = roamOn;
				h.clock(1);
				const F = h.roadBoard().features;
				if (roamOn) h.roamAt(0);
				await new Promise((r) => setTimeout(r, 300));
				h.fixtures.next(book);
				const seen = [];
				const t0 = performance.now();
				const c0 = F['clock'];
				h.hud.emit({ type: 'bet' });
				let last = null;
				let idle = false;
				for (let i = 0; i < 2400; i++) {
					await new Promise((r) => requestAnimationFrame(r));
					const r = F.runner;
					if (r && r !== last) {
						last = r;
						const end = r.times[r.times.length - 1];
						seen.push({ roam: r.roam, waitMs: Math.round(r.waitMs * 100) / 100, ownMs: Math.round(end * 100) / 100, todayMs: Math.round(r.todayMs * 100) / 100, at: Math.round(performance.now() - t0) });
					}
					if (i > 30 && h.hud.idle() && h.atRest()) {
						idle = true;
						break;
					}
				}
				const ms = Math.round(performance.now() - t0);
				// (the board clock too: a slow software renderer's frames longer than the ticker's cap run the game slower than
				// real time, so real time alone also measures the renderer)
				const boardMs = Math.round(F['clock'] - c0);
				// a moment more: the walk in begins (never waited on)
				await new Promise((r) => setTimeout(r, 1800));
				const ro = h.roam();
				h.tune.strike.roam = true;
				return { book, roamOn, ms, boardMs, idle, strikes: seen, roam: { state: ro.state, counts: ro.counts } };
			},
			{ book, roamOn },
		);
	const books = S.name === 'desktop' ? ['base_grandma_strike', 'base_two_columns'] : ['base_two_columns'];
	out.spins = [];
	for (const book of books) {
		// (one spin of the book first, not counted: it loads its column pictures, which makes the first spin longer)
		await spin(book, false);
		const on = await spin(book, true);
		const offS = await spin(book, false);
		out.spins.push(on, offS);
		check(on.idle && offS.idle, `${name}: ${book}: the round ends and the game is idle with him (${on.ms} ms) and without (${offS.ms} ms)`, { on, off: offS });
		check(on.strikes.length > 0 && on.strikes[0].roam === true && on.strikes.slice(1).every((q) => q.roam === false), `${name}: ${book}: the first of its ${on.strikes.length} strike(s) is his, the rest from off the screen`, on.strikes);
		// the strike is the only part he changes: its impact lands exactly when the strike from off the screen would (his wait
		// plus his own run equals its time from the set off); the whole spin's length is printed (real time on a software
		// renderer varies by seconds between two plays of the same book)
		check(on.strikes.every((q) => q.waitMs + q.ownMs <= q.todayMs + 0.01), `${name}: ${book}: in the live spin every strike lands no later than the strike from off the screen would (${on.strikes.map((q) => `${q.roam ? 'his' : 'off screen'} ${r1(q.waitMs + q.ownMs)} of ${r1(q.todayMs)} ms`).join(', ')})`, on.strikes);
		console.log(`  INFO ${name}: ${book}: the spin with him ${on.ms} ms (board clock ${on.boardMs}), without ${offS.ms} ms (board clock ${offS.boardMs})`);
		check(['enter', 'idle', 'start', 'walk', 'stop'].includes(on.roam.state), `${name}: ${book}: after the spin a new one walks in (${on.roam.state})`, on.roam);
	}

	// ---- 8: every fixture book, base and bonus: one first and one last strike per spin ---------------------------------
	if (S.name === 'desktop') {
		const order = await H(async () => {
			const { FIXTURE_ROUNDS } = await import('/src/fixtures/fixtureRgs.ts');
			const { strikePlace } = await import('/src/game/strikeOrder.ts');
			const bad = [];
			let spins = 0;
			let bonusSpins = 0;
			for (const r of FIXTURE_ROUNDS) {
				const ev = r.events;
				let seg = [];
				let free = false;
				const flush = () => {
					if (seg.length) {
						spins++;
						if (free) bonusSpins++;
						const places = seg.map((i) => strikePlace(ev, i));
						const firsts = places.filter((x) => x.first).length;
						const lasts = places.filter((x) => x.last).length;
						if (firsts !== 1 || lasts !== 1 || !places[0].first || !places[places.length - 1].last) bad.push(`${r.name}: ${JSON.stringify(places)}`);
					}
					seg = [];
				};
				ev.forEach((e, i) => {
					if (e.type === 'reveal') {
						flush();
						free = e.gameType === 'freegame';
					}
					if (e.type === 'strike') seg.push(i);
				});
				flush();
			}
			return { bad, spins, bonusSpins, books: FIXTURE_ROUNDS.length };
		});
		out.order = order;
		check(order.bad.length === 0 && order.bonusSpins > 0, `every fixture book (${order.books}): each of the ${order.spins} spins with strikes (${order.bonusSpins} of them free spins) has one first strike (his) and one last (the walk in after it)`, order.bad);
	}

	// ---- the editor (staging tune panel) ------------------------------------------------------------------------------
	await ctx.close();
	const ed = await boot(browser, S, '&tune=roam');
	const q = ed.p;
	const E = (fn, arg) => q.evaluate(fn, arg);
	// the panel docks on the side away from his path (it would cover the waypoints' handles)
	await E(() => {
		const side = window.__reindeer.roam().side;
		document.querySelector(`.ror-tune [aria-label="Dock ${side === 'right' ? 'left' : 'right'}"]`)?.click();
	});
	await sleep(200);
	await E(() => document.querySelector('[aria-label="Show the path over the game"]')?.click());
	await sleep(600);
	const ov = await E(() => ({ handles: [...document.querySelectorAll('[data-roam-wp]')].map((b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }), enter: !!document.querySelector('[data-roam-enter]'), zones: document.querySelectorAll('[data-roam-overlay] rect.zone').length, json: document.querySelector('[data-roam-json]')?.value ?? '', path: window.__reindeer.roam().points }));
	check(ov.handles.length === ov.path.length && ov.enter && ov.zones >= 5, `${name}: the editor shows the path over the game (${ov.handles.length} waypoints, the walk in, ${ov.zones} zones shaded)`, { handles: ov.handles.length, zones: ov.zones });
	let jsonOk = false;
	try {
		jsonOk = JSON.stringify(JSON.parse(ov.json)) === JSON.stringify(await E(() => window.__reindeer.roamPaths()));
	} catch {
		jsonOk = false;
	}
	check(jsonOk, `${name}: the read back is the live paths as JSON`);
	// drag waypoint 1 by (-24, +6) CSS px: mouse on the desktop, a finger on the phones; the panel hidden (the path stays)
	await E(() => document.querySelector('.ror-tune [aria-label="Collapse"]')?.click());
	await sleep(300);
	const h0 = await E(() => {
		const b = document.querySelector('[data-roam-wp="0"]')?.getBoundingClientRect();
		return b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : { x: 0, y: 0 };
	});
	const before = await E(() => JSON.parse(JSON.stringify(window.__reindeer.roam().points[0])));
	if (S.touch) {
		const cdp = await ed.ctx.newCDPSession(q);
		const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
		await t('touchStart', h0.x, h0.y);
		for (let i = 1; i <= 6; i++) await t('touchMove', h0.x - 4 * i, h0.y + i);
		await t('touchEnd', 0, 0);
	} else {
		await q.mouse.move(h0.x, h0.y);
		await q.mouse.down();
		for (let i = 1; i <= 6; i++) await q.mouse.move(h0.x - 4 * i, h0.y + i);
		await q.mouse.up();
	}
	await sleep(400);
	const moved = await E(() => ({ p: window.__reindeer.roam().points[0], k: window.__reindeer.roamView().k, paths: window.__reindeer.roamPaths(), kind: window.__reindeer.roamView().kind }));
	// the panel back open: its read back
	await E(() => document.querySelector('.ror-tune [aria-label="Open the tuning panel"]')?.click());
	await sleep(500);
	moved.json = await E(() => document.querySelector('[data-roam-json]')?.value ?? '');
	const dx = (moved.p.x - before.x) * moved.k;
	const dy = (moved.p.y - before.y) * moved.k;
	check(Math.abs(dx + 24) < 3 && Math.abs(dy - 6) < 3, `${name}: waypoint 1 drags with the ${S.touch ? 'finger' : 'mouse'} (moved ${r1(dx)}, ${r1(dy)} CSS px for -24, 6)`, { dx, dy });
	let readBack = null;
	try {
		readBack = JSON.parse(moved.json);
	} catch {}
	check(!!readBack && JSON.stringify(readBack[moved.kind].points[0]) === JSON.stringify(moved.paths[moved.kind].points[0]), `${name}: the read back follows the drag (${JSON.stringify(readBack?.[moved.kind]?.points?.[0])})`);
	const n0 = moved.paths[moved.kind].points.length;
	await E(() => [...document.querySelectorAll('.roam-ed button')].find((b) => b.textContent.startsWith('Add a waypoint'))?.click());
	await sleep(300);
	const n1 = await E(() => ({ live: window.__reindeer.roam().points.length, handles: document.querySelectorAll('[data-roam-wp]').length }));
	await E(() => [...document.querySelectorAll('.roam-ed button')].find((b) => b.textContent.startsWith('Remove waypoint'))?.click());
	await sleep(300);
	const n2 = await E(() => ({ live: window.__reindeer.roam().points.length, handles: document.querySelectorAll('[data-roam-wp]').length }));
	check(n1.live === n0 + 1 && n1.handles === n0 + 1 && n2.live === n0 && n2.handles === n0, `${name}: a waypoint is added (${n0} to ${n1.live}) and removed (back to ${n2.live}); he walks the new path`, { n0, n1, n2 });
	errs.push(...ed.errs);
	await ed.ctx.close();
	check(errs.length === 0, `${name}: no page errors`, errs.slice(0, 5));
}

const main = async () => {
	const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	try {
		for (const S of SIZES) {
			if (ONLY.length && !ONLY.includes(S.name)) continue;
			await runSize(browser, S);
		}
	} finally {
		await browser.close();
	}
	report.pass = pass;
	report.fail = fail;
	report.fails = fails;
	if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 1));
	console.log(`\nroam_probe: ${pass} pass, ${fail} fail`);
	for (const f of fails) console.log(`  FAIL ${f}`);
	process.exitCode = fail ? 1 : 0;
};
main();
