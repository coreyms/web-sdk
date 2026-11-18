// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,ui/hud/hudLayout.ts};
// WATCHES: ; __reindeer.atRest, __reindeer.boardLayout, __reindeer.fixtures, __reindeer.gameType, __reindeer.hud, __reindeer.scene
// WATCHES: ; data-title-sign, data-hud, data-hud-step, data-st, .hudp, .landing, .fb, .lb, .am-ui, .lbw, .value, .mp, .is-open, .mpsh, .layer
// WATCHES: ; .modals, .panel, .sweep, .go, .spin, .f2, .f1, .gy, .comet, .halo
// THE HUD PROBE (the house glass HUD from Manticore, "Win over Balance, Drop 6" plus round 6, in this game's "Frost"
// theme; ported from tools/manticore/hud_probe.js in the main repo). The HUD is HTML over the canvas (ui/Chrome*.svelte,
// ui/hud/*: ui/hud/hudLayout.ts places it in the mockup's own px, scaled by the chrome's fit). At each size:
//   · every control is there: Spin, the feature button (.fb), Menu, Auto, Turbo, minus, plus, and BALANCE, WIN and the
//     amount readouts; on the touch sizes each control's hit area (its box grown by its transparent ::after) is at least
//     44 x 44 CSS px
//   · no control and no readout overlaps the board (the five columns, __reindeer.boardLayout().css), the title sign
//     (the billboard logo, __reindeer.scene().logo.css, since scene pass 9), the bonus round's counter sign
//     ([data-title-sign]) or the reindeer's run band (the snow above the top lane, across the road picture's width: where
//     it runs before it turns down a reel, which is the board)
//   · the stepper keys never neighbour the Spin: their hit areas do not touch the Spin's, and the clear gap between
//     their circles and the Spin's is at least 18.5 mock px (x the HUD's scale)
//   · no control or readout changes its box between idle, spinning, autoplay running, a win shown, free spins, and
//     each Ante level on (0.5 px)
//   · the three amount fields hold the long values at their fixed type size: BALANCE "$9,999,999.99", WIN
//     "$1,250,000.00", the amount "$1,000.00"; the feature button's word stays inside the button (FAST LANE, ANTE)
//   · desktop sizes: the WIN readout's centre within 2 px of the viewport's vertical centre line
//   · the help menu opens fully on screen and off the Spin, and closes on a second Menu press; the Autoplay menu opens
//     fully on screen and closes on its close key
//   · portrait (round 6): one row inside the bar, left to right feature, Menu, Auto, Spin, Turbo, minus, plus; every key
//     inside the bar's height; WIN over BALANCE at the left and the amount at the right, BALANCE and the amount ending
//     just above the bar (0 to 4 mock px); each word 1 mock px over its number; no readout on a control; the key words 18 %
//     of their key's height
//   · no win streak on the glass after a win (.sweep)
//   · the words: no character outside printable ASCII in the HUD's and the Autoplay menu's visible text; in social mode
//     (?social=true) also no restricted word (bet, buy, cash, money, paid, credit, gamble, wager, stake), aria included
// With SHOTS=<dir> it saves the idle and the spinning HUD at each size (phones at device pixel ratio 3, the rest at 2).
// With FLIP=<file.json> it also records the Spin's Play to Stop motion frame by frame at 1440 x 900 (both directions).
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [ONLY=a,b] [SKIPFS=1] [SHOTS=dir] \
//     [FLIP=file] node tools/hud_probe.mjs
// Uses the dev server that is already running (it never starts one). One headless browser, closed at the end. Take the
// shared browser lock around it (mkdir /tmp/hud_mock_shot.lock ... rmdir).
import { createRequire } from 'node:module';
import { pressRoundCards } from './round_card_press.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3014';
const SHOTS = process.env.SHOTS || '';
const FLIP = process.env.FLIP || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// phone: the phone asset tier and touch; dpr: the capture density
const SIZES = [
	{ name: 'portrait', vp: { width: 390, height: 844 }, touch: true, phone: true, family: 'portrait' },
	{ name: 'short', vp: { width: 390, height: 620 }, touch: true, phone: true, family: 'portrait' },
	{ name: 'small', vp: { width: 360, height: 640 }, touch: true, phone: true, family: 'portrait' },
	{ name: 'big', vp: { width: 440, height: 956 }, touch: true, phone: true, family: 'portrait' },
	{ name: 'landscape', vp: { width: 844, height: 390 }, touch: true, phone: true, family: 'landscape' },
	{ name: 'ipad', vp: { width: 820, height: 1180 }, touch: true, phone: false, family: 'portrait' },
	{ name: 'ipad768', vp: { width: 768, height: 1024 }, touch: true, phone: false, family: 'portrait' },
	{ name: 'desk1610', vp: { width: 1440, height: 900 }, touch: false, phone: false, family: 'desktop', centre: true },
	{ name: 'desktop', vp: { width: 1920, height: 1080 }, touch: false, phone: false, family: 'desktop', centre: true },
	{ name: 'wide', vp: { width: 1920, height: 810 }, touch: false, phone: false, family: 'desktop', centre: true },
	{ name: 'mock1440', vp: { width: 1440, height: 810 }, touch: false, phone: false, family: 'desktop', centre: true },
	{ name: 'tablet', vp: { width: 1180, height: 820 }, touch: true, phone: false, family: 'desktop', centre: true },
];
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const CONTROLS = {
	spin: '.hudp button.spin',
	feature: '.hudp .fb',
	menu: '.hudp [data-hud="menu-key"]',
	auto: '.hudp button[aria-label="Autoplay"]',
	turbo: '.hudp button[aria-label^="Turbo"]',
	minus: '.hudp [data-hud-step="minus"]',
	plus: '.hudp [data-hud-step="plus"]',
};
const READOUTS = { balance: '.hudp [data-hud="balance"]', win: '.hudp [data-hud="win"]', amount: '.hudp [data-hud="amount"]' };
const BANNED = /\b(bets?|buy|buys|cash|money|paid|credits?|gamble|gambling|wager|wagers|stake)\b/i;

