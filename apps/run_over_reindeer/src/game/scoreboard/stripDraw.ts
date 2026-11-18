// THE STRIP'S NEWER PROGRAMS (2026-11-17, approved): the scatter anticipation count and the short Grandma line, drawn on the
// strip's face at ONE PIXEL PER DOT like everything else on it (game/scoreboard/scoreboardDraw.ts). Plain 2D canvas drawing,
// no filter. Strip only: the back board never shows these.
import { LED_BOARD } from '../constants';
import { drawText, textW } from '../landing/ledScreens';
import { burst, chaseBorder, drawRow, fireworks, fitCap, rowInfo, sprite, type Face } from './scoreboardDraw';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => {
	t = clamp(t, 0, 1);
	return t * t * (3 - 2 * t);
};
/** the present picture's sides (scoreboardArtSpec present: 180 x 201) */
const PRESENT_K = 180 / 201;

/** what the count shows: the presents seen, the number needed (the next trigger, or the one reached once it is over), when
 *  the last one landed (strip clock ms), and the fireworks' start (null: none) */
export type ScatterFace = { count: number; need: number; tickAt: number; fwAt: number | null; at: number };

/** the count's place on a face (cached per size and need) */
type CountLay = { icon: number; gap: number; x0: number; textX: number; textY: number; cap: number; iconY: number; str: string };
const layCache = new Map<string, CountLay>();
function countLayout(W: number, H: number, need: number): CountLay {
	const key = `${W}x${H}|${need}`;
	let r = layCache.get(key);
	if (r) return r;
	const m = H >= 20 ? 2 : 1;
	const str = `${need} OF ${need}`;
	let icon = Math.max(5, H - 2 * m - 1);
	let cap = fitCap(str, W, Math.max(5, Math.min(H - 2 * m - 1, Math.round(H * 0.62))));
	for (let i = 0; i < 40; i++) {
		const gap = Math.max(1, Math.round(icon * 0.18));
		const iw = Math.round(icon * PRESENT_K);
		const total = need * iw + (need - 1) * gap + Math.max(4, Math.round(H * 0.3)) + rowInfo(str, cap).w;
		if (total <= W - 2 * m - 4 || icon <= 5) break;
		if (icon > cap * 1.05) icon -= 1;
		else if (cap > 5) cap -= 1;
		else icon -= 1;
	}
	const gap = Math.max(1, Math.round(icon * 0.18));
	const iw = Math.round(icon * PRESENT_K);
	const sep = Math.max(4, Math.round(H * 0.3));
	const total = need * iw + (need - 1) * gap + sep + rowInfo(str, cap).w;
	const x0 = Math.round((W - total) / 2);
	r = { icon, gap, x0, textX: x0 + need * iw + (need - 1) * gap + sep, textY: Math.round((H - cap) / 2), cap, iconY: Math.round((H + icon) / 2), str };
	if (layCache.size > 60) layCache.clear();
	layCache.set(key, r);
	return r;
}

/** THE SCATTER COUNT at strip clock `clock` (constants LED_BOARD.scatterCount): a row of `need` presents, the ones seen lit,
 *  the rest dim; the newest pops in with a ring of dots; the count in words beside them ("2 OF 3"). With fwAt: fireworks of
 *  dots over it (a trigger). */
