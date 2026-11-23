// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{game/layoutSpec.ts,ui/hud/hudLayout.ts};
// WATCHES: ; __reindeer.atRest, __reindeer.boardLayout, __reindeer.scene, HUD_BED, PORTRAIT, ROAD, ROAD_LAYOUT.portrait, data-hud
// WATCHES: ; roadPlacement, portraitHudTop, hudClear, boardDy
// WATCHES: ; data-title-sign, .hudp, .landing
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,game/scene/sceneLayers.ts,game/forestLineSpec.ts}; LOGO_SIGN.treeGapCss
// WATCHES: ; LOGO_SIGN.boardGapCss, forestLineY, forestBox, __reindeer.sceneWant, __reindeer.sceneSwap, logo.foot, logo.treeLine
// WATCHES: apps/run_over_reindeer/src/game/scene/sceneSwap.ts
// WATCHES: apps/run_over_reindeer/src/{ui/sign/signLayout.ts,game/scene/forestPlace.ts}; sceneFit, PHONE_R3, forestOn, __reindeer.sign.scene
// THE PORTRAIT ROAD PROBE (Job 4, Corey 2026-11-15: "Move it down about half of that distance"): at each portrait size
// it measures, in CSS px, the road picture's top and bottom (from __reindeer.boardLayout()), the title sign's bottom,
// and the HUD's real top (the higher of the dark bed's top edge and the HUD's highest readout or key), then the snow
// above the road and the gap under it. Checks (unless BEFORE=1, which only measures): the road picture's bottom is where
// the lowering rule puts it to 1 px (midway from the centred place's gap down to hudClear, measured to the HUD top the
// rule reads, ui/hud/hudLayout.ts portraitHudTop, read from the game's modules; or the centred place where that gap is
// hudClear or less; plus his board move), the board never meets the drawn HUD or the title sign, and the reindeer's run
// band stays clear of the title. (Since the sign bar replaced the glass dock, 791eba85, the rule's HUD top is the glass
// dock's row, under the sign bar's keys: the gap to the drawn bar is printed, not held to hudClear.)
// THE SIGN'S FOOT ON OPEN GROUND (2026-11-19, Corey: "on portrait mode the logo bottom is never in the trees"): on every
// upright phone size, in every scene preset (each draws the forest there), the sign's lowest visible pixel is at or under
// the drawn forest's tree line, and the sign did not fall short of it (the board's top in the way); its box stays over the
// board. Tablets draw no forest: nothing is asked there.
// HIS ROUND 3 PHONE LAYOUT (2026-11-23, ui/sign/signLayout.ts sceneFit, read through __reindeer.sign.scene): at his own
// phone windows Corey placed the sign himself (and moved the board and the tree line at 440 x 742), and a window near
// one of his takes a share of his box. Where his box has a share the sign's place is his, not the foot rule's: the foot
// and the tree line are printed there (for the eye), the box still stays over the board, and the rule's own check runs
// where his box has no share (390 x 844 and taller). His four upright windows are in the list (440x742, 413x586,
// 375x530; 626x816 as a tablet class window that now draws a tree line).
// With OUT=<dir> it saves captures at 390x844 and 390x620 (device pixel ratio 3) and gaps_<tag>.json.
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [OUT=<dir>] [TAG=after] [BEFORE=1] \
//     node tools/portrait_road_probe.mjs
// Uses the dev server that is already running. One headless browser. Take the shared browser lock around it.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const APP = process.env.APP || 'http://localhost:3014';
const OUT = process.env.OUT || '';
const TAG = process.env.TAG || 'after';
const BEFORE = process.env.BEFORE === '1';
if (OUT) mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SIZES = [
	{ vp: { width: 390, height: 844 }, phone: true, shot: true },
	{ vp: { width: 390, height: 620 }, phone: true, shot: true },
	{ vp: { width: 360, height: 640 }, phone: true },
	{ vp: { width: 390, height: 664 }, phone: true },
	// (an iPhone in Safari with its bars: Corey's staging shot, 2026-11-19)
	{ vp: { width: 390, height: 580 }, phone: true },
	{ vp: { width: 440, height: 956 }, phone: true },
	// his round 3 upright windows (2026-11-23); the phablet is not a phone by the device tier, and draws a tree line
	{ vp: { width: 440, height: 742 }, phone: true },
	{ vp: { width: 413, height: 586 }, phone: true },
	{ vp: { width: 375, height: 530 }, phone: true },
	{ vp: { width: 626, height: 816 }, phone: false, forest: true },
	{ vp: { width: 768, height: 1024 }, phone: false },
	{ vp: { width: 820, height: 1180 }, phone: false },
];
/** the HUD's dark bed (constants HUD_BED): portrait bottom 606 master units, hudPad 8 CSS px */
const BED = { bottom: 606, hudPad: 8 };

