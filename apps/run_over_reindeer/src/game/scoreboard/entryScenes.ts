// THE FREE SPINS AND SUPER ENTRIES, round 1 picks (Corey 2026-11-19, led_anim_ideas_r1_2026-11-19: "fs-presents" and
// "sfs-tease"; constants LED_BOARD.ideas fsEntry, sfsEntry). The mock's drawing code (its entries.ts), ported: each is a back
// board program in place of scoreboardDraw.ts showEntryScene and a pure function of the scene's clock (sceneT), so the
// press (landCard: the scene jumps to its READY beat), the press line's time (scenes fsPressMs 2300, sfsPressMs 2900), the
// explanation page that wipes in then (explainDraw.ts) and Autoplay Bonuses (the card continues 1.4 s after it comes up) are
// exactly as before. The words are today's: the spin count, FREE SPINS, SUPER. Nothing new is said on the board.
//   PRESENTS POP (Free Spins): the round's trigger scatters (the book's count; fsPresents for a card by hand) fly up from the reels' side of the board, land, jiggle and pop (the lid
//     flies off, the box falls away, a burst of dots); the count rises out of the middle one and slams to its size, FREE
//     SPINS under it, then today's READY beat (confetti, the reindeer trotting)
//   RED PRESENT TEASE (Super): the red present (the Super scatter) drops in; its lid lifts and a window rises out of it with
//     the three column characters spinning past; the lid slams shut, the present shrinks to the bottom and SUPER, FREE SPINS
//     and the gold count come in above it. The reel's order and speed are FIXED (a cosmetic loop of the three, its own
//     clock): the board is never told the wheel's result and the window closes while it still spins, so nothing here shows
//     or hints at what the wheel will land on.
import { dotAt, copyP } from './ledGrid';
import { BULBS, artSize, boardTitle, burst, chaseBorder, entryNumberLayout, flash, gallop, marchAt, sceneT, slamRow, sparkles, type ArtName, type Face } from './scoreboardDraw';
import { LED_BOARD } from '../constants';
import type { Show } from './show';
import { box, clamp, ease, easeOut, frame, hash, lerp, noteIdea, pic, picC, picW, span, type Ctx } from './ideasKit';

const dot = dotAt;
const READY = { fs: 2200, sfs: 2800 };
const FS_COLS = ['#36ff74', '#ffffff', '#ff3a2e', '#ffffff'];

function fsBack(g: Ctx, W: number, H: number, t: number) {
	g.fillStyle = 'rgba(30,90,220,0.14)';
	g.fillRect(0, 0, W, H);
	chaseBorder(g, W, H, t, FS_COLS, H >= 60 ? 2 : 1, 3);
}
function nightBack(g: Ctx, W: number, H: number, t: number, sparkN: number) {
	g.fillStyle = 'rgba(8,16,60,0.85)';
	g.fillRect(0, 0, W, H);
	sparkles(g, W, H, t, sparkN, ['#ffffff', '#cfe8ff', '#ffd23a'], 41);
	chaseBorder(g, W, H, t, ['#ff3a2e', '#ffd23a'], 1, 3);
	if (H >= 40) chaseBorder(g, W - 6, H - 6, t + 180, ['#ffd23a', '#ff3a2e'], 1, 3, 3);
}
function moon(g: Ctx, W: number, H: number) {
	const mr = Math.max(3, Math.round(H * 0.07));
	g.fillStyle = '#fff3c4';
	g.beginPath();
	g.arc(W * 0.86, H * 0.18, mr, 0, Math.PI * 2);
	g.fill();
	g.fillStyle = 'rgba(8,16,60,1)';
	g.beginPath();
	g.arc(W * 0.86 + mr * 0.45, H * 0.18 - mr * 0.2, mr, 0, Math.PI * 2);
	g.fill();
}
/** today's READY confetti (the game's own, at its density) */
function confetti(g: Ctx, W: number, H: number, t: number, a = 0.7) {
	const n = Math.round((W * H) / 70);
	for (let q = 0; q < n; q++) {
		const x = (hash(q * 5.3) * W + Math.sin(t / 500 + q) * 2 + W) % W;
		const y = (hash(q * 2.7) * H + t * (0.01 + hash(q) * 0.012)) % H;
		g.globalAlpha = a;
		dot(g, x, y, BULBS[q % 4]);
	}
	g.globalAlpha = 1;
}
function readyTrot(g: Ctx, W: number, H: number, s: Show, t: number, sup: boolean) {
	const r = sup ? READY.sfs : READY.fs;
	if (t < r) return;
	const p = ((t - r) % 2600) / 2600;
	const h2 = Math.round(H * (sup ? 0.14 : 0.16));
	gallop(g, -h2 * 1.3 + p * (W + h2 * 2.6), H - 2, h2, s.t);
}

