// THE EXPLANATION ON THE BIG BOARD (Corey 2026-11-18: "This explanation should really be on the bigger LED board, not cramped
// on the smaller one"; constants LED_BOARD.explain). On a bonus entry (Free Spins, Super) and a wrap-up that carries a line
// (a top-up, the cap) the sentence the strip used to scroll is shown on the BACK BOARD, whole and still, in the board's own
// 5 x 7 face (wrapped into centered lines at the largest size that fits; never clipped, never scrolled); the strip then
// carries PRESS ANYWHERE TO CONTINUE alone. Two layouts on the tune panel:
//   A  one page from the scene's READY beat: the count and the title smaller in the upper part (with the presents beside
//      them on an entry), the sentence in two or three centered lines under them
//   B  two pages from the READY beat: the scene's own big page, then a wipe to a page with the sentence alone, alternating
//      (pageMs each) until the press
// Plain 2D canvas drawing on the board's face, as everything on it.
import { LED_BOARD } from '../constants';
import { drawText, mk, textW, type Cv } from '../landing/ledScreens';
import { chaseBorder, drawRow, fitCap, rowInfo, sprite, type Face } from './scoreboardDraw';

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
export type ExplainInfo = { layout: 'A' | 'B'; page: 'scene' | 'explain' | 'wipe'; box: { x: number; y: number; w: number; h: number } | null; head: { x: number; y: number; w: number; h: number } | null; lines: string[]; z: number; W: number; H: number };
const explainRec = new WeakMap<object, ExplainInfo>();
export const explainOf = (canvas: object): ExplainInfo | null => explainRec.get(canvas) ?? null;
export const clearExplain = (canvas: object) => explainRec.delete(canvas);

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
			sprite(g, 'present', x0 - presW(cap) - 6, Math.round(yc + pres / 2), pres);
			sprite(g, 'present', x0 + total + 6, Math.round(yc + pres / 2), pres);
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

/** the two pages' own canvases, per face size (the scene draws on the face's own scratch canvases) */
const pages = new Map<string, { scene: Cv; page: Cv }>();
const pagesFor = (W: number, H: number) => {
	const key = W + 'x' + H;
	let p = pages.get(key);
	if (!p) {
		if (pages.size > 6) pages.clear();
		p = { scene: mk(W, H), page: mk(W, H) };
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
	const P = pagesFor(W, H);
	// the explanation's page
	const g = P.page.ctx;
	g.clearRect(0, 0, W, H);
	g.fillStyle = 'rgba(30,90,220,0.12)';
	g.fillRect(0, 0, W, H);
	chaseBorder(g, W, H, t, border, H >= 60 ? 2 : 1, 3);
	let hb: ExplainInfo['head'] = null;
	let sb: ReturnType<typeof drawSentence>;
	if (X.layout === 'A') {
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
		P.scene.ctx.drawImage(F.out, 0, 0);
		return P.scene;
	};
	if (X.layout === 'A') {
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
		const sx = Math.round(ease(u) * (W + 6)) - 3;
		o.drawImage(from, 0, 0);
		if (sx > 0) {
			o.clearRect(0, 0, sx, H);
			o.drawImage(to, 0, 0, sx, H, 0, 0, sx, H);
		}
		o.fillStyle = '#ffffff';
		o.globalAlpha = 0.9;
		o.fillRect(sx, 0, 2, H);
		o.globalAlpha = 1;
	} else o.drawImage(to, 0, 0);
	const shown = onPage && !(from && u < 1);
	explainRec.set(o.canvas, { layout: X.layout, page: from && u < 1 ? 'wipe' : onPage ? 'explain' : 'scene', box: shown ? sb.box : null, head: shown ? hb : null, lines: sb.fit.lines, z: sb.fit.z, W, H });
}
