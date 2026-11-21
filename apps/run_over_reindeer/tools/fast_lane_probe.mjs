// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{ui/FeatureMenu.svelte,ui/AutoplayModal.svelte,game/fastLaneMemory.ts};
// WATCHES: ; loadAutoplay, buyMode, autoSpinCost, unloadedByAutoplay, autoFirst, data-fl-auto, data-auto-drop, autoLimits, __reindeer.fixtures
// WATCHES: ; __reindeer.fastLane, __reindeer.hud, __reindeer.atRest, data-feature-menu, data-fl-confirm, data-fl-price
// WATCHES: ; --fl-s, ::after, data-fl-step, data-squeeze, flSqueezeOff, anteOnShort, loadedShort, data-fl-low, data-fl-step, data-menu-foot, .note, .act, .price, .go, data-fl-status, data-act, data-card, data-lvl, data-piece, data-plate, .tile, .miles, .chip, .landing, .hudp
// THE FAST LANE PROBE: the feature menu (ui/FeatureMenu.svelte, the redesign of 2026-11-17). At each size (desktop
// 1440 x 900 and 1920 x 1080, a phone held sideways 844 x 390, an upright phone 390 x 844 and the small 390 x 620):
//   · the HUD's feature button opens it; the X and Escape close it
//   · each tile (ANTE, FREE SPINS, SUPER FREE SPINS) shows its own plate; the Ante's three LEVEL stops (2x, 4x, 10x)
//     each show their name, their sign number, their odds rows and a price that is the current amount times the
//     RGS's own cost multiplier (stateConfig.betModes, the authenticate answer), never a number of the data file
//   · ACTIVATE opens the confirm card with the same amounts; Cancel and Escape close the card alone (the menu stays)
//   · CONFIRM on an Ante level switches it on and closes the menu; reopened, the Ante tile says ON, the plate SWITCH
//     OFF, and another level says CHANGE; SWITCH OFF returns to the base game and the plate says so
//   · CONFIRM on Super Free Spins loads it on Spin (the mode is SUPER) and closes the menu; reopened, the tile says
//     LOADED and the plate UNLOAD; UNLOAD returns to the base game
//   · in every state captured: every piece (title, HUD, close, hero, plate, tray, note) and the confirm card inside
//     the viewport; no two pieces overlap; nothing inside a piece leaves it; no text overflows its box (a fitted
//     amount, a name, an odds row); every button at least 44 x 44 CSS px
//   · the words: no character outside printable ASCII in the menu's and the card's visible text and labels, and no
//     restricted word (bet, buy, cash, money, paid, credit, gamble, wager, stake), in the standard and in a social
//     session (?social=true, desktop 1440 only)
//   · desktop 1440 only: the level stops move with the arrow keys; the feature button cannot open the menu during a
//     round
//   · AUTOPLAY NEVER PLAYS A LOADED FEATURE (2026-11-19, ui/controls.svelte.ts loadAutoplay / buyMode / autoSpinCost),
//     desktop 1440, standard and social (ONLY=autofeature): Super Free Spins loaded, then the Autoplay menu shows the
//     base game (its pill, its count rows, its LOAD total), names the feature LOAD unloads, keeps Stop on Free Games
//     available; LOAD unloads it at once (the mode BASE, the HUD's amount the base amount), the Fast Lane opens on its
//     tile saying it is unloaded, and no feature tile can be activated while the run waits (the Ante can); the run's
//     first play request carries BASE and the amount the screen showed, and the loss stop counts in base amounts.
//     Then a run loaded first: the feature tiles refuse, and the Autoplay menu's UNLOAD frees them. Then the Ante 4x
//     on: the menu and the HUD show its full price and the play request carries ANTE_4 at that price. With SHOTS the
//     menu, the HUD and the requests are saved (autofeature_<tag>_*.png, autofeature_<tag>.json).
// With SHOTS=<dir> it saves each state at each size (<size>_<n>_<state>.png).
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3016 [ONLY=a,b] [SHOTS=dir] \
//     node tools/fast_lane_probe.mjs
// Uses the dev server that is already running (it never starts one). One headless browser, muted, closed at the end.
// Wrap it in the shared browser lock: tools/browser_lock.sh run game -- node tools/fast_lane_probe.mjs
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3016';
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SIZES = [
	{ name: 'desk1440', vp: { width: 1440, height: 900 }, touch: false, phone: false, extra: true },
	{ name: 'desk1920', vp: { width: 1920, height: 1080 }, touch: false, phone: false },
	{ name: 'side844', vp: { width: 844, height: 390 }, touch: true, phone: true },
	{ name: 'up844', vp: { width: 390, height: 844 }, touch: true, phone: true },
	{ name: 'up620', vp: { width: 390, height: 620 }, touch: true, phone: true },
];
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const BANNED = /\b(bets?|betting|buy|buys|buying|cash|money|paid|credits?|gamble|gambling|wager|wagers|stake)\b/i;