let pass = 0;
let fail = 0;
const fails = [];
const check = (ok, msg, detail) => {
	if (ok) pass += 1;
	else {
		fail += 1;
		fails.push(msg);
	}
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
};
const r1 = (v) => Math.round(v * 10) / 10;
const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

const H = () => window.__reindeer;

async function boot(browser, S, extra = '') {
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.phone ? 3 : 2, isMobile: S.touch && S.family !== 'desktop', hasTouch: S.touch });
	// (2026-11-17: the bonus entry waits for the press: round_card_press.mjs presses it on the old card's timing)
	await pressRoundCards(ctx);
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=hud${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}${extra}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 160; i++) {
		const ok = await p
			.evaluate(() => {
				const h = window.__reindeer;
				return !!(h && h.atRest && h.atRest() && h.hud && document.querySelector('.hudp') && !document.querySelector('.landing'));
			})
			.catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	await sleep(1200);
	return { ctx, p, errs };
}

/** press through every press-to-continue gate, wait until the game is idle and the board at rest */
async function settle(p, S, maxMs = 120000) {
	const t0 = Date.now();
	for (;;) {
		const st = await p.evaluate(() => ({ g: window.__reindeer.hud.gates(), idle: window.__reindeer.hud.idle(), rest: window.__reindeer.atRest() })).catch(() => null);
		if (st && st.g > 0) {
			await p.mouse.click(S.vp.width / 2, S.vp.height * 0.4).catch(() => {});
			await sleep(400);
			continue;
		}
		if (st && st.idle && st.rest) return true;
		if (Date.now() - t0 > maxMs) return false;
		await sleep(250);
	}
}

const snap = (p) =>
	p.evaluate(
		([C, R]) => {
			const box = (b) => ({ x0: b.left, y0: b.top, x1: b.right, y1: b.bottom });
			const out = { c: {}, r: {}, u: null };
			for (const [k, sel] of Object.entries(C)) {
				const el = document.querySelector(sel);
				if (!el) continue;
				const b = el.getBoundingClientRect();
				const u = el.offsetWidth ? b.width / el.offsetWidth : 1;
				out.u = out.u ?? u;
				const a = getComputedStyle(el, '::after');
				const has = a.content && a.content !== 'none';
				const n = (v) => (has && v !== 'auto' ? parseFloat(v) || 0 : 0);
				out.c[k] = { ...box(b), hit: { x0: b.left + n(a.left) * u, y0: b.top + n(a.top) * u, x1: b.right - n(a.right) * u, y1: b.bottom - n(a.bottom) * u }, disabled: el.disabled };
			}
			for (const [k, sel] of Object.entries(R)) {
				const el = document.querySelector(sel);
				if (el) out.r[k] = box(el.getBoundingClientRect());
			}
			return out;
		},
		[CONTROLS, READOUTS],
	);

/** the board (its five columns), the title sign, the reindeer's run band (the snow above the top lane, across the road
 *  picture: the picture is 1536 road px wide, the columns start at road x 142), CSS px */
const scene = (p) =>
	p.evaluate(() => {
		const L = window.__reindeer.boardLayout();
		const c = L.css;
		const k = c.width / 1250;
		// the title: the billboard logo in the canvas since scene pass 9 (__reindeer.scene().logo.css); the highway sign
		// ([data-title-sign]) now shows only in a bonus round, with its counter, and is checked as its own box
		const lg = window.__reindeer.scene?.()?.logo?.css;
		const t = lg ? { left: lg.x, top: lg.y, right: lg.x + lg.width, bottom: lg.y + lg.height } : null;
		const rs = document.querySelector('[data-title-sign]')?.getBoundingClientRect();
		return {
			kind: L.kind,
			board: { x0: c.x, y0: c.y, x1: c.x + c.width, y1: c.y + c.height },
			title: t ? { x0: t.left, y0: t.top, x1: t.right, y1: t.bottom } : null,
			round: rs ? { x0: rs.left, y0: rs.top, x1: rs.right, y1: rs.bottom } : null,
			run: { x0: c.x - 142 * k, x1: c.x + (1536 - 142) * k, y0: 0, y1: c.y },
		};
	});

