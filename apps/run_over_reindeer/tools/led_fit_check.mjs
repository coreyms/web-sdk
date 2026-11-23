// @ts-nocheck: a node check script, not app code (svelte-check picks up .mjs files)
// EVERY CARD AND STRIP MESSAGE FITS AT EVERY WINDOW, NODE ONLY (2026-11-22, wip/ledpitch; constants LED_BOARD.pitch,
// game/scoreboard/layout.ts ledPitchGeo, scoreboardDraw.ts setRowDots, landing/ledScreens.ts the 5 x 7 font). Since the
// smallest dot rule the LED board's dot count follows the window, so every layout is walked on the grid each window gets.
// No browser: the game's own scoreboard (the real class and programs) runs on the software canvas of tools/led_node_kit.mjs,
// on the game's own geometry for the window (scoreboardGeometry, then the rule at the renderer's resolution).
// It checks, per window and screen density (a desktop at 1x, 1.25x and 2x; a phone at 2x and 3x):
//   1. THE GRID: the rule placed it (the 400 x 225 popout: it did not), a dot is at least the layout class's floor in CSS px
//      and a whole number of renderer pixels, the strip has at least LED_BOARD.pitch.stripMinRows rows (or its dots are at
//      the least renderer pixels), both faces sit inside their housings
//   2. EVERY CARD AND MESSAGE: the press screen's four screens and its strip line; the Free Spins and Super entries with
//      their explanation; a Total Win, a seven figure one and a capped one with its line; the Big to Max wins; the small win;
//      the bonus round's counter; the Grandma line long and short; the scatter count; the Super Wheel's lines; every idle
//      cartoon and the race with its result card. Each is stepped along its own clock. At every sample every line of words
//      that is at rest (drawn at the same place on two LED steps running) must lie inside the canvas it is drawn on, no two
//      different lines at rest may overlap, no line may be the heavy face drawn under 9 LEDs tall (blobs), every title and
//      amount the programs record must lie inside its face, the words each card must show are all drawn, and on the press
//      screen no words sit under the light string along the top
//   2b. NO WORD ALONE ON A LAST LINE (2026-11-23, wip/reindeer-superline; game/scoreboard/explainDraw.ts noOrphan): every
//      sentence a card sets in two lines or more (the Free Spins and Super entries' INTRO_LINE sentences and the capped
//      Total Win's line on the big board; the press screens' bodies) is read back from the lines drawn at rest, and its
//      last line holds two words or more. A press screen's head (three or four capital words on a face that may hold one
//      a line) may keep a word alone only where no other cut into the same number of lines fits within its widest line
//   3. THE 5 x 7 DOT FONT: no two signs are the same picture at size 1 or size 2, and the look-alike pairs (D and O, B and
//      8, S and 5, 0 and O, M and W, the apostrophe against the comma, the full stop, I, 1, l and !) differ by enough dots
// Each window and density runs in its own node process (fresh caches, as a fresh page), four at a time.
//   node --experimental-strip-types --no-warnings tools/led_fit_check.mjs            (from apps/run_over_reindeer)
//   ONLY=1200x675,320x568 ...   only these windows;  VERBOSE=1 ...   every line of words drawn at rest, per sample
// Pass: every line PASS, "0 fail" and exit 0.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { APP, geometryFor, install, patternSheet, resolutionFor, src } from './led_node_kit.mjs';

