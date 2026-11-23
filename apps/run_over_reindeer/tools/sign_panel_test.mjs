// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/ui/{FeatureMenu.svelte,fastLaneBox.ts,BetAdjuster.svelte}; flLay, flScale, FL_BOX, --fl-s, ::after
// WATCHES: apps/run_over_reindeer/src/{ui/LandingScreen.svelte,ui/DenomModal.svelte,ui/NoticeModal.svelte,ui/ReplayModal.svelte,ui/ResumeCard.svelte,components/SkipButton.svelte}; --pick-hit, rowH, hudFrame, SKIP_HUD.prompt, scenePickPlace, SCENE_PICK, signZones
// WATCHES: apps/run_over_reindeer/src/ui/{hudTheme.ts,sign/signPanelLayout.ts,sign/signLayout.ts,sign/signZones.ts,sign/SignMenuPanel.svelte,AutoplayModal.svelte}; SIGN_PANEL, signPanelTokens, MENU_PANEL, menuPanelPlace, menuPanelHeight, menuClass, autoClass, AUTO, autoGeometry, AUTO_SUB_MIN, lowInner, chipW, subLine
// THE SIGN PANELS' LAYOUT TEST (2026-11-23, wip/signmenus): node only, no browser. It runs the Menu pop-out's own place
// rule (src/ui/sign/signPanelLayout.ts) against the sign bar's own layout (src/ui/sign/signLayout.ts: where the Menu key
// stands in each window), and the Autoplay card's size class, over every window the game is checked at: Stake's seven
// player sizes, the real phone frames (440 x 742, 413 x 586, 832 x 376), the mock's four, the full screen sizes.
//   node --experimental-strip-types --no-warnings tools/sign_panel_test.mjs            (from apps/run_over_reindeer)
//   TABLE=1 node --experimental-strip-types --no-warnings tools/sign_panel_test.mjs    (prints every window)
// Checked, per window:
//   1. the pop-out is inside the window, 6 px or more from its top and bottom and 8 from its sides
//   2. its scale is the bar's, never under 1; where the window cannot hold it at 1 (Popout S with the operator's line
//      showing: 0.91) it is the largest the window holds, and an INFO line says so
//   3. nothing in it is drawn under 9 CSS px (its smallest type is 10 px at scale 1)
//   4. it does not cover the Menu key it belongs to
//   5. on a touch layout its press rows are 44 px in its own px (the pills, the sliders' rows, the mute keys)
//   6. at the mock's own four windows it stands where the mock drew it (over the key on the desktop, under it upright,
//      beside it sideways)
//   7. the Autoplay card's class: the mock's at its four windows (desk, short, portrait, wide); the wide card where a
//      desktop window is too short for the short card (1024 x 576)
//   8. the panels' color and line tokens (ui/hudTheme.ts signPanelTokens) are the approved mock's style A at its defaults
//  10. THE 44 PX PRESS RULE ON TOUCH (2026-11-23, the probe host measured the confirm card's keys at 40, 39 and 34 px at
//      320 x 568, 667 x 375 and 568 x 320): at every touch window (a phone or tablet layout; not Popout S, a mouse's mini
//      player), read from the components' own style blocks and worked out with their own scales:
//        the Fast Lane confirm card's Cancel and CONFIRM (ui/FeatureMenu.svelte, the card at ui/fastLaneBox.ts's scale):
//        each press area 44 CSS px tall or more, as wide as its key, the two apart by the row's gap, and no lower than
//        the card's own foot
//        the Autoplay card's START, close key, limit chips, STOP OPTIONS row and the stepper's keys (ui/AutoplayModal.svelte,
//        ui/BetAdjuster.svelte): 44 CSS px
//        the Menu pop-out's GAME INFO row, pills, mute keys and sliders' rows (signPanelLayout.ts MENU_PANEL at the
//        pop-out's scale): 44 CSS px
//  11. THE SAME RULE ON THE OTHER PANELS (2026-11-23, the probe host: the press screen's Scene pills pressed 59 x 30 at
//      440 x 742, the bet list's close key 30 x 30), at the same touch windows, each read from its own source:
//        the press screen's Scene pills (ui/LandingScreen.svelte, at the dock frame's scale, ui/hud/hudLayout.ts hudFrame)
//        the bet list's close key (44 x 44), its rows (44 px on every phone: 30 only on Popout S) and its columns (never
//        more than fit at 44 px each); its "more" tab takes no press (the list scrolls under the finger). The close
//        key's area is worked out with what lies over it: on a 320 px wide phone the 26 px key's area reaches 3 px into
//        the amounts' well, which took them (41 px tall, the probe host) until the key was raised over the well
//  12. THE PRESS SCREEN'S SCENE PANEL KEEPS CLEAR OF THE LED STRIP (2026-11-23, the probe host at 568 x 320: its right
//      edge lay over the strip's left end): at every window here the panel (signPanelLayout.ts scenePickPlace, at the dock
//      frame's scale) is inside the window, 4 CSS px or more from the strip (ui/sign/signZones.ts) wherever the strip
//      stands in its rows, and its pills still hold their words
//        the notice's key and the replay card's key (their own height rules, worked out for the window)
//        the resume card's two keys (the card at its own scale), the skip prompt's Yes and No, the Fast Lane's amount
//        keys and close key (the menu's own touch target rule)
//   9. THE AUTOPLAY CARD'S PRICE LINES (the small sizes fix, tools/fast_lane_probe.mjs ONLY=smallsizes asserts "every spin
//      count with its price line" in a browser): at that section's nine windows and the real phone frames, with the
//      card's own widths (signPanelLayout.ts autoGeometry) and the bundled Overpass's advances
//      (tools/amount_fit_metrics.json), each of the eight tiles keeps its line at the default amount (1.00) at 0.9 of
//      its size or more, "until stopped" on two lines where one does not fit; Popout S is the LOW card (two columns
//      1.25 : 1); START's words and amount fit the key at 9 px or more (8.5 in LOW)
// Pass: every line PASS, "0 fail" and exit 0.
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
// (the game's own formatter needs the shared state and two shared files: the stand-ins of tools/sign_layout_test.mjs)
const SDK = join(APP, '..', '..');
const LINGUI = pathToFileURL(join(APP, 'node_modules', '@lingui', 'core', 'dist', 'index.mjs')).href;
const STATE_URL =
	'data:text/javascript,' +
	encodeURIComponent(`import { i18n } from ${JSON.stringify(LINGUI)};
export const stateBet = { currency: 'USD', wageredBetAmount: 1 };
export const stateI18n = { i18n };
export const setLocale = (l) => { i18n.load(l, {}); i18n.activate(l); };`);
register(
	'data:text/javascript,' +
		encodeURIComponent(`export async function resolve(s, c, n) {
	if (s === 'state-shared') return { url: ${JSON.stringify(STATE_URL)}, shortCircuit: true };
	if (s === 'constants-shared/bet') return { url: ${JSON.stringify(pathToFileURL(join(SDK, 'packages', 'constants-shared', 'bet.ts')).href)}, shortCircuit: true };
	if (s === 'utils-shared/amount') return { url: ${JSON.stringify(pathToFileURL(join(SDK, 'packages', 'utils-shared', 'amount.ts')).href)}, shortCircuit: true };
	if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return n(s + '.ts', c);
	return n(s, c);
}`),
);
const L = await import(pathToFileURL(join(APP, 'src', 'ui', 'sign', 'signLayout.ts')).href);
const Z = await import(pathToFileURL(join(APP, 'src', 'ui', 'sign', 'signZones.ts')).href);
const P = await import(pathToFileURL(join(APP, 'src', 'ui', 'sign', 'signPanelLayout.ts')).href);

