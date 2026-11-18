// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{game/layoutSpec.ts,ui/hud/hudLayout.ts};
// WATCHES: ; __reindeer.atRest, __reindeer.boardLayout, __reindeer.scene, HUD_BED, PORTRAIT, ROAD, ROAD_LAYOUT.portrait, data-hud
// WATCHES: ; data-title-sign, .hudp, .landing
// THE PORTRAIT ROAD PROBE (Job 4, Corey 2026-11-15: "Move it down about half of that distance"): at each portrait size
// it measures, in CSS px, the road picture's top and bottom (from __reindeer.boardLayout()), the title sign's bottom,
// and the HUD's real top (the higher of the dark bed's top edge and the HUD's highest readout or key), then the snow
// above the road and the gap under it. Checks (unless BEFORE=1, which only measures): the gap under the road is midway
// between the centred place and HUD_CLEAR above the HUD (or the road stays where it was when there is no room), the
// board never meets the HUD or the title sign, and the reindeer's run band stays clear of the title.
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
	{ vp: { width: 440, height: 956 }, phone: true },
	{ vp: { width: 768, height: 1024 }, phone: false },
	{ vp: { width: 820, height: 1180 }, phone: false },
];
/** the HUD's dark bed (constants HUD_BED): portrait bottom 606 master units, hudPad 8 CSS px */
const BED = { bottom: 606, hudPad: 8 };
/** the gap kept when the road sits just above the HUD, master units (layoutSpec ROAD_LAYOUT.portrait.hudClear) */
const HUD_CLEAR = 24;

let pass = 0;
let fail = 0;
const check = (ok, msg, detail) => {
	if (ok) pass += 1;
	else fail += 1;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail) : ''}`);
};
const r1 = (v) => Math.round(v * 10) / 10;

(async () => {
	const browser = await chromium.launch();
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
			const m = await p.evaluate(() => {
				const L = window.__reindeer.boardLayout();
				const k = L.css.pitch / 250; // CSS px per road px
				const top = (sel) => document.querySelector(sel)?.getBoundingClientRect().top ?? Infinity;
				const hudEls = Math.min(top('.hudp [data-hud="win"]'), top('.hudp [data-hud="amount"]'), top('.hudp button.spin'), top('.hudp [data-hud="balance"]'));
				// the title: the billboard logo in the canvas since scene pass 9
				const lg = window.__reindeer.scene?.()?.logo?.css;
				const title = lg ? { bottom: lg.y + lg.height } : document.querySelector('[data-title-sign]')?.getBoundingClientRect();
				return { kind: L.kind, boardTop: L.css.y, boardBottom: L.css.y + L.css.height, picTop: L.css.y - 167 * k, picBottom: L.css.y + (1024 - 167) * k, hudEls, titleBottom: title ? title.bottom : null, vw: innerWidth, vh: innerHeight };
			});
			const scale = Math.min(m.vw / 412, m.vh / 760);
			const masterTop = (m.vh - 760 * scale) / 2;
			const extra = Math.max(0, (m.vh / scale - 760) / 2);
			const bedTop = Math.max(m.boardBottom, Math.min(masterTop + (BED.bottom + extra) * scale, m.hudEls - BED.hudPad));
			const bedFree = Math.min(masterTop + (BED.bottom + extra) * scale, m.hudEls - BED.hudPad);
			const hudTop = Math.min(bedFree, m.hudEls);
			const row = { size: name, kind: m.kind, picTop: r1(m.picTop), picBottom: r1(m.picBottom), boardBottom: r1(m.boardBottom), titleBottom: m.titleBottom === null ? null : r1(m.titleBottom), hudTop: r1(hudTop), bedTop: r1(bedTop), snowAbove: m.titleBottom === null ? null : r1(m.picTop - m.titleBottom), gapBelow: r1(hudTop - m.picBottom), hudClearCss: r1(HUD_CLEAR * scale) };
			rows.push(row);
			console.log(`  INFO ${name}: ${JSON.stringify(row)}`);
			if (!BEFORE) {
				check(m.boardBottom <= m.hudEls - 0.5, `${name}: the board's bottom (${r1(m.boardBottom)}) stays above the HUD's highest readout or key (${r1(m.hudEls)})`);
				check(m.titleBottom === null || m.boardTop - 167 * 0 > m.titleBottom, `${name}: the board stays under the title sign`);
				check(row.gapBelow >= row.hudClearCss - 1 || row.gapBelow < 0, `${name}: the road picture's bottom keeps at least ${row.hudClearCss} px over the HUD's top, or it was already over it and stayed put (gap ${row.gapBelow})`);
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
