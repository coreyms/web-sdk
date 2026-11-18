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
// PART B (2026-11-17), sections `scenes` (desktop and upright phone, driven by hand), `cards` (real bonus rounds, desktop):
//   - THE CARDS ON THE BACK BOARD: the Free Spins entry, the Super entry and the Total Win rise and draw their scenes; the
//     press line comes on the strip at its time (entries 2.3 s and 2.9 s into the scene, the Total Win 0.3 s after its count
//     lands); a press before it lands the scene (the entry's READY beat, the Total Win's amount), the next continues; the card
//     ends, the board powers down and lowers out of sight; the Super entry shakes the road with the board
//   - THE WIN SCENES: Mega (the traffic jam), Epic (the honk meter), Max (the race in the bottom band): each tier's moment and
//     sound ONCE, in order (asked of the road's sound log, and reaching the effects sprite when it is in); a skip during the rise
//     plays only the final tier's sound, a skip in the count the tiers reached plus the final; Mega and up shake
//   - THE GAG'S RULE: a small win waits for the gag and shows after it; a Big message cuts it; a Mega (the back board) cuts it
//     (since 2026-11-17: never with the back board up, and none starts while a card is up)
//     on the strip; in a real Grandma strike round the gag is no longer cut by the round's own small win
//   - THE CHASE AS RUNS draws the same picture as dot by dot (the face's pixels hashed both ways), and its cost both ways
//   - THE GAG'S RULE (2026-11-17): base_grandma_strike's base game strike plays the gag; in floor_top_up's free spins the
//     first Grandma strike (no win) plays it, a later one on a paying spin plays it, a later one with no win does not
//   - THE ENTRY'S SENTENCE (scenes, 2026-11-17): while an entry waits, the intro card's sentence (constants INTRO_LINE,
//     the same words the HTML card shows) scrolls on the strip and the press line is never more than 3 s away
//   - THE TITLES (section titles, every size, 2026-11-17): BIG to MAX WIN, FREE SPINS and TOTAL WIN centered on the back
//     board's face by their drawn dots within half a dot, 4 dots clear of each side, the bounce inside the top; again with
//     the class's size knob at 2 and 0.3
//   - REAL ROUNDS: natural_free_spins (the entry on the board, a press lands it, a press continues; the Total Win on the board),
//     floor_top_up (its wrap-up keeps the HTML card: the top-up line); autoplay's tier sounds once per tier per round
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [ONLY=desktop,...] [SECTIONS=rule,rise,gag,race,round,scenes,cards,titles] node tools/led_board_probe.mjs
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
const SECTIONS = (process.env.SECTIONS || 'rule,rise,gag,race,round,scenes,cards,titles,dim,raceCard').split(',');
const SEC = (s) => SECTIONS.includes(s);
// the intro card's sentence, exactly (game/constants.ts INTRO_LINE, which ui/RoundCard.svelte shows too)
const INTRO = (() => {
	const c = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'game', 'constants.ts'), 'utf8');
	const m = /export const INTRO_LINE = \{\s*bonus: '([^']*)',\s*super: '([^']*)',/.exec(c);
	return m ? { bonus: m[1], super: m[2] } : { bonus: '', super: '' };
})();
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// the mock's strip per size (NOTES section 1: "Rule (w x h at x, y)"); its road edges were read by eye to about 3 px
const SIZES = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, phone: false, cls: 'desktop', mock: { w: 684, h: 90, x: 378, y: 732.5 }, rise: true, flows: true, scenes: true },
	{ name: 'wide', vp: { width: 1920, height: 1080 }, phone: false, cls: 'desktop', mock: { w: 912, h: 80, x: 504, y: 905 } },
	{ name: 'side', vp: { width: 844, height: 390 }, phone: true, cls: 'phone', mock: { w: 391, h: 53, x: 227, y: 317 }, rise: true },
	{ name: 'portrait', vp: { width: 390, height: 844 }, phone: true, cls: 'portrait', mock: { w: 351, h: 71, x: 19.5, y: 600 }, rise: true, throttle: true, scenes: true },
	{ name: 'short', vp: { width: 390, height: 620 }, phone: true, cls: 'portrait', mock: { w: 351, h: 58, x: 19.5, y: 430 }, acceptRuleH: true },
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
		// (390 x 620: Corey accepted the game's own strip height on 2026-11-17, 6.1 px under the mock's by-eye 58: the
		// expected height there is the game's rule, E.h, and the strip must stand between the road's edge and the HUD)
		const M = S.acceptRuleH ? { ...S.mock, h: E.h } : S.mock;
		if (S.acceptRuleH) check(st.y >= E.y - 0.6 && st.housingBottom <= E.hud + 0.5, `${tag}: the strip stands between the road's edge (${r1(E.y)}) and the HUD's top (${r1(E.hud)}): ${r1(st.y)} to ${r1(st.housingBottom)}`);
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
		// part B: the same with the chase borders drawn dot by dot (the cost before the runs)
		await R(p, () => (window.__reindeer.tune.ledBoard.fastChase = false));
		const upDots = await sample();
		await R(p, () => (window.__reindeer.tune.ledBoard.fastChase = true));
		console.log(`  ${tag} cost, CPU 4x throttled, the Mega scene: chase as runs ${up.drawMsAvg} ms a step (max ${up.drawMsMax}), dot by dot ${upDots.drawMsAvg} ms (max ${upDots.drawMsMax})`);
		memory[`${S.name}CostDots`] = upDots;
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
				// (part B: the seated board shakes at the tiers; its seat is read without the shake)
return { t: s.show?.t ?? -1, phase: s.show?.phase, off: s.back.offset - s.shake, down: s.back.down, vis: s.back.visible, bottom: s.back.bottomNow - s.shake, seat: s.back.seatBottom, top: s.back.topNow };
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