const SELF = fileURLToPath(import.meta.url);
/** a sentence's lines read back from the strings drawn at rest (each line one string, the words in order), or null */
function linesOf(sentence, drawn) {
	const words = sentence.split(/\s+/).filter(Boolean);
	const N = words.length;
	// every way to cut the words into drawn lines; prefer one whose last line is not a word alone (no false alarm)
	const ways = [];
	const walk = (i, acc) => {
		if (ways.length > 20) return;
		if (i === N) return void ways.push(acc);
		for (let j = N; j > i; j--) {
			const l = words.slice(i, j).join(' ');
			if (drawn.has(l)) walk(j, [...acc, l]);
		}
	};
	walk(0, []);
	if (!ways.length) return null;
	return ways.find((w) => w.length < 2 || w[w.length - 1].split(' ').length > 1) ?? ways[0];
}
const orphaned = (lines) => !!lines && lines.length > 1 && lines[lines.length - 1].split(' ').length === 1;
/** the windows (CSS px): Stake's review sizes and full screens, the wide screens, upright and sideways phones, the popouts */
const WINDOWS = [
	[1200, 675], [1024, 576], [1280, 720], [1366, 768], [1920, 1080], [2560, 1440], [2560, 1080], [3440, 1440],
	[425, 812], [375, 667], [320, 568], [390, 844], [390, 620],
	[812, 425], [667, 375], [568, 320],
	// Corey's round 3 phone windows (2026-11-23, ui/sign/signLayout.ts PHONE_R3 and LAND_R3: the sizes a phone browser gives the game)
	[440, 742], [413, 586], [375, 530], [626, 816], [832, 376], [667, 311], [890, 552],
	// (the popouts: 800 x 450 is laid out as a phone held sideways and takes the rule; 400 x 225 is left as it was)
	[800, 450], [400, 225],
];
const PHONE = (w, h) => Math.min(w, h) <= 500;
const DENSITIES = (w, h) => (PHONE(w, h) ? [2, 3] : [1, 1.25, 2]);

// ---- the parent ------------------------------------------------------------------------------------------------------------
if (process.argv[2] !== 'child') {
	const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
	const jobs = [];
	for (const [w, h] of WINDOWS) {
		if (only && !only.has(`${w}x${h}`)) continue;
		for (const d of DENSITIES(w, h)) jobs.push({ w, h, d, phone: PHONE(w, h) });
	}
	jobs.unshift({ font: true });
	let pass = 0;
	let fail = 0;
	const lines = [];
	const runOne = (job) =>
		new Promise((resolve) => {
			const args = ['--experimental-strip-types', '--no-warnings', SELF, 'child', job.font ? 'font' : `${job.w}`, `${job.h ?? 0}`, `${job.d ?? 1}`, job.phone ? '1' : '0'];
			const p = spawn(process.execPath, args, { cwd: APP, stdio: ['ignore', 'pipe', 'pipe'] });
			let out = '';
			let err = '';
			p.stdout.on('data', (b) => (out += b));
			p.stderr.on('data', (b) => (err += b));
			p.on('close', () => {
				const line = out.split('\n').find((l) => l.startsWith('RESULT '));
				resolve({ job, r: line ? JSON.parse(line.slice(7)) : { error: (err || out).slice(-1800) }, verbose: out.split('\n').filter((l) => l.startsWith('V ')) });
			});
		});
	const queue = jobs.slice();
	const results = [];
	await Promise.all(
		Array.from({ length: Math.min(4, queue.length) }, async () => {
			while (queue.length) results.push(await runOne(queue.shift()));
		}),
	);
	results.sort((a, b) => jobs.indexOf(a.job) - jobs.indexOf(b.job));
	for (const { job, r, verbose } of results) {
		const name = job.font ? 'the 5 x 7 dot font' : `${job.w} x ${job.h} at ${job.d}x`;
		for (const v of verbose) lines.push(v);
		if (r.error) {
			fail += 1;
			lines.push(`FAIL ${name}: ran ${String(r.error).slice(0, 1500)}`);
			continue;
		}
		for (const c of r.checks) {
			if (c.ok) pass += 1;
			else fail += 1;
			lines.push(`${c.ok ? 'PASS' : 'FAIL'} ${name}: ${c.msg}${!c.ok && c.detail !== undefined ? ' ' + JSON.stringify(c.detail).slice(0, 1400) : ''}`);
		}
	}
	console.log(lines.join('\n'));
	console.log(`\nled_fit_check: ${pass} pass, ${fail} fail`);
	process.exit(fail ? 1 : 0);
}

