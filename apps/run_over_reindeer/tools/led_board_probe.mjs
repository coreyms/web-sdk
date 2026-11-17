// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// THE LED SCOREBOARD PROBE (part A, 2026-11-17; bigwin_led_r3_2026-11-16 "r3b"; constants LED_BOARD, game/scoreboard/). At each size:
//   - THE STRIP'S RULE per layout class, worked out here from the game's own geometry (the road picture's place, the board,
//     the HUD's layout functions): desktop and tablet 0.62 of the road picture, centred on the window, top the bottom lane
//     line + 0.15 of the band down to the dock, height min(125 road px, 0.85 of that band); upright phones 0.9 of the screen;
//     a phone held sideways 0.86 of the lanes (1349 road px), centred on the road; and against the mock's own numbers
//   - the dots, the pitch (the press screen's), the GPU memory of the whole system under 1.2 MB
//   - THE RISE (desktop, upright, sideways), driven by hand 10 ms at a time: it overshoots its seat, drops back with one
//     bounce, and is seated (within 0.5 px, its bottom rail under the strip's snow cap) from the end of the bounce; the
//     lowered board hides under the strip; while it rises and lowers nothing of it shows under or beside the strip (the
//     foreground snow: the pixels there match the scene's with the board down); it lowers back out of sight
// On the desktop size:
//   - THE GRANDMA GAG: its words exactly; started by a real Grandma strike; on for 5 s; cut short by a new spin's press and by
//     a win message on the strip
//   - THE RACE: 300 seeded runs within RACE_ODDS 45 / 45 / 10, the lead changes hands, the one ahead at the line is the
//     drawn result, each forced result plays; its random source is its own (no Math.random, nothing of a round)
//   - NOTHING STRANDS A ROUND: a Spin press during the rise (the count lands, the round ends), a slam stop then the win
//     plays out by itself, a tap on the board skips a count when Spin is spent, autoplay at turbo 2 (three Mega rounds:
//     the short hold, the count at the turbo rate, the run stops and the game comes back to rest)
//   - the words the scoreboard draws: plain capitals and the gag's line, none of the restricted words, no symbol characters
//   - no page errors
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [ONLY=desktop,...] [SECTIONS=rule,rise,gag,race,round] node tools/led_board_probe.mjs
// Uses the dev server that is already running (it never starts one). One headless browser, muted, closed at the end. Run it
// through tools/browser_lock.sh (the game lane).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PNG } = require('playwright-core/lib/utilsBundle');