export function showScatterCount(F: Face, s: ScatterFace, clock: number) {
	const g = F.out.ctx;
	const W = F.dotsW;
	const H = F.dotsH;
	const K = LED_BOARD.scatterCount;
	g.clearRect(0, 0, W, H);
	chaseBorder(g, W, H, clock, ['#36ff74', '#202020', '#ff3a2e', '#202020'], 1, 3);
	const need = Math.max(1, s.need);
	const lay = countLayout(W, H, need);
	const iw = Math.round(lay.icon * PRESENT_K);
	const since = clock - s.tickAt;
	const pop = clamp(since / K.popMs, 0, 1);
	for (let i = 0; i < need; i++) {
		const x = lay.x0 + i * (iw + lay.gap);
		const lit = i < s.count;
		const newest = lit && i === s.count - 1 && since < K.popMs;
		if (newest) {
			// it pops in from half again its size, its foot kept on the row
			const k = 1 + 0.5 * (1 - ease(pop));
			const h = Math.round(lay.icon * k);
			const w = Math.round(h * PRESENT_K);
			sprite(g, 'present', Math.round(x + iw / 2 - w / 2), lay.iconY + Math.round((h - lay.icon) / 2), h);
		} else {
			g.globalAlpha = lit ? 1 : K.dimAlpha;
			sprite(g, 'present', x, lay.iconY, lay.icon);
			g.globalAlpha = 1;
		}
		// the newest one's ring of dots
		if (lit && i === s.count - 1 && since >= 0 && since < K.tickMs) burst(g, x + iw / 2, lay.iconY - lay.icon / 2, since / K.tickMs, Math.round(lay.icon * 0.9));
	}
	const str = `${Math.min(s.count, 99)} OF ${need}`;
	const pulse = since >= 0 && since < K.tickMs ? 1 - since / K.tickMs : 0;
	drawRow(g, str, lay.textX + (rowInfo(lay.str, lay.cap).w - rowInfo(str, lay.cap).w), lay.textY, lay.cap, s.fwAt !== null ? 'gold' : '#ffffff', pulse);
	if (s.fwAt !== null) {
		const t = clock - s.fwAt;
		// a white flash, then fireworks bursts across the whole strip (dots only)
		if (t >= 0 && t < 180) {
			g.globalAlpha = 0.6 * (1 - t / 180);
			g.fillStyle = '#ffffff';
			g.fillRect(0, 0, W, H);
			g.globalAlpha = 1;
		}
		fireworks(g, W, H * 1.4, t, ['#ffd23a', '#ff3a2e', '#36ff74', '#ffffff', '#4aa8ff'], Math.max(3, Math.round(W / 36)));
	}
}

/** what the count's words read now (the probe) */
export const scatterWordsOf = (s: ScatterFace): string => `${Math.min(s.count, 99)} OF ${Math.max(1, s.need)}`;

/** THE SHORT GRANDMA LINE (constants LED_BOARD.gag.short): one screen, its letters drop in one after another and bounce once,
 *  then the line holds with a gold chase round it, for gag.short.ms */
export function showGagShort(F: Face, t: number) {
	const g = F.out.ctx;
	const W = F.dotsW;
	const H = F.dotsH;
	const str = LED_BOARD.gag.short.text;
	g.clearRect(0, 0, W, H);
	chaseBorder(g, W, H, t, ['#ffd23a', '#202020'], 1, 3);
	const s = textW(str, 2) <= W - 4 && H >= 17 ? 2 : 1;
	const total = textW(str, s);
	// a line too long for the strip at the smallest size scrolls once across it over the screen's time
	const over = Math.max(0, total - (W - 4));
	const x0 = over > 0 ? Math.round(2 - over * clamp((t - 200) / Math.max(1, LED_BOARD.gag.short.ms - 500), 0, 1)) : Math.round((W - total) / 2);
	const y0 = Math.round((H - 7 * s) / 2);
	let x = x0;
	const stepMs = Math.min(30, 600 / Math.max(1, str.length));
	[...str].forEach((ch, i) => {
		const w = textW(ch, s);
		const lt = t - i * stepMs;
		if (lt > 0) {
			const dy = lt < 140 ? -Math.round((1 - ease(lt / 140)) * H * 0.6) : lt < 230 ? Math.round(Math.sin(((lt - 140) / 90) * Math.PI) * 1.5) : 0;
			drawText(g, ch, x, y0 + dy, s, i >= str.length - 1 ? '#ffd23a' : '#ffffff');
		}
		x += w + s;
	});
}
