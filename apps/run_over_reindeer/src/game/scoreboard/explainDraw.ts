// THE EXPLANATION ON THE BIG BOARD (Corey 2026-11-18: "This explanation should really be on the bigger LED board, not cramped
// on the smaller one"; constants LED_BOARD.explain). On a bonus entry (Free Spins, Super) and a wrap-up that carries a line
// (a top-up, the cap) the sentence the strip used to scroll is shown on the BACK BOARD, whole and still, in the board's own
// 5 x 7 face (wrapped into centered lines at the largest size that fits; never clipped, never scrolled); the strip then
// carries PRESS ANYWHERE TO CONTINUE alone. Two layouts on the tune panel:
//   A  one page from the scene's READY beat: the count and the title smaller in the upper part (with the presents beside
//      them on an entry), the sentence in two or three centered lines under them
//   B  two pages from the READY beat: the scene's own big page, then a wipe to a page with the sentence alone, alternating
//      (pageMs each) until the press
// Plain 2D canvas drawing on the board's face, as everything on it. On the finer grid (2026-11-19, ledGrid.ts) the pages
// are faces of the board's density, the sentence's glyphs are drawn in LED_BOARD.density.bodyWeight on today's cells, and
// the wipe's edge and the confetti are set in LEDs.
import { LED_BOARD } from '../constants';
import { drawText, textW, type Cv } from '../landing/ledScreens';
import { clearP, copyFace, copyP, dotAt, fillP, kOf, ledN, mkFace } from './ledGrid';
import { BULBS, boardTitle, chaseBorder, drawFit, drawRow, fitCap, lineInk, rowInfo, sparkles, sprite, type Face } from './scoreboardDraw';

type Ctx = CanvasRenderingContext2D;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => {
	t = clamp(t, 0, 1);
	return t * t * (3 - 2 * t);
};

/** a sentence in lines no wider than maxW at scale z (words kept whole; a word wider than the line stands alone) */
export function wrapLines(str: string, z: number, maxW: number): string[] {
	const words = str.split(/\s+/).filter(Boolean);
	const out: string[] = [];
	let cur = '';
	for (const w of words) {
		const next = cur ? cur + ' ' + w : w;
		if (!cur || textW(next, z) <= maxW) cur = next;
		else {
			out.push(cur);
			cur = w;
		}
	}
	if (cur) out.push(cur);
	return out;
}

/** the sentence's fit in a box: the largest scale (and its lines) whose lines all fit the width and whose block fits the
 *  height, at most maxLines lines (more only at scale 1, never clipped: the block then takes the height it needs) */
export function fitSentence(str: string, W: number, H: number, maxLines: number) {
	for (const z of [4, 3, 2, 1]) {
		const lines = wrapLines(str, z, W);
		const lineH = 7 * z + Math.max(2, z * 2);
		const h = lines.length * lineH - Math.max(2, z * 2);
		if (lines.length <= maxLines && h <= H && lines.every((l) => textW(l, z) <= W)) return { z, lines, lineH, h };
	}
	const lines = wrapLines(str, 1, W);
	return { z: 1, lines, lineH: 9, h: lines.length * 9 - 2 };
}

/** what the board's explanation shows now (the probe): the page, the text box in dots, the lines, the scale */
export type ExplainInfo = { layout: 'A' | 'B' | 'C1' | 'C2'; page: 'scene' | 'explain' | 'wipe'; box: { x: number; y: number; w: number; h: number } | null; head: { x: number; y: number; w: number; h: number } | null; lines: string[]; z: number; W: number; H: number; presents: { name: string; x: number; y: number; w: number; h: number }[] };
const explainRec = new WeakMap<object, ExplainInfo>();
export const explainOf = (canvas: object): ExplainInfo | null => explainRec.get(canvas) ?? null;
export const clearExplain = (canvas: object) => explainRec.delete(canvas);

/** THE PRESENTS BESIDE THE COUNT (Corey 2026-11-19: "on super free spins the presents next tot he 10 Super free spins should
 *  also be red"): the Super entry's are the red present (the Super scatter), the Free Spins entry's the teal one */