// ---- the child: one window at one density, or the font ---------------------------------------------------------------------
const [, , , A1, A2, A3, A4] = process.argv;
const VERBOSE = !!process.env.VERBOSE;
const checks = [];
const check = (ok, msg, detail) => checks.push({ ok: !!ok, msg, detail });
const done = () => {
	console.log('RESULT ' + JSON.stringify({ checks }));
	process.exit(0);
};
const phoneTier = A4 === '1';
const density = Number(A3);
install({ phoneTier, ratio: density });
const { LED_BOARD, LED_SIGN, INTRO_LINE, SUPER_WHEEL } = await import(src('constants.ts'));
const grid = await import(src('scoreboard/ledGrid.ts'));
const screens = await import(src('landing/ledScreens.ts'));

if (A1 === 'font') {
	// 3. THE 5 x 7 DOT FONT: each sign drawn alone at size 1 and 2 on a one LED per dot canvas, its lit dots read back
	const SIGNS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz', ',', "'", '.', '$', '?', '!'];
	const pic = (ch, s) => {
		const c = grid.mkFace(8 * s, 8 * s, 1);
		screens.drawText(c.ctx, ch, 0, 0, s, '#ffffff');
		const d = c.ctx.getImageData(0, 0, c.width, c.height).data;
		let bits = '';
		for (let i = 3; i < d.length; i += 4) bits += d[i] > 0 ? '1' : '0';
		return bits;
	};
	const diff = (a, b) => {
		let n = 0;
		for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n += 1;
		return n;
	};
	for (const s of [1, 2]) {
		const P = new Map(SIGNS.map((ch) => [ch, pic(ch, s)]));
		const same = [];
		let least = { n: Infinity, a: '', b: '' };
		for (let i = 0; i < SIGNS.length; i++)
			for (let j = i + 1; j < SIGNS.length; j++) {
				const n = diff(P.get(SIGNS[i]), P.get(SIGNS[j]));
				if (n === 0) same.push(SIGNS[i] + SIGNS[j]);
				if (n < least.n) least = { n, a: SIGNS[i], b: SIGNS[j] };
			}
		check(same.length === 0, `3. size ${s}: no two of the ${SIGNS.length} signs are the same picture (the closest pair ${least.a} and ${least.b}: ${least.n} dots apart)`, same);
		// the look-alikes: at size 1 at least 3 dots apart; at size 2 (each dot four LEDs, corners rounded) at least 10 LEDs
		const need = s === 1 ? 3 : 10;
		const PAIRS = ['DO', 'B8', 'S5', '0O', 'MW', "',", "'.", "'I", "'1", "'l", "'!", 'Q0', 'OQ', 'UV', 'I1', 'Z2', 'G6', 'C G'.replace(' ', '')];
		const bad = [];
		const got = [];
		for (const p of PAIRS) {
			const [a, b] = [...p];
			const n = diff(P.get(a), P.get(b));
			got.push(`${a}${b} ${n}`);
			if (n < need) bad.push(`${a} and ${b}: ${n}`);
		}
		check(bad.length === 0, `3. size ${s}: the look-alike pairs are at least ${need} ${s === 1 ? 'dots' : 'LEDs'} apart (${got.join(', ')})`, bad);
	}
	done();
}

const VW = Number(A1);
const VH = Number(A2);
const draw = await import(src('scoreboard/scoreboardDraw.ts'));
const { Scoreboard } = await import(src('scoreboard/scoreboard.ts'));
const { ledPitchGeo } = await import(src('scoreboard/layout.ts'));
const { SCOREBOARD_ART } = await import(src('scoreboardArtSpec.ts'));
const { LED_ART } = await import(src('ledArtSpec.ts'));
const { LED_WILDS } = await import(src('ledWildsSpec.ts'));
draw.setScoreboardArt(patternSheet(SCOREBOARD_ART.width, SCOREBOARD_ART.height));
screens.setLedArt({ image: patternSheet(LED_ART.width, LED_ART.height), frames: LED_ART.frames });
const WT = LED_WILDS.tiers[phoneTier ? 'phone' : 'full'];
screens.setLedWildArt({ image: patternSheet(WT.width, WT.height), frames: WT.frames }, phoneTier ? 'phone' : 'full');

