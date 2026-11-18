// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{game/bonusStockRules.ts,game/actor.ts,ui/controls.svelte.ts,ui/hud/HudKey.svelte}, packages/utils-xstate/src/**;
// WATCHES: ; __reindeer.stockRules, __reindeer.fixtures, __reindeer.hud, __reindeer.atRest, AUTOPLAY_RESUME_PAUSE_MS, bonusEntered, bonusLeft, autoSpinPause
// WATCHES: ; baseTurboLevel, turboLevel, autoStopOnFreeGames, autoPlayBonuses, data-l, data-round-card, .hudp, .fold-row, .go, button.catch
// WATCHES: apps/run_over_reindeer/src/{ui/SpinHotkey.svelte,ui/Chrome.svelte}; isSpaceHold
// WATCHES: apps/run_over_reindeer/src/ui/RoundCard.svelte; ROUND.introWaitsForPress, ROUND.lineOutroWaitsForPress, ROUND.autoplayMs, ROUND.introAutoMs, ROUND.outroAutoMs, ROUND.wrapAutoHoldMs, __reindeer.scoreboard
// THE STOCK RULES PROBE (game/bonusStockRules.ts, 2026-11-18): turbo and autoplay around a bonus round, the owner's
// standing rule for all his games. Every pause and level is read from the game (__reindeer.stockRules: the module's own
// AUTOPLAY_RESUME_PAUSE_MS and its log), never copied here. Sections (ONLY=entry,buy,resume,pause,stopbonus,stoppause,
// stopspin,stopfree,autocards,space):
//   entry      a natural Free Spins round from base turbo 0, 1 and 2 (set with the Turbo key): the level is 0 from the
//              entry on and the key shows it; the player raises it to 2 inside the round; after the wrap-up the base
//              level comes back (key and state), and the next entry is 0 again
//   buy        a Free Spins round started from the feature menu's mode (BONUS armed), from base 2: 0 at entry, 2 after
//   resume     a reload in the middle of a natural round with base 1 saved: 0 in the round, 1 after its wrap-up
//   pause      autoplay at base 0, 1 and 2 through a natural round: the next automatic spin starts the module's pause
//              of real time after the wrap-up clears (within one 60 Hz frame), the pause's own record likewise, the
//              Auto key live (enabled, pressable at its centre) during the free spins and the pause
//   stopbonus  autoplay, the Auto key pressed during a free spin: the run ends, the round plays on to its wrap-up at
//              the same speed (no hurry), no pause and no automatic spin follow
//   stoppause  the Auto key pressed during the pause: no automatic spin follows
//   stopspin   the Spin pressed during the pause: no automatic spin follows, and the slam stop's hurry is given back
//   stopfree   autoplay with Stop on Free Games: the run ends at the trigger, the round plays out, no pause, no spin
//   autocards  autoplay into Free Spins and Super with Autoplay Bonuses OFF (base 0, 2): the entry card and the wrap-up
//              wait for the press; ON (base 1, 0): the entry continues after ROUND.autoplayMs and the wrap-up
//              ROUND.wrapAutoHoldMs after its amount lands; a stop in the pause after it, no automatic spin
//   space      one press, one round (ui/SpinHotkey.svelte): a tap 1 round; held 6 s with auto-repeat 1; without 1
// In every section: nothing strands (every paying round played has its end-round, the game comes back idle and at
// rest with no card up) and no page error.
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3015 [ONLY=a,b] node tools/stock_rules_probe.mjs
// Uses the dev server that is already running. One headless browser, muted. Wrap it in the shared browser lock:
//   tools/browser_lock.sh run game -- node tools/stock_rules_probe.mjs
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3014';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (s) => !ONLY.length || ONLY.includes(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FRAME = 1000 / 60;
const VP = { width: 1440, height: 900 };