const APP = process.env.APP || 'http://localhost:3014';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SECTIONS = (process.env.SECTIONS || 'rule,rise,gag,race,round').split(',');
const SEC = (s) => SECTIONS.includes(s);
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// the mock's strip per size (NOTES section 1: "Rule (w x h at x, y)"); its road edges were read by eye to about 3 px
const SIZES = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, phone: false, cls: 'desktop', mock: { w: 684, h: 90, x: 378, y: 732.5 }, rise: true, flows: true },
	{ name: 'wide', vp: { width: 1920, height: 1080 }, phone: false, cls: 'desktop', mock: { w: 912, h: 80, x: 504, y: 905 } },
	{ name: 'side', vp: { width: 844, height: 390 }, phone: true, cls: 'phone', mock: { w: 391, h: 53, x: 227, y: 317 }, rise: true },
	{ name: 'portrait', vp: { width: 390, height: 844 }, phone: true, cls: 'portrait', mock: { w: 351, h: 71, x: 19.5, y: 600 }, rise: true, throttle: true },
	{ name: 'short', vp: { width: 390, height: 620 }, phone: true, cls: 'portrait', mock: { w: 351, h: 58, x: 19.5, y: 430 } },
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
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 700)) : ''}`);
};
const R = (p, fn, arg) => p.evaluate(fn, arg);
const r1 = (v) => Math.round(v * 10) / 10;

async function boot(browser, S) {
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: 1, isMobile: S.phone, hasTouch: S.phone });
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=led${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 200; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && !document.querySelector('.landing') && window.__reindeer.scoreboard?.())).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	await sleep(800);
	return { ctx, p, errs };
}

/** the rule worked out here, from the game's geometry (the road picture, the board, the HUD's own layout functions) */
const expectRule = (p) =>
	R(p, async () => {
		const H = await import('/src/ui/hud/hudLayout.ts');
		const vw = innerWidth;
		const vh = innerHeight;
		const pic = window.__reindeer.scene().picture;
		const bl = window.__reindeer.boardLayout();
		const f = H.hudFrame({ kind: bl.kind, phone: Math.min(vw, vh) <= 480, vw, vh, safe: H.readSafeInsets() });
		const k = pic.k;
		if (bl.kind === 'landscape') {
			const dock = H.desktopGeo(f, 0).y0 * f.u;
			const lane = pic.y + 851 * k;
			const w = 0.62 * 1535 * k;
			const y = lane + 0.15 * (dock - lane);
			return { cls: f.variant === 'tablet' ? 'tablet' : 'desktop', w, x: vw / 2 - w / 2, y, h: Math.min(125 * k, 0.85 * (dock - lane)), hud: dock };
		}
		if (bl.kind === 'portrait') {
			const G = H.portraitGeo(f, 0);
			const hud = Math.min(G.win.y, G.amt.y, G.spin.y, G.bar.y0) * f.u;
			const y = pic.y + 948 * k;
			return { cls: 'portrait', w: 0.9 * vw, x: 0.05 * vw, y, h: 0.75 * (hud - y), hud };
		}
		const w = 0.86 * 1349 * k;
		const y = pic.y + 874 * k + 1;
		return { cls: 'phone', w, x: pic.x + 768 * k - w / 2, y, h: 0.72 * (vh - y), hud: vh, columns: [H.landscapeGeo(f).cap.x1 * f.u, H.landscapeGeo(f).kc.x0 * f.u] };
	});

/** a region of the page as pixels (device px = CSS px at scale 1) */
const grab = async (p, r) => {
	const clip = { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.max(1, Math.floor(r.w)), height: Math.max(1, Math.floor(r.h)) };
	const png = PNG.sync.read(await p.screenshot({ clip }));
	return png;
};
/** the largest channel difference between two grabs, and how many pixels differ by more than 3 */
const diff = (a, b) => {
	let most = 0;
	let n = 0;
	for (let i = 0; i < a.data.length; i += 4) {
		const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
		if (d > most) most = d;
		if (d > 3) n += 1;
	}
	return { most, n, px: a.data.length / 4 };
};

async function sizeChecks(p, S, memory) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	const sb = await R(p, () => window.__reindeer.scoreboard());
	// ---- THE RULE ----
	if (SEC('rule')) {
		const E = await expectRule(p);
		const st = sb.strip;
		check(sb.cls === E.cls, `${tag}: layout class ${sb.cls} (rule: ${E.cls})`);
		const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;
		check(near(st.w, E.w) && near(st.x, E.x) && near(st.y, E.y) && near(st.h, E.h), `${tag}: the strip ${r1(st.w)} x ${r1(st.h)} at ${r1(st.x)}, ${r1(st.y)} follows its class's rule (${r1(E.w)} x ${r1(E.h)} at ${r1(E.x)}, ${r1(E.y)})`, { st, E });
		check(Math.abs(st.x + st.w / 2 - (S.cls === 'phone' ? E.x + E.w / 2 : S.vp.width / 2)) <= 0.6, `${tag}: the strip is centred (${S.cls === 'phone' ? 'on the road' : 'on the window'})`);
		const M = S.mock;
		const dm = { w: r1(st.w - M.w), x: r1(st.x - M.x), y: r1(st.y - M.y), h: r1(st.h - M.h) };
		check(Math.abs(dm.w) <= 6 && Math.abs(dm.x) <= 6 && Math.abs(dm.y) <= 6 && Math.abs(dm.h) <= 6, `${tag}: against the mock's own numbers (${M.w} x ${M.h} at ${M.x}, ${M.y}): w ${dm.w}, x ${dm.x}, y ${dm.y}, h ${dm.h} (within 6 px: the mock read the road's edges by eye)`, dm);
		check(st.housingBottom <= E.hud + 0.5, `${tag}: the strip ends (${st.housingBottom}) above the HUD's top (${r1(E.hud)})`);
		if (E.columns) check(sb.back.housing.x >= E.columns[0] && sb.back.housing.x + sb.back.housing.w <= E.columns[1], `${tag}: held sideways the strip and the back board stand between the HUD's columns (${r1(E.columns[0])} to ${r1(E.columns[1])})`);
		check(Math.abs(sb.pitch - (S.name === 'desktop' ? 2.49 : S.name === 'wide' ? 3.31 : S.name === 'side' ? 1.56 : 1.3)) <= 0.03, `${tag}: the dot pitch ${sb.pitch} CSS px (the press screen's)`);
		check(st.dotsH >= 14 && st.dotsW >= 200, `${tag}: the strip's face ${st.dotsW} x ${st.dotsH} dots (the mock's smallest: 16 tall at 1920 x 1080), the back board's ${sb.back.dotsW} x ${sb.back.dotsH}`);
		check(sb.gpuBytes <= 1.2 * 1048576, `${tag}: the scoreboard holds ${(sb.gpuBytes / 1048576).toFixed(3)} MB of GPU textures (budget 1.2 MB; the snow cover adds none)`);
		memory[S.name] = { gpuMB: Math.round((sb.gpuBytes / 1048576) * 1000) / 1000, strip: `${st.dotsW}x${st.dotsH}`, back: `${sb.back.dotsW}x${sb.back.dotsH}`, cover: sb.cover };
	}
	// ---- THE COST on a phone profile, the CPU throttled 4x (CDP): a content step of the strip alone, and with the back board up
	if (SEC('rule') && S.throttle) {
		const cdp = await p.context().newCDPSession(p);
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
		const sample = async () =>
			R(p, async () => {
				const out = [];
				const frames = [];
				let last = performance.now();
				const t0 = last;
				const s0 = window.__reindeer.scoreboard().cost.steps;
				await new Promise((res) => {
					const tick = () => {
						const now = performance.now();
						frames.push(now - last);
						last = now;
						out.push(window.__reindeer.scoreboard().cost.drawMs);
						if (now - t0 > 3000) res();
						else requestAnimationFrame(tick);
					};
					requestAnimationFrame(tick);
				});
				const sorted = [...frames].sort((a, b) => a - b);
				return { drawMsAvg: Math.round((out.reduce((a, b) => a + b, 0) / out.length) * 100) / 100, drawMsMax: Math.max(...out), steps: window.__reindeer.scoreboard().cost.steps - s0, frameMsMedian: Math.round(sorted[Math.floor(sorted.length / 2)]), frameMsP95: Math.round(sorted[Math.floor(sorted.length * 0.95)]) };
			});
		const idle = await sample();
		await R(p, () => window.__reindeer.scoreboardRaise(98.75));
		await sleep(1200);
		const up = await R(p, () => null).then(sample);
		await R(p, () => window.__reindeer.scoreboardLower());
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
		await sleep(1500);
		console.log(`  ${tag} cost, CPU 4x throttled: strip alone ${JSON.stringify(idle)}; with the back board up ${JSON.stringify(up)}`);
		memory[`${S.name}Cost`] = { idle, up };
		check(idle.drawMsAvg < 4 && up.drawMsAvg < 8, `${tag}: a content step costs ${idle.drawMsAvg} ms (strip) and ${up.drawMsAvg} ms (both faces) on average with the CPU throttled 4x`);
	}
	// ---- THE RISE, by hand ----
	if (SEC('rise') && S.rise) {
		await R(p, () => {
			window.__reindeer.tune.ledBoard.dim.alpha = 0; // the cover's pixels are compared with the scene's: no dim
			window.__reindeer.scoreboardManual(true);
		});
		await sleep(300);
		const g0 = await R(p, () => window.__reindeer.scoreboard());
		const st = g0.strip;
		// the regions where only the scene may show: under the strip down to the HUD (or the screen's foot), the board's width
		const under = { x: g0.back.housing.x, y: st.housingBottom + 1, w: g0.back.housing.w, h: Math.max(1, Math.min(g0.hudTop, S.vp.height) - st.housingBottom - 2) };
		const sides = [
			{ x: st.x - 7, y: st.y + st.h * 0.45, w: 5, h: st.h * 0.45 },
			{ x: st.x + st.w + 2, y: st.y + st.h * 0.45, w: 5, h: st.h * 0.45 },
		];
		const base = { under: await grab(p, under), sides: await Promise.all(sides.map((r) => grab(p, r))) };
		await R(p, () => void window.__reindeer.scoreboardWin(98.75));
		const rows = [];
		let worst = { under: 0, sides: 0, frames: 0 };
		let shots = 0;
		for (let i = 0; i < 160; i++) {
			const s = await R(p, () => {
				const s = window.__reindeer.scoreboardStep(10);
				return { t: s.show?.t ?? -1, phase: s.show?.phase, off: s.back.offset, down: s.back.down, vis: s.back.visible, bottom: s.back.bottomNow, seat: s.back.seatBottom, top: s.back.topNow };
			});
			rows.push(s);
			// two frames of the rise against the scene: its first move and half way up
			if ((shots === 0 && s.off < s.down * 0.93 && s.vis) || (shots === 1 && s.off < s.down * 0.5)) {
				shots += 1;
				const u = diff(base.under, await grab(p, under));
				const sd = await Promise.all(sides.map(async (r, k) => diff(base.sides[k], await grab(p, r))));
				worst.under = Math.max(worst.under, u.n);
				worst.sides = Math.max(worst.sides, ...sd.map((d) => d.n));
				worst.frames += 1;
				console.log(`  ${tag} rise frame t ${s.t} offset ${s.off}: under the strip ${u.n} of ${u.px} px differ (largest ${u.most}), beside it ${sd.map((d) => d.n).join(' / ')}`);
			}
			if (s.t > 1500) break;
		}
		const D = rows[0].down;
		const seatedAt = 60 + 560 + 220;
		const overshoot = Math.min(...rows.map((r) => r.off));
		const after = rows.filter((r) => r.t >= seatedAt);
		const bounce = rows.filter((r) => r.t > 620 && r.t < seatedAt);
		check(rows[0].off > D * 0.9 && overshoot < -0.5 && overshoot > -D * 0.2, `${tag}: rise style C: it starts under the strip (offset ${rows[0].off} of ${D}) and overshoots its seat by ${r1(-overshoot)} px`);
		check(bounce.some((r) => r.off > 0.3), `${tag}: it drops back into place with one bounce (largest ${r1(Math.max(0, ...bounce.map((r) => r.off)))} px)`);
		check(after.length > 0 && after.every((r) => Math.abs(r.off) < 0.5 && Math.abs(r.bottom - r.seat) < 0.5), `${tag}: seated from ${seatedAt} ms within 0.5 px: its bottom rail at ${after[0]?.bottom} under the strip's cap (seat ${after[0]?.seat})`, after.slice(0, 3));
		check(worst.frames === 2 && worst.under === 0 && worst.sides === 0, `${tag}: while it rises nothing of it shows under or beside the strip (the foreground snow: ${worst.under} px under, ${worst.sides} beside differ from the scene)`, worst);
		// skip, then the power down and the lowering, by hand
		await R(p, () => window.__reindeer.scoreboardSkip());
		const low = [];
		for (let i = 0; i < 400; i++) {
			const s = await R(p, () => {
				const s = window.__reindeer.scoreboardStep(10);
				return { phase: s.show?.phase ?? 'none', off: s.back.offset, down: s.back.down, vis: s.back.visible, busy: s.busy };
			});
			low.push(s);
			if (s.phase === 'none' && i > 5) break;
		}
		const last = low[low.length - 1];
		check(low.some((r) => r.phase === 'hold') && low.some((r) => r.phase === 'lowering') && low.some((r) => r.off < -0.5 && r.phase === 'lowering'), `${tag}: the skip lands the count; after the hold it hops up, then lowers`);
		check(last.phase === 'none' && Math.abs(last.off - last.down) < 0.5 && !last.vis && !last.busy, `${tag}: lowered out of sight behind the strip (offset ${last.off} of ${last.down}, hidden)`, last);
		await R(p, () => {
			window.__reindeer.scoreboardManual(false);
			window.__reindeer.tune.ledBoard.dim.alpha = 0.336;
		});
	}
}