const presentFor = (head: ExplainHead) => (head.kind === 'entry' && head.title.startsWith('SUPER') ? 'present_red' : 'present');
/** the presents drawn on the page this step, each its picture and box in dots (the probe) */
let presDrawn: { name: string; x: number; y: number; w: number; h: number }[] = [];
function presFit(g: Ctx, name: 'present' | 'present_red', box: { x: number; y: number; w: number; h: number }) {
	drawFit(g, name, box);
	presDrawn.push({ name, x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) });
}

/** the head of a page: a count with a title (an entry: "10" and FREE SPINS, the presents beside them) or a title over an
 *  amount (a wrap-up), fitted in the band y0..y0+bandH; returns its drawn box */
export type ExplainHead = { kind: 'entry'; count: string; title: string; color: string } | { kind: 'total'; title: string; amount: string; color: string };
function drawHead(g: Ctx, W: number, y0: number, bandH: number, head: ExplainHead) {
	const m = 4;
	if (head.kind === 'entry') {
		// one row: the count (the heavy face) and the title (the 5 x 7 face), the presents either side when they fit; the
		// count and the title shrink together, the presents go first
		let cap = Math.max(5, Math.floor(bandH * 0.8));
		const tsOf = (c: number) => [4, 3, 2, 1].find((z) => 7 * z <= c * 0.62) ?? 1;
		const rowW = (c: number) => rowInfo(head.count, c).w + 6 + textW(head.title, tsOf(c));
		const presOf = (c: number) => Math.round(c * 1.05);
		const presW = (c: number) => Math.round((presOf(c) * 180) / 201);
		let showPres = true;
		while (cap > 5 && rowW(cap) + (showPres ? 2 * (presW(cap) + 6) : 0) > W - 2 * m) {
			if (showPres && rowW(cap) <= W - 2 * m) showPres = false;
			else cap -= 1;
		}
		const ts = tsOf(cap);
		const pres = presOf(cap);
		const total = rowW(cap);
		const x0 = Math.round((W - total) / 2);
		const yc = y0 + bandH / 2;
		drawRow(g, head.count, x0, Math.round(yc - cap / 2), cap, head.color === '#ffd23a' ? 'gold' : '#ffffff', 0);
		drawText(g, head.title, x0 + rowInfo(head.count, cap).w + 6, Math.round(yc - (7 * ts) / 2), ts, head.color);
		if (showPres) {
			const pn = presentFor(head);
			sprite(g, pn, x0 - presW(cap) - 6, Math.round(yc + pres / 2), pres);
			sprite(g, pn, x0 + total + 6, Math.round(yc + pres / 2), pres);
			for (const x of [x0 - presW(cap) - 6, x0 + total + 6]) presDrawn.push({ name: pn, x: Math.round(x), y: Math.round(yc - pres / 2), w: presW(cap), h: pres });
		}
		const l = showPres ? x0 - presW(cap) - 6 : x0;
		return { x: l, y: Math.round(yc - Math.max(cap, showPres ? pres : 0) / 2), w: showPres ? total + 2 * (presW(cap) + 6) : total, h: Math.max(cap, showPres ? pres : 0) };
	}
	// a wrap-up: the title over the amount
	const ts = [3, 2, 1].find((z) => 7 * z <= bandH * 0.3 && textW(head.title, z) <= W - 2 * m) ?? 1;
	const gap = Math.max(2, Math.round(bandH * 0.06));
	const cap = fitCap(head.amount, W - 2 * m - 8, Math.max(5, bandH - 7 * ts - gap));
	const bh = 7 * ts + gap + cap;
	const y = Math.round(y0 + (bandH - bh) / 2);
	drawText(g, head.title, Math.round((W - textW(head.title, ts)) / 2), y, ts, head.color);
	const aw = rowInfo(head.amount, cap).w;
	drawRow(g, head.amount, Math.round((W - aw) / 2), y + 7 * ts + gap, cap, 'gold', 0);
	return { x: Math.round(Math.min((W - textW(head.title, ts)) / 2, (W - aw) / 2)), y, w: Math.max(textW(head.title, ts), aw), h: bh };
}