let pass = 0;
let fail = 0;
const check = (ok, msg, detail) => {
	if (ok) pass += 1;
	else fail += 1;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail) : ''}`);
};
const r1 = (v) => Math.round(v * 10) / 10;

(async () => {
	// (muted: a browser on Corey's Mac never plays sound)
	const browser = await chromium.launch({ args: ['--mute-audio'] });
	const rows = [];
	try {
		for (const S of SIZES) {
			const name = `${S.vp.width}x${S.vp.height}`;
			const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.shot ? 3 : 1, isMobile: true, hasTouch: true });
			const p = await ctx.newPage();
			const errs = [];
			p.on('pageerror', (e) => errs.push(e.message));
			await p.goto(`${APP}/?lang=en&sessionID=road${name}${Date.now()}${S.phone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
			for (let i = 0; i < 200; i++) {
				const ok = await p.evaluate(() => !!(window.__reindeer?.atRest?.() && document.querySelector('.hudp') && !document.querySelector('.landing'))).catch(() => false);
				if (ok) break;
				if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height * 0.3).catch(() => {});
				await sleep(600);
			}
			await sleep(1200);
			const m = await p.evaluate(async () => {
				// THE LOWERING RULE'S OWN NUMBERS (game/layoutSpec.ts roadPlacement, ROAD_LAYOUT.portrait; ui/hud/hudLayout.ts
				// portraitHudTop), read from the game's modules for this window
				const LS = await import('/src/game/layoutSpec.ts');
				const HL = await import('/src/ui/hud/hudLayout.ts');
				const vw = innerWidth;
				const vh = innerHeight;
				const PM = LS.MASTER.portrait;
				const fit = Math.min(vw / PM.width, vh / PM.height);
				const mTop = (vh - PM.height * fit) / 2;
				const c = LS.roadPlacement('portrait', { masterWidth: vw / fit, masterHeight: vh / fit, vw, vh }, true, true);
				const rule = { hud: HL.portraitHudTop(vw, vh), centredBottom: mTop + (c.y + c.height) * fit, hudClear: LS.ROAD_LAYOUT.portrait.hudClear * fit, lower: LS.ROAD_LAYOUT.portrait.lower, boardDy: window.__reindeer.sign?.scene?.()?.boardDy ?? 0 };
				const L = window.__reindeer.boardLayout();
				const k = L.css.pitch / 250; // CSS px per road px
				const top = (sel) => document.querySelector(sel)?.getBoundingClientRect().top ?? Infinity;
				const hudEls = Math.min(top('.hudp [data-hud="win"]'), top('.hudp [data-hud="amount"]'), top('.hudp button.spin'), top('.hudp [data-hud="balance"]'));
				// the title: the billboard logo in the canvas since scene pass 9
				const lg = window.__reindeer.scene?.()?.logo?.css;
				const title = lg ? { bottom: lg.y + lg.height } : document.querySelector('[data-title-sign]')?.getBoundingClientRect();
				return { kind: L.kind, boardTop: L.css.y, boardBottom: L.css.y + L.css.height, picTop: L.css.y - 167 * k, picBottom: L.css.y + (1024 - 167) * k, hudEls, titleBottom: title ? title.bottom : null, vw: innerWidth, vh: innerHeight, rule };
			});
			const scale = Math.min(m.vw / 412, m.vh / 760);
			const masterTop = (m.vh - 760 * scale) / 2;
			const extra = Math.max(0, (m.vh / scale - 760) / 2);
			const bedTop = Math.max(m.boardBottom, Math.min(masterTop + (BED.bottom + extra) * scale, m.hudEls - BED.hudPad));
			const bedFree = Math.min(masterTop + (BED.bottom + extra) * scale, m.hudEls - BED.hudPad);
			const hudTop = Math.min(bedFree, m.hudEls);
			const row = { size: name, kind: m.kind, picTop: r1(m.picTop), picBottom: r1(m.picBottom), boardBottom: r1(m.boardBottom), titleBottom: m.titleBottom === null ? null : r1(m.titleBottom), hudTop: r1(hudTop), bedTop: r1(bedTop), snowAbove: m.titleBottom === null ? null : r1(m.picTop - m.titleBottom), gapBelow: r1(hudTop - m.picBottom), hudClearCss: r1(m.rule.hudClear) };
			rows.push(row);
			console.log(`  INFO ${name}: ${JSON.stringify(row)}`);
			if (!BEFORE) {
				check(m.boardBottom <= m.hudEls - 0.5, `${name}: the board's bottom (${r1(m.boardBottom)}) stays above the HUD's highest readout or key (${r1(m.hudEls)})`);
				check(m.titleBottom === null || m.boardTop - 167 * 0 > m.titleBottom, `${name}: the board stays under the title sign`);
				// THE LOWERING, against the HUD top the rule reads (2026-11-23). Since 791eba85 the sign bar (ui/sign/SignHud.svelte)
				// is drawn in place of the glass dock, and the rule still measures the glass dock's row (hudLayout.ts portraitHudTop:
				// at 413x586 455.2, where the sign bar's keys stand about 10 px higher). The road's place from that rule is the
				// layout Corey approved on staging (his round 3 phone windows, 483b5850 and 44029535), so the drawn picture is held
				// to the rule exactly: its bottom where the centred place's gap to that HUD top comes midway (ROAD_LAYOUT.portrait
				// .lower) down to hudClear, or stays at the centred place where that gap is hudClear or less, plus his own move of
				// the board (sceneFit boardDy). The gap to the drawn bar's top (hudTop above) is printed: 14.9 at 390x580 and
				// 413x586, 9.9 at 375x530 on 29b36949, under hudClear there by design of that approved place.
				const R = m.rule;
				const cGap = R.hud - R.centredBottom;
				const want = R.centredBottom + Math.max(0, cGap - R.hudClear) * R.lower + R.boardDy;
				const ruleGap = R.hud - m.picBottom;
				check(Math.abs(m.picBottom - want) <= 1 && (cGap <= R.hudClear || ruleGap >= R.hudClear - 1), `${name}: the road picture's bottom (${r1(m.picBottom)}) is where the lowering rule puts it (${r1(want)}): the centred gap ${r1(cGap)} to the rule's HUD top ${r1(R.hud)} ${cGap > R.hudClear ? `comes down midway to ${r1(ruleGap)} (hudClear ${r1(R.hudClear)})` : `is hudClear (${r1(R.hudClear)}) or less: it stays put`}${R.boardDy ? `, his board move ${r1(R.boardDy)}` : ''}; to the drawn bar's top ${row.gapBelow}`, { picBottom: m.picBottom, want, rule: R });
			}
			const his = await p.evaluate(() => window.__reindeer.sign?.scene?.() ?? null);
			if (his && (his.share > 0 || his.boardDy || his.treeDy)) console.log(`  INFO ${name}: his round 3 scene here: the board ${r1(his.boardDy)} px down, the tree line ${r1(his.treeDy)} px down, his logo box's share ${r1(his.share * 100)} %`);
			if (!BEFORE && (S.phone || S.forest) && m.kind === 'portrait') {
				for (const preset of ['snowDay', 'snowNight', 'snowSuper', 'grassDay', 'grassNight', 'grassSuper']) {
					await p.evaluate((n) => window.__reindeer.sceneWant(n), preset);
					let lg = null;
					for (let i = 0; i < 80 && !lg; i++) {
						// the swap over: the preset shown and no fade running (since 595423c2, 2026-11-19, the fade is one picture of
						// the outgoing screen and the swap reports it, __reindeer.sceneSwap().fade; the scene layers keep no fade field)
						lg = await p.evaluate((n) => { const s = window.__reindeer.scene(); const w = window.__reindeer.sceneSwap(); return s.preset === n && w.shown === n && w.fade === null && s.layers.forest && s.logo ? s.logo : null; }, preset).catch(() => null);
						if (!lg) await sleep(250);
					}
					if (his && his.share > 0) {
						// (his own box, or a share of it: the foot against the tree line is printed, the box stays over the board)
						check(!!lg && lg.treeLine !== null && lg.css.y + lg.css.height < m.boardTop, `${name} ${preset}: the sign stands where Corey's round 3 layout puts it (his box's share ${r1(his.share * 100)} %): a tree line is drawn (${lg ? r1(lg.treeLine) : '?'}), the sign's foot at ${lg ? r1(lg.foot) : '?'} (${lg && lg.treeLine !== null ? `${r1(lg.foot - lg.treeLine)} px under the tree line` : '?'}), its box over the board`, lg);
						continue;
					}
					check(!!lg && lg.treeLine !== null && lg.foot >= lg.treeLine - 0.01 && lg.short < 0.01 && lg.css.y + lg.css.height < m.boardTop, `${name} ${preset}: the sign's foot (${lg ? r1(lg.foot) : '?'}) is on open ground, at or under the tree line (${lg ? r1(lg.treeLine) : '?'}); moved down ${lg ? r1(lg.drop) : '?'} road px; over the board`, lg && { foot: lg.foot, treeLine: lg.treeLine, drop: lg.drop, short: lg.short, bottom: lg.css.y + lg.css.height, boardTop: m.boardTop });
				}
			}
			check(errs.length === 0, `${name}: no page errors`, errs.slice(0, 3));
			if (OUT && S.shot) await p.screenshot({ path: join(OUT, `job4_${TAG}_${name}.png`) });
			await ctx.close();
		}
	} finally {
		await browser.close();
	}
	if (OUT) writeFileSync(join(OUT, `job4_gaps_${TAG}.json`), JSON.stringify(rows, null, 1));
	console.log(`\nportrait_road_probe: ${pass} pass, ${fail} fail`);
	process.exit(fail ? 1 : 0);
})();
