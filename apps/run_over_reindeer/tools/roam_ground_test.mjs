// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/game/{roamGround.ts,roamPaths.ts,reindeerRoamSpec.ts,scene/forestPlace.ts,forestLineSpec.ts,layoutSpec.ts}; roamGround
// WATCHES: ; ROAM_AREAS, ROAM_TUNNELS, ROAM_ROAD, ROAM_TREE_PAD, REINDEER_ROAM, SHADOW, STRIKE.snow
// WATCHES: apps/run_over_reindeer/src/ui/sign/{signLayout.ts,signZones.ts}; PHONE_R3, sceneFit, forestOn, roam zone sign
// WATCHES: apps/run_over_reindeer/src/game/road/roam.ts; ROAM_SHORT, roamShortOn, roamShortArea, roamShortTop, roamShortLimit, shortWayIn, Roam.short
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
//   5. THE SHORT UPRIGHT GROUND (2026-11-25, Corey on the annotated 413x586 still: "Look at my shape";
//      game/roamGround.ts ROAM_SHORT). Before it, at 413x586, 375x530 and 626x816 he had spots and NO way in: the
//      tree line stood under the right tunnel mouth's top, so his strip ran into the mouth's keep-out at his side.
//      Now, read with THE GAME'S OWN ROAMER (game/road/roam.ts, its class run in node with the zones below): at the
//      short windows the short ground applies, his feet stand inside Corey's band (under its top edge, above its
//      bottom edge) and off every key, sign and the logo, he finds a way in from past the right edge (behind the Fast
//      Lane sign, down from above the arch) for most seeded walk ins, every leg of it off everything but the sign,
//      and the band and his stops are printed in CSS px
//   6. NOTHING ELSE MOVES: at the windows where he walked before (desktop, 440x742, sideways, Stake's phone sizes,
//      360x560 and more) the short ground does not apply, and the game's own roamer there gives exactly the numbers it
//      gave at 930a7748, before the short ground (his valid spots on a grid, the floor, and seeded picks and walk ins:
//      a fingerprint of each). A deliberate change there updates GUARD below.
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
// (the game's roamer, game/road/roam.ts, reads import.meta.env and $env (Vite and SvelteKit): stood in as a build's, as
// tools/charge_hit_check.mjs does)
register(
	'data:text/javascript,' +
		encodeURIComponent(`export async function resolve(s, c, n) {
	if (s.startsWith('$env/')) return { url: 'data:text/javascript,export {}', shortCircuit: true };
	if (s === 'state-shared') return { url: ${JSON.stringify(STATE_URL)}, shortCircuit: true };
	if (s === 'constants-shared/bet') return { url: ${JSON.stringify(pathToFileURL(join(SDK, 'packages', 'constants-shared', 'bet.ts')).href)}, shortCircuit: true };
	if (s === 'utils-shared/amount') return { url: ${JSON.stringify(pathToFileURL(join(SDK, 'packages', 'utils-shared', 'amount.ts')).href)}, shortCircuit: true };
	if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return n(s + '.ts', c);
	return n(s, c);
}
export async function load(u, c, n) {
	const r = await n(u, c);
	if (u.endsWith('.ts') && r.source) return { ...r, source: String(r.source).replaceAll('import.meta.env', '({ DEV: false })') };
	return r;
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
const RO = await imp('game/road/roam.ts');

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

/** a window's layout: his ground (game/roamGround.ts) and every keep-out's box in CSS px, by the layout files */
const layoutAt = (vw, vh) => {
	const kind = kindOf(vw, vh);
	const phone = Math.min(vw, vh) <= 480;
	const G = RG.roamGround(kind, vw, vh, phone);
	const zs = Z.signZones(kind, vw, vh, phone);
	const g = L.signLayout({ kind, vw, vh, zones: zs });
	const seat = L.seatAmount(g, 4.198, (3.2 * Math.max(g.head.amt, 10 / g.u) + 12) * g.u, L.amountLimits(g, zs));
	const css = { 'the Spin': g.box.play, Auto: g.box.auto, Turbo: g.box.turbo, 'the Menu sign': g.box.menu, 'the Fast Lane sign': g.box.bonus, Balance: g.box.bal, 'the amount': seat.amt, '<': seat.down, '>': seat.up, 'the logo': zs.logo, 'the LED strip': zs.strip };
	// (the top line upright: the clock strip's lower edge and 8 CSS px under it, the window's width)
	if (kind === 'portrait') css['the top line'] = { x: 0, y: 0, w: vw, h: L.topLine(vw, vh) + 8 };
	return { kind, phone, G, css };
};

const model = (vw, vh) => {
	const { kind, G, css } = layoutAt(vw, vh);
	const toRoad = (b) => ({ x0: (b.x - G.ox) / G.k, y0: (b.y - G.oy) / G.k, x1: (b.x + b.w - G.ox) / G.k, y1: (b.y + b.h - G.oy) / G.k });
	const zones = Object.entries(css).map(([name, b]) => ({ name, ...toRoad(b) }));
	const s = (CONST.STRIKE.snow[kind] ?? CONST.STRIKE.snow.landscape).scale;
	const side = REACH.side * s;
	const h = REACH.up * s;
	const F = G.forest;
	const tree = F ? FOREST_LINE.snowDay.line : null;
	// (THE SHORT UPRIGHT GROUND, game/roamGround.ts ROAM_SHORT: under Corey's top edge where it reaches, in the game's
	// finer columns, 4 to each of the forest line's: COPY OF game/road/roam.ts:SHORT_COLS; under the tree line elsewhere)
	const SH = G.short ? RG.roamShortTop(F) : null;
	const onTrees = (x, y) => {
		if (!F || x < F.x || x >= F.x + F.width) return false;
		const n = SH ? tree.length * 4 : tree.length;
		const i = Math.min(n - 1, Math.floor(((x - F.x) / F.width) * n));
		const own = F.y + F.height * tree[Math.floor((i * tree.length) / n)] + RG.ROAM_TREE_PAD;
		const mound = SH ? RG.roamShortLimit(SH, F.x + (F.width * i) / n, F.x + (F.width * (i + 1)) / n) : NaN;
		return y < (Number.isFinite(mound) ? mound : own);
	};
	const A = G.short ? RG.roamShortArea(F) : RP.ROAM_AREAS[kind];
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
		for (const z of zones) {
			if (pass && pass.includes(z.name)) continue;
			// (the short ground: the logo by his body only, it is drawn over him and his shadow)
			const body = G.short && z.name === 'the logo';
			if ((body ? x0 : sx0) < z.x1 && (body ? x1 : sx1) > z.x0 && (body ? y0 : sy0) < z.y1 && y > z.y0) return z.name;
		}
		return '';
	};
	const inArea = (x, y) => inPoly(x, y, A.corners) || (A.beyond && (x >= Math.max(ROAD_ART.image.width + 24, RP.ROAM_REF_RECT[kind].right) || x <= Math.min(-24, RP.ROAM_REF_RECT[kind].left)));
	const gx = Math.max(8, (r.right - r.left) * 0.03) / 2;
	const out = { kind, G, stand: 0, clear: 0, under: 0, inWay: {}, feet: [Infinity, -Infinity], underKey: 0, hit, inArea, onTrees, A, side };
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
	rows.push(`     ${vw}x${vh} (${m.kind}): ${m.stand} spots to stand on; a level way in clear of every key at ${m.clear}, behind a sign at ${m.under} more${m.G.treeY === null ? '' : `; tree line ${r1(m.G.treeY)}, feet ${r1(m.G.top)} to ${r1(m.G.bottom)}`}${m.clear + m.under === 0 && Object.keys(m.inWay).length ? `; in the way of a LEVEL way in with the signs passable: ${Object.keys(m.inWay).join(', ')}` : ''}${m.G.short ? ' (the short ground: his way in comes down from above the arch, below)' : ''}`);
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
// ---- THE GAME'S OWN ROAMER (game/road/roam.ts, the class itself, no canvas needed for its choices) at a window: the
// view and the keep-outs as components/Board.svelte gives them, under the game's zone names, from the layout boxes
// above; the forest where the scene places it (the snow day kit: every kit's line is the same)
const GAME_ZONE = { 'the Spin': 'hud', Auto: 'hud', Turbo: 'hud', 'the Menu sign': 'sign', 'the Fast Lane sign': 'sign', Balance: 'hud', 'the amount': 'hud', '<': 'hud', '>': 'hud', 'the logo': 'logo', 'the LED strip': 'LED strip', 'the top line': 'top line' };
const roamerAt = (vw, vh) => {
	const { kind, G, css } = layoutAt(vw, vh);
	const zones = Object.entries(css)
		.filter(([, b]) => b)
		.map(([n, b]) => ({ name: GAME_ZONE[n], x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h }));
	zones.push({ name: 'road', x0: G.ox, y0: G.oy + RG.ROAM_ROAD.top * G.k, x1: G.ox + ROAD_ART.image.width * G.k, y1: G.oy + RG.ROAM_ROAD.bottom * G.k });
	RO.roamDev.view = () => ({ kind, k: G.k, ox: G.ox, oy: G.oy, rect: G.rect });
	RO.roamDev.zones = () => zones;
	const roam = new RO.Roam();
	roam.forest = () => (G.forest ? { ...G.forest, kit: 'snowDay' } : null);
	roam.setView(kind, G.rect);
	return { roam, G, kind };
};

// 5. THE SHORT UPRIGHT GROUND (before 3 and 4, which read every window's model). His three windows, and two more of
// the same shape class (a 600 px wide upright tablet window and one between)
const SHORT_AT = [[413, 586], [375, 530], [626, 816], [600, 800], [500, 650]];
const tan14 = Math.tan((CONST.ROAM.maxSlopeDeg * Math.PI) / 180);
const bands = [];
for (const [vw, vh] of SHORT_AT) {
	const m = at(vw, vh);
	const { roam, G } = roamerAt(vw, vh);
	const X = (x) => G.ox + x * G.k;
	const Y = (y) => G.oy + y * G.k;
	const bad = [];
	// 40 seeded walk ins: past the right edge, a level leg, then down no steeper than his walk's rule, every point of
	// the way off every keep-out but the Fast Lane and Menu signs (the model: his body and shadow, the mouths, the top
	// edge, the asphalt) and, on the screen, his feet inside the band
	const ins = roam.devPicks(0, 40, 2323).filter((q) => q.pass >= 0);
	const lane = [Infinity, -Infinity];
	for (const q of ins) {
		const R = q.route ?? [];
		if (R.length < 2) {
			bad.push(`a walk in to (${r1(X(q.x))}, ${r1(Y(q.y))}) with no way`);
			continue;
		}
		if (R[0].x - m.side <= G.rect.right) bad.push(`a walk in that starts on the screen (${r1(X(R[0].x))})`);
		if (R.length === 3 && Math.abs(R[0].y - R[1].y) > 1e-6) bad.push('a walk in whose first leg is not level');
		const last = R[R.length - 2];
		if (Math.abs(q.y - last.y) > Math.abs(q.x - last.x) * tan14 + 1e-6) bad.push(`a walk in steeper than ${CONST.ROAM.maxSlopeDeg} degrees`);
		lane[0] = Math.min(lane[0], Y(R[0].y));
		lane[1] = Math.max(lane[1], Y(R[0].y));
		walk: for (let L = 0; L + 1 < R.length; L++) {
			const a = R[L];
			const b = R[L + 1];
			const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
			for (let i = 0; i <= n; i++) {
				const x = a.x + ((b.x - a.x) * i) / n;
				const y = a.y + ((b.y - a.y) * i) / n;
				// (on the screen his feet inside the band all the way: over the arch, Corey's notch)
				const w = m.hit(x, y, true, SIGNS) || (x >= G.rect.left && x <= G.rect.right && !m.inArea(x, y) ? 'ground outside the band' : '');
				if (w) {
					bad.push(`the walk in to (${r1(X(q.x))}, ${r1(Y(q.y))}) covers ${w} at (${r1(X(x))}, ${r1(Y(y))})`);
					break walk;
				}
			}
		}
	}
	// where he stops: the walk ins' spots and 60 seeded walks from the first: his feet inside Corey's band (its polygon,
	// under its top edge), his body and shadow off the screen's edge, the mouths, the asphalt and every key, sign and the
	// logo (the model's own stand rule); the walks between them off all of it too
	const stops = ins.map((q) => ({ x: q.x, y: q.y }));
	if (ins.length) {
		roam.standAt(ins[0].x, ins[0].y);
		for (const q of roam.devPicks(60, 0, 99)) {
			if (q.pass < 0) continue;
			stops.push({ x: q.x, y: q.y });
			const R = q.route && q.route.length > 1 ? q.route : [{ x: q.fromX, y: q.fromY }, { x: q.x, y: q.y }];
			walk: for (let L = 0; L + 1 < R.length; L++) {
				const a = R[L];
				const b = R[L + 1];
				const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
				for (let i = 0; i <= n; i++) {
					const w = m.hit(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n);
					if (w) {
						bad.push(`a walk to (${r1(X(q.x))}, ${r1(Y(q.y))}) covers ${w}`);
						break walk;
					}
				}
			}
		}
	}
	const ext = [Infinity, -Infinity, Infinity, -Infinity];
	for (const q of stops) {
		if (!m.inArea(q.x, q.y)) bad.push(`a stop (${r1(X(q.x))}, ${r1(Y(q.y))}) outside the band`);
		const w = m.hit(q.x, q.y);
		if (w) bad.push(`a stop (${r1(X(q.x))}, ${r1(Y(q.y))}) on ${w}`);
		ext[0] = Math.min(ext[0], X(q.x));
		ext[1] = Math.max(ext[1], X(q.x));
		ext[2] = Math.min(ext[2], Y(q.y));
		ext[3] = Math.max(ext[3], Y(q.y));
	}
	const snap = roam.snapshot();
	const under = ins.filter((q) => q.underSign).length;
	const ok = G.short && roam.short && snap.widen === 0 && m.stand >= 20 && ins.length >= 24 && under === ins.length && stops.length > ins.length && bad.length === 0;
	line(ok, `${vw}x${vh}, THE SHORT UPRIGHT GROUND (Corey's shape): his band applies and is never widened; ${m.stand} spots to stand on (the model's grid); ${ins.length} of 40 seeded walk ins find a way in from past the right edge (behind the Fast Lane sign, down from above the arch), every one's way off every keep-out but the sign; his ${stops.length} stops' feet inside the band and his body off every key, sign and the logo`, `${bad.slice(0, 4).join('; ') || 'nothing wrong'}; walk ins behind the sign ${under} of ${ins.length}; the floor ${snap.capacity} spots 12 % apart, span ${snap.span}`);
	bands.push(`     ${vw}x${vh} band (CSS px): top edge ${r1(G.top)} at its highest (tree line ${r1(G.treeY)}), bottom edge down to ${r1(G.bottom)}, asphalt ${r1(G.roadY)}; he stops at x ${r1(ext[0])} to ${r1(ext[1])}, feet y ${r1(ext[2])} to ${r1(ext[3])}; he walks in with his feet at y ${r1(lane[0])} to ${r1(lane[1])} past the edge (the right mouth's top ${r1(Y(Math.min(...RP.ROAM_TUNNEL_MOUTH.map((p) => p.y))))}); the floor ${snap.capacity} spots, span ${snap.span}`);
}
// 6. NOTHING ELSE MOVES: the game's own roamer where he walked before the short ground. Each print: his valid spots on
// a grid of the screen (count and a hash), the floor's widening, capacity and span, and a hash of 16 seeded picks and
// 16 walk ins from a seeded first spot. Recorded at 930a7748 (wip/reindeer-next7), before the short ground.
const GUARD = {
	'1440x900': '784|527890931|0|5|66|565148047',
	'1920x1080': '514|645347745|1|3|36|749548705',
	'2000x945': '489|819083020|1|3|30|848890934',
	'1280x720': '514|645347745|1|3|36|749548705',
	'1200x675': '514|645347745|1|3|36|749548705',
	'2560x1080': '3178|216478219|2|5|12|601024224',
	'1024x768': '1779|241990538|0|6|66|902380542',
	'768x1024': '1681|852065530|1|6|27|924111037',
	'890x552': '344|234674398|0|4|42|419741735',
	'440x742': '1308|825686729|0|5|39|64887442',
	'832x376': '224|438102131|0|2|24|13927232',
	'844x390': '184|113906114|0|3|24|362635576',
	'932x430': '203|221330896|0|2|24|722996063',
	'667x311': '178|621946641|0|2|24|564359941',
	'390x844': '4480|232197287|0|9|39|655164656',
	'430x932': '4507|86809774|0|9|39|655164656',
	'360x560': '1017|570158722|1|5|48|631772934',
	'425x812': '3582|562163205|0|10|81|115261839',
	'375x667': '2234|897306273|0|8|60|546655678',
	'320x568': '2144|907996305|0|6|39|243306482',
	'402x874': '4516|49162910|0|9|39|50824837',
	'390x620': '1182|764319008|1|6|57|754335109',
	'390x664': '1536|77898354|0|5|39|674802352',
	'360x640': '2206|536959902|0|6|39|240700636',
	'414x736': '2391|518432493|0|9|66|834582162',
	'480x480': '723|1700370|1|3|33|991726311',
	'600x600': '1688|232289817|2|3|27|771296255',
	'640x520': '376|735853255|0|3|33|374243979'
};
const fingerprint = (vw, vh) => {
	const { roam, G } = roamerAt(vw, vh);
	const r = G.rect;
	let n = 0;
	let hash = 0;
	let j = 0;
	const dx = (r.right - r.left) / 120;
	for (let y = r.top; y <= r.bottom; y += 5, j++) {
		let i = 0;
		for (let x = r.left; x <= r.right; x += dx, i++)
			if (roam.valid(x, y)) {
				n++;
				hash = (hash * 31 + i * 1009 + j) % 1000000007;
			}
	}
	roam.reseed(99);
	let ph = 0;
	if (roam.pick(null)) {
		roam.standAt(roam.to.x, roam.to.y);
		for (const q of roam.devPicks(16, 16, 4242)) ph = (ph * 131 + Math.round(q.x * 10) * 7 + Math.round(q.y * 10) * 13 + (q.pass + 2) + (q.route ? q.route.length * 17 : 0)) % 1000000007;
	}
	return { short: roam.short, print: `${n}|${hash}|${roam.widen}|${roam.capacity}|${Math.round(roam.span * 100)}|${ph}` };
};
{
	const moved = [];
	for (const [wh, want] of Object.entries(GUARD)) {
		const [vw, vh] = wh.split('x').map(Number);
		const f = fingerprint(vw, vh);
		if (f.short || f.print !== want) moved.push(`${wh}: ${f.short ? 'the short ground applies; ' : ''}${f.print} (was ${want})`);
	}
	line(moved.length === 0, `NOTHING ELSE MOVES: at ${Object.keys(GUARD).length} windows where he walked before (desktop and tablet, 440x742, sideways, Stake's phone sizes, 360x560 and more) the short ground does not apply and the game's own roamer gives what it gave at 930a7748`, moved.join(' | '));
}
const REST = [[667, 311], [890, 552]].map(([vw, vh]) => [vw, vh, at(vw, vh)]);
// 3 and 4, at every window modelled
{
	const all = [[440, 742], [832, 376], [360, 560], [425, 812], [375, 667], [320, 568], [390, 844], [402, 874], [390, 620], [844, 390], [413, 586], [375, 530], [626, 816], [600, 800], [500, 650], [667, 311], [890, 552]].map(([vw, vh]) => [vw, vh, model(vw, vh)]);
	const underKey = all.filter(([, , m]) => m.underKey > 0).map(([vw, vh, m]) => `${vw}x${vh}: ${m.underKey}`);
	line(underKey.length === 0, `no spot he may stand on is under a key or a sign, at ${all.length} windows (${all.reduce((n, [, , m]) => n + m.stand, 0)} spots)`, underKey.join(', '));
	const off = all.filter(([, , m]) => m.G.treeY !== null && m.stand > 0 && (m.feet[0] < m.G.top - 0.01 || m.feet[1] > m.G.bottom + 0.01)).map(([vw, vh, m]) => `${vw}x${vh}: feet ${r1(m.feet[0])} to ${r1(m.feet[1])} against ${r1(m.G.top)} to ${r1(m.G.bottom)}`);
	line(off.length === 0, `upright, every spot's feet are under the tree line and above the snow rim's foot (roamGround's strip)`, off.join(', '));
	void REST;
	void r0;
}
for (const r of [...rows, ...bands]) console.log(r);
console.log(`${fail} fail`);
process.exit(fail ? 1 : 0);