/** the sentence in its band (centered lines), returns the text box */
function drawSentence(g: Ctx, W: number, y0: number, bandH: number, sentence: string, color: string, maxLines: number) {
	const m = 6;
	const fit = fitSentence(sentence, W - 2 * m, bandH, maxLines);
	const y = Math.round(y0 + (bandH - fit.h) / 2);
	let bx = W;
	let bw = 0;
	fit.lines.forEach((l, i) => {
		const w = textW(l, fit.z);
		const x = Math.round((W - w) / 2);
		bx = Math.min(bx, x);
		bw = Math.max(bw, w);
		drawText(g, l, x, y + i * fit.lineH, fit.z, color);
	});
	return { fit, box: { x: bx, y, w: bw, h: fit.h } };
}

// ---- LAYOUT C (Corey 2026-11-18, round 2: "There is so much room in B without actually having to switch screens") ----------
// ONE page with B's own look: the snow and lights frame and the scene's background, the two presents, the "10" (white; gold
// on Super) and FREE SPINS in its blue (Super: SUPER in gold over FREE SPINS in red) as a compact lockup, and the sentence in
// the HEAVY face (the board's amount face, game/scoreboard/scoreboardDraw.ts drawRow) filling the rest to the frame. One
// margin all round and between the lockup and the sentence; the block is centred, no dead band. Two compositions:
//   C1  the lockup on top (one row on a wide board: present, 10, FREE SPINS, present; stacked on an upright board: present
//       10 present, then the words), the sentence under it
//   C2  (wide boards) the number with a present over it in the left third, the words and the sentence in the right two
//       thirds; an upright board falls back to C1
// The sizes are searched together: the lockup as large as it can be while the sentence keeps a reading size (at least
// readShare of the number's height and LED_BOARD.explain.minCap dots), the sentence in at most maxLines lines.
type Box = { x: number; y: number; w: number; h: number };
const heavyW = (str: string, cap: number) => rowInfo(str, cap).w;
/** the sentence in the heavy face: the largest cap whose lines (at most `maxLines`) fit `w` and whose block fits `h` */
function fitHeavy(str: string, w: number, h: number, maxLines: number, capMax: number) {
	const words = str.split(/\s+/).filter(Boolean);
	for (let cap = Math.max(5, Math.floor(capMax)); cap >= 5; cap--) {
		const lines: string[] = [];
		let cur = '';
		let ok = true;
		for (const wd of words) {
			const next = cur ? cur + ' ' + wd : wd;
			if (!cur || heavyW(next, cap) <= w) cur = next;
			else {
				lines.push(cur);
				cur = wd;
			}
			if (heavyW(cur, cap) > w) ok = false;
		}
		if (cur) lines.push(cur);
		const lh = Math.round(cap * 1.32);
		const bh = lines.length * lh - (lh - cap);
		if (ok && lines.length <= maxLines && bh <= h) return { cap, lines, lh, bh };
	}
	return null;
}
function drawHeavyLines(g: Ctx, lines: string[], cap: number, lh: number, cx: number, y: number, color: string) {
	let bx = Infinity;
	let bw = 0;
	lines.forEach((l, i) => {
		const w = heavyW(l, cap);
		const x = Math.round(cx - w / 2);
		bx = Math.min(bx, x);
		bw = Math.max(bw, w);
		// (the body text: its own weight on the finer grid, on today's cells; today's grid keeps the heavy face)
		drawRow(g, l, x, y + i * lh, cap, color, 0, kOf(g) === 1 ? 900 : LED_BOARD.density.bodyWeight);
	});
	return { x: bx, w: bw };
}
/** B's background at its READY beat: Free Spins the blue wash, the lights' chase and the confetti; Super the night sky, the
 *  sparkles, the double chase and the moon */
