// THE STRIP'S NEWER PROGRAMS (2026-11-17, approved): the scatter anticipation count and the short Grandma line, drawn on the
// strip's face like everything else on it (game/scoreboard/scoreboardDraw.ts; k LEDs per dot on the finer grid, ledGrid.ts).
// Plain 2D canvas drawing, no filter. Strip only: the back board never shows these.
import { LED_BOARD, LED_SIGN } from '../constants';
import { SCREENS, dissolve, drawText, textW, type LedText } from '../landing/ledScreens';
import { burst, chaseBorder, drawRow, fireworks, fitCap, rowInfo, sprite, type Face } from './scoreboardDraw';
import { copyFace } from './ledGrid';
import { RED_FROM } from '../road/present';
import { noteIdea } from './ideasKit';

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
	// THE SUPER PRESENT IS RED (Corey 2026-11-20: "on Super Free Spins the small LED board shows 4 presents, but they are all
	// blue, the 4th should be red"): as on the road (game/road/present.ts RED_FROM, roadBoard rankPresents), the present
	// that makes a trigger Super, the 4th and on, is the red one; the first three stay teal. Only a base spin's count has
	// a 4th place (a bonus round's needs 3), dim or lit as the rest
	const names: string[] = [];
	for (let i = 0; i < need; i++) {
		const pic = i + 1 >= RED_FROM ? 'present_red' : 'present';
		names.push(pic);
		const x = lay.x0 + i * (iw + lay.gap);
		const lit = i < s.count;
		const newest = lit && i === s.count - 1 && since < K.popMs;
		if (newest) {
			// it pops in from half again its size, its foot kept on the row
			const k = 1 + 0.5 * (1 - ease(pop));
			const h = Math.round(lay.icon * k);
			const w = Math.round(h * PRESENT_K);
			sprite(g, pic, Math.round(x + iw / 2 - w / 2), lay.iconY + Math.round((h - lay.icon) / 2), h);
		} else {
			g.globalAlpha = lit ? 1 : K.dimAlpha;
			sprite(g, pic, x, lay.iconY, lay.icon);
			g.globalAlpha = 1;
		}
		// the newest one's ring of dots
		if (lit && i === s.count - 1 && since >= 0 && since < K.tickMs) burst(g, x + iw / 2, lay.iconY - lay.icon / 2, since / K.tickMs, Math.round(lay.icon * 0.9));
	}
	// (the probe: each present's picture and its box in dots, left to right)
	noteIdea(g.canvas, 'scatter', { names, boxes: names.map((_, i) => [lay.x0 + i * (iw + lay.gap), lay.iconY - lay.icon, iw, lay.icon]), count: s.count, need });
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

// ---- THE PRESS SCREEN ON THE EXPANDED BOARD (2026-11-17, Corey approved) ----------------------------------------------------
/** the explainer screen shown at `T` s (the press screen's own cycle, constants LED_SIGN holdS and transS) */
export const pressScreenAt = (T: number) => Math.floor(T / (LED_SIGN.holdS + LED_SIGN.transS)) % SCREENS.length;

/** THE EXPLAINER SCREENS on the back board's face (the press screen's own drawing code, game/landing/ledScreens.ts SCREENS):
 *  the max win, Santa's sleigh struck, Grandma's car struck, each held holdS and dissolving into the next over transS, as
 *  the old billboard cycled them. `T` s since the board seated. */
export function showPressScreens(F: Face, T: number, text: LedText) {
	const W = F.dotsW;
	const H = F.dotsH;
	const period = LED_SIGN.holdS + LED_SIGN.transS;
	const n = Math.floor(T / period);
	const tau = T - n * period;
	const N = SCREENS.length;
	const i = n % N;
	const o = F.out.ctx;
	F.b.ctx.clearRect(0, 0, W, H);
	SCREENS[i](F.b.ctx, W, H, tau, text);
	if (tau < LED_SIGN.transS && n > 0) {
		F.a.ctx.clearRect(0, 0, W, H);
		SCREENS[(i + N - 1) % N](F.a.ctx, W, H, period + tau, text);
		o.clearRect(0, 0, W, H);
		dissolve(o, F.a, F.b, F.noise, tau / LED_SIGN.transS, W, H);
	} else {
		o.clearRect(0, 0, W, H);
		copyFace(o, F.b);
	}
}

/** THE PRESS LINE on the strip (the entry item while the press screen is up): PRESS ANYWHERE TO CONTINUE, pulsing, once the
 *  press gate is open (blank before); scrolled when it does not fit. `t` ms. */
export function showPressLine(F: Face, t: number, ready: boolean, line: string) {
	const g = F.out.ctx;
	const W = F.dotsW;
	const H = F.dotsH;
	g.clearRect(0, 0, W, H);
	if (!ready) return;
	const s = textW(line, 2) <= W - 6 && H >= 17 ? 2 : 1;
	const w = textW(line, s);
	const y = Math.round((H - 7 * s) / 2);
	g.globalAlpha = 0.55 + 0.45 * (0.5 + 0.5 * Math.cos((t / 1000) * Math.PI * 2 * 0.75));
	if (w <= W - 4) drawText(g, line, Math.round((W - w) / 2), y, s, '#ffe7b0');
	else drawText(g, line, Math.round(W - (((t / 1000) * 26 * s) % (w + W))), y, s, '#ffe7b0');
	g.globalAlpha = 1;
}

/** THE SUPER WHEEL'S LINE (constants SUPER_WHEEL.text; game/road/superWheel.ts says it): one line of capitals fitted to the
 *  strip, gold or white; `blink`: dark one beat in three (a result, the press line) */
export type WheelLine = { text: string; tone: 'gold' | 'white'; blink: boolean };
export function showWheelLine(F: Face, line: WheelLine, clock: number) {
	const g = F.out.ctx;
	const W = F.dotsW;
	const H = F.dotsH;
	g.clearRect(0, 0, W, H);
	if (line.blink && Math.floor(clock / 260) % 3 === 2) return;
	const m = H >= 20 ? 2 : 1;
	const cap = fitCap(line.text, W - 2 * m - 4, Math.max(5, Math.min(H - 2 * m - 1, Math.round(H * 0.72))));
	drawRow(g, line.text, Math.round((W - rowInfo(line.text, cap).w) / 2), Math.round((H - cap) / 2), cap, line.tone === 'gold' ? 'gold' : '#ffffff', 0);
}
