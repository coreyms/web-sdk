// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// THE SIGN BAR'S LAYOUT TEST (2026-11-22, wip/signhud): node only, no browser. It runs the bar's own layout rule
// (src/ui/sign/signLayout.ts) against the game's own scene rules (src/ui/sign/signZones.ts: the board, the LED strip and
// the logo as game/layoutSpec.ts and game/scoreboard/layout.ts place them).
//   node --experimental-strip-types --no-warnings tools/sign_layout_test.mjs            (from apps/run_over_reindeer)
//   TABLE=1 node --experimental-strip-types --no-warnings tools/sign_layout_test.mjs    (prints every swept window)
// Checked:
//   1. EXACT AT HIS SIZES: at each of Corey's nine phone windows every piece is on his own box (0.05 CSS px), with the
//      guards on and the scene's real keep-outs: no guard moves anything there. Desktop: his 1920 x 1080 boxes.
//   2. A STRAIGHT LINE BETWEEN THEM: along every edge of the triangles his windows make, each piece's size and its
//      distance from what it belongs to change in one direction only (the blend alone, guards off).
//   3. NOTHING ON THE SCENE, NOTHING ON THE PLAY: over a sweep of windows in both orientations (and the desktop
//      sizes), by real shape: no piece on the board, the strip or the logo, none off the window, no bet symbol's press
//      box on the Play's diamond, no press region under 44 CSS px. Inside his own range of windows that must hold;
//      beyond it (and at the two popouts) what fails is listed.
//   7. WHAT THE RULE NAMES A CONTROL'S GROUND IS COVERED (2026-11-23, pressShape): the rule's shapes are the buttons'
//      own round cornered ones, no slack; every place it gives a control lies inside that control's catch outline or pad.
//   6. A ROUND STARTS ONLY FROM THE PLAY'S OWN DIAMOND (2026-11-23, pressOwner, pressVerdict): at every layout the
//      Play's diamond shares no ground with a neighbour; a click the Play gets for a neighbour's place is the neighbour's.
//   5. WHOSE PRESS IS IT, OF AUTO AND TURBO (2026-11-23, pressOwner): the drawn diamonds never overlap; a place is
//      the key's whose drawing or pad it is in, else nobody's; were two drawn keys to overlap, Turbo's (drawn on top).
//   4. AUTO'S AND TURBO'S PRESS PADS (2026-11-23): by their real shapes, at his nine phone windows and at every
//      sideways phone from 568 x 320 to 932 x 430, each is a whole 44 px circle 2 px or more from every other press
//      region, neither pad in the other; the 400 x 225 mini player's two share their ground down the middle line.
// The amount's widths have no font here: a widest amount of 4.4 em ("$100.00" in Overpass 900 is 4.36 em) and a 3.2 em
// header stand in. Pass: every line PASS, "0 fail" and exit 0.
import { register } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
// (the game's own formatter needs the shared state and two shared files: the stand-ins of tools/amount_fit_test.mjs)
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

let fail = 0;
const line = (ok, what, detail = '') => {
	if (!ok) fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${detail ? ': ' + detail : ''}`);
};
const r1 = (v) => Math.round(v * 10) / 10;
const WIDEST_EM = 4.4;
/** "$100.00" in Overpass 900 with every digit a 0 wide (the bar's own measure): for the sizes printed below */
const USD_EM = 4.198;
/** (2026-11-23: none any more. His own Auto and Turbo stand 37 px apart at 568 x 320 and 43.4 at 667 x 375, and their
 *  44 px press circles shared a strip there; their pads now stand apart, signLayout.ts padPlaces, section 4 below) */
const KNOWN = /^never$/;
const HEAD_EM = 3.2;
/** a window's layout, its seat and its problems, with the scene's own keep-outs */
const at = (kind, vw, vh, safe) => {
	const zones = Z.signZones(kind, vw, vh, kind !== 'landscape');
	const g = L.signLayout({ kind, vw, vh, safe, zones });
	const headW = (HEAD_EM * 10.5 * g.rs.amt + 12) * g.u;
	const seat = L.seatAmount(g, WIDEST_EM, headW, L.amountLimits(g, zones, safe));
	return { zones, g, seat, problems: L.signProblems(g, zones, seat) };
};

// ---- 1. exact at his sizes ----
for (const o of ['portrait', 'phone']) {
	for (const r of L.PHONE_PLACES[o]) {
		const { g, problems, seat } = at(o, r.vw, r.vh);
		let d = 0;
		for (const id of L.PIECES) {
			const b = g.box[id];
			const p = r.p[id];
			d = Math.max(d, Math.abs(b.x - p[0]), Math.abs(b.y - p[1]), Math.abs(b.w - p[2]), Math.abs(b.h - p[3]));
		}
		const raw = L.PHONE_REFS[o].find((q) => q.vw === r.vw && q.vh === r.vh);
		for (const id of L.PIECES) if (id !== 'bal' && id !== 'amt') d = Math.max(d, ...r.p[id].map((v, i) => Math.abs(v - raw.p[id][i])));
		line(d <= 0.05 && g.moved.length === 0, `${r.vw}x${r.vh} his places (Balance and the amount enlarged), no guard acting`, `worst ${d.toFixed(3)} px${g.moved.length ? '; moved: ' + g.moved.join('; ') : ''}`);
		// (his own Auto and Turbo stand 37 px apart at 568 x 320 and 43.4 at 667 x 375: their press pads stand apart there,
		// section 4, so no press region is under 44 at any window of his)
		const rest = problems.filter((x) => !KNOWN.test(x));
		line(rest.length === 0, `${r.vw}x${r.vh} clear by shape on the game's own board, strip and logo`, [...rest, ...problems.filter((x) => KNOWN.test(x)).map((x) => `${x} (his own placing)`)].join('; ') + (Math.abs(seat.nudge) > 0.05 ? `; the amount stands ${r1(seat.nudge)} px from his center (the least its width needs)` : ''));
	}
}
{
	const g = L.signLayout({ kind: 'landscape', vw: 1920, vh: 1080 });
	const his = { play: [1609, 653, 320, 320], auto: [1722, 512, 130, 130], turbo: [1787, 577, 133, 133], menu: [4, 710, 213, 100], bonus: [0, 827, 217, 147], amt: [1631, 981, 207, 67], bal: [20, 991, 335, 72], win: [811, 1019, 264, 50] };
	let d = 0;
	for (const id of L.PIECES) d = Math.max(d, ...['x', 'y', 'w', 'h'].map((k, i) => Math.abs(g.box[id][k] - his[id][i])));
	line(d <= 0.75, 'desktop 1920x1080 his places (his copy is whole CSS px)', `worst ${d.toFixed(2)} px`);
	const a = L.signLayout({ kind: 'landscape', vw: 1280, vh: 720 });
	const b = L.signLayout({ kind: 'landscape', vw: 1440, vh: 900 });
	const c = L.signLayout({ kind: 'landscape', vw: 2560, vh: 1080 });
	line(Math.abs(a.box.play.x - g.box.play.x / 1.5) < 0.01 && Math.abs(a.box.win.y - g.box.win.y / 1.5) < 0.01, 'desktop 16:9: the same layout at the window\'s scale');
	line(Math.abs(900 - (b.box.amt.y + b.box.amt.h) - (810 - 786) * b.u) < 0.01, 'desktop 16:10: the bottom row keeps its distance from the bottom edge');
	line(Math.abs(c.box.bonus.x - 320) < 0.01 && Math.abs(c.box.play.x - (g.box.play.x + 320)) < 0.01, 'desktop 21:9: the controls stay with the centered 16:9 game area');
}

