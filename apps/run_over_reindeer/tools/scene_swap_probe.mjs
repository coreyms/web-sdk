// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,game/road/roadBoard.ts,game/scene/sceneSwap.ts,game/scene/sceneSnapshot.ts,game/scene/sceneLayers.ts,game/scoreboard/scoreboard.ts,game/sceneChoice.ts,game/scenePresets.ts,ui/hud/SceneSwitch.svelte};
// WATCHES: ; data-resume-card, data-resume, __reindeer.atRest, __reindeer.clock, __reindeer.fixtures, __reindeer.gameType, __reindeer.gpuTextures, __reindeer.hud
// WATCHES: ; __reindeer.led, __reindeer.logoHold, __reindeer.roadBoard, __reindeer.scene, __reindeer.sceneChoice, __reindeer.sceneOnly
// WATCHES: ; __reindeer.sceneSetting, __reindeer.sceneSprites, __reindeer.sceneSwap, __reindeer.sceneSwapHold, __reindeer.sceneSwapStep
// WATCHES: ; __reindeer.scoreboard, __reindeer.scoreboardManual, __reindeer.seatTime, __reindeer.turbo, ROUND, SCENE, data-top-line
// WATCHES: ; data-scene-switch, data-scene-choice, data-hud, .landing, .am-ui, .layer, .hud-off, .hud-held, .hudp, .stat, .value, .label, .kl, .fb, .lb
// WATCHES: ; .spin, .vt, .mp, .sgmp
// WATCHES: apps/run_over_reindeer/src/ui/sign/SignMenuPanel.svelte;
// WATCHES: apps/run_over_reindeer/src/{game/scenePrefetch.ts,ui/LandingScreen.svelte}; __reindeer.scenePrefetch, noScenePrefetch
// THE SCENE SWAP PROBE (2026-11-17; game/scene/sceneSwap.ts, game/scenePresets.ts snowDay / snowNight / snowSuper). At
// 1440 x 900, 844 x 390 and 390 x 844 (the phone sizes on the phone asset tier), with the dev fixtures:
//   - THE FIRST LOAD: the day snow shows, and no piece of either night scene is asked of the network (or held) before the
//     first press
//   - A FIXTURE FREE SPINS ROUND (natural_free_spins) and A SUPER ROUND (natural_super): the scene in each phase (the base
//     spin: day; the free spins: snowNight / snowSuper, on the Pixi side and the DOM side; after the round: day again); the
//     swap in starts only once the entry scene's back board is seated (the change is under the board and the dim); the swap
//     back starts after the Total Win is dismissed
//   - NO MISSING TEXTURE, NO HARD POP: each fade is held as it starts and stepped 50 ms at a time with everything else
//     frozen (the road's clock, the scoreboard, the logo's lamps, the drivers' idle), the HTML hidden and nothing drawn but
//     the scene, the dim and the LED board's snow cover (__reindeer.sceneOnly: a driver's idle clip that comes in, a light
//     or an LED dot is not the fade's): every scene sprite
//     shown has a texture, and no step changes a pixel by much more than its share of the whole change (a piece appearing,
//     vanishing or missing for a frame changes its pixels by all of it in one step: STEP below). How far each frame is from
//     the plain mix of the first and the last is printed too (since 2026-11-19 the fade is one picture of the outgoing
//     screen over the incoming scene, so the middle frames are that mix: the transition section asserts it)
//   - GPU MEMORY (the renderer's own list of textures on the GPU): never more than two scenes' pieces at once, the lazy
//     (night) pieces within LIMIT.lazyMB, the scene pieces within the day's + LIMIT.lazyMB; after the swap back the night
//     pieces are gone (unloaded) within 2 s; the totals before, during and after are printed
//   - CONTRAST in each scene (the day at rest, each night between free spins, everything frozen): the HUD's numbers and the
//     top line with the clock at least 4.5:1, the HUD's labels and the top line's name 3:1. Measured on the rendered page: the
//     element shot with its ink and again with its ink made transparent (its halo kept); on the pixels the ink changes, the
//     ratio of the two luminances (the ink against what is directly behind its strokes: the scene, the glass, its own
//     halo), the median. The ratio with no halo is printed beside it.
//   - desktop also: a second Free Spins round after the night pieces were let go (they load again, from the browser's
//     cache: the load and upload times and the longest frame printed beside the first's), and A RESUMED ROUND inside each
//     bonus (fixtures.resume at a free spin's reveal): it comes up in its night scene, and back to day when it ends
//   - no page errors
//   CAP=<dir>: also saves the stills for the sheet (each scene, HUD up, the LED strip idle) as <size>_<preset>.png
//   SET=grass (dark mode, 2026-11-17): every check above on the Dark set (grassDay, grassNight, grassSuper: the player's Scene
//     setting stored as Dark before the page first loads), and no piece of the snow set asked for at all
//   SECTIONS=setting (dark mode): THE SCENE SETTING (game/sceneChoice.ts, ui/hud/SceneSwitch.svelte) at each size: a fresh
//     profile comes up in Snow with Snow checked on the press screen's switch and nothing of the grass set asked for; the
//     switch on the press screen is on screen, uncovered and pressable, and Dark cross-fades to grassDay there and lets the
//     snow set go (at most two scenes on the GPU on every sample); in the game the menu's switch (the same checks) changes
//     the set at once at rest both ways; Dark is remembered across a reload (the reload boots in grassDay and asks nothing of
//     the snow set); Auto follows an emulated dark and light color scheme, changed while the game is at rest; desktop also:
//     a change asked during a Free Spins round waits through the round (never during its entry or Total Win) and is taken
//     up after it. CAP: stills of the switch in the menu and on the press screen
//     THE PRESS SCREEN'S SWITCH IS INSTANT (2026-11-19, Corey: "Clicking the SNOW/DARK for the scenes on the intro page
//     isn't doing anything until you click press to continue"): before any continue press, Dark, Snow, Auto (a light
//     device: the snow set) and Snow, Dark, Snow pressed in a row each change the drawn scene there (the key checked at
//     once; the swap starts as soon as the set's pictures are in, within 5 s on a loaded headless host, its time printed), and the game then opens in the last one with no second change
//     THE OTHER SET IN THE CACHE (2026-11-19, Corey: "Load both of them during the PolyMath Intro Screen?";
//     game/scenePrefetch.ts): the other set's base scene is fetched in the background once the preload and the audio
//     are in (never part of the press gate's blocking set); every request of the other set before a press on the switch
//     is one of those files, and nothing of it reaches the GPU; with them in, a press on Dark loads every piece from the
//     browser's cache (Resource Timing: no body crossed the network the second time) within WARM_LOAD_MS of the swap's
//     ask; the press to the fade's first frame is printed (the rest is the pieces' upload to the GPU, which the prefetch
//     leaves for the press: a headless software GPU takes 400 to 600 ms there)
//   SECTIONS=transition (2026-11-19, Corey: "There are these weird lines and shading that happen while switching back and
//     fourth from Light and Dark Mode"; game/scene/sceneSnapshot.ts) at each size, both ways (Snow to Dark, Dark to Snow): the
//     fade held at its start and stepped TRANSITION.stepMs at a time, everything else frozen, the HTML hidden, the scene, the
//     dim and the LED board's snow cover alone. On every frame each pixel's point of the fade is measured (its change from
//     the first frame projected on the whole change, where that is at least TRANSITION.minChange levels), and each
//     TRANSITION.cell px square's mean against the frame's median: no square may sit more than TRANSITION.tol away (a piece,
//     a strip, a tile or the snow cover at another point of the fade than the rest is a straight edged square that does);
//     the fade lasts SCENE.swap.fadeMs (150 to 250 ms) and its picture of the outgoing screen is the only extra GPU memory
//     (printed, and gone two frames after the end); the last frame equals a cold load of that scene (a fresh page booted
//     in it); then five presses in a row (Dark, Snow, Dark, Snow, Dark, TRANSITION.rapidMs apart, the real switch in the
//     menu) end in grassDay whole with no picture left over and the frame equal to the cold load (no residue)
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [SET=grass] [ONLY=desktop,side,portrait,wide] [SECTIONS=rounds,again,resume,setting,transition] node tools/scene_swap_probe.mjs
// Uses the dev server that is already running (it never starts one). One headless browser, muted, closed at the end. Run it
// through tools/browser_lock.sh (the game lane); a turn is 15 minutes, so one size per turn with ONLY= if needed.
import { createRequire } from 'node:module';
import { pressRoundCards } from './round_card_press.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PNG } = require('playwright-core/lib/utilsBundle');