const ratio = await resolutionFor(VW, VH, density, phoneTier);
const geo0 = await geometryFor(VW, VH);
const G = ledPitchGeo(geo0, ratio);
const L = G.led;
const P = LED_BOARD.pitch;
const mini = Math.min(VW, VH) < P.miniShort;
const r2 = (v) => Math.round(v * 100) / 100;

// 1. THE GRID
{
	const where = `${G.back.face.dotsW} x ${G.back.face.dotsH} dots (the strip ${G.strip.face.dotsW} x ${G.strip.face.dotsH}), ${L.back.k} per layout dot, ${r2(L.back.css)} CSS px = ${r2(L.back.px)} renderer px a dot (the strip ${r2(L.strip.css)} = ${r2(L.strip.px)}), the renderer at ${r2(ratio)}`;
	if (mini) check(!L.ruled, `1. the mini player keeps the grid before the rule: ${where}`);
	else {
		const whole = (v) => Math.abs(v - Math.round(v)) < 1e-6;
		check(L.ruled && L.back.css >= L.floor - 1e-9 && whole(L.back.px) && whole(L.strip.px) && L.back.px >= P.minPx && L.strip.px >= P.minPx, `1. the rule placed the grid: ${where}; the floor ${L.floor}`, L);
		const rows = G.strip.face.dotsH;
		check(rows >= P.stripMinRows || Math.round(L.strip.px) === P.minPx, `1. the strip has ${rows} rows (at least ${P.stripMinRows}, or its dots at the least ${P.minPx} renderer px: ${r2(L.strip.px)})`);
		const inside = (f, h) => f.x >= h.x - 1e-6 && f.x + f.w <= h.x + h.w + 1e-6 && f.y >= h.y - 1e-6 && f.y + f.h <= h.y + h.h + 1e-6;
		check(inside(G.strip.face, G.strip.housing) && inside(G.back.face, G.back.housing), '1. both faces sit inside their housings', { strip: G.strip, back: G.back });
	}
}

