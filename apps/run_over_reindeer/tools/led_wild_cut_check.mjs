// @ts-nocheck: a node check script, not app code (svelte-check picks up .mjs files)
// THE STRIKE SCREENS' ROAD LINES AND WILD PICTURES, NODE ONLY (Corey 2026-11-21, on staging: "Can we remove these top and
// bottom gray lines, and not cut off Santa's Elbow? same on the wild, if zooming in I can see there is some cropping on the
// bottom and right sides of it on the LED screens"; game/landing/ledScreens.ts strikeLayout, strikeLanes, wildDrawRect,
// wildGrowPlan; game/ledWildsSpec.ts; tools/build_led_wild_sources.py and build_led_wilds.py). No browser: the game's own
// module is imported as it is and judged on the sleigh and car screens, on every board the probes run plus a sweep of
// board sizes, at 1, 1.5, 2 and 3 LEDs per dot, both sheet tiers:
//   ROAD      the lane lines as strikeLanes draws them (a recording canvas): no line on the road's two outer edges (the
//             solid gray rules), the dashed lines between the rows and the yellow middle line still drawn, nothing past
//             the lanes' end (on the wide boards the Wild's outer edge: no dash stub beside the frame)
//   CUT       the Wild picture as the board bakes it (its alpha as decoded from the shipped sheet, tools/
//             led_wild_cut_data.json, halved while over 1.6 times twice the size, then drawn to its LEDs, the LED punch at
//             alpha 70): no lit LED on the edge of its draw rectangle (a straight cut), every lit LED inside the board, and
//             none over the words beside or under it (one dot clear)
//   GROW      Santa's column growing from the struck cell (screenStrike's grow, every board frame at 30 fps plus fine
//             steps): each partial blit of wildGrowPlan, wherever its source rectangle cuts lit pixels that go on past
//             it, has the LEDs across that edge lit by another piece (the garland rows riding the edge; a cut is a run of
//             two or more LEDs along the edge, a lone LED being the fuzz's own lumpy outline; where the riding rows meet
//             the standing band in the side bands' outer fuzz, the outline's splice, they are counted apart); nothing of the
//             picture is cut by a straight edge in any frame. The grow's picture is the sheet's picture with the band
//             strip put in, as growSheet makes it.
// On a tip before the fix (no strikeLayout export) it runs the tip's own lanes() source and the old layout's copy, and
// reports what it finds there (it fails: the edge rules, the pictures cut at their edges).
//   node --experimental-strip-types --no-warnings tools/led_wild_cut_check.mjs     (DATA=<json> another sheet's alpha)
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

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
const LEGACY = typeof L.strikeLayout !== 'function';

