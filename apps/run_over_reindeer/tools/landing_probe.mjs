// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// THE LANDING PROBE (the landing board, Corey 2026-11-15: the mock V2 without UP TO; game/landingBoard.ts). At each size:
//   - behind PRESS ANYWHERE the road shows the posed board: reels 1 and 5 the eight ordinary symbols once each, reels
//     2, 3 and 4 the Reindeer, Santa and Grandma columns standing (drawn, with their cloud still) at the top multipliers
//     the math config gives, and nothing moving (the board clock's columns hold one frame)
//   - after the press the first board is the normal one (LANDING_BOARD) with no column left, from the first frame the
//     landing is gone
//   - a resumed round (the fixture RGS's resume: a free spin with a held column) comes back with its own column only
//   - no page errors
// With OUT=<dir> it saves the landing and the board after the press at each size (phones at device pixel ratio 3,
// desktop at 2) and writes the preload bytes before and after the landing sheet (bytes.json).
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [OUT=<dir>] node tools/landing_probe.mjs
// Uses the dev server that is already running (it never starts one). One headless browser, closed at the end. Take the
// shared browser lock around it (mkdir /tmp/hud_mock_shot.lock ... rmdir).
import { createRequire } from 'node:module';
import { mkdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3014';
const OUT = process.env.OUT || '';
const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'assets');
if (OUT) mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SIZES = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, dpr: 2, phone: false },
	{ name: 'landscape', vp: { width: 844, height: 390 }, dpr: 3, phone: true },
	{ name: 'portrait', vp: { width: 390, height: 844 }, dpr: 3, phone: true, resume: true },
	{ name: 'short', vp: { width: 390, height: 620 }, dpr: 3, phone: true },
];
const POSE_SIDES = { 0: ['H2', 'L1', 'H4', 'L3'], 4: ['L2', 'H3', 'L4', 'L5'] };
const LANDING_BOARD = [
	['L5', 'H4', 'L2', 'H3'],
	['H2', 'L3', 'W', 'L1'],
	['L4', 'H1', 'L5', 'H2'],
	['H3', 'L1', 'S', 'L3'],
	['L2', 'H4', 'L4', 'H1'],
];

let pass = 0;
let fail = 0;
const check = (ok, msg, detail) => {
	if (ok) pass += 1;
	else fail += 1;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
};

/** the top multipliers as the game's config states them (game/config.ts), read here independently of the game */
const tops = () => {
	const src = readFileSync(join(ASSETS, '..', '..', 'src', 'game', 'config.ts'), 'utf8');
	const block = src.slice(src.indexOf('multipliers: {'), src.indexOf('bonusColumnCap'));
	const top = {};
	for (const tier of ['reindeer', 'santa', 'grandma']) {
		const nums = [...block.matchAll(new RegExp(`${tier}: \\[(\\d+), (\\d+)\\]`, 'g'))].flatMap((m) => [Number(m[1]), Number(m[2])]);
		const rare = new RegExp(`bonusRare: \\{[^}]*${tier}: (\\d+)`).exec(block);
		top[tier] = Math.max(...nums, rare ? Number(rare[1]) : 0);
	}
	return top;
};

async function open(browser, S, ctx = null) {
	ctx ??= await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.dpr, isMobile: S.phone, hasTouch: S.phone });
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	return { ctx, p, errs };
}

async function waitPress(p) {
	for (let i = 0; i < 300; i++) {
		const ok = await p.evaluate(() => !!document.querySelector('.landing .pressText') && !!window.__reindeer?.road).catch(() => false);
		if (ok) return true;
		await sleep(400);
	}
	return false;
}

async function pressAndWatch(p, S) {
	await p.mouse.click(S.vp.width / 2, S.vp.height / 2);
	// the first frames with the landing gone: the posed board must already be gone
	const seen = [];
	for (let i = 0; i < 200; i++) {
		const st = await p.evaluate(() => ({ landing: !!document.querySelector('.landing'), cols: window.__reindeer.road().features.columns.length, board: window.__reindeer.road().board }));
		if (!st.landing) {
			seen.push(st);
			if (seen.length >= 3) break;
		}
		await sleep(30);
	}
	return seen;
}

