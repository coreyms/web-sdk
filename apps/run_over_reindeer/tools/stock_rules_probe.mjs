// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{game/bonusStockRules.ts,game/actor.ts,ui/controls.svelte.ts,ui/hud/HudKey.svelte}, packages/utils-xstate/src/**;
// WATCHES: ; data-resume-card, data-resume
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,game/stateScene.svelte.ts}; sceneGap, sceneChangeGap, SCENE_GAP, sceneGaps, __reindeer.sceneSetting, __reindeer.sceneSwap, __reindeer.sceneSwapHold, data-scene-choice
// WATCHES: ; __reindeer.stockRules, __reindeer.fixtures, __reindeer.hud, __reindeer.atRest, AUTOPLAY_RESUME_PAUSE_MS, bonusEntered, bonusLeft, autoSpinPause
// WATCHES: ; baseTurboLevel, turboLevel, autoStopOnFreeGames, autoPlayBonuses, data-l, data-round-card, .hudp, .fold-row, .go, button.catch, .hud-held
// WATCHES: apps/run_over_reindeer/src/{ui/SpinHotkey.svelte,ui/Chrome.svelte}; isSpaceHold
// WATCHES: apps/run_over_reindeer/src/game/scoreboard/show.ts; LED_BOARD.ideas, motionFor
// WATCHES: apps/run_over_reindeer/src/{ui/hud/HudReadout.svelte,ui/hud/winOdometer.ts}; __reindeer.hud.winOdometer
// WATCHES: apps/run_over_reindeer/src/ui/RoundCard.svelte; ROUND.introWaitsForPress, ROUND.lineOutroWaitsForPress, ROUND.autoplayMs, ROUND.introAutoMs, ROUND.outroAutoMs, ROUND.wrapAutoHoldMs, __reindeer.scoreboard
// THE STOCK RULES PROBE (game/bonusStockRules.ts, 2026-11-18): turbo and autoplay around a bonus round, the owner's
// standing rule for all his games. Every pause and level is read from the game (__reindeer.stockRules: the module's own
// AUTOPLAY_RESUME_PAUSE_MS and its log), never copied here. Sections (ONLY=entry,buy,resume,pause,stopbonus,stoppause,
// stopspin,stopfree,autocards,space,scene):
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
//   scene      rule 5 (2026-11-24): the Scene setting pressed in the menu while an autoplay round runs. The set changes in
//              the hold after that round (stockRules().sceneGaps: taken, settled), the next spin starts only after the
//              hold with no fade running, the run's count goes on one by one; Dark then Snow, at 1440x900 base turbo 0
//              and 2, at 390x844, and with the browser's cache off; asked during a bonus round it waits for the round's
//              end; the Auto key or the Spin pressed during the hold ends the run, no spin follows, the Spin key plays
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
		// hudOff: the HUD steps aside for a card (uiHide; ui/Chrome.svelte): its keys take no press until it is back. Since
		// 2026-11-20 it stays on screen under a card, inert (hud-held, game/stateGame hudHeld): aside all the same
		const hudOff = !!document.querySelector('.am-ui.layer.hud-off, .am-ui.layer.hud-held');
		return { ok: !k.disabled && pe !== 'none' && !!at && (at === k || k.contains(at)), disabled: k.disabled, pe, hit: at === k || k.contains(at), op: Math.round(op * 100) / 100, hudOff };
	});