let pass = 0;
let fail = 0;
const check = (ok, what, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${!ok && detail !== undefined ? `\n     ${JSON.stringify(detail).slice(0, 700)}` : ''}`);
};

const SR = (p) => p.evaluate(() => window.__reindeer.stockRules());
const turboKey = (p) => p.evaluate(() => Number(document.querySelector('.hudp button[aria-label^="Turbo"]')?.dataset.l ?? -1));
const pressCard = (p) => p.evaluate(() => document.querySelector('button.catch')?.click());
/** the Auto key is there, enabled, and a press at its centre lands on it (nothing over it, pointer events on) */
const autoLive = (p) =>
	p.evaluate(() => {
		const k = document.querySelector('.hudp button[aria-label="Autoplay"]');
		if (!k) return { ok: false, why: 'missing' };
		const b = k.getBoundingClientRect();
		const at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
		let op = 1;
		for (let e = k; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
		const pe = getComputedStyle(k).pointerEvents;
		// hudOff: the HUD steps aside for a card (uiHide; ui/Chrome.svelte): its keys take no press until it is back
		const hudOff = !!document.querySelector('.am-ui.layer.hud-off');
		return { ok: !k.disabled && pe !== 'none' && !!at && (at === k || k.contains(at)), disabled: k.disabled, pe, hit: at === k || k.contains(at), op: Math.round(op * 100) / 100, hudOff };
	});

async function boot(browser, tag) {
	const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: 1 });
	// every RGS call the game makes, with its time (the fixture RGS answers inside the page: wrapped after it installs)
	await ctx.addInitScript(() => {
		window.__rgsCalls = [];
		const t = setInterval(() => {
			if (!window.__rorFixtures || window.__rgsWrapped) return;
			window.__rgsWrapped = true;
			clearInterval(t);
			const inner = window.fetch;
			window.fetch = (input, init) => {
				const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
				const m = /\/(wallet\/[a-z-]+|bet\/event)/.exec(url);
				if (m) window.__rgsCalls.push({ path: m[1], at: performance.now() });
				return inner(input, init);
			};
		}, 5);
	});
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=stock${tag}${Date.now()}`, { waitUntil: 'domcontentloaded' });
	await ready(p);
	return { ctx, p, errs };
}

async function ready(p) {
	for (let i = 0; i < 160; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && window.__reindeer.stockRules && document.querySelector('.hudp') && !document.querySelector('.landing'))).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(VP.width / 2, VP.height / 2).catch(() => {});
		await sleep(600);
	}
	await sleep(1000);
}

/** the base game's level by the Turbo key itself (the player's way), at rest */
async function setBaseTurbo(p, level) {
	for (let i = 0; i < 4 && (await turboKey(p)) !== level; i++) {
		await p.click('.hudp button[aria-label^="Turbo"]');
		await sleep(150);
	}
	const sr = await SR(p);
	return sr.turbo === level && sr.base === level;
}

/** wait until idle, at rest and no card, pressing cards (their own press catcher) as a player would */
async function settle(p, maxMs = 180000) {
	const t0 = Date.now();
	while (Date.now() - t0 < maxMs) {
		const st = await p.evaluate(() => ({ g: window.__reindeer.hud.gates(), idle: window.__reindeer.hud.idle(), rest: window.__reindeer.atRest() })).catch(() => null);
		if (st?.g > 0) await pressCard(p);
		else if (st?.idle && st.rest) return true;
		await sleep(300);
	}
	return false;
}

/** nothing stranded: idle, at rest, no card; every paying play has its end-round after it */
async function noStrand(p, tag, errs) {
	const ok = await settle(p, 60000);
	const st = await p.evaluate(() => ({ calls: window.__rgsCalls, plays: window.__reindeer.fixtures.log().plays, gates: window.__reindeer.hud.gates(), card: !!document.querySelector('button.catch') }));
	const plays = st.calls.filter((c) => c.path === 'wallet/play');
	const ends = st.calls.filter((c) => c.path === 'wallet/end-round');
	const missing = [];
	plays.forEach((c, i) => {
		const next = plays[i + 1]?.at ?? Infinity;
		const paid = (st.plays[i]?.payout ?? 0) > 0;
		if (paid && !ends.some((e) => e.at > c.at && e.at < next)) missing.push(`${i} ${st.plays[i]?.name}`);
	});
	check(ok && st.gates === 0 && !st.card && missing.length === 0 && plays.length === st.plays.length, `${tag}: nothing stranded (${plays.length} plays, ${ends.length} end-rounds, every paying round closed; idle, at rest, no card)`, { ok, missing, gates: st.gates });
	check(errs.length === 0, `${tag}: no page errors`, errs.slice(0, 4));
}

/** play one round with a forced book and watch it: entry level, the in-bonus raise, the exit level */
async function manualBonus(p, { raise = true } = {}) {
	const sr0 = await SR(p);
	const e0 = sr0.entries.length;
	const x0 = sr0.exits.length;
	await p.click('.hudp button.spin');
	let entryKey = null;
	let raised = false;
	const t0 = Date.now();
	while (Date.now() - t0 < 180000) {
		const s = await p.evaluate(() => ({ sr: window.__reindeer.stockRules(), g: window.__reindeer.hud.gates(), idle: window.__reindeer.hud.idle() }));
		if (s.sr.entries.length > e0 && entryKey === null) entryKey = await turboKey(p);
		if (s.g > 0) await pressCard(p);
		else if (raise && !raised && s.sr.gameType === 'freegame' && s.sr.entries.length > e0) {
			// the player raises the speed in the round, by the key: to instant
			while ((await turboKey(p)) !== 2) {
				await p.click('.hudp button[aria-label^="Turbo"]');
				await sleep(120);
			}
			raised = (await SR(p)).turbo === 2;
		}
		if (s.sr.exits.length > x0 && s.idle) break;
		await sleep(150);
	}
	const sr = await SR(p);
	return { entry: sr.entries[e0], exit: sr.exits[x0], entryKey, raised, after: { turbo: sr.turbo, base: sr.base, key: await turboKey(p) } };
}

