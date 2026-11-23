// @ts-nocheck: a node check script, not app code (svelte-check picks up .mjs files)
// THE BACK BOARD'S TITLES AND AMOUNTS STAND ON THE FACE'S MIDDLE AT EVERY DOT COUNT, NODE ONLY (2026-11-23, wip/signplus2).
// The probe host on the smallest dot rule (wip/ledpitch), upright phones 390 x 844 and 390 x 620: BIG to MAX WIN stood 50 dots
// left of the face's middle and the amount 28 right of it, small, on one row at mid height: the STRIP'S one row layout on
// the board's tall face. THE RULE THAT PICKED IT (scoreboardDraw.ts winLayout): the stacked layout (title over amount, both
// on the middle) is taken where its amount is 0.85 of the one row layout's or more. Under THE DOT FONT STEP (constants
// LED_BOARD.pitch.dotRowCap2: an amount whose cap is 20 dots or under is drawn in the dot font's 14 rows; the heavy face
// only from 21) the two caps were compared as numbers: the one row layout counts its cap down a dot at a time and stopped
// at 20, the stacked one's comes from fitCap, which answers the rows drawn, 14. Both draw the very same 14 rows, and 14 is
// under 0.85 of 20, so the one row layout won. THE THRESHOLD THE NEW GRID CROSSED: the upright board is 167 dots across
// since the rule (257 layout dots before it); "$7,777.00" in the heavy face at its least 21 rows is wider than the 151 dots
// the stacked layout gives an amount there, so the amount falls to the dot font. The layouts are now compared by the rows
// drawn (rowCapEff).
// No browser: the game's own scoreboard runs on tools/led_node_kit.mjs's software canvas, on the game's own geometry and
// the dot rule at the renderer's resolution, for EVERY WINDOW OF THE SIGN BAR'S LAYOUT SWEEP (tools/sign_layout_test.mjs:
// the desktop sizes, every sideways phone from 568 x 320 to 932 x 430, the upright phones) and the tablets, at each screen
// density. Many windows give the same back board: each distinct one (class, its dots across and down, LEDs per layout
// dot) is drawn once, on the first window that has it.
// Per face, at rest (a win held after its count; a Total Win waiting for its press), up to three samples 100 ms apart:
//   1. three wins (98.75x, 312.45x and 7,777x at a play of 1: BIG to MAX WIN) and a seven figure one (7,777x at 1,000:
//      "$7,777,000.00"), and a Total Win (248.5x) and a capped one ("$7,777,000.00"): on the back board every title and
//      every amount is centered on the face by its drawn dots within 1 dot, its margins equal within 2, a title 4 dots or
//      more clear of each side and an amount 2, the title's bounce inside the top (tools/led_board_probe.mjs section titles,
//      the same rule)
//   2. THE STACKED LAYOUT: the title stands over the amount (its lowest row above the amount's top row), never beside it
//   3. THE PICK IS BY THE ROWS DRAWN: at the probe host's two faces (390 x 844 and 390 x 620 at 3x) the title is at dot
//      scale 2 or more and the amount is as tall as the title or taller
//   4. THE STRIP at 390 x 844 (25 rows): a win's amount of 7 signs or under takes 21 rows (the dot font's third step, to
//      the dot inside the strip's margins: scoreboardDraw.ts dotFill), one of 9 signs 14, each inside the face (a seven
//      figure amount beside its title is 7 rows there: listed)
// The heavy face's widths here are the kit's stand-ins for the font's (a browser's differ by a few dots): what is judged is
// the placing, not the cap a browser lands on.
//   node --experimental-strip-types --no-warnings tools/led_center_check.mjs            (from apps/run_over_reindeer)
//   ONLY=390x844,1024x768 ...   only these windows;  VERBOSE=1 ...   every face's line
// Pass: every line PASS, "0 fail" and exit 0.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { APP, geometryFor, install, patternSheet, resolutionFor, src } from './led_node_kit.mjs';