async function boot(browser, tag, { vp = VP, noCache = false } = {}) {
	const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
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
	if (noCache) {
		const cdp = await ctx.newCDPSession(p);
		await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
		// SCENE_NET_KBPS=1600 (by hand): the cache-off case on a slow line too, to read the hold's length there
		const kbps = Number(process.env.SCENE_NET_KBPS || 0);
		if (kbps > 0) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (kbps * 1000) / 8, uploadThroughput: (kbps * 1000) / 8 });
	}
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=stock${tag}${Date.now()}`, { waitUntil: 'domcontentloaded' });
	await ready(p, vp);
	return { ctx, p, errs };
}

async function ready(p, vp = VP) {
	for (let i = 0; i < 160; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && window.__reindeer.stockRules && document.querySelector('.hudp') && !document.querySelector('.landing'))).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(vp.width / 2, vp.height / 2).catch(() => {});
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
			// (the resume card, 2026-11-18: a reload into an open round asks Play Round or Skip to Result; Play Round here)
			if (i % 3 === 0) await p.evaluate(() => document.querySelector('[data-resume-card] [data-resume="play"]')?.click()).catch(() => {});
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

/** start an autoplay run of 25 with the Autoplay menu's START (optionally Stop on Free Games) */
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
	await p.click('.am-ui.layer.modals .go'); // START: the run begins at once (2026-11-23, no Spin press)
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
		let totalShow = null;
		let odoAtLand = null;
		const t1 = Date.now();
		// (the wrap-up's own wait, unpressed: with the option off it waits for the press (Manticore's rule, 2026-11-18),
		// so the loop gives up ROUND.outroAutoMs + 1.5 s after it came up, the old self-continue's time and more)
		const outroLimit = C.on ? 15000 : ROUND.outroAutoMs + 1500;
		while (Date.now() - t1 < 200000) {
			const c = await card();
			// (a Super round's wheel waits for its press when Autoplay Bonuses is off, 2026-11-18: ui/WheelGate.svelte; with
			// the option on it starts itself and is never there to press)
			await p.evaluate(() => document.querySelector('button[data-wheel-gate]')?.click()).catch(() => {});
			if (!raised && c === null && (await SR(p)).gameType === 'freegame') {
				while ((await turboKey(p)) !== 2) {
					await p.click('.hudp button[aria-label^="Turbo"]');
					await sleep(100);
				}
				raised = true;
			}
			if (c === 'outro' && outroAt === null) outroAt = Date.now();
			// (2026-11-19, LED_BOARD.ideas.totalBySize: the Total Win's count by the round's size; read off the board's show)
			if (c === 'outro' && totalShow === null) totalShow = await p.evaluate(() => { const s = window.__reindeer.scoreboard?.()?.show; return s && s.kind === 'total' ? { countMs: s.countEnd - s.countStart, x: s.x, capped: s.capped, pressAfter: s.pressLineAt - s.countEnd } : null; });
			// its amount landed: the LED board's Total Win count is done (or the HTML card is up)
			if (c === 'outro' && landedAt === null) {
				const ph = await p.evaluate(() => window.__reindeer.scoreboard?.()?.show?.phase ?? 'show');
				if (ph !== 'count' && ph !== 'rising' && ph !== 'switching') {
					landedAt = Date.now();
					// (2026-11-21, the WIN odometer: the bar's WIN lands with the card's count, at whatever rate it counted)
					odoAtLand = await p.evaluate(() => {
						const s = window.__reindeer.scoreboard?.()?.show;
						return { odo: window.__reindeer.hud.winOdometer?.() ?? null, countEnd: s?.countEnd ?? null, capped: !!s?.capped, skipped: !!s?.skipped };
					});
				}
			}
			if (outroAt !== null && c !== 'outro') {
				outroGoneAfter = Date.now() - outroAt;
				break;
			}
			if (outroAt !== null && Date.now() - outroAt > outroLimit) break;
			await sleep(50);
		}
		const stillUp = (await card()) === 'outro';
		// THE WIN ODOMETER (2026-11-21): the bar's WIN went plain on the total as the card's count ended (within 120 ms of the
		// board's clock: a frame or two of a loaded headless page), at the rate the card counted at; the capped wrap-up never runs it
		if (odoAtLand) {
			const o = odoAtLand.odo;
			const ok = odoAtLand.capped ? !!o && o.mode === 'off' : !!o && o.mode === 'done' && o.doneT !== null && o.doneT >= odoAtLand.countEnd && o.doneT - odoAtLand.countEnd <= 120;
			check(ok, `${tag}: the bar's WIN odometer lands with the card's count (${odoAtLand.capped ? 'capped: off' : `plain at ${o?.doneT} ms, the count's end ${odoAtLand.countEnd} ms`})`, odoAtLand);
		}
		// THE COUNT BY SIZE in a real wrap-up (Corey 2026-11-19: "yes on the total count wins"): the board's count is its size's
		// length at one of the turbo levels' rates, and the cap's hold is not used when Autoplay Bonuses continues the card
		if (totalShow) {
			const K = await p.evaluate(async () => {
				const m = await import('/src/game/constants.ts');
				const L = m.LED_BOARD;
				return { I: L.ideas, flat: L.scenes.totalCountMs, tiers: L.tiers.map((t) => t.bar), rates: [0, 1, 2].map((l) => m.motionFor(l).rate) };
			});
			const tier = K.tiers.reduce((k, b, i) => (totalShow.x >= b ? i : k), -1);
			const size = totalShow.capped ? 'max' : tier < 0 ? 'small' : tier < 3 ? 'big' : 'huge';
			const base = K.I.totalBySize.on ? K.I.totalBySize.ms[size] : K.flat;
			const okLen = K.rates.some((r) => Math.abs(totalShow.countMs - base / Math.max(0.2, r)) <= 2);
			check(okLen && (!C.on || !totalShow.capped || totalShow.pressAfter === 0), `${tag}: the Total Win's count ${Math.round(totalShow.countMs)} ms for its size (${size}, ${totalShow.x}x: ${base} ms at regular speed, a turbo rate dividing it)`, { totalShow, base, rates: K.rates });
		}
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