function entryBackdrop(g: Ctx, W: number, H: number, t: number, sup: boolean, total: boolean) {
	if (sup) {
		g.fillStyle = 'rgba(8,16,60,0.85)';
		g.fillRect(0, 0, W, H);
		// (fewer sparkles than the scene's, so the sentence stays clean)
		sparkles(g, W, H, t, Math.round((W * H) / 600), ['#ffffff', '#cfe8ff'], 41);
		chaseBorder(g, W, H, t, ['#ff3a2e', '#ffd23a'], 1, 3);
		// (the inner border three dots in: an inset, never a moved context)
		if (H >= 40) chaseBorder(g, W - 6, H - 6, t + 180, ['#ffd23a', '#ff3a2e'], 1, 3, 3);
		return;
	}
	g.fillStyle = 'rgba(30,90,220,0.14)';
	g.fillRect(0, 0, W, H);
	chaseBorder(g, W, H, t, total ? ['#36ff74', '#ff3a2e'] : ['#36ff74', '#ffffff', '#ff3a2e', '#ffffff'], H >= 60 ? 2 : 1, 3);
	const n = Math.round((W * H) / 140);
	for (let k = 0; k < n; k++) {
		const x = (hashC(k * 5.3) * W + Math.sin(t / 500 + k) * 2 + W) % W;
		const y = (hashC(k * 2.7) * H + t * (0.01 + hashC(k) * 0.012)) % H;
		g.globalAlpha = 0.45;
		dotAt(g, x, y, BULBS[k % 4]);
	}
	g.globalAlpha = 1;
}
const hashC = (n: number) => {
	const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};
/** the title words of the lockup (Free Spins: FREE SPINS in blue; Super: SUPER gold over FREE SPINS red; a wrap-up: its title) */
const titleWords = (head: ExplainHead, sup: boolean): [string, string][] =>
	head.kind === 'total' ? [[head.title, '#ffffff']] : sup ? [['SUPER', '#ffd23a'], ['FREE SPINS', '#ff6a4a']] : [['FREE SPINS', '#7cc4ff']];
const titleBlock = (words: [string, string][], ts: number) => ({ w: Math.max(...words.map(([w]) => lineInk(w, ts).w)), h: words.length * 7 * ts + (words.length - 1) * Math.max(2, ts) });

