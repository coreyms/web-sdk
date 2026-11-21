// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{game/road/superWheel.ts,game/road/wheelPeg.ts,game/road/wildMult.ts,game/superWheelPlan.ts,game/superWheelSpec.ts,ui/WheelGate.svelte,ui/controls.svelte.ts,ui/SquareSpin.svelte,game/bookEventHandlerMap.ts,game/actor.ts,game/utils.ts,game/road/roadBoard.ts,game/road/present.ts,components/Board.svelte};
// WATCHES: ; SUPER_WHEEL, AUTO_BONUS_WAIT_MS, WHEEL_SHARES, LED_BOARD.stripOrder, ROUND.betweenSpinsMs, RESUME_TEXT, data-wheel-gate, data-wheel-wait, button.catch, .hudp
// WATCHES: ; __reindeer.wheel, __reindeer.wheelPegTrace, __reindeer.tune, WILD_MULT, __reindeer.wheelPlan, __reindeer.wheelShow, __reindeer.wheelSet, __reindeer.wheelEnd, __reindeer.wheelAlone, __reindeer.sceneOnly, __reindeer.fixtures, __reindeer.roadSounds, __reindeer.hud, __reindeer.road, __reindeer.freeSpinNow, __reindeer.stockRules
// THE SUPER WHEEL PROBE (2026-11-18; game/road/superWheel.ts, game/superWheelPlan.ts, constants SUPER_WHEEL; the approved
// mock super_wheel_2026-11-18 round 5, "Mc Under the number and P2"). Real Super books of the math (tools/
// wheel_probe_books.json: twelve books of fixtures_2026-11-20/books_super.json (2026-11-20: eight re-pinned in place, the
// same opening column, from 2026-11-18's topped-up rounds; see the file's source line), every opening value and every reel; and
// the app's own natural Super fixture), played through the game's own path. Presentation only: it checks that the wheel
// SHOWS the book, never that it decides anything.
//   plan       every book: the plan's opening is the book's own columnWild (start: true); eight wedges, no Grandma, at
//              most two of a value, every value one of the books' eight; the stop inside the real wedge (30% either side);
//              the same events give the same plan, whatever their key order; a book's plan does not depend on what
//              follows the opening
//   rounds     ROUNDS (default 12) forced Super rounds: the wheel waits (the LED strip says PRESS SPIN, the Spin key is
//              live and marked, Space is the wheel's); ONE press (the Spin key, Space, a press on the wheel, in turn)
//              starts both picks; spin one stops on the book's character and multiplier, the ring on the book's column,
//              the LED strip names each; the column then grows in that reel with that multiplier; THE FIRST FREE SPIN
//              BEGINS ON THE LANDING (the frame the column stands, at most one frame after); the timings from the press;
//              the reindeer's stride against the rim's travel while he is on it; the same book played again shows the
//              same wheel and the same stop; no console error; no blob: or data: media
//   auto       Autoplay Bonuses: the wheel starts itself AUTO_BONUS_WAIT_MS (1.5 s) of real time after it comes to rest
//              (the strip says GET READY); a run stopped in that window leaves it waiting for the press
//   hold       Space held with the keyboard's repeat through the whole wheel: one start, no skip
//   skip       a press during the spin goes straight to the book's wedge, then the book's column (speed only)
//   resume     a reload while the wheel waits: the resume card; Play Round shows the same wheel again and the round ends
//              with one end-round; Skip to Result shows no wheel; a round resumed at its opening (no trigger board) and
//              one resumed after it (no wheel, the column from the held list)
//   concentric the wheel standing still at each layout, measured from the page's own pixels (device pixel ratio 3): the
//              rim's box through a full turn (it must not move by more than 1 CSS px), the wedges', the highlight's, the
//              ring's and the hub's centres against the rim's
//   contact    the reindeer on the rim in each of his 16 strides, from pixels: the gap between his lowest pixel and the
//              rim's edge
//   words      the wheel's words: plain capitals, American English, none of the restricted words
//   pin        (2026-11-20, Corey: "the pin moves way too early"; the layout page round 3: "the pin ... should be bouncing
//              most of the spins") one forced Super round, its top peg recorded frame by frame from the press to well after
//              the stop (wheelPegTrace): the WHOLE FLAPPER (game/road/wheelPeg.ts) never inside a stud's circle (PIN_TOL wheel
//              units); it never starts to turn from rest (still a whole ring of its spring) without a stud on it (a stud met inside a frame counts); every stud
//              that crossed the top met it; at least KICK_SHARE of them kick it over KICK_DEG degrees, a stud's median kick
//              at least KICK_MEDIAN and the spin's largest swing from LARGEST_MIN to SUPER_WHEEL.peg.maxSwing (Corey: "Go
//              deeper, by dropping lower I was trying to make it move more visibly"); every tick is a stud's first contact,
//              and every first contact ticks unless a tick sounded under tickMinMs before; REST_MS board ms after the stop it
//              is straight with no stud on it, or leaning on a stud in contact (gap within LEAN_GAP) and still. And each wedge's number is the Wild multiplier in its character's color (WILD_MULT.colors), its value
//              the wedge's
//   numbers    (2026-11-20, the layout page round 3) the standing wheel at each layout (device pixel ratio 3; wheelShow,
//              wheelSet: no round played) with every wheel value (4x to 30x) in every wedge place (the eight set by hand,
//              turned round eight times): one letter height for all (WILD_MULT.place.wheel caps), the letters on the arc,
//              the even outline of the layout's class (a phone layout, short side 480 CSS px or less: evenOutline.phone;
//              else .wide); from the page's own pixels, every number pixel inside its wedge (clear of the dark divider) and
//              under the trim, and outside the column ring and the hub (2026-11-21), every wedge pixel (its bust) inside its
//              wedge; the string lights drawn over the numbers
// Sections: ONLY=plan,rounds,auto,hold,skip,resume,concentric,contact,words,pin,numbers (default all). ROUNDS=n. LAYOUT, LAYOUTS and
// PICK are explained where they are read. SHOTS=<dir> adds the
// section `shots` (one round per layout at device pixel ratio 3 with its stills) and the contact section's closeups; the
// build's sheet is made from them (tools/wheel_sheet.py).
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3015 [ONLY=a,b] [SHOTS=dir] node tools/wheel_probe.mjs
// Uses the dev server that is already running. One headless browser, muted. Wrap it in the shared browser lock:
//   tools/browser_lock.sh run light -- node tools/wheel_probe.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PNG } = require('playwright-core/lib/utilsBundle');

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = process.env.APP || 'http://localhost:3014';
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
/** wheel units the flapper's tip may be read inside a stud's circle (a frame's rounding) */
const PIN_TOL = 0.5;
/** the pin's bounce (the brief, 2026-11-20): this share of the studs kick it more than KICK_DEG degrees while they pass */
const KICK_DEG = 8;
const KICK_SHARE = 0.9;
const KICK_MEDIAN = 35;
const LARGEST_MIN = 45;
/** board ms after the wheel's stop by which the pin is at rest (damping 8 against stiffness 550 rings about 2 s): straight,
 *  or leaning on a stud's side in contact (LEAN_GAP wheel units) and still (STILL_DEG over the frames after) */
const REST_MS = 2500;
const REST_DEG = 0.1;
const LEAN_GAP = 0.1;
const STILL_DEG = 0.02;
/** wheel units a number's or a wedge's pixel may be read past its line (a device pixel at ratio 3 is up to 0.55 unit on
 *  the desktop wheel; a smaller wheel's device pixel reaches further and the numbers section allows that) */
const EDGE_TOL = 1;
/** the wedge's dark divider, its half on each side of a side line (tools/build_super_wheel.py make_wedge, wheel units), and
 *  how much a pixel past the line may lighten the empty picture under it (the sum of its channels; the divider's ink only
 *  darkens: a lighter pixel there is the bust's own art) */
const DIVIDER_HALF = 4;
const DIVIDER_DARK = 12;
const want = (s) => !ONLY.length || ONLY.includes(s);
const ROUNDS = Number(process.env.ROUNDS || 12);
// (to split the rounds section over several holds of the browser lock on a slow machine: PICK=0,3,7 plays those books of
// tools/wheel_probe_books.json only; NATURAL=0 leaves the app's natural Super out; AGAIN=0 leaves the second play out)
const PICK = (process.env.PICK || '').split(',').filter(Boolean).map(Number);
const NATURAL = process.env.NATURAL !== '0';
const AGAIN = process.env.AGAIN !== '0';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BANNED = /\b(bets?|buy|buys|bought|cash|money|paid|credits?|gamble|gambling|wager|wagers|stake)\b/i;
const BOOKS = JSON.parse(readFileSync(join(HERE, 'wheel_probe_books.json'), 'utf8')).books;
const NAMES = { reindeer: 'REINDEER', santa: 'SANTA' };
const LAYOUTS = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, touch: false },
	{ name: 'upright', vp: { width: 390, height: 844 }, touch: true },
	{ name: 'sideways', vp: { width: 844, height: 390 }, touch: true },
	{ name: 'popout', vp: { width: 400, height: 225 }, touch: false },
];

// THE LAYOUT OF THE PLAYED SECTIONS (rounds, auto, hold, skip, resume): LAYOUT=desktop|upright|sideways|popout (default
// desktop). A headless browser draws on the CPU: on a loaded machine a smaller layout keeps the page nearer real time.
// The checks are the same at every layout.
const PLAYED = LAYOUTS.find((l) => l.name === (process.env.LAYOUT || 'desktop')) ?? LAYOUTS[0];
// (LAYOUTS=desktop,upright: the layouts of the pixel sections and the stills, to split them over holds of the browser lock)
const MEASURED = LAYOUTS.filter((l) => !process.env.LAYOUTS || process.env.LAYOUTS.split(',').includes(l.name));