// 2. EVERY CARD AND MESSAGE
const STEP = 1000 / LED_BOARD.fps;
let notes = [];
grid.setTextAudit((n) => notes.push(n));
const fmt = (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtKr = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, ' ').replace('.', ',') + ' kr';
const mkBoard = (env = { free: false, left: 0, idle: true, scatter: null }) => {
	const sb = new Scoreboard();
	sb.deviceRatio = () => ratio;
	sb.layout(geo0, []);
	sb.manual = true;
	sb.env = env;
	return sb;
};
const problems = new Map();
/** 2b: the sentences each card sets in lines, and the wraps read back (card: sentence: the distinct line sets) */
const sentencesFor = new Map();
const wraps = new Map();
const shown = new Map();
const blame = (card, what, detail) => {
	const key = `${card}: ${what}`;
	if (!problems.has(key)) problems.set(key, detail);
};
const boxOf = (n) => {
	if (n.kind === 'row') return { x: n.x, y: n.y, w: n.w, h: n.h };
	const ink = screens.textInk(n.str, n.s);
	if (ink.r <= ink.l) return null;
	return { x: Math.round(n.x) + ink.l, y: Math.round(n.y) + ink.t, w: ink.r - ink.l, h: ink.b - ink.t };
};
const sameNote = (a, b) => a.canvas === b.canvas && a.str === b.str && a.x === b.x && a.y === b.y && a.s === b.s && a.kind === b.kind;
const REST_MS = 200;
const titlesNow = (sb) => {
	const out = {};
	for (const which of ['back', 'strip']) {
		const st = sb.faceStats(which);
		out[which] = st && (which !== 'back' || sb.backRoot.visible) ? { W: st.W, H: st.H, titles: st.titles ?? [] } : null;
	}
	return out;
};
/** one sample: an LED step, and another REST_MS later; the lines at the same place in both are at rest, and judged */
function sample(sb, card, label) {
	notes = [];
	sb.step(STEP);
	const first = notes;
	const titles1 = titlesNow(sb);
	notes = [];
	sb.step(REST_MS);
	const second = notes;
	const rest = second.filter((n) => first.some((m) => sameNote(m, n)));
	// (the words a card shows: at rest or on the move, a ticker's line too)
	for (const n of second) (shown.get(card) ?? shown.set(card, new Set()).get(card)).add(n.str);
	const faces = new Map();
	for (const which of ['back', 'strip']) {
		const Gf = sb[which];
		if (!Gf) continue;
		for (const c of [Gf.F.out, Gf.F.a, Gf.F.b]) faces.set(c, which);
	}
	const seen = [];
	const boxes = [];
	for (const n of rest) {
		const W = grid.lwOf(n.canvas);
		const H = grid.lhOf(n.canvas);
		const k = n.canvas.ledK ?? 1;
		const b = boxOf(n);
		if (!b || !n.str.trim()) continue;
		const face = faces.get(n.canvas) ?? null;
		const at = `${JSON.stringify(n.str)} ${n.kind} ${n.s} at ${r2(b.x)},${r2(b.y)} ${r2(b.w)}x${r2(b.h)} on ${face ?? 'a scratch'} ${W}x${H}`;
		seen.push(at);
		if (b.y < 0 || b.y + b.h > H) blame(card, `cut off above or below: ${at}`, label);
		// (a line wider than its canvas is a ticker: it scrolls)
		else if (b.w <= W && (b.x < 0 || b.x + b.w > W)) blame(card, `cut off at a side: ${at}`, label);
		// (the press screen: no words under the light string along the face's top, landing/ledScreens.ts lightRows)
		if (face === 'back' && card.startsWith('press screen') && b.y < screens.lightRows(H) - 1) blame(card, `under the light string (its bulbs reach row ${screens.lightRows(H) - 2}): ${at}`, label);
		if (n.kind === 'row' && !n.dots && n.s * k < 9) blame(card, `the heavy face under 9 LEDs tall: ${at}`, label);
		if (face) boxes.push({ n, b, at });
	}
	// no two different lines at rest on one face over each other
	for (let i = 0; i < boxes.length; i++)
		for (let j = i + 1; j < boxes.length; j++) {
			const a = boxes[i];
			const c = boxes[j];
			if (a.n.canvas !== c.n.canvas || a.n.str === c.n.str) continue;
			const ox = Math.min(a.b.x + a.b.w, c.b.x + c.b.w) - Math.max(a.b.x, c.b.x);
			const oy = Math.min(a.b.y + a.b.h, c.b.y + c.b.h) - Math.max(a.b.y, c.b.y);
			if (ox > 0 && oy > 0) blame(card, `two lines over each other: ${a.at} AND ${c.at}`, label);
		}
	// the titles and amounts the programs record, at rest (the bounce's lift above them)
	const titles2 = titlesNow(sb);
	for (const which of ['back', 'strip']) {
		const st = titles2[which];
		if (!st || !titles1[which]) continue;
		for (const t of st.titles) {
			// (a counting amount changes its digits, not its place: the same kind on the same rows, its left edge within 2 dots)
			if (!titles1[which].titles.some((u) => u.kind === t.kind && u.y0 === t.y0 && u.y1 === t.y1 && Math.abs(u.x0 - t.x0) <= 2 && (t.kind === 'amount' || u.str === t.str))) continue;
			if (t.x0 < 0 || t.x1 > st.W || t.y0 - (t.lift ?? 0) < 0 || t.y1 > st.H) blame(card, `a recorded ${t.kind} is outside the ${which} face ${st.W}x${st.H}: ${JSON.stringify(t.str)} ${t.x0}..${t.x1}, ${t.y0 - (t.lift ?? 0)}..${t.y1}`, label);
			if (t.kind === 'title') (shown.get(card) ?? shown.set(card, new Set()).get(card)).add(t.str);
		}
	}
	// 2b: the card's sentences, read back from the lines at rest
	const noteOf = new Map();
	for (const n of rest) if (n.str.trim() && !noteOf.has(n.str.trim())) noteOf.set(n.str.trim(), n);
	const drawnAt = new Set(noteOf.keys());
	for (const { text: sent, strict } of sentencesFor.get(card) ?? []) {
		const ls = linesOf(sent, drawnAt);
		if (!ls || ls.length < 2) continue;
		// (a head's word alone is allowed only where it cannot be helped: no other cut into as many lines fits within the
		// widest line drawn, measured in the face the lines are set in)
		let helpless = false;
		if (!strict && orphaned(ls)) {
			const n0 = noteOf.get(ls[0]);
			const wOf = (l) => (n0.kind === 'row' ? draw.rowInfo(l, n0.s).w : screens.textW(l, n0.s));
			const widest = Math.max(...ls.map(wOf));
			helpless = JSON.stringify(screens.noOrphan(ls, widest, wOf)) === JSON.stringify(ls);
		}
		const per = wraps.get(card) ?? wraps.set(card, new Map()).get(card);
		(per.get(sent) ?? per.set(sent, new Map()).get(sent)).set(JSON.stringify(ls), helpless);
	}
	if (VERBOSE) console.log(`V ${VW}x${VH}@${density} ${card} ${label}: ${seen.join(' | ')}`);
}
/** the words a card must show: each word of each string in some line drawn at rest on a face */
const expectWords = (card, strings) => {
	const list = [...(shown.get(card) ?? [])].join(' \n ').toUpperCase();
	const missing = [];
	for (const s of strings) for (const w of s.toUpperCase().split(/\s+/)) if (w && !list.includes(w)) missing.push(w);
	if (missing.length) blame(card, `never drawn: ${[...new Set(missing)].join(' ')}`, [...(shown.get(card) ?? [])].slice(0, 40));
};
const T = LED_SIGN.text;
const TX = { win: { top: T.winTop, num: '7,777X' }, sleigh: { head: T.sleighHead, body: T.sleighBody, mult: T.sleighMult }, car: { head: T.carHead, body: T.carBody, mult: T.carMult, bodyScales: [2, 1] }, face: { head: T.faceHead, body: T.faceBody }, ticker: T.ticker };
const cards = [];