async function sectionEntry(browser) {
	const { ctx, p, errs } = await boot(browser, 'entry');
	for (const L of [0, 1, 2]) {
		const set = await setBaseTurbo(p, L);
		await p.evaluate(() => window.__reindeer.fixtures.next('natural_free_spins'));
		const r = await manualBonus(p);
		check(set && r.entry && r.entry.from === L && r.entryKey === 0, `entry from base ${L}: the round starts at turbo 0 (was ${r.entry?.from}; the key shows ${r.entryKey})`, r);
		check(r.raised && r.exit && r.exit.from === 2 && r.exit.to === L && r.after.turbo === L && r.after.base === L && r.after.key === L, `entry from base ${L}: raised to 2 in the round, base ${L} back after the wrap-up (state ${r.after.turbo}, key ${r.after.key})`, r);
		await settle(p);
	}
	await noStrand(p, 'entry', errs);
	await ctx.close();
}

async function sectionBuy(browser) {
	const { ctx, p, errs } = await boot(browser, 'buy');
	await setBaseTurbo(p, 2);
	// the FAST LANE's Free Spins, loaded on Spin (the mode the menu's CONFIRM sets; fast_lane_probe covers the menu)
	await p.evaluate(() => window.__reindeer.hud.setMode('BONUS'));
	await sleep(300);
	const r = await manualBonus(p, { raise: false });
	const mode = await p.evaluate(() => window.__reindeer.hud.mode());
	check(r.entry && r.entry.from === 2 && r.entryKey === 0, `bought round from base 2: starts at turbo 0 (key ${r.entryKey})`, r);
	check(r.exit && r.after.turbo === 2 && r.after.key === 2 && mode === 'BASE', `bought round: base 2 back after the wrap-up, the mode back to BASE`, { r, mode });
	await noStrand(p, 'buy', errs);
	await ctx.close();
}

async function sectionResume(browser) {
	const { ctx, p, errs } = await boot(browser, 'resume');
	await setBaseTurbo(p, 1);
	await sleep(400); // the saved settings (components/Sound.svelte) write on the change
	await p.evaluate(() => window.__reindeer.fixtures.resume('natural_free_spins', 9)).catch(() => {});
	await sleep(1500);
	// (not ready(): the resumed round is busy, never at rest until its end; sampled from the first moment the HUD is up)
	let inRound = null;
	const t0 = Date.now();
	let x = null;
	let i = 0;
	while (Date.now() - t0 < 180000) {
		const st = await p.evaluate(() => ({ sr: window.__reindeer?.stockRules?.() ?? null, landing: !!document.querySelector('.landing'), hud: !!document.querySelector('.hudp button[aria-label^="Turbo"]'), gates: window.__reindeer?.hud?.gates?.() ?? 0 })).catch(() => null);
		i++;
		if (!st || !st.sr) {
			await sleep(300);
			continue;
		}
		if (st.landing) {
			if (i % 3 === 0) await p.mouse.click(VP.width / 2, VP.height / 2).catch(() => {});
		} else if (st.sr.gameType === 'freegame' && st.hud && inRound === null) inRound = { turbo: st.sr.turbo, base: st.sr.base, key: await turboKey(p) };
		if (st.sr.exits.length) {
			x = st.sr.exits[0];
			break;
		}
		if (st.gates > 0) await pressCard(p);
		await sleep(150);
	}
	await settle(p);
	const after = await SR(p);
	check(inRound && inRound.turbo === 0 && inRound.key === 0 && inRound.base === 1, `resumed round with base 1 saved: plays at turbo 0 (key ${inRound?.key}), base kept ${inRound?.base}`, inRound);
	check(x && after.turbo === 1 && (await turboKey(p)) === 1, `resumed round: base 1 back after its wrap-up`, { x, after: { turbo: after.turbo, base: after.base } });
	await noStrand(p, 'resume', errs);
	await ctx.close();
}