let pass = 0;
let fail = 0;
const notes = [];
const check = (ok, what, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${!ok && detail !== undefined ? `\n     ${JSON.stringify(detail).slice(0, 900)}` : ''}`);
};
const note = (line) => {
	notes.push(line);
	console.log(`  ${line}`);
};
const openingOf = (events) => events.find((e) => e.type === 'columnWild' && e.start === true);
const W = (p) => p.evaluate(() => window.__reindeer.wheel());

async function boot(browser, L = PLAYED, { dpr = 1, extra = '' } = {}) {
	const ctx = await browser.newContext({ viewport: L.vp, deviceScaleFactor: dpr, isMobile: L.touch, hasTouch: L.touch });
	await ctx.addInitScript(() => {
		window.__rgsCalls = [];
		const t = setInterval(() => {
			if (!window.__rorFixtures || window.__rgsWrapped) return;
			window.__rgsWrapped = true;
			clearInterval(t);
			const inner = window.fetch;
			window.fetch = (input, init) => {
				const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
				const m = /\/(wallet\/[a-z-]+)/.exec(url);
				if (m) window.__rgsCalls.push({ path: m[1], at: performance.now() });
				return inner(input, init);
			};
		}, 5);
	});
	const p = await ctx.newPage();
	const errs = [];
	const odd = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200));
	});
	// media (sound, video) or the wheel's own pictures asked from a blob: or data: address (the platform's policy has no blob:)
	const sheets = [];
	p.on('request', (r) => {
		const u = r.url();
		if (/assets\/wheel\//.test(u)) sheets.push(u);
		if (/^(blob|data):/.test(u) && (r.resourceType() === 'media' || /wheel/.test(u))) odd.push(`${r.resourceType()} ${u.slice(0, 60)}`);
	});
	await p.goto(`${APP}/?lang=en&sessionID=wheel${Date.now()}${extra}`, { waitUntil: 'domcontentloaded' });
	await enter(p, L);
	return { ctx, p, errs, odd, L, sheets };
}
/** past the press screen (or a resume card with `choice`), the HUD up */
async function enter(p, L, choice = null) {
	for (let i = 0; i < 240; i++) {
		const st = await p.evaluate(() => ({ ok: !!(window.__reindeer?.wheel && window.__reindeer.hud && document.querySelector('.hudp') && !document.querySelector('.landing')), card: !!document.querySelector('[data-resume-card]') })).catch(() => ({ ok: false }));
		if (st.card && choice) await p.evaluate((c) => document.querySelector(`[data-resume-card] [data-resume="${c}"]`)?.click(), choice).catch(() => {});
		else if (st.ok && !st.card) return true;
		else if (!st.card && i % 2 === 1) await p.mouse.click(L.vp.width / 2, L.vp.height / 2).catch(() => {});
		await sleep(350);
	}
	return false;
}
const until = async (p, fn, ms = 60000, arg = undefined, every = 60) => {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) {
		const v = await p.evaluate(fn, arg).catch(() => null);
		if (v) return v;
		await sleep(every);
	}
	return null;
};
/** the next spin plays this book (the math's own events, as they are) */
const queue = (p, book) => p.evaluate(([ev, pay]) => window.__reindeer.fixtures.queue(ev, pay), [book.events, book.payoutMultiplier / 100]);
/** press the round's cards (never the wheel's own target) until the wheel is in `phase` */
async function toPhase(p, phase = 'rest', ms = 90000) {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) {
		const st = await p.evaluate(() => ({ ph: window.__reindeer.wheel().phase, card: !!document.querySelector('button.catch:not([data-wheel-gate])') })).catch(() => null);
		if (st?.ph === phase) return true;
		if (st?.card) await p.evaluate(() => document.querySelector('button.catch:not([data-wheel-gate])')?.click()).catch(() => {});
		await sleep(120);
	}
	return false;
}
/** play the round out: every card and the wheel pressed, at the fastest speed, until idle and at rest */
async function settle(p, ms = 240000) {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) {
		const st = await p.evaluate(() => ({ g: window.__reindeer.hud?.gates?.() ?? 0, idle: window.__reindeer.hud?.idle?.(), rest: window.__reindeer.atRest?.(), gt: window.__reindeer.gameType?.() })).catch(() => null);
		if (st?.gt === 'freegame') await p.evaluate(() => window.__reindeer.turbo(2)).catch(() => {});
		if (st?.g > 0) await p.evaluate(() => document.querySelector('button.catch')?.click()).catch(() => {});
		else if (st?.idle && st.rest && !(await p.evaluate(() => !!document.querySelector('[data-resume-card]') || !!document.querySelector('.landing')))) {
			await sleep(700);
			if (await p.evaluate(() => window.__reindeer.hud.idle() && window.__reindeer.atRest() && (window.__reindeer.hud.gates?.() ?? 0) === 0).catch(() => false)) return true;
		}
		await sleep(250);
	}
	return false;
}

// ---------------------------------------------------------------- plan
async function planSection(browser) {
	const { ctx, p, errs } = await boot(browser);
	const fixtures = await p.evaluate(async () => (await import('/src/fixtures/fixtureRgs.ts')).FIXTURE_ROUNDS.filter((r) => r.events.some((e) => e.type === 'columnWild' && e.start)).map((r) => ({ id: r.name, payoutMultiplier: r.payoutMultiplier * 100, events: r.events })));
	const shares = await p.evaluate(async () => (await import('/src/game/superWheelPlan.ts')).WHEEL_SHARES);
	const all = [...BOOKS, ...fixtures];
	check(BOOKS.length >= 10 && fixtures.length >= 1, `plan: ${BOOKS.length} books of the math and ${fixtures.length} of the app's own fixtures hold a Super opening`);
	const values = new Set(shares.map((s) => `${s.tier} ${s.m}`));
	const total = shares.reduce((n, s) => n + s.share, 0);
	const rein = shares.filter((s) => s.tier === 'reindeer').reduce((n, s) => n + s.share, 0);
	check(shares.length === 8 && Math.abs(total - 1) < 1e-9 && Math.abs(rein - 2 / 3) < 1e-9, `plan: the filler's shares are the books' eight openings (reindeer ${(rein * 100).toFixed(2)}%, Santa ${((total - rein) * 100).toFixed(2)}%)`);
	const bad = [];
	const seeds = new Set();
	for (const b of all) {
		const o = openingOf(b.events);
		const r = await p.evaluate(
			([ev]) => {
				const plan = window.__reindeer.wheelPlan(ev);
				const again = window.__reindeer.wheelPlan(JSON.parse(JSON.stringify(ev)));
				// the same events with every object's keys in the reverse order
				const flip = (v) => (Array.isArray(v) ? v.map(flip) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, flip(x)])) : v);
				const flipped = window.__reindeer.wheelPlan(flip(ev));
				// only the events up to the opening
				const cut = window.__reindeer.wheelPlan(ev.slice(0, ev.findIndex((e) => e.type === 'columnWild' && e.start) + 1));
				return { plan, same: JSON.stringify(plan) === JSON.stringify(again), flipSame: JSON.stringify(plan) === JSON.stringify(flipped), cutSame: JSON.stringify(plan) === JSON.stringify(cut) };
			},
			[b.events],
		);
		const P = r.plan;
		const counts = {};
		for (const s of P?.slices ?? []) counts[`${s.tier} ${s.m}`] = (counts[`${s.tier} ${s.m}`] ?? 0) + 1;
		const ok =
			!!P &&
			P.real.tier === o.tier &&
			P.real.m === o.multiplier &&
			P.real.reel === o.reel &&
			P.slices.length === 8 &&
			P.slices[P.at].tier === o.tier &&
			P.slices[P.at].m === o.multiplier &&
			P.slices.every((s) => s.tier !== 'grandma' && values.has(`${s.tier} ${s.m}`)) &&
			Object.values(counts).every((n) => n <= 2) &&
			Math.abs(P.off) <= 0.3 &&
			Math.abs(P.ringOff) <= 0.3 &&
			P.ringStart >= 0 &&
			P.ringStart <= 4 &&
			r.same &&
			r.flipSame &&
			r.cutSame;
		if (!ok) bad.push({ id: b.id, o, P, r: { same: r.same, flipSame: r.flipSame, cutSame: r.cutSame } });
		if (P) seeds.add(P.seed);
	}
	check(bad.length === 0, `plan: all ${all.length} books: the plan's opening is the book's own (character, multiplier, reel), eight wedges with no Grandma and at most two of a value, the stop within 30% of the wedge's middle, the same plan from the same events (again, keys reordered, cut at the opening)`, bad.slice(0, 2));
	check(seeds.size === all.length, `plan: ${seeds.size} different seeds for ${all.length} different books`);
	check(errs.length === 0, 'plan: no page error', errs);
	await ctx.close();
}