/** draws layout C on `g` (W x H dots); returns the lockup's and the sentence's boxes and the fit */
export function drawLayoutC(g: Ctx, W: number, H: number, t: number, head: ExplainHead, sentence: string, color: string, variant: 'C1' | 'C2') {
	const X = LED_BOARD.explain;
	const sup = head.kind === 'entry' && head.title.startsWith('SUPER');
	const total = head.kind === 'total';
	entryBackdrop(g, W, H, t, sup, total);
	const frame = H >= 60 ? 3 : 2;
	const m = Math.max(3, Math.round(Math.min(W, H) * X.margin));
	const ix = frame + m;
	const iy = frame + m;
	const iw = W - 2 * ix;
	const ih = H - 2 * iy;
	const num = head.kind === 'total' ? head.amount : head.count;
	const numStyle = head.kind === 'total' || sup ? 'gold' : '#ffffff';
	const wide = W / H >= 1.45;
	// beside the number on a wide board the words stack a word a line (FREE over SPINS; SUPER, FREE, SPINS), so they can be
	// as tall as the number; elsewhere a line each
	const words0 = titleWords(head, sup);
	const split: [string, string][] = words0.flatMap(([w, c]) => w.split(' ').map((x) => [x, c] as [string, string]));
	const arrangements: [string, string][][] = wide && !total && variant !== 'C2' && split.length > words0.length ? [words0, split] : [words0];
	const c2 = variant === 'C2' && wide && !total;
	const pn = presentFor(head);
	const minCap = X.minCap;
	// (the search runs once per board size and text: the plan is kept, each frame only draws it)
	const key = `${W}x${H}|${variant}|${num}|${words0.map((w) => w[0]).join('/')}|${sentence}|${X.maxLinesC}|${X.minCap}|${X.readShare}|${X.margin}`;
	let best: Plan | null = planCache.get(key) ?? null;
	const consider = (score: number, draw: Plan['draw']) => {
		if (!best || score > best.score) best = { score, draw };
	};
	// (a board too small for the rules as set relaxes them a step at a time: the words may go to size 1, then the sentence
	// may take two more lines and a smaller share of the number; it is never clipped)
	for (let relax = 0; relax < 3 && !best; relax++) for (const words of arrangements) for (let cap = Math.floor(ih * 0.62); cap >= 8; cap -= 1) {
		const pres = total ? 0 : Math.round(cap * 1.0);
		const presW = Math.round((pres * 180) / 201);
		const nw = heavyW(num, cap);
		const gap = Math.max(3, Math.round(cap * 0.18));
		// the words as large as the number's height allows (two lines on Super: SUPER over FREE SPINS) and as the room beside
		// or under the number allows
		const room = c2 ? iw - Math.max(nw, presW) - m * 2 : wide && !total ? iw - (presW * 2 + nw + gap * 3) : iw;
		const beside = wide && !total && !c2;
		const tsMax = Math.max(1, beside ? Math.floor(cap / (7 * words.length + (words.length - 1) * 1.3)) : Math.floor((cap * (c2 ? 0.45 : 0.5)) / 7));
		let ts = Math.min(6, tsMax);
		while (ts > 1 && titleBlock(words, ts).w > room) ts -= 1;
		// (never a caption: the words at least size 2 on a board of 100 dots or more)
		if (ts < 2 && H >= 100 && relax === 0) continue;
		const tb = titleBlock(words, ts);
		let lockW: number;
		let lockH: number;
		let textW0: number;
		let textH: number;
		if (c2) {
			// left column: a present over the number; right: the words over the sentence
			const colW = Math.max(nw, presW);
			lockW = colW;
			lockH = pres + gap + cap;
			if (lockH > ih || colW > iw * 0.4) continue;
			textW0 = iw - colW - m * 2;
			textH = ih - tb.h - m;
			if (lockW + m * 2 + tb.w > iw) continue;
		} else if (wide || total) {
			// one row: present, number, words, present (a wrap-up: the title over the amount)
			lockW = total ? Math.max(nw, tb.w) : presW + gap + nw + gap + tb.w + gap + presW;
			lockH = total ? tb.h + gap + cap : Math.max(cap, pres, tb.h);
			if (lockW > iw) continue;
			textW0 = iw;
			textH = ih - lockH - m;
		} else {
			// stacked: present, number, present; then the words
			lockW = Math.max(presW + gap + nw + gap + presW, tb.w);
			lockH = Math.max(cap, pres) + gap + tb.h;
			if (lockW > iw) continue;
			textW0 = iw;
			textH = ih - lockH - m;
		}
		if (textH < minCap) continue;
		const fit = fitHeavy(sentence, textW0, textH, X.maxLinesC + (relax === 2 ? 2 : 0), Math.min(cap * 0.62, textH));
		if (!fit || fit.cap < Math.max(minCap, Math.round(cap * X.readShare * (relax === 2 ? 0.6 : 1)))) continue;
		// the bigger the sentence and the number together, the better; the sentence counts double (it must be read)
		const score = fit.cap * 2 + cap + ts * 5;
		consider(score, (g: Ctx) => {
			if (c2) {
				const blockH = Math.max(lockH, tb.h + m + fit.bh);
				const y0 = iy + Math.round((ih - blockH) / 2);
				const colW = Math.max(nw, presW);
				const lx = ix;
				const ly = y0 + Math.round((blockH - lockH) / 2);
				if (pres) presFit(g, pn, { x: lx + (colW - presW) / 2, y: ly, w: presW, h: pres });
				drawRow(g, num, Math.round(lx + (colW - nw) / 2), ly + pres + gap, cap, numStyle, 0);
				const rx = ix + colW + m * 2;
				const rw = iw - colW - m * 2;
				const rcx = rx + rw / 2;
				const ty = y0 + Math.round((blockH - (tb.h + m + fit.bh)) / 2);
				words.forEach(([w, c], i) => boardTitle(g, w, rcx, ty + i * (7 * ts + Math.max(2, ts)), ts, c, { word: true }));
				const tx = drawHeavyLines(g, fit.lines, fit.cap, fit.lh, rcx, ty + tb.h + m, color);
				return { head: { x: lx, y: ly, w: colW, h: lockH }, text: { x: tx.x, y: ty + tb.h + m, w: tx.w, h: fit.bh }, fit };
			}
			const blockH = lockH + m + fit.bh;
			const y0 = iy + Math.round((ih - blockH) / 2);
			const cx = W / 2;
			const lx = Math.round(cx - lockW / 2);
			if (total) {
				words.forEach(([w, c], i) => boardTitle(g, w, cx, y0 + i * (7 * ts + Math.max(2, ts)), ts, c, { word: true }));
				drawRow(g, num, Math.round(cx - nw / 2), y0 + tb.h + gap, cap, numStyle, 0);
			} else if (wide) {
				const rowH = lockH;
				const yc = y0 + rowH / 2;
				let x = lx;
				presFit(g, pn, { x, y: Math.round(yc - pres / 2), w: presW, h: pres });
				x += presW + gap;
				drawRow(g, num, x, Math.round(yc - cap / 2), cap, numStyle, 0);
				x += nw + gap;
				const tcx = x + tb.w / 2;
				const ty = Math.round(yc - tb.h / 2);
				words.forEach(([w, c], i) => boardTitle(g, w, tcx, ty + i * (7 * ts + Math.max(2, ts)), ts, c, { word: true }));
				x += tb.w + gap;
				presFit(g, pn, { x, y: Math.round(yc - pres / 2), w: presW, h: pres });
			} else {
				const r1 = Math.max(cap, pres);
				const rowW = presW + gap + nw + gap + presW;
				let x = Math.round(cx - rowW / 2);
				presFit(g, pn, { x, y: y0 + (r1 - pres) / 2, w: presW, h: pres });
				x += presW + gap;
				drawRow(g, num, x, y0 + Math.round((r1 - cap) / 2), cap, numStyle, 0);
				x += nw + gap;
				presFit(g, pn, { x, y: y0 + (r1 - pres) / 2, w: presW, h: pres });
				words.forEach(([w, c], i) => boardTitle(g, w, cx, y0 + r1 + gap + i * (7 * ts + Math.max(2, ts)), ts, c, { word: true }));
			}
			const ty = y0 + lockH + m;
			const tx = drawHeavyLines(g, fit.lines, fit.cap, fit.lh, cx, ty, color);
			return { head: { x: lx, y: y0, w: lockW, h: lockH }, text: { x: tx.x, y: ty, w: tx.w, h: fit.bh }, fit };
		});
	}
	if (best) {
		if (planCache.size > 40) planCache.clear();
		planCache.set(key, best);
	}
	if (!best) {
		// (never clipped: a board too small for both keeps the sentence alone, at the size that fits)
		const fit = fitHeavy(sentence, iw, ih, 8, ih) ?? { cap: 5, lines: [sentence], lh: 7, bh: 5 };
		const y = iy + Math.round((ih - fit.bh) / 2);
		const tx = drawHeavyLines(g, fit.lines, fit.cap, fit.lh, W / 2, y, color);
		return { head: null as Box | null, text: { x: tx.x, y, w: tx.w, h: fit.bh }, fit };
	}
	return (best as Plan).draw(g);
}
type Plan = { score: number; draw: (g: Ctx) => { head: Box; text: Box; fit: { cap: number; lines: string[] } } };
const planCache = new Map<string, Plan>();