/** load an autoplay run of 25 from the Autoplay menu (optionally Stop on Free Games) and start it with Spin */
async function startAuto(p, { stopFree = false, autoBonuses = false } = {}) {
	await p.click('.hudp button[aria-label="Autoplay"]');
	await sleep(600);
	{
		const open = await p.evaluate(() => document.querySelector('.am-ui.layer.modals .fold-row')?.getAttribute('aria-expanded') === 'true');
		if (!open) await p.click('.am-ui.layer.modals .fold-row');
		await sleep(300);
		// (the menu keeps its switches between openings: each is set to the state asked for, by its aria-checked)
		const set = async (name, on) => {
			const t = p.locator(`.am-ui.layer.modals button.toggle:has-text("${name}")`);
			if (((await t.getAttribute('aria-checked')) === 'true') !== on) await t.click();
		};
		await set('Stop on Free Games', stopFree);
		await set('Autoplay Bonuses', autoBonuses);
		await sleep(200);
	}
	await p.click('.am-ui.layer.modals .go');
	await sleep(600);
	await p.click('.hudp button.spin');
}

/** autoplay through one natural round; act(stage, page) can press something; returns the round's records */
async function autoBonus(p, L, { stopFree = false, act = null } = {}) {
	const sr0 = await SR(p);
	const e0 = sr0.entries.length;
	const x0 = sr0.exits.length;
	const plays0 = await p.evaluate(() => window.__reindeer.fixtures.log().plays.length);
	await p.evaluate(() => window.__reindeer.fixtures.next('natural_free_spins'));
	await startAuto(p, { stopFree });
	const liveInSpins = [];
	const liveInPause = [];
	let entryKey = null;
	let raised = false;
	let acted = null;
	const hurry = [];
	const t0 = Date.now();
	while (Date.now() - t0 < 200000) {
		const s = await p.evaluate(() => ({ sr: window.__reindeer.stockRules(), g: window.__reindeer.hud.gates(), plays: window.__reindeer.fixtures.log().plays.length }));
		const inBonus = s.sr.entries.length > e0 && s.sr.exits.length === x0;
		if (inBonus && entryKey === null) entryKey = await turboKey(p);
		if (s.g > 0) {
			// a card: a player clears it (an autoplay card would also go by itself)
			if (stopFree || inBonus) await pressCard(p);
		} else if (inBonus && s.sr.gameType === 'freegame') {
			const live = await autoLive(p);
			if (s.sr.counter > 0) liveInSpins.push(live);
			hurry.push(s.sr.hurry);
			if (act && !acted) acted = await act('spins', p, s);
			// to keep the probe short: the player raises the bonus's speed (rule 2: it lasts the round only)
			if (!raised && s.sr.counter > 0) {
				while ((await turboKey(p)) !== 2) {
					await p.click('.hudp button[aria-label^="Turbo"]');
					await sleep(100);
				}
				raised = true;
			}
		} else if (s.sr.exits.length > x0 && s.plays === plays0 + 1 && s.sr.counter > 0) {
			// the pause: between the cleared wrap-up and the next automatic spin
			const since = await p.evaluate((x) => performance.now() - window.__reindeer.stockRules().exits[x].at, x0);
			if (since < s.sr.pauseMs - 60) liveInPause.push({ ...(await autoLive(p)), since: Math.round(since) });
			if (act && !acted) acted = await act('pause', p, s, since);
		}
		if (s.sr.exits.length > x0 && (s.plays > plays0 + 1 || s.sr.counter === 0)) {
			if (s.plays > plays0 + 1) break;
			// the run ended: wait a while to see that no spin follows
			await sleep(2500);
			break;
		}
		await sleep(80);
	}
	const sr = await SR(p);
	const plays = await p.evaluate(() => window.__reindeer.fixtures.log().plays.length);
	// stop whatever still runs (its round finishes), and settle
	if (sr.counter > 0) await p.click('.hudp button[aria-label="Autoplay"]').catch(() => {});
	await settle(p);
	await setBaseTurbo(p, L);
	return { entry: sr.entries[e0], exit: sr.exits[x0], pause: sr.pauses.find((q) => q.clearedAt >= (sr.exits[x0]?.at ?? Infinity) - 2), start: sr.starts.find((q) => q.at > (sr.exits[x0]?.at ?? Infinity)), entryKey, liveInSpins, liveInPause, plays: plays - plays0, acted, hurry, sr };
}