// ---------------------------------------------------------------- rounds
/** one forced Super round from the Spin press to its first free spin; `how`: the press that starts the wheel */
async function oneRound(browser, book, how, tag, { shots = null, L: layout = PLAYED, dpr = 1 } = {}) {
	const { ctx, p, errs, odd, L, sheets } = await boot(browser, layout, { dpr });
	const o = openingOf(book.events);
	const out = { ok: false };
	try {
		if (typeof book.id === 'string') await p.evaluate((n) => window.__reindeer.fixtures.next(n), book.id);
		else await queue(p, book);
		await p.evaluate(() => window.__reindeer.roadSounds(true));
		await p.click('.hudp button.spin');
		const emerged = await toPhase(p, 'emerge', 180000);
		const w0 = emerged ? await W(p) : null;
		// the emergence: out of the red present (the trigger board has one: 4 or more presents)
		// (the stills: the strip's blinking line held lit)
		if (shots) await p.evaluate(() => window.__reindeer.wheelSteady(true));
		if (shots && emerged) {
			for (const [i, at] of [560, 1130, 1480, 1800].entries()) {
				await until(p, (ms) => window.__reindeer.wheel().clock >= ms, 8000, at, 8);
				// (the board's own time held for the still)
				await p.evaluate(() => window.__reindeer.clock(0));
				await sleep(50);
				await p.screenshot({ path: join(shots, `${L.name}_1_emerge${i}.png`) });
				await p.evaluate(() => window.__reindeer.clock(1));
			}
		}
		const rested = await toPhase(p, 'rest', 120000);
		await sleep(500);
		const rest = await p.evaluate(() => {
			const w = window.__reindeer.wheel();
			const key = document.querySelector('.hudp button.spin');
			const gate = document.querySelector('button[data-wheel-gate]');
			const r = gate?.getBoundingClientRect();
			return { w, key: { wait: key?.getAttribute('data-wheel-wait'), disabled: !!key?.disabled, label: key?.getAttribute('aria-label') }, gate: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null, gates: window.__reindeer.hud.gates(), fs: window.__reindeer.freeSpinNow() };
		});
		const plan = rest.w.plan;
		check(emerged && rested && rest.w.phase === 'rest', `${tag}: the wheel comes out and rests`, { emerged, rested, phase: rest.w.phase });
		check(plan && plan.real.tier === o.tier && plan.real.m === o.multiplier && plan.real.reel === o.reel, `${tag}: its plan is the book's opening (${o.tier} ${o.multiplier}x, reel ${o.reel})`, plan?.real);
		check(rest.w.line?.text === 'PRESS SPIN' && rest.w.line.blink === true && rest.key.wait === '1' && !rest.key.disabled && rest.key.label === 'Spin' && rest.gates === 1 && !!rest.gate, `${tag}: at rest the LED strip says PRESS SPIN, the Spin key is live and marked, the wheel has its own press target`, { line: rest.w.line, key: rest.key, gates: rest.gates });
		check(rest.w.atPeg === 0 && Math.abs(rest.w.wrap.x - rest.w.geo.cx) < 0.01 && Math.abs(rest.w.wrap.y - rest.w.geo.cy) < 0.01 && Math.abs(rest.w.wrap.rotation) < 0.01, `${tag}: it rests in its place with wedge 1 under the peg (nothing of the result shows)`, { atPeg: rest.w.atPeg, wrap: rest.w.wrap });
		if (shots) {
			await p.screenshot({ path: join(shots, `${L.name}_2_rest.png`) });
			writeFileSync(join(shots, `${L.name}_2_rest.json`), JSON.stringify(rest.w));
		}
		// it stays at rest with no press (no idle start)
		await sleep(1800);
		const still = await W(p);
		check(still.phase === 'rest' && !still.auto, `${tag}: with no press it waits (no start by itself)`, still.phase);
		// THE ONE PRESS
		await p.evaluate(() => {
			window.__wheelLog = [];
			window.__wheelTick = setInterval(() => {
				const w = window.__reindeer.wheel();
				const last = window.__wheelLog[window.__wheelLog.length - 1];
				if (w.phase === 'drive' || w.phase === 'runin' || w.phase === 'leap') window.__wheelRun = (window.__wheelRun ?? []).concat([{ ph: w.phase, onRim: w.runner.onRim, pose: w.runner.pose, theta: w.theta, shown: w.runner.shown, x: w.runner.x, y: w.runner.y, rot: w.runner.rotation }]);
				const key = `${w.phase}|${w.line?.text}|${w.line?.tone}|${w.line?.blink}`;
				if (!last || last.key !== key) window.__wheelLog.push({ key, t: performance.now(), clock: w.clock, phase: w.phase, line: w.line, theta: w.theta, ringPhi: w.ringPhi, atPeg: w.atPeg, ringAt: w.ringAt });
			}, 8);
		});
		if (how === 'space') await p.keyboard.press('Space');
		else if (how === 'wheel') await p.mouse.click(rest.gate.x + rest.gate.w * 0.5, rest.gate.y + rest.gate.h * 0.3);
		else await p.click('.hudp button.spin');
		const pressAt = await p.evaluate(() => performance.now());
		if (shots) {
			// the reindeer on the rim, the first stop, the ring's stop
			await until(p, () => window.__reindeer.wheel().phase === 'drive' && window.__reindeer.wheel().runner.onRim, 8000, undefined, 10);
			await sleep(140);
			await p.evaluate(() => window.__reindeer.clock(0));
			await sleep(60);
			await p.screenshot({ path: join(shots, `${L.name}_3_drive.png`) });
			writeFileSync(join(shots, `${L.name}_3_drive.json`), JSON.stringify(await W(p)));
			await p.evaluate(() => window.__reindeer.clock(1));
			// (each still with the board's own time held, and taken while the strip's blinking line is lit)
			const lit = () => until(p, () => Math.floor(window.__reindeer.scoreboard().clock / 260) % 3 === 0, 3000, undefined, 15);
			await until(p, () => window.__reindeer.wheel().phase === 'land' && window.__reindeer.wheel().clock - window.__wheelLog.find((l) => l.phase === 'land').clock >= 450, 240000, undefined, 10);
			await p.evaluate(() => window.__reindeer.clock(0));
			await lit();
			await p.screenshot({ path: join(shots, `${L.name}_4_land.png`) });
			writeFileSync(join(shots, `${L.name}_4_land.json`), JSON.stringify(await W(p)));
			await p.evaluate(() => window.__reindeer.clock(1));
			await until(p, () => window.__reindeer.wheel().phase === 'land2' && window.__reindeer.wheel().clock - window.__wheelLog.find((l) => l.phase === 'land2').clock >= 220, 240000, undefined, 8);
			await p.evaluate(() => window.__reindeer.clock(0));
			await lit();
			await p.screenshot({ path: join(shots, `${L.name}_5_ring.png`) });
			writeFileSync(join(shots, `${L.name}_5_ring.json`), JSON.stringify(await W(p)));
			await p.evaluate(() => window.__reindeer.clock(1));
		}
		// no input from here: both picks must play from the one press
		const left = await until(p, () => window.__reindeer.wheel().phase === null && window.__reindeer.wheel().played >= 1, 240000);
		const log = await p.evaluate(() => {
			clearInterval(window.__wheelTick);
			return { log: window.__wheelLog, run: window.__wheelRun ?? [], w: window.__reindeer.wheel() };
		});
		const at = (ph) => log.log.find((l) => l.phase === ph);
		const land = at('land');
		const land2 = at('land2');
		const lineAt = (ph) => log.log.filter((l) => l.phase === ph).map((l) => l.line?.text);
		check(!!left && !!land && !!land2 && !log.log.some((l) => l.phase === 'slam'), `${tag}: one press (${how}) starts both picks: spin one, then the ring, then the wheel leaves, with no second press`, log.log.map((l) => l.phase));
		const stop = log.log.filter((l) => l.phase === 'land').pop();
		check(!!stop && stop.atPeg === plan.at && plan.slices[plan.at] === `${o.tier} ${o.multiplier}x`, `${tag}: spin one stops on the book's wedge (${o.tier} ${o.multiplier}x under the peg)`, { atPeg: stop?.atPeg, at: plan.at, slices: plan.slices });
		const want1 = `${NAMES[o.tier]} ${o.multiplier}X`;
		check(lineAt('land').every((t) => t === want1) && land.line.tone === 'gold' && land.line.blink, `${tag}: the LED strip names the stop: ${want1}`, lineAt('land'));
		const stop2 = log.log.filter((l) => l.phase === 'land2').pop();
		check(!!stop2 && stop2.ringAt === o.reel && lineAt('land2').every((t) => t === `COLUMN ${o.reel + 1}`), `${tag}: the ring stops on the book's column (COLUMN ${o.reel + 1} on the strip)`, { ringAt: stop2?.ringAt, lines: lineAt('land2') });
		// the stop point inside the wedge: the plan's own (never at an edge)
		const inWedge = stop ? ((((-stop.theta % 360) + 360) % 360) / 45 - plan.at - 0.5) : null;
		check(inWedge !== null && Math.abs(inWedge - plan.off) < 0.01 && Math.abs(inWedge) <= 0.301, `${tag}: it stops ${(inWedge * 100).toFixed(1)}% of a wedge off its middle (the plan's ${(plan.off * 100).toFixed(1)}%)`, { inWedge, off: plan.off });
		// THE REINDEER'S STRIDE: on the rim his pose advances with the rim's own travel
		const rim = log.run.filter((r) => r.ph === 'drive' && r.onRim && r.shown);
		if (rim.length >= 4) {
			const d = rest.w.geo.d;
			const art = await p.evaluate(async () => (await import('/src/game/superWheelSpec.ts')).SUPER_WHEEL_ART.run);
			const sweep = art.sweepFramePx * ((art.boxShare * d) / art.frameW);
			let worst = 0;
			for (const r of rim) worst = Math.max(worst, Math.abs(r.pose - rim[0].pose - (Math.abs(r.theta - rim[0].theta) * (Math.PI / 180) * (d / 2)) / sweep));
			check(worst < 0.02, `${tag}: on the rim his stride is the rim's travel (${rim.length} samples, ${(rim[rim.length - 1].pose - rim[0].pose).toFixed(1)} strides over ${Math.abs(rim[rim.length - 1].theta - rim[0].theta).toFixed(0)} degrees, worst difference ${worst.toFixed(4)} of a stride; one stride per ${sweep.toFixed(2)} CSS px of rim)`, worst);
			out.sweep = sweep;
		} else check(false, `${tag}: the reindeer was sampled on the rim`, rim.length);
		// THE COLUMN, then THE FIRST FREE SPIN ON ITS LANDING
		const first = await until(
			p,
			() => {
				const L = window.__reindeer.roadSounds();
				const a = L.find((e) => e.what === 'openingLanded');
				const b = L.find((e) => e.what === 'trafficStart' && /first free spin after the wheel/.test(e.detail ?? ''));
				return a && b ? { a, b, cols: window.__reindeer.road().features.columns, fs: window.__reindeer.freeSpinNow() } : null;
			},
			90000,
		);
		const col = first?.cols?.find((c) => c.reel === o.reel);
		check(!!col && col.tier === o.tier && col.multiplier === o.multiplier && first.cols.length === 1, `${tag}: the column grows in reel ${o.reel + 1}: ${o.tier} ${o.multiplier}x (the book's)`, first?.cols);
		check(!!first && first.b.frame - first.a.frame <= 1 && first.b.t - first.a.t < 60, `${tag}: the first free spin starts on the landing (${first ? `${first.b.frame - first.a.frame} frame(s), ${(first.b.t - first.a.t).toFixed(1)} ms after the column stands` : 'not seen'})`, first && { a: first.a, b: first.b });
		if (shots && first) {
			await sleep(60);
			await p.screenshot({ path: join(shots, `${L.name}_6_landed.png`) });
		}
		// THE TIMINGS on the board's own clock (the road's log: each phase of the wheel, the landing, the first free spin)
		const road = await p.evaluate(() => window.__reindeer.roadSounds().filter((e) => e.what === 'wheel' || e.what === 'openingLanded' || (e.what === 'trafficStart' && /first free spin after the wheel/.test(e.detail ?? ''))).map((e) => ({ what: e.what === 'wheel' ? e.detail : e.what, clock: e.clock, t: e.t })));
		const c = (name) => road.find((e) => e.what === name)?.clock ?? NaN;
		out.times = { rest: c('rest') - c('emerge'), pressToLand: c('land') - c('runin'), land: c('ringIn') - c('land'), ring: c('land2') - c('ringIn'), leave: c('gone') - c('land2'), pressToWheelGone: c('gone') - c('runin'), column: c('openingLanded') - c('gone'), pressToFirstSpin: c('trafficStart') - c('runin'), real: first ? first.b.t - log.w.marks.press : null, ticks: log.w.ticks };
		out.plan = plan;
		out.stop = { theta: stop?.theta, ringPhi: stop2?.ringPhi };
		out.ok = true;
		check(errs.length === 0, `${tag}: no console or page error`, errs);
		check(odd.length === 0, `${tag}: no media or wheel picture from a blob: or data: address`, odd);
		check(sheets.length >= 1 && sheets.every((u) => /\/assets\/wheel\/super-wheel(-phone)?\.webp\?v=[0-9a-f]{8}$/.test(u)), `${tag}: the wheel's sheet came from its stamped address`, sheets);
		void pressAt;
	} catch (e) {
		check(false, `${tag}: the round ran`, String(e));
	}
	await ctx.close();
	return out;
}

async function roundsSection(browser) {
	const how = ['key', 'space', 'wheel'];
	const list = (PICK.length ? PICK.map((i) => BOOKS[i]) : BOOKS.slice(0, Math.max(1, ROUNDS - 1))).map((b) => ({ ...b }));
	if (NATURAL) {
		const { ctx, p } = await boot(browser);
		const events = await p.evaluate(async () => (await import('/src/fixtures/fixtureRgs.ts')).FIXTURE_ROUNDS.find((r) => r.name === 'natural_super').events);
		await ctx.close();
		list.push({ id: 'natural_super', events });
	}
	const times = [];
	let first = null;
	for (const [i, book] of list.entries()) {
		const o = openingOf(book.events);
		const r = await oneRound(browser, book, how[i % 3], `round ${i + 1} (book ${book.id}, ${o.tier} ${o.multiplier}x reel ${o.reel})`);
		if (r.ok) times.push(r.times);
		if (i === 0) first = { book, r };
	}
	// THE SAME BOOK AGAIN: the same wheel, the same stop
	if (AGAIN && first?.r.ok) {
		const again = await oneRound(browser, first.book, 'key', `again (book ${first.book.id})`);
		check(again.ok && JSON.stringify(again.plan) === JSON.stringify(first.r.plan), 'again: the same book shows the same wheel (seed, the eight wedges in order, the real wedge, the stop point, the ring)', { a: first.r.plan, b: again.plan });
		check(again.ok && Math.abs(again.stop.theta - first.r.stop.theta) < 0.001 && Math.abs(again.stop.ringPhi - first.r.stop.ringPhi) < 0.001, `again: and stops at the same angles (disc ${again.stop?.theta?.toFixed(3)}, ring ${again.stop?.ringPhi?.toFixed(3)} degrees)`, { a: first.r.stop, b: again.stop });
	}
	if (times.length) {
		const span = (k) => `${(Math.min(...times.map((t) => t[k])) / 1000).toFixed(2)} to ${(Math.max(...times.map((t) => t[k])) / 1000).toFixed(2)} s`;
		note(`TIMINGS over ${times.length} rounds at regular speed, on the board's own clock (what a player sees at 60 frames a second; this headless browser's real time for press to first free spin was ${span('real')}): the emergence ${span('rest')}; press to spin one's stop ${span('pressToLand')}; the stop's beat ${span('land')}; the ring ${span('ring')}; the ring's stop and the wheel leaving ${span('leave')}; press to the wheel gone ${span('pressToWheelGone')}; the column's entrance ${span('column')}; PRESS TO THE FIRST FREE SPIN ${span('pressToFirstSpin')}`);
	}
}