// ---- PART B: THE STAGED SCENES, THE TIER SOUNDS, THE SHAKES, THE GAG'S RULE, driven by hand ----
const TIER_SFX = /^sfx_win_(big|super|mega|epic|max)$/;
async function scenes(p, S) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	const step = (ms, n = 1) => R(p, ([ms, n]) => window.__reindeer.scoreboardStep(ms, n), [ms, n]);
	const face = (w) => R(p, (w) => window.__reindeer.scoreboardFace(w), w);
	/** the tier sounds asked since the last clear (the road's sound log), and those that reached the effects sprite (null: not in) */
	const tierSounds = async () => {
		const o = await R(p, () => ({ road: window.__reindeer.roadSounds(true), tap: window.__reindeer.soundTap?.(true) ?? null }));
		// (a tier sound's fade out, 2026-11-17, is noted in the same log as a "stop": not a sound asked)
		return { asked: o.road.filter((e) => e.kind === 'sound' && TIER_SFX.test(e.what) && !/^stop/.test(e.detail || '')).map((e) => e.what), played: o.tap ? o.tap.log.filter((e) => e.what === 'play' && TIER_SFX.test(e.name)).map((e) => e.name) : null };
	};
	const roadY = () => R(p, () => window.__reindeer.roadBoard().root.y);
	await R(p, () => {
		window.__reindeer.raceSeed(20261117);
		window.__reindeer.scoreboardManual(true);
	});
	await tierSounds();
	const C = 620; // the scene starts as the board seats (backAtMs 60 + riseMs 560)
	/** step to show ms `to` from `from`, 10 ms at a time, collecting what `pick` returns per step */
	// (stepped inside the page, one call for the whole run: a call per step is too slow for one lock turn)
	const run = (from, to) =>
		R(p, ([from, to]) => {
			const rows = [];
			for (let t = from; t < to; t += 10) {
				const s = window.__reindeer.scoreboardStep(10);
				rows.push({ t: s.show?.t ?? -1, phase: s.show?.phase ?? 'none', tier: s.show?.tier ?? -1, shake: s.shake, sceneT: s.show?.sceneT, amount: s.show?.amount, vis: s.back.visible, off: s.back.offset, down: s.back.down, card: s.card, stripKey: s.stripKey });
			}
			return rows;
		}, [from, to]);
	const finish = async () => {
		await R(p, () => {
			window.__reindeer.scoreboardCardEnd();
			window.__reindeer.scoreboardLower();
		});
		const rows = await run(0, 3000);
		return rows[rows.length - 1];
	};

	// ---- THE ENTRIES: the scene draws, the press line at its time, the land, the end ----
	for (const kind of ['fs', 'sfs']) {
		const press = kind === 'fs' ? 2300 : 2900;
		const ready = kind === 'fs' ? 2200 : 2800;
		const base = await roadY();
		await R(p, (k) => window.__reindeer.scoreboardCard(k), kind);
		const rows = await run(0, C + press + 300);
		const lit = await face('back');
		const waitsAt = rows.find((r) => r.phase === 'waits')?.t;
		check(rows.some((r) => r.phase === 'rising') && rows.some((r) => r.phase === 'show') && Math.abs(waitsAt - (C + press)) <= 10, `${tag}: the ${kind === 'fs' ? 'Free Spins' : 'Super'} entry rises, plays its scene and waits for the press from ${waitsAt} ms (rule ${C + press})`, rows.filter((r, i) => i % 40 === 0));
		check(lit && lit.lit > lit.dots * 0.03 && rows[rows.length - 1].card === kind && /^show/.test(rows[rows.length - 1].stripKey), `${tag}: its back board face is lit (${lit?.lit} of ${lit?.dots} dots) and the strip carries its line (${rows[rows.length - 1].stripKey})`, lit);
		// THE ENTRY'S SENTENCE (2026-11-17): while it waits, the intro card's sentence scrolls on the strip, the press line
		// never more than about 3 s away; sampled every 100 ms for 8 s of the wait
		{
			const want = INTRO[kind === 'sfs' ? 'super' : 'bonus'];
			const waitRows = await R(p, () => {
				const out = [];
				for (let i = 0; i < 80; i++) {
					window.__reindeer.scoreboardStep(100);
					const f = window.__reindeer.scoreboardFace('strip');
					out.push(f?.entryWait ?? null);
				}
				return out;
			});
			const drawn = waitRows.filter(Boolean);
			const sentences = [...new Set(drawn.map((w) => w.sentence))];
			let gap = 0;
			let worst = 0;
			for (const w of waitRows) {
				gap = w && w.press ? 0 : gap + 100;
				worst = Math.max(worst, gap);
			}
			const xs = drawn.filter((w) => w.sentenceX !== null).map((w) => w.sentenceX);
			const card = readFileSync(join(SRC, 'ui', 'RoundCard.svelte'), 'utf8');
			check(/import \{ INTRO_LINE[,} ]/.test(card) && card.includes('{INTRO_LINE[card.bonus]}') && want.length > 20, `${tag}: the HTML intro card and the strip take the sentence from the one place (constants INTRO_LINE)`);
			check(drawn.length === waitRows.length && sentences.length === 1 && sentences[0] === want && worst <= 3000 && new Set(xs).size > 10, `${tag}: while the ${kind} entry waits the strip scrolls "${sentences[0]}" (${drawn[0]?.mode}, size ${drawn[0]?.size}, ${new Set(xs).size} places in 8 s) and the press line is never more than ${worst} ms away (within 3000)`, { want, sentences, worst, mode: drawn[0]?.mode });
		}
		if (kind === 'sfs') {
			const sh = rows.filter((r) => r.t >= C && r.t < C + 480).map((r) => Math.abs(r.shake));
			const moved = Math.abs((await roadY()) - base);
			check(Math.max(...sh) > 1.5 && rows.filter((r) => r.t > C + 500).every((r) => r.shake === 0) && moved < 0.05, `${tag}: the Super entry shakes once as its scene starts (largest ${r1(Math.max(...sh))} px) and the road is back in place (${r1(moved)} px off)`, sh);
		}
		const end = await finish();
		check(end.phase === 'none' && !end.vis && Math.abs(end.off - end.down) < 0.5, `${tag}: after the card the board powers down and lowers out of sight`, end);
		// a press before the press line lands the scene on its READY beat; the next press continues
		await R(p, (k) => window.__reindeer.scoreboardCard(k), kind);
		await run(0, C + 600);
		const l1 = await R(p, () => window.__reindeer.scoreboardCardPress());
		const after = await R(p, () => window.__reindeer.scoreboardStep(10).show);
		const l2 = await R(p, () => window.__reindeer.scoreboardCardPress());
		check(l1 === true && after.sceneT >= ready && after.phase === 'waits' && l2 === false, `${tag}: a press 600 ms into the ${kind} scene lands it (scene at ${after.sceneT} ms, its READY beat from ${ready}, the press line up); the next press continues`, { l1, l2, after: { sceneT: after.sceneT, phase: after.phase } });
		await finish();
	}

	// ---- THE TOTAL WIN: the count, the landing, the press line, a press lands the count ----
	{
		await R(p, () => window.__reindeer.scoreboardCard('total', { x: 248.5 }));
		const rows = await run(0, C + 3000 + 400);
		const mid = rows.find((r) => r.t === C + 1500);
		const land = rows.find((r) => r.t >= C + 3000);
		const waitsAt = rows.find((r) => r.phase === 'waits')?.t;
		const fin = await R(p, () => window.__reindeer.scoreboard().show.finalStr);
		check(mid?.phase === 'count' && mid.amount !== fin && land?.amount === fin && Math.abs(waitsAt - (C + 3300)) <= 10, `${tag}: the Total Win counts (${mid?.amount} half way), lands on ${land?.amount} (the amount asked, ${fin}) and waits from ${waitsAt} ms (rule ${C + 3300})`, rows.filter((r, i) => i % 50 === 0));
		const lit = await face('back');
		check(lit && lit.lit > lit.dots * 0.03, `${tag}: its back board face is lit (${lit?.lit} of ${lit?.dots} dots)`, lit);
		await finish();
		await R(p, () => window.__reindeer.scoreboardCard('total', { x: 248.5 }));
		await run(0, C + 1200);
		const l1 = await R(p, () => window.__reindeer.scoreboardCardPress());
		const after = await R(p, () => window.__reindeer.scoreboardStep(10).show);
		const l2 = await R(p, () => window.__reindeer.scoreboardCardPress());
		check(l1 && after.amount === after.finalStr && after.phase !== 'count' && l2 === false, `${tag}: a press during the Total Win's count lands it (${after.amount}); the next press continues`, { l1, l2, after: { amount: after.amount, phase: after.phase } });
		await finish();
	}

	// ---- THE WIN SCENES: each tier's moment and sound once, in order; the bands; the shakes ----
	const NAMES = ['sfx_win_big', 'sfx_win_super', 'sfx_win_mega', 'sfx_win_epic', 'sfx_win_max'];
	for (const [x, final, what] of [
		[98.75, 2, 'Mega (the traffic jam)'],
		[312.45, 3, 'Epic (the honk meter)'],
		[7777, 4, 'Max (the race in the bottom band)'],
	]) {
		await tierSounds();
		await R(p, (x) => void window.__reindeer.scoreboardWin(x), x);
		const { rows, mid, race } = await R(p, (final) => {
			const rows = [];
			let mid = null;
			let race = null;
			for (let i = 0; i < 1200; i++) {
				const q = window.__reindeer.scoreboardStep(10);
				const s = { t: q.show?.t ?? -1, phase: q.show?.phase ?? 'none', tier: q.show?.tier ?? -1, shake: q.shake, fired: q.show?.fired ?? null, countStart: q.show?.countStart, countEnd: q.show?.countEnd, events: q.show?.events, maxRace: q.show?.maxRace ?? null, raceAt: q.show?.maxRaceAt ?? null };
				rows.push(s);
				if (!mid && s.tier === final && (s.phase === 'count' || s.phase === 'hold')) mid = window.__reindeer.scoreboardFace('back');
				if (s.maxRace) race = s.maxRace;
				if (s.phase === 'none') break;
			}
			return { rows, mid, race };
		}, final);
		const fired = rows.filter((r) => r.fired).pop()?.fired ?? [];
		// (2026-11-17) EACH TIER'S SOUND FADES THE ONE BEFORE: as the next tier's starts the one before is faded out over at
		// most 200 ms (the road's log: its stop note, within 50 real ms of the next one's play)
		{
			const L = await R(p, () => window.__reindeer.roadSounds());
			const plays = L.filter((e) => e.kind === 'sound' && TIER_SFX.test(e.what) && /scoreboard tier/.test(e.detail || ''));
			const pairs = plays.slice(1).map((e, i) => {
				const prev = plays[i];
				const st = L.find((x) => x.what === prev.what && /^stop \(the next tier/.test(x.detail || '') && Math.abs(x.t - e.t) < 50);
				const ms = st ? Number(/, (\d+) ms fade/.exec(st.detail)?.[1]) : null;
				return { prev: prev.what, next: e.what, fade: ms };
			});
			check(pairs.length === final && pairs.every((x) => x.fade !== null && x.fade <= 200), `${tag}: ${what}: as each tier's sound starts the one before fades out within 200 ms (${pairs.map((x) => `${x.prev} ${x.fade} ms`).join(', ')})`, pairs);
		}
		const want = Array.from({ length: final + 1 }, (_, i) => i);
		const snd = await tierSounds();
		const events = rows.find((r) => r.events?.length === final + 1)?.events ?? [];
		const shakeAt = (tier) => {
			const e = events.find((x) => x.tier === tier);
			return e ? Math.max(...rows.filter((r) => r.t >= e.at && r.t < e.at + 200).map((r) => Math.abs(r.shake))) : 0;
		};
		check(fired.join() === want.join() && snd.asked.join() === NAMES.slice(0, final + 1).join() && (snd.played === null || snd.played.join() === snd.asked.join()), `${tag}: ${what}: each tier's moment once, in order (${fired.join(' ')}), and its sound once (${snd.asked.join(', ')}${snd.played === null ? '; the sprite not in' : '; all reached the sprite'})`, { fired, snd });
		check(mid && mid.lit > mid.dots * 0.05, `${tag}: ${what}: the back board's scene is lit at its tier (${mid?.lit} of ${mid?.dots} dots)`, mid);
		const sh = want.filter((t) => t >= 2).map((t) => r1(shakeAt(t)));
		check(sh.every((v) => v > 1) && shakeAt(0) === 0, `${tag}: ${what}: Mega and up shake as they are reached (${sh.join(', ')} px), Big does not`, sh);
		if (final === 4) {
			check(!!race, `${tag}: the Max scene runs the race in its bottom band (this run: ${race})`);
			// (2026-11-17) THE RACE OVER THE WHOLE COUNT: under way early in the count, at the finish line as the count lands
			const cs = rows.find((r) => r.countStart !== undefined)?.countStart;
			const ce = rows.filter((r) => r.countEnd !== undefined).at(-1)?.countEnd;
			const early = rows.find((r) => cs !== undefined && r.t >= cs + (ce - cs) * 0.15 && r.t < cs + (ce - cs) * 0.3);
			const mid = rows.find((r) => r.t >= cs + (ce - cs) * 0.5);
			// (the face is drawn at its own refresh, LED_BOARD.fps: read a step or two after the landing)
			const land = rows.find((r) => r.t >= ce + 80);
			const before = rows.filter((r) => r.t < ce).at(-1);
			check(!!early && early.raceAt > 0 && early.raceAt < 0.4 && mid.raceAt > 0.4 && mid.raceAt < 0.6 && before.raceAt < 1 && land.raceAt === 1, `${tag}: the race starts with the count and runs the whole of it (${early?.raceAt?.toFixed(3)} of its run 15 to 30% into the count, ${mid?.raceAt?.toFixed(3)} at half, ${before?.raceAt?.toFixed(3)} just before the landing, ${land?.raceAt} just after it lands)`, { cs, ce, early, mid, land });
		}
	}
	// a skip during the rise plays only the final tier's sound; a skip in the count, the tiers reached and the final
	for (const [at, want] of [
		[300, ['sfx_win_mega']],
		[1000, ['sfx_win_big', 'sfx_win_mega']],
	]) {
		await tierSounds();
		await R(p, () => void window.__reindeer.scoreboardWin(98.75));
		await run(0, at);
		await R(p, () => window.__reindeer.scoreboardSkip());
		const rows = await run(at, 6000);
		const snd = await tierSounds();
		check(rows[rows.length - 1].phase === 'none' && snd.asked.join() === want.join(), `${tag}: a skip ${at} ms into a Mega win sounds ${snd.asked.join(', ') || 'nothing'} (want ${want.join(', ')})`, snd);
	}

	// a skip in a Max count lands it, and the race jumps to its finish line
	{
		await R(p, () => void window.__reindeer.scoreboardWin(7777));
		await run(0, 2500);
		const pre = await R(p, () => window.__reindeer.scoreboardStep(10).show);
		await R(p, () => window.__reindeer.scoreboardSkip());
		const post = await R(p, () => window.__reindeer.scoreboardStep(80).show);
		await run(0, 9000);
		check(pre && pre.phase === 'count' && pre.maxRaceAt > 0 && pre.maxRaceAt < 1 && post && post.maxRaceAt === 1, `${tag}: a skip during the Max count lands it and the race jumps to its finish (${pre?.maxRaceAt?.toFixed(3)} of its run before, ${post?.maxRaceAt} after)`, { pre: pre && { phase: pre.phase, at: pre.maxRaceAt }, post: post && { phase: post.phase, at: post.maxRaceAt } });
	}

	// ---- THE CHASE AS RUNS draws the same picture as dot by dot ----
	const same = [];
	for (const [start, to] of [
		["void window.__reindeer.scoreboardWin(98.75)", 4000],
		["window.__reindeer.scoreboardCard('fs')", 1000],
		["window.__reindeer.scoreboardCard('sfs')", 3600],
		["window.__reindeer.scoreboardCard('total', { x: 248.5 })", 1500],
	]) {
		await p.evaluate(start);
		await run(0, to);
		const a = await R(p, () => {
			window.__reindeer.tune.ledBoard.fastChase = true;
			window.__reindeer.scoreboardStep(0);
			return [window.__reindeer.scoreboardFace('back').hash, window.__reindeer.scoreboardFace('strip').hash];
		});
		const b = await R(p, () => {
			window.__reindeer.tune.ledBoard.fastChase = false;
			window.__reindeer.scoreboardStep(0);
			const out = [window.__reindeer.scoreboardFace('back').hash, window.__reindeer.scoreboardFace('strip').hash];
			window.__reindeer.tune.ledBoard.fastChase = true;
			return out;
		});
		same.push(a.join() === b.join());
		await finish();
	}
	check(same.every(Boolean), `${tag}: the chase borders drawn as runs give the same dots as dot by dot (back board and strip, 4 scenes: ${same.join(' ')})`, same);

	// ---- THE GAG'S RULE ----
	await R(p, () => window.__reindeer.scoreboardGag());
	await step(200, 2);
	await R(p, () => void window.__reindeer.scoreboardWin(3.4));
	const g1 = await R(p, () => window.__reindeer.scoreboardStep(10));
	const rows = await run(0, 5000);
	const shownAt = rows.findIndex((r) => r.phase !== 'none');
	const log = await R(p, () => window.__reindeer.scoreboard().log.slice(-12));
	check(g1.pendingSmall && g1.gag && !g1.show && shownAt > 0 && rows[shownAt].phase !== 'none' && log.some((l) => l.what === 'small' && /after the gag/.test(l.detail)) && !log.some((l) => l.what === 'gag' && /cut/.test(l.detail ?? '')), `${tag}: a small win waits while the gag plays (the gag uncut) and shows after it (${410 + shownAt * 10} ms after the gag started)`, { g1: { pending: g1.pendingSmall, gag: g1.gag }, log });
	await run(0, 3000);
	await R(p, () => window.__reindeer.scoreboardGag());
	await step(200, 2);
	await R(p, () => void window.__reindeer.scoreboardWin(98.75));
	const g2 = await R(p, () => window.__reindeer.scoreboardStep(1000));
	// (2026-11-17: the gag never plays with the back board up; it used to keep playing under a Mega, the mock's rule)
	check(!g2.gag && g2.show?.kind === 'win' && g2.show.arrive, `${tag}: a Mega win (the back board) cuts the gag`, { gag: g2.gag, show: g2.show?.kind });
	await R(p, () => window.__reindeer.scoreboardSkip());
	await run(0, 4000);
	// and none starts while a card is up
	await R(p, () => window.__reindeer.scoreboardCard('total', { x: 248.5 }));
	await run(0, 1500);
	await R(p, () => window.__reindeer.scoreboardGag());
	const g3 = await R(p, () => window.__reindeer.scoreboardStep(100));
	check(!g3.gag && g3.show?.kind === 'total', `${tag}: no gag starts while the Total Win is up`, { gag: g3.gag, show: g3.show?.kind });
	await R(p, () => {
		window.__reindeer.scoreboardCardEnd();
		window.__reindeer.scoreboardLower();
	});
	await run(0, 3000);
	await R(p, () => window.__reindeer.scoreboardManual(false));
}