const same = (a, b) => ['x0', 'y0', 'x1', 'y1'].every((k) => Math.abs(a[k] - b[k]) <= 0.5);
const compare = (name, label, base, now) => {
	const moved = [];
	for (const [k, v] of Object.entries(base.c)) if (now.c[k] && !same(v, now.c[k])) moved.push(`${k} ${JSON.stringify([r1(v.x0), r1(v.y0), r1(v.x1), r1(v.y1)])} -> ${JSON.stringify([r1(now.c[k].x0), r1(now.c[k].y0), r1(now.c[k].x1), r1(now.c[k].y1)])}`);
	for (const [k, v] of Object.entries(base.r)) if (now.r[k] && !same(v, now.r[k])) moved.push(`${k} readout moved`);
	const missing = Object.keys(base.c).filter((k) => !now.c[k]);
	check(moved.length === 0 && missing.length === 0, `${name}: no control or readout changes its box between idle and ${label}`, { moved, missing });
};

const featureWordInside = (p) =>
	p.evaluate(() => {
		const b = document.querySelector('.hudp .fb');
		const l = b?.querySelector('.lb');
		if (!b || !l) return null;
		const B = b.getBoundingClientRect();
		const R = l.getBoundingClientRect();
		const shown = getComputedStyle(l).display !== 'none';
		return { text: l.textContent.trim(), shown, inside: !shown || (R.left >= B.left - 0.5 && R.right <= B.right + 0.5 && R.top >= B.top - 0.5 && R.bottom <= B.bottom + 0.5), lb: [R.left, R.right, R.top, R.bottom].map((v) => Math.round(v * 10) / 10), btn: [B.left, B.right, B.top, B.bottom].map((v) => Math.round(v * 10) / 10) };
	});

const hudWords = (p) =>
	p.evaluate(() => {
		const out = [];
		const walk = (el) => {
			for (const n of el.childNodes) {
				if (n.nodeType === 3) {
					const t = n.textContent.trim();
					if (!t) continue;
					const e = n.parentElement;
					const cs = getComputedStyle(e);
					if (cs.display === 'none' || cs.visibility === 'hidden') continue;
					out.push(t);
				} else if (n.nodeType === 1) walk(n);
			}
		};
		document.querySelectorAll('.am-ui').forEach(walk);
		return out;
	});

async function spinOnce(p) {
	await p.evaluate(() => window.__reindeer.hud.emit({ type: 'bet' }));
	for (let i = 0; i < 60 && (await p.evaluate(() => window.__reindeer.hud.idle())); i++) await sleep(50);
}

