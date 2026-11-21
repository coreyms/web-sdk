// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{game/road/signRig.ts,game/road/roadBoard.ts,game/road/winLights.ts,game/road/winLightsPath.ts,game/signRigSpec.ts};
// WATCHES: ; SIGN_WIN, SIGN_RIG, __reindeer.signs, __reindeer.signShow, __reindeer.fixtures, __reindeer.step, __reindeer.clock
// WATCHES: ; __reindeer.tune.signWin, __reindeer.roadSprites, __reindeer.setBoard, __reindeer.turbo, tools/sign_layers.py
// THE SIGN WIN PROBE (Corey 2026-11-19, the sign wins mock sign_wins_r1_2026-11-19 and his settings; constants SIGN_WIN,
// game/road/signRig.ts, tools/sign_layers.py). Posed books handed to the fixtures through the dev hook (presentation only,
// no math). At desktop 1440x900 and phone 390x844:
//   - THE ATLAS (in node and the page, no browser state): every reflector of every layout (the 10's option sets too) sits
//     on face colored pixels of its sign's plate frame, both tiers (a disc of its radius: within 60 levels of the face; the
//     10's white face: every channel over 200); the 10's border points (option b) on its black ring
//   - THE RIG: every sign on the board draws as its rig (its sprite draws nothing; the rig's root just after it in its
//     lane), none of the add layer's sprites shown at rest
//   - A FIVE SIGN LINE (10 J Q K A on lane 2, the mock's own view): each sign's show starts as the wire reaches it (left to
//     right), its light is up (the added layer), it rocks and its decorations swing; then everything back exactly at rest
//     (no rotation, no shake, no squash, no lit reflector, no flake, nothing added)
//     (since the strand, 2026-11-20: the cord's path runs over the line's support nail and round its end wraps; reachAt
//     reads the head's first pass of each symbol's x, so the order and the turbo window below hold unchanged)
//   - the same win at turbo 2 (its show over in holdShare of the time) and under a slam stop
//   - a board put up mid show (the skip to result's cut, a resumed round): every show and flake gone on that frame
//   - THE LANDING (hinged): a sign past its stop tips its plate, the whole sign stands upright
//   - THE IDLE: one sign's idle by hand, back to rest after it
//   - THE COST: the WebGL draw calls of a frozen frame mid glint with the signs' added layer shown and hidden
// With OUT=<dir>: frame strips of the five sign win (1x CSS and a 3x crop) and per-sign stills, for the review sheet.
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [OUT=<dir>] [ONLY=desktop,portrait] \
//     node tools/sign_win_probe.mjs
// Uses the dev server that is already running (it never starts one). One headless browser, muted, closed at the end.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const APPDIR = join(HERE, '..');
const APP = process.env.APP || 'http://localhost:3014';
const OUT = process.env.OUT || '';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
if (OUT) mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FRAME = 1000 / 60;
const SIZES = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, dpr: 3, phone: false, tier: 'full' },
	{ name: 'portrait', vp: { width: 390, height: 844 }, dpr: 3, phone: true, tier: 'phone' },
].filter((s) => !ONLY.length || ONLY.includes(s.name));

