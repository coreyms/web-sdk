// THE TOTAL WIN'S TAILLIGHT LADDER, round 1 pick (Corey 2026-11-19, led_anim_ideas_r1_2026-11-19 "tw-ladder"; constants
// LED_BOARD.ideas.total). The mock's drawing code (its total.ts ladderScene), ported: a back board program in place of
// scoreboardDraw.ts showTotalScene, a pure function of the show's clock. The count is the show's own (show.ts amountNow: with
// the ladder it runs on the house pacer, so every rung crossed gets its moment; the count's LENGTH is today's, or by size
// when LED_BOARD.ideas.totalBySize is switched on); a press while it counts lands it (landCard); the press line and Autoplay
// Bonuses' hold after the landing are the game's. The words are today's: TOTAL WIN (MAX WIN on a capped round) and the
// amount as the HUD writes it; the rungs carry their bars (15X to 7,777X).
//   The border is a row of taillights whose chase speeds up with the multiple shown. In the band the five rungs (the
//   game's own ladder: LED_BOARD.tiers' bars, the top one the math's cap, config.maxWin) light in their tier's color as the
//   count passes each one, the board flashing at each; the reindeer runs the fuse under them. A small win only creeps up
//   the fuse; a Max win lights every rung, the top rung blinks and the taillights flash red as it lands.
import { drawText, textW } from '../landing/ledScreens';
import { LED_BOARD } from '../constants';
import { PHONE_TIER } from '../deviceTier';
import { amountAtCount, ladderBars, winSizeOf, type Show } from './show';
import { boardClassNow, boardPitchNow, boardTitle, burst, rowInkV, centeredRow, cornerFireworks, drawRow, fitCap, fitScale, gallop, noteFlash, oneShot, perimeter, perimeterDots, rowInfo, sceneT, showTotalScene, titleGapKnob, titleScale, TOTAL_BLINK_DIM, type Face } from './scoreboardDraw';
import { dotAt, ledN } from './ledGrid';
import { box, clamp, ease, lerp, noteIdea, type Ctx } from './ideasKit';

const dot = dotAt;
/** the least dots between two rung labels */
const LABEL_GAP = 2;
/** the rungs' colors, in the tiers' order (Big green, Super blue, Mega red, Epic purple, Max gold) */
const RUNG_COLS = ['#36ff74', '#4aa8ff', '#ff3a2e', '#d36bff', '#ffd23a'];

/** the least band the ladder draws in: the fuse 4 rows down, the lamps 3 under it and 3 tall, a label of 7 two under them,
 *  a clear row and the border's */