// ---- BALANCE AND THE AMOUNT, LARGER (Corey 2026-11-22): the numbers' heights before and after, what moved ----
for (const o of ['portrait', 'phone']) {
	for (const r of L.PHONE_PLACES[o]) {
		const raw = L.PHONE_REFS[o].find((q) => q.vw === r.vw && q.vh === r.vh);
		const zones = Z.signZones(o, r.vw, r.vh, true);
		const g = L.signLayout({ kind: o, vw: r.vw, vh: r.vh, zones });
		const head = (fs) => (2.42 * fs + 2 * (0.42 * fs + L.TEXT_MIN * 0.25)) * 1;
		const seat = L.seatAmount(g, USD_EM, head(Math.max(10.5 * g.rs.amt * g.u, 10)), L.amountLimits(g, zones));
		// before: his own box, seated by the mock's rule (the Play as its box, twice the nearer side about his center)
		const u = g.u;
		const sb = L.stepBox(g.step, u);
		const cx0 = raw.p.amt[0] + raw.p.amt[2] / 2;
		const nominal0 = (21 * raw.p.amt[2]) / 124;
		const lim0 = (() => {
			let Lm = u;
			let Rm = r.vw - u;
			const cy = raw.p.amt[1] + raw.p.amt[3] / 2;
			const h = sb.h * u;
			for (const q of [zones.board, zones.strip, zones.logo, ...['play', 'auto', 'turbo', 'menu', 'bonus', 'bal', 'win'].map((id) => ({ x: raw.p[id][0], y: raw.p[id][1], w: raw.p[id][2], h: raw.p[id][3] }))]) {
				if (!q || Math.min(q.y + q.h, cy + h / 2) - Math.max(q.y, cy - h / 2) < 0.5 * u) continue;
				if (q.x + q.w <= cx0) Lm = Math.max(Lm, q.x + q.w + u);
				else if (q.x >= cx0) Rm = Math.min(Rm, q.x - u);
			}
			return [Lm, Rm];
		})();
		const room0 = Math.max(44 * u, 2 * (Math.min(cx0 - lim0[0], lim0[1] - cx0) - sb.w * u - 4 * u));
		let k0 = 1;
		if (USD_EM * nominal0 > room0) {
			k0 = null;
			for (let s = 95; s >= 50; s -= 5) if ((USD_EM * nominal0 * s) / 100 <= room0) { k0 = s / 100; break; }
			if (k0 === null) k0 = room0 / (USD_EM * nominal0);
		}
		const bal0 = (21 * raw.p.bal[2]) / 186;
		const bal1 = (21 * r.p.bal[2]) / 186;
		console.log(`     ${r.vw}x${r.vh}: Balance number ${r1(bal0)} to ${r1(bal1)} px | amount number ${r1(nominal0 * k0)} to ${r1(seat.px)} px (${Math.round(seat.k * 100)} % of ${r1(seat.px / seat.k)}${seat.under ? ', under the floor' : ''}; reserved ${r1(seat.W)} px) | the amount ${Math.abs(seat.nudge) > 0.05 ? `${r1(Math.abs(seat.nudge))} px ${seat.nudge < 0 ? 'left' : 'right'} of his center` : 'on his center'} | < from ${r1(seat.down.x)}, > to ${r1(seat.up.x + seat.up.w)} of ${r.vw}`);
	}
}

// ---- 2. a straight line between his windows (the blend alone) ----
for (const o of ['portrait', 'phone']) {
	const refs = L.PHONE_REFS[o];
	const edges = new Set();
	for (const [i, j, k] of L.TRI[o]) for (const [a, b] of [[i, j], [j, k], [k, i]]) edges.add(a < b ? `${a},${b}` : `${b},${a}`);
	let bad = [];
	for (const e of edges) {
		const [i, j] = e.split(',').map(Number);
		const P = (r) => [Math.min(r.vw, r.vh), Math.max(r.vw, r.vh) / Math.min(r.vw, r.vh)];
		const [s0, a0] = P(refs[i]);
		const [s1, a1] = P(refs[j]);
		const rows = [];
		for (let n = 0; n <= 20; n++) {
			const t = n / 20;
			const s = s0 + (s1 - s0) * t;
			const a = a0 + (a1 - a0) * t;
			const [vw, vh] = o === 'portrait' ? [s, s * a] : [s * a, s];
			const g = L.phoneLayout({ kind: o, vw, vh });
			const W = vw / g.u;
			const H = vh / g.u;
			const row = [];
			for (const id of L.PIECES) {
				const b = g.box[id];
				const A = L.ANCHORS[o][id];
				const ax = A.ax === 'L' ? 0 : A.ax === 'R' ? W : W / 2;
				const ay = L.anchorY(A.ay, H, L.topLine(vw, vh) / g.u);
				row.push((b.x + b.w / 2) / g.u - ax, (b.y + b.h / 2) / g.u - ay, b.w / g.u, b.h / g.u);
			}
			rows.push(row);
		}
		for (let c = 0; c < rows[0].length; c++) {
			const dir = Math.sign(rows[20][c] - rows[0][c]);
			for (let n = 1; n <= 20; n++) if ((rows[n][c] - rows[n - 1][c]) * (dir || 1) < -1e-6 || (!dir && Math.abs(rows[n][c] - rows[0][c]) > 1e-6)) bad.push(`${refs[i].vw}x${refs[i].vh} to ${refs[j].vw}x${refs[j].vh}, ${L.PIECES[Math.floor(c / 4)]}[${c % 4}]`);
		}
	}
	bad = [...new Set(bad)];
	line(bad.length === 0, `${o}: every piece moves one way along each of the ${edges.size} edges between his windows`, bad.slice(0, 4).join('; '));
}