// ==== THE PRESENTS POP (fs-presents) =============================================================================================
export function presentsEntry(F: Face, s: Show) {
	const g = F.out.ctx;
	const W = F.dotsW;
	const H = F.dotsH;
	const t = sceneT(s);
	const num = String(s.spins);
	g.clearRect(0, 0, W, H);
	const lay = entryNumberLayout(W, H, num, 'FREE SPINS', null);
	fsBack(g, W, H, s.t);
	// (2026-11-20, Corey: "Real trigger count": the scatters the round triggered with, the book's own count; the tune
	// panel's fsPresents only where none is known, a card raised by hand. Not clamped: the layout fits any count)
	const n = s.presents > 0 ? s.presents : Math.max(1, Math.round(LED_BOARD.ideas.fsPresents));
	const name: ArtName = 'present';
	const ph = Math.round(Math.min(H * 0.3, (W / (n + 1)) * 0.85));
	const yRest = Math.round(H * 0.5 + ph / 2);
	const flyMs = 520;
	const stagger = 110;
	const tJig = 760;
	const tPop = 1250;
	const numAt = tPop + 200;
	const [sw, sh] = artSize(name, null);
	const lidH = sh * 0.42;
	const w = picW(name, ph);
	const drawn: string[] = [];
	// (the presents' places at rest, dots [x, y, w, h]: the probe checks every count fits the face, none overlapping)
	const boxes = Array.from({ length: n }, (_, i) => [Math.round((W * (i + 1)) / (n + 1) - w / 2), yRest - ph, w, ph]);
	for (let i = 0; i < n; i++) {
		const xs = (W * (i + 1)) / (n + 1);
		const ti = i * stagger;
		const u = clamp((t - ti) / flyMs, 0, 1);
		if (u <= 0) continue;
		const x0 = W / 2 + (xs - W / 2) * 0.25;
		let cx = lerp(x0, xs, easeOut(u));
		let yb = lerp(H + ph, yRest, easeOut(u)) - Math.sin(Math.PI * u) * H * 0.22;
		// the landing bounce, then the jiggle as it gets ready to pop
		const land = t - (ti + flyMs);
		if (land >= 0 && land < 200) yb -= Math.round(Math.abs(Math.sin((land / 200) * Math.PI)) * ph * 0.12);
		if (t >= tJig && t < tPop) {
			const j = Math.floor(t / 55) % 2 ? 1 : -1;
			cx += j * (i % 2 ? 1 : -1);
		}
		// the trail of sparkle dots behind a flying present
		if (u < 1) {
			for (let q = 1; q < 8; q++) {
				const uq = clamp(u - q * 0.05, 0, 1);
				const tx = lerp(x0, xs, easeOut(uq));
				const ty = lerp(H + ph, yRest, easeOut(uq)) - Math.sin(Math.PI * uq) * H * 0.22 - ph * 0.5;
				g.globalAlpha = 1 - q / 8;
				dot(g, tx + (hash(q + i * 9) - 0.5) * 4, ty, q % 2 ? '#ffffff' : '#8fe6ff');
			}
			g.globalAlpha = 1;
		}
		if (t < tPop) {
			pic(g, name, cx - w / 2, yb, ph);
			drawn.push(name);
			continue;
		}
		// THE POP: the lid flies up and off, a burst of dots, the box falls away
		const pt = t - tPop;
		const side = i < (n - 1) / 2 ? -1 : i > (n - 1) / 2 ? 1 : 0;
		const lidY = yb - ph * 0.58 - (pt / 1000) * H * 1.6 + (pt / 1000) ** 2 * H * 1.4;
		if (pt < 700) {
			g.globalAlpha = 1 - span(pt, 400, 700);
			pic(g, name, cx - w / 2 + (side || (i % 2 ? 1 : -1)) * pt * 0.06, lidY, ph * 0.42, false, [0, 0, sw, lidH]);
			g.globalAlpha = 1;
		}
		const fall = Math.max(0, pt - 60);
		const by = yb + (fall / 1000) ** 2 * H * 9;
		if (by - ph * 0.58 < H) {
			pic(g, name, cx - w / 2, by, ph * 0.58, false, [0, lidH, sw, sh - lidH]);
			drawn.push(name);
		}
		burst(g, cx, yb - ph * 0.6, pt / 500, Math.round(ph * 0.8));
	}
	if (t >= numAt) {
		// the number rises out of the middle box as it pops, then slams to its size
		const rise = clamp((t - numAt) / 220, 0, 1);
		const yy = Math.round(lerp(yRest - lay.cap * 0.5, lay.numY, easeOut(rise)));
		slamRow(g, num, W / 2, yy, lay.cap, t - numAt, '#ffffff');
		flash(g, W, H, t - numAt - 60, 120);
	}
	if (t >= numAt + 160) boardTitle(g, 'FREE SPINS', W / 2, lay.titleY, lay.tts, '#7cc4ff', { word: true });
	if (t >= READY.fs - 500) confetti(g, W, H, s.t, 0.7);
	readyTrot(g, W, H, s, t, false);
	noteIdea(g.canvas, 'entry', { kind: 'fs-presents', presents: drawn, count: n, boxes });
}