const LADDER_BAND = 21;
type Lay = { band: number; Hm: number; title: string; tts: number; cap: number; G: number; y0: number; numY: number };
/** today's Total Win layout (showTotalScene's): the title over the amount above the bottom band */
function totalLay(W: number, H: number, s: Show, minBand = 0): Lay {
	const band = Math.max(Math.round(H * LED_BOARD.scenes.band), Math.min(minBand, Math.round(H * 0.4)));
	const Hm = H - band;
	const title = s.title ?? 'TOTAL WIN';
	const tts = titleScale(title, fitScale(title, W - 16, Hm * 0.2, [5, 4, 3, 2, 1]), W, Hm * 0.4);
	const cap = fitCap(s.finalStr, W - 16, Math.min(Hm * 0.55, Hm - 7 * tts - 12));
	const G = Math.max(-3, titleGapKnob());
	const y0 = Math.round((Hm - (7 * tts + 6 + G + cap)) / 2) + 2;
	return { band, Hm, title, tts, cap, G, y0, numY: y0 + 7 * tts + 6 + G };
}
/** the amount (the count, the landing blink that dims), as today's */
function amountRow(g: Ctx, W: number, s: Show, L: Lay, v: number) {
	const str = s.fmt(v);
	const w = rowInfo(str, L.cap).w;
	const since = s.t - s.countEnd;
	const landed = since >= 0;
	const blinkDim = landed && since < 900 && Math.floor(since / 150) % 2 === 1;
	const ax = centeredRow(g, str, W / 2, L.numY, L.cap, (W - w) / 2);
	if (blinkDim) g.globalAlpha = TOTAL_BLINK_DIM;
	const pulse = landed ? oneShot('pulse', since, 400) : 0;
	noteFlash(g.canvas, 'pulse', pulse);
	drawRow(g, str, ax, L.numY, L.cap, 'gold', pulse);
	g.globalAlpha = 1;
}
/** the count's value at show ms `at` (the show's own pacer) */
const valueAt = (s: Show, at: number) => (at >= s.countEnd ? s.amount : s.segs.length ? Math.min(s.amount, amountAtCount(s.segs, at - s.countStart)) : s.amount * clamp((at - s.countStart) / Math.max(1, s.countEnd - s.countStart), 0, 1));
/** the show ms the count reaches value `v` */
function reachOf(s: Show, v: number) {
	if (!s.segs.length) return s.countStart + (s.countEnd - s.countStart) * clamp(v / Math.max(1e-9, s.amount), 0, 1);
	let acc = s.countStart;
	let from = 0;
	for (const sg of s.segs) {
		if (v <= sg.to) return acc + (sg.ms * (v - from)) / Math.max(1e-9, sg.to - from);
		acc += sg.ms;
		from = sg.to;
	}
	return s.countEnd;
}
/** a rung's label: its bar in play multiples, as the game writes a multiple (7,777X) */
export const rungLabel = (bar: number) => `${bar.toLocaleString('en-US')}X`;

/** THE MARKS' SCALE (the labels' dot scale z, the lamps' and the runner's factor f, the lamps' size, the runner's height) for
 *  a face: at board size d on every layout (LED_BOARD.sizeD.ladderRule 'amount'; 'desktop' is f3e9bab's desktop and tablet
 *  class only) a label's height comes to the share of the amount's cap it has on today's upright phone board for the same
 *  amount (LED_BOARD.sizeD.ladderPhoneFace), and to ladderLabelMinCss CSS px at the least, never under today's (factor 1); cut
 *  back until the labels clear each other and the border's bottom row and the runner clears the amount's lowest lit row (its
 *  stems and comma included) */