// the press screen: each of its screens mid way and at rest, the strip's line under it
{
	const sb = mkBoard();
	sb.press(TX);
	sb.pressGate(true);
	const period = (LED_SIGN.holdS + LED_SIGN.transS) * 1000;
	screens.SCREEN_NAMES.forEach((name, i) => {
		const card = `press screen ${name}`;
		cards.push(card);
		sentencesFor.set(card, name === 'win' ? [{ text: TX.win.top, strict: false }] : [{ text: TX[name].head, strict: false }, { text: TX[name].body, strict: true }]);
		for (const at of [1700, 2500, 3300]) {
			sb.show.t = sb.show.contentAt + i * period + at;
			sb.clock = 5000 + i * period + at;
			sample(sb, card, `${at} ms`);
		}
		expectWords(card, name === 'win' ? [TX.win.top, TX.ticker] : name === 'face' ? [TX.face.head, TX.face.body, TX.ticker] : [TX[name].head, TX[name].body, TX.ticker]);
	});
}
// the bonus round's cards: the entries with their explanation, the Total Wins
{
	const reqs = {
		'Free Spins entry': [{ kind: 'fs', spins: 10, amount: 0, presents: 3 }, ['FREE SPINS', INTRO_LINE.bonus, TX.ticker]],
		'Super entry': [{ kind: 'sfs', spins: 10, amount: 0, presents: 4 }, ['SUPER FREE SPINS', INTRO_LINE.super, TX.ticker]],
		'Total Win $1,234.56': [{ kind: 'total', spins: 0, amount: 1234.56, x: 123.456 }, ['TOTAL WIN', TX.ticker]],
		'Total Win $7,777,000.00': [{ kind: 'total', spins: 0, amount: 7777000, x: 7777, capped: false }, ['TOTAL WIN', TX.ticker]],
		'Total Win 12 345,67 kr': [{ kind: 'total', spins: 0, amount: 12345.67, x: 35, kr: true }, ['TOTAL WIN', TX.ticker]],
		'Total Win capped with its line': [{ kind: 'total', spins: 0, amount: 77770, x: 7777, capped: true, title: 'MAX WIN', line: '7,777x the play amount, the most a round can award.' }, ['MAX WIN', '7,777x the play amount, the most a round can award.', TX.ticker]],
	};
	for (const [card, [C, words]] of Object.entries(reqs)) {
		cards.push(card);
		sentencesFor.set(card, [C.kind === 'fs' ? INTRO_LINE.bonus : C.kind === 'sfs' ? INTRO_LINE.super : C.line].filter(Boolean).map((text) => ({ text, strict: true })));
		const sb = mkBoard({ free: true, left: 10, idle: false, scatter: null });
		sb.card({ kind: C.kind, spins: C.spins, amount: C.amount, fmt: C.kr ? fmtKr : fmt, rate: 1, title: C.title ?? null, line: C.line ?? null, x: C.x ?? 0, capped: !!C.capped, auto: false, presents: C.presents ?? 0 });
		const s = sb.show;
		const end = (s.pressLineAt ?? s.countEnd) + 4200;
		for (let t = 700; t <= end; t += 450) {
			sb.show.t = t;
			sb.clock = 5000 + t;
			sample(sb, card, `${Math.round(t)} ms`);
		}
		expectWords(card, words);
	}
}
// the wins: Big and Super on the strip, Mega to Max on the back board; the small win
{
	for (const [name, x] of [['Big', 16], ['Super', 35], ['Mega', 70], ['Epic', 200], ['Max', 7777]]) {
		const card = `${name} win`;
		cards.push(card);
		const sb = mkBoard();
		void sb.win({ x, amount: x * 100, bet: 100, fmt, rate: 1, auto: false });
		const s = sb.show;
		for (let t = 300; t <= s.exitAt; t += 550) {
			sb.show.t = t;
			sb.clock = 5000 + t;
			sample(sb, card, `${Math.round(t)} ms`);
		}
		expectWords(card, [`${name.toUpperCase()} WIN`]);
	}
	for (const [card, amount, f] of [['small win $2.40', 2.4, fmt], ['small win $1,234.56', 1234.56, fmt], ['small win 12 345,67 kr', 12345.67, fmtKr]]) {
		cards.push(card);
		const sb = mkBoard();
		void sb.win({ x: 2, amount, bet: 100, fmt: f, rate: 1, auto: false, small: true });
		for (const t of [300, 700, 1100, 1500, 2000]) {
			if (!sb.show) break;
			sb.show.t = t;
			sb.clock = 5000 + t;
			sample(sb, card, `${t} ms`);
		}
		expectWords(card, ['WIN']);
	}
}
// the strip's own messages: the counter, the Grandma line, the scatter count, the wheel's lines
{
	for (const left of [10, 1]) {
		const card = `spins left ${left}`;
		cards.push(card);
		const sb = mkBoard({ free: true, left, idle: false, scatter: null });
		for (const t of [200, 900, 2600]) {
			sb.clock += t;
			sample(sb, card, `${t} ms`);
		}
	}
	for (const short of [false, true]) {
		const card = short ? 'Grandma line short' : 'Grandma line';
		cards.push(card);
		const sb = mkBoard();
		sb.gag(short);
		const ms = short ? LED_BOARD.gag.short.ms : LED_BOARD.gag.ms;
		for (let t = 200; t < ms; t += 350) {
			sb.clock = sb.gagAt + t;
			sample(sb, card, `${t} ms`);
		}
	}
	for (const [card, read] of [['scatter count 2 of 3', { id: 1, count: 2, need: 3, live: true, hit: false, reached: 2 }], ['scatter count 3 of 4', { id: 2, count: 3, need: 4, live: true, hit: false, reached: 3 }], ['scatter count hit', { id: 3, count: 3, need: 3, live: false, hit: true, reached: 3 }]]) {
		cards.push(card);
		const sb = mkBoard();
		sb.devScatter = { ...read, live: true, hit: false };
		sample(sb, card, 'start');
		sb.devScatter = read;
		for (const t of [300, 700, 1300]) {
			sb.clock += t;
			sample(sb, card, `${t} ms`);
		}
	}
	const W = SUPER_WHEEL.text;
	for (const text of [W.emerge, W.press, W.auto, W.go, W.names.reindeer, W.names.santa, W.names.grandma, `${W.column} 3`]) {
		const card = `wheel line ${text}`;
		cards.push(card);
		const sb = mkBoard();
		sb.devWheelSteady = true;
		sb.wheelLine(text, 'gold', true);
		sb.clock += 800;
		sample(sb, card, 'steady');
		expectWords(card, [text]);
	}
}
// the idle cartoons, each pinned and stepped along its length; the race with each result's card
{
	const names = LED_BOARD.ideas.cartoons.filter((n) => n !== 'race');
	for (const name of names) {
		const card = `cartoon ${name}`;
		cards.push(card);
		LED_BOARD.cartoon = name;
		const sb = mkBoard();
		sample(sb, card, 'start');
		for (let t = 600; t < 5800; t += 650) {
			sb.clock = sb.cartoonAt + t;
			sample(sb, card, `${t} ms`);
		}
	}
	LED_BOARD.cartoon = 'auto';
	for (const result of ['reindeer', 'police', 'tie']) {
		const card = `race ${result}`;
		cards.push(card);
		const sb = mkBoard();
		sb.race(result);
		const end = LED_BOARD.race.runMs + LED_BOARD.race.cardMs;
		for (let t = 400; t < end; t += 500) {
			sb.clock = sb.cartoonAt + t;
			sample(sb, card, `${t} ms`);
		}
	}
}
grid.setTextAudit(null);
const byCard = new Map();
for (const [k, v] of problems) {
	const card = k.slice(0, k.indexOf(': '));
	(byCard.get(card) ?? byCard.set(card, []).get(card)).push(`${k.slice(k.indexOf(': ') + 2)} [${typeof v === 'string' ? v : JSON.stringify(v)}]`);
}
for (const card of cards) {
	const bad = byCard.get(card) ?? [];
	check(bad.length === 0, `2. ${card} fits${bad.length ? '' : ` (${[...(shown.get(card) ?? [])].length} lines of words judged)`}`, bad.slice(0, 6));
}
// 2b: no word alone on a last line (each sentence a card set in two lines or more, every distinct wrap seen)
for (const card of cards) {
	const per = wraps.get(card);
	if (!per) continue;
	for (const [sent, sets] of per) {
		const all = [...sets.keys()].map((j) => JSON.parse(j));
		const alone = all.filter((ls) => orphaned(ls) && !sets.get(JSON.stringify(ls)));
		const kept = all.filter((ls) => orphaned(ls) && sets.get(JSON.stringify(ls)));
		const show = all.map((ls) => ls.map((l) => `[${l}]`).join(' ')).join(' / ');
		check(alone.length === 0, `2b. ${card}: no word alone on the last line of ${JSON.stringify(sent.slice(0, 32) + (sent.length > 32 ? '...' : ''))}: ${show}${kept.length ? ' (a word alone where no other cut fits: allowed for a head)' : ''}`, alone);
	}
}
done();
