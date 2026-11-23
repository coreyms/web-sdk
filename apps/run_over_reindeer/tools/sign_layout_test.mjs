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
/** Auto's and Turbo's press circles where his own two keys stand closer than 44 px (never under his 37) */
const KNOWN = /^(auto|turbo) press region (3[7-9]|4[0-3])(\.\d)?$/;
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
		// (his own Auto and Turbo stand 37 px apart at 568 x 320 and 43.4 at 667 x 375, so their 44 px press circles share a
		// strip there: his placing, kept, and listed)
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
	const press = L.pressRegions({ play: g.box.play, auto: g.box.auto, turbo: g.box.turbo, menu: g.box.menu, bonus: g.box.bonus, down: seat.down, up: seat.up });
	const txt = `${problems.join('; ') || 'clear'} | press ${Object.entries(press).map(([k, v]) => `${k} ${r1(v)}`).join(', ')} | amount ${r1(seat.px)} px${seat.under ? ' (under the floor)' : ''}${g.moved.length ? ' | ' + g.moved.join('; ') : ''}`;
	if (must) line(problems.length === 0, `${name} (${vw}x${vh})`, txt);
	else console.log(`     ${name} (${vw}x${vh}), listed only: ${txt}`);
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