/** a spin of a showcase round; resolves when the game is back at rest with nothing up (or the limit passes) */
async function playRound(p, name, { during, limit = 90000 } = {}) {
	await R(p, (n) => window.__reindeer.fixtures.next(n), name);
	const t0 = Date.now();
	await p.click('.hudp button.spin');
	const seen = [];
	let lastKey = '';
	while (Date.now() - t0 < limit) {
		const s = await R(p, () => {
			const s = window.__reindeer.scoreboard();
			return { phase: s.show?.phase ?? 'none', kind: s.show?.kind ?? null, tier: s.show?.tier ?? -1, skipped: s.show?.skipped ?? false, final: s.show?.final ?? null, idle: window.__reindeer.hud.idle(), rest: window.__reindeer.atRest(), busy: s.busy, gag: s.gag?.words ?? null, hold: s.show ? s.show.exitAt - s.show.countEnd : null, count: s.show ? s.show.countEnd - s.show.countStart : null };
		});
		const key = `${s.phase}|${s.tier}|${s.idle}|${s.gag}`;
		if (key !== lastKey) {
			seen.push({ at: Date.now() - t0, ...s });
			lastKey = key;
		}
		if (during) await during(s, Date.now() - t0);
		if (s.idle && s.rest && s.phase === 'none' && Date.now() - t0 > 1200) return { ok: true, ms: Date.now() - t0, seen };
		await sleep(60);
	}
	return { ok: false, ms: Date.now() - t0, seen };
}