async function sectionPause(browser) {
	const { ctx, p, errs } = await boot(browser, 'pause');
	const pauseMs = (await SR(p)).pauseMs;
	for (const L of [0, 1, 2]) {
		await setBaseTurbo(p, L);
		const r = await autoBonus(p, L);
		const gap = r.start && r.exit ? r.start.at - r.exit.at : null;
		// the page's frames around the pause's end: a frame the main thread held across it delays any timer (the scene's
		// return to day lands in this second); the pause may end no later than one frame after the first frame past it
		const fr = r.pause?.frames ?? [];
		const before = fr.filter((t) => t <= (r.pause?.until ?? 0)).pop() ?? null;
		const after = fr.find((t) => t > (r.pause?.until ?? Infinity)) ?? null;
		const held = after !== null ? after - (before ?? r.pause.waitFrom) : null;
		const longest = fr.reduce((m, t, i) => (i ? Math.max(m, t - fr[i - 1]) : m), 0);
		// (a frame's callbacks run after its timestamp, the game's render first: "in that frame" is before the next one)
		const next = after !== null ? (fr.find((t) => t > after) ?? after + 2 * FRAME) : null;
		const lateOk = r.pause && r.pause.endedAt >= r.pause.until - 1 && (r.pause.endedAt - r.pause.until <= FRAME || (after !== null && r.pause.endedAt <= next));
		check(r.entry?.from === L && r.entryKey === 0, `autoplay, base ${L}: the round starts at turbo 0 (key ${r.entryKey})`, r.entry);
		check(r.exit?.auto && r.exit.to === L, `autoplay, base ${L}: base ${L} back at the wrap-up, the pause owed`, r.exit);
		check(r.pause && Math.abs(r.pause.until - r.pause.clearedAt - pauseMs) < 0.5, `autoplay, base ${L}: the pause is set to end the game's AUTOPLAY_RESUME_PAUSE_MS (${pauseMs}) of real time after the wrap-up clears, whatever the speed`, r.pause && { clearedAt: r.pause.clearedAt, until: r.pause.until });
		check(lateOk, `autoplay, base ${L}: the pause ended ${r.pause ? (r.pause.endedAt - r.pause.clearedAt).toFixed(1) : '?'} ms after the clear: within one frame of its end, or in the first frame the page drew after it (the frame across its end ${held?.toFixed(1)} ms; longest frame in the pause ${longest.toFixed(1)} ms)`, r.pause && { until: r.pause.until, endedAt: r.pause.endedAt, before, after });
		check(gap !== null && r.pause && r.start.at - r.pause.endedAt <= FRAME && gap >= pauseMs - 1, `autoplay, base ${L}: the next automatic spin starts ${gap?.toFixed(1)} ms after the clear, ${r.pause && r.start ? (r.start.at - r.pause.endedAt).toFixed(1) : '?'} ms after the pause (never sooner than ${pauseMs})`, { gap, exit: r.exit, start: r.start });
		console.log(`  INFO autoplay, base ${L}: pause frames: held across its end ${held?.toFixed(1)} ms, longest ${longest.toFixed(1)} ms, ${fr.length} frames`);
		const shown = r.liveInSpins.filter((x) => !x.hudOff);
		check(shown.length > 0 && shown.every((x) => x.ok), `autoplay, base ${L}: the Auto key live in every free spin sampled with the HUD up (${shown.length}; ${r.liveInSpins.length - shown.length} more while the HUD stepped aside for a card)`, shown.filter((x) => !x.ok).slice(0, 3));
		check(r.liveInPause.length > 0 && r.liveInPause.every((x) => x.ok), `autoplay, base ${L}: the Auto key live through the pause (${r.liveInPause.length} samples; opacity ${r.liveInPause.map((x) => `${x.op}@${x.since}`).join(' ')})`, r.liveInPause.filter((x) => !x.ok).slice(0, 3));
	}
	await noStrand(p, 'pause', errs);
	await ctx.close();
}

async function sectionStopBonus(browser) {
	const { ctx, p, errs } = await boot(browser, 'stopbonus');
	await setBaseTurbo(p, 0);
	const r = await autoBonus(p, 0, {
		act: async (stage, page, s) => {
			if (stage !== 'spins' || s.sr.counter === 0) return null;
			const b = await page.locator('.hudp button[aria-label="Autoplay"]').boundingBox();
			await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
			await sleep(100);
			return { counter: (await SR(page)).counter, turbo: (await SR(page)).turbo };
		},
	});
	check(r.acted && r.acted.counter === 0 && r.acted.turbo === 0, `stop during a free spin: the Auto key's press ends the run (counter ${r.acted?.counter})`, r.acted);
	check(!!r.exit && r.exit.auto === false && !r.pause && !r.start, `stop during a free spin: the round played on to its wrap-up, no pause owed, no automatic spin after it`, { exit: r.exit, pause: r.pause, start: r.start });
	check(r.plays === 1 && r.hurry.every((h) => h === 0), `stop during a free spin: one play only, the round never hurried (${r.hurry.length} samples)`, { plays: r.plays, hurry: [...new Set(r.hurry)] });
	await noStrand(p, 'stopbonus', errs);
	await ctx.close();
}

