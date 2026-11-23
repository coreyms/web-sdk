// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/game/{roamGround.ts,roamPaths.ts,reindeerRoamSpec.ts,scene/forestPlace.ts,forestLineSpec.ts,layoutSpec.ts}; roamGround
// WATCHES: ; ROAM_AREAS, ROAM_TUNNELS, ROAM_ROAD, ROAM_TREE_PAD, REINDEER_ROAM, SHADOW, STRIKE.snow
// WATCHES: apps/run_over_reindeer/src/ui/sign/{signLayout.ts,signZones.ts}; PHONE_R3, sceneFit, forestOn, roam zone sign
// THE ROAMING REINDEER'S GROUND UNDER THE SIGN BAR: A NODE MODEL (2026-11-24), no browser.
//   node --experimental-strip-types --no-warnings tools/roam_ground_test.mjs            (from apps/run_over_reindeer)
// WHAT IT IS. A model of his keep-outs, not the game's own picker (game/road/roam.ts needs the canvas): at a window it
// lays out the scene and the sign bar with the game's own layout files (game/roamGround.ts, ui/sign/signLayout.ts,
// ui/sign/signZones.ts), takes his area (game/roamPaths.ts), his body's reach (game/reindeerRoamSpec.ts) and his
// shadow's lean (constants SHADOW), and walks a grid of his area: a spot is one he may STAND on when his feet are under
// the tree line and off the asphalt and his body and shadow are on the screen and off every key, the logo, the LED
// strip, the top line and the tunnel mouths (roam.ts clear). A spot has a LEVEL WAY IN when the same holds all the way
// from past his side's edge (roam.ts clearWay, a walk in). Not modelled: the stoplights, a way round a tunnel mouth by
// its corners (the desktop class comes in that way: nothing is asked of it here), the game's own widening of a small
// area. The browser proof is tools/roam_probe.mjs section `ground`.
// UNDER THE SIGN (Corey 2026-11-24: "Let him pass under the sign"). The Fast Lane and Menu signs are keep-outs of
// their own. He never stands under one. A walk IN may cross behind one, only where no way in is clear of every key
// (roam.ts pick: the second try). Held here:
//   1. 440x742 and 832x376 (measured on his phone): spots with a level way in clear of every key
//   2. 360x560, where the Fast Lane sign ALONE closes his side: no way in clear of every key, and ways in behind the
//      sign; Stake's phone sizes and the full screen ones: ways in clear of every key (the rule changes nothing there)
//   3. NO SPOT TO STAND ON IS UNDER A KEY OR A SIGN, at every window here (the stand rule is not loosened)
//   4. upright, every spot's feet are under the tree line and above the snow rim's foot (roamGround top and bottom)
//   5. THE OPEN POINT, held as it is so a change shows: at 413x586, 375x530 and 626x816 there are spots to stand on
//      and NO way in, with the signs passable too, and the one thing in the way is the right tunnel's mouth (a
//      keep-out since 2026-11-18): on these short pages the tree line stands lower than the mouth's top, so the only
//      way round the mouth is on the trees. (The builder's first reading, "the Fast Lane sign closes his side", named
//      the wrong cause for these three.) Corey rules on it; when he does, this section changes with the game.
// Pass: every line PASS, "0 fail" and exit 0.
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
// (the game's own constants need the shared state and two shared files: the stand-ins of tools/sign_layout_test.mjs)
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
const imp = (p) => import(pathToFileURL(join(APP, 'src', ...p.split('/'))).href);
const L = await imp('ui/sign/signLayout.ts');
const Z = await imp('ui/sign/signZones.ts');
const CONST = await imp('game/constants.ts');
const { REINDEER_ROAM } = await imp('game/reindeerRoamSpec.ts');
const RP = await imp('game/roamPaths.ts');
const RG = await imp('game/roamGround.ts');
const { FOREST_LINE } = await imp('game/forestLineSpec.ts');
const { ROAD_ART } = await imp('game/roadArtSpec.ts');