// ---------------------------------------------------------------- auto
async function startAuto(p, { stopFree = false, autoBonuses = false } = {}) {
	await p.click('.hudp button[aria-label="Autoplay"]');
	await sleep(600);
	const open = await p.evaluate(() => document.querySelector('.am-ui.layer.modals .fold-row')?.getAttribute('aria-expanded') === 'true');
	if (!open) await p.click('.am-ui.layer.modals .fold-row');
	await sleep(300);
	const set = async (name, on) => {
		const t = p.locator(`.am-ui.layer.modals button.toggle:has-text("${name}")`);
		if (((await t.getAttribute('aria-checked')) === 'true') !== on) await t.click();
	};
	await set('Stop on Free Games', stopFree);
	await set('Autoplay Bonuses', autoBonuses);
	await sleep(200);
	await p.click('.am-ui.layer.modals .go');
	await sleep(600);
	await p.click('.hudp button.spin');
}
async function autoSection(browser) {
	const wait = await (async () => {
		const { ctx, p } = await boot(browser);
		const v = await p.evaluate(async () => (await import('/src/game/constants.ts')).AUTO_BONUS_WAIT_MS);
		await ctx.close();
		return v;
	})();
	check(wait === 1500, `auto: AUTO_BONUS_WAIT_MS is ${wait} ms`);
	// Autoplay Bonuses on: it starts itself
	{
		const { ctx, p, errs } = await boot(browser);
		await queue(p, BOOKS[1]);
		await startAuto(p, { autoBonuses: true });
		const rested = await until(p, () => window.__reindeer.wheel().phase === 'rest', 90000, undefined, 20);
		await sleep(250);
		const at = await p.evaluate(() => ({ w: window.__reindeer.wheel(), counter: window.__reindeer.stockRules().counter }));
		const gone = await until(p, () => (window.__reindeer.wheel().marks.autoStart ? window.__reindeer.wheel() : null), 30000, undefined, 20);
		const ms = gone ? gone.marks.autoStart - gone.marks.rest : null;
		check(!!rested && at.w.line?.text === 'GET READY' && at.w.auto && at.counter > 0, 'auto: with Autoplay Bonuses running the wheel comes to rest by itself and the strip says GET READY', { line: at.w.line, auto: at.w.auto, counter: at.counter });
		// (it starts on the first frame at or after the wait's end: this headless browser can draw as few as 5 frames a second)
		check(ms !== null && ms >= wait - 1 && ms <= wait + 250, `auto: it starts itself ${ms?.toFixed(0)} ms of real time after coming to rest (AUTO_BONUS_WAIT_MS ${wait}; the first frame at or after it)`, ms);
		const landed = await until(p, () => window.__reindeer.wheel().played >= 1 && window.__reindeer.freeSpinNow() >= 1, 240000);
		check(!!landed, 'auto: both picks play and the round goes on with no press');
		await p.click('.hudp button[aria-label="Autoplay"]').catch(() => {});
		check(await settle(p), 'auto: the round plays to its end');
		check(errs.length === 0, 'auto: no page error', errs);
		await ctx.close();
	}
	// the run stopped in the window: it waits for the press
	{
		const { ctx, p, errs } = await boot(browser);
		await queue(p, BOOKS[2]);
		await startAuto(p, { autoBonuses: true });
		// the Auto key pressed in the page itself, 0.4 s into the wait (a press from outside can come too late on a slow page)
		await p.evaluate(() => {
			window.__autoStop = null;
			const t = setInterval(() => {
				const w = window.__reindeer.wheel();
				if (w.phase !== 'rest' || performance.now() - w.marks.rest < 400) return;
				clearInterval(t);
				window.__autoStop = performance.now() - w.marks.rest;
				document.querySelector('.hudp button[aria-label="Autoplay"]').click();
			}, 10);
		});
		const stopAt = await until(p, () => window.__autoStop, 90000, undefined, 50);
		await sleep(2600);
		const w = await p.evaluate(() => ({ w: window.__reindeer.wheel(), counter: window.__reindeer.stockRules().counter }));
		check(stopAt < 1400 && w.w.phase === 'rest' && !w.w.auto && w.counter === 0 && w.w.line?.text === 'PRESS SPIN', `auto: the run stopped with the Auto key ${Math.round(stopAt)} ms into the wait: the wheel stays at rest and asks for the press (2.6 s later)`, { stopAt, phase: w.w.phase, auto: w.w.auto, counter: w.counter, line: w.w.line });
		await p.click('.hudp button.spin');
		const went = await until(p, () => window.__reindeer.wheel().phase !== 'rest', 5000);
		check(!!went, 'auto: the Spin press then starts it');
		check(await settle(p), 'auto: that round plays to its end');
		check(errs.length === 0, 'auto: no page error (stopped run)', errs);
		await ctx.close();
	}
	// autoplay WITHOUT Autoplay Bonuses: the wheel waits like the entry card
	{
		const { ctx, p } = await boot(browser);
		await queue(p, BOOKS[3]);
		await startAuto(p, { autoBonuses: false });
		const rested = await toPhase(p, 'rest', 90000);
		await sleep(2600);
		const w = await p.evaluate(() => ({ w: window.__reindeer.wheel(), counter: window.__reindeer.stockRules().counter }));
		check(rested && w.w.phase === 'rest' && !w.w.auto && w.counter > 0, 'auto: a run without Autoplay Bonuses waits at the wheel for the press (2.6 s), the run still live', { phase: w.w.phase, auto: w.w.auto, counter: w.counter });
		// the Auto key stops the run while the wheel waits (autoplay can be stopped in a bonus)
		await p.click('.hudp button[aria-label="Autoplay"]');
		await sleep(300);
		const c = await p.evaluate(() => ({ counter: window.__reindeer.stockRules().counter, phase: window.__reindeer.wheel().phase }));
		check(c.counter === 0 && c.phase === 'rest', 'auto: the Auto key stops the run while the wheel waits; the wheel still waits', c);
		await ctx.close();
	}
}

// ---------------------------------------------------------------- hold and skip
async function holdSection(browser) {
	const { ctx, p, errs } = await boot(browser);
	await queue(p, BOOKS[4]);
	await p.click('.hudp button.spin');
	await toPhase(p, 'rest');
	await sleep(400);
	await p.evaluate(() => {
		window.__phases = [];
		window.__ph = setInterval(() => {
			const ph = window.__reindeer.wheel().phase;
			if (window.__phases[window.__phases.length - 1] !== ph) window.__phases.push(ph);
		}, 8);
	});
	// the key down and held: the keyboard's own repeat presses (repeat: true) follow
	await p.keyboard.down('Space');
	for (let i = 0; i < 60; i++) {
		await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', repeat: true, bubbles: true })));
		await sleep(50);
	}
	const mid = await W(p);
	await until(p, () => window.__reindeer.wheel().played >= 1, 240000);
	await p.keyboard.up('Space');
	const phases = await p.evaluate(() => {
		clearInterval(window.__ph);
		return { phases: window.__phases, hurry: window.__reindeer.hurryLevel() };
	});
	check(!phases.phases.includes('slam') && phases.phases.includes('slow') && phases.phases.includes('ring') && phases.hurry === 0, 'hold: Space held with its repeat through the wheel: one start, no skip, no hurry', { phases: phases.phases, hurry: phases.hurry, mid: mid.phase });
	check(errs.length === 0, 'hold: no page error', errs);
	await ctx.close();
}
async function skipSection(browser) {
	const { ctx, p, errs } = await boot(browser);
	const book = BOOKS[5];
	const o = openingOf(book.events);
	await queue(p, book);
	await p.click('.hudp button.spin');
	await toPhase(p, 'rest');
	await sleep(300);
	await p.click('.hudp button.spin');
	await until(p, () => window.__reindeer.wheel().phase === 'slow', 90000, undefined, 20);
	await sleep(300);
	// (timed on the wheel's own clock: this headless browser's frames can be far apart)
	const c0 = await p.evaluate(() => {
		const c = window.__reindeer.wheel().clock;
		document.querySelector('.hudp button.spin').click();
		return c;
	});
	const land = await until(p, () => (window.__reindeer.wheel().phase === 'land' ? window.__reindeer.wheel() : null), 60000, undefined, 10);
	const slam = await p.evaluate(() => window.__reindeer.roadSounds().filter((e) => e.what === 'wheel').map((e) => e.detail));
	const ms = land ? land.clock - c0 : null;
	check(!!land && slam.includes('slam') && land.atPeg === land.plan.at && land.plan.slices[land.plan.at] === `${o.tier} ${o.multiplier}x` && ms < 1200, `skip: a Spin press during the slow-down goes straight to the book's wedge (${ms?.toFixed(0)} ms on the wheel's clock, the slow-down's rest skipped)`, { ms, atPeg: land?.atPeg, slam });
	const done = await until(p, () => (window.__reindeer.wheel().played >= 1 ? window.__reindeer.road().features.columns : null), 240000);
	const col = done?.find((c) => c.reel === o.reel);
	check(!!col && col.tier === o.tier && col.multiplier === o.multiplier, `skip: then the ring, and the book's column (${o.tier} ${o.multiplier}x reel ${o.reel + 1})`, done);
	// the slam's hurry ends with the first free spin (a slam hurries its own spin only)
	const h = await until(p, () => (window.__reindeer.roadSounds().some((e) => e.what === 'trafficStart' && /first free spin after the wheel/.test(e.detail ?? '')) ? { hurry: window.__reindeer.hurryLevel() } : null), 30000);
	check(!!h && h.hurry === 0, 'skip: the slam\'s hurry ends as the first free spin starts (it hurried the wheel and the column only)', h);
	check(await settle(p), 'skip: the round plays to its end');
	check(errs.length === 0, 'skip: no page error', errs);
	await ctx.close();
}