/** THE PRESS IN THE PAUSE, made in the page itself `at` ms after the wrap-up (exit x0) clears: the pause's second is the
 *  page's busiest (its frames ran 180 to 250 ms on the Mac), and a press sent from the probe arrived after the pause
 *  (each round trip waits for the page). The key is checked pressable at that moment (enabled, nothing over its centre,
 *  pointer events on). The result lands in window.__pausePress. */
const armPausePress = (p, sel, x0, at) =>
	p.evaluate(
		([sel, x0, at]) => {
			window.__pausePress = null;
			const poll = setInterval(() => {
				const ex = window.__reindeer.stockRules().exits[x0];
				if (!ex) return;
				if (!ex.auto) return clearInterval(poll);
				const since = performance.now() - ex.at;
				if (since < at) return;
				clearInterval(poll);
				const k = document.querySelector(sel);
				const b = k.getBoundingClientRect();
				const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
				const live = !k.disabled && (hit === k || k.contains(hit)) && getComputedStyle(k).pointerEvents !== 'none';
				k.click();
				window.__pausePress = { since: Math.round(since), live, counter: window.__reindeer.stockRules().counter };
			}, 5);
		},
		[sel, x0, at],
	);

async function sectionStopPause(browser, how) {
	const tag = how === 'spin' ? 'stopspin' : 'stoppause';
	const L = how === 'spin' ? 2 : 1;
	const { ctx, p, errs } = await boot(browser, tag);
	await setBaseTurbo(p, L);
	// THE PRESS, made in the page itself at PRESS_AT ms after the wrap-up clears: the pause's second is the page's busiest
	// (its frames ran 180 to 250 ms on the Mac), and a press sent from here arrived after the pause (each round trip waits
	// for the page); the key is checked pressable at that moment (enabled, nothing over its centre)
	const PRESS_AT = 300;
	const sel = how === 'spin' ? '.hudp button.spin' : '.hudp button[aria-label="Autoplay"]';
	const x0 = (await SR(p)).exits.length;
	await armPausePress(p, sel, x0, PRESS_AT);
	const r = await autoBonus(p, L, {
		act: async (stage, page) => (stage === 'pause' ? await page.evaluate(() => window.__pausePress) : null),
	});
	if (!r.acted) r.acted = await p.evaluate(() => window.__pausePress);
	check(!!r.acted && r.acted.live && r.acted.counter === 0, `${tag}: ${how === 'spin' ? 'the Spin' : 'the Auto key'} pressable ${r.acted?.since} ms into the pause, and its press ends the run (counter ${r.acted?.counter})`, r.acted);
	const after = await SR(p);
	check(!!r.acted && r.plays === 1 && !r.start, `${how === 'spin' ? 'Spin' : 'Auto key'} pressed ${r.acted?.since} ms into the pause: no automatic spin follows (plays ${r.plays})`, { acted: r.acted, start: r.start });
	// (a press that lands before the autoplay machine reaches its pause, while the end-round settles, leaves no pause at all)
	check(!r.pause || r.pause.counterAfter === 0, `${tag}: ${r.pause ? 'the pause ended with the run stopped' : 'the run was stopped before the pause began: none waited'}`, r.pause);
	if (how === 'spin') check(after.hurry === 0, `stopspin: the slam stop's hurry is given back after the pause (hurry ${after.hurry})`, after.hurry);
	await noStrand(p, tag, errs);
	await ctx.close();
}

async function sectionStopFree(browser) {
	const { ctx, p, errs } = await boot(browser, 'stopfree');
	await setBaseTurbo(p, 1);
	const r = await autoBonus(p, 1, { stopFree: true });
	check(r.entry?.stoppedRun === true && r.entry.from === 1, `Stop on Free Games: the run ends at the trigger (entry ${JSON.stringify(r.entry)})`, r.entry);
	check(!!r.exit && r.exit.auto === false && !r.pause && !r.start && r.plays === 1, `Stop on Free Games: the round plays out, no pause, no automatic spin (plays ${r.plays})`, { exit: r.exit, pause: r.pause, start: r.start });
	await noStrand(p, 'stopfree', errs);
	await ctx.close();
}

/** ONE PRESS, ONE ROUND (2026-11-18, Corey "Yes"; ui/SpinHotkey.svelte, Manticore Mayhem's rule and its probe's idea): a
 *  tap of Space plays one round; Space held 6 s, with the keyboard's auto-repeat or without, plays one round too; the kit's
 *  space hold never turns on (stateBet.isSpaceHold); a second press after the release plays the next one. */