// ---- 3. nothing on the scene, nothing on the Play ----
const sweep = (o, shorts, aspects) => {
	const refs = L.PHONE_REFS[o];
	const out = { n: 0, inside: 0, known: 0, badInside: [], badOutside: [] };
	for (const s of shorts)
		for (const a of aspects) {
			const [vw, vh] = o === 'portrait' ? [s, Math.round(s * a)] : [Math.round(s * a), s];
			const w = L.blendWeights(o, vw, vh);
			// inside his own range: the window is in one of his triangles (three weights in play, or on a corner or an edge of the fan)
			const inside = (() => {
				const q = [Math.min(vw, vh) / 100, Math.max(vw, vh) / Math.min(vw, vh) / 0.5];
				const P = refs.map((r) => [Math.min(r.vw, r.vh) / 100, Math.max(r.vw, r.vh) / Math.min(r.vw, r.vh) / 0.5]);
				const cr = (A, B, C) => (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
				return L.TRI[o].some(([i, j, k]) => {
					const d = cr(P[i], P[j], P[k]);
					const wa = cr(q, P[j], P[k]) / d;
					const wb = cr(P[i], q, P[k]) / d;
					return wa >= -1e-9 && wb >= -1e-9 && 1 - wa - wb >= -1e-9;
				});
			})();
			const { g, problems, seat } = at(o, vw, vh);
			out.n++;
			if (inside) out.inside++;
			if (process.env.TABLE) console.log(`     ${vw}x${vh} ${inside ? 'in ' : 'out'} u ${g.u.toFixed(3)} w ${w.map((x) => x.toFixed(2)).join(' ')} ${problems.join('; ') || 'clear'}${g.moved.length ? ' | ' + g.moved.join('; ') : ''}${seat.nudge ? ' | amount ' + r1(seat.nudge) : ''}`);
			const real = inside ? problems.filter((x) => !KNOWN.test(x)) : problems;
			if (inside && real.length < problems.length) out.known++;
			if (real.length) (inside ? out.badInside : out.badOutside).push(`${vw}x${vh}: ${real.join(', ')}`);
		}
	return out;
};
const range = (a, b, step) => Array.from({ length: Math.round((b - a) / step) + 1 }, (_, i) => Math.round((a + i * step) * 1000) / 1000);
for (const o of ['portrait', 'phone']) {
	const S = sweep(o, range(320, 430, 5), range(1.5, 2.3, 0.02));
	line(S.badInside.length === 0, `${o} sweep: ${S.inside} windows inside his range, clear by shape (${S.n} swept)`, S.badInside.slice(0, 5).join(' | ') + (S.known ? `${S.known} of them carry his own close Auto and Turbo (press circles 37 to 44 px)` : ''));
	console.log(`     ${o}: beyond his range ${S.n - S.inside} windows, ${S.badOutside.length} with something to list${S.badOutside.length ? ': ' + S.badOutside.slice(0, 6).join(' | ') : ''}`);
}
for (const [vw, vh, name, must] of [[800, 450, 'Popout L', true], [400, 225, 'Popout S', false], [360, 640, 'a 360 x 640 phone', true], [412, 915, 'a 412 x 915 phone', true], [430, 932, 'a 430 x 932 phone', true], [393, 852, 'a 393 x 852 phone', true], [932, 430, 'a 932 x 430 phone', true], [852, 393, 'an 852 x 393 phone', true], [740, 360, 'a 740 x 360 phone', true]]) {
	const kind = vw > vh ? 'phone' : 'portrait';
	const { g, problems, seat } = at(kind, vw, vh);
	const boxes = { play: g.box.play, auto: g.box.auto, turbo: g.box.turbo, menu: g.box.menu, bonus: g.box.bonus, down: seat.down, up: seat.up };
	const press = L.pressRegions(boxes, L.padPlaces(boxes, vw, vh));
	const txt = `${problems.join('; ') || 'clear'} | press ${Object.entries(press).map(([k, v]) => `${k} ${r1(v)}`).join(', ')} | amount ${r1(seat.px)} px${seat.under ? ' (under the floor)' : ''}${g.moved.length ? ' | ' + g.moved.join('; ') : ''}`;
	if (must) line(problems.length === 0, `${name} (${vw}x${vh})`, txt);
	else console.log(`     ${name} (${vw}x${vh}), listed only: ${txt}`);
}
// ---- 4. AUTO'S AND TURBO'S PRESS PADS (2026-11-23; the house rule's 44 CSS px touch area; Corey: nothing touches the
// Spin's press region). The pads' REAL SHAPES (signLayout.ts padShapes: what the page draws) are what is tested.
//   a. At each of his nine phone windows: each pad is a whole 44 px circle, 2 px or more from the other pad, the other
//      key's diamond, the Play's diamond, both bet symbols' press boxes, Menu and the Fast Lane, and inside the window;
//      the key's own center is inside its pad; the drawn keys are his boxes (section 1).
//   b. EVERY SIDEWAYS PHONE from 568 x 320 to 932 x 430 (the probe host, 667 x 375: a press inside Auto's pad landed
//      on Turbo's): the width in steps of 4 px, the height in steps of 10 px, every shape of window from 3:2 to 21:9.
//      The same rule at each; and by the shapes themselves: no point of one pad is in the other, and every point of
//      Auto's pad is on Auto's side of the middle line between the two pads (and Turbo's on Turbo's). A window where
//      the two share their ground (split down the middle line) is listed.
//   c. The 400 x 225 mini player (a mouse window): its pads stay on the keys' centers, split down the middle line. ----
{
	const segD = (p, a, b) => {
		const dx = b[0] - a[0];
		const dy = b[1] - a[1];
		const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
		return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
	};
	const inP = (p, P) => {
		let c = false;
		for (let i = 0, j = P.length - 1; i < P.length; j = i++) if (P[i][1] > p[1] !== P[j][1] > p[1] && p[0] < ((P[j][0] - P[i][0]) * (p[1] - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
		return c;
	};
	/** the gap between two convex shapes (0 when they meet) */
	const gap = (A, B) => L.shapeGap(A, B);
	const read = (kind, vw, vh) => {
		const { g, seat, problems } = at(kind, vw, vh);
		const boxes = { play: g.box.play, auto: g.box.auto, turbo: g.box.turbo, menu: g.box.menu, bonus: g.box.bonus, down: seat.down, up: seat.up };
		const shapes = L.padShapes(boxes, vw, vh);
		const pads = { auto: shapes.auto.c, turbo: shapes.turbo.c };
		const home = { auto: [g.box.auto.x + g.box.auto.w / 2, g.box.auto.y + g.box.auto.h / 2], turbo: [g.box.turbo.x + g.box.turbo.w / 2, g.box.turbo.y + g.box.turbo.h / 2] };
		const moved = { auto: Math.hypot(pads.auto[0] - home.auto[0], pads.auto[1] - home.auto[1]), turbo: Math.hypot(pads.turbo[0] - home.turbo[0], pads.turbo[1] - home.turbo[1]) };
		// each pad's real shape against every other press region's shape (0: they meet), and against the window
		const gaps = {};
		for (const k of ['auto', 'turbo']) {
			const o = k === 'auto' ? 'turbo' : 'auto';
			gaps[`${k} pad to ${o} pad`] = gap(shapes[k].poly, shapes[o].poly);
			for (const id of [o, 'play', 'down', 'up', 'menu', 'bonus']) gaps[`${k} pad to ${id === 'down' ? '<' : id === 'up' ? '>' : id}`] = gap(shapes[k].poly, L.shapeOf(id, boxes[id]));
		}
		const edge = Math.min(...['auto', 'turbo'].flatMap((k) => shapes[k].poly.flatMap((q) => [q[0], q[1], vw - q[0], vh - q[1]])));
		// the middle line between the two pads: every corner of a pad on its own side, and none inside the other pad
		const mid = [(pads.auto[0] + pads.turbo[0]) / 2, (pads.auto[1] + pads.turbo[1]) / 2];
		const n = [pads.turbo[0] - pads.auto[0], pads.turbo[1] - pads.auto[1]];
		const side = (q) => ((q[0] - mid[0]) * n[0] + (q[1] - mid[1]) * n[1]) / Math.hypot(n[0], n[1]);
		const cross = Math.max(...shapes.auto.poly.map((q) => side(q)), ...shapes.turbo.poly.map((q) => -side(q)));
		const inOther = shapes.auto.poly.some((q) => inP(q, shapes.turbo.poly)) || shapes.turbo.poly.some((q) => inP(q, shapes.auto.poly));
		// a whole 44 px circle: every corner of the shape 22 px from the pad's center (a cut one has nearer corners)
		const whole = (k) => Math.min(...shapes[k].poly.map((q) => Math.hypot(q[0] - pads[k][0], q[1] - pads[k][1]))) > 21.99;
		const least = Object.entries(gaps).sort((a, b) => a[1] - b[1])[0];
		return { g, seat, problems, boxes, shapes, pads, home, moved, gaps, least, edge, cross, inOther, whole: whole('auto') && whole('turbo'), split: shapes.auto.split || shapes.turbo.split, press: L.pressRegions(boxes, pads) };
	};
	/** the rule a window must meet where the two pads have room: null when met, or what is short */
	const short = (R) => {
		const bad = [];
		if (R.split) bad.push('the pads share their ground (split down the middle line)');
		if (!R.whole) bad.push('a pad is not a whole 44 px circle');
		if (R.least[1] < L.PAD.gap - 0.05) bad.push(`${R.least[0]} ${R.least[1].toFixed(2)} px`);
		if (R.edge < -0.05) bad.push(`a pad ${(-R.edge).toFixed(2)} px off the window`);
		if (R.cross > -L.PAD.gap / 2 + 0.05) bad.push(`a pad reaches ${R.cross.toFixed(2)} px past the middle line`);
		if (R.inOther) bad.push('a point of one pad is inside the other');
		if (Math.max(R.moved.auto, R.moved.turbo) > 22 - 4) bad.push('a key\'s center is not well inside its pad');
		if (R.press.auto < 43.99 || R.press.turbo < 43.99) bad.push(`press Auto ${r1(R.press.auto)}, Turbo ${r1(R.press.turbo)}`);
		// (Auto's and Turbo's own lines only: a long window outside his range may list Menu or the Fast Lane, section 3)
		if (R.problems.some((x) => /^(auto|turbo) press region/.test(x))) bad.push(R.problems.filter((x) => /^(auto|turbo) press region/.test(x)).join(', '));
		return bad.length ? bad.join('; ') : null;
	};
	// a. his windows
	for (const o of ['portrait', 'phone']) {
		for (const r of L.PHONE_PLACES[o]) {
			const R = read(o, r.vw, r.vh);
			const bad = short(R);
			line(
				!bad,
				`${r.vw}x${r.vh} Auto and Turbo each hold a whole 44 px press circle, ${L.PAD.gap} px or more from every other press region`,
				`${bad ? bad + ' | ' : ''}pads moved ${R.moved.auto.toFixed(2)} and ${R.moved.turbo.toFixed(2)} px from the keys' centers; the least room: ${R.least[0]} ${R.least[1].toFixed(2)} px; to the Play ${R.gaps['auto pad to play'].toFixed(2)} and ${R.gaps['turbo pad to play'].toFixed(2)}, to < ${Math.min(R.gaps['auto pad to <'], R.gaps['turbo pad to <']).toFixed(1)}, to > ${Math.min(R.gaps['auto pad to >'], R.gaps['turbo pad to >']).toFixed(1)}, to the window's edge ${R.edge.toFixed(2)}`,
			);
		}
	}
	// b. every sideways phone from 568 x 320 to 932 x 430
	{
		let n = 0;
		let movedMost = { v: 0, at: '' };
		let playLeast = { v: Infinity, at: '' };
		let arrowLeast = { v: Infinity, at: '' };
		let padLeast = { v: Infinity, at: '' };
		const bad = [];
		const splits = [];
		for (let vh = 320; vh <= 430; vh += 10)
			for (let vw = 568; vw <= 932; vw += 4) {
				if (vw / vh < 1.5 || vw / vh > 2.34) continue;
				const R = read('phone', vw, vh);
				n++;
				const b = short(R);
				if (R.split) splits.push(`${vw}x${vh}`);
				if (b) bad.push(`${vw}x${vh}: ${b}`);
				const m = Math.max(R.moved.auto, R.moved.turbo);
				if (m > movedMost.v) movedMost = { v: m, at: `${vw}x${vh}` };
				const pl = Math.min(R.gaps['auto pad to play'], R.gaps['turbo pad to play']);
				if (pl < playLeast.v) playLeast = { v: pl, at: `${vw}x${vh}` };
				const ar = Math.min(R.gaps['auto pad to <'], R.gaps['turbo pad to <'], R.gaps['auto pad to >'], R.gaps['turbo pad to >']);
				if (ar < arrowLeast.v) arrowLeast = { v: ar, at: `${vw}x${vh}` };
				if (R.gaps['auto pad to turbo pad'] < padLeast.v) padLeast = { v: R.gaps['auto pad to turbo pad'], at: `${vw}x${vh}` };
			}
		line(
			bad.length === 0,
			`sideways phones 568x320 to 932x430 (${n} windows, the width by 4 px, the height by 10 px): at every one Auto's and Turbo's pads are whole 44 px circles ${L.PAD.gap} px or more from each other, the Play's diamond and the arrows' boxes, no point of one inside the other, each on its own side of the middle line`,
			`${bad.slice(0, 5).join(' | ')}${bad.length ? ` (${bad.length} windows) | ` : ''}the pads' least gap ${padLeast.v.toFixed(2)} px (${padLeast.at}); to the Play ${playLeast.v.toFixed(2)} px at the least (${playLeast.at}); to an arrow's box ${arrowLeast.v.toFixed(1)} px (${arrowLeast.at}); a pad moved ${movedMost.v.toFixed(2)} px at the most (${movedMost.at}); the pads share their ground at ${splits.length ? splits.join(', ') : 'no window'}`,
		);
	}
	// c. the mini player
	const S = read('phone', 400, 225);
	line(S.moved.auto === 0 && S.moved.turbo === 0 && S.split && !S.inOther && S.cross <= -L.PAD.gap / 2 + 0.05, 'Popout S (400x225, a mouse window): the pads are on the keys\' centers and share their ground down the middle line (neither covers the other)', `the pads ${S.gaps['auto pad to turbo pad'].toFixed(2)} px apart; press Auto ${r1(S.press.auto)}, Turbo ${r1(S.press.turbo)}; listed: ${S.problems.join('; ') || 'none'}`);
}
// ---- 5. WHOSE PRESS IS IT, OF AUTO AND TURBO (2026-11-23, signLayout.ts pressOwner; the rule: where the two DRAWN keys
// overlap, the one drawn on top; outside that, the key whose drawing or pad the place is in; anywhere else, neither).
// The keys are drawn as diamonds, and Turbo is drawn after Auto. The probe host's tap at 844 x 390 (750.1, 162.5), in
// both keys' upright boxes, turned Turbo on: by the drawn shapes it is in neither key and neither pad.
//   a. the two drawn diamonds never overlap: at his nine phone windows and the 836 sideways windows of section 4
//      (their boxes do); were they to, the place is Turbo's (two made up overlapping keys)
//   b. 844 x 390: his tap is nobody's; each key's middle and each pad's ground is its own
//   c. along the line through the two pads' middles, at every window: Auto's, then nobody's or the edge, then
//      Turbo's, never Turbo's on Auto's side of the middle line by more than the slack, nor Auto's on Turbo's ----
{
	const setup = (kind, vw, vh) => {
		const { g, seat } = at(kind, vw, vh);
		const boxes = { play: g.box.play, auto: g.box.auto, turbo: g.box.turbo, menu: g.box.menu, bonus: g.box.bonus, down: seat.down, up: seat.up };
		const pads = L.padShapes(boxes, vw, vh);
		const mid = (b) => [b.x + b.w / 2, b.y + b.h / 2];
		const own = (p) => L.pressOwner(boxes, pads, p);
		const gap = L.shapeGap(L.shapeOf('auto', boxes.auto), L.shapeOf('turbo', boxes.turbo));
		const boxesMeet = boxes.auto.x < boxes.turbo.x + boxes.turbo.w && boxes.turbo.x < boxes.auto.x + boxes.auto.w && boxes.auto.y < boxes.turbo.y + boxes.turbo.h && boxes.turbo.y < boxes.auto.y + boxes.auto.h;
		// the line through the two pads' middles, every 0.5 px from 24 px before Auto's to 24 px past Turbo's
		const a = pads.auto.c;
		const t = pads.turbo.c;
		const d = Math.hypot(t[0] - a[0], t[1] - a[1]);
		const n = [(t[0] - a[0]) / d, (t[1] - a[1]) / d];
		let wrong = null;
		let bare = 0;
		for (let v = -24; v <= d + 24; v += 0.5) {
			const q = [a[0] + n[0] * v, a[1] + n[1] * v];
			const o = own(q);
			const s = v - d / 2;
			if (o === null && v > 0 && v < d) bare += 0.5;
			if ((o === 'turbo' && s < -L.PRESS_SLACK - 0.01) || (o === 'auto' && s > L.PRESS_SLACK + 0.01)) wrong ??= `${vw}x${vh}: ${Math.abs(s).toFixed(1)} px on ${s < 0 ? "Auto's" : "Turbo's"} side is ${o}'s`;
		}
		const mine = own(mid(boxes.auto)) === 'auto' && own(mid(boxes.turbo)) === 'turbo' && own(a) === 'auto' && own(t) === 'turbo';
		return { boxes, pads, own, gap, boxesMeet, wrong, bare, mine, d };
	};
	// a + c: his windows and the sideways sweep
	let least = { v: Infinity, at: '' };
	let meet = 0;
	let n = 0;
	const bad = [];
	const each = (kind, vw, vh) => {
		const R = setup(kind, vw, vh);
		n++;
		if (R.boxesMeet) meet++;
		if (R.gap < least.v) least = { v: R.gap, at: `${vw}x${vh}` };
		if (R.gap <= 0) bad.push(`${vw}x${vh}: the two drawn diamonds overlap`);
		if (R.wrong) bad.push(R.wrong);
		if (!R.mine) bad.push(`${vw}x${vh}: a key's or a pad's middle is not its own`);
	};
	for (const o of ['portrait', 'phone']) for (const r of L.PHONE_PLACES[o]) each(o, r.vw, r.vh);
	for (let vh = 320; vh <= 430; vh += 10) for (let vw = 568; vw <= 932; vw += 4) if (vw / vh >= 1.5 && vw / vh <= 2.34) each('phone', vw, vh);
	line(bad.length === 0, `Auto and Turbo at ${n} windows (his nine and the sideways sweep): the two drawn diamonds never overlap, each key's and each pad's middle is its own, and along the line through the pads no place on one key's side of the middle line is the other's`, `${bad.slice(0, 4).join(' | ')}${bad.length ? ' | ' : ''}the diamonds' least gap ${least.v.toFixed(2)} px (${least.at}); their upright boxes overlap at ${meet} of the ${n} windows (a box takes no press: only the diamond and the pad do)`);
	// b: the probe host's tap
	{
		const R = setup('phone', 844, 390);
		const tap = [750.1, 162.5];
		const dA = L.shapeGap([tap, tap, tap], L.shapeOf('auto', R.boxes.auto));
		const dT = L.shapeGap([tap, tap, tap], L.shapeOf('turbo', R.boxes.turbo));
		const pA = Math.hypot(tap[0] - R.pads.auto.c[0], tap[1] - R.pads.auto.c[1]) - 22;
		const pT = Math.hypot(tap[0] - R.pads.turbo.c[0], tap[1] - R.pads.turbo.c[1]) - 22;
		line(R.own(tap) === null && dA > L.PRESS_SLACK && dT > L.PRESS_SLACK && pA > L.PRESS_SLACK && pT > L.PRESS_SLACK, "844x390: the probe host's tap at (750.1, 162.5) is in neither drawn key and neither pad, so it is nobody's press", `owner ${R.own(tap)}; ${dA.toFixed(1)} px outside Auto's diamond, ${dT.toFixed(1)} px outside Turbo's; ${pA.toFixed(1)} px outside Auto's pad, ${pT.toFixed(1)} px outside Turbo's; the diamonds ${R.gap.toFixed(1)} px apart; ${R.bare.toFixed(1)} px of bare ground on the line between the pads' middles (${R.d.toFixed(1)} px apart)`);
	}
	// a: two made up keys whose diamonds overlap: the place in both is Turbo's (drawn after Auto, so on top)
	{
		const boxes = { auto: { x: 100, y: 100, w: 60, h: 60 }, turbo: { x: 130, y: 100, w: 60, h: 60 } };
		const both = [145, 130];
		const inBoth = L.shapeGap([both, both, both], L.shapeOf('auto', boxes.auto)) === 0 && L.shapeGap([both, both, both], L.shapeOf('turbo', boxes.turbo)) === 0;
		line(inBoth && L.pressOwner(boxes, {}, both) === 'turbo' && L.pressOwner(boxes, {}, [112, 130]) === 'auto' && L.pressOwner(boxes, {}, [178, 130]) === 'turbo' && L.pressOwner(boxes, {}, [145, 60]) === null, 'two made up keys whose drawn diamonds overlap: a place in both is Turbo\'s (drawn on top), a place in one only is that key\'s, a place in neither is nobody\'s');
	}
}
// ---- 6. A ROUND STARTS ONLY FROM THE PLAY'S OWN DIAMOND (2026-11-23; the probe host, touch, 844 x 390 and 667 x 375:
// a tap 2 px inside Turbo's edge nearest the Play started a round. Corey on accidental plays: "like stealing in my
// eyes"). A browser hands a touch to a nearby button by upright boxes and paint order; the bar judges a click by
// where the pointer went down (pressOwner) and acts by pressVerdict. At every layout (the desktop sizes, the 836
// sideways windows, his five upright windows and an upright sweep):
//   a. the Play's drawn diamond shares no ground with Auto's or Turbo's diamond or pad, either arrow's press box, the
//      amount, Menu or the Fast Lane (so no place is both the Play's and another control's)
//   b. on the line from each of Auto's, Turbo's and the two arrows' middles to the Play's middle, every 0.5 px: the
//      ground is that control's, then other controls' or nobody's, then the Play's, in that order only; 2 px inside
//      the control's edge it is the control's, 2 px inside the Play's edge it is the Play's
//   c. the verdicts: a click the Play got for a place that is Turbo's, Auto's or an arrow's is passed to that control
//      (no round); for nobody's place nothing; a click another control got for a place in the Play's diamond does
//      nothing (the Play is never passed a press); only the Play's own click on its own ground acts
//   d. the probe host's three places are Turbo's: 844 x 390 (755.8, 196.9), 667 x 375 (623.7, 194.9), 1200 x 675
//      (1145.4, 428.2) ----
{
	const setup = (kind, vw, vh) => {
		const { g, seat } = at(kind, vw, vh);
		const boxes = { play: g.box.play, auto: g.box.auto, turbo: g.box.turbo, menu: g.box.menu, bonus: g.box.bonus, down: seat.down, up: seat.up, amt: seat.amt };
		const pads = { ...L.padShapes(boxes, vw, vh) };
		if (g.box.bonus.h < 44) pads.bonus = { poly: L.padCircle([g.box.bonus.x + g.box.bonus.w / 2, g.box.bonus.y + g.box.bonus.h / 2]) };
		return { g, boxes, pads, own: (q) => L.pressOwner(boxes, pads, q) };
	};
	const mid = (b) => [b.x + b.w / 2, b.y + b.h / 2];
	const inBox = (q, b) => q[0] >= b.x && q[0] <= b.x + b.w && q[1] >= b.y && q[1] <= b.y + b.h;
	const bad = [];
	let n = 0;
	let least = { v: Infinity, at: '' };
	const inPlayBox = { auto: 0, turbo: 0, down: 0, up: 0 };
	const each = (kind, vw, vh) => {
		const R = setup(kind, vw, vh);
		n++;
		const play = L.shapeOf('play', R.boxes.play);
		// a. no shared ground
		for (const id of ['auto', 'turbo', 'down', 'up', 'amt', 'menu', 'bonus']) {
			const gap = L.shapeGap(play, L.shapeOf(id, R.boxes[id]));
			if (gap < least.v) least = { v: gap, at: `${vw}x${vh} ${id}` };
			if (gap <= 0) bad.push(`${vw}x${vh}: the Play's diamond meets ${id}`);
		}
		for (const id of ['auto', 'turbo', 'bonus']) {
			if (!R.pads[id]) continue;
			const gap = L.shapeGap(play, R.pads[id].poly);
			if (gap < least.v) least = { v: gap, at: `${vw}x${vh} ${id}'s pad` };
			if (gap <= 0) bad.push(`${vw}x${vh}: the Play's diamond meets ${id}'s pad`);
		}
		// b. the walks
		for (const id of ['auto', 'turbo', 'down', 'up']) {
			const a = mid(R.boxes[id]);
			const b = mid(R.boxes.play);
			const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
			const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
			const owners = [];
			for (let v = 0; v <= len; v += 0.5) owners.push(R.own([a[0] + u[0] * v, a[1] + u[1] * v]));
			let last = -1;
			while (last + 1 < owners.length && owners[last + 1] === id) last++;
			const first = owners.indexOf('play');
			const afterPlay = first < 0 ? ['none'] : owners.slice(first).filter((o) => o !== 'play');
			const between = first < 0 ? [] : owners.slice(last + 1, first).filter((o) => o === id || o === 'play');
			if (last < 4 || first < 0 || afterPlay.length || between.length) {
				bad.push(`${vw}x${vh}: from ${id} to the Play the ground is not ${id}'s, then others' or nobody's, then the Play's`);
				continue;
			}
			const qk = [a[0] + u[0] * (last / 2 - 2), a[1] + u[1] * (last / 2 - 2)];
			const qp = [a[0] + u[0] * (first / 2 + 2), a[1] + u[1] * (first / 2 + 2)];
			if (R.own(qk) !== id || R.own(qp) !== 'play') bad.push(`${vw}x${vh}: 2 px inside ${id}'s edge is ${R.own(qk)}'s, 2 px inside the Play's is ${R.own(qp)}'s`);
			if (L.pressVerdict('play', R.own(qk)) !== 'pass' || L.pressVerdict(id, R.own(qp)) !== 'none') bad.push(`${vw}x${vh}: the verdict at ${id}'s edge or the Play's is wrong`);
			// (where the browser's own choice is at risk: the control's edge place lies inside the Play button's upright box)
			if (inBox(qk, R.boxes.play)) inPlayBox[id]++;
		}
	};
	for (const [vw, vh] of [[1920, 1080], [1200, 675], [1024, 576], [1280, 720], [1366, 768], [1440, 900], [2560, 1440], [2560, 1080], [3440, 1440], [1280, 800], [1024, 768], [800, 450]]) each('landscape', vw, vh);
	const desk = n;
	for (let vh = 320; vh <= 430; vh += 10) for (let vw = 568; vw <= 932; vw += 4) if (vw / vh >= 1.5 && vw / vh <= 2.34) each('phone', vw, vh);
	const side = n - desk;
	for (const r of L.PHONE_PLACES.portrait) each('portrait', r.vw, r.vh);
	for (let vw = 320; vw <= 430; vw += 10) for (let k = 1.6; k <= 2.2001; k += 0.05) each('portrait', vw, Math.round(vw * k));
	line(bad.length === 0, `the Play and its neighbours at ${n} windows (${desk} desktop, ${side} sideways, ${n - desk - side} upright): the Play's diamond shares no ground with any other control or pad; from Auto, Turbo and each arrow to the Play the ground is the control's, then others' or nobody's, then the Play's; a click the Play gets for a neighbour's place is passed to the neighbour, never a round`, `${bad.slice(0, 4).join(' | ')}${bad.length ? ` (${bad.length}) | ` : ''}the Play's diamond is ${least.v.toFixed(2)} px from the nearest other press shape at the least (${least.at}); the neighbour's edge place lies inside the Play button's upright box (where a browser may hand the touch to the Play) at ${inPlayBox.turbo} windows for Turbo, ${inPlayBox.auto} for Auto, ${inPlayBox.down} for <, ${inPlayBox.up} for >`);
	// c. the verdicts
	{
		const V = L.pressVerdict;
		const others = ['auto', 'turbo', 'down', 'up', 'amt', 'menu', 'bonus'];
		line(V('play', 'play') === 'own' && others.every((o) => V('play', o) === 'pass' && V(o, 'play') === 'none' && V(o, o) === 'own' && V(o, null) === 'none') && V('play', null) === 'none' && V('turbo', 'auto') === 'pass', 'the verdicts: only the Play\'s own click on its own ground starts a round; a click the Play got for another control\'s place is that control\'s; the Play is never passed a press; nobody\'s place does nothing');
	}
	// d. the probe host's places
	{
		const A = setup('phone', 844, 390).own([755.8, 196.9]);
		const B = setup('phone', 667, 375).own([623.7, 194.9]);
		const C = setup('landscape', 1200, 675).own([1145.4, 428.2]);
		line(A === 'turbo' && B === 'turbo' && C === 'turbo', "the probe host's three places 2 px inside Turbo's edge nearest the Play are Turbo's (so the Play passes the press on, and no round starts)", `844x390 (755.8, 196.9): ${A}; 667x375 (623.7, 194.9): ${B}; 1200x675 (1145.4, 428.2): ${C}; in the Play's upright box: ${inBox([755.8, 196.9], setup('phone', 844, 390).boxes.play)}, ${inBox([623.7, 194.9], setup('phone', 667, 375).boxes.play)}, ${inBox([1145.4, 428.2], setup('landscape', 1200, 675).boxes.play)}`);
	}
}
// ---- 7. WHAT THE RULE NAMES A CONTROL'S GROUND IS COVERED BY SOMETHING THAT TAKES THE PRESS (2026-11-23; the probe
// host on b32bacde: owner() named places a key's where only the canvas lay: the Play's top corner on the desktop, Auto's
// bottom corner at 568 x 320, Menu's bottom edge at 390 x 844). The rule's shapes were sharp diamonds with 1.5 px of
// slack; the buttons are turned squares with ROUND corners. Now the rule's shapes are the buttons' own (pressShape),
// there is no slack, and every control's shape is drawn once more as a catch outline under the controls.
//   a. the shapes' numbers are the theme's and the stylesheet's own (read from the source files), and the buttons are
//      sized from the same two functions (keyHit, playHit)
//   b. at every window (the 1009 of section 6): on a grid over every control's ground, each place the rule gives a
//      control lies inside that control's catch outline or its pad (what the page draws for it), and a place the rule
//      gives the Play lies inside the Play's own round cornered diamond; the round cornered shapes lie inside the sharp
//      ones the layout's clearances are measured with
//   c. the probe host's three places ----
{
	const src = (rel) => readFileSync(join(APP, 'src', ...rel.split('/')), 'utf8');
	const theme = src('ui/hudTheme.ts');
	const css = src('ui/sign/sign.css');
	const draw = src('ui/sign/signDraw.ts');
	const hud = src('ui/sign/SignHud.svelte');
	const play = src('ui/sign/SignPlay.svelte');
	const key = src('ui/sign/SignKey.svelte');
	const num = (text, re) => {
		const m = text.match(re);
		return m ? Number(m[1]) : NaN;
	};
	const T = {
		V: num(theme, /play:\s*\{\s*V:\s*([\d.]+)/),
		R: num(theme, /play:\s*\{\s*V:\s*[\d.]+,\s*R:\s*([\d.]+)/),
		bw: num(theme, /key:\s*\{\s*bw:\s*([\d.]+)/),
		ko: num(theme, /key:\s*\{[^}]*\bko:\s*([\d.]+)/),
		margin: num(theme, /key:\s*\{[^}]*\bmargin:\s*([\d.]+)/),
		corner: num(theme, /key:\s*\{[^}]*\bcorner:\s*([\d.]+)/),
		menu: num(css.slice(css.indexOf('.hudp.sg .sgm,')), /border-radius:\s*calc\(var\(--s\)\s*\*\s*([\d.]+)\)/),
		menuS: num(hud, /style:--s="\{B\.menu\.h \/ ([\d.]+)\}px"/),
	};
	const same = T.V === L.PLAY_LINE.V && T.R === L.PLAY_LINE.R && T.bw === L.KEY_LINE.bw && T.ko === L.KEY_LINE.ko && T.margin === L.KEY_LINE.margin && T.corner === L.KEY_LINE.corner && Math.abs(T.menu / T.menuS - L.MENU_CORNER) < 1e-9;
	const wired = /const hit = keyHit\(w\);/.test(draw) && /PLAY_HIT = \{ side: playHit\(1\)\.side, r: playHit\(1\)\.r \}/.test(draw) && /style:border-radius="\{PLAY_HIT\.r \* d\}px"/.test(play) && /PLAY_HIT\.side \* d/.test(play) && /style:width="\{frame\.hit\.side\}px"/.test(key) && /style:border-radius="\{frame\.hit\.r\}px"/.test(key) && /class="sgcatch" data-catch=\{c\.id\}/.test(hud);
	line(same && wired, "the press shapes' numbers are the theme's and the stylesheet's own, the Play's and the keys' buttons are sized from the layout file's two functions, and the bar draws a catch outline for every control", `theme and stylesheet: ${JSON.stringify(T)}; layout: ${JSON.stringify({ ...L.PLAY_LINE, ...L.KEY_LINE, menu: L.MENU_CORNER })}`);

	const inP = (p, P) => {
		let c = false;
		for (let i = 0, j = P.length - 1; i < P.length; j = i++) if (P[i][1] > p[1] !== P[j][1] > p[1] && p[0] < ((P[j][0] - P[i][0]) * (p[1] - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
		return c;
	};
	const setup = (kind, vw, vh) => {
		const { g, seat } = at(kind, vw, vh);
		const boxes = { play: g.box.play, auto: g.box.auto, turbo: g.box.turbo, menu: g.box.menu, bonus: g.box.bonus, down: seat.down, up: seat.up, amt: seat.amt };
		const pads = { ...L.padShapes(boxes, vw, vh) };
		if (g.box.bonus.h < 44) pads.bonus = { poly: L.padCircle([g.box.bonus.x + g.box.bonus.w / 2, g.box.bonus.y + g.box.bonus.h / 2]) };
		return { g, boxes, pads, own: (q) => L.pressOwner(boxes, pads, q) };
	};
	const bad = [];
	let n = 0;
	let places = 0;
	let owned = 0;
	let tip = { v: 0, at: '' };
	const each = (kind, vw, vh, step) => {
		const R = setup(kind, vw, vh);
		n++;
		// what the page draws to take each control's presses: its catch outline (its own press shape) and its pad
		const taking = Object.fromEntries(Object.keys(R.boxes).map((id) => [id, [L.pressShape(id, R.boxes[id]), ...(R.pads[id] ? [R.pads[id].poly] : [])]]));
		const playShape = L.pressShape('play', R.boxes.play);
		for (const id of ['play', 'auto', 'turbo']) {
			const sharp = L.shapeOf(id, R.boxes[id]);
			// (a key's keyline stands a little outside the sharp diamond the clearances use, 0.6 px on a phone: its round
			// cornered square within 1.2 % of its box's width of it; the Play's inside it)
			const out = Math.max(...L.pressShape(id, R.boxes[id]).map((q) => (inP(q, sharp) ? 0 : Math.min(...sharp.map((a, i) => { const b = sharp[(i + 1) % 4]; const dx = b[0] - a[0]; const dy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dy * t); })))));
			if (out > (id === 'play' ? 0.01 : 0.012 * R.boxes[id].w)) bad.push(`${vw}x${vh}: ${id}'s press shape reaches ${out.toFixed(2)} px past its sharp diamond`);
		}
		const top = R.boxes.play.y + R.boxes.play.h / 2 - Math.min(...playShape.map((q) => q[1]));
		const sharpTop = (R.boxes.play.w / 2) * L.PLAY_V;
		if (sharpTop - top > tip.v) tip = { v: sharpTop - top, at: `${vw}x${vh}` };
		for (const id of Object.keys(R.boxes)) {
			const xs = taking[id].flat().map((q) => q[0]);
			const ys = taking[id].flat().map((q) => q[1]);
			for (let y = Math.min(...ys) - 3; y <= Math.max(...ys) + 3; y += step)
				for (let x = Math.min(...xs) - 3; x <= Math.max(...xs) + 3; x += step) {
					places++;
					const o = R.own([x, y]);
					if (!o) continue;
					owned++;
					if (!taking[o].some((P) => inP([x, y], P))) bad.push(`${vw}x${vh}: (${x.toFixed(1)}, ${y.toFixed(1)}) is ${o}'s and nothing of ${o}'s covers it`);
					if (o === 'play' && !inP([x, y], playShape)) bad.push(`${vw}x${vh}: (${x.toFixed(1)}, ${y.toFixed(1)}) is the Play's outside its diamond`);
				}
		}
	};
	for (const [vw, vh] of [[1920, 1080], [1200, 675], [1024, 576], [1280, 720], [1366, 768], [1440, 900], [2560, 1440], [2560, 1080], [3440, 1440], [1280, 800], [1024, 768], [800, 450]]) each('landscape', vw, vh, 2);
	for (const o of ['portrait', 'phone']) for (const r of L.PHONE_PLACES[o]) each(o, r.vw, r.vh, 1.5);
	for (let vh = 320; vh <= 430; vh += 10) for (let vw = 568; vw <= 932; vw += 4) if (vw / vh >= 1.5 && vw / vh <= 2.34) each('phone', vw, vh, 3);
	for (let vw = 320; vw <= 430; vw += 10) for (let k = 1.6; k <= 2.2001; k += 0.05) each('portrait', vw, Math.round(vw * k), 3);
	line(bad.length === 0, `at ${n} windows, ${owned} places the rule gives a control (of ${places} tried round every control): each lies inside that control's own catch outline or pad, and a place that is the Play's lies inside the Play's round cornered diamond`, `${bad.slice(0, 4).join(' | ')}${bad.length ? ` (${bad.length}) | ` : ''}the Play's round top corner ends ${tip.v.toFixed(2)} px short of the sharp diamond's at the most (${tip.at})`);
	// c. the probe host's places
	{
		const d = setup('landscape', 1200, 675);
		const a = setup('phone', 568, 320);
		const m = setup('portrait', 390, 844);
		const pc = [d.boxes.play.x + d.boxes.play.w / 2, d.boxes.play.y + d.boxes.play.h / 2];
		const q = [1112.1, 420.4];
		const len = Math.hypot(q[0] - pc[0], q[1] - pc[1]);
		const u = [(q[0] - pc[0]) / len, (q[1] - pc[1]) / len];
		let reach = 0;
		for (let v = 0; v < 120; v += 0.05) if (d.own([pc[0] + u[0] * v, pc[1] + u[1] * v]) === 'play') reach = v;
		const sharp = ((d.boxes.play.w / 2) * L.PLAY_V) / (Math.abs(u[0]) + Math.abs(u[1]));
		const oa = a.own([513.1, 146.1]);
		const om = m.own([324.8, 139.5]);
		const od = d.own(q);
		line(od === null && reach < len && om === 'menu', "the probe host's places: 1200x675 (1112.1, 420.4) is past the Play's round corner (nobody's: the drawn Play ends before it); 390x844 (324.8, 139.5) is Menu's and Menu's catch outline covers it", `1200x675: owner ${od}; the place is ${len.toFixed(1)} px from the Play's middle, the Play's ground on that line ends at ${reach.toFixed(1)} px (its round corner; the sharp diamond's would at ${sharp.toFixed(1)}) | 568x320 (513.1, 146.1): owner ${oa} (Auto's round bottom corner and its moved pad) | 390x844: owner ${om}, Menu's box ends at y ${(m.boxes.menu.y + m.boxes.menu.h).toFixed(1)}`);
	}
}
for (const [vw, vh] of [[1920, 1080], [1200, 675], [1024, 576], [1280, 720], [1366, 768], [1440, 900], [2560, 1440], [2560, 1080], [3440, 1440], [1280, 800], [1024, 768]]) {
	const { g, problems, zones, seat } = at('landscape', vw, vh);
	line(problems.length === 0, `desktop ${vw}x${vh}`, `${problems.join('; ') || 'clear'} | strip ${r1(zones.strip.h)} px tall, ${r1(g.box.win.y - 8 * g.rs.win * g.u - zones.strip.y - zones.strip.h)} px over the Win box | < > ${r1(seat.down.w)} px | amount ${r1(seat.px)} px`);
}
{
	const S = await import(pathToFileURL(join(APP, 'src', 'game', 'layoutSpec.ts')).href);
	line(S.MASTER.portrait.width === L.PORTRAIT_MASTER.w && S.MASTER.portrait.height === L.PORTRAIT_MASTER.h, "the layout file's upright master is the game's (layoutSpec MASTER.portrait)");
}
// ---- SKIP TO RESULT upright: on Menu's row, to Menu's left (Corey 2026-11-22), clear of the logo, the board and the top line ----
for (const [vw, vh, his] of [[425, 812, true], [375, 667, true], [320, 568, true], [390, 844, true], [390, 620, true], [360, 640, false], [393, 852, false], [412, 915, false], [430, 932, false]]) {
	const { g, zones } = at('portrait', vw, vh);
	const b = L.skipBox(g);
	const m = g.box.menu;
	const topLine = L.topLine(vw, vh); // the clock strip's lower edge
	const bad = [];
	const s = L.shapeOf('menu', b);
	if (Math.abs(b.y - m.y) > 0.01 || Math.abs(b.h - m.h) > 0.01) bad.push('not on Menu\'s row at Menu\'s height');
	if (b.x + b.w > m.x - L.SKIP_PLACE.gap * g.u + 0.01) bad.push('not clear of Menu');
	if (b.x < 0 || b.w < L.SKIP_PLACE.w * g.u - 0.01) bad.push('cut by the window\'s left edge');
	if (L.onZone(s, zones.board)) bad.push('on the board');
	if (zones.logo && L.onZone(s, zones.logo)) bad.push('on the logo');
	if (b.y < topLine - 0.5) bad.push(`over the top line (${r1(b.y)} against ${r1(topLine)})`);
	if (his && Math.min(b.w, b.h) < 43.95) bad.push(`press area ${r1(Math.min(b.w, b.h))}`);
	line(bad.length === 0, `${vw}x${vh} SKIP TO RESULT left of Menu`, `${bad.join('; ') || 'clear'} | box ${r1(b.x)}, ${r1(b.y)}, ${r1(b.w)} x ${r1(b.h)} | Menu from ${r1(m.x)} | logo to ${zones.logo ? r1(zones.logo.x + zones.logo.w) : '-'}, ${zones.logo ? r1(zones.logo.y) : '-'} down | top line ${r1(topLine)}`);
}
// ---- BALANCE AND WIN ALWAYS FIT: every window, the nine currencies, an everyday and a very long amount ----
// The game's own formatter writes each amount; its width is the bundled Overpass 900's advances with every digit a 0
// wide (tools/amount_fit_metrics.json), as the page measures it. For each readout: its room is inside the window and
// clear of the scene and of the row's neighbors (readoutRoom), and the number, at the size the step rule gives, is no
// wider than the room less its pad. Listed: the smallest type reached, and where a long amount goes past the 50 % floor.
{
	const state = await import(STATE_URL);
	state.setLocale('en');
	const cur = await import(pathToFileURL(join(APP, 'src', 'game', 'currency.ts')).href);
	const M = JSON.parse(readFileSync(join(APP, 'tools', 'amount_fit_metrics.json'), 'utf8'));
	const adv = M.faces['Overpass|900'];
	const emOf = (t) => [...t].reduce((a, ch) => a + (adv[/\d/.test(ch) ? '0' : ch] ?? M.missing), 0);
	const CODES = ['USD', 'EUR', 'CAD', 'MXN', 'JPY', 'USDT', 'BTC', 'XSC', 'XGC'];
	const amounts = (code) => [10000, code === 'XGC' ? 1e9 : 1e7];
	const windows = [...L.PHONE_PLACES.portrait.map((r) => ['portrait', r.vw, r.vh]), ...L.PHONE_PLACES.phone.map((r) => ['phone', r.vw, r.vh]), ['phone', 800, 450], ['landscape', 1920, 1080], ['landscape', 1200, 675], ['landscape', 1024, 576], ['landscape', 1440, 900], ['landscape', 2560, 1080]];
	const bad = [];
	const rows = [];
	for (const [kind, vw, vh] of windows) {
		const zones = Z.signZones(kind, vw, vh, kind !== 'landscape');
		const g = L.signLayout({ kind, vw, vh, zones });
		const least = { bal: [99, ''], win: [99, ''] };
		const under = [];
		for (const id of ['bal', 'win']) {
			const room = L.readoutRoom(g, id, zones);
			const b = g.box[id];
			const s = [[room.x, b.y], [room.x + room.w, b.y], [room.x + room.w, b.y + b.h], [room.x, b.y + b.h]];
			if (room.x < -0.01 || room.x + room.w > vw + 0.01) bad.push(`${vw}x${vh} ${id}: its room leaves the window (${r1(room.x)} to ${r1(room.x + room.w)})`);
			if (room.w < 40 * g.u) bad.push(`${vw}x${vh} ${id}: a room of ${r1(room.w)} px`);
			for (const z of [zones.board, zones.strip, zones.logo]) if (z && L.onZone(s, z)) bad.push(`${vw}x${vh} ${id}: its room is on a zone`);
			for (const o of ['play', 'auto', 'turbo']) if (L.shapeGap(s, L.shapeOf(o, g.box[o])) === 0) bad.push(`${vw}x${vh} ${id}: its room meets ${o}`);
			const nominal = (id === 'bal' ? 21 : 26) * g.rs[id] * g.u;
			for (const code of CODES) {
				state.stateBet.currency = code;
				for (const a of amounts(code)) {
					const t = cur.numberToCurrencyString(a, { fixed: true });
					const full = emOf(t) * nominal;
					const f = L.readoutFit(g, id, zones, undefined, emOf(t));
					// the number as drawn (from his left edge, or about his center) is inside its room
					const x0 = g.just[id] === 'left' ? b.x : b.x + b.w / 2 - (full * f.k) / 2;
					if (x0 < room.x - 0.01 || x0 + full * f.k > room.x + room.w + 0.01 || full * f.k > f.limit + 0.01 || f.box !== b) bad.push(`${vw}x${vh} ${id} ${t}: ${r1(x0)} to ${r1(x0 + full * f.k)} in ${r1(room.x)} to ${r1(room.x + room.w)}`);
					if (nominal * f.k < least[id][0]) least[id] = [nominal * f.k, t];
					if (f.under) under.push(`${id} ${t} ${r1(nominal * f.k)} px`);
				}
			}
		}
		rows.push(`     ${vw}x${vh}: Balance from ${r1(21 * g.rs.bal * g.u)} px down to ${r1(least.bal[0])} (${least.bal[1]}) | Win from ${r1(26 * g.rs.win * g.u)} down to ${r1(least.win[0])} (${least.win[1]})${under.length ? ` | past the floor: ${under.length} (${under[0]})` : ''}`);
		if (vw === 568 && vh === 320) {
			state.stateBet.currency = 'BTC';
			const room = L.readoutRoom(g, 'bal', zones);
			for (const a of [1000, 10000, 1e7]) {
				const t = cur.numberToCurrencyString(a, { fixed: true });
				const f = L.readoutFit(g, 'bal', zones, undefined, emOf(t));
				rows.push(`       568x320 BTC, ${t}: ${r1(21 * g.rs.bal * g.u * f.k)} px (${Math.round(f.k * 100)} %), room ${r1(room.x)} to ${r1(room.x + room.w)} of 568`);
			}
		}
	}
	// AN ORDINARY AMOUNT CHANGES NOTHING (2026-11-22, the probe host at 1920 x 1080 on e5db525d): with an everyday balance
	// or win in USD the readout's box is his box itself and its number is at its nominal size, at every window; and
	// every piece's box is the box 0d30b1b8 laid out, to the last digit (that commit's layout file, read from git)
	{
		state.stateBet.currency = 'USD';
		const moved = [];
		for (const [kind, vw, vh] of windows) {
			const zones = Z.signZones(kind, vw, vh, kind !== 'landscape');
			const g = L.signLayout({ kind, vw, vh, zones });
			for (const [id, amounts] of [['bal', [1000, 10000]], ['win', [12.4, 1234.5]]])
				for (const a of amounts) {
					const t = cur.numberToCurrencyString(a, { fixed: true });
					const f = L.readoutFit(g, id, zones, undefined, emOf(t));
					if (f.box !== g.box[id] || f.k !== 1 || f.under || Math.abs(f.px - (id === 'bal' ? 21 : 26) * g.rs[id] * g.u) > 1e-9) moved.push(`${vw}x${vh} ${id} ${t}: ${Math.round(f.k * 100)} %`);
				}
		}
		line(moved.length === 0, `an ordinary balance and win (USD) change nothing: his box, the nominal size, at ${windows.length} windows`, moved.slice(0, 5).join(' | '));
		let old = null;
		try {
			const src = execFileSync('git', ['-C', APP, 'show', '0d30b1b8:apps/run_over_reindeer/src/ui/sign/signLayout.ts'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
			const tmp = join(mkdtempSync(join(tmpdir(), 'signlayout-')), 'signLayout_0d30b1b8.ts');
			writeFileSync(tmp, src);
			old = await import(pathToFileURL(tmp).href);
		} catch {
			console.log('     (0d30b1b8 is not in this checkout: the comparison with its layout file is passed over)');
		}
		if (old) {
			const off = [];
			for (const [kind, vw, vh] of windows) {
				const zones = Z.signZones(kind, vw, vh, kind !== 'landscape');
				const a = L.signLayout({ kind, vw, vh, zones });
				const b = old.signLayout({ kind, vw, vh, zones });
				for (const id of L.PIECES) for (const k of ['x', 'y', 'w', 'h']) if (a.box[id][k] !== b.box[id][k]) off.push(`${vw}x${vh} ${id}.${k}: ${b.box[id][k]} to ${a.box[id][k]}`);
			}
			line(off.length === 0, `every piece's box is 0d30b1b8's, to the last digit, at ${windows.length} windows`, off.slice(0, 5).join(' | '));
		}
	}
	line(bad.length === 0, `Balance and Win fit their rooms: ${windows.length} windows x 9 currencies x an everyday and a very long amount (10,000,000.000000 BTC, 1,000,000,000.00 GC), every room inside the window and clear of the scene and the diamonds`, bad.slice(0, 5).join(' | '));
	for (const r of rows) console.log(r);
}
// the safe areas (a real iPhone): nothing under the home indicator, nothing in a notch side, his places kept where clear
{
	const a = at('portrait', 390, 844, { t: 47, r: 0, b: 34, l: 0 });
	const b = at('phone', 844, 390, { t: 0, r: 44, b: 21, l: 44 });
	line(a.g.moved.length === 0 && a.problems.length === 0, '390x844 with a 34 px home indicator: his places already clear it', a.g.moved.join('; ') + a.problems.join('; '));
	const lows = [...L.PIECES.map((id) => b.g.box[id]), b.seat.down, b.seat.up].map((q) => q.y + q.h);
	line(b.problems.length === 0, '844x390 with 44 px notch sides and a 21 px home indicator', `${b.g.moved.join('; ') || 'nothing moved'} | ${b.problems.join('; ') || 'clear'} | lowest edge ${r1(Math.max(...lows))} of 390`);
}
console.log(`${fail} fail`);
process.exit(fail ? 1 : 0);