function ladderMarks(H: number, s: Show, L: Lay, fy: number, n: number, span: number, fine: boolean) {
	const ink = rowInkV(s.finalStr, L.cap);
	const amount = { y0: L.numY + ink.t, y1: L.numY + ink.b + 1 };
	const border = 1;
	const rh0 = Math.max(7, Math.round(L.band * 0.5));
	const K = LED_BOARD.sizeD;
	const rule = K.ladderRule === 'desktop' ? 'desktop' : 'amount';
	const pitch = boardPitchNow();
	const r3 = (v: number) => Math.round(v * 1000) / 1000;
	// (today's marks: lamps and runner from the face's own band, labels at size 1)
	const base = { f: 1, z: 1, rh: rh0, lampW: Math.max(3, Math.round(L.band * 0.2)), lampH: Math.max(2, Math.round(L.band * 0.13)), amount, border, ratio: r3(7 / L.cap), limited: false, want: 1, byAmount: 1, byFloor: 0, rule, pitch: r3(pitch), labelCss: r3(7 * pitch), bandK: L.band, phoneRatio: null as number | null };
	if (LED_BOARD.size !== 'd') return base;
	// ('desktop', f3e9bab's rule, to compare: the desktop and tablet class only, no floor, the face's own band)
	if (rule === 'desktop' && boardClassNow() !== 'desktop') return base;
	// (the phone tier keeps today's marks, every phone upright or sideways: Corey's "phones unchanged"; ladderPhones opens it)
	if (rule === 'amount' && PHONE_TIER && !K.ladderPhones) return base;
	const gap = span / (n + 0.15);
	const labels = ladderBars().map(rungLabel);
	// THE FACTOR: today's upright phone board's proportion for the same amount (its face, sizeD.ladderPhoneFace, lays out the
	// same Total Win: a rung label of 7 dots against its amount's cap), so this cap over the phone's cap; on every layout
	// ('amount') also as large as a label of ladderLabelMinCss CSS px takes at this face's pitch; never under 1 (a face whose
	// amount is the phone's or smaller keeps today's marks, untouched)
	const [pw, ph] = K.ladderPhoneFace;
	const P = totalLay(pw, ph, s);
	const byAmount = L.cap / P.cap;
	// (the rule's own proportion, for the probes: a label of 7 dots against this amount's cap on the phone face. Since the
	// smallest dot rule the live upright phone board is no longer this face, 167 dots across for 257)
	const phoneRatio = r3(7 / P.cap);
	const byFloor = rule === 'amount' && pitch > 0 ? K.ladderLabelMinCss / (7 * pitch) : 0;
	const want = Math.max(1, byAmount, byFloor);
	if (want <= 1) return { ...base, byAmount: r3(byAmount), byFloor: r3(byFloor), phoneRatio };
	// the band the lamps and the runner are sized over: the face's own (f3e9bab's), held on every layout ('amount') to at
	// most ladderBandSlack over the phone face's band, so they keep the phone's share of the amount on a tall face too
	const bandK = rule === 'amount' ? Math.min(L.band, P.band * (1 + Math.max(0, K.ladderBandSlack))) : L.band;
	for (let f = want; f >= 1; f -= 0.05) {
		// (the labels' dot scale: the factor itself on the finer grid, where the 5 x 7 face is redrawn at any size; today's
		// grid draws whole scales only)
		const z = fine ? Math.round(f * 100) / 100 : Math.max(1, Math.round(f));
		const lampW = Math.max(3, Math.round(bandK * 0.2 * f));
		const lampH = Math.max(2, Math.round(bandK * 0.13 * f));
		// the labels inside the face, a dot above the border's bottom row, and clear of each other by 3 dots
		if (fy + 3 + lampH + 2 + 7 * z > H - border - 1) continue;
		if (Math.max(...labels.map((l) => textW(l, z))) > gap - 3) continue;
		// the runner as much larger as the room under the amount allows (its top, a hop of 2 included, a dot under the
		// amount's lowest lit row), never smaller than today's
		const rh = Math.max(rh0, Math.min(Math.round(bandK * 0.5 * f), fy - 1 - 2 - (amount.y1 + 1)));
		return { f: Math.round(f * 100) / 100, z, rh, lampW, lampH, amount, border, ratio: r3((7 * z) / L.cap), limited: f < want - 1e-6, want: Math.round(want * 100) / 100, byAmount: r3(byAmount), byFloor: r3(byFloor), rule, pitch: r3(pitch), labelCss: r3(7 * z * pitch), bandK: Math.round(bandK * 100) / 100, phoneRatio };
	}
	return { ...base, limited: true, want: Math.round(want * 100) / 100, byAmount: r3(byAmount), byFloor: r3(byFloor), phoneRatio };
}