// ---- THE BACK BOARD'S TITLES AND AMOUNTS (2026-11-17): every title (BIG to MAX WIN, FREE SPINS, SUPER over the Super
// entry's number, TOTAL WIN) and every amount (the win's count, the entries' number, the Total Win) centered on the face by
// its drawn dots within 1 dot (the bouncing letters at rest), its margins equal, a title 4 dots or more clear of each side
// and its bounce inside the top, at every size; again with the class's size knob at 2 and 0.3, and the gap and bounce knobs
// at their ends. The amounts are judged at rest (a win's hold, a card waiting for its press).
const TITLE_MARGIN = 4;
async function titles(p, S) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	await R(p, () => window.__reindeer.scoreboardManual(true));
	const cls = await R(p, () => window.__reindeer.scoreboard().cls);
	const knob = cls === 'tablet' ? 'desktop' : cls;
	/** start a scene and step it to its end, every title and amount on the back board at each step */
	const sample = (start, ms) =>
		R(p, ([start, ms]) => {
			eval(start);
			const out = [];
			for (let t = 0; t < ms; t += 10) {
				const q = window.__reindeer.scoreboardStep(10);
				const f = window.__reindeer.scoreboardFace('back');
				if (q.show && f?.titles) for (const r of f.titles) out.push({ sceneT: q.show.sceneT, t: q.show.t, phase: q.show.phase, ...r, W: f.W, H: f.H });
				if (!q.show && t > 500) break;
			}
			window.__reindeer.scoreboardCardEnd();
			window.__reindeer.scoreboardLower();
			for (let t = 0; t < 3000; t += 10) window.__reindeer.scoreboardStep(10);
			return out;
		}, [start, ms]);
	const scenes = [
		['void window.__reindeer.scoreboardWin(98.75)', 9000],
		['void window.__reindeer.scoreboardWin(312.45)', 10000],
		['void window.__reindeer.scoreboardWin(7777)', 11000],
		["window.__reindeer.scoreboardCard('fs')", 4000],
		["window.__reindeer.scoreboardCard('sfs')", 4500],
		["window.__reindeer.scoreboardCard('total', { x: 248.5 })", 4500],
	];
	const judge = (rows) => {
		const by = new Map();
		for (const r of rows) {
			// at rest: TOTAL WIN after its drop, SUPER after its march, every amount in a hold or a wait (HERE WE GO, which
			// marches in and fades, is not a title at rest)
			if (r.kind === 'title' && r.str === 'TOTAL WIN' && r.sceneT < 350) continue;
			if (r.kind === 'title' && r.str === 'SUPER' && r.sceneT < 2100) continue;
			if (r.kind === 'title' && r.str === 'HERE WE GO') continue;
			if (r.kind === 'amount' && r.phase !== 'hold' && r.phase !== 'waits') continue;
			const key = `${r.kind}:${r.kind === 'amount' ? 'amount' : r.str}`;
			if (!by.has(key)) by.set(key, []);
			by.get(key).push(r);
		}
		const out = [];
		for (const [key, list] of by) {
			const W = list[0].W;
			const off = Math.max(...list.map((r) => Math.abs((r.x0 + r.x1) / 2 - W / 2)));
			const left = Math.min(...list.map((r) => r.x0));
			const right = W - Math.max(...list.map((r) => r.x1));
			const top = Math.min(...list.map((r) => r.y0 - r.lift));
			out.push({ key, str: list[0].str, kind: list[0].kind, W, H: list[0].H, ts: list[0].ts, off: r1(off), left, right, top, n: list.length });
		}
		return out;
	};
	const ok = (x) => x.off <= 1 && Math.abs(x.left - x.right) <= 2 && x.top >= 1 && (x.kind === 'title' ? x.left >= TITLE_MARGIN && x.right >= TITLE_MARGIN : x.left >= 2 && x.right >= 2);
	const all = [];
	for (const [start, ms] of scenes) all.push(...judge(await sample(start, ms)));
	const want = ['BIG WIN', 'SUPER WIN', 'MEGA WIN', 'EPIC WIN', 'MAX WIN', 'FREE SPINS', 'SUPER', 'TOTAL WIN'];
	const seen = new Set(all.filter((x) => x.kind === 'title').map((x) => x.str));
	check(want.every((w) => seen.has(w)) && all.some((x) => x.kind === 'amount'), `${tag}: every back board title and amount drawn and measured (${[...seen].join(', ')}; ${all.filter((x) => x.kind === 'amount').length} amount groups)`);
	for (const x of all) check(ok(x), `${tag}: ${x.kind === 'title' ? x.str : `the amount (${x.str})`} (size ${x.ts}) centered on the ${x.W} x ${x.H} face within ${x.off} dots (1 wanted), ${x.left} and ${x.right} dots clear left and right, ${x.top} dots under the top${x.kind === 'title' ? ' with its bounce' : ''}`, x);
	console.log(`  ${tag} titles and amounts (class ${knob}): ${all.map((x) => `${x.kind === 'amount' ? 'amount ' + x.str : x.str} s${x.ts} off ${x.off} L${x.left} R${x.right} T${x.top}`).join('; ')}`);
	// the taste knobs at their ends: still centered and inside the face
	for (const [label, set, reset] of [
		[`the ${knob} title size at 2`, `window.__reindeer.tune.ledBoard.titles.${knob}.size = 2`, `window.__reindeer.tune.ledBoard.titles.${knob}.size = 1`],
		[`the ${knob} title size at 0.3`, `window.__reindeer.tune.ledBoard.titles.${knob}.size = 0.3`, `window.__reindeer.tune.ledBoard.titles.${knob}.size = 1`],
		['the gap at 20 dots and the bounce at 2', 'window.__reindeer.tune.ledBoard.titles.gap = 20; window.__reindeer.tune.ledBoard.titles.bounce = 2', 'window.__reindeer.tune.ledBoard.titles.gap = 0; window.__reindeer.tune.ledBoard.titles.bounce = 1'],
	]) {
		await p.evaluate(set);
		const rows = [];
		for (const [start, ms] of [scenes[0], scenes[3], scenes[5]]) rows.push(...judge(await sample(start, ms)));
		await p.evaluate(reset);
		const bad = rows.filter((x) => !ok(x));
		check(rows.length >= 4 && bad.length === 0, `${tag}: ${label}: every title and amount centered and inside the face (${rows.map((x) => `${x.kind === 'amount' ? 'amount' : x.str} s${x.ts} off ${x.off} L${x.left} R${x.right} T${x.top}`).join(', ')})`, bad);
	}
	await R(p, () => window.__reindeer.scoreboardManual(false));
}