let pass = 0;
let fail = 0;
const check = (ok, msg, info) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${ok || info === undefined ? '' : '  ' + JSON.stringify(info).slice(0, 700)}`);
};
if (LEGACY) console.log('NOTE: no strikeLayout in ledScreens.ts: the tip before the fix (its own lanes() source, the old layout copied)');

// ---- the words, as the game passes them (LED_SIGN.text) ----
const TX = LED_SIGN.text;
const text = {
	win: { top: '', num: '' },
	sleigh: { head: TX.sleighHead, body: TX.sleighBody, mult: TX.sleighMult, bodyScales: TX.sleighBodyScales },
	car: { head: TX.carHead, body: TX.carBody, mult: TX.carMult, bodyScales: TX.carBodyScales },
	face: { head: '', body: '' },
	ticker: '',
};

// ---- the layout (the game's; on the old tip a copy of its screenStrike lines) ----
function legacyLayout(W, H, kind) {
	// COPY OF ledScreens.ts screenStrike at wip/stage dba8b786 (the layout lines only)
	const tall = W / H < 1.7;
	let P;
	if (!tall) P = { x: 3, y: 3, w: Math.round(Math.max(W * 0.36, Math.min(W * 0.46, W - 166))), h: H - 6 };
	else P = { x: 3, y: 3, w: W - 6, h: Math.round(H * 0.54) - 10 };
	const NR = kind === 'sleigh' ? 4 : tall ? 2 : 3;
	const cellH = Math.max(6, Math.floor(P.h / NR));
	const cellW = Math.round(cellH * 1.45);
	const rowsTop = P.y + Math.floor((P.h - NR * cellH) / 2);
	const colX = P.x + P.w - cellW - (tall ? Math.round(P.w * 0.2) : 3);
	const th = cellH >= 22 ? 2 : 1;
	const row = kind === 'sleigh' ? 2 : 1;
	const cell = { x: colX, y: rowsTop + row * cellH, w: cellW, h: cellH };
	const o = (b) => ({ x: b.x - th, y: b.y - th, w: b.w + 2 * th, h: b.h + 2 * th });
	const final = kind === 'sleigh' ? o({ x: colX, y: rowsTop, w: cellW, h: NR * cellH }) : o(cell);
	return { tall, P, lay: { lines: [], h: 0 }, tx: P.x + P.w + 6, ty: H, tw: 0, NR, row, cellH, cellW, rowsTop, colX, th, cell, final, lanesFrom: P.x, lanesTo: P.x + P.w, pic: kind === 'sleigh' ? 'santa' : 'grandma' };
}
const layoutOf = (W, H, kind) => (LEGACY ? legacyLayout(W, H, kind) : L.strikeLayout(W, H, kind, text));
const drawRect = (pic, o) => (LEGACY ? { ...o } : L.wildDrawRect(pic, o));

// ---- the lanes, drawn on a recording canvas ----
let lanesFn = L.strikeLanes;
if (LEGACY) {
	// the tip's own lanes() (not exported there): its source, run with the board's own helpers
	const src = readFileSync(new URL('../src/game/landing/ledScreens.ts', import.meta.url), 'utf8');
	const a = src.indexOf('function lanes(');
	let depth = 0;
	let b = src.indexOf('{', a);
	for (let i = b; i < src.length; i++) {
		if (src[i] === '{') depth++;
		if (src[i] === '}' && --depth === 0) {
			b = i + 1;
			break;
		}
	}
	const body = src.slice(a, b).replace(/: Ctx|: Rect|: number/g, '');
	const G = await import('../src/game/scoreboard/ledGrid.ts');
	const old = new Function('kOf', 'ledN', 'fillP', `${body}; return lanes;`)(G.kOf, G.ledN, G.fillP);
	lanesFn = (g, x0, x1, rowsTop, cellH, NR) => old(g, { x: x0, y: 0, w: x1 - x0, h: 0 }, rowsTop, cellH, NR);
}
function recordLanes(lo, k) {
	const fills = [];
	const g = {
		canvas: { ledK: k },
		fillStyle: '',
		globalAlpha: 1,
		fillRect(x, y, w, h) {
			fills.push({ x: x * k, y: y * k, w: w * k, h: h * k, style: this.fillStyle });
		},
	};
	lanesFn(g, lo.lanesFrom, lo.lanesTo, lo.rowsTop, lo.cellH, lo.NR);
	return fills;
}

// ---- the bake (as led_face_check.mjs: ledScreens.ts art()'s chain, a triangle filter as wide as the step) ----
const DATA = JSON.parse(readFileSync(process.env.DATA || new URL('./led_wild_cut_data.json', import.meta.url), 'utf8'));
const alphaCache = new Map();
function alphaOf(tier, frame) {
	const key = `${tier}:${frame}`;
	if (alphaCache.has(key)) return alphaCache.get(key);
	const p = DATA.tiers[tier][frame];
	const v = p ? { w: p.w, h: p.h, a: new Uint8Array(inflateSync(Buffer.from(p.a, 'base64'))) } : null;
	alphaCache.set(key, v);
	return v;
}
/** the grow's picture: the sheet's picture with the band strip put in (ledScreens.ts growSheet) */
function growAlpha(tier, pic) {
	const key = `${tier}:${pic}~grow`;
	if (alphaCache.has(key)) return alphaCache.get(key);
	const f = alphaOf(tier, pic);
	const bf = alphaOf(tier, `${pic}_band`);
	const G = LED_WILDS.pictures[pic].band;
	let v = f;
	if (f && bf && G) {
		const a = Uint8Array.from(f.a);
		const bx = Math.round(G[0] * f.w);
		const by = Math.round(G[1] * f.h);
		const cx = Math.round((LED_WILDS.pictures[pic].bandClear ?? G[0]) * f.w);
		// (cleared from cx, then the strip drawn over: alpha over)
		for (let y = by; y < Math.min(f.h, by + bf.h); y++)
			for (let x = Math.min(bx, cx); x < f.w; x++) {
				const under = x >= cx ? 0 : a[y * f.w + x] / 255;
				const over = x >= bx && x - bx < bf.w ? bf.a[(y - by) * bf.w + (x - bx)] / 255 : 0;
				a[y * f.w + x] = Math.round((over + under * (1 - over)) * 255);
			}
		v = { w: f.w, h: f.h, a };
	}
	alphaCache.set(key, v);
	return v;
}
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
function resample(img, w, h, dw, dh) {
	const Wy = weights(0, h, dh);
	const Wx = weights(0, w, dw);
	const t = new Float64Array(dh * w);
	for (let y = 0; y < dh; y++)
		for (let q = 0; q < Wy[y].js.length; q++) {
			const r = Wy[y].js[q] * w;
			const wy = Wy[y].ws[q];
			for (let x = 0; x < w; x++) t[y * w + x] += img[r + x] * wy;
		}
	const o = new Float64Array(dw * dh);
	for (let y = 0; y < dh; y++)
		for (let x = 0; x < dw; x++) {
			let v = 0;
			for (let q = 0; q < Wx[x].js.length; q++) v += t[y * w + Wx[x].js[q]] * Wx[x].ws[q];
			o[y * dw + x] = Math.round(v);
		}
	return o;
}
const bakeCache = new Map();
/** the picture's lit LEDs (alpha 70 or over: the LED punch) at dw x dh LEDs, as a Uint8Array */
function bakeLit(p, key, dw, dh) {
	const k = `${key}|${dw}x${dh}`;
	if (bakeCache.has(k)) return bakeCache.get(k);
	let cur = Float64Array.from(p.a);
	let w = p.w;
	let h = p.h;
	while (w / 2 >= dw * 1.6 && h / 2 >= dh * 1.6) {
		const tw = Math.round(w / 2);
		const th = Math.round(h / 2);
		cur = resample(cur, w, h, tw, th);
		w = tw;
		h = th;
	}
	cur = resample(cur, w, h, dw, dh);
	const lit = new Uint8Array(dw * dh);
	for (let i = 0; i < lit.length; i++) lit[i] = cur[i] >= 70 ? 1 : 0;
	if (bakeCache.size > 400) bakeCache.clear();
	bakeCache.set(k, lit);
	return lit;
}

// ---- the boards ----
// (the probes' boards in dots: led_face_check BOARDS, the mock's four; then a sweep of heights at the tall and wide shapes
// the layouts make: the probe host's other boards fall in it)
const NAMED = [
	{ name: 'desktop', W: 362, H: 203, tier: 'full' },
	{ name: 'upright phone', W: 259, H: 189, tier: 'phone' },
	{ name: 'sideways phone', W: 243, H: 126, tier: 'phone' },
	{ name: 'upright tablet', W: 555, H: 299, tier: 'full' },
];
// (the smallest boards the game lays out: the sideways phone's 243 x 126 on the wide layout, the upright phone's 259 x
// 189 on the tall one (W / H under 1.7); the sweep starts a little under each: 110 dots tall wide, 170 tall)
const SWEEP = [];
for (let H = 110; H <= 330; H += 1)
	for (const a of [1.37, 1.55, 1.69, 1.72, 1.8, 1.95, 2.15]) {
		if (a < 1.7 && H < 170) continue;
		SWEEP.push({ name: `sweep ${Math.round(H * a)}x${H}`, W: Math.round(H * a), H, tier: H < 200 ? 'phone' : 'full' });
	}

/** the text's boxes (dots) as drawLayout lays them */
const textBoxes = (lo) =>
	lo.lay.lines.map((ln) => ({ x: lo.tall ? lo.tx + (lo.tw - ln.w) / 2 : lo.tx, y: lo.ty + ln.y, w: ln.w, h: ln.h }));

/** one board, one kind, one k, one tier: the findings */
function judge(b, kind, k, tier) {
	const lo = layoutOf(b.W, b.H, kind);
	const out = { road: [], cut: null, outside: 0, text: 0, grow: [] };
	// ROAD
	const fills = recordLanes(lo, k);
	const edgeYs = [Math.round(lo.rowsTop * k), Math.round((lo.rowsTop + lo.NR * lo.cellH) * k)];
	const edge = fills.filter((f) => edgeYs.includes(Math.round(f.y)));
	const inner = [];
	for (let r = 1; r < lo.NR; r++) inner.push(fills.filter((f) => Math.round(f.y) === Math.round((lo.rowsTop + r * lo.cellH) * k)).length);
	const past = fills.filter((f) => f.x + f.w > Math.round(lo.lanesTo * k) + 1e-6 || f.x < Math.round(lo.lanesFrom * k) - 1e-6);
	const stub = !lo.tall && !LEGACY ? fills.filter((f) => f.x + f.w > Math.round((lo.final.x + lo.final.w) * k) + 1e-6) : [];
	out.road = { edge: edge.length, inner, past: past.length + stub.length };
	// CUT: the standing picture
	const pic = lo.pic;
	const p = alphaOf(tier, pic);
	const D = drawRect(pic, lo.final);
	const dw = Math.max(1, Math.round(Math.max(1, Math.round(D.w)) * k));
	const dh = Math.max(1, Math.round(Math.max(1, Math.round(D.h)) * k));
	const lit = bakeLit(p, `${tier}:${pic}`, dw, dh);
	const X0 = Math.round(D.x * k);
	const Y0 = Math.round(D.y * k);
	let edgeLit = 0;
	const sides = new Set();
	for (let x = 0; x < dw; x++) {
		if (lit[x]) (edgeLit++, sides.add('top'));
		if (lit[(dh - 1) * dw + x]) (edgeLit++, sides.add('bottom'));
	}
	for (let y = 0; y < dh; y++) {
		if (lit[y * dw]) (edgeLit++, sides.add('left'));
		if (lit[y * dw + dw - 1]) (edgeLit++, sides.add('right'));
	}
	out.cut = { edgeLit, sides: [...sides], D, dw, dh };
	const BW = Math.round(b.W * k);
	const BH = Math.round(b.H * k);
	const tb = LEGACY ? [] : textBoxes(lo).map((t) => ({ x0: Math.round((t.x - 1) * k), y0: Math.round((t.y - 1) * k), x1: Math.round((t.x + t.w + 1) * k), y1: Math.round((t.y + t.h + 1) * k) }));
	for (let y = 0; y < dh; y++)
		for (let x = 0; x < dw; x++) {
			if (!lit[y * dw + x]) continue;
			const gx = X0 + x;
			const gy = Y0 + y;
			if (gx < 0 || gy < 0 || gx >= BW || gy >= BH) out.outside++;
			if (tb.some((t) => gx >= t.x0 && gx < t.x1 && gy >= t.y0 && gy < t.y1)) out.text++;
		}
	// GROW (Santa's column; the new tip only)
	if (kind === 'sleigh' && !LEGACY) {
		const gp0 = [];
		for (let i = 0; i <= 14; i++) gp0.push(i / 14);
		for (let i = 0; i <= 50; i++) gp0.push(i / 50);
		const ease = (t) => t * t * (3 - 2 * t);
		const ga = growAlpha(tier, pic);
		const glit = bakeLit(ga, `${tier}:${pic}~grow`, dw, dh);
		for (const u of gp0) {
			const gp = ease(u);
			const c = lo.cell;
			const yTop = c.y + (lo.rowsTop - c.y) * gp;
			const yBot = c.y + c.h + (lo.rowsTop + 4 * lo.cellH - c.y - c.h) * gp;
			const box = { x: c.x, y: Math.round(yTop), w: c.w, h: Math.round(yBot) - Math.round(yTop) };
			const win = { x: box.x - lo.th, y: box.y - lo.th, w: box.w + 2 * lo.th, h: box.h + 2 * lo.th };
			const plan = L.wildGrowPlan(pic, lo.final, win, k);
			if (plan.whole) continue;
			const bad = growCuts(plan, glit, dw, dh, BW, BH, X0);
			if (bad.length) out.grow.push({ u: Math.round(u * 100) / 100, grow: plan.grow, bad: bad.slice(0, 3), n: bad.length });
		}
	}
	return { lo, out };
}
/** the grow's pieces composed (lit LEDs, board coordinates) and each piece's cut edges where lit pixels go on past its
 *  source rectangle with nothing lit across them in the composition */
function growCuts(plan, lit, W, H, BW, BH, X0) {
	const comp = new Map();
	const key = (x, y) => y * 100000 + x;
	for (const q of plan.blits)
		for (let y = 0; y < q.sh; y++)
			for (let x = 0; x < q.sw; x++) if (lit[(q.sy + y) * W + q.sx + x]) comp.set(key(X0 + q.dx + x, plan.Y0 + q.dy + y), 1);
	const bad = [];
	const fuzz = Math.ceil(0.02 * (plan.outer.x1 - plan.outer.x0)) + 1;
	let splices = 0;
	const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? lit[y * W + x] : 0);
	for (const q of plan.blits) {
		const edges = [
			['top', q.sw, (i) => [q.sx + i, q.sy, q.sx + i, q.sy - 1, X0 + q.dx + i, plan.Y0 + q.dy - 1]],
			['bottom', q.sw, (i) => [q.sx + i, q.sy + q.sh - 1, q.sx + i, q.sy + q.sh, X0 + q.dx + i, plan.Y0 + q.dy + q.sh]],
			['left', q.sh, (i) => [q.sx, q.sy + i, q.sx - 1, q.sy + i, X0 + q.dx - 1, plan.Y0 + q.dy + i]],
			['right', q.sh, (i) => [q.sx + q.sw - 1, q.sy + i, q.sx + q.sw, q.sy + i, X0 + q.dx + q.sw, plan.Y0 + q.dy + i]],
		];
		for (const [side, n, f] of edges) {
			// (a straight cut is a RUN: two or more neighboring LEDs along the edge; a lone LED is the lumpy fuzz's own
			// outline meeting the garland's rows, not an edge anyone can see)
			let hits = 0;
			let run = 0;
			const where = [];
			for (let i = 0; i <= n; i++) {
				let cut = false;
				if (i < n) {
					const [ix, iy, ox, oy, gx, gy] = f(i);
					cut = !!(at(ix, iy) && at(ox, oy) && !comp.has(key(gx, gy)));
					// (the side bands' OUTER FUZZ, the garland's lumpy ink outline either side of the outer edge: where the
					// garland's rows riding the edge meet the band standing in place the two outlines' lumps meet as they
					// fall; a splice of the outline, not a cut of the figure or the frame. Counted apart, never a failure.)
					if (cut && (side === 'top' || side === 'bottom') && (Math.abs(ix - plan.outer.x0) <= fuzz || Math.abs(ix - plan.outer.x1) <= fuzz)) {
						splices++;
						cut = false;
					}
				}
				if (cut) run++;
				else {
					if (run >= 2) {
						hits += run;
						where.push(i - run);
					}
					run = 0;
				}
			}
			if (hits) bad.push({ part: q.part, side, leds: hits, at: where.slice(0, 6), src: [q.sx, q.sy, q.sw, q.sh], outer: plan.outer });
		}
	}
	SPLICES += splices;
	return bad;
}

let SPLICES = 0;
// ---- THE SOURCE: each Wild picture on each sheet transparent along its own four edges (nothing cut where it was cut
// out: the cause on the tip before the fix, the captures cut at the frame's outer edge) ----
for (const tier of ['full', 'phone'])
	for (const pic of ['santa', 'grandma']) {
		const p = alphaOf(tier, pic);
		let n = 0;
		for (let x = 0; x < p.w; x++) n += (p.a[x] > 0) + (p.a[(p.h - 1) * p.w + x] > 0);
		for (let y = 0; y < p.h; y++) n += (p.a[y * p.w] > 0) + (p.a[y * p.w + p.w - 1] > 0);
		check(n === 0, `SOURCE: ${tier} sheet: ${pic}'s picture (${p.w} x ${p.h} px) has ${n} px drawn on its own edges (0: a transparent margin all round)`);
	}
