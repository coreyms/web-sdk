// @ts-nocheck: a node check script, not app code (svelte-check picks up .mjs files)
// THE FACE SCREEN, NODE ONLY (constants LED_SIGN.face, game/landing/ledScreens.ts screenFace, game/ledWildsSpec.ts face;
// Corey's pick 2026-11-21, led_intro_face_screen_r2_2026-11-21). No browser: the game's own modules are imported as they
// are (the press screen's layout and script are pure functions of their numbers) and judged:
//   - THE ORDER: the cycle is face, win, sleigh, car (LED_SIGN.face.position 'first')
//   - THE SCRIPT, sampled every 5 ms over the screen's 3.9 s: ONE REINDEER. lands at land1 and TWO GRUDGES. at land2 (each
//     dropping dropDots into place), the snort's four puff frames from `snort` (the last fading), the ears 5, 12, 5 from
//     `flick`, the glance at Santa (his side) from glanceAt held glanceHoldS, glare for `between`, the glance at Grandma as
//     long, the blink (half, closed, half) blinkAfter later, then glare to the end
//   - THE SHEET'S SPEC: every patch and puff on both tiers with its place (the mock's own lids and puffs gone since
//     Corey approved the built look, 2026-11-21), every patch's rectangle inside the face, the eyes' patches on their own
//     side of the face's middle
//   - THE LAYOUT on the four boards the mock judged (desktop 362 x 203, upright phone 259 x 189, sideways phone 243 x 126,
//     upright tablet 555 x 299, each with the snow rows it measured): the line inside the board above the snow, the text
//     scale the mock's auto picks, the face over the line, every puff box inside the board and above the line, the two
//     pictures placed (Santa left, Grandma right, the same height, at most sizeCap of the board) and clear of the line,
//     of each other, of the puffs' boxes and of the board's edge
//   - THE BAKE ON THE DOT BOARD (2026-11-21, the probe host's led_board_probe on 48d852ca: puff_n1 lit 1 to 3 LEDs on the
//     nose's rim at 1920 x 1080, 768 x 1024, 1440 x 900 @2 and 390 x 844 @3; the ear patches 95 and 99 levels off at the
//     sideways phone at one LED per dot), done as the board does it, with the game's own functions for every place and
//     rectangle (ledScreens.ts facePuffLeds, faceRimLeds, faceLedBox, patchCut, patchInset), on every probe board at the
//     device scales the probe runs it (the press section at 1, its extra boards at their own) and LEDs per dot 1, 1.5,
//     2 and 3, and on a SWEEP of every face size from 120 to 469 dots across (both tiers, both parities of the face's
//     corner on the finer grid):
//       PUFFS    each puff frame (its alpha as decoded from the shipped sheet: tools/led_face_check_data.json, written by
//                tools/build_led_wilds.py) baked as ledScreens.ts art() bakes it (halved while over 1.6 times twice the
//                size, then drawn to its LEDs; a triangle filter as wide as the step, which reproduces the host's counts
//                3, 1 and 3, 2 exactly), mirrored for the right nostril, its LEDs at alpha 70 or over (the LED punch)
//                counted in the rim's boxes: none allowed
//       PATCHES  every pixel the game puts in (the patch frame's inside) followed through the face's bake chain: no LED on
//                a side of the patch's cut that JOINS the face may be reached by any of them (so the join is exact in
//                any browser, whatever its filter does under the 2 levels the probe allows); `spare` the same with the
//                cut one LED tighter
//       SEQUENCE the layout of one board unchanged after other boards and the other tier were laid out (no cached state
//                carried between sizes)
//   node --experimental-strip-types --no-warnings tools/led_face_check.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

// (the game's modules import each other without extensions, as vite resolves them: try .ts)
register(
	'data:text/javascript,' +
		encodeURIComponent(`export async function resolve(s, c, next) {
	try { return await next(s, c); } catch (e) {
		if ((s.startsWith('./') || s.startsWith('../')) && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c);
		throw e;
	}
}`),
	import.meta.url,
);

const { LED_SIGN } = await import('../src/game/constants.ts');
const { LED_WILDS } = await import('../src/game/ledWildsSpec.ts');
const L = await import('../src/game/landing/ledScreens.ts');