async function runSize(browser, S) {
	const { ctx, p, errs } = await boot(browser, S);
	const name = `${S.name} ${S.vp.width}x${S.vp.height}`;
	await settle(p, S);
	await sleep(600);
	const idle = await snap(p);
	const sc = await scene(p);
	const u = idle.u ?? 1;
	if (SHOTS) await p.screenshot({ path: join(SHOTS, `${S.vp.width}x${S.vp.height}_idle.png`) });

	const want = Object.keys(CONTROLS);
	check(want.every((k) => idle.c[k]) && Object.keys(READOUTS).every((k) => idle.r[k]), `${name}: every control and readout present`, { controls: Object.keys(idle.c), readouts: Object.keys(idle.r) });
	if (S.touch) {
		const small = Object.entries(idle.c).filter(([, v]) => v.hit.x1 - v.hit.x0 < 43.9 || v.hit.y1 - v.hit.y0 < 43.9).map(([k, v]) => `${k} ${r1(v.hit.x1 - v.hit.x0)}x${r1(v.hit.y1 - v.hit.y0)}`);
		check(small.length === 0, `${name}: every control's hit area at least 44 x 44 CSS px`, small);
	}
	// clear of the scene
	const hits = [];
	const things = { ...Object.fromEntries(Object.entries(idle.c).map(([k, v]) => [k, v])), ...Object.fromEntries(Object.entries(idle.r).map(([k, v]) => [`${k} readout`, v])) };
	const bar = await p.evaluate(() => {
		const e = document.querySelector('.hudp [data-hud="bar"]');
		if (!e) return null;
		const b = e.getBoundingClientRect();
		return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom };
	});
	if (bar) things['portrait bar'] = bar;
	for (const [k, v] of Object.entries(things)) {
		for (const [what, rect] of Object.entries({ board: sc.board, 'title sign': sc.title, 'round counter sign': sc.round, "reindeer's run band": sc.run })) {
			if (rect && inter(v, rect) > 0.5) hits.push(`${k} on the ${what} (${r1(inter(v, rect))} px2)`);
		}
	}
	check(hits.length === 0, `${name}: no control or readout overlaps the board, the title sign or the reindeer's run band`, hits);
	const hudTop = Math.min(...Object.values(things).map((v) => v.y0));
	console.log(`  INFO ${name}: HUD scale ${r1(u * 100) / 100}; board ${r1(sc.board.x0)}..${r1(sc.board.x1)} x ${r1(sc.board.y0)}..${r1(sc.board.y1)}; HUD top ${r1(hudTop)} (${r1(hudTop - sc.board.y1)} px under the board)`);

	// the stepper keys and the Spin
	const sp = idle.c.spin;
	if (sp && idle.c.minus && idle.c.plus) {
		const circ = (b) => ({ cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, r: (b.x1 - b.x0) / 2 });
		const s = circ(sp);
		const gaps = ['minus', 'plus'].map((k) => {
			const c = circ(idle.c[k]);
			return { k, gap: Math.hypot(c.cx - s.cx, c.cy - s.cy) - c.r - s.r, touch: inter(idle.c[k].hit, sp.hit) > 0 };
		});
		check(gaps.every((g) => !g.touch), `${name}: the stepper keys' hit areas do not touch the Spin's`, gaps);
		check(gaps.every((g) => g.gap >= 18.5 * u - 0.5), `${name}: stepper to Spin clear gap at least 18.5 x ${r1(u * 100) / 100} = ${r1(18.5 * u)} px (${gaps.map((g) => `${g.k} ${r1(g.gap)}`).join(', ')})`, gaps);
	}
	// the portrait row (round 6)
	if (S.family === 'portrait') {
		const row = await p.evaluate(() => {
			const R = (e) => {
				if (!e) return null;
				const b = e.getBoundingClientRect();
				return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom };
			};
			const q = (s) => document.querySelector(s);
			const fz = (e) => (e ? parseFloat(getComputedStyle(e).fontSize) : null);
			const plane = q('.hudp');
			const u = plane.getBoundingClientRect().width / plane.offsetWidth;
			const word = (sel, key) => {
				const k = q(sel);
				const w = k?.querySelector(key);
				return k && w ? { font: fz(w) * u, h: k.getBoundingClientRect().height } : null;
			};
			const rd = (k) => {
				const e = q(`.hudp [data-hud="${k}"]`);
				return e ? { box: R(e), lb: R(e.querySelector('.lbw')), vl: R(e.querySelector('.value')), lbPx: fz(e.querySelector('.lbw')) * u, vlPx: fz(e.querySelector('.value')) * u } : null;
			};
			return {
				u,
				bar: R(q('.hudp [data-hud="bar"]')),
				hf: window.__reindeer.hud.frame(),
				words: { menu: word('.hudp [data-hud="menu-key"]', '.kl'), auto: word('.hudp button[aria-label="Autoplay"]', '.kl'), turbo: word('.hudp button[aria-label^="Turbo"]', '.kl'), feature: word('.hudp .fb', '.lb') },
				read: { win: rd('win'), balance: rd('balance'), amount: rd('amount') },
			};
		});
		const c = idle.c;
		const cx = (b) => (b.x0 + b.x1) / 2;
		const order = ['feature', 'menu', 'auto', 'spin', 'turbo', 'minus', 'plus'];
		const xs = order.map((k) => (c[k] ? cx(c[k]) : NaN));
		check(xs.every((x, i) => i === 0 || x > xs[i - 1]), `${name}: one row, left to right feature, Menu, Auto, Spin, Turbo, minus, plus`, xs.map(r1));
		check(c.turbo.x0 >= c.spin.x1 - 0.5 && c.turbo.x1 <= c.minus.x0 + 0.5, `${name}: Turbo sits between the Spin and minus`);
		const B = row.bar;
		const outside = order.filter((k) => k !== 'spin' && c[k] && (c[k].y0 < B.y0 - 0.5 || c[k].y1 > B.y1 + 0.5)).map((k) => `${k} ${r1(c[k].y0)}..${r1(c[k].y1)}`);
		check(!!B && outside.length === 0, `${name}: every key inside the bar's height (${B ? `${r1(B.y0)}..${r1(B.y1)}` : 'no bar'})`, outside);
		const R = row.read;
		const ru = row.u;
		const above = ['balance', 'amount'].map((k) => ({ k, gap: B.y0 - R[k].box.y1 }));
		check(above.every((a) => a.gap >= -0.5 && a.gap <= 4 * ru + 0.5), `${name}: BALANCE and the amount end just above the bar, never on it (${above.map((a) => `${a.k} ${r1(a.gap)} px`).join(', ')})`, above);
		check(R.win.box.y1 <= R.balance.box.y0 + 0.5 && R.win.box.x0 < 200 && R.amount.box.x1 > S.vp.width - 200, `${name}: WIN over BALANCE at the left, the amount at the right`);
		const wg = Object.entries(R).map(([k, v]) => ({ k, gap: v.vl.y0 - v.lb.y1 }));
		check(wg.every((g) => Math.abs(g.gap - ru) <= 0.6), `${name}: each word 1 mock px (${r1(ru)} px) over its number (${wg.map((g) => `${g.k} ${r1(g.gap)}`).join(', ')})`, wg);
		const onCtl = [];
		for (const [rk, rv] of Object.entries(R)) for (const [ck, cv] of Object.entries(c)) if (inter(rv.box, cv) > 0.5) onCtl.push(`${rk} on ${ck}`);
		check(onCtl.length === 0, `${name}: no readout on a control`, onCtl);
		const W = Object.entries(row.words)
			.filter(([, v]) => v)
			.map(([k, v]) => ({ k, ratio: v.font / v.h }));
		check(W.length === 4 && W.every((w) => Math.abs(w.ratio - 0.18) <= 0.006), `${name}: the key words 18 % of their key's height (${W.map((w) => `${w.k} ${(w.ratio * 100).toFixed(1)} %`).join(', ')})`, W);
		const sz = (b) => `${r1(b.x1 - b.x0)}x${r1(b.y1 - b.y0)}`;
		console.log(`  INFO ${name}: u ${ru.toFixed(3)}, row t ${row.hf ? row.hf.t.toFixed(3) : '-'}, band ${row.hf ? r1(row.hf.gap * ru) : '-'} px; Spin ${sz(c.spin)}, feature ${sz(c.feature)}, Menu ${sz(c.menu)}, Auto ${sz(c.auto)}, Turbo ${sz(c.turbo)}, minus ${sz(c.minus)}, plus ${sz(c.plus)}`);
		console.log(`  INFO ${name}: numbers ${R.balance.vlPx.toFixed(2)} px, words ${R.balance.lbPx.toFixed(2)} px; WIN top to the board ${r1(R.win.box.y0 - sc.board.y1)} px, Spin top to the board ${r1(c.spin.y0 - sc.board.y1)} px; minus to the Spin's edge ${r1(c.minus.x0 - c.spin.x1)} px`);
	}
	if (S.centre && idle.r.win) {
		const c = (idle.r.win.x0 + idle.r.win.x1) / 2;
		check(Math.abs(c - S.vp.width / 2) <= 2, `${name}: the WIN readout's centre ${r1(c)} within 2 px of the screen's centre ${S.vp.width / 2}`);
	}
	// the long values at the fixed type size
	const fits = await p.evaluate((R) => {
		const vals = { balance: '$9,999,999.99', win: '$1,250,000.00', amount: '$1,000.00' };
		const out = {};
		for (const [k, sel] of Object.entries(R)) {
			const el = document.querySelector(sel);
			if (!el) continue;
			const cl = el.cloneNode(true);
			cl.style.visibility = 'hidden';
			el.parentElement.appendChild(cl);
			const v = cl.querySelector('.value');
			v.textContent = vals[k];
			v.style.fontSize = '';
			const sb = cl.getBoundingClientRect();
			const vb = v.getBoundingClientRect();
			out[k] = { field: Math.round(sb.width * 10) / 10, value: Math.round(vb.width * 10) / 10, left: Math.round((vb.left - sb.left) * 10) / 10, right: Math.round((sb.right - vb.right) * 10) / 10, font: getComputedStyle(v).fontSize };
			cl.remove();
		}
		return out;
	}, READOUTS);
	check(Object.values(fits).length === 3 && Object.values(fits).every((f) => f.left >= -0.5 && f.right >= -0.5), `${name}: the long values fit their fields at the fixed type size`, fits);
	console.log(`  INFO ${name}: long values ${Object.entries(fits).map(([k, f]) => `${k} ${f.value} in ${f.field} at ${f.font}`).join(', ')}`);
	const fw = await featureWordInside(p);
	check(!!fw && fw.inside, `${name}: the feature button's word "${fw?.text}" ${fw?.shown ? 'inside the button' : '(icon only here)'}`, fw);

	// the words, real mode: no symbol character (the restricted words are checked in social mode, where the soc()
	// switch takes them out; real mode keeps "BET" as the house's soc() pattern does)
	const words = await hudWords(p);
	const bad = words.filter((w) => /[^\x20-\x7e]/.test(w));
	check(bad.length === 0, `${name}: the HUD's visible words carry no symbol character`, bad);

	// the help menu
	await p.click(CONTROLS.menu);
	await sleep(500);
	const mp = await p.evaluate(() => {
		const e = document.querySelector('.hudp .mp.is-open');
		if (!e) return null;
		const b = e.getBoundingClientRect();
		const body = e.querySelector('.mpsh').getBoundingClientRect();
		return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom, body: { x0: body.left, y0: body.top, x1: body.right, y1: body.bottom } };
	});
	check(!!mp && mp.x0 >= -0.5 && mp.y0 >= -0.5 && mp.x1 <= S.vp.width + 0.5 && mp.y1 <= S.vp.height + 0.5 && inter(mp.body, sp) === 0, `${name}: the help menu opens fully on screen, its body off the Spin`, mp);
	if (mp) console.log(`  INFO ${name}: help menu body over the board ${r1(inter(mp.body, sc.board))} px2`);
	if (SHOTS) await p.screenshot({ path: join(SHOTS, `${S.vp.width}x${S.vp.height}_menu.png`) });
	await p.click(CONTROLS.menu);
	await sleep(500);
	check(!(await p.evaluate(() => !!document.querySelector('.hudp .mp.is-open'))), `${name}: a second Menu press closes it`);
	// the Autoplay menu
	await p.click(CONTROLS.auto);
	await sleep(700);
	const am = await p.evaluate(() => {
		const e = document.querySelector('.am-ui.layer.modals .panel');
		if (!e) return null;
		const b = e.getBoundingClientRect();
		return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom, scroll: e.scrollHeight > e.clientHeight + 1 };
	});
	check(!!am && am.x0 >= -0.5 && am.y0 >= -0.5 && am.x1 <= S.vp.width + 0.5 && am.y1 <= S.vp.height + 0.5, `${name}: the Autoplay menu opens fully on screen`, am);
	if (am) console.log(`  INFO ${name}: Autoplay menu ${r1(am.x1 - am.x0)} x ${r1(am.y1 - am.y0)}${am.scroll ? ', scrolls' : ''}`);
	const amWords = (await hudWords(p)).filter((w) => /[^\x20-\x7e]/.test(w));
	check(amWords.length === 0, `${name}: the Autoplay menu's words carry no symbol character`, amWords);
	if (SHOTS && S.name === 'portrait') await p.screenshot({ path: join(SHOTS, `${S.vp.width}x${S.vp.height}_autoplay.png`) });
	await p.click('.am-ui.layer.modals button.x[aria-label="Close"]');
	let amOpen = true;
	for (let i = 0; i < 20 && amOpen; i++) {
		await sleep(150);
		amOpen = await p.evaluate(() => !!document.querySelector('.am-ui.layer.modals .panel'));
	}
	check(!amOpen, `${name}: its close key closes it`);

	// the Ante levels
	for (const mode of ['ANTE_2', 'ANTE_4', 'ANTE_10']) {
		await p.evaluate((m) => window.__reindeer.hud.setMode(m), mode);
		await sleep(450);
		const s = await snap(p);
		compare(name, `${mode} on`, idle, s);
		const f = await featureWordInside(p);
		const cls = await p.evaluate(() => document.querySelector('.hudp .fb')?.className ?? '');
		check(f?.text === 'ANTE' && f.inside && /\bante\b/.test(cls) && (mode === 'ANTE_10') === /\bsante\b/.test(cls), `${name}: ${mode}: the feature button says ${f?.text}, in its "on" state${mode === 'ANTE_10' ? ' with the double rim' : ''}`, { f, cls });
		if (SHOTS && mode === 'ANTE_10' && (S.name === 'portrait' || S.name === 'desk1610' || S.name === 'landscape')) await p.screenshot({ path: join(SHOTS, `${S.vp.width}x${S.vp.height}_ante10.png`) });
	}
	await p.evaluate(() => window.__reindeer.hud.setMode('BASE'));
	await sleep(300);
	// spinning, then a win (the fixture's base order: a plain spin, then a line win)
	let spun = null;
	let won = null;
	for (let i = 0; i < 8 && !won; i++) {
		await spinOnce(p);
		if (!spun) {
			await sleep(260);
			spun = await snap(p);
			if (SHOTS) await p.screenshot({ path: join(SHOTS, `${S.vp.width}x${S.vp.height}_spinning.png`) });
		}
		await settle(p, S);
		await sleep(700);
		if ((await p.evaluate(() => window.__reindeer.hud.win())) > 0) {
			won = await snap(p);
			check(!(await p.evaluate(() => !!document.querySelector('.hudp .sweep'))), `${name}: no win streak on the glass after a win`);
			if (SHOTS && (S.name === 'portrait' || S.name === 'desk1610')) await p.screenshot({ path: join(SHOTS, `${S.vp.width}x${S.vp.height}_win.png`) });
		}
	}
	if (spun) compare(name, 'spinning', idle, spun);
	if (won) compare(name, 'a win shown', idle, won);
	else console.log(`  NOTE ${name}: no win in 8 spins (the win state not compared)`);
	// autoplay running
	await p.click(CONTROLS.auto);
	await sleep(700);
	await p.click('.am-ui.layer.modals .go');
	await sleep(700);
	await p.click(CONTROLS.spin);
	let auto = null;
	for (let i = 0; i < 40 && !auto; i++) {
		await sleep(100);
		if (await p.evaluate(() => document.querySelector('.hudp button.spin')?.getAttribute('aria-label')?.startsWith('Stop autoplay') === true)) auto = await snap(p);
	}
	check(!!auto, `${name}: an autoplay run started from the loaded Spin`);
	if (auto) compare(name, 'autoplay running', idle, auto);
	await p.click(CONTROLS.spin).catch(() => {});
	await settle(p, S, 180000);
	// free spins (the fixture's natural free spins round)
	if (process.env.SKIPFS !== '1') {
		await p.evaluate(() => window.__reindeer.fixtures.next('natural_free_spins'));
		await spinOnce(p);
		let fs = null;
		const t0 = Date.now();
		while (!fs && Date.now() - t0 < 90000) {
			const st = await p.evaluate(() => ({ gt: window.__reindeer.gameType(), gates: window.__reindeer.hud.gates(), fs: !!document.querySelector('.hudp button.spin.m-feature') }));
			if (st.gates > 0) await p.mouse.click(S.vp.width / 2, S.vp.height * 0.4).catch(() => {});
			else if (st.gt === 'freegame' && st.fs) {
				await sleep(200);
				fs = await snap(p);
			}
			await sleep(300);
		}
		check(!!fs, `${name}: free spins reached`);
		if (fs) compare(name, 'free spins', idle, fs);
		// THE COUNTER'S ONE READING (2026-11-18): after a flip (spin 2 on) the button's text holds ONE number and OF the
		// total (the outgoing face is drawn from data-d by CSS, aria-hidden, no text), and its label says the same count
		if (fs) {
			let rd = null;
			const t1 = Date.now();
			while (Date.now() - t1 < 60000) {
				rd = await p.evaluate(() => {
					const b = document.querySelector('.hudp button.spin.m-feature');
					if (!b) return null;
					const old = b.querySelector('.cnt.old');
					return { text: b.innerText.replace(/\s+/g, ' ').trim(), label: b.getAttribute('aria-label'), old: old ? { hidden: old.getAttribute('aria-hidden'), text: old.textContent, d: old.dataset.d } : null };
				});
				if (rd?.old) break;
				const gates = await p.evaluate(() => window.__reindeer.hud.gates()).catch(() => 0);
				if (gates > 0) await p.mouse.click(S.vp.width / 2, S.vp.height * 0.4).catch(() => {});
				await sleep(250);
			}
			const m = rd ? /^(\d+) OF (\d+)$/.exec(rd.text) : null;
			const lm = rd ? /Free spins: (\d+) of (\d+)$/.exec(rd.label ?? '') : null;
			check(!!rd?.old && rd.old.hidden === 'true' && rd.old.text === '' && !!m && !!lm && m[1] === lm[1] && m[2] === lm[2], `${name}: the free spins counter reads once ("${rd?.text}", label "${rd?.label}"; the outgoing face aria-hidden, its digit "${rd?.old?.d}" not text)`, rd);
		}
		if (SHOTS && fs && (S.name === 'portrait' || S.name === 'desk1610' || S.name === 'landscape')) await p.screenshot({ path: join(SHOTS, `${S.vp.width}x${S.vp.height}_freespins.png`) });
		await settle(p, S, 240000);
	}
	const e = errs.filter((x) => !/favicon/.test(x));
	check(e.length === 0, `${name}: no console errors`, e.slice(0, 5));
	await ctx.close();
}