async function sectionSpace(browser) {
	const { ctx, p, errs } = await boot(browser, 'space');
	const plays = () => p.evaluate(() => window.__reindeer.fixtures.log().plays.length);
	const idle = async () => {
		for (let i = 0; i < 300; i++) {
			if (await p.evaluate(() => window.__reindeer.hud.idle() && window.__reindeer.atRest())) return true;
			await sleep(200);
		}
		return false;
	};
	await p.evaluate(() => window.__reindeer.fixtures.next('no_win_1', true));
	let a = await plays();
	await p.keyboard.press('Space');
	await sleep(400);
	await idle();
	check((await plays()) - a === 1, `space: a tap plays one round (${(await plays()) - a})`);
	// held 6 s with the auto-repeat a real keyboard sends (a keydown every ~33 ms after the first)
	a = await plays();
	await p.keyboard.down('Space');
	let spaceHold = false;
	const t0 = Date.now();
	while (Date.now() - t0 < 6000) {
		await p.keyboard.down('Space');
		spaceHold ||= await p.evaluate(() => document.querySelector('.hudp button[aria-label^="Turbo"]')?.disabled === true);
		await sleep(33);
	}
	await p.keyboard.up('Space');
	await sleep(400);
	await idle();
	const heldRep = (await plays()) - a;
	check(heldRep === 1 && !spaceHold, `space: held 6 s with the key's auto-repeat, one round (${heldRep}); the kit's space hold never on`, { heldRep, spaceHold });
	// held 6 s, one keydown and no repeat
	a = await plays();
	await p.keyboard.down('Space');
	await sleep(6000);
	await p.keyboard.up('Space');
	await idle();
	const held = (await plays()) - a;
	check(held === 1, `space: held 6 s without repeat, one round (${held})`);
	// released and pressed again: the next round
	a = await plays();
	await p.keyboard.press('Space');
	await sleep(400);
	await idle();
	check((await plays()) - a === 1, `space: a new press after the release plays the next round`);
	await p.evaluate(() => window.__reindeer.fixtures.clear());
	await noStrand(p, 'space', errs);
	await ctx.close();
}

/** THE BONUS ROUND'S CARDS IN AUTOPLAY (Corey on staging 2026-11-18: "I had auto spins on, without the option selected
 *  for AutoPlay Bonuses, and it entered bonus games without me clicking to continue on the intro screen"): with a run live
 *  and Autoplay Bonuses OFF the entry card waits for the press; with it ON the card continues by itself after the game's
 *  ROUND.autoplayMs. The wrap-up's own timing is recorded (ROUND.outroAutoMs off, autoplayMs on) and checked against the
 *  game's constants. Timings are the game's (game/constants.ts ROUND, imported from the dev server). */