/** what the page shows of a card now */
const cardNow = (p) =>
	R(p, () => {
		const s = window.__reindeer.scoreboard();
		return { card: s.card, phase: s.show?.phase ?? 'none', kind: s.show?.kind ?? null, sceneT: s.show?.sceneT ?? null, amount: s.show?.amount ?? null, html: !!document.querySelector('.am-ui.wrap [data-round-card]'), board: document.querySelector('[data-round-board]')?.getAttribute('data-round-card') ?? null, log: s.log.slice(-4) };
	});

// ---- PART B: THE CARDS IN REAL BONUS ROUNDS (desktop) ----
// the showcase books as the fixtures hand them over (src/fixtures/showcaseBooks.ts): one round's events by its key
const BOOKS = (() => {
	const t = readFileSync(join(SRC, 'fixtures', 'showcaseBooks.ts'), 'utf8');
	const a = t.indexOf('SHOWCASE_ROUNDS = ') + 18;
	return JSON.parse(t.slice(a, t.lastIndexOf('] as unknown') + 1));
})();
const bookOf = (name) => {
	const r = BOOKS.find((x) => x.name === name);
	return r?.events ?? BOOKS.find((x) => x.name === r?.sameBookAs)?.events ?? [];
};

async function cards(p, S, full) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	await R(p, () => window.__reindeer.turbo(0));
	// (2026-11-17) natural_free_spins with no autoplay: THE ENTRY WAITS for the press (Corey: "Free Spin Entry does not wait
	// for Press for Continue"): untouched for 5.5 s it is still up and waiting; one press then continues; its Total Win plays
	// on the back board (Corey: "the Wrap up total was shown on the plain old card") and lands on the book's own wrap-up
	// amount, the one the old HTML card showed (freeSpinEnd's, the free spins' total; the HUD's WIN is the round's)
	const seen = { intro: null, waited: null, after: null, outro: null, outroHtml: false, landed: null };
	let introAt = null;
	let pressed = false;
	const a = await playRound(p, 'natural_free_spins', {
		limit: 240000,
		during: async (s, ms) => {
			const c = await cardNow(p);
			if ((c.card === 'fs' || c.card === 'sfs') && !pressed) {
				if (introAt === null) {
					introAt = ms;
					seen.intro = c;
				}
				// (5.5 s untouched, and pressed once the press line is up: on a slow page the scene's own clock runs behind
				// real time, and a press before the press line lands the scene instead of continuing)
				if (ms - introAt >= 5500 && c.phase === 'waits') {
					seen.waited = { ...c, after: ms - introAt };
					pressed = true;
					await p.mouse.click(S.vp.width / 2, S.vp.height * 0.3);
					await sleep(500);
					seen.after = await cardNow(p);
				}
			}
			if (c.card === 'total') {
				seen.outro ??= c;
				if (await R(p, () => !!document.querySelector('.am-ui.wrap [data-round-card="outro"]'))) seen.outroHtml = true;
				const sh = await R(p, () => window.__reindeer.scoreboard().show);
				// (landed: the count has reached its end; the last such reading is kept)
				if (sh && sh.kind === 'total' && sh.t >= sh.countEnd) seen.landed = sh;
				seen.totalSeen = sh ? { phase: sh.phase, t: sh.t, countEnd: sh.countEnd, amount: sh.amount } : seen.totalSeen;
			}
		},
	});
	check(!!seen.intro && seen.intro.board === 'intro' && !seen.intro.html, `${tag}: natural_free_spins: the entry plays on the back board (${seen.intro?.card}), the HTML card draws nothing`, seen.intro);
	check(!!seen.waited && (seen.waited.card === 'fs' || seen.waited.card === 'sfs') && seen.waited.phase === 'waits' && seen.waited.after >= 5000, `${tag}: with no autoplay the entry waits for the press: ${seen.waited ? Math.round(seen.waited.after) : 'none'} ms untouched and still up (${seen.waited?.phase})`, seen.waited);
	check(!!seen.after && seen.after.card !== 'fs' && seen.after.card !== 'sfs', `${tag}: one press then continues (the card after it: ${seen.after?.card ?? 'none'})`, seen.after);
	check(!!seen.outro && seen.outro.board === 'outro' && !seen.outroHtml && a.ok, `${tag}: its Total Win plays on the back board, not the HTML card, and the round comes back to rest (${a.ms} ms)`, { outro: seen.outro, html: seen.outroHtml, last: a.seen.slice(-3) });
	// (2026-11-17, the owner: the wrap-up's total is the round's, the HUD's WIN at the round's end: natural_free_spins's
	// trigger spin wins 50 of its 4570, so the board must read the 4570, not freeSpinEnd's 4520)
	const ev = bookOf('natural_free_spins');
	const fsEnd = ev.find((e) => e.type === 'freeSpinEnd')?.amount;
	const fin = ev.find((e) => e.type === 'finalWin')?.amount;
	const trig = ev.slice(0, ev.findIndex((e) => e.type === 'freeSpinTrigger')).filter((e) => e.type === 'winInfo').reduce((a, e) => a + e.totalWin, 0);
	const hud = await R(p, () => window.__reindeer.bookAmount(window.__reindeer.hud.win()));
	const got = seen.landed ? Number(String(seen.landed.amount).replace(/,/g, '')) : NaN;
	check(trig > 0 && Math.abs(got - hud) < 0.005 && Math.abs(hud - (await R(p, (a) => window.__reindeer.bookAmount(a), fin))) < 0.005, `${tag}: the Total Win lands on ${seen.landed?.amount}, the HUD's WIN at the round's end (${hud}: finalWin ${fin}, the trigger spin's ${trig} with the free spins' ${fsEnd})`, { landed: seen.landed, last: seen.totalSeen, fsEnd, fin, hud });
	if (!full) return;
	// THE GRANDMA GAG'S RULE (2026-11-17, Corey: "let's only do the Grandma Got Run Over by a Reindeer in regular games, and
	// free spins only on the first strike or when it results in a win"): every Grandma strike's ruling (the book handler's
	// mark) and every gag the strikes asked for (the dev hook's count)
	await R(p, () => {
		window.__reindeer.gagsAsked(true);
		window.__reindeer.roadSounds(true);
	});
	const strikes = [];
	const drainStrikes = async () => {
		const log = await R(p, () => window.__reindeer.roadSounds(true));
		for (const e of log) if (e.what === 'grandmaStrike') strikes.push(e.detail);
	};
	const base = await playRound(p, 'base_grandma_strike', { limit: 60000, during: drainStrikes });
	await drainStrikes();
	const baseCalls = await R(p, () => window.__reindeer.gagsAsked(true));
	check(base.ok && strikes.length === 1 && / gag true$/.test(strikes[0]) && /^basegame/.test(strikes[0]) && baseCalls === 1, `${tag}: base_grandma_strike: a base game Grandma strike plays the gag (${strikes.join('; ')}; gags asked ${baseCalls})`, { strikes, baseCalls });
	strikes.length = 0;
	// floor_top_up: its free spins hold three Grandma strikes (the round's first on a spin with no win, a later one on a
	// paying spin, a later one with no win); its wrap-up (a top-up) plays on the back board since 2026-11-17, its top-up line
	// scrolled on the strip, no HTML card
	let fIntro = null;
	let fPressed = 0;
	const top = { board: false, html: false, line: null, lineAt: 0, pressed: false, waited: false };
	const b = await playRound(p, 'floor_top_up', {
		limit: 240000,
		during: async (s, ms) => {
			await drainStrikes();
			const c = await cardNow(p);
			if (c.card === 'fs' || c.card === 'sfs') {
				fIntro ??= ms;
				if (fPressed < 2 && ms - fIntro > 1500 + fPressed * 800) {
					fPressed += 1;
					await p.mouse.click(S.vp.width / 2, S.vp.height * 0.3);
				}
			}
			if (c.card === 'total') {
				top.board = true;
				if (await R(p, () => !!document.querySelector('.am-ui.wrap [data-round-card="outro"]') || !!document.querySelector('[data-top-up]'))) top.html = true;
				const w = await R(p, () => window.__reindeer.scoreboardFace('strip')?.entryWait?.sentence ?? null);
				if (w && !top.line) {
					top.line = w;
					top.lineAt = ms;
				}
				// (the wrap-up with a line waits for the press with no autoplay: pressed 3 s after its line came)
				if (top.line && !top.pressed && ms - top.lineAt > 3000) {
					top.pressed = true;
					top.waited = (await cardNow(p)).card === 'total';
					await p.mouse.click(S.vp.width / 2, S.vp.height * 0.3);
				}
			}
		},
	});
	check(top.board && !top.html && !!top.line && /^Includes \$[0-9.,]+ added to bring this round up to its [0-9.]+x minimum\.$/.test(top.line) && top.waited && b.ok, `${tag}: floor_top_up: the wrap-up plays on the back board with its top-up line on the strip ("${top.line}"), no HTML card, it waits for the press, and the round ends`, top);
	await drainStrikes();
	const fsCalls = await R(p, () => window.__reindeer.gagsAsked(true));
	const rulings = strikes.map((x) => / gag (true|false)$/.exec(x)?.[1]);
	check(strikes.length === 3 && strikes.every((x) => /^freegame/.test(x)) && rulings.join() === 'true,true,false' && fsCalls === 2, `${tag}: floor_top_up's free spins: the first Grandma strike plays the gag, a later one on a paying spin plays it, a later one on a spin with no win does not (${strikes.join('; ')}; gags asked ${fsCalls})`, { strikes, fsCalls });
}