let fail = 0;
const line = (ok, msg, detail = '') => {
	if (!ok) fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${detail ? `: ${detail}` : ''}`);
};
const r0 = (v) => Math.round(v);
const r1 = (v) => Math.round(v * 10) / 10;

// ---- his body's reach and his shadow's lean (game/road/roam.ts ROAM_REACH, castReach), road px at scale 1 ----
const K = REINDEER_ROAM.roadPxPerFramePx;
const C = REINDEER_ROAM.clips;
const CLIPS = ['walk', 'start', 'stop', 'sniff'];
const clipBox = (c) => ({ width: C[c].frameW * K, height: C[c].frameH * K, anchorX: C[c].anchorX / C[c].frameW, anchorY: C[c].anchorY / C[c].frameH });
const CH = ['charge', 'chargeDown'].map((c) => C[c].reach);
const REACH = {
	side: Math.max(...CLIPS.map((c) => Math.max(clipBox(c).anchorX, 1 - clipBox(c).anchorX) * clipBox(c).width), ...CH.map((q) => Math.max(q.back, q.fwd) * K)),
	up: Math.max(...CLIPS.map((c) => clipBox(c).anchorY * clipBox(c).height), ...CH.map((q) => q.up * K)),
};
const FEET_SHARE = 0.06;
const lean = (() => {
	const a = (CONST.SHADOW.angle * Math.PI) / 180;
	return { x: -Math.sin(a) * CONST.SHADOW.length, y: -Math.cos(a) * CONST.SHADOW.length };
})();
const inPoly = (x, y, P) => {
	let c = false;
	for (let i = 0, j = P.length - 1; i < P.length; j = i++) if (P[i].y > y !== P[j].y > y && x < ((P[j].x - P[i].x) * (y - P[i].y)) / (P[j].y - P[i].y) + P[i].x) c = !c;
	return c;
};
/** a convex polygon against a box (separating axes) */
const polyBox = (P, x0, y0, x1, y1) => {
	const B = [
		{ x: x0, y: y0 },
		{ x: x1, y: y0 },
		{ x: x1, y: y1 },
		{ x: x0, y: y1 },
	];
	const axes = [
		{ x: 1, y: 0 },
		{ x: 0, y: 1 },
	];
	for (let i = 0; i < P.length; i++) {
		const a = P[i];
		const b = P[(i + 1) % P.length];
		axes.push({ x: -(b.y - a.y), y: b.x - a.x });
	}
	for (const ax of axes) {
		const pr = (Q) => Q.map((q) => q.x * ax.x + q.y * ax.y);
		const p = pr(P);
		const q = pr(B);
		if (Math.max(...p) < Math.min(...q) || Math.max(...q) < Math.min(...p)) return false;
	}
	return true;
};
const SIGNS = ['the Fast Lane sign', 'the Menu sign'];
const kindOf = (vw, vh) => (vw / vh < 1.25 ? 'portrait' : Math.min(vw, vh) <= 480 ? 'phone' : 'landscape');

const model = (vw, vh) => {
	const kind = kindOf(vw, vh);
	const phone = Math.min(vw, vh) <= 480;
	const G = RG.roamGround(kind, vw, vh, phone);
	const zs = Z.signZones(kind, vw, vh, phone);
	const g = L.signLayout({ kind, vw, vh, zones: zs });
	const seat = L.seatAmount(g, 4.198, (3.2 * Math.max(g.head.amt, 10 / g.u) + 12) * g.u, L.amountLimits(g, zs));
	const css = { 'the Spin': g.box.play, Auto: g.box.auto, Turbo: g.box.turbo, 'the Menu sign': g.box.menu, 'the Fast Lane sign': g.box.bonus, Balance: g.box.bal, 'the amount': seat.amt, '<': seat.down, '>': seat.up, 'the logo': zs.logo, 'the LED strip': zs.strip };
	// (the top line upright: the clock strip's lower edge and 8 CSS px under it, the window's width)
	if (kind === 'portrait') css['the top line'] = { x: 0, y: 0, w: vw, h: L.topLine(vw, vh) + 8 };
	const toRoad = (b) => ({ x0: (b.x - G.ox) / G.k, y0: (b.y - G.oy) / G.k, x1: (b.x + b.w - G.ox) / G.k, y1: (b.y + b.h - G.oy) / G.k });
	const zones = Object.entries(css).map(([name, b]) => ({ name, ...toRoad(b) }));
	const s = (CONST.STRIKE.snow[kind] ?? CONST.STRIKE.snow.landscape).scale;
	const side = REACH.side * s;
	const h = REACH.up * s;
	const F = G.forest;
	const tree = F ? FOREST_LINE.snowDay.line : null;
	const onTrees = (x, y) => {
		if (!F || x < F.x || x >= F.x + F.width) return false;
		return y < F.y + F.height * tree[Math.min(tree.length - 1, Math.floor(((x - F.x) / F.width) * tree.length))] + RG.ROAM_TREE_PAD;
	};
	const A = RP.ROAM_AREAS[kind];
	const r = G.rect;
	/** what his body at (x, y) is on: the first of the screen's edge, a tunnel mouth, the trees, the asphalt, a zone
	 *  (`pass`: zone names left out, a walk in behind a sign); '' when clear */
	const hit = (x, y, offOk = false, pass = null) => {
		const x0 = x - side;
		const x1 = x + side;
		const y0 = y - h;
		if (!offOk && (x0 < r.left || x1 > r.right || y0 < r.top || y > r.bottom)) return 'the screen';
		const sx0 = x0 - Math.max(0, -lean.x) * h;
		const sx1 = x1 + Math.max(0, lean.x) * h;
		const sy0 = Math.min(y0, y + Math.min(0, lean.y) * h);
		for (const M of RP.ROAM_TUNNELS) if (polyBox(M, sx0, sy0, sx1, y)) return 'a tunnel mouth';
		if (onTrees(x, y)) return 'the trees';
		if (x0 < ROAD_ART.image.width && x1 > 0 && y - h * FEET_SHARE < RG.ROAM_ROAD.bottom && y > RG.ROAM_ROAD.top) return 'the asphalt';
		for (const z of zones) if (!(pass && pass.includes(z.name)) && sx0 < z.x1 && sx1 > z.x0 && sy0 < z.y1 && y > z.y0) return z.name;
		return '';
	};
	const inArea = (x, y) => inPoly(x, y, A.corners) || (A.beyond && (x >= Math.max(ROAD_ART.image.width + 24, RP.ROAM_REF_RECT[kind].right) || x <= Math.min(-24, RP.ROAM_REF_RECT[kind].left)));
	const gx = Math.max(8, (r.right - r.left) * 0.03) / 2;
	const out = { kind, G, stand: 0, clear: 0, under: 0, inWay: {}, feet: [Infinity, -Infinity], underKey: 0 };
	const ex = r.right + side + Math.max(0, -lean.x) * h + 4;
	for (let y = r.top; y <= r.bottom; y += 6)
		for (let x = r.left; x <= r.right; x += gx) {
			if (!inArea(x, y) || hit(x, y)) continue;
			out.stand++;
			out.feet = [Math.min(out.feet[0], G.oy + y * G.k), Math.max(out.feet[1], G.oy + y * G.k)];
			// (the stand rule, asked again by itself: his body and shadow on no key and no sign)
			if (zones.some((z) => !['the logo', 'the LED strip', 'the top line'].includes(z.name) && x - side - Math.max(0, -lean.x) * h < z.x1 && x + side + Math.max(0, lean.x) * h > z.x0 && Math.min(y - h, y + Math.min(0, lean.y) * h) < z.y1 && y > z.y0)) out.underKey++;
			// a level walk in from past his side's edge: clear of every key, or (the second try) behind the signs
			let clear = true;
			let under = true;
			for (let xx = x; xx <= ex; xx += 6) {
				if (hit(xx, y, true)) clear = false;
				const w = hit(xx, y, true, SIGNS);
				if (w) {
					under = false;
					out.inWay[w] = (out.inWay[w] || 0) + 1;
				}
			}
			if (clear) out.clear++;
			else if (under) out.under++;
		}
	return out;
};

const rows = [];
const at = (vw, vh) => {
	const m = model(vw, vh);
	rows.push(`     ${vw}x${vh} (${m.kind}): ${m.stand} spots to stand on; a level way in clear of every key at ${m.clear}, behind a sign at ${m.under} more${m.G.treeY === null ? '' : `; tree line ${r1(m.G.treeY)}, feet ${r1(m.G.top)} to ${r1(m.G.bottom)}`}${m.clear + m.under === 0 && Object.keys(m.inWay).length ? `; in the way with the signs passable: ${Object.keys(m.inWay).join(', ')}` : ''}`);
	return m;
};
// 1. the two measured on his phone with a way in
for (const [vw, vh] of [[440, 742], [832, 376]]) {
	const m = at(vw, vh);
	line(m.stand > 0 && m.clear > 0, `${vw}x${vh}: he has spots to stand on and a level way in clear of every key (the signs are not needed)`, `${m.stand} spots, ${m.clear} with a clear way in`);
}
// 2. the sign alone closes his side at 360x560; the old sizes need no sign
{
	const m = at(360, 560);
	line(m.stand > 0 && m.clear === 0 && m.under > 0, `360x560: no way in is clear of every key, and with the signs passable he walks in behind the Fast Lane sign`, `${m.stand} spots, ${m.clear} with a clear way in, ${m.under} behind a sign`);
	const olds = [[425, 812], [375, 667], [320, 568], [390, 844], [402, 874], [390, 620], [844, 390]].map(([vw, vh]) => [vw, vh, at(vw, vh)]);
	line(olds.every(([, , q]) => q.stand > 0 && q.clear > 0), `Stake's phone sizes and the full screen ones: a level way in clear of every key at each (the rule changes nothing there)`, olds.map(([vw, vh, q]) => `${vw}x${vh} ${q.clear} of ${q.stand}`).join(', '));
}
// 5. the open point (before 3 and 4, which read every window's model)
const SHORT = [[413, 586], [375, 530], [626, 816]].map(([vw, vh]) => [vw, vh, at(vw, vh)]);
line(SHORT.every(([, , m]) => m.stand > 0 && m.clear === 0 && m.under === 0 && Object.keys(m.inWay).join() === 'a tunnel mouth'), `OPEN POINT, as it stands: at 413x586, 375x530 and 626x816 he has spots to stand on and no way in, behind the signs neither; the one thing in the way is the right tunnel's mouth (the tree line stands under its top there)`, SHORT.map(([vw, vh, m]) => `${vw}x${vh}: ${m.stand} spots, way in ${m.clear} + ${m.under}, in the way: ${Object.keys(m.inWay).join(', ') || 'nothing'}`).join(' | '));
const REST = [[667, 311], [890, 552]].map(([vw, vh]) => [vw, vh, at(vw, vh)]);
// 3 and 4, at every window modelled
{
	const all = [[440, 742], [832, 376], [360, 560], [425, 812], [375, 667], [320, 568], [390, 844], [402, 874], [390, 620], [844, 390], [413, 586], [375, 530], [626, 816], [667, 311], [890, 552]].map(([vw, vh]) => [vw, vh, model(vw, vh)]);
	const underKey = all.filter(([, , m]) => m.underKey > 0).map(([vw, vh, m]) => `${vw}x${vh}: ${m.underKey}`);
	line(underKey.length === 0, `no spot he may stand on is under a key or a sign, at ${all.length} windows (${all.reduce((n, [, , m]) => n + m.stand, 0)} spots)`, underKey.join(', '));
	const off = all.filter(([, , m]) => m.G.treeY !== null && m.stand > 0 && (m.feet[0] < m.G.top - 0.01 || m.feet[1] > m.G.bottom + 0.01)).map(([vw, vh, m]) => `${vw}x${vh}: feet ${r1(m.feet[0])} to ${r1(m.feet[1])} against ${r1(m.G.top)} to ${r1(m.G.bottom)}`);
	line(off.length === 0, `upright, every spot's feet are under the tree line and above the snow rim's foot (roamGround's strip)`, off.join(', '));
	void REST;
	void r0;
}
for (const r of rows) console.log(r);
console.log(`${fail} fail`);
process.exit(fail ? 1 : 0);