let fail = 0;
const line = (ok, what, detail = '') => {
	if (!ok) fail++;
	if (!ok || process.env.TABLE) console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${detail ? ': ' + detail : ''}`);
};
const r1 = (v) => Math.round(v * 10) / 10;
/** the layout a window gets (packages/utils-layout createLayout: its ratio and its short side) */
const kindOf = (w, h) => {
	const ratio = w / h;
	if (ratio < 1.3) return 'portrait';
	return Math.min(w, h) <= 480 ? 'phone' : 'landscape';
};
const WINDOWS = [
	// the mock's four
	[1920, 1080, 'over', 'desk'],
	[1200, 675, 'over', 'short'],
	[390, 844, 'under', 'portrait'],
	[844, 390, 'beside', 'wide'],
	// Stake's player sizes
	[1024, 576, 'over', 'wide'],
	[400, 225, 'beside', 'wide'],
	[800, 450, 'beside', 'wide'],
	[425, 812, 'under', 'portrait'],
	[375, 667, 'under', 'portrait'],
	[320, 568, 'under', 'portrait'],
	// a real phone's frames (2026-11-23)
	[440, 742, 'under', 'portrait'],
	[413, 586, 'under', 'portrait'],
	[832, 376, 'beside', 'wide'],
	// the rest of Corey's round 3 phone windows (2026-11-23, signLayout.ts PHONE_R3 and LAND_R3): the small iPhone
	// upright and sideways, the phablet upright and sideways (890 x 552: the desktop bar family, Menu at the left edge)
	[375, 530, 'under', 'portrait'],
	[626, 816, 'under', 'portrait'],
	[667, 311, 'beside', 'wide'],
	[890, 552, 'over', 'wide'],
	// the small sideways phones, the other working sizes, a tablet, full screens
	[568, 320, 'beside', 'wide'],
	[667, 375, 'beside', 'wide'],
	[932, 430, 'beside', 'wide'],
	[360, 640, 'under', 'portrait'],
	[390, 620, 'under', 'portrait'],
	[768, 1024, 'under', 'portrait'],
	[1280, 720, 'over', 'short'],
	[1366, 768, 'over', 'desk'],
	[1440, 900, 'over', 'desk'],
	[2560, 1080, 'over', 'desk'],
	[2560, 1440, 'over', 'desk'],
	[3440, 1440, 'over', 'desk'],
];
const M = P.MENU_PANEL;
let windows = 0;
for (const [vw, vh, where, auto] of WINDOWS) {
	const kind = kindOf(vw, vh);
	const zones = Z.signZones(kind, vw, vh, kind !== 'landscape');
	const g = L.signLayout({ kind, vw, vh, safe: { t: 0, r: 0, b: 0, l: 0 }, zones });
	const menu = g.box.menu;
	const tag = `${vw}x${vh} ${kind}`;
	for (const session of [false, true]) {
		for (const coarse of kind === 'landscape' ? [false, true] : [true]) {
			const cls = P.menuClass({ kind, vh, coarse });
			const p = P.menuPanelPlace({ menu, u: g.u, vw, vh, cls, session });
			const t = `${tag}${session ? ', operator line' : ''}${coarse && kind === 'landscape' ? ', touch screen' : ''}: the Menu pop-out (${cls}, ${p.where}, ${r1(p.x)}, ${r1(p.y)}, ${r1(p.w)} x ${r1(p.h)}, scale ${p.k.toFixed(3)})`;
			line(p.x >= M.edge.x - 0.01 && p.y >= M.edge.y - 0.01 && p.x + p.w <= vw - M.edge.x + 0.01 && p.y + p.h <= vh - M.edge.y + 0.01, `${t} is inside the window`);
			// (the one window here that cannot hold it at 1: Popout S with the operator's line, 0.91)
			const holds = Math.min((vh - 2 * M.edge.y) / p.H, (vw - 2 * M.edge.x) / M.w);
			line(Math.abs(p.k - Math.min(Math.max(1, g.u), holds)) < 1e-9, `${t} is at the bar's scale (${g.u.toFixed(3)}), never under 1 unless the window cannot hold it (it holds ${holds.toFixed(3)})`);
			if (p.k < 1) console.log(`INFO ${t} is under its own size: the window holds no more`);
			line(M.label * p.k >= 9, `${t}: its smallest type is ${r1(M.label * p.k)} CSS px`);
			const apart = p.x >= menu.x + menu.w - 0.01 || p.x + p.w <= menu.x + 0.01 || p.y >= menu.y + menu.h - 0.01 || p.y + p.h <= menu.y + 0.01;
			line(apart, `${t} leaves the Menu key (${r1(menu.x)}, ${r1(menu.y)}, ${r1(menu.w)} x ${r1(menu.h)}) uncovered`);
			if (cls === 'touch') line(M.touch.pill >= 44 && M.touch.slider >= 44 && M.touch.mute >= 44 && M.info >= 44, `${t}: 44 px press rows`);
			if (!session && !coarse) line(p.where === where, `${t} stands ${where} the Menu key`, `it stands ${p.where}`);
			if (!session && kind !== 'landscape') line(p.where === where, `${t} stands ${where} the Menu key`, `it stands ${p.where}`);
		}
	}
	const compact = kind !== 'landscape';
	const got = P.autoClass({ compact, portrait: kind === 'portrait', vh, coarse: false, drop: false });
	line(got === auto, `${tag}: the Autoplay card is the ${auto} card`, `it is ${got}`);
	windows++;
}
// the height model: the three size classes, with and without the operator's line
line(P.menuPanelHeight('mouse', false) === 231 && P.menuPanelHeight('touch', false) === 251 && P.menuPanelHeight('tight', false) === 213, `the pop-out's heights are the mock's (231 with a mouse, 251 on touch) and 213 on Popout S`, `${P.menuPanelHeight('mouse', false)}, ${P.menuPanelHeight('touch', false)}, ${P.menuPanelHeight('tight', false)}`);
// the Autoplay card's class with a touch screen and with the unload line (each makes the open short card taller)
line(P.autoClass({ compact: false, portrait: false, vh: 675, coarse: true }) === 'wide' && P.autoClass({ compact: false, portrait: false, vh: 720, coarse: true }) === 'short', 'a touch screen desktop window: the short card from 704 px tall, the wide card under it');
line(P.autoClass({ compact: false, portrait: false, vh: 675, drop: true }) === 'wide' && P.autoClass({ compact: false, portrait: false, vh: 768, drop: true }) === 'short', 'with the unload line showing: the short card from 702 px tall, the desk card from 792');
// THE 44 PX PRESS RULE ON TOUCH (10)
{
	const F = await import(pathToFileURL(join(APP, 'src', 'ui', 'fastLaneBox.ts')).href);
	const src = (f) => readFileSync(join(APP, 'src', f), 'utf8');
	const FM = src('ui/FeatureMenu.svelte');
	const AM = src('ui/AutoplayModal.svelte');
	const BA = src('ui/BetAdjuster.svelte');
	/** a number from a rule in a style block: the first `prop: Npx` after the selector text */
	const px = (text, selector, prop) => {
		const i = text.indexOf(selector);
		if (i < 0) return NaN;
		const m = text.slice(i, text.indexOf('}', i)).match(new RegExp(`[^-\\w]${prop}:\\s*([\\d.]+)px`));
		return m ? Number(m[1]) : NaN;
	};
	// the confirm card's keys, in the card's own px (touch layouts: .c-up and .c-side), its row's gap, its foot's padding
	const KEY = { ok: px(FM, '.card.c-up .ok,\n\t.card.c-side .ok {', 'height'), no: px(FM, '.card.c-up .no,\n\t.card.c-side .no {', 'height') };
	const GAP = px(FM, '.card .btns {', 'gap');
	const FOOT = Number((FM.match(/\.card\.c-up,\n\t\.card\.c-side \{\n\t\twidth: 340px;\n\t\tpadding: 16px 16px (\d+)px;/) ?? [])[1]);
	const HIT = Number((FM.match(/\.card \.ok::after,\n\t\.card \.no::after \{[^}]*width: 100%;[^}]*height: max\(100%, calc\((\d+)px \/ var\(--fl-s, 1\)\)\);/) ?? [])[1]);
	line(KEY.ok >= 44 && KEY.no >= 44 && GAP > 0 && FOOT > 0 && HIT === 44 && /class="card c-\{lay\}"[^>]*style:--fl-s=\{box\.s\}/.test(FM), `the confirm card's keys are ${KEY.no} and ${KEY.ok} px in the card's px, ${GAP} apart, over a ${FOOT} px foot; each has a press area 44 px over the card's scale tall and as wide as itself`, JSON.stringify({ KEY, GAP, FOOT, HIT }));
	// the Autoplay card's touch sizes
	const AUTO_T = { close: px(AM, '.touch .panel .x {', 'height'), closeW: px(AM, '.touch .panel .x {', 'width'), lim: px(AM, '.touch .panel .lim {', 'height'), fold: px(AM, '.touch .panel .fold-row {', 'min-height'), go: px(AM, '.touch .panel .go {', 'min-height'), step: px(BA, '.adj.touch :global(.sp-sk) {', 'height'), stepW: px(BA, '.adj.touch :global(.sp-sk) {', 'width') };
	line(Object.values(AUTO_T).every((v) => v >= 44), `the Autoplay card on touch: close key ${AUTO_T.closeW} x ${AUTO_T.close}, limit chips ${AUTO_T.lim}, STOP OPTIONS ${AUTO_T.fold}, START ${AUTO_T.go}, the stepper's keys ${AUTO_T.stepW} x ${AUTO_T.step} px`, JSON.stringify(AUTO_T));
	const TOUCH = [[390, 844], [440, 742], [413, 586], [425, 812], [375, 667], [360, 640], [390, 620], [320, 568], [768, 1024], [844, 390], [832, 376], [812, 375], [800, 450], [736, 414], [667, 375], [640, 360], [568, 320], [932, 430]];
	for (const [vw, vh] of TOUCH) {
		const kind = kindOf(vw, vh);
		const tag = `${vw}x${vh} touch`;
		// the confirm card (the upright layout's own squeeze, fitK, only makes the card smaller: the press area is 44 CSS px
		// at any scale, so it is worked out at the box's scale and at 0.8 of it)
		const lay = F.flLay(vw, vh);
		for (const k of [1, 0.8]) {
			const s = F.flScale(lay, vw, vh) * (lay === 'up' ? k : 1);
			const press = (h) => Math.max(h, HIT / s) * s;
			const drop = Math.max(0, (HIT / s - Math.min(KEY.ok, KEY.no)) / 2);
			line(lay !== 'desk' && press(KEY.ok) >= 43.99 && press(KEY.no) >= 43.99 && GAP * s > 0.5, `${tag}: the confirm card (${lay}, scale ${s.toFixed(3)}) draws its keys ${r1(KEY.no * s)} px tall; each press area is ${r1(press(KEY.no))} px tall, the two ${r1(GAP * s)} px apart`);
			line(drop <= FOOT + 0.01, `${tag}: the confirm keys' press areas stay inside the card (they reach ${r1(drop * s)} px under the keys, the foot is ${r1(FOOT * s)} px)`);
		}
		// the Autoplay card: the touch sizes apply (never the LOW card at a touch window)
		const cls = P.autoClass({ compact: true, portrait: kind === 'portrait', vh });
		const G = P.autoGeometry({ cls, vw, tiny: vh < 300 || vw < 360 });
		line(kind !== 'landscape' && !G.low, `${tag}: the Autoplay card is the ${cls} card with the 44 px touch sizes (not LOW)`);
		// the Menu pop-out
		const zones = Z.signZones(kind, vw, vh, true);
		const g = L.signLayout({ kind, vw, vh, safe: { t: 0, r: 0, b: 0, l: 0 }, zones });
		const mc = P.menuClass({ kind, vh, coarse: true });
		const mp = P.menuPanelPlace({ menu: g.box.menu, u: g.u, vw, vh, cls: mc, session: false });
		const C = M[mc];
		const pillW = ((M.w - 2 * (M.band + C.pad) - 2 * 7) / 3) * mp.k;
		line(mc === 'touch' && Math.min(M.info, C.pill, C.mute, C.slider) * mp.k >= 43.99 && pillW >= 44, `${tag}: the Menu pop-out's GAME INFO row (${r1(M.info * mp.k)}), pills (${r1(pillW)} x ${r1(C.pill * mp.k)}), mute keys (${r1(C.mute * mp.k)}) and sliders' rows (${r1(C.slider * mp.k)}) are 44 CSS px or more`);
	}
}
// THE SAME RULE ON THE OTHER PANELS (11)
{
	const F = await import(pathToFileURL(join(APP, 'src', 'ui', 'fastLaneBox.ts')).href);
	const H = await import(pathToFileURL(join(APP, 'src', 'ui', 'hud', 'hudLayout.ts')).href);
	const src = (f) => readFileSync(join(APP, 'src', f), 'utf8');
	const [LS, DM, NM, RM, RC, SK, FM, CN] = ['ui/LandingScreen.svelte', 'ui/DenomModal.svelte', 'ui/NoticeModal.svelte', 'ui/ReplayModal.svelte', 'ui/ResumeCard.svelte', 'components/SkipButton.svelte', 'ui/FeatureMenu.svelte', 'game/constants.ts'].map(src);
	const has = (text, re) => re.test(text);
	const num = (text, re) => Number((text.match(re) ?? [])[1]);
	// what each source says
	const PILL = { h: num(LS, /\.scene-pick :global\(\.sp-pill\) \{\n\t\theight: (\d+)px/), nar: num(LS, /\.scene-pick \.nar :global\(\.sp-pill\) \{\n\t\theight: (\d+)px/) };
	const pillRule = has(LS, /\.scene-pick :global\(\.sp-pill\)::after \{[^}]*width: 100%;[^}]*height: max\(100%, var\(--pick-hit, 44px\)\);/) && has(LS, /style:--pick-hit="\{44 \/ pickPlace\.u\}px"/);
	const closeRule = has(DM, /\n\t\.x::after \{[^}]*width: max\(100%, 44px\);[^}]*height: max\(100%, 44px\);/);
	// the close key's drawn size and the gap under its row, per size class; whether the key stands over the well
	const CLOSE = { key: { '': num(DM, /\n\t\.x \{\n\t\tflex: none;\n\t\twidth: (\d+)px/), tight: num(DM, /\.tight \.x \{\n\t\twidth: (\d+)px/), tiny: num(DM, /\.tiny \.x \{\n\t\twidth: (\d+)px/) }, gap: { '': num(DM, /\n\t\.panel \{[^}]*?\n\t\tgap: (\d+)px/), tight: num(DM, /\n\t\.tight \{\n\t\tgap: (\d+)px/), tiny: num(DM, /\n\t\.tiny \{\n\t\tgap: (\d+)px/) }, wellPad: num(DM, /\n\t\.block \{[^}]*?padding: (\d+)px/) };
	const closeOver = has(DM, /\n\t\.x \{\n\t\tz-index: 1;\n\t\}/);
	line(Object.values(CLOSE.key).every((v) => v > 0) && Object.values(CLOSE.gap).every((v) => v > 0) && CLOSE.wellPad > 0, `the bet list's close key is ${CLOSE.key['']} px (${CLOSE.key.tight} tight, ${CLOSE.key.tiny} tiny) over a ${CLOSE.gap['']} px gap (${CLOSE.gap.tight}, ${CLOSE.gap.tiny}); the well's padding is ${CLOSE.wellPad} px`, JSON.stringify(CLOSE));
	const rowRule = has(DM, /const rowH = \$derived\(vh < 300 \? 30 : 44\);/) && has(DM, /const most = vh < 300 \? 8 : Math\.max\(1, Math\.min\(8, Math\.floor\(\(usable \+ GAP\) \/ \(44 \+ GAP\)\)\)\);/);
	const moreInert = has(DM, /\.more \{[^}]*pointer-events: none;/);
	const noticeRule = has(NM, /\.ok \{[^}]*height: max\(30px, min\(46px, 14vmin\)\);/);
	const replayRule = has(RM, /\.go \{[^}]*min-height: max\(28px, min\(44px, 14vmin\)\);/);
	const RKEY = { go: num(RC, /\.card\.compact \.go \{\n\t\theight: (\d+)px/), no: num(RC, /\.card\.compact \.no \{\n\t\theight: (\d+)px/), goBig: num(RC, /\n\t\.go \{[^}]*?height: (\d+)px/), noBig: num(RC, /\n\t\.no \{[^}]*?height: (\d+)px/) };
	const resumeRule = has(RC, /\.go::after,\n\t\.no::after \{[^}]*width: 100%;[^}]*height: max\(100%, calc\(44px \/ var\(--s, 1\)\)\);/) && has(RC, /style:--s=\{s\}/);
	const SKIP_MIN = { w: num(CN, /button: \{ w: [\d.]+, h: [\d.]+, minW: (\d+), minH: \d+ \}/), h: num(CN, /button: \{ w: [\d.]+, h: [\d.]+, minW: \d+, minH: (\d+) \}/), gap: num(CN, /gap: \{ share: [\d.]+, min: (\d+) \}/) };
	const skipRule = has(SK, /\.yes::after,\n\t\.no::after \{[^}]*width: 100%;[^}]*height: max\(100%, 44px\);/);
	const STEP = num(FM, /\.up \.step,\n\t\.side \.step \{\n\t\twidth: (\d+)px/);
	const stepRule = has(FM, /\.step::after,\n\t\.lvl button::after,\n\t\.close::after \{[^}]*width: max\(100%, calc\(44px \/ var\(--fl-s, 1\)\)\);\n\t\theight: max\(100%, calc\(44px \/ var\(--fl-s, 1\)\)\);/);
	line(pillRule && PILL.h > 0 && PILL.nar > 0, `the press screen's Scene pills (${PILL.h} px, ${PILL.nar} on the narrow panel) each have a press area as wide as the pill and 44 px over the panel's scale tall`);
	line(closeRule && rowRule && moreInert, `the bet list: a 44 x 44 press area on its close key, 44 px rows and columns of 44 px or more off Popout S, a "more" tab that takes no press`, JSON.stringify({ closeRule, rowRule, moreInert }));
	line(noticeRule && replayRule, `the notice's key and the replay card's key keep their height rules (up to 46 and 44 px; 44 or more from a 315 px short side)`);
	line(resumeRule && RKEY.go >= 44 && RKEY.no >= 44, `the resume card's keys (${RKEY.no} and ${RKEY.go} px, ${RKEY.noBig} and ${RKEY.goBig} on the large card) have a press area 44 px over the card's scale tall`, JSON.stringify(RKEY));
	line(skipRule && SKIP_MIN.w >= 44 && SKIP_MIN.gap > 0, `the skip prompt's Yes and No (${SKIP_MIN.w} x ${SKIP_MIN.h} px at least, ${SKIP_MIN.gap} apart) have a press area as wide as the key and 44 px tall`, JSON.stringify(SKIP_MIN));
	line(stepRule && STEP > 0, `the Fast Lane's amount keys (${STEP} px in the menu's px) and close key have a press area 44 px over the menu's scale each way`);
	const TOUCH = [[390, 844], [440, 742], [413, 586], [425, 812], [375, 667], [360, 640], [390, 620], [320, 568], [768, 1024], [844, 390], [832, 376], [812, 375], [800, 450], [736, 414], [667, 375], [640, 360], [568, 320], [932, 430]];
	for (const [vw, vh] of TOUCH) {
		const kind = kindOf(vw, vh);
		const tag = `${vw}x${vh} touch`;
		const vmin = Math.min(vw, vh) / 100;
		// the press screen's Scene pills, at the dock frame's scale
		const hf = H.hudFrame({ kind, phone: Math.min(vw, vh) <= 480, vw, vh, safe: { t: 0, r: 0, b: 0, l: 0 } });
		const pill = hf.variant === 'tablet' || hf.variant === 'landscape' ? PILL.nar : PILL.h;
		line(pillRule && Math.max(pill, 44 / hf.u) * hf.u >= 43.99, `${tag}: the Scene pills are drawn ${r1(pill * hf.u)} px tall (the ${hf.variant} panel at ${hf.u.toFixed(3)}), pressed ${r1(Math.max(pill, 44 / hf.u) * hf.u)}`);
		// the notice and the replay card, by their own rules
		const notice = Math.max(30, Math.min(46, 14 * vmin));
		const replay = Math.max(28, Math.min(44, 14 * vmin));
		line(notice >= 44 && replay >= 44, `${tag}: the notice's key is ${r1(notice)} px tall, the replay card's ${r1(replay)}`);
		// the bet list: rows and the narrowest column it can choose (the card's own geometry: its margin, padding, well)
		const narrowCard = vw < 560;
		const tiny = vh < 300 || vw < 360;
		const tight = tiny || narrowCard || vh < 460;
		const usable = Math.min(880, vw - 2 * (narrowCard ? 8 : 14)) - 2 * (narrowCard ? 10 : 14) - 2 * ((tight ? 2 : 3) + 6) - 4;
		const most = Math.max(1, Math.min(8, Math.floor((usable + 6) / (44 + 6))));
		line(rowRule && (usable - 6 * (most - 1)) / most >= 44, `${tag}: the bet list's rows are 44 px tall and its columns ${r1((usable - 6 * (most - 1)) / most)} px wide or more (${most} at most)`);
		// its close key: the 44 px area reaches `under` px past the key; what of that lies in the well is the well's (a
		// later box) unless the key stands over it; it must stop short of the amounts (the well's padding and 1 px line)
		{
			const c = tiny ? 'tiny' : tight ? 'tight' : '';
			const under = Math.max(0, (44 - CLOSE.key[c]) / 2);
			const inWell = Math.max(0, under - CLOSE.gap[c]);
			const tall = Math.max(CLOSE.key[c], 44) - (closeOver ? 0 : inWell);
			line(closeRule && tall >= 44 && inWell <= CLOSE.wellPad, `${tag}: the bet list's close key (${CLOSE.key[c]} px drawn) presses 44 x ${r1(tall)} px; its area reaches ${r1(inWell)} px into the well, short of the amounts`);
		}
		// the resume card (compact under 560 wide or 420 tall), at its own scale, and at 0.8 of it (a tall card on a short window)
		const compact = vw < 560 || vh < 420;
		for (const k of [1, 0.8]) {
			const s = Math.min(1, (vw - 24) / (compact ? 340 : 470)) * k;
			const h = compact ? Math.min(RKEY.go, RKEY.no) : Math.min(RKEY.goBig, RKEY.noBig);
			line(Math.max(h, 44 / s) * s >= 43.99, `${tag}: the resume card's keys are drawn ${r1(h * s)} px tall (scale ${s.toFixed(3)}), pressed ${r1(Math.max(h, 44 / s) * s)}`);
		}
		// the skip prompt and the Fast Lane's amount keys
		const fl = F.flScale(F.flLay(vw, vh), vw, vh);
		line(skipRule && Math.max(SKIP_MIN.h, 44) >= 44 && F.flLay(vw, vh) !== 'desk' && Math.max(STEP, 44 / fl) * fl >= 43.99, `${tag}: the skip prompt's keys press 44 px tall or more; the Fast Lane's amount keys are drawn ${r1(STEP * fl)} px, pressed ${r1(Math.max(STEP, 44 / fl) * fl)}`);
	}
}
// THE PRESS SCREEN'S SCENE PANEL AND THE LED STRIP (12)
{
	const H = await import(pathToFileURL(join(APP, 'src', 'ui', 'hud', 'hudLayout.ts')).href);
	const FMET = JSON.parse(readFileSync(join(APP, 'tools', 'amount_fit_metrics.json'), 'utf8'));
	const ADV = FMET.faces['Overpass|900'];
	const wordW = (t, px, trackEm) => [...t].reduce((em, ch) => em + (ADV[ch] ?? FMET.missing), 0) * px + trackEm * px * t.length;
	const WIN = [[568, 320], [640, 360], [667, 375], [736, 414], [740, 360], [780, 360], [800, 450], [812, 375], [832, 376], [844, 390], [932, 430], [400, 225], [1024, 576], [1200, 675], [1280, 720], [1366, 768], [1440, 900], [1920, 1080], [2560, 1080], [2560, 1440], [3440, 1440], [390, 844], [440, 742], [413, 586], [425, 812], [375, 667], [360, 640], [390, 620], [320, 568], [768, 1024], [800, 700]];
	for (const [vw, vh] of WIN) {
		const kind = kindOf(vw, vh);
		const phone = Math.min(vw, vh) <= 480;
		const f = H.hudFrame({ kind, phone, vw, vh, safe: { t: 0, r: 0, b: 0, l: 0 } });
		const strip = Z.signZones(kind, vw, vh, phone).strip;
		const p = P.scenePickPlace({ variant: f.variant, u: f.u, vw, vh, strip });
		const R = { x0: p.x, y0: p.y, x1: p.x + p.w * p.u, y1: p.y + p.h * p.u };
		const rows = R.y0 < strip.y + strip.h && R.y1 > strip.y;
		const tag = `${vw}x${vh} press screen: the Scene panel (${r1(R.x0)}..${r1(R.x1)} x ${r1(R.y0)}..${r1(R.y1)}, ${r1(p.w)} panel px wide at ${p.u.toFixed(3)})`;
		line(R.x0 >= 0 && R.y0 >= 0 && R.x1 <= vw && R.y1 <= vh, `${tag} is inside the window`);
		const gapX = strip.x >= R.x1 ? strip.x - R.x1 : R.x0 >= strip.x + strip.w ? R.x0 - strip.x - strip.w : -Math.min(R.x1 - strip.x, strip.x + strip.w - R.x0);
		line(!rows || gapX >= P.SCENE_PICK.clear - 0.01, `${tag} is ${rows ? `${r1(gapX)} px from the LED strip (from ${r1(strip.x)})` : 'in other rows than the LED strip'}`);
		// its pills: the panel less its side padding (14 px, 11 on the narrow panel) and two gaps (7, 5), in three
		const nar = p.cls === 'nar';
		const pill = (p.w - 2 * (nar ? 11 : 14) - 2 * (nar ? 5 : 7)) / 3;
		const word = wordW('SNOW', nar ? 10 : 11, 0.1);
		line(p.w >= P.SCENE_PICK.minW && word <= pill - 2 * 1.6, `${tag}: its pills are ${r1(pill)} panel px wide and hold SNOW (${r1(word)})`);
	}
}
// THE AUTOPLAY CARD'S PRICE LINES AND START (9): the card's own widths, the bundled face's advances (every digit a 0
// wide, as game/textFit.ts measures), the component's own rule (ui/AutoplayModal.svelte subLine, goFont)
{
	const FM = JSON.parse(readFileSync(join(APP, 'tools', 'amount_fit_metrics.json'), 'utf8'));
	const ADV = FM.faces['Overpass|900'];
	const width = (text, px, trackPx) => [...text].reduce((em, ch) => em + (ADV[/\d/.test(ch) ? '0' : ch] ?? FM.missing), 0) * px + trackPx * [...text].length;
	/** game/textFit.ts fitFont, shrink then hide */
	const fitFont = (text, nominal, box, trackEm, minScale = 0, floor = 0) => {
		const at = width(text, nominal, trackEm * nominal);
		if (at <= box) return nominal;
		const k = box / at;
		if (minScale > 0 && k < minScale) return null;
		return Math.max(floor, Math.floor(nominal * k * 10) / 10);
	};
	const money = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	const COUNTS = [10, 25, 50, 100, 250, 500, 1000, Infinity];
	// COPY OF tools/fast_lane_probe.mjs:SMALL (its windows), then a real phone's frames and the small sideways phones
	const SMALL = [[1200, 675], [1024, 576], [400, 225], [800, 450], [1920, 1080], [425, 812], [375, 667], [320, 568], [390, 620], [440, 742], [413, 586], [832, 376], [844, 390], [568, 320], [667, 375], [390, 844]];
	for (const [vw, vh] of SMALL) {
		const kind = kindOf(vw, vh);
		const cls = P.autoClass({ compact: kind !== 'landscape', portrait: kind === 'portrait', vh });
		const tiny = vh < 300 || vw < 360;
		const G = P.autoGeometry({ cls, vw, tiny });
		const tag = `${vw}x${vh} Autoplay (${G.low ? 'low' : cls}${G.narrow ? ', narrow' : ''}; tile text box ${r1(G.chipW)} px)`;
		const lines = COUNTS.map((c) => {
			const text = c === Infinity ? 'until stopped' : money(c);
			const one = fitFont(text, G.subNominal, G.chipW, 0.02, P.AUTO_SUB_MIN);
			if (one !== null || c !== Infinity) return { text, px: one, two: false };
			return { text, px: fitFont('stopped', G.subNominal, G.chipW, 0.02, P.AUTO_SUB_MIN), two: true };
		});
		const gone = lines.filter((l) => l.px === null).map((l) => l.text);
		line(gone.length === 0, `${tag}: every tile keeps its price line (${lines.map((l) => `${l.px}${l.two ? ' on two lines' : ''}`).join(', ')})`, `no room for ${gone.join(', ')}`);
		line(G.low === (vw === 400 && vh === 225), `${tag}: ${G.low ? 'the LOW card (two columns 1.25 : 1)' : 'not the LOW card'}`);
		// START: one line (words, dot, amount) at 13 px on touch and the wide card, 14 with a mouse; LOW: words over amount
		const worst = money(1000);
		if (G.stack) {
			// (words over amount: LOW 10.5 and 12 px, never under 8.5; the narrow card 12 and 13, never under 9)
			const inner = G.c2W - 6 - (G.low ? 16 : 32);
			const N = G.low ? [10.5, 12, 8.5] : [12, 13, 9];
			const words = fitFont('START 1000 AUTO SPINS', N[0], inner, 0.06, 0, N[2]);
			const amt = fitFont(worst, N[1], inner, 0.04, 0, N[2]);
			line(width('START 1000 AUTO SPINS', words, 0.06 * words) <= inner + 0.01 && width(worst, amt, 0.04 * amt) <= inner + 0.01, `${tag}: START's words (${words} px) over its amount (${amt} px) fit the key's ${r1(inner)} px`);
			line(G.low || (G.c2W - 2 * 6) / 3 >= 44, `${tag}: three limit chips to a row are ${r1((G.c2W - 12) / 3)} px wide`);
		} else {
			line((G.c2W - 5 * (kind === 'portrait' ? 5 : 6)) / 6 >= 43.5 || cls === 'desk' || cls === 'short', `${tag}: six limit chips to a row are ${r1((G.c2W - 5 * (kind === 'portrait' ? 5 : 6)) / 6)} px wide (44 on touch)`);
			const nominal = kind !== 'landscape' || cls === 'wide' ? 13 : 14;
			const box = G.c2W - 38 - 27;
			const text = `START 1000 AUTO SPINS${worst}`;
			const px = fitFont(text, nominal, box, 0.1, 0, 9);
			line(width(text, px, 0.1 * px) <= box + 0.01, `${tag}: START 1000 AUTO SPINS and ${worst} fit the key on one line at ${px} px (${r1(box)} px of room)`, `${r1(width(text, px, 0.1 * px))} px wide`);
		}
	}
}
// THE COLORS: the game works the panels' tokens out from the sign bar's own (ui/hudTheme.ts SIGN, SIGN_PANEL); here they
// are held against what the approved mock drew for style A at its defaults (its mock.js applyTheme, worked out by hand
// from field #0b7a43, border #f4f8fc, accent #fccd02, thickness 4, radius 14)
{
	const T = (await import(pathToFileURL(join(APP, 'src', 'ui', 'hudTheme.ts')).href)).signPanelTokens();
	const MOCK = {
		field: '#0b7a43', 'f-top': '#2b8b5b', 'f-bot': '#09693a', ink: '#ffffff', band: '#f4f8fc', bw: '4px', ko: '1.2px', 'ko-c': '#0d1a2e', ki: '0.88px', 'ki-c': '#0a0d12', rad: '14px',
		wrad: '9.8px', wl: '1.6px', well: 'rgba(0, 0, 0, 0.27)', hov: 'rgba(255, 255, 255, 0.12)', trk: 'rgba(0, 0, 0, 0.42)', 'ch-bg': '#f4f8fc', 'ch-ink': '#074c2a', 'ch-out': '#0a0d12',
		acc: '#fccd02', 'acc-top': '#fcd425', 'acc-bot': '#e8bd02', 'acc-deep': '#7e6701', 'acc-ink': '#14161a', krad: '11.2px', cbw: '5px', crad: '16px',
	};
	const off = Object.keys(MOCK).filter((k) => T[k] !== MOCK[k]).map((k) => `${k} ${T[k]} (the mock ${MOCK[k]})`);
	line(off.length === 0, `the panels' ${Object.keys(MOCK).length} tokens are the mock's style A at its defaults`, off.join('; '));
	line(P.MENU_PANEL.band === parseFloat(T.bw), "the pop-out's height counts the band at its token's width");
}
console.log(`${windows} windows, ${fail} fail`);
process.exit(fail ? 1 : 0);