// ---------------------------------------------------------------- resume
async function resumeSection(browser) {
	// A. a real reload while the wheel waits: the card; Play Round shows the same wheel; one end-round
	for (const choice of ['play', 'skip']) {
		const { ctx, p, errs, L } = await boot(browser);
		await p.evaluate(() => window.__reindeer.fixtures.next('super_typical'));
		await p.click('.hudp button.spin');
		await toPhase(p, 'rest');
		const before = await W(p);
		await p.reload({ waitUntil: 'domcontentloaded' });
		const card = await until(p, () => !!document.querySelector('[data-resume-card] [data-resume="play"]'), 90000, undefined, 250);
		check(!!card, `resume (${choice}): a reload while the wheel waits brings the resume card`);
		errs.length = 0;
		await p.evaluate((c) => document.querySelector(`[data-resume-card] [data-resume="${c}"]`)?.click(), choice);
		if (choice === 'play') {
			const rested = await toPhase(p, 'rest', 120000);
			const after = rested ? await W(p) : null;
			check(rested && JSON.stringify(after.plan) === JSON.stringify(before.plan), 'resume (play): Play Round shows the same wheel again (seed, wedges, the real wedge, the stop, the ring)', { before: before.plan, after: after?.plan });
			await p.click('.hudp button.spin');
			const done = await until(p, () => (window.__reindeer.wheel().played >= 1 ? window.__reindeer.road().features.columns : null), 240000);
			check(!!done && done.length === 1 && done[0].reel === before.plan.real.reel && done[0].multiplier === before.plan.real.m, 'resume (play): it stops on the book again and the column grows', done);
		} else {
			await sleep(1500);
		}
		const ok = await settle(p);
		const end = await p.evaluate(() => ({ w: window.__reindeer.wheel(), calls: window.__rgsCalls.map((c) => c.path), settled: window.__reindeer.fixtures.log().settled, gt: window.__reindeer.gameType() }));
		check(ok && end.calls.filter((c) => c === 'wallet/end-round').length === 1 && end.gt === 'basegame', `resume (${choice}): the round ends, idle and at rest, with one end-round`, { ok, calls: end.calls, gt: end.gt });
		if (choice === 'skip') check(end.w.played === 0 && end.w.phase === null && !end.w.marks.start, 'resume (skip): Skip to Result shows no wheel', { played: end.w.played, marks: end.w.marks });
		// (2026-11-19: Skip to Result loaded the wheel's sheet for a wheel it never shows, and nothing let it go)
		check(end.w.art.loaded === false, `resume (${choice}): after the round the wheel's sheet is not on the GPU`, end.w.art);
		check(errs.length === 0, `resume (${choice}): no page error`, errs);
		void L;
		await ctx.close();
	}
	// B. the RGS says the round stopped AT its opening column (no trigger board on the road), and after it
	const fx = await (async () => {
		const { ctx, p } = await boot(browser);
		const ev = await p.evaluate(async () => (await import('/src/fixtures/fixtureRgs.ts')).FIXTURE_ROUNDS.find((r) => r.name === 'super_typical').events);
		const plan = await p.evaluate((e) => window.__reindeer.wheelPlan(e), ev);
		await ctx.close();
		return { ev, plan };
	})();
	const at = fx.ev.findIndex((e) => e.type === 'columnWild' && e.start);
	for (const [event, wheel] of [
		[at, true],
		[at + 1, false],
	]) {
		const { ctx, p, errs, L } = await boot(browser);
		await p.evaluate(([n, e]) => window.__reindeer.fixtures.resume(n, e), ['super_typical', event]).catch(() => {});
		await sleep(1200);
		await p.waitForLoadState('domcontentloaded').catch(() => {});
		errs.length = 0;
		await enter(p, L, 'play');
		if (wheel) {
			const rested = await toPhase(p, 'rest', 120000);
			const w = rested ? await W(p) : null;
			check(rested && w.plan.seed === fx.plan.seed && JSON.stringify(w.plan.slices) === JSON.stringify(fx.plan.slices.map((s) => `${s.tier} ${s.m}x`)) && w.plan.at === fx.plan.at, `resume: a round resumed at its opening column (event ${event}, no trigger board): the same wheel as the whole round's (seed ${fx.plan.seed.toString(16)})`, { got: w?.plan, want: fx.plan });
			await p.click('.hudp button.spin');
			const done = await until(p, () => (window.__reindeer.wheel().played >= 1 ? window.__reindeer.road().features.columns : null), 240000);
			check(!!done && done.length === 1 && done[0].reel === fx.plan.real.reel, 'resume: it plays to the book\'s column', done);
		} else {
			const col = await until(p, () => (window.__reindeer.freeSpinNow() >= 1 && window.__reindeer.road().features.columns.length ? window.__reindeer.road().features.columns : null), 60000);
			const w = await W(p);
			check(!!col && col[0].reel === fx.plan.real.reel && w.played === 0 && w.phase === null, `resume: a round resumed after its opening (event ${event}): no wheel, the column stands from the held list`, { col, played: w.played, phase: w.phase });
		}
		check(await settle(p), `resume (event ${event}): the round plays to its end`);
		check((await W(p)).art.loaded === false, `resume (event ${event}): after the round the wheel's sheet is not on the GPU`);
		check(errs.length === 0, `resume (event ${event}): no page error`, errs);
		await ctx.close();
	}
}

// ---------------------------------------------------------------- pixels
const png = (buf) => PNG.sync.read(buf);
/** the pixels that differ between two captures of one box: their box, their count, and each one's place */
function diffMask(a, b, thr = 24) {
	const w = a.width;
	const h = a.height;
	const pts = [];
	let x0 = w;
	let y0 = h;
	let x1 = -1;
	let y1 = -1;
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const i = (y * w + x) * 4;
			if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > thr) {
				pts.push(x, y);
				if (x < x0) x0 = x;
				if (x > x1) x1 = x;
				if (y < y0) y0 = y;
				if (y > y1) y1 = y;
			}
		}
	return { pts, x0, y0, x1: x1 + 1, y1: y1 + 1 };
}
/** the least squares circle through the outline of a mask (per row its two outer pixels, per column its two outer) */
function fitCircle(mask, upTo = 0.72, from = 0) {
	const rows = new Map();
	const cols = new Map();
	for (let i = 0; i < mask.pts.length; i += 2) {
		const x = mask.pts[i];
		const y = mask.pts[i + 1];
		const r = rows.get(y);
		if (!r) rows.set(y, [x, x]);
		else {
			if (x < r[0]) r[0] = x;
			if (x > r[1]) r[1] = x;
		}
		const c = cols.get(x);
		if (!c) cols.set(x, [y, y]);
		else {
			if (y < c[0]) c[0] = y;
			if (y > c[1]) c[1] = y;
		}
	}
	const P = [];
	for (const [y, [a, b]] of rows) P.push([a, y + 0.5], [b + 1, y + 0.5]);
	for (const [x, [a, b]] of cols) P.push([x + 0.5, a], [x + 0.5, b + 1]);
	// only the points on the outer hull side: far from the mean
	let mx = 0;
	let my = 0;
	for (const q of P) {
		mx += q[0];
		my += q[1];
	}
	mx /= P.length;
	my /= P.length;
	const far = P.map((q) => Math.hypot(q[0] - mx, q[1] - my));
	const cut = [...far].sort((a, b) => a - b)[Math.floor(far.length * 0.5)];
	// (and only its upper part, `upTo` of its height: the HTML HUD, drawn over the page, can hide a wheel's foot)
	const yCut = mask.y0 + (mask.y1 - mask.y0) * upTo;
	// (`from`: and not its very top, where the column ring's pointer stands out of the ring)
	const yFrom = mask.y0 + (mask.y1 - mask.y0) * from;
	const Q = P.filter((q, i) => far[i] >= cut && q[1] <= yCut && q[1] >= yFrom);
	// solve [2x 2y 1][cx cy c] = x^2 + y^2
	let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, n = 0, bx = 0, by = 0, b1 = 0;
	for (const [x, y] of Q) {
		const z = x * x + y * y;
		sxx += 4 * x * x; sxy += 4 * x * y; sx += 2 * x; syy += 4 * y * y; sy += 2 * y; n += 1;
		bx += 2 * x * z; by += 2 * y * z; b1 += z;
	}
	const det = (a) => a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
	const A = [sxx, sxy, sx, sxy, syy, sy, sx, sy, n];
	const D = det(A);
	const cx = det([bx, sxy, sx, by, syy, sy, b1, sy, n]) / D;
	const cy = det([sxx, bx, sx, sxy, by, sy, sx, b1, n]) / D;
	const c = det([sxx, sxy, bx, sxy, syy, by, sx, sy, b1]) / D;
	const r = Math.sqrt(c + cx * cx + cy * cy);
	let worst = 0;
	for (const [x, y] of Q) worst = Math.max(worst, Math.abs(Math.hypot(x - cx, y - cy) - r));
	return { cx, cy, r, worst, n: Q.length };
}
/** a wheel standing still at a layout (device pixel ratio 3): the page, the box captured, and capture() of chosen pieces */
async function standing(browser, L, book) {
	// (DPR=2: the desktop game draws at 2 px per CSS px at most, RENDER_RESOLUTION_CAP, so 3 only costs time there)
	const DPR = Number(process.env.DPR || 3);
	const { ctx, p, errs } = await boot(browser, L, { dpr: DPR });
	const shown = await p.evaluate((ev) => window.__reindeer.wheelShow(ev), book.events);
	await sleep(400);
	const w = await W(p);
	const g = w.geo;
	const pad = 0.16 * g.d;
	const clip = { x: Math.max(0, Math.floor(g.cx - g.d / 2 - pad)), y: Math.max(0, Math.floor(g.cy - g.d / 2 - pad)), width: 0, height: 0 };
	clip.width = Math.min(L.vp.width, Math.ceil(g.cx + g.d / 2 + pad)) - clip.x;
	clip.height = Math.min(L.vp.height, Math.ceil(g.cy + g.d / 2 + pad)) - clip.y;
	const set = (o) => p.evaluate((x) => void window.__reindeer.wheelSet(x), o);
	const shot = async () => {
		await sleep(90);
		return png(await p.screenshot({ clip }));
	};
	// (the LED strip, drawn over the wheel's foot, the HUD and the scene are in both captures of a pair: only the wheel differs)
	return { ctx, p, errs, w, g, clip, DPR, set, shot, shown };
}