const APP = process.env.APP || 'http://localhost:3014';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SECTIONS = (process.env.SECTIONS || 'rounds,again,resume,transition').split(',');
const SEC = (s) => SECTIONS.includes(s);
const CAP = process.env.CAP || '';
if (CAP) mkdirSync(CAP, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** THE LIMITS (MB of GPU texture memory, RGBA, no mips: every scene piece is drawn near its own size) */
const LIMIT = { lazyMB: 25, scenes: 2, unloadMs: 2000 };
/** A STEP'S CHANGE: a pixel jumps when one 50 ms step changes it by more than `k` times its share of the fade's whole
 *  change (its share of the fade's time; the fade is smoothed, its steepest part 1.5 times the mean) plus `levels`; at
 *  most `share` of the pixels may */
const STEP = { k: 4, levels: 12, share: 0.0005 };
const CONTRAST = { number: 4.5, label: 3 };
/** THE TRANSITION (section transition): a stepped fade's frames; `tol`: the most a CELL px square's mean point of the fade
 *  may differ from the frame's median (0..1); `minChange`: levels of change a pixel needs to count; `cold`: the last frame
 *  against a cold load (mean levels, and the share of pixels more than `coldLevels` off); `fadeMs`: the fade's length */
const TRANSITION = { stepMs: 20, cell: 16, tol: 0.06, minChange: 24, cold: { mean: 1.5, coldLevels: 24, share: 0.002 }, fadeMs: [150, 250], rapidMs: 120 };

const SIZES = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, phone: false, extra: true },
	// (Corey's own window: the transition section only)
	{ name: 'wide', vp: { width: 2000, height: 943 }, phone: false, transitionOnly: true },
	{ name: 'side', vp: { width: 844, height: 390 }, phone: true },
	{ name: 'portrait', vp: { width: 390, height: 844 }, phone: true },
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
const info = (msg) => console.log(`  INFO ${msg}`);
const R = (p, fn, arg) => p.evaluate(fn, arg);
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
// THE SET UNDER TEST (SET=grass: the Dark set) and the files of its bonus scenes and of the other set
const SET = process.env.SET === 'grass' ? 'grass' : 'snow';
const SC = SET === 'grass' ? { day: 'grassDay', bonus: 'grassNight', super: 'grassSuper', file: { bonus: 'grass-night-', super: 'grass-super-' } } : { day: 'snowDay', bonus: 'snowNight', super: 'snowSuper', file: { bonus: 'snow-night-', super: 'snow-super-' } };
const NIGHT = SET === 'grass' ? /scene\/grass-(night|super)-/ : /scene\/snow-(night|super)-/;
/** the other set's files (never asked for in a run of one set) */
const SNOW_FILES = /scene\/snow-|road\/road\.webp|road\/tunnel-(left|right)\.webp/;
const GRASS_FILES = /scene\/grass-/;
const OTHER = SET === 'grass' ? SNOW_FILES : GRASS_FILES;
/** a press on the switch with the other set already in the browser's cache: the swap's pieces are in (fetched from the
 *  cache and decoded, on a headless CPU) within this of its ask (ms) */
const WARM_LOAD_MS = 400;
/** the other set's requests before a press are the background prefetch's (game/scenePrefetch.ts) and only those */
const prefetchOnly = async (p, asked) => {
	const pf = await R(p, () => window.__reindeer.scenePrefetch());
	const mine = new Set(pf.files.map((f) => new URL(f.url, 'http://x/').pathname.split('/assets/').pop() + new URL(f.url, 'http://x/').search));
	const stray = asked.filter((f) => !mine.has(f.url));
	return { pf, stray, ok: stray.length === 0 && (asked.length === 0 || (pf.startedAt !== null && /preload/.test(pf.why))) };
};
const STORE = 'run_over_reindeer.scene';