let pass = 0;
let fail = 0;
const fails = [];
const check = (ok, msg, detail) => {
	if (ok) pass += 1;
	else {
		fail += 1;
		fails.push(msg);
	}
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 900)) : ''}`);
};

// ---- the spec and the atlases, read from disk ----
const specSrc = readFileSync(join(APPDIR, 'src/game/signRigSpec.ts'), 'utf8');
const SPEC = JSON.parse(specSrc.slice(specSrc.indexOf('{'), specSrc.lastIndexOf('}') + 1));
const ATLAS = { full: JSON.parse(readFileSync(join(APPDIR, 'static/assets/symbols/symbols.json'), 'utf8')), phone: JSON.parse(readFileSync(join(APPDIR, 'static/assets/symbols/symbols-phone.json'), 'utf8')) };
const SIGNS = ['L5', 'L4', 'L3', 'L2', 'L1']; // 10 J Q K A, left to right (the mock's order)

const book = (board, wins) => {
	const total = wins.reduce((n, w) => n + w.win, 0);
	return [
		{ index: 0, type: 'reveal', gameType: 'basegame', board },
		{ index: 1, type: 'winInfo', totalWin: total, wins },
		{ index: 2, type: 'setTotalWin', amount: total },
		{ index: 3, type: 'finalWin', amount: total },
	];
};
// lane 2 (row 1, driving left to right as the mock's lane): 10 J Q K A; cars elsewhere
const FIVE_BOARD = SIGNS.map((code, reel) => ['H2', code, ['H3', 'H4', 'H1', 'H3', 'H4'][reel], 'H4']);
const FIVE = book(FIVE_BOARD, [{ symbol: 'L1', kind: 5, line: 2, win: 100, multiplier: 1, cells: [1, 5, 9, 13, 17] }]);

const DRAW_COUNTER = () => {
	window.__dc = { calls: 0, frames: 0 };
	for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
		if (!C) continue;
		for (const fn of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
			const orig = C.prototype[fn];
			if (!orig) continue;
			C.prototype[fn] = function (...a) {
				window.__dc.calls += 1;
				return orig.apply(this, a);
			};
		}
	}
	const tick = () => {
		window.__dc.frames += 1;
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
};

async function boot(browser, S) {
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.dpr, isMobile: S.phone, hasTouch: S.phone });
	await ctx.addInitScript(DRAW_COUNTER);
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=signs${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 160; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && !document.querySelector('.landing'))).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	await sleep(500);
	// no idle of its own during the measured cases (the idle case asks for one by hand)
	await p.evaluate(() => (window.__reindeer.tune.signWin.idle = 'off'));
	return { ctx, p, errs };
}
const R = (p, fn, arg) => p.evaluate(fn, arg);

/** every sign rig at rest: no turn, no shake, no squash, no lit reflector, no flake, nothing added */
const atRest = (snap) => {
	const bad = [];
	for (const s of snap.signs) {
		const r = s.rig;
		if (!r) {
			bad.push({ cell: s.cell, why: 'no rig' });
			continue;
		}
		const off = Math.abs(r.rootRot) > 1e-9 || Math.abs(r.plateRot) > 1e-9 || Math.abs(r.plateDx) > 1e-9 || Math.abs(r.snowRot) > 1e-9 || Math.abs(r.snowSy - 1) > 1e-9 || r.decoRot.some((d) => Math.abs(d) > 1e-9) || r.dotsLit || r.fxShown || r.flakes || r.flakesShown || r.win || r.idle;
		if (off) bad.push({ cell: s.cell, symbol: s.symbol, ...r });
	}
	if (snap.fxShown) bad.push({ fxLayerShown: snap.fxShown });
	return bad;
};

/** the board's lane 2 on the page (CSS px): the five signs' box, from a little above the lane to its lower line */
const laneClip = (p) =>
	R(p, () => {
		const L = window.__reindeer.boardLayout();
		const k = L.css.pitch / 250;
		const laneH = L.css.height / 4;
		const x = Math.max(0, L.css.x - 40 * k);
		const y = Math.max(0, L.css.y + laneH * 0.35);
		return { x, y, width: Math.min(window.innerWidth - x, L.css.width + 80 * k), height: laneH * 1.75, k };
	});

/** a spin of a posed book, the clock frozen once the lanes stop and stepped to the frame the lines show */
async function spinTo(p, bookEvents, turbo = 0) {
	await R(p, ({ book, turbo }) => {
		const h = window.__reindeer;
		h.clock(1);
		h.turbo(turbo);
		h.roadSounds(true);
		h.fixtures.queue(book, 1.5);
	}, { book: bookEvents, turbo });
	await p.click('.hudp button.spin');
	for (let i = 0; i < 800; i++) {
		if (await R(p, () => window.__reindeer.road().lanesStopped.every(Boolean) && window.__reindeer.road().atRest)) break;
		await sleep(10);
	}
	await R(p, () => window.__reindeer.clock(0));
	for (let i = 0; i < 1500; i++) {
		if (await R(p, (ms) => (window.__reindeer.roadSounds().some((e) => e.what === 'lines') ? true : (window.__reindeer.step(ms, 1), false)), FRAME)) break;
		await sleep(0);
	}
}
/** wait (real time, the clock running) until no sign show is left (a landing's tail runs 3.5 s of board time) */
async function settle(p, ms = 6000) {
	await R(p, () => window.__reindeer.clock(1));
	for (let t = 0; t < ms; t += 200) {
		if (atRest(await R(p, () => window.__reindeer.signs())).length === 0) return true;
		await sleep(200);
	}
	return false;
}
async function finish(p) {
	await R(p, () => window.__reindeer.clock(1));
	for (let i = 0; i < 200; i++) {
		if (await R(p, () => window.__reindeer.atRest() && window.__reindeer.hud.idle())) break;
		await sleep(150);
	}
	await sleep(400);
	await R(p, () => window.__reindeer.turbo(0));
}

async function run(browser, S) {
	const { ctx, p, errs } = await boot(browser, S);
	const tag = S.name;
	try {
		// ---- the dots on the face (the page decodes the atlas) ----
		const atlasUrl = `${APP}/assets/symbols/${S.tier === 'full' ? 'symbols' : 'symbols-phone'}.webp`;
		const jobs = [];
		for (const code of SIGNS) {
			const sp = SPEC.signs[code];
			const fr = ATLAS[S.tier].frames[`${code}_plate`].frame;
			const box = sp.frames[S.tier].plate;
			const kx = fr.w / box[2];
			const ky = fr.h / box[3];
			for (const [lay, d] of Object.entries(sp.dots)) {
				// (the 'ring' layout follows the K's reflective band and the 10's rim by design: not the face; 'sparse', six big
				// reflectors placed for size 1, reaches past its clearance at Corey's size 1.25: neither is in use)
				if (lay === 'ring' || lay === 'sparse') continue;
				const r = lay === 'band' ? 0.3 : d.r * 1.25; // the drawn lens's radius (SIGN_WIN.glint.size)
				for (const [x, y] of d.pts) jobs.push({ code, lay, x: fr.x + (x - box[0]) * kx, y: fr.y + (y - box[1]) * ky, r: Math.max(0.6, r * kx), face: sp.face, white: code === 'L5' });
			}
		}
		const bad = await R(p, async ({ url, jobs }) => {
			const img = await createImageBitmap(await (await fetch(url)).blob());
			const c = new OffscreenCanvas(img.width, img.height);
			const g = c.getContext('2d');
			g.drawImage(img, 0, 0);
			const D = g.getImageData(0, 0, img.width, img.height).data;
			const out = [];
			for (const j of jobs) {
				let worst = 0;
				for (let dy = -Math.ceil(j.r); dy <= Math.ceil(j.r); dy++)
					for (let dx = -Math.ceil(j.r); dx <= Math.ceil(j.r); dx++) {
						if (dx * dx + dy * dy > j.r * j.r) continue;
						const i = (Math.round(j.y + dy) * img.width + Math.round(j.x + dx)) * 4;
						const px = [D[i], D[i + 1], D[i + 2], D[i + 3]];
						let d;
						if (j.lay === 'band') d = Math.max(px[0], px[1], px[2]) > 110 ? 999 : 0;
						else if (j.white) d = px[3] < 250 ? 999 : Math.max(0, 200 - Math.min(px[0], px[1], px[2]));
						else d = px[3] < 250 ? 999 : Math.hypot(px[0] - j.face[0], px[1] - j.face[1], px[2] - j.face[2]) > 60 ? 999 : 0;
						worst = Math.max(worst, d);
					}
				if (worst > 0) out.push({ code: j.code, lay: j.lay, x: Math.round(j.x), y: Math.round(j.y), worst });
			}
			return out;
		}, { url: atlasUrl, jobs });
		const byLay = {};
		for (const b of bad) byLay[`${b.code}:${b.lay}`] = (byLay[`${b.code}:${b.lay}`] ?? 0) + 1;
		check(bad.length === 0, `${tag}: all ${jobs.length} reflector points (the honeycomb field in use, the 10's option sets) sit on their face's own color (the border points on the black ring), ${S.tier} atlas`, { byLay, first: bad.slice(0, 6) });

		// ---- the rig on the board at rest ----
		await R(p, (b) => {
			window.__reindeer.setBoard(b);
			window.__reindeer.step(16, 2);
		}, FIVE_BOARD);
		let snap = await R(p, () => window.__reindeer.signs());
		const signs = snap.signs.filter((s) => s.phase === 'rest');
		check(signs.length === 5 && signs.every((s) => s.rig?.ok && s.rig.shown && !s.spriteDraws && s.layered), `${tag}: the five signs draw as their rigs (the sprite draws nothing, the rig just after it in its lane)`, signs.map((s) => ({ cell: s.cell, ok: s.rig?.ok, shown: s.rig?.shown, draws: s.spriteDraws, layered: s.layered })));
		check(snap.lanesBelowFx && atRest(snap).length === 0, `${tag}: at rest nothing turns and nothing is added (the add layer over every lane)`, atRest(snap));
		const ten = signs.find((s) => s.symbol === 'L5');
		check(!!ten && ten.rig.layout === (snap.ten === 'off' ? 'field' : snap.ten === 'c' ? 'denseBig' : 'dense'), `${tag}: the 10 shows its own look (SIGN_WIN.ten ${snap.ten}: ${ten?.rig.layout}, ${ten?.rig.dots} reflectors, ${ten?.rig.dotsAtRest} drawn at rest)`, ten);

		// ---- THE FIVE SIGN LINE ----
		await spinTo(p, FIVE);
		snap = await R(p, () => window.__reindeer.signs());
		const reach = snap.signs.filter((s) => s.winning).sort((a, b) => a.cell - b.cell).map((s) => s.reach[0]);
		check(reach.length === 5 && reach.every((v, i) => i === 0 || v > reach[i - 1]), `${tag}: each sign goes off as the wire reaches it, left to right (${reach.map((v) => Math.round(v)).join(', ')} ms into the win)`, reach);
		const rows = [];
		const clip = await laneClip(p);
		const SHOTS = new Set([0, 100, 200, 300, 400, 500, 600, 800, 1000, 1300, 1700]);
		let fxMax = 0;
		let rotMax = 0;
		let decoMax = 0;
		let flakesMax = 0;
		const started = new Set();
		let dcMid = null;
		for (let i = 0; i <= 200; i++) {
			const ms = Math.round(i * FRAME);
			const s = await R(p, () => window.__reindeer.signs());
			for (const g of s.signs) {
				if (!g.rig) continue;
				if (g.rig.win) started.add(g.cell);
				rotMax = Math.max(rotMax, Math.abs(g.rig.rootRot));
				decoMax = Math.max(decoMax, ...g.rig.decoRot.map(Math.abs), 0);
				flakesMax = Math.max(flakesMax, g.rig.flakes);
			}
			fxMax = Math.max(fxMax, s.fxShown);
			rows.push({ ms, fx: s.fxShown, lit: s.signs.map((g) => g.rig?.dotsLit ?? 0) });
			// THE COST, once mid glint: the same frozen frame with the signs' added layer and without
			if (!dcMid && s.fxShown >= 3) {
				const calls = async () =>
					R(p, async () => {
						const b = { ...window.__dc };
						await new Promise((r) => setTimeout(r, 600));
						return Math.round(((window.__dc.calls - b.calls) / Math.max(1, window.__dc.frames - b.frames)) * 100) / 100;
					});
				const on = await calls();
				const sprites = await R(p, () => window.__reindeer.roadSprites());
				await R(p, () => (window.__reindeer.roadBoard().signFxLayer.visible = false));
				const off = await calls();
				await R(p, () => (window.__reindeer.roadBoard().signFxLayer.visible = true));
				dcMid = { on, off, sprites: sprites.sprites, fx: s.fxShown };
			}
			if (OUT && SHOTS.has(ms)) await p.screenshot({ path: join(OUT, `game_${tag}_five_${String(ms).padStart(4, '0')}.png`), clip });
			if (OUT && i === 0) writeFileSync(join(OUT, `game_${tag}_clip.json`), JSON.stringify(clip));
			await R(p, (ms) => window.__reindeer.step(ms, 1), FRAME);
		}
		check(started.size === 5, `${tag}: all five signs played their win (${[...started].join(', ')})`);
		check(fxMax > 0 && rotMax > 0.02 && decoMax > 0.05 && flakesMax > 0, `${tag}: the light was added (up to ${fxMax} sprites), the signs rocked (${(rotMax * 57.3).toFixed(2)} deg), the decorations swung (${(decoMax * 57.3).toFixed(2)} deg), flakes fell (${flakesMax})`);
		if (dcMid) {
			console.log(`  ${tag} cost mid glint: ${dcMid.on} draw calls per frame with the signs' light, ${dcMid.off} without; ${dcMid.fx} added sprites shown; road sprites ${dcMid.sprites}`);
			check(dcMid.on - dcMid.off <= 1.01, `${tag}: the five signs' light costs ${Math.round((dcMid.on - dcMid.off) * 100) / 100} draw call(s) per frame (one added layer)`, dcMid);
		}
		if (OUT) writeFileSync(join(OUT, `game_${tag}_five_rows.json`), JSON.stringify(rows));
		await finish(p);
		await settle(p);
		snap = await R(p, () => window.__reindeer.signs());
		check(atRest(snap).length === 0, `${tag}: after the win every sign is back exactly at rest, nothing lit, no flake`, atRest(snap));

		// ---- turbo 2: the show takes holdShare of the time ----
		await spinTo(p, FIVE, 2);
		let doneAt = null;
		for (let i = 0; i <= 200; i++) {
			const s = await R(p, () => window.__reindeer.signs());
			if (i > 2 && s.signs.every((g) => !g.rig?.win)) {
				doneAt = i * FRAME;
				break;
			}
			await R(p, (ms) => window.__reindeer.step(ms, 1), FRAME);
		}
		const lastReach = Math.max(...reach) * 0.35;
		check(doneAt !== null && doneAt <= lastReach + 2000 * 0.35 + 60 && doneAt >= 2000 * 0.35 - 60, `${tag}: at turbo 2 the shows are over ${Math.round(doneAt ?? -1)} ms into the win (show 2000 x 0.35 after the last reach)`, { doneAt, lastReach });
		await finish(p);
		await settle(p);
		check(atRest(await R(p, () => window.__reindeer.signs())).length === 0, `${tag}: turbo 2: back at rest`, atRest(await R(p, () => window.__reindeer.signs())));

		// ---- a slam stop during the win ----
		await spinTo(p, FIVE);
		for (let i = 0; i < 20; i++) await R(p, (ms) => window.__reindeer.step(ms, 1), FRAME);
		await R(p, () => window.__reindeer.clock(1));
		await p.click('.hudp button.spin').catch(() => {});
		await finish(p);
		await settle(p);
		check(atRest(await R(p, () => window.__reindeer.signs())).length === 0, `${tag}: after a slam stop during the win: back at rest, no flake, nothing added`, atRest(await R(p, () => window.__reindeer.signs())));

		// ---- a board put up mid show (the skip's cut, a resume) ----
		await spinTo(p, FIVE);
		for (let i = 0; i < 25; i++) await R(p, (ms) => window.__reindeer.step(ms, 1), FRAME);
		const mid = await R(p, () => window.__reindeer.signs());
		await R(p, (b) => {
			window.__reindeer.setBoard(b);
			window.__reindeer.step(1, 1);
		}, FIVE_BOARD);
		const cut = await R(p, () => window.__reindeer.signs());
		check(mid.signs.some((g) => g.rig?.win) && atRest(cut).length === 0, `${tag}: a board put up mid show (the skip to result's cut) stops every show on that frame`, atRest(cut));
		await finish(p);

		// ---- the landing (hinged) ----
		await R(p, () => window.__reindeer.clock(1));
		await R(p, (bk) => window.__reindeer.fixtures.queue(bk, 1.5), book(FIVE_BOARD, []));
		await p.click('.hudp button.spin');
		let landSeen = null;
		for (let i = 0; i < 600 && !landSeen; i++) {
			const s = await R(p, () => window.__reindeer.signs());
			const g = s.signs.find((x) => x.phase === 'in' && x.rig?.land && Math.abs(x.rig.plateRot) > 0.002);
			if (g) landSeen = { cell: g.cell, rootRot: g.rig.rootRot, plateRot: g.rig.plateRot, spriteRotation: g.spriteRotation };
			await sleep(5);
		}
		check(!!landSeen && Math.abs(landSeen.rootRot) < 1e-9, `${tag}: a landing sign tips its plate on its post (${landSeen ? (landSeen.plateRot * 57.3).toFixed(2) : '?'} deg) and stands upright`, landSeen);
		await finish(p);
		await settle(p);
		check(atRest(await R(p, () => window.__reindeer.signs())).length === 0, `${tag}: after the landing every sign is back at rest`, atRest(await R(p, () => window.__reindeer.signs())));

		// ---- the idle ----
		await R(p, () => window.__reindeer.clock(0));
		const cell = (await R(p, () => window.__reindeer.signs())).signs.find((g) => g.symbol === 'L3' && g.phase === 'rest')?.cell;
		await R(p, (c) => window.__reindeer.signShow(c, 'idle'), cell);
		let idleMax = 0;
		for (let i = 0; i < 200; i++) {
			const s = await R(p, (ms) => (window.__reindeer.step(ms, 1), window.__reindeer.signs()), FRAME);
			const g = s.signs.find((x) => x.cell === cell);
			idleMax = Math.max(idleMax, g?.rig?.dotsLit ?? 0, ...(g?.rig?.decoRot ?? []).map((d) => Math.abs(d) * 100));
			if (OUT && i % 6 === 0 && i < 72) await p.screenshot({ path: join(OUT, `game_${tag}_idle_${String(i).padStart(3, '0')}.png`), clip });
		}
		const after = await R(p, () => window.__reindeer.signs());
		check(idleMax > 0 && atRest(after).length === 0, `${tag}: the idle by hand plays (light and twitch) and ends at rest`, atRest(after));
		await R(p, () => window.__reindeer.clock(1));
	} finally {
		check(errs.length === 0, `${tag}: no page errors`, errs.slice(0, 5));
		await ctx.close();
	}
}

const browser = await chromium.launch({ args: ['--mute-audio', '--autoplay-policy=user-gesture-required'] });
try {
	for (const S of SIZES) await run(browser, S);
} finally {
	await browser.close();
}
console.log(`\nsign_win_probe: ${pass} passed, ${fail} failed${fails.length ? '\n  ' + fails.join('\n  ') : ''}`);
process.exit(fail ? 1 : 0);