async function concentricSection(browser) {
	const rows = [];
	for (const L of MEASURED) {
		const S = await standing(browser, L, BOOKS[7]);
		const { p, g, clip, DPR, set, shot } = S;
		check(S.shown && S.w.phase === 'dev', `concentric ${L.name}: a wheel stands at ${g.d.toFixed(1)} CSS px (centre ${g.cx.toFixed(1)}, ${g.cy.toFixed(1)})`);
		// the scoreboard is drawn over the wheel's foot: hide it for the measurement (the strip is not part of the wheel)
		await p.evaluate(() => {
			window.__reindeer.sceneOnly(true);
			window.__reindeer.wheelAlone(true);
		});
		await set({ only: [] });
		const none = await shot();
		const toCss = (v, o) => v / DPR + o;
		// THE RIM through a full turn: its pixels' box must not move
		const boxes = [];
		const fits = [];
		for (let k = 0; k < 16; k++) {
			await set({ only: ['rim'], theta: -22.5 - k * 22.5 - (k % 2 ? 7.3 : 0) });
			const m = diffMask(await shot(), none);
			boxes.push([toCss(m.x0, clip.x), toCss(m.y0, clip.y), toCss(m.x1, clip.x), toCss(m.y1, clip.y)]);
			if (k % 4 === 0) fits.push(fitCircle(m));
		}
		const span = (i) => Math.max(...boxes.map((b) => b[i])) - Math.min(...boxes.map((b) => b[i]));
		const move = Math.max(span(0), span(1), span(2), span(3));
		const bw = boxes[0][2] - boxes[0][0];
		const bh = boxes[0][3] - boxes[0][1];
		const rim = { cx: toCss(fits[0].cx, clip.x), cy: toCss(fits[0].cy, clip.y), r: fits[0].r / DPR, worst: Math.max(...fits.map((f) => f.worst)) / DPR };
		// (cut: its foot is under the HTML HUD or past the screen's edge, where the two captures do not differ)
		const clipped = Math.abs(bw - bh) > 1;
		check(move <= 1 && Math.abs(bw - g.d) <= 1, `concentric ${L.name}: the rim's box moves ${move.toFixed(2)} CSS px through a full turn (16 angles; left ${span(0).toFixed(2)}, top ${span(1).toFixed(2)}, right ${span(2).toFixed(2)}, bottom ${span(3).toFixed(2)}); it is ${bw.toFixed(2)} by ${bh.toFixed(2)} CSS px${clipped ? ' (its foot is under the HUD, which is drawn over the page)' : ''}`, boxes.slice(0, 3));
		check(rim.worst <= 0.75 && Math.abs(rim.r * 2 - g.d) <= 1, `concentric ${L.name}: the rim's outline is a circle: radius ${rim.r.toFixed(2)} CSS px (the wheel asked for ${(g.d / 2).toFixed(2)}), no outline pixel more than ${rim.worst.toFixed(2)} CSS px off it`, rim);
		check(Math.hypot(rim.cx - g.cx, rim.cy - g.cy) <= 0.5, `concentric ${L.name}: the rim's centre is the turn's centre (${Math.hypot(rim.cx - g.cx, rim.cy - g.cy).toFixed(2)} CSS px apart)`, { rim, g });
		// the other pieces' centres against the rim's
		const centre = async (o, from = 0) => {
			await set(o);
			const f = fitCircle(diffMask(await shot(), none), 0.72, from);
			return { cx: toCss(f.cx, clip.x), cy: toCss(f.cy, clip.y), r: f.r / DPR, worst: f.worst / DPR };
		};
		const parts = {};
		parts.wedges = await centre({ only: ['wedges'], theta: -22.5 });
		parts.back = await centre({ only: ['back'] });
		parts.ring = await centre({ only: ['ring'], ring: true, ringPhi: -31 }, 0.2);
		// the highlight: its outer arc at the eight wedges, each fitted, and all eight together
		const hiPts = { pts: [], x0: 0, y0: 0, x1: 0, y1: 0 };
		for (let k = 0; k < 8; k++) {
			await set({ only: ['hi'], hi: k, theta: -22.5 });
			const m = diffMask(await shot(), none);
			for (const v of m.pts) hiPts.pts.push(v);
		}
		hiPts.y0 = Infinity;
		hiPts.y1 = -Infinity;
		for (let i = 1; i < hiPts.pts.length; i += 2) {
			hiPts.y0 = Math.min(hiPts.y0, hiPts.pts[i]);
			hiPts.y1 = Math.max(hiPts.y1, hiPts.pts[i] + 1);
		}
		const hf = fitCircle(hiPts);
		parts.highlight = { cx: toCss(hf.cx, clip.x), cy: toCss(hf.cy, clip.y), r: hf.r / DPR, worst: hf.worst / DPR };
		await set({ hi: null });
		// the hub's gold disc: its lower half's outline (the bow and the snow sit on its top)
		await set({ only: ['hub'] });
		const hm = diffMask(await shot(), none);
		const low = { pts: [] };
		const mid = (hm.y0 + hm.y1) / 2 + (hm.y1 - hm.y0) * 0.12;
		for (let i = 0; i < hm.pts.length; i += 2) if (hm.pts[i + 1] > mid) low.pts.push(hm.pts[i], hm.pts[i + 1]);
		const hub = (() => {
			// rows of the lower part: their two outer pixels
			const rowsM = new Map();
			for (let i = 0; i < low.pts.length; i += 2) {
				const r = rowsM.get(low.pts[i + 1]);
				if (!r) rowsM.set(low.pts[i + 1], [low.pts[i], low.pts[i]]);
				else {
					r[0] = Math.min(r[0], low.pts[i]);
					r[1] = Math.max(r[1], low.pts[i]);
				}
			}
			const P = [];
			for (const [y, [a, b]] of rowsM) P.push([a, y + 0.5], [b + 1, y + 0.5]);
			let best = null;
			// a small search for the circle through them (centre near the wheel's)
			const cx0 = (g.cx - clip.x) * DPR;
			const cy0 = (g.cy - clip.y) * DPR;
			for (let dx = -9; dx <= 9; dx += 0.5)
				for (let dy = -9; dy <= 9; dy += 0.5) {
					const rs = P.map(([x, y]) => Math.hypot(x - cx0 - dx, y - cy0 - dy));
					const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
					const err = rs.reduce((a, r) => a + (r - mean) * (r - mean), 0) / rs.length;
					if (!best || err < best.err) best = { err, cx: cx0 + dx, cy: cy0 + dy, r: mean };
				}
			return { cx: toCss(best.cx, clip.x), cy: toCss(best.cy, clip.y), r: best.r / DPR, worst: Math.sqrt(best.err) / DPR };
		})();
		parts.hub = hub;
		const off = (c) => Math.hypot(c.cx - rim.cx, c.cy - rim.cy);
		for (const [name, c] of Object.entries(parts)) {
			const lim = name === 'hub' || name === 'back' ? 1 : name === 'highlight' || name === 'ring' ? 0.75 : 0.5; // (the back is a stretched soft disc, hidden under the rim)
			check(off(c) <= lim, `concentric ${L.name}: the ${name}'s centre is ${off(c).toFixed(2)} CSS px from the rim's (radius ${c.r.toFixed(2)})`, { c, rim });
		}
		rows.push(`| ${L.name} ${L.vp.width}x${L.vp.height} | ${g.d.toFixed(1)} | ${move.toFixed(2)} | ${rim.worst.toFixed(2)} | ${Math.hypot(rim.cx - g.cx, rim.cy - g.cy).toFixed(2)} | ${off(parts.wedges).toFixed(2)} | ${off(parts.highlight).toFixed(2)} | ${off(parts.ring).toFixed(2)} | ${off(parts.hub).toFixed(2)} |`);
		await p.evaluate(() => {
			window.__reindeer.sceneOnly(false);
			window.__reindeer.wheelAlone(false);
			window.__reindeer.wheelEnd();
		});
		check(S.errs.length === 0, `concentric ${L.name}: no page error`, S.errs);
		await S.ctx.close();
	}
	note(`CONCENTRICITY (CSS px, from the page's pixels at device pixel ratio ${process.env.DPR || 3}):`);
	note('| layout | wheel | rim box moves in a full turn | rim outline off a circle | rim centre to the turn\'s | wedges | highlight | ring | hub |');
	note('|---|---|---|---|---|---|---|---|---|');
	for (const r of rows) note(r);
}

async function contactSection(browser) {
	// (CLAYOUTS: the contact section's own layouts, when they differ from the concentric section's)
	for (const L of process.env.CLAYOUTS ? LAYOUTS.filter((l) => process.env.CLAYOUTS.split(',').includes(l.name)) : MEASURED) {
		const S = await standing(browser, L, BOOKS[7]);
		const { p, g, clip, DPR, set, shot } = S;
		await p.evaluate(() => {
			window.__reindeer.sceneOnly(true);
			window.__reindeer.wheelAlone(true);
		});
		const gaps = [];
		for (let stride = 1; stride <= 16; stride++) {
			await set({ only: [], stride });
			const none = await shot();
			await set({ only: ['runner'], stride });
			const m = diffMask(await shot(), none, 60);
			// his nearest pixel to the wheel's centre, against the rim's radius
			let near = Infinity;
			for (let i = 0; i < m.pts.length; i += 2) near = Math.min(near, Math.hypot((m.pts[i] + 0.5) / DPR + clip.x - g.cx, (m.pts[i + 1] + 0.5) / DPR + clip.y - g.cy));
			gaps.push(near - g.d / 2);
			if (SHOTS && L.name !== 'popout' && [1, 4, 8, 13].includes(stride)) {
				await set({ only: null, stride });
				await p.evaluate(() => {
					window.__reindeer.sceneOnly(false);
					window.__reindeer.wheelAlone(false);
				});
				await sleep(120);
				writeFileSync(join(SHOTS, `${L.name}_contact_${String(stride).padStart(2, '0')}.png`), await p.screenshot({ clip }));
				writeFileSync(join(SHOTS, `${L.name}_contact.json`), JSON.stringify({ clip, g, DPR }));
				await p.evaluate(() => {
					window.__reindeer.sceneOnly(true);
					window.__reindeer.wheelAlone(true);
				});
			}
		}
		const lo = Math.min(...gaps);
		const hi = Math.max(...gaps);
		// (his lowest pixel is drawn 0.5 wheel units inside the rim's edge: the two outlines meet with no hairline)
		check(lo >= -1.2 && hi <= 0.75, `contact ${L.name}: in every one of his 16 strides the reindeer's lowest pixel is on the rim's edge: from ${lo.toFixed(2)} to ${hi.toFixed(2)} CSS px outside it (negative: into its outline; wheel ${g.d.toFixed(0)} px)`, gaps.map((v) => Number(v.toFixed(2))));
		note(`CONTACT ${L.name} (CSS px between his nearest pixel and the rim's edge, strides 1 to 16): ${gaps.map((v) => v.toFixed(2)).join(', ')}`);
		await p.evaluate(() => {
			window.__reindeer.sceneOnly(false);
			window.__reindeer.wheelAlone(false);
			window.__reindeer.wheelEnd();
		});
		await S.ctx.close();
	}
}

