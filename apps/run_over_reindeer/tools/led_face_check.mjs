// THE FACE SCREEN, NODE ONLY (constants LED_SIGN.face, game/landing/ledScreens.ts screenFace, game/ledWildsSpec.ts face;
// Corey's pick 2026-11-21, led_intro_face_screen_r2_2026-11-21). No browser: the game's own modules are imported as they
// are (the press screen's layout and script are pure functions of their numbers) and judged:
//   - THE ORDER: the cycle is face, win, sleigh, car (LED_SIGN.face.position 'first')
//   - THE SCRIPT, sampled every 5 ms over the screen's 3.9 s: ONE REINDEER. lands at land1 and TWO GRUDGES. at land2 (each
//     dropping dropDots into place), the snort's four puff frames from `snort` (the last fading), the ears 5, 12, 5 from
//     `flick`, the glance at Santa (his side) from glanceAt held glanceHoldS, glare for `between`, the glance at Grandma as
//     long, the blink (half, closed, half) blinkAfter later, then glare to the end
//   - THE SHEET'S SPEC: every patch (both lid looks) and puff (both sets) on both tiers with its place, every patch's
//     rectangle inside the face, the eyes' patches on their own side of the face's middle
//   - THE LAYOUT on the four boards the mock judged (desktop 362 x 203, upright phone 259 x 189, sideways phone 243 x 126,
//     upright tablet 555 x 299, each with the snow rows it measured): the line inside the board above the snow, the text
//     scale the mock's auto picks, the face over the line, every puff box inside the board and above the line, the two
//     pictures placed (Santa left, Grandma right, the same height, at most sizeCap of the board) and clear of the line,
//     of each other, of the puffs' boxes and of the board's edge
//   node --experimental-strip-types --no-warnings tools/led_face_check.mjs
import { register } from 'node:module';

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
const wantPatches = ['gaze_l', 'gaze_r', 'half', 'closed', 'half_mock', 'closed_mock'].flatMap((s) => ['l', 'r'].map((e) => `eye_${e}_${s}`)).concat(['l', 'r'].flatMap((e) => [5, 12].map((d) => `ear_${e}_${d}`)));
check(wantPatches.every((n) => names.includes(n)) && names.length === wantPatches.length, `the spec holds ${names.length} patches: the glances, both lid looks (fur and the mock's), the ears`, names);
for (const tier of ['full', 'phone']) {
	const T = LED_WILDS.tiers[tier];
	const pf = FS.puffs.nostril.concat(FS.puffs.mock).map((p) => p.frame);
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
check(FS.puffs.nostril.length === 4 && FS.puffs.mock.length === 4 && FS.rim.length > 10, `the puffs: 4 frames out of the nostrils and the mock's 4; the nose's rim as ${FS.rim.length} boxes`);
// (the nostril puffs' first frame sits on the nostril; each later frame further out and down, and bigger)
const N = FS.puffs.nostril;
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
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
