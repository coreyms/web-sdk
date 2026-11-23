// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/ui/{hudTheme.ts,sign/signPanelLayout.ts,sign/signLayout.ts,sign/signZones.ts,sign/SignMenuPanel.svelte,AutoplayModal.svelte}; SIGN_PANEL, signPanelTokens, MENU_PANEL, menuPanelPlace, menuPanelHeight, menuClass, autoClass, AUTO
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
// Pass: every line PASS, "0 fail" and exit 0.
import { register } from 'node:module';
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