async function boot(browser, S, { reuse = null, choice = SET === 'grass' ? 'dark' : null, scheme = 'light', press = true } = {}) {
	const ctx = reuse?.ctx ?? (await browser.newContext({ viewport: S.vp, deviceScaleFactor: 1, isMobile: S.phone, hasTouch: S.phone, colorScheme: scheme }));
	// (2026-11-17: the bonus entry waits for the press: round_card_press.mjs presses it on the old card's timing)
	if (!reuse?.ctx) await pressRoundCards(ctx);
	// the Scene setting as stored on the device before the first load (only where nothing is stored yet: a reload keeps
	// what the page itself stored)
	if (!reuse && choice)
		await ctx.addInitScript(
			({ k, v }) => {
				try {
					if (!localStorage.getItem(k)) localStorage.setItem(k, v);
				} catch {}
			},
			{ k: STORE, v: choice },
		);
	const p = reuse?.p ?? (await ctx.newPage());
	const errs = reuse?.errs ?? [];
	const net = reuse?.net ?? [];
	/** every scene file of either set asked for (the setting's checks), and the other set's (one set's run) */
	const files = reuse?.files ?? [];
	const other = reuse?.other ?? [];
	if (!reuse) {
		p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
		p.on('console', (m) => {
			if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
		});
		p.on('request', (q) => {
			if (NIGHT.test(q.url())) net.push({ at: Date.now(), url: q.url().split('/assets/').pop() });
			if (OTHER.test(q.url())) other.push({ at: Date.now(), url: q.url().split('/assets/').pop() });
			if (SNOW_FILES.test(q.url()) || GRASS_FILES.test(q.url())) files.push({ at: Date.now(), url: q.url().split('/assets/').pop() });
		});
		// the frame clock (the longest frame around a swap's upload)
		// (the page's Resource Timing buffer holds 250 entries by default, fewer than the game asks for: the cache check
		// reads the scene pieces' second fetch)
		await p.addInitScript(() => performance.setResourceTimingBufferSize?.(10000));
		await p.addInitScript(() => {
			const F = (window.__frames = { t: new Float64Array(6000), n: 0 });
			let last = 0;
			const tick = (t) => {
				if (last) {
					F.t[F.n % 6000] = t;
					F.n += 1;
				}
				last = t;
				requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		});
		await p.goto(`${APP}/?lang=en&sessionID=swap${S.name}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
	}
	if (press) await enter(p, S);
	return { ctx, p, errs, net, files, other };
}

/** past the press screen to the game at rest */
async function enter(p, S) {
	for (let i = 0; i < 220; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && window.__reindeer.hud && !document.querySelector('.landing') && window.__reindeer.sceneSwap && window.__reindeer.scoreboard?.())).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	await sleep(900);
}

/** the swap and the GPU as they are now */
const swapNow = (p) =>
	R(p, () => {
		const s = window.__reindeer.sceneSwap();
		const gpu = window.__reindeer.gpuTextures();
		const scenes = new Set();
		for (const v of Object.values(s.pieces)) if (v.gpu) scenes.add(v.preset);
		const sb = window.__reindeer.scoreboard();
		return {
			shown: s.shown,
			want: s.want,
			dom: s.dom,
			set: s.set,
			choice: s.choice,
			loadedPresets: [...new Set(Object.values(s.pieces).map((v) => v.preset))],
			fade: s.fade,
			starting: s.starting,
			skins: s.skins,
			sceneGpuMB: s.sceneGpuMB,
			lazyGpuMB: s.lazyGpuMB,
			lazyKeys: Object.entries(s.pieces)
				.filter(([, v]) => v.lazy)
				.map(([k]) => k),
			scenesOnGpu: [...scenes],
			gpuMB: gpu.mb,
			gameType: window.__reindeer.gameType(),
			card: sb.card,
			show: sb.show ? { kind: sb.show.kind, t: sb.show.t, phase: sb.show.phase, seatedAt: sb.show.seatedAt } : null,
			idle: window.__reindeer.hud.idle(),
			rest: window.__reindeer.atRest(),
			hudOff: !!document.querySelector('.am-ui.layer.hud-off, .am-ui.layer.hud-held'),
			log: s.log,
		};
	});

/** everything that moves on its own held still (the road's clock, the scoreboard, the logo's lamps, the drivers' idle) */
const freeze = (p, on) =>
	R(p, (on) => {
		const r = window.__reindeer;
		r.clock(on ? 0 : 1);
		r.scoreboardManual(on);
		r.seatTime(on ? 0 : null);
		if (on) r.logoHold(r.scene().logo?.lamps?.ms ?? 5000);
		else r.logoHold(null);
	}, on);

// ---- the plain mix ----------------------------------------------------------------------------------------------------
const lum = (r, g, b) => {
	const c = (v) => {
		v /= 255;
		return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
const mixResidual = (a, b, f, alpha) => {
	const n = f.data.length / 4;
	const hist = new Uint32Array(256);
	let big = 0;
	let most = 0;
	for (let i = 0; i < f.data.length; i += 4) {
		let d = 0;
		for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(f.data[i + c] - (a.data[i + c] * (1 - alpha) + b.data[i + c] * alpha)));
		const k = Math.min(255, Math.round(d));
		hist[k] += 1;
		if (k > 24) big += 1;
		if (k > most) most = k;
	}
	let acc = 0;
	let p995 = 0;
	for (let k = 0; k < 256; k++) {
		acc += hist[k];
		if (acc >= n * 0.995) {
			p995 = k;
			break;
		}
	}
	return { p995, bigShare: big / n, most };
};
/** the change from the first frame to the last (mean levels): a fade that changed nothing is no test */
const meanDiff = (a, b) => {
	let s = 0;
	for (let i = 0; i < a.data.length; i += 4) s += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
	return s / (a.data.length / 4) / 3;
};

/** the HTML over the canvas hidden (the fade's check is the canvas's; the DOM side has its own CSS transition, and the
 *  HUD may come back while the fade is held) */
const hideDom = (p, on) =>
	R(p, (on) => {
		let el = document.getElementById('swap-probe-hide');
		if (on && !el) {
			el = document.createElement('style');
			el.id = 'swap-probe-hide';
			// (the menu's popover too: the transition section steps a fade with it open, as the switch in it was pressed)
			el.textContent = '.am-ui, [data-top-line], [role="dialog"][aria-label="Menu"] { visibility: hidden !important; }';
			document.head.appendChild(el);
		}
		if (!on && el) el.remove();
	}, on);

/** a fade held at its start: step it 50 ms at a time, everything else frozen and the HTML hidden; every frame checked */
async function stepFade(p, S, tag) {
	const out = { frames: 0, missing: 0, jumps: null, mix: null, change: 0 };
	await freeze(p, true);
	await hideDom(p, true);
	await R(p, () => window.__reindeer.sceneOnly(true));
	await sleep(300);
	const shot = async () => PNG.sync.read(await p.screenshot());
	const frames = [];
	let f = await R(p, () => window.__reindeer.sceneSwap().fade);
	const total = f ? f.ms + f.tail : 1;
	const sprites0 = await R(p, () => window.__reindeer.sceneSprites());
	out.missing += sprites0.missing;
	frames.push({ t: f?.t ?? 0, alpha: f?.alpha ?? 0, png: await shot() });
	for (let i = 0; i < 20 && f; i++) {
		f = await R(p, () => window.__reindeer.sceneSwapStep(50));
		await R(p, () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
		const sp = await R(p, () => window.__reindeer.sceneSprites());
		out.missing += sp.missing;
		frames.push({ t: f ? f.t : total, alpha: f ? f.alpha : 1, png: await shot() });
	}
	const a = frames[0].png;
	const b = frames[frames.length - 1].png;
	out.change = r1(meanDiff(a, b));
	const W = a.width;
	const n = a.data.length / 4;
	// the whole change per pixel
	const T = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const j = i * 4;
		T[i] = Math.max(Math.abs(a.data[j] - b.data[j]), Math.abs(a.data[j + 1] - b.data[j + 1]), Math.abs(a.data[j + 2] - b.data[j + 2]));
	}
	let worst = { share: 0, step: 0, box: null };
	for (let k = 1; k < frames.length; k++) {
		const dp = Math.max(0, (frames[k].t - frames[k - 1].t) / total);
		const f0 = frames[k - 1].png.data;
		const f1 = frames[k].png.data;
		let jumps = 0;
		let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
		for (let i = 0; i < n; i++) {
			const j = i * 4;
			const d = Math.max(Math.abs(f1[j] - f0[j]), Math.abs(f1[j + 1] - f0[j + 1]), Math.abs(f1[j + 2] - f0[j + 2]));
			if (d > STEP.k * dp * T[i] + STEP.levels) {
				jumps += 1;
				const x = i % W;
				const y = (i / W) | 0;
				if (x < x0) x0 = x;
				if (y < y0) y0 = y;
				if (x > x1) x1 = x;
				if (y > y1) y1 = y;
			}
		}
		if (jumps / n > worst.share) worst = { share: Math.round((jumps / n) * 100000) / 100000, step: k, box: jumps ? [x0, y0, x1, y1] : null };
	}
	out.jumps = worst;
	// the frames either side of the worst step, cropped round what jumped (CAP only: to see what it was)
	if (CAP && worst.box) {
		const [x0, y0, x1, y1] = worst.box;
		const pad = 24;
		const cx = Math.max(0, x0 - pad);
		const cy = Math.max(0, y0 - pad);
		const cw = Math.min(W - cx, x1 - x0 + 2 * pad);
		const ch = Math.min(a.height - cy, y1 - y0 + 2 * pad);
		for (const k of [worst.step - 1, worst.step]) {
			const src = frames[k].png;
			const crop = new PNG({ width: cw, height: ch });
			for (let y = 0; y < ch; y++) src.data.copy(crop.data, y * cw * 4, ((cy + y) * W + cx) * 4, ((cy + y) * W + cx + cw) * 4);
			writeFileSync(`${CAP}/jump_${tag.replace(/[^a-z0-9]+/gi, '_')}_step${k}.png`, PNG.sync.write(crop));
		}
	}
	for (const fr of frames.slice(1, -1)) {
		const m = mixResidual(a, b, fr.png, fr.alpha);
		if (!out.mix || m.p995 > out.mix.p995) out.mix = { p995: m.p995, most: m.most, alpha: fr.alpha };
	}
	out.frames = frames.length;
	await R(p, () => window.__reindeer.sceneOnly(false));
	await hideDom(p, false);
	await freeze(p, false);
	check(out.missing === 0, `${tag}: every scene sprite shown has its texture on all ${out.frames} stepped frames`, out);
	check(out.change > 2 && out.jumps.share <= STEP.share, `${tag}: no hard pop over ${out.frames - 1} steps of 50 ms (pixels that jump in one step: ${out.jumps.share} at worst; the fade changes ${out.change} levels on average)`, out);
	info(`${tag}: furthest from the plain mix: p99.5 ${out.mix?.p995} levels (most ${out.mix?.most}) at alpha ${out.mix?.alpha}`);
	return out;
}

// ---- contrast ----------------------------------------------------------------------------------------------------------
const TARGETS = () => {
	const out = [];
	const opac = (el) => {
		let o = 1;
		for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
			const cs = getComputedStyle(e);
			if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
			o *= Number(cs.opacity);
		}
		return o;
	};
	const add = (el, kind, what) => {
		const b = el.getBoundingClientRect();
		const text = (el.textContent || '').trim();
		if (!text || b.width < 2 || b.height < 2 || b.right < 0 || b.bottom < 0 || b.left > innerWidth || b.top > innerHeight) return;
		if (opac(el) < 0.95) return;
		el.setAttribute('data-contrast-id', String(out.length));
		out.push({ id: out.length, kind, what, text: text.slice(0, 24), box: { x: b.x, y: b.y, w: b.width, h: b.height } });
	};
	for (const el of document.querySelectorAll('[data-top-line]')) add(el, /\d/.test(el.textContent || '') ? 'number' : 'label', 'top line');
	for (const el of document.querySelectorAll('.hudp .stat .value')) add(el, 'number', 'readout');
	for (const el of document.querySelectorAll('.hudp .stat .label')) add(el, 'label', 'readout word');
	for (const el of document.querySelectorAll('.hudp .kl')) add(el, 'label', 'key word');
	for (const el of document.querySelectorAll('.hudp .fb .lb')) add(el, 'label', 'feature word');
	return out;
};
async function contrast(p, S, preset, { frozen = false, turbo = 0 } = {}) {
	if (!frozen) await freeze(p, true);
	// the keys in their resting state (a turbo level lights the TURBO word in the accent red, the same in every scene)
	await R(p, () => window.__reindeer.turbo(0));
	await sleep(250);
	const targets = await R(p, TARGETS);
	const rows = [];
	for (const t of targets) {
		const clip = { x: Math.max(0, Math.floor(t.box.x) - 2), y: Math.max(0, Math.floor(t.box.y) - 2), width: Math.ceil(t.box.w) + 4, height: Math.ceil(t.box.h) + 4 };
		if (clip.x + clip.width > S.vp.width) clip.width = S.vp.width - clip.x;
		if (clip.y + clip.height > S.vp.height) clip.height = S.vp.height - clip.y;
		const style = (mode) =>
			R(
				p,
				({ id, mode }) => {
					const el = document.querySelector(`[data-contrast-id="${id}"]`);
					if (!el) return;
					// the element's own inline style (the top line's ink and halo are inline) is kept and put back exactly
					if (el.dataset.swapStyle === undefined) el.dataset.swapStyle = el.getAttribute('style') ?? '';
					el.setAttribute('style', el.dataset.swapStyle);
					if (mode === 'restore') {
						if (el.dataset.swapStyle) el.setAttribute('style', el.dataset.swapStyle);
						else el.removeAttribute('style');
						delete el.dataset.swapStyle;
						return;
					}
					el.style.setProperty('transition', 'none', 'important');
					if (mode !== 'ink') el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
					if (mode === 'bare') el.style.setProperty('text-shadow', 'none', 'important');
					return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
				},
				{ id: t.id, mode },
			);
		await style('ink');
		const A = PNG.sync.read(await p.screenshot({ clip }));
		await style('halo');
		const B = PNG.sync.read(await p.screenshot({ clip }));
		await style('bare');
		const C = PNG.sync.read(await p.screenshot({ clip }));
		await style('restore');
		const n = A.data.length / 4;
		const LA = new Float64Array(n);
		const LB = new Float64Array(n);
		const LC = new Float64Array(n);
		let maxD = 0;
		for (let i = 0; i < n; i++) {
			LA[i] = lum(A.data[i * 4], A.data[i * 4 + 1], A.data[i * 4 + 2]);
			LB[i] = lum(B.data[i * 4], B.data[i * 4 + 1], B.data[i * 4 + 2]);
			LC[i] = lum(C.data[i * 4], C.data[i * 4 + 1], C.data[i * 4 + 2]);
			maxD = Math.max(maxD, Math.abs(LA[i] - LB[i]));
		}
		const ratios = [];
		const bare = [];
		for (let i = 0; i < n; i++) {
			if (Math.abs(LA[i] - LB[i]) < 0.5 * maxD) continue;
			ratios.push((Math.max(LA[i], LB[i]) + 0.05) / (Math.min(LA[i], LB[i]) + 0.05));
			bare.push((Math.max(LA[i], LC[i]) + 0.05) / (Math.min(LA[i], LC[i]) + 0.05));
		}
		const med = (v) => (v.length ? v.sort((a, b) => a - b)[Math.floor(v.length / 2)] : 0);
		rows.push({ ...t, ratio: r2(med(ratios)), bare: r2(med(bare)), px: ratios.length });
	}
	await R(p, (t) => window.__reindeer.turbo(t), turbo);
	if (!frozen) await freeze(p, false);
	const tag = `${S.name} ${preset}`;
	check(rows.length >= 4, `${tag}: contrast measured on ${rows.length} HUD and top line texts`, rows.map((r) => r.text));
	for (const r of rows) {
		const need = CONTRAST[r.kind];
		check(r.ratio >= need, `${tag}: ${r.what} "${r.text}" ${r.ratio}:1 (needs ${need}:1 as a ${r.kind}; no halo ${r.bare}:1)`, r);
	}
	return rows;
}

/** a still for the sheet (CAP): the scene as it is now, the HUD up, everything frozen */
async function still(p, S, preset, { frozen = false } = {}) {
	if (!CAP) return;
	if (!frozen) await freeze(p, true);
	await sleep(500);
	writeFileSync(`${CAP}/${S.name}_${preset}.png`, await p.screenshot());
	if (!frozen) await freeze(p, false);
}

/** frames (ms) between two performance.now() times */
const frameStats = (p, from, to) =>
	R(
		p,
		({ from, to }) => {
			const F = window.__frames;
			const ts = [];
			for (let i = Math.max(0, F.n - 6000); i < F.n; i++) ts.push(F.t[i % 6000]);
			const dts = [];
			for (let i = 1; i < ts.length; i++) if (ts[i] >= from && ts[i] <= to) dts.push(ts[i] - ts[i - 1]);
			dts.sort((a, b) => a - b);
			return { n: dts.length, median: dts.length ? Math.round(dts[Math.floor(dts.length / 2)]) : null, max: dts.length ? Math.round(dts[dts.length - 1]) : null };
		},
		{ from, to },
	);

const logTimes = (log, what) => log.filter((l) => l.what === what);

/** a quiet moment in the bonus, caught in the page on the frame it happens (the probe's polling would miss the short ones):
 *  a free spin's cars parked, no card, no fade, no message on the strip, the HUD back for a second: everything is frozen
 *  there and window.__swapQuiet says so */
const armQuiet = (p, night) =>
	R(p, (night) => {
		window.__swapQuiet = null;
		let hudSince = 0;
		const look = (t) => {
			const r = window.__reindeer;
			if (!r || window.__swapQuiet) return;
			const s = r.sceneSwap();
			const sb = r.scoreboard();
			// (the HUD under a card: faded before 2026-11-20, on screen and inert since, hud-held)
			const hudOff = !!document.querySelector('.am-ui.layer.hud-off, .am-ui.layer.hud-held');
			if (hudOff || r.gameType() !== 'freegame') hudSince = t;
			// (no reindeer running, no crosshair, no win lines: the board idle between spins)
			const rb = r.roadBoard();
			const idleBoard = rb.atRest && !rb.features.runner && !rb.features.crosshairLayer.children.some((c) => c.visible && c.alpha > 0.01) && !rb.winLayer.visible;
			if (r.gameType() === 'freegame' && !sb.card && !sb.show && !s.fade && s.shown === night && s.dom === night && !hudOff && t - hudSince > 1000 && idleBoard) {
				r.clock(0);
				r.scoreboardManual(true);
				r.seatTime(0);
				r.logoHold(r.scene().logo?.lamps?.ms ?? 5000);
				window.__swapQuiet = { night, at: t };
				return;
			}
			requestAnimationFrame(look);
		};
		requestAnimationFrame(look);
	}, night);

async function roundChecks(p, S, fixture, night, opts = {}) {
	const tag = `${S.name} ${fixture}`;
	// the round, each held fade stepped as it starts
	const res = await bonusRoundWithSteps(p, S, fixture, night, opts);
	const { seen } = res;
	if (opts.contrastToo !== false) check(!!seen.contrast, `${tag}: a quiet moment between free spins was found for the contrast and the still`);
	check(res.backDone, `${tag}: the round plays through and the game comes back to rest in ${SC.day} (${Math.round(seen.ms / 1000)} s)`, { final: seen.final, phases: seen.phasesList });
	const base = [...(seen.phasesList['base spin'] ?? []), ...(seen.phasesList['base after'] ?? [])];
	check(base.length > 0 && base.every((v) => v === `${SC.day}/${SC.day}`), `${tag}: the base spin before the trigger and the base game after the swap back are in ${SC.day} (${[...new Set(base)].join(', ')})`, seen.phasesList);
	const fs = seen.phasesList['free spins'] ?? [];
	check(fs.length > 0 && !seen.wrongInBonus, `${tag}: every free spin on the road is in ${night}, the Pixi scene and the DOM side (${fs.join(', ')})`, seen.wrongInBonus);
	const fi = seen.fadeIn;
	check(!!fi && fi.to === night && (fi.card === 'fs' || fi.card === 'sfs') && fi.show && fi.show.t >= fi.show.seatedAt, `${tag}: the swap in starts behind the entry scene, its back board seated (card ${fi?.card}, ${fi?.show?.t} ms into it, seated at ${fi?.show?.seatedAt})`, fi);
	const fb = seen.fadeBack;
	check(!!fb && fb.card === null && fb.gameType === 'basegame', `${tag}: the swap back starts after the Total Win is dismissed (card ${fb?.card}, ${fb?.gameType})`, fb);
	check(seen.maxScenes <= LIMIT.scenes && !seen.scenesBad, `${tag}: never more than ${LIMIT.scenes} scenes' pieces on the GPU (most ${seen.maxScenes})`, seen.scenesBad);
	check(seen.maxLazy <= LIMIT.lazyMB, `${tag}: the night pieces on the GPU at most ${seen.maxLazy} MB (limit ${LIMIT.lazyMB})`);
	check(!!seen.unloadedAt && seen.unloadedAt - seen.endAt <= LIMIT.unloadMs, `${tag}: after the swap back the night pieces are let go (${seen.unloadedAt ? seen.unloadedAt - seen.endAt : 'never'} ms after the fade's end)`);
	const log = seen.final.log;
	const L = (w) => logTimes(log, w).map((l) => `${l.what} ${l.detail ?? ''}`.trim());
	info(`${tag}: GPU scene ${seen.maxScene} MB at most (night ${seen.maxLazy}), all textures ${seen.maxGpu} MB at most, ${seen.final.gpuMB} MB after; swap log: ${[...L('loaded'), ...L('upload')].join('; ')}`);
	return seen;
}

/** the round with each held fade stepped as it appears */
async function bonusRoundWithSteps(p, S, fixture, night, { contrastToo = true, stillToo = true } = {}) {
	const tag = `${S.name} ${fixture}`;
	await R(p, () => {
		window.__reindeer.turbo(2);
		window.__reindeer.sceneSwapHold(true);
	});
	await R(p, (n) => window.__reindeer.fixtures.next(n), fixture);
	const t0 = Date.now();
	const pressAt = Date.now();
	await p.click('.hudp button.spin');
	const seen = { pressAt, phases: {}, maxLazy: 0, maxScene: 0, maxGpu: 0, maxScenes: 0, scenesBad: null, fadeIn: null, fadeBack: null, contrast: null, endAt: null, unloadedAt: null, wrongInBonus: null, frames: null, steps: [] };
	let stepped = 0;
	let backDone = false;
	let armed = false;
	while (Date.now() - t0 < 300000) {
		const s = await swapNow(p);
		// every bonus round starts at regular speed since the stock rules (game/bonusStockRules.ts, 2026-11-18): the
		// probe's turbo 2 is put back in the round, as a player's Turbo press there would
		if (s.gameType === 'freegame') await R(p, () => window.__reindeer.turbo(2)).catch(() => {});
		seen.maxLazy = Math.max(seen.maxLazy, s.lazyGpuMB);
		seen.maxScene = Math.max(seen.maxScene, s.sceneGpuMB);
		seen.maxGpu = Math.max(seen.maxGpu, s.gpuMB);
		seen.maxScenes = Math.max(seen.maxScenes, s.scenesOnGpu.length);
		if (s.scenesOnGpu.length > LIMIT.scenes && !seen.scenesBad) seen.scenesBad = s.scenesOnGpu;
		const phase = s.gameType === 'freegame' ? (s.card ? `card:${s.card}` : 'free spins') : s.card ? `card:${s.card}` : stepped === 0 ? 'base spin' : stepped === 2 && !s.fade ? 'base after' : 'swapping back';
		(seen.phases[phase] ??= new Set()).add(`${s.shown}/${s.dom}`);
		if (s.gameType === 'freegame' && !s.card && !s.fade && stepped >= 1 && (s.shown !== night || s.dom !== night) && !seen.wrongInBonus) seen.wrongInBonus = { shown: s.shown, dom: s.dom };
		if (s.fade && stepped === 0) {
			seen.fadeIn = { to: s.fade.to, card: s.card, show: s.show, at: Date.now() - t0 };
			// the longest frame from the load's end through the upload to the fade's start (the upload is not held)
			const fadeAt = logTimes(s.log, 'fade').pop()?.at ?? 0;
			const loadedAt = logTimes(s.log, 'loaded').pop()?.at ?? fadeAt - 500;
			seen.frames = await frameStats(p, loadedAt, fadeAt + 50);
			seen.steps.push(await stepFade(p, S, `${tag}: swap in to ${night}`));
			stepped = 1;
			continue;
		}
		if (s.fade && stepped === 1 && s.fade.to === SC.day) {
			seen.fadeBack = { card: s.card, show: s.show, gameType: s.gameType, at: Date.now() - t0 };
			seen.steps.push(await stepFade(p, S, `${tag}: swap back to ${SC.day}`));
			stepped = 2;
			continue;
		}
		if (contrastToo && !seen.contrast && stepped === 1 && !armed && s.gameType === 'freegame') {
			armed = true;
			await armQuiet(p, night);
		}
		if (armed && !seen.contrast && (await R(p, () => !!window.__swapQuiet))) {
			if (stillToo) await still(p, S, night, { frozen: true });
			seen.contrast = await contrast(p, S, night, { frozen: true, turbo: 2 });
			await freeze(p, false);
			continue;
		}
		if (stepped === 2 && !seen.endAt && !s.fade) seen.endAt = Date.now();
		if (seen.endAt && !seen.unloadedAt && s.lazyGpuMB === 0 && !s.lazyKeys.length) seen.unloadedAt = Date.now();
		if (stepped === 2 && s.idle && s.rest && !s.card && s.gameType === 'basegame' && seen.unloadedAt) {
			backDone = true;
			break;
		}
		await sleep(60);
	}
	await R(p, () => window.__reindeer.sceneSwapHold(false));
	seen.ms = Date.now() - t0;
	seen.final = await swapNow(p);
	seen.phasesList = Object.fromEntries(Object.entries(seen.phases).map(([k, v]) => [k, [...v]]));
	return { seen, backDone, stepped };
}

/** a round left open inside a bonus: the page reloads and resumes it; it must come up in its night and end in the day */
async function resumed(browser, S, fixture, event, night) {
	const tag = `${S.name} resume ${fixture} at event ${event}`;
	const b = await boot(browser, S);
	const { p } = b;
	await R(p, ({ n, e }) => window.__reindeer.fixtures.resume(n, e), { n: fixture, e: event }).catch(() => {});
	await sleep(1500);
	await p.waitForLoadState('domcontentloaded').catch(() => {});
	// up: the dev hook there and the press screen pressed (the resumed round is busy, so not "at rest")
	for (let i = 0; i < 200; i++) {
		const up = await p.evaluate(() => !!(window.__reindeer?.sceneSwap && window.__reindeer.hud && !document.querySelector('.landing') && !window.__reindeer.led?.())).catch(() => false);
		if (up) break;
		// (the resume card, 2026-11-18, ui/ResumeCard.svelte: Play Round in place of the press screen's press)
		if (i % 2 === 1) await p.evaluate(() => document.querySelector('[data-resume-card] [data-resume="play"]')?.click()).catch(() => {});
		await sleep(600);
	}
	const r = b;
	const t0 = Date.now();
	let first = null;
	let nightAt = null;
	let backAt = null;
	while (Date.now() - t0 < 240000) {
		const s = await swapNow(p).catch(() => null);
		if (!s) {
			await sleep(200);
			continue;
		}
		if (!first) first = s;
		if (!nightAt && s.shown === night && s.dom === night && !s.fade) nightAt = Date.now() - t0;
		if (nightAt && s.shown === SC.day && !s.fade && s.gameType === 'basegame' && s.idle && s.rest && !s.card) {
			backAt = Date.now() - t0;
			break;
		}
		if (!nightAt && Date.now() - t0 > 30000) break;
		await R(p, () => window.__reindeer.turbo(2)).catch(() => {});
		await sleep(150);
	}
	check(!!nightAt && !!first && first.want === night && (first.shown === night || first.fade?.to === night || first.starting === night), `${tag}: the resumed round comes up in ${night}: asked for before the press screen ended, ${first?.shown === night ? 'already showing' : 'on its way in'} when the game was up (fully in ${nightAt} ms after)`, first);
	check(!!backAt, `${tag}: and ${SC.day} comes back when it ends (${backAt} ms)`);
	check(r.errs.length === 0, `${tag}: no page errors`, r.errs);
	await b.ctx.close();
}


// ---- THE SCENE SETTING (dark mode) -------------------------------------------------------------------------------------
const waitFor = async (p, fn, ms, arg) => {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) {
		if (await p.evaluate(fn, arg).catch(() => false)) return Date.now() - t0;
		await sleep(150);
	}
	return null;
};
/** the switch under `root` as drawn: its words, the choice checked, each key's box, on screen and uncovered at its middle */
const switchState = (p, root) =>
	R(
		p,
		(root) => {
			const el = document.querySelector(`${root} [data-scene-switch]`);
			if (!el) return null;
			const word = el.querySelector('.vt')?.textContent?.trim() ?? '';
			const keys = [...el.querySelectorAll('[data-scene-choice]')].map((b) => {
				const r = b.getBoundingClientRect();
				const x = r.x + r.width / 2;
				const y = r.y + r.height / 2;
				const top = document.elementFromPoint(x, y);
				return {
					id: b.dataset.sceneChoice,
					text: (b.textContent || '').trim(),
					checked: b.getAttribute('aria-checked') === 'true',
					box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
					onScreen: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
					uncovered: !!top && (top === b || b.contains(top)),
					// (the glass dock's panel is .mp, the sign bar's green pop-out .sgmp, ui/sign/SignMenuPanel.svelte, 2026-11-23)
					opacity: Number(getComputedStyle(el.closest('.mp, .sgmp') ?? el).opacity),
				};
			});
			return { word, labels: [word, ...keys.map((k) => k.text)], checked: keys.find((k) => k.checked)?.id ?? null, keys };
		},
		root,
	);
const reach = (sw, tag) => {
	check(!!sw && sw.labels.join('|') === 'Scene|Auto|Snow|Dark', `${tag}: the switch reads ${sw?.labels.join(', ')}`, sw);
	const bad = (sw?.keys ?? []).filter((k) => !k.onScreen || !k.uncovered || k.box.w < 20 || k.box.h < 16 || k.opacity < 0.95);
	check(!!sw && sw.keys.length === 3 && bad.length === 0, `${tag}: its three keys are on screen, uncovered and at least 20 x 16 CSS px (${(sw?.keys ?? []).map((k) => `${k.id} ${k.box.w}x${k.box.h}`).join(', ')})`, bad);
};
/** a press on a key, then the scene watched until it shows `target` whole (and the old set is let go) */
async function pressAndWatch(p, sel, target) {
	const t0 = Date.now();
	const was = (await swapNow(p)).shown;
	await p.click(sel);
	let maxScenes = 0;
	let s = null;
	let inAt = null;
	let startAt = was === target ? 0 : null;
	while (Date.now() - t0 < 12000) {
		s = await swapNow(p);
		maxScenes = Math.max(maxScenes, s.scenesOnGpu.length);
		if (startAt === null && (s.fade || s.shown !== was)) startAt = Date.now() - t0;
		// (whole: the target drawn and settled in its own set, nothing more asked: presses in a row end on the last one)
		if (!inAt && s.shown === target && s.dom === target && !s.fade && s.want === target && s.set === (target.startsWith('grass') ? 'grass' : 'snow')) inAt = Date.now() - t0;
		if (inAt && Date.now() - t0 > inAt + 800) break;
		await sleep(100);
	}
	const set = target.startsWith('grass') ? 'grass' : 'snow';
	const left = s.loadedPresets.filter((n) => !n.startsWith(set));
	return { inAt, startAt, maxScenes, final: s, left, gpu: { scene: s.sceneGpuMB, all: s.gpuMB } };
}
const storeNow = (p) => R(p, (k) => { try { return localStorage.getItem(k); } catch { return 'no storage'; } }, STORE);
const setWatch = (tag, r, target) => {
	check(r.inAt !== null, `${tag}: the scene cross-fades to ${target} (whole ${r.inAt} ms after the press)`, r.final);
	check(r.maxScenes <= LIMIT.scenes, `${tag}: never more than ${LIMIT.scenes} scenes on the GPU on the way (most ${r.maxScenes})`);
	check(r.left.length === 0, `${tag}: the other set is let go (still held: ${r.left.join(', ') || 'nothing'}; scene ${r.gpu.scene} MB on the GPU)`, r.final);
};

async function settingChecks(browser, S, report) {
	const tag = `${S.name} setting`;
	const rep = ((report[S.name] ??= {}).setting = {});
	// A FRESH PROFILE: Snow, nothing of the grass set
	const b = await boot(browser, S, { choice: null, press: false });
	const { p } = b;
	await waitFor(p, () => !!(document.querySelector('.landing [data-scene-switch]') && window.__reindeer?.sceneSwap && window.__reindeer.led?.()), 90000);
	await sleep(2500);
	let s = await swapNow(p);
	let sw = await switchState(p, '.landing');
	check(s.choice === 'snow' && s.set === 'snow' && s.shown === 'snowDay' && sw?.checked === 'snow', `${tag}: a fresh profile comes up in Snow (choice ${s.choice}, set ${s.set}, ${s.shown}; the press screen's switch shows ${sw?.checked})`, { s, sw });
	// (the grass set's base scene is fetched into the cache in the background: those requests only, after the preload)
	await waitFor(p, () => { const x = window.__reindeer.scenePrefetch(); return x.files.length > 0 && x.files.every((f) => f.ok !== null); }, 30000);
	const pre = await prefetchOnly(p, b.files.filter((f) => GRASS_FILES.test(f.url)));
	check(pre.ok, `${tag}: on a fresh profile the grass set is asked for only by the background prefetch, after the preload and the audio (${pre.pf.files.length} files, ${Math.round(pre.pf.files.reduce((n, f) => n + (f.bytes || 0), 0) / 1024)} KB, started ${Math.round(pre.pf.startedAt)} ms: ${pre.pf.why})`, { stray: pre.stray, pf: pre.pf });
	check(s.loadedPresets.every((n) => n === 'snowDay') && s.scenesOnGpu.length <= 1, `${tag}: and none of it is decoded or on the GPU (held: ${s.loadedPresets})`, s);
	rep.freshGpu = { scene: s.sceneGpuMB, all: s.gpuMB };
	// THE PRESS SCREEN'S SWITCH
	reach(sw, `${tag} press screen`);
	let r = await pressAndWatch(p, '.landing [data-scene-choice="dark"]', 'grassDay');
	setWatch(`${tag} press screen Dark`, r, 'grassDay');
	{
		const L = r.final.log ?? [];
		const ask = [...L].reverse().find((l) => l.what === 'load' && /^grassDay/.test(l.detail ?? ''));
		const got = [...L].reverse().find((l) => l.what === 'loaded' && /^grassDay/.test(l.detail ?? ''));
		const up = [...L].reverse().find((l) => l.what === 'upload' && /^grassDay/.test(l.detail ?? ''));
		const cache = await R(p, () => window.__reindeer.scenePrefetch().files.map((f) => {
			const E = performance.getEntriesByName(new URL(f.url, location.href).href);
			const last = E[E.length - 1];
			return { url: f.url.split('/').pop(), n: E.length, transfer: last?.transferSize ?? null, body: last?.encodedBodySize ?? null };
		}));
		const fromCache = cache.every((c) => c.n >= 2 && c.transfer !== null && c.body !== null && c.transfer < c.body);
		check(!!ask && !!got && got.at - ask.at <= WARM_LOAD_MS && fromCache, `${tag} press screen Dark, the grass set already in the cache: its pieces came from the cache (no body over the network) and were in ${ask && got ? Math.round(got.at - ask.at) : '?'} ms after the swap asked (at most ${WARM_LOAD_MS})`, { cache, ask, got });
		info(`${tag} press screen Dark (warm cache): the press to the fade's first frame ${r.startAt} ms (load ${ask && got ? Math.round(got.at - ask.at) : '?'} ms, ${up?.detail ?? 'upload ?'}), grassDay whole at ${r.inAt} ms`);
	}
	rep.pressDark = r.gpu;
	// EVERY CHOICE, IN ANY ORDER, ON THE PRESS SCREEN (no continue press): the drawn scene follows each one there
	const pressKey = async (c, target, what) => {
		const q = await pressAndWatch(p, `.landing [data-scene-choice="${c}"]`, target);
		const k = await switchState(p, '.landing');
		const still = await R(p, () => !!document.querySelector('.landing'));
		check(q.inAt !== null && q.startAt !== null && q.startAt <= 5000 && k?.checked === c && still, `${tag} press screen ${what}: the scene behind it is ${target} before any continue press (the swap began ${q.startAt} ms after the press, whole at ${q.inAt}; ${c} checked)`, { q: q.final, checked: k?.checked, still });
		setWatch(`${tag} press screen ${what}`, q, target);
		info(`${tag} press screen ${what}: swap began ${q.startAt} ms after the press, ${target} whole at ${q.inAt} ms`);
		return q;
	};
	await pressKey('snow', 'snowDay', 'Snow');
	await pressKey('auto', 'snowDay', 'Auto (a light device)');
	await pressKey('dark', 'grassDay', 'Dark again');
	// three presses in a row, no wait: the last one wins
	await p.click('.landing [data-scene-choice="snow"]');
	await p.click('.landing [data-scene-choice="dark"]');
	await pressKey('snow', 'snowDay', 'Snow, Dark, Snow pressed in a row');
	await pressKey('dark', 'grassDay', 'Dark once more');
	sw = await switchState(p, '.landing');
	check(sw?.checked === 'dark' && (await storeNow(p)) === 'dark' && (await R(p, () => !!document.querySelector('.landing'))), `${tag} press screen: Dark checked and stored, the press screen still up (the press on the switch is not the continue press)`, sw);
	if (CAP) writeFileSync(`${CAP}/${S.name}_switch_intro.png`, await p.screenshot());
	// IN THE GAME: it opens in the scene chosen on the press screen, with no second change
	await R(p, () => (window.__swapSeen = []));
	await R(p, () => {
		const tick = () => {
			const x = window.__reindeer.sceneSwap();
			window.__swapSeen.push({ shown: x.shown, fade: !!x.fade, landing: !!document.querySelector('.landing') });
			if (window.__swapSeen.length < 2000) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
	await enter(p, S);
	const seen = await R(p, () => window.__swapSeen);
	const opened = await swapNow(p);
	check(opened.shown === 'grassDay' && !opened.fade && seen.every((f) => f.shown === 'grassDay' && !f.fade), `${tag}: the game opens in grassDay, the scene chosen on the press screen, with no second change (${seen.length} frames from the continue press)`, { opened: opened.shown, changed: seen.find((f) => f.shown !== 'grassDay' || f.fade) });
	// IN THE GAME: the menu's switch
	await p.click('[data-hud="menu-key"]');
	await sleep(700);
	const MENU = '[role="dialog"][aria-label="Menu"].is-open';
	sw = await switchState(p, MENU);
	reach(sw, `${tag} menu`);
	check(sw?.checked === 'dark', `${tag} menu: Dark checked (${sw?.checked})`);
	if (CAP) writeFileSync(`${CAP}/${S.name}_switch_menu.png`, await p.screenshot());
	r = await pressAndWatch(p, `${MENU} [data-scene-choice="snow"]`, 'snowDay');
	setWatch(`${tag} menu Snow`, r, 'snowDay');
	rep.menuSnow = r.gpu;
	r = await pressAndWatch(p, `${MENU} [data-scene-choice="dark"]`, 'grassDay');
	setWatch(`${tag} menu Dark`, r, 'grassDay');
	rep.menuDark = r.gpu;
	await p.click('[data-hud="menu-key"]').catch(() => {});
	await sleep(400);
	// REMEMBERED ACROSS A RELOAD
	b.files.length = 0;
	await p.reload({ waitUntil: 'domcontentloaded' });
	await waitFor(p, () => !!(window.__reindeer?.sceneSwap && document.querySelector('.landing [data-scene-switch]')), 90000);
	await sleep(2500);
	s = await swapNow(p);
	sw = await switchState(p, '.landing');
	const snowAsked = b.files.filter((f) => SNOW_FILES.test(f.url));
	check(s.choice === 'dark' && s.set === 'grass' && s.shown === 'grassDay' && s.dom === 'grassDay' && sw?.checked === 'dark', `${tag}: Dark is remembered across a reload (choice ${s.choice}, ${s.shown}; the switch shows ${sw?.checked})`, s);
	await waitFor(p, () => { const x = window.__reindeer.scenePrefetch(); return x.files.length > 0 && x.files.every((f) => f.ok !== null); }, 30000);
	const preSnow = await prefetchOnly(p, snowAsked);
	check(preSnow.ok && s.loadedPresets.every((n) => n === 'grassDay'), `${tag}: the reload asks for the snow set only by the background prefetch (${snowAsked.length} requests, ${preSnow.stray.length} of them not the prefetch's; held: ${s.loadedPresets})`, { stray: preSnow.stray, why: preSnow.pf.why });
	rep.reloadGpu = { scene: s.sceneGpuMB, all: s.gpuMB };
	info(`${tag}: Dark boot before the first press: scene ${s.sceneGpuMB} MB on the GPU, all textures ${s.gpuMB} MB`);
	check(b.errs.length === 0, `${tag}: no page errors`, b.errs);
	await b.ctx.close();

	// AUTO follows the device's color scheme
	const a = await boot(browser, S, { choice: 'auto', scheme: 'dark' });
	s = await swapNow(a.p);
	check(s.choice === 'auto' && s.set === 'grass' && s.shown === 'grassDay', `${tag} Auto: a dark device comes up in the Dark set (${s.shown})`, s);
	await a.p.emulateMedia({ colorScheme: 'light' });
	let at = await waitFor(a.p, () => { const x = window.__reindeer.sceneSwap(); return x.shown === 'snowDay' && !x.fade; }, 12000);
	check(at !== null, `${tag} Auto: the device turned light at rest: the snow set cross-fades in (${at} ms)`, await swapNow(a.p));
	await a.p.emulateMedia({ colorScheme: 'dark' });
	at = await waitFor(a.p, () => { const x = window.__reindeer.sceneSwap(); return x.shown === 'grassDay' && !x.fade; }, 12000);
	check(at !== null, `${tag} Auto: and dark again: the Dark set comes back (${at} ms)`, await swapNow(a.p));
	// A CHANGE ASKED DURING A ROUND (desktop): it waits for the round's end, never in its entry or Total Win
	if (S.extra) {
		await R(a.p, () => window.__reindeer.turbo(2));
		await R(a.p, (n) => window.__reindeer.fixtures.next(n), 'natural_free_spins');
		await a.p.click('.hudp button.spin');
		const askAt = await waitFor(a.p, () => window.__reindeer.gameType() === 'freegame' || !!window.__reindeer.scoreboard()?.card, 60000);
		await R(a.p, () => window.__reindeer.sceneChoice('snow'));
		await a.p.emulateMedia({ colorScheme: 'light' });
		const t0 = Date.now();
		let early = null;
		let tookAt = null;
		let waits = new Set();
		let maxScenes = 0;
		while (Date.now() - t0 < 240000) {
			const x = await swapNow(a.p);
			const st = await R(a.p, () => window.__reindeer.sceneSetting());
			maxScenes = Math.max(maxScenes, x.scenesOnGpu.length);
			if (st.wait) waits.add(st.wait);
			const roundOn = x.gameType === 'freegame' || !!x.card || !!x.show || !x.idle;
			if (x.set === 'snow' && !tookAt) {
				tookAt = Date.now() - t0;
				if (roundOn) early = { gameType: x.gameType, card: x.card, show: x.show, idle: x.idle };
			}
			if (x.set === 'grass' && x.fade && x.fade.to.startsWith('snow')) early ??= { fadeToSnowInGrassSet: x.fade };
			if (tookAt && x.shown === 'snowDay' && !x.fade && x.idle) break;
			await R(a.p, () => window.__reindeer.turbo(2)).catch(() => {});
			await sleep(120);
		}
		check(askAt !== null && tookAt !== null && !early, `${tag}: Snow asked during a Free Spins round is taken up only after the round (${tookAt} ms after the ask; waited for: ${[...waits].join(', ')})`, early);
		const fin = await swapNow(a.p);
		check(fin.shown === 'snowDay' && maxScenes <= LIMIT.scenes && fin.loadedPresets.every((n) => n.startsWith('snow')), `${tag}: then the snow set shows and the Dark set is let go (most ${maxScenes} scenes on the GPU; held: ${fin.loadedPresets})`, fin);
	}
	check(a.errs.length === 0, `${tag} Auto: no page errors`, a.errs);
	await a.ctx.close();
}

// ---- THE TRANSITION (2026-11-19) -------------------------------------------------------------------------------------
/** the canvas as the scene alone shows it (everything frozen, the HTML hidden, nothing but the scene, the dim and the snow
 *  cover drawn) */
const sceneShot = async (p) => {
	await freeze(p, true);
	await hideDom(p, true);
	await R(p, () => window.__reindeer.sceneOnly(true));
	await R(p, () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
	await sleep(250);
	const png = PNG.sync.read(await p.screenshot());
	await R(p, () => window.__reindeer.sceneOnly(false));
	await hideDom(p, false);
	await freeze(p, false);
	return png;
};
/** each frame's squares against the frame's own point of the fade: the worst square (its offset, where) of all frames */
const unitFade = (frames) => {
	const A = frames[0].png;
	const B = frames[frames.length - 1].png;
	const W = A.width;
	const H = A.height;
	const C = TRANSITION.cell;
	const wc = Math.floor(W / C);
	const hc = Math.floor(H / C);
	const E = new Float32Array(W * H * 3);
	const EE = new Float32Array(W * H);
	for (let i = 0; i < W * H; i++) {
		let m = 0;
		let e2 = 0;
		for (let c = 0; c < 3; c++) {
			const e = B.data[i * 4 + c] - A.data[i * 4 + c];
			E[i * 3 + c] = e;
			e2 += e * e;
			m = Math.max(m, Math.abs(e));
		}
		EE[i] = m >= TRANSITION.minChange ? e2 : 0;
	}
	let worst = { off: 0, frame: 0, at: null, median: null };
	const perFrame = [];
	for (let k = 1; k < frames.length - 1; k++) {
		const F = frames[k].png.data;
		const sum = new Float64Array(wc * hc);
		const cnt = new Uint32Array(wc * hc);
		const all = [];
		for (let y = 0; y < hc * C; y++)
			for (let x = 0; x < wc * C; x++) {
				const i = y * W + x;
				if (!EE[i]) continue;
				let d = 0;
				for (let c = 0; c < 3; c++) d += (F[i * 4 + c] - A.data[i * 4 + c]) * E[i * 3 + c];
				const f = d / EE[i];
				const j = ((y / C) | 0) * wc + ((x / C) | 0);
				sum[j] += f;
				cnt[j] += 1;
				if ((x & 3) === 0 && (y & 3) === 0) all.push(f);
			}
		if (!all.length) continue;
		all.sort((a, b) => a - b);
		const med = all[all.length >> 1];
		let off = 0;
		let at = null;
		for (let j = 0; j < wc * hc; j++) {
			if (cnt[j] < 32) continue;
			const o = Math.abs(sum[j] / cnt[j] - med);
			if (o > off) {
				off = o;
				at = [(j % wc) * C, ((j / wc) | 0) * C];
			}
		}
		perFrame.push(r2(med));
		if (off > worst.off) worst = { off: Math.round(off * 1000) / 1000, frame: k, at, median: r2(med) };
	}
	return { worst, perFrame };
};
const pngDiff = (a, b, levels) => {
	let s = 0;
	let big = 0;
	const n = a.data.length / 4;
	for (let i = 0; i < a.data.length; i += 4) {
		let m = 0;
		for (let c = 0; c < 3; c++) {
			const d = Math.abs(a.data[i + c] - b.data[i + c]);
			s += d;
			m = Math.max(m, d);
		}
		if (m > levels) big += 1;
	}
	return { mean: r2(s / n / 3), share: Math.round((big / n) * 100000) / 100000 };
};
/** a swap to `choice` from the menu's switch, held at its start and stepped: its frames and the swap at its start */
async function steppedSwap(p, choice, target) {
	const MENU = '[role="dialog"][aria-label="Menu"].is-open';
	await R(p, () => window.__reindeer.sceneSwapHold(true));
	await p.click(`${MENU} [data-scene-choice="${choice}"]`);
	const t0 = Date.now();
	let f = null;
	while (!f && Date.now() - t0 < 10000) {
		await sleep(50);
		f = (await swapNow(p)).fade;
	}
	if (!f || f.to !== target) {
		await R(p, () => window.__reindeer.sceneSwapHold(false));
		return null;
	}
	await freeze(p, true);
	await hideDom(p, true);
	await R(p, () => window.__reindeer.sceneOnly(true));
	await sleep(300);
	const atStart = await R(p, () => window.__reindeer.sceneSwap());
	const frames = [{ t: 0, png: PNG.sync.read(await p.screenshot()) }];
	let missing = 0;
	for (let i = 0; i < 40 && f; i++) {
		f = await R(p, (ms) => window.__reindeer.sceneSwapStep(ms), TRANSITION.stepMs);
		await R(p, () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
		missing += (await R(p, () => window.__reindeer.sceneSprites())).missing;
		frames.push({ t: f ? f.t : null, png: PNG.sync.read(await p.screenshot()) });
	}
	await R(p, () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
	const after = await R(p, () => window.__reindeer.sceneSwap());
	await R(p, () => window.__reindeer.sceneOnly(false));
	await hideDom(p, false);
	await freeze(p, false);
	await R(p, () => window.__reindeer.sceneSwapHold(false));
	return { frames, atStart, after, missing };
}
/** a cold load of the set `choice` names: the game booted in it, its scene alone */
async function coldShot(browser, S, choice) {
	const c = await boot(browser, S, { choice });
	await sleep(800);
	const png = await sceneShot(c.p);
	const s = await swapNow(c.p);
	if (CAP) writeFileSync(`${CAP}/${S.name}_transition_cold_${choice}.png`, PNG.sync.write(png));
	await c.ctx.close();
	return { png, shown: s.shown };
}
async function transitionChecks(browser, S, report) {
	const tag = `${S.name} transition`;
	const rep = ((report[S.name] ??= {}).transition = {});
	const cold = { snow: await coldShot(browser, S, 'snow'), dark: await coldShot(browser, S, 'dark') };
	check(cold.snow.shown === 'snowDay' && cold.dark.shown === 'grassDay', `${tag}: the cold loads come up in snowDay and grassDay (${cold.snow.shown}, ${cold.dark.shown})`);
	const b = await boot(browser, S, { choice: 'snow' });
	const { p, errs } = b;
	// the other set in the browser's cache first, as after the press screen
	await waitFor(p, () => { const x = window.__reindeer.scenePrefetch(); return x.files.length > 0 && x.files.every((f) => f.ok !== null); }, 30000);
	await p.click('[data-hud="menu-key"]');
	await sleep(700);
	for (const [choice, target, from, coldOf] of [
		['dark', 'grassDay', 'snowDay', 'dark'],
		['snow', 'snowDay', 'grassDay', 'snow'],
	]) {
		const what = `${tag} ${from} to ${target}`;
		const r = await steppedSwap(p, choice, target);
		check(!!r, `${what}: the switch's ${choice} starts a fade to ${target}`);
		if (!r) continue;
		const fd = r.atStart.fade;
		check(!!fd && fd.ms >= TRANSITION.fadeMs[0] && fd.ms <= TRANSITION.fadeMs[1] && !fd.tail, `${what}: one fade of ${fd?.ms} ms (${TRANSITION.fadeMs.join(' to ')}), no tail`, fd);
		check(r.missing === 0, `${what}: every scene sprite shown has its texture on all ${r.frames.length} frames`, r.missing);
		const u = unitFade(r.frames);
		check(u.worst.off <= TRANSITION.tol, `${what}: every part of the scene at the same point of the fade on every one of ${r.frames.length} frames (${TRANSITION.cell} px squares at most ${u.worst.off} off the frame's own point, frame ${u.worst.frame} at ${JSON.stringify(u.worst.at)}, its median ${u.worst.median}; limit ${TRANSITION.tol})`, u.worst);
		info(`${what}: the frames' points of the fade ${u.perFrame.join(' ')}`);
		const end = r.frames[r.frames.length - 1].png;
		const d = pngDiff(end, cold[coldOf].png, TRANSITION.cold.coldLevels);
		check(d.mean <= TRANSITION.cold.mean && d.share <= TRANSITION.cold.share, `${what}: the last frame is a cold load of ${target} (mean ${d.mean} levels off, ${d.share} of the pixels more than ${TRANSITION.cold.coldLevels})`, d);
		const snapMB = fd?.snapMB ?? 0;
		check(r.after.snapLive === 0 && !r.after.fade, `${what}: the picture of the outgoing screen (${snapMB} MB on the GPU during the fade) is gone two frames after it (${r.after.snapLive} left)`, { snapLive: r.after.snapLive });
		rep[`${from}_${target}`] = { fadeMs: fd?.ms, snapMB, worst: u.worst, cold: d, points: u.perFrame };
		if (CAP) for (const k of [0, 2, 4, Math.floor(r.frames.length / 2), r.frames.length - 1]) if (r.frames[k]) writeFileSync(`${CAP}/${S.name}_transition_${from}_${target}_f${k}.png`, PNG.sync.write(r.frames[k].png));
		await sleep(600);
	}
	// FIVE PRESSES IN A ROW on the menu's switch: they end in the last one, whole, with nothing left over
	const MENU = '[role="dialog"][aria-label="Menu"].is-open';
	for (const c of ['dark', 'snow', 'dark', 'snow', 'dark']) {
		await p.click(`${MENU} [data-scene-choice="${c}"]`);
		await sleep(TRANSITION.rapidMs);
	}
	const t0 = Date.now();
	let s = null;
	while (Date.now() - t0 < 15000) {
		s = await swapNow(p);
		if (s.shown === 'grassDay' && s.want === 'grassDay' && s.set === 'grass' && !s.fade && !s.starting) break;
		await sleep(150);
	}
	await sleep(600);
	const st = await R(p, () => window.__reindeer.sceneSwap());
	check(st.shown === 'grassDay' && !st.fade && st.skins.join() === 'grassDay' && st.snapLive === 0, `${tag} five presses in a row: grassDay whole, one skin, no picture left (${st.shown}, skins ${st.skins}, ${st.snapLive} pictures)`, st);
	const fin = await sceneShot(p);
	if (CAP) writeFileSync(`${CAP}/${S.name}_transition_rapid_end.png`, PNG.sync.write(fin));
	const d = pngDiff(fin, cold.dark.png, TRANSITION.cold.coldLevels);
	check(d.mean <= TRANSITION.cold.mean && d.share <= TRANSITION.cold.share, `${tag} five presses in a row: the scene after them is a cold load of grassDay (mean ${d.mean} levels off, ${d.share} of the pixels more than ${TRANSITION.cold.coldLevels})`, d);
	info(`${tag}: the largest picture a fade held ${st.snapPeakMB} MB; scene ${st.sceneGpuMB} MB on the GPU after`);
	rep.rapid = { cold: d, snapPeakMB: st.snapPeakMB };
	await p.click('[data-hud="menu-key"]').catch(() => {});
	check(errs.length === 0, `${tag}: no page errors`, errs);
	await b.ctx.close();
}

const browser = await chromium.launch({ args: ['--mute-audio'] });
const report = {};
try {
	for (const S of SIZES) {
		console.log(`--- ${S.name} ${S.vp.width}x${S.vp.height}`);
		const rep = (report[S.name] = {});
		if (S.transitionOnly) {
			if (SEC('transition')) await transitionChecks(browser, S, report);
			continue;
		}
		if (SEC('rounds') || SEC('again')) {
			const b = await boot(browser, S);
			const { p, errs, net } = b;
			// THE FIRST LOAD
			const s0 = await swapNow(p);
			rep.before = { sceneGpuMB: s0.sceneGpuMB, gpuMB: s0.gpuMB };
			check(s0.shown === SC.day && s0.dom === SC.day && s0.skins.join() === SC.day, `${S.name}: the game comes up in ${SC.day} (${s0.shown}/${s0.dom}, skins ${s0.skins})`, s0);
			check(net.length === 0 && s0.loadedPresets.every((n) => n === SC.day), `${S.name}: no bonus scene piece is asked for or held before the first press (${net.length} requests; held: ${s0.loadedPresets})`, net);
			info(`${S.name}: before the first press: scene ${s0.sceneGpuMB} MB on the GPU, all textures ${s0.gpuMB} MB`);
			await still(p, S, SC.day);
			rep.contrastDay = await contrast(p, S, SC.day);
			// THE TWO ROUNDS
			for (const [fixture, night] of [
				['natural_free_spins', SC.bonus],
				['natural_super', SC.super],
			]) {
				const pressAt = Date.now();
				const seen = await roundChecks(p, S, fixture, night);
				const mine = night === SC.bonus ? SC.file.bonus : SC.file.super;
				const own = net.filter((n) => n.url.includes(mine));
				check(own.length > 0 && own.every((n) => n.at >= pressAt), `${S.name} ${fixture}: its night pieces were asked for only after this round's press (${own.length} requests)`, own.filter((n) => n.at < pressAt));
				rep[fixture] = { maxScene: seen.maxScene, maxLazy: seen.maxLazy, maxGpu: seen.maxGpu, after: seen.final.gpuMB, afterScene: seen.final.sceneGpuMB, frames: seen.frames, log: seen.final.log.slice(-12) };
				info(`${S.name} ${fixture}: frames from the load's end to the fade's start: ${JSON.stringify(seen.frames)}`);
			}
			// AGAIN (desktop): a second Free Spins round after its pieces were let go
			if (S.extra && SEC('again')) {
				const seen = await roundChecks(p, S, 'natural_free_spins', SC.bonus, { contrastToo: false, stillToo: false });
				rep.again = { maxScene: seen.maxScene, frames: seen.frames, log: seen.final.log.slice(-12) };
				const loads = logTimes(seen.final.log, 'loaded').map((l) => l.detail);
				info(`${S.name} second Free Spins round: ${loads.slice(-1)}; upload ${logTimes(seen.final.log, 'upload').slice(-2)[0]?.detail}; frames ${JSON.stringify(seen.frames)} (first round ${JSON.stringify(rep.natural_free_spins?.frames)})`);
			}
			const after = await swapNow(p);
			rep.after = { sceneGpuMB: after.sceneGpuMB, gpuMB: after.gpuMB };
			check(after.sceneGpuMB <= s0.sceneGpuMB + 0.01 && after.lazyGpuMB === 0, `${S.name}: after the bonus rounds the scene holds what it held before the first press (${after.sceneGpuMB} MB, was ${s0.sceneGpuMB})`, after);
			info(`${S.name}: GPU all textures: before ${s0.gpuMB} MB, after ${after.gpuMB} MB`);
			const preOther = await prefetchOnly(p, b.other);
			check(preOther.ok, `${S.name}: of the other set only the background prefetch's files asked for in the whole run (${b.other.length} requests, ${preOther.stray.length} not the prefetch's)`, preOther.stray);
			check(errs.length === 0, `${S.name}: no page errors`, errs);
			await b.ctx.close();
		}
		if (SEC('setting')) await settingChecks(browser, S, report);
		if (SEC('transition')) await transitionChecks(browser, S, report);
		if (S.extra && SEC('resume')) {
			await resumed(browser, S, 'natural_free_spins', 9, SC.bonus);
			await resumed(browser, S, 'natural_super', 8, SC.super);
		}
	}
} finally {
	await browser.close();
}
if (CAP) writeFileSync(`${CAP}/scene_swap_probe.json`, JSON.stringify(report, null, 1));
console.log(`\n${pass} pass, ${fail} fail`);
for (const f of fails) console.log(`  FAIL ${f}`);
process.exit(fail ? 1 : 0);