// ==== THE RED PRESENT TEASE (sfs-tease) ==========================================================================================
/** the window's reel: the three column characters in a FIXED order (a cosmetic loop, never the wheel's result) */
const REEL: ArtName[] = ['reindeer_col', 'santa_col', 'grandma_col'];
export function teaseEntry(F: Face, s: Show) {
	const g = F.out.ctx;
	const W = F.dotsW;
	const H = F.dotsH;
	const t = sceneT(s);
	const num = String(s.spins);
	g.clearRect(0, 0, W, H);
	nightBack(g, W, H, s.t, Math.round((W * H) / 160));
	moon(g, W, H);
	const name: ArtName = 'present_red';
	const [sw, sh] = artSize(name, null);
	const lidShare = 0.36;
	const big = Math.round(H * 0.34);
	const small = Math.round(H * 0.24);
	const shrink = ease(span(t, 1850, 2250));
	const ph = Math.round(lerp(big, small, shrink));
	const pw = picW(name, ph);
	const cx = W / 2;
	const drop = easeOut(clamp(t / 420, 0, 1));
	const restB = Math.round(lerp(H - 5, H - 3, shrink));
	let yb = Math.round(lerp(-2, restB, drop));
	if (t > 420 && t < 600) yb -= Math.round(Math.sin(((t - 420) / 180) * Math.PI) * 4);
	// the lid: up and hovering 450..1700, slammed down at 1750, twitching at the READY beat
	const lidUp = t < 450 ? 0 : t < 600 ? ease((t - 450) / 150) : t < 1700 ? 1 : t < 1760 ? 1 - (t - 1700) / 60 : 0;
	const twitch = t >= READY.sfs - 300 && (t - (READY.sfs - 300)) % 900 < 160 ? 0.18 : 0;
	const bodyH = ph * (1 - lidShare);
	// the character reel rises out of the box while the lid hovers: the three column characters spin past a gold window
	const winOpen = t < 600 ? 0 : t < 820 ? ease((t - 600) / 220) : t < 1640 ? 1 : t < 1720 ? 1 - (t - 1640) / 80 : 0;
	const whFull = Math.round(Math.min(ph * 1.15, H - big - 14));
	const lift = Math.round(Math.max((lidUp * 0.3 + twitch) * ph, whFull * winOpen + (winOpen > 0 ? 1 : 0)));
	const reelShown: string[] = [];
	if (winOpen > 0) {
		const wh = Math.round(whFull * winOpen);
		const ww = Math.round(Math.max(pw * 0.95, whFull * 0.8));
		const wx = Math.round(cx - ww / 2);
		const wy = Math.round(yb - bodyH - wh);
		box(g, wx, wy, ww, wh, '#04060f');
		// the reel: speed rising, each picture fitted in the window, scrolled up through it (the scene's clock only)
		const cellH = whFull;
		const v = (q: number) => 0.05 + 0.25 * clamp(q / 800, 0, 1);
		let off = 0;
		for (let q = 600; q < t; q += 30) off += 30 * v(q - 600);
		const a = F.a.ctx;
		a.clearRect(0, 0, W, H);
		const i0 = Math.floor(off / cellH);
		const frac = off - i0 * cellH;
		for (let j = 0; j < 2; j++) {
			const pn = REEL[(i0 + j) % 3];
			const yB = wy + wh + frac - j * cellH;
			picC(a, pn, cx, yB - 2, cellH - 4);
			reelShown.push(pn);
		}
		const k = F.k;
		copyP(g, F.a, Math.round((wx + 1) * k), Math.round(wy * k), Math.round((ww - 2) * k), Math.round(wh * k));
		frame(g, wx, wy, ww, wh, 1, '#ffd23a');
		for (let q = 0; q < 8; q++) {
			const a2 = (q / 8) * Math.PI * 2 + t / 200;
			g.globalAlpha = 0.5 + 0.5 * Math.sin(t / 70 + q);
			dot(g, cx + Math.cos(a2) * ww * 0.75, wy + wh / 2 + Math.sin(a2) * wh * 0.6, q % 2 ? '#ffd23a' : '#ffffff');
		}
		g.globalAlpha = 1;
	}
	// the box (its body), then the lid above it
	const bx = cx - pw / 2;
	pic(g, name, bx, yb, bodyH, false, [0, sh * lidShare, sw, sh * (1 - lidShare)]);
	pic(g, name, bx, yb - bodyH - lift, ph * lidShare, false, [0, 0, sw, sh * lidShare]);
	if (twitch > 0) for (let q = 0; q < 5; q++) dot(g, cx + (hash(q + Math.floor(t / 60)) - 0.5) * pw * 0.6, yb - bodyH - 1 - hash(q * 3) * lift, '#ffd23a');
	// the slam: a puff of dots either side and a small flash
	const st = t - 1760;
	if (st >= 0 && st < 500) {
		for (let q = 0; q < 14; q++) {
			const side = q % 2 ? 1 : -1;
			const u = st / 500;
			g.globalAlpha = 1 - u;
			dot(g, cx + side * (pw * 0.5 + u * W * 0.12 * (0.5 + hash(q))), yb - 2 - hash(q * 5) * ph * 0.3 * u, '#ffffff');
		}
		g.globalAlpha = 1;
		flash(g, W, H, st, 120);
	}
	// the lockup above the present once it has shrunk to the bottom
	if (t >= 1850) {
		const lay = entryNumberLayout(W, H - small - 6, num, 'FREE SPINS', 'SUPER');
		marchAt(g, 'SUPER', W / 2, lay.topY, lay.sts, t - 1900, '#ffd23a', H * 0.3);
		if (t >= 2200) boardTitle(g, 'FREE SPINS', W / 2, lay.titleY, lay.tts, '#ff6a4a', { word: true });
		if (t >= 2400) {
			slamRow(g, num, W / 2, lay.numY, lay.cap, t - 2400, 'gold');
			flash(g, W, H, t - 2400, 160);
		}
	}
	noteIdea(g.canvas, 'entry', { kind: 'sfs-tease', presents: [name, name], reel: reelShown, window: winOpen });
}