// ---------------------------------------------------------------- words
async function wordsSection(browser) {
	for (const extra of ['', '&social=true']) {
		const { ctx, p } = await boot(browser, LAYOUTS[0], { extra });
		const T = await p.evaluate(async () => {
			const c = await import('/src/game/constants.ts');
			const info = await import('/src/game/gameInfoText.ts');
			const all = JSON.stringify(info.gameInfoText({}));
			const rules = /\*\*The Super wheel\.\*\*[^"]*/.exec(all)?.[0] ?? '';
			const t = c.SUPER_WHEEL.text;
			return { led: [t.emerge, t.press, t.auto, t.go, t.column, ...Object.values(t.names)], rules, intro: c.INTRO_LINE.super };
		});
		const tag = `words${extra ? ' (social)' : ''}`;
		check(T.led.every((s) => /^[A-Z ]+$/.test(s)), `${tag}: the LED strip's words are plain capitals`, T.led);
		const every = [...T.led, T.rules, T.intro, 'Spin the wheel'];
		check(every.every((s) => !BANNED.test(s) && /^[\x20-\x7e]*$/.test(s)), `${tag}: none of the restricted words, printable ASCII only`, every.filter((s) => BANNED.test(s) || !/^[\x20-\x7e]*$/.test(s)));
		check(T.rules.length > 120 && /decided when the round is triggered/.test(T.rules) && /changes nothing/.test(T.rules) && /not equally likely/.test(T.rules) && /Autoplay Bonuses/.test(T.rules), `${tag}: the rules say what the wheel is (the opening is decided when the round is triggered and the wheel shows it; the other wedges are examples, not equally likely; Autoplay Bonuses starts it)`, T.rules);
		await ctx.close();
	}
}

// ---------------------------------------------------------------- the pin and the wedges' numbers
async function pinSection(browser) {
	const { ctx, p, errs } = await boot(browser, PLAYED);
	try {
		await p.evaluate(() => window.__reindeer.fixtures.next('super_typical'));
		await p.click('.hudp button.spin');
		const rested = await toPhase(p, 'rest', 180000);
		check(rested, 'pin: the wheel comes out and rests', null);
		if (!rested) return;
		await sleep(400);
		const rest = await W(p);
		const colors = await p.evaluate(() => window.__reindeer.tune.wildMult.colors);
		const nums = rest.nums ?? [];
		const bad = rest.plan.slices.map((sl, i) => ({ sl, n: nums[i] })).filter(({ sl, n }) => {
			const [tier, mx] = sl.split(' ');
			return !n || n.color !== colors[tier] || n.value !== Number(mx.replace('x', '')) || n.place !== 'wheel' || n.glyphs < 2;
		});
		check(nums.length === 8 && bad.length === 0, `pin: each wedge's number is the Wild multiplier in its character's color (${nums.map((n, i) => `${rest.plan.slices[i]} ${n.color}`).join(', ')})`, bad);
		await p.evaluate(() => window.__reindeer.wheelPegTrace(true));
		await p.keyboard.press('Space');
		const landed = await toPhase(p, 'land', 120000);
		// (the disc stands from the stop on; the peg goes on settling: REST_MS and a little more)
		await sleep(REST_MS + 900);
		const tr = (await p.evaluate(() => window.__reindeer.wheelPegTrace(false))) ?? [];
		const w = await W(p);
		const K = await p.evaluate(() => window.__reindeer.tune.superWheel.peg);
		check(landed && tr.length > 50, `pin: the spin recorded (${tr.length} frames)`, { landed, n: tr.length });
		const EPS = 0.05;
		const inside = tr.filter((f) => f.gap < -PIN_TOL);
		check(inside.length === 0, `pin: the flapper (its drawn outline, its whole length) is never inside a stud (deepest ${Math.min(...tr.map((f) => f.gap)).toFixed(2)} wheel units; tolerance ${PIN_TOL})`, inside.slice(0, 3));
		// a frame "in contact": a stud on the flapper at the frame's end, or met inside the frame
		const touching = (f) => f.stud !== null || (f.met && f.met.length > 0);
		// AT REST means the flapper stayed within EPS (each frame's largest swing inside it, maxAbs, so a peak between two
		// frames counts) for at least one whole ring of its spring (2 pi over the damped spring's speed, from
		// SUPER_WHEEL.peg's stiffness and damping: 272 ms at 550 and 8). Until 2026-11-21 it was 3 frames (50 ms). With the
		// deeper pin (908119c) the free ring after the last stud is lightly damped (0.17 of critical) and its tail crosses
		// the EPS band in 4 or 5 frames: a ring of 0.068 degrees (0.2 wheel units at the tip, about a tenth of a device
		// pixel) was read as a start from rest, though its swings only shrank (the probe host, 2026-11-20: -0.056 degrees,
		// gap 98, no stud). A swing over EPS cannot stay inside EPS for a whole ring, so a pin quiet that long is truly
		// still, and a turn after it with no stud near is a real untouched start (tools/wheel_peg_check.mjs proves the
		// same rule in node: no free ring trips it, a kick given with no stud does).
		const zeta = K.damping / (2 * Math.sqrt(K.stiffness));
		const RING_MS = (2 * Math.PI * 1000) / (Math.sqrt(K.stiffness) * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta)));
		const quiet = (f) => (f.maxAbs ?? Math.abs(f.phi)) <= EPS;
		const early = [];
		let quietSince = null;
		for (let i = 1; i < tr.length; i++) {
			const f = tr[i];
			// (quiet up to this frame's start, the frame before's clock: a long frame's own time is not rest; a stud on it at
			// the frame before's end, the frame's start, that let go inside it is a touch)
			if (!quiet(f) && quietSince !== null && tr[i - 1].clock - quietSince >= RING_MS && tr[i - 1].stud === null && !touching(f) && f.gap > PIN_TOL) early.push(f);
			if (!quiet(f)) quietSince = null;
			else if (quietSince === null) quietSince = tr[i - 1].clock;
		}
		check(early.length === 0, `pin: from rest (within ${EPS} degrees for a whole ring of its spring, ${RING_MS.toFixed(0)} board ms) it never starts to turn without a stud on it (${early.length} frames)`, early.slice(0, 3));
		const over = tr.filter((f) => Math.abs(f.phi) > K.maxSwing + 1e-6);
		check(over.length === 0, `pin: it never swings past ${K.maxSwing} degrees (largest ${Math.max(...tr.map((f) => f.maxAbs ?? Math.abs(f.phi))).toFixed(1)})`, over.slice(0, 3));
		// no stud passes the flapper without meeting it: every stud that crossed the top between two frames is in a contact
		const met = new Set();
		for (const f of tr) {
			if (f.stud !== null) met.add(f.stud);
			for (const k of f.met ?? []) met.add(k);
		}
		const crossed = new Set();
		for (let i = 1; i < tr.length; i++) {
			const lo = Math.min(-tr[i - 1].theta, -tr[i].theta) / 45;
			const hi = Math.max(-tr[i - 1].theta, -tr[i].theta) / 45;
			for (let k = Math.ceil(lo); k <= Math.floor(hi); k++) crossed.add(k);
		}
		const missed = [...crossed].filter((k) => !met.has(k));
		check(crossed.size > 0 && missed.length === 0, `pin: every stud that crossed the top met the flapper (${crossed.size} passed, ${met.size} met, at every speed, inside frames included)`, missed.slice(0, 6));
		// THE BOUNCE: each stud's kick, the largest swing in the frames it was the stud nearest the top
		const kick = new Map();
		for (const f of tr) {
			const near = Math.round(-f.theta / 45);
			kick.set(near, Math.max(kick.get(near) ?? 0, f.maxAbs ?? Math.abs(f.phi)));
		}
		const kicks = [...crossed].map((k) => kick.get(k) ?? 0);
		const kicked = kicks.filter((v) => v > KICK_DEG).length;
		check(crossed.size > 0 && kicked >= KICK_SHARE * crossed.size, `pin: ${kicked} of ${crossed.size} studs kicked it over ${KICK_DEG} degrees (at least ${KICK_SHARE * 100}%; kicks ${kicks.map((v) => v.toFixed(0)).join(' ')})`, kicks);
		const sorted = [...kicks].sort((a, b) => a - b);
		const kickMed = sorted[Math.floor(sorted.length / 2)] ?? 0;
		const largestSwing = tr.reduce((m, f) => Math.max(m, f.maxAbs ?? Math.abs(f.phi)), 0);
		check(kickMed >= KICK_MEDIAN && largestSwing >= LARGEST_MIN && largestSwing <= K.maxSwing + 1e-6, `pin: a stud's kick median ${kickMed.toFixed(1)} degrees (at least ${KICK_MEDIAN}), the largest swing ${largestSwing.toFixed(1)} (${LARGEST_MIN} to ${K.maxSwing})`, { kickMed, largestSwing });
		const ticks = tr.filter((f) => f.tick);
		const offTick = ticks.filter((f) => !(f.met && f.met.length > 0));
		check(ticks.length > 0 && offTick.length === 0, `pin: every tick (${ticks.length}) is a stud's first contact`, offTick.slice(0, 3));
		// a first contact with no tick only when the last tick was under tickMinMs of real time before it (the buzz rule)
		const minMs = await p.evaluate(() => window.__reindeer.tune.superWheel.sound.tickMinMs);
		let lastTick = -Infinity;
		const silent = [];
		const gaps = [];
		for (let i = 1; i < tr.length; i++) {
			const f = tr[i];
			if (f.tick) {
				if (lastTick > -Infinity) gaps.push(f.real - lastTick);
				lastTick = f.real;
			} else if ((f.met ?? []).length > 0 && f.real - lastTick >= minMs + 1) silent.push(f);
		}
		check(silent.length === 0 && gaps.every((g) => g >= minMs - 1), `pin: every first contact ticks unless a tick sounded under tickMinMs (${minMs} ms) before it; ticks never closer (closest ${gaps.length ? Math.min(...gaps).toFixed(1) : '-'} ms)`, silent.slice(0, 3));
		// AT REST: the stop is the last frame the disc turned; REST_MS board ms on, straight with no stud on it
		let stopAt = 0;
		for (let i = 1; i < tr.length; i++) if (tr[i].theta !== tr[i - 1].theta) stopAt = tr[i].clock;
		const after = tr.filter((f) => f.clock >= stopAt + REST_MS);
		const leaning = after.length > 0 && after.every((f) => f.stud !== null);
		const moved = after.length ? Math.max(...after.map((f) => f.phi)) - Math.min(...after.map((f) => f.phi)) : 0;
		const bent = leaning ? after.filter((f) => Math.abs(f.gap) > LEAN_GAP) : after.filter((f) => Math.abs(f.phi) > REST_DEG || f.stud !== null);
		check(after.length > 0 && bent.length === 0 && (!leaning || moved <= STILL_DEG), `pin: ${REST_MS} board ms after the stop it is ${leaning ? `leaning on a stud at ${after[after.length - 1].phi.toFixed(1)} degrees, in contact (gap within ${Math.max(...after.map((f) => Math.abs(f.gap))).toFixed(3)} units) and still (moved ${moved.toFixed(4)})` : `straight (largest ${after.length ? Math.max(...after.map((f) => Math.abs(f.phi))).toFixed(3) : '-'} degrees) with no stud on it`} (${after.length} frames)`, bent.slice(0, 3));
		note(`PIN: ${tr.length} frames, ${crossed.size} studs passed, ${met.size} met, ${kicked} kicked over ${KICK_DEG} degrees, ${ticks.length} ticks, largest swing ${Math.max(...tr.map((f) => f.maxAbs ?? Math.abs(f.phi))).toFixed(1)} degrees; at the stop ${w.atPeg}`);
		check(errs.length === 0, 'pin: no page errors', errs);
	} finally {
		await ctx.close();
	}
}