// ---- the run ----
const KS = [1, 1.5, 2, 3];
for (const kind of ['sleigh', 'car']) {
	for (const b of NAMED) {
		for (const k of KS) {
			for (const tier of ['full', 'phone']) {
				const { lo, out } = judge(b, kind, k, tier);
				const tag = `${kind} ${b.name} ${b.W}x${b.H} at ${k} LEDs/dot, ${tier} sheet`;
				const main = tier === b.tier && k === 1;
				if (main || out.road.edge) check(out.road.edge === 0 && out.road.inner.every((n) => n > 0) && out.road.past === 0, `${tag}: ROAD: ${lo.NR} rows, no line on its outer edges (${out.road.edge} fills there), dashes on the ${lo.NR - 1} lines between (${out.road.inner.join(', ')} dashes), none past the lanes' end${lo.tall ? '' : ' (the Wild\'s outer edge)'}`, out.road);
				const ok = out.cut.edgeLit === 0 && out.outside === 0 && out.text === 0;
				if (main || !ok) check(ok, `${tag}: CUT: ${lo.pic}'s picture ${out.cut.dw} x ${out.cut.dh} LEDs at ${out.cut.D.x},${out.cut.D.y} (dots): ${out.cut.edgeLit} lit LEDs on its edge${out.cut.sides.length ? ' (' + out.cut.sides.join(', ') + ')' : ''}, ${out.outside} off the board, ${out.text} over the words`, { final: lo.final, D: out.cut.D });
				if (kind === 'sleigh' && !LEGACY && (main || out.grow.length)) check(out.grow.length === 0, `${tag}: GROW: Santa's column from the struck cell to the whole column, ${out.grow.length} frames with a cut edge`, out.grow.slice(0, 3));
			}
		}
	}
}
if (process.env.QUICK) {
	console.log(`\n${pass} passed, ${fail} failed (QUICK: no sweep; ${SPLICES} LEDs of the outer fuzz's splices counted apart)`);
	process.exit(fail ? 1 : 0);
}
// THE SWEEP (k 1 and 1.5 on every size; 2 and 3 are finer and judged on the named boards)
const sweepBad = { road: [], cut: [], grow: [] };
let n = 0;
for (const kind of ['sleigh', 'car'])
	for (const b of SWEEP)
		for (const k of [1, 1.5]) {
			const { out } = judge(b, kind, k, b.tier);
			n++;
			if (out.road.edge || out.road.past || !out.road.inner.every((x) => x > 0)) sweepBad.road.push({ kind, b: b.name, k, ...out.road });
			if (out.cut.edgeLit || out.outside || out.text) sweepBad.cut.push({ kind, b: b.name, k, edge: out.cut.edgeLit, sides: out.cut.sides, outside: out.outside, text: out.text });
			if (out.grow.length) sweepBad.grow.push({ kind, b: b.name, k, frames: out.grow.length, first: out.grow[0] });
		}
check(sweepBad.road.length === 0, `SWEEP: ROAD on ${n} boards (heights 110 to 330 at W / H 1.72 to 2.15, 170 to 330 at 1.37 to 1.69; 1 and 1.5 LEDs per dot): no outer edge line, the lines between drawn, no stub past the Wild (${sweepBad.road.length} not)`, sweepBad.road.slice(0, 3));
if (process.env.SWEEP_DUMP) for (const x of sweepBad.cut) console.log('CUTBAD', JSON.stringify(x));
check(sweepBad.cut.length === 0, `SWEEP: CUT on ${n} boards: no lit LED on the picture's edge, off the board or over the words (${sweepBad.cut.length} not)`, sweepBad.cut.slice(0, 3));
if (!LEGACY) check(sweepBad.grow.length === 0, `SWEEP: GROW on every sleigh board: no frame of the grow cuts the picture (${sweepBad.grow.length} boards not)`, sweepBad.grow.slice(0, 3));
console.log(`\n${pass} passed, ${fail} failed (${SPLICES} LEDs of the outer fuzz's splices in the grow, counted apart)`);
process.exit(fail ? 1 : 0);