let pass = 0;
let fail = 0;
const check = (ok, msg, info) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${ok || info === undefined ? '' : '  ' + JSON.stringify(info).slice(0, 600)}`);
};
const F = LED_SIGN.face;
const S = F.script;

// ---- the order ----
check(JSON.stringify(L.SCREEN_NAMES) === JSON.stringify(['face', 'win', 'sleigh', 'car']) && L.SCREENS.length === 4, `the cycle: ${L.SCREEN_NAMES.join(' > ')} (${L.SCREENS.length} screens; the face first, LED_SIGN.face.position ${F.position})`);

// ---- the script ----
const santa = F.pics.santaSide === 'left' ? 'gaze_l' : 'gaze_r';
const grandma = santa === 'gaze_l' ? 'gaze_r' : 'gaze_l';
const samples = [];
for (let ms = 0; ms <= 3900; ms += 5) samples.push({ t: ms / 1000, p: L.facePoseAt(ms / 1000) });
/** the first and last sample time where `f` holds (ms), or null */
const when = (f) => {
	const hit = samples.filter((x) => f(x.p));
	return hit.length ? [Math.round(hit[0].t * 1000), Math.round(hit[hit.length - 1].t * 1000)] : null;
};
const near = (v, want, tol = 6) => v !== null && v !== undefined && Math.abs(v - want) <= tol;
const ms = (s) => Math.round(s * 1000);
const show1 = when((p) => p.show[0]);
const show2 = when((p) => p.show[1]);
check(near(show1?.[0], ms(S.land1)) && near(show2?.[0], ms(S.land2)) && show1[1] === 3900 && show2[1] === 3900, `the line: ONE REINDEER. lands at ${show1?.[0]} ms (${ms(S.land1)}), TWO GRUDGES. at ${show2?.[0]} ms (${ms(S.land2)}), both up to the end`);
// (a sentence's drop while it shows: from dropDots above its place at its landing to its place dropS later)
const drop = [0, 1].map((i) => samples.filter((x) => x.p.show[i] && x.p.drop[i] > 0));
const land = [S.land1, S.land2];
check([0, 1].every((i) => drop[i].length > 0 && drop[i][0].p.drop[i] === S.dropDots && near(ms(drop[i][0].t), ms(land[i])) && drop[i].every((x) => x.t < land[i] + S.dropS)), `each sentence drops ${S.dropDots} dots into place over ${ms(S.dropS)} ms (ONE REINDEER. ${drop[0].map((x) => x.p.drop[0]).join('')} from ${ms(drop[0][0]?.t ?? 0)} ms, TWO GRUDGES. from ${ms(drop[1][0]?.t ?? 0)} ms)`);
const puffs = [0, 1, 2, 3].map((i) => when((p) => p.puff?.i === i));
const PT = F.puffTiming;
check(near(puffs[0]?.[0], ms(S.snort)) && near(puffs[1]?.[0], ms(S.snort + PT.frames[0])) && near(puffs[2]?.[0], ms(S.snort + PT.frames[1])) && near(puffs[3]?.[0], ms(S.snort + PT.frames[2])) && near(puffs[3]?.[1], ms(S.snort + PT.fadeToS)), `the snort: puff frames from ${puffs.map((x) => x?.[0]).join(', ')} ms, the last to ${puffs[3]?.[1]} ms (${ms(S.snort)}, ${ms(S.snort + PT.frames[0])}, ${ms(S.snort + PT.frames[1])}, ${ms(S.snort + PT.frames[2])}; to ${ms(S.snort + PT.fadeToS)})`);
const fade = samples.filter((x) => x.p.puff?.i === 3).map((x) => x.p.puff.alpha);
check(fade.length > 2 && fade.every((a, i) => !i || a <= fade[i - 1]) && fade[0] === 1 && fade[fade.length - 1] < 0.1, `the last puff fades out (alpha ${fade[0]} to ${fade[fade.length - 1]?.toFixed(2)}, never rising)`);
// (frame 1 hands over to frame 2 by a cross fade over blendS centred on the change: both drawn, their alphas summing to 1)
const bl = samples.filter((x) => x.p.puff?.also);
const b2 = PT.blendS / 2;
check(PT.blendS > 0 ? bl.length > 0 && bl.every((x) => [x.p.puff.i, x.p.puff.also.i].sort().join() === '1,2' && Math.abs(x.p.puff.alpha + x.p.puff.also.alpha - 1) < 1e-9 && x.t >= S.snort + PT.frames[1] - b2 - 1e-9 && x.t < S.snort + PT.frames[1] + b2) : bl.length === 0, `the breath crosses the rim by a cross fade: frames 1 and 2 together for ${bl.length} samples from ${ms(bl[0]?.t ?? 0)} to ${ms(bl[bl.length - 1]?.t ?? 0)} ms (blendS ${ms(PT.blendS)} ms about ${ms(S.snort + PT.frames[1])})`);
const E = F.flickTiming;
const e5 = when((p) => p.earL === 5 && p.earR === 5);
const e12 = when((p) => p.earL === 12 && p.earR === 12);
check(near(e5?.[0], ms(S.flick)) && near(e12?.[0], ms(S.flick + E.upS)) && near(e12?.[1], ms(S.flick + E.downS) - 5) && near(e5?.[1], ms(S.flick + E.totalS) - 5) && samples.every((x) => x.p.earL === x.p.earR), `the ears flick together with the snort: 5 degrees from ${e5?.[0]} ms, 12 from ${e12?.[0]} to ${e12?.[1]} ms, back to rest after ${e5?.[1]} ms`);
const gs = when((p) => p.eye === santa);
const gg = when((p) => p.eye === grandma);
const hold = F.glanceHoldS;
check(near(gs?.[0], ms(S.glanceAt)) && near(gs?.[1], ms(S.glanceAt + hold) - 5), `the glance at Santa (${santa}, his side ${F.pics.santaSide}) from ${gs?.[0]} to ${gs?.[1]} ms (${ms(S.glanceAt)}, held ${ms(hold)})`);
check(near(gg?.[0], ms(S.glanceAt + hold + S.between)) && near(gg?.[1], ms(S.glanceAt + 2 * hold + S.between) - 5), `then glare ${ms(S.between)} ms and the glance at Grandma (${grandma}) from ${gg?.[0]} to ${gg?.[1]} ms`);
const B = F.blinkTiming;
const b0 = S.glanceAt + 2 * hold + S.between + S.blinkAfter;
const half = when((p) => p.eye === 'half');
const closed = when((p) => p.eye === 'closed');
check(near(half?.[0], ms(b0)) && near(closed?.[0], ms(b0 + B.halfS)) && near(closed?.[1], ms(b0 + B.openS) - 5) && near(half?.[1], ms(b0 + B.totalS) - 5), `the blink ${ms(S.blinkAfter)} ms after: half from ${half?.[0]} ms, closed ${closed?.[0]} to ${closed?.[1]} ms, half to ${half?.[1]} ms`);
const order = [];
for (const x of samples) if (order[order.length - 1] !== x.p.note) order.push(x.p.note);
const want = ['glare', 'snort', 'glare', 'glance at Santa', 'glare', 'glance at Grandma', 'glare', 'blink', 'glare'];
check(JSON.stringify(order) === JSON.stringify(want) && samples.filter((x) => x.t >= b0 + B.totalS).every((x) => x.p.note === 'glare'), `the beats in order: ${order.join(' > ')}`);

// ---- the sheet's spec ----
const FS = LED_WILDS.face;
const names = Object.keys(FS.patches);
const PUFFS = Array.isArray(FS.puffs) ? FS.puffs : FS.puffs.nostril;
const wantPatches = ['gaze_l', 'gaze_r', 'half', 'closed'].flatMap((s) => ['l', 'r'].map((e) => `eye_${e}_${s}`)).concat(['l', 'r'].flatMap((e) => [5, 12].map((d) => `ear_${e}_${d}`)));
check(wantPatches.every((n) => names.includes(n)) && names.length === wantPatches.length, `the spec holds ${names.length} patches: the glances, the furred lids, the ears (the mock's lids gone)`, names);
for (const tier of ['full', 'phone']) {
	const T = LED_WILDS.tiers[tier];
	const pf = PUFFS.map((p) => p.frame);
	const missing = [...names.filter((n) => !T.frames[n]?.w || !T.facePlaces[n]), ...pf.filter((n) => !T.frames[n]?.w), ...(T.frames.face?.w ? [] : ['face'])];
	check(missing.length === 0, `${tier} tier: the face, every patch with its place and every puff on the sheet (${T.width} x ${T.height}, ${T.kb} KB)`, missing);
	const face = T.frames.face;
	const out = names.filter((n) => {
		const [x, y] = T.facePlaces[n];
		const f = T.frames[n];
		return x < 0 || y < 0 || x + f.w > face.w || y + f.h > face.h;
	});
	check(out.length === 0, `${tier} tier: every patch's place keeps it inside the face frame (${face.w} x ${face.h})`, out);
}
const sideBad = names.filter((n) => {
	const r = FS.patches[n];
	if (!(r[0] >= 0 && r[1] >= 0 && r[2] <= 1 && r[3] <= 1 && r[2] > r[0] && r[3] > r[1])) return true;
	if (n.startsWith('eye_l')) return r[2] > FS.nose + 0.01;
	if (n.startsWith('eye_r')) return r[0] < FS.nose - 0.01;
	return false;
});
check(sideBad.length === 0, `every patch's rectangle is inside the face, each eye's on its own side of the nose's middle (${FS.nose})`, sideBad);
check(Array.isArray(FS.puffs) && PUFFS.length === 4 && FS.rim.length > 10 && !Object.keys(LED_WILDS.tiers.full.frames).some((n) => /^puff_\d$|_mock$/.test(n)), `the puffs: 4 frames out of the nostrils (the mock's set gone from both sheets); the nose's rim as ${FS.rim.length} boxes`);
// (the nostril puffs' first frame sits on the nostril; each later frame further out and down, and bigger)
const N = PUFFS;
const cx = (p) => p.x + p.w / 2;
const cy = (p) => p.y + p.h / 2;
const [nx, ny] = FS.nostril;
check(Math.abs(cx(N[0]) - nx) < 0.02 && Math.abs(cy(N[0]) - ny) < 0.03 && N.every((p, i) => !i || (cx(p) <= cx(N[i - 1]) && p.w > N[i - 1].w)) && N.slice(1).every((p) => cy(p) > ny), `the breath leaves the nostril (${nx.toFixed(3)}, ${ny.toFixed(3)}): frame 0 on it (${cx(N[0]).toFixed(3)}, ${cy(N[0]).toFixed(3)}), then out and down, growing (${N.map((p) => `${cx(p).toFixed(3)},${cy(p).toFixed(3)} w ${p.w.toFixed(3)}`).join('; ')})`);

// ---- the layout on the mock's four boards ----
const text = { win: { top: '', num: '' }, sleigh: { head: '', body: '', mult: '' }, car: { head: '', body: '', mult: '' }, face: { head: LED_SIGN.text.faceHead, body: LED_SIGN.text.faceBody }, ticker: '' };
const BOARDS = [
	{ name: 'desktop', W: 362, H: 203, snow: 4.47, tier: 'full', want: [2, 1] },
	{ name: 'upright phone', W: 259, H: 189, snow: 7.16, tier: 'phone', want: [2, 2] },
	{ name: 'sideways phone', W: 243, H: 126, snow: 4.74, tier: 'phone', want: [2, 2] },
	{ name: 'upright tablet', W: 555, H: 299, snow: 8.56, tier: 'full', want: [2, 1] },
];
const overlap = (a, b, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
const W5 = (s) => s.replace(/\s+/g, ' ');
for (const b of BOARDS) {
	L.setLedWildArt({ image: null, frames: LED_WILDS.tiers[b.tier].frames }, b.tier);
	L.setFaceClear(b.snow);
	const lay = L.faceLayoutFor(b.W, b.H, text);
	const rows = lay.beats.flat();
	const foot = Math.max(4, Math.ceil(b.snow) + 2);
	const rowBox = rows.map((r) => ({ x: r.x, y: r.y - S.dropDots, w: L.textW(r.text, r.s), h: 7 * r.s + S.dropDots }));
	const inBoard = rowBox.every((r) => r.x >= 3 && r.x + r.w <= b.W - 3 && r.y >= 0 && r.y + r.h <= b.H - foot);
	check(inBoard && lay.textScale === b.want[0] && lay.rows === b.want[1] && W5(rows.map((r) => r.text).join(' ')) === 'ONE REINDEER. TWO GRUDGES.', `${b.name} ${b.W} x ${b.H}: the line at scale ${lay.textScale} on ${lay.rows} row(s) (the mock's auto: ${b.want.join(', ')}), inside the board above its last ${foot} rows`, { rows, foot });
	const top = Math.min(...rows.map((r) => r.y));
	check(lay.face.y + lay.face.h <= top - 3 + 1 && lay.clip.y >= 3 && lay.face.x >= 0 && lay.face.x + lay.face.w <= b.W, `${b.name}: the face ${lay.face.w} x ${lay.face.h} dots at ${lay.face.x},${lay.face.y} over the line (its foot ${lay.face.y + lay.face.h}, the line from ${top})`, lay.face);
	const pr = lay.puffRects;
	check(pr.length === 8 && pr.every((p) => p.x >= 0 && p.x + p.w <= b.W && p.y + p.h <= lay.area.y + lay.area.h), `${b.name}: the 8 puff boxes inside the board and above the line (the lowest at ${Math.max(...pr.map((p) => p.y + p.h))}, the face's area to ${lay.area.y + lay.area.h})`, pr);
	const pics = lay.pics;
	const ok = pics.length === 2 && pics[0].who === 'santa' && pics[0].side === 'left' && pics[1].who === 'grandma' && pics[1].side === 'right' && pics[0].h === pics[1].h && pics[0].h <= Math.max(F.pics.minDots, Math.round(F.pics.sizeCap * b.H));
	const clear = pics.every((p) => p.x >= F.pics.edgeDots && p.x + p.w <= b.W - F.pics.edgeDots && p.y + p.h <= b.H - foot && !rowBox.some((r) => overlap(p, r, 1)) && !pr.some((q) => overlap(p, q, 1))) && pics.length === 2 && !overlap(pics[0], pics[1]);
	check(ok && clear, `${b.name}: Santa ${pics[0] ? `${pics[0].w} x ${pics[0].h} at ${pics[0].x},${pics[0].y}` : 'none'}, Grandma ${pics[1] ? `${pics[1].w} x ${pics[1].h} at ${pics[1].x},${pics[1].y}` : 'none'} (cap ${Math.round(F.pics.sizeCap * b.H)}), clear of the line, the puffs, each other and the edge`, { pics, rows: rowBox });
	const patchOut = Object.entries(FS.patches).filter(([, r]) => {
		const x0 = lay.face.x + r[0] * lay.face.w;
		const x1 = lay.face.x + r[2] * lay.face.w;
		return x0 < lay.face.x - 0.01 || x1 > lay.face.x + lay.face.w + 0.01;
	});
	check(patchOut.length === 0, `${b.name}: every patch lands inside the face's box`, patchOut.map(([n]) => n));
}
// ---- THE BAKE ON THE DOT BOARD ----
// (the probe's boards: led_board_probe.mjs SIZES run the press section at device scale 1, WILD_GROW_EXTRA at its own
// `dpr`; the LEDs per dot there is scoreboard.ts ensureFaces' rule, ledGrid densityFor: 1.5 where the dot's pitch times the
// device scale over 1.5 is at least 2 CSS px, else 1. The board's dots and its face as the probe host read them on
// 48d852ca (scoreboard().press.face; the wide board's face solved from its puff boxes); the boards no read gave are left
// to the sweep, which holds every face size.)
// COPY OF the probe host's reads (led_board_probe faceScreenChecks records, 2026-11-21), dots
const PROBE_BOARDS = [
	{ name: 'desktop 1440x900 @1', face: { x: 37, y: 0, w: 288, h: 179 }, tier: 'full', k: 1 },
	{ name: 'wide 1920x1080 @1', face: { x: 38, y: 0, w: 287, h: 178 }, tier: 'full', k: 1.5 },
	{ name: 'side 844x390 @1', face: { x: 55, y: 2, w: 133, h: 82 }, tier: 'phone', k: 1 },
	{ name: 'portrait 390x844 @1', face: { x: 14, y: 1, w: 231, h: 143 }, tier: 'phone', k: 1 },
	{ name: 'tabletUp43 768x1024 @1', face: TABLET_UP43(), tier: 'full', k: 1 },
	{ name: 'desktop@2 1440x900', face: { x: 37, y: 0, w: 288, h: 179 }, tier: 'full', k: 1.5 },
	{ name: 'upright@3 390x844', face: { x: 14, y: 1, w: 231, h: 143 }, tier: 'phone', k: 1.5 },
	{ name: 'side@3 844x390', face: { x: 55, y: 2, w: 133, h: 82 }, tier: 'phone', k: 1.5 },
];
function TABLET_UP43() {
	return { x: 76, y: 3, w: 370, h: 229 };
}
const SWEEP_FROM = 120;
const DATA = JSON.parse(readFileSync(new URL('./led_face_check_data.json', import.meta.url), 'utf8'));
const alphaOf = (tier, frame) => {
	const p = DATA.tiers[tier].puffs[frame];
	return { w: p.w, h: p.h, a: new Uint8Array(inflateSync(Buffer.from(p.a, 'base64'))) };
};
/** one axis of a canvas drawImage with smoothing: out px i from source px [s0, s0 + sw) (clamped to it), a triangle as
 *  wide as the step (at least one source px) */
const wCache = new Map();
function weights(s0, sw, n) {
	const key = `${s0}|${sw}|${n}`;
	let W = wCache.get(key);
	if (W) return W;
	const scale = sw / n;
	const se = Math.max(1, scale);
	const lo = Math.floor(s0);
	const hi = Math.ceil(s0 + sw) - 1;
	W = [];
	for (let i = 0; i < n; i++) {
		const c = s0 + (i + 0.5) * scale - 0.5;
		const js = [];
		const ws = [];
		let sum = 0;
		for (let j = Math.floor(c - se) - 1; j <= Math.ceil(c + se) + 1; j++) {
			const w = Math.max(0, 1 - Math.abs(j - c) / se);
			if (w <= 0) continue;
			js.push(Math.min(hi, Math.max(lo, j)));
			ws.push(w);
			sum += w;
		}
		W.push({ js, ws: ws.map((w) => w / sum) });
	}
	wCache.set(key, W);
	return W;
}
/** a one channel picture (w x h, Float64Array) drawn to dw x dh */
function resample(img, w, h, sw, sh, dw, dh) {
	const Wy = weights(0, sh, dh);
	const Wx = weights(0, sw, dw);
	const t = new Float64Array(dh * w);
	for (let y = 0; y < dh; y++) for (let q = 0; q < Wy[y].js.length; q++) {
		const r = Wy[y].js[q] * w;
		const wy = Wy[y].ws[q];
		for (let x = 0; x < w; x++) t[y * w + x] += img[r + x] * wy;
	}
	const o = new Float64Array(dw * dh);
	for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
		let v = 0;
		for (let q = 0; q < Wx[x].js.length; q++) v += t[y * w + Wx[x].js[q]] * Wx[x].ws[q];
		o[y * dw + x] = v;
	}
	return o;
}
/** ledScreens.ts art()'s size steps: halved (rounded) while both halves are at least 1.6 times the target */
function chain(sw, sh, dw, dh) {
	const steps = [];
	while (sw / 2 >= dw * 1.6 && sh / 2 >= dh * 1.6) {
		const tw = Math.round(sw / 2);
		const th = Math.round(sh / 2);
		steps.push([sw, sh, tw, th]);
		sw = tw;
		sh = th;
	}
	steps.push([sw, sh, dw, dh]);
	return steps;
}
/** a picture's alpha baked to dw x dh LEDs as art() bakes it (each step an 8 bit canvas), before the LED punch */
function bakeAlpha(p, dw, dh) {
	let cur = Float64Array.from(p.a);
	let w = p.w;
	let h = p.h;
	for (const [sw, sh, tw, th] of chain(p.w, p.h, dw, dh)) {
		cur = resample(cur, w, h, sw, sh, tw, th).map((v) => Math.round(v));
		w = tw;
		h = th;
	}
	return cur;
}
/** one axis's reach through the face's bake chain: 1 on [a, b) of n source px, carried to the LEDs (no rounding: wider) */
function reach1(n, a, b, steps, axis) {
	let cur = new Float64Array(n);
	for (let i = Math.max(0, a); i < Math.min(n, b); i++) cur[i] = 1;
	for (const s of steps) {
		const [src, dst] = axis === 'x' ? [s[0], s[2]] : [s[1], s[3]];
		const W = weights(0, src, dst);
		const o = new Float64Array(dst);
		for (let i = 0; i < dst; i++) for (let q = 0; q < W[i].js.length; q++) o[i] += cur[W[i].js[q]] * W[i].ws[q];
		cur = o;
	}
	return cur;
}
const PUFF_DATA = {};
for (const tier of ['full', 'phone']) for (const p of PUFFS) PUFF_DATA[`${tier}:${p.frame}`] = alphaOf(tier, p.frame);
/** a face's puffs on the dot board: each frame and side's LED box and its lit LEDs in the rim's boxes */
function puffsOnRim(face, k, tier) {
	const area = { x: 0, y: 0, w: 1e6, h: face.y + face.h };
	const rim = L.faceRimLeds(face, k);
	const out = [];
	for (let i = 0; i < PUFFS.length; i++)
		for (const side of ['l', 'r']) {
			const led = L.facePuffLeds(face, area, k, i, side);
			const p = PUFF_DATA[`${tier}:${PUFFS[i].frame}`];
			const a = bakeAlpha(p, led.w, led.h);
			let n = 0;
			let faint = 0;
			for (const r of rim) {
				const x0 = Math.max(r.x, led.x);
				const y0 = Math.max(r.y, led.y);
				const x1 = Math.min(r.x + r.w, led.x + led.w);
				const y1 = Math.min(r.y + r.h, led.y + led.h);
				for (let yy = y0; yy < y1; yy++)
					for (let xx = x0; xx < x1; xx++) {
						const sx = side === 'r' ? led.w - 1 - (xx - led.x) : xx - led.x;
						const v = a[(yy - led.y) * led.w + sx];
						if (v >= 70) n++;
						if (v >= 20) faint++;
					}
			}
			out.push({ frame: PUFFS[i].frame, side, led, onRim: n, faint });
		}
	return { puffs: out, rim };
}
/** a face's patches: each cut's joining border LEDs reached by the pixels put in (count, at pad and one LED tighter) */
function patchJoins(face, k, tier) {
	const T = LED_WILDS.tiers[tier];
	const ff = T.frames.face;
	const B = L.faceLedBox(face, k);
	const steps = chain(ff.w, ff.h, B.w, B.h);
	const m = L.patchInset(ff.w);
	const out = [];
	for (const name of names) {
		const pf = T.frames[name];
		const [px, py] = T.facePlaces[name];
		const rx = reach1(ff.w, px + m, px + pf.w - m, steps, 'x');
		const ry = reach1(ff.h, py + m, py + pf.h - m, steps, 'y');
		const judge = (pad) => {
			const c = L.patchCut(FS.patches[name], B.w, B.h, pad);
			let hit = 0;
			let worst = null;
			for (let yy = c.y; yy < c.y + c.h; yy++)
				for (let xx = c.x; xx < c.x + c.w; xx++) {
					const side = (xx === c.x && c.joins.l ? 'l' : '') + (yy === c.y && c.joins.t ? 't' : '') + (xx === c.x + c.w - 1 && c.joins.r ? 'r' : '') + (yy === c.y + c.h - 1 && c.joins.b ? 'b' : '');
					if (!side) continue;
					const v = rx[xx] * ry[yy] * 255;
					if (v >= 0.5) {
						hit++;
						if (!worst || v > worst.v) worst = { x: xx, y: yy, side, v: Math.round(v * 10) / 10 };
					}
				}
			return { hit, worst, cut: c };
		};
		const at = judge(L.PATCH_PAD ?? 2);
		const tight = judge((L.PATCH_PAD ?? 2) - 1);
		out.push({ name, hit: at.hit, worst: at.worst, spare: tight.hit === 0, cut: at.cut });
	}
	return out;
}
function bakeChecks() {
	const keepTier = 'full';
	// (the probe's boards at the LEDs per dot they run at, and 1, 1.5, 2 and 3 on every one)
	for (const b of PROBE_BOARDS) {
		for (const k of [...new Set([b.k, 1, 1.5, 2, 3])]) {
			const tag = `${b.name}${k === b.k ? '' : ` (at ${k} LEDs per dot)`}`;
			L.setLedWildArt({ image: null, frames: LED_WILDS.tiers[b.tier].frames }, b.tier);
			const { puffs, rim } = puffsOnRim(b.face, k, b.tier);
			const lit = puffs.filter((q) => q.onRim > 0);
			if (k === b.k || lit.length) check(lit.length === 0, `${tag}: PUFFS: the ${puffs.length} puff draws (${b.tier} tier, face ${b.face.w} x ${b.face.h} dots at ${b.face.x},${b.face.y}, ${k} LEDs per dot) light no LED in the nose's rim (${rim.length} boxes)`, lit);
			const pj = patchJoins(b.face, k, b.tier);
			const bad = pj.filter((q) => q.hit > 0);
			if (k === b.k || bad.length) check(bad.length === 0, `${tag}: PATCHES: every patch's joining border LEDs untouched by what it puts in (${pj.length} patches; one LED spare on ${pj.filter((q) => q.spare).length})`, bad.map((q) => ({ name: q.name, hit: q.hit, worst: q.worst, cut: q.cut })));
		}
	}
	// THE SWEEP: every face size the layout can make, both tiers, the face's corner on both parities of the finer grid.
	// (From 120 dots: the smallest face the game lays out is the sideways phone's, 133 (its board is 243 dots across on
	// every phone, LED_SIGN.layout.phone's pitch being in master units); under about 120 a puff is 4 LEDs across and its
	// LED rounding alone can touch the rim.)
	const sweepBad = { puffs: [], patches: [] };
	let draws = 0;
	let cuts = 0;
	let faint = 0;
	for (const tier of ['full', 'phone']) {
		L.setLedWildArt({ image: null, frames: LED_WILDS.tiers[tier].frames }, tier);
		const ff = LED_WILDS.tiers[tier].frames.face;
		for (let dw = SWEEP_FROM; dw < 470; dw++) {
			const dhs = [...new Set([-0.49, 0, 0.49].map((e) => Math.round((ff.h * (dw + e)) / ff.w)))];
			for (const dh of dhs)
				for (const k of [1, 1.5, 2, 3])
					for (const [ox, oy] of Number.isInteger(k) ? [[0, 0]] : [[0, 0], [1, 0], [0, 1], [1, 1]]) {
						const face = { x: 10 + ox, y: oy, w: dw, h: dh };
						const { puffs } = puffsOnRim(face, k, tier);
						draws += puffs.length;
						for (const q of puffs) faint += q.faint ? 1 : 0;
						for (const q of puffs) if (q.onRim) sweepBad.puffs.push({ tier, face, k, ...q });
						if (ox || oy) continue;
						const pj = patchJoins(face, k, tier);
						cuts += pj.length;
						for (const q of pj) if (q.hit) sweepBad.patches.push({ tier, face, k, name: q.name, hit: q.hit, worst: q.worst });
					}
		}
	}
	const byFrame = {};
	for (const q of sweepBad.puffs) byFrame[`${q.frame}${q.side}`] = (byFrame[`${q.frame}${q.side}`] ?? 0) + 1;
	check(sweepBad.puffs.length === 0, `SWEEP: PUFFS: ${draws} puff draws over every face from ${SWEEP_FROM} to 469 dots across (both tiers; 1, 1.5, 2 and 3 LEDs per dot), none lighting an LED in the nose's rim (${sweepBad.puffs.length} do: ${JSON.stringify(byFrame)}; the margin: ${faint} with any rim LED even at alpha 20 before the punch)`, sweepBad.puffs.slice(0, 4));
	const byPatch = {};
	for (const q of sweepBad.patches) byPatch[q.name] = (byPatch[q.name] ?? 0) + 1;
	check(sweepBad.patches.length === 0, `SWEEP: PATCHES: ${cuts} patch cuts, every joining border LED untouched by what the patch puts in (${sweepBad.patches.length} not: ${JSON.stringify(byPatch)})`, sweepBad.patches.slice(0, 4));
	// THE SEQUENCE: one board's layout and puff places the same after other boards and the other tier were laid out
	const seq = (tier, b) => {
		L.setLedWildArt({ image: null, frames: LED_WILDS.tiers[tier].frames }, tier);
		L.setFaceClear(b.snow);
		const lay = L.faceLayoutFor(b.W, b.H, text);
		return JSON.stringify({ face: lay.face, clip: lay.clip, pics: lay.pics, puffs: lay.puffRects, leds: [1, 1.5].map((k) => PUFFS.flatMap((_, i) => ['l', 'r'].map((s) => L.facePuffLeds(lay.face, lay.area, k, i, s)))), rim: L.faceRimLeds(lay.face, 1.5) });
	};
	const side = { W: 243, H: 126, snow: 4.74 };
	const fresh = seq('phone', side);
	for (const b of BOARDS) seq(b.tier === 'phone' ? 'full' : 'phone', b);
	seq('full', { W: 362, H: 203, snow: 4.47 });
	const again = seq('phone', side);
	check(fresh === again, `SEQUENCE: the sideways phone's face, clip, pictures, puff boxes (dots and LEDs) and rim are the same after the other boards and the other tier were laid out (nothing cached carries between sizes)`);
	L.setLedWildArt({ image: null, frames: LED_WILDS.tiers[keepTier].frames }, keepTier);
}
bakeChecks();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