// ---------------------------------------------------------------- the wedges' numbers and busts (the layout page round 3)
/** the wheel's eight values, one wedge each (game/superWheelPlan.ts WHEEL_SHARES: Reindeer 4x to 8x, Santa 10x to 30x) */
const WHEEL_VALUES = [
	{ tier: 'reindeer', m: 4 },
	{ tier: 'santa', m: 10 },
	{ tier: 'reindeer', m: 5 },
	{ tier: 'santa', m: 12 },
	{ tier: 'reindeer', m: 6 },
	{ tier: 'santa', m: 15 },
	{ tier: 'reindeer', m: 8 },
	{ tier: 'santa', m: 30 },
];
async function numbersSection(browser) {
	for (const L of MEASURED) {
		const S = await standing(browser, L, BOOKS[7]);
		const { p, g, clip, DPR, set, shot } = S;
		const K = await p.evaluate(() => ({ place: window.__reindeer.tune.wildMult.place.wheel }));
		const spec = await p.evaluate(async () => {
			const m = await import('/src/game/superWheelSpec.ts');
			return { units: m.SUPER_WHEEL_ART.units, numbers: m.SUPER_WHEEL_ART.numbers };
		});
		const U = spec.units;
		const phone = Math.min(L.vp.width, L.vp.height) <= 480;
		const cls = phone ? 'phone' : 'wide';
		await p.evaluate(() => {
			window.__reindeer.sceneOnly(true);
			window.__reindeer.wheelAlone(true);
		});
		const u = g.d / (2 * U.rim); // CSS px per wheel unit
		// (a device pixel's reach in wheel units: a small wheel's edge pixels are read further past the line)
		const tol = Math.max(EDGE_TOL, 1.2 / (DPR * u));
		const theta = -22.5;
		await set({ only: [], theta });
		const none = await shot();
		/** a mask's pixels in the disc's own frame: radius (wheel units), the wedge they fall in and their distance (wheel
		 *  units) inside that wedge's nearer side line */
		const polar = (m) => {
			const out = [];
			for (let i = 0; i < m.pts.length; i += 2) {
				const x = ((m.pts[i] + 0.5) / DPR + clip.x - g.cx) / u;
				const y = ((m.pts[i + 1] + 0.5) / DPR + clip.y - g.cy) / u;
				const r = Math.hypot(x, y);
				const a = (((Math.atan2(x, -y) * 180) / Math.PI - theta) % 360 + 360) % 360;
				const k = Math.floor(a / 45);
				const off = a - (k * 45 + 22.5);
				out.push({ r, k, side: r * Math.sin(((22.5 - Math.abs(off)) * Math.PI) / 180) });
			}
			return out;
		};
		const caps = new Set();
		let worstSide = Infinity;
		let worstR = 0;
		let worstIn = Infinity;
		const badNum = [];
		for (let turn = 0; turn < 8; turn++) {
			const slices = WHEEL_VALUES.map((_, i) => WHEEL_VALUES[(i + turn) % 8]);
			await set({ slices, theta, only: ['wedges'], numsOnly: true });
			await sleep(150);
			const w = await W(p);
			for (const n of w.nums) caps.add(n.cap.toFixed(2));
			if (turn === 0) {
				check(w.outlineClass === cls && w.nums.every((n) => n.outline && Math.abs(n.arc - U.multR) < 0.01), `numbers ${L.name}: the ${cls} outline (${spec.numbers.outline[cls]} wheel units, baked), every number on the arc of radius ${U.multR}`, { cls: w.outlineClass, nums: w.nums });
				const order = w.discOrder;
				check(order.indexOf('lights') > order.indexOf('wedges') && order.indexOf('wedges') >= 0, `numbers ${L.name}: the string lights draw over the wedges' numbers (the disc, bottom to top: ${order.join(', ')})`, order);
			}
			const pts = polar(diffMask(await shot(), none, 24));
			for (const q of pts) {
				worstSide = Math.min(worstSide, q.side);
				worstR = Math.max(worstR, q.r);
				worstIn = Math.min(worstIn, q.r);
				// clear of the dark divider (4 units each side of the line) and under the trim's wire
				if (q.side < 4 - tol || q.r > U.trim.wire[0] + tol) badNum.push({ turn, ...q });
			}
			if (SHOTS && (turn === 0 || turn === 1)) {
				await set({ numsOnly: false, only: null });
				await p.evaluate(() => {
					window.__reindeer.sceneOnly(false);
					window.__reindeer.wheelAlone(false);
				});
				await sleep(120);
				writeFileSync(join(SHOTS, `${L.name}_values_${turn}.png`), await p.screenshot({ clip }));
				await p.evaluate(() => {
					window.__reindeer.sceneOnly(true);
					window.__reindeer.wheelAlone(true);
				});
			}
		}
		check(caps.size === 1 && Math.abs(Number([...caps][0]) - K.place.caps[0]) < 0.01, `numbers ${L.name}: one letter height for every value in every place (${[...caps].join(', ')} wheel units; WILD_MULT.place.wheel caps ${K.place.caps[0]})`, [...caps]);
		check(badNum.length === 0, `numbers ${L.name}: every value in every wedge place stays inside its wedge, clear of the divider (closest ${worstSide.toFixed(1)} wheel units from a side line, the divider 4) and under the trim (outermost pixel at radius ${worstR.toFixed(1)}, the trim's wire from ${U.trim.wire[0]})`, badNum.slice(0, 4));
		// (2026-11-21, the probe host by hand at 400x225 on 90be3f4: the numbers nearest the hub ran under the hub and the column
		// ring; since the numbers sit out by the rim, superWheelSpec multR) every number pixel outside the column ring's outer
		// edge (its gold and ink to RING[1] + 5.5 units, tools/build_super_wheel.py make_ring), so the ring rising in spin two
		// never covers one, and outside the hub
		const ringOut = U.ring[1] + 5.5;
		check(worstIn >= Math.max(ringOut, U.hub) + tol, `numbers ${L.name}: every value in every wedge place lies outside the column ring and the hub (innermost number pixel at radius ${worstIn.toFixed(1)}; the ring's outer edge ${ringOut}, the hub ${U.hub})`, { worstIn, ringOut, hub: U.hub });
		// THE BUSTS, cut to their wedges (baked): one wedge's picture drawn alone (a Reindeer wedge and a Santa wedge), every
		// pixel of it measured against THAT wedge (2026-11-21: measured against whichever wedge a pixel fell in, the side
		// lines could never fail and the arcs failed on the GPU's own filtering): no pixel past its side lines (onto a
		// neighbor); past its outer arc only under the trim's opaque bands (to U.trim.inkIn[1]), past its inner arc only under
		// the hub's gold disc (superWheelSpec hubFit.discRadius). The wedge picture is baked exact (tools/build_super_wheel.py
		// make_wedge); a mipmapped sheet drawn well under its size (the desktop tier: the pop-out, a small window) spreads
		// every edge by a sheet pixel or two, which the trim and the hub cover.
		// (the scene's clock held still and a fresh empty picture taken first: a snowflake drifting between the two pictures
		// read as 39 units past a side line at the pop-out, 2026-11-21)
		const hubDisc = await p.evaluate(async () => (await import('/src/game/superWheelSpec.ts')).SUPER_WHEEL_ART.hubFit.discRadius);
		await p.evaluate(() => window.__reindeer.clock(0));
		await set({ only: [], wedgeOnly: null, slices: WHEEL_VALUES, theta });
		await sleep(150);
		const none2 = await shot();
		const edges = [];
		// (a device pixel in wheel units; the dark divider's half on each side of a side line, tools/build_super_wheel.py
		// make_wedge: 4 units of ink, so a spread of up to that, or two device pixels, lies on the neighbor's own divider)
		const devPx = 1 / (DPR * u);
		// THE RENDERED PIXEL (2026-11-21): the game draws at its own resolution (RENDER_RESOLUTION_CAP: 2 on the desktop
		// tier), which the browser scales to the screenshot's DPR, so a rendered pixel can be wider than a device pixel (the
		// pop-out at DPR 3: 2.91 wheel units against 1.94). Read off the page: the largest canvas's pixels over its CSS width
		// (falls back to DPR, the stricter).
		const renderRes = (await p.evaluate(() => {
			const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
			const cssW = c?.getBoundingClientRect().width ?? 0;
			return c && cssW > 0 ? c.width / cssW : 0;
		})) || DPR;
		const renderPx = 1 / (Math.min(DPR, renderRes) * u);
		// THE ALLOWANCE (2026-11-21, the probe host at the pop-out: 4.21 against 4.00, zero bright pixels): the sheet's
		// wedge is cut exact, its divider the 4 units INSIDE its side line (tools/build_super_wheel.py make_wedge paints
		// bust and divider only inside the outline; on the shipped sheets no wedge pixel's centre lies more than half a
		// sheet pixel past the line, 0.22 units on the desktop sheet, 0.35 on the phone's). Its dark ink then reaches past
		// the line only by the drawing's filtering: the mip level the sheet is read at (at the pop-out a rendered pixel
		// spans about 5.8 sheet pixels, between mip levels 2 and 3, texels of 2 and 4 units), the bilinear read, and the
		// browser's scaling of the canvas onto the screenshot. A spread up to DIVIDER_HALF lies on the neighbor's own
		// divider (the same ink); one rendered pixel more lies in the pixel that already straddles the neighbor divider's
		// inner edge, which shows divider ink when all eight draw. So the allowance is the divider's half plus one rendered
		// pixel (or two device pixels on a small wheel, as before). The bright test below is unchanged: any pixel past the
		// line by more than a device pixel that is lighter than the picture under it (the bust's own art, not the
		// divider's ink) fails.
		const sideAllow = Math.max(DIVIDER_HALF + renderPx, 2 * devPx);
		for (const k of [0, 1]) {
			await set({ numsOnly: false, only: ['wedges'], theta, wedgeOnly: k });
			await sleep(150);
			const png0 = await shot();
			const m = diffMask(png0, none2, 24);
			let side = Infinity;
			let outer = 0;
			let inner = 0;
			let worstOuter = null;
			let worstInner = null;
			let worstSide = null;
			let bright = 0;
			for (let i = 0; i < m.pts.length; i += 2) {
				const cssX = (m.pts[i] + 0.5) / DPR + clip.x;
				const cssY = (m.pts[i + 1] + 0.5) / DPR + clip.y;
				const x = (cssX - g.cx) / u;
				const y = (cssY - g.cy) / u;
				const r = Math.hypot(x, y);
				const a = (((((Math.atan2(x, -y) * 180) / Math.PI - theta - (k * 45 + 22.5)) % 360) + 540) % 360) - 180;
				const s = r * Math.sin(((22.5 - Math.abs(a)) * Math.PI) / 180);
				if (s < side) {
					side = s;
					worstSide = { cssX, cssY, r, a };
				}
				// past the line by more than a device pixel: only the wedge's own dark divider, spread by the filtering
				if (s < -devPx) {
					const o = (m.pts[i + 1] * png0.width + m.pts[i]) * 4;
					// (darker than the empty picture there: the ink laid over it; anything that lightens it is not the divider)
					const now = png0.data[o] + png0.data[o + 1] + png0.data[o + 2];
					const was = none2.data[o] + none2.data[o + 1] + none2.data[o + 2];
					if (now > was + DIVIDER_DARK) bright++;
				}
				if (r - U.wedge > outer) {
					outer = r - U.wedge;
					worstOuter = { cssX, cssY, r, a };
				}
				if (U.hub - r > inner) {
					inner = U.hub - r;
					worstInner = { cssX, cssY, r, a };
				}
			}
			edges.push({ k, tier: WHEEL_VALUES[k].tier, side: -side, bright, outer, inner, worstSide, worstOuter, worstInner });
			if (SHOTS) {
				writeFileSync(join(SHOTS, `${L.name}_wedge${k}_alone.png`), PNG.sync.write(png0));
				writeFileSync(join(SHOTS, `${L.name}_wedge${k}_alone.json`), JSON.stringify({ clip, DPR, g, u, theta, edges: edges[edges.length - 1] }));
			}
		}
		await set({ wedgeOnly: null });
		await p.evaluate(() => window.__reindeer.clock(1));
		const sideOver = Math.max(...edges.map((e) => e.side));
		const outerOver = Math.max(...edges.map((e) => e.outer));
		const innerOver = Math.max(...edges.map((e) => e.inner));
		note(`BUSTS ${L.name}: past the side lines ${sideOver.toFixed(2)}, past the outer arc ${outerOver.toFixed(2)} (to radius ${(U.wedge + outerOver).toFixed(2)}), past the inner arc ${innerOver.toFixed(2)} (to radius ${(U.hub - innerOver).toFixed(2)}) wheel units; a device pixel ${(1 / (DPR * u)).toFixed(2)} units`);
		const brightPast = edges.reduce((n, e) => n + e.bright, 0);
		check(sideOver <= sideAllow && brightPast === 0, `numbers ${L.name}: a Reindeer and a Santa wedge's picture drawn alone reach past their side lines only by the filtering's spread of their own dark divider (${sideOver.toFixed(2)} wheel units at most, allowed ${sideAllow.toFixed(2)}: the divider's half ${DIVIDER_HALF} plus one rendered pixel ${renderPx.toFixed(2)}, or two device pixels; ${brightPast} pixels past a device pixel lighter than the picture under them)`, edges.map((e) => ({ tier: e.tier, side: e.side, bright: e.bright, at: e.worstSide })));
		check(U.wedge + outerOver <= U.trim.inkIn[1] && U.hub - innerOver >= 0 && hubDisc >= U.hub, `numbers ${L.name}: past their arcs only under the trim and the hub (outer edge drawn to radius ${(U.wedge + outerOver).toFixed(2)}, the trim's opaque bands to ${U.trim.inkIn[1]}; inner to ${(U.hub - innerOver).toFixed(2)}, the hub's disc to ${hubDisc})`, edges.map((e) => ({ tier: e.tier, outer: e.outer, inner: e.inner, at: [e.worstOuter, e.worstInner] })));
		note(`NUMBERS ${L.name}: class ${cls}, letter height ${[...caps].join(', ')}, the closest number pixel ${worstSide.toFixed(1)} wheel units from a side line, the outermost at radius ${worstR.toFixed(1)}, the innermost at ${worstIn.toFixed(1)}`);
		await p.evaluate(() => {
			window.__reindeer.sceneOnly(false);
			window.__reindeer.wheelAlone(false);
			window.__reindeer.wheelEnd();
		});
		check(S.errs.length === 0, `numbers ${L.name}: no page error`, S.errs);
		await S.ctx.close();
	}
}

// ---------------------------------------------------------------- the stills of the build's sheet
/** SHOTS=<dir>: one forced Super round per layout at device pixel ratio 3, its stills saved on the way (the emergence,
 *  the rest, the reindeer on the rim, the first stop, the ring's stop, the landing), with the wheel's numbers beside them */
async function shotsSection(browser) {
	const book = BOOKS[7]; // Santa 30x
	for (const L of MEASURED) await oneRound(browser, book, 'key', `shots ${L.name}`, { shots: SHOTS, L, dpr: 3 });
}

const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
try {
	if (want('plan')) await planSection(browser);
	if (want('words')) await wordsSection(browser);
	if (want('rounds')) await roundsSection(browser);
	if (want('auto')) await autoSection(browser);
	if (want('hold')) await holdSection(browser);
	if (want('skip')) await skipSection(browser);
	if (want('resume')) await resumeSection(browser);
	if (want('concentric')) await concentricSection(browser);
	if (want('contact')) await contactSection(browser);
	if (want('pin')) await pinSection(browser);
	if (want('numbers')) await numbersSection(browser);
	if (SHOTS && (!ONLY.length || ONLY.includes('shots'))) await shotsSection(browser);
} finally {
	await browser.close();
}
if (notes.length) console.log(`\nNOTES\n${notes.join('\n')}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