export function ladderTotal(F: Face, s: Show) {
	// (a Total Win without its multiple, none in the game: today's scene)
	if (!(s.x > 0)) return showTotalScene(F, s);
	const g = F.out.ctx;
	const W = F.dotsW;
	const H = F.dotsH;
	const t = sceneT(s);
	g.clearRect(0, 0, W, H);
	// (2026-11-22, the smallest dot rule's short faces, under 96 dots tall: the band keeps the rows its fuse, lamps and a
	// 7 dot label take, LADDER_BAND, where the face's share of it is less; the label's foot was under the border at 69 dots)
	const L = totalLay(W, H, s, LADDER_BAND);
	const since = s.t - s.countEnd;
	const landed = since >= 0;
	const X = s.x;
	const size = winSizeOf(X, s.capped);
	const bars = ladderBars();
	const xOf = (v: number) => (v / Math.max(1e-9, s.amount)) * X;
	const vNow = valueAt(s, s.t);
	// the taillight chase: its speed from the multiple shown (a step every 140 ms at 1x down to 28 ms at the cap), integrated
	const per = (m: number) => lerp(140, 28, clamp(Math.log(1 + m) / Math.log(1 + bars[bars.length - 1]), 0, 1));
	let phase = 0;
	const tEnd = Math.min(s.t, s.countEnd);
	for (let q = s.countStart; q < tEnd; q += 30) phase += 30 / per(xOf(valueAt(s, q)));
	if (s.t > s.countEnd) phase += (s.t - s.countEnd) / per(X);
	if (s.t < s.countStart) phase = s.t / 140;
	const q = F.k;
	const pts = perimeter(F.ledW, F.ledH, 0, 1);
	const on = t < 400 ? Math.round((Math.max(0, t) / 400) * pts.length) : pts.length;
	const segP = ledN(q, 3);
	const st = Math.floor(phase * q);
	const allRed = landed && size === 'max' && since < 1200 && Math.floor(since / 150) % 2 === 0;
	perimeterDots(g, pts, on, (i) => (allRed ? '#ff3a2e' : Math.floor((i + st) / segP) % 2 ? '#ff2a1e' : '#5a1008'), 0, 0, { rows: ledN(q, 1), W: F.ledW, H: F.ledH });
	// the title drops in (as today's), the amount counts
	const dropT = clamp(t / 300, 0, 1);
	boardTitle(g, L.title, W / 2, Math.round(L.y0 - (1 - ease(dropT)) * H * 0.3), L.tts, '#ffffff', { word: true });
	amountRow(g, W, s, L, vNow);
	// the band: the fuse, the rungs, their labels
	const top = H - L.band;
	const xL = 8;
	const xR = W - 8;
	const n = bars.length;
	const rx = bars.map((_, i) => lerp(xL, xR, (i + 0.65) / (n + 0.15)));
	const posOf = (m: number) => {
		if (m <= bars[0]) return lerp(xL, rx[0], m / bars[0]);
		for (let i = 1; i < n; i++) if (m <= bars[i]) return lerp(rx[i - 1], rx[i], Math.log(m / bars[i - 1]) / Math.log(bars[i] / bars[i - 1]));
		return rx[n - 1];
	};
	const mNow = xOf(vNow);
	const fx = posOf(mNow);
	const fy = top + Math.round(L.band * 0.18);
	box(g, xL, fy, xR - xL, 1, '#3a2a14');
	box(g, xL, fy, Math.max(0, fx - xL), 1, '#ffd23a');
	// THE LADDER'S MARKS AT BOARD SIZE d (Corey 2026-11-20: "Yes" to enlarging them; 2026-11-21 on every layout, the upright
	// tablet included, LED_BOARD.sizeD.ladderRule): the rung labels, the lamps and the runner scale with the amount over them,
	// in the proportion they have on today's phone board (a label's height against the amount's cap,
	// LED_BOARD.sizeD.ladderPhoneFace), never under ladderLabelMinCss CSS px, as far as they stay clear of the amount above, of
	// each other and of the border's bottom row; a face whose amount is the phone's or smaller (the phones) and today's size
	// keep 1
	const M = ladderMarks(H, s, L, fy, bars.length, xR - xL, F.k > 1);
	const lampW = M.lampW;
	const lampH = M.lampH;
	const ly = fy + 3;
	const play = s.amount / X;
	const rec: { bar: number; label: string; lit: boolean; x: number; box: { x0: number; x1: number; y0: number; y1: number } }[] = [];
	// THE LABELS' PLACES: each under its rung; on a narrow face (the smallest dot rule's, under about 170 dots across, where
	// 150X and 7,777X met) moved along only as far as keeps them LABEL_GAP dots apart and inside the border
	const labs = bars.map(rungLabel);
	const lw = labs.map((l) => textW(l, M.z));
	const lx = labs.map((_, i) => Math.round(rx[i] - lw[i] / 2));
	for (let i = n - 1, right = W - 2; i >= 0; i--) {
		if (lx[i] + lw[i] > right) lx[i] = right - lw[i];
		right = lx[i] - LABEL_GAP;
	}
	for (let i = 0, left = 2; i < n; i++) {
		if (lx[i] < left) lx[i] = left;
		left = lx[i] + lw[i] + LABEL_GAP;
	}
	bars.forEach((b, i) => {
		// (the time each rung was reached: on the pacer the bar a segment ends on; the cap's rung as the count lands)
		const at = X >= b * (1 - 1e-9) ? Math.min(reachOf(s, b * play), s.countEnd) : Infinity;
		const lit = s.t >= at;
		const blink = i === n - 1 && lit && Math.floor(s.t / 160) % 2 === 0;
		const col = lit ? (blink ? '#ffffff' : RUNG_COLS[i % RUNG_COLS.length]) : '#3a1612';
		box(g, rx[i] - lampW - 1, ly, lampW, lampH, col);
		box(g, rx[i] + 1, ly, lampW, lampH, col);
		const lab = labs[i];
		drawText(g, lab, lx[i], ly + lampH + 2, M.z, lit ? RUNG_COLS[i % RUNG_COLS.length] : '#5a6170');
		if (lit && s.t - at < 450) burst(g, rx[i], ly + 1, (s.t - at) / 450, Math.round(L.band * 0.5));
		// the board flashes as a rung lights (LED_BOARD.strobe.ladderFlash: soft, a fade of the wash at softStrength)
		const wash = lit ? oneShot('ladderFlash', s.t - at, 120) : 0;
		if (wash > 0) {
			noteFlash(g.canvas, 'ladderFlash', wash);
			g.globalAlpha = 0.22 * wash;
			g.fillStyle = RUNG_COLS[i % RUNG_COLS.length];
			g.fillRect(0, 0, W, H);
			g.globalAlpha = 1;
		}
		rec.push({ bar: b, label: lab, lit, x: Math.round(rx[i]), box: { x0: lx[i], x1: lx[i] + lw[i], y0: ly + lampH + 2, y1: ly + lampH + 2 + 7 * M.z } });
	});
	// the reindeer runs the fuse (hops at a rung)
	const rh = M.rh;
	const near = bars.findIndex((b) => Math.abs(posOf(mNow) - posOf(b)) < 3 && X >= b);
	gallop(g, fx - rh * 0.9, fy - 1 - (near >= 0 ? 2 : 0), rh, s.t);
	// the spark at the fuse's tip
	if (!landed) dot(g, fx + 1, fy - (Math.floor(s.t / 60) % 2), '#ffffff');
	if (landed && size !== 'small') cornerFireworks(g, W, H, since, size === 'max' ? ['#ffd23a', '#ff3a2e', '#ffffff'] : ['#ffd23a', '#ffffff'], L.Hm);
	noteIdea(g.canvas, 'ladder', { size, x: Math.round(X * 100) / 100, rungs: rec, fuse: Math.round(fx), multiple: Math.round(mNow * 100) / 100, marks: { f: Math.round(M.f * 100) / 100, z: M.z, lampW, lampH, lampY: ly, runner: { h: rh, y0: fy - 1 - rh - 2, y1: fy - 1 }, amount: M.amount, cap: L.cap, band: L.band, W, H, border: M.border, ratio: M.ratio, limited: M.limited, want: M.want, byAmount: M.byAmount, byFloor: M.byFloor, rule: M.rule, pitch: M.pitch, labelCss: M.labelCss, bandK: M.bandK, phoneRatio: M.phoneRatio, fine: F.k > 1, phoneTier: PHONE_TIER, phoneBand: Math.round(LED_BOARD.sizeD.ladderPhoneFace[1] * LED_BOARD.scenes.band) } });
}