// ---- THE RACE'S RESULT CARDS (2026-11-17, Corey: the picture sat behind the words): REINDEER, POLICE CAR and the TIE, the
// pictures' columns and the words' lit columns never meet, all inside the strip
async function raceCards(p, S) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	await R(p, () => window.__reindeer.scoreboardManual(true));
	for (const force of ['reindeer', 'police', 'tie']) {
		const got = await R(p, (force) => {
			const h = window.__reindeer;
			h.scoreboardRace(force);
			const R0 = h.tune.ledBoard.race.runMs;
			const seen = [];
			for (let t = 0; t < R0 + 150 + 2400; t += 50) {
				h.scoreboardStep(50);
				const f = h.scoreboardFace('strip');
				if (f?.raceCard && (force !== 'tie' || f.raceCard.words === 'TIE')) seen.push({ ...f.raceCard, W: f.W, H: f.H });
			}
			return seen;
		}, force);
		const bad = got.filter((c) => c.pics.some(([a, b]) => !(b <= c.text[0] || c.text[1] <= a)) || c.pics.some(([a, b]) => a < 1 || b > c.W - 1) || c.text[0] < 1 || c.text[1] > c.W - 1);
		const c = got[0];
		check(got.length > 0 && bad.length === 0, `${tag}: the ${force} result card: picture${c?.pics.length > 1 ? 's' : ''} ${c ? c.pics.map(([a, b]) => `${a} to ${b}`).join(' and ') : 'none'}, the words "${c?.words}" ${c ? `${c.text[0]} to ${c.text[1]}` : ''} on the ${c?.W} dot strip: never over each other (${got.length} steps)`, bad.slice(0, 2));
	}
	await R(p, () => window.__reindeer.scoreboardManual(false));
}