/** social mode: the words only */
async function socialWords(browser) {
	const S = SIZES[0];
	const { ctx, p } = await boot(browser, S, '&social=true');
	await settle(p, S);
	const w1 = await hudWords(p);
	await p.click(CONTROLS.menu);
	await sleep(500);
	const w2 = await hudWords(p);
	await p.click(CONTROLS.menu);
	await sleep(400);
	await p.click(CONTROLS.auto);
	await sleep(700);
	const w3 = await hudWords(p);
	const aria = await p.evaluate(() => [...document.querySelectorAll('.hudp [aria-label]')].map((e) => e.getAttribute('aria-label')));
	const all = [...w1, ...w2, ...w3];
	const bad = all.filter((w) => BANNED.test(w) || /[^\x20-\x7e]/.test(w));
	check(bad.length === 0, `social ${S.vp.width}x${S.vp.height}: the HUD, help menu and Autoplay menu words carry no restricted word and no symbol character`, bad);
	const badAria = aria.filter((w) => BANNED.test(w));
	check(badAria.length === 0, `social: the HUD's spoken labels (aria) carry no restricted word`, badAria);
	console.log(`  INFO social: amount word "${await p.evaluate(() => document.querySelector('.hudp [data-hud="amount"] .label')?.textContent)}"`);
	await ctx.close();
}