const SELF = fileURLToPath(import.meta.url);
const PHONE = (w, h) => Math.min(w, h) <= 500;

// ---- the parent: the windows, their distinct faces, four children --------------------------------------------------------
if (process.argv[2] !== 'child') {
	install({ phoneTier: true, ratio: 3 });
	const { ledPitchGeo } = await import(src('scoreboard/layout.ts'));
	const { LED_BOARD } = await import(src('constants.ts'));
	const windows = [];
	for (const wh of [[1920, 1080], [1200, 675], [1024, 576], [1280, 720], [1366, 768], [1440, 900], [2560, 1440], [2560, 1080], [3440, 1440], [1280, 800], [1024, 768], [800, 450], [1180, 820], [820, 1180], [768, 1024], [1024, 1366]]) windows.push(wh);
	for (let vh = 320; vh <= 430; vh += 10) for (let vw = 568; vw <= 932; vw += 4) if (vw / vh >= 1.5 && vw / vh <= 2.34) windows.push([vw, vh]);
	for (const wh of [[425, 812], [375, 667], [320, 568], [390, 844], [390, 620]]) windows.push(wh);
	for (let vw = 320; vw <= 430; vw += 10) for (let k = 1.6; k <= 2.2001; k += 0.05) windows.push([vw, Math.round(vw * k)]);
	const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
	// (the probe host's two faces first, so they are the ones drawn for their dot counts)
	windows.unshift([390, 844], [390, 620]);
	const faces = new Map();
	let tried = 0;
	for (const [vw, vh] of windows) {
		if (only && !only.has(`${vw}x${vh}`)) continue;
		if (Math.min(vw, vh) < LED_BOARD.pitch.miniShort) continue;
		const phone = PHONE(vw, vh);
		const g0 = await geometryFor(vw, vh);
		for (const d of phone ? [3, 2] : [2, 1]) {
			tried++;
			const g = ledPitchGeo(g0, await resolutionFor(vw, vh, d, phone));
			const key = `${phone ? 'phone' : 'desk'}|${g.cls}|${g.back.face.dotsW}x${g.back.face.dotsH}|${g.led.back.k}`;
			if (!faces.has(key)) faces.set(key, { vw, vh, d, phone });
		}
	}
	const jobs = [...faces.values()];
	const WORKERS = 4;
	const parts = Array.from({ length: WORKERS }, () => ({ phone: [], desk: [] }));
	jobs.forEach((j, i) => parts[i % WORKERS][j.phone ? 'phone' : 'desk'].push(j));
	const runOne = (phone, list) =>
		new Promise((resolve) => {
			if (!list.length) return resolve({ rows: [] });
			const p = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', SELF, 'child', phone ? '1' : '0', JSON.stringify(list.map((j) => [j.vw, j.vh, j.d]))], { cwd: APP, stdio: ['ignore', 'pipe', 'pipe'] });
			let out = '';
			let err = '';
			p.stdout.on('data', (b) => (out += b));
			p.stderr.on('data', (b) => (err += b));
			p.on('close', () => {
				const line = out.split('\n').find((l) => l.startsWith('RESULT '));
				resolve(line ? JSON.parse(line.slice(7)) : { error: (err || out).slice(-1500), rows: [] });
			});
		});
	const results = await Promise.all(parts.flatMap((P) => [runOne(true, P.phone), runOne(false, P.desk)]));
	const rows = results.flatMap((r) => r.rows);
	const errors = results.filter((r) => r.error).map((r) => r.error);
	let pass = 0;
	let fail = 0;
	const line = (ok, what, detail = '') => {
		if (ok) pass++;
		else fail++;
		console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${detail ? ': ' + detail : ''}`);
	};
	line(errors.length === 0 && rows.length === jobs.length, `every back board was drawn: ${rows.length} of ${jobs.length} distinct faces (from ${tried} windows and screen densities of the sweep)`, errors[0] ?? '');
	const by = (cls) => rows.filter((r) => cls.includes(r.cls));
	for (const [name, cls] of [['upright phones and tablets (portrait)', ['portrait']], ['sideways phones (phone)', ['phone']], ['desktop and tablet (desktop, tablet)', ['desktop', 'tablet']]]) {
		const R = by(cls);
		if (!R.length) continue;
		const off = R.flatMap((r) => r.off.map((x) => `${r.at} (${r.face}): ${x}`));
		const beside = R.flatMap((r) => r.beside.map((x) => `${r.at} (${r.face}): ${x}`));
		const worst = Math.max(0, ...R.map((r) => r.worst));
		line(off.length === 0, `1. ${name}, ${R.length} faces: every title and amount of the wins and the Total Wins is centered on the back board within 1 dot, margins equal within 2, clear of the sides and the top`, `${off.slice(0, 4).join(' | ')}${off.length > 4 ? ` (${off.length})` : ''}${off.length ? ' | ' : ''}the most off the middle ${worst} dots; titles at dot scale ${Math.min(...R.map((r) => r.ts[0]))} to ${Math.max(...R.map((r) => r.ts[1]))}, amounts ${Math.min(...R.map((r) => r.cap[0]))} to ${Math.max(...R.map((r) => r.cap[1]))} rows`);
		line(beside.length === 0, `2. ${name}: THE STACKED LAYOUT on the back board: every win's title stands over its amount, never beside it`, `${beside.slice(0, 4).join(' | ')}${beside.length > 4 ? ` (${beside.length})` : ''}`);
	}
	for (const at of ['390x844@3', '390x620@3']) {
		const r = rows.find((x) => x.at === at);
		if (!r) continue;
		line(r.pick.every((p) => p.ts >= 2 && p.cap >= 7 * p.ts && p.over), `3. ${at} (${r.face}), the probe host's face: THE PICK IS BY THE ROWS DRAWN: each win's title at dot scale 2 or more over an amount as tall or taller`, r.pick.map((p) => `${p.str}: title scale ${p.ts} (${7 * p.ts} rows), amount ${p.cap} rows${p.over ? '' : ', BESIDE'}`).join('; '));
	}
	// 4. the strip's amount at the probe host's upright phone: 25 rows, 21 inside its margins
	{
		const r = rows.find((x) => x.at === '390x844@3');
		if (r) {
			const S = r.strip;
			const inside = S.every((q) => q.rows > 0 && q.y >= 1 && q.y + q.rows <= q.H - 1 && q.x0 >= 1 && q.x1 <= q.W - 1);
			const short = S.filter((q) => q.str.length <= 7);
			const mid = S.filter((q) => q.str.length > 7 && q.str.length <= 9);
			line(inside && short.length >= 2 && short.every((q) => q.rows >= 21) && mid.length >= 1 && mid.every((q) => q.rows >= 14), `4. 390x844@3, the strip (${S[0]?.W} x ${S[0]?.H} dots): a win's amount fills the strip where it fits beside its title (21 rows of the 25 for an amount of 7 signs or under, 14 for one of 9), inside the face`, S.map((q) => `${q.str}: ${q.rows} rows at row ${q.y}, dots ${q.x0} to ${q.x1}`).join('; '));
		}
	}
	if (process.env.VERBOSE) for (const r of rows) console.log(`     ${r.at} ${r.cls} ${r.face}: worst ${r.worst}; titles ${r.ts.join('..')}, amounts ${r.cap.join('..')} rows`);
	console.log(`led_center_check: ${pass} pass, ${fail} fail`);
	process.exit(fail ? 1 : 0);
}