// ---- THE DIM (2026-11-17, Corey: "the background fading is cut off, not covering the entire screen"): with the back board
// up the scene is dimmed edge to edge: the top band, the bottom band and the far left and right are darker than with the
// dim off
async function dimCheck(p, S) {
	const tag = `${S.name} ${S.vp.width}x${S.vp.height}`;
	const W = S.vp.width;
	const H = S.vp.height;
	const regions = { top: { x: W * 0.3, y: 2, w: W * 0.4, h: 8 }, bottom: { x: W * 0.3, y: H - 10, w: W * 0.4, h: 8 }, left: { x: 2, y: H * 0.35, w: 8, h: H * 0.2 }, right: { x: W - 10, y: H * 0.35, w: 8, h: H * 0.2 } };
	const mean = (png) => {
		let t = 0;
		for (let i = 0; i < png.data.length; i += 4) t += png.data[i] + png.data[i + 1] + png.data[i + 2];
		return t / (png.data.length / 4) / 3;
	};
	await R(p, () => window.__reindeer.scoreboardManual(true));
	await R(p, () => void window.__reindeer.scoreboardWin(98.75));
	await R(p, () => window.__reindeer.scoreboardStep(10, 150));
	const on = {};
	for (const [k, r] of Object.entries(regions)) on[k] = mean(await grab(p, r));
	const alpha = await R(p, () => window.__reindeer.tune.ledBoard.dim.alpha);
	await R(p, () => (window.__reindeer.tune.ledBoard.dim.alpha = 0));
	await R(p, () => window.__reindeer.scoreboardStep(10, 60));
	const off = {};
	for (const [k, r] of Object.entries(regions)) off[k] = mean(await grab(p, r));
	await R(p, (a) => (window.__reindeer.tune.ledBoard.dim.alpha = a), alpha);
	const rect = await R(p, () => window.__reindeer.scoreboard().dim.rect);
	await R(p, () => window.__reindeer.scoreboardSkip());
	await R(p, () => window.__reindeer.scoreboardStep(10, 600));
	await R(p, () => window.__reindeer.scoreboardManual(false));
	const ratio = Object.fromEntries(Object.keys(regions).map((k) => [k, Math.round((on[k] / Math.max(1, off[k])) * 100) / 100]));
	check(rect && rect.x <= 0 && rect.y <= 0 && rect.x + rect.w >= W && rect.y + rect.h >= H && Object.values(ratio).every((v) => v <= 0.85), `${tag}: with the back board up the dim covers the whole screen (${JSON.stringify(rect)}): top, bottom, left and right at ${Object.values(ratio).join(', ')} of their undimmed brightness (0.85 or less wanted)`, { on, off, rect });
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
		// cut by a Big message on the strip (part B: a small win waits for the gag instead; the scenes section checks it by hand)
		await R(p, () => window.__reindeer.scoreboardGag());
		await sleep(400);
		await R(p, () => void window.__reindeer.scoreboardWin(21.85));
		await sleep(150);
		const c1 = await R(p, () => ({ gag: window.__reindeer.scoreboard().gag, log: window.__reindeer.scoreboard().log.slice(-3) }));
		check(c1.gag === null && c1.log.some((l) => l.what === 'gag' && /cut: a win on the strip/.test(l.detail)), `${tag}: a Big win message on the strip cuts the gag short`, c1);
		await R(p, () => window.__reindeer.scoreboardSkip());
		await sleep(300);
		await R(p, () => window.__reindeer.scoreboardSkip());
		await sleep(1500);
		// cut by a new spin's press
		await R(p, () => window.__reindeer.scoreboardGag());
		await sleep(500);
		const r = await playRound(p, 'no_win_1', { limit: 30000 });
		const c2 = await R(p, () => window.__reindeer.scoreboard().log.slice(-6));
		check(r.ok && c2.some((l) => l.what === 'gag' && /cut: a new spin/.test(l.detail)), `${tag}: a new spin's press cuts the gag short`, c2);
		// a real Grandma strike starts it (base_grandma_strike: the reindeer strikes Grandma's car); part B: the round's own small
		// win no longer cuts it, it waits and shows after the gag
		const g = await playRound(p, 'base_grandma_strike', { limit: 60000 });
		await sleep(6000);
		const c3all = await R(p, () => window.__reindeer.scoreboard().log.slice(-14));
		// (this round's gag: the last start, and what follows it)
		const st = [...c3all].reverse().find((l) => l.what === 'gag' && l.detail === 'start');
		const c3 = st ? c3all.filter((l) => l.at >= st.at) : c3all;
		const cut = c3.find((l) => l.what === 'gag' && /cut/.test(l.detail ?? ''));
		const end = c3.find((l) => l.what === 'gag' && l.detail === 'end');
		const waited = c3.find((l) => l.what === 'small' && /waits for the gag/.test(l.detail ?? ''));
		const after = c3.find((l) => l.what === 'small' && /after the gag/.test(l.detail ?? ''));
		check(g.ok && !!st, `${tag}: a real strike on a Grandma starts the gag (base_grandma_strike)`, c3);
		check(!!st && !cut && !!end && end.at - st.at >= 4900 && !!waited && !!after && after.at >= end.at, `${tag}: in base_grandma_strike the gag plays its ${end && st ? end.at - st.at : '?'} ms, the round's small win waits and shows after it`, c3);
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
		await R(p, () => window.__reindeer.roadSounds(true));
		while (Date.now() - t0 < 150000) {
			const s = await R(p, () => {
				const s = window.__reindeer.scoreboard();
				return { id: s.show?.id ?? null, kind: s.show?.kind, hold: s.show ? s.show.exitAt - s.show.countEnd : null, count: s.show ? s.show.countEnd - s.show.countStart : null, plays: window.__reindeer.fixtures.log().plays.length, auto: document.querySelector('.hudp button.spin')?.getAttribute('aria-label') === 'Stop autoplay', fired: s.show?.fired ?? [] };
			});
			if (s.id && s.kind === 'win' && !shows.has(s.id)) shows.set(s.id, s);
			if (s.id && shows.has(s.id) && s.fired.length >= shows.get(s.id).fired.length) shows.get(s.id).fired = s.fired;
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
// part B: the tier sounds at turbo 2 in autoplay, once per tier per round (asked of the road's sound log)
const asked = (await R(p, () => window.__reindeer.roadSounds())).filter((e) => e.kind === 'sound' && /^sfx_win_(big|super|mega|epic|max)$/.test(e.what) && !/^stop/.test(e.detail || ''));
const firedAll = [...shows.values()].reduce((a, x) => a + x.fired.length, 0);
check(list.length >= 2 && list.every((x) => x.fired.join() === '0,1,2') && asked.length === firedAll, `${tag}: autoplay at turbo 2: each Mega round sounds Big, Super and Mega once (${asked.length} tier sounds for ${shows.size} wins: ${[...shows.values()].map((x) => x.fired.join('')).join(' ')})`, { asked: asked.map((e) => e.what), fired: [...shows.values()].map((x) => x.fired) });
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
				if (S.scenes && SEC('scenes')) await scenes(p, S);
				if (SEC('titles')) await titles(p, S);
				if (SEC('dim') && ['desktop', 'side', 'portrait'].includes(S.name)) await dimCheck(p, S);
				if (SEC('raceCard')) await raceCards(p, S);
				if (SEC('cards') && ['side', 'portrait'].includes(S.name)) await cards(p, S, false);
				if (S.flows && SEC('cards')) await cards(p, S, true);
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