/** THE FLIP, frame by frame from the running game. Headless frames on a loaded machine come far apart, so the motion is
 *  read off the game's own CSS transitions instead: at the press, and when the round ends, every running animation on
 *  the Spin (the play glyph .f1, the stop square .f2, the glyph box .gy, the comet, the press ring .halo) is paused and
 *  stepped in 1/60 s frames, and the computed transform and opacity are read at each frame. The live frames seen are
 *  reported beside it. */
async function flip(browser) {
	const S = { name: 'flip', vp: { width: 1440, height: 900 }, phone: false, touch: false, family: 'desktop' };
	const { ctx, p } = await boot(browser, S);
	await settle(p, S);
	await sleep(400);
	// arm: the moment the Spin's data-st turns to `want`, flush style (the transitions start) and pause every animation on
	// the Spin's glyph parts, then step them in 1/60 s frames
	const arm = (want) =>
		p.evaluate((want) => {
			window.__flipCap = null;
			const b = document.querySelector('.hudp button.spin');
			const mo = new MutationObserver(() => {
				if (b.getAttribute('data-st') !== want) return;
				mo.disconnect();
				void getComputedStyle(b.querySelector('.f2') ?? b).transform;
				const parts = { f1: b.querySelector('.f1'), f2: b.querySelector('.f2'), gy: b.querySelector('.gy'), comet: b.querySelector('.comet'), halo: b.querySelector('.halo') };
				const anims = [];
				for (const el of Object.values(parts)) if (el) for (const a of el.getAnimations()) anims.push(a);
				const caught = anims.map((a) => a.currentTime ?? 0);
				for (const a of anims) a.pause();
				const m = (el, i) => {
					if (!el) return null;
					const t = getComputedStyle(el).transform;
					if (!t || t === 'none') return 1;
					const v = t.match(/matrix\(([^)]+)\)/);
					return v ? Math.round(parseFloat(v[1].split(',')[i]) * 1000) / 1000 : t;
				};
				const o = (el) => (el ? Math.round(parseFloat(getComputedStyle(el).opacity) * 1000) / 1000 : null);
				let end = 0;
				for (const a of anims) {
					const t = a.effect.getComputedTiming();
					end = Math.max(end, (t.delay ?? 0) + (t.activeDuration === Infinity ? 0 : t.activeDuration));
				}
				const rows = [];
				const step = 1000 / 60;
				for (let k = 0; k * step <= end + step; k++) {
					const at = k * step;
					for (const a of anims) a.currentTime = at;
					rows.push({ frame: k, ms: Math.round(at * 10) / 10, f1: m(parts.f1, 3), f2: m(parts.f2, 3), gy: m(parts.gy, 0), gyA: o(parts.gy), comet: o(parts.comet), halo: o(parts.halo) });
				}
				for (const a of anims) {
					try {
						a.finish();
					} catch {
						a.play();
					}
				}
				const nm = (a) => {
					const c = a.effect.target.getAttribute('class') || '';
					return c.split(' ')[0];
				};
				window.__flipCap = { st: want, caughtAtMs: caught.map((c) => Math.round(c * 10) / 10), anims: anims.map((a) => ({ el: nm(a), prop: a.transitionProperty ?? a.animationName, delay: a.effect.getComputedTiming().delay, dur: a.effect.getComputedTiming().duration, easing: a.effect.getComputedTiming().easing })), rows };
			});
			mo.observe(b, { attributes: true, attributeFilter: ['data-st'] });
		}, want);
	const take = async () => {
		for (let i = 0; i < 600; i++) {
			const c = await p.evaluate(() => window.__flipCap);
			if (c) return c;
			await sleep(25);
		}
		return { st: null, anims: [], rows: [] };
	};
	// live frame times around the press (what this machine actually painted)
	await p.evaluate(() => {
		window.__ft = [];
		const loop = (t) => {
			window.__ft.push(t);
			if (window.__ft.length < 400) requestAnimationFrame(loop);
		};
		requestAnimationFrame(loop);
	});
	await arm('run');
	await p.evaluate(() => document.querySelector('.hudp button.spin').click());
	const press = await take();
	await arm('idle');
	const end = await take();
	const ft = await p.evaluate(() => window.__ft);
	const gaps = ft.slice(1).map((t, i) => t - ft[i]);
	const med = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
	const out = { liveFrameMedianMs: Math.round(med * 10) / 10, press, end };
	if (FLIP) writeFileSync(FLIP, JSON.stringify(out, null, 1));
	const P = press.rows;
	const f1Shut = P.find((r) => r.f1 !== null && r.f1 <= 0.001);
	const f2Open = P.find((r) => r.f2 !== null && r.f2 > 0.001);
	check(press.st === 'run' && !!f1Shut && !!f2Open && f2Open.ms >= f1Shut.ms, `flip: on the press Play folds shut by ${f1Shut?.ms} ms, Stop opens from ${f2Open?.ms} ms (glyph state ${press.st})`, press.anims);
	const peak = Math.max(...P.map((r) => r.f2 ?? 0));
	check(peak > 1 && peak < 1.12, `flip: Stop opens with a small overshoot (peak scaleY ${peak})`);
	const E = end.rows;
	const eShut = E.find((r) => r.f2 !== null && r.f2 <= 0.001);
	const eOpen = E.find((r) => r.f1 !== null && r.f1 > 0.001);
	check(end.st === 'idle' && !!eShut && !!eOpen && eOpen.ms >= eShut.ms, `flip: at the round's end Stop folds shut by ${eShut?.ms} ms, Play opens from ${eOpen?.ms} ms`, end.anims);
	const haloEnd = Math.max(0, ...E.map((r) => r.halo ?? 0));
	const gyEnd = Math.max(...E.map((r) => (typeof r.gy === 'number' ? r.gy : 1)));
	check(haloEnd === 0 && gyEnd <= 1.0001, `flip: no halo and no pop at the round's end (halo opacity peak ${haloEnd}, glyph box scale peak ${gyEnd})`);
	console.log(`  INFO flip: live frames on this machine every ${out.liveFrameMedianMs} ms (median); ${P.length} press frames, ${E.length} end frames; press animations ${press.anims.map((a) => `${a.el.trim()} ${a.prop} ${a.delay}+${a.dur} ms`).join('; ')}`);
	await ctx.close();
}

(async () => {
	const browser = await chromium.launch();
	try {
		for (const S of SIZES) {
			if (ONLY.length && !ONLY.includes(S.name)) continue;
			try {
				await runSize(browser, S);
			} catch (e) {
				check(false, `${S.name}: ran to the end`, String(e).slice(0, 300));
			}
		}
		if (!ONLY.length || ONLY.includes('social')) {
			try {
				await socialWords(browser);
			} catch (e) {
				check(false, 'social: ran to the end', String(e).slice(0, 300));
			}
		}
		if (FLIP && (!ONLY.length || ONLY.includes('flip'))) {
			try {
				await flip(browser);
			} catch (e) {
				check(false, 'flip: ran to the end', String(e).slice(0, 300));
			}
		}
	} finally {
		await browser.close();
	}
	console.log(`\nhud_probe: ${pass} pass, ${fail} fail`);
	process.exit(fail ? 1 : 0);
})();