/** the two pages' own canvases, per face size (the scene draws on the face's own scratch canvases) */
const pages = new Map<string, { scene: Cv; page: Cv }>();
const pagesFor = (W: number, H: number, k: number) => {
	const key = W + 'x' + H + '|' + k;
	let p = pages.get(key);
	if (!p) {
		// (one back board at a time: a new size or density lets the old pages go, none is kept)
		pages.clear();
		p = { scene: mkFace(W, H, k), page: mkFace(W, H, k) };
		pages.set(key, p);
	}
	return p;
};

/** THE PAGE NOW: `t` ms since the READY beat (the press line's time), `scene` draws the show's own big page on the face, the
 *  head and the sentence make the explanation's page */
export function showExplain(F: Face, t: number, scene: (F: Face) => void, head: ExplainHead, sentence: string, color: string, border: string[]) {
	const X = LED_BOARD.explain;
	const W = F.dotsW;
	const H = F.dotsH;
	const o = F.out.ctx;
	const P = pagesFor(W, H, F.k);
	// the explanation's page
	const g = P.page.ctx;
	g.clearRect(0, 0, W, H);
	presDrawn = [];
	const C = X.layout === 'C1' || X.layout === 'C2';
	if (!C) {
		g.fillStyle = 'rgba(30,90,220,0.12)';
		g.fillRect(0, 0, W, H);
		chaseBorder(g, W, H, t, border, H >= 60 ? 2 : 1, 3);
	}
	let hb: ExplainInfo['head'] = null;
	let sb: { fit: { z: number; lines: string[] }; box: { x: number; y: number; w: number; h: number } };
	if (C) {
		// LAYOUT C (round 2): one page, B's look with the sentence in the heavy face; `z` reports the sentence's cap in dots
		const r = drawLayoutC(g, W, H, t, head, sentence, color, X.layout as 'C1' | 'C2');
		hb = r.head;
		sb = { fit: { z: r.fit.cap, lines: r.fit.lines }, box: r.text };
	} else if (X.layout === 'A') {
		const headH = Math.round(H * X.headShare);
		hb = drawHead(g, W, 3, headH - 3, head);
		sb = drawSentence(g, W, headH + 2, H - headH - 5, sentence, color, X.maxLines);
	} else sb = drawSentence(g, W, 4, H - 8, sentence, color, X.maxLines);
	// which page, and the wipe into it
	let from: Cv | null = null;
	let to: Cv;
	let u = 1;
	let onPage: boolean;
	const sceneNow = () => {
		scene(F);
		P.scene.ctx.clearRect(0, 0, W, H);
		copyFace(P.scene.ctx, F.out);
		return P.scene;
	};
	if (X.layout !== 'B') {
		onPage = true;
		to = P.page;
		if (t < X.wipeMs) {
			from = sceneNow();
			u = t / X.wipeMs;
		}
	} else {
		const [p1, p2] = X.pageMs;
		const k = t % (p1 + p2);
		onPage = k >= p1;
		const since = onPage ? k - p1 : k;
		if (onPage) {
			to = P.page;
			if (since < X.wipeMs) {
				from = sceneNow();
				u = since / X.wipeMs;
			}
		} else {
			to = sceneNow();
			if (since < X.wipeMs && t >= X.wipeMs) {
				from = P.page;
				u = since / X.wipeMs;
			}
		}
	}
	o.clearRect(0, 0, W, H);
	if (from && u < 1) {
		// (in LEDs: the edge runs LED by LED, two dots wide)
		const k = F.k;
		const sx = Math.round(ease(u) * (F.ledW + ledN(k, 6))) - ledN(k, 3);
		copyFace(o, from);
		if (sx > 0) {
			clearP(o, 0, 0, sx, F.ledH);
			copyP(o, to, 0, 0, sx, F.ledH);
		}
		o.fillStyle = '#ffffff';
		o.globalAlpha = 0.9;
		fillP(o, sx, 0, ledN(k, 2), F.ledH);
		o.globalAlpha = 1;
	} else copyFace(o, to);
	const shown = onPage && !(from && u < 1);
	explainRec.set(o.canvas, { layout: X.layout, page: from && u < 1 ? 'wipe' : onPage ? 'explain' : 'scene', box: shown ? sb.box : null, head: shown ? hb : null, lines: sb.fit.lines, z: sb.fit.z, W, H, presents: presDrawn.slice() });
}