(async () => {
	const TOP = tops();
	console.log('top multipliers from game/config.ts:', JSON.stringify(TOP));
	const browser = await chromium.launch();
	try {
		for (const S of SIZES) {
			const { ctx, p, errs } = await open(browser, S);
			try {
				await p.goto(`${APP}/?lang=en&sessionID=land${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
				check(await waitPress(p), `${S.name}: PRESS ANYWHERE reached`);
				await sleep(1200);
				const a = await p.evaluate(() => window.__reindeer.road());
				const cols = a.features.columns;
				const want = [
					{ reel: 1, tier: 'reindeer' },
					{ reel: 2, tier: 'santa' },
					{ reel: 3, tier: 'grandma' },
				];
				check(cols.length === 3 && want.every((w) => cols.some((c) => c.reel === w.reel && c.tier === w.tier && c.multiplier === TOP[w.tier])), `${S.name}: reels 2, 3, 4 hold the Reindeer ${TOP.reindeer}x, Santa ${TOP.santa}x and Grandma ${TOP.grandma}x columns`, cols);
				check(cols.every((c) => c.drawn && c.backdrop && c.phase === 'idle'), `${S.name}: each column drawn with its cloud still`, cols);
				check([0, 4].every((r) => JSON.stringify(a.board[r]) === JSON.stringify(POSE_SIDES[r])) && [1, 2, 3].every((r) => a.board[r].every((x) => x === null)), `${S.name}: reels 1 and 5 hold the eight ordinary symbols once each, nothing parks under the columns`, a.board);
				const words = await p.evaluate(() => document.querySelector('.landing')?.innerText ?? '');
				check(!/UP\s*TO/i.test(words), `${S.name}: no UP TO anywhere on the landing`);
				// still: two looks a second apart, nothing moved (the columns, the symbols on their marks)
				const b = await p.evaluate(() => window.__reindeer.road());
				check(a.maxDrift === 0 && b.maxDrift === 0 && JSON.stringify(a.features.columns) === JSON.stringify(b.features.columns), `${S.name}: nothing on the board moves`);
				if (OUT) await p.screenshot({ path: join(OUT, `landing_${S.vp.width}x${S.vp.height}.png`) });
				const seen = await pressAndWatch(p, S);
				check(seen.length > 0 && seen.every((s) => s.cols === 0), `${S.name}: from the first frame without the landing, no column is left`, seen.slice(0, 2));
				check(seen.length > 0 && JSON.stringify(seen[0].board) === JSON.stringify(LANDING_BOARD), `${S.name}: the first board is the normal one`, seen[0]?.board);
				await sleep(1500);
				const c = await p.evaluate(() => window.__reindeer.road());
				check(c.features.columns.length === 0 && c.atRest, `${S.name}: at rest on the first board, no column`);
				if (OUT) await p.screenshot({ path: join(OUT, `after_press_${S.vp.width}x${S.vp.height}.png`) });

				if (S.resume) {
					// a round left open: the free spin with a held reindeer column on reel 4 (natural_free_spins event 9)
					await p.evaluate(() => window.__reindeer.fixtures.resume('natural_free_spins', 9));
					await sleep(1500);
					check(await waitPress(p), `${S.name} resume: PRESS ANYWHERE reached after the reload`);
					await sleep(800);
					const r0 = await p.evaluate(() => window.__reindeer.road().features.columns.map((x) => `${x.reel}:${x.tier}:${x.multiplier}`));
					check(r0.length === 3, `${S.name} resume: the landing shows the posed board first (${r0.join(' ')})`);
					await p.mouse.click(S.vp.width / 2, S.vp.height / 2);
					let r = null;
					for (let i = 0; i < 200; i++) {
						const st = await p.evaluate(() => ({ landing: !!document.querySelector('.landing'), gt: window.__reindeer.gameType(), cols: window.__reindeer.road().features.columns.map((x) => `${x.reel}:${x.tier}:${x.multiplier}`) }));
						if (!st.landing && st.gt === 'freegame' && st.cols.length) {
							r = st;
							break;
						}
						await sleep(100);
					}
					check(!!r && r.cols.length === 1 && r.cols[0] === '3:reindeer:4', `${S.name} resume: the resumed free spin stands its own held column only (${r?.cols.join(' ')})`, r);
					if (OUT) await p.screenshot({ path: join(OUT, `resume_${S.vp.width}x${S.vp.height}.png`) });
				}
			} catch (e) {
				check(false, `${S.name}: ran to the end`, String(e).slice(0, 300));
			} finally {
				const e = errs.filter((x) => !/favicon/.test(x));
				check(e.length === 0, `${S.name}: no page errors`, e.slice(0, 4));
				await ctx.close();
			}
		}
	} finally {
		await browser.close();
	}
	// the preload's bytes before and after the landing sheet (the loading bar's own count: game/assets.ts preload: true)
	const size = (rel) => statSync(join(ASSETS, rel)).size;
	const atlasImage = (json) => join(dirname(json), JSON.parse(readFileSync(join(ASSETS, json), 'utf8')).meta.image.split('?')[0]);
	const sets = {
		desktop: ['symbols/symbols.json', atlasImage('symbols/symbols.json'), 'road/road.webp', 'road/tunnel-left.webp', 'road/tunnel-right.webp', 'audio/sounds.json', 'audio/music.json'],
		phone: ['symbols/symbols-phone.json', atlasImage('symbols/symbols-phone.json'), 'road/road.webp', 'road/tunnel-left.webp', 'road/tunnel-right.webp', 'audio/sounds.json', 'audio/music.json'],
	};
	const audio = size('audio/sounds.ogg') + size('audio/music/bgm_base.ogg');
	const bytes = {};
	for (const [tier, files] of Object.entries(sets)) {
		const before = files.reduce((n, f) => n + size(f), 0);
		const sheet = size(tier === 'desktop' ? 'columns/landing-stills.webp' : 'columns/landing-stills-phone.webp');
		bytes[tier] = { preloadBefore: before, landingSheet: sheet, preloadAfter: before + sheet, audioToo: audio, percentOfPreload: Math.round((sheet / before) * 1000) / 10, percentOfGate: Math.round((sheet / (before + audio)) * 1000) / 10 };
	}
	console.log('bytes:', JSON.stringify(bytes));
	if (OUT) writeFileSync(join(OUT, 'bytes.json'), JSON.stringify(bytes, null, 1));
	console.log(`\nlanding_probe: ${pass} pass, ${fail} fail`);
	process.exit(fail ? 1 : 0);
})();