// ---- a child: one tier, a list of windows --------------------------------------------------------------------------------
const phoneTier = process.argv[3] === '1';
const LIST = JSON.parse(process.argv[4]);
install({ phoneTier, ratio: phoneTier ? 3 : 2 });
const { LED_BOARD } = await import(src('constants.ts'));
const draw = await import(src('scoreboard/scoreboardDraw.ts'));
const screens = await import(src('landing/ledScreens.ts'));
const { Scoreboard } = await import(src('scoreboard/scoreboard.ts'));
const { SCOREBOARD_ART } = await import(src('scoreboardArtSpec.ts'));
const { LED_ART } = await import(src('ledArtSpec.ts'));
const grid = await import(src('scoreboard/ledGrid.ts'));
let notes = [];
grid.setTextAudit((n) => notes.push(n));
draw.setScoreboardArt(patternSheet(SCOREBOARD_ART.width, SCOREBOARD_ART.height));
screens.setLedArt({ image: patternSheet(LED_ART.width, LED_ART.height), frames: LED_ART.frames });
const STEP = 1000 / LED_BOARD.fps;
const TITLE_MARGIN = 4;
const fmt = (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rows = [];
for (const [vw, vh, d] of LIST) {
	const ratio = await resolutionFor(vw, vh, d, phoneTier);
	const geo0 = await geometryFor(vw, vh);
	const sb = new Scoreboard();
	sb.deviceRatio = () => ratio;
	sb.layout(geo0, []);
	sb.manual = true;
	sb.env = { free: false, left: 0, idle: true, scatter: null };
	const off = [];
	const beside = [];
	const pick = [];
	const strip = [];
	let worst = 0;
	const ts = [Infinity, -Infinity];
	const cap = [Infinity, -Infinity];
	let face = '';
	let cls = '';
	/** the back board's records at rest: three samples 100 ms apart, grouped by title and by amount */
	const rest = () => {
		const by = new Map();
		for (let i = 0; i < 3; i++) {
			if (i) sb.step(100);
			if (sb.snapshot().lowering) break;
			const f = sb.faceStats('back');
			if (!f || !sb.backRoot.visible) continue;
			face = `${f.W} x ${f.H}`;
			for (const r of f.titles ?? []) {
				const key = r.kind === 'amount' ? 'amount' : r.str;
				if (!by.has(key)) by.set(key, []);
				by.get(key).push({ ...r, W: f.W, H: f.H });
			}
		}
		return by;
	};
	const judge = (what, by, win) => {
		let title = null;
		let amount = null;
		for (const [key, list] of by) {
			const W = list[0].W;
			const o = Math.max(...list.map((r) => Math.abs((r.x0 + r.x1) / 2 - W / 2)));
			const left = Math.min(...list.map((r) => r.x0));
			const right = W - Math.max(...list.map((r) => r.x1));
			const top = Math.min(...list.map((r) => r.y0 - r.lift));
			const isTitle = list[0].kind === 'title';
			worst = Math.max(worst, Math.round(o * 10) / 10);
			if (isTitle) {
				ts[0] = Math.min(ts[0], list[0].ts);
				ts[1] = Math.max(ts[1], list[0].ts);
				title = list[0];
			} else {
				const h = draw.rowCapEff(list[0].ts);
				cap[0] = Math.min(cap[0], h);
				cap[1] = Math.max(cap[1], h);
				amount = list[0];
			}
			const ok = o <= 1 && Math.abs(left - right) <= 2 && top >= 1 && (isTitle ? left >= TITLE_MARGIN && right >= TITLE_MARGIN : left >= 2 && right >= 2);
			if (!ok) off.push(`${what}: ${isTitle ? key : `the amount (${list[0].str})`} ${Math.round(o * 10) / 10} dots off the middle, ${left} and ${right} clear, ${top} under the top`);
		}
		if (win) {
			if (!title || !amount) off.push(`${what}: ${title ? 'no amount' : 'no title'} on the back board`);
			else {
				const over = title.y1 <= amount.y0;
				if (!over) beside.push(`${what}: ${title.str} rows ${title.y0}..${title.y1} beside the amount's ${amount.y0}..${amount.y1}`);
				pick.push({ str: amount.str, ts: title.ts, cap: draw.rowCapEff(amount.ts), over });
			}
		}
	};
	const settle = () => {
		sb.endCard();
		sb.skip();
		sb.skip();
		sb.lower();
		for (let i = 0; i < 80 && (sb.snapshot().show || sb.snapshot().lowering); i++) sb.step(100);
		for (let i = 0; i < 10; i++) sb.step(100);
	};
	// the wins: started, their count landed (a press), held
	for (const [x, bet] of [[98.75, 1], [312.45, 1], [7777, 1], [7777, 1000]]) {
		void sb.win({ x, amount: Math.round(x * bet * 100) / 100, bet, fmt, rate: 1, auto: false });
		sb.step(STEP);
		let sn = sb.snapshot();
		cls = sn.cls;
		// (a press lands the count, as a player's does; then on to the hold)
		for (let i = 0; i < 12 && sn.show && sn.show.phase !== 'count' && sn.show.phase !== 'hold'; i++) {
			sb.step(100);
			sn = sb.snapshot();
		}
		sb.skip();
		for (let i = 0; i < 400 && sn.show && sn.show.phase !== 'hold'; i++) {
			sb.step(100);
			sn = sb.snapshot();
		}
		// (a Max win's hold opens on its wash: the title and the amount come up a few steps in)
		const both = () => {
			const t = sb.faceStats('back')?.titles ?? [];
			return t.some((r) => r.kind === 'title') && t.some((r) => r.kind === 'amount');
		};
		for (let i = 0; i < 10 && sn.show && sn.show.phase === 'hold' && !both(); i++) {
			sb.step(100);
			sn = sb.snapshot();
		}
		if (!sn.show || sn.show.phase !== 'hold') off.push(`the ${x}x win at ${bet}: no hold reached (${sn.show?.phase ?? 'no show'})`);
		else {
			judge(`the ${fmt(x * bet)} win`, rest(), true);
			// the strip's own line at rest: the amount's row (the text audit's note of it: its rows and its place)
			notes = [];
			sb.step(STEP);
			const st = sb.faceStats('strip');
			const row = notes.filter((n) => n.kind === 'row' && n.canvas.width === st.W * st.k && n.canvas.height === st.H * st.k).at(-1);
			strip.push({ str: fmt(x * bet), H: st.H, rows: row ? row.h : 0, y: row ? row.y : -1, x0: row ? row.x : -1, x1: row ? row.x + row.w : -1, W: st.W });
		}
		settle();
	}
	// the Total Wins: stepped to their wait
	for (const [x, play, capped] of [[248.5, 1, false], [7777, 1000, true]]) {
		sb.card({ kind: 'total', spins: 0, amount: x * play, fmt, rate: 1, title: capped ? 'MAX WIN' : null, line: null, x, capped, auto: false, presents: 0 });
		sb.step(STEP);
		let sn = sb.snapshot();
		for (let i = 0; i < 12 && sn.show && sn.show.t < sn.show.countStart + 100; i++) {
			sb.step(100);
			sn = sb.snapshot();
		}
		sb.skip();
		sn = sb.snapshot();
		for (let i = 0; i < 400 && sn.show && !(sn.show.t > sn.show.countEnd + 1300); i++) {
			sb.step(100);
			sn = sb.snapshot();
		}
		if (!sn.show) off.push(`the Total Win ${fmt(x * play)}: no card`);
		else judge(`the Total Win ${fmt(x * play)}`, rest(), false);
		settle();
	}
	rows.push({ at: `${vw}x${vh}@${d}`, cls, face, off, beside, pick, strip, worst, ts, cap });
}
// (the whole line out before the process ends: a long line through a pipe is cut by an exit)
process.stdout.write('RESULT ' + JSON.stringify({ rows }) + '\n', () => process.exit(0));