let pass = 0;
let fail = 0;
const fails = [];
const check = (ok, msg, detail) => {
	if (ok) pass += 1;
	else {
		fail += 1;
		fails.push(detail === undefined ? msg : `${msg}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
	}
	return ok;
};

async function boot(browser, S, extra = '') {
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.phone ? 2 : 1, isMobile: S.touch, hasTouch: S.touch });
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=fl${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}${extra}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 160; i++) {
		const ok = await p
			.evaluate(() => {
				const h = window.__reindeer;
				return !!(h && h.atRest && h.atRest() && h.hud && h.fastLane && document.querySelector('.hudp') && !document.querySelector('.landing'));
			})
			.catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	await sleep(1000);
	return { ctx, p, errs };
}

const isOpen = (p) => p.evaluate(() => !!document.querySelector('[data-feature-menu]'));
const cardOpen = (p) => p.evaluate(() => !!document.querySelector('[data-fl-confirm]'));
const mode = (p) => p.evaluate(() => window.__reindeer.hud.mode().toUpperCase());

async function openMenu(p) {
	await p.click('.hudp .fb');
	for (let i = 0; i < 20 && !(await isOpen(p)); i++) await sleep(100);
	await sleep(900); // the open's slide and the tiles' drop
}
async function waitClosed(p) {
	for (let i = 0; i < 20 && (await isOpen(p)); i++) await sleep(100);
	return !(await isOpen(p));
}

/** the plate as drawn: its mode, name, sign number, price, odds rows, button */
const plate = (p) =>
	p.evaluate(() => {
		const q = (s) => document.querySelector(s);
		const pl = q('[data-plate]');
		return {
			key: pl?.dataset.plate,
			name: pl?.querySelector('h2')?.textContent.trim(),
			price: q('[data-fl-price]')?.textContent.trim(),
			rows: [...(pl?.querySelectorAll('.miles .mk') ?? [])].map((e) => e.textContent.trim()),
			values: [...(pl?.querySelectorAll('.miles .mv') ?? [])].map((e) => e.textContent.trim()),
			act: pl?.querySelector('[data-act]')?.dataset.act,
			actText: pl?.querySelector('[data-act]')?.textContent.trim(),
			actDisabled: pl?.querySelector('[data-act]')?.disabled,
			status: q('[data-fl-status]')?.textContent.trim() ?? null,
			sign: q('.hero .sign .num b')?.textContent.trim() ?? null,
			chips: Object.fromEntries([...document.querySelectorAll('.tile')].map((t) => [t.dataset.card, t.querySelector('.chip')?.textContent.trim() ?? null])),
		};
	});
/** what the price must read: the amount times the RGS's cost multiplier, in the game's one formatter */
const expectPrice = (p, key) => p.evaluate((k) => window.__reindeer.fastLane.expect(k), key);

/** layout checks of whatever is on screen now */
async function layout(p, S, tag) {
	const r = await p.evaluate(() => {
		const box = (e) => {
			const b = e.getBoundingClientRect();
			return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom, w: b.width, h: b.height };
		};
		const vis = (e) => {
			const b = e.getBoundingClientRect();
			const cs = getComputedStyle(e);
			return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
		};
		const menu = document.querySelector('[data-feature-menu]');
		const card = document.querySelector('[data-fl-confirm]');
		const pieces = [...(menu?.querySelectorAll('[data-piece]') ?? [])].filter(vis).map((e) => ({ name: e.classList[0], ...box(e), el: e }));
		const out = { pieces: pieces.map(({ el, ...rest }) => rest), inside: [], overflow: [], small: [], card: card ? box(card) : null };
		// nothing inside a piece leaves it (the hero's art turns and sways past its box on purpose: not checked)
		for (const pc of pieces) {
			if (pc.name === 'hero') continue;
			for (const d of pc.el.querySelectorAll('*')) {
				if (!vis(d) || d.closest('svg')) continue;
				const b = box(d);
				if (b.x0 < pc.x0 - 1.5 || b.y0 < pc.y0 - 1.5 || b.x1 > pc.x1 + 1.5 || b.y1 > pc.y1 + 1.5) out.inside.push({ piece: pc.name, el: d.className || d.tagName, b, pc: { x0: pc.x0, y0: pc.y0, x1: pc.x1, y1: pc.y1 } });
			}
		}
		// no text overflows its own box
		const texts = [...(menu?.querySelectorAll('h2, .amt, .val, .mk, .mv, .nm, .mult, .group-h span, .kick, .go, .lvl button, .title span') ?? []), ...(card?.querySelectorAll('h3, .rows div, button') ?? [])];
		for (const e of texts) {
			if (!vis(e)) continue;
			if (e.scrollWidth > e.clientWidth + 1) out.overflow.push({ el: e.className || e.tagName, text: e.textContent.trim().slice(0, 40), sw: e.scrollWidth, cw: e.clientWidth });
		}
		// every button big enough to press: its HIT AREA (2026-11-19): the drawn box, grown by its inert ::after target
		// (ui/FeatureMenu.svelte THE TOUCH TARGETS) where it has one, centred on it; and no two buttons' hit areas overlap
		const hits = [];
		for (const e of [...(menu?.querySelectorAll('button') ?? []), ...(card?.querySelectorAll('button') ?? [])]) {
			if (!vis(e) || e.closest('[inert]')) continue;
			const b = box(e);
			const k = e.offsetWidth ? b.w / e.offsetWidth : 1;
			const a = getComputedStyle(e, '::after');
			const aw = a.content && a.content !== 'none' && a.position === 'absolute' ? parseFloat(a.width) * k : 0;
			const ah = a.content && a.content !== 'none' && a.position === 'absolute' ? parseFloat(a.height) * k : 0;
			const w = Math.max(b.w, aw || 0);
			const h = Math.max(b.h, ah || 0);
			const cx = (b.x0 + b.x1) / 2;
			const cy = (b.y0 + b.y1) / 2;
			const name = e.dataset.card ?? e.dataset.lvl ?? e.dataset.act ?? e.dataset.flStep ?? e.getAttribute('aria-label') ?? e.className;
			hits.push({ name, x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 });
			if (w < 44 - 0.5 || h < 44 - 0.5) out.small.push({ el: name, w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10, drawn: [Math.round(b.w * 10) / 10, Math.round(b.h * 10) / 10] });
		}
		out.hitOverlap = [];
		for (let i = 0; i < hits.length; i++)
			for (let j = i + 1; j < hits.length; j++) {
				const a = hits[i];
				const c = hits[j];
				const ov = Math.max(0, Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0)) * Math.max(0, Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0));
				if (ov > 1) out.hitOverlap.push(`${a.name} / ${c.name} ${Math.round(ov)} px2`);
			}
		return out;
	});
	const W = S.vp.width;
	const H = S.vp.height;
	for (const pc of r.pieces) check(pc.x0 >= -0.5 && pc.y0 >= -0.5 && pc.x1 <= W + 0.5 && pc.y1 <= H + 0.5, `${S.name} ${tag}: ${pc.name} inside the viewport`, pc);
	for (let i = 0; i < r.pieces.length; i++)
		for (let j = i + 1; j < r.pieces.length; j++) {
			const a = r.pieces[i];
			const b = r.pieces[j];
			const ov = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
			check(ov < 1, `${S.name} ${tag}: ${a.name} and ${b.name} do not overlap`, { ov: Math.round(ov) });
		}
	check(r.inside.length === 0, `${S.name} ${tag}: nothing leaves its piece`, r.inside.slice(0, 4));
	check(r.overflow.length === 0, `${S.name} ${tag}: no text overflows`, r.overflow.slice(0, 4));
	check(r.small.length === 0, `${S.name} ${tag}: every button's hit area at least 44 x 44`, r.small.slice(0, 6));
	check(r.hitOverlap.length === 0, `${S.name} ${tag}: no two buttons' hit areas overlap`, r.hitOverlap.slice(0, 6));
	if (r.card) check(r.card.x0 >= 0 && r.card.y0 >= 0 && r.card.x1 <= W && r.card.y1 <= H, `${S.name} ${tag}: the confirm card inside the viewport`, r.card);
	return r;
}

/** the words of the menu and the card: visible text and labels */
async function words(p, S, tag) {
	const t = await p.evaluate(() => {
		const parts = [];
		for (const root of [document.querySelector('[data-feature-menu]'), document.querySelector('[data-fl-confirm]')]) {
			if (!root) continue;
			parts.push(root.innerText);
			for (const e of root.querySelectorAll('[aria-label]')) parts.push(e.getAttribute('aria-label'));
		}
		return parts.join('\n');
	});
	const bad = t.match(BANNED);
	check(!bad, `${S.name} ${tag}: no restricted word`, bad ? bad[0] : '');
	const odd = [...t].filter((c) => !/[\x20-\x7e\n\t]/.test(c));
	check(odd.length === 0, `${S.name} ${tag}: printable ASCII only`, odd.slice(0, 6).join(' '));
}

async function shot(p, S, n, state) {
	if (SHOTS) await p.screenshot({ path: `${SHOTS}/${S.name}_${n}_${state}.png` });
}

async function runSize(browser, S) {
	const { ctx, p, errs } = await boot(browser, S);
	const tag = S.name;
	check(await p.evaluate(() => !!window.__reindeer?.fastLane), `${tag}: the game booted with the menu's dev hook`);
	await p.evaluate(() => window.__reindeer.hud.setMode('BASE'));

	// open, the default tile
	await openMenu(p);
	check(await isOpen(p), `${tag}: the feature button opens the menu`);
	let pl = await plate(p);
	check(pl.key === 'ANTE_2', `${tag}: opens on the ANTE tile at 2x with nothing on`, pl.key);
	await p.click('[data-card="BONUS"]');
	await sleep(700);
	pl = await plate(p);
	check(pl.key === 'BONUS', `${tag}: the FREE SPINS tile shows its plate`, pl.key);
	check(pl.price === (await expectPrice(p, 'BONUS')), `${tag}: FREE SPINS price is the amount times the RGS cost`, { shown: pl.price, want: await expectPrice(p, 'BONUS') });
	await layout(p, S, 'free spins');
	await words(p, S, 'free spins');
	await shot(p, S, 1, 'free_spins');

	// Super
	await p.click('[data-card="SUPER"]');
	await sleep(700);
	pl = await plate(p);
	check(pl.key === 'SUPER' && pl.name === 'SUPER FREE SPINS', `${tag}: the SUPER tile shows its plate`, pl);
	check(pl.price === (await expectPrice(p, 'SUPER')), `${tag}: SUPER price is the amount times the RGS cost`, { shown: pl.price, want: await expectPrice(p, 'SUPER') });
	check(pl.rows.length >= 3, `${tag}: SUPER shows its odds rows`, pl.rows);
	await layout(p, S, 'super');
	await words(p, S, 'super');
	await shot(p, S, 2, 'super');

	// the Ante and its three stops
	await p.click('[data-card="ANTE"]');
	await sleep(700);
	const stops = await p.evaluate(() => [...document.querySelectorAll('[data-lvl]')].map((b) => b.dataset.lvl));
	check(stops.join() === 'ANTE_2,ANTE_4,ANTE_10', `${tag}: the plate has the three LEVEL stops`, stops);
	check(await p.evaluate(() => document.querySelectorAll('.tile[data-card^="ANTE"]').length === 1), `${tag}: ONE Ante tile`);
	let n = 3;
	for (const k of stops) {
		await p.click(`[data-lvl="${k}"]`);
		await sleep(350);
		pl = await plate(p);
		const cost = await p.evaluate((kk) => window.__reindeer.fastLane.rgsCost(kk), k);
		check(pl.key === k, `${tag}: stop ${k} shows its plate`, pl.key);
		check(typeof cost === 'number' && pl.name === `ANTE ${cost}x`, `${tag}: stop ${k} name follows the RGS cost`, { name: pl.name, cost });
		check(pl.sign === `${cost}X`, `${tag}: stop ${k} sign reads ${cost}X`, pl.sign);
		check(pl.price === (await expectPrice(p, k)), `${tag}: stop ${k} price is the amount times the RGS cost`, { shown: pl.price, want: await expectPrice(p, k) });
		check(pl.rows.length === 3 && pl.rows[0] === 'Free Spins', `${tag}: stop ${k} shows its odds rows`, pl.rows);
		await layout(p, S, `ante ${k}`);
		await words(p, S, `ante ${k}`);
		await shot(p, S, n++, `ante_${k.split('_')[1]}x`);
	}

	// ACTIVATE on 4x: the card; Cancel and Escape close the card alone
	await p.click('[data-lvl="ANTE_4"]');
	await sleep(300);
	await p.click('[data-act="activate"]');
	await sleep(500);
	check(await cardOpen(p), `${tag}: ACTIVATE opens the confirm card`);
	const cardText = await p.evaluate(() => document.querySelector('[data-fl-confirm]')?.innerText ?? '');
	check(cardText.includes('ANTE 4x') && cardText.includes(await expectPrice(p, 'ANTE_4')), `${tag}: the card names ANTE 4x and its price`, cardText.slice(0, 120));
	await layout(p, S, 'confirm ante');
	await words(p, S, 'confirm ante');
	await shot(p, S, n++, 'confirm_ante');
	await p.click('[data-act="cancel"]');
	await sleep(400);
	check(!(await cardOpen(p)) && (await isOpen(p)), `${tag}: Cancel closes the card, the menu stays`);
	await p.click('[data-act="activate"]');
	await sleep(400);
	await p.keyboard.press('Escape');
	await sleep(400);
	check(!(await cardOpen(p)) && (await isOpen(p)), `${tag}: Escape closes the card, the menu stays`);
	check((await mode(p)) === 'BASE', `${tag}: nothing switched on before CONFIRM`, await mode(p));

	// CONFIRM: the Ante is on, the menu closes
	await p.click('[data-act="activate"]');
	await sleep(400);
	await p.click('[data-act="confirm"]');
	check(await waitClosed(p), `${tag}: CONFIRM closes the menu`);
	check((await mode(p)) === 'ANTE_4', `${tag}: CONFIRM switches ANTE 4x on`, await mode(p));
	await sleep(400);
	await openMenu(p);
	pl = await plate(p);
	check(pl.key === 'ANTE_4' && pl.act === 'off' && pl.chips.ANTE === 'ON' && !!pl.status, `${tag}: reopened on the Ante: ON chip, SWITCH OFF, its line`, pl);
	await layout(p, S, 'ante on');
	await words(p, S, 'ante on');
	await shot(p, S, n++, 'ante_on');
	await p.click('[data-lvl="ANTE_10"]');
	await sleep(300);
	pl = await plate(p);
	check(pl.act === 'activate' && pl.actText === 'CHANGE', `${tag}: another level offers CHANGE`, pl.actText);
	await p.click('[data-lvl="ANTE_4"]');
	await sleep(300);
	await p.click('[data-act="off"]');
	await sleep(400);
	pl = await plate(p);
	check((await mode(p)) === 'BASE' && pl.act === 'activate' && !!pl.status && pl.chips.ANTE === null, `${tag}: SWITCH OFF returns to the base game and says so`, pl);

	// Super: confirm loads it on Spin
	await p.click('[data-card="SUPER"]');
	await sleep(700);
	await p.click('[data-act="activate"]');
	await sleep(500);
	check(await cardOpen(p), `${tag}: SUPER ACTIVATE opens the card`);
	await layout(p, S, 'confirm super');
	await words(p, S, 'confirm super');
	await shot(p, S, n++, 'confirm_super');
	await p.click('[data-act="confirm"]');
	check(await waitClosed(p), `${tag}: CONFIRM SUPER closes the menu`);
	check((await mode(p)) === 'SUPER', `${tag}: SUPER is loaded on Spin`, await mode(p));
	await sleep(400);
	await openMenu(p);
	pl = await plate(p);
	check(pl.key === 'SUPER' && pl.act === 'off' && pl.actText === 'UNLOAD' && pl.chips.SUPER === 'LOADED' && !!pl.status, `${tag}: reopened on SUPER: LOADED chip, UNLOAD, its line`, pl);
	await layout(p, S, 'loaded');
	await words(p, S, 'loaded');
	await shot(p, S, n++, 'super_loaded');
	await p.click('[data-act="off"]');
	await sleep(400);
	check((await mode(p)) === 'BASE', `${tag}: UNLOAD returns to the base game`, await mode(p));

	// close: the X, then Escape
	await p.click('[data-feature-menu] .close');
	check(await waitClosed(p), `${tag}: the X closes the menu`);
	await sleep(300);
	await openMenu(p);
	// nothing is on now and the tile looked at last was Super Free Spins: the menu opens back on it (Corey 2026-11-19)
	pl = await plate(p);
	check(pl.key === 'SUPER' && pl.act === 'activate', `${tag}: reopened with nothing on: the tile used last (SUPER), not the default`, pl.key);
	await p.keyboard.press('Escape');
	check(await waitClosed(p), `${tag}: Escape closes the menu`);

	if (S.extra) {
		// the level stops' keys
		await sleep(300);
		await openMenu(p);
		await p.click('[data-card="ANTE"]');
		await sleep(600);
		await p.click('[data-lvl="ANTE_2"]');
		await sleep(200);
		await p.keyboard.press('ArrowRight');
		await sleep(200);
		pl = await plate(p);
		check(pl.key === 'ANTE_4', `${tag}: ArrowRight moves the level to 4x`, pl.key);
		await p.keyboard.press('End');
		await sleep(200);
		pl = await plate(p);
		check(pl.key === 'ANTE_10', `${tag}: End moves the level to 10x`, pl.key);
		await p.keyboard.press('Escape');
		await waitClosed(p);
		// during a round the feature button does not open the menu
		await sleep(300);
		await p.evaluate(() => window.__reindeer.hud.emit({ type: 'bet' }));
		for (let i = 0; i < 40 && (await p.evaluate(() => window.__reindeer.hud.idle())); i++) await sleep(50);
		await p.click('.hudp .fb', { force: true, timeout: 2000 }).catch(() => {});
		await sleep(400);
		check(!(await isOpen(p)), `${tag}: the feature button does not open the menu during a round`);
	}

	check(errs.length === 0, `${tag}: no page errors`, errs.slice(0, 3));
	await ctx.close();
}

async function social(browser) {
	const S = SIZES[0];
	const { ctx, p, errs } = await boot(browser, { ...S, name: 'social1440' }, '&social=true');
	await openMenu(p);
	const tag = 'social1440';
	await words(p, S, `${tag} free spins`);
	await p.click('[data-card="ANTE"]');
	await sleep(600);
	await words(p, S, `${tag} ante`);
	await p.click('[data-act="activate"]');
	await sleep(500);
	await words(p, S, `${tag} confirm`);
	check(errs.length === 0, `${tag}: no page errors`, errs.slice(0, 3));
	await ctx.close();
}

// ---- AUTOPLAY NEVER PLAYS A LOADED FEATURE (2026-11-19) ------------------------------------------------------------
/** the last amount in a text ("SUPER | 300.00 SC" -> 300) */
const amountIn = (t) => {
	const m = String(t ?? '').match(/\d[\d,]*\.\d{2}/g);
	return m ? Number(m[m.length - 1].replace(/,/g, '')) : Number.NaN;
};
const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.005;
/** the Autoplay menu as drawn */
const autoMenu = (p) =>
	p.evaluate(() => {
		const m = document.querySelector('.am-ui.layer.modals');
		const t = (e) => (e ? e.innerText.replace(/\s+/g, ' ').trim() : null);
		const tog = [...(m?.querySelectorAll('button.toggle') ?? [])].find((b) => /Stop on Free Games/.test(b.innerText));
		return {
			pill: t(m?.querySelector('.pill')),
			rows: [...(m?.querySelectorAll('.chips.four button') ?? [])].map(t),
			total: t(m?.querySelector('.total .v')),
			go: t(m?.querySelector('button.go')),
			drop: t(m?.querySelector('[data-auto-drop]')),
			stopFree: tog ? { disabled: tog.disabled, sub: t(tog.querySelector('.t-sub')) } : null,
			unload: !!m?.querySelector('button.unload'),
			step: t(m?.querySelector('.adj .mid')),
		};
	});
/** the HUD's amount readout and Spin face */
const hudNow = (p) =>
	p.evaluate(() => ({
		amount: document.querySelector('.hudp [data-hud="amount"]')?.innerText.replace(/\s+/g, ' ').trim() ?? null,
		spin: document.querySelector('.hudp button.spin')?.innerText.replace(/\s+/g, ' ').trim() ?? null,
		mode: window.__reindeer.hud.mode().toUpperCase(),
	}));
async function openAuto(p) {
	await p.click('.hudp button[aria-label="Autoplay"]');
	for (let i = 0; i < 20 && !(await p.evaluate(() => !!document.querySelector('.am-ui.layer.modals button.go'))); i++) await sleep(100);
	await sleep(700);
}
async function lossStop(p, label) {
	const folded = await p.evaluate(() => document.querySelector('.am-ui.layer.modals .fold-row')?.getAttribute('aria-expanded') !== 'true');
	if (folded) await p.click('.am-ui.layer.modals .fold-row');
	await sleep(300);
	await p.locator('.am-ui.layer.modals .fold-body .sec').first().locator('button.lim', { hasText: label }).click();
	await sleep(200);
}
async function loadRun(p) {
	await p.click('.am-ui.layer.modals button.go');
	await sleep(600);
}
/** press Spin, wait for the run's first play request, stop the run and wait for rest; the request and the stops */
async function runOnce(p) {
	const before = await p.evaluate(() => window.__reindeer.fixtures.log().plays.length);
	await p.click('.hudp button.spin');
	for (let i = 0; i < 60 && (await p.evaluate(() => window.__reindeer.fixtures.log().plays.length)) <= before; i++) await sleep(150);
	const limits = await p.evaluate(() => window.__reindeer.hud.autoLimits());
	const play = await p.evaluate((n) => window.__reindeer.fixtures.log().plays[n] ?? null, before);
	await p.click('.hudp button[aria-label="Autoplay"]').catch(() => {});
	for (let i = 0; i < 120; i++) {
		if (await p.evaluate(() => window.__reindeer.hud.idle() && window.__reindeer.hud.autoLimits().count === 0 && window.__reindeer.atRest())) break;
		await sleep(250);
	}
	await sleep(600);
	return { play, limits };
}
async function autoFeature(browser, isSocial) {
	const S = SIZES[0];
	const tag = isSocial ? 'autofeature_social' : 'autofeature';
	const { ctx, p, errs } = await boot(browser, { ...S, name: tag }, isSocial ? '&social=true' : '');
	const record = { tag, cases: [] };
	const snap = async (n) => SHOTS && (await p.screenshot({ path: join(SHOTS, `${tag}_${n}.png`) }));
	await p.evaluate(() => window.__reindeer.fixtures.next('plain_line_win', true));
	const base = amountIn(await p.evaluate(() => window.__reindeer.fastLane.expect('BASE')));
	const costOf = (m) => p.evaluate((k) => window.__reindeer.fastLane.rgsCost(k), m);

	// 1. Super Free Spins loaded (the Fast Lane's own CONFIRM), then the Autoplay menu
	await openMenu(p);
	await p.click('[data-card="SUPER"]');
	await sleep(500);
	await p.click('[data-act="activate"]');
	await sleep(500);
	await p.click('[data-act="confirm"]');
	check(await waitClosed(p), `${tag}: CONFIRM on Super Free Spins closes the menu`);
	const armedHud = await hudNow(p);
	check(armedHud.mode === 'SUPER', `${tag}: Super Free Spins is loaded`, armedHud);
	await openAuto(p);
	await p.locator('.am-ui.layer.modals .chips.four button').first().click(); // 10 spins (the menu keeps the last count)
	await sleep(300);
	const menu = await autoMenu(p);
	await snap('1_menu_super_loaded');
	check(/BASE/.test(menu.pill ?? '') && near(amountIn(menu.pill), base), `${tag}: with a feature loaded the Autoplay pill shows the base game at the base amount (${base})`, menu.pill);
	check(menu.rows.length >= 4 && near(amountIn(menu.rows[0]), 10 * base) && near(amountIn(menu.rows[1]), 25 * base), `${tag}: the count rows price base spins (10 and 25 x the base amount)`, menu.rows.slice(0, 2));
	check(near(amountIn(menu.total), 10 * base) && near(amountIn(menu.go), 10 * base), `${tag}: the total and the LOAD button price 10 base spins`, { total: menu.total, go: menu.go });
	check(near(amountIn(menu.step), base) && !/SUPER/.test(menu.step ?? ''), `${tag}: the menu's amount stepper shows the base amount, not the feature`, menu.step);
	check(/LOAD unloads SUPER FREE SPINS/.test(menu.drop ?? '') && /plays base game spins/.test(menu.drop ?? ''), `${tag}: the menu says LOAD unloads Super Free Spins and the run plays base spins`, menu.drop);
	await lossStop(p, '10x');
	const menuOpen = await autoMenu(p);
	check(menuOpen.stopFree && !menuOpen.stopFree.disabled && !/Unavailable/.test(menuOpen.stopFree.sub ?? ''), `${tag}: Stop on Free Games is available with a feature loaded`, menuOpen.stopFree);
	await snap('2_menu_stop_options');
	await loadRun(p);
	const loadedHud = await hudNow(p);
	await snap('3_hud_run_loaded');
	check(loadedHud.mode === 'BASE', `${tag}: LOAD unloads the feature at once (the mode is BASE before Spin)`, loadedHud);
	check(near(amountIn(loadedHud.amount), base) && !/SUPER/.test(loadedHud.amount ?? '') && !/SUPER/.test(loadedHud.spin ?? ''), `${tag}: the HUD shows the base amount beside the loaded run, no feature`, loadedHud);
	// the Fast Lane with the run waiting: Super's tile says it was unloaded, no feature tile activates, the Ante does
	await openMenu(p);
	const pl = await plate(p);
	await snap('4_fast_lane_run_loaded');
	check(pl.key === 'SUPER' && /is unloaded/.test(pl.status ?? ''), `${tag}: the Fast Lane opens on Super Free Spins saying it is unloaded`, pl);
	const parked = await p.evaluate(() => document.querySelector('[data-fl-auto]')?.textContent.trim() ?? null);
	check(pl.act === 'activate' && pl.actDisabled === true && /unload it in the Autoplay menu first/.test(parked ?? ''), `${tag}: ACTIVATE is unavailable on a feature while a run is loaded, and says so`, { pl, parked });
	await layout(p, S, `${tag} run loaded`);
	await words(p, S, `${tag} run loaded`);
	await p.click('[data-card="BONUS"]');
	await sleep(500);
	const plB = await plate(p);
	check(plB.actDisabled === true, `${tag}: Free Spins cannot be activated while a run is loaded`, plB);
	await p.click('[data-card="ANTE"]');
	await sleep(500);
	const plA = await plate(p);
	check(plA.actDisabled === false, `${tag}: the Ante can still be switched on while a run is loaded`, plA);
	await p.keyboard.press('Escape');
	await waitClosed(p);
	const r1 = await runOnce(p);
	record.cases.push({ case: 'SUPER loaded then autoplay 10', menu, hudLoaded: loadedHud, play: r1.play, limits: r1.limits });
	check(r1.play?.mode === 'BASE' && near(r1.play.amount * (await costOf('BASE')), amountIn(loadedHud.amount)), `${tag}: the run's first play request is BASE at the amount the HUD showed`, { play: r1.play, shown: loadedHud.amount });
	check(near(r1.limits.loss, 10 * base), `${tag}: the 10x loss stop counts in base amounts (${10 * base})`, r1.limits);

	// 2. a run loaded first, then the Fast Lane: the feature tiles refuse until the run is unloaded
	await openAuto(p);
	await loadRun(p);
	await openMenu(p);
	await p.click('[data-card="SUPER"]');
	await sleep(500);
	const plS = await plate(p);
	check(plS.actDisabled === true && (await p.evaluate(() => !!document.querySelector('[data-fl-auto]'))), `${tag}: with a run loaded first, Super Free Spins cannot be activated`, plS);
	await p.keyboard.press('Escape');
	await waitClosed(p);
	await openAuto(p);
	const m2 = await autoMenu(p);
	check(m2.unload && m2.drop === null, `${tag}: a run loaded in the base game: no unload line, UNLOAD CURRENT AUTO SPINS shown`, m2);
	await p.click('.am-ui.layer.modals button.unload');
	await sleep(600);
	await openMenu(p);
	await p.click('[data-card="SUPER"]');
	await sleep(500);
	const plS2 = await plate(p);
	check(plS2.actDisabled === false, `${tag}: after the run is unloaded Super Free Spins can be activated again`, plS2);
	record.cases.push({ case: 'autoplay loaded then feature', refused: plS.actDisabled, afterUnload: plS2.actDisabled });

	// 3. Ante 4x on, then autoplay: its full price everywhere, ANTE_4 in the request
	await p.click('[data-card="ANTE"]');
	await sleep(500);
	await p.click('[data-lvl="ANTE_4"]');
	await sleep(300);
	await p.click('[data-act="activate"]');
	await sleep(500);
	await p.click('[data-act="confirm"]');
	await waitClosed(p);
	const ante = base * (await costOf('ANTE_4'));
	await openAuto(p);
	const m3 = await autoMenu(p);
	await snap('5_menu_ante4');
	check(/ANTE/.test(m3.pill ?? '') && near(amountIn(m3.pill), ante) && near(amountIn(m3.rows[0]), 10 * ante) && near(amountIn(m3.step), ante) && m3.drop === null, `${tag}: with Ante 4x on the menu prices Ante spins (${ante}) and says nothing is unloaded`, m3);
	await loadRun(p);
	const anteHud = await hudNow(p);
	const r3 = await runOnce(p);
	record.cases.push({ case: 'Ante 4x then autoplay', menu: m3, hudLoaded: anteHud, play: r3.play, limits: r3.limits });
	check(r3.play?.mode === 'ANTE_4' && near(r3.play.amount * (await costOf('ANTE_4')), ante) && anteHud.mode === 'ANTE_4', `${tag}: the Ante run's play request is ANTE_4 at the price the menu showed`, { play: r3.play, hud: anteHud });
	await p.evaluate(() => {
		window.__reindeer.fixtures.clear();
		window.__reindeer.hud.setMode('BASE');
	});
	if (SHOTS) writeFileSync(join(SHOTS, `${tag}.json`), JSON.stringify(record, null, 1));
	check(errs.length === 0, `${tag}: no page errors`, errs.slice(0, 3));
	await ctx.close();
}

// ---- SHORT UPRIGHT SCREENS (2026-11-19, Corey on staging, about 390 x 580 in the lobby's frame, social, Ante 10x ON: "Found
// an edge case were buttons go off the card"). Heights 560 to 700 at 360 and 390 wide, standard and social, in the states
// that make the plate tallest: Ante ON at each level, another level (CHANGE), each feature tile, a feature LOADED (UNLOAD),
// the low balance line with long amounts. In each: the plate holds its buttons and their caption, the plate and the
// caption do not touch the foot, the amount stepper under the menu is on the screen, and the general layout checks.
// SHOTS: a capture of each Ante 10x ON (short_<w>x<h>_<session>.png); ?flSqueezeOff=1 (BEFORE=1) shows the menu as it was.
const STATE_SHARED = `/@fs${resolvePath(process.cwd(), '../../packages/state-shared/index.ts')}`;
const SHORT = [
	[360, 560], [360, 600], [360, 640], [360, 700],
	[390, 560], [390, 580], [390, 620], [390, 664], [390, 700],
];
const contain = (p) =>
	p.evaluate(() => {
		const box = (e) => {
			const b = e.getBoundingClientRect();
			return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom };
		};
		const menu = document.querySelector('[data-feature-menu]');
		const pl = menu.querySelector('.plate');
		const P = box(pl);
		const parts = [...pl.querySelectorAll('.act .price .amt, .act .price .lab, .act .go, .low, .lvl button, .miles, .status, h2')].filter((e) => e.getBoundingClientRect().height > 0);
		const out = parts.filter((e) => {
			const b = box(e);
			return b.x0 < P.x0 - 1 || b.y0 < P.y0 - 1 || b.x1 > P.x1 + 1 || b.y1 > P.y1 + 1;
		}).map((e) => `${e.className || e.tagName} ${JSON.stringify(box(e))}`);
		const note = box(menu.querySelector('.note'));
		const ov = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
		const cap = menu.querySelector('.act .price .lab');
		const steps = [...menu.querySelectorAll('[data-fl-step]')].map(box);
		return {
			out,
			plateNote: ov(P, note),
			capNote: cap ? ov(box(cap), note) : 0,
			stepsOn: steps.every((b) => b.y1 <= innerHeight + 0.5 && b.y0 >= 0),
			minStep: Math.min(...steps.map((b) => b.y1 - b.y0)),
			squeeze: Number(menu.querySelector('.stage')?.dataset.squeeze ?? -1),
		};
	});

async function shortHeights(browser) {
	for (const social of [false, true]) {
		// (SHORTSIZES=360x560,390x580 runs those alone)
		const only = (process.env.SHORTSIZES || '').split(',').filter(Boolean);
		for (const [w, h] of SHORT.filter(([a, b]) => !only.length || only.includes(`${a}x${b}`))) {
			const S = { name: `short${w}x${h}${social ? 's' : ''}`, vp: { width: w, height: h }, touch: true, phone: true };
			const tag = `${w}x${h}${social ? ' social' : ''}`;
			const { ctx, p, errs } = await boot(browser, S, `${social ? '&social=true' : ''}${process.env.BEFORE ? '&flSqueezeOff=1' : ''}`);
			const one = async (state) => {
				await sleep(500);
				const c = await contain(p);
				check(c.out.length === 0, `${tag} ${state}: every button and its caption inside the plate (squeeze ${c.squeeze})`, c.out.slice(0, 3));
				check(c.plateNote < 1 && c.capNote < 1, `${tag} ${state}: the plate and the caption do not overlap the foot`, c);
				check(c.stepsOn, `${tag} ${state}: the amount stepper on the screen (${Math.round(c.minStep)} px)`, c);
				await layout(p, S, state);
				return c;
			};
			// Ante ON, each level
			for (const k of ['ANTE_2', 'ANTE_4', 'ANTE_10']) {
				await p.evaluate((m) => window.__reindeer.hud.setMode(m), k);
				await openMenu(p);
				await p.click('[data-card="ANTE"]').catch(() => {});
				await sleep(400);
				await p.click(`[data-lvl="${k}"]`).catch(() => {});
				await one(`ante ${k} on`);
				if (k === 'ANTE_10' && SHOTS) await p.screenshot({ path: join(SHOTS, `short_${w}x${h}_${social ? 'social' : 'standard'}${process.env.BEFORE ? '_before' : ''}.png`) });
				// another level: CHANGE
				await p.click(`[data-lvl="${k === 'ANTE_2' ? 'ANTE_4' : 'ANTE_2'}"]`).catch(() => {});
				await one(`ante ${k} on, another level`);
				await p.keyboard.press('Escape');
				await waitClosed(p);
			}
			await p.evaluate(() => window.__reindeer.hud.setMode('BASE'));
			// the features, then SUPER loaded
			await openMenu(p);
			for (const t of ['BONUS', 'SUPER']) {
				await p.click(`[data-card="${t}"]`).catch(() => {});
				await one(`${t} tile`);
			}
			await p.keyboard.press('Escape');
			await waitClosed(p);
			await p.evaluate(() => window.__reindeer.hud.setMode('SUPER'));
			await openMenu(p);
			await p.click('[data-card="SUPER"]').catch(() => {});
			await one('SUPER loaded');
			await p.keyboard.press('Escape');
			await waitClosed(p);
			await p.evaluate(() => window.__reindeer.hud.setMode('BASE'));
			// the low balance line, long amounts (the amount the top of the ladder, every Ante level past the balance)
			await p.evaluate(async (path) => {
				const m = await import(path);
				m.stateBet.betAmount = 100;
			}, STATE_SHARED);
			await openMenu(p);
			await p.click('[data-card="ANTE"]').catch(() => {});
			await sleep(300);
			await p.click('[data-lvl="ANTE_10"]').catch(() => {});
			const low = await p.evaluate(() => !!document.querySelector('[data-fl-low]'));
			await one(`low balance (${low ? 'its line up' : 'no low line'})`);
			await p.keyboard.press('Escape');
			check(errs.filter((e) => !/favicon/.test(e)).length === 0, `${tag}: no page errors`, errs.slice(0, 3));
			await ctx.close();
		}
	}
}

const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
	for (const S of SIZES) {
		if (ONLY.length && !ONLY.includes(S.name)) continue;
		try {
			await runSize(browser, S);
		} catch (e) {
			check(false, `${S.name}: ran to the end`, String(e).slice(0, 300));
		}
	}
	if (!ONLY.length || ONLY.includes('short')) {
		try {
			await shortHeights(browser);
		} catch (e) {
			check(false, 'short: ran to the end', String(e).slice(0, 300));
		}
	}
	if (!ONLY.length || ONLY.includes('autofeature')) {
		for (const soc of [false, true]) {
			try {
				await autoFeature(browser, soc);
			} catch (e) {
				check(false, `autofeature${soc ? ' social' : ''}: ran to the end`, String(e).slice(0, 300));
			}
		}
	}
	if (!ONLY.length || ONLY.includes('social')) {
		try {
			await social(browser);
		} catch (e) {
			check(false, 'social: ran to the end', String(e).slice(0, 300));
		}
	}
} finally {
	await browser.close();
}
console.log(`fast_lane_probe: ${pass} passed, ${fail} failed`);
for (const f of fails) console.log('  FAIL ' + f);
process.exit(fail ? 1 : 0);