async function sectionAutoCards(browser) {
	const { ctx, p, errs } = await boot(browser, 'autocards');
	const ROUND = await p.evaluate(async () => (await import('/src/game/constants.ts')).ROUND);
	const CASES = [
		{ book: 'natural_free_spins', on: false, L: 0 },
		{ book: 'natural_super', on: false, L: 2 },
		{ book: 'natural_free_spins', on: true, L: 1 },
		{ book: 'natural_super', on: true, L: 0 },
	];
	for (const C of CASES) {
		const tag = `autoplay cards, ${C.book}, Autoplay Bonuses ${C.on ? 'ON' : 'OFF'}, base ${C.L}`;
		await setBaseTurbo(p, C.L);
		await p.evaluate((b) => window.__reindeer.fixtures.next(b), C.book);
		const plays0 = await p.evaluate(() => window.__reindeer.fixtures.log().plays.length);
		const x0 = (await SR(p)).exits.length;
		// the stop in the pause after the wrap-up, pressed in the page (armPausePress)
		await armPausePress(p, '.hudp button[aria-label="Autoplay"]', x0, 300);
		await startAuto(p, { autoBonuses: C.on });
		const card = () => p.evaluate(() => document.querySelector('[data-round-card]')?.getAttribute('data-round-card') ?? null);
		// the entry card comes up
		let introAt = null;
		const t0 = Date.now();
		while (Date.now() - t0 < 90000 && introAt === null) {
			if ((await card()) === 'intro') introAt = Date.now();
			else await sleep(50);
		}
		let introGoneAfter = null;
		const limit = C.on ? ROUND.autoplayMs + 800 : ROUND.introAutoMs + 1500;
		while (introAt !== null && Date.now() - introAt < limit) {
			if ((await card()) !== 'intro') {
				introGoneAfter = Date.now() - introAt;
				break;
			}
			await sleep(50);
		}
		if (C.on) check(introAt !== null && introGoneAfter !== null && introGoneAfter >= ROUND.autoplayMs - 300, `${tag}: the entry card continues by itself (${introGoneAfter} ms; the game's ROUND.autoplayMs ${ROUND.autoplayMs})`, { introAt, introGoneAfter });
		else check(introAt !== null && introGoneAfter === null, `${tag}: the entry card still waits for the press ${limit} ms after it came up (ROUND.introAutoMs ${ROUND.introAutoMs} is not used in autoplay without the option)`, { introAt, introGoneAfter });
		// the player's press (the option off), then the round at instant speed (rule 2) to keep it short
		while ((await card()) === 'intro') {
			await pressCard(p);
			await sleep(300);
		}
		let raised = false;
		let outroAt = null;
		let landedAt = null;
		let outroGoneAfter = null;
		const t1 = Date.now();
		// (the wrap-up's own wait, unpressed: with the option off it waits for the press (Manticore's rule, 2026-11-18),
		// so the loop gives up ROUND.outroAutoMs + 1.5 s after it came up, the old self-continue's time and more)
		const outroLimit = C.on ? 15000 : ROUND.outroAutoMs + 1500;
		while (Date.now() - t1 < 200000) {
			const c = await card();
			if (!raised && c === null && (await SR(p)).gameType === 'freegame') {
				while ((await turboKey(p)) !== 2) {
					await p.click('.hudp button[aria-label^="Turbo"]');
					await sleep(100);
				}
				raised = true;
			}
			if (c === 'outro' && outroAt === null) outroAt = Date.now();
			// its amount landed: the LED board's Total Win count is done (or the HTML card is up)
			if (c === 'outro' && landedAt === null) {
				const ph = await p.evaluate(() => window.__reindeer.scoreboard?.()?.show?.phase ?? 'show');
				if (ph !== 'count' && ph !== 'rising' && ph !== 'switching') landedAt = Date.now();
			}
			if (outroAt !== null && c !== 'outro') {
				outroGoneAfter = Date.now() - outroAt;
				break;
			}
			if (outroAt !== null && Date.now() - outroAt > outroLimit) break;
			await sleep(50);
		}
		const stillUp = (await card()) === 'outro';
		if (C.on) {
			const held = outroGoneAfter !== null && landedAt !== null ? outroGoneAfter - (landedAt - outroAt) : null;
			console.log(`  INFO ${tag}: the wrap-up went by itself ${outroGoneAfter} ms after it came up, ${held} ms after its amount landed`);
			check(held !== null && Math.abs(held - ROUND.wrapAutoHoldMs) <= 350, `${tag}: the wrap-up continues by itself ${held} ms after its amount lands (the game's ROUND.wrapAutoHoldMs ${ROUND.wrapAutoHoldMs}; Manticore's rule)`, { outroGoneAfter, landedAt: landedAt && landedAt - outroAt });
		} else {
			check(outroAt !== null && stillUp && outroGoneAfter === null, `${tag}: the wrap-up still waits for the press ${outroLimit} ms after it came up (no self-continue with the option off; Manticore's rule)`, { outroAt, outroGoneAfter });
		}
		if (stillUp) {
			// the player's press clears it (a board card may need two: the first lands its count)
			for (let i = 0; i < 20 && (await card()) === 'outro'; i++) {
				await pressCard(p);
				await sleep(300);
			}
		}
		// the pause follows the cleared wrap-up; the Auto key's press (armed above) stops the run there
		await sleep(3000);
		const pressed = await p.evaluate(() => window.__pausePress);
		const plays = (await p.evaluate(() => window.__reindeer.fixtures.log().plays.length)) - plays0;
		check(plays === 1 && pressed?.live && pressed.counter === 0, `${tag}: the Auto key pressed ${pressed?.since} ms into the pause after the wrap-up: the run ends, no automatic spin (plays ${plays})`, { plays, pressed });
		// whatever happened, the next case starts from rest with no run live
		if ((await SR(p)).counter > 0) await p.click('.hudp button[aria-label="Autoplay"]').catch(() => {});
		await settle(p);
	}
	await noStrand(p, 'autocards', errs);
	await ctx.close();
}

const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
	if (want('entry')) await sectionEntry(browser);
	if (want('buy')) await sectionBuy(browser);
	if (want('resume')) await sectionResume(browser);
	if (want('pause')) await sectionPause(browser);
	if (want('stopbonus')) await sectionStopBonus(browser);
	if (want('stoppause')) await sectionStopPause(browser, 'auto');
	if (want('stopspin')) await sectionStopPause(browser, 'spin');
	if (want('stopfree')) await sectionStopFree(browser);
	if (want('autocards')) await sectionAutoCards(browser);
	if (want('space')) await sectionSpace(browser);
} catch (e) {
	fail++;
	console.log('FAIL probe error', e?.stack ?? e);
} finally {
	await browser.close();
}
console.log(`\nstock_rules_probe: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