async function flows(p, S, errs) {
	const tag = `${S.name}`;
	// ---- THE WORDS ----
	const consts = readFileSync(join(SRC, 'game', 'constants.ts'), 'utf8');
	const block = consts.slice(consts.indexOf('export const LED_BOARD'), consts.indexOf('/** everything tunable'));
	const gagM = /gag: \{[^}]*first: '([^']*)', second: '([^']*)', third: '([^']*)'/.exec(block);
	const gagLine = gagM ? `${gagM[1]} ${gagM[2]} ${gagM[3]}` : '';
	if (SEC('gag')) {
		check(gagLine === 'Oooh.. Grandma Got Run Over by a Reindeer?', `${tag}: the gag's words are exactly Corey's line ("${gagLine}")`);
		const titles = [...block.matchAll(/title: '([^']*)'/g)].map((m) => m[1]);
		const draw = readFileSync(join(SRC, 'game', 'scoreboard', 'scoreboardDraw.ts'), 'utf8');
		const drawn = [...draw.matchAll(/'([A-Z][A-Z ]+)'/g)].map((m) => m[1]).filter((x) => x.length > 1);
		const words = [...titles, ...drawn, gagLine];
		const banned = /\b(bets?|buy|buys|cash|money|paid|credits?|gamble|gambling|wager|wagers|stake)\b/i;
		check(words.length > 8 && !words.some((w) => banned.test(w)) && words.every((w) => /^[A-Za-z0-9 .,?']+$/.test(w)), `${tag}: the scoreboard's words have none of the restricted words and no symbol characters (${[...new Set(words)].join(' / ')})`, words);

		// the gag by hand: 5 s, its beats
		await R(p, () => window.__reindeer.scoreboardManual(true));
		await R(p, () => window.__reindeer.scoreboardGag());
		const beats = [];
		for (let t = 0; t <= 5100; t += 100) {
			const g = await R(p, () => window.__reindeer.scoreboardStep(100).gag);
			beats.push({ t: t + 100, words: g?.words ?? null });
		}
		const on = beats.filter((b) => b.words !== null);
		const shown = [...new Set(on.map((b) => b.words).filter(Boolean))].join(' ');
		check(on.length >= 49 && on.length <= 50 && beats[beats.length - 1].words === null, `${tag}: the gag stays ${on.length * 100} ms (5 s) and goes`, beats.slice(-4));
		check(shown === gagLine, `${tag}: its beats show "${shown}"`);
		await R(p, () => window.__reindeer.scoreboardManual(false));
		// cut by a win message on the strip
		await R(p, () => window.__reindeer.scoreboardGag());
		await sleep(400);
		await R(p, () => void window.__reindeer.scoreboardWin(3.4));
		await sleep(150);
		const c1 = await R(p, () => ({ gag: window.__reindeer.scoreboard().gag, log: window.__reindeer.scoreboard().log.slice(-3) }));
		check(c1.gag === null && c1.log.some((l) => l.what === 'gag' && /cut: a win on the strip/.test(l.detail)), `${tag}: a win message on the strip cuts the gag short`, c1);
		await sleep(2800);
		// cut by a new spin's press
		await R(p, () => window.__reindeer.scoreboardGag());
		await sleep(500);
		const r = await playRound(p, 'no_win_1', { limit: 30000 });
		const c2 = await R(p, () => window.__reindeer.scoreboard().log.slice(-6));
		check(r.ok && c2.some((l) => l.what === 'gag' && /cut: a new spin/.test(l.detail)), `${tag}: a new spin's press cuts the gag short`, c2);
		// a real Grandma strike starts it (base_grandma_strike: the reindeer strikes Grandma's car; the round's own small win then
		// cuts it as its lines start)
		const g = await playRound(p, 'base_grandma_strike', { limit: 60000 });
		const c3 = await R(p, () => window.__reindeer.scoreboard().log.slice(-8));
		const st = c3.find((l) => l.what === 'gag' && l.detail === 'start');
		const cut = c3.find((l) => l.what === 'gag' && /cut/.test(l.detail ?? ''));
		check(g.ok && !!st, `${tag}: a real strike on a Grandma starts the gag (base_grandma_strike)`, c3);
		console.log(`  NOTE ${tag}: in base_grandma_strike the gag was on ${st && cut ? cut.at - st.at : '?'} ms before its round's small win cut it (${cut?.detail ?? 'not cut'})`);
	}

	// ---- THE RACE ----
	if (SEC('race')) {
		const T = await R(p, () => window.__reindeer.raceTally(20261117, 300));
		const sd = (q) => Math.sqrt(300 * q * (1 - q));
		const within = (n, q) => Math.abs(n - 300 * q) <= 3 * sd(q);
		check(within(T.reindeer, 0.45) && within(T.police, 0.45) && within(T.tie, 0.1), `${tag}: 300 seeded races: reindeer ${T.reindeer}, police car ${T.police}, tie ${T.tie} (odds 45 / 45 / 10, each within 3 standard deviations)`, T);
		check(T.mismatches === 0, `${tag}: in every run the one ahead at the line is the drawn result`, T);
		check(T.leadChangesMin >= 1, `${tag}: the lead changes hands in every run (${T.leadChangesMin} to ${T.leadChangesMax} times)`, T);
		for (const force of ['reindeer', 'police', 'tie']) {
			const tr = await R(p, (f) => window.__reindeer.raceTrace(f), force);
			check(tr.outcome === force && tr.ahead === force, `${tag}: a forced ${force} result plays as ${tr.ahead} (gap at the line ${tr.gapAtLine})`, tr);
		}
		const race = readFileSync(join(SRC, 'game', 'scoreboard', 'race.ts'), 'utf8');
		const code = race.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
		check(!/Math\.random/.test(code) && /raceRandom/.test(code), `${tag}: the race draws from its own seeded source (no Math.random in its code)`);
		const handlers = readFileSync(join(SRC, 'game', 'bookEventHandlerMap.ts'), 'utf8');
		check(!/race/i.test(handlers), `${tag}: nothing of a round touches the race (the book handlers never mention it)`);
		// on the strip: the race cartoon, forced, plays and its card says the result
		await R(p, () => window.__reindeer.scoreboardRace('tie'));
		await sleep(400);
		const sr = await R(p, () => window.__reindeer.scoreboard().cartoon);
		check(sr.key === 'race' && sr.race?.outcome === 'tie', `${tag}: the race plays on the strip with the chosen result (${sr.key}, ${sr.race?.outcome})`, sr);
	}

	// ---- NOTHING STRANDS A ROUND ----
	if (SEC('round')) {
		// a Spin press during the rise lands the count; the round ends
		let pressed = false;
		const a = await playRound(p, 'base_two_columns', {
			during: async (s) => {
				if (!pressed && s.phase === 'rising') {
					pressed = true;
					await p.click('.hudp button.spin').catch(() => {});
				}
			},
		});
		const skippedA = a.seen.some((x) => x.skipped);
		check(pressed && skippedA && a.ok, `${tag}: a Spin press during the rise lands the count and the round ends (${a.ms} ms; Mega ${a.seen.some((x) => x.tier === 2) ? 'shown' : 'not shown'})`, a.seen.slice(-6));
		// a slam stop during the spin, then the win plays out by itself
		let slammed = false;
		const b = await playRound(p, 'base_two_columns', {
			during: async (s, ms) => {
				if (!slammed && ms > 350 && s.phase === 'none' && !s.idle) {
					slammed = true;
					await p.click('.hudp button.spin').catch(() => {});
				}
			},
		});
		check(slammed && b.ok && b.seen.some((x) => x.tier === 2) && !b.seen.some((x) => x.skipped), `${tag}: after a slam stop the Mega win plays out by itself and the round ends (${b.ms} ms)`, b.seen.slice(-6));
		// slammed, so Spin is spent: a tap on the board skips the count
		let slam2 = false;
		let tapped = false;
		const c = await playRound(p, 'base_two_columns', {
			during: async (s, ms) => {
				if (!slam2 && ms > 350 && s.phase === 'none' && !s.idle) {
					slam2 = true;
					await p.click('.hudp button.spin').catch(() => {});
				}
				if (slam2 && !tapped && s.phase === 'count' && s.tier >= 0) {
					tapped = true;
					await p.mouse.click(S.vp.width / 2, S.vp.height * 0.4);
				}
			},
		});
		check(tapped && c.ok && c.seen.some((x) => x.skipped), `${tag}: with Spin spent by a slam, a tap on the board skips the count (${c.ms} ms)`, c.seen.slice(-6));
		// AUTOPLAY AT TURBO 2: three Mega rounds in a row
		await R(p, () => {
			window.__reindeer.turbo(2);
			window.__reindeer.fixtures.next('base_two_columns', true);
		});
		await p.click('.hudp button[aria-label="Autoplay"]');
		await sleep(700);
		await p.click('.am-ui.layer.modals .go');
		await sleep(700);
		const plays0 = await R(p, () => window.__reindeer.fixtures.log().plays.length);
		await p.click('.hudp button.spin');
		const t0 = Date.now();
		const shows = new Map();
		let stopped = false;
		while (Date.now() - t0 < 150000) {
			const s = await R(p, () => {
				const s = window.__reindeer.scoreboard();
				return { id: s.show?.id ?? null, kind: s.show?.kind, hold: s.show ? s.show.exitAt - s.show.countEnd : null, count: s.show ? s.show.countEnd - s.show.countStart : null, plays: window.__reindeer.fixtures.log().plays.length, auto: document.querySelector('.hudp button.spin')?.getAttribute('aria-label') === 'Stop autoplay' };
			});
			if (s.id && s.kind === 'win' && !shows.has(s.id)) shows.set(s.id, s);
			if (!stopped && s.plays - plays0 >= 3) {
				stopped = true;
				await R(p, () => window.__reindeer.fixtures.clear());
				await p.click('.hudp button.spin').catch(() => {});
			}
			if (stopped) {
				const done = await R(p, () => window.__reindeer.hud.idle() && window.__reindeer.atRest() && !window.__reindeer.scoreboard().show && document.querySelector('.hudp button.spin')?.getAttribute('aria-label') !== 'Stop autoplay');
				if (done) break;
			}
			await sleep(80);
		}
		// (the round the Stop press lands in is no longer an autoplay round: its hold is the normal one)
		const list = [...shows.values()].filter((x) => x.auto);
		const end = await R(p, () => ({ idle: window.__reindeer.hud.idle(), rest: window.__reindeer.atRest(), show: window.__reindeer.scoreboard().show?.phase ?? null, plays: window.__reindeer.fixtures.log().plays.length }));
		check(stopped && end.idle && end.rest && !end.show, `${tag}: autoplay at turbo 2 ran ${end.plays - plays0} Mega rounds and came back to rest when stopped`, end);
		check(list.length >= 2 && list.every((x) => x.hold === 400 && Math.abs(x.count - 5000 / 2.6) < 30), `${tag}: in autoplay each win holds 400 ms and counts at the turbo rate (${list.map((x) => `${Math.round(x.count)} ms + ${x.hold}`).join(', ')}; 5000 / 2.6 = ${Math.round(5000 / 2.6)})`, list);
		await R(p, () => window.__reindeer.turbo(0));
	}
	check(errs.length === 0, `${tag}: no page errors`, errs);
}

(async () => {
	const browser = await chromium.launch({ args: ['--mute-audio'] });
	const memory = {};
	try {
		for (const S of SIZES) {
			const { ctx, p, errs } = await boot(browser, S);
			try {
				await sizeChecks(p, S, memory);
				if (S.flows) await flows(p, S, errs);
				else check(errs.length === 0, `${S.name}: no page errors`, errs);
			} catch (e) {
				check(false, `${S.name}: the probe ran to its end`, String(e?.stack ?? e).slice(0, 600));
			} finally {
				await ctx.close();
			}
		}
	} finally {
		await browser.close();
	}
	console.log('MEMORY', JSON.stringify(memory));
	console.log(`\nled_board_probe: ${pass} pass, ${fail} fail`);
	if (fails.length) console.log('FAILS:\n  ' + fails.join('\n  '));
	process.exit(fail ? 1 : 0);
})();