/** RULE 5, THE SCENE SETTING DURING A RUN (2026-11-24, Corey: "Can we make it happen after the next spin and continue
 *  auto-play?"; game/bonusStockRules.ts sceneChangeGap). A watcher in the page keeps every change of the set in use, of
 *  the run's count and of the round starts, frame by frame; each round's start is kept with the swap as it stood in the
 *  first frame drawn after it. */
const HOME = { snow: 'snowDay', grass: 'grassDay' };
const MENU = '[role="dialog"][aria-label="Menu"].is-open';
const sceneWatch = (p) =>
	p.evaluate(() => {
		const W = (window.__sg = { changes: [], starts: [], press: null });
		document.addEventListener(
			'click',
			(e) => {
				const k = e.target?.closest?.('[data-scene-choice]');
				if (k) W.press = { at: performance.now(), choice: k.dataset.sceneChoice, atRest: window.__reindeer.atRest(), idle: window.__reindeer.hud.idle(), counter: window.__reindeer.stockRules().counter, set: window.__reindeer.sceneSetting().set };
			},
			true,
		);
		let last = null;
		const tick = () => {
			const R = window.__reindeer;
			const sr = R.stockRules();
			const f = { at: performance.now(), set: R.sceneSetting().set, attr: document.documentElement.hasAttribute('data-scene-fade'), counter: sr.counter, type: sr.gameType, starts: sr.starts.length, gaps: sr.sceneGaps.length };
			if (last && f.starts !== last.starts) {
				const sw = R.sceneSwap();
				W.starts.push({ ...f, startAt: sr.starts[sr.starts.length - 1].at, fade: sw.fade, shown: sw.shown, want: sw.want });
			}
			if (!last || f.set !== last.set || f.counter !== last.counter || f.type !== last.type || f.attr !== last.attr) W.changes.push(f);
			last = f;
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
const SG = (p) => p.evaluate(() => ({ ...window.__sg, sr: window.__reindeer.stockRules(), setting: window.__reindeer.sceneSetting(), now: performance.now() }));
const until = async (p, fn, arg, maxMs) => {
	const t0 = Date.now();
	while (Date.now() - t0 < maxMs) {
		if (await p.evaluate(fn, arg).catch(() => false)) return true;
		await sleep(40);
	}
	return false;
};
/** press a choice of the menu's Scene switch right after a round's start (the menu is opened first, closed after) */
async function pressSceneInRound(p, choice, { inBonus = false } = {}) {
	await p.click('[data-hud="menu-key"]', { timeout: 5000 });
	const open = await until(p, (m) => !!document.querySelector(`${m} [data-scene-choice]`), MENU, 4000);
	if (!open) return { open: false };
	const n = await p.evaluate(() => window.__reindeer.stockRules().starts.length);
	// (a base round: just after its start, so the press lands with the round running; a bonus round: any moment of it)
	if (!inBonus) await until(p, (k) => window.__reindeer.stockRules().starts.length > k, n, 30000);
	await p.evaluate(() => (window.__sg.press = null));
	await p.click(`${MENU} [data-scene-choice="${choice}"]`, { timeout: 5000 });
	const press = await p.evaluate(() => window.__sg.press);
	await p.click('[data-hud="menu-key"]').catch(() => {});
	return { open: true, press };
}
/** one change asked in a run that is on: the hold that takes it, the spin after it, the count */
async function sceneChangeInRun(p, tag, choice, target) {
	const g0 = (await SR(p)).sceneGaps.length;
	const pr = await pressSceneInRound(p, choice);
	check(pr.open && !!pr.press && pr.press.choice === choice && !pr.press.atRest && pr.press.counter > 0 && pr.press.set !== target, `${tag}: ${choice} pressed in the menu with a round of the run going (not at rest, ${pr.press?.counter} spins left, set ${pr.press?.set})`, pr);
	if (!pr.press) return null;
	const took = await until(p, (k) => window.__reindeer.stockRules().sceneGaps.slice(k).some((g) => g.taken), g0, 60000);
	// two more rounds of the run after the hold
	const s1 = (await SR(p)).starts.length;
	await until(p, (k) => window.__reindeer.stockRules().starts.length >= k + 2 || window.__reindeer.stockRules().counter === 0, s1, 60000);
	const w = await SG(p);
	const gaps = w.sr.sceneGaps.slice(g0);
	const g = gaps.find((x) => x.taken);
	check(took && !!g && g.settled && g.set === target && w.setting.set === target, `${tag}: the set is ${target} after a hold of the run (sceneGaps: taken ${g?.taken}, settled ${g?.settled}, set ${g?.set}, ${g ? g.ms.toFixed(1) : '?'} ms; ${gaps.indexOf(g)} holds before it gave up)`, { gaps, setting: w.setting });
	if (!g) return null;
	const flip = w.changes.find((c) => c.at > pr.press.at && c.set === target);
	const early = w.changes.filter((c) => c.at > pr.press.at && c.at < g.at && c.set === target);
	check(!!flip && early.length === 0 && flip.at >= g.at - 1 && flip.at <= g.at + g.ms + 20, `${tag}: the set stays ${pr.press.set} to the end of the round pressed in (${(g.at - pr.press.at).toFixed(0)} ms), and turns inside the hold (${flip ? (flip.at - g.at).toFixed(1) : '?'} ms into it)`, { flip, early: early.slice(0, 3), g });
	const roundsBetween = w.sr.starts.filter((s) => s.at > pr.press.at && s.at < g.at).length;
	check(roundsBetween === 0, `${tag}: taken in the first pause after the round pressed in (${roundsBetween} more rounds started before the hold)`, gaps);
	const next = w.starts.find((s) => s.startAt > g.at);
	check(!!next && next.startAt >= g.at + g.ms - 1 && !next.fade && next.shown === HOME[target] && next.want === HOME[target], `${tag}: the next spin starts ${next ? (next.startAt - (g.at + g.ms)).toFixed(1) : '?'} ms after the hold ends, the scene ${next?.shown} whole and no fade running in its first frame`, { next, g });
	const run = w.starts.filter((s) => s.startAt > pr.press.at - 1);
	const steps = run.slice(1).map((s, i) => run[i].counter - s.counter);
	check(run.length >= 3 && steps.every((d) => d === 1) && g.counterAfter > 0, `${tag}: the run plays on with its count intact (${run.map((s) => s.counter).join(', ')} at the starts from the round after the press; ${g.counterAfter} left at the hold's end)`, { steps });
	console.log(`  INFO ${tag}: HOLD ${g.ms.toFixed(1)} ms for ${choice} (${target}); data-scene-fade on the root at the next start's frame: ${next?.attr}`);
	return g;
}
/** end a run that is on, by its own key, and come to rest */
async function endRun(p) {
	if ((await SR(p)).counter > 0) await p.click('.hudp button[aria-label="Autoplay"]').catch(() => {});
	return settle(p);
}
async function sectionScene(browser) {
	// A. DARK THEN SNOW IN ONE RUN: desktop at base turbo 0 and 2, the upright phone, and with the browser's cache off
	for (const C of [
		{ name: '1440x900 base 0', vp: VP, L: 0 },
		{ name: '1440x900 base 2 (turbo)', vp: VP, L: 2 },
		{ name: '390x844 base 0', vp: { width: 390, height: 844 }, L: 0 },
		{ name: '1440x900 base 0, cache off', vp: VP, L: 0, noCache: true },
	]) {
		const tag = `scene in a run, ${C.name}`;
		const { ctx, p, errs } = await boot(browser, 'scene', { vp: C.vp, noCache: !!C.noCache });
		await sceneWatch(p);
		check(await setBaseTurbo(p, C.L), `${tag}: base turbo ${C.L} set`);
		const pf = await p.evaluate(() => window.__reindeer.scenePrefetch?.());
		console.log(`  INFO ${tag}: the other set's prefetch at the start: ${JSON.stringify(pf).slice(0, 300)}`);
		const first = (await p.evaluate(() => window.__reindeer.sceneSetting())).set;
		const order = first === 'snow' ? [['dark', 'grass'], ['snow', 'snow']] : [['snow', 'snow'], ['dark', 'grass']];
		await startAuto(p);
		for (const [choice, target] of order) await sceneChangeInRun(p, tag, choice, target);
		const sr = await SR(p);
		check(sr.counter > 0, `${tag}: the run is still on after both changes (${sr.counter} spins left)`);
		await endRun(p);
		await noStrand(p, tag, errs);
		await ctx.close();
	}
	// B. ASKED DURING A BONUS ROUND: nothing until the round is over, then the first hold that can take it
	{
		const tag = 'scene in a run, asked in a bonus round';
		const { ctx, p, errs } = await boot(browser, 'scenebonus');
		await sceneWatch(p);
		const sr0 = await SR(p);
		const e0 = sr0.entries.length;
		const x0 = sr0.exits.length;
		await p.evaluate(() => window.__reindeer.fixtures.next('natural_free_spins'));
		await startAuto(p, { autoBonuses: true });
		const inBonus = await until(p, (k) => window.__reindeer.stockRules().entries.length > k && window.__reindeer.stockRules().gameType === 'freegame', e0, 90000);
		await sleep(1500);
		const g0 = (await SR(p)).sceneGaps.length;
		let pr = await pressSceneInRound(p, 'dark', { inBonus: true }).catch((e) => ({ open: false, err: String(e).slice(0, 200) }));
		const byMenu = !!pr.press;
		if (!byMenu) {
			// the menu is not to be had in the round: the setting's own hook, as the switch sets it
			const at = await p.evaluate(() => (window.__reindeer.sceneChoice('dark'), performance.now()));
			pr = { open: false, press: { at, choice: 'dark' }, why: pr };
		}
		const typeAtPress = (await SR(p)).gameType;
		check(inBonus && typeAtPress === 'freegame', `${tag}: Dark asked ${byMenu ? 'in the menu' : 'by the setting hook (the menu did not open in the round)'} during the free spins, the run on`, { inBonus, typeAtPress, pr });
		// the player raises the round's speed to keep the probe short (rule 2)
		for (let i = 0; i < 4 && (await turboKey(p)) !== 2; i++) {
			await p.click('.hudp button[aria-label^="Turbo"]').catch(() => {});
			await sleep(120);
		}
		const out = await until(p, (k) => window.__reindeer.stockRules().exits.length > k, x0, 200000);
		const took = await until(p, (k) => window.__reindeer.stockRules().sceneGaps.slice(k).some((g) => g.taken), g0, 40000);
		const s1 = (await SR(p)).starts.length;
		await until(p, (k) => window.__reindeer.stockRules().starts.length >= k + 2 || window.__reindeer.stockRules().counter === 0, s1, 60000);
		const w = await SG(p);
		const exit = w.sr.exits[x0];
		const gaps = w.sr.sceneGaps.slice(g0);
		const g = gaps.find((x) => x.taken);
		const early = w.changes.filter((c) => c.at > pr.press.at && c.at < (exit?.at ?? Infinity) && c.set === 'grass');
		check(out && !!exit && early.length === 0 && gaps.every((x) => x.at >= exit.at - 1), `${tag}: the set stays snow through the whole round, no hold inside it (${gaps.length} holds, the first ${gaps[0] ? (gaps[0].at - exit.at).toFixed(0) : '?'} ms after the wrap-up cleared)`, { early: early.slice(0, 3), gaps, exit });
		check(took && !!g && g.settled && g.set === 'grass' && w.setting.set === 'grass', `${tag}: taken after the round, in hold ${gaps.indexOf(g) + 1} after it (${g ? g.ms.toFixed(1) : '?'} ms, ${g ? (g.at - exit.at).toFixed(0) : '?'} ms after the wrap-up cleared; holds that gave up first: ${gaps.slice(0, Math.max(0, gaps.indexOf(g))).map((x) => x.ms.toFixed(0)).join(', ') || 'none'})`, { gaps, setting: w.setting });
		const next = g ? w.starts.find((s) => s.startAt > g.at) : null;
		check(!!next && next.startAt >= g.at + g.ms - 1 && !next.fade && next.shown === 'grassDay' && g.counterAfter > 0, `${tag}: the run plays on after it: the next spin ${next ? (next.startAt - (g.at + g.ms)).toFixed(1) : '?'} ms after the hold, grassDay whole, no fade, ${g?.counterAfter} spins left`, { next, g });
		await endRun(p);
		await noStrand(p, tag, errs);
		await ctx.close();
	}
	// C. A STOP DURING THE HOLD (the fade is held where it starts, so the hold lasts): the Auto key, then the Spin
	for (const how of ['auto', 'spin']) {
		const tag = `scene in a run, ${how === 'spin' ? 'the Spin' : 'the Auto key'} pressed during the hold`;
		const sel = how === 'spin' ? '.hudp button.spin' : '.hudp button[aria-label="Autoplay"]';
		const { ctx, p, errs } = await boot(browser, `scenestop${how}`);
		await sceneWatch(p);
		const K = await p.evaluate(async () => (await import('/src/game/bonusStockRules.ts')).SCENE_GAP);
		await p.evaluate(() => window.__reindeer.sceneSwapHold(true));
		await startAuto(p);
		const g0 = (await SR(p)).sceneGaps.length;
		const pr = await pressSceneInRound(p, 'dark');
		const turned = await until(p, () => window.__reindeer.sceneSetting().set === 'grass', null, 60000);
		await sleep(400);
		const mid = await p.evaluate(() => ({ gaps: window.__reindeer.stockRules().sceneGaps.length, counter: window.__reindeer.stockRules().counter, fade: !!window.__reindeer.sceneSwap().fade, starts: window.__reindeer.stockRules().starts.length, plays: window.__reindeer.fixtures.log().plays.length }));
		const live = how === 'spin' ? await p.evaluate((q) => { const k = document.querySelector(q); return { ok: !!k && !k.disabled }; }, sel) : await autoLive(p);
		check(!!pr.press && turned && mid.gaps === g0 && mid.fade && mid.counter > 0, `${tag}: the hold is on 400 ms after the set turned (the fade held, no record of its end yet, ${mid.counter} spins left)`, { mid, pr });
		check(live.ok, `${tag}: the key is live during the hold`, live);
		await p.click(sel, { timeout: 5000 }).catch(() => {});
		const ended = await until(p, (k) => window.__reindeer.stockRules().sceneGaps.length > k, g0, 3000);
		const g = (await SR(p)).sceneGaps[g0];
		check(ended && !!g && g.taken && g.counterAfter === 0 && g.ms < K.settleMs - 1000, `${tag}: the press ends the run and the hold with it (${g ? g.ms.toFixed(0) : '?'} ms, well inside its own end of ${K.takeMs} + ${K.settleMs} ms; counter ${g?.counterAfter})`, g);
		await p.evaluate(() => window.__reindeer.sceneSwapHold(false));
		await sleep(3000);
		const after = await p.evaluate(() => ({ counter: window.__reindeer.stockRules().counter, starts: window.__reindeer.stockRules().starts.length, plays: window.__reindeer.fixtures.log().plays.length, set: window.__reindeer.sceneSetting().set, sw: window.__reindeer.sceneSwap() }));
		check(after.counter === 0 && after.starts === mid.starts && after.plays === mid.plays, `${tag}: no spin follows in the 3 s after (starts ${mid.starts} to ${after.starts}, plays ${mid.plays} to ${after.plays})`, { mid, after: { ...after, sw: undefined } });
		check(after.set === 'grass' && !after.sw.fade && after.sw.shown === 'grassDay', `${tag}: the scene finishes its change to grassDay once the fade runs (${after.sw.shown}, fade ${after.sw.fade ? 'on' : 'off'})`);
		const rest = await settle(p, 30000);
		const key = await p.evaluate(() => { const k = document.querySelector('.hudp button.spin'); return !!k && !k.disabled; });
		await p.click('.hudp button.spin', { timeout: 5000 }).catch(() => {});
		const played = await until(p, (k) => window.__reindeer.fixtures.log().plays.length === k + 1, after.plays, 5000);
		check(rest && key && played, `${tag}: at rest after it, the Spin key enabled, and its press plays one round`, { rest, key, played });
		await settle(p);
		const fin = await p.evaluate(() => ({ plays: window.__reindeer.fixtures.log().plays.length, counter: window.__reindeer.stockRules().counter }));
		check(fin.plays === after.plays + 1 && fin.counter === 0, `${tag}: one round only, no run (plays ${after.plays} to ${fin.plays})`);
		await noStrand(p, tag, errs);
		await ctx.close();
	}
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
	if (want('scene')) await sectionScene(browser);
} catch (e) {
	fail++;
	console.log('FAIL probe error', e?.stack ?? e);
} finally {
	await browser.close();
}
console.log(`\nstock_rules_probe: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
